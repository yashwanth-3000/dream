from __future__ import annotations

import asyncio
import base64
import threading
import time
from types import SimpleNamespace

import pytest

from agent_storybook.schemas import (
    CharacterBrief,
    ScenePromptBundle,
    StoryBlueprint,
    StoryBookCreationRequest,
    StoryDraft,
    StoryRightPage,
)
from agent_storybook.services.replicate_service import ReplicateGenerationError
from agent_storybook.story_workflow import (
    STORY_TEXT_PAGE_COUNT,
    CHAPTER_SEQUENCE,
    MIN_CHAPTER_TEXT_CHARS,
    RESOLUTION_KEYWORDS,
    CharacterBackendError,
    CharacterA2AClient,
    StoryBookWorkflow,
    StoryWorkflowError,
)


class StubBlueprintAgent:
    def __init__(self, blueprint: StoryBlueprint, delay: float = 0.0) -> None:
        self._blueprint = blueprint
        self._delay = delay

    async def generate(self, **_: object) -> StoryBlueprint:
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._blueprint


class StubStoryWriterAgent:
    def __init__(self, draft: StoryDraft, delay: float = 0.0) -> None:
        self._draft = draft
        self._delay = delay

    async def generate(self, **_: object) -> StoryDraft:
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._draft


class StubScenePromptAgent:
    def __init__(self, bundle: ScenePromptBundle) -> None:
        self._bundle = bundle

    async def generate(self, **_: object) -> ScenePromptBundle:
        return self._bundle


class StubVisionService:
    def describe_character_drawing(self, image_input: str, user_hint: str = "") -> str:
        return f"drawing:{len(image_input)}:{len(user_hint)}"

    def describe_world_reference(self, image_input: str, user_hint: str = "") -> str:
        return f"world:{len(image_input)}:{len(user_hint)}"


class StubCharacterClient:
    def __init__(self, fail_names: set[str] | None = None, delay: float = 0.0) -> None:
        self._fail_names = fail_names or set()
        self._delay = delay

    async def create_character_from_brief(self, brief: CharacterBrief, payload: StoryBookCreationRequest):
        if self._delay:
            await asyncio.sleep(self._delay)
        if brief.name in self._fail_names:
            raise RuntimeError(f"forced failure for {brief.name}")
        return {
            "backstory": {"name": brief.name},
            "image_prompt": {"positive_prompt": f"prompt {brief.name}"},
            "generated_images": [f"https://chars.local/{brief.name}.png"],
        }


class StubReplicateService:
    def __init__(
        self,
        fail_scene_indexes: set[int] | None = None,
        fail_prompt_tokens: set[str] | None = None,
        delays_by_call_index: dict[int, float] | None = None,
    ) -> None:
        self.calls: list[dict[str, object]] = []
        self._fail_scene_indexes = fail_scene_indexes or set()
        self._fail_prompt_tokens = fail_prompt_tokens or set()
        self._delays_by_call_index = delays_by_call_index or {}
        self._lock = threading.Lock()
        self.model = "prunaai/p-image"

    def generate_story_image(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        output_count: int | None = None,
        aspect_ratio: str | None = None,
        reference_images: list[str] | None = None,
    ) -> str:
        with self._lock:
            index = len(self.calls)
            self.calls.append(
                {
                    "index": index,
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "reference_images": list(reference_images or []),
                }
            )

        delay_seconds = float(self._delays_by_call_index.get(index, 0.0))
        if delay_seconds > 0:
            time.sleep(delay_seconds)

        if index in self._fail_scene_indexes:
            raise ReplicateGenerationError("forced replicate failure")
        if any(token in prompt for token in self._fail_prompt_tokens):
            raise ReplicateGenerationError("forced replicate failure")
        return f"https://scenes.local/{index}.png"


class StubTTSService:
    def synthesize_text_to_data_url(self, text: str) -> str:
        normalized = " ".join((text or "").split()).strip() or "empty"
        encoded = base64.b64encode(normalized.encode("utf-8")).decode("ascii")
        return f"data:audio/mpeg;base64,{encoded}"


def build_payload(*, with_references: bool = False, force_workflow: str | None = None) -> StoryBookCreationRequest:
    world_references = []
    character_drawings = []
    if with_references:
        world_references = [
            {
                "title": "Orbital ruins",
                "description": "Flooded silver halls.",
                "url": "https://example.com/world.jpg",
            }
        ]
        character_drawings = [
            {
                "notes": "Front-facing sketch",
                "image_data": "data:image/png;base64,aGVsbG8=",
            }
        ]

    return StoryBookCreationRequest(
        user_prompt="A moon explorer rescues a lost archive",
        world_references=world_references,
        character_drawings=character_drawings,
        force_workflow=force_workflow,
        max_characters=2,
        tone="hopeful",
        age_band="5-8",
    )


def build_blueprint(two_characters: bool = False) -> StoryBlueprint:
    briefs = [CharacterBrief(name="Nova", brief="Lead explorer in silver armor")]
    if two_characters:
        briefs.append(CharacterBrief(name="Sidekick", brief="Curious drone companion"))

    return StoryBlueprint(
        title="Nova and the Moon Archive",
        logline="A brave explorer restores lost memory lights.",
        title_page_text="A moonlit story of courage and curiosity.",
        end_page_text="The stars remember those who keep their promises.",
        cover_concept="Nova stands at an ancient gate under moonlight.",
        character_briefs=briefs,
        page_plans=[
            {
                "page_number": index,
                "chapter": CHAPTER_SEQUENCE[index - 1],
                "beat": f"Story beat for {CHAPTER_SEQUENCE[index - 1]}.",
            }
            for index in range(1, STORY_TEXT_PAGE_COUNT + 1)
        ],
    )


def build_story() -> StoryDraft:
    return StoryDraft(
        title="Nova and the Moon Archive",
        title_page_text="A moonlit story of courage and curiosity.",
        right_pages=[
            StoryRightPage(
                page_number=index,
                chapter=CHAPTER_SEQUENCE[index - 1],
                text=f"Story text for {CHAPTER_SEQUENCE[index - 1]}.",
            )
            for index in range(1, STORY_TEXT_PAGE_COUNT + 1)
        ],
        end_page_text="The stars remember those who keep their promises.",
    )


def build_scene_bundle() -> ScenePromptBundle:
    return ScenePromptBundle(
        cover_prompt="Cover image prompt",
        illustration_prompts=[f"Page {index} prompt" for index in range(1, STORY_TEXT_PAGE_COUNT + 1)],
        negative_prompt="no text overlays",
    )


def build_workflow(
    *,
    blueprint: StoryBlueprint | None = None,
    story: StoryDraft | None = None,
    scene: ScenePromptBundle | None = None,
    character_client: StubCharacterClient | None = None,
    replicate: StubReplicateService | None = None,
    tts: StubTTSService | None = None,
    writer_delay: float = 0.0,
) -> tuple[StoryBookWorkflow, StubReplicateService]:
    settings = SimpleNamespace(
        scene_image_retry_count=1,
        scene_image_timeout_seconds=30.0,
        character_backend_rpc_url="http://127.0.0.1:8000/a2a",
        story_audio_enabled=True,
        openai_api_key=None,
    )
    replicate_stub = replicate or StubReplicateService()

    workflow = StoryBookWorkflow(
        settings=settings,
        blueprint_agent=StubBlueprintAgent(blueprint or build_blueprint()),
        story_writer_agent=StubStoryWriterAgent(story or build_story(), delay=writer_delay),
        scene_prompt_agent=StubScenePromptAgent(scene or build_scene_bundle()),
        vision_service=StubVisionService(),
        replicate_service=replicate_stub,
        tts_service=tts or StubTTSService(),
        character_client=character_client or StubCharacterClient(),
    )
    return workflow, replicate_stub


def test_choose_workflow_prompt_only_and_reference_enriched_and_forced():
    prompt_only = build_payload(with_references=False)
    assert StoryBookWorkflow.choose_workflow(prompt_only) == "prompt_only"

    reference_enriched = build_payload(with_references=True)
    assert StoryBookWorkflow.choose_workflow(reference_enriched) == "reference_enriched"

    forced = build_payload(with_references=True, force_workflow="prompt_only")
    assert StoryBookWorkflow.choose_workflow(forced) == "prompt_only"

    reused = build_payload(with_references=False).model_copy(
        update={"reuse_existing_character": True}
    )
    assert StoryBookWorkflow.choose_workflow(reused) == "reference_enriched"


def test_character_client_prefers_a2a_when_enabled(monkeypatch: pytest.MonkeyPatch):
    settings = SimpleNamespace(
        character_backend_use_protocol=True,
        character_backend_timeout_seconds=30.0,
        character_backend_rpc_url="http://127.0.0.1:8000/a2a",
        character_backend_create_url="http://127.0.0.1:8000/api/v1/characters/create",
    )
    client = CharacterA2AClient(settings=settings)
    calls: dict[str, dict[str, object]] = {}

    async def fake_invoke_via_a2a(payload: dict[str, object]) -> dict[str, object]:
        calls["a2a"] = payload
        return {"generated_images": ["https://chars.local/nova.png"]}

    async def fake_invoke_via_http(payload: dict[str, object]) -> dict[str, object]:
        calls["http"] = payload
        return {"generated_images": ["https://chars.local/nova.png"]}

    monkeypatch.setattr(client, "_invoke_via_a2a", fake_invoke_via_a2a)
    monkeypatch.setattr(client, "_invoke_via_http", fake_invoke_via_http)

    result = asyncio.run(
        client.create_character_from_brief(
            brief=CharacterBrief(name="Nova", brief="Lead explorer"),
            payload=build_payload(with_references=False),
        )
    )

    assert "a2a" in calls
    assert "http" not in calls
    assert result["generated_images"] == ["https://chars.local/nova.png"]


def test_character_client_rejects_non_protocol_mode(monkeypatch: pytest.MonkeyPatch):
    settings = SimpleNamespace(
        character_backend_use_protocol=False,
        character_backend_timeout_seconds=30.0,
        character_backend_rpc_url="http://127.0.0.1:8000/a2a",
        character_backend_create_url="http://127.0.0.1:8000/api/v1/characters/create",
    )
    client = CharacterA2AClient(settings=settings)
    calls: dict[str, dict[str, object]] = {}

    async def fake_invoke_via_a2a(payload: dict[str, object]) -> dict[str, object]:
        calls["a2a"] = payload
        return {"generated_images": ["https://chars.local/nova.png"]}

    async def fake_invoke_via_http(payload: dict[str, object]) -> dict[str, object]:
        calls["http"] = payload
        return {"generated_images": ["https://chars.local/nova.png"]}

    monkeypatch.setattr(client, "_invoke_via_a2a", fake_invoke_via_a2a)
    monkeypatch.setattr(client, "_invoke_via_http", fake_invoke_via_http)

    with pytest.raises(CharacterBackendError, match="A2A-only mode"):
        asyncio.run(
            client.create_character_from_brief(
                brief=CharacterBrief(name="Nova", brief="Lead explorer"),
                payload=build_payload(with_references=False),
            )
        )

    assert "http" not in calls
    assert "a2a" not in calls


def test_spread_contract_matches_exact_layout():
    workflow, _ = build_workflow()
    response = asyncio.run(workflow.run(build_payload(with_references=True)))

    assert len(response.spreads) == STORY_TEXT_PAGE_COUNT + 2
    assert response.spreads[0].left.kind == "cover_image"
    assert response.spreads[0].right.kind == "title_page"
    assert response.spreads[0].label is None

    for spread_index in range(1, STORY_TEXT_PAGE_COUNT + 1):
        spread = response.spreads[spread_index]
        assert spread.left.kind == "illustration"
        assert spread.right.kind == "chapter_text"
        assert spread.label == f"Page {spread_index} of {STORY_TEXT_PAGE_COUNT}"

    assert response.spreads[4].right.chapter == "Chapter 4"
    assert response.spreads[-1].left.kind == "end_page"
    assert response.spreads[-1].right.kind == "empty"
    assert response.spreads[-1].label is None


def test_story_pages_include_audio_urls_for_accessibility():
    workflow, _ = build_workflow()
    response = asyncio.run(workflow.run(build_payload(with_references=False)))

    assert len(response.story.right_pages) == STORY_TEXT_PAGE_COUNT
    assert all(page.audio_url for page in response.story.right_pages)
    assert all(
        isinstance(page.audio_url, str) and page.audio_url.startswith("data:audio/")
        for page in response.story.right_pages
    )

    for spread_index in range(1, STORY_TEXT_PAGE_COUNT + 1):
        story_page = response.story.right_pages[spread_index - 1]
        assert response.spreads[spread_index].right.audio_url == story_page.audio_url


def test_parallel_character_and_story_branches_reduce_wall_time():
    workflow, _ = build_workflow(
        character_client=StubCharacterClient(delay=0.30),
        writer_delay=0.30,
    )

    start = time.perf_counter()
    asyncio.run(workflow.run(build_payload(with_references=False)))
    elapsed = time.perf_counter() - start

    # Sequential would be around >=0.60s for the two delayed branches.
    assert elapsed < 0.55


def test_reference_forwarding_order_and_dedup():
    payload = StoryBookCreationRequest(
        user_prompt="A moon explorer rescues a lost archive",
        world_references=[
            {
                "title": "Temple",
                "description": "Silver halls",
                "url": "https://example.com/world.jpg",
            }
        ],
        character_drawings=[
            {
                "notes": "front sketch",
                "image_data": "data:image/png;base64,aGVsbG8=",
            }
        ],
        max_characters=2,
    )

    workflow, replicate_stub = build_workflow()
    asyncio.run(workflow.run(payload))

    assert replicate_stub.calls, "Replicate should have been called for cover + pages"
    refs = replicate_stub.calls[0]["reference_images"]
    assert refs == [
        "https://chars.local/Nova.png",
        "data:image/png;base64,aGVsbG8=",
        "https://example.com/world.jpg",
    ]


def test_character_partial_failure_continues_with_warning():
    workflow, _ = build_workflow(
        blueprint=build_blueprint(two_characters=True),
        character_client=StubCharacterClient(fail_names={"Sidekick"}),
    )

    response = asyncio.run(workflow.run(build_payload(with_references=False)))

    assert len(response.characters) == 2
    assert any("Character generation failed for 'Sidekick'" in warning for warning in response.warnings)
    assert any(packet.generated_images for packet in response.characters)
    assert any(packet.warnings for packet in response.characters)


def test_replicate_failure_returns_scene_index_error():
    workflow, _ = build_workflow(replicate=StubReplicateService(fail_prompt_tokens={"Page 3 prompt"}))

    with pytest.raises(StoryWorkflowError, match=r"scene index 3"):
        asyncio.run(workflow.run(build_payload(with_references=False)))


def test_hedged_retry_returns_first_successful_scene_attempt():
    replicate = StubReplicateService(
        delays_by_call_index={
            0: 0.12,  # first attempt intentionally slow
            1: 0.01,  # second attempt should win
        }
    )
    workflow, _ = build_workflow(replicate=replicate)
    workflow._settings.scene_image_timeout_seconds = 0.05
    workflow._settings.scene_image_retry_count = 2

    result = asyncio.run(
        workflow._generate_single_scene_image(
            scene_index=4,
            prompt="Page 4 prompt",
            negative_prompt="no text",
            reference_images=["https://chars.local/Nova.png"],
        )
    )

    assert result == "https://scenes.local/1.png"
    assert len(replicate.calls) >= 2


def test_story_always_gets_complete_happy_ending():
    incomplete_story = StoryDraft(
        title="Ramu's Cricket Dream",
        title_page_text="Join Ramu in his quest to play for the cricket team!",
        right_pages=[
            StoryRightPage(page_number=1, chapter="Chapter 1", text="Ramu watches a cricket match."),
            StoryRightPage(page_number=2, chapter="Chapter 2", text="He starts practicing with friends."),
            StoryRightPage(page_number=3, chapter="Chapter 3", text="Training gets difficult."),
            StoryRightPage(page_number=4, chapter="Chapter 4", text="Ramu keeps trying despite setbacks."),
            StoryRightPage(
                page_number=5,
                chapter="Chapter 5",
                text="Ramu attends a local selection trial, nervous but ready.",
            ),
        ],
        end_page_text="Ramu keeps trying.",
    )

    workflow, _ = build_workflow(story=incomplete_story)
    response = asyncio.run(workflow.run(build_payload(with_references=False)))

    final_page_text = response.story.right_pages[-1].text.lower()
    end_page_text = response.story.end_page_text.lower()

    assert any(keyword in final_page_text for keyword in RESOLUTION_KEYWORDS)
    assert (
        "hope" in final_page_text
        or "happy" in final_page_text
        or "smiles" in final_page_text
        or "confidence" in final_page_text
    )
    assert "hope" in end_page_text or "keep believing" in end_page_text


def test_story_pages_are_expanded_for_book_space():
    short_story = StoryDraft(
        title="Tiny Draft",
        title_page_text="Begin.",
        right_pages=[
            StoryRightPage(page_number=1, chapter="Chapter 1", text="Ramu sees cricket."),
            StoryRightPage(page_number=2, chapter="Chapter 2", text="Friends join him."),
            StoryRightPage(page_number=3, chapter="Chapter 3", text="Practice gets hard."),
            StoryRightPage(page_number=4, chapter="Chapter 4", text="He keeps trying."),
            StoryRightPage(page_number=5, chapter="Chapter 5", text="He reaches trials."),
        ],
        end_page_text="Keep going.",
    )

    workflow, _ = build_workflow(story=short_story)
    response = asyncio.run(workflow.run(build_payload(with_references=False)))

    for page in response.story.right_pages:
        assert len(page.text) >= MIN_CHAPTER_TEXT_CHARS


def test_scene_prompts_include_optional_panel_guidance():
    workflow, _ = build_workflow()
    response = asyncio.run(workflow.run(build_payload(with_references=False)))
    prompt = response.scene_prompts.illustration_prompts[0].lower()
    assert "comic-style panels" in prompt

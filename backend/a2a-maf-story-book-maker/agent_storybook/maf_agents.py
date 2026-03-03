from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings
from .schemas import (
    GeneratedCharacterPacket,
    ScenePromptBundle,
    StoryBlueprint,
    StoryBookCreationRequest,
    StoryDraft,
    WorkflowType,
)


try:
    from agent_framework import Agent
    from agent_framework.azure import AzureOpenAIChatClient
    from agent_framework.openai import OpenAIChatClient
except Exception as exc:  # pragma: no cover - runtime import guard
    Agent = None  # type: ignore[assignment]
    AzureOpenAIChatClient = None  # type: ignore[assignment]
    OpenAIChatClient = None  # type: ignore[assignment]
    MAF_IMPORT_ERROR: Exception | None = exc
else:
    MAF_IMPORT_ERROR = None


BLUEPRINT_SYSTEM_PROMPT = """
You are StoryBlueprintAgent.
Generate compact JSON only.
Do not use markdown.

Task:
Create a short children's story blueprint from user input and references.

Rules:
- Keep the story compact and visual-first.
- Create at most 2 character briefs.
- Create exactly 10 page plans for right-side text pages.
- Page structure target:
  page 1 -> opening hook + character goal
  page 2 -> commitment to the journey
  page 3 -> early progress and wonder
  page 4 -> first obstacle
  page 5 -> stakes rise
  page 6 -> midpoint insight
  page 7 -> setback
  page 8 -> support + courage turn
  page 9 -> climax and solution
  page 10 -> clear emotional closure and hopeful payoff
- Make continuity-friendly content suitable for illustrated spreads.
- The story must end complete, hopeful, and emotionally satisfying for kids.

Output JSON keys exactly:
{
  "title": "...",
  "logline": "...",
  "title_page_text": "...",
  "end_page_text": "...",
  "cover_concept": "...",
  "character_briefs": [{"name":"...","brief":"..."}],
  "page_plans": [
    {"page_number":1,"chapter":"Chapter 1","beat":"..."},
    {"page_number":2,"chapter":"Chapter 2","beat":"..."},
    {"page_number":3,"chapter":"Chapter 3","beat":"..."},
    {"page_number":4,"chapter":"Chapter 4","beat":"..."},
    {"page_number":5,"chapter":"Chapter 5","beat":"..."},
    {"page_number":6,"chapter":"Chapter 6","beat":"..."},
    {"page_number":7,"chapter":"Chapter 7","beat":"..."},
    {"page_number":8,"chapter":"Chapter 8","beat":"..."},
    {"page_number":9,"chapter":"Chapter 9","beat":"..."},
    {"page_number":10,"chapter":"Chapter 10","beat":"..."}
  ]
}
""".strip()

WRITER_SYSTEM_PROMPT = """
You are StoryWriterAgent.
Generate compact JSON only.
Do not use markdown.

Task:
Write a short children's story draft for fixed layout.

Rules:
- Exactly 10 right-page entries.
- Each entry should be substantial (4-7 sentences) with clear progression.
- Target 420-700 characters per page entry so the right page feels full.
- Keep language child-friendly and clear.
- Keep chapter tags aligned to blueprint.
- Page 10 must resolve the core conflict and deliver a clear feel-good or motivational ending beat.
- end_page_text must be explicitly uplifting and complete (no cliffhanger tone).
- Write natural story prose only. Do not include meta narration like "In Chapter 3..." or instructional filler.
- Do not repeat stock phrasing across pages; each page should feel distinct and scene-specific.

Output JSON keys exactly:
{
  "title": "...",
  "title_page_text": "...",
  "right_pages": [
    {"page_number":1,"chapter":"Chapter 1","text":"..."},
    {"page_number":2,"chapter":"Chapter 2","text":"..."},
    {"page_number":3,"chapter":"Chapter 3","text":"..."},
    {"page_number":4,"chapter":"Chapter 4","text":"..."},
    {"page_number":5,"chapter":"Chapter 5","text":"..."},
    {"page_number":6,"chapter":"Chapter 6","text":"..."},
    {"page_number":7,"chapter":"Chapter 7","text":"..."},
    {"page_number":8,"chapter":"Chapter 8","text":"..."},
    {"page_number":9,"chapter":"Chapter 9","text":"..."},
    {"page_number":10,"chapter":"Chapter 10","text":"..."}
  ],
  "end_page_text": "..."
}
""".strip()

SCENE_PROMPT_SYSTEM_PROMPT = """
You are ScenePromptAgent.
Generate compact JSON only.
Do not use markdown.

Task:
Create one cover prompt and exactly ten illustration prompts for the story spreads.

Rules:
- Prompts must be story-ready and cinematic.
- Preserve character identity consistency across all prompts.
- Include setting/world continuity from references.
- Mention emotional beat and action context.
- Prompt 10 should reflect resolution pacing.
- If a page contains multiple micro-beats, you may use 2-4 comic-style panels inside one single 2:3 illustration.
- Keep panel compositions clean and visual-only (no text, speech bubbles, captions, or on-image words).

Output JSON keys exactly:
{
  "cover_prompt": "...",
  "illustration_prompts": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."],
  "negative_prompt": "..."
}
""".strip()

ModelT = TypeVar("ModelT", bound=BaseModel)

DEFAULT_MODEL_FALLBACKS = [
    "gpt-4o-mini",
    "gpt-4.1-mini",
    "gpt-4o",
]

INVALID_MODEL_ERROR_HINTS = (
    "invalid model",
    "model id",
    "does not exist",
    "model not found",
)


class MAFGenerationError(RuntimeError):
    pass


class _MAFJsonAgent:
    def __init__(self, settings: Settings, name: str, instructions: str) -> None:
        self._settings = settings
        self._name = name
        self._instructions = instructions
        self._model_candidates = self._build_model_candidates()
        self._active_model_index = 0
        self._agent = self._build_agent()

    def _build_agent(self) -> Any | None:
        if MAF_IMPORT_ERROR is not None or Agent is None:
            return None

        if self._settings.agent_provider == "azure":
            client = AzureOpenAIChatClient(
                endpoint=self._settings.azure_openai_endpoint,
                api_key=self._settings.azure_openai_api_key,
                deployment_name=self._settings.azure_openai_chat_deployment_name,
                api_version=self._settings.azure_openai_api_version,
            )
        else:
            client = OpenAIChatClient(
                model_id=self._active_model_id(),
                api_key=self._settings.openai_api_key,
            )

        return Agent(
            client=client,
            name=self._name,
            instructions=self._instructions,
        )

    async def run_json(self, prompt: str, model_cls: type[ModelT]) -> ModelT:
        if self._agent is None:
            raise MAFGenerationError(
                "MAF agent unavailable. "
                f"import_error={MAF_IMPORT_ERROR}; semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        raw_output: str | None = None
        run_errors: list[str] = []

        while True:
            model_id = self._active_model_id()
            try:
                response = await self._agent.run(prompt)
                raw_output = (response.text or "").strip()
                parsed = self._parse_output(raw_output, model_cls)
                if parsed is not None:
                    return parsed
                raise MAFGenerationError(
                    f"{self._name} returned unparsable JSON. model={model_id}. "
                    f"raw_preview={(raw_output or '')[:800]}"
                )
            except MAFGenerationError:
                raise
            except Exception as exc:
                run_errors.append(f"model={model_id}: {exc}")
                if not self._should_try_next_model(exc):
                    break
                if not self._advance_model():
                    break
                continue

        error_detail = " | ".join(run_errors[:5]) if run_errors else "unknown runtime failure"
        raise MAFGenerationError(f"{self._name} execution failed: {error_detail}")

    def _parse_output(self, raw: str, model_cls: type[ModelT]) -> ModelT | None:
        if not raw:
            return None

        candidates = [raw]

        fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", raw, flags=re.DOTALL | re.IGNORECASE)
        if fenced_match:
            candidates.append(fenced_match.group(1))

        object_match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if object_match:
            candidates.append(object_match.group(0))

        for candidate in candidates:
            try:
                return model_cls.model_validate_json(candidate)
            except Exception:
                try:
                    data = json.loads(candidate)
                    return model_cls.model_validate(data)
                except Exception:
                    continue

        return None

    def _build_model_candidates(self) -> list[str]:
        if self._settings.agent_provider != "openai":
            return [self._settings.openai_model]

        merged = [self._settings.openai_model, *DEFAULT_MODEL_FALLBACKS]
        candidates: list[str] = []
        for item in merged:
            candidate = self._sanitize_model_id(item)
            if candidate and candidate not in candidates:
                candidates.append(candidate)
        return candidates or ["gpt-4o-mini"]

    def _active_model_id(self) -> str:
        if not self._model_candidates:
            return self._sanitize_model_id(self._settings.openai_model)
        return self._model_candidates[self._active_model_index]

    def _should_try_next_model(self, exc: Exception) -> bool:
        if self._settings.agent_provider != "openai":
            return False
        text = str(exc).lower()
        return any(hint in text for hint in INVALID_MODEL_ERROR_HINTS)

    def _advance_model(self) -> bool:
        if self._settings.agent_provider != "openai":
            return False
        next_index = self._active_model_index + 1
        if next_index >= len(self._model_candidates):
            return False
        self._active_model_index = next_index
        self._agent = self._build_agent()
        return self._agent is not None

    def _sanitize_model_id(self, value: str) -> str:
        model_id = (value or "").strip()
        if not model_id:
            return ""
        lowered = model_id.lower()
        for prefix in ("openai/", "models/", "model/"):
            if lowered.startswith(prefix):
                return model_id[len(prefix) :].strip()
        return model_id


class StoryBlueprintAgent:
    def __init__(self, settings: Settings) -> None:
        self._agent = _MAFJsonAgent(
            settings=settings,
            name="dream-story-blueprint-agent",
            instructions=BLUEPRINT_SYSTEM_PROMPT,
        )

    async def generate(
        self,
        payload: StoryBookCreationRequest,
        workflow: WorkflowType,
        drawing_descriptions: list[str],
        world_reference_descriptions: list[str],
    ) -> StoryBlueprint:
        snapshot = {
            "workflow": workflow,
            "user_prompt": payload.user_prompt,
            "tone": payload.tone,
            "age_band": payload.age_band,
            "max_characters": payload.max_characters,
            "world_references": world_reference_descriptions,
            "character_drawings": drawing_descriptions,
        }
        prompt = (
            "Generate the story blueprint JSON from this request. "
            "Follow the schema and chapter mapping exactly.\n"
            f"request_json={json.dumps(snapshot, ensure_ascii=True)}"
        )
        return await self._agent.run_json(prompt=prompt, model_cls=StoryBlueprint)


class StoryWriterAgent:
    def __init__(self, settings: Settings) -> None:
        self._agent = _MAFJsonAgent(
            settings=settings,
            name="dream-story-writer-agent",
            instructions=WRITER_SYSTEM_PROMPT,
        )

    async def generate(
        self,
        payload: StoryBookCreationRequest,
        blueprint: StoryBlueprint,
    ) -> StoryDraft:
        snapshot = {
            "user_prompt": payload.user_prompt,
            "tone": payload.tone,
            "age_band": payload.age_band,
            "blueprint": blueprint.model_dump(mode="json"),
        }
        prompt = (
            "Write the story draft JSON from this blueprint and keep it concise.\n"
            f"request_json={json.dumps(snapshot, ensure_ascii=True)}"
        )
        return await self._agent.run_json(prompt=prompt, model_cls=StoryDraft)


class ScenePromptAgent:
    def __init__(self, settings: Settings) -> None:
        self._agent = _MAFJsonAgent(
            settings=settings,
            name="dream-scene-prompt-agent",
            instructions=SCENE_PROMPT_SYSTEM_PROMPT,
        )

    async def generate(
        self,
        payload: StoryBookCreationRequest,
        blueprint: StoryBlueprint,
        story: StoryDraft,
        characters: list[GeneratedCharacterPacket],
    ) -> ScenePromptBundle:
        snapshot = {
            "user_prompt": payload.user_prompt,
            "tone": payload.tone,
            "age_band": payload.age_band,
            "blueprint": blueprint.model_dump(mode="json"),
            "story": story.model_dump(mode="json"),
            "characters": [
                {
                    "name": c.name,
                    "brief": c.brief,
                    "has_generated_images": bool(c.generated_images),
                }
                for c in characters
            ],
        }
        prompt = (
            "Generate scene prompts JSON for cover + ten illustrations.\n"
            f"request_json={json.dumps(snapshot, ensure_ascii=True)}"
        )
        return await self._agent.run_json(prompt=prompt, model_cls=ScenePromptBundle)

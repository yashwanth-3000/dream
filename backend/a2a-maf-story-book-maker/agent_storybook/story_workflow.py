from __future__ import annotations

import asyncio
import inspect
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings
from .maf_agents import MAFGenerationError, ScenePromptAgent, StoryBlueprintAgent, StoryWriterAgent
from .schemas import (
    CharacterBrief,
    CharacterDrawingReference,
    GeneratedCharacterPacket,
    ScenePromptBundle,
    StoryBlueprint,
    StoryBookCreationRequest,
    StoryBookCreationResponse,
    StoryDraft,
    StoryRightPage,
    StorySpread,
    StorySpreadSide,
    WorkflowType,
    WorldReference,
)
from .services.replicate_service import ReplicateGenerationError, ReplicateImageService
from .services.vision_service import OpenAIVisionService, VisionDescriptionError


try:
    from agent_framework import Message as AFMessage
    from agent_framework.a2a import A2AAgent
except Exception as exc:  # pragma: no cover - runtime guard
    AFMessage = None  # type: ignore[assignment]
    A2AAgent = None  # type: ignore[assignment]
    A2A_IMPORT_ERROR: Exception | None = exc
else:
    A2A_IMPORT_ERROR = None


CHAPTER_SEQUENCE = [
    "Chapter 1",
    "Chapter 2",
    "Chapter 3",
    "Chapter 3 cont.",
    "Chapter 4",
]

MIN_CHAPTER_TEXT_CHARS = 260

RESOLUTION_KEYWORDS = (
    "finally",
    "in the end",
    "by the end",
    "at last",
    "resolved",
    "solution",
    "achieved",
    "reached",
    "selected",
    "earned",
    "wins",
    "success",
    "celebrate",
    "celebration",
)

POSITIVE_ENDING_KEYWORDS = (
    "hope",
    "hopeful",
    "happy",
    "joy",
    "joyful",
    "smile",
    "proud",
    "grateful",
    "confidence",
    "together",
    "friendship",
    "courage",
    "dream",
    "believe",
)

CONSISTENCY_CLAUSE = (
    "Final generated image must match the user's original character drawings and generated character reference "
    "images. Treat input reference image #1 as the canonical identity lock and preserve face shape, hairstyle, "
    "body proportions, skin tone, and signature outfit silhouette across all scenes."
)

NEGATIVE_PROMPT_DEFAULT = (
    "blurry, low detail, bad anatomy, extra limbs, deformed face, watermark, text overlays, logo, caption"
)


class StoryWorkflowError(RuntimeError):
    pass


class CharacterBackendError(RuntimeError):
    pass


@dataclass(slots=True)
class CharacterBranchResult:
    packets: list[GeneratedCharacterPacket]
    warnings: list[str]
    success_count: int
    total_count: int


ProgressReporter = Callable[[dict[str, Any]], Awaitable[None] | None]


class CharacterA2AClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._a2a_agent: Any | None = None

    async def create_character_from_brief(
        self,
        brief: CharacterBrief,
        payload: StoryBookCreationRequest,
    ) -> dict[str, Any]:
        request_payload = {
            "user_prompt": self._compose_character_prompt(brief=brief, payload=payload),
            "world_references": [r.model_dump(mode="json", exclude_none=True) for r in payload.world_references],
            "character_drawings": [d.model_dump(mode="json", exclude_none=True) for d in payload.character_drawings],
            "force_workflow": payload.force_workflow,
        }

        if not self._settings.character_backend_use_protocol:
            raise CharacterBackendError(
                "A2A-only mode: CHARACTER_BACKEND_USE_PROTOCOL must be true for storybook character generation."
            )

        return await self._invoke_via_a2a(request_payload)

    def _compose_character_prompt(self, brief: CharacterBrief, payload: StoryBookCreationRequest) -> str:
        age = f" for age band {payload.age_band}" if payload.age_band else ""
        tone = f" with tone {payload.tone}" if payload.tone else ""
        return (
            f"Character sheet for storybook: {brief.name}. {brief.brief}. "
            f"Core story idea: {payload.user_prompt}.{age}{tone}"
        ).strip()

    async def _invoke_via_a2a(self, request_payload: dict[str, Any]) -> dict[str, Any]:
        if A2A_IMPORT_ERROR is not None or AFMessage is None or A2AAgent is None:
            raise CharacterBackendError(
                "A2A import failed for character backend client: "
                f"{A2A_IMPORT_ERROR}; semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        if self._a2a_agent is None:
            self._a2a_agent = A2AAgent(
                url=self._settings.character_backend_rpc_url,
                timeout=self._settings.character_backend_timeout_seconds,
                name="dream-story-character-client",
            )

        message = AFMessage(
            role="user",
            text=request_payload["user_prompt"],
            additional_properties={
                "operation": "create",
                "payload": request_payload,
            },
        )

        try:
            response = await self._a2a_agent.run(message)
        except Exception as exc:
            raise CharacterBackendError(
                "Character backend A2A call failed "
                f"for {self._settings.character_backend_rpc_url}: {exc}"
            ) from exc

        parsed = self._extract_json_payload_from_agent_response(response)
        if parsed is None:
            raise CharacterBackendError(
                "Character backend A2A response could not be parsed as JSON payload. "
                f"raw_preview={(getattr(response, 'text', '') or '')[:800]}"
            )

        return parsed

    async def _invoke_via_http(self, request_payload: dict[str, Any]) -> dict[str, Any]:
        timeout = httpx.Timeout(self._settings.character_backend_timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self._settings.character_backend_create_url,
                    json=request_payload,
                )
        except httpx.HTTPError as exc:
            raise CharacterBackendError(f"Character backend HTTP call failed: {exc}") from exc

        if response.status_code >= 400:
            raise CharacterBackendError(
                f"Character backend returned {response.status_code}: {response.text[:1200]}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise CharacterBackendError("Character backend returned non-JSON payload.") from exc

        if not isinstance(body, dict):
            raise CharacterBackendError("Character backend response is not a JSON object.")

        return body

    def _extract_json_payload_from_agent_response(self, response: Any) -> dict[str, Any] | None:
        candidate_texts: list[str] = []

        response_text = getattr(response, "text", None)
        if isinstance(response_text, str) and response_text.strip():
            candidate_texts.append(response_text.strip())

        messages = getattr(response, "messages", None)
        if isinstance(messages, list):
            for message in messages:
                contents = getattr(message, "contents", None)
                if not isinstance(contents, list):
                    continue
                for content in contents:
                    if getattr(content, "type", None) == "text":
                        text_val = getattr(content, "text", None)
                        if isinstance(text_val, str) and text_val.strip():
                            candidate_texts.append(text_val.strip())

        for text in candidate_texts:
            parsed = self._parse_json_like_text(text)
            if isinstance(parsed, dict):
                return parsed

        return None

    def _parse_json_like_text(self, text: str) -> dict[str, Any] | None:
        if not text:
            return None

        try:
            data = json.loads(text.strip())
            if isinstance(data, dict):
                return data
        except Exception:
            pass

        fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
        if fenced_match:
            try:
                data = json.loads(fenced_match.group(1))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        object_match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if object_match:
            try:
                data = json.loads(object_match.group(0))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        return None


class StoryBookWorkflow:
    def __init__(
        self,
        settings: Settings,
        blueprint_agent: StoryBlueprintAgent | None = None,
        story_writer_agent: StoryWriterAgent | None = None,
        scene_prompt_agent: ScenePromptAgent | None = None,
        vision_service: OpenAIVisionService | None = None,
        replicate_service: ReplicateImageService | None = None,
        character_client: CharacterA2AClient | None = None,
        progress_reporter: ProgressReporter | None = None,
    ) -> None:
        self._settings = settings
        self._blueprint_agent = blueprint_agent or StoryBlueprintAgent(settings)
        self._story_writer_agent = story_writer_agent or StoryWriterAgent(settings)
        self._scene_prompt_agent = scene_prompt_agent or ScenePromptAgent(settings)
        self._vision = vision_service or OpenAIVisionService(
            api_key=settings.openai_api_key or "",
            model=settings.openai_vision_model,
            max_tokens=settings.openai_vision_max_tokens,
        )
        self._replicate = replicate_service or ReplicateImageService(
            api_token=settings.replicate_api_token,
            model=settings.replicate_model,
            default_output_count=settings.replicate_output_count,
            default_aspect_ratio=settings.replicate_aspect_ratio,
            default_quality=settings.replicate_quality,
            default_background=settings.replicate_background,
            default_moderation=settings.replicate_moderation,
            default_output_format=settings.replicate_output_format,
            default_input_fidelity=settings.replicate_input_fidelity,
            default_output_compression=settings.replicate_output_compression,
        )
        self._character_client = character_client or CharacterA2AClient(settings)
        self._progress_reporter = progress_reporter

    async def _emit_progress(
        self,
        stage: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        if self._progress_reporter is None:
            return

        payload: dict[str, Any] = {
            "stage": stage,
            "message": message,
        }
        if data:
            payload["data"] = data

        try:
            maybe_awaitable = self._progress_reporter(payload)
            if inspect.isawaitable(maybe_awaitable):
                await maybe_awaitable
        except Exception:
            # Telemetry must never break primary workflow execution.
            return

    @staticmethod
    def choose_workflow(payload: StoryBookCreationRequest) -> WorkflowType:
        if payload.force_workflow:
            return payload.force_workflow
        if payload.world_references or payload.character_drawings:
            return "reference_enriched"
        return "prompt_only"

    async def run(self, payload: StoryBookCreationRequest) -> StoryBookCreationResponse:
        warnings: list[str] = []
        generation_sources = {
            "blueprint": "maf",
            "story": "maf",
            "scene_prompts": "maf",
            "character_branch": "parallel_success",
        }

        await self._emit_progress(
            stage="workflow_start",
            message="Storybook workflow started.",
            data={
                "agents": [
                    "StoryBlueprintAgent",
                    "StoryWriterAgent",
                    "ScenePromptAgent",
                ],
                "character_backend_rpc": self._settings.character_backend_rpc_url,
                "storybook_replicate_model": self._replicate.model,
                "requested_max_characters": payload.max_characters,
                "world_reference_count": len(payload.world_references),
                "character_drawing_count": len(payload.character_drawings),
            },
        )

        prepared_payload, drawing_descriptions, world_reference_descriptions = (
            self._prepare_payload_with_vision_descriptions(payload)
        )
        workflow = self.choose_workflow(prepared_payload)

        await self._emit_progress(
            stage="vision_enrichment_complete",
            message="Reference analysis completed.",
            data={
                "workflow_selected": workflow,
                "drawing_descriptions": len(drawing_descriptions),
                "world_reference_descriptions": len(world_reference_descriptions),
            },
        )

        try:
            await self._emit_progress(
                stage="blueprint_generation_start",
                message="Generating story blueprint with StoryBlueprintAgent.",
            )
            blueprint = await self._blueprint_agent.generate(
                payload=prepared_payload,
                workflow=workflow,
                drawing_descriptions=drawing_descriptions,
                world_reference_descriptions=world_reference_descriptions,
            )
        except MAFGenerationError as exc:
            warnings.append(f"Blueprint agent fallback used: {exc}")
            blueprint = self._fallback_blueprint(prepared_payload)
            generation_sources["blueprint"] = "fallback"
            await self._emit_progress(
                stage="blueprint_generation_fallback",
                message="Blueprint agent failed; fallback blueprint was used.",
                data={"detail": str(exc)},
            )

        blueprint = self._normalize_blueprint(blueprint=blueprint, payload=prepared_payload)
        await self._emit_progress(
            stage="blueprint_generation_complete",
            message="Blueprint ready.",
            data={
                "title": blueprint.title,
                "character_brief_count": len(blueprint.character_briefs),
                "page_plan_count": len(blueprint.page_plans),
                "source": generation_sources["blueprint"],
            },
        )

        character_task = asyncio.create_task(
            self._generate_characters(blueprint=blueprint, payload=prepared_payload)
        )
        story_task = asyncio.create_task(
            self._story_writer_agent.generate(payload=prepared_payload, blueprint=blueprint)
        )
        await self._emit_progress(
            stage="parallel_branches_started",
            message=(
                "Character branch (A2A) and story branch (StoryWriterAgent) started in parallel."
            ),
        )

        character_result_raw, story_result_raw = await asyncio.gather(
            character_task,
            story_task,
            return_exceptions=True,
        )

        if isinstance(character_result_raw, Exception):
            warnings.append(f"Character branch fallback used: {character_result_raw}")
            character_result = CharacterBranchResult(
                packets=[self._fallback_character_packet(brief) for brief in blueprint.character_briefs],
                warnings=["Character generation branch failed; using blueprint-only character packets."],
                success_count=0,
                total_count=len(blueprint.character_briefs),
            )
            generation_sources["character_branch"] = "full_fallback"
            await self._emit_progress(
                stage="character_branch_fallback",
                message="Character branch failed; fallback packets were created.",
                data={"detail": str(character_result_raw)},
            )
        else:
            character_result = character_result_raw
            if character_result.total_count == 0:
                generation_sources["character_branch"] = "skipped_no_characters"
            elif character_result.success_count == character_result.total_count:
                generation_sources["character_branch"] = "parallel_success"
            elif character_result.success_count == 0:
                generation_sources["character_branch"] = "full_fallback"
            else:
                generation_sources["character_branch"] = "partial_fallback"

        await self._emit_progress(
            stage="character_branch_complete",
            message="Character branch completed.",
            data={
                "success_count": character_result.success_count,
                "total_count": character_result.total_count,
                "source": generation_sources["character_branch"],
                "characters": [
                    {
                        "name": packet.name,
                        "brief": packet.brief,
                        "generated_image_count": len(packet.generated_images),
                        "generated_images": packet.generated_images,
                        "warning_count": len(packet.warnings),
                    }
                    for packet in character_result.packets
                ],
            },
        )

        warnings.extend(character_result.warnings)

        if self._count_identity_reference_images(prepared_payload, character_result.packets) == 0:
            await self._emit_progress(
                stage="identity_reference_missing",
                message=(
                    "No identity references found after character branch; cannot start scene image generation."
                ),
            )
            raise StoryWorkflowError(
                "Character generation must complete first with at least one identity reference image "
                "(generated character image or uploaded character drawing) before scene image generation."
            )

        if isinstance(story_result_raw, Exception):
            warnings.append(f"Story writer fallback used: {story_result_raw}")
            story = self._fallback_story_draft(blueprint=blueprint)
            generation_sources["story"] = "fallback"
            await self._emit_progress(
                stage="story_generation_fallback",
                message="StoryWriterAgent failed; fallback story draft was used.",
                data={"detail": str(story_result_raw)},
            )
        else:
            story = story_result_raw

        story = self._normalize_story_draft(story=story, blueprint=blueprint)
        await self._emit_progress(
            stage="story_generation_complete",
            message="Story draft ready.",
            data={
                "title": story.title,
                "page_count": len(story.right_pages),
                "source": generation_sources["story"],
            },
        )

        try:
            await self._emit_progress(
                stage="scene_prompt_generation_start",
                message="Generating scene prompts with ScenePromptAgent.",
            )
            scene_prompts = await self._scene_prompt_agent.generate(
                payload=prepared_payload,
                blueprint=blueprint,
                story=story,
                characters=character_result.packets,
            )
        except MAFGenerationError as exc:
            warnings.append(f"Scene prompt fallback used: {exc}")
            scene_prompts = self._fallback_scene_prompts(story=story, blueprint=blueprint)
            generation_sources["scene_prompts"] = "fallback"
            await self._emit_progress(
                stage="scene_prompt_generation_fallback",
                message="ScenePromptAgent failed; fallback prompts were used.",
                data={"detail": str(exc)},
            )

        scene_prompts = self._normalize_scene_prompts(
            scene_prompts=scene_prompts,
            story=story,
            blueprint=blueprint,
            characters=character_result.packets,
        )
        await self._emit_progress(
            stage="scene_prompt_generation_complete",
            message="Scene prompts ready.",
            data={
                "prompt_count": len(scene_prompts.illustration_prompts) + 1,
                "source": generation_sources["scene_prompts"],
            },
        )

        reference_images = self._collect_reference_images(
            payload=prepared_payload,
            characters=character_result.packets,
        )
        reference_breakdown = self._build_reference_breakdown(
            payload=prepared_payload,
            characters=character_result.packets,
        )
        scene_reference_counts = [len(reference_images)] * 6

        await self._emit_progress(
            stage="scene_image_generation_start",
            message="Starting scene image generation via Replicate.",
            data={
                "scene_count": 6,
                "reference_images_used": len(reference_images),
                "replicate_model": self._replicate.model,
            },
        )

        generated_images = await self._generate_scene_images(
            scene_prompts=scene_prompts,
            reference_images=reference_images,
        )

        await self._emit_progress(
            stage="scene_image_generation_complete",
            message="All scene images generated.",
            data={"generated_image_count": len(generated_images)},
        )

        spreads = self._build_exact_spreads(story=story, generated_images=generated_images)
        await self._emit_progress(
            stage="spread_contract_complete",
            message="7-spread contract assembled.",
            data={"spread_count": len(spreads)},
        )

        await self._emit_progress(
            stage="workflow_complete",
            message="Storybook workflow completed successfully.",
            data={
                "workflow_used": workflow,
                "warning_count": len(warnings),
            },
        )

        return StoryBookCreationResponse(
            workflow_used=workflow,
            story=story,
            characters=character_result.packets,
            scene_prompts=scene_prompts,
            generated_images=generated_images,
            spreads=spreads,
            replicate_model=self._replicate.model,
            reference_images_used_count=len(reference_images),
            warnings=warnings,
            drawing_descriptions=drawing_descriptions,
            world_reference_descriptions=world_reference_descriptions,
            generation_sources=generation_sources,
            reference_image_breakdown=reference_breakdown,
            scene_reference_counts=scene_reference_counts,
        )

    async def _generate_characters(
        self,
        blueprint: StoryBlueprint,
        payload: StoryBookCreationRequest,
    ) -> CharacterBranchResult:
        if not blueprint.character_briefs:
            await self._emit_progress(
                stage="character_generation_skipped",
                message="No character briefs were provided; character generation skipped.",
            )
            return CharacterBranchResult(
                packets=[],
                warnings=[],
                success_count=0,
                total_count=0,
            )

        packets: list[GeneratedCharacterPacket] = []
        warnings: list[str] = []
        briefs = blueprint.character_briefs[: payload.max_characters]

        await self._emit_progress(
            stage="character_generation_start",
            message="Sending character briefs to character backend via A2A.",
            data={
                "character_count": len(briefs),
                "character_backend_rpc": self._settings.character_backend_rpc_url,
            },
        )

        tasks = [
            asyncio.create_task(self._character_client.create_character_from_brief(brief=brief, payload=payload))
            for brief in briefs
        ]

        success_count = 0
        for brief, task in zip(briefs, tasks, strict=True):
            try:
                result = await task
            except Exception as exc:
                warnings.append(f"Character generation failed for '{brief.name or 'unnamed'}': {exc}")
                packets.append(
                    GeneratedCharacterPacket(
                        name=brief.name or "Character",
                        brief=brief.brief,
                        warnings=["Character generation failed; using fallback packet."],
                    )
                )
                await self._emit_progress(
                    stage="character_generation_failed",
                    message=f"Character generation failed for {brief.name or 'unnamed'}.",
                    data={"detail": str(exc)},
                )
                continue

            success_count += 1
            packet = self._character_packet_from_backend(brief=brief, payload=result)
            packets.append(packet)
            await self._emit_progress(
                stage="character_generation_complete",
                message=f"Character ready: {packet.name}.",
                data={
                    "name": packet.name,
                    "brief": packet.brief,
                    "generated_image_count": len(packet.generated_images),
                    "generated_images": packet.generated_images,
                },
            )

        if success_count == 0:
            warnings.append(
                "All character generations failed. Continuing storybook generation with fallback character packets only."
            )

        return CharacterBranchResult(
            packets=packets,
            warnings=warnings,
            success_count=success_count,
            total_count=len(briefs),
        )

    def _character_packet_from_backend(
        self,
        brief: CharacterBrief,
        payload: dict[str, Any],
    ) -> GeneratedCharacterPacket:
        backstory = payload.get("backstory") if isinstance(payload.get("backstory"), dict) else None
        image_prompt = payload.get("image_prompt") if isinstance(payload.get("image_prompt"), dict) else None
        generated_images = payload.get("generated_images") if isinstance(payload.get("generated_images"), list) else []

        backstory_name = ""
        if backstory is not None:
            name_value = backstory.get("name")
            if isinstance(name_value, str):
                backstory_name = name_value.strip()

        name = backstory_name or brief.name or "Character"

        return GeneratedCharacterPacket(
            name=name,
            brief=brief.brief,
            backstory=backstory,
            image_prompt=image_prompt,
            generated_images=[str(url) for url in generated_images if isinstance(url, str) and url.strip()],
            warnings=[],
        )

    def _fallback_character_packet(self, brief: CharacterBrief) -> GeneratedCharacterPacket:
        return GeneratedCharacterPacket(
            name=brief.name or "Character",
            brief=brief.brief,
            warnings=["Generated from fallback path without character backend output."],
        )

    async def _generate_scene_images(
        self,
        scene_prompts: ScenePromptBundle,
        reference_images: list[str],
    ) -> list[str]:
        prompt_list = [scene_prompts.cover_prompt, *scene_prompts.illustration_prompts[:5]]
        if len(prompt_list) != 6:
            raise StoryWorkflowError(
                f"Scene prompt contract violation: expected 6 prompts (cover + 5), got {len(prompt_list)}."
            )

        tasks = [
            asyncio.create_task(
                self._generate_single_scene_image(
                    scene_index=index,
                    prompt=prompt,
                    negative_prompt=scene_prompts.negative_prompt,
                    reference_images=reference_images,
                )
            )
            for index, prompt in enumerate(prompt_list)
        ]

        urls: list[str] = []
        for index, task in enumerate(tasks):
            try:
                result = await task
            except Exception as exc:
                pending_tasks = tasks[index + 1 :]
                for pending in pending_tasks:
                    if not pending.done():
                        pending.cancel()
                if pending_tasks:
                    await asyncio.gather(*pending_tasks, return_exceptions=True)

                await self._emit_progress(
                    stage="scene_image_failed",
                    message=f"Scene image generation failed at index {index}.",
                    data={"scene_index": index, "detail": str(exc)},
                )
                raise StoryWorkflowError(
                    f"Replicate scene generation failed at scene index {index}: {exc}"
                ) from exc
            urls.append(result)
            await self._emit_progress(
                stage="scene_image_generated",
                message=(
                    f"{'Cover' if index == 0 else f'Page image {index}'} generated "
                    f"({index + 1}/6)."
                ),
                data={
                    "scene_index": index,
                    "scene_type": "cover" if index == 0 else "page",
                    "image_url": result,
                },
            )

        return urls

    async def _generate_single_scene_image(
        self,
        scene_index: int,
        prompt: str,
        negative_prompt: str,
        reference_images: list[str],
    ) -> str:
        max_attempts = max(1, self._settings.scene_image_retry_count + 1)
        timeout_seconds = self._settings.scene_image_timeout_seconds
        last_error: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            await self._emit_progress(
                stage="scene_image_attempt_start",
                message=(
                    f"Scene image attempt {attempt}/{max_attempts} started for index {scene_index}."
                ),
                data={
                    "scene_index": scene_index,
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "timeout_seconds": timeout_seconds,
                },
            )

            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(
                        self._replicate.generate_story_image,
                        prompt,
                        negative_prompt or None,
                        None,
                        None,
                        reference_images,
                    ),
                    timeout=timeout_seconds,
                )
                return result
            except asyncio.TimeoutError as exc:
                last_error = StoryWorkflowError(
                    f"scene_index={scene_index}, detail=Image generation timed out after {timeout_seconds:.0f} seconds."
                )
                await self._emit_progress(
                    stage="scene_image_attempt_timeout",
                    message=(
                        f"Scene image attempt {attempt}/{max_attempts} timed out at index {scene_index}."
                    ),
                    data={
                        "scene_index": scene_index,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                        "timeout_seconds": timeout_seconds,
                        "will_retry": attempt < max_attempts,
                    },
                )
            except ReplicateGenerationError as exc:
                last_error = StoryWorkflowError(f"scene_index={scene_index}, detail={exc}")
                await self._emit_progress(
                    stage="scene_image_attempt_error",
                    message=(
                        f"Scene image attempt {attempt}/{max_attempts} failed at index {scene_index}."
                    ),
                    data={
                        "scene_index": scene_index,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                        "detail": str(exc),
                        "will_retry": attempt < max_attempts,
                    },
                )
            except Exception as exc:
                last_error = StoryWorkflowError(f"scene_index={scene_index}, detail={exc}")
                await self._emit_progress(
                    stage="scene_image_attempt_error",
                    message=(
                        f"Scene image attempt {attempt}/{max_attempts} failed at index {scene_index}."
                    ),
                    data={
                        "scene_index": scene_index,
                        "attempt": attempt,
                        "max_attempts": max_attempts,
                        "detail": str(exc),
                        "will_retry": attempt < max_attempts,
                    },
                )

            if attempt < max_attempts:
                await self._emit_progress(
                    stage="scene_image_retry_scheduled",
                    message=(
                        f"Retrying scene image generation for index {scene_index} using the same prompt."
                    ),
                    data={
                        "scene_index": scene_index,
                        "next_attempt": attempt + 1,
                        "max_attempts": max_attempts,
                    },
                )

        if last_error is not None:
            raise last_error

        raise StoryWorkflowError(
            f"scene_index={scene_index}, detail=Image generation failed for unknown reason."
        )

    def _prepare_payload_with_vision_descriptions(
        self,
        payload: StoryBookCreationRequest,
    ) -> tuple[StoryBookCreationRequest, list[str], list[str]]:
        drawing_payload, drawing_descriptions = self._prepare_drawings_with_vision(payload)
        final_payload, world_reference_descriptions = self._prepare_world_references_with_vision(
            drawing_payload
        )
        return final_payload, drawing_descriptions, world_reference_descriptions

    def _prepare_drawings_with_vision(
        self,
        payload: StoryBookCreationRequest,
    ) -> tuple[StoryBookCreationRequest, list[str]]:
        if not payload.character_drawings:
            return payload, []

        enhanced_drawings: list[CharacterDrawingReference] = []
        collected_descriptions: list[str] = []

        for drawing in payload.character_drawings:
            base_text = self._combine_text(drawing.description, drawing.notes)
            vision_text = ""
            image_input = self._extract_image_input_from_drawing(drawing)

            if image_input:
                try:
                    vision_text = self._vision.describe_character_drawing(
                        image_input=image_input,
                        user_hint=base_text,
                    )
                except VisionDescriptionError:
                    vision_text = ""

            merged_text = self._combine_text(base_text, vision_text)
            final_description = merged_text if merged_text else drawing.description

            enhanced_drawings.append(
                CharacterDrawingReference(
                    url=drawing.url,
                    description=final_description,
                    notes=drawing.notes,
                    image_data=drawing.image_data,
                )
            )
            if final_description:
                collected_descriptions.append(final_description)

        return payload.model_copy(update={"character_drawings": enhanced_drawings}), collected_descriptions

    def _prepare_world_references_with_vision(
        self,
        payload: StoryBookCreationRequest,
    ) -> tuple[StoryBookCreationRequest, list[str]]:
        if not payload.world_references:
            return payload, []

        enhanced_references: list[WorldReference] = []
        collected_descriptions: list[str] = []

        for ref in payload.world_references:
            base_text = self._combine_text(ref.title, ref.description)
            vision_text = ""
            image_input = self._extract_image_input_from_world_reference(ref)

            if image_input:
                try:
                    vision_text = self._vision.describe_world_reference(
                        image_input=image_input,
                        user_hint=base_text,
                    )
                except VisionDescriptionError:
                    vision_text = ""

            merged_text = self._combine_text(ref.description, vision_text)
            final_description = merged_text if merged_text else ref.description

            enhanced_references.append(
                WorldReference(
                    title=ref.title,
                    description=final_description,
                    url=ref.url,
                    image_data=ref.image_data,
                )
            )
            if final_description:
                collected_descriptions.append(final_description)

        return payload.model_copy(update={"world_references": enhanced_references}), collected_descriptions

    def _extract_image_input_from_drawing(self, drawing: CharacterDrawingReference) -> str | None:
        if drawing.image_data and drawing.image_data.strip():
            return drawing.image_data.strip()
        if drawing.url is not None:
            return str(drawing.url)
        return None

    def _extract_image_input_from_world_reference(self, ref: WorldReference) -> str | None:
        if ref.image_data and ref.image_data.strip():
            return ref.image_data.strip()
        if ref.url is not None:
            return str(ref.url)
        return None

    def _combine_text(self, *parts: str | None) -> str:
        cleaned = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
        return "\n".join(cleaned).strip()

    def _normalize_blueprint(
        self,
        blueprint: StoryBlueprint,
        payload: StoryBookCreationRequest,
    ) -> StoryBlueprint:
        title = blueprint.title.strip() if blueprint.title else ""
        if not title:
            title = self._title_from_prompt(payload.user_prompt)

        logline = blueprint.logline.strip() if blueprint.logline else payload.user_prompt.strip()

        title_page_text = (
            blueprint.title_page_text.strip()
            if blueprint.title_page_text
            else "A short illustrated adventure begins."
        )

        end_page_text = (
            blueprint.end_page_text.strip()
            if blueprint.end_page_text
            else "The end, for now."
        )

        cover_concept = (
            blueprint.cover_concept.strip()
            if blueprint.cover_concept
            else f"Cover scene for '{title}' with the lead character in the story world."
        )

        raw_briefs = [b for b in blueprint.character_briefs if b.brief.strip() or b.name.strip()]
        character_briefs = raw_briefs[: payload.max_characters]
        if not character_briefs:
            character_briefs = [
                CharacterBrief(
                    name="Lead Character",
                    brief=f"Main hero based on prompt: {payload.user_prompt.strip()}",
                )
            ]

        plans_by_number = {p.page_number: p for p in blueprint.page_plans if 1 <= p.page_number <= 5}
        page_plans = []
        for index in range(1, 6):
            existing = plans_by_number.get(index)
            default_chapter = CHAPTER_SEQUENCE[index - 1]
            if existing is not None:
                chapter = existing.chapter.strip() or default_chapter
                beat = existing.beat.strip() or f"Story beat for {default_chapter}."
            else:
                chapter = default_chapter
                beat = f"Story beat for {default_chapter}."

            if index == 4 and "cont" not in chapter.lower():
                chapter = "Chapter 3 cont."

            page_plans.append(
                {
                    "page_number": index,
                    "chapter": chapter,
                    "beat": beat,
                }
            )

        return StoryBlueprint.model_validate(
            {
                "title": title,
                "logline": logline,
                "title_page_text": title_page_text,
                "end_page_text": end_page_text,
                "cover_concept": cover_concept,
                "character_briefs": [b.model_dump(mode="json") for b in character_briefs],
                "page_plans": page_plans,
            }
        )

    def _normalize_story_draft(self, story: StoryDraft, blueprint: StoryBlueprint) -> StoryDraft:
        pages_by_number = {p.page_number: p for p in story.right_pages if 1 <= p.page_number <= 5}

        normalized_pages: list[StoryRightPage] = []
        for index in range(1, 6):
            page = pages_by_number.get(index)
            plan = next((p for p in blueprint.page_plans if p.page_number == index), None)
            default_chapter = CHAPTER_SEQUENCE[index - 1]
            chapter = page.chapter.strip() if page and page.chapter else (plan.chapter if plan else default_chapter)
            if not chapter:
                chapter = default_chapter
            if index == 4:
                chapter = "Chapter 3 cont."

            text = page.text.strip() if page and page.text else ""
            if not text and plan is not None:
                text = plan.beat.strip()
            if not text:
                text = f"{chapter} unfolds in a gentle, adventurous beat."
            text = self._ensure_rich_page_text(
                text=text,
                page_number=index,
                chapter=chapter,
                plan_beat=plan.beat if plan is not None else "",
            )

            normalized_pages.append(
                StoryRightPage(
                    page_number=index,
                    chapter=chapter,
                    text=text,
                )
            )

        normalized_pages = self._enforce_complete_happy_arc(pages=normalized_pages)
        normalized_end_text = self._ensure_uplifting_end_page_text(
            story.end_page_text.strip() or blueprint.end_page_text
        )

        return StoryDraft(
            title=story.title.strip() or blueprint.title,
            title_page_text=story.title_page_text.strip() or blueprint.title_page_text,
            right_pages=normalized_pages,
            end_page_text=normalized_end_text,
        )

    def _normalize_scene_prompts(
        self,
        scene_prompts: ScenePromptBundle,
        story: StoryDraft,
        blueprint: StoryBlueprint,
        characters: list[GeneratedCharacterPacket],
    ) -> ScenePromptBundle:
        cover_prompt = scene_prompts.cover_prompt.strip() if scene_prompts.cover_prompt else ""
        if not cover_prompt:
            cover_prompt = (
                f"Storybook cover for '{story.title}'. {blueprint.cover_concept}. "
                "Single cinematic hero composition, polished illustration style, non-photorealistic."
            )

        illustration_prompts = [p.strip() for p in scene_prompts.illustration_prompts if p.strip()]
        if len(illustration_prompts) < 5:
            for page in story.right_pages[len(illustration_prompts) : 5]:
                illustration_prompts.append(
                    f"Illustration for {page.chapter}: {page.text}. Child-friendly cinematic storybook style."
                )
        illustration_prompts = illustration_prompts[:5]

        character_anchor = self._build_character_anchor_text(characters)
        page_map = {page.page_number: page for page in story.right_pages}
        aligned_prompts: list[str] = []
        for page_number, prompt in enumerate(illustration_prompts, start=1):
            page = page_map.get(page_number)
            if page is None:
                base_prompt = prompt.strip()
                if character_anchor:
                    base_prompt = f"{base_prompt} Character anchor: {character_anchor}."
                base_prompt = (
                    f"{base_prompt} Illustration-only output; do not render any written words, letters, "
                    "or captions."
                ).strip()
                base_prompt = (
                    f"{base_prompt} If needed for storytelling clarity, compose the scene as 2-4 clean comic-style "
                    "panels inside one single 2:3 illustration (no panel text)."
                ).strip()
                aligned_prompts.append(base_prompt)
                continue
            page_context = self._compact_text(page.text, max_chars=260)
            base_prompt = (
                f"{prompt.strip()} "
                f"Narrative context for page {page_number}: {page.chapter}. {page_context}. "
                "Style requirement: children's illustrated storybook, non-photorealistic. "
                "Illustration-only output; do not render any written words, letters, numbers, logos, or captions."
            ).strip()
            if character_anchor:
                base_prompt = f"{base_prompt} Character anchor: {character_anchor}."
            base_prompt = (
                f"{base_prompt} If needed for storytelling clarity, compose the page as 2-4 clean comic-style "
                "panels inside one single 2:3 illustration (no speech bubbles or text)."
            ).strip()
            aligned_prompts.append(base_prompt)
        illustration_prompts = aligned_prompts

        if character_anchor:
            cover_prompt = f"{cover_prompt.strip()} Character anchor: {character_anchor}."
        cover_prompt = (
            f"{cover_prompt.strip()} Illustration-only cover art; do not render title text, letters, "
            "or watermarks in the image."
        ).strip()

        cover_prompt = self._ensure_consistency_clause(cover_prompt)
        illustration_prompts = [self._ensure_consistency_clause(prompt) for prompt in illustration_prompts]

        negative_prompt = scene_prompts.negative_prompt.strip() if scene_prompts.negative_prompt else ""
        if not negative_prompt:
            negative_prompt = NEGATIVE_PROMPT_DEFAULT

        return ScenePromptBundle(
            cover_prompt=cover_prompt,
            illustration_prompts=illustration_prompts,
            negative_prompt=negative_prompt,
        )

    def _build_character_anchor_text(self, characters: list[GeneratedCharacterPacket]) -> str:
        anchors: list[str] = []
        for character in characters[:2]:
            name = (character.name or "").strip() or "Character"
            brief = (character.brief or "").strip()
            visual_signifiers = self._extract_visual_signifiers(character)
            anchor_bits = [name]
            if brief:
                anchor_bits.append(brief)
            if visual_signifiers:
                anchor_bits.append(f"visuals: {visual_signifiers}")
            if character.generated_images:
                anchor_bits.append("canonical character reference image supplied")
            anchors.append(" | ".join(anchor_bits))
        return " | ".join(anchors).strip()

    def _ensure_consistency_clause(self, prompt: str) -> str:
        lowered = prompt.lower()
        if CONSISTENCY_CLAUSE.lower() in lowered:
            return prompt
        return f"{prompt.strip()} {CONSISTENCY_CLAUSE}".strip()

    def _extract_visual_signifiers(self, character: GeneratedCharacterPacket) -> str:
        if not isinstance(character.backstory, dict):
            return ""

        raw_signifiers = character.backstory.get("visual_signifiers")
        if not isinstance(raw_signifiers, list):
            return ""

        cleaned = [
            str(item).strip()
            for item in raw_signifiers[:4]
            if isinstance(item, str) and item.strip()
        ]
        return ", ".join(cleaned).strip()

    def _compact_text(self, value: str, max_chars: int) -> str:
        compact = re.sub(r"\s+", " ", (value or "")).strip()
        if len(compact) <= max_chars:
            return compact
        return f"{compact[: max_chars - 3].rstrip()}..."

    def _collect_reference_images(
        self,
        payload: StoryBookCreationRequest,
        characters: list[GeneratedCharacterPacket],
    ) -> list[str]:
        reference_images: list[str] = []

        # 1) generated character images
        for character in characters:
            for image_url in character.generated_images:
                if image_url and image_url.strip():
                    reference_images.append(image_url.strip())

        # 2) uploaded character drawings
        for drawing in payload.character_drawings:
            image_input = self._extract_image_input_from_drawing(drawing)
            if image_input:
                reference_images.append(image_input)

        # 3) uploaded world references
        for ref in payload.world_references:
            image_input = self._extract_image_input_from_world_reference(ref)
            if image_input:
                reference_images.append(image_input)

        if not reference_images:
            return []

        return list(dict.fromkeys(reference_images))

    def _build_reference_breakdown(
        self,
        payload: StoryBookCreationRequest,
        characters: list[GeneratedCharacterPacket],
    ) -> dict[str, int]:
        generated_character_images = sum(
            1
            for character in characters
            for image_url in character.generated_images
            if isinstance(image_url, str) and image_url.strip()
        )
        uploaded_character_drawings = sum(
            1
            for drawing in payload.character_drawings
            if self._extract_image_input_from_drawing(drawing) is not None
        )
        uploaded_world_references = sum(
            1
            for ref in payload.world_references
            if self._extract_image_input_from_world_reference(ref) is not None
        )
        total_before_dedup = (
            generated_character_images + uploaded_character_drawings + uploaded_world_references
        )
        deduped_total = len(self._collect_reference_images(payload=payload, characters=characters))
        return {
            "generated_character_images": generated_character_images,
            "uploaded_character_drawings": uploaded_character_drawings,
            "uploaded_world_references": uploaded_world_references,
            "total_before_dedup": total_before_dedup,
            "total_after_dedup": deduped_total,
        }

    def _count_identity_reference_images(
        self,
        payload: StoryBookCreationRequest,
        characters: list[GeneratedCharacterPacket],
    ) -> int:
        generated_character_images = sum(
            1
            for character in characters
            for image_url in character.generated_images
            if isinstance(image_url, str) and image_url.strip()
        )
        uploaded_character_drawings = sum(
            1
            for drawing in payload.character_drawings
            if self._extract_image_input_from_drawing(drawing) is not None
        )
        return generated_character_images + uploaded_character_drawings

    def _build_exact_spreads(self, story: StoryDraft, generated_images: list[str]) -> list[StorySpread]:
        if len(generated_images) != 6:
            raise StoryWorkflowError(
                f"Spread build contract violation: expected 6 generated images (cover + 5), got {len(generated_images)}."
            )

        right_pages_map = {page.page_number: page for page in story.right_pages}

        spreads: list[StorySpread] = [
            StorySpread(
                spread_index=0,
                label=None,
                left=StorySpreadSide(
                    kind="cover_image",
                    image_url=generated_images[0],
                ),
                right=StorySpreadSide(
                    kind="title_page",
                    title=story.title,
                    text=story.title_page_text,
                ),
            )
        ]

        for index in range(1, 6):
            page = right_pages_map.get(index)
            chapter = page.chapter if page else CHAPTER_SEQUENCE[index - 1]
            text = page.text if page else f"Story content for page {index}."
            if index == 4:
                chapter = "Chapter 3 cont."

            spreads.append(
                StorySpread(
                    spread_index=index,
                    label=f"Page {index} of 5",
                    left=StorySpreadSide(
                        kind="illustration",
                        image_url=generated_images[index],
                        page_number=index,
                    ),
                    right=StorySpreadSide(
                        kind="chapter_text",
                        page_number=index,
                        chapter=chapter,
                        text=text,
                    ),
                )
            )

        spreads.append(
            StorySpread(
                spread_index=6,
                label=None,
                left=StorySpreadSide(
                    kind="end_page",
                    text=story.end_page_text,
                ),
                right=StorySpreadSide(kind="empty"),
            )
        )

        return spreads

    def _fallback_blueprint(self, payload: StoryBookCreationRequest) -> StoryBlueprint:
        title = self._title_from_prompt(payload.user_prompt)
        return StoryBlueprint(
            title=title,
            logline=payload.user_prompt.strip(),
            title_page_text="A bright adventure is about to begin.",
            end_page_text="Every ending is the start of another story.",
            cover_concept=f"Lead character at the start of '{title}' in a cinematic storybook setting.",
            character_briefs=[
                CharacterBrief(
                    name="Lead Character",
                    brief=f"Hero inspired by: {payload.user_prompt.strip()}",
                )
            ],
            page_plans=[
                {"page_number": 1, "chapter": "Chapter 1", "beat": "The hero begins the journey."},
                {"page_number": 2, "chapter": "Chapter 2", "beat": "A challenge appears."},
                {"page_number": 3, "chapter": "Chapter 3", "beat": "The conflict peaks."},
                {"page_number": 4, "chapter": "Chapter 3 cont.", "beat": "A clever turn shifts momentum."},
                {"page_number": 5, "chapter": "Chapter 4", "beat": "A hopeful resolution closes the tale."},
            ],
        )

    def _fallback_story_draft(self, blueprint: StoryBlueprint) -> StoryDraft:
        pages: list[StoryRightPage] = []
        for index in range(1, 6):
            plan = next((p for p in blueprint.page_plans if p.page_number == index), None)
            chapter = plan.chapter if plan else CHAPTER_SEQUENCE[index - 1]
            if index == 4:
                chapter = "Chapter 3 cont."
            beat = plan.beat if plan else f"{chapter} continues the adventure."
            text = beat
            pages.append(StoryRightPage(page_number=index, chapter=chapter, text=text))

        return StoryDraft(
            title=blueprint.title,
            title_page_text=blueprint.title_page_text,
            right_pages=self._enforce_complete_happy_arc(pages=pages),
            end_page_text=self._ensure_uplifting_end_page_text(blueprint.end_page_text),
        )

    def _fallback_scene_prompts(self, story: StoryDraft, blueprint: StoryBlueprint) -> ScenePromptBundle:
        prompts = [
            f"Illustration for {page.chapter}: {page.text}. Cinematic child-safe storybook scene with clear action and emotion."
            for page in story.right_pages
        ]
        return ScenePromptBundle(
            cover_prompt=(
                f"Cover illustration for '{story.title}'. {blueprint.cover_concept}. "
                "Clean composition, expressive characters, rich atmosphere."
            ),
            illustration_prompts=prompts[:5],
            negative_prompt=NEGATIVE_PROMPT_DEFAULT,
        )

    def _title_from_prompt(self, user_prompt: str) -> str:
        cleaned = re.sub(r"\s+", " ", user_prompt).strip()
        if not cleaned:
            return "Untitled Story"

        words = cleaned.split(" ")[:6]
        return " ".join(word.capitalize() for word in words)

    def _enforce_complete_happy_arc(self, pages: list[StoryRightPage]) -> list[StoryRightPage]:
        if not pages:
            return pages

        patched_pages = list(pages)
        final_page = patched_pages[-1]
        final_text = re.sub(r"\s+", " ", final_page.text or "").strip()

        if not self._has_any_keyword(final_text, RESOLUTION_KEYWORDS):
            final_text = (
                f"{final_text} The challenge reaches a clear, hopeful resolution."
            ).strip()

        if not self._has_any_keyword(final_text, POSITIVE_ENDING_KEYWORDS):
            final_text = (
                f"{final_text} The ending feels warm, confident, and encouraging."
            ).strip()

        final_text = self._sanitize_story_page_text(final_text)

        patched_pages[-1] = StoryRightPage(
            page_number=final_page.page_number,
            chapter=final_page.chapter,
            text=final_text,
        )
        return patched_pages

    def _ensure_uplifting_end_page_text(self, end_page_text: str) -> str:
        text = re.sub(r"\s+", " ", end_page_text or "").strip()
        if not text:
            text = (
                "The journey ends on a joyful note: with courage, practice, and support, "
                "every dream can grow into tomorrow's success."
            )

        if not self._has_any_keyword(text, POSITIVE_ENDING_KEYWORDS):
            text = (
                f"{text} Keep believing, keep learning, and keep moving forward with hope."
            ).strip()
        return text

    def _has_any_keyword(self, text: str, keywords: tuple[str, ...]) -> bool:
        lowered = (text or "").lower()
        return any(keyword in lowered for keyword in keywords)

    def _ensure_rich_page_text(
        self,
        text: str,
        page_number: int,
        chapter: str,
        plan_beat: str,
    ) -> str:
        normalized = self._sanitize_story_page_text(text)
        if len(normalized) >= MIN_CHAPTER_TEXT_CHARS:
            return normalized

        extensions = self._page_text_extensions(
            page_number=page_number,
            chapter=chapter,
            plan_beat=plan_beat,
        )
        merged = normalized
        for sentence in extensions:
            if len(merged) >= MIN_CHAPTER_TEXT_CHARS:
                break
            if not sentence:
                continue
            if sentence in merged:
                continue
            merged = f"{merged} {sentence}".strip()

        return self._sanitize_story_page_text(merged)

    def _sanitize_story_page_text(self, text: str) -> str:
        normalized = re.sub(r"\s+", " ", text or "").strip()
        if not normalized:
            return normalized

        boilerplate_phrases = (
            "The hero reacts with courage and purpose, and the moment clearly leads into the next page.",
            "The hero reacts with courage and purpose, and the moment clearly leads into the next page",
            "By the end, the challenge is clearly resolved, and the goal feels within reach.",
            "By the end, the challenge is clearly resolved, and the goal feels within reach",
        )
        for phrase in boilerplate_phrases:
            normalized = re.sub(re.escape(phrase), "", normalized, flags=re.IGNORECASE)

        normalized = re.sub(r"\s+", " ", normalized).strip(" .")
        if not normalized:
            return normalized

        sentences = re.split(r"(?<=[.!?])\s+", normalized)
        deduped: list[str] = []
        seen: set[str] = set()
        for sentence in sentences:
            trimmed = sentence.strip()
            if not trimmed:
                continue
            key = re.sub(r"[^a-z0-9]+", "", trimmed.lower())
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(trimmed)

        merged = " ".join(deduped).strip()
        if merged and merged[-1] not in ".!?":
            merged = f"{merged}."
        return merged

    def _page_text_extensions(self, page_number: int, chapter: str, plan_beat: str) -> list[str]:
        chapter_line = chapter.strip() or f"Chapter {page_number}"
        beat_line = re.sub(r"\s+", " ", (plan_beat or "")).strip()
        beat_sentence = beat_line if beat_line else "the moment moves the story forward in a clear way."
        if beat_sentence and not beat_sentence.endswith("."):
            beat_sentence = f"{beat_sentence}."

        common_tail = [
            "Small actions and expressions make the emotions easy for kids to follow.",
            "The characters learn one practical lesson and use it immediately in the next moment.",
        ]

        by_page: dict[int, list[str]] = {
            1: [
                f"In {chapter_line}, the story world opens with a clear goal.",
                "The lead character notices a chance to begin and takes the first brave step.",
                *common_tail,
            ],
            2: [
                f"In {chapter_line}, teamwork starts shaping the journey.",
                "Friends share encouragement, and the lead character begins trusting the process.",
                *common_tail,
            ],
            3: [
                f"In {chapter_line}, tension rises and the challenge becomes real.",
                "A mistake or obstacle appears, but the group stays focused instead of giving up.",
                *common_tail,
            ],
            4: [
                f"In {chapter_line}, the turning point gains momentum.",
                "The lead character applies what they learned, and the team adjusts with patience.",
                *common_tail,
            ],
            5: [
                f"In {chapter_line}, the journey reaches a meaningful resolution.",
                "By the end, the challenge is solved in a hopeful way, and everyone celebrates progress together.",
                "The final beat feels motivating: effort, support, and courage make future dreams feel possible.",
            ],
        }
        return by_page.get(page_number, [beat_sentence, *common_tail])

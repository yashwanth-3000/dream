from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import TypeVar

from crewai import Agent, Crew, LLM, Process, Task
from pydantic import BaseModel

from app.config import Settings
from app.schemas import (
    CharacterBackstory,
    CharacterDrawingReference,
    CharacterCreationRequest,
    CharacterCreationResponse,
    CharacterImageRegenerationRequest,
    CharacterImageRegenerationResponse,
    ConceptOutline,
    ImagePromptPack,
    ResearchSummary,
    WorldReference,
    WorkflowType,
)
from app.services.replicate_service import ReplicateGenerationError, ReplicateImageService
from app.services.vision_service import OpenAIVisionService, VisionDescriptionError

ModelT = TypeVar("ModelT", bound=BaseModel)


class CharacterWorkflowError(RuntimeError):
    pass


@dataclass(slots=True)
class WorkflowDraft:
    backstory: CharacterBackstory
    image_prompt: ImagePromptPack
    reference_summary: ResearchSummary | None
    drawing_descriptions: list[str]
    world_reference_descriptions: list[str]


class CharacterWorkflowDecider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._bootstrap_model_env()
        self._llm = LLM(
            model=settings.openai_model,
            temperature=settings.openai_temperature,
        )
        self._vision = OpenAIVisionService(
            api_key=settings.openai_api_key,
            model=settings.openai_vision_model,
            max_tokens=settings.openai_vision_max_tokens,
        )
        self._replicate = ReplicateImageService(
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

    @staticmethod
    def choose_workflow(payload: CharacterCreationRequest) -> WorkflowType:
        if payload.force_workflow:
            return payload.force_workflow
        if payload.world_references or payload.character_drawings:
            return "reference_enriched"
        return "prompt_only"

    def run(self, payload: CharacterCreationRequest) -> CharacterCreationResponse:
        (
            prepared_payload,
            drawing_descriptions,
            world_reference_descriptions,
        ) = self._prepare_payload_with_vision_descriptions(payload)
        workflow = self.choose_workflow(prepared_payload)
        if workflow == "reference_enriched":
            draft = self._run_reference_enriched_workflow(
                prepared_payload,
                drawing_descriptions,
                world_reference_descriptions,
            )
        else:
            draft = self._run_prompt_only_workflow(
                prepared_payload,
                drawing_descriptions,
                world_reference_descriptions,
            )

        reference_images = self._collect_reference_images(
            world_references=prepared_payload.world_references,
            character_drawings=prepared_payload.character_drawings,
        )

        if not draft.image_prompt.positive_prompt.strip():
            raise CharacterWorkflowError("Image prompt generation failed: positive_prompt is empty.")

        try:
            generated_images = self._replicate.generate_character_images(
                prompt=draft.image_prompt.positive_prompt,
                negative_prompt=draft.image_prompt.negative_prompt or None,
                reference_images=reference_images,
            )
        except ReplicateGenerationError as exc:
            raise CharacterWorkflowError(str(exc)) from exc

        return CharacterCreationResponse(
            workflow_used=workflow,
            backstory=draft.backstory,
            image_prompt=draft.image_prompt,
            generated_images=generated_images,
            drawing_descriptions=draft.drawing_descriptions,
            world_reference_descriptions=draft.world_reference_descriptions,
            replicate_model=self._replicate.model,
            reference_summary=draft.reference_summary,
        )

    def run_image_regeneration(
        self,
        payload: CharacterImageRegenerationRequest,
    ) -> CharacterImageRegenerationResponse:
        positive_prompt = payload.positive_prompt.strip()
        if not positive_prompt:
            raise CharacterWorkflowError("Image regeneration failed: positive_prompt is empty.")

        negative_prompt = payload.negative_prompt.strip() if payload.negative_prompt else None
        reference_images = self._collect_reference_images(
            world_references=payload.world_references,
            character_drawings=payload.character_drawings,
        )

        try:
            generated_images = self._replicate.generate_character_images(
                prompt=positive_prompt,
                negative_prompt=negative_prompt or None,
                reference_images=reference_images,
            )
        except ReplicateGenerationError as exc:
            raise CharacterWorkflowError(str(exc)) from exc

        return CharacterImageRegenerationResponse(
            image_prompt=ImagePromptPack(
                positive_prompt=positive_prompt,
                negative_prompt=negative_prompt or "",
            ),
            generated_images=generated_images,
            replicate_model=self._replicate.model,
            total_reference_images_sent=len(reference_images),
        )

    def _run_reference_enriched_workflow(
        self,
        payload: CharacterCreationRequest,
        drawing_descriptions: list[str],
        world_reference_descriptions: list[str],
    ) -> WorkflowDraft:
        researcher_agent = Agent(
            role="Lore Research Analyst",
            goal=(
                "Extract high-signal cues from user-provided world references and drawings to improve worldbuilding "
                "and visual direction for character creation."
            ),
            backstory=(
                "You are a senior speculative-fiction researcher who can quickly distill dense "
                "references and visual inputs into actionable lore and style cues for creative teams."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        backstory_agent = Agent(
            role="Narrative Character Designer",
            goal="Create a rich, coherent, and emotionally resonant character backstory.",
            backstory=(
                "You write production-ready character bibles for animation and game studios, "
                "balancing originality, internal logic, and memorable details."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        prompt_agent = Agent(
            role="Generative Image Prompt Engineer",
            goal=(
                "Transform narrative + visual cues into a highly detailed, model-ready image prompt "
                "for story-ready character generation that can be reused in downstream scenes."
            ),
            backstory=(
                "You optimize prompts for top-tier text-to-image systems and encode composition, "
                "materials, camera direction, mood, and stylistic constraints precisely. "
                "You are specialized in story-keyframe prompts that preserve identity consistency "
                "for multi-scene pipelines."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        research_task = Task(
            description=(
                "Analyze the user-provided references for this character concept.\n"
                "User prompt: {user_prompt}\n"
                "World references from user:\n{world_references_text}\n\n"
                "Character drawing notes:\n{character_drawings_text}\n\n"
                "Prioritize factual setting cues, materials/costumes, and cultural motifs.\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: key_facts (array), style_cues (array), "
                "source_links (array), research_notes (string)."
            ),
            output_pydantic=ResearchSummary,
            agent=researcher_agent,
        )

        backstory_task = Task(
            description=(
                "Create a complete character backstory informed by the prompt + references.\n"
                "Requirements:\n"
                "- The backstory must have historical cause-effect continuity.\n"
                "- Include strengths, flaws, and unresolved inner conflict.\n"
                "- Keep details coherent with world references.\n"
                "- Write a vivid narrative section at least 250 words.\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: name, archetype, era, origin, goals (array), "
                "flaws (array), narrative_backstory, visual_signifiers (array)."
            ),
            output_pydantic=CharacterBackstory,
            context=[research_task],
            agent=backstory_agent,
        )

        prompt_task = Task(
            description=(
                "Build a very detailed image prompt for character generation.\n"
                "Use the backstory and visual signifiers.\n"
                "Prompt quality bar:\n"
                "- make it a story-ready keyframe moment usable for downstream story/video generation\n"
                "- include story beat context (where, what is happening, emotional state)\n"
                "- enforce character identity continuity for future scenes (face, silhouette, outfit motifs)\n"
                "- if original character image(s) are provided, the final generated image must closely match those originals\n"
                "- keep world consistency with reference cues\n"
                "- cinematic framing\n"
                "- body posture and expression\n"
                "- outfit materials and props\n"
                "- lighting and atmosphere\n"
                "- texture-level details\n"
                "- concise negative prompt to avoid artifacts, text overlays, and watermarks\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: positive_prompt, negative_prompt, composition_guidance (array), "
                "color_palette (array), lighting."
            ),
            output_pydantic=ImagePromptPack,
            context=[research_task, backstory_task],
            agent=prompt_agent,
        )

        crew = Crew(
            agents=[researcher_agent, backstory_agent, prompt_agent],
            tasks=[research_task, backstory_task, prompt_task],
            process=Process.sequential,
            verbose=self._settings.crewai_verbose,
        )

        crew.kickoff(inputs=self._build_inputs(payload))

        research = self._task_output_as_model(research_task, ResearchSummary)
        backstory = self._task_output_as_model(backstory_task, CharacterBackstory)
        image_prompt = self._task_output_as_model(prompt_task, ImagePromptPack)
        research = self._apply_research_fallbacks(research, payload)
        image_prompt = self._apply_prompt_fallback(image_prompt, backstory, payload)

        return WorkflowDraft(
            backstory=backstory,
            image_prompt=image_prompt,
            reference_summary=research,
            drawing_descriptions=drawing_descriptions,
            world_reference_descriptions=world_reference_descriptions,
        )

    def _run_prompt_only_workflow(
        self,
        payload: CharacterCreationRequest,
        drawing_descriptions: list[str],
        world_reference_descriptions: list[str],
    ) -> WorkflowDraft:
        concept_agent = Agent(
            role="Concept Worldbuilder",
            goal="Expand sparse prompts into coherent world and conflict scaffolding.",
            backstory=(
                "You are a senior concept developer for original IP creation and help teams "
                "move from a one-line idea to a production-ready concept frame."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        backstory_agent = Agent(
            role="Narrative Character Designer",
            goal="Author a rich and emotionally credible backstory from concept scaffolding.",
            backstory=(
                "You design iconic characters for games and animation, focusing on internal logic "
                "and memorable emotional arcs."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        prompt_agent = Agent(
            role="Generative Image Prompt Engineer",
            goal=(
                "Produce a high-fidelity character prompt optimized for text-to-image generation "
                "with downstream story-scene usability."
            ),
            backstory=(
                "You convert narrative concepts into technical visual prompts for production image pipelines, "
                "with emphasis on consistent character identity across scenes."
            ),
            llm=self._llm,
            allow_delegation=False,
            verbose=self._settings.crewai_verbose,
        )

        concept_task = Task(
            description=(
                "Expand this idea into a compact concept outline:\n"
                "{user_prompt}\n\n"
                "Deliver the world snapshot, conflict, character hook, and anchor visuals.\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: world_snapshot, core_conflict, character_hook, "
                "anchor_visuals (array)."
            ),
            output_pydantic=ConceptOutline,
            agent=concept_agent,
        )

        backstory_task = Task(
            description=(
                "Using the concept outline, write a deep character backstory.\n"
                "Requirements:\n"
                "- at least 250 words for narrative_backstory\n"
                "- include specific life events and turning points\n"
                "- include strengths and flaws tied to those events\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: name, archetype, era, origin, goals (array), "
                "flaws (array), narrative_backstory, visual_signifiers (array)."
            ),
            output_pydantic=CharacterBackstory,
            context=[concept_task],
            agent=backstory_agent,
        )

        prompt_task = Task(
            description=(
                "Create an image generation prompt from the backstory.\n"
                "The positive_prompt should be very detailed and camera-directive.\n"
                "The prompt must produce a story-ready keyframe that can be reused in downstream story/video steps.\n"
                "Include scene context, action beat, emotional state, and stable character identity cues.\n"
                "If original character image(s) are provided, require close match to those originals in final output.\n"
                "Negative prompt should suppress artifacts, text overlays, and watermarks.\n"
                "Return clean JSON only."
            ),
            expected_output=(
                "Strict JSON with keys: positive_prompt, negative_prompt, composition_guidance (array), "
                "color_palette (array), lighting."
            ),
            output_pydantic=ImagePromptPack,
            context=[concept_task, backstory_task],
            agent=prompt_agent,
        )

        crew = Crew(
            agents=[concept_agent, backstory_agent, prompt_agent],
            tasks=[concept_task, backstory_task, prompt_task],
            process=Process.sequential,
            verbose=self._settings.crewai_verbose,
        )

        crew.kickoff(inputs=self._build_inputs(payload))

        backstory = self._task_output_as_model(backstory_task, CharacterBackstory)
        image_prompt = self._task_output_as_model(prompt_task, ImagePromptPack)
        image_prompt = self._apply_prompt_fallback(image_prompt, backstory, payload)

        return WorkflowDraft(
            backstory=backstory,
            image_prompt=image_prompt,
            reference_summary=None,
            drawing_descriptions=drawing_descriptions,
            world_reference_descriptions=world_reference_descriptions,
        )

    def _build_inputs(self, payload: CharacterCreationRequest) -> dict[str, str]:
        return {
            "user_prompt": payload.user_prompt.strip(),
            "world_references_text": self._world_references_text(payload),
            "character_drawings_text": self._character_drawings_text(payload),
        }

    def _prepare_payload_with_vision_descriptions(
        self,
        payload: CharacterCreationRequest,
    ) -> tuple[CharacterCreationRequest, list[str], list[str]]:
        drawing_payload, drawing_descriptions = self._prepare_drawings_with_vision(payload)
        final_payload, world_reference_descriptions = self._prepare_world_references_with_vision(drawing_payload)
        return final_payload, drawing_descriptions, world_reference_descriptions

    def _prepare_drawings_with_vision(
        self,
        payload: CharacterCreationRequest,
    ) -> tuple[CharacterCreationRequest, list[str]]:
        if not payload.character_drawings:
            return payload, []

        enhanced_drawings: list[CharacterDrawingReference] = []
        collected_descriptions: list[str] = []
        for drawing in payload.character_drawings:
            base_text = self._combine_drawing_text(drawing.description, drawing.notes)
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

            merged_text = self._combine_drawing_text(base_text, vision_text)
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

        return (
            payload.model_copy(update={"character_drawings": enhanced_drawings}),
            collected_descriptions,
        )

    def _prepare_world_references_with_vision(
        self,
        payload: CharacterCreationRequest,
    ) -> tuple[CharacterCreationRequest, list[str]]:
        if not payload.world_references:
            return payload, []

        enhanced_references: list[WorldReference] = []
        collected_descriptions: list[str] = []
        for ref in payload.world_references:
            base_text = self._combine_drawing_text(ref.title, ref.description)
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

            merged_description = self._combine_drawing_text(ref.description, vision_text)
            final_description = merged_description if merged_description else ref.description

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

        return (
            payload.model_copy(update={"world_references": enhanced_references}),
            collected_descriptions,
        )

    def _world_references_text(self, payload: CharacterCreationRequest) -> str:
        if not payload.world_references:
            return "None supplied."

        lines: list[str] = []
        for index, ref in enumerate(payload.world_references, start=1):
            parts = [
                f"{index}.",
                f"title={ref.title or 'n/a'}",
                f"description={ref.description or 'n/a'}",
                f"url={ref.url or 'n/a'}",
                f"image={'provided' if ref.image_data else 'n/a'}",
            ]
            lines.append(" ".join(parts))
        return "\n".join(lines)

    def _character_drawings_text(self, payload: CharacterCreationRequest) -> str:
        if not payload.character_drawings:
            return "None supplied."

        lines: list[str] = []
        for index, drawing in enumerate(payload.character_drawings, start=1):
            parts = [
                f"{index}.",
                f"url={drawing.url or 'n/a'}",
                f"description={drawing.description or 'n/a'}",
                f"notes={drawing.notes or 'n/a'}",
                f"image={'provided' if drawing.image_data else 'n/a'}",
            ]
            lines.append(" ".join(parts))
        return "\n".join(lines)

    def _combine_drawing_text(self, *parts: str | None) -> str:
        cleaned = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
        return "\n".join(cleaned).strip()

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

    def _collect_reference_images(
        self,
        *,
        world_references: list[WorldReference],
        character_drawings: list[CharacterDrawingReference],
    ) -> list[str]:
        reference_images: list[str] = []
        for drawing in character_drawings:
            image_input = self._extract_image_input_from_drawing(drawing)
            if image_input:
                reference_images.append(image_input)
        for ref in world_references:
            image_input = self._extract_image_input_from_world_reference(ref)
            if image_input:
                reference_images.append(image_input)

        if not reference_images:
            return []

        # Preserve order while avoiding duplicate urls/data-urls.
        return list(dict.fromkeys(reference_images))

    def _task_output_as_model(self, task: Task, model_cls: type[ModelT]) -> ModelT:
        output = getattr(task, "output", None)
        if output is None:
            return model_cls()

        pydantic_obj = getattr(output, "pydantic", None)
        if pydantic_obj is not None:
            if isinstance(pydantic_obj, model_cls):
                return pydantic_obj
            if isinstance(pydantic_obj, BaseModel):
                return model_cls.model_validate(pydantic_obj.model_dump())

        raw = getattr(output, "raw", None)
        if isinstance(raw, str) and raw.strip():
            parsed = self._parse_json_like_output(raw, model_cls)
            if parsed is not None:
                return parsed

        text_output = str(output)
        parsed = self._parse_json_like_output(text_output, model_cls)
        if parsed is not None:
            return parsed

        return model_cls()

    def _parse_json_like_output(self, text: str, model_cls: type[ModelT]) -> ModelT | None:
        if not text:
            return None

        direct = text.strip()
        try:
            return model_cls.model_validate_json(direct)
        except Exception:
            pass

        fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
        if fenced_match:
            candidate = fenced_match.group(1)
            try:
                return model_cls.model_validate_json(candidate)
            except Exception:
                pass

        object_match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if object_match:
            candidate = object_match.group(0)
            try:
                payload = json.loads(candidate)
                return model_cls.model_validate(payload)
            except Exception:
                return None

        return None

    def _bootstrap_model_env(self) -> None:
        os.environ.setdefault("OPENAI_API_KEY", self._settings.openai_api_key)
        normalized_model = self._settings.openai_model.split("/", maxsplit=1)[-1]
        os.environ.setdefault("OPENAI_MODEL_NAME", normalized_model)

    def _apply_research_fallbacks(
        self,
        research: ResearchSummary,
        payload: CharacterCreationRequest,
    ) -> ResearchSummary:
        if not research.source_links:
            research.source_links = [str(ref.url) for ref in payload.world_references if ref.url]

        if not research.key_facts:
            research.key_facts = [
                ref.description
                for ref in payload.world_references
                if ref.description
            ][:5]

        return research

    def _apply_prompt_fallback(
        self,
        image_prompt: ImagePromptPack,
        backstory: CharacterBackstory,
        payload: CharacterCreationRequest,
    ) -> ImagePromptPack:
        if image_prompt.positive_prompt.strip():
            return image_prompt

        motifs = ", ".join(backstory.visual_signifiers[:6]) if backstory.visual_signifiers else "signature costume details"
        goals = ", ".join(backstory.goals[:3]) if backstory.goals else "a clear emotional objective"
        original_match_clause = (
            "Final output must closely match the user's original character image(s), including face shape, "
            "hairstyle, body proportions, and defining outfit silhouette. "
            if payload.character_drawings
            else ""
        )
        image_prompt.positive_prompt = (
            f"Story-ready keyframe portrait of {backstory.name or 'an original fantasy character'}, "
            f"{backstory.archetype or 'mythic protagonist'}, set in {backstory.era or 'a speculative era'}, "
            f"with motifs: {motifs}. Convey goals: {goals}. "
            f"User concept: {payload.user_prompt}. "
            f"{original_match_clause}"
            "Preserve identity continuity for future scenes with stable face, silhouette, and signature costume details. "
            "Cinematic composition, dramatic lighting, ultra-detailed textures."
        )
        if not image_prompt.negative_prompt:
            image_prompt.negative_prompt = (
                "blurry, low detail, bad anatomy, deformed face, extra limbs, watermark, text artifacts, logo overlays, captions"
            )
        return image_prompt

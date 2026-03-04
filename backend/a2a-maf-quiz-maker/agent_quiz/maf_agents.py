from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings
from .schemas import QuizBlueprint, QuizCreationRequest, QuizDraft, WorkflowType


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
You are QuizBlueprintAgent.
Generate compact JSON only.
Do not use markdown.

Task:
Create a kid-safe quiz blueprint from the input topic/story context.

Rules:
- Keep language simple and age-appropriate.
- Create exactly the requested number of question plans.
- Each question plan should focus on one clear learning/comprehension goal.
- Keep plans diverse; avoid repeating the same wording pattern.

Output JSON keys exactly:
{
  "quiz_title": "...",
  "instructions": "...",
  "question_plans": [
    {"question_number":1,"question_focus":"...","learning_goal":"..."}
  ]
}
""".strip()

WRITER_SYSTEM_PROMPT = """
You are QuizWriterAgent.
Generate compact JSON only.
Do not use markdown.

Task:
Write a complete children quiz from a blueprint.

Rules:
- Create exactly the requested number of questions.
- Every question must have exactly 4 options.
- Exactly one option is correct.
- Set correct_option_index from 0 to 3.
- Provide exactly 2 hints per question. Hints must be progressively more helpful.
- Provide a short explanation of why the correct option is right.
- Keep tone supportive and child-friendly.

Output JSON keys exactly:
{
  "quiz_title": "...",
  "instructions": "...",
  "questions": [
    {
      "question_number": 1,
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_option_index": 0,
      "hints": ["...", "..."],
      "correct_explanation": "...",
      "learning_goal": "..."
    }
  ]
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


class QuizBlueprintAgent:
    def __init__(self, settings: Settings) -> None:
        self._agent = _MAFJsonAgent(
            settings=settings,
            name="dream-quiz-blueprint-agent",
            instructions=BLUEPRINT_SYSTEM_PROMPT,
        )

    async def generate(
        self,
        payload: QuizCreationRequest,
        workflow: WorkflowType,
    ) -> QuizBlueprint:
        snapshot = {
            "workflow": workflow,
            "question_count": payload.question_count,
            "user_prompt": payload.user_prompt,
            "story_title": payload.story_title,
            "story_text": payload.story_text,
            "age_band": payload.age_band,
            "difficulty": payload.difficulty,
        }

        prompt = (
            "Create a quiz blueprint from this request context. "
            "Output strict JSON only.\n\n"
            f"INPUT:\n{json.dumps(snapshot, ensure_ascii=True)}"
        )

        return await self._agent.run_json(prompt=prompt, model_cls=QuizBlueprint)


class QuizWriterAgent:
    def __init__(self, settings: Settings) -> None:
        self._agent = _MAFJsonAgent(
            settings=settings,
            name="dream-quiz-writer-agent",
            instructions=WRITER_SYSTEM_PROMPT,
        )

    async def generate(
        self,
        payload: QuizCreationRequest,
        blueprint: QuizBlueprint,
        workflow: WorkflowType,
    ) -> QuizDraft:
        snapshot = {
            "workflow": workflow,
            "question_count": payload.question_count,
            "user_prompt": payload.user_prompt,
            "story_title": payload.story_title,
            "story_text": payload.story_text,
            "age_band": payload.age_band,
            "difficulty": payload.difficulty,
            "blueprint": blueprint.model_dump(mode="json"),
        }

        prompt = (
            "Write the final quiz from this request + blueprint context. "
            "Output strict JSON only.\n\n"
            f"INPUT:\n{json.dumps(snapshot, ensure_ascii=True)}"
        )

        return await self._agent.run_json(prompt=prompt, model_cls=QuizDraft)

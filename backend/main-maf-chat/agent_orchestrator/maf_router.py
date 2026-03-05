from __future__ import annotations

import json
import re
from contextlib import nullcontext
from typing import Any

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings
from .models import (
    AgentDecision,
    CharacterOrchestrationRequest,
    SelectedAction,
    SelectedBy,
)

try:
    from opentelemetry import trace
except Exception:  # pragma: no cover - optional dependency
    trace = None  # type: ignore[assignment]


try:
    from agent_framework import Agent
    from agent_framework.azure import AzureOpenAIChatClient
    from agent_framework.openai import OpenAIChatClient
except Exception as exc:  # pragma: no cover - import guard for runtime compatibility
    Agent = None  # type: ignore[assignment]
    AzureOpenAIChatClient = None  # type: ignore[assignment]
    OpenAIChatClient = None  # type: ignore[assignment]
    MAF_IMPORT_ERROR: Exception | None = exc
else:
    MAF_IMPORT_ERROR = None

TRACER = trace.get_tracer(__name__) if trace is not None else None


ROUTER_SYSTEM_PROMPT = """
You are the routing agent for a character creation platform.

Available actions:
1) create
- Use when a full character pipeline should run.
- This triggers: vision analysis + CrewAI backstory generation + image prompt generation + image generation.
- Requires a non-empty user_prompt.

2) regenerate
- Use when user already has an image prompt and only wants new image generation.
- This skips CrewAI and only runs image generation.
- Requires a non-empty positive_prompt.

Decision policy:
- If positive_prompt exists and user_prompt is empty: regenerate.
- If user_prompt exists and positive_prompt is empty: create.
- If both exist: choose regenerate only when request intent is clearly regenerate/rerender; otherwise choose create.
- Never return anything except strict JSON.

Output format (strict JSON only):
{
  "selected_action": "create" | "regenerate",
  "rationale": "short explanation",
  "confidence": 0.0-1.0
}
""".strip()


class MAFRoutingAgent:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
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
                model_id=self._settings.openai_model,
                api_key=self._settings.openai_api_key,
            )

        return Agent(
            client=client,
            name="dream-character-router",
            instructions=ROUTER_SYSTEM_PROMPT,
        )

    async def decide(
        self,
        payload: CharacterOrchestrationRequest,
    ) -> tuple[AgentDecision, SelectedBy, str | None]:
        with self._start_span("character_router.decide") as span:
            self._set_span_attr(span, "character.mode", payload.mode)
            if payload.mode == "create":
                return (
                    AgentDecision(
                        selected_action="create",
                        rationale="Explicit mode=create was provided.",
                        confidence=1.0,
                    ),
                    "explicit_mode",
                    None,
                )

            if payload.mode == "regenerate":
                return (
                    AgentDecision(
                        selected_action="regenerate",
                        rationale="Explicit mode=regenerate was provided.",
                        confidence=1.0,
                    ),
                    "explicit_mode",
                    None,
                )

            if self._agent is None:
                fallback = self._rule_based_decision(payload, reason_prefix=self._import_error_prefix())
                self._set_span_attr(span, "character.selected_by", "rule_fallback")
                return fallback, "rule_fallback", None

            decision_prompt = self._build_decision_prompt(payload)
            raw_output: str | None = None

            try:
                with self._start_span("character_router.agent_run"):
                    response = await self._agent.run(decision_prompt)
                raw_output = (response.text or "").strip()
                parsed = self._parse_agent_output(raw_output)
                if parsed is not None:
                    self._set_span_attr(span, "character.selected_by", "agent")
                    self._set_span_attr(span, "character.selected_action", parsed.selected_action)
                    return parsed, "agent", raw_output
            except Exception as exc:
                fallback = self._rule_based_decision(payload, reason_prefix=f"Agent runtime failure: {exc}")
                self._set_span_attr(span, "character.selected_by", "rule_fallback")
                return fallback, "rule_fallback", raw_output

            fallback = self._rule_based_decision(payload, reason_prefix="Could not parse routing JSON from model output.")
            self._set_span_attr(span, "character.selected_by", "rule_fallback")
            return fallback, "rule_fallback", raw_output

    def _build_decision_prompt(self, payload: CharacterOrchestrationRequest) -> str:
        snapshot = {
            "mode": payload.mode,
            "has_user_prompt": bool(payload.user_prompt and payload.user_prompt.strip()),
            "user_prompt": payload.user_prompt,
            "has_positive_prompt": bool(payload.positive_prompt and payload.positive_prompt.strip()),
            "positive_prompt_preview": (payload.positive_prompt or "")[:280],
            "world_reference_count": len(payload.world_references),
            "character_drawing_count": len(payload.character_drawings),
            "force_workflow": payload.force_workflow,
        }

        return (
            "Route this request to create or regenerate. Return strict JSON only.\\n"
            f"request_json={json.dumps(snapshot, ensure_ascii=True)}"
        )

    def _parse_agent_output(self, raw_output: str) -> AgentDecision | None:
        if not raw_output:
            return None

        candidates = [raw_output]

        fenced_match = re.search(
            r"```json\\s*(\{.*?\})\\s*```",
            raw_output,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if fenced_match:
            candidates.append(fenced_match.group(1))

        object_match = re.search(r"\{.*\}", raw_output, flags=re.DOTALL)
        if object_match:
            candidates.append(object_match.group(0))

        for candidate in candidates:
            try:
                data = json.loads(candidate)
            except Exception:
                continue

            if not isinstance(data, dict):
                continue

            try:
                return AgentDecision.model_validate(data)
            except Exception:
                continue

        return None

    def _rule_based_decision(
        self,
        payload: CharacterOrchestrationRequest,
        reason_prefix: str,
    ) -> AgentDecision:
        has_positive_prompt = bool(payload.positive_prompt and payload.positive_prompt.strip())
        selected_action: SelectedAction = "regenerate" if has_positive_prompt else "create"
        reason_suffix = (
            "positive_prompt is present, so regenerate-only path is selected."
            if has_positive_prompt
            else "positive_prompt is absent, so full create path is selected."
        )
        return AgentDecision(
            selected_action=selected_action,
            rationale=f"{reason_prefix} {reason_suffix}".strip(),
            confidence=0.55,
        )

    def _import_error_prefix(self) -> str:
        if MAF_IMPORT_ERROR is None:
            return "MAF agent unavailable."
        return f"MAF import unavailable: {MAF_IMPORT_ERROR}"

    def _start_span(self, name: str):
        if TRACER is None:
            return nullcontext()
        return TRACER.start_as_current_span(name)

    def _set_span_attr(self, span: Any, key: str, value: Any) -> None:
        if span is None or value is None:
            return
        try:
            span.set_attribute(key, value)
        except Exception:
            return

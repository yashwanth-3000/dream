from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings

try:
    from agent_framework import Agent, MCPStreamableHTTPTool
    from agent_framework.azure import AzureOpenAIChatClient
    from agent_framework.openai import OpenAIChatClient
except Exception as exc:  # pragma: no cover - import guard for runtime compatibility
    Agent = None  # type: ignore[assignment]
    MCPStreamableHTTPTool = None  # type: ignore[assignment]
    AzureOpenAIChatClient = None  # type: ignore[assignment]
    OpenAIChatClient = None  # type: ignore[assignment]
    MAF_IMPORT_ERROR: Exception | None = exc
else:
    MAF_IMPORT_ERROR = None


QuestionCategory = Literal["general", "learning", "creative", "sensitive", "unsafe"]
SafetyLevel = Literal["safe", "caution", "unsafe"]
ReadingLevel = Literal["5-7", "8-10", "11-13", "14+"]
ResponseStyle = Literal["short", "explainer", "playful"]

logger = logging.getLogger(__name__)


QUESTION_READER_PROMPT = """
You read kid questions and classify how an answer should be written.
Return strict JSON only. Do not output markdown.

JSON schema:
{
  "category": "general" | "learning" | "creative" | "sensitive" | "unsafe",
  "safety": "safe" | "caution" | "unsafe",
  "reading_level": "5-7" | "8-10" | "11-13" | "14+",
  "response_style": "short" | "explainer" | "playful",
  "notes": "short reason"
}

Policy:
- Mark "unsafe" for requests involving sexual content, self-harm, violence intent, weapons, illegal activity, or explicit instructions to hurt someone.
- Mark "sensitive" + "caution" for emotionally difficult topics (fear, grief, anxiety, bullying, etc.) where gentle language is needed.
- Mark "learning" for homework, science, math, or factual explanations.
- Mark "creative" for stories, imagination, games, and playful idea prompts.
- Keep notes concise.
""".strip()


KID_RESPONDER_PROMPT = """
You are Dream Buddy, a child-safe learning assistant.
Write responses for kids using warm and clear language.

Rules:
- Return plain text only (no markdown bullets unless user asked for list format).
- Keep answer concise (about 60-140 words unless user asks for long).
- Prefer short sentences and concrete examples.
- If safety is "unsafe": politely refuse and suggest asking a trusted adult/teacher/parent.
- If safety is "caution": respond gently and include supportive guidance.
- Never provide harmful instructions.
- If the question is unclear, ask one simple follow-up question.
- If user asks for current date/time ("today", "now", "current date/time"), use server_time context as authoritative.
- For current date/time questions, include ISO date (YYYY-MM-DD) in the response.
""".strip()


class MAFChatError(RuntimeError):
    pass


class QuestionRead(BaseModel):
    category: QuestionCategory = "general"
    safety: SafetyLevel = "safe"
    reading_level: ReadingLevel = "8-10"
    response_style: ResponseStyle = "explainer"
    notes: str = Field(default="", max_length=300)


@dataclass(slots=True)
class ChatAnswerResult:
    answer: str
    category: QuestionCategory
    safety: SafetyLevel
    reading_level: ReadingLevel
    response_style: ResponseStyle
    model: str
    mcp_used: bool = False
    mcp_server: str | None = None
    mcp_output: dict[str, Any] | None = None


class MAFKidsChatOrchestrator:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._question_reader = self._build_agent(
            name="dream-kid-question-reader",
            instructions=QUESTION_READER_PROMPT,
        )
        self._responder = self._build_agent(
            name="dream-kid-response-agent",
            instructions=KID_RESPONDER_PROMPT,
        )

    def _build_agent(self, *, name: str, instructions: str) -> Any | None:
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
            name=name,
            instructions=instructions,
        )

    async def answer_question(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        age_band: str | None = None,
        mode: str = "normal",
    ) -> ChatAnswerResult:
        clean_message = message.strip()
        if not clean_message:
            raise MAFChatError("message cannot be empty")

        clipped_history = self._clip_history(history)
        search_mode_requested = mode.strip().lower() == "search"
        question_read = await self._read_question(
            message=clean_message,
            history=clipped_history,
            age_band=age_band,
        )
        answer_text, mcp_used, mcp_server, mcp_output = await self._generate_answer(
            message=clean_message,
            history=clipped_history,
            age_band=age_band,
            question_read=question_read,
            search_mode_requested=search_mode_requested,
        )
        if not answer_text:
            raise MAFChatError("Responder agent returned an empty answer.")

        return ChatAnswerResult(
            answer=answer_text,
            category=question_read.category,
            safety=question_read.safety,
            reading_level=question_read.reading_level,
            response_style=question_read.response_style,
            model=self._model_label(),
            mcp_used=mcp_used,
            mcp_server=mcp_server,
            mcp_output=mcp_output,
        )

    async def _read_question(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        age_band: str | None,
    ) -> QuestionRead:
        if self._question_reader is None:
            raise MAFChatError(
                "Question-reader agent unavailable. "
                f"import_error={self.import_error_context()}"
            )

        prompt_payload = {
            "age_band": age_band,
            "latest_question": message,
            "recent_history": history,
        }
        prompt = (
            "Classify this kid question. Return strict JSON only.\n"
            f"context={json.dumps(prompt_payload, ensure_ascii=True)}"
        )

        try:
            response = await self._question_reader.run(prompt)
        except Exception as exc:
            raise MAFChatError(f"Question-reader agent failed: {exc}") from exc

        raw_output = (response.text or "").strip()
        parsed = self._parse_json_model(raw_output, QuestionRead)
        if parsed is not None:
            return parsed
        raise MAFChatError("Question-reader agent returned unparsable JSON.")

    async def _generate_answer(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        age_band: str | None,
        question_read: QuestionRead,
        search_mode_requested: bool,
    ) -> tuple[str, bool, str | None, dict[str, Any] | None]:
        if self._responder is None:
            raise MAFChatError(
                "Response agent unavailable. "
                f"import_error={self.import_error_context()}"
            )

        payload = {
            "age_band": age_band,
            "mode": "search" if search_mode_requested else "normal",
            "question_read": question_read.model_dump(mode="json"),
            "latest_question": message,
            "recent_history": history,
            "server_time": self._server_time_context(),
        }
        prompt = (
            "Answer the child using the provided classification and policy.\n"
            f"context={json.dumps(payload, ensure_ascii=True)}"
        )
        if search_mode_requested:
            prompt += (
                "\nSearch mode is enabled. "
                "Use available MCP search tools when fresh facts are needed."
            )
        temporal_query = self._is_current_datetime_query(message)
        if temporal_query:
            prompt += (
                "\nCurrent date/time question detected. "
                "Use only server_time values for current date/time and include ISO date."
            )

        mcp_used = False
        mcp_server: str | None = None
        mcp_output: dict[str, Any] | None = None
        response: Any

        if search_mode_requested:
            if not self._settings.exa_mcp_enabled:
                if self._settings.exa_mcp_required_in_search:
                    raise MAFChatError(
                        "Search mode requires MCP, but EXA_MCP_ENABLED is false."
                    )
                try:
                    response = await self._responder.run(prompt)
                except Exception as exc:
                    raise MAFChatError(f"Chat responder failed: {exc}") from exc
            else:
                try:
                    response, mcp_output = await self._run_responder_with_exa_mcp(
                        prompt=prompt,
                        query=message,
                    )
                    mcp_used = True
                    mcp_server = self._settings.exa_mcp_base_url
                except Exception as exc:
                    if self._settings.exa_mcp_required_in_search:
                        raise MAFChatError(
                            f"Search mode requires MCP, but Exa MCP failed: {exc}"
                        ) from exc
                    logger.warning("Exa MCP unavailable in search mode; continuing without MCP: %s", exc)
                    try:
                        response = await self._responder.run(prompt)
                    except Exception as fallback_exc:
                        raise MAFChatError(f"Chat responder failed: {fallback_exc}") from fallback_exc
        else:
            try:
                response = await self._responder.run(prompt)
            except Exception as exc:
                raise MAFChatError(f"Chat responder failed: {exc}") from exc

        answer = (response.text or "").strip()
        if not answer:
            raise MAFChatError("Response agent returned an empty answer.")
        if temporal_query:
            iso_date = payload["server_time"]["date_local_iso"]
            if iso_date not in answer:
                logger.warning(
                    "Temporal response missing authoritative ISO date; applying deterministic correction."
                )
                answer = self._build_date_time_answer(
                    message=message,
                    server_time=payload["server_time"],
                )

        return answer, mcp_used, mcp_server, mcp_output

    async def _run_responder_with_exa_mcp(
        self,
        *,
        prompt: str,
        query: str,
    ) -> tuple[Any, dict[str, Any] | None]:
        if MCPStreamableHTTPTool is None:
            raise MAFChatError(
                "MCPStreamableHTTPTool unavailable. "
                f"import_error={self.import_error_context()}"
            )

        request_timeout = max(1, int(round(self._settings.exa_mcp_timeout_seconds)))
        allowed_tools = self._settings.exa_mcp_tool_names or None
        async with httpx.AsyncClient(timeout=self._settings.exa_mcp_timeout_seconds) as http_client:
            exa_tool = MCPStreamableHTTPTool(
                name="exa-search",
                url=self._settings.exa_mcp_url,
                description="Exa MCP web search for up-to-date factual grounding.",
                request_timeout=request_timeout,
                load_tools=True,
                load_prompts=False,
                allowed_tools=allowed_tools,
                http_client=http_client,
            )
            async with exa_tool:
                mcp_output = await self._collect_mcp_output(exa_tool=exa_tool, query=query)
                response = await self._responder.run(prompt, tools=exa_tool)
                return response, mcp_output

    async def _collect_mcp_output(self, *, exa_tool: Any, query: str) -> dict[str, Any] | None:
        tools = [str(getattr(func, "name", "")).strip() for func in getattr(exa_tool, "functions", [])]
        tools = [name for name in tools if name]
        if not tools:
            return {"tools": [], "query": query, "error": "No MCP tools were exposed by server."}

        preferred = next((name for name in tools if "search" in name.lower()), tools[0])
        attempts: list[dict[str, Any]] = [
            {"query": query},
            {"q": query},
            {"search_query": query},
            {"input": query},
        ]
        last_error = ""
        for kwargs in attempts:
            try:
                raw = await exa_tool.call_tool(preferred, **kwargs)
                return {
                    "tools": tools,
                    "tool_used": preferred,
                    "input": kwargs,
                    "output": raw,
                }
            except Exception as exc:
                last_error = str(exc)

        return {
            "tools": tools,
            "tool_used": preferred,
            "input": attempts[0],
            "error": last_error or "MCP tool call failed.",
        }

    def _clip_history(self, history: list[dict[str, str]]) -> list[dict[str, str]]:
        clipped: list[dict[str, str]] = []
        for item in history[-8:]:
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "").strip()
            if role not in {"user", "assistant"} or not content:
                continue
            clipped.append({"role": role, "content": content[:1000]})
        return clipped

    def _server_time_context(self) -> dict[str, str]:
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone()
        return {
            "iso_utc": now_utc.isoformat(),
            "iso_local": now_local.isoformat(),
            "timezone_local": str(now_local.tzinfo or "local"),
            "date_local_iso": now_local.date().isoformat(),
            "weekday_local": now_local.strftime("%A"),
            "human_local_date": now_local.strftime("%B %d, %Y"),
            "human_local_time": now_local.strftime("%I:%M %p").lstrip("0"),
        }

    def _is_current_datetime_query(self, message: str) -> bool:
        lowered = (message or "").strip().lower()
        compact = re.sub(r"[^a-z0-9]", "", lowered)
        if any(token in compact for token in ("datetoday", "todaydate", "whatisdatetoday")):
            return True

        patterns = [
            r"\btoday\b",
            r"\bdate\s*today\b",
            r"\bwhat(?:'s| is)\s+the\s+date\b",
            r"\bcurrent\s+date\b",
            r"\bcurrent\s+time\b",
            r"\btime\s+now\b",
            r"\bright\s+now\b",
        ]
        return any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in patterns)

    def _build_date_time_answer(self, *, message: str, server_time: dict[str, str]) -> str:
        if "time" in message.lower():
            return (
                f"Right now it is {server_time['human_local_time']} ({server_time['timezone_local']}). "
                f"Today's date is {server_time['weekday_local']}, {server_time['human_local_date']} "
                f"({server_time['date_local_iso']})."
            )
        return (
            f"Today is {server_time['weekday_local']}, {server_time['human_local_date']} "
            f"({server_time['date_local_iso']})."
        )

    def _parse_json_model(self, raw_output: str, model_cls: type[QuestionRead]) -> QuestionRead | None:
        if not raw_output:
            return None

        candidates = [raw_output]

        fenced_match = re.search(
            r"```json\s*(\{.*?\})\s*```",
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
                return model_cls.model_validate_json(candidate)
            except Exception:
                try:
                    data = json.loads(candidate)
                    return model_cls.model_validate(data)
                except Exception:
                    continue

        return None

    def _model_label(self) -> str:
        if self._settings.agent_provider == "azure":
            return self._settings.azure_openai_chat_deployment_name or "azure-openai-chat"
        return self._settings.openai_model

    def import_error_context(self) -> str:
        if MAF_IMPORT_ERROR is None:
            return "none"
        return f"{MAF_IMPORT_ERROR}; semconv_patched={PATCHED_SEMCONV_ATTRS}"

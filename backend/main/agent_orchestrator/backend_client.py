from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from .af_compat import PATCHED_SEMCONV_ATTRS
from .config import Settings

try:
    from agent_framework import Message as AFMessage
    from agent_framework.a2a import A2AAgent
except Exception as exc:  # pragma: no cover - runtime import guard
    AFMessage = None  # type: ignore[assignment]
    A2AAgent = None  # type: ignore[assignment]
    A2A_IMPORT_ERROR: Exception | None = exc
else:
    A2A_IMPORT_ERROR = None


class A2ABackendError(RuntimeError):
    pass


@dataclass(slots=True)
class BackendCallResult:
    endpoint: str
    status_code: int
    payload: dict[str, Any]


class A2ABackendClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._a2a_agent: Any | None = None

    async def health(self) -> dict[str, Any]:
        url = f"{self._settings.a2a_backend_base_url.rstrip('/')}/health"
        result = await self._get_json(url)
        return result.payload

    async def create_character(self, payload: dict[str, Any]) -> BackendCallResult:
        if self._settings.a2a_use_protocol:
            return await self._invoke_via_a2a(operation="create", payload=payload)
        return await self._post_json(self._settings.a2a_create_url, payload)

    async def regenerate_image(self, payload: dict[str, Any]) -> BackendCallResult:
        if self._settings.a2a_use_protocol:
            return await self._invoke_via_a2a(operation="regenerate", payload=payload)
        return await self._post_json(self._settings.a2a_regenerate_url, payload)

    async def protocol_healthcheck(self) -> BackendCallResult:
        if self._settings.a2a_use_protocol:
            return await self._invoke_via_a2a(
                operation="healthcheck",
                payload={"operation": "healthcheck"},
            )
        return await self._get_json(f"{self._settings.a2a_backend_base_url.rstrip('/')}/health")

    async def stream_operation(
        self,
        operation: str,
        payload: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        if self._settings.a2a_use_protocol:
            async for event in self._stream_via_a2a(operation=operation, payload=payload):
                yield event
            return

        # Non-A2A fallback: emit a compact pseudo-stream with start/final.
        yield {
            "type": "status",
            "message": "A2A protocol disabled; using HTTP fallback.",
            "endpoint": self._settings.a2a_create_url
            if operation == "create"
            else self._settings.a2a_regenerate_url,
        }
        result = (
            await self._post_json(self._settings.a2a_create_url, payload)
            if operation == "create"
            else await self._post_json(self._settings.a2a_regenerate_url, payload)
        )
        yield {
            "type": "final",
            "endpoint": result.endpoint,
            "status_code": result.status_code,
            "payload": result.payload,
        }

    async def _invoke_via_a2a(self, operation: str, payload: dict[str, Any]) -> BackendCallResult:
        if A2A_IMPORT_ERROR is not None or AFMessage is None or A2AAgent is None:
            raise A2ABackendError(
                f"A2A client import failed: {A2A_IMPORT_ERROR}. semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        if self._a2a_agent is None:
            self._a2a_agent = A2AAgent(
                url=self._settings.a2a_rpc_url,
                timeout=self._settings.a2a_timeout_seconds,
                name="dream-backend-a2a-client",
            )

        summary_text = (
            str(payload.get("user_prompt") or "").strip()
            or str(payload.get("positive_prompt") or "").strip()
            or f"{operation} character request"
        )

        request_message = AFMessage(
            role="user",
            text=summary_text,
            additional_properties={
                "operation": operation,
                "payload": payload,
            },
        )

        try:
            response = await self._a2a_agent.run(request_message)
        except Exception as exc:
            raise A2ABackendError(f"A2A protocol call failed for {self._settings.a2a_rpc_url}: {exc}") from exc

        parsed_payload = self._extract_json_payload_from_agent_response(response)
        if parsed_payload is None:
            raise A2ABackendError(
                "A2A protocol response could not be parsed as JSON payload. "
                f"response_text_preview={(response.text or '')[:800]}"
            )

        return BackendCallResult(
            endpoint=self._settings.a2a_rpc_url,
            status_code=200,
            payload=parsed_payload,
        )

    async def _stream_via_a2a(
        self,
        operation: str,
        payload: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        if A2A_IMPORT_ERROR is not None or AFMessage is None or A2AAgent is None:
            raise A2ABackendError(
                f"A2A client import failed: {A2A_IMPORT_ERROR}. semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        if self._a2a_agent is None:
            self._a2a_agent = A2AAgent(
                url=self._settings.a2a_rpc_url,
                timeout=self._settings.a2a_timeout_seconds,
                name="dream-backend-a2a-client",
            )

        summary_text = (
            str(payload.get("user_prompt") or "").strip()
            or str(payload.get("positive_prompt") or "").strip()
            or f"{operation} character request"
        )

        request_message = AFMessage(
            role="user",
            text=summary_text,
            additional_properties={
                "operation": operation,
                "payload": payload,
            },
        )

        try:
            response_stream = self._a2a_agent.run(request_message, stream=True)
            async for update in response_stream:
                yield {
                    "type": "update",
                    "message": self._summarize_stream_update(update),
                }
            final_response = await response_stream.get_final_response()
        except Exception as exc:
            raise A2ABackendError(
                f"A2A protocol streaming call failed for {self._settings.a2a_rpc_url}: {exc}"
            ) from exc

        parsed_payload = self._extract_json_payload_from_agent_response(final_response)
        if parsed_payload is None:
            raise A2ABackendError(
                "A2A streaming final response could not be parsed as JSON payload. "
                f"response_text_preview={(getattr(final_response, 'text', '') or '')[:800]}"
            )

        yield {
            "type": "final",
            "endpoint": self._settings.a2a_rpc_url,
            "status_code": 200,
            "payload": parsed_payload,
        }

    def _summarize_stream_update(self, update: Any) -> str:
        texts: list[str] = []
        contents = getattr(update, "contents", None)
        if isinstance(contents, list):
            for content in contents:
                if getattr(content, "type", None) == "text":
                    text_value = getattr(content, "text", None)
                    if isinstance(text_value, str) and text_value.strip():
                        texts.append(text_value.strip())

        raw_state: str | None = None
        raw_repr = getattr(update, "raw_representation", None)
        status = getattr(raw_repr, "status", None)
        state = getattr(status, "state", None)
        if state is not None:
            raw_state = str(state)

        continuation_token = getattr(update, "continuation_token", None)
        has_continuation = continuation_token is not None

        if texts:
            return " | ".join(texts)[:600]
        if raw_state and has_continuation:
            return f"A2A task state={raw_state}; continuation token available."
        if raw_state:
            return f"A2A task state={raw_state}."
        if has_continuation:
            return "A2A task update with continuation token."
        return "A2A streaming update received."

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

        direct = text.strip()
        try:
            data = json.loads(direct)
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

    async def _post_json(self, url: str, payload: dict[str, Any]) -> BackendCallResult:
        timeout = httpx.Timeout(self._settings.a2a_timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            raise A2ABackendError(f"A2A backend call failed for {url}: {exc}") from exc

        if response.status_code >= 400:
            body_preview = response.text[:1200]
            raise A2ABackendError(
                f"A2A backend returned {response.status_code} for {url}: {body_preview}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise A2ABackendError(f"A2A backend returned non-JSON response for {url}.") from exc

        if not isinstance(body, dict):
            raise A2ABackendError(f"A2A backend response for {url} is not a JSON object.")

        return BackendCallResult(endpoint=url, status_code=response.status_code, payload=body)

    async def _get_json(self, url: str) -> BackendCallResult:
        timeout = httpx.Timeout(self._settings.a2a_timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
        except httpx.HTTPError as exc:
            raise A2ABackendError(f"A2A backend call failed for {url}: {exc}") from exc

        if response.status_code >= 400:
            body_preview = response.text[:1200]
            raise A2ABackendError(
                f"A2A backend returned {response.status_code} for {url}: {body_preview}"
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise A2ABackendError(f"A2A backend returned non-JSON response for {url}.") from exc

        if not isinstance(body, dict):
            raise A2ABackendError(f"A2A backend response for {url} is not a JSON object.")

        return BackendCallResult(endpoint=url, status_code=response.status_code, payload=body)

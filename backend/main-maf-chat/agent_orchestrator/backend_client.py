from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

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

try:
    from a2a.client.transports.jsonrpc import JsonRpcTransport
    from a2a.types import (
        Message as A2AMessage,
        MessageSendConfiguration,
        MessageSendParams,
        Part as A2APart,
        Role as A2ARole,
        TaskArtifactUpdateEvent,
        TaskStatusUpdateEvent,
        TextPart as A2ATextPart,
    )
except Exception as exc:  # pragma: no cover - runtime import guard
    JsonRpcTransport = None  # type: ignore[assignment]
    A2AMessage = None  # type: ignore[assignment]
    MessageSendConfiguration = None  # type: ignore[assignment]
    MessageSendParams = None  # type: ignore[assignment]
    A2APart = None  # type: ignore[assignment]
    A2ARole = None  # type: ignore[assignment]
    TaskArtifactUpdateEvent = None  # type: ignore[assignment]
    TaskStatusUpdateEvent = None  # type: ignore[assignment]
    A2ATextPart = None  # type: ignore[assignment]
    A2A_SDK_IMPORT_ERROR: Exception | None = exc
else:
    A2A_SDK_IMPORT_ERROR = None


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
        self._a2a_story_agent: Any | None = None

    async def health(self) -> dict[str, Any]:
        url = f"{self._settings.a2a_backend_base_url.rstrip('/')}/health"
        result = await self._get_json(url)
        return result.payload

    async def create_character(self, payload: dict[str, Any]) -> BackendCallResult:
        self._require_a2a_enabled(self._settings.a2a_use_protocol, "A2A_USE_PROTOCOL")
        return await self._invoke_via_a2a(operation="create", payload=payload)

    async def regenerate_image(self, payload: dict[str, Any]) -> BackendCallResult:
        self._require_a2a_enabled(self._settings.a2a_use_protocol, "A2A_USE_PROTOCOL")
        return await self._invoke_via_a2a(operation="regenerate", payload=payload)

    async def create_storybook(self, payload: dict[str, Any]) -> BackendCallResult:
        self._require_a2a_enabled(self._settings.a2a_story_use_protocol, "A2A_STORY_USE_PROTOCOL")
        return await self._invoke_story_via_a2a(operation="story_create", payload=payload)

    async def storybook_health(self) -> BackendCallResult:
        self._require_a2a_enabled(self._settings.a2a_story_use_protocol, "A2A_STORY_USE_PROTOCOL")
        return await self._invoke_story_via_a2a(
            operation="healthcheck",
            payload={"operation": "healthcheck"},
        )

    async def protocol_healthcheck(self) -> BackendCallResult:
        self._require_a2a_enabled(self._settings.a2a_use_protocol, "A2A_USE_PROTOCOL")
        return await self._invoke_via_a2a(
            operation="healthcheck",
            payload={"operation": "healthcheck"},
        )

    async def stream_operation(
        self,
        operation: str,
        payload: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        self._require_a2a_enabled(self._settings.a2a_use_protocol, "A2A_USE_PROTOCOL")
        async for event in self._stream_via_a2a(operation=operation, payload=payload):
            yield event

    async def stream_storybook_operation(
        self,
        payload: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        self._require_a2a_enabled(self._settings.a2a_story_use_protocol, "A2A_STORY_USE_PROTOCOL")
        async for event in self._stream_story_via_a2a(operation="story_create", payload=payload):
            yield event

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

    async def _invoke_story_via_a2a(self, operation: str, payload: dict[str, Any]) -> BackendCallResult:
        if A2A_IMPORT_ERROR is not None or AFMessage is None or A2AAgent is None:
            raise A2ABackendError(
                f"A2A client import failed: {A2A_IMPORT_ERROR}. semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        if self._a2a_story_agent is None:
            self._a2a_story_agent = A2AAgent(
                url=self._settings.a2a_story_rpc_url,
                timeout=self._settings.a2a_timeout_seconds,
                name="dream-storybook-a2a-client",
            )

        summary_text = (
            str(payload.get("user_prompt") or "").strip()
            or f"{operation} storybook request"
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
            response = await self._a2a_story_agent.run(request_message)
        except Exception as exc:
            raise A2ABackendError(
                f"A2A story protocol call failed for {self._settings.a2a_story_rpc_url}: {exc}"
            ) from exc

        parsed_payload = self._extract_json_payload_from_agent_response(response)
        if parsed_payload is None:
            raise A2ABackendError(
                "A2A story protocol response could not be parsed as JSON payload. "
                f"response_text_preview={(response.text or '')[:800]}"
            )

        return BackendCallResult(
            endpoint=self._settings.a2a_story_rpc_url,
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

    async def _stream_story_via_a2a(
        self,
        operation: str,
        payload: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        if (
            A2A_SDK_IMPORT_ERROR is not None
            or JsonRpcTransport is None
            or A2AMessage is None
            or MessageSendConfiguration is None
            or MessageSendParams is None
            or A2APart is None
            or A2ARole is None
            or A2ATextPart is None
        ):
            raise A2ABackendError(
                "A2A story streaming client import failed: "
                f"{A2A_SDK_IMPORT_ERROR}. semconv_patched={PATCHED_SEMCONV_ATTRS}"
            )

        summary_text = (
            str(payload.get("user_prompt") or "").strip()
            or f"{operation} storybook request"
        )

        metadata: dict[str, Any] = {
            "operation": operation,
            "payload": payload,
        }

        request_message = A2AMessage(
            role=A2ARole.user,
            message_id=str(uuid4()),
            metadata=metadata,
            parts=[
                A2APart(
                    root=A2ATextPart(
                        text=summary_text,
                        metadata=metadata,
                    )
                )
            ],
        )
        request_config = MessageSendConfiguration(
            blocking=True,
            accepted_output_modes=["application/json", "text/plain"],
        )
        request_params = MessageSendParams(
            message=request_message,
            configuration=request_config,
            metadata=metadata,
        )

        final_payload: dict[str, Any] | None = None
        last_known_state = "unknown"
        result_artifact_parts: list[str] = []
        result_artifact_seen = False

        timeout_seconds = self._settings.a2a_timeout_seconds
        timeout = httpx.Timeout(
            connect=timeout_seconds,
            read=None,
            write=timeout_seconds,
            pool=timeout_seconds,
        )
        try:
            async with httpx.AsyncClient(timeout=timeout) as http_client:
                transport = JsonRpcTransport(
                    httpx_client=http_client,
                    url=self._settings.a2a_story_rpc_url,
                )
                async for stream_event in transport.send_message_streaming(request_params):
                    if (
                        TaskStatusUpdateEvent is not None
                        and isinstance(stream_event, TaskStatusUpdateEvent)
                    ):
                        raw_state = str(stream_event.status.state)
                        state = raw_state.split(".")[-1].strip().lower() or raw_state
                        last_known_state = state
                        status_message = self._extract_status_message_text(stream_event)
                        message = (
                            status_message
                            or f"A2A task state changed to {state}."
                        )
                        yield {
                            "type": "status",
                            "state": state,
                            "message": message,
                        }
                        continue

                    if (
                        TaskArtifactUpdateEvent is not None
                        and isinstance(stream_event, TaskArtifactUpdateEvent)
                    ):
                        artifact = stream_event.artifact
                        artifact_name = str(artifact.name or "").strip().lower()
                        text_parts = self._extract_text_parts_from_a2a_parts(artifact.parts)

                        if artifact_name == "storybook-workflow-progress":
                            for text_part in text_parts:
                                progress_payload = self._parse_json_like_text(text_part)
                                if (
                                    isinstance(progress_payload, dict)
                                    and str(progress_payload.get("kind") or "").lower() == "progress"
                                ):
                                    yield {
                                        "type": "progress",
                                        "stage": str(progress_payload.get("stage") or "progress"),
                                        "message": str(progress_payload.get("message") or "Progress update."),
                                        "data": (
                                            progress_payload.get("data")
                                            if isinstance(progress_payload.get("data"), dict)
                                            else None
                                        ),
                                    }
                                else:
                                    yield {
                                        "type": "update",
                                        "message": text_part,
                                    }
                            continue

                        if artifact_name == "storybook-workflow-result":
                            result_artifact_seen = True
                            for text_part in text_parts:
                                result_artifact_parts.append(text_part)

                            parsed_result = self._parse_json_like_text("".join(result_artifact_parts))
                            if isinstance(parsed_result, dict):
                                final_payload = parsed_result
                            continue

                        if artifact_name == "storybook-workflow-error":
                            error_payload = self._parse_json_like_text("".join(text_parts))
                            if isinstance(error_payload, dict):
                                detail = str(error_payload.get("detail") or "Unknown error.")
                            else:
                                detail = " ".join(text_parts).strip() or "Unknown error."
                            raise A2ABackendError(
                                f"A2A story backend reported an error artifact: {detail}"
                            )

                        combined = " ".join(part for part in text_parts if part.strip())
                        if combined:
                            yield {
                                "type": "update",
                                "message": combined,
                            }
                        continue

                    fallback_message = f"A2A story streaming update received ({type(stream_event).__name__})."
                    yield {
                        "type": "status",
                        "state": last_known_state,
                        "message": fallback_message,
                    }
        except Exception as exc:
            raw_error = str(exc)
            if (
                "Invalid SSE response or protocol error" in raw_error
                and "application/json" in raw_error
            ):
                probe_detail = ""
                try:
                    async with httpx.AsyncClient(timeout=timeout) as probe_http_client:
                        probe_transport = JsonRpcTransport(
                            httpx_client=probe_http_client,
                            url=self._settings.a2a_story_rpc_url,
                        )
                        await probe_transport.send_message(request_params)
                except Exception as probe_exc:  # pragma: no cover - defensive probe for clearer diagnostics
                    probe_detail = f" JSON-RPC detail: {probe_exc}"

                raise A2ABackendError(
                    f"A2A story streaming call failed for {self._settings.a2a_story_rpc_url}: {exc}. "
                    "The backend returned JSON instead of SSE, which usually means the request was rejected before streaming "
                    f"(commonly payload too large).{probe_detail}"
                ) from exc

            raise A2ABackendError(
                f"A2A story streaming call failed for {self._settings.a2a_story_rpc_url}: {exc}"
            ) from exc

        if result_artifact_seen and final_payload is None:
            raise A2ABackendError(
                "A2A story stream received result artifact but could not parse it as JSON."
            )

        if final_payload is None:
            raise A2ABackendError(
                "A2A story stream ended without a parsed final payload artifact."
            )

        yield {
            "type": "final",
            "endpoint": self._settings.a2a_story_rpc_url,
            "status_code": 200,
            "payload": final_payload,
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

    def _extract_status_message_text(self, event: Any) -> str:
        status = getattr(event, "status", None)
        message_obj = getattr(status, "message", None) if status is not None else None
        parts = getattr(message_obj, "parts", None)
        if not isinstance(parts, list):
            return ""

        chunks: list[str] = []
        for part in parts:
            root = getattr(part, "root", None)
            text_value = getattr(root, "text", None)
            if isinstance(text_value, str) and text_value.strip():
                chunks.append(text_value.strip())
        return " ".join(chunks).strip()

    def _extract_text_parts_from_a2a_parts(self, parts: list[Any]) -> list[str]:
        texts: list[str] = []
        for part in parts:
            root = getattr(part, "root", None)
            text_value = getattr(root, "text", None)
            if isinstance(text_value, str):
                stripped = text_value.strip()
                if stripped:
                    texts.append(stripped)
        return texts

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

    def _require_a2a_enabled(self, enabled: bool, flag_name: str) -> None:
        if enabled:
            return
        raise A2ABackendError(f"A2A-only mode: {flag_name} must be true.")

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

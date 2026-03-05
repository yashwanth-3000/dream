from __future__ import annotations

import json
import re
from collections.abc import Iterator
from typing import Any

import httpx

from ..af_compat import PATCHED_SEMCONV_ATTRS  # noqa: F401
from ..config import Settings
from .models import Citation, RetrievalDiagnostics, RetrievalResult

try:
    from azure.identity.aio import DefaultAzureCredential
except Exception:  # pragma: no cover - optional dependency
    DefaultAzureCredential = None  # type: ignore[assignment]


class AzureSearchMCPRetriever:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def retrieve(self, *, query: str) -> RetrievalResult:
        if not self._settings.azure_search_mcp_enabled:
            return RetrievalResult(
                provider="azure_search_mcp",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_mcp",
                    errors=["AZURE_SEARCH_MCP_ENABLED is false."],
                ),
            )

        mcp_url = self._settings.azure_search_mcp_url
        if not mcp_url:
            return RetrievalResult(
                provider="azure_search_mcp",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_mcp",
                    errors=[
                        "Azure Search MCP URL is not configured. "
                        "Set AZURE_SEARCH_SERVICE_ENDPOINT and AZURE_SEARCH_KNOWLEDGE_BASE_NAME."
                    ],
                ),
            )

        timeout_seconds = self._settings.azure_search_mcp_timeout_seconds

        auth_headers, auth_error = await self._build_auth_headers()
        if auth_error:
            return RetrievalResult(
                provider="azure_search_mcp",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_mcp",
                    errors=[auth_error],
                ),
            )

        headers = {**auth_headers, "content-type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds, headers=headers) as http_client:
                initialize_response = await self._rpc_request(
                    http_client=http_client,
                    mcp_url=mcp_url,
                    rpc_id=1,
                    method="initialize",
                    params={
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {
                            "name": "dream-orchestrator",
                            "version": "1.0.0",
                        },
                    },
                )
                tools_response = await self._rpc_request(
                    http_client=http_client,
                    mcp_url=mcp_url,
                    rpc_id=2,
                    method="tools/list",
                    params={},
                )
                raw_packet = await self._call_retrieve_tool(
                    http_client=http_client,
                    mcp_url=mcp_url,
                    tools_response=tools_response,
                    query=query,
                )

            raw_packet["initialize"] = initialize_response
            raw_packet["tools_list"] = tools_response

            output = raw_packet.get("output")
            citations = self._to_citations(output, source="azure_search_mcp")
            evidence = [c.snippet for c in citations if c.snippet][:6]
            errors: list[str] = []
            if raw_packet.get("error"):
                errors.append(str(raw_packet["error"]))
            if not citations:
                errors.append("knowledge_base_retrieve returned no parseable evidence.")

            return RetrievalResult(
                provider="azure_search_mcp",
                citations=citations,
                evidence=evidence,
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_mcp",
                    errors=errors,
                    raw=raw_packet,
                ),
            )
        except Exception as exc:
            return RetrievalResult(
                provider="azure_search_mcp",
                citations=[],
                evidence=[],
                diagnostics=RetrievalDiagnostics(
                    provider="azure_search_mcp",
                    errors=[f"Azure Search MCP retrieval failed: {exc}"],
                ),
            )

    async def _build_auth_headers(self) -> tuple[dict[str, str], str | None]:
        if self._settings.azure_search_use_managed_identity:
            if DefaultAzureCredential is None:
                return {}, (
                    "AZURE_SEARCH_USE_MANAGED_IDENTITY=true but azure-identity is unavailable. "
                    "Install azure-identity in this runtime."
                )
            credential = DefaultAzureCredential()
            try:
                token = await credential.get_token("https://search.azure.com/.default")
            except Exception as exc:
                return {}, f"Managed identity token request failed for Azure Search MCP: {exc}"
            finally:
                try:
                    await credential.close()
                except Exception:
                    pass
            return {"Authorization": f"Bearer {token.token}"}, None

        api_key = (self._settings.azure_search_api_key or "").strip()
        if api_key:
            return {"api-key": api_key}, None

        return {}, (
            "Azure Search MCP credentials are missing. Provide AZURE_SEARCH_API_KEY "
            "or set AZURE_SEARCH_USE_MANAGED_IDENTITY=true."
        )

    async def _rpc_request(
        self,
        *,
        http_client: httpx.AsyncClient,
        mcp_url: str,
        rpc_id: int,
        method: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": rpc_id,
            "method": method,
            "params": params,
        }
        response = await http_client.post(mcp_url, json=payload)
        response.raise_for_status()

        parsed = self._parse_sse_jsonrpc(response.text)
        if parsed is not None:
            return parsed

        return {
            "jsonrpc": "2.0",
            "id": rpc_id,
            "error": {
                "message": "MCP response could not be parsed as JSON-RPC envelope.",
                "raw": response.text,
            },
        }

    def _parse_sse_jsonrpc(self, raw: str) -> dict[str, Any] | None:
        envelopes: list[dict[str, Any]] = []
        for line in (raw or "").splitlines():
            if not line.startswith("data:"):
                continue
            data = line[len("data:") :].strip()
            if not data:
                continue
            try:
                parsed = json.loads(data)
            except Exception:
                continue
            if isinstance(parsed, dict):
                envelopes.append(parsed)

        if envelopes:
            return envelopes[-1]

        try:
            fallback = json.loads(raw)
        except Exception:
            return None
        return fallback if isinstance(fallback, dict) else None

    async def _call_retrieve_tool(
        self,
        *,
        http_client: httpx.AsyncClient,
        mcp_url: str,
        tools_response: dict[str, Any],
        query: str,
    ) -> dict[str, Any]:
        tools = self._extract_tool_names(tools_response)
        if not tools:
            return {"tools": [], "query": query, "error": "No MCP tools were exposed by server."}

        preferred = next((name for name in tools if "knowledge_base_retrieve" in name), tools[0])
        attempts: list[dict[str, Any]] = [
            {"request": {"knowledgeBaseIntents": [query]}},
            {"request": {"knowledgeBaseIntents": [query, f"{query} source citations"]}},
            {"query": query},
            {"search_query": query},
            {"q": query},
            {"input": query},
            {"request": {"query": query}},
        ]

        last_error = ""
        for idx, kwargs in enumerate(attempts, start=1):
            try:
                call_response = await self._rpc_request(
                    http_client=http_client,
                    mcp_url=mcp_url,
                    rpc_id=10 + idx,
                    method="tools/call",
                    params={
                        "name": preferred,
                        "arguments": kwargs,
                    },
                )
                output, is_error, error_text = self._extract_call_output(call_response)
                if is_error:
                    last_error = error_text or "MCP tools/call returned isError=true."
                    continue
                return {
                    "tools": tools,
                    "tool_used": preferred,
                    "input": kwargs,
                    "output": output,
                    "rpc": call_response,
                }
            except Exception as exc:
                last_error = str(exc)

        return {
            "tools": tools,
            "tool_used": preferred,
            "input": attempts[0],
            "error": last_error or "MCP tool call failed.",
            "output": None,
        }

    def _extract_tool_names(self, tools_response: dict[str, Any]) -> list[str]:
        result = tools_response.get("result") if isinstance(tools_response, dict) else None
        if not isinstance(result, dict):
            return []
        tools = result.get("tools")
        if not isinstance(tools, list):
            return []

        names: list[str] = []
        for item in tools:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if name:
                names.append(name)
        return names

    def _extract_call_output(self, call_response: dict[str, Any]) -> tuple[Any, bool, str | None]:
        if not isinstance(call_response, dict):
            return None, True, "MCP tools/call response is not a JSON object."

        rpc_error = call_response.get("error")
        if isinstance(rpc_error, dict):
            message = str(rpc_error.get("message") or "").strip() or "MCP tools/call returned error."
            return None, True, message

        result = call_response.get("result")
        if not isinstance(result, dict):
            return result, False, None

        content = result.get("content")
        output = self._extract_content_payload(content)
        is_error = bool(result.get("isError"))
        if is_error:
            message = self._extract_content_text(content) or "MCP tools/call returned isError=true."
            return output, True, message

        return (output if output is not None else result), False, None

    def _extract_content_payload(self, content: Any) -> Any:
        if not isinstance(content, list):
            return None

        structured_items: list[Any] = []
        text_items: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if str(item.get("type") or "").strip().lower() != "text":
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            try:
                structured_items.append(json.loads(text))
                continue
            except Exception:
                text_items.append(text)

        if structured_items:
            return structured_items[0] if len(structured_items) == 1 else structured_items
        if text_items:
            return text_items[0] if len(text_items) == 1 else text_items
        return None

    def _extract_content_text(self, content: Any) -> str:
        if not isinstance(content, list):
            return ""
        parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if str(item.get("type") or "").strip().lower() != "text":
                continue
            text = str(item.get("text") or "").strip()
            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    def _to_citations(self, payload: Any, *, source: str) -> list[Citation]:
        if payload is None:
            return []

        records = list(self._iter_candidate_records(payload))
        citations: list[Citation] = []
        seen: set[str] = set()

        for record in records:
            title = self._pick_first(record, [
                "title",
                "document_title",
                "source_title",
                "name",
            ])
            url = self._pick_first(record, [
                "url",
                "source_url",
                "document_url",
                "source",
                "uri",
            ])
            snippet = self._pick_first(record, [
                "snippet",
                "content",
                "chunk",
                "chunk_text",
                "text",
                "passage",
                "answer",
            ])
            published_date = self._pick_first(record, [
                "published_date",
                "publish_date",
                "date",
                "last_updated",
            ])
            score = self._pick_first_number(record, [
                "score",
                "reranker_score",
                "@search.score",
                "@search.rerankerScore",
            ])

            if not title and not url and not snippet:
                continue

            clean_title = (title or "Untitled source").strip()
            clean_url = self._normalize_url(url)
            clean_snippet = self._normalize_snippet(snippet)
            dedupe_key = f"{clean_title.lower()}|{(clean_url or '').lower()}|{clean_snippet.lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            citations.append(
                Citation(
                    title=clean_title,
                    url=clean_url,
                    snippet=clean_snippet or None,
                    published_date=(published_date or "").strip() or None,
                    source=source,
                    score=score,
                )
            )
            if len(citations) >= self._settings.azure_search_top_k:
                break

        return citations

    def _iter_candidate_records(self, payload: Any) -> Iterator[dict[str, Any]]:
        if isinstance(payload, str):
            stripped = payload.strip()
            if not stripped:
                return
            try:
                parsed = json.loads(stripped)
            except Exception:
                for record in self._parse_text_records(stripped):
                    yield record
                return
            yield from self._iter_candidate_records(parsed)
            return

        if isinstance(payload, list):
            for item in payload:
                yield from self._iter_candidate_records(item)
            return

        if not isinstance(payload, dict):
            return

        if self._looks_like_result_record(payload):
            yield payload

        for value in payload.values():
            yield from self._iter_candidate_records(value)

    def _parse_text_records(self, text: str) -> Iterator[dict[str, Any]]:
        line_pattern = re.compile(
            r"Title:[^\S\n]*(.+?)\n(?:URL:[^\S\n]*(https?://\S+)\n)?(?:Text:[^\S\n]*([\s\S]*?))?(?=\nTitle:\s|$)",
            flags=re.IGNORECASE,
        )
        for match in line_pattern.finditer(text):
            title = (match.group(1) or "").strip()
            url = (match.group(2) or "").strip()
            snippet = (match.group(3) or "").strip()
            if title or url or snippet:
                yield {
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                }

    def _looks_like_result_record(self, record: dict[str, Any]) -> bool:
        keys = {str(key).lower() for key in record.keys()}
        has_text = bool(
            {
                "snippet",
                "content",
                "chunk",
                "chunk_text",
                "text",
                "passage",
                "answer",
            }
            & keys
        )
        has_source = bool(
            {
                "url",
                "source_url",
                "document_url",
                "source",
                "uri",
                "title",
                "document_title",
                "source_title",
                "name",
            }
            & keys
        )
        return has_text or has_source

    def _pick_first(self, record: dict[str, Any], candidate_keys: list[str]) -> str:
        for key in candidate_keys:
            if key in record and isinstance(record[key], str):
                value = record[key].strip()
                if value:
                    return value

        lowered = {str(k).lower(): k for k in record.keys()}
        for key in candidate_keys:
            origin = lowered.get(key.lower())
            if origin is None:
                continue
            value = record.get(origin)
            if isinstance(value, str) and value.strip():
                return value.strip()

        return ""

    def _pick_first_number(self, record: dict[str, Any], candidate_keys: list[str]) -> float | None:
        lowered = {str(k).lower(): k for k in record.keys()}
        for key in candidate_keys:
            for probe in (key, key.lower()):
                origin = probe if probe in record else lowered.get(probe)
                if origin is None:
                    continue
                value = record.get(origin)
                if isinstance(value, (int, float)):
                    return float(value)
        return None

    def _normalize_url(self, value: str) -> str | None:
        clean = (value or "").strip()
        if not clean:
            return None
        if clean.startswith("http://") or clean.startswith("https://"):
            return clean
        return None

    def _normalize_snippet(self, value: str) -> str:
        clean = re.sub(r"\s+", " ", (value or "")).strip()
        if len(clean) <= 360:
            return clean
        return f"{clean[:359]}..."

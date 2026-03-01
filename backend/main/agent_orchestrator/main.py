from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from .backend_client import A2ABackendClient, A2ABackendError
from .config import Settings, get_settings
from .maf_router import MAFRoutingAgent
from .models import (
    CharacterOrchestrationRequest,
    CharacterOrchestrationResponse,
    ServiceHealthResponse,
    StoryBookOrchestrationRequest,
    StoryBookOrchestrationResponse,
)

app = FastAPI(
    title="Dream Microsoft Agent Framework Orchestrator",
    version="0.1.0",
    description=(
        "Agent Framework orchestrator that routes character and storybook requests to specialized "
        "A2A backends."
    ),
)


def _build_backend_payload(
    payload: CharacterOrchestrationRequest,
    selected_action: str,
) -> dict[str, object]:
    world_references = [r.model_dump(mode="json", exclude_none=True) for r in payload.world_references]
    character_drawings = [d.model_dump(mode="json", exclude_none=True) for d in payload.character_drawings]

    if selected_action == "create":
        if not payload.user_prompt or not payload.user_prompt.strip():
            raise HTTPException(
                status_code=422,
                detail="user_prompt is required for create action.",
            )
        return {
            "user_prompt": payload.user_prompt,
            "world_references": world_references,
            "character_drawings": character_drawings,
            "force_workflow": payload.force_workflow,
        }

    if selected_action == "regenerate":
        if not payload.positive_prompt or not payload.positive_prompt.strip():
            raise HTTPException(
                status_code=422,
                detail="positive_prompt is required for regenerate action.",
            )
        return {
            "positive_prompt": payload.positive_prompt,
            "negative_prompt": payload.negative_prompt,
            "world_references": world_references,
            "character_drawings": character_drawings,
        }

    raise HTTPException(
        status_code=422,
        detail=f"Unsupported selected_action: {selected_action}",
    )


def _build_story_backend_payload(payload: StoryBookOrchestrationRequest) -> dict[str, object]:
    world_references = [r.model_dump(mode="json", exclude_none=True) for r in payload.world_references]
    character_drawings = [d.model_dump(mode="json", exclude_none=True) for d in payload.character_drawings]

    return {
        "user_prompt": payload.user_prompt.strip(),
        "world_references": world_references,
        "character_drawings": character_drawings,
        "force_workflow": payload.force_workflow,
        "max_characters": payload.max_characters,
        "tone": payload.tone,
        "age_band": payload.age_band,
    }


def _parse_json_object(raw: str) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def _looks_like_final_payload(payload: dict[str, object]) -> bool:
    final_keys = {
        "workflow_used",
        "story",
        "spreads",
        "generated_images",
        "scene_prompts",
        "characters",
    }
    return any(key in payload for key in final_keys)


def _extract_progress_payload(payload: dict[str, object]) -> dict[str, object] | None:
    kind_value = str(payload.get("kind") or "").strip().lower()
    if kind_value != "progress":
        return None
    progress: dict[str, object] = {
        "type": "progress",
        "source": "backend",
        "stage": str(payload.get("stage") or "progress"),
        "message": str(payload.get("message") or "Progress update received."),
    }
    data = payload.get("data")
    if isinstance(data, dict):
        progress["data"] = data
    return progress


@app.get("/health", response_model=ServiceHealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> ServiceHealthResponse:
    backend = A2ABackendClient(settings)
    try:
        backend_health = await backend.health()
        return ServiceHealthResponse(
            status="ok",
            agent_provider=settings.agent_provider,
            a2a_protocol_enabled=settings.a2a_use_protocol,
            a2a_rpc_url=settings.a2a_rpc_url,
            backend_connected=True,
            backend_health=backend_health,
            backend_error=None,
        )
    except Exception as exc:
        return ServiceHealthResponse(
            status="ok",
            agent_provider=settings.agent_provider,
            a2a_protocol_enabled=settings.a2a_use_protocol,
            a2a_rpc_url=settings.a2a_rpc_url,
            backend_connected=False,
            backend_health=None,
            backend_error=str(exc),
        )


@app.get("/api/v1/orchestrate/a2a-health")
async def a2a_protocol_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    backend = A2ABackendClient(settings)
    try:
        result = await backend.protocol_healthcheck()
        return {
            "status": "ok",
            "backend_endpoint": result.endpoint,
            "backend_status_code": result.status_code,
            "backend_response": result.payload,
        }
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/orchestrate/storybook-health")
async def storybook_protocol_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    backend = A2ABackendClient(settings)
    try:
        result = await backend.storybook_health()
        return {
            "status": "ok",
            "backend_endpoint": result.endpoint,
            "backend_status_code": result.status_code,
            "backend_response": result.payload,
        }
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/v1/orchestrate/character", response_model=CharacterOrchestrationResponse)
async def orchestrate_character(
    payload: CharacterOrchestrationRequest,
    settings: Settings = Depends(get_settings),
) -> CharacterOrchestrationResponse:
    router = MAFRoutingAgent(settings)
    backend = A2ABackendClient(settings)

    decision, selected_by, raw_output = await router.decide(payload)

    try:
        backend_payload = _build_backend_payload(payload, decision.selected_action)

        if decision.selected_action == "create":
            result = await backend.create_character(backend_payload)
        else:
            result = await backend.regenerate_image(backend_payload)
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return CharacterOrchestrationResponse(
        selected_action=decision.selected_action,
        selected_by=selected_by,
        agent_reasoning=decision.rationale,
        agent_raw_output=raw_output,
        backend_endpoint=result.endpoint,
        backend_status_code=result.status_code,
        backend_response=result.payload,
    )


@app.post("/api/v1/orchestrate/storybook", response_model=StoryBookOrchestrationResponse)
async def orchestrate_storybook(
    payload: StoryBookOrchestrationRequest,
    settings: Settings = Depends(get_settings),
) -> StoryBookOrchestrationResponse:
    backend = A2ABackendClient(settings)

    try:
        backend_payload = _build_story_backend_payload(payload)
        result = await backend.create_storybook(backend_payload)
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return StoryBookOrchestrationResponse(
        backend_endpoint=result.endpoint,
        backend_status_code=result.status_code,
        backend_response=result.payload,
    )


@app.post("/api/v1/orchestrate/storybook/stream")
async def orchestrate_storybook_stream(
    payload: StoryBookOrchestrationRequest,
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    backend = A2ABackendClient(settings)
    backend_payload = _build_story_backend_payload(payload)

    async def event_stream() -> AsyncIterator[str]:
        yield json.dumps(
            {
                "type": "status",
                "source": "main",
                "message": "Main orchestrator accepted request and started stream.",
            },
            ensure_ascii=True,
        ) + "\n"
        yield json.dumps(
            {
                "type": "status",
                "source": "main",
                "message": "Forwarding request to storybook backend via A2A.",
            },
            ensure_ascii=True,
        ) + "\n"

        try:
            async for event in backend.stream_storybook_operation(backend_payload):
                event_type = str(event.get("type") or "").strip().lower()
                if event_type == "final":
                    yield json.dumps(
                        {
                            "type": "final",
                            "backend_endpoint": event.get("endpoint"),
                            "backend_status_code": event.get("status_code"),
                            "backend_response": event.get("payload"),
                        },
                        ensure_ascii=True,
                    ) + "\n"
                elif event_type == "progress":
                    payload: dict[str, object] = {
                        "type": "progress",
                        "source": "backend",
                        "stage": str(event.get("stage") or "progress"),
                        "message": str(event.get("message") or "Progress update received."),
                    }
                    data = event.get("data")
                    if isinstance(data, dict):
                        payload["data"] = data
                    yield json.dumps(payload, ensure_ascii=True) + "\n"
                elif event_type == "status":
                    payload = {
                        "type": "status",
                        "source": "backend",
                        "state": str(event.get("state") or "").strip().lower() or None,
                        "message": str(event.get("message") or "Backend status update received."),
                    }
                    yield json.dumps(payload, ensure_ascii=True) + "\n"
                elif event_type == "update":
                    raw_message = str(event.get("message") or "Backend update received.")
                    parsed_message = _parse_json_object(raw_message)
                    if isinstance(parsed_message, dict):
                        progress_payload = _extract_progress_payload(parsed_message)
                        if progress_payload is not None:
                            yield json.dumps(progress_payload, ensure_ascii=True) + "\n"
                            continue
                        if _looks_like_final_payload(parsed_message):
                            # Final result payload must only be sent in the dedicated `final` event.
                            continue
                    yield json.dumps(
                        {
                            "type": "update",
                            "source": "backend",
                            "message": raw_message,
                        },
                        ensure_ascii=True,
                    ) + "\n"
                else:
                    yield json.dumps(
                        {
                            "type": "update",
                            "source": "backend",
                            "message": f"Unhandled backend event: {event_type or 'unknown'}",
                        },
                        ensure_ascii=True,
                    ) + "\n"
        except A2ABackendError as exc:
            yield json.dumps(
                {
                    "type": "error",
                    "source": "main",
                    "message": "Storybook stream failed.",
                    "detail": str(exc),
                },
                ensure_ascii=True,
            ) + "\n"
        except Exception as exc:
            yield json.dumps(
                {
                    "type": "error",
                    "source": "main",
                    "message": "Unhandled streaming error.",
                    "detail": str(exc),
                },
                ensure_ascii=True,
            ) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "cache-control": "no-store",
            "x-accel-buffering": "no",
        },
    )

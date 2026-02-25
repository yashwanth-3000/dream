from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException

from .backend_client import A2ABackendClient, A2ABackendError
from .config import Settings, get_settings
from .maf_router import MAFRoutingAgent
from .models import (
    CharacterOrchestrationRequest,
    CharacterOrchestrationResponse,
    ServiceHealthResponse,
)

app = FastAPI(
    title="Dream Microsoft Agent Framework Orchestrator",
    version="0.1.0",
    description=(
        "Agent Framework orchestrator that routes requests to the A2A CrewAI character backend "
        "for full creation or regenerate-only image generation."
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

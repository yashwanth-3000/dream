from __future__ import annotations

import httpx
from fastapi import Depends, FastAPI, HTTPException

from .a2a_server import register_a2a_routes
from .config import Settings, get_settings
from .schemas import ServiceHealthResponse, StoryBookCreationRequest, StoryBookCreationResponse
from .story_workflow import StoryBookWorkflow, StoryWorkflowError

app = FastAPI(
    title="Dream MAF Story Book Maker",
    version="0.1.0",
    description=(
        "Microsoft Agent Framework storybook backend that creates compact story spreads, "
        "runs character + story generation in parallel, and renders story images via Replicate."
    ),
)


@app.on_event("startup")
def setup_a2a_protocol_routes() -> None:
    if getattr(app.state, "a2a_routes_registered", False):
        return
    register_a2a_routes(app=app, settings=get_settings())
    app.state.a2a_routes_registered = True


@app.get("/health", response_model=ServiceHealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> ServiceHealthResponse:
    health_url = f"{settings.character_backend_base_url.rstrip('/')}/health"
    try:
        timeout = httpx.Timeout(settings.character_backend_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(health_url)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                payload = {"raw": str(payload)}

        return ServiceHealthResponse(
            status="ok",
            agent_provider=settings.agent_provider,
            character_backend_connected=True,
            character_backend_health=payload,
            character_backend_error=None,
        )
    except Exception as exc:
        return ServiceHealthResponse(
            status="ok",
            agent_provider=settings.agent_provider,
            character_backend_connected=False,
            character_backend_health=None,
            character_backend_error=str(exc),
        )


@app.post("/api/v1/stories/create", response_model=StoryBookCreationResponse)
async def create_storybook(
    payload: StoryBookCreationRequest,
    settings: Settings = Depends(get_settings),
) -> StoryBookCreationResponse:
    workflow = StoryBookWorkflow(settings=settings)
    try:
        return await workflow.run(payload)
    except StoryWorkflowError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unhandled backend error: {exc}") from exc

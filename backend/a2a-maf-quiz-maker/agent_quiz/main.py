from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException

from .a2a_server import register_a2a_routes
from .config import Settings, get_settings
from .quiz_workflow import QuizWorkflow, QuizWorkflowError
from .schemas import QuizCreationRequest, QuizCreationResponse, ServiceHealthResponse

app = FastAPI(
    title="Dream MAF Quiz Maker",
    version="0.1.0",
    description=(
        "Microsoft Agent Framework quiz backend that generates children-friendly multiple-choice quizzes "
        "with hints and answer explanations."
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
    return ServiceHealthResponse(
        status="ok",
        agent_provider=settings.agent_provider,
    )


@app.post("/api/v1/quizzes/create", response_model=QuizCreationResponse)
async def create_quiz(
    payload: QuizCreationRequest,
    settings: Settings = Depends(get_settings),
) -> QuizCreationResponse:
    workflow = QuizWorkflow(settings=settings)
    try:
        return await workflow.run(payload)
    except QuizWorkflowError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unhandled backend error: {exc}") from exc

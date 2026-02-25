from fastapi import Depends, FastAPI, HTTPException

from app.config import Settings, get_settings
from app.schemas import (
    CharacterCreationRequest,
    CharacterCreationResponse,
    CharacterImageRegenerationRequest,
    CharacterImageRegenerationResponse,
)
from app.workflows.character_creation import CharacterWorkflowDecider, CharacterWorkflowError

app = FastAPI(
    title="Dream Character Workflow API",
    version="0.1.0",
    description=(
        "CrewAI agentic backend for character backstory + detailed image prompt generation "
        "with Replicate image rendering."
    ),
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/characters/create", response_model=CharacterCreationResponse)
def create_character(
    payload: CharacterCreationRequest,
    settings: Settings = Depends(get_settings),
) -> CharacterCreationResponse:
    try:
        workflow = CharacterWorkflowDecider(settings=settings)
        return workflow.run(payload)
    except CharacterWorkflowError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unhandled backend error: {exc}") from exc


@app.post("/api/v1/characters/regenerate-image", response_model=CharacterImageRegenerationResponse)
def regenerate_character_image(
    payload: CharacterImageRegenerationRequest,
    settings: Settings = Depends(get_settings),
) -> CharacterImageRegenerationResponse:
    try:
        workflow = CharacterWorkflowDecider(settings=settings)
        return workflow.run_image_regeneration(payload)
    except CharacterWorkflowError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unhandled backend error: {exc}") from exc

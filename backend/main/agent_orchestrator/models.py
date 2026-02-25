from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


WorkflowType = Literal["reference_enriched", "prompt_only"]
OrchestrationMode = Literal["auto", "create", "regenerate"]
SelectedAction = Literal["create", "regenerate"]
SelectedBy = Literal["agent", "explicit_mode", "rule_fallback"]


class WorldReference(BaseModel):
    title: str | None = None
    description: str | None = None
    url: HttpUrl | None = None
    image_data: str | None = None


class CharacterDrawingReference(BaseModel):
    url: HttpUrl | None = None
    description: str | None = None
    notes: str | None = None
    image_data: str | None = None


class CharacterOrchestrationRequest(BaseModel):
    mode: OrchestrationMode = "auto"
    user_prompt: str | None = Field(default=None, description="User character concept")
    positive_prompt: str | None = Field(
        default=None,
        description="Existing positive image prompt for regenerate-only flow",
    )
    negative_prompt: str | None = None
    world_references: list[WorldReference] = Field(default_factory=list)
    character_drawings: list[CharacterDrawingReference] = Field(default_factory=list)
    force_workflow: WorkflowType | None = None

    @model_validator(mode="after")
    def validate_mode_inputs(self) -> "CharacterOrchestrationRequest":
        has_user_prompt = bool(self.user_prompt and self.user_prompt.strip())
        has_positive_prompt = bool(self.positive_prompt and self.positive_prompt.strip())

        if self.mode == "create" and not has_user_prompt:
            raise ValueError("user_prompt is required when mode=create.")

        if self.mode == "regenerate" and not has_positive_prompt:
            raise ValueError("positive_prompt is required when mode=regenerate.")

        if self.mode == "auto" and not has_user_prompt and not has_positive_prompt:
            raise ValueError("For mode=auto, provide user_prompt or positive_prompt.")

        return self


class AgentDecision(BaseModel):
    selected_action: SelectedAction
    rationale: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class CharacterOrchestrationResponse(BaseModel):
    selected_action: SelectedAction
    selected_by: SelectedBy
    agent_reasoning: str | None = None
    agent_raw_output: str | None = None
    backend_endpoint: str
    backend_status_code: int
    backend_response: dict[str, Any]


class A2AHealthResponse(BaseModel):
    status: str


class ServiceHealthResponse(BaseModel):
    status: str
    agent_provider: str
    a2a_protocol_enabled: bool
    a2a_rpc_url: str
    backend_connected: bool
    backend_health: dict[str, Any] | None = None
    backend_error: str | None = None

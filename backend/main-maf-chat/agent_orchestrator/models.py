from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


WorkflowType = Literal["reference_enriched", "prompt_only"]
OrchestrationMode = Literal["auto", "create", "regenerate"]
SelectedAction = Literal["create", "regenerate"]
SelectedBy = Literal["agent", "explicit_mode", "rule_fallback"]
ChatRole = Literal["user", "assistant"]
ChatMode = Literal["normal", "search"]


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


class StoryBookOrchestrationRequest(BaseModel):
    user_prompt: str = Field(min_length=1, description="Primary storybook concept")
    world_references: list[WorldReference] = Field(default_factory=list)
    character_drawings: list[CharacterDrawingReference] = Field(default_factory=list)
    force_workflow: WorkflowType | None = None
    max_characters: int = Field(default=2, ge=1, le=2)
    tone: str | None = None
    age_band: str | None = None


class StoryBookOrchestrationResponse(BaseModel):
    backend_endpoint: str
    backend_status_code: int
    backend_response: dict[str, Any]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=4000)


class ChatOrchestrationRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, description="Kid's latest question.")
    history: list[ChatMessage] = Field(default_factory=list, description="Recent chat history.")
    age_band: str | None = Field(default=None, max_length=32, description="Optional age hint like 5-8.")
    mode: ChatMode = Field(default="normal", description="Chat mode selected in UI: normal or search.")


class ChatOrchestrationResponse(BaseModel):
    answer: str
    category: str
    safety: str
    reading_level: str
    response_style: str
    model: str
    mcp_used: bool = False
    mcp_server: str | None = None
    mcp_output: dict[str, Any] | None = None


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


# ---------------------------------------------------------------------------
# Job system models
# ---------------------------------------------------------------------------

JobType = Literal["character", "story", "video"]
JobStatus = Literal["queued", "processing", "completed", "failed"]


class JobCreateRequest(BaseModel):
    type: JobType
    title: str = ""
    user_prompt: str = ""
    input_payload: dict[str, Any] = Field(default_factory=dict)
    triggered_by: str = "user"
    engine: str = ""


class JobResponse(BaseModel):
    id: str
    type: str
    status: str
    title: str
    user_prompt: str
    input_payload: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] = Field(default_factory=dict)
    progress: float = 0.0
    current_step: str = ""
    error_message: str = ""
    triggered_by: str = "user"
    engine: str = ""
    assets: list[dict[str, Any]] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


class JobEventResponse(BaseModel):
    id: str
    job_id: str
    event_type: str
    level: str
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str = ""

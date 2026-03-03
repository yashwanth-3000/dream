from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


WorkflowType = Literal["reference_enriched", "prompt_only"]


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


class StoryBookCreationRequest(BaseModel):
    user_prompt: str = Field(min_length=1, description="Primary story concept from user")
    world_references: list[WorldReference] = Field(default_factory=list)
    character_drawings: list[CharacterDrawingReference] = Field(default_factory=list)
    force_workflow: WorkflowType | None = None
    max_characters: int = Field(default=2, ge=1, le=2)
    tone: str | None = None
    age_band: str | None = None
    reuse_existing_character: bool = Field(
        default=False,
        description=(
            "When true, reuse provided character_drawings as canonical identity and skip "
            "new character generation."
        ),
    )
    reuse_character_name: str | None = None


class CharacterBrief(BaseModel):
    name: str = ""
    brief: str = ""


class StoryPagePlan(BaseModel):
    page_number: int = Field(ge=1, le=10)
    chapter: str = ""
    beat: str = ""


class StoryBlueprint(BaseModel):
    title: str = ""
    logline: str = ""
    title_page_text: str = ""
    end_page_text: str = ""
    cover_concept: str = ""
    character_briefs: list[CharacterBrief] = Field(default_factory=list)
    page_plans: list[StoryPagePlan] = Field(default_factory=list)


class StoryRightPage(BaseModel):
    page_number: int = Field(ge=1, le=10)
    chapter: str = ""
    text: str = ""
    audio_url: str | None = None


class StoryDraft(BaseModel):
    title: str = ""
    title_page_text: str = ""
    right_pages: list[StoryRightPage] = Field(default_factory=list)
    end_page_text: str = ""


class ScenePromptBundle(BaseModel):
    cover_prompt: str = ""
    illustration_prompts: list[str] = Field(default_factory=list)
    negative_prompt: str = ""


class GeneratedCharacterPacket(BaseModel):
    name: str = ""
    brief: str = ""
    backstory: dict[str, Any] | None = None
    image_prompt: dict[str, Any] | None = None
    generated_images: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class StorySpreadSide(BaseModel):
    kind: Literal[
        "cover_image",
        "title_page",
        "illustration",
        "chapter_text",
        "end_page",
        "empty",
    ]
    image_url: str | None = None
    title: str | None = None
    chapter: str | None = None
    text: str | None = None
    page_number: int | None = None
    audio_url: str | None = None


class StorySpread(BaseModel):
    spread_index: int
    label: str | None = None
    left: StorySpreadSide
    right: StorySpreadSide


class StoryBookCreationResponse(BaseModel):
    workflow_used: WorkflowType
    story: StoryDraft
    characters: list[GeneratedCharacterPacket] = Field(default_factory=list)
    scene_prompts: ScenePromptBundle
    generated_images: list[str] = Field(default_factory=list)
    spreads: list[StorySpread] = Field(default_factory=list)
    replicate_model: str
    reference_images_used_count: int = 0
    warnings: list[str] = Field(default_factory=list)
    drawing_descriptions: list[str] = Field(default_factory=list)
    world_reference_descriptions: list[str] = Field(default_factory=list)
    generation_sources: dict[str, str] = Field(default_factory=dict)
    reference_image_breakdown: dict[str, int] = Field(default_factory=dict)
    scene_reference_counts: list[int] = Field(default_factory=list)


class ServiceHealthResponse(BaseModel):
    status: str
    agent_provider: str
    character_backend_connected: bool
    character_backend_health: dict[str, Any] | None = None
    character_backend_error: str | None = None

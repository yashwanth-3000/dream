from __future__ import annotations

from typing import Literal

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


class CharacterCreationRequest(BaseModel):
    user_prompt: str = Field(min_length=1, description="Primary character concept from user")
    world_references: list[WorldReference] = Field(default_factory=list)
    character_drawings: list[CharacterDrawingReference] = Field(default_factory=list)
    force_workflow: WorkflowType | None = None


class CharacterImageRegenerationRequest(BaseModel):
    positive_prompt: str = Field(min_length=1, description="Previously generated image prompt to reuse")
    negative_prompt: str | None = None
    world_references: list[WorldReference] = Field(default_factory=list)
    character_drawings: list[CharacterDrawingReference] = Field(default_factory=list)


class ResearchSummary(BaseModel):
    key_facts: list[str] = Field(default_factory=list)
    style_cues: list[str] = Field(default_factory=list)
    source_links: list[str] = Field(default_factory=list)
    research_notes: str = ""


class ConceptOutline(BaseModel):
    world_snapshot: str = ""
    core_conflict: str = ""
    character_hook: str = ""
    anchor_visuals: list[str] = Field(default_factory=list)


class CharacterBackstory(BaseModel):
    name: str = ""
    archetype: str = ""
    era: str = ""
    origin: str = ""
    goals: list[str] = Field(default_factory=list)
    flaws: list[str] = Field(default_factory=list)
    narrative_backstory: str = ""
    visual_signifiers: list[str] = Field(default_factory=list)


class ImagePromptPack(BaseModel):
    positive_prompt: str = ""
    negative_prompt: str = ""
    composition_guidance: list[str] = Field(default_factory=list)
    color_palette: list[str] = Field(default_factory=list)
    lighting: str = ""


class CharacterCreationResponse(BaseModel):
    workflow_used: WorkflowType
    backstory: CharacterBackstory
    image_prompt: ImagePromptPack
    generated_images: list[str] = Field(default_factory=list)
    drawing_descriptions: list[str] = Field(default_factory=list)
    world_reference_descriptions: list[str] = Field(default_factory=list)
    replicate_model: str
    reference_summary: ResearchSummary | None = None


class CharacterImageRegenerationResponse(BaseModel):
    image_prompt: ImagePromptPack
    generated_images: list[str] = Field(default_factory=list)
    replicate_model: str
    total_reference_images_sent: int = 0

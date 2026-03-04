from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


WorkflowType = Literal["story_based", "prompt_only"]
QuizDifficulty = Literal["easy", "medium", "hard"]


class QuizCreationRequest(BaseModel):
    user_prompt: str = Field(min_length=1, description="Topic or concept for quiz generation")
    story_title: str | None = None
    story_text: str | None = None
    age_band: str | None = None
    difficulty: QuizDifficulty | None = None
    question_count: int = Field(default=5, ge=1, le=10)


class QuizQuestionPlan(BaseModel):
    question_number: int = Field(ge=1, le=10)
    question_focus: str = ""
    learning_goal: str = ""


class QuizBlueprint(BaseModel):
    quiz_title: str = ""
    instructions: str = ""
    question_plans: list[QuizQuestionPlan] = Field(default_factory=list)


class QuizQuestion(BaseModel):
    question_number: int = Field(ge=1, le=10)
    question: str = ""
    options: list[str] = Field(default_factory=list)
    correct_option_index: int = Field(default=0, ge=0, le=3)
    hints: list[str] = Field(default_factory=list)
    correct_explanation: str = ""
    learning_goal: str = ""


class QuizDraft(BaseModel):
    quiz_title: str = ""
    instructions: str = ""
    questions: list[QuizQuestion] = Field(default_factory=list)


class QuizCreationResponse(BaseModel):
    workflow_used: WorkflowType
    quiz: QuizDraft
    warnings: list[str] = Field(default_factory=list)
    generation_sources: dict[str, str] = Field(default_factory=dict)


class ServiceHealthResponse(BaseModel):
    status: str
    agent_provider: str

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from agent_quiz.quiz_workflow import MIN_HINT_COUNT, OPTION_COUNT, QuizWorkflow
from agent_quiz.schemas import QuizBlueprint, QuizCreationRequest, QuizDraft, QuizQuestion, QuizQuestionPlan


class StubBlueprintAgent:
    def __init__(self, blueprint: QuizBlueprint | Exception) -> None:
        self._blueprint = blueprint

    async def generate(self, **_: object) -> QuizBlueprint:
        if isinstance(self._blueprint, Exception):
            raise self._blueprint
        return self._blueprint


class StubWriterAgent:
    def __init__(self, draft: QuizDraft | Exception) -> None:
        self._draft = draft

    async def generate(self, **_: object) -> QuizDraft:
        if isinstance(self._draft, Exception):
            raise self._draft
        return self._draft


def build_payload(question_count: int = 5, with_story: bool = False) -> QuizCreationRequest:
    return QuizCreationRequest(
        user_prompt="Ocean animals and teamwork",
        story_title="The Coral Rescue" if with_story else None,
        story_text="Mina and her friends saved the reef by working together." if with_story else None,
        age_band="6-8",
        difficulty="easy",
        question_count=question_count,
    )


def build_blueprint(question_count: int = 5) -> QuizBlueprint:
    return QuizBlueprint(
        quiz_title="Coral Rescue Quiz",
        instructions="Pick one answer.",
        question_plans=[
            QuizQuestionPlan(
                question_number=index,
                question_focus=f"What is the main idea of question {index}?",
                learning_goal="Find the best matching clue.",
            )
            for index in range(1, question_count + 1)
        ],
    )


def build_draft(question_count: int = 5) -> QuizDraft:
    return QuizDraft(
        quiz_title="Coral Rescue Quiz",
        instructions="Pick one answer.",
        questions=[
            QuizQuestion(
                question_number=index,
                question=f"Question {index}",
                options=["A", "B"],
                correct_option_index=0,
                hints=["Read the clue again."],
                correct_explanation="Because A matches.",
                learning_goal="Find clues.",
            )
            for index in range(1, question_count + 1)
        ],
    )


def build_workflow(
    blueprint: QuizBlueprint | Exception,
    draft: QuizDraft | Exception,
) -> QuizWorkflow:
    settings = SimpleNamespace(openai_model="gpt-4o-mini")
    return QuizWorkflow(
        settings=settings,
        blueprint_agent=StubBlueprintAgent(blueprint),
        quiz_writer_agent=StubWriterAgent(draft),
    )


def test_choose_workflow_uses_story_based_when_story_context_present() -> None:
    assert QuizWorkflow.choose_workflow(build_payload(with_story=False)) == "prompt_only"
    assert QuizWorkflow.choose_workflow(build_payload(with_story=True)) == "story_based"


def test_run_enforces_option_and_hint_contracts() -> None:
    workflow = build_workflow(build_blueprint(), build_draft())
    response = asyncio.run(workflow.run(build_payload()))

    assert len(response.quiz.questions) == 5
    for question in response.quiz.questions:
        assert len(question.options) == OPTION_COUNT
        assert len(question.hints) == MIN_HINT_COUNT
        assert 0 <= question.correct_option_index < OPTION_COUNT
        assert question.correct_explanation


def test_writer_failure_uses_fallback_quiz() -> None:
    workflow = build_workflow(build_blueprint(), RuntimeError("writer failed"))
    response = asyncio.run(workflow.run(build_payload()))

    assert response.generation_sources["quiz"] == "fallback"
    assert any("fallback" in warning.lower() for warning in response.warnings)
    assert len(response.quiz.questions) == 5


def test_blueprint_failure_uses_fallback_blueprint() -> None:
    workflow = build_workflow(RuntimeError("blueprint failed"), build_draft())
    response = asyncio.run(workflow.run(build_payload(question_count=3)))

    assert response.generation_sources["blueprint"] == "fallback"
    assert len(response.quiz.questions) == 3


def test_question_count_is_always_respected() -> None:
    workflow = build_workflow(build_blueprint(question_count=2), build_draft(question_count=2))
    response = asyncio.run(workflow.run(build_payload(question_count=2)))
    assert len(response.quiz.questions) == 2

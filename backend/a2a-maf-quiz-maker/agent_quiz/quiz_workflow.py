from __future__ import annotations

import inspect
import re
from collections.abc import Awaitable, Callable
from typing import Any

from .config import Settings
from .maf_agents import MAFGenerationError, QuizBlueprintAgent, QuizWriterAgent
from .schemas import (
    QuizBlueprint,
    QuizCreationRequest,
    QuizCreationResponse,
    QuizDraft,
    QuizQuestion,
    QuizQuestionPlan,
    WorkflowType,
)


OPTION_COUNT = 4
MIN_HINT_COUNT = 2


class QuizWorkflowError(RuntimeError):
    pass


ProgressReporter = Callable[[dict[str, Any]], Awaitable[None] | None]


class QuizWorkflow:
    def __init__(
        self,
        settings: Settings,
        blueprint_agent: QuizBlueprintAgent | None = None,
        quiz_writer_agent: QuizWriterAgent | None = None,
        progress_reporter: ProgressReporter | None = None,
    ) -> None:
        self._settings = settings
        self._blueprint_agent = blueprint_agent or QuizBlueprintAgent(settings)
        self._quiz_writer_agent = quiz_writer_agent or QuizWriterAgent(settings)
        self._progress_reporter = progress_reporter

    async def _emit_progress(
        self,
        stage: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        if self._progress_reporter is None:
            return

        payload: dict[str, Any] = {
            "stage": stage,
            "message": message,
        }
        if data:
            payload["data"] = data

        try:
            maybe_awaitable = self._progress_reporter(payload)
            if inspect.isawaitable(maybe_awaitable):
                await maybe_awaitable
        except Exception:
            # Telemetry must never break primary workflow execution.
            return

    @staticmethod
    def choose_workflow(payload: QuizCreationRequest) -> WorkflowType:
        if (payload.story_text and payload.story_text.strip()) or (payload.story_title and payload.story_title.strip()):
            return "story_based"
        return "prompt_only"

    async def run(self, payload: QuizCreationRequest) -> QuizCreationResponse:
        warnings: list[str] = []
        generation_sources = {
            "blueprint": "maf",
            "quiz": "maf",
        }

        workflow = self.choose_workflow(payload)
        await self._emit_progress(
            stage="workflow_start",
            message="Quiz workflow started.",
            data={
                "workflow_selected": workflow,
                "question_count": payload.question_count,
                "has_story_context": bool((payload.story_text or "").strip() or (payload.story_title or "").strip()),
                "difficulty": payload.difficulty,
                "age_band": payload.age_band,
                "model": self._settings.openai_model,
            },
        )

        try:
            await self._emit_progress(
                stage="blueprint_generation_start",
                message="Generating quiz blueprint with QuizBlueprintAgent.",
            )
            blueprint = await self._blueprint_agent.generate(payload=payload, workflow=workflow)
        except Exception as exc:
            warnings.append(f"Blueprint agent fallback used: {exc}")
            blueprint = self._fallback_blueprint(payload)
            generation_sources["blueprint"] = "fallback"
            await self._emit_progress(
                stage="blueprint_generation_fallback",
                message="Blueprint agent failed; fallback blueprint was used.",
                data={"detail": str(exc)},
            )

        blueprint = self._normalize_blueprint(blueprint=blueprint, payload=payload)
        await self._emit_progress(
            stage="blueprint_generation_complete",
            message="Blueprint ready.",
            data={
                "quiz_title": blueprint.quiz_title,
                "question_plan_count": len(blueprint.question_plans),
                "source": generation_sources["blueprint"],
            },
        )

        try:
            await self._emit_progress(
                stage="quiz_generation_start",
                message="Generating final quiz with QuizWriterAgent.",
            )
            quiz_draft = await self._quiz_writer_agent.generate(
                payload=payload,
                blueprint=blueprint,
                workflow=workflow,
            )
        except Exception as exc:
            warnings.append(f"Quiz writer fallback used: {exc}")
            quiz_draft = self._fallback_quiz_draft(blueprint=blueprint)
            generation_sources["quiz"] = "fallback"
            await self._emit_progress(
                stage="quiz_generation_fallback",
                message="Quiz writer failed; fallback quiz was used.",
                data={"detail": str(exc)},
            )

        quiz_draft = self._normalize_quiz_draft(
            quiz=quiz_draft,
            blueprint=blueprint,
            payload=payload,
        )
        await self._emit_progress(
            stage="quiz_generation_complete",
            message="Quiz draft ready.",
            data={
                "quiz_title": quiz_draft.quiz_title,
                "question_count": len(quiz_draft.questions),
                "source": generation_sources["quiz"],
            },
        )

        await self._emit_progress(
            stage="workflow_complete",
            message="Quiz workflow completed successfully.",
            data={
                "workflow_used": workflow,
                "warning_count": len(warnings),
            },
        )

        return QuizCreationResponse(
            workflow_used=workflow,
            quiz=quiz_draft,
            warnings=warnings,
            generation_sources=generation_sources,
        )

    def _normalize_blueprint(self, blueprint: QuizBlueprint, payload: QuizCreationRequest) -> QuizBlueprint:
        quiz_title = (blueprint.quiz_title or "").strip() or self._title_from_prompt(payload.user_prompt)
        instructions = (
            (blueprint.instructions or "").strip()
            or "Choose one answer for each question. If you get it wrong, use the hint and try again."
        )

        plans_by_number = {
            plan.question_number: plan
            for plan in blueprint.question_plans
            if 1 <= plan.question_number <= payload.question_count
        }

        normalized_plans: list[QuizQuestionPlan] = []
        for index in range(1, payload.question_count + 1):
            existing = plans_by_number.get(index)
            focus = (existing.question_focus if existing else "").strip()
            goal = (existing.learning_goal if existing else "").strip()

            if not focus:
                focus = f"Question about {payload.user_prompt.strip()}"
            if not goal:
                goal = "Understand the key idea before picking the answer."

            normalized_plans.append(
                QuizQuestionPlan(
                    question_number=index,
                    question_focus=focus,
                    learning_goal=goal,
                )
            )

        return QuizBlueprint(
            quiz_title=quiz_title,
            instructions=instructions,
            question_plans=normalized_plans,
        )

    def _normalize_quiz_draft(
        self,
        quiz: QuizDraft,
        blueprint: QuizBlueprint,
        payload: QuizCreationRequest,
    ) -> QuizDraft:
        questions_by_number = {
            question.question_number: question
            for question in quiz.questions
            if 1 <= question.question_number <= payload.question_count
        }

        plans_by_number = {plan.question_number: plan for plan in blueprint.question_plans}

        normalized_questions: list[QuizQuestion] = []
        for index in range(1, payload.question_count + 1):
            question = questions_by_number.get(index)
            plan = plans_by_number.get(index)

            question_text = (question.question if question else "").strip()
            if not question_text and plan is not None:
                question_text = plan.question_focus.strip()
            if not question_text:
                question_text = f"What is the best answer for question {index}?"
            if question_text[-1:] not in "?!.":
                question_text = f"{question_text}?"

            options = self._normalize_options(
                options=question.options if question else [],
                question_number=index,
                question_text=question_text,
            )

            correct_option_index = question.correct_option_index if question else 0
            if correct_option_index < 0 or correct_option_index > 3:
                correct_option_index = 0

            hints = self._normalize_hints(
                hints=question.hints if question else [],
                question_number=index,
                question_text=question_text,
                correct_option=options[correct_option_index],
            )

            correct_explanation = (question.correct_explanation if question else "").strip()
            if not correct_explanation:
                correct_explanation = (
                    f"This answer is correct because it best matches the key clue in the question: "
                    f"{options[correct_option_index]}."
                )

            learning_goal = (question.learning_goal if question else "").strip()
            if not learning_goal and plan is not None:
                learning_goal = plan.learning_goal.strip()
            if not learning_goal:
                learning_goal = "Practice understanding the main idea before choosing."

            normalized_questions.append(
                QuizQuestion(
                    question_number=index,
                    question=question_text,
                    options=options,
                    correct_option_index=correct_option_index,
                    hints=hints,
                    correct_explanation=correct_explanation,
                    learning_goal=learning_goal,
                )
            )

        quiz_title = (quiz.quiz_title or "").strip() or blueprint.quiz_title
        instructions = (quiz.instructions or "").strip() or blueprint.instructions

        return QuizDraft(
            quiz_title=quiz_title,
            instructions=instructions,
            questions=normalized_questions,
        )

    def _normalize_options(
        self,
        options: list[str],
        question_number: int,
        question_text: str,
    ) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for option in options:
            if not isinstance(option, str):
                continue
            text = re.sub(r"\s+", " ", option).strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(text)

        fallback_pool = [
            "It matches the main clue in the question.",
            "It connects to the lesson in the story.",
            "It shows the safest and kindest choice.",
            "It best explains what happens next.",
        ]

        while len(cleaned) < OPTION_COUNT:
            fallback_index = (question_number + len(cleaned)) % len(fallback_pool)
            candidate = fallback_pool[fallback_index]
            if candidate.lower() in seen:
                candidate = f"Option {chr(65 + len(cleaned))}"
            seen.add(candidate.lower())
            cleaned.append(candidate)

        return cleaned[:OPTION_COUNT]

    def _normalize_hints(
        self,
        hints: list[str],
        question_number: int,
        question_text: str,
        correct_option: str,
    ) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for hint in hints:
            if not isinstance(hint, str):
                continue
            text = re.sub(r"\s+", " ", hint).strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(text)

        fallback_hints = [
            f"Hint 1: Focus on the main clue in question {question_number}.",
            f"Hint 2: Pick the option that best matches this idea: {correct_option}",
        ]

        while len(cleaned) < MIN_HINT_COUNT:
            candidate = fallback_hints[len(cleaned)]
            key = candidate.lower()
            if key in seen:
                candidate = f"Hint: Re-read the question and compare each option carefully."
            seen.add(candidate.lower())
            cleaned.append(candidate)

        return cleaned[:MIN_HINT_COUNT]

    def _fallback_blueprint(self, payload: QuizCreationRequest) -> QuizBlueprint:
        plans = [
            QuizQuestionPlan(
                question_number=index,
                question_focus=f"What is the best answer about {payload.user_prompt.strip()}?",
                learning_goal="Read carefully and pick the option that matches the key clue.",
            )
            for index in range(1, payload.question_count + 1)
        ]
        return QuizBlueprint(
            quiz_title=self._title_from_prompt(payload.user_prompt),
            instructions="Choose one answer for each question. Use hints if needed and try again.",
            question_plans=plans,
        )

    def _fallback_quiz_draft(self, blueprint: QuizBlueprint) -> QuizDraft:
        questions: list[QuizQuestion] = []
        for plan in blueprint.question_plans:
            question_text = plan.question_focus if plan.question_focus.endswith("?") else f"{plan.question_focus}?"
            options = [
                "A clear answer that matches the clue.",
                "An answer that sounds possible but misses a key detail.",
                "An answer that is unrelated to the main idea.",
                "An answer that repeats words but does not answer the question.",
            ]
            questions.append(
                QuizQuestion(
                    question_number=plan.question_number,
                    question=question_text,
                    options=options,
                    correct_option_index=0,
                    hints=[
                        "Think about what the question is really asking.",
                        "Pick the option that directly matches the main clue.",
                    ],
                    correct_explanation="The correct option directly answers the question using the main clue.",
                    learning_goal=plan.learning_goal,
                )
            )

        return QuizDraft(
            quiz_title=blueprint.quiz_title,
            instructions=blueprint.instructions,
            questions=questions,
        )

    def _title_from_prompt(self, user_prompt: str) -> str:
        cleaned = re.sub(r"\s+", " ", user_prompt or "").strip()
        if not cleaned:
            return "Kids Quiz"

        words = cleaned.split(" ")[:6]
        return f"Quiz: {' '.join(word.capitalize() for word in words)}"

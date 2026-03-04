from __future__ import annotations

import json
import re
import uuid
from typing import Any

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.apps import A2AFastAPIApplication
from a2a.server.events import EventQueue
from a2a.server.request_handlers.default_request_handler import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCapabilities, AgentCard, AgentSkill, Part, TextPart
from fastapi import FastAPI

from .config import Settings
from .quiz_workflow import QuizWorkflow, QuizWorkflowError
from .schemas import QuizCreationRequest


class QuizA2AExecutor(AgentExecutor):
    """A2A executor for quiz creation workflow."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        task_id = context.task_id or str(uuid.uuid4())
        context_id = context.context_id or str(uuid.uuid4())
        updater = TaskUpdater(event_queue=event_queue, task_id=task_id, context_id=context_id)
        progress_artifact_id = f"{task_id}-progress"

        try:
            await updater.submit()
            await updater.start_work()

            operation, payload = self._extract_operation_payload(context)
            if operation == "healthcheck":
                result_payload: dict[str, Any] = {
                    "status": "ok",
                    "service": "dream-maf-quiz-maker",
                    "protocol": "a2a",
                }
            else:
                request = QuizCreationRequest.model_validate(payload)

                await self._publish_progress(
                    updater=updater,
                    artifact_id=progress_artifact_id,
                    stage="request_received",
                    message="Quiz create request received by quiz A2A executor.",
                    data={
                        "quiz_rpc": self._settings.a2a_rpc_url,
                        "question_count": request.question_count,
                    },
                )

                async def progress_reporter(event: dict[str, Any]) -> None:
                    await self._publish_progress(
                        updater=updater,
                        artifact_id=progress_artifact_id,
                        stage=str(event.get("stage") or "progress"),
                        message=str(event.get("message") or "Progress update"),
                        data=event.get("data") if isinstance(event.get("data"), dict) else None,
                    )

                workflow = QuizWorkflow(
                    settings=self._settings,
                    progress_reporter=progress_reporter,
                )
                result_payload = (await workflow.run(request)).model_dump(mode="json")

            await updater.add_artifact(
                name="quiz-workflow-result",
                parts=[Part(root=TextPart(text=json.dumps(result_payload, ensure_ascii=True)))],
                append=False,
                last_chunk=True,
            )
            await updater.complete()

        except QuizWorkflowError as exc:
            await self._publish_error(updater, "QuizWorkflowError", str(exc))
            await updater.failed()
        except Exception as exc:
            await self._publish_error(updater, "UnhandledError", str(exc))
            await updater.failed()

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        task_id = context.task_id or str(uuid.uuid4())
        context_id = context.context_id or str(uuid.uuid4())
        updater = TaskUpdater(event_queue=event_queue, task_id=task_id, context_id=context_id)
        await updater.cancel()

    def _extract_operation_payload(self, context: RequestContext) -> tuple[str, dict[str, Any]]:
        metadata = self._collect_metadata(context)
        input_text = context.get_user_input().strip()

        operation = str(metadata.get("operation") or "").strip().lower()
        payload = metadata.get("payload")

        if not isinstance(payload, dict):
            payload = self._parse_json_like_payload(input_text)

        if not isinstance(payload, dict):
            payload = {}

        if operation not in {"quiz_create", "healthcheck"}:
            operation = str(payload.get("operation") or "").strip().lower()

        if operation not in {"quiz_create", "healthcheck"}:
            lowered_input = input_text.lower()
            if lowered_input in {"healthcheck", "health", "ping"}:
                operation = "healthcheck"
            else:
                operation = "quiz_create"

        if operation == "quiz_create":
            payload.setdefault("user_prompt", input_text or "Create a short children quiz.")
            payload.setdefault("question_count", 5)

        return operation, payload

    def _collect_metadata(self, context: RequestContext) -> dict[str, Any]:
        merged: dict[str, Any] = {}

        request_metadata = context.metadata if isinstance(context.metadata, dict) else {}
        merged.update(request_metadata)

        message = context.message
        if message is not None:
            message_metadata = getattr(message, "metadata", None)
            if isinstance(message_metadata, dict):
                merged.update(message_metadata)

            parts = getattr(message, "parts", None)
            if isinstance(parts, list):
                for part in parts:
                    root = getattr(part, "root", None)
                    part_metadata = getattr(root, "metadata", None)
                    if isinstance(part_metadata, dict):
                        for key, value in part_metadata.items():
                            merged.setdefault(key, value)

        return merged

    def _parse_json_like_payload(self, input_text: str) -> dict[str, Any] | None:
        if not input_text:
            return None

        try:
            data = json.loads(input_text)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

        fenced = re.search(r"```json\s*(\{.*?\})\s*```", input_text, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            try:
                data = json.loads(fenced.group(1))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        object_match = re.search(r"\{.*\}", input_text, flags=re.DOTALL)
        if object_match:
            try:
                data = json.loads(object_match.group(0))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

        return None

    async def _publish_error(self, updater: TaskUpdater, error_type: str, detail: str) -> None:
        payload = {"error": error_type, "detail": detail}
        await updater.add_artifact(
            name="quiz-workflow-error",
            parts=[Part(root=TextPart(text=json.dumps(payload, ensure_ascii=True)))],
            append=False,
            last_chunk=True,
        )

    async def _publish_progress(
        self,
        updater: TaskUpdater,
        artifact_id: str,
        stage: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "kind": "progress",
            "stage": stage,
            "message": message,
        }
        if data:
            payload["data"] = data

        await updater.add_artifact(
            artifact_id=artifact_id,
            name="quiz-workflow-progress",
            parts=[Part(root=TextPart(text=json.dumps(payload, ensure_ascii=True)))],
            append=False,
            last_chunk=False,
        )


def register_a2a_routes(app: FastAPI, settings: Settings) -> None:
    agent_card = AgentCard(
        name=settings.a2a_agent_name,
        description=(
            "A2A endpoint for Dream children quiz generation: creates four-option quizzes with hints "
            "and correct-answer explanations."
        ),
        url=settings.a2a_rpc_url,
        version=settings.a2a_agent_version,
        default_input_modes=["text/plain", "application/json"],
        default_output_modes=["application/json", "text/plain"],
        capabilities=AgentCapabilities(streaming=True),
        skills=[
            AgentSkill(
                id="quiz_create",
                name="Quiz Create",
                description="Generate a children-friendly quiz with 4 options, hints, and explanations.",
                tags=["quiz", "maf", "a2a", "education"],
                examples=[
                    "Create a 5-question quiz about a space rescue story for kids age 6-8.",
                ],
            ),
        ],
    )

    request_handler = DefaultRequestHandler(
        agent_executor=QuizA2AExecutor(settings=settings),
        task_store=InMemoryTaskStore(),
    )

    a2a_app = A2AFastAPIApplication(
        agent_card=agent_card,
        http_handler=request_handler,
    )
    a2a_app.add_routes_to_app(app=app, rpc_url=settings.a2a_rpc_path)

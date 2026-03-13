from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from . import database as db
from . import job_manager as jm
from .backend_client import A2ABackendClient, A2ABackendError
from .chat_agents import MAFChatError, MAFKidsChatOrchestrator
from .config import Settings, get_settings
from .maf_router import MAFRoutingAgent
from .models import (
    ChatOrchestrationRequest,
    ChatOrchestrationResponse,
    CharacterOrchestrationRequest,
    CharacterOrchestrationResponse,
    JobCreateRequest,
    JobDeleteResponse,
    JobEventResponse,
    JobResponse,
    QuizOrchestrationRequest,
    QuizOrchestrationResponse,
    ServiceHealthResponse,
    StudyUploadResponse,
    StoryBookOrchestrationRequest,
    StoryBookOrchestrationResponse,
)
from .rag.service import citations_to_dicts
from .rag.study_documents import StudyDocumentIndexer
from .telemetry import configure_telemetry

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Dream Microsoft Agent Framework Orchestrator",
    version="0.2.0",
    description=(
        "Agent Framework orchestrator that routes character and storybook requests to specialized "
        "A2A backends, with job tracking, real-time events, and asset storage."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    configure_telemetry(get_settings())
    await db.init_db()


# ---------------------------------------------------------------------------
# Helpers (unchanged from original)
# ---------------------------------------------------------------------------

def _build_backend_payload(
    payload: CharacterOrchestrationRequest,
    selected_action: str,
) -> dict[str, object]:
    world_references = [r.model_dump(mode="json", exclude_none=True) for r in payload.world_references]
    character_drawings = [d.model_dump(mode="json", exclude_none=True) for d in payload.character_drawings]

    if selected_action == "create":
        if not payload.user_prompt or not payload.user_prompt.strip():
            raise HTTPException(status_code=422, detail="user_prompt is required for create action.")
        return {
            "user_prompt": payload.user_prompt,
            "world_references": world_references,
            "character_drawings": character_drawings,
            "force_workflow": payload.force_workflow,
        }

    if selected_action == "regenerate":
        if not payload.positive_prompt or not payload.positive_prompt.strip():
            raise HTTPException(status_code=422, detail="positive_prompt is required for regenerate action.")
        return {
            "positive_prompt": payload.positive_prompt,
            "negative_prompt": payload.negative_prompt,
            "world_references": world_references,
            "character_drawings": character_drawings,
        }

    raise HTTPException(status_code=422, detail=f"Unsupported selected_action: {selected_action}")


def _build_story_backend_payload(payload: StoryBookOrchestrationRequest) -> dict[str, object]:
    world_references = [r.model_dump(mode="json", exclude_none=True) for r in payload.world_references]
    character_drawings = [d.model_dump(mode="json", exclude_none=True) for d in payload.character_drawings]
    return {
        "user_prompt": payload.user_prompt.strip(),
        "world_references": world_references,
        "character_drawings": character_drawings,
        "force_workflow": payload.force_workflow,
        "max_characters": payload.max_characters,
        "tone": payload.tone,
        "age_band": payload.age_band,
        "reuse_existing_character": payload.reuse_existing_character,
        "reuse_character_name": payload.reuse_character_name,
    }


def _build_quiz_backend_payload(payload: QuizOrchestrationRequest) -> dict[str, object]:
    return {
        "user_prompt": payload.user_prompt.strip(),
        "story_title": payload.story_title,
        "story_text": payload.story_text,
        "age_band": payload.age_band,
        "difficulty": payload.difficulty,
        "question_count": payload.question_count,
    }


def _parse_json_object(raw: str) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _looks_like_final_payload(payload: dict[str, object]) -> bool:
    final_keys = {"workflow_used", "story", "spreads", "generated_images", "scene_prompts", "characters", "quiz"}
    return any(key in payload for key in final_keys)


def _extract_progress_payload(payload: dict[str, object]) -> dict[str, object] | None:
    kind_value = str(payload.get("kind") or "").strip().lower()
    if kind_value != "progress":
        return None
    progress: dict[str, object] = {
        "type": "progress",
        "source": "backend",
        "stage": str(payload.get("stage") or "progress"),
        "message": str(payload.get("message") or "Progress update received."),
    }
    data = payload.get("data")
    if isinstance(data, dict):
        progress["data"] = data
    return progress


def _collect_image_urls(result_payload: dict[str, Any]) -> list[str]:
    urls: list[str] = []

    def _append_url(value: Any) -> None:
        if not isinstance(value, str):
            return
        normalized = value.strip()
        if not normalized:
            return
        if not (normalized.startswith("http") or normalized.startswith("data:")):
            return
        if normalized in urls:
            return
        urls.append(normalized)

    for url in result_payload.get("generated_images", []):
        _append_url(url)

    for char in result_payload.get("characters", []):
        if isinstance(char, dict):
            for url in char.get("generated_images", []):
                _append_url(url)

    for spread in result_payload.get("spreads", []):
        if isinstance(spread, dict):
            for side in ("left", "right"):
                side_data = spread.get(side)
                if isinstance(side_data, dict):
                    _append_url(side_data.get("image_url"))
                    _append_url(side_data.get("audio_url"))

    story = result_payload.get("story")
    if isinstance(story, dict):
        for page in story.get("right_pages", []):
            if isinstance(page, dict):
                _append_url(page.get("audio_url"))

    return urls


def _derive_title(result_payload: dict[str, Any], job_type: str, user_prompt: str) -> str:
    if job_type == "story":
        story = result_payload.get("story")
        if isinstance(story, dict) and story.get("title"):
            return str(story["title"])
    elif job_type == "quiz":
        quiz = result_payload.get("quiz")
        if isinstance(quiz, dict) and quiz.get("quiz_title"):
            return str(quiz["quiz_title"])
    elif job_type == "character":
        backstory = result_payload.get("backstory")
        if isinstance(backstory, dict) and backstory.get("name"):
            return str(backstory["name"])
    return user_prompt[:80] if user_prompt else "Untitled"


async def _persist_story_characters_as_jobs(
    *,
    story_job_id: str,
    story_payload: dict[str, Any],
    story_prompt: str,
) -> list[str]:
    raw_characters = story_payload.get("characters")
    if not isinstance(raw_characters, list):
        return []

    persisted_ids: list[str] = []

    for index, packet in enumerate(raw_characters):
        if not isinstance(packet, dict):
            continue

        backstory = packet.get("backstory")
        backstory_dict = backstory if isinstance(backstory, dict) else {}
        packet_name = str(packet.get("name") or "").strip()
        backstory_name = str(backstory_dict.get("name") or "").strip()
        character_name = backstory_name or packet_name or f"Story Character {index + 1}"

        generated_images_raw = packet.get("generated_images")
        generated_images = [
            str(url).strip()
            for url in (generated_images_raw if isinstance(generated_images_raw, list) else [])
            if isinstance(url, str) and str(url).strip()
        ]

        child_job_id = ""
        try:
            child_job = await jm.create_job(
                job_type="character",
                title=character_name,
                user_prompt=f"Character extracted from story job {story_job_id}: {character_name}",
                input_payload={
                    "source": "storybook",
                    "source_story_job_id": story_job_id,
                    "character_index": index,
                    "story_prompt": story_prompt,
                },
                triggered_by="storybook-character-save",
                engine="a2a-crew-ai-character-maker",
            )
            child_job_id = child_job.get("id", "")
            if not child_job_id:
                continue

            await jm.start_job(child_job_id, step="persist_story_character")
            await jm.update_progress(
                child_job_id,
                step="persist_story_character",
                message=(
                    f"Persisting story-generated character {index + 1}/"
                    f"{len(raw_characters)} ({character_name})."
                ),
                progress=70.0,
                data={"source_story_job_id": story_job_id},
            )
            if generated_images:
                await jm.download_and_store_assets(
                    child_job_id,
                    generated_images,
                    asset_type="character_image",
                )
            await jm.complete_job(
                child_job_id,
                {
                    "source_story_job_id": story_job_id,
                    "character_index": index,
                    "name": character_name,
                    "backstory": backstory_dict,
                    "image_prompt": packet.get("image_prompt"),
                    "generated_images": generated_images,
                    "warnings": packet.get("warnings") if isinstance(packet.get("warnings"), list) else [],
                },
                title=character_name,
            )
            persisted_ids.append(child_job_id)
        except Exception as exc:
            logger.warning(
                "story_character_persist_failed story_job_id=%s index=%d error=%s",
                story_job_id,
                index,
                exc,
            )
            if child_job_id:
                try:
                    await jm.fail_job(child_job_id, f"Story character persist failed: {exc}")
                except Exception:
                    pass

    return persisted_ids


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", response_model=ServiceHealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> ServiceHealthResponse:
    backend = A2ABackendClient(settings)
    try:
        backend_health = await backend.health()
        return ServiceHealthResponse(
            status="ok", agent_provider=settings.agent_provider,
            a2a_protocol_enabled=settings.a2a_use_protocol, a2a_rpc_url=settings.a2a_rpc_url,
            backend_connected=True, backend_health=backend_health, backend_error=None,
        )
    except Exception as exc:
        return ServiceHealthResponse(
            status="ok", agent_provider=settings.agent_provider,
            a2a_protocol_enabled=settings.a2a_use_protocol, a2a_rpc_url=settings.a2a_rpc_url,
            backend_connected=False, backend_health=None, backend_error=str(exc),
        )


@app.get("/api/v1/orchestrate/a2a-health")
async def a2a_protocol_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    backend = A2ABackendClient(settings)
    try:
        result = await backend.protocol_healthcheck()
        return {"status": "ok", "backend_endpoint": result.endpoint,
                "backend_status_code": result.status_code, "backend_response": result.payload}
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/orchestrate/storybook-health")
async def storybook_protocol_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    backend = A2ABackendClient(settings)
    try:
        result = await backend.storybook_health()
        return {"status": "ok", "backend_endpoint": result.endpoint,
                "backend_status_code": result.status_code, "backend_response": result.payload}
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/orchestrate/quiz-health")
async def quiz_protocol_health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    backend = A2ABackendClient(settings)
    try:
        result = await backend.quiz_health()
        return {"status": "ok", "backend_endpoint": result.endpoint,
                "backend_status_code": result.status_code, "backend_response": result.payload}
    except A2ABackendError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Kid-safe chat orchestration
# ---------------------------------------------------------------------------

@app.post("/api/v1/orchestrate/chat", response_model=ChatOrchestrationResponse)
async def orchestrate_chat(
    payload: ChatOrchestrationRequest,
    settings: Settings = Depends(get_settings),
) -> ChatOrchestrationResponse:
    chat_orchestrator = MAFKidsChatOrchestrator(settings)
    history = [item.model_dump(mode="json") for item in payload.history]
    logger.info(
        "chat_request_received mode=%s history_len=%d age_band=%s",
        payload.mode,
        len(history),
        payload.age_band or "none",
    )

    try:
        result = await chat_orchestrator.answer_question(
            message=payload.message,
            history=history,
            age_band=payload.age_band,
            mode=payload.mode,
            study_session_id=payload.study_session_id,
        )
    except MAFChatError as exc:
        logger.exception("chat_request_failed mode=%s reason=%s", payload.mode, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        detail = (
            f"Chat orchestration failed: {exc}. "
            f"maf_context={chat_orchestrator.import_error_context()}"
        )
        logger.exception("chat_request_failed_unhandled mode=%s reason=%s", payload.mode, exc)
        raise HTTPException(status_code=502, detail=detail) from exc

    logger.info(
        (
            "chat_request_completed mode=%s category=%s safety=%s mcp_used=%s mcp_server=%s "
            "retrieval_provider=%s citations=%d"
        ),
        payload.mode,
        result.category,
        result.safety,
        result.mcp_used,
        result.mcp_server or "none",
        result.retrieval_provider or "none",
        len(result.citations or []),
    )

    return ChatOrchestrationResponse(
        answer=result.answer,
        category=result.category,
        safety=result.safety,
        reading_level=result.reading_level,
        response_style=result.response_style,
        model=result.model,
        mcp_used=result.mcp_used,
        mcp_server=result.mcp_server,
        mcp_output=result.mcp_output,
        citations=citations_to_dicts(result.citations or []),
        retrieval_provider=result.retrieval_provider,
        retrieval_used_fallback=result.retrieval_used_fallback,
        moderation=result.moderation,
        study_session_id=result.study_session_id,
    )


# ---------------------------------------------------------------------------
# Study-mode document ingestion
# ---------------------------------------------------------------------------

@app.post("/api/v1/orchestrate/study/upload", response_model=StudyUploadResponse)
async def upload_study_pdf(
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
) -> StudyUploadResponse:
    filename = (file.filename or "study-document.pdf").strip() or "study-document.pdf"
    content_type = (file.content_type or "").strip().lower()
    if not StudyDocumentIndexer.is_supported_upload(file_name=filename, content_type=content_type):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported study file type. Supported files: PDF, TXT, MD, CSV, JSON, XML, HTML, YAML, LOG."
            ),
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded study file is empty.")

    max_size = settings.azure_search_study_max_file_bytes
    if len(payload) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded study file exceeds size limit ({max_size} bytes).",
        )

    indexer = StudyDocumentIndexer(settings)
    try:
        result = await indexer.upload_document(
            file_name=filename,
            file_bytes=payload,
            content_type=content_type,
            session_id=session_id,
        )
    except RuntimeError as exc:
        logger.exception("study_upload_failed_runtime filename=%s reason=%s", filename, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("study_upload_failed_unhandled filename=%s reason=%s", filename, exc)
        raise HTTPException(status_code=502, detail=f"Study upload failed: {exc}") from exc

    if result.chunks_indexed <= 0:
        detail = "; ".join(result.errors) if result.errors else "No chunks were indexed for this study file."
        raise HTTPException(status_code=502, detail=detail)

    return StudyUploadResponse(
        session_id=result.session_id,
        file_id=result.file_id,
        filename=result.filename,
        chunks_indexed=result.chunks_indexed,
        provider=result.provider,
        index_name=result.index_name,
        errors=result.errors,
    )


# ---------------------------------------------------------------------------
# Jobs CRUD
# ---------------------------------------------------------------------------

@app.post("/api/v1/jobs", response_model=JobResponse)
async def create_job(req: JobCreateRequest) -> dict[str, Any]:
    job = await jm.create_job(
        job_type=req.type,
        title=req.title or req.user_prompt[:80] or "Untitled",
        user_prompt=req.user_prompt,
        input_payload=req.input_payload,
        triggered_by=req.triggered_by,
        engine=req.engine,
    )
    return job


@app.get("/api/v1/jobs", response_model=list[JobResponse])
async def list_jobs(
    type: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    summary: bool = Query(False),
) -> list[dict[str, Any]]:
    return await db.list_jobs(
        job_type=type,
        status=status,
        limit=limit,
        offset=offset,
        summary=summary,
    )


@app.get("/api/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str) -> dict[str, Any]:
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.delete("/api/v1/jobs/{job_id}", response_model=JobDeleteResponse)
async def delete_job_endpoint(job_id: str) -> JobDeleteResponse:
    deleted = await jm.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobDeleteResponse(deleted=True, id=job_id)


@app.get("/api/v1/jobs/{job_id}/events", response_model=list[JobEventResponse])
async def get_job_events(
    job_id: str,
    after: str | None = Query(None),
) -> list[dict[str, Any]]:
    # Lightweight existence check — reuses persistent connection, no full job load
    conn = await db.get_db()
    cursor = await conn.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return await db.get_job_events(job_id, after=after)


@app.get("/api/v1/jobs/{job_id}/stream")
async def stream_job_events(job_id: str) -> StreamingResponse:
    conn = await db.get_db()
    cursor = await conn.execute("SELECT id, status FROM jobs WHERE id = ?", (job_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job = dict(row)

    async def sse_stream() -> AsyncIterator[str]:
        existing = await db.get_job_events(job_id)
        for evt in existing:
            yield f"data: {json.dumps(evt, ensure_ascii=True)}\n\n"

        if job.get("status") in ("completed", "failed"):
            yield f"data: {json.dumps({'event_type': 'done', 'message': 'Job already finished.'})}\n\n"
            return

        queue = jm.event_bus.subscribe(job_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if event is None:
                    yield f"data: {json.dumps({'event_type': 'done', 'message': 'Job finished.'})}\n\n"
                    break
                yield f"data: {json.dumps(event, ensure_ascii=True)}\n\n"
        finally:
            jm.event_bus.unsubscribe(job_id, queue)

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )


@app.get("/api/v1/assets/{job_id}/{filename}")
async def serve_asset(job_id: str, filename: str) -> FileResponse:
    filepath = db.get_assets_dir() / job_id / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
    import mimetypes as mt
    mime = mt.guess_type(str(filepath))[0] or "application/octet-stream"
    return FileResponse(str(filepath), media_type=mime)


# ---------------------------------------------------------------------------
# Character orchestration (with job tracking)
# ---------------------------------------------------------------------------

@app.post("/api/v1/orchestrate/character", response_model=CharacterOrchestrationResponse)
async def orchestrate_character(
    payload: CharacterOrchestrationRequest,
    job_id: str | None = Query(None, alias="job_id"),
    settings: Settings = Depends(get_settings),
) -> CharacterOrchestrationResponse:
    router = MAFRoutingAgent(settings)
    backend = A2ABackendClient(settings)

    if job_id:
        await jm.start_job(job_id, step="routing")
        await jm.update_progress(job_id, step="routing", message="MAF routing agent deciding action...")

    decision, selected_by, raw_output = await router.decide(payload)

    if job_id:
        await jm.update_progress(
            job_id, step="backend_call", message=f"Routing decided: {decision.selected_action}",
            progress=10.0, data={"action": decision.selected_action, "selected_by": selected_by},
        )

    try:
        backend_payload = _build_backend_payload(payload, decision.selected_action)

        if job_id:
            await jm.update_progress(
                job_id, step="generating", message="Sending to character backend...", progress=20.0,
            )

        if decision.selected_action == "create":
            result = await backend.create_character(backend_payload)
        else:
            result = await backend.regenerate_image(backend_payload)
    except A2ABackendError as exc:
        if job_id:
            await jm.fail_job(job_id, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    response = CharacterOrchestrationResponse(
        selected_action=decision.selected_action,
        selected_by=selected_by,
        agent_reasoning=decision.rationale,
        agent_raw_output=raw_output,
        backend_endpoint=result.endpoint,
        backend_status_code=result.status_code,
        backend_response=result.payload,
    )

    if job_id:
        result_data = result.payload or {}
        title = _derive_title(result_data, "character", payload.user_prompt or "")
        image_urls = _collect_image_urls(result_data)

        await jm.update_progress(
            job_id, step="downloading_assets",
            message=f"Downloading {len(image_urls)} asset(s)...", progress=80.0,
        )
        await jm.download_and_store_assets(job_id, image_urls, asset_type="character_image")
        await jm.complete_job(job_id, result_data, title=title)

    return response


# ---------------------------------------------------------------------------
# Storybook orchestration (with job tracking)
# ---------------------------------------------------------------------------

@app.post("/api/v1/orchestrate/storybook", response_model=StoryBookOrchestrationResponse)
async def orchestrate_storybook(
    payload: StoryBookOrchestrationRequest,
    job_id: str | None = Query(None, alias="job_id"),
    settings: Settings = Depends(get_settings),
) -> StoryBookOrchestrationResponse:
    backend = A2ABackendClient(settings)

    if job_id:
        await jm.start_job(job_id, step="sending_to_backend")

    try:
        backend_payload = _build_story_backend_payload(payload)
        result = await backend.create_storybook(backend_payload)
    except A2ABackendError as exc:
        if job_id:
            await jm.fail_job(job_id, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    response = StoryBookOrchestrationResponse(
        backend_endpoint=result.endpoint,
        backend_status_code=result.status_code,
        backend_response=result.payload,
    )

    if job_id:
        result_data = result.payload or {}
        title = _derive_title(result_data, "story", payload.user_prompt)
        image_urls = _collect_image_urls(result_data)
        await jm.update_progress(
            job_id, step="downloading_assets",
            message=f"Downloading {len(image_urls)} asset(s)...", progress=80.0,
        )
        await jm.download_and_store_assets(job_id, image_urls, asset_type="scene_image")
        if not payload.reuse_existing_character:
            saved_character_job_ids = await _persist_story_characters_as_jobs(
                story_job_id=job_id,
                story_payload=result_data,
                story_prompt=payload.user_prompt,
            )
            if saved_character_job_ids:
                result_data["saved_character_job_ids"] = saved_character_job_ids
        await jm.complete_job(job_id, result_data, title=title)

    return response


@app.post("/api/v1/orchestrate/storybook/stream")
async def orchestrate_storybook_stream(
    payload: StoryBookOrchestrationRequest,
    job_id: str | None = Query(None, alias="job_id"),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    backend = A2ABackendClient(settings)
    backend_payload = _build_story_backend_payload(payload)

    if job_id:
        await jm.start_job(job_id, step="streaming")

    async def event_stream() -> AsyncIterator[str]:
        yield json.dumps({"type": "status", "source": "main",
                          "message": "Main orchestrator accepted request and started stream.",
                          **({"job_id": job_id} if job_id else {})}, ensure_ascii=True) + "\n"

        if job_id:
            await jm.update_progress(job_id, step="forwarding", message="Forwarding to storybook backend via A2A.", progress=5.0)

        yield json.dumps({"type": "status", "source": "main",
                          "message": "Forwarding request to storybook backend via A2A."}, ensure_ascii=True) + "\n"

        final_payload: dict[str, Any] | None = None

        try:
            async for event in backend.stream_storybook_operation(backend_payload):
                event_type = str(event.get("type") or "").strip().lower()
                if event_type == "final":
                    final_payload = event.get("payload")
                    out = {"type": "final", "backend_endpoint": event.get("endpoint"),
                           "backend_status_code": event.get("status_code"),
                           "backend_response": final_payload}
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                elif event_type == "progress":
                    out = {"type": "progress", "source": "backend",
                           "stage": str(event.get("stage") or "progress"),
                           "message": str(event.get("message") or "Progress update received.")}
                    data = event.get("data")
                    if isinstance(data, dict):
                        out["data"] = data
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                    if job_id:
                        await jm.update_progress(job_id, step=out["stage"], message=out["message"])
                elif event_type == "status":
                    out = {"type": "status", "source": "backend",
                           "state": str(event.get("state") or "").strip().lower() or None,
                           "message": str(event.get("message") or "Backend status update received.")}
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                    if job_id:
                        await jm.update_progress(job_id, step="backend_status", message=out["message"])
                elif event_type == "update":
                    raw_message = str(event.get("message") or "Backend update received.")
                    parsed_message = _parse_json_object(raw_message)
                    if isinstance(parsed_message, dict):
                        progress_payload = _extract_progress_payload(parsed_message)
                        if progress_payload is not None:
                            yield json.dumps(progress_payload, ensure_ascii=True) + "\n"
                            if job_id:
                                await jm.update_progress(job_id, step=str(progress_payload.get("stage", "progress")),
                                                         message=str(progress_payload.get("message", "")))
                            continue
                        if _looks_like_final_payload(parsed_message):
                            continue
                    yield json.dumps({"type": "update", "source": "backend", "message": raw_message}, ensure_ascii=True) + "\n"
                else:
                    yield json.dumps({"type": "update", "source": "backend",
                                      "message": f"Unhandled backend event: {event_type or 'unknown'}"}, ensure_ascii=True) + "\n"
        except A2ABackendError as exc:
            yield json.dumps({"type": "error", "source": "main", "message": "Storybook stream failed.",
                              "detail": str(exc)}, ensure_ascii=True) + "\n"
            if job_id:
                await jm.fail_job(job_id, str(exc))
            return
        except Exception as exc:
            yield json.dumps({"type": "error", "source": "main", "message": "Unhandled streaming error.",
                              "detail": str(exc)}, ensure_ascii=True) + "\n"
            if job_id:
                await jm.fail_job(job_id, str(exc))
            return

        if job_id and isinstance(final_payload, dict):
            title = _derive_title(final_payload, "story", payload.user_prompt)
            image_urls = _collect_image_urls(final_payload)
            if image_urls:
                await jm.update_progress(job_id, step="downloading_assets",
                                         message=f"Downloading {len(image_urls)} asset(s)...", progress=90.0)
                await jm.download_and_store_assets(job_id, image_urls, asset_type="scene_image")
            if not payload.reuse_existing_character:
                saved_character_job_ids = await _persist_story_characters_as_jobs(
                    story_job_id=job_id,
                    story_payload=final_payload,
                    story_prompt=payload.user_prompt,
                )
                if saved_character_job_ids:
                    final_payload["saved_character_job_ids"] = saved_character_job_ids
            await jm.complete_job(job_id, final_payload, title=title)
        elif job_id:
            await jm.fail_job(job_id, "Stream ended without final payload.")

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Quiz orchestration (with job tracking)
# ---------------------------------------------------------------------------

@app.post("/api/v1/orchestrate/quiz", response_model=QuizOrchestrationResponse)
async def orchestrate_quiz(
    payload: QuizOrchestrationRequest,
    job_id: str | None = Query(None, alias="job_id"),
    settings: Settings = Depends(get_settings),
) -> QuizOrchestrationResponse:
    backend = A2ABackendClient(settings)

    if job_id:
        await jm.start_job(job_id, step="sending_to_backend")

    try:
        backend_payload = _build_quiz_backend_payload(payload)
        result = await backend.create_quiz(backend_payload)
    except A2ABackendError as exc:
        if job_id:
            await jm.fail_job(job_id, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    response = QuizOrchestrationResponse(
        backend_endpoint=result.endpoint,
        backend_status_code=result.status_code,
        backend_response=result.payload,
    )

    if job_id:
        result_data = result.payload or {}
        title = _derive_title(result_data, "quiz", payload.user_prompt)
        await jm.complete_job(job_id, result_data, title=title)

    return response


@app.post("/api/v1/orchestrate/quiz/stream")
async def orchestrate_quiz_stream(
    payload: QuizOrchestrationRequest,
    job_id: str | None = Query(None, alias="job_id"),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    backend = A2ABackendClient(settings)
    backend_payload = _build_quiz_backend_payload(payload)

    if job_id:
        await jm.start_job(job_id, step="streaming")

    async def event_stream() -> AsyncIterator[str]:
        yield json.dumps({"type": "status", "source": "main",
                          "message": "Main orchestrator accepted request and started stream.",
                          **({"job_id": job_id} if job_id else {})}, ensure_ascii=True) + "\n"

        if job_id:
            await jm.update_progress(job_id, step="forwarding", message="Forwarding to quiz backend via A2A.", progress=5.0)

        yield json.dumps({"type": "status", "source": "main",
                          "message": "Forwarding request to quiz backend via A2A."}, ensure_ascii=True) + "\n"

        final_payload: dict[str, Any] | None = None

        try:
            async for event in backend.stream_quiz_operation(backend_payload):
                event_type = str(event.get("type") or "").strip().lower()
                if event_type == "final":
                    final_payload = event.get("payload")
                    out = {"type": "final", "backend_endpoint": event.get("endpoint"),
                           "backend_status_code": event.get("status_code"),
                           "backend_response": final_payload}
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                elif event_type == "progress":
                    out = {"type": "progress", "source": "backend",
                           "stage": str(event.get("stage") or "progress"),
                           "message": str(event.get("message") or "Progress update received.")}
                    data = event.get("data")
                    if isinstance(data, dict):
                        out["data"] = data
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                    if job_id:
                        await jm.update_progress(job_id, step=out["stage"], message=out["message"])
                elif event_type == "status":
                    out = {"type": "status", "source": "backend",
                           "state": str(event.get("state") or "").strip().lower() or None,
                           "message": str(event.get("message") or "Backend status update received.")}
                    yield json.dumps(out, ensure_ascii=True) + "\n"
                    if job_id:
                        await jm.update_progress(job_id, step="backend_status", message=out["message"])
                elif event_type == "update":
                    raw_message = str(event.get("message") or "Backend update received.")
                    parsed_message = _parse_json_object(raw_message)
                    if isinstance(parsed_message, dict):
                        progress_payload = _extract_progress_payload(parsed_message)
                        if progress_payload is not None:
                            yield json.dumps(progress_payload, ensure_ascii=True) + "\n"
                            if job_id:
                                await jm.update_progress(job_id, step=str(progress_payload.get("stage", "progress")),
                                                         message=str(progress_payload.get("message", "")))
                            continue
                        if _looks_like_final_payload(parsed_message):
                            continue
                    yield json.dumps({"type": "update", "source": "backend", "message": raw_message}, ensure_ascii=True) + "\n"
                else:
                    yield json.dumps({"type": "update", "source": "backend",
                                      "message": f"Unhandled backend event: {event_type or 'unknown'}"}, ensure_ascii=True) + "\n"
        except A2ABackendError as exc:
            yield json.dumps({"type": "error", "source": "main", "message": "Quiz stream failed.",
                              "detail": str(exc)}, ensure_ascii=True) + "\n"
            if job_id:
                await jm.fail_job(job_id, str(exc))
            return
        except Exception as exc:
            yield json.dumps({"type": "error", "source": "main", "message": "Unhandled streaming error.",
                              "detail": str(exc)}, ensure_ascii=True) + "\n"
            if job_id:
                await jm.fail_job(job_id, str(exc))
            return

        if job_id and isinstance(final_payload, dict):
            title = _derive_title(final_payload, "quiz", payload.user_prompt)
            await jm.complete_job(job_id, final_payload, title=title)
        elif job_id:
            await jm.fail_job(job_id, "Stream ended without final payload.")

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"cache-control": "no-store", "x-accel-buffering": "no"},
    )

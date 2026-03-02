from __future__ import annotations

import asyncio
import hashlib
import mimetypes
from collections import defaultdict
from typing import Any
from urllib.parse import urlparse

import httpx

from . import database as db


class _EventBus:
    """In-process pub/sub for SSE broadcasting."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue[dict[str, Any] | None]]] = defaultdict(list)

    def subscribe(self, job_id: str) -> asyncio.Queue[dict[str, Any] | None]:
        q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self._subscribers[job_id].append(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue[dict[str, Any] | None]) -> None:
        subs = self._subscribers.get(job_id, [])
        if q in subs:
            subs.remove(q)
        if not subs:
            self._subscribers.pop(job_id, None)

    async def publish(self, job_id: str, event: dict[str, Any]) -> None:
        for q in self._subscribers.get(job_id, []):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def close_job(self, job_id: str) -> None:
        for q in self._subscribers.get(job_id, []):
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass


event_bus = _EventBus()


async def create_job(
    *,
    job_type: str,
    title: str,
    user_prompt: str,
    input_payload: dict[str, Any] | None = None,
    triggered_by: str = "user",
    engine: str = "",
    job_id: str | None = None,
) -> dict[str, Any]:
    job = await db.create_job(
        job_type=job_type,
        title=title,
        user_prompt=user_prompt,
        input_payload=input_payload,
        triggered_by=triggered_by,
        engine=engine,
        job_id=job_id,
    )
    await db.add_job_event(
        job["id"],
        event_type="status",
        level="info",
        message=f"Job created: {title}",
        metadata={"status": "queued"},
    )
    return job


async def start_job(job_id: str, step: str = "starting") -> dict[str, Any]:
    job = await db.update_job(job_id, status="processing", current_step=step, progress=0.0)
    evt = await db.add_job_event(
        job_id,
        event_type="status",
        level="info",
        message=f"Processing started: {step}",
        metadata={"status": "processing", "step": step},
    )
    await event_bus.publish(job_id, evt)
    return job


async def update_progress(
    job_id: str,
    *,
    step: str,
    message: str,
    progress: float | None = None,
    data: dict[str, Any] | None = None,
) -> None:
    updates: dict[str, Any] = {"current_step": step}
    if progress is not None:
        updates["progress"] = progress
    await db.update_job(job_id, **updates)
    evt = await db.add_job_event(
        job_id,
        event_type="progress",
        level="info",
        message=message,
        metadata={"step": step, "progress": progress, **(data or {})},
    )
    await event_bus.publish(job_id, evt)


async def complete_job(
    job_id: str,
    result_payload: dict[str, Any],
    *,
    title: str | None = None,
) -> dict[str, Any]:
    updates: dict[str, Any] = {
        "status": "completed",
        "progress": 100.0,
        "current_step": "done",
        "result_payload": result_payload,
    }
    if title:
        updates["title"] = title
    job = await db.update_job(job_id, **updates)
    evt = await db.add_job_event(
        job_id,
        event_type="status",
        level="success",
        message="Job completed successfully.",
        metadata={"status": "completed"},
    )
    await event_bus.publish(job_id, evt)
    await event_bus.close_job(job_id)
    return job


async def fail_job(job_id: str, error: str) -> dict[str, Any]:
    job = await db.update_job(
        job_id, status="failed", error_message=error, current_step="failed"
    )
    evt = await db.add_job_event(
        job_id,
        event_type="status",
        level="error",
        message=f"Job failed: {error}",
        metadata={"status": "failed", "error": error},
    )
    await event_bus.publish(job_id, evt)
    await event_bus.close_job(job_id)
    return job


async def download_and_store_assets(
    job_id: str,
    image_urls: list[str],
    asset_type: str = "image",
) -> list[dict[str, Any]]:
    assets_dir = db.get_assets_dir() / job_id
    assets_dir.mkdir(parents=True, exist_ok=True)

    stored: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for i, url in enumerate(image_urls):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "image/webp")
                mime = content_type.split(";")[0].strip()
                ext = mimetypes.guess_extension(mime) or _ext_from_url(url) or ".webp"
                url_hash = hashlib.sha256(url.encode()).hexdigest()[:12]
                filename = f"{asset_type}_{i:03d}_{url_hash}{ext}"
                filepath = assets_dir / filename
                filepath.write_bytes(resp.content)

                asset = await db.create_asset(
                    job_id=job_id,
                    asset_type=asset_type,
                    original_url=url,
                    stored_path=str(filepath),
                    filename=filename,
                    mime_type=mime,
                    size_bytes=len(resp.content),
                )
                stored.append(asset)

                await db.add_job_event(
                    job_id,
                    event_type="artifact",
                    level="info",
                    message=f"Asset downloaded: {filename}",
                    metadata={
                        "asset_id": asset["id"],
                        "filename": filename,
                        "original_url": url,
                        "size_bytes": len(resp.content),
                    },
                )
            except Exception as exc:
                await db.add_job_event(
                    job_id,
                    event_type="artifact",
                    level="warning",
                    message=f"Failed to download asset from {url}: {exc}",
                    metadata={"original_url": url, "error": str(exc)},
                )

    return stored


def _ext_from_url(url: str) -> str:
    path = urlparse(url).path
    if "." in path:
        return "." + path.rsplit(".", 1)[-1].lower()
    return ""

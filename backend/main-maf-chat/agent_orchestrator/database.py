from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import aiosqlite

_DB_DIR = Path(os.environ.get("DREAM_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
_DB_PATH = _DB_DIR / "dream_jobs.db"

_ASSETS_DIR = _DB_DIR / "assets"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid4())


_USE_NOLOCK = os.environ.get("DREAM_DB_NOLOCK", "").lower() in ("1", "true", "yes")


async def get_db() -> aiosqlite.Connection:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    if _USE_NOLOCK:
        uri = f"file:{_DB_PATH}?nolock=1"
        db = await aiosqlite.connect(uri, uri=True, timeout=30)
    else:
        db = await aiosqlite.connect(str(_DB_PATH), timeout=30)
    db.row_factory = aiosqlite.Row
    if _USE_NOLOCK:
        await db.execute("PRAGMA journal_mode=OFF")
    else:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    db = await get_db()
    try:
        await db.executescript(_SCHEMA_SQL)
        await db.commit()
    finally:
        await db.close()


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL CHECK(type IN ('character','story','video')),
    status          TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed')),
    title           TEXT NOT NULL DEFAULT '',
    user_prompt     TEXT NOT NULL DEFAULT '',
    input_payload   TEXT NOT NULL DEFAULT '{}',
    result_payload  TEXT NOT NULL DEFAULT '{}',
    progress        REAL NOT NULL DEFAULT 0.0,
    current_step    TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    triggered_by    TEXT NOT NULL DEFAULT 'user',
    engine          TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS job_events (
    id          TEXT PRIMARY KEY,
    job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL DEFAULT 'progress',
    level       TEXT NOT NULL DEFAULT 'info',
    message     TEXT NOT NULL DEFAULT '',
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created ON job_events(created_at);

CREATE TABLE IF NOT EXISTS assets (
    id            TEXT PRIMARY KEY,
    job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    asset_type    TEXT NOT NULL DEFAULT 'image',
    original_url  TEXT NOT NULL DEFAULT '',
    stored_path   TEXT NOT NULL DEFAULT '',
    filename      TEXT NOT NULL DEFAULT '',
    mime_type     TEXT NOT NULL DEFAULT 'image/webp',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    metadata      TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_job_id ON assets(job_id);
"""


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
    db = await get_db()
    try:
        jid = job_id or _uuid()
        now = _now_iso()
        await db.execute(
            """INSERT INTO jobs (id, type, status, title, user_prompt, input_payload,
                                triggered_by, engine, created_at, updated_at)
               VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)""",
            (jid, job_type, title, user_prompt,
             json.dumps(input_payload or {}, ensure_ascii=True),
             triggered_by, engine, now, now),
        )
        await db.commit()
        return await get_job(jid, db=db)
    finally:
        await db.close()


async def update_job(
    job_id: str,
    *,
    status: str | None = None,
    title: str | None = None,
    progress: float | None = None,
    current_step: str | None = None,
    result_payload: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> dict[str, Any]:
    db = await get_db()
    try:
        sets: list[str] = []
        vals: list[Any] = []
        if status is not None:
            sets.append("status = ?")
            vals.append(status)
        if title is not None:
            sets.append("title = ?")
            vals.append(title)
        if progress is not None:
            sets.append("progress = ?")
            vals.append(progress)
        if current_step is not None:
            sets.append("current_step = ?")
            vals.append(current_step)
        if result_payload is not None:
            sets.append("result_payload = ?")
            vals.append(json.dumps(result_payload, ensure_ascii=True))
        if error_message is not None:
            sets.append("error_message = ?")
            vals.append(error_message)
        if not sets:
            return await get_job(job_id, db=db)
        sets.append("updated_at = ?")
        vals.append(_now_iso())
        vals.append(job_id)
        await db.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", vals)
        await db.commit()
        return await get_job(job_id, db=db)
    finally:
        await db.close()


async def get_job(job_id: str, *, db: aiosqlite.Connection | None = None) -> dict[str, Any]:
    close = db is None
    if db is None:
        db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        if row is None:
            return {}
        job = _row_to_dict(row)
        job["input_payload"] = json.loads(job.get("input_payload") or "{}")
        job["result_payload"] = json.loads(job.get("result_payload") or "{}")

        asset_cursor = await db.execute(
            "SELECT * FROM assets WHERE job_id = ? ORDER BY created_at", (job_id,)
        )
        asset_rows = await asset_cursor.fetchall()
        job["assets"] = [_row_to_dict(a) for a in asset_rows]
        for a in job["assets"]:
            a["metadata"] = json.loads(a.get("metadata") or "{}")

        return job
    finally:
        if close:
            await db.close()


async def list_jobs(
    *,
    job_type: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    summary: bool = False,
) -> list[dict[str, Any]]:
    db = await get_db()
    try:
        wheres: list[str] = []
        vals: list[Any] = []
        if job_type:
            wheres.append("type = ?")
            vals.append(job_type)
        if status:
            wheres.append("status = ?")
            vals.append(status)
        where_clause = f"WHERE {' AND '.join(wheres)}" if wheres else ""
        vals.extend([limit, offset])
        select_cols = (
            "id, type, status, title, user_prompt, input_payload, progress, current_step, "
            "error_message, triggered_by, engine, created_at, updated_at"
            if summary
            else "*"
        )
        cursor = await db.execute(
            f"SELECT {select_cols} FROM jobs {where_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            vals,
        )
        rows = await cursor.fetchall()
        jobs = []
        for row in rows:
            job = _row_to_dict(row)
            job["input_payload"] = json.loads(job.get("input_payload") or "{}")
            if summary:
                job["result_payload"] = {"_summary": True}
            else:
                job["result_payload"] = json.loads(job.get("result_payload") or "{}")
            asset_cursor = await db.execute(
                "SELECT * FROM assets WHERE job_id = ? ORDER BY created_at"
                + (" LIMIT 3" if summary else ""),
                (job["id"],),
            )
            asset_rows = await asset_cursor.fetchall()
            job["assets"] = [_row_to_dict(a) for a in asset_rows]
            for a in job["assets"]:
                a["metadata"] = json.loads(a.get("metadata") or "{}")
            jobs.append(job)
        return jobs
    finally:
        await db.close()


async def delete_job(job_id: str) -> bool:
    db = await get_db()
    asset_paths: list[Path] = []
    assets_root = get_assets_dir().resolve()
    job_dir = (get_assets_dir() / job_id).resolve()

    try:
        exists_cursor = await db.execute("SELECT id FROM jobs WHERE id = ?", (job_id,))
        exists_row = await exists_cursor.fetchone()
        if exists_row is None:
            return False

        asset_cursor = await db.execute(
            "SELECT stored_path FROM assets WHERE job_id = ?",
            (job_id,),
        )
        asset_rows = await asset_cursor.fetchall()
        for row in asset_rows:
            raw_path = str(row["stored_path"] or "").strip()
            if not raw_path:
                continue
            candidate = Path(raw_path)
            if not candidate.is_absolute():
                candidate = (_DB_DIR / candidate).resolve()
            else:
                candidate = candidate.resolve()
            asset_paths.append(candidate)

        await db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        await db.commit()
    finally:
        await db.close()

    for asset_path in asset_paths:
        try:
            if not str(asset_path).startswith(str(assets_root)):
                continue
            if asset_path.exists() and asset_path.is_file():
                asset_path.unlink()
        except Exception:
            continue

    try:
        if str(job_dir).startswith(str(assets_root)) and job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
    except Exception:
        pass

    return True


async def add_job_event(
    job_id: str,
    *,
    event_type: str = "progress",
    level: str = "info",
    message: str = "",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    db = await get_db()
    try:
        eid = _uuid()
        now = _now_iso()
        await db.execute(
            """INSERT INTO job_events (id, job_id, event_type, level, message, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (eid, job_id, event_type, level, message,
             json.dumps(metadata or {}, ensure_ascii=True), now),
        )
        await db.commit()
        return {"id": eid, "job_id": job_id, "event_type": event_type,
                "level": level, "message": message, "metadata": metadata or {},
                "created_at": now}
    finally:
        await db.close()


async def get_job_events(
    job_id: str,
    *,
    after: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    db = await get_db()
    try:
        if after:
            cursor = await db.execute(
                """SELECT * FROM job_events WHERE job_id = ? AND created_at > ?
                   ORDER BY created_at LIMIT ?""",
                (job_id, after, limit),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at LIMIT ?",
                (job_id, limit),
            )
        rows = await cursor.fetchall()
        events = []
        for row in rows:
            e = _row_to_dict(row)
            e["metadata"] = json.loads(e.get("metadata") or "{}")
            events.append(e)
        return events
    finally:
        await db.close()


async def create_asset(
    *,
    job_id: str,
    asset_type: str,
    original_url: str,
    stored_path: str,
    filename: str,
    mime_type: str = "image/webp",
    size_bytes: int = 0,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    db = await get_db()
    try:
        aid = _uuid()
        now = _now_iso()
        await db.execute(
            """INSERT INTO assets (id, job_id, asset_type, original_url, stored_path,
                                  filename, mime_type, size_bytes, metadata, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (aid, job_id, asset_type, original_url, stored_path, filename,
             mime_type, size_bytes, json.dumps(metadata or {}, ensure_ascii=True), now),
        )
        await db.commit()
        return {"id": aid, "job_id": job_id, "asset_type": asset_type,
                "original_url": original_url, "stored_path": stored_path,
                "filename": filename, "mime_type": mime_type,
                "size_bytes": size_bytes, "metadata": metadata or {},
                "created_at": now}
    finally:
        await db.close()


def get_assets_dir() -> Path:
    _ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    return _ASSETS_DIR


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return dict(row)

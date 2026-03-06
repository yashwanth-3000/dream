from __future__ import annotations

import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import aiosqlite

_DB_DIR = Path(os.environ.get("DREAM_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
_DB_PATH = _DB_DIR / "dream_jobs.db"
_ASSETS_DIR = _DB_DIR / "assets"
_USE_NOLOCK = os.environ.get("DREAM_DB_NOLOCK", "").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Persistent connection singleton — eliminates per-request open/close overhead
# on Azure Files (NFS) which adds 100-500 ms per connection open.
# ---------------------------------------------------------------------------
_db: aiosqlite.Connection | None = None

# ---------------------------------------------------------------------------
# In-memory cache for list_jobs results (30-second TTL).
# Drastically reduces Azure Files reads for dashboard/list pages.
# ---------------------------------------------------------------------------
_list_jobs_cache: dict[str, tuple[list[dict[str, Any]], float]] = {}
_LIST_JOBS_CACHE_TTL = 30.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid4())


def _invalidate_list_cache() -> None:
    _list_jobs_cache.clear()


async def get_db() -> aiosqlite.Connection:
    """Return the persistent DB connection, creating it if needed."""
    global _db
    if _db is not None:
        return _db
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    if _USE_NOLOCK:
        uri = f"file:{_DB_PATH}?nolock=1"
        conn = await aiosqlite.connect(uri, uri=True, timeout=30)
    else:
        conn = await aiosqlite.connect(str(_DB_PATH), timeout=30)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA busy_timeout=5000")
    await conn.execute("PRAGMA foreign_keys=ON")
    if _USE_NOLOCK:
        await conn.execute("PRAGMA journal_mode=OFF")
    else:
        await conn.execute("PRAGMA journal_mode=WAL")
    _db = conn
    return _db


async def get_read_db() -> aiosqlite.Connection:
    """Return the persistent connection for read operations (same as write under WAL)."""
    return await get_db()


async def init_db() -> None:
    db = await get_db()
    await db.executescript(_SCHEMA_SQL)
    await _migrate_jobs_table_for_quiz(db)
    await db.commit()


async def _jobs_table_supports_quiz(db: aiosqlite.Connection) -> bool:
    cursor = await db.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'"
    )
    row = await cursor.fetchone()
    if row is None:
        return False
    create_sql = str(row["sql"] or "").lower()
    return "'quiz'" in create_sql


async def _migrate_jobs_table_for_quiz(db: aiosqlite.Connection) -> None:
    if await _jobs_table_supports_quiz(db):
        return

    await db.execute("PRAGMA foreign_keys=OFF")
    try:
        await db.execute("DROP TABLE IF EXISTS jobs__new")
        await db.execute(
            """
            CREATE TABLE jobs__new (
                id              TEXT PRIMARY KEY,
                type            TEXT NOT NULL CHECK(type IN ('character','story','video','quiz')),
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
            )
            """
        )
        await db.execute(
            """
            INSERT INTO jobs__new (
                id, type, status, title, user_prompt, input_payload, result_payload, progress,
                current_step, error_message, triggered_by, engine, created_at, updated_at
            )
            SELECT
                id, type, status, title, user_prompt, input_payload, result_payload, progress,
                current_step, error_message, triggered_by, engine, created_at, updated_at
            FROM jobs
            """
        )
        await db.execute("DROP TABLE jobs")
        await db.execute("ALTER TABLE jobs__new RENAME TO jobs")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC)")
    finally:
        await db.execute("PRAGMA foreign_keys=ON")


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL CHECK(type IN ('character','story','video','quiz')),
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
    _invalidate_list_cache()
    return await get_job(jid)


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
        return await get_job(job_id)
    sets.append("updated_at = ?")
    vals.append(_now_iso())
    vals.append(job_id)
    await db.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", vals)
    await db.commit()
    _invalidate_list_cache()
    return await get_job(job_id)


async def get_job(job_id: str, *, db: aiosqlite.Connection | None = None) -> dict[str, Any]:
    conn = await get_db()
    cursor = await conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    row = await cursor.fetchone()
    if row is None:
        return {}
    job = _row_to_dict(row)
    job["input_payload"] = json.loads(job.get("input_payload") or "{}")
    job["result_payload"] = json.loads(job.get("result_payload") or "{}")

    asset_cursor = await conn.execute(
        "SELECT * FROM assets WHERE job_id = ? ORDER BY created_at", (job_id,)
    )
    asset_rows = await asset_cursor.fetchall()
    job["assets"] = [_row_to_dict(a) for a in asset_rows]
    for a in job["assets"]:
        a["metadata"] = json.loads(a.get("metadata") or "{}")

    return job


async def list_jobs(
    *,
    job_type: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    summary: bool = False,
) -> list[dict[str, Any]]:
    cache_key = f"{job_type}|{status}|{limit}|{offset}|{summary}"
    cached = _list_jobs_cache.get(cache_key)
    if cached is not None:
        result, ts = cached
        if time.monotonic() - ts < _LIST_JOBS_CACHE_TTL:
            return result

    db = await get_db()
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
        "id, type, status, title, user_prompt, progress, current_step, "
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
        if summary:
            job["input_payload"] = {}
            job["result_payload"] = {"_summary": True}
        else:
            job["input_payload"] = json.loads(job.get("input_payload") or "{}")
            job["result_payload"] = json.loads(job.get("result_payload") or "{}")
        job["assets"] = []
        jobs.append(job)

    if not jobs:
        _list_jobs_cache[cache_key] = (jobs, time.monotonic())
        return jobs

    job_ids = [str(job["id"]) for job in jobs]
    placeholders = ",".join(["?"] * len(job_ids))
    if summary:
        asset_sql = (
            "SELECT id, job_id, asset_type, original_url, stored_path, filename, mime_type, size_bytes, metadata, created_at "
            "FROM ("
            "  SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.job_id ORDER BY a.created_at) AS rn "
            f"  FROM assets a WHERE a.job_id IN ({placeholders})"
            ") ranked "
            "WHERE rn <= 3 ORDER BY created_at"
        )
    else:
        asset_sql = f"SELECT * FROM assets WHERE job_id IN ({placeholders}) ORDER BY created_at"

    asset_cursor = await db.execute(asset_sql, job_ids)
    asset_rows = await asset_cursor.fetchall()
    assets_by_job: dict[str, list[dict[str, Any]]] = {}
    for asset_row in asset_rows:
        asset = _row_to_dict(asset_row)
        asset["metadata"] = json.loads(asset.get("metadata") or "{}")
        assets_by_job.setdefault(str(asset.get("job_id") or ""), []).append(asset)

    for job in jobs:
        job["assets"] = assets_by_job.get(str(job["id"]), [])

    _list_jobs_cache[cache_key] = (jobs, time.monotonic())
    return jobs


async def delete_job(job_id: str) -> bool:
    db = await get_db()
    asset_paths: list[Path] = []
    assets_root = get_assets_dir().resolve()
    job_dir = (get_assets_dir() / job_id).resolve()

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
    _invalidate_list_cache()

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


async def get_job_events(
    job_id: str,
    *,
    after: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    db = await get_db()
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
    _invalidate_list_cache()
    return {"id": aid, "job_id": job_id, "asset_type": asset_type,
            "original_url": original_url, "stored_path": stored_path,
            "filename": filename, "mime_type": mime_type,
            "size_bytes": size_bytes, "metadata": metadata or {},
            "created_at": now}


def get_assets_dir() -> Path:
    _ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    return _ASSETS_DIR


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return dict(row)

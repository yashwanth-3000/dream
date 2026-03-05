from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class Citation(BaseModel):
    title: str = "Untitled source"
    url: str | None = None
    snippet: str | None = None
    published_date: str | None = None
    source: str = "unknown"
    score: float | None = None


class RetrievalDiagnostics(BaseModel):
    provider: str
    used_fallback: bool = False
    errors: list[str] = Field(default_factory=list)
    raw: dict[str, Any] | None = None


class RetrievalResult(BaseModel):
    provider: str
    citations: list[Citation] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    diagnostics: RetrievalDiagnostics

    @property
    def has_evidence(self) -> bool:
        return bool(self.citations or self.evidence)

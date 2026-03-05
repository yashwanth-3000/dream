from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx

from ..config import Settings


@dataclass(slots=True)
class ModerationCheck:
    stage: str
    blocked: bool
    threshold: int
    provider: str = "azure_content_safety"
    scores: dict[str, int] = field(default_factory=dict)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AzureContentSafetyGuard:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return self._settings.azure_content_safety_enabled

    async def analyze(self, *, text: str, stage: str) -> ModerationCheck:
        if not self.enabled:
            return ModerationCheck(
                stage=stage,
                blocked=False,
                threshold=self._settings.azure_content_safety_block_severity,
                scores={},
                error="Azure Content Safety is disabled.",
            )

        endpoint = (self._settings.azure_content_safety_endpoint or "").strip()
        api_key = (self._settings.azure_content_safety_api_key or "").strip()
        if not endpoint or not api_key:
            return ModerationCheck(
                stage=stage,
                blocked=False,
                threshold=self._settings.azure_content_safety_block_severity,
                scores={},
                error=(
                    "Azure Content Safety is enabled but endpoint or api key is missing. "
                    "Set AZURE_CONTENT_SAFETY_ENDPOINT and AZURE_CONTENT_SAFETY_API_KEY."
                ),
            )

        cleaned = re.sub(r"\s+", " ", (text or "")).strip()
        if not cleaned:
            return ModerationCheck(
                stage=stage,
                blocked=False,
                threshold=self._settings.azure_content_safety_block_severity,
                scores={},
            )

        url = (
            f"{endpoint.rstrip('/')}/contentsafety/text:analyze"
            f"?api-version={self._settings.azure_content_safety_api_version}"
        )
        headers = {
            "content-type": "application/json",
            "Ocp-Apim-Subscription-Key": api_key,
        }
        payload = {
            "text": cleaned,
            "categories": ["Hate", "SelfHarm", "Sexual", "Violence"],
            "outputType": "FourSeverityLevels",
        }

        try:
            async with httpx.AsyncClient(timeout=self._settings.azure_content_safety_timeout_seconds) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json() if response.content else {}
        except Exception as exc:
            if self._settings.azure_content_safety_fail_open:
                return ModerationCheck(
                    stage=stage,
                    blocked=False,
                    threshold=self._settings.azure_content_safety_block_severity,
                    scores={},
                    error=f"Azure Content Safety call failed (fail-open): {exc}",
                )
            raise

        scores = self._extract_scores(data)
        threshold = self._settings.azure_content_safety_block_severity
        blocked = any(score >= threshold for score in scores.values())

        return ModerationCheck(
            stage=stage,
            blocked=blocked,
            threshold=threshold,
            scores=scores,
        )

    def _extract_scores(self, payload: Any) -> dict[str, int]:
        if not isinstance(payload, dict):
            return {}

        analysis = payload.get("categoriesAnalysis")
        if not isinstance(analysis, list):
            return {}

        scores: dict[str, int] = {}
        for item in analysis:
            if not isinstance(item, dict):
                continue
            category = str(item.get("category") or "").strip() or "unknown"
            severity = item.get("severity")
            if isinstance(severity, int):
                scores[category] = severity
            elif isinstance(severity, float):
                scores[category] = int(round(severity))

        return scores

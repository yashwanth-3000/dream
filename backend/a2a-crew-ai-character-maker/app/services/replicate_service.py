from __future__ import annotations

import base64
import re
from typing import Any

import replicate


class ReplicateGenerationError(RuntimeError):
    pass


class ReplicateImageService:
    def __init__(
        self,
        api_token: str,
        model: str,
        default_output_count: int = 1,
        default_aspect_ratio: str = "3:4",
    ) -> None:
        self._client = replicate.Client(api_token=api_token)
        self._model = model
        self._default_output_count = default_output_count
        self._default_aspect_ratio = default_aspect_ratio

    @property
    def model(self) -> str:
        return self._model

    def generate_character_images(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        output_count: int | None = None,
        aspect_ratio: str | None = None,
        reference_images: list[str] | None = None,
    ) -> list[str]:
        output_count = output_count or self._default_output_count
        aspect_ratio = aspect_ratio or self._default_aspect_ratio

        candidate_payloads = self._build_payload_candidates(
            prompt=prompt,
            negative_prompt=negative_prompt,
            output_count=output_count,
            aspect_ratio=aspect_ratio,
            reference_images=reference_images or [],
        )

        last_error: Exception | None = None
        for payload in candidate_payloads:
            try:
                raw_output = self._client.run(self._model, input=payload)
                urls = self._coerce_output_urls(raw_output)
                if urls:
                    return urls
            except Exception as exc:
                last_error = exc
                continue

        detail = str(last_error) if last_error else "Replicate returned no output."
        raise ReplicateGenerationError(f"Replicate generation failed: {detail}")

    def _build_payload_candidates(
        self,
        prompt: str,
        negative_prompt: str | None,
        output_count: int,
        aspect_ratio: str,
        reference_images: list[str],
    ) -> list[dict[str, Any]]:
        base_payload: dict[str, Any] = {
            "prompt": prompt,
            "num_outputs": output_count,
            "aspect_ratio": aspect_ratio,
        }
        if negative_prompt:
            base_payload["negative_prompt"] = negative_prompt

        payloads: list[dict[str, Any]] = []
        normalized_references = self._normalize_reference_images(reference_images)
        if normalized_references:
            primary_image = normalized_references[0]
            for key in (
                "input_image",
                "reference_image",
                "image",
                "image_prompt",
            ):
                candidate = dict(base_payload)
                candidate[key] = primary_image
                payloads.append(candidate)

            candidate_multi_input = dict(base_payload)
            candidate_multi_input["input_images"] = normalized_references
            payloads.append(candidate_multi_input)

            candidate_multi_ref = dict(base_payload)
            candidate_multi_ref["reference_images"] = normalized_references
            payloads.append(candidate_multi_ref)

        payloads.append(dict(base_payload))
        payloads.append({"prompt": prompt})
        return payloads

    def _normalize_reference_images(self, reference_images: list[str]) -> list[Any]:
        normalized: list[Any] = []
        for item in reference_images:
            value = item.strip()
            if not value:
                continue

            data_url = self._decode_data_url(value)
            if data_url is not None:
                normalized.append(data_url)
                normalized.append(value)
                continue

            normalized.append(value)
        return normalized

    def _decode_data_url(self, value: str) -> bytes | None:
        match = re.match(r"^data:[^;]+;base64,(.+)$", value, flags=re.DOTALL)
        if not match:
            return None

        payload = match.group(1).strip()
        try:
            return base64.b64decode(payload, validate=True)
        except Exception:
            return None

    def _coerce_output_urls(self, raw_output: Any) -> list[str]:
        if raw_output is None:
            return []

        if isinstance(raw_output, str):
            return [raw_output]

        if isinstance(raw_output, list):
            urls: list[str] = []
            for item in raw_output:
                url = self._extract_url(item)
                if url:
                    urls.append(url)
            return urls

        if isinstance(raw_output, dict):
            urls: list[str] = []
            for key in ("output", "outputs", "images"):
                val = raw_output.get(key)
                if isinstance(val, list):
                    urls.extend([u for u in (self._extract_url(v) for v in val) if u])
            return urls

        url = self._extract_url(raw_output)
        return [url] if url else []

    def _extract_url(self, item: Any) -> str | None:
        if item is None:
            return None

        if isinstance(item, str):
            return item

        for attr in ("url", "uri"):
            if hasattr(item, attr):
                value = getattr(item, attr)
                if callable(value):
                    value = value()
                if isinstance(value, str):
                    return value

        text = str(item)
        return text if text.startswith("http") else None

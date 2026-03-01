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
        default_aspect_ratio: str = "2:3",
        default_quality: str = "medium",
        default_background: str = "auto",
        default_moderation: str = "auto",
        default_output_format: str = "webp",
        default_input_fidelity: str = "high",
        default_output_compression: int = 90,
    ) -> None:
        self._client = replicate.Client(api_token=api_token)
        self._model = model
        self._default_output_count = default_output_count
        self._default_aspect_ratio = default_aspect_ratio
        self._default_quality = default_quality
        self._default_background = default_background
        self._default_moderation = default_moderation
        self._default_output_format = default_output_format
        self._default_input_fidelity = default_input_fidelity
        self._default_output_compression = default_output_compression

    @property
    def model(self) -> str:
        return self._model

    def generate_story_image(
        self,
        prompt: str,
        negative_prompt: str | None = None,
        output_count: int | None = None,
        aspect_ratio: str | None = None,
        reference_images: list[str] | None = None,
    ) -> str:
        output_count = output_count or self._default_output_count
        aspect_ratio = aspect_ratio or self._default_aspect_ratio

        payload_candidates = self._build_payload_candidates(
            prompt=prompt,
            negative_prompt=negative_prompt,
            output_count=output_count,
            aspect_ratio=aspect_ratio,
            reference_images=reference_images or [],
        )

        last_error: Exception | None = None
        for payload in payload_candidates:
            try:
                raw_output = self._client.run(self._model, input=payload)
                urls = self._coerce_output_urls(raw_output)
                if urls:
                    return urls[0]
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
        if self._is_gpt_image_model():
            return [
                self._build_gpt_image_payload(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    output_count=output_count,
                    aspect_ratio=aspect_ratio,
                    reference_images=reference_images,
                )
            ]

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
            for key in ("input_image", "reference_image", "image", "image_prompt"):
                candidate = dict(base_payload)
                candidate[key] = primary_image
                payloads.append(candidate)

            candidate_multi_input = dict(base_payload)
            candidate_multi_input["input_images"] = normalized_references
            payloads.append(candidate_multi_input)

            candidate_multi_ref = dict(base_payload)
            candidate_multi_ref["reference_images"] = normalized_references
            payloads.append(candidate_multi_ref)

            # Strict reference mode: when references are provided, do not silently fall back to
            # prompt-only payloads. This guarantees every generation attempt includes references.
            return payloads

        payloads.append(dict(base_payload))
        payloads.append({"prompt": prompt})
        return payloads

    def _build_gpt_image_payload(
        self,
        prompt: str,
        negative_prompt: str | None,
        output_count: int,
        aspect_ratio: str,
        reference_images: list[str],
    ) -> dict[str, Any]:
        normalized_references = self._normalize_reference_images(reference_images)
        enhanced_prompt = self._compose_prompt(prompt=prompt, negative_prompt=negative_prompt)

        payload: dict[str, Any] = {
            "prompt": enhanced_prompt,
            "quality": self._default_quality,
            "background": self._default_background,
            "moderation": self._default_moderation,
            "aspect_ratio": aspect_ratio,
            "output_format": self._default_output_format,
            "input_fidelity": self._default_input_fidelity if normalized_references else "low",
            "number_of_images": output_count,
            "output_compression": self._default_output_compression,
        }
        if normalized_references:
            payload["input_images"] = normalized_references
        return payload

    def _normalize_reference_images(self, reference_images: list[str]) -> list[Any]:
        normalized: list[Any] = []
        for item in reference_images:
            value = item.strip()
            if not value:
                continue

            if self._is_gpt_image_model():
                normalized.append(value)
                continue

            data_bytes = self._decode_data_url(value)
            if data_bytes is not None:
                normalized.append(data_bytes)
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

    def _is_gpt_image_model(self) -> bool:
        return self._model.strip().lower().startswith("openai/gpt-image-1.5")

    def _compose_prompt(self, prompt: str, negative_prompt: str | None) -> str:
        constraints = [
            "Treat input reference image #1 as the canonical character identity lock.",
            "Match the original character drawings and generated character sheets exactly.",
            "Keep face shape, hairstyle, skin tone, body proportions, and outfit silhouette consistent across all scenes.",
            "Use a polished 2D children's storybook illustration style (non-photorealistic).",
            "Do not render any text, letters, words, numbers, logos, watermarks, subtitles, or captions in the image.",
        ]
        if negative_prompt and negative_prompt.strip():
            constraints.append(f"Avoid: {negative_prompt.strip()}")
        return (
            f"{prompt.strip()}\n\n"
            "Hard constraints:\n"
            + "\n".join(f"- {item}" for item in constraints)
        ).strip()

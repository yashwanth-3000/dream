from __future__ import annotations

import base64
from collections.abc import Iterable

from openai import OpenAI


DEFAULT_TTS_MODEL_FALLBACKS = (
    "gpt-4o-mini-tts",
    "tts-1",
)

AUDIO_MIME_BY_FORMAT = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "opus": "audio/ogg",
    "flac": "audio/flac",
}


class AudioSynthesisError(RuntimeError):
    pass


class OpenAITTSService:
    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gpt-4o-mini-tts",
        voice: str = "alloy",
        response_format: str = "mp3",
        speed: float = 1.0,
    ) -> None:
        self._client = OpenAI(api_key=api_key)
        self._model = (model or "gpt-4o-mini-tts").strip()
        self._voice = (voice or "alloy").strip()
        self._response_format = (response_format or "mp3").strip().lower()
        self._speed = speed

    def synthesize_text_to_data_url(self, text: str) -> str:
        normalized = " ".join((text or "").split()).strip()
        if not normalized:
            raise AudioSynthesisError("Audio synthesis failed: empty input text.")

        audio_bytes = self._synthesize_bytes(normalized)
        if not audio_bytes:
            raise AudioSynthesisError("Audio synthesis failed: OpenAI returned empty audio bytes.")

        encoded = base64.b64encode(audio_bytes).decode("ascii")
        mime_type = AUDIO_MIME_BY_FORMAT.get(self._response_format, "audio/mpeg")
        return f"data:{mime_type};base64,{encoded}"

    def _synthesize_bytes(self, text: str) -> bytes:
        errors: list[str] = []
        for model in self._model_candidates():
            kwargs: dict[str, object] = {
                "model": model,
                "voice": self._voice,
                "input": text,
            }
            if self._speed != 1.0:
                kwargs["speed"] = self._speed

            try:
                try:
                    response = self._client.audio.speech.create(
                        **kwargs,
                        format=self._response_format,
                    )
                except TypeError:
                    response = self._client.audio.speech.create(
                        **kwargs,
                        response_format=self._response_format,
                    )
            except Exception as exc:
                errors.append(f"model={model}: {exc}")
                continue

            output_bytes = self._extract_bytes(response)
            if output_bytes:
                return output_bytes

            errors.append(f"model={model}: returned empty/unsupported response payload")

        detail = " | ".join(errors[:4]) if errors else "unknown"
        raise AudioSynthesisError(f"Audio synthesis failed across model candidates: {detail}")

    def _model_candidates(self) -> Iterable[str]:
        candidates: list[str] = []
        for value in (self._model, *DEFAULT_TTS_MODEL_FALLBACKS):
            normalized = (value or "").strip()
            if normalized and normalized not in candidates:
                candidates.append(normalized)
        return candidates

    def _extract_bytes(self, response: object) -> bytes:
        if isinstance(response, (bytes, bytearray)):
            return bytes(response)

        content = getattr(response, "content", None)
        if isinstance(content, (bytes, bytearray)):
            return bytes(content)

        read_fn = getattr(response, "read", None)
        if callable(read_fn):
            try:
                data = read_fn()
            except TypeError:
                data = read_fn(0)
            except Exception:
                data = None
            if isinstance(data, (bytes, bytearray)):
                return bytes(data)

        iter_bytes_fn = getattr(response, "iter_bytes", None)
        if callable(iter_bytes_fn):
            try:
                chunks = list(iter_bytes_fn())
            except Exception:
                chunks = []
            if chunks:
                joined = b"".join(chunk for chunk in chunks if isinstance(chunk, (bytes, bytearray)))
                if joined:
                    return joined

        getvalue_fn = getattr(response, "getvalue", None)
        if callable(getvalue_fn):
            try:
                data = getvalue_fn()
            except Exception:
                data = None
            if isinstance(data, (bytes, bytearray)):
                return bytes(data)

        return b""

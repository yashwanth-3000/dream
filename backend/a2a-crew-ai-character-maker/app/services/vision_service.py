from __future__ import annotations

from typing import Any

from openai import OpenAI


class VisionDescriptionError(RuntimeError):
    pass


class OpenAIVisionService:
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4.1-mini",
        max_tokens: int = 500,
    ) -> None:
        self._client = OpenAI(api_key=api_key)
        self._model = model
        self._max_tokens = max_tokens

    def describe_character_drawing(self, image_input: str, user_hint: str = "") -> str:
        instruction = (
            "Analyze this character drawing and produce a concise but specific visual description "
            "for downstream character generation. Focus on: face/hair, body build, pose, outfit, "
            "materials, accessories, weapons/props, mood, art style cues, and silhouette-defining elements."
        )
        if user_hint.strip():
            instruction += f" User hint: {user_hint.strip()}"

        return self._describe_with_instruction(image_input=image_input, instruction=instruction)

    def describe_world_reference(self, image_input: str, user_hint: str = "") -> str:
        instruction = (
            "Analyze this world reference image and describe environment and lore-relevant visual cues "
            "for character/world consistency. Focus on: architecture, materials, era, technology level, "
            "cultural motifs, mood, color palette, and setting-defining symbols."
        )
        if user_hint.strip():
            instruction += f" User hint: {user_hint.strip()}"

        return self._describe_with_instruction(image_input=image_input, instruction=instruction)

    def _describe_with_instruction(self, image_input: str, instruction: str) -> str:
        if not image_input.strip():
            raise VisionDescriptionError("Vision description failed: image input is empty.")

        chat_message = [
            {"type": "text", "text": instruction},
            {"type": "image_url", "image_url": {"url": image_input}},
        ]

        chat_error: Exception | None = None
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": chat_message}],
                temperature=0.2,
                max_tokens=self._max_tokens,
            )
            content = response.choices[0].message.content
            text = self._content_to_text(content)
            if text:
                return text
        except Exception as exc:
            chat_error = exc

        try:
            response = self._client.responses.create(
                model=self._model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": instruction},
                            {"type": "input_image", "image_url": image_input},
                        ],
                    }
                ],
                max_output_tokens=self._max_tokens,
            )
            text = getattr(response, "output_text", "") or self._extract_responses_text(response)
            if text:
                return text
        except Exception as exc:
            detail = str(exc)
            if chat_error is not None:
                detail = f"chat={chat_error}; responses={exc}"
            raise VisionDescriptionError(f"Vision description failed: {detail}") from exc

        raise VisionDescriptionError("Vision description failed: empty response.")

    def _content_to_text(self, content: Any) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, str):
                    chunks.append(item.strip())
                    continue
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    chunks.append(text.strip())
                    continue
                if isinstance(item, dict):
                    for key in ("text", "content", "value"):
                        value = item.get(key)
                        if isinstance(value, str):
                            chunks.append(value.strip())
                            break
            return "\n".join([chunk for chunk in chunks if chunk]).strip()
        return str(content).strip()

    def _extract_responses_text(self, response: Any) -> str:
        output = getattr(response, "output", None)
        if not isinstance(output, list):
            return ""

        collected: list[str] = []
        for item in output:
            content = getattr(item, "content", None)
            if not isinstance(content, list):
                continue
            for content_item in content:
                text = getattr(content_item, "text", None)
                if isinstance(text, str):
                    collected.append(text.strip())
        return "\n".join([c for c in collected if c]).strip()

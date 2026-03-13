from __future__ import annotations

from typing import Any

import httpx

from ..config import Settings


class AzureOpenAIEmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def endpoint(self) -> str:
        return (
            (self._settings.azure_openai_embedding_endpoint or "").strip()
            or (self._settings.azure_openai_endpoint or "").strip()
        )

    @property
    def api_key(self) -> str:
        return (
            (self._settings.azure_openai_embedding_api_key or "").strip()
            or (self._settings.azure_openai_api_key or "").strip()
        )

    @property
    def deployment(self) -> str:
        return (self._settings.azure_openai_embedding_deployment_name or "").strip()

    @property
    def api_version(self) -> str:
        return (self._settings.azure_openai_embedding_api_version or "").strip() or "2024-10-21"

    @property
    def configured(self) -> bool:
        return bool(self.endpoint and self.api_key and self.deployment)

    async def embed_text(self, text: str) -> list[float]:
        embeddings = await self.embed_texts([text])
        return embeddings[0]

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        clean_texts = [" ".join((text or "").split()).strip() for text in texts]
        clean_texts = [text for text in clean_texts if text]
        if not clean_texts:
            return []

        missing: list[str] = []
        if not self.endpoint:
            missing.append("AZURE_OPENAI_EMBEDDING_ENDPOINT")
        if not self.api_key:
            missing.append("AZURE_OPENAI_EMBEDDING_API_KEY")
        if not self.deployment:
            missing.append("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")
        if missing:
            raise RuntimeError(
                "Azure OpenAI embedding configuration is incomplete. Missing: "
                + ", ".join(missing)
            )

        url = (
            f"{self.endpoint.rstrip('/')}/openai/deployments/"
            f"{self.deployment}/embeddings"
        )
        params = {"api-version": self.api_version}
        headers = {
            "content-type": "application/json",
            "api-key": self.api_key,
        }

        results: list[list[float]] = []
        batch_size = 16
        timeout = self._settings.azure_search_timeout_seconds

        async with httpx.AsyncClient(timeout=timeout) as client:
            for start in range(0, len(clean_texts), batch_size):
                batch = clean_texts[start : start + batch_size]
                response = await client.post(
                    url,
                    params=params,
                    headers=headers,
                    json={"input": batch},
                )
                try:
                    response.raise_for_status()
                except Exception as exc:
                    body_preview = (response.text or "").strip().replace("\n", " ")[:700]
                    raise RuntimeError(
                        f"Azure OpenAI embeddings request failed: {exc}. body={body_preview}"
                    ) from exc

                payload = response.json() if response.content else {}
                data = payload.get("data")
                if not isinstance(data, list) or len(data) != len(batch):
                    raise RuntimeError("Azure OpenAI embeddings response returned unexpected data.")

                ordered = sorted(
                    [item for item in data if isinstance(item, dict)],
                    key=lambda item: int(item.get("index", 0)),
                )
                for item in ordered:
                    embedding = item.get("embedding")
                    if not isinstance(embedding, list):
                        raise RuntimeError("Azure OpenAI embeddings response omitted an embedding vector.")
                    vector = [float(value) for value in embedding]
                    results.append(vector)

        return results

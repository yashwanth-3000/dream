from __future__ import annotations


def ensure_agent_framework_semconv_compat() -> list[str]:
    """Patch missing legacy SpanAttributes expected by agent-framework 1.0.0rc1."""
    try:
        from opentelemetry.semconv_ai import SpanAttributes
    except Exception:
        return []

    compat_attrs = {
        "LLM_SYSTEM": "llm.system",
        "LLM_REQUEST_MODEL": "llm.request.model",
        "LLM_RESPONSE_MODEL": "llm.response.model",
        "LLM_REQUEST_TEMPERATURE": "llm.request.temperature",
        "LLM_REQUEST_TOP_P": "llm.request.top_p",
        "LLM_REQUEST_MAX_TOKENS": "llm.request.max_tokens",
        "LLM_TOKEN_TYPE": getattr(SpanAttributes, "LLM_USAGE_TOKEN_TYPE", "llm.usage.token_type"),
    }

    patched: list[str] = []
    for name, value in compat_attrs.items():
        if not hasattr(SpanAttributes, name):
            setattr(SpanAttributes, name, value)
            patched.append(name)

    return patched


PATCHED_SEMCONV_ATTRS = ensure_agent_framework_semconv_compat()

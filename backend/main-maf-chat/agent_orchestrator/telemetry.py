from __future__ import annotations

import logging

from .config import Settings

logger = logging.getLogger(__name__)

_TELEMETRY_CONFIGURED = False


def configure_telemetry(settings: Settings) -> None:
    global _TELEMETRY_CONFIGURED
    if _TELEMETRY_CONFIGURED:
        return

    connection_string = (settings.applicationinsights_connection_string or "").strip()
    if not connection_string:
        return

    try:
        from azure.monitor.opentelemetry import configure_azure_monitor
    except Exception as exc:  # pragma: no cover - optional dependency
        logger.warning(
            "Application Insights connection string provided, but azure-monitor-opentelemetry "
            "is unavailable: %s",
            exc,
        )
        return

    try:
        configure_azure_monitor(connection_string=connection_string)
        _TELEMETRY_CONFIGURED = True
    except Exception as exc:  # pragma: no cover - runtime guard
        logger.warning("Failed to configure Azure Monitor OpenTelemetry exporter: %s", exc)

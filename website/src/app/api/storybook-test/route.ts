import { NextResponse } from "next/server";

const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";
const TARGET_MAIN = "main";

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(/\/+$/, "");
}

function resolveTarget(url: URL) {
  return (url.searchParams.get("target") || TARGET_MAIN).toLowerCase();
}

function shouldStream(url: URL) {
  const raw = (url.searchParams.get("stream") || "").toLowerCase().trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

function a2aOnlyTargetError(target: string) {
  return NextResponse.json(
    {
      detail: "A2A-only mode: Storybook test endpoint only supports target=main.",
      target,
      allowed_target: TARGET_MAIN,
    },
    { status: 400 }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = resolveTarget(url);
  if (target !== TARGET_MAIN) {
    return a2aOnlyTargetError(target);
  }

  const baseUrl = mainBaseUrl();
  const healthPath = "/api/v1/orchestrate/storybook-health";

  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Storybook backend health check failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: baseUrl,
        target,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const target = resolveTarget(url);
  if (target !== TARGET_MAIN) {
    return a2aOnlyTargetError(target);
  }

  const stream = shouldStream(url);
  const baseUrl = mainBaseUrl();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload." }, { status: 400 });
  }

  const isObjectPayload = typeof payload === "object" && payload !== null;
  const bodyPayload: Record<string, unknown> = isObjectPayload
    ? ({ ...(payload as Record<string, unknown>) } as Record<string, unknown>)
    : {};

  if (stream) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/orchestrate/storybook/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bodyPayload),
        cache: "no-store",
      });

      if (!response.body) {
        return NextResponse.json(
          {
            detail: "Stream was requested but upstream response body is empty.",
            backendBaseUrl: baseUrl,
            target,
          },
          { status: 502 }
        );
      }

      return new Response(response.body, {
        status: response.status,
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-accel-buffering": "no",
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          detail: "Storybook stream request failed.",
          error: error instanceof Error ? error.message : String(error),
          backendBaseUrl: baseUrl,
          target,
        },
        { status: 502 }
      );
    }
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/orchestrate/storybook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyPayload),
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return new NextResponse(text, {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }

    return NextResponse.json(
      {
        detail: "Storybook backend returned non-JSON payload.",
        raw: text,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Storybook backend request failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: baseUrl,
        target,
      },
      { status: 502 }
    );
  }
}

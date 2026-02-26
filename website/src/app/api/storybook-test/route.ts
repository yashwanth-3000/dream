import { NextResponse } from "next/server";

const DEFAULT_STORYBOOK_BACKEND_BASE_URL = "http://127.0.0.1:8020";
const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";
const TARGET_MAIN = "main";
const TARGET_BACKEND = "backend";

function storybookBackendBaseUrl() {
  return (
    process.env.STORYBOOK_API_BASE_URL ||
    process.env.BACKEND_STORYBOOK_API_BASE_URL ||
    DEFAULT_STORYBOOK_BACKEND_BASE_URL
  ).replace(/\/+$/, "");
}

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(/\/+$/, "");
}

function resolveTarget(url: URL) {
  const target = (url.searchParams.get("target") || TARGET_MAIN).toLowerCase();
  return target === TARGET_BACKEND ? TARGET_BACKEND : TARGET_MAIN;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = resolveTarget(url);
  const baseUrl = target === TARGET_MAIN ? mainBaseUrl() : storybookBackendBaseUrl();
  const healthPath =
    target === TARGET_MAIN ? "/api/v1/orchestrate/storybook-health" : "/health";

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
  const baseUrl = target === TARGET_MAIN ? mainBaseUrl() : storybookBackendBaseUrl();

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

  const path =
    target === TARGET_MAIN ? "/api/v1/orchestrate/storybook" : "/api/v1/stories/create";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
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

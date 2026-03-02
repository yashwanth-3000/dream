import { NextResponse } from "next/server";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";
const TARGET_MAIN = "main";
const TARGET_BACKEND = "backend";

function backendBaseUrl() {
  return (process.env.BACKEND_API_BASE_URL || DEFAULT_BACKEND_BASE_URL).replace(/\/+$/, "");
}

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(/\/+$/, "");
}

function resolveTarget(url: URL) {
  const target = (url.searchParams.get("target") || TARGET_MAIN).toLowerCase();
  return target === TARGET_BACKEND ? TARGET_BACKEND : TARGET_MAIN;
}

function resolveCheck(url: URL) {
  const check = (url.searchParams.get("check") || "").toLowerCase();
  return check === "a2a" ? "a2a" : "health";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = resolveTarget(url);
  const check = resolveCheck(url);
  const baseUrl = target === TARGET_MAIN ? mainBaseUrl() : backendBaseUrl();
  const path =
    target === TARGET_MAIN && check === "a2a"
      ? "/api/v1/orchestrate/a2a-health"
      : "/health";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
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
        detail: "Backend health check failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: baseUrl,
        target,
        check,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  return forwardCharacterRequest(request, "create");
}

export async function PUT(request: Request) {
  return forwardCharacterRequest(request, "regenerate");
}

async function forwardCharacterRequest(request: Request, action: "create" | "regenerate") {
  const url = new URL(request.url);
  const target = resolveTarget(url);
  const baseUrl = target === TARGET_MAIN ? mainBaseUrl() : backendBaseUrl();

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
    target === TARGET_MAIN
      ? "/api/v1/orchestrate/character"
      : action === "create"
      ? "/api/v1/characters/create"
      : "/api/v1/characters/regenerate-image";

  if (target === TARGET_MAIN) {
    bodyPayload.mode = action;
  }

  const jobId = url.searchParams.get("job_id") || "";
  const jobQuery = jobId ? `?job_id=${encodeURIComponent(jobId)}` : "";

  try {
    const response = await fetch(`${baseUrl}${path}${jobQuery}`, {
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
        detail: "Backend returned non-JSON payload.",
        raw: text,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Backend request failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: baseUrl,
        target,
      },
      { status: 502 }
    );
  }
}

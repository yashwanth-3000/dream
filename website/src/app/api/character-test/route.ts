import { NextResponse } from "next/server";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";

function backendBaseUrl() {
  return (process.env.BACKEND_API_BASE_URL || DEFAULT_BACKEND_BASE_URL).replace(/\/+$/, "");
}

export async function GET() {
  const baseUrl = backendBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/health`, {
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
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  return forwardCharacterRequest(request, "/api/v1/characters/create");
}

export async function PUT(request: Request) {
  return forwardCharacterRequest(request, "/api/v1/characters/regenerate-image");
}

async function forwardCharacterRequest(request: Request, backendPath: string) {
  const baseUrl = backendBaseUrl();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const response = await fetch(`${baseUrl}${backendPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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
      },
      { status: 502 }
    );
  }
}

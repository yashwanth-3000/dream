import { NextResponse } from "next/server";

const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const status = url.searchParams.get("status") || "";
  const limit = url.searchParams.get("limit") || "50";
  const offset = url.searchParams.get("offset") || "0";

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  params.set("limit", limit);
  params.set("offset", offset);

  try {
    const response = await fetch(
      `${mainBaseUrl()}/api/v1/jobs?${params.toString()}`,
      { cache: "no-store" }
    );
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Failed to fetch jobs.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${mainBaseUrl()}/api/v1/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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
        detail: "Failed to create job.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";

const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(/\/+$/, "");
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const response = await fetch(`${mainBaseUrl()}/api/v1/orchestrate/chat`, {
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
        detail: "Chat backend request failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: mainBaseUrl(),
      },
      { status: 502 }
    );
  }
}

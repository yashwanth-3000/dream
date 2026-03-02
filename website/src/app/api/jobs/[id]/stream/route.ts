import { NextResponse } from "next/server";

const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const response = await fetch(
      `${mainBaseUrl()}/api/v1/jobs/${id}/stream`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }

    if (!response.body) {
      return NextResponse.json(
        { detail: "No stream body from backend." },
        { status: 502 }
      );
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Failed to connect to job stream.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

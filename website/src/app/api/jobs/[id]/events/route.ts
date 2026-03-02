import { NextResponse } from "next/server";

const DEFAULT_MAIN_BASE_URL = "http://127.0.0.1:8010";

function mainBaseUrl() {
  return (process.env.MAIN_API_BASE_URL || DEFAULT_MAIN_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || "";

  const qs = after ? `?after=${encodeURIComponent(after)}` : "";

  try {
    const response = await fetch(
      `${mainBaseUrl()}/api/v1/jobs/${id}/events${qs}`,
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
        detail: "Failed to fetch job events.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

const JOB_FETCH_RETRIES = 2;

async function fetchJobFromMain(id: string, query: string, timeoutMs: number) {
  const baseUrl = getMainApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const qs = query ? `?${query}` : "";
    const response = await fetch(`${baseUrl}/api/v1/jobs/${id}${qs}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    return { body, ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const summary = url.searchParams.get("summary") || "";
  const qs = summary ? `summary=${summary}` : "";

  for (let attempt = 0; attempt < JOB_FETCH_RETRIES; attempt++) {
    try {
      const result = await fetchJobFromMain(id, qs, 25_000 + attempt * 10_000);
      if (result.ok) {
        return new NextResponse(result.body, {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
      // 4xx = permanent failure (404, 400, etc.)
      if (result.status >= 400 && result.status < 500) {
        return new NextResponse(result.body, {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
      // 5xx — retry
    } catch {
      // timeout or network error — retry
    }
  }

  return NextResponse.json(
    { detail: "Failed to fetch job — upstream unavailable." },
    { status: 502 }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/jobs/${id}`, {
      method: "DELETE",
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
        detail: "Failed to delete job.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

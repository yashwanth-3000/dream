import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

// 5 minutes — keeps serving cached data across repeated page visits/refreshes
const SUMMARY_CACHE_TTL_MS = 5 * 60_000;
// Backend can be slow to respond after inactivity (DB connection warmup).
// 25s first attempt + 30s second attempt = 55s max before giving up.
const SUMMARY_FETCH_TIMEOUT_MS = 25_000;
const SUMMARY_FETCH_RETRIES = 2;

type CachedSummaryEntry = {
  body: string;
  status: number;
  updatedAt: number;
};

const summaryCache = new Map<string, CachedSummaryEntry>();

function storeSummaryCache(cacheKey: string, body: string, status: number): void {
  summaryCache.set(cacheKey, {
    body,
    status,
    updatedAt: Date.now(),
  });
}

function buildSummaryResponse(
  body: string,
  status: number,
  cacheState: string,
): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "application/json",
      "x-dream-summary-cache": cacheState,
    },
  });
}

function shouldRetrySummaryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchJobsFromMain(query: string, timeoutMs: number): Promise<{
  body: string;
  ok: boolean;
  status: number;
}> {
  const baseUrl = getMainApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/v1/jobs?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      body,
      ok: response.ok,
      status: response.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const status = url.searchParams.get("status") || "";
  const limit = url.searchParams.get("limit") || "50";
  const offset = url.searchParams.get("offset") || "0";
  const summary = url.searchParams.get("summary") || "";
  const isSummaryRequest = Boolean(summary);
  const summaryCacheKey = `${type}|${status}|${limit}|${offset}|${summary}`;
  const cachedSummary = isSummaryRequest ? summaryCache.get(summaryCacheKey) : undefined;

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  params.set("limit", limit);
  params.set("offset", offset);
  if (summary) params.set("summary", summary);

  if (isSummaryRequest) {
    if (cachedSummary && Date.now() - cachedSummary.updatedAt <= SUMMARY_CACHE_TTL_MS) {
      return buildSummaryResponse(cachedSummary.body, cachedSummary.status, "hit");
    }
    for (let attempt = 0; attempt < SUMMARY_FETCH_RETRIES; attempt += 1) {
      try {
        const result = await fetchJobsFromMain(
          params.toString(),
          SUMMARY_FETCH_TIMEOUT_MS + attempt * 2_000,
        );
        if (result.ok) {
          storeSummaryCache(summaryCacheKey, result.body, result.status);
          return buildSummaryResponse(
            result.body,
            result.status,
            cachedSummary ? "refresh" : "miss",
          );
        }
        if (!shouldRetrySummaryStatus(result.status)) break;
      } catch {
        // Retry below; stale cache or empty fallback is returned after attempts run out.
      }
    }
    if (cachedSummary) {
      return buildSummaryResponse(cachedSummary.body, cachedSummary.status, "stale");
    }
    // Return 503 so the client retry logic retries — never silently return []
    return new NextResponse("[]", {
      status: 503,
      headers: {
        "content-type": "application/json",
        "x-dream-summary-cache": "unavailable",
        "retry-after": "5",
      },
    });
  }

  // Non-summary: retry up to 2 times, then return empty array instead of 502
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetchJobsFromMain(params.toString(), 25_000);
      if (result.ok) {
        return new NextResponse(result.body, {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
      if (!shouldRetrySummaryStatus(result.status)) {
        return new NextResponse(result.body, {
          status: result.status,
          headers: { "content-type": "application/json" },
        });
      }
    } catch {
      // retry
    }
  }
  return new NextResponse("[]", {
    status: 200,
    headers: { "content-type": "application/json", "x-dream-fallback": "1" },
  });
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
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/jobs`, {
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

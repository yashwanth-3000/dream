import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || "";

  const qs = after ? `?after=${encodeURIComponent(after)}` : "";

  try {
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/v1/jobs/${id}/events${qs}`,
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

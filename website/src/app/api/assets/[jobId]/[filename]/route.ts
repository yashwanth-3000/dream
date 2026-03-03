import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await params;
  const baseUrl = getMainApiBaseUrl();
  const url = `${baseUrl}/api/v1/assets/${encodeURIComponent(jobId)}/${encodeURIComponent(filename)}`;

  try {
    const upstream = await fetch(url, { cache: "no-store" });

    if (!upstream.ok) {
      return NextResponse.json(
        { detail: "Asset not found" },
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Failed to fetch asset from backend.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

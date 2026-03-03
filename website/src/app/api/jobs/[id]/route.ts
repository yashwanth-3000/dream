import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/jobs/${id}`, {
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
        detail: "Failed to fetch job.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
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

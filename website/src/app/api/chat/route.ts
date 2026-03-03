import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/orchestrate/chat`, {
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
        backendBaseUrl: process.env.MAIN_API_BASE_URL || null,
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { getMainApiBaseUrl } from "@/lib/server-api-base";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Invalid multipart payload." }, { status: 400 });
  }

  try {
    const baseUrl = getMainApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/orchestrate/study/upload`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: "Study upload request failed.",
        error: error instanceof Error ? error.message : String(error),
        backendBaseUrl: process.env.MAIN_API_BASE_URL || null,
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";

// Evaluate per request so timestamp and env presence reflect runtime, not build.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      googleAds: !!process.env.GOOGLE_ADS_CLIENT_ID,
      gemini: !!process.env.GEMINI_API_KEY,
    },
  });
}

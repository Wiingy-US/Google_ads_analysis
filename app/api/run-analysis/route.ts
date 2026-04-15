import { NextResponse, type NextRequest } from "next/server";

import { analyseData } from "@/lib/analysis";
import { sendDigestEmail } from "@/lib/email";
import { generateInsights } from "@/lib/gemini";
import { fetchAllAdsData } from "@/lib/google-ads";

async function runFullAnalysis() {
  const adsData = await fetchAllAdsData();
  const analysisResult = await analyseData(adsData);
  const report = await generateInsights(analysisResult);

  try {
    await sendDigestEmail(report);
  } catch (err) {
    console.error("sendDigestEmail failed:", err);
  }

  return report;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Called by Vercel Cron — see vercel.json
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runFullAnalysis();
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const report = await runFullAnalysis();
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextResponse } from "next/server";

import { analyseData } from "@/lib/analysis";
import { fetchAllAdsData } from "@/lib/google-ads";

export async function GET() {
  try {
    const adsData = await fetchAllAdsData();
    const analysisResult = await analyseData(adsData);
    return NextResponse.json(analysisResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

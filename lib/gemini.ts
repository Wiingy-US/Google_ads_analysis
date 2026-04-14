import { randomUUID } from "node:crypto";

import { GoogleGenerativeAI } from "@google/generative-ai";

import type {
  AdGroup,
  AnalysisResult,
  Anomaly,
  ClusteredSearchTerm,
  InsightReport,
  IntentCluster,
  Suggestion,
} from "./types";

const MODEL_NAME = "gemini-1.5-pro";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function buildPerformanceSummaryBlock(analysisResult: AnalysisResult): string {
  let spend = 0;
  let conversions = 0;
  let impressions = 0;
  let clicks = 0;

  for (const term of analysisResult.searchTerms) {
    spend += term.cost;
    conversions += term.conversions;
    impressions += term.impressions;
    clicks += term.clicks;
  }

  const ctr = impressions > 0 ? clicks / impressions : 0;

  return [
    "PERFORMANCE SUMMARY",
    `- Total search terms analysed: ${formatInt(analysisResult.searchTerms.length)}`,
    `- Total spend: ${formatMoney(spend)}`,
    `- Total conversions: ${conversions.toFixed(2)}`,
    `- Overall CTR: ${formatPercent(ctr)}`,
    `- Total impressions: ${formatInt(impressions)}`,
  ].join("\n");
}

function buildAnomaliesBlock(anomalies: Anomaly[]): string {
  const top = [...anomalies].sort((a, b) => b.cost - a.cost).slice(0, 30);

  if (top.length === 0) {
    return "TOP ANOMALIES\n(none detected)";
  }

  const lines = top.map(
    (a, idx) =>
      `${idx + 1}. ${a.searchTerm} | ${a.type} | ${a.details} | Cost: ${formatMoney(a.cost)}`,
  );

  return ["TOP ANOMALIES", ...lines].join("\n");
}

function buildClusterBlock(
  clusters: Record<IntentCluster, ClusteredSearchTerm[]>,
): string {
  const keys = Object.keys(clusters) as IntentCluster[];

  const lines = keys.map((cluster) => {
    const terms = clusters[cluster] ?? [];
    const totalSpend = terms.reduce((sum, t) => sum + t.cost, 0);
    const totalConv = terms.reduce((sum, t) => sum + t.conversions, 0);
    return `- ${cluster}: ${terms.length} terms, ${formatMoney(totalSpend)} spend, ${totalConv.toFixed(2)} conversions`;
  });

  return ["INTENT CLUSTERS", ...lines].join("\n");
}

function buildWorstAdGroupsBlock(adGroups: AdGroup[]): string {
  const worst = adGroups
    .filter((g) => g.conversions === 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  if (worst.length === 0) {
    return "WORST AD GROUPS (top 10 by cost, zero conversions)\n(none)";
  }

  const lines = worst.map(
    (g, idx) =>
      `${idx + 1}. ${g.name} (Campaign: ${g.campaignName}) | Cost: ${formatMoney(g.cost)} | Impressions: ${formatInt(g.impressions)} | Clicks: ${formatInt(g.clicks)}`,
  );

  return [
    "WORST AD GROUPS (top 10 by cost, zero conversions)",
    ...lines,
  ].join("\n");
}

const INSTRUCTION_BLOCK = `Return ONLY a raw JSON array. No markdown, no backticks, no explanation. Each object in the array must have exactly these fields:
  type: negative_keyword | bid_adjustment | new_keyword | ad_copy | structural
  priority: high | medium | low
  priorityScore: number between 1 and 10
  campaignName: string (use All Campaigns if broadly applicable)
  adGroupName: string or null
  value: the specific keyword, percentage change, or action
  reason: one sentence maximum
  estimatedImpact: short phrase like Saves ~$150/mo in wasted spend
Return between 8 and 12 suggestions total.`;

const ROLE_INSTRUCTION =
  "You are a senior Google Ads optimization specialist. Analyse the following campaign data and return actionable recommendations in strict JSON format only.";

function buildSuggestionsPrompt(
  analysisResult: AnalysisResult,
  performanceSummary: string,
): string {
  return [
    ROLE_INSTRUCTION,
    "",
    performanceSummary,
    "",
    buildAnomaliesBlock(analysisResult.anomalies),
    "",
    buildClusterBlock(analysisResult.clusters),
    "",
    buildWorstAdGroupsBlock(analysisResult.adGroups),
    "",
    INSTRUCTION_BLOCK,
  ].join("\n");
}

function buildSummaryPrompt(performanceSummary: string): string {
  return `In 2-3 sentences, summarise the key performance issues and top priorities from this Google Ads account data: ${performanceSummary}. Be specific with numbers. Respond in 150 words or fewer.`;
}

async function callGemini(
  prompt: string,
  options: { json: boolean },
): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: {
    temperature: number;
    responseMimeType?: string;
  } = { temperature: 0.2 };

  if (options.json) {
    generationConfig.responseMimeType = "application/json";
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

function parseSuggestionsArray(text: string): Omit<Suggestion, "id">[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response was valid JSON but not an array");
  }
  return parsed as Omit<Suggestion, "id">[];
}

async function getSuggestionsFromGemini(
  prompt: string,
): Promise<Omit<Suggestion, "id">[]> {
  const firstText = await callGemini(prompt, { json: true });
  try {
    return parseSuggestionsArray(firstText);
  } catch {
    // fall through to retry
  }

  const retryPrompt = `${prompt}\n\nYour previous response was not valid JSON. Return ONLY the raw JSON array with no other text.`;
  const retryText = await callGemini(retryPrompt, { json: true });
  try {
    return parseSuggestionsArray(retryText);
  } catch {
    throw new Error("Gemini returned malformed JSON after retry");
  }
}

export async function generateInsights(
  analysisResult: AnalysisResult,
): Promise<InsightReport> {
  const performanceSummary = buildPerformanceSummaryBlock(analysisResult);
  const suggestionsPrompt = buildSuggestionsPrompt(
    analysisResult,
    performanceSummary,
  );
  const summaryPrompt = buildSummaryPrompt(performanceSummary);

  const [rawSuggestions, summaryText] = await Promise.all([
    getSuggestionsFromGemini(suggestionsPrompt),
    callGemini(summaryPrompt, { json: false }),
  ]);

  const suggestions: Suggestion[] = rawSuggestions
    .map((s) => ({ ...s, id: randomUUID() }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    suggestions,
    summary: summaryText.trim(),
    generatedAt: new Date().toISOString(),
    analysisResult,
  };
}

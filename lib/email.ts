import { Resend } from "resend";

import type {
  Anomaly,
  InsightReport,
  Priority,
  Suggestion,
  SuggestionType,
} from "./types";

// Default sender uses Resend's sandbox domain, which only sends to the
// account owner's verified email. Override via DIGEST_EMAIL_FROM once a
// custom domain has been verified in Resend.
const DEFAULT_FROM = "Google Ads Insights <onboarding@resend.dev>";

const TYPE_LABELS: Record<SuggestionType, string> = {
  negative_keyword: "Add Negative",
  bid_adjustment: "Adjust Bid",
  new_keyword: "New Keyword",
  ad_copy: "Ad Copy",
  structural: "Structural",
};

const PRIORITY_DOT: Record<Priority, string> = {
  high: "#dc2626",
  medium: "#ca8a04",
  low: "#6b7280",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function computeKpis(report: InsightReport) {
  let spend = 0;
  let clicks = 0;
  let impressions = 0;
  let conversions = 0;
  for (const t of report.analysisResult.searchTerms) {
    spend += t.cost;
    clicks += t.clicks;
    impressions += t.impressions;
    conversions += t.conversions;
  }
  return {
    spend,
    clicks,
    impressions,
    conversions,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

function renderKpiCell(label: string, value: string): string {
  return `
    <td align="center" style="padding:12px;border:1px solid #e5e7eb;background:#f9fafb;">
      <div style="text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:#6b7280;margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:18px;font-weight:600;color:#111827;">${escapeHtml(value)}</div>
    </td>
  `;
}

function renderSuggestionRow(s: Suggestion): string {
  const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${PRIORITY_DOT[s.priority]};vertical-align:middle;"></span>`;
  const campaignLine = s.adGroupName
    ? `${s.campaignName} · ${s.adGroupName}`
    : s.campaignName;
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;font-size:14px;vertical-align:top;">
        <div style="margin-bottom:4px;">
          ${dot}
          <span style="color:#6b7280;font-size:12px;margin-left:8px;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(TYPE_LABELS[s.type])}</span>
        </div>
        <div style="font-weight:600;color:#111827;">${escapeHtml(s.value)}</div>
        <div style="color:#6b7280;font-size:12px;margin-top:2px;">${escapeHtml(campaignLine)}</div>
        <div style="color:#4b5563;font-size:13px;margin-top:4px;">${escapeHtml(s.reason)}</div>
        <div style="color:#15803d;font-size:13px;margin-top:2px;">${escapeHtml(s.estimatedImpact)}</div>
      </td>
    </tr>
  `;
}

function renderAnomalyItem(a: Anomaly): string {
  return `<li><strong>${escapeHtml(a.searchTerm)}</strong> — ${escapeHtml(a.details)} (${escapeHtml(formatMoney(a.cost))})</li>`;
}

function renderHtml(report: InsightReport): string {
  const generatedAt = new Date(report.generatedAt);
  const kpis = computeKpis(report);

  const highSuggestions = report.suggestions
    .filter((s) => s.priority === "high")
    .slice(0, 5);

  const topAnomalies = [...report.analysisResult.anomalies]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  const kpiTable = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border-collapse:collapse;">
      <tr>
        ${renderKpiCell("Total Spend", formatMoney(kpis.spend))}
        ${renderKpiCell("Total Clicks", formatNumber(kpis.clicks))}
        ${renderKpiCell("Overall CTR", formatPercent(kpis.ctr))}
        ${renderKpiCell("Total Conversions", formatNumber(kpis.conversions))}
      </tr>
    </table>
  `;

  const summaryBox = report.summary
    ? `<div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(report.summary)}</div>`
    : `<div style="color:#6b7280;font-size:14px;">No summary available.</div>`;

  const suggestionsBlock =
    highSuggestions.length > 0
      ? `
        <h2 style="font-size:16px;margin:24px 0 8px 0;color:#111827;">Top Recommendations</h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          ${highSuggestions.map(renderSuggestionRow).join("")}
        </table>
      `
      : "";

  const anomaliesBlock =
    topAnomalies.length > 0
      ? `
        <h2 style="font-size:16px;margin:24px 0 8px 0;color:#111827;">Anomalies Detected</h2>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
          ${topAnomalies.map(renderAnomalyItem).join("")}
        </ul>
      `
      : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;border:1px solid #e5e7eb;">
    <h1 style="font-size:22px;margin:0 0 4px 0;color:#111827;">Google Ads Weekly Digest</h1>
    <p style="color:#6b7280;font-size:14px;margin:0;">${escapeHtml(formatLongDate(generatedAt))}</p>

    ${kpiTable}

    <h2 style="font-size:16px;margin:24px 0 8px 0;color:#111827;">Key Findings</h2>
    ${summaryBox}

    ${suggestionsBlock}

    ${anomaliesBlock}

    <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;">
      Generated by your Google Ads Insight Tool · To unsubscribe, remove DIGEST_EMAIL_TO from your settings
    </p>
  </div>
</body>
</html>`;
}

function renderSubject(report: InsightReport): string {
  const highCount = report.suggestions.filter(
    (s) => s.priority === "high",
  ).length;
  const date = formatShortDate(new Date(report.generatedAt));
  return `Google Ads Insights — ${highCount} recommendations · ${date}`;
}

export async function sendDigestEmail(report: InsightReport): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const to = requireEnv("DIGEST_EMAIL_TO");
  const from = process.env.DIGEST_EMAIL_FROM ?? DEFAULT_FROM;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: renderSubject(report),
    html: renderHtml(report),
  });

  if (error) {
    throw new Error(
      `Resend send failed (${error.name}): ${error.message}`,
    );
  }
}

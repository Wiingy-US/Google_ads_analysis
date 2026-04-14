"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AnalysisResult,
  Anomaly,
  ClusteredSearchTerm,
  InsightReport,
  IntentCluster,
  Priority,
  Suggestion,
  SuggestionType,
} from "@/lib/types";

type SortField = "impressions" | "ctr" | "cost" | "conversions";
type SortDir = "asc" | "desc";

const INTENT_STYLES: Record<IntentCluster, string> = {
  transactional: "bg-green-100 text-green-800",
  informational: "bg-blue-100 text-blue-800",
  navigational: "bg-purple-100 text-purple-800",
  branded: "bg-orange-100 text-orange-800",
  unknown: "bg-gray-100 text-gray-700",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

const TYPE_LABELS: Record<SuggestionType, string> = {
  negative_keyword: "Add Negative",
  bid_adjustment: "Adjust Bid",
  new_keyword: "New Keyword",
  ad_copy: "Ad Copy",
  structural: "Structural",
};

const ANOMALY_STYLES: Record<Anomaly["type"], string> = {
  high_impressions_low_ctr: "bg-yellow-100 text-yellow-800",
  high_spend_no_conversion: "bg-red-100 text-red-800",
};

const ANOMALY_LABELS: Record<Anomaly["type"], string> = {
  high_impressions_low_ctr: "High Impr / Low CTR",
  high_spend_no_conversion: "High Spend / No Conv",
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Request to ${url} failed (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export default function Page() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [insights, setInsights] = useState<InsightReport | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("impressions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Auto-dismiss the toast after 5s
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error]);

  // Initial fetch of analysis data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson<AnalysisResult>("/api/ads-data");
        if (!cancelled) setAnalysis(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const report = await fetchJson<InsightReport>("/api/run-analysis");
      setInsights(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const kpis = useMemo(() => {
    if (!analysis) return null;
    let spend = 0;
    let clicks = 0;
    let impressions = 0;
    let conversions = 0;
    for (const t of analysis.searchTerms) {
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
  }, [analysis]);

  const tableRows = useMemo(() => {
    if (!analysis) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? analysis.searchTerms.filter((t) =>
          t.searchTerm.toLowerCase().includes(q),
        )
      : analysis.searchTerms;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return sorted.slice(0, 50);
  }, [analysis, search, sortField, sortDir]);

  const anomalies = analysis?.anomalies ?? [];
  const showAnomalies = anomalies.length > 0;

  const onSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-8">
      {error && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-white shadow-lg"
        >
          {error}
        </div>
      )}

      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Google Ads Insight Tool</h1>
          <p className="text-sm text-gray-500">Last 30 days</p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={insightsLoading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {insightsLoading ? "Analysing..." : "Analyse now"}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analysisLoading ? (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total Spend" value={formatMoney(kpis?.spend ?? 0)} />
            <KpiCard label="Total Clicks" value={formatNumber(kpis?.clicks ?? 0)} />
            <KpiCard label="Overall CTR" value={formatPercent(kpis?.ctr ?? 0)} />
            <KpiCard
              label="Total Conversions"
              value={formatNumber(Math.round(kpis?.conversions ?? 0))}
            />
          </>
        )}
      </section>

      {showAnomalies && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Anomalies</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {anomalies.slice(0, 10).map((a, i) => (
              <AnomalyCard key={i} anomaly={a} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top Search Terms</h2>
          <input
            type="search"
            placeholder="Filter terms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Search Term</th>
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Ad Group</th>
                <th className="px-3 py-2 font-medium">Intent</th>
                <SortableTh field="impressions" current={sortField} dir={sortDir} onClick={onSort}>
                  Impressions
                </SortableTh>
                <th className="px-3 py-2 font-medium">Clicks</th>
                <SortableTh field="ctr" current={sortField} dir={sortDir} onClick={onSort}>
                  CTR
                </SortableTh>
                <th className="px-3 py-2 font-medium">Avg CPC</th>
                <SortableTh field="conversions" current={sortField} dir={sortDir} onClick={onSort}>
                  Conversions
                </SortableTh>
                <SortableTh field="cost" current={sortField} dir={sortDir} onClick={onSort}>
                  Cost
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {analysisLoading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    No search terms to display.
                  </td>
                </tr>
              ) : (
                tableRows.map((t, i) => <SearchTermRow key={i} term={t} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">AI Recommendations</h2>
          <span className="text-xs text-gray-500">Powered by Gemini</span>
        </div>

        {!insights && !insightsLoading && (
          <div className="rounded border border-dashed border-gray-300 p-6 text-center text-gray-500">
            Click Analyse now to generate recommendations
          </div>
        )}

        {insightsLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <SuggestionSkeleton key={i} />
            ))}
          </div>
        )}

        {insights && (
          <div className="space-y-3">
            {insights.summary && (
              <p className="rounded border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
                {insights.summary}
              </p>
            )}
            {insights.suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t pt-6 text-center text-xs text-gray-500">
        Data from Google Ads API · Analysis by Gemini 1.5 Pro · Built with Claude Code
      </footer>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded border border-gray-200 bg-white p-4">
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="mt-2 h-7 w-32 rounded bg-gray-200" />
    </div>
  );
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  return (
    <div className="min-w-[260px] max-w-[320px] rounded border border-gray-200 bg-white p-3">
      <span
        className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${ANOMALY_STYLES[anomaly.type]}`}
      >
        {ANOMALY_LABELS[anomaly.type]}
      </span>
      <p className="mt-1.5 text-sm font-semibold" title={anomaly.searchTerm}>
        {truncate(anomaly.searchTerm, 30)}
      </p>
      <p className="mt-1 text-xs text-gray-600">{anomaly.details}</p>
    </div>
  );
}

function SortableTh({
  field,
  current,
  dir,
  onClick,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
  children: React.ReactNode;
}) {
  const active = current === field;
  const arrow = active ? (dir === "desc" ? "↓" : "↑") : "";
  return (
    <th
      scope="col"
      className="cursor-pointer select-none px-3 py-2 font-medium hover:bg-gray-100"
      onClick={() => onClick(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="text-gray-400">{arrow}</span>
      </span>
    </th>
  );
}

function SearchTermRow({ term }: { term: ClusteredSearchTerm }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 font-medium">{term.searchTerm}</td>
      <td className="px-3 py-2 text-gray-600">{term.campaignName}</td>
      <td className="px-3 py-2 text-gray-600">{term.adGroupName}</td>
      <td className="px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${INTENT_STYLES[term.intentCluster]}`}
        >
          {term.intentCluster}
        </span>
      </td>
      <td className="px-3 py-2 tabular-nums">{formatNumber(term.impressions)}</td>
      <td className="px-3 py-2 tabular-nums">{formatNumber(term.clicks)}</td>
      <td className="px-3 py-2 tabular-nums">{formatPercent(term.ctr)}</td>
      <td className="px-3 py-2 tabular-nums">{formatMoney(term.avgCpc)}</td>
      <td className="px-3 py-2 tabular-nums">
        {formatNumber(Math.round(term.conversions))}
      </td>
      <td className="px-3 py-2 tabular-nums">{formatMoney(term.cost)}</td>
    </tr>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse border-t border-gray-100">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[suggestion.priority]}`}
        >
          {suggestion.priority.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">
          {TYPE_LABELS[suggestion.type]}
        </span>
      </div>
      <p className="font-semibold">{suggestion.value}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {suggestion.campaignName}
        {suggestion.adGroupName ? ` · ${suggestion.adGroupName}` : ""}
      </p>
      <p className="mt-2 text-sm text-gray-700">{suggestion.reason}</p>
      <p className="mt-1 text-sm italic text-green-700">
        {suggestion.estimatedImpact}
      </p>
    </div>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="animate-pulse rounded border border-gray-200 p-4">
      <div className="mb-2 flex gap-2">
        <div className="h-4 w-14 rounded bg-gray-200" />
        <div className="h-4 w-20 rounded bg-gray-200" />
      </div>
      <div className="h-5 w-2/3 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-full rounded bg-gray-200" />
      <div className="mt-1 h-3 w-1/2 rounded bg-gray-200" />
    </div>
  );
}

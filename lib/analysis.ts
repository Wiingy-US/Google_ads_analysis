import type {
  AdGroup,
  AnalysisResult,
  Anomaly,
  CampaignMetrics,
  ClusteredSearchTerm,
  IntentCluster,
  SearchTerm,
} from "./types";

export interface AdsData {
  searchTerms: SearchTerm[];
  adGroups: AdGroup[];
  campaigns: CampaignMetrics[];
}

// Intent classification patterns. Priority order matters: informational wins
// over navigational which wins over transactional which wins over branded.
const INFORMATIONAL_PATTERNS: RegExp[] = [
  /\bhow to\b/,
  /\bwhat is\b/,
  /\bwhy\b/,
  /\bguide\b/,
  /\btips\b/,
  /\btutorial\b/,
  /\blearn\b/,
  /\breviews?\b/,
  /\bvs\b/,
  /\bcompare\b/,
  /\bbest\b/,
  /\btypes of\b/,
];

const NAVIGATIONAL_PATTERNS: RegExp[] = [
  /\bofficial\b/,
  /\blogin\b/,
  /\bsign in\b/,
  /\bwebsite\b/,
  /\.com\b/,
  /\bhomepage\b/,
];

const TRANSACTIONAL_PATTERNS: RegExp[] = [
  /\bbuy\b/,
  /\bcheap\b/,
  /\bdiscount\b/,
  /\bprice\b/,
  /\border\b/,
  /\bpurchase\b/,
  /\bsale\b/,
  /\bdeal\b/,
  /\bcoupon\b/,
  /\bnear me\b/,
  /\bdelivery\b/,
  /\bshipping\b/,
  /\bfor sale\b/,
];

const KNOWN_BRANDS: string[] = [
  "nike",
  "adidas",
  "puma",
  "asics",
  "reebok",
  "under armour",
  "new balance",
  "brooks",
  "saucony",
  "hoka",
];

function classifyIntent(term: string): IntentCluster {
  const q = term.toLowerCase();
  if (INFORMATIONAL_PATTERNS.some((p) => p.test(q))) return "informational";
  if (NAVIGATIONAL_PATTERNS.some((p) => p.test(q))) return "navigational";
  if (TRANSACTIONAL_PATTERNS.some((p) => p.test(q))) return "transactional";
  if (KNOWN_BRANDS.some((b) => q.includes(b))) return "branded";
  return "unknown";
}

// Anomaly thresholds.
const ANOMALY_IMPRESSIONS_THRESHOLD = 1000;
const ANOMALY_CTR_THRESHOLD = 0.01; // 1%
const ANOMALY_COST_THRESHOLD = 50; // $50

function detectAnomalies(terms: SearchTerm[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const t of terms) {
    const ctr = t.impressions > 0 ? t.clicks / t.impressions : 0;

    if (
      t.impressions >= ANOMALY_IMPRESSIONS_THRESHOLD &&
      ctr < ANOMALY_CTR_THRESHOLD
    ) {
      anomalies.push({
        searchTerm: t.searchTerm,
        campaignName: t.campaignName,
        adGroupName: t.adGroupName,
        type: "high_impressions_low_ctr",
        details: `${t.impressions.toLocaleString("en-US")} impressions at ${(ctr * 100).toFixed(2)}% CTR`,
        impressions: t.impressions,
        clicks: t.clicks,
        cost: t.cost,
      });
    }

    if (t.cost >= ANOMALY_COST_THRESHOLD && t.conversions === 0) {
      anomalies.push({
        searchTerm: t.searchTerm,
        campaignName: t.campaignName,
        adGroupName: t.adGroupName,
        type: "high_spend_no_conversion",
        details: `$${t.cost.toFixed(2)} spent with 0 conversions`,
        impressions: t.impressions,
        clicks: t.clicks,
        cost: t.cost,
      });
    }
  }

  return anomalies;
}

function emptyClusters(): Record<IntentCluster, ClusteredSearchTerm[]> {
  return {
    informational: [],
    transactional: [],
    navigational: [],
    branded: [],
    unknown: [],
  };
}

export const analyseData = async (data: AdsData): Promise<AnalysisResult> => {
  const searchTerms: ClusteredSearchTerm[] = data.searchTerms.map((t) => ({
    ...t,
    intentCluster: classifyIntent(t.searchTerm),
  }));

  const clusters = emptyClusters();
  for (const t of searchTerms) {
    clusters[t.intentCluster].push(t);
  }

  const anomalies = detectAnomalies(data.searchTerms);

  return {
    searchTerms,
    anomalies,
    clusters,
    adGroups: data.adGroups,
    campaigns: data.campaigns,
    fetchedAt: new Date().toISOString(),
  };
};

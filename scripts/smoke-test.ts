/**
 * Smoke test for the analysis pipeline.
 *
 * Feeds hardcoded sample data into analyseData() and verifies that
 * intent clustering and anomaly detection behave as expected.
 *
 * Does NOT hit the real Google Ads API or Gemini.
 *
 * Run with: npm run smoke-test
 */

import type { AdsData } from "../lib/analysis";
import { analyseData } from "../lib/analysis";
import type {
  AdGroup,
  CampaignMetrics,
  IntentCluster,
  SearchTerm,
} from "../lib/types";

const CAMPAIGN_ID = "1";
const CAMPAIGN_NAME = "Running Shoes - Core";
const AD_GROUP_BUY_ID = "10";
const AD_GROUP_BUY_NAME = "Buy Intent";
const AD_GROUP_INFO_ID = "20";
const AD_GROUP_INFO_NAME = "Informational";
const DATE = "2026-04-14";

function term(
  searchTerm: string,
  adGroupId: string,
  adGroupName: string,
  impressions: number,
  clicks: number,
  cost: number,
  conversions: number,
): SearchTerm {
  return {
    searchTerm,
    campaignId: CAMPAIGN_ID,
    campaignName: CAMPAIGN_NAME,
    adGroupId,
    adGroupName,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgCpc: clicks > 0 ? cost / clicks : 0,
    conversions,
    cost,
    matchType: "BROAD",
    date: DATE,
  };
}

const searchTerms: SearchTerm[] = [
  term("buy running shoes cheap", AD_GROUP_BUY_ID, AD_GROUP_BUY_NAME, 800, 2, 120, 0),
  term("how to choose running shoes", AD_GROUP_INFO_ID, AD_GROUP_INFO_NAME, 1200, 8, 15, 0),
  term("nike running shoes official", AD_GROUP_BUY_ID, AD_GROUP_BUY_NAME, 500, 45, 80, 3),
  term("running shoes near me", AD_GROUP_BUY_ID, AD_GROUP_BUY_NAME, 300, 28, 60, 2),
  term("marathon training guide", AD_GROUP_INFO_ID, AD_GROUP_INFO_NAME, 900, 6, 10, 0),
];

const adGroups: AdGroup[] = [
  {
    id: AD_GROUP_BUY_ID,
    name: AD_GROUP_BUY_NAME,
    campaignId: CAMPAIGN_ID,
    campaignName: CAMPAIGN_NAME,
    impressions: 1600,
    clicks: 75,
    conversions: 5,
    cost: 260,
    searchImpressionShare: 0.6,
  },
  {
    id: AD_GROUP_INFO_ID,
    name: AD_GROUP_INFO_NAME,
    campaignId: CAMPAIGN_ID,
    campaignName: CAMPAIGN_NAME,
    impressions: 2100,
    clicks: 14,
    conversions: 0,
    cost: 25,
    searchImpressionShare: 0.3,
  },
];

const campaigns: CampaignMetrics[] = [
  {
    id: CAMPAIGN_ID,
    name: CAMPAIGN_NAME,
    biddingStrategy: "TARGET_CPA",
    targetCpa: 50,
    impressions: 3700,
    clicks: 89,
    ctr: 89 / 3700,
    avgCpc: 285 / 89,
    conversions: 5,
    cost: 285,
    searchImpressionShare: 0.45,
    budgetLostImpressionShare: 0.1,
    rankLostImpressionShare: 0.2,
  },
];

const adsData: AdsData = { searchTerms, adGroups, campaigns };

let passed = 0;
let total = 0;

function assert(label: string, cond: boolean): void {
  total++;
  if (cond) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    console.log(`  [FAIL] ${label}`);
  }
}

async function main(): Promise<void> {
  console.log("Running analyseData() with 5 sample search terms...\n");
  const result = await analyseData(adsData);

  console.log("Intent cluster counts:");
  const clusterKeys = Object.keys(result.clusters) as IntentCluster[];
  for (const key of clusterKeys) {
    console.log(`  ${key}: ${result.clusters[key].length}`);
  }

  console.log(`\nAnomalies detected: ${result.anomalies.length}`);
  for (const a of result.anomalies) {
    console.log(`  - "${a.searchTerm}" | ${a.type} | ${a.details}`);
  }

  console.log("\nAssertions:");

  const findCluster = (needle: string): IntentCluster | undefined =>
    result.searchTerms.find((t) => t.searchTerm === needle)?.intentCluster;

  assert(
    '"buy running shoes cheap" is clustered as transactional',
    findCluster("buy running shoes cheap") === "transactional",
  );
  assert(
    '"how to choose running shoes" is clustered as informational',
    findCluster("how to choose running shoes") === "informational",
  );
  assert(
    '"nike running shoes official" is clustered as navigational',
    findCluster("nike running shoes official") === "navigational",
  );
  assert(
    '"running shoes near me" is clustered as transactional',
    findCluster("running shoes near me") === "transactional",
  );
  assert(
    '"marathon training guide" is clustered as informational',
    findCluster("marathon training guide") === "informational",
  );
  assert(
    "at least 2 anomalies detected",
    result.anomalies.length >= 2,
  );
  assert(
    'high_spend_no_conversion anomaly exists for "buy running shoes cheap"',
    result.anomalies.some(
      (a) =>
        a.type === "high_spend_no_conversion" &&
        a.searchTerm === "buy running shoes cheap",
    ),
  );

  console.log(`\n${passed}/${total} assertions passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test threw:", err);
  process.exit(1);
});

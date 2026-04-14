import { GoogleAdsApi, Customer } from "google-ads-api";

import type {
  AdGroup,
  CampaignMetrics,
  SearchTerm,
} from "./types";

const MICROS_PER_UNIT = 1_000_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedCustomer: Customer | null = null;

function getCustomer(): Customer {
  if (cachedCustomer) return cachedCustomer;

  const client = new GoogleAdsApi({
    client_id: requireEnv("GOOGLE_ADS_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_ADS_CLIENT_SECRET"),
    developer_token: requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
  });

  cachedCustomer = client.Customer({
    customer_id: requireEnv("GOOGLE_ADS_CUSTOMER_ID"),
    refresh_token: requireEnv("GOOGLE_ADS_REFRESH_TOKEN"),
  });

  return cachedCustomer;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  // google-ads-api may return Long-like objects for int64 fields
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const fn = (value as { toNumber?: () => number }).toNumber;
    if (typeof fn === "function") return fn.call(value);
  }
  return 0;
}

function toMoney(microsValue: unknown): number {
  return toNumber(microsValue) / MICROS_PER_UNIT;
}

function toString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export async function fetchSearchTerms(): Promise<SearchTerm[]> {
  const customer = getCustomer();
  const query = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      segments.date,
      segments.search_term_match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.cost_micros
    FROM search_term_view
    WHERE
      campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND metrics.impressions > 0
      AND segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
  `;

  let rows;
  try {
    rows = await customer.query(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fetchSearchTerms failed: ${message}`);
  }

  return rows.map((row): SearchTerm => ({
    searchTerm: toString(row.search_term_view?.search_term),
    campaignId: toString(row.campaign?.id),
    campaignName: toString(row.campaign?.name),
    adGroupId: toString(row.ad_group?.id),
    adGroupName: toString(row.ad_group?.name),
    impressions: toNumber(row.metrics?.impressions),
    clicks: toNumber(row.metrics?.clicks),
    ctr: toNumber(row.metrics?.ctr),
    avgCpc: toMoney(row.metrics?.average_cpc),
    conversions: toNumber(row.metrics?.conversions),
    cost: toMoney(row.metrics?.cost_micros),
    matchType: toString(row.segments?.search_term_match_type),
    date: toString(row.segments?.date),
  }));
}

export async function fetchAdGroups(): Promise<AdGroup[]> {
  const customer = getCustomer();
  const query = `
    SELECT
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.search_impression_share
    FROM ad_group
    WHERE
      campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND segments.date DURING LAST_30_DAYS
  `;

  let rows;
  try {
    rows = await customer.query(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fetchAdGroups failed: ${message}`);
  }

  return rows.map((row): AdGroup => ({
    id: toString(row.ad_group?.id),
    name: toString(row.ad_group?.name),
    campaignId: toString(row.campaign?.id),
    campaignName: toString(row.campaign?.name),
    impressions: toNumber(row.metrics?.impressions),
    clicks: toNumber(row.metrics?.clicks),
    conversions: toNumber(row.metrics?.conversions),
    cost: toMoney(row.metrics?.cost_micros),
    searchImpressionShare: toNumber(row.metrics?.search_impression_share),
  }));
}

export async function fetchCampaigns(): Promise<CampaignMetrics[]> {
  const customer = getCustomer();
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.bidding_strategy_type,
      campaign.target_cpa.target_cpa_micros,
      campaign.target_roas.target_roas,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.cost_micros,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE
      campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date DURING LAST_30_DAYS
  `;

  let rows;
  try {
    rows = await customer.query(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fetchCampaigns failed: ${message}`);
  }

  return rows.map((row): CampaignMetrics => {
    const targetCpaMicros = row.campaign?.target_cpa?.target_cpa_micros;
    const targetRoas = row.campaign?.target_roas?.target_roas;

    const metrics: CampaignMetrics = {
      id: toString(row.campaign?.id),
      name: toString(row.campaign?.name),
      biddingStrategy: toString(row.campaign?.bidding_strategy_type),
      impressions: toNumber(row.metrics?.impressions),
      clicks: toNumber(row.metrics?.clicks),
      ctr: toNumber(row.metrics?.ctr),
      avgCpc: toMoney(row.metrics?.average_cpc),
      conversions: toNumber(row.metrics?.conversions),
      cost: toMoney(row.metrics?.cost_micros),
      searchImpressionShare: toNumber(row.metrics?.search_impression_share),
      budgetLostImpressionShare: toNumber(
        row.metrics?.search_budget_lost_impression_share,
      ),
      rankLostImpressionShare: toNumber(
        row.metrics?.search_rank_lost_impression_share,
      ),
    };

    if (targetCpaMicros != null) {
      metrics.targetCpa = toMoney(targetCpaMicros);
    }
    if (targetRoas != null) {
      metrics.targetRoas = toNumber(targetRoas);
    }

    return metrics;
  });
}

export async function fetchAllAdsData(): Promise<{
  searchTerms: SearchTerm[];
  adGroups: AdGroup[];
  campaigns: CampaignMetrics[];
}> {
  const [searchTerms, adGroups, campaigns] = await Promise.all([
    fetchSearchTerms(),
    fetchAdGroups(),
    fetchCampaigns(),
  ]);

  return { searchTerms, adGroups, campaigns };
}

// Raw data from Google Ads API
export interface SearchTerm {
  searchTerm: string
  campaignId: string
  campaignName: string
  adGroupId: string
  adGroupName: string
  impressions: number
  clicks: number
  ctr: number
  avgCpc: number
  conversions: number
  cost: number
  matchType: string
  date: string
}

export interface AdGroup {
  id: string
  name: string
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  conversions: number
  cost: number
  searchImpressionShare: number
}

export interface CampaignMetrics {
  id: string
  name: string
  biddingStrategy: string
  targetCpa?: number
  targetRoas?: number
  impressions: number
  clicks: number
  ctr: number
  avgCpc: number
  conversions: number
  cost: number
  searchImpressionShare: number
  budgetLostImpressionShare: number
  rankLostImpressionShare: number
}

// Analysis outputs
export type IntentCluster =
  'informational' | 'transactional' | 'navigational' | 'branded' | 'unknown'

export interface ClusteredSearchTerm extends SearchTerm {
  intentCluster: IntentCluster
}

export interface Anomaly {
  searchTerm: string
  campaignName: string
  adGroupName: string
  type: 'high_impressions_low_ctr' | 'high_spend_no_conversion'
  details: string
  impressions: number
  clicks: number
  cost: number
}

export interface AnalysisResult {
  searchTerms: ClusteredSearchTerm[]
  anomalies: Anomaly[]
  clusters: Record<IntentCluster, ClusteredSearchTerm[]>
  adGroups: AdGroup[]
  campaigns: CampaignMetrics[]
  fetchedAt: string
}

// Insight suggestions from Anthropic
export type SuggestionType =
  'negative_keyword' | 'bid_adjustment' | 'new_keyword' | 'ad_copy' | 'structural'

export type Priority = 'high' | 'medium' | 'low'

export interface Suggestion {
  id: string
  type: SuggestionType
  priority: Priority
  priorityScore: number        // 1-10
  campaignName: string
  adGroupName?: string
  value: string                // the actual keyword, bid change, etc.
  reason: string               // one-sentence explanation
  estimatedImpact: string      // e.g. "Could reduce wasted spend by ~$200/mo"
}

export interface InsightReport {
  suggestions: Suggestion[]
  summary: string              // 2-3 sentence overview
  generatedAt: string
  analysisResult: AnalysisResult
}

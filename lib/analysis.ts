import type {
  AdGroup,
  AnalysisResult,
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

const EMPTY_CLUSTERS: Record<IntentCluster, ClusteredSearchTerm[]> = {
  informational: [],
  transactional: [],
  navigational: [],
  branded: [],
  unknown: [],
};

export const analyseData = async (data: AdsData): Promise<AnalysisResult> => ({
  searchTerms: [],
  anomalies: [],
  clusters: { ...EMPTY_CLUSTERS },
  adGroups: data.adGroups,
  campaigns: data.campaigns,
  fetchedAt: new Date().toISOString(),
});

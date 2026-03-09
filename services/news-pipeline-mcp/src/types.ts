export interface NewsItem {
  id: string;
  url: string;
  topic: string;
  headline: string;
  summary: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  channelHint?: string;
  formattedSlackText: string;
  priorityFlag: boolean;
  priorityScore?: number;
  seenBefore: boolean;
  origin?: "cfp" | "topicSearch" | "commentator" | string;
  badge?: "BREAKING" | "LIVE" | null;
  matchedKeywords?: string[];
}

export interface NarrativeSignal {
  commentator: string;
  handle: string;
  url: string;
  headline: string;
  summary: string;
  createdAt: string;
  sentiment?: "positive" | "negative" | "neutral";
  formattedSlackText: string;
}

export type DeliveryMode = "autoPost" | "previewOnly" | "returnOnly";

export interface DeliveryPolicy {
  mode: DeliveryMode;
  channels: string[];
  ntfy: boolean;
}

export interface JobDefinition {
  id: string;
  type: "breaking" | "intel" | "georgia" | "weather" | "portfolio" | string;
  description?: string;
  scheduleHint?: string;
  owner?: "analyst" | "cipher" | string;
  deliveryPolicy: DeliveryPolicy;
}

export interface NewsRunJobParams {
  jobId: string;
  overrideQuietWindow?: boolean;
  dryRun?: boolean;
}

export interface NewsRunJobResult {
  jobId: string;
  runId: string;
  timestamp: string;
  status: "ok" | "quiet-window" | "error";
  items: NewsItem[];
  deliveryPolicy: DeliveryPolicy;
  errorMessage?: string;
}

export interface NewsPreviewBreakingResult {
  runId: string;
  timestamp: string;
  breakingItems: NewsItem[];
  intelSignals: NarrativeSignal[];
}

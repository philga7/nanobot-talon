import { URL } from "url";
import type { NewsItem } from "./types.js";
import type {
  PipelineConfig,
  PriorityTopic,
  UrgencyKeyword,
} from "./config.js";

interface SearxngResult {
  title: string;
  url: string;
  content?: string;
  // Some SearXNG setups include extra fields; we keep this loose.
  [key: string]: unknown;
}

interface SearxngResponse {
  results: SearxngResult[];
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

async function searxngSearch(
  baseUrl: string,
  query: string,
  timeRange: "day" | "hour" | "week" = "day"
): Promise<SearxngResult[]> {
  const root = ensureTrailingSlash(baseUrl);
  const u = new URL("search", root);
  u.searchParams.set("q", query);
  u.searchParams.set("format", "json");
  u.searchParams.set("time_range", timeRange);

  const res = await fetch(u.toString());
  if (!res.ok) {
    throw new Error(`SearXNG request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as SearxngResponse;
  return data.results ?? [];
}

function isCitizenFreePress(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("citizenfreepress.com");
  } catch {
    return false;
  }
}

function detectCfpBadge(result: SearxngResult): "BREAKING" | "LIVE" | null {
  const text = `${result.title} ${result.content ?? ""}`.toUpperCase();
  if (text.includes("BREAKING")) return "BREAKING";
  if (text.includes("LIVE")) return "LIVE";
  return null;
}

function scoreArticle(
  topic: PriorityTopic,
  urgencyKeywords: UrgencyKeyword[],
  ignoredTopics: string[],
  result: SearxngResult
): { score: number; matchedKeywords: string[]; ignored: boolean } {
  const text = `${result.title} ${result.content ?? ""}`.toLowerCase();

  // Simple ignore-check: if any ignored topic string appears, drop it.
  const ignored = ignoredTopics.some((t) => t && text.includes(t.toLowerCase()));
  if (ignored) {
    return { score: 0, matchedKeywords: [], ignored: true };
  }

  let base = 0;
  const matched = new Set<string>();
  for (const kw of urgencyKeywords) {
    if (!kw.keyword) continue;
    if (text.includes(kw.keyword.toLowerCase())) {
      base += kw.weight;
      matched.add(kw.keyword);
    }
  }

  const score = base * (topic.multiplier || 1);
  return { score, matchedKeywords: Array.from(matched), ignored: false };
}

export interface BreakingPipelineOptions {
  searxngBaseUrl: string;
  scoreThreshold?: number;
}

export async function runBreakingNewsPipeline(
  config: PipelineConfig,
  options: BreakingPipelineOptions
): Promise<NewsItem[]> {
  const { searxngBaseUrl, scoreThreshold = 7 } = options;
  const items: NewsItem[] = [];

  // Phase 2 + 3 combined:
  // - Topic search scoring
  // - CFP BREAKING/LIVE detection with special handling
  for (const topic of config.priorityTopics) {
    const topicQuery = topic.topic;
    const results = await searxngSearch(searxngBaseUrl, topicQuery, "day");

    for (const res of results) {
      const badge = isCitizenFreePress(res.url) ? detectCfpBadge(res) : null;

      if (badge === "BREAKING" || badge === "LIVE") {
        // CFP rules:
        // - BREAKING on priority topic -> score 9
        // - LIVE on priority topic -> score 8
        const score = badge === "BREAKING" ? 9 : 8;
        const headline = res.title || `${badge} — ${topic.topic}`;
        const summary = res.content ?? "";

        items.push({
          id: res.url || `${headline}-${score}`,
          url: res.url,
          topic: topic.topic,
          headline,
          summary,
          score,
          scoreBreakdown: {
            badgeScore: score,
            multiplier: topic.multiplier,
          },
          channelHint: "#breaking-news",
          formattedSlackText: "",
          priorityFlag: score >= 9,
          priorityScore: score,
          seenBefore: false,
          origin: "cfp",
          badge,
          matchedKeywords: [],
        });
        continue;
      }

      // Otherwise, fall back to generic urgency scoring.
      const { score, matchedKeywords, ignored } = scoreArticle(
        topic,
        config.urgencyKeywords,
        config.ignoredTopics,
        res
      );
      if (ignored || score < scoreThreshold) continue;

      const headline = res.title || topic.topic;
      const summary = res.content ?? "";

      items.push({
        id: res.url || `${headline}-${score}`,
        url: res.url,
        topic: topic.topic,
        headline,
        summary,
        score,
        scoreBreakdown: {
          base: score,
          multiplier: topic.multiplier,
        },
        channelHint: "#breaking-news",
        formattedSlackText: "",
        priorityFlag: score >= 9,
        priorityScore: score,
        seenBefore: false,
        origin: "topicSearch",
        badge: null,
        matchedKeywords,
      });
    }
  }

  // Note: CFP BREAKING/LIVE scanning and commentator narrative signals
  // will be layered in here in follow-up iterations.

  // Sort by score descending, highest first.
  items.sort((a, b) => b.score - a.score);

  return items;
}


#!/usr/bin/env node
/**
 * news-pipeline-mcp: News and intel orchestration MCP server for OpenClaw/NanoBot.
 *
 * This initial implementation focuses on wiring MCP tools and types. The
 * internal pipeline modules (config loader, scoring, history, etc.) can be
 * filled in incrementally.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NewsRunJobResult, NewsPreviewBreakingResult, NewsItem } from "./types.js";
import { loadPipelineConfig, resolveJob } from "./config.js";
import { checkSeen, historySources, markSeen } from "./history.js";
import { runBreakingNewsPipeline } from "./search.js";
import { formatBreakingItem, formatNarrativeSignal } from "./formatter.js";
import { collectNarrativeSignals } from "./narrative.js";

const OPENCLAW_BASE_DIR =
  process.env.OPENCLAW_BASE_DIR || `${process.env.HOME || "/root"}/.openclaw`;
const SEARXNG_BASE_URL =
  process.env.SEARXNG_BASE_URL || "http://localhost:8080";

function toTextContent(obj: unknown) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  const content: { type: "text"; text: string }[] = [{ type: "text", text }];
  return { content };
}

function generateRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

const server = new McpServer({
  name: "news-pipeline-mcp",
  version: "0.1.0",
});

server.registerTool(
  "news_run_job",
  {
    title: "Run a configured news job",
    description:
      "Run a configured news job (breaking, intel, GA, etc.) and return structured results.",
    inputSchema: z.object({
      jobId: z
        .string()
        .min(1)
        .describe("Job identifier, e.g. breaking-news-sweep"),
      overrideQuietWindow: z
        .boolean()
        .optional()
        .describe("If true, run even during the Sunday quiet window."),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, do not persist history changes."),
    }),
  },
  async ({ jobId, dryRun }) => {
    const runId = generateRunId();
    const timestamp = new Date().toISOString();

    const job = await resolveJob(OPENCLAW_BASE_DIR, jobId);
    if (!job) {
      const result: NewsRunJobResult = {
        jobId,
        runId,
        timestamp,
        status: "error",
        items: [],
        deliveryPolicy: {
          mode: "returnOnly",
          channels: [],
          ntfy: false,
        },
        errorMessage: `Unknown jobId: ${jobId}`,
      };
      return toTextContent(result);
    }

    let items: NewsItem[] = [];

    if (job.type === "breaking") {
      const config = await loadPipelineConfig(OPENCLAW_BASE_DIR);
      const candidates = await runBreakingNewsPipeline(config, {
        searxngBaseUrl: SEARXNG_BASE_URL,
      });

      // Dedupe against history.
      const withSeenFlags = await Promise.all(
        candidates.map(async (item) => {
          const seenInfo = await checkSeen(OPENCLAW_BASE_DIR, item.url);
          return { item, seen: seenInfo.seen };
        })
      );

      const unseen = withSeenFlags.filter(({ seen }) => !seen).map(({ item }) => item);

      // Optionally mark as seen when not a dry run.
      if (!dryRun) {
        await Promise.all(
          unseen.map((item) =>
            markSeen(
              OPENCLAW_BASE_DIR,
              item.url,
              item.topic,
              job.type === "georgia"
            )
          )
        );
      }

      // Apply Senior Analyst formatting.
      items = unseen.map((item) => ({
        ...item,
        formattedSlackText: formatBreakingItem(item),
        seenBefore: false,
      }));
    } else {
      // Other job types can be layered in later.
      items = [];
    }

    const result: NewsRunJobResult = {
      jobId,
      runId,
      timestamp,
      status: "ok",
      items,
      deliveryPolicy: job.deliveryPolicy,
    };

    return toTextContent({
      baseDir: OPENCLAW_BASE_DIR,
      result,
    });
  }
);

server.registerTool(
  "news_get_config",
  {
    title: "Get news pipeline configuration summary",
    description:
      "Return a high-level view of news pipeline configuration (topics, keywords, jobs).",
  },
  async (_extra) => {
    const config = await loadPipelineConfig(OPENCLAW_BASE_DIR);
    const configSummary = {
      baseDir: config.baseDir,
      jobs: config.jobs,
      priorityTopicsCount: config.priorityTopics.length,
      urgencyKeywordsCount: config.urgencyKeywords.length,
      ignoredTopicsCount: config.ignoredTopics.length,
      commentatorsCount: config.commentators.length,
    };

    return toTextContent(configSummary);
  }
);

server.registerTool(
  "news_preview_breaking_news",
  {
    title: "Preview breaking news pipeline",
    description:
      "Run the breaking-news pipeline phases (placeholder implementation) and return structured results.",
  },
  async () => {
    const runId = generateRunId();
    const timestamp = new Date().toISOString();

    const config = await loadPipelineConfig(OPENCLAW_BASE_DIR);
    const breakingItemsRaw = await runBreakingNewsPipeline(config, {
      searxngBaseUrl: SEARXNG_BASE_URL,
    });

    const breakingItems: NewsItem[] = breakingItemsRaw.map((item) => ({
      ...item,
      formattedSlackText: formatBreakingItem(item),
    }));

    const narrativeSignalsRaw = await collectNarrativeSignals(config, {});
    const intelSignals = narrativeSignalsRaw.map((signal) => ({
      ...signal,
      formattedSlackText: formatNarrativeSignal(signal),
    }));

    const result: NewsPreviewBreakingResult = {
      runId,
      timestamp,
      breakingItems,
      intelSignals,
    };

    return toTextContent({
      baseDir: OPENCLAW_BASE_DIR,
      result,
    });
  }
);

server.registerTool(
  "news_get_history_status",
  {
    title: "Get history status for a URL",
    description: "Summarize history/dedupe status for a given URL (placeholder).",
    inputSchema: z.object({
      url: z
        .string()
        .min(1)
        .describe("News article URL to check in history."),
    }),
  },
  async ({ url }, _extra) => {
    const seenInfo = await checkSeen(OPENCLAW_BASE_DIR, url);
    const status = {
      url,
      seen: seenInfo.seen,
      sourcesChecked: historySources(OPENCLAW_BASE_DIR),
    };

    return toTextContent(status);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

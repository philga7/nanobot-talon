import { readFile } from "fs/promises";
import { join } from "path";
import type { JobDefinition } from "./types.js";

export interface PriorityTopic {
  topic: string;
  multiplier: number;
  tags?: string[];
}

export interface UrgencyKeyword {
  keyword: string;
  weight: number;
}

export interface CommentatorSource {
  handle: string;
  label: string;
}

export interface PipelineConfig {
  baseDir: string;
  priorityTopics: PriorityTopic[];
  urgencyKeywords: UrgencyKeyword[];
  ignoredTopics: string[];
  commentators: CommentatorSource[];
  jobs: JobDefinition[];
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    const buf = await readFile(path, "utf8");
    return buf.toString();
  } catch {
    return null;
  }
}

function parseSimpleList(md?: string | null): string[] {
  if (!md) return [];
  return md
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"))
    .map((line) => line.replace(/^[-*]\s*/, "").trim());
}

function parsePriorityTopics(md?: string | null): PriorityTopic[] {
  const lines = parseSimpleList(md);
  return lines.map((line) => {
    // Formats like: "Markets:1.5" or "Markets (tag1,tag2):1.5"
    const [left, multStr] = line.split(":").map((s) => s.trim());
    const multiplier = Number.parseFloat(multStr || "1") || 1;
    let topic = left;
    let tags: string[] | undefined;

    const match = left.match(/^(.*)\((.*)\)$/);
    if (match) {
      topic = match[1].trim();
      tags = match[2]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    return { topic, multiplier, tags };
  });
}

function parseUrgencyKeywords(md?: string | null): UrgencyKeyword[] {
  const lines = parseSimpleList(md);
  return lines.map((line) => {
    // Formats like: "urgent:+3" or "crisis:3"
    const [kw, weightStr] = line.split(":").map((s) => s.trim());
    const weight = Number.parseFloat(weightStr?.replace("+", "") || "1") || 1;
    return { keyword: kw, weight };
  });
}

function parseCommentators(md?: string | null): CommentatorSource[] {
  const lines = parseSimpleList(md);
  return lines.map((line) => {
    // Formats like: "@RodDMartin - Rod D. Martin"
    const [handlePart, labelPart] = line.split("-").map((s) => s.trim());
    const handle = handlePart.replace(/^@/, "");
    const label = labelPart || handlePart;
    return { handle, label };
  });
}

async function loadJobsFromJson(baseDir: string): Promise<JobDefinition[]> {
  const path = join(baseDir, "cron", "jobs.json");
  const text = await readTextFile(path);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as JobDefinition[];
    }
    if (Array.isArray(parsed.jobs)) {
      return parsed.jobs as JobDefinition[];
    }
  } catch {
    // fall through
  }
  return [];
}

export async function loadPipelineConfig(baseDir: string): Promise<PipelineConfig> {
  const [priorityMd, urgencyMd, ignoredMd, commentatorsMd, jobs] = await Promise.all([
    readTextFile(join(baseDir, "data", "priority_topics.md")),
    readTextFile(join(baseDir, "data", "urgency_keywords.md")),
    readTextFile(join(baseDir, "data", "ignored_topics.md")),
    readTextFile(join(baseDir, "workspace", "sources", "commentators.md")),
    loadJobsFromJson(baseDir),
  ]);

  return {
    baseDir,
    priorityTopics: parsePriorityTopics(priorityMd),
    urgencyKeywords: parseUrgencyKeywords(urgencyMd),
    ignoredTopics: parseSimpleList(ignoredMd),
    commentators: parseCommentators(commentatorsMd),
    jobs,
  };
}

export async function resolveJob(baseDir: string, jobId: string): Promise<JobDefinition | undefined> {
  const { jobs } = await loadPipelineConfig(baseDir);
  return jobs.find((job) => job.id === jobId);
}

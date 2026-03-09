import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface HistoryEntry {
  url: string;
  topic?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  [key: string]: unknown;
}

interface HistoryFiles {
  primary: string;
  georgia: string;
}

async function readHistory(path: string): Promise<HistoryEntry[]> {
  try {
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as HistoryEntry[];
    }
    if (Array.isArray((parsed as any).entries)) {
      return (parsed as any).entries as HistoryEntry[];
    }
  } catch {
    // ignore
  }
  return [];
}

async function writeHistory(path: string, entries: HistoryEntry[]): Promise<void> {
  const payload = JSON.stringify(entries, null, 2);
  await writeFile(path, payload, "utf8");
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

function getHistoryFiles(baseDir: string): HistoryFiles {
  return {
    primary: join(baseDir, "news_history.json"),
    georgia: join(baseDir, "georgia_news_history.json"),
  };
}

export async function checkSeen(baseDir: string, url: string): Promise<{ seen: boolean }> {
  const norm = normalizeUrl(url);
  const files = getHistoryFiles(baseDir);
  const [primary, georgia] = await Promise.all([
    readHistory(files.primary),
    readHistory(files.georgia),
  ]);
  const all = [...primary, ...georgia];
  const seen = all.some((entry) => normalizeUrl(entry.url) === norm);
  return { seen };
}

export async function markSeen(
  baseDir: string,
  url: string,
  topic?: string,
  isGeorgia?: boolean
): Promise<void> {
  const norm = normalizeUrl(url);
  const files = getHistoryFiles(baseDir);
  const targetPath = isGeorgia ? files.georgia : files.primary;
  const entries = await readHistory(targetPath);
  const now = new Date().toISOString();

  const existing = entries.find((e) => normalizeUrl(e.url) === norm);
  if (existing) {
    existing.lastSeenAt = now;
    if (topic && !existing.topic) {
      existing.topic = topic;
    }
  } else {
    entries.push({
      url: norm,
      topic,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  await writeHistory(targetPath, entries);
}

export function historySources(baseDir: string): string[] {
  const files = getHistoryFiles(baseDir);
  return [files.primary, files.georgia];
}


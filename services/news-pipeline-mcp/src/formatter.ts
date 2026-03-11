import type { NarrativeSignal, NewsItem } from "./types.js";

function embedLink(url: string, text: string): string {
  return `<${url}|${text}>`;
}

export function formatBreakingItem(item: NewsItem): string {
  const emoji = item.priorityFlag ? "🚨" : "📰";
  const headline = `*${item.headline}*`;
  const linkText = embedLink(item.url, "source");
  const sentence = item.summary
    ? `${headline} — ${item.summary} ${linkText}`
    : `${headline} — ${linkText}`;
  return `> * ${emoji} ${sentence.trim()}`;
}

export function formatNarrativeSignal(signal: NarrativeSignal): string {
  const emoji = "🎙️";
  const commentator = `*${signal.commentator}*`;
  const linkText = embedLink(signal.url, "thread");
  const sentence = signal.summary
    ? `${commentator} — ${signal.summary} ${linkText}`
    : `${commentator} — ${linkText}`;
  return `> * ${emoji} ${sentence.trim()}`;
}


import type { NarrativeSignal } from "./types.js";
import type { PipelineConfig } from "./config.js";

export interface NarrativeOptions {
  // Placeholder for future integration (e.g., limits, lookback windows).
  maxPerCommentator?: number;
}

export async function collectNarrativeSignals(
  _config: PipelineConfig,
  _options: NarrativeOptions = {}
): Promise<NarrativeSignal[]> {
  // Placeholder: in a future iteration, this will:
  // - Use configured commentators to fetch recent posts/threads from X/Twitter.
  // - Filter and summarize them into NarrativeSignal objects.
  // For now, we return an empty list so that the rest of the pipeline
  // can treat this as an optional layer.
  return [];
}


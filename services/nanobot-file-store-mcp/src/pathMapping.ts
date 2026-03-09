import path from "node:path";

export type AppName = "journal" | "todos" | "projects" | "news" | "portfolio" | (string & {});

export type DocType =
  | "daily_journal"
  | "daily_todos"
  | "project"
  | "daily_news"
  | "news_topic"
  | "portfolio_current"
  | "portfolio_snapshot"
  | (string & {});

export interface PathMappingInput {
  app: AppName;
  id: string;
  docType?: DocType;
  date?: string; // ISO date string (YYYY-MM-DD) when relevant
}

export function mapToRelativePath(input: PathMappingInput): string {
  const { app, id, docType, date } = input;

  switch (app) {
    case "journal": {
      const d = date ?? id;
      const [year, month] = d.split("-");
      return path.join("journal", year, month, `${d}.md`);
    }
    case "todos": {
      if (docType === "daily_todos") {
        const d = date ?? id;
        const [year, month] = d.split("-");
        return path.join("todos", "daily", year, month, `${d}.json`);
      }
      if (id === "inbox") {
        return path.join("todos", "inbox.json");
      }
      return path.join("todos", `${id}.json`);
    }
    case "projects": {
      return path.join("projects", `${id}.json`);
    }
    case "news": {
      if (docType === "news_topic") {
        return path.join("news", "topics", `${id}.md`);
      }
      const d = date ?? id;
      const [year, month] = d.split("-");
      return path.join("news", year, month, `${d}.md`);
    }
    case "portfolio": {
      if (docType === "portfolio_current" || id === "current") {
        return path.join("portfolio", "current.json");
      }
      const d = date ?? id;
      return path.join("portfolio", "snapshots", `${d}.json`);
    }
    default: {
      // Fallback: app/id as a directory with id as filename (no extension)
      return path.join(app, `${id}`);
    }
  }
}


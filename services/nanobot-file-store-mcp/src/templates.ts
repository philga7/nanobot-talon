import path from "node:path";
import { FsAdapter } from "./fsAdapter.js";

export interface TemplateContext {
  app: string;
  docType?: string;
  date?: string;
  weekday?: string;
}

export async function loadTemplate(
  fsAdapter: FsAdapter,
  app: string,
  docType?: string,
  templateName?: string
): Promise<string | null> {
  const candidates: string[] = [];

  if (templateName) {
    candidates.push(path.join("templates", app, `${templateName}.md`));
    candidates.push(path.join("templates", app, `${templateName}.json`));
  }
  if (docType) {
    candidates.push(path.join("templates", app, `${docType}.md`));
    candidates.push(path.join("templates", app, `${docType}.json`));
  }

  for (const rel of candidates) {
    if (await fsAdapter.exists(rel)) {
      return fsAdapter.readFile(rel);
    }
  }

  return null;
}

export function renderTemplate(raw: string, ctx: TemplateContext): string {
  let output = raw;
  const replacements: Record<string, string | undefined> = {
    date: ctx.date,
    weekday: ctx.weekday,
    app: ctx.app,
    docType: ctx.docType,
  };

  for (const [key, value] of Object.entries(replacements)) {
    if (value) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      output = output.replace(pattern, value);
    }
  }

  return output;
}


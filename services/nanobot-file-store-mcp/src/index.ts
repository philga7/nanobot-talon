import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import os from "node:os";
import path from "node:path";
import { FsAdapter } from "./fsAdapter.js";
import { mapToRelativePath } from "./pathMapping.js";
import { loadTemplate, renderTemplate } from "./templates.js";

const DATA_ROOT =
  process.env.OPENCLAW_DATA_ROOT ||
  process.env.NANOBOT_FILE_STORE_ROOT ||
  path.join(os.homedir(), ".nanobot-file-store");

const fsAdapter = new FsAdapter({ root: DATA_ROOT });

function toTextContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

const server = new McpServer({
  name: "nanobot-file-store-mcp",
  version: "0.1.0",
});

server.tool(
  "file_store_read_document",
  "Read a logical document from the file-backed store",
  {
    app: z.string().min(1),
    id: z.string().min(1),
    docType: z.string().optional(),
  },
  async ({ app, id, docType }) => {
    const relPath = mapToRelativePath({ app, id, docType });
    const content = await fsAdapter.readFile(relPath);
    const result = {
      app,
      id,
      docType,
      path: relPath,
      content,
    };
    return toTextContent(JSON.stringify(result, null, 2));
  }
);

server.tool(
  "file_store_list_documents",
  "List documents for an app, optionally filtered by docType and date range",
  {
    app: z.string().min(1),
    docType: z.string().optional(),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  },
  async ({ app, docType, since, until, limit }) => {
    const appRoot = app;
    const files = await fsAdapter.walkFiles(appRoot);

    const sinceDate = since ? new Date(since) : undefined;
    const untilDate = until ? new Date(until) : undefined;

    const items = files
      .map((relPath) => {
        const fileName = relPath.split("/").pop() ?? relPath;
        const base = fileName.replace(/\.[^.]+$/, "");
        let inferredId = base;
        let date: string | undefined;

        const dateMatch = base.match(/^(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch) {
          date = dateMatch[1];
          inferredId = date;
        } else if (base === "current") {
          inferredId = "current";
        }

        let docTypeGuess: string | undefined = docType;
        if (!docTypeGuess) {
          if (app === "todos" && relPath.endsWith("inbox.json")) {
            docTypeGuess = "todos_list";
          } else if (app === "todos" && relPath.includes("/daily/")) {
            docTypeGuess = "daily_todos";
          } else if (app === "journal") {
            docTypeGuess = "daily_journal";
          } else if (app === "news" && relPath.includes("/topics/")) {
            docTypeGuess = "news_topic";
          } else if (app === "news") {
            docTypeGuess = "daily_news";
          } else if (app === "portfolio" && relPath.endsWith("current.json")) {
            docTypeGuess = "portfolio_current";
          } else if (app === "portfolio" && relPath.includes("/snapshots/")) {
            docTypeGuess = "portfolio_snapshot";
          }
        }

        if (docType && docTypeGuess && docTypeGuess !== docType) {
          return null;
        }

        if (sinceDate || untilDate) {
          if (date) {
            const d = new Date(date);
            if (sinceDate && d < sinceDate) return null;
            if (untilDate && d > untilDate) return null;
          }
        }

        return {
          app,
          id: inferredId,
          docType: docTypeGuess,
          path: relPath,
          date,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const limited = typeof limit === "number" ? items.slice(0, limit) : items;
    return toTextContent(JSON.stringify({ app, docType, items: limited }, null, 2));
  }
);

server.tool(
  "file_store_write_document",
  "Create or replace a logical document in the file-backed store",
  {
    app: z.string().min(1),
    id: z.string().min(1),
    docType: z.string().optional(),
    content: z.string().describe("Full document content to write"),
    upsert: z.boolean().optional().default(true),
    ifNotExists: z.boolean().optional(),
  },
  async ({ app, id, docType, content, upsert, ifNotExists }) => {
    const relPath = mapToRelativePath({ app, id, docType });

    const exists = await fsAdapter.exists(relPath);
    if (!exists && upsert === false) {
      throw new Error(`Document does not exist and upsert=false: ${app}/${id}`);
    }
    if (exists && ifNotExists) {
      throw new Error(`Document already exists and ifNotExists=true: ${app}/${id}`);
    }

    await fsAdapter.writeFile(relPath, content);
    const result = { app, id, docType, path: relPath };
    return toTextContent(JSON.stringify(result, null, 2));
  }
);

server.tool(
  "file_store_delete_document",
  "Delete a logical document from the file-backed store",
  {
    app: z.string().min(1),
    id: z.string().min(1),
    docType: z.string().optional(),
    mode: z.enum(["trash", "hard"]).optional().default("trash"),
  },
  async ({ app, id, docType, mode }) => {
    const relPath = mapToRelativePath({ app, id, docType });
    if (mode === "hard") {
      await fsAdapter.deleteFile(relPath);
      return toTextContent(JSON.stringify({ app, id, docType, deleted: true, mode }, null, 2));
    }

    const trashRelPath = path.join("trash", `${Date.now()}-${relPath.replace(/[\\/]/g, "__")}`);
    const content = await fsAdapter.readFile(relPath);
    await fsAdapter.writeFile(trashRelPath, content);
    await fsAdapter.deleteFile(relPath);
    return toTextContent(
      JSON.stringify({ app, id, docType, deleted: true, mode, trashPath: trashRelPath }, null, 2)
    );
  }
);

server.tool(
  "file_store_ensure_daily_document",
  "Ensure a dated daily document exists for an app, creating from template if missing",
  {
    app: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    docType: z.string().optional(),
    templateName: z.string().optional(),
  },
  async ({ app, date, docType, templateName }) => {
    const id = date;
    const relPath = mapToRelativePath({ app, id, docType, date });
    let content: string;

    const exists = await fsAdapter.exists(relPath);
    if (exists) {
      content = await fsAdapter.readFile(relPath);
    } else {
      const tmpl = await loadTemplate(fsAdapter, app, docType, templateName);
      const weekday = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
      const base = tmpl ?? "";
      content = renderTemplate(base, { app, docType, date, weekday });
      await fsAdapter.writeFile(relPath, content);
    }

    const result = {
      app,
      id,
      docType,
      path: relPath,
      content,
    };
    return toTextContent(JSON.stringify(result, null, 2));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);


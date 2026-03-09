import assert from "node:assert";
import { mapToRelativePath } from "../src/pathMapping.js";

assert.strictEqual(
  mapToRelativePath({ app: "journal", id: "2026-03-08" }),
  "journal/2026/03/2026-03-08.md"
);

assert.strictEqual(
  mapToRelativePath({ app: "todos", id: "inbox" }),
  "todos/inbox.json"
);

assert.strictEqual(
  mapToRelativePath({ app: "todos", id: "2026-03-08", docType: "daily_todos", date: "2026-03-08" }),
  "todos/daily/2026/03/2026-03-08.json"
);

assert.strictEqual(
  mapToRelativePath({ app: "portfolio", id: "current", docType: "portfolio_current" }),
  "portfolio/current.json"
);


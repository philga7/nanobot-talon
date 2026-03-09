import assert from "node:assert";
import { renderTemplate } from "../src/templates.js";

const tmpl = "# {{app}} {{docType}} for {{date}} ({{weekday}})";

const rendered = renderTemplate(tmpl, {
  app: "journal",
  docType: "daily_journal",
  date: "2026-03-08",
  weekday: "Sunday",
});

assert(rendered.includes("journal"));
assert(rendered.includes("daily_journal"));
assert(rendered.includes("2026-03-08"));
assert(rendered.includes("Sunday"));


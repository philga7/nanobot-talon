# news-pipeline-mcp

News and intel orchestration MCP server for OpenClaw/NanoBot.

This service exposes high-level tools for running configured news jobs
(breaking news sweeps, intel signals, Georgia-specific sweeps, etc.) and
returns structured results plus Senior Analyst–formatted Slack text.

## Setup (Dockerized Talon/WrenAir)

In the Talon/WrenAir Docker deployment, this service is intended to be
built into the `nanobot-gateway` and `nanobot-cli` images at:

```text
/app/services/news-pipeline-mcp/dist/index.js
```

## Local build

```bash
cd services/news-pipeline-mcp
npm install
npm run build
```

## Tools

- `news_run_job` — Run a configured news job (e.g. `breaking-news-sweep`) and return structured results.
- `news_preview_breaking_news` — Preview breaking pipeline output (breaking items + intel signals) without writing history.
- `news_get_config` — Summarize pipeline configuration (jobs, base directory, and later topics/keywords).
- `news_get_history_status` — Inspect history/dedupe status for a given URL.

## NanoBot MCP configuration (stdio)

In `~/.nanobot/config.json`, add a `newsPipeline` MCP server under
`tools.mcpServers` (path may vary depending on your Docker image layout):

```json
"newsPipeline": {
  "command": "node",
  "args": ["/app/services/news-pipeline-mcp/dist/index.js"],
  "env": {
    "OPENCLAW_BASE_DIR": "/root/.openclaw",
    "SEARXNG_BASE_URL": "http://searxng:8080"
  },
  "toolTimeout": 60
}
```


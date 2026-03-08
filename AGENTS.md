# NanoBot Talon Fork

## Project

This repository is a shallow fork of `nanobot` for the Talon deployment. Keep NanoBot responsible for sessions, chat channels, CLI behavior, and MCP orchestration. Move durable memory ownership, approval workflows, and other Talon-specific services behind explicit seams instead of hard-forking core agent logic.

Current roadmap and branch plan live in `.cursor/plans/talon_fork_phases_e4896c1f.plan.md`.

## Architecture Priorities

- Keep the fork rebase-friendly and close to upstream NanoBot.
- Prefer config-gated seams over broad Talon-only branches in the code.
- Preserve session history as NanoBot's working memory.
- When Mem0 is disabled, treat `workspace/memory/MEMORY.md` as read-only compatibility input. When Mem0 is enabled, memory is managed remotely; NanoBot does not write to MEMORY.md or HISTORY.md.
- Prefer remote MCP services over baking Talon integrations into NanoBot core.

## Mem0 Remote Memory

When Mem0 is enabled (`mem0.enabled: true`), long-term memory is stored in Mem0 (PostgreSQL + pgvector + Neo4j) instead of file-based MEMORY.md/HISTORY.md. See [docs/mem0.md](docs/mem0.md) for starting, stopping, backing up, and sharing Mem0 data.

## SearXNG (Web Search)

Web search uses SearXNG when `tools.web.search.searxngBaseUrl` is set (e.g. `http://localhost:8080/`). The instance lives in [searxng/](searxng/) with its own `docker-compose.yml` and `config/settings.yml`. Start with `cd searxng && docker compose up -d`; `./scripts/start.sh` can start it as part of the stack (see README).

## ntfy (Push Notifications)

Push notifications use a remote ntfy server (e.g. VPS at https://ntfy.informedcrew.com) via the ntfy-me-mcp MCP server. Add `ntfy` to `tools.mcpServers` in NanoBot config with `NTFY_URL`, `NTFY_TOPIC`, and `NTFY_TOKEN`. See [docs/ntfy.md](docs/ntfy.md) for setup.

## Key Areas

- `nanobot/agent/`: core loop, prompt/context building, memory seams, tool registry (incl. web_search via SearXNG)
- `nanobot/session/`: session persistence and working-memory behavior
- `nanobot/config/`: schema, config loading, and migrations
- `nanobot/channels/`: chat transports and gateway integrations
- `tests/`: regression coverage for agent, config, and memory behavior
- `.cursor/rules/`: role-specific guidance for backend, architecture, QA, MCP, and future services

## Change Guidelines

- Keep normal NanoBot behavior intact when Talon mode is off.
- Make long-term memory ownership explicit; do not let NanoBot silently self-author durable memory in Talon mode.
- Avoid secrets in code, fixtures, logs, or markdown examples.
- Update tests whenever behavior changes in agent flow, config migration, or memory handling.

## Verification

- Lint: `python -m ruff check .`
- Test: `python -m pytest`

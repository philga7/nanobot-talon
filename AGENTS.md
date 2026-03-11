# NanoBot Talon Fork

## Project

This repository is a shallow fork of `nanobot` for the Talon deployment. Keep NanoBot responsible for sessions, chat channels, CLI behavior, and MCP orchestration. Move durable memory ownership, approval workflows, and other Talon-specific services behind explicit seams instead of hard-forking core agent logic.

Current roadmap and branch plan live in `.cursor/plans/talon_fork_phases_e4896c1f.plan.md`.

## Architecture Priorities

- Keep the fork rebase-friendly and close to upstream NanoBot.
- Prefer config-gated seams over broad Talon-only branches in the code.
- Preserve session history as NanoBot's working memory.
- When Mem0 is disabled, use NanoBot's upstream **token-window `MemoryConsolidator`** for session history and treat `workspace/memory/MEMORY.md` as read-only compatibility input.
- When Mem0 is enabled, long-term memory is managed remotely via Mem0 and its MCP tools; NanoBot disables internal consolidation and does not write to `MEMORY.md` or `HISTORY.md`.
- Prefer remote MCP services over baking Talon integrations into NanoBot core.

## Upstream Alignment (Memory, Tools, Channels)

- The Talon fork tracks upstream NanoBot's redesigned **agent loop**:
  - Uses provider-owned generation settings and `chat_with_retry`.
  - Uses `MemoryConsolidator` for token-based consolidation **only** when Mem0 is off.
  - Layers Mem0 auto-recall/auto-capture on top via an MCP client when enabled.
- Filesystem tools are based on upstream's `_FsTool` with:
  - Paginated, line-numbered `read_file`.
  - Fuzzy, context-aware `edit_file`.
  - Directory listing with recursion and common ignore patterns.
- When Mem0 is enabled, filesystem tools are configured to **block writes/edits** to `memory/MEMORY.md` and `memory/HISTORY.md`, enforcing Mem0 as the durable store.
- Channel wiring uses upstream's **auto-discovered registry**, with Talon-specific behavior (e.g. Matrix workspace restriction) added via constructor/config seams rather than hard-forks.

## Mem0 Remote Memory

When Mem0 is enabled (`mem0.enabled: true`), long-term memory is stored in Mem0 (PostgreSQL + pgvector + Neo4j) instead of file-based MEMORY.md/HISTORY.md. See [docs/mem0.md](docs/mem0.md) for starting, stopping, backing up, and sharing Mem0 data.

## SearXNG (Web Search)

Web search uses SearXNG when `tools.web.search.searxngBaseUrl` is set (e.g. `http://localhost:8080/`). The instance lives in [searxng/](searxng/) with its own `docker-compose.yml` and `config/settings.yml`. Start with `cd searxng && docker compose up -d`; `./scripts/start.sh` can start it as part of the stack (see README).

## ntfy (Push Notifications)

Push notifications use a remote ntfy server (e.g. VPS at https://ntfy.informedcrew.com) via the ntfy-me-mcp MCP server. Add `ntfy` to `tools.mcpServers` in NanoBot config with `NTFY_URL`, `NTFY_TOPIC`, and `NTFY_TOKEN`. See [docs/ntfy.md](docs/ntfy.md) for setup.

## bird (X/Twitter Read-Only)

Read X/Twitter profiles and tweets via [@steipete/bird](https://www.npmjs.com/package/@steipete/bird) through the `bird-x-read-mcp` MCP server, which is built into the Docker image. Add `bird` to `tools.mcpServers` with `AUTH_TOKEN` and `CT0` env vars (the MCP command path inside the container is `/app/services/bird-mcp/dist/index.js`). See [docs/bird.md](docs/bird.md) for setup.

## Journaling, Todos, and Notes (Talon)

Talon bots can access journals, markdown-backed todo lists, and Markdown knowledge bases via **external MCP servers**:

- Journaling MCP: `mtct/journaling_mcp`
- Todo MCP: `danjdewhurst/todo-md-mcp`
- Library MCP: `lethain/library-mcp`

These run as remote services (often behind an MCP bridge such as `talon-mcp-bridge`) and are wired into NanoBot purely via `tools.mcpServers` in the Talon instance configs. See `docs/talon-journaling-todos-notes.md` and `docs/talon-multi-bots.md` for recommended per-bot layouts and URLs.

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

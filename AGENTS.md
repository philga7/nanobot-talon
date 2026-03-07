# NanoBot Talon Fork

## Project

This repository is a shallow fork of `nanobot` for the Talon deployment. Keep NanoBot responsible for sessions, chat channels, CLI behavior, and MCP orchestration. Move durable memory ownership, approval workflows, and other Talon-specific services behind explicit seams instead of hard-forking core agent logic.

Current roadmap and branch plan live in `.cursor/plans/talon_fork_phases_e4896c1f.plan.md`.

## Architecture Priorities

- Keep the fork rebase-friendly and close to upstream NanoBot.
- Prefer config-gated seams over broad Talon-only branches in the code.
- Preserve session history as NanoBot's working memory.
- In Talon mode, treat `workspace/memory/MEMORY.md` as read-only compatibility input.
- Prefer remote MCP services over baking Talon integrations into NanoBot core.

## Key Areas

- `nanobot/agent/`: core loop, prompt/context building, memory seams, tool registry
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

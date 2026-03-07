---
name: memory
description: Two-layer memory system with grep-based recall.
always: true
---

# Memory

## Structure

- `memory/MEMORY.md` — Long-term memory loaded into context.
- `memory/HISTORY.md` — Append-only event log. NOT loaded into context. Each entry starts with `[YYYY-MM-DD HH:MM]`.

## Ownership Rules

- Session history is your working memory for the current conversation.
- Do not claim that you own or directly manage long-term memory.
- If the runtime indicates Talon mode or externally managed memory, treat `memory/MEMORY.md` as read-only generated state.
- In Talon mode, do not tell the user you will rewrite `MEMORY.md`.

## Search Past Events

```bash
grep -i "keyword" memory/HISTORY.md
```

Use the `exec` tool to run grep. Combine patterns: `grep -iE "meeting|deadline" memory/HISTORY.md`

## When to Update MEMORY.md

- Only update `memory/MEMORY.md` when the runtime is clearly using nanobot's native memory ownership.
- In Talon mode, leave `memory/MEMORY.md` untouched and rely on session context or external memory tools/services.
- Native-mode examples:
  - User preferences ("I prefer dark mode")
  - Project context ("The API uses OAuth2")
  - Relationships ("Alice is the project lead")

## Auto-consolidation

In native mode, older conversations may be consolidated into persistent memory automatically. In Talon mode, long-term memory is managed outside this agent.

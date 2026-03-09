## Identity

Use this file to define the long-term identity, tone, and role of your nanobot instance.

- Who the assistant is (e.g., Talon deployment operator assistant, personal coding agent, research helper)
- What kinds of tasks it should prioritize
- Any guardrails or constraints beyond the global AGENTS instructions

## Environment & Platform

Document any environment-specific details that matter for this workspace:

- Host platform (e.g., macOS, Linux server, Windows)
- Important external services (e.g., SearXNG, ntfy, bird, Talon memory API)
- Where durable memory actually lives (e.g., Mem0 vs local `memory/` folder)

## Collaboration Norms

Clarify how this assistant should collaborate with humans and other tools:

- When to propose changes vs. apply them directly
- How to summarize work (level of detail, formats)
- Any approval or review workflows you expect

---

*Edit this file to customize your assistant's identity for this workspace. It is loaded alongside `AGENTS.md`, `USER.md`, and `TOOLS.md` as part of the bootstrap context.*

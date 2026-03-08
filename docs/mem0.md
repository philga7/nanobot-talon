# Mem0 Remote Memory

This document covers starting, stopping, backing up, and sharing Mem0 data when using NanoBot with Mem0 (Talon mode).

## Overview

When Mem0 is enabled, long-term memory is stored in Mem0 (PostgreSQL + pgvector + Neo4j) instead of `workspace/memory/MEMORY.md` and `HISTORY.md`. NanoBot recalls relevant memories before each turn and captures new memories after each reply.

- **Mem0 API** — `mem0-deploy` (PostgreSQL + Neo4j + mem0-api-server)
- **talon-mem0-mcp** — Bridge that exposes `/recall`, `/capture`, and MCP tools
- **NanoBot** — Connects to talon-mem0-mcp for auto-recall and auto-capture

See [mem0_remote_mcp_plan.md](../.cursor/plans/mem0_remote_mcp_plan.md) for the full architecture. For long-term retention, offloading, and planning, see [memory-management.md](memory-management.md).

---

## Starting

Use the provided scripts (recommended). They also start and stop SearXNG (from `searxng/`) if present.

```bash
./scripts/start.sh
```

Or manually:

```bash
# 1. Start Mem0 stack
cd mem0-deploy
docker compose up -d

# 2. Start talon-mem0-mcp and NanoBot
cd ..
docker compose up -d talon-mem0-mcp nanobot-gateway
```

Ensure `mem0.enabled: true` and `mem0.apiUrl` are set in `~/.nanobot/config.json`.

---

## Stopping (Without Destroying Data)

Use the provided script (it also stops SearXNG if it was started):

```bash
./scripts/stop.sh
```

Or manually:

```bash
docker compose down
cd mem0-deploy
docker compose down
```

**Important:** Do **not** use `docker compose down -v`. The `-v` flag removes volumes and **deletes all Mem0 data**.

| Command | Effect |
|---------|--------|
| `docker compose down` | Stops containers, **keeps** volumes |
| `docker compose down -v` | Stops containers, **removes** volumes (data lost) |

Mem0 data lives in Docker volumes:
- `mem0-for-nanobot_postgres-data` — Memories and embeddings
- `mem0-for-nanobot_neo4j-data` — Entity graph

---

## Backing Up

Mem0 stores data in PostgreSQL (main memory) and Neo4j (entity graph).

### PostgreSQL (primary backup)

```bash
cd mem0-deploy
docker compose exec postgres pg_dump -U postgres postgres > mem0_backup_$(date +%Y%m%d).sql
```

### Neo4j (graph relationships)

```bash
docker compose exec neo4j neo4j-admin database dump neo4j --to-path=/tmp
docker compose cp neo4j:/tmp/neo4j.dump ./neo4j_backup_$(date +%Y%m%d).dump
```

### Restore

```bash
# PostgreSQL
docker compose exec -T postgres psql -U postgres postgres < mem0_backup_20260101.sql

# Neo4j — stop, restore, start
docker compose stop neo4j
# Copy dump into neo4j data dir, then:
# docker compose exec neo4j neo4j-admin database load neo4j --from-path=/path/to/dump
docker compose start neo4j
```

---

## Sharing Data With Another Agent

### Option A: Same Mem0 Instance

Any agent that connects to the same talon-mem0-mcp (or Mem0 API) with the same `user_id` sees the same memories.

```json
{
  "mem0": {
    "enabled": true,
    "apiUrl": "http://localhost:3002",
    "userId": "default"
  }
}
```

Multiple agents using `userId: "default"` share memories. Use different `userId` values to isolate memories per agent or persona.

### Option B: Export and Import

1. **Export** via Mem0 API:
   ```bash
   curl "http://localhost:8000/memories?user_id=default"
   ```

2. **Import** into another Mem0 instance:
   ```bash
   curl -X POST http://other-mem0:8000/memories \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"..."}],"user_id":"default"}'
   ```

### Option C: Shared Deployment

Run one Mem0 stack and point multiple NanoBot instances (or other agents) at it. All use the same memories for a given `user_id`.

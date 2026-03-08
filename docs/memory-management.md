# Long-Term Memory Management

This document outlines general plans for evolving Mem0-backed memory over time: retention, offloading, and operational concerns.

## Context

Mem0 stores memories in PostgreSQL (pgvector) and Neo4j (entity graph). As volume grows, scaling limits emerge: HNSW index memory, storage growth, Neo4j graph orphan cleanup, and LLM cost per capture. Planning retention and offloading keeps the stack sustainable.

See [mem0.md](mem0.md) for day-to-day operations (start, stop, backup, share).

---

## Goals

1. **Predictable growth** — Control memory size via retention policy.
2. **Audit trail** — Preserve archived memories for restore or compliance.
3. **Simplicity** — Prefer orchestration around Mem0 over forking Mem0 itself.

---

## Retention Policy

### Time-based tiers

| Tier | Age | Storage | Access |
|------|-----|---------|--------|
| Hot | Last 30–90 days | Mem0 (vector + graph) | Full recall |
| Cold | Older | Exported JSON / object storage | Restore on demand |

**Implementation sketch:**

- Cron job or scheduled task runs periodically (e.g., weekly).
- Query Mem0 for memories older than `retention_days`.
- Export to dated JSON files (e.g., `archives/memories_2025-03-07.json`).
- Delete those memories from Mem0.

Config: `MEM0_RETENTION_DAYS` or equivalent in config.

### Usage-based (future)

- Track which memories are recalled over time.
- Archive “cold” (never/rarely recalled) memories first.
- Requires recall logging; Mem0 doesn’t expose this today.

---

## Offloading

### What “offload” means

Move older memories out of the active Mem0 store into cheaper, slower storage. Hot path stays small; cold data is retrievable but not in the vector index.

### Simple approach (this stack)

1. **Export** — Mem0 API `GET /memories` (filter by metadata or timestamp if supported; else filter post-query).
2. **Archive** — Write JSON to local directory or S3/GCS.
3. **Delete** — Mem0 API `DELETE /memories/{id}` for each exported memory.
4. **Restore** — Script that re-adds memories from archive into Mem0 when needed.

No Mem0 code changes; orchestration only.

### How larger systems do it

- Async write path: writes go to WAL/queue; indexing runs in background.
- Sharding: separate Mem0 instances or DBs per user/tenant.
- Swap vector store: replace pgvector with Qdrant, Milvus, or Pinecone at scale.
- Lazy re-indexing: cold data re-embedded and indexed only when queried.

For this environment, async export + delete is the practical first step.

---

## Priorities (Recommended Order)

| Priority | Action | Effort |
|----------|--------|--------|
| High | **Time-based retention + export** — Cron that exports memories older than N days to JSON, then deletes from Mem0 | Low |
| High | **Configurable retention window** — Env or config for `MEM0_RETENTION_DAYS` | Low |
| Medium | **Restore-from-archive flow** — Script/endpoint to re-import archived memories into Mem0 | Low–Medium |
| Medium | **Recall-frequency tracking** — Log recalls; use to prioritize which memories to keep vs archive | Medium |
| Lower | **Swap to Qdrant/Pinecone** — When pgvector becomes the bottleneck | Medium |
| Lower | **Per-user sharding** — When multi-user load justifies it | Medium |

---

## Out of Scope (For Now)

- Changes to Mem0 core or forked pipelines.
- Neo4j graph lifecycle (Mem0 has known delete/orphan issues).
- Automatic recall-quality optimization.
- Compliance frameworks (GDPR, HIPAA) beyond retention and export.

---

## Next Steps

When implementing:

1. Add a retention script (or service) that calls Mem0 API for export + delete.
2. Add `MEM0_RETENTION_DAYS` (or equivalent) to config/env.
3. Document archive format and restore procedure in [mem0.md](mem0.md).
4. Add archive path to backup docs (e.g., include `archives/` in backup rotation).

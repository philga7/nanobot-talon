# Talon Memory Engine → NanoBot Port

> Porting the three-tier Talon Memory Engine (Core Matrix / Episodic / Working) to run alongside NanoBot, with a self-updating pipeline and operator approval UI.

---

## 1. Architecture Delta

| Talon (original) | NanoBot Native | Ported Solution |
|---|---|---|
| `core_matrix.json` compiled from `*.md` | `MEMORY.md` flat file | Core Matrix injected via `talon-memory` MCP tool + MEMORY.md sync |
| PostgreSQL + pgvector episodic store | None | Postgres sidecar (unchanged) |
| Python in-process working memory dict | NanoBot session history | NanoBot sessions (no change needed) |
| Scheduled jobs (cron) | `cron/jobs.json` heartbeat | NanoBot cron jobs + memory-api scheduler |

NanoBot reads `MEMORY.md` on every prompt. The port strategy is to **make `MEMORY.md` the rendered output of Core Matrix**, keeping NanoBot's internals untouched.

---

## 2. File Layout

```
services/memory-api/
├── Dockerfile
├── pyproject.toml
├── app/
│   ├── main.py              # FastAPI app + MCP endpoint
│   ├── compressor.py        # Talon MemoryCompressor (ported from spec)
│   ├── episodic.py          # pgvector store, similarity search
│   ├── scheduler.py         # APScheduler jobs
│   ├── models.py            # SQLAlchemy / Pydantic models
│   └── mcp_server.py        # MCP HTTP/SSE server (starlette-mcp)
└── alembic/
    └── versions/
        └── 0001_initial.py

services/memory-ui/
├── Dockerfile
├── package.json
├── app/
│   ├── page.tsx             # Pending memory queue
│   ├── approved/page.tsx    # Approved memory browser
│   └── api/
│       ├── approve/route.ts
│       └── deny/route.ts
└── components/
    ├── MemoryCard.tsx
    └── MemoryQueue.tsx
```

---

## 3. Database Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Core memory rows (compiled from *.md sources)
CREATE TABLE core_memory (
    id          SERIAL PRIMARY KEY,
    category    TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    priority    INT NOT NULL DEFAULT 2,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category, key)
);

-- Episodic memory with vector embeddings
CREATE TABLE episodic_memory (
    id          SERIAL PRIMARY KEY,
    role        TEXT NOT NULL,          -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),
    session_id  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived    BOOLEAN NOT NULL DEFAULT FALSE,
    summary     TEXT                   -- populated after archive
);
CREATE INDEX ON episodic_memory USING hnsw (embedding vector_cosine_ops);

-- Pending memory candidates awaiting approval
CREATE TABLE pending_memories (
    id          SERIAL PRIMARY KEY,
    source      TEXT NOT NULL,         -- 'agent' | 'cron' | 'manual'
    tier        TEXT NOT NULL,         -- 'core' | 'episodic'
    category    TEXT,
    key         TEXT,
    value       TEXT NOT NULL,
    context     TEXT,                  -- snippet of conversation that triggered this
    status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at  TIMESTAMPTZ,
    deny_reason TEXT
);
```

---

## 4. Memory API — Key Endpoints

```python
# app/main.py (FastAPI)

@app.get("/health")
async def health(): return {"status": "ok"}

# MCP endpoint — used by NanoBot agent
@app.get("/mcp")          # SSE stream (MCP HTTP transport)
@app.post("/mcp")         # Tool calls

# REST endpoints — used by Memory UI
@app.get("/pending")                    # list pending memories
@app.post("/pending/{id}/approve")      # approve, write to MEMORY.md
@app.post("/pending/{id}/deny")         # deny with optional reason
@app.get("/core")                       # full core matrix
@app.get("/episodic/search")            # vector similarity search
@app.post("/memories/propose")          # agent proposes a new memory
```

### MCP Tools exposed to NanoBot

| Tool | Description |
|------|-------------|
| `memory_recall` | Vector search episodic memories (top-5 by cosine similarity) |
| `memory_propose` | Agent submits a memory candidate for operator approval |
| `memory_get_core` | Returns compiled core matrix as structured text |
| `memory_store_episodic` | Directly append to episodic store (no approval needed) |

---

## 5. Compressor Port

The `MemoryCompressor` from the Talon spec is copied verbatim into `app/compressor.py` with one addition — a `render_memory_md()` method that produces the `MEMORY.md` content NanoBot reads:

```python
def render_memory_md(self, core_matrix: dict) -> str:
    """Convert compiled core_matrix rows to MEMORY.md format for NanoBot."""
    lines = ["# Talon Core Memory", ""]
    current_cat = None
    for row in core_matrix["rows"]:
        cat, key, val, _ = row
        if cat != current_cat:
            lines.append(f"## {cat}")
            current_cat = cat
        lines.append(f"- {key}: {val}")
    lines += [
        "",
        f"*Compiled {core_matrix['compiled_at']} · {core_matrix['token_count']} tokens*"
    ]
    return "\n".join(lines)
```

This `MEMORY.md` is written to the NanoBot workspace volume (`/nanobot-workspace/MEMORY.md`) on every recompile, so NanoBot picks it up automatically.

---

## 6. Self-Updating Memory Pipeline

```
Conversation ends
      │
      ▼
NanoBot calls memory_propose MCP tool
  { tier: "core", category: "behavior", key: "...", value: "...", context: "..." }
      │
      ▼
talon-memory-api inserts into pending_memories (status=pending)
      │
      ▼
ntfy push notification sent to operator
  "New memory candidate: [behavior] prefer async/await over callbacks"
      │
      ▼
Operator opens Memory UI (localhost:3000 via SSH tunnel)
      │
      ├─ APPROVE → core_memory table updated
      │            compressor.compile() runs
      │            MEMORY.md rewritten on volume
      │            NanoBot picks up on next prompt
      │
      └─ DENY    → pending_memories.status = 'denied'
                   deny_reason stored
                   optionally: agent notified via next session context
```

---

## 7. Scheduled Jobs (NanoBot Cron Format)

Add to NanoBot's `workspace/cron/jobs.json`:

```json
[
  {
    "id": "memory_recompile",
    "schedule": "0 * * * *",
    "task": "Call http://talon-memory-api:8000/internal/recompile via shell"
  },
  {
    "id": "episodic_archive",
    "schedule": "0 3 * * *",
    "task": "Call http://talon-memory-api:8000/internal/archive via shell"
  },
  {
    "id": "working_memory_gc",
    "schedule": "*/15 * * * *",
    "task": "NanoBot native session GC (no change needed)"
  }
]
```

The memory-api also runs these internally via APScheduler as a fallback.

---

## 8. Memory Approval UI (Next.js)

### `MemoryCard.tsx`
```tsx
type MemoryCandidate = {
  id: number;
  tier: "core" | "episodic";
  category?: string;
  key?: string;
  value: string;
  context: string;
  created_at: string;
};

export function MemoryCard({ memory, onApprove, onDeny }: {
  memory: MemoryCandidate;
  onApprove: (id: number) => void;
  onDeny: (id: number, reason: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono">{memory.tier}</span>
        {memory.category && (
          <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono">
            {memory.category} / {memory.key}
          </span>
        )}
        <span className="ml-auto">{new Date(memory.created_at).toLocaleString()}</span>
      </div>
      <p className="text-white font-medium">{memory.value}</p>
      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-300">Context</summary>
        <pre className="mt-2 whitespace-pre-wrap">{memory.context}</pre>
      </details>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApprove(memory.id)}
          className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white py-1.5 text-sm font-medium transition"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onDeny(memory.id, "")}
          className="flex-1 rounded-lg bg-red-900 hover:bg-red-800 text-white py-1.5 text-sm font-medium transition"
        >
          ✗ Deny
        </button>
      </div>
    </div>
  );
}
```

---

## 9. Deployment Checklist

```bash
# 1. Build and start memory services first
docker compose up -d postgres talon-memory-api

# 2. Run DB migrations
docker compose exec talon-memory-api alembic upgrade head

# 3. Seed core matrix from existing identity.md files
docker compose exec talon-memory-api python -m app.seed --dir /nanobot-workspace/memories

# 4. Start remaining services
docker compose up -d talon-memory-ui talon-mcp-bridge

# 5. Verify MCP tools are discoverable
docker compose exec nanobot-gateway nanobot agent -m "List your MCP tools"

# 6. Start NanoBot (or restart if already running)
docker compose up -d nanobot-gateway

# 7. Test end-to-end memory proposal
docker compose exec nanobot-gateway nanobot agent -m "Remember that I prefer TypeScript over Python for new services"
# → Check localhost:3000 for pending approval
```

# NanoBot × Talon — Integration Architecture Plan

> **Stack:** NanoBot v0.1.4+, Ollama Cloud (`gemini-3-flash-preview:cloud`), Docker Compose, Hostinger KVM4 (16 GB RAM / 4 vCPU / 100 GB NVMe)

---

## 1. Goals

| # | Goal |
|---|------|
| 1 | Run NanoBot as the new lightweight agent core (replacing OpenClaw gateway) |
| 2 | Preserve zero service-downtime during migration |
| 3 | Plug SearXNG, ntfy, and bird into NanoBot via MCP |
| 4 | Port and extend the Talon three-tier Memory Engine |
| 5 | Add a self-updating memory pipeline with operator approval UI |

---

## 2. Service Map

```
┌─────────────────────────────────────────────────────────────────┐
│  talon-net (Docker bridge)                                      │
│                                                                 │
│  ┌──────────────────┐   MCP/HTTP   ┌──────────────────────┐    │
│  │  nanobot-gateway │─────────────▶│  talon-mcp-bridge    │    │
│  │  :18790          │              │  :3001               │    │
│  └────────┬─────────┘              │  tools:              │    │
│           │ MCP/HTTP               │   - searxng          │    │
│           │                        │   - ntfy             │    │
│  ┌────────▼─────────┐              │   - bird (×2 tokens) │    │
│  │  talon-memory-api│              └──────────┬───────────┘    │
│  │  :8001 (FastAPI) │                         │                │
│  │  + MCP endpoint  │              ┌──────────▼───────────┐    │
│  └────────┬─────────┘              │  searxng  :8080      │    │
│           │                        │  ntfy     :8088      │    │
│  ┌────────▼─────────┐              └──────────────────────┘    │
│  │  postgres:5432   │                                          │
│  │  pgvector:pg16   │  ┌──────────────────────────────────┐   │
│  └──────────────────┘  │  talon-memory-ui (Next.js) :3000 │   │
│                        │  Memory Approval UI              │   │
│                        └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

SSH tunnel → localhost:18790 (operator access, unchanged)
```

---

## 3. Docker Compose

```yaml
# docker-compose.yml
name: talon

networks:
  talon-net:
    driver: bridge

volumes:
  nanobot-data:
  postgres-data:
  searxng-data:
  ntfy-data:

services:

  # ── NanoBot Gateway ───────────────────────────────────────────────────
  nanobot-gateway:
    image: ghcr.io/hkuds/nanobot:latest
    restart: unless-stopped
    command: gateway -p 18790
    volumes:
      - nanobot-data:/root/.nanobot
    ports:
      - "127.0.0.1:18790:18790"   # SSH tunnel only — never expose publicly
    networks:
      - talon-net
    depends_on:
      postgres:
        condition: service_healthy
      talon-memory-api:
        condition: service_healthy
      talon-mcp-bridge:
        condition: service_started

  # ── Talon Memory API ──────────────────────────────────────────────────
  talon-memory-api:
    build:
      context: ./services/memory-api
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:8001:8000"
    networks:
      - talon-net
    environment:
      DATABASE_URL: postgresql://talon:${POSTGRES_PASSWORD}@postgres:5432/talon_memory
      NTFY_URL: http://ntfy:80
      NTFY_TOPIC: ${NTFY_TOPIC:-talon-memory}
      NANOBOT_WORKSPACE: /nanobot-workspace
    volumes:
      - nanobot-data:/nanobot-workspace
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  # ── Memory Approval UI ────────────────────────────────────────────────
  talon-memory-ui:
    build:
      context: ./services/memory-ui
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - talon-net
    environment:
      MEMORY_API_URL: http://talon-memory-api:8000
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - talon-memory-api

  # ── MCP Bridge ────────────────────────────────────────────────────────
  talon-mcp-bridge:
    build:
      context: ./services/mcp-bridge
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"
    networks:
      - talon-net
    environment:
      PORT: 3001
      SEARXNG_URL: http://searxng:8080
      NTFY_URL: http://ntfy:80
      BIRD_TOKEN_1: ${BIRD_TOKEN_1}
      BIRD_TOKEN_2: ${BIRD_TOKEN_2}

  # ── PostgreSQL + pgvector ──────────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - talon-net
    environment:
      POSTGRES_DB: talon_memory
      POSTGRES_USER: talon
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U talon -d talon_memory"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── SearXNG (existing service — no change to config) ──────────────────
  searxng:
    image: searxng/searxng:latest
    restart: unless-stopped
    volumes:
      - searxng-data:/etc/searxng
    networks:
      - talon-net
    ports:
      - "127.0.0.1:8080:8080"

  # ── ntfy (existing service) ───────────────────────────────────────────
  ntfy:
    image: binwiederhier/ntfy:latest
    restart: unless-stopped
    command: serve --base-url http://localhost:8088
    volumes:
      - ntfy-data:/var/cache/ntfy
    networks:
      - talon-net
    ports:
      - "127.0.0.1:8088:80"
```

---

## 4. NanoBot Config (`~/.nanobot/config.json`)

```json
{
  "providers": {
    "custom": {
      "apiBase": "https://<ollama-cloud-host>/v1",
      "apiKey": "${OLLAMA_CLOUD_API_KEY}"
    }
  },
  "agents": {
    "defaults": {
      "model": "gemini-3-flash-preview:cloud",
      "provider": "custom"
    }
  },
  "tools": {
    "restrictToWorkspace": false,
    "mcpServers": {
      "searxng": {
        "url": "http://talon-mcp-bridge:3001/mcp/searxng",
        "toolTimeout": 30
      },
      "ntfy": {
        "url": "http://talon-mcp-bridge:3001/mcp/ntfy",
        "toolTimeout": 15
      },
      "bird": {
        "url": "http://talon-mcp-bridge:3001/mcp/bird",
        "toolTimeout": 30
      },
      "talon-memory": {
        "url": "http://talon-memory-api:8000/mcp",
        "toolTimeout": 30
      }
    }
  },
  "channels": {
    "discord": {
      "token": "${DISCORD_BOT_TOKEN}",
      "allowFrom": ["${DISCORD_OPERATOR_ID}"]
    },
    "slack": {
      "botToken": "${SLACK_BOT_TOKEN}",
      "appToken": "${SLACK_APP_TOKEN}"
    }
  }
}
```

---

## 5. MCP Bridge — Tool Registry

The MCP bridge (`services/mcp-bridge`) exposes three tool namespaces over HTTP (SSE transport):

### 5a. SearXNG
| Tool | Input | Description |
|------|-------|-------------|
| `searxng_search` | `query`, `categories?`, `engines?`, `num_results?` | Full-text web search via local SearXNG |

### 5b. ntfy
| Tool | Input | Description |
|------|-------|-------------|
| `ntfy_send` | `topic`, `title`, `message`, `priority?`, `tags?` | Push notification to operator device |

### 5c. bird (Twitter/X)
| Tool | Input | Description |
|------|-------|-------------|
| `bird_post` | `text`, `token_slot` (1 or 2) | Post tweet with specified token |
| `bird_search` | `query`, `max_results?` | Search recent tweets |
| `bird_get_timeline` | `token_slot`, `count?` | Fetch home timeline |

Token slot 1 = primary account, slot 2 = secondary account. Tokens loaded from env vars at startup, never exposed in tool responses.

---

## 6. Zero-Downtime Migration Strategy

Since OpenClaw gateway (`openclaw-gateway.service`) runs on port `18790`, NanoBot must claim the same port on cutover.

```
Phase 1 — Run NanoBot on :18791 (test in parallel, 3–5 days)
  systemctl --user stop openclaw-gateway.service
  # Or run both — NanoBot on 18791, verify all channels work

Phase 2 — Hard cutover (< 60s downtime)
  docker compose stop nanobot-gateway
  sed -i 's/18791/18790/' docker-compose.yml
  docker compose up -d nanobot-gateway
  # SSH tunnel still points to :18790 — no client change needed

Phase 3 — Decommission OpenClaw
  systemctl --user disable openclaw-gateway.service
```

---

## 7. Resource Budget

| Service | RAM | CPU |
|---------|-----|-----|
| nanobot-gateway | ~256 MB | 0.5 |
| talon-memory-api | ~128 MB | 0.25 |
| talon-memory-ui | ~128 MB | 0.25 |
| talon-mcp-bridge | ~64 MB | 0.1 |
| postgres+pgvector | ~256 MB | 0.5 |
| searxng (existing) | ~128 MB | 0.25 |
| ntfy (existing) | ~32 MB | 0.05 |
| **Total new** | **~992 MB** | **~1.9** |

Leaves ~13 GB RAM and ~2 vCPU free — well within KVM4 limits.

---

## 8. Environment File (`.env`)

```dotenv
# Ollama Cloud
OLLAMA_CLOUD_API_KEY=

# PostgreSQL
POSTGRES_PASSWORD=

# ntfy
NTFY_TOPIC=talon-memory

# Discord
DISCORD_BOT_TOKEN=
DISCORD_OPERATOR_ID=

# Slack
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=

# bird (Twitter/X)
BIRD_TOKEN_1=
BIRD_TOKEN_2=

# Memory UI auth
NEXTAUTH_SECRET=
```

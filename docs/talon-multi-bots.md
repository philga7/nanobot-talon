## Talon: Multi-Bot, Multi-Env (Containerized)

This fork is intended to support multiple NanoBot instances, each running in containers with its own config, workspace volume, tools, and Mem0 instance. The recommended pattern is:

- **One codebase** (`nanobot-talon`)
- **Multiple instance configs**, one per logical bot / machine
- **One Mem0 stack per instance**, pointed to by the `mem0` section of the config

Configs live outside the repo (for example under `~/.nanobot-*` on the host, mounted into containers), but this repo ships example configs under `examples/talon/`.

At runtime you typically have:

- A **nanobot container** for each instance (gateway/CLI)
- A **Mem0 container** per instance (remote memory backend)
- Shared or per-instance **tool containers**, such as SearXNG and ntfy, which are reached over HTTP from each nanobot container.

### Roles

- **WrenVPS**: primary, always-on personal assistant
  - Runs on a VPS
  - Handles most work, journaling, research, and news
  - Uses Mem0 as the canonical long-term personal memory
  - Hosts SearXNG for web/news search
  - Can send push notifications via ntfy
  - Can read X/Twitter via bird
- **WrenAir**: standby, laptop-local assistant
  - Runs on a MacBook Air
  - Focused on local files and Obsidian vaults
  - Has its own Mem0 instance for local working memory
  - Uses the VPS-hosted SearXNG instance for web/search via HTTP
  - Uses the shared remote ntfy server for notifications
- **WrenPro**: work-only assistant
  - Runs on a work laptop
  - Scoped to work-related tools, files, and Mem0
  - Uses the VPS-hosted SearXNG instance for web/search via HTTP
  - Uses the shared remote ntfy server for notifications
  - Kept separate from personal WrenVPS memory

### Example configs

Example configs live under `examples/talon/`:

- `wren-vps.config.json` — VPS instance (personal + news)
- `wren-air.config.json` — MacBook Air instance (Obsidian + local files)
- `wren-pro.config.json` — work laptop instance (work-only)

Copy each example into its own instance directory and adjust paths/secrets:

```bash
mkdir -p ~/.nanobot-wren-vps
cp examples/talon/wren-vps.config.json ~/.nanobot-wren-vps/config.json

mkdir -p ~/.nanobot-wren-air
cp examples/talon/wren-air.config.json ~/.nanobot-wren-air/config.json

mkdir -p ~/.nanobot-wren-pro
cp examples/talon/wren-pro.config.json ~/.nanobot-wren-pro/config.json
```

Then edit each `config.json`:

- Set API keys under `providers`
- Adjust `agents.defaults.workspace` if desired
- Set `tools.mcpServers.nanobot-file-store.env.OPENCLAW_DATA_ROOT`:
  - VPS / personal: a persistent data directory on the VPS
  - Air: your Obsidian vault root (to treat it as a file-backed KB)
  - Pro: a work-only data directory
- Point `mem0.apiUrl` at the Mem0 container for that instance, and set a `userId` (e.g. `wren-vps`, `wren-air`, `wren-pro`)
- For SearXNG:
  - On WrenVPS, set `"tools.web.search.searxngBaseUrl": "http://localhost:8080/"`
  - On WrenAir / WrenPro, point `searxngBaseUrl` at the VPS URL, e.g. `"http://your-vps-hostname-or-ip:8080/"`

For WrenVPS, you can also wire additional MCP servers commonly used in Talon:

- `ntfy` for push notifications (see `docs/ntfy.md` for details)
- `bird` for read-only X/Twitter access (see `docs/bird.md` for details)

The example `wren-vps.config.json` includes both, with placeholder env values for you to replace.

For WrenAir and WrenPro, the example configs also include an `ntfy` MCP entry pointing at the same remote ntfy server. This lets every instance send notifications through a single VPS-hosted ntfy deployment while still keeping their workspaces and Mem0 instances isolated.

### Running the instances (containerized)

You can still think in terms of one config per instance, but the configs live in volumes that are mounted into containers.

#### VPS: WrenVPS stack

Example (conceptual) `docker compose` snippet:

```yaml
services:
  wren-vps-gateway:
    image: nanobot:latest
    command: ["gateway", "--config", "/root/.nanobot/config.json"]
    volumes:
      - ~/.nanobot-wren-vps:/root/.nanobot
    depends_on:
      - wren-vps-mem0
    environment:
      # Optional: extra env for providers/tools
      - NANOBOT_AGENTS__DEFAULTS__WORKSPACE=/root/.nanobot/workspace

  wren-vps-mem0:
    image: talon-mem0:latest
    # Exposes http://wren-vps-mem0:3002 inside the compose network

  searxng:
    image: searxng/searxng
    # Exposes http://searxng:8080 inside the compose network

  ntfy:
    image: binwiederhier/ntfy
    # Exposes NTFY_URL over HTTPS (e.g. via reverse proxy)
```

In this setup:

- `~/.nanobot-wren-vps/config.json` on the host holds the `wren-vps.config.json` contents.
- The nanobot container sees it as `/root/.nanobot/config.json`.
- `mem0.apiUrl` in that config can point to `http://wren-vps-mem0:3002` (service name inside the compose network).
- `tools.web.search.searxngBaseUrl` can be `http://searxng:8080/`.
- ntfy runs as a separate container and is reached via its public `NTFY_URL`.

#### Satellites: WrenAir and WrenPro stacks

On each laptop, you run a smaller stack: nanobot + Mem0 (and file-store MCP via the nanobot image), plus remote access to the VPS SearXNG and ntfy.

Example (conceptual) `docker compose` snippet for WrenAir:

```yaml
services:
  wren-air-gateway:
    image: nanobot:latest
    command: ["gateway", "--config", "/root/.nanobot/config.json"]
    volumes:
      - ~/.nanobot-wren-air:/root/.nanobot

  wren-air-mem0:
    image: talon-mem0:latest
    # Exposes http://wren-air-mem0:3002 inside this compose network
```

Here:

- `wren-air.config.json` lives at `~/.nanobot-wren-air/config.json` on the host and is mounted into `/root/.nanobot/config.json`.
- `mem0.apiUrl` in that config can point to `http://wren-air-mem0:3002`.
- `tools.web.search.searxngBaseUrl` should point to the **VPS-hosted** SearXNG URL, e.g. `https://searxng.your-domain.com/`.
- The `ntfy` MCP entry should use the same remote `NTFY_URL` as WrenVPS.

WrenPro is analogous, but with its own `~/.nanobot-wren-pro` volume, Mem0 container, and a work-only `OPENCLAW_DATA_ROOT` in the `nanobot-file-store` MCP env.

Each instance:

- Shares the same `nanobot-talon` image
- Has its own mounted config directory and workspace volume
- Talks to its own Mem0 container (per-instance memory)
- Can wire different tools and MCP servers based on its role, while sharing remote HTTP services like SearXNG and ntfy


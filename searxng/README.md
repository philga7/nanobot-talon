# SearXNG (WrenAir) – local

SearXNG run locally via Docker, matching the VPS setup.

- **URL:** http://localhost:8080/
- **Instance name:** WrenAir SearXNG

## Run

```bash
cd searxng
docker compose up -d
```

## Stop

```bash
docker compose down
```

## Config

- `config/settings.yml` – instance name, engines, and server options.
- `server.secret_key` in `settings.yml` is a local-only key; replace if you need a specific value.

## Testing with Wren (NanoBot)

1. **Start SearXNG** (if not already running):
   ```bash
   cd searxng && docker compose up -d
   ```

2. **Point NanoBot at SearXNG** in `~/.nanobot/config.json`:
   - **NanoBot on host** (CLI or gateway run directly):
     ```json
     "tools": { "web": { "search": { "searxngBaseUrl": "http://localhost:8080/" } } }
     ```
   - **NanoBot in Docker** (e.g. `nanobot-gateway`): use the host so the container can reach SearXNG:
     ```json
     "tools": { "web": { "search": { "searxngBaseUrl": "http://host.docker.internal:8080/" } } }
     ```

3. **Trigger a search** so the agent uses `web_search`:
   ```bash
   nanobot agent -m "Search the web for the latest Python release and summarize it in one sentence."
   ```
   Or in chat: *"What’s the weather in Tokyo right now?"* / *"Look up when npm 10 was released."*

   If SearXNG is used, the reply will include real search results (titles, URLs, snippets). You can run with `--logs` to see debug lines like `WebSearch (SearXNG): ...`.

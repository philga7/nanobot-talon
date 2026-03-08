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

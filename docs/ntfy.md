# ntfy Push Notifications

Push notifications use a remote ntfy server (e.g. VPS at https://ntfy.informedcrew.com) via the [ntfy-me-mcp](https://github.com/gitmotion/ntfy-me-mcp) MCP server. NanoBot connects via `tools.mcpServers.ntfy`.

## Overview

- **ntfy server** — Remote (VPS), e.g. https://ntfy.informedcrew.com
- **ntfy-me-mcp** — MCP server that publishes to ntfy; runs as a subprocess (npx) when NanoBot invokes the tool

## Setup

### 1. ntfy server (VPS)

You need an ntfy server with:

- Public URL (e.g. https://ntfy.informedcrew.com)
- Auth enabled: create a user and generate an access token:
  ```bash
  docker exec -it ntfy ntfy user add --role=admin wrenair
  docker exec -it ntfy ntfy token add wrenair
  ```

### 2. Subscribe to a topic

In the ntfy app, subscribe to your topic (e.g. `wrenair-notifications`) on your server.

### 3. Add to NanoBot config

Add to `~/.nanobot/config.json` under `tools.mcpServers`:

```json
"ntfy": {
  "command": "npx",
  "args": ["-y", "ntfy-me-mcp"],
  "env": {
    "NTFY_TOPIC": "wrenair-notifications",
    "NTFY_URL": "https://ntfy.informedcrew.com",
    "NTFY_TOKEN": "tk_your_token_here"
  }
}
```

Use your ntfy URL, topic, and token from step 1.

### 4. Docker

When NanoBot runs in Docker, use `npx` (the image has Node.js). Do not use `docker run` for ntfy-me-mcp; the container does not have Docker available.

## Multiple agents

Use a different topic per agent (e.g. `wren-notifications`, `wren2-notifications`) or a different ntfy user and token per agent.

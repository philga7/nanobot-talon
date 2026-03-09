# bird-x-read-mcp

Read-only X/Twitter MCP server for profiles and tweets via [@steipete/bird](https://www.npmjs.com/package/@steipete/bird).

## Setup (Dockerized WrenAir)

In the Talon/WrenAir Docker deployment, `bird-mcp` is built into the `nanobot-gateway` and `nanobot-cli` images at:

```text
/app/services/bird-mcp/dist/index.js
```

1. Obtain X/Twitter cookie tokens (`auth_token`, `ct0`) from your web session.
2. Add to NanoBot `~/.nanobot/config.json`:

```json
"bird": {
  "command": "node",
  "args": ["/app/services/bird-mcp/dist/index.js"],
  "env": {
    "AUTH_TOKEN": "your_auth_token",
    "CT0": "your_ct0"
  },
  "toolTimeout": 30
}
```

## Build

```bash
# Local dev only; the Docker image builds this automatically
npm install
npm run build
```

## Tools

- `bird_read_tweet` — Read a single tweet by ID or URL
- `bird_read_thread` — Read full thread (root + replies)
- `bird_user_tweets` — Recent tweets from a user profile
- `bird_profile_about` — Account origin/location info

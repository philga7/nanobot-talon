#!/usr/bin/env bash
# Stop the Mem0 + SearXNG + Dockerized NanoBot (WrenAir) stack.
# Run from the project root: ./scripts/stop.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MEM0_DEPLOY="${MEM0_DEPLOY:-$PROJECT_ROOT/mem0-deploy}"
SEARXNG_DIR="${SEARXNG_DIR:-$PROJECT_ROOT/searxng}"

echo "==> Stopping NanoBot + talon-mem0-mcp (including any MCP servers they spawn, such as bird-x-read-mcp and nanobot-file-store-mcp)..."
cd "$PROJECT_ROOT"
docker compose down

echo ""
echo "==> Stopping Mem0 stack..."
if [[ -d "$MEM0_DEPLOY" ]] && [[ -f "$MEM0_DEPLOY/docker-compose.yaml" ]]; then
  cd "$MEM0_DEPLOY"
  docker compose down
  cd "$PROJECT_ROOT"
  echo "    Mem0 stack stopped."
else
  echo "    Mem0 deploy not found at $MEM0_DEPLOY (skipped)."
fi

echo ""
echo "==> Stopping SearXNG..."
if [[ -d "$SEARXNG_DIR" ]] && [[ -f "$SEARXNG_DIR/docker-compose.yml" ]]; then
  cd "$SEARXNG_DIR"
  docker compose down
  cd "$PROJECT_ROOT"
  echo "    SearXNG stopped."
else
  echo "    SearXNG not found at $SEARXNG_DIR (skipped)."
fi

echo ""
echo "==> Stack stopped."

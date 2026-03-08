#!/usr/bin/env bash
# Start the Mem0 + NanoBot stack with health checks.
# Run from the project root: ./scripts/start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MEM0_DEPLOY="${MEM0_DEPLOY:-$PROJECT_ROOT/mem0-deploy}"

echo "==> Starting Mem0 + NanoBot stack"
echo "    Project root: $PROJECT_ROOT"
echo "    Mem0 deploy:  $MEM0_DEPLOY"
echo ""

# 1. Start Mem0 stack
if [[ -d "$MEM0_DEPLOY" ]] && [[ -f "$MEM0_DEPLOY/docker-compose.yaml" ]]; then
  echo "==> Starting Mem0 stack (postgres, neo4j, mem0-api-server)..."
  cd "$MEM0_DEPLOY"
  docker compose up -d
  cd "$PROJECT_ROOT"

  echo "==> Waiting for Mem0 API (http://localhost:8000)..."
  for i in {1..60}; do
    if curl -sf -o /dev/null "http://localhost:8000/docs" 2>/dev/null || curl -sf -o /dev/null "http://localhost:8000/" 2>/dev/null; then
      echo "    Mem0 API is up."
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo "    ERROR: Mem0 API did not become ready within 60 seconds."
      exit 1
    fi
    sleep 2
  done
else
  echo "==> Skipping Mem0 stack (not found at $MEM0_DEPLOY)"
  echo "    Set MEM0_DEPLOY to your mem0-deploy path if needed."
fi

# 2. Start talon-mem0-mcp and nanobot-gateway
echo ""
echo "==> Starting talon-mem0-mcp and nanobot-gateway..."
cd "$PROJECT_ROOT"
docker compose up -d talon-mem0-mcp nanobot-gateway

echo "==> Waiting for talon-mem0-mcp (http://localhost:3002/health)..."
for i in {1..30}; do
  if curl -sf "http://localhost:3002/health" >/dev/null 2>&1; then
    echo "    talon-mem0-mcp is up."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "    WARN: talon-mem0-mcp did not become ready within 60 seconds."
  fi
  sleep 2
done

echo ""
echo "==> Waiting for nanobot-gateway (port 18790)..."
for i in {1..30}; do
  if curl -sf -o /dev/null "http://localhost:18790/" 2>/dev/null || nc -z localhost 18790 2>/dev/null; then
    echo "    nanobot-gateway is up."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "    WARN: nanobot-gateway may not be ready yet."
  fi
  sleep 2
done

echo ""
echo "==> Stack started."
echo "    Mem0 API:        http://localhost:8000"
echo "    talon-mem0-mcp:  http://localhost:3002"
echo "    nanobot-gateway: http://localhost:18790"
echo ""
echo "==> Interact with Wren (Dockerized NanoBot)"
echo "    Single message:  docker compose run --rm nanobot-cli agent -m \"Your question here\""
echo "    Chat mode:       docker compose run -it --rm nanobot-cli agent"
echo ""

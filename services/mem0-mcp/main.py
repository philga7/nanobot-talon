"""talon-mem0-mcp: MCP bridge + recall/capture REST for Mem0.

Exposes:
- POST /recall — recall memories for prompt injection
- POST /capture — capture turn into Mem0
- GET /health — health check
- MCP at /mcp (streamable HTTP) — tools: add_memory, search_memories, get_memories, get_memory, delete_memory
"""

import json
import os
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field

MEM0_API_URL = os.environ.get("MEM0_API_URL", "http://localhost:8000")
DEFAULT_USER_ID = os.environ.get("MEM0_USER_ID", "default")
DEFAULT_TOP_K = int(os.environ.get("MEM0_TOP_K", "5"))

app = FastAPI(title="talon-mem0-mcp", version="0.1.0")


# --- REST models ---

class RecallRequest(BaseModel):
    query: str = Field(..., description="Query to recall memories for")
    user_id: str = Field(default=DEFAULT_USER_ID)
    run_id: str | None = None
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=50)


class RecallResponse(BaseModel):
    memories: str  # Formatted for prompt injection


class CaptureRequest(BaseModel):
    messages: list[dict[str, Any]] = Field(..., description="User/assistant messages")
    user_id: str = Field(default=DEFAULT_USER_ID)
    run_id: str | None = None


# --- REST endpoints ---

@app.post("/recall", response_model=RecallResponse)
async def recall(req: RecallRequest) -> RecallResponse:
    """Recall memories for prompt injection. Proxies to Mem0 search."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload: dict[str, Any] = {"query": req.query, "user_id": req.user_id}
        if req.run_id:
            payload["run_id"] = req.run_id
        resp = await client.post(
            f"{MEM0_API_URL.rstrip('/')}/search",
            json=payload,
        )
        resp.raise_for_status()
    data = resp.json()
    results = data.get("results", [])
    top = results[: req.top_k]
    if not top:
        return RecallResponse(memories="")
    lines = []
    for r in top:
        mem = r.get("memory", "")
        if mem:
            lines.append(f"- {mem}")
    return RecallResponse(memories="\n".join(lines))


@app.post("/capture")
async def capture(req: CaptureRequest) -> dict:
    """Capture turn into Mem0. Proxies to Mem0 POST /memories."""
    messages = []
    for m in req.messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
        elif isinstance(content, list):
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    t = c.get("text", "")
                    if isinstance(t, str) and t.strip():
                        messages.append({"role": role, "content": t})
                        break
    if not messages:
        return {"message": "No messages to capture"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        payload: dict[str, Any] = {"messages": messages, "user_id": req.user_id}
        if req.run_id:
            payload["run_id"] = req.run_id
        resp = await client.post(
            f"{MEM0_API_URL.rstrip('/')}/memories",
            json=payload,
        )
        resp.raise_for_status()
    return resp.json()


@app.get("/health")
async def health() -> dict:
    """Health check."""
    return {"status": "ok", "mem0_url": MEM0_API_URL}


# --- MCP Server (FastMCP, optional) ---

def _mem0_request(method: str, path: str, **kwargs: Any) -> dict:
    """Sync request to Mem0 API for MCP tools."""
    with httpx.Client(timeout=30.0) as client:
        resp = client.request(method, f"{MEM0_API_URL.rstrip('/')}{path}", **kwargs)
        resp.raise_for_status()
        return resp.json() if resp.content else {}


def _mount_mcp() -> None:
    """Mount MCP server at /mcp if mcp.server.fastmcp is available."""
    try:
        from mcp.server.fastmcp import FastMCP

        mcp = FastMCP("talon-mem0-mcp")

        @mcp.tool()
        def add_memory(
            messages: str | list[dict],
            user_id: str = DEFAULT_USER_ID,
            metadata: dict | None = None,
        ) -> str:
            """Add a memory from text or messages."""
            if isinstance(messages, str):
                msgs = [{"role": "user", "content": messages}]
            else:
                msgs = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in messages]
            payload: dict = {"messages": msgs, "user_id": user_id}
            if metadata:
                payload["metadata"] = metadata
            data = _mem0_request("POST", "/memories", json=payload)
            return json.dumps(data, indent=2)

        @mcp.tool()
        def search_memories(
            query: str,
            user_id: str = DEFAULT_USER_ID,
            top_k: int = DEFAULT_TOP_K,
        ) -> str:
            """Search memories by semantic similarity."""
            data = _mem0_request("POST", "/search", json={"query": query, "user_id": user_id})
            results = data.get("results", [])[:top_k]
            return json.dumps([{"memory": r.get("memory"), "score": r.get("score")} for r in results], indent=2)

        @mcp.tool()
        def get_memories(user_id: str = DEFAULT_USER_ID, run_id: str | None = None) -> str:
            """Get all memories for a user or run."""
            params: dict = {"user_id": user_id}
            if run_id:
                params["run_id"] = run_id
            data = _mem0_request("GET", "/memories", params=params)
            return json.dumps(data, indent=2)

        @mcp.tool()
        def get_memory(memory_id: str) -> str:
            """Get a single memory by ID."""
            data = _mem0_request("GET", f"/memories/{memory_id}")
            return json.dumps(data, indent=2)

        @mcp.tool()
        def delete_memory(memory_id: str) -> str:
            """Delete a memory by ID."""
            data = _mem0_request("DELETE", f"/memories/{memory_id}")
            return json.dumps(data, indent=2)

        mcp_app = getattr(mcp, "_app", None) or (getattr(mcp, "get_asgi_app", None) and mcp.get_asgi_app())
        if mcp_app:
            app.mount("/mcp", mcp_app)
    except ImportError:
        pass


_mount_mcp()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)

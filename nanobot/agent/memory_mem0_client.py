"""HTTP client for Mem0 recall/capture via talon-mem0-mcp bridge."""

from __future__ import annotations

import httpx
from loguru import logger


class Mem0Client:
    """Thin async HTTP client for Mem0 recall and capture."""

    def __init__(
        self,
        api_url: str,
        user_id: str = "default",
        top_k: int = 5,
    ):
        self.api_url = api_url.rstrip("/")
        self.user_id = user_id
        self.top_k = top_k

    async def recall(self, query: str, run_id: str | None = None) -> str:
        """Recall memories for the query. Returns formatted string for prompt injection."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload: dict = {"query": query, "user_id": self.user_id, "top_k": self.top_k}
                if run_id:
                    payload["run_id"] = run_id
                resp = await client.post(
                    f"{self.api_url}/recall",
                    json=payload,
                )
                resp.raise_for_status()
            data = resp.json()
            memories = data.get("memories", "")
            return memories if isinstance(memories, str) else ""
        except Exception as e:
            logger.warning("Mem0 recall failed: {}", e)
            return ""

    async def capture(
        self,
        messages: list[dict],
        run_id: str | None = None,
    ) -> None:
        """Capture messages into Mem0. Fire-and-forget; logs errors only."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                payload: dict = {"messages": messages, "user_id": self.user_id}
                if run_id:
                    payload["run_id"] = run_id
                resp = await client.post(
                    f"{self.api_url}/capture",
                    json=payload,
                )
                resp.raise_for_status()
        except Exception as e:
            logger.warning("Mem0 capture failed: {}", e)

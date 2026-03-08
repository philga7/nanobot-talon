"""Tests for Mem0 HTTP client (memory_mem0_client)."""

from unittest.mock import AsyncMock, patch

import pytest

from nanobot.agent.memory_mem0_client import Mem0Client


@pytest.mark.asyncio
async def test_recall_returns_str():
    """recall returns formatted memories string."""
    client = Mem0Client(api_url="http://localhost:3002", user_id="default", top_k=5)
    with patch("httpx.AsyncClient") as mock_client:
        mock_resp = AsyncMock()
        mock_resp.json.return_value = {"memories": "- Prefers Python\n- Works in Tokyo"}
        mock_resp.raise_for_status = AsyncMock()
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await client.recall("Python")
    assert result == "- Prefers Python\n- Works in Tokyo"


@pytest.mark.asyncio
async def test_recall_empty_response():
    """recall returns empty string when no memories."""
    client = Mem0Client(api_url="http://localhost:3002")
    with patch("httpx.AsyncClient") as mock_client:
        mock_resp = AsyncMock()
        mock_resp.json.return_value = {"memories": ""}
        mock_resp.raise_for_status = AsyncMock()
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        result = await client.recall("query")
    assert result == ""


@pytest.mark.asyncio
async def test_recall_passes_run_id():
    """recall includes run_id in payload when provided."""
    client = Mem0Client(api_url="http://localhost:3002")
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = AsyncMock()
        mock_resp = AsyncMock()
        mock_resp.json.return_value = {"memories": ""}
        mock_resp.raise_for_status = AsyncMock()
        mock_post.return_value = mock_resp
        mock_client.return_value.__aenter__.return_value.post = mock_post
        await client.recall("q", run_id="session:123")
    call_kwargs = mock_post.call_args.kwargs
    assert call_kwargs["json"]["run_id"] == "session:123"


@pytest.mark.asyncio
async def test_capture_succeeds():
    """capture posts messages and does not raise."""
    client = Mem0Client(api_url="http://localhost:3002")
    with patch("httpx.AsyncClient") as mock_client:
        mock_resp = AsyncMock()
        mock_resp.json.return_value = {}
        mock_resp.raise_for_status = AsyncMock()
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
        await client.capture(
            [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}],
            run_id="session:1",
        )

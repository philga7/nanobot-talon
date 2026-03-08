"""Tests for Mem0 HTTP client (memory_mem0_client)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from nanobot.agent.memory_mem0_client import Mem0Client


def _mock_async_client(post_return_value):
    """Build a mock AsyncClient whose context manager returns an object with async post()."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = post_return_value
    mock_resp.raise_for_status = MagicMock()  # sync, not awaited
    entered = MagicMock()
    entered.post = AsyncMock(return_value=mock_resp)
    mock_client = MagicMock()
    mock_client.return_value.__aenter__ = AsyncMock(return_value=entered)
    mock_client.return_value.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.mark.asyncio
async def test_recall_returns_str():
    """recall returns formatted memories string."""
    client = Mem0Client(api_url="http://localhost:3002", user_id="default", top_k=5)
    with patch("nanobot.agent.memory_mem0_client.httpx.AsyncClient", _mock_async_client({"memories": "- Prefers Python\n- Works in Tokyo"})):
        result = await client.recall("Python")
    assert result == "- Prefers Python\n- Works in Tokyo"


@pytest.mark.asyncio
async def test_recall_empty_response():
    """recall returns empty string when no memories."""
    client = Mem0Client(api_url="http://localhost:3002")
    with patch("nanobot.agent.memory_mem0_client.httpx.AsyncClient", _mock_async_client({"memories": ""})):
        result = await client.recall("query")
    assert result == ""


@pytest.mark.asyncio
async def test_recall_passes_run_id():
    """recall includes run_id in payload when provided."""
    client = Mem0Client(api_url="http://localhost:3002")
    mock_client = _mock_async_client({"memories": ""})
    with patch("nanobot.agent.memory_mem0_client.httpx.AsyncClient", mock_client):
        await client.recall("q", run_id="session:123")
    post = mock_client.return_value.__aenter__.return_value.post
    call_kwargs = post.call_args.kwargs
    assert call_kwargs["json"]["run_id"] == "session:123"


@pytest.mark.asyncio
async def test_capture_succeeds():
    """capture posts messages and does not raise."""
    client = Mem0Client(api_url="http://localhost:3002")
    with patch("nanobot.agent.memory_mem0_client.httpx.AsyncClient", _mock_async_client({})):
        await client.capture(
            [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}],
            run_id="session:1",
        )

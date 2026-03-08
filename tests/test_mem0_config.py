"""Tests for Mem0 config wiring."""

from nanobot.config.schema import Config, Mem0Config


def test_mem0_config_defaults():
    """Mem0Config has correct defaults."""
    cfg = Mem0Config()
    assert cfg.enabled is False
    assert cfg.api_url == "http://localhost:3002"
    assert cfg.user_id == "default"
    assert cfg.auto_recall is True
    assert cfg.auto_capture is True
    assert cfg.top_k == 5


def test_config_includes_mem0():
    """Config includes mem0 config."""
    cfg = Config()
    assert hasattr(cfg, "mem0")
    assert isinstance(cfg.mem0, Mem0Config)
    assert cfg.mem0.enabled is False

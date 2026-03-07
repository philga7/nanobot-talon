"""Tests for config migrations related to Talon mode."""

from nanobot.config.loader import _migrate_config
from nanobot.config.schema import Config


def test_migrate_top_level_talon_mode_into_agent_defaults() -> None:
    """Legacy top-level talonMode should move under agents.defaults."""
    migrated = _migrate_config({"talonMode": True})

    assert "talonMode" not in migrated
    assert migrated["agents"]["defaults"]["talonMode"] is True
    assert Config.model_validate(migrated).agents.defaults.talon_mode is True


def test_migrate_legacy_memory_mode_to_talon_mode() -> None:
    """Older memoryMode values should become the boolean talonMode switch."""
    migrated = _migrate_config({"agents": {"defaults": {"memoryMode": "talon"}}})

    assert migrated["agents"]["defaults"]["talonMode"] is True
    assert Config.model_validate(migrated).agents.defaults.talon_mode is True


def test_explicit_talon_mode_wins_over_legacy_fields() -> None:
    """Do not override an explicit talonMode value with legacy aliases."""
    migrated = _migrate_config({
        "talonMode": False,
        "agents": {"defaults": {"talonMode": True, "memoryMode": "native"}},
    })

    assert migrated["agents"]["defaults"]["talonMode"] is True
    assert "memoryMode" not in migrated["agents"]["defaults"]
    assert Config.model_validate(migrated).agents.defaults.talon_mode is True

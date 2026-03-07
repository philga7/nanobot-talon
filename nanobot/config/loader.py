"""Configuration loading utilities."""

import json
from pathlib import Path

from nanobot.config.schema import Config


def get_config_path() -> Path:
    """Get the default configuration file path."""
    return Path.home() / ".nanobot" / "config.json"


def get_data_dir() -> Path:
    """Get the nanobot data directory."""
    from nanobot.utils.helpers import get_data_path
    return get_data_path()


def load_config(config_path: Path | None = None) -> Config:
    """
    Load configuration from file or create default.

    Args:
        config_path: Optional path to config file. Uses default if not provided.

    Returns:
        Loaded configuration object.
    """
    path = config_path or get_config_path()

    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            data = _migrate_config(data)
            return Config.model_validate(data)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Warning: Failed to load config from {path}: {e}")
            print("Using default configuration.")

    return Config()


def save_config(config: Config, config_path: Path | None = None) -> None:
    """
    Save configuration to file.

    Args:
        config: Configuration to save.
        config_path: Optional path to save to. Uses default if not provided.
    """
    path = config_path or get_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    data = config.model_dump(by_alias=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _migrate_config(data: dict) -> dict:
    """Migrate old config formats to current."""
    # Move tools.exec.restrictToWorkspace → tools.restrictToWorkspace
    tools = data.get("tools", {})
    exec_cfg = tools.get("exec", {})
    if "restrictToWorkspace" in exec_cfg and "restrictToWorkspace" not in tools:
        tools["restrictToWorkspace"] = exec_cfg.pop("restrictToWorkspace")

    agents = data.setdefault("agents", {})
    defaults = agents.setdefault("defaults", {})
    legacy_top_level_talon = None
    if "talonMode" in data:
        legacy_top_level_talon = bool(data.pop("talonMode"))
    elif "talon_mode" in data:
        legacy_top_level_talon = bool(data.pop("talon_mode"))

    explicit_talon_mode = "talonMode" in defaults or "talon_mode" in defaults
    if legacy_top_level_talon is not None and not explicit_talon_mode:
        defaults["talonMode"] = legacy_top_level_talon

    explicit_talon_mode = "talonMode" in defaults or "talon_mode" in defaults
    legacy_memory_mode = defaults.pop("memoryMode", defaults.pop("memory_mode", None))
    if legacy_memory_mode is not None and not explicit_talon_mode:
        if isinstance(legacy_memory_mode, str):
            defaults["talonMode"] = legacy_memory_mode.strip().lower() == "talon"
        else:
            defaults["talonMode"] = bool(legacy_memory_mode)
    return data

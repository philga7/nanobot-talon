from nanobot.utils.helpers import sync_workspace_templates


def test_memory_template_is_talon_compatible(tmp_path) -> None:
    """Fresh workspace templates should describe both native and Talon ownership."""
    workspace = tmp_path / "workspace"

    added = sync_workspace_templates(workspace, silent=True)
    memory_template = (workspace / "memory" / "MEMORY.md").read_text(encoding="utf-8")
    agents_template = (workspace / "AGENTS.md").read_text(encoding="utf-8")

    assert "memory/MEMORY.md" in added
    assert "Native NanoBot mode" in memory_template
    assert "generated compatibility artifact" in memory_template
    assert "read-only" in memory_template
    assert "generated read-only compatibility file" in agents_template

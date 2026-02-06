"""Helpers for loading Vite manifest assets in Flask templates."""

from __future__ import annotations

import json
from pathlib import Path


def _collect_chunk_files(
    manifest: dict,
    key: str,
    *,
    js_files: list[str],
    css_files: list[str],
    visited: set[str],
) -> None:
    if key in visited:
        return

    visited.add(key)
    chunk = manifest.get(key)
    if not isinstance(chunk, dict):
        return

    file_name = chunk.get("file")
    if file_name and file_name not in js_files:
        js_files.append(file_name)

    for css_file in chunk.get("css", []) or []:
        if css_file not in css_files:
            css_files.append(css_file)

    for import_key in chunk.get("imports", []) or []:
        _collect_chunk_files(
            manifest,
            import_key,
            js_files=js_files,
            css_files=css_files,
            visited=visited,
        )


def load_workspace_assets(static_root: str) -> dict[str, list[str]] | None:
    """Return built workspace asset files from the Vite manifest when available."""

    manifest_path = Path(static_root) / "assets" / "vue" / ".vite" / "manifest.json"
    if not manifest_path.exists():
        return None

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        return None

    entry_key = "src/main.js"
    if entry_key not in manifest:
        for key, value in manifest.items():
            if isinstance(value, dict) and value.get("isEntry"):
                entry_key = key
                break
        else:
            return None

    js_files: list[str] = []
    css_files: list[str] = []
    _collect_chunk_files(
        manifest,
        entry_key,
        js_files=js_files,
        css_files=css_files,
        visited=set(),
    )

    return {
        "js": js_files,
        "css": css_files,
    }

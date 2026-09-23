#!/usr/bin/env python3
"""Fix remaining path strings after src/js regroup: vi.mock, readFileSync, modulePath, path assertions."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "src" / "js"

DEST: dict[str, str] = {
    "storage.js": "core",
    "api-storage.js": "core",
    "sqlite-storage.js": "core",
    "utils.js": "core",
    "theme-config.js": "core",
    "theme-service.js": "core",
    "version-info.js": "core",
    "backup-utils.js": "shared",
    "download-history.js": "shared",
    "folder-color.js": "shared",
    "image-utils.js": "shared",
    "image-download-utils.js": "shared",
    "prompt-tool-json-import.js": "shared",
    "tag-utils.js": "shared",
    "tutorial.js": "shared",
    "ripple.js": "shared",
    "plant-core.js": "plant",
    "plant-persist.js": "plant",
    "plant-tracker.js": "plant",
    "plant-view.js": "plant",
    "goal-utils.js": "goal",
    "goal-mindmap-core.js": "goal",
    "goal-image-preview.js": "goal",
    "tetris-core.js": "games",
    "plane-war-core.js": "games",
    "release-notes.js": "release",
    "release-notes-data.js": "release",
    "auto-updater.js": "release",
    "update-progress-modal.js": "release",
    "lan-sync.js": "sync",
    "favorite-feedback.js": "mobile",
}


def dest_for(name: str) -> str:
    if name == "main.js":
        return ""
    if name.endswith(".test.js"):
        base = name[: -len(".test.js")] + ".js"
        try:
            return dest_for(base)
        except SystemExit:
            pass
    if name.startswith("pc-"):
        return "pc"
    if name.startswith("mobile-"):
        return "mobile"
    if name in DEST:
        return DEST[name]
    # unknown tests: keep with similar family
    if "mobile" in name:
        return "mobile"
    if "pc-" in name or name.startswith("pc"):
        return "pc"
    if "goal" in name:
        return "goal"
    if "plant" in name:
        return "plant"
    if "image-download" in name:
        return "shared"
    if "router" in name:
        return "pc"
    if "micro" in name:
        return "pc"
    raise SystemExit(f"no destination mapping for {name}")


def new_path_for(name: str) -> Path:
    folder = dest_for(name)
    return (JS / folder / name) if folder else (JS / name)


def rel_from(file: Path, target: Path) -> str:
    rel = Path(os.path.relpath(str(target), str(file.parent))).as_posix()
    return rel if rel.startswith(".") else "./" + rel


def main() -> None:
    moves: dict[str, Path] = {}
    for p in JS.rglob("*.js"):
        if "node_modules" in p.parts:
            continue
        moves[p.name] = p.resolve()

    mock_re = re.compile(r"""vi\.mock\(\s*(['"])(\.[^'"]+)\1""")

    for path in sorted(JS.rglob("*.js")):
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        orig = text

        def repl_mock(m: re.Match[str]) -> str:
            q, imp = m.group(1), m.group(2)
            name = Path(imp).name
            if name not in moves and name.endswith(".js"):
                return m.group(0)
            target = moves.get(name)
            if target is None:
                return m.group(0)
            return f"vi.mock({q}{rel_from(path, target)}{q}"

        text = mock_re.sub(repl_mock, text)

        # process.cwd() + 'src/js/xxx.js' path literals
        def repl_cwd(m: re.Match[str]) -> str:
            name = Path(m.group(2)).name
            if name in moves:
                folder = dest_for(name)
                rel = f"src/js/{folder}/{name}" if folder else f"src/js/{name}"
                return f"'{rel}'"
            return m.group(0)

        text = re.sub(r"""(['"])src/js/([^'"]+\.js)\1""", repl_cwd, text)

        # modulePath: './xxx.js' string values
        def repl_mp(m: re.Match[str]) -> str:
            q, imp = m.group(1), m.group(2)
            name = Path(imp).name
            if name in moves:
                return f"modulePath: {q}{rel_from(path, moves[name])}{q}"
            return m.group(0)

        text = re.sub(r"""modulePath:\s*(['"])(\.[^'"]+)\1""", repl_mp, text)

        # source-text assertions like from './pc-card-parallax.js'
        def repl_assert(m: re.Match[str]) -> str:
            q, imp = m.group(1), m.group(2)
            name = Path(imp).name
            if name in moves:
                # relative path as written from a sibling in same original folder →
                # express as './name' if same folder after move, else full relative from that consumer
                # These assertions check consumer source files; consumer is usually same family.
                consumer_hint = "pc-card-parallax.js"  # same folder ./ is fine for pc/*
                if dest_for(name) == dest_for(consumer_hint) or dest_for(name) == "pc":
                    return f"from {q}./{name}{q}"
            return m.group(0)

        text = re.sub(r"""from (['"])(\./[^'"]+\.js)\1""", repl_assert, text)

        if text != orig:
            path.write_text(text, encoding="utf-8")
            print(f"fixed {path.relative_to(JS)}")


if __name__ == "__main__":
    main()

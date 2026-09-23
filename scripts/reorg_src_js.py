#!/usr/bin/env python3
"""Regroup src/js into feature folders and rewrite relative imports.

Originally every module lived flat under src/js/, so './x.js' meant src/js/x.js.
After grouping, remap those module targets and re-relativize css/asset paths.
"""
from __future__ import annotations

import os
import re
import shutil
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


# tests without a same-basename source
TEST_DEST_EXTRA: dict[str, str] = {
    "global-micro-interactions.test.js": "pc",
    "router-history.test.js": "pc",
    "image-download-mobile.test.js": "shared",
    "mobile-app-action-sheet.test.js": "mobile",
    "mobile-regression.test.js": "mobile",
    "pc-app-nav-motion.test.js": "pc",
    "pc-goal-project-card-parallax.test.js": "pc",
    "pc-home-pixel-animation.test.js": "pc",
    "pc-utils-modal.test.js": "pc",
    "goal-utils-cover.test.js": "goal",
}


def dest_for(name: str) -> str:
    if name == "main.js":
        return ""
    if name.endswith(".test.js"):
        if name in TEST_DEST_EXTRA:
            return TEST_DEST_EXTRA[name]
        base = name[: -len(".test.js")] + ".js"
        return dest_for(base)
    if name.startswith("pc-"):
        return "pc"
    if name.startswith("mobile-"):
        return "mobile"
    if name in DEST:
        return DEST[name]
    raise SystemExit(f"no destination mapping for {name}")


IMPORT_RE = re.compile(
    r"""(?P<prefix>(?:from|import)\s*\(\s*|from\s+|import\s+)(?P<q>['"])(?P<path>\.{1,2}/[^'"]+)(?P=q)"""
)


def main() -> None:
    files = sorted(p for p in JS.glob("*.js"))
    moves: dict[str, Path] = {}
    for src in files:
        folder = dest_for(src.name)
        dest = (JS / folder / src.name) if folder else (JS / src.name)
        moves[src.name] = dest.resolve()

    for name, dest in moves.items():
        src = JS / name
        if not src.exists():
            continue
        if src.resolve() == dest:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))

    js_files = sorted(p for p in JS.rglob("*.js") if "node_modules" not in p.parts)

    for path in js_files:
        text = path.read_text(encoding="utf-8")

        def repl(m: re.Match[str]) -> str:
            imp = m.group("path")
            # Original modules were flat under JS/. Resolve import against that base.
            old_target = Path(os.path.normpath(str(JS / imp)))
            name = old_target.name
            if name in moves and old_target.suffix == ".js":
                real_target = moves[name]
            else:
                # css / assets / react / UI设计稿 stay put on disk
                real_target = old_target
            new_rel = Path(os.path.relpath(str(real_target), str(path.parent))).as_posix()
            if not new_rel.startswith("."):
                new_rel = "./" + new_rel
            return f"{m.group('prefix')}{m.group('q')}{new_rel}{m.group('q')}"

        new_text = IMPORT_RE.sub(repl, text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")

    print(f"processed modules under {JS}")
    for folder in ["", "core", "shared", "pc", "mobile", "plant", "goal", "games", "release", "sync"]:
        base = JS / folder if folder else JS
        if not base.exists():
            continue
        top = [p for p in base.glob("*.js")]
        print(f"  {folder or '.'}: {len(top)} files")


if __name__ == "__main__":
    main()

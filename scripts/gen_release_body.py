#!/usr/bin/env python3
"""从 release-notes-data.js 生成 GitHub Release 完整分节正文。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / "src" / "js" / "release" / "release-notes-data.js"
ORDER = ["新增", "优化", "修复", "发布"]


def parse_sections(version: str) -> list[tuple[str, list[str]]]:
    text = NOTES.read_text(encoding="utf-8")
    block_m = re.search(
        rf"\{{\s*version:\s*'{re.escape(version)}'.*?(?=\{{\s*version:\s*'|\]\s*;\s*$)",
        text,
        re.S,
    )
    if not block_m:
        return []
    block = block_m.group(0)
    by_title: dict[str, list[str]] = {}
    for sec in re.finditer(
        r"\{\s*title:\s*'([^']+)'.*?items:\s*\[(.*?)\]\s*,?\s*\}",
        block,
        re.S,
    ):
        title = sec.group(1)
        items = [
            m.group(1).replace("\\'", "'").strip()
            for m in re.finditer(r"'((?:\\'|[^'])*)'", sec.group(2))
        ]
        items = [re.sub(r"\s+", " ", i) for i in items if i.strip()]
        if items:
            by_title[title] = items
    return [(t, by_title[t]) for t in ORDER if t in by_title]


def build_notes(version: str, table: str) -> str:
    parts = [
        f"## PromptImageManager v{version}",
        "",
        "### Downloads",
        "",
        "| Asset | Size | SHA256 |",
        "| --- | ---: | --- |",
        table.rstrip(),
        "",
    ]
    for title, items in parse_sections(version):
        parts.append(f"### {title}")
        parts.append("")
        for item in items:
            parts.append(f"- {item}")
        parts.append("")
    parts.append("> Full changelog: `docs/版本记录/changelog.md` in this repository.")
    parts.append("")
    return "\n".join(parts)


TABLES = {
    "2.5.6": (
        "| `PromptImageManager-Setup-2.5.6.exe` | 34.0 MB | "
        "`D704D7B0B55549E9517E02E09C1479DF2AA7BAC5AFC3E16F0D8CA2ACA4A6C52C` |\n"
        "| `latest.json` | 0.0 MB | "
        "`32BC2A9C81791979FF978285574966E858333B28005F42F3A7C4EB06CEEEE03F` |"
    ),
    "2.5.5": (
        "| `PromptImageManager-Setup-2.5.5.exe` | 34 MB | "
        "`397661259F52C79872EF7338186748F2A783778B138C0A117FEFAE1EDE4E522D` |\n"
        "| `latest.json` | 0 MB | "
        "`0684339B261871E6C1C04AB4B9D157B132640CF53B895FACA39BE61094DA6B11` |"
    ),
}


def main() -> None:
    out_dir = ROOT / "releases"
    out_dir.mkdir(exist_ok=True)
    for ver, table in TABLES.items():
        body = build_notes(ver, table)
        path = out_dir / f"release-body-v{ver}.md"
        path.write_text(body, encoding="utf-8")
        print(f"===== {path} =====")
        print(body)


if __name__ == "__main__":
    main()

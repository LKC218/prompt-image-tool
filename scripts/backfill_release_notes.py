#!/usr/bin/env python3
"""回填 GitHub Release 正文为完整分节（修正误写入的 PS 对象序列化）。"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / "src" / "js" / "release" / "release-notes-data.js"
ORDER = ["新增", "优化", "修复", "发布"]
REPO = "LKC218/prompt-image-tool"

TABLES = {
    "2.5.7": (
        "| `PromptImageManager-Setup-2.5.7.exe` | 37.6 MB | "
        "`7C134B46C026D9047A2B240BCA54D5E3903E84D51F383E25B6AC7E9A2FA53AB9` |\n"
        "| `latest.json` | 0.0 MB | "
        "`E0C4F1C905E0A63C7037C5CB9F3CE5EB73047706A693F372FBB47932F7ECC9B9` |"
    ),
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


def sections(version: str) -> list[tuple[str, list[str]]]:
    text = NOTES.read_text(encoding="utf-8")
    m = re.search(
        rf"\{{\s*version:\s*'{re.escape(version)}'.*?(?=\{{\s*version:\s*'|\]\s*;\s*$)",
        text,
        re.S,
    )
    if not m:
        return []
    by: dict[str, list[str]] = {}
    for sec in re.finditer(
        r"\{\s*title:\s*'([^']+)'.*?items:\s*\[(.*?)\]\s*,?\s*\}",
        m.group(0),
        re.S,
    ):
        items = [
            re.sub(r"\s+", " ", x.group(1).replace("\\'", "'")).strip()
            for x in re.finditer(r"'((?:\\'|[^'])*)'", sec.group(2))
        ]
        items = [i for i in items if i]
        if items:
            by[sec.group(1)] = items
    return [(t, by[t]) for t in ORDER if t in by]


def build(version: str) -> str:
    parts = [
        f"## PromptImageManager v{version}",
        "",
        "### Downloads",
        "",
        "| Asset | Size | SHA256 |",
        "| --- | ---: | --- |",
        TABLES[version],
        "",
    ]
    for title, items in sections(version):
        parts += [f"### {title}", ""] + [f"- {i}" for i in items] + [""]
    parts += [
        "> Full changelog: `docs/版本记录/changelog.md` in this repository.",
        "",
    ]
    return "\n".join(parts)


def get_token() -> str:
    p = subprocess.run(
        ["git", "credential", "fill"],
        input=b"protocol=https\nhost=github.com\n\n",
        capture_output=True,
    )
    for line in p.stdout.decode().splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("NO_TOKEN")


def api(method: str, url: str, token: str, payload: dict | None = None):
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "prompt-image-tool-backfill",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8")), r.status


def main() -> None:
    token = get_token()
    versions = sys.argv[1:] or ["2.5.7"]
    for ver in versions:
        body = build(ver)
        rel, _ = api(
            "GET",
            f"https://api.github.com/repos/{REPO}/releases/tags/v{ver}",
            token,
        )
        _, status = api(
            "PATCH",
            f"https://api.github.com/repos/{REPO}/releases/{rel['id']}",
            token,
            {"body": body},
        )
        print(f"UPDATED v{ver} status={status}")
        print(body)
        print("=" * 40)


if __name__ == "__main__":
    main()

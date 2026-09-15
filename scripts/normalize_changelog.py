#!/usr/bin/env python3
"""按版本块规范化 changelog.md 章节词表与顺序。"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "版本记录" / "changelog.md"

USER_SECTIONS = ["新增", "优化", "修复", "发布"]
ENG_SECTIONS = ["版本与打包", "验证"]
SECTION_ORDER = USER_SECTIONS + ENG_SECTIONS

RENAME = {
    "新增功能": "新增",
    "基础功能": "新增",
    "改进": "优化",
    "Bug 修复": "修复",
    "版本号统一": "版本与打包",
    "构建产物": "版本与打包",
    "工程改进": "验证",
    "技术细节": "验证",
    "技术栈升级": "验证",
    "已知情况": "验证",
    "已知风险": "验证",
    "本轮补充": "优化",
}

# 日期补充标题 → 并入 修复（原内容多为冲突/同步修复）
DATE_SUPPLEMENT = re.compile(r"^20\d{2}-\d{2}-\d{2}.*补充$")


def parse_sections(block: str) -> tuple[str, list[tuple[str, str]]]:
    """返回 (引言区, [(section_title, body), ...])。"""
    lines = block.splitlines(keepends=True)
    intro: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    current: tuple[str, list[str]] | None = None

    for line in lines:
        m = re.match(r"^###\s+(.+?)\s*$", line)
        if m:
            if current:
                sections.append((current[0], "".join(current[1])))
            title = m.group(1).strip()
            base = re.sub(r"（.*?）$", "", title).strip()
            if base in RENAME:
                title = RENAME[base]
            elif DATE_SUPPLEMENT.match(title):
                title = "修复"
            current = (title, [])
        elif current is not None:
            current[1].append(line)
        else:
            intro.append(line)

    if current:
        sections.append((current[0], "".join(current[1])))
    return "".join(intro), sections


def merge_sections(sections: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """同名合并，未知标题保留并排在工程附录。"""
    order_index = {name: i for i, name in enumerate(SECTION_ORDER)}
    buckets: dict[str, list[str]] = {}
    unknown: list[tuple[str, str]] = []

    for title, body in sections:
        if title in order_index:
            buckets.setdefault(title, []).append(body.strip("\n"))
        else:
            unknown.append((title, body))

    merged: list[tuple[str, str]] = []
    for name in SECTION_ORDER:
        if name not in buckets:
            continue
        bodies = [b for b in buckets[name] if b.strip()]
        if not bodies:
            continue
        merged.append((name, "\n\n".join(bodies).rstrip() + "\n"))

    # 未知标题附在末尾
    for title, body in unknown:
        body = body.strip("\n")
        if body.strip():
            merged.append((title, body + "\n"))
    return merged


def ensure_release(version: str, sections: list[tuple[str, str]]) -> list[tuple[str, str]]:
    titles = {t for t, _ in sections}
    if "发布" in titles:
        return sections
    if "版本与打包" not in titles:
        return sections
    body = f"- 版本号统一升级至 `{version}`；详见下方「版本与打包」。\n"
    # 插在 版本与打包 之前
    out: list[tuple[str, str]] = []
    inserted = False
    for t, b in sections:
        if t == "版本与打包" and not inserted:
            out.append(("发布", body))
            inserted = True
        out.append((t, b))
    return out


def ensure_release_for_feature_only(version: str, sections: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """纯功能版本（无版本与打包）也可补发布，若已有用户可见变更。"""
    titles = {t for t, _ in sections}
    if "发布" in titles or "版本与打包" in titles:
        return sections
    has_user = any(t in USER_SECTIONS[:3] for t in titles)
    if not has_user:
        return sections
    # 不强制：历史功能版本可能未单独发包
    return sections


def render_block(version: str, intro: str, sections: list[tuple[str, str]]) -> str:
    parts = [intro.rstrip() + "\n"] if intro.strip() else []
    for title, body in sections:
        parts.append(f"### {title}\n\n{body.rstrip()}\n")
    return "\n".join(parts)


def extract_version(block: str) -> str:
    m = re.match(r"##\s+v([0-9.]+)", block.lstrip())
    return m.group(1) if m else ""


def strip_mid_header(text: str) -> str:
    return re.sub(
        r"\n# 生图提示词管理器 — 更新记录\n\n> 本文档记录项目各版本的变更历史，方便后续维护和追溯。\n\n---\n",
        "\n",
        text,
    )


def main() -> None:
    raw = SRC.read_text(encoding="utf-8")
    raw = strip_mid_header(raw)

    header = (
        "# 提示词管家 — 更新记录\n\n"
        "> 本文档是版本变更的**唯一权威源**。"
        "用户可见章节仅使用「新增 / 优化 / 修复 / 发布」；"
        "工程细节写在「版本与打包 / 验证」。\n"
        "> 维护规范见 [版本发布与更新记录维护指南](../版本发布与更新记录维护指南.md)。\n\n"
        "---\n\n"
    )

    m = re.search(r"(?m)^##\s+v", raw)
    if not m:
        print("no version blocks", file=sys.stderr)
        sys.exit(1)

    # 版本块之间用 --- 分隔（原文多数如此；v2.3.6 等可能没有）
    rest = raw[m.start() :]
    # 按 ^## v 切分，保留分隔符风格
    chunks = re.split(r"(?m)(?=^##\s+v)", rest)
    out_blocks: list[str] = []
    for chunk in chunks:
        if not chunk.strip():
            continue
        ver = extract_version(chunk)
        # 去掉块内尾部的 ---（统一重加）
        chunk_body = re.sub(r"\n---\s*$", "\n", chunk.rstrip() + "\n")
        intro, sections = parse_sections(chunk_body)
        # intro 应包含 "## vX.Y.Z ..." 标题行
        sections = merge_sections(sections)
        sections = ensure_release(ver, sections)
        sections = ensure_release_for_feature_only(ver, sections)
        # 再排一次序（发布插入后）
        sections = merge_sections(sections)
        body = render_block(ver, intro, sections)
        out_blocks.append(body.rstrip() + "\n")

    text = header + "\n---\n\n".join(out_blocks)
    if not text.endswith("\n"):
        text += "\n"
    text = re.sub(r"\n{3,}", "\n\n", text)
    SRC.write_text(text, encoding="utf-8")
    print(f"ok: {len(out_blocks)} versions -> {SRC}")


if __name__ == "__main__":
    main()

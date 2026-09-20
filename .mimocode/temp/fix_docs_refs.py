# -*- coding: utf-8 -*-
"""Scan active docs for old taxonomy paths and fix common patterns."""
from __future__ import annotations

import re
from pathlib import Path

DOCS = Path(r"G:\项目\prompt-image-tool-main\docs")
REPO = Path(r"G:\项目\prompt-image-tool-main")

# Old top-level names that should not appear in active (non-archive) docs
OLD_DIRS = [
    "设计文档",
    "UI计划",
    "计划文档",
    "工程文档",
    "工程目录整理",
    "项目开发经验",
    "已修复问题",
    "对话历史",
    "compose/spec",
    "测试记录",  # careful: now under 质量与复盘
]

# Path rewrite map for absolute-ish docs/ references
REWRITES = [
    (r"docs/apps-code-map\.md", "docs/导航/apps-code-map.md"),
    (r"docs/项目代码百科\.md", "docs/导航/项目代码百科.md"),
    (r"docs/版本发布与更新记录维护指南\.md", "docs/工程指南/版本发布与更新记录维护指南.md"),
    (r"docs/工程文档/", "docs/工程指南/"),
    (r"docs/设计文档/", "docs/设计系统/"),  # default; specific files handled below
    (r"docs/UI计划/", "docs/页面与UI/"),
    (r"docs/计划文档/_历史归档/", "docs/_归档/计划/"),
    (r"docs/计划文档/", "docs/计划与规格/"),
    (r"docs/compose/spec/", "docs/计划与规格/compose-spec/"),
    (r"docs/测试记录/", "docs/质量与复盘/测试记录/"),
    (r"docs/已修复问题/", "docs/质量与复盘/已修复问题/"),
    (r"docs/项目开发经验/", "docs/质量与复盘/经验沉淀/"),
    (r"docs/对话历史/", "docs/_归档/对话历史/"),
    (r"docs/工程目录整理/", "docs/_归档/工程目录整理/"),
]

# Specific design-doc file rewrites
DESIGN_FILE_REWRITES = [
    ("docs/设计文档/ui-ux-design-doc.md", "docs/设计系统/ui-ux-design-doc.md"),
    ("docs/设计文档/跨端配色与主题令牌规范.md", "docs/设计系统/跨端配色与主题令牌规范.md"),
    ("docs/设计文档/新拟态按钮设计规范.md", "docs/设计系统/新拟态按钮设计规范.md"),
    ("docs/设计文档/PC左侧导航栏轻拟态设计.md", "docs/设计系统/PC左侧导航栏轻拟态设计.md"),
    ("docs/设计文档/PC侧边栏模拟时钟.md", "docs/页面与UI/PC/PC侧边栏模拟时钟.md"),
    ("docs/设计文档/Tauri-安装器壳-UI-设计规则-260510.md", "docs/页面与UI/PC/Tauri-安装器壳-UI-设计规则-260510.md"),
    ("docs/设计文档/侧边栏折叠按钮复刻-Uiverse-red-crab-76.md", "docs/页面与UI/复刻稿/侧边栏折叠按钮复刻-Uiverse-red-crab-76.md"),
    ("docs/设计文档/新建提示词按钮复刻-Uiverse-popular-cat-31.md", "docs/页面与UI/复刻稿/新建提示词按钮复刻-Uiverse-popular-cat-31.md"),
    ("docs/设计文档/飞机大战-美术素材-生图提示词.md", "docs/素材与提示词/飞机大战-美术素材-生图提示词.md"),
    ("docs/设计文档/首页挂机植物-30天轮回对照与生图提示词.md", "docs/素材与提示词/首页挂机植物-30天轮回对照与生图提示词.md"),
    ("docs/设计文档/首页挂机植物-生图提示词.md", "docs/素材与提示词/首页挂机植物-生图提示词.md"),
    ("docs/设计文档/首页挂机植物-养护交互动画生图提示词.md", "docs/素材与提示词/首页挂机植物-养护交互动画生图提示词.md"),
    ("docs/设计文档/首页挂机植物-园艺光标生图提示词.md", "docs/素材与提示词/首页挂机植物-园艺光标生图提示词.md"),
    ("docs/设计文档/首页挂机植物-会话交接摘要.md", "docs/_归档/设计过程/首页挂机植物-会话交接摘要.md"),
    ("docs/设计文档/README.md", "docs/设计系统/README.md"),
]

SKIP_PARTS = {".git", "node_modules", "_归档", ".mimocode", "temp"}


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_PARTS:
        return True
    # skip archive
    try:
        rel = path.relative_to(DOCS)
        if rel.parts and rel.parts[0] == "_归档":
            return True
    except ValueError:
        pass
    return False


def apply_rewrites(text: str) -> str:
    # specific design files first
    for old, new in DESIGN_FILE_REWRITES:
        text = text.replace(old, new)
    for old, new in REWRITES:
        text = re.sub(old, new, text)
    return text


def main() -> None:
    hits: list[tuple[Path, str]] = []
    fixed_files = 0
    for path in DOCS.rglob("*.md"):
        if should_skip(path):
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        new = apply_rewrites(raw)
        if new != raw:
            path.write_text(new, encoding="utf-8")
            fixed_files += 1
            hits.append((path, "UPDATED"))
        # scan remaining old names
        remaining = []
        for name in [
            "docs/设计文档", "docs/UI计划", "docs/计划文档", "docs/工程文档",
            "docs/工程目录整理", "docs/项目开发经验", "docs/已修复问题",
            "docs/对话历史", "docs/compose/spec", "docs/apps-code-map.md",
        ]:
            if name in new:
                remaining.append(name)
        if remaining:
            hits.append((path, "REMAIN: " + ", ".join(remaining)))

    # Also fix root README and scripts comments if needed (already done for README)
    for extra in [REPO / "README.md"]:
        if extra.exists():
            raw = extra.read_text(encoding="utf-8", errors="replace")
            new = apply_rewrites(raw)
            if new != raw:
                extra.write_text(new, encoding="utf-8")
                fixed_files += 1
                hits.append((extra, "UPDATED"))

    print(f"fixed_files={fixed_files}")
    for p, note in hits:
        try:
            rel = p.relative_to(REPO)
        except ValueError:
            rel = p
        print(f"{note}\t{rel}")

    print("\n=== STABLE PATH CHECK ===")
    for k in [
        "版本记录/changelog.md",
        "版本记录/更新记录规范.md",
        "技术文档/api-reference.md",
        "技术文档/pc-technical-doc.md",
        "技术文档/mobile-technical-doc.md",
        "技术文档/lan-sync-design-doc.md",
        "构建方案/README.md",
        "assets/readme/logo.png",
        "导航/apps-code-map.md",
        "工程指南/版本发布与更新记录维护指南.md",
        "README.md",
    ]:
        ok = (DOCS / k).exists()
        print(("OK  " if ok else "MISS") + " docs/" + k)

    print("\n=== TOP TREE ===")
    for c in sorted(DOCS.iterdir(), key=lambda x: x.name):
        if c.is_dir():
            n = sum(1 for x in c.rglob("*") if x.is_file())
            print(f"DIR {c.name}/ ({n})")
        else:
            print(f"FILE {c.name}")


if __name__ == "__main__":
    main()

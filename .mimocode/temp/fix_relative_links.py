# -*- coding: utf-8 -*-
from pathlib import Path

REPO = Path(r"G:\项目\prompt-image-tool-main")
DOCS = REPO / "docs"

# Relative-link fixes for files that moved
FIXES = {
    DOCS / "工程指南" / "版本发布与更新记录维护指南.md": [
        ("(版本记录/changelog.md)", "(../版本记录/changelog.md)"),
        ("(版本记录/README.md)", "(../版本记录/README.md)"),
        ("(版本记录/更新记录规范.md)", "(../版本记录/更新记录规范.md)"),
        ("(模块说明/应用内自动更新模块.md)", "(../模块说明/应用内自动更新模块.md)"),
        ("(模块说明/版本号模块.md)", "(../模块说明/版本号模块.md)"),
        ("(构建方案/PC端构建流程.md)", "(../构建方案/PC端构建流程.md)"),
        ("(apps-code-map.md)", "(../导航/apps-code-map.md)"),
        ("(../src/js/release-notes-data.js)", "(../../src/js/release-notes-data.js)"),
        ("[`docs/模块说明/应用内自动更新模块.md`](../模块说明/应用内自动更新模块.md)",
         "[`docs/模块说明/应用内自动更新模块.md`](../模块说明/应用内自动更新模块.md)"),
        ("[`docs/模块说明/应用内自动更新模块.md`](模块说明/应用内自动更新模块.md)",
         "[`docs/模块说明/应用内自动更新模块.md`](../模块说明/应用内自动更新模块.md)"),
        # already-fixed double-apply guard
        ("(../版本记录/../版本记录/", "(../版本记录/"),
        ("(../模块说明/../模块说明/", "(../模块说明/"),
        ("(../构建方案/../构建方案/", "(../构建方案/"),
        ("(../导航/../导航/", "(../导航/"),
        ("(../../src/../src/", "(../../src/"),
    ],
    DOCS / "工程指南" / "工程交接文档.md": [
        ("(../设计文档/ui-ux-design-doc.md)", "(../设计系统/ui-ux-design-doc.md)"),
        ("(../计划文档/optimization-plan.md)",
         "(../_归档/计划/09-项目治理/optimization-plan.md)"),
        ("`docs/设计文档/`", "`docs/设计系统/`"),
        ("`docs/UI计划/`", "`docs/页面与UI/`"),
        ("`docs/计划文档/`", "`docs/计划与规格/`"),
        ("`docs/工程文档/`", "`docs/工程指南/`"),
        ("`docs/apps-code-map.md`", "`docs/导航/apps-code-map.md`"),
        ("`docs/测试记录/`", "`docs/质量与复盘/测试记录/`"),
        ("`docs/项目开发经验/`", "`docs/质量与复盘/经验沉淀/`"),
        ("`docs/已修复问题/`", "`docs/质量与复盘/已修复问题/`"),
        ("`docs/对话历史/`", "`docs/_归档/对话历史/`"),
        ("`docs/版本发布与更新记录维护指南.md`",
         "`docs/工程指南/版本发布与更新记录维护指南.md`"),
    ],
    DOCS / "模块说明" / "版本号模块.md": [
        ("(../版本发布与更新记录维护指南.md)",
         "(../工程指南/版本发布与更新记录维护指南.md)"),
        ("(../版本记录/../版本记录/", "(../版本记录/"),
        ("(../工程指南/../工程指南/", "(../工程指南/"),
        ("(../工程指南/工程指南/", "(../工程指南/"),
    ],
    DOCS / "模块说明" / "应用内自动更新模块.md": [
        ("(../版本发布与更新记录维护指南.md)",
         "(../工程指南/版本发布与更新记录维护指南.md)"),
        ("(../计划文档/", "(../计划与规格/"),
        ("(../compose/spec/", "(../计划与规格/compose-spec/"),
        ("docs/计划文档/", "docs/计划与规格/"),
        ("docs/compose/spec/", "docs/计划与规格/compose-spec/"),
        ("docs/设计文档/", "docs/素材与提示词/"),
        ("(../设计文档/首页挂机植物-30天轮回对照与生图提示词.md)",
         "(../素材与提示词/首页挂机植物-30天轮回对照与生图提示词.md)"),
    ],
    DOCS / "模块说明" / "首页挂机种植物模块.md": [
        ("docs/设计文档/", "docs/素材与提示词/"),
        ("(../设计文档/首页挂机植物-30天轮回对照与生图提示词.md)",
         "(../素材与提示词/首页挂机植物-30天轮回对照与生图提示词.md)"),
        ("(../设计文档/首页挂机植物-生图提示词.md)",
         "(../素材与提示词/首页挂机植物-生图提示词.md)"),
        ("(../compose/spec/plant-idle-game.md)",
         "(../计划与规格/compose-spec/plant-idle-game.md)"),
        ("docs/compose/spec/", "docs/计划与规格/compose-spec/"),
        ("docs/计划文档/", "docs/计划与规格/"),
    ],
    DOCS / "素材与提示词" / "首页挂机植物-养护交互动画生图提示词.md": [
        ("(../设计文档/首页挂机植物-30天轮回对照与生图提示词.md)",
         "(./首页挂机植物-30天轮回对照与生图提示词.md)"),
        ("docs/设计文档/首页挂机植物-30天轮回对照与生图提示词.md",
         "docs/素材与提示词/首页挂机植物-30天轮回对照与生图提示词.md"),
    ],
}

# skill + release-publish
skill = REPO / ".mimocode" / "skills" / "release-publish" / "SKILL.md"
if skill.exists():
    raw = skill.read_text(encoding="utf-8")
    new = raw.replace(
        "../../docs/版本记录/更新记录规范.md",
        "../../docs/版本记录/更新记录规范.md",  # path still valid
    )
    # no change needed if 版本记录 kept

for path, pairs in FIXES.items():
    if not path.exists():
        print(f"MISS {path}")
        continue
    raw = path.read_text(encoding="utf-8")
    new = raw
    for a, b in pairs:
        new = new.replace(a, b)
    if new != raw:
        path.write_text(new, encoding="utf-8")
        print(f"UPDATED {path.relative_to(REPO)}")
    else:
        print(f"NOCHANGE {path.relative_to(REPO)}")

# Final validation scan
print("\n=== REMAINING OLD PATHS IN ACTIVE DOCS ===")
old_markers = [
    "docs/设计文档", "docs/UI计划", "docs/计划文档", "docs/工程文档",
    "docs/工程目录整理", "docs/项目开发经验", "docs/已修复问题",
    "docs/对话历史", "docs/compose/spec", "docs/apps-code-map.md",
    "docs/版本发布与更新记录维护指南.md",
]
for path in DOCS.rglob("*.md"):
    rel = path.relative_to(DOCS)
    if rel.parts and rel.parts[0] == "_归档":
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    found = [m for m in old_markers if m in text]
    if found:
        # allow historical mentions in the migration plan itself
        print(f"{rel}: {found}")

print("\n=== SCRIPT STABLE PATHS ===")
for p in [
    "docs/版本记录/changelog.md",
    "docs/版本记录/更新记录规范.md",
    "docs/assets/readme/logo.png",
    "docs/技术文档/api-reference.md",
    "docs/构建方案/README.md",
]:
    print(("OK  " if (REPO / p).exists() else "MISS"), p)

print("\n=== GIT STATUS (docs summary) ===")
import subprocess
r = subprocess.run(
    ["git", "status", "--short", "--", "docs", "README.md"],
    cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace"
)
print(r.stdout[:4000])

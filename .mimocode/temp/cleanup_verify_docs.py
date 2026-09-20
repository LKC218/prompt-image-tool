# -*- coding: utf-8 -*-
from pathlib import Path

docs = Path(r"G:\项目\prompt-image-tool-main\docs")

changed = True
while changed:
    changed = False
    for p in sorted(docs.rglob("*"), key=lambda x: len(x.parts), reverse=True):
        if p.is_dir():
            try:
                next(p.iterdir())
            except StopIteration:
                p.rmdir()
                print(f"RMDIR {p.relative_to(docs)}")
                changed = True
            except Exception as e:
                print(f"ERR {p}: {e}")

print("\n=== TOP ===")
for c in sorted(docs.iterdir(), key=lambda x: x.name):
    if c.is_dir():
        n = sum(1 for x in c.rglob("*") if x.is_file())
        print(f"DIR {c.name}/ ({n} files)")
    else:
        print(f"FILE {c.name}")

print("\n=== KEY PATHS ===")
keys = [
    "导航/apps-code-map.md",
    "导航/项目代码百科.md",
    "工程指南/工程交接文档.md",
    "工程指南/工程目录说明.md",
    "工程指南/版本发布与更新记录维护指南.md",
    "技术文档/api-reference.md",
    "构建方案/README.md",
    "版本记录/changelog.md",
    "版本记录/更新记录规范.md",
    "assets/readme/logo.png",
    "计划与规格/计划文档-分类索引.md",
    "质量与复盘/经验沉淀/项目开发经验.md",
    "素材与提示词/首页挂机植物-30天轮回对照与生图提示词.md",
    "设计系统/ui-ux-design-doc.md",
    "页面与UI/PC/01-首页仪表盘.md",
    "模块说明/首页挂机种植物模块.md",
]
for k in keys:
    p = docs / k
    print(("OK  " if p.exists() else "MISS") + " " + k)

print("\n=== 计划与规格 ===")
ps = docs / "计划与规格"
if ps.exists():
    for c in sorted(ps.iterdir(), key=lambda x: x.name):
        if c.is_dir():
            n = sum(1 for x in c.glob("*.md"))
            print(f"  {c.name}/ ({n})")
        else:
            print(f"  {c.name}")

print("\n=== _归档 files (first 40) ===")
arch = docs / "_归档"
if arch.exists():
    files = [c for c in arch.rglob("*") if c.is_file()]
    print(f"total={len(files)}")
    for c in files[:40]:
        print(f"  {c.relative_to(docs)}")

# -*- coding: utf-8 -*-
"""One-shot docs taxonomy migration. Run from repo root."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(r"G:\项目\prompt-image-tool-main")
DOCS = REPO / "docs"

MOVES: list[tuple[str, str]] = [
    # 导航
    ("apps-code-map.md", "导航/apps-code-map.md"),
    ("项目代码百科.md", "导航/项目代码百科.md"),
    # 工程指南
    ("工程文档/工程交接文档.md", "工程指南/工程交接文档.md"),
    ("工程文档/工程转移与依赖安装指南.md", "工程指南/工程转移与依赖安装指南.md"),
    ("工程文档/工程目录说明.md", "工程指南/工程目录说明.md"),
    ("工程文档/README.md", "工程指南/README.md"),
    ("版本发布与更新记录维护指南.md", "工程指南/版本发布与更新记录维护指南.md"),
    # 计划与规格 (rename 计划文档 tree)
    ("计划文档/计划文档-分类索引.md", "计划与规格/计划文档-分类索引.md"),
    # compose spec
    ("compose/spec/branch-consolidation-optimize-v2.6.md", "计划与规格/compose-spec/branch-consolidation-optimize-v2.6.md"),
    ("compose/spec/github-crt-profile-card.md", "计划与规格/compose-spec/github-crt-profile-card.md"),
    ("compose/spec/goal-cover-optimize.md", "计划与规格/compose-spec/goal-cover-optimize.md"),
    ("compose/spec/pc-games-hub-plane.md", "计划与规格/compose-spec/pc-games-hub-plane.md"),
    ("compose/spec/pc-image-viewer-flip.md", "计划与规格/compose-spec/pc-image-viewer-flip.md"),
    ("compose/spec/pc-tetris-minigame.md", "计划与规格/compose-spec/pc-tetris-minigame.md"),
    ("compose/spec/plant-idle-game.md", "计划与规格/compose-spec/plant-idle-game.md"),
    ("compose/spec/update-auto-restart.md", "计划与规格/compose-spec/update-auto-restart.md"),
    ("compose/spec/update-progress-modal.md", "计划与规格/compose-spec/update-progress-modal.md"),
    # 质量与复盘 — 测试记录
    ("测试记录/PC端全功能回归测试记录-260515.md", "质量与复盘/测试记录/PC端全功能回归测试记录-260515.md"),
    ("测试记录/Tauri安装器壳-全页面功能完善测试记录-260511.md", "质量与复盘/测试记录/Tauri安装器壳-全页面功能完善测试记录-260511.md"),
    ("测试记录/Tauri安装器壳-路径窗口完成退出测试记录-260512.md", "质量与复盘/测试记录/Tauri安装器壳-路径窗口完成退出测试记录-260512.md"),
    ("测试记录/Tauri安装器壳-路径选择崩溃修复测试记录-260512.md", "质量与复盘/测试记录/Tauri安装器壳-路径选择崩溃修复测试记录-260512.md"),
    ("测试记录/局域网同步冲突优化测试记录-260521.md", "质量与复盘/测试记录/局域网同步冲突优化测试记录-260521.md"),
    ("测试记录/局域网同步测试记录-260510.md", "质量与复盘/测试记录/局域网同步测试记录-260510.md"),
    ("测试记录/挂机植物-发布验收清单.md", "质量与复盘/测试记录/挂机植物-发布验收清单.md"),
    ("测试记录/移动端全功能回归测试记录-260515.md", "质量与复盘/测试记录/移动端全功能回归测试记录-260515.md"),
    ("测试记录/逐页面验证与缺陷闭环测试记录-260801.md", "质量与复盘/测试记录/逐页面验证与缺陷闭环测试记录-260801.md"),
    # 质量与复盘 — 已修复问题
    ("已修复问题/v2.3.0-PC端安装后无UI.md", "质量与复盘/已修复问题/v2.3.0-PC端安装后无UI.md"),
    # 质量与复盘 — 经验沉淀
    ("项目开发经验/项目开发经验.md", "质量与复盘/经验沉淀/项目开发经验.md"),
    ("项目开发经验/外部图标本地化接入规范.md", "质量与复盘/经验沉淀/外部图标本地化接入规范.md"),
    ("项目开发经验/安装包中文编码与快捷方式图标规范.md", "质量与复盘/经验沉淀/安装包中文编码与快捷方式图标规范.md"),
    # _归档
    ("工程目录整理/notes.md", "_归档/工程目录整理/notes.md"),
    ("工程目录整理/task_plan.md", "_归档/工程目录整理/task_plan.md"),
    ("工程目录整理/工程目录整理方案-260509.md", "_归档/工程目录整理/工程目录整理方案-260509.md"),
    ("工程目录整理/文档分类整理计划-260510.md", "_归档/工程目录整理/文档分类整理计划-260510.md"),
    ("对话历史/构建安卓移动端安装包.md", "_归档/对话历史/构建安卓移动端安装包.md"),
]

# Active plan categories to move from 计划文档/ -> 计划与规格/
PLAN_CATEGORIES = [
    "01-Bug修复与异常排查",
    "02-视觉与交互优化",
    "03-UI页面重构",
    "04-新功能实装与增强",
    "05-动画与动效",
    "06-构建打包与发布",
    "07-测试验证",
    "08-局域网同步",
    "09-项目治理",
    "10-脚本工具",
]

# Archive candidates under active plan categories (relative to 计划文档/)
ARCHIVE_PLANS = [
    "02-视觉与交互优化/v2.5.1-移动端详情页优化计划.md",
    "02-视觉与交互优化/v2.6.0-移动端UI插画图片替换计划.md",
    "02-视觉与交互优化/PC首页搜索栏新拟态复刻计划-260709.md",
    "02-视觉与交互优化/PC首页搜索栏移除描边提示计划-260709.md",
    "02-视觉与交互优化/PC首页全模块新拟态改造实施计划-260711.md",
    "02-视觉与交互优化/PC端浮动操作菜单与点跳动效实施计划-260715.md",
    "03-UI页面重构/v3.0.0-PC端UI完全重构计划.md",
    "05-动画与动效/交互动效全面优化计划-260707.md",
    "09-项目治理/项目优化诊断报告-260707.md",
    "09-项目治理/项目优化计划-260707.md",
]


def git_mv(src: Path, dst: Path) -> str:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return f"SKIP exists {dst.relative_to(DOCS)}"
    if not src.exists():
        return f"SKIP missing {src.relative_to(DOCS)}"
    # prefer git mv for tracked files
    try:
        r = subprocess.run(
            ["git", "mv", "--", str(src), str(dst)],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=False,
        )
        if r.returncode == 0:
            return f"GIT-MV {src.relative_to(DOCS)} -> {dst.relative_to(DOCS)}"
    except Exception:
        pass
    shutil.move(str(src), str(dst))
    return f"FS-MV {src.relative_to(DOCS)} -> {dst.relative_to(DOCS)}"


def walk_move_tree(src_dir: Path, dst_dir: Path) -> list[str]:
    logs: list[str] = []
    if not src_dir.exists():
        return [f"SKIP missing dir {src_dir}"]
    for path in sorted(src_dir.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(src_dir)
        dst = dst_dir / rel
        logs.append(git_mv(path, dst))
    return logs


def main() -> int:
    logs: list[str] = []

    for s, d in MOVES:
        logs.append(git_mv(DOCS / s, DOCS / d))

    # Move plan category dirs
    for cat in PLAN_CATEGORIES:
        src_cat = DOCS / "计划文档" / cat
        dst_cat = DOCS / "计划与规格" / cat
        if src_cat.exists():
            dst_cat.mkdir(parents=True, exist_ok=True)
            for f in sorted(src_cat.glob("*.md")):
                logs.append(git_mv(f, dst_cat / f.name))

    # Archive selected completed plans
    for rel in ARCHIVE_PLANS:
        src = DOCS / "计划文档" / rel
        if not src.exists():
            src = DOCS / "计划与规格" / rel
        dst = DOCS / "_归档" / "计划" / rel
        logs.append(git_mv(src, dst))

    # Move entire 历史归档 tree
    hist_src = DOCS / "计划文档" / "_历史归档"
    if not hist_src.exists():
        hist_src = DOCS / "计划与规格" / "_历史归档"
    if hist_src.exists():
        logs.extend(walk_move_tree(hist_src, DOCS / "_归档" / "计划"))

    # Design system leftovers already partially moved — handle any remaining files
    design_src = DOCS / "设计文档"
    if design_src.exists():
        for f in sorted(design_src.rglob("*")):
            if not f.is_file():
                continue
            name = f.name
            if "生图提示词" in name or "美术素材" in name:
                logs.append(git_mv(f, DOCS / "素材与提示词" / name))
            elif "会话交接" in name or "摘要" in name:
                logs.append(git_mv(f, DOCS / "_归档" / "设计过程" / name))
            elif "复刻" in name or "Uiverse" in name:
                logs.append(git_mv(f, DOCS / "页面与UI" / "复刻稿" / name))
            elif "Tauri" in name or "时钟" in name:
                logs.append(git_mv(f, DOCS / "页面与UI" / "PC" / name))
            else:
                logs.append(git_mv(f, DOCS / "设计系统" / name))

    # UI计划 leftovers
    ui_src = DOCS / "UI计划"
    if ui_src.exists():
        mapping = {
            "PC端": DOCS / "页面与UI" / "PC",
            "PC端UI设计": DOCS / "页面与UI" / "复刻稿" / "PC",
            "移动端UI设计": DOCS / "页面与UI" / "移动端",
        }
        for sub_name, dst in mapping.items():
            sub = ui_src / sub_name
            if sub.exists():
                for f in sorted(sub.rglob("*.md")):
                    logs.append(git_mv(f, dst / f.name))
        for f in sorted(ui_src.glob("*.md")):
            logs.append(git_mv(f, DOCS / "页面与UI" / f.name))

    print("\n".join(logs))

    # Report leftovers in old dirs
    old_dirs = [
        "设计文档", "UI计划", "计划文档", "工程文档", "工程目录整理",
        "对话历史", "测试记录", "已修复问题", "项目开发经验", "compose",
    ]
    print("\n=== LEFTOVERS ===")
    for name in old_dirs:
        p = DOCS / name
        if not p.exists():
            print(f"REMOVED {name}")
            continue
        files = [str(x.relative_to(DOCS)) for x in p.rglob("*") if x.is_file()]
        print(f"REMAIN {name}: {len(files)}")
        for f in files[:20]:
            print(f"  - {f}")

    print("\n=== NEW TREE TOP ===")
    for child in sorted(DOCS.iterdir(), key=lambda x: x.name):
        kind = "DIR " if child.is_dir() else "FILE"
        print(f"{kind} {child.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

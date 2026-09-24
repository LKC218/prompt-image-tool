from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = "2.5.19"
NEW = "2.5.20"


def replace_exact(path: Path, old: str, new: str, required: bool = True) -> int:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if required and count == 0:
        raise SystemExit(f"[失败] {path} 未找到 {old}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print(f"[OK] {path.relative_to(ROOT)}: {count} 处")
    return count


def main() -> None:
    # package.json / lock
    pkg_path = ROOT / "package.json"
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    pkg["version"] = NEW
    pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("[OK] package.json version")

    lock_path = ROOT / "package-lock.json"
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    lock["version"] = NEW
    if "" in lock.get("packages", {}):
        lock["packages"][""]["version"] = NEW
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("[OK] package-lock.json version")

    replace_exact(ROOT / "src/index.html", f'content="{OLD}"', f'content="{NEW}"')
    replace_exact(ROOT / "src/js/core/version-info.js", f"'{OLD}'", f"'{NEW}'")
    replace_exact(ROOT / "src-tauri/tauri.conf.json", f'"version": "{OLD}"', f'"version": "{NEW}"')
    replace_exact(ROOT / "src-tauri/Cargo.toml", f'version = "{OLD}"', f'version = "{NEW}"')
    replace_exact(ROOT / "src-tauri/Cargo.lock", f'version = "{OLD}"', f'version = "{NEW}"')

    gradle = ROOT / "android/app/build.gradle"
    gtext = gradle.read_text(encoding="utf-8")
    gtext = gtext.replace("versionCode 31", "versionCode 32")
    gtext = gtext.replace(f'versionName "{OLD}"', f'versionName "{NEW}"')
    gradle.write_text(gtext, encoding="utf-8")
    print("[OK] android/app/build.gradle versionCode 32 / versionName")

    replace_exact(ROOT / "build/installer.nsi", f'APPVERSION "{OLD}"', f'APPVERSION "{NEW}"')
    replace_exact(ROOT / "build.bat", OLD, NEW)

    replace_exact(ROOT / "installer-shell/package.json", f'"version": "{OLD}"', f'"version": "{NEW}"')
    replace_exact(
        ROOT / "installer-shell/src-tauri/tauri.conf.json",
        f'"version": "{OLD}"',
        f'"version": "{NEW}"',
    )
    replace_exact(
        ROOT / "installer-shell/src-tauri/Cargo.toml",
        f'version = "{OLD}"',
        f'version = "{NEW}"',
    )
    replace_exact(
        ROOT / "installer-shell/src-tauri/Cargo.lock",
        f'version = "{OLD}"',
        f'version = "{NEW}"',
    )

    # docs that track current version
    replace_exact(
        ROOT / "docs/模块说明/版本号模块.md",
        f"`{OLD}`",
        f"`{NEW}`",
    )
    replace_exact(
        ROOT / "docs/构建方案/PC端构建流程.md",
        OLD,
        NEW,
    )

    print("[完成] 版本同步为", NEW)


if __name__ == "__main__":
    main()

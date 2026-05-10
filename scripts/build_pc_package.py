from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT_DIR / "build"
DIST_DIR = ROOT_DIR / "dist"
PYINSTALLER_APP_DIR = BUILD_DIR / "dist" / "PromptImageManager"
RELEASES_DIR = ROOT_DIR / "releases"


def resolve_command(command: str) -> str:
    found = shutil.which(command)
    if found:
        return found

    if sys.platform == "win32" and not command.lower().endswith(".cmd"):
        found = shutil.which(f"{command}.cmd")
        if found:
            return found

    return command


def run_command(command: list[str], cwd: Path = ROOT_DIR) -> None:
    resolved = [resolve_command(command[0]), *command[1:]]
    print(f"\n[执行] {' '.join(command)}")
    result = subprocess.run(resolved, cwd=cwd)
    if result.returncode != 0:
        raise SystemExit(f"[失败] 命令退出码：{result.returncode}")


def require_file(path: Path, message: str) -> None:
    if not path.exists():
        raise SystemExit(f"[失败] {message}：{path}")


def get_package_version() -> str:
    package_path = ROOT_DIR / "package.json"
    with package_path.open("r", encoding="utf-8") as file:
        package_data = json.load(file)
    version = package_data.get("version")
    if not version:
        raise SystemExit("[失败] package.json 缺少 version 字段")
    return str(version)


def check_environment(skip_nsis: bool) -> None:
    checks = [
        ["node", "--version"],
        ["npm", "--version"],
        ["python", "--version"],
        ["python", "-m", "PyInstaller", "--version"],
        ["python", "-c", "import webview; print('pywebview ok')"],
        ["python", "-c", "import pythonnet; print('pythonnet ok')"],
    ]
    if not skip_nsis:
        checks.append(["makensis", "/VERSION"])

    for command in checks:
        run_command(command)


def build_frontend() -> None:
    run_command(["npm", "run", "build"])
    require_file(DIST_DIR / "index.html", "前端构建产物缺失")


def build_pyinstaller() -> None:
    run_command(
        [
            "python",
            "-m",
            "PyInstaller",
            "build\\app.spec",
            "--workpath",
            "build\\build",
            "--distpath",
            "build\\dist",
            "--clean",
            "-y",
        ]
    )
    require_file(PYINSTALLER_APP_DIR / "PromptImageManager.exe", "PyInstaller 主程序缺失")
    require_file(
        PYINSTALLER_APP_DIR / "_internal" / "frontend" / "index.html",
        "PyInstaller 内置前端资源缺失",
    )


def build_nsis(version: str) -> Path:
    run_command(["makensis", "/INPUTCHARSET", "UTF8", "installer.nsi"], cwd=BUILD_DIR)
    setup_path = BUILD_DIR / f"PromptImageManager-Setup-{version}.exe"
    require_file(setup_path, "NSIS 安装包缺失")
    return setup_path


def copy_to_releases(setup_path: Path) -> Path:
    RELEASES_DIR.mkdir(exist_ok=True)
    release_path = RELEASES_DIR / setup_path.name
    shutil.copy2(setup_path, release_path)
    require_file(release_path, "发布目录安装包缺失")
    return release_path


def print_summary(setup_path: Path | None, release_path: Path | None) -> None:
    print("\n[完成] PC 独立安装包构建流程结束")
    print(f"- 可执行目录：{PYINSTALLER_APP_DIR}")
    print(f"- 主程序：{PYINSTALLER_APP_DIR / 'PromptImageManager.exe'}")
    if setup_path:
        print(f"- 安装包：{setup_path} ({setup_path.stat().st_size} 字节)")
    if release_path:
        print(f"- 发布副本：{release_path} ({release_path.stat().st_size} 字节)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建 PC 独立安装包")
    parser.add_argument(
        "--skip-nsis",
        action="store_true",
        help="只生成 PyInstaller 可执行目录，不生成 NSIS 安装包",
    )
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="跳过环境检查，直接执行构建",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    version = get_package_version()
    print(f"[开始] PromptImageManager v{version} PC 独立安装包构建")

    if not args.skip_env_check:
        check_environment(args.skip_nsis)

    build_frontend()
    build_pyinstaller()

    setup_path = None
    release_path = None
    if not args.skip_nsis:
        setup_path = build_nsis(version)
        release_path = copy_to_releases(setup_path)

    print_summary(setup_path, release_path)


if __name__ == "__main__":
    main()

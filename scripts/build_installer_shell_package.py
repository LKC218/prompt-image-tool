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
INSTALLER_SHELL_DIR = ROOT_DIR / "installer-shell"
INSTALLER_SHELL_SRC_DIR = INSTALLER_SHELL_DIR / "src"
INSTALLER_SHELL_TAURI_DIR = INSTALLER_SHELL_DIR / "src-tauri"
BUILD_DIR = ROOT_DIR / "build"
RELEASES_DIR = ROOT_DIR / "releases"
SHELL_BUILD_DIR = BUILD_DIR / "installer-shell"
TAURI_RELEASE_EXE = (
    INSTALLER_SHELL_TAURI_DIR
    / "target"
    / "release"
    / "prompt_image_manager_installer_shell.exe"
)


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
    if not path.exists() or path.stat().st_size <= 0:
        raise SystemExit(f"[失败] {message}：{path}")


def get_package_version() -> str:
    package_path = ROOT_DIR / "package.json"
    with package_path.open("r", encoding="utf-8") as file:
        package_data = json.load(file)

    version = package_data.get("version")
    if not version:
        raise SystemExit("[失败] package.json 缺少 version 字段")

    return str(version)


def build_pc_installer(skip_env_check: bool) -> None:
    command = ["python", "scripts\\build_pc_package.py"]
    if skip_env_check:
        command.append("--skip-env-check")
    run_command(command)


def run_static_checks() -> None:
    page_files = sorted((INSTALLER_SHELL_SRC_DIR / "pages").glob("*.js"))
    js_files = [INSTALLER_SHELL_SRC_DIR / "main.js", *page_files]

    for path in js_files:
        run_command(["node", "--check", str(path.relative_to(ROOT_DIR)).replace("\\", "/")])

    run_command(["cargo", "check", "--manifest-path", "installer-shell/src-tauri/Cargo.toml"])


def build_tauri_shell() -> None:
    run_command(
        [
            "npm.cmd",
            "--prefix",
            "installer-shell",
            "run",
            "tauri",
            "--",
            "build",
            "--features",
            "embedded-installer",
            "--no-bundle",
        ]
    )
    require_file(TAURI_RELEASE_EXE, "Tauri 安装器壳 release 可执行文件缺失")


def copy_shell_package(version: str) -> tuple[Path, Path]:
    package_name = f"PromptImageManager-Shell-Setup-{version}.exe"
    shell_build_path = SHELL_BUILD_DIR / package_name
    release_path = RELEASES_DIR / package_name

    SHELL_BUILD_DIR.mkdir(parents=True, exist_ok=True)
    RELEASES_DIR.mkdir(parents=True, exist_ok=True)

    shutil.copy2(TAURI_RELEASE_EXE, shell_build_path)
    shutil.copy2(TAURI_RELEASE_EXE, release_path)

    require_file(shell_build_path, "安装器壳构建产物缺失")
    require_file(release_path, "安装器壳发布产物缺失")

    return shell_build_path, release_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建 Tauri 安装器壳发布产物")
    parser.add_argument(
        "--skip-pc-build",
        action="store_true",
        help="复用现有 build/PromptImageManager-Setup-{version}.exe，不重新构建 PC 安装核心",
    )
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="传递给 PC 安装核心构建脚本，跳过环境检查",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    version = get_package_version()
    core_installer = BUILD_DIR / f"PromptImageManager-Setup-{version}.exe"

    print(f"[开始] PromptImageManager v{version} Tauri 安装器壳构建")

    if not args.skip_pc_build:
        build_pc_installer(args.skip_env_check)

    require_file(core_installer, "NSIS 安装核心缺失，无法嵌入安装器壳")
    run_static_checks()
    build_tauri_shell()
    shell_build_path, release_path = copy_shell_package(version)

    print("\n[完成] Tauri 安装器壳构建流程结束")
    print(f"- 嵌入安装核心：{core_installer} ({core_installer.stat().st_size} 字节)")
    print(f"- 构建产物：{shell_build_path} ({shell_build_path.stat().st_size} 字节)")
    print(f"- 发布产物：{release_path} ({release_path.stat().st_size} 字节)")


if __name__ == "__main__":
    main()

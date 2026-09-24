from __future__ import annotations

"""Tauri 主路径 PC 发包封装（唯一正式发包入口）。

DEPRECATED 全量 PyInstaller + pywebview 应急壳：禁止使用 build/app.spec、
build/app_main.py、build/installer.nsi 产出正式安装包。
规范见 docs/构建方案/PC发包规范-Tauri主路径.md。
"""

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
SERVER_DIST = ROOT_DIR / "build" / "dist-server"
SIDECAR_SRC = SERVER_DIST / "PromptImageManager-Server.exe"
SIDECAR_DST = ROOT_DIR / "src-tauri" / "server" / "PromptImageManager-Server.exe"
NSIS_DIR = ROOT_DIR / "src-tauri" / "target" / "release" / "bundle" / "nsis"
RELEASES_DIR = ROOT_DIR / "releases"
RELEASE_SETUP_NAME = "PromptImageManager-Setup-{version}.exe"


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
    data = json.loads((ROOT_DIR / "package.json").read_text(encoding="utf-8"))
    return str(data["version"]).strip()


def build_frontend() -> None:
    run_command(["npx", "vite", "build"])


def build_sidecar() -> None:
    run_command(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "build/server.spec",
            "--workpath",
            "build/build-server",
            "--distpath",
            "build/dist-server",
            "--clean",
            "-y",
        ]
    )
    require_file(SIDECAR_SRC, "Sidecar 可执行文件缺失")


def copy_sidecar() -> None:
    require_file(SIDECAR_SRC, "Sidecar 源文件缺失，请先构建 server.spec")
    SIDECAR_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SIDECAR_SRC, SIDECAR_DST)
    require_file(SIDECAR_DST, "Sidecar 拷贝到 Tauri 资源失败")
    print(f"[完成] Sidecar → {SIDECAR_DST}")


def build_tauri() -> None:
    run_command(["npx", "tauri", "build"])
    require_file(NSIS_DIR, "Tauri NSIS 输出目录缺失")


def pick_nsis_setup(version: str) -> Path:
    candidates = sorted(NSIS_DIR.glob("*.exe"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise SystemExit(f"[失败] 未找到 Tauri NSIS 安装包：{NSIS_DIR}")
    for path in candidates:
        if version in path.name:
            return path
    names = ", ".join(p.name for p in candidates[:5])
    raise SystemExit(
        f"[失败] NSIS 目录无含版本 {version} 的安装包（禁止误用其它版本/旧壳）。候选：{names}"
    )


def copy_to_releases(setup_path: Path, version: str) -> Path:
    RELEASES_DIR.mkdir(exist_ok=True)
    release_path = RELEASES_DIR / RELEASE_SETUP_NAME.format(version=version)
    shutil.copy2(setup_path, release_path)
    require_file(release_path, "发布目录安装包缺失")
    size = release_path.stat().st_size
    print(f"[完成] 发布副本：{release_path}（{size} 字节）")
    if size < 20 * 1024 * 1024:
        print("[警告] 体积异常偏小，请确认是否为 Tauri 包")
    return release_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tauri 主路径构建 PC 安装包（唯一正式发包入口）"
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="跳过 vite build（已有 dist 时）",
    )
    parser.add_argument(
        "--skip-sidecar",
        action="store_true",
        help="跳过 Sidecar 构建（已有 dist-server 时）",
    )
    parser.add_argument(
        "--skip-tauri",
        action="store_true",
        help="跳过 npx tauri build（仅整理已有 NSIS 产物到 releases/）",
    )
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="跳过环境检查",
    )
    return parser.parse_args()


def check_environment() -> None:
    for cmd, hint in (
        ("npx", "Node.js"),
        ("cargo", "Rust https://rustup.rs/"),
        ("python", "Python 3.9+"),
    ):
        if not shutil.which(cmd) and not shutil.which(f"{cmd}.cmd" if cmd == "npx" else cmd):
            raise SystemExit(f"[失败] 未找到 {cmd}，请安装 {hint}")
    try:
        subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--version"],
            check=True,
            capture_output=True,
        )
    except Exception as exc:
        raise SystemExit("[失败] 未找到 PyInstaller（Sidecar 需要）") from exc


def main() -> None:
    args = parse_args()
    version = get_package_version()
    print(f"[开始] PromptImageManager v{version} Tauri 主路径发包")
    print("[提示] 禁止使用 build/app.spec 全量旧壳；规范见 docs/构建方案/PC发包规范-Tauri主路径.md")

    if not args.skip_env_check:
        check_environment()

    if not args.skip_frontend:
        build_frontend()
    if not args.skip_sidecar:
        build_sidecar()
    copy_sidecar()
    if not args.skip_tauri:
        build_tauri()

    setup = pick_nsis_setup(version)
    release_path = copy_to_releases(setup, version)
    print("\n[完成] Tauri 主路径发包流程结束")
    print(f"- 版本：{version}")
    print(f"- Tauri 原始：{setup}")
    print(f"- 发布文件：{release_path}")


if __name__ == "__main__":
    main()

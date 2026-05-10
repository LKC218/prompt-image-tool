from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[1]


def run_command(command: list[str]) -> None:
    print(f"\n[执行] {' '.join(command)}")
    result = subprocess.run(command, cwd=ROOT_DIR)
    if result.returncode != 0:
        raise SystemExit(f"[失败] 命令退出码：{result.returncode}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建 PC 与 Android 发布安装包")
    parser.add_argument("--pc", action="store_true", help="只构建 PC 安装包")
    parser.add_argument("--android", action="store_true", help="只构建 Android 安装包")
    parser.add_argument("--all", action="store_true", help="构建全部安装包")
    parser.add_argument("--skip-env-check", action="store_true", help="跳过子脚本环境检查")
    parser.add_argument("--allow-unsigned", action="store_true", help="允许 Android 导出未签名 APK")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_pc = args.all or args.pc or not args.android
    build_android = args.all or args.android or not args.pc

    common_args = ["--skip-env-check"] if args.skip_env_check else []

    if build_pc:
        run_command([sys.executable, "scripts\\build_pc_package.py", *common_args])

    if build_android:
        android_args = [*common_args]
        if args.allow_unsigned:
            android_args.append("--allow-unsigned")
        run_command([sys.executable, "scripts\\build_android_package.py", *android_args])

    print("\n[完成] 发布安装包构建流程结束")


if __name__ == "__main__":
    main()

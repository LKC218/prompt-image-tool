from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[1]
ANDROID_DIR = ROOT_DIR / "android"
ANDROID_APP_DIR = ANDROID_DIR / "app"
DIST_DIR = ROOT_DIR / "dist"
RELEASES_DIR = ROOT_DIR / "releases"
GRADLEW = "gradlew.bat" if sys.platform == "win32" else "./gradlew"


def resolve_command(command: str, cwd: Path) -> str:
    local_command = cwd / command
    if local_command.exists():
        return str(local_command)

    found = shutil.which(command)
    if found:
        return found

    if sys.platform == "win32":
        for suffix in (".cmd", ".bat", ".exe"):
            if not command.lower().endswith(suffix):
                local_command = cwd / f"{command}{suffix}"
                if local_command.exists():
                    return str(local_command)
                found = shutil.which(f"{command}{suffix}")
                if found:
                    return found

    return command


def run_command(command: list[str], cwd: Path = ROOT_DIR) -> None:
    resolved = [resolve_command(command[0], cwd), *command[1:]]
    print(f"\n[执行] {' '.join(command)}", flush=True)
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


def get_android_version() -> tuple[int, str]:
    build_gradle = ANDROID_APP_DIR / "build.gradle"
    require_file(build_gradle, "Android build.gradle 缺失")
    text = build_gradle.read_text(encoding="utf-8")

    code_match = re.search(r"versionCode\s+(\d+)", text)
    name_match = re.search(r'versionName\s+"([^"]+)"', text)
    if not code_match or not name_match:
        raise SystemExit("[失败] android/app/build.gradle 缺少 versionCode 或 versionName")

    return int(code_match.group(1)), name_match.group(1)


def read_properties(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def validate_signing_config() -> None:
    properties_path = ANDROID_DIR / "keystore.properties"
    require_file(properties_path, "Android 签名配置缺失")
    properties = read_properties(properties_path)
    required_keys = ("storeFile", "storePassword", "keyAlias", "keyPassword")
    missing_keys = [key for key in required_keys if not properties.get(key)]
    if missing_keys:
        raise SystemExit(f"[失败] Android 签名配置字段缺失：{', '.join(missing_keys)}")

    store_file = properties["storeFile"]
    candidates = [
        (ANDROID_APP_DIR / store_file).resolve(),
        (ANDROID_DIR / store_file).resolve(),
    ]
    if not any(path.exists() for path in candidates):
        raise SystemExit("[失败] Android 签名密钥文件缺失，请检查 keystore.properties 的 storeFile")


def validate_versions(package_version: str) -> None:
    version_code, version_name = get_android_version()
    if version_name != package_version:
        raise SystemExit(
            f"[失败] 版本不一致：package.json={package_version}, Android versionName={version_name}"
        )
    print(f"[版本] Android versionCode={version_code}, versionName={version_name}")


def check_environment() -> None:
    checks = [
        ["node", "--version"],
        ["npm", "--version"],
        ["java", "-version"],
        [GRADLEW, "--version"],
    ]
    for command in checks:
        run_command(command, ANDROID_DIR if command[0] == GRADLEW else ROOT_DIR)


def build_frontend() -> None:
    run_command(["npm", "run", "build"])
    require_file(DIST_DIR / "index.html", "前端构建产物缺失")


def sync_capacitor() -> None:
    run_command(["npx", "cap", "sync", "android"])
    require_file(
        ANDROID_APP_DIR / "src" / "main" / "assets" / "public" / "index.html",
        "Capacitor 同步后的前端入口缺失",
    )


def patch_java_version(skip_java_patch: bool) -> None:
    if skip_java_patch:
        print("\n[跳过] Java 版本兼容性修补")
        return
    run_command(
        [
            "powershell",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            "scripts\\patch-java-version.ps1",
        ]
    )


def build_release_apk() -> None:
    run_command([GRADLEW, "assembleRelease"], cwd=ANDROID_DIR)


def copy_release_apk(version: str, allow_unsigned: bool) -> Path:
    signed_apk = ANDROID_APP_DIR / "build" / "outputs" / "apk" / "release" / "app-release.apk"
    unsigned_apk = (
        ANDROID_APP_DIR
        / "build"
        / "outputs"
        / "apk"
        / "release"
        / "app-release-unsigned.apk"
    )

    RELEASES_DIR.mkdir(exist_ok=True)
    if signed_apk.exists():
        release_path = RELEASES_DIR / f"PromptImageManager-v{version}-Android.apk"
        shutil.copy2(signed_apk, release_path)
        require_file(release_path, "发布目录 Android APK 缺失")
        return release_path

    if unsigned_apk.exists() and allow_unsigned:
        release_path = RELEASES_DIR / f"PromptImageManager-v{version}-Android-unsigned.apk"
        shutil.copy2(unsigned_apk, release_path)
        require_file(release_path, "发布目录未签名 Android APK 缺失")
        return release_path

    if unsigned_apk.exists():
        raise SystemExit("[失败] 仅生成未签名 APK；请修复签名配置，或使用 --allow-unsigned 临时导出")

    raise SystemExit("[失败] 未找到 Android APK 输出文件")


def print_summary(release_path: Path) -> None:
    print("\n[完成] Android 安装包构建流程结束")
    print(f"- 发布 APK：{release_path} ({release_path.stat().st_size} 字节)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建 Android 安装包")
    parser.add_argument(
        "--skip-env-check",
        action="store_true",
        help="跳过环境检查，直接执行构建",
    )
    parser.add_argument(
        "--skip-java-patch",
        action="store_true",
        help="跳过 cap sync 后的 Java 版本兼容性修补",
    )
    parser.add_argument(
        "--allow-unsigned",
        action="store_true",
        help="允许复制未签名 APK 到 releases，文件名会带 unsigned",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    version = get_package_version()
    print(f"[开始] PromptImageManager v{version} Android 安装包构建")

    validate_versions(version)
    validate_signing_config()

    if not args.skip_env_check:
        check_environment()

    build_frontend()
    sync_capacitor()
    patch_java_version(args.skip_java_patch)
    build_release_apk()
    release_path = copy_release_apk(version, args.allow_unsigned)
    print_summary(release_path)


if __name__ == "__main__":
    main()

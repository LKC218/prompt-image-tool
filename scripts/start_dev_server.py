"""Start or reuse the local development server for Prompt Image Manager."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_URL = "http://127.0.0.1:8888/api/health"
PC_URL = "http://127.0.0.1:5173/?ui=pc"
MOBILE_URL = "http://127.0.0.1:5173/?ui=mobile"


def log(message: str) -> None:
    print(message, flush=True)


def resolve_npm() -> str:
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        raise RuntimeError("未找到 npm，请先安装 Node.js 并确认 npm 可用。")
    return npm


def request_json(url: str, timeout: float = 2.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            if not 200 <= response.status < 400:
                return None
            payload = json.loads(response.read().decode("utf-8"))
            return payload if isinstance(payload, dict) else None
    except (OSError, urllib.error.URLError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def request_ok(url: str, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 400
    except (OSError, urllib.error.URLError):
        return False


def wait_until_ready(url: str, label: str, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if request_ok(url):
            log(f"[OK] {label} 已就绪：{url}")
            return True
        time.sleep(0.25)
    log(f"[错误] {label} 启动超时：{url}")
    return False


def start_backend() -> subprocess.Popen:
    backend_entry = PROJECT_ROOT / "python" / "main.py"
    if not backend_entry.exists():
        raise RuntimeError(f"未找到后端入口：{backend_entry}")

    log("[启动] Python 后端：端口 8888")
    return subprocess.Popen(
        [sys.executable, str(backend_entry)],
        cwd=PROJECT_ROOT,
    )


def start_frontend(npm: str) -> subprocess.Popen:
    log("[启动] Vite 前端：端口 5173")
    return subprocess.Popen(
        [npm, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"],
        cwd=PROJECT_ROOT,
    )


def stop_processes(processes: list[subprocess.Popen]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()

    deadline = time.time() + 5
    while time.time() < deadline:
        if all(process.poll() is not None for process in processes):
            return
        time.sleep(0.25)

    for process in processes:
        if process.poll() is None:
            process.kill()


def open_pages(open_pc: bool, open_mobile: bool) -> None:
    if open_pc:
        webbrowser.open(PC_URL)
        log(f"[打开] PC 端：{PC_URL}")
    if open_mobile:
        webbrowser.open(MOBILE_URL)
        log(f"[打开] 移动端：{MOBILE_URL}")


def keep_alive(processes: list[subprocess.Popen]) -> int:
    if not processes:
        log("[完成] 已复用现有服务。")
        return 0

    log("[运行中] 按 Ctrl+C 停止本脚本启动的服务。")
    try:
        while True:
            for process in processes:
                code = process.poll()
                if code is not None:
                    log(f"[退出] 子进程已结束，退出码：{code}")
                    stop_processes(processes)
                    return code
            time.sleep(0.5)
    except KeyboardInterrupt:
        log("\n[停止] 正在关闭本脚本启动的服务...")
        stop_processes(processes)
        log("[完成] 服务已停止。")
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="启动或复用提示词管家本地开发服务。")
    parser.add_argument("--no-open", action="store_true", help="只启动与验证服务，不打开浏览器。")
    parser.add_argument("--pc-only", action="store_true", help="只打开 PC 端预览。")
    parser.add_argument("--mobile-only", action="store_true", help="只打开移动端预览。")
    parser.add_argument("--check-only", action="store_true", help="只检查现有服务，不启动新进程。")
    parser.add_argument("--timeout", type=float, default=25.0, help="等待服务就绪的秒数。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    processes: list[subprocess.Popen] = []

    log("提示词管家 - 本地开发服务器")
    log(f"[目录] {PROJECT_ROOT}")

    backend_health = request_json(BACKEND_URL)
    backend_ready = backend_health is not None
    frontend_ready = request_ok(PC_URL) and request_ok(MOBILE_URL)

    if args.check_only:
        log(f"[检查] 后端：{'可用' if backend_ready else '不可用'}")
        log(f"[检查] 前端：{'可用' if frontend_ready else '不可用'}")
        return 0 if backend_ready and frontend_ready else 1

    try:
        if backend_ready:
            log(f"[复用] 后端已可用：{BACKEND_URL}")
        else:
            processes.append(start_backend())
            if not wait_until_ready(BACKEND_URL, "后端", args.timeout):
                stop_processes(processes)
                return 1
            backend_health = request_json(BACKEND_URL)

        if backend_health and backend_health.get("dataDir"):
            log(f"[数据目录] {backend_health['dataDir']}")

        if frontend_ready:
            log(f"[复用] 前端已可用：{PC_URL}")
        else:
            npm = resolve_npm()
            processes.append(start_frontend(npm))
            if not wait_until_ready(PC_URL, "PC 端页面", args.timeout):
                stop_processes(processes)
                return 1
            if not wait_until_ready(MOBILE_URL, "移动端页面", args.timeout):
                stop_processes(processes)
                return 1

        if not args.no_open:
            open_pc = not args.mobile_only
            open_mobile = not args.pc_only
            open_pages(open_pc, open_mobile)

        log("[地址] 后端健康检查：http://127.0.0.1:8888/api/health")
        log("[地址] PC 端：http://127.0.0.1:5173/?ui=pc")
        log("[地址] 移动端：http://127.0.0.1:5173/?ui=mobile")
        return keep_alive(processes)
    except RuntimeError as exc:
        stop_processes(processes)
        log(f"[错误] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

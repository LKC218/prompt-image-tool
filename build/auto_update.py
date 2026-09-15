from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

UPDATE_META_URL = (
    "https://github.com/LKC218/prompt-image-tool/releases/latest/download/latest.json"
)
HTTP_TIMEOUT = 15
DOWNLOAD_CHUNK = 1024 * 256
USER_AGENT = "PromptImageManager-Updater/1.0"


def parse_version_tuple(version: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", str(version or ""))
    if not parts:
        return (0,)
    return tuple(int(p) for p in parts)


def is_remote_newer(remote_version: str, local_version: str) -> bool:
    return parse_version_tuple(remote_version) > parse_version_tuple(local_version)


def read_local_app_version(frontend_dir: str | None = None) -> str:
    candidates: list[str] = []
    if frontend_dir:
        candidates.append(os.path.join(frontend_dir, "index.html"))
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        candidates.append(os.path.join(base, "frontend", "index.html"))
        candidates.append(os.path.join(os.path.dirname(sys.executable), "frontend", "index.html"))
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        candidates.append(os.path.join(here, "..", "src", "index.html"))
        candidates.append(os.path.join(here, "..", "dist", "index.html"))

    for path in candidates:
        try:
            if not os.path.isfile(path):
                continue
            with open(path, "r", encoding="utf-8") as handle:
                html = handle.read(4000)
            match = re.search(
                r'<meta\s+name=["\']version["\']\s+content=["\']([^"\']+)["\']',
                html,
                flags=re.IGNORECASE,
            )
            if match:
                return match.group(1).strip()
        except OSError:
            continue
    return "0.0.0"


def fetch_latest_meta(url: str | None = None) -> dict[str, Any]:
    target = (url or UPDATE_META_URL).strip()
    request = urllib.request.Request(target, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        raw = response.read()
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("latest.json 格式无效")
    version = str(data.get("version") or "").strip()
    download_url = str(data.get("url") or "").strip()
    sha256 = str(data.get("sha256") or "").strip().lower()
    if not version or not download_url or not sha256:
        raise ValueError("latest.json 缺少 version/url/sha256")
    data["version"] = version
    data["url"] = download_url
    data["sha256"] = sha256
    return data


def check_update(local_version: str | None = None) -> dict[str, Any]:
    local = (local_version or read_local_app_version()).strip()
    meta = fetch_latest_meta()
    has_update = is_remote_newer(meta["version"], local)
    return {
        "success": True,
        "hasUpdate": has_update,
        "localVersion": local,
        "latest": meta,
    }


def download_installer(
    url: str,
    expected_sha256: str,
    dest_path: str | None = None,
) -> dict[str, Any]:
    expected = (expected_sha256 or "").strip().lower()
    if not url or not expected:
        raise ValueError("url 与 sha256 必填")

    if dest_path:
        target = dest_path
        os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    else:
        temp_dir = tempfile.mkdtemp(prefix="prompt-image-update-")
        name = os.path.basename(urllib.parse.urlsplit(url).path) or "PromptImageManager-Setup.exe"
        if not name.lower().endswith(".exe"):
            name = f"{name}.exe"
        target = os.path.join(temp_dir, name)

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    digest = hashlib.sha256()
    total = 0
    with urllib.request.urlopen(request, timeout=60) as response, open(target, "wb") as handle:
        while True:
            chunk = response.read(DOWNLOAD_CHUNK)
            if not chunk:
                break
            handle.write(chunk)
            digest.update(chunk)
            total += len(chunk)

    actual = digest.hexdigest().lower()
    if actual != expected:
        try:
            os.remove(target)
        except OSError:
            pass
        raise ValueError("安装包校验失败，已丢弃下载文件")

    return {
        "success": True,
        "path": target,
        "size": total,
        "sha256": actual,
    }


def run_installer(installer_path: str) -> dict[str, Any]:
    path = (installer_path or "").strip()
    if not path or not os.path.isfile(path):
        raise FileNotFoundError("安装包不存在")

    creationflags = 0
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

    subprocess.Popen(
        [path, "/S"],
        cwd=os.path.dirname(path) or None,
        close_fds=True,
        creationflags=creationflags,
    )
    time.sleep(0.8)
    return {"success": True, "message": "installer launched"}


def exit_app_after_install() -> None:
    os._exit(0)

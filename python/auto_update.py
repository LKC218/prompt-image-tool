from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Callable

UPDATE_META_URL = (
    "https://github.com/LKC218/prompt-image-tool/releases/latest/download/latest.json"
)
HTTP_TIMEOUT = 15
DOWNLOAD_CHUNK = 1024 * 256
USER_AGENT = "PromptImageManager-Updater/1.0"

JOB_PHASES_ACTIVE = frozenset({"pending", "downloading", "verifying"})
_jobs_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}


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


class DownloadCancelled(Exception):
    """下载被用户取消。"""


def _now_ms() -> int:
    return int(time.time() * 1000)


def _remove_file_quiet(path: str | None) -> None:
    if not path:
        return
    try:
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


def _resolve_target_path(url: str, dest_path: str | None = None) -> str:
    if dest_path:
        target = dest_path
        os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
        return target
    temp_dir = tempfile.mkdtemp(prefix="prompt-image-update-")
    name = os.path.basename(urllib.parse.urlsplit(url).path) or "PromptImageManager-Setup.exe"
    if not name.lower().endswith(".exe"):
        name = f"{name}.exe"
    return os.path.join(temp_dir, name)


def _create_job(url: str, sha256: str) -> dict[str, Any]:
    job_id = uuid.uuid4().hex[:12]
    job = {
        "jobId": job_id,
        "phase": "pending",
        "percent": 0,
        "downloaded": 0,
        "total": 0,
        "speed": 0,
        "path": "",
        "error": "",
        "cancelRequested": False,
        "url": url,
        "sha256": sha256,
        "updatedAt": _now_ms(),
    }
    with _jobs_lock:
        for existing_id, existing in list(_jobs.items()):
            if existing.get("phase") in JOB_PHASES_ACTIVE and existing_id != job_id:
                existing["cancelRequested"] = True
        _jobs[job_id] = job
    return dict(job)


def _patch_job(job_id: str, **fields: Any) -> dict[str, Any]:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise KeyError(f"未知下载任务: {job_id}")
        job.update(fields)
        job["updatedAt"] = _now_ms()
        return dict(job)


def _read_job(job_id: str) -> dict[str, Any]:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise KeyError(f"未知下载任务: {job_id}")
        return dict(job)


def _job_cancel_requested(job_id: str) -> bool:
    with _jobs_lock:
        job = _jobs.get(job_id)
        return bool(job and job.get("cancelRequested"))


def download_installer(
    url: str,
    expected_sha256: str,
    dest_path: str | None = None,
    *,
    job_id: str | None = None,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    expected = (expected_sha256 or "").strip().lower()
    if not url or not expected:
        raise ValueError("url 与 sha256 必填")

    target = _resolve_target_path(url, dest_path)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    digest = hashlib.sha256()
    downloaded = 0
    total_size = 0
    speed = 0
    window_bytes = 0
    window_started = time.time()

    def report(phase: str, percent: float | None = None) -> None:
        nonlocal speed, window_bytes, window_started
        payload = {
            "phase": phase,
            "downloaded": downloaded,
            "total": total_size,
            "speed": speed,
            "path": target if phase == "ready" else "",
        }
        if percent is not None:
            payload["percent"] = max(0, min(100, int(percent)))
        if on_progress:
            on_progress(payload)
        if job_id:
            fields = {
                "downloaded": downloaded,
                "total": total_size,
                "speed": speed,
            }
            if percent is not None:
                fields["percent"] = max(0, min(100, int(percent)))
            if phase != "downloading":
                fields["phase"] = phase
            else:
                fields["phase"] = "downloading"
            if phase == "ready":
                fields["path"] = target
            try:
                _patch_job(job_id, **fields)
            except KeyError:
                pass

    def request_cancelled_error(message: str = "下载已取消") -> DownloadCancelled:
        if job_id:
            try:
                _patch_job(job_id, phase="cancelled", error="", path="", percent=0)
            except KeyError:
                pass
        if on_progress:
            on_progress({
                "phase": "cancelled",
                "downloaded": downloaded,
                "total": total_size,
                "speed": 0,
                "path": "",
                "percent": 0,
            })
        return DownloadCancelled(message)

    if job_id and _job_cancel_requested(job_id):
        raise request_cancelled_error()

    report("downloading", 0)
    try:
        with urllib.request.urlopen(request, timeout=60) as response, open(target, "wb") as handle:
            content_length = response.headers.get("Content-Length") if response.headers else None
            try:
                total_size = int(content_length) if content_length else 0
            except (TypeError, ValueError):
                total_size = 0

            while True:
                if should_cancel and should_cancel():
                    raise request_cancelled_error()
                if job_id and _job_cancel_requested(job_id):
                    raise request_cancelled_error()

                chunk = response.read(DOWNLOAD_CHUNK)
                if not chunk:
                    break
                handle.write(chunk)
                digest.update(chunk)
                downloaded += len(chunk)
                window_bytes += len(chunk)
                now = time.time()
                elapsed = now - window_started
                if elapsed >= 0.5:
                    speed = int(window_bytes / elapsed) if elapsed > 0 else 0
                    window_bytes = 0
                    window_started = now
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                else:
                    percent = 0
                report("downloading", percent)
    except DownloadCancelled:
        _remove_file_quiet(target)
        raise
    except Exception:
        _remove_file_quiet(target)
        raise

    report("verifying", 100 if total_size == 0 else (downloaded / max(total_size, 1)) * 100)
    if job_id and _job_cancel_requested(job_id):
        _remove_file_quiet(target)
        raise request_cancelled_error()

    actual = digest.hexdigest().lower()
    if actual != expected:
        _remove_file_quiet(target)
        error = "安装包校验失败，已丢弃下载文件"
        if job_id:
            try:
                _patch_job(job_id, phase="failed", error=error, path="", percent=100)
            except KeyError:
                pass
        raise ValueError(error)

    report("ready", 100)
    return {
        "success": True,
        "path": target,
        "size": downloaded,
        "sha256": actual,
    }


def _run_download_job(job_id: str, url: str, expected_sha256: str) -> None:
    try:
        result = download_installer(url, expected_sha256, job_id=job_id)
        _patch_job(
            job_id,
            phase="ready",
            percent=100,
            path=result["path"],
            downloaded=result["size"],
            error="",
        )
    except DownloadCancelled:
        try:
            _patch_job(job_id, phase="cancelled", error="", path="", percent=0)
        except KeyError:
            pass
    except Exception as error:
        try:
            _patch_job(job_id, phase="failed", error=str(error), path="")
        except KeyError:
            pass


def start_download_job(url: str, expected_sha256: str) -> dict[str, Any]:
    expected = (expected_sha256 or "").strip().lower()
    if not url or not expected:
        raise ValueError("url 与 sha256 必填")
    job = _create_job(url, expected)
    worker = threading.Thread(
        target=_run_download_job,
        args=(job["jobId"], url, expected),
        daemon=True,
        name=f"update-download-{job['jobId']}",
    )
    worker.start()
    return {"success": True, "jobId": job["jobId"]}


def get_download_job(job_id: str) -> dict[str, Any]:
    job = _read_job((job_id or "").strip())
    payload = {
        "success": True,
        "jobId": job["jobId"],
        "phase": job["phase"],
        "percent": job["percent"],
        "downloaded": job["downloaded"],
        "total": job["total"],
        "speed": job["speed"],
        "path": job["path"],
        "error": job["error"],
    }
    return payload


def cancel_download_job(job_id: str) -> dict[str, Any]:
    job_id = (job_id or "").strip()
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise KeyError(f"未知下载任务: {job_id}")
        job["cancelRequested"] = True
        phase = job["phase"]
    return {"success": True, "jobId": job_id, "phase": phase}


def reset_download_jobs_for_tests() -> None:
    with _jobs_lock:
        _jobs.clear()


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

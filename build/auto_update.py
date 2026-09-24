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

REPO_SLUG = "LKC218/prompt-image-tool"
UPDATE_META_URL = (
    "https://github.com/LKC218/prompt-image-tool/releases/latest/download/latest.json"
)
# 国内网络访问 GitHub 常见 SSL/EOF 中断，按优先级回退
UPDATE_META_FALLBACK_URLS = (
    f"https://ghproxy.net/https://github.com/{REPO_SLUG}/releases/latest/download/latest.json",
)
DOWNLOAD_MIRROR_PREFIXES = (
    "https://ghproxy.net/",
)
HTTP_TIMEOUT = 15
DOWNLOAD_CHUNK = 1024 * 256
USER_AGENT = "PromptImageManager-Updater/1.0"
NETWORK_RETRY_ATTEMPTS = 3
NETWORK_RETRY_BACKOFF = 0.8

JOB_PHASES_ACTIVE = frozenset({"pending", "downloading", "verifying"})
_jobs_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}

MAIN_APP_EXE_CANDIDATES = (
    "生图提示词管理器.exe",
    "PromptImageManager.exe",
)
MAIN_APP_IMAGE_NAMES = MAIN_APP_EXE_CANDIDATES
# 兼容旧调用/测试；解析目标请用 resolve_target_exe
APP_EXE_NAME = "PromptImageManager.exe"
REGISTRY_APP_KEY = r"Software\PromptImageManager"
HELPER_DEFAULT_TIMEOUT_SEC = 900
HELPER_SETTLE_SEC = 3  # 杀进程后句柄释放
# DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
_HELPER_CREATIONFLAGS = 0x00000008 | 0x00000200 | 0x08000000

RELAUNCH_HELPER_SCRIPT = r"""param(
  [Parameter(Mandatory=$true)][int]$InstallerPid,
  [Parameter(Mandatory=$true)][string]$TargetExe,
  [string]$ExpectedVersion = "",
  [int]$TimeoutSec = 900,
  [int]$SettleSec = 3
)
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  $proc = Get-Process -Id $InstallerPid -ErrorAction SilentlyContinue
  if (-not $proc) { break }
  Start-Sleep -Milliseconds 500
}
if ($SettleSec -gt 0) { Start-Sleep -Seconds $SettleSec }
if (-not (Test-Path -LiteralPath $TargetExe)) {
  $exeDirHint = Split-Path -Parent $TargetExe
  foreach ($name in @('生图提示词管理器.exe','PromptImageManager.exe')) {
    $cand = Join-Path $exeDirHint $name
    if (Test-Path -LiteralPath $cand) { $TargetExe = $cand; break }
  }
}
if (-not (Test-Path -LiteralPath $TargetExe)) { exit 0 }
$exeDir = Split-Path -Parent $TargetExe
# ExpectedVersion 仅作软校验日志：Tauri 布局无 frontend/index.html，硬门闩会误杀重启
if ($ExpectedVersion -ne "") {
  $candidates = @(
    (Join-Path $exeDir 'frontend\index.html'),
    (Join-Path $exeDir '_internal\frontend\index.html')
  )
  $readAny = $false
  $matched = $false
  foreach ($htmlPath in $candidates) {
    if (-not (Test-Path -LiteralPath $htmlPath)) { continue }
    try {
      $html = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8
      if ($null -eq $html) { $html = '' }
      if ($html.Length -gt 8000) { $html = $html.Substring(0, 8000) }
      if ($html -match '(?i)name=["'']version["'']\s+content=["'']([^"'']+)["'']') {
        $readAny = $true
        $found = [string]$Matches[1]
        if ($found.Trim() -eq $ExpectedVersion.Trim()) { $matched = $true }
      }
    } catch {}
  }
  if ($readAny -and -not $matched) {
    try {
      $logPath = Join-Path ([System.IO.Path]::GetTempPath()) 'prompt-image-update.log'
      $line = '[{0}] helper soft version mismatch expected={1} (still relaunch)' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $ExpectedVersion
      Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    } catch {}
  }
}
Start-Process -FilePath $TargetExe -WorkingDirectory $exeDir
try { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue } catch {}
"""


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
                html = handle.read(8000)
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


def _friendly_network_error(error: BaseException) -> str:
    text = str(error)
    lowered = text.lower()
    if "unexpected_eof" in lowered or "eof occurred" in lowered or "ssl" in lowered:
        return "无法安全连接更新服务器（网络中断或 SSL 握手失败），请检查网络后重试"
    if "timed out" in lowered or "timeout" in lowered:
        return "连接更新服务器超时，请检查网络后重试"
    if "name or service not known" in lowered or "getaddrinfo" in lowered:
        return "无法解析更新服务器地址，请检查网络或 DNS"
    return f"检查更新失败：{text}"


def _build_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Cache-Control": "no-cache",
        },
    )


def _http_get_bytes(url: str, timeout: int | float = HTTP_TIMEOUT) -> bytes:
    last_error: BaseException | None = None
    for attempt in range(NETWORK_RETRY_ATTEMPTS):
        try:
            with urllib.request.urlopen(_build_request(url), timeout=timeout) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt < NETWORK_RETRY_ATTEMPTS - 1:
                time.sleep(NETWORK_RETRY_BACKOFF * (attempt + 1))
    raise last_error if last_error else RuntimeError("网络请求失败")


def _meta_candidate_urls(explicit: str | None = None) -> list[str]:
    if explicit and explicit.strip():
        return [explicit.strip()]
    # jsDelivr 对 @main 有 CDN 缓存，加时间戳避免读到过期 latest.json
    jsdelivr = (
        f"https://cdn.jsdelivr.net/gh/{REPO_SLUG}@main/releases/latest.json"
        f"?t={int(time.time())}"
    )
    return [
        UPDATE_META_URL,
        UPDATE_META_FALLBACK_URLS[0],
        jsdelivr,
    ]


def _parse_latest_meta(raw: bytes) -> dict[str, Any]:
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


def fetch_latest_meta(url: str | None = None) -> dict[str, Any]:
    candidates = _meta_candidate_urls(url)
    last_error: BaseException | None = None
    for target in candidates:
        try:
            raw = _http_get_bytes(target)
            return _parse_latest_meta(raw)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            last_error = error
            continue
    if last_error is None:
        raise RuntimeError("更新元数据请求失败")
    if isinstance(last_error, (urllib.error.URLError, TimeoutError, OSError)):
        raise RuntimeError(_friendly_network_error(last_error)) from last_error
    raise RuntimeError(f"检查更新失败：{last_error}") from last_error


def _download_url_candidates(url: str) -> list[str]:
    url = (url or "").strip()
    if not url:
        return []
    candidates = [url]
    if url.startswith("https://github.com/") or url.startswith("http://github.com/"):
        for prefix in DOWNLOAD_MIRROR_PREFIXES:
            candidates.append(f"{prefix}{url}")
    # 去重且保持顺序
    seen: set[str] = set()
    ordered: list[str] = []
    for item in candidates:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


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
        terminal = [
            existing_id
            for existing_id, existing in _jobs.items()
            if existing.get("phase") not in JOB_PHASES_ACTIVE
        ]
        # 仅保留最近若干终态任务，避免会话内无限增长
        for drop_id in terminal[:-5]:
            _jobs.pop(drop_id, None)
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
    open_error: BaseException | None = None
    response = None
    for candidate in _download_url_candidates(url):
        if job_id and _job_cancel_requested(job_id):
            raise request_cancelled_error()
        try:
            response = urllib.request.urlopen(_build_request(candidate), timeout=60)
            break
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            open_error = error
            continue
    if response is None:
        message = _friendly_network_error(open_error) if open_error else "无法连接下载地址"
        if job_id:
            try:
                _patch_job(job_id, phase="failed", error=message, path="")
            except KeyError:
                pass
        raise RuntimeError(message)

    try:
        with response, open(target, "wb") as handle:
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
    except Exception as error:
        _remove_file_quiet(target)
        if isinstance(error, (urllib.error.URLError, TimeoutError, OSError)):
            raise RuntimeError(_friendly_network_error(error)) from error
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


def _should_auto_restart() -> bool:
    return os.name == "nt" and bool(getattr(sys, "frozen", False))


def _read_install_dir_from_registry() -> str | None:
    if os.name != "nt":
        return None
    try:
        import winreg
    except ImportError:
        return None
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REGISTRY_APP_KEY) as key:
            value, _ = winreg.QueryValueEx(key, "InstallDir")
        candidate = str(value or "").strip()
        if candidate and os.path.isdir(candidate):
            return candidate
    except OSError:
        pass

    uninstall_roots = (
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
    )
    keywords = ("promptimagemanager", "生图提示词管理器", "com.promptimagemanager")
    try:
        for root in uninstall_roots:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, root) as base_key:
                i = 0
                while True:
                    try:
                        sub_name = winreg.EnumKey(base_key, i)
                    except OSError:
                        break
                    i += 1
                    lowered = sub_name.lower()
                    if not any(k in lowered for k in keywords):
                        continue
                    try:
                        with winreg.OpenKey(base_key, sub_name) as sub_key:
                            for value_name in ("InstallLocation", "DisplayIcon", "UninstallString"):
                                try:
                                    raw, _ = winreg.QueryValueEx(sub_key, value_name)
                                except OSError:
                                    continue
                                text = str(raw or "").strip().strip('"')
                                if not text:
                                    continue
                                candidate = text
                                if value_name != "InstallLocation":
                                    if text.lower().endswith(".exe"):
                                        candidate = os.path.dirname(text)
                                if candidate and os.path.isdir(candidate):
                                    return os.path.abspath(candidate)
                    except OSError:
                        continue
    except OSError:
        return None
    return None


def resolve_target_exe(install_dir: str) -> str:
    if not install_dir:
        return ""
    for name in MAIN_APP_EXE_CANDIDATES:
        candidate = os.path.join(install_dir, name)
        if os.path.isfile(candidate):
            return os.path.abspath(candidate)
    return ""


def _is_server_only_dir(directory: str) -> bool:
    if not directory or not os.path.isdir(directory):
        return False
    if resolve_target_exe(directory):
        return False
    for name in ("PromptImageManager-Server.exe", "PromptImageManager-Server"):
        if os.path.isfile(os.path.join(directory, name)):
            return True
    return False


def _parent_process_exe_path() -> str | None:
    if os.name != "nt":
        return None
    ppid = os.getppid()
    if not ppid:
        return None
    try:
        output = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-CimInstance Win32_Process -Filter \"ProcessId={int(ppid)}\").ExecutablePath",
            ],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            timeout=5,
        )
    except Exception:
        return None
    text = (output or b"").decode("utf-8", errors="ignore").strip().strip('"')
    if text and os.path.isfile(text):
        return os.path.abspath(text)
    return None


def _expected_target_exe(install_dir: str) -> str:
    existing = resolve_target_exe(install_dir)
    if existing:
        return existing
    if install_dir:
        return os.path.join(os.path.abspath(install_dir), MAIN_APP_EXE_CANDIDATES[0])
    return ""


def resolve_install_dir() -> str:
    parent_exe = _parent_process_exe_path()
    if parent_exe:
        parent_name = os.path.basename(parent_exe)
        parent_dir = os.path.dirname(parent_exe)
        parent_is_main = parent_name in MAIN_APP_EXE_CANDIDATES
        if parent_dir and os.path.isdir(parent_dir) and not _is_server_only_dir(parent_dir):
            if parent_is_main or resolve_target_exe(parent_dir):
                return parent_dir

    start = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))
    current = start
    for _ in range(4):
        if resolve_target_exe(current):
            return current
        if _is_server_only_dir(current):
            parent = os.path.dirname(current)
            if parent != current:
                current = parent
                continue
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent

    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        if (
            exe_dir
            and os.path.isdir(exe_dir)
            and not _is_server_only_dir(exe_dir)
            and resolve_target_exe(exe_dir)
        ):
            return exe_dir

    from_registry = _read_install_dir_from_registry()
    if from_registry and not _is_server_only_dir(from_registry) and resolve_target_exe(from_registry):
        return from_registry

    base = (
        os.environ.get("LOCALAPPDATA")
        or os.environ.get("APPDATA")
        or tempfile.gettempdir()
    )
    base = os.path.abspath(os.path.expandvars(base))
    zh_dir = os.path.join(base, "生图提示词管理器")
    if os.path.isdir(zh_dir) and not _is_server_only_dir(zh_dir) and resolve_target_exe(zh_dir):
        return zh_dir
    en_dir = os.path.join(base, "PromptImageManager")
    if os.path.isdir(en_dir) and not _is_server_only_dir(en_dir) and resolve_target_exe(en_dir):
        return en_dir
    # 无主 exe 时不猜测安装根，避免 /D= 装到无关目录
    return ""


def build_relaunch_helper_script_text() -> str:
    return RELAUNCH_HELPER_SCRIPT


def write_relaunch_helper_script(directory: str | None = None) -> str:
    directory = directory or tempfile.gettempdir()
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(
        directory,
        f"prompt-image-update-relaunch-{uuid.uuid4().hex[:8]}.ps1",
    )
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(RELAUNCH_HELPER_SCRIPT)
    return path


def spawn_relaunch_helper(
    installer_pid: int,
    target_exe: str,
    expected_version: str | None = None,
    *,
    timeout_sec: int = HELPER_DEFAULT_TIMEOUT_SEC,
    settle_sec: int = HELPER_SETTLE_SEC,
    script_path: str | None = None,
) -> dict[str, Any]:
    helper_script = script_path or write_relaunch_helper_script()
    args = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        helper_script,
        "-InstallerPid",
        str(int(installer_pid)),
        "-TargetExe",
        str(target_exe),
        "-ExpectedVersion",
        str(expected_version or ""),
        "-TimeoutSec",
        str(int(timeout_sec)),
        "-SettleSec",
        str(int(settle_sec)),
    ]
    creationflags = _HELPER_CREATIONFLAGS if os.name == "nt" else 0
    try:
        subprocess.Popen(
            args,
            close_fds=True,
            creationflags=creationflags,
            cwd=os.path.dirname(helper_script) or None,
        )
    except Exception:
        _remove_file_quiet(helper_script)
        raise
    return {"success": True, "helperPath": helper_script}


def kill_main_app_for_install() -> None:
    """按镜像名结束主程序；不带 /T，避免杀掉作为子进程的 Sidecar。"""
    if os.name != "nt":
        return
    for image_name in MAIN_APP_EXE_CANDIDATES:
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", image_name],
                capture_output=True,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=False,
            )
        except Exception:
            pass


def _append_update_log(message: str) -> None:
    try:
        log_path = os.path.join(tempfile.gettempdir(), "prompt-image-update.log")
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(log_path, "a", encoding="utf-8") as handle:
            handle.write(f"[{stamp}] {message}\n")
    except Exception:
        pass


def run_installer(
    installer_path: str,
    *,
    expected_version: str | None = None,
) -> dict[str, Any]:
    path = (installer_path or "").strip()
    if not path or not os.path.isfile(path):
        raise FileNotFoundError("安装包不存在")

    auto_restart = _should_auto_restart()
    install_dir = resolve_install_dir() if auto_restart else ""
    target_exe = resolve_target_exe(install_dir) if install_dir else ""
    helper_target_exe = _expected_target_exe(install_dir) if install_dir else ""
    # 仅当安装根可信（目录内已有主 exe 且不是 server 旁路）才传 /D=
    use_custom_dir = bool(install_dir) and bool(target_exe) and not _is_server_only_dir(install_dir)

    cmd = [path, "/S"]
    if use_custom_dir:
        cmd.append(f"/D={install_dir}")

    creationflags = 0
    popen_arg: str | list[str] = cmd
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        # NSIS /D= 必须是最后一段且不带引号（即使路径含空格），list2cmdline 会加引号导致失效
        popen_arg = subprocess.list2cmdline([path, "/S"])
        if use_custom_dir:
            popen_arg = f"{popen_arg} /D={install_dir}"

    # 禁止在 Popen 之前 taskkill 主程序：Tauri Exit 会连带杀掉本 Sidecar，导致安装器/helper 未拉起
    proc = subprocess.Popen(
        popen_arg,
        cwd=os.path.dirname(path) or None,
        close_fds=True,
        creationflags=creationflags,
        shell=False,
    )
    time.sleep(0.8)

    helper_spawned = False
    if auto_restart:
        try:
            spawn_relaunch_helper(
                getattr(proc, "pid", 0),
                helper_target_exe,
                expected_version,
            )
            helper_spawned = True
        except Exception:
            helper_spawned = False

    result = {
        "success": True,
        "message": "installer launched",
        "installerPid": getattr(proc, "pid", None),
        "installDir": install_dir if use_custom_dir else (install_dir or ""),
        "targetExe": target_exe,
        "helperTargetExe": helper_target_exe,
        "helperSpawned": helper_spawned,
        "autoRestart": auto_restart,
    }
    _append_update_log(
        "run_installer "
        + json.dumps(
            {
                "expectedVersion": expected_version,
                "installDir": install_dir,
                "useCustomDir": use_custom_dir,
                "targetExe": target_exe,
                "helperTargetExe": helper_target_exe,
                "cmd": popen_arg if isinstance(popen_arg, str) else list(popen_arg),
                **{k: result[k] for k in ("installerPid", "helperSpawned", "autoRestart")},
            },
            ensure_ascii=False,
        )
    )
    return result


def exit_app_after_install() -> None:
    os._exit(0)

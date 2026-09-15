import hashlib
import http.server
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python"))

from auto_update import (
    DownloadCancelled,
    _download_url_candidates,
    _friendly_network_error,
    _meta_candidate_urls,
    cancel_download_job,
    download_installer,
    fetch_latest_meta,
    get_download_job,
    is_remote_newer,
    parse_version_tuple,
    read_local_app_version,
    reset_download_jobs_for_tests,
    start_download_job,
)


@pytest.fixture(autouse=True)
def _reset_jobs():
    reset_download_jobs_for_tests()
    yield
    reset_download_jobs_for_tests()


def test_parse_version_tuple():
    assert parse_version_tuple("2.5.2") == (2, 5, 2)
    assert parse_version_tuple("v2.10.0") == (2, 10, 0)
    assert parse_version_tuple("") == (0,)


def test_is_remote_newer():
    assert is_remote_newer("2.6.0", "2.5.2") is True
    assert is_remote_newer("2.5.2", "2.5.2") is False
    assert is_remote_newer("2.4.9", "2.5.2") is False
    assert is_remote_newer("10.0.0", "9.9.9") is True


def test_read_local_app_version_from_src_index():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    frontend = os.path.join(root, "src")
    version = read_local_app_version(frontend)
    assert version and version[0].isdigit()


PAYLOAD_BYTES = 1024 * 64


class _Handler(http.server.BaseHTTPRequestHandler):
    payload = b"x" * PAYLOAD_BYTES
    delay = 0.0
    chunk = 16 * 1024
    served = 0

    def log_message(self, format, *args):
        return

    def do_GET(self):
        type(self).served = 0
        total = len(self.payload)
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(total))
        self.end_headers()
        offset = 0
        while offset < total:
            if type(self).delay:
                time.sleep(type(self).delay)
            end = min(offset + type(self).chunk, total)
            self.wfile.write(self.payload[offset:end])
            offset = end
            type(self).served = offset


@pytest.fixture
def local_server():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    yield f"http://127.0.0.1:{port}/PromptImageManager-Setup.exe"
    server.shutdown()
    server.server_close()


def test_download_installer_happy_path(local_server, tmp_path):
    digest = hashlib.sha256(_Handler.payload).hexdigest()
    dest = tmp_path / "setup.exe"
    progress = []
    result = download_installer(
        local_server,
        digest,
        dest_path=str(dest),
        on_progress=lambda p: progress.append(p),
    )
    assert result["success"] is True
    assert result["path"] == str(dest)
    assert result["size"] == len(_Handler.payload)
    assert dest.is_file()
    assert any(p["phase"] == "downloading" for p in progress)
    assert progress[-1]["phase"] == "ready"


def test_download_installer_sha_mismatch_fails_and_removes(tmp_path):
    # 用本地文件路径模拟失败：直接调用校验逻辑需要网络，改为短 URL + 错误哈希
    class _OneShot(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            return

        def do_GET(self):
            body = b"hello-update"
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _OneShot)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/a.exe"
    dest = tmp_path / "bad.exe"
    try:
        with pytest.raises(ValueError, match="校验失败"):
            download_installer(url, "0" * 64, dest_path=str(dest))
        assert not dest.exists()
    finally:
        server.shutdown()
        server.server_close()


def test_start_download_job_ready(local_server):
    digest = hashlib.sha256(_Handler.payload).hexdigest()
    _Handler.delay = 0
    started = start_download_job(local_server, digest)
    job_id = started["jobId"]
    deadline = time.time() + 10
    payload = None
    while time.time() < deadline:
        payload = get_download_job(job_id)
        if payload["phase"] in {"ready", "failed", "cancelled"}:
            break
        time.sleep(0.05)
    assert payload is not None
    assert payload["phase"] == "ready"
    assert payload["percent"] == 100
    assert payload["path"]
    assert os.path.isfile(payload["path"])


def test_cancel_download_job(local_server):
    digest = hashlib.sha256(_Handler.payload).hexdigest()
    _Handler.delay = 0.05
    _Handler.chunk = 4096
    try:
        started = start_download_job(local_server, digest)
        job_id = started["jobId"]
        deadline = time.time() + 5
        while time.time() < deadline:
            state = get_download_job(job_id)
            if state["phase"] == "downloading":
                # 记录可能的临时路径（ready 前 path 为空，用 should_cancel 同步用例断言删除）
                break
            time.sleep(0.02)
        cancel_download_job(job_id)
        deadline = time.time() + 10
        payload = None
        while time.time() < deadline:
            payload = get_download_job(job_id)
            if payload["phase"] in {"ready", "failed", "cancelled"}:
                break
            time.sleep(0.05)
        assert payload is not None
        assert payload["phase"] == "cancelled"
        assert payload["path"] == ""
    finally:
        _Handler.delay = 0
        _Handler.chunk = 16 * 1024


def test_download_installer_should_cancel_callback(tmp_path):
    cancel_after = {"n": 0}

    class _Slow(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            return

        def do_GET(self):
            body = b"z" * (64 * 1024)
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Slow)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/b.exe"
    dest = tmp_path / "c.exe"

    def should_cancel():
        cancel_after["n"] += 1
        return cancel_after["n"] >= 2

    try:
        with pytest.raises(DownloadCancelled):
            download_installer(
                url,
                hashlib.sha256(b"z" * (64 * 1024)).hexdigest(),
                dest_path=str(dest),
                should_cancel=should_cancel,
            )
        assert not dest.exists()
    finally:
        server.shutdown()
        server.server_close()


def test_get_download_job_unknown():
    with pytest.raises(KeyError):
        get_download_job("missing-job")


def test_meta_candidate_urls_default_order():
    urls = _meta_candidate_urls(None)
    assert urls[0].startswith("https://github.com/")
    assert any("ghproxy.net" in u for u in urls)
    assert any("jsdelivr" in u for u in urls)
    assert _meta_candidate_urls("https://example.com/latest.json") == ["https://example.com/latest.json"]


def test_download_url_candidates_github_mirror():
    candidates = _download_url_candidates(
        "https://github.com/LKC218/prompt-image-tool/releases/download/v2.5.5/a.exe"
    )
    assert candidates[0].startswith("https://github.com/")
    assert any(c.startswith("https://ghproxy.net/") for c in candidates)
    assert len(candidates) == len(set(candidates))


def test_friendly_network_error_ssl():
    msg = _friendly_network_error(
        Exception("<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred>")
    )
    assert "SSL" in msg
    assert "重试" in msg


def test_fetch_latest_meta_fallback_when_direct_fails(monkeypatch):
    payload = json.dumps({
        "version": "2.5.5",
        "url": "https://example.com/a.exe",
        "sha256": "ab" * 32,
    }).encode("utf-8")
    calls = []

    def fake_http_get(url, timeout=15):
        calls.append(url)
        if "github.com" in url and "ghproxy" not in url:
            raise urllib.error.URLError("[SSL: UNEXPECTED_EOF_WHILE_READING]")
        return payload

    monkeypatch.setattr("auto_update._http_get_bytes", fake_http_get)
    meta = fetch_latest_meta()
    assert meta["version"] == "2.5.5"
    assert len(calls) >= 2


def test_fetch_latest_meta_all_fail_raises_friendly(monkeypatch):
    def fake_http_get(url, timeout=15):
        raise urllib.error.URLError("[SSL: UNEXPECTED_EOF_WHILE_READING] EOF")

    monkeypatch.setattr("auto_update._http_get_bytes", fake_http_get)
    with pytest.raises(RuntimeError) as exc:
        fetch_latest_meta()
    assert "SSL" in str(exc.value)

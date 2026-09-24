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

import auto_update
from auto_update import (
    APP_EXE_NAME,
    MAIN_APP_EXE_CANDIDATES,
    resolve_target_exe,
    run_uninstall_existing,
    DownloadCancelled,
    _download_url_candidates,
    _friendly_network_error,
    _meta_candidate_urls,
    build_relaunch_helper_script_text,
    cancel_download_job,
    download_installer,
    fetch_latest_meta,
    get_download_job,
    is_remote_newer,
    kill_main_app_for_install,
    parse_version_tuple,
    read_local_app_version,
    reset_download_jobs_for_tests,
    resolve_install_dir,
    resolve_target_exe,
    run_installer,
    spawn_relaunch_helper,
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


def test_read_local_app_version_reads_upto_8000(tmp_path):
    html = (
        "<!doctype html><html><head>"
        + ("<!-- pad -->" * 400)
        + '<meta name="version" content="9.9.9-test"></head><body></body></html>'
    )
    index = tmp_path / "index.html"
    index.write_text(html, encoding="utf-8")
    assert read_local_app_version(str(tmp_path)) == "9.9.9-test"


def test_run_installer_windows_dd_unquoted(monkeypatch, tmp_path):
    setup = tmp_path / "PromptImageManager-Setup.exe"
    setup.write_bytes(b"mz")
    install_dir = tmp_path / "App Local" / "PromptImageManager"
    install_dir.mkdir(parents=True)
    (install_dir / APP_EXE_NAME).write_bytes(b"stub")

    monkeypatch.setattr("auto_update._should_auto_restart", lambda: True)
    monkeypatch.setattr("auto_update.resolve_install_dir", lambda: str(install_dir))
    monkeypatch.setattr("auto_update.time.sleep", lambda *_: None)
    monkeypatch.setattr("auto_update.os.name", "nt")

    seen = {}
    killed_before_popen = []

    class _Proc:
        pid = 1

    def fake_run(cmd, **kwargs):
        killed_before_popen.append(list(cmd))
        return None

    def fake_popen(cmd, **kwargs):
        seen["cmd"] = cmd
        seen["kwargs"] = kwargs
        return _Proc()

    monkeypatch.setattr("auto_update.subprocess.run", fake_run)
    monkeypatch.setattr("auto_update.subprocess.Popen", fake_popen)
    monkeypatch.setattr("auto_update.spawn_relaunch_helper", lambda *a, **k: {"success": True})

    run_installer(str(setup), expected_version="1.0.0")
    cmdline = seen["cmd"]
    assert isinstance(cmdline, str)
    assert "/S" in cmdline
    assert cmdline.rstrip().endswith(f"/D={install_dir}")
    assert f'"/D=' not in cmdline
    assert f"' /D=" not in cmdline
    # Popen 前不得 taskkill（避免 Tauri Exit 自杀竞态）
    assert killed_before_popen == []


def test_run_installer_untrusted_dir_omits_dd(monkeypatch, tmp_path):
    setup = tmp_path / "setup.exe"
    setup.write_bytes(b"mz")
    empty_dir = tmp_path / "EmptyNoMainExe"
    empty_dir.mkdir()

    monkeypatch.setattr("auto_update._should_auto_restart", lambda: True)
    monkeypatch.setattr("auto_update.resolve_install_dir", lambda: str(empty_dir))
    monkeypatch.setattr("auto_update.time.sleep", lambda *_: None)

    seen = {}

    class _Proc:
        pid = 3

    def fake_popen(cmd, **kwargs):
        seen["cmd"] = cmd
        return _Proc()

    monkeypatch.setattr("auto_update.subprocess.Popen", fake_popen)
    monkeypatch.setattr("auto_update.spawn_relaunch_helper", lambda *a, **k: {"success": True})
    result = run_installer(str(setup))
    cmdline = seen["cmd"]
    assert isinstance(cmdline, str)
    assert "/S" in cmdline
    assert "/D=" not in cmdline
    assert result["targetExe"] == ""


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
    assert any("t=" in u for u in urls if "jsdelivr" in u)
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


def test_resolve_target_exe_prefers_chinese_name(tmp_path):
    zh = tmp_path / MAIN_APP_EXE_CANDIDATES[0]
    en = tmp_path / APP_EXE_NAME
    en.write_bytes(b"en")
    assert resolve_target_exe(str(tmp_path)) == str(en.resolve()) or resolve_target_exe(
        str(tmp_path)
    ) == os.path.abspath(str(en))
    zh.write_bytes(b"zh")
    assert resolve_target_exe(str(tmp_path)) == os.path.abspath(str(zh))


def test_resolve_target_exe_empty_when_missing(tmp_path):
    assert resolve_target_exe(str(tmp_path)) == ""


def test_resolve_target_exe_finds_app_exe(tmp_path):
    app = tmp_path / "app.exe"
    app.write_bytes(b"stub")
    assert resolve_target_exe(str(tmp_path)) == os.path.abspath(str(app))


def test_run_uninstall_existing_missing_uninstaller(tmp_path):
    result = run_uninstall_existing(str(tmp_path))
    assert result["attempted"] is False


def test_resolve_install_dir_prefers_parent_tauri_root(monkeypatch, tmp_path):
    install_dir = tmp_path / "TauriApp"
    install_dir.mkdir()
    main_exe = install_dir / MAIN_APP_EXE_CANDIDATES[0]
    main_exe.write_bytes(b"stub")
    parent_exe = install_dir / MAIN_APP_EXE_CANDIDATES[0]

    monkeypatch.setattr("auto_update._parent_process_exe_path", lambda: str(parent_exe))
    assert resolve_install_dir() == str(install_dir)


def test_resolve_install_dir_skips_server_only_sidecar_dir(monkeypatch, tmp_path):
    install_dir = tmp_path / "AppRoot"
    install_dir.mkdir()
    main_exe = install_dir / APP_EXE_NAME
    main_exe.write_bytes(b"main")
    server_dir = install_dir / "server"
    server_dir.mkdir()
    (server_dir / "PromptImageManager-Server.exe").write_bytes(b"srv")

    monkeypatch.setattr("auto_update._parent_process_exe_path", lambda: None)
    monkeypatch.setattr("auto_update.sys.frozen", True, raising=False)
    monkeypatch.setattr("auto_update.sys.executable", str(server_dir / "PromptImageManager-Server.exe"))
    monkeypatch.setattr("auto_update._read_install_dir_from_registry", lambda: None)
    assert resolve_install_dir() == str(install_dir)


def test_resolve_install_dir_prefers_frozen_exe_dir(monkeypatch, tmp_path):
    install_dir = tmp_path / "PromptImageManager"
    install_dir.mkdir()
    exe = install_dir / "PromptImageManager.exe"
    exe.write_bytes(b"stub")

    monkeypatch.setattr("auto_update._parent_process_exe_path", lambda: None)
    monkeypatch.setattr("auto_update.sys.frozen", True, raising=False)
    monkeypatch.setattr("auto_update.sys.executable", str(exe))
    assert resolve_install_dir() == str(install_dir)


def test_resolve_install_dir_fallback_requires_main_exe(monkeypatch, tmp_path):
    monkeypatch.setattr("auto_update._parent_process_exe_path", lambda: None)
    monkeypatch.setattr("auto_update.sys.frozen", False, raising=False)
    monkeypatch.setattr("auto_update._read_install_dir_from_registry", lambda: None)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    assert resolve_install_dir() == ""

    en_dir = tmp_path / "PromptImageManager"
    en_dir.mkdir()
    (en_dir / APP_EXE_NAME).write_bytes(b"stub")
    assert resolve_install_dir() == str(en_dir)


def test_resolve_install_dir_prefers_registry_over_local_appdata(monkeypatch, tmp_path):
    reg_dir = tmp_path / "FromRegistry"
    reg_dir.mkdir()
    (reg_dir / APP_EXE_NAME).write_bytes(b"stub")
    monkeypatch.setattr("auto_update._parent_process_exe_path", lambda: None)
    monkeypatch.setattr("auto_update.sys.frozen", False, raising=False)
    monkeypatch.setattr(
        "auto_update._read_install_dir_from_registry",
        lambda: str(reg_dir),
    )
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "LocalAppData"))
    assert resolve_install_dir() == str(reg_dir)


def test_build_relaunch_helper_script_contains_contract():
    text = build_relaunch_helper_script_text()
    assert "InstallerPid" in text
    assert "TargetExe" in text
    assert "ExpectedVersion" in text
    assert "SettleSec" in text
    assert "Start-Process" in text
    assert "frontend\\index.html" in text or "frontend/index.html" in text
    assert "_internal" in text
    # 软校验：禁止因 meta 不一致直接 exit 0 拒绝重启；mismatch 须写日志
    assert "if ($readAny -and -not $matched) { exit 0 }" not in text
    assert "soft version mismatch" in text


def test_run_installer_dev_skips_helper(monkeypatch, tmp_path):
    setup = tmp_path / "PromptImageManager-Setup.exe"
    setup.write_bytes(b"mz")
    monkeypatch.setattr("auto_update._should_auto_restart", lambda: False)
    monkeypatch.setattr("auto_update.time.sleep", lambda *_: None)

    calls = []

    class _Proc:
        pid = 4242

    def fake_popen(cmd, **kwargs):
        calls.append({"cmd": cmd, "kwargs": kwargs})
        return _Proc()

    monkeypatch.setattr("auto_update.subprocess.Popen", fake_popen)
    result = run_installer(str(setup), expected_version="2.5.9")
    assert result["success"] is True
    assert result["autoRestart"] is False
    assert result["helperSpawned"] is False
    assert result["installDir"] == ""
    arg = calls[0]["cmd"]
    if isinstance(arg, str):
        assert str(setup) in arg
        assert "/S" in arg
        assert "/D=" not in arg
    else:
        assert arg[0] == str(setup)
        assert "/S" in arg
        assert not any(str(item).startswith("/D=") for item in arg)
    assert len(calls) == 1


def test_run_installer_frozen_windows_spawns_helper(monkeypatch, tmp_path):
    setup = tmp_path / "PromptImageManager-Setup-2.5.9.exe"
    setup.write_bytes(b"mz")
    install_dir = tmp_path / "AppLocal" / "PromptImageManager"
    install_dir.mkdir(parents=True)
    target_exe = install_dir / APP_EXE_NAME
    target_exe.write_bytes(b"stub")

    monkeypatch.setattr("auto_update._should_auto_restart", lambda: True)
    monkeypatch.setattr("auto_update.resolve_install_dir", lambda: str(install_dir))
    monkeypatch.setattr("auto_update.time.sleep", lambda *_: None)

    calls = []

    class _Proc:
        pid = 9911

    def fake_popen(cmd, **kwargs):
        calls.append({"cmd": cmd, "kwargs": kwargs})
        return _Proc()

    monkeypatch.setattr("auto_update.subprocess.Popen", fake_popen)
    result = run_installer(str(setup), expected_version="2.5.9")
    assert result["success"] is True
    assert result["autoRestart"] is True
    assert result["helperSpawned"] is True
    assert result["installDir"] == str(install_dir)
    assert result["targetExe"] == str(target_exe)
    assert result["installerPid"] == 9911

    installer_cmd = calls[0]["cmd"]
    if isinstance(installer_cmd, str):
        assert str(setup) in installer_cmd
        assert "/S" in installer_cmd
        assert installer_cmd.rstrip().endswith(f"/D={install_dir}")
        assert f'"/D=' not in installer_cmd
        assert f" /D={install_dir}" in installer_cmd
    else:
        assert installer_cmd[0] == str(setup)
        assert "/S" in installer_cmd
        assert f"/D={install_dir}" in installer_cmd

    helper_cmd = calls[1]["cmd"]
    assert helper_cmd[0] == "powershell"
    assert "-InstallerPid" in helper_cmd
    assert "9911" in helper_cmd
    assert str(target_exe) in helper_cmd
    assert "2.5.9" in helper_cmd
    assert calls[1]["kwargs"].get("close_fds") is True


def test_run_installer_helper_failure_still_succeeds(monkeypatch, tmp_path):
    setup = tmp_path / "setup.exe"
    setup.write_bytes(b"mz")
    install_dir = tmp_path / "inst"
    install_dir.mkdir()

    monkeypatch.setattr("auto_update._should_auto_restart", lambda: True)
    monkeypatch.setattr("auto_update.resolve_install_dir", lambda: str(install_dir))
    monkeypatch.setattr("auto_update.time.sleep", lambda *_: None)

    class _Proc:
        pid = 7

    monkeypatch.setattr(
        "auto_update.subprocess.Popen",
        lambda *args, **kwargs: _Proc(),
    )

    def boom(*_args, **_kwargs):
        raise RuntimeError("helper blocked")

    monkeypatch.setattr("auto_update.spawn_relaunch_helper", boom)
    result = run_installer(str(setup))
    assert result["success"] is True
    assert result["autoRestart"] is True
    assert result["helperSpawned"] is False


def test_spawn_relaunch_helper_invokes_powershell(monkeypatch, tmp_path):
    script = tmp_path / "helper.ps1"
    script.write_text("# helper", encoding="utf-8")
    seen = {}

    class _Proc:
        pid = 55

    def fake_popen(cmd, **kwargs):
        seen["cmd"] = list(cmd)
        seen["kwargs"] = kwargs
        return _Proc()

    monkeypatch.setattr("auto_update.subprocess.Popen", fake_popen)
    result = spawn_relaunch_helper(
        55,
        r"C:\Apps\PromptImageManager\PromptImageManager.exe",
        "2.5.9",
        script_path=str(script),
    )
    assert result["success"] is True
    assert result["helperPath"] == str(script)
    assert seen["cmd"][0] == "powershell"
    assert str(script) in seen["cmd"]
    assert "2.5.9" in seen["cmd"]
    assert "-SettleSec" in seen["cmd"]
    settle_idx = seen["cmd"].index("-SettleSec")
    assert seen["cmd"][settle_idx + 1] == "3"
    assert seen["kwargs"].get("close_fds") is True
    if os.name == "nt":
        assert seen["kwargs"].get("creationflags") == auto_update._HELPER_CREATIONFLAGS


def test_spawn_relaunch_helper_cleans_script_on_popen_failure(monkeypatch, tmp_path):
    script = tmp_path / "helper-fail.ps1"
    script.write_text("# helper", encoding="utf-8")

    def boom(*_args, **_kwargs):
        raise RuntimeError("popen failed")

    monkeypatch.setattr("auto_update.subprocess.Popen", boom)
    with pytest.raises(RuntimeError):
        spawn_relaunch_helper(1, r"C:\x\PromptImageManager.exe", script_path=str(script))
    assert not script.exists()


def test_kill_main_app_for_install_calls_taskkill(monkeypatch):
    seen = []

    def fake_run(cmd, **kwargs):
        seen.append({"cmd": list(cmd), "kwargs": kwargs})
        return None

    monkeypatch.setattr("auto_update.subprocess.run", fake_run)
    kill_main_app_for_install()
    if os.name == "nt":
        assert seen, "taskkill should be invoked on nt"
        for item in seen:
            assert item["cmd"][0] == "taskkill"
            assert "/T" not in item["cmd"]
            assert item["cmd"][-1] in MAIN_APP_EXE_CANDIDATES
        assert any(APP_EXE_NAME in item["cmd"] for item in seen)
    else:
        assert seen == []

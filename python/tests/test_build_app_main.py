import importlib.util
import json
import os
import http.server
import socketserver
import threading
import urllib.error
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
BUILD_APP_MAIN = ROOT_DIR / "build" / "app_main.py"


def load_build_app_main():
    spec = importlib.util.spec_from_file_location("build_app_main_under_test", BUILD_APP_MAIN)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure_temp_data(module, monkeypatch, tmp_path):
    monkeypatch.setattr(module, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(module, "IMAGES_DIR", str(tmp_path / "images"))
    monkeypatch.setattr(module, "BACKUPS_DIR", str(tmp_path / "backups"))
    monkeypatch.setattr(module, "DATA_FILE", str(tmp_path / "prompt_sets.json"))
    monkeypatch.setattr(module, "FOLDERS_FILE", str(tmp_path / "folders.json"))
    monkeypatch.setattr(module, "SYNC_DEVICE_FILE", str(tmp_path / "sync-device.json"))
    module.ensure_dirs()


def start_test_server(module):
    server = module.ExclusiveThreadingTCPServer(("127.0.0.1", 0), module.AppHandler)
    module.SERVER_PORT = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def stop_test_server(server, thread):
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def request_json(url, data=None, method="GET", headers=None):
    body = None
    request_headers = dict(headers or {})
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, response.headers.get("Content-Type"), json.loads(response.read().decode("utf-8"))


def request_text(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return response.status, response.headers.get("Content-Type"), response.read().decode("utf-8")


def write_test_frontend(tmp_path, monkeypatch, module):
    frontend_dir = tmp_path / "frontend"
    assets_dir = frontend_dir / "assets"
    assets_dir.mkdir(parents=True)
    (frontend_dir / "index.html").write_text("<!doctype html><div id=\"pcApp\">ok</div>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok')", encoding="utf-8")
    monkeypatch.setattr(module, "FRONTEND_DIR", str(frontend_dir))
    return frontend_dir


def test_installer_backend_sync_capabilities_returns_json(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        status, content_type, body = request_json(f"{base_url}/api/sync/capabilities")

        assert status == 200
        assert "application/json" in content_type
        assert body["status"] == "ok"
        assert body["platform"] == "pc"
        assert body["port"] == server.server_address[1]
        assert "bidirectional" in body["capabilities"]
    finally:
        stop_test_server(server, thread)


def test_installer_backend_serves_frontend_without_directory_listing(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    write_test_frontend(tmp_path, monkeypatch, module)
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"

        status, content_type, root_body = request_text(f"{base_url}/")
        _, _, fallback_body = request_text(f"{base_url}/__pycache__/")
        _, js_type, js_body = request_text(f"{base_url}/assets/app.js")

        assert status == 200
        assert "text/html" in content_type
        assert "pcApp" in root_body
        assert "Directory listing" not in root_body
        assert "pcApp" in fallback_body
        assert "Directory listing" not in fallback_body
        assert "javascript" in js_type
        assert "console.log" in js_body
    finally:
        stop_test_server(server, thread)


def test_installer_backend_uses_fallback_port_when_8888_is_occupied(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    write_test_frontend(tmp_path, monkeypatch, module)
    occupied_server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), http.server.SimpleHTTPRequestHandler)
    occupied_thread = threading.Thread(target=occupied_server.serve_forever, daemon=True)
    occupied_thread.start()
    app_server = None
    try:
        occupied_port = occupied_server.server_address[1]
        app_server, app_port = module.create_http_server(occupied_port, 3)

        assert app_port != occupied_port
        assert occupied_port < app_port <= occupied_port + 2
        assert app_server.server_address[1] == app_port
    finally:
        if app_server:
            app_server.server_close()
        stop_test_server(occupied_server, occupied_thread)


def test_installer_backend_sync_import_requires_pairing_token(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    module.save_data([])
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        request = urllib.request.Request(
            f"{base_url}/api/sync/import",
            data=json.dumps({"payload": {"prompt_sets": []}}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            urllib.request.urlopen(request, timeout=5)
            assert False, "sync import without token should fail"
        except urllib.error.HTTPError as error:
            body = json.loads(error.read().decode("utf-8"))
            assert error.code == 401
            assert body["success"] is False
    finally:
        stop_test_server(server, thread)


def test_installer_backend_sync_import_with_pairing_token_writes_data(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    module.save_data([])
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        _, _, pairing = request_json(f"{base_url}/api/sync/pairing")
        payload = {
            "mode": "keep_pc",
            "payload": {
                "prompt_sets": [
                    {
                        "id": "android-set",
                        "name": "Android set",
                        "versions": [{"version": "v1", "prompt": "hello", "images": []}],
                    }
                ]
            },
        }

        status, _, body = request_json(
            f"{base_url}/api/sync/import",
            payload,
            "POST",
            {"X-Sync-Token": pairing["sync_token"], "X-Device-Name": "Android"},
        )

        assert status == 200
        assert body["success"] is True
        assert body["added"] == 1
        assert module.load_data()[0]["id"] == "android-set"
    finally:
        stop_test_server(server, thread)

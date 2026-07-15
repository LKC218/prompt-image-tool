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


def test_build_load_data_rejects_corrupt_file_without_overwriting(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    data_file = Path(module.DATA_FILE)
    data_file.write_text('{bad json', encoding='utf-8')

    try:
        module.load_data()
        assert False, "corrupt data file should be rejected"
    except module.DataFileError as error:
        assert "数据文件损坏" in str(error)

    assert data_file.read_text(encoding='utf-8') == '{bad json'


def test_build_save_data_keeps_last_good_backup(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    data_file = Path(module.DATA_FILE)

    first_data = [{"id": "1", "name": "旧数据", "versions": []}]
    second_data = [{"id": "2", "name": "新数据", "versions": []}]
    module.save_data(first_data)
    module.save_data(second_data)

    assert module.load_data() == second_data
    assert json.loads(Path(f"{data_file}.bak").read_text(encoding="utf-8")) == first_data


def test_build_get_data_dir_uses_default_user_root_for_source_run(tmp_path, monkeypatch):
    module = load_build_app_main()
    app_data = tmp_path / "AppData" / "Roaming"
    monkeypatch.delenv(module.DATA_DIR_ENV_VAR, raising=False)
    monkeypatch.setenv("APPDATA", str(app_data))
    monkeypatch.setattr(module.platform, "system", lambda: "Windows")
    monkeypatch.setattr(module, "get_app_dir", lambda: str(tmp_path / "Source"))
    monkeypatch.setattr(module.sys, "frozen", False, raising=False)

    expected_root = app_data / module.DATA_APP_NAME
    assert module.get_data_dir() == str(expected_root)
    assert (expected_root / "data" / "images").exists()
    assert (expected_root / "data" / "backups").exists()


def test_build_get_data_dir_uses_user_root_and_migrates_legacy_data(tmp_path, monkeypatch):
    module = load_build_app_main()
    install_dir = tmp_path / "Install"
    legacy_data = install_dir / "data"
    legacy_images = legacy_data / "images"
    legacy_backups = legacy_data / "backups"
    legacy_images.mkdir(parents=True)
    legacy_backups.mkdir(parents=True)
    (legacy_data / "prompt_sets.json").write_text('[{"id":"old"}]', encoding="utf-8")
    (legacy_data / "folders.json").write_text("[]", encoding="utf-8")
    (legacy_images / "img.png").write_bytes(b"img")
    (legacy_backups / "backup.json").write_text("{}", encoding="utf-8")

    user_root = tmp_path / "UserData"
    monkeypatch.setenv(module.DATA_DIR_ENV_VAR, str(user_root))
    monkeypatch.setattr(module.sys, "frozen", True, raising=False)
    monkeypatch.setattr(module.sys, "executable", str(install_dir / "PromptImageManager.exe"))

    assert module.get_data_dir() == str(user_root)
    assert (user_root / "data" / "prompt_sets.json").read_text(encoding="utf-8") == '[{"id":"old"}]'
    assert (user_root / "data" / "images" / "img.png").read_bytes() == b"img"
    marker = json.loads((user_root / "data" / "data-migration.json").read_text(encoding="utf-8"))
    assert marker["status"] == "copied"
    assert marker["copiedFiles"] >= 4


def test_build_migration_does_not_overwrite_existing_user_data(tmp_path):
    module = load_build_app_main()
    install_dir = tmp_path / "Install"
    legacy_data = install_dir / "data"
    legacy_data.mkdir(parents=True)
    (legacy_data / "prompt_sets.json").write_text('[{"id":"old"}]', encoding="utf-8")

    user_root = tmp_path / "UserData"
    target_data = user_root / "data"
    target_data.mkdir(parents=True)
    (target_data / "prompt_sets.json").write_text('[{"id":"current"}]', encoding="utf-8")

    result = module.migrate_legacy_data_if_needed(str(user_root), str(install_dir))

    assert result["status"] == "skipped-target-has-data"
    assert (target_data / "prompt_sets.json").read_text(encoding="utf-8") == '[{"id":"current"}]'
    marker = json.loads((target_data / "data-migration.json").read_text(encoding="utf-8"))
    assert marker["status"] == "skipped-target-has-data"


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


def test_installer_backend_image_download_file_saves_known_image(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    image_path = tmp_path / "images" / "preview.png"
    image_path.write_bytes(b"\x89PNG\r\ninstaller")
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        target_dir = tmp_path / "exports"
        status, _, body = request_json(
            f"{base_url}/api/image-download-file",
            {
                "sourceFile": "preview.png",
                "filename": "../installer-preview",
                "directory": str(target_dir),
                "saveMode": "custom",
            },
            "POST",
        )

        assert status == 200
        assert body["success"] is True
        assert body["filename"] == "installer-preview.png"
        assert os.path.exists(body["path"])
        assert Path(body["path"]).read_bytes() == b"\x89PNG\r\ninstaller"
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
        assert os.path.exists(body["backupPath"])
        assert module.load_data()[0]["id"] == "android-set"
    finally:
        stop_test_server(server, thread)


def test_installer_backend_sync_preview_reports_conflicts(tmp_path, monkeypatch):
    module = load_build_app_main()
    configure_temp_data(module, monkeypatch, tmp_path)
    module.save_data([{
        "id": "set1",
        "name": "PC 版本",
        "versions": [{"id": "v1", "version": "v1", "prompt": "pc", "images": []}],
    }])
    server, thread = start_test_server(module)
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        _, _, pairing = request_json(f"{base_url}/api/sync/pairing")
        status, _, body = request_json(
            f"{base_url}/api/sync/preview",
            {
                "mode": "keep_pc",
                "payload": {
                    "prompt_sets": [{
                        "id": "set1",
                        "name": "Android 版本",
                        "versions": [{"id": "v1", "version": "v1", "prompt": "android", "images": []}],
                    }]
                },
            },
            "POST",
            {"X-Sync-Token": pairing["sync_token"]},
        )

        assert status == 200
        assert body["summary"]["conflicts"] == 1
        assert body["items"][0]["type"] == "conflict"
        assert body["items"][0]["conflictKey"]
    finally:
        stop_test_server(server, thread)

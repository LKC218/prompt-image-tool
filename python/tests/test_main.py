import sys
import os
import json
import tempfile
import base64
import socketserver
import threading
import urllib.request
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import (
    load_data, save_data, save_folders, save_image, delete_image_file,
    ensure_dirs, AppHandler, APP_DIR, DATA_DIR, IMAGES_DIR, DATA_FILE,
    build_backup_payload, save_backup_file,
)


def start_test_server():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    server = socketserver.ThreadingTCPServer(('127.0.0.1', 0), AppHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def stop_test_server(server, thread):
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def request_json(url, data=None, method='GET'):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.loads(response.read().decode('utf-8'))


def request_json_with_headers(url, data=None, method='GET', headers=None):
    body = None
    request_headers = dict(headers or {})
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        request_headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.loads(response.read().decode('utf-8'))


class TestLoadSaveData:
    def test_load_data_no_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'nonexistent.json'))
        result = load_data()
        assert result == []

    def test_save_and_load(self, tmp_path, monkeypatch):
        data_file = str(tmp_path / 'test_data.json')
        monkeypatch.setattr('main.DATA_FILE', data_file)
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))

        test_data = [{'id': '1', 'name': 'test', 'versions': []}]
        save_data(test_data)
        result = load_data()
        assert result == test_data

    def test_save_data_creates_dirs(self, tmp_path, monkeypatch):
        data_file = str(tmp_path / 'sub' / 'data.json')
        monkeypatch.setattr('main.DATA_FILE', data_file)
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'sub' / 'images'))

        save_data([])
        assert os.path.exists(str(tmp_path / 'sub' / 'images'))

    def test_save_data_unicode(self, tmp_path, monkeypatch):
        data_file = str(tmp_path / 'unicode.json')
        monkeypatch.setattr('main.DATA_FILE', data_file)
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))

        test_data = [{'id': '1', 'name': '中文测试 🎨', 'versions': []}]
        save_data(test_data)
        result = load_data()
        assert result == test_data


class TestSaveImage:
    def test_save_png_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        data_url = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n').decode()
        filename = save_image('test123', data_url)
        assert filename == 'test123.png'
        assert os.path.exists(os.path.join(str(tmp_path), filename))

    def test_save_jpg_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        data_url = 'data:image/jpeg;base64,' + base64.b64encode(b'\xff\xd8\xff').decode()
        filename = save_image('test456', data_url)
        assert filename == 'test456.jpg'

    def test_save_webp_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        data_url = 'data:image/webp;base64,' + base64.b64encode(b'RIFF').decode()
        filename = save_image('test789', data_url)
        assert filename == 'test789.webp'

    def test_save_image_default_png(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        data_url = 'data:image/unknown;base64,' + base64.b64encode(b'test').decode()
        filename = save_image('test000', data_url)
        assert filename == 'test000.png'

    def test_save_image_invalid_data(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        filename = save_image('test', 'invalid-data-url')
        assert filename is None


class TestBackupExport:
    def test_build_backup_payload_contains_meta_folders_and_images(self, tmp_path, monkeypatch):
        data_file = str(tmp_path / 'prompt_sets.json')
        folders_file = str(tmp_path / 'folders.json')
        images_dir = str(tmp_path / 'images')
        monkeypatch.setattr('main.DATA_FILE', data_file)
        monkeypatch.setattr('main.FOLDERS_FILE', folders_file)
        monkeypatch.setattr('main.IMAGES_DIR', images_dir)
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))

        image_data = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n').decode()
        filename = save_image('img1', image_data)
        save_folders([{'id': 'folder1', 'name': '分类'}])
        save_data([{
            'id': 'set1',
            'name': '测试集合',
            'versions': [{
                'version': 'v1',
                'prompt': 'test',
                'images': [{'id': 'img1', 'file': filename}],
            }],
        }])

        payload = build_backup_payload()

        assert payload['backup_meta']['format'] == 'prompt-image-tool-backup'
        assert payload['backup_meta']['imageCount'] == 1
        assert payload['folders'][0]['id'] == 'folder1'
        image = payload['prompt_sets'][0]['versions'][0]['images'][0]
        assert image['data'].startswith('data:image/png;base64,')
        assert image['size'] > 0

    def test_save_backup_file_writes_json_to_backups_dir(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        save_data([{'id': 'set1', 'name': '测试集合', 'versions': []}])

        result = save_backup_file('../unsafe-name')

        assert result['success'] is True
        assert result['filename'] == 'unsafe-name.json'
        assert os.path.exists(result['path'])
        with open(result['path'], 'r', encoding='utf-8') as f:
            payload = json.load(f)
        assert payload['prompt_sets'][0]['id'] == 'set1'

    def test_get_api_export_returns_backup_json(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        save_data([{'id': 'set1', 'name': '测试集合', 'versions': []}])

        server, thread = start_test_server()
        try:
            url = f'http://127.0.0.1:{server.server_address[1]}/api/export'
            status, body = request_json(url)

            assert status == 200
            assert body['backup_meta']['format'] == 'prompt-image-tool-backup'
            assert body['prompt_sets'][0]['id'] == 'set1'
        finally:
            stop_test_server(server, thread)

    def test_sync_import_requires_pairing_token(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        monkeypatch.setattr('main.SYNC_DEVICE_FILE', str(tmp_path / 'sync-device.json'))
        save_data([])

        server, thread = start_test_server()
        try:
            base_url = f'http://127.0.0.1:{server.server_address[1]}'
            request = urllib.request.Request(
                f'{base_url}/api/sync/import',
                data=json.dumps({'payload': {'prompt_sets': []}}).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            try:
                urllib.request.urlopen(request, timeout=5)
                assert False, 'sync import without token should fail'
            except urllib.error.HTTPError as error:
                body = json.loads(error.read().decode('utf-8'))
                assert error.code == 401
                assert body['success'] is False
        finally:
            stop_test_server(server, thread)

    def test_sync_import_keep_pc_creates_conflict_copy(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        monkeypatch.setattr('main.SYNC_DEVICE_FILE', str(tmp_path / 'sync-device.json'))
        save_data([{
            'id': 'set1',
            'name': 'PC 版本',
            'createdAt': '2026-05-10T00:00:00',
            'updatedAt': '2026-05-10T00:00:00',
            'versions': [{'id': 'v1', 'version': 'v1', 'prompt': 'pc', 'images': []}],
        }])

        server, thread = start_test_server()
        try:
            base_url = f'http://127.0.0.1:{server.server_address[1]}'
            _, pairing = request_json(f'{base_url}/api/sync/pairing')
            payload = {
                'mode': 'keep_pc',
                'payload': {
                    'prompt_sets': [{
                        'id': 'set1',
                        'name': 'Android 版本',
                        'createdAt': '2026-05-10T00:00:00',
                        'updatedAt': '2026-05-10T01:00:00',
                        'versions': [{'id': 'v1', 'version': 'v1', 'prompt': 'android', 'images': []}],
                    }]
                }
            }

            status, result = request_json_with_headers(
                f'{base_url}/api/sync/import',
                payload,
                'POST',
                {'X-Sync-Token': pairing['sync_token']},
            )

            data = load_data()
            assert status == 200
            assert result['conflicts'] == 1
            assert result['added'] == 1
            assert len(data) == 2
            assert data[0]['name'] == 'PC 版本'
            assert data[1]['id'].startswith('set1-conflict-')
        finally:
            stop_test_server(server, thread)

    def test_sync_import_keep_pc_skips_same_content_with_generated_ids(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        monkeypatch.setattr('main.SYNC_DEVICE_FILE', str(tmp_path / 'sync-device.json'))
        save_data([{
            'id': 'set1',
            'name': 'PC 版本',
            'folderId': '',
            'tags': '[]',
            'isFavorite': False,
            'createdAt': '2026-05-10T00:00:00',
            'updatedAt': '2026-05-10T00:00:00',
            'versions': [{
                'version': 'v1',
                'prompt': 'same prompt',
                'negativePrompt': '',
                'note': '',
                'aspectRatio': '1:1',
                'stylePreset': '',
                'sampler': 'DPM++ 2M Karras',
                'steps': 30,
                'cfgScale': 7.0,
                'hrFix': True,
                'model': '',
                'images': [{'id': 'img-pc', 'file': 'img1.png', 'name': 'img1.png', 'path': '', 'note': ''}],
            }],
        }])

        server, thread = start_test_server()
        try:
            base_url = f'http://127.0.0.1:{server.server_address[1]}'
            _, pairing = request_json(f'{base_url}/api/sync/pairing')
            payload = {
                'mode': 'keep_pc',
                'payload': {
                    'prompt_sets': [{
                        'id': 'set1',
                        'name': 'PC 版本',
                        'folder_id': '',
                        'tags': '[]',
                        'is_favorite': False,
                        'created_at': '2026-05-10T00:00:00',
                        'updated_at': '2026-05-10T01:00:00',
                        'versions': [{
                            'id': 'set1_v0',
                            'version': 'v1',
                            'prompt': 'same prompt',
                            'negative_prompt': '',
                            'note': '',
                            'aspect_ratio': '1:1',
                            'style_preset': '',
                            'sampler': 'DPM++ 2M Karras',
                            'steps': 30,
                            'cfg_scale': 7.0,
                            'hr_fix': True,
                            'model': '',
                            'images': [{'id': 'img-android', 'file': 'img1.png', 'name': 'img1.png', 'path': '', 'note': '', 'data': 'data:image/png;base64,AA=='}],
                        }],
                    }]
                }
            }

            status, result = request_json_with_headers(
                f'{base_url}/api/sync/import',
                payload,
                'POST',
                {'X-Sync-Token': pairing['sync_token']},
            )

            assert status == 200
            assert result['added'] == 0
            assert result['conflicts'] == 0
            assert result['skipped'] == 1
            assert len(load_data()) == 1
        finally:
            stop_test_server(server, thread)

    def test_export_then_import_roundtrip_restores_images(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))

        image_data = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\nroundtrip').decode()
        filename = save_image('img-roundtrip', image_data)
        save_folders([{'id': 'folder1', 'name': '测试分类'}])
        save_data([{
            'id': 'set-roundtrip',
            'name': '导入导出闭环',
            'folderId': 'folder1',
            'tags': '["test"]',
            'createdAt': '2026-05-09T00:00:00',
            'updatedAt': '2026-05-09T00:00:00',
            'versions': [{
                'id': 'version1',
                'version': 'v1',
                'prompt': 'roundtrip prompt',
                'negativePrompt': '',
                'images': [{'id': 'img-roundtrip', 'file': filename, 'name': 'roundtrip.png'}],
                'note': '',
                'createdAt': '2026-05-09T00:00:00',
            }],
        }])

        server, thread = start_test_server()
        try:
            base_url = f'http://127.0.0.1:{server.server_address[1]}'
            export_status, backup = request_json(f'{base_url}/api/export')
            assert export_status == 200
            exported_image = backup['prompt_sets'][0]['versions'][0]['images'][0]
            assert exported_image['data'].startswith('data:image/png;base64,')

            save_data([])
            save_folders([])
            os.remove(os.path.join(str(tmp_path / 'images'), filename))

            import_status, import_result = request_json(f'{base_url}/api/import', backup, 'POST')
            assert import_status == 200
            assert import_result['imported'] == 1
            assert import_result['added'] == 1
            assert import_result['updated'] == 0
            assert import_result['imagesRestored'] == 1

            restored = load_data()
            assert restored[0]['id'] == 'set-roundtrip'
            assert restored[0]['versions'][0]['prompt'] == 'roundtrip prompt'
            restored_file = restored[0]['versions'][0]['images'][0]['file']
            assert os.path.exists(os.path.join(str(tmp_path / 'images'), restored_file))
            assert load_data()[0]['folderId'] == 'folder1'

            repeat_status, repeat_result = request_json(f'{base_url}/api/import', backup, 'POST')
            assert repeat_status == 200
            assert repeat_result['imported'] == 1
            assert repeat_result['added'] == 0
            assert repeat_result['updated'] == 1
            assert len(load_data()) == 1
        finally:
            stop_test_server(server, thread)

    def test_import_rejects_invalid_payload_without_writing_data(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'prompt_sets.json'))
        monkeypatch.setattr('main.FOLDERS_FILE', str(tmp_path / 'folders.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        monkeypatch.setattr('main.BACKUPS_DIR', str(tmp_path / 'backups'))
        save_data([])

        server, thread = start_test_server()
        try:
            url = f'http://127.0.0.1:{server.server_address[1]}/api/import'
            request = urllib.request.Request(
                url,
                data=json.dumps('invalid').encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            try:
                urllib.request.urlopen(request, timeout=5)
                assert False, 'invalid import payload should fail'
            except urllib.error.HTTPError as error:
                body = json.loads(error.read().decode('utf-8'))
                assert error.code == 400
                assert body['success'] is False

            assert load_data() == []
        finally:
            stop_test_server(server, thread)


class TestDeleteImage:
    def test_delete_existing_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        filepath = os.path.join(str(tmp_path), 'test.png')
        with open(filepath, 'w') as f:
            f.write('test')
        delete_image_file('test.png')
        assert not os.path.exists(filepath)

    def test_delete_nonexistent_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path))
        delete_image_file('nonexistent.png')

    def test_delete_empty_filename(self, tmp_path, monkeypatch):
        delete_image_file('')
        delete_image_file(None)


class TestAppHandler:
    def test_handle_get_prompt_sets_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'data.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        save_data([])
        data = load_data()
        assert data == []

    def test_handle_create_prompt_set(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'data.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        save_data([])
        data = load_data()
        assert len(data) == 0

    def test_handle_get_prompt_sets_with_data(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'data.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))

        test_data = [{
            'id': 'abc',
            'name': 'Test Set',
            'createdAt': '2025-01-01T00:00:00',
            'updatedAt': '2025-01-01T00:00:00',
            'versions': [
                {'version': 'v1', 'prompt': 'test prompt', 'negativePrompt': '', 'images': [], 'note': ''}
            ]
        }]
        save_data(test_data)
        data = load_data()
        assert len(data) == 1
        assert data[0]['name'] == 'Test Set'
        assert len(data[0]['versions']) == 1

    def test_handle_import_data(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'data.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))
        save_data([])

        existing = load_data()
        new_item = {
            'id': 'new1',
            'name': 'Imported Set',
            'createdAt': '2025-01-01T00:00:00',
            'updatedAt': '2025-01-01T00:00:00',
            'versions': [{'version': 'v1', 'prompt': '', 'negativePrompt': '', 'images': [], 'note': ''}]
        }
        existing.append(new_item)
        save_data(existing)

        data = load_data()
        assert len(data) == 1
        assert data[0]['id'] == 'new1'

    def test_handle_delete_prompt_set(self, tmp_path, monkeypatch):
        monkeypatch.setattr('main.DATA_FILE', str(tmp_path / 'data.json'))
        monkeypatch.setattr('main.IMAGES_DIR', str(tmp_path / 'images'))

        test_data = [
            {'id': '1', 'name': 'Set 1', 'versions': []},
            {'id': '2', 'name': 'Set 2', 'versions': []},
        ]
        save_data(test_data)

        data = load_data()
        data = [s for s in data if s['id'] != '1']
        save_data(data)

        result = load_data()
        assert len(result) == 1
        assert result[0]['id'] == '2'

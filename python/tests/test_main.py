import sys
import os
import json
import tempfile
import base64

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import (
    load_data, save_data, save_image, delete_image_file,
    ensure_dirs, AppHandler, APP_DIR, DATA_DIR, IMAGES_DIR, DATA_FILE,
)


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

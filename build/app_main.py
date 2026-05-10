import http.server
import json
import socketserver
import threading
import socket
import os
import sys
import urllib.parse
import uuid
import base64
import mimetypes
import platform
import time
from datetime import datetime

try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    import webbrowser
    HAS_WEBVIEW = False


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def get_frontend_dir():
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        frontend = os.path.join(base, 'frontend')
        if os.path.exists(frontend):
            return frontend
        return os.path.join(os.path.dirname(sys.executable), 'frontend')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')


def get_data_dir():
    app_dir = get_app_dir()
    test_dir = os.path.join(app_dir, 'data')
    try:
        os.makedirs(test_dir, exist_ok=True)
        test_file = os.path.join(test_dir, '.write_test')
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write('test')
        os.remove(test_file)
        return app_dir
    except (PermissionError, OSError):
        user_data = os.path.join(os.path.expanduser('~'), '.prompt-image-tool')
        os.makedirs(os.path.join(user_data, 'data', 'images'), exist_ok=True)
        return user_data


APP_DIR = get_data_dir()
DATA_DIR = os.path.join(APP_DIR, 'data')
IMAGES_DIR = os.path.join(DATA_DIR, 'images')
BACKUPS_DIR = os.path.join(DATA_DIR, 'backups')
DATA_FILE = os.path.join(DATA_DIR, 'prompt_sets.json')
FOLDERS_FILE = os.path.join(DATA_DIR, 'folders.json')
FRONTEND_DIR = get_frontend_dir()
SERVER_HOST = '127.0.0.1'
SERVER_PORT = 8888


def ensure_dirs():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(BACKUPS_DIR, exist_ok=True)


def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_data(data):
    ensure_dirs()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_folders():
    if os.path.exists(FOLDERS_FILE):
        try:
            with open(FOLDERS_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_folders(data):
    ensure_dirs()
    with open(FOLDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_image(image_id, data_url):
    ensure_dirs()
    try:
        header, encoded = data_url.split(',', 1)
        if 'image/png' in header:
            ext = '.png'
        elif 'image/jpeg' in header or 'image/jpg' in header:
            ext = '.jpg'
        elif 'image/webp' in header:
            ext = '.webp'
        elif 'image/gif' in header:
            ext = '.gif'
        else:
            ext = '.png'
        filename = image_id + ext
        filepath = os.path.join(IMAGES_DIR, filename)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))
        return filename
    except Exception as e:
        print(f"保存图片失败: {e}")
        return None


def delete_image_file(filename):
    if not filename:
        return
    filepath = os.path.join(IMAGES_DIR, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass


def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'


def get_image_content_type(filename):
    ext = os.path.splitext(filename or '')[1].lower()
    content_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
    }
    return content_types.get(ext, 'application/octet-stream')


def get_safe_image_path(filename):
    safe_name = os.path.basename(urllib.parse.unquote(filename or ''))
    if not safe_name:
        return None, ''
    return os.path.join(IMAGES_DIR, safe_name), safe_name


def image_file_to_data_url(filename):
    filepath, safe_name = get_safe_image_path(filename)
    if not filepath or not os.path.exists(filepath):
        return None, 0
    with open(filepath, 'rb') as f:
        content = f.read()
    encoded = base64.b64encode(content).decode('ascii')
    return f'data:{get_image_content_type(safe_name)};base64,{encoded}', len(content)


def restore_import_image(img):
    image = dict(img)
    data_url = image.pop('data', None)
    image.pop('size', None)
    image.pop('mimeType', None)
    if not data_url:
        return image, False

    filename = image.get('file') or image.get('name') or image.get('id') or str(uuid.uuid4())[:8]
    _, safe_name = get_safe_image_path(filename)
    if not os.path.splitext(safe_name)[1]:
        header = data_url.split(',', 1)[0]
        if 'image/jpeg' in header or 'image/jpg' in header:
            safe_name += '.jpg'
        elif 'image/webp' in header:
            safe_name += '.webp'
        elif 'image/gif' in header:
            safe_name += '.gif'
        else:
            safe_name += '.png'

    filepath = os.path.join(IMAGES_DIR, safe_name)
    try:
        _, encoded = data_url.split(',', 1)
        ensure_dirs()
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))
        image['file'] = safe_name
        return image, True
    except Exception as e:
        print(f"导入图片失败: {e}")
        return image, False


def build_backup_payload():
    prompt_sets = json.loads(json.dumps(load_data(), ensure_ascii=False))
    image_count = 0
    image_bytes = 0
    for prompt_set in prompt_sets:
        for version in prompt_set.get('versions', []):
            for image in version.get('images', []):
                if image.get('file'):
                    data_url, size = image_file_to_data_url(image.get('file'))
                    if data_url:
                        image['data'] = data_url
                        image['size'] = size
                        image['mimeType'] = get_image_content_type(image.get('file'))
                        image_count += 1
                        image_bytes += size

    return {
        'backup_meta': {
            'app': 'prompt-image-tool',
            'format': 'prompt-image-tool-backup',
            'version': 1,
            'createdAt': datetime.now().isoformat(),
            'imageCount': image_count,
            'imageBytes': image_bytes,
        },
        'folders': load_folders(),
        'prompt_sets': prompt_sets,
    }


def build_backup_filename(filename=None):
    raw = os.path.basename(str(filename or '').strip())
    if not raw:
        raw = f"prompt-backup-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}.json"
    for char in '<>:"/\\|?*':
        raw = raw.replace(char, '_')
    if not raw.lower().endswith('.json'):
        raw += '.json'
    return raw


def count_backup_versions(prompt_sets):
    return sum(len(item.get('versions', [])) for item in prompt_sets)


def save_backup_file(filename=None):
    ensure_dirs()
    payload = build_backup_payload()
    safe_name = build_backup_filename(filename)
    filepath = os.path.join(BACKUPS_DIR, safe_name)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    prompt_sets = payload.get('prompt_sets', [])
    return {
        'success': True,
        'filename': safe_name,
        'path': filepath,
        'directory': BACKUPS_DIR,
        'size': os.path.getsize(filepath),
        'promptSetCount': len(prompt_sets),
        'versionCount': count_backup_versions(prompt_sets),
        'imageCount': payload.get('backup_meta', {}).get('imageCount', 0),
    }


def normalize_import_payload(body):
    if isinstance(body, list):
        return [], body
    if isinstance(body, dict):
        prompt_sets = body.get('prompt_sets') or body.get('promptSets') or []
        folders = body.get('folders') or []
        return folders, prompt_sets
    return None, None


def prepare_import_prompt_set(item):
    prompt_set = dict(item)
    versions = []
    restored_images = 0
    for version in prompt_set.get('versions', []):
        version_copy = dict(version)
        images = []
        for image in version_copy.get('images', []):
            restored_image, restored = restore_import_image(image)
            images.append(restored_image)
            if restored:
                restored_images += 1
        version_copy['images'] = images
        versions.append(version_copy)
    prompt_set['versions'] = versions
    return prompt_set, restored_images


class AppHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self.send_json({'status': 'ok', 'dataDir': DATA_DIR, 'device_name': platform.node()})
        elif path == '/api/sync':
            self.handle_sync()
        elif path.startswith('/api/sync/images/'):
            filename = path.split('/api/sync/images/')[1]
            self.handle_sync_image(filename)
        elif path == '/api/network-info':
            self.handle_network_info()
        elif path == '/api/export':
            self.handle_export()
        elif path == '/api/folders':
            self.handle_get_folders()
        elif path == '/api/prompt-sets':
            self.handle_get_prompt_sets()
        elif path.startswith('/api/prompt-set/'):
            set_id = path.split('/api/prompt-set/')[1]
            self.handle_get_prompt_set(set_id)
        elif path.startswith('/api/images/'):
            filename = path.split('/api/images/')[1]
            self.serve_image('images/' + filename)
        elif path.startswith('/images/'):
            self.serve_image(path[1:])
        elif path.startswith('/assets/'):
            self.serve_frontend_file(path)
        elif path == '/' or path == '/index.html':
            self.serve_frontend_file('/index.html')
        else:
            self.serve_frontend_file('/index.html')

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/prompt-sets':
            self.handle_create_prompt_set()
        elif path == '/api/folders':
            self.handle_create_folder()
        elif path == '/api/folders/reorder':
            self.handle_reorder_folders()
        elif path.startswith('/api/folder/'):
            folder_id = path.split('/api/folder/')[1]
            self.handle_update_folder(folder_id)
        elif path.startswith('/api/prompt-set/'):
            parts = path.split('/api/prompt-set/')[1].split('/')
            set_id = parts[0]
            if len(parts) == 2:
                action = parts[1]
                if action == 'version':
                    self.handle_add_version(set_id)
                elif action == 'delete-version':
                    self.handle_delete_version(set_id)
                elif action == 'rename-version':
                    self.handle_rename_version(set_id)
                elif action == 'duplicate-version':
                    self.handle_duplicate_version(set_id)
                elif action == 'move':
                    self.handle_move_prompt_to_folder(set_id)
                elif action == 'toggle-favorite':
                    self.handle_toggle_favorite(set_id)
            else:
                self.handle_update_prompt_set(set_id)
        elif path == '/api/export':
            self.handle_export()
        elif path == '/api/export-file':
            self.handle_export_file()
        elif path == '/api/import':
            self.handle_import()
        elif path.startswith('/api/image/'):
            image_id = path.split('/api/image/')[1]
            self.handle_upload_image(image_id)
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/folder/'):
            folder_id = path.split('/api/folder/')[1]
            self.handle_delete_folder(folder_id)
        elif path.startswith('/api/prompt-set/'):
            set_id = path.split('/api/prompt-set/')[1]
            self.handle_delete_prompt_set(set_id)
        elif path.startswith('/api/image/'):
            parts = path.split('/api/image/')[1].split('/')
            image_file = parts[0]
            self.handle_delete_image(image_file)
        else:
            self.send_error(404)

    def read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        return json.loads(body.decode('utf-8'))

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_ok(self, message='ok'):
        self.send_json({'success': True, 'message': message})

    def send_error_json(self, message, status=400):
        self.send_json({'success': False, 'error': message}, status)

    def serve_frontend_file(self, path):
        decoded_path = urllib.parse.unquote(path.lstrip('/'))
        file_path = os.path.join(FRONTEND_DIR, decoded_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                mime_type = 'application/octet-stream'
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        else:
            index_path = os.path.join(FRONTEND_DIR, 'index.html')
            if os.path.exists(index_path):
                with open(index_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', len(content))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404)

    def handle_get_folders(self):
        folders = load_folders()
        self.send_json(folders)

    def handle_create_folder(self):
        body = self.read_body()
        now = datetime.now().isoformat()
        folder = {
            'id': str(uuid.uuid4())[:8],
            'name': body.get('name', '新文件夹'),
            'color': body.get('color', ''),
            'sortOrder': len(load_folders()),
            'createdAt': now,
            'updatedAt': now
        }
        folders = load_folders()
        folders.append(folder)
        save_folders(folders)
        self.send_json(folder)

    def handle_update_folder(self, folder_id):
        body = self.read_body()
        folders = load_folders()
        for f in folders:
            if f['id'] == folder_id:
                if 'name' in body:
                    f['name'] = body['name']
                if 'color' in body:
                    f['color'] = body['color']
                f['updatedAt'] = datetime.now().isoformat()
                save_folders(folders)
                self.send_ok()
                return
        self.send_error_json('未找到', 404)

    def handle_delete_folder(self, folder_id):
        folders = load_folders()
        folders = [f for f in folders if f['id'] != folder_id]
        save_folders(folders)
        data = load_data()
        for s in data:
            if s.get('folderId') == folder_id:
                s['folderId'] = None
        save_data(data)
        self.send_ok()

    def handle_reorder_folders(self):
        body = self.read_body()
        order = body.get('order', [])
        folders = load_folders()
        folder_map = {f['id']: f for f in folders}
        reordered = []
        for idx, fid in enumerate(order):
            if fid in folder_map:
                folder_map[fid]['sortOrder'] = idx
                reordered.append(folder_map[fid])
        for f in folders:
            if f['id'] not in order:
                f['sortOrder'] = len(reordered)
                reordered.append(f)
        save_folders(reordered)
        self.send_ok()

    def handle_move_prompt_to_folder(self, set_id):
        body = self.read_body()
        folder_id = body.get('folderId')
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                s['folderId'] = folder_id
                s['updatedAt'] = datetime.now().isoformat()
                save_data(data)
                self.send_ok()
                return
        self.send_error_json('未找到', 404)

    def handle_toggle_favorite(self, set_id):
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                current = s.get('isFavorite', False)
                s['isFavorite'] = not current
                s['updatedAt'] = datetime.now().isoformat()
                save_data(data)
                self.send_json({'id': set_id, 'isFavorite': s['isFavorite']})
                return
        self.send_error_json('未找到', 404)

    def handle_get_prompt_sets(self):
        data = load_data()
        summary = []
        for s in data:
            total_images = sum(len(v.get('images', [])) for v in s.get('versions', []))
            first_image = None
            for v in s.get('versions', []):
                images = v.get('images', [])
                if images:
                    first_image = images[0]
                    break
            summary.append({
                'id': s['id'],
                'name': s['name'],
                'folderId': s.get('folderId'),
                'tags': s.get('tags', '[]'),
                'isFavorite': s.get('isFavorite', False),
                'createdAt': s['createdAt'],
                'updatedAt': s['updatedAt'],
                'versionCount': len(s.get('versions', [])),
                'imageCount': total_images,
                'firstImage': first_image
            })
        self.send_json(summary)

    def handle_get_prompt_set(self, set_id):
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                result = {**s, 'isFavorite': s.get('isFavorite', False)}
                self.send_json(result)
                return
        self.send_error_json('未找到', 404)

    def handle_create_prompt_set(self):
        body = self.read_body()
        now = datetime.now().isoformat()
        new_set = {
            'id': str(uuid.uuid4())[:8],
            'name': body.get('name', '未命名提示词集合'),
            'folderId': body.get('folderId'),
            'tags': body.get('tags', '[]'),
            'isFavorite': body.get('isFavorite', False),
            'createdAt': now,
            'updatedAt': now,
            'versions': [{
                'version': 'v1',
                'prompt': '',
                'negativePrompt': '',
                'images': [],
                'note': '',
                'aspectRatio': '1:1',
                'stylePreset': '',
                'sampler': 'DPM++ 2M Karras',
                'steps': 30,
                'cfgScale': 7.0,
                'hrFix': True,
                'model': '',
                'createdAt': now
            }]
        }
        data = load_data()
        data.append(new_set)
        save_data(data)
        self.send_json(new_set)

    def handle_update_prompt_set(self, set_id):
        body = self.read_body()
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                if 'name' in body:
                    s['name'] = body['name']
                if 'folderId' in body:
                    s['folderId'] = body['folderId']
                if 'tags' in body:
                    s['tags'] = body['tags']
                if 'isFavorite' in body:
                    s['isFavorite'] = body['isFavorite']
                if 'versions' in body:
                    s['versions'] = body['versions']
                s['updatedAt'] = datetime.now().isoformat()
                save_data(data)
                self.send_ok()
                return
        self.send_error_json('未找到', 404)

    def handle_delete_prompt_set(self, set_id):
        data = load_data()
        new_data = []
        for s in data:
            if s['id'] == set_id:
                for v in s.get('versions', []):
                    for img in v.get('images', []):
                        delete_image_file(img.get('file'))
            else:
                new_data.append(s)
        save_data(new_data)
        self.send_ok()

    def handle_add_version(self, set_id):
        body = self.read_body()
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                now = datetime.now().isoformat()
                new_version = {
                    'version': f"v{len(s['versions']) + 1}",
                    'prompt': body.get('prompt', ''),
                    'negativePrompt': body.get('negativePrompt', ''),
                    'images': [],
                    'note': body.get('note', ''),
                    'aspectRatio': body.get('aspectRatio', '1:1'),
                    'stylePreset': body.get('stylePreset', ''),
                    'sampler': body.get('sampler', 'DPM++ 2M Karras'),
                    'steps': body.get('steps', 30),
                    'cfgScale': body.get('cfgScale', 7.0),
                    'hrFix': body.get('hrFix', True),
                    'model': body.get('model', ''),
                    'createdAt': now
                }
                s['versions'].append(new_version)
                s['updatedAt'] = now
                save_data(data)
                self.send_json(new_version)
                return
        self.send_error_json('未找到', 404)

    def handle_delete_version(self, set_id):
        body = self.read_body()
        version_index = body.get('versionIndex', -1)
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                if len(s['versions']) <= 1:
                    self.send_error_json('至少保留一个版本')
                    return
                if 0 <= version_index < len(s['versions']):
                    v = s['versions'][version_index]
                    for img in v.get('images', []):
                        delete_image_file(img.get('file'))
                    s['versions'].pop(version_index)
                    s['updatedAt'] = datetime.now().isoformat()
                    save_data(data)
                    self.send_ok()
                    return
        self.send_error_json('未找到', 404)

    def handle_rename_version(self, set_id):
        body = self.read_body()
        version_index = body.get('versionIndex', -1)
        new_name = body.get('version', '')
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                if 0 <= version_index < len(s['versions']):
                    s['versions'][version_index]['version'] = new_name
                    s['updatedAt'] = datetime.now().isoformat()
                    save_data(data)
                    self.send_ok()
                    return
        self.send_error_json('未找到', 404)

    def handle_duplicate_version(self, set_id):
        body = self.read_body()
        version_index = body.get('versionIndex', -1)
        data = load_data()
        for s in data:
            if s['id'] == set_id:
                if 0 <= version_index < len(s['versions']):
                    source = s['versions'][version_index]
                    now = datetime.now().isoformat()
                    new_images = []
                    for img in source.get('images', []):
                        new_img_id = str(uuid.uuid4())[:8]
                        new_img = dict(img)
                        new_img['id'] = new_img_id
                        if img.get('file'):
                            import shutil
                            src_path = os.path.join(IMAGES_DIR, img['file'])
                            ext = os.path.splitext(img['file'])[1]
                            new_file = new_img_id + ext
                            dst_path = os.path.join(IMAGES_DIR, new_file)
                            if os.path.exists(src_path):
                                shutil.copy2(src_path, dst_path)
                            new_img['file'] = new_file
                        new_images.append(new_img)

                    new_version = {
                        'version': f"v{len(s['versions']) + 1}",
                        'prompt': source.get('prompt', ''),
                        'negativePrompt': source.get('negativePrompt', ''),
                        'images': new_images,
                        'note': f"复制自 {source.get('version', '')}",
                        'createdAt': now
                    }
                    s['versions'].append(new_version)
                    s['updatedAt'] = now
                    save_data(data)
                    self.send_json(new_version)
                    return
        self.send_error_json('未找到', 404)

    def handle_upload_image(self, image_id):
        body = self.read_body()
        data_url = body.get('data', '')
        name = body.get('name', '')
        filename = save_image(image_id, data_url)
        if filename:
            self.send_json({'id': image_id, 'file': filename, 'name': name})
        else:
            self.send_error_json('保存图片失败')

    def handle_delete_image(self, image_file):
        delete_image_file(image_file)
        self.send_ok()

    def handle_sync(self):
        data = load_data()
        prompt_sets = []
        versions = []
        images = []
        for s in data:
            prompt_sets.append({
                'id': s['id'],
                'name': s['name'],
                'folder_id': s.get('folderId', ''),
                'tags': s.get('tags', '[]'),
                'is_favorite': s.get('isFavorite', False),
                'created_at': s.get('createdAt', ''),
                'updated_at': s.get('updatedAt', ''),
            })
            for idx, v in enumerate(s.get('versions', [])):
                version_id = v.get('id') or f"{s['id']}_v{idx}"
                versions.append({
                    'id': version_id,
                    'prompt_set_id': s['id'],
                    'version': v.get('version', ''),
                    'prompt': v.get('prompt', ''),
                    'negative_prompt': v.get('negativePrompt', ''),
                    'note': v.get('note', ''),
                    'sort_order': idx,
                    'aspect_ratio': v.get('aspectRatio', '1:1'),
                    'style_preset': v.get('stylePreset', ''),
                    'sampler': v.get('sampler', 'DPM++ 2M Karras'),
                    'steps': v.get('steps', 30),
                    'cfg_scale': v.get('cfgScale', 7.0),
                    'hr_fix': v.get('hrFix', True),
                    'model': v.get('model', ''),
                    'created_at': v.get('createdAt', ''),
                })
                for img in v.get('images', []):
                    images.append({
                        'id': img.get('id', str(uuid.uuid4())[:8]),
                        'version_id': version_id,
                        'name': img.get('name', ''),
                        'path': img.get('path', ''),
                        'file': img.get('file', ''),
                        'note': img.get('note', ''),
                        'created_at': img.get('createdAt', ''),
                    })
        self.send_json({
            'folders': load_folders(),
            'prompt_sets': prompt_sets,
            'versions': versions,
            'images': images,
            'sync_meta': {
                'server_time': datetime.now().isoformat(),
                'total_folders': len(load_folders()),
                'total_prompt_sets': len(prompt_sets),
                'total_versions': len(versions),
                'total_images': len(images),
            }
        })

    def handle_sync_image(self, filename):
        decoded_filename = urllib.parse.unquote(filename)
        filepath = os.path.join(IMAGES_DIR, decoded_filename)
        if os.path.exists(filepath):
            ext = os.path.splitext(filepath)[1].lower()
            content_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
            }
            content_type = content_types.get(ext, 'application/octet-stream')
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404)

    def handle_network_info(self):
        self.send_json({
            'ip': get_local_ip(),
            'port': SERVER_PORT,
        })

    def handle_export(self):
        self.send_json(build_backup_payload())

    def handle_export_file(self):
        body = self.read_body()
        filename = body.get('filename') if isinstance(body, dict) else None
        self.send_json(save_backup_file(filename))

    def handle_import(self):
        body = self.read_body()
        folders, prompt_sets = normalize_import_payload(body)
        if folders is None or not isinstance(prompt_sets, list):
            self.send_error_json('无效数据格式')
            return

        if isinstance(folders, list):
            current_folders = load_folders()
            folder_map = {f.get('id'): f for f in current_folders if f.get('id')}
            for folder in folders:
                if folder.get('id'):
                    folder_map[folder['id']] = folder
            save_folders(list(folder_map.values()))

        data = load_data()
        existing_ids = {s.get('id') for s in data}
        existing_map = {s.get('id'): s for s in data if s.get('id')}
        count = 0
        added = 0
        updated = 0
        restored_images = 0
        for item in prompt_sets:
            if item.get('id') and item.get('versions'):
                prepared, image_count = prepare_import_prompt_set(item)
                restored_images += image_count
                if prepared['id'] not in existing_ids:
                    data.append(prepared)
                    existing_ids.add(prepared['id'])
                    added += 1
                    count += 1
                else:
                    for version in existing_map.get(prepared['id'], {}).get('versions', []):
                        for image in version.get('images', []):
                            delete_image_file(image.get('file'))
                    idx = next(i for i, s in enumerate(data) if s.get('id') == prepared['id'])
                    data[idx] = prepared
                    existing_map[prepared['id']] = prepared
                    updated += 1
                    count += 1
        save_data(data)
        self.send_json({
            'imported': count,
            'added': added,
            'updated': updated,
            'imagesRestored': restored_images,
        })

    def serve_image(self, relative_path):
        decoded_path = urllib.parse.unquote(relative_path)
        filename = decoded_path.replace('images/', '', 1)
        filepath = os.path.join(IMAGES_DIR, filename)
        if os.path.exists(filepath):
            ext = os.path.splitext(filepath)[1].lower()
            content_types = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
            }
            content_type = content_types.get(ext, 'application/octet-stream')
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        pass


def write_log(msg):
    if getattr(sys, 'frozen', False):
        log_dir = os.path.dirname(sys.executable)
    else:
        log_dir = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(log_dir, 'app.log')
    try:
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f'[{datetime.now().isoformat()}] {msg}\n')
    except Exception:
        pass


def main():
    global SERVER_PORT
    ensure_dirs()

    debug_mode = os.environ.get('PROMPT_DEBUG', '').strip() == '1'
    write_log(f'App starting, debug={debug_mode}, frozen={getattr(sys, "frozen", False)}')
    write_log(f'FRONTEND_DIR={FRONTEND_DIR}')
    write_log(f'DATA_DIR={DATA_DIR}')
    write_log(f'HAS_WEBVIEW={HAS_WEBVIEW}')

    port = 8888
    for attempt in range(10):
        try:
            socketserver.ThreadingTCPServer.allow_reuse_address = True
            httpd = socketserver.ThreadingTCPServer((SERVER_HOST, port), AppHandler)
            break
        except OSError:
            write_log(f'{SERVER_HOST}:{port} in use, trying another')
            port = find_free_port()
    else:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("启动失败", "无法找到可用端口，请检查网络设置后重试")
        return

    url = f"http://{SERVER_HOST}:{port}"
    SERVER_PORT = port
    write_log(f'Server started on {url}')

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    health_deadline = time.time() + 3
    health_attempt = 1
    while time.time() < health_deadline:
        try:
            import urllib.request
            urllib.request.urlopen(f'{url}/api/health', timeout=2)
            write_log('Health check passed')
            break
        except Exception:
            write_log(f'Health check retry {health_attempt}')
            health_attempt += 1
            time.sleep(min(0.2, max(0, health_deadline - time.time())))

    if HAS_WEBVIEW:
        try:
            icon_path = os.path.join(
                os.path.dirname(sys.executable) if getattr(sys, 'frozen', False)
                else os.path.dirname(os.path.abspath(__file__)),
                'icon.ico'
            )
            write_log(f'Icon path: {icon_path}, exists: {os.path.exists(icon_path)}')
            write_log(f'Creating webview window with URL: {url}')

            window = webview.create_window(
                title='生图提示词管理器',
                url=url,
                width=1200,
                height=800,
                min_size=(800, 600),
                text_select=True,
            )
            write_log('Calling webview.start()')
            webview.start(icon=icon_path if os.path.exists(icon_path) else None)
            write_log('webview.start() returned normally')
            httpd.shutdown()
        except TypeError as e:
            write_log(f'webview TypeError (likely API mismatch): {e}')
            try:
                window = webview.create_window(
                    title='生图提示词管理器',
                    url=url,
                    width=1200,
                    height=800,
                    min_size=(800, 600),
                )
                webview.start()
                write_log('webview.start() succeeded without icon')
                httpd.shutdown()
                return
            except Exception as e2:
                write_log(f'webview retry also failed: {e2}')

            import webbrowser
            webbrowser.open(url)
            write_log(f'Fallback: opened browser at {url}')
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
        except Exception as e:
            write_log(f'webview.start() FAILED: {type(e).__name__}: {e}')
            import traceback
            err_log = os.path.join(
                os.path.dirname(sys.executable) if getattr(sys, 'frozen', False)
                else os.path.dirname(os.path.abspath(__file__)),
                'webview_error.log'
            )
            with open(err_log, 'w', encoding='utf-8') as f:
                f.write(f'webview.start() FAILED:\n{type(e).__name__}: {e}\n\n')
                traceback.print_exc(file=f)

            import webbrowser
            webbrowser.open(url)
            write_log(f'Fallback: opened browser at {url}')
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
    else:
        write_log('pywebview not available, using browser')
        import webbrowser

        def open_browser():
            webbrowser.open(url)
            write_log(f'Browser opened at {url}')

        threading.Timer(1.0, open_browser).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()

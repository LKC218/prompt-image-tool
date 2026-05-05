import http.server
import json
import socketserver
import webbrowser
import threading
import socket
import os
import sys
import urllib.parse
import uuid
import base64
import platform
from datetime import datetime


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


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
DATA_FILE = os.path.join(DATA_DIR, 'prompt_sets.json')
FOLDERS_FILE = os.path.join(DATA_DIR, 'folders.json')


def ensure_dirs():
    os.makedirs(IMAGES_DIR, exist_ok=True)


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
        elif path == '/api/folders':
            self.handle_get_folders()
        elif path == '/api/prompt-sets':
            self.handle_get_prompt_sets()
        elif path.startswith('/api/prompt-set/'):
            set_id = path.split('/api/prompt-set/')[1]
            self.handle_get_prompt_set(set_id)
        elif path.startswith('/images/'):
            self.serve_image(path[1:])
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/prompt-sets':
            self.handle_create_prompt_set()
        elif path == '/api/folders':
            self.handle_create_folder()
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
            summary.append({
                'id': s['id'],
                'name': s['name'],
                'folderId': s.get('folderId'),
                'tags': s.get('tags', '[]'),
                'isFavorite': s.get('isFavorite', False),
                'createdAt': s['createdAt'],
                'updatedAt': s['updatedAt'],
                'versionCount': len(s.get('versions', [])),
                'imageCount': total_images
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
                'created_at': s.get('createdAt', ''),
                'updated_at': s.get('updatedAt', ''),
            })
            for v in s.get('versions', []):
                versions.append({
                    'id': v.get('id', str(uuid.uuid4())[:8]),
                    'prompt_set_id': s['id'],
                    'version': v.get('version', ''),
                    'prompt': v.get('prompt', ''),
                    'negative_prompt': v.get('negativePrompt', ''),
                    'note': v.get('note', ''),
                    'sort_order': s.get('versions', []).index(v),
                    'created_at': v.get('createdAt', ''),
                })
                for img in v.get('images', []):
                    images.append({
                        'id': img.get('id', str(uuid.uuid4())[:8]),
                        'version_id': v.get('id', ''),
                        'name': img.get('name', ''),
                        'path': img.get('path', ''),
                        'file': img.get('file', ''),
                        'note': img.get('note', ''),
                        'created_at': img.get('createdAt', ''),
                    })
        self.send_json({
            'prompt_sets': prompt_sets,
            'versions': versions,
            'images': images,
            'sync_meta': {
                'server_time': datetime.now().isoformat(),
                'total_prompt_sets': len(prompt_sets),
                'total_versions': len(versions),
                'total_images': len(images),
            }
        })

    def handle_sync_image(self, filename):
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

    def handle_network_info(self):
        self.send_json({
            'ip': get_local_ip(),
            'port': 8888,
        })

    def handle_export(self):
        data = load_data()
        self.send_json(data)

    def handle_import(self):
        body = self.read_body()
        if not isinstance(body, list):
            self.send_error_json('无效数据格式')
            return
        data = load_data()
        existing_ids = {s['id'] for s in data}
        count = 0
        for item in body:
            if item.get('id') and item.get('versions'):
                if item['id'] not in existing_ids:
                    data.append(item)
                    count += 1
                else:
                    idx = next(i for i, s in enumerate(data) if s['id'] == item['id'])
                    data[idx] = item
                    count += 1
        save_data(data)
        self.send_json({'imported': count})

    def serve_image(self, relative_path):
        filename = relative_path.replace('images/', '', 1)
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


def main():
    app_dir = get_app_dir()
    os.chdir(app_dir)
    ensure_dirs()

    port = 8888

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", port), AppHandler) as httpd:
        print(f"Python backend started on port {port}")
        print(f"Data directory: {DATA_DIR}")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nPython backend stopped")


if __name__ == '__main__':
    main()

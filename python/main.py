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
import secrets
import hashlib
import shutil
import zipfile
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


DATA_APP_NAME = 'PromptImageManager'
DATA_DIR_ENV_VAR = 'PROMPT_IMAGE_TOOL_DATA_DIR'


def get_user_data_root():
    override = os.environ.get(DATA_DIR_ENV_VAR, '').strip()
    if override:
        return os.path.abspath(os.path.expandvars(os.path.expanduser(override)))

    if platform.system() == 'Windows':
        base_dir = os.environ.get('APPDATA') or os.environ.get('LOCALAPPDATA')
        if base_dir:
            return os.path.join(os.path.abspath(os.path.expandvars(base_dir)), DATA_APP_NAME)

    return os.path.join(os.path.expanduser('~'), '.prompt-image-tool')


def data_dir_has_user_data(data_dir):
    if not os.path.isdir(data_dir):
        return False

    for filename in ('prompt_sets.json', 'folders.json', 'sync-device.json'):
        path = os.path.join(data_dir, filename)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return True

    for dirname in ('images', 'backups'):
        root = os.path.join(data_dir, dirname)
        if os.path.isdir(root):
            for _, _, files in os.walk(root):
                if files:
                    return True

    return any(name.endswith('.bak') for name in os.listdir(data_dir))


def copy_data_tree(source_dir, target_dir):
    copied_files = 0
    os.makedirs(target_dir, exist_ok=True)
    for name in os.listdir(source_dir):
        source_path = os.path.join(source_dir, name)
        target_path = os.path.join(target_dir, name)
        if os.path.isdir(source_path):
            shutil.copytree(source_path, target_path, dirs_exist_ok=True)
            for _, _, files in os.walk(source_path):
                copied_files += len(files)
        elif os.path.isfile(source_path):
            shutil.copy2(source_path, target_path)
            copied_files += 1
    return copied_files


def write_data_migration_marker(target_data_dir, source_data_dir, status, copied_files=0):
    os.makedirs(target_data_dir, exist_ok=True)
    marker_path = os.path.join(target_data_dir, 'data-migration.json')
    payload = {
        'status': status,
        'source': source_data_dir,
        'target': target_data_dir,
        'copiedFiles': copied_files,
        'updatedAt': datetime.now().isoformat(),
    }
    with open(marker_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def migrate_legacy_data_if_needed(target_root, legacy_root):
    source_data_dir = os.path.join(legacy_root, 'data')
    target_data_dir = os.path.join(target_root, 'data')

    if os.path.abspath(source_data_dir) == os.path.abspath(target_data_dir):
        return {'status': 'same-path', 'copiedFiles': 0}

    if not data_dir_has_user_data(source_data_dir):
        return {'status': 'no-legacy-data', 'copiedFiles': 0}

    if data_dir_has_user_data(target_data_dir):
        write_data_migration_marker(target_data_dir, source_data_dir, 'skipped-target-has-data', 0)
        return {'status': 'skipped-target-has-data', 'copiedFiles': 0}

    copied_files = copy_data_tree(source_data_dir, target_data_dir)
    write_data_migration_marker(target_data_dir, source_data_dir, 'copied', copied_files)
    return {'status': 'copied', 'copiedFiles': copied_files}


def get_data_dir():
    app_dir = get_app_dir()
    user_root = get_user_data_root()
    os.makedirs(os.path.join(user_root, 'data', 'images'), exist_ok=True)
    os.makedirs(os.path.join(user_root, 'data', 'backups'), exist_ok=True)
    migrate_legacy_data_if_needed(user_root, app_dir)
    return user_root


APP_DIR = get_data_dir()
DATA_DIR = os.path.join(APP_DIR, 'data')
IMAGES_DIR = os.path.join(DATA_DIR, 'images')
BACKUPS_DIR = os.path.join(DATA_DIR, 'backups')
DATA_FILE = os.path.join(DATA_DIR, 'prompt_sets.json')
FOLDERS_FILE = os.path.join(DATA_DIR, 'folders.json')
SYNC_DEVICE_FILE = os.path.join(DATA_DIR, 'sync-device.json')
SERVER_PORT = 8888
EXPORT_SAVE_MODES = {'downloads', 'custom'}
IMAGE_DOWNLOAD_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
ZIP_BACKUP_FORMAT = 'prompt-image-tool-backup'
ZIP_BACKUP_VERSION = 2
ZIP_BACKUP_ALLOWED_ENTRIES = {'manifest.json', 'data/folders.json', 'data/prompt_sets.json'}
ZIP_BACKUP_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
ZIP_BACKUP_MAX_ENTRIES = 10000
ZIP_BACKUP_MAX_FILE_BYTES = 1024 * 1024 * 1024
ZIP_BACKUP_MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024 * 1024


class DataFileError(RuntimeError):
    pass


def ensure_dirs():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(BACKUPS_DIR, exist_ok=True)


def load_json_list(file_path, label):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            if not content:
                raise DataFileError(f'{label} 数据文件为空，请先从备份恢复')
            data = json.loads(content)
            if not isinstance(data, list):
                raise DataFileError(f'{label} 数据格式异常，请先从备份恢复')
            return data
        except json.JSONDecodeError as exc:
            raise DataFileError(f'{label} 数据文件损坏，请先从备份恢复') from exc
        except IOError as exc:
            raise DataFileError(f'{label} 数据文件读取失败，请检查文件权限') from exc
    return []


def save_json_atomic(file_path, data):
    ensure_dirs()
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    temp_file = f'{file_path}.{os.getpid()}.tmp'
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            shutil.copy2(file_path, f'{file_path}.bak')
        os.replace(temp_file, file_path)
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def load_data():
    return load_json_list(DATA_FILE, '提示词')


def save_data(data):
    save_json_atomic(DATA_FILE, data)


def load_folders():
    return load_json_list(FOLDERS_FILE, '分类')


def save_folders(data):
    save_json_atomic(FOLDERS_FILE, data)


def load_sync_device():
    ensure_dirs()
    if os.path.exists(SYNC_DEVICE_FILE):
        try:
            with open(SYNC_DEVICE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            data = {}
    else:
        data = {}

    changed = False
    if not data.get('device_id'):
        data['device_id'] = str(uuid.uuid4())
        changed = True
    if not data.get('sync_token'):
        data['sync_token'] = secrets.token_urlsafe(18)
        changed = True
    if not data.get('created_at'):
        data['created_at'] = datetime.now().isoformat()
        changed = True
    data['device_name'] = platform.node()
    data['updated_at'] = datetime.now().isoformat()

    if changed or not os.path.exists(SYNC_DEVICE_FILE):
        save_sync_device(data)
    return data


def save_sync_device(data):
    ensure_dirs()
    with open(SYNC_DEVICE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_sync_capabilities():
    device = load_sync_device()
    return {
        'status': 'ok',
        'device_id': device.get('device_id'),
        'device_name': platform.node(),
        'platform': 'pc',
        'sync_version': 2,
        'port': SERVER_PORT,
        'pairing_required': True,
        'capabilities': ['pull', 'push', 'bidirectional', 'pairing'],
    }


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


def build_zip_backup_filename(filename=None):
    raw = os.path.basename(str(filename or '').strip())
    if not raw:
        raw = f"prompt-image-tool-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.zip"
    for char in '<>:"/\\|?*':
        raw = raw.replace(char, '_')
    if not raw.lower().endswith('.zip'):
        raw += '.zip'
    return raw


def get_downloads_dir():
    if platform.system() == 'Windows':
        try:
            import winreg
            with winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r'Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders',
            ) as key:
                value, _ = winreg.QueryValueEx(key, '{374DE290-123F-4565-9164-39C4925E467B}')
                return os.path.abspath(os.path.expandvars(value))
        except Exception:
            pass
    downloads = os.path.join(os.path.expanduser('~'), 'Downloads')
    return os.path.abspath(downloads)


def build_backup_target_path(filename=None, directory=None, target_path=None):
    if target_path:
        target_path = os.path.abspath(os.path.expanduser(str(target_path)))
        directory = os.path.dirname(target_path)
        safe_name = build_backup_filename(os.path.basename(target_path))
    else:
        directory = os.path.abspath(os.path.expanduser(str(directory or get_downloads_dir())))
        safe_name = build_backup_filename(filename)

    if not directory:
        raise ValueError('导出目录不能为空')

    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, safe_name), safe_name, directory


def build_zip_backup_target_path(filename=None, directory=None, target_path=None):
    if target_path:
        target_path = os.path.abspath(os.path.expanduser(str(target_path)))
        directory = os.path.dirname(target_path)
        safe_name = build_zip_backup_filename(os.path.basename(target_path))
    else:
        directory = os.path.abspath(os.path.expanduser(str(directory or get_downloads_dir())))
        safe_name = build_zip_backup_filename(filename)

    if not directory:
        raise ValueError('导出目录不能为空')

    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, safe_name), safe_name, directory


def choose_backup_file_path(filename=None):
    result = {'path': None, 'error': None}

    def run_dialog():
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            root.update_idletasks()
            try:
                root.attributes('-topmost', True)
                root.lift()
                root.focus_force()
            except tk.TclError:
                pass
            result['path'] = filedialog.asksaveasfilename(
                parent=root,
                title='选择 JSON 导出位置',
                initialdir=get_downloads_dir(),
                initialfile=build_backup_filename(filename),
                defaultextension='.json',
                filetypes=[('JSON 文件', '*.json'), ('所有文件', '*.*')],
            ) or None
            root.destroy()
        except Exception as e:
            result['error'] = e

    thread = threading.Thread(target=run_dialog, daemon=True)
    thread.start()
    thread.join()

    if result['error']:
        raise result['error']
    return result['path']


def choose_zip_backup_file_path(filename=None):
    result = {'path': None, 'error': None}

    def run_dialog():
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            root.update_idletasks()
            try:
                root.attributes('-topmost', True)
                root.lift()
                root.focus_force()
            except tk.TclError:
                pass
            result['path'] = filedialog.asksaveasfilename(
                parent=root,
                title='选择 ZIP 完整备份保存位置',
                initialdir=get_downloads_dir(),
                initialfile=build_zip_backup_filename(filename),
                defaultextension='.zip',
                filetypes=[('ZIP 备份文件', '*.zip'), ('所有文件', '*.*')],
            ) or None
            root.destroy()
        except Exception as e:
            result['error'] = e

    thread = threading.Thread(target=run_dialog, daemon=True)
    thread.start()
    thread.join()

    if result['error']:
        raise result['error']
    return result['path']


def build_image_download_filename(filename=None, source_name=None):
    raw = os.path.basename(str(filename or source_name or '').strip())
    if not raw:
        raw = 'preview.png'
    for char in '<>:"/\\|?*':
        raw = raw.replace(char, '_')
    raw = raw.lstrip('.').strip() or 'preview'
    root, ext = os.path.splitext(raw)
    source_ext = os.path.splitext(source_name or '')[1].lower()
    ext = ext.lower()
    if ext not in IMAGE_DOWNLOAD_EXTENSIONS:
        ext = source_ext if source_ext in IMAGE_DOWNLOAD_EXTENSIONS else '.png'
    return f'{root or "preview"}{ext}'


def build_image_download_target_path(filename=None, source_name=None, directory=None, target_path=None):
    if target_path:
        target_path = os.path.abspath(os.path.expanduser(str(target_path)))
        directory = os.path.dirname(target_path)
        safe_name = build_image_download_filename(os.path.basename(target_path), source_name)
    else:
        directory = os.path.abspath(os.path.expanduser(str(directory or get_downloads_dir())))
        safe_name = build_image_download_filename(filename, source_name)

    if not directory:
        raise ValueError('图片下载目录不能为空')

    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, safe_name), safe_name, directory


def choose_image_download_path(filename=None, source_name=None):
    result = {'path': None, 'error': None}

    def run_dialog():
        try:
            import tkinter as tk
            from tkinter import filedialog

            safe_name = build_image_download_filename(filename, source_name)
            ext = os.path.splitext(safe_name)[1].lower() or '.png'
            root = tk.Tk()
            root.withdraw()
            root.update_idletasks()
            try:
                root.attributes('-topmost', True)
                root.lift()
                root.focus_force()
            except tk.TclError:
                pass
            result['path'] = filedialog.asksaveasfilename(
                parent=root,
                title='选择图片下载位置',
                initialdir=get_downloads_dir(),
                initialfile=safe_name,
                defaultextension=ext,
                filetypes=[
                    ('图片文件', '*.png *.jpg *.jpeg *.webp *.gif'),
                    ('所有文件', '*.*'),
                ],
            ) or None
            root.destroy()
        except Exception as e:
            result['error'] = e

    thread = threading.Thread(target=run_dialog, daemon=True)
    thread.start()
    thread.join()

    if result['error']:
        raise result['error']
    return result['path']


def save_image_download_file(source_file=None, filename=None, directory=None, target_path=None, save_mode='custom'):
    source_path, safe_source = get_safe_image_path(source_file)
    source_ext = os.path.splitext(safe_source)[1].lower()
    if not source_path or source_ext not in IMAGE_DOWNLOAD_EXTENSIONS:
        raise ValueError('无效图片文件')

    images_root = os.path.abspath(IMAGES_DIR)
    source_abs = os.path.abspath(source_path)
    if not source_abs.startswith(images_root + os.sep) or not os.path.exists(source_abs):
        raise ValueError('图片文件不存在')

    if save_mode == 'custom' and not target_path and not directory:
        selected_path = choose_image_download_path(filename, safe_source)
        if not selected_path:
            return {
                'success': False,
                'canceled': True,
                'filename': build_image_download_filename(filename, safe_source),
                'saveMode': save_mode,
            }
        target_path = selected_path

    output_path, safe_name, output_dir = build_image_download_target_path(
        filename=filename,
        source_name=safe_source,
        directory=directory,
        target_path=target_path,
    )

    with open(source_abs, 'rb') as f:
        content = f.read()
    with open(output_path, 'wb') as f:
        f.write(content)

    return {
        'success': True,
        'filename': safe_name,
        'path': output_path,
        'directory': output_dir,
        'saveMode': save_mode,
        'locationLabel': '自定义位置' if save_mode == 'custom' else '下载目录',
        'size': len(content),
        'contentType': get_image_content_type(safe_name),
    }


def count_backup_versions(prompt_sets):
    return sum(len(item.get('versions', [])) for item in prompt_sets)


def save_backup_file(filename=None, directory=None, target_path=None, save_mode='downloads'):
    ensure_dirs()
    save_mode = save_mode if save_mode in EXPORT_SAVE_MODES else 'downloads'
    if save_mode == 'custom' and not directory and not target_path:
        target_path = choose_backup_file_path(filename)
        if not target_path:
            return {
                'success': False,
                'canceled': True,
                'method': 'backend',
                'saveMode': save_mode,
                'filename': build_backup_filename(filename),
            }

    payload = build_backup_payload()
    filepath, safe_name, target_dir = build_backup_target_path(filename, directory, target_path)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    prompt_sets = payload.get('prompt_sets', [])
    return {
        'success': True,
        'filename': safe_name,
        'path': filepath,
        'directory': target_dir,
        'method': 'backend',
        'saveMode': save_mode,
        'locationLabel': '下载目录' if save_mode == 'downloads' else '自定义位置',
        'size': os.path.getsize(filepath),
        'promptSetCount': len(prompt_sets),
        'versionCount': count_backup_versions(prompt_sets),
        'imageCount': payload.get('backup_meta', {}).get('imageCount', 0),
    }


def calculate_file_sha256(filepath):
    digest = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def build_zip_backup_content():
    prompt_sets = json.loads(json.dumps(load_data(), ensure_ascii=False))
    folders = load_folders()
    images = []
    missing_images = []
    image_bytes = 0

    for prompt_set in prompt_sets:
        for version in prompt_set.get('versions', []):
            for image in version.get('images', []):
                image.pop('data', None)
                image.pop('size', None)
                image.pop('mimeType', None)
                filename = os.path.basename(str(image.get('file') or ''))
                if not filename:
                    continue
                source_path, safe_name = get_safe_image_path(filename)
                extension = os.path.splitext(safe_name)[1].lower()
                if extension not in ZIP_BACKUP_IMAGE_EXTENSIONS or not source_path or not os.path.isfile(source_path):
                    missing_images.append({
                        'id': image.get('id', ''),
                        'file': filename,
                        'reason': '图片文件不存在或格式不支持',
                    })
                    continue
                archive_path = f'images/{safe_name}'
                byte_size = os.path.getsize(source_path)
                images.append({
                    'id': image.get('id', ''),
                    'file': safe_name,
                    'path': archive_path,
                    'mimeType': get_image_content_type(safe_name),
                    'size': byte_size,
                    'sha256': calculate_file_sha256(source_path),
                    'sourcePath': source_path,
                })
                image_bytes += byte_size

    data_files = {
        'data/folders.json': folders,
        'data/prompt_sets.json': prompt_sets,
    }
    data_hashes = {
        path: hashlib.sha256(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
        for path, data in data_files.items()
    }
    manifest = {
        'app': 'prompt-image-tool',
        'format': ZIP_BACKUP_FORMAT,
        'version': ZIP_BACKUP_VERSION,
        'createdAt': datetime.now().isoformat(),
        'foldersCount': len(folders),
        'promptSetCount': len(prompt_sets),
        'versionCount': count_backup_versions(prompt_sets),
        'imageCount': len(images),
        'imageBytes': image_bytes,
        'images': [{key: value for key, value in image.items() if key != 'sourcePath'} for image in images],
        'missingImages': missing_images,
        'dataFiles': data_hashes,
    }
    return manifest, data_files, images


def save_zip_backup_file(filename=None, directory=None, target_path=None, save_mode='downloads'):
    ensure_dirs()
    save_mode = save_mode if save_mode in EXPORT_SAVE_MODES else 'downloads'
    if save_mode == 'custom' and not directory and not target_path:
        target_path = choose_zip_backup_file_path(filename)
        if not target_path:
            return {
                'success': False,
                'canceled': True,
                'method': 'backend',
                'format': 'zip-v2',
                'saveMode': save_mode,
                'filename': build_zip_backup_filename(filename),
            }

    filepath, safe_name, target_dir = build_zip_backup_target_path(filename, directory, target_path)
    manifest, data_files, images = build_zip_backup_content()
    with zipfile.ZipFile(filepath, 'w', allowZip64=True) as archive:
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2), compress_type=zipfile.ZIP_DEFLATED)
        for archive_path, data in data_files.items():
            archive.writestr(archive_path, json.dumps(data, ensure_ascii=False, indent=2), compress_type=zipfile.ZIP_DEFLATED)
        for image in images:
            archive.write(image['sourcePath'], image['path'], compress_type=zipfile.ZIP_STORED)

    return {
        'success': True,
        'filename': safe_name,
        'path': filepath,
        'directory': target_dir,
        'method': 'backend',
        'format': 'zip-v2',
        'saveMode': save_mode,
        'locationLabel': '下载目录' if save_mode == 'downloads' else '自定义位置',
        'size': os.path.getsize(filepath),
        'promptSetCount': manifest['promptSetCount'],
        'versionCount': manifest['versionCount'],
        'imageCount': manifest['imageCount'],
        'imageBytes': manifest['imageBytes'],
        'missingImageCount': len(manifest['missingImages']),
    }


def is_valid_zip_backup_entry(name):
    if not name or '\\' in name or name.startswith('/') or name.startswith('../') or '/..' in name:
        return False
    if name in ZIP_BACKUP_ALLOWED_ENTRIES:
        return True
    if not name.startswith('images/'):
        return False
    extension = os.path.splitext(name)[1].lower()
    return extension in ZIP_BACKUP_IMAGE_EXTENSIONS and '/' not in name[len('images/'):]


def preview_zip_backup_file(filepath):
    source_path = os.path.abspath(os.path.expanduser(str(filepath or '')))
    if not source_path or not os.path.isfile(source_path) or not source_path.lower().endswith('.zip'):
        raise ValueError('ZIP 备份文件不存在或格式不正确')

    errors = []
    warnings = []
    archive_size = os.path.getsize(source_path)
    with zipfile.ZipFile(source_path, 'r') as archive:
        entries = archive.infolist()
        if len(entries) > ZIP_BACKUP_MAX_ENTRIES:
            errors.append('备份条目数量超过限制')
        uncompressed_size = sum(entry.file_size for entry in entries)
        if uncompressed_size > ZIP_BACKUP_MAX_UNCOMPRESSED_BYTES:
            errors.append('备份解压后大小超过限制')
        for entry in entries:
            if entry.file_size > ZIP_BACKUP_MAX_FILE_BYTES:
                errors.append(f'文件超过大小限制：{entry.filename}')
            if not is_valid_zip_backup_entry(entry.filename):
                errors.append(f'备份包含不允许的路径：{entry.filename}')

        names = {entry.filename for entry in entries}
        required_entries = ZIP_BACKUP_ALLOWED_ENTRIES
        if not required_entries.issubset(names):
            errors.append('备份缺少必要的数据文件')
            manifest = {}
            folders = []
            prompt_sets = []
        else:
            try:
                manifest = json.loads(archive.read('manifest.json').decode('utf-8'))
                folders = json.loads(archive.read('data/folders.json').decode('utf-8'))
                prompt_sets = json.loads(archive.read('data/prompt_sets.json').decode('utf-8'))
            except (UnicodeDecodeError, json.JSONDecodeError, KeyError):
                errors.append('备份清单或数据文件格式错误')
                manifest = {}
                folders = []
                prompt_sets = []

        if manifest.get('format') != ZIP_BACKUP_FORMAT or manifest.get('version') != ZIP_BACKUP_VERSION:
            errors.append('不支持的 ZIP 备份格式或版本')
        if not isinstance(folders, list) or not isinstance(prompt_sets, list):
            errors.append('备份业务数据格式错误')

        image_entries = [entry for entry in entries if entry.filename.startswith('images/')]
        expected_images = manifest.get('images', []) if isinstance(manifest.get('images'), list) else []
        expected_paths = {item.get('path') for item in expected_images if isinstance(item, dict)}
        actual_paths = {entry.filename for entry in image_entries}
        if expected_paths != actual_paths:
            errors.append('图片清单与 ZIP 内容不一致')
        for item in expected_images:
            if not isinstance(item, dict):
                errors.append('图片清单格式错误')
                continue
            entry_name = item.get('path')
            if entry_name not in names:
                continue
            entry = archive.getinfo(entry_name)
            if entry.file_size != item.get('size'):
                errors.append(f'图片大小校验失败：{entry_name}')
                continue
            digest = hashlib.sha256()
            with archive.open(entry_name, 'r') as image_file:
                while True:
                    chunk = image_file.read(1024 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
            if digest.hexdigest() != item.get('sha256'):
                errors.append(f'图片摘要校验失败：{entry_name}')

    missing_images = manifest.get('missingImages', []) if isinstance(manifest.get('missingImages'), list) else []
    if missing_images:
        warnings.append(f'备份导出时跳过了 {len(missing_images)} 张缺失图片')
    return {
        'success': not errors,
        'format': 'zip-v2',
        'version': manifest.get('version'),
        'archiveSize': archive_size,
        'uncompressedSize': uncompressed_size,
        'folderCount': len(folders),
        'promptSetCount': len(prompt_sets),
        'versionCount': count_backup_versions(prompt_sets) if isinstance(prompt_sets, list) else 0,
        'imageCount': len(image_entries),
        'missingImageCount': len(missing_images),
        'warnings': warnings,
        'errors': errors,
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


def normalize_prompt_for_compare(prompt_set):
    def pick(data, *keys, default=''):
        for key in keys:
            if key in data and data.get(key) is not None:
                return data.get(key)
        return default

    versions = []
    for idx, version in enumerate(prompt_set.get('versions', [])):
        images = []
        for image in version.get('images', []):
            images.append({
                'name': pick(image, 'name'),
                'file': pick(image, 'file'),
                'path': pick(image, 'path'),
                'note': pick(image, 'note'),
            })
        versions.append({
            'version': pick(version, 'version', 'name', default=f'v{idx + 1}'),
            'prompt': pick(version, 'prompt'),
            'negativePrompt': pick(version, 'negativePrompt', 'negative_prompt'),
            'note': pick(version, 'note'),
            'aspectRatio': pick(version, 'aspectRatio', 'aspect_ratio', default='1:1'),
            'stylePreset': pick(version, 'stylePreset', 'style_preset'),
            'sampler': pick(version, 'sampler', default='DPM++ 2M Karras'),
            'steps': pick(version, 'steps', default=30),
            'cfgScale': pick(version, 'cfgScale', 'cfg_scale', default=7.0),
            'hrFix': pick(version, 'hrFix', 'hr_fix', default=True),
            'model': pick(version, 'model'),
            'images': images,
        })

    return {
        'name': pick(prompt_set, 'name'),
        'folderId': pick(prompt_set, 'folderId', 'folder_id'),
        'tags': pick(prompt_set, 'tags', default='[]'),
        'isFavorite': bool(pick(prompt_set, 'isFavorite', 'is_favorite', default=False)),
        'versions': versions,
    }


def prompt_content_digest(prompt_set):
    normalized = normalize_prompt_for_compare(prompt_set)
    text = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def build_field_diffs(left, right):
    left_normalized = normalize_prompt_for_compare(left)
    right_normalized = normalize_prompt_for_compare(right)
    labels = {
        'name': '标题',
        'folderId': '分类',
        'tags': '标签',
        'isFavorite': '收藏状态',
        'versions': '版本内容',
    }
    diffs = []
    for key, label in labels.items():
        if left_normalized.get(key) != right_normalized.get(key):
            diffs.append({'field': key, 'label': label})
    return diffs


def is_same_prompt_set(left, right):
    return prompt_content_digest(left) == prompt_content_digest(right)


def build_conflict_key(prompt_set, source='Android', direction='push'):
    original_id = prompt_set.get('id') or ''
    source_device = prompt_set.get('syncMeta', {}).get('sourceDeviceId') or source
    digest = prompt_content_digest(prompt_set)
    raw = f'{source_device}|{original_id}|{digest}|{direction}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def find_conflict_copy(data, conflict_key):
    if not conflict_key:
        return None
    for item in data:
        sync_meta = item.get('syncMeta') if isinstance(item, dict) else None
        if isinstance(sync_meta, dict) and sync_meta.get('conflictKey') == conflict_key:
            return item
    return None


def create_conflict_copy(prompt_set, source='Android', conflict_key=None):
    copied = json.loads(json.dumps(prompt_set, ensure_ascii=False))
    original_id = copied.get('id') or str(uuid.uuid4())[:8]
    conflict_key = conflict_key or build_conflict_key(copied, source)
    suffix = conflict_key[:8]
    id_map = {}
    copied['id'] = f'{original_id}-conflict-{suffix}'
    copied['name'] = f"{copied.get('name') or '未命名提示词集合'}（{source}冲突副本）"
    copied['updatedAt'] = datetime.now().isoformat()
    copied['createdAt'] = copied.get('createdAt') or copied.get('created_at') or copied['updatedAt']
    copied['syncMeta'] = {
        **(copied.get('syncMeta') if isinstance(copied.get('syncMeta'), dict) else {}),
        'sourceDeviceId': copied.get('syncMeta', {}).get('sourceDeviceId') if isinstance(copied.get('syncMeta'), dict) else source,
        'conflictKey': conflict_key,
        'originalId': original_id,
        'createdBySync': True,
    }

    for idx, version in enumerate(copied.get('versions', [])):
        old_version_id = version.get('id') or f'{original_id}_v{idx}'
        new_version_id = f'{old_version_id}-conflict-{suffix}'
        id_map[old_version_id] = new_version_id
        version['id'] = new_version_id

    for version in copied.get('versions', []):
        for image in version.get('images', []):
            old_image_id = image.get('id') or str(uuid.uuid4())[:8]
            image['id'] = f'{old_image_id}-conflict-{suffix}'

    return copied


def create_sync_backup(label='sync'):
    ensure_dirs()
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    safe_label = ''.join(c if c.isalnum() or c in ('-', '_') else '-' for c in label) or 'sync'
    filename = f'{safe_label}-backup-{datetime.now().strftime("%Y%m%d-%H%M%S-%f")}.json'
    path = os.path.join(BACKUPS_DIR, filename)
    payload = {
        'backup_meta': {
            'format': 'prompt-image-tool-sync-backup',
            'createdAt': datetime.now().isoformat(),
            'reason': label,
        },
        'folders': load_folders(),
        'prompt_sets': load_data(),
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def build_sync_preview(folders, prompt_sets, mode='keep_pc', source='Android'):
    if folders is None or not isinstance(prompt_sets, list):
        return None

    data = load_data()
    existing_map = {s.get('id'): s for s in data if s.get('id')}
    incoming_ids = {item.get('id') for item in prompt_sets if isinstance(item, dict) and item.get('id')}
    items = []
    added = 0
    updated = 0
    conflicts = 0
    skipped = 0
    invalid = 0
    same = 0

    for item in prompt_sets:
        if not isinstance(item, dict) or not item.get('id') or not item.get('versions'):
            invalid += 1
            items.append({
                'id': item.get('id', '') if isinstance(item, dict) else '',
                'name': item.get('name', '') if isinstance(item, dict) else '',
                'type': 'invalid',
                'recommendedAction': 'skip',
            })
            continue

        existing = existing_map.get(item['id'])
        if not existing:
            added += 1
            items.append({
                'id': item['id'],
                'name': item.get('name', ''),
                'type': 'only_android',
                'recommendedAction': 'add',
            })
            continue

        if is_same_prompt_set(existing, item):
            same += 1
            skipped += 1
            items.append({
                'id': item['id'],
                'name': item.get('name', ''),
                'type': 'same',
                'recommendedAction': 'skip',
            })
            continue

        conflicts += 1
        conflict_key = build_conflict_key(item, source)
        existing_copy = find_conflict_copy(data, conflict_key)
        recommended = 'skip_existing_conflict_copy' if existing_copy else (
            'skip' if mode == 'add_only' else 'create_conflict_copy'
        )
        items.append({
            'id': item['id'],
            'name': item.get('name', ''),
            'type': 'conflict',
            'conflictKey': conflict_key,
            'existingConflictId': existing_copy.get('id') if existing_copy else '',
            'fieldDiffs': build_field_diffs(existing, item),
            'recommendedAction': recommended,
        })
        if existing_copy or mode == 'add_only':
            skipped += 1
        else:
            added += 1

    only_pc = len([item for item in data if item.get('id') and item.get('id') not in incoming_ids])
    return {
        'success': True,
        'mode': mode,
        'source': source,
        'summary': {
            'added': added,
            'updated': updated,
            'conflicts': conflicts,
            'skipped': skipped,
            'same': same,
            'invalid': invalid,
            'onlyPc': only_pc,
            'incoming': len(prompt_sets),
        },
        'items': items,
        'requiresConfirmation': conflicts > 0,
    }


def merge_import_payload(folders, prompt_sets, mode='replace', source='Android'):
    if folders is None or not isinstance(prompt_sets, list):
        return None

    backup_path = create_sync_backup(f'{source}-{mode}')

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
    conflicts = 0
    skipped = 0
    restored_images = 0
    conflict_items = []

    for item in prompt_sets:
        if not item.get('id') or not item.get('versions'):
            skipped += 1
            continue

        target_item = item
        existing = existing_map.get(item['id'])
        if existing and mode in ('keep_pc', 'add_only'):
            if is_same_prompt_set(existing, item):
                skipped += 1
                continue
            conflict_key = build_conflict_key(item, source)
            existing_conflict_copy = find_conflict_copy(data, conflict_key)
            if existing_conflict_copy:
                conflicts += 1
                skipped += 1
                conflict_items.append({
                    'id': item['id'],
                    'name': item.get('name', ''),
                    'conflictId': existing_conflict_copy.get('id'),
                    'conflictKey': conflict_key,
                    'duplicate': True,
                })
                continue
            if mode == 'add_only':
                conflicts += 1
                skipped += 1
                conflict_items.append({'id': item['id'], 'name': item.get('name', ''), 'conflictKey': conflict_key})
                continue
            target_item = create_conflict_copy(item, source, conflict_key)
            conflicts += 1
            conflict_items.append({
                'id': item['id'],
                'name': item.get('name', ''),
                'conflictId': target_item['id'],
                'conflictKey': conflict_key,
                'fieldDiffs': build_field_diffs(existing, item),
            })

        prepared, image_count = prepare_import_prompt_set(target_item)
        restored_images += image_count

        if prepared['id'] not in existing_ids:
            data.append(prepared)
            existing_ids.add(prepared['id'])
            existing_map[prepared['id']] = prepared
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
    return {
        'success': True,
        'imported': count,
        'added': added,
        'updated': updated,
        'conflicts': conflicts,
        'skipped': skipped,
        'imagesRestored': restored_images,
        'conflictItems': conflict_items,
        'mode': mode,
        'backupPath': backup_path,
    }


def build_sync_payload():
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
                'version': v.get('version', f'v{idx+1}'),
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
                    'id': img.get('id') or str(uuid.uuid4())[:8],
                    'version_id': version_id,
                    'name': img.get('name', ''),
                    'path': img.get('path', ''),
                    'file': img.get('file', ''),
                    'note': img.get('note', ''),
                    'created_at': img.get('createdAt', ''),
                })

    return {
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
            'sync_version': 2,
        }
    }


class AppHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Token, X-Device-Id, X-Device-Name')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self.handle_health()
        elif path == '/api/sync':
            self.handle_sync()
        elif path.startswith('/api/sync/images/'):
            filename = path.split('/api/sync/images/')[1]
            self.handle_sync_image(filename)
        elif path == '/api/sync/capabilities':
            self.handle_sync_capabilities()
        elif path == '/api/sync/pairing':
            self.handle_sync_pairing()
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
        else:
            super().do_GET()

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
        elif path == '/api/backup/zip/export':
            self.handle_zip_export_file()
        elif path == '/api/backup/zip/preview':
            self.handle_zip_preview()
        elif path == '/api/image-download-file':
            self.handle_image_download_file()
        elif path == '/api/import':
            self.handle_import()
        elif path == '/api/sync/import':
            self.handle_sync_import()
        elif path == '/api/sync/preview':
            self.handle_sync_preview()
        elif path == '/api/sync/bidirectional':
            self.handle_sync_bidirectional()
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

    def _sync_token_valid(self):
        expected = load_sync_device().get('sync_token')
        provided = self.headers.get('X-Sync-Token', '')
        return bool(expected and provided and secrets.compare_digest(expected, provided))

    def handle_health(self):
        payload = get_sync_capabilities()
        payload['dataDir'] = DATA_DIR
        self.send_json(payload)

    def handle_sync_capabilities(self):
        info = get_sync_capabilities()
        info['ip'] = get_local_ip()
        self.send_json(info)

    def handle_sync_pairing(self):
        device = load_sync_device()
        self.send_json({
            'success': True,
            'device_id': device.get('device_id'),
            'device_name': platform.node(),
            'sync_token': device.get('sync_token'),
            'pairing_code': device.get('sync_token', '')[-6:],
            'expires': None,
        })

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
        try:
            data = load_data()
        except DataFileError as e:
            self.send_error_json(str(e), 500)
            return
        data.append(new_set)
        save_data(data)
        self.send_json(new_set)

    def handle_update_prompt_set(self, set_id):
        body = self.read_body()
        try:
            data = load_data()
        except DataFileError as e:
            self.send_error_json(str(e), 500)
            return
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
        self.send_json(build_sync_payload())

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
            'port': SERVER_PORT,
        })

    def handle_export(self):
        self.send_json(build_backup_payload())

    def handle_export_file(self):
        body = self.read_body()
        if not isinstance(body, dict):
            body = {}
        try:
            self.send_json(save_backup_file(
                filename=body.get('filename'),
                directory=body.get('directory'),
                target_path=body.get('targetPath'),
                save_mode=body.get('saveMode', 'downloads'),
            ))
        except ValueError as e:
            self.send_error_json(str(e), 400)
        except Exception as e:
            self.send_error_json(f'导出失败：{e}', 500)

    def handle_zip_export_file(self):
        body = self.read_body()
        if not isinstance(body, dict):
            body = {}
        try:
            self.send_json(save_zip_backup_file(
                filename=body.get('filename'),
                directory=body.get('directory'),
                target_path=body.get('targetPath'),
                save_mode=body.get('saveMode', 'downloads'),
            ))
        except ValueError as e:
            self.send_error_json(str(e), 400)
        except Exception as e:
            self.send_error_json(f'ZIP 完整备份导出失败：{e}', 500)

    def handle_zip_preview(self):
        body = self.read_body()
        if not isinstance(body, dict):
            body = {}
        try:
            self.send_json(preview_zip_backup_file(body.get('path')))
        except (ValueError, zipfile.BadZipFile) as e:
            self.send_error_json(str(e) or 'ZIP 备份文件格式不正确', 400)
        except Exception as e:
            self.send_error_json(f'ZIP 备份预检失败：{e}', 500)

    def handle_image_download_file(self):
        body = self.read_body()
        if not isinstance(body, dict):
            body = {}
        try:
            self.send_json(save_image_download_file(
                source_file=body.get('sourceFile') or body.get('file'),
                filename=body.get('filename'),
                directory=body.get('directory'),
                target_path=body.get('targetPath'),
                save_mode=body.get('saveMode', 'custom'),
            ))
        except ValueError as e:
            self.send_error_json(str(e), 400)
        except Exception as e:
            self.send_error_json(f'图片下载失败：{e}', 500)

    def handle_import(self):
        body = self.read_body()
        folders, prompt_sets = normalize_import_payload(body)
        result = merge_import_payload(folders, prompt_sets, mode='replace', source='导入')
        if result is None:
            self.send_error_json('无效数据格式')
            return
        self.send_json({
            'imported': result['imported'],
            'added': result['added'],
            'updated': result['updated'],
            'imagesRestored': result['imagesRestored'],
        })

    def handle_sync_import(self):
        if not self._sync_token_valid():
            self.send_error_json('同步令牌无效，请重新配对', 401)
            return
        body = self.read_body()
        mode = body.get('mode', 'keep_pc') if isinstance(body, dict) else 'keep_pc'
        if mode not in ('keep_pc', 'add_only', 'android_wins'):
            mode = 'keep_pc'
        payload = body.get('payload') if isinstance(body, dict) and 'payload' in body else body
        folders, prompt_sets = normalize_import_payload(payload)
        import_mode = 'replace' if mode == 'android_wins' else mode
        preview = build_sync_preview(folders, prompt_sets, mode=import_mode, source='Android')
        result = merge_import_payload(folders, prompt_sets, mode=import_mode, source='Android')
        if result is None:
            self.send_error_json('无效同步数据格式')
            return
        result['deviceName'] = self.headers.get('X-Device-Name', 'Android')
        result['preview'] = preview
        self.send_json(result)

    def handle_sync_preview(self):
        if not self._sync_token_valid():
            self.send_error_json('同步令牌无效，请重新配对', 401)
            return
        body = self.read_body()
        mode = body.get('mode', 'keep_pc') if isinstance(body, dict) else 'keep_pc'
        if mode not in ('keep_pc', 'add_only', 'android_wins', 'pull', 'bidirectional'):
            mode = 'keep_pc'
        payload = body.get('payload') if isinstance(body, dict) and 'payload' in body else body
        folders, prompt_sets = normalize_import_payload(payload)
        preview_mode = 'replace' if mode == 'android_wins' else mode
        if preview_mode in ('pull', 'bidirectional'):
            preview_mode = 'keep_pc'
        preview = build_sync_preview(folders, prompt_sets, mode=preview_mode, source='Android')
        if preview is None:
            self.send_error_json('无效同步预览数据格式')
            return
        self.send_json(preview)

    def handle_sync_bidirectional(self):
        if not self._sync_token_valid():
            self.send_error_json('同步令牌无效，请重新配对', 401)
            return
        body = self.read_body()
        mode = body.get('mode', 'keep_pc') if isinstance(body, dict) else 'keep_pc'
        if mode not in ('keep_pc', 'add_only', 'android_wins'):
            mode = 'keep_pc'
        payload = body.get('payload') if isinstance(body, dict) and 'payload' in body else body
        folders, prompt_sets = normalize_import_payload(payload)
        import_mode = 'replace' if mode == 'android_wins' else mode
        preview = build_sync_preview(folders, prompt_sets, mode=import_mode, source='Android')
        result = merge_import_payload(folders, prompt_sets, mode=import_mode, source='Android')
        if result is None:
            self.send_error_json('无效同步数据格式')
            return
        self.send_json({
            'success': True,
            'pushReport': result,
            'syncData': build_sync_payload(),
            'preview': preview,
        })

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
    global SERVER_PORT
    app_dir = get_app_dir()
    os.chdir(app_dir)
    ensure_dirs()

    port = 8888
    SERVER_PORT = port

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

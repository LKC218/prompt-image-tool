"""只管理专属目录中带标识的任务；锁文件保护跨进程活跃任务。"""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import time
import uuid

ROOT = Path(tempfile.gettempdir()) / 'PromptImageManager' / 'image-tasks-v1'
TTL = 24 * 3600

def linked(path):
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & 0x400)

def root():
    # 禁止跟随 Windows 联接或符号链接进入其他目录。
    for parent in (ROOT.parent, ROOT):
        if parent.exists() and linked(parent):
            raise ValueError('图片临时目录不能是链接')
    ROOT.mkdir(parents=True, exist_ok=True)
    return ROOT.resolve()

def lock(file):
    file.seek(0)
    if os.name == 'nt':
        import msvcrt
        msvcrt.locking(file.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl
        fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)

@contextmanager
def task():
    folder = root() / ('task-' + uuid.uuid4().hex)
    folder.mkdir()
    lease = (folder / 'lease').open('w+b')
    lease.write(b'1'); lease.flush(); lock(lease)
    (folder / 'owner.json').write_text(json.dumps({'owner':'PromptImageManager-image-v1','created':time.time()}),encoding='utf-8')
    try:
        yield folder
    finally:
        lease.close()
        # 路径由本函数生成，不接收客户端路径。
        shutil.rmtree(folder, ignore_errors=True)

def scan(clean=False):
    base = root()
    total = stale = removed = count = 0
    for folder in base.iterdir():
        if not re.fullmatch(r'task-[a-f0-9]{32}', folder.name) or not folder.is_dir() or linked(folder):
            continue
        try:
            children = list(folder.iterdir())
            if any(linked(p) or not p.is_file() for p in children):
                continue
            marker = json.loads((folder/'owner.json').read_text(encoding='utf-8'))
            if marker.get('owner') != 'PromptImageManager-image-v1':
                continue
            size = sum(p.stat().st_size for p in children)
            total += size; count += 1
            if time.time() - float(marker['created']) < TTL:
                continue
            with (folder/'lease').open('r+b') as lease:
                lock(lease)
            stale += size
            if clean:
                # 再核对最终路径仍是专属根目录的直接子目录。
                if folder.resolve().parent != base:
                    continue
                shutil.rmtree(folder)
                removed += size
        except (OSError, ValueError, KeyError):
            continue
    return {'bytes':total-removed,'staleBytes':stale-removed,'removedBytes':removed,'tasks':count}

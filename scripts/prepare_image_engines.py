"""准备固定 JPEG 无损引擎及许可证，运行时不下载程序。"""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile
from prepare_png_engine import prepare as prepare_png

URL = 'https://github.com/tjko/jpegoptim/releases/download/v1.5.6/jpegoptim-1.5.6-x64-windows.zip'
DIGEST = 'db2d8caee88f2665b772c4591cba223b8b729500b88266dc06d4bf79d28fe11a'
DEST = Path(__file__).resolve().parents[1] / 'vendor' / 'jpegoptim'

def prepare():
    prepare_png()
    DEST.mkdir(parents=True, exist_ok=True)
    try:
        manifest=json.loads((DEST/'engine.json').read_text(encoding='utf-8'))
        if manifest['archiveSha256']==DIGEST and manifest['version']=='1.5.6' and hashlib.sha256((DEST/'jpegoptim.exe').read_bytes()).hexdigest()==manifest['sha256'] and all((DEST/name).is_file() for name in ('LICENSE','COPYRIGHT','README')):
            print('JPEG 引擎已准备并通过摘要校验')
            return
    except (OSError,ValueError,KeyError):
        pass
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive = response.read(20 * 1024 * 1024)
    if hashlib.sha256(archive).hexdigest() != DIGEST:
        raise RuntimeError('JPEG 引擎归档摘要不匹配')
    with zipfile.ZipFile(io.BytesIO(archive)) as package:
        for name in ('jpegoptim.exe', 'LICENSE', 'COPYRIGHT', 'README'):
            (DEST / name).write_bytes(package.read(name))
    (DEST / 'engine.json').write_text(json.dumps({'version':'1.5.6','source':URL,
        'archiveSha256':DIGEST,'sha256':hashlib.sha256((DEST/'jpegoptim.exe').read_bytes()).hexdigest()},indent=2),encoding='utf-8')
    print('JPEG 引擎及 GPL 许可已准备，发布时须同时履行对应源码提供义务')

if __name__ == '__main__':
    prepare()

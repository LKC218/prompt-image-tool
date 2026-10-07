"""为 Windows 发布准备固定引擎对应源码、构建说明和许可证附件。"""
import hashlib
import json
import shutil
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    ('jpegoptim-1.5.6.tar.gz', 'https://github.com/tjko/jpegoptim/releases/download/v1.5.6/jpegoptim-1.5.6.tar.gz',
     '661a808dfffa933d78c6beb47a2937d572b9f03e94cbaaab3d4c0d72f410e9be'),
    ('mozjpeg-4.1.1.tar.gz', 'https://codeload.github.com/mozilla/mozjpeg/tar.gz/refs/tags/v4.1.1',
     '66b1b8d6b55d263f35f27f55acaaa3234df2a401232de99b6d099e2bb0a9d196'),
)


def main():
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    cache = ROOT / 'output' / f'release-{version}'
    cache.mkdir(parents=True, exist_ok=True)
    release = ROOT / 'releases' / f'PromptImageManager-ThirdPartySources-{version}.zip'
    release.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(release, 'w', zipfile.ZIP_DEFLATED) as package:
        for name, url, digest in SOURCES:
            path = cache / name
            if not path.exists():
                with urllib.request.urlopen(url, timeout=60) as response:
                    path.write_bytes(response.read(30 * 1024 * 1024))
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise RuntimeError(f'源码摘要不匹配：{name}')
            package.write(path, name)
            # 保留源码本身，并另列 MozJPEG 的许可文件，便于直接阅读。
            if name.startswith('mozjpeg'):
                with tarfile.open(path) as archive:
                    for member in archive.getmembers():
                        if member.isfile() and Path(member.name).name in ('LICENSE.md', 'README.ijg', 'LICENSE'):
                            stream = archive.extractfile(member)
                            package.writestr('mozjpeg-licenses/' + Path(member.name).name, stream.read())
        package.write(ROOT / 'docs/构建方案/第三方图片引擎分发说明.md', '第三方图片引擎分发说明.md')
        for engine in ('jpegoptim', 'oxipng'):
            for name in ('LICENSE', 'COPYRIGHT', 'README', 'engine.json'):
                path = ROOT / 'vendor' / engine / name
                if path.is_file():
                    package.write(path, f'{engine}/{name}')
        package.writestr('sources.json', json.dumps([
            {'file': name, 'url': url, 'sha256': digest} for name, url, digest in SOURCES
        ], ensure_ascii=False, indent=2))
    target = ROOT / 'src-tauri' / 'third-party'
    target.mkdir(exist_ok=True)
    shutil.copy2(release, target / 'image-engine-sources.zip')
    shutil.copy2(ROOT / 'docs/构建方案/第三方图片引擎分发说明.md', target / '第三方图片引擎分发说明.md')
    print(f'源码附件已准备：{release.name} SHA256={hashlib.sha256(release.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    main()

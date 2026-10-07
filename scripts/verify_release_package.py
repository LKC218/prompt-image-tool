"""只读校验正式包的版本、元数据、资源白名单和第三方源码附件。"""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
    assert lock['version'] == lock['packages']['']['version'] == version
    for name in ('src-tauri/tauri.conf.json', 'installer-shell/package.json', 'installer-shell/src-tauri/tauri.conf.json'):
        assert json.loads((ROOT / name).read_text(encoding='utf-8'))['version'] == version
    html = (ROOT / 'src/index.html').read_text(encoding='utf-8')
    assert f'name="version" content="{version}"' in html
    notes = (ROOT / 'src/js/release/release-notes-data.js').read_text(encoding='utf-8')
    assert re.search(r"version:\s*'([^']+)'", notes)[1] == version
    meta = json.loads((ROOT / 'releases/latest.json').read_text(encoding='utf-8'))
    setup = ROOT / 'releases' / f'PromptImageManager-Setup-{version}.exe'
    assert meta['version'] == version
    assert meta['url'] == f'https://github.com/LKC218/prompt-image-tool/releases/download/v{version}/{setup.name}'
    assert meta['sha256'] == hashlib.sha256(setup.read_bytes()).hexdigest()
    installer = (ROOT / 'src-tauri/target/release/nsis/x64/installer.nsi').read_text(encoding='utf-8')
    file_lines = [line for line in installer.splitlines() if line.strip().startswith('File ')]
    assert file_lines and any('image-engine-sources.zip' in line for line in file_lines)
    forbidden = ('prompt_sets.json', 'folders.json', 'goal_images', 'sync-device.json', '\\python\\data\\', '\\output\\', '\\.workbuddy\\')
    assert not any(value in line for line in file_lines for value in forbidden)
    sources = ROOT / 'releases' / f'PromptImageManager-ThirdPartySources-{version}.zip'
    installed_sources = ROOT / 'src-tauri/third-party/image-engine-sources.zip'
    assert sources.read_bytes() == installed_sources.read_bytes()
    with zipfile.ZipFile(sources) as archive:
        for item in json.loads(archive.read('sources.json')):
            assert hashlib.sha256(archive.read(item['file'])).hexdigest() == item['sha256']
    result = dict(version=version, size=setup.stat().st_size, sha256=meta['sha256'],
                  resourceFileCount=len(file_lines), metadataCompatible=True, privateDataExcluded=True,
                  sourceSha256=hashlib.sha256(sources.read_bytes()).hexdigest())
    output = ROOT / 'output' / f'release-{version}'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'package-check.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()

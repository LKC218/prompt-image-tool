"""启动真实冻结 Sidecar，隔离数据并回读三格式处理结果，不连接用户资料库。"""
import email.policy
from email.parser import BytesParser
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    output = ROOT / 'output' / f'release-{version}' / 'frozen'
    data = output / 'profile' / 'data'
    data.mkdir(parents=True, exist_ok=True)
    (data / 'prompt_sets.json').write_text('[]', encoding='utf-8')
    env = dict(os.environ, PROMPT_IMAGE_TOOL_DATA_DIR=str(data.parent))
    executable = ROOT / 'build/dist-server/PromptImageManager-Server.exe'
    results = []
    with (output / 'sidecar.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen([str(executable)], env=env, stdout=log, stderr=log,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        try:
            deadline = time.time() + 30
            base = None
            while time.time() < deadline:
                if process.poll() is not None:
                    raise RuntimeError('冻结后端退出，查看 sidecar.log')
                for port in range(8888, 8898):
                    try:
                        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=.3) as response:
                            health = json.load(response)
                        if Path(health.get('dataDir', '')).resolve() == data.resolve():
                            base = f'http://127.0.0.1:{port}'
                            break
                    except (OSError, ValueError):
                        pass
                if base:
                    break
                time.sleep(.1)
            if not base:
                raise RuntimeError('未发现隔离后端')
            with urllib.request.urlopen(base + '/api/image-process/status') as response:
                status = json.load(response)
            assert status['ready']
            headers = {'Content-Type': 'application/octet-stream', 'X-Png-Token': status['token']}
            for source in ('png', 'jpeg', 'webp'):
                stream = io.BytesIO()
                Image.new('RGB', (96, 80), (60, 140, 210)).save(stream, format=source.upper())
                for target in ('png', 'jpeg', 'webp', 'original'):
                    for resize in (False, True):
                        output_format = source if target == 'original' else target
                        options = dict(operation='optimize' if target == 'original' else 'convert', target=output_format, ack='true',
                                       encoding='lossy' if target == 'jpeg' else 'lossless')
                        if resize:
                            options.update(resize='true', resizeMode='longest', longest=48)
                        request = urllib.request.Request(base + '/api/image-process?' + urllib.parse.urlencode(options),
                                                         data=stream.getvalue(), headers=headers)
                        try:
                            with urllib.request.urlopen(request, timeout=100) as response:
                                message = BytesParser(policy=email.policy.default).parsebytes(
                                    ('Content-Type: ' + response.headers['Content-Type'] + '\r\n\r\n').encode() + response.read())
                        except urllib.error.HTTPError as error:
                            raise RuntimeError(error.read().decode('utf-8')) from error
                        parts = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True)
                                 for part in message.iter_parts()}
                        actual = Image.open(io.BytesIO(parts['image']))
                        expected = (48, 40) if resize else (96, 80)
                        assert actual.size == expected and actual.format.lower() == output_format
                        report = json.loads(parts['report'])
                        results.append(dict(source=source, target=target, resize=resize,
                                            size=actual.size, status=report['status']))
            with urllib.request.urlopen(base + '/api/prompt-sets') as response:
                assert json.load(response) == []
            summary = dict(version=version, sidecarSha256=hashlib.sha256(executable.read_bytes()).hexdigest(),
                           dataDir=str(data), cases=results, passed=len(results))
            (output / 'result.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'冻结 Sidecar 通过：{len(results)} 项真实转换/缩放，隔离资料库为空')
        finally:
            if process.poll() is None:
                # PyInstaller onefile 的父进程另有工作子进程，必须清理本次进程树。
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                else:
                    process.terminate()
            process.wait(timeout=10)


if __name__ == '__main__':
    main()

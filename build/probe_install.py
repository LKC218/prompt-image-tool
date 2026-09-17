# -*- coding: utf-8 -*-
"""安装包探针：以隔离数据目录启动打包版 exe，验证 goal API 全链路与版本信息。"""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

EXE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist', 'PromptImageManager', 'PromptImageManager.exe')
SETUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'PromptImageManager-Setup-2.5.2.exe')
PORT = 8888

# 1x1 透明 PNG
PNG_B64 = base64.b64encode(bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000d4944415478da63fcffff3f030005fe02fea72d5e2b0000000049454e44ae426082'
)).decode()


def api(method, path, payload=None, timeout=5):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', method=method)
    req.add_header('Content-Type', 'application/json')
    data = json.dumps(payload).encode() if payload is not None else None
    with urllib.request.urlopen(req, data=data, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode())


def main():
    global PORT
    data_dir = tempfile.mkdtemp(prefix='pim_probe_')
    env = dict(os.environ)
    env['PROMPT_IMAGE_TOOL_DATA_DIR'] = data_dir
    log_path = os.path.join(os.path.dirname(EXE), 'app.log')
    if os.path.exists(log_path):
        os.remove(log_path)

    proc = subprocess.Popen([EXE], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f'探针进程 PID={proc.pid}，隔离数据目录={data_dir}')

    # 绝对时间同步：以 time.time() 为基准轮询 app.log 获取实际端口，再探活
    deadline = time.time() + 30
    port = None
    while time.time() < deadline:
        if os.path.exists(log_path):
            match = re.search(r'Server started on 0\.0\.0\.0:(\d+)', open(log_path, encoding='utf-8').read())
            if match:
                port = int(match.group(1))
                PORT = port
                break
        time.sleep(0.3)
    if port is None:
        proc.kill()
        print('[失败] 30 秒内未从 app.log 解析到服务端口')
        sys.exit(1)

    ready = False
    while time.time() < deadline:
        try:
            status, health = api('GET', '/api/health', timeout=2)
            if status == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.3)
    if not ready:
        proc.kill()
        print('[失败] 服务在期限内未就绪')
        sys.exit(1)
    print(f'[通过] /api/health 就绪（端口 {port}），dataDir={health.get("dataDir")}')

    checks = []
    try:
        # 1. goal 工程列表初始为空
        status, body = api('GET', '/api/goals/projects')
        checks.append(('GET /api/goals/projects 初始为空', status == 200 and body == []))

        # 2. 创建工程
        status, body = api('POST', '/api/goals/projects', {'name': '探针工程'})
        pid = body.get('id')
        checks.append(('POST /api/goals/projects 创建工程', status == 200 and body.get('name') == '探针工程' and body.get('taskCount') == 0))

        # 3. 写入父子任务树
        tasks = [{
            'id': 't1', 'title': '父任务', 'completed': True, 'order': 0, 'parentId': '',
            'children': [{'id': 't2', 'title': '子任务', 'completed': False, 'order': 0, 'parentId': 't1', 'children': []}],
        }]
        status, body = api('POST', f'/api/goals/projects/{pid}/tasks', {'tasks': tasks})
        checks.append(('POST /tasks 写入任务树', status == 200 and len(body) == 1 and body[0]['children'][0]['id'] == 't2'))

        # 4. 工程统计（2 任务 1 完成 50%）
        status, body = api('GET', f'/api/goals/projects/{pid}')
        checks.append(('工程统计 2/1/50%', body.get('taskCount') == 2 and body.get('completedCount') == 1 and body.get('progress') == 50))

        # 5. 上传任务图片
        status, body = api('POST', '/api/goals/images/upload', {'projectId': pid, 'imageId': 'img1', 'data': f'data:image/png;base64,{PNG_B64}'})
        img_path = body.get('path')
        checks.append(('POST /api/goals/images/upload', status == 200 and img_path and img_path.startswith(f'goal_images/{pid}/')))

        # 6. 图片可访问
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/goals/images/{img_path}', timeout=5) as resp:
            img_status = resp.status
        checks.append(('GET /api/goals/images/{path} 图片可访问', img_status == 200))

        # 7. 更新单任务
        status, body = api('POST', f'/api/goals/projects/{pid}/tasks/t2', {'completed': True})
        status, body = api('GET', f'/api/goals/projects/{pid}')
        checks.append(('POST /tasks/{taskId} 更新单任务', body.get('completedCount') == 2 and body.get('progress') == 100))

        # 8. 删除工程（含图片清理）
        status, body = api('DELETE', f'/api/goals/projects/{pid}')
        img_file = os.path.join(data_dir, 'data', img_path.replace('/', os.sep))
        checks.append(('DELETE /api/goals/projects/{id} 删除并清理图片', status == 200 and not os.path.exists(img_file)))

        # 9. 数据落盘
        goals_file = os.path.join(data_dir, 'data', 'goals.json')
        checks.append(('goals.json 落盘且为空库', os.path.exists(goals_file) and json.load(open(goals_file, encoding='utf-8')) == {'projects': []}))

        # 10. 挂机植物档：GET 空 → POST → GET 一致 → plant.json 落盘
        status, body = api('GET', '/api/plant')
        checks.append(('GET /api/plant 初始为空', status == 200 and (body.get('plant') is None)))
        plant_payload = {
            'schemaVersion': 1,
            'plant': {
                'cycleStartAt': 1700000000000,
                'todayKey': '2026-01-01',
                'care': {'watered': True, 'fertilized': False, 'deugged': False},
                'activeDays': 2,
                'totalCycles': 1,
            },
            'updatedAt': '2026-01-01T00:00:00',
        }
        status, body = api('POST', '/api/plant', plant_payload)
        checks.append(('POST /api/plant 写入', status == 200 and body.get('plant', {}).get('care', {}).get('watered') is True))
        status, body = api('GET', '/api/plant')
        checks.append(('GET /api/plant 回读一致', body.get('plant', {}).get('totalCycles') == 1))
        plant_file = os.path.join(data_dir, 'data', 'plant.json')
        plant_ok = os.path.exists(plant_file)
        if plant_ok:
            plant_ok = json.load(open(plant_file, encoding='utf-8')).get('plant', {}).get('care', {}).get('watered') is True
        checks.append(('plant.json 落盘', plant_ok))

        # 11. 备份导出包含 plant
        status, body = api('GET', '/api/export')
        checks.append(('GET /api/export 含 plant', status == 200 and isinstance(body.get('plant'), dict)))
    finally:
        proc.kill()
        proc.wait(timeout=10)

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(('[通过] ' if ok else '[失败] ') + name)
    if failed:
        sys.exit(1)

    # 产物信息
    size = os.path.getsize(SETUP)
    sha = hashlib.sha256(open(SETUP, 'rb').read()).hexdigest()
    print(f'\n[产物] PromptImageManager-Setup-2.5.2.exe')
    print(f'  大小: {size:,} 字节 ({size / 1024 / 1024:.1f} MB)')
    print(f'  SHA256: {sha}')
    print('\n安装探针全部通过')


if __name__ == '__main__':
    main()

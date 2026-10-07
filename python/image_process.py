"""图片处理入口；受限上传、隔离进程、取消及专属缓存管理。"""
import hashlib
import json
from pathlib import Path
import re
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid
import png_compress as png
import image_cache
from image_resize import normalize_resize, calculate_resize

UPLOAD = threading.BoundedSemaphore(1)
MIME = {'png':'image/png','jpeg':'image/jpeg','webp':'image/webp'}

def jpeg_engine():
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1]))/'vendor'/'jpegoptim'
    try:
        manifest = json.loads((base/'engine.json').read_text(encoding='utf-8'))
        binary = base/'jpegoptim.exe'
        if manifest['version'] != '1.5.6' or hashlib.sha256(binary.read_bytes()).hexdigest() != manifest['sha256']:
            raise ValueError('摘要不匹配')
        return binary
    except (OSError, KeyError, ValueError) as error:
        raise ValueError('请先运行 scripts/prepare_image_engines.py 准备图片引擎') from error

def options(query):
    get = lambda key, default: query.get(key,[default])[0]
    config = dict(operation=get('operation','optimize'), target=get('target','png'),
        encoding=get('encoding','lossless'), quality=int(get('quality','85')),
        background=get('background','#ffffff'),level=int(get('level','2')),
        threads=int(get('threads','2')),budget=int(get('budget','60')),action='process')
    png.compression_options(level=config['level'],threads=config['threads'],budget=config['budget'])
    if config['operation'] not in ('optimize','convert') or config['target'] not in MIME or config['encoding'] not in ('lossless','lossy'):
        raise ValueError('处理模式或输出格式无效')
    if not 1 <= config['quality'] <= 100 or not re.fullmatch(r'#[0-9a-fA-F]{6}',config['background']):
        raise ValueError('质量或背景颜色无效')
    config.update(normalize_resize({key: value[0] for key, value in query.items()}))
    if (config['operation']=='convert' or config['encoding']=='lossy' or config['resize']) and get('ack','false') != 'true':
        raise ValueError('请确认转换与有损编码的元数据变化提示')
    return config

def child(args, event, deadline):
    if event.is_set(): raise ValueError('任务已取消')
    process = subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        while True:
            if event.is_set(): raise ValueError('任务已取消')
            if time.monotonic() >= deadline: raise ValueError('单图处理超过 90 秒')
            try:
                if process.wait(timeout=.1) != 0: raise ValueError('图片引擎处理失败，原图未修改')
                return
            except subprocess.TimeoutExpired: pass
    finally:
        if process.poll() is None: process.kill()
        process.wait()

def worker(folder, config, event, deadline):
    (folder/'config.json').write_text(json.dumps(config),encoding='utf-8')
    args = [sys.executable,'--image-worker',str(folder)] if getattr(sys,'frozen',False) else [sys.executable,str(Path(__file__).with_name('image_worker.py')),str(folder)]
    child(args,event,deadline)
    report = json.loads((folder/'report.json').read_text(encoding='utf-8'))
    if report.get('error'): raise ValueError(report['error'])
    return report

def process(data, config, job, deadline=None):
    if not re.fullmatch(r'[a-f0-9-]{36}',job): raise ValueError('任务标识无效')
    if deadline is None: deadline = time.monotonic()+90
    config = dict(config, **normalize_resize(config))
    if config['action'] != 'inspect' and config['resize']:
        _, source = process(data, dict(config, action='inspect'), job, deadline)
        if source['depth'] > 8: raise ValueError('高位深 PNG 不支持调整尺寸，不自动降位深')
        if source['mode'] not in ('RGB','RGBA','L','LA','P','1'): raise ValueError('特殊色彩模式不支持调整尺寸，不自动转色')
        size = calculate_resize(source['width'], source['height'], config)
        if not size['changed']:
            result, report = process(data, dict(config, resize=False), job, deadline)
            report.update(source=source, output=dict(width=source['width'],height=source['height']), resized=False)
            return result, report
    if config['action'] != 'inspect' and not config['resize'] and data.startswith(png.SIGNATURE) and config['operation']=='optimize':
        result,status = png.compress(data,'standard',job,level=config['level'],threads=config['threads'],budget=config['budget'],deadline=deadline)
        return result,dict(format='png',status=status,metadata=[],notes=['PNG 保持无损，不使用有损质量参数'])
    if not png.SLOT.acquire(blocking=False): raise ValueError('图片服务忙，请稍后重试')
    event = threading.Event()
    try:
        with png.LOCK:
            if job in png.CANCELLED: raise ValueError('任务已取消')
            png.ACTIVE[job] = event
        with image_cache.task() as folder:
            (folder/'input').write_bytes(data)
            if config['action'] != 'inspect' and not config['resize'] and data.startswith(b'\xff\xd8') and config['operation']=='optimize' and config['encoding']=='lossless':
                worker(folder,dict(config,action='inspect'),event,deadline)
                (folder/'candidate.jpg').write_bytes(data)
                child([str(jpeg_engine()),'--quiet','--strip-none','--nofix',str(folder/'candidate.jpg')],event,deadline)
                config = dict(config,action='verify-jpeg')
            report = worker(folder,config,event,deadline)
            if event.is_set(): raise ValueError('任务已取消')
            return (None if config['action']=='inspect' else (folder/'output').read_bytes()),report
    finally:
        with png.LOCK: png.ACTIVE.pop(job,None)
        png.SLOT.release()

def handle_request(handler):
    parsed = urllib.parse.urlsplit(handler.path)
    if not png.allowed_request(handler):
        handler.send_error_json('仅允许本机访问图片处理',403); return
    try:
        if handler.command=='GET' and parsed.path=='/api/image-process/status':
            from PIL import features
            png.engine_path(); jpeg_engine()
            if not features.check('webp'): raise ValueError('当前 Pillow 不支持 WebP')
            handler.send_json(dict(ready=True,token=png.TOKEN,version='PNG / JPEG / WebP',cache=image_cache.scan(clean=True))); return
        if handler.command!='POST' or not secrets.compare_digest(handler.headers.get('X-Png-Token',''),png.TOKEN):
            handler.send_error_json('图片处理会话无效，请重新连接',403); return
        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path=='/api/image-process/cancel':
            png.cancel(query.get('job',[''])[0]); handler.send_json({'cancelled':True}); return
        if parsed.path=='/api/image-process/cache-clean':
            handler.send_json(image_cache.scan(clean=True)); return
        if parsed.path not in ('/api/image-process','/api/image-process/inspect'):
            handler.send_error_json('接口不存在',404); return
        config = options(query)
        if parsed.path.endswith('/inspect'): config['action']='inspect'
        if not UPLOAD.acquire(blocking=False):
            handler.send_error_json('正在处理其他图片，请稍后重试',429); return
        try:
            size = int(handler.headers.get('Content-Length','0'))
            if not 0 < size <= png.MAX_FILE or handler.headers.get('Content-Type')!='application/octet-stream':
                raise ValueError('仅接收 20 MB 以内的图片二进制')
            handler.connection.settimeout(30)
            data = handler.rfile.read(size)
            if len(data)!=size: raise ValueError('上传不完整')
            result,report = process(data,config,query.get('job',[str(uuid.uuid4())])[0])
            if result is None: handler.send_json(report); return
            boundary = 'image-'+uuid.uuid4().hex
            payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="report"\r\nContent-Type: application/json\r\n\r\n'.encode()+json.dumps(report,ensure_ascii=False).encode()+
                f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="result"\r\nContent-Type: {MIME[report["format"]]}\r\n\r\n'.encode()+result+f'\r\n--{boundary}--\r\n'.encode())
            handler.send_response(200)
            handler.send_header('Content-Type','multipart/form-data; boundary='+boundary)
            handler.send_header('Content-Length',str(len(payload)))
            handler.send_header('Cache-Control','no-store')
            handler.send_header('Access-Control-Allow-Origin',handler.headers.get('Origin','*'))
            handler.end_headers(); handler.wfile.write(payload)
        finally: UPLOAD.release()
    except (BrokenPipeError,ConnectionResetError): pass
    except (ValueError,OSError,ImportError) as error:
        handler.send_error_json(str(error),400)

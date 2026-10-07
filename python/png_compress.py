"""隔离 PNG 压缩：原始字节进出，不读写图库，严格保留像素及非 IDAT 数据。"""
import array
import hashlib
import json
from pathlib import Path
import re
import secrets
import struct
import subprocess
import sys
import threading
import time
import urllib.parse
import zlib
from image_cache import task as image_task

MAX_FILE = 20 * 1024 * 1024
MAX_PIXELS = 16_000_000
MAX_RAW = 128 * 1024 * 1024
TOKEN = secrets.token_urlsafe(32)
SLOT = threading.BoundedSemaphore(1)
LOCK = threading.Lock()
ACTIVE = {}
CANCELLED = {}
SIGNATURE = b"\x89PNG\r\n\x1a\n"

class CompressionError(ValueError):
    pass

def engine_path():
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    folder = root / "vendor" / "oxipng"
    binary = folder / "oxipng.exe"
    try:
        manifest = json.loads((folder / "engine.json").read_text(encoding="utf-8"))
        if manifest["version"] != "10.2.1" or hashlib.sha256(binary.read_bytes()).hexdigest() != manifest["sha256"]:
            raise ValueError()
    except (OSError, ValueError, KeyError):
        raise CompressionError("压缩引擎未准备或校验失败，请运行 scripts/prepare_png_engine.py")
    return binary

def inspect_png(data):
    if not data.startswith(SIGNATURE) or len(data) > MAX_FILE:
        raise CompressionError("不是有效 PNG 或文件超过 20 MB")
    pos, chunks, idats = 8, [], []
    while pos < len(data):
        if pos + 12 > len(data):
            raise CompressionError("PNG 数据块不完整")
        size = struct.unpack(">I", data[pos:pos + 4])[0]
        end = pos + size + 12
        if end > len(data):
            raise CompressionError("PNG 数据块长度错误")
        kind, payload = data[pos + 4:pos + 8], data[pos + 8:end - 4]
        if zlib.crc32(kind + payload) & 0xffffffff != struct.unpack(">I", data[end - 4:end])[0]:
            raise CompressionError("PNG 校验和错误")
        if kind in (b"acTL", b"fcTL", b"fdAT"):
            raise CompressionError("暂不支持 APNG 动画，请使用静态 PNG")
        chunks.append((kind, payload))
        if kind == b"IDAT":
            idats.append(payload)
        pos = end
        if kind == b"IEND":
            break
    if pos != len(data) or not chunks or chunks[0][0] != b"IHDR" or chunks[-1] != (b"IEND", b"") or not idats:
        raise CompressionError("PNG 结构错误或存在尾随数据")
    if len(chunks[0][1]) != 13:
        raise CompressionError("PNG 头部错误")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunks[0][1])
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color, 0)
    valid_depth = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
    if not width or not height or width * height > MAX_PIXELS:
        raise CompressionError("图片像素超过 1600 万或尺寸无效")
    if not channels or depth not in valid_depth[color] or compression or filtering or interlace not in (0, 1):
        raise CompressionError("PNG 编码参数无效")
    # 在解码库读取前限制解压量，防止压缩炸弹。
    bound = min(MAX_RAW, ((width * channels * depth + 7) // 8 + 16) * height + 128)
    decoder = zlib.decompressobj()
    try:
        raw = decoder.decompress(b"".join(idats), bound + 1)
    except zlib.error as error:
        raise CompressionError("PNG 压缩数据损坏") from error
    if len(raw) > bound or decoder.unconsumed_tail or not decoder.eof or decoder.unused_data:
        raise CompressionError("PNG 解压量异常或数据不完整")
    return chunks, (width, height, depth, color, interlace)

def pixel_hash(data, event=None):
    try:
        import png
        width, height, rows, info = png.Reader(bytes=data).read()
        digest = hashlib.sha256()
        for row in rows:
            if event and event.is_set():
                raise CompressionError("任务已取消")
            digest.update(array.array("H" if info["bitdepth"] == 16 else "B", row).tobytes())
        return digest.hexdigest()
    except CompressionError:
        raise
    except Exception as error:
        raise CompressionError("PNG 无法完整解码") from error

def cancel(job):
    if not re.fullmatch(r"[a-f0-9-]{36}", job):
        raise CompressionError("任务标识无效")
    with LOCK:
        now = time.monotonic()
        for key in list(CANCELLED):
            if now - CANCELLED[key] > 120:
                del CANCELLED[key]
        if len(CANCELLED) >= 128:
            CANCELLED.pop(next(iter(CANCELLED)))
        CANCELLED[job] = now
        if job in ACTIVE:
            ACTIVE[job].set()

def compression_options(mode="standard", level=None, threads=2, budget=60):
    if mode not in ("standard", "deep"):
        raise CompressionError("压缩参数无效")
    level = (2 if mode == "standard" else 4) if level is None else level
    if (type(level) is not int or not 0 <= level <= 6 or
            type(threads) is not int or not 1 <= threads <= 4 or
            type(budget) is not int or budget not in (15, 30, 60)):
        raise CompressionError("等级须为 0–6，线程须为 1–4，时间预算须为 15、30 或 60 秒")
    return level, threads, budget


def compress(data, mode, job, *, level=None, threads=2, budget=60, deadline=None):
    level, threads, budget = compression_options(mode, level, threads, budget)
    if mode not in ("standard", "deep") or not re.fullmatch(r"[a-f0-9-]{36}", job):
        raise CompressionError("压缩参数无效")
    if not SLOT.acquire(blocking=False):
        raise CompressionError("压缩服务忙，请稍后重试")
    event = threading.Event()
    try:
        with LOCK:
            if job in CANCELLED:
                raise CompressionError("任务已取消")
            ACTIVE[job] = event
        binary = engine_path()
        chunks, info = inspect_png(data)
        original_hash = pixel_hash(data, event)
        with image_task() as folder:
            src, dst = Path(folder) / "input.png", Path(folder) / "result.png"
            src.write_bytes(data)
            args = [str(binary), "-o", str(level), "--nx",
                    "--interlace", "keep", "--threads", str(threads), "--timeout", str(budget),
                    "--max-raw-size", str(MAX_RAW), "--out", str(dst), str(src)]
            if event.is_set():
                raise CompressionError("任务已取消")
            process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            deadline = min(deadline, time.monotonic() + 90) if deadline is not None else time.monotonic() + 90
            try:
                while True:
                    if event.is_set():
                        raise CompressionError("任务已取消")
                    if time.monotonic() >= deadline:
                        raise CompressionError("单图处理超过 90 秒，请使用标准模式或较小图片")
                    try:
                        code = process.wait(timeout=0.1)
                        break
                    except subprocess.TimeoutExpired:
                        continue
                if code != 0:
                    raise CompressionError("压缩引擎无法处理此 PNG，原图未修改")
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()
            candidate = dst.read_bytes() if dst.exists() else data
        new_chunks, new_info = inspect_png(candidate)
        # 严格保留所有非 IDAT 块，不以“看起来一样”代替元数据保真。
        metadata_same = [c for c in chunks if c[0] != b"IDAT"] == [c for c in new_chunks if c[0] != b"IDAT"]
        if info != new_info or not metadata_same:
            return data, "preserved"
        if pixel_hash(candidate, event) != original_hash:
            raise CompressionError("像素保真校验未通过，拒绝输出压缩结果")
        if event.is_set():
            raise CompressionError("任务已取消")
        return (candidate, "compressed") if len(candidate) < len(data) else (data, "unchanged")
    finally:
        with LOCK:
            ACTIVE.pop(job, None)
        SLOT.release()

def allowed_request(handler):
    origin = handler.headers.get("Origin", "")
    try:
        host = urllib.parse.urlsplit("//" + handler.headers.get("Host", "")).hostname
        source = urllib.parse.urlsplit(origin)
        return (handler.client_address[0] in ("127.0.0.1", "::1")
                and host in ("127.0.0.1", "localhost", "::1")
                and (not origin or (source.scheme in ("http", "https") and source.hostname in ("127.0.0.1", "localhost", "::1", "tauri.localhost"))
                     or origin == "tauri://localhost"))
    except ValueError:
        return False

def handle_request(handler):
    """由主处理器在全局业务数据锁之外调用。"""
    parsed = urllib.parse.urlsplit(handler.path)
    if not allowed_request(handler):
        handler.send_error_json("只允许本机应用使用图片压缩", 403)
        return
    if handler.command == "GET" and parsed.path == "/api/png-compress/status":
        try:
            engine_path()
            import png
            handler.send_json({"ready": True, "version": "10.2.1", "token": TOKEN})
        except (CompressionError, ImportError) as error:
            handler.send_json({"ready": False, "error": str(error)}, 503)
        return
    if handler.command != "POST" or not secrets.compare_digest(handler.headers.get("X-Png-Token", ""), TOKEN):
        handler.send_error_json("压缩会话无效，请重新进入页面", 403)
        return
    query = urllib.parse.parse_qs(parsed.query)
    job = query.get("job", [""])[0]
    try:
        if parsed.path == "/api/png-compress/cancel":
            cancel(job)
            handler.send_json({"cancelled": True})
            return
        if parsed.path != "/api/png-compress":
            handler.send_error_json("接口不存在", 404)
            return
        size = int(handler.headers.get("Content-Length", "0"))
        if size <= 0 or size > MAX_FILE or handler.headers.get("Content-Type") != "application/octet-stream":
            raise CompressionError("仅接收 20 MB 以内的 PNG 二进制文件")
        handler.connection.settimeout(30)
        data = handler.rfile.read(size)
        if len(data) != size:
            raise CompressionError("上传内容不完整")
        result, status = compress(data, query.get("mode", ["standard"])[0], job,
            level=int(query["level"][0]) if "level" in query else None,
            threads=int(query.get("threads", ["2"])[0]), budget=int(query.get("budget", ["60"])[0]))
        handler.send_response(200)
        handler.send_header("Content-Type", "image/png")
        handler.send_header("Content-Length", str(len(result)))
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Access-Control-Allow-Origin", handler.headers.get("Origin", "*"))
        handler.send_header("Access-Control-Expose-Headers", "X-Png-Status")
        handler.send_header("X-Png-Status", status)
        handler.end_headers()
        handler.wfile.write(result)
    except (BrokenPipeError, ConnectionResetError):
        pass
    except (CompressionError, ValueError, OSError) as error:
        handler.send_error_json(str(error), 400)


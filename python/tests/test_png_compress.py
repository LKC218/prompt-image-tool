"""真实引擎保真与输入边界测试；不访问业务数据。"""
import io
import os
from pathlib import Path
import struct
import sys
import threading
import time
import uuid
import zlib

import png
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import png_compress as service

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)

def fixture(depth=8, palette=False, interlace=False):
    stream = io.BytesIO()
    if palette:
        writer = png.Writer(96, 80, palette=[(12, 65, 180, 0), (50, 150, 60, 255)], bitdepth=1, compression=0, interlace=interlace)
        rows = [[(x+y)%2 for x in range(96)] for y in range(80)]
    else:
        writer = png.Writer(96, 80, greyscale=False, alpha=True, bitdepth=depth, compression=0, interlace=interlace)
        rows = [[v for x in range(96) for v in ((1025 if depth==16 else 17), (65530 if depth==16 else 70), 50, 0 if x%2 else (65535 if depth==16 else 255))] for y in range(80)]
    writer.write(stream, rows)
    data = stream.getvalue()
    metadata = chunk(b"tEXt", b"parameters\x00prompt: soft clouds; seed: 123") + chunk(b"gAMA", struct.pack(">I", 45455))
    return data[:33] + metadata + data[33:]

@pytest.mark.parametrize("depth,palette,interlace", [(8,False,False),(16,False,False),(8,True,False),(8,False,True)])
def test_real_engine_preserves_pixels_and_metadata(depth,palette,interlace):
    original = fixture(depth,palette,interlace)
    result, status = service.compress(original, "standard", str(uuid.uuid4()))
    assert len(result) <= len(original)
    assert status in ("compressed", "preserved")
    if status == "preserved":
        assert result == original
    assert service.pixel_hash(original) == service.pixel_hash(result)
    a, info_a = service.inspect_png(original)
    b, info_b = service.inspect_png(result)
    assert info_a == info_b
    assert [c for c in a if c[0] != b"IDAT"] == [c for c in b if c[0] != b"IDAT"]

def test_deep_and_recompression_never_grow():
    data = fixture()
    first, _ = service.compress(data,"deep",str(uuid.uuid4()))
    second, status = service.compress(first,"standard",str(uuid.uuid4()))
    assert len(second) <= len(first)
    assert service.pixel_hash(data) == service.pixel_hash(second)

@pytest.mark.parametrize("data,match", [(b"not png","有效"),(service.SIGNATURE+b"xxx","完整")])
def test_invalid_input(data,match):
    with pytest.raises(service.CompressionError,match=match):
        service.inspect_png(data)

def test_crc_and_tail():
    data = bytearray(fixture()); data[-1] ^= 1
    with pytest.raises(service.CompressionError,match="校验"):
        service.inspect_png(data)
    with pytest.raises(service.CompressionError,match="尾随"):
        service.inspect_png(fixture()+b"tail")

def test_apng_rejected():
    data = fixture()
    data = data[:33]+chunk(b"acTL",struct.pack(">II",1,0))+data[33:]
    with pytest.raises(service.CompressionError,match="APNG"):
        service.inspect_png(data)

def test_pixel_limit_and_bomb():
    data=fixture()
    large=service.SIGNATURE+chunk(b"IHDR",struct.pack(">IIBBBBB",100000,100000,8,6,0,0,0))+data[33:]
    with pytest.raises(service.CompressionError,match="像素"):
        service.inspect_png(large)
    bomb=service.SIGNATURE+chunk(b"IHDR",struct.pack(">IIBBBBB",1,1,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(bytes(4096)))+chunk(b"IEND",b"")
    with pytest.raises(service.CompressionError,match="解压"):
        service.inspect_png(bomb)

def test_cancel_before_start_and_busy():
    job=str(uuid.uuid4()); service.cancel(job)
    with pytest.raises(service.CompressionError,match="取消"):
        service.compress(fixture(),"standard",job)
    service.SLOT.acquire()
    try:
        with pytest.raises(service.CompressionError,match="忙"):
            service.compress(fixture(),"standard",str(uuid.uuid4()))
    finally:
        service.SLOT.release()

def test_cancel_running_process(monkeypatch):
    entered=threading.Event()
    class Slow:
        killed=False
        def __init__(self,*a,**k): entered.set()
        def wait(self,timeout=None):
            if self.killed:return -1
            entered.wait(.01)
            time.sleep(.01)
            raise service.subprocess.TimeoutExpired("test",timeout)
        def poll(self):return -1 if self.killed else None
        def kill(self):self.killed=True
    monkeypatch.setattr(service.subprocess,"Popen",Slow)
    job=str(uuid.uuid4()); failures=[]
    def work():
        try:service.compress(fixture(),"standard",job)
        except service.CompressionError as error:failures.append(str(error))
    thread=threading.Thread(target=work)
    thread.start()
    assert entered.wait(5)
    service.cancel(job);thread.join(5)
    assert not thread.is_alive()
    assert failures == ["任务已取消"]
    assert job not in service.ACTIVE

def test_metadata_change_falls_back(monkeypatch):
    original=fixture()
    class Changed:
        def __init__(self,args,**kwargs):
            pos=args.index("--out")+1
            parts,_=service.inspect_png(original)
            data=service.SIGNATURE+b"".join(chunk(t,d) for t,d in parts if t!=b"tEXt")
            Path(args[pos]).write_bytes(data)
        def wait(self,timeout=None):return 0
        def poll(self):return 0
    monkeypatch.setattr(service.subprocess,"Popen",Changed)
    result,status=service.compress(original,"standard",str(uuid.uuid4()))
    assert result==original and status=="preserved"

def test_origin_restrictions():
    class Request:
        client_address=("127.0.0.1",1)
        headers={"Host":"localhost:8898","Origin":"https://evil.example"}
    assert not service.allowed_request(Request())
    Request.headers["Origin"]="http://127.0.0.1:5174"
    assert service.allowed_request(Request())
    Request.headers["Host"]="evil.example"
    assert not service.allowed_request(Request())


@pytest.mark.parametrize("level", range(7))
def test_all_levels_reach_engine_and_preserve(level, monkeypatch):
    original = fixture()
    actual = service.subprocess.Popen
    commands = []
    def tracked(args, **kwargs):
        commands.append(args)
        return actual(args, **kwargs)
    monkeypatch.setattr(service.subprocess, "Popen", tracked)
    result, status = service.compress(original, "standard", str(uuid.uuid4()), level=level, threads=1, budget=15)
    assert commands[0][commands[0].index("-o") + 1] == str(level)
    assert commands[0][commands[0].index("--threads") + 1] == "1"
    assert commands[0][commands[0].index("--timeout") + 1] == "15"
    assert service.pixel_hash(result) == service.pixel_hash(original)
    assert len(result) <= len(original)
    assert [c for c in service.inspect_png(result)[0] if c[0] != b"IDAT"] == [c for c in service.inspect_png(original)[0] if c[0] != b"IDAT"]


@pytest.mark.parametrize("kwargs", [{"level":-1},{"level":7},{"level":1.5},{"level":True},{"threads":0},{"threads":5},{"budget":0},{"budget":90}])
def test_invalid_options_rejected(kwargs):
    with pytest.raises(service.CompressionError):
        service.compression_options(**kwargs)


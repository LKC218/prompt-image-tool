"""共用尺寸样例、真实隔离编码与方向回读。"""
import io
import json
from pathlib import Path
import threading
import time
import uuid
import pytest
from PIL import Image, ImageOps, PngImagePlugin
from test_image_process import run, sample, service, image_worker, image_cache
from test_png_compress import fixture
from image_resize import calculate_resize, normalize_resize

CASES = json.loads((Path(__file__).resolve().parents[2] / 'tests/fixtures/image-resize-cases.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', CASES, ids=lambda case: case['name'])
def test_shared_rules(case):
    if case['expected'] is None:
        with pytest.raises(ValueError): calculate_resize(*case['source'], case['settings'])
    else:
        result = calculate_resize(*case['source'], case['settings'])
        assert [result['width'], result['height']] == case['expected']
        assert result['changed'] == (case['source'] != case['expected'])
        assert calculate_resize(*case['source'], normalize_resize(case['settings'])) == result


@pytest.mark.parametrize('source,target', [(a,b) for a in ('png','jpeg','webp') for b in ('png','jpeg','webp')])
def test_real_resize_matrix(source, target):
    data = sample(source, alpha=source != 'jpeg')
    result, report = run(data, resize=True, width=48, operation='convert', target=target)
    decoded = Image.open(io.BytesIO(result)); decoded.load()
    assert decoded.size == (48,40) and decoded.format.lower().replace('jpg','jpeg') == target
    assert report['resized'] and report['output'] == dict(width=48,height=40)
    if target != 'jpeg': assert decoded.convert('RGBA').getpixel((5,5))[3] == (100 if source != 'jpeg' else 255)
    else: assert any('有损编码，质量 85' in note for note in report['notes'])


@pytest.mark.parametrize('fmt', ['png','jpeg','webp'])
def test_optimize_resize_and_larger_result(fmt, monkeypatch):
    def forbidden(): raise AssertionError('缩放不应调用 jpegoptim')
    monkeypatch.setattr(service, 'jpeg_engine', forbidden)
    original = sample(fmt)
    result, report = run(original, resize=True, width=960, onlyShrink=False, quality=97)
    assert Image.open(io.BytesIO(result)).size == (960,800)
    assert report['resized'] and report['status'] == 'compressed'
    assert len(result) > len(original)
    if fmt == 'jpeg': assert any('质量 97' in note for note in report['notes'])


@pytest.mark.parametrize('orientation', range(1,9))
def test_orientation_exactly_once(orientation):
    image = Image.new('RGB',(80,40),'red')
    for x in range(40,80):
        for y in range(40): image.putpixel((x,y),(0,0,255))
    exif = Image.Exif(); exif[274] = orientation; exif[270] = '方向验收'
    stream = io.BytesIO(); image.save(stream,format='JPEG',exif=exif,quality=100,subsampling=0)
    data = stream.getvalue()
    info = image_worker.inspect(data)[1]
    assert (info['width'],info['height']) == ((40,80) if orientation >= 5 else (80,40))
    expected = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    expected = expected.resize((expected.width//2,expected.height//2),Image.Resampling.LANCZOS)
    result, report = run(data, resize=True, resizeMode='percent', percent=50, operation='convert', target='png')
    decoded = Image.open(io.BytesIO(result))
    assert image_worker.pixels(decoded) == image_worker.pixels(expected)
    assert decoded.getexif().get(274,1) == 1 and report['metadata']


def test_resize_metadata_and_background():
    meta = PngImagePlugin.PngInfo(); meta.add_text('parameters','尺寸验收')
    original = sample(alpha=True, pnginfo=meta)
    result, report = run(original, resize=True, width=48, operation='convert', target='jpeg', background='#ff0000', quality=100)
    pixel = Image.open(io.BytesIO(result)).getpixel((0,0))
    assert abs(pixel[0]-179) <= 3 and abs(pixel[1]-55) <= 3
    assert report['metadata'] and any('透明' in note for note in report['notes'])


def test_unchanged_size_retains_original_contract():
    original = sample('jpeg')
    resized, report = run(original, resize=True, width=1920)
    normal, _ = run(original)
    assert resized == normal and not report['resized']


def test_resize_rejections_clean_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(image_cache,'ROOT',tmp_path/'owned')
    data = io.BytesIO(); Image.new('CMYK',(16,16)).save(data,format='JPEG')
    for original, message in [(fixture(depth=16),'高位深'),(data.getvalue(),'特殊色彩')]:
        with pytest.raises(ValueError,match=message): run(original,resize=True,width=8)
        assert list(image_cache.root().iterdir()) == []
    with pytest.raises(ValueError,match='输出'): run(sample(),resize=True,width=16384,height=16384,lockRatio=False,onlyShrink=False)
    assert list(image_cache.root().iterdir()) == []


def test_resize_api_requires_ack():
    with pytest.raises(ValueError,match='确认'): service.options({'resize':['true'],'width':['48']})
    assert service.options({'resize':['true'],'width':['48'],'ack':['true']})['width'] == 48


def test_running_resize_cancel_cleans_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(image_cache,'ROOT',tmp_path/'owned')
    original_worker = service.worker
    entered = threading.Event()
    def slow_worker(folder, config, event, deadline):
        if config['action'] == 'inspect': return original_worker(folder,config,event,deadline)
        entered.set()
        service.child([service.sys.executable,'-c','while True: pass'],event,deadline)
    monkeypatch.setattr(service,'worker',slow_worker)
    config = service.options({'resize':['true'],'width':['48'],'ack':['true']})
    job = str(uuid.uuid4()); errors = []
    def task():
        try: service.process(sample(), config, job)
        except ValueError as error: errors.append(str(error))
    thread = threading.Thread(target=task); thread.start()
    assert entered.wait(10)
    service.png.cancel(job); thread.join(10)
    assert not thread.is_alive() and errors and '取消' in errors[0]
    assert list(image_cache.root().iterdir()) == []


def test_shared_deadline_and_timeout_cleanup(tmp_path, monkeypatch):
    monkeypatch.setattr(image_cache,'ROOT',tmp_path/'owned')
    config = service.options({'resize':['true'],'width':['48'],'ack':['true']})
    with pytest.raises(ValueError,match='90 秒'):
        service.process(sample(),config,str(uuid.uuid4()),time.monotonic()-1)
    assert list(image_cache.root().iterdir()) == []
    with pytest.raises(ValueError,match='90 秒'):
        service.png.compress(sample(),'standard',str(uuid.uuid4()),deadline=time.monotonic()-1)


def test_output_capacity_guard(tmp_path, monkeypatch):
    original = sample(alpha=True)
    (tmp_path/'input').write_bytes(original)
    (tmp_path/'config.json').write_text(json.dumps(dict(action='process',operation='optimize',target='png',encoding='lossless',resize=True,width=48,quality=85,background='#ffffff',level=2)))
    monkeypatch.setattr(image_worker,'MAX_RESULT',20)
    with pytest.raises(ValueError,match='32 MB'): image_worker.execute(tmp_path)
    assert not (tmp_path/'output').exists() and (tmp_path/'input').read_bytes() == original

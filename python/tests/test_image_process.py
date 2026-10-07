"""真实多格式转换、元数据与专属缓存生命周期验收。"""
import io
import json
from pathlib import Path
import sys
import time
import threading
import uuid
import pytest
from PIL import Image, PngImagePlugin
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import image_process as service
import image_worker
import image_cache
from test_png_compress import fixture

def sample(fmt='png',alpha=False,**extra):
    image=Image.new('RGBA' if alpha else 'RGB',(96,80),(60,140,210,100) if alpha else (60,140,210))
    stream=io.BytesIO()
    image.save(stream,format={'png':'PNG','jpeg':'JPEG','webp':'WEBP'}[fmt],**extra)
    return stream.getvalue()

def run(data,**values):
    options=dict(operation='optimize',target='png',encoding='lossless',quality=85,background='#ffffff',level=2,threads=2,budget=15,action='process')
    options.update(values)
    return service.process(data,options,str(uuid.uuid4()))

@pytest.mark.parametrize('source,target',[(a,b) for a in ('png','jpeg','webp') for b in ('png','jpeg','webp')])
def test_conversion_matrix(source,target):
    original=sample(source)
    result,report=run(original,operation='convert',target=target,encoding='lossy' if target=='jpeg' else 'lossless')
    assert report['status']=='converted' and report['format']==target
    decoded=Image.open(io.BytesIO(result))
    assert decoded.size==(96,80)
    if target!='jpeg': assert image_worker.pixels(decoded)==image_worker.pixels(Image.open(io.BytesIO(original)))

@pytest.mark.parametrize('fmt',['png','jpeg','webp'])
def test_lossless_original(fmt):
    original=sample(fmt)
    result,report=run(original)
    assert len(result)<=len(original)
    assert image_worker.pixels(Image.open(io.BytesIO(result)))==image_worker.pixels(Image.open(io.BytesIO(original)))
    assert image_worker.metadata(result,fmt)==image_worker.metadata(original,fmt)

def test_metadata_and_transparency():
    meta=PngImagePlugin.PngInfo(); meta.add_text('parameters','提示词与种子')
    original=sample(alpha=True,pnginfo=meta)
    result,report=run(original,operation='convert',target='jpeg',encoding='lossy',background='#ff0000',quality=100)
    pixel=Image.open(io.BytesIO(result)).getpixel((0,0))
    assert abs(pixel[0]-179)<=3 and abs(pixel[1]-55)<=3
    assert report['metadata'] and any('透明' in note for note in report['notes'])

def test_alpha_webp_exact():
    original=sample(alpha=True)
    result,report=run(original,operation='convert',target='webp')
    assert image_worker.pixels(Image.open(io.BytesIO(original)))==image_worker.pixels(Image.open(io.BytesIO(result)))

def test_high_depth_guard():
    with pytest.raises(ValueError,match='高位深'): run(fixture(depth=16),operation='convert',target='webp')
    result,_=run(fixture(depth=16))
    assert service.png.inspect_png(result)[1][2]==16

def test_cmyk_guard():
    data=io.BytesIO(); Image.new('CMYK',(16,16)).save(data,format='JPEG')
    with pytest.raises(ValueError,match='特殊色彩'): run(data.getvalue(),operation='convert',target='png')
    assert run(data.getvalue())[1]['status'] in ('compressed','unchanged','preserved')

def test_animation_guard():
    data=io.BytesIO(); Image.new('RGB',(16,16),'red').save(data,format='WEBP',save_all=True,append_images=[Image.new('RGB',(16,16),'blue')],duration=100)
    with pytest.raises(ValueError,match='动画'): run(data.getvalue())

@pytest.mark.parametrize('values',[{'quality':['0']},{'quality':['101']},{'background':['red']},{'operation':['x']},{'operation':['convert']},{'encoding':['lossy']}])
def test_options_guard(values):
    with pytest.raises(ValueError): service.options(values)

def test_cancel_before_start():
    job=str(uuid.uuid4()); service.png.cancel(job)
    with pytest.raises(ValueError,match='取消'): service.process(sample('webp'),dict(action='inspect'),job)

def test_cache_lifecycle_and_stale(tmp_path,monkeypatch):
    monkeypatch.setattr(image_cache,'ROOT',tmp_path/'owned')
    with image_cache.task() as folder:
        (folder/'input').write_bytes(b'example')
        marker=folder/'owner.json'; data=json.loads(marker.read_text()); data['created']=time.time()-90000; marker.write_text(json.dumps(data))
        assert image_cache.scan(clean=True)['removedBytes']==0
        assert folder.exists()
    assert not folder.exists()
    stale=image_cache.root()/('task-'+uuid.uuid4().hex); stale.mkdir()
    (stale/'owner.json').write_text(json.dumps(data)); (stale/'lease').write_bytes(b'1')
    unrelated=image_cache.root()/'user-file'; unrelated.write_bytes(b'keep')
    assert image_cache.scan(clean=True)['removedBytes']>0
    assert not stale.exists() and unrelated.read_bytes()==b'keep'

def test_failure_cleans_cache(tmp_path,monkeypatch):
    monkeypatch.setattr(image_cache,'ROOT',tmp_path/'owned')
    with pytest.raises(ValueError): run(b'not an image')
    assert list(image_cache.root().iterdir())==[]

def test_worker_timeout_and_cancellation():
    with pytest.raises(ValueError,match='90 秒'):
        service.child([sys.executable,'-c','while True: pass'],threading.Event(),time.monotonic()-1)
    event=threading.Event(); event.set()
    with pytest.raises(ValueError,match='取消'):
        service.child([sys.executable,'-c','while True: pass'],event,time.monotonic()+90)

def test_exif_and_icc_snapshot():
    exif=Image.Exif(); exif[274]=6; exif[270]='source description'
    original=sample('jpeg',exif=exif,icc_profile=b'test-profile-bytes')
    result,report=run(original)
    assert image_worker.metadata(result,'jpeg')==image_worker.metadata(original,'jpeg')
    result,report=run(original,operation='convert',target='png')
    assert Image.open(io.BytesIO(result)).getexif()[274]==6
    assert report['metadata']

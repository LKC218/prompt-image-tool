"""生成隔离多格式样本；导出后可回读 ZIP 校验格式与元数据报告。"""
import json
from pathlib import Path
import sys
import zipfile
import io
from PIL import Image, PngImagePlugin

ROOT=Path(__file__).resolve().parents[1]/'output'/'image-validation'
INPUT=ROOT/'输入'
INPUT.mkdir(parents=True,exist_ok=True)
image=Image.new('RGBA',(256,192),(80,150,220,100))
meta=PngImagePlugin.PngInfo(); meta.add_text('parameters','test prompt; seed: 123')
image.save(INPUT/'透明图.png',pnginfo=meta)
image.convert('RGB').save(INPUT/'照片.jpg',quality=96,exif=Image.Exif())
image.save(INPUT/'网页.webp',lossless=True,exact=True)
if len(sys.argv)>1:
    with zipfile.ZipFile(sys.argv[1]) as archive:
        images=[]
        for name in archive.namelist():
            data=archive.read(name)
            if name.endswith('.json'):
                report=json.loads(data); assert report['format'] in ('png','jpeg','webp')
            else:
                decoded=Image.open(io.BytesIO(data)); decoded.load(); assert decoded.size==(256,192)
                images.append({'name':name,'format':decoded.format,'bytes':len(data)})
        assert len(images)==3
        print(json.dumps(images,ensure_ascii=False))
else: print(INPUT)

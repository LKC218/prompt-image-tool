"""生成无业务数据的尺寸验收样本，或独立回读浏览器导出的 ZIP。"""
import io
import json
from pathlib import Path
import sys
import zipfile
from PIL import Image, ImageOps, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1] / 'output' / 'image-resize'


def generate():
    folder = ROOT / '输入'; folder.mkdir(parents=True,exist_ok=True)
    meta = PngImagePlugin.PngInfo(); meta.add_text('parameters','合成尺寸样本，无用户数据')
    Image.new('RGBA',(640,320),(40,140,220,100)).save(folder/'横图.png',pnginfo=meta)
    Image.new('RGBA',(240,480),(180,70,110,150)).save(folder/'竖图.webp',lossless=True,exact=True)
    image = Image.new('RGB',(600,300),'red')
    for x in range(300,600):
        for y in range(300): image.putpixel((x,y),(0,0,255))
    exif = Image.Exif(); exif[274] = 6; exif[270] = '方向样本'
    image.save(folder/'方向照片.jpg',exif=exif,quality=96,subsampling=0)
    print(folder)


def verify(filename):
    checks = []
    with zipfile.ZipFile(filename) as archive:
        for name in archive.namelist():
            if name.endswith('.json'): continue
            decoded = Image.open(io.BytesIO(archive.read(name))); decoded.load()
            report = json.loads(archive.read(name+'.metadata.json'))
            display = ImageOps.exif_transpose(decoded)
            assert display.size == (report['output']['width'],report['output']['height'])
            assert report['resized'] and report['notes']
            if decoded.format != 'JPEG' and ('横图' in name or '竖图' in name):
                assert display.convert('RGBA').getpixel((0,0))[3] in (100,150)
            if '方向照片' in name:
                assert display.height > display.width and decoded.getexif().get(274,1) == 1
                assert display.convert('RGB').getpixel((display.width//2,5))[0] > 200
            checks.append(dict(name=name,size=display.size,format=decoded.format,bytes=len(archive.read(name))))
    assert len(checks) == 3
    destination = Path(filename).with_suffix('.回读.json')
    destination.write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(checks,ensure_ascii=False))


if __name__ == '__main__':
    verify(sys.argv[1]) if len(sys.argv) > 1 else generate()

"""隔离进程内识别、转换与回读；不访问图库，不接收外部路径。"""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageOps, PngImagePlugin
from png_compress import inspect_png, MAX_PIXELS, MAX_FILE
from image_resize import calculate_resize

MAX_RESULT = 32 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

def metadata(data, fmt):
    chunks = []
    if fmt == 'png':
        chunks = [(t.decode('ascii'), p) for t,p in inspect_png(data)[0] if t not in (b'IDAT', b'IHDR', b'IEND', b'PLTE', b'tRNS')]
    elif fmt == 'webp':
        if len(data) < 12 or data[:4] != b'RIFF' or data[8:12] != b'WEBP' or int.from_bytes(data[4:8],'little') + 8 != len(data):
            raise ValueError('WebP 容器损坏或有尾随内容')
        pos = 12
        while pos < len(data):
            if pos + 8 > len(data): raise ValueError('WebP 数据块不完整')
            kind = data[pos:pos+4]; size = int.from_bytes(data[pos+4:pos+8],'little'); end = pos+8+size
            if end+(size%2) > len(data): raise ValueError('WebP 数据块长度错误')
            if kind in (b'ANIM',b'ANMF'): raise ValueError('暂不支持动画 WebP')
            if kind not in (b'VP8 ',b'VP8L',b'VP8X',b'ALPH'): chunks.append((kind.decode('ascii'),data[pos+8:end]))
            pos = end+(size%2)
    elif fmt == 'jpeg':
        pos = 2
        while pos < len(data):
            if data[pos] != 255:
                pos += 1; continue
            pos += 1
            while pos < len(data) and data[pos] == 255: pos += 1
            if pos >= len(data): break
            marker = data[pos]; pos += 1
            if marker == 217:
                if pos != len(data): raise ValueError('JPEG 含尾随内容，暂不处理')
                break
            if marker in (0,1,216) or 208 <= marker <= 215: continue
            if pos+2 > len(data): raise ValueError('JPEG 数据不完整')
            size = int.from_bytes(data[pos:pos+2],'big')
            if size < 2 or pos+size > len(data): raise ValueError('JPEG 数据块损坏')
            if 224 <= marker <= 239 or marker == 254: chunks.append((hex(marker),data[pos+2:pos+size]))
            pos += size
    if sum(len(p) for _,p in chunks) > 4*1024*1024:
        raise ValueError('元数据超过 4 MB，请先整理元数据')
    return chunks

def inspect(data):
    if not data or len(data) > MAX_FILE: raise ValueError('单图须在 20 MB 以内')
    image = Image.open(io.BytesIO(data))
    fmt = {'PNG':'png','JPEG':'jpeg','WEBP':'webp'}.get(image.format)
    if not fmt: raise ValueError('仅支持 PNG、JPEG、静态 WebP')
    if image.width * image.height > MAX_PIXELS: raise ValueError('图片不得超过 1600 万像素')
    if getattr(image,'n_frames',1) != 1 or getattr(image,'is_animated',False): raise ValueError('暂不支持动画图片')
    depth = inspect_png(data)[1][2] if fmt == 'png' else 8
    meta = metadata(data,fmt)
    image.load()
    orientation = image.getexif().get(274, 1)
    width, height = image.size[::-1] if orientation in (5,6,7,8) else image.size
    return image, {'format':fmt,'width':width,'height':height,'storedWidth':image.width,'storedHeight':image.height,'orientation':orientation,'depth':depth,
        'alpha':image.mode in ('RGBA','LA') or 'transparency' in image.info,'mode':image.mode}, meta

def pixels(image):
    return hashlib.sha256(image.convert('RGBA').tobytes()).digest()

def execute(folder):
    config = json.loads((folder/'config.json').read_text(encoding='utf-8'))
    original = (folder/'input').read_bytes()
    image, info, meta = inspect(original)
    if config['action'] == 'inspect': return info
    target = config['target'] if config['operation'] == 'convert' else info['format']
    lossless = config['encoding'] == 'lossless'
    size = calculate_resize(info['width'], info['height'], config)
    resized = size['changed']
    if resized:
        if info['depth'] > 8: raise ValueError('高位深 PNG 不支持调整尺寸，不自动降位深')
        if image.mode not in ('RGB','RGBA','L','LA','P','1'): raise ValueError('特殊色彩模式不支持调整尺寸，不自动转色')
        image = ImageOps.exif_transpose(image)
        # 旧 EXIF/XMP 可能包含方向、缩略图和尺寸：保留原始报告，不写入过时标签。
        for key in ('exif', 'xmp', 'XML:com.adobe.xmp'):
            image.info.pop(key, None)
        image = image.convert('RGBA' if info['alpha'] else 'RGB').resize((size['width'],size['height']), Image.Resampling.LANCZOS)
        if target == 'jpeg': lossless = False
    if config['action'] == 'verify-jpeg':
        result = (folder/'candidate.jpg').read_bytes()
    else:
        if info['depth'] > 8: raise ValueError('高位深 PNG 仅支持保持原格式无损优化，转换可能降位深，已拒绝')
        if image.mode not in ('RGB','RGBA','L','LA','P','1'): raise ValueError('特殊色彩模式仅支持 JPEG 原格式无损优化，不自动转色')
        if target == 'jpeg' and lossless: raise ValueError('转换到 JPEG 必须明确选择有损编码')
        kwargs = {}
        for key in ('icc_profile','exif','xmp'):
            if image.info.get(key): kwargs[key] = image.info[key]
        if target == 'jpeg':
            rgba = image.convert('RGBA')
            background = Image.new('RGBA',rgba.size,config['background'])
            image_out = Image.alpha_composite(background,rgba).convert('RGB')
            kwargs.update(quality=config['quality'],optimize=True,subsampling=0)
        else:
            image_out = image.convert('RGBA' if info['alpha'] else 'RGB')
            if target == 'png':
                pnginfo = PngImagePlugin.PngInfo()
                for key,value in image.info.items():
                    if isinstance(value,str) and key not in ('xmp',): pnginfo.add_itxt(key,value)
                kwargs.update(pnginfo=pnginfo,compress_level=min(9,config['level']+3))
            else:
                kwargs.update(lossless=lossless,quality=config['quality'],method=config['level'],exact=True)
        stream = io.BytesIO()
        image_out.save(stream,format={'jpeg':'JPEG','png':'PNG','webp':'WEBP'}[target],**kwargs)
        result = stream.getvalue()
    if len(result)>MAX_RESULT: raise ValueError('输出超过 32 MB，已停止；请减少单图体积')
    verified = Image.open(io.BytesIO(result)); verified.load()
    if verified.size != image.size: raise ValueError('尺寸校验失败')
    same_format = target == info['format']
    strict = config['operation'] == 'optimize' and lossless and not resized
    if strict:
        if metadata(result,target) != meta or pixels(verified) != pixels(image):
            result = original; status = 'preserved'
        elif len(result) >= len(original):
            result = original; status = 'unchanged'
        else: status = 'compressed'
    else:
        if (target == 'png' or (target == 'webp' and lossless)) and pixels(verified) != pixels(image):
            raise ValueError('无损转换像素校验失败')
        status = 'converted' if config['operation']=='convert' else 'compressed'
        if not resized and same_format and config['operation']=='optimize' and len(result)>=len(original):
            result=original; status='unchanged'
    notes=[]
    if resized:
        notes.append('尺寸调整改变像素，不是原图无损压缩；采用 Lanczos 重采样')
        notes.append('已按显示方向处理；EXIF/XMP 未嵌入，原始元数据见快照，不能保证全部保留')
    if target=='jpeg' and info['alpha'] and status not in ('unchanged','preserved'): notes.append('透明区域已填充 '+config['background'])
    if target in ('jpeg','webp') and not lossless and status not in ('unchanged','preserved'): notes.append('有损编码，质量 '+str(config['quality']))
    if config['operation']=='convert': notes.append('转换不恢复已丢失细节，结果可能增大；元数据不能保证全部嵌入')
    report = {'format':target,'status':status,'source':info,'notes':notes,'resized':resized,
        'output':dict(width=size['width'],height=size['height']),
        'metadata': [{'type':kind,'base64':base64.b64encode(payload).decode('ascii')} for kind,payload in meta] if not strict else [],
        'metadataNotice':'原始非图像元数据快照，不是可自动恢复原文件的备份'}
    (folder/'output').write_bytes(result)
    return report

def main(folder):
    folder=Path(folder)
    try: report=execute(folder)
    except Exception as error: report={'error':str(error)}
    (folder/'report.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')

if __name__=='__main__':
    import sys
    main(sys.argv[1])

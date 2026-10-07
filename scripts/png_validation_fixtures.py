"""生成公开合成验收数据，或回读验收 ZIP；不使用用户素材。"""
import io
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"python"))
sys.path.insert(0,str(ROOT/"python"/"tests"))
import png
from test_png_compress import fixture, chunk
from png_compress import inspect_png, pixel_hash

OUT=ROOT/"output"/"png-validation"
SOURCE=OUT/"输入"
SOURCE.mkdir(parents=True,exist_ok=True)

def prepare():
    for name,depth,palette,interlace in [
        ("透明插画.png",8,False,False),("高精度渐变.png",16,False,False),
        ("调色板图标.png",8,True,False),("交错图像.png",8,False,True)]:
        (SOURCE/name).write_bytes(fixture(depth,palette,interlace))
    (SOURCE/"子目录").mkdir(exist_ok=True)
    (SOURCE/"子目录"/"透明插画.png").write_bytes(fixture())
    for name,asset in [("绿植参考图.png","pc/plant/cycle/07-full.png"),("文件夹插画.png","pc/home-folder.png")]:
        shutil.copyfile(ROOT/"src/assets"/asset,SOURCE/name)
    invalid=OUT/"异常输入"; invalid.mkdir(exist_ok=True)
    (invalid/"非图片.txt").write_text("验收数据",encoding="utf-8")
    data=bytearray(fixture()); data[-1]^=1
    (invalid/"损坏图片.png").write_bytes(data)
    data=fixture()
    (invalid/"动画.png").write_bytes(data[:33]+chunk(b"acTL",bytes.fromhex("0000000100000000"))+data[33:])
    print("已生成 7 张合成或仓库公开素材及异常样本")

def verify(zip_path):
    records=[]
    with zipfile.ZipFile(zip_path) as archive:
        assert len(archive.namelist())==7
        for name in archive.namelist():
            original_name=name.replace("-压缩.png",".png")
            relative=Path(original_name)
            if relative.parts[0]=="输入":relative=Path(*relative.parts[1:])
            source=(SOURCE/relative).read_bytes(); result=archive.read(name)
            a,info_a=inspect_png(source); b,info_b=inspect_png(result)
            assert info_a==info_b
            assert [c for c in a if c[0]!=b"IDAT"]==[c for c in b if c[0]!=b"IDAT"]
            assert pixel_hash(source)==pixel_hash(result)
            assert len(result)<=len(source)
            records.append({"名称":name,"原始字节":len(source),"结果字节":len(result),"像素一致":True,"元数据一致":True})
    (OUT/"回读结果.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(records,ensure_ascii=False))

if __name__=="__main__":
    if len(sys.argv)>1:verify(sys.argv[1])
    else:prepare()


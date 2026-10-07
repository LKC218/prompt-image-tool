"""准备固定的 Windows x64 Oxipng；校验官方发布资产摘要，不执行安装器。"""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

VERSION = "10.2.1"
URL = "https://github.com/oxipng/oxipng/releases/download/v10.2.1/oxipng-10.2.1-x86_64-pc-windows-msvc.zip"
SHA256 = "7e940f83ee46874b73f53031f96a15834cb70b220af27391fb06fe7b4dd798e1"
DEST = Path(__file__).resolve().parents[1] / "vendor" / "oxipng"

def prepare():
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = DEST / "engine.json"
    executable = DEST / "oxipng.exe"
    if manifest.exists() and executable.exists():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        if data.get("version") == VERSION and data.get("sha256") == hashlib.sha256(executable.read_bytes()).hexdigest():
            print("Oxipng 已准备并通过本地摘要校验")
            return
    request = urllib.request.Request(URL, headers={"User-Agent": "PromptImageManager-build"})
    with urllib.request.urlopen(request, timeout=90) as response:
        archive = response.read(20 * 1024 * 1024)
    if hashlib.sha256(archive).hexdigest() != SHA256:
        raise RuntimeError("Oxipng 发布包摘要不匹配，停止准备")
    with zipfile.ZipFile(io.BytesIO(archive)) as package:
        binary = next(n for n in package.namelist() if n.endswith("/oxipng.exe") or n == "oxipng.exe")
        license_name = next(n for n in package.namelist() if Path(n).name in ("LICENSE", "LICENSE.txt"))
        executable.write_bytes(package.read(binary))
        (DEST / "LICENSE").write_bytes(package.read(license_name))
    manifest.write_text(json.dumps({"version": VERSION, "source": URL, "archiveSha256": SHA256,
        "sha256": hashlib.sha256(executable.read_bytes()).hexdigest()}, indent=2), encoding="utf-8")
    print("Oxipng 10.2.1 下载及 SHA256 校验完成")

if __name__ == "__main__":
    prepare()


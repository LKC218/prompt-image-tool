import json
import re
from pathlib import Path

root = Path(r"G:\项目\prompt-image-tool-main")
pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
meta = re.search(
    r'name="version" content="([^"]+)"',
    (root / "src" / "index.html").read_text(encoding="utf-8"),
).group(1)
nsi = re.search(
    r'APPVERSION "([^"]+)"',
    (root / "build" / "installer.nsi").read_text(encoding="utf-8"),
).group(1)
notes = re.search(
    r"version: '([^']+)'",
    (root / "src" / "js" / "release-notes-data.js").read_text(encoding="utf-8"),
).group(1)
print("package.json", pkg)
print("index.html", meta)
print("installer.nsi", nsi)
print("RELEASE_NOTES[0]", notes)
assert pkg == meta == nsi == notes == "2.5.9", "version mismatch"
print("version consistency OK")

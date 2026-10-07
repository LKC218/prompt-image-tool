"""启动专用验收后端，使用隔离数据；不占用用户的 8888 服务。"""
import os
from pathlib import Path
import socketserver
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "output" / "png-validation" / "profile"
(DATA / "data").mkdir(parents=True, exist_ok=True)
marker = DATA / "data" / "prompt_sets.json"
if not marker.exists():
    marker.write_text("[]", encoding="utf-8")
os.environ["PROMPT_IMAGE_TOOL_DATA_DIR"] = str(DATA)
sys.path.insert(0, str(ROOT / "python"))
import main
main.ensure_dirs()
main.SERVER_PORT = 8898
# 静态文件仅来自构建目录，不暴露仓库与测试数据。
os.chdir(ROOT / "dist")
with socketserver.ThreadingTCPServer(("127.0.0.1", 8898), main.AppHandler) as server:
    print("验收后端：http://127.0.0.1:8898；数据：" + str(DATA), flush=True)
    server.serve_forever()


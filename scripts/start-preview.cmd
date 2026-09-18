@echo off
cd /d "G:\项目\prompt-image-tool-main"
start "vite-dev" /b cmd /c "node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173 > .vite-dev.log 2>&1"

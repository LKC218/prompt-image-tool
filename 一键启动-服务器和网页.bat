@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
python "%~dp0scripts\start_dev_server.py" --pc-only

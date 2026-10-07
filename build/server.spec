# -*- mode: python ; coding: utf-8 -*-
"""Headless HTTP backend sidecar for the Tauri shell (no pywebview window)."""
import os

block_cipher = None

project_root = os.path.abspath(SPECPATH + '/..')
engine_dir = os.path.join(project_root, 'vendor', 'oxipng')
jpeg_dir = os.path.join(project_root, 'vendor', 'jpegoptim')
if not os.path.isfile(os.path.join(engine_dir, 'oxipng.exe')):
    raise RuntimeError('请先运行 python scripts/prepare_png_engine.py')

a = Analysis(
    [os.path.join(project_root, 'python', 'main.py')],
    pathex=[SPECPATH, os.path.join(project_root, 'python')],
    binaries=[(os.path.join(engine_dir, 'oxipng.exe'), 'vendor/oxipng'), (os.path.join(jpeg_dir, 'jpegoptim.exe'), 'vendor/jpegoptim')],
    datas=[(os.path.join(engine_dir, 'engine.json'), 'vendor/oxipng'), (os.path.join(engine_dir, 'LICENSE'), 'vendor/oxipng')] + [(os.path.join(jpeg_dir, name), 'vendor/jpegoptim') for name in ('engine.json', 'LICENSE', 'COPYRIGHT', 'README')],
    hiddenimports=['auto_update', 'png_compress', 'png', 'image_process', 'image_worker', 'image_cache', 'PIL.PngImagePlugin', 'PIL.JpegImagePlugin', 'PIL.WebPImagePlugin'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['webview', 'clr_loader', 'pythonnet', 'tkinter'],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PromptImageManager-Server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# -*- mode: python ; coding: utf-8 -*-
"""Headless HTTP backend sidecar for the Tauri shell (no pywebview window)."""
import os

block_cipher = None

project_root = os.path.abspath(SPECPATH + '/..')

a = Analysis(
    [os.path.join(project_root, 'python', 'main.py')],
    pathex=[SPECPATH, os.path.join(project_root, 'python')],
    binaries=[],
    datas=[],
    hiddenimports=['auto_update'],
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

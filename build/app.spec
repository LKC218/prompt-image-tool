# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

project_root = os.path.abspath(SPECPATH + '/..')
frontend_dir = os.path.join(project_root, 'dist')
icon_path = os.path.join(project_root, 'src-tauri', 'icons', 'icon.ico')
if not os.path.exists(icon_path):
    icon_path = os.path.join(project_root, 'build', 'icon.ico')

frontend_datas = []
if os.path.exists(frontend_dir):
    for root, dirs, files in os.walk(frontend_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(root, frontend_dir)
            dest = os.path.join('frontend', rel_path) if rel_path != '.' else 'frontend'
            frontend_datas.append((full_path, dest))
else:
    print(f"WARNING: Frontend directory not found: {frontend_dir}")
    print("Please run 'npm run build' first!")

a = Analysis(
    [os.path.join(SPECPATH, 'app_main.py')],
    pathex=[],
    binaries=[],
    datas=frontend_datas,
    hiddenimports=[
        'webview',
        'webview.platforms',
        'webview.platforms.winforms',
        'webview.platforms.cef',
        'clr_loader',
        'pythonnet',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='PromptImageManager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_path if os.path.exists(icon_path) else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='PromptImageManager',
)

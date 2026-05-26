// Prevents additional console window on Windows in release, DO NOT REMOVE.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(feature = "embedded-installer")]
const EMBEDDED_INSTALLER_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../build/PromptImageManager-Setup-2.3.6.exe"
));

#[derive(Serialize)]
struct InstallResult {
    success: bool,
    exit_code: Option<i32>,
    installer_path: String,
    target_dir: String,
    data_snapshot: DataSnapshotResult,
    exe_exists: bool,
    uninstaller_exists: bool,
    desktop_shortcut_exists: bool,
    start_menu_shortcut_exists: bool,
    start_menu_uninstaller_shortcut_exists: bool,
    error_message: Option<String>,
}

#[derive(Serialize)]
struct ShortcutStatus {
    desktop_shortcut_exists: bool,
    start_menu_shortcut_exists: bool,
    start_menu_uninstaller_shortcut_exists: bool,
}

#[derive(Serialize)]
struct DataSnapshotResult {
    success: bool,
    skipped: bool,
    source_dirs: Vec<String>,
    snapshot_dir: Option<String>,
    copied_files: usize,
    error_message: Option<String>,
}

#[derive(Serialize)]
struct PathValidationResult {
    ok: bool,
    target_dir: String,
    message: String,
    available_space_label: String,
}

#[tauri::command]
fn install_with_nsis(app: tauri::AppHandle, target_dir: String) -> Result<InstallResult, String> {
    let installer = find_installer(&app)?;
    let target_path = resolve_target_dir(&target_dir)?;
    let data_snapshot = create_update_data_snapshot(&target_path);

    let target_arg = format!("/D={}", target_path.display());

    #[cfg(target_os = "windows")]
    let status = Command::new(&installer)
        .arg("/S")
        .arg(&target_arg)
        .creation_flags(0x08000000)
        .status()
        .map_err(|error| format!("启动 NSIS 安装器失败：{error}"))?;

    #[cfg(not(target_os = "windows"))]
    let status = Command::new(&installer)
        .arg("/S")
        .arg(&target_arg)
        .status()
        .map_err(|error| format!("启动 NSIS 安装器失败：{error}"))?;

    let exe_path = target_path.join("PromptImageManager.exe");
    let uninstaller_path = target_path.join("uninstall.exe");
    let exe_exists = exe_path.exists();
    let uninstaller_exists = uninstaller_path.exists();
    let shortcut_status = read_shortcut_status();
    let success = status.success() && exe_exists && uninstaller_exists;
    let error_message = if success {
        None
    } else if !status.success() {
        Some(format!(
            "NSIS 安装核心返回失败，退出码：{:?}",
            status.code()
        ))
    } else if !exe_exists || !uninstaller_exists {
        Some("安装结果校验未通过，未检测到主程序或卸载器。".to_string())
    } else {
        Some("安装结果未知，请重新尝试。".to_string())
    };

    Ok(InstallResult {
        success,
        exit_code: status.code(),
        installer_path: installer.display().to_string(),
        target_dir: target_path.display().to_string(),
        data_snapshot,
        exe_exists,
        uninstaller_exists,
        desktop_shortcut_exists: shortcut_status.desktop_shortcut_exists,
        start_menu_shortcut_exists: shortcut_status.start_menu_shortcut_exists,
        start_menu_uninstaller_shortcut_exists: shortcut_status
            .start_menu_uninstaller_shortcut_exists,
        error_message,
    })
}

#[tauri::command]
fn validate_install_path(target_dir: String) -> Result<PathValidationResult, String> {
    let target_path = resolve_target_dir(&target_dir)?;
    validate_target_path(&target_path)
}

#[tauri::command]
fn launch_installed_app(target_dir: String) -> Result<(), String> {
    let target_path = resolve_target_dir(&target_dir)?;
    let exe_path = target_path.join("PromptImageManager.exe");

    if !exe_path.exists() {
        return Err("未找到已安装的主程序，无法启动。".to_string());
    }

    Command::new(&exe_path)
        .current_dir(&target_path)
        .spawn()
        .map_err(|error| format!("启动提示词管家失败：{error}"))?;

    Ok(())
}

#[tauri::command]
fn apply_desktop_shortcut(target_dir: String, enabled: bool) -> Result<ShortcutStatus, String> {
    let target_path = resolve_target_dir(&target_dir)?;
    let resolved_target_dir = target_path.display().to_string();

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$targetDir = $args[0]
$enabled = $args[1] -eq 'true'
$desktopDir = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktopDir)) {
    throw '未能读取桌面目录。'
}

New-Item -ItemType Directory -Force -Path $desktopDir | Out-Null
$shortcut = Join-Path $desktopDir '生图提示词管理器.lnk'

if ($enabled) {
    $exe = Join-Path $targetDir 'PromptImageManager.exe'
    if (!(Test-Path -LiteralPath $exe)) {
        throw '未找到已安装的主程序，无法创建桌面快捷方式。'
    }

    $icon = Join-Path $targetDir 'icon.ico'
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcut)
    $link.TargetPath = $exe
    $link.WorkingDirectory = $targetDir

    if (Test-Path -LiteralPath $icon) {
        $link.IconLocation = $icon
    }

    $link.Save()
} elseif (Test-Path -LiteralPath $shortcut) {
    Remove-Item -LiteralPath $shortcut -Force
}
"#;

        run_powershell_script(
            script,
            &[&resolved_target_dir, if enabled { "true" } else { "false" }],
            "处理桌面快捷方式失败",
        )?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = resolved_target_dir;
        let _ = enabled;
    }

    let status = read_shortcut_status();
    if enabled && !status.desktop_shortcut_exists {
        return Err("处理桌面快捷方式失败：命令执行完成但未检测到桌面快捷方式。".to_string());
    }

    Ok(status)
}

#[tauri::command]
fn apply_start_menu_shortcut(target_dir: String, enabled: bool) -> Result<ShortcutStatus, String> {
    let target_path = resolve_target_dir(&target_dir)?;
    let resolved_target_dir = target_path.display().to_string();

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$targetDir = $args[0]
$enabled = $args[1] -eq 'true'
$programsDir = [Environment]::GetFolderPath('Programs')
if ([string]::IsNullOrWhiteSpace($programsDir)) {
    throw '未能读取开始菜单目录。'
}

$menuDir = Join-Path $programsDir '生图提示词管理器'
$mainShortcut = Join-Path $menuDir '生图提示词管理器.lnk'
$uninstallShortcut = Join-Path $menuDir '卸载生图提示词管理器.lnk'

if ($enabled) {
    $exe = Join-Path $targetDir 'PromptImageManager.exe'
    $uninstaller = Join-Path $targetDir 'uninstall.exe'
    if (!(Test-Path -LiteralPath $exe)) {
        throw '未找到已安装的主程序，无法创建开始菜单快捷方式。'
    }
    if (!(Test-Path -LiteralPath $uninstaller)) {
        throw '未找到卸载器，无法创建开始菜单卸载快捷方式。'
    }

    New-Item -ItemType Directory -Force -Path $menuDir | Out-Null
    $icon = Join-Path $targetDir 'icon.ico'
    $shell = New-Object -ComObject WScript.Shell

    $mainLink = $shell.CreateShortcut($mainShortcut)
    $mainLink.TargetPath = $exe
    $mainLink.WorkingDirectory = $targetDir
    if (Test-Path -LiteralPath $icon) {
        $mainLink.IconLocation = $icon
    }
    $mainLink.Save()

    $uninstallLink = $shell.CreateShortcut($uninstallShortcut)
    $uninstallLink.TargetPath = $uninstaller
    $uninstallLink.WorkingDirectory = $targetDir
    if (Test-Path -LiteralPath $icon) {
        $uninstallLink.IconLocation = $icon
    }
    $uninstallLink.Save()
} else {
    if (Test-Path -LiteralPath $mainShortcut) {
        Remove-Item -LiteralPath $mainShortcut -Force
    }
    if (Test-Path -LiteralPath $uninstallShortcut) {
        Remove-Item -LiteralPath $uninstallShortcut -Force
    }
    if (Test-Path -LiteralPath $menuDir) {
        Remove-Item -LiteralPath $menuDir -Force -Recurse
    }
}
"#;

        run_powershell_script(
            script,
            &[&resolved_target_dir, if enabled { "true" } else { "false" }],
            "处理开始菜单快捷方式失败",
        )?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = resolved_target_dir;
        let _ = enabled;
    }

    let status = read_shortcut_status();
    if enabled
        && (!status.start_menu_shortcut_exists || !status.start_menu_uninstaller_shortcut_exists)
    {
        return Err(
            "处理开始菜单快捷方式失败：命令执行完成但未检测到完整开始菜单入口。".to_string(),
        );
    }

    Ok(status)
}

#[tauri::command]
fn get_shortcut_status() -> ShortcutStatus {
    read_shortcut_status()
}

#[cfg(target_os = "windows")]
fn run_powershell_script(script: &str, args: &[&str], action: &str) -> Result<(), String> {
    let mut command = Command::new("powershell");
    command
        .arg("-Sta")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .args(args)
        .creation_flags(0x08000000);

    let output = command
        .output()
        .map_err(|error| format!("{action}：{error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("退出码：{:?}", output.status.code())
    };

    Err(format!("{action}：{detail}"))
}

fn resolve_target_dir(target_dir: &str) -> Result<PathBuf, String> {
    let trimmed = target_dir.trim();

    if trimmed.is_empty() {
        return Err("安装目录不能为空".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(rest) = trimmed.strip_prefix("%LOCALAPPDATA%") {
            let local_app_data = env::var("LOCALAPPDATA")
                .map_err(|_| "未能读取 LOCALAPPDATA 环境变量".to_string())?;
            let rest = rest.trim_start_matches(['\\', '/']);

            return Ok(if rest.is_empty() {
                PathBuf::from(local_app_data)
            } else {
                PathBuf::from(local_app_data).join(rest)
            });
        }

        if let Some(rest) = trimmed.strip_prefix("%USERPROFILE%") {
            let user_profile =
                env::var("USERPROFILE").map_err(|_| "未能读取 USERPROFILE 环境变量".to_string())?;
            let rest = rest.trim_start_matches(['\\', '/']);

            return Ok(if rest.is_empty() {
                PathBuf::from(user_profile)
            } else {
                PathBuf::from(user_profile).join(rest)
            });
        }
    }

    Ok(PathBuf::from(trimmed))
}

fn validate_target_path(target_path: &Path) -> Result<PathValidationResult, String> {
    let target_dir = target_path.display().to_string();

    if target_dir.trim().is_empty() {
        return Ok(validation_error(&target_dir, "安装目录不能为空。"));
    }

    #[cfg(target_os = "windows")]
    {
        if has_invalid_windows_path_chars(&target_dir) {
            return Ok(validation_error(
                &target_dir,
                "安装目录包含 Windows 不支持的字符。",
            ));
        }

        if target_path.parent().is_none() || target_path.parent() == Some(Path::new("")) {
            return Ok(validation_error(
                &target_dir,
                "安装目录不能直接使用磁盘根目录，请选择一个子文件夹。",
            ));
        }
    }

    if target_path.exists() && !target_path.is_dir() {
        return Ok(validation_error(
            &target_dir,
            "安装路径已存在但不是文件夹。",
        ));
    }

    let writable_dir = nearest_existing_parent(target_path)
        .ok_or_else(|| format!("未找到可用于校验权限的父目录：{}", target_path.display()))?;

    if let Err(error) = check_writable(&writable_dir) {
        return Ok(validation_error(
            &target_dir,
            &format!("安装目录父级不可写：{error}"),
        ));
    }

    Ok(PathValidationResult {
        ok: true,
        target_dir,
        message: "安装目录已校验，可继续安装。".to_string(),
        available_space_label: "约 256 MB".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn has_invalid_windows_path_chars(path: &str) -> bool {
    path.chars().enumerate().any(|(index, ch)| {
        matches!(ch, '<' | '>' | '"' | '|' | '?' | '*') || (ch == ':' && index != 1)
    })
}

fn validation_error(target_dir: &str, message: &str) -> PathValidationResult {
    PathValidationResult {
        ok: false,
        target_dir: target_dir.to_string(),
        message: message.to_string(),
        available_space_label: "约 256 MB".to_string(),
    }
}

fn nearest_existing_parent(path: &Path) -> Option<PathBuf> {
    let mut current = if path.exists() {
        path.to_path_buf()
    } else {
        path.parent()?.to_path_buf()
    };

    while !current.exists() {
        current = current.parent()?.to_path_buf();
    }

    current.is_dir().then_some(current)
}

fn check_writable(dir: &Path) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let probe = dir.join(format!(
        ".pim_installer_probe_{}_{}",
        std::process::id(),
        timestamp
    ));

    fs::write(&probe, b"probe").map_err(|error| error.to_string())?;
    fs::remove_file(&probe).map_err(|error| error.to_string())?;
    Ok(())
}

fn create_update_data_snapshot(target_path: &Path) -> DataSnapshotResult {
    let mut source_dirs = Vec::new();
    let mut source_paths = Vec::new();

    let install_data_dir = target_path.join("data");
    if data_dir_has_files(&install_data_dir) {
        source_dirs.push(install_data_dir.display().to_string());
        source_paths.push(("install-data".to_string(), install_data_dir));
    }

    let user_data_dir = user_data_root().join("data");
    if data_dir_has_files(&user_data_dir) {
        let duplicate = source_paths
            .iter()
            .any(|(_, path)| paths_look_same(path, &user_data_dir));
        if !duplicate {
            source_dirs.push(user_data_dir.display().to_string());
            source_paths.push(("user-data".to_string(), user_data_dir));
        }
    }

    if source_paths.is_empty() {
        return DataSnapshotResult {
            success: true,
            skipped: true,
            source_dirs,
            snapshot_dir: None,
            copied_files: 0,
            error_message: None,
        };
    }

    let snapshot_dir = user_data_root()
        .join("update-backups")
        .join(snapshot_stamp());

    let result = (|| -> Result<usize, String> {
        fs::create_dir_all(&snapshot_dir)
            .map_err(|error| format!("创建升级快照目录失败：{error}"))?;
        let mut copied_files = 0;
        for (label, source) in &source_paths {
            copy_dir_recursive(source, &snapshot_dir.join(label), &mut copied_files)?;
        }
        Ok(copied_files)
    })();

    match result {
        Ok(copied_files) => DataSnapshotResult {
            success: true,
            skipped: false,
            source_dirs,
            snapshot_dir: Some(snapshot_dir.display().to_string()),
            copied_files,
            error_message: None,
        },
        Err(error) => DataSnapshotResult {
            success: false,
            skipped: false,
            source_dirs,
            snapshot_dir: Some(snapshot_dir.display().to_string()),
            copied_files: 0,
            error_message: Some(error),
        },
    }
}

fn data_dir_has_files(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }

    for filename in [
        "prompt_sets.json",
        "folders.json",
        "sync-device.json",
        "data-migration.json",
    ] {
        if path.join(filename).is_file() {
            return true;
        }
    }

    contains_any_file(&path.join("images")) || contains_any_file(&path.join("backups"))
}

fn contains_any_file(path: &Path) -> bool {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return false,
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if entry_path.is_file() || contains_any_file(&entry_path) {
            return true;
        }
    }
    false
}

fn copy_dir_recursive(source: &Path, target: &Path, copied_files: &mut usize) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|error| format!("创建目录失败 {}：{error}", target.display()))?;

    for entry in fs::read_dir(source)
        .map_err(|error| format!("读取目录失败 {}：{error}", source.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry
            .file_type()
            .map_err(|error| format!("读取文件类型失败 {}：{error}", source_path.display()))?;

        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &target_path, copied_files)?;
        } else if file_type.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("创建目录失败 {}：{error}", parent.display()))?;
            }
            fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "复制文件失败 {} -> {}：{error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
            *copied_files += 1;
        }
    }

    Ok(())
}

fn user_data_root() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(app_data) = env::var_os("APPDATA").map(PathBuf::from) {
            return app_data.join("PromptImageManager");
        }
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            return local_app_data.join("PromptImageManager");
        }
        if let Some(user_profile) = env::var_os("USERPROFILE").map(PathBuf::from) {
            return user_profile.join("AppData").join("Roaming").join("PromptImageManager");
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = env::var_os("HOME").map(PathBuf::from) {
            return home.join(".prompt-image-tool");
        }
    }

    env::temp_dir().join("PromptImageManager")
}

fn snapshot_stamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("update-{seconds}")
}

fn paths_look_same(left: &Path, right: &Path) -> bool {
    let left_abs = fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let right_abs = fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    left_abs == right_abs
}

fn read_shortcut_status() -> ShortcutStatus {
    #[cfg(target_os = "windows")]
    {
        let (start_menu_shortcut, start_menu_uninstaller_shortcut) = start_menu_shortcut_paths();
        return ShortcutStatus {
            desktop_shortcut_exists: desktop_shortcut_exists(),
            start_menu_shortcut_exists: start_menu_shortcut.exists(),
            start_menu_uninstaller_shortcut_exists: start_menu_uninstaller_shortcut.exists(),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        ShortcutStatus {
            desktop_shortcut_exists: false,
            start_menu_shortcut_exists: false,
            start_menu_uninstaller_shortcut_exists: false,
        }
    }
}

#[cfg(target_os = "windows")]
fn desktop_shortcut_exists() -> bool {
    let mut candidates = Vec::new();
    if let Some(user_profile) = env::var_os("USERPROFILE").map(PathBuf::from) {
        candidates.push(user_profile.join("Desktop").join("生图提示词管理器.lnk"));
    }
    if let Some(one_drive) = env::var_os("OneDrive").map(PathBuf::from) {
        candidates.push(one_drive.join("Desktop").join("生图提示词管理器.lnk"));
    }

    candidates.into_iter().any(|path| path.exists())
}

#[cfg(target_os = "windows")]
fn start_menu_shortcut_paths() -> (PathBuf, PathBuf) {
    let programs_dir = env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|path| {
            path.join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
        })
        .unwrap_or_else(|| PathBuf::from("Programs"));
    let menu_dir = programs_dir.join("生图提示词管理器");

    (
        menu_dir.join("生图提示词管理器.lnk"),
        menu_dir.join("卸载生图提示词管理器.lnk"),
    )
}

fn find_installer(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("读取资源目录失败：{error}"))?;

    let candidates = [
        resource_dir.join("PromptImageManager-Setup-2.3.6.exe"),
        resource_dir
            .join("_up_")
            .join("build")
            .join("PromptImageManager-Setup-2.3.6.exe"),
        Path::new("..")
            .join("..")
            .join("build")
            .join("PromptImageManager-Setup-2.3.6.exe"),
        Path::new("build").join("PromptImageManager-Setup-2.3.6.exe"),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists())
        .map(Ok)
        .unwrap_or_else(materialize_embedded_installer)
}

#[cfg(feature = "embedded-installer")]
fn materialize_embedded_installer() -> Result<PathBuf, String> {
    let installer_dir = env::temp_dir().join("PromptImageManagerInstallerShell");
    fs::create_dir_all(&installer_dir)
        .map_err(|error| format!("创建临时安装核心目录失败：{error}"))?;

    let installer_path = installer_dir.join("PromptImageManager-Setup-2.3.6.exe");
    let should_write = fs::metadata(&installer_path)
        .map(|metadata| metadata.len() != EMBEDDED_INSTALLER_BYTES.len() as u64)
        .unwrap_or(true);

    if should_write {
        fs::write(&installer_path, EMBEDDED_INSTALLER_BYTES)
            .map_err(|error| format!("释放内置 NSIS 安装核心失败：{error}"))?;
    }

    Ok(installer_path)
}

#[cfg(not(feature = "embedded-installer"))]
fn materialize_embedded_installer() -> Result<PathBuf, String> {
    Err("未找到可用于静默安装的 NSIS 安装包".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            install_with_nsis,
            validate_install_path,
            launch_installed_app,
            apply_desktop_shortcut,
            apply_start_menu_shortcut,
            get_shortcut_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running installer shell prototype");
}

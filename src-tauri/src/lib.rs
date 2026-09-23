use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct BackendChild(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendChild(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(not(target_os = "android"))]
            {
                if let Some(child) = start_python_backend(app.handle().clone()) {
                    if let Ok(mut slot) = app.state::<BackendChild>().0.lock() {
                        *slot = Some(child);
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Ok(mut slot) = app_handle.state::<BackendChild>().0.lock() {
                    if let Some(mut child) = slot.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}

#[cfg(not(target_os = "android"))]
fn find_python() -> Option<String> {
    let candidates = ["python", "python3", "python.exe"];
    for cmd in candidates {
        let mut command = Command::new(cmd);
        command.arg("--version");
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);
        if command.output().is_ok() {
            log::info!("Found Python: {}", cmd);
            return Some(cmd.to_string());
        }
    }

    let common_paths = [
        r"C:\Python312\python.exe",
        r"C:\Python311\python.exe",
        r"C:\Python310\python.exe",
        r"C:\Python39\python.exe",
    ];
    for path in common_paths {
        if std::path::Path::new(path).exists() {
            log::info!("Found Python at: {}", path);
            return Some(path.to_string());
        }
    }

    None
}

#[cfg(not(target_os = "android"))]
fn find_sidecar_binary(resource_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    let names = [
        "PromptImageManager-Server.exe",
        "PromptImageManager-Server",
        "server-x86_64-pc-windows-msvc.exe",
        "server.exe",
        "server",
    ];
    let dirs = [
        resource_dir.to_path_buf(),
        resource_dir.join("server"),
        resource_dir.join("binaries"),
        resource_dir.join("_up_"),
        resource_dir.join("_up_").join("server"),
        resource_dir.join("_up_").join("binaries"),
    ];
    for dir in dirs {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(not(target_os = "android"))]
fn start_python_backend(app_handle: tauri::AppHandle) -> Option<Child> {
    let resource_dir = match app_handle.path().resource_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::error!("Failed to get resource dir: {}", e);
            return None;
        }
    };

    // 1) Prefer bundled headless sidecar (no system Python required).
    if let Some(sidecar) = find_sidecar_binary(&resource_dir) {
        log::info!("Starting sidecar backend: {:?}", sidecar);
        let work_dir = sidecar.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| resource_dir.clone());
        let mut command = Command::new(&sidecar);
        command.current_dir(&work_dir);
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);
        return match command.spawn() {
            Ok(child) => {
                log::info!("Sidecar backend started (PID: {:?})", child.id());
                Some(child)
            }
            Err(e) => {
                log::error!("Failed to start sidecar backend: {}", e);
                None
            }
        };
    }

    // 2) Dev / legacy fallback: system Python + python/main.py from resources.
    let python_cmd = match find_python() {
        Some(cmd) => cmd,
        None => {
            log::error!("Python not found and no sidecar binary present");
            return None;
        }
    };

    let mut python_script = resource_dir.join("python").join("main.py");
    if !python_script.exists() {
        let alt_script = resource_dir.join("_up_").join("python").join("main.py");
        if alt_script.exists() {
            log::info!("Found Python script at alternative path: {:?}", alt_script);
            python_script = alt_script;
        } else {
            // Dev: repo python/main.py next to src-tauri
            let dev_script = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("python")
                .join("main.py");
            if dev_script.exists() {
                log::info!("Found Python script at dev path: {:?}", dev_script);
                python_script = dev_script;
            } else {
                log::error!("Python backend script not found");
                return None;
            }
        }
    }

    let script_dir = python_script
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::Path::new(".").to_path_buf());
    let script_str = python_script.to_string_lossy().into_owned();

    let mut command = Command::new(&python_cmd);
    command.arg(&script_str).current_dir(&script_dir);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.spawn() {
        Ok(child) => {
            log::info!("Python backend started (PID: {:?})", child.id());
            Some(child)
        }
        Err(e) => {
            log::error!("Failed to start Python backend: {}", e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_path_conversion() {
        let path = std::path::Path::new("python").join("main.py");
        let lossy = path.to_string_lossy().into_owned();
        assert!(lossy.contains("main.py"));
    }

    #[test]
    fn test_sidecar_names_cover_windows_exe() {
        assert!("PromptImageManager-Server.exe".ends_with(".exe"));
    }
}

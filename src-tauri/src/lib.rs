use tauri::Manager;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
                start_python_backend(app.handle().clone());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(target_os = "android"))]
fn find_python() -> Option<String> {
    let candidates = vec!["python", "python3", "python.exe"];
    for cmd in candidates {
        if Command::new(cmd)
            .arg("--version")
            .creation_flags(0x08000000)
            .output()
            .is_ok()
        {
            log::info!("Found Python: {}", cmd);
            return Some(cmd.to_string());
        }
    }

    let common_paths = vec![
        r"C:\Python312\python.exe",
        r"C:\Python311\python.exe",
        r"C:\Python310\python.exe",
        r"C:\Python39\python.exe",
        r"C:\Users\Default\AppData\Local\Programs\Python\Python312\python.exe",
        r"C:\Users\Default\AppData\Local\Programs\Python\Python311\python.exe",
        r"C:\Users\Default\AppData\Local\Programs\Python\Python310\python.exe",
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
fn start_python_backend(app_handle: tauri::AppHandle) {
    let python_cmd = match find_python() {
        Some(cmd) => cmd,
        None => {
            log::error!("Python not found. Please install Python 3.9+");
            return;
        }
    };

    let resource_dir = match app_handle.path().resource_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::error!("Failed to get resource dir: {}", e);
            return;
        }
    };

    let mut python_script = resource_dir.join("python").join("main.py");

    if !python_script.exists() {
        let alt_script = resource_dir.join("_up_").join("python").join("main.py");
        if alt_script.exists() {
            log::info!("Found Python script at alternative path: {:?}", alt_script);
            python_script = alt_script;
        } else {
            log::error!("Python backend script not found at {:?} or {:?}", python_script, alt_script);
            return;
        }
    }

    let script_dir = python_script.parent().unwrap_or(std::path::Path::new(".")).to_path_buf();
    let script_str = python_script.to_string_lossy().into_owned();

    #[cfg(target_os = "windows")]
    let spawn_result = Command::new(&python_cmd)
        .arg(&script_str)
        .current_dir(&script_dir)
        .creation_flags(0x08000000)
        .spawn();

    #[cfg(not(target_os = "windows"))]
    let spawn_result = Command::new(&python_cmd)
        .arg(&script_str)
        .current_dir(&script_dir)
        .spawn();

    match spawn_result {
        Ok(child) => {
            log::info!("Python backend started successfully (PID: {:?})", child.id());
        }
        Err(e) => {
            log::error!("Failed to start Python backend: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_conversion() {
        let path = std::path::Path::new("python").join("main.py");
        let lossy = path.to_string_lossy().into_owned();
        assert!(lossy.contains("main.py"));
    }

    #[test]
    fn test_path_exists_check() {
        let nonexistent = std::path::Path::new("/nonexistent/path/main.py");
        assert!(!nonexistent.exists());
    }

    #[test]
    fn test_alternative_path() {
        let resource_dir = std::path::Path::new("C:\\Users\\user\\AppData\\Local\\生图提示词管理器");
        let alt = resource_dir.join("_up_").join("python").join("main.py");
        assert!(alt.to_string_lossy().contains("_up_"));
    }
}

use std::fs;
use std::path::PathBuf;

fn main() {
    let root_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let package_path = root_dir.join("package.json");
    let package_content = fs::read_to_string(&package_path)
        .unwrap_or_else(|error| panic!("读取根目录 package.json 失败：{error}"));
    let version = package_content
        .lines()
        .find_map(|line| {
            line.trim()
                .strip_prefix("\"version\": ")
                .map(|value| value.trim_end_matches(',').trim_matches('\"').to_owned())
        })
        .unwrap_or_else(|| panic!("根目录 package.json 缺少有效 version 字段"));

    println!("cargo:rustc-env=PROMPT_IMAGE_MANAGER_VERSION={version}");
    println!("cargo:rerun-if-changed={}", package_path.display());
    println!(
        "cargo:rerun-if-changed={}",
        root_dir
            .join(format!("build/PromptImageManager-Setup-{version}.exe"))
            .display()
    );
    tauri_build::build()
}

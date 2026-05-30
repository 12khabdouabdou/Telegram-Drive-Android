const fs = require('fs');
let code = fs.readFileSync('fs.rs', 'utf8');

const oldPathLogic = `    let mut actual_save_path = file_name.clone();
    if !actual_save_path.contains('/') && !actual_save_path.contains('\\\\') {
        #[cfg(target_os = "android")]
        {
            actual_save_path = format!("/storage/emulated/0/Download/{}", file_name);
        }
        #[cfg(not(target_os = "android"))]
        {
            use tauri::Manager;
            if let Ok(download_dir) = app_handle.path().download_dir() {
                actual_save_path = download_dir.join(&file_name).to_string_lossy().to_string();
            } else {
                actual_save_path = format!("./{}", file_name);
            }
        }
    }`;

const newPathLogic = `    let mut actual_save_path = file_name.clone();
    if !actual_save_path.contains('/') && !actual_save_path.contains('\\\\') {
        use tauri::Manager;
        if let Ok(download_dir) = app_handle.path().download_dir() {
            let _ = std::fs::create_dir_all(&download_dir);
            actual_save_path = download_dir.join(&file_name).to_string_lossy().to_string();
        } else {
            #[cfg(target_os = "android")]
            {
                actual_save_path = format!("/storage/emulated/0/Download/{}", file_name);
            }
            #[cfg(not(target_os = "android"))]
            {
                actual_save_path = format!("./{}", file_name);
            }
        }
    }`;

code = code.replace(oldPathLogic, newPathLogic);
fs.writeFileSync('fs.rs', code);
console.log("Fixed fs path");

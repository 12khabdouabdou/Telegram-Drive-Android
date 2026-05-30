const fs = require('fs');
let code = fs.readFileSync('backup.rs', 'utf8');

// 1. WalkDir into spawn_blocking
const walkDirRegex = /let mut files_to_upload = Vec::new\(\);\n\s*if let Some\(parent\) = history_file\.parent\(\) \{\n\s*let _ = tokio::fs::create_dir_all\(parent\)\.await;\n\s*\}\n\s*for folder in &config\.folders \{\n\s*for entry in WalkDir::new\(folder\)\.into_iter\(\)\.filter_map\(\|e\| e\.ok\(\)\) \{\n\s*if entry\.file_type\(\)\.is_file\(\) \{\n\s*let path_str = entry\.path\(\)\.to_string_lossy\(\)\.to_string\(\);\n\s*if !history\.contains\(&path_str\) \{\n\s*files_to_upload\.push\(path_str\);\n\s*\}\n\s*\}\n\s*\}\n\s*\}/g;

const walkDirReplacement = `let mut files_to_upload = Vec::new();
        if let Some(parent) = history_file.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        
        let folders_clone = config.folders.clone();
        let history_clone = history.clone();
        
        let files_to_upload_result = tokio::task::spawn_blocking(move || {
            let mut pending = Vec::new();
            for folder in &folders_clone {
                for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
                    if entry.file_type().is_file() {
                        if let Ok(metadata) = entry.metadata() {
                            if metadata.len() < 1024 * 1024 * 500 { // pre-filter 500MB
                                let path_str = entry.path().to_string_lossy().to_string();
                                if !history_clone.contains(&path_str) {
                                    pending.push(path_str);
                                }
                            }
                        }
                    }
                }
            }
            pending
        }).await;
        
        if let Ok(files) = files_to_upload_result {
            files_to_upload = files;
        }`;

code = code.replace(walkDirRegex, walkDirReplacement);

// 2. Add history throttling and zero files handling
const loopSetupRegex = /let total = files_to_upload\.len\(\);\n\s*let mut done = 0;\n\s*let mut last_notified_percent = 0;/g;
const loopSetupReplacement = `let total = files_to_upload.len();
        if total == 0 {
            let _ = app_handle.notification()
                .builder()
                .title("Backup Failed or Empty")
                .body("No new files found. Check your Android storage permissions (All Files Access) or folder paths.")
                .show();

            let _ = app_handle.emit("backup-progress", BackupProgress {
                total: 0,
                done: 0,
                current_file: "Error: No files or Permission Denied".to_string(),
                is_running: false,
            });

            *running_flag.lock().unwrap() = false;
            stop_flag.store(false, Ordering::Relaxed);
            return;
        }

        let mut done = 0;
        let mut last_notified_percent = 0;
        let mut last_history_save = tokio::time::Instant::now();`;

code = code.replace(loopSetupRegex, loopSetupReplacement);

// 3. Replace history save logic inside the loop
const historySaveRegex = /history\.insert\(path\.clone\(\)\);\n\s*if let Ok\(json\) = serde_json::to_string\(&history\) \{\n\s*let _ = tokio::fs::write\(&history_file, json\)\.await;\n\s*\}/g;
const historySaveReplacement = `history.insert(path.clone());
                                        if last_history_save.elapsed().as_secs() > 5 {
                                            if let Ok(json) = serde_json::to_string(&history) {
                                                let _ = tokio::fs::write(&history_file, json).await;
                                                last_history_save = tokio::time::Instant::now();
                                            }
                                        }`;

code = code.replace(historySaveRegex, historySaveReplacement);

// 4. Force save history at the end
const backupCompleteRegex = /let _ = app_handle\.notification\(\)\n\s*\.builder\(\)\n\s*\.title\("Backup Complete"\)/g;
const backupCompleteReplacement = `// Final history save
        if let Ok(json) = serde_json::to_string(&history) {
            let _ = tokio::fs::write(&history_file, json).await;
        }

        let _ = app_handle.notification()
            .builder()
            .title("Backup Complete")`;

code = code.replace(backupCompleteRegex, backupCompleteReplacement);

fs.writeFileSync('backup.rs', code);
console.log('Modified backup.rs successfully');

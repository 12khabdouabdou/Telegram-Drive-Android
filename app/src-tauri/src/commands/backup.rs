use tauri::{AppHandle, State, Manager, Emitter};
use std::sync::{Arc, Mutex, OnceLock};
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};

use crate::TelegramState;
use crate::commands::utils::resolve_peer;
use grammers_client::InputMessage;

#[derive(Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub folders: Vec<String>,
    pub dest_folder_id: Option<i64>,
}

#[derive(Clone, Serialize)]
pub struct BackupProgress {
    pub total: usize,
    pub done: usize,
    pub current_file: String,
    pub is_running: bool,
}

static BACKUP_RUNNING: OnceLock<Arc<Mutex<bool>>> = OnceLock::new();

fn get_running_flag() -> Arc<Mutex<bool>> {
    BACKUP_RUNNING.get_or_init(|| Arc::new(Mutex::new(false))).clone()
}

#[tauri::command]
pub async fn cmd_start_backup(
    config: BackupConfig,
    app_handle: AppHandle,
    state: State<'_, TelegramState>,
) -> Result<String, String> {
    let running_flag = get_running_flag();
    {
        let mut running = running_flag.lock().unwrap();
        if *running {
            return Err("Backup is already running".to_string());
        }
        *running = true;
    }

    let state = state.inner().clone();
    
    // Create a history file path
    let history_file = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backup_history.json");
    
    tokio::spawn(async move {
        // Load history
        let mut history: std::collections::HashSet<String> = if history_file.exists() {
            if let Ok(data) = tokio::fs::read_to_string(&history_file).await {
                serde_json::from_str(&data).unwrap_or_default()
            } else {
                std::collections::HashSet::new()
            }
        } else {
            std::collections::HashSet::new()
        };

        // Gather all files
        let mut files_to_upload = Vec::new();
        for folder in &config.folders {
            for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let path_str = entry.path().to_string_lossy().to_string();
                    if !history.contains(&path_str) {
                        files_to_upload.push(path_str);
                    }
                }
            }
        }

        let total = files_to_upload.len();
        let mut done = 0;

        let _ = app_handle.emit("backup-progress", BackupProgress {
            total,
            done,
            current_file: "".to_string(),
            is_running: true,
        });

        for path in files_to_upload {
            let _ = app_handle.emit("backup-progress", BackupProgress {
                total,
                done,
                current_file: path.clone(),
                is_running: true,
            });

            let client_opt = { state.client.lock().await.clone() };
            if let Some(client) = client_opt {
                if let Ok(mut file) = tokio::fs::File::open(&path).await {
                    if let Ok(metadata) = file.metadata().await {
                        let size = metadata.len() as usize;
                        let file_name = std::path::Path::new(&path)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "file".to_string());
                        
                        // Avoid uploading extremely large files in background to prevent OOM
                        if size < 1024 * 1024 * 500 { // 500MB limit
                            if let Ok(uploaded_file) = client.upload_stream(&mut file, size, file_name).await {
                                let message = InputMessage::new().text("").file(uploaded_file);
                                if let Ok(peer) = resolve_peer(&client, config.dest_folder_id, &state.peer_cache).await {
                                    if client.send_message(&peer, message).await.is_ok() {
                                        history.insert(path.clone());
                                        if let Ok(json) = serde_json::to_string(&history) {
                                            let _ = tokio::fs::write(&history_file, json).await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            done += 1;
        }

        let _ = app_handle.emit("backup-progress", BackupProgress {
            total,
            done,
            current_file: "".to_string(),
            is_running: false,
        });

        *running_flag.lock().unwrap() = false;
    });

    Ok("Backup started".to_string())
}

#[tauri::command]
pub fn cmd_get_backup_status() -> bool {
    let running_flag = get_running_flag();
    let is_running = *running_flag.lock().unwrap();
    is_running
}

const fs = require('fs');
let code = fs.readFileSync('bandwidth.rs', 'utf8');

const regex = /fn save_throttled\(&self, stats: &BandwidthStats\) \{\n\s*let mut last = self\.last_save\.lock\(\)\.unwrap\(\);\n\s*if last\.elapsed\(\) >= Duration::from_secs\(1\) \{\n\s*self\.save_locked\(stats\);\n\s*\*last = Instant::now\(\);\n\s*\}\n\s*\}/;

const replacement = `fn save_throttled(&self, stats: &BandwidthStats) {
        let mut last = self.last_save.lock().unwrap();
        if last.elapsed() >= Duration::from_secs(1) {
            let stats_clone = stats.clone();
            let file_path_clone = self.file_path.clone();
            tauri::async_runtime::spawn_blocking(move || {
                if let Ok(json) = serde_json::to_string(&stats_clone) {
                    let _ = std::fs::write(file_path_clone, json);
                }
            });
            *last = Instant::now();
        }
    }`;

code = code.replace(regex, replacement);

fs.writeFileSync('bandwidth.rs', code);
console.log("Fixed bandwidth.rs");

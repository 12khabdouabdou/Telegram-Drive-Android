const fs = require('fs');
let code = fs.readFileSync('fs.rs', 'utf8');

const regex = /let _ = std::process::Command::new\("am"\)\n\s*\.args\(\["broadcast", "-a", "android\.intent\.action\.MEDIA_SCANNER_SCAN_FILE", "-d", &format!\("file:\/\/{\}", actual_save_path\)]\)\n\s*\.status\(\);/g;

const replacement = `let path_clone = actual_save_path.clone();
        tokio::task::spawn_blocking(move || {
            let _ = std::process::Command::new("am")
                .args(["broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", &format!("file://{}", path_clone)])
                .status();
        });`;

code = code.replace(regex, replacement);
fs.writeFileSync('fs.rs', code);
console.log("Fixed media scanner in fs.rs");

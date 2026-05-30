const fs = require('fs');
let code = fs.readFileSync('fs.rs', 'utf8');

const hook = `
    #[cfg(target_os = "android")]
    {
        // Broadcast intent to trigger MediaScanner so it appears in Gallery/Files immediately
        let _ = std::process::Command::new("am")
            .args(["broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", &format!("file://{}", actual_save_path)])
            .status();
    }

    Ok("Download successful".to_string())
`;

code = code.replace(`Ok("Download successful".to_string())`, hook.trim());
fs.writeFileSync('fs.rs', code);
console.log("Updated fs.rs");

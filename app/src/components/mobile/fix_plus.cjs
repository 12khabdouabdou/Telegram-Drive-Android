const fs = require('fs');
let code = fs.readFileSync('MobileAutoBackup.tsx', 'utf8');

code = code.replace("FolderSearch, Trash2", "FolderSearch, Trash2, Plus");

fs.writeFileSync('MobileAutoBackup.tsx', code);
console.log("Fixed plus import");

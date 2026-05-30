const fs = require('fs');
let code = fs.readFileSync('MobileAutoBackup.tsx', 'utf8');

// 1. Add import for dialog open
if (!code.includes("@tauri-apps/plugin-dialog")) {
    code = code.replace("import { invoke } from '@tauri-apps/api/core';", "import { invoke } from '@tauri-apps/api/core';\nimport { open } from '@tauri-apps/plugin-dialog';");
}

// 2. Change Plus icon import to include FolderOpen
if (!code.includes("FolderSearch")) {
    code = code.replace("X, CloudUpload, Play, Square, Folder, Phone, Plus, Trash2", "X, CloudUpload, Play, Square, Folder, Phone, FolderSearch, Trash2");
}

// 3. Replace the text input block with a browse button
const oldInputBlockRegex = /<input\n\s*type="text"\n\s*value=\{newFolderInput\}\n\s*onChange=\{\(e\) => setNewFolderInput\(e\.target\.value\)\}\n\s*placeholder="e\.g\. \/storage\/emulated\/0\/DCIM"\n\s*className="flex-1 bg-telegram-hover\/30 border border-telegram-border\/50 rounded-lg px-3 py-2 text-xs text-telegram-text focus:outline-none focus:border-telegram-primary\/50 transition-colors"\n\s*\/>\n\s*<button\n\s*onClick=\{\(\) => \{\n\s*if \(newFolderInput && !customFolders\.includes\(newFolderInput\)\) \{\n\s*setCustomFolders\(prev => \[\.\.\.prev, newFolderInput\]\);\n\s*setNewFolderInput\(''\);\n\s*\}\n\s*\}\}\n\s*disabled=\{!newFolderInput\}\n\s*className="p-2 bg-telegram-primary text-black rounded-lg disabled:opacity-50 active:scale-95 transition-all"\n\s*>\n\s*<Plus className="w-4 h-4" \/>\n\s*<\/button>/g;

const newInputBlock = `<button
                    onClick={async () => {
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === 'string' && !customFolders.includes(selected)) {
                          setCustomFolders(prev => [...prev, selected]);
                        } else if (selected && selected.startsWith && selected.startsWith('content://')) {
                          toast.error("Android protected folders (content://) are not fully supported. Please try a different folder or grant All Files Access.");
                        }
                      } catch (err) {
                        toast.error("Failed to open folder picker");
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-telegram-primary/20 text-telegram-primary border border-telegram-primary/30 rounded-lg px-3 py-2.5 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <FolderSearch className="w-4 h-4" />
                    Browse Phone Folders
                  </button>`;

code = code.replace(oldInputBlockRegex, newInputBlock);

// 4. Remove `const [newFolderInput, setNewFolderInput] = useState('');` since it's no longer used
code = code.replace("const [newFolderInput, setNewFolderInput] = useState('');\n", "");

fs.writeFileSync('MobileAutoBackup.tsx', code);
console.log("Updated MobileAutoBackup.tsx");

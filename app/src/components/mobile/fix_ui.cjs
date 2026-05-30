const fs = require('fs');
let code = fs.readFileSync('MobileAutoBackup.tsx', 'utf8');

// Restore the text input
const buttonBlockRegex = /<button\n\s*onClick=\{async \(\) => \{\n\s*try \{\n\s*const selected = await open\(\{\n\s*directory: true,\n\s*multiple: false,\n\s*\}\);\n\s*if \(selected && typeof selected === 'string' && !customFolders\.includes\(selected\)\) \{\n\s*setCustomFolders\(prev => \[\.\.\.prev, selected\]\);\n\s*\} else if \(selected && selected\.startsWith && selected\.startsWith\('content:\/\/'\)\) \{\n\s*toast\.error\("Android protected folders \(content:\/\/\) are not fully supported\. Please try a different folder or grant All Files Access\."\);\n\s*\}\n\s*\} catch \(err\) \{\n\s*toast\.error\("Failed to open folder picker"\);\n\s*\}\n\s*\}\}\n\s*className="flex-1 flex items-center justify-center gap-2 bg-telegram-primary\/20 text-telegram-primary border border-telegram-primary\/30 rounded-lg px-3 py-2\.5 text-xs font-semibold active:scale-95 transition-all"\n\s*>\n\s*<FolderSearch className="w-4 h-4" \/>\n\s*Browse Phone Folders\n\s*<\/button>/g;

const replacement = `<div className="flex flex-col gap-2 w-full">
                  <div className="flex gap-2 w-full">
                    <input
                      type="text"
                      value={newFolderInput}
                      onChange={(e) => setNewFolderInput(e.target.value)}
                      placeholder="/storage/emulated/0/DCIM"
                      className="flex-1 bg-telegram-hover/30 border border-telegram-border/50 rounded-lg px-3 py-2 text-xs text-telegram-text focus:outline-none focus:border-telegram-primary/50"
                    />
                    <button
                      onClick={() => {
                        if (newFolderInput && !customFolders.includes(newFolderInput)) {
                          setCustomFolders(prev => [...prev, newFolderInput]);
                          setNewFolderInput('');
                        }
                      }}
                      disabled={!newFolderInput}
                      className="p-2 bg-telegram-primary text-black rounded-lg disabled:opacity-50 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === 'string') {
                           if (selected.startsWith('content://')) {
                             toast.error("Picker returned content:// URI. Using raw path instead.");
                             // Try to extract raw path if possible, or just append generic
                             setCustomFolders(prev => [...prev, "/storage/emulated/0/DCIM"]);
                           } else if (!customFolders.includes(selected)) {
                             setCustomFolders(prev => [...prev, selected]);
                           }
                        }
                      } catch (err) {
                        toast.error("Picker failed. Please type the path manually.");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-telegram-primary/20 text-telegram-primary border border-telegram-primary/30 rounded-lg px-3 py-2.5 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <FolderSearch className="w-4 h-4" />
                    Browse System Folders
                  </button>
                </div>`;

code = code.replace(buttonBlockRegex, replacement);

// Restore the state for newFolderInput
if (!code.includes("const [newFolderInput, setNewFolderInput] = useState('');")) {
    code = code.replace("const [customFolders, setCustomFolders] = useState<string[]>(standardFolders);", "const [customFolders, setCustomFolders] = useState<string[]>(standardFolders);\n  const [newFolderInput, setNewFolderInput] = useState('');");
}

fs.writeFileSync('MobileAutoBackup.tsx', code);
console.log("Fixed UI");

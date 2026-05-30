const fs = require('fs');
const content = fs.readFileSync('MobileDashboard.tsx', 'utf-8');

const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes("const toggleSort = useCallback((field: 'name' | 'size' | 'date') => {"));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes("}, [displayedFiles, globalResults, searchTerm, sortBy, sortOrder]);"));

if (startIndex !== -1 && endIndex !== -1) {
  const block = lines.slice(startIndex, endIndex + 1);
  
  // Remove the block
  lines.splice(startIndex, block.length);
  
  // Find handleBulkDownload
  const insertIndex = lines.findIndex(l => l.includes("const handleBulkDownload = useCallback(async () => {"));
  
  if (insertIndex !== -1) {
    lines.splice(insertIndex, 0, ...block);
    fs.writeFileSync('MobileDashboard.tsx', lines.join('\n'));
    console.log("Fixed!");
  } else {
    console.error("Could not find handleBulkDownload");
  }
} else {
  console.error("Could not find block");
}

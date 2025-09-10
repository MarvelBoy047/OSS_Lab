// scan_all_src.js
const fs = require('fs');
const path = require('path');

function listFiles(dir, prefix = '') {
  const items = fs.readdirSync(dir);
  let output = '';
  for (const file of items) {
    const fullPath = path.join(dir, file);
    const relPath = path.join(prefix, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      output += `[DIR ] ${relPath}\n`;
      output += listFiles(fullPath, relPath);
    } else {
      output += `[FILE] ${relPath}\n`;
    }
  }
  return output;
}

const baseDir = path.join(__dirname, 'src');
const result = listFiles(baseDir);

fs.writeFileSync('file_list.txt', result, 'utf-8');

console.log('File listing saved to file_list.txt');

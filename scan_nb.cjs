const fs = require('fs');
const nb = JSON.parse(fs.readFileSync('CleanRAG2.ipynb', 'utf8'));
const credentialPatterns = [/gsk_[A-Za-z0-9]{20,}/g, /qdrant[_\s\-]*api[_\s]*key.*?['"][^'"]{10,}/gi, /QDRANT_API_KEY\s*=\s*['"][^'"]{10,}/gi];
let foundCount = 0;
nb.cells.forEach((cell, i) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  src.split('\n').forEach((line, lineNum) => {
    credentialPatterns.forEach(pat => {
      if (pat.test(line)) {
        foundCount++;
        console.log(`CREDENTIAL DETECTED: Cell ${i}, Line ${lineNum+1}: ${line.replace(/(['"])[A-Za-z0-9]{8}[A-Za-z0-9]*(['"])/g, '$1[REDACTED]$2').replace(/gsk_[A-Za-z0-9]{8}[A-Za-z0-9]*/g, 'gsk_[REDACTED]')}`);
      }
      pat.lastIndex = 0;
    });
  });
});
console.log(`\nTotal credential exposures found: ${foundCount}`);

// Also extract the structural patterns we care about
console.log('\n=== CELL STRUCTURE SUMMARY ===');
nb.cells.forEach((cell, i) => {
  if (cell.cell_type !== 'code') return;
  const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  if (src.length < 30) return;
  const firstLine = src.split('\n')[0].trim().substring(0, 120);
  console.log(`Cell ${i}: ${firstLine}`);
});

import { readFileSync } from 'fs';

const nb = JSON.parse(readFileSync('CleanRAG2.ipynb', 'utf-8'));

const groqPattern = /gsk_[A-Za-z0-9]{20,}/g;
const qdrantKeyPattern = /['"][A-Za-z0-9\-_]{30,}['"]/g; // catches qdrant tokens

let foundCount = 0;

for (let i = 0; i < nb.cells.length; i++) {
  const cell = nb.cells[i];
  if (cell.cell_type !== 'code') continue;
  const src: string = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  
  const lines = src.split('\n');
  lines.forEach((line: string, lineNum: number) => {
    const hasGroq = groqPattern.test(line);
    groqPattern.lastIndex = 0;
    const hasQdrant = line.toLowerCase().includes('qdrant') && qdrantKeyPattern.test(line);
    qdrantKeyPattern.lastIndex = 0;
    if (hasGroq) {
      foundCount++;
      const redacted = line.replace(/gsk_[A-Za-z0-9]+/g, 'gsk_[REDACTED]');
      console.log(`[CREDENTIAL] Groq API key — Cell ${i}, Line ${lineNum + 1}: ${redacted.trim()}`);
    }
    if (hasQdrant) {
      foundCount++;
      const redacted = line.replace(/(['"])[A-Za-z0-9\-_]{30,}(['"])/g, '$1[REDACTED]$2');
      console.log(`[CREDENTIAL] Qdrant token   — Cell ${i}, Line ${lineNum + 1}: ${redacted.trim()}`);
    }
  });
}

console.log(`\nTotal credential exposures found: ${foundCount}`);
console.log('\n=== CELL STRUCTURE SUMMARY ===');
nb.cells.forEach((cell: any, i: number) => {
  if (cell.cell_type !== 'code') return;
  const src: string = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
  if (src.trim().length < 20) return;
  const first = src.trim().split('\n')[0].substring(0, 130);
  console.log(`Cell[${i.toString().padStart(2,'0')}]: ${first}`);
});

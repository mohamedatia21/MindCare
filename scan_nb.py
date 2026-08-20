import json
import re

with open('CleanRAG2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

found = 0
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] != 'code':
        continue
    src = ''.join(cell['source'])
    for linenum, line in enumerate(src.split('\n')):
        if re.search(r'gsk_[A-Za-z0-9]{15,}', line):
            found += 1
            red = re.sub(r'gsk_[A-Za-z0-9]+', 'gsk_[REDACTED]', line)
            print(f'[GROQ KEY] Cell {i}, Line {linenum+1}: {red.strip()[:120]}')
        if re.search(r'qdrant', line, re.IGNORECASE) and re.search(r'["\'][A-Za-z0-9\-_]{20,}["\']', line):
            found += 1
            red = re.sub(r'(["\'])[A-Za-z0-9\-_]{20,}(["\'])', r'\1[REDACTED]\2', line)
            print(f'[QDRANT KEY] Cell {i}, Line {linenum+1}: {red.strip()[:120]}')

print(f'\nTotal exposures: {found}')
print('\n=== CELL STRUCTURE ===')
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] != 'code':
        continue
    src = ''.join(cell['source']).strip()
    if len(src) < 20:
        continue
    first = src.split('\n')[0][:130]
    print(f'Cell[{i:02d}]: {first}')

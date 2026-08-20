import json
import re

with open('CleanRAG2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Extract cells of interest by index
cells_to_read = [3, 5, 7, 9, 23, 24, 32, 33, 39, 40, 43, 44, 45, 46, 47, 49, 50, 56, 57, 58, 59, 61, 62]
for i in cells_to_read:
    if i >= len(nb['cells']):
        continue
    cell = nb['cells'][i]
    src = ''.join(cell['source'])
    # Redact keys before printing
    src = re.sub(r'gsk_[A-Za-z0-9]+', 'gsk_[REDACTED]', src)
    src = re.sub(r'(["\'])[A-Za-z0-9]{32,}(["\'])', r'\1[REDACTED]\2', src)
    print(f'\n{"="*60}')
    print(f'CELL {i}:')
    print(src[:2000])

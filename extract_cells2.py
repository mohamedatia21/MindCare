import json
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open('CleanRAG2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Extract cells 49-62 for system prompt and eval harness
cells_to_read = [49, 50, 51, 56, 57, 58, 59, 60, 61, 62]
for i in cells_to_read:
    if i >= len(nb['cells']):
        continue
    cell = nb['cells'][i]
    src = ''.join(cell['source'])
    src = re.sub(r'gsk_[A-Za-z0-9]+', 'gsk_[REDACTED]', src)
    src = re.sub(r'(["\'])[A-Za-z0-9]{32,}(["\'])', r'\1[REDACTED]\2', src)
    print(f'\n{"="*60}')
    print(f'CELL {i}:')
    print(src[:3000])

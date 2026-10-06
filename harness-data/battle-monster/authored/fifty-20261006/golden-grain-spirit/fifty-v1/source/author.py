"""Transcribe ONLY the explicitly authored horizontal pixel strings in native.rows.
Blank initialization and ASCII transcription only; no shapes, transforms or inference.
Each entry: y x literal-string. Unspecified pixels stay transparent.
"""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT / 'palette.json').read_text())
frames = {}
for line in (ROOT / 'native.rows').read_text().splitlines():
    if not line or line.startswith('#'): continue
    if line.startswith('@'):
        name = line[1:]
        frames[name] = [['.'] * 96 for _ in range(96)]
        continue
    sy, sx, ink = line.split()
    y, x = int(sy), int(sx)
    if not 0 <= y < 96 or not 0 <= x <= 96-len(ink):
        raise ValueError((name,y,x,ink))
    if any(c != '.' and c not in palette for c in ink):
        raise ValueError((name,ink))
    frames[name][y][x:x+len(ink)] = list(ink)
# Every visual repair has explicit native frame coordinates; no propagation.
for line in (ROOT / 'corrections.rows').read_text().splitlines():
    if not line or line.startswith('#'): continue
    if line.startswith('@'):
        name = line[1:]
        continue
    sy, sx, ink = line.split()
    y, x = int(sy), int(sx)
    if not 0 <= y < 96 or not 0 <= x <= 96-len(ink):
        raise ValueError((name,y,x,ink))
    if any(c != '.' and c not in palette for c in ink):
        raise ValueError((name,ink))
    frames[name][y][x:x+len(ink)] = list(ink)
for name, grid in frames.items():
    directory = ROOT / ('poses' if name in {'idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'} else 'actions')
    (directory / (name+'.pxgrid')).write_text('\n'.join(''.join(row) for row in grid)+'\n')
print('Transcribed:', ', '.join(frames))

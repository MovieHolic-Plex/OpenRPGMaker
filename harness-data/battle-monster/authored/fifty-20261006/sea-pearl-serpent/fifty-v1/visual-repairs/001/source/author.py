"""Place only the literal, independently authored row clusters in sketches.
No shapes, frame inheritance, shifts, interpolation, fill or shading functions.
Transparent padding is the only generated pixel content.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
for path in sorted((ROOT/'sketches').glob('*.txt')):
    canvas=[list('.'*128) for _ in range(128)]
    x=y=None
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'): continue
        if line.startswith(('@ ', '@+ ')):
            overlay=line.startswith('@+ ')
            x,y=map(int,line[3 if overlay else 2:].split()); continue
        if x is None: raise ValueError(path)
        if not set(line) <= set(palette)|{'.'}: raise ValueError((path,y,line))
        if x+len(line)>128 or y>127: raise ValueError((path,x,y,len(line)))
        if overlay:
            for dx,c in enumerate(line):
                if c!='.': canvas[y][x+dx]=c
        else: canvas[y][x:x+len(line)]=list(line)
        y+=1
    folder='actions' if path.stem.startswith(('skill','poison','stun','sleep')) else 'poses'
    (ROOT/folder/(path.stem+'.pxgrid')).write_text('\n'.join(''.join(row) for row in canvas)+'\n')

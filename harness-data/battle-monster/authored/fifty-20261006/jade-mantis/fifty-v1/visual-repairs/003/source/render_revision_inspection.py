"""Display authored native grids at 1x and nearest-neighbor 3x, without editing."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT/'palette.json').read_text())
board = Image.new('RGB', (840, 768), '#e9e3d6')
draw = ImageDraw.Draw(board)
for j, background in enumerate(('light', 'dark', 'checker')):
    for i, name in enumerate(('attack', 'skill_b', 'skill_c')):
        x, y = i*280, j*256
        draw.rectangle((x, y, x+279, y+255),
                       fill='#18232c' if background == 'dark' else '#e9e3d6')
        if background == 'checker':
            for yy in range(y, y+256, 12):
                for xx in range(x, x+280, 12):
                    draw.rectangle((xx, yy, min(xx+11, x+279), min(yy+11, y+255)),
                                   fill='#737b7c' if ((xx-x)//12+(yy-y)//12)%2 else '#a7ada6')
        folder = 'poses' if name == 'attack' else 'actions'
        rows = (ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
        frame = Image.new('RGBA', (64, 64))
        frame.putdata([tuple(bytes.fromhex(palette[c][1:]))+(255,)
                       if c != '.' else (0, 0, 0, 0) for row in rows for c in row])
        color = '#edf1e7' if background == 'dark' else '#172E2C'
        draw.text((x+8, y+5), name+' / '+background, fill=color)
        zoom = frame.resize((192, 192), Image.Resampling.NEAREST)
        board.paste(zoom, (x+8, y+24), zoom)
        board.paste(frame, (x+208, y+92), frame)
        draw.text((x+212, y+74), '1x', fill=color)
board.save(ROOT/'preview/revision-inspection.png')

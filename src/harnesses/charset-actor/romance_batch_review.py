#!/usr/bin/env python3
"""눈 검수용: 여러 후보를 (베이스|후보) 쌍으로 나란히.  python3 romance_batch_review.py RUNDIR OUT.png KEY [KEY ...]  (S=5)"""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import chr as C, harness as H  # noqa
from PIL import Image, ImageDraw
run, out, keys = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
S = 5
W = 3 * 26
tiles = []
for key in keys:
    meta = json.loads((run / key / 'meta.json').read_text())
    bp, bf = H.base_of(meta['base'])
    pal, _, fr = C.load(run / key / 'chip.chr.txt')
    im = Image.new('RGBA', (2 * W + 6, 4 * 34 + 8), (92, 140, 70, 255))
    for who, (p, f) in enumerate(((bp, bf), (pal, fr))):
        for di, d in enumerate(('down', 'right', 'up', 'left')):
            for k in range(3):
                im.alpha_composite(C.frame_rgba(p, f[(d, k)]), (who * (W + 6) + 1 + k * 26, 8 + di * 34 + 1))
    big = im.resize((im.width * S, im.height * S), Image.NEAREST).convert('RGB')
    ImageDraw.Draw(big).text((4, 2), key, fill=(255, 255, 0))
    tiles.append(big)
cols = 2
rows = (len(tiles) + cols - 1) // cols
w, h = tiles[0].size
sheet = Image.new('RGB', (cols * w + (cols - 1) * 10, rows * h + (rows - 1) * 10), (20, 20, 20))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * (w + 10), (i // cols) * (h + 10)))
sheet.save(out)
print(sheet.size)

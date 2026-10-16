#!/usr/bin/env python3
"""눈 검수용 비교 그림: 베이스 vs 후보, 4방향 × 걸음 3프레임, 8배.  python3 romance_review.py RUNDIR KEY OUT.png"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import chr as C, harness as H  # noqa
from PIL import Image
run, key, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
import json
meta = json.loads((run / key / 'meta.json').read_text())
bp, bf = H.base_of(meta['base'])
pal, _, fr = C.load(run / key / 'chip.chr.txt')
S = 8
W = 3 * 26
im = Image.new('RGBA', (2 * W + 6, 4 * 34), (92, 140, 70, 255))
for who, (p, f) in enumerate(((bp, bf), (pal, fr))):
    for di, d in enumerate(('down', 'right', 'up', 'left')):
        for k in range(3):
            im.alpha_composite(C.frame_rgba(p, f[(d, k)]), (who * (W + 6) + 1 + k * 26, di * 34 + 1))
im.resize((im.width * S, im.height * S), Image.NEAREST).convert('RGB').save(out)

#!/usr/bin/env python3
"""학교 맵 관문용 크롭 4장(×2) — verify-shots/jp-city/school-1x.png → school-crop-{nw,ne,sw,e}.png. render.py 다음에 돈다."""
import os
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
D = os.path.join(ROOT, 'verify-shots', 'jp-city')
im = Image.open(os.path.join(D, 'school-1x.png'))
for name, box in {'nw': (0, 0, 560, 400), 'ne': (560, 0, 1088, 330), 'sw': (0, 280, 560, 768), 'e': (560, 180, 1088, 768)}.items():
    c = im.crop(box)
    c.resize((c.width * 2, c.height * 2), Image.NEAREST).save(os.path.join(D, f'school-crop-{name}.png'))
    print(name, c.size)

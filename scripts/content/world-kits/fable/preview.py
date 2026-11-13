#!/usr/bin/env python3
"""그린 그림을 원본 옆에 놓아 본다(모델 없음): python3 preview.py <세계> <out.png> [id 머리…]
변형은 «원본 · 새 그림», 집은 지붕+벽을 이어 붙인 모습, 재질은 2×2 로 깐 모습. 모두 주인공과 함께 3배."""
import sys
from PIL import Image
import wk_common as C

def _cat(a, b):
    c = Image.new('RGBA', (a.width + b.width, a.height)); c.alpha_composite(a, (0, 0)); c.alpha_composite(b, (a.width, 0)); return c


W = C.World(sys.argv[1])
out = sys.argv[2]
heads = sys.argv[3:]
jobs = W.mod.jobs(W)
hero = C.hero()
cells = []
seen = set()
for j in jobs:
    if heads and not any(j['id'].startswith(h) for h in heads): continue
    if j.get('house'):
        h = j['house']
        if h['id'] in seen: continue
        parts = [W.src_png(f'{h["id"]}-{p}') for p in ('roof', 'roofl', 'roofr', 'wall')]
        roof = parts[0] or (parts[1] and parts[2] and _cat(parts[1], parts[2]))
        if roof is None or parts[3] is None: continue
        seen.add(h['id'])
        im = Image.new('RGBA', (parts[3].width, roof.height + 32)); im.alpha_composite(roof, (0, 0)); im.alpha_composite(parts[3], (0, roof.height))
        cells.append((W.kit_image(h['base']) if h.get('base') else None, im))
        continue
    im = W.src_png(j['id'])
    if im is None: continue
    if j['cls'] == 'ground':
        t = Image.new('RGBA', (32, 32))
        for y in (0, 16):
            for x in (0, 16): t.alpha_composite(im, (x, y))
        im = t
    cells.append((W.kit_image(j['base']) if j.get('base') else None, im))


Z, cols, pad = 3, 6, 10
blocks = []
for base, new in cells:
    w = (base.width + 6 if base else 0) + new.width + 6 + 24
    h = max(new.height, base.height if base else 0, 32)
    b = Image.new('RGBA', (w, h + 4), C.BG + (255,))
    x = 0
    if base: b.alpha_composite(base, (x, h - base.height)); x += base.width + 6
    b.alpha_composite(new, (x, h - new.height)); x += new.width + 6
    b.alpha_composite(hero, (x, h - 32))
    blocks.append(b)
rows = [blocks[i:i + cols] for i in range(0, len(blocks), cols)]
Wd = max(sum(b.width + pad for b in r) for r in rows) + pad
Hd = sum(max(b.height for b in r) + pad for r in rows) + pad
s = Image.new('RGBA', (Wd, Hd), (150, 130, 96, 255))
y = pad
for r in rows:
    x = pad
    for b in r: s.alpha_composite(b, (x, y)); x += b.width + pad
    y += max(b.height for b in r) + pad
s.resize((s.width * Z, s.height * Z), Image.NEAREST).convert('RGB').save(out)
print(out, len(cells))

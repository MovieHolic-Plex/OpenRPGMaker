# 비교 시트 compare-ref.png (오토타일 감사 보정 2026-10-08): 같은 2배율로 [이전 판 | 새 판] — 달라진 곳만 잘라 나란히.
#   이전 판 = 보정 전 커밋 OLD_REV 의 render-1x.png(git 에서 읽는다), 새 판 = 지금 render-1x.png.
#   달라진 칸을 세어 가장 많이 바뀐 창(가로 200 × 세로 120 화소)부터 겹치지 않게 최대 4곳 고른다.
#   맨 아래 줄은 새 오토타일 시험 그림(5×5 덩이·L자·나선·들쭉날쭉, audit_autotile.py) 전/후.
#   python3 gc_fix_compare.py
import os, io, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SLUG = os.path.basename(HERE)
OLD_REV = 'cec2f4fb39'
NAMES = ['mist']
WW, WH, T = 200, 120, 16

old = Image.open(io.BytesIO(subprocess.check_output(['git', 'show', '%s:tiledata/beodeul-variants/%s/render-1x.png' % (OLD_REV, SLUG)], cwd=HERE))).convert('RGB')
new = Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGB')
a, b = np.asarray(old).astype(int), np.asarray(new).astype(int)
H, W = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
diff = (np.abs(a[:H, :W] - b[:H, :W]).sum(2) > 24)
cells = diff[:H // T * T, :W // T * T].reshape(H // T, T, W // T, T).sum((1, 3)) > 6

picks = []
cw, ch = WW // T, WH // T
for _ in range(4):
    best = None
    for y in range(0, cells.shape[0] - ch + 1):
        for x in range(0, cells.shape[1] - cw + 1):
            if any(abs(x - px) < cw and abs(y - py) < ch for px, py in picks): continue
            c = int(cells[y:y + ch, x:x + cw].sum())
            if best is None or c > best[0]: best = (c, x, y)
    if not best or best[0] == 0: break
    picks.append((best[1], best[2]))


def cr(im, x, y): return im.crop((x * T, y * T, x * T + WW, y * T + WH)).resize((WW * 2, WH * 2), Image.NEAREST)


rows = [('BEFORE (%d,%d)' % (x, y), cr(old, x, y), 'AFTER: round autotile edge', cr(new, x, y)) for x, y in picks]
A = os.path.join(ROOT, 'tiledata', 'beodeul-kits', 'audit-autotile')
tests = []
for n in NAMES:
    bf, af = os.path.join(A, '%s-%s-before.png' % (SLUG, n)), os.path.join(A, '%s-%s-after.png' % (SLUG, n))
    if os.path.exists(bf) and os.path.exists(af): tests.append((n, Image.open(bf).convert('RGB'), Image.open(af).convert('RGB')))
Wd = max([WW * 2 * 2 + 30] + [t[1].width + 20 for t in tests])
hgt = sum(r[1].height + 22 for r in rows) + sum(t[1].height + t[2].height + 40 for t in tests) + 8
o = Image.new('RGB', (Wd, hgt), (28, 28, 34)); d = ImageDraw.Draw(o); y = 8
for la, A_, lb, B_ in rows:
    d.text((10, y), la, fill=(230, 230, 230)); d.text((WW * 2 + 20, y), lb, fill=(230, 230, 230))
    o.paste(A_, (10, y + 14)); o.paste(B_, (WW * 2 + 20, y + 14)); y += A_.height + 22
for n, bf, af in tests:
    d.text((10, y), 'autotile-%s BEFORE (sheet | 5x5 | L | spiral | organic, 2x)' % n, fill=(230, 200, 200)); o.paste(bf, (10, y + 14)); y += bf.height + 20
    d.text((10, y), 'autotile-%s AFTER' % n, fill=(200, 230, 200)); o.paste(af, (10, y + 14)); y += af.height + 20
o.save(os.path.join(HERE, 'compare-ref.png')); print(o.size, picks)

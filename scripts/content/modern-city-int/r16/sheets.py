#!/usr/bin/env python3
"""r16 검수 시트: 다시 그린 것(옛|새) 또는 현재 그림 모음, 번호 붙인 판.
  python3 sheets.py redraw <outdir> [per]     grids/ 의 모든 기물: 옛 3배 | 새 3배 | 새 1배
  python3 sheets.py scan <ids.json> <outdir> [per]   현재 시트 그림 3배 + 1배
"""
import json, os, sys
from PIL import Image, ImageDraw
import grid as G

def cell(items, s=3):
    W = max(i.width for i in items) * s
    return W

def page(entries, out, cols):
    # entries: [(label, [imgs])]
    tiles = []
    for lab, ims in entries:
        zs = [G.zoom(im, 3 if im.width <= 64 else 2, grid=False) if k < len(ims) - 1 else G.checker(im.width, im.height, 1) for k, im in enumerate(ims)]
        zs[-1].alpha_composite(ims[-1])
        w = sum(z.width for z in zs) + 6 * (len(zs) - 1) + 8; h = max(z.height for z in zs) + 22
        T = Image.new('RGBA', (w, h), (30, 32, 38, 255)); d = ImageDraw.Draw(T)
        d.text((4, 3), lab, fill=(240, 240, 240), font=G.FONT); x = 4
        for z in zs: T.alpha_composite(z, (x, 18)); x += z.width + 6
        tiles.append(T)
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    W = max(sum(t.width + 6 for t in r) for r in rows); H = sum(max(t.height for t in r) + 6 for r in rows)
    C = Image.new('RGBA', (W, H), (18, 20, 24, 255)); y = 0
    for r in rows:
        x = 0
        for t in r: C.alpha_composite(t, (x, y)); x += t.width + 6
        y += max(t.height for t in r) + 6
    C.save(out); print(out, C.size)

def main():
    sp = G.spec(); cur = Image.open(G.PNG).convert('RGBA'); old = G.orig_sheet()
    if sys.argv[1] == 'redraw':
        out = sys.argv[2]; per = int(sys.argv[3]) if len(sys.argv) > 3 else 12
        ids = sorted(f[:-5] for f in os.listdir(G.GRIDS))
        idx = []
        for p in range(0, len(ids), per):
            chunk = ids[p:p + per]; ents = []
            for k, pid in enumerate(chunk):
                n = p + k + 1; idx.append((n, pid))
                ents.append(('%d %s  old | new | 1x' % (n, pid), [G.compose(sp, pid, old), G.to_img(G.load(pid)), G.to_img(G.load(pid))]))
            page(ents, os.path.join(out, 'redraw-%02d.png' % (p // per + 1)), 3)
        json.dump(idx, open(os.path.join(out, 'redraw-index.json'), 'w'))
    else:
        ids = json.load(open(sys.argv[2])); out = sys.argv[3]; per = int(sys.argv[4]) if len(sys.argv) > 4 else 30
        idx = []
        for p in range(0, len(ids), per):
            chunk = ids[p:p + per]; ents = []
            for k, pid in enumerate(chunk):
                n = p + k + 1; idx.append((n, pid)); im = G.compose(sp, pid, cur)
                ents.append(('%d %s' % (n, pid), [im, im]))
            page(ents, os.path.join(out, 'scan-%02d.png' % (p // per + 1)), 6)
        json.dump(idx, open(os.path.join(out, 'scan-index.json'), 'w'))

if __name__ == '__main__':
    main()

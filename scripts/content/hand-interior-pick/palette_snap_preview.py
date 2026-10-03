#!/usr/bin/env python3
"""실내 바닥·벽·천장 타일을 v5.pal(새 기물 팔레트)로 옮기면 어떻게 되나 — 전후 비교 페이지(2026-10-03, 사용자 「실내 바닥·벽 타일 이게 머지? 보여줘봐」).
시트는 바꾸지 않는다. 가장 가까운 팔레트 색(RGB 거리)으로 바꾼 미리보기만 만든다.
  python3 scripts/content/hand-interior-pick/palette_snap_preview.py ~/claude-viz/interior-floor-wall.html
"""
import base64, io, json, os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHEET = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
SPEC = os.path.join(ROOT, 'src/assets/handInteriorSpec.json')
PAL = os.path.join(ROOT, 'tiledata/hand-interior/pick/palette/v5.pal')
ROOMS = os.path.join(ROOT, 'tiledata/hand-interior/v5-maps/render')


def palette():
    out = []
    for line in open(PAL, encoding='utf-8'):
        if line.startswith('@rampc'):
            out += [tuple(int(c[k:k + 2], 16) for k in (1, 3, 5)) for c in line.split()[2:] if c.startswith('#')]
    return sorted(set(out))


def snap(im, pal, cache={}):
    im = im.convert('RGBA'); px = im.load(); out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] == 0: continue
            k = c[:3]
            if k not in cache: cache[k] = min(pal, key=lambda p: (p[0] - k[0]) ** 2 + (p[1] - k[1]) ** 2 + (p[2] - k[2]) ** 2)
            po[x, y] = cache[k] + (c[3],)
    return out


def colors(im): return len({c[:3] for c in im.convert('RGBA').get_flattened_data() if c[3]})


def patch(sheet, tiles, cols):
    N = sheet.width // 16; rows = (len(tiles) + cols - 1) // cols
    im = Image.new('RGBA', (cols * 16, rows * 16))
    for i, t in enumerate(tiles):
        im.alpha_composite(sheet.crop(((t % N) * 16, (t // N) * 16, (t % N) * 16 + 16, (t // N) * 16 + 16)), ((i % cols) * 16, (i // cols) * 16))
    return im


def uri(im, s):
    im = im.resize((im.width * s, im.height * s), Image.NEAREST); b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main(out):
    S = json.load(open(SPEC)); sheet = Image.open(SHEET).convert('RGBA'); pal = palette()
    def pair(name, im, s=3):
        a = snap(im, pal)
        return (f'<div class=c><div class=p><img src="{uri(im, s)}"><img src="{uri(a, s)}"></div><b>{name}</b>'
                f'<span>지금 {colors(im)}색 → 팔레트 {colors(a)}색</span></div>')
    h = ['<!doctype html><meta charset=utf-8><title>실내 바닥·벽 타일</title><style>body{background:#1d1b20;color:#ddd;font:14px sans-serif;margin:20px}'
         '.g{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px;background:#2a272e;padding:8px}'
         '.p{display:flex;gap:6px;align-items:flex-end}img{image-rendering:pixelated}span{color:#aaa;font-size:12px}h2{font-size:16px;margin:28px 0 8px}</style>',
         '<h1 style="font-size:20px">실내 칩셋의 바닥·벽·천장 타일 — 지금 vs 팔레트로 옮기면</h1>',
         f'<p>새 기물은 팔레트 {len(pal)}색 안에서만 그린다. 바닥·벽·천장 타일은 그 전에 손으로 그린 것이라 색이 묶여 있지 않다. '
         '각 칸: <b>왼쪽 = 지금</b>, <b>오른쪽 = 가장 가까운 팔레트 색으로 바꾼 것</b>(미리보기만, 시트는 그대로).</p>']
    rooms = ['inn', 'tavern', 'manor', 'chapel', 'throne', 'dungeon']
    h.append('<h2>방 전체 (예제 방) — 이 방의 바닥·벽·천장이 「실내 타일」이다</h2><div class=g>'
             + ''.join(pair(r, Image.open(os.path.join(ROOMS, r + '.png')), 1) for r in rooms if os.path.exists(os.path.join(ROOMS, r + '.png'))) + '</div>')
    h.append('<h2>바닥 (' + str(len(S['floors'])) + '종)</h2><div class=g>'
             + ''.join(pair(f.get('ko') or n, patch(sheet, f['tiles'][:f['cols'] * f['rows']], f['cols'])) for n, f in S['floors'].items()) + '</div>')
    h.append('<h2>벽 (' + str(len(S['walls'])) + '종)</h2><div class=g>'
             + ''.join(pair(w.get('ko') or n, patch(sheet, w['tiles'], w['cols'])) for n, w in S['walls'].items()) + '</div>')
    h.append('<h2>천장 (' + str(len(S['ceilings'])) + '종)</h2><div class=g>'
             + ''.join(pair(n, patch(sheet, ts[:16], 8)) for n, ts in S['ceilings'].items()) + '</div>')
    open(os.path.expanduser(out), 'w').write('\n'.join(h))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '~/claude-viz/interior-floor-wall.html')

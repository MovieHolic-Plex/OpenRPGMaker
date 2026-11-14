#!/usr/bin/env python3
"""한국 건물 60종 조립기 — Fable 5.2 가 그린 부품(tiledata/modern-city/kr-buildings/parts/*.png)을 recipes.txt 대로 쌓아 pieces/mc-bld-kr-<type>.png 를 만든다.

  python3 scripts/content/modern-city-street/kr_buildings_asm.py [id …]     # 조립(부품이 다 있는 것만) → pieces/
  python3 scripts/content/modern-city-street/kr_buildings_asm.py --check    # 크기·지붕 좁아짐(≤2px) 표

recipes.txt 한 줄 = 건물 하나:  id: 줄 / 줄 / … ; ro=기물@x,y … ; sg=글@x,y,글자색[,판색,판폭] …
  줄(위→아래) = 부품 토큰을 왼→오로. 토큰: 부품id · 부품id~(좌우 뒤집기) · 부품id[x0:x1](가로 자르기) · 부품id*3(되풀이) · slab:이름:WxH(지붕 면 9조각 늘이기) · gap:W(빈 칸) · vgap:H(빈 줄)
  줄 높이 = 가장 큰 부품, 부품은 밑변 맞춤. 줄들은 가운데가 아니라 왼쪽 맞춤(폭이 좁은 줄은 @off 로 민다: 토큰 앞 gap).
  sg 의 x 자리에 c 를 쓰면 건물 폭 가운데. ro = 옥상 기물(parts/roof-<이름>.png)을 전체 그림 좌표에 얹는다. sg = 한글 간판(Galmuri9, 지어낸 이름) — 판색을 주면 판(폭×높이, 기본 12)을 테·그늘과 함께 먼저 그린다(sg=글@x,y,글자색,판색,폭,높이).
옥상 기물(ro)·얹는 부품(ov)은 아래·오른쪽에 그늘을 드리운다.
조립 뒤 바깥 윤곽 1px 을 그 자리 재질의 어두운 색으로 두른다. 색은 확장 팔레트(palette.json)의 ramp:tone 만.
"""
import io, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import json                                         # noqa: E402
D = os.environ.get('KRB_DIR') or os.path.join(ROOT, 'tiledata/modern-city/kr-buildings')
RAMPS = json.load(open(os.path.join(ROOT, 'tiledata/modern-city/kr-buildings/palette.json'), encoding='utf-8'))['ramps']     # 확장 팔레트(버들항에서 잰 재질 줄 + 간판 원색)
def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def col(s):
    r, t = s.split(':'); return hx(RAMPS[r][int(t)]) + (255,)
def tone(s, d):
    r, t = s.split(':'); return col(f'{r}:{min(len(RAMPS[r]) - 1, max(0, int(t) + d))}')
ALL = np.array([hx(c) for r in RAMPS.values() for c in r], float)
def snap(rgb):
    return tuple(int(v) for v in ALL[int(np.argmin(((ALL - np.asarray(rgb, float)) ** 2 * (0.3, 0.59, 0.11)).sum(1)))]) + (255,)
SHADE = np.array(hx(RAMPS['ink'][2]), float)
def darker(px, k=0.45):
    """그 색의 그늘(보라·남색 쪽으로) — 팔레트 안에서."""
    return snap(np.asarray(px[:3], float) * (1 - k) + SHADE * k)
def part(pid):
    flip = pid.endswith('~'); pid = pid.rstrip('~'); crop = None
    if pid.endswith(']'): pid, c = pid[:-1].split('['); crop = [int(v) for v in c.split(':')]
    im = Image.open(f'{D}/parts/{pid}.png').convert('RGBA')
    if crop: im = im.crop((crop[0], 0, crop[1], im.height))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def slab(name, w, h, b=5):
    s = part('slab-' + name); sw, sh = s.size; out = Image.new('RGBA', (w, h))
    ix = b + (sw - 2 * b) // 4 * 4; iy = b + (sh - 2 * b) // 4 * 4      # 안쪽은 4px 주기의 배수만 되풀이한다(기와 골·골판 이음이 어긋나지 않게)
    xs = [(0, b, 0, b), (b, ix, b, w - b), (sw - b, sw, w - b, w)]; ys = [(0, b, 0, b), (b, iy, b, h - b), (sh - b, sh, h - b, h)]
    for sy0, sy1, dy0, dy1 in ys:
        for sx0, sx1, dx0, dx1 in xs:
            t = s.crop((sx0, sy0, sx1, sy1))
            for y in range(dy0, dy1, t.height):
                for x in range(dx0, dx1, t.width): out.paste(t.crop((0, 0, min(t.width, dx1 - x), min(t.height, dy1 - y))), (x, y))
    if name in GRADE:      # 큰 지붕 면이 한 색조로 평평하지 않게: 용마루 쪽 줄은 한 단 밝게, 처마 쪽 줄은 한 단 어둡게(같은 재질 줄 안에서)
        px = out.load(); n = max(3, min(6, (h - 2 * b) // 8))
        for y in list(range(b, b + n)) + list(range(h - b - n, h - b)):
            for x in range(b, w - b): px[x, y] = step(px[x, y], 1 if y < h // 2 else -1)
    return out
GRADE = {'giwa'}
_TONE = {hx(c): (r, i) for r, cs in RAMPS.items() for i, c in enumerate(cs)}
def step(px, d):
    r, i = _TONE.get(tuple(px[:3]), (None, 0))
    return px if r is None else hx(RAMPS[r][min(len(RAMPS[r]) - 1, max(0, i + d))]) + (255,)
def token(t):
    if t.startswith('gap:'): return [Image.new('RGBA', (int(t[4:]), 1))]
    if t.startswith('vgap:'): return [Image.new('RGBA', (1, int(t[5:])))]
    if t.startswith('slab:'): _, n, wh = t.split(':'); w, h = wh.split('x'); return [slab(n, int(w), int(h))]
    n = 1
    if '*' in t: t, n = t.split('*'); n = int(n)
    return [part(t)] * n
_F = []
def font():
    if not _F:
        from fontTools.ttLib import TTFont
        t = TTFont(f'{ROOT}/public/assets/fonts/Galmuri9.woff2'); t.flavor = None; buf = io.BytesIO(); t.save(buf); buf.seek(0); _F.append(ImageFont.truetype(buf, 10))
    return _F[0]
def text_mask(s):
    im = Image.new('L', (len(s) * 12 + 8, 16), 0); ImageDraw.Draw(im).text((2, 1), s, font=font(), fill=255)
    a = np.array(im) > 127; ys = np.nonzero(a.any(1))[0]; xs = np.nonzero(a.any(0))[0]
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def recipes():
    out = {}
    for l in open(f'{D}/recipes.txt', encoding='utf-8'):
        l = l.strip()
        if not l or l.startswith('#'): continue
        bid, rest = l.split(':', 1); segs = [s.strip() for s in rest.split(';')]
        r = dict(rows=[row.split() for row in segs[0].split(' / ')], ro=[], ov=[], sg=[])
        for s in segs[1:]:
            if s.startswith('ro='): r['ro'] = [x.split('@') for x in s[3:].split()]
            elif s.startswith('ov='): r['ov'] = [x.split('@') for x in s[3:].split()]
            elif s.startswith('sg='): r['sg'] = [x.split('@') for x in s[3:].split()]
        out[bid.strip()] = r
    return out
def build(r):
    rows = []
    for row in r['rows']:
        ims = [i for t in row for i in token(t)]; h = max(i.height for i in ims); w = sum(i.width for i in ims)
        R = Image.new('RGBA', (w, h)); x = 0
        for i in ims: R.alpha_composite(i, (x, h - i.height)); x += i.width
        rows.append(R)
    W = max(i.width for i in rows); H = sum(i.height for i in rows); im = Image.new('RGBA', (W, H)); y = 0
    done_sh = set()
    for R, row in zip(rows, r['rows']):
        im.alpha_composite(R, (0, y))
        sl = [t for t in row if t.startswith('slab:')]
        if sl: r['roof'] = dict(x=sum(i.width for t in row[:row.index(sl[0])] for i in token(t)), y=y, w=int(sl[0].split(':')[2].split('x')[0]), h=R.height, empty=not r['ro'])   # 지붕 면(화소) — 굽기가 칸으로 옮겨 키트에 적는다
        y += R.height
    for name, xy in [('roof-' + n, p) for n, p in r['ro']] + list(r['ov']):
        x, y = map(int, xy.split(',')); p = part(name); pa = np.array(p); base = im.load()
        for yy, xx in zip(*np.nonzero(pa[:, :, 3] > 0)):      # 그림자: 기물의 반투명(~) 화소와, 불투명 화소의 오른쪽 아래 2px
            for dx, dy in ((0, 0),) if pa[yy, xx, 3] < 255 else ((2, 2), (1, 2), (2, 1)):
                X, Y = x + xx + dx, y + yy + dy
                if 0 <= X < W and 0 <= Y < H and base[X, Y][3] == 255 and not (0 <= xx + dx < p.width and 0 <= yy + dy < p.height and pa[yy + dy, xx + dx, 3] == 255) and (X, Y) not in done_sh:
                    base[X, Y] = darker(base[X, Y], 0.35); done_sh.add((X, Y))
        pa[pa[:, :, 3] < 255] = 0; im.alpha_composite(Image.fromarray(pa, 'RGBA'), (x, y))
    px = im.load()
    for s, spec in r['sg']:
        a = spec.split(','); y = int(a[1]); m = text_mask(s.replace('_', ' '))
        bw0 = int(a[4]) if len(a) > 4 else m.shape[1] + (8 if len(a) > 3 else 0)
        x = (W - bw0) // 2 if a[0] == 'c' else int(a[0])      # c = 건물 폭 가운데
        fg = col(a[2])
        if len(a) > 3:      # 간판 판: 테(윗빛·아랫그늘·옆 모서리) + 판 아래 벽에 드리운 그늘 두 줄
            bw = bw0; bh = int(a[5]) if len(a) > 5 else 12; d = ImageDraw.Draw(im)
            d.rectangle((x, y, x + bw - 1, y + bh - 1), fill=col(a[3]))
            d.line((x, y, x + bw - 1, y), fill=tone(a[3], 1)); d.line((x, y + bh - 1, x + bw - 1, y + bh - 1), fill=tone(a[3], -1))
            d.line((x, y, x, y + bh - 1), fill=tone(a[3], 1)); d.line((x + bw - 1, y, x + bw - 1, y + bh - 1), fill=tone(a[3], -1))
            for xx in range(x, x + bw):
                for k, dy in ((0.4, bh), (0.2, bh + 1)):
                    if y + dy < H and px[xx, y + dy][3] == 255: px[xx, y + dy] = darker(px[xx, y + dy], k)
            tx = x + (bw - m.shape[1]) // 2; ty = y + (bh - m.shape[0]) // 2; sh = tone(a[3], -1)
        else: tx, ty = x, y; sh = None
        for yy in range(m.shape[0]):      # 글자: 1px 획 + 오른쪽 아래 한 칸 그늘(판이 있을 때)
            for xx in range(m.shape[1]):
                if m[yy, xx] and sh and tx + xx + 1 < W and ty + yy + 1 < H and not (yy + 1 < m.shape[0] and xx + 1 < m.shape[1] and m[yy + 1, xx + 1]): px[tx + xx + 1, ty + yy + 1] = sh
        for yy in range(m.shape[0]):
            for xx in range(m.shape[1]):
                if m[yy, xx] and 0 <= tx + xx < W and 0 <= ty + yy < H: px[tx + xx, ty + yy] = fg
    a = np.array(im); a[(a[:, :, 3] > 0) & (a[:, :, 3] < 255)] = 0      # 부품의 바닥 그림자(~)는 건물 조립에서 뺀다
    op = a[:, :, 3] > 0; pad = np.pad(op, 1); edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    for y, x in zip(*np.nonzero(edge)): a[y, x] = darker(a[y, x], 0.6)      # 바깥 윤곽 1px = 그 자리 재질의 어두운 색(굵은 남색 테 아님)
    return Image.fromarray(a, 'RGBA')
def spec():
    return {p[0]: p for p in (l.rstrip('\n').split('|') for l in open(f'{D}/buildings.txt', encoding='utf-8') if l.strip() and not l.startswith('#'))}
def taper(im, rows=24):
    a = np.array(im)[:, :, 3] > 0; ys = np.nonzero(a.any(1))[0]; W = a.sum(1).max(); top = next(y for y in ys if a[y].sum() > W / 4)
    ls = [int(np.nonzero(a[y])[0].min()) for y in range(top, min(top + rows, a.shape[0]))]; rs = [int(np.nonzero(a[y])[0].max()) for y in range(top, min(top + rows, a.shape[0]))]
    return max(max(ls) - min(ls), max(rs) - min(rs))
def main():
    R = recipes(); S = spec(); only = [a for a in sys.argv[1:] if not a.startswith('--')]; done = []; miss = []
    import json; rp = f'{D}/roofs.json'; roofs = json.load(open(rp)) if os.path.exists(rp) else {}
    for bid, r in R.items():
        if only and bid not in only: continue
        try: im = build(r)
        except FileNotFoundError as e: miss.append((bid, os.path.basename(str(e.filename)))); continue
        w, h = int(S[bid][4]) * 16, int(S[bid][5]) * 16
        if im.size != (w, h): print('SIZE', bid, im.size, 'want', (w, h)); continue
        im.save(f'{D}/pieces/mc-bld-kr-{bid}.png'); done.append(bid)
        if r.get('roof'): roofs[bid] = r['roof']
        if '--check' in sys.argv: print(bid, im.size, 'taper', taper(im))
    json.dump(dict(sorted(roofs.items())), open(rp, 'w'), indent=0)
    print('built', len(done), 'missing parts', miss)
if __name__ == '__main__': main()

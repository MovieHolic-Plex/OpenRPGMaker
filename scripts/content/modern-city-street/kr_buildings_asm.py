#!/usr/bin/env python3
"""한국 건물 60종 조립기 — Fable 5.2 가 그린 부품(tiledata/modern-city/kr-buildings/parts/*.png)을 recipes.txt 대로 쌓아 pieces/mc-bld-kr-<type>.png 를 만든다.

  python3 scripts/content/modern-city-street/kr_buildings_asm.py [id …]     # 조립(부품이 다 있는 것만) → pieces/
  python3 scripts/content/modern-city-street/kr_buildings_asm.py --check    # 크기·지붕 좁아짐(≤2px) 표

recipes.txt 한 줄 = 건물 하나:  id: 줄 / 줄 / … ; ro=기물@x,y … ; sg=글@x,y,글자색[,판색,판폭] …
  줄(위→아래) = 부품 토큰을 왼→오로. 토큰: 부품id · 부품id~(좌우 뒤집기) · 부품id[x0:x1](가로 자르기) · 부품id*3(되풀이) · slab:이름:WxH(지붕 면 9조각 늘이기) · gap:W(빈 칸)
  줄 높이 = 가장 큰 부품, 부품은 밑변 맞춤. 줄들은 가운데가 아니라 왼쪽 맞춤(폭이 좁은 줄은 @off 로 민다: 토큰 앞 gap).
  sg 의 x 자리에 c 를 쓰면 건물 폭 가운데. ro = 옥상 기물(parts/roof-<이름>.png)을 전체 그림 좌표에 얹는다. sg = 한글 간판(Galmuri9, 지어낸 이름) — 판색을 주면 판(폭×12)을 먼저 칠한다.
조립 뒤 바깥 윤곽 1px 을 ink 로 두른다. 색은 modern 팔레트 램프만(ramp:tone).
"""
import io, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import palette as PAL                               # noqa: E402
D = os.path.join(ROOT, 'tiledata/modern-city/kr-buildings')
RAMPS = {n: c for n, _ch, c, _d in PAL.build()}
def col(s):
    r, t = s.split(':'); h = RAMPS[r][int(t)]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
INK = col('ink:0')
def part(pid):
    flip = pid.endswith('~'); pid = pid.rstrip('~'); crop = None
    if pid.endswith(']'): pid, c = pid[:-1].split('['); crop = [int(v) for v in c.split(':')]
    im = Image.open(f'{D}/parts/{pid}.png').convert('RGBA')
    if crop: im = im.crop((crop[0], 0, crop[1], im.height))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def slab(name, w, h, b=4):
    s = part('slab-' + name); sw, sh = s.size; out = Image.new('RGBA', (w, h))
    xs = [(0, b, 0, b), (b, sw - b, b, w - b), (sw - b, sw, w - b, w)]; ys = [(0, b, 0, b), (b, sh - b, b, h - b), (sh - b, sh, h - b, h)]
    for sy0, sy1, dy0, dy1 in ys:
        for sx0, sx1, dx0, dx1 in xs:
            t = s.crop((sx0, sy0, sx1, sy1))
            for y in range(dy0, dy1, t.height):
                for x in range(dx0, dx1, t.width): out.paste(t.crop((0, 0, min(t.width, dx1 - x), min(t.height, dy1 - y))), (x, y))
    return out
def token(t):
    if t.startswith('gap:'): return [Image.new('RGBA', (int(t[4:]), 1))]
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
        r = dict(rows=[row.split() for row in segs[0].split(' / ')], ro=[], sg=[])
        for s in segs[1:]:
            if s.startswith('ro='): r['ro'] = [x.split('@') for x in s[3:].split()]
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
    for R in rows: im.alpha_composite(R, (0, y)); y += R.height
    for name, xy in r['ro']:
        x, y = map(int, xy.split(',')); im.alpha_composite(part('roof-' + name), (x, y))
    for s, spec in r['sg']:
        a = spec.split(','); y = int(a[1]); fg = col(a[2]); m = text_mask(s.replace('_', ' '))
        bw0 = int(a[4]) if len(a) > 4 else m.shape[1] + (6 if len(a) > 3 else 0)
        x = (W - bw0) // 2 if a[0] == 'c' else int(a[0])      # c = 건물 폭 가운데
        if len(a) > 3:
            bw = int(a[4]) if len(a) > 4 else m.shape[1] + 6; d = ImageDraw.Draw(im); r_, t_ = a[3].split(':')
            d.rectangle((x, y, x + bw - 1, y + 11), fill=col(a[3])); d.line((x, y + 11, x + bw - 1, y + 11), fill=col(f'{r_}:{max(0, int(t_) - 1)}'))
            tx = x + (bw - m.shape[1]) // 2; ty = y + (11 - m.shape[0]) // 2
        else: tx, ty = x, y
        px = im.load()
        for yy in range(m.shape[0]):
            for xx in range(m.shape[1]):
                if m[yy, xx] and 0 <= tx + xx < W and 0 <= ty + yy < H: px[tx + xx, ty + yy] = fg
    a = np.array(im); op = a[:, :, 3] > 0; pad = np.pad(op, 1); edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[(a[:, :, 3] > 0) & (a[:, :, 3] < 255)] = 0; a[edge] = INK
    return Image.fromarray(a, 'RGBA')
def spec():
    return {p[0]: p for p in (l.rstrip('\n').split('|') for l in open(f'{D}/buildings.txt', encoding='utf-8') if l.strip() and not l.startswith('#'))}
def taper(im, rows=24):
    a = np.array(im)[:, :, 3] > 0; ys = np.nonzero(a.any(1))[0]; W = a.sum(1).max(); top = next(y for y in ys if a[y].sum() > W / 4)
    ls = [int(np.nonzero(a[y])[0].min()) for y in range(top, min(top + rows, a.shape[0]))]; rs = [int(np.nonzero(a[y])[0].max()) for y in range(top, min(top + rows, a.shape[0]))]
    return max(max(ls) - min(ls), max(rs) - min(rs))
def main():
    R = recipes(); S = spec(); only = [a for a in sys.argv[1:] if not a.startswith('--')]; done = []; miss = []
    for bid, r in R.items():
        if only and bid not in only: continue
        try: im = build(r)
        except FileNotFoundError as e: miss.append((bid, os.path.basename(str(e.filename)))); continue
        w, h = int(S[bid][4]) * 16, int(S[bid][5]) * 16
        if im.size != (w, h): print('SIZE', bid, im.size, 'want', (w, h)); continue
        im.save(f'{D}/pieces/mc-bld-kr-{bid}.png'); done.append(bid)
        if '--check' in sys.argv: print(bid, im.size, 'taper', taper(im))
    print('built', len(done), 'missing parts', miss)
if __name__ == '__main__': main()

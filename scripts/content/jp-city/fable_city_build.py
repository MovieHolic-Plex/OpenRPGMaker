#!/usr/bin/env python3
"""jp_city Fable 건물 다시 짓기 (4판, 2026-11-15 일본 도시 다시 만들기 — 탑 3/4 시점) — 부품 그림(tiledata/jp-city/fable-city/parts/*.png, Claude Fable 5.2 medium 한 방 그림)을
레시피(recipes.json)대로 쌓아 건물 그림(pieces/jp-bldg-f-<id>.png)을 만든다. 굽기 블록 blocks/fable_city.py 는 pieces/ 만 읽는다(이 스크립트는 굽기에 끼지 않는다).

  python3 scripts/content/jp-city/fable_city_build.py            # 조립해서 pieces/ 와 화소가 같은지만 본다(다르면 종료 코드 1)
  python3 scripts/content/jp-city/fable_city_build.py --write    # pieces/ 를 다시 쓴다 — 화소가 바뀌면 오너 면제가 풀리니 면제 묶음을 --replace 로 다시 적어야 한다

시점은 그림이 정한다(오너 2026-11-15: 「탑 3/4 뷰가 안지켜진게 좀 보이네. 프롬프트만 다시해서 … 매우 강하게, 단, 검증게이트는 넣지말고」):
건물 한 채 = 맨 위 부품이 지붕 윗면(기와 경사 · 평지붕 바닥과 그 위 옥상 기물 · 박공 ㅅ), 그 아래가 정면 벽. 전부 모델이 그린 부품이고, 코드는 지붕을 그리지 않는다.
이 스크립트에는 시점을 재거나 가리는 검사가 없다(일부러 없다 — 눈으로 본다).
레시피 한 채: {id, w, h(칸), stack:[부품 열쇠 | [옆으로 나란한 열쇠…]] (위→아래), signs:[['board', 글, 색 줄, x, y] | ['side', 글, 색 줄, x, y] | ['text', 글, x, y, 글 색, 그림자 색|null]]}  좌표는 쌓은 그림 기준.
코드가 더하는 것(그 밖의 화소는 부품 그대로):
  - 간판 글자: 문 위 작은 판(12px 높이, 9px 글자 1px 획 — Galmuri9, SIL OFL; 쓰는 글자만 glyphs9.json 에 구워 둔다 — 테·윗변 빛·붓결·못·떨어진 그늘) · 세로 돌출 간판 · 노렌/차양 위 글자.
  - 벽 가장자리: 맨 위 부품(지붕) 아래의 왼쪽 1px 한 단, 오른쪽 1px 두 단, 맨 아랫줄 두 단 어둡게(그 화소의 재료 줄 안에서)."""
import json, os, sys, zlib
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OBJ = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-city')
PARTS = os.path.join(OBJ, 'parts')
RAMPS = None
GLYPHS = None
_IDX = None


def _load():
    global RAMPS, GLYPHS, _IDX
    if RAMPS is None: RAMPS = json.load(open(os.path.join(OBJ, 'palette.json'), encoding='utf-8'))['ramps']
    if GLYPHS is None: GLYPHS = json.load(open(os.path.join(OBJ, 'glyphs9.json'), encoding='utf-8'))['glyphs']
    if _IDX is None:
        _IDX = {}
        for r, t in RAMPS.items():
            for i, c in enumerate(t): _IDX.setdefault(_hx(c)[:3], (r, i))      # 같은 색이 두 줄에 있으면 먼저 나온 줄


def recipes(): return json.load(open(os.path.join(OBJ, 'recipes.json'), encoding='utf-8'))['buildings']


def _hx(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def col(name, t=None):
    _load()
    if t is None: name, t = name.split(':'); t = int(t)
    r = RAMPS[name]; return _hx(r[max(0, min(len(r) - 1, t))])


def shade(px, n=1):
    """그 화소의 재료 줄 안에서 n 단 어둡게(줄에 없는 색·투명은 그대로)."""
    _load(); k = _IDX.get((int(px[0]), int(px[1]), int(px[2])))
    if k is None or px[3] == 0: return px
    return col(k[0], k[1] - n)


def shade_rect(a, x0, y0, x1, y1, n=1):
    for y in range(max(0, y0), min(a.shape[0], y1)):
        for x in range(max(0, x0), min(a.shape[1], x1)): a[y, x] = shade(a[y, x], n)


def load(key): return np.array(Image.open(os.path.join(PARTS, key + '.png')).convert('RGBA'))


def glyph(ch):
    _load(); return np.array([[c == '#' for c in r] for r in GLYPHS[ch]], bool)


def pack(text, gap=1):
    gs = [glyph(c) for c in text]; hh = max(g.shape[0] for g in gs); w = sum(g.shape[1] for g in gs) + gap * (len(gs) - 1)
    out = np.zeros((hh, w), bool); x = 0
    for g in gs: out[hh - g.shape[0]:, x:x + g.shape[1]] = g; x += g.shape[1] + gap
    return out


def _h(a, b, s=0): return ((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) % 1000 / 1000.0


def stamp(a, g, gx, gy, face, shadow=None):
    gh, gw = g.shape
    if shadow is not None:
        for y, x in zip(*np.nonzero(g)):
            if not (y + 1 < gh and x + 1 < gw and g[y + 1, x + 1]) and gy + y + 1 < a.shape[0] and gx + x + 1 < a.shape[1]: a[gy + y + 1, gx + x + 1] = shadow
    for y, x in zip(*np.nonzero(g)): a[gy + y, gx + x] = face


def board(a, text, ramp, x0, y0, seed=0):
    """문 위 작은 판: 12px 높이, 폭 = 글 + 8."""
    T = lambda i: col(ramp, i); g = pack(text, 2); gh, gw = g.shape; w = gw + 8; h = 12
    shade_rect(a, x0 + 1, y0 + h, x0 + w + 1, y0 + h + 2, 1); shade_rect(a, x0 + w, y0 + 2, x0 + w + 1, y0 + h, 1)
    for y in range(h):
        for x in range(w):
            r = _h(x // 3, y, seed + 7)
            if y in (0, h - 1) or x in (0, w - 1): t = 0
            elif y == 1: t = 4 if x not in (1, w - 2) else 3
            elif y == h - 2: t = 1
            elif x == 1: t = 3
            elif x == w - 2: t = 1
            else: t = 2 + (1 if r > 0.8 else 0)
            a[y0 + y, x0 + x] = T(t)
    for nx in (x0 + 2, x0 + w - 3): a[y0 + h // 2, nx] = T(5); a[y0 + h // 2 + 1, nx] = T(0)
    stamp(a, g, x0 + (w - gw) // 2, y0 + 1 + (h - 2 - gh + 1) // 2, col('white', 6), T(1))


def side(a, text, ramp, x0, y0, seed=0):
    """세로 돌출 간판: 13px 폭 판(윗변 2줄은 위에서 본 윗면) + 까치발 둘."""
    gs = [glyph(c) for c in text]; w = 13; h = sum(g.shape[0] for g in gs) + 2 * (len(gs) - 1) + 6; T = lambda i: col(ramp, i)
    shade_rect(a, x0 + w, y0 + 2, x0 + w + 1, y0 + h + 1, 1)
    for y in range(h):
        for x in range(w):
            r = _h(x, y // 3, seed + 3)
            t = 0 if (x in (0, w - 1) or y in (0, h - 1)) else 4 if x == 1 else 1 if x == w - 2 else 3 if y == 1 else 2 + (1 if r > 0.8 else 0)
            a[y0 + y, x0 + x] = T(t)
    for by in (y0 + 1, y0 + h - 3):
        for bx in range(x0 - 3, x0):
            if bx >= 0: a[by, bx] = col('steel', 2); a[by + 1, bx] = col('steel', 0)
    y = y0 + 3
    for g in gs:
        stamp(a, g, x0 + (w - g.shape[1]) // 2, y, col('white', 6), T(0)); y += g.shape[0] + 2


def seed_of(bid): return zlib.crc32(bid.encode()) % 9973


def assemble(b):
    W = b['w'] * 16; Hh = b['h'] * 16; bid = b['id']; sd = seed_of(bid)
    rows = [load(bid + '.' + k) if isinstance(k, str) else np.concatenate([load(bid + '.' + kk) for kk in k], 1) for k in b['stack']]
    top = rows[0].shape[0]                                    # 맨 위 부품 = 지붕 윗면: 가장자리는 그림 그대로 둔다
    f = np.concatenate(rows, 0); assert f.shape == (Hh, W, 4), (bid, f.shape)
    for i, s in enumerate(b.get('signs', [])):
        if s[0] == 'board': board(f, s[1], s[2], s[3], s[4], seed=i + sd)
        elif s[0] == 'side': side(f, s[1], s[2], s[3], s[4], seed=i + sd)
        elif s[0] == 'text': stamp(f, pack(s[1], 2), s[2], s[3], col(s[4]), col(s[5]) if s[5] else None)
    for y in range(top, Hh):
        f[y, 0] = shade(f[y, 0], 1); f[y, W - 1] = shade(f[y, W - 1], 2)
    for x in range(W): f[-1, x] = shade(f[-1, x], 2)
    return Image.fromarray(f, 'RGBA')


def main():
    write = '--write' in sys.argv; bad = 0; n = 0
    for b in recipes():
        im = assemble(b); p = os.path.join(OBJ, 'pieces', 'jp-bldg-f-%s.png' % b['id']); n += 1
        if write: im.save(p); continue
        if not os.path.exists(p) or not np.array_equal(np.array(Image.open(p).convert('RGBA')), np.array(im)): bad += 1; print('pieces 와 다르다', b['id'])
    print('fable_city_build: 건물 %d채 %s, 어긋남 %d' % (n, '다시 씀' if write else '조립 == pieces', bad))
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)

#!/usr/bin/env python3
"""jp_city Fable 건물 다시 짓기 — 부품 그림(tiledata/jp-city/fable-city/parts/*.png, Claude Fable 5.2 medium 한 방 그림)을 레시피(recipes.json)대로 조립해
건물 그림(pieces/jp-bldg-f-<id>.png)을 만든다. 굽기 블록 blocks/fable_city.py 는 pieces/ 만 읽는다(이 스크립트는 굽기에 끼지 않는다).

  python3 scripts/content/jp-city/fable_city_build.py            # 조립해서 pieces/ 와 화소가 같은지만 본다(다르면 종료 코드 1)
  python3 scripts/content/jp-city/fable_city_build.py --write    # pieces/ 를 다시 쓴다 — 화소가 바뀌면 오너 면제가 풀리니 면제 묶음을 --replace 로 다시 적어야 한다

레시피 한 채: {id, w, h(칸), wall(벽 재료 줄:단), roof:[종류, 열쇠, 얹을 것], bands:[위→아래 띠], vsign:[세로 간판], over:[덧붙일 부품]}
  roof  ['flat'|'tile', <공용 지붕 판 이름>, [[부품, x, y]…]]  공용 판 lib.<이름>.png — 64×48: 왼쪽 끝 16열 · 되풀이 가운데 32열 · 오른쪽 끝 16열, 위 16줄 · 되풀이 가운데 16줄 · 아래 16줄.
                                                           가운데를 되풀이해 폭·깊이를 맞추므로 지붕 윤곽은 늘 직사각형이다(직각 지붕).
        ['part', [부품 열쇠…], […]]                          그 건물만의 지붕 조각을 왼쪽부터
  bands ['row', 높이, [부품 열쇠…]]   부품을 왼쪽부터(끝에 ~ 가 붙으면 좌우 뒤집기)  ·  ['sign', 높이, 글자, 색 줄]  코드가 그리는 간판 띠
  얹을 것의 부품이 okujo:<이름> 이면 옥상 기물 그림(okujo.<이름>.png)을 지붕 면에 얹는다.
코드가 더하는 것(그 밖의 화소는 부품 그대로):
  - 간판 띠: 벽 띠(위 2줄 처마 그늘 + 드문 얼룩) 위에 판 하나 — 어두운 테 · 윗변 빛 줄 · 바탕 3단 붓결 · 아랫변 그늘 · 못 둘 · 판 밑에 떨어진 그늘 2줄.
    글자는 9px 높이 1px 획(Galmuri9 — SIL OFL, public/assets/fonts; 쓰는 글자만 glyphs9.json 에 구워 둔다) + 오른쪽 아래 그림자.
  - 세로 간판(vsign): 같은 방식의 15px 폭 판.
  - 건물 가장자리: 벽 좌우 1px 를 벽 재료의 어두운 단으로(먹 테가 아니다), 맨 아랫줄은 가장 어두운 단."""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OBJ = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-city')
PARTS = os.path.join(OBJ, 'parts')          # 다른 폴더의 부품으로 미리 볼 때는 이 셋을 바꿔 끼운다(그리기 작업 폴더의 미리보기가 그렇게 쓴다)
RAMPS = None
GLYPHS = None


def _load():
    global RAMPS, GLYPHS
    if RAMPS is None: RAMPS = json.load(open(os.path.join(OBJ, 'recipes.json'), encoding='utf-8'))['ramps']
    if GLYPHS is None: GLYPHS = json.load(open(os.path.join(OBJ, 'glyphs9.json'), encoding='utf-8'))['glyphs']


def recipes(): return json.load(open(os.path.join(OBJ, 'recipes.json'), encoding='utf-8'))['buildings']


def col(name):
    _load(); r, t = name.split(':'); R = RAMPS[r]; h = R[max(0, min(len(R) - 1, int(t)))]
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def load(key): return np.array(Image.open(os.path.join(PARTS, key + '.png')).convert('RGBA'))


def glyph(ch):
    _load(); return np.array([[c == '#' for c in r] for r in GLYPHS[ch]], bool)


def pack_glyphs(text, gap=1, maxw=None):
    """글자들을 가로로 — (높이 × 폭) bool. 폭이 maxw 를 넘으면 글자 사이를 1px 까지 줄인다."""
    gs = [glyph(ch) for ch in text]; hh = max(g.shape[0] for g in gs)
    w = sum(g.shape[1] for g in gs) + gap * (len(gs) - 1); out = np.zeros((hh, w), bool); x = 0
    for g in gs: out[:g.shape[0], x:x + g.shape[1]] = g; x += g.shape[1] + gap
    if maxw and w > maxw and gap > 1: return pack_glyphs(text, gap - 1, maxw)
    ys = np.nonzero(out.any(1))[0]
    return out[ys.min():ys.max() + 1]


def _h(x, y, s=0): return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) % 1000 / 1000.0


def sign_board(w, h, text, ramp, wall, seed=0):
    _load(); a = np.zeros((h, w, 4), np.uint8); n = len(RAMPS[wall])
    for y in range(h):
        for x in range(w):
            t = n - 3 if y > 1 else n - 5
            r = _h(x // 2, y, seed)                                         # 얼룩은 2px 덩이로, 이웃 단으로만(낱점 아님)
            if r < 0.05: t -= 1
            a[y, x] = col('%s:%d' % (wall, t))
    bh = min(h - 4, 14); y0 = 1; x0 = 3; x1 = w - 3
    T = lambda i: col('%s:%d' % (ramp, i))
    for y in range(y0, y0 + bh):
        for x in range(x0, x1):
            yy = y - y0; r = _h(x // 3, y, seed + 7)
            if yy == 0 or yy == bh - 1 or x == x0 or x == x1 - 1: t = 0
            elif yy == 1: t = 4
            elif yy == bh - 2: t = 1
            elif x == x0 + 1: t = 3
            elif x == x1 - 2: t = 1
            else: t = 2 + (1 if r > 0.72 else 0) - (1 if r < 0.14 else 0)
            a[y, x] = T(t)
    for nx in (x0 + 3, x1 - 4): a[y0 + 3, nx] = T(0); a[y0 + 2, nx] = T(5)
    for y in range(y0 + bh, min(h, y0 + bh + 2)):
        for x in range(x0 + 1, min(w, x1 + 1)): a[y, x] = col('%s:%d' % (wall, 1 if y == y0 + bh else 2))
    if text:
        g = pack_glyphs(text, 2, x1 - x0 - 8); gh, gw = g.shape
        assert gw <= x1 - x0 - 4 and gh <= bh - 3, ('간판 글자가 넘친다', text, gw, x1 - x0, gh, bh)
        gx = x0 + (x1 - x0 - gw) // 2; gy = y0 + (bh - gh) // 2 + (1 if (bh - gh) % 2 else 0)
        for y, x in zip(*np.nonzero(g)):
            if not (y + 1 < gh and x + 1 < gw and g[y + 1, x + 1]): a[gy + y + 1, gx + x + 1] = T(0)
        for y, x in zip(*np.nonzero(g)): a[gy + y, gx + x] = col('white:6') if y < gh // 2 else col('white:5')
    return a


def vsign_board(text, ramp, seed=0):
    gs = [glyph(ch) for ch in text]
    h = sum(g.shape[0] for g in gs) + 2 * (len(gs) - 1) + 8; w = 15
    a = np.zeros((h, w, 4), np.uint8); T = lambda i: col('%s:%d' % (ramp, i))
    for y in range(h):
        for x in range(w):
            r = _h(x, y // 3, seed + 3)
            t = 0 if (x in (0, w - 1) or y in (0, h - 1)) else 4 if x == 1 else 1 if x == w - 2 else 3 if y == 1 else 2 + (1 if r > 0.75 else 0) - (1 if r < 0.12 else 0)
            a[y, x] = T(t)
    y = 4
    for g in gs:
        gx = (w - g.shape[1]) // 2
        for yy, xx in zip(*np.nonzero(g)): a[y + yy + 1, gx + xx + 1] = T(0)
        for yy, xx in zip(*np.nonzero(g)): a[y + yy, gx + xx] = col('white:6')
        y += g.shape[0] + 2
    return a


def over(dst, src, x, y):
    h, w = src.shape[:2]; H_, W_ = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W_, x + w), min(H_, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]; m = s[:, :, 3] > 0
    dst[y0:y1, x0:x1][m] = s[m]


def roof_slab(key, w, h):
    s = load(key); assert s.shape[:2] == (48, 64), (key, s.shape)
    assert w % 16 == 0 and w >= 32 and h % 16 == 0 and h >= 32, (key, w, h)
    mid = np.concatenate([s[:, 16:48]] * (w // 32 + 1), 1)[:, :w - 32]
    a = np.concatenate([s[:, :16], mid, s[:, 48:]], 1)
    return np.concatenate([a[:16]] + [a[16:32]] * (h // 16 - 2) + [a[32:]], 0)


def assemble(b):
    W = b['w'] * 16; Hh = b['h'] * 16; rh = Hh - sum(x[1] for x in b['bands']); bid = b['id']; wr = b['wall'].split(':')[0]
    assert rh >= 16, (bid, '지붕 높이', rh)
    a = np.zeros((Hh, W, 4), np.uint8)
    kind, rkey, deco = b['roof']
    if kind in ('flat', 'tile'): a[:rh] = roof_slab('lib.' + rkey, W, rh)
    else:
        x = 0
        for k in rkey:
            p = load(bid + '.' + k); assert p.shape[0] == rh, (bid, k, p.shape, rh); a[:rh, x:x + p.shape[1]] = p; x += p.shape[1]
        assert x == W, (bid, '지붕 폭', x, W)
    for k, x, y in deco: over(a, load(k.replace('okujo:', 'okujo.')) if k.startswith('okujo:') else load(bid + '.' + k), x, y)
    y = rh
    for bi, band in enumerate(b['bands']):
        if band[0] == 'sign': a[y:y + band[1]] = sign_board(W, band[1], band[2], band[3], wr, seed=bi + len(bid))
        else:
            x = 0
            for k in band[2]:
                flip = k.endswith('~'); k = k.rstrip('~'); p = load(k if k.startswith('lib.') else bid + '.' + k)
                if flip: p = p[:, ::-1]
                assert p.shape[0] == band[1], (bid, k, p.shape, band[1])
                m = p[:, :, 3] > 0; a[y:y + band[1], x:x + p.shape[1]][m] = p[m]; x += p.shape[1]
            assert x == W, (bid, band[2], x, W)
        y += band[1]
    e0, e1 = col(wr + ':0'), col(wr + ':1'); body = a[rh:, :, 3] > 0
    a[rh:, 0][body[:, 0]] = e1; a[rh:, W - 1][body[:, W - 1]] = e0
    a[Hh - 1, :][a[Hh - 1, :, 3] > 0] = e0
    for text, x, yy, ramp in b.get('vsign', []): over(a, vsign_board(text, ramp), x, yy)
    for k, x, yy in b.get('over', []): over(a, load(bid + '.' + k), x, yy)
    return Image.fromarray(a, 'RGBA'), rh


def roof_taper(im, rh):
    """지붕 줄(벽 위)의 왼쪽·오른쪽 끝 x 의 퍼짐 — 직각 지붕이면 0. 건물 폭의 1/4 보다 좁은 줄(지붕 위로 솟은 간판·탑)은 빼고 잰다."""
    a = np.array(im)[:rh, :, 3] > 0; rows = [np.nonzero(r)[0] for r in a if r.sum() > a.shape[1] // 4]
    return 0 if not rows else max(max(r[0] for r in rows) - min(r[0] for r in rows), max(r[-1] for r in rows) - min(r[-1] for r in rows))


def main():
    write = '--write' in sys.argv; bad = 0; n = 0
    for b in recipes():
        im, rh = assemble(b); p = os.path.join(OBJ, 'pieces', 'jp-bldg-f-%s.png' % b['id']); n += 1
        t = roof_taper(im, rh)
        if t > 2: bad += 1; print('지붕 좁아짐 %dpx' % t, b['id'])
        if write: im.save(p); continue
        if not os.path.exists(p) or not np.array_equal(np.array(Image.open(p).convert('RGBA')), np.array(im)): bad += 1; print('pieces 와 다르다', b['id'])
    print('fable_city_build: 건물 %d채 %s, 어긋남 %d' % (n, '다시 씀' if write else '조립 == pieces', bad))
    return bad


if __name__ == '__main__':
    sys.exit(1 if main() else 0)

"""gothic_manor 야외 공용 그리개 — 팔레트(버들항 램프 계열을 채도·명도 한 단 낮춘 고딕 램프)·Cv·입체 도우미·등록부.
jp_city street_hand 의 prop()/K()/OL 규약: 빛 왼쪽 위, 3/4(윗면 + 남쪽 앞면), 반투명·생성 이미지·사람·글자 없음.
산출: tiledata/gothic-manor/<묶음>/_gate/gx-<id>.png + items.jsonl (object-gate 에 낼 정본, 투명 배경)."""
import os, sys, json
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'gothic-manor')

def _h(s): return [int(x, 16) for x in s.split()]
# 7단(-3…+3, 어두움→밝음). 전부 낮은 채도: 청회색 돌·슬레이트, 검붉은 벽돌, 고목 갈색, 이끼, 흙.
RAMPS = {
 'stone':  _h('24232e 33343f 454855 585c6b 6d7282 858b99 9ea3ae'),
 'slate':  _h('15182a 20253b 2c334d 3a4260 4a5374 5c6788 727d9c'),
 'blood':  _h('26121a 391a23 4d242c 612f37 773c44 8d4c53 a45f64'),
 'wood':   _h('1b1511 2a201a 3a2d24 4d3d31 614e3f 77614e 8e7761'),
 'dead':   _h('1e1915 2c251f 3d342b 4f453a 63564a 78695a 8f7f6e'),
 'iron':   _h('121218 1d1d26 2b2b37 3b3b49 4e4e5f 626277 78788d'),
 'moss':   _h('131c18 1c2a22 273a2e 344b3b 445f4a 567459 6b8a6b'),
 'ivy':    _h('0f1a14 172619 223624 2f4730 405a3b 526f49 68865c'),
 'soil':   _h('18120f 261c17 362921 483830 5b4a3e 6f5c4d 857062'),
 'bone':   _h('4a4547 686265 878082 a39b97 bcb4ac d2cac0 e4ded4'),
 'glass':  _h('0f131c 182130 223045 2f4259 405872 56728e 748fab'),
 'water':  _h('0f1822 182737 233a4d 324f64 456a7d 5b8497 7aa0b0'),
 'fog':    _h('596273 6e788a 8793a4 a0acbb 000000 000000 000000'),
 'lamp':   _h('3c2a14 5e4018 8a5e1e b4862c d6a845 efc866 fbe7a0'),
 'ember':  _h('3a1612 5c2018 8a3020 b4452a d6643a 000000 000000'),
 'shadow': _h('0c0b12 14131c 1d1c28'),
}
RAMPS['fog'] = RAMPS['fog'][:4]; RAMPS['ember'] = RAMPS['ember'][:5]

def K(name, t):
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + t))]
OL = RAMPS['shadow'][0]
def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)
def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.a[y, x] = (*rgb(c), 255)
    def R(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.P(x + i, y + j, c)
    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)
    def get(s, x, y): return tuple(s.a[y, x]) if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)
    def has(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 255
    def ell(s, cx, cy, rx, ry, c, fill=True):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2
                if d <= 1: s.P(x, y, c)
    def outline(s, col=None):
        """불투명 덩이 바깥 4방향 이웃 투명 화소에 윤곽(OL)을 둘러 그린다 — 칸 가장자리는 건드리지 않는다."""
        col = OL if col is None else col; m = s.a[..., 3] == 255; out = []
        for y in range(s.h):
            for x in range(s.w):
                if not m[y, x]:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < s.w and 0 <= yy < s.h and m[yy, xx]: out.append((x, y)); break
        for x, y in out: s.P(x, y, col)

def cube(c, x, y, w, top, front, mat, tt=2, ft=0, lip=True, sides=True, ol=True):
    """윗면 top 행 + 앞면 front 행 상자. 위 뒷변 하이라이트, 앞면 왼쪽 빛/오른쪽 그늘/밑 그늘."""
    c.R(x, y, w, top, K(mat, tt)); c.HL(x, y, w, K(mat, tt + 1)); c.HL(x, y + top - 1, w, K(mat, tt - 1))
    c.R(x, y + top, w, front, K(mat, ft)); c.VL(x, y + top, front, K(mat, ft + 1)); c.VL(x + w - 1, y + top, front, K(mat, ft - 1))
    c.HL(x, y + top + front - 1, w, K(mat, ft - 2))
    if lip: c.HL(x, y + top, w, K(mat, ft - 2))
    if not ol: return
    e = 1 if sides else 0
    c.HL(x - e, y - 1, w + 2 * e, OL); c.HL(x - e, y + top + front, w + 2 * e, OL)
    if sides: c.VL(x - 1, y - 1, top + front + 2, OL); c.VL(x + w, y - 1, top + front + 2, OL)

def stones(c, x, y, w, h, mat='stone', s=0, jitter=True):
    """돌 쌓기 앞면: 코스 높이 4, 줄눈 -2, 블록마다 밝기 흔들림, 왼쪽 빛."""
    c.R(x, y, w, h, K(mat, 0))
    for j in range(0, h, 4):
        row = j // 4; off = 5 if row % 2 else 0; bx = x - off
        while bx < x + w:
            bw = 7 + (hsh(bx, row, s) % 4)
            t = (hsh(bx, row, s + 9) % 3) - 1 if jitter else 0
            for i in range(max(bx, x), min(bx + bw - 1, x + w)):
                for k in range(min(3, h - j)):
                    c.P(i, y + j + k, K(mat, t + (1 if k == 0 else 0) + (-1 if k == 2 else 0)))
            if bx >= x: c.VL(bx - 1 if bx > x else bx, y + j, min(4, h - j), K(mat, -2))
            bx += bw
        if j + 3 < h: c.HL(x, y + j + 3, w, K(mat, -2))
    c.VL(x, y, h, K(mat, 2)); c.VL(x + w - 1, y, h, K(mat, -2))

def shingles(c, x0, x1, y0, y1, mat='slate', dark=0):
    """지붕면 너비 [x0,x1) × 행 [y0,y1) 은 호출 쪽에서 모양(마스크)을 정한다. 여기는 한 줄 색만 준다 — row 별 기와 줄."""
    pass

# ---------- 등록부 ----------
class Reg:
    def __init__(s, group): s.group = group; s.items = []
    def add(s, id_, name, w, h, kind, solid=(), tags=(), rules=''):
        def deco(fn):
            s.items.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=list(solid), tags=list(tags), rules=rules)); return fn
        return deco
    def render(s, p):
        c = Cv(p['w'] * 16, p['h'] * 16); p['draw'](c); return c.a
    def export(s, only=None):
        d = os.path.join(OUT, s.group, '_gate'); os.makedirs(d, exist_ok=True)
        metas = []; ims = []
        allowed = {c for r in RAMPS.values() for c in r}
        for p in s.items:
            if only and p['id'] not in only: continue
            a = s.render(p); bad = palette_issues(a, p['id'], allowed)
            if bad: print('  x', bad)
            path = os.path.join(d, 'gx-%s.png' % p['id']); Image.fromarray(a, 'RGBA').save(path)
            metas.append(dict(png=path, kind=p['kind'], name=p['name'], label='gothic-manor/gx-' + p['id'])); ims.append((p, Image.fromarray(a, 'RGBA')))
        with open(os.path.join(d, 'items.jsonl'), 'w') as f:
            for m in metas: f.write(json.dumps(m, ensure_ascii=False) + '\n')
        return metas, ims

def palette_issues(a, tag, allowed):
    al = a[..., 3]; out = []
    if not np.all((al == 0) | (al == 255)): out.append('%s: 반투명 화소' % tag)
    ys, xs = np.nonzero(al == 255)
    for y, x in zip(ys, xs):
        v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
        if v not in allowed: out.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); break
    return out

def sheet(ims, path, W=200, z=4, bg=(104, 103, 122, 255)):
    x = y = rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), bg)
    for im, pp in zip(ims, pos): S.alpha_composite(im, pp)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.resize((S.width * z, S.height * z), Image.NEAREST).save(path)

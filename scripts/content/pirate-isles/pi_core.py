"""pirate_isles 공용 그리개 — 잠긴 팔레트(7단 램프) · 캔버스 Cv · 입체/재질 도우미 · 조각 등록부 · 관문 내보내기/영수증 확인.

열대 군도·해적 항구 16px 3/4 탑뷰 칩셋 pirate_isles 의 모든 조각이 이 모듈로 그린다(코드 손 도트, 생성 이미지·사람·글자·상표 없음).
규약(campus·sf_station·jp_city 와 같다):
  · 빛은 왼쪽 위. 서 있는 조각 = 깊은 윗면(밝은 판, 뒤 모서리 어두운 줄, 앞 모서리 밝은 턱) + 남쪽 앞면(2~3단 어둡게, 밑 AO).
  · 큰 단색 면 금지 — 판자 결·짚 결·돌 쌓기·덩이 명암으로 쪼갠다. 6단 이상 명암.
  · 바깥 윤곽은 OL 한 줄(어두운 갈보라), 안쪽 경계는 재질 어두운 단.
  · 바닥에 그림자를 굽지 않는다(바닥 재질이 칸마다 다르다). 물 위에 뜨는 조각(배·바위·산호)만 물빛 그늘·물거품을 그린다.
  · 지붕·윗면은 사다리꼴(뒤로 갈수록 좁아짐) — 관문이 직사각형 윗면 건물을 «정면 입면도»로 떨어뜨린다(sf_core 실측).
사람 크기: 걷기 칩 16×24. 문은 폭 12~14 · 높이 23~25 화소.

    from pi_core import *
    @piece('palm', 'coconut palm tree', 2, 3, 'organic', group='nature', solid=[(0,2)])
    def _(c): ...
산출: tiledata/pirate-isles/<group>/_gate/pi-<id>.png (투명, 관문 입력).
"""
from __future__ import annotations
import json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
OUT = os.path.join(ROOT, 'tiledata', 'pirate-isles')
T = 16


def _h(s): return [int(x, 16) for x in s.split()]


# ------------------------------------------------------------------ 팔레트 (잠금: 이름·순서는 추가만, 값은 바꾸지 않는다)
# 7단(-3…+3, 어두움→밝음). 3단 램프는 -1…+1.
RAMPS = {
    'sand':    _h('5a4128 7d5c38 a6824e c9a666 e2c584 f1dca2 fbf0c8'),   # 흰·금빛 모래
    'gold':    _h('4a2e06 7a4c0c a87410 d49e1a f0c43a ffe070 fff6b8'),   # 금화·보물
    'shallow': _h('0b3f52 0f5c6e 15807f 1fa596 3cc4a8 6fdcc0 aaf0dc'),   # 얕은 청록 물
    'deep':    _h('071a36 0b2a52 10406e 175a8c 2276a8 3592c0 56b0d4'),   # 깊은 바다
    'foam':    _h('b6e8e2 dcf8f2 ffffff'),                                # 물거품
    'grass':   _h('14321a 1d4a22 2a642a 3a7e30 529a3a 72b448 9ccc62'),   # 밀림 풀
    'leaf':    _h('1a3a12 26541a 347022 468c2a 5ea832 82c240 aedc66'),   # 야자잎(노란 초록)
    'wood':    _h('2e1a0e 4a2c16 6a4220 8c5a2c ae7838 c89650 e0b878'),   # 판자·널
    'dark':    _h('140c0a 22140e 341f14 4a2c1c 603c26 7a5032 966a44'),   # 배 선체·타르 나무
    'thatch':  _h('3e2a10 5e4218 805c20 a47a2c c49a3e dcb85a f0d888'),   # 짚 지붕
    'stone':   _h('2a2622 3e3832 56504a 726a60 908676 aea290 cac0ac'),   # 요새 돌(따뜻한 회색)
    'rock':    _h('1e1a1a 2e2828 423a38 5a504a 746860 908278 aa9e92'),   # 해안 바위
    'red':     _h('3a0c0c 5e1414 861e1a ac2c22 cc4232 e46a4e f49a7a'),   # 깃발·천
    'terra':   _h('3e1a0e 62280f 8a3c18 ae5222 cc6c30 e08c48 f0b070'),   # 기와·토기
    'cloth':   _h('5a5040 7c705a a09478 c2b696 dcd2b4 eee6cc fbf6e6'),   # 돛·범포
    'blue':    _h('0e1a3a 162a5c 1e3e80 2a56a0 3c74bc 5c94d2 8cb8e4'),   # 칠·차양
    'iron':    _h('141820 1e242e 2a323e 3a4452 4e5a6a 66748a 8494a8'),   # 대포·닻·쇠
    'coral':   _h('4a1424 742038 a03050 c84866 e06a7e f094a0 fcc0c4'),   # 산호
    'plaster': _h('6a645a 8a8476 aaa494 c8c2b0 ded8c6 eeead8 fcfaee'),   # 회칠 벽
    'teal':    _h('0c2e30 124446 1a5e5e 247a76 349690 50b0a8 7ccac0'),   # 덧창·칠
    'bone':    _h('4a463c 6c665a 948c7c bab2a0 d8d2c0 eeeadc ffffff'),   # 뼈·해골 무늬
    'fire':    _h('5a1a04 8c2e06 c24a0a e8760e fca424 ffd04a fff2a0'),   # 불·등불
    'moss':    _h('1e2a12 2c3c18 3e5220 52682a 6a8236 869e44 a4b85a'),   # 이끼·덩굴
    'shadow':  _h('0e0a0c 1c1418 2a2026'),                                # 윤곽·구멍
}
OL = RAMPS['shadow'][0]
ALLOWED = {c for r in RAMPS.values() for c in r}

# 화풍 2판(2026-10-14, 버들항 정렬): 바깥 윤곽 = 맞닿은 재질 램프의 어두운 톤. 검정(V<30)은 쓰지 않는다.
# 밝은 램프(모래·회벽·범포·뼈·거품)는 같은 색 기운의 짝 램프 어두운 톤을 빌린다.
OUTLINE_PARTNER = {'sand': 'wood', 'plaster': 'stone', 'cloth': 'wood', 'bone': 'rock', 'foam': 'shallow', 'shadow': 'shadow'}
STYLE = {'outline': 'material'}          # 'black' = 1판(관문에서 떨어진 조각을 1판 그림으로 되돌릴 때)


def _v(h): return max((h >> 16) & 255, (h >> 8) & 255, h & 255)


def _ramp_dark(name):
    r = RAMPS[OUTLINE_PARTNER.get(name, name)]
    for c in r:
        if _v(c) >= 30: return c
    return r[-1]


_RAMP_OF = {}
for _n, _r in RAMPS.items():
    for _c in _r: _RAMP_OF.setdefault(_c, _n)


def outline_for(col):
    n = _RAMP_OF.get(col)
    return _ramp_dark(n) if n else RAMPS['shadow'][2]


def K(name, t=0):
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + int(t)))]


def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 0x9E3779B9) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s=0): return hsh(x, y, s) / 65536.0


class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)

    def P(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.a[y, x] = (*rgb(c), 255)

    def R(s, x, y, w, h, c):
        x, y, w, h = int(x), int(y), int(w), int(h)
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, s.w), min(y + h, s.h)
        if x1 > x0 and y1 > y0 and c is not None: s.a[y0:y1, x0:x1] = (*rgb(c), 255)

    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)

    def has(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 255

    def get(s, x, y):
        if not s.has(x, y): return None
        r, g, b = (int(v) for v in s.a[y, x, :3]); return (r << 16) | (g << 8) | b

    def clear(s, x, y, w=1, h=1):
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, s.w), min(y + h, s.h)
        if x1 > x0 and y1 > y0: s.a[y0:y1, x0:x1] = 0

    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(int(n) + 1): s.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def F(s, x, y, w, h, fn):
        """fn(lx, ly) -> color|None 를 사각 영역에."""
        for j in range(int(h)):
            for i in range(int(w)):
                col = fn(i, j)
                if col is not None: s.P(x + i, y + j, col)

    def ell(s, cx, cy, rx, ry, c):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + .5 - cx) / max(rx, .01)) ** 2 + ((y + .5 - cy) / max(ry, .01)) ** 2 <= 1: s.P(x, y, c)

    def ellf(s, cx, cy, rx, ry, fn):
        """타원 안 화소마다 fn(x, y, nx, ny, d) (nx,ny = -1…1 정규 좌표)."""
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                nx = (x + .5 - cx) / max(rx, .01); ny = (y + .5 - cy) / max(ry, .01); d = nx * nx + ny * ny
                if d <= 1:
                    col = fn(x, y, nx, ny, d)
                    if col is not None: s.P(x, y, col)

    def poly(s, pts, fn):
        ys = [p[1] for p in pts]
        for y in range(max(0, int(min(ys))), min(s.h, int(math.ceil(max(ys))) + 1)):
            xs = []; yc = y + 0.5
            for k in range(len(pts)):
                (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % len(pts)]
                if (y0 <= yc < y1) or (y1 <= yc < y0): xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(int(math.ceil(a - 0.5)), int(math.floor(b - 0.5)) + 1):
                    col = fn(x, y) if callable(fn) else fn
                    if col is not None: s.P(x, y, col)

    def outline(s, col=None, inner=False):
        """불투명 덩이 바깥 4이웃 투명 화소에 윤곽. inner=True 면 덩이 가장자리 화소 자체를 칠한다(크기 유지).
        col 이 없으면 화풍 2판(2026-10-14): 윤곽은 검정이 아니라 맞닿은 재질 램프의 어두운 톤(OUTLINE_OF)."""
        if col is None and STYLE['outline'] == 'material': return s._mat_outline(inner)
        col = OL if col is None else col; m = s.a[..., 3] == 255; out = []
        for y in range(s.h):
            for x in range(s.w):
                if inner:
                    if not m[y, x]: continue
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if not (0 <= xx < s.w and 0 <= yy < s.h) or not m[yy, xx]: out.append((x, y)); break
                elif not m[y, x]:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < s.w and 0 <= yy < s.h and m[yy, xx]: out.append((x, y)); break
        for x, y in out: s.P(x, y, col)

    def _mat_outline(s, inner=False):
        m = s.a[..., 3] == 255; out = []
        for y in range(s.h):
            for x in range(s.w):
                if inner:
                    if not m[y, x]: continue
                    edge = any(not (0 <= x + dx < s.w and 0 <= y + dy < s.h) or not m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if edge: out.append((x, y, outline_for(s.get(x, y))))
                elif not m[y, x]:
                    best = None
                    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < s.w and 0 <= yy < s.h and m[yy, xx]:
                            o = outline_for(s.get(xx, yy))
                            if best is None or _v(o) < _v(best): best = o
                    if best is not None: out.append((x, y, best))
        for x, y, c in out: s.P(x, y, c)

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                if o.a[j, i, 3] == 255: s.P(x + i, y + j, (int(o.a[j, i, 0]) << 16) | (int(o.a[j, i, 1]) << 8) | int(o.a[j, i, 2]))

    def flipx(s):
        o = Cv(s.w, s.h); o.a = s.a[:, ::-1].copy(); return o

    def image(s): return Image.fromarray(s.a, 'RGBA')


# ================================================================== 재질 결(local 좌표, 16 주기로 이어지게 쓰면 바닥에도 쓴다)
def planks(c, x, y, w, h, mat='wood', t=0, bw=4, plen=13, s=0, nails=True, vertical=False, seam=-2, edge_hi=True):
    """판자: 판 폭 bw(이음 1px 포함), 판 길이 plen 마다 엇갈린 끝 이음. 결 점·옹이·못. vertical=True 면 세로 판자."""
    for j in range(h):
        for i in range(w):
            u, v = (j, i) if vertical else (i, j)        # u = 판 길이 방향, v = 판 폭 방향
            row = v // bw; vv = v % bw
            off = (hsh(row, 3, s) % plen)
            uu = (u + off) % plen; col = (u + off) // plen
            tone = t + (hsh(row, col, s + 1) % 3 - 1) * (1 if hsh(row, col, s + 9) % 3 else 0)
            if vv == bw - 1: cc = K(mat, t + seam)
            elif uu == plen - 1: cc = K(mat, t + seam + 1)
            else:
                cc = K(mat, tone)
                if edge_hi and vv == 0: cc = K(mat, tone + 1)
                r = hsh(u, v, s + 5) % 23
                if r == 0: cc = K(mat, tone - 1)
                elif r == 1 and vv not in (0,): cc = K(mat, tone - 1)
                if nails and uu in (1, plen - 3) and vv == bw // 2 - (1 if bw > 3 else 0) and hsh(row, col, s + 4) % 2 == 0: cc = K(mat, t - 3)
            c.P(x + i, y + j, cc)


def stones(c, x, y, w, h, mat='stone', t=0, bh=5, blen=(6, 9), s=0, moss=0.0, mortar=-3):
    """쌓은 돌(앞면): 높이 bh 줄, 길이 blen 범위 블록, 위·왼 밝은 모서리, 아래·오 그늘, 줄눈."""
    for j in range(h):
        row = j // bh; vv = j % bh
        # 이 줄의 블록 경계 만들기
        xx = -(hsh(row, 1, s) % blen[1]); bounds = []
        k = 0
        while xx < w:
            ln = blen[0] + hsh(row, k, s + 2) % (blen[1] - blen[0] + 1); bounds.append((xx, xx + ln, k)); xx += ln; k += 1
        for (a, b, k) in bounds:
            tone = t + (hsh(row, k, s + 3) % 3 - 1)
            for i in range(max(0, a), min(w, b)):
                if vv == bh - 1 or i == b - 1: cc = K(mat, t + mortar)
                elif vv == 0 or i == a: cc = K(mat, tone + 1)
                elif vv == bh - 2 or i == b - 2: cc = K(mat, tone - 1)
                else:
                    cc = K(mat, tone)
                    if hsh(i, j, s + 7) % 17 == 0: cc = K(mat, tone - 1)
                if moss and vv >= bh - 2 and rnd(i, j, s + 11) < moss: cc = K('moss', -1 + hsh(i, j, s) % 2)
                c.P(x + i, y + j, cc)


def straw(c, x, y, w, h, t=0, s=0, tier=5, mat='thatch'):
    """짚 지붕 결: tier 행마다 한 단(위 밝은 끝 → 아래 그늘), 세로 짚 가닥(밝·어두운 짧은 줄)."""
    for j in range(h):
        row = j // tier; vv = j % tier
        for i in range(w):
            base = t + (1 if vv == 0 else 0 if vv < tier - 2 else -1 if vv == tier - 2 else -2)
            r = hsh(i, row, s) % 7
            if r == 0: base += 1
            elif r == 1: base -= 1
            # 아래 끝 들쭉날쭉(짚 다발 끝)
            if vv == tier - 1 and hsh(i, row, s + 3) % 3 == 0: base = t
            c.P(x + i, y + j, K(mat, base))


def leafy(c, cx, cy, rx, ry, mat='grass', t=0, s=0, lumps=4.0, shade=True):
    """둥근 잎 덩이: 법선 조명(왼쪽 위 빛) + 작은 잎 덩이(lumps px) 결 + 가장자리 들쭉날쭉. 윤곽은 부르는 쪽."""
    def f(x, y, nx, ny, d):
        # 가장자리 들쭉날쭉
        edge = 1 - d
        if edge < 0.10 and hsh(x // 2, y // 2, s + 1) % 3 == 0: return None
        nz = math.sqrt(max(0.0, 1 - d))
        li = -0.55 * nx - 0.6 * ny + 0.6 * nz
        # 덩이: lumps 크기 세포 안 작은 구 조명
        gx, gy = x / lumps, y / lumps
        ix, iy = int(math.floor(gx + (int(gy) % 2) * .5)), int(math.floor(gy))
        fx = gx + (int(gy) % 2) * .5 - ix - .5; fy = gy - iy - .5
        li += (-fx - fy) * 0.55 + (hsh(ix, iy, s) % 5 - 2) * 0.05
        tt = 3 if li > 1.0 else 2 if li > .78 else 1 if li > .5 else 0 if li > .25 else -1 if li > 0 else -2 if li > -.3 else -3
        if not shade: tt = max(tt, -1)
        return K(mat, t + tt - 1 if tt > -3 else -3)
    c.ellf(cx, cy, rx, ry, f)


def lit_blob(c, cx, cy, rx, ry, mat, t=0, s=0, rough=0.0, lx=-0.55, ly=-0.6, steps=(1.0, .75, .5, .25, 0, -.3)):
    """매끈한 덩이(바위·통·과일): 법선 조명 7단."""
    def f(x, y, nx, ny, d):
        if rough and 1 - d < rough and hsh(x, y, s) % 3 == 0: return None
        nz = math.sqrt(max(0.0, 1 - d))
        li = lx * nx + ly * ny + 0.6 * nz + (hsh(x // 2, y // 2, s + 3) % 5 - 2) * 0.04
        tt = 3
        for k, th in enumerate(steps):
            if li > th: tt = 3 - k; break
        else: tt = -3
        return K(mat, t + tt)
    c.ellf(cx, cy, rx, ry, f)


# ================================================================== 입체 도우미
def box(c, x, y, w, top, front, mat, tt=2, ft=-1, topmat=None, tex=None, s=0, lip=True, sides=True):
    """3/4 상자: 윗면 top 행(밝음, 뒤 모서리 어둡게, 앞 모서리 밝은 턱) + 앞면 front 행(왼 빛·오 그늘·밑 AO). 윤곽은 부르는 쪽(c.outline())."""
    tm = topmat or mat
    if tex == 'planks': planks(c, x, y, w, top, tm, tt, bw=3, s=s, nails=False)
    elif tex == 'vplanks': planks(c, x, y, w, top, tm, tt, bw=3, s=s, nails=False, vertical=True)
    else: c.R(x, y, w, top, K(tm, tt))
    c.HL(x, y, w, K(tm, tt - 2))
    c.HL(x, y + top - 1, w, K(tm, tt + 1))
    if sides: c.VL(x, y + 1, top - 2, K(tm, tt + 1)); c.VL(x + w - 1, y + 1, top - 2, K(tm, tt - 1))
    fy = y + top
    c.R(x, fy, w, front, K(mat, ft))
    if lip: c.HL(x, fy, w, K(mat, ft - 1))
    if front > 2: c.HL(x, fy + front - 1, w, K(mat, ft - 2))
    if sides and front > 1: c.VL(x, fy, front, K(mat, ft + 1)); c.VL(x + w - 1, fy, front, K(mat, ft - 2))
    return fy


def barrel(c, cx, ytop, rx, ry, bh, mat='wood', hoop='iron', s=0, lid=True):
    """통: 윗면 타원(뚜껑 판 결) + 몸통(가운데 볼록 = 왼쪽 밝게, 세로 널 이음) + 쇠테 2줄. ytop = 윗면 타원 꼭대기."""
    cy = int(round(ytop + ry))
    # 몸통: 위 타원 중심 ~ 아래 타원 중심
    for y in range(cy, cy + bh + 1):
        bulge = math.sin(math.pi * (y - cy) / max(1, bh)) * 1.0
        r = rx + bulge
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            nx = (x + .5 - cx) / r
            if abs(nx) > 1: continue
            tt = 1 if nx < -0.45 else 0 if nx < 0.1 else -1 if nx < 0.6 else -2
            stave = (x - int(cx - r)) % 3 == 0 and abs(nx) < .9
            c.P(x, y, K(mat, tt - (1 if stave else 0)))
    # 아래 둥근 호
    c.ellf(cx, cy + bh, rx + .2, ry, lambda x, y, nx, ny, d: (K(mat, -2 if nx > .3 else -1) if ny > 0 else None))
    # 쇠테
    for hy in (cy + 2, cy + bh - 2):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            nx = (x + .5 - cx) / (rx + 1)
            if abs(nx) > 1: continue
            yy = hy + int(round(ry * 0.55 * math.sqrt(max(0, 1 - nx * nx))))
            c.P(x, yy, K(hoop, 1 if nx < -0.3 else -1 if nx > .4 else 0))
    if lid:
        c.ellf(cx, cy, rx, ry, lambda x, y, nx, ny, d: K(mat, 2 if d > .62 and ny < 0 else 1 if d > .62 else 2 - (1 if (x - int(cx)) % 3 == 0 else 0)))
        c.ellf(cx, cy, rx, ry, lambda x, y, nx, ny, d: (K(mat, -1) if d > .78 and ny > 0 else K(mat, 3) if d > .78 and ny < -.2 and nx < 0 else None))


def door(c, x, y, w=12, h=24, mat='wood', frame='dark', arch=False, s=0, open_=False):
    """나무 문: 틀(위·왼 밝게) + 세로 판자 + 쇠 경첩 + 손잡이, 상인방 밑 그늘. arch=True 면 위가 둥글다."""
    c.R(x - 1, y - 1, w + 2, h + 1, K(frame, -1))
    c.HL(x - 1, y - 1, w + 2, K(frame, 1)); c.VL(x - 1, y - 1, h + 1, K(frame, 0)); c.VL(x + w, y - 1, h + 1, K(frame, -2))
    if open_:
        c.R(x, y, w, h, K('shadow', 0)); c.R(x, y, w, 2, K('shadow', -1)); return
    planks(c, x, y, w, h, mat, 0, bw=3, plen=h + 5, s=s, vertical=True, nails=False)
    c.HL(x, y, w, K(mat, -3)); c.HL(x, y + 1, w, K(mat, -2))
    for hy in (y + 4, y + h - 6):
        c.HL(x, hy, w - 2, K('iron', -1)); c.HL(x, hy + 1, w - 3, K('iron', -3))
        c.P(x + 1, hy, K('iron', 1))
    c.P(x + w - 3, y + h // 2, K('gold', 1)); c.P(x + w - 3, y + h // 2 + 1, K('gold', -1))
    if arch:
        for i in range(w + 2):
            dx = abs(i - (w + 1) / 2) / ((w + 2) / 2)
            cut = int(round(3 * (dx ** 2)))
            for k in range(cut): c.clear(x - 1 + i, y - 1 + k)
            c.P(x - 1 + i, y - 1 + cut, K(frame, 1 if i < w / 2 else -1))


def shutter_window(c, x, y, w=8, h=8, shut='teal', frame='wood', s=0, sill=True, lit=False):
    """덧창 창문: 어두운 안(위 그늘·아래 조금 밝게) + 열린 덧창 두 짝(양옆, 세로 판자) + 틀 + 창턱."""
    c.R(x, y, w, h, K(frame, -1)); c.HL(x, y, w, K(frame, 1))
    inner = 'fire' if lit else 'shadow'
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if lit: c.P(x + i, y + j, K('fire', 1 if j > 2 else 0))
            else: c.P(x + i, y + j, K('shadow', -1 if j < 3 else 0 if j < h - 3 else 1))
    c.VL(x + w // 2, y + 1, h - 2, K(frame, -2)); c.HL(x + 1, y + h // 2, w - 2, K(frame, -2))
    for sx in (x - 3, x + w):
        for j in range(h):
            for i in range(3):
                c.P(sx + i, y + j, K(shut, (1 if i == 0 else 0 if i == 1 else -1) - (1 if j % 3 == 2 else 0)))
        c.HL(sx, y, 3, K(shut, 2)); c.HL(sx, y + h - 1, 3, K(shut, -2))
    if sill:
        c.HL(x - 1, y + h, w + 2, K(frame, 2)); c.HL(x - 1, y + h + 1, w + 2, K(frame, -2))


def hip_roof(c, x, y, w, h, mat='thatch', inset=None, s=0, ridge=True, eave=3, tier=5):
    """모임지붕(사다리꼴 남쪽 경사면 + 양 옆 모서리 띠 + 용마루 + 처마 끝 다발). x,y = 처마 왼쪽 위가 아니라 지붕 덩이 경계 상자.
    위 가장자리(용마루)는 양쪽으로 inset 화소 좁다. 짚(thatch)·기와(terra) 모두."""
    inset = max(3, h // 2) if inset is None else inset
    def lx(j): return x + inset * (1 - j / max(1, h - 1))
    def rx(j): return x + w - 1 - inset * (1 - j / max(1, h - 1))
    # 결
    if mat == 'thatch':
        tmp = Cv(w, h); straw(tmp, 0, 0, w, h, t=1, s=s, tier=tier)
    else:
        tmp = Cv(w, h); roof_tiles(tmp, 0, 0, w, h, mat, t=1, s=s)
    for j in range(h):
        a, b = int(round(lx(j))), int(round(rx(j)))
        for i in range(a, b + 1):
            col = tmp.get(i - x, j)
            # 원근: 위(용마루 쪽)는 조금 어둡게 → 아래 밝게? 빛은 왼쪽 위 — 남쪽 경사면 전체는 밝은 편, 뒤로 갈수록 한 단 어둡게
            if j < h * 0.25: col = shift_col(col, mat, -1)
            c.P(i, y + j, col)
        # 옆 모서리 띠(hip): 왼쪽 2px 밝게, 오른쪽 2px 어둡게
        for k in range(2):
            ca = c.get(a + k, y + j); cb = c.get(b - k, y + j)
            if ca is not None: c.P(a + k, y + j, shift_col(ca, mat, 1 + (1 - k)))
            if cb is not None: c.P(b - k, y + j, shift_col(cb, mat, -2 + k))
    if ridge:
        a, b = int(round(lx(0))), int(round(rx(0)))
        c.HL(a, y, b - a + 1, K(mat, -2)); c.HL(a + 1, y + 1, b - a - 1, K(mat, 2)); c.HL(a + 1, y + 2, b - a - 1, K(mat, 0))
    # 처마: 맨 아래 eave 행 — 다발 끝(들쭉날쭉) + 처마 밑 그늘
    for i in range(x, x + w):
        jag = hsh(i, 0, s + 7) % 2
        c.P(i, y + h - 1, K(mat, -2 if jag else -1))
        if mat == 'thatch' and jag and hsh(i, 1, s) % 2: c.P(i, y + h, K(mat, -2))
    return lx, rx


def roof_tiles(c, x, y, w, h, mat='terra', t=0, s=0, course=4, tw=4):
    """기와(둥근 기와 줄, 화풍 2판 — 버들항 기와 문법): course 행마다 한 줄, 한 줄 안에서 위→아래로 한 단씩 내려가는 램프
    (윗 끝 빛 +1/+2 → 몸 0 → 아랫 턱 -1 → 다음 줄 밑 그늘 -2), 기와 볼록면 왼쪽 밝고 이음 오른쪽 -2, 드문 바랜·짙은 기와."""
    for j in range(h):
        row = j // course; vv = j % course
        for i in range(w):
            u = (i + (tw // 2 if row % 2 else 0)) % tw
            k = (i + (tw // 2 if row % 2 else 0)) // tw
            var = 0
            q = hsh(k, row, s + 1) % 13
            if q == 0: var = -1
            elif q == 1: var = 1
            if vv == 0: tt = t - 2                                       # 위 줄 기와 턱이 드리운 그늘
            elif vv == 1: tt = t + (2 if u == 0 else 1 if u < tw - 1 else -1) + var
            elif vv == 2: tt = t + (1 if u == 0 else 0 if u < tw - 1 else -2) + var
            else: tt = t + (0 if u == 0 else -1 if u < tw - 1 else -2) + var
            if vv == 0 and u == tw - 1: tt = t - 3
            c.P(x + i, y + j, K(mat, tt))


def shift_col(col, mat, dt):
    """색 col 이 램프 mat 의 몇 단이면 dt 만큼 옮긴다. 다른 램프 색이면 그 램프를 찾아 옮긴다."""
    if col is None: return None
    for name, r in RAMPS.items():
        if col in r:
            i = r.index(col); return r[max(0, min(len(r) - 1, i + dt))]
    return col


def shade_rect(c, x, y, w, h, dt):
    for j in range(h):
        for i in range(w):
            col = c.get(x + i, y + j)
            if col is not None: c.P(x + i, y + j, shift_col(col, None, dt))


def _p16(v, ph, a, b):
    return a * math.sin(2 * math.pi * v / 16 + ph) + b * math.sin(2 * math.pi * v / 8 + ph * 1.7)


def water_px(x, y, mat='shallow', t=0, s=0):
    """물 무늬(16 주기, 이음 없음, 화풍 2판): 바탕 + 짧은 짙은 골 띠(-1) + 길이가 제각각인 잔물결
    (밝은 줄 +1, 가운데 반짝 +2, 밑 -1 그늘) + 드문 반짝 점."""
    xx, yy = x % 16, y % 16
    base = t
    if (yy in (6, 7) and 3 <= (xx + 4) % 16 < 9) or (yy == 15 and 9 <= xx < 14): base = t - 1        # 잔물결 골(짧은 짙은 띠)
    for (rx0, ry0, ln) in ((2, 2, 5), (10, 5, 3), (5, 9, 4), (12, 12, 6), (0, 14, 2), (8, 1, 2)):
        d = (xx - rx0) % 16
        if yy == ry0 and d < ln: return K(mat, base + (2 if d == ln // 2 and ln > 3 else 1))
        if yy == ry0 + 1 and 0 < d <= ln - 1: return K(mat, base - 1)
    if hsh(xx, yy, s + 3) % 37 == 0: return K(mat, base + 1)
    return K(mat, base)


def water_fill(c, x, y, w, h, mat='shallow', t=0, ox=0, oy=0):
    for j in range(h):
        for i in range(w): c.P(x + i, y + j, water_px(i + ox, j + oy, mat, t))


def ripple_ring(c, cx, cy, rx, ry, mat='shallow', foam=True, s=0):
    """물에 잠긴 밑동 둘레 거품 고리(물 위 조각용): 타원 둘레 1px 거품 + 바깥 물빛 그늘."""
    for k in range(int(4 * (rx + ry))):
        a = 2 * math.pi * k / (4 * (rx + ry))
        x = cx + rx * math.cos(a); y = cy + ry * math.sin(a)
        if foam and hsh(k, 0, s) % 4: c.P(round(x), round(y), K('foam', 1 if math.sin(a) < 0 else 0))
        elif not foam: c.P(round(x), round(y), K(mat, 2))


def rope_line(c, x0, y0, x1, y1, sag=2, mat='thatch'):
    n = max(abs(x1 - x0), 1)
    for i in range(n + 1):
        f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f + sag * 4 * f * (1 - f)
        c.P(round(x), round(y), K(mat, -1 if i % 2 else 0))


# ================================================================== 조각 등록부
PIECES = {}


def piece(id_, name, w, h, kind, group='props', solid=(), tags=(), desc='', entrance=None, frames=1, walk=None, approach=None):
    """조각 등록. name = 관문 판정자에게 가는 영어 이름, desc = 한국어 설명(조수가 본다).
    solid = 막힌 칸 [(x,y)…] (그 밖 그림 칸은 위층 통행 ★), entrance = 건물 문 칸 (dx,dy) — 문 칸은 막히고 그 아래 칸이 접근칸."""
    def deco(fn):
        PIECES[id_] = dict(id=id_, name=name, w=w, h=h, kind=kind, group=group, solid=[tuple(s) for s in solid], tags=list(tags), desc=desc,
                           entrance=entrance, approach=approach, frames=frames, draw=fn)
        return fn
    return deco


# 화풍 2판 윤곽을 받지 못한(관문 FAIL) 조각 — 1판 검정 윤곽 그림으로 둔다(1판 영수증이 그대로 유효).
OLD_OUTLINE = {'crab', 'hammock', 'chest-big', 'hut-round'}


def render(p, f=0):
    STYLE['outline'] = 'black' if p['id'] in OLD_OUTLINE else 'material'
    c = Cv(p['w'] * T, p['h'] * T)
    if p['frames'] > 1: p['draw'](c, f)
    else: p['draw'](c)
    return c.a


def palette_issues(a, tag):
    bad = set()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] == 0: continue
            if a[y, x, 3] != 255: bad.add('alpha'); continue
            h = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
            if h not in ALLOWED: bad.add('#%06x' % h)
    return ['%s: %s' % (tag, b) for b in sorted(bad)]


def pieces_of(group=None, only=None):
    return [p for p in PIECES.values() if (group is None or p['group'] == group) and (only is None or p['id'] in only)]


def png_path(p, f=0):
    n = 'pi-' + p['id'] + ('.f%d' % f if p['frames'] > 1 else '')
    return os.path.join(OUT, p['group'], '_gate', n + '.png')


def export(group=None, only=None):
    rows, bad = [], []
    for p in pieces_of(group, only):
        os.makedirs(os.path.dirname(png_path(p)), exist_ok=True)
        for f in range(p['frames']):
            a = render(p, f); bad += palette_issues(a, p['id'])
            Image.fromarray(a, 'RGBA').save(png_path(p, f))
            rows.append(dict(png=png_path(p, f), kind=p['kind'], name=p['name'], label='pirate-isles/pi-%s%s' % (p['id'], '.f%d' % f if p['frames'] > 1 else '')))
    for b in bad: print('  x', b)
    return rows, bad


def status_of(p):
    from object_gate import pixel_sha256, read_receipt
    res = []
    for f in range(p['frames']):
        r = read_receipt(pixel_sha256(Image.fromarray(render(p, f), 'RGBA')))
        res.append('none' if not r else (r['verdict'] if r.get('kind') == p['kind'] else 'kind'))
    return 'pass' if all(x == 'pass' for x in res) else ('none' if 'none' in res else 'fail')


def receipt_of(p, f=0):
    from object_gate import pixel_sha256, read_receipt
    return read_receipt(pixel_sha256(Image.fromarray(render(p, f), 'RGBA')))

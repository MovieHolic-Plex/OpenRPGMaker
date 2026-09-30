# 버들항 변형 3 — 던전 공용 라이브러리.
# 버들항 파이프라인(city_v6)의 팔레트·명암 단계·윤곽 결(pz.fin)을 그대로 쓰고, 던전에만 필요한 재료
# (돌벽 앞면, 어두운 천장, 동굴 바위, 하수 수로, 모자이크 …)를 같은 결로 손 도트한다.
# 3/4 시점: 물체 = 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위. 1칸 = 16px.
import os, sys, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
CITY = os.path.abspath(os.path.join(HERE, '../../../scripts/content/lib/city_v6'))
sys.path.insert(0, CITY)
import palette; palette.apply()
import terrain, pz                       # noqa: E402
from px2 import _hash, vnoise            # noqa: E402
from PIL import Image                    # noqa: E402

T = 16
ST = terrain.ST                          # 0 윤곽 .. 6 밝음 (버들항 돌 램프)
WA = terrain.WA                          # 물 램프 0..5
LF = terrain.LF                          # 잎 램프 (윤곽 포함 7단)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
DK = hx(palette.OUT_CHIP['roofc'])       # 버들항이 윤곽에 쓰는 가장 어두운 보라
WARM = (158, 141, 131)                   # 버들항 회벽 그림자색
PL = [hx(c) for c in [palette.OUT_CHIP['plaster']] + palette.RAMPS_CHIP['plaster']]
RD = [hx(c) for c in [palette.OUT_CHIP['red']] + palette.RAMPS_CHIP['red']]
WD = terrain.WD
GD = [hx(c) for c in [palette.OUT_CHIP['straw']] + palette.RAMPS_CHIP['straw']]
IR = ST
# 천장: 버들항 돌 램프의 가장 어두운 세 단 (보라 윤곽 → 돌 0 → 돌 1)
CE = [DK, ST[0], mix(ST[0], ST[1], .5), ST[1], ST[2]]
TRV = [hx(c) for c in ['#3a2c20', '#6c5c4c', '#9e8d83', '#bcaaa0', '#d2c6b0', '#e2d6c0', '#f2ead8']]

PARTS = {}            # 이름 -> dict(img, note, cells)

# ---- 조각 선택표 (사용자가 http://mdc-server:18304/ 에서 BEFORE/AFTER 를 고른다) --------------------
# BEFORE 로 고른 조각은 맵 렌더에서 원래 판(before/var3/<장소>/parts/<조각>.png)을 쓴다. parts/ 폴더의 같은 이름 파일은
# 언제나 AFTER(재작업본)이고, 선택표는 렌더에서만 갈아 끼운다. 조각은 지우지 않는다.
# 정적 표(BEFORE_PICKS)에 적거나, 선택 저장소 picks.sqlite 의 current 표(item_id 에 장소 슬러그와 조각 이름이 들어 있고
# choice 가 'before')를 읽는다. item_id 는 'var3/<장소>/parts/<조각>' 꼴이라 끝에서 둘째가 'parts' 이면 그 앞이 장소다.
# 2026-10-01 사용자 선택: var3/aqueduct-sewer/parts/rubble 만 BEFORE(나머지 31개는 AFTER).
BEFORE_PICKS = {             # 장소 슬러그 -> {조각 이름}
    'aqueduct-sewer': {'rubble'}, 'temple-ruins': set(), 'sea-cave': set(), 'castle-catacombs': set(),
}
PICK_ROOT = os.path.expanduser('~/.local/share/oprn/beodeul-pick')
def _db_before_picks():
    out = {}
    db = os.path.join(PICK_ROOT, 'picks.sqlite')
    if not os.path.exists(db): return out
    try:
        import sqlite3
        con = sqlite3.connect('file:%s?mode=ro' % db, uri=True)
        for item_id, choice in con.execute('select item_id, choice from current'):
            if (choice or '').lower() != 'before': continue
            parts = [q for q in str(item_id).replace('\\', '/').split('/') if q]
            if len(parts) >= 3 and parts[-2] == 'parts': out.setdefault(parts[-3], set()).add(parts[-1].replace('.png', ''))
            elif len(parts) >= 2: out.setdefault(parts[-2], set()).add(parts[-1].replace('.png', ''))
        con.close()
    except Exception:
        pass
    return out
def pick_before(place, img):
    """img 가 PARTS 의 어떤 조각이고 그 조각이 BEFORE 로 골라졌다면 원래 판 이미지를 돌려준다."""
    names = set(BEFORE_PICKS.get(place, ())) | _db_before_picks().get(place, set())
    if not names: return img
    for n, p in PARTS.items():
        if p['img'] is img and n in names:
            f = os.path.join(PICK_ROOT, 'before', 'var3', place, 'parts', n + '.png')
            if os.path.exists(f): return Image.open(f).convert('RGBA')
    return img
def reg(name, img, note, cells=None):
    if name not in PARTS:
        PARTS[name] = dict(img=img, note=note, cells=cells or (img.width // T, img.height // T))
    return img

def new(w=T, h=T): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def mk(fn, w=T, h=T):
    im = new(w, h); p = im.load()
    for y in range(h):
        for x in range(w):
            c = fn(x, y)
            if c is not None: p[x, y] = tuple(c[:3]) + (255,)
    return im

class Cv:
    """작은 손 도트 캔버스."""
    def __init__(s, w, h): s.im = new(w, h); s.p = s.im.load(); s.w = w; s.h = h
    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.p[x, y] = tuple(c[:3]) + (255,)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1): s.px(x, y, c)
    def hline(s, x0, x1, y, c):
        for x in range(x0, x1): s.px(x, y, c)
    def vline(s, x, y0, y1, c):
        for y in range(y0, y1): s.px(x, y, c)
    def ell(s, cx, cy, rx, ry, fn):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.px(x, y, fn(x, y))
    def box(s, x0, y0, x1, y1, ramp, top=None, seed=0, grain=.1):
        """3/4 상자: 윗면 top 행수 + 앞면. 빛 왼쪽 위."""
        top = top if top is not None else 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y < y0 + top: k = 5 if (x < x0 + 1 or y == y0) else 4
                else:
                    k = 4 - (1 if x >= x1 - 2 else 0) - (1 if y >= y1 - 2 else 0)
                    if x == x0: k += 1
                if _hash(x, y, seed) < grain: k += 1 if _hash(y, x, seed + 1) < .5 else -1
                s.px(x, y, ramp[max(1, min(len(ramp) - 1, k))])
    def fin(s, k=.62): return pz.fin(s.im, k)

def alpha_over(base, over, x, y):
    base.alpha_composite(over, (x, y))

# ------------------------------------------------------------------ 돌 결
def ash(X, Y, seed, base, dark=None, bw=16, bh=8, k=1.0):
    """버들항 castle6.ash 와 같은 어슷 쌓기 마름돌. base 는 RGB, 밝기 k."""
    dark = dark or mul(base, .72)
    row = Y // bh; ly = Y % bh; off = (row % 2) * (bw // 2)
    col = (X + off) // bw; lx = (X + off) % bw
    if ly == bh - 1 or lx == bw - 1: return mul(dark, .82)
    h = _hash(col, row, seed + 41)
    c = base if h < .5 else (mix(base, ST[4], .35) if h < .78 else mix(base, dark, .55))
    if ly == 0 or lx == 0: c = mix(c, ST[5], .28)
    r = _hash(X, Y, seed + 43)
    if r < .045: c = mix(c, ST[5], .35)
    elif r > .965: c = mix(c, dark, .6)
    return mul(c, k)

def flag(X, Y, seed, base, dark):
    """바닥 판석: 세로 16, 가로 마디는 줄마다 어긋난다."""
    row = Y // 8; ly = Y % 8
    jx = int(_hash(X // 16, row, seed + 5) * 10) + 3 + (row % 2) * 2
    lx = X % 16
    if ly == 7: return dark
    if lx == jx % 16: return dark
    h = _hash(X // 16 + (1 if lx > jx % 16 else 0), row, seed + 9)
    c = base if h < .55 else (mix(base, ST[5], .16) if h < .8 else mix(base, dark, .25))
    if ly == 0 or lx == (jx + 1) % 16: c = mix(c, ST[5], .22)
    r = _hash(X, Y, seed + 12)
    if r < .05: c = mix(c, ST[5], .3)
    elif r > .97: c = mix(c, dark, .5)
    return c

# ------------------------------------------------------------------ 천장 (어둡다: 보라 → 돌0 → 돌1 세 단)
def ceil_px(X, Y, seed, warm=0.0):
    row = Y // 8; off = (row % 2) * 8; col = (X + off) // 16
    ly = Y % 8; lx = (X + off) % 16
    base = CE[2] if _hash(col, row, seed + 3) < .6 else CE[3]
    if ly == 7 or lx == 15: base = CE[1]
    elif ly == 0 or lx == 0: base = mix(base, CE[4], .35)
    r = _hash(X, Y, seed + 7)
    if r < .03: base = CE[3]
    elif r > .985: base = CE[1]
    if warm: base = mix(base, (60, 44, 40), warm)
    return base

def ceil_cave_px(X, Y, seed):
    n = vnoise(X, Y, 5, seed + 1); m = vnoise(X, Y, 2.2, seed + 2)
    v = n * .7 + m * .3
    c = CE[1] if v < .34 else (CE[2] if v < .58 else (CE[3] if v < .8 else CE[4]))
    r = _hash(X, Y, seed + 9)
    if r > .965: c = CE[0]
    elif r < .035: c = CE[4]
    return mix(c, (58, 42, 44), .18)

_ce_cache = {}
BAND = 8          # 벽 윗면(두께 띠) 폭 px — 3/4 에서 벽은 앞면 위에 윗면이 보인다
VOID = [(14, 10, 20), (20, 16, 28), (26, 22, 36)]       # 띠 바깥 속: 솟은 벽 덩어리 안쪽 (어두운 보라)
def _band_px(x, y, seed, cave, d, pal=None):
    P = ([TRV[0], TRV[1], TRV[1], TRV[2], TRV[3], TRV[4], TRV[5]] if pal == 'temple' else ST)
    """벽 윗면 띠의 한 픽셀. d = 열린 쪽 가장자리에서 잰 깊이(0..BAND-1)."""
    X = x + seed * 16; Y = y + seed * 8
    if cave:
        n = vnoise(X, Y, 3.0, 131)
        c = mix((120, 98, 88), (150, 128, 108), n)
        if _hash(X, Y, 132) > .93: c = (170, 148, 122)
        elif _hash(X, Y, 133) < .07: c = (96, 78, 72)
        return c
    row = Y // 8; off = (row % 2) * 8; col = (X + off) // 16
    lx = (X + off) % 16; ly = Y % 8
    c = P[4] if _hash(col, row, 135) < .6 else mix(P[4], P[3], .35)
    if lx == 0 or ly == 7: c = mix(c, P[3], .4)       # 윗면 판석 이음
    r = _hash(X, Y, 136)
    if r < .05: c = P[5]
    elif r > .96: c = P[3]
    return c

def ceiling(open8, seed=0, cave=False, pal=None):
    """open8 = (N,E,S,W,NE,SE,SW,NW) — 그 방향이 열린 칸(바닥·물·벽면)인가.
    3/4: 열린 곳에 닿은 벽 덩어리는 가장자리 BAND px 가 밝은 윗면(두께 띠), 그 안쪽은 어두운 속."""
    key = (open8, seed % 4, cave, pal)
    if key in _ce_cache: return _ce_cache[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = BAND
    def depth(x, y):
        """띠 안이면 (열린 쪽 가장자리로부터의 거리, 그 쪽이 S/E 인가) 중 가장 얕은 것, 아니면 None."""
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    def f(x, y):
        X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
        b = depth(x, y)
        if b is None:
            r = _hash(X, Y, 141)
            v = VOID[0] if r < .55 else (VOID[1] if r < .93 else VOID[2])
            if cave:
                n = vnoise(X, Y, 5, 142); v = VOID[0] if n < .5 else VOID[1]
            return v
        d, side = b
        c = _band_px(x, y, seed % 4, cave, d, pal)
        P = ([TRV[0], TRV[1], TRV[1], TRV[2], TRV[3], TRV[4], TRV[5]] if pal == 'temple' else ST)
        # 윗면 모서리: 열린 쪽 첫 줄은 밝은 턱, 속 쪽 끝줄은 윤곽
        if d == 0: c = P[6] if side in ('N', 'W') else mix(c, P[5], .45)
        elif d == 1: c = mix(c, P[5], .18)
        inner = t - 1
        if d == inner: c = DK if not cave else (48, 36, 42)
        elif d == inner - 1: c = mix(c, DK, .3)
        return c
    im = mk(f); _ce_cache[key] = im; return im

# ------------------------------------------------------------------ 벽 앞면
# 벽 앞면은 바닥보다 2단 이상 어둡다 (명도 ≈ 45~60 대 바닥 ≥ 95). 결도 다르다: 벽=쌓은 돌 줄눈, 바닥=큰 판석.
FACE_BASE = {'sewer': mix(ST[1], ST[2], .35), 'cata': mix(ST[1], ST[2], .3), 'castle': mix(ST[1], ST[2], .7),
             'temple': mul(TRV[2], .82), 'cave': mix(ST[1], (80, 62, 58), .4)}

def face_px(style, X, Y, H, seed, capL, capR):
    """앞면 한 줄기: Y 는 앞면 맨 위에서 잰 픽셀, H 는 앞면 전체 높이."""
    base = FACE_BASE[style]
    if style == 'cave':
        return cave_face_px(X, Y, H, seed, capL, capR)
    if style == 'temple':
        c = ash(X, Y, seed, base, mul(base, .6), bw=16, bh=8, k=1.0)
    else:
        c = ash(X, Y, seed, base, mul(base, .55), bw=16, bh=8, k=1.0)
    if style == 'sewer':
        # 젖음: 아래로 갈수록 어둡고, 초록 이끼가 고인다
        wet = max(0.0, (Y - (H - 22)) / 22.0)
        c = mix(c, ST[1], .26 * wet)
        m = vnoise(X * 1.3, Y * 2.2, 3, seed + 20)
        if wet > .25 and m > .80 - .10 * wet and _hash(X, Y, seed + 5) < .8: c = mix(c, LF[2], .55)
        if _hash(X // 2, 0, seed + 22) < .12 and Y > 8 and _hash(X // 2, Y, seed + 23) < .55 * (1.0 - Y / H):
            c = mix(c, ST[1], .5)      # 누수 줄무늬
    elif style == 'cata':
        c = mul(c, .93)
        m = vnoise(X, Y, 4, seed + 30)
        if m > .78: c = mix(c, (110, 92, 96), .3)       # 석회 얼룩
    elif style == 'castle':
        pass
    elif style == 'temple':
        m = vnoise(X, Y, 4, seed + 31)
        if m > .8: c = mix(c, LF[4], .3)
    # 천장 밑 그림자 / 꼭대기 처마 / 바닥 접지
    if Y == 0: c = ST[5] if style != 'cata' else ST[4]
    elif Y == 1: c = mix(c, ST[5], .35)
    elif Y == 2: c = mul(c, .72)
    elif Y == 3: c = mul(c, .84)
    elif Y == 4: c = mul(c, .92)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .8)
    # 좌우 끝마개: 이웃 앞면이 없으면 옆이 깎여 보인다
    if capL and X % 16 == 0: c = mix(c, ST[5], .35)
    if capL and X % 16 == 1: c = mix(c, ST[5], .12)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c

def cave_face_px(X, Y, H, seed, capL, capR):
    base = FACE_BASE['cave']
    # 세로로 흐르는 지층 + 끊긴 덩어리
    n = vnoise(X * 1.0, Y * .45, 4.5, seed + 50)
    m = vnoise(X * .5, Y * 1.4, 3.2, seed + 51)
    v = n * .65 + m * .35
    if v < .30: c = mix(base, ST[1], .55)
    elif v < .48: c = mix(base, ST[1], .2)
    elif v < .68: c = base
    elif v < .82: c = mix(base, ST[4], .35)
    else: c = mix(base, ST[5], .45)
    # 층리 균열
    lay = (Y + int(vnoise(X, 0, 6, seed + 52) * 5)) % 7
    if lay == 0: c = mix(c, ST[1], .45)
    if _hash(X, Y, seed + 53) < .04: c = mix(c, ST[5], .3)
    if _hash(X, Y, seed + 54) > .975: c = mix(c, DK, .5)
    if Y == 0: c = ST[4]
    elif Y == 1: c = mix(c, ST[4], .35)
    elif Y == 2: c = mul(c, .7)
    elif Y == 3: c = mul(c, .82)
    if Y == H - 1: c = (30, 22, 26)
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .8)
    if capL and X % 16 == 0: c = mix(c, ST[5], .3)
    if capR and X % 16 == 15: c = mul(c, .55)
    return c

_fa_cache = {}
def face_tile(style, kind, n, seed, capL, capR, H):
    """kind: top/mid/bot/one. n: 앞면 안에서 이 칸이 위에서 몇 번째(0..)."""
    key = (style, n, seed % 6, capL, capR, H)
    if key in _fa_cache: return _fa_cache[key]
    def f(x, y):
        return face_px(style, x + (seed % 6) * 16 + 4000, y + n * 16, H, 3, capL, capR)
    im = mk(f); _fa_cache[key] = im; return im

# ------------------------------------------------------------------ 바닥
def floor_tile(kind, x, y):
    """kind 별 바닥 한 칸. 이웃과 이어 보이도록 전역 픽셀 좌표로 해시한다."""
    return FLOORS[kind](x, y)

def _mk_flag(base, dark, tag):
    def fn(cx, cy):
        s = int(_hash(cx, cy, 5) * 4)
        key = (tag, s)
        if key not in _fl_cache:
            _fl_cache[key] = mk(lambda X, Y: flag(X + s * 16, Y + (s % 2) * 8, 17 + s, base, dark))
        return _fl_cache[key]
    return fn
_fl_cache = {}

def _sewer_flag(cx, cy):
    s = int(_hash(cx, cy, 6) * 5); key = ('sw', s, cx % 2)
    if key not in _fl_cache:
        base = mix(ST[4], ST[3], .3); dark = ST[2]
        def f(X, Y):
            c = flag(X + s * 16, Y + (s % 2) * 8, 21, base, dark)
            m = vnoise(X + s * 16, Y, 4, 33)
            if c != dark and m > .8: c = mix(c, ST[2], .42)         # 젖은 얼룩
            if c != dark and s == 3 and m < .12: c = mix(c, LF[3], .4)
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _cata_flag(cx, cy):
    s = int(_hash(cx, cy, 8) * 5); key = ('ca', s)
    if key not in _fl_cache:
        base = mix(ST[4], ST[3], .3); dark = ST[2]
        _fl_cache[key] = mk(lambda X, Y: flag(X + s * 16, Y + (s % 2) * 8, 31, base, dark))
    return _fl_cache[key]

def _castle_flag(cx, cy):
    s = int(_hash(cx, cy, 9) * 5); key = ('cs', s)
    if key not in _fl_cache:
        base = ST[4]; dark = mix(ST[3], ST[2], .5)
        _fl_cache[key] = mk(lambda X, Y: flag(X + s * 16, Y + (s % 2) * 8, 37, base, dark))
    return _fl_cache[key]

def _trav(cx, cy):
    s = int(_hash(cx, cy, 10) * 5); key = ('tr', s)
    if key not in _fl_cache:
        def f(X, Y):
            X += s * 16; Y += (s % 2) * 8
            row = Y // 24; off = (row % 2) * 16; col = (X + off) // 32; lx = (X + off) % 32; ly = Y % 24
            if ly == 23 or lx == 31: return TRV[2] if (lx == 31 and ly == 23) else TRV[3]
            h = _hash(col, row, 71); base = TRV[4] if h < .7 else TRV[5]
            if ly == 0 or lx == 0: return mix(base, TRV[6], .5)
            r = _hash(X, Y, 72)
            if r < .05: return TRV[5] if base == TRV[4] else TRV[4]
            if r > .992: return TRV[3]
            return base
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _ruin_trav(cx, cy):
    # 신전 폐허의 판석: 낡고 금 가고, 틈에 잎이 낀다
    s = int(_hash(cx, cy, 11) * 6); key = ('rt', s)
    if key not in _fl_cache:
        def f(X, Y):
            X += s * 16; Y += (s % 2) * 8
            row = Y // 16; off = (row % 2) * 8; col = (X + off) // 16; lx = (X + off) % 16; ly = Y % 16
            if ly == 15 or lx == 15: return TRV[1] if _hash(X, Y, 3) < .5 else TRV[2]
            h = _hash(col, row, 73); base = mix(TRV[3], TRV[4], .3 + .5 * h)
            if ly == 0 or lx == 0: base = mix(base, TRV[6], .3)
            r = _hash(X, Y, 74)
            if r < .06: base = TRV[4]
            elif r > .975: base = TRV[2]
            # 금
            cr = vnoise(X, Y, 5, 75)
            if .49 < cr < .515: base = TRV[1]
            m = vnoise(X, Y, 3, 76)
            if m > .78 and (lx > 12 or ly > 12 or lx < 3): base = mix(base, LF[3], .6)
            return base
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _grass(cx, cy):
    s = int(_hash(cx, cy, 12) * 6); key = ('gr', s)
    if key not in _fl_cache:
        def f(X, Y):
            X += s * 16; Y += s * 8
            n = vnoise(X, Y, 4, 81); r = _hash(X, Y, 82)
            c = LF[3] if n < .55 else LF[4]
            if r < .10: c = LF[2]
            elif r > .93: c = LF[5]
            if _hash(X // 2, Y // 2, 83) > .965: c = (200, 160, 60)   # 작은 들꽃
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _dirt_ruin(cx, cy):
    s = int(_hash(cx, cy, 13) * 6); key = ('di', s)
    if key not in _fl_cache:
        D = [(70, 52, 42), (98, 76, 56), (122, 98, 72), (146, 120, 88)]
        def f(X, Y):
            X += s * 16; Y += s * 8
            n = vnoise(X, Y, 3.5, 91); r = _hash(X, Y, 92)
            c = D[1] if n < .5 else D[2]
            if r < .09: c = D[0]
            elif r > .94: c = D[3]
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _cave_floor(cx, cy):
    s = int(_hash(cx, cy, 14) * 8); key = ('cf', s)
    if key not in _fl_cache:
        Cf = [(70, 58, 58), (108, 92, 84), (136, 118, 100), (162, 142, 118), (186, 164, 136)]
        def f(X, Y):
            X += s * 16; Y += s * 8
            n = vnoise(X, Y, 4.5, 101); r = _hash(X, Y, 102)
            c = Cf[1] if n < .42 else (Cf[2] if n < .78 else Cf[3])
            if r < .10: c = Cf[0]
            elif r > .95: c = Cf[4]
            elif r > .90: c = mix(c, Cf[4], .4)
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _sand_cave(cx, cy):
    s = int(_hash(cx, cy, 15) * 8); key = ('sd', s)
    if key not in _fl_cache:
        Sd = [(96, 80, 66), (140, 118, 92), (176, 152, 118), (204, 182, 142)]
        def f(X, Y):
            X += s * 16; Y += s * 8
            n = vnoise(X, Y, 5, 111); r = _hash(X, Y, 112)
            c = Sd[1] if n < .55 else Sd[2]
            if r < .08: c = Sd[0]
            elif r > .93: c = Sd[3]
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _wet_sand(cx, cy):
    s = int(_hash(cx, cy, 16) * 8); key = ('ws', s)
    if key not in _fl_cache:
        Sd = [(58, 52, 54), (92, 82, 76), (120, 106, 92), (150, 134, 110)]
        def f(X, Y):
            X += s * 16; Y += s * 8
            n = vnoise(X, Y, 5, 121); r = _hash(X, Y, 122)
            c = Sd[1] if n < .5 else Sd[2]
            if r < .10: c = Sd[0]
            elif r > .95: c = Sd[3]
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _plank(cx, cy):
    # 밀수 부두 널판
    s = int(_hash(cx, cy, 17) * 4); key = ('pl', s)
    if key not in _fl_cache:
        def f(X, Y):
            ly = Y % 8; row = Y // 8
            if ly == 7: return WD[1]
            c = WD[5] if _hash(row, cx, 18) < .5 else mix(WD[4], WD[5], .5)
            if ly == 0: c = mix(c, WD[6], .4)
            j = int(_hash(row, cx + s, 19) * 12) + 2
            if X == j: return WD[1]
            if _hash(X, Y, 20) < .06: c = WD[3]
            g = vnoise(X * .5, Y * 3, 3, 21)
            if g > .74: c = mix(c, WD[3], .5)
            if (X in (1, 14)) and ly in (3, 4): c = WD[1]       # 못
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _cell(cx, cy):
    # 감방 바닥: 짚 섞인 낡은 판석
    s = int(_hash(cx, cy, 22) * 5); key = ('ce', s)
    if key not in _fl_cache:
        base = mix(ST[4], ST[3], .35); dark = ST[2]
        def f(X, Y):
            c = flag(X + s * 16, Y + (s % 2) * 8, 44, base, dark)
            if c != dark and _hash(X // 2, Y, 45 + s) > .9: c = (150, 122, 60)
            elif c != dark and _hash(X, Y // 2, 47 + s) > .955: c = (110, 84, 44)
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _bone_flag(cx, cy):
    # 납골당 바닥: 어두운 판석 위 뼛가루
    s = int(_hash(cx, cy, 23) * 5); key = ('bf', s)
    if key not in _fl_cache:
        base = mix(ST[4], ST[3], .5); dark = ST[2]
        def f(X, Y):
            c = flag(X + s * 16, Y + (s % 2) * 8, 51, base, dark)
            if c != dark:
                r = _hash(X, Y, 52 + s)
                if r > .965: c = PL[4]
                elif r > .93: c = mix(c, PL[3], .5)
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

def _dark_cata(cx, cy):
    s = int(_hash(cx, cy, 24) * 5); key = ('dc', s)
    if key not in _fl_cache:
        base = mix(ST[3], ST[4], .3); dark = ST[1]
        _fl_cache[key] = mk(lambda X, Y: flag(X + s * 16, Y + (s % 2) * 8, 61, base, dark))
    return _fl_cache[key]

def _floor_ash(cx, cy):
    # 하수 지하 기둥방의 마름돌 바닥 (큰 사각)
    s = int(_hash(cx, cy, 25) * 5); key = ('fa', s)
    if key not in _fl_cache:
        def f(X, Y):
            X += s * 16; Y += (s % 2) * 16
            lx = X % 16; ly = Y % 16
            if lx == 15 or ly == 15: return ST[2]
            c = mix(ST[4], ST[3], .25 + .3 * _hash(X // 16, Y // 16, 27))
            if lx == 0 or ly == 0: c = mix(c, ST[5], .25)
            r = _hash(X, Y, 28)
            if r < .04: c = ST[5]
            elif r > .97: c = ST[3]
            return c
        _fl_cache[key] = mk(f)
    return _fl_cache[key]

FLOORS = {'sewer': _sewer_flag, 'cata': _cata_flag, 'castle': _castle_flag, 'trav': _trav, 'ruin': _ruin_trav,
          'grass': _grass, 'dirt': _dirt_ruin, 'cave': _cave_floor, 'sand': _sand_cave, 'wetsand': _wet_sand,
          'plank': _plank, 'cell': _cell, 'bone': _bone_flag, 'darkcata': _dark_cata, 'ashfloor': _floor_ash}

# ------------------------------------------------------------------ 물 (수로·조수 웅덩이·바다)
WSEW = [(8, 24, 26), (14, 44, 46), (22, 64, 62), (36, 92, 88), (66, 128, 120), (120, 172, 160)]
WTID = [(10, 30, 44), (18, 56, 70), (28, 84, 98), (48, 120, 132), (96, 168, 172), (176, 220, 214)]
WSEA = [(10, 28, 60), (18, 52, 96), (30, 84, 130), (60, 122, 164), (120, 176, 200), (200, 228, 236)]
WPAL = {'sew': WSEW, 'tide': WTID, 'sea': WSEA}

def water_px(kind, X, Y, seed=0):
    pal = WPAL[kind]
    v = vnoise(X * .9, Y * 2.2, 3.4, seed + 61)
    c = pal[1] if v < .55 else pal[2]
    # 가로로 긴 잔물결
    a = _hash((X + (Y * 3) % 7) // 3, Y, seed + 62)
    if a > .86: c = pal[3]
    if a > .955: c = pal[4]
    if _hash(X, Y, seed + 63) > .992: c = pal[5]
    return c

def water_tile(kind, N, E, S, W, above='open', seed=0, foam=False):
    """N/E/S/W = 그 쪽 이웃도 물인가. above: 북쪽 이웃이 물 아닐 때 — 'face'(벽 앞면) / 'floor'(걷는 둔치) / 'rock'(동굴 바위)."""
    key = ('w', kind, N, E, S, W, above, seed % 8, foam)
    if key in _fl_cache: return _fl_cache[key]
    pal = WPAL[kind]
    def f(x, y):
        c = water_px(kind, x + (seed % 8) * 16, y + (seed % 8) * 3, 5)
        if not N:
            if above == 'face':
                if y < 3: c = pal[0]
                elif y < 5: c = mix(pal[1], pal[0], .5)
                elif y == 5: c = mix(c, pal[0], .35)
            elif above == 'floor':
                # 둔치 앞벽: 3/4 에서 북쪽 강둑의 남쪽 면이 보인다
                if y == 0: c = ST[5] if kind == 'sew' else (150, 130, 108)
                elif y < 4:
                    row = 0
                    b = ash(x + (seed % 8) * 5, y, 3, ST[3] if kind == 'sew' else (98, 82, 74), k=.85)
                    c = b
                elif y == 4: c = ST[1]
                elif y == 5: c = pal[0]
                elif y == 6: c = mix(c, pal[0], .5)
            elif above == 'rock':
                if y < 2: c = (40, 30, 36)
                elif y < 4: c = mix((78, 62, 60), pal[0], .3 + .2 * (y - 2))
                elif y == 4: c = pal[0]
                elif y == 5: c = mix(c, pal[0], .5)
        if not S:
            if y == 15: c = ST[5] if kind == 'sew' else (176, 150, 118)
            elif y == 14: c = mix(c, ST[5], .35) if kind == 'sew' else mix(c, (176, 150, 118), .35)
        if not W:
            if x == 0: c = ST[4] if kind == 'sew' else (150, 128, 104)
            elif x == 1: c = mix(c, pal[0], .35)
        if not E:
            if x == 15: c = ST[2] if kind == 'sew' else (96, 78, 70)
            elif x == 14: c = mix(c, pal[0], .35)
        if foam:
            r = _hash(x, y, 71)
            if (not S and y >= 12 and r > .45) or (not W and x <= 3 and r > .6) or (not E and x >= 12 and r > .6): c = pal[5]
        return c
    im = mk(f); _fl_cache[key] = im; return im

# ------------------------------------------------------------------ 지도
class Map:
    def __init__(s, W, H, name):
        s.W, s.H, s.name = W, H, name
        s.fl = [[None] * W for _ in range(H)]        # 바닥 종류 (열린 칸)
        s.wa = [[None] * W for _ in range(H)]        # 물 종류 (열린 칸, 걸을 수 없음)
        s.wh = [[2] * W for _ in range(H)]           # 그 칸 위쪽 벽 앞면 높이
        s.sty = [['sewer'] * W for _ in range(H)]    # 그 칸 위쪽 벽 앞면 종류
        s.br = [[False] * W for _ in range(H)]       # 물 위 다리 (걸을 수 있다)
        s.decals = []                                # (x, y, img) 바닥에 붙는 그림 (칸 좌상단 기준)
        s.props = []                                 # (x, y, img, w, h) 아랫줄 기준 앵커 (x,y = 발판 좌하단 칸)
        s.blocked = set()                            # 걸을 수 없는 칸 (소품)
        s.marks = {}                                 # 이름 -> (x, y)
        s.notes = {}
        s.dry = set()                                # 진입을 허용하는 마킹 (문·계단)
        s.cave = False
        s.above_kind = 'face'
        s.ceil_seed = 0
        s.overlays = []                              # 가장 위 (빛무리 등) (px, py, img)
        s.hidden = set()                             # 비밀문 칸: 통행 검사에서 지도 위 진짜 통로 (표시만 다름)

    def inb(s, x, y): return 0 <= x < s.W and 0 <= y < s.H
    def open(s, x, y): return s.inb(x, y) and (s.fl[y][x] is not None or s.wa[y][x] is not None)

    def floor(s, x0, y0, w, h, kind, wh=None, sty=None):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                s.fl[y][x] = kind; s.wa[y][x] = None; s.br[y][x] = False
                if wh: s.wh[y][x] = wh
                if sty: s.sty[y][x] = sty
    def water(s, x0, y0, w, h, kind):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w): s.wa[y][x] = kind; s.fl[y][x] = None
    def props_add(s, x, y, img, block=None, layer=1):
        img = pick_before(s.name, img)
        w = img.width // T; h = img.height // T
        s.props.append((x, y, img, w, h, layer))
        if block:
            for (bx, by) in block: s.blocked.add((x + bx, y + by))
    def decal(s, x, y, img): s.decals.append((x, y, img))
    def overlay(s, px, py, img): s.overlays.append((px, py, img))
    def glow_at(s, cx, cy, img):
        # cx, cy: 칸 좌표(소수 가능) 를 중심으로 빛무리 그림을 얹는다
        s.overlays.append((cx * T - img.width / 2, cy * T - img.height / 2, img))

    def cut(s, x0, y0, w, h):
        """열린 칸을 도로 닫는다 (방 모서리를 깎아 네모를 깬다)."""
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if s.inb(x, y): s.fl[y][x] = None; s.wa[y][x] = None; s.br[y][x] = False

    def delete_rows(s, a, b):
        """세로 [a,b) 줄을 통째로 들어낸다. 그 줄에 걸친 소품·장식은 사라지고 아래가 끌려 올라온다. 지도가 (b-a) 줄 짧아진다."""
        n = b - a
        for arr in (s.fl, s.wa, s.wh, s.sty, s.br): del arr[a:b]
        s.H -= n
        f = lambda y: y if y < a else y - n
        s.decals = [(x, f(y), im) for (x, y, im) in s.decals if not (a <= y < b)]
        s.props = [(x, f(y), im, w, h, l) for (x, y, im, w, h, l) in s.props if not (a <= y < b)]
        s.blocked = {(x, f(y)) for (x, y) in s.blocked if not (a <= y < b)}
        s.hidden = {(x, f(y)) for (x, y) in s.hidden if not (a <= y < b)}
        s.overlays = [(px, (py if py < a * T else py - n * T), im) for (px, py, im) in s.overlays if not (a * T <= py < b * T)]
        s.dry = {(x, f(y)) for (x, y) in s.dry if not (a <= y < b)}
        s.marks = {k: (v[0], f(v[1])) for k, v in s.marks.items()}

    def set_style(s, x0, y0, w, h, wh=None, sty=None):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if wh: s.wh[y][x] = wh
                if sty: s.sty[y][x] = sty

    # -- 앞면 계산
    def compute_faces(s):
        s.face = {}
        for y in range(s.H):
            for x in range(s.W):
                if not s.open(x, y) or s.open(x, y - 1): continue
                wh = s.wh[y][x]; sty = s.sty[y][x]
                chain = []
                for k in range(1, wh + 1):
                    yy = y - k
                    if not s.inb(x, yy) or s.open(x, yy): break
                    chain.append(yy)
                for i, yy in enumerate(chain):
                    if (x, yy) not in s.face or s.face[(x, yy)][2] < len(chain):
                        s.face[(x, yy)] = (sty, i + 1, len(chain))

    def check_faces(s):
        bad = []
        for (x, y), (sty, k, n) in s.face.items():
            top = y - 1
            if s.inb(x, top) and (s.open(x, top) or (x, top) in s.face): pass  # 앞면 위에 앞면: 겹친 사슬
            if not s.inb(x, top): bad.append((x, y, 'edge'))
        return bad

    def is_walk(s, x, y):
        if not s.inb(x, y): return False
        if (x, y) in s.hidden: return True
        if (x, y) in s.blocked: return False
        if s.br[y][x]: return True
        return s.fl[y][x] is not None

    def bfs(s, a, b):
        from collections import deque
        if not (s.is_walk(*a) and s.is_walk(*b)): return None
        q = deque([a]); prev = {a: None}
        while q:
            c = q.popleft()
            if c == b:
                path = []
                while c: path.append(c); c = prev[c]
                return path[::-1]
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c[0] + dx, c[1] + dy)
                if n not in prev and s.is_walk(*n): prev[n] = c; q.append(n)
        return None

    def components(s):
        seen = set(); comps = []
        for y in range(s.H):
            for x in range(s.W):
                if (x, y) in seen or not s.is_walk(x, y): continue
                st = [(x, y)]; seen.add((x, y)); comp = []
                while st:
                    c = st.pop(); comp.append(c)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        n = (c[0] + dx, c[1] + dy)
                        if n not in seen and s.is_walk(*n): seen.add(n); st.append(n)
                comps.append(comp)
        return comps

    # -- 그리기
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.wa[y][x]:
                    k = s.wa[y][x]
                    nb = lambda dx, dy: s.inb(x + dx, y + dy) and s.wa[y + dy][x + dx] == k
                    N, E, Sx, W = nb(0, -1), nb(1, 0), nb(0, 1), nb(-1, 0)
                    above = s.above_kind
                    if not N:
                        if s.inb(x, y - 1) and s.fl[y - 1][x] is not None: above = 'floor'
                        elif (x, y - 1) in s.face: above = 'face' if not s.cave else 'rock'
                    # 다리 밑: 다리가 걸친 칸은 아래 물을 그대로 그린다 (다리 그림은 소품 층)
                    t = water_tile(k, N, E, Sx, W, above, seed=_h2(x, y) if k != 'sew' else (x * 3 + y * 5), foam=(k == 'sea'))
                    im.alpha_composite(t, P)
                elif s.fl[y][x]:
                    im.alpha_composite(floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    H = n * T; idx = n - k
                    t = face_tile(sty, None, idx, int(_hash(x, y, 3) * 6), capL, capR, H)
                    im.alpha_composite(t, P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        if not s.inb(xx, yy): return False
                        return s.open(xx, yy) or (xx, yy) in s.face
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(ceiling(o8, int(_hash(x, y, 4) * 4), s.cave, getattr(s, 'band_pal', None)), P)
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

    def walk_grid(s):
        return [[1 if s.is_walk(x, y) else 0 for x in range(s.W)] for y in range(s.H)]

    def export(s, outdir, entrance, final, waypoints=None, extra=None):
        os.makedirs(outdir, exist_ok=True)
        s.render()
        s.img.convert('RGB').save(os.path.join(outdir, 'render-1x.png'))
        s.img.resize((s.W * T * 2, s.H * T * 2), Image.NEAREST).convert('RGB').save(os.path.join(outdir, 'render-2x.png'))
        g = s.walk_grid()
        path = s.bfs(entrance, final)
        wp = {}
        for k, v in (waypoints or {}).items(): wp[k] = dict(at=list(v), reach=bool(s.bfs(entrance, v)))
        comps = s.components()
        hid = set(s.hidden); s.hidden = set(); nohid = s.bfs(entrance, final); s.hidden = hid
        data = dict(name=s.name, width=s.W, height=s.H, tile=T, legend={'1': '걷는다', '0': '막힘(벽·물·소품)'},
                    entrance=list(entrance), final=list(final), path_len=(len(path) - 1 if path else None),
                    reachable=path is not None, hidden_cells=sorted([list(h) for h in s.hidden]), reachable_without_hidden=nohid is not None, waypoints=wp, walk_components=len(comps),
                    component_sizes=sorted([len(c) for c in comps], reverse=True)[:6],
                    grid=[''.join(str(v) for v in row) for row in g])
        if extra: data.update(extra)
        with open(os.path.join(outdir, 'grid.json'), 'w') as f: json.dump(data, f, ensure_ascii=False, indent=1)
        return data

def _h2(x, y): return int(_hash(x, y, 91) * 8)

def dump_parts(outdir, names=None):
    os.makedirs(os.path.join(outdir, 'parts'), exist_ok=True)
    lines = []
    for n, p in PARTS.items():
        if names is not None and n not in names: continue
        p['img'].save(os.path.join(outdir, 'parts', n + '.png'))
        lines.append((n, p['note'], p['cells']))
    return lines

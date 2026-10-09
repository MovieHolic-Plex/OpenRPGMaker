# 신도의 탑(cultist-tower) 공용 재료.
# 버들항 파이프라인을 읽기만 한다:
#   실내 = tower-interior ti_kit(→ graveyard-crypt gc_kit/gc_map → _lib3 dlib): 지도 렌더러·조각 등록·천장·널 바닥(plank)·감방 바닥(cell)
#   돌   = 버들항 성 마름돌 castle6.ash(칩셋 돌 결 ctex 포함)를 그을린 회갈색으로 두 단 어둡게 — 「오래된 교단 탑 돌」
#   야외 땅 = wasteland-world ww_base 의 칩셋 흙 타일 재색칠(recolor_tile: 칩셋 점박이 흙·고운 모래흙의 밝기 순위를 그대로) + 갈라진 틈(crack_lines)
#   고목 = wasteland-world ww_pieces.limb(가지 붓)·tufts(밑동 풀)
# 새 재료(교단 보라 천·검붉은 천·보라 불꽃·재빛 흙)만 같은 7단 규칙(0 윤곽, 1..6 밝기, 빛 왼쪽 위)으로 더한다.
# 공용 파일은 고치지 않는다 — 바닥·면 스타일은 이 모듈이 실행 중에 끼운다. 다시 돌리면 같은 그림.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
_VAR = os.path.abspath(os.path.join(_ME, '..'))
for p in ('tower-interior', 'wasteland-world'):
    q = os.path.join(_VAR, p)
    if q not in sys.path: sys.path.insert(0, q)
from ti_kit import *                                    # noqa (T, ST, WD, IR, BR, GLD, CRM, SL, DK, FL, BONE, Cv, Mk, vol, fin, Kit, KMap, foot, cyl_k, topell, stone_box …)
from ti_kit import _hash
import ti_kit as TK
import numpy as np
import ww_base as WB
import ww_pieces as WP
import pv
HERE = _ME

# ------------------------------------------------------------------ 팔레트 (7단: 0 윤곽 .. 6 밝음)
VIO = [(22, 10, 30), (40, 16, 54), (60, 24, 80), (82, 34, 106), (108, 50, 134), (140, 76, 164), (178, 118, 200)]     # 교단 보라 천
CRIM = [(34, 8, 18), (66, 12, 26), (98, 18, 32), (130, 26, 36), (164, 40, 44), (196, 70, 60), (226, 116, 96)]       # 검붉은 천
PF = [(52, 14, 82), (92, 30, 140), (138, 60, 196), (186, 110, 236), (226, 184, 252), (250, 236, 255)]              # 보라 불꽃 6단
EBW = [DK, (34, 22, 22), (50, 32, 28), (68, 44, 34), (88, 58, 42), (110, 74, 52), (136, 96, 66)]                   # 그을린 짙은 나무(버들항 WD 한 단 아래)
SOOT = (40, 32, 36)
CSTONE_TINT = (88, 72, 70)                                                                                           # 그을린 회갈색 쪽으로
def R7(r, k): return r[clamp(k, 0, len(r) - 1)]

def cstone(X, Y, k=.62, bw=16, bh=8, seed=0):
    """교단 탑 돌: 버들항 성 마름돌(castle6.ash, 칩셋 돌 결)을 그을린 회갈색으로 옮기고 k 배로 어둡게."""
    c = C6.ash(X, Y, k=1.0, bw=bw, bh=bh, seed=seed)
    c = mix(c, CSTONE_TINT, .32)
    return mul(c, k / .62 * .66)
# 돌 7단 램프(교단 돌) — 조각의 3/4 상자·기둥에 쓴다
CS = [DK] + [mul(mix(ST[i], CSTONE_TINT, .32), .9) for i in range(1, 7)]

# ------------------------------------------------------------------ 실내 바닥 (48x48 주기 표본)
def cult_flag(X, Y):
    """교단 탑 판석: 24x16 마름돌 반장 어긋나게(탑 판석과 같은 짜임), 돌마다 톤, 위·왼 모서리 밝게, 그을음 얼룩·촛농 점."""
    row = Y // 16; ly = Y % 16; off = (row % 2) * 12
    xx = (X + off) % 48; col = xx // 24; lx = xx % 24
    if ly == 15 or lx == 23: return CS[2]
    h = _hash(col, row, 701)
    base = mix(CS[4], CS[3], .35) if h < .45 else (mix(CS[4], CS[3], .15) if h < .8 else mix(CS[4], CS[5], .2))
    c = base
    if ly == 0 or lx == 0: c = mix(base, CS[5], .5)
    elif ly == 14 or lx == 22: c = mix(base, CS[2], .5)
    else:
        r = _hash(X, Y, 702)
        if r < .05: c = mix(base, CS[2], .6)
        elif r > .975: c = mix(base, CS[5], .55)
        if pn(X, Y, 6, 703) > .78: c = mix(c, SOOT, .22)                      # 그을음
        if _hash(X // 2, Y // 2, 704) > .992: c = CRM[4]                       # 촛농 점
        hc = _hash(col, row, 705)
        if hc < .14:
            x0c = 3 + int(_hash(col, row, 706) * 16); y0c = 3 + int(_hash(col, row, 707) * 6)
            sl = -1 if _hash(col, row, 708) < .5 else 1; t = ly - y0c
            if 0 <= t < 3 + int(_hash(col, row, 709) * 5) and lx == x0c + sl * (t // 2): c = mix(base, CS[2], .6)
    return c
mk_floor('ct_flag', cult_flag)

def ritual_floor(X, Y):
    """꼭대기 의식실: 큰 정사각 판(16) 두 톤에 검붉은 물이 밴 줄눈, 모서리마다 박은 작은 보라 돌."""
    lx = X % 16; ly = Y % 16; cx = X // 16; cy = Y // 16
    if lx == 15 or ly == 15: return mix(CS[2], CRIM[1], .45)
    c = mix(CS[3], CS[4], .55) if (cx + cy) % 2 == 0 else mix(CS[3], CS[4], .25)
    if lx == 0 or ly == 0: c = mix(c, CS[5], .4)
    elif lx == 14 or ly == 14: c = mix(c, CS[2], .45)
    r = _hash(X, Y, 711)
    if r < .045: c = mix(c, CS[2], .55)
    elif r > .975: c = mix(c, CS[5], .5)
    if pn(X, Y, 8, 712) > .74: c = mix(c, CRIM[2], .16)                        # 검붉은 얼룩(밴 자국)
    ex = (X + 1) % 16; ey = (Y + 1) % 16
    if min(ex, 16 - ex) + min(ey, 16 - ey) <= 1: c = VIO[4] if (ex, ey) == (0, 0) else VIO[2]
    return c
mk_floor('ct_ritual', ritual_floor)

# ------------------------------------------------------------------ 벽 앞면: 교단 돌 + 걸레받이 + 위 그을음
dlib.FACE_BASE['cult'] = mix(CS[3], CS[4], .3)
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style != 'cult': return _prev_face(style, X, Y, H, seed, capL, capR)
    c = cstone(X, Y + 3, k=.6, seed=seed)
    if vnoise(X, Y, 5, seed + 71) > .8: c = mix(c, SOOT, .22)
    soot = max(0.0, 1 - Y / 14.0)                                              # 천장 밑 그을음(촛불 연기)
    if soot > 0 and vnoise(X * 1.6, Y * .6, 4, seed + 72) < .3 + .5 * soot: c = mix(c, SOOT, .25 * soot + .08)
    if Y >= H - 9 and Y < H - 3:                                               # 걸레받이
        lyy = Y - (H - 9)
        c = mul(mix(C6.ash(X, lyy, k=1.0, bw=24, bh=6, seed=seed + 5), CSTONE_TINT, .32), .55)
        if lyy == 0: c = mix(CS[5], CS[4], .4)
    if Y == 0: c = CS[5]
    elif Y == 1: c = mix(c, CS[5], .3)
    elif Y == 2: c = mul(c, .72)
    elif Y == 3: c = mul(c, .84)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, CS[6], .3)
    if capL and X % 16 == 1: c = mix(c, CS[6], .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

def face_sample_ct(w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile('cult', None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

def facefill(cv, W, H, seed=0, x_ok=None):
    """조각 안을 벽 앞면 결로 칠한다(벽에 박히는 문·아치 둘레가 벽과 이어 보이게)."""
    for y in range(H):
        for x in range(W):
            if x_ok and not x_ok(x, y): continue
            cv.px(x, y, dlib.face_px('cult', x + 4000 + seed * 16, y, H, 3, False, False))

# ------------------------------------------------------------------ 야외 땅: 칩셋 흙 타일 재색칠 + 갈라진 틈 (자체 노이즈 바닥 아님)
WB.PAL.update({
    'ashe': ['#1a1418', '#2c2427', '#433a39', '#5b504b', '#75685f', '#8f8274', '#a99c8a'],   # 재빛 마른 흙(회갈색)
    'ashw': ['#100c10', '#22191c', '#362729', '#4a3735', '#5f4a44', '#776055', '#907868'],   # 잿빛 고목
    'dgr':  ['#1a1810', '#33301e', '#4c482c', '#68623e', '#847c52', '#a09868', '#bab286'],   # 바랜 마른 풀(잿빛 쪽)
})
WB.GRAIN.update({'ashe': (0.18, 1.5), 'ashw': (0.18, 1.4), 'dgr': (0.14, 1.4)})
_GTX = {}
def _gtex(name):
    if name not in _GTX:
        src = {'earth': ((16, 224), 2.0, 4.6), 'hard': ((64, 224), 2.3, 4.7), 'dark': ((16, 224), 1.2, 3.6)}[name]
        (x, y), lo, hi = src
        _GTX[name] = WB.recolor_tile(WB.chip_tex(x, y), 'ashe', lo, hi)[0]
    return _GTX[name]

def ground_ash(Wp, Hp, seed=11, per=None, dark=None):
    """재빛 마른 땅(Wp x Hp 화소): 칩셋 점박이 흙(재색) 기본 + 다져진 고운 흙 덩이 + 덩이로만 남긴 갈라진 틈 + 잔 틈.
    per 가 있으면(48) 3x3 이어 붙여도 이음새 없는 주기 표본. dark(화소 마스크 0..1) = 탑 그늘·제단 둘레 그늘."""
    E = WB.tiled(_gtex('earth'), Wp, Hp); Hd = WB.tiled(_gtex('hard'), Wp, Hp); Dk = WB.tiled(_gtex('dark'), Wp, Hp)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    if per:
        n1 = WB.tnoise(Wp, Hp, 16, seed) * .6 + WB.tnoise(Wp, Hp, 8, seed + 1) * .4
        keep = WB.tnoise(Wp, Hp, 16, seed + 21) > .62
    else:
        n1 = WB.smooth(Wp, Hp, 40, seed) * .7 + WB.smooth(Wp, Hp, 14, seed + 1) * .3
        keep = WB.smooth(Wp, Hp, 44, seed + 21) > .56
    out = E.copy()
    m = n1 > .62
    out[m] = Hd[m]
    keep &= WB.hash2(X // 6, Y // 6, seed + 26) > .2
    cr, lip = WB.crack_lines(X, Y, seed + 23, per, 24 if per else 30, keep, .05)
    pe = WB.P('ashe')
    out[cr] = pe[1]; out[lip] = pe[5]
    if dark is not None:
        n3 = WB.smooth(Wp, Hp, 8, seed + 4) if not per else WB.tnoise(Wp, Hp, 8, seed + 4)
        md = (dark * .9 + n3 * .3) > .66
        out[md] = Dk[md]
    return out

def ground_sample(kind='crack', seed=3):
    """3x3 주기 표본(48x48): crack = 칩셋 점박이 흙(재색) + 주기 48 로 감긴 갈라진 틈, hard = 다져진 고운 흙(틈 없음, 잔돌 점)."""
    Y, X = np.mgrid[0:48, 0:48]
    if kind == 'crack':
        a = WB.tiled(_gtex('earth'), 48, 48).copy()
        keep = WB.tnoise(48, 48, 16, seed + 1) > .55
        cr, lip = WB.crack_lines(X, Y, seed + 2, per=48, sc=24, keep=keep, thick=.05)
        a[cr] = WB.P('ashe')[1]; a[lip & ~cr] = WB.P('ashe')[5]
    else:
        a = WB.tiled(_gtex('hard'), 48, 48).copy()
        pb = (WB.hash2(X, Y, seed + 5) > .985)
        a[pb] = WB.P('ashe')[6]
        a[np.roll(pb, -1, 0)] = WB.P('ashe')[2]
    return Image.fromarray(a.astype(np.uint8)).convert('RGBA')

# ------------------------------------------------------------------ 작은 도우미
def flame(cv, cx, ybot, h, ramp=PF, seed=0, w=None):
    """작은 불꽃(촛불·화로): 아래 넓고 위로 뾰족, 가운데 밝다."""
    w = w or max(1, h // 3)
    for y in range(ybot - h, ybot + 1):
        t = (y - (ybot - h)) / max(1, h)
        hw = max(0, int(round(w * min(1, t * 1.4))))
        for x in range(cx - hw, cx + hw + 1):
            d = abs(x - cx) / max(1, hw) if hw else 0
            k = 4 if d < .35 and t > .35 else (3 if d < .7 else 2)
            if t < .25: k = min(k, 3)
            if _hash(x, y, seed + 7) < .1: k = max(1, k - 1)
            cv.px(x, y, ramp[clamp(k, 0, len(ramp) - 1)])

def candle(cv, x, ybot, h=5, wax=None, fl=PF, seed=0):
    """초 하나(2px 굵기) + 불꽃."""
    wx = wax or [CRM[3], CRM[5], CRM[6]]
    for y in range(ybot - h + 1, ybot + 1):
        cv.px(x, y, wx[2]); cv.px(x + 1, y, wx[0])
    cv.px(x, ybot - h + 1, wx[1])
    cv.px(x, ybot - h, (60, 40, 40)); flame(cv, x, ybot - h - 1, 3, fl, seed, 1)

def skull(cv, cx, cy, s=1.0, seed=0):
    """작은 해골(앞모습, 3/4 위에서): 둥근 머리(위 밝음) + 눈구멍 둘 + 코 + 이빨 줄. 크기 약 7x7 * s."""
    rx = 3.4 * s; ry = 3.0 * s
    for y in range(int(cy - ry) - 1, int(cy + ry * 1.6) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            jaw = (y + .5 - cy) > 0 and abs(x + .5 - cx) <= rx * .62 and (y + .5 - cy) <= ry * 1.55
            if dx * dx + dy * dy <= 1 or jaw:
                k = 4 if dx < -.2 and dy < .2 else 3
                if dy < -.5: k = 4
                if dx > .45 or dy > 1.1: k = 2
                cv.px(x, y, BONE[clamp(k, 0, 4)])
    e = max(1, int(round(s)))
    ey = int(cy + ry * .25)
    for (ox) in (-1.6 * s, 1.6 * s):
        ex = int(round(cx + ox - .5))
        for yy in range(ey - e + 1, ey + 1):
            for xx in range(ex - (e - 1), ex + 1): cv.px(xx, yy, BONE[0])
    cv.px(int(cx - .5), int(cy + ry * .75), BONE[0])
    ty = int(cy + ry * 1.25)
    for x in range(int(cx - rx * .5), int(cx + rx * .5) + 1):
        cv.px(x, ty, BONE[1] if x % 2 else BONE[3])

def eye_emblem(cv, cx, cy, w=7, c_out=None, c_in=None, c_pupil=None):
    """교단 문장(글자·종교 상징 아님): 아몬드 눈 + 둥근 눈동자 + 아래 세 갈래 빛줄기."""
    c_out = c_out or BONE[3]; c_in = c_in or CRIM[3]; c_pupil = c_pupil or VIO[0]
    h = max(2, w // 3)
    for x in range(cx - w // 2, cx + w // 2 + 1):
        t = abs(x - cx) / max(1, w / 2)
        hh = int(round(h * (1 - t * t)))
        cv.px(x, cy - hh, c_out); cv.px(x, cy + hh, c_out)
        for y in range(cy - hh + 1, cy + hh): cv.px(x, y, c_in)
    cv.px(cx, cy, c_pupil); cv.px(cx - 1, cy, c_pupil); cv.px(cx, cy - 1, mix(c_pupil, c_out, .3))
    for (dx, n) in ((-2, 2), (0, 3), (2, 2)):
        for j in range(n): cv.px(cx + dx + (0 if dx == 0 else (1 if dx < 0 else -1) * (j // 2) * 0), cy + h + 2 + j, c_out)

def cloth_v(cv, x0, x1, y0, y1, ramp, seed=0, tip=True, border=None):
    """늘어진 천(깃발·휘장): 세로 주름(왼쪽 밝음), 아래 끝 뾰족, 테두리 띠."""
    w = x1 - x0
    for y in range(y0, y1):
        for x in range(x0, x1):
            lx = x - x0
            if tip and y >= y1 - w // 2:
                if abs(x + .5 - (x0 + w / 2)) > (y1 - y) * 1.0: continue
            k = 4
            ph = (lx + _hash(lx, 0, seed) * .5) % 4
            if ph < 1: k = 5
            elif ph >= 3: k = 3
            if lx == 0: k = 5
            if lx == w - 1: k = 2
            if y == y0: k = 6 if lx < w - 1 else 4
            if border and (lx in (1, w - 2)) and y > y0: cv.px(x, y, border[3 if lx == w - 2 else 4]); continue
            cv.px(x, y, ramp[clamp(k, 0, 6)])

def hflip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

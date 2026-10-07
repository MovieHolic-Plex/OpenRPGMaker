"""부엉이 우체국 모듈 — 눈 덮인 호그스미드 거리 외부 + 우체국 실내. 전부 코드 손 도트."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'postoffice'
SP = 'postoffice'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) % 1000 / 1000


def wrapR(c, x, y, w, h, col, per=16):
    for j in range(h):
        for i in range(w):
            c.P((x + i) % per, (y + j) % per, col)


# ───────────────────────── 바닥 재료 ─────────────────────────
def snow_tile(seed):
    t = Cv(16, 16)
    t.R(0, 0, 16, 16, K('snow', 2))
    # 쌓인 눈의 덩이: 밝은 둔덕(2~3px 가로 덩이)과 파란 그늘 한 줄
    spots = {1: [(9, 9, 3), (3, 3, 2)], 2: [(2, 11, 3), (11, 4, 2)]}[seed]
    # 부드러운 바람결: 가로로 길게 이어진 밝은 띠와 그 아래 옅은 그늘 띠
    bands = {1: [], 2: []}[seed]
    for x, y, w in bands:
        wrapR(t, x, y, w, 1, K('snow', 3)); wrapR(t, x + 1, y + 1, w - 2, 1, K('snow', 1))
    for x, y, w in spots:
        wrapR(t, x, y, w, 1, K('snow', 3))
    return t


def snow_drift_tile(seed):
    """4단 쌓인 눈(16 주기): 바탕 snow2 위에 둔덕 윗등 snow3, 아래쪽 그늘 water4·snow1, 1px 반짝임. A/B 둔덕 위치가 다르다."""
    t = Cv(16, 16)
    t.R(0, 0, 16, 16, K('snow', 2))
    # 둔덕 하나 = 왼쪽 위 밝은 등(snow3) + 오른쪽 아래 그늘 초승달(water4, 가장 깊은 곳 snow1)
    drifts = {1: [(1, 1, 9), (8, 9, 7)], 2: [(6, 3, 8), (0, 10, 7)]}[seed]
    for x, y, w in drifts:
        wrapR(t, x + 2, y, w - 5, 1, K('snow', 3))
        wrapR(t, x + 1, y + 1, w - 4, 1, K('snow', 3)); wrapR(t, x + w - 3, y + 1, 2, 1, K('water', 4))
        wrapR(t, x, y + 2, 2, 1, K('snow', 3)); wrapR(t, x + w - 4, y + 2, 4, 1, K('water', 4))
        wrapR(t, x + 1, y + 3, w - 1, 1, K('water', 4)); wrapR(t, x + w - 4, y + 3, 2, 1, K('snow', 1))
        wrapR(t, x + 3, y + 4, w - 5, 1, K('water', 4))
    for x, y in {1: [(13, 5), (4, 12)], 2: [(2, 6), (12, 15)]}[seed]:
        wrapR(t, x, y, 1, 1, K('snow', 3))
    return t


@REG.piece('wz-post-snow-a', '쌓인 눈 바닥 A', 1, 1, ['F'], 'surfaces', SP,
           desc='호그스미드 거리 위에 쌓인 눈 1×1. 밝은 둔덕 윗등, 남쪽 그늘 2단, 반짝임 1~2점.', rules='거리 바닥 반복. 눈 B 와 섞어 깐다.',
           tags=['눈', '바닥'], role='terrain', repeat=True)
def _snow_a(c): c.blit(snow_drift_tile(1), 0, 0)


@REG.piece('wz-post-snow-b', '쌓인 눈 바닥 B', 1, 1, ['F'], 'surfaces', SP,
           desc='쌓인 눈 바닥의 다른 둔덕 배치 1×1.', rules='눈 A 와 섞어 깐다.', tags=['눈', '바닥'], role='terrain', repeat=True)
def _snow_b(c): c.blit(snow_drift_tile(2), 0, 0)


def plank_floor():
    t = Cv(16, 16)
    tones = (3, 2, 3, 2)
    for r in range(4):
        y = r * 4
        b = tones[r]
        t.R(0, y, 16, 4, K('wood', b))
        t.HL(0, y, 16, K('wood', b + 1))
        t.HL(0, y + 3, 16, K('wood', 1))
        jx = (r * 7 + 3) % 16
        t.VL(jx, y, 3, K('wood', 1))
        if r % 2 == 0: t.P((jx + 6) % 16, y + 1, K('wood', b - 1))
    return t


@REG.piece('wz-post-floor', '우체국 판자 바닥', 1, 1, ['F'], 'surfaces', SP,
           desc='우체국 안쪽의 짙은 오크 판자 바닥 1×1. 4px 폭 판재, 줄마다 어긋난 이음.', rules='실내 바닥 반복.', tags=['바닥', '실내'],
           role='terrain', repeat=True)
def _floor(c): c.blit(plank_floor(), 0, 0)


def cobble_tile():
    t = Cv(16, 16)
    t.R(0, 0, 16, 16, K('stone', 1))
    # 줄마다 줄눈 x 가 다르다(0,6,11 / 3,8,14 / 1,5,10) — 16px 세로 정렬이 생기지 않게
    rows = [(0, 5, [(0, 6, 3), (6, 5, 4), (11, 5, 2)]),
            (5, 6, [(3, 5, 4), (8, 6, 2), (14, 5, 3)]),
            (11, 5, [(1, 4, 2), (5, 5, 3), (10, 7, 4)])]
    for ry, rh, ss in rows:
        for sx, sw, tone in ss:
            for j in range(rh - 1):
                for i in range(sw - 1):
                    wrapR(t, sx + i, ry + j, 1, 1, K('stone', tone))
            for i in range(sw - 1): wrapR(t, sx + i, ry, 1, 1, K('stone', tone + 1))
            for j in range(rh - 1): wrapR(t, sx, ry + j, 1, 1, K('stone', tone + 1))
            wrapR(t, sx + sw - 2, ry + 1, 1, rh - 2, K('stone', tone - 1))
            wrapR(t, sx + 1, ry + rh - 2, sw - 3, 1, K('stone', tone - 1))
            wrapR(t, sx, ry, 1, 1, K('stone', 1))
    # 돌 윗면에 얹힌 눈(밝은 등 + 아래 그늘)과 줄눈에 낀 눈
    for x, y, w in ((1, 1, 4), (7, 0, 3), (4, 6, 3), (15, 6, 3), (9, 7, 3), (11, 12, 4), (2, 12, 2), (6, 13, 3)):
        wrapR(t, x, y, w, 1, K('snow', 2)); wrapR(t, x, y, 1, 1, K('snow', 3))
        wrapR(t, x + 1, y + 1, w - 2, 1, K('water', 4))
    for x, y, w in ((2, 10, 3), (12, 4, 3), (7, 15, 2), (13, 15, 2)):
        wrapR(t, x, y, w, 1, K('snow', 1))
    return t


def _bank_px(p, x, y, d, b, sn, along):
    """d = 길 안쪽 깊이(px). d<0 바깥 눈, d<b 눈둑(밝은 등·몸·그늘 입술 3단), 그 밖은 자갈(가끔 흩어진 눈 한 점)."""
    if d < 0:
        p.P(x, y, sn.get(x % 16, y % 16))
    elif d < b - 2:
        p.P(x, y, K('snow', 2) if hsh(along % 16, d, 13) < 0.15 else K('snow', 3))
    elif d == b - 2:
        p.P(x, y, K('snow', 2))
    elif d == b - 1:
        p.P(x, y, K('snow', 1) if hsh(along % 16, 4, 17) < 0.25 else K('water', 4))
    elif d == b + 1 and hsh(along % 16, 6, 19) < 0.18:
        p.P(x, y, K('snow', 2))


def _bank_w(v):
    return 3 + (1 if hsh((v % 16) // 2, 0, 11) < 0.55 else 0)


def _snowcobble():
    import math
    cob = cobble_tile()
    sn = snow_drift_tile(1)
    p = Cv(48, 48)
    p.tile(cob, 0, 0, 48, 48)
    lo, hi, r = 3, 44, 6
    for y in range(48):
        for x in range(48):
            inx = lo + r <= x <= hi - r
            iny = lo + r <= y <= hi - r
            if not inx and not iny:      # 둥근 바깥 모서리
                cx = lo + r if x < lo + r else hi - r
                cy = lo + r if y < lo + r else hi - r
                d = int(r + 0.5 - math.hypot(x - cx, y - cy))
                if math.hypot(x - cx, y - cy) > r + 0.5: d = -1
                _bank_px(p, x, y, d, 4, sn, x + y)
                continue
            dv = min(y - lo, hi - y); dh = min(x - lo, hi - x)
            if dv <= dh: _bank_px(p, x, y, dv, _bank_w(x), sn, x)
            else: _bank_px(p, x, y, dh, _bank_w(y), sn, y)
    ic = Cv(16, 16)
    ic.tile(cob, 0, 0, 16, 16)
    for ox, oy in ((-0.5, -0.5), (15.5, -0.5), (-0.5, 15.5), (15.5, 15.5)):
        for y in range(16):
            for x in range(16):
                dist = math.hypot(x - ox, y - oy)
                if dist < 6.5: _bank_px(ic, x, y, int(dist - 2.5) if dist >= 2.5 else -1, 4, sn, x + y)
    return p, ic


REG.autotile('wz-post-snowcobble', '눈 덮인 자갈 골목', 'surfaces', SP,
             desc='호그스미드 골목의 회색 자갈길 오토타일. 바깥은 쌓인 눈, 가장자리 돌 위에 눈가루가 얹힌다.',
             rules='골목 길 칠하기. 바깥(눈 바닥 위)에 칠한다.', tags=['자갈', '골목', '눈'])(_snowcobble)


def _shoe(c, fx, fy, flip=False):
    """발자국 하나: 앞창(5행 타원) + 뒤꿈치(2x2). 위쪽이 발끝."""
    rows = [(1, 2), (0, 4), (0, 4), (0, 4), (1, 2)]
    for j, (dx, w) in enumerate(rows):
        c.R(fx + dx, fy + j, w, 1, K('snow', 1))
    c.R(fx + 1, fy + 6, 2, 2, K('snow', 1))
    # 왼쪽 위 가장자리는 짙게, 오른쪽 아래는 밝게
    c.HL(fx + 1, fy, 2, K('snow', 0)); c.VL(fx, fy + 1, 3, K('snow', 0)); c.P(fx + 1, fy + 5 - 0, K('snow', 3)) if False else None
    c.HL(fx + 1, fy + 6, 2, K('snow', 0))
    c.VL(fx + 4, fy + 2, 2, K('snow', 3)); c.P(fx + 3, fy + 4, K('snow', 3)); c.HL(fx + 1, fy + 8, 3, K('snow', 3))


@REG.piece('wz-post-print-a', '눈 위 발자국 A', 1, 1, ['f'], 'effects', SP,
           desc='눈 위에 찍힌 발자국 한 쌍(왼발 앞, 오른발 뒤). 투명 바닥 덧칠.', rules='눈 바닥 위에 얹는다.', tags=['발자국'], role='terrain')
def _print_a(c):
    _shoe(c, 3, 1); _shoe(c, 9, 7)


@REG.piece('wz-post-print-b', '눈 위 발자국 B', 1, 1, ['f'], 'effects', SP,
           desc='눈 위에 비스듬히 이어지는 발자국 두 개.', rules='발자국 A 와 번갈아 깐다.', tags=['발자국'], role='terrain')
def _print_b(c):
    _shoe(c, 1, 6); _shoe(c, 10, 0)


@REG.piece('wz-post-puddle', '녹은 물웅덩이', 1, 1, ['f'], 'surfaces', SP,
           desc='문턱 앞 눈이 녹아 고인 작은 물웅덩이. 가장자리에 눈 테두리, 윗줄에 하늘빛 반사.', rules='눈 바닥 위에 얹는다.', tags=['웅덩이', '물'],
           role='water')
def _puddle(c):
    c.ellipse(8, 8.5, 7, 4.5, K('snow', 3))
    c.ellipse(8, 8.5, 6, 3.5, K('water', 2))
    c.ellipse(8, 8, 5, 2.5, K('water', 3))
    c.HL(5, 7, 4, K('water', 4)); c.P(10, 8, K('water', 4)); c.P(6, 9, K('water', 2))
    c.ellipse(8, 8.5, 7, 4.5, K('snow', 1), fill=False)


@REG.piece('wz-post-threshold', '눈에서 문턱으로', 1, 1, ['F'], 'surfaces', SP,
           desc='문 앞 바닥: 윗줄은 쌓인 눈, 아랫줄은 닳은 돌 문턱판으로 바뀌는 전이 1×1.', rules='문 바로 앞(남쪽) 칸에 깐다.',
           tags=['문턱', '눈'], role='terrain')
def _thresh(c):
    c.blit(snow_tile(1), 0, 0)
    c.R(0, 7, 16, 9, K('stone', 3))
    c.HL(0, 7, 16, K('snow', 2)); c.HL(1, 8, 5, K('snow', 2)); c.HL(9, 8, 4, K('snow', 2)); c.HL(0, 6, 16, K('snow', 3))
    c.HL(0, 9, 16, K('stone', 4)); c.HL(0, 15, 16, K('stone', 1))
    c.VL(7, 10, 5, K('stone', 1)); c.VL(14, 10, 5, K('stone', 1))
    c.R(2, 11, 3, 1, K('stone', 2)); c.R(9, 12, 4, 1, K('stone', 2))


# ───────────────────────── 건물 키트: 돌·지붕·벽 ─────────────────────────
def block_courses(c, y0, rows, rh, joints, seed=1):
    """16px 주기로 이어지는 돌 쌓기. joints[r] = 그 줄의 세로 줄눈 x 목록."""
    for r in range(rows):
        y = y0 + r * rh
        js = joints[r % len(joints)]
        nsp = len(js)
        tones = [2 + int(hsh(r, i, seed) * 3) for i in range(nsp)]   # 2..4
        spans = []
        for i in range(nsp):
            a = js[i] + 1
            b = (js[i + 1] - 1) if i + 1 < nsp else 15
            spans.append((a, b, tones[i]))
        # 0 ~ 첫 줄눈 앞 조각은 맨 뒤 돌과 한 덩이(이웃 칸에서 이어짐)
        wrap_tone = tones[-1]
        if js[0] > 0:
            spans.append((0, js[0] - 1, wrap_tone))
        c.R(0, y, 16, rh, K('stone', 1))
        for a, b, t in spans:
            if b < a: continue
            c.R(a, y, b - a + 1, rh - 1, K('stone', t))
            if a != 0 or js[0] == 0 or True:
                c.HL(a, y, b - a + 1, K('stone', t + 1))
            if a != 0: c.VL(a, y, rh - 1, K('stone', t + 1))
            c.VL(b, y + 1, rh - 2, K('stone', t - 1))
            c.HL(a, y + rh - 2, b - a + 1, K('stone', t - 1))
        c.HL(0, y + rh - 1, 16, K('stone', 1))


def snow_bumps(c, y, seed, lo=2, hi=3, period=16, lift=1):
    """가로 눈 쌓임 선: y 줄에 눈, 군데군데 한 줄 더 솟는다."""
    for x in range(16):
        c.P(x, y, K('snow', hi))
        if hsh(x // 3, seed, 7) < 0.5: c.P(x, y - lift, K('snow', hi))
        c.P(x, y + 1, K('snow', lo)) if lo else None


def slate_rows(c, y0, y1, flip=0):
    for y in range(y0, y1):
        r = y % 4
        course = y // 4
        off = (course * 3 + flip) % 8
        for x in range(16):
            t = 3 if r == 0 else (1 if r == 3 else 2)
            if r != 3 and (x - off) % 8 == 0: t = 1
            elif r == 0 and (x - off) % 8 in (1, 2, 3): t = 4
            c.P(x, y, K('slate', t))


def snow_clump(c, x, y, w):
    c.HL(x, y, w, K('snow', 3)); c.HL(x - 1, y + 1, w + 2, K('snow', 2)); c.HL(x, y + 2, w, K('snow', 1))
    c.P(x - 1, y + 1, K('snow', 3))


def roof_end(c, side, y0=0, y1=16):
    xs = (0, 1) if side == 'l' else (14, 15)
    outer = 0 if side == 'l' else 15
    inner = 1 if side == 'l' else 14
    for y in range(y0, y1):
        c.P(inner, y, K('wood', 2)); c.P(outer, y, K('wood', 0))
        c.P(inner if True else 0, y, K('wood', 3 if y % 4 == 0 else 2))


def d_ridge(c, side=None):
    t = Cv(16, 16)
    slate_rows(t, 10, 16, flip=0)
    # 눈 덮개: 위가 둥근 눈 능선(8px 주기로 이어짐)
    for x in range(16):
        top = 4 if (x % 8) not in (2, 3, 4, 5) else 3
        for y in range(top, 10):
            d = y - top
            t.P(x, y, K('snow', 3 if d == 0 else (2 if d < 4 else 1)))
        if (x % 8) in (0, 7): t.P(x, 9, K('snow', 1))
        # 아래 가장자리 물결: 눈 뭉치가 슬레이트 쪽으로 늘어진다
        if hsh(x // 2, 3, 9) < 0.4: t.P(x, 10, K('snow', 1))
    if side:
        if side == 'l': t.clear(0, 0, 1, 16)
        else: t.clear(15, 0, 1, 16)
    t.outline()
    if side:
        # 끝: 슬레이트 쪽 박공 널
        col = 0 if side == 'l' else 15
        for y in range(10, 16): t.P(col, y, K('wood', 0))
    c.blit(t, 0, 0)


def d_slope(c, side=None, seed=1):
    slate_rows(c, 0, 16, flip=seed)
    clumps = {1: [(4, 8, 5)], 2: [(9, 3, 4)], 3: [(2, 11, 4)]}[seed]
    for x, y, w in clumps: snow_clump(c, x, y, w)
    if side: roof_end(c, side)


def d_eave(c, side=None):
    slate_rows(c, 0, 7)
    # 처마 끝에 두껍게 쌓인 눈: 아랫단이 물결친다
    for x in range(16):
        c.P(x, 7, K('snow', 3)); c.P(x, 8, K('snow', 2)); c.P(x, 9, K('snow', 2))
        if (x % 8) in (1, 2, 5, 6): c.P(x, 10, K('snow', 1))
        if (x % 8) in (2, 5): c.P(x, 11, K('snow', 1)) if False else None
    c.HL(0, 6, 16, K('slate', 0))
    # 처마널(그늘)
    c.R(0, 11, 16, 3, K('wood', 2)); c.HL(0, 11, 16, K('wood', 3)); c.HL(0, 13, 16, K('wood', 1))
    c.HL(0, 14, 16, K('wood', 1)); c.HL(0, 15, 16, K('wood', 0))
    for x in range(16):
        if (x % 8) in (1, 2, 5, 6): c.P(x, 10, K('snow', 1))
        else: c.P(x, 10, K('wood', 1))
    if side:
        outer = 0 if side == 'l' else 15
        inner = 1 if side == 'l' else 14
        for y in range(16):
            c.P(inner, y, K('wood', 3 if y < 7 and y % 4 == 0 else 2)); c.P(outer, y, K('wood', 0))
        c.P(outer, 15, K('wood', 0))


def icicles(c, xs=((2, 3), (6, 5), (10, 2), (13, 4))):
    for x, n in xs:
        for k in range(n):
            c.P(x, k, K('snow', 2 if k < n - 1 else 3))
        c.P(x, n - 1, K('snow', 3))
        c.P(x + 1 if x < 15 else x - 1, 0, K('snow', 1))


def _fasc(c, w=16):
    """처마 밑 그늘 줄 + 고드름 윗단."""
    c.R(0, 0, w, 3, K('linen', 1)); c.HL(0, 3, w, K('linen', 1))


def d_wall(c, kind='M'):
    """1×3(16×48) 하프팀버 벽: 처마 그늘 y0~3, 회벽 y3~39(허리 보 y27~29), 눈 y40, 돌 밑동 y41~47."""
    c.R(0, 0, 16, 48, K('linen', 2))
    for x, y, w in ((3, 11, 3), (9, 18, 4), (5, 33, 3), (11, 8, 2), (2, 22, 2), (10, 36, 3)):
        c.HL(x, y, w, K('linen', 3))
    c.R(0, 0, 16, 2, K('linen', 1)); c.HL(0, 2, 16, K('linen', 1))
    for x in range(0, 16, 2): c.P(x, 3, K('linen', 1))
    icicles(c)
    if kind == 'M':
        # 좌우 대칭 X 가새: M 을 이어 붙이면 마름모 격자가 된다
        for i in range(16):
            y = 5 + int(i * 20 / 15)
            for xx in (i, 15 - i):
                c.P(xx, y, K('wood', 3)); c.P(xx, y + 1, K('wood', 2)); c.P(xx, y + 2, K('wood', 1))
    c.R(0, 27, 16, 3, K('wood', 2)); c.HL(0, 27, 16, K('wood', 3)); c.HL(0, 29, 16, K('wood', 1))
    block_courses(c, 41, 1, 7, [[3, 9, 14]])
    snow_bumps(c, 40, 4, lo=0)
    if kind in ('L', 'R'):
        edge, hi_, mid, inn = (0, 1, 2, 3) if kind == 'L' else (15, 14, 13, 12)
        for y in range(3, 41):
            c.P(edge, y, K('wood', 0)); c.P(hi_, y, K('wood', 3 if y % 5 else 2)); c.P(mid, y, K('wood', 2))
        for y in range(41, 48): c.P(edge, y, K('stone', 1))
        step = 1 if kind == 'L' else -1
        for i in range(6):
            xx = inn + i * step
            c.P(xx, 5 + i, K('wood', 2)); c.P(xx, 6 + i, K('wood', 1))
            c.P(xx, 25 - i, K('wood', 2)); c.P(xx, 26 - i, K('wood', 1))
    if kind == 'W':
        window(c, 3, 9)


def window(c, x0, y0, w=10, h=12):
    c.R(x0, y0, w, h, K('wood', 1))
    c.R(x0 + 1, y0 + 1, w - 2, h - 2, K('fire', 2))
    gx, gy, gw, gh = x0 + 1, y0 + 1, w - 2, h - 2
    # 위가 더 밝은 따뜻한 불빛
    c.R(gx, gy, gw, 3, K('fire', 3)); c.R(gx, gy + 3, gw, 1, K('fire', 2)); c.R(gx, gy + gh - 3, gw, 3, K('fire', 1))
    c.HL(gx, gy, gw, K('fire', 4))
    # 격자 살
    mx = x0 + w // 2
    c.VL(mx - 1, gy, gh, K('wood', 1)); c.VL(mx, gy, gh, K('wood', 1)) if False else None
    c.VL(mx, gy, gh, K('wood', 1))
    for yy in (y0 + 4, y0 + 7):
        c.HL(gx, yy, gw, K('wood', 1))
    # 창 모서리 하이라이트
    for xx, yy in ((gx, gy + 1), (mx + 1, gy + 1)):
        c.P(xx, yy, K('fire', 4))
    # 문설주 윗면 빛, 창턱
    c.HL(x0, y0, w, K('wood', 2))
    c.R(x0 - 1, y0 + h, w + 2, 2, K('wood', 3)); c.HL(x0 - 1, y0 + h + 1, w + 2, K('wood', 1))
    c.HL(x0 - 1, y0 + h - 1 + 0, 0, K('wood', 1))
    c.HL(x0 + 1, y0 + h - 1 + 1 - 1 - 0 + 0, 0, K('snow', 3))
    c.HL(x0, y0 + h - 1 + 0 * 0 + 1 - 1, 0, K('snow', 3))
    c.P(x0 + 1, y0 + h, K('snow', 3)); c.HL(x0 + 5, y0 + h, 3, K('snow', 3)); c.P(x0 + 8, y0 + h, K('snow', 2))


def mk(w, h, fn, *a, **kw):
    t = Cv(w, h); fn(t, *a, **kw); return t


def _reg_wall(id_, name, kind, desc):
    @REG.piece(id_, name, 1, 3, ['C', 'S', 'S'], 'architecture', SP, desc,
               rules='회벽 조각은 가로로 L-M..-R 로 잇는다. 위에는 처마 C 줄, 아래는 눈 덮인 땅.',
               tags=('post', 'wall', 'timber'), role='wall')
    def _f(c):
        d_wall(c, kind)


_reg_wall('wz-post-wall-l', '우체국 벽 왼끝', 'L', '짙은 참나무 기둥이 선 왼쪽 끝 회벽, 밑동은 돌.')
_reg_wall('wz-post-wall-m', '우체국 벽 가운데', 'M', '사선 가새가 든 회벽 가운데 칸.')
_reg_wall('wz-post-wall-r', '우체국 벽 오른끝', 'R', '짙은 참나무 기둥이 선 오른쪽 끝 회벽.')
_reg_wall('wz-post-wall-w', '우체국 창 벽', 'W', '따뜻하게 불 켜진 격자창이 난 회벽 칸.')


@REG.piece('wz-post-plinth', '돌 밑동 줄', 1, 1, ['X'], 'architecture', SP, '눈이 얹힌 낮은 돌 기단 한 줄(반복).',
           tags=('post', 'stone'), role='wall', repeat=True)
def _plinth(c):
    c.R(0, 0, 16, 16, K('stone', 1))
    block_courses(c, 3, 2, 6, [[3, 9, 14], [0, 6, 11]])
    c.R(0, 0, 16, 3, K('snow', 2)); c.HL(0, 0, 16, K('snow', 3)); c.HL(0, 2, 16, K('snow', 1))
    c.HL(0, 15, 16, K('stone', 1))


@REG.piece('wz-post-roof-ridge', '눈 덮인 용마루', 1, 1, ['S'], 'architecture', SP, '슬레이트 지붕 꼭대기, 두툼한 눈 능선(좌우로 잇는다).',
           tags=('post', 'roof'), role='roof', repeat=False)
def _ridge(c): d_ridge(c)


@REG.piece('wz-post-roof-ridge-l', '용마루 왼끝', 1, 1, ['S'], 'architecture', SP, '용마루 왼쪽 끝.', tags=('post', 'roof'), role='roof')
def _ridgel(c): d_ridge(c, 'l')


@REG.piece('wz-post-roof-ridge-r', '용마루 오른끝', 1, 1, ['S'], 'architecture', SP, '용마루 오른쪽 끝.', tags=('post', 'roof'), role='roof')
def _ridger(c): d_ridge(c, 'r')


for _i in (1, 2, 3):
    def _mkslope(i):
        @REG.piece('wz-post-roof-%s' % 'abc'[i - 1], '가파른 슬레이트 지붕 %d' % i, 1, 1, ['S'], 'architecture', SP,
                   '눈이 군데군데 쌓인 슬레이트 지붕 윗면 한 칸(변형 %d).' % i, rules='서로 섞어 가며 위아래·좌우로 반복.',
                   tags=('post', 'roof'), role='roof', repeat=True)
        def _f(c): d_slope(c, None, i)
    _mkslope(_i)


@REG.piece('wz-post-roof-l', '지붕 왼쪽 가장자리', 1, 1, ['S'], 'architecture', SP, '지붕 왼쪽 끝 널.', tags=('post', 'roof'), role='roof')
def _rl(c): d_slope(c, 'l', 2)


@REG.piece('wz-post-roof-r', '지붕 오른쪽 가장자리', 1, 1, ['S'], 'architecture', SP, '지붕 오른쪽 끝 널.', tags=('post', 'roof'), role='roof')
def _rr(c): d_slope(c, 'r', 2)


@REG.piece('wz-post-eave-l', '처마 왼끝', 1, 1, ['C'], 'architecture', SP, '눈이 두껍게 얹힌 처마 왼쪽 끝.', tags=('post', 'roof', 'eave'), role='roof')
def _el(c): d_eave(c, 'l')


@REG.piece('wz-post-eave-m', '처마 가운데', 1, 1, ['C'], 'architecture', SP, '눈이 두껍게 얹힌 처마 가운데(반복).', tags=('post', 'roof', 'eave'), role='roof')
def _em(c): d_eave(c)


@REG.piece('wz-post-eave-r', '처마 오른끝', 1, 1, ['C'], 'architecture', SP, '눈이 두껍게 얹힌 처마 오른쪽 끝.', tags=('post', 'roof', 'eave'), role='roof')
def _er(c): d_eave(c, 'r')


# ───────────────────────── 문·창·간판 ─────────────────────────
def _plaster16(c, y0=0, y1=16):
    c.R(0, y0, 16, y1 - y0, K('linen', 2))
    for x, y, w in ((3, 3, 3), (10, 8, 3), (6, 12, 2)):
        if y0 <= y < y1: c.HL(x, y, w, K('linen', 3))


def _step(c, y):
    c.R(0, y, 16, 3, K('stone', 3)); c.HL(0, y, 16, K('stone', 4)); c.HL(0, y + 2, 16, K('stone', 1))
    c.VL(5, y + 1, 1, K('stone', 2)); c.VL(11, y + 1, 1, K('stone', 2))
    c.HL(1, y - 1, 5, K('snow', 3)); c.HL(11, y - 1, 4, K('snow', 3)); c.HL(2, y, 3, K('snow', 2))


DY0, DY1 = 8, 43   # 문짝 위·아래(36px)


def _door_base(c):
    d_wall(c, 'D')
    c.R(0, 0, 16, 3, K('linen', 1))
    for x in range(0, 16, 2): c.P(x, 3, K('linen', 1))
    icicles(c, ((3, 2), (12, 3)))
    # 문틀: 상인방 y4~6, 설주, 안쪽 어둠
    c.R(1, 4, 14, 41, K('wood', 1))
    c.R(1, 4, 14, 3, K('wood', 2)); c.HL(1, 4, 14, K('wood', 3)); c.HL(1, 6, 14, K('wood', 1))
    c.HL(2, 3, 12, K('snow', 3)); c.P(1, 3, K('snow', 2)); c.P(14, 3, K('snow', 2))
    c.VL(1, 7, 38, K('wood', 2)); c.VL(14, 7, 38, K('wood', 0))


def _leaf(c, x, w):
    y0, y1 = DY0, DY1
    c.R(x, y0, w, y1 - y0 + 1, K('wood', 3))
    for xx in range(x + 2, x + w - 1, 3): c.VL(xx, y0 + 1, y1 - y0 - 1, K('wood', 2))
    c.HL(x, y0, w, K('wood', 4)); c.VL(x, y0, y1 - y0 + 1, K('wood', 4))
    c.VL(x + w - 1, y0, y1 - y0 + 1, K('wood', 1)); c.HL(x, y1, w, K('wood', 1))
    for yy in (24, 35):
        c.HL(x + 1, yy, w - 2, K('wood', 2)); c.HL(x + 1, yy + 1, w - 2, K('wood', 4))


@REG.piece('wz-post-door-closed', '우체국 문(닫힘)', 1, 3, ['C', 'S', 'S'], 'architecture', SP,
           '참나무 판문(36px)과 작은 불빛 유리, 놋 손잡이, 눈 덮인 돌계단. 닫힌 상태.', rules='1×3 벽 칸 사이에 끼운다. 상태 묶음 post-door.',
           tags=('post', 'door'), role='wall', states='post-door')
def _dc(c):
    _door_base(c)
    _leaf(c, 2, 12)
    c.R(4, 11, 8, 8, K('wood', 1)); c.R(5, 12, 6, 6, K('fire', 2)); c.R(5, 12, 6, 2, K('fire', 3)); c.HL(5, 12, 6, K('fire', 4))
    c.R(7, 12, 2, 6, K('wood', 1)); c.HL(5, 15, 6, K('wood', 1)); c.HL(4, 19, 8, K('wood', 2))
    c.R(10, 28, 2, 3, K('brass', 4)); c.P(10, 28, K('brass', 5)); c.P(11, 30, K('brass', 2))
    c.R(2, 13, 2, 2, K('brass', 3)); c.R(2, 37, 2, 2, K('brass', 3))
    _step(c, 45)


@REG.piece('wz-post-door-ajar', '우체국 문(조금 열림)', 1, 3, ['C', 'S', 'f'], 'architecture', SP,
           '문이 안쪽으로 조금 열려 따뜻한 불빛이 새는 상태.', rules='상태 묶음 post-door.', tags=('post', 'door'), role='wall', states='post-door')
def _da(c):
    _door_base(c)
    c.R(2, 7, 12, 38, K('wood', 0))
    c.R(5, DY0, 8, 36, K('fire', 2)); c.R(5, DY0, 8, 10, K('fire', 3)); c.R(6, DY0, 6, 4, K('fire', 4))
    c.R(5, 33, 8, 10, K('fire', 1)); c.R(7, 36, 5, 5, K('fire', 2)); c.HL(5, 18, 8, K('fire', 2))
    c.R(11, 14, 2, 10, K('night', 1)); c.R(5, 41, 8, 2, K('fire', 3))
    _leaf(c, 2, 5)
    c.R(5, 28, 1, 3, K('brass', 4))
    c.R(2, 43, 12, 2, K('wood', 3)); c.HL(2, 43, 12, K('wood', 4))
    _step(c, 45)


@REG.piece('wz-post-door-open', '우체국 문(활짝)', 1, 3, ['C', 'S', 'f'], 'architecture', SP,
           '문짝이 안쪽 벽으로 젖혀져 컴컴한 실내가 보이는 상태. 아래 칸은 지나갈 수 있다.',
           rules='아래 칸 f(바닥 덧그림). 상태 묶음 post-door.', tags=('post', 'door'), role='wall', states='post-door')
def _do(c):
    _door_base(c)
    c.R(2, 7, 12, 38, K('night', 1)); c.R(2, 7, 12, 6, K('night', 0))
    c.R(5, 33, 8, 10, K('night', 0)); c.R(6, 35, 6, 6, K('fire', 1)); c.R(7, 36, 4, 3, K('fire', 2))
    c.R(5, 12, 4, 10, K('night', 0)); c.R(10, 13, 2, 8, K('night', 0))
    c.R(9, 17, 4, 12, K('wood', 0)); c.HL(9, 17, 4, K('wood', 1)); c.VL(12, 17, 12, K('wood', 1))
    c.R(2, DY0, 2, 36, K('wood', 2)); c.VL(2, DY0, 36, K('wood', 3))
    c.R(2, 43, 12, 2, K('wood', 3)); c.HL(2, 43, 12, K('wood', 4))
    _step(c, 45)


def _bgwall(c, h):
    c.R(0, 0, 16, h, K('linen', 2))
    c.HL(3, 3, 3, K('linen', 3)); c.HL(10, h - 4, 3, K('linen', 3))


@REG.piece('wz-post-window', '우체국 격자창', 1, 1, ['S'], 'architecture', SP,
           '따뜻하게 불 켜진 격자창. 눈이 앉은 창턱.', rules='wall-w 와 같은 벽 줄에 쓴다.', tags=('post', 'window'), role='wall')
def _win(c):
    _bgwall(c, 16)
    window(c, 3, 1, 10, 12)
    c.R(0, 14, 16, 2, K('stone', 2)); c.HL(0, 14, 16, K('stone', 3)); c.HL(0, 15, 16, K('stone', 1))


@REG.piece('wz-post-bay', '우체국 퇴창', 2, 1, ['SS'], 'architecture', SP,
           '밖으로 튀어나온 2칸 퇴창. 불 켜진 유리 세 장과 눈 덮인 작은 슬레이트 지붕.', tags=('post', 'window'), role='wall')
def _bay(c):
    c.R(0, 0, 32, 16, K('linen', 2))
    # 작은 지붕
    c.R(2, 0, 28, 4, K('slate', 2)); c.HL(2, 0, 28, K('snow', 3)); c.HL(1, 1, 30, K('snow', 2)); c.HL(2, 2, 28, K('slate', 3))
    c.HL(2, 3, 28, K('slate', 1))
    for x in range(3, 29, 4): c.P(x, 2, K('slate', 1))
    c.R(1, 4, 30, 1, K('wood', 0))
    # 창틀 + 유리
    c.R(1, 4, 30, 10, K('wood', 1)); c.HL(1, 4, 30, K('wood', 2))
    for i, x in enumerate((3, 12, 21)):
        c.R(x, 5, 8, 7, K('fire', 2)); c.R(x, 5, 8, 3, K('fire', 3)); c.HL(x, 5, 8, K('fire', 4)); c.VL(x + 4, 5, 7, K('wood', 1))
        c.P(x + 1, 6, K('fire', 4)); c.P(x + 5, 6, K('fire', 4))
    c.R(0, 13, 32, 3, K('wood', 3)); c.HL(0, 13, 32, K('wood', 4)); c.HL(0, 15, 32, K('wood', 1))
    c.HL(2, 12, 6, K('snow', 3)); c.HL(14, 12, 4, K('snow', 3)); c.HL(23, 12, 6, K('snow', 3))
    c.HL(1, 14, 3, K('snow', 3))
    c.outline()


def _owl(c, x, y):
    """8x8 부엉이 얼굴(정면)."""
    c.R(x + 1, y + 1, 6, 6, K('wood', 4)); c.R(x + 2, y, 4, 1, K('wood', 3)); c.R(x + 1, y + 6, 6, 1, K('wood', 3))
    c.P(x + 1, y, K('wood', 2)); c.P(x + 6, y, K('wood', 2))
    c.R(x + 1, y + 2, 2, 2, K('linen', 4)); c.R(x + 5, y + 2, 2, 2, K('linen', 4))
    c.P(x + 2, y + 3, K('ink', 0)); c.P(x + 5, y + 3, K('ink', 0))
    c.P(x + 3, y + 4, K('brass', 4)); c.P(x + 4, y + 4, K('brass', 4)); c.P(x + 3, y + 5, K('wood', 5)); c.P(x + 4, y + 5, K('wood', 5))
    c.P(x + 2, y + 6, K('wood', 5)); c.P(x + 5, y + 6, K('wood', 5))


def _env(c, x, y):
    """9x6 봉투(봉인)."""
    c.R(x, y, 9, 6, K('linen', 4)); c.HL(x, y, 9, K('linen', 4))
    c.HL(x, y + 5, 9, K('linen', 2)); c.VL(x + 8, y, 6, K('linen', 2))
    c.line(x, y, x + 4, y + 3, K('linen', 2)); c.line(x + 8, y, x + 4, y + 3, K('linen', 2))
    c.R(x + 3, y + 3, 3, 3, K('red', 3)); c.P(x + 4, y + 4, K('red', 4)); c.P(x + 3, y + 3, K('red', 4))
    c.outline_rect(x - 1, y - 1, 11, 8, K('wood', 0)) if False else None


@REG.piece('wz-post-sign', '부엉이 우체국 간판', 2, 1, ['CC'], 'architecture', SP,
           '쇠 팔걸이에 사슬로 매단 간판. 부엉이와 봉투 그림(글자 없음).', rules='벽 앞에 걸린다. 처마 아래 높이.', tags=('post', 'sign'), role='prop')
def _sign(c):
    # 팔걸이
    c.R(0, 0, 3, 3, K('iron', 2)); c.HL(0, 0, 3, K('iron', 3))
    c.R(0, 1, 32, 1, K('iron', 1)); c.HL(3, 0, 29, K('iron', 3))
    c.VL(31, 0, 4, K('iron', 1)); c.line(2, 4, 8, 1, K('iron', 1))
    for x in (6, 25):
        c.VL(x, 2, 3, K('iron', 3)); c.P(x, 4, K('iron', 1))
    # 판
    c.R(3, 5, 26, 10, K('wood', 3)); c.HL(3, 5, 26, K('wood', 4)); c.HL(3, 14, 26, K('wood', 1))
    c.VL(3, 5, 10, K('wood', 4)); c.VL(28, 5, 10, K('wood', 1))
    c.R(5, 6, 22, 8, K('linen', 2)); c.HL(5, 6, 22, K('linen', 3)); c.HL(5, 13, 22, K('linen', 1))
    _owl(c, 6, 6); _env(c, 17, 7)
    c.VL(16, 7, 5, K('wood', 2))
    c.outline()


# ───────────── 배치 4: 야외 비품 ─────────────

@REG.piece('wz-post-slot', '우체국 편지 투입구', 1, 1, ['S'], 'architecture', SP,
           '회벽에 박은 놋쇠 판과 가로 투입구. 문 옆 벽에 붙인다.', tags=('post', 'mail'), role='prop')
def _slot(c):
    _plaster16(c)
    c.R(0, 0, 16, 2, K('linen', 1)); c.HL(0, 2, 16, K('linen', 1))
    c.R(2, 3, 12, 10, K('brass', 3)); c.HL(2, 3, 12, K('brass', 5)); c.VL(2, 3, 10, K('brass', 4))
    c.VL(13, 3, 10, K('brass', 2)); c.HL(2, 12, 12, K('brass', 2))
    c.R(4, 6, 8, 3, K('ink', 0)); c.HL(4, 6, 8, K('night', 0)) if False else None
    c.HL(4, 9, 8, K('brass', 5))
    for x, y in ((3, 4), (12, 4), (3, 11), (12, 11)): c.P(x, y, K('brass', 1))
    c.HL(4, 4, 3, K('brass', 5))
    c.R(0, 14, 16, 2, K('wood', 2)); c.HL(0, 14, 16, K('wood', 3))
    c.outline_rect(2, 3, 12, 10, K('brass', 0))
    c.HL(4, 13, 8, K('linen', 1)) if False else None


@REG.piece('wz-post-mailbox', '눈 쌓인 우체통', 1, 2, ['S', 'S'], 'furniture', SP,
           '둥근 지붕 붉은 기둥 우체통. 놋쇠 투입구, 머리에 눈이 얹혔다.', rules='골목 가장자리·문 옆에 선다.', tags=('post', 'mail'), role='prop')
def _mailbox(c):
    # 몸통 x3..12, y7..27
    for y in range(8, 28):
        for x in range(3, 13):
            t = 4 if x == 3 else 3 if x < 7 else 2 if x < 11 else 1
            c.P(x, y, K('red', t))
    # 둥근 지붕
    c.HL(4, 6, 8, K('red', 3)); c.HL(5, 5, 6, K('red', 3)); c.P(4, 6, K('red', 4)); c.P(5, 5, K('red', 4))
    c.HL(3, 7, 10, K('red', 3)); c.P(3, 7, K('red', 4)); c.P(12, 7, K('red', 1)); c.P(11, 6, K('red', 2)); c.P(10, 5, K('red', 2))
    # 머리 눈
    c.HL(6, 3, 4, K('snow', 3)); c.HL(4, 4, 8, K('snow', 3)); c.HL(4, 4, 2, K('snow', 4)); c.HL(3, 5, 2, K('snow', 3)); c.HL(11, 5, 2, K('snow', 2))
    c.HL(5, 5, 5, K('snow', 2)) if False else None
    c.P(3, 6, K('snow', 2)); c.P(12, 6, K('snow', 2)); c.HL(6, 5, 4, K('snow', 3))
    # 투입구
    c.R(4, 11, 8, 4, K('brass', 3)); c.HL(4, 11, 8, K('brass', 5)); c.HL(4, 14, 8, K('brass', 2))
    c.R(5, 12, 6, 2, K('ink', 0))
    # 놋쇠 띠 + 부엉이 문양 판
    c.HL(3, 18, 10, K('brass', 3)); c.HL(3, 19, 10, K('brass', 2))
    c.R(6, 21, 4, 4, K('brass', 3)); c.P(6, 21, K('brass', 5)); c.P(7, 22, K('ink', 0)); c.P(8, 22, K('ink', 0)); c.P(7, 24, K('brass', 2)); c.P(8, 24, K('brass', 2))
    # 돌 받침
    c.R(2, 28, 12, 3, K('stone', 3)); c.HL(2, 28, 12, K('stone', 4)); c.HL(2, 30, 12, K('stone', 1)); c.VL(8, 29, 1, K('stone', 1))
    c.HL(1, 27, 4, K('snow', 3)); c.HL(11, 27, 4, K('snow', 3)); c.HL(2, 28, 2, K('snow', 2)); c.HL(11, 28, 3, K('snow', 2))
    c.outline()


@REG.piece('wz-post-lamp', '눈 덮인 가로등', 1, 3, ['C', 'C', 'S'], 'furniture', SP,
           '쇠 기둥 위 유리 등. 따뜻한 불빛이 등 안에서 밝게 보이고 머리에 눈이 쌓였다.', rules='골목 가에 세운다. 윗부분은 사람 위로 겹친다.',
           tags=('post', 'lamp', 'light'), role='prop')
def _lamp(c):
    # 눈 얹은 지붕
    c.HL(7, 2, 2, K('snow', 4)); c.HL(5, 3, 6, K('snow', 3)); c.HL(4, 4, 8, K('snow', 3)); c.HL(4, 4, 3, K('snow', 4))
    c.HL(4, 5, 8, K('iron', 2)); c.HL(3, 6, 10, K('iron', 1)); c.HL(4, 5, 2, K('iron', 3))
    # 등(유리)
    c.R(4, 7, 8, 11, K('iron', 1))
    c.R(5, 8, 6, 9, K('fire', 2))
    c.R(5, 8, 6, 3, K('fire', 3)); c.R(6, 9, 4, 5, K('fire', 3)); c.R(7, 10, 2, 3, K('fire', 4)); c.HL(5, 16, 6, K('fire', 1))
    c.VL(8, 8, 9, K('iron', 1)) if False else None
    c.HL(3, 18, 10, K('iron', 2)); c.HL(4, 19, 8, K('iron', 1)); c.HL(3, 18, 3, K('iron', 3))
    # 기둥
    for y in range(20, 42):
        c.P(7, y, K('iron', 3)); c.P(8, y, K('iron', 2)); c.P(9, y, K('iron', 1))
    # 장식 마디
    c.R(6, 24, 4, 2, K('iron', 2)); c.HL(6, 24, 4, K('iron', 3))
    c.R(6, 34, 4, 2, K('iron', 2)); c.HL(6, 34, 4, K('iron', 3))
    # 받침
    c.R(5, 40, 6, 3, K('iron', 2)); c.HL(5, 40, 6, K('iron', 3)); c.HL(5, 42, 6, K('iron', 1))
    c.R(3, 43, 10, 4, K('stone', 3)); c.HL(3, 43, 10, K('stone', 4)); c.HL(3, 46, 10, K('stone', 1)); c.VL(8, 44, 2, K('stone', 1))
    c.HL(2, 42, 4, K('snow', 3)); c.HL(11, 42, 3, K('snow', 3)); c.HL(3, 43, 2, K('snow', 2)); c.HL(11, 43, 2, K('snow', 2))
    c.outline()


@REG.piece('wz-post-barrel', '눈 얹은 통', 1, 1, ['S'], 'furniture', SP,
           '쇠 테를 두른 나무 통. 뚜껑 위에 눈이 쌓였다.', tags=('post', 'barrel'), role='prop')
def _barrel(c):
    c.ellipse(8, 5, 6, 3, K('wood', 3))
    for y in range(6, 15):
        bulge = 1 if 8 <= y <= 11 else 0
        for x in range(2 - bulge, 14 + bulge):
            f = (x - (2 - bulge)) / (12 + 2 * bulge)
            c.P(x, y, K('wood', 4 if f < 0.2 else 3 if f < 0.55 else 2 if f < 0.85 else 1))
    c.HL(2, 8, 12, K('iron', 2)); c.HL(1, 9, 14, K('iron', 1)); c.HL(1, 12, 14, K('iron', 2)); c.HL(2, 13, 12, K('iron', 1))
    c.HL(2, 8, 3, K('iron', 3)); c.HL(1, 12, 3, K('iron', 3))
    # 눈 덮인 뚜껑
    c.ellipse(8, 5, 5, 2, K('snow', 3)); c.ellipse(7, 4, 3, 1, K('snow', 4))
    c.HL(3, 7, 3, K('snow', 3)); c.HL(11, 7, 2, K('snow', 2)); c.HL(4, 8, 2, K('snow', 2)) if False else None
    c.HL(3, 15, 10, K('wood', 1))
    c.outline()


@REG.piece('wz-post-crate', '눈 얹은 나무 상자', 1, 1, ['S'], 'furniture', SP,
           '널을 댄 나무 상자. 윗면에 눈이 쌓였다.', tags=('post', 'crate'), role='prop')
def _crate(c):
    c.R(1, 3, 14, 12, K('wood', 3))
    c.R(2, 8, 12, 6, K('wood', 3)); c.R(1, 8, 14, 7, K('wood', 3))
    # 앞면 널·테두리
    c.VL(1, 8, 7, K('wood', 4)); c.VL(14, 8, 7, K('wood', 1))
    c.HL(1, 8, 14, K('wood', 4)); c.HL(1, 14, 14, K('wood', 1))
    c.HL(2, 11, 12, K('wood', 2))
    c.line(2, 9, 13, 13, K('wood', 2)); c.line(3, 9, 13, 12, K('wood', 2)) if False else None
    for x, y in ((2, 9), (13, 9), (2, 13), (13, 13)): c.P(x, y, K('iron', 2))
    # 눈 얹은 윗면
    c.R(1, 3, 14, 5, K('snow', 3)); c.HL(1, 3, 14, K('snow', 4)); c.HL(3, 2, 8, K('snow', 3)); c.HL(4, 2, 4, K('snow', 4))
    c.HL(1, 7, 14, K('snow', 2)); c.HL(1, 7, 3, K('wood', 4)) if False else None
    c.HL(10, 7, 2, K('snow', 3)); c.HL(3, 8, 2, K('snow', 2)); c.HL(11, 8, 3, K('snow', 2))
    c.outline()


# ───────────── 배치 5: 굴뚝·박공·조립 키트 ─────────────
@REG.piece('wz-post-chimney', '눈 얹은 굴뚝', 1, 2, ['S', 'S'], 'architecture', SP,
           '지붕 위로 솟은 돌 굴뚝. 꼭대기에 눈이 쌓이고 밑에 눈더미가 기댄다.',
           rules='지붕 경사 칸 위에 겹쳐 놓는다(옆은 투명).', tags=('post', 'chimney', 'roof'), role='roof')
def _chimney(c):
    t = Cv(16, 32)
    # 벽돌 몸통: 4px 단, 켜마다 이음매가 엇갈린다
    for y in range(7, 28):
        r = (y - 7) % 4
        off = 0 if ((y - 7) // 4) % 2 == 0 else 3
        for x in range(2, 14):
            tier = 0 if r == 3 else 2
            if r != 3 and (x - 2 - off) % 6 == 0: tier = 0
            elif r == 0: tier = 3
            t.P(x, y, K('red', tier))
    t.VL(2, 7, 21, K('red', 3)); t.VL(13, 7, 21, K('red', 1))
    # 윗단 돌 받침과 연기 구멍
    t.R(1, 4, 14, 3, K('stone', 3)); t.HL(1, 4, 14, K('stone', 5)); t.HL(1, 6, 14, K('stone', 1))
    t.R(4, 3, 8, 2, K('ink', 0))
    t.HL(2, 2, 12, K('snow', 3)); t.HL(3, 1, 10, K('snow', 4)); t.HL(5, 0, 6, K('snow', 3))
    t.HL(1, 3, 3, K('snow', 2)); t.HL(12, 3, 3, K('snow', 2))
    # 밑에 기댄 눈더미
    snow_clump(t, 3, 26, 10); t.HL(1, 29, 14, K('snow', 3)); t.HL(2, 30, 12, K('snow', 2)); t.HL(4, 31, 8, K('snow', 1))
    t.outline()
    c.blit(t, 0, 0)


@REG.piece('wz-post-gable', '박공 정면', 3, 2, ['SSS', 'SSS'], 'architecture', SP,
           '앞쪽을 향한 삼각 박공: 회벽 + 참나무 보와 기둥, 불 켜진 다락창, 눈 덮인 슬레이트 박공널.',
           rules='가로 3칸. 아래에 회벽 L-M-R 한 줄(3칸 높이)을 붙인다.', tags=('post', 'gable', 'roof'), role='roof')
def _gable(c):
    W, H = 48, 32
    t = Cv(W, H)
    ye = [int(2 + abs(x - 23.5) * 1.05) for x in range(W)]
    for x in range(W):
        y = ye[x]
        if y > H - 1: continue
        # 눈 2줄 + 슬레이트 3줄 + 그늘 1줄
        t.P(x, y, K('snow', 3)); 
        if y + 1 < H: t.P(x, y + 1, K('snow', 2) if (x // 3) % 2 else K('snow', 3))
        for k, tier in ((2, 2), (3, 2), (4, 1)):
            if y + k < H: t.P(x, y + k, K('slate', tier))
        if y + 5 < H: t.P(x, y + 5, K('slate', 0))
        for yy in range(y + 6, H):
            t.P(x, yy, K('linen', 2))
    # 슬레이트 널 이음
    for x in range(W):
        y = ye[x]
        if x % 6 == 0 and y + 3 < H: t.P(x, y + 3, K('slate', 1)); t.P(x, y + 2, K('slate', 1))
    # 눈 마루(꼭대기 덩이)
    t.HL(21, 0, 6, K('snow', 3)); t.HL(20, 1, 8, K('snow', 3))
    # 회벽 결
    for x, y, w in ((8, 25, 3), (32, 22, 3), (16, 28, 4), (36, 28, 3), (28, 26, 2)):
        if t.opaque(x, y): t.HL(x, y, w, K('linen', 3))
    # 보와 기둥 (참나무)
    t.R(5, 24, 38, 3, K('wood', 2)); t.HL(5, 24, 38, K('wood', 4)); t.HL(5, 26, 38, K('wood', 1))
    t.line(10, 23, 18, 16, K('wood', 2)); t.line(11, 23, 18, 17, K('wood', 1))
    t.line(37, 23, 29, 16, K('wood', 2)); t.line(36, 23, 29, 17, K('wood', 1))
    # 다락창 하나: 용마루 밑 가운데, 사선에서 2px 이상 안쪽
    t.R(19, 15, 10, 9, K('wood', 2)); t.HL(19, 15, 10, K('wood', 4)); t.HL(19, 23, 10, K('wood', 1))
    t.R(20, 16, 8, 7, K('fire', 2)); t.R(20, 16, 8, 3, K('fire', 3)); t.HL(21, 16, 6, K('fire', 4))
    t.P(20, 16, K('wood', 2)); t.P(27, 16, K('wood', 2))
    t.R(23, 16, 2, 7, K('wood', 2)); t.HL(20, 19, 8, K('wood', 2))
    # 보 밑 그림자 + 처마 눈
    t.HL(5, 27, 38, K('linen', 1))
    for x in range(W):
        if t.opaque(x, 27) is False: pass
    t.outline()
    c.blit(t, 0, 0)


def assemble(c, placements):
    """등록한 조각들을 (id, 칸x, 칸y) 로 이어 붙여 한 장으로 만든다."""
    from wzlib import render_piece
    for pid, x, y in placements:
        c.blit(render_piece(REG.pieces[pid]), x * 16, y * 16)


def kit_walk(w, h, placements):
    g = [['.'] * w for _ in range(h)]
    for pid, x, y in placements:
        p = REG.pieces[pid]
        for j, row in enumerate(p['walk']):
            for i, ch in enumerate(row):
                if ch == '.': continue
                cur = g[y + j][x + i]
                if cur == '.' or ch == 'S': g[y + j][x + i] = ch
    return [''.join(r) for r in g]


def _reg_kit(id_, name, w, h, pl, desc, rules, top=()):
    """pl 을 조립한 뒤 지붕·처마(위 4줄)는 왼쪽 반을 오른쪽에 거울로 — 눈 덩이까지 좌우 대칭. top(굴뚝)은 그 위에."""
    top = list(top)
    walk = kit_walk(w, h, pl + top)
    @REG.piece(id_, name, w, h, walk, 'architecture', SP, desc, rules=rules, tags=('post', 'kit', 'building'), role='building')
    def _f(c):
        assemble(c, pl)
        W = w * 16
        for y in range(64):
            for x in range(W // 2):
                c.P(W - 1 - x, y, c.get(x, y))
        assemble(c, top)


ROOF5 = [('wz-post-roof-ridge-l', 0, 0)] + [('wz-post-roof-ridge', i, 0) for i in (1, 2, 3)] + [('wz-post-roof-ridge-r', 4, 0)] \
    + [('wz-post-roof-l', 0, 1), ('wz-post-roof-a', 1, 1), ('wz-post-roof-b', 2, 1), ('wz-post-roof-a', 3, 1), ('wz-post-roof-r', 4, 1)] \
    + [('wz-post-roof-l', 0, 2), ('wz-post-roof-c', 1, 2), ('wz-post-roof-b', 2, 2), ('wz-post-roof-c', 3, 2), ('wz-post-roof-r', 4, 2)] \
    + [('wz-post-eave-l', 0, 3), ('wz-post-eave-m', 1, 3), ('wz-post-eave-m', 2, 3), ('wz-post-eave-m', 3, 3), ('wz-post-eave-r', 4, 3)]
OFFICE = ROOF5 + [('wz-post-wall-l', 0, 4), ('wz-post-wall-w', 1, 4), ('wz-post-door-closed', 2, 4), ('wz-post-wall-w', 3, 4),
                  ('wz-post-wall-r', 4, 4)]
_reg_kit('wz-post-kit-office', '부엉이 우체국 건물(5칸)', 5, 7, OFFICE,
         '눈 덮인 슬레이트 지붕, 용마루 가운데 굴뚝, 격자창 둘과 문(1×3)이 난 5칸 폭 우체국 정면 완성형. 좌우 대칭.',
         '남향 정면. 출입문은 가운데. 간판(wz-post-sign)은 처마 아래 벽 앞에 따로 얹는다.',
         top=[('wz-post-chimney', 2, 0)])

HOUSE = [('wz-post-roof-ridge-l', 0, 0), ('wz-post-roof-ridge', 1, 0), ('wz-post-roof-ridge-r', 2, 0)] \
    + [('wz-post-roof-l', 0, 1), ('wz-post-roof-b', 1, 1), ('wz-post-roof-r', 2, 1)] \
    + [('wz-post-roof-l', 0, 2), ('wz-post-roof-a', 1, 2), ('wz-post-roof-r', 2, 2)] \
    + [('wz-post-eave-l', 0, 3), ('wz-post-eave-m', 1, 3), ('wz-post-eave-r', 2, 3)] \
    + [('wz-post-wall-l', 0, 4), ('wz-post-door-closed', 1, 4), ('wz-post-wall-r', 2, 4)]
_reg_kit('wz-post-kit-house', '눈 덮인 작은 집(3칸)', 3, 7, HOUSE,
         '슬레이트 지붕, 용마루 가운데 굴뚝, 가운데 문(1×3)이 있는 3칸 폭 작은 집 완성형. 좌우 대칭.',
         '키트 조각으로 직접 지을 때 폭을 3~7칸까지 늘린다. 벽 L-M..-R(1×3), 문 하나.',
         top=[('wz-post-chimney', 1, 0)])


# ───────────── 배치 6: 우체국 안 ─────────────
def _letter(c, x, y, wax=True):
    """5x3 봉투(앞면). 밀랍 점 하나."""
    c.R(x, y, 5, 3, K('linen', 3)); c.HL(x, y, 5, K('linen', 4)); c.HL(x, y + 2, 5, K('linen', 2))
    c.P(x + 4, y, K('linen', 2))
    if wax: c.P(x + 2, y + 1, K('red', 2))


@REG.piece('wz-post-sort', '편지 분류 선반', 3, 2, ['CCC', 'SSS'], 'furniture', SP,
           '칸칸이 나뉜 참나무 분류 선반. 칸마다 편지가 꽂혀 있다.', rules='우체국 안쪽 벽 앞.', tags=('post', 'rack'), role='prop')
def _sort(c):
    c.box(0, 1, 48, 31, 8, 'wood', 3)
    # 윗면 앞 모서리 아래 얕은 처마
    c.HL(1, 9, 46, K('wood', 1))
    # 비둘기집 칸: 6열 x 3행
    for r in range(3):
        for k in range(6):
            x = 3 + k * 7; y = 11 + r * 6
            c.R(x, y, 6, 5, K('wood', 0))
            c.HL(x, y, 6, K('ink', 0))
            c.R(x, y + 1, 6, 4, K('wood', 1))
            c.VL(x + 5, y + 1, 4, K('wood', 0))
    # 칸막이 윗 모서리 하이라이트
    for r in range(3):
        c.HL(2, 10 + r * 6, 44, K('wood', 4)) if r else None
    # 꽂힌 편지(칸 안쪽 아래 걸침)
    fill = {(0, 0): 1, (0, 2): 1, (0, 4): 1, (1, 1): 1, (1, 2): 1, (1, 5): 1, (2, 0): 1, (2, 3): 1, (2, 4): 1, (0, 5): 1}
    for (r, k), _ in fill.items():
        x = 3 + k * 7; y = 11 + r * 6
        c.R(x + 1, y + 2, 4, 3, K('linen', 3)); c.HL(x + 1, y + 2, 4, K('linen', 4)); c.HL(x + 1, y + 4, 4, K('linen', 2))
        if (r + k) % 2 == 0: c.P(x + 3, y + 3, K('red', 2))
    # 라벨 못(놋)
    for k in range(6): c.P(5 + k * 7, 10, K('brass', 3))
    c.HL(2, 29, 44, K('wood', 2)); c.HL(1, 30, 46, K('wood', 1))
    # 윗면 위 소품: 편지 몇 장
    _letter(c, 6, 3); _letter(c, 31, 2, False); c.P(40, 4, K('linen', 3))
    c.outline_rect(0, 1, 48, 31, K('wood', 0))
    c.outline()


@REG.piece('wz-post-letters', '밀봉 편지 더미', 1, 1, ['f'], 'furniture', SP,
           '바닥에 쌓인 밀랍 봉인 편지 더미.', rules='바닥 위에 겹쳐 놓는다(투명 바닥).', tags=('post', 'letters'), role='prop')
def _letters(c):
    t = Cv(16, 16)
    for (x, y, w) in ((2, 8, 8), (6, 9, 8), (4, 5, 8), (7, 6, 7)):
        t.R(x, y, w, 5, K('linen', 3)); t.HL(x, y, w, K('linen', 4)); t.HL(x, y + 4, w, K('linen', 2)); t.VL(x + w - 1, y, 5, K('linen', 2))
    t.line(4, 5, 8, 7, K('linen', 2)); t.line(11, 5, 8, 7, K('linen', 2)) if False else None
    t.P(7, 12, K('red', 2)); t.P(10, 11, K('red', 2)); t.P(5, 8, K('red', 2)); t.P(11, 8, K('red', 1))
    t.HL(3, 14, 11, K('wood', 1)) if False else None
    t.outline()
    c.blit(t, 0, 0)


def _hang_sack(cx, top, bot, rx, tag):
    t = Cv(32, 32)
    t.R(cx - 2, top, 5, 2, K('stone', 4)); t.P(cx - 2, top, K('stone', 5)); t.P(cx + 2, top + 1, K('stone', 3))
    t.HL(cx - 1, top + 2, 3, K('wood', 2)); t.P(cx + 2, top + 3, K('wood', 2))     # 목을 조인 끈과 늘어진 끝
    n = bot - top - 3
    for y in range(top + 3, bot + 1):
        k = (y - top - 3) / max(1, n)
        r = 1 + (rx - 1) * min(1.0, k * 2.6)
        if y >= bot - 1: r -= 1 + (y - (bot - 1))
        x0, x1 = int(cx - r), int(cx + r)
        for x in range(x0, x1 + 1):
            f = (x - x0) / max(1, x1 - x0)
            t.P(x, y, K('stone', 5 if f < 0.22 else 4 if f < 0.68 else 3))
    # 2단 주름
    t.VL(cx - 1, top + 7, n - 7, K('stone', 3)); t.VL(cx - 2, top + 8, n - 9, K('stone', 5))
    t.VL(cx + 2, top + 9, n - 10, K('stone', 2))
    t.HL(cx - 2, bot - 3, 4, K('stone', 3))
    if tag == 'seal':
        t.R(cx - 1, top + 9, 3, 2, K('red', 2)); t.P(cx - 1, top + 9, K('red', 3))
    else:
        t.R(cx - 2, top + 8, 4, 3, K('linen', 4)); t.HL(cx - 2, top + 10, 4, K('linen', 2)); t.P(cx, top + 9, K('red', 2))
    t.outline(K('stone', 2))
    return t


@REG.piece('wz-post-sack', '배달 자루 걸이', 2, 2, ['CC', 'SS'], 'furniture', SP,
           '다리 둘과 가로 걸이대(윗면이 보인다)로 된 나무 걸이에, 목을 끈으로 조인 린넨 배달 자루 두 개가 따로 매달려 있다.',
           rules='카운터 옆.', tags=('post', 'sack'), role='prop')
def _sack(c):
    t = Cv(32, 32)
    for px in (2, 27):
        t.R(px, 8, 3, 21, K('wood', 3)); t.VL(px, 8, 21, K('wood', 4)); t.VL(px + 2, 8, 21, K('wood', 1))
        t.R(px - 1, 28, 5, 3, K('wood', 2)); t.HL(px - 1, 28, 5, K('wood', 4)); t.HL(px - 1, 30, 5, K('wood', 1))
    t.R(1, 5, 30, 3, K('wood', 4)); t.HL(2, 5, 28, K('wood', 5))           # 걸이대 윗면 3px
    t.R(1, 8, 30, 2, K('wood', 3)); t.HL(1, 9, 30, K('wood', 2)); t.HL(1, 10, 30, K('wood', 1))
    t.clear(1, 5); t.clear(30, 5)
    t.outline()
    for px in (10, 21):
        t.P(px, 9, K('brass', 4)); t.P(px, 10, K('brass', 2))
    t.blit(_hang_sack(10, 11, 26, 4, 'tag'), 0, 0)
    t.blit(_hang_sack(21, 11, 27, 4, 'seal'), 0, 0)
    c.blit(t, 0, 0)


@REG.piece('wz-post-perch', '부엉이 횃대', 1, 2, ['S', 'S'], 'furniture', SP,
           '좌우 끝까지 뻗은 둥근 가로대(가죽 감개 둘, 발톱 자국), 가운데 기둥, 깃털과 배설물이 떨어진 받이 쟁반.',
           rules='배달용 부엉이 자리.', tags=('post', 'perch'), role='prop')
def _perch(c):
    t = Cv(16, 32)
    # 받이 쟁반: 윗면(테두리+안쪽 톱밥) 3px, 앞면 3px
    t.R(1, 23, 14, 3, K('wood', 4)); t.R(2, 24, 12, 2, K('linen', 1)); t.HL(2, 24, 12, K('wood', 2))
    t.R(1, 26, 14, 3, K('wood', 3)); t.HL(1, 28, 14, K('wood', 1)); t.VL(14, 26, 3, K('wood', 2))
    for x, y in ((4, 25), (11, 25)): t.P(x, y, K('snow', 3))
    for x, y in ((6, 25), (9, 25)): t.P(x, y, K('stone', 3))
    t.P(2, 25, K('linen', 4)); t.P(3, 25, K('linen', 4)); t.P(13, 25, K('linen', 4)); t.P(12, 25, K('linen', 4))
    # 기둥과 받침
    t.R(6, 10, 4, 14, K('wood', 3)); t.VL(6, 10, 14, K('wood', 4)); t.VL(9, 10, 14, K('wood', 1))
    t.R(5, 22, 6, 2, K('wood', 2)); t.HL(5, 22, 6, K('wood', 4))
    # 둥근 가로대: 위 밝게 → 아래 어둡게
    for y, tier in ((5, 4), (6, 5), (7, 3), (8, 2), (9, 1)):
        t.HL(1, y, 14, K('wood', tier))
    t.clear(1, 5); t.clear(14, 5); t.clear(1, 9); t.clear(14, 9)
    for x in (1, 14): t.VL(x, 6, 3, K('brass', 3 if x == 1 else 2))
    for x0 in (3, 11):      # 가죽 감개
        for y in range(5, 10):
            t.P(x0, y, K('red', 2 if y % 2 else 3)); t.P(x0 + 1, y, K('red', 3 if y % 2 else 2))
    for x in (6, 9): t.P(x, 8, K('wood', 1))      # 발톱 자국
    t.outline()
    c.blit(t, 0, 0)


@REG.piece('wz-post-counter', '우체국 카운터', 3, 2, ['SSS', 'SSS'], 'furniture', SP,
           '놋 종, 장부, 잉크병과 깃펜이 놓인 긴 참나무 카운터.', rules='창구. 앞면이 아래로 보인다.', tags=('post', 'counter'), role='prop')
def _counter(c):
    c.box(0, 5, 48, 26, 10, 'wood', 3)
    # 앞면 판재 칸
    for x in range(0, 48, 12):
        c.VL(x + 1, 16, 14, K('wood', 1))
        c.R(x + 3, 18, 8, 10, K('wood', 2)); c.HL(x + 3, 18, 8, K('wood', 3)); c.VL(x + 3, 18, 10, K('wood', 3)); c.HL(x + 3, 27, 8, K('wood', 1))
    c.HL(1, 29, 46, K('wood', 1)); c.HL(1, 30, 46, K('ink', 0))
    # 윗면 결
    c.HL(2, 8, 20, K('wood', 4)); c.HL(26, 11, 14, K('wood', 4)); c.HL(6, 13, 10, K('wood', 3))
    # 놋 종
    c.R(6, 6, 6, 4, K('brass', 3)); c.R(7, 5, 4, 1, K('brass', 4)); c.HL(5, 10, 8, K('brass', 1)); c.VL(6, 6, 4, K('brass', 4)); c.VL(11, 6, 4, K('brass', 2)); c.P(8, 4, K('brass', 4))
    # 펼친 장부
    c.R(19, 6, 11, 6, K('linen', 3)); c.VL(24, 6, 6, K('linen', 1)); c.HL(19, 6, 11, K('linen', 4)); c.HL(19, 11, 11, K('linen', 2))
    c.HL(20, 8, 3, K('ink', 2)); c.HL(26, 8, 3, K('ink', 2)); c.HL(20, 10, 3, K('ink', 2)); c.HL(26, 9, 3, K('ink', 2))
    c.outline_rect(19, 6, 11, 6, K('linen', 1))
    # 잉크병·깃펜
    c.R(37, 8, 4, 3, K('ink', 1)); c.HL(37, 8, 4, K('violet', 2)); c.P(38, 7, K('wood', 1))
    c.line(40, 7, 44, 2, K('linen', 3)); c.P(44, 2, K('linen', 4)); c.P(43, 3, K('linen', 2))
    c.outline_rect(0, 5, 48, 26, K('wood', 0))
    c.outline()


@REG.piece('wz-post-parcel', '소포 더미', 1, 1, ['S'], 'furniture', SP,
           '갈색 포장지에 끈을 맨 소포 두 개.', rules='바닥에 둔다.', tags=('post', 'parcel'), role='prop')
def _parcel(c):
    c.box(1, 7, 14, 8, 3, 'dirt', 3)
    c.VL(7, 7, 8, K('wood', 2)); c.VL(8, 7, 8, K('wood', 1)); c.HL(1, 10, 14, K('wood', 2)) if False else None
    c.R(3, 2, 10, 6, K('dirt', 3)); c.HL(3, 2, 10, K('dirt', 5)); c.VL(3, 2, 6, K('dirt', 5)); c.VL(12, 2, 6, K('dirt', 1)); c.HL(3, 7, 10, K('dirt', 1))
    c.VL(7, 2, 5, K('wood', 2)); c.HL(3, 4, 10, K('wood', 2)); c.P(8, 3, K('red', 2))
    c.outline_rect(3, 2, 10, 6, K('dirt', 0))
    c.outline()


@REG.piece('wz-post-parcels', '소포 무더기', 2, 1, ['SS'], 'furniture', SP,
           '크고 작은 소포와 자루가 쌓인 무더기.', rules='카운터 뒤 바닥.', tags=('post', 'parcel'), role='prop')
def _parcels(c):
    c.box(1, 7, 15, 8, 3, 'dirt', 3)
    c.VL(8, 7, 8, K('wood', 2)); c.HL(1, 11, 15, K('wood', 1)) if False else None
    c.box(18, 8, 13, 7, 3, 'dirt', 2)
    c.HL(18, 11, 13, K('wood', 2)); c.VL(24, 8, 7, K('wood', 2))
    c.box(5, 1, 11, 7, 3, 'dirt', 3)
    c.VL(10, 1, 7, K('wood', 2)); c.P(11, 3, K('red', 2))
    c.outline()
    # 작은 자루
    c.ellipse(25, 6, 4, 2, K('dirt', 4)); c.R(21, 6, 9, 2, K('dirt', 4)); c.HL(21, 8, 9, K('dirt', 3)); c.P(25, 4, K('wood', 2)); c.HL(23, 5, 4, K('wood', 1))
    c.outline()


# 실내 목재 벽
def _wall_planks(t, y0, y1, seed=0):
    for x in range(0, 16, 4):
        tier = 3 if (x // 4 + seed) % 2 == 0 else 2
        t.R(x, y0, 4, y1 - y0, K('wood', tier)); t.VL(x, y0, y1 - y0, K('wood', 1)); t.VL(x + 1, y0, y1 - y0, K('wood', tier + 1))
    t.P(6, y0 + 9, K('wood', 1)); t.P(13, y0 + 20, K('wood', 1))


@REG.piece('wz-post-iwall', '우체국 목재 뒷벽(1x4)', 1, 4, ['X', 'X', 'X', 'X'], 'architecture', SP,
           '널판 벽: 위 갓보, 세로 널, 가운데 가로 보, 아래 웨인스코트.', rules='가로로 반복해 뒷벽을 이룬다.', tags=('post', 'wall', 'interior'), role='wall', repeat=True)
def _iwall(c):
    # 윗면(천장 보 윗부분이 아니라 벽 위 마감)
    c.R(0, 0, 16, 8, K('wood', 1)); c.HL(0, 0, 16, K('wood', 2)); c.HL(0, 7, 16, K('wood', 0)); c.HL(0, 1, 16, K('wood', 3))
    c.R(0, 3, 16, 3, K('wood', 2)); c.HL(0, 3, 16, K('wood', 3))
    _wall_planks(c, 8, 38)
    # 가로 보
    c.R(0, 36, 16, 4, K('wood', 2)); c.HL(0, 36, 16, K('wood', 4)); c.HL(0, 39, 16, K('wood', 0)); c.HL(0, 38, 16, K('wood', 1))
    # 아래 웨인스코트
    c.R(0, 40, 16, 24, K('wood', 2))
    for x in (0, 8):
        c.R(x + 1, 43, 6, 15, K('wood', 1)); c.HL(x + 1, 43, 6, K('wood', 0)); c.VL(x + 1, 43, 15, K('wood', 0)); c.HL(x + 1, 57, 6, K('wood', 3)); c.VL(x + 6, 44, 14, K('wood', 3))
    c.HL(0, 40, 16, K('wood', 3)); c.HL(0, 60, 16, K('wood', 3)); c.R(0, 61, 16, 3, K('wood', 1)); c.HL(0, 63, 16, K('wood', 0)); c.HL(0, 61, 16, K('wood', 2))


@REG.piece('wz-post-ibeam', '목재 기둥 벽(1x1)', 1, 1, ['X'], 'architecture', SP,
           '실내 옆벽용 통나무 기둥 면. 쇠띠가 둘러졌다.', rules='실내 좌우 가장자리 벽.', tags=('post', 'wall', 'interior'), role='wall', repeat=True)
def _ibeam(c):
    c.R(0, 0, 16, 16, K('wood', 2))
    c.R(2, 0, 12, 16, K('wood', 3)); c.VL(2, 0, 16, K('wood', 4)); c.VL(3, 0, 16, K('wood', 4)); c.VL(12, 0, 16, K('wood', 2)); c.VL(13, 0, 16, K('wood', 1))
    c.VL(0, 0, 16, K('wood', 0)); c.VL(15, 0, 16, K('wood', 0)); c.VL(1, 0, 16, K('wood', 1)); c.VL(14, 0, 16, K('wood', 1))
    c.P(7, 4, K('wood', 2)); c.P(8, 5, K('wood', 2)); c.P(6, 11, K('wood', 2)); c.P(8, 12, K('wood', 2))
    for y in (3, 12):
        c.HL(2, y, 12, K('iron', 1)); c.HL(2, y + 1, 12, K('iron', 2)); c.P(3, y, K('iron', 3)); c.P(12, y, K('iron', 3))


@REG.piece('wz-post-iwall-win', '목재 벽 격자창(1x2)', 1, 2, ['X', 'X'], 'architecture', SP,
           '널판 벽에 난 작은 격자창. 불빛이 새어 든다.', rules='뒷벽 사이에 끼워 넣는다.', tags=('post', 'wall', 'window', 'interior'), role='wall')
def _iwin(c):
    c.R(0, 0, 16, 32, K('wood', 2))
    _wall_planks(c, 0, 32, 1)
    c.R(3, 6, 10, 15, K('wood', 1)); c.HL(3, 6, 10, K('wood', 4)); c.HL(3, 20, 10, K('wood', 0))
    c.R(4, 7, 8, 13, K('fire', 2)); c.R(5, 8, 6, 4, K('fire', 3)); c.P(5, 8, K('fire', 4)); c.P(6, 8, K('fire', 4))
    c.VL(7, 7, 13, K('wood', 2)); c.VL(8, 7, 13, K('wood', 1)); c.HL(4, 13, 8, K('wood', 2)); c.HL(4, 14, 8, K('wood', 1))
    c.R(2, 20, 12, 2, K('wood', 3)); c.HL(2, 20, 12, K('wood', 4)); c.HL(2, 21, 12, K('wood', 0))


# ───────────── 배치 7: 예제 ─────────────
def _ex_street():
    P = []
    # 바닥: 눈 위에 조약돌 골목(가로 두 줄 + 우체국 앞 세로)
    for x in range(0, 18):
        for y in (10, 11):
            P.append(('wz-post-snowcobble', x, y))
    # 눈 변주
    for x, y, s in [(2, 12, 'b'), (5, 13, 'a'), (11, 12, 'b'), (15, 13, 'a'), (14, 1, 'b'), (3, 1, 'a'), (9, 1, 'b')]:
        P.append(('wz-post-snow-' + s, x, y))
    P += [('wz-post-print-a', 8, 10), ('wz-post-print-b', 9, 11), ('wz-post-print-a', 4, 11),
          ('wz-post-puddle', 13, 11), ('wz-post-threshold', 8, 9)]
    # 건물(뒤 -> 앞)
    P += [('wz-post-kit-house', 1, 3), ('wz-post-kit-house', 14, 3), ('wz-post-kit-office', 6, 2)]
    P += [('wz-post-sign', 9, 5)]
    # 소품
    P += [('wz-post-lamp', 5, 6), ('wz-post-lamp', 12, 7), ('wz-post-mailbox', 4, 7),
          ('wz-post-barrel', 11, 8), ('wz-post-crate', 17, 8), ('wz-post-barrel', 0, 9)]
    return P


def _ex_inside():
    P = []
    for x in range(12):
        P.append(('wz-post-iwall', x, 0))
    for x in (3, 8):
        P.append(('wz-post-iwall-win', x, 1))
    for y in range(4, 9):
        P += [('wz-post-ibeam', 0, y), ('wz-post-ibeam', 11, y)]
    P += [('wz-post-sort', 1, 4), ('wz-post-perch', 6, 4), ('wz-post-sort', 8, 4),
          ('wz-post-counter', 4, 6), ('wz-post-sack', 9, 6), ('wz-post-parcels', 1, 7),
          ('wz-post-parcel', 3, 8), ('wz-post-letters', 5, 8), ('wz-post-letters', 7, 5)]
    return P


REG.example('wz-post-example-street', '눈 덮인 우체국 골목', 'postoffice', 18, 14, 'wz-post-snow-a', _ex_street(),
            '눈 쌓인 조약돌 골목에 부엉이 우체국, 작은 집 둘, 가로등, 우체통, 통과 상자를 놓은 정면 거리.')
REG.example('wz-post-example-inside', '우체국 안', 'postoffice', 12, 9, 'wz-post-floor', _ex_inside(),
            '분류 선반, 부엉이 횃대, 계산대, 짐 자루와 소포를 갖춘 우체국 내부.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)

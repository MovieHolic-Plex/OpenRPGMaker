# 비행선 정박 부두 — 앵커 1: 계류 탑 · 정박한 화물 비행선 · 소형 비행정 · 기낭 걸이(예비 기낭).
# 비행선은 기수가 서쪽(계류 탑 쪽)을 향한다. 기낭 = 바랜 아마포(canvas) 세로 결(둘레 띠 24px), 놋쇠 기수 덮개, 꼬리 날개.
from ad_props import *

# ---------------------------------------------------------------- 계류 탑 (3x9)
def mooring_mast():
    W, H = 48, 144
    tc = TC(W, H, 401)
    # 받침: 리벳 강철 상자(윗면 + 앞면)
    box(tc, 1, 124, 47, 143, 6, 'steel', base=3, seed=2)
    panels(tc, 1, 130, 47, 143, 'steel', base=3, pw=16, ph=13, seed=3)
    tc.hline(1, 47, 143, 'steel', 1)
    # 격자 탑: 두 다리가 위로 좁아진다
    def leg(x0, x1, k):
        for y in range(26, 126):
            t = (126 - y) / 100.0; x = x0 + (x1 - x0) * t
            tc.px(round(x), y, 'steel', k); tc.px(round(x) + 1, y, 'steel', k - 2)
    leg(6, 16, 5); leg(40, 30, 4)
    def lx(y, side):
        t = (126 - y) / 100.0
        return (6 + 10 * t) if side == 0 else (41 - 10 * t)
    for yb in range(30, 126, 16):                                         # 가로 들보 + X 버팀
        tc.hline(round(lx(yb, 0)) + 1, round(lx(yb, 1)), yb, 'steel', 3)
        y2 = min(125, yb + 16)
        tc.line(lx(yb, 0) + 1, yb, lx(y2, 1), y2, 'steel', 3)
        tc.line(lx(yb, 1), yb, lx(y2, 0) + 1, y2, 'steel', 2)
    for y in range(28, 125):                                              # 가운데 사다리
        tc.px(21, y, 'steel', 5); tc.px(26, y, 'steel', 3)
        if y % 4 == 0: tc.hline(22, 26, y, 'steel', 4)
    # 작업대(놋쇠 난간 두른 둥근 판, 윗면 보임)
    tc.ell(24, 24, 18, 4.6, 'steel', lambda x, y: 5 if y < 24 else 3)
    tc.ell(24, 23, 16, 3.4, 'plank', lambda x, y: 5 if x < 20 else 4)
    for x in range(7, 42, 4):
        tc.vline(x, 15, 24, 'brass', 4 if x < 24 else 3)
    tc.hline(7, 42, 15, 'brass', 6); tc.hline(7, 42, 16, 'brass', 3)
    tc.hline(6, 43, 28, 'steel', 2)
    # 계류 원뿔(동쪽을 향한 놋쇠 컵) + 축
    for i in range(18):
        x = 24 + i; r = 2.2 + i * .28
        for d in range(-int(r), int(r) + 1):
            y = 10 + d
            k = 6 if d < -r * .3 else (5 if d < r * .2 else 3)
            if i > 14: k = 2 if d > 0 else 4                                # 컵 안쪽 그늘
            tc.px(x, y, 'brass', k)
    tc.rect(20, 6, 26, 15, 'steel', 4); tc.vline(20, 6, 15, 'steel', 5)
    amber_lamp(tc, 23, 3)
    rope(tc, 42, 14, 46, 40, 3, 3)                                        # 늘어진 계류 밧줄 끝
    return out(tc, sh=(24, 143, 22, 3))

# ---------------------------------------------------------------- 비행선 몸 공용
def _prof(u):
    """기낭 옆모습 반지름(0..1): 기수(서) 뭉툭한 둥근 끝, 가운데 곧은 몸, 꼬리(동)로 길게 좁아진다."""
    if u < .3:
        q = u / .3; return max(.1, (1 - (1 - q) ** 2.2) ** (1 / 2.2))
    if u < .62: return 1.0
    q = (u - .62) / .38; return max(.1, 1 - q ** 1.6 * .82)
def envelope(tc, x0, x1, cy, ry, mat='canvas', nose='brass', patches=(), seed=0, band=24):
    """시가 모양 기낭(기수 서쪽): 세로로는 위 밝고 아래 어둡게(6..2), 둘레 띠 band px 마다, 길이 방향 이음 줄 둘."""
    L = x1 - x0
    for x in range(x0, x1):
        u = (x - x0 + .5) / L
        prof = _prof(u)
        r = ry * prof
        for y in range(int(cy - r), int(cy + r) + 1):
            t = (y + .5 - (cy - r)) / max(1, 2 * r)
            k = 6 if t < .14 else (5 if t < .36 else (4 if t < .6 else (3 if t < .82 else 2)))
            if x < x0 + 3: k = min(k + 1, 6)
            m = mat
            for (p0, p1, q0, q1) in patches:
                if p0 <= x < p1 and q0 <= t < q1: m = 'ochre'
            tc.px(x, y, m, k)
        if (x - x0) % band == band // 2 and .06 < u < .9:                 # 둘레 띠
            for y in range(int(cy - r) + 1, int(cy + r)): tc.shift(x, y, -1)
        for tl in (.3, .7):                                                # 길이 방향 이음 줄
            y = round(cy - r + 2 * r * tl)
            if hash2(x // 3, int(tl * 10), seed) < .8: tc.shift(x, y, -1)
    # 기수 덮개(놋쇠)
    for x in range(x0, x0 + 5):
        u = (x - x0 + .5) / L
        r = ry * _prof(u)
        for y in range(int(cy - r), int(cy + r) + 1):
            tc.px(x, y, nose, 6 if y < cy - r * .3 else (5 if y < cy + r * .3 else 3))

def tail_fins(tc, xt, cy, ry, mat='ochre'):
    """꼬리 날개 셋(위·아래·옆) — 동쪽 끝."""
    tc.poly([(xt - 22, cy - ry * .5), (xt - 2, cy - ry * 1.15), (xt + 2, cy - ry * 1.1), (xt - 2, cy - ry * .3)], mat,
            lambda x, y: 5 if x < xt - 8 else 4)
    tc.poly([(xt - 22, cy + ry * .5), (xt - 2, cy + ry * 1.05), (xt + 2, cy + ry), (xt - 2, cy + ry * .3)], mat,
            lambda x, y: 3)
    tc.poly([(xt - 18, cy - 1), (xt + 4, cy - 3), (xt + 4, cy + 3), (xt - 18, cy + 2)], mat, lambda x, y: 4 if y < cy else 3)
    for y in range(int(cy - ry * 1.1), int(cy + ry)): tc.shift(xt - 10, y, -1)

def propeller(tc, cx, cy, r=7):
    """돌아가는 프로펠러(옆에서 본 원판 흐림 = 옅은 줄 넷 + 놋쇠 축)."""
    for y in range(int(cy - r), int(cy + r) + 1):
        if abs(y - cy) % 3 == 0: tc.px(cx, y, 'steel', 4, 170); tc.px(cx + 1, y, 'steel', 2, 140)
    tc.vline(cx, int(cy - r), int(cy - r) + 3, 'wood', 5); tc.vline(cx, int(cy + r) - 2, int(cy + r) + 1, 'wood', 3)
    tc.ell(cx + 1, cy, 1.8, 1.8, 'brass', 6)

def gondola(tc, x0, x1, y0, y1, seed=0):
    """곤돌라 선실: 나무 앞벽(가로 널) + 놋쇠 테 + 둥근 창 줄 + 지붕 윗면 + 용골."""
    box(tc, x0, y0, x1, y1, 3, 'wood', base=4, seed=seed)
    for y in range(y0 + 3, y1 - 1):
        if (y - y0) % 3 == 2:
            for x in range(x0 + 1, x1 - 1): tc.shift(x, y, -1)
    tc.hline(x0, x1, y0 + 3, 'brass', 6); tc.hline(x0, x1, y1 - 3, 'brass', 4)
    for x in range(x0 + 6, x1 - 6, 9):                                     # 둥근 창(유리 + 놋쇠 테)
        cy = (y0 + y1) // 2
        tc.ell(x + 2, cy, 3.2, 3.0, 'brass', lambda xx, yy: 6 if xx < x + 2 else 3)
        tc.ell(x + 2, cy, 2.0, 1.9, 'glass', lambda xx, yy: 6 if (xx < x + 2 and yy < cy) else 4)
    # 용골(뾰족한 배 밑)
    tc.poly([(x0 + 4, y1), (x1 - 2, y1), (x1 - 10, y1 + 4), (x0 + 12, y1 + 4)], 'wood', lambda x, y: 2)

def airship_moored():
    W, H = 192, 112
    tc = TC(W, H, 411)
    cy, ry = 34, 26
    tail_fins(tc, 186, cy, ry)
    envelope(tc, 4, 184, cy, ry, patches=((120, 134, .5, .8),), seed=3)
    # 기낭 아래 매단 줄(밧줄 대각)
    for (xa, xb) in ((46, 62), (70, 70), (96, 84), (110, 122), (130, 132)):
        rope(tc, xa, cy + ry - 3, xb, 78, 0, 3)
    gondola(tc, 56, 136, 78, 98, seed=5)
    # 곤돌라 뒤 엔진 받침 + 프로펠러 둘
    tc.rect(136, 84, 150, 88, 'steel', 3); tc.hline(136, 150, 84, 'steel', 5)
    pipe_h(tc, 140, 156, 86, 6, 'rust', flange=False)
    propeller(tc, 158, 86, 9)
    tc.rect(30, 52, 46, 55, 'steel', 3)                                    # 앞쪽 계류 들보(기수 아래)
    rope(tc, 6, 34, 0, 44, 2, 3)                                           # 기수 계류 밧줄(탑 원뿔 쪽)
    rope(tc, 60, 98, 58, 111, 0, 3)                                        # 내려 늘어진 밧줄
    tc.px(95, 101, 'amber', 6); tc.px(96, 101, 'amber', 4)                 # 곤돌라 밑 등
    return out(tc)

def airship_skiff():
    W, H = 112, 64
    tc = TC(W, H, 421)
    cy, ry = 20, 15
    tail_fins(tc, 106, cy, ry, 'paint')
    envelope(tc, 4, 104, cy, ry, mat='ochre', nose='steel', patches=(), seed=5, band=16)
    for (xa, xb) in ((30, 36), (52, 52), (74, 68)):
        rope(tc, xa, cy + ry - 2, xb, 44, 0, 3)
    # 열린 나무 배 곤돌라(뱃전 윗면 + 앞면)
    tc.poly([(28, 44), (82, 44), (76, 56), (36, 56)], 'wood', lambda x, y: 4 if y > 47 else 6)
    for y in range(47, 56, 3):
        for x in range(30, 80): tc.shift(x, y, -1)
    tc.hline(28, 82, 44, 'brass', 6); tc.hline(29, 81, 45, 'wood', 2)
    tc.rect(46, 39, 56, 44, 'steel', 3); tc.hline(46, 56, 39, 'steel', 5)        # 조종 기관
    propeller(tc, 86, 48, 6)
    rope(tc, 8, cy, 0, 30, 1.5, 3)
    return out(tc)

# ---------------------------------------------------------------- 기낭 걸이 (6x5)
def gasbag_cradle():
    W, H = 96, 80
    tc = TC(W, H, 431)
    tc.ell(48, 70, 42, 7, 'canvas', lambda x, y: 4 if y < 70 else 3)      # 땅에 깐 천막 깔개
    def aframe(cx):
        for y in range(8, 77):
            t = (y - 8) / 69.0
            for s, k in ((-1, 5), (1, 3)):
                x = cx + s * (1 + t * 9)
                tc.px(round(x), y, 'steel', k); tc.px(round(x) + 1, y, 'steel', k - 2)
        for yb in (30, 52): tc.hline(round(cx - 1 - (yb - 8) / 69 * 9), round(cx + 2 + (yb - 8) / 69 * 9), yb, 'steel', 3)
        tc.rect(cx - 12, 76, cx + 14, 80, 'stone', 4); tc.hline(cx - 12, cx + 14, 76, 'stone', 6)
    aframe(10); aframe(85)
    for x in range(6, 91):                                                 # 윗 들보(리벳 강철)
        tc.px(x, 7, 'steel', 6); tc.px(x, 8, 'steel', 4); tc.px(x, 9, 'steel', 4); tc.px(x, 10, 'steel', 2)
        if x % 6 == 2: tc.px(x, 8, 'steel', 6)
    # 반쯤 바람 빠진 예비 기낭: 둥근 두 끝 + 가운데가 처진 몸 + 세로 주름
    for x in range(14, 84):
        u = (x - 14) / 70.0
        e = min(1.0, (1 - abs(2 * u - 1) ** 2.4) ** (1 / 2.4) * 1.15)
        cy = 36 + 3 * math.sin(math.pi * u)                                 # 가운데가 처진다
        r = 17 * e
        top = cy - r * .95 + 2.5 * math.sin(math.pi * u) ** 2; bot = cy + r
        for y in range(int(top), int(bot) + 1):
            t = (y - top) / max(1, bot - top)
            k = 6 if t < .16 else (5 if t < .4 else (4 if t < .7 else (3 if t < .9 else 2)))
            if int(x + math.sin(y * .25) * 2.5) % 9 == 0 and .1 < t < .95: k -= 1      # 늘어진 주름
            tc.px(x, y, 'ochre' if (40 <= x < 50 and .45 < t < .8) else 'canvas', clamp(k))
    for xa in (20, 36, 52, 68, 80):                                        # 걸이 밧줄
        rope(tc, xa, 10, xa + 1, 20 + (abs(xa - 48) // 8), 0, 4)
    for y in range(12, 74, 4): tc.hline(88, 92, y, 'wood', 4)              # 오른쪽 다리 사다리 칸
    tc.vline(88, 12, 74, 'wood', 5); tc.vline(92, 12, 74, 'wood', 3)
    return out(tc, sh=(48, 78, 40, 3))

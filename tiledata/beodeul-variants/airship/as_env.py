# 비행선 기낭(위에서 비스듬히 본 둥근 캔버스 천 덩이) — 꼬리(지느러미) · 몸통(이어 붙임) · 몸통 덧댄 판 · 코.
# 한 기낭을 길이 방향 함수 env_px 로 그리고 조각으로 자른다: 몸통은 128px 주기라 몇 번이든 이어 붙인다.
# 박음질: 길이 방향 천 폭(고어) 이음 일곱 줄이 위·아래 윤곽 쪽으로 몰리고(원통이라), 몸통에는 64px 마다 둘레 이음.
# 아래 1/5 은 삼 밧줄 그물과 짐 띠, 바닥 윤곽에 32px 마다 놋쇠 고리(매다는 줄 자리).
from as_kit import *
from as_kit import _hash

ENV_H = 160; ECY = 80.5; ER = 74.0
TAIL = 128; NOSE = 96; BODY = 128

def env_r(xg, L):
    """xg = 기낭 꼬리 끝에서 잰 px, L = 전체 길이. 반지름(화면 세로 반높이)."""
    TL = 120.0; NL = 78.0
    if xg < TL:
        u = (TL - xg) / TL
        return ER * max(0.0, 1 - u ** 1.7) ** .58
    if xg > L - NL:
        u = (xg - (L - NL)) / NL
        return ER * max(0.0, 1 - u ** 2.4) ** .5
    return ER

def env_tone(xg, y, L, body_x=None):
    """기낭 한 화소의 색(없으면 None)."""
    r = env_r(xg + .5, L)
    if r < 1.5: return None
    top = ECY - r; yy = y + .5
    if abs(yy - ECY) > r: return None
    v = (yy - top) / (2 * r)
    if v < .035: k = 4
    elif v < .2: k = 6 if not (v > .17 and (xg + y) % 2) else 5
    elif v < .42: k = 5 if not (v > .39 and (xg + y) % 2) else 4
    elif v < .6: k = 4 if not (v > .57 and (xg + y) % 2) else 3
    elif v < .78: k = 3
    elif v < .92: k = 2
    else: k = 1
    TL = 120.0; NL = 78.0
    if xg < 60 and v < .55 and _hash(xg, y, 905) < (60 - xg) / 60.0: k = min(6, k + 1)   # 꼬리 끝(서쪽)은 빛을 받는다(디더로 번짐)
    if xg > L - NL:                                                                 # 코(동쪽)는 그늘로 돈다
        u = (xg - (L - NL)) / NL
        k -= int(u * 1.8 + (.5 if (xg + y) % 2 else 0))
    if yy > ECY + r - 1.2: k = 0
    c = CNV[clamp(k, 0, 6)]
    # 길이 방향 이음(고어) — 원통이라 위·아래로 갈수록 촘촘
    for i in range(1, 8):
        vi = .5 - .5 * math.cos(math.pi * i / 8)
        ys = top + vi * 2 * r
        if int(ys) == y:
            st = (xg % 4) in (0, 1)
            c = CNV[clamp(k - (2 if st else 1), 1, 6)]
            break
        if int(ys) - 1 == y and v < .5: c = CNV[clamp(k + 1, 1, 6)]                   # 겹친 천 자락이 빛을 받는다
    # 둘레 이음(몸통만): 64px 마다, 가운데가 불룩한 곡선
    bx = body_x if body_x is not None else xg
    if body_x is not None or (TL < xg < L - NL):
        xr = (bx + int(round(5.0 * math.sin(math.pi * v)))) % 64
        if xr == 40:
            c = CNV[clamp(k - (2 if y % 3 == 0 else 1), 1, 6)]
        elif xr == 39 and v < .6: c = CNV[clamp(k + 1, 1, 6)]
    # 짐 띠 + 그물(아래 1/5)
    if .79 <= v < .83:
        c = ROPE[4] if v < .805 else ROPE[2]
    elif v >= .83 and k > 0:
        nx = (xg if body_x is None else bx)
        if (nx + int(yy * 1.6)) % 16 == 0 or (nx - int(yy * 1.6)) % 16 == 0:
            c = ROPE[3] if v < .9 else ROPE[2]
    if c in CNV and k > 1:
        if _hash(xg, y, 901) < .012: c = CNV[clamp(k - 1, 1, 6)]                     # 천 결(드문 점)
    return c

PADX = 16
def _paint(W, x_of, L, body=False, patch=None):
    """좌우로 PADX 씩 더 그린 캔버스(이음매에 윤곽이 생기지 않게, 마지막에 crop_pad 로 자른다). 좌표는 조각 기준 x."""
    cv = Cv(W + 2 * PADX, ENV_H)
    for y in range(ENV_H):
        for x in range(-PADX, W + PADX):
            xg = x_of(x)
            if xg < 0: continue
            c = env_tone(xg, y, L, body_x=((x % BODY) if body else None))
            if c is None: continue
            if patch and patch(x, y): c = mix(c, (196, 168, 116), .22)
            cv.px(x + PADX, y, c)
    return cv
def crop_pad(im, W): return im.crop((PADX, 0, PADX + W, ENV_H))

def _rings(cv, x_of, L, xs):
    """바닥 윤곽 아래 놋쇠 고리(매다는 줄 걸이). cv 는 PADX 만큼 밀린 캔버스."""
    for x in xs:
        r = env_r(x_of(x) + .5, L)
        yb = int(ECY + r)
        for (dx, dy, k) in ((-1, 0, 5), (0, 0, 6), (1, 0, 4), (-2, 1, 4), (2, 1, 2), (-1, 2, 3), (0, 2, 2), (1, 2, 2), (-2, 2, 3)):
            if 0 <= yb + dy < ENV_H: cv.px(x + dx + PADX, yb + dy, BR[k])

def envelope_body(seed=0):
    """기낭 몸통 8×10(128x160): 몇 개든 가로로 이어 붙인다."""
    cv = _paint(BODY, lambda x: 400 + x, 2000, body=True)
    _rings(cv, lambda x: 400 + x, 2000, (16, 48, 80, 112))
    return crop_pad(fin(cv, .7), BODY)

def envelope_body_patched(seed=0):
    """기낭 몸통 변형: 덧대어 꿰맨 천 조각 둘(누런 새 천, 굵은 박음질 테)."""
    PATCHES = ((22, 56, 38, 68), (80, 96, 92, 106))
    def patch(x, y):
        for (x0, y0, x1, y1) in PATCHES:
            if x0 <= x < x1 and y0 <= y < y1 and not ((x in (x0, x1 - 1)) and (y in (y0, y1 - 1))): return True
        return False
    cv = _paint(BODY, lambda x: 400 + x, 2000, body=True, patch=patch)
    for (x0, y0, x1, y1) in PATCHES:                                               # 굵은 박음질 테
        for x in range(x0, x1):
            for y in (y0, y1 - 1):
                if x % 3 != 2 and patch(x, y): cv.px(x + PADX, y, CNV[2])
        for y in range(y0, y1):
            for x in (x0, x1 - 1):
                if y % 3 != 2 and patch(x, y): cv.px(x + PADX, y, CNV[2])
    _rings(cv, lambda x: 400 + x, 2000, (16, 48, 80, 112))
    return crop_pad(fin(cv, .7), BODY)

def _fin_poly(cv, pts, rib_dir='v', red_edge=None, seed=0):
    """캔버스 지느러미: 다각형 안을 천으로, 나무 살(10px 간격)과 붉은 끝 띠."""
    m = Mk(cv.w, cv.h).poly(pts)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    for y in range(cv.h):
        for x in range(cv.w):
            if not m.at(x, y): continue
            k = 5 if x < (min(xs) + max(xs)) / 2 else 4
            if not m.at(x, y - 1): k = 6
            if not m.at(x, y + 1) or not m.at(x + 1, y): k = 3
            c = CNV[k]
            if rib_dir == 'v' and x % 13 == 5: c = WD[4] if k > 4 else WD[3]
            if rib_dir == 'h' and y % 8 == 4: c = WD[4] if k > 4 else WD[3]
            if red_edge and red_edge(x, y): c = RD[4] if k > 4 else RD[2]
            cv.px(x, y, c)

def envelope_tail(seed=0):
    """기낭 꼬리 8×10(128x160): 서쪽으로 가늘어지는 끝 + 위로 선 꼬리 지느러미(나무 살, 붉은 뒷전) + 남쪽(앞)으로 뻗은 수평 지느러미."""
    L = 2000; xo = lambda x: x
    cv = Cv(TAIL + 2 * PADX, ENV_H)
    P = lambda pts: [(x + PADX, y) for (x, y) in pts]
    _fin_poly(cv, P([(10, 60), (12, 8), (30, 5), (80, 26), (80, 44)]), 'v', red_edge=lambda x, y: x < 17 + PADX or y < 9)
    env = _paint(TAIL, xo, L)
    cv.im.alpha_composite(env.im)
    # 수평 지느러미(남쪽 = 화면 아래로 비스듬히 보이는 윗면): 뿌리가 길고 끝이 짧은 뒤로 젖힌 날개꼴
    _fin_poly(cv, P([(22, 110), (98, 117), (46, 154), (8, 152)]), 'v', red_edge=lambda x, y: x < 16 + PADX or y > 150)
    for x in range(22, 98):                                                         # 뿌리 쪽 놋쇠 띠
        y = int(110 + (x - 22) * 7 / 76.0)
        cv.px(x + PADX, y, BR[5]); cv.px(x + PADX, y + 1, BR[3])
    _rings(cv, xo, L, (100, 120))
    return crop_pad(fin(cv, .7), TAIL)

def envelope_nose(seed=0):
    """기낭 코 6×10(96x160): 동쪽으로 둥글게 닫히는 끝, 놋쇠 코 덮개와 계류 고리."""
    L = 2000; base = L - NOSE
    xo = lambda x: base + x
    cv = _paint(NOSE, xo, L)
    # 놋쇠 코 덮개: 끝 9px 안
    for y in range(ENV_H):
        for x in range(NOSE):
            xg = base + x
            r = env_r(xg + .5, L)
            if r < 1.5 or abs(y + .5 - ECY) > r: continue
            if xg > L - 12:
                dy = (y + .5 - ECY) / max(1.0, r)
                k = 6 if dy < -.4 else (5 if dy < 0 else (3 if dy < .5 else 2))
                if xg > L - 4: k -= 1
                cv.px(x + PADX, y, BR[clamp(k, 1, 6)])
            elif xg > L - 15:
                cv.px(x + PADX, y, BR[2])
    for (dx, dy, k) in ((0, -2, 5), (1, -2, 4), (2, -1, 3), (2, 0, 3), (2, 1, 2), (1, 2, 2), (0, 2, 2)):   # 계류 고리
        cv.px(NOSE - 3 + dx - 2 + PADX, int(ECY) + dy, BR[k])
    _rings(cv, xo, L, (16, 48))
    return crop_pad(fin(cv, .7), NOSE)

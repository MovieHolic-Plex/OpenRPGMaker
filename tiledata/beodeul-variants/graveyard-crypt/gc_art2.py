# 공동묘지 조각 2: 고목·가로등·울타리·철문·묘지 입구·땅
from gc_kit import *
from gc_kit import _hash, _pn1
from gc_art1 import moss

BARK = [WD[0], mix(WD[1], ST[1], .5), mix(WD[2], ST[2], .4), mix(WD[3], ST[3], .4), mix(WD[4], ST[3], .3), mix(WD[5], ST[4], .3), WD[6]]
BARK = [(27, 16, 36), (46, 36, 38), (70, 56, 52), (98, 80, 66), (128, 104, 80), (158, 128, 96), (184, 154, 118)]

def line(cv, x0, y0, x1, y1, w0, w1, ramp=BARK, seed=0):
    """굵기가 줄어드는 가지. 왼쪽 밝고 오른쪽 어둡다."""
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; w = w0 + (w1 - w0) * f
        for dx in range(-int(w // 2) - 1, int(w // 2) + 2):
            if abs(dx) > w / 2 + .01: continue
            t = dx / max(.5, w / 2)
            k = 4 if t < -.4 else (3 if t < .3 else 2)
            if _hash(int(x) + dx, int(y), seed) < .12: k -= 1
            cv.px(int(round(x)) + dx, int(round(y)), ramp[k])

def dead_tree(seed=1, big=False):
    """잎 없는 고목 2x3 (32x48). 밑동은 아랫줄 두 칸에 걸치고 위 칸은 가지(걷기+가림)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(20, 47):
        f = (y - 20) / 26.0
        wd = 2.6 + 4.6 * f * f + (1.6 if y > 42 else 0) + (.8 if y % 6 == 0 else 0)
        c0 = 16 + math.sin(y * .35) * 1.2
        for x in range(int(c0 - wd), int(c0 + wd) + 1):
            t = (x + .5 - c0) / wd
            k = 4 if t < -.5 else (3 if t < .1 else (2 if t < .6 else 1))
            if _hash(x, y, seed) < .13: k += 1 if _hash(y, x, 2) < .5 else -1
            if abs(t) < .2 and y % 5 == 1: k -= 1
            cv.px(x, y, BARK[clamp(k, 0, 6)])
    line(cv, 15, 24, 8, 16, 4, 2, seed=seed); line(cv, 8, 16, 3, 7, 2.5, 1, seed=seed); line(cv, 8, 16, 11, 6, 2.5, 1, seed=seed)
    line(cv, 5, 11, 1, 10, 2, 1, seed=seed); line(cv, 11, 8, 8, 2, 2, 1, seed=seed)
    line(cv, 17, 22, 24, 14, 4, 2, seed=seed); line(cv, 24, 14, 30, 8, 2.5, 1, seed=seed); line(cv, 24, 14, 22, 5, 2.5, 1, seed=seed)
    line(cv, 27, 11, 31, 14, 2, 1, seed=seed); line(cv, 22, 8, 26, 2, 2, 1, seed=seed)
    line(cv, 16, 22, 16, 10, 3.5, 1.5, seed=seed); line(cv, 16, 12, 14, 3, 2, 1, seed=seed); line(cv, 16, 14, 19, 5, 2, 1, seed=seed)
    line(cv, 12, 34, 3, 30, 3, 1, seed=seed)
    for (x, y) in ((14, 34), (15, 34), (14, 35), (15, 35), (14, 36)): cv.px(x, y, BARK[0])
    cv.px(13, 34, BARK[5])
    return shadow_under(fin(cv, .7), 16, 46, 10, 2, 80)

def dead_tree_small(seed=2):
    """작은 고목(그루터기+가지) 1x2: 밑동 한 칸이 막힌다."""
    cv = Cv(16, 32)
    for y in range(18, 31):
        wd = 3 + int((y - 18) * .22)
        for x in range(8 - wd, 8 + wd):
            t = (x + .5 - 8) / wd; k = 4 if t < -.4 else (3 if t < .2 else 2)
            if _hash(x, y, seed) < .14: k += 1 if _hash(y, x, 2) < .5 else -1
            cv.px(x, y, BARK[clamp(k, 0, 6)])
    line(cv, 8, 20, 3, 13, 3, 1, seed=seed); line(cv, 8, 19, 12, 10, 3, 1, seed=seed); line(cv, 12, 10, 14, 4, 2, 1, seed=seed); line(cv, 5, 15, 5, 7, 2, 1, seed=seed)
    line(cv, 8, 19, 8, 8, 3, 1, seed=seed)
    return shadow_under(fin(cv, .7), 8, 30, 6, 1.5, 80)

def gnarled_stump(seed=3):
    """그루터기 1x1: 윗면 나이테 타원이 보인다."""
    cv = Cv(16, 16)
    cyl(cv, 8, 8, 6, 2.6, 5, BARK, seed=seed)
    cv.ell(8, 8, 4.5, 1.8, lambda x, y: BARK[5] if (abs(x - 8) + abs(y - 8) * 2) % 3 else BARK[4])
    cv.px(8, 8, BARK[2])
    return shadow_under(fin(cv), 8, 14, 7, 1.5, 60)

def lamp_post(seed=4):
    """묘지 철제 가로등 1x3: 가는 기둥, 장식 고리, 푸른 불꽃 등. 아랫줄만 막힘."""
    cv = Cv(16, 48)
    cyl(cv, 8, 43.5, 4.5, 1.8, 1, IRON, seed=seed)                    # 바닥 원반
    cv.rect(4, 38, 12, 40, IRON[3]); cv.hline(4, 12, 38, IRON[4]); cv.hline(5, 11, 40, IRON[1])
    for y in range(14, 38):
        cv.px(7, y, IRON[4]); cv.px(8, y, IRON[2])
        if y % 8 == 0: cv.px(6, y, IRON[3]); cv.px(9, y, IRON[1])
    for (x, y) in ((5, 22), (4, 23), (4, 24), (5, 25), (11, 22), (12, 23), (12, 24), (11, 25)): cv.px(x, y, IRON[3] if x < 8 else IRON[2])   # 곡선 장식
    cv.hline(4, 12, 13, IRON[5]); cv.hline(4, 12, 14, IRON[2])
    for y in range(5, 13):                                         # 푸른 유리
        for x in range(5, 11): cv.px(x, y, (110, 210, 200) if x < 8 else (60, 150, 160))
        cv.px(4, y, IRON[3]); cv.px(11, y, IRON[1])
    for (x, y) in ((6, 7), (7, 7), (6, 8)): cv.px(x, y, (220, 252, 240))
    cyl(cv, 8, 4.5, 5.6, 2.4, 1, IRON, seed=seed)                      # 갓
    cv.px(8, 1, IRON[4]); cv.px(8, 2, IRON[3])
    return shadow_under(fin(cv, .7), 8, 46, 5, 1.4, 70)

def lamp_glow():
    return glow(64, (110, 210, 200), 54)

def crypt_gate(seed=5):
    """지하 묘소 입구 아치 3x3(48x48): 석조 문틀 + 쇠창살문 + 계단 내려감 + 위 장식 해골. 가운데 아랫 칸만 걷기(내려가는 계단)."""
    W, H = 48, 48; cv = Cv(W, H)
    # 돌 틀: 기둥 둘 + 상인방 + 박공
    mk = Mk(W, H); mk.rect(0, 14, 8, 44); mk.rect(40, 14, 48, 44); mk.rect(0, 6, 48, 16)
    mk.poly([(4, 6), (24, 0), (44, 6)])
    vol(cv, mk, ST, 0, 48, 4, seed, grain=.09)
    for x in range(1, 47): cv.px(x, 6 + (0 if 6 <= x < 42 else 1), ST[5] if x < 24 else ST[4])
    for i in range(0, 20): cv.px(4 + i, 6 - i * 6 // 20 + 0, ST[6]) if False else None
    # 박공 경사선
    for x in range(4, 24): cv.px(x, 6 - (x - 4) * 6 // 20, ST[6])
    for x in range(24, 44): cv.px(x, 0 + (x - 24) * 6 // 20, ST[4])
    # 안쪽 어둠 + 쇠창살
    for y in range(16, 44):
        for x in range(9, 40): cv.px(x, y, (14, 10, 18) if y > 20 else (28, 20, 32))
    for x in range(11, 38, 4):
        for y in range(17, 38): cv.px(x, y, IRON[4] if x < 24 else IRON[3]); cv.px(x + 1, y, IRON[2])
    for y in (19, 36): cv.hline(10, 39, y, IRON[4]); cv.hline(10, 39, y + 1, IRON[2])
    # 계단 (앞으로 내려가는 층)
    for i, y in enumerate(range(38, 46, 2)):
        for x in range(10, 38): cv.px(x, y, ST[4 - (i // 2)] if x % 9 else ST[2]); cv.px(x, y + 1, ST[2] if i < 3 else ST[1])
    # 위 장식: 해골 부조
    for (x, y) in ((22, 9), (23, 9), (24, 9), (25, 9), (22, 10), (25, 10), (23, 11), (24, 11)): cv.px(x, y, PL[4] if x < 24 else PL[3])
    cv.px(23, 10, DK); cv.px(24, 10, DK)
    # 기둥 홈
    for y in range(18, 43, 4): cv.px(3, y, ST[1]); cv.px(44, y, ST[1])
    mk2 = Mk(W, H); mk2.rect(0, 14, 48, 44); moss(cv, mk2, seed, .3) if False else None
    return shadow_under(fin(cv), 24, 45, 20, 2.5, 80)

def mausoleum(seed=6):
    """작은 영묘 6x4(96x64): 평지붕 윗면(위층 걷기+가림) + 앞면 돌 + 기둥 둘 + 어두운 닫힌 문. 아래 2줄(앞면)이 막힌다."""
    W, H = 96, 64; cv = Cv(W, H)
    mk = Mk(W, H); mk.rect(4, 2, 92, 28)
    vol(cv, mk, ST, 4, 92, 5, seed, grain=.1, rim=False)
    for y in range(2, 28):
        for x in range(4, 92):
            if (x + 8 * ((y - 2) // 7 % 2)) % 16 == 0 or (y - 2) % 7 == 6: cv.px(x, y, ST[4])
    for x in range(4, 92): cv.px(x, 2, ST[6]); cv.px(x, 27, ST[2])
    for y in range(28, 62):
        for x in range(4, 92):
            r = (y - 28) // 8; off = (r % 2) * 8
            k = 4 if x < 20 else (3 if x < 76 else 2)
            if (y - 28) % 8 == 7 or (x + off) % 16 == 15: k -= 1.5
            if _hash(x, y, seed + 1) < .07: k += 1
            if y < 31: k -= 1
            cv.px(x, y, ST[clamp(int(round(k)))])
    for y in range(36, 62):
        for x in range(32, 64):
            if y < 42 and abs(x - 47.5) > 16 - (42 - y) * 1.2: continue
            cv.px(x, y, (14, 10, 18) if y > 40 else (30, 22, 34))
    for x in range(30, 66): cv.px(x, 34, ST[5]); cv.px(x, 35, ST[2])
    for y in range(34, 62): cv.px(30, y, ST[5]); cv.px(31, y, ST[3]); cv.px(64, y, ST[2]); cv.px(65, y, ST[1])
    for y in range(40, 60, 6): cv.hline(33, 63, y, (40, 34, 52)) if False else None
    for cx in (16, 80):
        for y in range(32, 60):
            for x in range(cx - 4, cx + 4):
                t = (x + .5 - cx) / 4; k = 5 if t < -.4 else (4 if t < .1 else (3 if t < .55 else 2))
                cv.px(x, y, ST[k])
        for x in range(cx - 6, cx + 6): cv.px(x, 29, ST[6] if x < cx else ST[5]); cv.px(x, 30, ST[4]); cv.px(x, 31, ST[2])
        for x in range(cx - 6, cx + 6): cv.px(x, 59, ST[4]); cv.px(x, 60, ST[2])
    for (x, y) in ((46, 8), (47, 8), (46, 9), (47, 9), (46, 10), (47, 10), (46, 11), (47, 11), (46, 12), (47, 12), (42, 10), (43, 10), (44, 10), (45, 10), (48, 10), (49, 10), (50, 10), (51, 10)):
        cv.px(x, y, ST[6] if x < 47 else ST[5])
    mk2 = Mk(W, H); mk2.rect(4, 2, 92, 62); mk2.rect(30, 34, 66, 62, 0); moss(cv, mk2, seed, .25)
    return shadow_under(fin(cv), 48, 62, 44, 2, 80)

def mausoleum_steps(seed=7):
    """영묘 문 앞 돌계단 2x1(32x16): 두 단 윗면 + 앞면. 걷기."""
    cv = Cv(32, 16)
    for i, (x0, x1) in enumerate(((1, 31), (0, 32))):
        y0 = 1 + i * 7
        for y in range(y0, y0 + 7):
            for x in range(x0, x1):
                k = 5 if y < y0 + 3 else 3
                if x < x0 + 3: k += 1
                if x > x1 - 4: k -= 1
                if y == y0 + 6: k = 1
                if _hash(x, y, seed) < .07: k += 1
                cv.px(x, y, ST[clamp(k)])
    return pz.fin(cv.im, .66)

# ------------------------------------------------------------------ 오토타일 1: 철 울타리 (위층 투명, 모든 변형 막힘)
def fence_cell(m, N, E, S, W):
    im = new(); cv = Cv(16, 16)
    cx = 7
    # 기둥 (항상): 4px 폭, 윗부분 창끝
    for y in range(5, 15):
        cv.px(cx, y, IRON[4]); cv.px(cx + 1, y, IRON[3]); cv.px(cx + 2, y, IRON[1])
    cv.px(cx + 1, 3, IRON[5]); cv.px(cx + 1, 4, IRON[4]); cv.px(cx, 4, IRON[3]); cv.px(cx + 2, 4, IRON[2])
    cv.px(cx - 1, 5, IRON[3]); cv.px(cx + 3, 5, IRON[1]); cv.hline(cx - 1, cx + 4, 15, IRON[0])
    if E or W:
        x0 = 0 if W else cx + 2; x1 = 16 if E else cx
        for x in range(x0, x1):
            if x in range(cx - 1, cx + 4): continue
            for y in (6, 7): cv.px(x, y, IRON[4] if y == 6 else IRON[2])            # 윗 가로대
            for y in (12, 13): cv.px(x, y, IRON[3] if y == 12 else IRON[1])         # 아랫 가로대
            if x % 3 == 1:
                for y in range(4, 15): cv.px(x, y, IRON[3] if y > 5 else IRON[5])    # 창살 + 창끝
                cv.px(x, 3, IRON[4]) if False else None
    if N or S:
        y0 = 0 if N else 5; y1 = 16 if S else 14
        for y in range(y0, y1):
            if 5 <= y < 15: continue
            cv.px(cx + 1, y, IRON[4]); cv.px(cx + 2, y, IRON[2])
            if y % 4 == 0: cv.px(cx, y, IRON[3])                                  # 위에서 본 가로대 이음
        if N:
            for y in range(0, 5): cv.px(cx, y, IRON[3]); cv.px(cx + 1, y, IRON[5] if y % 3 else IRON[4]); cv.px(cx + 2, y, IRON[2])
    return pz.fin(cv.im, .66)

# ------------------------------------------------------------------ 오토타일 2: 밟힌 흙길 (아래층 가장자리, 풀 위에 덧그림)
def dirt_inner(x, y):
    D = [(62, 46, 38), (88, 66, 50), (114, 88, 62), (140, 110, 78)]
    n = pn(x, y, 4, 7, 16); r = _hash(x, y, 8)
    c = D[1] if n < .5 else D[2]
    if r < .09: c = D[0]
    elif r > .94: c = D[3]
    return c
def dirt_border(d):
    if d == 0: return (60, 44, 36)
    if d == 1: return (80, 60, 46)
    return None

def gnarl_tile_note(): pass

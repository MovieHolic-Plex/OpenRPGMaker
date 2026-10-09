# 마왕성 알현실·용암 다듬기(2026-10-07) 새 조각: 큰 기둥, 용암 위 현무암 덩이.
from df_kit import *
from df_kit import _hash


def _cyl_k(x, x0, x1):
    """원통 6단 명암(빛 왼쪽 위): 왼쪽 끝 하이라이트 -> 오른쪽 그늘 -> 반사광 한 줄."""
    t = (x + .5 - x0) / float(x1 - x0)
    if t < .1: return 4
    if t < .26: return 6
    if t < .42: return 5
    if t < .62: return 4
    if t < .8: return 3
    if t < .93: return 2
    return 3


def grand_pillar(seed=21):
    """알현실 큰 기둥 2×4(32x64): 둥근 머리판 윗면 + 붉은 띠·금선 두른 홈 새긴 원통 + 두 단 받침. 아랫줄 2칸만 막힘."""
    W, H = 32, 64
    cv = Cv(W, H)
    D = -1                                                                       # 마왕성 돌은 버들항 돌보다 한 단 어둡게
    # 받침(아래 단): 윗면 3줄 + 앞면 5줄
    for y in range(55, 63):
        for x in range(2, 30):
            if y < 58:
                k = 5 if (x < 5 or y == 55) else 4
                if x > 26: k = 3
            else:
                k = 4 if x < 5 else (3 if x < 25 else 2)
                if y == 59: k -= 1
                if y >= 61: k = 1
            if _hash(x, y, seed) < .06: k += 1 if _hash(y, x, seed + 1) < .5 else -1
            cv.px(x, y, OB[clamp(k + D)])
    # 받침(위 단) 둥근 고리
    for y in range(51, 55):
        for x in range(5, 27):
            k = _cyl_k(x, 5, 27) - (1 if y >= 53 else 0) + (1 if y == 51 else 0)
            cv.px(x, y, OB[clamp(k + D)])
    # 몸통 원통 (x 8..23)
    x0, x1 = 8, 24
    for y in range(14, 51):
        for x in range(x0, x1):
            k = _cyl_k(x, x0, x1)
            if (x - x0) % 4 == 2 and 1 < x - x0 < 15: k -= 1                       # 세로 홈
            if _hash(x, y, seed + 2) < .04: k += 1 if _hash(y, x, seed + 3) < .5 else -1
            cv.px(x, y, OB[clamp(k + D)])
    # 붉은 띠 둘 + 위아래 금선
    for (yb, hb) in ((18, 3), (44, 3)):
        for x in range(x0, x1):
            t = _cyl_k(x, x0, x1)
            cv.px(x, yb - 1, GLD[5] if t >= 5 else (GLD[4] if t >= 4 else GLD[3]))
            for yy in range(yb, yb + hb): cv.px(x, yy, RDK[clamp(t - 1, 1, 6)])
            cv.px(x, yb + hb, GLD[3] if t < 5 else GLD[4])
    # 머리: 아래로 좁아지는 목받이(y 9..13) + 네모 판 앞면(y 5..8) + 둥근 윗면(원판)
    for y in range(9, 14):
        hw = 12 - (y - 9)                                                         # 24 -> 16 폭
        xa, xb = 16 - hw, 16 + hw
        for x in range(xa, xb):
            k = _cyl_k(x, xa, xb) - (1 if y >= 12 else 0)
            cv.px(x, y, OB[clamp(k + D)])
    for y in range(5, 9):
        for x in range(2, 30):
            k = 4 if x < 5 else (3 if x < 26 else 2)
            if y == 8: k -= 1
            cv.px(x, y, OB[clamp(k + D)])
    for x in range(3, 29): cv.px(x, 7, RDK[3] if x < 25 else RDK[2])            # 머리판 붉은 줄
    for y in range(0, 6):
        for x in range(1, 31):
            dx = (x + .5 - 16) / 14.6; dy = (y + .5 - 3.2) / 3.0
            if dx * dx + dy * dy > 1: continue
            k = 5
            if dx < -.4 and dy < .3: k = 6
            if dx * dx + dy * dy > .6: k = 4 if dy < 0 else 3                    # 원판 테두리
            if _hash(x, y, seed + 4) < .05: k -= 1
            cv.px(x, y, OB[clamp(k + D)])
    im = fin(cv, .62)
    return shadow_under(im, 16, 62.5, 15, 2.2, 90)


def armor_stand(seed=23):
    """갑옷 장식 1×2(16x32): 받침 위에 선 검은 판금 갑옷 — 붉은 깃털 투구, 어깨받이, 가슴판, 앞에 짚은 큰 검. 아랫줄만 막힘."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.rect(5, 19, 8, 27); mk.rect(9, 19, 12, 27)                                # 다리(정강이받이)
    mk.poly([(4, 16), (12, 16), (13, 20), (3, 20)])                              # 허리 비늘
    mk.rect(4, 9, 13, 17)                                                        # 가슴판
    mk.ell(4.2, 10.4, 2.4, 2.0); mk.ell(11.8, 10.4, 2.4, 2.0)                     # 어깨받이
    mk.ell(8, 6, 3.2, 3.4)                                                       # 투구
    vol(cv, mk, OB, 2, 14, 3, seed, grain=.06)
    for y in range(32):
        for x in range(16):
            if mk.at(x, y) and not mk.at(x - 1, y): cv.px(x, y, OB[5])           # 왼쪽 빛 테
    for y in range(19, 27): cv.px(8, y, OB[0])                                   # 두 다리 사이
    for y in range(27, 32):                                                      # 받침
        for x in range(2, 14):
            k = (5 if x < 5 else 4) if y < 29 else (3 if x < 11 else 2)
            if y == 31: k = 1
            cv.px(x, y, OB[k])
    for y in range(9, 16): cv.px(8, y, OB[6] if y < 12 else OB[5])               # 가슴판 가운데 등줄
    for x in range(4, 13): cv.px(x, 16, RDK[4] if x < 9 else RDK[2])            # 붉은 허리띠
    for x in range(6, 11): cv.px(x, 6, OB[0])                                    # 투구 눈구멍
    cv.px(7, 6, RDK[5]); cv.px(9, 6, RDK[4])
    for (x, y) in ((7, 2), (8, 1), (9, 0), (10, 0), (11, 1), (12, 2), (12, 3), (13, 4), (13, 5)): cv.px(x, y, RDK[5] if x < 10 else RDK[4])   # 깃털 장식
    for (x, y) in ((8, 2), (9, 1), (10, 1), (11, 2), (12, 4)): cv.px(x, y, RDK[3])
    for x in range(3, 6): cv.px(x, 9, OB[6])                                     # 어깨 위 하이라이트
    for x in range(11, 14): cv.px(x, 9, OB[4])
    for y in range(14, 28): cv.px(8, y, IRON[5] if y < 22 else IRON[4])          # 앞에 짚은 검날
    cv.px(8, 27, IRON[3])
    for x in range(6, 11): cv.px(x, 14, GLD[4] if x < 8 else GLD[3])            # 코등이
    cv.px(8, 12, GLD[5]); cv.px(8, 13, GLD[3])                                   # 자루 끝
    for y in range(19, 27): cv.px(8, y, IRON[5] if y < 22 else IRON[4])
    return shadow_under(fin(cv, .5), 8, 31, 7, 1.4, 80)


def lava_rock(seed=31, w=16):
    """용암 위에 뜬 현무암 덩이(1칸 또는 2칸 폭). 윗면 밝고 앞면 어둡고, 아래는 용암 빛이 비친다. 둘레 1px 밝은 용암 고리."""
    cv = Cv(w, 16); mk = Mk(w, 16)
    lumps = [(w / 2, 9.5, w / 2 - 2.5, 4.2)] if w == 16 else [(9, 9.5, 7, 4.4), (21, 10.5, 6.5, 3.6), (27, 8.5, 3.2, 2.6)]
    for (cx, cy, rx, ry) in lumps: mk.ell(cx, cy, rx, ry)
    vol(cv, mk, OB, None, None, 2, seed, grain=.1)
    p = mk.im.load()
    for y in range(16):
        for x in range(w):
            if not mk.at(x, y): continue
            if not mk.at(x, y - 1) or not mk.at(x, y - 2): cv.px(x, y, OB[4] if x < w * .55 else OB[3])
            elif not mk.at(x, y - 3) or not mk.at(x, y - 4): cv.px(x, y, OB[3] if x < w * .55 else OB[2])
            if not mk.at(x, y + 1): cv.px(x, y, (150, 52, 22))
            elif not mk.at(x, y + 2): cv.px(x, y, (96, 30, 22))
    for (cx, cy, rx, ry) in lumps:
        cv.px(int(cx - rx * .3), int(cy - ry * .45), OB[5])
    im = fin(cv, .7)
    q = im.load()
    for y in range(16):
        for x in range(w):
            if q[x, y][3]: continue
            nb = any(0 <= x + dx < w and 0 <= y + dy < 16 and q[x + dx, y + dy][3] and q[x + dx, y + dy][:3] != LAV[4] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if nb and y > 8: q[x, y] = LAV[4] + (255,)
    return im


def lava_rock_wide(seed=32): return lava_rock(seed, 32)

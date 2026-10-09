# 최종 탑 — 웨이브 5 보정 패스: 바닥 변형 5종 + 바닥 장식 5종.
# 약한 곳(plan.md): 층마다 바닥이 한 가지 판(판석·강철판·핵 방 판)이라 3칸 주기 반복이 그대로 보였다.
# 변형은 원래 바닥과 **줄눈 격자가 같다**(판석 = flagp 씨앗 611 의 8px 줄·어긋난 마디, 강철 = 16px 판, 핵 방 = 24px 판) —
# 칸 단위로 섞어 깔아도 줄눈이 이어지고 표면(닳음·금·녹·미끄럼 돌기·덧댄 판)만 바뀐다. 큰 마름돌 길(ft_slab_big)만 다른 격자로, 길 띠로 쓴다.
import numpy as np
from PIL import Image
from ft_base import *
from ft_base import _hash


# ================================================================ 바닥 변형 (48x48 주기, 3x3 이음새 없음)
def ft_slab_worn(X, Y):
    """닳고 금 간 판석: 같은 판석 줄눈에 판마다 금(1px 사선)·깨진 모서리·뼛가루 낀 줄눈·짙은 그을음."""
    c = flagp(X, Y, 611, mix(FT[3], FT[4], .3), FT[1])
    row = Y // 8; ly = Y % 8
    jx = int(_hash(0, row, 616) * 10) + 3 + (row % 2) * 2
    lx = X % 16
    joint = (ly == 7) or (lx == jx % 16)
    col = (X // 16 + (1 if lx > jx % 16 else 0)) % 3
    hb = _hash(col, row, 617)
    if joint:
        if _hash(X, Y, 618) < .16: return BONE[2]                      # 줄눈에 낀 뼛가루
        return c
    if pn(X, Y, 6, 619) > .7: c = mix(c, FT[1], .35)                   # 그을음 번짐
    # 판마다 금 하나(판 셋 중 둘): 판 안 위 끝에서 아래로 비스듬히
    if hb < .34:
        x0 = (jx + 3 + int(hb * 20)) % 16
        if (lx - x0) % 16 == (ly * (1 if hb < .17 else -1)) % 16 and 0 < ly < 6:
            return FT[1]
        if (lx - x0 - 1) % 16 == (ly * (1 if hb < .17 else -1)) % 16 and 0 < ly < 6:
            c = mix(c, FT[5], .3)                                       # 금 오른쪽 밝은 모(빛 왼쪽 위 → 금 아래 쪽 모가 빛)
    # 깨진 모서리: 판 왼쪽 위 2px 가 떨어져 나가 그늘
    if hb > .7 and ly < 2 and (lx - jx - 1) % 16 < 2 - ly: return FT[2]
    return c
mk_floor('ft_slab_worn', ft_slab_worn)


def ft_slab_big(X, Y):
    """큰 마름돌 길: 24x16 큰 돌(줄마다 반 장 어긋남), 윗·왼쪽 1px 빛 모, 아래·오른쪽 2px 그늘 줄눈, 돌마다 톤."""
    row = Y // 16; off = (row % 2) * 12; lx = (X + off) % 24; ly = Y % 16; col = ((X + off) // 24) % 2
    hb = _hash(col, row % 3, 651)
    base = mix(FT[3], FT[4], .55) if hb < .45 else (mix(FT[3], FT[4], .3) if hb < .8 else mix(FT[3], FT[5], .3))
    if ly == 15 or lx == 23: return FT[1]
    if ly == 14 or lx == 22: return mix(base, FT[1], .55)
    c = base
    if ly == 0 or lx == 0: c = mix(c, FT[5], .5)
    elif ly == 1 or lx == 1: c = mix(c, FT[5], .18)
    if pn(X, Y, 6, 652) > .76: c = mix(c, FT[2], .35)                   # 닳은 결
    r = _hash(X, Y, 653)
    if r < .03: c = mix(c, FT[5], .4)
    elif r > .975: c = mix(c, FT[1], .5)
    if 4 < ly < 11 and 5 < lx < 18 and hb > .8 and (lx * 2 + ly) % 9 == 0: c = mix(c, FT[2], .5)   # 마모 홈
    return c
mk_floor('ft_slab_big', ft_slab_big)


def ft_plate_tread(X, Y):
    """미끄럼 방지 강철판: 같은 16px 판 줄눈·모서리 리벳, 판 안에 사선 쌍 돌기(4px 격자, 엇갈림)."""
    lx = X % 16; ly = Y % 16
    c = ft_plate(X, Y)
    if lx in (0, 14, 15) or ly in (0, 14, 15) or (lx in (2, 3, 13) and ly in (2, 3, 13)): return c
    u = (lx + (ly // 4) * 2) % 4; v = ly % 4
    if (u, v) in ((1, 1), (2, 2)): return STEEL[5] if (u, v) == (1, 1) else STEEL[4]   # 돌기 윗면(빛)
    if (u, v) in ((2, 3), (3, 2)): return STEEL[1]                    # 돌기 그늘
    return c
mk_floor('ft_plate_tread', ft_plate_tread)


def ft_plate_rust(X, Y):
    """녹슨·덧댄 갑판: 같은 판 줄눈에 넓게 번진 녹과 판 하나 걸러 덧댄 작은 판(용접 줄·리벳 넷)."""
    lx = X % 16; ly = Y % 16; col = X // 16; row = Y // 16
    c = ft_plate(X, Y)
    if lx in (15,) or ly in (15,): return c
    patch = _hash(col % 3, row % 3, 661) < .45
    if patch and 3 <= lx <= 12 and 4 <= ly <= 12:
        k = 4 if (lx == 3 or ly == 4) else (2 if (lx == 12 or ly == 12) else 3)
        if (lx, ly) in ((5, 6), (10, 6), (5, 10), (10, 10)): k = 6
        if (lx, ly) in ((6, 7), (11, 7), (6, 11), (11, 11)): k = 1
        c = STEEL[k]
        if (lx in (3, 12) or ly in (4, 12)) and _hash(X, Y, 662) < .5: c = mix(STEEL[3], BRASS[2], .3)   # 용접 줄
        return c
    n = pn(X, Y, 6, 663)
    if n > .64: c = mix(c, RUST[2], .4)
    if n > .76: c = mix(c, RUST[3], .35)
    if n > .84 and _hash(X, Y, 664) < .3: c = mix(c, RUST[4], .4)
    return c
mk_floor('ft_plate_rust', ft_plate_rust)


def ft_core_cracked(X, Y):
    """깨진 핵 방 판: 같은 24px 판 줄눈, 판마다 거미줄 금(빛 새는 마디)·깨져 내려앉은 모서리, 그을린 결."""
    c = ft_core(X, Y)
    lx = X % 24; ly = Y % 24; bx = (X // 24) % 2; by = (Y // 24) % 2
    if lx == 23 or ly == 23: return c
    hh = _hash(bx, by, 671)
    cx = 6 + int(hh * 12); cy = 6 + int(_hash(by, bx, 672) * 12)
    dx, dy = lx - cx, ly - cy
    # 금 셋: 마디에서 판 가장자리로(1px 검은 금, 마디 둘레 보라 빛)
    for (ax, ay) in ((1, -.55), (-.7, -.9), (.25, 1)):
        t = dx * ax + dy * ay
        if t > 0 and abs(dx * ay - dy * ax) < .6 + .02 * t: return FT[0] if t > 2 else VIOL[3]
    if dx * dx + dy * dy <= 2: return VIOL[4]
    if pn(X, Y, 6, 673) > .68: c = mix(c, FT[1], .4)
    if hh > .6 and lx + ly < 5: return FT[1] if lx + ly == 4 else FT[2]   # 깨져 내려앉은 모서리
    return c
mk_floor('ft_core_cracked', ft_core_cracked)


# ================================================================ 바닥 장식(걷기, 사람 아래)
def floor_hatch(seed=711):
    """점검 해치(1x1): 바닥에 묻힌 강철 뚜껑 — 어두운 테, 경첩 둘, 손잡이 막대, 모서리 경고 칠."""
    tc = TC(16, 16, seed)
    tc.rect(1, 1, 15, 15, 'steel', 1)
    tc.rect(2, 2, 14, 14, 'steel', 3)
    tc.hline(2, 14, 2, 'steel', 5); tc.vline(2, 2, 14, 'steel', 4)
    tc.hline(2, 14, 13, 'steel', 2); tc.vline(13, 3, 14, 'steel', 2)
    for (x, y) in ((4, 4), (11, 4), (4, 11), (11, 11)): tc.px(x, y, 'steel', 6); tc.px(x + 1, y + 1, 'steel', 1)
    tc.hline(6, 10, 8, 'steel', 6); tc.hline(6, 10, 9, 'steel', 1)              # 손잡이 막대
    tc.px(5, 8, 'steel', 2); tc.px(10, 8, 'steel', 2)
    for (x, y) in ((3, 6), (3, 7), (12, 6), (12, 7)): tc.px(x, y, 'steel', 1)    # 경첩
    for (x0, y0) in ((2, 2), (12, 2)):                                            # 경고 칠 삼각
        for i in range(2):
            for j in range(2 - i): tc.px(x0 + (i if x0 < 8 else 1 - i), y0 + j, 'warn', 4)
    for x in range(1, 15):
        for y in range(1, 15):
            if _hash(x, y, seed) < .06: tc.shift(x, y, -1)
    return tc_fin(tc, .5)


def drain_grate(seed=721):
    """배수구(1x1): 둥근 강철 테 안 방사 살, 살 사이 검은 액 고임, 둘레 젖은 얼룩."""
    tc = TC(16, 16, seed)
    for y in range(16):
        for x in range(16):
            d = ((x + .5 - 8) ** 2 + (y + .5 - 8.5) ** 2) ** .5
            if 5.6 < d < 7.6 and _hash(x, y, seed + 1) < .55: tc.px(x, y, 'ftst', 2)        # 젖은 얼룩
    tc.ell(8, 8.5, 5.4, 4.8, 'steel', 2)
    tc.ell(8, 8.5, 4.4, 3.8, 'steel', 4)
    for y in range(16):
        for x in range(16):
            dx, dy = x + .5 - 8, y + .5 - 8.5
            if (dx / 3.6) ** 2 + (dy / 3.0) ** 2 <= 1:
                bar = (x - 8) % 2 == 0 or abs(dx) + abs(dy) < 1.2
                tc.px(x, y, 'steel', 5 if (bar and dy < 0) else (3 if bar else 0))
                if not bar and dy > .5: tc.px(x, y, 'viol', 1)                          # 살 사이 고인 검보라 액
    tc.hline(5, 11, 4, 'steel', 6)
    return tc_fin(tc, .55)


def floor_sigil(seed=731):
    """바닥 상감 원(2x2): 판석에 새긴 두 겹 고리와 여덟 눈금, 홈에 고인 보라 빛, 군데군데 이가 빠졌다(글자·얼굴 없음)."""
    W = H = 32
    tc = TC(W, H, seed)
    cx, cy = 16, 16
    for y in range(H):
        for x in range(W):
            dx, dy = (x + .5 - cx) / 1.0, (y + .5 - cy) / .86        # 3/4 시점이라 세로를 눌렀다
            d = (dx * dx + dy * dy) ** .5
            ang = (np.arctan2(dy, dx) + np.pi) / (2 * np.pi)
            chip = _hash(int(ang * 20), 0, seed + 3) < .16
            if 13.0 <= d < 14.6 and not chip: tc.px(x, y, 'ftst', 1)                     # 바깥 고리 홈(어둠)
            elif 12.2 <= d < 13.0 and not chip: tc.px(x, y, 'viol', 3)                   # 홈 속 빛
            elif 14.6 <= d < 15.3 and not chip and dy > 0: tc.px(x, y, 'ftst', 5)        # 홈 아래 모(빛 받음)
            elif 7.6 <= d < 8.8 and _hash(int(ang * 12), 1, seed + 4) > .12: tc.px(x, y, 'viol', 2 if dy < 0 else 3)
            elif d < 2.2: tc.px(x, y, 'viol', 4 if d < 1.1 else 2)
            # 여덟 눈금(고리 사이 짧은 방사 홈)
            a8 = (ang * 8) % 1
            if 9.2 <= d < 12.0 and (a8 < .045 or a8 > .955): tc.px(x, y, 'viol', 3)
    return tc_fin(tc, .35)


def slab_broken(seed=741):
    """깨져 들뜬 판석(2x1): 판석 셋이 금 따라 조각나 꺼진 구멍 위에 어긋나 얹혔다 — 검은 틈·들린 모 빛·깔린 부스러기."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    tc.poly([(1, 3), (30, 2), (31, 13), (2, 14)], 'ftst', 0)                          # 꺼진 구멍(틈으로 보이는 어둠)
    shards = [((2, 3), (12, 3), (13, 9), (3, 12)), ((15, 2), (24, 4), (22, 12), (15, 10)), ((26, 4), (30, 5), (30, 12), (25, 12))]
    for i, pts in enumerate(shards):
        k = (4, 5, 3)[i]
        tc.poly(list(pts), 'ftst', k)
        for j in range(len(pts)):
            p, q = pts[j], pts[(j + 1) % len(pts)]
            if j == 0: tc.line(p[0], p[1], q[0], q[1], 'ftst', 6 if i == 1 else 5)    # 윗 모 빛(들린 판이 가장 밝다)
            if j == 2: tc.line(p[0], p[1], q[0], q[1], 'ftst', 1)                     # 아래 모 그늘
    tc.line(15, 11, 22, 13, 'ftst', 1)                                                 # 들린 판의 앞 두께
    for (x, y) in ((7, 13), (19, 14), (27, 14)): tc.px(x, y, 'ftst', 3)
    tc.px(8, 7, 'bone', 5); tc.px(9, 7, 'bone', 4); tc.px(8, 8, 'bone', 1)
    return tc_fin(tc, .7)


def hazard_paint(seed=751):
    """바닥 경고 칠(2x1): 바닥에 칠한 노랑·검정 사선 띠, 많이 벗겨지고 긁혔다(글자 없음)."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for y in range(5, 11):
        for x in range(1, 31):
            if _hash(x // 3, y // 2, seed + 1) < .2: continue                         # 벗겨진 자리
            on = ((x + y) // 4) % 2 == 0
            if on: tc.px(x, y, 'warn', 4 if y > 5 else 5)
            else: tc.px(x, y, 'cable', 2)
    for x in range(1, 31):
        if _hash(x, 0, seed + 2) < .7: tc.px(x, 4, 'steel', 3)
        if _hash(x, 1, seed + 2) < .7: tc.px(x, 11, 'steel', 1)
    for y in range(4, 12):
        for x in range(1, 31):
            if _hash(x, y, seed + 3) < .08: tc.shift(x, y, -1)
    out = tc.img()
    a = np.array(out); a[..., 3] = np.where(a[..., 3] > 0, 215, 0)                     # 칠이라 바닥 결이 살짝 비친다
    return Image.fromarray(a, 'RGBA')

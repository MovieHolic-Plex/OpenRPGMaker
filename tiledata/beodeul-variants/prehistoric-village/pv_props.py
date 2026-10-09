# 원시 마을 살림 소품: 모닥불 광장(돌 화덕·꼬챙이 구이·작은 모닥불), 고기 건조대, 가죽 말리는 틀, 토기, 큰 독, 돌 걸상,
# 땔감 더미, 뼈 무더기, 갈판, 창 걸이, 토템 기둥 둘, 벽화 바위(큰·작은), 물감 그릇, 가죽 북, 털가죽 깔개.
from pv_base import *


def _flame(px, W, Hh, cx, y0, rows, pal='flame'):
    """불꽃 화소 그림(버들항·초원 하이로드 모닥불과 같은 7단 불 램프). rows: 숫자 줄(1..7 = 램프 단, '.' 빈칸)."""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.': continue
            put(px, W, Hh, cx - len(r) // 2 + i, y0 + j, hx(PAL[pal][int(ch) - 1]))


PAL.setdefault('flame', ['#3a0c00', '#8a2000', '#d04a00', '#f08a10', '#ffc030', '#ffe680', '#fffbd0'])
GRAIN.setdefault('flame', (0.0, 1))
FLAME_BIG = ["....6......", "...565..6..", "...5675.56.", "..456765565", "..3567765 4", ".234567654.", ".234566543.", "..2345543..", "...23332..."]
FLAME_SM = ["...6...", "..565..", ".45654.", ".34543.", "..232.."]


# ---------------------------------------------------------------- 돌 화덕 + 꼬챙이 구이(광장 한가운데)
def hearth_spit():
    W, Hh = 48, 48
    c = C(W, Hh, seed=801); c.shadow(24, 41, 19, 3.4, 100)
    # 재 바닥
    c.group(0); c.new(); c.ellipsoid(24, 37, 13, 4.4, 'char', amb=0.3, bias=-0.2, bump=0.5)
    # 둘레 돌(뒤쪽 줄 먼저, 크기·톤 제각각)
    stones = []
    for i in range(14):
        a = i / 14 * 6.283 + 0.2; r = 1 + H(i, 801) * 0.12
        stones.append((24 + math.cos(a) * 15.5 * r, 37 + math.sin(a) * 5.6 * r, 2.6 + H(i, 802) * 1.3, i))
    for (x, y, rr, i) in sorted(stones, key=lambda t: t[1]):
        c.group(1 + (1 if y > 37 else 0)); c.new()
        c.ellipsoid(x, y, rr, rr * 0.78, 'stone', amb=0.2, bias=(-0.12 if H(i, 3) > 0.5 else -0.02), bump=0.5)
    # 장작(엇갈려 쌓음) — 숯 끝
    c.group(2)
    for (x0, y0, x1, y1) in ((15, 39, 31, 34), (16, 34, 32, 39), (19, 37, 29, 37)):
        c.new()
        for k in range(3): c.line(x0, y0 + k - 1, x1, y1 + k - 1, 'bark', (5, 4, 2)[k])
        c.tone(x0, y0, 'char', 2); c.tone(x1, y1, 'char', 3)
    # 갈래 진 꼬챙이 기둥 둘 + 가로 꼬챙이 + 고기 덩이
    c.group(3)
    for x in (6, 42):
        limb(c, [(x, 41), (x + (1 if x < 24 else -1) * 0.5, 22)], [1.3, 1.1], 'bark', 803)
        c.tone(x - 1, 21, 'bark', 5); c.tone(x - 2, 20, 'bark', 4); c.tone(x + 2, 21, 'bark', 3); c.tone(x + 3, 20, 'bark', 3)
    c.group(4); c.new()
    for x in range(3, 46): c.tone(x, 22, 'bark', 5 if x < 24 else 4); c.tone(x, 23, 'bark', 2)
    c.group(5)
    c.new(); c.ellipsoid(24, 25.5, 7.4, 4.6, 'meat', amb=0.25, bias=0.06, bump=0.35)          # 넓적다리 고기
    c.new(); c.ellipsoid(30.5, 24, 2.6, 2.2, 'meat', amb=0.3, bias=0.1)
    c.new()
    for (x, y) in ((31, 22), (32, 22), (33, 23), (34, 23)): c.tone(x, y, 'ivory', 5)          # 삐져나온 뼈 끝
    c.tone(35, 22, 'ivory', 6); c.tone(35, 24, 'ivory', 4)
    for (x, y) in ((19, 23), (21, 22), (23, 22), (25, 23)): c.tone(x, y, 'cream', 6)            # 기름 번들
    for (x, y) in ((20, 28), (24, 29), (27, 28)): c.tone(x, y, 'meat', 2)                       # 그을린 아랫면
    im = F(c); px = im.load()
    _flame(px, W, Hh, 24, 27, FLAME_BIG)
    for (x, y) in ((18, 24), (30, 19), (22, 16), (27, 13)): put(px, W, Hh, x, y, hx(PAL['flame'][5]))   # 불똥
    for (x, y) in ((17, 38), (31, 37), (20, 40), (28, 40)): put(px, W, Hh, x, y, hx(PAL['flame'][3]))   # 숯불
    return im


def campfire_small():
    W, Hh = 32, 32
    c = C(W, Hh, seed=811); c.shadow(16, 27, 11, 2.4, 90)
    c.new(); c.ellipsoid(16, 24, 8, 3.0, 'char', amb=0.3, bias=-0.2, bump=0.5)
    for i in range(9):
        a = i / 9 * 6.283 + 0.4
        c.group(1 + (1 if math.sin(a) > 0 else 0)); c.new()
        c.ellipsoid(16 + math.cos(a) * 10, 24 + math.sin(a) * 3.8, 2.4 + H(i, 811) * 0.9, 1.9, 'stone', amb=0.2, bias=-0.06, bump=0.5)
    c.group(2)
    for (x0, y0, x1, y1) in ((10, 26, 22, 21), (11, 21, 23, 26)):
        c.new()
        for k in range(3): c.line(x0, y0 + k - 1, x1, y1 + k - 1, 'bark', (5, 4, 2)[k])
        c.tone(x0, y0, 'char', 2)
    im = F(c); px = im.load()
    _flame(px, W, Hh, 16, 16, FLAME_SM + ["..121.."])
    put(px, W, Hh, 13, 13, hx(PAL['flame'][5])); put(px, W, Hh, 19, 11, hx(PAL['flame'][5]))
    return im


# ---------------------------------------------------------------- 고기 건조대: A자 다리 둘에 가로대 두 줄, 길게 썬 고기·생선이 매달렸다
def meat_rack():
    W, Hh = 48, 40
    c = C(W, Hh, seed=821); c.shadow(24, 36, 20, 2.6, 90)
    c.group(1)
    for (xa, xb) in ((3, 9), (39, 45)):
        limb(c, [(xa, 37), (xa + 3, 7)], [1.1, 0.9], 'bark', 822)
        limb(c, [(xb, 37), (xb - 3, 7)], [1.1, 0.9], 'bark', 823)
        c.new()
        for (x, y) in ((xa + 2, 8), (xa + 3, 8), (xa + 4, 8), (xa + 3, 9)): c.tone(x, y, 'rope', 4)     # 꼭대기 묶음
    c.group(2); c.new()
    for x in range(2, 47):
        c.tone(x, 8, 'bark', 5 if x < 24 else 4); c.tone(x, 9, 'bark', 2)
        c.tone(x, 18, 'bark', 5 if x < 24 else 4); c.tone(x, 19, 'bark', 2)
    # 매단 고기 띠(길이·폭 제각각, 위가 넓고 아래로 가늘다, 기름 밝은 줄)
    c.group(3)
    for k, (x, L, w) in enumerate(((11, 9, 3), (15, 7, 2), (19, 10, 3), (25, 8, 3), (29, 6, 2), (33, 9, 3))):
        c.new()
        for j in range(L):
            ww = max(1, w - (j * w) // (L + 2))
            for i in range(ww):
                t = 4 if i == 0 else (3 if i < ww - 1 else 2)
                if j == 0: t += 1
                c.tone(x + i, 10 + j, 'meat', t)
        c.tone(x, 10, 'rope', 4)
        if k % 2 == 0: c.tone(x + 1, 12, 'cream', 5)
    # 아래 줄: 생선 둘 + 고기 띠
    for k, (x, kind) in enumerate(((12, 'fish'), (20, 'meat'), (27, 'fish'), (35, 'meat'))):
        c.new()
        if kind == 'fish':
            for j in range(9):
                ww = 3 if 1 < j < 7 else 2
                for i in range(ww): c.tone(x + i - (1 if ww == 3 else 0), 20 + j, 'stone', 5 if i == 0 else (4 if i == 1 else 3))
            c.tone(x - 1, 29, 'stone', 3); c.tone(x + 1, 29, 'stone', 3); c.tone(x, 22, 'dark', 1)
        else:
            for j in range(8):
                for i in range(2): c.tone(x + i, 20 + j, 'meat', 4 if i == 0 else 2)
    im = F(c); px = im.load()
    tufts(px, W, Hh, 1, 12, 38, 824, 0.5, 3); tufts(px, W, Hh, 36, 47, 38, 825, 0.5, 3)
    return im


# ---------------------------------------------------------------- 가죽 말리는 틀: 네모 나무틀에 끈으로 팽팽히 당긴 가죽, 뒤로 버팀대
def hide_frame():
    W, Hh = 32, 44
    c = C(W, Hh, seed=831); c.shadow(17, 40, 12, 2.4, 90)
    c.group(0); limb(c, [(25, 41), (21, 12)], [1.0, 0.8], 'bark', 832)                       # 뒤 버팀대
    c.group(1)
    for x in (4, 27):
        limb(c, [(x, 41), (x, 5)], [1.2, 1.0], 'bark', 833 + x)
    c.new()
    for x in range(2, 30):
        c.tone(x, 6, 'bark', 5 if x < 16 else 4); c.tone(x, 7, 'bark', 2)
        c.tone(x, 33, 'bark', 5 if x < 16 else 4); c.tone(x, 34, 'bark', 2)
    # 가죽(동물 모양 아닌 불규칙한 넓은 판): 가운데 밝고 가장자리 어둡게, 다리 자리 끝이 늘어진다
    c.group(2); c.new()
    for y in range(9, 32):
        for x in range(6, 26):
            dx = (x + 0.5 - 16) / 10.0; dy = (y + 0.5 - 20.5) / 11.5
            wob = (vnoise(x, y, 2.5, 834) - 0.5) * 0.35
            r = dx ** 4 + dy ** 4 + wob
            if r <= 0.62:
                v = 0.80 - 0.25 * dx - 0.18 * dy - r * 0.35
                c.setv(x, y, 'hide', v)
    for (x, y) in ((6, 10), (25, 10), (6, 31), (25, 31)):                                       # 늘어진 귀퉁이
        for k in range(3): c.tone(x + (1 if x < 16 else -1) * k, y + (1 if y < 20 else -1) * 0, 'hide', 3)
    # 끈: 틀과 가죽 테를 잇는 짧은 줄(2화소 간격)
    c.group(3); c.new()
    for y in range(11, 31, 3): c.tone(5, y, 'rope', 4); c.tone(26, y, 'rope', 3)
    for x in range(8, 25, 3): c.tone(x, 8, 'rope', 4); c.tone(x, 32, 'rope', 3)
    # 긁어낸 자국(밝은 결) 몇 줄
    for (x0, y0, L) in ((10, 14, 5), (13, 19, 6), (11, 24, 4), (17, 16, 4)):
        for j in range(L): c.lighten(x0 + j, y0 + (j // 3), 1)
    im = F(c); px = im.load()
    tufts(px, W, Hh, 1, 31, 42, 836, 0.4, 3)
    return im


# ---------------------------------------------------------------- 토기: 빗살무늬 독 + 둥근 단지 + 작은 사발(한 무리) / 큰 저장 독(반쯤 묻힘)
def _pot(c, cx, ybot, rx, hgt, neck, seed, comb=True, mouth=True):
    c.new()
    for y in range(int(ybot - hgt), int(ybot) + 1):
        f = (ybot - y) / hgt            # 0 밑 .. 1 입
        if f > 0.86: r = neck * rx
        else:
            g = f / 0.86; r = rx * math.sin(math.pi * (0.18 + 0.82 * g)) ** 0.6 * (1 - 0.15 * g)
            r = max(r, rx * 0.35)
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            u = (x + 0.5 - cx) / max(0.8, r)
            if abs(u) > 1: continue
            v = 0.86 - 0.48 * (u + 1) / 2 - 0.10 * (1 - f)
            c.setv(x, y, 'pot', v)
            if comb and 0.25 < f < 0.8 and ((x + y * 1) % 4 == 0) and H(x, y, seed) > 0.2:
                c.darken(x, y, 1)                                     # 빗살무늬(비스듬한 점선)
    if mouth:
        my = int(ybot - hgt); mr = neck * rx + 0.6
        for x in range(int(cx - mr), int(cx + mr) + 1):
            u = (x + 0.5 - cx) / mr
            if abs(u) <= 1:
                c.tone(x, my, 'pot', 5 if u < 0.3 else 4)
                if abs(u) < 0.75: c.tone(x, my + 1, 'dark', 1)
                elif abs(u) <= 1: c.tone(x, my + 1, 'pot', 3)


def pottery_group():
    W, Hh = 32, 32
    c = C(W, Hh, seed=841); c.shadow(16, 28, 14, 2.2, 90)
    c.group(1); _pot(c, 10, 27, 6.2, 17, 0.55, 842)                   # 빗살무늬 긴 독
    c.group(2); _pot(c, 21, 28, 5.6, 10, 0.62, 843, comb=False)       # 둥근 단지
    for x in range(17, 26): c.tone(x, 22, 'ochre', 3) if c.m[22][x] else None       # 붉은 띠
    c.group(3); c.new()                                                 # 작은 사발(앞)
    for y in range(26, 31):
        for x in range(23, 32):
            dx = (x + 0.5 - 27.5) / 4.4; dy = (y - 26) / 4.6
            if dx * dx + dy * dy <= 1: c.setv(x, y, 'pot', 0.75 - 0.3 * dx)
    for x in range(24, 31): c.tone(x, 26, 'pot', 5); c.tone(x, 27, 'dark', 2) if 25 <= x <= 29 else None
    return F(c)


def storage_jar():
    W, Hh = 16, 32
    c = C(W, Hh, seed=851); c.shadow(8, 29, 7, 1.8, 90)
    c.group(1); _pot(c, 8, 28, 6.6, 22, 0.5, 852)
    c.group(2); c.new()                                                 # 덮은 가죽 뚜껑 + 묶은 끈
    for x in range(3, 13):
        c.tone(x, 5, 'hide2', 5 if x < 8 else 4); c.tone(x, 6, 'hide2', 3)
    for x in range(4, 12): c.tone(x, 7, 'rope', 4 if x % 2 else 3)
    c.group(3); c.new()                                                 # 묻힌 밑동 흙
    for x in range(1, 15):
        for y in range(26, 30):
            if ((x + 0.5 - 8) / 7.2) ** 2 + ((y + 0.5 - 28) / 2.2) ** 2 <= 1: c.setv(x, y, 'dirt', 0.55 - 0.2 * (x - 8) / 7)
    im = F(c); px = im.load(); tufts(px, W, Hh, 1, 15, 29, 853, 0.45, 2)
    return im


# ---------------------------------------------------------------- 돌 걸상(납작돌을 돌 둘 위에 얹음) / 땔감 더미 / 뼈 무더기 / 갈판
def stone_seat():
    W, Hh = 32, 24
    c = C(W, Hh, seed=861); c.shadow(16, 20, 14, 2.0, 90)
    c.group(1)
    for x in (7, 24):
        c.new(); c.ellipsoid(x, 16, 4.4, 3.4, 'stone', amb=0.2, bias=-0.1, bump=0.5)
    c.group(2); c.new()
    for y in range(7, 15):
        for x in range(2, 30):
            top = 7 + abs(x - 15) * 0.05
            if y >= top:
                fy = y - top
                if fy < 4: c.setv(x, y, 'stone', 0.92 - 0.012 * x + (vnoise(x, y, 3, 862) - 0.5) * 0.2)       # 윗면
                elif fy < 7: c.setv(x, y, 'stone', 0.52 - 0.010 * x)                                          # 앞면
    for (x, y) in ((6, 9), (14, 8), (22, 10)): c.tone(x, y, 'moss', 4)
    return F(c)


def firewood_pile():
    W, Hh = 32, 24
    c = C(W, Hh, seed=871); c.shadow(16, 21, 14, 2.0, 90)
    logs = [(4, 27, 18, 2.4), (6, 29, 13.5, 2.3), (3, 22, 13, 2.2), (9, 26, 9, 2.1), (14, 24, 5, 1.9)]
    for k, (x0, x1, cy, r) in enumerate(logs):
        c.group(k); c.new(); c.hcyl(x0 + H(k, 5) * 2, x1 - H(k, 6) * 2, cy, r, 'bark', amb=0.25, endcap='L', capmat='cream')
    for (x, y) in ((12, 17), (20, 13), (16, 9), (24, 18)): c.tone(x, y, 'bark', 2)
    c.group(9); c.new()
    for (x, y) in ((27, 7), (28, 6), (29, 5), (26, 8)): c.tone(x, y, 'bark', 4)                # 삐친 잔가지
    return F(c)


def _bone(c, x0, y0, x1, y1, w=1.0, mat='ivory', knob=True):
    c.new()
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
        rr = w * (1.6 if knob and (f < 0.1 or f > 0.9) else 1.0)
        for yy in range(int(y - rr) - 1, int(y + rr) + 2):
            for xx in range(int(x - rr) - 1, int(x + rr) + 2):
                if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= rr:
                    c.setv(xx, yy, mat, 0.86 - 0.35 * ((yy + 0.5 - y) / max(rr, 0.6)) - 0.1 * ((xx + 0.5 - x) / max(rr, 0.6)))


def bone_pile():
    W, Hh = 32, 16
    c = C(W, Hh, seed=881)
    _bone(c, 3, 11, 14, 8, 1.1)          # 넓적다리뼈
    _bone(c, 17, 12, 27, 13, 0.9)
    _bone(c, 9, 13, 18, 10, 0.8)
    c.new()                               # 갈비 토막(호)
    for k in range(3):
        for j in range(7):
            x = 20 + k * 3 + j * 0.3; y = 5 + j - (j * j) / 10
            c.tone(int(x), int(y), 'ivory', 5 if j < 3 else 4)
    c.new(); c.ellipsoid(27, 6, 3.4, 2.4, 'ivory', amb=0.3, bias=0.05)          # 작은 짐승 머리뼈(옆, 주둥이 왼쪽)
    for (x, y) in ((24, 6), (23, 7), (22, 7)): c.tone(x, y, 'ivory', 4)
    c.tone(27, 5, 'dark', 1); c.tone(28, 7, 'ivory', 2)
    return F(c)


def quern_stone():
    W, Hh = 16, 16
    c = C(W, Hh, seed=891); c.shadow(8, 13, 7, 1.6, 80)
    c.group(1); c.new()
    for y in range(5, 14):
        for x in range(1, 15):
            dx = (x + 0.5 - 8) / 7.0; dy = (y + 0.5 - 9.5) / 4.0
            if dx * dx + dy * dy <= 1:
                top = dy < 0.25
                c.setv(x, y, 'stone', (0.85 - 0.25 * dx - 0.15 * abs(dx) ** 2) if top else 0.5 - 0.15 * dx)
    for x in range(4, 12): c.tone(x, 8, 'stone', 4)            # 오목하게 닳은 가운데
    for (x, y) in ((6, 9), (8, 8), (10, 9), (7, 8)): c.tone(x, y, 'cream', 5)       # 빻은 낟알 가루
    c.group(2); c.new(); c.ellipsoid(9, 6, 3.2, 1.8, 'stone', amb=0.3, bias=0.1, bump=0.3)   # 갈돌
    return F(c)


# ---------------------------------------------------------------- 창 걸이: 갈래 기둥 둘 + 가로대, 돌촉 창 셋이 기대어 섰다
def spear_rack():
    W, Hh = 32, 48
    c = C(W, Hh, seed=901); c.shadow(16, 44, 13, 2.0, 90)
    c.group(1)
    for x in (5, 26):
        limb(c, [(x, 45), (x, 22)], [1.1, 0.9], 'bark', 902 + x)
        c.tone(x - 1, 21, 'bark', 5); c.tone(x + 1, 20, 'bark', 3)
    c.group(2); c.new()
    for x in range(3, 29): c.tone(x, 22, 'bark', 5 if x < 16 else 4); c.tone(x, 23, 'bark', 2)
    for k, (xb, xt) in enumerate(((9, 7), (15, 14), (22, 24))):
        c.group(3 + k); c.new()
        for y in range(6, 46):
            f = (y - 6) / 40.0; x = int(round(xt + (xb - xt) * f))
            c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
        # 돌촉(뗀석기: 각진 잎 모양, 흑요석) + 묶은 끈
        for j, w in enumerate((0, 1, 1, 2, 2, 1)):
            for i in range(-w, w + 1): c.tone(xt + i, j, 'stone', 5 if i <= 0 else 2) if j < 6 else None
        for i in range(-1, 2): c.tone(xt + i, 6, 'rope', 4)
    return F(c)


# ---------------------------------------------------------------- 토템 기둥 둘(글자·얼굴 없음: 새긴 고리·지그재그·물감 띠)
def totem_carved():
    W, Hh = 16, 64
    c = C(W, Hh, seed=911); c.shadow(8, 61, 6.5, 1.6, 100)
    c.group(1); c.new()
    for y in range(8, 62):
        r = 4.6 + (0.6 if 54 <= y else 0)
        for x in range(int(8 - r) - 1, int(8 + r) + 2):
            u = (x + 0.5 - 8) / r
            if abs(u) > 1: continue
            seg = (y - 8) // 9; ly = (y - 8) % 9
            v = 0.82 - 0.5 * (u + 1) / 2
            if ly == 0: v -= 0.3                       # 새긴 홈
            elif ly == 1: v += 0.12                    # 홈 아래 턱
            c.setv(x, y, 'wood', v)
            # 칸마다 다른 무늬: 지그재그 / 마름모 / 세로 홈 / 물감 띠
            k = seg % 4
            if k == 0 and abs(ly - 4.5 - (abs((x % 4) - 2) - 1) * 1.5) < 0.6: c.tone(x, y, 'ochre', 4 if u < 0.2 else 2)
            elif k == 1 and (abs(x - 8) + abs(ly - 4.5)) in (2.5, 3.5): c.tone(x, y, 'wood', 1)
            elif k == 2 and x % 3 == 0 and 2 < ly < 8: c.darken(x, y, 2)
            elif k == 3 and 3 <= ly <= 5: c.tone(x, y, 'cream', 5 if u < 0 else 3)
    # 꼭대기: 펼친 날개 모양 판(새 날개를 본뜬 추상 판) — 위에서 본 두께
    c.group(2); c.new()
    for y in range(2, 10):
        for x in range(0, 16):
            ddx = abs(x + 0.5 - 8)
            if ddx <= 8 - (y - 2) * 0.35 and y >= 2 + (ddx > 5) * (ddx - 5) * 0.8:
                c.setv(x, y, 'wood', 0.95 - 0.04 * x - 0.03 * (y - 2))
    for x in range(1, 15):
        if c.m[7][x]: c.tone(x, 7, 'ochre', 4 if x < 8 else 3)
    for x in range(2, 14, 3): c.tone(x, 4, 'wood', 2) if c.m[4][x] else None
    im = F(c); px = im.load(); tufts(px, W, Hh, 1, 15, 62, 912, 0.55, 3)
    return im


def totem_bone():
    W, Hh = 16, 64
    c = C(W, Hh, seed=921); c.shadow(8, 61, 6, 1.5, 100)
    c.group(1); limb(c, [(8, 62), (8, 18)], [2.2, 1.8], 'bark', 922)
    # 기둥에 감은 가죽 끈 띠
    c.new()
    for y in (30, 31, 44, 45):
        for x in range(5, 12): c.tone(x, y, 'hide2', 4 if x < 8 else 2)
    # 꼭대기: 뿔 달린 큰 짐승 머리뼈(앞에서 본 모양: 넓적한 이마, 두 눈구멍, 좁아지는 주둥이) — 사람 얼굴 아님
    c.group(2); c.new()
    for y in range(10, 27):
        f = (y - 10) / 16.0
        r = 5.6 * (1 - 0.55 * f) if f > 0.35 else 5.6
        for x in range(int(8 - r) - 1, int(8 + r) + 2):
            u = (x + 0.5 - 8) / r
            if abs(u) <= 1: c.setv(x, y, 'ivory', 0.92 - 0.4 * (u + 1) / 2 - 0.12 * f)
    for (x, y) in ((5, 15), (6, 15), (10, 15), (11, 15), (5, 16), (11, 16)): c.tone(x, y, 'dark', 1)      # 눈구멍(가로로 길고 위로 치켜든 것)
    c.tone(6, 16, 'dark', 2); c.tone(10, 16, 'dark', 2)
    for (x, y) in ((7, 24), (9, 24), (8, 25)): c.tone(x, y, 'ivory', 2)                                     # 콧구멍 홈
    for y in range(18, 23): c.tone(8, y, 'ivory', 4)
    # 뿔(옆으로 뻗다 위로 휜다)
    c.group(3)
    for sgn in (-1, 1):
        c.new()
        for i in range(12):
            f = i / 11.0; x = 8 + sgn * (4 + f * 5); y = 12 - f * f * 8
            r = 1.4 * (1 - f) + 0.5
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r: c.tone(xx, yy, 'ivory', 5 if sgn < 0 else 3)
    # 늘어뜨린 깃털·가죽 술
    c.group(4)
    for (x, L, m) in ((4, 9, 'hide'), (12, 8, 'hide2')):
        c.new()
        for j in range(L): c.tone(x, 27 + j, m, 4 if j < L - 2 else 3)
        c.tone(x, 27 + L, 'cream', 6); c.tone(x, 28 + L, 'cream', 5)
    im = F(c); px = im.load(); tufts(px, W, Hh, 1, 15, 62, 923, 0.55, 3)
    return im


# ---------------------------------------------------------------- 벽화 바위: 큰 둥근 바위 앞면에 붉은 흙·흰 흙 물감 무늬(소용돌이·점 줄·지그재그·짐승 발자국 같은 점무늬)
def _rock_body(c, cx, by, rx, ry, top, seed, mat='stone'):
    """덩어리 바위: 앞면(아래)과 윗면(위, 밝다)이 갈리는 3/4 바위. 반환: 앞면 화소 판정 함수."""
    c.new()
    for y in range(int(top), int(by) + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            f = (y - top) / max(1.0, (by - top))
            ww = rx * (0.62 + 0.38 * math.sin(math.pi * min(1.0, 0.25 + f * 0.85)))
            ww += (vnoise(y, 0, 3.0, seed) - 0.5) * 2.4
            if abs(x + 0.5 - cx) > ww: continue
            u = (x + 0.5 - cx) / ww
            topface = f < 0.30 + 0.08 * math.cos(u * 2.0)
            if topface: v = 0.95 - 0.22 * u - 0.1 * f
            else: v = 0.62 - 0.30 * u - 0.10 * (f - 0.3)
            c.setv(x, y, mat, v)
    return lambda x, y: c.m[y][x] == mat and (y - top) / max(1.0, (by - top)) >= 0.32


def painted_rock():
    W, Hh = 64, 48
    c = C(W, Hh, seed=931); c.shadow(33, 44, 30, 3.2, 110)
    c.group(1)
    front = _rock_body(c, 32, 44, 30, 5, 3, 932)
    c.group(2); c.new(); c.ellipsoid(53, 39, 9, 5.5, 'stone', amb=0.2, bias=-0.04, bump=0.55)          # 곁에 붙은 작은 바위
    # 앞면 금·결
    for (x0, y0, x1, y1) in ((14, 20, 17, 30), (44, 18, 46, 27), (29, 34, 33, 41)):
        c.line(x0, y0, x1, y1, 'stone', 1)
    # 이끼·잔풀은 아랫단과 윗면 가장자리에만
    for i in range(40):
        x = int(4 + H(i, 1, 933) * 56); y = int(8 + H(i, 2, 933) * 36)
        if c.m[y][x] == 'stone' and (y > 38 or y < 12) and H(i, 3, 933) > 0.4: c.tone(x, y, 'moss', 3 + (i % 2))
    # 물감 무늬(앞면에만): 큰 소용돌이 둘, 점 줄, 지그재그 띠, 손바닥 아닌 세 갈래 발자국 점무늬
    def paint(x, y, t, mat='ochre'):
        if 0 <= x < W and 0 <= y < Hh and front(x, y): c.tone(x, y, mat, t)
    def spiral(cx, cy, turns, scale, mat='ochre', t=4):
        n = int(turns * 40)
        for i in range(n):
            a = i / 40 * 6.283; r = scale * i / n * turns
            paint(int(round(cx + math.cos(a) * r)), int(round(cy + math.sin(a) * r * 0.8)), t, mat)
    spiral(17, 26, 2.2, 2.6)
    spiral(43, 28, 1.8, 2.4, 'cream', 5)
    for i in range(7): paint(24 + i * 2, 21 + (i % 2), 4)                                               # 점 줄
    for i in range(16):                                                                                   # 지그재그 띠
        paint(22 + i, 36 - abs((i % 4) - 2), 3)
    for (fx, fy) in ((30, 27), (34, 30)):                                                                 # 세 갈래 발자국
        for (dx, dy) in ((0, 0), (-1, -2), (1, -2), (0, -2), (-2, -1), (2, -1)): paint(fx + dx, fy + dy, 2)
    for (x, y) in ((50, 22), (51, 24), (52, 22), (51, 20)): paint(x, y, 5, 'cream')
    im = F(c); px = im.load()
    tufts(px, W, Hh, 2, 62, 46, 934, 0.5, 4)
    return im


def painted_stone():
    W, Hh = 32, 32
    c = C(W, Hh, seed=941); c.shadow(16, 29, 14, 2.2, 100)
    c.group(1); front = _rock_body(c, 16, 29, 13.5, 4, 5, 942)
    def paint(x, y, t, mat='ochre'):
        if 0 <= x < W and 0 <= y < Hh and front(x, y): c.tone(x, y, mat, t)
    for i in range(30):
        a = i / 12 * 6.283; r = 0.22 * i
        paint(int(round(12 + math.cos(a) * r)), int(round(20 + math.sin(a) * r * 0.8)), 4)
    for i in range(9): paint(18 + i, 23 - abs((i % 4) - 2), 5, 'cream')
    for i in range(4): paint(19 + i * 2, 17, 4)
    im = F(c); px = im.load(); tufts(px, W, Hh, 2, 30, 30, 943, 0.5, 3)
    return im


def ochre_bowls():
    """물감 그릇: 납작돌 위 붉은·흰·검은 물감을 갠 작은 그릇 셋 + 붓 대신 쓰는 깃."""
    W, Hh = 32, 16
    c = C(W, Hh, seed=951); c.shadow(16, 13, 14, 1.8, 80)
    c.group(1); c.new()
    for y in range(7, 14):
        for x in range(1, 31):
            if ((x + 0.5 - 16) / 15.0) ** 2 + ((y + 0.5 - 10.5) / 3.6) ** 2 <= 1: c.setv(x, y, 'stone', 0.82 - 0.02 * x if y < 11 else 0.48)
    for k, (x, m) in enumerate(((8, 'ochre'), (16, 'cream'), (24, 'char'))):
        c.group(2 + k); c.new()
        for y in range(5, 10):
            for xx in range(x - 4, x + 5):
                dx = (xx + 0.5 - x) / 3.8; dy = (y + 0.5 - 7.5) / 2.4
                if dx * dx + dy * dy <= 1: c.setv(xx, y, 'pot', 0.75 - 0.3 * dx)
        for xx in range(x - 2, x + 3): c.tone(xx, 6, m, 4 if m != 'char' else 2); c.tone(xx, 7, m, 3 if m != 'cream' else 5)
    c.group(6); c.new()
    for j in range(7): c.tone(25 + j // 2, 1 + j, 'cream', 6 if j < 3 else 4)
    return F(c)


def hide_drum():
    W, Hh = 16, 24
    c = C(W, Hh, seed=961); c.shadow(8, 21, 7, 1.6, 80)
    c.group(1); c.cylinder(8, 8, 19, 6.2, 'wood', cap=False, amb=0.25)
    c.group(2); c.new()
    for y in range(5, 12):
        for x in range(1, 16):
            dx = (x + 0.5 - 8) / 6.6; dy = (y + 0.5 - 8) / 2.8
            if dx * dx + dy * dy <= 1: c.setv(x, y, 'hide', 0.95 - 0.15 * dx)
    c.group(3); c.new()
    for y in range(11, 19):                                   # 엇갈려 묶은 끈
        for x in range(2, 15):
            if (x + y) % 4 == 0 and c.m[y][x] == 'wood': c.tone(x, y, 'rope', 4 if x < 8 else 3)
            if (x - y) % 4 == 0 and c.m[y][x] == 'wood': c.tone(x, y, 'rope', 3)
    for i in range(5): c.tone(4 + i, 7 + (i % 2), 'ochre', 4)
    return F(c)


def fur_bedding():
    W, Hh = 32, 16
    c = C(W, Hh, seed=971); c.shadow(16, 12, 14, 1.8, 70)
    c.group(1); c.new()
    for y in range(3, 14):
        for x in range(1, 31):
            dx = (x + 0.5 - 16) / 14.5; dy = (y + 0.5 - 8.5) / 5.0
            wob = (vnoise(x, y, 2.0, 972) - 0.5) * 0.5
            if dx * dx + dy * dy + wob * 0.6 <= 1: c.setv(x, y, 'fur', 0.78 - 0.22 * dx - 0.2 * dy + wob * 0.3)
    for i in range(40):                                        # 털 결: 짧은 밝은/어두운 획
        x = int(3 + H(i, 1, 973) * 26); y = int(4 + H(i, 2, 973) * 8)
        if c.m[y][x] == 'fur':
            c.lighten(x, y, 1) if i % 2 else c.darken(x, y + 1, 1)
    c.group(2); c.new()
    for y in range(6, 12):
        for x in range(19, 29):
            if ((x + 0.5 - 24) / 5) ** 2 + ((y + 0.5 - 9) / 2.6) ** 2 <= 1: c.setv(x, y, 'hide', 0.8 - 0.05 * (x - 19))   # 개어 둔 가죽
    for x in range(20, 28): c.tone(x, 9, 'hide', 2) if c.m[9][x] else None
    return F(c)

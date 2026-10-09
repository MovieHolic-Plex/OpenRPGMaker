# 대초원(veldt) 조각 — 마른 풀·고목·바위·뼈·야영 흔적·물웅덩이. 손 도트(px2.C 부피 화가 + pz.fin), 버들항 팔레트 + 마른 풀 램프.
# 모든 함수는 RGBA Image 를 돌려준다. 결정적.
import math
from vc_base import *
from px2 import _hash, vnoise
import plains_pieces as PP
from plains_pieces import limb, leafblob

# ================================================================ 마른 풀(땅 장식, 걷기·사람 아래)
def drygrass_a():
    c = C(16, 16, seed=701)
    blades(c, [(2, 10, -2, 3), (4, 13, 1, 4), (6, 9, -1, 3), (8, 14, 2, 4), (10, 11, 1, 3), (12, 8, 2, 3), (13, 12, -1, 4)])
    c.new()
    for (x, y) in ((5, 14), (9, 15), (11, 14)): c.tone(x, y, 'olive', 3)
    return c.img(False)

def drygrass_b():
    c = C(32, 16, seed=702)
    blades(c, [(1, 8, -1, 3), (3, 12, 1, 4), (6, 14, -2, 4), (9, 10, 2, 3), (11, 15, 1, 4), (14, 12, -1, 4), (16, 9, 1, 3),
               (19, 14, 2, 4), (21, 11, -1, 3), (24, 15, 1, 4), (26, 10, 2, 3), (28, 13, -1, 4), (30, 8, 1, 3)])
    for (x, y) in ((6, 1), (11, 0), (19, 1), (24, 0)):                                  # 이삭(씨앗 머리)
        c.tone(x, y, 'dry', 6); c.tone(x, y + 1, 'dry', 5); c.tone(x + 1, y + 1, 'dry', 4)
    return c.img(False)

def drygrass_tall():
    """키 큰 마른 풀(16x32): 사람 키만 한 억새 줄기 + 깃털 이삭. 맨 아래 칸만 그려진 땅에 닿는다(장식, 걷기)."""
    c = C(16, 32, seed=703)
    for (x, h, dx, t0) in ((2, 20, -2, 3), (4, 27, 1, 4), (7, 30, -1, 4), (9, 24, 2, 3), (11, 29, 1, 4), (13, 21, 2, 3)):
        c.new()
        for k in range(h):
            xx = x + int(round(dx * (k / max(1, h - 1)) ** 1.6)); yy = 31 - k
            c.tone(xx, yy, 'dry', t0 if k < h * 0.4 else (min(5, t0 + 1) if k < h - 4 else 6))
            if k < h * 0.35: c.tone(xx + 1, yy, 'dry', 2 if k < 3 else max(2, t0 - 1))
        tx = x + dx; ty = 31 - h                                                        # 깃털 이삭
        for (ex, ey, t) in ((0, 0, 6), (0, 1, 5), (1, 1, 6), (-1, 2, 5), (1, 2, 4), (0, 3, 5), (-1, 4, 4), (1, 4, 5), (0, 5, 4)):
            c.tone(tx + ex, ty + ey, 'dry', t)
    c.new()
    for (x, y) in ((3, 30), (8, 31), (12, 30), (5, 29)): c.tone(x, y, 'olive', 3)
    return c.img(False)

def tuft_low():
    """잔 풀 덩이(16x16): 밑은 올리브 초록, 끝은 마른 금빛. 빈 풀밭을 메우는 기본 장식."""
    c = C(16, 16, seed=704)
    blades(c, [(3, 6, -1, 3), (5, 8, 1, 3), (7, 9, 0, 4), (9, 7, 1, 3), (11, 6, 2, 3)], mat='olive')
    blades(c, [(4, 9, -1, 4), (8, 10, 1, 4), (10, 8, 2, 4)])
    return c.img(False)

def tuft_seed():
    """씨앗 맺힌 잔 풀(16x16) — 흰 솜털 이삭 셋."""
    c = C(16, 16, seed=705)
    blades(c, [(3, 7, -1, 3), (6, 10, 1, 3), (9, 11, 0, 4), (12, 8, 1, 3)])
    for (x, y) in ((5, 4), (9, 3), (13, 6)):
        c.tone(x, y, 'cream', 6); c.tone(x - 1, y + 1, 'cream', 5); c.tone(x + 1, y + 1, 'cream', 5); c.tone(x, y + 1, 'cream', 6); c.tone(x, y + 2, 'cream', 4)
    return c.img(False)

def flowers_dry():
    """초원 들꽃(16x16 땅 장식): 마른 풀 사이 주황·노랑 작은 꽃 다섯 + 올리브 잎."""
    c = C(16, 16, seed=706)
    for i, (x, y) in enumerate(((3, 5), (9, 3), (13, 7), (6, 10), (11, 12))):
        c.new()
        for k in range(3): c.tone(x, y + 1 + k, 'olive', 3)
        c.tone(x - 1, y + 3, 'olive', 4)
        col = ('cloth', 5) if i % 2 == 0 else ('gold', 5)
        c.tone(x, y, 'gold', 6 if i % 2 else 4)
        for dx, dy in ((-1, 0), (1, 0), (0, -1)): c.tone(x + dx, y + dy, col[0], col[1])
    return c.img(False)

def tracks():
    """짐승 발자국(16x16 땅 장식): 갈라진 굽 자국 넷, 대각선으로."""
    o = Image.new('RGBA', (16, 16)); px = o.load()
    E = [hx(x) for x in PAL['earth']]
    for (x, y) in ((2, 11), (7, 8), (5, 13), (10, 5), (12, 10), (14, 2)):
        for (dx, dy, t) in ((0, 0, 2), (2, 0, 2), (0, 1, 1), (2, 1, 1), (1, 2, 3)):
            if 0 <= x + dx < 16 and 0 <= y + dy < 16: px[x + dx, y + dy] = E[t] + (230,)
    return o

# ================================================================ 나무
def acacia():
    """우산 모양 초원 나무(64x48): 갈라진 줄기 + 납작하고 넓은 수관(윗면 밝음). 줄기 밑변 = 줄기 폭(2칸 가운데)."""
    c = C(64, 48, seed=711); c.shadow(32, 45.5, 16, 2.6, 90)
    c.group(1)
    limb(c, [(31, 46), (31, 38), (29, 30), (24, 22), (16, 15)], [2.6, 2.2, 1.8, 1.4, 1.0], 'bark', 3)
    limb(c, [(31, 34), (36, 27), (43, 20), (50, 15)], [1.8, 1.5, 1.2, 0.9], 'bark', 4)
    limb(c, [(30, 30), (31, 22), (33, 14)], [1.3, 1.0, 0.8], 'bark', 5)
    limb(c, [(24, 22), (28, 16)], [0.9, 0.6], 'bark', 6)
    c.new()
    for (x, y) in ((30, 45), (33, 45), (29, 46), (34, 46)): c.tone(x, y, 'bark', 3)       # 밑동 뿌리
    c.group(2)
    for (cx, cy, rx, ry, b) in ((32, 12, 29, 7.5, -0.02), (15, 14, 13, 5.5, -0.06), (49, 14, 13, 5.5, -0.08), (32, 9, 20, 5.5, 0.08),
                                (22, 8, 10, 4.2, 0.12), (42, 8, 10, 4.2, 0.06)):
        leafblob(c, cx, cy, rx, ry, b, bump=0.55, mat='leaf')
    for i in range(60):
        x = int(4 + _hash(i, 1, 712) * 56); y = int(3 + _hash(i, 2, 712) * 15)
        if c.m[y][x] == 'leaf' and y > 13 and _hash(i, 3, 712) > 0.5: c.tone(x, y, 'olive', 2)
    return F(c)

def dead_snag():
    """초원 고사목(32x48): 껍질 벗은 은회색 줄기, 부러진 꼭대기, 옆가지 둘. 밑변 1칸."""
    c = C(32, 48, seed=713); c.shadow(16, 45.4, 8, 1.8, 80)
    limb(c, [(16, 46), (16, 38), (17, 28), (15, 18), (16, 9)], [3.2, 2.6, 2.2, 1.8, 1.6], 'gwood', 3)
    limb(c, [(16, 30), (22, 25), (25, 18), (24, 12)], [1.4, 1.1, 0.8, 0.5], 'gwood', 4)
    limb(c, [(15, 22), (9, 19), (5, 12)], [1.2, 0.9, 0.6], 'gwood', 5)
    limb(c, [(9, 19), (6, 21)], [0.6, 0.4], 'gwood', 6)
    for (x, y) in ((15, 8), (16, 8), (17, 9), (14, 9)): c.tone(x, y, 'gwood', 2)           # 부러진 끝
    c.tone(16, 7, 'gwood', 5); c.tone(14, 8, 'gwood', 4)
    for (x, y) in ((15, 36), (17, 31), (16, 24), (16, 41)): c.tone(x, y, 'gwood', 1)         # 갈라진 결
    for (x, y) in ((14, 38), (14, 26)): c.tone(x, y, 'gwood', 6)
    c.new()
    for (x, y) in ((13, 45), (19, 45), (12, 46)): c.tone(x, y, 'dry', 4)
    return F(c)

def thornbush_dry():
    """마른 가시덤불(32x16): 잎 적은 회갈색 잔가지 덩이."""
    c = C(32, 16, seed=714); c.shadow(16, 13.6, 13, 1.6, 70)
    for (cx, cy, rx, ry) in ((10, 9, 8, 5.5), (21, 9, 9, 5.8), (16, 7, 6, 4.5)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'olive', amb=0.22, bump=0.7, bsc=1.8)
    for i in range(26):
        x = int(2 + _hash(i, 1, 715) * 28); y = int(2 + _hash(i, 2, 715) * 11)
        if c.m[y][x]: c.tone(x, y, 'bark', 2 + (i % 3));
    for (x, y) in ((3, 6), (28, 5), (15, 2), (8, 3), (24, 3)): c.tone(x, y, 'bark', 4); c.tone(x + 1, y - 1, 'bark', 5)
    return F(c)

# ================================================================ 바위
def kopje():
    """둥근 바위 더미 언덕(64x48): 초원에 솟은 따뜻한 회갈색 바위 셋~넷, 윗면 밝음, 틈에 마른 풀."""
    c = C(64, 48, seed=721); c.shadow(32, 44, 29, 3.4, 100)
    for (cx, cy, rx, ry, b) in ((20, 32, 16, 12, -0.02), (42, 33, 17, 12, -0.05), (31, 22, 14, 11, 0.06), (52, 39, 8, 6, -0.06), (8, 40, 7, 5, -0.05)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'sstone', amb=0.18, bias=b, bump=0.45, bsc=3.2)
    for (x0, y0, x1, y1) in ((27, 16, 31, 24), (14, 30, 19, 36), (44, 28, 46, 36)): c.line(x0, y0, x1, y1, 'sstone', 1)
    c.new()
    for (x, y, h) in ((30, 33, 6), (33, 34, 5), (10, 36, 4), (54, 34, 4), (24, 44, 4)):
        for k in range(h): c.tone(x + (k % 2), y - k, 'dry', 4 if k < h - 1 else 6)
    return F(c)

def boulder_flat():
    """납작 바위(32x32): 윗면이 넓게 보이는 판 바위."""
    c = C(32, 32, seed=722); c.shadow(16, 28.6, 14, 2.4, 90)
    c.new(); c.cylinder(16, 15, 24, 13.5, 'sstone', cap=True, capry=7.0, amb=0.22)
    c.new(); c.ellipsoid(11, 13, 6, 3.2, 'sstone', amb=0.3, bias=0.12, bump=0.3)
    for (x0, y0, x1, y1) in ((19, 11, 23, 15), (8, 22, 12, 26)): c.line(x0, y0, x1, y1, 'sstone', 2)
    for (x, y) in ((4, 27), (27, 27), (28, 26)): c.tone(x, y, 'dry', 4)
    return F(c)

def rocks_s():
    c = C(16, 16, seed=723)
    for (cx, cy, rx, ry) in ((5, 11, 3.8, 2.8), (11, 12, 3.2, 2.4), (9, 8.5, 2.6, 2.0)):
        c.new(); c.ellipsoid(cx, cy, rx, ry, 'sstone', amb=0.2, bump=0.4)
    return F(c)

def termite_mound():
    """흙 개미탑(16x32): 붉은 흙 뾰족 탑, 윗부분 두 갈래, 밑동 넓다. 밑동 1칸 막힘."""
    c = C(16, 32, seed=724); c.shadow(8, 29.4, 7, 1.6, 90)
    def v(x, y):
        return 0.80 - 0.5 * ((x - 3) / 10.0) - 0.08 * (y / 32.0)
    c.poly([(6, 4), (9, 3), (11, 12), (13, 22), (14, 29), (2, 29), (3, 22), (5, 12)], 'dirt', v, grain=True)
    c.poly([(9, 8), (11, 7), (12, 14), (10, 15)], 'dirt', 0.5, grain=True)
    for (x, y) in ((6, 14), (8, 20), (5, 24), (10, 25), (7, 9)): c.tone(x, y, 'dirt', 1)        # 구멍
    for (x, y) in ((5, 12), (4, 19), (4, 26)): c.tone(x, y, 'dirt', 6)
    return F(c)

# ================================================================ 뼈
def skull_horned():
    """뿔 달린 짐승 두개골(32x16 땅 장식): 굽은 뿔 둘 + 머리뼈. 걷기 불가 칸 아님(작은 장식)."""
    c = C(32, 16, seed=731); c.shadow(16, 13.5, 11, 2.2, 110)
    c.new(); c.ellipsoid(16, 9, 5.2, 4.2, 'bonew', amb=0.3, bias=0.05)
    c.new(); c.ellipsoid(16, 12.5, 3.2, 2.2, 'bonew', amb=0.3)
    for (x, y) in ((14, 8), (18, 8)): c.tone(x, y, 'dark', 1); c.tone(x, y + 1, 'dark', 2)          # 눈구멍
    c.tone(15, 13, 'dark', 2); c.tone(17, 13, 'dark', 2)
    for side in (-1, 1):                                                                          # 뿔
        c.new()
        for k in range(14):
            a = k / 13.0
            x = 16 + side * (5 + k * 0.9); y = 7 - math.sin(a * 2.4) * 5 + a * 2
            c.tone(int(round(x)), int(round(y)), 'bonew', 5 if k < 9 else 4)
            if k < 8: c.tone(int(round(x)), int(round(y)) + 1, 'bonew', 3)
    return F(c)

def ribcage():
    """큰 짐승 갈비뼈(48x32): 등뼈 + 휜 갈비 여섯, 반쯤 풀에 묻힘. 아랫줄 1줄 막힘."""
    c = C(48, 32, seed=732); c.shadow(24, 26, 22, 4.0, 120)
    c.group(1); c.new()
    for x in range(4, 44):                                                                         # 등뼈
        y = 10 + int(round(math.sin(x / 9.0) * 1.2))
        c.tone(x, y, 'bonew', 5); c.tone(x, y + 1, 'bonew', 3)
        if x % 4 == 0: c.tone(x, y - 1, 'bonew', 6)
    for i, x0 in enumerate((10, 16, 22, 28, 34, 39)):                                             # 갈비(앞쪽 아래로 휜다)
        c.new()
        L = 15 - abs(i - 2.5) * 1.4
        for k in range(int(L)):
            f = k / L
            x = x0 - 3 * math.sin(f * 1.6); y = 11 + k
            c.tone(int(round(x)), int(y), 'bonew', 5 if f < 0.5 else 4); c.tone(int(round(x)) + 1, int(y), 'bonew', 3)
        c.new()
        for k in range(int(L * 0.6)):
            f = k / L
            x = x0 + 4 + 2 * math.sin(f * 1.6); y = 10 - k * 0.45
            c.tone(int(round(x)), int(round(y)), 'bonew', 4)
    c.group(2); c.new()
    for (x, h) in ((6, 5), (14, 6), (21, 4), (30, 6), (37, 5), (44, 4), (25, 7)):
        for k in range(h): c.tone(x + (k // 3), 27 - k, 'dry', 3 if k < h - 1 else 5)
    return F(c)

def bones_scatter():
    """흩어진 뼈 조각(16x16 땅 장식)."""
    c = C(16, 16, seed=733)
    for (x0, y0, x1, y1) in ((2, 11, 8, 9), (9, 13, 14, 12), (5, 5, 9, 6)):
        c.new(); c.line(x0, y0, x1, y1, 'bonew', 5); c.line(x0, y0 + 1, x1, y1 + 1, 'bonew', 3)
        c.tone(x0 - 1, y0, 'bonew', 6); c.tone(x1 + 1, y1, 'bonew', 4)
    return F(c)

# ================================================================ 야영 흔적
def tent_hide():
    """가죽 천막(48x48): 기둥 다섯이 꼭대기에서 엇갈리는 원뿔 천막, 무두질 가죽 조각을 이어 꿰맨 줄, 앞에 걷어 올린 입구."""
    c = C(48, 48, seed=741); c.shadow(24, 43.5, 21, 3.4, 100)
    c.group(1)
    def v(x, y):
        yy = (y - 8) / 34.0; half = 2 + 19 * yy
        dx = (x - 24.0) / max(half, 1)
        return 0.86 - 0.45 * (dx + 1) / 2 - 0.08 * yy
    c.poly([(22, 7), (26, 7), (45, 41), (3, 41)], 'hide', v, grain=True)
    c.new(); c.ellipsoid(24, 40.5, 21, 3.4, 'hide', amb=0.3, bias=-0.15)
    for k in range(3, 34, 7):                                                                       # 꿰맨 줄(가로)
        y = 8 + k; half = 2 + 19 * (k / 34.0)
        for x in range(int(24 - half) + 1, int(24 + half)):
            if c.m[y][x] == 'hide' and (x + y) % 2 == 0: c.tone(x, y, 'hide', 2)
    for xs in (-0.55, 0.3):                                                                          # 세로 이음
        for y in range(10, 40):
            half = 2 + 19 * ((y - 8) / 34.0); x = int(24 + xs * half)
            if c.m[y][x] == 'hide': c.tone(x, y, 'hide', 2)
    c.group(2); c.new()                                                                              # 입구
    for y in range(26, 41):
        hw = (y - 26) * 0.42 + 0.5
        for x in range(int(24 - hw), int(24 + hw) + 1): c.tone(x, y, 'dark', 1 if y > 29 else 2)
    for y in range(27, 41): c.tone(int(24 - (y - 26) * 0.42 - 1), y, 'hide', 6); c.tone(int(24 + (y - 26) * 0.42 + 1), y, 'hide', 4)
    c.group(3); c.new()                                                                              # 꼭대기 기둥 끝
    for (dx, k) in ((-5, 0), (-2, 1), (1, 2), (4, 3), (6, 4)):
        for j in range(7):
            x = 24 + int(round(dx * (1 - j / 7.0))); y = 1 + j
            c.tone(x, y, 'bark', 5 if dx < 0 else 3)
    c.group(4); c.new()
    for (x, y) in ((8, 33), (36, 30), (17, 19)):                                                     # 줄무늬 염색 조각
        for i in range(4): c.tone(x + i, y, 'red', 3); c.tone(x + i, y + 1, 'red', 2)
    return F(c)

def firepit_cold():
    """식은 모닥불 자리(32x16): 돌 고리 + 재 + 숯 된 장작. 연기·불 없음. 아랫줄 막힘 1칸 가운데."""
    c = C(32, 16, seed=742); c.shadow(16, 12, 13, 2.2, 60)
    c.new(); c.ellipsoid(16, 9, 9, 3.6, 'dark', amb=0.4, bias=0.05)
    for i in range(11):
        a = i / 11 * 6.283; x = 16 + math.cos(a) * 11; y = 9 + math.sin(a) * 4.6
        c.new(); c.ellipsoid(x, y, 2.8, 2.3, 'sstone', amb=0.22, bump=0.4)
    for (x0, y0, x1, y1) in ((11, 10, 20, 7), (13, 7, 21, 11)):
        c.new(); c.line(x0, y0, x1, y1, 'bark', 1); c.line(x0, y0 + 1, x1, y1 + 1, 'dark', 2)
    c.new()
    for (x, y) in ((15, 9), (18, 8), (13, 9), (17, 10)): c.tone(x, y, 'stone', 5)                    # 흰 재
    return F(c)

def hide_rack():
    """가죽 말리는 틀(32x32): 기둥 둘 + 가로대, 팽팽히 묶은 가죽 한 장(테두리 끈). 밑줄 기둥 칸 막힘."""
    c = C(32, 32, seed=743); c.shadow(16, 29.4, 13, 1.8, 80)
    c.group(1)
    for x0 in (3, 27):
        c.new()
        for y in range(3, 30): c.tone(x0, y, 'bark', 5); c.tone(x0 + 1, y, 'bark', 3)
        c.tone(x0, 2, 'bark', 6); c.tone(x0 + 1, 2, 'bark', 4)
    c.new()
    for x in range(1, 31): c.tone(x, 5, 'bark', 5); c.tone(x, 6, 'bark', 3)
    for x in range(3, 29): c.tone(x, 24, 'bark', 4); c.tone(x, 25, 'bark', 2)
    c.group(2); c.new()
    for y in range(8, 23):
        f = (y - 8) / 14.0
        half = 9 + 2.5 * math.sin(f * math.pi) - (2 if y in (8, 22) else 0)
        for x in range(int(16 - half), int(16 + half) + 1):
            dx = (x - 16) / max(half, 1)
            t = 5 if dx < -0.4 else (4 if dx < 0.3 else 3)
            if _hash(x, y, 744) > 0.9: t -= 1
            c.tone(x, y, 'hide', t)
    c.group(3); c.new()
    for (x0, y0, x1, y1) in ((5, 7, 8, 9), (26, 7, 23, 9), (5, 23, 8, 21), (26, 23, 23, 21), (16, 7, 16, 8)):
        c.line(x0, y0, x1, y1, 'rope', 5)
    return F(c)

def bedroll_hide():
    """털가죽 깔개(32x16 땅 장식): 짐승 털가죽 한 장 — 몸통 + 네 다리 자락 + 꼬리, 등줄 무늬."""
    c = C(32, 16, seed=745); c.shadow(16, 12.5, 13, 1.6, 50)
    c.new()
    for y in range(1, 16):
        for x in range(1, 31):
            d = ((x - 16) / 10.5) ** 2 + ((y - 8) / 4.6) ** 2
            leg = any(((x - lx) / 2.6) ** 2 + ((y - ly) / 2.2) ** 2 < 1 for (lx, ly) in ((8, 3), (24, 3), (8, 13), (24, 13)))
            tail = abs(y - 8 - (x - 27) * 0.25) < 1.2 and 26 <= x <= 30
            head = ((x - 4.5) / 2.6) ** 2 + ((y - 8) / 2.4) ** 2 < 1
            if d < 1 or leg or tail or head:
                t = 5 if y < 6 else (4 if y < 11 else 3)
                if _hash(x, y, 746) > 0.82: t -= 1
                c.tone(x, y, 'hide', t)
    for x in range(7, 26):
        if (x // 2) % 2 == 0: c.tone(x, 8, 'hide', 2); c.tone(x, 7, 'hide', 2) if x % 4 == 0 else None
    for (x, y) in ((10, 5), (15, 4), (20, 5), (12, 11), (19, 11)): c.tone(x, y, 'hide', 2)
    return F(c)

# ================================================================ 물웅덩이
def waterhole(Wp=96, Hp=64):
    """물웅덩이(96x64): 진흙 둑(마른 균열) + 고인 물 + 발자국 + 둑의 푸른 풀·갈대. 물·둑 칸 막힘."""
    Y, X = np.mgrid[0:Hp, 0:Wp].astype(float)
    cx, cy, rx, ry = Wp / 2 - 0.5, Hp / 2 + 1.5, Wp / 2 - 5, Hp / 2 - 7.5
    from px2 import vnoise as vn
    nz = np.vectorize(lambda x, y: vn(x, y, 6.0, 751) * 0.5 + vn(x, y, 2.5, 752) * 0.5)(X, Y)
    rr = np.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry) * (1 + (nz - 0.5) * 0.32)
    inside = rr <= 1.0; water = rr <= 0.78
    from scipy import ndimage as ndi
    wd = ndi.distance_transform_edt(water)
    t = 3.0 + (np.vectorize(lambda x, y: vn(x, y * 2.2, 8.0, 753))(X, Y) - 0.5) * 2.0 - (wd > 6) * 0.8 + (wd <= 2) * 0.9
    streak = (wl.hash2(X, Y // 3, 754) > 0.93) & (wl.hash2(X // 2, Y // 6, 755) > 0.35)
    t = np.clip(np.rint(np.where(streak, t + 2, t)), 2, 6).astype(int)
    T = P('teal')
    rgb = T[t].astype(int)
    rgb = np.where((water & (wd <= 1.0))[..., None], np.array(hx(PAL['earth'][2])), rgb)        # 물가 젖은 흙
    bank = inside & ~water
    E = P('earth')
    bt = np.where(wl.hash2(X, Y, 756) > 0.55, 4, 3)
    crack = (wl.hash2(X // 3, Y // 2, 757) > 0.9) & (wl.hash2(X, Y // 2, 758) > 0.35)
    bt = np.where(crack, 1, bt)
    rgb = np.where(bank[..., None], E[bt], rgb)
    a = np.where(inside, 255, 0).astype(np.uint8)
    tuft = ~inside & (ndi.distance_transform_edt(~inside) < 2.0) & (wl.hash2(X, Y, 759) > 0.5)
    tcol = np.array(OLIVE)[(wl.hash2(X, Y, 760) * 4 + 2).astype(int).clip(2, 5)]
    rgb = np.where(tuft[..., None], tcol, rgb); a = np.where(tuft, 255, a)
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA').copy(); px = im.load()
    for y in range(Hp):
        for x in range(Wp):
            if bank[y, x]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < Wp and 0 <= yy < Hp and not inside[yy, xx] and not tuft[yy, xx]: px[x, y] = hx(PAL['earth'][1]) + (255,); break
    tr = tracks()
    im.alpha_composite(tr, (int(Wp * 0.62), int(Hp * 0.72))); im.alpha_composite(tr, (int(Wp * 0.12), int(Hp * 0.18)))
    c = C(Wp, Hp, seed=761)
    sx, sy = Wp / 64.0, Hp / 48.0
    for (x, y, h) in ((7, 33, 12), (10, 35, 15), (13, 34, 10), (54, 31, 13), (51, 33, 10), (57, 33, 11), (20, 40, 8), (45, 39, 9), (30, 42, 7)):
        x = int(x * sx); y = int(y * sy)
        c.new()
        for k in range(h): c.tone(x + (k // 6), y - k, 'olive', 4 if k < h - 3 else 5); c.tone(x + 1 + (k // 6), y - k, 'olive', 3)
        c.tone(x + (h // 6), y - h, 'bark', 4); c.tone(x + (h // 6), y - h - 1, 'bark', 5)
    im.alpha_composite(c.img(False))
    return im

def reeds():
    """둑 갈대 무리(16x32): 부들 이삭 셋 + 초록 줄기."""
    c = C(16, 32, seed=762)
    for (x, h, dx) in ((3, 18, -1), (6, 24, 1), (9, 21, 0), (12, 16, 2), (8, 13, -1)):
        c.new()
        for k in range(h):
            xx = x + int(round(dx * k / h)); yy = 31 - k
            c.tone(xx, yy, 'olive', 3 if k < h * 0.5 else 4); c.tone(xx + 1, yy, 'olive', 2)
        if h > 15:
            for j in range(4): c.tone(x + dx, 31 - h - j, 'bark', 4 if j else 5); c.tone(x + dx + 1, 31 - h - j, 'bark', 3)
    return c.img(False)

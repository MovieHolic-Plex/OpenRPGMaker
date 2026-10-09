# 고딕 마을 새 소품 — px2.C(칩셋 7단 램프 + 결)로 낮 재료 손 도트 → gloom 등급. 3/4 시점(윗면+앞면), 빛 왼쪽 위. 결정적.
from gv_build import *
import rv_props as VP
from rv_base import tufts, cobweb
from plains_pieces import limb

def F(c): return pz.fin(c)
def G(im, k=0.92): return gloom(im, GD, k)

# ================================================================ 지붕 덮인 돌 우물
def well_roofed():
    """지붕 덮인 돌 우물(2x3칸): 둥근 마름돌 우물통(검은 물), 양쪽 나무 기둥 위 가파른 널 지붕(박공 정면), 도르래 굴대·밧줄·두레박."""
    c = C(32, 48, seed=701); c.shadow(16, 44, 15, 3, 90)
    c.group(1); c.new(); c.cylinder(16, 32, 43, 13.5, 'stone', cap=True, capry=5.0, amb=0.28)
    for y in range(30, 44):
        for x in range(2, 30):
            if c.m[y][x] == 'stone' and y > 33:
                if (y - 34) % 4 == 3: c.darken(x, y, 1)
                elif (x + ((y - 34) // 4) * 3) % 7 == 0: c.darken(x, y, 1)
    c.group(2); c.new()
    for y in range(29, 36):
        for x in range(5, 28):
            if ((x + 0.5 - 16) / 10.5) ** 2 + ((y + 0.5 - 32.2) / 3.3) ** 2 < 1: c.tone(x, y, 'dark', 1 if y < 33 else 2)
    c.tone(13, 33, 'teal', 3); c.tone(14, 33, 'teal', 2)                                     # 검은 물에 비친 빛 한 점
    c.group(3); c.new()
    for y in range(12, 33):
        c.tone(4, y, 'wood', 5); c.tone(5, y, 'wood', 3); c.tone(26, y, 'wood', 4); c.tone(27, y, 'wood', 2)
    c.group(4); c.new()
    for x in range(4, 28): c.tone(x, 18, 'wood', 5 if x < 16 else 4); c.tone(x, 19, 'wood', 2)   # 도르래 굴대
    for x in (14, 15, 16, 17): c.tone(x, 17, 'wood', 6 if x < 16 else 4); c.tone(x, 20, 'wood', 3)
    c.group(5); c.new()
    for y in range(20, 27): c.tone(16, y, 'rope', 4 if y % 2 else 3)
    c.new(); c.cylinder(16, 27, 30, 2.6, 'wood', cap=True, capry=1.2, amb=0.3)              # 두레박
    c.group(6); c.new()                                                                    # 가파른 널 지붕(정면 삼각 + 처마)
    for y in range(0, 14):
        half = 2 + y * 1.18
        for x in range(32):
            d = abs(x + 0.5 - 16)
            if d > half: continue
            if d > half - 1.5: c.tone(x, y, 'wood', 5 if x < 16 else 2)                     # 박공 널(테)
            else:
                row = y // 3; ly = y % 3; xo = (x + (row % 2) * 2) % 4
                t = (5 if x < 16 else 3)
                if ly == 2: t -= 2                                                         # 널빤지 줄 아랫모 그늘
                elif xo == 3: t -= 1                                                       # 널 이음
                c.tone(x, y, 'slate', max(1, t))
    for x in range(0, 32): c.tone(x, 14, 'wood', 2)
    im = F(c); p = im.load()
    tufts(p, 32, 48, 0, 32, 47, 7, 0.45, 3, 0.5)
    return G(im)

# ================================================================ 묘비 셋
def tomb_obelisk():
    """오벨리스크 묘비(1x3칸): 두 단 받침돌(윗면 밝음) 위로 가늘어지는 네모 기둥, 꼭대기 피라미드 머리, 왼쪽 면 밝고 오른쪽 그늘."""
    c = C(16, 48, seed=711); c.shadow(8, 45, 7, 1.8, 90)
    c.box(1, 38, 14, 3, 7, 'stone'); c.box(3, 33, 10, 2, 5, 'stone', top=1.0, front=0.6)
    c.new()
    for y in range(7, 33):
        f = (y - 7) / 26.0; half = 2.2 + f * 1.6
        for x in range(16):
            d = x + 0.5 - 8
            if abs(d) > half: continue
            c.tone(x, y, 'stone', 5 if d < -half + 1.2 else (2 if d > half - 1.2 else 4))
    for y in range(2, 8):
        half = (y - 1) * 0.42
        for x in range(16):
            d = x + 0.5 - 8
            if abs(d) <= half + 0.3: c.tone(x, y, 'stone', 6 if d < 0 else 3)
    for y in (16, 17): c.tone(7, y, 'stone', 2); c.tone(8, y, 'stone', 2)                    # 새김 자리(글자 없는 빈 판 홈)
    im = F(c); p = im.load()
    tufts(p, 16, 48, 0, 16, 47, 3, 0.55, 3, 0.4)
    return G(im)

def tomb_cross_stone():
    """고리 돌 십자 묘비(1x2칸): 받침돌 위 돌 십자, 교차점에 둥근 고리, 윗면·왼모 밝게, 이끼 얼룩."""
    c = C(16, 32, seed=712); c.shadow(8, 29.6, 6.4, 1.6, 80)
    c.box(2, 24, 12, 2, 4, 'stone')
    c.new()
    for y in range(4, 24):
        c.tone(7, y, 'stone', 5); c.tone(8, y, 'stone', 4); c.tone(9, y, 'stone', 2)
    for x in range(2, 14):
        c.tone(x, 9, 'stone', 6 if x < 8 else 5); c.tone(x, 10, 'stone', 4); c.tone(x, 11, 'stone', 2)
    c.new()
    for y in range(5, 16):
        for x in range(3, 14):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 10.2)
            if 3.6 <= d <= 4.7 and c.m[y][x] is None: c.tone(x, y, 'stone', 5 if (x < 8 and y < 10) else 3)
    c.tone(7, 3, 'stone', 6); c.tone(8, 3, 'stone', 4)
    for (x, y) in ((8, 19), (7, 21), (9, 13), (4, 10)): c.tone(x, y, 'moss', 3)
    im = F(c); p = im.load(); tufts(p, 16, 32, 0, 16, 31, 5, 0.55, 3, 0.4)
    return G(im)

def grave_mound():
    """흙무덤(2x1칸): 길쭉한 흙 둔덕(윗면 밝음, 아래 그늘), 머리 쪽에 기운 나무 말뚝 표식, 둔덕에 시든 풀."""
    c = C(32, 16, seed=713); c.shadow(16, 12.5, 14, 2.6, 70)
    c.new(); c.ellipsoid(17, 10, 12.5, 3.8, 'dirt', amb=0.32, bias=0.08, bump=0.6)
    c.new()
    for y in range(1, 10): c.tone(4 + (9 - y) // 5, y, 'wood', 5); c.tone(5 + (9 - y) // 5, y, 'wood', 3)
    for x in range(3, 8): c.tone(x, 4, 'wood', 5); c.tone(x, 5, 'wood', 2)
    im = F(c); p = im.load(); tufts(p, 32, 16, 8, 28, 9, 11, 0.35, 2, 0.8)
    return G(im)

# ================================================================ 관·길가 사당
def coffin_trestle():
    """받침대 위 나무 관(2x2칸): 어깨가 넓은 육각 관 뚜껑(윗면, 널 결 · 쇠 손잡이), 앞면 옆판, 두 개의 X 받침 다리. 뚜껑은 닫혀 있다."""
    c = C(32, 32, seed=721); c.shadow(16, 28.5, 14, 2.6, 80)
    c.new()
    for (x0, y0) in ((6, 19), (22, 19)):
        for k in range(10):
            c.tone(x0 - 3 + k // 2, y0 + k, 'wood', 3); c.tone(x0 + 3 - k // 2, y0 + k, 'wood', 2)
    c.new()
    top = [(3, 13), (8, 9), (27, 9), (29, 13), (27, 17), (8, 17)]                        # 왼쪽이 머리(넓은 어깨)
    def inside(x, y):
        n = len(top); ins = False
        for i in range(n):
            (x1, y1), (x2, y2) = top[i], top[(i + 1) % n]
            if (y1 <= y + 0.5 < y2) or (y2 <= y + 0.5 < y1):
                if x + 0.5 < x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1): ins = not ins
        return ins
    for y in range(8, 19):
        for x in range(2, 31):
            if inside(x, y):
                t = 5 if y < 11 else 4
                if (y - 9) % 3 == 2: t -= 1
                c.tone(x, y, 'wood', t)
    for y in range(17, 21):                                                                 # 앞 옆판
        for x in range(8, 28):
            c.tone(x, y, 'wood', 3 if y < 20 else 2)
    for x in range(3, 9):
        yy = 13 + int((x - 3) * 4 / 5)
        for y in range(yy + 1, yy + 4): c.tone(x, y, 'wood', 2)
    for (x, y) in ((12, 18), (20, 18)): c.tone(x, y, 'iron', 5); c.tone(x + 1, y, 'iron', 3)
    for x in range(10, 25): c.tone(x, 13, 'wood', 6 if x % 4 else 3)                      # 뚜껑 가운데 돋은 띠
    im = F(c)
    return G(im)

def wayside_shrine():
    """길가 작은 사당(1x3칸): 나무 기둥 위 가파른 지붕을 얹은 작은 상자 감실, 안에 촛불 하나(호박빛), 밑동에 시든 꽃 다발."""
    c = C(16, 48, seed=722); c.shadow(8, 45.5, 5, 1.4, 80)
    c.new()
    for y in range(22, 46): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.new(); c.box(2, 12, 12, 2, 10, 'wood', top=0.9, front=0.5)
    for y in range(15, 21):
        for x in range(4, 12): c.tone(x, y, 'dark', 1 if y < 17 else 2)
    for y in range(1, 13):
        half = 0.8 + y * 0.62
        for x in range(16):
            d = abs(x + 0.5 - 8)
            if d <= half: c.tone(x, y, 'slate' if d < half - 1.2 else 'wood', (5 if x < 8 else 3) if d < half - 1.2 else (5 if x < 8 else 2))
    im = F(c); im = G(im); p = im.load()
    for (x, y, t) in ((7, 17, 6), (7, 18, 5), (7, 19, 2), (8, 19, 2), (7, 16, 4)): put(p, 16, 48, x, y, AMBER[t])   # 촛불·초
    for (x, y) in ((6, 15), (8, 15), (6, 16), (8, 16)):
        q = get(p, 16, 48, x, y); put(p, 16, 48, x, y, mix(q[:3], AMBER[3], 0.35))
    for (x, y, t) in ((5, 44, 4), (6, 43, 5), (10, 44, 3), (9, 43, 4), (4, 45, 2), (11, 45, 2)): put(p, 16, 48, x, y, BLOOD[t])   # 시든 꽃
    for (x, y) in ((5, 45), (6, 45), (9, 45), (10, 45)): put(p, 16, 48, x, y, GMOSS[3])
    return im

# ================================================================ 까마귀 앉은 고목
def dead_tree_crows():
    """까마귀 떼가 앉은 큰 고목(3x4칸): 큰 고목 가지마다 까마귀 넷(앉은 것·날개 편 것). 마을 어귀·묘지 표지."""
    base = VP.dead_tree_large()
    c = C(48, 64, seed=731)
    VP._crow(c, 9, 15); VP._crow(c, 37, 11, flip=True); VP._crow(c, 18, 24); VP._crow(c, 31, 19, flip=True)
    cr = F(c)
    o = base.copy(); o.alpha_composite(cr)
    return G(o)

# ================================================================ 바닥 덧그림(걷기)
def _decal_px(w, h):
    im = Image.new('RGBA', (w, h)); return im, im.load()

def leaves_scatter():
    """흩어진 낙엽(1칸, 땅 덧그림): 갈적·회갈 낙엽 열 몇 장이 바람에 몰린 자국."""
    im, p = _decal_px(16, 16)
    for k in range(13):
        x = 1 + int(H(k, 1, 741) * 13); y = 2 + int(H(k, 2, 741) * 12)
        Rr = LEAFR if H(k, 3, 741) > 0.45 else LEAFG; t = 3 + int(H(k, 4, 741) * 3.9)
        put(p, 16, 16, x, y, Rr[t]); put(p, 16, 16, x + 1, y, Rr[t - 1])
        if H(k, 5, 741) > 0.5: put(p, 16, 16, x, y + 1, Rr[t - 2])
    return im

def bones_scatter():
    """흩어진 작은 짐승 뼈(1칸, 땅 덧그림): 긴 뼈 두 토막과 작은 갈비 조각, 바랜 흰빛(피·살 없음)."""
    im, p = _decal_px(16, 16)
    def bone(x0, y0, n, dy=0):
        for i in range(n):
            put(p, 16, 16, x0 + i, y0 + (i * dy) // n, BONE[5 if i else 6]); put(p, 16, 16, x0 + i, y0 + 1 + (i * dy) // n, BONE[2])
        for (dx, dyy, t) in ((-1, -1, 5), (-1, 1, 4), (n, -1 + dy, 4), (n, 1 + dy, 3)): put(p, 16, 16, x0 + dx, y0 + dyy, BONE[t])
    bone(3, 5, 6, 1); bone(8, 10, 5, -1)
    for k in range(3):
        x = 3 + k * 2
        for j in range(3): put(p, 16, 16, x + (1 if j == 2 else 0), 11 + j, BONE[4 if j < 2 else 2])
    return im

def puddle_mud():
    """진흙 물웅덩이(2x1칸, 땅 덧그림): 흑회 진흙 둔덕 테 + 흐린 하늘을 비춘 검은 물, 가로 빛 줄 둘."""
    im, p = _decal_px(32, 16)
    for y in range(16):
        for x in range(32):
            d = ((x + 0.5 - 16) / 13.5) ** 2 + ((y + 0.5 - 8.5) / 5.2) ** 2 + (vnoise(x, y, 3.0, 751) - 0.5) * 0.35
            if d < 0.62:
                c = GPUD[2] if y > 6 else GPUD[3]
                if y in (8, 11) and H(x // 3, y, 752) > 0.35: c = GSHEEN[3]
                put(p, 32, 16, x, y, c)
            elif d < 0.85: put(p, 32, 16, x, y, MUD[4] if y < 8 else MUD[2])
            elif d < 1.0 and H(x, y, 753) > 0.4: put(p, 32, 16, x, y, MUD[3])
    return im

# 변형 5 — 손 도트 조각 (버들항 팔레트·px2 붓). 전부 좌표로 찍는다. 빛은 왼쪽 위, 물체 = 윗면 + 앞면.
from bd5 import *
import px2
from px2 import C
import pz

def fin(c): return pz.fin(c)

# ---------- 침엽수 ----------
def fir(w=32, h=48, tiers=4, seed=1, trunk=4, tall=1.0):
    """전나무: 밑동 줄기(폭 trunk px, 줄기 폭 그대로 내려온다) + 겹친 치마 단. 왼쪽이 밝고 단 밑이 어둡다."""
    c = C(w, h, seed=seed); cx = w // 2
    c.shadow(cx, h - 2, w * 0.38, 2.4)
    # 줄기
    c.new(); tx0 = cx - trunk // 2
    for y in range(h - 9, h - 1):
        for i in range(trunk):
            c.tone(tx0 + i, y, 'bark', 5 if i == 0 else (4 if i < trunk - 1 else 2))
    for i in range(trunk): c.tone(tx0 + i, h - 2, 'bark', 3 if i else 4)
    # 치마 단
    top = 1; bot = h - 7
    span = bot - top
    for t in range(tiers):
        y0 = top + int(span * (t / tiers) * (0.85 if t else 0.0)) if t else top
        y0 = top + int(t * span / (tiers + 0.55))
        y1 = top + int((t + 1) * span / (tiers + 0.55) + span * 0.55 / (tiers + 0.55) * (1 if t < tiers - 1 else 1.0))
        y1 = min(y1, bot)
        maxhw = 4 + (w // 2 - 5) * (t + 1) / tiers
        c.new()
        for y in range(y0, y1 + 1):
            f = (y - y0) / max(1, (y1 - y0))
            hw = 1 + (maxhw - 1) * (f ** 0.85)
            # 밑 가장자리를 톱니처럼 들쭉날쭉
            for x in range(int(cx - hw - 1), int(cx + hw + 2)):
                dx = x + 0.5 - cx
                edge = hw + (px2._hash(x, y, seed + t) - 0.5) * 1.6 * f
                if abs(dx) > edge: continue
                # 톱니: 단 아래쪽 3줄은 가지 끝 무늬로 안쪽이 빈다
                under = y > y1 - 2 and int((x + t * 2) % 4) in (1, 2) and abs(dx) > hw * 0.3
                if under and y == y1: continue
                lit = -dx / max(1.0, hw)                    # 왼쪽 +, 오른쪽 -
                tone = 3 + (1 if lit > 0.25 else 0) - (1 if lit < -0.35 else 0)
                if f > 0.72: tone -= 1                       # 단 밑은 그늘
                if y == y1 or under: tone -= 1
                if f < 0.28 and lit > -0.2: tone += 1        # 끝 볕
                if px2._hash(x, y, seed + 9) > 0.86: tone += 1
                elif px2._hash(x, y, seed + 5) > 0.9: tone -= 1
                c.tone(x, y, 'leaf', max(1, min(5, tone)))
    return fin(c)

# ---------- 이정표 ----------
def milestone(seed=2):
    """로마식 이정표(miliarium): 네모 받침 + 둥근 기둥 + 머리. 앞면에 글자 줄."""
    c = C(16, 24, seed=seed); c.shadow(8, 21.5, 6, 1.6)
    c.group(1)
    c.box(3, 16, 10, 2, 4, 'stone', top=0.85, front=0.58, bias=0.02)          # 받침
    c.group(2); c.cylinder(8, 5, 16, 4.4, 'stone', cap=True, capry=2, amb=0.28)
    c.group(3); c.cylinder(8, 3, 4, 5.4, 'stone', cap=True, capry=2.2, amb=0.3, bias=0.05)
    for y in (9, 11, 13):                                                       # 새긴 글자
        for x in range(6, 10 if y != 13 else 9):
            if px2._hash(x, y, seed) > 0.25: c.tone(x, y, 'stone', 2)
    return fin(c)

# ---------- 길가 사당 ----------
def shrine(seed=4):
    """길가 작은 사당(aedicula): 돌 받침, 기둥 둘, 박공 지붕, 안에 작은 조각상, 앞에 꽃."""
    c = C(32, 36, seed=seed); c.shadow(16, 32.5, 13, 2.2)
    c.group(1); c.box(4, 27, 24, 2, 4, 'stone', top=0.88, front=0.6)          # 받침
    c.group(2); c.new()
    for y in range(12, 27):                                                     # 안쪽 벽(그늘)
        for x in range(8, 24): c.tone(x, y, 'stone', 2 if (x < 12 or y < 15) else 1)
    for x0 in (6, 22):                                                          # 기둥
        c.new()
        for y in range(11, 27):
            for i in range(3): c.tone(x0 + i, y, 'stone', (5, 4, 2)[i] if y > 13 else (4, 3, 2)[i])
        for i in range(4): c.tone(x0 - 0 + i - 0, 10, 'stone', 4)
        c.tone(x0, 26, 'stone', 3)
    c.group(3); c.new()                                                         # 조각상
    for (x, y, t) in ((15, 15, 5), (16, 15, 4), (15, 16, 5), (16, 16, 4), (14, 17, 4), (15, 17, 5), (16, 17, 4), (17, 17, 3),
                      (14, 18, 4), (15, 18, 5), (16, 18, 4), (17, 18, 3), (14, 19, 4), (15, 19, 4), (16, 19, 3), (17, 19, 3), (15, 20, 3), (16, 20, 2)):
        c.tone(x, y, 'stone', t)
    for x in range(13, 19): c.tone(x, 21, 'stone', 4 if x < 16 else 2)
    c.group(4); c.new()                                                         # 박공 지붕(붉은 기와)
    for y in range(2, 11):
        hw = 3 + (y - 2) * 1.55
        for x in range(int(16 - hw), int(16 + hw) + 1):
            dx = x + 0.5 - 16
            tone = 5 if dx < -hw * 0.4 else (4 if dx < hw * 0.3 else 3)
            if (y + x) % 3 == 0 and y > 4: tone -= 1
            if y >= 9: tone -= 1
            c.tone(x, y, 'red', max(1, tone))
    for x in range(1, 31): c.tone(x, 11, 'stone', 3) if (1 <= x < 31 and abs(x - 16) < 13) else None
    c.group(5); c.new()                                                         # 앞에 꽃
    for (x, y, m, t) in ((10, 29, 'red', 4), (11, 28, 'leaf', 3), (13, 29, 'cream', 5), (21, 29, 'cream', 4), (22, 28, 'leaf', 3), (19, 29, 'red', 5)):
        c.tone(x, y, m, t)
    return fin(c)

# ---------- 바다 바위 ----------
def sea_rock(w=16, h=16, seed=5, foam=True):
    """물에 잠긴 바위: 젖은 아랫단은 어둡고 위는 마른 돌. 밑에 거품 점."""
    c = C(w, h, seed=seed)
    c.group(1); c.ellipsoid(w * 0.5, h * 0.55, w * 0.42, h * 0.36, 'mstone', bump=0.9, bsc=3)
    if w >= 24: c.group(2); c.ellipsoid(w * 0.3, h * 0.66, w * 0.2, h * 0.2, 'mstone', bump=0.8, bsc=3)
    for y in range(h):                                                            # 젖은 띠 = 물에 닿는 아랫단
        for x in range(w):
            if c.m[y][x] and y > h * 0.66 and c.fix[y][x] is None: c.v[y][x] -= 0.22
    im = fin(c)
    if foam:
        p = im.load()
        for x in range(1, w - 1):
            y = int(h * 0.55 + h * 0.36 * math.sqrt(max(0, 1 - ((x + 0.5 - w * 0.5) / (w * 0.42)) ** 2))) + 1
            if 0 <= y < h and p[x, y][3] == 0 and px2._hash(x, y, seed) > 0.35: p[x, y] = hx('#dee0dd') + (255,) if px2._hash(x, y, seed + 1) > 0.5 else hx('#a7d4db') + (255,)
    return im

# ---------- 부서진 문 ----------
def ruin_gate(seed=6):
    """숲속 옛 문터: 기둥 둘(하나는 부러짐), 무너진 돌, 이끼와 덩굴. 가운데는 걸어 지나간다."""
    W, H = 64, 56
    c = C(W, H, seed=seed); c.shadow(32, 51, 27, 3)
    for gi, (x0, top) in enumerate(((5, 8), (43, 22))):                            # 왼 기둥은 높고 오른 기둥은 부러졌다
        c.group(1 + gi)
        c.box(x0, top, 16, 6, 44 - top - 6 + 6 - 4, 'mstone', top=0.86, front=0.58)
        c.box(x0 - 1, 44, 18, 3, 4, 'mstone', top=0.8, front=0.5)                   # 기단
    # 기둥 앞면 돌결 (줄눈)
    for x0, top in ((5, 8), (43, 22)):
        for y in range(top + 8, 46, 6):
            for x in range(x0, x0 + 16):
                if c.m[y][x] and px2._hash(x, y, seed) > 0.12: c.tone(x, y, 'mstone', 2)
        for y in range(top + 8, 46):
            for x in (x0 + 5, x0 + 11):
                if (y // 6) % 2 == (1 if x == x0 + 5 else 0) and c.m[y][x]: c.tone(x, y, 'mstone', 2)
    c.group(3)                                                                       # 왼쪽 기둥 위에서 뻗은 아치 조각
    c.poly([(21, 8), (36, 8), (30, 15), (21, 16)], 'mstone', lambda x, y: 0.7 - 0.01 * (y - 8))
    c.group(4)                                                                       # 부러진 조각(바닥에 떨어진)
    c.ellipsoid(37, 46, 7, 4, 'mstone', bump=0.8); c.ellipsoid(30, 49, 5, 3, 'mstone', bump=0.8)
    c.group(5)                                                                       # 이끼
    for y in range(0, H):
        for x in range(W):
            if c.m[y][x] in ('mstone',) and c.fix[y][x] is None and px2._hash(x // 2, y // 2, seed + 3) > 0.66 and (y < 22 or y > 40 or px2._hash(x, y, 1) > 0.6):
                c.setv(x, y, 'moss', c.v[y][x] + 0.04, oid=c.id[y][x])
    # 덩굴
    for x in range(6, 21):
        n = int(3 + 8 * px2._hash(x, 0, seed + 8))
        for y in range(9, 9 + n): c.tone(x if False else x, y, 'leaf', 2 + (x + y) % 3) if px2._hash(x, y, seed + 4) > 0.5 and c.m[y][x] else None
    return fin(c)

# ---------- 징검돌 ----------
def stepping_stones(seed=7, kind=0):
    """냇물 위 징검돌 타일(16x16 겹침판). kind 별로 놓인 자리가 다르다."""
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    c = C(16, 16, seed=seed + kind)
    pos = ((2, 6, 5), (9, 3, 4), (10, 10, 5)) if kind == 0 else (((1, 3, 5), (8, 8, 5)) if kind == 1 else ((3, 8, 5), (10, 4, 4)))
    for g, (x, y, r) in enumerate(pos):
        c.group(g + 1); c.ellipsoid(x + r / 2 + 1, y + 2.2, r / 2 + 1.6, 3.0, 'mstone', bump=0.5, bsc=2)
    return fin(c)

# ---------- 초소 ----------
def guard_post(seed=8):
    """고갯길 초소: 돌 아래층 + 나무 위층 + 오두막 지붕 + 작은 깃발."""
    W, H = 48, 60
    c = C(W, H, seed=seed); c.shadow(24, 55, 21, 3)
    c.group(1); c.box(4, 34, 40, 4, 20, 'mstone', top=0.88, front=0.6)              # 돌 아래층
    for y in range(38, 54):
        for x in range(4, 44):
            if (y // 5 + (x // 8)) % 2 == 0 and x % 8 == 0 and c.m[y][x]: c.tone(x, y, 'mstone', 2)
            if y % 5 == 0 and c.m[y][x] and px2._hash(x, y, seed) > 0.2: c.tone(x, y, 'mstone', 2)
    c.group(2); c.new()                                                              # 문
    for y in range(42, 54):
        for x in range(20, 29): c.tone(x, y, 'wood', 1 if y > 43 else 2) if x > 20 else c.tone(x, y, 'wood', 2)
    for y in range(43, 54):
        for x in range(21, 28):
            c.tone(x, y, 'wood', 2 if (x - 21) % 3 else 1)
    c.tone(26, 49, 'gold', 4)
    c.group(3); c.box(8, 16, 32, 3, 17, 'wood', top=0.82, front=0.6)               # 나무 위층
    for y in range(19, 33):
        for x in range(8, 40):
            if (x - 8) % 5 == 0 and c.m[y][x]: c.tone(x, y, 'wood', 2)
    c.group(4); c.new()                                                              # 감시 창
    for y in range(23, 29):
        for x in range(21, 27): c.tone(x, y, 'dark', 2 if y > 24 else 3) if False else c.tone(x, y, 'wood', 1)
    c.group(5); c.new()                                                              # 지붕
    for y in range(4, 17):
        hw = 6 + (y - 4) * 1.9
        for x in range(int(24 - hw), int(24 + hw) + 1):
            dx = x + 0.5 - 24
            tone = 5 if dx < -hw * 0.45 else (4 if dx < hw * 0.35 else 3)
            if (x + y) % 4 == 0: tone -= 1
            if y >= 15: tone -= 1
            c.tone(x, y, 'cloth', max(1, tone))
    c.group(6); c.new()                                                              # 깃대 + 깃발
    for y in range(-0, 6): c.tone(24, y, 'bark', 4)
    c.tone(25, 1, 'red', 4); c.tone(26, 1, 'red', 4); c.tone(27, 1, 'red', 3); c.tone(25, 2, 'red', 3); c.tone(26, 2, 'red', 3); c.tone(25, 3, 'red', 2)
    return fin(c)

# ---------- 밀 ----------
def wheat_tile(v=0, seed=11):
    """익은 밀: 위에서 3/4로 본 밀밭 16x16. 세로 이랑 + 이삭 머리 점. 타일 위 아래 이음이 끊기지 않게 주기 16."""
    c = C(16, 16, seed=seed + v)
    c.period = 16
    tones = STRAW
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = im.load()
    S = [hx(x) for x in palette.RAMPS_CHIP['straw']]
    O = hx(palette.OUT_CHIP['straw'])
    for y in range(16):
        for x in range(16):
            col = x % 4                                                            # 이랑 4px
            n = px2._hash(x, y, seed + v * 7)
            t = 3 + (1 if col == 1 else 0) - (1 if col == 3 else 0)
            if (y + col * 2) % 5 == 0: t += 1                                       # 이삭 머리 빛
            if (y + col * 2) % 5 == 1: t -= 1
            if n > 0.86: t += 1
            elif n < 0.12: t -= 1
            t = max(1, min(6, t))
            p[x, y] = S[t - 1] + (255,)
    return im

def haystack(seed=12):
    """둥근 건초더미 32x32: 짚 색 타원 + 가로 묶음 줄 + 꼭대기 삐죽한 짚."""
    c = C(32, 32, seed=seed); c.shadow(16, 28, 13, 2.4)
    c.group(1); c.ellipsoid(16, 17, 12.5, 11.5, 'gold', bump=0.5, bsc=3)
    for y in range(6, 28):
        for x in range(2, 30):
            if c.m[y][x] and (y % 3 == 0) and px2._hash(x, y, seed) > 0.45: c.darken(x, y, 1)
    for y in (16, 21):
        for x in range(3, 29):
            if c.m[y][x]: c.tone(x, y, 'bark', 3 if x < 16 else 2)
    c.group(2); c.new()
    for (x, y) in ((15, 4), (16, 3), (17, 4), (13, 5), (18, 5), (16, 2)): c.tone(x, y, 'gold', 5)
    return fin(c)

# ---------- 오두막 소품 ----------
def chopping_block(seed=13):
    c = C(16, 16, seed=seed); c.shadow(8, 13, 6, 1.6)
    c.group(1); c.cylinder(7, 6, 12, 4.6, 'wood', cap=True, capry=2.2, amb=0.3)
    c.group(2); c.new()
    for (x, y) in ((11, 3), (12, 4), (12, 5), (13, 6)): c.tone(x, y, 'iron', 4)           # 박힌 도끼날
    for y in range(4, 10): c.tone(11, y, 'bark', 4) if y > 4 else None
    return fin(c)

def hide_rack(seed=14):
    """사냥 오두막 앞 가죽 말림틀 32x32: 나무 틀 + 늘어진 가죽 둘."""
    c = C(32, 32, seed=seed); c.shadow(16, 29, 13, 1.8)
    c.group(1); pz.post(c, 3, 8, 28); pz.post(c, 26, 8, 28)
    for x in range(2, 30): c.tone(x, 7, 'bark', 4); c.tone(x, 8, 'bark', 2)
    for gi, (x0, x1, mat, t) in enumerate(((6, 14, 'cloth', 4), (17, 24, 'cream', 4))):
        c.group(2 + gi); c.new()
        for y in range(9, 24):
            f = (y - 9) / 15
            for x in range(x0 + int(f * 1.5), x1 - int(f * 1.5) + 1):
                tone = t + (1 if x < (x0 + x1) // 2 - 1 else 0) - (1 if y > 20 else 0)
                if px2._hash(x, y, seed) > 0.85: tone -= 1
                c.tone(x, y, mat, max(1, tone))
    return fin(c)

def cairn(seed=15, big=True):
    """돌무더기(케른): 납작한 돌 쌓기. 정상 표지."""
    c = C(16, 24 if big else 16, seed=seed); H = c.h
    c.shadow(8, H - 3, 6.5, 1.8)
    levels = ((7, 3.2), (5.5, 2.6), (4, 2.2), (2.6, 1.8)) if big else ((6.5, 3), (4.5, 2.4))
    y = H - 6
    for i, (rx, ry) in enumerate(levels):
        c.group(i + 1); c.ellipsoid(8 + (1 if i % 2 else -0.5), y, rx, ry, 'mstone', bump=0.55, bsc=2)
        y -= 3.4
    return fin(c)

def campfire(seed=16):
    c = C(16, 16, seed=seed); c.shadow(8, 13, 7, 2)
    c.group(1)
    for i in range(9):                                                                # 둘러친 돌
        a = i / 9 * math.tau; x, y = 8 + 6 * math.cos(a), 9 + 3.2 * math.sin(a)
        c.ellipsoid(x, y, 2.1, 1.8, 'mstone', bump=0.4, bsc=2)
    c.group(2); c.new()
    for x, y, t in ((6, 8, 3), (7, 9, 2), (9, 9, 3), (10, 8, 2), (8, 8, 1)): c.tone(x, y, 'dark', t)
    c.group(3); c.new()
    for (x, y, t) in ((8, 5, 6), (7, 6, 5), (8, 6, 6), (9, 6, 5), (7, 7, 4), (8, 7, 5), (9, 7, 4), (8, 4, 5)): c.tone(x, y, 'fire', t)
    return fin(c)

# ---------- 밀 길 ----------
def wayside_cross(seed=17):
    """길가 십자 표지(나무 기둥 + 작은 지붕)."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 5, 1.2)
    c.group(1); pz.post(c, 7, 8, 29)
    for x in range(4, 12): c.tone(x, 12, 'bark', 4 if x < 8 else 2)
    c.group(2); c.new()
    for y in range(3, 8):
        hw = 1 + (y - 3) * 1.2
        for x in range(int(8 - hw), int(8 + hw) + 1): c.tone(x, y, 'red', 5 if x < 8 else 3)
    c.group(3); c.new(); c.tone(6, 29, 'stone', 4); c.tone(5, 29, 'stone', 3); c.tone(10, 29, 'stone', 3); c.tone(9, 29, 'stone', 4)
    return fin(c)


# ---------- 밀밭 대로 ----------
def scarecrow(seed=18):
    """허수아비 16x32: 기둥 + 가로대 + 옷 + 짚 머리 + 모자."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 5, 1.3)
    c.group(1); pz.post(c, 7, 8, 29)
    for x in range(1, 15): c.tone(x, 12, 'bark', 4 if x < 8 else 2); c.tone(x, 13, 'bark', 2)
    c.group(2); c.new()
    for y in range(13, 22):                                                          # 낡은 천옷
        hw = 3 + (1 if y > 17 else 0)
        for x in range(8 - hw, 8 + hw):
            t = 4 - (1 if x >= 8 else 0) - (1 if y > 19 else 0) + (1 if px2._hash(x, y, seed) > 0.8 else 0)
            c.tone(x, y, 'cloth', max(1, t))
    for x in list(range(0, 3)) + list(range(13, 16)):                                # 소매 끝 짚
        c.tone(x, 14, 'gold', 4 if x < 8 else 3); c.tone(x, 15, 'gold', 3)
    c.group(3); c.ellipsoid(8, 7.5, 3.4, 3.4, 'gold', amb=0.3)                       # 짚 머리
    c.group(4); c.new()
    for x in range(2, 14): c.tone(x, 5, 'bark', 5 if x < 8 else 3)                  # 모자 챙
    for y in range(1, 5):
        for x in range(5, 11): c.tone(x, y, 'bark', 5 if x < 8 else 3)
    c.tone(6, 8, 'dark', 2); c.tone(9, 8, 'dark', 2)
    return fin(c)

def wheat_sheaf(seed=19):
    """밀단 16x16: 이삭을 모아 세운 묶음 + 허리 끈."""
    c = C(16, 16, seed=seed); c.shadow(8, 13.5, 6, 1.6)
    c.group(1); c.new()
    for y in range(2, 14):
        f = (y - 2) / 11; hw = 2.0 + f * 3.6 if y > 5 else 2.4
        for x in range(int(8 - hw), int(8 + hw) + 1):
            t = 4 + (1 if x < 7 else 0) - (1 if x > 9 else 0)
            if (x + y) % 3 == 0: t -= 1
            if y < 6 and (x + y) % 2 == 0: t += 1                                     # 이삭 머리
            c.tone(x, y, 'gold', max(1, min(6, t)))
    c.group(2); c.new()
    for x in range(4, 13): c.tone(x, 9, 'bark', 4 if x < 8 else 2)
    return fin(c)

def trough(seed=20):
    """말 물통 32x16: 나무 긴 통 + 물면."""
    c = C(32, 16, seed=seed); c.shadow(16, 13.5, 14, 1.8)
    c.group(1); c.box(2, 4, 28, 4, 5, 'wood', top=0.8, front=0.55, bias=0.02)
    for x in range(4, 28):
        for y in (5, 6, 7): c.tone(x, y, 'teal', 3 if y < 7 else 2)
    for x in range(4, 28, 3): c.tone(x, 5, 'teal', 5)
    return fin(c)

def wildflowers(v=0, seed=60):
    """풀밭 들꽃 무더기 16x16 (투명 배경): 풀잎 끝 몇 포기 + 꽃송이. 윤곽선 없이 밝은 풀색 + 꽃색만 찍는다(땅 풀결과 섞이는 낮은 덮개)."""
    from PIL import Image
    from px2 import PAL, _hash
    hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    def pt(x, y, m, t):
        if 0 <= x < 16 and 0 <= y < 16: im.putpixel((x, y), hx(PAL[m][t]))
    clumps = (((3, 12), (8, 13), (13, 11), (6, 6), (11, 4)), ((4, 9), (9, 12), (13, 13), (2, 14), (10, 5)), ((5, 13), (11, 10), (3, 6), (8, 8), (13, 5)))[v % 3]
    fl = (('gold', 5, 4), ('pink', 5, 4), ('cream', 5, 4))
    for i, (x, y) in enumerate(clumps):
        pt(x, y + 1, 'leaf', 2)                                      # 뿌리 그늘
        for dx, h in ((-1, 2), (0, 4), (1, 3)):
            for j in range(h): pt(x + dx, y - j, 'leaf', 5 if (dx <= 0 and j > 0) else 4 if j else 3)
        m, hi, lo = fl[(i + v) % 3]
        pt(x, y - 4, m, hi); pt(x + 1, y - 4, m, lo); pt(x, y - 5, m, hi)
        if i % 2: pt(x - 1, y - 3, m, lo)
    return im

ALL = {
 'fir_m': lambda: fir(32, 48, 4, seed=21), 'fir_m2': lambda: fir(32, 48, 4, seed=31, trunk=4),
 'fir_l': lambda: fir(48, 64, 5, seed=22, trunk=6), 'fir_s': lambda: fir(24, 40, 3, seed=23, trunk=4),
 'milestone': milestone, 'shrine': shrine, 'sea_rock_s': lambda: sea_rock(16, 16, 5), 'sea_rock_l': lambda: sea_rock(32, 24, 6),
 'ruin_gate': ruin_gate, 'stones_a': lambda: stepping_stones(kind=0), 'stones_b': lambda: stepping_stones(kind=1), 'stones_c': lambda: stepping_stones(kind=2),
 'guard_post': guard_post, 'wheat_a': lambda: wheat_tile(0), 'wheat_b': lambda: wheat_tile(1), 'wheat_c': lambda: wheat_tile(2),
 'haystack': haystack, 'chopping_block': chopping_block, 'hide_rack': hide_rack, 'cairn': cairn, 'cairn_s': lambda: cairn(big=False),
 'campfire': campfire, 'wayside_cross': wayside_cross,
}

# ---------- 해안·목장 ----------
def heath(v=0, seed=40):
    """해안 히스·가시금작화 덤불 16x16 (땅이 비치는 투명 배경)."""
    c = C(16, 16, seed=seed + v * 3); c.shadow(8, 13, 6, 1.5)
    spots = (((5, 10, 4.6, 3.6), (11, 9, 3.6, 3.0), (8, 5, 3.2, 2.6)), ((6, 9, 5, 3.8), (12, 11, 3, 2.4), (10, 5, 3.4, 2.8)), ((4, 8, 3.2, 2.8), (9, 10, 5, 3.6), (12, 5, 2.6, 2.2)))[v % 3]
    for i, (x, y, rx, ry) in enumerate(spots):
        c.group(i + 1); c.ellipsoid(x, y, rx, ry, 'leaf', bump=0.7, bsc=2)
    c.group(9); c.new()
    for (x, y) in ((4, 8), (7, 9), (11, 8), (9, 5), (12, 10), (6, 11)):
        if c.m[y][x]: c.tone(x, y, 'gold' if (x + v) % 2 else 'pink', 5)
    return fin(c)

def sheep(v=0, seed=41):
    c = C(16, 16, seed=seed + v); c.shadow(8, 13, 5.5, 1.3)
    hx0 = 9 if v == 0 else 6                                   # 머리 방향
    c.group(1); c.ellipsoid(8, 8.5, 5.6, 3.6, 'cream', bump=0.5, bsc=2)
    c.group(2); c.new()
    hd = 13 if v == 0 else 2
    for (x, y) in ((hd, 7), (hd, 8), (hd + (1 if v == 0 else -1), 8), (hd + (0), 9)): c.tone(x, y, 'dark', 3)
    for x in (5, 7, 10):
        c.tone(x, 12, 'dark', 3); c.tone(x, 11, 'dark', 2)
    return fin(c)

def rowboat(seed=42):
    """모래에 끌어올린 작은 배 32x16: 뱃전 + 안쪽 그늘 + 가로대."""
    c = C(32, 16, seed=seed); c.shadow(16, 13, 13, 1.8)
    c.group(1); c.ellipsoid(16, 9, 14.5, 5.2, 'wood', bump=0.6, bsc=3)
    c.group(2); c.new()
    for y in range(6, 11):
        hw = 12.5 * math.sqrt(max(0, 1 - ((y - 8.2) / 3.4) ** 2))
        for x in range(int(16 - hw), int(16 + hw) + 1): c.tone(x, y, 'wood', 2 if y > 7 else 1)
    for x in (10, 16, 22):
        for y in range(6, 11): c.tone(x, y, 'wood', 5 if x < 20 else 4)
    c.group(3); c.new()
    for x in range(2, 30):
        y = 5 if 6 < x < 26 else 6
        c.tone(x, y, 'wood', 5 if x < 16 else 4)
    return fin(c)

def driftwood(seed=43):
    c = C(16, 16, seed=seed); c.shadow(8, 12, 6, 1.2)
    c.group(1); c.hcyl(2, 9, 12, 2.6, 'bark') if hasattr(c, 'hcyl') else c.ellipsoid(8, 9, 6, 2, 'bark')
    return fin(c)

ALL.update({'heath_a': lambda: heath(0), 'heath_b': lambda: heath(1), 'heath_c': lambda: heath(2),
            'sheep_a': lambda: sheep(0), 'sheep_b': lambda: sheep(1), 'rowboat': rowboat, 'driftwood': driftwood,
            'wild_a': lambda: wildflowers(0), 'wild_b': lambda: wildflowers(1), 'wild_c': lambda: wildflowers(2),
            'scarecrow': scarecrow, 'wheat_sheaf': wheat_sheaf, 'trough': trough})

def sheet(names=None, path=None, scale=3):
    names = names or list(ALL)
    ims = [ALL[n]() for n in names]
    W = sum(i.width + 8 for i in ims) + 8
    rows = []; x = 4; y = 4; rowh = 0; pos = []
    for i in ims:
        if x + i.width + 8 > 560: x = 4; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += i.width + 8; rowh = max(rowh, i.height)
    sh = Image.new('RGBA', (560, y + rowh + 8), hx('#58a035') + (255,))
    for i, p in zip(ims, pos): sh.alpha_composite(i, p)
    sh = sh.resize((sh.width * scale, sh.height * scale), Image.NEAREST)
    if path: sh.save(path)
    return sh
if __name__ == '__main__':
    sheet(path=ROOT + '/tiledata/beodeul-variants/_out-5/parts_sheet.png', scale=2)

# ---------- parts.md 용 설명 ----------
NOTES = {
 'wild_a': '풀밭 들꽃 무더기 A(낮은 덮개)', 'wild_b': '풀밭 들꽃 무더기 B', 'wild_c': '풀밭 들꽃 무더기 C',
 'fir_m': '전나무(중) — 줄기 4px = 밑변 폭', 'fir_m2': '전나무(중, 다른 씨앗)', 'fir_l': '전나무(대) — 줄기 6px', 'fir_s': '전나무(소)',
 'milestone': '로마식 이정표 돌기둥', 'shrine': '길가 사당(붉은 지붕 작은 신전)', 'sea_rock_s': '바다 바위(소) + 물거품 테', 'sea_rock_l': '바다 바위(대)',
 'ruin_gate': '무너진 성문(돌기둥 + 아치 잔해)', 'stones_a': '징검돌 A', 'stones_b': '징검돌 B', 'stones_c': '징검돌 C',
 'guard_post': '초소(돌 기단 + 나무 망루)', 'wheat_a': '밀밭 칸 A(16x16 이음)', 'wheat_b': '밀밭 칸 B', 'wheat_c': '밀밭 칸 C',
 'haystack': '건초더미', 'chopping_block': '장작 패는 그루터기', 'hide_rack': '가죽 말림틀', 'cairn': '돌탑(대)', 'cairn_s': '돌탑(소)',
 'campfire': '모닥불', 'wayside_cross': '길가 표지 십자', 'heath_a': '낮은 헤더 덤불 A(반투명 풀꽃)', 'heath_b': '낮은 헤더 덤불 B', 'heath_c': '낮은 헤더 덤불 C',
 'scarecrow': '허수아비', 'wheat_sheaf': '밀단', 'trough': '말 물통',
 'sheep_a': '양 A', 'sheep_b': '양 B', 'rowboat': '작은 노 젓는 배(뭍에 올림)', 'driftwood': '떠내려온 통나무',
}
def register(s, names):
    """장면 s 에 쓴 새 조각을 parts/·parts.md 로 남긴다."""
    for n in names:
        im = ALL[n](); s.newpart(n, im, f'{-(-im.width // 16)}x{-(-im.height // 16)}칸', NOTES.get(n, ''))


# ---------- 깊은 숲 ----------
def log_fallen(seed=70):
    """쓰러진 통나무 32x16: 이끼 낀 몸통 + 왼쪽 잘린 면 + 뿌리 쪽 곁가지 한두 개."""
    c = C(32, 16, seed=seed); c.shadow(16, 13, 14, 1.8)
    c.group(1); c.hcyl(3, 29, 9, 4.4, 'bark', amb=0.25, endcap='L')
    c.group(2); c.new()
    for x in range(6, 28):                                                            # 윗면 이끼 띠
        if px2._hash(x // 2, 0, seed) > 0.32:
            for y in (5, 6):
                if c.m[y][x] == 'bark': c.setv(x, y, 'moss', 0.86 - 0.05 * (y - 5), oid=c.id[y][x])
    c.group(3); c.new()
    for (x, y, t) in ((26, 5, 3), (27, 4, 4), (28, 3, 3), (29, 3, 4), (25, 12, 2)): c.tone(x, y, 'bark', t)   # 부러진 곁가지
    return fin(c)

def stump(seed=71):
    """그루터기 16x16: 자른 윗면에 나이테, 뿌리가 땅으로."""
    c = C(16, 16, seed=seed); c.shadow(8, 13, 6.5, 1.8)
    c.group(1); c.cylinder(8, 6, 11, 5.0, 'bark', cap=True, capry=2.3, amb=0.3)
    c.group(2); c.new()
    for (x, y) in ((4, 12), (3, 12), (12, 12), (13, 12), (6, 13), (10, 13)): c.tone(x, y, 'bark', 2)   # 뿌리 끝
    im = fin(c); p = im.load()
    for (x, y, t) in ((8, 6, 4), (7, 6, 3), (9, 6, 3), (8, 5, 3), (6, 5, 4), (10, 7, 4)): p[x, y] = hx(px2.PAL['cream'][t]) + (255,)
    return im

def fern(v=0, seed=72):
    """고사리 무더기 16x16 (투명 배경, 윤곽 없음): 깃털 잎 다섯 장이 부채꼴로 퍼진다. 숲 바닥 낮은 덮개."""
    from PIL import Image
    from px2 import PAL, _hash
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = im.load()
    col = lambda t: hx(PAL['leaf'][t]) + (255,)
    def pt(x, y, t):
        if 0 <= x < 16 and 0 <= y < 16: p[x, y] = col(t)
    cx, cy = (8, 12) if v == 0 else ((6, 12) if v == 1 else (10, 12))
    fronds = ((-5, -3), (-3, -6), (0, -7), (3, -6), (5, -3)) if v != 2 else ((-4, -2), (-2, -5), (1, -6), (4, -4))
    for i, (dx, dy) in enumerate(fronds):
        n = max(abs(dx), abs(dy)) * 2
        for k in range(n + 1):
            f = k / n; x = cx + int(round(dx * f)); y = cy + int(round(dy * f - 2 * f * (1 - f)))
            pt(x, y, 3 if dx < 0 else 4)
            if k % 2 == 1 and k < n - 1:                                                        # 잔 잎
                pt(x - 1, y + 1, 2 + (i % 2)); pt(x + 1, y + 1, 4)
    for x in range(cx - 2, cx + 3): pt(x, cy + 1, 2)                                             # 뿌리 그늘
    return im

def toadstools(v=0, seed=73):
    """버섯 무더기 16x16 (투명 배경): 붉은 갓 + 흰 점, 크고 작은 둘~셋."""
    c = C(16, 16, seed=seed + v); c.shadow(8, 13, 5.5, 1.3)
    spots = (((5, 9, 3), (10, 10, 2), (8, 6, 2)), ((6, 8, 3), (11, 9, 2)), ((4, 10, 2), (8, 8, 3), (12, 10, 2)))[v % 3]
    for i, (x, y, r) in enumerate(spots):
        c.group(1 + i * 2); c.cylinder(x, y, y + 3, 0.8, 'cream', cap=False)
        c.group(2 + i * 2); c.ellipsoid(x, y - 0.5, r + 0.6, r * 0.62, 'red', bump=0.3, bsc=2)
    im = fin(c); p = im.load()
    for (x, y, r) in spots:
        for (dx, dy) in ((-1, -1), (1, 0)):
            if p[x + dx, y - 1 + dy][3] and p[x + dx, y - 1 + dy][0] > p[x + dx, y - 1 + dy][2]: p[x + dx, y - 1 + dy] = hx(px2.PAL['cream'][5]) + (255,)
    return im

def hunter_pelt_post(seed=74):
    """사냥꾼의 조각 이정표 16x32: 기둥 + 매단 뿔 한 쌍. 사냥터 표지."""
    c = C(16, 32, seed=seed); c.shadow(8, 29, 5, 1.4)
    c.group(1); pz.post(c, 7, 6, 29)
    c.group(2); c.new()
    for (x, y) in ((6, 5), (5, 4), (4, 3), (4, 2), (3, 2), (8, 5), (9, 4), (10, 3), (10, 2), (11, 2), (7, 5)): c.tone(x, y, 'bone', 4 if x < 8 else 3)
    for y in range(8, 12): c.tone(9, y, 'iron', 3); c.tone(10, y, 'iron', 2)
    return fin(c)

ALL.update({'log_fallen': log_fallen, 'stump': stump, 'fern_a': lambda: fern(0), 'fern_b': lambda: fern(1), 'fern_c': lambda: fern(2),
            'toadstools_a': lambda: toadstools(0), 'toadstools_b': lambda: toadstools(1), 'toadstools_c': lambda: toadstools(2), 'hunter_post': hunter_pelt_post})
NOTES.update({'log_fallen': '쓰러진 이끼 통나무(2칸)', 'stump': '그루터기', 'fern_a': '고사리 무더기 A(낮은 덮개)', 'fern_b': '고사리 무더기 B', 'fern_c': '고사리 무더기 C',
              'toadstools_a': '붉은 버섯 무더기 A', 'toadstools_b': '붉은 버섯 무더기 B', 'toadstools_c': '붉은 버섯 무더기 C', 'hunter_post': '사냥꾼 표지 기둥(뿔 한 쌍)'})


# ---------- 고갯길 ----------
def stone_bridge(seed=80):
    """능선 개울 위 돌다리 80x64 (5칸 폭 x 4줄). 위쪽 난간(뒷면 안 보임) · 포장 상판 · 아래쪽 난간 + 앞면 벽에 아치. 빛은 왼쪽 위."""
    Wd, Ht = 80, 64
    c = C(Wd, Ht, seed=seed); c.new()
    h = px2._hash
    # 다리 머리(양 끝 낮은 기둥)
    for x0 in (0, 76):
        for y in range(4, 13):
            for x in range(x0, x0 + 4):
                t = 5 if y <= 5 else (4 if x > x0 else 5) if y < 9 else 3
                if x == x0 + 3 and y > 5: t = min(t, 3)
                c.tone(x, y, 'stone', t)
    # 위쪽 난간: 윗면(밝음) + 남향 앞면(어두움, 돌 줄눈)
    for x in range(Wd):
        for y in range(9, 13): c.tone(x, y, 'stone', 5 if y == 9 else 4)
        for y in range(13, 16):
            t = 3 if y < 15 else 2
            if (x + (y - 13) * 5 + 3) % 10 == 0 and y < 15: t = 2
            c.tone(x, y, 'mstone', t)
    # 상판: 포장돌
    for y in range(16, 44):
        row = (y - 16) // 7
        for x in range(Wd):
            t = 4 if h(x // 6, y // 7, seed) > 0.18 else 5
            if y == 16 or y == 17: t = 3                       # 위쪽 난간이 드리운 그늘
            if (y - 16) % 7 == 6: t = 3                        # 가로 줄눈
            if (x + row * 3) % 9 == 0 and (y - 16) % 7 != 6: t = 3   # 세로 줄눈(엇갈림)
            if x < 3 or x > 76: t = max(2, t - 1)
            c.tone(x, y, 'stone', t)
    # 상판 가운데 바퀴자국 두 줄(옅게)
    # 아래쪽 난간 윗면
    for x in range(Wd):
        for y in range(44, 48): c.tone(x, y, 'stone', 5 if y == 44 else (4 if y < 47 else 3))
    # 앞면 벽 + 아치
    for y in range(48, 58):
        for x in range(Wd):
            course = (y - 48) // 5
            t = 4 if y < 50 else 3
            if x < 3: t = 4
            if (y - 48) % 5 == 4: t = 2
            if (x + course * 4 + 2) % 8 == 0 and (y - 48) % 5 != 4: t = 2
            c.tone(x, y, 'mstone', t)
    im = fin(c); p = im.load()
    # 아치 구멍
    for y in range(48, 58):
        hw = 17.5 * math.sqrt(max(0.0, 1 - ((57 - y) / 10.0) ** 2))
        for x in range(Wd):
            dx = x + 0.5 - 39.5
            if abs(dx) <= hw:
                if y >= 55: p[x, y] = (0, 0, 0, 0)
                else: p[x, y] = hx(px2.PAL['dark'][2 if y < 53 else 3]) + (255,)
    # 아치 테두리(쐐기돌 띠)
    for y in range(48, 58):
        hw = 17.5 * math.sqrt(max(0.0, 1 - ((57 - y) / 10.0) ** 2))
        for x in range(Wd):
            dx = abs(x + 0.5 - 39.5)
            if hw < dx <= hw + 1.6 and p[x, y][3] == 255: p[x, y] = hx(px2.PAL['mstone'][4 if x < 40 else 3]) + (255,)
    # 물 그림자(다리 앞)
    for y in range(58, 64):
        a = int(70 * (1 - (y - 58) / 6.0))
        for x in range(2, 78):
            if p[x, y][3] == 0: p[x, y] = (10, 22, 44, a)
    return im

def boulder(w=32, h=32, seed=90, n=3):
    """산 바위 덩이: 위쪽 왼쪽이 밝고 이끼가 낀다. 윤곽은 손으로 굴곡을 준다."""
    c = C(w, h, seed=seed); c.shadow(w * 0.5, h - 3, w * 0.42, 2.6)
    c.group(1); c.ellipsoid(w * 0.5, h * 0.55, w * 0.44, h * 0.34, 'stone', bump=0.9, bsc=3)
    if n >= 2: c.group(2); c.ellipsoid(w * 0.3, h * 0.6, w * 0.26, h * 0.26, 'mstone', bump=0.8, bsc=3)
    if n >= 3: c.group(3); c.ellipsoid(w * 0.72, h * 0.66, w * 0.22, h * 0.22, 'stone', bump=0.8, bsc=3)
    c.group(9); c.new()
    for y in range(h):                                                      # 윗면 이끼
        for x in range(w):
            if c.m[y][x] and y < h * 0.52 and x < w * 0.6 and px2._hash(x, y, seed + 5) > 0.72 and c.fix[y][x] is None: c.tone(x, y, 'moss', 5 if x < w * 0.35 else 4)
    return fin(c)

def scree(v=0, seed=92):
    """자갈 무더기 16x16 (투명 배경, 윤곽 없음): 작은 돌 여남은 개가 흩어진다."""
    from PIL import Image
    from px2 import PAL, _hash
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = im.load()
    col = lambda t: hx(PAL['mstone'][t]) + (255,)
    spots = ((3, 9), (5, 11), (8, 8), (10, 11), (12, 9), (6, 6), (9, 5), (4, 13), (11, 13), (13, 12)) if v == 0 else ((2, 10), (4, 8), (7, 10), (9, 7), (11, 10), (13, 8), (6, 13), (10, 13), (8, 4))
    for i, (x, y) in enumerate(spots):
        big = _hash(x, y, seed + v) > 0.5
        p[x, y] = col(5); p[x + 1, y] = col(4)
        if big: p[x, y + 1] = col(3); p[x + 1, y + 1] = col(2)
        else: p[x + 1, y + 1] = col(3)
    return im

def alpine(v=0, seed=94):
    """고산 꽃 뭉치 16x16 (투명 배경): 짧은 풀 + 작은 꽃(분홍·연노랑·흰)."""
    from PIL import Image
    from px2 import PAL, _hash
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = im.load()
    leaf = lambda t: hx(PAL['leaf'][t]) + (255,)
    base = ((4, 12), (7, 13), (10, 12), (12, 13)) if v == 0 else ((3, 13), (6, 12), (9, 13), (12, 11))
    fl = ('pink', 'cream', 'gold')
    for i, (bx, by) in enumerate(base):
        for k in range(4): p[bx, by - k] = leaf(3 if k < 2 else 4)
        p[bx - 1, by - 1] = leaf(2); p[bx + 1, by - 2] = leaf(4)
        f = fl[(i + v) % 3]
        p[bx, by - 4] = hx(PAL[f][5]) + (255,); p[bx - 1, by - 4] = hx(PAL[f][4]) + (255,); p[bx + 1, by - 4] = hx(PAL[f][3]) + (255,); p[bx, by - 5] = hx(PAL[f][4]) + (255,)
    for x in range(3, 14): p[x, 14] = leaf(1)
    return im

def brazier(seed=96):
    """봉화대 16x32: 돌 받침 + 쇠 그릇 + 불꽃. 초소 곁 신호불."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 6, 1.6)
    c.group(1); c.box(4, 22, 8, 3, 6, 'mstone', top=0.85, front=0.58)
    c.group(2); pz.post(c, 7, 14, 22, 'iron', (4, 2))
    c.group(3); c.ellipsoid(8, 13, 5.5, 2.4, 'iron', bump=0.2, bsc=2)
    c.group(4); c.new()
    for (x, y, t) in ((8, 6, 6), (7, 7, 5), (8, 7, 6), (9, 7, 5), (6, 8, 4), (7, 8, 5), (8, 8, 6), (9, 8, 5), (10, 8, 4), (7, 9, 4), (8, 9, 5), (9, 9, 4), (8, 5, 5), (8, 4, 4)): c.tone(x, y, 'fire', t)
    return fin(c)

def trail_post(seed=97):
    """오솔길 표지 기둥 16x32: 기둥 + 끈으로 맨 화살 판."""
    c = C(16, 32, seed=seed); c.shadow(8, 29, 5, 1.3)
    c.group(1); pz.post(c, 7, 6, 29)
    c.group(2); c.new()
    for y in range(8, 14):
        for x in range(2, 15):
            if y == 8 and x > 12: continue
            if y == 13 and x < 5: continue
            c.tone(x, y, 'wood', 4 if y < 10 else 3)
    c.tone(13, 9, 'wood', 4); c.tone(14, 10, 'wood', 3)
    for x in (4, 6): c.tone(x, 10, 'wood', 1)                    # 새긴 자국
    c.group(3); c.new(); c.tone(7, 14, 'rope', 4); c.tone(8, 14, 'rope', 3); c.tone(7, 15, 'rope', 3); c.tone(6, 4, 'stone', 4)
    c.group(4); c.new()
    for (x, y, t) in ((5, 29, 3), (6, 29, 4), (9, 29, 3), (10, 29, 4)): c.tone(x, y, 'stone', t)
    return fin(c)

def wall_seg(seed=98):
    """마른 돌담 마디 32x24: 납작 돌 세 켜. 초소 곁."""
    c = C(32, 24, seed=seed); c.shadow(16, 20, 15, 2)
    c.group(1); c.box(1, 10, 30, 3, 9, 'mstone', top=0.88, front=0.6)
    for y in range(13, 19):
        for x in range(1, 31):
            if c.m[y][x] and ((y - 13) // 3 == 0 and (x + 1) % 7 == 0 or (y - 13) // 3 == 1 and (x + 4) % 7 == 0 or y == 15 and px2._hash(x, y, seed) > 0.4): c.tone(x, y, 'mstone', 2)
    return fin(c)

ALL.update({'stone_bridge': stone_bridge, 'boulder_l': lambda: boulder(32, 32, 90, 3), 'boulder_m': lambda: boulder(24, 20, 91, 2),
            'scree_a': lambda: scree(0), 'scree_b': lambda: scree(1), 'alpine_a': lambda: alpine(0), 'alpine_b': lambda: alpine(1),
            'brazier': brazier, 'trail_post': trail_post, 'wall_seg': wall_seg})
NOTES.update({'stone_bridge': '능선 개울 위 돌다리(5x4칸): 난간·포장 상판·앞면 아치', 'boulder_l': '큰 산바위(2x2, 이끼)', 'boulder_m': '작은 산바위(1.5x1.25)',
              'scree_a': '자갈 무더기 A', 'scree_b': '자갈 무더기 B', 'alpine_a': '고산 꽃 뭉치 A', 'alpine_b': '고산 꽃 뭉치 B',
              'brazier': '봉화대(신호불)', 'trail_post': '오솔길 표지 기둥(화살 판)', 'wall_seg': '마른 돌담 마디(2칸)'})

# ---------- 3/4 재작업(parts5b) — 같은 이름으로 덮어쓴다 ----------
import parts5b
ALL.update(parts5b.NEW); NOTES.update(parts5b.NOTES)

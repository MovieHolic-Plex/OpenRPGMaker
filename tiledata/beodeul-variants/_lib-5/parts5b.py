# 변형 5 — 3/4 재작업 조각. 전부 손 도트(좌표). 물체 = 윗면 T(밝고 평평) + 앞면 F(한 단 어둡다). 빛은 왼쪽 위.
# 이름은 parts5.py 와 같다 — parts/<같은 이름>.png 를 덮어쓴다.
from bd5 import *
import px2
from px2 import C
import pz

def fin(c): return pz.fin(c)
def H(x, y, s): return px2._hash(x, y, s)

def lump(c, cx, yt, rx, ryT, hF, mat, top=5, front=(3, 2), seed=1, tex=0.2, topmat=None, edge=0.0):
    """둥근 덩이: 윗면 = 납작 타원(yt~yt+2*ryT, 한 톤 평평·왼쪽 끝만 한 단 밝다), 앞면 = 타원 아래로 hF 행(왼쪽 밝고 오른쪽·아랫줄 어둡다)."""
    cy = yt + ryT; tm = topmat or mat
    for y in range(int(yt) - 1, int(cy + ryT + hF) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) > 1: continue
            e = ryT * math.sqrt(1 - dx * dx)
            wob = edge * (H(x, 0, seed) - 0.5) * 2
            if y + 0.5 < cy - e + wob or y + 0.5 > cy + e + hF - (1 if abs(dx) > 0.86 else 0): continue
            if y + 0.5 <= cy + e:
                c.tone(x, y, tm, top)
            else:
                t = front[0] if dx < 0.15 else front[1]
                if y + 0.5 > cy + e + hF - 1.2: t -= 1
                if y + 0.5 > cy + e + 1.2 and H(x, y, seed) < tex: t -= 1
                c.tone(x, y, mat, max(1, t))

def slab(c, x0, yt, w, dT, hF, mat, top=5, front=(3, 2), seed=1, tex=0.2, topmat=None, round_=True):
    """네모 덩이: 윗면 dT 행 + 앞면 hF 행. 왼쪽 2열은 윗면이 한 단 밝다."""
    tm = topmat or mat
    for y in range(yt, yt + dT + hF):
        for x in range(x0, x0 + w):
            corner = round_ and (x in (x0, x0 + w - 1)) and (y in (yt, yt + dT + hF - 1))
            if corner: continue
            if y < yt + dT:
                c.tone(x, y, tm, top)
            else:
                t = front[0] if x < x0 + w * 0.6 else front[1]
                if y >= yt + dT + hF - 1: t -= 1
                if y > yt + dT and H(x, y, seed) < tex: t -= 1
                c.tone(x, y, mat, max(1, t))

def hlog(c, x0, x1, yt, dT, hF, mat='bark', topmat=None, top=4, front=(3, 2), seed=1, cap=True):
    """누운 통나무: 위 둥근면 dT 행(평평) + 옆면 hF 행(세로 결). 왼 끝에 잘린 단면."""
    tm = topmat or mat
    for y in range(yt, yt + dT + hF):
        for x in range(x0, x1 + 1):
            if (x in (x0, x1)) and (y in (yt, yt + dT + hF - 1)): continue
            if y < yt + dT: c.tone(x, y, tm, top)
            else:
                t = front[0]
                if y > yt + dT and H(x, y, seed) < 0.15: t -= 1
                if y == yt + dT + hF - 1: t -= 1
                c.tone(x, y, mat, max(1, t))
    if cap:
        cy = yt + (dT + hF) / 2.0; ry = (dT + hF) / 2.0
        for y in range(yt + dT, yt + dT + hF):
            for x in range(x0 - 1, x0 + 4):
                dx = (x + 0.5 - (x0 + 1)) / 2.4; dy = (y + 0.5 - cy) / ry
                r = dx * dx + dy * dy
                if r <= 1: c.tone(x, y, 'cream', (4, 3, 4, 2)[min(3, int(math.sqrt(r) * 3.2))] if r < 0.8 else 2)

# ---------- 해안 ----------
def haystack(seed=12):
    """둥근 건초더미 32x32: 두 덩이를 쌓았다. 위 덩이 윗면이 밝고 앞면은 한 단 어둡다. 허리 끈."""
    c = C(32, 32, seed=seed); c.shadow(16, 29.5, 13, 2)
    lump(c, 16, 13, 13, 4, 9, 'gold', top=5, front=(4, 3), seed=seed, tex=0.3, edge=0.6)
    for x in range(4, 28):
        if c.m[23][x] and c.m[23][x] == 'gold': c.tone(x, 23, 'bark', 3 if x < 16 else 2)
    lump(c, 16, 4, 8.5, 3, 5, 'gold', top=5, front=(4, 3), seed=seed + 1, tex=0.3, edge=0.5)
    for x in range(9, 24):
        if c.m[13][x]: c.tone(x, 13, 'bark', 3 if x < 16 else 2)
    return fin(c)

def rowboat(seed=41):
    """뭍에 올린 작은 배 32x16: 옆모습(뱃전) + 위에서 보이는 갑판 안쪽 띠. 들린 이물·고물, 가로 앉을판 둘."""
    c = C(32, 16, seed=seed); c.shadow(16, 14, 14, 1.6)
    for x in range(2, 30):                                                        # 뱃전 윗 테두리(한 줄)
        c.tone(x, 2 - (1 if (x < 6 or x > 25) else 0), 'wood', 5 if x < 14 else 4)
    for y in range(3, 7):                                                         # 갑판 안쪽 = 윗면(평평, 어둡다)
        for x in range(3, 29): c.tone(x, y, 'bark', 2)
    for x in (10, 11, 19, 20):                                                    # 앉을판
        for y in range(3, 7): c.tone(x, y, 'wood', 4 if x in (10, 19) else 3)
    for y in range(7, 14):                                                        # 옆면(뱃전 바깥)
        ins = max(0, y - 10)
        for x in range(2 + ins, 30 - ins):
            t = 4 if x < 12 else 3
            if y >= 12: t = 2
            if (y == 9) and x % 4 == 0: t -= 1
            if H(x, y, seed) < 0.15: t -= 1
            c.tone(x, y, 'wood', max(1, t))
    for x in range(3, 29, 6):                                                     # 뱃전 이음 못
        c.tone(x, 8, 'iron', 4)
    return fin(c)

def driftwood(seed=43):
    c = C(16, 16, seed=seed); c.shadow(8, 14, 6, 1.1)
    hlog(c, 2, 13, 2, 5, 8, 'bark', top=5, front=(3, 2), seed=seed)
    c.tone(6, 11, 'bark', 2)
    return fin(c)

def tufted(c, cx, yt, rx, ryT, hF, mat, seed, dots=(), top=5, front=(3, 2)):
    lump(c, cx, yt, rx, ryT, hF, mat, top=top, front=front, seed=seed, tex=0.3, edge=0.8)
    for (dx, dy, m, t) in dots:
        x, y = int(cx + dx), int(yt + dy)
        if c.m[y][x]: c.tone(x, y, m, t)

def heath_c(seed=42):
    c = C(16, 16, seed=seed); c.shadow(8, 13.5, 6, 1.4)
    tufted(c, 8, 4, 6.5, 2, 6, 'leaf', seed, dots=((-3, 1, 'red', 4), (1, 2, 'red', 5), (3, 1, 'cream', 5), (-1, 6, 'red', 3), (-4, 5, 'cream', 4)), top=5, front=(3, 2))
    return fin(c)

def shrine(seed=4):
    """길가 작은 사당: 지붕도 기둥과 같은 돌(윗면 한 톤 밝고 앞띠 한 단 어둡다). 두 층 납작 지붕, 기둥 둘, 안에 조각상, 앞에 꽃."""
    c = C(32, 36, seed=seed); c.shadow(16, 33, 13, 2.0)
    c.group(1); c.box(4, 29, 24, 2, 4, 'stone', top=0.88, front=0.6)
    c.group(2); c.new()
    for y in range(14, 29):
        for x in range(8, 24): c.tone(x, y, 'stone', 2 if (x < 12 or y < 18) else 1)
    for x0 in (6, 22):
        c.new()
        for y in range(14, 29):
            for i in range(3): c.tone(x0 + i, y, 'stone', (5, 4, 2)[i] if y > 16 else (4, 3, 2)[i])
        c.tone(x0, 28, 'stone', 3)
    c.group(3); c.new()
    for (x, y, t) in ((15, 18, 5), (16, 18, 4), (15, 19, 5), (16, 19, 4), (14, 20, 4), (15, 20, 5), (16, 20, 4), (17, 20, 3),
                      (14, 21, 4), (15, 21, 5), (16, 21, 4), (17, 21, 3), (14, 22, 4), (15, 22, 4), (16, 22, 3), (17, 22, 3), (15, 23, 3), (16, 23, 2)):
        c.tone(x, y, 'stone', t)
    for x in range(13, 19): c.tone(x, 24, 'stone', 4 if x < 16 else 2)
    c.group(4)
    slab(c, 2, 7, 28, 4, 3, 'stone', top=5, front=(4, 3), seed=seed, tex=0.12)       # 아래 지붕판(처마)
    slab(c, 6, 0, 20, 5, 2, 'stone', top=5, front=(4, 3), seed=seed + 1, tex=0.12)   # 위 지붕판
    for x in range(3, 29):                                                            # 처마 밑 그늘 한 줄
        if c.m[11][x] is None: c.tone(x, 11, 'stone', 2)
    c.group(5); c.new()
    for (x, y, m, t) in ((10, 31, 'red', 4), (11, 30, 'leaf', 3), (13, 31, 'cream', 5), (21, 31, 'cream', 4), (22, 30, 'leaf', 3), (19, 31, 'red', 5)):
        c.tone(x, y, m, t)
    return fin(c)

def wayside_cross(seed=22):
    """길가 표지 십자 16x32: 나무 기둥 + 가로대 + 나무 지붕널(윗면 4행, 앞띠 2행)."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 5, 1.2)
    slab(c, 3, 2, 10, 5, 3, 'wood', top=5, front=(3, 2), seed=seed)
    slab(c, 6, 10, 4, 1, 19, 'wood', top=4, front=(3, 2), seed=seed, round_=False)
    for x in range(2, 14): c.tone(x, 12, 'bark', 4 if x < 8 else 2); c.tone(x, 13, 'bark', 2)
    return fin(c)

# ---------- 농가·목장 ----------
def trough(seed=20):
    """말 물통 32x16: 테두리 1행 + 물면(윗면 4행, 평평) + 나무 앞면 7행."""
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 14, 1.5)
    for x in range(2, 30): c.tone(x, 2, 'wood', 5)
    for y in range(3, 7):
        for x in range(2, 30):
            c.tone(x, y, 'teal', 4 if (x < 4 or x > 27) is False else 3)
    for x in range(4, 28, 5): c.tone(x, 4, 'teal', 5)
    for y in range(7, 14):
        for x in range(2, 30):
            t = 3 if x < 18 else 2
            if (x - 2) % 7 == 0: t -= 1
            if y == 13: t -= 1
            c.tone(x, y, 'wood', max(1, t))
    for x0 in (2, 27):
        for y in range(3, 14): c.tone(x0, y, 'bark', 4); c.tone(x0 + 1, y, 'bark', 3)
    return fin(c)

def wild(v=1, seed=50):
    """들꽃 무더기: 풀 덩이 윗면 4행(꽃 점 몇 개) + 앞면 3행."""
    c = C(16, 16, seed=seed + v); c.shadow(8, 14, 6, 1.1)
    cols = (('red', 4), ('cream', 5), ('pink', 5), ('gold', 5))
    if v == 1:
        tufted(c, 5, 6, 4.5, 2, 5, 'leaf', seed + v, dots=((-1, 1, *cols[0]), (1, 2, *cols[1]), (0, 3, *cols[0])))
        tufted(c, 11, 2, 4.5, 2, 5, 'leaf', seed + v + 5, dots=((-1, 1, *cols[2]), (1, 3, *cols[3]), (0, 2, *cols[1])))
    else:
        tufted(c, 8, 1, 6.5, 2, 6, 'leaf', seed + v, dots=((-3, 1, *cols[3]), (0, 2, *cols[2]), (3, 1, *cols[1]), (-1, 3, *cols[0])))
    return fin(c)

# ---------- 깊은 숲 ----------
def chopping_block(seed=13):
    """장작 패는 그루터기 16x16: 윗면 타원(밝은 나이테 한 줄) + 껍질 옆면, 윗면에 박힌 작은 도끼."""
    c = C(16, 16, seed=seed); c.shadow(8, 14, 6, 1.3)
    lump(c, 7, 4, 5.5, 3, 6, 'bark', top=5, front=(3, 2), seed=seed, tex=0.25, topmat='wood')
    for (x, y) in ((10, 6), (11, 6)): c.tone(x, y, 'iron', 4)
    c.tone(10, 7, 'bark', 3); c.tone(9, 8, 'bark', 3)
    return fin(c)

def hide_rack(seed=14):
    """가죽 말림틀 32x32: 가로대 윗면 4행 + 앞띠 2행, 네모 기둥 둘, 늘어진 가죽 둘."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 13, 1.5)
    for gi, (x0, x1, mat, t) in enumerate(((6, 14, 'cloth', 4), (17, 25, 'cream', 4))):
        c.group(2 + gi); c.new()
        for y in range(11, 25):
            f = (y - 11) / 14
            for x in range(x0 + int(f * 1.5), x1 - int(f * 1.5) + 1):
                tone = t + (1 if x < (x0 + x1) // 2 - 1 else 0) - (1 if y > 21 else 0)
                if H(x, y, seed) > 0.85: tone -= 1
                c.tone(x, y, mat, max(1, tone))
    c.group(1)
    for x0 in (2, 26):                                                             # 네모 기둥(윗면 4x2 + 앞 20행)
        slab(c, x0, 9, 4, 2, 20, 'bark', top=5, front=(3, 2), seed=seed, round_=False)
    slab(c, 2, 2, 28, 4, 3, 'bark', top=5, front=(3, 2), seed=seed + 1)           # 가로대
    return fin(c)

def hlog_full(seed=46):
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 13, 1.3)
    hlog(c, 1, 30, 2, 5, 7, 'bark', topmat='moss', top=4, front=(3, 2), seed=seed)
    for x in range(8, 28):
        if H(x, 0, seed) > 0.55 and c.m[10][x]: c.tone(x, 10, 'moss', 3)
    return fin(c)

def stump(seed=47):
    c = C(16, 16, seed=seed); c.shadow(8, 14, 6, 1.3)
    lump(c, 8, 5, 5.5, 3, 6, 'bark', top=5, front=(3, 2), seed=seed, tex=0.25, topmat='wood')
    for x in range(6, 11): c.tone(x, 8, 'wood', 4)
    return fin(c)

def fern(v=0, seed=48):
    """고사리 무더기: 잎 덩이 윗면 4~6행에 밝은 잎맥 몇 줄 + 앞면."""
    c = C(16, 16, seed=seed + v); c.shadow(8, 14, 6.5, 1.2)
    if v == 0:
        lump(c, 8, 3, 7, 2, 7, 'leaf', top=5, front=(3, 2), seed=seed + v, tex=0.3, edge=1.0)
    elif v == 1:
        lump(c, 6, 3, 5, 2.5, 6, 'leaf', top=5, front=(3, 2), seed=seed + v, tex=0.3, edge=0.8)
        lump(c, 11, 3, 4, 2.5, 5, 'leaf', top=5, front=(3, 2), seed=seed + v + 1, tex=0.3, edge=0.8)
    else:
        lump(c, 8, 2, 6.5, 2, 8, 'leaf', top=5, front=(3, 2), seed=seed + v, tex=0.3, edge=1.0)
    for (x, y) in (((4, 5), (6, 6), (9, 5), (11, 6)), ((3, 7), (5, 8), (11, 4), (12, 5)), ((5, 5), (7, 7), (10, 6), (9, 8)))[v]:
        if c.m[y][x]: c.tone(x, y, 'leaf', 5)
    return fin(c)

def toadstools(v=0, seed=49):
    """독버섯 무리: 갓 = 윗면 타원(붉은 평평면 + 흰 점), 밑에 갓 그늘 + 크림 줄기."""
    c = C(16, 16, seed=seed + v); c.shadow(8, 14, 6.5, 1.2)
    specs = (((8, 2, 5, 12), (3, 8, 3, 6), (13, 7, 3, 6)),
             ((5, 2, 4, 7), (11, 2, 4, 7), (8, 8, 3, 6)),
             ((8, 3, 6, 7), (3, 9, 3, 5), (13, 9, 3, 5)))[v]
    for (cx, yt, rx, _) in sorted(specs, key=lambda s: s[1] + s[2]):
        ryT = 2 if rx >= 4 else 1.5
        stem_h = 4 if rx >= 4 else 3
        ys = int(yt + 2 * ryT) + 1
        for y in range(ys, ys + stem_h):
            for x in range(cx - 1, cx + 1):
                c.tone(x, y, 'cream', (4, 3)[x - (cx - 1)] - (1 if y == ys + stem_h - 1 else 0))
        lump(c, cx, yt, rx, ryT, 1, 'red', top=5 if rx >= 4 else 4, front=(3, 2), seed=seed + cx, tex=0.0)
        for (dx, dy) in ((-1, 0), (1, 1), (0, 1)):
            x, y = cx + dx, int(yt + ryT) + dy - 1
            if rx >= 4 and c.m[y][x] == 'red': c.tone(x, y, 'cream', 6)
    return fin(c)

def hunter_pelt_post(seed=16):
    """사냥 표지 기둥 16x32: 네모 기둥(윗면 6x4) 앞면에 뼈 뿔 달린 해골."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 5, 1.2)
    slab(c, 5, 4, 6, 4, 23, 'bark', top=5, front=(3, 2), seed=seed, round_=False)
    c.group(2); c.new()
    for (x, y) in ((4, 13), (3, 12), (2, 11), (2, 10), (5, 12), (11, 13), (12, 12), (13, 11), (13, 10), (10, 12), (3, 10), (12, 10)):
        c.tone(x, y, 'bone', 5 if x < 8 else 3)
    for x in range(6, 10):
        for y in range(13, 17): c.tone(x, y, 'bone', 4 if x < 8 else 3)
    c.tone(6, 15, 'dark', 2); c.tone(9, 15, 'dark', 2)
    return fin(c)

def trail_post(seed=17):
    """오솔길 표지 기둥 16x32: 네모 기둥(윗면 6x4) + 앞에 못 박은 화살 판."""
    c = C(16, 32, seed=seed); c.shadow(8, 29.5, 5, 1.2)
    slab(c, 5, 5, 6, 4, 22, 'wood', top=5, front=(3, 2), seed=seed, round_=False)
    c.group(2); c.new()
    for y in range(14, 20):
        for x in range(1, 15 - (1 if y in (14, 19) else 0)):
            if x >= 13 and y in (14, 19): continue
            c.tone(x, y, 'wood', 4 if y < 17 else 3)
    for (x, y) in ((14, 16), (14, 17), (15, 16), (15, 17)): c.tone(x, y, 'wood', 3)
    for x in (3, 9): c.tone(x, 16, 'iron', 4)
    return fin(c)

def wall_seg(seed=26):
    """마른 돌담 마디 32x24: 윗면 5행(이끼 조금) + 돌 앞면 9행(줄눈)."""
    c = C(32, 24, seed=seed); c.shadow(16, 22, 14, 1.4)
    slab(c, 1, 9, 30, 5, 9, 'mstone', top=5, front=(3, 2), seed=seed, tex=0.1)
    for y in (13, 17):
        for x in range(1, 31):
            if c.m[y][x] == 'mstone' and y > 13 or (y == 13 and False): pass
    for y, off in ((16, 0), (20, 5)):
        for x in range(1, 31):
            if c.m[y][x]: c.tone(x, y, 'mstone', 1)
        for x in range(2 + off, 30, 10):
            for yy in (y - 3, y - 2, y - 1):
                if yy >= 14 and c.m[yy][x]: c.tone(x, yy, 'mstone', 1)
    for x in range(3, 29):
        if H(x, 1, seed) > 0.7: c.tone(x, 10, 'moss', 4)
    return fin(c)

# ---------- 산길 ----------
def cairn(seed=15, big=True):
    c = C(16, 24 if big else 16, seed=seed); c.shadow(8, 22 if big else 14, 6, 1.3)
    st = (((8, 14, 7, 2, 5), (7, 9, 5.5, 2, 4), (8, 4, 4.4, 2, 3), (8, 0, 3.4, 2, 3)) if big else
          ((8, 7, 6.5, 2, 5), (8, 2, 4.4, 2, 3)))
    for i, (cx, yt, rx, ryT, hF) in enumerate(st):
        lump(c, cx, yt, rx, ryT, hF, 'mstone', top=5, front=(3, 2), seed=seed + i, tex=0.25, edge=0.4)
    return fin(c)

def stepping_stones(seed=7, kind=0):
    c = C(16, 16, seed=seed + kind)
    if kind == 0:
        pos = ((4.5, 1, 3.8, 3), (11.5, 1, 3.4, 3), (8, 8, 4.2, 4))
        for g, (cx, yt, rx, hf) in enumerate(pos):
            lump(c, cx, yt, rx, 2.2, hf, 'mstone', top=5, front=(3, 2), seed=seed + g, tex=0.2)
    else:
        pos = ((1, 3, 5), (8, 8, 5)) if kind == 1 else ((3, 8, 5), (10, 4, 4))
        for g, (x, y, r) in enumerate(pos):
            lump(c, x + r / 2 + 1, y - 2, r / 2 + 2, 2, 3, 'mstone', top=5, front=(3, 2), seed=seed + g, tex=0.2)
    return fin(c)

def boulder_m(seed=91):
    c = C(24, 20, seed=seed); c.shadow(12, 18, 10, 1.6)
    lump(c, 12, 2, 10.5, 3, 11, 'mstone', top=5, front=(3, 2), seed=seed, tex=0.3, edge=0.9)
    for (x, y) in ((6, 5), (7, 5), (8, 6), (14, 4), (15, 5), (10, 4), (16, 6)):
        if c.m[y][x]: c.tone(x, y, 'moss', 4)
    for (x, y) in ((6, 12), (9, 14), (17, 13)):
        if c.m[y][x]: c.tone(x, y, 'moss', 2)
    return fin(c)

def scree(v=0, seed=92):
    c = C(16, 16, seed=seed + v); c.shadow(8, 14, 6.5, 1.1)
    if v == 0:
        lump(c, 8, 4, 6.5, 2, 7, 'mstone', top=5, front=(3, 2), seed=seed + v, tex=0.4, edge=0.8)
        pebs = ((4, 6), (7, 8), (11, 7), (9, 6), (5, 9), (12, 9))
    else:
        lump(c, 7, 3, 5.5, 2, 6, 'mstone', top=5, front=(3, 2), seed=seed + v, tex=0.4, edge=0.8)
        lump(c, 12, 8, 3.5, 1.5, 3, 'mstone', top=5, front=(3, 2), seed=seed + v + 2, tex=0.4)
        pebs = ((4, 6), (8, 7), (6, 9), (12, 9))
    for (x, y) in pebs:
        if c.m[y][x]: c.tone(x, y, 'mstone', 6); c.tone(x + 1, y, 'mstone', 5) if c.m[y][x + 1] else None
    return fin(c)

def alpine(v=0, seed=93):
    c = C(16, 16, seed=seed + v); c.shadow(8, 14, 6.5, 1.1)
    lump(c, 8, 4 if v == 0 else 3, 6.5, 2, 7, 'leaf', top=5, front=(3, 2), seed=seed + v, tex=0.3, edge=0.8)
    cols = (('red', 4), ('cream', 5), ('gold', 5), ('pink', 5))
    for i, (dx, dy) in enumerate(((-3, 1), (0, 2), (3, 1), (-1, 4), (2, 3))):
        m, t = cols[(i + v) % 4]
        x, y = 8 + dx, (4 if v == 0 else 3) + dy
        if c.m[y][x]: c.tone(x, y, m, t)
    return fin(c)

def guard_post(seed=8):
    """초소 48x60: 넓은 나무 지붕널 윗면(18행, 평평) + 처마 앞띠 + 목조 벽(창) + 돌 기단(문)."""
    c = C(48, 60, seed=seed); c.shadow(24, 58, 20, 2)
    slab(c, 6, 40, 36, 2, 17, 'stone', top=5, front=(4, 3), seed=seed, tex=0.22)    # 돌 기단 앞면(문 포함)
    for y in range(44, 58):                                                          # 돌 줄눈
        for x in range(6, 42):
            if c.m[y][x] and ((y - 40) % 5 == 0 or (x + (y // 5) * 4) % 9 == 0): c.tone(x, y, 'stone', 2)
    for y in range(48, 58):                                                          # 문
        for x in range(21, 28):
            if y == 48 and x in (21, 27): continue
            c.tone(x, y, 'wood', 2 if x < 24 else 1)
    c.tone(26, 53, 'gold', 5)
    slab(c, 8, 22, 32, 0, 18, 'wood', top=4, front=(3, 2), seed=seed + 1, tex=0.15, round_=False)   # 목조 벽 앞면
    for x in range(8, 40, 4):
        for y in range(22, 40): c.tone(x, y, 'wood', 1)
    for y in range(27, 33):                                                          # 창
        for x in range(21, 28): c.tone(x, y, 'dark', 2 if y > 28 else 1)
    for x in range(20, 29): c.tone(x, 26, 'wood', 4); c.tone(x, 33, 'wood', 4)
    slab(c, 3, 2, 42, 18, 3, 'red', top=4, front=(3, 2), seed=seed + 2, tex=0.0)     # 지붕 윗면 + 처마 앞띠
    for y in range(5, 20, 3):
        for x in range(4, 44): c.tone(x, y, 'red', 3) if c.m[y][x] and H(x, y, seed) < 0.55 else None
    for y in range(2, 20):
        for x in (3, 4): c.tone(x, y, 'red', 5)
    for x in range(8, 40): c.tone(x, 23 - 1 + 1, 'wood', 1) if c.m[23][x] else None  # 처마 밑 그늘
    c.group(9); c.new()
    for y in range(-0, 0): pass
    return fin(c)

def ruin_gate(seed=6):
    """숲속 옛 문터 64x56: 높은 왼 기둥(윗면 10행 + 앞 34행), 부러진 오른 기둥(들쭉날쭉 윗면), 쓰러진 상인방, 이끼·덩굴."""
    c = C(64, 56, seed=seed); c.shadow(32, 53, 27, 2.5)
    slab(c, 5, 6, 16, 9, 34, 'mstone', top=5, front=(3, 2), seed=seed, tex=0.12)
    slab(c, 43, 24, 16, 9, 20, 'mstone', top=5, front=(3, 2), seed=seed + 1, tex=0.12)
    for x in range(43, 59):                                                           # 부러진 윗면 가장자리
        n = int(H(x, 3, seed) * 3.2)
        for y in range(24, 24 + n): c.m[y][x] = None
    slab(c, 26, 46, 22, 3, 4, 'mstone', top=5, front=(3, 2), seed=seed + 2, tex=0.2)  # 쓰러진 상인방
    lump(c, 36, 50, 5, 1.5, 2, 'mstone', top=5, front=(3, 2), seed=seed + 3)
    for x0, top, bot in ((5, 6, 46), (43, 24, 46)):
        for y in range(top + 13, bot, 6):
            for x in range(x0, x0 + 16):
                if c.m[y][x] and H(x, y, seed) > 0.12: c.tone(x, y, 'mstone', 1)
        for y in range(top + 13, bot):
            for x in (x0 + 5, x0 + 11):
                if (y // 6) % 2 == (1 if x == x0 + 5 else 0) and c.m[y][x]: c.tone(x, y, 'mstone', 1)
    for y in range(56):
        for x in range(64):
            if c.m[y][x] == 'mstone' and c.fix[y][x] is not None and c.fix[y][x] >= 4 and H(x // 2, y // 2, seed + 3) > 0.7 and H(x, y, 1) > 0.5:
                c.tone(x, y, 'moss', c.fix[y][x] - 1)
    for x in range(6, 21):
        n = int(3 + 8 * H(x, 0, seed + 8))
        for y in range(16, 16 + n):
            if H(x, y, seed + 4) > 0.5 and c.m[y][x]: c.tone(x, y, 'leaf', 2 + (x + y) % 3)
    return fin(c)

def stone_bridge(seed=27):
    """능선 개울 돌다리 80x64: 뒷난간 윗면 2행 + 안쪽 3행 + 상판(22행, 평평) + 앞난간 윗면 2행·앞면 4행 + 아치 앞 벽 25행."""
    W, Hh = 80, 64
    c = C(W, Hh, seed=seed)
    for x in range(0, W):
        for y in range(0, 2): c.tone(x, y, 'stone', 5)
        for y in range(2, 5): c.tone(x, y, 'stone', 3 if (x // 7 + y) % 4 else 2)
    for y in range(5, 27):                                                          # 상판
        for x in range(2, W - 2):
            t = 4; m = 'stone'
            if y % 6 == 5: t = 3                                                   # 포석 줄눈(가로)
            elif (x + (y // 6) * 7) % 12 == 0: t = 3                               # 어긋난 세로 줄눈
            elif H(x, y, seed) < 0.05: t = 3
            if (y < 8 or y > 23) and H(x, y, seed + 3) < 0.10: m, t = 'moss', 3     # 가장자리 이끼
            c.tone(x, y, m, t)
    for x in range(10, W - 10):                                                     # 수레바퀴 자국 두 줄(살짝 어둡다)
        for y in (12, 13, 19, 20):
            if H(x, y, seed + 5) < 0.75: c.tone(x, y, 'stone', 3)
    for x in range(0, W):
        for y in range(27, 29): c.tone(x, y, 'stone', 5)
        for y in range(29, 33): c.tone(x, y, 'stone', 3 if (x // 7 + y) % 4 else 2)
    for y in range(33, 62):
        for x in range(4, W - 4):
            t = 3 if x < 40 else 2
            if (y - 33) % 6 == 0: t -= 1
            elif ((x + ((y - 33) // 6) * 7) % 13 == 0): t -= 1
            c.tone(x, y, 'stone', max(1, t))
    cx, r = 40, 18                                                                   # 아치 구멍(물)
    for y in range(40, 62):
        for x in range(cx - r, cx + r + 1):
            dx = (x + 0.5 - cx) / r
            if dx * dx <= 1 and y + 0.5 >= 62 - 22 * math.sqrt(1 - dx * dx):
                c.tone(x, y, 'dark', 2 if y < 54 else 1)
    for x in range(cx - r + 2, cx + r - 1):
        for y in range(56, 62):
            if c.m[y][x] == 'dark': c.tone(x, y, 'teal', 3 if (x + y) % 3 else 2)
    for (x0, y0) in ((2, 0), (W - 6, 0)):                                            # 난간 끝 기둥 머리
        for y in range(y0 - 0, 5):
            for x in range(x0, x0 + 4): c.tone(x, y, 'stone', 5 if y < 2 else 4)
    return fin(c)

# ---------- 밀밭 칸 B/C : 3/4 (윗면 이삭 띠 5행 + 앞면 줄기 11행, 위아래 이음) ----------
def wheat33(v, seed=11):
    import palette
    from PIL import Image
    S = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,) for h in palette.RAMPS_CHIP['straw']]
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); p = im.load()
    off = 1 if v == 1 else 3
    for y in range(16):
        for x in range(16):
            n = px2._hash(x, y, seed + v * 13)
            if y < 5:                                        # 윗면: 이삭 머리 (단색 + 드문 점)
                t = 3
                if y in (1, 3) and (x + off + y) % 5 == 0: t = 4
                elif y == 2 and (x + off) % 6 == 3: t = 2
            elif y == 5:                                     # 앞면 머리줄(밝은 이삭 끝)
                t = 4 if (x + off) % 3 != 0 else 3
            else:                                            # 앞면: 세로 줄기
                t = 2
                if (x + off) % 4 == 1: t = 3
                if y >= 14: t = 1 if (x + off) % 4 != 1 else 2
                elif n > 0.9: t = 3
            if x == 0 and y == 0: t = 5                      # 이삭 끝 밝은 점(검사기가 전체 칸을 배경으로 오인하지 않게)
            p[x, y] = S[t - 1]
    return im

NEW = {
 'haystack': haystack, 'rowboat': rowboat, 'driftwood': driftwood, 'heath_c': heath_c, 'shrine': shrine, 'wayside_cross': wayside_cross,
 'wheat_b': lambda: wheat33(1), 'wheat_c': lambda: wheat33(2), 'trough': trough, 'wild_b': lambda: wild(1), 'wild_c': lambda: wild(2),
 'chopping_block': chopping_block, 'hide_rack': hide_rack, 'log_fallen': hlog_full, 'stump': stump,
 'fern_a': lambda: fern(0), 'fern_b': lambda: fern(1), 'fern_c': lambda: fern(2),
 'toadstools_a': lambda: toadstools(0), 'toadstools_b': lambda: toadstools(1), 'toadstools_c': lambda: toadstools(2),
 'hunter_post': hunter_pelt_post, 'trail_post': trail_post, 'wall_seg': wall_seg,
 'cairn': cairn, 'cairn_s': lambda: cairn(big=False), 'stones_a': lambda: stepping_stones(kind=0), 'stones_b': lambda: stepping_stones(kind=1), 'stones_c': lambda: stepping_stones(kind=2),
 'boulder_m': boulder_m, 'scree_a': lambda: scree(0), 'scree_b': lambda: scree(1), 'alpine_a': lambda: alpine(0), 'alpine_b': lambda: alpine(1),
 'guard_post': guard_post, 'ruin_gate': ruin_gate, 'stone_bridge': stone_bridge,
}
NOTES = {
 'haystack': '건초더미(두 덩이 쌓기 — 위 덩이 윗면이 밝고 앞면은 어둡다)', 'rowboat': '작은 노 젓는 배(옆 뱃전 + 위에서 보이는 갑판 띠 + 앉을판)', 'driftwood': '떠내려온 통나무(윗면 4행 + 옆면 5행)',
 'heath_c': '낮은 헤더 덤불 C(윗면·앞면 둔덕)', 'shrine': '길가 사당(지붕도 기둥과 같은 돌 — 두 층 납작 지붕판)', 'wayside_cross': '길가 표지 십자(나무 지붕널)',
 'wheat_b': '밀밭 칸 B(이삭 띠 5행 + 줄기 앞면)', 'wheat_c': '밀밭 칸 C', 'trough': '말 물통(테두리 + 물 윗면 4행 + 나무 앞면)', 'wild_b': '풀밭 들꽃 무더기 B(윗면·앞면)', 'wild_c': '풀밭 들꽃 무더기 C(윗면·앞면)',
 'chopping_block': '장작 패는 그루터기(윗면 타원 + 껍질 옆면, 도끼)', 'hide_rack': '가죽 말림틀(가로대 윗면 + 네모 기둥)', 'log_fallen': '쓰러진 통나무(이끼 윗면 + 껍질 옆면 + 잘린 단면)', 'stump': '그루터기',
 'fern_a': '고사리 A(덩이)', 'fern_b': '고사리 B(두 덩이)', 'fern_c': '고사리 C(키 큰 덩이)',
 'toadstools_a': '독버섯 A(갓 윗면 + 줄기)', 'toadstools_b': '독버섯 B', 'toadstools_c': '독버섯 C',
 'hunter_post': '사냥 표지 기둥(네모 기둥 윗면 + 뿔 해골)', 'trail_post': '오솔길 표지 기둥(네모 기둥 윗면 + 화살 판)', 'wall_seg': '마른 돌담 마디(윗면 5행 + 줄눈 앞면)',
 'cairn': '돌탑(대, 쌓은 납작 덩이)', 'cairn_s': '돌탑(소)', 'stones_a': '징검돌 A(납작 돌 윗면 + 두께)', 'stones_b': '징검돌 B', 'stones_c': '징검돌 C',
 'boulder_m': '작은 산바위(윗면 이끼)', 'scree_a': '자갈 무더기 A(낮은 둔덕)', 'scree_b': '자갈 무더기 B', 'alpine_a': '고산 꽃 뭉치 A(풀덩이)', 'alpine_b': '고산 꽃 뭉치 B',
 'guard_post': '초소(넓은 지붕 윗면 + 목조 벽 + 돌 기단)', 'ruin_gate': '무너진 성문(기둥 윗면 + 부러진 기둥 + 쓰러진 상인방)', 'stone_bridge': '능선 개울 돌다리(5x4칸): 뒷난간·평평한 상판·앞난간·아치 앞 벽',
}

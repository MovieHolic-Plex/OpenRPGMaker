# 광산 갱도 조각들 — 전부 손 도트(Pillow). 3/4: 윗면+앞면, 옆면 없음, 빛 왼쪽 위.
from mt_base import *
import random, pz
import numpy as np
from px2 import _hash, vnoise
from mt_base import face_rock_px, _FT
from dprops import shadow as _shadow, glow as _glow

def fin(cv, k=.62): return pz.fin(cv.im, k)
def sh(im, cx, cy, rx, ry, a=70): return _shadow(im, cx, cy, rx, ry, a)

def box3(cv, x0, y0, x1, y1, top, ramp, seed=0, plank=False, grain=.08):
    """3/4 상자: 윗면 top 행 + 앞면. 빛 왼쪽 위 (왼쪽 밝고 오른쪽·아래 어둡다)."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top:
                k = 5 if (x == x0 or y == y0) else 4
            else:
                k = 4 - (1 if x >= x1 - 2 else 0) - (1 if y >= y1 - 2 else 0) + (1 if x == x0 else 0)
                if plank and (x - x0) % 4 == 0: k -= 1
            if _hash(x, y, seed) < grain: k += 1 if _hash(y, x, seed + 1) < .5 else -1
            cv.px(x, y, ramp[cl(k, 1, 6)])

def cyl3(cv, cx, cy, rx, ry, h, ramp, seed=0, lid=None):
    """원통: 위 타원 + 앞면. cy = 윗면 타원 중심."""
    for y in range(int(cy), int(cy + h + ry + 2)):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + .5 - cx) / rx
            if abs(dx) > 1: continue
            ybot = cy + h + ry * math.sqrt(max(0, 1 - dx * dx))
            if y + .5 > ybot: continue
            k = 4 - int((dx + 1) * 1.6) + (1 if dx < -.35 else 0)
            if y > cy + h + ry * .55 * 0 and (y - cy) % 5 == 4: k -= 1
            if _hash(x, y, seed) < .06: k += 1
            cv.px(x, y, ramp[cl(k, 1, 6)])
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                c = (lid or ramp)[5 if dx + dy < -.2 else 4] if lid is None else lid
                cv.px(x, y, c if lid is not None else ramp[5 if dx + dy < -.2 else 4])

# ---------------------------------------------------------------- 결정
def _prism(cv, ramp, cx, base, bw, hh, tilt, seed):
    """3/4 로 본 육각 결정 기둥: 왼 면(밝음) / 오른 면(어둠) / 뾰족한 꼭대기 면."""
    top = base - hh; shoulder = base - hh * .70
    for y in range(int(top), int(base) + 1):
        for x in range(int(cx - bw / 2.0) - 1, int(cx + bw / 2.0) + 2):
            # 기둥 폭: 어깨 아래는 bw, 어깨~꼭대기는 삼각으로 좁아짐 (꼭대기는 tilt 만큼 기울어짐)
            if y >= shoulder: l, r = cx - bw / 2.0, cx + bw / 2.0
            else:
                t = (y - top) / max(1.0, shoulder - top)
                tipx = cx + tilt
                l = tipx + (cx - bw / 2.0 - tipx) * t; r = tipx + (cx + bw / 2.0 - tipx) * t
            if not (l <= x + .5 <= r): continue
            mid = cx + bw * .08 + (tilt * (1 - max(0, min(1, (y - top) / max(1.0, shoulder - top)))) if y < shoulder else 0)
            if y < shoulder and (y - top) < 3 + bw * .2: k = 6 if x + .5 < mid else 5            # 꼭대기 면
            elif x + .5 < mid - bw * .22: k = 5
            elif x + .5 < mid: k = 4
            elif x + .5 < mid + bw * .28: k = 3
            else: k = 2
            if y > base - 3: k -= 1
            if _hash(x, y, seed) < .06: k += 1
            cv.px(x, y, ramp[cl(k, 1, 6)])
    # 면 사이 능선 (밝은 선)
    for y in range(int(shoulder), int(base) - 1):
        cv.px(int(cx + bw * .08), y, ramp[5])
    cv.px(int(cx - bw / 2.0 + 1), int(shoulder) + 1, ramp[6]); cv.px(int(cx - bw / 2.0 + 1), int(shoulder) + 2, ramp[6])

def crystal(kind='b', variant=0, seed=0):
    ramp = {'b': CRY_B, 'v': CRY_V, 'a': CRY_A}[kind]
    if variant == 0: W, H = 16, 24; prisms = [(6, 7, 15, -0.8), (12, 5, 9, 0.6)]
    elif variant == 1: W, H = 16, 32; prisms = [(5, 6, 12, -1.0), (11, 7, 22, 1.0), (8, 5, 7, 0.0)]
    else: W, H = 32, 32; prisms = [(8, 8, 15, -1.0), (17, 10, 26, 1.0), (25, 7, 13, 0.8), (13, 5, 9, 0.0), (22, 5, 8, -.5)]
    cv = Cv(W, H); base = H - 3
    # 바닥 빛 번짐 (반투명)
    for y in range(base - 2, base + 2):
        for x in range(0, W):
            d = ((x - W / 2.0) / (W / 2.0)) ** 2 + ((y - base + .5) / 2.2) ** 2
            if d < 1 and _hash(x, y, seed) < .55: cv.p[x, y] = tuple(ramp[3]) + (60,)
    for (cx, bw, hh, tilt) in sorted(prisms, key=lambda q: q[2]):
        _prism(cv, ramp, cx, base, bw, hh, tilt, seed + cx)
    im = fin(cv, .56)
    return sh(im, W / 2.0, base + .5, W * .40, 1.8, 55)

# ---------------------------------------------------------------- 광석·바위
def ore_pile(kind='iron', seed=1, w=32, h=24):
    ramp = {'iron': ORE, 'copper': COPR, 'gold': GOLD}[kind]
    c = Cv(w, h); rnd = random.Random(seed)
    base = h - 3
    lumps = [(w * .5, base - 5, w * .40, 8)] + [(rnd.uniform(w * .15, w * .85), base - rnd.uniform(1, 6), rnd.uniform(4, 7), rnd.uniform(3, 5)) for _ in range(7)]
    lumps.sort(key=lambda l: l[1])
    for (cx, cy, rx, ry) in lumps:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; r2 = dx * dx + dy * dy
                if r2 > 1: continue
                nz = math.sqrt(1 - r2)
                lv = .25 + .75 * max(0, -.55 * dx - .65 * dy + .75 * nz)
                if _hash(x, y, seed + 5) < .1: lv += .18
                k = int(round(lv * 4.9 + .7)) - (1 if kind in ('iron', 'copper') else 0)
                cv_ = ramp[cl(k, 1, 6)]
                if kind == 'gold' and _hash(x, y, seed + 11) > .88: cv_ = GOLD[6 if lv > .6 else 5]
                if kind == 'copper' and _hash(x, y, seed + 12) > .90: cv_ = (70, 160, 130) if lv > .5 else (44, 112, 96)
                c.px(x, y, cv_)
    # 반짝 광물 점
    for _ in range(5):
        x = rnd.randrange(4, w - 4); y = rnd.randrange(base - 9, base - 1)
        if c.p[x, y][3]: c.px(x, y, ramp[6])
    im = fin(c, .6)
    return sh(im, w / 2, h - 3, w * .42, 2.2, 70)

def boulder(w=24, h=20, seed=1):
    c = Cv(w, h); base = h - 3
    for y in range(h):
        for x in range(w):
            dx = (x + .5 - w / 2) / (w * .46); dy = (y + .5 - (base - h * .30)) / (h * .46)
            wob = (vnoise(x, y, 3, seed) - .5) * .3
            r2 = dx * dx + dy * dy * (1 if dy < 0 else .8) + wob
            if r2 > 1: continue
            nz = math.sqrt(max(.02, 1 - r2)); lv = .28 + .72 * max(0, -.55 * dx - .65 * dy + .75 * nz)
            k = int(round(lv * 4.9 + .7))
            if vnoise(x, y, 2.2, seed + 3) > .78: k -= 1
            if _hash(x, y, seed + 4) < .06: k += 1
            c.px(x, y, RK[cl(k, 1, 6)])
    # 균열
    cx = int(w * .55)
    for i in range(7):
        c.px(cx + (i // 3) * (1 if seed % 2 else -1), 4 + i, RK[1])
    return sh(fin(c), w / 2, h - 2, w * .44, 2.2, 70)

def rubble(w=16, h=12, seed=2, n=5):
    c = Cv(w, h); rnd = random.Random(seed)
    for i in range(n):
        cx = rnd.uniform(3, w - 3); cy = rnd.uniform(h - 7, h - 3); rx = rnd.uniform(2, 4); ry = rnd.uniform(1.6, 2.8)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    k = 4 - int((dx + dy + 2) * .9) + (1 if dx + dy < -.5 else 0)
                    c.px(x, y, RK[cl(k, 1, 6)])
    return fin(c)

def stalagmite(size=1, seed=0):
    H = 24 if size == 1 else 32; c = Cv(16, H)
    for y in range(2, H - 1):
        t = (y - 2) / (H - 3.0); hw = 2 + int(t * 5.4)
        for x in range(8 - hw, 8 + hw):
            k = 5 if x < 8 - hw + 2 else (4 if x < 7 else (3 if x < 8 + hw - 2 else 2))
            if _hash(x, y, seed + 4) < .08: k += 1 if _hash(y, x, 5) < .5 else -1
            c.px(x, y, RK[cl(k, 1, 6)])
    for x in (7, 8): c.px(x, 2, RK[5])
    return sh(fin(c), 8, H - 2, 7.5, 2)

# ---------------------------------------------------------------- 나무 구조물
def timber_frame(w=3, h=3, seed=0):
    """갱목 지지대: 기둥 둘 + 윗보 + 비스듬한 버팀. 가운데 통로는 열려 있다. w×h 칸."""
    W, H = w * T, h * T; c = Cv(W, H)
    wd = WOODX
    def post(x0):
        for y in range(8, H - 1):
            for dx in range(6):
                k = 5 if dx == 0 else (4 if dx < 3 else (3 if dx < 5 else 2))
                if y % 11 == 0: k -= 1
                if _hash(x0 + dx, y, seed + 2) < .07: k += 1
                c.px(x0 + dx, y, wd[cl(k, 1, 6)])
        # 발판 돌
        for dx in range(-1, 7): c.px(x0 + dx, H - 2, RK[3]); c.px(x0 + dx, H - 1, RK[2])
    post(2); post(W - 8)
    # 윗보 (앞면 3행 + 윗면 2행)
    for x in range(0, W):
        c.px(x, 2, wd[5]); c.px(x, 3, wd[5] if x % 9 else wd[4])
        for y in range(4, 9):
            k = 4 - (1 if y > 6 else 0) - (1 if x > W - 8 else 0)
            if x % 9 == 4: k -= 1
            c.px(x, y, wd[cl(k, 1, 6)])
        c.px(x, 9, wd[1])
    # 버팀 (45°)
    for i in range(8):
        c.px(8 + i, 9 + i, wd[3]); c.px(9 + i, 9 + i, wd[4]); c.px(W - 9 - i, 9 + i, wd[2]); c.px(W - 10 - i, 9 + i, wd[3])
    # 못·쇠 띠
    for (x, y) in ((4, 5), (W - 5, 5), (4, 20), (W - 5, 20)): c.px(x, y, IRON[4])
    return pad16(fin(c, .6))

def lantern_post(seed=0):
    c = Cv(16, 32)
    for y in range(10, 29):
        c.px(6, y, WOODX[5]); c.px(7, y, WOODX[4]); c.px(8, y, WOODX[3]); c.px(9, y, WOODX[2])
    for x in range(3, 13): c.px(x, 29, RK[3]); c.px(x, 30, RK[2])
    for x in range(4, 12): c.px(x, 28, RK[4])
    # 갈고리 팔
    for x in range(6, 12): c.px(x, 9, WOODX[4]); c.px(x, 10, WOODX[2])
    c.px(11, 11, IRON[3]); c.px(11, 12, IRON[3])
    # 등 (유리)
    for y in range(13, 19):
        for x in range(9, 14):
            c.px(x, y, GOLD[5] if (x < 11 and y < 16) else GOLD[4])
        c.px(8, y, IRON[2]); c.px(14, y, IRON[1])
    for x in range(8, 15): c.px(x, 12, IRON[3]); c.px(x, 19, IRON[1])
    c.px(10, 14, (255, 252, 226)); c.px(10, 15, (255, 252, 226))
    for x in range(9, 14): c.px(x, 11, IRON[4]) if False else None
    im = fin(c, .64)
    # 빛무리
    g = _glow(40, (255, 190, 90), 70)
    out = new(40, 40); out.alpha_composite(g, (0, 0)); out.alpha_composite(im, (12 + 0, 8 - 0)) if False else None
    return sh(im, 8, 30, 6, 1.6, 60)

def minecart(loaded=False, seed=0, w=32, h=24):
    c = Cv(w, h); wd = WOODX
    y0 = 4; y1 = h - 5
    # 몸통 앞면: 널 세로결 + 쇠띠
    for y in range(y0, y1):
        for x in range(2, w - 2):
            t = (y - y0) / float(y1 - y0)
            k = 4 - (1 if t > .55 else 0) + (1 if x == 2 else 0) - (1 if x >= w - 4 else 0)
            if (x - 2) % 5 == 0: k -= 1
            c.px(x, y, wd[cl(k, 1, 6)])
    for x in range(2, w - 2):
        c.px(x, y0, IRON[4]); c.px(x, y0 + 1, IRON[3]); c.px(x, y1 - 1, IRON[2]); c.px(x, y1 - 2, IRON[3])
    for x in (7, w - 8):
        for y in range(y0, y1): c.px(x, y, IRON[3]); c.px(x + 1, y, IRON[1]) if False else None
    # 윗면(입구): 안쪽 어둠 또는 광석 더미
    for y in range(0, y0):
        for x in range(3, w - 3): c.px(x, y, (30, 24, 30) if not loaded else ORE[3])
    if loaded:
        rnd = random.Random(seed)
        for _ in range(9):
            cx = rnd.randrange(5, w - 6); cy = rnd.randrange(0, 3)
            for yy in range(cy, cy + 3):
                for xx in range(cx, cx + 4):
                    k = 5 if (xx == cx or yy == cy) else (4 if yy < cy + 2 else 3)
                    c.px(xx, yy, ORE[k])
        for x in range(3, w - 3): c.px(x, y0 - 1, ORE[5] if _hash(x, 0, seed) < .5 else ORE[4])
    # 바퀴
    for cx in (8, w - 9):
        for y in range(y1 - 1, h - 1):
            for x in range(cx - 3, cx + 3):
                dx = (x + .5 - cx) / 3.0; dy = (y + .5 - (y1 + 1.5)) / 2.8
                if dx * dx + dy * dy <= 1: c.px(x, y, IRON[1] if dx > .2 else IRON[2])
        c.px(cx - 1, y1, IRON[5])
    return sh(fin(c, .6), w / 2, h - 2, w * .42, 2, 70)

def ladder(h=2, seed=0):
    """벽 앞면에 기대 세운 사다리 (16 x 16h)."""
    H = h * T; c = Cv(16, H); wd = WOODX
    for y in range(0, H):
        for x in (3, 4): c.px(x, y, wd[5 if x == 3 else 4])
        for x in (11, 12): c.px(x, y, wd[3 if x == 11 else 2])
    for y in range(3, H - 1, 5):
        for x in range(5, 11): c.px(x, y, wd[5]); c.px(x, y + 1, wd[3])
    return fin(c, .6)

def barrel_keg(kind='powder', seed=0):
    c = Cv(16, 20)
    cyl3(c, 8, 5, 6.5, 2.6, 9, WOODX, seed)
    for (y, ) in ((8,), (15,)):
        for x in range(2, 15):
            dx = (x + .5 - 8) / 6.5
            if abs(dx) <= 1: c.px(x, y, IRON[3]); c.px(x, y + 1, IRON[1])
    if kind == 'powder':
        # 윗면 검은 가루 + 도화선
        for y in range(3, 8):
            for x in range(3, 13):
                dx = (x + .5 - 8) / 5.0; dy = (y + .5 - 5) / 2.0
                if dx * dx + dy * dy <= 1: c.px(x, y, (30, 26, 34))
        for i in range(5): c.px(9 + i // 2, 2 - i // 2 if False else 3 - i // 3, (150, 120, 70))
        c.px(12, 1, (255, 200, 80)); c.px(12, 0, (255, 150, 50))
    return sh(fin(c), 8, 18, 6.5, 2, 70)

def crate_stack(seed=0, n=2):
    c = Cv(24, 24 if n > 1 else 16)
    H = c.h
    def crate(x0, y0):
        box3(c, x0, y0, x0 + 14, y0 + 14, 3, WOODX, seed + x0, plank=True)
        for i in range(11): c.px(x0 + 1 + i, y0 + 3 + (i * 10) // 11 if False else y0 + 3 + i, WOODX[2]) if False else None
        for x in range(x0, x0 + 14): c.px(x, y0 + 3, WOODX[2])
        for y in range(y0 + 3, y0 + 14): c.px(x0 + 2, y, WOODX[2]); c.px(x0 + 11, y, WOODX[2])
    crate(1, H - 14)
    if n > 1: crate(9, H - 22 if H >= 24 else 0)
    return sh(fin(c), 12, H - 2, 10, 2, 70)

def chest(seed=0):
    c = Cv(16, 16)
    box3(c, 1, 5, 15, 15, 0, WOODX, seed, plank=True)
    # 둥근 뚜껑 윗면
    for y in range(2, 7):
        for x in range(1, 15):
            k = 5 if y < 4 else 4
            if x < 3: k += 1
            c.px(x, y, WOODX[cl(k, 1, 6)])
    for x in range(1, 15): c.px(x, 6, IRON[3]); c.px(x, 7, IRON[1])
    for y in range(2, 15): c.px(3, y, IRON[3]); c.px(12, y, IRON[2])
    c.px(7, 8, GOLD[5]); c.px(8, 8, GOLD[4]); c.px(7, 9, GOLD[3]); c.px(8, 9, GOLD[3])
    return sh(fin(c), 8, 14, 7, 1.6, 70)

def pickaxe_stand(seed=0):
    """곡괭이 걸이: 벽에 기대 세운 곡괭이 둘 + 삽."""
    c = Cv(16, 24); wd = WOODX
    for y in range(9, 22): c.px(5, y, wd[4]); c.px(6, y, wd[2])         # 자루
    for x in range(1, 11): c.px(x, 6 if 2 < x < 8 else 7, IRON[4] if x < 6 else IRON[2]); c.px(x, 8 if x in (1, 10) else 5 if x in (4, 5, 6) else 6, IRON[3])
    for y in range(11, 22): c.px(11, y, wd[3]); c.px(12, y, wd[1])      # 삽 자루
    for y in range(3, 9):
        for x in range(10, 14): c.px(x, y, IRON[4] if x < 12 else IRON[2])
    for x in range(3, 15): c.px(x, 22, RK[3]); c.px(x, 21, RK[4]) if x in (5, 6, 11, 12) else None
    return sh(fin(c), 8, 22, 6, 1.5, 60)

def wheelbarrow(seed=0):
    c = Cv(24, 16)
    for y in range(3, 11):
        for x in range(4, 18):
            k = 4 - (1 if y > 7 else 0) + (1 if x == 4 else 0) - (1 if x > 15 else 0)
            c.px(x, y, WOODX[cl(k, 1, 6)])
    for x in range(5, 17): c.px(x, 3, ORE[4] if _hash(x, 0, seed) < .6 else ORE[3]); c.px(x, 4, ORE[3])
    for x in range(16, 23): c.px(x, 8 - (x - 16) // 3, WOODX[3])
    for x in range(1, 5): c.px(x, 9, WOODX[4])
    for y in range(11, 15):
        for x in range(1, 5): c.px(x, y, IRON[2]) if (x - 2.5) ** 2 + (y - 12.5) ** 2 < 4 else None
    c.px(20, 11, WOODX[3]); c.px(20, 12, WOODX[2])
    return sh(fin(c), 12, 14, 10, 1.6, 60)

def mine_mouth(seed=0):
    """갱도 입구 (3x3칸 = 48x48): 돌 아치 틀 + 갱목 + 어둠 + 바깥 빛."""
    W, H = 48, 48; c = Cv(W, H); wd = WOODX
    # 바위 둔덕 (앞면 바위)
    for y in range(0, H):
        for x in range(0, W):
            c.px(x, y, face_rock_px(x + 90, y, H, 7, x < 1, x > W - 2))
    # 어둠 (아치)
    cx = W / 2.0
    for y in range(7, H - 2):
        for x in range(8, W - 8):
            dx = (x + .5 - cx) / ((W - 16) / 2.0)
            top = 9 + (1 - math.sqrt(max(0, 1 - dx * dx))) * 11
            if y >= top: c.px(x, y, mix((10, 8, 14), (30, 22, 34), (y - top) / 40.0))
    # 바깥 빛 (아치 안쪽 아래에서 새는 빛)
    for y in range(H - 12, H - 2):
        for x in range(12, W - 12):
            if _hash(x, y, seed) < (y - (H - 12)) / 14.0 * .7: c.px(x, y, mix((30, 22, 34), (210, 190, 130), (y - (H - 12)) / 12.0))
    # 갱목 틀
    for y in range(12, H - 1):
        for dx in range(5):
            k = 5 if dx == 0 else (4 if dx < 3 else (3 if dx < 4 else 2))
            c.px(7 + dx, y, wd[k]); c.px(W - 12 + dx, y, wd[cl(k - 1, 1, 6)])
    for x in range(5, W - 5):
        dx = (x + .5 - cx) / ((W - 10) / 2.0)
        yy = 6 + int((1 - math.sqrt(max(0, 1 - dx * dx))) * 12)
        for y in range(yy, yy + 4):
            k = 5 if y == yy else (4 if y == yy + 1 else 3 if y == yy + 2 else 2)
            c.px(x, y, wd[k])
    # 아랫돌 문턱
    for x in range(6, W - 6): c.px(x, H - 2, RK[5]); c.px(x, H - 1, RK[3])
    # 등불 걸이
    for y in range(14, 20): c.px(W - 6, y, IRON[3])
    for y in range(20, 25):
        for x in range(W - 8, W - 4): c.px(x, y, GOLD[5] if x < W - 6 else GOLD[4])
    return pad16(fin(c, .6))

def cave_in(seed=3):
    """붕괴 갱도 (3x3칸): 무너진 바위와 부러진 갱목이 입구를 막는다."""
    W, H = 48, 40; c = Cv(W, H); rnd = random.Random(seed); wd = WOODX
    # 뒤 부러진 기둥
    for y in range(4, 26):
        for dx in range(5):
            c.px(5 + dx, y, wd[5 if dx == 0 else (4 if dx < 3 else 2)])
    for y in range(2, 18):
        for dx in range(5): c.px(W - 10 + dx, y + (dx // 2), wd[4 if dx < 2 else 2])
    for i in range(12): c.px(8 + i, 4 + i // 2 + 0, wd[3]); c.px(8 + i, 5 + i // 2, wd[2])  # 부러진 보
    # 바위 덩이 (언덕)
    lumps = [(W * .5, H - 12, 21, 12)] + [(rnd.uniform(4, W - 4), H - rnd.uniform(5, 14), rnd.uniform(5, 9), rnd.uniform(4, 7)) for _ in range(9)]
    lumps.sort(key=lambda l: l[1])
    for (cx, cy, rx, ry) in lumps:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; r2 = dx * dx + dy * dy
                if r2 > 1 or y >= H - 2: continue
                nz = math.sqrt(1 - r2); lv = .22 + .78 * max(0, -.55 * dx - .65 * dy + .75 * nz)
                k = int(round(lv * 4.9 + .7))
                if _hash(x, y, seed + 2) < .1: k += 1
                if vnoise(x, y, 2.5, seed + 4) > .8: k -= 1
                c.px(x, y, RK[cl(k - 1, 1, 6)])
    # 앞쪽 부러진 보 조각
    for i in range(14):
        c.px(10 + i, H - 12 + i // 5, wd[4]); c.px(10 + i, H - 11 + i // 5, wd[3]); c.px(10 + i, H - 10 + i // 5, wd[1])
    # 먼지
    for (x, y) in ((6, H - 4), (30, H - 3), (40, H - 6), (20, H - 4)): c.px(x, y, RK[6])
    return pad16(sh(fin(c), W / 2, H - 2, 21, 2.5, 70))

def shaft_hole(seed=0):
    """수직 갱 (2x2칸): 둥근 구멍을 나무 테두리가 두르고 위에 도르래 틀. 구멍 가운데는 걷기 불가."""
    W, H = 32, 40; c = Cv(W, H); wd = WOODX
    cx, cy = 16, 28
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - cx) / 14.5; dy = (y + .5 - cy) / 7.0
            r2 = dx * dx + dy * dy
            if r2 <= 1:
                if r2 > .62:
                    k = 5 if dx + dy < -.2 else 4
                    if dy > .3: k = 3
                    c.px(x, y, wd[cl(k, 1, 6)] if int((math.atan2(dy, dx) + 3.2) * 4) % 2 else wd[cl(k - 1, 1, 6)])
                else: c.px(x, y, mix((8, 6, 12), (26, 20, 30), 1 - r2))
    # 도르래 틀: 두 기둥 + 윗 가로대 + 바퀴
    for y in range(6, 28):
        for dx in range(3):
            c.px(3 + dx, y, wd[5 if dx == 0 else 3]); c.px(W - 6 + dx, y, wd[4 if dx == 0 else 2])
    for x in range(2, W - 2): c.px(x, 6, wd[5]); c.px(x, 7, wd[4]); c.px(x, 8, wd[2])
    for y in range(2, 11):
        for x in range(12, 21):
            dx = (x + .5 - 16) / 4.5; dy = (y + .5 - 6.5) / 4.4
            if dx * dx + dy * dy <= 1: c.px(x, y, IRON[4] if dx + dy < 0 else IRON[2])
    c.px(15, 6, IRON[1]); c.px(16, 6, IRON[1])
    for y in range(11, 27): c.px(16, y, (170, 140, 88)); c.px(17, y, (120, 92, 56))     # 밧줄
    for x in range(14, 20): c.px(x, 26, IRON[3]); c.px(x, 27, IRON[1])
    return pad16(sh(fin(c), 16, 34, 14, 3, 60))

def stairs_hole(seed=0, down=True):
    """바닥에서 내려가는 계단 (2x1칸 = 32x16): 돌 테두리 + 아래로 갈수록 어두운 층계. 위에서 본 모양 그대로."""
    c = Cv(32, 16)
    for y in range(16):
        b = y // 4
        for x in range(2, 30):
            k = [5, 4, 3, 2][b]
            if y % 4 == 0: k = [6, 5, 4, 3][b]
            if y % 4 == 3: k = max(0, [3, 2, 1, 0][b])
            if _hash(x, y, seed) < .06: k += 1
            c.px(x, y, RK[cl(k, 0, 6)] if k > 0 else (22, 16, 22))
    for y in range(16): c.px(0, y, RK[4]); c.px(1, y, RK[3]); c.px(30, y, RK[2]); c.px(31, y, RK[1])
    return c.im

def spiderweb(seed=0):
    """모서리 거미줄 (16x16, 왼쪽 위 모서리에 걸림): 방사 줄 4개 + 호 둘, 반투명."""
    c = Cv(16, 16)
    for ang_deg in (0, 28, 62, 90):
        ang = math.radians(ang_deg)
        for r in range(0, 15):
            x = int(r * math.cos(ang)); y = int(r * math.sin(ang))
            if 0 <= x < 16 and 0 <= y < 16: c.p[x, y] = (206, 210, 222, 190)
    for r in (5, 9, 13):
        for a in range(0, 31):
            ang = a / 30.0 * (math.pi / 2)
            x = int(r * math.cos(ang) + .5); y = int(r * math.sin(ang) + .5)
            if 0 <= x < 16 and 0 <= y < 16 and c.p[x, y][3] == 0 and (a + r) % 3: c.p[x, y] = (176, 182, 198, 150)
    return c.im

def puddle(w=2, h=1, seed=0):
    W, H = w * T, h * T; c = Cv(W, H)
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - W / 2) / (W / 2 - 1 + (vnoise(x, y, 4, seed) - .5) * 1.4); dy = (y + .5 - H / 2) / (H / 2 - 1.2 + (vnoise(x + 7, y, 4, seed + 1) - .5) * 1.0)
            r = dx * dx + dy * dy
            if r > 1: continue
            if r > .78: c.px(x, y, (24, 64, 78))
            else:
                k = 2 if vnoise(x, y * 2, 4, seed + 2) < .55 else 3
                if _hash(x, y, seed + 3) > .93: k = 4
                if y < H * .35 and r < .6: k = max(1, k - 1)
                c.px(x, y, WMINE[k])
    # 하이라이트
    for (x, y) in ((W // 3, H // 2 - 1), (W // 3 + 1, H // 2 - 1), (W * 2 // 3, H // 2)):
        if c.p[x, y][3]: c.px(x, y, WMINE[5])
    return c.im

def bones_miner(seed=0):
    """광부 유골: 두개골 + 헬멧 + 가슴뼈. 16x16, 걷기 가능 땅 장식."""
    c = Cv(16, 16); B = [PL[1], PL[2], PL[3], PL[4], PL[5]]
    for (x, y) in ((3, 10), (4, 10), (5, 11), (6, 11), (7, 12), (8, 12), (9, 12), (10, 13)): c.px(x, y, B[3])
    for (x, y) in ((5, 12), (6, 13), (7, 13), (11, 11), (12, 12), (12, 11)): c.px(x, y, B[2])
    for y in range(6, 11):
        for x in range(7, 13):
            dx = (x + .5 - 9.5) / 3.0; dy = (y + .5 - 8.5) / 2.6
            if dx * dx + dy * dy <= 1: c.px(x, y, B[4] if dx < 0 else B[3])
    c.px(8, 8, (40, 30, 40)); c.px(10, 8, (40, 30, 40)); c.px(9, 10, B[1])
    for x in range(6, 13): c.px(x, 5, IRON[4] if x < 9 else IRON[3]); 
    for x in range(7, 12): c.px(x, 4, IRON[3] if x < 9 else IRON[2])
    c.px(9, 3, GOLD[5])
    return fin(c, .7)

def timber_stack(seed=0):
    """쌓아 둔 갱목 더미 (2x1칸): 둥근 통나무 단면이 보인다."""
    c = Cv(32, 16); wd = WOODX
    rows = [(4, 4), (2, 5)]
    # 앞쪽 단면
    k = 0
    for row, (n, yy) in enumerate(((6, 12), (5, 7), (4, 3))):
        for i in range(n):
            cx = 3 + i * 5 + (row % 2) * 2.5 + (6 - n) * 2.4
            cy = yy + 1.5
            for y in range(int(cy) - 3, int(cy) + 4):
                for x in range(int(cx) - 3, int(cx) + 4):
                    dx = (x + .5 - cx) / 3.2; dy = (y + .5 - cy) / 3.2; r = dx * dx + dy * dy
                    if r > 1: continue
                    ring = int(math.sqrt(r) * 3)
                    c.px(x, y, (wd[5], wd[4], wd[3], wd[2])[min(3, ring)] if r < .8 else wd[2])
            c.px(int(cx), int(cy), wd[3])
    return sh(fin(c), 16, 14, 14, 1.8, 60)

def rail_buffer(seed=0):
    """레일 끝막이: 침목 둘 + 쇠 완충기."""
    c = Cv(16, 16)
    for x in range(2, 14):
        c.px(x, 12, WOODX[3]); c.px(x, 13, WOODX[1])
    for y in range(4, 12):
        for x in (4, 5, 10, 11): c.px(x, y, IRON[4] if x < 8 else IRON[2])
    for x in range(3, 13): c.px(x, 4, IRON[5]); c.px(x, 5, IRON[3])
    return sh(fin(c), 8, 14, 6, 1.4, 50)

def winch(seed=0):
    """갱 도르래 감개 (2x2칸): 나무 틀 + 밧줄 통 + 손잡이."""
    W, H = 32, 32; c = Cv(W, H); wd = WOODX
    for y in range(8, 28):
        for dx in range(3): c.px(3 + dx, y, wd[5 if dx == 0 else 3]); c.px(26 + dx, y, wd[4 if dx == 0 else 2])
    cyl3(c, 16, 10, 10, 3, 6, wd, seed)
    for y in range(11, 17):
        for x in range(8, 24):
            if (x + y) % 3 == 0: c.px(x, y, (170, 140, 88))
    for x in range(26, 31): c.px(x, 14 + (x - 26) // 2, IRON[4])
    c.px(30, 17, IRON[5]); c.px(31, 17, IRON[3])
    for x in range(1, 31): c.px(x, 28, RK[3]); c.px(x, 29, RK[2])
    return pad16(sh(fin(c), 16, 29, 14, 2, 60))

def ore_vein_wall(seed=0, kind='b'):
    """벽 앞면에 박힌 광맥 (16x16, 앞면 위에 얹는다): 결정 조각."""
    ramp = {'b': CRY_B, 'a': CRY_A, 'v': CRY_V}[kind]; c = Cv(16, 16); rnd = random.Random(seed)
    for (cx, cy, r) in ((5, 8, 3), (10, 5, 2.4), (11, 11, 2.8), (6, 12, 1.8)):
        for y in range(16):
            for x in range(16):
                dx = (x + .5 - cx) / r; dy = (y + .5 - cy) / r
                if abs(dx) + abs(dy) * .9 <= 1.1:
                    k = 5 if dx < 0 and dy < 0 else (4 if dx < 0 or dy < 0 else 3)
                    c.px(x, y, ramp[k])
    return fin(c, .6)

def hanging_chain(seed=0):
    c = Cv(8, 32)
    for y in range(0, 32):
        if y % 4 in (0, 1): c.px(3, y, IRON[4]); c.px(4, y, IRON[2])
        else: c.px(2, y, IRON[3]); c.px(5, y, IRON[2])
    return fin(c, .7)

def cart_track_wall(seed=0): return None

# ---------------------------------------------------------------- 16변형 오토타일
RAIL_STEEL = IRON[4]

def rails_cell(n, e, s, w, seed=0):
    """궤도 레일 (위층 투명 오토타일, 걷는 땅 위에 덧그림, 걸을 수 있다).
    이웃 방향마다 중심선 한 줄, 곧은 줄·꺾임(둥근 호)·T·십자. 침목 위에 두 줄 쇠 레일."""
    c = Cv(16, 16)
    arms = [k for k, v in (('n', n), ('e', e), ('s', s), ('w', w)) if v]
    ends = {'n': (8, 0), 'e': (16, 8), 's': (8, 16), 'w': (0, 8)}
    pts = {}   # (x,y) -> (dist, along)
    def seg(x0, y0, x1, y1):
        vx, vy = x1 - x0, y1 - y0; L2 = vx * vx + vy * vy
        for y in range(16):
            for x in range(16):
                px_, py_ = x + .5, y + .5
                t = max(0.0, min(1.0, ((px_ - x0) * vx + (py_ - y0) * vy) / L2))
                qx, qy = x0 + vx * t, y0 + vy * t
                d = math.hypot(px_ - qx, py_ - qy)
                al = math.sqrt(L2) * t
                # 가로(수평) 선분이면 along 은 x 좌표 기준, 세로이면 y 기준 (칸 경계에서 침목 위상이 맞게)
                al = px_ if abs(vx) > abs(vy) else py_
                if (x, y) not in pts or d < pts[(x, y)][0]: pts[(x, y)] = (d, al)
    if len(arms) == 2 and set(arms) not in ({'n', 's'}, {'e', 'w'}):
        a1, a2 = arms
        cxy = {('n', 'e'): (16, 0), ('e', 'n'): (16, 0), ('e', 's'): (16, 16), ('s', 'e'): (16, 16), ('s', 'w'): (0, 16), ('w', 's'): (0, 16), ('w', 'n'): (0, 0), ('n', 'w'): (0, 0)}[(a1, a2)]
        for y in range(16):
            for x in range(16):
                d = abs(math.hypot(x + .5 - cxy[0], y + .5 - cxy[1]) - 8)
                ang = math.atan2(y + .5 - cxy[1], x + .5 - cxy[0])
                pts[(x, y)] = (d, ang * 8)          # 호 위 위치(원호 길이 ≈ 8*각)
    else:
        if not arms: arms = []; seg(8, 4, 8, 12)
        for k in arms:
            ex, ey = ends[k]
            if len(arms) == 1: seg(ex, ey, 8, 8)
            else: seg(ex, ey, 8, 8)
    for (x, y), (d, al) in pts.items():
        if d <= 5.2:
            m = int(math.floor(al)) % 8
            if m == 1: c.px(x, y, WOODX[5])
            elif m == 2: c.px(x, y, WOODX[4])
            elif m == 3: c.px(x, y, WOODX[2])
            elif m == 4: c.px(x, y, (36, 26, 28))
    for (x, y), (d, al) in pts.items():
        if 2.6 <= d <= 4.2:
            inner = d < 3.4
            c.px(x, y, IRON[5] if inner and x + y < 16 else (IRON[4] if inner else IRON[2]))
        elif 4.2 < d <= 4.9 and c.p[x, y][3] == 0 and int(math.floor(al)) % 8 not in (0, 5, 6, 7):
            c.px(x, y, (30, 24, 34))
    if len(arms) == 1:   # 끝 가로 침목 (막다른 끝)
        k = arms[0]; ex, ey = {'n': (8, 7), 's': (8, 8), 'e': (8, 8), 'w': (7, 8)}[k]
        for i in range(-5, 5):
            if k in ('n', 's'): c.px(ex + i, ey, IRON[3]); c.px(ex + i, ey + 1, IRON[1])
            else: c.px(ex, ey + i, IRON[3]); c.px(ex + 1, ey + i, IRON[1])
    return c.im

def _edge_d(n, e, s, w):
    """칸 안 각 화소에서 「이웃 없는 쪽」 가장자리까지의 거리 (이웃 있는 쪽은 무시)."""
    d = np.full((16, 16), 99.0)
    for y in range(16):
        for x in range(16):
            v = 99.0
            if not w: v = min(v, x + .5)
            if not e: v = min(v, 15.5 - x)
            if not n: v = min(v, y + .5)
            if not s: v = min(v, 15.5 - y)
            d[y, x] = v
    return d

def wet_cell(n, e, s, w, seed=0):
    """물 번짐(젖은 바위) 덮개: 반투명 푸른 얼룩. 이웃 없는 쪽은 안쪽으로 들쭉날쭉 물러난다. 주기 16 잡음이라 이웃과 이어진다."""
    c = Cv(16, 16); d = _edge_d(n, e, s, w)
    for y in range(16):
        for x in range(16):
            th = 2.2 + (vnoise(x, y, 4, seed + 3, per=4) - .5) * 4.6 + (_hash(x, y, seed) - .5) * 1.2 if d[y, x] < 99 else -99
            iso = not (n or e or s or w)
            if d[y, x] <= th: continue
            v = vnoise(x, y, 2, seed + 4, per=8)
            core = d[y, x] > th + 2.2
            if iso:
                dx = (x + .5 - 8) / 5.6; dy = (y + .5 - 8) / 4.4
                if dx * dx + dy * dy > 1 + (v - .5) * .6: continue
            a = 118 if core else 84
            col = (24, 62, 80) if v < .42 else ((30, 74, 92) if v < .72 else (38, 88, 104))
            if _hash(x, y, seed + 6) > .93: col = (96, 164, 176); a = 150
            c.p[x, y] = col + (a,)
    return c.im

def rubble_cell(n, e, s, w, seed=0):
    """낙반 자갈 번짐 덮개: 안쪽일수록 촘촘한 잔돌 무리, 이웃 없는 쪽은 성글게 흩어진다."""
    c = Cv(16, 16); d = _edge_d(n, e, s, w)
    for y in range(16):
        for x in range(16):
            if d[y, x] >= 99: p = .46
            else: p = max(0.0, min(.46, (d[y, x] - 1.0) * .1))
            if vnoise(x, y, 4, seed + 8, per=4) < .35: p *= .5
            if not (n or e or s or w): p = p * .8 if 3 <= x <= 12 and 3 <= y <= 12 else 0
            if _hash(x, y, seed + 7) < p:
                k = 2 + int(_hash(y, x, seed) * 4)
                c.px(x, y, RK[cl(k, 1, 6)])
                if _hash(x, y, seed + 2) < .45 and y + 1 < 16 and (d[min(15, y + 1), x] >= 99 or d[min(15, y + 1), x] > 1.0): c.px(x, y + 1, RK[1])
    return c.im

def wet_edge_fix(im): return im

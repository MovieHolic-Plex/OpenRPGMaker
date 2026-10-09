# 하늘 도시 조각: 신전·탑·회랑(버들항 신전/성 탑을 푸른 슬레이트 지붕으로), 밧줄 다리·부유 계단·잔교, 비행선·계류 기둥,
# 떠 있는 수정·흙덩이, 정원 소품, 풍차. 손 도트(px2.C 부피 칠 + 직접 화소), 버들항 7단 램프, 3/4 시점(윗면+앞면), 빛 왼쪽 위.
import math, random, colorsys
import numpy as np
from PIL import Image, ImageDraw
from sc_base import (T, ST, TRV, CRM, WDr, SL, GOLD, WD, LF, ROPE, DIRT, CRY, IRON, CL, CP, SK, mul, mix, new, _hash,
                     vnoise, px2, pz, roman, C6, bd5, hx)
from px2 import C
import sc_island as I
import sc_sky as S

px2.PAL['cloud'] = ['#%02x%02x%02x' % c for c in CL]
px2.GRAIN['cloud'] = (0.02, 2)
px2.PAL['marble'] = ['#%02x%02x%02x' % c for c in TRV]
px2.GRAIN['marble'] = (0.05, 2)

def put(p, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: p[x, y] = tuple(c[:3]) + (a,)

# ================================================================ 슬레이트 지붕으로 다시 칠하기
def to_slate(im, top=None, keep=None):
    """버들항 테라코타 지붕 화소(주황·벽돌·자주 그늘·노란 밝은 끝)를 밝기 순서대로 성 슬레이트(푸른 보라) 7단에 옮긴다.
    keep(x,y) 가 참인 화소(박공 금 화관 등)는 그대로."""
    im = im.copy(); p = im.load(); W, H = im.size
    for y in range(H if top is None else min(H, top)):
        for x in range(W):
            r, g, b, a = p[x, y]
            if not a or (keep and keep(x, y)): continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > .34 and (h < .145 or h > .87) and r > 60:
                l = (.3 * r + .59 * g + .11 * b) / 255
                t = min(6, max(1, int(l * 7.4 + .9)))
                p[x, y] = SL[t] + (a,)
    return im

def sky_temple():
    """하늘 신전 7×7(112x112): 버들항 포룸 신전(박공·기둥 여섯·청동 문·기단 계단)을 성 슬레이트 푸른 지붕으로 다시 덮고,
    용마루 양끝과 박공 꼭대기에 금 장식(아크로테리온). 지붕은 걷기, 기단·벽 4줄 막힘."""
    src = bd5.lib_sprite('forum.temple'); W0 = src.width
    im = to_slate(src, top=64, keep=lambda x, y: abs(x - W0 / 2) < 11 and 37 <= y <= 50)
    o = new(W0, src.height + 6); o.alpha_composite(im, (0, 6)); im = o; p = im.load(); W, H = im.size
    # 박공 꼭대기 금 장식: 꼭짓점 찾기
    apex = None
    for y in range(H):
        xs = [x for x in range(W) if p[x, y][3]]
        if xs: apex = (sum(xs) // len(xs), y); break
    ax, ay = apex
    for (dx, dy, t) in ((0, -3, 5), (0, -2, 4), (-1, -2, 4), (1, -2, 2), (0, -1, 3), (-1, -1, 5), (1, -1, 2), (0, -4, 6)):
        put(p, W, H, ax + dx, ay + dy, GOLD[t])
    return im

def colonnade_sky():
    """하늘 회랑 4×4(64x64): 버들항 스토아(기둥 넷·그늘 벽·트래버틴 보도)를 푸른 슬레이트 외쪽 지붕으로. 맨 아랫줄 보도는 걷기."""
    return to_slate(roman.stoa(4, doors=False, seed=3), top=16)

def beacon_tower():
    """항로 등대탑 3×9(48x144): 버들항 성 원통 탑(마름돌·창 두 단·코벨 고리·슬레이트 원뿔)에 깃발 대신 떠 있는 푸른 수정 등불과 빛 고리."""
    t = C6.tower6(wc=3, body=72, cone=40, tiers=2, ry=5, flag=None)
    W, H = t.width, t.height + 22
    im = new(W, H); im.alpha_composite(t, (0, 22)); p = im.load()
    cx = W // 2
    # 떠 있는 수정(마름모 기둥): 왼쪽 면 밝음, 오른쪽 그늘, 가운데 반짝
    for y in range(0, 17):
        half = int(5 * (1 - abs(y - 8) / 8.6)) + 1
        for x in range(cx - half, cx + half):
            t_ = 5 if x < cx - 1 else (4 if x < cx + 1 else 2)
            if y < 3 or x == cx - half: t_ = 6 if x < cx else 3
            put(p, W, H, x, y, CRY[t_])
        put(p, W, H, cx - half - 1, y, CRY[1]); put(p, W, H, cx + half, y, CRY[0])
    put(p, W, H, cx - 2, 5, CRY[6]); put(p, W, H, cx - 2, 6, CRY[6])
    # 빛 고리(반투명 점)
    for a in range(0, 360, 20):
        x = int(cx + math.cos(math.radians(a)) * 9); y = int(9 + math.sin(math.radians(a)) * 3)
        if p[x, y][3] == 0 and a % 40 == 0: put(p, W, H, x, y, CRY[5], 200)
    return im

# ================================================================ 대리석 소품
def marble_column(broken=False, seed=0):
    """대리석 기둥 1×3(16x48) / 부러진 기둥 1×2: 주두·세로 홈 둘·기단(버들항 신전 기둥과 같은 식). 아랫줄만 막힘."""
    if not broken:
        im = new(16, 48); p = im.load()
        roman.column(p, 16, 48, 8, 2, 45, 7, TRV)
        for x in range(2, 14): put(p, 16, 48, x, 46, TRV[3]); put(p, 16, 48, x, 47, TRV[2])
        return pz.fin(im)
    im = new(16, 32); p = im.load()
    roman.column(p, 16, 32, 8, 6, 29, 7, TRV)
    # 부러진 윗면: 비스듬한 꺾인 선 위를 지우고 깨진 단면(밝은 윗면)
    for x in range(16):
        cut = 6 + int(4 * abs(math.sin(x * .9 + seed))) + (x // 3)
        for y in range(0, cut): p[x, y] = (0, 0, 0, 0)
        if p[x, cut][3]: put(p, 16, 32, x, cut, TRV[6]); put(p, 16, 32, x, cut + 1, TRV[5])
    for x in range(2, 14): put(p, 16, 32, x, 30, TRV[3]); put(p, 16, 32, x, 31, TRV[2])
    # 곁에 떨어진 조각
    for (x, y, t) in ((12, 28, 5), (13, 28, 4), (13, 29, 3), (12, 29, 3)): put(p, 16, 32, x, y, TRV[t])
    return pz.fin(im)

def brazier_sky():
    """하늘 화로 1×2(16x32): 대리석 받침 기둥 위 금테 그릇, 푸르스름한 흰 불꽃(높은 하늘의 찬 불). 아랫줄만 막힘."""
    c = C(16, 32, seed=401); c.shadow(8, 30.5, 6, 1.6)
    c.group(1); c.box(5, 18, 6, 2, 11, 'marble', front=.6)
    c.group(2); c.box(3, 28, 10, 2, 2, 'marble')
    c.group(3); c.ellipsoid(8, 15, 6, 3.4, 'gold', bias=.05)
    c.new()
    for x in range(3, 13): c.tone(x, 13, 'gold', 5 if x < 8 else 4)
    c.group(4); c.new()
    flame = ["...6...", "..656..", "..666..", ".66566.", ".65556.", "6655566", ".65356."]
    for j, row in enumerate(flame):
        for i, ch in enumerate(row):
            if ch != '.': c.tone(5 + i, 5 + j, 'cryst', int(ch))
    return pz.fin(c)

def obelisk_sky():
    """하늘 오벨리스크 1×3(16x48): 흰 돌 기둥이 위로 좁아지고 금 갓, 앞면에 푸른 띠 무늬 셋. 아랫줄만 막힘."""
    im = new(16, 48); p = im.load()
    for y in range(4, 42):
        half = 3 + (y - 4) * 1.6 / 38
        for x in range(16):
            d = x + .5 - 8
            if abs(d) > half: continue
            t = 6 if d < -half + 1.2 else (5 if d < 0 else (4 if d < half - 1.2 else 3))
            put(p, 16, 48, x, y, TRV[t])
        if y in (14, 22, 30):
            for x in range(int(8 - half) + 1, int(8 + half)): put(p, 16, 48, x, y, SL[4] if x < 8 else SL[3])
    for y in range(0, 5):
        half = y * .8
        for x in range(16):
            d = x + .5 - 8
            if abs(d) <= half + .3: put(p, 16, 48, x, y, GOLD[6 if d < 0 else 4])
    for y in range(42, 48):
        for x in range(2, 14): put(p, 16, 48, x, y, TRV[6 if y == 42 else (5 if y < 46 else 3)] if x < 13 else TRV[3])
    return pz.fin(im)

def marble_urn(seed=0):
    """대리석 항아리 화분 1×2(16x32): 받침 위 둥근 항아리, 넘쳐 늘어진 잎과 꽃(분홍·하양). 아랫줄만 막힘."""
    c = C(16, 32, seed=410 + seed); c.shadow(8, 30.5, 6, 1.6)
    c.group(1); c.box(5, 26, 6, 1, 4, 'marble')
    c.group(2); c.ellipsoid(8, 21, 5.6, 5.2, 'marble', bias=.08)
    c.new()
    for x in range(3, 13): c.tone(x, 16, 'marble', 6 if x < 8 else 4)
    c.group(3); c.ellipsoid(8, 12, 6.4, 4.6, 'leaf', bump=.5, bias=.05)
    c.ellipsoid(4, 16, 2.4, 3.4, 'leaf', bias=-.05)
    r = random.Random(seed)
    pz.flowers(c, [(5 + r.randint(0, 1), 10), (9, 9), (11, 13), (7, 13)], 4)
    return pz.fin(c)

def birdbath():
    """새 물그릇 1×2(16x32): 대리석 기둥 받침 위 얕은 물그릇(맑은 물에 하늘빛), 테두리 윗면 밝음. 아랫줄만 막힘."""
    c = C(16, 32, seed=420); c.shadow(8, 30.5, 6, 1.6)
    c.group(1); c.box(6, 18, 4, 1, 10, 'marble', front=.6)
    c.group(2); c.box(3, 28, 10, 2, 2, 'marble')
    c.group(3); c.ellipsoid(8, 15, 7, 3.2, 'marble', bias=.08)
    c.new()
    for y in range(13, 17):
        for x in range(3, 14):
            if ((x + .5 - 8) / 5.4) ** 2 + ((y + .5 - 14.6) / 1.9) ** 2 <= 1: c.tone(x, y, 'teal', 5 if x < 7 else 4)
    c.tone(5, 14, 'teal', 6)
    return pz.fin(c)

def hedge_trough(w=2, seed=0):
    """대리석 화단 생울타리 w×2: 낮은 대리석 화분 상자 안에 다듬은 생울타리(버들항 잎 결). 아랫줄만 막힘."""
    W = w * 16; c = C(W, 32, seed=430 + seed); c.shadow(W / 2, 30, W / 2 - 1, 2)
    c.group(1); c.box(1, 20, W - 2, 3, 8, 'marble', front=.62)
    c.new()
    for x in range(1, W - 1): c.tone(x, 22, 'marble', 3)
    c.group(2)
    for k in range(w * 2):
        c.ellipsoid(4 + k * 8, 15 + (k % 2), 5.2, 5.6, 'leaf', bump=.45, bias=.04 - .03 * (k % 2))
    if seed % 2:
        pz.flowers(c, [(6, 11), (W - 9, 12)], 3)
    return pz.fin(c)

def flowerbed_ring():
    """둥근 꽃밭 2×2(32x32): 대리석 둥근 테 안에 흙과 꽃 덩이(빨강·노랑·분홍·흰), 가운데 작은 관목. 막힘."""
    c = C(32, 32, seed=440)
    c.group(1); c.cylinder(16, 14, 22, 14, 'marble', capry=8)
    c.group(2); c.new()
    for y in range(7, 23):
        for x in range(4, 29):
            if ((x + .5 - 16) / 12) ** 2 + ((y + .5 - 14.5) / 6.6) ** 2 <= 1: c.tone(x, y, 'dirt', 3 if (x + y) % 3 else 2)
    c.group(3); c.ellipsoid(16, 11, 5, 4.6, 'leaf', bump=.5)
    r = random.Random(4)
    pts = [(int(16 + math.cos(a) * 9), int(15 + math.sin(a) * 4.4)) for a in [i * 6.283 / 9 + .3 for i in range(9)]]
    pz.flowers(c, pts, 4)
    return pz.fin(c)

def bench_marble():
    """대리석 벤치 2×1(32x16): 다리 둘 위 두꺼운 판(윗면 밝음). 막힘."""
    c = C(32, 16, seed=450); c.shadow(16, 14.5, 14, 1.5)
    c.group(1); c.box(4, 9, 4, 1, 5, 'marble'); c.box(24, 9, 4, 1, 5, 'marble')
    c.group(2); c.box(1, 4, 30, 4, 3, 'marble', bias=.06)
    return pz.fin(c)

def pergola():
    """꽃 덩굴 퍼걸러 3×3(48x48): 대리석 기둥 둘 위 나무 들보 셋, 덩굴 잎과 늘어진 꽃송이. 아랫줄 양끝 기둥 칸만 막힘(가운데 걷기)."""
    c = C(48, 48, seed=460); c.shadow(5, 46, 4, 1.5); c.shadow(43, 46, 4, 1.5)
    c.group(1); c.box(2, 14, 6, 2, 31, 'marble', front=.62); c.box(40, 14, 6, 2, 31, 'marble', front=.58)
    c.group(2)
    for k, y in enumerate((8, 12, 16)): c.box(0, y, 48, 2, 2, 'wood', bias=.04 - .02 * k)
    c.group(3)
    for k in range(7):
        x = 3 + k * 7; c.ellipsoid(x, 9 + (k % 2) * 2, 4.4, 3.6, 'leaf', bump=.5, bias=.02)
    for x in (5, 13, 22, 30, 38, 44):          # 늘어진 덩굴
        c.new(); L = 6 + (x * 7) % 9
        for y in range(16, 16 + L): c.tone(x + (1 if (y // 3) % 2 else 0), y, 'leaf', 3 if y % 2 else 2)
    pz.flowers(c, [(6, 9), (15, 7), (24, 10), (33, 8), (41, 10), (19, 13), (29, 13)], 4)
    return pz.fin(c)

# ================================================================ 수정
def crystal_float():
    """떠 있는 큰 수정 2×3(32x48): 땅 위 한 칸 높이에 떠 있는 육각 수정 기둥(왼쪽 면 밝음·오른쪽 그늘·반짝임), 밑에 작은 바위 받침이 함께 떠 있고,
    땅에는 푸른 빛 원. 아랫줄만 막힘(빛 원 칸)."""
    W, H = 32, 48; im = new(W, H); p = im.load(); cx = 16
    for y in range(41, 48):                                   # 땅 빛 원
        for x in range(W):
            d = ((x + .5 - cx) / 12) ** 2 + ((y + .5 - 44.5) / 3) ** 2
            if d <= 1 and ((x + y) % 2 == 0 or d < .45): put(p, W, H, x, y, CRY[4] if d < .45 else CRY[3], 150 if d >= .45 else 190)
    rk = C(W, H, seed=470); rk.group(1); rk.ellipsoid(cx, 33, 7, 3.2, 'stone', bias=.05)
    rk.new()
    for x in range(10, 23):
        for y in range(34, 34 + int(5 * (1 - abs(x + .5 - cx) / 7))): rk.tone(x, y, 'stone', 2 if x > cx else 3)
    im.alpha_composite(pz.fin(rk))
    for y in range(2, 33):                                    # 수정 기둥
        top = y < 8
        half = (y - 2) * 1.1 + .5 if top else (6.0 if y < 27 else 6 - (y - 27) * .9)
        for x in range(W):
            d = x + .5 - cx
            if abs(d) > half: continue
            if d < -half * .35: t = 6 if top else 5
            elif d < half * .35: t = 4 if not top else 5
            else: t = 2 if not top else 3
            if abs(abs(d) - half) < 1: t = 1 if d > 0 else 3
            put(p, W, H, x, y, CRY[t])
    for (x, y) in ((12, 12), (12, 13), (13, 12), (11, 20), (18, 9)): put(p, W, H, x, y, CRY[6])
    for x in range(W):
        for y in range(H):
            if p[x, y][3] == 255 and (x == 0 or p[x - 1, y][3] < 200) and 2 <= y < 33 and abs(x + .5 - cx) < 8: put(p, W, H, x - 1, y, CRY[0])
    return im

def crystal_cluster(seed=0):
    """땅 수정 무리 2×1(32x16, seed 1 = 1×1): 바닥에서 비스듬히 솟은 수정 셋~다섯, 밑동 돌. 막힘."""
    W = 32 if seed == 0 else 16; im = new(W, 16 + 8); p = im.load(); r = random.Random(480 + seed)
    n = 4 if W == 32 else 2
    for k in range(n):
        bx = 4 + k * (W - 8) / max(1, n - 1) + r.uniform(-1, 1); h = r.randint(9, 18); lean = r.uniform(-.25, .25); w = r.uniform(2, 3.2)
        for j in range(h):
            y = 23 - j; cxk = bx + lean * j; hw = w if j < h - 3 else w * (h - j) / 3
            for x in range(int(cxk - hw - 1), int(cxk + hw + 2)):
                d = x + .5 - cxk
                if abs(d) > hw: continue
                t = 5 if d < -hw * .3 else (4 if d < hw * .3 else 2)
                if j >= h - 3: t = 6 if d < 0 else 4
                put(p, W, im.height, x, y, CRY[t])
    for x in range(W):
        for y in range(im.height):
            if p[x, y][3] and (y == im.height - 1 or not p[x, y + 1][3]): put(p, W, im.height, x, y, CRY[1])
    for x in range(1, W - 1):
        if p[x, 22][3] or p[x, 21][3]: put(p, W, im.height, x, 23, ST[2]); put(p, W, im.height, x, 22, ST[3]) if not p[x, 22][3] else None
    return pz.fin(im)

# ================================================================ 다리·계단·잔교
def rope_bridge_h(n=4):
    """밧줄 다리(가로) n×3: 판자 2줄 폭 바닥(판마다 톤·못·틈), 먼 쪽 밧줄 난간(낮은 말뚝), 가까운 쪽 밧줄 난간과 아래로 처진 밧줄·매단 줄.
    위 2줄 걷기, 셋째 줄은 하늘 위 처진 밧줄(장식)."""
    W = n * 16; H = 48; im = new(W, H); p = im.load()
    for x in range(W):
        sag = int(round(2 * math.sin(math.pi * (x + .5) / W)))
        pl = x // 5; lx = x % 5
        for y in range(4 + sag, 30 + sag):
            ly = y - 4 - sag
            t = 4 if _hash(pl, 0, 91) < .6 else 5
            if lx == 4: t = 1
            elif lx == 0: t = t + 1 if t < 6 else 6
            if ly >= 24: t = 2 if ly == 24 else 1                          # 판 두께(앞면)
            if ly in (3, 21) and lx == 2: t = 2                             # 못
            if _hash(pl, ly // 6, 92) > .9 and lx in (1, 2): t = 3
            put(p, W, H, x, y, WD[min(6, t)])
        # 아래 밧줄(판 밑을 받치는 줄)
        put(p, W, H, x, 30 + sag, ROPE[2]); put(p, W, H, x, 31 + sag, ROPE[1])
    # 먼 쪽 난간: 판 위 가장자리 말뚝(16px 마다)과 밧줄
    for x in range(W):
        sag = int(round(2 * math.sin(math.pi * (x + .5) / W)))
        put(p, W, H, x, 1 + sag + int(round(1.5 * math.sin(math.pi * ((x % 16) + .5) / 16))), ROPE[4])
        # 가까운 쪽 밧줄(처짐 큼): 판 앞 아래로
        y2 = 33 + sag + int(round(5 * math.sin(math.pi * ((x % 32) + .5) / 32)))
        put(p, W, H, x, y2, ROPE[5]); put(p, W, H, x, y2 + 1, ROPE[2])
    for x0 in range(0, W, 16):
        for y in range(0, 6): put(p, W, H, x0 + 1, y, WD[5]); put(p, W, H, x0 + 2, y, WD[3])
    for x0 in range(0, W, 32):                                              # 가까운 쪽 매단 줄
        for y in range(30, 33 + 5): put(p, W, H, x0 + 8, y, ROPE[3]) if y % 2 == 0 else None
    return pz.fin(im)

def rope_bridge_v(n=4):
    """밧줄 다리(세로) 2×n: 판자를 가로로 깐 2칸 폭 바닥, 양옆 밧줄 난간과 말뚝(16px 마다), 왼쪽 밧줄 밝음. 판 전체 걷기."""
    W = 40; H = n * 16; im = new(W, H); p = im.load()
    for y in range(H):
        pl = y // 5; ly = y % 5
        for x in range(4, 36):
            t = 4 if _hash(pl, 1, 93) < .6 else 5
            if ly == 4: t = 1
            elif ly == 0: t = min(6, t + 1)
            if x in (12, 27) and ly == 2: t = 2
            if x < 6: t = max(1, t - 1)
            if x > 33: t = max(1, t - 2)
            put(p, W, H, x, y, WD[t])
        for (x, c) in ((2, ROPE[5]), (3, ROPE[3]), (36, ROPE[3]), (37, ROPE[2])): put(p, W, H, x, y, c)
    for y0 in range(0, H, 16):
        for (x, t) in ((1, 5), (2, 4), (3, 3), (36, 4), (37, 3), (38, 2)):
            for y in range(y0 + 6, y0 + 10): put(p, W, H, x, y, WD[t])
    o = new(48, H); o.alpha_composite(pz.fin(im), (0, 0))
    return o

def bridge_post():
    """다리 머리 말뚝 1×2(16x32): 굵은 통나무 말뚝(윗면 나이테), 감긴 밧줄 매듭 둘. 아랫줄만 막힘."""
    c = C(16, 32, seed=490); c.shadow(8, 30.5, 5, 1.4)
    c.group(1); c.cylinder(8, 6, 29, 4.2, 'wood', capry=2.2)
    c.group(2)
    for y in (12, 20):
        c.new()
        for x in range(3, 13):
            for yy in (y, y + 1, y + 2):
                c.tone(x, yy, 'rope', 5 if (x + yy) % 3 == 0 else (4 if x < 9 else 2))
    c.new()
    for y in range(22, 30): c.tone(12, y, 'rope', 3 if y % 2 else 4)
    return pz.fin(c)

def float_step(seed=0):
    """부유 계단 디딤판 2×2(32x32): 대리석 판(윗면 밝음·앞면 두께 3px·모서리 깨짐) 밑에 함께 떠 있는 작은 바위 뿌리. 윗줄 걷기, 아랫줄은 하늘 위 뿌리."""
    W, H = 32, 32; im = new(W, H); p = im.load(); r = random.Random(500 + seed)
    # 뿌리(먼저): 판 밑에서 뾰족하게
    tipx = 10 + r.randint(0, 12)
    for x in range(3, 29):
        u = abs(x + .5 - 16) / 13
        D = int(4 + 10 * (1 - u ** 1.5) + max(0, 8 - abs(x - tipx) * 1.6))
        for fy in range(D):
            c = I.face_px(x + seed * 37, fy + 6)
            c = mul(c, 1 - .35 * fy / max(1, D))
            if fy == D - 1: c = ST[1]
            put(p, W, H, x, 14 + fy, c)
    for y in range(2, 15):
        for x in range(1, 31):
            if (y < 4 and (x < 3 or x > 28)) or (y > 12 and (x < 2 or x > 29)): continue
            if y < 12:
                t = 5 if (x + y * 3) % 11 else 6
                if y == 2 or x == 1: t = 6
                if x == 30: t = 4
                if _hash(x, y, 501 + seed) < .05: t = 4
            else: t = 4 if y == 12 else 3
            put(p, W, H, x, y, TRV[t])
    for (x, y) in [(r.randint(4, 26), r.randint(4, 10)) for _ in range(3)]:      # 금
        put(p, W, H, x, y, TRV[3]); put(p, W, H, x + 1, y + 1, TRV[3])
    if seed % 2:                                                                  # 깨진 모서리
        for (x, y) in ((29, 2), (30, 2), (30, 3), (29, 3), (30, 4)): p[x, y] = (0, 0, 0, 0)
    return pz.fin(im)

def pier_h(n=4, end=False):
    """비행선 잔교 n×3: 굵은 판자 2줄 폭 바닥, 가장자리 보, 아래로 비스듬한 받침 까치발(16px 마다)이 하늘 위로 보인다.
    end=True 면 동쪽 끝에 난간 말뚝 둘과 등. 위 2줄 걷기."""
    W = n * 16; H = 48; im = new(W, H); p = im.load()
    for x in range(W):
        pl = x // 8; lx = x % 8
        for y in range(2, 30):
            t = 4 if _hash(pl, 0, 511) < .55 else 5
            if lx == 7: t = 1
            elif lx == 0: t = min(6, t + 1)
            if y in (3, 4) or y in (26, 27): t = 3 if lx not in (0, 7) else t
            if y == 2: t = 6
            if y >= 28: t = 2 if y == 28 else 1
            if lx == 3 and y in (5, 25): t = 2
            put(p, W, H, x, y, WD[t])
    for x0 in range(4, W, 16):                                   # 까치발
        for k in range(14):
            x = x0 + k // 2; y = 30 + k
            put(p, W, H, x, y, WD[3]); put(p, W, H, x + 1, y, WD[2])
        for y in range(30, 36): put(p, W, H, x0, y, WD[4])
    im = pz.fin(im)
    if end:
        post = bridge_post(); im.alpha_composite(post.crop((0, 0, 16, 28)), (W - 16, 0))
    return im

def landing_pad():
    """착륙장 원판 4×4(64x64, 걷기): 대리석 판석 원 둘레 띠, 안에 슬레이트·금 나침 별 무늬(여덟 갈래), 둘레 금 점. 땅 장식(걷기)."""
    W = H = 64; im = new(W, H); p = im.load(); cx = cy = 32
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - cx); dy = (y + .5 - cy) * 1.0
            r = math.hypot(dx, dy)
            if r > 31: continue
            a = math.atan2(dy, dx)
            if r > 28: c = TRV[3] if r > 30 else TRV[5]
            elif r > 25: c = TRV[6] if int((a + 3.2) * 8) % 2 else TRV[4]
            else:
                c = roman.tex_travertine(x, y)
                # 여덟 갈래 별
                k = (a % (math.pi / 4)) / (math.pi / 4); arm = abs(k - .5) * 2
                main = int(round(a / (math.pi / 4))) % 2 == 0
                L = 23 if main else 15
                if r < L * (1 - arm) + 1.5:
                    c = SL[4] if dx * .6 + dy * .8 < 0 else SL[2]
                    if main and r < L * (1 - arm) - 1: c = SL[5] if (dx + dy) < 0 else SL[3]
                if r < 4: c = GOLD[5] if r < 2.5 else GOLD[3]
                if 25 > r > 23.5 and int((a + 3.2) * 12) % 3 == 0: c = GOLD[4]
            put(p, W, H, x, y, c)
    return im

def mooring_mast():
    """비행선 계류 기둥 1×4(16x64): 돌 받침 위 굵은 나무 돛대, 꼭대기 쇠 고리와 등, 고리에서 늘어진 밧줄, 받침에 감긴 밧줄. 아랫줄만 막힘."""
    c = C(16, 64, seed=520); c.shadow(8, 62, 6, 1.6)
    c.group(1); c.box(2, 54, 12, 3, 6, 'stone', front=.6)
    c.group(2); c.cylinder(8, 8, 55, 2.6, 'wood', capry=1.4)
    c.group(3); c.new()
    for a in range(0, 360, 30):
        x = int(round(8 + math.cos(math.radians(a)) * 4)); y = int(round(7 + math.sin(math.radians(a)) * 2))
        c.tone(x, y, 'iron', 5 if a > 180 else 3)
    pz.lantern(c, 8, 0, 4, glow=6)
    c.group(5); c.new()
    for y in range(9, 40):                                     # 늘어진 밧줄
        x = 12 + int(2 * math.sin(y * .25)); c.tone(x, y, 'rope', 4 if y % 3 else 2)
    for y in range(48, 54):
        for x in range(4, 12): c.tone(x, y, 'rope', 5 if (x + y) % 3 == 0 else (4 if x < 8 else 2))
    return pz.fin(c)

def anchor_post():
    """닻 말뚝 1×1(16x16): 쇠테 두른 짧은 말뚝에 감아 놓은 밧줄 고리. 막힘."""
    c = C(16, 24, seed=530); c.shadow(8, 22, 6, 1.4)
    c.group(1); c.cylinder(8, 6, 20, 3.2, 'wood', capry=1.8)
    c.group(2); c.new()
    for x in range(4, 13): c.tone(x, 10, 'iron', 4 if x < 8 else 2); c.tone(x, 17, 'iron', 4 if x < 8 else 2)
    c.group(3); c.new()
    for a in range(0, 360, 12):
        x = int(round(8 + math.cos(math.radians(a)) * 6.5)); y = int(round(19 + math.sin(math.radians(a)) * 2.6))
        c.tone(x, y, 'rope', 5 if a > 200 else 3)
    return pz.fin(c)

def rope_coil():
    """감아 둔 밧줄 1×1(16x16): 두 겹 고리, 윗면 밝음, 풀린 끝. 땅 장식(막힘 없음)."""
    c = C(16, 16, seed=540)
    for ring, (rx, ry, yy) in enumerate(((6.5, 3.2, 10), (4.6, 2.3, 9))):
        c.group(ring + 1); c.new()
        for a in range(0, 360, 6):
            x = int(round(8 + math.cos(math.radians(a)) * rx)); y = int(round(yy + math.sin(math.radians(a)) * ry))
            c.tone(x, y, 'rope', 5 if a > 190 and a < 330 else (4 if a < 190 else 3))
            c.tone(x, y + 1, 'rope', 2)
    c.new()
    for k in range(5): c.tone(13 + k // 2, 12 + k // 2, 'rope', 4)
    return pz.fin(c)

def sky_cargo():
    """하늘 화물 2×2(32x32): 나무 상자 둘(위아래로 쌓음)과 자루, 밧줄 그물이 덮였다. 아랫줄 막힘."""
    c = C(32, 32, seed=550); c.shadow(16, 30, 14, 2)
    c.group(1); c.box(2, 14, 16, 4, 12, 'wood', front=.6)
    c.group(2); c.box(5, 4, 11, 3, 9, 'wood', front=.6, bias=.04)
    c.group(3)                                                 # 자루: 아래가 퍼진 삼베 자루, 위를 묶은 끈과 귀
    c.poly([(19, 29), (29, 29), (28, 20), (26, 16), (22, 16), (20, 20)], 'cream', lambda x, y: .78 - .05 * (x - 19) + .02 * (29 - y))
    c.new()
    for (x, y) in ((22, 15), (23, 14), (24, 14), (25, 15), (26, 14)): c.tone(x, y, 'cream', 5)
    for x in range(22, 27): c.tone(x, 17, 'rope', 3)
    for y in range(21, 28, 3): c.tone(23, y, 'cream', 3); c.tone(25, y + 1, 'cream', 3)
    c.group(4); c.new()
    for x in range(2, 18):
        for y in range(4, 30):
            if c.m[y][x] in ('wood',) and ((x + y) % 6 == 0 or (x - y) % 6 == 0): c.tone(x, y, 'rope', 4 if y < 18 else 3)
    for x in range(2, 18): c.tone(x, 14, 'iron', 3); c.tone(x, 4, 'iron', 4)
    return pz.fin(c)

def signal_lantern():
    """항로 신호등 1×3(16x48): 가는 쇠 기둥 위 푸른 유리 등(수정 빛), 지붕 갓. 아랫줄만 막힘."""
    c = C(16, 48, seed=560); c.shadow(8, 46, 4, 1.2)
    c.group(1); c.box(5, 42, 6, 2, 3, 'stone')
    c.group(2); c.new()
    for y in range(14, 43): c.tone(7, y, 'iron', 4); c.tone(8, y, 'iron', 2)
    c.group(3); c.new()
    for y in range(4, 13):
        for x in range(4, 12):
            if x in (4, 11) or y in (4, 12): c.tone(x, y, 'iron', 4 if x < 8 else 2)
            else: c.tone(x, y, 'cryst', 6 if (x < 8 and y < 9) else 4)
    c.group(4); c.new()
    for y in range(0, 4):
        for x in range(7 - y, 9 + y): c.tone(x, y, 'slate', 5 if x < 8 else 3)
    return pz.fin(c)

def wind_vane():
    """바람개비 풍향계 1×3(16x48): 나무 기둥 위 금 화살 풍향계와 방위 막대, 리본. 아랫줄만 막힘."""
    c = C(16, 48, seed=570); c.shadow(8, 46, 4, 1.2)
    c.group(1); c.box(5, 42, 6, 2, 3, 'stone')
    c.group(2); c.new()
    for y in range(10, 43): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    c.group(3); c.new()
    for x in range(1, 15): c.tone(x, 9, 'gold', 5)
    for (x, y) in ((1, 8), (1, 10), (2, 7), (2, 11), (14, 8), (13, 9), (14, 10)): c.tone(x, y, 'gold', 4)
    for x in range(4, 12): c.tone(x, 14, 'iron', 4)
    c.tone(4, 13, 'iron', 5); c.tone(11, 15, 'iron', 2)
    c.group(4); c.new()
    for y in range(16, 26): c.tone(9 + (y // 3) % 2, y, 'slate', 5 if y % 2 else 4)
    c.tone(8, 3, 'gold', 6); c.tone(8, 4, 'gold', 5); c.tone(8, 5, 'gold', 4)
    for y in range(6, 10): c.tone(8, y, 'iron', 3)
    return pz.fin(c)

# ================================================================ 비행선
def airship():
    """비행선 8×6(128x96): 길쭉한 기구(상아 돛천에 슬레이트 푸른 띠 세 줄·꿰맨 솔기·꼬리 지느러미 넷)에 밧줄로 매단 나무 배(곤돌라: 갑판 윗면·뱃전·
    둥근 창 셋)와 뒤 프로펠러. 위에서 비스듬히 본 3/4 — 기구 윗면 밝음. 하늘 칸 위에 놓는다(막힘)."""
    W, H = 128, 96; c = C(W, H, seed=580)
    # 꼬리 지느러미(뒤, 먼저)
    c.group(1)
    c.poly([(8, 30), (20, 26), (22, 36), (6, 40)], 'slate', .55)
    c.poly([(10, 12), (24, 22), (24, 28), (6, 22)], 'slate', .75)
    # 기구 몸통
    c.group(2); c.ellipsoid(66, 30, 54, 22, 'cream', bias=.02)
    c.new()
    for y in range(8, 53):                                      # 슬레이트 띠 셋(몸통을 감는 곡선)
        for x in range(12, 121):
            if c.m[y][x] != 'cream': continue
            dx = (x + .5 - 66) / 54
            for bx in (-.55, -.05, .45):
                w = .045 * math.sqrt(max(0, 1 - ((y + .5 - 30) / 22) ** 2)) + .012
                if abs(dx - bx) < w: c.tone(x, y, 'slate', max(1, min(6, c.t_of(x, y))))
    c.new()
    for x in range(14, 120):                                    # 가로 솔기(세로 위치 흔들리게)
        for yc in (18, 30, 42):
            y = int(yc + (abs(x - 66) / 54) ** 2 * (30 - yc) * .7)
            if c.m[y][x] == 'cream' and x % 2 == 0: c.darken(x, y, 1)
    # 앞 지느러미(가까운 쪽)
    c.group(3); c.poly([(12, 40), (26, 42), (24, 50), (8, 52)], 'slate', .5)
    # 매단 밧줄
    c.group(4); c.new()
    for (x0, x1) in ((42, 46), (60, 60), (78, 74), (94, 86)):
        for y in range(50, 66):
            x = int(x0 + (x1 - x0) * (y - 50) / 16); c.tone(x, y, 'rope', 4 if y % 2 else 3)
    # 곤돌라(배)
    c.group(5)
    c.poly([(36, 64), (98, 64), (94, 80), (84, 86), (48, 86), (40, 80)], 'wood', .5)
    c.new()
    for y in range(62, 70):
        for x in range(38, 97):
            if y < 64 + (0 if 40 < x < 95 else 1): continue
    c.box(40, 60, 54, 6, 0, 'wood', top=.95)                   # 갑판 윗면
    c.new()
    for x in range(40, 94):
        c.tone(x, 60, 'wood', 6); c.tone(x, 66, 'wood', 2)
        if x % 6 == 0:
            for y in range(61, 66): c.tone(x, y, 'wood', 3)
    for k, x in enumerate((52, 66, 80)):                       # 둥근 창
        c.new()
        for y in range(70, 75):
            for xx in range(x - 2, x + 3):
                if (xx - x) ** 2 + ((y - 72) * 1.2) ** 2 <= 6: c.tone(xx, y, 'cryst', 5 if xx < x else 3)
    c.new()
    for x in range(42, 92): c.tone(x, 78, 'gold', 4 if x % 4 else 5)
    # 프로펠러(뒤, 곤돌라 뒤끝)
    c.group(6); c.new()
    for y in range(64, 84): c.tone(32, y, 'wood', 4 if y < 74 else 2)
    for x in range(28, 37): c.tone(x, 73, 'iron', 4)
    c.ellipsoid(32, 73, 2, 2, 'iron')
    # 갑판 위 작은 키·상자
    c.group(7); c.box(84, 56, 6, 3, 4, 'wood', bias=.05)
    c.new()
    for a in range(0, 360, 45): c.tone(int(round(48 + math.cos(math.radians(a)) * 3)), int(round(58 + math.sin(math.radians(a)) * 2)), 'wood', 4)
    for y in range(58, 63): c.tone(48, y, 'wood', 3)
    return pz.fin(c)

# ================================================================ 흙덩이·작은 섬·밑면 뿌리
def islet(wc, hc, seed=0, deco=None, root_max=None):
    """작은 부유섬 wc×hc 윗면 + 밑면: 섬 테 오토타일(둥근 풀 윗면) + 단면 + 뾰족 뿌리. 반환 (그림, 윗면 높이 칸 수)."""
    mask = [[False] * (wc + 2) for _ in range(hc + 9)]
    for y in range(1, hc + 1):
        for x in range(1, wc + 1):
            mask[y][x] = True
    lay, bot, cov = I.underside_layer(mask, seed=600 + seed, root_max=root_max or (18 + wc * 9))
    top = new(lay.width, lay.height)
    sheet = I.autotile_islandrim()
    from sc_base import at_cell
    g = lambda a, b: 0 <= a < wc + 2 and 0 <= b < hc + 9 and mask[b][a]
    for y in range(hc + 9):
        for x in range(wc + 2):
            if mask[y][x]:
                m = g(x, y - 1) + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
                top.alpha_composite(at_cell(sheet, m), (x * 16, y * 16))
    lay.alpha_composite(top)
    bb = lay.getbbox(); im = lay.crop((16, 16, 16 + wc * 16, bb[3]))
    if deco: deco(im)
    return im

def clod(size, seed=0):
    """흩어지는 흙덩이: 풀 덮인 흙 덩어리가 섬에서 떨어져 떠 있다(작은 뿌리·풀 끝 늘어짐). size 's' 1×2, 'm' 2×3, 'l' 3×4."""
    w, h, rm = {'s': (14, 9, 18), 'm': (26, 14, 30), 'l': (40, 20, 40)}[size]
    W = (w + 15) // 16 * 16 + (2 if size == 's' else 0); r = random.Random(610 + seed + ord(size))
    Hpx = h + rm + 4; im = new(W, Hpx); p = im.load(); cx = W / 2
    for x in range(W):
        u = abs(x + .5 - cx) / (w / 2)
        if u > 1: continue
        top = int(h * .25 * (u ** 2)) + 1
        bot = int(h + rm * (1 - u ** 1.4) ** 1.2 * (.75 + .5 * _hash(x // 3, 0, seed + 611)))
        for y in range(top, bot):
            if y < h * .55:                          # 풀 윗면
                lx, ly = x % 16, y % 16
                rr, gg, bb, _ = I._LP[lx, ly]; c = (rr, gg, bb)
                if y == top: c = LF[6] if x < cx else LF[3]
            elif y < h * .55 + 3: c = (LF[5], LF[3], LF[1])[int(y - h * .55)]
            else:
                c = I.face_px(x + seed * 17, int(y - h * .55 - 3) + 4)
                c = mul(c, 1 - .35 * (y - h * .55) / max(1, rm))
            if y == bot - 1: c = ST[1]
            put(p, W, Hpx, x, y, c)
    for x in range(W):                                # 양옆 윤곽
        for y in range(Hpx):
            if p[x, y][3] and ((x == 0 or not p[x - 1, y][3]) or (x == W - 1 or not p[x + 1, y][3])) and y > h * .55: put(p, W, Hpx, x, y, ST[1])
    # 늘어진 풀 끝
    for x in range(2, W - 2, 3):
        if p[x, int(h * .55) + 3][3] and r.random() < .5:
            for k in range(r.randint(2, 4)): put(p, W, Hpx, x, int(h * .55) + 3 + k, LF[2] if k % 2 else LF[3])
    return im

def island_root(wc, seed=0):
    """섬 밑면 뿌리 wc칸 폭: 단면(3줄) 아래 이어 붙이는 바위 뿌리 — 가운데로 깊어지고 뾰족 끝 둘~셋, 아래로 어둡고 푸르다."""
    mask = [[False] * (wc + 2) for _ in range(14)]
    for x in range(1, wc + 1): mask[1][x] = True
    lay, bot, cov = I.underside_layer(mask, seed=640 + seed, root_max=30 + wc * 10)
    bb = lay.getbbox()
    return lay.crop((16, 32 + 48, 16 + wc * 16, bb[3]))

# ================================================================ 풍차
def windmill_sky():
    """하늘 풍차 4×6(64x96): 버들항 풍차 몸통(목조 원통)에 슬레이트 푸른 고깔 지붕과 날개 넷(돛천), 문 앞 돌 디딤. 아래 2줄 몸통 막힘."""
    body = roman.windmill_body(); sails = roman.windmill_sails(1)
    im = new(64, 96); im.alpha_composite(body); p = im.load()
    for y in range(24, 46):                                    # 고깔을 슬레이트로
        for x in range(64):
            r, g, b, a = p[x, y]
            if a and y < 44 and abs(x + .5 - 32) <= 6 + (y - 26) * .8 + .5:
                l = (.3 * r + .59 * g + .11 * b) / 255; t = min(6, max(1, int(l * 8 + .6)))
                p[x, y] = SL[t] + (a,)
    for y in range(18, 26):
        half = (y - 18) * .75
        for x in range(64):
            if abs(x + .5 - 32) <= half + .2: put(p, 64, 96, x, y, SL[5] if x < 32 else SL[3])
    put(p, 64, 96, 32, 16, GOLD[5]); put(p, 64, 96, 32, 17, GOLD[4]); put(p, 64, 96, 31, 17, GOLD[5])
    im.alpha_composite(sails)
    return pz.fin(im)

def sky_house():
    """항구지기 집 3×6(48x96): 버들항 흰 회벽 집(덧창 창 둘·나무 문)을 성 슬레이트 푸른 지붕으로 다시 덮었다(굴뚝 벽돌은 그대로).
    지붕 칸은 걷기·가림, 벽 2줄 막힘, 문 앞 한 칸은 길."""
    src = bd5.lib_sprite('lodge')
    im = to_slate(src, top=60, keep=lambda x, y: x < 16 and y < 30)
    o = new(48, 96); o.alpha_composite(im, (0, 96 - im.height)); return o

def guide_light(seed=0):
    """구름 길 길잡이 등 1×2(16x32): 구름 위에 떠 있는 작은 수정 등(금 갓·푸른 빛)과 아래로 늘어진 빛 꼬리, 밑 구름에 비친 둥근 빛. 하늘 칸 장식(막힘)."""
    W, H = 16, 32; im = new(W, H); p = im.load(); cx = 8; by = 8 + (seed % 2) * 2
    for y in range(26, 31):                                   # 비친 빛
        for x in range(W):
            d = ((x + .5 - cx) / 6) ** 2 + ((y + .5 - 28.5) / 2) ** 2
            if d <= 1 and (x + y) % 2 == 0: put(p, W, H, x, y, CRY[5], 170)
    for y in range(by, by + 10):                              # 수정 등
        half = 3.2 * (1 - abs(y - (by + 5)) / 5.6)
        for x in range(W):
            d = x + .5 - cx
            if abs(d) <= half: put(p, W, H, x, y, CRY[6] if d < -half * .3 else (CRY[5] if d < half * .3 else CRY[3]))
    for x in range(cx - 3, cx + 4): put(p, W, H, x, by - 1, GOLD[5] if x < cx else GOLD[3])
    put(p, W, H, cx, by - 2, GOLD[4]); put(p, W, H, cx, by - 3, GOLD[6])
    for y in range(by + 10, by + 16, 2): put(p, W, H, cx, y, CRY[4], 200)
    return pz.fin(im)

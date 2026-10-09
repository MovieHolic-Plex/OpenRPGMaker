# 시간의 틈 새 조각(손 도트): 포털 기둥 쌍 + 빛 소용돌이, 부러진 기둥(위에 멈춘 돌 조각), 떠 있는 기둥 토막·아치 조각·멈춘 시계 고리,
# 시간 받침(빛 구슬), 돌 벤치, 쉼터 가로등, 빛 수정, 돌무더기, 다리 기둥, 시간 조각 거울, 바닥 장식.
# 버들항 px2 볼륨 페인터(칩셋 돌 'stone'·쇠 'iron'·금 'gold'·대리석 'bone' 램프) + pz.fin 윤곽. 3/4 시점, 빛 왼쪽 위. 결정적.
import numpy as np
from tr_base import *
from tr_base import _hash
import tr_isle as I


# ================================================================ 빛 소용돌이(포털 속)
def swirl(W, H, cx, cy, rx, ry, G, seed=1, arms=3, halo=True):
    """세로로 긴 타원 속 빛 소용돌이: 가운데 가장 밝고, 팔 셋이 감겨 돌며, 테두리는 밝은 고리. 바깥 번짐은 디더 알파."""
    im = blank(W, H); a = np.zeros((H, W, 4), np.uint8)
    Y, X = np.mgrid[0:H, 0:W]
    u = (X + .5 - cx) / rx; v = (Y + .5 - cy) / ry; r = np.sqrt(u * u + v * v); ang = np.arctan2(v, u)
    b = bayer(H, W)
    sp = (arms * ang / (2 * np.pi) + 2.4 * r + tnoise(W, H, 6, seed, per=False) * .25) % 1.0
    t = 3.0 + np.where(sp < .38, 1.0, np.where(sp < .5, .4, -.6))      # 팔(밝음) / 사이(어두움)
    t = t + (1 - r) * 1.6                                                 # 가운데로 밝게
    t = np.where(r < .22, 6, t)
    t = np.where((r > .82) & (r <= 1), np.where(r > .93, 3.2, 5.0), t)   # 테두리 고리
    tq = np.clip(np.floor(t + b - .5), 1, 6).astype(int)
    Gp = np.array(G, np.uint8)
    inside = r <= 1
    a[inside, :3] = Gp[tq[inside]]; a[inside, 3] = 255
    # 별처럼 반짝이는 점
    sp2 = (hash2(X, Y, seed + 5) > .985) & inside & (r > .3)
    a[sp2, :3] = Gp[6]
    if halo:
        hr = (r > 1) & (r < 1.35)
        q = (1.35 - r) / .35
        on = hr & (q > b * 1.2)
        a[on, :3] = Gp[3]; a[on, 3] = (90 + 80 * q[on]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def _pillar(c, cx, ytop, ybot, w=7, cap=True, mat='stone', seed=0, broken=None):
    """버들항 기둥(roman.column 과 같은 짜임: 기둥머리 2줄 넓게 · 홈 두 줄 · 받침 2줄 넓게)을 볼륨 페인터로."""
    x0 = cx - w // 2
    tones = [6, 5, 5, 4, 3, 2, 2][:w] if w <= 7 else [6] + [5] * (w - 4) + [4, 3, 2]
    top = ytop + 3 if broken is None else broken
    c.new()
    for y in range(top, ybot - 2):
        for i in range(w):
            t = tones[i]
            if i in (2, w - 3) and y % 2 == 0: t = max(2, t - 1)
            c.tone(x0 + i, y, mat, t)
    if broken is None and cap:
        c.new()
        for y in range(ytop, ytop + 3):
            for i in range(-1, w + 1): c.tone(x0 + i, y, mat, 6 if y == ytop else (5 if i < w // 2 else 3))
    elif broken is not None:
        c.new()                                                   # 부러진 단면: 위에서 본 둥근 면 + 깨진 이
        for i in range(w):
            j = int(_hash(i, broken, seed) * 3)
            for y in range(broken - 2 + j, broken + 1):
                c.tone(x0 + i, y, mat, 6 if i < w // 2 else 5)
    c.new()
    for y in range(ybot - 2, ybot + 1):
        for i in range(-1, w + 1): c.tone(x0 + i, y, mat, (5 if y < ybot else 3) if i < w - 1 else 3)


def portal(color='blue', seed=1):
    """포털(4x4칸): 낮은 돌 받침 위 기둥 한 쌍 + 그 사이 세로 타원 빛 소용돌이. 기둥머리 위에는 같은 색 작은 빛 조각이 떠 있다.
    걷기: 아랫줄 가운데 두 칸(받침 윗면 = 들어가는 칸)만 걷기, 기둥 칸 막힘, 위 칸은 걷기+가림."""
    G = GLOW[color]; W, H = 64, 64
    c = C(W, H, seed=500 + seed)
    c.shadow(32, 61.5, 31, 2.5, 60)
    c.group(1); c.box(1, 52, 62, 4, 7, 'stone', top=.98, front=.56)     # 받침(윗면 4줄 + 앞면)
    c.group(2); c.box(3, 49, 9, 3, 3, 'stone', top=1.0, front=.6); c.box(52, 49, 9, 3, 3, 'stone', top=1.0, front=.6)  # 기둥 밑동
    c.group(3); _pillar(c, 7, 8, 48, w=7, seed=seed); _pillar(c, 56, 8, 48, w=7, seed=seed + 1)
    im = F(c)
    sw = swirl(W, H, 32, 31, 16, 21, G, seed=seed)
    o = blank(W, H)
    o.alpha_composite(sw)
    o.alpha_composite(im)
    # 받침 윗면에 비친 빛(앞쪽으로 번짐)
    px = o.load()
    for y in range(52, 56):
        for x in range(14, 50):
            d = abs(x - 32) / 18
            if px[x, y][3] and _hash(x, y, seed + 9) < (1 - d) * .8 - (y - 52) * .12:
                px[x, y] = mix(px[x, y][:3], G[4], .55) + (255,)
    # 기둥머리 위 빛 조각(떠 있음)
    for (fx, fy) in ((7, 3), (56, 3)):
        for (dx, dy, k) in ((0, 0, 6), (-1, 1, 4), (0, 1, 5), (1, 1, 3), (0, 2, 4), (0, -1, 4)):
            put(px, W, H, fx + dx, fy + dy, G[k])
    # 기둥 안쪽 면에 소용돌이 빛이 비친다
    for y in range(12, 48):
        for x in (10, 11, 52, 53):
            if px[x, y][3] and _hash(x, y, seed + 11) < .5: px[x, y] = mix(px[x, y][:3], G[4], .35) + (255,)
    return o


# ================================================================ 기둥·조각
def pillar_broken(tall=True, seed=3):
    """부러진 기둥(1x3 / 1x2): 받침 + 홈 기둥, 위가 깨졌고 그 위에 돌 조각 두셋이 시간에 멈춘 듯 떠 있다(아래 희미한 빛)."""
    H = 48 if tall else 32; W = 16
    c = C(W, H, seed=600 + seed)
    c.shadow(8, H - 2.5, 7, 1.6, 70)
    c.group(1); c.box(1, H - 7, 14, 2, 5, 'stone', top=1.0, front=.58)
    br = 20 if tall else 14
    c.group(2); _pillar(c, 8, br, H - 8, w=7, cap=False, broken=br, seed=seed)
    # 깨진 이 아래 금
    c.new()
    for y in range(br + 2, br + 9):
        if _hash(y, 0, seed) < .7: c.tone(9 + (y - br) // 3, y, 'stone', 2)
    # 떠 있는 조각
    c.group(3)
    for (fx, fy, w_, h_) in ((5, br - 9, 5, 3), (10, br - 14, 3, 2), (3, br - 16, 2, 2)) if tall else ((4, br - 8, 5, 3), (10, br - 11, 3, 2)):
        if fy < 1: continue
        c.box(fx, fy, w_, 1, h_ - 1, 'stone', top=1.0, front=.55)
    im = F(c)
    px = im.load()
    for x in range(4, 12):                                         # 단면 위 희미한 빛 번짐(조각을 붙잡는 힘)
        y = br - 3
        if 0 <= y < H and not px[x, y][3] and _hash(x, y, seed) < .5: px[x, y] = GLOW['blue'][3] + (150,)
    return im


def pillar_drift(seed=5, lean=0):
    """떠 있는 기둥 토막(2x2): 위아래가 깨진 기둥 한 토막이 허공에 떠 있다. 밑에 작은 바위 덩이가 붙어 있고, 둘레에 부스러기."""
    W, H = 32, 32
    c = C(W, H, seed=650 + seed)
    c.group(1)
    cx = 15 + lean
    _pillar(c, cx, 4, 22, w=7, cap=False, broken=8, seed=seed)
    # 아래 깨진 끝(들쭉날쭉)
    c.group(2)
    for i in range(7):
        for y in range(22, 24 + int(_hash(i, 2, seed) * 3)): c.tone(cx - 3 + i, y, 'stone', 3 if i < 4 else 2)
    c.group(3)
    for (fx, fy, s_) in ((5, 12, 2), (25, 8, 2), (24, 24, 3), (7, 25, 2), (21, 3, 1)):
        c.box(fx, fy, s_ + 1, 1, s_, 'stone', top=1.0, front=.55)
    im = F(c)
    return im


def arch_drift(seed=7):
    """떠 있는 아치 조각(3x3): 기둥 한 토막 위에 쐐기돌 아치가 반쯤 남았다. 아래는 바위 뿌리, 끊긴 끝에서 쐐기돌 둘이 떨어져 떠 있다."""
    W, H = 48, 48; im = blank(W, H); px = im.load()
    # 바위 받침: 섬 그리기로(같은 결)
    m = I.ellipse_mask(W, H, 14, 33, 12, 4.5)
    rock, _ = I.render_islands(W, H, [I.Island(m, 'rock', body=3, root=11, seed=seed)])
    im.alpha_composite(rock)
    c = C(W, H, seed=700 + seed)
    c.group(1); _pillar(c, 10, 6, 32, w=7, cap=True, seed=seed)
    pim = F(c); im.alpha_composite(pim); px = im.load()
    # 아치 고리: 왼쪽 기둥머리에서 오른쪽 위로 휘다 끊긴다
    cx, cy, r0, r1 = 26, 18, 10, 16
    for y in range(0, 20):
        for x in range(8, 44):
            d = math.hypot(x + .5 - cx, (y + .5 - cy) * 1.05)
            a = math.degrees(math.atan2(cy - y, x + .5 - cx))
            if r0 <= d <= r1 and y < cy and 70 < a < 178:
                v = int(a / 12)
                k = 5 if v % 2 else 4
                if d < r0 + 1: k = 3
                if d > r1 - 1.5: k = 6 if a > 100 else 5            # 아치 윗면(빛)
                if abs(a - v * 12) < .9: k = 2                      # 쐐기돌 사이
                put(px, W, H, x, y, ST[k])
    # 떨어져 나간 쐐기돌 둘(떠 있음)
    for (x0, y0, w_, h_) in ((36, 5, 4, 3), (41, 11, 3, 3)):
        for y in range(y0, y0 + h_):
            for x in range(x0, x0 + w_): put(px, W, H, x, y, ST[6] if y == y0 else (ST[5] if x < x0 + w_ - 1 else ST[3]))
    return pz.fin(im)


def clock_ring(seed=9):
    """멈춘 시계 고리(3x3): 허공에 비스듬히 선 큰 놋쇠 고리(눈금 열둘, 글자 없음) — 한 군데가 깨져 조각이 떨어져 떠 있고,
    안쪽에는 바늘 두 개가 멈춰 있다. 고리 안은 푸른 빛이 아주 옅게 감돈다."""
    W, H = 48, 48; c = C(W, H, seed=750 + seed)
    cx, cy, rx, ry = 24, 23, 19, 21
    c.group(1); c.new()
    for y in range(H):
        for x in range(W):
            d = math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry)
            a = math.degrees(math.atan2(y + .5 - cy, x + .5 - cx)) % 360
            if .80 <= d <= 1.0 and not (20 < a < 52):             # 깨진 자리(오른쪽 아래)
                t = 5 if d < .88 else (4 if d < .95 else 2)
                if a > 180 and a < 300: t += 1                    # 위쪽(빛 받음)
                if a > 30 and a < 150: t -= 1
                c.tone(x, y, 'gold', max(1, min(6, t)))
    c.new()
    for i in range(12):                                            # 눈금
        a = math.radians(i * 30 - 90)
        for rr in (.70, .75):
            x = int(cx + math.cos(a) * rx * rr); y = int(cy + math.sin(a) * ry * rr)
            c.tone(x, y, 'gold', 4 if i % 3 else 6)
    c.group(2); c.new()
    for k in range(10): c.tone(int(cx + k * .2), int(cy - k * 1.1), 'iron', 5 if k < 5 else 4)   # 긴 바늘
    for k in range(7): c.tone(int(cx + k * .9), int(cy + k * .5), 'iron', 4)                     # 짧은 바늘
    c.tone(cx, cy, 'gold', 6); c.tone(cx + 1, cy, 'gold', 4)
    c.group(3)
    c.box(42, 30, 4, 1, 3, 'gold', top=1.0, front=.55); c.box(39, 38, 3, 1, 2, 'gold', top=1.0, front=.55)   # 떨어진 조각
    im = F(c)
    g = glow_disc(W, H, cx, cy, rx * .75, ry * .75, GLOW['blue'][2], amax=70, steps=3)
    o = blank(W, H); o.alpha_composite(g); o.alpha_composite(im)
    return o


def chrono_pedestal(seed=11):
    """시간 받침(1x2): 둥근 돌 받침 위에 푸른 빛 구슬이 떠 있고 얇은 빛 고리가 비스듬히 감는다. 몸통 줄 막힘."""
    W, H = 16, 32; c = C(W, H, seed=800 + seed)
    c.shadow(8, 29.5, 7, 1.6, 70)
    c.group(1); c.cylinder(8, 20, 28, 5.5, 'stone', capry=2.2)
    c.group(2); c.box(2, 26, 12, 1, 3, 'stone', top=1.0, front=.58)
    im = F(c); px = im.load(); G = GLOW['blue']
    for y in range(4, 16):                                        # 구슬
        for x in range(3, 13):
            d = math.hypot(x + .5 - 8, y + .5 - 10) / 5
            if d <= 1:
                k = 6 if (x < 8 and y < 9 and d < .55) else (5 if d < .6 else (4 if d < .85 else 3))
                put(px, W, H, x, y, G[k])
    for t in range(40):                                           # 기운 고리
        a = t / 40 * 2 * math.pi
        x = int(8 + math.cos(a) * 7); y = int(10 + math.sin(a) * 2.2 - math.cos(a) * 1.2)
        if math.sin(a) > -.2 or not (3 <= x <= 12): put(px, W, H, x, y, G[5] if math.sin(a) > 0 else G[4])
    for y in range(16, 20):
        if y % 2 == 0: put(px, W, H, 8, y, G[3])
    return im


def bench_stone(seed=13):
    """쉼터 돌 벤치(2x1): 두 다리돌 위 판판한 돌 판(윗면 + 앞면), 끝은 둥글게. 몸통 줄 막힘."""
    W, H = 32, 16; c = C(W, H, seed=850 + seed)
    c.shadow(16, 14.2, 14, 1.6, 70)
    c.group(1); c.box(4, 9, 5, 1, 5, 'stone', top=.9, front=.5); c.box(23, 9, 5, 1, 5, 'stone', top=.9, front=.5)
    c.group(2); c.box(1, 3, 30, 4, 3, 'stone', top=1.0, front=.6)
    im = F(c); px = im.load()
    for (x, y) in ((1, 3), (30, 3), (1, 9), (30, 9)): px[x, y] = (0, 0, 0, 0)
    return pz.fin(im, .9)


def rift_lamp(seed=15):
    """쉼터 가로등(1x3): 돌 받침 위 쇠 기둥, 위에 굽은 팔과 유리 등(푸른 불). 아랫줄만 막힘."""
    W, H = 16, 48; c = C(W, H, seed=880 + seed)
    c.shadow(6, 45.5, 4.5, 1.3, 70)
    c.group(1); c.box(2, 40, 8, 2, 4, 'stone', top=1.0, front=.58)
    c.group(2); c.new()
    for y in range(9, 40): c.tone(5, y, 'iron', 4); c.tone(6, y, 'iron', 2)
    for y in (18, 28): c.tone(5, y, 'iron', 5); c.tone(6, y, 'iron', 3)
    for (x, y) in ((5, 8), (6, 7), (7, 6), (8, 6), (9, 6), (10, 7), (11, 8)): c.tone(x, y, 'iron', 4)
    c.group(3); c.new()
    c.tone(11, 9, 'iron', 3); c.tone(10, 10, 'iron', 4); c.tone(11, 10, 'iron', 4); c.tone(12, 10, 'iron', 2)
    im = F(c); px = im.load(); G = GLOW['blue']
    for y in range(11, 17):
        for x in range(9, 14):
            if x in (9, 13): put(px, W, H, x, y, PAL_I(4 if x == 9 else 2))
            else: put(px, W, H, x, y, G[6] if (x <= 11 and y < 14) else G[4])
    for x in range(9, 14): put(px, W, H, x, 17, PAL_I(3))
    o = blank(W, H); o.alpha_composite(glow_disc(W, H, 11, 14, 7, 7, G[4], amax=70, steps=3)); o.alpha_composite(im)
    return o


def PAL_I(k): return hx(PAL['iron'][k])


def light_crystal(seed=17):
    """빛 수정(1x2): 작은 바위 받침에서 솟은 푸른 수정 세 개, 위 하나는 떨어져 떠 있다. 아랫줄만 막힘."""
    W, H = 16, 32; c = C(W, H, seed=900 + seed)
    c.shadow(8, 29.5, 6.5, 1.4, 70)
    c.group(1); c.ellipsoid(8, 26, 6.5, 3.5, 'stone', amb=.25)
    im = F(c); px = im.load(); G = GLOW['blue']
    def shard(x0, ytop, ybot, w, lean):
        for y in range(ytop, ybot):
            f = (y - ytop) / max(1, ybot - ytop)
            hw = max(0.6, w * min(1, f * 2.2))
            xc = x0 + lean * (1 - f)
            for x in range(int(xc - hw), int(xc + hw) + 1):
                k = 5 if x < xc else 3
                if y == ytop or (x < xc - hw + 1.2 and f < .5): k = 6
                put(px, W, H, x, y, G[k])
    shard(7, 12, 26, 2.6, -1); shard(11, 17, 26, 1.8, 1.5); shard(4, 19, 26, 1.6, -1)
    shard(9, 3, 9, 1.6, 0)                                         # 떠 있는 조각
    o = blank(W, H); o.alpha_composite(glow_disc(W, H, 8, 17, 8, 10, G[3], amax=60, steps=3)); o.alpha_composite(pz.fin(im, .8))
    return o


def rubble(seed=19):
    """돌무더기(2x1): 부러진 기둥 곁에 떨어진 마름돌·조각. 몸통 줄 막힘."""
    W, H = 32, 16; c = C(W, H, seed=950 + seed); c.shadow(16, 13.5, 15, 2)
    c.group(1); c.box(2, 5, 11, 3, 6, 'stone', top=.98, front=.58)
    c.group(2); c.box(12, 8, 12, 3, 4, 'stone', top=.95, front=.55, bias=.03)
    c.group(3); c.ellipsoid(26, 11, 3.5, 2.6, 'stone', amb=.25); c.ellipsoid(8, 12.5, 2.6, 1.8, 'stone', amb=.25)
    return F(c)


def drum_fallen(seed=21):
    """쓰러진 기둥 토막(2x1): 옆으로 누운 홈 기둥, 왼쪽 끝 단면이 보인다. 몸통 줄 막힘."""
    W, H = 32, 16; c = C(W, H, seed=970 + seed); c.shadow(16, 13.5, 14, 2)
    c.hcyl(4, 28, 8, 5.2, 'stone', amb=.25, bias=.05, endcap='L', capmat='stone')
    im = F(c); px = im.load()
    for x in range(6, 28):
        for y in (6, 10):
            if px[x, y][3] and x % 2 == 0: px[x, y] = mul(px[x, y], .82)[:3] + (255,)
    return im


def bridge_post(color='blue', seed=23):
    """별빛 다리 기둥(1x2): 다리 끝에 서는 짧은 돌 기둥, 꼭대기에서 빛 구슬이 떠 있다. 아랫줄만 막힘."""
    W, H = 16, 32; c = C(W, H, seed=990 + seed)
    c.shadow(8, 29.5, 5, 1.4, 70)
    c.group(1); c.box(3, 24, 10, 2, 5, 'stone', top=1.0, front=.58)
    c.group(2); _pillar(c, 8, 12, 23, w=5, seed=seed)
    im = F(c); px = im.load(); G = GLOW[color]
    for (dx, dy, k) in ((0, 0, 6), (-1, 0, 5), (1, 0, 4), (0, -1, 5), (0, 1, 4), (-1, 1, 3), (1, -1, 4), (0, 2, 3)):
        put(px, W, H, 8 + dx, 6 + dy, G[k])
    o = blank(W, H); o.alpha_composite(glow_disc(W, H, 8, 7, 6, 5, G[3], amax=70, steps=3)); o.alpha_composite(im)
    return o


def time_shard(seed=25):
    """시간 조각 거울(1x2): 허공에 떠 있는 납작한 유리 조각. 다른 시간의 빛이 비쳐 가장자리가 금빛·속은 푸르다."""
    W, H = 16, 32; im = blank(W, H); px = im.load(); G = GLOW['blue']; Gd = GLOW['gold']
    pts = [(4, 4), (12, 7), (11, 24), (5, 27), (3, 15)]
    from PIL import ImageDraw
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); mp = m.load()
    for y in range(H):
        for x in range(W):
            if not mp[x, y]: continue
            edge = not all(mp[x + dx, y + dy] if 0 <= x + dx < W and 0 <= y + dy < H else 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge: c = Gd[5] if (x < 8 or y < 10) else Gd[3]
            else:
                s = (x * .6 + y * .25) % 4
                c = G[5] if s < .7 else (G[3] if s < 2.5 else G[2])
                if x + y < 14: c = G[4] if s >= .7 else G[6]
            put(px, W, H, x, y, c)
    o = blank(W, H); o.alpha_composite(glow_disc(W, H, 8, 15, 8, 13, G[3], amax=55, steps=3)); o.alpha_composite(pz.fin(im, .85))
    return o


def far_isles(seed=27):
    """먼 섬 그림자(2x1): 허공 저 멀리 떠 있는 작은 섬 둘(어둡고 흐리다). 허공 장식."""
    W, H = 32, 16
    m = I.ellipse_mask(W, H, 10, 6, 7, 2.2) | I.ellipse_mask(W, H, 24, 9, 4.5, 1.6)
    isl, _ = I.render_islands(W, H, [I.Island(m, 'rock', body=1, root=6, seed=seed)])
    a = np.array(isl).astype(float)
    al = a[..., 3] > 0
    v = np.array(VOID[6]); a[al, :3] = a[al, :3] * .42 + v * .58
    a[al, 3] = 255
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


# ================================================================ 바닥 장식(걷기, 사람 아래)
def crack_glow(seed=29, w=2):
    """빛 새는 금(2x1 / 1x1): 판석 금 사이로 푸른 빛이 새어 나온다. 걷는 장식."""
    W, H = 16 * w, 16; im = blank(W, H); px = im.load(); G = GLOW['blue']
    x, y = 2, 8 + int(_hash(1, 1, seed) * 3)
    for i in range(W - 4):
        x = 2 + i
        y += (1 if _hash(i, 3, seed) > .7 else (-1 if _hash(i, 4, seed) > .72 else 0))
        y = max(3, min(12, y))
        put(px, W, H, x, y, G[5] if i % 5 else G[6])
        put(px, W, H, x, y + 1, ST[1])
        if _hash(i, 5, seed) > .75: put(px, W, H, x, y - 1, G[3])
        if _hash(i, 6, seed) > .88:                                # 갈래 금
            for k in range(1, 4): put(px, W, H, x + k // 2, y + k, G[4] if k < 3 else ST[2])
    return im


def star_motes(seed=31):
    """별빛 티끌(1x1): 바닥 위에 떠도는 작은 빛 점 몇 개. 걷는 장식(사람 아래)."""
    W, H = 16, 16; im = blank(W, H); px = im.load(); G = GSTAR
    for i in range(5):
        x = 2 + int(_hash(i, 1, seed) * 12); y = 2 + int(_hash(i, 2, seed) * 12)
        put(px, W, H, x, y, G[6] if i % 2 == 0 else G[5])
        if i == 0:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): put(px, W, H, x + dx, y + dy, G[4], 200)
    return im

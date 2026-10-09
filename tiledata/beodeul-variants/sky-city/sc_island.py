# 하늘 도시: 부유섬. 윗면 = 버들항 풀(칩셋 잔디 칸 + ground.render 풀밭), 가장자리 = 들쭉날쭉한 흙 테(오토타일),
# 남쪽 단면 = 버들항 절벽 바위(terrain.ROCK 칸 결 + 세로 갈비 + 왼쪽 밝음) 3줄, 그 아래로 밑면이 좁아지며
# 바위 뿌리(종유석처럼 뾰족한 끝)가 구름 속으로 내려간다. 단면 위 흙 띠에서 잔뿌리가 늘어진다.
import math, random
import numpy as np
from PIL import Image
from sc_base import T, ST, LF, DIRT, CL, SK, mul, mix, new, autotile_sheet, _hash, vnoise, terrain
LAWN = terrain.CH.crop((0, 128, 16, 144)).convert('RGBA')
_LP = LAWN.load()
ROCKT = [t for t in terrain.ROCK]          # 버들항 칩셋 바위 칸 3장(16x16 load 객체)

# ---------------------------------------------------------------- 섬 테(윗면 가장자리) 오토타일
def _jag(u, k, amp=2.2):
    return 1 + amp * (0.5 + 0.5 * math.sin((u + k * 3.7) * 0.9) * math.cos((u * 0.37 + k)))

def rim_cell(m, N, E, S, W, lawn=None):
    """섬 윗면 칸: 속은 버들항 잔디, 이웃이 없는 쪽은 들쭉날쭉 깎이고 테(바깥 짙은 흙 윤곽 + 안쪽 밝은 풀 끝) —
    남쪽은 버들항 단 끝처럼 풀 처마 3줄(밝음·중간·그늘)로 끝나 아래 단면에 이어진다. 모서리는 둥글게."""
    lp = (lawn or LAWN).load()
    im = new(T, T); p = im.load()
    for y in range(T):
        for x in range(T):
            dN = y - _jag(x, 1) if not N else 99
            dW = x - _jag(y, 2) if not W else 99
            dE = (15 - x) - _jag(y, 3) if not E else 99
            dS = (15 - y) if not S else 99
            # 둥근 모서리(두 쪽이 다 비면 반지름 6)
            rc = 99
            for (cn, cx, cy) in ((not N and not W, 0, 0), (not N and not E, 15, 0), (not S and not W, 0, 15), (not S and not E, 15, 15)):
                if cn:
                    ddx = max(0, 6 - abs(x - cx)); ddy = max(0, 6 - abs(y - cy))
                    if ddx and ddy: rc = min(rc, 6 - math.hypot(ddx, ddy))
            d = min(dN, dW, dE, rc)
            if d < 0: continue
            r, g, b, _ = lp[x, y]; c = (r, g, b)
            if d < 1: c = DIRT[1] if (dE < 1 or (rc < 1 and x > 8)) else (DIRT[2] if dN < 1 else DIRT[1])
            elif d < 2: c = LF[6] if (dW < 2 or dN < 2) and dE >= 2 else LF[2]
            if not S and dS < 3 and d >= 1:
                c = (LF[5], LF[3], LF[1])[2 - int(dS)] if dS < 3 else c
                if dS < 1 and (x * 5) % 7 == 0: c = LF[2]
            p[x, y] = c + (255,)
    return im

def autotile_islandrim(): return autotile_sheet(rim_cell)

# ---------------------------------------------------------------- 단면 바위
def face_px(X, fy, seed=5, per=None, ends=(False, False), lx=8):
    """남쪽 단면 화소. fy = 단면 위에서부터 px(0..). 버들항 절벽(terrain.render 자연 바위)과 같은 식:
    칩셋 바위 칸 결을 칸마다 5px 어긋나게, 7px 세로 갈비(왼쪽 밝음·오른쪽 그늘·사이 금), 풀 처마 밑 4px 그늘.
    더해서 처마 밑 흙에서 늘어진 잔뿌리(짙은 흙빛 세로 줄)."""
    Xp = X % per if per else X
    cx = Xp // 16
    t = ROCKT[1 + int(_hash(cx % (per // 16) if per else cx, fy // 16, 5) * 2)]
    r, g, b, _ = t[Xp % 16, (fy % 16 + cx * 5) % 16]; c = (r, g, b)
    xx = Xp + int(3 * vnoise(0, fy * .08, 9, 78)); rib = int(xx / 7 + _hash(xx // 7, 0, 3) * .6); u = (xx % 7) / 7
    shade = .78 + .36 * (.5 - u) + .18 * (_hash(rib, fy // 32, 4) - .5)
    if u > .86: shade = .5
    c = mul(c, min(1.15, shade + .1 * min(1, fy / 47)))
    if fy < 4: c = mul(c, .55)
    # 잔뿌리: 처마 밑에서 3~11px 늘어진 가는 뿌리(2px 마다 한 단 밝기 바꿈)
    rl = int(11 * _hash(Xp, 1, seed + 4))
    if _hash(Xp, 0, seed + 3) < .16 and fy < 3 + rl and _hash(Xp - 1, 0, seed + 3) >= .16:
        c = DIRT[2] if (fy // 2) % 2 else DIRT[1]
    return c

def face_sample():
    """단면 표본 3×3(48x48): 맨 윗줄에 섬 윗면 남쪽 처마(풀) 3px, 흙 띠, 바위 결 — 가로로 이음새 없음."""
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48):
            if y < 3: c = (LF[5], LF[3], LF[1])[y]
            else: c = face_px(x, y - 3, per=48)
            p[x, y] = c + (255,)
    return im

# ---------------------------------------------------------------- 밑면(바위 뿌리) 그리기
def underside_layer(mask, seed=7, root_max=88, cut=None):
    """mask[y][x] = 섬 윗면 칸. 반환 (RGBA 층, 바닥 끝 y 배열, 덮인 칸 집합).
    남쪽 끝 칸 아래로 단면 48px(흙 띠 + 바위), 그 아래는 섬 덩이 가운데일수록 깊게 내려가고 양끝으로 얕아지며,
    끝은 뾰족한 바위 뿌리(종유석)로 갈라진다. 깊어질수록 어둡고 푸르게(먼 공기)."""
    H = len(mask); W = len(mask[0]); Wp, Hp = W * T, H * T
    lay = new(Wp, Hp); p = lay.load()
    on = lambda x, y: 0 <= x < W and 0 <= y < H and mask[y][x]
    # 섬 덩이(연결 요소) 별로 가로 범위
    lab = [[0] * W for _ in range(H)]; comps = []
    for y in range(H):
        for x in range(W):
            if mask[y][x] and not lab[y][x]:
                k = len(comps) + 1; st = [(x, y)]; lab[y][x] = k; cells = []
                while st:
                    a, b = st.pop(); cells.append((a, b))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        if on(a + dx, b + dy) and not lab[b + dy][a + dx]: lab[b + dy][a + dx] = k; st.append((a + dx, b + dy))
                comps.append(cells)
    covered = set()
    bottoms = np.full(Wp, -1)
    rnd = random.Random(seed)
    for k, cells in enumerate(comps, 1):
        xs = [c[0] for c in cells]; x0, x1 = min(xs) * T, (max(xs) + 1) * T
        cx = (x0 + x1) / 2; hw = (x1 - x0) / 2
        depth_max = min(root_max, 26 + hw * .9)
        # 뿌리 끝: 3~6 갈래 뾰족 끝
        ntip = max(2, int(hw / 22)); tips = sorted(rnd.uniform(x0 + hw * .35, x1 - hw * .35) for _ in range(ntip))
        for X in range(x0, x1):
            cxl = X // T
            ys = [y for (a, y) in cells if a == cxl and not on(a, y + 1)]
            if not ys: continue
            for yb in ys:
                top = (yb + 1) * T                       # 단면 시작 px
                u = abs(X + .5 - cx) / hw                # 0 가운데 .. 1 끝
                prof = max(0., 1 - u ** 1.5)
                D = 12 + (depth_max + 6) * prof ** .9
                D += 6 * (vnoise(X, k * 50, 7, seed + 11) - .5)
                for tx in tips:                          # 뾰족 뿌리
                    w = 5 + 4 * _hash(int(tx), k, 3)
                    if abs(X + .5 - tx) < w: D += (1 - abs(X + .5 - tx) / w) ** 1.3 * (22 + 14 * _hash(int(tx), 2, k))
                D = int(D)
                # 아래 섬 칸을 만나면 거기서 끊는다
                lim = D
                for fy in range(D):
                    cyy = (top + fy) // T
                    if on(cxl, cyy) or (cut and cut(X, top + fy)): lim = fy; break
                endsW = not any(a == cxl - 1 and not on(a, y + 1) and y == yb for (a, y) in cells)
                endsE = not any(a == cxl + 1 and not on(a, y + 1) and y == yb for (a, y) in cells)
                for fy in range(lim):
                    Y = top + fy
                    if Y >= Hp: break
                    c = face_px(X, fy, seed)
                    if fy >= 48:                             # 밑면: 깊을수록 어둡고 푸르게
                        tt = min(1, (fy - 48) / max(1, D - 48))
                        c = mix(mul(c, 1 - .38 * tt), SK[1], .22 * tt)
                    edge_l = (X == x0 or (X - 1 >= 0 and False))
                    if fy >= D - 2: c = mix(ST[1], SK[0], .3) if fy == D - 1 else mul(c, .6)
                    lx = X % T
                    if endsW and lx < 2 and fy < 48: c = mul(c, .55 if lx == 0 else .75)
                    if endsE and lx > 13 and fy < 48: c = mul(c, .45 if lx == 15 else .7)
                    p[X, Y] = c + (255,)
                    covered.add((X // T, Y // T))
                bottoms[X] = max(bottoms[X], top + lim)
        # 밑면 양옆 윤곽(바깥 화소)
    a = np.array(lay)
    al = a[:, :, 3] > 0
    edge = np.zeros_like(al)
    edge[:, 1:] |= al[:, 1:] & ~al[:, :-1]
    edge[:, :-1] |= al[:, :-1] & ~al[:, 1:]
    o = mix(ST[1], SK[0], .25)
    a[edge] = list(o) + [255]
    return Image.fromarray(a, 'RGBA'), bottoms, covered

def island_shadow(mask, img_size, off=(26, 60)):
    """섬이 저 아래 구름 바다에 드리운 그림자(곱하기 마스크)."""
    H = len(mask); W = len(mask[0])
    m = Image.new('L', img_size, 0); mp = m.load()
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                for yy in range(T):
                    for xx in range(T):
                        X = x * T + xx + off[0]; Y = y * T + yy + off[1]
                        if 0 <= X < img_size[0] and 0 <= Y < img_size[1]: mp[X, Y] = 255
    return m

# ---------------------------------------------------------------- 흰 대리석 바닥(신전 광장)
from sc_base import TRV, SL, GOLD
def tex_marble(X, Y):
    """흰 대리석 판석 24px 정사각(줄 맞춤), 판마다 톤 둘, 판 안 회색 결(물결치는 가는 맥) 한두 줄, 줄눈 한 단 어둡게,
    판 네 귀가 만나는 곳마다 슬레이트 푸른 마름모 상감(한 칸 건너). 48px 주기라 3×3 표본이 이어진다."""
    lx, ly = X % 24, Y % 24; col, row = X // 24, Y // 24
    if lx == 23 or ly == 23:
        c = TRV[3]
    else:
        h = _hash(col % 2, row % 2, 81)
        c = TRV[5] if h < .6 else mix(TRV[5], TRV[6], .5)
        if lx == 0 or ly == 0: c = TRV[6]
        elif lx == 22 or ly == 22: c = mix(c, TRV[4], .6)
        v = vnoise(X, Y * .5, 12, 83, per=4) * .7 + vnoise(X, Y, 6, 84, per=8) * .3
        if abs(v - .5) < .022: c = mix(c, ST[4], .55)
        elif abs(v - .5) < .04 and (X + Y) % 2: c = mix(c, TRV[4], .5)
    dx = (X + 1) % 48 - 24; dy = (Y + 1) % 48 - 24          # 상감: 48px 마다 판 귀
    d = abs(dx) + abs(dy)
    if d <= 3: c = SL[4] if d <= 1 else (SL[3] if dx + dy > 0 else SL[5])
    elif d == 4: c = TRV[3]
    return c

def ground_marble():
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48): p[x, y] = tex_marble(x, y) + (255,)
    return im

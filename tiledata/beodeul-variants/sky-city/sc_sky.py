# 하늘 도시: 구름 바다(통행 불가)·구름 길(통행 가능)·구름 번짐·하늘 틈. 손 도트 규칙:
#   구름 = 둥근 덩이(퍼프)를 뒤에서 앞으로 겹쳐 찍는다(꽃양배추 윤곽). 덩이마다 왼쪽 위가 흰빛, 오른쪽 아래가 라벤더 그늘,
#   앞 덩이와 겹치는 뒤 덩이 가장자리에 한 단 어두운 금(덩이 경계), 바깥 그늘 쪽 가장자리는 짙은 색 윤곽.
#   톤 경계는 체크 디더 한 줄. 구름 틈은 저 아래 하늘(SK) — 큰 결 두 단 + 옅은 먼 구름 줄.
import math, random
import numpy as np
from PIL import Image
from sc_base import CL, CP, SK, T, new, autotile_sheet, _hash, vnoise
LX, LY, LZ = -0.55, -0.65, 0.75
_n = math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= _n; LY /= _n; LZ /= _n

def _puffs(Wp, Hp, cover, seed, step=14, rmin=6, rmax=24, period=None):
    """cover(X,Y)->0..1 덮임. 지터 격자에 덮임이 높은 곳마다 덩이 하나. 반환 [(cx,cy,rx,ry)]."""
    r = random.Random(seed); out = []
    for gy in range(-step, Hp + step, step):
        for gx in range(-step, Wp + step, step):
            x = gx + r.uniform(-step * .45, step * .45); y = gy + r.uniform(-step * .45, step * .45)
            c = cover(x % Wp if period else x, y % Hp if period else y)
            if c <= 0.02: continue
            rad = rmin + (rmax - rmin) * min(1, c) ** 1.6 * r.uniform(.75, 1.05)
            if c < .45 and r.random() < .8: continue
            out.append((x, y, rad, rad * r.uniform(.72, .86)))
    out.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    return out

def paint_puffs(Wp, Hp, puffs, ramp=CL, period=False, seed=1):
    """덩이를 뒤→앞으로 찍는다. 반환 (tone 배열 int8 -1=빈칸, id 배열)."""
    tone = np.full((Hp, Wp), -1, np.int16); pid = np.zeros((Hp, Wp), np.int32)
    for k, (cx, cy, rx, ry) in enumerate(puffs, 1):
        offs = [(0, 0)]
        if period:
            offs = [(dx, dy) for dx in (-Wp, 0, Wp) for dy in (-Hp, 0, Hp)]
        for ox, oy in offs:
            x0 = int(math.floor(cx + ox - rx)) - 1; x1 = int(math.ceil(cx + ox + rx)) + 1
            y0 = int(math.floor(cy + oy - ry)) - 1; y1 = int(math.ceil(cy + oy + ry)) + 1
            if x1 < 0 or y1 < 0 or x0 >= Wp or y0 >= Hp: continue
            xs = np.arange(max(0, x0), min(Wp, x1)); ys = np.arange(max(0, y0), min(Hp, y1))
            if not len(xs) or not len(ys): continue
            X, Y = np.meshgrid(xs, ys)
            dx = (X + .5 - cx - ox) / rx; dy = (Y + .5 - cy - oy) / ry
            rr = dx * dx + dy * dy
            # 덩이 가장자리를 조금 울퉁불퉁하게(작은 혹)
            ang = np.arctan2(dy, dx)
            bump = 1 + .07 * np.sin(ang * 5 + k) + .05 * np.sin(ang * 9 + k * 2.3)
            inside = rr <= bump * bump
            if not inside.any(): continue
            nz = np.sqrt(np.clip(1 - rr / (bump * bump), 0, 1))
            v = (dx * LX + dy * LY) * .55 + nz * LZ
            v = .42 + .62 * v - .10 * np.clip(dy, 0, 1)
            th = ((X + Y) % 2) * .045                                   # 체크 디더
            t = np.where(v + th > .86, 6, np.where(v + th > .70, 5, np.where(v + th > .52, 4, np.where(v + th > .36, 3, 2))))
            sub = tone[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]; sid = pid[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
            sub[inside] = t[inside]; sid[inside] = k
    # 덩이 경계: 앞(더 큰 id) 덩이에 닿은 뒤 덩이 화소를 한 단 어둡게
    T_ = tone.copy()
    for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        nb = np.roll(np.roll(pid, -dy, 0), -dx, 1)
        if not period:
            if dy == 1: nb[-1, :] = 0
            if dy == -1: nb[0, :] = 0
            if dx == 1: nb[:, -1] = 0
            if dx == -1: nb[:, 0] = 0
        m = (pid > 0) & (nb > pid) & (tone > 1)
        if dy >= 0: T_[m] = np.maximum(1, np.minimum(T_[m], tone[m] - 1))
    # 바깥 가장자리: 그늘 쪽(아래·오른쪽이 빈칸)은 윤곽, 위쪽 빈칸은 한 단 밝게 두지 않고 그대로
    emp = tone < 0
    def sh(a, dx, dy, fill):
        b = np.roll(np.roll(a, -dy, 0), -dx, 1)
        if not period:
            if dy == 1: b[-1, :] = fill
            if dy == -1: b[0, :] = fill
            if dx == 1: b[:, -1] = fill
            if dx == -1: b[:, 0] = fill
        return b
    below = sh(emp, 0, 1, True); right = sh(emp, 1, 0, True); left = sh(emp, -1, 0, True); above = sh(emp, 0, -1, True)
    T_[(~emp) & below] = 1
    T_[(~emp) & ~below & right & (T_ > 2)] = 2
    T_[(~emp) & ~below & left & (T_ > 4)] = 4
    return T_, pid

def sky_px_arr(Wp, Hp, seed=5, period=None):
    """구름 틈의 저 아래 하늘: 한 톤(SK3) 바탕에 아주 큰 결로 한 단 짙은 곳(SK2, 체크 디더 경계 2px) +
    손으로 놓은 듯한 가는 먼 구름 줄(길이 24~70px, 두께 2~4px, 윗줄 밝음)."""
    pal = np.array(SK, np.uint8)
    ys, xs = np.mgrid[0:Hp, 0:Wp]
    if period:
        n = np.vectorize(lambda x, y: vnoise(x, y, 24, seed, per=max(1, period // 24)))(xs, ys)
    else:
        n = np.vectorize(lambda x, y: vnoise(x * .7 + y * .3, y, 80, seed))(xs, ys)
    chk = ((xs + ys) % 2) == 0
    t = np.full((Hp, Wp), 3, np.int16)
    t[n < .40] = 2
    band = (n >= .40) & (n < .44)
    t[band & chk] = 2
    out = pal[t]
    r = random.Random(seed + 9)
    nstreak = max(2, int(Wp * Hp / 9000))
    for i in range(nstreak):
        L = r.randint(24, 70); th = r.choice((2, 3, 3, 4)); x0 = r.randint(-20, Wp); y0 = r.randint(0, Hp - 4)
        for k in range(L):
            u = k / max(1, L - 1); hh = th * math.sin(math.pi * u) ** .6
            for j in range(int(round(hh))):
                X = (x0 + k) % Wp if period else x0 + k; Y = y0 - j
                if not (0 <= X < Wp and 0 <= Y < Hp): continue
                c = 5 if j == int(round(hh)) - 1 else 4
                if (u < .12 or u > .88) and (X + Y) % 2: continue
                out[Y, X] = pal[c]
    return out

def cloud_sea(Wp, Hp, cover, seed=11, period=None, ramp=CL, step=14, rmin=6, rmax=24, sky=None):
    """구름 바다 그림(RGBA, 불투명). cover(X,Y)->0..1."""
    puffs = _puffs(Wp, Hp, cover, seed, step=step, rmin=rmin, rmax=rmax, period=period)
    tone, pid = paint_puffs(Wp, Hp, puffs, ramp, period=bool(period), seed=seed)
    base = sky if sky is not None else sky_px_arr(Wp, Hp, seed + 3, period=period)
    pal = np.array(ramp, np.uint8)
    rgb = base.copy()
    m = tone >= 0
    rgb[m] = pal[np.clip(tone[m], 0, 6)]
    a = np.full((Hp, Wp, 1), 255, np.uint8)
    return Image.fromarray(np.concatenate([rgb, a], 2), 'RGBA'), tone

def sea_cover(seed=21):
    """맵용 덮임: 비스듬한 구름 띠(먼 바람 방향) + 큰 덩이."""
    def f(X, Y):
        n = vnoise(X * .8 + Y * .35, Y * 1.3, 90, seed) * .65 + vnoise(X, Y, 34, seed + 1) * .35
        return max(0, min(1, (n - .40) * 2.6))
    return f

# ---------------------------------------------------------------- 바닥 표본
def ground_cloudsea():
    im, _ = cloud_sea(48, 48, lambda X, Y: max(0, min(1, (vnoise(X, Y, 16, 31, per=3) - .30) * 2.4)), seed=33, period=48, step=8, rmin=4, rmax=10)
    return im

# ---------------------------------------------------------------- 덩이 오토타일(구름 길·구름 번짐 공용)
# 칸 경계에서 이음새가 맞도록 덩이 중심은 칸에 묶인 고정 격자(16px 주기, 칸마다 5개)이고, 반지름만 이웃 모양에 따라 바뀐다.
LATT = ((3.5, 3.5, 1.00), (11.5, 4.5, .92), (7.5, 9.5, 1.06), (1.5, 12.5, .95), (13.5, 12.5, .97))
def _mask3(m):
    N, E, S_, W_ = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    g = [[False] * 3 for _ in range(3)]
    g[1][1] = True; g[0][1] = N; g[1][2] = E; g[2][1] = S_; g[1][0] = W_
    g[0][0] = N and W_; g[0][2] = N and E; g[2][0] = S_ and W_; g[2][2] = S_ and E
    return g

def puff_cell(m, ramp, inset=3.0, rad=5.6, scatter=0.0, seed=1, flat=0.0, fill=None):
    """덩이 오토타일 칸 하나. 48x48(3×3 칸)에 덩이를 찍고 가운데 16x16 을 잘라 낸다.
    inset: 이웃 없는 쪽에서 몸통이 들어오는 깊이(px), rad: 덩이 반지름, scatter: 가장자리 덩이를 흩뜨리는 정도(구름 번짐),
    flat: 윗면을 납작하게(구름 길 — 밟는 면)."""
    g = _mask3(m)
    def dist_out(X, Y):
        """(X,Y) 화소에서 마스크 밖까지 가장 가까운 거리(px, 칸 경계 기준)."""
        cx, cy = int(X // 16), int(Y // 16)
        if not (0 <= cx < 3 and 0 <= cy < 3) or not g[cy][cx]: return -1.0
        d = 99.0
        for j in range(3):
            for i in range(3):
                if g[j][i]: continue
                dx = max(i * 16 - X, 0, X - (i * 16 + 16)); dy = max(j * 16 - Y, 0, Y - (j * 16 + 16))
                d = min(d, math.hypot(dx, dy))
        for (bx, by) in ((X, -1e9), (X, 1e9), (-1e9, Y), (1e9, Y)): pass
        return d
    puffs = []
    for j in range(3):
        for i in range(3):
            for k, (lx, ly, kr) in enumerate(LATT):
                X, Y = i * 16 + lx, j * 16 + ly
                d = dist_out(X, Y)
                if d < 0: continue
                h = _hash(int(X) + 101 * (k + 1), int(Y), seed)          # 칸에 묶인 값(이웃 칸과 같다)
                r = rad * kr * (.9 + .2 * h)
                if d < inset + r * .35:
                    if scatter:
                        if h < scatter * (1 - d / (inset + r)): continue
                        r = min(r * (.55 + .45 * min(1, d / (inset + 1))), d - .3)
                    else:
                        r = min(r, d - inset + r * .55, d - .3)
                    if r < 1.6: continue
                puffs.append((X, Y, r, r * (.78 if not flat else .62)))
    puffs.sort(key=lambda p: (p[1] + p[3] * .6, p[0]))
    tone, pid = paint_puffs(48, 48, puffs, ramp)
    im = new(T, T); p = im.load()
    for y in range(T):
        for x in range(T):
            t = int(tone[16 + y, 16 + x])
            if t < 0:
                d = dist_out(16 + x, 16 + y)
                if fill is None or d < inset + 2.5: continue
                t = fill if (x + y) % 2 or d > inset + 4 else fill - 1
            if flat and t >= 3 and dist_out(16 + x, 16 + y) > inset + 2:   # 밟는 면: 덩이 사이 얕은 홈만 남기고 고르게
                t = max(3, min(5, t))
            p[x, y] = ramp[t] + (255,)
    return im

def cloudpath_cell(m, N, E, S, W):
    """구름 길 칸(걷기, 아래층): 상아빛으로 다져진 구름 — 덩이 윗면을 눌러 고르게 하고(밟는 면), 이웃 없는 쪽은
    둥근 덩이가 테처럼 솟는다(덩이마다 왼쪽 위 밝음·아래 그늘·짙은 보랏빛 윤곽). 칸 밖은 투명(구름 바다가 비친다)."""
    return puff_cell(m, CP, inset=2.5, rad=5.4, seed=61, flat=1, fill=3)
def autotile_cloudpath(): return autotile_sheet(cloudpath_cell)
def ground_cloudpath():
    c = puff_cell(15, CP, inset=2.5, rad=5.4, seed=61, flat=1, fill=3)
    im = new(48, 48)
    for j in range(3):
        for i in range(3): im.paste(c, (i * 16, j * 16))
    return im

def fringe_cell(m, N, E, S, W):
    """구름 번짐 칸(위층, 통행 불가 장식): 속은 덩이 구름으로 꽉 차고, 이웃 없는 쪽은 덩이가 작아지며 흩어져 사라진다.
    섬 밑면 뿌리 끝·다리 밑·맵 가장자리를 구름 속에 묻을 때 쓴다."""
    return puff_cell(m, CL, inset=3.0, rad=7.0, scatter=.45, seed=71, fill=4)
def autotile_cloudfringe(): return autotile_sheet(fringe_cell)

# ---------------------------------------------------------------- 떠다니는 구름 덩이(위층 장식)
def cloud_puff(w, h, seed):
    """떠다니는 작은 구름 덩이(투명 바탕): 덩이 4~7개, 아래가 평평하게 눌린 뭉게구름."""
    r = random.Random(seed); puffs = []
    n = 3 + int(w / 12)
    for i in range(n):
        t = (i + .5) / n
        rx = h * r.uniform(.28, .42) * (1.25 - abs(t - .5))
        puffs.append((w * (.12 + .76 * t) + r.uniform(-2, 2), h * .58 - rx * .4 + r.uniform(-2, 2), rx, rx * .8))
    puffs.sort(key=lambda p: p[1] + p[3] * .6)
    tone, pid = paint_puffs(w, h, puffs, CL)
    im = new(w, h); p = im.load()
    for y in range(h):
        for x in range(w):
            if tone[y, x] >= 0 and y < h - 2: p[x, y] = CL[int(tone[y, x])] + (255,)
    # 아래 납작: 맨 아래 윤곽줄 다시
    for x in range(w):
        for y in range(h - 1, -1, -1):
            if p[x, y][3]: p[x, y] = CL[1] + (255,); break
    return im

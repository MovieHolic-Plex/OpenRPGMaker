# 전투 배경 — 암석 동굴(rock-cave). 그림 함수는 src/rock_cave/ 사본(rc_base·rc_props)의 것을 쓴다.
# 원경: 종유석 천장 윤곽 + 회갈 바위벽(버들항 절벽 갈비 결) 두 겹(먼 벽 / 앞으로 나온 바위 버팀) + 먼 갱도 입구(겹 아치).
# 바닥: rc 암반 바닥(잔돌·점·실금) + 벽 밑 자갈 띠 + 갱도 앞 젖은 바위. 가장자리: 가까운 바위 기둥·석순·바위.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('rock_cave')
import numpy as np
import rc_base as B
import rc_props as R
from rc_base import RK, WET, WT, MOSSR, DIRT, BONE, WOOD7, IRON7, GOLD7, FIRE7, LEAF7, VOIDC, _hash, vnoise

SEED = 7
HZ = 170                                   # 벽 밑선(지평선) 기준
RKF = [B.mul(c, .74) for c in RK]          # 먼 벽 램프: 동굴 바위 7단을 한 번 어둡게(원경 대기)
MOSF = [B.mul(c, .74) for c in MOSSR]
PAL = RK + RKF + WET + WT + MOSSR + MOSF + DIRT + BONE + WOOD7 + IRON7 + GOLD7 + FIRE7 + LEAF7[2:6] + VOIDC


def ceil_y(x): return int(14 + 6 * vnoise(x, 0, 23, 301) + 5 * vnoise(x, 0, 7, 302))
def base_y(x, seed=0): return HZ + int(round(3 * vnoise(x, 0, 17, 330 + seed) - 1.5))


def col_face(a, x, y0, y1, seed, ox=0, k=1.0, lit=None):
    """한 세로줄을 동굴 바위 앞면 함수로 칠한다(밑 = 윤곽). lit = 'L'/'R' 가장자리 빛·그늘."""
    Hh = y1
    for y in range(max(0, y0), min(K.H, y1)):
        c = B.rock_face_px(x + ox, y, Hh, seed, False, False)
        a[y, x] = B.mul(c, k) if k != 1.0 else c


def tier_y(x):                               # 먼 단의 바위 턱 윗선(60~84, 계단처럼 꺾인다)
    step = 66 if x < 170 else (78 if x < 330 else (62 if x < 520 else 74))
    return int(step + 4 * vnoise(x, 0, 21, 340) - 2)


def ledge_top(x, y, d, t):
    """바위 턱 윗면(지도 천장 띠와 같은 결): 주조 4 + 점·잔 구멍, 맨 윗줄 밝음, 밑 두 줄 윤곽."""
    k = 4 + (vnoise(x, y, 3.0, 131) - .5) * 1.2
    r = _hash(x, y, 133)
    if r < .09: k -= 1
    elif r > .93: k += 1
    if _hash(x // 2, y // 2, 134) > .9 and _hash(x, y, 135) < .5: k -= 1
    if d == 0: k = 6
    elif d == 1: k += .5
    if d == t - 1: return RK[0]
    if d == t - 2: k -= 1.5
    return RK[max(1, min(6, int(round(k))))]


def back(a):
    """벽 두 단: 위 = 먼 바위벽(한 단 어둠), 가운데 = 바위 턱 윗면 띠(지도 천장 띠 결), 아래 = 가까운 바위벽."""
    for x in range(K.W):
        cy = ceil_y(x); ty = tier_y(x); band = 9 + int(2 * vnoise(x, 0, 9, 341))
        for y in range(cy, ty):                              # 먼 벽
            a[y, x] = B.mul(B.rock_face_px(x + 500, y - cy, ty - cy, SEED + 9, False, False), .74)
        for y in range(ty, ty + band):                       # 턱 윗면
            a[y, x] = ledge_top(x, y, y - ty, band)
        yb = base_y(x); y0 = ty + band
        for y in range(y0, yb):                              # 가까운 벽(턱 밑 그늘 → 아래 밝음)
            a[y, x] = B.rock_face_px(x, y - y0, yb - y0, SEED, False, False)
        # 단이 꺾이는 곳: 턱 끝 세로 윤곽(계단 모서리)
        if x > 0 and tier_y(x - 1) // 6 != ty // 6 and abs(tier_y(x - 1) - ty) > 6:
            lo, hi = sorted((tier_y(x - 1), ty))
            a[lo:hi + band, x] = RK[0]
        for y in range(0, cy):
            a[y, x] = VOIDC[0] if vnoise(x, y, 5, 142) < .55 else VOIDC[1]
        a[cy, x] = RK[0]; a[cy + 1, x] = RK[1]


def tunnel(a, cx=398, w=76, top=84):
    """먼 갱도 입구: 바깥 테 바위 → 안쪽으로 작아지는 아치 4겹, 가장 안은 거의 검다. 안쪽 바닥은 겹마다 어둡다."""
    yb = HZ + 1
    def arch(hw, ytop):
        m = np.zeros((K.H, K.W), bool)
        for y in range(ytop, yb):
            dx = math.sqrt(max(0, hw * hw - (ytop + hw - y) ** 2)) if y < ytop + hw else hw
            dx += _hash(y // 3, hw, 77) * 1.6 - .8
            m[y, max(0, int(cx - dx)):min(K.W, int(cx + dx))] = True
        return m
    rings = [(w // 2 + 7, top - 7), (w // 2, top), (w // 2 - 9, top + 15), (w // 2 - 17, top + 30), (w // 2 - 23, top + 44)]
    m0 = arch(*rings[0])
    yy, xx = np.nonzero(m0)
    for y, x in zip(yy, xx):                               # 바깥 테: 밝은 바위(왼쪽 빛, 오른쪽 그늘)
        c = B.rock_face_px(x + 300, y, HZ, SEED + 4, False, False)
        a[y, x] = c if x < cx - 6 else B.mul(c, .72)
    cols = [RKF[1], VOIDC[2], VOIDC[1], VOIDC[0]]
    floors = [RKF[3], RKF[2], RKF[1], VOIDC[2]]
    for i, (hw, yt) in enumerate(rings[1:]):
        m = arch(hw, yt)
        a[m] = cols[i]
        for x in range(int(cx - hw), int(cx + hw) + 1):    # 겹 윗 테두리 윤곽
            ys = np.nonzero(m[:, x])[0]
            if len(ys): a[ys[0], x] = RK[0] if i < 2 else VOIDC[0]
        fy = yb - 8 + i * 2                                # 안쪽 바닥 띠
        for y in range(fy, yb):
            for x in range(int(cx - hw + 2), int(cx + hw - 1)):
                if m[y, x] and _hash(x, y, 90 + i) > .08: a[y, x] = floors[i]
        if i < 3:                                         # 바닥 띠 윗줄 = 바닥 끝 밝은 턱
            for x in range(int(cx - hw + 2), int(cx + hw - 1)):
                if m[fy, x]: a[fy, x] = RKF[4] if i == 0 else RKF[3]


def floor(a):
    rock = B.floor_rock_fn(11, P=640)
    grav = B.floor_gravel_fn(21, P=640)
    wet = B.floor_rock_fn(41, WET, wet=True, P=640)
    def f(X, Y):
        yy = Y - HZ
        if yy < 9 + 5 * vnoise(X, 0, 19, 311): return grav(X, Y)       # 벽 밑 자갈(무너진 돌) 띠
        dx = (X - 398) / 64.0; dy = (Y - (HZ + 24)) / 18.0              # 갱도 앞 젖은 자리
        if dx * dx + dy * dy + (vnoise(X, Y, 6, 312) - .5) * .9 < 1: return wet(X, Y)
        return rock(X, Y)
    for x in range(K.W):
        for y in range(base_y(x), K.H):
            a[y, x] = f(x, y)
        b = base_y(x)
        a[b, x] = RK[0]
    # 벽 밑 그늘 — 3단(멀수록 어둡다)
    for x in range(K.W):
        b = base_y(x)
        a[b + 1:b + 4, x] = (a[b + 1:b + 4, x] * .6).astype(np.uint8)
        a[b + 4:b + 10, x] = (a[b + 4:b + 10, x] * .78).astype(np.uint8)
        a[b + 10:b + 20, x] = (a[b + 10:b + 20, x] * .9).astype(np.uint8)


def near_pillar(a, xl, xr, ybase, seed, side):
    """화면 가장자리의 가까운 바위 기둥: 천장에서 바닥(ybase)까지, 밑동은 안쪽으로 퍼진다."""
    for y in range(0, ybase):
        t = y / ybase
        flare = int(max(0, (t - .7) / .3) ** 2 * 24)
        wob = int(3 * vnoise(0, y, 13, seed + 5))
        x0 = xl - (flare if side == 'R' else 0) + wob
        x1 = xr + (flare if side == 'L' else 0) + wob
        for x in range(max(0, x0), min(K.W, x1)):
            c = B.rock_face_px(x, y, ybase, seed, False, False)
            if x - x0 < 2: c = RK[4] if x - x0 == 1 else RK[3]
            elif x1 - x <= 4: c = B.mul(c, .62)
            a[y, x] = c
        if 0 <= x0 < K.W: a[y, x0] = RK[0]
        if 0 <= x1 < K.W: a[y, x1] = RK[0]
    K.ellipse_shadow(a, (xl + xr) // 2 + (12 if side == 'L' else -12), ybase + 1, (xr - xl) // 2 + 24, 5, .6)


def props(a):
    P = K.paste_bl
    for i, x in enumerate([68, 120, 176, 238, 296, 350, 452, 500, 546]):      # 천장 종유석 줄(길이·변형 섞기)
        K.paste(a, R.stalactites_face(2, [1, 6, 3, 9, 4, 2, 8, 5, 7][i]), x, ceil_y(x + 16) - 2, flip=i % 2 == 1)
    for x in (140, 268, 432):                                                   # 짧은 종유석 덧줄
        K.paste(a, R.stalactites_face(2, x), x, ceil_y(x + 16) - 3, dim=.8)
    # 벽 밑(뒤쪽) — 석주·석순·바위. 밑변 y <= 188
    P(a, R.column_great(1), 150, HZ + 9, dim=.92)
    P(a, R.column_drip(1), 536, HZ + 7, dim=.9)
    P(a, R.column_drip(3), 270, HZ + 5, dim=.86, flip=True)
    P(a, R.stalagmite_cluster(1), 206, HZ + 13)
    P(a, R.stalagmite_cluster(5), 470, HZ + 12, flip=True)
    P(a, R.stalagmite('m', 2), 312, HZ + 11)
    P(a, R.stalagmite('s', 1), 336, HZ + 14)
    P(a, R.stalagmite('s', 4), 560, HZ + 13)
    P(a, R.boulder('w', 2, True), 322, HZ + 18)
    P(a, R.rubble(1), 488, HZ + 18)
    P(a, R.rubble(3), 104, HZ + 17)
    P(a, R.wall_torch(), 352, 132); P(a, R.wall_torch(), 436, 132)
    # 앞쪽 가장자리(왼쪽 0~116, 오른쪽 566~640)
    P(a, R.stalagmite('l', 3, .3), 74, 304)
    P(a, R.stalagmite('m', 6), 96, 322)
    P(a, R.boulder('m', 3, True), 2, 346)
    P(a, R.boulder('s', 5, True), 60, 348)
    P(a, R.stalagmite_cluster(7), 584, 288, flip=True)
    P(a, R.boulder('s', 1), 614, 322)
    P(a, R.boulder('w', 4, True), 568, 352)
    P(a, R.bones(), 98, 258)
    P(a, R.mushrooms(), 30, 266); P(a, R.mushrooms(), 604, 252)


def build(out):
    a = K.canvas(VOIDC[0])
    back(a)
    tunnel(a)
    floor(a)
    near_pillar(a, -8, 34, 240, 41, 'L')
    near_pillar(a, 608, 652, 232, 43, 'R')
    props(a)
    for cx in (360, 444):                                   # 횃불 빛: 두 단(블러 없음), 벽 위쪽에만
        yy, xx = np.mgrid[0:K.H, 0:K.W]
        for rr, t in ((20, .10), (11, .18)):
            m = (((xx - cx) / rr) ** 2 + ((yy - 118) / (rr * .8)) ** 2 <= 1) & (yy < HZ)
            a[m] = (a[m] * (1 - t) + np.array(FIRE7[4]) * t).astype(np.uint8)
    return K.finish(a, out, pal=PAL)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'rock-cave.png')))

# 전투 배경 — 산악 요새 성벽 앞(mountain-fortress). 그림 함수는 src/mountain/ 사본(mf_ground·mf_stone·mf_props)의 것을 쓴다.
# 원경: 겨울 하늘(단색 띠 4 + 손 구름) · 먼 눈 덮인 산 두 겹 · 성벽(wall_seg) 줄과 가운데 성문 건물(wall_gatehouse)·양옆 성문 탑.
# 바닥: 산 암반(rock_floor) + 눈 덮개(snow_layer, 자연 덩이) + 성벽 밑 자갈 비탈(scree) + 성문에서 내려오는 자갈길(gravel).
# 가장자리: 눈 덮인 전나무 덩이·눈 바위·바위 봉우리·돌무지·횃불 기둥.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('mountain')
import numpy as np
from PIL import Image
import mf_ground as G
import mf_stone as S
import mf_props as P
from px2 import PAL, hx, vnoise, _hash
from mfwl import tnoise

SKY = [hx(c) for c in PAL['sky']]
SN, MR = G.SN, G.MR
HZ = 172
WALLB = HZ + 6                  # 성벽 밑변


def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def sky(a):
    """하늘: 단색 띠 4개, 띠 경계는 8px 마디마다 1~2px 계단(손으로 칠한 띠)."""
    bands = [(0, SKY[4]), (34, mix(SKY[4], SKY[5], .5)), (62, SKY[5]), (88, mix(SKY[5], SKY[6], .55))]
    for x in range(K.W):
        for i, (y0, c) in enumerate(bands):
            off = 0 if i == 0 else int(2 * _hash(x // 8, i, 700))
            a[y0 + off:, x] = c


def cloud(a, cx, cy, w, seed):
    """손 구름 덩이: 둥근 혹 여러 개의 합, 위·왼 밝은 테(눈 6), 속 5, 아래 평평한 그늘 줄(4)."""
    import random
    rr = random.Random(seed)
    blobs = [(cx + (i - 2) * w * .2 + rr.uniform(-3, 3), cy - rr.uniform(2, 7) * (1.4 - abs(i - 2) * .35), rr.uniform(w * .13, w * .2)) for i in range(5)]
    blobs += [(cx - w * .38, cy + 2, w * .12), (cx + w * .38, cy + 2, w * .12), (cx, cy + 1, w * .3)]
    m = np.zeros((K.H, K.W), bool)
    yy, xx = np.mgrid[0:K.H, 0:K.W]
    for (bx, by, r) in blobs: m |= ((xx - bx) / r) ** 2 + ((yy - by) / (r * .78)) ** 2 <= 1
    m &= yy <= cy + 5                                                     # 밑은 평평하게
    up = np.roll(m, 1, 0); lf = np.roll(m, 1, 1); dn = np.roll(m, -1, 0)
    a[m] = SN[5]
    a[m & ~up] = SN[6]; a[m & ~lf & up] = SN[6]
    a[m & (yy >= cy + 3)] = SN[4]
    a[m & ~dn] = SN[3]


def ridge(x, base, amp, sc, seed):
    return base - amp * (abs(vnoise(x, 0, sc, seed) - .5) * 2) ** .8 - amp * .35 * vnoise(x, 0, sc / 3.1, seed + 1)


def mountains(a):
    """먼 산 두 겹: 왼쪽 비탈(빛) 밝은 단, 오른쪽 비탈 어두운 단, 골짜기 줄(세로 금), 위쪽은 눈 갓(들쭉날쭉 눈선)."""
    layers = [(122, 66, 70, 901, [SN[2], SN[3], SN[4], SN[5], SN[6]], 18),     # 먼 겹: 푸른 회색 + 눈
              (150, 48, 46, 905, [MR[3], MR[4], MR[5], SN[5], SN[6]], 12)]     # 가까운 겹: 산 바위 + 눈
    for (base, amp, sc, seed, ramp, snowd) in layers:
        top = [int(ridge(x, base, amp, sc, seed)) for x in range(K.W)]
        for x in range(K.W):
            t = top[x]
            sl = top[min(K.W - 1, x + 2)] - top[max(0, x - 2)]                 # +: 오른쪽으로 내려간다(빛 받는 쪽)
            lit = sl >= 0
            snowline = t + snowd + int(6 * vnoise(x, 0, 7, seed + 3))
            for y in range(max(0, t), HZ):
                gv = vnoise(x + (y - t) * (.55 if lit else -.55), 0, 9, seed + 4)       # 비탈 따라 비스듬히 내려가는 골짜기 금
                gul = abs(gv - .5) < .035 and y > t + 3
                if y < snowline:
                    c = ramp[4] if lit else ramp[3]
                    if gul: c = ramp[2]
                else:
                    c = ramp[2] if lit else ramp[1]
                    if _hash(x, y, seed + 5) < .04: c = ramp[1 if lit else 0]
                    if gul: c = ramp[0]
                    if (y - snowline) < 2 and _hash(x // 2, y, seed + 6) < .5: c = ramp[3]     # 눈선 아래 남은 눈 점
                a[y, x] = c
            if t >= 0: a[t, x] = ramp[1] if not lit else ramp[2]                       # 산마루 윤곽(어두운 한 줄)


def fortress(a):
    PB = K.paste_bl
    gh = S.wall_gatehouse()                        # 80x64 성문 건물(먼 성문)
    gx = 320 - gh.width // 2
    tw = S.gate_tower(False, True, False); tw2 = S.gate_tower(True, True, False)
    # 성벽 줄: 왼쪽은 탑 쪽에서 바깥으로, 오른쪽은 탑에서 바깥으로 이어 붙인다(탑 밑에서 이음매가 숨는다)
    i = 0; x = gx - 44 + 8
    while x > -64:
        w = 64 if i % 3 else 48; x -= w
        PB(a, S.wall_seg(w // 16, seed=2 + i, drain=(i % 4 == 2)), x, WALLB, dim=.95); i += 1
    x = gx + gh.width + 44 - 8
    while x < K.W:
        w = 64 if i % 3 else 48
        PB(a, S.wall_seg(w // 16, seed=2 + i, drain=(i % 4 == 2)), x, WALLB, dim=.95); x += w; i += 1
    PB(a, tw, gx - 44, WALLB - 2, dim=.9); PB(a, tw2, gx + gh.width - 4, WALLB - 2, dim=.9)
    PB(a, gh, gx, WALLB)
    PB(a, S.bastion(5), 40, WALLB + 2, dim=.92); PB(a, S.bastion(7), 552, WALLB + 2, dim=.92)
    PB(a, S.torch_post(1), gx - 14, WALLB + 8); PB(a, S.torch_post(2), gx + gh.width - 2, WALLB + 8)


def floor(a):
    Hh = K.H - HZ
    rock = G.rock_floor(K.W, Hh, 7)
    a[HZ:, :] = rock
    # 자갈길: 성문에서 화면 아래로 넓어지며 내려온다(길 가장자리는 잡음으로 흔들린다)
    yy, xx = np.mgrid[0:Hh, 0:K.W]
    hw = 18 + yy * .3 + (tnoise(K.W + 16, Hh + 16, 8, 77)[:Hh, :K.W] - .5) * 10
    path = np.abs(xx - 320) < hw
    gv = G.gravel(K.W, Hh, 11)
    reg = a[HZ:, :]
    reg[path] = gv[path]
    # 눈 덮개: 칸 마스크(가장자리·뒤쪽 비탈) → 자연 덩이
    cm = np.zeros(((Hh + 15) // 16, K.W // 16), float)
    for cx in range(K.W // 16):
        for cy in range(cm.shape[0]):
            edge = min(cx, K.W // 16 - 1 - cx)
            if edge < 5 - (cy > 6) * 1 and _hash(cx, cy, 81) < .85: cm[cy, cx] = 1          # 좌우 가장자리
            if cy == 0 and _hash(cx, 0, 82) < .45 and not (16 <= cx <= 23): cm[cy, cx] = 1   # 성벽 밑 눈 턱
            if cy >= 10 and edge < 7 and _hash(cx, cy, 83) < .6: cm[cy, cx] = 1             # 앞쪽 구석
    mask = G.jag_mask(cm, 41)[:Hh, :K.W] & ~path
    ys, xs = np.mgrid[0:Hh, 0:K.W]
    mask &= ~((xs >= 112) & (xs < 568) & (ys + HZ >= 192) & (ys + HZ < 336))        # 배틀러 자리엔 눈을 깔지 않는다
    K.paste(a, G.snow_layer(mask, 41), 0, HZ)
    # 성벽 밑 자갈 비탈
    sm = np.zeros((Hh, K.W), bool); sm[0:14, :] = True
    sm &= (tnoise(K.W + 16, Hh + 16, 8, 79)[:Hh, :K.W] > .35)
    K.paste(a, G.scree_layer(sm, 61), 0, HZ)
    a[HZ:HZ + 3] = (a[HZ:HZ + 3] * .7).astype(np.uint8)


def edges(a):
    PB = K.paste_bl
    PB(a, P.fir_snow(4, 172), -12, 262); PB(a, P.fir_snow(3, 171), 22, 236); PB(a, P.fir_snow(2, 173), 64, 214)
    PB(a, P.fir_dusted(48, 64, 5, 187), 590, 270); PB(a, P.fir_snow(3, 175), 566, 232); PB(a, P.fir_dusted(32, 48, 4, 185), 612, 214)
    PB(a, P.snowrock('l'), 4, 350); PB(a, P.snowrock('m'), 66, 330); PB(a, P.cairn_mark(), 96, 300)
    PB(a, P.crag(1), 600, 346); PB(a, P.snowrock('s'), 568, 336); PB(a, P.boulders(), 548, 352)
    PB(a, P.snowrock('m', 124), 112, HZ + 18); PB(a, P.boulders(133), 500, HZ + 16)
    PB(a, P.dead_snag(201), 104, 262)


def build(out):
    a = K.canvas(SKY[5])
    sky(a)
    for (cx, cy, w, s) in ((96, 26, 70, 1), (250, 14, 48, 2), (470, 30, 84, 3), (600, 12, 40, 4)): cloud(a, cx, cy, w, s)
    mountains(a)
    floor(a)
    fortress(a)
    edges(a)
    return K.finish(a, out)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'mountain-fortress.png')))

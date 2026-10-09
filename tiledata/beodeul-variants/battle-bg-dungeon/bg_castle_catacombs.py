# 전투 배경 — 지하 묘소(castle-catacombs). 그림 함수는 castle-catacombs 가 쓰는 _lib3 의 바닥·앞면 함수(dlib, 읽기만)와
# src/catacombs/dprops.py 사본(벽감·촛불·석관·뼈·기둥·아치)을 쓴다. 바닥 판석 함수(_cata_flag/_bone_flag/_dark_cata)는 여기 복사했다.
# 원경: 납골 벽감이 줄지어 판 카타콤 벽(위층은 멀어 어둡다) + 가운데 깊어지는 아치 통로 + 벽 횃불.
# 바닥: 어두운 카타콤 판석 + 뼛가루 판석. 가장자리: 가까운 큰 아치 테(쐐기돌)·석관·관·뼈 더미·해골·촛불.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('catacombs')
sys.path.insert(1, os.path.join(HERE, '..', '_lib3'))
import numpy as np
import dlib
from dlib import ST, DK, PL, mix, mul, _hash, flag, ash
import dprops as D
from px2 import vnoise

HZ = 170
CORN = 70
BONE = D.BONE


# ---- dlib 바닥 판석 사본(칸마다 5변형 중 하나, 지도와 같은 그림)
def cata_px(x, y):
    s = int(_hash(x // 16, y // 16, 8) * 5)
    return flag(x % 16 + s * 16, y % 16 + (s % 2) * 8, 31, mix(ST[4], ST[3], .3), ST[2])


def dark_px(x, y):
    s = int(_hash(x // 16, y // 16, 24) * 5)
    return flag(x % 16 + s * 16, y % 16 + (s % 2) * 8, 61, mix(ST[3], ST[4], .3), ST[1])


def bone_px(x, y):
    s = int(_hash(x // 16, y // 16, 23) * 5)
    c = flag(x % 16 + s * 16, y % 16 + (s % 2) * 8, 51, mix(ST[4], ST[3], .5), ST[2])
    if c != ST[2]:
        r = _hash(x % 16, y % 16, 52 + s)
        if r > .965: c = PL[4]
        elif r > .93: c = mix(c, PL[3], .5)
    return c


def wall(a):
    for x in range(K.W):
        for y in range(0, 18): a[y, x] = DK if vnoise(x, y, 5, 801) < .6 else mix(DK, ST[0], .5)
        for y in range(18, CORN):
            a[y, x] = mul(dlib.face_px('cata', x + 5, y - 18, CORN - 18, 9, False, False), .7)
        for y in range(CORN, CORN + 7):                                     # 처마 띠(돌 턱 윗면)
            d = y - CORN
            c = ash(x, y, 13, ST[4], ST[2], bw=24, bh=7)
            if d == 0: c = ST[5]
            elif d == 1: c = mix(c, ST[5], .3)
            elif d == 6: c = DK
            elif d == 5: c = mul(c, .7)
            a[y, x] = c
        for y in range(CORN + 7, HZ):
            a[y, x] = dlib.face_px('cata', x, y - CORN - 7, HZ - CORN - 7, 3, False, False)


def niches(a):
    kinds = ('skull', 'shroud', 'urn')
    def row(y, x0, x1, step, dim, seed):
        x = x0
        while x + 16 <= x1:
            k = kinds[int(_hash(x // 16, y, seed) * 3)]
            if _hash(x, y, seed + 40) > .1:                               # 열에 하나쯤은 빈 벽(무너져 메운 자리)
                K.paste(a, D.niche(k, seed), x, y, dim=dim)
            x += step
    # 위층(먼 벽) 두 줄
    for y in (26, 46):
        row(y, 18, 280, 20, .72, 3); row(y, 360, 624, 20, .72, 5)
    # 아래 벽 세 줄 — 가운데 아치 통로 자리와 횃불 자리는 비운다
    for i, y in enumerate((CORN + 12, CORN + 32, CORN + 52)):
        row(y, 14 + (i % 2) * 6, 268, 22, 1.0, 11 + i); row(y, 372 + (i % 2) * 6, 628, 22, 1.0, 21 + i)
    for (x, y) in ((96, CORN + 72), (204, CORN + 72), (420, CORN + 72), (528, CORN + 72)):
        pass


def passage(a, cx=320, w=72, top=CORN + 10):
    """가운데 아치 통로: dprops.arch_opening 의 쐐기돌 테 결을 크게 + 안쪽으로 작아지는 아치 2겹(어둠 → 더 어둠)."""
    yb = HZ
    def ring(R, cy, th, k0=1.0):
        yy, xx = np.mgrid[0:K.H, 0:K.W]
        d = np.hypot(xx + .5 - cx, yy + .5 - cy)
        inside_o = ((yy < cy) & (d <= R)) | ((yy >= cy) & (np.abs(xx + .5 - cx) <= R) & (yy < yb))
        inside_i = ((yy < cy) & (d <= R - th)) | ((yy >= cy) & (np.abs(xx + .5 - cx) <= R - th) & (yy < yb))
        rim = inside_o & ~inside_i
        ys, xs = np.nonzero(rim)
        for y, x in zip(ys, xs):
            ang = math.atan2(cy - (y + .5), (x + .5) - cx) if y < cy else (0 if x > cx else math.pi)
            seg = int(ang / (math.pi / 9))
            k = 4 if seg % 2 else 3
            if x < cx - R + 3: k += 1
            if x > cx + R - 4: k -= 1
            if y < cy and abs(ang - math.pi / 2) < math.pi / 18: k = 5
            if _hash(x, y, 7) < .07: k += 1 if _hash(y, x, 4) < .5 else -1
            a[y, x] = mul(ST[max(1, min(6, k))], k0)
        return inside_i
    R = w // 2
    cy = top + R
    hole = ring(R, cy, 5)
    a[hole] = mix(DK, ST[0], .4)
    hole2 = ring(R - 12, cy + 16, 4, .62)
    a[hole2] = DK
    hole3 = ring(R - 21, cy + 30, 3, .42)
    a[hole3] = (14, 10, 18)
    # 안쪽 바닥 띠(겹마다 어둡게)
    for i, (hw, c) in enumerate(((R - 5, mul(ST[2], .8)), (R - 16, mul(ST[1], .8)), (R - 24, ST[0]))):
        for y in range(yb - 6 + i * 2, yb):
            for x in range(cx - hw, cx + hw): a[y, x] = c


def floor(a):
    for y in range(HZ, K.H):
        for x in range(K.W):
            band = 12 + 6 * (_hash(x // 16, 0, 812) > .5)
            if y - HZ < band: a[y, x] = bone_px(x, y)                     # 벽 밑 뼛가루 판석 띠(칸 단위로 들쭉날쭉)
            elif 288 <= x < 352: a[y, x] = cata_px(x, y)                  # 통로에서 내려오는 밝은 판석 길(한 줄기)
            else: a[y, x] = dark_px(x, y)                                 # 나머지는 어두운 카타콤 판석 하나
    a[HZ, :] = DK
    for (y0, y1, k) in ((HZ + 1, HZ + 4, .58), (HZ + 4, HZ + 10, .76), (HZ + 10, HZ + 22, .9)):
        a[y0:y1] = (a[y0:y1] * k).astype(np.uint8)


def near_vault(a):
    """가까운 큰 아치 테(화면을 감싼다): 쐐기돌 띠 + 양옆 돌 기둥(카타콤 앞면 마름돌), 밑은 바닥에 앉는다."""
    cx, R, th = 320, 372, 22
    cy = 300                                        # 아치 중심(화면 아래 밖) → 위쪽 모서리만 보이는 큰 둥근 천장 테
    yy, xx = np.mgrid[0:K.H, 0:K.W]
    d = np.hypot(xx + .5 - cx, (yy + .5 - cy) * 1.0)
    rim = (d >= R - th) & (d < R) & (yy < cy)
    out = (d >= R) & (yy < 140)
    for y, x in zip(*np.nonzero(out)):                                  # 테 바깥 = 천장 돌(어둠 쪽)
        a[y, x] = mul(ash(x, y, 21, ST[2], ST[1], bw=16, bh=8), .8)
    for y, x in zip(*np.nonzero(rim)):
        ang = math.atan2(cy - (y + .5), (x + .5) - cx)
        seg = int(ang / (math.pi / 40))
        r = d[y, x] - (R - th)
        k = 4 if seg % 2 else 3
        if r < 2: k += 1                                                # 안쪽 모서리 밝음(빛)
        if r > th - 3: k -= 1
        if int(r) == th - 1: k = 1
        if _hash(x, y, 31) < .06: k += 1 if _hash(y, x, 32) < .5 else -1
        a[y, x] = ST[max(1, min(6, k))]
        if abs(r - 0.5) < .5: a[y, x] = DK
    # 기둥: 아치가 끝나는 곳에서 바닥까지
    for (x0, x1) in ((0, 30), (610, 640)):
        ytop = int(min(np.nonzero(rim[:, x0 + 5])[0].max() if rim[:, x0 + 5].any() else 120, 200))
        for y in range(ytop, 252):
            for x in range(x0, x1):
                c = ash(x, y, 41, ST[4], ST[2], bw=16, bh=8)
                if x == x0 + (0 if x0 else 0) and x0: c = DK
                if x0 == 0 and x >= x1 - 3: c = mul(c, .62)
                if x0 and x < x0 + 2: c = ST[5]
                a[y, x] = c
            a[y, x1 if x0 == 0 else x0 - 1] = DK
        for y in range(244, 252):
            for x in range(max(0, x0 - 4), min(K.W, x1 + 4)): a[y, x] = ST[3] if y < 249 else (ST[2] if y < 251 else DK)
        K.ellipse_shadow(a, (x0 + x1) // 2 + (8 if x0 == 0 else -8), 253, 26, 3, .55)


def props(a):
    P = K.paste_bl
    for x in (100, 210, 420, 530): P(a, D.torch_wall(), x, CORN + 86)
    for x in (156, 476): P(a, D.chains(x), x, CORN + 30, dim=.9)
    P(a, D.column(4, 'cata', seed=2), 264, HZ + 8, dim=.95); P(a, D.column(4, 'cata', seed=5), 360, HZ + 8, dim=.95)
    P(a, D.candles(3, 1), 284, HZ + 12); P(a, D.candles(2, 6), 340, HZ + 12)
    P(a, D.sarcophagus(5), 150, HZ + 18, dim=.95); P(a, D.coffin(4), 450, HZ + 18, dim=.95)
    P(a, D.skulls(2, 3), 210, HZ + 14); P(a, D.bones(3, 2), 396, HZ + 15); P(a, D.rubble(4, 'cata'), 520, HZ + 16)
    P(a, D.bone_heap(4), 76, HZ + 20); P(a, D.candles(3, 9), 116, HZ + 14); P(a, D.candles(2, 12), 500, HZ + 13)
    # 앞쪽 가장자리
    P(a, D.sarcophagus(), 30, 300); P(a, D.candles(3, 2), 78, 278)
    P(a, D.bone_heap(), 4, 352); P(a, D.skulls(6, 2), 70, 340); P(a, D.bones(1, 1), 100, 318)
    P(a, D.coffin(), 572, 304, flip=True); P(a, D.candles(3, 4), 552, 280)
    P(a, D.rubble(7, 'cata'), 606, 352); P(a, D.skulls(2, 7), 572, 346); P(a, D.brazier(), 608, 280)


def build(out):
    a = K.canvas(DK)
    wall(a)
    niches(a)
    passage(a)
    floor(a)
    props(a)
    near_vault(a)
    return K.finish(a, out)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'castle-catacombs.png')))

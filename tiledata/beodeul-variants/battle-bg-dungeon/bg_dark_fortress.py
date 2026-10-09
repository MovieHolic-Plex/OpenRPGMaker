# 전투 배경 — 마왕성 안(dark-fortress) 알현실. 그림 함수는 src/dark/ 사본(df_kit·df_art1~3·df_ext)의 것을 쓴다.
# 원경: 검은 마름돌 벽(df_ext 'black' 앞면) + 처마 띠 + 붉은 깃발·붉은 촛대 + 뒤쪽 가운데 먼 옥좌 단, 좌우로 물러나는 검붉은 기둥 줄.
# 바닥: 검은 판석(black_slab 결, 주기만 640) + 옥좌 앞 단 바닥 + 붉은 카펫(오토타일). 가장자리: 가까운 큰 기둥·화로·용암 바위·짐승 해골.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('dark')
import numpy as np
import df_kit as DK
import df_art1 as A1, df_art2 as A2, df_art3 as A3, df_ext as E, df_lava as LV
from df_kit import OB, RDK, LAV, GLD, mix, mul, clamp, _hash, flagp
from df_art3 import _cyl_k
import dlib
from px2 import vnoise

HZ = 170
CORN = 72                 # 처마 띠 윗선


def pn(X, Y, sc, seed, period=640): return vnoise(X, Y, sc, seed, per=max(1, int(period / sc)))


def flag640(X, Y, seed, base, dark, bw=16, bh=8):
    """gc_ext.flagp 사본: 마디 열 번호를 48 대신 640 에 접는다(넓은 바닥에서 3열 반복 없음)."""
    row = Y // bh; ly = Y % bh
    jx = int(_hash(0, row, seed + 5) * 10) + 3 + (row % 2) * 2
    lx = X % bw
    if ly == bh - 1: return dark
    if lx == jx % bw: return dark
    col = (X // bw + (1 if lx > jx % bw else 0)) % (640 // bw)
    h = _hash(col, row, seed + 9)
    c = base if h < .55 else (mix(base, DK.ST[5], .16) if h < .8 else mix(base, dark, .25))
    if ly == 0 or lx == (jx + 1) % bw: c = mix(c, DK.ST[5], .22)
    r = _hash(X, Y, seed + 12)
    if r < .05: c = mix(c, DK.ST[5], .3)
    elif r > .97: c = mix(c, dark, .5)
    return c


def black_slab(X, Y):                     # df_ext.black_slab 사본(주기 640)
    c = flag640(X, Y, 401, mix(OB[3], OB[4], .15), OB[1])
    if pn(X, Y, 6, 402) > .8: c = mix(c, (80, 30, 48), .25)
    return c


def dais_floor(X, Y): return flag640(X, Y, 431, mix(OB[3], RDK[1], .35), OB[1])


def wall(a):
    for x in range(K.W):
        for y in range(0, 20):                                              # 천장 어둠
            a[y, x] = OB[0] if vnoise(x, y, 5, 142) < .6 else (14, 10, 20)
        a[20, x] = OB[0]
        for y in range(21, CORN):                                           # 처마 위 높은 벽(멀다: 한 단 어둡게)
            a[y, x] = mul(E._face_px('black', x, y - 21, CORN - 21, 5, False, False), .72)
        for y in range(CORN, CORN + 8):                                     # 처마 띠: 성벽 앞면 결(밝은 윗줄), 밑 그늘
            a[y, x] = E._face_px('rampart', x, y - CORN, 8, 9, False, False)
        for y in range(CORN + 8, HZ):                                       # 아래 벽
            a[y, x] = E._face_px('black', x + 7, y - CORN - 8, HZ - CORN - 8, 3, False, False)
    # 처마 띠 위 톱니(작은 흉벽) 줄 — 처마 끝선이 곧은 줄 하나로 끝나지 않게
    for x0 in range(4, K.W, 24):
        for y in range(CORN - 4, CORN):
            for x in range(x0, min(K.W, x0 + 12)):
                a[y, x] = OB[4] if (y == CORN - 4 or x == x0) else (OB[2] if x > x0 + 9 else OB[3])
            if x0 + 12 < K.W: a[y, x0 + 12] = OB[0]
        for x in range(x0, min(K.W, x0 + 13)): a[CORN - 5, x] = OB[0]


def floor(a):
    for y in range(HZ, K.H):
        for x in range(K.W):
            dx = abs(x - 320); dy = y - HZ
            a[y, x] = dais_floor(x, y) if (dx < 70 and dy < 18) else E.obsidian(x, y - HZ + 6)
    a[HZ, :] = OB[0]
    for (y0, y1, k) in ((HZ + 1, HZ + 4, .58), (HZ + 4, HZ + 10, .76), (HZ + 10, HZ + 22, .9)):
        a[y0:y1] = (a[y0:y1] * k).astype(np.uint8)


def carpet(a, x0, y0, y1):
    cs = E.carpet_sheet()
    cell = lambda n: cs.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
    for y in range(y0, y1, 16):
        top = y == y0
        K.paste(a, cell((4 + 2) if top else (1 + 2 + 4)), x0, y, dim=.78)
        K.paste(a, cell((4 + 8) if top else (1 + 4 + 8)), x0 + 16, y, dim=.78)


def tall_pillar(a, xl, ytop, ybot, seed=21, k=1.0):
    """df_art3.grand_pillar 사본을 키만 늘린 것: 받침 두 단·홈 새긴 원통·붉은 띠/금선·머리판. 화면 가장자리 가까운 기둥."""
    W = 32; D = -1
    def put(x, y, c):
        X, Y = xl + x, y
        if 0 <= X < K.W and 0 <= Y < K.H: a[Y, X] = mul(c, k) if k != 1 else c
    H = ybot - ytop
    by = ybot - 9                                                     # 받침 아래 단
    for y in range(by, ybot - 1):
        for x in range(2, 30):
            if y < by + 3:
                kk = 5 if (x < 5 or y == by) else 4
                if x > 26: kk = 3
            else:
                kk = 4 if x < 5 else (3 if x < 25 else 2)
                if y == by + 4: kk -= 1
                if y >= by + 6: kk = 1
            put(x, y, OB[clamp(kk + D)])
    for y in range(by - 4, by):
        for x in range(5, 27): put(x, y, OB[clamp(_cyl_k(x, 5, 27) - (1 if y >= by - 2 else 0) + (1 if y == by - 4 else 0) + D)])
    x0, x1 = 8, 24
    for y in range(ytop + 14, by - 4):
        for x in range(x0, x1):
            kk = _cyl_k(x, x0, x1)
            if (x - x0) % 4 == 2 and 1 < x - x0 < 15: kk -= 1
            if _hash(x + xl, y, seed + 2) < .04: kk += 1 if _hash(y, x, seed + 3) < .5 else -1
            put(x, y, OB[clamp(kk + D)])
        put(x0 - 1, y, OB[0]); put(x1, y, OB[0])
    for yb in [ytop + 18] + [ytop + 18 + int(H * f) for f in (.33, .62)] + [by - 12]:
        for x in range(x0, x1):
            t = _cyl_k(x, x0, x1)
            put(x, yb - 1, GLD[5] if t >= 5 else (GLD[4] if t >= 4 else GLD[3]))
            for yy in range(yb, yb + 3): put(x, yy, RDK[clamp(t - 1, 1, 6)])
            put(x, yb + 3, GLD[3] if t < 5 else GLD[4])
    for y in range(ytop + 9, ytop + 14):
        hw = 12 - (y - ytop - 9)
        for x in range(16 - hw, 16 + hw): put(x, y, OB[clamp(_cyl_k(x, 16 - hw, 16 + hw) - (1 if y >= ytop + 12 else 0) + D)])
    for y in range(ytop + 5, ytop + 9):
        for x in range(2, 30):
            kk = 4 if x < 5 else (3 if x < 26 else 2)
            if y == ytop + 8: kk -= 1
            put(x, y, OB[clamp(kk + D)])
    for x in range(3, 29): put(x, ytop + 7, RDK[3] if x < 25 else RDK[2])
    for x in range(1, 31): put(x, ytop + 4, OB[0]); put(x, ytop + 9, OB[0])
    K.ellipse_shadow(a, xl + 16, ybot, 22, 3, .55)


def lava(a):
    """앞쪽 두 구석 바닥이 깨져 드러난 용암(지도 용암 해자 그림 함수 그대로, 칸 모양만 이 화면에 맞춤)."""
    cells = set()
    for (cx, cy) in [(0, 8), (1, 8), (0, 9), (1, 9), (2, 9), (0, 10), (1, 10), (2, 10), (3, 10), (0, 11), (1, 11), (2, 11), (3, 11), (4, 11),
                     (38, 8), (39, 8), (37, 9), (38, 9), (39, 9), (36, 10), (37, 10), (38, 10), (39, 10), (35, 11), (36, 11), (37, 11), (38, 11), (39, 11)]:
        cells.add((cx, cy))
    im = LV.lava_layer(cells, 40, 12)
    K.paste(a, im, 0, HZ)


def props(a):
    P = K.paste_bl
    # 높은 벽: 쇠창살 창(붉은 빛) · 화살 구멍
    for x in (136, 216, 408, 488): P(a, A2.bars_window(), x, 54, dim=.85)
    for x in (176, 448): P(a, A2.arrow_slit(), x, 52, dim=.85)
    # 아래 벽: 붉은 깃발(처마 밑에 건다)과 붉은 촛대
    for i, x in enumerate((92, 196, 428, 532)): P(a, A2.banner_dark(13 + i), x, CORN + 8 + 48)
    for x in (144, 248, 380, 484): P(a, A2.sconce_red(), x, CORN + 44)
    # 뒤쪽 가운데: 먼 옥좌 단 + 카펫 + 양옆 촛대·갑옷 석상
    carpet(a, 304, HZ + 14, K.H)
    P(a, A1.throne(), 272, HZ + 16, dim=.92)
    P(a, A2.candelabra_black(), 252, HZ + 10, dim=.9); P(a, A2.candelabra_black(), 372, HZ + 10, dim=.9)
    # 물러나는 기둥 줄(뒤쪽, 밑변 <= 188): 안쪽일수록 어둡다
    for (x, k, yb) in ((212, .78, HZ + 8), (396, .78, HZ + 8), (148, .88, HZ + 12), (460, .88, HZ + 12)):
        P(a, A3.grand_pillar(21 + x), x, yb, dim=k)
    P(a, A2.armor_statue(), 112, HZ + 12, dim=.9); P(a, A2.armor_statue(), 512, HZ + 12, dim=.9, flip=True)
    # 앞쪽 가장자리
    P(a, A2.brazier_stand(), 86, 250); P(a, A2.brazier_stand(), 538, 250)
    P(a, A2.beast_skull(), 84, 312)
    P(a, A3.lava_rock(31), 22, 344); P(a, A3.lava_rock_wide(32), 590, 336)
    P(a, A2.lava_vent(), 104, 344); P(a, A2.lava_vent(), 536, 344)
    P(a, A2.crystal_red(), 586, 290, flip=True)
    P(a, A2.chain_hang(), 60, 60, dim=.8); P(a, A2.chain_hang(), 566, 60, dim=.8)
    P(a, A2.chandelier(), 296, 52, dim=.9)


def build(out):
    a = K.canvas(OB[0])
    wall(a)
    floor(a)
    lava(a)
    props(a)
    tall_pillar(a, -6, 14, 262, 31)
    tall_pillar(a, 614, 14, 258, 37)
    return K.finish(a, out)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'dark-fortress.png')))

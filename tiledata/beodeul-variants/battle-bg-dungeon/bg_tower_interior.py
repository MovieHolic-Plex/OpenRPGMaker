# 전투 배경 — 탑 안(tower-interior) 서고층. 그림 함수는 src/tower/ 사본(ti_kit·ti_art1~3)의 것을 쓴다.
# 원경: 둥근 탑 벽(ti_kit 'tower' 앞면 = 버들항 성 마름돌, 가장자리로 갈수록 한 단씩 어둡게 굽는다) 두 층 —
#       위층 회랑(난간·높은 창·낮은 서가) / 아래층 큰 서가 줄·장미창·뒤쪽 나선 계단.
# 바닥: 탑 판석(tower_flag) + 슬레이트 카펫 띠. 가장자리: 높이 쌓은 서가와 사다리, 기사 석상·화로·책 더미·수정 받침.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('tower')
import numpy as np
import ti_kit as TK
import ti_art1 as A1, ti_art2 as A2, ti_art3 as A3
from ti_kit import ST, SL, GLD, DK, mix, mul, _hash
import dlib
from px2 import vnoise

HZ = 170
GAL = 86                   # 위층 회랑 바닥 턱 윗선
BAND = 8


def curve_k(x):            # 둥근 탑: 가장자리로 갈수록 한 단씩 어둡다(그라데이션 아닌 3단)
    d = min(x, K.W - 1 - x)
    return .7 if d < 40 else (.82 if d < 96 else (.92 if d < 170 else 1.0))


def stone_top(x, y, d, t, k=1.0):
    """돌 턱 윗면(천장 띠와 같은 결): 밝은 마름돌 주조 + 점, 바깥 줄 가장 밝음, 안쪽 끝 윤곽."""
    c = mix(ST[4], ST[5], .4 + .3 * vnoise(x, y, 3, 601))
    r = _hash(x, y, 602)
    if r < .07: c = ST[3]
    elif r > .94: c = ST[6]
    if d == 0: c = ST[6]
    elif d == 1: c = mix(c, ST[6], .3)
    if d == t - 1: c = DK
    elif d == t - 2: c = mul(c, .7)
    return mul(c, k)


def wall(a):
    for x in range(K.W):
        ck = curve_k(x)
        cy = 14 + (2 if (x // 32) % 2 else 0)
        for y in range(0, cy): a[y, x] = mul(DK, 1.0) if vnoise(x, y, 5, 610) < .6 else mix(DK, ST[1], .4)
        for y in range(cy, cy + 6): a[y, x] = stone_top(x, y, y - cy, 6, ck)           # 천장 턱
        y0 = cy + 6
        for y in range(y0, GAL):                                                        # 위층 벽(멀다)
            a[y, x] = mul(TK._face_px('tower', x + 9, y - y0, GAL - y0, 4, False, False), .8 * ck)
        for y in range(GAL, GAL + BAND): a[y, x] = stone_top(x, y, y - GAL, BAND, ck)   # 회랑 바닥 턱 윗면
        y1 = GAL + BAND
        for y in range(y1, HZ):                                                         # 아래층 벽
            a[y, x] = mul(TK._face_px('tower', x, y - y1, HZ - y1, 2, False, False), ck)
    a[HZ - 1, :] = DK


def gallery(a):
    P = K.paste_bl
    # 위층: 높은 창(빛) + 낮은 서가, 뒤로 물러나 어둡다
    for x in (96, 280, 328, 512): P(a, A1.arch_window_tall(x), x, GAL, dim=.82)
    for x in (148, 196, 400, 448): P(a, A2.bookcase_low(x), x, GAL, dim=.78)
    P(a, A3.spiral_stair_down(3), 560, GAL + 4, dim=.72)                               # 위층 나선 계단 구멍(가장 먼 곳)
    # 회랑 난간(balustrade 오토타일 E-W 칸) — 턱 바로 위에 한 줄
    bs = A3.balustrade_sheet()
    cell = lambda n: bs.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
    for x in range(0, K.W, 16):
        if 548 <= x < 612: continue
        n = 2 + 8
        if x == 532: n = 8
        if x == 612: n = 2
        K.paste(a, cell(n), x, GAL - 10, dim=.92 * curve_k(x + 8))


def lower(a):
    P = K.paste_bl
    # 아래층 벽: 큰 서가 줄(좌우), 가운데 장미창, 벽 촛대
    for i, x in enumerate((64, 96, 152, 184, 424, 456)):
        P(a, A2.bookcase_tall(i * 7 + 1), x, HZ + 2, dim=curve_k(x + 16))
    P(a, A2.scroll_rack(2), 216, HZ + 2, dim=.95)
    P(a, A3.rose_window(1), 296, GAL + BAND + 54)
    for x in (264, 360): P(a, A1.wall_sconce(x), x, GAL + BAND + 40)
    P(a, A2.library_ladder(1), 128, HZ + 2, dim=.95)
    # 뒤쪽 오른쪽: 나선 계단(위층으로) — 탑의 원경 앵커
    P(a, A3.spiral_stair_up(1), 500, HZ + 6)
    P(a, A2.reading_desk(3), 248, HZ + 14, dim=.95); P(a, A2.lectern(2), 368, HZ + 12, dim=.95)
    P(a, A3.crystal_pedestal(1), 284, HZ + 12, dim=.95); P(a, A3.crystal_pedestal(2), 340, HZ + 12, dim=.95)


WD = dlib.WD


def plank_px(x, y):
    """dlib._plank 사본(칸마다 4변형 중 하나): 8px 널 줄, 칸마다 이음 금, 못, 결 — 지도 서재 바닥과 같은 그림."""
    cx, cy = x // 16, y // 16; X, Y = x % 16, y % 16
    s = int(_hash(cx, cy, 17) * 4)
    ly = Y % 8; row = Y // 8
    if ly == 7: return WD[1]
    c = WD[5] if _hash(row, cx, 18) < .5 else mix(WD[4], WD[5], .5)
    if ly == 0: c = mix(c, WD[6], .4)
    j = int(_hash(row, cx + s, 19) * 12) + 2
    if X == j: return WD[1]
    if _hash(X, Y, 20) < .06: c = WD[3]
    g = vnoise(X * .5, Y * 3, 3, 21)
    if g > .74: c = mix(c, WD[3], .5)
    if (X in (1, 14)) and ly in (3, 4): c = WD[1]
    return c


def floor(a):
    """벽 밑 한 단은 탑 판석(받침돌 띠), 그 앞은 서재 널판 바닥(지도 서재와 같다)."""
    for y in range(HZ, K.H):
        for x in range(K.W):
            a[y, x] = TK.tower_flag(x, y - HZ + 4) if y < HZ + 14 else plank_px(x, y - HZ - 14)
    a[HZ + 13, :] = DK
    a[HZ, :] = DK
    for (y0, y1, k) in ((HZ + 1, HZ + 4, .6), (HZ + 4, HZ + 10, .78), (HZ + 10, HZ + 22, .9)):
        a[y0:y1] = (a[y0:y1] * k).astype(np.uint8)


def edges(a):
    P = K.paste_bl
    # 왼쪽 가까운 서가 더미(두 단 쌓기) + 사다리
    P(a, A2.bookcase_tall(31), 0, 254); P(a, A2.bookcase_tall(32), 0, 206)
    P(a, A2.bookcase_tall(33), 32, 254); P(a, A2.bookcase_low(34), 32, 206)
    P(a, A2.library_ladder(4), 60, 258)
    for x in range(0, 66): a[254:258, x] = (a[254:258, x] * .6).astype(np.uint8)
    P(a, A2.book_pile(1), 72, 300); P(a, A2.book_pile(5), 96, 336); P(a, A2.book_pile(9), 30, 330)
    P(a, A2.candle_stand(1), 100, 286)
    # 오른쪽: 기사 석상 · 화로 · 돌 항아리
    P(a, A1.knight_statue(2), 600, 262, flip=True)
    P(a, A1.brazier_iron(1), 572, 300)
    P(a, A3.stone_urn(1), 614, 330); P(a, A2.book_pile(3), 566, 344)


def build(out):
    a = K.canvas(DK)
    wall(a)
    gallery(a)
    floor(a)
    lower(a)
    edges(a)
    return K.finish(a, out)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'tower-interior.png')))

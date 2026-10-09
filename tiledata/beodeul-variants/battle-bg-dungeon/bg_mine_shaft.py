# 전투 배경 — 광산 갱도(mine-tunnels). 그림 함수는 src/mine/ 사본(mt_base·mt_pieces)의 것을 쓴다.
# 원경: 두 단 갱도 벽(먼 단 = 위층 갱도 입구·사다리, 가까운 단 = 갱목 널 덧댄 벽·갱도 입구·버팀틀), 뒤쪽 가로 레일과 광차.
# 바닥: 다져진 운반로 흙(레일 둘레) + 갱도 바위 바닥 + 자갈. 가장자리: 화면을 감싸는 큰 갱목 버팀틀, 광석 더미·상자·통·결정.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bgkit as K
K.src('mine')
import numpy as np
import mt_base as B
import mt_pieces as M
from mt_base import RK, WOODX, IRON, DIRT, CRY_B, GOLD, VOIDM, mix, mul
from px2 import _hash, vnoise

HZ = 168
SEED = 3


def ceil_y(x): return int(30 + 4 * vnoise(x, 0, 19, 401) + 3 * vnoise(x, 0, 6, 402))   # 큰 버팀 보 밑에 보이는 천장 윤곽
def tier_y(x):
    step = 70 if x < 250 else (82 if x < 420 else 72)
    return int(step + 3 * vnoise(x, 0, 21, 403) - 1)
def base_y(x): return HZ + int(round(2 * vnoise(x, 0, 15, 404) - 1))


def band_px(x, y, d, t):
    """천장·바위 턱 윗면 띠(ceiling_mine 의 띠 결): 따뜻한 회갈 4단 + 점, 바깥 줄 밝음, 안쪽 끝 어두운 줄."""
    n = vnoise(x, y, 3.0, 131)
    c = mix(RK[3], RK[4], n)
    if _hash(x, y, 133) < .07: c = RK[2]
    elif _hash(x, y, 132) > .93: c = RK[5]
    if d == 0: c = RK[6]
    elif d == 1: c = mix(c, RK[5], .18)
    if d == t - 1: c = (36, 28, 36)
    elif d == t - 2: c = mix(c, (36, 28, 36), .3)
    return c


def timber_zone(x): return 250 <= x < 420                    # 가까운 단에서 갱목 널을 덧댄 구간


def back(a):
    for x in range(K.W):
        cy = ceil_y(x); ty = tier_y(x); band = 8 + int(2 * vnoise(x, 0, 9, 405)); yb = base_y(x)
        for y in range(0, cy):
            a[y, x] = VOIDM[0] if vnoise(x, y, 5, 142) < .5 else VOIDM[1]
        for y in range(cy, ty):                                          # 먼 단(어둡게)
            a[y, x] = mul(B.face_rock_px(x + 400, y - cy, ty - cy, SEED + 5, False, False), .72)
        for y in range(ty, ty + band):                                   # 바위 턱 윗면
            a[y, x] = band_px(x, y, y - ty, band)
        y0 = ty + band
        for y in range(y0, yb):                                          # 가까운 단
            fn = B.face_timber_px if timber_zone(x) else B.face_rock_px
            a[y, x] = fn(x, y - y0, yb - y0, SEED, False, False)
        a[cy, x] = (24, 18, 22)
        if x > 0 and abs(tier_y(x - 1) - ty) > 6:                        # 단 꺾임 모서리
            lo, hi = sorted((tier_y(x - 1), ty)); a[lo:hi + band, x] = (24, 18, 22)
    # 널 구간 양 끝 굵은 갱목 기둥(앞면 함수의 기둥 결을 세로로 길게)
    for x0 in (246, 416):
        for y in range(tier_y(x0) + 8, base_y(x0)):
            for dx in range(6):
                k = 5 if dx == 0 else (4 if dx < 3 else (3 if dx < 5 else 2))
                if y % 11 == 0: k -= 1
                a[y, x0 + dx] = WOODX[max(1, min(6, k))]
            a[y, x0 - 1] = WOODX[0]; a[y, x0 + 6] = WOODX[0]


def rails(a, y0):
    """뒤쪽 가로 레일(rails_cell E-W) + 갱도 입구로 갈라지는 T 자 한 칸 + 입구 안 남북 한 칸."""
    ew = M.rails_cell(0, 1, 0, 1, 0)
    for x in range(-8, K.W, 16):
        if x == MOUTH_X + 16: K.paste(a, M.rails_cell(1, 1, 0, 1, 0), x, y0)
        else: K.paste(a, ew if (x // 16) % 3 else M.rails_cell(0, 1, 0, 1, 2), x, y0)
    K.paste(a, M.rails_cell(1, 0, 1, 0, 0), MOUTH_X + 16, y0 - 16)


MOUTH_X = 316


def floor(a):
    B.PER = 640; rock = B.floor_rock(11); pack = B.floor_packed(31)                      # 같은 함수, 주기만 640(넓은 화면에서 반복 없음)
    B.PER = 48; grav = B.floor_gravel(21)
    rp, gp, pp = rock.load(), grav.load(), pack.load()
    def kind(x, y):
        """재질 경계는 화소 단위로 흔들리는 자연 경계(칸 네모 금지): 벽 밑 자갈 → 운반로 흙 → 가운데 바위, 가장자리 자갈 비탈."""
        yy = y - HZ
        if yy < 6 + 3 * vnoise(x, 0, 13, 410): return 'grav'
        if yy < 30 + 6 * vnoise(x, 0, 17, 411): return 'pack'
        edge = min(x, K.W - 1 - x)
        if edge < 92 + 18 * vnoise(0, y, 15, 413) - max(0, yy - 120) * .2: return 'grav'
        if abs(x - 330 - 10 * vnoise(0, y, 31, 414)) < 20 + 7 * vnoise(x, y, 11, 415) - yy * .06: return 'pack'
        return 'rock'
    for x in range(K.W):
        for y in range(base_y(x), K.H):
            k = kind(x, y)
            c = gp[x % 48, y % 48] if k == 'grav' else (pp[x % 640, y % 640] if k == 'pack' else rp[x % 640, y % 640])
            a[y, x] = c[:3]
        b = base_y(x)
        a[b, x] = (24, 18, 22)
        a[b + 1:b + 4, x] = (a[b + 1:b + 4, x] * .62).astype(np.uint8)
        a[b + 4:b + 9, x] = (a[b + 4:b + 9, x] * .8).astype(np.uint8)


def mouth(a, x0, ybot, W=48, H=48, k=1.0, seed=0):
    """mt_pieces.mine_mouth 사본을 넓힐 수 있게 고친 것: 바위 둔덕은 빼고(벽이 이미 있다) 아치 어둠·바깥 빛·갱목 틀·문턱·등불만."""
    wd = [mul(c, k) for c in WOODX]; y0 = ybot - H
    def put(x, y, c):
        if 0 <= x0 + x < K.W and 0 <= y0 + y < K.H: a[y0 + y, x0 + x] = mul(c, k) if k != 1.0 else c
    cx = W / 2.0
    for y in range(7, H - 2):
        for x in range(8, W - 8):
            dx = (x + .5 - cx) / ((W - 16) / 2.0)
            top = 9 + (1 - math.sqrt(max(0, 1 - dx * dx))) * (11 * H / 48)
            if y >= top: put(x, y, mix((10, 8, 14), (30, 22, 34), (y - top) / (40.0 * H / 48)))
    for y in range(H - 12, H - 2):
        for x in range(12, W - 12):
            if _hash(x, y, seed) < (y - (H - 12)) / 14.0 * .7: put(x, y, mix((30, 22, 34), (210, 190, 130), (y - (H - 12)) / 12.0))
    for y in range(12, H - 1):
        for dx in range(5):
            kk = 5 if dx == 0 else (4 if dx < 3 else (3 if dx < 4 else 2))
            put(7 + dx, y, WOODX[kk]); put(W - 12 + dx, y, WOODX[max(1, kk - 1)])
        put(6, y, WOODX[0]); put(W - 7, y, WOODX[0])
    for x in range(5, W - 5):
        dx = (x + .5 - cx) / ((W - 10) / 2.0)
        yy = 6 + int((1 - math.sqrt(max(0, 1 - dx * dx))) * (12 * H / 48))
        put(x, yy - 1, WOODX[0])
        for y in range(yy, yy + 4):
            kk = 5 if y == yy else (4 if y == yy + 1 else 3 if y == yy + 2 else 2)
            put(x, y, WOODX[kk])
        put(x, yy + 4, WOODX[0])
    for x in range(6, W - 6): put(x, H - 2, RK[5]); put(x, H - 1, RK[3])
    for y in range(14, 20): put(W - 6, y, IRON[3])
    for y in range(20, 25):
        for x in range(W - 8, W - 4): put(x, y, GOLD[5] if x < W - 6 else GOLD[4])


def inner_frames(a, cx, yb):
    """갱도 입구 안: 깊이 들어갈수록 작고 어두운 버팀틀 두 겹(timber_frame 결을 작게) — 갱도가 안으로 이어진다."""
    for (hw, h, k) in ((15, 30, .5), (9, 19, .32)):
        wd = [mul(c, k) for c in WOODX]
        top = yb - h
        for y in range(top, yb - 2):
            for dx in range(2):
                a[y, cx - hw + dx] = wd[4 - dx]; a[y, cx + hw - 1 - dx] = wd[3 - dx]
        for x in range(cx - hw, cx + hw):
            a[top, x] = wd[5]; a[top + 1, x] = wd[3]; a[top + 2, x] = wd[1]
        for x in range(cx - hw + 2, cx + hw - 2): a[yb - 2, x] = mul(RK[3], k)


def big_frame(a, xl, xr, ytop, ybot):
    """화면을 감싸는 가까운 갱목 버팀틀(timber_frame 의 기둥·보 결을 크게): 기둥 2, 윗보, 45° 버팀, 쇠 띠."""
    wd = WOODX
    def post(x0, w):
        for y in range(ytop + 10, ybot):
            for dx in range(w):
                k = 5 if dx == 0 else (4 if dx < w * .45 else (3 if dx < w * .8 else 2))
                if y % 11 == 0: k -= 1
                if _hash(x0 + dx, y, 7) < .07: k += 1
                if 0 <= x0 + dx < K.W: a[y, x0 + dx] = wd[max(1, min(6, k))]
            for xx in (x0 - 1, x0 + w):
                if 0 <= xx < K.W: a[y, xx] = wd[0]
        for y in range(ybot - 3, ybot + 1):                               # 발판 돌
            for dx in range(-3, w + 3):
                if 0 <= x0 + dx < K.W: a[y, x0 + dx] = RK[3] if y < ybot - 1 else (RK[2] if y < ybot else (24, 18, 22))
        K.ellipse_shadow(a, x0 + w // 2 + 4, ybot + 2, w // 2 + 8, 3, .6)
    post(xl, 14); post(xr - 14, 14)
    for x in range(0, K.W):                                               # 윗보: 윗면 2줄 + 앞면 9줄
        a[ytop, x] = wd[0]; a[ytop + 1, x] = wd[5]; a[ytop + 2, x] = wd[5] if x % 9 else wd[4]
        for y in range(ytop + 3, ytop + 12):
            k = 4 - (1 if y > ytop + 8 else 0)
            if x % 23 == 11: k -= 1
            if _hash(x, y, 9) < .06: k += 1
            a[y, x] = wd[max(1, min(6, k))]
        a[ytop + 12, x] = wd[0]
        a[ytop + 13, x] = mul(a[ytop + 13, x], .55); a[ytop + 14, x] = mul(a[ytop + 14, x], .75)
    for x in (24, 160, 320, 480, 616):                                    # 쇠 띠·못
        for y in range(ytop + 3, ytop + 12): a[y, x] = IRON[3]; a[y, x + 1] = IRON[1]
    for i in range(18):                                                   # 45° 버팀
        for (bx, by, c) in ((xl + 14 + i, ytop + 12 + i, wd[3]), (xl + 15 + i, ytop + 12 + i, wd[4]),
                            (xr - 15 - i, ytop + 12 + i, wd[2]), (xr - 16 - i, ytop + 12 + i, wd[3])):
            a[by, bx] = c
        a[ytop + 12 + i, xl + 16 + i] = wd[0]; a[ytop + 12 + i, xr - 17 - i] = wd[0]


def props(a):
    P = K.paste_bl
    # 먼 단: 위층 갱도 입구(어둡게) + 사다리 + 결정 빛
    mouth(a, 130, tier_y(150) + 1, k=.72, seed=2)
    P(a, M.ladder(3), 178, base_y(178) + 1, dim=.86)
    P(a, M.crystal('b', 1), 520, tier_y(530) + 3, dim=.8)
    # 가까운 단: 갱도 입구(정면 안쪽) + 버팀틀 + 등
    mouth(a, MOUTH_X - 8, base_y(MOUTH_X) + 1, W=64, H=60)
    inner_frames(a, MOUTH_X + 24, base_y(MOUTH_X) - 1)
    P(a, M.timber_frame(4, 3), 446, base_y(446) + 2, dim=.9)
    P(a, M.timber_frame(3, 3), 196, base_y(196) + 2, dim=.88)
    P(a, M.lantern_post(), 296, base_y(296) + 6); P(a, M.lantern_post(), 368, base_y(368) + 6)
    P(a, M.ore_vein_wall(0, 'b'), 540, 140); P(a, M.ore_vein_wall(1, 'b'), 120, 150)
    P(a, M.spiderweb(), 432, tier_y(432) + 12)
    rails(a, HZ + 8)
    P(a, M.minecart(True, 4), 470, HZ + 20)
    P(a, M.minecart(False), 234, HZ + 20, dim=.92)
    P(a, M.rail_buffer(), 520, HZ + 22) if False else None
    P(a, M.timber_stack(), 120, HZ + 18)
    P(a, M.crate_stack(), 560, HZ + 18)
    # 앞쪽 가장자리
    P(a, M.ore_pile('copper', 5), 30, 296)
    P(a, M.ore_pile('iron', 2), 70, 330)
    P(a, M.barrel_keg('powder'), 36, 342); P(a, M.barrel_keg('plain', 2), 54, 346)
    P(a, M.crystal('b', 2), 18, 262)
    P(a, M.pickaxe_stand(), 92, 276)
    P(a, M.ore_pile('gold', 3), 582, 300)
    P(a, M.crate_stack(1, 3), 598, 344)
    P(a, M.wheelbarrow(), 566, 330)
    P(a, M.crystal('a', 1), 616, 268)
    P(a, M.rubble(16, 12, 4), 104, 344); P(a, M.rubble(16, 12, 6), 540, 350)


def build(out):
    a = K.canvas(VOIDM[0])
    back(a)
    floor(a)
    props(a)
    big_frame(a, 6, 634, 10, 262)
    return K.finish(a, out)


if __name__ == '__main__':
    print(build(os.path.join(HERE, 'mine-shaft.png')))

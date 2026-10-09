# 대나무 숲 계곡 — 식생·바위·소품. 3/4(윗면 + 앞면), 빛 왼쪽 위, 톤 캔버스 + pz.fin 윤곽.
# 잎 결은 버들항 덤불 그림의 밝기 순위(leaf_tex, ek_props.foliage)를 그대로 쓴다. 대나무 줄기·잎 = TAKE 램프.
import math
import numpy as np
from bv_base import *
from bv_base import _hash
import ek_props as P
import ek_wave5 as W5
from ek_props import foliage, _blade


def _sh(im, cx, cy, rx, ry, a=55): return shadow_under(im, cx, cy, rx, ry, a)


# ================================================================ 대나무
def _culm(tc, x, lean, top, H, seed, back=False, cw=3, node=None):
    node = node or 9 + int(_hash(int(x), seed, 4) * 4)
    for y in range(top, H - 1):
        f = (H - y) / H
        cx = x + lean * f
        for i in range(cw):
            k = ((5, 4, 2) if cw == 3 else (4, 2))[i] - (1 if back else 0)
            if (y - top) % node == 0: k = 2 if i < cw - 1 else 1
            elif (y - top) % node == 1: k = 6 if i == 0 else 5
            tc.px(cx + i - 1, y, 'take', clamp(k, 1, 6))
    for i in range(-1, cw): tc.px(x + i - 1, H - 1, 'take', 2)
    return node


def bamboo_thicket(seed=0, w=4, h=7):
    """빽빽한 대숲 덩이 w x h 칸: 줄기 w*3 개(뒤 줄기는 2px·한 단 어둡게, 앞 줄기 3px), 위 3/5 에 잎 덩이 세 겹
    (뒤 = 어두운 덤불 결, 가운데 = 대나무 잎 결, 앞 = 마디마다 처진 가는 잎 다발). 대숲 속을 메우는 큰 덩이.
    맨 아랫줄만 막힌다(밑동), 위 칸은 걷기 + 가림."""
    W, H = w * 16, h * 16
    tc = TC(W, H, seed)
    n = w * 3
    culms = []
    for i in range(n):
        x = 3 + (W - 7) * (i + .1 + .8 * _hash(i, seed, 1)) / n
        lean = (_hash(i, seed, 2) - .5) * 9
        top = int(H * (.0 + .2 * _hash(i, seed, 3)))
        culms.append((x, lean, top, _hash(i, seed, 9) < .5))
    for j in range(4 + w * 2):                                               # 뒤 잎 덩이(빽빽하게)
        fx = W * (.08 + .84 * _hash(j, seed, 5)); fy = H * (.06 + .42 * _hash(j, seed, 15))
        foliage(tc, fx, fy, W * .2, H * .075, seed + j, mat='take', shift=-2)
    for (x, lean, top, back) in sorted(culms, key=lambda c: not c[3]):
        _culm(tc, x, lean, top, H, seed, back=back, cw=2 if back else 3)
    for j in range(2 + w):                                                   # 가운데 잎 덩이
        fx = W * (.12 + .76 * _hash(j, seed, 25)); fy = H * (.08 + .36 * _hash(j, seed, 35))
        foliage(tc, fx, fy, W * .15, H * .06, seed + 40 + j, mat='take', shift=0, blades=3)
    for ci, (x, lean, top, back) in enumerate(culms):                        # 마디마다 처진 잎 다발
        if back: continue
        node = 9 + int(_hash(int(x), seed, 4) * 4)
        for y in range(top + 2, int(H * .6), node):
            f = (H - y) / H; cx = x + lean * f
            for b in range(3 + int(_hash(ci, y, seed + 7) * 4)):
                side = -1 if (b + ci) % 2 else 1
                _blade(tc, cx + side, y, math.pi / 2 - side * (.5 + 1.0 * _hash(b, y, seed + 8)), 4 + int(_hash(b, y, seed + 9) * 4))
    for i in range(3):                                                       # 밑동 마른 잎
        bx = 4 + int(_hash(i, seed, 61) * (W - 10))
        for t in range(4): tc.px(bx + t, H - 2 - (t % 2), 'kare', 4 if t < 2 else 3)
    return _sh(tc.fin(.6), W // 2, H - 2, W // 2 - 3, 3, 60)


def bamboo_clump(seed=0, n=5, w=2, h=5):
    """작은 대나무 덤불(ek_props.bamboo 규칙) w x h 칸 — 대숲 가장자리·오솔길 곁. 밑동 줄만 막힘."""
    return P.bamboo(seed=seed, n=n, w=w, h=h)


def bamboo_single(seed=0):
    """홀로 선 키 큰 대나무 1x5칸: 굵은 줄기 하나(마디·빛 턱) + 꼭대기 가는 잎 다발 + 곁가지. 밑동만 막힘."""
    W, H = 16, 80
    tc = TC(W, H, seed)
    _culm(tc, 7, 2, 6, H, seed, cw=3, node=11)
    foliage(tc, 8, 10, 7, 6, seed, mat='take', shift=0, blades=5)
    foliage(tc, 6, 24, 5, 3, seed + 2, mat='take', shift=-1, blades=3)
    for y in range(14, 46, 11):
        for b in range(3):
            side = -1 if b % 2 else 1
            _blade(tc, 8 + side, y, math.pi / 2 - side * (.6 + .8 * _hash(b, y, seed)), 4 + b)
    return _sh(tc.fin(.6), 8, H - 2, 5, 2, 50)


def bamboo_shoots(seed=0):
    """죽순 1x1칸: 껍질 겹친 원뿔 셋(갈색 껍질 + 털 점 + 끝 초록) + 마른 잎. 땅 장식(걷기, 사람 아래)."""
    tc = TC(16, 16, seed)
    for (cx, by, hh, r) in ((5, 14, 9, 2.6), (11, 15, 6, 2.0), (8.5, 12, 4, 1.4)):
        for j in range(int(hh)):
            y = by - j; hw = r * (1 - j / hh) + .4
            for x in range(int(cx - hw), int(cx + hw) + 1):
                k = 5 if x < cx else 3
                if (j + int(x)) % 3 == 0: k -= 1
                tc.px(x, y, 'kare' if j < hh - 2 else 'take', clamp(k, 1, 6))
    return _sh(tc.fin(.7), 8, 14, 6, 1, 45)


def bamboo_stumps(seed=0):
    """베어 낸 대 그루터기 1x1칸: 비스듬히 잘린 대 셋(속 빈 마구리 = 어둠 + 밝은 테). 땅 장식."""
    tc = TC(16, 16, seed)
    for i, (x, h) in enumerate(((3, 7), (8, 10), (12, 5))):
        for y in range(15 - h, 15):
            tc.px(x, y, 'take', 5); tc.px(x + 1, y, 'take', 4); tc.px(x + 2, y, 'take', 2)
            if (y + i) % 6 == 0: tc.px(x, y, 'take', 2)
        tc.px(x, 14 - h, 'kare', 6); tc.px(x + 1, 14 - h, 'dark', 1); tc.px(x + 2, 15 - h, 'kare', 4)
    return _sh(tc.fin(.7), 8, 14, 6, 1, 45)


def fallen_bamboo(seed=0):
    """쓰러진 대나무 3x1칸: 땅에 누운 굵은 대 둘(마디 줄 · 윗모 빛) + 마른 잎 몇. 아랫줄 막힘(넘어 가지 못한다)."""
    W, H = 48, 16
    tc = TC(W, H, seed)
    for (y0, x0, x1) in ((6, 1, 46), (10, 4, 42)):
        for x in range(x0, x1):
            yy = y0 + int((x - x0) * .06)
            tc.px(x, yy, 'take', 6); tc.px(x, yy + 1, 'take', 4); tc.px(x, yy + 2, 'take', 2)
            if (x - x0) % 11 == 0: tc.px(x, yy, 'take', 3); tc.px(x, yy + 1, 'take', 2)
        tc.px(x0, y0 + 1, 'kare', 6)
    for i in range(5):
        x = 4 + int(_hash(i, seed, 2) * 38)
        for t in range(4): tc.px(x + t, 13 + (t % 2), 'kare', 5 - t // 2)
    return _sh(tc.fin(.6), 24, 14, 22, 2, 50)


def bamboo_bundle(seed=0):
    """베어 묶어 세워 둔 대나무 다발 2x3칸(나무에 기댄 장대 묶음 + 새끼 띠 둘). 밑동 줄만 막힘."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for i in range(7):
        x0 = 8 + i * 2.4; lean = 4 + i * .6
        for y in range(2 + i % 3, H - 1):
            f = (H - y) / H
            x = x0 + lean * f
            tc.px(x, y, 'take', 5 if i % 2 == 0 else 4); tc.px(x + 1, y, 'take', 2)
            if (y + i * 3) % 12 == 0: tc.px(x, y, 'take', 2)
    for yy in (16, 34):
        for x in range(8, 28):
            f = (H - yy) / H
            if 7 + 4 * f <= x <= 26 + 8 * f: tc.px(x, yy, 'kare', 5); tc.px(x, yy + 1, 'kare', 2)
    return _sh(tc.fin(.6), 16, H - 2, 10, 2, 50)


# ================================================================ 풀·나무
def fern(seed=0):
    """고사리 덤불 1x1칸: 가운데에서 펼쳐진 깃꼴 잎 다섯(잎줄기 + 양옆 작은 잎). 걷기(사람 아래), 대숲 그늘·물가."""
    tc = TC(16, 16, seed)
    for f in range(5):
        a = math.pi * (1.05 + f * .22) + (_hash(f, seed, 1) - .5) * .2
        L = 6 + int(_hash(f, seed, 2) * 3)
        for t in range(L):
            x = 8 + math.cos(a) * t; y = 13 + math.sin(a) * t * .8 + t * t * .05
            tc.px(x, y, 'leaf', 4 if t < L - 2 else 5)
            if t % 2 == 1 and t < L - 1:
                tc.px(x - math.sin(a) * 1.5, y + 1, 'leaf', 3); tc.px(x + math.sin(a) * 1.5, y - 1, 'leaf', 5)
    return tc.fin(.7)


def reeds(seed=0):
    """물가 갈대 1x2칸: 가는 잎 줄기 여럿(곧게 + 끝이 휜다) + 이삭 셋(볏짚 빛). 밑동만 막힘. 개울 둑 곁에 2~4개 덩이."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for i in range(7):
        x0 = 2 + i * 1.8 + _hash(i, seed, 1); top = 6 + int(_hash(i, seed, 2) * 12); bend = (_hash(i, seed, 3) - .5) * 5
        for y in range(top, H - 1):
            f = (H - y) / (H - top)
            tc.px(x0 + bend * f * f, y, 'leaf', 5 if i % 2 == 0 else 3)
        if i % 2 == 0:
            for j in range(4): tc.px(x0 + bend, top - j, 'kare', 6 - j // 2)
    return _sh(tc.fin(.6), 8, H - 2, 6, 2, 45)


def maple_red(seed=0):
    """단풍나무 3x4칸: 가는 줄기(갈래 둘) + 붉은 단풍 잎 덩이 셋(낙엽 램프 aki, 버들항 덤불 결). 밑동 칸만 막힘.
    대숲 사이 붉은 점 — 계곡 오솔길 곁에 하나둘만."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    for y in range(28, H - 1):
        f = (H - y) / (H - 28)
        x = 22 + math.sin(f * 2 + seed) * 2
        for i in range(4): tc.px(x + i, y, 'wood', (5, 4, 3, 2)[i])
    for (x0, y0, x1, y1) in ((23, 36, 12, 22), (25, 34, 36, 20)):
        for t in range(16):
            u = t / 15.0; tc.px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 'wood', 3); tc.px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + 1, 'wood', 2)
    foliage(tc, 24, 22, 20, 14, seed, mat='aki', shift=0)
    foliage(tc, 12, 26, 10, 7, seed + 1, mat='aki', shift=-1)
    foliage(tc, 36, 24, 10, 8, seed + 2, mat='aki', shift=-1)
    foliage(tc, 20, 14, 10, 6, seed + 3, mat='aki', shift=1)
    return _sh(tc.fin(.6), 24, H - 2, 12, 3, 60)


def cliff_pine(seed=0):
    """바위 위 소나무 4x5칸: 이끼 낀 바위 덩이(아래 2줄) 위에 굽은 정원 소나무. 바위 아랫줄만 막힘. 개울가·폭포 곁 앵커."""
    W, H = 64, 80
    pine = P.matsu(seed=seed + 3, flip_=bool(seed % 2))
    tc = TC(W, 30, seed)
    W5._rock(tc, 6, 4, 52, 26, seed + 1, mossy=.5)
    rock = tc.fin(.6)
    out = Image.new('RGBA', (W, H)); out.alpha_composite(pine.crop((0, 0, 64, 70)), (0, -6)); out.alpha_composite(rock, (0, H - 30))
    return _sh(out, 32, H - 2, 24, 3, 60)


# ================================================================ 바위
def boulder(seed=0, w=2, h=2, mossy=.4):
    """이끼 낀 바위 w x h 칸(ek_wave5._rock 규칙: 윗면 빛 · 앞면 한 단 어둡게 · 밑 평평). 아랫줄 막힘."""
    tc = TC(w * 16, h * 16, seed)
    W5._rock(tc, 1, 3, w * 16 - 2, h * 16 - 4, seed + 1, mossy=mossy)
    return _sh(tc.fin(.6), w * 8, h * 16 - 2, w * 8 - 2, 2, 55)


def rock_pair(seed=0):
    """물가 바위 무리 3x2칸: 큰 바위 하나 + 작은 돌 둘(윗면 이끼), 밑에 자갈. 아랫줄 막힘."""
    tc = TC(48, 32, seed)
    for x in range(2, 46):
        for y in range(28, 31):
            if _hash(x, y, seed + 9) < .5: tc.px(x, y, 'stone', 5 if (x + y) % 2 else 3)
    W5._rock(tc, 4, 4, 24, 26, seed + 1, mossy=.45, tall=True)
    W5._rock(tc, 27, 15, 14, 14, seed + 2, mossy=.3)
    W5._rock(tc, 38, 22, 9, 8, seed + 3, mossy=.2)
    return _sh(tc.fin(.6), 24, 29, 21, 2, 55)


def rock_flat(seed=0):
    """앉는 너럭바위 2x1칸: 넓고 낮은 평평한 바위(윗면 넓게 빛, 앞면 얇게). 칸 막힘(위에 앉는 이벤트)."""
    tc = TC(32, 16, seed)
    for y in range(3, 16):
        for x in range(1, 31):
            u = (x + .5 - 16) / 15.0
            if abs(u) > 1 - .3 * max(0, (y - 12) / 4) - .08 * _hash(x // 3, seed, 1): continue
            if y < 4 and abs(u) > .8: continue
            k = (6 if u < -.3 else 5) if y < 10 else (3 if y < 14 else 2)
            if u > .55 and y < 10: k = 4
            if _hash(x, y, seed + 2) < .08: k -= 1
            m = 'koke' if y < 6 and _hash(x // 2, y, seed + 3) < .25 else 'stone'
            tc.px(x, y, m, clamp(k, 1, 6))
    return _sh(tc.fin(.6), 16, 14, 14, 2, 55)


def rock_small(seed=0):
    """작은 돌 1x1칸(이끼 점). 칸 막힘. 길가·물가에 드문드문."""
    tc = TC(16, 16, seed)
    W5._rock(tc, 2, 4, 12, 11, seed + 1, mossy=.35)
    return _sh(tc.fin(.6), 8, 14, 6, 1, 50)


def river_rock(seed=0):
    """물속 바위 1x1칸(물 칸 위 장식): 젖은 바위 머리(물때 sei) + 둘레 흰 물살 테. 물 칸이라 원래 막힘."""
    tc = TC(16, 16, seed)
    for y in range(3, 14):
        for x in range(2, 14):
            u = (x + .5 - 8) / 6.0; v = (y + .5 - 8) / 5.0
            if u * u + v * v > 1: continue
            k = 5 if (u < 0 and v < 0) else (4 if v < .3 else 2)
            tc.px(x, y, 'sei' if v > .2 else 'stone', k)
    for x in range(1, 15):
        if _hash(x, 0, seed) < .7: tc.px(x, 13 + (x % 2), 'kasumi', 6)
    tc.px(0, 12, 'kasumi', 5); tc.px(15, 12, 'kasumi', 5)
    return tc.fin(.7)


def stepping_stones(seed=0):
    """징검다리 돌 1x1칸(물 칸 위에 얹는다): 납작한 큰 돌 하나(윗면 빛 넓게 + 앞 모 젖은 그늘) + 둘레 물살. 이 칸은 걷기로 연다."""
    tc = TC(16, 16, seed)
    cx = 8 + (_hash(seed, 1, 2) - .5) * 2; cy = 8
    for y in range(2, 15):
        for x in range(1, 15):
            u = (x + .5 - cx) / 6.4; v = (y + .5 - cy) / 5.0
            d = u * u + v * v
            if d > 1 - .1 * _hash(x // 2, y // 2, seed): continue
            k = 6 if (u < -.2 and v < -.2) else (5 if v < .35 else (3 if v < .7 else 2))
            m = 'sei' if v >= .7 else 'stone'
            tc.px(x, y, m, k)
    for x in range(2, 14):
        if _hash(x, 3, seed) < .6: tc.px(x, 14, 'kasumi', 6)
    return tc.fin(.7)

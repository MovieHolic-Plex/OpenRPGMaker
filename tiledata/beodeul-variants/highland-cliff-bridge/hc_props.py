# 고원 절벽과 하늘 다리 — 식생·바위·소품. 3/4(윗면 + 앞면), 빛 왼쪽 위, 톤 캔버스 + pz.fin 윤곽.
# 잎 결 = 버들항 덤불 그림의 밝기 순위(ek_props.foliage → leaf_tex). 활엽수·전나무 잎 = sage(회녹색), 낙엽 덤불 = aki, 바위 = dan / 버들항 돌.
import math
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash, _cell
import ek_props as EP
from ek_props import foliage
import hc_cliff as HC
import hc_ground as HG


def _sh(im, cx, cy, rx, ry, a=55): return shadow_under(im, cx, cy, rx, ry, a)


def _trunk(tc, cx, ytop, ybot, r0, r1, seed, flare=3):
    """줄기: 위 반지름 r0 → 밑 r1, 왼쪽 빛 · 오른쪽 그늘, 껍질 결(세로 짧은 금), 밑동은 뿌리로 벌어진다."""
    for y in range(int(ytop), int(ybot)):
        f = (y - ytop) / max(1, ybot - ytop)
        r = r0 + (r1 - r0) * f + (flare * max(0, f - .8) / .2 if f > .8 else 0)
        for x in range(int(cx - r), int(cx + r) + 1):
            u = (x + .5 - (cx - r)) / (2 * r + 1)
            k = 5 if u < .25 else (4 if u < .5 else (3 if u < .8 else 2))
            if _hash(x, y // 3, seed + 3) < .14: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))


# ================================================================ 나무
def oak_big(seed=0):
    """활엽 큰 나무 3x4칸: 굵은 줄기 + 뿌리 벌림, 둥글고 울퉁불퉁한 회녹색 수관(잎 덩이 다섯 겹, 속 그늘·가지 틈) — 버들항 덤불 결.
    밑동 칸(가운데 아랫줄)만 막힌다. 고원 가장자리 전망 자리·길 갈림의 앵커."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    _trunk(tc, 23.5, 34, H - 2, 3.2, 4.2, seed, flare=3.5)
    for (x0, y0, x1, y1) in ((22, 40, 12, 30), (25, 38, 36, 28), (23, 36, 22, 24)):
        for t in range(14):
            u = t / 13.0; tc.px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 'wood', 3); tc.px(x0 + (x1 - x0) * u + 1, y0 + (y1 - y0) * u, 'wood', 2)
    foliage(tc, 24, 24, 21, 15, seed, mat='sage', shift=0)
    foliage(tc, 12, 28, 10, 8, seed + 1, mat='sage', shift=-1)
    foliage(tc, 36, 27, 11, 8, seed + 2, mat='sage', shift=-1)
    foliage(tc, 19, 14, 11, 7, seed + 3, mat='sage', shift=1)
    foliage(tc, 31, 16, 9, 6, seed + 4, mat='sage', shift=0)
    for i in range(5):                                                       # 수관 속 가지 틈(짙은 잎 그늘 + 가지 토막)
        gx = 12 + int(_hash(i, 1, seed + 7) * 24); gy = 18 + int(_hash(i, 2, seed + 7) * 14)
        for d in range(3):
            tc.px(gx + d, gy, 'sage', 1); tc.px(gx + d - 1, gy + 1, 'sage', 2)
        tc.px(gx + 1, gy + 1, 'wood', 2)
    return _sh(tc.fin(.6), 24, H - 2, 13, 3, 60)


def oak_small(seed=0):
    """어린 활엽수 2x3칸: 가는 줄기 + 동그란 회녹색 수관 둘. 밑동만 막힘."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    _trunk(tc, 15.5, 26, H - 2, 1.6, 2.2, seed, flare=1.5)
    foliage(tc, 16, 18, 14, 11, seed, mat='sage', shift=0)
    foliage(tc, 11, 12, 7, 5, seed + 1, mat='sage', shift=1)
    foliage(tc, 22, 21, 7, 5, seed + 2, mat='sage', shift=-1)
    return _sh(tc.fin(.6), 16, H - 2, 9, 2, 55)


def fir_tall(seed=0, h=4):
    """가는 전나무 1x h칸(위로 길다): 아래가 넓은 잎 덩이 층(버들항 덤불 결, 회녹색 sage)을 아래 층부터 겹쳐 쌓는다 — 층마다 밑이 평평하고
    짙어서 처진 가지 층이 읽힌다. 꼭대기는 가는 순, 밑동 줄기만 조금 보인다. 밑동만 막힘. 고원 가장자리·비탈 위에 하나둘."""
    W, Hh = 16, h * 16
    tc = TC(W, Hh, seed)
    for y in range(Hh - 9, Hh - 1):
        tc.px(7, y, 'wood', 3); tc.px(8, y, 'wood', 2)
    n = 2 * h + 1
    for i in reversed(range(n)):
        f = i / (n - 1)
        cy = 5 + f * (Hh - 16)
        rx = 2.4 + f * 5.0; ry = 3.8 + f * 1.8
        foliage(tc, 8 + (_hash(i, 0, seed) - .5) * 1.2, cy, rx, ry, seed + i, mat='sage', shift=-2 if i % 2 else -1, flat=True)
    for (dx, dy, k) in ((0, 0, 5), (0, 1, 4), (1, 1, 3), (0, 2, 4), (1, 2, 3)):
        tc.px(7 + dx, dy, 'sage', k)
    return _sh(tc.fin(.6), 8, Hh - 2, 6, 2, 50)


def fir_young(seed=0):
    """어린 전나무 1x2칸. 밑동만 막힘."""
    return fir_tall(seed, h=2)


# ================================================================ 바위
def _dan_rock(tc, x0, y0, w, h, seed, top=.42):
    """주황 바위 덩이(3/4, 둥글게): 혹 서넛이 겹친 둥근 덩이 — 면마다 왼 위 빛 · 오른 아래 그늘, 결 = 절벽 비늘 돌(cliff_k) 을 한 단 흐리게,
    윗모에 풀 술 점, 밑 두 줄 짙게(땅에 닿는 그늘)."""
    lumps = [(x0 + w * .38, y0 + h * .55, w * .40, h * .48), (x0 + w * .66, y0 + h * .62, w * .34, h * .40),
             (x0 + w * .5, y0 + h * .35, w * .30, h * .33)]
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            best = None
            for (cx, cy, rx, ry) in lumps:
                u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
                if v > 0: v *= .7
                d = u * u + v * v
                if d <= 1 - .12 * _hash(x // 2, y // 2, seed + 7) and (best is None or v < best[1]): best = (u, v, d)
            if best is None: continue
            u, v, d = best
            l = -(u * .55 + v * .85)
            t = HC.cliff_k(x + seed * 37, y, 20, 48, seed)
            k = 3.4 + 1.8 * l + (t - 3.5) * .45
            if d > .82 and l < 0: k -= 1
            if y >= y0 + h - 2: k = 2
            if v < -.65 and _hash(x // 2, y, seed + 4) < .25: tc.px(x, y, 'leaf', 4); continue
            tc.px(x, y, 'dan', clamp(int(round(k)), 1, 6))


def boulder_dan(seed=0, w=2, h=2):
    """주황 바위 w x h칸(절벽에서 떨어져 나온 덩이). 아랫줄 막힘."""
    tc = TC(w * 16, h * 16, seed)
    _dan_rock(tc, 1, 3, w * 16 - 2, h * 16 - 4, seed)
    return _sh(tc.fin(.6), w * 8, h * 16 - 2, w * 8 - 2, 2, 55)


def rock_pair(seed=0):
    """바위 무리 3x2칸: 주황 큰 바위 + 회색 돌 둘(버들항 돌) + 밑 자갈. 아랫줄 막힘."""
    tc = TC(48, 32, seed)
    for x in range(2, 46):
        for y in range(28, 31):
            if _hash(x, y, seed + 9) < .45: tc.px(x, y, 'stone', 5 if (x + y) % 2 else 3)
    _dan_rock(tc, 3, 4, 26, 26, seed + 1, top=.35)
    import ek_wave5 as W5
    W5._rock(tc, 27, 15, 14, 14, seed + 2, mossy=.2)
    W5._rock(tc, 38, 22, 9, 8, seed + 3, mossy=.1)
    return _sh(tc.fin(.6), 24, 29, 21, 2, 55)


def rock_small(seed=0):
    """작은 돌 1x1칸(회색 돌, 풀 점). 칸 막힘. 길가·절벽 발치에 드문드문."""
    import ek_wave5 as W5
    tc = TC(16, 16, seed)
    W5._rock(tc, 2, 4, 12, 11, seed + 1, mossy=.15)
    return _sh(tc.fin(.6), 8, 14, 6, 1, 50)


def pebbles(seed=0):
    """잔돌 1x1칸 땅 장식(걷기): 회색 잔돌 3~5 + 주황 부스러기."""
    tc = TC(16, 16, seed)
    for i in range(3 + int(_hash(seed, 0, 1) * 3)):
        x = 2 + int(_hash(i, 1, seed) * 11); y = 4 + int(_hash(i, 2, seed) * 9)
        m = 'stone' if _hash(i, 3, seed) > .35 else 'dan'
        tc.px(x, y, m, 5); tc.px(x + 1, y, m, 4); tc.px(x, y + 1, m, 3); tc.px(x + 1, y + 1, m, 2)
    return tc.fin(.7)


# ================================================================ 덤불·풀·꽃
def bush_round(seed=0):
    """둥근 덤불 2x2칸(풀색 잎 덩이 셋). 아랫줄 막힘."""
    tc = TC(32, 32, seed)
    foliage(tc, 16, 19, 14, 10, seed, mat='leaf', shift=-1)
    foliage(tc, 10, 15, 7, 6, seed + 1, mat='leaf', shift=0)
    foliage(tc, 21, 13, 7, 5, seed + 2, mat='leaf', shift=1)
    return _sh(tc.fin(.6), 16, 30, 12, 2, 55)


def bush_autumn(seed=0):
    """주황 낙엽 덤불 2x2칸(물든 잎 덩이 aki + 마른 잎 점). 아랫줄 막힘. 절벽 발치·바위 곁에 하나둘."""
    tc = TC(32, 32, seed)
    foliage(tc, 16, 20, 14, 9, seed, mat='leaf', shift=-2)                    # 밑은 아직 푸른 잎(바위와 구별된다)
    foliage(tc, 15, 16, 12, 8, seed + 3, mat='aki', shift=0)
    foliage(tc, 9, 13, 6, 5, seed + 1, mat='aki', shift=1)
    foliage(tc, 22, 12, 6, 5, seed + 2, mat='aki', shift=1)
    for i in range(6):                                                       # 잎 끝 노란 점
        tc.px(5 + int(_hash(i, 1, seed) * 22), 8 + int(_hash(i, 2, seed) * 12), 'aki', 6)
    return _sh(tc.fin(.6), 16, 30, 12, 2, 55)


def bush_small(seed=0):
    """작은 덤불 1x1칸(풀색). 칸 막힘."""
    tc = TC(16, 16, seed)
    foliage(tc, 8, 9, 7, 6, seed, mat='leaf', shift=-1)
    foliage(tc, 6, 7, 4, 3, seed + 1, mat='leaf', shift=1)
    return _sh(tc.fin(.6), 8, 14, 6, 1, 50)


def tallgrass(seed=0):
    """키 큰 풀 포기 1x1칸 땅 장식(걷기, 사람 아래): 큰 포기 둘 + 작은 포기."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    HG.tuft(rgb, al, 4 + int(_hash(seed, 1, 3) * 3), 12, True)
    HG.tuft(rgb, al, 10 + int(_hash(seed, 2, 3) * 3), 14, True)
    HG.tuft(rgb, al, 8, 9, False)
    return _cell(rgb, al)


def flowers_white(seed=0):
    """흰 별꽃 1x1칸 땅 장식(걷기): 다섯 잎 흰 꽃 2~4 + 잎."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    for i in range(2 + int(_hash(seed, 0, 5) * 3)):
        fx = 1 + int(_hash(i, 1, seed) * 11); fy = 2 + int(_hash(i, 2, seed) * 10)
        for (dx, dy, c) in ((1, 0, WASHI[6]), (0, 1, WASHI[5]), (2, 1, WASHI[5]), (1, 2, WASHI[4]), (1, 1, GOLD[5]),
                            (0, 3, GRa[3]), (2, 3, GRa[4]), (1, 3, GRa[2])):
            x_, y_ = fx + dx, fy + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = c; al[y_, x_] = True
    return _cell(rgb, al)


# ================================================================ 소품
def stump(seed=0):
    """그루터기 1x1칸: 나이테 윗면(빛) + 껍질 앞면 + 뿌리. 칸 막힘."""
    tc = TC(16, 16, seed)
    for y in range(5, 15):
        for x in range(3, 13):
            u = (x + .5 - 8) / 5.0
            if abs(u) > 1: continue
            if y < 8:
                v = (y + .5 - 6.5) / 2.0
                if u * u + v * v > 1: continue
                r = math.hypot(u, v * 1.6)
                k = 5 if int(r * 3) % 2 == 0 else 4
                tc.px(x, y, 'wood', k)
            else:
                tc.px(x, y, 'wood', 4 if u < -.3 else (3 if u < .4 else 2))
    tc.px(2, 14, 'wood', 3); tc.px(13, 14, 'wood', 2); tc.px(1, 15, 'wood', 2)
    return _sh(tc.fin(.6), 8, 14, 6, 1, 50)


def log_fallen(seed=0):
    """쓰러진 통나무 3x1칸(가로): 둥근 앞면 + 끝 나이테 + 이끼 점. 칸 막힘."""
    tc = TC(48, 16, seed)
    for y in range(4, 15):
        for x in range(3, 46):
            v = (y + .5 - 9.5) / 5.5
            if abs(v) > 1: continue
            k = 5 if v < -.4 else (4 if v < .2 else (3 if v < .7 else 2))
            if _hash(x // 3, y, seed + 1) < .15: k -= 1
            if v < -.3 and _hash(x // 2, y, seed + 2) < .12: tc.px(x, y, 'leaf', 4); continue
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for y in range(4, 15):
        for x in range(42, 47):
            u = (x + .5 - 44) / 2.4; v = (y + .5 - 9.5) / 5.5
            if u * u + v * v <= 1: tc.px(x, y, 'wood', 6 if int(math.hypot(u, v) * 3) % 2 == 0 else 5)
    return _sh(tc.fin(.6), 24, 14, 20, 1, 50)


def signpost(seed=0):
    """길 갈림 표지 말뚝 1x2칸(글자 없음): 말뚝 + 화살 모양 판 둘(서로 다른 쪽을 가리킨다, 판에 못 점). 밑동만 막힘."""
    tc = TC(16, 32, seed)
    for y in range(6, 31):
        tc.px(7, y, 'wood', 4); tc.px(8, y, 'wood', 2)
    for (yy, d) in ((8, 1), (15, -1)):
        for y in range(yy, yy + 5):
            for x in range(2, 14):
                xe = x - 2 if d < 0 else 13 - x
                tip = 2 - abs(y - (yy + 2))
                if xe < tip: continue
                k = 5 if y == yy else (4 if y < yy + 4 else 2)
                tc.px(x, y, 'wood', k)
        tc.px(7, yy + 2, 'nuri', 2)
    return _sh(tc.fin(.6), 8, 30, 4, 1, 50)


def cairn(seed=0):
    """돌무더기 길 표지 1x2칸: 납작한 돌 다섯을 쌓았다(아래가 넓다, 돌마다 윗모 빛). 밑동만 막힘. 계단 위·다리 끝."""
    tc = TC(16, 32, seed)
    y = 30
    for i, (w, h) in enumerate(((14, 5), (12, 4), (10, 4), (8, 4), (6, 3))):
        x0 = 8 - w / 2 + (_hash(i, 0, seed) - .5) * 2
        for yy in range(y - h, y):
            for xx in range(int(x0), int(x0 + w)):
                u = (xx + .5 - (x0 + w / 2)) / (w / 2)
                if abs(u) > 1 - (.3 if yy in (y - h, y - 1) else 0): continue
                k = (6 if u < -.2 else 5) if yy == y - h else (4 if u < .2 else 3)
                if yy == y - 1: k = 2
                tc.px(xx, yy, 'stone' if i % 2 == 0 else 'dan', k if i % 2 == 0 else clamp(k - 1, 1, 6))
        y -= h
    return _sh(tc.fin(.6), 8, 30, 6, 1, 50)


def fence_short(seed=0, w=3):
    """낮은 나무 울타리 w x 1칸(말뚝 + 가로대 둘, 가로대 끝 말뚝). 칸 막힘. 밭·마당 가장자리에 짧게."""
    tc = TC(w * 16, 16, seed)
    for x in range(1, w * 16 - 1, 8):
        for y in range(2, 15):
            tc.px(x, y, 'wood', 5 if y < 4 else 4); tc.px(x + 1, y, 'wood', 2)
    for (yy, k) in ((5, 5), (6, 3), (10, 4), (11, 2)):
        for x in range(0, w * 16): tc.px(x, yy, 'wood', k)
    return _sh(tc.fin(.6), w * 8, 14, w * 8 - 2, 1, 45)


def hanging_vines(seed=0):
    """절벽 앞면에 늘어진 덩굴 1x2칸 장식(앞면 위에 겹친다): 줄기 4~6 가닥이 위에서 늘어지고 잎 점이 매달린다. 걷기 판정 없음(앞면 위)."""
    tc = TC(16, 32, seed)
    for i in range(5):
        x = 1 + i * 3 + int(_hash(i, 0, seed) * 2); L = 12 + int(_hash(i, 1, seed) * 18)
        for y in range(L):
            xx = x + int(1.2 * math.sin(y / 4 + i))
            tc.px(xx, y, 'leaf', 2)
            if y % 3 != 2:
                tc.px(xx + 1, y, 'leaf', 5 if y % 3 == 0 else 4); tc.px(xx - 1, y, 'leaf', 4 if y % 3 == 0 else 3)
            if y == L - 1: tc.px(xx, y + 1, 'leaf', 4)
    return tc.fin(.7)


def cliff_roots(seed=0):
    """절벽 앞면에 드러난 뿌리 1x1칸 장식: 굽은 갈색 뿌리 둘 + 흙 부스러기. 앞면 위에 겹친다."""
    tc = TC(16, 16, seed)
    for i in range(2):
        x = 3 + i * 7
        for y in range(14):
            xx = x + int(2 * math.sin(y / 3.0 + i * 2))
            tc.px(xx, y, 'wood', 4); tc.px(xx + 1, y, 'wood', 2)
    return tc.fin(.7)


def cloud_bank(seed=0, w=4, h=2):
    """하늘 칸 위 큰 구름 덩이 w x h칸(맨 위 장식, 걷기 판정 없음 — 하늘 칸은 원래 막힘)."""
    return HG.cloud_bank(w, h, seed)


def bridge_post(seed=0):
    """다리 끝 굵은 기둥 1x2칸(바랜 회색 널판 기둥 + 밧줄 감김). 밑동만 막힘. 다리 양 끝 고원 쪽에 짝으로."""
    tc = TC(16, 32, seed)
    for y in range(4, 31):
        for i in range(6): tc.px(5 + i, y, 'nuri', (6, 5, 4, 4, 3, 2)[i] if y > 5 else 6)
    for y in (10, 12, 14):
        for x in range(4, 12): tc.px(x, y, 'kaya', 5 if x < 8 else 3)
    return _sh(tc.fin(.6), 8, 30, 5, 1, 50)


if __name__ == '__main__':
    import os
    ims = [oak_big(1), oak_small(2), fir_tall(3), fir_young(4), boulder_dan(5), rock_pair(6), rock_small(7), pebbles(8), bush_round(9),
           bush_autumn(10), bush_small(11), tallgrass(12), flowers_white(13), stump(14), log_fallen(15), signpost(16), cairn(17),
           fence_short(18), hanging_vines(19), cliff_roots(20), cloud_bank(21), bridge_post(22)]
    W = sum(i.width + 6 for i in ims); H = max(i.height for i in ims)
    base = HG.grass_mix(W, H, 3)
    o = Image.fromarray(base.astype(np.uint8), 'RGB').convert('RGBA'); x = 0
    for i in ims: o.alpha_composite(i, (x, H - i.height)); x += i.width + 6
    o.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'props.png'))

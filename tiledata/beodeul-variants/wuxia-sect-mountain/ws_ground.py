# 산중 무림 문파 — 맨 바탕 표본(ground-*) 화소 함수. 모두 주기 16/48 이라 3x3(48x48) 표본을 이어 붙여도 이음새가 없다.
#   연무장 판석(ground-court): 버들항 돌 램프 큰 네모 판석 바른 줄쌓기(24x12, 줄마다 반 장 엇갈림), 판마다 톤, 1px 줄눈, 모 빛/그늘, 드문 금·이끼 줄눈.
#   산 풀(ground-mtngrass): 칩셋 잔디(0,128) 위에 짙은 산 풀 포기 + 드문 흰·노란 들꽃.
#   흙 산길(ground-trail): 칩셋 흙(16,224) 그대로 + 굵은 자갈(빛 + 아래 그늘) + 드문 뿌리.
#   암반(ground-bedrock): 산 화강암 램프에 칩셋 바위 결(336,336) + 금 + 잔돌.
#   돌계단 판(ground-stairstone): 4px 디딤판·챌판 줄(가로로 이어 깔면 넓은 계단 판).
import numpy as np
from PIL import Image
from ws_base import *
from ws_base import _hash
import ground as G

STa = np.array(ST, int)


def _img(rgb, al=None):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    if al is None: return Image.fromarray(rgb, 'RGB').convert('RGBA')
    return Image.fromarray(np.dstack([rgb, np.where(al, 255, 0).astype(np.uint8)]), 'RGBA')


# ---------------------------------------------------------------- 연무장 판석
def court_k(X, Y, seed=5, sw=24, sh=16, per=48):
    """큰 네모 판석 바른 줄쌓기 톤(1..6): 판 24x16, 줄마다 8px 씩 밀린다(세 줄이면 한 바퀴 → 주기 48, 이음새 없음).
    판마다 톤(대개 4·5, 드물게 3), 1px 줄눈(톤 2), 위·왼 모 빛 · 아래·오른 모 그늘, 칩셋 바위 결 잔 점, 드문 금."""
    row = (Y // sh) % (per // sh); ly = Y % sh
    off = (row * 8) % sw
    XX = (X + off) % per; col = XX // sw; lx = XX % sw
    h = hash2(col + row * 7, row, seed)
    k = np.where(h > .6, 5, 4) - (h < .12).astype(int)
    g = chip_tones_lin(336, 336, 0, 6)[Y % 16, X % 16]
    k = np.where((g <= 1) & (hash2(X, Y, seed + 3) < .45), k - 1, k)
    k = np.where((g >= 6) & (hash2(X, Y, seed + 4) < .3), k + 1, k)
    k = np.where((ly == 0) | (lx == 0), k + 1, k)
    k = np.where((ly == sh - 2) | (lx == sw - 2), k - 1, k)
    k = np.where((ly == sh - 1) | (lx == sw - 1), 2, k)
    crack = (hash2(col + row * 7, row, seed + 7) > .82) & (np.abs((lx - 5 - (h * 10).astype(int)) - (ly - 3) * 1.4) < .6) & (ly > 2) & (ly < sh - 3)
    k = np.where(crack, 2, k)
    return np.clip(k, 1, 6)


def court_rgb(X, Y, seed=5):
    k = court_k(X, Y, seed)
    rgb = STa[k]
    # 줄눈 이끼(판석 틈 몇 군데 — 산 습기)
    row = (Y // 16) % 3; ly = Y % 16; XX = (X + (row * 8) % 24) % 48
    joint = (ly == 15) | (XX % 24 == 23)
    moss = joint & (hash2(XX // 6, Y // 6, seed + 11) > .8)
    rgb = np.where(moss[..., None], KOKEa[np.where(hash2(X, Y, seed + 12) > .5, 4, 3)], rgb)
    return rgb


def ground_court():
    Y, X = np.mgrid[0:48, 0:48]; return _img(court_rgb(X, Y))


# ---------------------------------------------------------------- 산 풀
def mtngrass_overlay(cx, cy, seed=310):
    """칸 하나 덧그림(16x16 RGBA): 짙은 산 풀 포기 2~4(세 획, 빛 끝 + 밑 그늘) + 드문 들꽃(흰·노랑 2px). 칸 안에만 찍는다."""
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    sd = seed + cx * 131 + cy * 71
    for i in range(2 + int(_hash(cx, cy, sd) * 3)):
        tx = 2 + int(_hash(i, 1, sd) * 12); ty = 4 + int(_hash(i, 2, sd) * 11)
        for (dx, dy, k) in ((0, 0, 2), (0, -1, 3), (-1, -1, 3), (0, -2, 4), (1, -2, 4), (-1, -3, 5), (1, -3, 5), (0, -3, 4)):
            x_, y_ = tx + dx, ty + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
        if ty + 1 < 16:
            for dx in (-1, 0, 1):
                if 0 <= tx + dx < 16 and not al[ty + 1, tx + dx]: rgb[ty + 1, tx + dx] = LEAFa[2]; al[ty + 1, tx + dx] = True
    if _hash(cx, cy, sd + 5) > .62:
        fx = 2 + int(_hash(cx, cy, sd + 6) * 11); fy = 2 + int(_hash(cx, cy, sd + 7) * 10)
        col = WASHI if _hash(cx, cy, sd + 8) > .45 else GINKGO
        for (dx, dy, k) in ((0, 0, 6), (1, 0, 5), (0, 1, 5), (1, 1, 4)):
            rgb[fy + dy, fx + dx] = col[k]; al[fy + dy, fx + dx] = True
        rgb[fy + 2, fx] = LEAFa[3]; al[fy + 2, fx] = True
    return _img(rgb, al)


def lawn_tile():
    return Image.fromarray(G.tiled(G.tex(0, 128), 16, 16)).convert('RGBA')


def ground_mtngrass():
    base = Image.fromarray(G.tiled(G.tex(0, 128), 48, 48)).convert('RGBA')
    for cy in range(3):
        for cx in range(3): base.alpha_composite(mtngrass_overlay(cx, cy), (cx * 16, cy * 16))
    return base


# ---------------------------------------------------------------- 흙 산길
def trail_rgb(X, Y, seed=21):
    d = chip_tex(16, 224).astype(int)[Y % 16, X % 16]
    gx = X // 4; gy = Y // 4; h = hash2(gx % 12, gy % 12, seed)
    lx = X % 4; ly = Y % 4
    peb = (h > .86) & (lx < 3) & (ly < 2)
    rgb = np.where((peb & (lx == 0) & (ly == 0))[..., None], SOILa[6], d)
    rgb = np.where((peb & ~((lx == 0) & (ly == 0)))[..., None], SOILa[5], rgb)
    rgb = np.where(((h > .86) & (ly == 2) & (lx < 3))[..., None], SOILa[1], rgb)
    # 드문 뿌리(가로로 비스듬히 흙 위를 지나는 짙은 줄 + 위 빛) — 48 주기
    u = (X + Y // 3) % 48
    root = (u > 30) & (u < 41) & (((Y % 48) - 31 - (u - 30) // 3) == 0)
    rgb = np.where(root[..., None], SOILa[2], rgb)
    rgb = np.where(np.roll(root, -1, 0)[..., None] & ~root[..., None], SOILa[4], rgb)
    return rgb


def ground_trail():
    Y, X = np.mgrid[0:48, 0:48]; return _img(trail_rgb(X, Y))


# ---------------------------------------------------------------- 암반
def bedrock_k(X, Y, seed=31):
    g = chip_tones_lin(336, 336, 2.4, 5.2)[Y % 16, X % 16].astype(int)
    g2 = chip_tones_lin(352, 352, 2.4, 5.2)[Y % 16, (X + 5) % 16].astype(int)
    blk = hash2((X // 16) % 3, (Y // 16) % 3, seed) > .5
    k = np.where(blk, g, g2)
    # 금: 48 주기 굽은 금 둘
    for (ox, oy, a) in ((5, 9, .4), (29, 33, -.5)):
        yy = ((Y - oy) % 48); xx = ((X - ox) % 48)
        on = (xx < 22) & (np.abs(yy - (xx * a + 3 * np.sin(xx / 4.0)) % 48) < .7)
        k = np.where(on, 1, k)
        k = np.where(np.roll(on, 1, 0) & ~on, np.minimum(k + 1, 6), k)
    return np.clip(k, 1, 6)


def ground_bedrock():
    Y, X = np.mgrid[0:48, 0:48]; return _img(GRANa[bedrock_k(X, Y)])


# ---------------------------------------------------------------- 돌계단 판(넓은 계단 표본)
def stairstone_rgb(X, Y):
    s = Y % 6
    k = np.where(s == 0, 6, np.where(s < 3, 5, np.where(s < 5, 3, 2)))
    joint = ((X + (Y // 6) * 7) % 24) == 0
    k = np.where(joint & (s > 0), 2, k)
    g = chip_tones_lin(336, 336, 0, 6)[Y % 16, X % 16]
    k = np.where((g <= 1) & (s > 0) & (s < 3), k - 1, k)
    rgb = STa[np.clip(k, 1, 6)]
    moss = (s == 4) & (hash2(X // 3, Y // 6, 41) > .8)
    return np.where(moss[..., None], KOKEa[3], rgb)


def ground_stairstone():
    Y, X = np.mgrid[0:48, 0:48]; return _img(stairstone_rgb(X, Y))


GROUNDS = [('ground-court', ground_court), ('ground-mtngrass', ground_mtngrass), ('ground-trail', ground_trail),
           ('ground-bedrock', ground_bedrock), ('ground-stairstone', ground_stairstone)]

if __name__ == '__main__':
    import os
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    o = Image.new('RGBA', (len(GROUNDS) * 160, 160), (30, 30, 36, 255))
    for i, (n, f) in enumerate(GROUNDS):
        im = f(); t = Image.new('RGBA', (144, 144))
        for yy in range(3):
            for xx in range(3): t.alpha_composite(im, (xx * 48, yy * 48))
        o.alpha_composite(t, (i * 160 + 8, 8))
    o = o.resize((o.width * 2, o.height * 2), Image.NEAREST); o.save(os.path.join(HERE, '_qa', 'grounds.png')); print('ok')

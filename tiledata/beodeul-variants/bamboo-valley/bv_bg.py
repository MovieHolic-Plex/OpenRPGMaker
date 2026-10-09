# 대나무 숲 계곡 전투 배경 battle-bg.png (640x360, 낮·맑음) + check-overlay.png.   python3 bv_bg.py
# WAVE-BRIEF-3 A 절: 위 ~45% 하늘·원경(연한 청회 띠 4단 + 먹빛 봉우리 실루엣 2겹 + 지평선 대숲 벽), 지평선 y≈165~185,
# 아래 = 이 장소 바닥 그림 함수(버들항 풀 + 낙엽 오솔길·대나무 잎 땅·이끼 오토타일) 재사용, 키 큰 물체는 양쪽 가장자리·뒤쪽에만.
import os, sys
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import bv_base
sys.path.insert(0, os.path.join(bv_base.VAR, 'battle-bg-town'))
import numpy as np
from PIL import Image, ImageDraw
import bgcommon as BC
from bv_base import _hash, smooth
from bv_scene import Scene
import bv_props as P, bv_build as B

HERE = _HERE
HORIZON = 176
GY = 184
BATTLE = (120, 190, 560, 330)
ENEMIES = [(150, 214), (232, 252), (144, 282)]
ALLIES = [(420, 202), (480, 234), (432, 266), (500, 288)]


def ground():
    Wc, Hc = 40, 12
    s = Scene(Wc, Hc, seed=5)
    for x in range(Wc):                                                   # 가운데를 가로지르는 낙엽 오솔길(살짝 굽는다)
        c = 4.5 + 1.2 * np.sin(x / 6.0)
        for y in range(int(c), int(c) + 3): s.trail.add((x, y))
    nz = smooth(Wc, Hc, 3, 31)
    for y in range(Hc):
        for x in range(Wc):
            if (x, y) in s.trail: continue
            side = x < 7 or x > 32
            if side and nz[y, x] > .35: s.litter.add((x, y))
            elif nz[y, x] > .78 or (side and y < 2): s.moss.add((x, y))
            elif _hash(x, y, 3) > .6: s.gz[(x, y)] = 'sprig' if _hash(x, y, 4) > .5 else 'litter'
    return s.render(2)


def make():
    im = BC.new()
    BC.sky(im, [(40, '#8fb2c6'), (78, '#a3c2d0'), (116, '#b8d0d8'), (HORIZON, '#cadcdf')])
    for (cx, cy, w, h, sd) in ((96, 30, 70, 11, 11), (470, 22, 90, 13, 12), (300, 56, 40, 7, 13)):
        BC.cloud(im, cx, cy, w, h, sd)
    BC.ridge(im, 150, 92, ('#8e9ea8', '#a8b6bc', '#7e8e98'), 21, step=2, period=(53, 23, 11))     # 먼 먹빛 봉우리
    BC.ridge(im, 160, 62, ('#5e6c76', '#74828a', '#525f68'), 22, step=2, period=(41, 17, 9))      # 가까운 봉우리
    # 지평선 대숲 벽(뒤 줄은 한 단 어둡게)
    back = [P.bamboo_thicket(seed=500 + i, w=4, h=6) for i in range(4)]
    for i, x in enumerate(range(-24, 660, 44)):
        spr = back[i % 4]; a = np.array(spr).astype(np.float64); a[..., :3] *= .72
        BC.paste(im, Image.fromarray(a.astype(np.uint8), 'RGBA').crop((0, 0, 64, 80)), x, GY + 2)
    front = [P.bamboo_thicket(seed=520 + i, w=4, h=6) for i in range(3)]
    for i, x in enumerate(range(-8, 660, 58)):
        BC.paste(im, front[i % 3].crop((0, 0, 64, 70)), x, GY + 6)
    g = np.array(ground().convert('RGB'))
    a = np.array(im); a[GY:, :, :3] = g[:360 - GY, :640]
    im.paste(Image.fromarray(a, 'RGBA'))
    BC.darken_rows(im, GY, GY + 2, .7)
    # 가장자리 물체(가운데 아래 배틀러 자리를 피한다)
    BC.paste(im, P.bamboo_thicket(seed=540, w=4, h=7), -26, 300)
    BC.paste(im, P.bamboo_clump(seed=541, n=6, w=2, h=5), 54, 262)
    BC.paste(im, P.bamboo_thicket(seed=542, w=4, h=7), 590, 306)
    BC.paste(im, P.bamboo_clump(seed=543, n=5, w=2, h=5), 566, 250)
    BC.paste(im, P.stone_lantern(seed=3), 92, 214); BC.paste(im, P.stone_lantern(seed=4), 534, 214)
    BC.paste(im, P.rock_pair(seed=4), 4, 352); BC.paste(im, P.boulder(seed=9), 600, 352)
    BC.paste(im, P.fern(seed=3), 70, 346); BC.paste(im, P.fern(seed=5), 580, 330); BC.paste(im, P.fern(seed=8), 100, 312)
    BC.paste(im, P.bamboo_shoots(seed=4), 116, 342); BC.paste(im, P.leaf_pile(seed=2), 548, 344)
    BC.paste(im, P.maple_red(seed=2), 140, GY + 4)                          # 뒤 대숲 앞 붉은 단풍 하나(지평선 위)
    return im


def overlay(path):
    im = Image.open(path).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for (x, y) in ENEMIES: d.rectangle((x, y, x + 47, y + 47), fill=(255, 60, 60, 110), outline=(255, 80, 80, 255))
    for (x, y) in ALLIES: d.rectangle((x, y, x + 47, y + 47), fill=(60, 140, 255, 110), outline=(80, 160, 255, 255))
    d.rectangle(BATTLE, outline=(255, 255, 0, 200))
    d.rectangle((0, 340, 639, 359), fill=(10, 10, 20, 170))
    d.line((0, HORIZON, 639, HORIZON), fill=(255, 255, 255, 90))
    d.text((4, 344), 'bamboo-valley  (yellow = battler zone, dark = HUD)', fill=(255, 255, 255, 255))
    Image.alpha_composite(im, ov).convert('RGB').save(os.path.join(HERE, 'check-overlay.png'))


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    BC.finish(make()).save(out)
    print(out, BC.check(out))
    overlay(out)

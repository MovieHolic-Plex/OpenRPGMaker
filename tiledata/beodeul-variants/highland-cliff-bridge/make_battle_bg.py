# 고원 절벽과 하늘 다리 전투 배경 battle-bg.png (640x360, 낮·맑음) + check-overlay.png.   python3 make_battle_bg.py
# WAVE-BRIEF-3 A 절: 위 ~45% = 푸른 하늘 띠 4단 + 손 구름 + 먼 고원 둘(주황 절벽 앞면 + 풀 마루, 멀수록 한 단 밝고 납작)과 그 사이 하늘 위 널판 다리,
# 지평선 y≈176 = 가까운 고원 끝 흙 턱, 아래 = 이 장소 바닥(고원 풀 섞기 + 마른 풀 덩이 + 맨땅 길 오토타일), 키 큰 물체는 양쪽 가장자리·뒤쪽에만.
import os, sys, math
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import hc_base
sys.path.insert(0, os.path.join(hc_base.VAR, 'battle-bg-town'))
import numpy as np
from PIL import Image, ImageDraw
import bgcommon as BC
from hc_base import _hash, smooth, DAN, LEAFa, SORA
from hc_scene import Scene
import hc_props as P, hc_build as B, hc_cliff as HC

HERE = _HERE
HORIZON = 176
GY = 184
BATTLE = (120, 190, 560, 330)
ENEMIES = [(150, 214), (232, 252), (144, 282)]
ALLIES = [(420, 202), (480, 234), (432, 266), (500, 288)]
hexs = lambda c: '#%02x%02x%02x' % tuple(c)


def ground():
    Wc, Hc = 40, 12
    s = Scene(Wc, Hc, seed=5)
    s.L[:, :] = 1
    for x in range(Wc):                                                   # 가운데를 비스듬히 가로지르는 맨땅 길
        c = 5.0 + 1.6 * math.sin(x / 7.0 + .6)
        for y in range(int(c), int(c) + 2): s.path.add((x, y))
    nz = smooth(Wc, Hc, 3, 31)
    for y in range(Hc):
        for x in range(Wc):
            if (x, y) in s.path: continue
            if nz[y, x] > .6: s.dry.add((x, y))
            elif _hash(x, y, 3) > .45: s.gz[(x, y)] = 'tuft' if _hash(x, y, 4) > .4 else ('mottle' if _hash(x, y, 5) > .3 else 'flower')
    return s.render(2)


def mesa(im, x0, x1, top, face, seed, far=0):
    """먼 고원 하나: 울퉁불퉁한 풀 마루(top) + 주황 절벽 앞면(face px 높이, 절벽 결을 1/2 크기로 — 멀수록 밝게) + 앞면 밑 그늘 띠."""
    px = im.load()
    dan = [DAN[min(6, k + far)] for k in range(7)]
    for x in range(max(0, x0), min(640, x1)):
        e = min(x - x0, x1 - 1 - x)
        t = top + int(round(4.0 * math.sin(x / 23.0 + seed) + 1.6 * math.sin(x / 7.0 + seed * 2) + .8 * math.sin(x / 2.7))) + (int((16 - e) * .9) if e < 16 else 0)
        for y in range(t, t + 4):                                         # 풀 마루
            k = 5 - far if y == t else (4 if y < t + 3 else 3)
            px[x, y] = tuple(int(v) for v in LEAFa[max(1, min(6, k + far))]) + (255,)
        for y in range(t + 4, top + face):
            k = HC.cliff_k(x * 2 + seed * 50, (y - t) * 2, (y - t) * 2, face * 2, seed)
            if y < t + 6: k = 2
            if e < 3: k = max(1, k - (3 - e))
            px[x, y] = dan[max(1, min(6, k))] + (255,)


def make():
    im = BC.new()
    BC.sky(im, [(44, hexs(SORA[3])), (88, hexs(SORA[4])), (132, '#7890d6'), (GY + 8, hexs(SORA[5]))])
    for (cx, cy, w, h, sd) in ((96, 40, 120, 20, 11), (340, 30, 150, 24, 12), (570, 56, 100, 16, 13), (226, 80, 60, 10, 14), (480, 96, 70, 11, 15)):
        BC.cloud(im, cx, cy, w, h, sd, cols=(hexs(hc_base.KUMO[6]), hexs(hc_base.KUMO[4]), hexs(hc_base.KUMO[2])))
    mesa(im, -10, 262, 112, GY - 112, 3, far=1)                            # 먼 고원 둘(사이 협곡으로 하늘이 지평선까지 보인다)
    mesa(im, 378, 660, 106, GY - 106, 7, far=1)
    br = B.bridge_h(9).resize((72, 32), Image.NEAREST)                     # 먼 다리(절반 크기) — 두 고원 마루를 잇는다
    for i, x in enumerate(range(250, 392, 16)):
        BC.paste(im, br.crop((8 if i else 0, 0, 24 if i else 16, 32)), x, 136)
    for (x0, x1, top, sd) in ((-20, 200, 142, 21), (440, 660, 138, 23)):  # 가까운 고원 끝(지평선 바로 위, 양옆)
        mesa(im, x0, x1, top, 40, sd, far=0)
    g = np.array(ground().convert('RGB'))
    a = np.array(im)
    lip = np.array([GY + int(round(1.4 * math.sin(x / 5.0) + .8 * math.sin(x / 2.2))) for x in range(640)])
    for x in range(640):
        y0 = lip[x]
        a[y0:, x, :3] = g[:360 - y0, x]
        for d, k in ((0, 5), (1, 6), (2, 4), (3, 3)):                     # 가까운 고원 끝 흙 턱(하늘·먼 고원과 맞닿는 줄)
            if y0 - 4 + d >= 0: a[y0 - 4 + d, x, :3] = DAN[k]
        if _hash(x, 0, 9) < .35: a[y0 - 5, x, :3] = LEAFa[4]
    im.paste(Image.fromarray(a, 'RGBA'))
    # 가장자리 물체(가운데 아래 배틀러 자리를 피한다)
    BC.paste(im, P.oak_big(31), -14, 268); BC.paste(im, P.fir_tall(32), 40, 236); BC.paste(im, P.fir_young(33), 70, 216)
    BC.paste(im, P.oak_big(34), 590, 262); BC.paste(im, P.fir_tall(35), 570, 226); BC.paste(im, P.fir_tall(36), 612, 200)
    BC.paste(im, P.bush_autumn(37), 70, 346); BC.paste(im, P.boulder_dan(38), 26, 352); BC.paste(im, P.rock_pair(39), 560, 352)
    BC.paste(im, P.bush_round(40), 98, 300); BC.paste(im, P.bush_small(41), 548, 300)
    BC.paste(im, P.tallgrass(42), 112, 334); BC.paste(im, P.flowers_white(43), 590, 330); BC.paste(im, P.cairn(44), 96, 214)
    BC.paste(im, P.signpost(45), 540, 214)
    return im


def overlay(path):
    im = Image.open(path).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for (x, y) in ENEMIES: d.rectangle((x, y, x + 47, y + 47), fill=(255, 60, 60, 110), outline=(255, 80, 80, 255))
    for (x, y) in ALLIES: d.rectangle((x, y, x + 47, y + 47), fill=(60, 140, 255, 110), outline=(80, 160, 255, 255))
    d.rectangle(BATTLE, outline=(255, 255, 0, 200))
    d.rectangle((0, 340, 639, 359), fill=(10, 10, 20, 170))
    d.line((0, HORIZON, 639, HORIZON), fill=(255, 255, 255, 90))
    d.text((4, 344), 'highland-cliff-bridge  (yellow = battler zone, dark = HUD)', fill=(255, 255, 255, 255))
    Image.alpha_composite(im, ov).convert('RGB').save(os.path.join(HERE, 'check-overlay.png'))


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    BC.finish(make()).save(out)
    print(out, BC.check(out))
    overlay(out)

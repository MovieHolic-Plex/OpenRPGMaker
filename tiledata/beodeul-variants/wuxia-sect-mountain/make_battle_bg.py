# 산중 무림 문파 전투 배경 battle-bg.png(640x360, 낮·맑음) + check-overlay.png(가짜 전투원 표식 검사).
# 규약(WAVE-BRIEF-3 A): 위 ~45% 하늘·원경(먹빛 봉우리 두 겹 + 산수화 구름 띠 + 대전 지붕), 지평선 165~185 = 절벽 끝 턱 + 돌 난간,
# 아래 185~340 = 연무장 판석(ground-court 그대로) + 귀퉁이 이끼 돌판, 가장자리만 물체(봉우리·소나무·깃대·석등·북·향로).
# 하늘은 단색 띠 4개 + 손 구름(battle-bg-town/bgcommon 을 읽기만 해서 쓴다). 색 ≤ 96, 불투명.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'battle-bg-town'))
import numpy as np
from PIL import Image, ImageDraw
import bgcommon as BG
import ws_base
from ws_base import TC
import ws_build as B, ws_props as P, ws_ground as WG, ws_auto as WA, ws_cliff as C
from fr_base import cell_of

HZ = 172          # 연무장 시작(절벽 끝 턱)


def make():
    im = BG.new()
    BG.sky(im, [(40, '#86aac4'), (82, '#9dbcd2'), (124, '#b4cddc'), (HZ, '#c9dbe3')])
    for (cx, cy, w, h, s) in ((96, 34, 70, 11, 201), (548, 26, 84, 13, 202), (400, 58, 40, 7, 203)):
        BG.cloud(im, cx, cy, w, h, s, cols=('#f4f8f8', '#dbe4e8', '#aebcc6'))
    BG.ridge(im, 150, 92, ('#7f96a8', '#93a8b8', '#6f8698'), 301, step=3, period=(140, 53, 23))     # 먼 먹빛 봉우리
    tc = TC(640, 360, 3); P.cloud_band(tc, 0, 300, 132, 9, 31, 210); P.cloud_band(tc, 360, 640, 120, 8, 32, 200)
    im.alpha_composite(tc.img())
    BG.ridge(im, 166, 60, ('#4e6474', '#62788a', '#425666'), 302, step=3, period=(90, 37, 17))      # 가까운 봉우리
    # 뒤 단 위 대전(지붕·처마만 보인다) + 양옆 봉우리 바위
    hall = B.main_hall(1)
    BG.paste(im, hall.crop((0, 0, hall.width, 86)), 320 - hall.width // 2, HZ - 4)
    BG.paste(im, P.peak_spire(11, 3, 7), 0, HZ + 6); BG.paste(im, P.peak_spire(12, 3, 6), 590, HZ + 4)
    BG.paste(im, P.peak_spire(13, 3, 5), 52, HZ - 2); BG.paste(im, P.peak_spire(14, 3, 5), 548, HZ - 4)
    tc = TC(640, 360, 4); P.cloud_band(tc, -4, 200, 150, 7, 41, 205); P.cloud_band(tc, 450, 644, 156, 7, 42, 205)
    im.alpha_composite(tc.img())
    # 바닥: 연무장 판석(ground-court 화소 함수) — 절벽 끝 턱 한 줄 + 돌 난간 띠
    Y, X = np.mgrid[0:360 - HZ, 0:640]
    g = WG.court_rgb(X, Y + 4)
    gr = np.array(WG.ground_mtngrass().convert('RGB')); gr = np.tile(gr, (5, 14, 1))[:360 - HZ, :640]
    import math
    edgeL = lambda y: 96 + 18 * math.sin(y / 11.0) + 8 * math.sin(y / 4.3) - (y * .25)        # 판석 마당 양옆은 산 풀(들쭉날쭉한 끝)
    edgeR = lambda y: 544 - 16 * math.sin(y / 9.0 + 1) - 7 * math.sin(y / 3.7) + (y * .25)
    gm = np.zeros((360 - HZ, 640), bool)
    for y in range(360 - HZ):
        gm[y, :max(0, int(edgeL(y)))] = True; gm[y, min(640, int(edgeR(y))):] = True
    g = np.where(gm[..., None], gr, g)
    from scipy import ndimage as ndi
    rim = ~gm & ndi.binary_dilation(gm, iterations=1)
    g = np.where(rim[..., None], WG.STa[3], g)
    sh = gm & ~ndi.binary_erosion(gm, iterations=2) & np.roll(~gm, 0, 1)
    a = np.array(im); a[HZ:, :, :3] = g; a[HZ, :, :3] = WG.STa[5]; a[HZ + 1, :, :3] = WG.STa[3]
    a[HZ + 2:HZ + 22, :, :3] = (a[HZ + 2:HZ + 22, :, :3].astype(float) * .86).astype(np.uint8)   # 먼 쪽 판석은 한 단 어둡게(깊이)
    im.paste(Image.fromarray(a, 'RGBA'))
    for x0 in range(0, 640, 64):
        if 200 <= x0 < 420: continue
        BG.paste(im, C.stone_rail(4, seed=x0), x0, HZ + 12)
    # 귀퉁이 이끼 돌판(오토타일 그대로)
    mf = WA.autotile_mossflag()
    cells = {(x, y) for y in range(10, 12) for x in range(0, 6)} | {(x, y) for y in range(9, 12) for x in range(34, 40)} | {(0, 9), (1, 9), (39, 8)}
    for (x, y) in cells:
        n = sum(b for (dx, dy, b) in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)) if (x + dx, y + dy) in cells or y + dy > 11)
        im.alpha_composite(cell_of(mf, n), (x * 16, HZ + 4 + (y - 10) * 16 + 16))
    # 가장자리 물체
    BG.paste(im, P.cliff_pine(21), -8, 258); BG.paste(im, P.cliff_pine(22, True), 606, 262)
    BG.paste(im, P.banner_pole(31), 104, 248); BG.paste(im, P.banner_pole(32), 530, 248)
    BG.paste(im, P.stone_lantern(33), 78, 300); BG.paste(im, P.stone_lantern(34), 556, 300)
    BG.paste(im, P.war_drum(35), 18, 334); BG.paste(im, P.incense_burner(36), 594, 336)
    BG.paste(im, P.boulder(37), 40, 252); BG.paste(im, P.polearm_rack(38), 572, 230)
    return im


def overlay(path, out):
    im = Image.open(path).convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for (x, y) in ((150, 200), (210, 250), (150, 290)): d.rectangle((x, y, x + 47, y + 47), fill=(230, 60, 60, 110), outline=(255, 90, 90, 220))
    for (x, y) in ((420, 210), (480, 240), (420, 270), (480, 300)): d.rectangle((x, y, x + 47, y + 47), fill=(60, 120, 230, 110), outline=(90, 150, 255, 220))
    d.rectangle((120, 190, 560, 330), outline=(255, 255, 0, 200)); d.rectangle((0, 340, 639, 359), outline=(255, 255, 255, 160))
    im.alpha_composite(ov); im.convert('RGB').save(out)


if __name__ == '__main__':
    out = os.path.join(HERE, 'battle-bg.png')
    BG.finish(make()).save(out); print(out, BG.check(out))
    overlay(out, os.path.join(HERE, 'check-overlay.png'))

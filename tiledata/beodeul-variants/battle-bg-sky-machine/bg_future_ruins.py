# 4. future-ruins — 미래 폐허: 먼지 낀 흐린 하늘(강철·콘크리트 램프 띠 + 연기 빛 구름 덩이), 원경에 무너진 고층 그루터기 줄·
# 저장 탱크·끊긴 고가 도로·지하 공장 벙커, 지평선에 콘크리트 판 띠와 철망, 바닥은 녹 번진 강철판 마당. 가장자리에 관·드럼통·전봇대.
# 그림 함수: lib/fr_ground(plate_rgb 강철판·concrete_px 콘크리트), lib/fr_struct(ruin_block·storage_tank·overpass·factory_gate),
# lib/fr_props(관·드럼·전봇대·환풍기·철망·거더), lib/fr_base(기계 재질 램프) — future-ruins 에서 복사한 것. 구름 덩이는 lib/sc_sky.paint_puffs.
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import fr_base as FB
import fr_ground as FG
import fr_struct as FS
import fr_props as FP
import sc_sky as S

STEEL, CONC, RUST = FB.STEEL, FB.CONC, FB.RUST
HZ = 172
SKY = [STEEL[5], FB.mix(STEEL[5], CONC[5], .5), CONC[5], FB.mix(CONC[5], CONC[6], .5)]
AIR = SKY[2]


def smoke_cloud(w, h, seed):
    """연기 빛 구름 덩이: sc_sky.cloud_puff 와 같은 덩이 찍기를 콘크리트 램프(따뜻한 잿빛)로."""
    import random
    r = random.Random(seed); puffs = []; n = 3 + int(w / 14)
    for i in range(n):
        t = (i + .5) / n; rx = h * r.uniform(.26, .40) * (1.25 - abs(t - .5))
        puffs.append((w * (.12 + .76 * t) + r.uniform(-2, 2), h * .6 - rx * .4 + r.uniform(-2, 2), rx * 1.25, rx * .7))
    puffs.sort(key=lambda p: p[1] + p[3] * .6)
    ramp = [CONC[1], CONC[3], CONC[4], CONC[5], FB.mix(CONC[5], CONC[6], .5), CONC[6], CONC[6]]
    tone, pid = S.paint_puffs(w, h, puffs, ramp)
    a = np.zeros((h, w, 4), np.uint8)
    m = tone >= 0
    a[m, :3] = np.array(ramp, np.uint8)[np.clip(tone[m], 0, 6)]; a[m, 3] = 255
    return Image.fromarray(a, 'RGBA')


def build():
    img = BB.canvas(SKY[0])
    BB.bands(img, 0, HZ, SKY, cuts=[44, 92, 136])
    for (x, y, w, h, sd) in ((10, 26, 110, 26, 3), (210, 10, 80, 20, 5), (380, 40, 130, 30, 8), (560, 18, 76, 22, 2), (120, 80, 70, 18, 9)):
        img.alpha_composite(BB.haze(smoke_cloud(w, h, sd), AIR, .15), (x, y))
    # --- 원경 1(먼 줄, 짙은 안개): 무너진 고층 그루터기 줄
    far = [(-8, 5, 3, .7), (54, 6, 2, .5), (104, 4, 3, .8), (170, 7, 3, .4), (250, 5, 2, .6), (300, 6, 3, .5),
           (376, 4, 3, .7), (446, 7, 2, .5), (494, 5, 3, .6), (566, 6, 3, .3)]
    for i, (x, fl, cols, br) in enumerate(far):
        b = BB.haze(FS.ruin_block(fl, cols, br, seed=40 + i, wall=('conc', 'cream', 'red')[i % 3] if False else 'conc'), AIR, .55)
        BB.paste(img, b, x, HZ - 6)
    # --- 원경 2(가까운 줄, 옅은 안개): 끊긴 고가 도로(왼쪽), 저장 탱크 둘·공장 벙커(오른쪽)
    BB.paste(img, BB.haze(FS.overpass_span(0), AIR, .3), 0, HZ + 2)
    BB.paste(img, BB.haze(FS.overpass_pier(1), AIR, .3), 120, HZ + 2)
    BB.paste(img, BB.haze(FS.storage_tank(0), AIR, .28), 404, HZ + 4)
    BB.paste(img, BB.haze(FS.storage_tank(1, 38), AIR, .28), 452, HZ + 4)
    BB.paste(img, BB.haze(FS.factory_gate(0), AIR, .24), 506, HZ + 6)
    # --- 지평선: 콘크리트 판 띠(마당 뒤 끝) + 강철판 마당
    Y, X = np.mgrid[0:16, 0:W]
    conc = np.array(CONC, np.uint8)[FG.concrete_px(X, Y, 5, slab=16)]
    img.paste(Image.fromarray(conc, 'RGB').convert('RGBA'), (0, HZ))
    plate = FG.plate_rgb(W, H - HZ - 16, seed=9, rust=.28)
    img.paste(Image.fromarray(plate, 'RGB').convert('RGBA'), (0, HZ + 16))
    a = np.array(img); a[HZ + 16, :, :3] = STEEL[1]; a[HZ + 17, :, :3] = STEEL[5]; img.paste(Image.fromarray(a, 'RGBA'))
    # 뒤 철망(마당 뒤 끝, 군데군데 끊김)
    for x in range(150, 400, 48):
        if x == 246: continue
        BB.paste(img, FP.fence_chain(x), x, HZ + 14)
    # --- 가장자리 물체: 왼쪽 관·전봇대·드럼, 오른쪽 환풍기·드럼·거더·관
    BB.paste(img, FP.power_pole(0), 4, 250)
    BB.paste(img, FP.pipe_run(0), 30, 226)
    BB.paste(img, FP.pipe_elbow(0), 86, 240)
    BB.paste(img, FP.toxic_drums(0), 20, 312)
    BB.paste(img, FP.drum_single(1, 'warn'), 96, 296)
    BB.paste(img, FP.vent_fan(0), 576, 232)
    BB.paste(img, FP.pipe_elbow(1), 600, 274, flip=True)
    BB.paste(img, FP.girder_pile(0), 566, 322)
    BB.paste(img, FP.drum_single(2, 'rust'), 614, 312)
    return img

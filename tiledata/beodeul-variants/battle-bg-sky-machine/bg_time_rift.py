# 3. time-rift — 시간의 틈: 별·성운 허공(void_image) 속 떠 있는 넓은 판석 돌 단(전투 바닥, 아래로 두께 띠·바위 뿌리),
# 먼 허공에 작은 뜬 섬·떠도는 바위·기둥 조각·시계 고리·시간 조각, 돌 단 양 끝에 부러진 기둥·포털·등.
# 그림 함수: lib/tr_void(허공·성운·별), lib/tr_isle(Island·render_islands·ellipse_mask — 판석 윗면·두께 띠·뿌리),
# lib/tr_props(기둥·아치·바위·시계 고리·포털·등·수정) — time-rift 에서 복사한 것. islet/platform 은 tr_export 의 함수 복사본.
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import tr_void as V
import tr_isle as I
import tr_props as PR

ARENA = (320, 258, 384, 84)          # 전투 돌 단 타원(가운데·반지름) — 뒤 끝 y≈174, 앞 끝 y≈342


def islet_piece(seed=33, w=64, h=80, rx=30, ry=19):           # tr_export.islet_piece 복사(크기·씨앗만 인자로)
    m = I.ellipse_mask(w, h, w / 2, ry + 3, rx, ry, 9, 1.5)
    im, k = I.render_islands(w, h, [I.Island(m, 'plat', body=6, root=20, seed=seed)]); return im


def build():
    img = BB.canvas()
    # --- 허공 전체(별·성운 흐름). 성운은 위쪽에 비스듬히 두 줄기
    rng = np.random.default_rng(5)
    nv = V.stream(rng, -30, 150, 420, 20, 52, 7, 20, 16) + V.stream(rng, 430, 120, 700, 60, 28, 6, 14, 10)
    nt = V.stream(rng, 60, 40, 300, 0, 24, 5, 11, 8)
    img.alpha_composite(V.void_image(W, H, seed=17, neb_blobs=(nv, nt), star_dens=1.1))
    # --- 원경: 먼 섬 그림자·작은 뜬 섬·떠도는 바위·기둥·시계 고리·시간 조각(모두 지평선 위)
    for (x, y, sd) in ((30, 60, 27), (500, 34, 29), (270, 92, 31)):
        img.alpha_composite(PR.far_isles(sd), (x, y))
    img.alpha_composite(BB.haze(islet_piece(33), (20, 18, 44), .35), (96, 72))
    img.alpha_composite(BB.haze(islet_piece(35, 48, 64, 22, 14), (20, 18, 44), .45), (430, 96))
    img.alpha_composite(PR.clock_ring(9), (520, 66))
    img.alpha_composite(PR.time_shard(25), (226, 40))
    img.alpha_composite(PR.time_shard(26), (610, 128))
    img.alpha_composite(PR.rock_drift(True, 71), (372, 40))
    img.alpha_composite(PR.rock_drift(False, 72), (176, 128))
    img.alpha_composite(PR.rock_drift(False, 73), (590, 20))
    img.alpha_composite(PR.pillar_drift(5, 1), (330, 112))
    img.alpha_composite(PR.arch_drift(7), (20, 118))
    # --- 전투 바닥: 넓은 판석 돌 단(타원). 버들항 광장 판석 + 두께 띠 + 바위 뿌리
    cx, cy, rx, ry = ARENA
    m = I.ellipse_mask(W, H + 80, cx, cy, rx, ry, 3, 2.0)
    isl = I.Island(m, 'path', body=12, root=40, seed=21)
    rock, kind = I.render_islands(W, H + 80, [isl])
    img.alpha_composite(rock.crop((0, 0, W, H)))
    # --- 돌 단 양 끝 물체(배틀러 자리 밖): 왼쪽 포털·부러진 기둥·등, 오른쪽 기둥·수정·쓰러진 북돌
    BB.paste(img, PR.portal('violet', 1), 20, 236)
    BB.paste(img, PR.pillar_broken(True, 3), 92, 222)
    BB.paste(img, PR.rift_lamp(15), 70, 292)
    BB.paste(img, PR.pillar_broken(False, 4), 8, 290)
    BB.paste(img, PR.pillar_broken(True, 6), 578, 230)
    BB.paste(img, PR.light_crystal(17), 604, 252)
    BB.paste(img, PR.drum_fallen(21), 566, 300)
    BB.paste(img, PR.rubble(19), 610, 296)
    # 뒤 끝 낮은 물체
    BB.paste(img, PR.rubble(20), 236, 196)
    BB.paste(img, PR.pillar_broken(False, 8), 452, 196)
    return img

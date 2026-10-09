# 6. final-tower — 최종 탑 꼭대기: 보라 성운 별하늘(tr_void 허공) 속, 저 뒤 떠 있는 조각 위 핵 제단 실루엣(구슬만 희미하게 빛남),
# 떠도는 돌판·들보·뼈 조각, 전투 바닥은 허공 쪽으로 깨진 큰 강철 갑판 조각(두께 띠·밑면 철근이 허공에 매달림).
# 가장자리에 도관 기둥·척추 등·부러진 갈비 아치·전선. 그림 함수: lib/ft_void(frag_layer·fragment_piece), lib/ft_base(ft_plate·ft_core 바닥),
# lib/ft_props1~3(제단·기둥·등·아치·허공 조각), lib/tr_void(허공) — final-tower·time-rift 에서 복사한 것.
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import ft_base as FTB
import ft_void as FV
import ft_props1 as A1
import ft_props2 as A2
import ft_props3 as A3
import tr_void as TV

T = 16
VOIDC = FTB.VOIDR[1]


def deck_cells():
    """전투 갑판 조각 칸: y 11..21 줄, 양 끝은 줄마다 들쭉날쭉 깎여 허공이 보인다(왼쪽 위·오른쪽 위 귀가 크게 떨어져 나감)."""
    cells = set()
    left = {11: 4, 12: 2, 13: 1, 14: 0, 15: 0, 16: 0, 17: 1, 18: 1, 19: 2, 20: 3}
    right = {11: 35, 12: 37, 13: 38, 14: 39, 15: 40, 16: 40, 17: 40, 18: 39, 19: 38, 20: 36}
    for y in range(11, 21):
        for x in range(left[y], right[y]): cells.add((x, y))
    for c in ((3, 12), (36, 12), (2, 19), (37, 19)): cells.discard(c)
    return cells


def build():
    img = BB.canvas()
    rng = np.random.default_rng(13)
    nv = TV.stream(rng, -20, 40, 300, 150, 44, 8, 22, 18) + TV.stream(rng, 380, 10, 680, 120, 36, 6, 18, 14)
    nt = TV.stream(rng, 420, 150, 640, 90, 14, 4, 9, 6)
    img.alpha_composite(TV.void_image(W, H, seed=23, neb_blobs=(nv, nt), star_dens=1.0))
    # --- 원경: 떠도는 조각들
    for (fn, x, y) in ((lambda: A3.void_slab(481), 60, 40), (lambda: A3.void_slab(482), 520, 104), (lambda: A3.void_girder(461), 150, 120),
                       (lambda: A3.void_bone(471), 452, 30), (lambda: A3.void_girder(462), 600, 40), (lambda: A3.void_slab(483), 20, 132)):
        img.alpha_composite(BB.haze(fn(), VOIDC, .25), (x, y))
    # --- 원경: 핵 제단 실루엣(뒤에 뜬 조각 위). 몸통은 허공 빛에 묻히고 구슬·빛 고리만 희미하게 남는다
    frag, _ = FV.fragment_piece((10, 4), seed=31, floor_kind='ft_core')
    alt = A3.core_altar(on=True)
    stage = Image.new('RGBA', (max(frag.width, alt.width) + 8, frag.height + alt.height), (0, 0, 0, 0))
    fx = (stage.width - frag.width) // 2
    stage.alpha_composite(frag, (fx, alt.height - 48))
    stage.alpha_composite(alt, ((stage.width - alt.width) // 2, alt.height - 48 + 28 - alt.height + 30))
    sil = BB.haze(stage, VOIDC, .62)
    img.alpha_composite(sil, ((W - sil.width) // 2, 154 - (alt.height - 48 + 60)))
    for (x, y, sd) in ((214, 88, 31), (404, 72, 33)):
        f2, _ = FV.fragment_piece((3, 2), seed=sd, floor_kind='ft_plate')
        img.alpha_composite(BB.haze(f2, VOIDC, .4), (x, y))
    # --- 전투 바닥: 큰 강철 갑판 조각(허공 쪽으로 깨짐 + 남쪽 두께 띠·밑면)
    Wc, Hc = W // T, H // T + 3
    cells = deck_cells()
    void = {(x, y) for x in range(Wc) for y in range(Hc)} - cells
    fl = Image.new('RGBA', (Wc * T, Hc * T), (0, 0, 0, 0))
    for (x, y) in cells:
        kind = 'ft_core' if (12 <= y <= 19 and 9 <= x <= 30) else 'ft_plate'
        fl.alpha_composite(FTB.dlib.floor_tile(kind, x, y), (x * T, y * T))
    lay, cut = FV.frag_layer(cells, void, Wc, Hc, fl, seed=5)
    img.alpha_composite(lay.crop((0, 0, W, H)))
    # --- 가장자리 물체(배틀러 자리 밖)
    BB.paste(img, A3.conduit_pylon(411), 22, 252)
    BB.paste(img, A2.spine_lamp(331), 70, 232)
    BB.paste(img, A2.rib_arch(201, broken=True), 0, 330)
    BB.paste(img, A2.cable_hang(321), 96, 200)
    BB.paste(img, A3.conduit_pylon(412), 590, 248)
    BB.paste(img, A2.spine_lamp(332), 566, 300)
    BB.paste(img, A1.machine_wreck(71), 580, 334)
    BB.paste(img, A2.pipe_riser(241), 618, 222)
    return img

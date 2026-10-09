# 2. airship — 비행선 갑판: 위로 기낭 밑동(캔버스 천·밧줄 그물·놋쇠 고리)과 매다는 줄, 뒤 난간 너머 구름 하늘, 바닥은 갑판 널.
# 그림 함수: lib/as_kit(갑판 널 deck_px·하늘 sky_px·밧줄 rope_line), lib/as_env(기낭 몸통), lib/as_auto(난간 rail_cell·갑판 가장자리),
# lib/as_deck(돛대·조타륜·통·상자·등·캡스턴·굴뚝) — airship 에서 복사한 것.
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import as_kit as AK
import as_env as AE
import as_auto as AA
import as_deck as AD
import as_rig as RG               # 지도와 같은 그물·등마루 씌운 기낭(2026-10-08 airship 보정 반영)

HZ = 170                         # 갑판 뒤 끝(난간 밑)
ENV_Y = -104                     # 기낭 윗부분은 화면 밖, 밑동만 보인다


def build():
    img = BB.canvas(AK.SKY7[3])
    # --- 하늘: 비행선 지도와 같은 세 단 하늘 + 덩이 적운(sky_px). 기낭 밑 그늘 한 단
    AK.SKY_H = 300.0
    BB.tile_floor(img, 0, HZ, lambda X, Y: AK.sky_px(X + 40, Y + 60, cloud_bias=.02))
    # 먼 구름 바다 띠(지평선 아래쪽 구름 덩이를 늘린다)
    BB.tile_floor(img, 128, HZ, lambda X, Y: AK.sky_px(X * 2 + 300, Y + 128 + 200, cloud_bias=.12))
    # --- 기낭 밑동: 몸통 조각을 가로로 잇는다(128px 주기)
    body = AE.envelope_body(); patched = AE.envelope_body_patched()
    for i, x in enumerate(range(-40, W, 128)):
        img.alpha_composite(patched if i == 2 else body, (x, ENV_Y))
    # 매다는 줄: 기낭 바닥 고리(32px 마다) → 뒤 난간 손잡이
    cv = AK.Cv(W, H)
    bot = ENV_Y + int(AE.ECY + AE.ER) - 1
    for k, x in enumerate(range(-40 + 16, W, 64)):
        xb = x + (x - W / 2) * .10
        AK.rope_line(cv, x, bot, int(xb), HZ - 9, sag=1.5, k=3)
    img.alpha_composite(cv.im)
    # --- 뒤 난간 + 갑판 뒤 끝(북쪽 밝은 턱)
    for x in range(0, W, 16):
        img.alpha_composite(AA.deck_edge_cell(14, False, True, True, True, None, x, 0), (x, HZ))
    BB.tile_floor(img, HZ + 16, H, lambda X, Y: AK.deck_px(X % 48, (Y + 16) % 48))
    rail = AA.rail_cell(10, False, True, False, True)
    for x in range(0, W, 16):
        img.alpha_composite(rail, (x, HZ - 12))
    # --- 가장자리 물체: 왼쪽 주돛대·통·캡스턴, 오른쪽 앞돛대·조타륜·상자·등
    BB.paste(img, AD.mast_main(), -14, 244)
    BB.paste(img, AD.barrels_lashed(), 66, 236)
    BB.paste(img, AD.capstan(), 30, 300)
    BB.paste(img, AD.deck_lantern(), 92, 214)
    BB.paste(img, AD.ballast_sacks(), 76, 338)
    BB.paste(img, AD.mast_fore(), 590, 238)
    BB.paste(img, AD.helm_wheel(), 600, 314)
    BB.paste(img, AD.crate_stack(), 566, 262)
    BB.paste(img, AD.deck_lantern(1), 574, 214)
    # 뒤 끝(난간 앞) 낮은 물체: 굴뚝·통풍 나팔·망원경 — 키 큰 굴뚝은 오른쪽 뒤에만
    BB.paste(img, AD.funnel(), 500, HZ + 14)
    BB.paste(img, AD.vent_cowl(), 186, HZ + 14)
    BB.paste(img, AD.telescope(), 412, HZ + 14)
    BB.paste(img, AD.pin_rail(), 270, HZ + 14)
    return img

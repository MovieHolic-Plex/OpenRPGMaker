# 5. machine-factory — 기계 공장 안: 위 천장 띠(어둠 + 강철 모 앵글), 관 벽 앞면(굵은 강철 관·놋쇠 관 + 콘크리트 판)에 박힌 큰 톱니 셋,
# 벽 앞(전투 바닥 뒤 끝)에 보일러·톱니 기계·프레스·증기관 기둥, 바닥은 체크 철판 + 뒤 끝 경고 띠. 가장자리에 압력 탱크·상자·수레.
# 그림 함수: lib/mf_kit(checker_plate·pipe_face/face_px·mf_ceiling), lib/mf_factory(gear_face·보일러·톱니 기계·프레스·탱크…),
# lib/mf_auto(hazard_cell 경고 띠), lib/fr_mat(TC 톤 캔버스) — machine-factory·future-ruins 에서 복사한 것.
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import mf_kit as MK
import mf_factory as MF
import mf_auto as MA
import fr_mat as FM

CEIL = 30                         # 천장 띠 아래 끝
HZ = 178                          # 벽 밑(바닥 뒤 끝)


def build():
    img = BB.canvas((10, 10, 16))
    # --- 천장 띠: 벽 너머 어둠 + 남쪽 모(콘크리트 두께 띠 + 강철 앵글)
    edge = MK.mf_ceiling((False, False, True, False, False, False, False, False), 0)
    full = MK.mf_ceiling((False,) * 8, 0)
    for x in range(0, W, 16):
        img.alpha_composite(full, (x, CEIL - 32)); img.alpha_composite(edge, (x, CEIL - 16))
    # --- 관 벽 앞면(높이 HZ-CEIL): 위에 가로 관 셋, 아래 콘크리트 판 + 강철 걸레받이. 32px 마다 칸 씨앗을 바꿔 세로 관이 군데군데
    Hw = HZ - CEIL
    p = img.load()
    for y in range(Hw):
        for x in range(W):
            c = MK.dlib.face_px('mf_pipe', x + 4000 + ((x // 16) % 6) * 0, y, Hw, 3 + (x // 16) % 6, x < 1, x >= W - 1)
            p[x, CEIL + y] = tuple(c[:3]) + (255,)
    # 벽에 박힌 큰 톱니(관 아래 콘크리트 판, 반쯤 기계에 가린다)
    tc = FM.TC(W, Hw, 7); tc.a[:] = 0
    for (cx, cy, r, n, mat, ph) in ((150, 82, 34, 24, 'steel', .1), (206, 60, 16, 14, 'brass', .4), (470, 86, 30, 22, 'steel', .6),
                                    (520, 58, 13, 12, 'brass', .2), (330, 74, 20, 16, 'steel', .3)):
        MF.gear_face(tc, cx, cy, r, n, mat, ph, spokes=5 if r > 20 else 3)
    gears = tc.fin(.6) if hasattr(tc, 'fin') else tc.img()
    img.alpha_composite(gears, (0, CEIL))
    # --- 바닥: 체크 철판(48 주기) + 뒤 끝 경고 띠
    plate = MK.checker_plate(61)
    BB.tile_image(img, plate, HZ, H)
    hz = MA.hazard_sheet()
    for x in range(0, W, 16):
        img.alpha_composite(BB.Image.Image.crop(hz, (10 % 4 * 16, 10 // 4 * 16, 10 % 4 * 16 + 16, 10 // 4 * 16 + 16)), (x, HZ + 2))
    # --- 벽 앞 기계(뒤 끝, 발이 HZ+14)
    BB.paste(img, MF.boiler_big(0), 2, HZ + 16)
    BB.paste(img, MF.gear_works(0), 118, HZ + 14)
    BB.paste(img, MF.steam_stack(0), 196, HZ + 12)
    BB.paste(img, MF.valve_manifold(0), 230, HZ + 6)
    BB.paste(img, MF.stamping_press(0), 300, HZ + 14)
    BB.paste(img, MF.gauge_board(0), 372, HZ - 30)
    BB.paste(img, MF.piston_engine(0), 420, HZ + 14)
    BB.paste(img, MF.breaker_box(0), 500, HZ - 24)
    BB.paste(img, MF.steam_stack(1), 540, HZ + 12)
    BB.paste(img, MF.pressure_tank(0), 586, HZ + 16)
    # --- 가장자리 물체(배틀러 자리 밖)
    BB.paste(img, MF.pressure_tank(1, 'redl') if False else MF.pressure_tank(2), 20, 268)
    BB.paste(img, MF.crate_stack(0), 64, 250)
    BB.paste(img, MF.parts_bin(0), 80, 310)
    BB.paste(img, MF.gear_scrap(0), 18, 326)
    BB.paste(img, MF.hand_cart(0), 570, 262)
    BB.paste(img, MF.pallet_load(0), 590, 316)
    BB.paste(img, MF.cable_bundle(0), 560, 340)
    return img

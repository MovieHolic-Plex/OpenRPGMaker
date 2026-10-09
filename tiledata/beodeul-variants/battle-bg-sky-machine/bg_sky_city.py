# 1. sky-city — 하늘 도시: 구름 바다 위 떠 있는 대리석 광장(바닥), 먼 부유섬 위 하늘 신전·흙덩이 섬, 가장자리 기둥·수정·등대탑.
# 그림 함수: lib/sc_sky(하늘 결·구름 덩이·구름 바다), lib/sc_island(대리석 판석 tex_marble·섬 테 rim_cell·밑면 underside_layer),
# lib/sc_props(신전·등대탑·기둥·수정·화로·흙덩이) — 모두 sky-city 에서 복사한 것.
import random
import numpy as np
from PIL import Image
import bb_common as BB
from bb_common import W, H
import sc_base as SB
import sc_sky as S
import sc_island as I
import sc_props as P

SK, CL, LF = SB.SK, SB.CL, SB.LF
HZ = 178                                   # 광장 뒤 끝(지평선)


def far_island(wc, rows, seed):
    """먼 부유섬 하나: 윗면(버들항 잔디 + 섬 테 오토타일) + 단면·바위 뿌리(underside_layer)."""
    mask = [[False] * (wc + 2) for _ in range(rows + 9)]
    for y in range(1, 1 + rows):
        for x in range(1, wc + 1):
            if y == 1 and (x == 1 or x == wc): continue          # 윗모서리 깎기
            mask[y][x] = True
    lay, bot, cov = I.underside_layer(mask, seed=seed, root_max=40 + wc * 3)
    sheet = SB.autotile_sheet(I.rim_cell)
    top = SB.new(lay.width, lay.height)
    SB.at_paint(top, sheet, mask)
    lay.alpha_composite(top)
    return lay                                                 # 왼쪽 위 = 마스크 (0,0) 칸


def build():
    img = BB.canvas(SK[3])
    # --- 하늘: 4색 띠(위가 짙다) + 띠 안 큰 결 없이 손 구름 덩이
    BB.bands(img, 0, HZ, [SK[2], SK[3], SK[4], SK[5]], cuts=[38, 84, 128])
    for (x, y, w, h, sd) in ((18, 22, 96, 28, 3), (250, 12, 72, 22, 5), (430, 30, 120, 32, 8), (580, 8, 64, 20, 2),
                             (150, 62, 60, 18, 11), (520, 78, 80, 24, 6)):
        img.alpha_composite(S.cloud_puff(w, h, sd), (x, y))
    # --- 원경: 신전 섬(왼쪽 가운데), 흙덩이 섬들, 오른쪽 작은 섬
    isl = far_island(13, 2, 707)
    tmp = BB.Image.new('RGBA', isl.size, (0, 0, 0, 0)); tmp.alpha_composite(isl)
    tem = P.sky_temple()
    tmp.alpha_composite(tem, (16 + (13 * 16 - tem.width) // 2, 16 + 26 - tem.height + 6))
    tmp = BB.haze(tmp, SK[4], .30)
    # 신전 섬: 윗면이 y≈100 에 오도록(신전 꼭대기 y≈8)
    ix, iy = 70, 100 - 16
    img.alpha_composite(tmp.crop((0, max(0, -iy), tmp.width, tmp.height)), (ix, max(0, iy)))
    isl2 = BB.haze(far_island(5, 1, 712), SK[4], .42)
    img.alpha_composite(isl2, (430, 104))
    m = BB.haze(P.marble_column(), SK[4], .42); img.alpha_composite(m, (430 + 16 + 20, 104 + 16 - m.height + 4))
    m = BB.haze(P.marble_column(True, 1), SK[4], .42); img.alpha_composite(m, (430 + 16 + 44, 104 + 16 - m.height + 4))
    for (x, y, sz, sd, t) in ((372, 66, 'm', 2, .5), (602, 92, 'l', 12, .45), (24, 128, 's', 1, .5), (318, 118, 's', 4, .5)):
        c = BB.haze(P.clod(sz, sd), SK[4], t); img.alpha_composite(c, (x, y))
    # --- 구름 바다(지평선 앞, 섬 밑동을 묻는다)
    y0 = 128; hh = HZ + 6 - y0
    base = np.array(img.crop((0, y0, W, y0 + hh)).convert('RGB'))
    cover = lambda X, Y: max(0, min(1, (Y / hh) * 1.7 - .55 + .5 * (S.vnoise(X, Y, 40, 91) - .5)))
    sea, _ = S.cloud_sea(W, hh, cover, seed=93, step=12, rmin=6, rmax=18, sky=base)
    img.alpha_composite(sea, (0, y0))
    # --- 전투 바닥: 대리석 광장(가운데) + 양 끝 잔디(섬 윗면), 뒤 끝은 섬 테(북쪽 깎인 가장자리)
    lawn = I.LAWN
    BB.tile_image(img, lawn, HZ, H)
    sheet = SB.autotile_sheet(I.rim_cell)
    for x in range(0, W, 16):
        img.alpha_composite(SB.at_cell(sheet, 2 | 4 | 8), (x, HZ))            # 북쪽이 빈 테 칸
    mx0, mx1 = 104, 536
    BB.tile_floor(img, HZ + 12, H, I.tex_marble, ox=-mx0 % 48 + 4, oy=6, x0=mx0, x1=mx1)
    a = np.array(img)
    a[HZ + 12, mx0:mx1, :3] = SB.TRV[3]                                        # 판석 뒤 끝 연석
    a[HZ + 11, mx0:mx1, :3] = SB.TRV[2]
    a[HZ + 12:, mx0, :3] = SB.TRV[3]; a[HZ + 12:, mx0 - 1, :3] = SB.TRV[2]
    a[HZ + 12:, mx1 - 1, :3] = SB.TRV[2]; a[HZ + 12:, mx1, :3] = LF[2]
    img.paste(Image.fromarray(a, 'RGBA'))
    # --- 가장자리 물체(배틀러 자리 밖)
    BB.paste(img, P.marble_column(), 8, 244)
    BB.paste(img, P.crystal_float(), 40, 268)
    BB.paste(img, P.marble_urn(1), 86, 214)
    BB.paste(img, P.marble_column(True, 1), 14, 318)
    BB.paste(img, P.brazier_sky(), 92, 300)
    BB.paste(img, P.beacon_tower(), 584, 252)
    BB.paste(img, P.marble_urn(2), 566, 300)
    BB.paste(img, P.obelisk_sky(), 616, 336)
    # 뒤 끝 낮은 생울타리 화단(키 32px, 발이 지평선 뒤)
    for x, w, dy in ((146, 3, 0), (300, 2, -3), (418, 3, 2)):         # 간격·높이를 어긋나게(일렬 금지)
        BB.paste(img, P.hedge_trough(w, x), x, HZ + 14 + dy)
    return img

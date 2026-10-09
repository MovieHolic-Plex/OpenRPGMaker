# 고딕 마을 건물 키트 — 비 폐허 도시(rr_build)·폐허 마을(rv_house/rv_shell) 동결 사본의 조립 함수를 그대로 부르되,
# 마감(finish_house)을 밤비 대신 고딕 등급(gloom)으로 바꿔 끼운다. 결정적.
from gv_base import *
import rr_base, rr_build as RB, rv_house as RH, rv_shell as VS

def _G(im): return gloom(im)
# 동결 사본 안의 등급 함수를 고딕 등급으로 바꿔 끼운다(사본 모듈 전역만 바꾼다 — 원본 폴더는 그대로)
GSHEEN = [hx(c) for c in ('#2a3038', '#3a424c', '#4c5560', '#606a76', '#7a848e', '#98a1aa', '#b8c0c6')]   # 흐린 하늘빛 맺힘(젖은 윗모)
GPUD = [hx(c) for c in ('#0c0e12', '#161a20', '#20262e', '#2c333c', '#3a434e', '#4e5864', '#6c7682')]     # 고인 물(흐린 하늘 반사)
import rr_props as RP, rr_ground as RG
def _patch(m):
    m.night = _G; m.N = G_; m.LIT = AMBER; m.IRON = GIRON; m.SHEEN = GSHEEN; m.PUD = GPUD
    m.NMOSS = [G_(c) for c in R('moss')]; m.NST = [G_(c) for c in ST]; m.NWD = [G_(c) for c in WD]
for _m in (rr_base, RB, RP, RG): _patch(_m)

def _beams(day, wall_top):
    """반목조 들보(칩셋 밝은 갈색 나무)를 흑갈 들보 램프로, 회벽(칩셋 크림)을 회색 회벽 램프로 — 등급 전에(낮 공간)."""
    def is_wood(r, g, b): return r > g + 14 and g > b + 4 and lum3((r, g, b)) < 150
    def is_plaster(r, g, b): return r > 150 and g > 135 and b > 100 and abs(r - g) < 40 and r - b < 70
    px = day.load(); W, Hh = day.size
    for y in range(wall_top, Hh):
        for x in range(W):
            p = px[x, y]
            if p[3] < 200: continue
            if is_wood(*p[:3]): px[x, y] = ramp_fit(p, BEAM_D) + (255,)
            elif is_plaster(*p[:3]):
                c = ramp_fit(p, PLAST_D); i = PLAST_D.index(c)
                n = vnoise(x, y, 4.0, 77) + (H(x, y, 78) - 0.5) * 0.35
                if n > 0.62: i -= 1
                if n > 0.80: i -= 1
                if H(x // 2, 0, 79) > 0.86 and H(x, y // 3, 80) > 0.3: i -= 1          # 흘러내린 때 줄
                px[x, y] = PLAST_D[max(2, i)] + (255,)
    return day

# 낮 공간 램프(등급하면 BEAM/PLAST 쯤이 되도록 조금 밝고 따뜻하게)
BEAM_D = [hx(c) for c in ('#0a0605', '#1a110c', '#2a1c14', '#3a281c', '#4c3626', '#604632', '#765a42')]
PLAST_D = [hx(c) for c in ('#222224', '#363638', '#48484a', '#5a5a5a', '#6c6a66', '#7e7a72', '#908b80')]

HOUSE_K = 0.86
def gfinish(day, roof_rows, wall_top, lit=(), seed=1, moss=True, stains=True):
    """낮 집 그림 -> 고딕 집: 슬레이트 청회, 목골 흑갈·회벽 회색, 등급, 켜진 창 몇 개(호박), 빗물 얼룩, 밑동 이끼·잔풀."""
    day = slate(day)
    day = _beams(day, wall_top)
    im = gloom(day, GD, HOUSE_K); px = im.load(); W, Hh = im.size
    for b in lit: relight_glass(day, im, b, seed)
    if stains: drip_stains(px, W, Hh, 0, W, wall_top, Hh - 2, seed + 5, 0.18, 0.24)
    if moss: moss_foot(px, W, Hh, 0, W, Hh - 1, seed + 7, 7, 0.45)
    ntufts(px, W, Hh, 0, W, Hh - 1, seed + 9, 0.3, 3)
    return im
RB.finish_house = gfinish

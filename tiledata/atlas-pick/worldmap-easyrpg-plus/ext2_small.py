"""마을·촌락: 원본 1x1 집 아이콘(22-23, 8-9)을 그대로 옮겨 모아 붙인다(픽셀은 원본, 배치만 새로)."""
from wm_ext2_lib import *


def cell(c, r):
    return crop(c * 16, r * 16, c * 16 + 16, r * 16 + 16)


RED, WOOD, SNOW_RED, SNOW_WOOD = cell(22, 8), cell(22, 9), cell(23, 8), cell(23, 9)


def cluster(w, h, spots):
    a = blank(w, h)
    for (img, x, y) in spots:            # 뒤에서 앞으로
        paste(a, img, x, y)
    return a


BUSH, BUSH2, TREE = cell(19, 9), cell(18, 9), cell(18, 8)


def village(wood=WOOD, snow=False):
    """2x2 (32x32): 세 채(뒤 한 채, 앞 두 채)와 덤불. 원본 집 픽셀 그대로."""
    bush = BUSH if not snow else None
    spots = [(wood, 9, 1), (wood, 0, 16), (wood, 16, 16)]
    if bush is not None:
        spots.insert(0, (bush, 1, 2))
        spots.append((bush, 8, 16))
    return cluster(32, 32, spots)


def town(red=RED, wood=WOOD, snow=False):
    """3x3 (48x48): 일곱 채를 서로 살짝 겹치게 촘촘히(2라운드: 띄엄띄엄이면 마을이 아니라 오두막 흩뿌림) + 덤불.
    앞줄일수록 나중에 그려 앞 집이 뒤 집을 가린다."""
    sp = [(red, 6, 1), (wood, 19, 0), (red, 32, 2),
          (wood, 0, 14), (red, 13, 13), (wood, 27, 14), (red, 32, 17),
          (red, 4, 28), (wood, 17, 30), (red, 30, 30)]
    if not snow:
        sp = sp[:7] + [(BUSH2, 24, 19)] + sp[7:] + [(BUSH, 0, 32), (TREE, 32, 32)]
        sp = [x for x in sp if not (x[0] is red and x[1] == 30)]
    return cluster(48, 48, sp)


def town_bell(red=RED, wood=WOOD):
    """3x3: 원본 둥근 탑(14x31)을 왼쪽 뒤에 세우고, 집을 촘촘히 겹쳐 붙인다."""
    tw = crop(321, 192, 335, 223)
    a = blank(48, 48)
    paste(a, BUSH2, 19, 2)
    paste(a, wood, 32, 1)
    paste(a, tw, 6, 3)
    paste(a, red, 20, 12)
    paste(a, wood, 32, 17)
    paste(a, red, 0, 27)
    paste(a, wood, 14, 30)
    paste(a, red, 27, 31)
    paste(a, BUSH, 32, 32)
    return a


def town_snow():
    return town(SNOW_RED, SNOW_WOOD, snow=True)

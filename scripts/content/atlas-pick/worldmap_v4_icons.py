"""월드맵 4판 아이콘 — 크기 등급마다 한 장 그림(칸 경계에서 끊기지 않는다).

  hamlet 1×1 · village_2x2 · town_3x3 · castle_3x3 · castle_5x5 · cave 1×1 · tower 1×2
worldmap_v4_gen.py 가 ICON_JOBS 를 불러 쓴다. 건물 아랫단은 캔버스 바닥에서 2줄 위에 두고
그 아래에 옅은 그림자(-)를 깔아 「바닥에 선다」. 바깥 1px 은 wink 윤곽.
"""
import random
from worldmap_v4_gen import Img, outline

INK = ('wink', 0)


def rect(img, x0, y0, x1, y1, tok):
    for y in range(y0, y1):
        for x in range(x0, x1): img.put(x, y, tok)


def wall(img, x0, y0, x1, y1, ramp='wstone', base=4, mortar=3, brick=4):
    """돌·회벽 면: 왼쪽 밝게, 오른쪽 어둡게, 줄눈."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = base
            if x == x0: t = base + 1
            elif x >= x1 - 1: t = base - 1
            elif (y - y0) % brick == brick - 1: t = mortar
            elif (y - y0) % brick == 0 and (x + (y - y0) // brick * 3) % 6 == 0: t = mortar
            img.put(x, y, (ramp, t))


def crenels(img, x0, x1, y, ramp='wstone', base=4, step=3):
    for x in range(x0, x1):
        if ((x - x0) // 2) % 2 == 0:
            for k in range(2):
                img.put(x, y - k, (ramp, base + (1 if k == 0 else 0) if x < (x0 + x1) // 2 else base - (0 if k else 0)))


def cone(img, cx, top, h, half, ramp, base):
    for k in range(h):
        hw = 0 if k == 0 else max(1, (k * half) // (h - 1))
        for dx in range(-hw, hw + 1):
            t = base + 1 if dx < 0 else (base - 1 if dx > 0 else base)
            if k > 0 and dx == -hw: t = base + 1
            img.put(cx + dx, top + k, (ramp, max(0, t)))
    img.put(cx, top - 1, ('wgold', 3))


def gable(img, x0, x1, top, h, ramp, base):
    """지붕 옆면(삼각)이 아니라 정면 맞배: 위가 좁은 사다리꼴."""
    w = x1 - x0
    for k in range(h):
        inset = max(0, (h - 1 - k) * (w // 2 - 1) // max(1, h - 1) // 2)
        for x in range(x0 + inset, x1 - inset):
            t = base + (1 if k < 2 else 0)
            if k == h - 1: t = base - 1
            if x >= x1 - inset - 1: t = base - 1
            img.put(x, top + k, (ramp, max(0, t)))


def flag(img, x, y, h, col=('wroofr', 3)):
    for k in range(h): img.put(x, y + k, ('wbark', 1))
    for dx in range(1, 4):
        for dy in range(2): img.put(x + dx, y + dy, ('wroofr', 3 if dy == 0 else 2))


def door(img, x0, y0, w, h, arch=True):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if arch and y == y0 and (x == x0 or x == x0 + w - 1): continue
            img.put(x, y, ('wbark', 1 if y > y0 else 2))


def window(img, x, y):
    img.put(x, y, ('wink', 0)); img.put(x, y + 1, ('wgold', 2))


def house(img, x, y, w, h, roof=('wroofr', 3), wallramp=('wplast', 4)):
    """작은 집: 벽 h 줄 + 지붕."""
    rh = max(3, w // 2 + 1)
    for yy in range(y + rh, y + rh + h):
        for xx in range(x, x + w):
            t = wallramp[1] + (1 if xx == x else (-1 if xx == x + w - 1 else 0))
            img.put(xx, yy, (wallramp[0], t))
    gable(img, x - 1, x + w + 1, y, rh, roof[0], roof[1])
    door(img, x + w // 2 - 1, y + rh + h - 3, 2, 3, arch=False)
    if w >= 6: window(img, x + 1, y + rh + 1)


def shadow(img, x0, x1, y):
    for x in range(x0, x1):
        if img.get(x, y) is None: img.put(x, y, '-')
        if img.get(x, y + 1) is None and x0 + 1 < x < x1 - 1: img.put(x, y + 1, '-')


def finish(img, bottom):
    outline(img, INK)
    shadow(img, 1, img.w - 1, bottom)
    return img


def tree(img, cx, top, r=3):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + 1:
                s = dx + dy
                img.put(cx + dx, top + r + dy, ('wleaf', 4 if s < -1 else (2 if s > 1 else 3)))
    img.put(cx, top + 2 * r + 1, ('wbark', 1)); img.put(cx, top + 2 * r + 2, ('wbark', 1))


# ---------------------------------------------------------------- 아이콘
def hamlet():
    im = Img(16, 16)
    house(im, 2, 5, 5, 4, ('wroofr', 3))
    house(im, 9, 3, 5, 5, ('wroofb', 3))
    return finish(im, 14)


def village_2x2():
    im = Img(32, 32)
    house(im, 3, 12, 8, 7, ('wroofr', 3))
    house(im, 17, 9, 8, 8, ('wroofb', 3))
    house(im, 9, 20, 7, 5, ('wroofr', 3))
    tree(im, 27, 18, 3)
    for x in range(12, 20): im.put(x, 27, ('wdirt', 3))
    return finish(im, 29)


def town_3x3():
    im = Img(48, 48)
    # 성벽(뒤) + 성문 + 집들 + 가운데 종탑
    wall(im, 4, 26, 44, 40)
    crenels(im, 4, 44, 26)
    door(im, 21, 31, 6, 9)
    for x in (4, 42):
        wall(im, x - 1, 20, x + 3, 40); cone(im, x + 1, 14, 7, 4, 'wroofr', 3)
    house(im, 8, 15, 8, 6, ('wroofr', 3))
    house(im, 32, 16, 8, 5, ('wroofb', 3))
    wall(im, 20, 8, 28, 30, brick=4); crenels(im, 20, 28, 8); cone(im, 24, 1, 6, 6, 'wroofb', 3)
    window(im, 23, 14)
    return finish(im, 44)


def castle_3x3():
    im = Img(48, 48)
    wall(im, 6, 26, 42, 40)               # 커튼월
    crenels(im, 6, 42, 26)
    for x in (2, 40):                     # 모서리 탑 둘(앞)
        wall(im, x, 18, x + 6, 40); crenels(im, x, x + 6, 18)
        cone(im, x + 3, 11, 8, 5, 'wroofr', 3); flag(im, x + 3, 5, 5)
    wall(im, 15, 10, 33, 30, brick=4)     # 본성
    crenels(im, 15, 33, 10)
    cone(im, 24, 2, 8, 6, 'wroofb', 3)
    wall(im, 20, 18, 28, 30, base=4, mortar=2)
    door(im, 21, 32, 6, 8)
    window(im, 18, 15); window(im, 29, 15); window(im, 23, 20)
    return finish(im, 44)


def castle_5x5():
    im = Img(80, 78)          # 그린 뒤 아래로 2줄 밀어 발이 캔버스 아래 3px 안에 오게 한다
    wall(im, 6, 46, 74, 66); crenels(im, 6, 74, 46)            # 앞 성벽
    wall(im, 20, 30, 60, 50); crenels(im, 20, 60, 30)          # 안쪽 벽
    for x in (1, 71):                                           # 앞 모서리 둥근 탑
        wall(im, x, 32, x + 8, 66); crenels(im, x, x + 8, 32)
        cone(im, x + 4, 22, 11, 7, 'wroofr', 3); flag(im, x + 4, 14, 8)
    for x in (16, 58):                                          # 옆탑
        wall(im, x, 20, x + 6, 48); crenels(im, x, x + 6, 20)
        cone(im, x + 3, 12, 8, 5, 'wroofb', 3)
    wall(im, 30, 12, 50, 50, brick=4); crenels(im, 30, 50, 12) # 중앙 본성
    cone(im, 40, 2, 10, 11, 'wroofb', 3)
    for x, y in ((34, 20), (44, 20), (34, 30), (44, 30), (39, 38)): window(im, x, y)
    wall(im, 26, 50, 54, 66, mortar=2)                          # 문루
    crenels(im, 26, 54, 50)
    door(im, 35, 54, 10, 12)
    for x in range(35, 45): im.put(x, 55, ('wink', 0))
    for y in range(66, 71):                                     # 길 꼬리
        for x in range(37, 43): im.put(x, y, ('wdirt', 3 if y % 2 else 2))
    finish(im, 74)
    out = Img(80, 80)
    out.blit(im, 0, 2)
    return out


def cave():
    im = Img(16, 16)
    for y in range(3, 14):
        hw = min(7, 2 + (y - 3) * 6 // 8)
        for x in range(8 - hw, 8 + hw):
            im.put(x, y, ('wrock', 4 if x < 7 - hw // 3 else (2 if x > 8 + hw // 3 else 3)))
    for y in range(8, 14):
        for x in range(6, 11):
            if (x - 8) ** 2 // 2 + (13 - y) < 5: im.put(x, y, ('wink', 0))
    return finish(im, 14)


def tower():
    im = Img(16, 32)
    wall(im, 4, 12, 12, 28); crenels(im, 4, 12, 12)
    cone(im, 8, 4, 8, 5, 'wroofr', 3); flag(im, 8, 0, 3)
    door(im, 6, 23, 4, 5); window(im, 7, 16)
    return finish(im, 29)


ICON_JOBS = {'hamlet': hamlet, 'village_2x2': village_2x2, 'town_3x3': town_3x3,
             'castle_3x3': castle_3x3, 'castle_5x5': castle_5x5, 'cave': cave, 'tower': tower}

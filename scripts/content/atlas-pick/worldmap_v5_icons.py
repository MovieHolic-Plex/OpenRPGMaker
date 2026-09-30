"""월드맵 5판 아이콘 — 4판과 같은 크기 등급(hamlet 1×1 · village 2×2 · town 3×3 · castle 3×3/5×5 · cave · tower 1×2),
색은 지형 톤에 가라앉히고(밝은 벽 → 중간 회색, 지붕 채도↓) 검은 외곽선 대신 지형과 비슷한 어두운 1px 그늘만 둔다.
FF6 실측: 마을 아이콘은 6~8px 집 4~6채 + 작은 나무. 여기서는 등급 크기를 지키느라 집이 그보다 크므로 채도·대비로 눌렀다."""
from worldmap_v4_gen import Img, outline
import worldmap_v4_icons as I
from worldmap_v4_icons import rect, wall, crenels, cone, gable, flag, door, window, shadow

RIM = ('wgrass', 0)      # 지형 톤의 아주 어두운 초록(검정 아님)


def finish(img, bottom):
    outline(img, RIM)
    shadow(img, 1, img.w - 1, bottom)
    return img


def house(img, x, y, w, h, roof=('wroofr', 1), wallramp=('wplast', 1)):
    rh = max(3, w // 2 + 1)
    for yy in range(y + rh, y + rh + h):
        for xx in range(x, x + w):
            t = wallramp[1] + (1 if xx == x else (-1 if xx == x + w - 1 else 0))
            img.put(xx, yy, (wallramp[0], t))
    gable(img, x - 1, x + w + 1, y, rh, roof[0], roof[1])
    I.door(img, x + w // 2 - 1, y + rh + h - 3, 2, 3, arch=False)


def tree(img, cx, top, r=2):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + 1:
                img.put(cx + dx, top + r + dy, ('wleaf', 3 if dx + dy < -1 else (1 if dx + dy > 1 else 2)))
    img.put(cx, top + 2 * r + 1, ('wbark', 0))


W = dict(base=2, mortar=1, brick=4)


def hamlet():
    im = Img(16, 16)
    house(im, 2, 6, 5, 4, ('wroofr', 1)); house(im, 9, 4, 5, 5, ('wroofb', 1))
    return finish(im, 14)


def village_2x2():
    im = Img(32, 32)
    house(im, 3, 12, 8, 7, ('wroofr', 1)); house(im, 17, 9, 8, 8, ('wroofb', 1)); house(im, 9, 20, 7, 5, ('wroofr', 1))
    tree(im, 27, 19, 2); tree(im, 29, 14, 2)
    return finish(im, 29)


def town_3x3():
    im = Img(48, 48)
    wall(im, 4, 26, 44, 40, **W); crenels(im, 4, 44, 26, base=2)
    door(im, 21, 31, 6, 9)
    for x in (4, 42):
        wall(im, x - 1, 20, x + 3, 40, **W); cone(im, x + 1, 14, 7, 4, 'wroofr', 1)
    house(im, 8, 15, 8, 6, ('wroofr', 1)); house(im, 32, 16, 8, 5, ('wroofb', 1))
    wall(im, 20, 8, 28, 30, **W); crenels(im, 20, 28, 8, base=2); cone(im, 24, 1, 6, 6, 'wroofb', 1)
    window(im, 23, 14)
    return finish(im, 44)


def castle_3x3():
    im = Img(48, 48)
    wall(im, 6, 26, 42, 40, **W); crenels(im, 6, 42, 26, base=2)
    for x in (2, 40):
        wall(im, x, 18, x + 6, 40, **W); crenels(im, x, x + 6, 18, base=2)
        cone(im, x + 3, 11, 8, 5, 'wroofr', 1); flag(im, x + 3, 5, 5)
    wall(im, 15, 10, 33, 30, **W); crenels(im, 15, 33, 10, base=2)
    cone(im, 24, 2, 8, 6, 'wroofb', 1)
    wall(im, 20, 18, 28, 30, base=2, mortar=0)
    door(im, 21, 32, 6, 8)
    window(im, 18, 15); window(im, 29, 15); window(im, 23, 20)
    return finish(im, 44)


def castle_5x5():
    im = Img(80, 78)
    wall(im, 6, 46, 74, 66, **W); crenels(im, 6, 74, 46, base=2)
    wall(im, 20, 30, 60, 50, **W); crenels(im, 20, 60, 30, base=2)
    for x in (1, 71):
        wall(im, x, 32, x + 8, 66, **W); crenels(im, x, x + 8, 32, base=2)
        cone(im, x + 4, 22, 11, 7, 'wroofr', 1); flag(im, x + 4, 14, 8)
    for x in (16, 58):
        wall(im, x, 20, x + 6, 48, **W); crenels(im, x, x + 6, 20, base=2)
        cone(im, x + 3, 12, 8, 5, 'wroofb', 1)
    wall(im, 30, 12, 50, 50, **W); crenels(im, 30, 50, 12, base=2)
    cone(im, 40, 2, 10, 11, 'wroofb', 1)
    for x, y in ((34, 20), (44, 20), (34, 30), (44, 30), (39, 38)): window(im, x, y)
    wall(im, 26, 50, 54, 66, base=2, mortar=0); crenels(im, 26, 54, 50, base=2)
    door(im, 35, 54, 10, 12)
    for y in range(66, 71):
        for x in range(37, 43): im.put(x, y, ('wdirt', 2 if y % 2 else 1))
    finish(im, 74)
    out = Img(80, 80); out.blit(im, 0, 2)
    return out


def cave():
    im = Img(16, 16)
    for y in range(3, 14):
        hw = min(7, 2 + (y - 3) * 6 // 8)
        for x in range(8 - hw, 8 + hw):
            im.put(x, y, ('wrock', 3 if x < 7 - hw // 3 else (1 if x > 8 + hw // 3 else 2)))
    for y in range(8, 14):
        for x in range(6, 11):
            if (x - 8) ** 2 // 2 + (13 - y) < 5: im.put(x, y, ('wrock', 0))
    return finish(im, 14)


def tower():
    im = Img(16, 32)
    wall(im, 4, 12, 12, 28, **W); crenels(im, 4, 12, 12, base=2)
    cone(im, 8, 4, 8, 5, 'wroofr', 1); flag(im, 8, 0, 3)
    door(im, 6, 23, 4, 5); window(im, 7, 16)
    return finish(im, 29)


ICON_JOBS = {'hamlet': hamlet, 'village_2x2': village_2x2, 'town_3x3': town_3x3,
             'castle_3x3': castle_3x3, 'castle_5x5': castle_5x5, 'cave': cave, 'tower': tower}

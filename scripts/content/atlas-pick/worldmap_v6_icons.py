"""월드맵 6판 도시·성 세트 — 목표 실측(worldmap-v6-target.md)의 「푸른 지붕 건물 5~9채 + 한 개의 문 + 중앙 성 + 목조 2층집 둘」.

4·5판은 아이콘이 집 하나에 삼각 지붕을 얹은 기호였다. 6판은 건물을 「그린다」:
- 지붕은 비스듬히 본 면 하나(가로 이음 2줄마다 어두운 선 + 어긋난 밝은 눈), 용마루는 밝게, 처마 밑은 어둡게.
- 벽은 회벽(왼쪽 밝고 오른쪽 어둡다) + 2×3 창 + 문. 목조집은 벽 위에 검은 갈색 보 · 기둥을 긋는다.
- 바깥 윤곽은 wink(#0f0d08) 1px, 발치에 반투명 그림자(-).
모든 화소는 좌표로 직접 찍는다(생성 그림 밑그림 없음).

  python3 scripts/content/atlas-pick/worldmap_v6_icons.py --info    # 새 slug 의 info.json 을 쓴다
worldmap_v6_gen.py 가 ICON_JOBS 를 불러 쓴다.
"""
import json, pathlib, sys
from worldmap_v4_gen import Img, outline, CAND

INK = ('wink', 0)


def rect(img, x0, y0, x1, y1, tok):
    for y in range(y0, y1):
        for x in range(x0, x1): img.put(x, y, tok)


def shadow(img, x0, x1, y):
    for x in range(x0, x1):
        if img.get(x, y) is None: img.put(x, y, '-')
        if img.get(x, y + 1) is None and x0 + 1 < x < x1 - 1: img.put(x, y + 1, '-')


def finish(img, bottom, x0=1, x1=None):
    outline(img, INK)
    shadow(img, x0, (img.w - 1) if x1 is None else x1, bottom)
    return img


# ------------------------------------------------------------------ 지붕
def roof_slab(img, x0, x1, y0, y1, ramp='wroofb', hi=4, lo=2):
    """앞으로 기운 지붕 한 면: 용마루(위) 밝게 → 처마(아래) 어둡게. 2줄마다 이음선, 이음마다 어긋난 밝은 눈."""
    h = y1 - y0
    for k, y in enumerate(range(y0, y1)):
        for x in range(x0, x1):
            t = hi if k < 2 else (lo + 1 if k < h - 2 else lo)
            if k == 0: t = min(5, hi + 1)
            if k >= 2 and k % 3 == 2: t = max(0, t - 1)
            elif k >= 2 and (x + k * 2) % 5 == 0: t = min(5, t + 1)
            if x == x0: t = min(5, t + 1)
            if x >= x1 - 2: t = max(0, t - 1)
            img.put(x, y, (ramp, t))
    for x in range(x0, x1): img.put(x, y1 - 1, (ramp, 0))


def gable_tri(img, cx, top, h, half, ramp, base):
    """정면 맞배 삼각: 왼쪽 밝고 오른쪽 어둡다. 이음선."""
    for k in range(h):
        hw = 0 if k == 0 else max(1, (k * half) // (h - 1))
        for dx in range(-hw, hw + 1):
            t = base + (1 if dx < 0 else (-1 if dx > 0 else 0))
            if k % 3 == 2: t -= 1
            if abs(dx) == hw and k > 0: t = base - 1 if dx > 0 else base + 1
            img.put(cx + dx, top + k, (ramp, max(0, min(5, t))))
    for dx in range(-half - 1, half + 2):
        img.put(cx + dx, top + h, (ramp, 0))


def cone(img, cx, top, h, half, ramp='wroofb', base=3):
    for k in range(h):
        hw = 0 if k == 0 else max(1, (k * half) // (h - 1))
        for dx in range(-hw, hw + 1):
            t = base + 1 if dx < -hw // 3 else (base - 1 if dx > hw // 3 else base)
            if k % 3 == 2: t -= 1
            img.put(cx + dx, top + k, (ramp, max(0, min(5, t))))
    img.put(cx, top - 1, ('wgold', 3)); img.put(cx, top - 2, ('wgold', 2))


# ------------------------------------------------------------------ 벽
def plaster(img, x0, y0, x1, y1, ramp='wplast', base=4):
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = base
            if x == x0: t = base + 1
            elif x >= x1 - 2: t = base - 1 if x == x1 - 2 else base - 2
            if y == y0: t = max(0, t - 2)          # 처마 그늘
            elif y == y0 + 1: t = max(0, t - 1)
            img.put(x, y, (ramp, max(0, min(5, t))))


def stone_face(img, x0, y0, x1, y1, base=4, ramp='wstone'):
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = base
            if x == x0: t = base + 1
            elif x >= x1 - 2: t = base - 1
            r = (y - y0) % 4
            if r == 3: t = base - 2
            elif r == 0 and (x + ((y - y0) // 4) * 3) % 6 == 0: t = base - 2
            img.put(x, y, (ramp, max(0, min(6, t))))


def window(img, x, y, w=2, h=3):
    rect(img, x, y, x + w, y + h, ('wroofb', 1))
    img.put(x, y, ('wroofb', 3)); img.put(x, y + 1, ('wroofb', 2))
    rect(img, x - 1, y - 1, x + w + 1, y, ('wplast', 5)) if img.get(x, y - 1) is not None else None


def door(img, x0, y0, w, h, arch=False):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if arch and y == y0 and (x == x0 or x == x0 + w - 1): continue
            img.put(x, y, ('wbark', 1 if x < x0 + w - 1 else 0))
    if w >= 3: img.put(x0 + w - 2, y0 + h // 2, ('wgold', 3))


def crenels(img, x0, x1, y, base=4):
    for x in range(x0, x1):
        if ((x - x0) // 2) % 2 == 0:
            img.put(x, y - 1, ('wstone', base + 1 if x < (x0 + x1) // 2 else base - 1))
            img.put(x, y - 2, ('wstone', base + 2 if x < (x0 + x1) // 2 else base))


# ------------------------------------------------------------------ 건물
def blue_house(img, x, y, w, roof_h, wall_h, dormer=True, chimney=True, tone=3):
    """푸른 지붕 회벽집(정면 긴 변). y = 지붕 윗줄."""
    roof_slab(img, x - 1, x + w + 1, y, y + roof_h, 'wroofb', tone + 1, tone - 1)
    if chimney:
        rect(img, x + w - 7, y - 3, x + w - 4, y + 3, ('wstone', 3))
        rect(img, x + w - 7, y - 3, x + w - 6, y + 3, ('wstone', 4))
        rect(img, x + w - 7, y - 4, x + w - 4, y - 3, ('wstone', 5))
    wy = y + roof_h
    plaster(img, x, wy, x + w, wy + wall_h)
    n = max(1, (w - 8) // 7)
    xs = [x + 3 + i * ((w - 9) // max(1, n - 1)) if n > 1 else x + 3 for i in range(n)]
    for wx in xs: window(img, wx, wy + 3)
    door(img, x + w - 7, wy + wall_h - 6, 3, 6)
    if dormer and w >= 20:
        gable_tri(img, x + w // 3, y - 1, 7, 6, 'wroofb', tone)
        rect(img, x + w // 3 - 1, y + 3, x + w // 3 + 1, y + 6, ('wink', 0))


def timber_house(img, x, y, w, roof_h, storeys=2, sto_h=8, mirror=False, roof='wroofr', wall_base=4):
    """목조 2층집: 정면 맞배(뾰족한 삼각 지붕), 아래 두 층 회벽 + 검은 갈색 보·기둥, 위층이 살짝 튀어나온다."""
    cx = x + w // 2
    gable_tri(img, cx, y, roof_h, w // 2 + 1, roof, 3)
    wy = y + roof_h + 1
    bh = storeys * sto_h
    for s in range(storeys):
        y0 = wy + s * sto_h
        ox = 1 if s == 0 and storeys > 1 else 0          # 위층 오버행
        plaster(img, x + (0 if s == 0 else -ox), y0, x + w + (0 if s == 0 else ox), y0 + sto_h, 'wplast', wall_base)
        for xx in range(x - ox * (1 if s == 0 else 0), x + w + ox * (1 if s == 0 else 0)):
            img.put(xx, y0, ('wbark', 1)) if s > 0 or True else None
        for xx in (x, x + w // 2, x + w - 1):
            for yy in range(y0, y0 + sto_h): img.put(xx, yy, ('wbark', 1))
        for k in range(1, 3):                              # X자 버팀
            img.put(x + 1 + k, y0 + 1 + k, ('wbark', 2)); img.put(x + w - 2 - k, y0 + 1 + k, ('wbark', 2))
        window(img, x + w // 4 - 1, y0 + 3, 2, 3) if s == 0 else window(img, x + w // 4 - 1, y0 + 3, 2, 3)
        window(img, x + (3 * w) // 4 - 1, y0 + 3, 2, 3)
    door(img, cx - 1, wy + bh - 6, 3, 6)
    return wy + bh


# ------------------------------------------------------------------ 아이콘
def house_blue_a():
    im = Img(32, 32)
    blue_house(im, 3, 6, 24, 9, 12, dormer=True)
    return finish(im, 29)


def house_blue_b():
    """짧고 높은 집: 지붕이 크고 벽이 낮다."""
    im = Img(32, 32)
    blue_house(im, 5, 5, 20, 10, 11, dormer=False, tone=3)
    gable_tri(im, 22, 6, 9, 6, 'wroofb', 3)
    return finish(im, 29)


def hall_blue():
    """성 안 긴 홀 48×32: 지붕 두 단(앞 낮은 날개 + 뒤 높은 몸채)."""
    im = Img(48, 32)
    roof_slab(im, 4, 44, 3, 11, 'wroofb', 4, 2)
    rect(im, 30, 0, 33, 5, ('wstone', 4)); rect(im, 30, 0, 31, 5, ('wstone', 5))
    roof_slab(im, 2, 46, 11, 19, 'wroofb', 3, 1)
    plaster(im, 3, 19, 45, 29, 'wplast', 4)
    for wx in range(6, 42, 7): window(im, wx, 22)
    door(im, 21, 23, 4, 6, arch=True)
    for wx in range(7, 44, 14): im.put(wx, 10, ('wgold', 3))
    return finish(im, 30)


def tower_blue():
    """푸른 원뿔 지붕 돌탑 16×32."""
    im = Img(16, 32)
    cone(im, 8, 4, 11, 7, 'wroofb', 3)
    stone_face(im, 3, 15, 13, 29)
    for x in range(3, 13):
        if (x - 3) % 3 != 2: im.put(x, 14, ('wstone', 5 if x < 8 else 3))
    im.put(7, 19, ('wink', 0)); im.put(7, 20, ('wink', 0)); im.put(8, 19, ('wink', 0)); im.put(8, 20, ('wink', 0))
    door(im, 6, 25, 4, 4, arch=True)
    return finish(im, 29)


def gate_tower():
    """성문(도시 성벽 한복판) 32×32: 두 돌탑 사이 어두운 문. 위에 푸른 지붕 한 채."""
    im = Img(32, 32)
    stone_face(im, 2, 12, 30, 28)
    for x0 in (1, 23):
        stone_face(im, x0, 6, x0 + 8, 28)
        crenels(im, x0, x0 + 8, 6)
    roof_slab(im, 9, 23, 3, 8, 'wroofb', 4, 2)
    for x in range(9, 23):
        if (x - 9) % 3 != 2: im.put(x, 12, ('wstone', 5 if x < 16 else 3))
    for y in range(17, 28):
        for x in range(12, 20):
            if y == 17 and x in (12, 19): continue
            im.put(x, y, ('wink', 0) if y < 26 else ('wdirt', 3))
    for x in range(13, 19): im.put(x, 18, ('wbark', 2))
    for y in range(19, 26): im.put(15, y, ('wbark', 1)); im.put(16, y, ('wbark', 1)) if y % 2 else None
    window(im, 4, 12); window(im, 25, 12)
    return finish(im, 29)


def timber_a():
    im = Img(32, 48)
    b = timber_house(im, 6, 3, 20, 14, storeys=2, sto_h=13, roof='wroofr')
    return finish(im, b + 1)


def timber_b():
    """옆집: 지붕 붉은 빛이 짙고 작은 굴뚝, 폭 좁고 층고 큼."""
    im = Img(32, 48)
    b = timber_house(im, 8, 5, 16, 12, storeys=2, sto_h=14, roof='wroofr', wall_base=3)
    rect(im, 21, 4, 24, 14, ('wstone', 3)); rect(im, 21, 4, 22, 14, ('wstone', 4)); rect(im, 21, 3, 24, 4, ('wstone', 5))
    return finish(im, b + 1)


def castle_keep():
    """마당 있는 성 64×64: 바깥 성벽 + 모서리 푸른 원뿔탑 4 + 안뜰 + 중앙 푸른 홀 + 정문."""
    im = Img(64, 64)
    # 안뜰 바닥(회색 포석)
    for y in range(20, 50):
        for x in range(8, 56):
            im.put(x, y, ('wstone', 3 if (x + y) % 5 else 2))
    # 뒤 성벽(윗면 얇은 면 + 앞면)
    stone_face(im, 6, 14, 58, 21, base=4); crenels(im, 6, 58, 14)
    # 좌·우 성벽(옆면: 윗면 띠 + 안쪽 그림자)
    for x0, x1 in ((6, 10), (54, 58)):
        rect(im, x0, 21, x1, 50, ('wstone', 5 if x0 < 30 else 3))
        for y in range(21, 50):
            im.put(x0 + 1, y, ('wstone', 6 if x0 < 30 else 4)) if (y // 3) % 2 == 0 else None
    # 안뜰 홀들(푸른 지붕)
    roof_slab(im, 14, 50, 24, 31, 'wroofb', 4, 2)
    plaster(im, 15, 31, 49, 40, 'wplast', 4)
    for wx in range(18, 46, 6): window(im, wx, 33)
    door(im, 30, 34, 4, 6, arch=True)
    roof_slab(im, 12, 26, 41, 46, 'wroofb', 3, 1); roof_slab(im, 40, 54, 41, 46, 'wroofb', 3, 1)
    # 앞 성벽 + 정문
    stone_face(im, 6, 46, 58, 58, base=4); crenels(im, 6, 58, 46)
    for y in range(49, 58):
        for x in range(26, 38):
            if y == 49 and x in (26, 37): continue
            im.put(x, y, ('wink', 0) if y < 57 else ('wdirt', 3))
    for x in range(27, 37): im.put(x, 50, ('wbark', 2))
    # 모서리 탑 4
    for cx, base_y in ((7, 58), (56, 58)):
        stone_face(im, cx - 5, 28, cx + 5, base_y, base=4); crenels(im, cx - 5, cx + 5, 28)
        cone(im, cx, 16, 11, 6, 'wroofb', 3)
    for cx in (7, 56):
        stone_face(im, cx - 4, 8, cx + 4, 20, base=4)
        cone(im, cx, 0 + 2, 6, 5, 'wroofb', 3)
    return finish(im, 61)


def city_district():
    """도시 한 구역 64×48: 회색 돌 건물 빽빽 + 푸른·짙은 지붕 몇 채, 사이 포석 길."""
    im = Img(64, 48)
    for y in range(6, 44):
        for x in range(1, 63):
            im.put(x, y, ('wstone', 2 if (x * 7 + y * 3) % 11 else 3))
    spots = [(2, 6, 18, 6, 6, 'wroofb'), (22, 5, 16, 7, 7, 'wroofb'), (42, 6, 19, 6, 6, 'wroofr'),
             (3, 22, 14, 6, 6, 'wroofr'), (19, 21, 18, 6, 7, 'wroofb'), (41, 22, 20, 7, 6, 'wroofb'),
             (5, 36, 22, 5, 4, 'wroofb'), (30, 36, 16, 5, 4, 'wroofr'), (48, 36, 13, 5, 4, 'wroofb')]
    for (x, y, w, rh, wh, rr) in spots:
        roof_slab(im, x, x + w, y, y + rh, rr, 3, 1)
        stone_face(im, x, y + rh, x + w, y + rh + wh, base=4)
        for wx in range(x + 2, x + w - 2, 4): im.put(wx, y + rh + 2, ('wink', 0))
    # 중앙 푸른 탑
    cone(im, 32, 0, 9, 4, 'wroofb', 3)
    stone_face(im, 28, 9, 36, 20)
    return finish(im, 45)


ICON_JOBS = {'house_blue_a': house_blue_a, 'house_blue_b': house_blue_b, 'hall_blue': hall_blue, 'tower_blue': tower_blue,
             'gate_tower': gate_tower, 'timber_a': timber_a, 'timber_b': timber_b, 'castle_keep': castle_keep,
             'city_district': city_district}

ICON_INFO = {
    'house_blue_a': ('푸른 지붕 회벽집(긴 변)', [2, 2], '2×2 정면 긴 집. 푸른 지붕 한 면·굴뚝·지붕창·창 셋·문.'),
    'house_blue_b': ('푸른 지붕 회벽집(높은 변)', [2, 2], '2×2 높은 지붕 집. 앞 맞배 하나.'),
    'hall_blue': ('성 안 긴 홀', [3, 2], '3×2 두 단 푸른 지붕의 긴 홀. 창 줄과 아치 문.'),
    'tower_blue': ('푸른 원뿔 돌탑', [1, 2], '1×2 돌탑, 푸른 원뿔 지붕, 금 꼭대기.'),
    'gate_tower': ('도시 성문', [2, 2], '2×2 두 돌탑 사이 어두운 문. 성곽선 한복판.'),
    'timber_a': ('목조 2층집 A', [2, 3], '2×3 붉은 지붕, 회벽 위 보·기둥, 위층 오버행.'),
    'timber_b': ('목조 2층집 B', [2, 3], '2×3 좁고 높은 목조집, 굴뚝.'),
    'castle_keep': ('마당 있는 성', [4, 4], '4×4 바깥 성벽·모서리 푸른 원뿔탑·안뜰·푸른 홀·정문.'),
    'city_district': ('성벽 안 도시 구역', [4, 3], '4×3 돌 건물 빽빽한 구역, 푸른·붉은 지붕과 중앙 탑.'),
}


def write_infos():
    for slug, (name, cells, desc) in ICON_INFO.items():
        d = CAND / slug
        d.mkdir(parents=True, exist_ok=True)
        info = {"id": slug, "slug": slug, "name": name, "scene": "성·마을", "kind": "icon", "cells": cells,
                "canvas": [cells[0] * 16, cells[1] * 16], "layer": "object", "layer_ko": "위층 단품(그림자 포함)",
                "under": "plains", "under_ko": "평원 풀(plains_base 고른 판)", "passage": "block",
                "description": '6판: ' + desc, "palette_hint": "wstone,wplast,wroofb,wroofr,wink", "worker": "v6"}
        (d / 'info.json').write_text(json.dumps(info, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print('info', slug)


if __name__ == '__main__':
    if '--info' in sys.argv: write_infos()

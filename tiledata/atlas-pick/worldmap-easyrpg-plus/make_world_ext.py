"""EasyRPG World 개선판 — 확장 아이콘 시트 (크기 단계 1x1 / 1x2 / 2x2 / 3x3 / 5x5).

  python3 make_world_ext.py     -> world-plus-ext.png, world-plus-ext.json

모든 픽셀은 wm_draw 의 좌표·규칙으로 직접 정한다. 생성 모델·트레이싱 없음.
배경은 원본과 같은 분홍 키색(255,103,139). 아이콘마다 1px 검정 윤곽(111618)을 자동으로 두른다.
"""
# SUPERSEDED: v1 확장 시트(28종)는 원본과 안 어울려 폐기. 다시 돌리면 world-plus-ext.png 를 덮는다. 현행은 make_world_ext2.py.
import sys
if __name__ == "__main__" and "--force-old" not in sys.argv:
    sys.exit("make_world_ext.py 는 폐기됨: make_world_ext2.py 를 쓴다")
import json
from pathlib import Path

import numpy as np
from PIL import Image

from wm_lib import PINK, CELL
from wm_draw import (Cv, OL, STONE, BONE, SAND, BLUE, RED, WOOD, SNOW, GREEN, SLATE, WATER, WIN, GOLD,
                     brick, crenel, wall, cone, tower, roof_gable, house, tree, arch_gate, flag, boat,
                     quay, water_patch)

HERE = Path(__file__).resolve().parent
ICONS = []  # (name, tier, wcells, hcells, fn, 설명)


def icon(name, tier, w, h, desc):
    def deco(fn):
        ICONS.append((name, tier, w, h, fn, desc))
        return fn
    return deco


def mound(cv, x0, x1, ytop, ybase, cols):
    """바위 둔덕: 가운데가 높은 반타원. cols=(밝은,중간,어두운,그늘)."""
    cx = (x0 + x1) / 2
    hw = (x1 - x0) / 2
    for y in range(ytop, ybase + 1):
        t = (y - ytop) / max(1, ybase - ytop)
        w = hw * (t ** 0.6)
        for x in range(int(cx - w + 0.5), int(cx + w + 0.5) + 1):
            k = (x - cx) / max(1, hw) + (y - ytop) * 0.04
            c = cols[1]
            if k < -0.25 and t < 0.85:
                c = cols[0]
            elif k > 0.25:
                c = cols[2]
            if (x * 3 + y * 5) % 11 == 0:
                c = cols[3]
            cv.p(x, y, c)


from wm_lib import hexc as _h
ROCK = (_h('b99664'), _h('987046'), _h('714e29'), _h('65442a'))
GREY = (_h('8ca9a3'), _h('766e60'), _h('564a3e'), _h('363540'))


# ================================================================== 1x1
@icon('hamlet', 1, 1, 1, '작은 마을(집 두 채) — 촌락·이정표 마을')
def _hamlet(cv):
    house(cv, 1, 13, 7, 4, 4, BONE, RED)
    house(cv, 8, 14, 7, 4, 4, WOOD, RED)
    tree(cv, 13, 7, 2)


@icon('windmill', 1, 1, 1, '풍차 — 농촌·밀밭 마을')
def _windmill(cv):
    for y in range(7, 15):
        x0 = 5 + (y - 7) // 4
        x1 = 10 - (y - 7) // 4
        for x in range(x0, x1 + 1):
            cv.p(x, y, BONE['mid'] if x > x0 else BONE['hi'])
        cv.p(x1, y, BONE['lo'])
    cv.r(7, 12, 8, 14, WOOD['sh'])
    cone(cv, 7, 6, 4, 4, RED)
    for i in range(1, 6):
        for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            cv.p(8 + sx * i, 5 + sy * i, WOOD['mid'] if i < 5 else WOOD['hi'])
    cv.p(8, 5, WOOD['sh'])


@icon('dock', 1, 1, 1, '작은 항구(부두+배) — 어촌')
def _dock(cv):
    water_patch(cv, 1, 8, 14, 14)
    quay(cv, 1, 8, 6, 8)
    house(cv, 1, 5, 6, 3, 3, BONE, RED, win=False)
    boat(cv, 11, 12, 7)


@icon('cave', 1, 1, 1, '동굴 입구 — 던전·굴')
def _cave(cv):
    mound(cv, 1, 14, 3, 14, ROCK)
    cv.r(6, 9, 9, 14, WIN)
    cv.hl(7, 8, 8, WIN)
    cv.vl(5, 10, 14, ROCK[3]); cv.vl(10, 10, 14, ROCK[3])
    cv.hl(6, 9, 14, ROCK[3])


@icon('mine', 1, 1, 1, '광산 — 목재 틀 갱구와 수레 레일')
def _mine(cv):
    mound(cv, 1, 14, 2, 14, GREY)
    cv.r(5, 8, 10, 14, WIN)
    cv.vl(4, 7, 14, WOOD['mid']); cv.vl(11, 7, 14, WOOD['mid'])
    cv.hl(4, 11, 7, WOOD['hi']); cv.hl(4, 11, 8, WOOD['lo'])
    for x in range(5, 11, 2):
        cv.p(x, 14, WOOD['hi'])


@icon('shrine', 1, 1, 1, '신사 문 — 성지·제단 입구')
def _shrine(cv):
    cv.hl(1, 14, 3, RED['sh']); cv.hl(2, 13, 4, RED['mid']); cv.hl(1, 14, 2, RED['lo'])
    cv.hl(3, 12, 6, RED['lo'])
    for x in (4, 11):
        cv.vl(x, 5, 14, RED['mid']); cv.vl(x + 1, 5, 14, RED['lo'])
    cv.hl(1, 14, 2, RED['hi'])
    cv.r(6, 8, 9, 12, STONE['lo'])
    cv.hl(6, 9, 8, STONE['hi'])


@icon('camp', 1, 1, 1, '야영지 — 천막 둘과 모닥불')
def _camp(cv):
    for (cx, base, h, pal) in ((5, 13, 8, BLUE), (11, 14, 6, RED)):
        for i in range(h):
            y = base - i
            hw = max(0, (h - i) * 5 // (2 * h) + (1 if i < h - 1 else 0))
            for x in range(cx - hw, cx + hw + 1):
                cv.p(x, y, pal['mid'] if x <= cx else pal['lo'])
            cv.p(cx - hw, y, pal['hi'])
        cv.vl(cx, base - 2, base, WIN)
    cv.p(8, 14, RED['hi']); cv.p(8, 13, GOLD); cv.p(7, 14, RED['mid']); cv.p(9, 14, RED['mid'])


@icon('ruins', 1, 1, 1, '폐허 — 부러진 기둥과 무너진 벽')
def _ruins(cv):
    for (x, top) in ((2, 6), (7, 3), (12, 8)):
        cv.r(x, top, x + 2, 14, BONE['mid'])
        cv.vl(x, top, 14, BONE['hi']); cv.vl(x + 2, top, 14, BONE['lo'])
        cv.hl(x, x + 2, top, BONE['cap'])
        cv.hl(x, x + 2, top + 5, BONE['lo'])
    cv.r(4, 12, 6, 14, BONE['lo']); cv.hl(4, 6, 12, BONE['mid'])
    for x, y in ((3, 13), (9, 13), (13, 12)):
        cv.p(x, y, BONE['moss'])


@icon('watchtower', 1, 1, 1, '감시탑 — 국경 초소')
def _watch(cv):
    tower(cv, 8, 5, 8, 10, STONE)
    flag(cv, 8, 0, RED, 3)
    cv.r(6, 13, 9, 14, WIN)


@icon('signpost', 1, 1, 1, '이정표 갈림길 표지')
def _sign(cv):
    cv.vl(8, 3, 14, WOOD['mid']); cv.vl(9, 3, 14, WOOD['lo'])
    cv.r(3, 4, 12, 6, WOOD['hi']); cv.hl(3, 12, 6, WOOD['mid']); cv.hl(3, 12, 4, WOOD['hi'])
    cv.r(5, 8, 13, 10, WOOD['mid']); cv.hl(5, 13, 10, WOOD['lo'])
    cv.p(12, 5, WOOD['sh']); cv.p(6, 9, WOOD['sh'])


# ================================================================== 1x2
@icon('lighthouse', 1, 1, 2, '등대 — 항구·해안 표지 (1x2)')
def _lighthouse(cv):
    for y in range(11, 30):
        t = (y - 11) / 18
        hw = 3 + int(t * 2.2)
        band = ((y - 11) // 4) % 2
        pal = RED if band else BONE
        for x in range(8 - hw, 8 + hw):
            c = pal['mid']
            if x < 8 - hw + 2:
                c = pal['hi']
            elif x >= 8 + hw - 2:
                c = pal['lo']
            cv.p(x, y, c)
    cv.hl(4, 11, 10, STONE['hi']); cv.hl(4, 11, 11, STONE['lo'])
    cv.r(6, 6, 9, 9, GOLD); cv.r(7, 7, 8, 8, BONE['hi'])
    cv.vl(6, 6, 9, STONE['lo']); cv.vl(9, 6, 9, STONE['lo'])
    cone(cv, 8, 5, 4, 3, RED)
    cv.r(7, 24, 8, 29, WIN)
    for x in range(2, 14):
        cv.p(x, 30, STONE['lo']) if x % 3 else cv.p(x, 30, STONE['mid'])


@icon('mage_tower', 1, 1, 2, '마법사 탑 — 푸른 첨탑 (1x2)')
def _mage(cv):
    tower(cv, 8, 12, 9, 19, STONE, roof=10, rpal=BLUE)
    cv.r(6, 20, 7, 22, WIN); cv.p(9, 26, BLUE['hi']); cv.p(9, 27, BLUE['mid'])
    tower(cv, 3, 22, 4, 9, STONE, roof=4, rpal=BLUE, slit=False)
    cv.r(6, 28, 9, 30, WIN)


@icon('stone_tower', 1, 1, 2, '돌 망루 — 성곽 외곽 탑 (1x2)')
def _stone_tower(cv):
    tower(cv, 8, 8, 10, 22, STONE)
    flag(cv, 8, 1, RED, 4)
    for y in (16, 22):
        cv.vl(6, y, y + 2, WIN); cv.vl(10, y, y + 2, WIN)
    cv.r(7, 26, 9, 30, WIN)


# ================================================================== 2x2
def _rows_town(cv, rpal, wpals, tower_roof=False):
    house(cv, 1, 14, 9, 5, 4, wpals[0], rpal)
    house(cv, 11, 14, 9, 5, 4, wpals[1], rpal)
    if tower_roof:
        tower(cv, 26, 6, 6, 9, STONE, roof=5, rpal=BLUE)
    else:
        house(cv, 21, 14, 9, 5, 4, wpals[0], rpal)
    house(cv, 2, 29, 11, 6, 5, wpals[1], rpal)
    house(cv, 17, 29, 10, 6, 5, wpals[0], rpal)
    tree(cv, 29, 30, 2)
    tree(cv, 14, 24, 1)


@icon('town_red', 2, 2, 2, '마을 — 붉은 지붕 (일반 마을)')
def _town_red(cv):
    _rows_town(cv, RED, (BONE, WOOD))


@icon('town_blue', 2, 2, 2, '마을 — 푸른 지붕과 종탑 (도시풍 마을)')
def _town_blue(cv):
    _rows_town(cv, BLUE, (BONE, BONE), tower_roof=True)


@icon('town_snow', 2, 2, 2, '설원 마을 — 눈 덮인 지붕과 전나무')
def _town_snow(cv):
    house(cv, 1, 14, 9, 5, 4, WOOD, SNOW)
    house(cv, 11, 14, 9, 5, 4, BONE, SNOW)
    house(cv, 21, 14, 9, 5, 4, WOOD, SNOW)
    house(cv, 2, 29, 11, 6, 5, BONE, SNOW)
    house(cv, 17, 29, 10, 6, 5, WOOD, SNOW)
    for (x, y) in ((29, 30), (14, 25)):
        for i in range(7):
            hw = (i + 1) // 2
            for dx in range(-hw, hw + 1):
                cv.p(x + dx, y - 7 + i, GREEN['lo'] if dx > 0 else GREEN['mid'])
            if i % 2 == 0:
                cv.p(x - hw, y - 7 + i, SNOW['hi']); cv.p(x, y - 7 + i, SNOW['hi'])
        cv.vl(x, y + 1, y + 2, WOOD['sh'])


@icon('town_desert', 2, 2, 2, '사막 마을 — 평지붕 흙집·푸른 돔·야자')
def _town_desert(cv):
    def block(x0, yb, w, h, awning=None):
        top = yb - h + 1
        cv.r(x0, top, x0 + w - 1, yb, SAND['mid'])
        cv.vl(x0, top, yb, SAND['hi']); cv.vl(x0 + w - 1, top, yb, SAND['lo'])
        cv.hl(x0, x0 + w - 1, top, SAND['cap']); cv.hl(x0, x0 + w - 1, top + 1, SAND['hi'])
        cv.hl(x0 + 1, x0 + w - 1, top + 2, SAND['lo'])
        cv.hl(x0, x0 + w - 1, yb, SAND['lo'])
        cv.r(x0 + w // 2 - 1, yb - 3, x0 + w // 2, yb, WOOD['sh'])
        cv.p(x0 + w // 2 - 1, yb - 3, WOOD['mid'])
        if w >= 8:
            cv.p(x0 + 1, top + 4, WIN); cv.p(x0 + w - 2, top + 4, WIN)
        if awning:
            cv.hl(x0 + 1, x0 + w - 2, top + 3, awning['mid'])
    block(1, 14, 9, 8, RED); block(11, 14, 8, 8, BLUE); block(21, 14, 9, 8, RED)
    block(1, 30, 9, 9); block(21, 30, 9, 9, BLUE)
    # 푸른 돔
    cx, cy = 15, 27
    for y in range(cy - 6, cy + 1):
        hw = int(((6.4 ** 2) - (cy - y) ** 2) ** 0.5 * 1.15)
        for x in range(cx - hw, cx + hw + 1):
            c = BLUE['mid']
            if x < cx - hw // 2:
                c = BLUE['hi']
            elif x > cx + hw // 3:
                c = BLUE['lo']
            cv.p(x, y, c)
    cv.hl(cx - 7, cx + 7, cy + 1, SAND['lo']); cv.r(cx - 6, cy + 2, cx + 6, 30, SAND['mid'])
    cv.vl(cx - 6, cy + 2, 30, SAND['hi']); cv.vl(cx + 6, cy + 2, 30, SAND['lo'])
    cv.r(cx - 1, 28, cx, 30, WOOD['sh'])
    cv.vl(cx, cy - 8, cy - 7, GOLD); cv.p(cx, cy - 9, GOLD)
    for (x, y) in ((11, 24), (18, 24)):
        cv.vl(x, y - 5, y, WOOD['lo'])
        for dx, dy in ((-3, 0), (3, 0), (-2, -1), (2, -1), (0, -2), (-1, -1), (1, -1)):
            cv.p(x + dx, y - 5 + dy, GREEN['mid'] if dx <= 0 else GREEN['lo'])
        cv.p(x - 1, y - 6, GREEN['hi'])


@icon('harbor_town', 2, 2, 2, '항구 마을 — 집·부두·배 두 척')
def _harbor_town(cv):
    house(cv, 1, 13, 10, 5, 4, BONE, RED)
    house(cv, 12, 12, 9, 5, 4, WOOD, RED)
    house(cv, 22, 13, 9, 5, 4, BONE, RED)
    water_patch(cv, 1, 19, 30, 30, 3)
    quay(cv, 1, 20, 17, 19)
    boat(cv, 26, 25, 9)
    boat(cv, 9, 28, 8)
    cv.hl(21, 30, 18, WATER['hi'])


@icon('fort', 2, 2, 2, '요새 — 문루와 두 탑 (국경 요새)')
def _fort(cv):
    tower(cv, 16, 6, 10, 12, STONE, roof=6, rpal=RED, slit=False)
    wall(cv, 3, 28, 19, 30, STONE, seed=1)
    tower(cv, 6, 8, 9, 23, STONE, roof=6, rpal=RED)
    tower(cv, 25, 8, 9, 23, STONE, roof=6, rpal=RED)
    arch_gate(cv, 16, 30, 6, 9, STONE)
    flag(cv, 16, 1, RED, 3)


@icon('monastery', 2, 2, 2, '수도원·교회 — 종탑과 긴 예배당')
def _monastery(cv):
    house(cv, 2, 30, 20, 8, 7, BONE, SLATE, door=False, win=False)
    cv.r(10, 25, 13, 30, WOOD['sh']); cv.p(10, 25, WOOD['mid'])
    for x in (4, 7, 16, 19):
        cv.r(x, 24, x + 1, 26, WIN)
    tower(cv, 26, 4, 8, 26, BONE, roof=7, rpal=BLUE, slit=False)
    cv.r(24, 13, 27, 17, WIN); cv.p(25, 14, GOLD); cv.p(26, 14, GOLD)
    cv.vl(26, 0, 2, GOLD); cv.hl(25, 27, 1, GOLD)


# ================================================================== 3x3
def castle(cv, cx, ybase, half, pal, rpal, cones=True, keep_h=26, keep_w=13, banners=True, front_h=14):
    """앞 성벽 + 귀퉁이 탑 넷 + 뒤 본성(donjon) 을 한 번에. half=성 반폭."""
    x0, x1 = cx - half, cx + half
    # 뒤 본성
    ky = ybase - front_h - keep_h + 6
    tower(cv, cx, ky, keep_w, keep_h, pal, roof=(keep_w + 3) if cones else None, rpal=rpal, seed=2)
    kx0 = cx - keep_w // 2
    for yy in (ky + 8, ky + 14):
        cv.vl(cx - 3, yy, yy + 2, WIN); cv.vl(cx + 3, yy, yy + 2, WIN)
    if cones:
        tower(cv, cx - keep_w // 2 - 3, ky + 4, 5, keep_h - 4, pal, roof=6, rpal=rpal, slit=False, seed=1)
        tower(cv, cx + keep_w // 2 + 3, ky + 4, 5, keep_h - 4, pal, roof=6, rpal=rpal, slit=False, seed=3)
    # 앞 성벽
    wall(cv, x0 + 2, x1 - 2, ybase - front_h, ybase, pal, seed=1)
    # 앞 귀퉁이 탑
    for tx in (x0 + 4, x1 - 4):
        tower(cv, tx, ybase - front_h - 10, 9, front_h + 11, pal, roof=7 if cones else None, rpal=rpal)
    arch_gate(cv, cx, ybase, 7, 10, pal)
    if banners:
        flag(cv, cx, ky - (keep_w + 3 if cones else 5) - 5, RED, 3)


@icon('castle_blue', 3, 3, 3, '성 — 뼈색 성벽과 푸른 첨탑')
def _castle_blue(cv):
    castle(cv, 24, 45, 20, BONE, BLUE)


@icon('castle_dark', 3, 3, 3, '어둠의 성 — 돌색 성벽과 붉은 첨탑')
def _castle_dark(cv):
    castle(cv, 24, 45, 20, STONE, RED)


@icon('castle_keep', 3, 3, 3, '요새 성채 — 지붕 없는 돌 성 (흉벽만)')
def _castle_keep(cv):
    castle(cv, 24, 45, 20, STONE, RED, cones=False, keep_h=24, keep_w=15)


@icon('walled_city', 3, 3, 3, '성곽 도시 — 성벽 너머로 보이는 집 지붕과 종탑')
def _walled_city(cv):
    house(cv, 11, 30, 9, 3, 4, BONE, RED, win=False)
    house(cv, 29, 30, 9, 3, 4, BONE, BLUE, win=False)
    tower(cv, 24, 8, 8, 21, BONE, roof=7, rpal=BLUE, slit=False)
    cv.r(22, 16, 25, 19, WIN); cv.p(23, 17, GOLD)
    wall(cv, 3, 44, 31, 46, STONE, seed=1)
    for tx in (6, 41):
        tower(cv, tx, 27, 9, 20, STONE, roof=6, rpal=RED)
    arch_gate(cv, 24, 46, 8, 11, STONE)
    flag(cv, 24, 24, RED, 3)


@icon('port_city', 3, 3, 3, '항구 도시 — 집·종탑·등대·부두와 배')
def _port_city(cv):
    for (x, yb, w, rp) in ((2, 13, 9, RED), (12, 12, 9, BLUE), (22, 13, 9, RED)):
        house(cv, x, yb, w, 4, 4, BONE, rp)
    for (x, yb, w, rp) in ((1, 26, 11, BLUE), (13, 27, 11, RED), (25, 26, 9, BLUE)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    # 등대
    for y in range(9, 30):
        for x in range(38, 45):
            band = ((y - 9) // 4) % 2
            pal = RED if band else BONE
            cv.p(x, y, pal['hi'] if x == 38 else (pal['lo'] if x == 44 else pal['mid']))
    cv.r(39, 5, 43, 8, GOLD); cv.r(40, 6, 42, 7, BONE['hi']); cone(cv, 41, 4, 4, 3, RED)
    water_patch(cv, 1, 32, 46, 46, 5)
    quay(cv, 1, 34, 29, 32)
    quay(cv, 36, 46, 29, 32)
    boat(cv, 32, 40, 11); boat(cv, 14, 43, 9)


# ================================================================== 5x5
@icon('capital', 4, 5, 5, '왕도 — 성벽·문루·안쪽 왕성과 시가지')
def _capital(cv):
    castle(cv, 40, 38, 18, BONE, BLUE, keep_h=20, keep_w=14, front_h=10)
    for (x, yb, w, rp) in ((11, 52, 9, RED), (22, 51, 8, BLUE), (50, 51, 8, BLUE), (60, 52, 9, RED)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    for (x, yb, w, rp) in ((11, 63, 10, BLUE), (23, 63, 9, RED), (48, 63, 9, RED), (59, 63, 10, BLUE)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    wall(cv, 2, 77, 68, 78, STONE, seed=1)
    for tx in (6, 73):
        tower(cv, tx, 56, 9, 23, STONE, roof=7, rpal=BLUE)
    arch_gate(cv, 40, 78, 10, 9, STONE)
    flag(cv, 40, 65, RED, 3)


@icon('fortress_dark', 4, 5, 5, '마왕성급 대요새 — 높은 본성과 이중 성벽')
def _fortress_dark(cv):
    castle(cv, 40, 46, 26, STONE, RED, cones=False, keep_h=30, keep_w=21, front_h=14)
    for fx in (16, 64):
        flag(cv, fx, 20, RED, 4)
    wall(cv, 2, 77, 58, 78, STONE, seed=3)
    for tx in (5, 74):
        tower(cv, tx, 46, 10, 33, STONE, roof=None)
        cv.vl(tx, 54, 56, WIN); cv.vl(tx, 64, 66, WIN)
    arch_gate(cv, 40, 78, 12, 15, STONE)
    flag(cv, 40, 1, RED, 5)


@icon('port_capital', 4, 5, 5, '항만 왕도 — 성·시가지·큰 부두와 배 셋')
def _port_capital(cv):
    castle(cv, 24, 38, 18, BONE, BLUE, keep_h=20, keep_w=13, front_h=10)
    for (x, yb, w, rp) in ((46, 16, 10, RED), (58, 16, 10, BLUE), (46, 28, 10, BLUE), (58, 28, 10, RED)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    for (x, yb, w, rp) in ((2, 52, 11, RED), (14, 52, 10, BLUE), (26, 52, 10, RED)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    for (x, yb, w, rp) in ((46, 42, 10, BLUE), (58, 42, 10, RED)):
        house(cv, x, yb, w, 5, 4, BONE, rp)
    water_patch(cv, 1, 60, 78, 78, 2)
    quay(cv, 1, 44, 56, 59)
    quay(cv, 46, 78, 56, 59)
    boat(cv, 20, 68, 13); boat(cv, 50, 72, 11); boat(cv, 10, 75, 9)
    for y in range(34, 57):
        for x in range(70, 78):
            band = ((y - 34) // 4) % 2
            pal = RED if band else BONE
            cv.p(x, y, pal['hi'] if x == 70 else (pal['lo'] if x == 77 else pal['mid']))
    cv.r(71, 29, 76, 33, GOLD); cone(cv, 73, 28, 5, 4, RED)


# ================================================================== 배치·출력
def pack(cols=30):
    """단계별로 줄을 나눠 왼쪽 위부터 채운다. (이름, col, row, w, h) 반환."""
    placed = []
    row = 0
    col = 0
    row_h = 0
    tier = None
    for it in sorted(ICONS, key=lambda t: (t[1], -t[3], t[0])):
        name, t, w, h, fn, desc = it
        if tier is not None and (t != tier or col + w > cols):
            row += row_h
            col = 0
            row_h = 0
        if col + w > cols:
            row += row_h
            col = 0
            row_h = 0
        tier = t
        placed.append((it, col, row))
        col += w
        row_h = max(row_h, h)
    rows = row + row_h
    return placed, rows


def main():
    placed, rows = pack()
    sheet = np.zeros((rows * CELL, 30 * CELL, 3), np.uint8)
    sheet[:] = PINK
    index = []
    for (name, tier, w, h, fn, desc), col, row in placed:
        cv = Cv(w * CELL, h * CELL)
        fn(cv)
        cv.outline(OL)
        y0, x0 = row * CELL, col * CELL
        blk = sheet[y0:y0 + h * CELL, x0:x0 + w * CELL]
        blk[cv.m] = cv.a[cv.m]
        index.append(dict(name=name, tier=tier, cells=[w, h], col=col, row=row,
                          firstCell=row * 30 + col, desc=desc))
    Image.fromarray(sheet).save(HERE / 'world-plus-ext.png')
    (HERE / 'world-plus-ext.json').write_text(json.dumps(
        dict(sheet='world-plus-ext.png', cell=CELL, cols=30, rows=rows, key=list(PINK),
             tiers={'1': '1x1·1x2 소형(등대·탑 포함)', '2': '2x2 마을·요새', '3': '3x3 성·성곽도시', '4': '5x5 왕도·대요새'},
             icons=index), ensure_ascii=False, indent=1))
    print(len(index), 'icons,', rows, 'rows')


if __name__ == '__main__':
    main()

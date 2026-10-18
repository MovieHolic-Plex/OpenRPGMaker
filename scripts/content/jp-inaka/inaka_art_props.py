#!/usr/bin/env python3
# noqa: SIZE_OK — self-contained 3/4 rural props/vehicles/nature kits 11..30 and 9 ground tiles for jp-inaka
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/jp-inaka/bake_inaka.py
"""Japanese Countryside (jp-inaka) 3/4 top-view pixel-art kits 11..30 and 9 ground/water tiles."""
from __future__ import annotations

import collections
import math
from typing import Callable, Final

from inaka_art_houses import (
     OL,
    Cv,
    H,
    J,
    K,
    add_outline,
    boards_wall,
    canopy_clusters,
    corrugated_roof_34,
    disc,
    kawara_roof_34,
    kit,
    line,
    plaster_wall,
    plinth_34,
    rect_3d,
    rows,
    thatch_roof_34,
)


# ─────────────────────────── 11. inaka-fire-watchtower (2×4) ───────────────────────────
@kit(
    'inaka-fire-watchtower',
    '시골 소방 망루(火の見櫓) — 철골 트러스 탑·수직 사다리·전망대 난간·청동 반종(2×4)',
    2, 4, 'structure',
    solid=[(0, 3), (1, 3)],
    tags=['inaka', '소방망루', '히노미야구라', '망루', '종루', '시골마을'],
    rules='시골 마을 회관·농가 삼거리나 들판 가장자리에 세운다.',
    role='building',
)
def draw_fire_watchtower(c: Cv, base: Cv) -> None:
    """Draw 2x4 tall steel-frame rural fire watchtower with ladder, lookout railing, and hanging bronze bell."""
    # Concrete base pad (x=4..28, y=54..62)
    plinth_34(c, 4, 54, 24, 8, top_h=3, mat='paving_stone')
    # 4 Tapering steel angle legs from y=18..55
    for y in range(18, 55):
        f = (y - 18) / 36.0
        hw = round(4 + f * 6)
        lx, rx = 16 - hw, 16 + hw - 1
        c.P(lx - 1, y, OL)
        c.P(lx, y, J('kawara_dark_tile', 4))
        c.P(lx + 1, y, J('kawara_dark_tile', 2))
        c.P(rx - 1, y, J('kawara_dark_tile', 2))
        c.P(rx, y, J('kawara_dark_tile', 1))
        c.P(rx + 1, y, OL)
        # X-bracing & horizontal rings every 9px
        if (y - 18) % 9 == 0:
            c.HL(lx, y, rx - lx + 1, OL)
            c.HL(lx + 1, y + 1, rx - lx - 1, J('kawara_dark_tile', 3))
    for b_y in (18, 27, 36, 45):
        f0, f1 = (b_y - 18) / 36.0, (b_y + 9 - 18) / 36.0
        hw0, hw1 = round(4 + f0 * 6), round(4 + f1 * 6)
        line(c, 16 - hw0 + 1, b_y + 1, 16 + hw1 - 2, b_y + 8, J('kawara_dark_tile', 2))
        line(c, 16 + hw0 - 2, b_y + 1, 16 - hw1 + 1, b_y + 8, J('kawara_dark_tile', 2))
    # Central vertical steel ladder (x=14..18, y=18..55)
    c.VL(14, 18, 37, OL)
    c.VL(17, 18, 37, OL)
    for ry in range(20, 54, 3):
        c.HL(15, ry, 2, J('vending_cool_white', 3))
    # Upper 3/4 lookout platform & safety railing (x=7..25, y=13..20)
    rect_3d(c, 7, 13, 18, 7, 2, 'kawara_dark_tile', top_t=4, front_t=2)
    for px in range(9, 24, 3):
        c.VL(px, 15, 3, J('vending_cool_white', 2))
    # Bell shelter posts & hanging bronze fire bell (반쇼, y=2..14)
    c.VL(10, 7, 6, OL)
    c.VL(11, 7, 6, J('kawara_dark_tile', 3))
    c.VL(20, 7, 6, OL)
    c.VL(21, 7, 6, J('kawara_dark_tile', 2))
    # Bronze bell in center (x=14..18, y=8..13)
    c.R(14, 8, 4, 5, OL)
    c.R(15, 9, 2, 3, J('lantern_amber', 3))
    c.P(15, 9, J('lantern_amber', 4))
    # Conical 3/4 metal cap roof (x=8..24, y=2..8)
    for j in range(6):
        hw = 2 + j
        c.HL(16 - hw - 1, 2 + j, hw * 2 + 2, OL)
        c.HL(16 - hw, 2 + j, hw * 2, J('noren_rust', 3 if j < 3 else 2))
    c.VL(16, 0, 3, OL)


# ─────────────────────────── 12. inaka-keitora-white (3×2) ───────────────────────────
@kit(
    'inaka-keitora-white',
    '시골 흰 경트럭(軽トラ) — 3/4 운전석 캡·수확 농산물 상자·파란 방수포 적재함(3×2)',
    3, 2, 'vehicle',
    solid=rows(3, [0, 1]),
    tags=['inaka', '경트럭', '케이토라', '트럭', '자동차', '농가'],
    rules='시골 자갈길이나 농가 마당·무인 판매대 옆에 세운다.',
    role='prop',
)
def draw_keitora_white(c: Cv, base: Cv) -> None:
    """Draw 3x2 iconic white Japanese kei-truck in 3/4 view with cab, rear flatbed, harvest crates, and blue tarp."""
    # Ground shadow under truck (x=3..45, y=25..30)
    c.R(4, 26, 40, 4, OL)
    # 1. Left front cab (x=3..20, y=5..25) in 3/4 perspective
    # Cab roof top face (y=5..10) + front/side body
    rect_3d(c, 5, 5, 15, 20, 4, 'vending_cool_white', top_t=4, front_t=3)
    # Slanted front nose & windshield (x=3..11, y=9..17)
    c.R(3, 14, 4, 11, OL)
    c.R(4, 15, 3, 9, J('vending_cool_white', 4))
    c.R(5, 9, 6, 7, OL)
    c.R(6, 10, 4, 5, J('arcade_skylight_slate', 2))
    c.HL(6, 10, 3, J('arcade_skylight_slate', 4))
    # Side door window (x=12..18, y=9..16) + black side mirror
    c.R(12, 9, 6, 7, OL)
    c.R(13, 10, 4, 5, J('arcade_skylight_slate', 3))
    c.P(13, 10, J('vending_cool_white', 4))
    c.R(10, 12, 2, 3, OL)
    # Front headlight & dark bumper
    c.R(3, 18, 2, 2, J('lantern_amber', 4))
    c.R(3, 22, 5, 3, J('asphalt', 0))
    # 2. Rear flatbed cargo box (x=19..45, y=10..24) showing interior cargo + side drop gate
    rect_3d(c, 19, 14, 26, 10, 3, 'vending_cool_white', top_t=3, front_t=2)
    c.HL(20, 19, 24, J('vending_cool_white', 1))
    # Wooden harvest crates loaded with red tomatoes & green cabbages (x=20..32, y=8..16)
    rect_3d(c, 20, 8, 12, 8, 3, 'aged_cedar', top_t=4, front_t=2)
    for tx, ty in ((22, 9), (24, 9), (23, 10)):
        c.R(tx, ty, 2, 2, J('torii_vermilion', 3))
    for gx in (27, 29):
        c.R(gx, 9, 2, 2, J('pine_bamboo', 3))
    # Blue waterproof tarp covering rear half of cargo bed (x=31..44, y=9..17)
    rect_3d(c, 31, 9, 13, 8, 4, 'noren_indigo', top_t=3, front_t=2)
    c.HL(32, 10, 11, J('arcade_skylight_slate', 4))
    # Rear taillight
    c.R(43, 20, 2, 2, J('torii_vermilion', 3))
    # 3. Front & rear wheels with steel rims (x=10, 36, y=24)
    for wx in (10, 36):
        disc(c, wx, 25, 3.8, OL)
        disc(c, wx, 25, 2.6, J('asphalt', 0))
        disc(c, wx, 25, 1.4, J('concrete_grey', 3))


# ─────────────────────────── 13. inaka-red-tractor (3×2) ───────────────────────────
@kit(
    'inaka-red-tractor',
    '붉은 농기계 트랙터 — 대형 깍두기 뒷바퀴·붉은 보닛·배기 연통·로터리 경운기(3×2)',
    3, 2, 'vehicle',
    solid=rows(3, [0, 1]),
    tags=['inaka', '트랙터', '농기계', '경운기', '논밭', '농사'],
    rules='논두렁·시골 자갈길이나 농기구 헛간 앞에 놓는다.',
    role='prop',
)
def draw_red_tractor(c: Cv, base: Cv) -> None:
    """Draw 3x2 vintage red agricultural tractor with lugged rear tire, exhaust stack, rollbar canopy, and rotary tiller."""
    c.R(3, 26, 42, 4, OL)
    # 1. Sun canopy + rollbar over driver seat (x=18..31, y=2..16)
    c.VL(20, 5, 11, OL)
    c.VL(28, 5, 11, OL)
    c.VL(29, 5, 11, J('kawara_dark_tile', 2))
    rect_3d(c, 17, 2, 14, 4, 2, 'torii_vermilion', top_t=4, front_t=2)
    # 2. Driver seat & steering wheel (x=16..28, y=10..18)
    rect_3d(c, 22, 11, 6, 6, 2, 'machiya_timber', top_t=2, front_t=0)
    line(c, 16, 11, 20, 16, OL)
    c.R(15, 10, 3, 2, OL)
    # 3. 3/4 Red engine hood & front grille on left (x=4..21, y=11..23)
    rect_3d(c, 4, 11, 17, 11, 4, 'torii_vermilion', top_t=4, front_t=3)
    c.R(5, 16, 3, 5, J('kawara_dark_tile', 1))
    c.R(4, 14, 2, 2, J('lantern_amber', 4))
    c.HL(9, 17, 10, J('vending_cool_white', 4))
    # Vertical black exhaust stack on hood (x=10..12, y=4..13)
    c.R(10, 4, 3, 9, OL)
    c.VL(11, 5, 7, J('kawara_dark_tile', 2))
    # 4. Rear rotary tiller attachment on right (x=32..46, y=16..27)
    rect_3d(c, 32, 16, 14, 8, 3, 'noren_rust', top_t=3, front_t=2)
    for tx in range(34, 45, 3):
        c.R(tx, 23, 2, 4, OL)
        c.P(tx, 24, J('concrete_grey', 3))
    # 5. Small front wheel (x=8, y=24) & huge lugged rear wheel (x=25, y=21)
    disc(c, 8, 24, 3.8, OL)
    disc(c, 8, 24, 2.6, J('asphalt', 0))
    disc(c, 8, 24, 1.3, J('lantern_amber', 3))
    # Rear fender over big tire
    c.R(19, 14, 12, 4, OL)
    c.HL(20, 15, 10, J('torii_vermilion', 4))
    disc(c, 25, 22, 6.2, OL)
    disc(c, 25, 22, 4.8, J('asphalt', 0))
    disc(c, 25, 22, 2.5, J('lantern_amber', 3))
    c.P(25, 22, OL)


# ─────────────────────────── 14. inaka-agri-tin-shed (4×3) ───────────────────────────
@kit(
    'inaka-agri-tin-shed',
    '함석 농기구 헛간 — 녹슨 골함석 지붕·반쯤 열린 미닫이문·비료 포대·농기구(4×3)',
    4, 3, 'building',
    solid=rows(4, [1, 2]),
    tags=['inaka', '헛간', '농기구창고', '함석지붕', '비료포대', '농가'],
    rules='논밭 가장자리나 농가 마당 구석에 세운다.',
    role='building',
    doors=[(1, 2, 2)],
)
def draw_agri_tin_shed(c: Cv, base: Cv) -> None:
    """Draw 4x3 corrugated sheet-metal farm shed with rusted patches and half-open door showing fertilizer bags."""
    plinth_34(c, 2, 39, 60, 8, top_h=3, mat='paving_stone')
    # 3/4 pitched corrugated sheet-metal roof with rust patches (y=2..19)
    corrugated_roof_34(c, 2, 2, 60, 17, mat='arcade_skylight_slate', rust_ratio=0.35)
    # Ribbed galvanized metal walls (x=4..60, y=19..40)
    c.R(4, 19, 56, 21, OL)
    for y in range(20, 39):
        for x in range(5, 59):
            k = (x - 5) % 3
            lv = 3 if k == 0 else (1 if k == 2 else 2)
            if y <= 21:
                lv = max(0, lv - 1)
            is_rust = H(x // 3, y // 4, 19) < 0.18
            c.P(x, y, J('noren_rust' if is_rust else 'concrete_grey', lv))
    # Small side window on left (x=8..15, y=23..30)
    c.R(8, 23, 8, 7, OL)
    c.R(9, 24, 6, 5, J('arcade_skylight_slate', 2))
    c.VL(12, 24, 5, OL)
    # Half-open sliding barn door in center (x=19..45, y=21..40)
    c.R(19, 21, 26, 19, OL)
    # Left half open interior (x=20..32) showing stacked white fertilizer bags & wooden crate
    c.R(20, 22, 13, 17, J('machiya_timber', 0))
    for by in (33, 30, 27):
        rect_3d(c, 21, by, 7, 4, 1, 'vending_cool_white', top_t=4, front_t=3)
        c.HL(22, by + 2, 4, J('pine_bamboo', 3))
    rect_3d(c, 28, 31, 4, 7, 2, 'aged_cedar', top_t=3, front_t=2)
    # Right half sliding corrugated metal door panel (x=32..44)
    c.R(32, 22, 12, 17, OL)
    for x in range(33, 43):
        c.VL(x, 23, 15, J('aged_cedar', 3 if x % 2 == 0 else 2))
    # Blue plastic rainwater drum on right outside (x=49..57, y=28..41)
    rect_3d(c, 49, 28, 8, 12, 3, 'noren_indigo', top_t=4, front_t=2)
    c.HL(50, 34, 6, J('noren_indigo', 1))


# ─────────────────────────── 15. inaka-vinyl-greenhouse (5×3) ───────────────────────────
@kit(
    'inaka-vinyl-greenhouse',
    '비닐하우스(ビニールハウス) — 반투명 아치형 비닐 지붕·강철 파이프 활대·내부 작물 이랑(5×3)',
    5, 3, 'building',
    solid=rows(5, [1, 2]),
    tags=['inaka', '비닐하우스', '온실', '농사', '텃밭', '작물'],
    rules='논밭이나 시골 농가 텃밭 구역에 놓는다.',
    role='building',
    doors=[(0, 2, 1)],
)
def draw_vinyl_greenhouse(c: Cv, base: Cv) -> None:
    """Draw 5x3 arched translucent vinyl hoop-house with metal pipe ribs and visible green crop rows inside."""
    # Soil base & raised dark earth border (x=2..78, y=38..46)
    rect_3d(c, 2, 38, 76, 8, 3, 'aged_cedar', top_t=2, front_t=1)
    # Arched 3/4 vinyl hoop body (x=3..77, y=4..40)
    for x in range(3, 77):
        # End-wall arch profile at left (x=3..18) + long barrel vault (x=18..77)
        c.P(x, 4, OL)
        c.P(x, 39, OL)
        is_rib = (x - 4) % 12 == 0
        for y in range(5, 39):
            if y < 12:
                # Top sunlit vinyl arch crest
                col = J('concrete_grey', 2) if is_rib else J('vending_cool_white', 4 if y < 8 else 3)
            elif y < 27:
                # Sloping translucent vinyl side
                col = J('concrete_grey', 2) if is_rib else J('arcade_skylight_slate', 4 if (x + y) % 5 != 0 else 3)
            else:
                # Rolled-up side ventilation window showing interior crop rows!
                if is_rib:
                    col = J('concrete_grey', 1)
                else:
                    row_mod = (y - 27) % 4
                    col = J('pine_bamboo', 3 if row_mod == 0 else 2) if row_mod < 3 else J('aged_cedar', 1)
                    if row_mod == 1 and (x * 3 + y) % 9 == 0:
                        col = J('torii_vermilion', 3)
            c.P(x, y, col)
        # Rolled-up white vinyl skirt line at y=26..27
        c.P(x, 26, OL)
        c.P(x, 27, J('vending_cool_white', 4))
    c.VL(2, 4, 36, OL)
    c.VL(77, 4, 36, OL)
    # Front gable entrance frame on left (x=5..21, y=10..40)
    c.R(6, 12, 14, 28, OL)
    c.R(7, 13, 12, 26, J('machiya_timber', 0))
    # Lush crops visible inside open doorway + sliding metal door frame
    for cy in (24, 29, 34):
        c.HL(8, cy, 10, J('pine_bamboo', 3))
        c.HL(8, cy + 1, 10, J('moss', 4))
    c.VL(13, 13, 26, J('concrete_grey', 3))
    c.HL(7, 22, 12, J('concrete_grey', 3))


# ─────────────────────────── 16. inaka-sunflower-patch (3×2) ───────────────────────────
@kit(
    'inaka-sunflower-patch',
    '여름 해바라기 군락(ひまわり畑) — 황금빛 해바라기 7송이·갈색 씨앗판·넓은 잎·흙이랑(3×2)',
    3, 2, 'tree',
    solid=[(0, 1), (1, 1), (2, 1)],
    tags=['inaka', '해바라기', '여름꽃', '꽃밭', '여름방학'],
    rules='시골집 담장 앞이나 들판 길가에 심는다.',
    role='prop',
)
def draw_sunflower_patch(c: Cv, base: Cv) -> None:
    """Draw 3x2 tall blooming summer sunflowers on a raised soil bed."""
    # 3/4 Raised garden soil bed at bottom (x=2..46, y=24..31)
    rect_3d(c, 2, 24, 44, 7, 3, 'aged_cedar', top_t=3, front_t=1)
    # Lush broad green leaves & thick vertical stalks (y=10..26)
    canopy_clusters(c, [(8, 21, 5.5, 4.0), (16, 20, 6.0, 4.5), (25, 21, 6.0, 4.5), (34, 20, 6.0, 4.5), (41, 21, 5.0, 4.0)], 'pine_bamboo')
    flowers = [(7, 11, 4.2), (14, 7, 4.6), (21, 12, 4.0), (27, 6, 4.8), (34, 11, 4.2), (41, 8, 4.5)]
    for fx, fy, r in flowers:
        c.R(fx - 1, int(fy + 2), 3, 25 - int(fy + 2), OL)
        c.VL(fx, int(fy + 2), 25 - int(fy + 2), J('pine_bamboo', 3))
    for fx, fy, r in flowers:
        # Outer dark contour + golden-amber petal crown + dark brown seed disc center
        disc(c, fx, fy, r + 1.0, OL)
        disc(c, fx, fy, r, J('lantern_amber', 3))
        for ang_i in range(8):
            ang = ang_i * math.pi / 4.0
            px = round(fx + math.cos(ang) * (r - 0.5))
            py = round(fy + math.sin(ang) * (r - 0.5))
            c.P(px, py, J('lantern_amber', 4))
        disc(c, fx, fy, r * 0.48, J('machiya_timber', 1))
        c.P(fx - 1, fy - 1, J('aged_cedar', 3))


# ─────────────────────────── 17. inaka-hydrangea-hedge (3×2) ───────────────────────────
@kit(
    'inaka-hydrangea-hedge',
    '수국 꽃덤불(紫陽花垣) — 이끼 돌담 위 청보라·분홍·하늘색 수국 꽃송이(3×2)',
    3, 2, 'tree',
    solid=[(0, 1), (1, 1), (2, 1)],
    tags=['inaka', '수국', '아지사이', '꽃덤불', '돌담', '여름'],
    rules='고민가·기와집 돌담 앞이나 버스 정류장·산길 옆에 둔다.',
    role='prop',
)
def draw_hydrangea_hedge(c: Cv, base: Cv) -> None:
    """Draw 3x2 lush blue, violet, and pink hydrangea bushes along a low mossy stone curb."""
    # Low mossy stone curb at bottom (x=2..46, y=23..31)
    plinth_34(c, 2, 23, 44, 8, top_h=3, mat='shrine_flagstone')
    for mx in (6, 15, 27, 38):
        c.R(mx, 24, 4, 2, J('moss', 3))
    # Deep green hydrangea leaf mounds (y=6..25)
    canopy_clusters(
        c,
        [(10, 16, 7.5, 6.5), (21, 14, 8.5, 7.0), (32, 15, 8.0, 6.8), (40, 17, 6.5, 5.5)],
        'pine_bamboo',
    )
    # Hydrangea flower clusters (blue, sky-slate, violet-pink, sakura pink)
    blooms = [
        (7, 14, 3.2, 'noren_indigo'),
        (13, 11, 3.5, 'arcade_skylight_slate'),
        (18, 17, 3.0, 'sakura_petal'),
        (23, 10, 3.6, 'noren_indigo'),
        (28, 15, 3.4, 'arcade_skylight_slate'),
        (34, 11, 3.5, 'sakura_petal'),
        (39, 16, 3.2, 'noren_indigo'),
        (15, 19, 2.8, 'arcade_skylight_slate'),
        (31, 19, 2.8, 'sakura_petal'),
    ]
    for bx, by, br, bm in blooms:
        disc(c, bx, by, br + 0.8, OL)
        disc(c, bx, by, br, J(bm, 2))
        disc(c, bx - 0.6, by - 0.6, br * 0.72, J(bm, 3))
        # Individual 4-petal floret highlights
        for dx, dy in ((-1, -1), (1, -1), (-1, 1), (0, 0)):
            c.P(bx + dx, by + dy, J(bm, 4))


# ─────────────────────────── 18. inaka-jizo-shrine-row (3×2) ───────────────────────────
@kit(
    'inaka-jizo-shrine-row',
    '길가 지장보살 사당(お地蔵様三体) — 이끼 낀 석불 3기·붉은 턱받이·목조 보호각·바람개비(3×2)',
    3, 2, 'structure',
    solid=[(0, 1), (1, 1), (2, 1)],
    tags=['inaka', '지장보살', '사당', '돌부처', '고개', '신사'],
    rules='시골 갈림길이나 고갯길·돌계단 입구에 세운다.',
    role='prop',
)
def draw_jizo_shrine_row(c: Cv, base: Cv) -> None:
    """Draw 3x2 mossy stone Jizo statues (3 statues) in red bibs under a weathered wooden shelter roof."""
    # Mossy 3/4 stone altar plinth (x=3..45, y=22..31)
    plinth_34(c, 3, 22, 42, 9, top_h=3, mat='shrine_flagstone')
    for mx in (5, 18, 34, 41):
        c.R(mx, 23, 3, 2, J('moss', 3))
    # Wooden shelter posts on left & right
    for px in (5, 40):
        c.R(px, 10, 3, 13, OL)
        c.VL(px + 1, 10, 12, J('aged_cedar', 3))
    # 3 Carved stone Jizo statues with round heads & bright red cloth bibs (x=11, 22, 33)
    for jx in (11, 22, 33):
        # Body
        c.R(jx - 3, 15, 7, 8, OL)
        c.R(jx - 2, 16, 5, 6, J('shrine_flagstone', 3))
        c.VL(jx + 2, 16, 6, J('shrine_flagstone', 2))
        # Red cloth bib (maedare)
        c.R(jx - 2, 16, 5, 3, J('torii_vermilion', 3))
        c.HL(jx - 1, 16, 3, J('torii_vermilion', 4))
        # Round stone head
        disc(c, jx, 13, 3.2, OL)
        disc(c, jx, 13, 2.2, J('shrine_flagstone', 3))
        c.P(jx - 1, 12, J('shrine_flagstone', 4))
        # Serene closed eyes
        c.P(jx - 1, 13, J('shrine_flagstone', 1))
        c.P(jx + 1, 13, J('shrine_flagstone', 1))
    # 3/4 Weathered cedar shingle roof over the Jizo row (x=2..46, y=2..11)
    corrugated_roof_34(c, 2, 2, 44, 9, mat='aged_cedar', rust_ratio=0.0)
    for mx in (8, 25, 37):
        c.R(mx, 4, 4, 2, J('moss', 3))
    # Colorful pinwheel (kazaguruma) & wildflower offering on left (x=4..8, y=16..23)
    c.VL(6, 17, 6, OL)
    disc(c, 6, 16, 2.2, OL)
    c.P(5, 15, J('torii_vermilion', 4))
    c.P(7, 15, J('lantern_amber', 4))
    c.P(5, 17, J('arcade_skylight_slate', 4))
    c.P(7, 17, J('sakura_petal', 4))


# ─────────────────────────── 19. inaka-wooden-pole-transformer (1×3) ───────────────────────────
@kit(
    'inaka-wooden-pole-transformer',
    '시골 나무 전봇대 — 갈색 방부목 기둥·애자 완철·주상 변압기·갓 가로등(1×3)',
    1, 3, 'column',
    solid=[(0, 2)],
    tags=['inaka', '전봇대', '전신주', '가로등', '시골길'],
    rules='시골길·삼거리·간이역 앞 길가에 세운다. 발 한 칸만 막힌다.',
    role='prop',
)
def draw_wooden_pole_transformer(c: Cv, base: Cv) -> None:
    """Draw 1x3 brown creosote wooden utility pole with porcelain insulators, transformer bucket, and streetlamp."""
    # Base stone collar & grass tuft + yellow/black guy-wire guard (y=36..47)
    disc(c, 8, 45, 4.5, OL, ry=2.2)
    disc(c, 8, 44, 3.5, J('moss', 2), ry=1.6)
    # Main tapered dark-brown wooden pole (x=6..10, y=2..45)
    c.R(6, 2, 5, 43, OL)
    c.VL(7, 3, 41, J('aged_cedar', 3))
    c.VL(8, 3, 41, J('machiya_timber', 3))
    c.VL(9, 3, 41, J('machiya_timber', 1))
    # Pole top 3/4 cap
    c.HL(7, 2, 3, J('aged_cedar', 4))
    # Upper 2 crossarms with white porcelain insulators (y=5..12)
    for cy in (5, 10):
        c.R(1, cy, 14, 3, OL)
        c.HL(2, cy + 1, 12, J('aged_cedar', 3))
        for ix in (2, 5, 11, 13):
            c.R(ix, cy - 2, 2, 3, OL)
            c.P(ix, cy - 1, J('vending_cool_white', 4))
    # Cylindrical grey pole-mounted transformer bucket in 3/4 (x=9..15, y=14..23)
    rect_3d(c, 9, 14, 6, 9, 2, 'concrete_grey', top_t=4, front_t=2)
    # Retro gooseneck rural streetlamp bracket on left (x=1..7, y=21..27)
    line(c, 6, 22, 2, 24, OL)
    c.R(1, 24, 5, 3, OL)
    c.HL(2, 25, 3, J('vending_cool_white', 4))
    c.R(2, 26, 3, 2, J('lantern_amber', 4))
    # Yellow & black diagonal warning sheath near bottom (y=34..43)
    for y in range(34, 43):
        c.P(7, y, J('lantern_amber', 4) if y % 2 == 0 else OL)
        c.P(8, y, J('lantern_amber', 3) if y % 2 == 0 else OL)


# ─────────────────────────── 20. inaka-retro-postbox-vending (2×2) ───────────────────────────
@kit(
    'inaka-retro-postbox-vending',
    '둥근 붉은 우체통과 시골 자판기 — 쇼와 원통형 우체통(1호)·음료 자판기(2×2)',
    2, 2, 'structure',
    solid=[(0, 1), (1, 1)],
    tags=['inaka', '우체통', '자판기', '막과자가게', '간이역', '시골길'],
    rules='막과자 가게(다가시야)·버스 정류장·간이역 옆에 놓는다.',
    role='prop',
)
def draw_retro_postbox_vending(c: Cv, base: Cv) -> None:
    """Draw 2x2 classic round cylindrical red postbox paired with a weathered country drink vending machine."""
    # Concrete base pad across bottom (x=2..30, y=25..31)
    plinth_34(c, 2, 25, 28, 6, top_h=2, mat='paving_stone')
    # 1. Left: Showa-era round cylindrical red postbox (x=3..13, y=9..27)
    # Base iron pedestal
    c.R(5, 22, 6, 5, OL)
    c.R(6, 23, 4, 3, J('kawara_dark_tile', 1))
    # Cylindrical red body
    c.R(4, 11, 8, 12, OL)
    c.R(5, 12, 6, 10, J('torii_vermilion', 3))
    c.VL(5, 12, 10, J('torii_vermilion', 4))
    c.VL(10, 12, 10, J('torii_vermilion', 1))
    # Domed 3/4 top cap
    disc(c, 8, 11, 4.2, OL, ry=2.5)
    disc(c, 8, 11, 3.2, J('torii_vermilion', 3), ry=1.8)
    c.HL(6, 10, 4, J('torii_vermilion', 4))
    # Mail slot & white collection timetable plate
    c.HL(6, 14, 4, OL)
    c.R(6, 16, 3, 3, J('vending_cool_white', 4))
    # 2. Right: 3/4 Country beverage vending machine (x=14..30, y=3..27)
    rect_3d(c, 14, 3, 16, 24, 4, 'vending_cool_white', top_t=4, front_t=3)
    # Red top header stripe
    c.R(15, 8, 14, 3, J('torii_vermilion', 3))
    c.HL(16, 9, 8, J('vending_cool_white', 4))
    # Lit beverage display window (x=16..28, y=11..19) showing rows of colorful cans
    c.R(16, 11, 12, 8, OL)
    c.R(17, 12, 10, 6, J('vending_cool_white', 4))
    can_cols = ['torii_vermilion', 'noren_indigo', 'pine_bamboo', 'lantern_amber', 'arcade_skylight_slate']
    for k, cm in enumerate(can_cols):
        c.R(17 + k * 2, 13, 1, 2, J(cm, 3))
        c.R(17 + k * 2, 16, 1, 2, J(can_cols[(k + 2) % 5], 3))
    # Coin slot + dark pickup flap at bottom (y=21..25)
    c.R(26, 19, 2, 2, J('lantern_amber', 3))
    c.R(17, 21, 9, 4, OL)
    c.R(18, 22, 7, 2, J('kawara_dark_tile', 1))


# ─────────────────────────── 21. inaka-waterwheel-mill (4×4) ───────────────────────────
@kit(
    'inaka-waterwheel-mill',
    '시골 물레방아간(水車小屋) — 억새 초가 지붕·통나무 물레바퀴·석조 수로 물보라(4×4)',
    4, 4, 'building',
    solid=rows(4, [2, 3]),
    tags=['inaka', '물레방아', '물레방아간', '방앗간', '농수로', '다랑논'],
    rules='농수로(inaka-canal-water)나 시골 개울 옆에 붙여 세운다.',
    role='building',
    doors=[(1, 3, 1)],
)
def draw_waterwheel_mill(c: Cv, base: Cv) -> None:
    """Draw 4x4 country wooden waterwheel mill hut with timber wheel dipping into a stone sluice channel."""
    # 1. Left/center: Mill hut stone plinth + timber walls + thatched roof (x=2..45, y=4..60)
    plinth_34(c, 2, 50, 43, 10, top_h=3, mat='shrine_flagstone')
    c.R(4, 28, 39, 23, OL)
    plaster_wall(c, 5, 28, 37, 10, seed=9)
    boards_wall(c, 5, 38, 37, 12, mat='aged_cedar', t=2, bw=4)
    # Wooden sliding door on left (x=10..22, y=34..50) + barred mill window (x=26..36, y=31..39)
    c.R(10, 34, 12, 17, OL)
    boards_wall(c, 11, 35, 10, 15, mat='machiya_timber', t=2, bw=3)
    c.R(26, 31, 10, 8, OL)
    c.R(27, 32, 8, 6, J('machiya_timber', 0))
    for gx in (29, 31, 33):
        c.VL(gx, 32, 6, J('aged_cedar', 3))
    # Stacked straw rice sacks beside door (x=24..35, y=45..54)
    for sy in (49, 46):
        rect_3d(c, 25, sy, 9, 4, 2, 'tatami_straw', top_t=4, front_t=2)
    # 3/4 Thatch roof over mill hut (x=1..46, y=4..29)
    thatch_roof_34(c, 1, 46, 4, 29)
    # 2. Right: Stone sluice trough & large 3/4 wooden waterwheel (x=42..62, y=18..61)
    rect_3d(c, 42, 46, 20, 15, 4, 'wet_cobble', top_t=3, front_t=1)
    c.R(44, 48, 16, 11, J('onsen_mineral_teal', 2))
    c.HL(44, 49, 16, J('onsen_mineral_teal', 4))
    # Waterwheel outer rim, deep 3/4 wooden paddles, & spokes (center=(51, 36), rx=9, ry=13)
    disc(c, 51, 36, 9.5, OL, ry=13.5)
    disc(c, 51, 36, 8.2, J('machiya_timber', 2), ry=12.0)
    disc(c, 51, 36, 6.2, J('aged_cedar', 3), ry=9.5)
    disc(c, 51, 36, 4.2, J('machiya_timber', 0), ry=6.5)
    # 8 Wooden spokes + 3/4 paddle blades
    for k in range(8):
        ang = k * math.pi / 4.0
        x1 = round(51 + math.cos(ang) * 7.5)
        y1 = round(36 + math.sin(ang) * 11.0)
        line(c, 51, 36, x1, y1, J('aged_cedar', 4 if math.sin(ang) < 0 else 2))
        c.R(x1 - 2, y1 - 1, 4, 2, OL)
        c.HL(x1 - 1, y1, 3, J('aged_cedar', 4 if math.sin(ang) < 0 else 2))
    # Iron axle hub supported from mill wall
    c.R(40, 34, 13, 4, OL)
    c.HL(41, 35, 11, J('kawara_dark_tile', 3))
    # Splashing white water foam at bottom of wheel (y=47..56)
    for fx, fy in ((47, 48), (50, 49), (53, 48), (49, 52), (54, 51), (51, 54)):
        c.R(fx, fy, 3, 2, J('vending_cool_white', 4))


# ─────────────────────────── 22. inaka-sluice-gate (2×2) ───────────────────────────
@kit(
    'inaka-sluice-gate',
    '농수로 철제 수문(水門) — 붉은 핸들 나사봉·콘크리트 수로 교각·수문 물살(2×2)',
    2, 2, 'structure',
    solid=[(0, 0), (1, 0), (0, 1), (1, 1)],
    tags=['inaka', '수문', '농수로', '용수로', '논', '물길'],
    rules='농수로(inaka-canal-water)나 논 물길 어귀에 놓는다.',
    role='water',
)
def draw_sluice_gate(c: Cv, base: Cv) -> None:
    """Draw 2x2 iron hand-wheel irrigation canal sluice gate with concrete wing-walls and water overflow."""
    # Canal water base underneath
    base.R(0, 0, 32, 32, J('canal_indigo', 2))
    for y in range(4, 30, 6):
        base.HL(2, y, 28, J('onsen_mineral_teal', 3))
    # Left & right 3/4 concrete canal wing-walls (x=1..8 and x=24..31, y=10..30)
    rect_3d(c, 1, 10, 7, 20, 5, 'paving_stone', top_t=4, front_t=2)
    rect_3d(c, 24, 10, 7, 20, 5, 'paving_stone', top_t=4, front_t=2)
    # Tall steel guide frame & top crossbar (x=7..25, y=4..28)
    c.R(7, 4, 3, 24, OL)
    c.VL(8, 5, 22, J('kawara_dark_tile', 3))
    c.R(22, 4, 3, 24, OL)
    c.VL(23, 5, 22, J('kawara_dark_tile', 2))
    rect_3d(c, 6, 4, 20, 5, 2, 'kawara_dark_tile', top_t=4, front_t=2)
    # Threaded vertical screw spindle + red 3/4 hand-wheel at top (x=12..20, y=1..14)
    c.R(15, 1, 3, 15, OL)
    c.VL(16, 2, 13, J('vending_cool_white', 3))
    disc(c, 16, 4, 4.5, OL, ry=2.2)
    disc(c, 16, 4, 3.5, J('torii_vermilion', 3), ry=1.5)
    c.HL(14, 3, 5, J('torii_vermilion', 4))
    # Steel sluice gate plate in channel (x=9..23, y=14..26) + foaming water at bottom
    rect_3d(c, 9, 14, 14, 12, 2, 'concrete_grey', top_t=3, front_t=1)
    c.HL(10, 19, 12, J('kawara_dark_tile', 0))
    for fx in range(9, 23, 2):
        c.R(fx, 25, 2, 3, J('vending_cool_white', 4 if fx % 4 == 1 else 3))
        c.P(fx, 28, J('onsen_mineral_teal', 4))


# ─────────────────────────── 23. inaka-rice-rack-hasagi (3×2) ───────────────────────────
@kit(
    'inaka-rice-rack-hasagi',
    '하사기 볏단 건조대(稲架掛け) — 대나무 삼각 버팀목·황금 벼 이삭 다발(3×2)',
    3, 2, 'structure',
    solid=[(0, 1), (1, 1), (2, 1)],
    tags=['inaka', '하사기', '볏단', '추수', '논두렁', '다랑논'],
    rules='논두렁(inaka-aze-path)이나 추수철 논 가장자리에 길게 늘어놓는다.',
    role='prop',
)
def draw_rice_rack_hasagi(c: Cv, base: Cv) -> None:
    """Draw 3x2 split-bamboo drying rack (hasagi) draped with golden harvested rice sheaves."""
    # Ground shadow along bottom (x=3..45, y=26..30)
    c.R(4, 27, 40, 3, OL)
    # Left & right A-frame bamboo/cedar support legs (x=3..10 and x=38..45, y=4..29)
    for lx, rx in ((4, 9), (39, 44)):
        for d in (-1, 0, 1):
            line(c, lx + 3 + d, 5, lx - 1 + d, 28, OL if d != 0 else J('aged_cedar', 3))
            line(c, lx + 2 + d, 5, rx + 1 + d, 28, OL if d != 0 else J('aged_cedar', 2))
    # Horizontal top bamboo pole
    c.R(2, 7, 44, 3, OL)
    c.HL(3, 8, 42, J('tatami_straw', 4))
    # Thick golden-straw rice sheaves draped over rack in 3/4 volume (x=7..41, y=7..26)
    c.R(7, 7, 34, 19, OL)
    for y in range(8, 25):
        for x in range(8, 40):
            sheaf = (x - 8) % 4
            if y < 12:
                # Rounded 3/4 top crest of bundled rice stalks
                lv = 4 if sheaf < 2 else 3
                c.P(x, y, J('tatami_straw', lv))
            elif y == 12:
                # Tied straw binding cord
                c.P(x, y, J('aged_cedar', 2 if sheaf != 3 else 0))
            else:
                # Hanging golden grain heads
                lv = 3 if sheaf == 0 else (1 if sheaf == 3 else 2)
                if y >= 22 and (x + y) % 2 == 0:
                    lv = max(0, lv - 1)
                mat = 'lantern_amber' if (x + y) % 5 == 0 else 'tatami_straw'
                c.P(x, y, J(mat, lv))
    # Rugged irregular fringe at bottom of sheaves
    for x in range(8, 40, 2):
        c.P(x, 25, J('tatami_straw', 2))
        c.P(x, 26, OL)


# ─────────────────────────── 24. inaka-scarecrow-pair (2×2) ───────────────────────────
@kit(
    'inaka-scarecrow-pair',
    '논두렁 허수아비 한 쌍(案山子) — 삿갓 쓴 외다리 짚 허수아비·기운 헌 옷·고추잠자리(2×2)',
    2, 2, 'prop',
    solid=[(0, 1), (1, 1)],
    tags=['inaka', '허수아비', '논두렁', '고추잠자리', '논', '여름방학'],
    rules='논두렁(inaka-aze-path)이나 물논·푸른 논 가장자리에 세운다.',
    role='prop',
)
def draw_scarecrow_pair(c: Cv, base: Cv) -> None:
    """Draw 2x2 inanimate bamboo-stick & straw scarecrow pair in sedge hats on a grassy paddy bund."""
    # Grassy earthen bund mound at bottom (x=2..30, y=24..31)
    disc(c, 16, 28, 13.0, OL, ry=3.2)
    disc(c, 16, 27, 12.0, J('moss', 2), ry=2.5)
    disc(c, 15, 26, 9.0, J('moss', 3), ry=1.8)
    # 1. Tall main straw scarecrow on left-center (x=10, y=3..27) — single wooden stake leg!
    c.R(9, 4, 3, 24, OL)
    c.VL(10, 5, 22, J('aged_cedar', 3))
    # Horizontal bamboo cross-stick arms (x=2..19, y=13..15) with straw tufts at ends
    c.R(2, 13, 18, 3, OL)
    c.HL(3, 14, 16, J('tatami_straw', 4))
    # Patched kimono/work-shirt hanging on sticks (x=5..16, y=12..22)
    c.R(5, 12, 11, 10, OL)
    c.R(6, 13, 9, 8, J('noren_indigo', 2))
    c.R(6, 13, 4, 5, J('noren_indigo', 3))
    # Square cloth patch in rust-orange & straw belt
    c.R(11, 16, 3, 3, J('noren_rust', 3))
    c.HL(6, 18, 9, J('tatami_straw', 4))
    # Round tied straw-sack head (no human skin, straw texture + drawn X mark)
    disc(c, 10, 10, 3.2, OL)
    disc(c, 10, 10, 2.2, J('tatami_straw', 3))
    # Conical woven sugegasa straw hat in 3/4 view (x=3..17, y=4..9)
    for j in range(5):
        hw = 2 + j
        c.HL(10 - hw - 1, 4 + j, hw * 2 + 3, OL)
        c.HL(10 - hw, 4 + j, hw * 2 + 1, J('tatami_straw', 4 if j < 3 else 3))
    # 2. Smaller companion scarecrow on right (x=23, y=10..27) + red autumn dragonfly
    c.R(22, 11, 3, 17, OL)
    c.VL(23, 12, 15, J('aged_cedar', 3))
    c.R(18, 17, 11, 3, OL)
    c.HL(19, 18, 9, J('tatami_straw', 3))
    c.R(20, 17, 7, 7, OL)
    c.R(21, 18, 5, 5, J('torii_vermilion', 3))
    c.R(22, 20, 3, 2, J('cream_stucco', 3))
    for j in range(4):
        hw = 1 + j
        c.HL(23 - hw - 1, 11 + j, hw * 2 + 3, OL)
        c.HL(23 - hw, 11 + j, hw * 2 + 1, J('tatami_straw', 4 if j < 2 else 3))
    # Tiny red dragonfly (akatonbo) perched above right hat (x=24..28, y=8..10)
    c.HL(24, 9, 4, J('torii_vermilion', 4))
    c.P(25, 8, J('vending_cool_white', 4))
    c.P(27, 8, J('vending_cool_white', 4))


# ─────────────────────────── 25. inaka-bamboo-fence-gate (4×2) ───────────────────────────
@kit(
    'inaka-bamboo-fence-gate',
    '타케가키 대나무 울타리와 사립문(竹垣と木戸) — 쪼갠 대나무 격자담·삼나무 지붕 목문(4×2)',
    4, 2, 'structure',
    solid=[(0, 1), (1, 1), (3, 1)],
    other='star',
    tags=['inaka', '죽담', '대나무울타리', '타케가키', '사립문', '담장'],
    rules='고민가·기와 농가 마당 둘레에 4×2 울타리로 세운다. 사립문 칸(2,1)은 지나다닐 수 있다.',
    role='fence',
)
def draw_bamboo_fence_gate(c: Cv, base: Cv) -> None:
    """Draw 4x2 woven split-bamboo country fence (takegaki) with roofed wooden wicket gate."""
    # Walkable stone threshold under gate at (x=32..48, y=22..31) on base layer
    rect_3d(base, 32, 23, 16, 8, 4, 'shrine_flagstone', top_t=3, front_t=2)
    # Left & right bamboo fence sections (x=1..32 and x=48..63, y=10..30)
    for fx, fw in ((1, 31), (48, 15)):
        plinth_34(c, fx, 24, fw, 7, top_h=2, mat='shrine_flagstone')
        c.R(fx, 10, fw, 15, OL)
        # 3/4 Top thick bamboo coping rail (y=10..13)
        c.HL(fx + 1, 11, fw - 2, J('tatami_straw', 4))
        c.HL(fx + 1, 12, fw - 2, J('tatami_straw', 3))
        c.HL(fx + 1, 13, fw - 2, OL)
        # Woven split-bamboo lattice face (y=14..24) with black hemp cord knots (shuronawa)
        for y in range(14, 24):
            for x in range(fx + 1, fx + fw - 1):
                diag = ((x + y) % 4 == 0) or ((x - y) % 4 == 0)
                c.P(x, y, J('tatami_straw', 3 if diag else 1))
                if y in (16, 21) and (x - fx) % 6 == 3:
                    c.P(x, y, OL)
    # Central roofed wooden wicket gate (kidomon, x=30..50, y=2..30)
    for px in (31, 46):
        c.R(px, 9, 3, 21, OL)
        c.VL(px + 1, 9, 20, J('machiya_timber', 3))
    # Small 3/4 cedar shingle roof over gate (x=29..51, y=2..10)
    corrugated_roof_34(c, 29, 2, 22, 8, mat='aged_cedar', rust_ratio=0.0)
    # Half-open wooden lattice gate leaf on left of opening (x=34..41, y=13..27)
    c.R(34, 13, 7, 14, OL)
    c.R(35, 14, 5, 12, J('aged_cedar', 3))
    for gy in (16, 19, 22):
        c.HL(35, gy, 5, J('machiya_timber', 1))


# ─────────────────────────── 26. inaka-mossy-stone-wall (4×2) ───────────────────────────
@kit(
    'inaka-mossy-stone-wall',
    '이끼 낀 시골 돌담(苔むした石垣) — 3/4 풀 덮인 윗면·자연석 메쌓기·초록 이끼 군락(4×2)',
    4, 2, 'wall',
    solid=rows(4, [0, 1]),
    tags=['inaka', '돌담', '이끼돌담', '축대', '옹벽', '시골길'],
    rules='언덕 아래나 농가 대지 경계·다랑논 축대로 이어 세운다.',
    role='wall',
)
def draw_mossy_stone_wall(c: Cv, base: Cv) -> None:
    """Draw 4x2 dry-stacked mossy fieldstone retaining wall with 3/4 grassy top cap and fieldstone face."""
    c.R(1, 5, 62, 26, OL)
    # 1. 3/4 Top grassy & coping-stone surface (y=6..13)
    for y in range(6, 13):
        for x in range(2, 62):
            is_moss = y < 10 or H(x // 3, y, 61) < 0.65
            if is_moss:
                lv = 4 if y <= 7 else (3 if (x + y) % 3 != 0 else 2)
                c.P(x, y, J('moss', lv))
            else:
                c.P(x, y, J('shrine_flagstone', 4 if y <= 10 else 3))
    # Tiny white wildflowers on top of wall
    for wx in (9, 24, 41, 54):
        c.P(wx, 7, J('vending_cool_white', 4))
        c.P(wx + 1, 8, J('lantern_amber', 4))
    c.HL(2, 13, 60, OL)
    # 2. Front dry-stacked fieldstone elevation (y=14..29) with velvety moss cushions
    courses = [(14, 5), (19, 5), (24, 6)]
    for row_idx, (cy, ch) in enumerate(courses):
        x = 2
        col_idx = 0
        while x < 62:
            sw = min(62 - x, 7 + int(H(row_idx, col_idx, 73) * 6))
            if sw < 4:
                sw = 62 - x
            mossy = H(row_idx, col_idx, 79) < 0.45
            tone = 2 + (1 if (row_idx + col_idx) % 2 == 0 else 0)
            for j in range(ch):
                for i in range(sw):
                    px, py = x + i, cy + j
                    if i == sw - 1 or j == ch - 1:
                        col = OL
                    elif j == 0 or i == 0:
                        col = J('moss' if mossy and j <= 1 else 'shrine_flagstone', min(4, tone + 1))
                    elif j == ch - 2 or i == sw - 2:
                        col = J('shrine_flagstone', max(0, tone - 1))
                    else:
                        col = J('moss', 3 if j == 1 else 2) if (mossy and j <= 2) else J('shrine_flagstone', tone)
                    c.P(px, py, col)
            x += sw
            col_idx += 1
    c.HL(2, 29, 60, J('shrine_flagstone', 0))


# ─────────────────────────── 27. inaka-roadside-mirror (1×2) ───────────────────────────
@kit(
    'inaka-roadside-mirror',
    '커브길 볼록거울(カーブミラー) — 주황 테두리 원형 거울·노랑·검정 줄무늬 기둥(1×2)',
    1, 2, 'column',
    solid=[(0, 1)],
    tags=['inaka', '볼록거울', '카브미러', '도로거울', '삼거리', '시골길'],
    rules='시골길 모퉁이나 삼거리·건널목 옆에 세운다.',
    role='prop',
)
def draw_roadside_mirror(c: Cv, base: Cv) -> None:
    """Draw 1x2 orange-rimmed convex traffic mirror on a yellow-and-black striped steel post."""
    # Concrete footing & grass tuft at bottom (x=4..12, y=26..31)
    rect_3d(c, 4, 26, 8, 5, 2, 'paving_stone', top_t=3, front_t=2)
    c.P(3, 29, J('moss', 3))
    c.P(12, 29, J('moss', 3))
    # Yellow & black striped vertical post (x=7..9, y=13..27)
    c.R(6, 13, 4, 14, OL)
    for y in range(14, 27):
        col = J('lantern_amber', 4 if y % 4 == 0 else 3) if (y // 2) % 2 == 0 else OL
        c.P(7, y, col)
        c.P(8, y, col)
    # Circular orange-rimmed convex mirror at top (center=(8, 8), r=5.5)
    disc(c, 8, 8, 5.8, OL)
    disc(c, 8, 8, 4.8, J('torii_vermilion', 3))
    disc(c, 7.6, 7.6, 4.2, J('torii_vermilion', 4))
    # Convex glass surface reflecting blue sky & green trees
    disc(c, 8, 8, 3.4, J('arcade_skylight_slate', 2))
    disc(c, 7.5, 7.2, 2.4, J('arcade_skylight_slate', 3))
    c.HL(6, 9, 5, J('pine_bamboo', 2))
    # Bright curved specular reflection on top-left of convex mirror
    c.P(6, 6, J('vending_cool_white', 4))
    c.P(7, 6, J('vending_cool_white', 4))
    c.P(6, 7, J('vending_cool_white', 4))


# ─────────────────────────── 28. inaka-bicycle-parked (2×1) ───────────────────────────
@kit(
    'inaka-bicycle-parked',
    '세워둔 시골 자전거(ママチャリ) — 앞 철사 바구니·밀짚모자·짐받이(2×1)',
    2, 1, 'prop',
    solid=[(0, 0), (1, 0)],
    tags=['inaka', '자전거', '마마차리', '바구니', '간이역', '다가시야'],
    rules='막과자 가게·간이역·고민가 마당 앞에 세워 둔다.',
    role='prop',
)
def draw_bicycle_parked(c: Cv, base: Cv) -> None:
    """Draw 2x1 classic country utility bicycle (mamachari) in 3/4 view with front wire basket."""
    # Ground shadow under wheels (x=4..28, y=13..15)
    c.R(4, 13, 24, 2, OL)
    # Front wheel (x=8, y=10) & rear wheel (x=23, y=10)
    for wx in (8, 23):
        disc(c, wx, 10, 4.2, OL)
        disc(c, wx, 10, 2.8, J('concrete_grey', 3))
        disc(c, wx, 10, 1.5, J('asphalt', 1))
        c.P(wx, 10, J('vending_cool_white', 4))
    # Mint-teal step-through frame & rear fender
    for d in (-1, 0):
        line(c, 9, 4 + d, 14, 11 + d, OL if d == -1 else J('onsen_mineral_teal', 4))
        line(c, 14, 11 + d, 19, 6 + d, OL if d == -1 else J('onsen_mineral_teal', 3))
        line(c, 14, 11 + d, 23, 10 + d, OL if d == -1 else J('onsen_mineral_teal', 3))
    # Silver handlebars (x=8..11, y=2..4) & front wire basket (x=4..9, y=4..8)
    c.R(8, 2, 3, 2, OL)
    c.P(9, 2, J('vending_cool_white', 4))
    rect_3d(c, 4, 4, 5, 5, 2, 'concrete_grey', top_t=4, front_t=3)
    c.P(6, 5, J('tatami_straw', 4))
    # Brown leather saddle (x=17..21, y=4..6) & rear luggage carrier (x=21..27, y=6..8)
    c.R(17, 4, 4, 3, OL)
    c.HL(18, 5, 2, J('aged_cedar', 3))
    c.R(21, 6, 6, 2, OL)
    c.HL(22, 6, 4, J('concrete_grey', 3))


# ─────────────────────────── 29. inaka-well-handpump (2×2) ───────────────────────────
@kit(
    'inaka-well-handpump',
    '시골 작두 우물 펌프(手押しポンプ井戸) — 돌우물 테두리·초록 주물 펌프·나무 물통과 찬 수박(2×2)',
    2, 2, 'water',
    solid=[(0, 1), (1, 1)],
    tags=['inaka', '우물', '작두펌프', '수박', '고민가', '여름방학'],
    rules='고민가·기와 농가 마당이나 텃밭 옆에 둔다.',
    role='water',
)
def draw_well_handpump(c: Cv, base: Cv) -> None:
    """Draw 2x2 old stone well with green cast-iron hand water pump, wooden bucket, and mossy stone apron."""
    # 1. 3/4 Wet mossy stone drainage apron across bottom (x=2..30, y=18..31)
    plinth_34(c, 2, 18, 28, 13, top_h=7, mat='wet_cobble')
    for mx, my in ((4, 20), (25, 19), (6, 24), (24, 24)):
        c.R(mx, my, 3, 2, J('moss', 3))
    # 2. Left/center: 3/4 Stone well curb + cedar board cover (x=4..20, y=10..24)
    rect_3d(c, 4, 11, 16, 12, 5, 'shrine_flagstone', top_t=4, front_t=2)
    # Wooden well cover boards on top
    c.R(6, 12, 12, 4, J('aged_cedar', 3))
    c.HL(6, 12, 12, J('aged_cedar', 4))
    c.VL(10, 12, 4, OL)
    c.VL(14, 12, 4, OL)
    # 3. Vintage deep-green cast-iron hand pump (x=11..18, y=2..14)
    c.R(11, 3, 5, 11, OL)
    c.R(12, 4, 3, 9, J('pine_bamboo', 2))
    c.VL(12, 4, 9, J('pine_bamboo', 4))
    disc(c, 13, 4, 3.0, OL, ry=1.8)
    disc(c, 13, 4, 2.0, J('pine_bamboo', 3), ry=1.2)
    # Raised cast-iron pump lever handle on left (x=5..12, y=3..9)
    line(c, 12, 5, 6, 8, OL)
    line(c, 12, 6, 6, 9, J('pine_bamboo', 3))
    # Spout pouring clear cold water on right (x=15..20, y=8..17)
    c.R(15, 8, 4, 3, OL)
    c.HL(16, 9, 2, J('pine_bamboo', 3))
    c.R(18, 10, 2, 7, J('vending_cool_white', 4))
    c.VL(19, 11, 6, J('onsen_mineral_teal', 3))
    # 4. Right: Cedar wooden tub (tarai) filled with cold water & chilling watermelon (x=17..28, y=15..24)
    rect_3d(c, 17, 15, 11, 8, 3, 'aged_cedar', top_t=4, front_t=2)
    c.HL(18, 20, 9, OL)
    c.R(18, 16, 9, 3, J('onsen_mineral_teal', 3))
    # Floating green watermelon in cold water tub
    disc(c, 23, 17, 2.4, OL, ry=1.8)
    disc(c, 23, 17, 1.6, J('pine_bamboo', 3), ry=1.2)
    c.P(22, 16, J('moss', 4))


# ─────────────────────────── 30. inaka-hillside-torii-stairs (4×5) ───────────────────────────
@kit(
    'inaka-hillside-torii-stairs',
    '언덕 삼나무 돌계단과 주홍 도리이(鎮守の石段鳥居) — 이끼 돌계단·삼나무 거목·석등·주홍 도리이(4×5)',
    4, 5, 'structure',
    solid=[(0, y) for y in range(5)] + [(3, y) for y in range(5)],
    other='star',
    tags=['inaka', '도리이', '돌계단', '신사', '삼나무', '계단', 'stair'],
    rules='언덕 신사 진입로나 숲길 오르막에 놓는다. 가운데 두 열(x=1,2)은 돌계단으로 걸어 올라갈 수 있다.',
    role='building',
)
def draw_hillside_torii_stairs(c: Cv, base: Cv) -> None:
    """Draw 4x5 moss-covered stone steps flanked by ancient cedar trunks, stone lanterns, and a vermilion torii gate."""
    # 1. Full 5-tile ascending 3/4 stone staircase on `base` (x=14..50, y=0..79) so characters walk up the center!
    base.R(13, 0, 38, 80, OL)
    for y in range(0, 80, 5):
        # Step top tread (3px bright flagstone) + step front riser (2px shadow + OL)
        base.R(14, y, 36, 3, J('shrine_flagstone', 3))
        base.HL(14, y, 36, J('shrine_flagstone', 4))
        base.HL(14, y + 3, 36, J('shrine_flagstone', 1))
        base.HL(14, y + 4, 36, J('shrine_flagstone', 0))
        for jx in (24, 34, 42):
            base.VL(jx + ((y // 5) % 2) * 3, y, 4, J('shrine_flagstone', 2))
        # Moss patches encroaching on edges of steps
        if (y // 5) % 2 == 0:
            base.R(14, y + 1, 4, 2, J('moss', 3))
            base.R(46, y + 1, 4, 2, J('moss', 2))
    # 2. Left & right mossy stone cheek-walls + ancient cedar trunks on `c` (x=1..14 and x=50..63)
    for sx in (2, 50):
        c.R(sx, 4, 12, 74, OL)
        for y in range(5, 77):
            for x in range(sx + 1, sx + 11):
                is_moss = (y % 9 < 3) or H(x // 2, y // 3, 83) < 0.45
                c.P(x, y, J('moss' if is_moss else 'shrine_flagstone', 3 if x < sx + 5 else 2))
    # Ancient cedar trunks on upper half (x=3..11 and x=53..61, y=6..52)
    for tx in (3, 53):
        c.R(tx, 6, 8, 46, OL)
        c.R(tx + 1, 7, 6, 44, J('aged_cedar', 2))
        c.VL(tx + 1, 7, 44, J('aged_cedar', 3))
        c.VL(tx + 6, 7, 44, J('machiya_timber', 1))
    # Lush cedar canopy clusters overhanging top left & right corners
    canopy_clusters(
        c,
        [(10, 12, 9.0, 8.0), (18, 8, 8.0, 6.5), (54, 12, 9.0, 8.0), (46, 8, 8.0, 6.5)],
        'pine_bamboo',
    )
    # 3. Pair of mossy stone lanterns (ishidoro) at bottom of stairs (x=5..14 and x=50..59, y=54..76)
    for lx in (5, 50):
        rect_3d(c, lx, 70, 9, 6, 2, 'shrine_flagstone', top_t=3, front_t=1)
        c.R(lx + 2, 62, 5, 9, OL)
        c.R(lx + 3, 63, 3, 7, J('shrine_flagstone', 2))
        # Lit fire-box (hibukuro)
        c.R(lx + 1, 57, 7, 6, OL)
        c.R(lx + 2, 58, 5, 4, J('lantern_amber', 4))
        #笠 (kasa) roof of stone lantern with moss
        for j in range(4):
            hw = 2 + j
            c.HL(lx + 4 - hw, 54 + j, hw * 2 + 1, OL if j == 3 else J('shrine_flagstone', 4 if j < 2 else 2))
        c.HL(lx + 3, 54, 3, J('moss', 3))
    # 4. Weathered vermilion Myojin Torii Gate spanning the stairs (y=12..54)
    # Left & right vermilion pillars (x=14..19 and x=45..50, y=18..54) with black nemaki base sleeves
    for px in (14, 45):
        c.R(px, 18, 5, 36, OL)
        c.R(px + 1, 19, 3, 27, J('torii_vermilion', 3))
        c.VL(px + 1, 19, 27, J('torii_vermilion', 4))
        c.VL(px + 3, 19, 27, J('torii_vermilion', 2))
        # Black stone/iron base sleeve (nemaki)
        c.R(px, 46, 5, 8, OL)
        c.R(px + 1, 47, 3, 6, J('kawara_dark_tile', 1))
    # Lower horizontal tie beam (nuki, x=11..53, y=24..28)
    rect_3d(c, 11, 24, 42, 4, 1, 'torii_vermilion', top_t=4, front_t=2)
    # Upper curved cap beam (kasagi + shimaki, x=8..56, y=13..20) with dark roof cap + moss
    c.R(8, 13, 48, 7, OL)
    c.HL(9, 14, 46, J('kawara_dark_tile', 4))
    c.HL(9, 15, 46, J('kawara_dark_tile', 2))
    c.R(9, 16, 46, 3, J('torii_vermilion', 3))
    c.HL(9, 16, 46, J('torii_vermilion', 4))
    for mx in (15, 31, 44):
        c.HL(mx, 14, 4, J('moss', 3))
    # Center strut (gakuzuka) + sacred straw shimenawa rope & white shide zigzags
    c.R(30, 19, 4, 6, OL)
    c.R(31, 20, 2, 4, J('kawara_dark_tile', 1))
    c.R(19, 27, 26, 3, OL)
    c.HL(20, 28, 24, J('tatami_straw', 4))
    for sx in (23, 29, 35, 40):
        c.R(sx, 29, 2, 4, OL)
        c.VL(sx, 29, 3, J('vending_cool_white', 4))


# ═══════════════════════════ 9 Ground & Water Tiles (16×16 each) ═══════════════════════════
def _paddy_water(c: Cv) -> None:
    """1a. inaka-paddy-water: Water-mirrored spring rice paddy with neat rows of young green seedlings."""
    for y in range(16):
        for x in range(16):
            ripple = (y % 4 == 0) or ((x + y * 3) % 11 == 0)
            t = 3 if (x + y * 2) % 9 == 0 else (1 if ripple else 2)
            c.P(x, y, J('onsen_mineral_teal', t))
    for gx, gy in ((6, 2), (14, 10)):
        c.P(gx, gy, J('vending_cool_white', 4))
    # 4px-spaced neat rows of young rice seedlings + dark water reflection underneath
    for sy in (2, 6, 10, 14):
        for sx in (2, 6, 10, 14):
            c.P(sx, sy + 1, J('onsen_mineral_teal', 0))
            c.P(sx, sy, J('pine_bamboo', 3))
            c.P(sx - 1, sy - 1, J('moss', 4))
            c.P(sx + 1, sy - 1, J('moss', 3))


def _paddy_summer(c: Cv) -> None:
    """1b. inaka-paddy-summer: Lush green summer rice paddy with dense layered rice rows."""
    for y in range(16):
        for x in range(16):
            row_m = y % 4
            if row_m == 3:
                c.P(x, y, J('onsen_mineral_teal', 0 if x % 2 == 0 else 1))
            else:
                clump = (x + (y // 4) * 2) % 4
                if row_m == 0:
                    c.P(x, y, J('moss', 4 if clump < 2 else 3))
                elif row_m == 1:
                    c.P(x, y, J('pine_bamboo', 4 if clump == 0 else 3))
                else:
                    c.P(x, y, J('pine_bamboo', 2 if clump < 3 else 1))


def _paddy_golden(c: Cv) -> None:
    """1c. inaka-paddy-golden: Golden autumn harvest rice paddy with heavy golden grain heads in rows."""
    for y in range(16):
        for x in range(16):
            row_m = y % 4
            clump = (x + (y // 4) * 2) % 4
            if row_m == 3:
                c.P(x, y, J('aged_cedar', 1 if clump == 3 else 2))
            elif row_m == 0:
                c.P(x, y, J('lantern_amber', 4 if clump < 2 else 3))
            elif row_m == 1:
                c.P(x, y, J('tatami_straw', 4 if clump == 0 else 3))
            else:
                c.P(x, y, J('tatami_straw', 2 if clump < 3 else 1))


def _aze_path(c: Cv) -> None:
    """2. inaka-aze-path: Raised earthen rice-paddy bund / country dirt footpath with grass-tuft accents."""
    for y in range(16):
        for x in range(16):
            h = H(x, y, 23)
            lv = 3 if h < 0.62 else (2 if h < 0.88 else 4)
            c.P(x, y, J('aged_cedar', lv))
    for gx, gy in ((1, 2), (13, 1), (3, 13), (14, 12), (8, 0), (0, 8)):
        c.P(gx, gy, J('moss', 3))
        c.P((gx + 1) % 16, gy, J('pine_bamboo', 3))
    for px, py in ((5, 4), (11, 7), (6, 11), (10, 13)):
        c.P(px, py, J('shrine_flagstone', 4))
        c.P(px + 1, py, J('shrine_flagstone', 2))

def _canal_water(c: Cv) -> None:
    """3a. inaka-canal-water: Rural irrigation canal water with flowing current streaks."""
    for y in range(16):
        for x in range(16):
            wave = (y in (3, 11) and (x + (y // 4) * 5) % 8 < 5)
            deep = (y in (0, 15))
            if deep:
                c.P(x, y, J('canal_indigo', 1))
            elif wave:
                c.P(x, y, J('onsen_mineral_teal', 3))
            else:
                c.P(x, y, J('canal_indigo', 2 if (x + y) % 5 != 0 else 3))
    for gx, gy in ((4, 3), (12, 11)):
        c.P(gx, gy, J('vending_cool_white', 4))
        c.P(gx + 1, gy, J('onsen_mineral_teal', 4))


def _canal_wall(c: Cv) -> None:
    """3b. inaka-canal-wall: 3/4 Concrete/stone rural irrigation canal wall with top coping & water line."""
    # Top 5px: 3/4 concrete/stone coping slab (y=0..4)
    for y in range(5):
        for x in range(16):
            if x % 8 == 7:
                c.P(x, y, J('paving_stone', 1))
            elif y == 0:
                c.P(x, y, J('paving_stone', 4))
            elif y == 4:
                c.P(x, y, OL)
            else:
                c.P(x, y, J('paving_stone', 3))
    # Middle 7px: vertical stone/concrete canal wall with damp moss (y=5..11)
    for y in range(5, 12):
        for x in range(16):
            joint = (x + (y // 4) * 4) % 8 == 7 or y == 8
            mossy = y >= 9 and H(x // 2, y, 37) < 0.45
            if joint:
                c.P(x, y, J('concrete_grey', 0))
            elif mossy:
                c.P(x, y, J('moss', 2 if y == 11 else 3))
            else:
                c.P(x, y, J('concrete_grey', 2 if y < 8 else 1))
    # Bottom 4px: canal water edge & white ripple (y=12..15)
    c.HL(0, 12, 16, J('canal_indigo', 0))
    c.HL(0, 13, 16, J('vending_cool_white', 3))
    c.HL(0, 14, 16, J('onsen_mineral_teal', 3))
    c.HL(0, 15, 16, J('canal_indigo', 2))


def _gravel_road(c: Cv) -> None:
    """4. inaka-gravel-road: Sun-bleached country gravel road with twin wheel ruts."""
    for y in range(16):
        for x in range(16):
            h = H(x, y, 51)
            rut = y in (4, 5, 10, 11)
            if rut:
                c.P(x, y, J('paving_stone', 2 if h < 0.65 else 3))
            else:
                c.P(x, y, J('cream_stucco', 3 if h < 0.55 else (2 if h < 0.85 else 4)))
    for gx, gy in ((2, 2), (9, 5), (13, 3), (4, 10), (11, 12), (7, 14)):
        c.P(gx, gy, J('gravel', 2))
        c.P((gx + 1) % 16, gy, J('shrine_flagstone', 4))
    for mx, my in ((1, 0), (14, 15)):
        c.P(mx, my, J('moss', 3))


def _river_shallow(c: Cv) -> None:
    """5. inaka-river-shallow: Clear shallow country stream with visible pebbles & sparkles."""
    for y in range(16):
        for x in range(16):
            h = H(x, y, 67)
            c.P(x, y, J('onsen_mineral_teal', 3 if h < 0.55 else (2 if h < 0.88 else 4)))
    # Submerged colorful river pebbles (2x2 / 2x1)
    pebbles = [
        (2, 3, 'shrine_flagstone', 3),
        (7, 2, 'aged_cedar', 3),
        (12, 5, 'wet_cobble', 3),
        (4, 9, 'wet_cobble', 2),
        (10, 10, 'shrine_flagstone', 3),
        (13, 13, 'aged_cedar', 2),
        (2, 14, 'shrine_flagstone', 2),
    ]
    for px, py, pm, pt in pebbles:
        c.P(px, py, J(pm, pt))
        c.P(px + 1, py, J(pm, max(1, pt - 1)))
    # Surface water sparkles
    for sx, sy in ((5, 5), (6, 5), (11, 8), (12, 8), (3, 12)):
        c.P(sx, sy, J('vending_cool_white', 4))


def _meadow_wildflower(c: Cv) -> None:
    """6. inaka-meadow-wildflower: Lush summer meadow grass with clover and white/yellow wildflowers."""
    for y in range(16):
        for x in range(16):
            h = H(x, y, 89)
            if h < 0.45:
                c.P(x, y, J('pine_bamboo', 2))
            elif h < 0.78:
                c.P(x, y, J('moss', 3))
            elif h < 0.92:
                c.P(x, y, J('pine_bamboo', 3))
            else:
                c.P(x, y, J('moss', 4))
    # Grass blade tufts
    for gx, gy in ((2, 4), (8, 2), (13, 6), (5, 11), (11, 13)):
        c.P(gx, gy, J('pine_bamboo', 1))
        c.P(gx, gy - 1, J('moss', 4))
    # White clover blossoms & yellow summer dandelions
    for wx, wy in ((3, 2), (10, 5), (6, 9), (14, 12)):
        c.P(wx, wy, J('vending_cool_white', 4))
        c.P(wx + 1, wy, J('moss', 4))
    for yx, yy in ((12, 2), (2, 7), (9, 12), (4, 14)):
        c.P(yx, yy, J('lantern_amber', 4))
        c.P(yx, yy + 1, J('lantern_amber', 3))


GROUND: Final[collections.OrderedDict[str, tuple[Callable[[Cv], None], str]]] = collections.OrderedDict((
    ('gnd/inaka-paddy-water', (_paddy_water, 'solidfloor')),
    ('gnd/inaka-paddy-summer', (_paddy_summer, 'solidfloor')),
    ('gnd/inaka-paddy-golden', (_paddy_golden, 'solidfloor')),
    ('gnd/inaka-aze-path', (_aze_path, 'floor')),
    ('gnd/inaka-canal-water', (_canal_water, 'solidfloor')),
    ('gnd/inaka-canal-wall', (_canal_wall, 'solidfloor')),
    ('gnd/inaka-gravel-road', (_gravel_road, 'floor')),
    ('gnd/inaka-river-shallow', (_river_shallow, 'solidfloor')),
    ('gnd/inaka-meadow-wildflower', (_meadow_wildflower, 'floor')),
))

GROUND_GROUPS: Final[tuple[tuple[str, str, list[str], str], ...]] = (
    ('jp:inaka-paddy-water', 'inaka-paddy-water', ['gnd/inaka-paddy-water'], '논(모내기 물논) — 하늘이 비치는 봄·초여름 물논과 줄지어 심은 어린 모. 걸을 수 없으며 사방에 논두렁(inaka-aze-path)을 두른다.'),
    ('jp:inaka-paddy-summer', 'inaka-paddy-summer', ['gnd/inaka-paddy-summer'], '논(푸른 여름 벼) — 한여름 짙푸르게 자란 벼 이랑. 걸을 수 없다.'),
    ('jp:inaka-paddy-golden', 'inaka-paddy-golden', ['gnd/inaka-paddy-golden'], '논(황금 가을 벼) — 추수철 고개 숙인 황금빛 벼 이랑. 하사기(inaka-rice-rack-hasagi)와 짝지어 쓴다.'),
    ('jp:inaka-aze-path', 'inaka-aze-path', ['gnd/inaka-aze-path'], '논두렁·시골 흙길 — 풀섶 가장자리가 자연스러운 다져진 시골 흙길·논두렁. 걸을 수 있는 바닥.'),
    ('jp:inaka-canal-water', 'inaka-canal-water', ['gnd/inaka-canal-water'], '농수로 물(用水路) — 논밭 옆을 시원하게 흐르는 시골 용수로 물길.'),
    ('jp:inaka-canal-wall', 'inaka-canal-wall', ['gnd/inaka-canal-wall'], '농수로 석축·콘크리트 수로벽 — 3/4 윗면 연석과 이끼 낀 수로 벽면·물가 경계.'),
    ('jp:inaka-gravel-road', 'inaka-gravel-road', ['gnd/inaka-gravel-road'], '시골 자갈 신작로 — 햇살에 바랜 비포장 시골 자갈길(바퀴 자국 포함). 걸을 수 있는 주 도로.'),
    ('jp:inaka-river-shallow', 'inaka-river-shallow', ['gnd/inaka-river-shallow'], '시골 맑은 개울 — 강자갈이 투명하게 비치는 얕은 시골 시냇물. 징검다리·붉은 철교 아래에 깐다.'),
    ('jp:inaka-meadow-wildflower', 'inaka-meadow-wildflower', ['gnd/inaka-meadow-wildflower'], '여름 들꽃 풀밭 — 토끼풀과 흰·노란 들꽃이 피어난 시골 여름 풀밭. 기본 대지 바닥.'),
)

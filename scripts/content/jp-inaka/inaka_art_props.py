#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka rural vehicles/props (3/4 top-down) + seamless rural ground tiles
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# --- How to run ---
# python3 scripts/content/jp-inaka/bake_inaka.py
"""jp-inaka 소품·탈것 19종 + 시골 바닥 10종.

탈것은 jp_city parts_vehicles / vehicles/cars.py 관례: 밝은 지붕·보닛·짐칸 윗면(+2/+1) → 접힘선 → 어두운 옆면,
바퀴집은 옆면을 파고 들어간 어두운 반원, 타이어 + 휠캡, 전체 1px sumi 윤곽. 오른쪽(동)을 보고 선다.
바닥은 jp_shopstreet16 잔디/물 칩(chip)과 jp_regions_pack 의 칸 해시 클러스터(H) 관례: 16 주기 이음매 없음,
가로 줄무늬·소용돌이 없음, 대비 낮은 2~3px 덩이만.
"""
from __future__ import annotations

import collections
import math
from typing import Callable, Final


from inaka_art_houses import (  # noqa: E402
    OL, Cv, H, J, K, add_outline, canopy_clusters, disc, kit, line, plinth_34, post, rect_3d, rows, shed, stones,
)


def wheel(c, cx, cy, r=4.5, hub='conc'):
    """바퀴집(옆면을 파낸 어두운 반원) 위에 타이어 + 휠캡(왼쪽 위 1px 빛)."""
    disc(c, cx, cy - 0.5, r + 1.6, K('tekko', -3))
    disc(c, cx, cy, r + 0.6, OL)
    disc(c, cx, cy, r - 0.4, K('sumi', 1))
    disc(c, cx, cy, r * 0.48, K(hub, 1))
    c.P(round(cx - 1), round(cy - 1), K(hub, 3))


def car_shadow(c, x0, x1, y):
    c.HL(x0 + 2, y, x1 - x0 - 3, K('yoru', -1))
    c.HL(x0 + 4, y + 1, x1 - x0 - 7, K('yoru', -1))


# ═══════════════════════════ 탈것 ═══════════════════════════
@kit('inaka-keitora-white', '흰 경트럭(軽トラ) - 캡 지붕 윗면·짐칸 윗면(양 난간·채소 상자·파란 방수포)·노란 번호판(3×2)', 3, 2, 'vehicle',
     solid=rows(3, [0, 1]), tags=['inaka', '경트럭', '軽トラ', '탈것'],
     rules='농가 마당·논두렁 옆 자갈길에 오른쪽(동)을 보고 세운다.', role='prop')
def keitora(c, base):
    car_shadow(c, 3, 46, 29)
    # 짐칸: 먼 난간 윗면 → 짐칸 바닥 → 가까운 난간 윗면 → 옆판
    c.R(3, 8, 27, 2, K('shiro', 2)); c.HL(3, 9, 27, K('shiro', 1))
    c.R(4, 10, 25, 7, K('tekko', -2))
    for x in range(6, 29, 5): c.VL(x, 10, 7, K('tekko', -1))   # 바닥 골
    rect_3d(c, 5, 9, 8, 7, 3, 'aged_cedar', top_t=3, front_t=2)   # 채소 상자(윗면에 양배추)
    c.R(6, 10, 6, 3, K('midori', 1)); c.P(7, 10, K('midori', 2)); c.P(10, 11, K('midori', 2))
    rect_3d(c, 13, 9, 8, 7, 3, 'aged_cedar', top_t=3, front_t=2)
    c.R(14, 10, 6, 3, K('daidai', 1)); c.P(15, 10, K('daidai', 2)); c.P(18, 11, K('daidai', 2))
    c.R(21, 10, 8, 6, K('sora', 0)); c.HL(21, 10, 8, K('sora', 2)); c.HL(22, 11, 6, K('sora', 1)); c.VL(28, 10, 6, K('sora', -1))
    c.HL(3, 16, 27, K('shiro', 2))                              # 가까운 난간 윗면
    c.R(3, 17, 27, 7, K('shiro', 0))
    c.HL(3, 20, 27, K('shiro', -1))
    for x in (12, 21): c.VL(x, 17, 7, K('shiro', -1))
    c.VL(3, 8, 16, K('shiro', 1))
    c.R(3, 18, 1, 3, K('aka', 1))                                # 뒷등
    # 캡 뒷벽(가드 프레임)
    c.R(29, 7, 3, 17, K('shiro', -1)); c.VL(29, 7, 10, K('tekko', 1))
    # 캡: 지붕 윗면 5px → 앞 유리(위에서 본 경사) → 옆면
    c.R(31, 3, 11, 5, K('shiro', 2)); c.HL(31, 3, 11, K('shiro', 2)); c.HL(31, 7, 11, K('shiro', 1))
    for y in range(4, 13):
        x0 = 41 + (y - 4) // 2
        c.R(x0, y, 3, 1, K('garasu', 1 if y < 8 else 0))
    c.P(42, 5, K('garasu', 3))
    c.R(31, 8, 12, 16, K('shiro', 0))
    c.R(32, 9, 8, 6, K('garasu', 0)); c.HL(32, 9, 8, K('garasu', -1))
    line(c, 33, 13, 36, 10, K('garasu', 2))
    c.VL(40, 9, 14, K('shiro', -1)); c.HL(37, 16, 2, K('tekko', 0))   # 문 이음 + 손잡이
    c.R(43, 13, 3, 11, K('shiro', -1)); c.VL(45, 14, 9, K('shiro', -2))  # 차 앞면
    c.R(44, 15, 2, 2, K('kii', 2))                               # 전조등
    c.R(42, 21, 4, 2, K('kii', 1)); c.HL(42, 21, 4, K('kii', 2))  # 노란 경차 번호판
    c.HL(31, 23, 15, K('conc', 0))                               # 범퍼·사이드 스커트
    c.HL(3, 24, 43, K('tekko', -2))
    wheel(c, 10, 25); wheel(c, 37, 25)
    add_outline(c)


@kit('inaka-red-tractor', '빨간 트랙터 - 보닛 윗면·배기통·핸들·롤바 지붕·큰 뒷바퀴 펜더 윗면·로터리(3×2)', 3, 2, 'vehicle',
     solid=rows(3, [0, 1]), tags=['inaka', '트랙터', 'トラクター', '농기계'],
     rules='논 가장자리·헛간 앞. 오른쪽(동)을 보고 둔다.', role='prop')
def tractor(c, base):
    car_shadow(c, 1, 46, 29)
    # 로터리(뒤쪽 경운기): 덮개 윗면 + 앞면 + 칼날
    c.R(1, 15, 9, 3, K('daidai', 1)); c.HL(1, 15, 9, K('daidai', 2))
    c.R(1, 18, 9, 7, K('daidai', -1)); c.HL(1, 24, 9, K('daidai', -2))
    for x in (2, 5, 8): c.R(x, 25, 1, 3, K('conc', 2))
    # 롤바 + 지붕(윗면)
    c.R(12, 3, 2, 14, K('tekko', 0)); c.R(23, 3, 2, 10, K('tekko', 0))
    c.R(10, 1, 17, 3, K('tekko', 2)); c.HL(10, 1, 17, K('tekko', 3)); c.HL(10, 4, 17, K('tekko', -1))
    # 좌석 + 핸들
    c.R(14, 10, 6, 2, K('sumi', 2)); c.R(14, 12, 2, 4, K('sumi', 1))
    line(c, 21, 15, 24, 9, K('tekko', -1))
    c.R(22, 8, 5, 2, K('sumi', 1)); c.HL(22, 8, 5, K('tekko', 2))
    # 보닛: 윗면(밝은 빨강) + 옆면 + 그릴
    c.R(25, 11, 19, 5, K('aka', 2)); c.HL(25, 11, 19, K('aka', 2)); c.HL(25, 15, 19, K('aka', 1))
    for x in range(28, 42, 4): c.P(x, 13, K('aka', 1))
    c.R(25, 16, 19, 7, K('aka', 0))
    for y in (18, 20): c.HL(29, y, 11, K('aka', -1))
    c.R(44, 12, 2, 11, K('tekko', 0)); c.VL(45, 13, 9, K('tekko', -1)); c.P(44, 14, K('kii', 2))
    # 배기통
    c.R(36, 4, 2, 7, K('tekko', -1)); c.VL(36, 4, 7, K('tekko', 1)); c.R(35, 3, 4, 2, K('tekko', 0))
    # 큰 뒷바퀴 + 펜더(둥근 윗면)
    disc(c, 17, 22, 8.2, OL); disc(c, 17, 22, 7.3, K('sumi', 1))
    for k in range(12):
        a = k * math.pi / 6
        c.P(round(17 + math.cos(a) * 6.6), round(22 + math.sin(a) * 6.6), K('tekko', -1))
    disc(c, 17, 22, 3.6, K('kii', 0)); disc(c, 17, 22, 1.6, K('kii', -2)); c.P(16, 21, K('kii', 2))
    for x in range(8, 27):
        u = (x - 17) / 9.5
        yt = round(13 - 3 * math.sqrt(max(0.0, 1 - u * u)))
        c.P(x, yt, K('aka', 2)); c.P(x, yt + 1, K('aka', 2 if x < 17 else 1)); c.P(x, yt + 2, K('aka', 0))
    # 앞바퀴
    wheel(c, 38, 25, 4.2, 'kii')
    add_outline(c)


@kit('inaka-bicycle-parked', '세워 둔 엄마 자전거(ママチャリ) - 앞 바구니 윗면·안장 윗면·짐받이(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '자전거', 'ママチャリ'],
     rules='가게 앞·역 앞·집 처마 밑에 오른쪽을 보고 세운다.', role='prop')
def bicycle(c, base):
    c.HL(3, 29, 26, K('yoru', -1))
    for cx in (8, 24):                                           # 바퀴(살 + 타이어)
        disc(c, cx, 22, 6.6, OL); disc(c, cx, 22, 5.8, K('sumi', 1)); disc(c, cx, 22, 4.8, K('conc', -2))
        for k in range(6):
            a = k * math.pi / 3
            line(c, cx, 22, round(cx + math.cos(a) * 4.4), round(22 + math.sin(a) * 4.4), K('conc', 2))
        disc(c, cx, 22, 1.2, K('conc', 3))
    fr = K('sora', 1)
    line(c, 8, 22, 15, 22, fr); line(c, 15, 22, 21, 13, fr); line(c, 12, 13, 15, 22, fr)
    line(c, 12, 14, 21, 14, fr); line(c, 21, 13, 24, 22, fr); line(c, 8, 22, 12, 14, fr)
    c.R(14, 21, 3, 3, K('tekko', 0))                             # 체인 기어
    # 짐받이(윗면) + 흙받이
    c.R(3, 14, 9, 2, K('tekko', 2)); c.HL(3, 14, 9, K('tekko', 3)); line(c, 4, 16, 7, 21, K('tekko', 1))
    # 안장(윗면)
    c.R(9, 10, 6, 2, K('sumi', 2)); c.HL(10, 10, 4, K('tekko', 1)); c.VL(12, 12, 2, K('tekko', 1))
    # 핸들 + 앞 바구니(윗면 입구가 보이는 철망 상자)
    c.VL(21, 8, 6, K('tekko', 1)); c.HL(18, 8, 6, K('tekko', 2)); c.P(17, 8, K('sumi', 2))
    c.R(23, 7, 8, 3, K('tekko', -2)); c.HL(23, 7, 8, K('conc', 3)); c.HL(24, 8, 6, K('kokuban', -1))
    c.R(23, 10, 8, 5, K('conc', 1))
    for x in range(24, 31, 2): c.VL(x, 10, 5, K('conc', -1))
    c.HL(23, 12, 8, K('conc', -1))
    c.P(25, 8, K('midori', 1)); c.P(26, 8, K('midori', 2))      # 바구니 속 파
    add_outline(c)


# ═══════════════════════════ 전봇대·거리 소품 ═══════════════════════════
@kit('inaka-wooden-pole-transformer', '나무 전봇대와 변압기 - 완목 윗면·애자·원통 변압기·발판 볼트(1×3)', 1, 3, 'column',
     solid=[(0, 2)], tags=['inaka', '전봇대', '電柱', '변압기'],
     rules='시골길 가장자리에 6~8칸 간격. 길 쪽 칸만 막힌다.', role='prop')
def wooden_pole(c, base):
    post(c, 6, 4, 42, 'aged_cedar', 2, 3)
    c.R(5, 44, 5, 2, K('yoru', -1))
    c.R(6, 36, 3, 6, K('kii', 1))                                # 노랑·검정 표지 커버
    for y in range(36, 42, 2): c.HL(6, y, 3, K('sumi', 1))
    for y in range(14, 34, 5): c.P(9, y, K('tekko', 2))          # 발판 볼트
    rect_3d(c, 1, 5, 14, 4, 2, 'machiya_timber', top_t=3, front_t=1)   # 완목(윗면)
    for x in (2, 12):
        c.R(x, 2, 2, 3, K('shiro', 2)); c.P(x, 2, K('shiro', 1))       # 애자
    # 원통 변압기: 둥근 윗면 + 몸통
    c.R(3, 14, 10, 12, K('conc', 1)); c.VL(3, 14, 12, K('conc', 3)); c.VL(12, 14, 12, K('conc', -1))
    disc(c, 7.5, 14, 4.5, K('conc', 3), ry=1.6); c.HL(5, 13, 5, K('conc', 3))
    c.HL(3, 19, 10, K('conc', -1)); c.HL(3, 25, 10, K('conc', -2))
    add_outline(c)


@kit('inaka-roadside-mirror', '커브 볼록거울(カーブミラー) - 주황 기둥·둥근 거울·거울 위 차양(1×2)', 1, 2, 'column',
     solid=[(0, 1)], tags=['inaka', '커브거울', 'カーブミラー'],
     rules='시골 굽은길·교차로 모서리.', role='prop')
def roadside_mirror(c, base):
    c.R(7, 12, 2, 18, K('daidai', 1)); c.VL(7, 12, 18, K('daidai', 2))
    c.R(5, 29, 6, 2, K('conc', 0)); c.HL(5, 29, 6, K('conc', 2))
    disc(c, 8, 7, 6.2, K('daidai', 0)); disc(c, 8, 7, 5.0, K('garasu', 0))
    disc(c, 7, 6, 3.2, K('garasu', 1)); c.P(6, 4, K('garasu', 3)); c.P(5, 5, K('garasu', 3))
    c.HL(4, 1, 8, K('daidai', 2))                                # 차양 윗면
    c.R(8, 13, 1, 3, K('sumi', 1))
    add_outline(c)


@kit('inaka-retro-postbox-vending', '둥근 우체통과 자판기 - 둥근 지붕 우체통·자판기 윗면·음료 진열(2×2)', 2, 2, 'structure',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우체통', '자판기', '丸ポスト'],
     rules='가게·버스 정류장 옆 길가.', role='prop')
def postbox_vending(c, base):
    # 둥근 우체통(丸ポスト): 둥근 지붕 윗면 + 원통 몸 + 투입구
    c.R(2, 9, 10, 18, K('aka', 0)); c.VL(2, 9, 18, K('aka', 1)); c.VL(3, 9, 18, K('aka', 1)); c.VL(11, 9, 18, K('aka', -1))
    disc(c, 6.5, 8, 5.4, K('aka', 1), ry=3.2); disc(c, 5.5, 7, 2.6, K('aka', 2), ry=1.4)
    c.HL(2, 11, 10, K('aka', -1))
    c.R(4, 14, 6, 2, K('sumi', 1)); c.HL(4, 16, 6, K('aka', 2))
    c.R(5, 19, 4, 3, K('shiro', 2)); c.HL(5, 20, 4, K('aka', 0))
    c.R(1, 27, 12, 3, K('conc', 0)); c.HL(1, 27, 12, K('conc', 2))
    # 자판기(윗면 3px + 앞면)
    rect_3d(c, 14, 3, 17, 27, 3, 'vending_cool_white', top_t=4, front_t=3)
    c.R(16, 7, 13, 9, K('garasu', -1))
    for k, col in enumerate(('aka', 'sora', 'kii', 'midori', 'daidai', 'aka')):
        x = 17 + (k % 3) * 4; y = 8 + (k // 3) * 4
        c.R(x, y, 2, 3, K(col, 1)); c.P(x, y, K(col, 2))
    c.R(16, 17, 13, 2, K('sora', 1))
    c.R(17, 21, 3, 2, K('tekko', -1)); c.R(24, 24, 5, 3, K('tekko', -2))
    add_outline(c)


@kit('inaka-unmanned-veg-stand', '무인 채소 판매대(無人販売所) - 片流れ 지붕 윗면·바구니 채소·요금 통(2×2)', 2, 2, 'structure',
     solid=[(0, 1), (1, 1)], tags=['inaka', '무인판매', '野菜', '채소'],
     rules='밭 옆 길가. 앞 1칸에서 산다.', role='prop')
def veg_stand(c, base):
    post(c, 3, 10, 18, 'aged_cedar', 2); post(c, 27, 10, 18, 'aged_cedar', 1)
    c.R(4, 12, 24, 10, J('aged_cedar', 1))                        # 뒷판
    for x in range(4, 28, 4): c.VL(x, 12, 10, J('aged_cedar', 0))
    c.R(19, 13, 7, 5, K('shiro', 2)); c.HL(20, 15, 5, K('sumi', 1))    # 「100円」 종이
    rect_3d(c, 2, 20, 28, 9, 4, 'aged_cedar', top_t=4, front_t=2)   # 진열대 윗면
    for (x, col, t) in ((4, 'aka', 1), (11, 'midori', 0), (18, 'murasaki', 0)):
        c.R(x, 18, 6, 4, J('tatami_straw', 3)); c.HL(x, 18, 6, J('tatami_straw', 4))   # 바구니
        c.R(x + 1, 17, 4, 2, K(col, t)); c.P(x + 1, 17, K(col, t + 1))
    c.R(25, 21, 4, 3, K('tekko', 0)); c.HL(26, 21, 2, K('sumi', 1))    # 요금 통
    shed(c, 0, 31, 3, 10, 'tekko', 0)
    add_outline(c)


@kit('inaka-well-handpump', '우물과 작두 펌프 - 돌 우물 테 윗면(검은 물)·초록 펌프·양동이(2×2)', 2, 2, 'water',
     solid=[(0, 1), (1, 1)], tags=['inaka', '우물', '井戸', '펌프'],
     rules='농가 마당 한쪽.', role='water')
def well_pump(c, base):
    # 돌 우물: 둥근 테 윗면(링) + 안의 검은 물 + 앞면 돌
    c.R(1, 15, 17, 12, J('shrine_flagstone', 2))
    for x in range(1, 18, 5): c.VL(x, 16, 11, J('shrine_flagstone', 0))
    c.HL(1, 21, 17, J('shrine_flagstone', 0)); c.HL(1, 26, 17, J('shrine_flagstone', 0))
    disc(c, 9.5, 15, 8.4, J('shrine_flagstone', 3), ry=4.4)
    disc(c, 9.5, 15, 6.2, K('sumi', 1), ry=2.8); disc(c, 9.5, 15.5, 4.6, K('kon', -1), ry=1.8)
    c.HL(4, 11, 10, J('shrine_flagstone', 4))
    # 우물 덮개 판(반쯤 덮음, 윗면)
    c.R(2, 12, 7, 4, J('aged_cedar', 3)); c.HL(2, 12, 7, J('aged_cedar', 4)); c.VL(5, 12, 4, J('aged_cedar', 1))
    # 콘크리트 받침 + 초록 작두 펌프
    rect_3d(c, 18, 23, 13, 7, 3, 'concrete_grey', top_t=3, front_t=2)
    c.R(22, 8, 4, 15, K('midori', 0)); c.VL(22, 8, 15, K('midori', 1)); c.VL(25, 8, 15, K('midori', -1))
    c.R(21, 6, 6, 3, K('midori', 1)); c.HL(21, 6, 6, K('midori', 2))
    line(c, 26, 7, 30, 4, K('tekko', 1)); line(c, 26, 8, 30, 5, K('tekko', -1))   # 손잡이
    c.R(18, 14, 4, 2, K('midori', 0))                            # 토수구
    c.R(18, 19, 5, 5, K('sora', 0)); c.HL(18, 19, 5, K('sora', 2)); c.HL(19, 20, 3, K('kon', 0))   # 양동이
    add_outline(c)


@kit('inaka-fire-watchtower', '소방 망루(火の見櫓) - 철골 네 다리·사다리·전망대 윗면·뾰족 지붕·半鐘(2×4)', 2, 4, 'structure',
     solid=[(0, 3), (1, 3)], tags=['inaka', '망루', '火の見櫓', '소방'],
     rules='마을 갈림길·소방 창고 옆. 아래 두 칸만 막힌다.', role='building')
def watchtower(c, base):
    lg = K('aka', -1); lg2 = K('aka', -2)
    # 뒤 다리(오른쪽 위로 비킨 깊이) 먼저, 앞 다리 나중
    line(c, 12, 24, 6, 59, lg2); line(c, 21, 24, 27, 59, lg2)
    line(c, 10, 26, 3, 61, lg); line(c, 19, 26, 25, 61, lg)
    for y0 in (28, 38, 48):                                      # X 가새
        f0 = (y0 - 26) / 35; f1 = (y0 + 10 - 26) / 35
        xl0, xr0 = 10 - 7 * f0, 19 + 6 * f0
        xl1, xr1 = 10 - 7 * f1, 19 + 6 * f1
        line(c, round(xl0), y0, round(xr1), y0 + 10, K('aka', 0))
        line(c, round(xr0), y0, round(xl1), y0 + 10, K('aka', 0))
        c.HL(round(xl0), y0, round(xr0 - xl0) + 1, K('aka', 1))
    for y in range(28, 60, 3): c.HL(14, y, 3, K('tekko', 2))      # 사다리 발판
    c.VL(13, 27, 33, K('tekko', 0)); c.VL(17, 27, 33, K('tekko', 0))
    for x in (2, 24): c.R(x, 60, 5, 3, K('conc', 1)); c.HL(x, 60, 5, K('conc', 3))
    # 전망대(난간 + 바닥 윗면)
    rect_3d(c, 3, 19, 26, 8, 4, 'machiya_timber', top_t=3, front_t=1)
    for x in range(4, 28, 4): c.VL(x, 14, 6, K('aka', 0))
    c.HL(3, 14, 26, K('aka', 1))
    # 半鐘
    c.R(14, 13, 4, 5, J('lantern_amber', 1)); c.HL(14, 13, 4, J('lantern_amber', 3)); c.P(15, 18, J('lantern_amber', 0))
    # 뾰족 지붕(四角錐: 왼 면 밝음, 오른 면 어두움, 앞 처마)
    for y in range(2, 12):
        hw = (y - 2) * 1.4 + 1
        for x in range(round(16 - hw), round(16 + hw) + 1):
            c.P(x, y, K('tekko', 1 if x < 16 else -1) if y < 10 else K('tekko', 0))
    c.HL(1, 11, 30, K('tekko', 2)); c.VL(16, 1, 3, K('aka', 1))
    add_outline(c)


# ═══════════════════════════ 논·밭 소품 ═══════════════════════════
def straw_bundle(c, x, y, h=9):
    """매달린 볏단: 위 묶음 → 아래로 퍼지는 이삭(왼쪽 밝게)."""
    for k in range(h):
        hw = 1 + k * 3 // h
        for dx in range(-hw, hw + 1):
            t = 4 if dx < 0 else 2 if dx > 0 else 3
            if k > h - 3: t -= 1
            c.P(x + dx, y + k, J('tatami_straw', t))
    c.HL(x - 1, y + 2, 3, J('aged_cedar', 2))


@kit('inaka-rice-rack-hasagi', '볏단 걸이(はさ掛け) - 장대 윗면·가로대·매달린 볏단 두 단(3×2)', 3, 2, 'structure',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '하사기', 'はさ掛け', '볏단'],
     rules='가을 황금 논(inaka-paddy-golden) 논두렁 위.', role='prop')
def hasagi(c, base):
    c.HL(2, 30, 44, K('yoru', -1))
    for x in (3, 23, 43):                                         # 장대(X 받침)
        line(c, x - 2, 30, x + 1, 5, J('aged_cedar', 2)); line(c, x + 2, 30, x - 1, 5, J('aged_cedar', 1))
    for y in (7, 16):
        c.HL(1, y, 46, J('aged_cedar', 3)); c.HL(1, y + 1, 46, J('aged_cedar', 1))
    for y0 in (8, 17):
        for x in range(4, 45, 4):
            straw_bundle(c, x, y0, 9)
    add_outline(c)


def scarecrow(c, x, y, robe='noren_indigo', hat=True):
    line(c, x, y + 5, x, y + 26, J('aged_cedar', 1))
    c.HL(x - 7, y + 10, 15, J('aged_cedar', 2)); c.HL(x - 7, y + 11, 15, J('aged_cedar', 1))
    c.R(x - 4, y + 10, 9, 9, J(robe, 2)); c.VL(x - 4, y + 10, 9, J(robe, 3)); c.VL(x + 4, y + 10, 9, J(robe, 1))
    c.HL(x - 4, y + 14, 9, J('torii_vermilion', 2))               # 허리띠
    c.R(x - 7, y + 10, 3, 3, J(robe, 2)); c.R(x + 5, y + 10, 3, 3, J(robe, 1))
    disc(c, x, y + 6, 3.2, K('shiro', 1)); c.P(x - 1, y + 6, K('sumi', 1)); c.P(x + 1, y + 6, K('sumi', 1))
    if hat:                                                      # 삿갓(윗면 원뿔)
        for k in range(4):
            c.HL(x - 1 - k * 2, y + 1 + k, 3 + k * 4, J('tatami_straw', 4 if k < 2 else 3))
        c.HL(x - 7, y + 5, 15, J('tatami_straw', 1))


@kit('inaka-scarecrow-pair', '허수아비 한 쌍(案山子) - 삿갓 윗면·팔 막대·쪽빛/주홍 옷(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '허수아비', 'かかし'],
     rules='논 한가운데·논두렁.', role='prop')
def scarecrows(c, base):
    scarecrow(c, 8, 1, 'noren_indigo'); scarecrow(c, 23, 3, 'torii_vermilion')
    add_outline(c)
    c.HL(5, 30, 6, K('yoru', -1)); c.HL(20, 30, 6, K('yoru', -1))


@kit('inaka-sunflower-patch', '해바라기 밭 한 덩이 - 남쪽을 보는 꽃 머리·큰 잎(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '해바라기', 'ひまわり', '여름'],
     rules='밭·마당 가장자리에 2~6개 이어 붙인다.', role='prop')
def sunflowers(c, base):
    canopy_clusters(c, [(7, 24, 7, 5), (19, 25, 8, 5), (32, 24, 8, 5), (42, 25, 5, 4)], 'moss')
    for (x, y) in ((6, 4), (17, 9), (27, 3), (38, 8), (12, 15), (33, 15), (44, 14)):
        line(c, x, y + 4, x + 1, y + 16, J('pine_bamboo', 2))
        disc(c, x, y, 4.6, OL); disc(c, x, y, 3.8, K('kii', 1)); disc(c, x - 0.7, y - 0.7, 2.4, K('kii', 2))
        disc(c, x + 0.3, y + 0.4, 1.8, J('aged_cedar', 0)); c.P(x, y, J('aged_cedar', 2))


@kit('inaka-hydrangea-hedge', '수국 꽃덤불(紫陽花) - 잎 덩이 위 파랑·보라 꽃송이·낮은 돌 테(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '수국', '紫陽花', '생울타리'],
     rules='집·절 담장 앞, 돌담 위에 이어 붙인다.', role='prop')
def hydrangea(c, base):
    plinth_34(c, 1, 23, 46, 9, top_h=3, mat='shrine_flagstone')
    canopy_clusters(c, [(8, 14, 8, 7), (22, 12, 9, 8), (37, 14, 9, 7)], 'moss')
    for k, (x, y) in enumerate(((5, 9), (12, 13), (19, 7), (26, 12), (33, 8), (40, 13), (8, 18), (30, 17), (43, 9))):
        col = ('sora', 'murasaki', 'pinku')[k % 3]
        disc(c, x, y, 2.6, K(col, 0)); disc(c, x - 0.5, y - 0.5, 1.6, K(col, 1)); c.P(x - 1, y - 1, K(col, 2))


@kit('inaka-jizo-shrine-row', '길가 지장보살 세 분 사당 - 片流れ 나무 지붕 윗면·붉은 턱받이·돌 기단(3×2)', 3, 2, 'structure',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '지장', '地蔵', '사당'],
     rules='마을 갈림길·다리 옆. 앞 1칸 비운다.', role='prop')
def jizo_row(c, base):
    post(c, 3, 9, 18, 'aged_cedar', 2); post(c, 43, 9, 18, 'aged_cedar', 1)
    c.R(5, 10, 38, 14, J('aged_cedar', 0))
    plinth_34(c, 1, 22, 46, 9, top_h=3, mat='shrine_flagstone')
    for x in (12, 24, 36):                                       # 지장(둥근 머리 + 몸 + 붉은 턱받이)
        c.R(x - 4, 15, 9, 9, J('shrine_flagstone', 2)); c.VL(x - 4, 15, 9, J('shrine_flagstone', 3)); c.VL(x + 4, 15, 9, J('shrine_flagstone', 1))
        disc(c, x, 12, 3.4, J('shrine_flagstone', 3)); c.P(x - 1, 11, J('shrine_flagstone', 4))
        c.HL(x - 1, 13, 3, J('shrine_flagstone', 1))
        c.R(x - 4, 16, 9, 4, J('torii_vermilion', 2)); c.HL(x - 4, 16, 9, J('torii_vermilion', 3)); c.P(x, 19, J('torii_vermilion', 1))
    for x in (17, 30): c.R(x, 23, 2, 2, K('kii', 1))              # 공양 꽃
    shed(c, 0, 47, 0, 9, 'tekko', -1)
    add_outline(c)


# ═══════════════════════════ 물·담·다리 ═══════════════════════════
@kit('inaka-sluice-gate', '농수로 수문(水門) - 콘크리트 기둥 윗면·철 수문판·핸들 다리 윗면(2×2)', 2, 2, 'structure',
     solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['inaka', '수문', '水門', '농수로'],
     rules='농수로(inaka-canal-water) 위에 가로질러 놓는다.', role='water')
def sluice(c, base):
    rect_3d(c, 1, 6, 7, 24, 3, 'concrete_grey', top_t=3, front_t=2)
    rect_3d(c, 24, 6, 7, 24, 3, 'concrete_grey', top_t=3, front_t=1)
    c.R(8, 12, 16, 14, K('tekko', -1))                            # 철 수문판
    for y in range(13, 26, 3): c.HL(8, y, 16, K('tekko', 0))
    c.VL(8, 12, 14, K('tekko', 1))
    c.R(8, 26, 16, 4, K('sora', 0)); c.HL(8, 26, 16, K('shiro', 2)); c.HL(10, 28, 5, K('sora', 2))
    rect_3d(c, 0, 4, 32, 7, 3, 'machiya_timber', top_t=3, front_t=1)   # 다리판(윗면)
    c.R(14, 0, 4, 5, K('tekko', 0)); disc(c, 16, 1, 3.4, K('aka', 0), ry=1.4); c.P(14, 0, K('aka', 2))   # 핸들
    add_outline(c)


@kit('inaka-bamboo-fence-gate', '대나무 울타리와 문(四つ目垣) - 기둥 갓 윗면·대나무 가로대·작은 기와 문(4×2)', 4, 2, 'structure',
     solid=[(0, 1), (1, 1), (3, 1)], tags=['inaka', '대나무울타리', '竹垣', '문'],
     rules='농가 마당 경계. 세 번째 칸이 드나드는 문.', role='fence')
def bamboo_fence(c, base):
    bam = 'pine_bamboo'
    for x in list(range(2, 32, 4)) + [62]:                       # 세로 대
        c.R(x, 12, 2, 18, J(bam, 2)); c.P(x, 12, J(bam, 4)); c.VL(x + 1, 13, 17, J(bam, 1))
        c.HL(x, 20, 2, J(bam, 1))
    for y in (15, 22, 27):                                       # 가로대 + 매듭
        c.HL(0, y, 34, J(bam, 3)); c.HL(0, y + 1, 34, J(bam, 1))
        c.HL(56, y, 8, J(bam, 3)); c.HL(56, y + 1, 8, J(bam, 1))
        for x in range(3, 32, 4): c.P(x, y, J('aged_cedar', 1))
    for x in (33, 54):                                           # 문 기둥 + 갓(윗면)
        post(c, x, 6, 25, 'aged_cedar', 2, 3)
        rect_3d(c, x - 2, 3, 7, 4, 2, 'kawara_dark_tile', top_t=3, front_t=1)
    rect_3d(c, 31, 1, 28, 5, 2, 'kawara_dark_tile', top_t=3, front_t=1)   # 문 위 작은 기와 지붕
    c.HL(36, 10, 18, J('aged_cedar', 2)); c.HL(36, 11, 18, J('aged_cedar', 0))
    add_outline(c)


@kit('inaka-mossy-stone-wall', '이끼 낀 돌담 - 이끼 덮인 윗길·돌 쌓기 정면(4×2)', 4, 2, 'wall',
     solid=rows(4, [0, 1]), tags=['inaka', '돌담', '石垣', '이끼'],
     rules='경사 밭·집터 경계를 가로로 이어 쌓는다.', role='wall')
def stone_wall(c, base):
    c.R(0, 4, 64, 27, OL)
    for x in range(1, 63):                                       # 윗길: 이끼 2~3단 클러스터
        for y in range(5, 11):
            h = H(x // 3, y // 2, 11)
            c.P(x, y, J('moss', 3 if h < 0.5 else 4 if h < 0.7 else 2))
        c.P(x, 10, J('moss', 1))
    stones(c, 1, 11, 62, 19, 'shrine_flagstone', seed=5, course=(5, 7), width=(8, 13), moss=0.18)
    for (x, y) in ((6, 3), (20, 2), (41, 3), (55, 2)):          # 윗길 풀포기
        c.P(x, y + 1, J('pine_bamboo', 3)); c.P(x + 1, y, J('pine_bamboo', 4)); c.P(x + 2, y + 1, J('pine_bamboo', 3))
        c.P(x, y, OL); c.P(x + 2, y, OL); c.P(x + 1, y - 1, OL)


@kit('inaka-red-iron-bridge', '붉은 철교(人道橋) - 먼 난간·판재 다리 바닥 윗면·가까운 난간 갓 윗면·거더(6×3)', 6, 3, 'structure',
     solid=rows(6, [0]), other='floor', tags=['inaka', '철교', '다리', '橋'],
     rules='개울·수로 위에 가로로. 가운데 줄(바닥 판재)을 건넌다.', role='terrain')
def iron_bridge(c, base):
    W = 96
    # 먼 난간(북): 갓 윗면 2px + 세로 살
    c.R(0, 6, W, 3, OL); c.HL(1, 7, W - 2, K('aka', 2)); c.HL(1, 8, W - 2, K('aka', 0))
    for x in range(3, W - 2, 6): c.R(x, 9, 2, 7, K('aka', -1))
    c.HL(1, 13, W - 2, K('aka', -1))
    # 다리 바닥(윗면 판재: 세로 줄눈 + 판 끝 엇갈림)
    c.R(0, 16, W, 22, J('aged_cedar', 3))
    for x in range(0, W, 4): c.VL(x, 16, 22, J('aged_cedar', 2))
    for x in range(0, W, 8): c.P(x + 1, 16 + (x * 5) % 19, J('aged_cedar', 1))
    c.HL(0, 16, W, J('aged_cedar', 1))
    # 가까운 난간(남): 기둥 + 갓 윗면 + 가로대
    for x in range(1, W, 16):
        c.R(x, 30, 3, 10, K('aka', 1)); c.VL(x, 30, 10, K('aka', 2)); c.VL(x + 2, 30, 10, K('aka', -1))
    c.HL(0, 29, W, OL); c.HL(0, 30, W, K('aka', 2)); c.HL(0, 31, W, K('aka', 1)); c.HL(0, 32, W, OL)
    c.HL(0, 36, W, K('aka', 0))
    # 거더(앞면, 리벳)
    c.R(0, 39, W, 7, K('aka', -1)); c.HL(0, 39, W, K('aka', 1)); c.HL(0, 45, W, K('aka', -2))
    for x in range(3, W, 6): c.P(x, 42, K('aka', 1))
    c.HL(0, 46, W, OL)
    c.HL(0, 47, W, K('kon', -1))                                  # 물에 진 그늘


@kit('inaka-stepping-stones', '개울 징검다리(飛び石) - 윗면 밝은 납작 돌·물에 잠긴 옆면(4×2)', 4, 2, 'terrain',
     solid=[], other='floor', tags=['inaka', '징검다리', '飛び石'],
     rules='얕은 개울(inaka-river-shallow) 위에 깔아 건넌다.', role='terrain')
def stepping(c, base):
    for k, (x, y, rx, ry) in enumerate(((7, 9, 6, 3.6), (22, 18, 6.5, 3.8), (38, 10, 6, 3.4), (54, 19, 6.5, 3.8), (28, 4, 4, 2.4))):
        disc(c, x + 0.5, y + 2.6, rx + 0.4, K('kon', -1), ry=ry)   # 물 그늘
        disc(c, x, y + 1.6, rx + 0.8, OL, ry=ry + 0.9)
        disc(c, x, y + 1.4, rx, J('shrine_flagstone', 1), ry=ry)   # 옆면
        disc(c, x, y, rx, J('shrine_flagstone', 3), ry=ry - 0.6)   # 윗면
        disc(c, x - rx * 0.3, y - ry * 0.3, rx * 0.45, J('shrine_flagstone', 4), ry=ry * 0.3)
        c.HL(round(x - rx) + 1, round(y + ry) + 2, round(rx * 2) - 1, K('shiro', 2))   # 물살


# ═══════════════════════════ 바닥(16×16, 이음매 없는 16 주기) ═══════════════════════════
def _chip(name):
    from lib_blocks.ground_autotile import chip
    return chip(name)


def _put(c, a):
    for y in range(16):
        for x in range(16):
            r, g, b = (int(v) for v in a[y, x, :3])
            c.P(x, y, (r << 16) | (g << 8) | b)


def Hw(x, y, s):
    """16 주기로 감기는 칸 해시(이음매가 생기지 않게)."""
    return H(x % 16, y % 16, s)


def _cluster(c, mat, levels, seed, cell=2):
    """2px 덩이 단위 3단 클러스터 바탕(노이즈 점 대신)."""
    for y in range(16):
        for x in range(16):
            h = Hw(x // cell + (y // cell) * 3, y // cell, seed)
            t = levels[0] if h < 0.55 else levels[1] if h < 0.85 else levels[2]
            c.P(x, y, J(mat, t))


def _meadow(c):
    """여름 풀밭: jp_city 잔디 칩 + 토끼풀 흰 꽃 두 송이."""
    _put(c, _chip('lawn'))
    for (x, y) in ((4, 5), (12, 12)):
        c.P(x, y, K('shiro', 2)); c.P(x + 1, y, K('shiro', 1)); c.P(x, y + 1, K('midori', -2))
    c.P(13, 3, K('kii', 2))


def _gravel_road(c):
    """시골 흙자갈길: 다진 흙 2px 덩이 + 왼쪽 위 빛 받은 자갈(밝은 1 + 그늘 1)."""
    _cluster(c, 'aged_cedar', (4, 3, 4), 51)
    for (x, y) in ((2, 3), (9, 1), (13, 7), (5, 10), (11, 13), (1, 14), (7, 6)):
        c.P(x, y, J('shrine_flagstone', 4)); c.P((x + 1) % 16, y, J('shrine_flagstone', 3)); c.P((x + 1) % 16, (y + 1) % 16, J('aged_cedar', 1))


def _aze_path(c):
    """논두렁·마당 흙: 산길 흙(rg trail) 톤 + 가장자리 없이 듬성 풀포기(위 밝은 잎 · 아래 그늘)."""
    _cluster(c, 'aged_cedar', (3, 2, 2), 23)
    for (x, y) in ((3, 4), (12, 11)):
        c.P(x, y, J('moss', 4)); c.P(x - 1, y + 1, J('moss', 3)); c.P(x + 1, y + 1, J('moss', 3)); c.P(x, y + 2, J('moss', 1))
    c.P(9, 2, J('shrine_flagstone', 4)); c.P(10, 3, J('aged_cedar', 0))


def _water_base(c, mat, base_t, seed):
    for y in range(16):
        for x in range(16):
            t = base_t
            d = (x + y * 2) % 16                                  # 엷은 사선 물비늘(두 줄, 짧게)
            if d in (0, 1) and Hw(x // 4, y // 4, seed) < 0.6: t = base_t + 1
            c.P(x, y, J(mat, t))


def _rice_tuft(c, x, y, mat, lv=(4, 3, 2, 1)):
    """뿌리 내린 벼 포기 3×3: 위 가운데 밝은 잎끝 → 양옆 잎 → 밑동 그늘(물에 비친 짙은 점)."""
    hi, mid, lo, dk = lv
    c.P(x % 16, y % 16, J(mat, hi))
    c.P((x - 1) % 16, (y + 1) % 16, J(mat, mid)); c.P(x % 16, (y + 1) % 16, J(mat, mid)); c.P((x + 1) % 16, (y + 1) % 16, J(mat, lo))
    c.P(x % 16, (y + 2) % 16, J(mat, dk))


def _paddy_water(c):
    """모내기 물논: 하늘 비친 물 + 엇갈려 심은 어린 모 포기(가로 줄무늬 없음)."""
    _water_base(c, 'onsen_mineral_teal', 2, 3)
    for k, (x, y) in enumerate(((2, 1), (10, 3), (6, 8), (14, 10), (2, 13), (10, 14))):
        c.P(x, y, J('pine_bamboo', 4)); c.P(x - 1, y + 1, J('pine_bamboo', 3)); c.P(x + 1, y + 1, J('moss', 3))
        c.P(x, y + 2, J('onsen_mineral_teal', 0))
    c.P(13, 6, J('vending_cool_white', 4))


def _paddy_dense(c, mat, ground, lv, seed):
    for y in range(16):
        for x in range(16):
            c.P(x, y, J(ground[0], ground[1] if Hw(x // 2, y // 2, seed) < 0.7 else ground[1] - 1))
    for (x, y) in ((1, 0), (5, 1), (9, 0), (13, 1), (3, 4), (7, 5), (11, 4), (15, 5),
                   (1, 8), (5, 9), (9, 8), (13, 9), (3, 12), (7, 13), (11, 12), (15, 13)):
        _rice_tuft(c, x, y, mat, lv)


def _paddy_summer(c):
    """여름 푸른 논: 짙은 물 바닥 위에 빽빽하게 엇갈린 벼 포기."""
    _paddy_dense(c, 'pine_bamboo', ('onsen_mineral_teal', 1), (4, 3, 2, 1), 7)


def _paddy_golden(c):
    """가을 황금 논: 마른 논흙 위 고개 숙인 이삭 포기."""
    _paddy_dense(c, 'tatami_straw', ('aged_cedar', 2), (4, 3, 2, 1), 9)
    for (x, y) in ((5, 2), (13, 10), (9, 6)):
        c.P(x, y, J('lantern_amber', 4))


def _canal_water(c):
    """농수로 물: jp_city 수로 물 칩(water_tex) 그대로."""
    from autotiles_ground import water_tex
    _put(c, water_tex())


def _canal_wall(c):
    """농수로 석축 윗면 연석(5px) + 젖은 돌 정면 + 물선."""
    for x in range(16):
        c.P(x, 0, J('paving_stone', 4))
        for y in (1, 2, 3): c.P(x, y, J('paving_stone', 3 if x % 8 != 7 else 2))
        c.P(x, 4, J('paving_stone', 1))
    for y in range(5, 13):
        for x in range(16):
            row = (y - 5) // 4; sx = (x + row * 4) % 8; sy = (y - 5) % 4
            t = 0 if (sx == 7 or sy == 3) else 3 if (sx == 0 or sy == 0) else 2
            if y >= 10 and t == 2 and Hw(x, y, 3) < 0.4: c.P(x, y, J('moss', 2)); continue
            c.P(x, y, J('wet_cobble', t))
    c.HL(0, 13, 16, J('canal_indigo', 1)); c.HL(0, 14, 16, J('canal_indigo', 2)); c.HL(0, 15, 16, J('canal_indigo', 2))
    c.P(4, 14, J('vending_cool_white', 4)); c.P(11, 15, J('onsen_mineral_teal', 3))


def _river_shallow(c):
    """얕은 개울: 맑은 물 + 비치는 강자갈(2px 덩이) + 짧은 사선 물비늘."""
    _water_base(c, 'onsen_mineral_teal', 3, 67)
    for (x, y, t) in ((3, 3, 2), (11, 5, 1), (6, 11, 2), (13, 13, 1)):
        c.P(x, y, J('wet_cobble', t + 2)); c.P(x + 1, y, J('wet_cobble', t + 1)); c.P(x, y + 1, J('wet_cobble', t + 1)); c.P(x + 1, y + 1, J('onsen_mineral_teal', 2))
    c.P(8, 8, J('vending_cool_white', 4)); c.P(9, 8, J('onsen_mineral_teal', 4))


def _furrow(c):
    """채소밭 이랑: 짙은 흙 + 3/4 양배추·무 포기(왼쪽 위 밝음, 오른쪽 아래 흙에 진 그늘)."""
    for y in range(16):
        for x in range(16):
            ridge = (y % 8) in (5, 6)
            h = Hw(x // 2, y // 2, 13)
            c.P(x, y, K('soil', 0 if ridge else (1 if h < 0.75 else 2)))
    for (x, y, col) in ((3, 1, 'midori'), (11, 1, 'midori'), (7, 9, 'midori'), (15, 9, 'midori')):
        c.P((x + 1) % 16, y + 3, K('soil', -2)); c.P((x + 2) % 16, y + 3, K('soil', -2))   # 그늘
        for dy, dx, t in ((0, 0, 2), (0, 1, 1), (1, -1, 1), (1, 0, 2), (1, 1, 0), (2, 0, 0), (2, 1, -1), (1, 2, -1), (2, -1, 0)):
            c.P((x + dx) % 16, y + dy, K(col, t))


GROUND: Final[collections.OrderedDict[str, tuple[Callable[[Cv], None], str]]] = collections.OrderedDict((
    ('gnd/inaka-paddy-water', (_paddy_water, 'solidfloor')),
    ('gnd/inaka-paddy-summer', (_paddy_summer, 'solidfloor')),
    ('gnd/inaka-paddy-golden', (_paddy_golden, 'solidfloor')),
    ('gnd/inaka-aze-path', (_aze_path, 'floor')),
    ('gnd/inaka-canal-water', (_canal_water, 'solidfloor')),
    ('gnd/inaka-canal-wall', (_canal_wall, 'solidfloor')),
    ('gnd/inaka-gravel-road', (_gravel_road, 'floor')),
    ('gnd/inaka-river-shallow', (_river_shallow, 'solidfloor')),
    ('gnd/inaka-meadow-wildflower', (_meadow, 'floor')),
    ('gnd/inaka-vegetable-furrow', (_furrow, 'solidfloor')),
))

GROUND_GROUPS: Final[tuple[tuple[str, str, list[str], str], ...]] = (
    ('jp:inaka-paddy-water', 'inaka-paddy-water', ['gnd/inaka-paddy-water'], '논(모내기 물논) - 하늘이 비친 물에 엇갈려 심은 어린 모 포기. 걸을 수 없으며 사방에 논두렁(inaka-aze-path)을 두른다.'),
    ('jp:inaka-paddy-summer', 'inaka-paddy-summer', ['gnd/inaka-paddy-summer'], '논(푸른 여름 벼) - 짙은 물 위에 빽빽한 벼 포기. 걸을 수 없다.'),
    ('jp:inaka-paddy-golden', 'inaka-paddy-golden', ['gnd/inaka-paddy-golden'], '논(황금 가을 벼) - 마른 논흙 위 고개 숙인 이삭 포기. 볏단 걸이(inaka-rice-rack-hasagi)와 짝지어 쓴다.'),
    ('jp:inaka-aze-path', 'inaka-aze-path', ['gnd/inaka-aze-path'], '논두렁·시골 흙마당 - 다진 흙에 듬성 풀포기. 걸을 수 있는 바닥.'),
    ('jp:inaka-canal-water', 'inaka-canal-water', ['gnd/inaka-canal-water'], '농수로 물(用水路) - jp_city 수로 물결 그대로.'),
    ('jp:inaka-canal-wall', 'inaka-canal-wall', ['gnd/inaka-canal-wall'], '농수로 석축 - 3/4 윗면 연석과 젖은 돌 정면·물선. 수로 북쪽 가장자리에 한 줄.'),
    ('jp:inaka-gravel-road', 'inaka-gravel-road', ['gnd/inaka-gravel-road'], '시골 흙자갈길 - 다진 흙 덩이와 빛 받은 자갈. 걸을 수 있는 주 도로.'),
    ('jp:inaka-river-shallow', 'inaka-river-shallow', ['gnd/inaka-river-shallow'], '시골 맑은 개울 - 강자갈이 비치는 얕은 물. 징검다리·붉은 철교 아래에 깐다.'),
    ('jp:inaka-meadow-wildflower', 'inaka-meadow-wildflower', ['gnd/inaka-meadow-wildflower'], '여름 풀밭 - jp_city 잔디 칩에 토끼풀 꽃. 기본 대지 바닥.'),
    ('jp:inaka-vegetable-furrow', 'inaka-vegetable-furrow', ['gnd/inaka-vegetable-furrow'], '채소밭 이랑 - 짙은 흙 이랑과 양배추 포기. 걸을 수 없다.'),
)

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
@kit('inaka-keitora-white', '흰 경트럭(軽トラ) - 캡 지붕 윗면·짐칸 윗면(양 난간·채소 상자·파란 방수포)·노란 경차 번호판(4×2)', 4, 2, 'vehicle',
     solid=rows(4, [0, 1]), tags=['inaka', '경트럭', '軽トラ', '탈것'],
     rules='농가 마당·논두렁 옆 자갈길에 오른쪽(동)을 보고 세운다.', role='prop')
def keitora(c, base):
    car_shadow(c, 3, 61, 29)
    # 짐칸: 먼 난간 윗면 → 짐칸 골바닥 → 채소 상자 2개 + 파란 방수포 → 가까운 난간 윗면 → 옆판
    c.R(3, 6, 36, 2, K('shiro', 2)); c.HL(3, 7, 36, K('shiro', 1))
    c.R(4, 8, 34, 8, K('tekko', -2))
    for x in range(7, 38, 5): c.VL(x, 8, 8, K('tekko', -1))     # 바닥 골
    rect_3d(c, 5, 7, 10, 8, 3, 'aged_cedar', top_t=3, front_t=2)   # 채소 상자 1(윗면에 양배추·배추)
    c.R(6, 8, 8, 3, K('midori', 1)); c.P(7, 8, K('midori', 2)); c.P(11, 9, K('midori', 2)); c.P(9, 10, K('midori', 0))
    rect_3d(c, 16, 7, 10, 8, 3, 'aged_cedar', top_t=3, front_t=2)  # 채소 상자 2(윗면에 당근·감자·귤)
    c.R(17, 8, 8, 3, K('daidai', 1)); c.P(18, 8, K('daidai', 2)); c.P(22, 9, K('daidai', 2)); c.P(20, 10, K('aka', 1))
    # 파란 방수포(일부 화물을 덮은 3/4 천 주름)
    c.R(27, 8, 11, 7, K('sora', 0)); c.HL(27, 8, 11, K('sora', 2)); c.HL(28, 9, 9, K('sora', 1))
    c.HL(28, 12, 9, K('sora', -1)); c.VL(37, 8, 7, K('sora', -1))
    c.HL(3, 15, 36, K('shiro', 2))                              # 가까운 난간 윗면
    c.R(3, 16, 36, 8, K('shiro', 0))
    c.HL(3, 19, 36, K('shiro', -1)); c.HL(3, 23, 36, K('shiro', -1))
    for x in (15, 27): c.VL(x, 16, 7, K('shiro', -1)); c.P(x + 1, 18, K('tekko', 0))  # 난간 걸쇠
    c.VL(3, 6, 18, K('shiro', 1))
    c.R(3, 17, 2, 4, K('aka', 1)); c.P(3, 17, K('aka', 2))      # 후미등
    # 캡 뒷벽(토리이 가드 프레임)
    c.R(39, 4, 2, 20, K('tekko', 0)); c.VL(39, 4, 12, K('tekko', 2))
    for yy in (6, 10, 14): c.HL(37, yy, 2, K('tekko', 0))
    # 캡: 지붕 윗면 6px → 경사 앞유리 → 옆면 문짝 + 사이드미러 + 앞 얼굴
    c.R(41, 2, 14, 6, K('shiro', 2)); c.HL(42, 2, 12, K('shiro', 3)); c.HL(41, 7, 14, K('shiro', 1))
    for y in range(3, 14):
        x0 = 54 + (y - 3) // 2
        c.R(x0, y, 4, 1, K('garasu', 2 if y < 6 else 1 if y < 9 else 0))
    c.P(55, 4, K('garasu', 3)); c.P(56, 5, K('garasu', 3))
    c.R(41, 8, 17, 16, K('shiro', 0))
    c.R(43, 9, 10, 7, K('garasu', 0)); c.HL(43, 9, 10, K('garasu', -1)); c.VL(52, 9, 7, K('garasu', -2))
    line(c, 44, 14, 48, 10, K('garasu', 2))                     # 창문 빛 반사
    c.R(52, 13, 2, 3, K('sumi', 1)); c.P(52, 13, K('tekko', 2)) # 사이드미러
    c.VL(42, 8, 15, K('shiro', 1)); c.VL(54, 9, 14, K('shiro', -1))
    c.HL(44, 18, 3, K('tekko', -1))                             # 문 손잡이
    c.R(58, 13, 3, 11, K('shiro', -1)); c.VL(60, 14, 9, K('shiro', -2))  # 차 앞면
    c.R(59, 15, 2, 3, K('kii', 2)); c.P(59, 15, K('shiro', 2))  # 전조등
    c.R(57, 21, 4, 2, K('kii', 1)); c.HL(57, 21, 4, K('kii', 2))  # 노란 경차 번호판
    c.HL(41, 23, 20, K('conc', 0))                              # 범퍼·사이드 스커트
    c.R(4, 24, 56, 2, K('tekko', -2))
    wheel(c, 13, 25, 4.8); wheel(c, 49, 25, 4.8)
    add_outline(c)


@kit('inaka-red-tractor', '빨간 농기계 트랙터 - 캐노피 지붕 윗면·긴 보닛·배기 연통·운전석·대형 러그 뒷바퀴·로터리 작업기(4×3)', 4, 3, 'vehicle',
     solid=rows(4, [1, 2]), tags=['inaka', '트랙터', 'トラクター', '농기계'],
     rules='논 가장자리·헛간 앞. 오른쪽(동)을 보고 둔다.', role='prop')
def tractor(c, base):
    car_shadow(c, 2, 61, 44)
    # 뒤쪽 로터리 경운 작업기(윗면 주황 덮개 + 유압 암 + 경운 칼날)
    line(c, 15, 31, 7, 27, K('tekko', 1)); line(c, 15, 35, 7, 34, K('tekko', -1))
    c.R(2, 26, 12, 4, K('daidai', 1)); c.HL(2, 26, 12, K('daidai', 2)); c.HL(2, 29, 12, K('daidai', 0))
    c.R(2, 30, 12, 9, K('daidai', -1)); c.HL(2, 38, 12, K('daidai', -2)); c.VL(2, 26, 13, K('daidai', 2))
    for x in (3, 6, 9, 12):
        c.R(x, 39, 2, 4, K('conc', 2)); c.P(x, 42, K('conc', 0))
    # 롤바 프레임 + 붉은/흰 햇빛 가림막 캐노피 지붕(3/4 윗면)
    c.R(16, 9, 2, 18, K('tekko', 0)); c.VL(16, 9, 18, K('tekko', 2))
    c.R(31, 9, 2, 14, K('tekko', 0)); c.VL(31, 9, 14, K('tekko', 2))
    c.R(13, 4, 22, 5, K('aka', 2)); c.HL(14, 4, 20, K('aka', 3)); c.HL(13, 8, 22, K('aka', 0))
    c.HL(15, 5, 18, K('shiro', 2))
    # 운전석 등받이 좌석 + 조향 핸들 + 레버
    c.R(19, 17, 3, 6, K('sumi', 1)); c.R(19, 21, 7, 3, K('sumi', 2)); c.HL(20, 21, 5, K('sumi', 3))
    line(c, 28, 24, 32, 16, K('tekko', 0))
    c.R(29, 15, 6, 2, K('sumi', 1)); c.HL(29, 15, 6, K('tekko', 2))
    # 엔진 보닛: 넓은 3/4 윗면(밝은 빨강) + 측면 루버/흰 줄무늬 + 전면 그릴과 전조등 + 앞 범퍼 웨이트
    c.R(32, 19, 25, 6, K('aka', 2)); c.HL(33, 19, 23, K('aka', 3)); c.HL(32, 24, 25, K('aka', 1))
    for x in range(36, 54, 4): c.P(x, 21, K('aka', 1))
    c.R(32, 25, 25, 11, K('aka', 0))
    c.HL(33, 27, 22, K('shiro', 2)); c.HL(33, 28, 22, K('aka', -1))
    for y in (30, 32, 34): c.HL(36, y, 16, K('tekko', -2))      # 엔진 냉각 루버
    c.R(57, 20, 3, 15, K('tekko', 0)); c.VL(59, 21, 13, K('tekko', -2))
    c.R(58, 22, 2, 3, K('kii', 2)); c.P(58, 22, K('shiro', 2))  # 전조등
    c.R(59, 32, 3, 5, K('tekko', -1)); c.HL(59, 32, 3, K('tekko', 1))  # 전면 웨이트 범퍼
    # 수직 배기 연통(머플러)
    c.R(47, 7, 3, 12, K('tekko', -1)); c.VL(47, 7, 12, K('tekko', 2))
    c.R(46, 5, 5, 2, K('tekko', 0)); c.HL(46, 5, 5, K('tekko', 2))
    # 차대 하부 프레임
    c.R(24, 35, 32, 4, K('tekko', -2)); c.HL(28, 36, 12, K('tekko', 0))
    # 대형 깍두기(러그) 뒷바퀴 + 둥근 붉은 펜더 윗면
    for x in range(12, 33):
        u = (x - 22.5) / 10.5
        yt = round(23 - 4.5 * math.sqrt(max(0.0, 1 - u * u)))
        c.P(x, yt, K('aka', 3 if x < 23 else 2))
        c.P(x, yt + 1, K('aka', 2 if x < 23 else 1))
        c.P(x, yt + 2, K('aka', 0))
    disc(c, 22.5, 34, 10.6, OL); disc(c, 22.5, 34, 9.5, K('sumi', 1))
    for k in range(14):
        a = k * math.pi / 7
        c.P(round(22.5 + math.cos(a) * 8.6), round(34 + math.sin(a) * 8.6), K('tekko', 0))
        c.P(round(22.5 + math.cos(a) * 9.5), round(34 + math.sin(a) * 9.5), OL)
    disc(c, 22.5, 34, 5.2, K('kii', 1)); disc(c, 22.5, 34, 2.4, K('aka', 0)); c.P(21, 32, K('kii', 3))
    # 앞바퀴(조향 러그 타이어 + 노란 림)
    wheel(c, 51, 38, 6.0, 'kii')
    add_outline(c)


@kit('inaka-single-car-train', '단량 디젤 동차(キハ40 국철색) - AU75 냉방기·물탱크·배기구 지붕 윗면·크림+주홍 투톤 차체·폴딩 도어·전조등·대차(8×3)', 8, 3, 'vehicle',
     solid=rows(8, [1, 2]), tags=['inaka', '열차', '기차', '디젤동차', 'キハ', '철도'],
     rules='시골 선로(jp-rail-h) 위에 올린다(간이역 승강장 앞).', role='prop')
def single_car_train(c, base):
    W = 128
    # 3/4 지붕 윗면(y=1..17, jp-train-car-a 와 같은 지붕 비례): 뒤 모서리 OL → 둥근 회백색 지붕 판 → 앞 처마 OL
    c.HL(2, 0, W - 4, OL)
    for j in range(17):
        y = 1 + j
        col = K('conc', 1) if j == 0 else K('conc', 2) if j == 1 else K('shiro', 2) if j >= 14 else K('conc', 3)
        c.HL(2, y, W - 4, col)
    for j in (5, 10, 14):
        c.HL(3, j, W - 6, K('conc', 2))
    c.VL(1, 1, 17, OL); c.VL(W - 2, 1, 17, OL)
    # 지붕 위 기기: 물탱크(왼)·AU75 냉방기 2기·배기 매니폴드·환기구 4기
    for (bx, bw, ramp, t) in ((8, 14, 'conc', 2), (30, 22, 'shiro', 2), (76, 22, 'shiro', 2)):
        c.HL(bx, 3, bw, OL)
        c.R(bx, 4, bw, 5, K(ramp, t)); c.HL(bx, 4, bw, K('shiro', 3)); c.HL(bx, 8, bw, K(ramp, t + 1))
        c.R(bx, 9, bw, 3, K('tekko', 0)); c.HL(bx, 9, bw, K('tekko', 2)); c.HL(bx, 11, bw, K('tekko', -2))
        for gx in range(bx + 3, bx + bw - 2, 4):
            c.VL(gx, 5, 3, K('conc', 1)); c.P(gx, 10, K('tekko', -3))
        c.VL(bx - 1, 4, 8, OL); c.VL(bx + bw, 4, 8, OL); c.HL(bx - 1, 12, bw + 2, OL)
    # 디젤 배기 연통(가운데 지붕 위)
    c.R(59, 3, 8, 6, K('tekko', -1)); c.HL(59, 3, 8, K('tekko', 2)); c.R(61, 4, 4, 3, K('sumi', 1))
    c.VL(58, 3, 6, OL); c.VL(67, 3, 6, OL); c.HL(58, 9, 10, OL)
    # 소형 지붕 환기구(벤틸레이터)
    for vx in (24, 53, 70, 102):
        c.R(vx, 6, 4, 3, K('conc', 2)); c.HL(vx, 6, 4, K('shiro', 2)); c.HL(vx, 8, 4, K('tekko', 0))
    # 앞·뒤 운전실 지붕 위 전조등(타이폰+헤드라이트 포드)
    for hx in (3, W - 7):
        c.R(hx, 7, 4, 4, K('tekko', 1)); c.P(hx + (0 if hx < 64 else 3), 8, K('kii', 3))
    c.HL(1, 18, W - 2, K('tekko', -2)); c.HL(1, 19, W - 2, OL)  # 처마 홈통
    # 차체 옆면(y=20..38): 국철 키하 40형 크림(위) + 주홍(首都圏色/국철 투톤, 아래) 도색
    c.R(2, 20, W - 4, 4, J('torii_vermilion', 2)); c.HL(2, 20, W - 4, J('torii_vermilion', 3))
    c.R(2, 24, W - 4, 8, K('kinari', 2)); c.HL(2, 24, W - 4, K('kinari', 3)); c.HL(2, 31, W - 4, K('kinari', 1))
    c.R(2, 32, W - 4, 7, J('torii_vermilion', 2)); c.HL(2, 32, W - 4, J('torii_vermilion', 3))
    c.HL(2, 34, W - 4, K('kinari', 2))                          # 크림색 가는 허리띠
    c.HL(2, 38, W - 4, J('torii_vermilion', 0))
    c.VL(2, 20, 19, K('kinari', 3)); c.VL(W - 3, 20, 19, J('torii_vermilion', 0))
    c.VL(1, 20, 20, OL); c.VL(W - 2, 20, 20, OL)
    # 양 끝 운전실 옆창 + 파노라마 앞유리 모서리 + 전조등/후미등 + 행선판(サボ)
    for cx0, is_right in ((3, False), (W - 9, True)):
        c.R(cx0, 24, 6, 6, K('garasu', -1)); c.HL(cx0, 24, 6, K('garasu', 2)); c.P(cx0 + 1, 25, K('garasu', 3))
    c.R(2, 33, 2, 3, K('aka', 2))                               # 뒤쪽 적색 미등
    c.R(W - 4, 33, 2, 3, K('kii', 3)); c.P(W - 4, 33, K('shiro', 3))  # 앞쪽 전조등
    # 승객 2단 유닛 창(6개)
    for wx in (23, 34, 45, 56, 67, 78, 89):
        c.R(wx - 1, 23, 9, 8, K('tekko', 1))
        c.R(wx, 24, 7, 6, K('garasu', -1)); c.HL(wx, 24, 7, K('garasu', 1)); c.HL(wx, 27, 7, K('tekko', 2))
        c.P(wx + 1, 25, K('garasu', 3)); c.P(wx + 5, 25, K('garasu', 2))
    # 행선지 표지판(サボ) + 원맨(ワンマン) 표시판
    c.R(63, 33, 8, 3, K('shiro', 2)); c.HL(64, 34, 6, K('sora', 0))
    c.R(99, 25, 4, 3, K('midori', 1)); c.HL(99, 25, 4, K('shiro', 2))
    # 앞·뒤 폴딩 승강문(2개소: x=11..19, x=105..113)
    for dx in (11, 105):
        c.R(dx, 22, 9, 16, J('torii_vermilion', 1))
        c.HL(dx, 24, 9, K('kinari', 2)); c.R(dx, 25, 9, 6, K('kinari', 1))
        c.VL(dx, 22, 16, J('torii_vermilion', 0)); c.VL(dx + 8, 22, 16, J('torii_vermilion', 0))
        c.VL(dx + 4, 22, 16, K('tekko', -1))                    # 두 짝 폴딩 이음선
        c.R(dx + 1, 24, 3, 6, K('garasu', -1)); c.R(dx + 5, 24, 3, 6, K('garasu', -1))
        c.P(dx + 1, 25, K('garasu', 2)); c.P(dx + 5, 25, K('garasu', 2))
        c.HL(dx + 1, 36, 7, K('tekko', 1))                      # 승강 발판
    # 하부 언더프레임 + 디젤 엔진·연료탱크 기기함 + DT22 대차 2조 + 배장기(스커트)
    c.R(2, 39, W - 4, 3, K('tekko', -2)); c.HL(2, 39, W - 4, K('tekko', 0))
    c.R(4, 41, 6, 4, K('tekko', 0)); c.R(W - 10, 41, 6, 4, K('tekko', 0))  # 양 끝 배장기(스커트)
    for (ux, uw) in ((42, 16), (62, 14), (80, 10)):             # 하부 디젤 엔진·공기탱크
        c.R(ux, 41, uw, 3, K('tekko', -1)); c.HL(ux + 1, 42, uw - 2, K('tekko', 1))
    for bx in (16, 30, 94, 108):                                # 앞·뒤 보기 대차 바퀴
        c.R(bx - 4, 41, 9, 4, K('yoru', -1))
        c.P(bx - 2, 42, K('tekko', 2)); c.P(bx + 2, 42, K('tekko', 2))
    c.HL(14, 41, 19, K('tekko', 0)); c.HL(92, 41, 19, K('tekko', 0))
    c.HL(2, 45, W - 4, OL); c.HL(3, 46, W - 6, K('yoru', -2))

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


def _blit(c, t):
    """임시 캔버스 t 의 불투명 픽셀을 c 위에 덮는다(add_outline 을 t 에만 두르기 위해)."""
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


def scarecrow(c, t, x, y, robe='noren_indigo', obi='torii_vermilion'):
    """3/4 허수아비: 흙 둔덕 + 땅에 진 대나무 그림자(c) → 기둥·팔 막대 → 소매 늘어진 기모노 → 자루 얼굴 → 菅笠(원뿔 윗면 + 챙 그늘)(t)."""
    # 땅: 둔덕 그림자와 기둥 그림자는 윤곽 없이 바닥(c)에 진다(빛 왼쪽 위 → 오른쪽 아래)
    disc(c, x + 2, y + 29, 6.5, K('yoru', -1), ry=2.0)
    line(c, x + 1, y + 28, x + 7, y + 30, K('yoru', -1))
    disc(t, x, y + 27.5, 5.5, J('aged_cedar', 1), ry=2.3)
    disc(t, x - 0.5, y + 27, 4.2, J('aged_cedar', 2), ry=1.5)
    for gx in (x - 4, x + 3):
        t.P(gx, y + 26, J('moss', 3)); t.P(gx + 1, y + 25, J('moss', 4))
    # 대나무 기둥(마디) + 팔 막대(윗면 1px 밝게)
    t.R(x - 1, y + 8, 2, 20, J('pine_bamboo', 2)); t.VL(x - 1, y + 8, 20, J('pine_bamboo', 3))
    for my in (y + 20, y + 24): t.HL(x - 1, my, 2, J('pine_bamboo', 1))
    t.R(x - 7, y + 12, 15, 2, J('pine_bamboo', 2)); t.HL(x - 7, y + 12, 15, J('pine_bamboo', 3))
    # 기모노 몸통: 어깨 9px → 밑단 7px, 왼쪽 빛·오른쪽 그늘, 세로 주름 두 줄, 흰 깃 V
    for k in range(11):
        hw = 4 if k < 6 else 3
        t.HL(x - hw, y + 12 + k, hw * 2 + 1, J(robe, 2))
        t.P(x - hw, y + 12 + k, J(robe, 3)); t.P(x + hw, y + 12 + k, J(robe, 1))
    t.VL(x - 2, y + 18, 5, J(robe, 1)); t.VL(x + 2, y + 17, 6, J(robe, 1))
    t.HL(x - 3, y + 22, 7, J(robe, 0))
    t.P(x - 1, y + 12, K('shiro', 2)); t.P(x + 1, y + 12, K('shiro', 1)); t.P(x, y + 13, K('shiro', 1))
    # 늘어진 소매(袖): 팔 막대 아래로 처진 천 + 안쪽 그늘
    t.R(x - 7, y + 13, 3, 5, J(robe, 3)); t.VL(x - 5, y + 14, 4, J(robe, 1))
    t.R(x + 5, y + 13, 3, 5, J(robe, 2)); t.VL(x + 5, y + 14, 4, J(robe, 0))
    # 오비(띠) + 매듭
    t.HL(x - 4, y + 16, 9, J(obi, 3)); t.HL(x - 4, y + 17, 9, J(obi, 2)); t.P(x + 2, y + 18, J(obi, 2))
    # 자루 얼굴(へのへのもへじ 점) + 챙 그늘
    disc(t, x, y + 9, 2.9, J('cream_stucco', 3), ry=2.6)
    t.HL(x - 2, y + 8, 5, J('cream_stucco', 1))
    t.P(x - 1, y + 9, J('aged_cedar', 0)); t.P(x + 1, y + 9, J('aged_cedar', 0)); t.P(x, y + 10, J('aged_cedar', 1))
    # 菅笠: 3/4 챙 타원(아래 가장자리 그늘) 위에 원뿔 윗면(왼쪽 밝게, 엮음 결 세로줄)
    disc(t, x, y + 6.5, 7.2, J('tatami_straw', 1), ry=2.4)
    disc(t, x - 0.3, y + 6.0, 6.6, J('tatami_straw', 2), ry=1.9)
    for k in range(6):
        hw = 1 + k
        yy = y + k
        for xx in range(x - hw, x + hw + 1):
            lv = 4 if xx < x - hw // 2 else 3 if xx <= x else 2
            if (xx - x) % 3 == 0 and k > 1: lv -= 1
            t.P(xx, yy, J('tatami_straw', lv))
    t.P(x, y, J('tatami_straw', 4))


@kit('inaka-scarecrow-pair', '허수아비 한 쌍(案山子) - 菅笠 원뿔 윗면·챙 그늘·소매 늘어진 기모노·대나무 기둥·흙 둔덕 그림자(2×2)', 2, 2, 'prop',
     solid=[(0, 1), (1, 1)], tags=['inaka', '허수아비', 'かかし'],
     rules='논 한가운데·논두렁.', role='prop')
def scarecrows(c, base):
    t = Cv(c.w, c.h)
    scarecrow(c, t, 8, 1, 'noren_indigo', 'torii_vermilion')
    scarecrow(c, t, 24, 2, 'torii_vermilion', 'tatami_straw')
    add_outline(t)
    _blit(c, t)


def _sunflower_head(t, x, y, rx, ry, face=1):
    """3/4 해바라기 머리: 꽃잎 테(뒤 그늘 → 앞 밝게) + 기울어진 씨앗판(face 방향으로 비킨 갈색 타원)."""
    disc(t, x + 0.4, y + 0.6, rx + 1.2, J('lantern_amber', 1), ry=ry + 1.0)
    for k in range(10):
        a = k * math.pi / 5 + 0.3
        disc(t, x + math.cos(a) * rx, y + math.sin(a) * ry, 1.6, J('lantern_amber', 3 if math.sin(a) < 0.3 else 2))
    disc(t, x, y, rx, J('lantern_amber', 3), ry=ry)
    disc(t, x - rx * 0.35, y - ry * 0.35, rx * 0.5, J('lantern_amber', 4), ry=ry * 0.45)
    cx, cy = x + face * rx * 0.18, y + ry * 0.15
    disc(t, cx, cy, rx * 0.5, J('machiya_timber', 1), ry=ry * 0.5)
    disc(t, cx - 0.5, cy - 0.5, rx * 0.3, J('machiya_timber', 2), ry=ry * 0.3)
    t.P(int(cx + rx * 0.3), int(cy + ry * 0.3), J('machiya_timber', 0))


def _leaf(t, x, y, side):
    """하트꼴 큰 잎(위 밝게) - side -1 왼쪽, 1 오른쪽으로 뻗는다."""
    disc(t, x + side * 3, y + 1, 3.6, J('pine_bamboo', 2), ry=2.4)
    disc(t, x + side * 3 - 0.8, y + 0.4, 2.4, J('pine_bamboo', 3), ry=1.4)
    t.P(x + side * 2, y + 1, J('pine_bamboo', 1))


@kit('inaka-sunflower-patch', '해바라기 밭 한 덩이 - 3/4 북돋운 흙 두둑·층층 잎 줄기·뒷줄 작고 앞줄 큰 비스듬한 꽃 머리(3×2)', 3, 2, 'tree',
     solid=[(0, 1), (1, 1), (2, 1)], tags=['inaka', '해바라기', 'ひまわり', '여름'],
     rules='밭·마당 가장자리에 2~6개 이어 붙인다.', role='prop')
def sunflowers(c, base):
    disc(c, 26, 29, 22, K('yoru', -1), ry=2.6)                    # 두둑 그림자(오른쪽 아래)
    t = Cv(c.w, c.h)
    # 북돋운 흙 두둑: 앞면(짙은 흙) → 윗면(밝은 흙, 이랑 줄)
    disc(t, 24, 26.5, 22.5, J('aged_cedar', 0), ry=4.2)
    disc(t, 24, 25.0, 21.5, J('aged_cedar', 2), ry=3.0)
    for x in range(6, 43, 5): t.HL(x, 25, 3, J('aged_cedar', 3))
    # 뒷줄(높고 작은 머리) → 앞줄(낮고 큰 머리): 줄기 + 잎을 먼저, 머리를 나중에
    back = ((8, 5, 4.2, 3.4, 1), (20, 3, 4.6, 3.6, -1), (32, 5, 4.2, 3.4, 1), (42, 4, 3.8, 3.2, -1))
    front = ((13, 13, 5.4, 4.4, -1), (26, 12, 5.8, 4.6, 1), (38, 14, 5.2, 4.2, -1))
    for row, top in ((back, 22), (front, 25)):
        for (x, y, rx, ry, face) in row:
            t.R(x, y + 3, 2, top - y - 3, J('pine_bamboo', 2)); t.VL(x, y + 3, top - y - 3, J('pine_bamboo', 3))
            for k, ly in enumerate(range(y + 7, top - 2, 5)):
                _leaf(t, x + (0 if k % 2 else 1), ly, -1 if k % 2 else 1)
        for (x, y, rx, ry, face) in row:
            _sunflower_head(t, x, y, rx, ry, face)
    add_outline(t)
    _blit(c, t)


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
@kit('inaka-sluice-gate', '농수로 수문(水門) - 양 둑 콘크리트 기둥·3/4 윗면 다리판 보도·핸들 축·내려온 철 수문판·아래 흰 물거품(2×2)', 2, 2, 'structure',
     solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['inaka', '수문', '水門', '농수로'],
     rules='폭 2칸 남북 농수로(수로) 위에 가로질러 놓는다. 양 기둥이 양쪽 호안에 선다.', role='water')
def sluice(c, base):
    # 물(수로 물 색) + 수문 밑 흰 물거품
    c.R(6, 22, 20, 10, J('canal_indigo', 2))
    c.HL(6, 29, 20, J('canal_indigo', 3)); c.HL(9, 31, 6, J('canal_indigo', 4))
    for x in range(7, 25):
        c.P(x, 23, K('shiro', 3 if x % 3 else 2)); c.P(x, 24, K('shiro', 1) if x % 2 else J('canal_indigo', 4))
        if x % 4 == 1: c.P(x, 25, K('shiro', 1))
    # 철 수문판: 기둥 홈 사이로 내려와 물에 잠긴다(가로 보강대 + 왼쪽 빛)
    c.R(6, 12, 20, 11, K('tekko', 0))
    for y in (14, 18): c.HL(6, y, 20, K('tekko', 2)); c.HL(6, y + 1, 20, K('tekko', -1))
    c.VL(6, 12, 11, K('tekko', 2)); c.HL(6, 22, 20, K('tekko', -2))
    for x in (10, 16, 22): c.P(x, 16, K('tekko', 3))
    # 양 둑 콘크리트 기둥(호안 위): 윗면 3px + 정면, 안쪽 홈은 짙게
    rect_3d(c, 0, 4, 7, 28, 3, 'concrete_grey', top_t=3, front_t=2)
    rect_3d(c, 25, 4, 7, 28, 3, 'concrete_grey', top_t=3, front_t=1)
    c.VL(6, 9, 22, J('concrete_grey', 0)); c.VL(25, 9, 22, J('concrete_grey', 0))
    # 다리판 보도(3/4 윗면 + 앞 갓) + 뒤 난간
    c.HL(0, 2, 32, OL); c.HL(1, 3, 30, K('tekko', 1))
    rect_3d(c, 0, 5, 32, 7, 4, 'concrete_grey', top_t=4, front_t=2)
    # 핸들 축(가운데 세로 나사봉) + 붉은 핸들 바퀴(타원 윗면)
    c.R(15, 0, 2, 7, K('tekko', 1)); c.VL(15, 0, 7, K('tekko', 3))
    disc(c, 16, 2, 4.6, OL, ry=2.0); disc(c, 16, 2, 3.8, K('aka', 1), ry=1.4); disc(c, 16, 2, 2.0, K('aka', -1), ry=0.6)
    c.P(13, 1, K('aka', 3)); c.P(16, 2, K('tekko', 3))


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
    # 양 끝 돌 교대(橋台): 거더 끝이 둑 돌 위에 얹힌다
    for ax in (0, W - 7):
        c.R(ax, 38, 7, 10, OL)
        stones(c, ax + 1, 39, 5, 8, 'shrine_flagstone', seed=ax + 3, course=(4, 4), width=(4, 6), moss=0.2)
        c.HL(ax + 1, 39, 5, J('shrine_flagstone', 4))


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
    """여름 풀밭: jp_city 잔디 칩 그대로(±1단 톤 변화만, 밝은 꽃 점 없음 - 넓게 깔아도 점 격자가 생기지 않는다)."""
    _put(c, _chip('lawn'))


def _gravel_road(c):
    """시골 흙자갈길: 다진 흙 2px 덩이 + 한 단 밝은 자갈(눈에 띄는 흰 점 없이)."""
    _cluster(c, 'aged_cedar', (3, 3, 4), 51)
    for (x, y) in ((2, 3), (9, 1), (13, 7), (5, 10), (11, 13), (7, 6)):
        c.P(x, y, J('aged_cedar', 4)); c.P((x + 1) % 16, (y + 1) % 16, J('aged_cedar', 2))


def _aze_path(c):
    """논두렁·마당 흙: 산길 흙(rg trail) 톤 클러스터 + 한 단 차이 풀 기운(점 무늬 없음)."""
    _cluster(c, 'aged_cedar', (3, 2, 2), 23)
    for (x, y) in ((3, 4), (12, 11)):
        c.P(x, y, J('moss', 2)); c.P(x + 1, y, J('moss', 2))


def _soft_base(c, mat, lv, seed):
    """jp_city 잔디 칩처럼 1px 단위로 고르게 흩은 한 단 차이 결(덩이·사선 줄·점 격자 없음)."""
    for y in range(16):
        for x in range(16):
            h = Hw(x, y, seed)
            c.P(x, y, J(mat, lv + 1 if h > 0.86 else lv - 1 if h < 0.05 else lv))


def _rice_rows(c, mat, lv, seed, tip=None):
    """벼 포기 줄: 4px 간격 4줄 × 4포기(줄마다 2px 엇갈림 + 1px 흔들림). 잎은 바탕보다 한 단만 밝게, 밑동은 한 단 어둡게.
    한 칸에 16포기가 고르게 깔려 점 격자가 아닌 결(texture)로 읽힌다."""
    for j, y in enumerate((1, 5, 9, 13)):
        for i in range(4):
            x = (i * 4 + (j % 2) * 2 + (1 if Hw(i, j, seed) > 0.6 else 0)) % 16
            c.P(x, y, J(mat, lv + 1) if tip is None or Hw(i, j, seed + 1) < 0.5 else tip)
            c.P((x - 1) % 16, (y + 1) % 16, J(mat, lv + 1)); c.P(x, (y + 1) % 16, J(mat, lv)); c.P((x + 1) % 16, (y + 1) % 16, J(mat, lv + 1))
            c.P(x, (y + 2) % 16, J(mat, lv - 1))


def _paddy_water(c):
    """모내기 물논: 하늘 비친 잔잔한 물(4px 얼룩) + 줄지어 심은 어린 모(한 단 차이 초록)."""
    _soft_base(c, 'onsen_mineral_teal', 2, 3)
    for j, y in enumerate((1, 5, 9, 13)):
        for i in range(4):
            x = (i * 4 + (j % 2) * 2 + (1 if Hw(i, j, 5) > 0.6 else 0)) % 16
            c.P(x, y, J('pine_bamboo', 3)); c.P((x - 1) % 16, (y + 1) % 16, J('pine_bamboo', 2)); c.P((x + 1) % 16, (y + 1) % 16, J('pine_bamboo', 2))


def _paddy_summer(c):
    """여름 푸른 논: 빽빽한 벼(moss) 결 - 바탕 2단, 잎 3단, 드문 4단 잎끝."""
    _soft_base(c, 'moss', 2, 7)
    _rice_rows(c, 'moss', 2, 7, tip=J('moss', 4))


def _paddy_golden(c):
    """가을 황금 논: 고개 숙인 이삭 결 - 볏짚 2단 바탕, 3단 이삭, 드문 4단 빛."""
    _soft_base(c, 'tatami_straw', 2, 9)
    _rice_rows(c, 'tatami_straw', 2, 9, tip=J('tatami_straw', 4))


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
    """얕은 개울: jp_city 연못·수로 물 칩(water_tex) 그대로 - 연못(연못) 오토타일 물과 이음매 없이 이어진다."""
    from autotiles_ground import water_tex
    _put(c, water_tex())


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

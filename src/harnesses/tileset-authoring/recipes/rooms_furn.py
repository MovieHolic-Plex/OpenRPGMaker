"""monster-rooms 가구 — 본 시트 interior2 의 F 캔버스(통일 외곽선 i2_ol + 반투명 그림자 오른쪽 2px·아래 3px)로 그린다.
문법: 윗면 하이라이트 1px · 앞면 진한 띠 · 다리가 보이면 바닥에 선다(3/4) · 뒷벽에 붙는 가구는 위 칸이 벽을 덮는다(floor_y=16 이면 그림자는 바닥 칸에만).
벽 장식(창·칠판·문·현창·시계·등)은 그림자 없이 벽 칸 위에 얹고, 천장 끝 띠(벽 위 칸 y 0..2)는 덮지 않는다. 색은 seed.palette 의 rm_*·i2_* 램프만 쓴다.

방별 가구 문법(원작 지도를 3배로 그려 잰 것):
- 박사 연구소(fr PalletTown_ProfessorOaksLab 13×14 · em LittlerootTown_ProfessorBirchsLab): 뒷벽에 컴퓨터 줄(랙)·분석 기계(둘 다 위 4px 밝은 윗면)·연구원 책상(현미경·모니터,
  의자는 책상을 향해 등받이가 보는 쪽),
  옆에 책장. 방 왼쪽 위에 큰 실험 기계(3×3, 받침 타원), 오른쪽에 시작 몬스터 탁자(몬스터볼 셋). 아래쪽 가운데 1칸 통로를 두고
  양쪽 벽에 붙여 바닥 책장 3+3(`lab_shelf_free`, 윗면이 반 칸 되는 흰 판 + 책 두 단). 아래 구석에 화분.
- 트레이너 학교(em RustboroCity_PokemonSchool): 뒷벽 가운데 칠판, 그 밑 바닥 줄에 칠판 폭보다 넓은 주황 교단(`sc_dais`, 막힘),
  교단 앞에 다리가 보이는 밝은 교탁(`sc_lectern`). 학생 책상(책상+의자 1×2) 4열×3줄 — 가운데 통로를 두고 2열씩. 창은 뒷벽 양 끝.
- 박물관(em OceanicMuseum_1F): 수조·유리 원통 진열장은 뒷벽에 박힌다. 뒷벽 왼쪽 아치 계단(`mu_stairs`, 2층). 입구 매트 양옆에 ∩자 접수대(`mu_udesk` 3×3) 둘.
  안쪽 카펫 위에 배 모형(줄 차단봉 `mu_rope_*` 로 앞을 막는다)·화석 받침·낮은 유리 진열대·바닥 원통 진열장.
- 백화점(em LilycoveCity_DepartmentStore_1F): 뒷벽 왼쪽 엘리베이터(아래에 문턱 발판), 오른쪽 에스컬레이터(천장 띠 아래에서 시작, 아래 빗살 발판), 층 표시 판.
  뒷벽 밑에 양 끝이 벽 쪽으로 꺾인 U자 카운터(`dp_counter` 5×3, 안쪽 3×2가 점원 자리), 위에 금전등록기·모니터·연어색 받침 둘. 진열장·유리 진열대·옷걸이를 줄지어 둔다.
- 배(fr SSAnne · em SSTidal): 선실 침대는 머리판을 뒷벽에(머리판 폭 전체 나무 판 · 이불 앞면 · 다리 둘), 탁자 가운데, 휴지통(흰 원통, 위 타원 입구)은 옆벽 쪽.
  갑판은 야외라 항구와 같은 물체를 해안 정본 함수로 부른다(REGIONS 2-1): 나무 통 `coast.barrel` · 계류 기둥 `coast.bollard` ·
  접이 의자 `coast.deckchair` · 구명튜브 `coast.swimring`(걸린 고리라 그림자만 뺀다). 배 고유 물체만 따로 그린다 — 둥근 탁자(넓은 원판 · 받침 원)·
  굽은 통풍관(옆모습, 입이 옆으로). 복도 계단은 흰 철 난간, 문 사이 벽 밑엔 벤치·소화기.
- 사천왕·챔피언: 봉인 문(뒷벽 가운데 3칸), 뒷벽 밑 매달린 등(`lg_lamp`, 칸마다), 옆벽 테마 블록(`lg_side_<테마>_l/_r` 3×5).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import interior2 as i2  # noqa: E402
from interior2 import F  # noqa: E402
import coast  # noqa: E402  (정본: 항구·갑판 소품 barrel·bollard·deckchair·swimring 을 부르기만 한다 — REGIONS 2-1)

GOODS = ("i2_red", "i2_blue", "i2_yellow", "i2_green")
GLYPH = {
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"], "3": ["##.", "..#", ".#.", "..#", "##."],
    "F": ["###", "#..", "##.", "#..", "#.."], "B": ["##.", "#.#", "##.", "#.#", "##."],
}


def _text(f, x, y, s, c):
    for k, ch in enumerate(s):
        for dy, row in enumerate(GLYPH[ch]):
            for dx, q in enumerate(row):
                if q == "#":
                    f.p(x + k * 4 + dx, y + dy, c)


def _books(f, P, x0, x1, y_base, h=5, seed=0):
    """책등 줄: 폭 2px 책을 색 번갈아, 높이 h/h-1 번갈아, 윗점 밝게."""
    k = seed
    x = x0
    while x + 1 <= x1:
        r = P[GOODS[k % 4]]
        hh = h - (k % 2)
        f.r(x, y_base - hh + 1, x + 1, y_base, r[1]); f.p(x, y_base - hh + 1, r[2]); f.p(x + 1, y_base, r[0])
        x += 2 + (1 if k % 3 == 2 else 0); k += 1


def _ball(f, P, cx, cy, r=2.6):
    """몬스터볼(지름 5~6px): 위 빨강 · 아래 흰색 · 가운데 띠와 단추."""
    red, w, ol = P["i2_red"], P["i2_white"], P["i2_ol"][0]
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > r:
                continue
            f.p(x, y, red[1] if y + 0.5 < cy - 0.5 else w[1] if y + 0.5 > cy + 0.5 else ol)
    f.p(int(cx - r + 1), int(cy - r + 1), red[2])
    f.p(int(cx), int(cy), w[2])


# ==== 박사 연구소 ==============================================================================
def lab_server(P):
    """컴퓨터 줄 한 대(1×2, 뒷벽에 붙임): 위 4px 밝은 윗면(앞 모서리 빛 줄) · 회백 랙 앞면 · 작은 화면 · 깜빡이 램프 두 줄 · 통풍 홈 · 받침."""
    w, g, gl = P["i2_white"], P["i2_gray"], P["i2_glass"]
    f = F(1, 2)
    f.r(1, 2, 14, 5, w[2]); f.r(1, 6, 14, 6, w[0])                              # 윗면 + 앞 모서리
    f.r(1, 7, 14, 29, w[1]); f.r(2, 8, 2, 27, w[2])
    f.r(3, 9, 12, 13, g[0]); f.r(4, 10, 11, 12, gl[0]); f.r(5, 11, 8, 11, P["i2_green"][2])
    for k, y in enumerate((16, 19)):
        f.r(3, y, 12, y + 1, g[1])
        for x in range(4, 12, 3):
            f.p(x, y, P["i2_green"][2] if (x + k) % 2 else P["i2_red"][2])
    for y in range(22, 27, 2):
        f.r(4, y, 11, y, g[1])
    f.r(1, 27, 14, 29, g[1]); f.r(1, 27, 14, 27, w[0])
    return f.done(P, floor_y=16)


def lab_machine(P):
    """분석 기계(2×2, 뒷벽에 박힘): 위 4px 밝은 윗면(앞 모서리 빛 줄) · 넓은 흰 몸체 앞면 · 큰 화면(파형) · 버튼 판 · 앞으로 나온 조작 선반."""
    w, g, gl, st = P["i2_white"], P["i2_gray"], P["i2_glass"], P["i2_steel"]
    f = F(2, 2)
    f.r(1, 1, 28, 4, w[2]); f.r(1, 5, 28, 5, w[0])
    f.r(1, 6, 28, 21, w[1]); f.r(2, 7, 2, 20, w[2])
    f.r(4, 8, 17, 16, g[0]); f.r(5, 9, 16, 15, gl[0])
    for x in range(6, 16):
        f.p(x, 12 + round(2.0 * math.sin(x * 0.9)), P["i2_green"][2])
    f.r(20, 8, 26, 16, st[1]); f.r(20, 8, 26, 8, st[2])
    for k, (x, y) in enumerate(((21, 10), (24, 10), (21, 13), (24, 13))):
        f.r(x, y, x + 1, y + 1, (P["i2_red"][1], P["i2_yellow"][1], P["i2_green"][1], P["i2_blue"][1])[k])
    f.r(0, 22, 29, 25, st[2]); f.r(0, 26, 29, 27, st[1])                      # 조작 선반(앞으로 나옴)
    for x in range(3, 27, 3):
        f.r(x, 23, x + 1, 24, g[1])
    return f.done(P, floor_y=16)


def lab_desk(P):
    """연구원 책상(2×2, 뒷벽에 붙임): 노란 상판 · 모니터 · 현미경(받침·기둥·경통·접안부·재물대) · 서류 · 앞 서랍과 손잡이."""
    y_, wd, w, g, gl, mc = P["i2_yellow"], P["i2_wood"], P["i2_white"], P["i2_gray"], P["i2_glass"], P["rm_mic"]
    f = F(2, 2)
    f.r(3, 3, 14, 13, w[1]); f.r(3, 3, 14, 3, w[2]); f.r(5, 5, 12, 11, gl[0]); f.r(6, 6, 11, 10, gl[1]); f.line(7, 9, 9, 7, gl[2])
    f.r(7, 13, 10, 14, g[1])
    f.r(17, 14, 25, 15, mc[0]); f.r(17, 14, 25, 14, mc[1])                    # 현미경 받침
    f.r(23, 6, 24, 13, mc[1]); f.p(23, 6, mc[2])                              # 기둥(팔)
    f.r(18, 10, 23, 11, mc[2]); f.r(18, 11, 23, 11, mc[1])                    # 재물대
    f.line(19, 9, 21, 3, mc[0]); f.line(20, 9, 22, 3, mc[1]); f.line(21, 9, 23, 3, mc[0])   # 경통(비스듬히)
    f.r(21, 1, 24, 2, mc[0]); f.r(22, 1, 23, 1, mc[2])                        # 접안부
    f.r(19, 9, 21, 9, gl[2])                                                  # 대물렌즈 빛
    f.r(0, 15, 29, 21, y_[1]); f.r(0, 15, 29, 15, y_[2]); f.r(17, 15, 25, 15, mc[0])
    f.r(4, 17, 13, 19, g[1]); f.r(4, 17, 13, 17, g[2])                        # 자판
    f.r(20, 17, 27, 20, w[2]); f.r(21, 16, 27, 19, w[1]); f.r(22, 17, 26, 17, g[1])      # 서류
    f.r(0, 22, 29, 28, wd[1]); f.r(0, 22, 29, 22, wd[2])
    for x0 in (2, 16):
        f.r(x0, 23, x0 + 11, 27, wd[2]); f.r(x0 + 1, 24, x0 + 10, 26, wd[1]); f.r(x0 + 5, 25, x0 + 6, 25, P["i2_gold"][1])
    return f.done(P, floor_y=16)


def lab_shelf(P):
    """연구소 책장(2×2, 바닥에 줄지어 선다): 흰 윗판 · 회색 틀 · 책 두 단 · 아래 받침 · 그림자."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(2, 2)
    f.r(0, 1, 29, 6, w[1]); f.r(0, 1, 29, 1, w[2])
    f.r(0, 7, 29, 26, g[1]); f.r(1, 8, 28, 25, g[2])
    for y_b, sd in ((15, 0), (23, 2)):
        f.r(2, y_b - 6, 27, y_b, g[0])
        _books(f, P, 3, 26, y_b, 6, sd)
    f.r(0, 26, 29, 27, g[0])
    return f.done(P, floor_y=0)


def _books2(f, P, x0, x1, y_base, h=5, seed=0):
    """책등 줄(바닥 책장용): 폭 3px 책 — 왼쪽 2px 밝은 면 · 오른쪽 1px 어두운 면 · 윗점 밝게, 높이 번갈아."""
    k = seed
    x = x0
    while x + 2 <= x1:
        r = P[GOODS[k % 4]]
        hh = h - (k % 3 == 1)
        f.r(x, y_base - hh + 1, x + 1, y_base, r[1]); f.r(x + 2, y_base - hh + 1, x + 2, y_base, r[0]); f.r(x, y_base - hh + 1, x + 1, y_base - hh + 1, r[2])
        x += 3; k += 1


def lab_shelf_free(P):
    """바닥에 선 연구소 책장(2×2, 원작 오박사 연구소 바닥 책장): 윗면 반 칸 흰 판(8px, 앞 끝 한 톤) · 회색 틀 · 책 두 단(책마다 밝은 면·어두운 면) · 받침 · 그림자."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(2, 2)
    f.r(0, 0, 29, 8, w[1]); f.r(0, 0, 29, 0, w[2]); f.r(1, 1, 28, 1, w[2]); f.r(0, 8, 29, 8, w[0])
    f.r(0, 9, 29, 27, g[1]); f.r(1, 9, 28, 9, g[2])
    for y_b, sd in ((17, 0), (25, 2)):
        f.r(2, y_b - 6, 27, y_b, g[0])
        _books2(f, P, 3, 27, y_b, 6, sd)
    f.r(0, 26, 29, 27, g[0]); f.r(2, 26, 27, 26, g[1])
    return f.done(P, floor_y=0)


def lab_balltable(P):
    """시작 몬스터 탁자(3×2): 흰 테 · 초록 윗판 · 몬스터볼 셋 · 짧은 다리."""
    w, gr = P["i2_white"], P["i2_green"]
    f = F(3, 2)
    f.r(1, 6, 44, 21, w[1]); f.r(1, 6, 44, 6, w[2]); f.r(3, 8, 42, 18, gr[1]); f.r(3, 8, 42, 8, gr[2]); f.r(3, 18, 42, 18, gr[0])
    f.r(1, 22, 44, 23, w[0])
    for x in (3, 41):
        f.r(x, 24, x + 1, 27, P["i2_gray"][0])
    for cx in (13.5, 23.5, 33.5):
        _ball(f, P, cx, 12.5, 3.2)
    return f.done(P, floor_y=0)


def lab_bigmachine(P):
    """큰 실험 기계(3×3): 둥근 강철 받침(두 단) · 흰 원통 몸체(파란 띠) · 위 유리 돔 속 빨간 공 · 앞 조작판."""
    st, w, gl, red = P["i2_steel"], P["i2_white"], P["i2_glass"], P["i2_red"]
    f = F(3, 3)
    cx = 23.0                                                                  # 몸체 9..36 의 가운데 — 받침 타원이 좌우 대칭
    f.ell(cx, 36, 19, 7.5, st[0]); f.ell(cx, 34.5, 19, 7, st[1]); f.ell(cx, 33.5, 17, 5.5, st[2]); f.ell(cx, 33.5, 15.5, 4.6, st[1])
    f.r(9, 14, 36, 33, w[1]); f.r(9, 14, 10, 33, w[2]); f.r(35, 14, 36, 33, w[0])
    f.ell(cx, 33, 13.5, 2.6, w[1])
    f.r(9, 22, 36, 23, P["i2_blue"][1]); f.r(9, 22, 36, 22, P["i2_blue"][2])
    f.ell(cx, 13, 13.5, 9, gl[1]); f.ell(cx, 13.5, 12.5, 8, gl[0])
    f.ell(cx, 14, 8.5, 7, red[1]); f.ell(cx - 2.5, 11.5, 3.5, 2.5, red[2]); f.r(15, 14, 30, 15, red[0]); f.ell(cx, 14.5, 3.2, 3.0, P["i2_ol"][0]); f.ell(cx, 14.5, 2.0, 1.9, w[2])
    f.line(12, 11, 16, 6, gl[2]); f.line(14, 13, 18, 7, gl[2])
    f.r(17, 26, 28, 31, P["i2_gray"][0]); f.r(18, 27, 27, 30, P["i2_glass"][0])
    f.r(19, 29, 21, 29, P["i2_green"][2]); f.r(24, 28, 26, 29, P["i2_yellow"][1])
    return f.done(P, floor_y=0)


def lab_chart(P):
    """벽 도표 두 장(2×2 캔버스, 벽 위): 핀 꽂은 흰 종이 · 막대 그래프와 진화 도식."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(2, 2)
    for x0 in (3, 17):
        f.r(x0, 7, x0 + 11, 21, w[2]); f.r(x0, 21, x0 + 11, 21, w[0]); f.p(x0 + 5, 6, P["i2_red"][1]); f.p(x0 + 6, 6, P["i2_red"][1])
    for k, h in enumerate((6, 9, 4, 11)):
        f.r(5 + k * 2, 19 - h, 5 + k * 2, 19, P[GOODS[k]][1])
    for k, y in enumerate((10, 15)):
        f.r(19, y, 21, y + 2, P["i2_green"][1]); f.r(24, y, 26, y + 2, P["i2_blue"][1]); f.r(22, y + 1, 23, y + 1, g[1])
    return f.done(P, shadow=False)


def lab_chair(P):
    """연구원 의자(1×1, 위쪽 책상을 향해 앉는다): 앉는 판은 위에 조금만 보이고, 가까운 쪽(아래)에 초록 등받이가 판을 가린다 · 바퀴 다리."""
    gr, g = P["i2_green"], P["i2_gray"]
    f = F(1, 1)
    f.r(3, 1, 12, 3, gr[2]); f.r(3, 1, 12, 1, P["i2_white"][2])                  # 앉는 판(먼 쪽)
    f.r(2, 4, 13, 10, gr[1]); f.r(2, 4, 13, 4, gr[2]); f.r(2, 10, 13, 10, gr[0])  # 등받이(가까운 쪽)
    f.r(7, 11, 8, 12, g[0]); f.r(3, 13, 12, 13, g[1]); f.p(3, 14, g[0]); f.p(12, 14, g[0])
    return f.done(P, floor_y=0, sx=1, sy=1)


# ==== 트레이너 학교 ============================================================================
def sc_board(P):
    """칠판(3×2 캔버스, 벽 위): 나무 테 · 짙은 초록 판 · 분필 글씨(흰·노랑 짧은 줄) · 분필 받침."""
    wd, bd, w = P["i2_wood"], P["rm_board"], P["i2_white"]
    f = F(3, 2)
    f.r(1, 4, 46, 25, wd[1]); f.r(1, 4, 46, 4, wd[2])
    f.r(3, 6, 44, 23, bd[1]); f.r(3, 6, 44, 6, bd[2]); f.r(3, 23, 44, 23, bd[0])
    for x0, y, ln, c in ((6, 9, 9, w[1]), (17, 9, 5, w[1]), (6, 13, 13, w[1]), (6, 17, 7, P["i2_yellow"][2]), (26, 11, 6, w[1]), (34, 9, 7, w[1]), (26, 16, 14, w[1])):
        f.r(x0, y, x0 + ln, y, c)
    f.ell(37, 16, 3, 3, w[1]); f.ell(37, 16, 1.6, 1.6, bd[1])                 # 몬스터볼 그림
    f.r(34, 16, 40, 16, w[1])
    f.r(4, 26, 43, 27, wd[0]); f.r(8, 25, 10, 25, w[2]); f.r(30, 25, 31, 25, P["i2_yellow"][2])
    return f.done(P, shadow=False)


def sc_lectern(P):
    """교탁(3×2, 원작 학교의 밝은 탁자): 연노랑 윗판(펼친 책·출석부) · 나무 앞 테 · 다리 넷이 보인다(3/4로 바닥에 선다)."""
    y_, wd, w = P["i2_yellow"], P["i2_wood"], P["i2_white"]
    f = F(3, 2)
    f.r(1, 4, 44, 17, y_[2]); f.r(1, 15, 44, 17, y_[1])
    f.r(6, 6, 15, 12, w[2]); f.r(10, 6, 11, 12, w[1])                           # 펼친 책(가운데 접힌 자리)
    for y in (8, 10):
        f.r(7, y, 8, y, P["i2_gray"][1]); f.r(13, y, 14, y, P["i2_gray"][1])
    f.r(30, 7, 37, 12, P["i2_blue"][1]); f.r(30, 7, 37, 7, P["i2_blue"][2])
    f.r(1, 18, 44, 21, wd[1]); f.r(1, 18, 44, 18, wd[2])
    for x in (2, 41):
        f.r(x, 22, x + 2, 29, wd[1]); f.r(x, 22, x, 29, wd[2])
    for x in (8, 35):
        f.r(x, 22, x + 1, 26, wd[0])                                              # 뒷다리(짧게, 그늘)
    return f.done(P, floor_y=0)


def sc_dais(P):
    """교단(5×1, 칠판 밑 바닥 줄 — 막힘, 원작 루스트보로 학교): 나무 윗면 9px(같은 주황 판, 저대비 가는 결 네 줄 · 위 빛 줄) ·
    앞면 6px(밝은 1 · 중간 3 · 그늘 1, 외곽선) · 양 끝 1px 단면 — 바닥보다 한 단 높은 단으로 읽힌다."""
    o, wd = P["i2_orange"], P["i2_wood"]
    f = F(5, 1)
    f.r(0, 0, 79, 8, o[1]); f.r(0, 0, 79, 0, o[2])
    for x0, x1, y in ((4, 30, 2), (38, 72, 2), (14, 50, 4), (58, 76, 4), (2, 22, 6), (30, 64, 6)):
        f.r(x0, y, x1, y, o[2])
    f.r(0, 9, 79, 9, wd[2]); f.r(0, 10, 79, 13, wd[1]); f.r(0, 14, 79, 14, wd[0])
    f.r(0, 1, 0, 14, wd[0]); f.r(79, 1, 79, 14, wd[0])
    return f.done(P, shadow=False)


def sc_clock(P):
    """벽시계(1×1 캔버스, 벽 위 — 천장 띠 아래): 흰 판 · 테 · 시곗바늘 둘."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(1, 1)
    f.ell(8, 9.5, 5.2, 5.2, g[0]); f.ell(8, 9.5, 4.2, 4.2, w[2])
    f.r(8, 6, 8, 9, P["i2_ol"][0]); f.r(8, 9, 10, 9, P["i2_red"][1])
    for x, y in ((8, 5), (12, 9), (8, 14), (4, 9)):
        f.p(x, y, g[1])
    return f.done(P, shadow=False)


def sc_desk(P):
    """학생 책상(1×2): 위 칸 책상(노란 상판·나무 앞) · 아래 칸 의자(앉는 면·뒤에서 본 등받이). 학생은 칠판을 본다."""
    y_, wd = P["i2_yellow"], P["i2_wood"]
    f = F(1, 2)
    f.r(1, 3, 13, 9, y_[1]); f.r(1, 3, 13, 3, y_[2]); f.r(2, 5, 12, 5, y_[2])
    f.r(1, 10, 13, 13, wd[1]); f.r(1, 10, 13, 10, wd[2])
    f.r(2, 14, 3, 16, wd[0]); f.r(11, 14, 12, 16, wd[0])
    f.r(3, 18, 11, 21, wd[2]); f.r(3, 18, 11, 18, P["i2_yellow"][2])        # 앉는 면
    f.r(2, 22, 12, 25, wd[1]); f.r(2, 22, 12, 22, wd[2])                     # 등받이(보는 쪽)
    f.r(3, 26, 4, 28, wd[0]); f.r(10, 26, 11, 28, wd[0])
    return f.done(P, floor_y=0, sx=1, sy=2)


def sc_bulletin(P):
    """게시판(2×2 캔버스, 벽 위): 코르크 판 · 나무 테 · 핀 꽂은 종이 넷."""
    ck, wd, w = P["rm_cork"], P["i2_wood"], P["i2_white"]
    f = F(2, 2)
    f.r(2, 5, 29, 22, wd[1]); f.r(4, 7, 27, 20, ck[1]); f.r(4, 7, 27, 7, ck[0])
    for k, (x, y, ww, hh) in enumerate(((6, 9, 6, 7), (14, 10, 6, 5), (22, 9, 4, 8), (8, 17, 9, 2))):
        f.r(x, y, x + ww - 1, y + hh - 1, w[2] if k != 2 else P["i2_yellow"][2]); f.p(x + ww // 2, y, P[GOODS[k]][1])
    f.r(15, 12, 18, 12, P["i2_gray"][1])
    return f.done(P, shadow=False)


def sc_window(P):
    """학교 창(2×2 캔버스, 벽 위): 흰 틀 · 하늘 유리 네 쪽 · 사선 반사 · 초록 창턱."""
    w, gl = P["i2_white"], P["i2_glass"]
    f = F(2, 2)
    f.r(3, 4, 28, 22, w[2]); f.r(5, 6, 26, 20, gl[1]); f.r(15, 6, 16, 20, w[2]); f.r(5, 13, 26, 13, w[2])
    f.line(7, 12, 11, 7, gl[2]); f.line(18, 19, 22, 15, gl[2]); f.r(5, 6, 26, 6, gl[0])
    f.r(2, 23, 29, 24, P["rm_s_band"][1]); f.r(2, 23, 29, 23, P["rm_s_band"][2])
    return f.done(P, shadow=False)


# ==== 박물관 ===================================================================================
def mu_tank(P):
    """수조(2×2, 뒷벽에 박힘): 강철 틀 · 물 유리(물고기 둘·거품) · 모래 바닥 · 받침 안내 판."""
    st, gl, sd = P["i2_steel"], P["i2_glass"], P["rm_cream"]
    f = F(2, 2)
    f.r(1, 3, 28, 24, st[1]); f.r(1, 3, 28, 3, st[2])
    f.r(3, 5, 26, 21, P["rm_mu_band"][2]); f.r(3, 5, 26, 7, gl[1])
    f.r(3, 18, 26, 21, sd[1]); f.r(3, 18, 26, 18, sd[2]); f.r(8, 19, 10, 20, P["i2_green"][0]); f.r(19, 17, 20, 20, P["i2_green"][1])
    for cx, cy, d in ((10, 11, 1), (19, 14, -1)):
        f.ell(cx, cy, 3, 1.7, P["rm_mu_band"][0]); f.p(cx + 3 * d, cy - 1, P["rm_mu_band"][0]); f.p(cx + 3 * d, cy + 1, P["rm_mu_band"][0])
    for x, y in ((22, 9), (23, 12), (14, 8)):
        f.p(x, y, gl[2])
    f.line(5, 16, 9, 8, gl[2])
    f.r(1, 25, 28, 29, st[0]); f.r(9, 26, 20, 28, P["rm_cream"][2])
    return f.done(P, floor_y=16)


def mu_case(P, item: str):
    """유리 원통 진열장(1×2): 금색 받침 · 유리 원통(위 둥근 뚜껑·세로 반사) · 안에 전시물(조개·호박)."""
    gl, gd = P["i2_glass"], P["i2_gold"]
    f = F(1, 2)
    f.ell(7.5, 5, 6, 2.6, P["i2_white"][2]); f.r(2, 5, 13, 22, gl[1]); f.ell(7.5, 5, 4.5, 1.4, gl[2])
    f.r(3, 7, 3, 20, gl[2]); f.r(12, 7, 12, 20, gl[0])
    if item == "shell":
        f.ell(7.5, 16, 3.5, 2.6, P["i2_salmon"][1]); f.line(5, 17, 8, 14, P["i2_salmon"][0]); f.line(8, 17, 10, 14, P["i2_salmon"][0])
    else:
        f.ell(7.5, 15.5, 2.8, 3.4, P["i2_orange"][1]); f.ell(6.8, 14.5, 1.2, 1.4, P["i2_orange"][2])
    f.r(4, 19, 11, 20, P["rm_cream"][1])
    f.r(1, 23, 14, 27, gd[1]); f.r(1, 23, 14, 23, P["i2_yellow"][2]); f.r(1, 27, 14, 27, gd[0])
    return f.done(P, floor_y=16)


def mu_vitrine(P):
    """낮은 유리 진열대(2×2): 유리 윗면 아래 화석(뼈색) · 파란 몸체 · 받침 · 그림자."""
    gl, b, bn = P["i2_glass"], P["rm_mu_band"], P["rm_bone"]
    f = F(2, 2)
    f.r(1, 4, 28, 17, P["i2_white"][1]); f.r(3, 6, 26, 15, gl[1])
    for k in range(5):                                                         # 나선 화석
        f.ell(10 + k * 0.4, 11, 5 - k, 4 - k * 0.7, bn[2] if k % 2 == 0 else bn[1])
    f.r(17, 9, 23, 12, bn[1]); f.r(17, 9, 23, 9, bn[2])                       # 뼈 조각
    f.line(5, 14, 9, 7, gl[2]); f.line(19, 15, 24, 8, gl[2])
    f.r(1, 18, 28, 25, b[1]); f.r(1, 18, 28, 18, b[2]); f.r(1, 25, 28, 25, b[0])
    f.r(1, 26, 28, 27, P["i2_gray"][0])
    return f.done(P, floor_y=0)


def mu_ship(P):
    """배 모형 전시대(3×2): 크림 대 · 둥근 윗면 · 큰 흰 여객선(빨간 굴뚝 둘·남색 흘수선·창 두 줄·뾰족한 뱃머리) · 금 명패."""
    cr, w, b, r = P["rm_cream"], P["i2_white"], P["i2_blue"], P["i2_red"]
    ol = P["i2_ol"][0]
    f = F(3, 2)
    f.r(1, 9, 44, 19, cr[2]); f.r(1, 9, 44, 9, P["i2_white"][2])
    f.r(1, 20, 44, 26, cr[1]); f.r(1, 20, 44, 20, cr[2]); f.r(1, 26, 44, 26, cr[0])
    f.r(19, 22, 26, 24, P["i2_gold"][1]); f.r(20, 23, 25, 23, P["i2_gold"][0])
    for x in range(5, 41):                                                    # 선체: 뱃머리(오른쪽)가 뾰족, 고물은 둥글게
        top = 9
        bot = 16 - max(0, x - 35) // 1 if x > 35 else 16
        if x < 7:
            top += 7 - x
        f.r(x, top, x, max(top, bot), w[1])
        f.r(x, max(top, bot - 2), x, max(top, bot), b[0] if x <= 36 else w[1])
    f.r(5, 13, 36, 13, r[1])
    for x in range(8, 34, 3):
        f.p(x, 11, b[1])
    f.r(10, 5, 30, 8, w[2]); f.r(10, 5, 30, 5, w[1]); f.r(13, 2, 26, 4, w[1])
    for x in range(12, 29, 3):
        f.p(x, 7, b[1])
    for x0 in (15, 21):
        f.r(x0, -0 + 0, x0 + 3, 2, r[1]); f.r(x0, 0, x0 + 3, 0, ol)
    return f.done(P, floor_y=0)


def mu_fossil(P):
    """화석 진열대(2×2): 크림 받침 — 넓은 윗면(10px, 위 빛 줄) 위에 눕힌 흙빛 돌판 속 나선 조개 화석 · 돌판 위 유리 덮개 빛줄 · 앞면 금 명패."""
    cr, bn, g = P["rm_cream"], P["rm_bone"], P["i2_gray"]
    f = F(2, 2)
    f.r(1, 5, 28, 17, cr[2]); f.r(1, 5, 28, 5, P["i2_white"][2])               # 넓은 윗면
    f.r(1, 18, 28, 27, cr[1]); f.r(1, 18, 28, 18, cr[2]); f.r(1, 27, 28, 27, cr[0])   # 앞면
    f.r(11, 21, 18, 23, P["i2_gold"][1]); f.r(12, 22, 17, 22, P["i2_gold"][0])
    f.r(5, 7, 24, 15, bn[0]); f.r(5, 7, 24, 7, bn[1])                           # 눕힌 돌판
    cx, cy = 14.5, 11.0
    for y in range(7, 16):
        for x in range(6, 24):
            d = math.hypot((x + 0.5 - cx) / 1.25, y + 0.5 - cy)                  # 눕혀서 가로로 긴 나선
            if d > 3.8:
                continue
            a = math.atan2(y + 0.5 - cy, (x + 0.5 - cx) / 1.25)
            turn = (d - 0.8 * (a + math.pi)) % 1.8
            f.p(x, y, g[0] if turn < 0.5 else bn[2] if (y + 0.5 < cy and turn > 1.2) else bn[1])
    f.line(7, 14, 10, 8, P["i2_glass"][2]); f.line(19, 14, 22, 8, P["i2_glass"][2])   # 유리 덮개 빛
    return f.done(P, floor_y=0)


def mu_rope(P, part: str):
    """줄 차단봉(1×1): 금 기둥(받침 둥근) + 붉은 벨벳 줄(처져 있다). part: l(오른쪽으로 줄) · m(양쪽) · r(왼쪽으로)."""
    gd, rp = P["i2_gold"], P["rm_rope"]
    f = F(1, 1)
    def post(x):
        f.r(x, 3, x + 1, 12, gd[1]); f.p(x, 3, P["i2_yellow"][2]); f.ell(x + 1, 2.5, 1.6, 1.4, gd[1]); f.r(x - 1, 12, x + 2, 13, gd[0])
    if part in ("l", "m"):
        for x in range(8 if part == "l" else 0, 16):
            f.p(x, 5 + round(1.4 * math.sin(math.pi * ((x - (8 if part == "l" else 0)) % 16) / 16)), rp[1])
    if part in ("r", "m"):
        for x in range(0, 8):
            f.p(x, 5 + round(1.4 * math.sin(math.pi * (x + 8) / 16)), rp[1])
    post(7)
    return f.done(P, floor_y=0, sx=1, sy=1)


def mu_sign(P):
    """안내판(1×1, 서 있다): 남색 판 · 흰 글줄 · 금 기둥 · 받침."""
    b, w = P["rm_mu_band"], P["i2_white"]
    f = F(1, 1)
    f.r(1, 1, 13, 8, b[1]); f.r(1, 1, 13, 1, b[2])
    for y in (3, 5):
        f.r(3, y, 11 - (y == 5) * 3, y, w[2])
    f.r(6, 9, 7, 12, P["i2_gold"][1]); f.r(3, 12, 10, 13, P["i2_gold"][0])
    return f.done(P, floor_y=0, sx=1, sy=1)


def mu_udesk(P):
    """∩자 접수대(3×3, 원작 해양 박물관 입구 양옆): 크림 윗판(위 가로 판 + 양 다리, 모서리 둥글게) · 판 위 팸플릿 · 가로 판 앞면(주황 줄) ·
    다리 끝 앞면과 금 받침. 안쪽 1×2 는 빈 칸(접수원 자리)."""
    cr, gd = P["rm_cream"], P["i2_gold"]
    f = F(3, 3)
    for y in range(2, 45):
        for x in range(1, 47):
            leg = x <= 14 or x >= 33
            if not leg and y > 17:
                continue
            cut = (y < 5 and (x < 4 - (y - 2) or x > 43 + (y - 2))) or (leg and y > 41 and (x < 1 + (y - 41) or (14 - (y - 41) < x < 33 + (y - 41)) or x > 46 - (y - 41)))
            if not cut:
                f.p(x, y, cr[2])
    f.r(4, 2, 43, 2, P["i2_white"][2])
    f.r(15, 12, 32, 17, P["rm_mu_face"][1]); f.r(15, 12, 32, 13, P["rm_mu_face"][2]); f.r(15, 16, 32, 17, P["rm_mu_face"][0])   # 가로 판 앞면(황토 2톤 6px, 안쪽으로 보인다)
    for x0 in (1, 33):
        f.r(x0 + 1, 38, x0 + 12, 41, cr[1]); f.r(x0 + 2, 42, x0 + 11, 44, gd[1]); f.r(x0 + 2, 44, x0 + 11, 44, gd[0])   # 다리 끝 앞면 · 금 받침
    f.r(17, 5, 21, 9, P["rm_mu_band"][1]); f.r(23, 5, 26, 9, P["rm_mu_band"][1]); f.r(28, 6, 33, 8, P["i2_white"][2]); f.r(29, 7, 32, 7, P["i2_gray"][1])
    return f.done(P, floor_y=0)


def mu_stairs(P):
    """2층 계단 아치(2×2 캔버스, 뒷벽 — 입구 칸 (0,1)): 회색 돌 아치 틀 · 안쪽 어둠 · 위로 오르는 디딤(위로 갈수록 좁고 어둡다)."""
    g, w, vd = P["i2_gray"], P["i2_white"], P["i2_void"]
    f = F(2, 2)
    for y in range(4, 32):
        half = 14 if y > 9 else 14 - (9 - y) // 2
        f.r(16 - half, y, 15 + half, y, g[1])
    f.r(4, 4, 27, 4, g[2])
    for y in range(8, 32):
        half = 10 if y > 12 else 10 - (12 - y) // 2
        f.r(16 - half, y, 15 + half, y, vd[0])
    for k, y in enumerate(range(29, 13, -4)):                                # 디딤 넷: 아래가 밝고 넓다
        x0, x1 = 7 + k, 24 - k
        f.r(x0, y, x1, y + 1, (w[1], g[2], g[1], g[0])[k]); f.r(x0, y + 2, x1, y + 2, (g[1], g[0], g[0], vd[0])[k])
    f.r(2, 9, 2, 31, g[2]); f.r(29, 9, 29, 31, g[0])
    return f.done(P, shadow=False)


def mu_plaque(P):
    """벽 명판(1×1 캔버스, 벽 위)."""
    f = F(1, 1)
    f.r(2, 4, 13, 11, P["rm_mu_band"][0]); f.r(3, 5, 12, 10, P["i2_white"][2])
    f.r(4, 7, 11, 7, P["i2_gray"][1]); f.r(4, 9, 8, 9, P["i2_gray"][1])
    return f.done(P, shadow=False)


# ==== 백화점 ===================================================================================
def dp_elevator(P):
    """엘리베이터 문(2×2 캔버스, 뒷벽): 강철 문틀 · 빨간 문 두 짝(가운데 틈) · 위 오르내림 화살표."""
    st, r = P["i2_steel"], P["i2_red"]
    f = F(2, 2)
    f.r(2, 3, 29, 31, st[1]); f.r(2, 3, 29, 3, st[2])
    f.r(4, 9, 27, 31, r[1]); f.r(4, 9, 27, 9, r[2]); f.r(15, 9, 16, 31, r[0])
    f.r(7, 11, 7, 29, r[2]); f.r(24, 11, 24, 29, r[0])
    f.r(11, 4, 20, 7, P["i2_gray"][0])
    for k in range(3):
        f.r(13 - k, 5 + k, 13 + k, 5 + k, P["i2_yellow"][2] if k < 2 else P["i2_yellow"][1])
    f.r(17, 5, 19, 5, P["i2_gray"][1]); f.r(18, 6, 18, 6, P["i2_gray"][1])
    return f.done(P, shadow=False)


def dp_foot(P, kind: str):
    """승강 발판(2×1, 걷는다): 엘리베이터 문턱 · 에스컬레이터 빗살판. 이동 이벤트를 올릴 자리."""
    st = P["i2_steel"]
    f = F(2, 1)
    f.r(1, 0, 30, 9, st[1]); f.r(1, 0, 30, 0, st[2])
    if kind == "esc":
        for x in range(3, 29, 2):
            f.r(x, 2, x, 8, st[2])
        f.r(1, 9, 30, 9, P["i2_yellow"][1])
    else:
        f.r(3, 3, 28, 4, st[2]); f.r(3, 6, 28, 7, st[0])
    return f.done(P, shadow=False)


def dp_escalator(P):
    """에스컬레이터(2×2 캔버스, 뒷벽에 붙임 — 아래에 dp_escfoot 발판을 붙이면 2×3): 천장 끝 띠(y 0..2) 아래에서 시작 · 위층 어둠 · 강철 디딤판 · 초록 손잡이 벨트."""
    st, gr, ol = P["i2_steel"], P["i2_green"], P["i2_ol"][0]
    f = F(2, 2)
    f.r(5, 3, 26, 9, P["i2_void"][0])
    for k, y in enumerate(range(10, 31, 3)):
        f.r(5, y, 26, y + 2, st[1]); f.r(5, y, 26, y, st[2]); f.r(5, y + 2, 26, y + 2, st[0])
    for x0 in (0, 27):
        f.r(x0, 3, x0 + 4, 31, gr[1]); f.r(x0 + 1, 4, x0 + 3, 31, ol); f.r(x0 + 2, 4, x0 + 2, 31, gr[2])
        f.r(x0, 3, x0 + 4, 3, gr[2])
    return f.done(P, shadow=False)


def dp_floorsign(P, text: str):
    """층 표시 판(1×1 캔버스, 벽 위): 남색 판 · 흰 글자(1F·2F)."""
    f = F(1, 1)
    f.r(0, 4, 15, 12, P["i2_blue"][0]); f.r(1, 5, 14, 11, P["i2_blue"][1])
    _text(f, 4, 6, text, P["i2_white"][2])
    return f.done(P, shadow=False)


def dp_counter(P):
    """층 카운터(5×3, 원작 무지개시티 백화점 1층의 U자): 양 끝 다리가 뒷벽 쪽으로 꺾여 올라가고 아래 줄 가로 판이 잇는다.
    민트 윗면 · 흰 앞판 · 회색 받침. 왼쪽 다리 위 모니터, 오른쪽 다리 위 금전등록기, 가로 판 위 연어색 받침 둘. 안쪽 3×2 는 빈 칸(점원 자리)."""
    m, w, g, sal = P["rm_mint"], P["i2_white"], P["i2_gray"], P["i2_salmon"]
    f = F(5, 3)
    for x0, x1 in ((1, 14), (65, 78)):                                         # 다리
        f.r(x0, 2, x1, 38, m[1]); f.r(x0, 2, x1, 2, m[2]); f.r(x0, 2, x0, 38, m[2])
    f.r(15, 32, 64, 38, m[1]); f.r(15, 32, 64, 32, m[2]); f.r(15, 38, 64, 38, m[0])   # 가로 판 윗면
    f.r(1, 39, 78, 45, w[1]); f.r(1, 39, 78, 39, w[2])                         # 앞판
    for x0 in (4, 20, 36, 52, 66):
        f.r(x0, 41, x0 + 9, 43, w[0])
    f.r(1, 46, 78, 47, g[0])
    f.r(15, 3, 15, 31, m[0]); f.r(64, 3, 64, 31, m[0])                         # 다리 안쪽 옆면(그늘)
    f.r(3, 6, 12, 14, P["i2_gray"][1]); f.r(4, 7, 11, 12, P["i2_glass"][0]); f.r(5, 8, 10, 11, P["i2_glass"][1]); f.r(6, 15, 9, 16, g[1])   # 모니터
    f.r(67, 10, 76, 20, P["i2_steel"][1]); f.r(67, 10, 76, 11, P["i2_steel"][2]); f.r(69, 13, 74, 15, P["i2_green"][1]); f.r(68, 18, 75, 19, P["i2_steel"][0])  # 금전등록기
    for x0 in (24, 45):
        f.r(x0, 34, x0 + 10, 36, sal[1]); f.r(x0, 34, x0 + 10, 34, sal[2])
    return f.done(P, floor_y=0)


def dp_shelf(P):
    """키 큰 양면 진열장(2×2): 흰 윗판 · 유리 옆판 · 선반 세 단에 인형·상품."""
    w, g, gl = P["i2_white"], P["i2_gray"], P["i2_glass"]
    f = F(2, 2)
    f.r(0, 0, 29, 3, w[2]); f.r(0, 4, 29, 27, g[1]); f.r(2, 5, 27, 26, w[1])
    for k, y in enumerate((11, 18, 25)):
        f.r(2, y, 27, y, g[0])
        for j, x in enumerate(range(4, 25, 5)):
            r = P[GOODS[(j + k) % 4]]
            f.r(x, y - 5, x + 2, y - 1, r[1]); f.p(x, y - 5, r[2]); f.r(x + 2, y - 4, x + 2, y - 1, r[0])
    f.r(0, 4, 1, 27, gl[1]); f.r(28, 4, 29, 27, gl[0])
    return f.done(P, floor_y=0)


def dp_showcase(P):
    """낮은 유리 진열대(3×2): 유리 윗면 · 안에 상품 줄 · 하늘색 앞 띠 · 받침."""
    gl, w = P["i2_glass"], P["i2_white"]
    f = F(3, 2)
    f.r(1, 5, 44, 17, w[1]); f.r(3, 7, 42, 15, gl[1]); f.r(3, 7, 42, 7, gl[2])
    i2._goods(f, P, 5, 9, 40, 14, 3, 3, seed=1)
    for x in (8, 22, 34):
        f.line(x, 15, x + 4, 8, gl[2])
    f.r(1, 18, 44, 24, gl[0]); f.r(1, 18, 44, 18, gl[1]); f.r(1, 24, 44, 24, P["i2_blue"][0])
    f.r(1, 25, 44, 26, P["i2_gray"][0])
    return f.done(P, floor_y=0)


def dp_rack(P):
    """옷걸이 진열대(2×2): 강철 봉 · 옷걸이 고리 · 걸린 옷 다섯(어깨 둥근 곡선 · 소매 · 아래 끝 길이가 들쭉날쭉) · 둥근 받침 둘."""
    st = P["i2_steel"]
    f = F(2, 2)
    f.r(2, 3, 27, 4, st[2]); f.r(2, 5, 27, 5, st[0])
    f.r(2, 3, 3, 24, st[1]); f.r(26, 3, 27, 24, st[1])
    for k, x in enumerate(range(5, 24, 4)):
        r = P[("i2_red", "i2_blue", "i2_yellow", "i2_green", "i2_salmon")[k]]
        bot = (19, 16, 21, 17, 20)[k]
        f.p(x + 1, 6, st[0]); f.p(x + 2, 6, st[0])                                  # 고리
        f.r(x, 8, x + 3, bot, r[1]); f.r(x + 1, 7, x + 2, 7, r[1])                  # 어깨 곡선(가운데가 높다)
        f.p(x, 8, r[2]); f.p(x + 1, 7, r[2]); f.r(x + 3, 9, x + 3, bot, r[0])
        f.r(x, bot, x + 3, bot, r[0])
    f.r(0, 24, 6, 26, st[0]); f.r(23, 24, 29, 26, st[0])
    return f.done(P, floor_y=0)


def dp_directory(P):
    """층 안내판(1×2, 서 있다): 남색 판 · 층 번호 넷 · 색 띠 · 강철 기둥 받침."""
    b, w = P["i2_blue"], P["i2_white"]
    f = F(1, 2)
    f.r(1, 1, 14, 22, b[0]); f.r(2, 2, 13, 21, b[1]); f.r(2, 2, 13, 2, b[2])
    for k, y in enumerate((4, 10, 16)):
        _text(f, 3, y, "321"[k], w[2])
        f.r(8, y + 1, 12, y + 3, P[GOODS[k]][1]); f.r(8, y + 1, 12, y + 1, P[GOODS[k]][2])
    f.r(6, 23, 9, 26, P["i2_steel"][1]); f.r(3, 27, 12, 28, P["i2_steel"][0])
    return f.done(P, floor_y=16)


# ==== 배 =======================================================================================
def sh_door(P):
    """선실 문(1×2 캔버스, 뒷벽 — 천장 띠 아래 y4 부터): 나무 문 · 위 금 방 번호 판 · 작은 둥근 창 · 금 손잡이."""
    wd, gd, gl = P["i2_wood"], P["i2_gold"], P["i2_glass"]
    f = F(1, 2)
    f.r(1, 4, 14, 31, wd[0]); f.r(2, 5, 13, 31, wd[1]); f.r(2, 5, 13, 5, wd[2])
    f.r(5, 7, 10, 8, gd[1]); f.r(6, 7, 9, 7, gd[0])
    f.ell(7.5, 14, 3.4, 3.4, gd[1]); f.ell(7.5, 14, 2.2, 2.2, gl[1]); f.p(6, 13, gl[2])
    f.r(3, 20, 12, 20, wd[2]); f.r(3, 26, 12, 26, wd[2])
    f.r(11, 22, 12, 23, gd[1])
    return f.done(P, shadow=False)


def sh_porthole(P):
    """현창(1×2 캔버스, 벽 위 — 벽면 가운데에 걸린다): 놋쇠 둥근 테 · 바다빛 유리 · 반사 두 점 · 나사 넷."""
    gd, gl = P["i2_gold"], P["i2_glass"]
    f = F(1, 2)
    cy = 14
    f.ell(8, cy, 6.2, 6.2, gd[0]); f.ell(8, cy, 5.2, 5.2, gd[1]); f.ell(8, cy, 3.8, 3.8, P["sea"][2]); f.ell(8, cy - 1, 3, 2.4, gl[1])
    f.p(6, cy - 2, gl[2]); f.p(7, cy - 3, gl[2])
    for x, y in ((8, cy - 6), (8, cy + 5), (2, cy), (13, cy)):
        f.p(x, y, P["i2_yellow"][2])
    return f.done(P, shadow=False)


def sh_stairs(P):
    """배 안 계단(2×3, 위 줄은 뒷벽 칸에 걸친다, 본 시트 센터 계단처럼 촘촘한 단): 아래층으로 내려가는 회색 철 계단 —
    단 간격 4px(밝은 디딤 앞 끝 1px · 디딤 2px · 챌판 그늘 1px), 아래가 밝고 위로 갈수록 어두워 맨 위는 아래층 어둠 · 양옆 흰 철 난간."""
    w, g, vd, st = P["i2_white"], P["i2_gray"], P["i2_void"], P["i2_steel"]
    f = F(2, 3)
    f.r(4, 4, 27, 7, vd[0])
    steps = list(range(45, 8, -4))                                             # 단 아홉~열
    for k, y in enumerate(steps):
        lit = (w[2], w[1], g[2], g[2], g[1], g[1], st[0], g[0], g[0], vd[0])[min(k, 9)]
        mid = (w[1], g[2], g[2], g[1], g[1], st[0], g[0], g[0], vd[0], vd[0])[min(k, 9)]
        shd = (g[1], g[1], g[0], g[0], st[0], vd[0], vd[0], vd[0], vd[0], vd[0])[min(k, 9)]
        f.r(4, y - 3, 27, y - 3, lit); f.r(4, y - 2, 27, y - 1, mid); f.r(4, y, 27, y, shd)
    f.r(4, 8, 5, 45, P["i2_ol"][0])                                            # 왼쪽 난간 밑 그늘
    for x0 in (1, 28):
        f.r(x0, 4, x0 + 2, 46, w[1]); f.r(x0, 4, x0, 46, w[2]); f.r(x0 + 2, 4, x0 + 2, 46, w[0])
        f.r(x0, 4, x0 + 2, 5, w[2])
    return f.done(P, floor_y=16)


def sh_bench(P):
    """복도 벤치(2×1, 벽 밑에 붙인다): 남색 천 등받이(위) · 앉는 판(밝은 앞 끝) · 짧은 강철 다리."""
    b, st = P["i2_blue"], P["i2_steel"]
    f = F(2, 1)
    f.r(2, 1, 29, 5, b[0]); f.r(2, 1, 29, 1, b[1])
    f.r(1, 6, 30, 10, b[1]); f.r(1, 6, 30, 6, b[2]); f.r(1, 10, 30, 10, b[0])
    f.r(3, 11, 4, 14, st[0]); f.r(27, 11, 28, 14, st[0])
    return f.done(P, floor_y=0, sx=1, sy=1)


def sh_extinguisher(P):
    """소화기(1×1, 벽 밑): 빨간 몸통(왼쪽 빛) · 검은 손잡이 · 호스 · 받침 그늘."""
    r, ol = P["i2_red"], P["i2_ol"][0]
    f = F(1, 1)
    f.r(5, 5, 10, 14, r[1]); f.r(5, 5, 6, 14, r[2]); f.r(10, 6, 10, 14, r[0])
    f.r(6, 2, 9, 4, ol); f.r(7, 1, 10, 1, ol); f.r(11, 5, 11, 10, ol)
    return f.done(P, floor_y=0, sx=1, sy=1)


def sh_lifering(P):
    """구명튜브(1×1, 난간에 건다): 해안 정본 `coast.swimring`(빨강·흰 네 쪽 고리)에서 바닥 그림자만 걷어 낸다 — 걸린 고리라 그림자가 없다."""
    return _no_shadow(coast.swimring(P))


def sh_lifering_wall(P):
    """구명튜브(1×2 캔버스, 벽면 가운데에 건다): 같은 정본 고리를 6px 내려 벽면 가운데에 둔다."""
    im = px.new(T, 2 * T)
    im.paste(_no_shadow(coast.swimring(P)), (0, 6))
    return im


def _no_shadow(im):
    """반투명 그림자(알파 < 255) 픽셀을 지운다 — 바닥에 놓인 정본 소품을 벽·난간에 걸 때."""
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            if 0 < im.getpixel((x, y))[3] < 255:
                im.putpixel((x, y), (0, 0, 0, 0))
    return im


def sh_bed(P):
    """선실 침대(2×2, 머리판을 뒷벽에 — 3/4로 선다): 폭 전체 나무 머리판(위 빛 줄) · 흰 베개 · 연두 이불(접은 흰 시트) · 나무 옆틀 ·
    이불 앞면(진한 녹색) · 나무 발판 · 짧은 다리 둘."""
    wd, w, gr = P["i2_wood"], P["i2_white"], P["i2_green"]
    f = F(2, 2)
    f.r(1, 0, 28, 6, wd[1]); f.r(1, 0, 28, 0, wd[2]); f.r(1, 6, 28, 6, wd[0]); f.r(3, 2, 26, 2, wd[2])
    f.r(1, 7, 2, 25, wd[1]); f.r(27, 7, 28, 25, wd[0]); f.p(1, 7, wd[2])
    f.r(3, 7, 26, 23, gr[2]); f.r(5, 8, 24, 12, w[2]); f.r(5, 12, 24, 12, w[0])
    f.r(3, 14, 26, 15, w[1]); f.r(3, 16, 26, 22, gr[1]); f.r(3, 16, 26, 16, gr[2])
    f.r(3, 23, 26, 25, gr[0])                                                  # 이불 앞면
    f.r(1, 26, 28, 28, wd[1]); f.r(1, 26, 28, 26, wd[2])                       # 발판
    f.r(2, 29, 4, 31, wd[0]); f.r(25, 29, 27, 31, wd[0])                       # 다리
    return f.done(P, floor_y=0)


def sh_bin(P):
    """선실 휴지통(1×1, 원작 타이달호): 흰 원통(왼쪽 밝게 · 오른쪽 어둡게 3톤) · 파란 띠 · 위 타원 입구가 열려 있다(밝은 테 · 안쪽 깊은 어둠 · 앞 안벽 한 톤)."""
    w, g, b, vd = P["i2_white"], P["i2_gray"], P["i2_blue"], P["i2_void"]
    f = F(1, 1)
    f.r(4, 5, 11, 13, w[1]); f.r(4, 5, 5, 13, w[2]); f.r(10, 5, 11, 13, w[0])
    f.r(4, 9, 11, 10, b[1]); f.r(4, 9, 5, 10, b[2])
    f.ell(7.5, 4.5, 4.2, 2.4, w[2]); f.ell(7.5, 4.3, 3.2, 1.6, vd[0]); f.r(5, 5, 10, 5, g[0])
    return f.done(P, floor_y=0, sx=1, sy=2)


def sh_table(P):
    """선실 탁자(2×2): 팔각 연두 윗판 · 흰 테 · 다리 둘."""
    gr, w = P["i2_green"], P["i2_white"]
    f = F(2, 2)
    for y in range(4, 20):
        cut = max(0, 7 - y) + max(0, y - 16)
        f.r(2 + cut, y, 27 - cut, y, w[1])
        if 5 <= y <= 18:
            c2 = max(0, 8 - y) + max(0, y - 15)
            f.r(4 + c2, y, 25 - c2, y, gr[2] if y < 8 else gr[1])
    f.r(4, 20, 25, 21, w[0])
    f.r(6, 22, 7, 26, P["i2_gray"][0]); f.r(22, 22, 23, 26, P["i2_gray"][0])
    return f.done(P, floor_y=0)


def sh_deckchair(P):
    """갑판 접이 의자(1×2): 해안 정본 `coast.deckchair`(선베드 — 비스듬한 등받이 살 넷 + 앉는 판 + 다리)를 그대로 부른다.
    같은 게임에서 바닷가 선베드와 배 갑판 의자는 같은 물체다."""
    return coast.deckchair(P)


def sh_roundtable(P):
    """갑판 둥근 탁자(1×1): 흰 원판 12×6(위 빛 · 아래 앞 끝 그늘) · 짧은 회색 기둥 · 넓은 회색 받침 원."""
    w, g = P["i2_white"], P["i2_gray"]
    f = F(1, 1)
    f.ell(7.5, 13, 5.2, 2.2, g[0]); f.ell(7.5, 12.6, 4.4, 1.6, g[1])             # 받침
    f.r(6, 8, 9, 12, g[1]); f.r(6, 8, 6, 12, g[2])                              # 기둥
    f.ell(7.5, 5.5, 6.6, 3.8, w[0]); f.ell(7.5, 5.0, 6.6, 3.4, w[1]); f.ell(6.5, 4.2, 4.0, 1.8, w[2])
    return f.done(P, floor_y=0, sx=1, sy=2)


def sh_vent(P):
    """갑판 통풍관(1×2, 여객선 갑판의 굽은 관 — 옆모습): 흰 곧은 관이 위에서 왼쪽으로 꺾여(굽은 등 · 왼쪽 위 빛)
    왼쪽 끝 입이 열린다(세로 타원: 흰 테 · 안쪽 빨강 · 깊은 어둠) · 아래 회색 받침."""
    w, r, vd = P["i2_white"], P["i2_red"], P["i2_void"]
    f = F(1, 2)
    f.r(8, 12, 12, 26, w[1]); f.r(8, 12, 8, 26, w[2]); f.r(12, 12, 12, 26, w[0])    # 곧은 관
    for y in range(2, 14):                                                         # 굽은 부분(사분 고리, 중심 (4,13))
        for x in range(3, 14):
            d = math.hypot(x + 0.5 - 4, y + 0.5 - 13)
            if 4.0 <= d <= 9.0 and x >= 4:
                f.p(x, y, w[2] if d > 7.6 and y < 8 else w[0] if d < 5.0 else w[1])
    f.ell(3.0, 6.5, 2.6, 4.6, w[0]); f.ell(3.0, 6.5, 1.9, 3.8, r[1]); f.ell(3.2, 6.7, 1.2, 2.6, r[0]); f.ell(3.4, 6.8, 0.6, 1.6, vd[0])   # 입
    f.r(5, 26, 14, 29, P["i2_gray"][1]); f.r(5, 26, 14, 26, P["i2_gray"][2])
    return f.done(P, floor_y=0)


def sh_bollard(P):
    """계류 기둥(1×1): 해안 정본 `coast.bollard` 를 그대로 부른다(항구 갓돌의 흰 버섯 계선주 — 원작은 항구와 배 갑판이 같은 말뚝을 쓴다)."""
    return coast.bollard(P)


def sh_barrel(P):
    """나무 통(1×1): 해안 정본 `coast.barrel` 을 그대로 부른다(옆모습 통 · 쇠 띠 둘 · 나무 최암 윤곽)."""
    return coast.barrel(P)


def lg_door(P):
    """봉인 문(3×2 캔버스, 뒷벽 가운데 — 천장 띠·주황 선 아래 y5 부터): 강철 아치 틀 · 아치 꼭대기 작은 주황 등 · 유리 두 짝 · 가운데 몬스터볼 문장."""
    st, gl, o = P["i2_steel"], P["i2_glass"], P["i2_orange"]
    f = F(3, 2)
    for y in range(5, 32):
        half = 18 if y > 11 else 18 - (11 - y) // 2
        f.r(23 - half, y, 24 + half, y, st[1])
    f.r(11, 5, 36, 5, st[2]); f.r(20, 6, 27, 8, o[1]); f.r(21, 6, 26, 6, o[2])
    f.r(11, 12, 36, 31, gl[0]); f.r(13, 14, 22, 31, gl[1]); f.r(25, 14, 34, 31, gl[1]); f.r(23, 12, 24, 31, st[0])
    f.line(14, 28, 19, 16, gl[2]); f.line(26, 28, 31, 16, gl[2])
    _ball(f, P, 24, 21.5, 4.6)
    return f.done(P, shadow=False)


def lg_lamp(P):
    """뒷벽 밑에 매달린 등(1×1, 벽 아래 칸에 얹는다 — 원작 사천왕 방처럼 칸마다 하나): 짧은 줄 · 하늘색 갓(위 좁고 아래 넓다, 폭 10px) · 흰 테 · 노란 불빛."""
    gl, w, ol = P["i2_glass"], P["i2_white"], P["i2_ol"][0]
    f = F(1, 1)
    f.r(7, 3, 8, 6, ol)
    for k, y in enumerate(range(7, 12)):
        f.r(6 - k, y, 9 + k, y, gl[2] if k < 2 else gl[1])
    f.r(2, 12, 13, 12, w[2])
    f.r(5, 13, 10, 14, P["i2_yellow"][2])
    return f.done(P, shadow=False)


# 얼음 덩이 씨앗(손으로 고른 좌표, 앞면 결 좌표계 x -7..37 · y 0..60): 각 점이 덩이 하나 — 가장 가까운 씨앗이 그 칸의 덩이다.
# 왼쪽 블록은 x 0..37, 오른쪽 블록은 x -7..30 창으로 보므로 두 블록의 덩이 배치가 다르다.
ICE_SEEDS = ((3, 5), (24, 9), (40, 22), (9, 29), (29, 35), (-6, 47), (16, 53), (36, 62), (-4, 14))
ICE_DEEP = {2, 3, 7}                # 한 톤 짙은 덩이(속이 두껍다)
ICE_FRACT = (((10, 2), (15, 11)), ((19, 17), (13, 22)), ((30, 26), (34, 33)), ((3, 38), (9, 43)), ((22, 46), (27, 55)), ((-3, 25), (2, 31)))   # 덩이 안 잔금(가장자리에서 들어온 끊긴 금)


def _ice_owner(x, y):
    j = 1 if (y // 3) % 4 == 1 else -1 if (y // 3) % 4 == 3 else 0     # 금이 자로 그은 선이 안 되게 3줄마다 1px 꺾는다
    xx, yy = x + j, y
    return min(range(len(ICE_SEEDS)), key=lambda i: (xx - ICE_SEEDS[i][0]) ** 2 + ((yy - ICE_SEEDS[i][1]) * 0.72) ** 2)


def _ice_tex(P, lx, ly):
    """얼음 방 옆 블록 결: 판 격자 없이 크기가 다른 얼음 덩이가 금(얼음 최암 1px)으로 갈라진다.
    덩이마다 왼쪽·위 가장자리 1px 는 밝고(빛 받는 두께), 오른쪽·아래 금 바로 앞 1px 는 그늘 — 덩이가 두께를 가진 깨진 면으로 선다.
    덩이 왼쪽 위 모서리는 빛 받는 빗면으로 한 톤 밝다. 셋에 하나는 한 톤 짙다. 반사는 덩이마다 1px 짧은 사선(/) 3px 하나, 잔금 셋이 덩이 속으로 끊겨 들어온다.
    색은 던전 얼음 동굴 램프(dg_icewall 중간 · dg_ice 4톤)를 그대로 쓴다 — 같은 게임의 얼음."""
    k = P["rm_blk_ice"]                                    # [금, 그늘, 바탕, 밝음, 반사]
    o = _ice_owner(lx, ly)
    if _ice_owner(lx + 1, ly) != o or _ice_owner(lx, ly + 1) != o:
        return k[0]
    deep = o in ICE_DEEP
    base, lit, shd = (k[1], k[2], k[0]) if deep else (k[2], k[3], k[1])
    for (ax, ay), (bx, by) in ICE_FRACT:
        n = max(abs(bx - ax), abs(by - ay))
        for t in range(n + 1):
            if t % 4 == 3:
                continue                                   # 끊긴 금
            if (round(ax + (bx - ax) * t / n), round(ay + (by - ay) * t / n)) == (lx, ly):
                return shd
    sx, sy = ICE_SEEDS[o]
    gx, gy = sx - 3, sy - 2                                # 반사: 씨앗 왼쪽 위에서 / 방향 3px
    if (lx, ly) in ((gx, gy), (gx - 1, gy + 1), (gx - 2, gy + 2)):
        return k[4]
    if _ice_owner(lx + 2, ly) != o or _ice_owner(lx, ly + 2) != o:
        return shd
    if _ice_owner(lx - 1, ly) != o or _ice_owner(lx, ly - 1) != o:
        return lit
    if (lx - sx) + (ly - sy) * 0.6 < -7:                  # 덩이 왼쪽 위 빗면(빛 받는 깨진 면)
        return lit
    return base


def _side_tex(P, th, lx, ly):
    """옆벽 블록 앞면 결(원작에서 잰 것):
    ghost — 이끼 낀 돌 벽돌 테두리 속에 남보라 어둠의 감실(굴)이 뚫린다(원작 피비 블록) · ice — 금으로 갈라진 얼음 덩이(_ice_tex) ·
    dragon — 반 칸씩 엇갈려 겹친 비늘(주황 곡선 테) 사이로 회색 가시가 솟는다(선반선 없음) · dark — 길이·시작이 제각각인 노랑·연두·흰 가로줄(밤 빌딩 창)."""
    k = P[f"rm_blk_{th}"]
    if th == "ghost":
        t = P["rm_lg_ghost"]
        row_ = ly // 7
        jag = (0, 1, 2, 1, 0, 2, 1)[row_ % 7]                                  # 돌 단위로 들쭉날쭉 파고든 굴 가장자리
        ax0, ax1, ay0, ay1 = 7 + jag, 24 - (2 - jag), 12, 56
        arch = ay0 + 7 - int(7 * (1 - ((lx - (ax0 + ax1) / 2) / ((ax1 - ax0) / 2)) ** 2) ** 0.5) if ax0 <= lx <= ax1 else 99
        arch += (lx // 3) % 2                                                  # 아치 윤곽도 돌 하나씩 1px 들쭉날쭉
        if ax0 <= lx <= ax1 and arch <= ly <= ay1:
            depth = min(lx - ax0, ax1 - lx, ly - arch)
            if depth == 0:
                return k[0]
            return t[0] if depth <= 3 else P["rm_blk_ghost"][0]               # 2톤 어둠(가운데가 더 어둡다, 반사 없음)
        row = ly // 7
        bx = (lx + (5 if row % 2 else 0)) % 11
        if ly % 7 == 6 or bx == 10:
            return k[0]
        if ly % 7 <= 1 and ((lx * 7 + row * 23 + (row * row) % 7) % 13) < 6:   # 이끼 덩이 자리를 줄마다 엇갈린다
            return k[3] if ly % 7 == 0 else k[4]                              # 이끼(벽돌 윗면에 덩이)
        return k[2] if ly % 7 == 0 else k[1]
    if th == "ice":
        return _ice_tex(P, lx, ly)
    if th == "dragon":
        row = ly // 9
        cx = (lx + (6 if row % 2 else 0)) % 12
        yy = ly % 9
        dx = cx + 0.5 - 6
        hw = (yy + 1) * 2.6 / 9                                               # 가시(좁은 원뿔, 비늘 사이로 솟는다)
        if abs(dx) <= hw and yy <= 7:
            return k[3] if dx < 0 else k[2]
        dist = ((dx / 6.0) ** 2 + ((yy - 9) / 8.0) ** 2) ** 0.5               # 비늘(아래로 둥근 반원 — 다음 줄 비늘에 겹친다)
        if 0.82 <= dist <= 1.0:
            return k[4]                                                        # 주황 곡선 테
        if dist < 0.82:
            return k[1] if dx > 0 else k[2]
        return k[0]
    # dark: 밤 빌딩 창 — 3px 줄마다 길이·시작이 다른 밝은 토막
    if ly % 3 != 0:
        return k[0] if ly % 3 == 2 else k[1]
    r = ly // 3
    seg = (lx + r * 7 + (r * r) % 5) % (9 + r % 4)
    if seg < 3 + (r * 3) % 4:
        h = (lx // 6 + r) % 7
        return P["i2_white"][2] if h == 0 else P["i2_green"][2] if h == 3 else k[3] if h == 5 else k[2]
    return k[1]


DARKER: dict = {}


def _darker_map(P):
    """빗면용 한 톤 어둡게: 같은 램프 안에서 한 칸 아래 색(새 색을 만들지 않는다)."""
    for th in ("ghost", "ice", "dragon", "dark"):
        k = P[f"rm_blk_{th}"]
        m = {k[1]: k[0], k[2]: k[1], k[3]: k[2], k[4]: k[4] if th == "dragon" else k[3] if th == "ice" else k[0]}   # 드래곤은 비늘 주황 테를 빗면에도 남긴다
        if th == "ghost":
            m.update({P["rm_lg_ghost"][0]: k[0]})
        m.update({P["i2_white"][2]: k[2], P["i2_green"][2]: k[1]})
        DARKER[th] = m


def lg_side(P, th: str, side: str):
    """옆벽 테마 블록(3×5, 원작 사천왕 방 좌우 팔각 블록): 옆벽에 붙고 방 쪽 모서리 위·아래를 8px 깎는다.
    윗면 띠(테마 윗면 램프 3톤, 위 빛 줄) · 앞면 결(_side_tex) · 방 쪽 빗면(밝은 세로 띠) · 받침. side l = 왼쪽 벽, r = 오른쪽 벽."""
    tp, kb = P[f"rm_blk_{th}_top"], P[f"rm_blk_{th}"]
    if not DARKER:
        _darker_map(P)
    f = F(3, 5)
    xa, xb = (0, 37) if side == "l" else (10, 47)
    for Y in range(2, 78):
        for X in range(xa, xb + 1):
            inner = xb - X if side == "l" else X - xa                          # 방 쪽 끝에서 거리
            if inner < 8 - (Y - 2) or inner < 8 - (77 - Y):
                continue
            if Y <= 3:
                c = tp[2]
            elif Y <= 9:
                c = tp[1]
            elif Y <= 12:
                c = tp[0]
            elif Y >= 74:
                c = kb[0]
            elif inner <= 6:                                                    # 방 쪽 빗면: 앞면 결을 한 톤 어둡게 감아 돌고, 윗모서리에 2px 흰 사선
                if inner == 0 or inner == 6:
                    c = kb[0]
                elif 0 <= (Y - 13) - (6 - inner) <= 1:
                    c = P["i2_white"][2]
                else:
                    per = {"ghost": 7, "ice": 1, "dragon": 9, "dark": 3}[th]
                    bx = (X - xa if side == "l" else X - xa - 7) if th == "ice" else (30 + inner) % 30   # 얼음은 앞면 덩이가 빗면으로 이어진다
                    q = _side_tex(P, th, bx, Y - 13 + (per - 61 % per) % per)
                    c = DARKER.get(th, {}).get(q, q)
            else:
                lx = X - xa if side == "l" else X - xa - 7
                per = {"ghost": 7, "ice": 1, "dragon": 9, "dark": 3}[th]
                c = _side_tex(P, th, lx, Y - 13 + (per - 61 % per) % per)       # 맨 아래 줄이 온전하게(잘린 줄은 위 띠 밑에)
            f.p(X, Y, c)
    return f.done(P, floor_y=0)


FURN = {
    # 이름: (함수, 종류) — prop=막힘 · decor=걷는다 · wallart=벽 위 장식(벽 칸이라 막힘)
    "lab_server": (lab_server, "prop"), "lab_machine": (lab_machine, "prop"), "lab_desk": (lab_desk, "prop"),
    "lab_shelf": (lab_shelf, "prop"), "lab_shelf_free": (lab_shelf_free, "prop"), "lab_balltable": (lab_balltable, "prop"), "lab_bigmachine": (lab_bigmachine, "prop"),
    "lab_chart": (lab_chart, "wallart"), "lab_chair": (lab_chair, "prop"),
    "sc_board": (sc_board, "wallart"), "sc_lectern": (sc_lectern, "prop"), "sc_desk": (sc_desk, "prop"), "sc_dais": (sc_dais, "prop"), "sc_clock": (sc_clock, "wallart"),
    "sc_bulletin": (sc_bulletin, "wallart"), "sc_window": (sc_window, "wallart"),
    "mu_tank": (mu_tank, "prop"), "mu_case_shell": (lambda P: mu_case(P, "shell"), "prop"), "mu_case_amber": (lambda P: mu_case(P, "amber"), "prop"),
    "mu_vitrine": (mu_vitrine, "prop"), "mu_ship": (mu_ship, "prop"), "mu_fossil": (mu_fossil, "prop"),
    "mu_rope_l": (lambda P: mu_rope(P, "l"), "prop"), "mu_rope_m": (lambda P: mu_rope(P, "m"), "prop"), "mu_rope_r": (lambda P: mu_rope(P, "r"), "prop"),
    "mu_sign": (mu_sign, "prop"), "mu_udesk": (mu_udesk, "prop"), "mu_stairs": (mu_stairs, "wallart"), "mu_plaque": (mu_plaque, "wallart"),
    "dp_elevator": (dp_elevator, "wallart"), "dp_elevfoot": (lambda P: dp_foot(P, "elev"), "decor"),
    "dp_escalator": (dp_escalator, "wallart"), "dp_escfoot": (lambda P: dp_foot(P, "esc"), "decor"),
    "dp_sign1f": (lambda P: dp_floorsign(P, "1F"), "wallart"), "dp_sign2f": (lambda P: dp_floorsign(P, "2F"), "wallart"),
    "dp_counter": (dp_counter, "prop"), "dp_shelf": (dp_shelf, "prop"), "dp_showcase": (dp_showcase, "prop"),
    "dp_rack": (dp_rack, "prop"), "dp_directory": (dp_directory, "prop"),
    "sh_door": (sh_door, "wallart"), "sh_porthole": (sh_porthole, "wallart"), "sh_lifering": (sh_lifering, "wallart"), "sh_lifering_wall": (sh_lifering_wall, "wallart"),
    "sh_bed": (sh_bed, "prop"), "sh_bin": (sh_bin, "prop"), "sh_bench": (sh_bench, "prop"), "sh_extinguisher": (sh_extinguisher, "prop"), "sh_stairs": (sh_stairs, "prop"), "sh_table": (sh_table, "prop"), "sh_deckchair": (sh_deckchair, "prop"),
    "sh_bollard": (sh_bollard, "prop"), "sh_barrel": (sh_barrel, "prop"), "sh_roundtable": (sh_roundtable, "prop"), "sh_vent": (sh_vent, "prop"),
    "lg_door": (lg_door, "wallart"), "lg_lamp": (lg_lamp, "wallart"),
}
for _th in ("ghost", "ice", "dragon", "dark"):
    for _sd in "lr":
        FURN[f"lg_side_{_th}_{_sd}"] = ((lambda th, sd: lambda P: lg_side(P, th, sd))(_th, _sd), "prop")

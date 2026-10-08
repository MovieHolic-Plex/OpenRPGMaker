#!/usr/bin/env python3
"""jp_city 일본 실내 — 지상 역사·승강장·전철 차내. id 머리 `st-`.

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만. 글자·숫자·상표·사람 없음.
화풍·색은 지하철 콘코스 키트 `transit_station.py` 를 따른다(노선 색 midori, 개찰기 남색 앞면·흰 윗면, 승강장 끝 흰 선 + 노란 점자).
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (up/16 + h)*16, hang = w*16 × hrows*16, table = fn(c,w,h).
크기(§12-3 공식, 1칸 = 1m): 개찰기 길이 1.5m·높이 1m → 1칸·up16. 매표기 높이 1.7m → wall up16. 롱시트 7인 3.1m → 3칸.
역무실 창구 2m. 매점 2m×1m. 대합실 벤치 2인 1.8m → 2칸. 승강장 지붕 기둥 높이 3m → up32. 손잡이 기둥 → up32.

분류는 interior/categories.py(station·platform·train).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT

BLOCK = 'interior_station'
R = Registry(BLOCK, '역·전철')
LINE = 'midori'            # 노선 색 — transit_station.py·jp-subway.png 와 같다


# ── 도우미 ────────────────────────────────────────────────────────────────────
def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def rc(c, x, y, w, h, col):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(c.w, x + w), min(c.h, y + h)
    if x1 > x0 and y1 > y0: c.R(x0, y0, x1 - x0, y1 - y0, col)


def hl(c, x, y, n, col): rc(c, x, y, n, 1, col)
def vl(c, x, y, n, col): rc(c, x, y, 1, n, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def bev(c, x, y, w, h, ramp, t=0, olc=None):
    """외곽선 + 면 + 왼위 밝은 변 + 오른아래 어두운 변."""
    outline(c, x, y, w, h, olc)
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    rc(c, ix, iy, iw, ih, K(ramp, t))
    hl(c, ix, iy, iw, K(ramp, t + 1)); vl(c, ix, iy, ih, K(ramp, t + 1))
    hl(c, ix, iy + ih - 1, iw, K(ramp, t - 1)); vl(c, ix + iw - 1, iy, ih, K(ramp, t - 1))


def view(c, x, y, w, h, s=0):
    """창 너머 풍경: 위 하늘 두 단 + 아래 먼 건물 실루엣(회보라) + 나무 덩이 하나. 유리 반사 사선."""
    rc(c, x, y, w, h, K('sora', 1)); rc(c, x, y, w, max(1, h // 3), K('sora', 2))
    for i in range(w):
        bh = 2 + hs(i // 3, s, 4) % max(1, h // 2)
        rc(c, x + i, y + h - bh, 1, bh, K('hodo', 0 if (i // 3) % 2 else -1))
        if (i // 3) % 2 == 0 and bh > 3 and i % 3 == 1: px(c, x + i, y + h - bh + 1, K('mado', 1))
    tx = x + (hs(s, 3, 9) % max(1, w - 4))
    rc(c, tx, y + h - 3, 4, 3, K('ki', 0)); hl(c, tx + 1, y + h - 4, 2, K('ki', 1))
    for k in range(3):
        px(c, x + 1 + k, y + 3 - k, K('shiro', 1)); px(c, x + 3 + k, y + 3 - k, K('sora', 2))


# ══ 바닥 ═════════════════════════════════════════════════════════════════════
@R.floor('st-concourse', '역사 바닥(연회색 석재 타일)', cols=2, rows=2, tags=('역', '역사', '콘코스', '개찰구'),
         desc='연회색 석재 대형 타일(50cm 판)이 이어진 역사·대합실 바닥. 줄눈은 한 단 어둡고 판마다 왼위 모서리가 밝다. 개찰 안팎·매표기 앞 공용.')
def _concourse(c):
    rc(c, 0, 0, 32, 32, K('conc', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 2, 12): px(c, x, y, K('conc', 0))
            elif rnd(x, y, 3, 8): px(c, x, y, K('conc', 2))
    for y in range(0, 32, 8): hl(c, 0, y, 32, K('conc', 0))
    for y in range(0, 32, 8):
        off = 0 if (y // 8) % 2 == 0 else 4
        for x in range(off, 32, 8):
            vl(c, x, y, 8, K('conc', 0)); hl(c, x + 1, y + 1, 3, K('conc', 2)); px(c, x + 1, y + 2, K('conc', 2))


@R.floor('st-platform', '승강장 바닥(회색 콘크리트)', cols=2, rows=2, tags=('역', '승강장', '플랫폼'),
         desc='역사 바닥보다 두 단 짙은 회색 콘크리트·아스팔트 포장. 자잘한 골재 점과 1m 간격 신축 줄눈. 승강장 전체에 깐다.')
def _platform(c):
    rc(c, 0, 0, 32, 32, K('conc', -1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 5, 45): px(c, x, y, K('conc', -2))
            elif rnd(x, y, 6, 25): px(c, x, y, K('conc', 0))
    for y in (0, 16): hl(c, 0, y, 32, K('conc', -2))
    for x in (0, 16): vl(c, x, 0, 32, K('conc', -2))
    for y in (1, 17): hl(c, 1, y, 15, K('conc', 0)); hl(c, 17, y, 15, K('conc', 0))


@R.floor('st-car-floor', '전철 차내 바닥(회갈 고무)', cols=2, rows=2, tags=('전철', '차내', '전차'),
         desc='회갈색 고무 바닥. 작은 돌기 점이 엇갈려 찍힌 조용한 무늬. 전철 차내 통로 전체에 깐다.')
def _car_floor(c):
    rc(c, 0, 0, 32, 32, K('ita', 0))
    for y in range(1, 32, 4):
        for x in range((y // 4) % 2 * 2, 32, 4):
            px(c, x, y, K('ita', 1)); px(c, x + 1, y + 1, K('ita', -1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 7, 18): px(c, x, y, K('ita', -1))


# ══ 벽면 ═════════════════════════════════════════════════════════════════════
@R.wall('st-wall', '역사 벽(흰 패널 + 노선 색 띠)', cols=2, tags=('역', '역사', '콘코스', '개찰구'),
        desc='흰 금속 패널 벽(1m 이음)에 노선 색(초록) 가로 띠 한 줄, 아래 짙은 회색 걸레받이. 역사 실내 공용 벽.')
def _wall(c):
    rc(c, 0, 0, 32, 32, K('shiro', 1))
    for x in (0, 16): vl(c, x, 0, 26, K('shiro', 0)); vl(c, x + 1, 0, 26, K('shiro', 2))
    for y in range(32):
        for x in range(32):
            if y < 16 and rnd(x, y, 8, 12): px(c, x, y, K('shiro', 0))
    hl(c, 0, 16, 32, K(LINE, 1)); rc(c, 0, 17, 32, 3, K(LINE, 0)); hl(c, 0, 20, 32, K(LINE, -1))
    hl(c, 0, 25, 32, K('shiro', -1))
    rc(c, 0, 26, 32, 6, K('tekko', 0)); hl(c, 0, 26, 32, K('tekko', 2)); hl(c, 0, 30, 32, K('tekko', -1)); hl(c, 0, 31, 32, K('tekko', -2))


@R.wall('st-trackside-wall', '선로 건너편 옹벽(울타리·덤불)', cols=2, tags=('역', '승강장', '선로'),
        desc='승강장 맞은편, 선로 너머의 콘크리트 옹벽. 위에 철망 울타리와 덤불, 아래는 물때 낀 콘크리트 판. 승강장 맵의 북쪽 벽면.')
def _trackside(c):
    rc(c, 0, 0, 32, 10, K('ki', -1))
    for x in range(32):
        top = 1 + hs(x // 3, 0, 11) % 3
        rc(c, x, top, 1, 9 - top, K('ki', 0 if (x // 3) % 2 else 1))
        if rnd(x, 1, 12, 300): px(c, x, top, K('ki', 2))
    for x in range(0, 32, 4): vl(c, x, 0, 10, K('tekko', 1))
    for y in (2, 6): hl(c, 0, y, 32, K('tekko', 0))
    for x in (0, 16): vl(c, x, 0, 10, K('tekko', -1)); vl(c, x + 1, 0, 10, K('tekko', 2))
    hl(c, 0, 10, 32, K('conc', 1)); hl(c, 0, 11, 32, K('conc', 2))
    rc(c, 0, 12, 32, 16, K('conc', -1))
    for x in (0, 16): vl(c, x, 12, 16, K('conc', -2)); vl(c, x + 1, 12, 16, K('conc', 0))
    for y in range(12, 28):
        for x in range(32):
            if rnd(x, y, 13, 40): px(c, x, y, K('conc', -2))
    for x in (7, 23): vl(c, x, 13, 9, K('conc', -2))                                                     # 물때 줄
    rc(c, 9, 16, 3, 3, K('yoru', -2)); rc(c, 25, 16, 3, 3, K('yoru', -2))                                 # 배수 구멍
    hl(c, 9, 16, 3, K('conc', -3)); hl(c, 25, 16, 3, K('conc', -3))
    rc(c, 0, 28, 32, 4, K('yoru', -1)); hl(c, 0, 28, 32, K('conc', -2))


@R.wall('st-car-wall', '전철 차내 벽(크림 + 창 줄)', cols=4, tags=('전철', '차내', '전차'),
        desc='크림색 차내 벽. 위에 그물 선반 봉, 그 아래 큰 창(창 너머 하늘·먼 거리), 가운데 창틀 기둥. 아래는 크림 판. 4칸 주기.')
def _car_wall(c):
    rc(c, 0, 0, 64, 32, K('kinari', 1))
    hl(c, 0, 1, 64, K('tekko', 2)); hl(c, 0, 2, 64, K('tekko', 0))                                       # 선반 봉
    for x in range(2, 64, 4): px(c, x, 3, K('tekko', 1))                                                  # 그물 선반 앞 끝
    for wx in (2, 34):
        rc(c, wx, 4, 28, 14, K('tekko', 1)); outline(c, wx, 4, 28, 14, K('tekko', -1))
        view(c, wx + 2, 6, 24, 10, wx)
        hl(c, wx + 1, 5, 26, K('tekko', 2)); vl(c, wx + 1, 5, 12, K('tekko', 2))
        hl(c, wx, 18, 28, K('kinari', 2)); hl(c, wx, 19, 28, K('kinari', 0))                             # 창턱
    for x in (0, 32): vl(c, x, 4, 16, K('kinari', 0)); vl(c, x + 1, 4, 16, K('kinari', 2))
    hl(c, 0, 24, 64, K('kinari', 0)); hl(c, 0, 25, 64, K('kinari', 2))
    rc(c, 0, 29, 64, 3, K('tekko', -1)); hl(c, 0, 29, 64, K('tekko', 1))


# ══ 역사 걸이(hang) ══════════════════════════════════════════════════════════
@R.obj('st-fare-map', '운임표(노선도)', w=3, kind='hang', hrows=2, cat='station', cat_ko='역사·개찰', tags=('역', '역사', '매표기'),
       place='매표기 줄 바로 위 벽면 윗줄', pair=('st-ticket-machine',),
       desc='매표기 위 벽에 거는 3칸 운임표. 흰 판에 초록 노선 두 줄·주황 지선, 역마다 흰 네모 점과 회색 막대(글자 없음). 매표기 2~3대 위에 하나.')
def _fare_map(c):
    W = 48
    rc(c, 1, 1, W - 2, 16, K('shiro', 2)); outline(c, 0, 0, W, 18, K('tekko', -1))
    hl(c, 1, 1, W - 2, K('shiro', 2)); vl(c, 1, 1, 16, K('shiro', 2))
    rc(c, 1, 1, W - 2, 3, K('kon', 0)); hl(c, 1, 1, W - 2, K('kon', 1))
    rc(c, 4, 10, W - 8, 2, K(LINE, 0)); hl(c, 4, 9, W - 8, K(LINE, 1))
    hl(c, 4, 6, 20, K('daidai', 0)); vl(c, 24, 6, 4, K('daidai', 0))
    for i, x in enumerate(range(6, W - 4, 6)):
        rc(c, x, 9, 2, 3, K('shiro', 2)); outline(c, x - 1, 8, 4, 5, OL)
        hl(c, x - 1, 14, 4, K('conc', -1 if i % 2 else 0))
    for x in (8, 14, 20): px(c, x, 6, K('shiro', 2)); px(c, x, 5, OL)
    hl(c, 1, 18, W - 2, K('shiro', -2))


@R.obj('st-timetable', '발차 안내 LED 판', w=2, kind='hang', hrows=2, cat='station', cat_ko='역사·개찰', tags=('역', '역사', '개찰구', '승강장', '안내판'),
       place='개찰구 안쪽 벽면 윗줄, 승강장 나가는 문 옆', pair=('st-gate',),
       desc='검은 판에 주황·초록·노란 불빛 칸이 두 줄로 켜진 발차 안내판 2칸(글자 없음, 색 칸뿐). 짧은 봉 둘로 위에서 매단다.')
def _timetable(c):
    for x in (6, 25): vl(c, x, 0, 4, K('tekko', 1)); vl(c, x + 1, 0, 4, OL)
    rc(c, 1, 4, 30, 15, K('tekko', 0)); hl(c, 1, 4, 30, K('tekko', 2)); outline(c, 0, 3, 32, 17, OL)
    rc(c, 3, 6, 26, 11, K('yoru', -3))
    for row, (yy, a, b) in enumerate(((7, 'daidai', LINE), (12, 'daidai', 'kii'))):
        for i in range(8):
            if (i * 5 + row * 3) % 7 != 2: rc(c, 4 + i * 2, yy, 1, 3, K(a, 1))
        for i in range(4): rc(c, 21 + i * 2, yy, 1, 3, K(b, 1))
    hl(c, 3, 11, 26, K('yoru', -1))
    hl(c, 1, 20, 30, K('shiro', -2))


@R.obj('st-platform-door', '승강장 나가는 문(열린 통로)', w=2, kind='hang', hrows=2, cat='station', cat_ko='역사·개찰', use=('travel',), tags=('역', '역사', '개찰구', '승강장'),
       place='개찰 안쪽 북쪽 벽면 윗줄 — 바로 앞 두 칸이 승강장으로 가는 칸', pair=('st-gate', 'st-timetable'),
       desc='개찰 안쪽 북쪽 벽에 뚫린 2칸 폭 열린 통로. 스테인리스 문틀 너머로 밝은 승강장 지붕·하늘과 노란 점자 블록이 보인다. 문짝 없음, 위에 초록 띠.')
def _platform_door(c):
    rc(c, 3, 4, 26, 28, K('conc', 0))
    rc(c, 3, 4, 26, 8, K('sora', 2)); rc(c, 3, 9, 26, 3, K('sora', 1))
    rc(c, 3, 12, 26, 3, K('tekko', -1)); hl(c, 3, 12, 26, K('tekko', 1))                                   # 승강장 지붕 끝
    for x in (8, 22): rc(c, x, 15, 2, 9, K('shiro', 0)); vl(c, x, 15, 9, K('shiro', 1))                     # 먼 기둥
    rc(c, 3, 24, 26, 8, K('conc', 1))
    rc(c, 3, 26, 26, 3, K('kii', 1)); hl(c, 3, 26, 26, K('kii', 2)); hl(c, 3, 28, 26, K('kii', 0))
    for x in range(5, 29, 4): px(c, x, 27, K('kii', 2))
    for x0, f in ((0, 1), (29, -1)):
        rc(c, x0, 0, 3, 32, K('tekko', 1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, K('tekko', 3 if f > 0 else -2)); vl(c, x0 + (2 if f > 0 else 0), 4, 28, K('tekko', -1 if f > 0 else 2))
    rc(c, 0, 0, 32, 4, K('tekko', 1)); hl(c, 0, 0, 32, OL); hl(c, 0, 1, 32, K(LINE, 0)); hl(c, 0, 2, 32, K(LINE, -1)); hl(c, 0, 3, 32, OL)
    vl(c, 0, 0, 32, OL); vl(c, 31, 0, 32, OL)


# ══ 역사 가구 ═════════════════════════════════════════════════════════════════
@R.obj('st-gate', '자동 개찰기', w=1, h=1, up=16, kind='floor', cat='station', cat_ko='역사·개찰', use=('gate',), tags=('역', '역사', '개찰구', '改札'),
       place='콘코스를 가로지르는 개찰 줄 — 한 칸 건너 하나씩, 사이 칸이 통로', pair=('st-fence', 'st-office-window'),
       desc='남북으로 긴 자동 개찰기 한 대. 흰 윗면 북쪽 끝에 표시창, 남쪽 끝에 파란 IC 판, 남색 앞면에 초록·빨강 불. 양옆으로 회색 문짝이 조금 튀어나온다. 한 칸 건너 하나씩 이어 놓아 사이 칸을 통로로 쓴다(통로 2개 이상).')
def _gate(c):
    # 남북으로 긴 낮은 몸통(길이 1.7m·높이 1m): 윗면이 길고(20px) 남쪽 앞면은 낮다(9px).
    for fx, side in ((0, -1), (12, 1)):                                                                   # 문짝 — 통로 쪽으로 튀어나온 회색 판(닫힘)
        rc(c, fx, 8, 4, 8, K('tekko', 2)); hl(c, fx, 8, 4, K('tekko', 3)); hl(c, fx, 15, 4, K('tekko', 0))
        outline(c, fx, 7, 4, 10, OL); hl(c, fx, 17, 4, K('conc', -1))
    rc(c, 4, 1, 8, 20, K('shiro', 1)); vl(c, 4, 1, 20, K('shiro', 2)); vl(c, 11, 2, 19, K('shiro', 0))
    hl(c, 4, 1, 8, K('shiro', 2)); hl(c, 4, 20, 8, K('shiro', 2))
    rc(c, 6, 3, 4, 3, K('garasu', 0)); hl(c, 6, 3, 4, K('garasu', 2))                                     # 북쪽 끝 표시창
    hl(c, 5, 9, 6, K('shiro', 0)); hl(c, 5, 10, 6, K('shiro', 2))                                         # 표 넣는 홈
    rc(c, 6, 14, 4, 4, K('sora', 0)); hl(c, 6, 14, 4, K('sora', 2)); px(c, 6, 15, K('sora', 2)); outline(c, 5, 13, 6, 6, OL)   # IC 판
    rc(c, 4, 21, 8, 8, K('kon', 0)); hl(c, 4, 21, 8, K('kon', 1)); vl(c, 4, 21, 8, K('kon', 1)); vl(c, 11, 21, 8, K('kon', -1))
    rc(c, 5, 23, 2, 2, K(LINE, 1)); px(c, 5, 23, K(LINE, 2)); rc(c, 9, 23, 2, 2, K('aka', 0)); px(c, 9, 23, K('aka', 1))
    hl(c, 5, 27, 6, K('kon', -1))
    outline(c, 3, 0, 10, 30, OL); hl(c, 3, 20, 10, OL)
    hl(c, 3, 30, 10, K('conc', -1)); hl(c, 3, 31, 10, K('conc', 0))


@R.obj('st-fence', '개찰 옆 낮은 칸막이', w=1, h=1, up=0, kind='floor', cat='station', cat_ko='역사·개찰', tags=('역', '역사', '개찰구'),
       place='개찰 줄 양 끝에서 벽·창구까지 같은 줄로 잇는다', pair=('st-gate',),
       desc='허리 높이 스테인리스 칸막이 한 칸. 위 난간 윗면이 밝고 앞판에 세로 반사 줄. 개찰 줄의 막힌 부분을 벽까지 잇는다.')
def _fence(c):
    hl(c, 0, 3, 16, OL); hl(c, 0, 4, 16, K('tekko', 3)); hl(c, 0, 5, 16, K('tekko', 2))
    rc(c, 0, 6, 16, 7, K('tekko', 1)); hl(c, 0, 6, 16, OL)
    for x in (3, 11): vl(c, x, 7, 5, K('tekko', 3)); vl(c, x + 1, 7, 5, K('tekko', 2))
    hl(c, 0, 12, 16, K('tekko', -1)); hl(c, 0, 13, 16, OL); hl(c, 0, 14, 16, K('conc', -1))


@R.obj('st-ticket-machine', '자동 매표기', w=1, h=1, up=16, kind='wall', cat='station', cat_ko='역사·개찰', use=('search',), tags=('역', '역사', '매표기'),
       place='개찰 밖 북쪽 벽 바로 아래 줄, 2~3대 이어 놓는다', pair=('st-fare-map',),
       desc='벽에 붙인 흰 자동 매표기 한 대. 윗면, 초록 머리띠, 비스듬한 터치 화면, 동전·지폐 구멍, 아래 표 나오는 곳. 가로로 이어 놓고 위 벽에 운임표. 앞 두 줄은 줄 서는 자리로 비운다.')
def _ticket(c):
    rc(c, 0, 2, 15, 5, K('shiro', 1)); hl(c, 0, 2, 15, K('shiro', 2)); vl(c, 0, 2, 5, K('shiro', 2))
    hl(c, 0, 7, 15, K('shiro', 2)); hl(c, 0, 8, 15, K('shiro', -1)); hl(c, 0, 9, 15, K('shiro', -2))
    rc(c, 1, 10, 13, 20, K('shiro', 0)); vl(c, 1, 10, 20, K('shiro', 1))
    rc(c, 2, 10, 11, 2, K(LINE, 0)); hl(c, 2, 10, 11, K(LINE, 1))
    rc(c, 2, 13, 8, 7, K('garasu', -1)); hl(c, 2, 13, 8, K('garasu', 1)); outline(c, 1, 12, 10, 9, OL)
    rc(c, 3, 15, 2, 2, K('sora', 1)); rc(c, 6, 15, 2, 2, K('sora', 1)); hl(c, 3, 18, 6, K('garasu', 2))
    rc(c, 11, 13, 2, 2, K('tekko', -1)); rc(c, 11, 16, 2, 3, K('tekko', 0)); px(c, 11, 16, K('tekko', 2))
    rc(c, 3, 23, 9, 3, K('yoru', -2)); hl(c, 3, 22, 9, K('tekko', 1))
    rc(c, 1, 28, 13, 2, K('tekko', -1))
    outline(c, 0, 2, 15, 29, OL); hl(c, 0, 31, 16, K('conc', -2))


@R.obj('st-office-window', '역무실 창구', w=2, h=1, up=16, kind='wall', cat='station', cat_ko='역사·개찰', surface=True, use=('counter',),
       tags=('역', '역사', '역무실', '창구', '개찰구'),
       place='개찰 줄 바로 옆, 역무실 벽 아래 첫 줄', pair=('st-gate', 'st-ic-card'),
       desc='역무실 벽에 난 유리 창구 2칸. 유리 너머 책상·서류 그림자, 가운데 말하는 구멍, 아래 밝은 나무 카운터(표 주고받는 홈). 앞 두 줄은 손님 자리로 비운다. 카운터 위에 IC 카드·서류를 놓는다.')
def _office_window(c):
    rc(c, 1, 1, 30, 16, K('tekko', 1)); outline(c, 0, 0, 32, 18, K('tekko', -1))
    rc(c, 3, 3, 26, 13, K('garasu', -1))
    rc(c, 5, 10, 8, 4, K('tekko', -2)); rc(c, 6, 8, 5, 3, K('yoru', -1)); rc(c, 20, 11, 6, 3, K('kinari', 0))   # 안쪽 책상·모니터·서류
    vl(c, 16, 3, 13, K('tekko', 1)); vl(c, 15, 3, 13, K('tekko', -1))
    for x in (5, 19): vl(c, x, 4, 4, K('garasu', 2)); vl(c, x + 1, 4, 2, K('garasu', 1))
    for (x, y) in ((8, 13), (10, 13), (9, 14), (22, 13), (24, 13), (23, 14)): px(c, x, y, K('shiro', 0))    # 말하는 구멍
    rc(c, 0, 17, 32, 5, K('ita', 2)); hl(c, 0, 17, 32, K('ita', 3)); vl(c, 0, 17, 5, K('ita', 3))
    rc(c, 12, 18, 8, 2, K('tekko', 1)); hl(c, 12, 18, 8, OL)
    hl(c, 0, 22, 32, K('ita', 3)); hl(c, 0, 23, 32, K('shiro', -1)); hl(c, 0, 24, 32, K('shiro', -2))
    rc(c, 1, 25, 30, 5, K('shiro', 0)); vl(c, 16, 25, 5, K('shiro', -1))
    rc(c, 1, 29, 30, 1, K('tekko', -1))
    outline(c, 0, 17, 32, 14, OL); hl(c, 0, 31, 32, K('conc', -2))


@R.obj('st-kiosk', '역 매점', w=2, h=1, up=16, kind='floor', cat='station', cat_ko='역사·개찰', surface=True, use=('counter',), tags=('역', '역사', '매점', '대합실'),
       place='개찰 밖 콘코스 한쪽, 벽에서 떨어진 곳', pair=('st-newspaper', 'st-ekiben'),
       desc='작은 역 매점 2칸. 위 주황 간판 띠(글자 없음), 뒤 선반에 과자·음료 색 덩이, 앞 카운터 위에 신문 더미, 앞면에 잡지 표지(색 덩이). 카운터 위에 신문·도시락을 놓는다.')
def _kiosk(c):
    rc(c, 1, 1, 30, 3, K('daidai', 0)); hl(c, 1, 1, 30, K('daidai', 1)); hl(c, 1, 3, 30, K('daidai', -1)); outline(c, 0, 0, 32, 5, OL)
    rc(c, 2, 5, 28, 13, K('tekko', -1)); vl(c, 1, 5, 13, OL); vl(c, 30, 5, 13, OL)
    cols = ('aka', 'kii', 'sora', LINE, 'daidai', 'pinku', 'shiro')
    for r, y in enumerate((6, 11)):
        for i in range(6):
            x = 3 + i * 4 + (r % 2)
            col = cols[(i + r * 3) % len(cols)]
            rc(c, x, y, 3, 4, K(col, 0)); hl(c, x, y, 3, K(col, 1))
        hl(c, 2, y + 4, 28, K('tekko', 2))
    rc(c, 0, 17, 32, 6, K('shiro', 1)); hl(c, 0, 17, 32, K('shiro', 2)); vl(c, 0, 17, 6, K('shiro', 2))
    for i in range(3): rc(c, 2 + i, 18 + i, 8, 3, K('shiro', 2)); hl(c, 3, 19 + i, 6, K('conc', 0))
    rc(c, 20, 18, 4, 3, K('aka', 0)); rc(c, 25, 18, 4, 3, K('kii', 1)); hl(c, 20, 18, 9, K('shiro', 2))
    hl(c, 0, 22, 32, K('shiro', 2)); hl(c, 0, 23, 32, K('shiro', -1))
    for i in range(7):
        x = 2 + i * 4; col = cols[(i * 2) % len(cols)]
        rc(c, x, 24, 3, 5, K(col, -1 if col != 'shiro' else 0)); hl(c, x, 24, 3, K(col, 1)); px(c, x + 1, 26, K('shiro', 2))
    rc(c, 1, 29, 30, 2, K('daidai', -1))
    outline(c, 0, 16, 32, 15, OL); hl(c, 1, 31, 30, K('conc', -2))


@R.obj('st-bench', '대합실 벤치', w=2, h=1, up=0, kind='floor', cat='station', cat_ko='역사·개찰', use=('sit',), facing='S', tags=('역', '역사', '대합실'),
       place='개찰 밖 대합실, 벽이나 매점 근처에 한두 개', pair=('st-vending',),
       desc='나무 널 등받이와 앉는 판, 철 다리의 대합실 벤치 2칸(2~3인). 남쪽을 보고 앉는다.')
def _bench(c):
    rc(c, 1, 1, 30, 4, K('yuka', 0)); hl(c, 1, 1, 30, K('yuka', 1)); hl(c, 1, 3, 30, K('yuka', -1)); outline(c, 0, 0, 32, 6, OL)
    for x in (4, 27): rc(c, x, 6, 2, 2, K('tekko', -1))
    rc(c, 1, 7, 30, 5, K('yuka', 1)); hl(c, 1, 7, 30, K('yuka', 2)); hl(c, 1, 9, 30, K('yuka', 0)); hl(c, 1, 10, 30, K('yuka', 1))
    outline(c, 0, 6, 32, 7, OL)
    for x in (3, 27): rc(c, x, 13, 2, 2, K('tekko', 0)); vl(c, x, 13, 2, K('tekko', 2))
    hl(c, 1, 15, 30, K('conc', -1))


@R.obj('st-vending', '음료 자판기', w=1, h=1, up=16, kind='wall', cat='station', cat_ko='역사·개찰', use=('search',), tags=('역', '역사', '대합실', '승강장', '자판기'),
       place='역사·승강장 벽 바로 아래 줄', pair=('st-bench',),
       desc='벽에 붙인 흰 음료 자판기. 윗면, 초록 옆 띠, 유리창 속 색색 병 세 줄과 노란 단추 줄, 동전 판, 아래 꺼내는 구멍(상표 없음).')
def _vending(c):
    rc(c, 0, 2, 15, 5, K('shiro', 1)); hl(c, 0, 2, 15, K('shiro', 2)); vl(c, 0, 2, 5, K('shiro', 2))
    hl(c, 0, 7, 15, K('shiro', 2)); hl(c, 0, 8, 15, K('shiro', -1)); hl(c, 0, 9, 15, K('shiro', -2))
    rc(c, 1, 10, 13, 20, K('shiro', 0)); rc(c, 1, 10, 2, 20, K(LINE, 0)); vl(c, 1, 10, 20, K(LINE, 1))
    rc(c, 4, 11, 9, 11, K('garasu', 1)); outline(c, 3, 10, 11, 13, OL)
    cols = ('aka', 'kii', 'sora', LINE, 'daidai', 'shiro', 'pinku')
    for r, y in enumerate((12, 15, 18)):
        for i in range(4):
            col = cols[(i + r * 2) % len(cols)]
            rc(c, 5 + i * 2, y, 1, 2, K(col, 0)); px(c, 5 + i * 2, y, K(col, 1))
        hl(c, 4, y + 2, 9, K('kii', 1))
    px(c, 5, 11, K('shiro', 2)); px(c, 6, 11, K('shiro', 2))
    rc(c, 4, 23, 4, 2, K('tekko', 0)); px(c, 9, 23, K('tekko', -1)); px(c, 11, 23, K('kii', 1))
    rc(c, 4, 26, 9, 3, K('yoru', -2)); hl(c, 4, 26, 9, K('tekko', 1))
    outline(c, 0, 2, 15, 29, OL); hl(c, 0, 31, 16, K('conc', -2))


@R.obj('st-tactile', '점자 블록(선형 유도)', w=1, h=1, kind='flat', cat='station', cat_ko='역사·개찰', use=('walk',), tags=('역', '역사', '승강장', '점자블록'),
       place='출입구 → 매표기·개찰 통로 → 승강장으로 이어지는 걸음 길 바닥', pair=('st-tactile-dot',),
       desc='노란 선형 점자 블록 한 칸(남북으로 볼록 줄 네 줄). 이어 놓아 걷는 길을 표시하고, 꺾이는 곳·멈출 곳은 점형 블록으로 바꾼다. 밟는다.')
def _tactile(c):
    rc(c, 2, 0, 12, 16, K('kii', 1)); vl(c, 2, 0, 16, K('kii', 2)); vl(c, 13, 0, 16, K('kii', -1))
    hl(c, 2, 0, 12, K('kii', 0)); hl(c, 2, 8, 12, K('kii', 0))
    for x in (4, 7, 10):
        for y0 in (1, 9):
            vl(c, x, y0 + 1, 5, K('kii', 2)); vl(c, x + 1, y0 + 1, 5, K('kii', 0))


@R.obj('st-tactile-dot', '점자 블록(점형 경고)', w=1, h=1, kind='flat', cat='station', cat_ko='역사·개찰', use=('walk',), tags=('역', '역사', '승강장', '점자블록'),
       place='개찰 통로 앞·문 앞·계단 앞, 선형 블록이 끝나거나 꺾이는 칸', pair=('st-tactile',),
       desc='노란 점형 경고 블록 한 칸(볼록 점 3×3). 선형 블록과 같은 폭이라 이어진다. 멈춤·주의 자리. 밟는다.')
def _tactile_dot(c):
    rc(c, 2, 0, 12, 16, K('kii', 1)); vl(c, 2, 0, 16, K('kii', 2)); vl(c, 13, 0, 16, K('kii', -1))
    hl(c, 2, 0, 12, K('kii', 0)); hl(c, 2, 8, 12, K('kii', 0))
    for dx in (4, 7, 10):
        for dy in (2, 6, 10, 13):
            px(c, dx, dy, K('kii', 2)); px(c, dx + 1, dy, K('kii', 2)); px(c, dx + 1, dy + 1, K('kii', -1))


# ══ 승강장 ════════════════════════════════════════════════════════════════════
@R.table('st-track', '선로(자갈·침목·레일)', tags=('역', '승강장', '선로'),
         desc='자갈 바닥에 콘크리트 침목과 레일 두 줄. 승강장 북쪽, 끝선 바로 위에 2줄 띠로 가로 끝까지 깐다. 전부 막힘.')
def _track(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 0, W, H, K('conc', -2))
    for y in range(H):
        for x in range(W):
            if rnd(x % 16, y % 16, 21, 160): px(c, x, y, K('conc', -3))
            elif rnd(x % 16, y % 16, 22, 110): px(c, x, y, K('conc', -1))
            elif rnd(x % 16, y % 16, 23, 30): px(c, x, y, K('soil', 0))
    for x in range(0, W, 16):
        for sx in (2, 10):
            rc(c, x + sx, 0, 4, H, K('conc', -1)); vl(c, x + sx, 0, H, K('conc', 0)); vl(c, x + sx + 3, 0, H, K('conc', -3))
    def rail(y):
        hl(c, 0, y - 1, W, OL); hl(c, 0, y, W, K('tekko', 3)); hl(c, 0, y + 1, W, K('tekko', 1))
        hl(c, 0, y + 2, W, K('tekko', -1)); hl(c, 0, y + 3, W, OL)
    if h == 1:
        rc(c, 0, 0, W, 2, K('yoru', -3)); rail(4); rail(10); rc(c, 0, 14, W, 2, K('sumi', 0))
        return
    rc(c, 0, 0, W, 3, K('yoru', -3))
    rail(10); rail(H - 12)
    rc(c, 0, H - 3, W, 3, K('sumi', 0)); hl(c, 0, H - 3, W, K('yoru', -3))


@R.obj('st-edge', '승강장 끝(흰 선·노란 점자)', w=1, h=1, kind='flat', cat='platform', cat_ko='승강장', use=('walk',), tags=('역', '승강장', '점자블록'),
       place='승강장 맨 북쪽 줄, 선로 바로 아래에 가로 끝까지 이어 붙인다', pair=('st-track', 'st-boarding-mark'),
       desc='승강장 끝 한 칸: 끝 갓돌, 흰 경계선, 노란 점형 블록 줄, 안쪽 노란 선. 선로 바로 아래 한 줄로 가로 반복. 밟을 수 있고 그 북쪽 선로가 막힌다.')
def _edge(c):
    rc(c, 0, 0, 16, 16, K('conc', -1))
    hl(c, 0, 0, 16, K('conc', 1)); hl(c, 0, 1, 16, K('conc', 0))
    rc(c, 0, 2, 16, 2, K('shiro', 1)); hl(c, 0, 4, 16, K('conc', -2))
    rc(c, 0, 6, 16, 7, K('kii', 0)); hl(c, 0, 5, 16, K('kii', -2)); hl(c, 0, 13, 16, K('kii', -2))
    for x in (0, 8): vl(c, x, 6, 7, K('kii', -1))
    for x in (0, 8):
        for (dx, dy) in ((2, 1), (5, 1), (2, 4), (5, 4)):
            px(c, x + dx, 6 + dy, K('kii', 2)); px(c, x + dx + 1, 6 + dy, K('kii', 1)); px(c, x + dx + 1, 7 + dy, K('kii', -1))
    hl(c, 0, 14, 16, K('kii', 1)); hl(c, 0, 15, 16, K('kii', -1))


@R.obj('st-boarding-mark', '승차 위치 표시', w=1, h=1, kind='flat', cat='platform', cat_ko='승강장', use=('travel',), tags=('역', '승강장', '승차위치'),
       place='승강장 끝 줄 바로 아래 칸, 열차 문 앞마다 두 칸', pair=('st-edge',),
       desc='바닥에 칠한 승차 위치 표시: 선로 쪽을 가리키는 노란 삼각과 줄 서는 점 둘, 초록 작은 네모(번호 대신). 열차 문 앞마다 두 칸. 밟으면 전철에 탄다(links).')
def _boarding(c):
    for j in range(6):
        hl(c, 7 - j, 2 + j, 2 + 2 * j, K('kii', 1))
    hl(c, 2, 8, 12, K('kii', -1))
    rc(c, 6, 10, 4, 3, K(LINE, 0)); hl(c, 6, 10, 4, K(LINE, 1))
    for x in (1, 12):
        rc(c, x, 11, 3, 3, K('kii', 1)); px(c, x, 11, K('kii', 2)); hl(c, x, 14, 3, K('kii', -1))


@R.obj('st-roof-pillar', '승강장 지붕 기둥', w=1, h=1, up=32, kind='floor', cat='platform', cat_ko='승강장', tags=('역', '승강장', '기둥'),
       place='승강장 가운데 줄, 4~5칸 간격', pair=('st-platform-bench',),
       desc='흰 칠 H형강 지붕 기둥(3m). 위에서 지붕 보가 갈라지고, 허리에 초록 작은 판(번호 대신), 아래 콘크리트 받침. 통과 못 한다.')
def _pillar(c):
    rc(c, 0, 0, 16, 3, K('tekko', 0)); hl(c, 0, 0, 16, K('tekko', 1)); hl(c, 0, 3, 16, OL)                 # 지붕 보
    for i in range(4): px(c, 4 - i, 4 + i, K('tekko', 0)); px(c, 11 + i, 4 + i, K('tekko', 0))           # 가새
    rc(c, 5, 3, 6, 38, K('shiro', 0)); vl(c, 5, 3, 38, K('shiro', 2)); vl(c, 6, 3, 38, K('shiro', 1))
    vl(c, 8, 3, 38, K('shiro', -1)); vl(c, 10, 3, 38, K('shiro', -2))
    vl(c, 4, 3, 38, OL); vl(c, 11, 3, 38, OL)
    rc(c, 5, 22, 6, 5, K(LINE, 0)); hl(c, 5, 22, 6, K(LINE, 1)); rc(c, 7, 24, 2, 1, K('shiro', 2))
    rc(c, 3, 41, 10, 3, K('conc', 1)); hl(c, 3, 41, 10, K('conc', 2)); rc(c, 3, 44, 10, 2, K('conc', -1))
    outline(c, 2, 40, 12, 7, OL); hl(c, 2, 47, 12, K('conc', -3))


@R.obj('st-platform-bench', '승강장 의자', w=2, h=1, up=0, kind='floor', cat='platform', cat_ko='승강장', use=('sit',), facing='N', tags=('역', '승강장', '의자'),
       place='승강장 가운데 줄, 기둥 사이(점자 블록 위는 피한다) — 선로 쪽을 본다', pair=('st-roof-pillar',),
       desc='철 보 위에 초록 플라스틱 의자 세 개가 붙은 승강장 의자 2칸. 위로 앉는 판 윗면, 아래로 등받이 뒷면이 보인다. 북쪽(선로)을 보고 앉는다.')
def _pbench(c):
    for i in range(3):
        sx = 2 + i * 10
        rc(c, sx, 1, 8, 4, K(LINE, 1)); hl(c, sx, 1, 8, K(LINE, 2)); vl(c, sx, 1, 4, K(LINE, 2))     # 앉는 판 윗면
        hl(c, sx, 5, 8, K(LINE, 2))                                                                   # 등받이 윗테
        rc(c, sx, 6, 8, 5, K(LINE, -1)); hl(c, sx, 10, 8, K(LINE, -2)); vl(c, sx, 6, 5, K(LINE, 0))   # 등받이 뒷면
        outline(c, sx - 1, 0, 10, 12, OL)
    rc(c, 1, 12, 30, 2, K('tekko', 0)); hl(c, 1, 12, 30, K('tekko', 1)); hl(c, 0, 14, 32, OL)
    for x in (5, 26): rc(c, x, 12, 2, 3, K('tekko', -1))
    hl(c, 1, 15, 30, K('conc', -2))


@R.obj('st-sign-pole', '역명 기둥 간판', w=1, h=1, up=32, kind='floor', cat='platform', cat_ko='승강장', tags=('역', '승강장', '역명판', '간판'),
       place='승강장 가운데 줄, 의자 옆에 하나', pair=('st-platform-bench',),
       desc='기둥 위 흰 역명판(글자 없음): 흰 판에 초록 노선 띠와 초록 네모 표, 아래 회색 기둥과 받침. 통과 못 한다.')
def _sign_pole(c):
    rc(c, 1, 2, 14, 19, K('shiro', 1)); hl(c, 1, 2, 14, K('shiro', 2)); vl(c, 1, 2, 19, K('shiro', 2)); vl(c, 14, 3, 18, K('shiro', 0))
    rc(c, 3, 4, 5, 5, K(LINE, 0)); rc(c, 5, 6, 1, 1, K('shiro', 2)); outline(c, 3, 4, 5, 5, OL)
    rc(c, 1, 15, 14, 4, K(LINE, 0)); hl(c, 1, 15, 14, K(LINE, 1)); hl(c, 1, 18, 14, K(LINE, -1))
    outline(c, 0, 1, 16, 21, OL)
    rc(c, 7, 22, 2, 21, K('tekko', 1)); vl(c, 7, 22, 21, K('tekko', 2)); vl(c, 8, 22, 21, K('tekko', -1))
    vl(c, 6, 22, 21, OL); vl(c, 9, 22, 21, OL)
    rc(c, 4, 43, 8, 3, K('conc', 1)); hl(c, 4, 43, 8, K('conc', 2)); outline(c, 3, 42, 10, 5, OL); hl(c, 3, 47, 10, K('conc', -3))


# ══ 전철 차내 ═════════════════════════════════════════════════════════════════
def _seat_n(c, ramp):
    """북쪽 벽 앞 롱시트(남쪽을 보고 앉음) 48×32 — 위 6행 비움(벽이 보인다)."""
    W = 48
    rc(c, 3, 6, W - 6, 12, K(ramp, 0)); hl(c, 3, 6, W - 6, K(ramp, 1)); hl(c, 3, 7, W - 6, K(ramp, 1))
    for i in range(1, 7): vl(c, 3 + i * 6, 8, 10, K(ramp, -1))
    hl(c, 3, 17, W - 6, K(ramp, -1))
    rc(c, 3, 18, W - 6, 6, K(ramp, 1)); hl(c, 3, 18, W - 6, K(ramp, 2)); hl(c, 3, 23, W - 6, K(ramp, 2))
    for i in range(1, 7): px(c, 3 + i * 6, 20, K(ramp, 0)); px(c, 3 + i * 6, 21, K(ramp, 0))
    outline(c, 2, 5, W - 4, 20, OL)
    rc(c, 3, 25, W - 6, 5, K('tekko', 0))
    for x in range(4, W - 4, 2): vl(c, x, 26, 3, K('tekko', -1))
    hl(c, 3, 25, W - 6, K('tekko', 1)); hl(c, 2, 30, W - 4, OL)
    for sx in (0, W - 3):                                                                                 # 소매 칸막이(스테인리스)
        rc(c, sx, 4, 3, 27, K('tekko', 1)); vl(c, sx, 4, 27, K('tekko', 3)); vl(c, sx + 2, 4, 27, K('tekko', -1))
        hl(c, sx, 4, 3, K('tekko', 3)); outline(c, sx, 3, 3, 28, OL)
    hl(c, 0, 31, W, K('ita', -2))


def _seat_s(c, ramp):
    """남쪽 줄 롱시트(북쪽을 보고 앉음) 48×16 — 앉는 판 윗면이 위, 등받이 뒤판이 아래로 보인다."""
    W = 48
    rc(c, 3, 1, W - 6, 6, K(ramp, 1)); hl(c, 3, 1, W - 6, K(ramp, 2))
    for i in range(1, 7): px(c, 3 + i * 6, 3, K(ramp, 0)); px(c, 3 + i * 6, 4, K(ramp, 0))
    hl(c, 3, 7, W - 6, K(ramp, 2)); hl(c, 3, 8, W - 6, K(ramp, 1))
    rc(c, 3, 9, W - 6, 6, K(ramp, -1)); hl(c, 3, 14, W - 6, K(ramp, -2))
    for i in range(1, 7): vl(c, 3 + i * 6, 9, 5, K(ramp, -2))
    outline(c, 2, 0, W - 4, 16, OL)
    for sx in (0, W - 3):
        rc(c, sx, 0, 3, 16, K('tekko', 1)); vl(c, sx, 0, 16, K('tekko', 3)); vl(c, sx + 2, 0, 16, K('tekko', -1)); outline(c, sx, 0, 3, 16, OL)


@R.obj('st-long-seat', '롱시트(북쪽 벽)', w=3, h=1, up=16, kind='wall', cat='train', cat_ko='전철 차내', use=('sit',), facing='S', tags=('전철', '차내', '좌석'),
       place='차내 북쪽 벽 아래 첫 줄, 문과 문 사이', pair=('st-long-seat-s', 'st-strap'),
       desc='남색 천을 씌운 7인 롱시트 3칸. 등받이가 창 아래 벽에 붙고 앉는 판 윗면이 밝다. 양 끝 스테인리스 소매 칸막이, 앞에 난방 그릴. 남쪽(통로)을 보고 앉는다.')
def _seat_long(c): _seat_n(c, 'kon')


@R.obj('st-long-seat-s', '롱시트(남쪽 줄)', w=3, h=1, up=0, kind='floor', cat='train', cat_ko='전철 차내', use=('sit',), facing='N', tags=('전철', '차내', '좌석'),
       place='차내 남쪽 마지막 바닥 줄, 북쪽 롱시트와 마주 보게', pair=('st-long-seat',),
       desc='남쪽 줄 7인 롱시트 3칸. 위로 앉는 판 윗면, 아래로 등받이 뒤판이 보인다. 양 끝 소매 칸막이. 북쪽(통로)을 보고 앉는다.')
def _seat_long_s(c): _seat_s(c, 'kon')


@R.obj('st-priority-seat', '우선석(북쪽 벽)', w=3, h=1, up=16, kind='wall', cat='train', cat_ko='전철 차내', use=('sit',), facing='S', tags=('전철', '차내', '좌석', '우선석'),
       place='차내 북쪽 벽, 차량 끝 연결 문 옆', pair=('st-car-end', 'st-priority-seat-s'),
       desc='좌석 천만 주황으로 다른 우선석 롱시트 3칸(모양은 롱시트와 같다). 차량 끝 쪽에 둔다. 남쪽을 보고 앉는다.')
def _seat_prio(c): _seat_n(c, 'daidai')


@R.obj('st-priority-seat-s', '우선석(남쪽 줄)', w=3, h=1, up=0, kind='floor', cat='train', cat_ko='전철 차내', use=('sit',), facing='N', tags=('전철', '차내', '좌석', '우선석'),
       place='차내 남쪽 줄, 차량 끝 쪽', pair=('st-priority-seat',),
       desc='주황 천의 남쪽 줄 우선석 3칸. 북쪽을 보고 앉는다.')
def _seat_prio_s(c): _seat_s(c, 'daidai')


@R.obj('st-car-door', '전철 출입문(양쪽 미닫이)', w=2, kind='hang', hrows=2, cat='train', cat_ko='전철 차내', use=('travel',), tags=('전철', '차내', '출입문'),
       place='차내 북쪽 벽면 윗줄, 좌석 사이 — 바로 앞 두 칸이 승강장으로 내리는 칸', pair=('st-long-seat', 'st-pole'),
       desc='스테인리스 양쪽 미닫이 출입문 2칸. 문짝마다 세로 창(너머 승강장 하늘·거리), 가운데 검은 고무 이음, 위에 붉은 열림 등, 문짝 앞 끝 노란 줄. 문 앞 칸에서 내린다.')
def _car_door(c):
    rc(c, 0, 0, 32, 32, K('tekko', 0))
    for x0 in (1, 16):
        rc(c, x0, 2, 15, 30, K('tekko', 1)); vl(c, x0, 2, 30, K('tekko', 3)); vl(c, x0 + 14, 2, 30, K('tekko', -1))
        rc(c, x0 + 4, 5, 7, 14, K('tekko', -1)); view(c, x0 + 5, 6, 5, 12, x0)
        hl(c, x0 + 4, 19, 7, K('tekko', 2))
        hl(c, x0 + 1, 24, 13, K('tekko', 2)); hl(c, x0 + 1, 25, 13, K('tekko', 0))
    vl(c, 15, 2, 30, OL); vl(c, 16, 2, 30, K('yoru', -2))
    rc(c, 13, 0, 6, 2, K('aka', 0)); hl(c, 13, 0, 6, K('aka', 1))
    vl(c, 14, 2, 30, K('kii', 1)); vl(c, 17, 2, 30, K('kii', 1))
    outline(c, 0, 0, 32, 32, OL)


@R.obj('st-car-end', '차량 끝 연결 문', w=1, h=1, up=16, kind='wall', cat='train', cat_ko='전철 차내', use=('open',), tags=('전철', '차내', '연결문'),
       place='차내 북쪽 줄 양 끝(차량 끝 벽 앞)', pair=('st-priority-seat',),
       desc='차량 끝 스테인리스 연결 문 한 칸. 위에 작은 창(옆 칸의 크림 벽·좌석이 보인다), 오른쪽 손잡이, 아래 문턱. 양 끝에 하나씩.')
def _car_end(c):
    rc(c, 0, 0, 16, 32, K('tekko', 0)); outline(c, 0, 0, 16, 32, OL)
    rc(c, 2, 2, 12, 28, K('tekko', 1)); vl(c, 2, 2, 28, K('tekko', 3)); vl(c, 13, 2, 28, K('tekko', -1)); hl(c, 2, 2, 12, K('tekko', 2))
    rc(c, 4, 5, 8, 10, K('kinari', 1)); rc(c, 4, 11, 8, 4, K('kon', 0)); hl(c, 4, 11, 8, K('kon', 1)); outline(c, 3, 4, 10, 12, OL)
    px(c, 5, 6, K('shiro', 2)); px(c, 6, 6, K('shiro', 2))
    rc(c, 10, 19, 2, 4, K('tekko', 3)); px(c, 11, 22, OL)
    rc(c, 1, 29, 14, 2, K('tekko', 2)); hl(c, 0, 31, 16, K('ita', -2))


@R.obj('st-pole', '손잡이 기둥', w=1, h=1, up=32, kind='floor', cat='train', cat_ko='전철 차내', tags=('전철', '차내', '손잡이'),
       place='롱시트 끝(문 옆)이나 롱시트 가운데 칸막이 자리 — 통로 두 줄은 막지 않는다', pair=('st-long-seat', 'st-car-door'),
       desc='바닥에서 천장까지 선 스테인리스 손잡이 기둥(세로 빛 줄). 아래 둥근 받침, 위 천장 봉에 닿는다. 통과 못 한다.')
def _pole(c):
    hl(c, 0, 0, 16, K('tekko', 2)); hl(c, 0, 1, 16, K('tekko', 0))
    rc(c, 7, 2, 2, 42, K('tekko', 1)); vl(c, 7, 2, 42, K('tekko', 3)); vl(c, 6, 2, 42, OL); vl(c, 9, 2, 42, OL)
    for y in (12, 26): hl(c, 6, y, 4, K('tekko', 2))
    rc(c, 4, 43, 8, 2, K('tekko', 2)); hl(c, 4, 43, 8, K('tekko', 3)); outline(c, 3, 42, 10, 4, OL)
    hl(c, 3, 46, 10, K('ita', -2))


@R.obj('st-strap', '손잡이 끈 줄', w=1, kind='hang', hrows=2, cat='train', cat_ko='전철 차내', tags=('전철', '차내', '손잡이'),
       place='차내 북쪽 벽면 윗줄, 롱시트 위로 가로 이어 건다', pair=('st-long-seat',),
       desc='천장 봉에 매달린 흰 손잡이 끈 하나(아래 둥근 고리). 롱시트 위로 가로 이어 건다. 그림자 없음.')
def _strap(c):
    hl(c, 0, 0, 16, OL); hl(c, 0, 1, 16, K('tekko', 3)); hl(c, 0, 2, 16, K('tekko', 1)); hl(c, 0, 3, 16, OL)
    x = 7
    vl(c, x, 4, 8, K('shiro', 0)); vl(c, x + 1, 4, 8, K('shiro', -1))
    hl(c, x - 1, 12, 4, OL); vl(c, x - 2, 13, 3, OL); vl(c, x + 3, 13, 3, OL); hl(c, x - 1, 16, 4, OL)
    hl(c, x - 1, 13, 4, K('shiro', 1)); vl(c, x - 1, 14, 2, K('shiro', 1)); vl(c, x + 2, 14, 2, K('shiro', -1)); hl(c, x, 15, 2, K('shiro', 0))


# ══ 탁상 물건(R.good, 16×16) ══════════════════════════════════════════════════
@R.good('st-newspaper', '신문', desc='반으로 접은 신문 한 부. 흰 종이에 회색 줄(글자 대신)과 사진 자리 회색 네모. 매점 카운터·벤치 위.')
def _newspaper(c):
    rc(c, 2, 4, 12, 9, K('shiro', 0)); hl(c, 2, 4, 12, K('shiro', 1)); vl(c, 2, 4, 9, K('shiro', 1))
    vl(c, 8, 5, 7, K('shiro', -1))
    rc(c, 3, 6, 4, 3, K('conc', -1))
    for y in (6, 8, 10): hl(c, 9, y, 4, K('conc', 0))
    hl(c, 3, 10, 4, K('conc', 0))
    outline(c, 1, 3, 14, 11, OL); hl(c, 2, 14, 13, K('conc', -2))


@R.good('st-ic-card', '교통 IC 카드', desc='초록 띠와 금색 칩이 있는 교통 IC 카드 한 장과 투명 케이스(글자 없음). 역무실 창구·개찰 옆 위.')
def _ic_card(c):
    rc(c, 3, 5, 10, 7, K('shiro', 1)); hl(c, 3, 5, 10, K('shiro', 2))
    rc(c, 3, 9, 10, 2, K(LINE, 0)); hl(c, 3, 9, 10, K(LINE, 1))
    rc(c, 4, 6, 3, 2, K('kii', 1)); px(c, 4, 6, K('kii', 2))
    outline(c, 2, 4, 12, 9, OL); hl(c, 3, 13, 11, K('conc', -2))


@R.good('st-ekiben', '역 도시락(에키벤)', desc='나무 도시락 상자 — 흰 밥, 연어(분홍)·달걀말이(노랑)·채소(초록) 칸, 옆에 나무젓가락. 매점 카운터 위.')
def _ekiben(c):
    rc(c, 1, 4, 13, 9, K('yuka', 0)); hl(c, 1, 4, 13, K('yuka', 2)); outline(c, 1, 4, 13, 10, OL)
    rc(c, 2, 5, 6, 7, K('shiro', 2)); px(c, 4, 7, K('shiro', 0)); px(c, 6, 9, K('shiro', 0)); px(c, 4, 6, K('aka', 0))
    vl(c, 8, 5, 7, K('yuka', -1))
    rc(c, 9, 5, 4, 3, K('pinku', 1)); rc(c, 9, 8, 2, 3, K('kii', 1)); rc(c, 11, 8, 2, 3, K(LINE, 1)); hl(c, 9, 8, 4, K('yuka', -1))
    hl(c, 1, 14, 14, K('conc', -2))
    hl(c, 3, 2, 12, K('yuka', 2)); hl(c, 3, 3, 12, K('yuka', 1)); px(c, 15, 2, OL)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

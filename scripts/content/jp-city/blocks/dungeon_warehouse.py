#!/usr/bin/env python3
"""jp_city 4묶음 현대 던전 — 밤의 지하상가·항만 창고. id 머리 `wh-`.
  python3 scripts/content/jp-city/blocks/dungeon_warehouse.py     # selftest + tiledata/jp-city/blocks/dungeon_warehouse/_all-x3.png

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 sumi, 팔레트 modern3 만. 글자·숫자·상표·로고·사람 없음.
화풍은 가게(cv-·sh-·fd-)·역(st-) 블록을 따르되, 던전이라 바닥·벽은 일반 판보다 1~2단 어둡고 얼룩·금·녹·물웅덩이가 있다.
조명은 꺼진 형광등·비상등(빨강·초록 점)으로만. 피·시체·사람·마네킹 없음 — 무서움은 어둠·잔해·흔적으로.

크기(§12-3 공식, 1칸 = 1m):
  가게 셔터 폭 2m·높이 2.2m → wall 2×1 up16(셔터 박스 T4 + 앞면 22). 진열창 2m·1.8m → wall 2×1 up16.
  지하상가 둥근 기둥 지름 0.8m·천장 3m → floor 1×1 up32. 벤치 1.8m×0.45m×0.45m → floor 2×1 up0.
  안내판 0.8m×1.6m → floor 1×1 up16. 에스컬레이터 폭 1.6m → 2칸(오르는 것 wall up32 · 내려가는 것 floor 2×2).
  자판기 1m×0.8m×1.8m → wall 1×1 up16(T4 F28). 손수레(대차) 0.9m×0.6m → floor 1×1.
  20피트 컨테이너 실물 6m×2.4m×2.6m → 가로 6×2(지붕 T20 + 긴 옆면 F22) · 세로 2×6(긴 지붕 + 남쪽 끝 문짝 F22), 둘 다 up16. 팔레트 1.1m×1.1m + 상자 1.2m → floor 1×1 up8.
  팔레트 랙 폭 2.7m·높이 3m → wall 3×1 up32. 지게차 1.1m×2.3m(포크 포함) → floor 1×2 up16. 나무 상자 0.8m → 1×1 up0.
  드럼통 지름 0.6m·높이 0.9m → 1×1 up0(T4 F12). 사다리 폭 0.6m·높이 4m → wall 1×1 up32. 사무 칸 창 2m → wall 2×1 up16.
분류는 interior/categories.py 의 undermall(지하상가)·warehouse(항만 창고).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'dungeon_warehouse'
R = Registry(BLOCK, '지하상가·창고')

TM = ('지하상가', '地下街', '던전', '밤')
TW = ('항만 창고', '倉庫', '창고', '던전', '부두')


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


def box3(c, x, y, w, top, front, ramp, t=0, rim=True):
    """3/4 상자: 윗면 top px(밝음 t+1, 테 t+2) + 앞 가장자리 하이라이트 1행 + 앞면 front px(t, 오른쪽 t-1) + 외곽선."""
    rc(c, x + 1, y + 1, w - 2, top, K(ramp, t + 1))
    if rim: hl(c, x + 1, y + 1, w - 2, K(ramp, t + 2)); vl(c, x + 1, y + 1, top, K(ramp, t + 2))
    hl(c, x + 1, y + 1 + top, w - 2, K(ramp, t + 2))
    rc(c, x + 1, y + 2 + top, w - 2, front, K(ramp, t))
    vl(c, x + w - 2, y + 2 + top, front, K(ramp, t - 1)); hl(c, x + 1, y + 1 + top + front, w - 2, K(ramp, t - 1))
    outline(c, x, y, w, top + front + 3)


def ground_shadow(c, x, y, w):
    hl(c, x, y, w, K('yoru', -2))


def grime(c, x0, y0, w, h, s, per=60, col=None):
    """같은 램프 단 내린 점 얼룩(재질 위에 흩뿌림) — col 이 없으면 yoru -1."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if rnd(x, y, s, per): px(c, x, y, col or K('yoru', -1))


def rust_drip(c, x, y0, n, s):
    for k in range(n):
        if rnd(x, y0 + k, s, 750): px(c, x, y0 + k, K('renga', -1) if k < n // 2 else K('soil', -1))


# ══ 바닥 ═════════════════════════════════════════════════════════════════════
@R.floor('wh-mall-floor', '지하상가 석재 바닥(밤)', cols=4, rows=4, tags=TM + ('통로', '광장'),
         desc='문 닫은 밤의 지하상가 바닥. 1m 광택 화강석 판을 깐 통로 바닥인데 불이 꺼져 한 단 어둡다. 판마다 왼위 모서리에 희미한 반사, '
              '군데군데 금 간 판과 먼지 얼룩. 지하상가 통로·광장 전체에 깐다.')
def _mall_floor(c):
    W, H = c.w, c.h
    for y in range(H):
        for x in range(W):
            tx, ty, lx, ly = x // 16, y // 16, x % 16, y % 16
            col = K('conc', -1) if hs(tx, ty, 103) % 4 else K('hodo', 1)
            if rnd(x, y, 101, 35): col = K('conc', -2)
            elif rnd(x, y, 102, 12): col = K('conc', 0)
            if lx == 0 or ly == 0: col = K('conc', -2)
            elif (lx == 1 and 1 <= ly <= 2) or (ly == 1 and lx <= 3): col = K('conc', 0)
            c.P(x, y, col)
    # 금 간 판 둘(지그재그 1px) + 먼지 얼룩
    for (sx, sy, n, s) in ((19, 35, 11, 1), (51, 4, 9, 2)):
        x, y = sx, sy
        for k in range(n):
            px(c, x % W, y % H, K('conc', -3))
            if k % 3 == 1: px(c, (x + 1) % W, y % H, K('conc', -2))
            x += 1; y += 1 if hs(k, s, 7) % 3 else 0
    for (cx, cy) in ((40, 52), (8, 20), (26, 6), (57, 37)):
        for dy in range(-2, 3):
            for dx in range(-3, 4):
                if abs(dx) + abs(dy) <= 3 and rnd(cx + dx, cy + dy, 104, 600): px(c, (cx + dx) % W, (cy + dy) % H, K('hodo', -1))


@R.floor('wh-warehouse-floor', '창고 콘크리트 바닥(바퀴 자국·기름)', cols=4, rows=4, tags=TW + ('기계실',),
         desc='항만 창고의 거친 콘크리트 바닥. 골재 점, 4m 마다 줄눈, 지게차 바퀴 자국 두 줄과 검은 기름 얼룩. 창고 홀·하역장·기계실에 깐다.')
def _warehouse_floor(c):
    W, H = c.w, c.h
    for y in range(H):
        for x in range(W):
            col = K('hodo', -1)
            if rnd(x, y, 111, 50): col = K('hodo', -2)
            elif rnd(x, y, 112, 28): col = K('hodo', 0)
            # 바퀴 자국 두 줄(가로, 끊긴 디더)
            for ty in (21, 29):
                if y in (ty, ty + 1) and (x * 7 + y * 3) % 5 and hs(x // 8, ty, 113) % 5: col = K('yoru', 0)
            c.P(x, y, col)
    for x in range(W): px(c, x, 0, K('hodo', -2)); px(c, x, 1, K('hodo', 0))
    for y in range(H): px(c, 0, y, K('hodo', -2)); px(c, 1, y, K('hodo', 0))
    # 기름 얼룩(덩이 + 번진 테)
    for (cx, cy, rx, ry) in ((44, 48, 6, 3), (14, 10, 3, 2)):
        for dy in range(-ry - 1, ry + 2):
            for dx in range(-rx - 1, rx + 2):
                d = (dx / (rx + .5)) ** 2 + (dy / (ry + .5)) ** 2
                if d <= 1: px(c, cx + dx, cy + dy, K('yoru', -1) if d < .55 else K('yoru', 0))
                elif d <= 1.4 and rnd(cx + dx, cy + dy, 114, 500): px(c, cx + dx, cy + dy, K('yoru', 0))
        px(c, cx - rx // 2, cy - 1, K('tekko', 0))                                    # 기름 번들거림


@R.floor('wh-office-floor', '창고 사무실 바닥(낡은 P타일)', cols=2, rows=2, tags=TW + ('사무실', '경비실'),
         desc='창고 사무 칸·경비실의 낡은 비닐 P타일. 1m 판 이음과 대리석 결이 희미하고, 의자 바퀴에 긁힌 자국. 어둡게 바랜 청회색.')
def _office_floor(c):
    for y in range(c.h):
        for x in range(c.w):
            col = K('lino', -1) if ((x // 16) + (y // 16)) % 2 else K('hodo', 0)
            if (x + y * 2) % 11 == 0 and rnd(x // 3, y, 121, 300): col = K('lino', 0)
            elif rnd(x, y, 122, 50): col = K('lino', -2)
            if x % 16 == 0 or y % 16 == 0: col = K('lino', -2)
            c.P(x, y, col)
    for k in range(6): px(c, 20 + k, 9 + (k // 2), K('lino', -2)); px(c, 6 + k, 25 - (k // 3), K('lino', 0))


@R.floor('wh-grating', '캣워크 철망 바닥(그레이팅)', cols=2, rows=2, tags=TW + ('캣워크', '중이층'),
         desc='중이층 캣워크의 쇠 그레이팅 바닥. 세로 쇠살 사이로 아래 어둠이 보이고 8px 마다 가로대. 중이층 통로·사무실 앞에 깐다.')
def _grating(c):
    for y in range(c.h):
        for x in range(c.w):
            col = K('yoru', -2) if (y // 4) % 2 else K('yoru', -3)
            if x % 3 == 0: col = K('tekko', 0)
            elif x % 3 == 1: col = K('tekko', -2) if y % 2 else col
            if y % 8 == 0: col = K('tekko', -1)
            if x % 3 == 0 and y % 8 == 1: col = K('tekko', 1)
            if x % 16 == 0: col = K('tekko', -3)
            c.P(x, y, col)
    for (x, y) in ((9, 13), (24, 27), (18, 4)): px(c, x, y, K('tekko', 1))


# ══ 벽면(2줄 = 32px) ══════════════════════════════════════════════════════════
@R.wall('wh-mall-wall', '지하상가 벽(꺼진 간판 띠 + 기둥 판)', cols=4, tags=TM + ('통로',),
        desc='지하상가 통로 벽. 윗줄은 불 꺼진 간판 띠(빈 라이트박스, 글자 없음), 아랫줄은 어두운 흰 패널과 4m 마다 스테인리스 기둥 판, 찢긴 벽보 자국과 물때. '
             '셔터 내린 가게(wh-shopfront-*)·진열창이 이 벽 아래에 선다.')
def _mall_wall(c):
    W = c.w
    rc(c, 0, 0, W, 10, K('tekko', -2)); hl(c, 0, 9, W, K('yoru', -2))
    for bx in (6, 38):                                                              # 꺼진 라이트박스 두 개
        rc(c, bx, 2, 22, 6, K('garasu', -3)); outline(c, bx - 1, 1, 24, 8, K('tekko', -1))
        hl(c, bx, 2, 22, K('garasu', -2))
        rc(c, bx + 3, 4, 6, 2, K('aka', -2) if bx == 6 else K('kon', -1)); rc(c, bx + 12, 4, 7, 2, K('garasu', -2))
    rc(c, 0, 10, W, 16, K('shiro', -2))
    for y in range(10, 26):
        for x in range(W):
            if rnd(x, y, 131, 30): px(c, x, y, K('hodo', 0))
    for x in range(0, W, 16): vl(c, x, 10, 16, K('hodo', 0))
    for x0 in (0, 32):                                                              # 스테인리스 기둥 판
        rc(c, x0, 10, 6, 16, K('tekko', 0)); vl(c, x0 + 1, 10, 16, K('tekko', 2)); vl(c, x0 + 5, 10, 16, K('tekko', -2))
        vl(c, x0 + 3, 12, 12, K('tekko', 1))
    rc(c, 44, 13, 9, 9, K('kinari', -1)); outline(c, 44, 13, 9, 9, K('kinari', -2))  # 찢긴 벽보 자국(빈 종이)
    for k in range(4): px(c, 52 - k, 21 - k * 0, K('shiro', -2)) if k < 2 else None
    rc(c, 49, 18, 4, 4, K('shiro', -2)); px(c, 49, 18, K('kinari', -2))
    for x in (13, 27, 58): rust_drip(c, x, 10, 9, x)                               # 물때 줄
    rc(c, 0, 26, W, 6, K('tekko', -2)); hl(c, 0, 26, W, K('tekko', 0)); hl(c, 0, 31, W, K('yoru', -2))


@R.wall('wh-warehouse-wall', '창고 골함석 벽', cols=4, tags=TW,
        desc='항만 창고의 회색 골함석(각파 강판) 벽. 4px 골 줄, 허리 높이 쇠 띠(가로대)와 리벳, 띠 아래로 녹 물이 흘렀다. 맨 아래 콘크리트 턱.')
def _warehouse_wall(c):
    W = c.w
    for y in range(32):
        for x in range(W):
            p = x % 6
            col = (K('tekko', 1), K('tekko', 0), K('tekko', 0), K('tekko', -1), K('tekko', -3), K('tekko', -2))[p]
            if y < 5 and p in (1, 2): col = K('tekko', -1)                           # 위 처마 밑 그늘(골 등만)
            c.P(x, y, col)
    for x in range(0, W, 32): vl(c, x, 0, 25, K('tekko', -3)); vl(c, x + 1, 0, 25, K('tekko', 1))
    for (rx, ry, rw, rh) in ((41, 19, 5, 5),):                         # 녹 번진 판
        for y in range(ry, ry + rh):
            for x in range(rx, rx + rw):
                if rnd(x, y, 143, 650) and x % 6 not in (0,): px(c, x, y, K('renga', -1) if x % 6 in (1, 2) else K('renga', -2))
    rc(c, 0, 11, W, 3, K('tekko', 0)); hl(c, 0, 11, W, K('tekko', 2)); hl(c, 0, 13, W, K('tekko', -2)); hl(c, 0, 14, W, K('yoru', -2))
    for x in range(4, W, 8): px(c, x, 12, K('tekko', 2)); px(c, x, 13, K('yoru', -1))
    for x in (6, 39): rust_drip(c, x, 15, 9, x)
    for x in (21, 54): rust_drip(c, x, 15, 5, x + 7)
    grime(c, 0, 18, W, 7, 141, 18, K('soil', -1))
    rc(c, 0, 25, W, 7, K('conc', -2)); hl(c, 0, 25, W, K('conc', 0)); hl(c, 0, 26, W, K('conc', -1)); hl(c, 0, 31, W, K('yoru', -1))
    grime(c, 0, 27, W, 4, 142, 90, K('conc', -3))


@R.wall('wh-service-wall', '콘크리트 뒷벽(배관)', cols=4, tags=TM + TW + ('기계실', '경비실', '뒷통로'),
        desc='손님이 안 보는 뒷통로·기계실·경비실의 맨 콘크리트 벽. 거푸집 판 자국과 세퍼레이터 구멍, 윗줄에 가로 배관과 받침쇠, 배관 밑으로 번진 물때.')
def _service_wall(c):
    W = c.w
    rc(c, 0, 0, W, 32, K('conc', -2))
    for y in range(32):
        for x in range(W):
            if rnd(x, y, 151, 45): px(c, x, y, K('conc', -3))
            elif rnd(x, y, 152, 20): px(c, x, y, K('conc', -1))
    for x in range(0, W, 16): vl(c, x, 8, 22, K('conc', -3))
    hl(c, 0, 19, W, K('conc', -3))
    for x0 in range(0, W, 16):
        for (dx, dy) in ((4, 12), (12, 12), (4, 24), (12, 24)): px(c, x0 + dx, dy, K('yoru', -2)); px(c, x0 + dx, dy + 1, K('conc', -1))
    rc(c, 0, 3, W, 4, K('tekko', -1)); hl(c, 0, 3, W, K('tekko', 1)); hl(c, 0, 4, W, K('tekko', 0)); hl(c, 0, 6, W, K('tekko', -3))
    for x in range(10, W, 32): rc(c, x, 2, 3, 6, K('tekko', -2)); hl(c, x, 2, 3, K('tekko', 0))
    for x in (17, 29, 47, 60):
        for k in range(10):
            if rnd(x, k, 153, 700): px(c, x, 7 + k, K('conc', -3))
    rc(c, 0, 29, W, 3, K('conc', -3)); hl(c, 0, 29, W, K('conc', -1))


@R.wall('wh-office-wall', '창고 사무실 벽(낡은 조립 패널)', cols=4, tags=TW + ('사무실', '경비실'),
        desc='창고 안 조립식 사무 칸·경비실의 낡은 회색 패널 벽. 1m 마다 세로 이음 쇠띠, 허리 아래는 한 단 어두운 판, 테이프 자국과 손때 얼룩. 아래 검은 고무 걸레받이.')
def _office_wall(c):
    W = c.w
    rc(c, 0, 0, W, 17, K('hodo', 1)); rc(c, 0, 17, W, 10, K('hodo', 0))
    hl(c, 0, 16, W, K('hodo', 2)); hl(c, 0, 17, W, K('hodo', -1))
    for x in range(0, W, 16): vl(c, x, 0, 27, K('tekko', -1)); vl(c, x + 1, 0, 27, K('hodo', 2))
    for y in range(0, 27):
        for x in range(W):
            if rnd(x, y, 155, 35): px(c, x, y, K('hodo', -1))
    for (tx, ty) in ((6, 6), (37, 9), (52, 4)):                                   # 떼어 낸 테이프 자국
        hl(c, tx, ty, 4, K('kinari', -1)); px(c, tx + 5, ty + 1, K('kinari', -2))
    for x in (22, 45): rust_drip(c, x, 18, 7, x)
    rc(c, 0, 27, W, 5, K('yoru', -1)); hl(c, 0, 27, W, K('yoru', 1)); hl(c, 0, 31, W, K('yoru', -2))


@R.wall('wh-container-wall', '쌓인 컨테이너 옆면(벽)', cols=12, tags=TW + ('컨테이너', '캣워크', '중이층'),
        desc='천장까지 2단으로 쌓인 20피트 컨테이너 더미(한 대 = 6칸 길이)의 옆면을 벽처럼 쓴다. 윗단 파랑·초록, 아랫단 빨강·파랑이 3칸씩 엇갈려 쌓였고, '
             '세로 골·위아래 레일·모서리 쇠붙이·단 사이 검은 틈·녹 물때. 중이층 캣워크가 도는 가운데 덩이에 깐다.')
def _container_wall(c):
    W = c.w                                                                          # 192px = 컨테이너 둘
    for (y0, y1, ramps, off) in ((0, 15, ('sora', 'midori'), 48), (16, 31, ('aka', 'sora'), 0)):
        for x in range(W):
            k = ((x - off) % W) // 96
            r_ = ramps[k]
            lx = (x - off) % 96
            for y in range(y0 + 2, y1 - 1):
                c.P(x, y, (K(r_, 0), K(r_, 1), K(r_, -1), K(r_, -2))[lx % 4])
            px(c, x, y0, K('tekko', -2)); px(c, x, y0 + 1, K(r_, 1)); px(c, x, y1 - 1, K(r_, -2)); px(c, x, y1, K('yoru', -2))
            if lx in (0, 95): vl(c, x, y0, y1 - y0 + 1, K('yoru', -3))
        for k in range(2):
            x0 = (off + k * 96) % W
            for (dx, dy) in ((1, y0 + 1), (91, y0 + 1), (1, y1 - 3), (91, y1 - 3)):
                for i in range(4):
                    for j in range(3): px(c, (x0 + dx + i) % W, dy + j, K('tekko', -1))
                px(c, (x0 + dx + 1) % W, dy + 1, K('yoru', -2))
    hl(c, 0, 15, W, K('yoru', -3)); hl(c, 0, 16, W, K('yoru', -2))
    for x in (11, 44, 70, 113, 150, 177): rust_drip(c, x, 3, 10, x); rust_drip(c, (x + 23) % W, 19, 10, x + 5)
    hl(c, 0, 31, W, K('yoru', -3))


# ══ 지하상가 — 가게 앞 ═══════════════════════════════════════════════════════
def _shutter(c, ramp, t, open_to=27, inside=False, seed=0):
    """가게 셔터 2칸(32×32): 셔터 박스 윗면 T4 + 앞 가장자리 + 박스 앞면 + 처마 그림자 2 + 들어간 셔터 살 + 바닥 레일."""
    W = 32
    rc(c, 1, 0, W - 2, 4, K(ramp, t + 1)); hl(c, 1, 0, W - 2, K(ramp, t + 2))
    hl(c, 1, 4, W - 2, K(ramp, t + 2))
    rc(c, 1, 5, W - 2, 3, K(ramp, t - 1)); hl(c, 1, 7, W - 2, K(ramp, t - 2))
    outline(c, 0, 0, W, 9)
    hl(c, 1, 8, W - 2, K('yoru', -2)); hl(c, 1, 9, W - 2, K('yoru', -1))
    for gx in (1, 29):                                                              # 양옆 레일
        rc(c, gx, 9, 2, 20, K('tekko', -2)); vl(c, gx, 9, 20, K('tekko', 0))
    if inside:                                                                      # 반쯤 열린 가게 속 어둠
        rc(c, 3, open_to, 26, 29 - open_to, K('sumi', 0))
        for (bx, bw, bh) in ((5, 6, 5), (12, 5, 3), (22, 6, 6)):                    # 쌓인 상자
            by = 28 - bh
            rc(c, bx, by, bw, bh, K('soil', -1)); hl(c, bx, by, bw, K('soil', 0)); outline(c, bx - 1, by - 1, bw + 2, bh + 2, K('sumi', -1))
        hl(c, 4, open_to + 1, 24, K('tekko', -2))                                     # 옷걸이 봉
        for (gx2, r_) in ((16, 'murasaki'), (19, 'kon'), (24, 'yuka')):
            rc(c, gx2, open_to + 2, 3, 6, K(r_, -2)); px(c, gx2 + 1, open_to + 1, K('tekko', -1))
    for y in range(10, open_to):
        p = (y - 10) % 3
        hl(c, 3, y, 26, (K(ramp, t), K(ramp, t - 1), K(ramp, t - 2))[p])
    for x in range(3, 29):
        for y in range(10, open_to):
            if rnd(x, y, 160 + seed, 25): px(c, x, y, K(ramp, t + 1))
            elif rnd(x, y, 170 + seed, 30): px(c, x, y, K('yoru', -1))
    for x in (9, 22): rust_drip(c, x, 13, open_to - 14, seed + x)
    hl(c, 3, open_to, 26, K(ramp, t + 2)); hl(c, 3, open_to + 1, 26, K(ramp, t - 2))      # 아래 막대
    rc(c, 14, open_to - 1, 4, 2, K('tekko', 1)); px(c, 15, open_to, K('kii', 0))            # 손잡이·열쇠 구멍
    hl(c, 0, 29, W, K('conc', 0)); hl(c, 0, 30, W, K('conc', -2)); hl(c, 0, 31, W, K('yoru', -2))
    vl(c, 0, 9, 21, OL); vl(c, 31, 9, 21, OL)


@R.obj('wh-shopfront-shutter', '가게 셔터(내림)', w=2, h=1, up=16, kind='wall', use=('block',), tags=TM + ('셔터', '가게'),
       place='지하상가 통로 북쪽 벽 바로 아래 줄 — 2칸씩 이어 가게 줄을 만든다(같은 셔터만 늘어놓지 말고 진열창·다른 색 셔터를 섞는다)',
       pair=('wh-shop-window', 'wh-shopfront-shutter-b', 'wh-shopfront-half'),
       desc='문 닫은 지하상가 가게 앞의 회색 강철 셔터 2칸. 위에 셔터 박스(윗면이 보인다), 아래로 가로 골 살, 바닥 막대에 손잡이와 열쇠 구멍. 먼지와 녹 물때. 지나갈 수 없다.')
def _sf_shutter(c): _shutter(c, 'tekko', 0, seed=1)


@R.obj('wh-shopfront-shutter-b', '가게 셔터(크림 칠, 내림)', w=2, h=1, up=16, kind='wall', use=('block',), tags=TM + ('셔터', '가게'),
       place='지하상가 통로 북쪽 벽 바로 아래 줄 — 회색 셔터·진열창 사이에 섞는다', pair=('wh-shopfront-shutter', 'wh-shop-window'),
       desc='크림색 칠이 바랜 오래된 가게 셔터 2칸. 칠이 벗겨진 자리에 녹 점, 아래 막대에 손잡이. 지나갈 수 없다.')
def _sf_shutter_b(c):
    _shutter(c, 'kinari', -1, seed=2)
    for x in range(1, 31):                                                           # 셔터 박스 앞 빛바랜 빨간 줄무늬 차양
        col = K('aka', -1) if (x // 4) % 2 else K('kinari', 0)
        for y in range(4, 9): px(c, x, y, col if y < 8 else K('aka', -2) if (x // 4) % 2 else K('kinari', -1))
    for x in range(1, 31, 4): px(c, x, 9, K('aka', -2)); px(c, x + 1, 9, K('aka', -2))
    hl(c, 1, 4, 30, K('kinari', 1)); hl(c, 1, 10, 30, K('yoru', -2))


@R.obj('wh-shopfront-half', '반쯤 열린 가게 셔터', w=2, h=1, up=16, kind='wall', use=('search',), tags=TM + ('셔터', '가게', '조사'),
       place='지하상가 통로 북쪽 벽 바로 아래 줄 — 가게 줄 가운데 하나(조사 자리)', pair=('wh-shopfront-shutter', 'wh-item-bag'),
       desc='허리 높이까지만 내려온 가게 셔터 2칸. 셔터 아래 틈으로 캄캄한 가게 안의 쌓인 상자와 옷걸이 봉의 옷 몇 벌이 보인다(마네킹 없음). 조사하면 무언가 나온다.')
def _sf_half(c): _shutter(c, 'tekko', 0, open_to=18, inside=True, seed=3)


@R.obj('wh-shop-window', '어두운 진열창', w=2, h=1, up=16, kind='wall', use=('search',), tags=TM + ('진열창', '가게'),
       place='지하상가 통로 북쪽 벽 바로 아래 줄, 셔터 가게 사이', pair=('wh-shopfront-shutter',),
       desc='불 꺼진 가게 진열창 2칸. 쇠 틀 윗면, 검푸른 유리에 비스듬한 반사와 금 한 줄, 유리 너머로 옷걸이에 걸린 옷 세 벌과 상자 더미 그림자(마네킹 없음), 아래 돌 창턱.')
def _shop_window(c):
    rc(c, 1, 0, 30, 4, K('tekko', 0)); hl(c, 1, 0, 30, K('tekko', 2)); hl(c, 1, 4, 30, K('tekko', 2))
    outline(c, 0, 0, 32, 6); hl(c, 1, 5, 30, K('tekko', -2))
    hl(c, 1, 6, 30, K('yoru', -2)); hl(c, 1, 7, 30, K('yoru', -1))
    rc(c, 2, 6, 28, 18, K('garasu', -3))
    hl(c, 4, 9, 24, K('tekko', -2))                                                 # 옷걸이 봉
    for (gx, r_) in ((6, 'kon'), (10, 'aka'), (14, 'kinari')):
        px(c, gx + 1, 9, K('tekko', -1)); rc(c, gx, 10, 3, 8, K(r_, -2)); hl(c, gx, 10, 3, K(r_, -1))
    hl(c, 3, 19, 26, K('tekko', -2))                                               # 진열 단
    for (bx, bw, r_) in ((18, 5, 'soil'), (24, 5, 'soil')):
        rc(c, bx, 20, bw, 3, K(r_, -2)); hl(c, bx, 20, bw, K(r_, -1))
    for (fx, r_) in ((18, 'murasaki'), (24, 'midori')):
        rc(c, fx, 16, 5, 3, K(r_, -2)); hl(c, fx, 16, 5, K(r_, -1))
    for k in range(9):                                                              # 유리 반사(사선)
        px(c, 3 + k, 22 - k, K('garasu', -1)); px(c, 5 + k, 22 - k, K('garasu', -2))
    for k in range(6): px(c, 24 + (k % 2), 7 + k * 2, K('shiro', -2))                # 금 한 줄
    vl(c, 1, 6, 18, K('tekko', -1)); vl(c, 30, 6, 18, K('tekko', -2)); vl(c, 16, 6, 18, K('tekko', -1))
    vl(c, 0, 6, 26, OL); vl(c, 31, 6, 26, OL)
    rc(c, 1, 24, 30, 3, K('conc', 0)); hl(c, 1, 24, 30, K('conc', 1)); rc(c, 1, 27, 30, 3, K('conc', -2)); hl(c, 0, 30, 32, OL)
    hl(c, 1, 31, 30, K('yoru', -2))


# ══ 지하상가 — 통로·광장 ═════════════════════════════════════════════════════
@R.obj('wh-mall-pillar', '지하상가 둥근 기둥', w=1, h=1, up=32, kind='floor', use=('block',), tags=TM + ('기둥', '광장'),
       place='광장·넓은 통로 가운데, 3~4칸 간격 — 통로를 막지 않게', pair=('wh-mall-bench', 'wh-guide-board'),
       desc='천장까지 닿는 둥근 석재 기둥(3m). 위 천장 쪽 테두리 고리, 몸통은 왼쪽이 밝고 오른쪽이 어두운 원통, 허리에 떨어진 벽보 자국, 아래 받침 고리. 지나갈 수 없다.')
def _pillar(c):
    sh = (K('conc', 1), K('conc', 1), K('conc', 0), K('conc', 0), K('conc', 0), K('conc', -1), K('conc', -1), K('conc', -1), K('conc', -2), K('conc', -2))
    rc(c, 2, 0, 12, 3, K('tekko', -1)); hl(c, 2, 0, 12, K('tekko', 0)); hl(c, 2, 2, 12, K('tekko', -2))   # 천장 고리
    hl(c, 3, 3, 10, K('yoru', -2))
    for y in range(3, 44):
        for i, col in enumerate(sh): px(c, 3 + i, y, col)
        if y % 12 == 6: hl(c, 3, y, 10, K('conc', -2))                               # 석판 이음
    for y in range(4, 42, 1):
        if rnd(y, 0, 181, 120): px(c, 4, y, K('conc', 2))
    rc(c, 4, 21, 6, 6, K('kinari', -2)); hl(c, 4, 21, 6, K('kinari', -1)); px(c, 9, 26, K('conc', -1)); px(c, 8, 26, K('conc', -1))
    for k in range(5): px(c, 10 + (k % 2), 28 + k, K('conc', -3))                    # 금
    vl(c, 2, 3, 41, OL); vl(c, 13, 3, 41, OL)
    rc(c, 1, 41, 14, 4, K('conc', 0)); hl(c, 2, 41, 12, K('conc', 1)); hl(c, 1, 44, 14, K('conc', -2))
    outline(c, 1, 40, 14, 6); hl(c, 1, 46, 14, K('yoru', -2)); hl(c, 2, 47, 12, K('conc', -3))


@R.obj('wh-mall-bench', '지하상가 벤치', w=2, h=1, up=0, kind='floor', use=('sit',), facing='S', tags=TM + ('벤치', '광장'),
       place='광장·통로 가장자리, 기둥 곁', pair=('wh-mall-pillar',),
       desc='등받이 없는 나무 널 벤치 2칸(쇠 다리). 널 윗면이 보이고 먼지가 앉았다. 한쪽 널이 빠졌다.')
def _bench(c):
    for i, y in enumerate((1, 3, 5)):
        if i == 1: hl(c, 2, y, 28, K('yoru', -2)); hl(c, 2, y + 1, 28, K('yoru', -1)); continue   # 빠진 널
        hl(c, 2, y, 28, K('ita', 2)); hl(c, 2, y + 1, 28, K('ita', 0))
    for x in range(4, 30, 7): px(c, x, 1, K('ita', 0))
    hl(c, 2, 7, 28, K('ita', 2)); rc(c, 2, 8, 28, 2, K('ita', -1)); hl(c, 2, 10, 28, K('ita', -2))
    outline(c, 1, 0, 30, 11)
    for x in (4, 25): rc(c, x, 11, 3, 4, K('tekko', -1)); vl(c, x, 11, 4, K('tekko', 0)); outline(c, x - 1, 11, 5, 4)
    hl(c, 1, 15, 30, K('yoru', -2))
    grime(c, 2, 1, 28, 6, 191, 70, K('ita', 1))


@R.obj('wh-guide-board', '지하상가 안내판(꺼짐)', w=1, h=1, up=16, kind='floor', use=('read',), tags=TM + ('안내판', '지도'),
       place='광장·통로 갈림길 가운데(통로 1칸은 남긴다)', pair=('wh-mall-pillar',),
       desc='서 있는 지하상가 층 안내판(불 꺼짐). 쇠 틀 속 검푸른 판에 가게 칸을 나눈 회색 선과 초록·노랑 길 선, 빨간 현재 위치 점(글자 없음). 유리에 금.')
def _guide(c):
    rc(c, 1, 2, 14, 3, K('tekko', 1)); hl(c, 1, 2, 14, K('tekko', 2)); hl(c, 1, 5, 14, K('tekko', 2))
    rc(c, 1, 6, 14, 16, K('tekko', -1))
    rc(c, 2, 7, 12, 13, K('kon', -2))
    for y in (9, 13, 17): hl(c, 3, y, 10, K('tekko', -1))
    for x in (6, 10): vl(c, x, 8, 11, K('tekko', -1))
    hl(c, 3, 11, 10, K('midori', -1)); vl(c, 8, 8, 11, K('kii', -1)); px(c, 8, 15, K('aka', 1)); px(c, 9, 15, K('aka', 0))
    for k in range(5): px(c, 11 - k, 8 + k * 2, K('garasu', -1))
    outline(c, 0, 1, 16, 22)
    rc(c, 6, 23, 4, 6, K('tekko', -1)); vl(c, 6, 23, 6, K('tekko', 0)); vl(c, 5, 23, 6, OL); vl(c, 10, 23, 6, OL)
    rc(c, 3, 28, 10, 3, K('tekko', 0)); hl(c, 3, 28, 10, K('tekko', 1)); outline(c, 2, 27, 12, 5); hl(c, 3, 31, 10, K('yoru', -2))


def _esc_rail(c, x, y0, y1, side):
    """에스컬레이터 난간: 유리 판 + 검은 고무 손잡이 + 스테인리스 치마판."""
    rc(c, x, y0, 4, y1 - y0, K('garasu', -2))
    for y in range(y0, y1):
        if (y + x) % 7 == 0: px(c, x + 1, y, K('garasu', 0))
    vl(c, x + (0 if side < 0 else 3), y0, y1 - y0, K('sumi', 0))                    # 고무 손잡이
    vl(c, x + (1 if side < 0 else 2), y0, y1 - y0, K('sumi', 1))
    vl(c, x + (3 if side < 0 else 0), y0, y1 - y0, K('tekko', 1))                    # 치마판
    vl(c, x - 1 if side < 0 else x + 4, y0, y1 - y0, OL)


@R.obj('wh-escalator-stopped', '멈춘 에스컬레이터(위로)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',),
       tags=TM + ('에스컬레이터', 'エスカレーター', '이동', '위층'),
       place='북쪽 벽 바로 아래 줄(벽 가구 자리) — 2칸 발판에 위층(또는 지상)으로 가는 이동', pair=('wh-escalator-down',),
       desc='전원이 끊겨 멈춘 오르는 에스컬레이터 2칸. 북쪽 벽 속 어둠으로 홈 파인 쇠 디딤판이 올라가고, 디딤판 양끝 노란 테, 양옆 유리 난간과 검은 고무 손잡이. '
            '발판 두 칸(빗살판)은 걸을 수 있고 그 칸에서 위로 올라간다.')
def _esc_up(c):
    rc(c, 4, 0, 24, 34, K('sumi', -1))
    for i in range(6):                                                               # 디딤판(밝은 윗면 3) + 챌판(어둠 2), 위로 갈수록 어둡다
        y = 29 - i * 5
        t = 2 - i
        rc(c, 5, y, 22, 3, K('tekko', t)); hl(c, 5, y, 22, K('tekko', t + 1))
        for x in range(6, 26, 2): px(c, x, y + 2, K('tekko', t - 1))
        rc(c, 5, y + 3, 22, 2, K('yoru', -2 if i < 3 else -3))
        if i < 4: vl(c, 5, y, 3, K('kii', 0 - (i > 1))); vl(c, 26, y, 3, K('kii', 0 - (i > 1)))
    for (x, side) in ((0, -1), (28, 1)):                                             # 양옆 난간(벽 속으로 오른다)
        rc(c, x, 2, 4, 38, K('garasu', -2))
        for y in range(5, 38, 6): px(c, x + 1 + (side > 0), y, K('garasu', 0))
        vl(c, x + (0 if side < 0 else 3), 0, 40, K('sumi', 0)); vl(c, x + (1 if side < 0 else 2), 0, 40, K('sumi', 1))
        vl(c, x + (3 if side < 0 else 0), 2, 38, K('tekko', 1))
        vl(c, x - 1 if side < 0 else x + 4, 0, 40, OL)
        rc(c, x, 40, 4, 6, K('tekko', 0)); hl(c, x, 40, 4, K('tekko', 1)); outline(c, x, 39, 4, 7)
    rc(c, 4, 34, 24, 12, K('tekko', 0))                                              # 빗살판(발판, 밟는 칸)
    for x in range(5, 27, 2): vl(c, x, 37, 8, K('tekko', -1))
    hl(c, 4, 34, 24, K('kii', 1)); hl(c, 4, 35, 24, K('kii', -1)); hl(c, 4, 36, 24, K('tekko', 1))
    hl(c, 0, 46, 32, K('conc', -2)); hl(c, 0, 47, 32, K('yoru', -2))


@R.obj('wh-escalator-down', '멈춘 에스컬레이터(아래로)', w=2, h=2, up=16, kind='floor', walk=((0, 1), (1, 1)), stairs='down', use=('travel',),
       tags=TM + ('에스컬레이터', 'エスカレーター', '이동', '아래층'),
       place='통로 바닥 — 북쪽·옆이 트인 곳. 아랫줄 두 칸(빗살판)에 아래층으로 가는 이동', pair=('wh-escalator-stopped',),
       desc='바닥에 뚫린 내려가는 에스컬레이터 입구 2×2(멈춤). 북쪽으로 갈수록 어두워지는 쇠 디딤판, 양옆 유리 난간과 검은 고무 손잡이, 북쪽 끝 유리 칸막이. '
            '윗줄은 막히고 아랫줄 빗살판 두 칸을 밟으면 아래층으로 내려간다.')
def _esc_down(c):
    rc(c, 2, 2, 28, 34, K('sumi', -1))                                               # 바닥에 뚫린 구멍(어둠)
    for i in range(7):                                                               # 북쪽으로 내려가며 좁아지고 어두워지는 디딤판
        y = 31 - i * 4
        inset = 6 + i // 2
        t = 0 - i
        if t < -3: break
        hl(c, inset, y - 2, 32 - 2 * inset, K('tekko', t + 1)); hl(c, inset, y - 1, 32 - 2 * inset, K('tekko', t))
        for x in range(inset + 1, 32 - inset, 2): px(c, x, y - 1, K('tekko', t - 1))
    for k in range(32):                                                              # 양옆 난간: 아래(남쪽)는 넓고 북쪽으로 좁아진다
        y = 34 - k
        if y < 3: break
        xl = 2 + k // 8; xr = 29 - k // 8
        px(c, xl, y, K('sumi', 0)); px(c, xl + 1, y, K('sumi', 1)); px(c, xl + 2, y, K('garasu', -2)); px(c, xl + 3, y, K('tekko', 1) if k % 6 else K('garasu', 0))
        px(c, xr, y, K('sumi', 0)); px(c, xr - 1, y, K('sumi', 1)); px(c, xr - 2, y, K('garasu', -2)); px(c, xr - 3, y, K('tekko', -1))
        px(c, xl - 1, y, OL); px(c, xr + 1, y, OL)
    hl(c, 5, 2, 22, K('garasu', -2)); hl(c, 5, 3, 22, K('sumi', 0)); hl(c, 4, 1, 24, OL)          # 북쪽 끝 유리 칸막이
    rc(c, 1, 34, 30, 12, K('tekko', 0))                                              # 빗살판(밟는 칸)
    for x in range(2, 30, 2): vl(c, x, 37, 8, K('tekko', -1))
    hl(c, 1, 34, 30, K('kii', 1)); hl(c, 1, 35, 30, K('kii', -1)); hl(c, 1, 36, 30, K('tekko', 1))
    rc(c, 0, 30, 3, 16, K('tekko', 0)); rc(c, 29, 30, 3, 16, K('tekko', -1)); vl(c, 0, 30, 16, OL); vl(c, 31, 30, 16, OL)
    hl(c, 0, 46, 32, K('conc', -2)); hl(c, 0, 47, 32, K('yoru', -2))


@R.obj('wh-shutter-gate', '통로 격자 셔터(잠금 자리)', kind='door', use=('gate', 'key'), tags=TM + ('셔터', '잠긴 문', '문'),
       place='가로 칸막이(# 줄)의 1칸 틈 — 잠긴 문 자리(잠금은 이벤트로 단다)', pair=('wh-item-locker',),
       desc='지하상가 통로를 끊는 격자 셔터 한 칸. 쇠 격자 너머로 캄캄한 통로가 비쳐 보이고, 바닥 막대에 노란 자물쇠. 칸은 지나갈 수 있게 열려 있고 잠금은 이벤트로 단다.')
def _gate(c):
    rc(c, 2, 0, 12, 29, K('yoru', -3))
    for y in range(0, 29):
        for x in range(2, 14):
            if x % 3 == 2: px(c, x, y, K('tekko', 0) if y % 6 else K('tekko', 1))
            elif y % 6 == 0: px(c, x, y, K('tekko', -1))
            elif (x + y) % 6 == 0: px(c, x, y, K('tekko', -2))
    rc(c, 0, 0, 2, 30, K('tekko', -1)); vl(c, 0, 0, 30, K('tekko', 1)); rc(c, 14, 0, 2, 30, K('tekko', -2)); vl(c, 15, 0, 30, OL)
    hl(c, 2, 26, 12, K('tekko', 1)); hl(c, 2, 27, 12, K('tekko', -2))
    rc(c, 6, 27, 4, 3, K('kii', 1)); hl(c, 6, 27, 4, K('kii', 2)); outline(c, 5, 26, 6, 5); px(c, 7, 25, K('tekko', 1)); px(c, 8, 25, K('tekko', 1))
    hl(c, 0, 30, 16, K('tekko', 0)); hl(c, 0, 31, 16, K('yoru', -2))


@R.obj('wh-shutter-crawl', '반쯤 올라간 셔터(숙여 지나감)', kind='door', use=('travel',), tags=TM + ('셔터', '문', '가게'),
       place='가로 칸막이의 1칸 틈 — 통로에서 빈 가게 안으로 들어가는 자리',
       desc='허리 높이까지 내려온 강철 셔터 한 칸. 셔터 아래로 캄캄한 안쪽 바닥이 보이고 숙이면 지나갈 수 있다. 양옆 레일, 바닥 막대에 비틀린 손잡이.')
def _crawl(c):
    rc(c, 2, 0, 12, 30, K('yoru', -3))
    for y in range(0, 15):
        hl(c, 2, y, 12, (K('tekko', 0), K('tekko', -1), K('tekko', -2))[y % 3])
    hl(c, 2, 15, 12, K('tekko', 1)); hl(c, 2, 16, 12, K('tekko', -2)); px(c, 9, 17, K('tekko', 0)); px(c, 10, 18, K('tekko', 0))
    for y in range(17, 30):
        if y > 22: hl(c, 3, y, 10, K('yoru', -2 if y < 27 else -1))
    rc(c, 0, 0, 2, 30, K('tekko', -1)); vl(c, 0, 0, 30, K('tekko', 1)); rc(c, 14, 0, 2, 30, K('tekko', -2)); vl(c, 15, 0, 30, OL)
    hl(c, 0, 30, 16, K('tekko', 0)); hl(c, 0, 31, 16, K('yoru', -2))


@R.obj('wh-vending-dark', '불 꺼진 음료 자판기', w=1, h=1, up=16, kind='wall', use=('search',), tags=TM + TW + ('자판기', '자동판매기'),
       place='통로·휴게 자리 북쪽 벽 바로 아래 줄', pair=('wh-mall-bench',),
       desc='전원이 끊긴 흰 음료 자판기. 윗면, 어두운 진열창 속 빛바랜 병 두 줄, 꺼진 버튼 줄, 금 간 앞판, 아래 꺼내는 곳. 조사할 수 있다.')
def _vend(c):
    rc(c, 1, 1, 14, 4, K('shiro', -1)); hl(c, 1, 1, 14, K('shiro', 0)); hl(c, 1, 5, 14, K('shiro', 0))
    rc(c, 1, 6, 14, 24, K('shiro', -2)); vl(c, 1, 6, 24, K('shiro', -1)); vl(c, 14, 6, 24, K('hodo', 0))
    hl(c, 1, 6, 14, K('yoru', -1))
    rc(c, 3, 8, 10, 10, K('garasu', -3))
    for r_, y in enumerate((9, 13)):
        for i in range(4):
            col = ('aka', 'sora', 'kii', 'midori')[(i + r_) % 4]
            rc(c, 4 + i * 2, y, 1, 3, K(col, -2)); px(c, 4 + i * 2, y, K(col, -1))
        hl(c, 3, y + 3, 10, K('tekko', -2))
    for x in range(4, 12, 2): px(c, x, 19, K('tekko', -1))
    rc(c, 11, 20, 2, 3, K('tekko', -2))
    for k in range(4): px(c, 6 + k, 21 + k // 2, K('hodo', -1))
    rc(c, 3, 25, 10, 3, K('yoru', -2)); hl(c, 3, 24, 10, K('tekko', 0))
    outline(c, 0, 0, 16, 31); hl(c, 1, 31, 14, K('yoru', -2))


@R.obj('wh-cart-abandoned', '버려진 대차(손수레)', w=1, h=1, up=8, kind='floor', use=('search',), tags=TM + TW + ('손수레', '대차', '잔해'),
       place='통로 가장자리·가게 앞에 버려진 것 — 통로 1칸은 남긴다',
       desc='버려진 파란 판 대차 하나. 뒤(북쪽)에 쇠 손잡이 고리, 판 위에 찌그러진 골판지 상자 하나가 비스듬히, 아래 작은 바퀴.')
def _cart(c):
    rc(c, 3, 0, 10, 2, K('tekko', 0)); vl(c, 3, 0, 9, K('tekko', 0)); vl(c, 12, 0, 9, K('tekko', -1)); outline(c, 2, -1, 12, 4)
    vl(c, 2, 1, 9, OL); vl(c, 13, 1, 9, OL)
    rc(c, 1, 9, 14, 12, K('sora', -1)); hl(c, 1, 9, 14, K('sora', 0)); vl(c, 1, 9, 12, K('sora', 0))
    rc(c, 1, 21, 14, 3, K('sora', -2)); hl(c, 1, 21, 14, K('sora', 0)); outline(c, 0, 8, 16, 17)
    rc(c, 4, 11, 8, 7, K('soil', 0)); hl(c, 4, 11, 8, K('soil', 1)); rc(c, 4, 16, 8, 2, K('soil', -1)); px(c, 11, 11, K('soil', -1))
    vl(c, 8, 11, 5, K('kinari', -1)); outline(c, 3, 10, 10, 9, K('soil', -2))
    for x in (2, 12): rc(c, x, 25, 2, 3, K('yoru', -2)); px(c, x, 25, K('tekko', 0))
    hl(c, 1, 28, 14, K('yoru', -2))


# ══ 조명·표지(걸이) ══════════════════════════════════════════════════════════
@R.obj('wh-exit-sign', '비상구 유도등(초록)', w=1, kind='hang', hrows=2, use=('light',), tags=TM + TW + ('유도등', '비상구', '비상등'),
       place='문·계단·에스컬레이터 바로 위 벽면 윗줄', pair=('wh-emergency-lamp',),
       desc='어둠 속에 유일하게 켜진 초록 유도등. 흰 테의 초록 판에 흰 문 모양과 화살표(사람 그림·글자 없음), 판 밑으로 초록 빛이 번진 줄.')
def _exit(c):
    rc(c, 1, 4, 14, 8, K('midori', 1)); outline(c, 0, 3, 16, 10, K('shiro', 0)); hl(c, 1, 4, 14, K('midori', 2))
    rc(c, 9, 5, 4, 6, K('shiro', 2)); rc(c, 10, 6, 2, 5, K('midori', 0))
    hl(c, 3, 8, 5, K('shiro', 2)); px(c, 6, 7, K('shiro', 2)); px(c, 6, 9, K('shiro', 2)); px(c, 5, 6, K('shiro', 1)); px(c, 5, 10, K('shiro', 1))
    hl(c, 1, 13, 14, OL); hl(c, 2, 14, 12, K('midori', -1)); hl(c, 4, 15, 8, K('midori', -2))


@R.obj('wh-emergency-lamp', '빨간 비상등', w=1, kind='hang', hrows=2, use=('light',), tags=TM + TW + ('비상등', '경보'),
       place='벽면 윗줄 — 통로·기계실 문 옆', pair=('wh-exit-sign',),
       desc='벽에 붙은 둥근 빨간 비상등 하나가 켜져 있다. 빨간 등 알 + 반사 점, 받침 판, 밑으로 붉은 빛이 벽에 번진 점 몇 개.')
def _elamp(c):
    rc(c, 4, 6, 8, 3, K('tekko', 0)); hl(c, 4, 6, 8, K('tekko', 1)); outline(c, 3, 5, 10, 5)
    rc(c, 5, 10, 6, 4, K('aka', 1)); hl(c, 6, 9, 4, K('aka', 2)); px(c, 6, 10, K('aka', 2)); px(c, 7, 10, K('shiro', 2))
    vl(c, 4, 10, 4, OL); vl(c, 11, 10, 4, OL); hl(c, 5, 14, 6, OL)
    for (x, y) in ((3, 16), (12, 17), (7, 18), (9, 20), (4, 21)): px(c, x, y, K('aka', -2))


@R.obj('wh-fluor-broken', '떨어진 형광등(꺼짐)', w=2, kind='hang', hrows=2, use=('block',), tags=TM + ('형광등', '조명', '잔해'),
       place='통로 북쪽 벽면 윗줄 — 꺼진 천장 등이 한쪽 줄에 매달려 비스듬히 내려온 것',
       desc='천장 판에서 한쪽이 떨어져 전선에 매달린 꺼진 형광등 기구 2칸. 흰 갓이 비스듬히 기울고 관 하나는 깨져 끝만 남았다. 불이 들어오지 않는다.')
def _fluor(c):
    hl(c, 0, 0, 32, K('tekko', -2))
    vl(c, 5, 1, 4, K('sumi', 0)); vl(c, 26, 1, 14, K('sumi', 0))
    for i in range(24):
        y = 4 + i * 10 // 24
        x = 4 + i
        rc(c, x, y, 1, 4, K('shiro', -1)); px(c, x, y, K('shiro', 0)); px(c, x, y + 4, OL); px(c, x, y - 1, OL)
        if i < 15: px(c, x, y + 2, K('shiro', 1) if i % 4 else K('shiro', 0))
        elif i < 17: px(c, x, y + 2, K('shiro', 2))
    for (x, y) in ((14, 22), (17, 25), (12, 27), (20, 28)): px(c, x, y, K('shiro', 0))


@R.obj('wh-light-hang', '매단 창고 등(켜짐)', w=1, kind='hang', hrows=2, use=('light',), tags=TW + ('조명', '등'),
       place='창고 북쪽 벽면 윗줄 — 몇 칸에 하나, 꺼진 등 사이에', pair=('wh-light-off',),
       desc='긴 줄 끝에 매달린 쇠 갓 창고 등, 이것 하나만 켜져 있다. 갓 아래 노란 알과 둘레에 번진 노란 점 몇 개.')
def _lamp_on(c):
    vl(c, 7, 0, 10, K('sumi', 0))
    rc(c, 3, 10, 10, 3, K('tekko', 0)); hl(c, 4, 9, 8, K('tekko', 1)); outline(c, 2, 9, 12, 5)
    hl(c, 3, 14, 10, OL); rc(c, 5, 14, 6, 2, K('mado', 2)); hl(c, 6, 16, 4, K('mado', 1))
    for (x, y) in ((3, 18), (12, 19), (7, 21), (5, 24), (10, 25)): px(c, x, y, K('mado', 0))


@R.obj('wh-light-off', '매단 창고 등(꺼짐)', w=1, kind='hang', hrows=2, use=('block',), tags=TW + ('조명', '등'),
       place='창고 북쪽 벽면 윗줄 — 두세 칸 간격', pair=('wh-light-hang',),
       desc='긴 줄 끝에 매달린 꺼진 쇠 갓 창고 등. 갓 아래 알이 어둡고 갓 테에 먼지.')
def _lamp_off(c):
    vl(c, 7, 0, 10, K('sumi', 0))
    rc(c, 3, 10, 10, 3, K('tekko', -1)); hl(c, 4, 9, 8, K('tekko', 0)); outline(c, 2, 9, 12, 5)
    hl(c, 3, 14, 10, OL); rc(c, 6, 14, 4, 2, K('yoru', 0)); px(c, 6, 14, K('tekko', 0))


@R.obj('wh-chain-hoist', '체인 호이스트', w=1, kind='hang', hrows=2, use=('search',), tags=TW + ('호이스트', '크레인'),
       place='창고 북쪽 벽면 윗줄 — 하역장·컨테이너 곁', pair=('wh-container-h',),
       desc='위 보에서 내려온 노란 체인 호이스트. 노란 몸통 블록, 아래로 쇠사슬 두 줄과 끝의 쇠갈고리.')
def _hoist(c):
    hl(c, 0, 0, 16, K('tekko', 0)); hl(c, 0, 1, 16, K('tekko', -2))
    rc(c, 4, 2, 8, 7, K('kii', 0)); hl(c, 4, 2, 8, K('kii', 1)); vl(c, 11, 3, 6, K('kii', -1)); outline(c, 3, 2, 10, 8)
    for y in range(10, 25):
        px(c, 6, y, K('tekko', 1) if y % 2 else K('tekko', -1)); px(c, 9, y, K('tekko', 0) if y % 2 else K('tekko', -2))
    rc(c, 5, 25, 6, 2, K('tekko', 0)); outline(c, 4, 24, 8, 4)
    vl(c, 7, 28, 2, K('tekko', 1)); px(c, 8, 30, K('tekko', 1)); px(c, 9, 29, K('tekko', 0)); px(c, 6, 29, OL); px(c, 7, 30, OL); px(c, 8, 31, OL)


@R.obj('wh-rolling-door', '창고 대형 셔터(닫힘)', w=3, kind='hang', hrows=2, use=('gate',), tags=TW + ('셔터', '대형 셔터', '하역장'),
       place='창고 북쪽 벽면 윗줄 3칸 — 옆 칸막이 틈의 쪽문(wh-wicket-door)과 함께 쓴다', pair=('wh-wicket-door',),
       desc='하역장 쪽으로 난 3칸 폭 대형 강철 셔터(닫힘). 위 셔터 박스, 가로 골 살, 맨 아래 노랑·검정 빗금 띠. 열리지 않는다 — 옆의 쪽문으로 드나든다.')
def _roll(c):
    W = 48
    rc(c, 0, 0, W, 4, K('tekko', 0)); hl(c, 0, 0, W, K('tekko', 1)); hl(c, 0, 3, W, K('tekko', -2)); hl(c, 0, 4, W, K('yoru', -2))
    for y in range(5, 27): hl(c, 2, y, W - 4, (K('tekko', -1), K('tekko', -2), K('tekko', 0))[y % 3])
    for x in range(2, W - 2):
        for y in range(5, 27):
            if rnd(x, y, 211, 30): px(c, x, y, K('yoru', -1))
    for x in (11, 30, 40): rust_drip(c, x, 7, 16, x)
    for x in range(2, W - 2): px(c, x, 27, K('kii', 0) if ((x // 3) % 2) else K('sumi', 0)); px(c, x, 28, K('kii', -1) if ((x + 1) // 3) % 2 else K('sumi', 0))
    hl(c, 2, 29, W - 4, K('tekko', -2))
    rc(c, 0, 4, 2, 26, K('tekko', -1)); vl(c, 0, 4, 26, OL); rc(c, W - 2, 4, 2, 26, K('tekko', -2)); vl(c, W - 1, 4, 26, OL)
    hl(c, 0, 30, W, K('tekko', 0)); hl(c, 0, 31, W, OL)


@R.obj('wh-wicket-door', '대형 셔터 옆 쪽문(잠금 자리)', kind='door', use=('gate', 'key'), tags=TW + ('문', '쪽문', '잠긴 문'),
       place='가로 칸막이(# 줄)의 1칸 틈 — 대형 셔터(wh-rolling-door) 바로 옆. 잠긴 문 자리(잠금은 이벤트)', pair=('wh-rolling-door', 'wh-item-safe'),
       desc='대형 셔터 옆 사람 드나드는 회색 강철 쪽문. 문짝이 안쪽으로 조금 열려 어두운 틈이 보이고, 손잡이 아래 자물쇠 걸쇠. 잠금은 이벤트로 단다.')
def _wicket(c):
    rc(c, 0, 0, 16, 30, K('tekko', -1)); vl(c, 0, 0, 30, K('tekko', 1)); vl(c, 15, 0, 30, OL)
    rc(c, 3, 2, 10, 28, K('yoru', -3))
    for y in range(22, 30): hl(c, 3, y, 10, K('yoru', -2 if y < 27 else -1))
    rc(c, 2, 2, 5, 28, K('tekko', 0)); vl(c, 2, 2, 28, K('tekko', 1)); vl(c, 6, 2, 28, K('tekko', -2)); vl(c, 7, 2, 28, OL)
    rc(c, 3, 6, 3, 4, K('garasu', -2)); px(c, 3, 6, K('garasu', 0))
    rc(c, 5, 15, 2, 2, K('kii', 1)); px(c, 5, 18, K('tekko', 2))
    hl(c, 1, 1, 14, K('tekko', 0)); hl(c, 0, 0, 16, OL)
    hl(c, 0, 30, 16, K('tekko', 0)); hl(c, 0, 31, 16, K('yoru', -2))


# ══ 항만 창고 — 컨테이너·짐 ═══════════════════════════════════════════════════
def _casting(c, x, y):
    rc(c, x, y, 4, 3, K('tekko', -1)); hl(c, x, y, 4, K('tekko', 0)); px(c, x + 1, y + 1, K('yoru', -2)); px(c, x + 2, y + 1, K('yoru', -2))


def _container_h(c, ramp):
    """가로 20피트 컨테이너 6×2(96×48): 위에서 보이는 지붕 T20 + 긴 옆면 F22(세로 골) + 모서리 쇠붙이."""
    W = 96
    rc(c, 1, 1, W - 2, 20, K(ramp, 0))                                               # 지붕(위에서 본 면)
    for x in range(2, W - 2):
        if x % 8 == 0: vl(c, x, 2, 19, K(ramp, -1))
        elif x % 8 == 1: vl(c, x, 2, 19, K(ramp, 1))
    hl(c, 1, 1, W - 2, K(ramp, 1)); vl(c, 1, 1, 20, K(ramp, 1)); vl(c, W - 2, 1, 20, K(ramp, -1))
    for x in range(2, W - 2):
        for y in range(2, 20):
            if rnd(x, y, 225 + len(ramp), 25): px(c, x, y, K('soil', -1))
            elif rnd(x, y, 226 + len(ramp), 12): px(c, x, y, K(ramp, -2))
    hl(c, 1, 21, W - 2, K(ramp, 2)); hl(c, 1, 22, W - 2, K(ramp, -1))                 # 앞 가장자리(윗 레일)
    for x in range(1, W - 1):                                                        # 긴 옆면 세로 골
        col = (K(ramp, 0), K(ramp, 1), K(ramp, -1), K(ramp, -2))[x % 4]
        vl(c, x, 23, 19, col)
    hl(c, 1, 41, W - 2, K(ramp, -1)); hl(c, 1, 42, W - 2, K(ramp, -2)); hl(c, 1, 43, W - 2, K('tekko', -2))   # 아래 레일
    vl(c, 48, 23, 19, K(ramp, -2))                                                   # 판 이음
    for x in range(1, W - 1):
        for y in range(24, 41):
            if rnd(x, y, 221 + len(ramp), 22): px(c, x, y, K('soil', -1))
    for x in (9, 24, 37, 61, 77, 88): rust_drip(c, x, 24, 15, x + len(ramp))
    for (x, y) in ((1, 21), (W - 5, 21), (1, 40), (W - 5, 40)): _casting(c, x, y)
    outline(c, 0, 0, W, 45)
    hl(c, 1, 45, W - 2, K('yoru', -2)); hl(c, 2, 46, W - 3, K('yoru', -1))


def _container_v(c, ramp):
    """세로 20피트 컨테이너 2×6(32×112): 길게 보이는 지붕 + 남쪽 끝 양문(잠금 막대 넷·손잡이·경첩·모서리 쇠붙이)."""
    rc(c, 1, 1, 30, 84, K(ramp, 0))
    for y in range(2, 84):
        if y % 8 == 0: hl(c, 2, y, 28, K(ramp, -1))
        elif y % 8 == 1: hl(c, 2, y, 28, K(ramp, 1))
    vl(c, 1, 1, 84, K(ramp, 1)); vl(c, 30, 1, 84, K(ramp, -1)); hl(c, 1, 1, 30, K(ramp, 1))
    for y in range(2, 84):
        for x in range(2, 30):
            if rnd(x, y, 231 + len(ramp), 25): px(c, x, y, K('soil', -1))
            elif rnd(x, y, 232 + len(ramp), 12): px(c, x, y, K(ramp, -2))
    hl(c, 1, 85, 30, K(ramp, 2)); hl(c, 1, 86, 30, K(ramp, -2))                       # 앞 가장자리(문 위 레일)
    for x in range(1, 31):                                                           # 문짝 면(세로 골, 지붕보다 한 단 어둡게)
        vl(c, x, 87, 19, (K(ramp, -1), K(ramp, 0), K(ramp, -1), K(ramp, -2))[x % 4])
    vl(c, 15, 87, 19, OL); vl(c, 16, 87, 19, K(ramp, 0))                             # 두 문짝 가운데 틈
    for x in (5, 11, 20, 26):                                                        # 잠금 막대 넷 + 손잡이
        vl(c, x, 87, 19, K('tekko', 1)); vl(c, x + 1, 87, 19, K('tekko', -2))
        rc(c, x - 1, 96, 3, 2, K('tekko', 2)); px(c, x - 1, 98, OL)
        px(c, x, 88, K('tekko', 2)); px(c, x, 104, K('tekko', 2))
    for y in (90, 101): px(c, 2, y, K('tekko', -1)); px(c, 29, y, K('tekko', -1))       # 경첩
    rust_drip(c, 9, 88, 12, len(ramp)); rust_drip(c, 23, 89, 10, len(ramp) + 3)
    hl(c, 1, 105, 30, K(ramp, -2)); hl(c, 1, 106, 30, K('tekko', -2))
    for (x, y) in ((1, 85), (27, 85), (1, 104), (27, 104)): _casting(c, x, y)
    outline(c, 0, 0, 32, 108)
    hl(c, 1, 108, 30, K('yoru', -2)); hl(c, 2, 109, 29, K('yoru', -1))


for _rid, _ramp, _ko in (('', 'aka', '빨강'), ('-blue', 'sora', '파랑'), ('-green', 'midori', '초록')):
    R.obj('wh-container-h' + _rid, '20피트 컨테이너(가로, %s)' % _ko, w=6, h=2, up=16, kind='floor', use=('block',), tags=TW + ('컨테이너', '미로'),
          place='창고 홀 바닥 — 가로·세로 컨테이너 6~7개를 엇갈려 놓아 미로 벽을 만든다(사이 통로 2칸, 막다른 골목)', pair=('wh-container-v' + _rid, 'wh-chain-hoist'),
          desc='%s 칠이 바랜 20피트 운송 컨테이너(6m×2.4m, 가로 6×2). 위에서 보이는 지붕 판 줄, 남쪽 긴 옆면 세로 골, 위·아래 레일, 네 모서리 쇠붙이, 녹 물때. 글자·로고 없음. 지나갈 수 없다.' % _ko)(
        (lambda r_: (lambda c: _container_h(c, r_)))(_ramp))
    R.obj('wh-container-v' + _rid, '20피트 컨테이너(세로, %s)' % _ko, w=2, h=6, up=16, kind='floor', use=('block',), tags=TW + ('컨테이너', '미로'),
          place='창고 홀 바닥 — 미로의 세로 벽. 남쪽 끝이 문 쪽', pair=('wh-container-h' + _rid,),
          desc='%s 20피트 컨테이너(세로 2×6). 길게 보이는 지붕 판 줄, 남쪽 끝에 양문 — 잠금 막대 넷·손잡이·경첩·모서리 쇠붙이. 글자·로고 없음. 지나갈 수 없다.' % _ko)(
        (lambda r_: (lambda c: _container_v(c, r_)))(_ramp))


@R.obj('wh-pallet', '팔레트 짐(랩 감긴 상자)', w=1, h=1, up=8, kind='floor', use=('search',), tags=TW + ('팔레트', '상자', '짐'),
       place='창고 바닥·랙 앞·컨테이너 곁 — 둘셋 모아 놓는다', pair=('wh-pallet-rack', 'wh-forklift'),
       desc='나무 팔레트 위에 골판지 상자를 쌓고 투명 랩을 감은 짐 하나(1.2m). 상자 윗면, 랩의 흰 반사 줄, 아래 팔레트 널과 포크 구멍.')
def _pallet(c):
    box3(c, 1, 6, 14, 4, 13, 'soil', 0)
    vl(c, 8, 7, 4, K('soil', -1)); hl(c, 2, 16, 12, K('soil', -1))
    for (x, y) in ((3, 12), (4, 13), (11, 18), (12, 19), (3, 20)): px(c, x, y, K('shiro', 0))
    rc(c, 1, 25, 14, 5, K('ita', 0)); hl(c, 1, 25, 14, K('ita', 2)); outline(c, 0, 24, 16, 7)
    rc(c, 3, 27, 3, 2, K('yoru', -2)); rc(c, 10, 27, 3, 2, K('yoru', -2))
    hl(c, 1, 31, 14, K('yoru', -2))


@R.obj('wh-pallet-rack', '팔레트 랙(3단)', w=3, h=1, up=32, kind='wall', use=('search',), tags=TW + ('랙', '선반', '팔레트'),
       place='창고 북쪽 벽 바로 아래 줄 — 가로로 이어 랙 통로를 만든다. 바로 북쪽에 1줄 통로를 두지 않는다', pair=('wh-pallet', 'wh-forklift'),
       desc='파란 기둥과 주황 보로 된 3단 팔레트 랙(3m). 맨 위 보의 윗면, 단마다 상자 짐이 얹혔고 가운데 단 하나는 비고 한 칸은 상자가 무너져 기울었다.')
def _rack(c):
    W = 48
    for x in (1, 23, 45):                                                            # 기둥
        rc(c, x, 0, 3, 46, K('sora', -1)); vl(c, x, 0, 46, K('sora', 0)); vl(c, x + 2, 0, 46, K('sora', -2))
        for y in range(3, 44, 4): px(c, x + 1, y, K('yoru', -2))
        outline(c, x - 1, -1, 5, 48)
    for lv, y in enumerate((0, 15, 30)):                                             # 주황 보 + 짐
        if lv == 0:
            rc(c, 4, 1, 19, 4, K('soil', 0)); hl(c, 4, 1, 19, K('soil', 1)); rc(c, 26, 2, 19, 3, K('soil', -1)); hl(c, 26, 2, 19, K('soil', 0))
        for (x0, x1) in ((4, 23), (26, 45)):
            hl(c, x0, y + 5, x1 - x0, K('daidai', 1)); rc(c, x0, y + 6, x1 - x0, 2, K('daidai', 0)); hl(c, x0, y + 8, x1 - x0, K('daidai', -2))
        if lv < 2:
            ny = y + 9
            for bi, (x0, x1) in enumerate(((4, 23), (26, 45))):
                if lv == 1 and bi == 1:                                              # 빈 단(어둠)
                    rc(c, x0, ny, x1 - x0, 11, K('yoru', -3)); continue
                rc(c, x0, ny, x1 - x0, 11, K('yoru', -2))
                for k in range(2):
                    bx = x0 + 1 + k * 9
                    tilt = 1 if (lv == 0 and bi == 1 and k == 1) else 0
                    rc(c, bx, ny + 3 + tilt, 8, 8 - tilt, K('soil', -1)); hl(c, bx, ny + 3 + tilt, 8, K('soil', 0)); vl(c, bx + 7, ny + 3, 8, K('soil', -2))
                    outline(c, bx - 1, ny + 2 + tilt, 10, 10 - tilt, K('sumi', 0))
    rc(c, 4, 39, 41, 7, K('yoru', -2))                                               # 바닥 단(발밑)
    for bx in (5, 14, 27, 36):
        rc(c, bx, 40, 7, 5, K('soil', -1)); hl(c, bx, 40, 7, K('soil', 0)); outline(c, bx - 1, 39, 9, 7, K('sumi', 0))
    hl(c, 0, 47, W, K('yoru', -2))


@R.obj('wh-forklift', '지게차(멈춤)', w=1, h=2, up=16, kind='floor', use=('search',), tags=TW + ('지게차', '포크리프트'),
       place='창고 통로·랙 앞 — 포크가 남쪽을 보게, 통로를 반쯤 막는 자리', pair=('wh-pallet', 'wh-pallet-rack'),
       desc='멈춰 선 노란 지게차(포크가 남쪽). 위 쇠 지붕(안전 가드) 격자, 그 아래 검은 좌석과 핸들, 앞쪽 두 기둥 마스트와 바닥에 내려놓은 쇠 포크 두 갈래.')
def _forklift(c):
    # 지붕 가드(위에서 보이는 격자 지붕)
    rc(c, 1, 0, 14, 8, K('yoru', -2))
    for x in (1, 5, 10, 14): vl(c, x, 0, 8, K('kii', 0))
    hl(c, 1, 0, 14, K('kii', 1)); hl(c, 1, 7, 14, K('kii', 1)); hl(c, 1, 8, 14, K('kii', -2))
    outline(c, 0, -1, 16, 10)
    vl(c, 1, 9, 9, K('kii', -1)); vl(c, 14, 9, 9, K('kii', -2))                       # 지붕 기둥
    rc(c, 3, 9, 10, 4, K('yoru', -1)); hl(c, 3, 9, 10, K('yoru', 1))                    # 좌석 등받이
    rc(c, 2, 13, 12, 9, K('kii', -1)); hl(c, 2, 13, 12, K('kii', 1)); vl(c, 2, 13, 9, K('kii', 0)); vl(c, 13, 13, 9, K('kii', -2))   # 몸통
    rc(c, 6, 14, 4, 2, K('sumi', 0)); px(c, 7, 13, K('tekko', 1))                        # 핸들
    outline(c, 1, 12, 14, 11)
    for x in (0, 13): rc(c, x, 18, 3, 6, K('sumi', 0)); px(c, x + 1, 19, K('yoru', 0)); outline(c, x, 18, 3, 6, K('sumi', -1))   # 앞바퀴
    for x in (4, 10):                                                                # 마스트 두 기둥
        rc(c, x, 10, 2, 26, K('tekko', 0)); vl(c, x, 10, 26, K('tekko', 1)); vl(c, x - 1, 10, 26, OL); vl(c, x + 2, 10, 26, OL)
    hl(c, 4, 10, 8, K('tekko', 1)); hl(c, 3, 9, 10, OL)                                  # 마스트 위 가로대
    rc(c, 3, 30, 10, 4, K('tekko', -1)); hl(c, 3, 30, 10, K('tekko', 1)); outline(c, 2, 29, 12, 6)   # 포크 받침(캐리지)
    for x in (4, 10):                                                                # 포크 두 갈래(바닥에 누움)
        rc(c, x, 35, 2, 11, K('tekko', 0)); vl(c, x, 35, 11, K('tekko', 1)); outline(c, x - 1, 34, 4, 13)
    hl(c, 1, 47, 14, K('yoru', -2))
    for (x, y) in ((3, 15), (12, 20), (8, 21)): px(c, x, y, K('soil', -1))


@R.obj('wh-crate', '나무 상자', w=1, h=1, up=0, kind='floor', use=('block',), tags=TW + TM + ('상자', '나무 상자'),
       place='창고 바닥·막다른 곳 — 둘셋 쌓아 길을 좁힌다',
       desc='못 박은 나무 널 상자(0.8m). 널 세 장 윗면, 앞면 가로 널과 모서리 덧댄 띠, 뚜껑은 닫혀 있다.')
def _crate(c):
    rc(c, 1, 1, 14, 4, K('ita', 1)); hl(c, 1, 1, 14, K('ita', 2)); vl(c, 5, 1, 4, K('ita', 0)); vl(c, 10, 1, 4, K('ita', 0))
    hl(c, 1, 5, 14, K('ita', 2))
    rc(c, 1, 6, 14, 8, K('ita', 0)); hl(c, 1, 9, 14, K('ita', -1)); hl(c, 1, 12, 14, K('ita', -1))
    vl(c, 1, 6, 8, K('ita', 1)); vl(c, 2, 6, 8, K('ita', 1)); vl(c, 13, 6, 8, K('ita', -1)); vl(c, 14, 6, 8, K('ita', -1))
    for (x, y) in ((1, 7), (14, 7), (1, 12), (14, 12)): px(c, x, y, K('tekko', 1))
    outline(c, 0, 0, 16, 15); hl(c, 1, 15, 14, K('yoru', -2))


@R.obj('wh-drum', '드럼통', w=1, h=1, up=0, kind='floor', use=('block',), tags=TW + ('드럼통', '기름'),
       place='창고 구석·기계실 — 둘셋 모아 놓는다',
       desc='파란 칠이 벗겨진 쇠 드럼통. 위에서 보이는 둥근 뚜껑(마개 두 개), 원통 몸통의 굴림 테 두 줄, 아래 녹.')
def _drum(c):
    for y, (a, b) in enumerate(((5, 10), (3, 12), (2, 13), (3, 12))):
        hl(c, a, y + 1, b - a + 1, K('sora', 0) if y else K('sora', 1))
    px(c, 5, 2, K('tekko', -1)); px(c, 10, 3, K('tekko', -1)); px(c, 6, 2, K('sora', 1))
    rc(c, 2, 5, 12, 9, K('sora', -1))
    for x in range(2, 14):
        t = (1, 1, 0, 0, 0, -1, -1, -1, -2, -2, -2, -2)[x - 2]
        vl(c, x, 5, 9, K('sora', t))
    hl(c, 2, 7, 12, K('sora', -2)); hl(c, 2, 11, 12, K('sora', -2))
    for (x, y) in ((4, 9), (9, 12), (12, 6)): px(c, x, y, K('renga', -1))
    hl(c, 2, 13, 12, K('soil', -1))
    for (a, b, y) in ((5, 10, 0), (3, 4, 1), (11, 12, 1), (2, 2, 2), (13, 13, 2)): hl(c, a, y, b - a + 1, OL)
    vl(c, 1, 3, 11, OL); vl(c, 14, 3, 11, OL); hl(c, 2, 14, 12, OL); hl(c, 2, 15, 12, K('yoru', -2))


@R.obj('wh-rope-coil', '계류 밧줄 타래', w=1, h=1, up=0, kind='flat', use=('search',), tags=TW + ('밧줄', '부두'),
       place='창고 바닥·하역장 쪽 — 밟고 지나간다',
       desc='바닥에 둥글게 감아 둔 굵은 계류 밧줄 한 타래. 크림색 꼰 줄이 동심원으로 겹쳐 보이고 끝이 한 가닥 풀려 나왔다.')
def _rope(c):
    for r_, t in ((6, 0), (4, 1), (2, 0)):
        for a in range(0, 360, 8):
            import math
            x = 8 + round(r_ * 1.1 * math.cos(math.radians(a))); y = 8 + round(r_ * 0.75 * math.sin(math.radians(a)))
            px(c, x, y, K('kinari', t if (a // 16) % 2 else t - 1))
    px(c, 8, 8, K('yoru', -1))
    for k in range(5): px(c, 14 + (k > 2), 10 + k, K('kinari', -1))
    for a in range(0, 360, 10):
        import math
        x = 8 + round(7.6 * math.cos(math.radians(a))); y = 8 + round(5.6 * math.sin(math.radians(a)))
        if 0 <= y < 16: px(c, x, y, K('kinari', -2))


@R.obj('wh-catwalk-ladder', '중이층 사다리', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',),
       tags=TW + ('사다리', '중이층', '캣워크', '이동'),
       place='창고 북쪽 벽 바로 아래 줄 — 발칸에서 중이층 캣워크로 올라간다(위층 사다리 구멍과 같은 x)', pair=('wh-ladder-hatch',),
       desc='북쪽 벽을 타고 중이층으로 오르는 노란 쇠 사다리. 양 손잡이 레일과 가로 디딤봉, 위쪽 등받이 안전 울(둥근 테), 꼭대기는 어둠. 발칸은 걸을 수 있고 그 칸에서 올라간다.')
def _ladder(c):
    rc(c, 3, 0, 10, 40, K('yoru', -3))
    for x in (3, 12): vl(c, x, 0, 44, K('kii', 0)); vl(c, x - 1, 0, 44, OL)
    vl(c, 13, 0, 44, OL); vl(c, 4, 0, 44, OL)
    for y in range(3, 42, 4): hl(c, 5, y, 7, K('tekko', 1)); hl(c, 5, y + 1, 7, K('tekko', -2))
    for y in (6, 16, 26):                                                            # 안전 울 테
        hl(c, 1, y, 14, K('kii', -1)); px(c, 0, y + 1, K('kii', -1)); px(c, 15, y + 1, K('kii', -1)); hl(c, 1, y + 1, 14, OL) if False else None
    for x in (0, 15): vl(c, x, 7, 20, K('kii', -2))
    rc(c, 1, 42, 14, 4, K('tekko', 0)); hl(c, 1, 42, 14, K('kii', 0)); outline(c, 0, 41, 16, 6); hl(c, 1, 47, 14, K('yoru', -2))


@R.obj('wh-ladder-hatch', '사다리 구멍(아래로)', w=1, h=1, up=0, kind='flat', stairs='down', use=('travel',), tags=TW + ('사다리', '중이층', '캣워크', '이동'),
       place='중이층 바닥 — 아래층 사다리와 같은 x. 밟으면 아래층으로 내려간다', pair=('wh-catwalk-ladder',),
       desc='캣워크 바닥에 뚫린 네모 구멍과 그 아래로 내려가는 노란 사다리 꼭대기(손잡이 고리 둘). 구멍 속은 캄캄하다. 밟으면 아래층으로.')
def _hatch(c):
    rc(c, 1, 1, 14, 14, K('yoru', -3)); outline(c, 0, 0, 16, 16, K('kii', -1)); hl(c, 1, 1, 14, K('kii', 0))
    for y in range(4, 15, 3): hl(c, 5, y, 6, K('tekko', -1 if y > 8 else 0))
    for x in (4, 11):
        vl(c, x, 2, 13, K('kii', -1)); px(c, x, 1, K('kii', 1))
        rc(c, x - (1 if x == 4 else -1), 0, 1, 3, K('kii', 1))
    hl(c, 1, 15, 14, K('kii', -2))


@R.obj('wh-catwalk-rail', '캣워크 난간', w=1, h=1, up=0, kind='floor', use=('block',), tags=TW + ('난간', '캣워크', '중이층'),
       place='중이층 가장자리(아래가 트인 쪽) — 한 줄로 이어 붙인다',
       desc='중이층 끝의 노란 쇠 파이프 난간. 위 손잡이 파이프, 가운데 파이프, 아래 발끝막이 판. 사이로 아래 창고의 어둠이 보인다.')
def _crail(c):
    rc(c, 0, 0, 16, 16, K('yoru', -3))
    hl(c, 0, 2, 16, OL); hl(c, 0, 3, 16, K('kii', 1)); hl(c, 0, 4, 16, K('kii', -1)); hl(c, 0, 5, 16, OL)
    hl(c, 0, 8, 16, K('kii', -1)); hl(c, 0, 9, 16, OL)
    for x in (2, 13): vl(c, x, 3, 9, K('kii', 0)); vl(c, x + 1, 3, 9, OL)
    rc(c, 0, 11, 16, 3, K('tekko', -1)); hl(c, 0, 11, 16, K('tekko', 0)); hl(c, 0, 14, 16, OL); hl(c, 0, 15, 16, K('tekko', -3))


@R.obj('wh-office-cabin', '창고 사무 칸 창(블라인드)', w=2, h=1, up=16, kind='wall', use=('search',), tags=TW + ('사무실', '사무 칸', '창'),
       place='창고 홀에서 사무 칸 칸막이 벽 바로 아래 줄 — 사무 칸 문 옆',
       desc='창고 안에 세운 조립식 사무 칸의 앞벽 2칸. 쇠 틀 윗면, 반쯤 내린 흰 블라인드 창 두 장(속은 어둠), 아래 회색 강판 허리벽.')
def _cabin(c):
    rc(c, 0, 0, 32, 4, K('shiro', -1)); hl(c, 0, 0, 32, K('shiro', 0)); hl(c, 0, 4, 32, K('shiro', 0)); outline(c, 0, -1, 32, 6)
    hl(c, 1, 5, 30, K('yoru', -2))
    for wx in (2, 17):
        rc(c, wx, 6, 13, 12, K('garasu', -3)); outline(c, wx - 1, 5, 15, 14, K('tekko', -1))
        for y in range(6, 13): hl(c, wx, y, 13, K('shiro', -1) if y % 2 == 0 else K('shiro', -2))
        hl(c, wx, 13, 13, K('tekko', -1))
        px(c, wx + 3, 15, K('garasu', -1)); px(c, wx + 4, 16, K('garasu', -1))
    rc(c, 1, 19, 30, 10, K('shiro', -2)); hl(c, 1, 19, 30, K('shiro', -1)); vl(c, 16, 19, 10, K('hodo', 0))
    for y in (22, 25): hl(c, 2, y, 28, K('hodo', 0))
    grime(c, 1, 20, 30, 9, 251, 40, K('hodo', -1))
    vl(c, 0, 5, 25, OL); vl(c, 31, 5, 25, OL); hl(c, 0, 29, 32, OL); hl(c, 1, 30, 30, K('yoru', -2))


@R.obj('wh-tarp-pile', '방수포 덮은 밀수품 상자', w=2, h=1, up=16, kind='floor', use=('search',), tags=TW + ('밀수품', '상자', '방수포', '보스'),
       place='밀수품 방 가운데·벽 곁 — 보스 자리 둘레', pair=('wh-crate', 'wh-item-crate-open'),
       desc='상자를 높이 쌓고 파란 방수포를 덮어 밧줄로 묶은 더미 2칸. 위로 방수포 주름과 밧줄, 아래 한쪽이 들춰져 나무 상자 모서리가 보인다.')
def _tarp(c):
    top = (5, 3, 2, 2, 3, 4, 3, 2, 1, 1, 2, 3, 2, 2, 3, 4, 4, 3, 2, 2, 1, 1, 2, 3, 3, 2, 2, 3, 4, 6)   # 울퉁불퉁한 윗선
    for i, t in enumerate(top):
        x = 1 + i
        for y in range(t, 28):
            if y < 13: col = K('sora', 0) if (y - t) < 2 else K('sora', -1)              # 윗면(위에서 보이는 방수포)
            else: col = K('sora', -1) if (x + y // 3) % 5 else K('sora', -2)             # 앞으로 늘어진 면, 주름
            c.P(x, y, col)
        c.P(x, t, K('sora', 1)); c.P(x, t - 1, OL)
    for x in range(2, 30):
        if (x * 7) % 9 == 0:
            for y in range(13, 27): px(c, x, y, K('sora', -2))                            # 세로 주름
    hl(c, 1, 13, 30, K('sora', 1)); hl(c, 1, 14, 30, K('sora', -2))                        # 윗면 앞 모서리
    rc(c, 21, 20, 9, 8, K('ita', 0)); hl(c, 21, 20, 9, K('ita', 2)); hl(c, 21, 24, 9, K('ita', -1)); outline(c, 20, 19, 11, 10)   # 들춰진 자리 상자
    for i in range(9): px(c, 20 + i, 18 + (i // 3), K('sora', 1))                         # 들린 천 끝
    for x in (9, 23):                                                                # 밧줄(위를 넘어 앞으로)
        for y in range(top[x - 1], 28): px(c, x, y, K('kinari', 0) if y % 3 else K('kinari', -1))
    for x in range(2, 30): px(c, x, 8, K('kinari', -1) if x % 3 else K('kinari', 0))
    vl(c, 0, 4, 24, OL); vl(c, 31, 6, 22, OL); hl(c, 1, 28, 30, OL)
    hl(c, 1, 29, 30, K('yoru', -2)); hl(c, 2, 30, 28, K('yoru', -1))


# ══ 기계실 ═══════════════════════════════════════════════════════════════════
@R.obj('wh-pump', '양수 펌프(멈춤)', w=2, h=1, up=16, kind='floor', use=('search', 'switch'), tags=TM + ('기계실', '펌프', '배관'),
       place='기계실 바닥 — 벽에서 한 칸 띄워(뒤로 배관이 지나간다)', pair=('wh-pipes', 'wh-panel-board'),
       desc='초록 칠 모터와 둥근 펌프 몸통이 콘크리트 받침에 얹힌 양수 펌프 2칸(멈춤). 위로 굵은 배관이 올라가고 빨간 밸브 손잡이, 둥근 압력계(눈금만).')
def _pump(c):
    rc(c, 1, 22, 30, 7, K('conc', -1)); hl(c, 1, 22, 30, K('conc', 0)); outline(c, 0, 21, 32, 9); hl(c, 1, 30, 30, K('yoru', -2))
    rc(c, 3, 10, 14, 12, K('midori', -1)); hl(c, 3, 10, 14, K('midori', 0)); vl(c, 3, 10, 12, K('midori', 0))
    for x in range(5, 16, 2): vl(c, x, 12, 8, K('midori', -2))
    outline(c, 2, 9, 16, 14)
    rc(c, 19, 12, 10, 10, K('midori', -1)); hl(c, 20, 12, 8, K('midori', 0)); outline(c, 18, 11, 12, 12)
    rc(c, 22, 0, 4, 12, K('tekko', -1)); vl(c, 22, 0, 12, K('tekko', 0)); vl(c, 21, 0, 12, OL); vl(c, 26, 0, 12, OL)
    rc(c, 20, 4, 8, 2, K('aka', 0)); hl(c, 20, 4, 8, K('aka', 1)); outline(c, 19, 3, 10, 4)
    rc(c, 9, 3, 5, 5, K('shiro', 0)); px(c, 11, 5, K('aka', 0)); px(c, 12, 4, K('aka', 0)); outline(c, 8, 2, 7, 7); vl(c, 11, 9, 1, K('tekko', 0))
    grime(c, 3, 10, 26, 12, 261, 50, K('soil', -1))


@R.obj('wh-panel-board', '분전반(문 열림)', w=1, h=1, up=16, kind='wall', use=('switch', 'search'), tags=TM + ('기계실', '분전반', '전기'),
       place='기계실 북쪽 벽 바로 아래 줄', pair=('wh-pump', 'wh-emergency-lamp'),
       desc='벽에 선 회색 분전반 캐비닛, 문이 반쯤 열려 차단기 줄이 보인다. 빨간 표시등 하나만 켜졌고 노랑·검정 경고 띠(글자 없음).')
def _panel(c):
    rc(c, 1, 1, 14, 4, K('shiro', -2)); hl(c, 1, 1, 14, K('shiro', -1)); hl(c, 1, 5, 14, K('shiro', -1))
    rc(c, 1, 6, 14, 24, K('hodo', 0)); hl(c, 1, 6, 14, K('yoru', -1))
    rc(c, 3, 8, 9, 18, K('yoru', -2))
    for y in (10, 15, 20):
        for x in range(4, 11, 2): rc(c, x, y, 1, 3, K('shiro', -1)); px(c, x, y, K('shiro', 0))
    px(c, 10, 24, K('aka', 1)); px(c, 4, 24, K('tekko', -1))
    rc(c, 12, 7, 3, 21, K('hodo', 1)); vl(c, 12, 7, 21, K('hodo', 2)); vl(c, 15, 7, 21, OL)        # 열린 문짝
    for x in range(3, 12): px(c, x, 27, K('kii', 0) if (x // 2) % 2 else K('sumi', 0))
    outline(c, 0, 0, 16, 31); hl(c, 1, 31, 14, K('yoru', -2))


@R.obj('wh-pipes', '세로 배관과 밸브', w=1, h=1, up=32, kind='wall', use=('switch',), tags=TM + TW + ('기계실', '배관', '밸브'),
       place='기계실·뒷통로 북쪽 벽 바로 아래 줄 — 펌프 곁', pair=('wh-pump',),
       desc='바닥에서 천장으로 오르는 굵은 쇠 배관 두 줄. 허리에 빨간 핸들 밸브와 둥근 압력계(눈금만), 이음 고리, 밑동에 물이 샌 얼룩.')
def _pipes(c):
    for (x, w) in ((2, 5), (9, 5)):
        rc(c, x, 0, w, 44, K('tekko', -1)); vl(c, x, 0, 44, K('tekko', 1)); vl(c, x + 1, 0, 44, K('tekko', 0)); vl(c, x + w - 1, 0, 44, K('tekko', -3))
        for y in (6, 20, 36): hl(c, x - 1, y, w + 2, K('tekko', 0)); hl(c, x - 1, y + 1, w + 2, K('tekko', -2))
        vl(c, x - 1, 0, 44, OL); vl(c, x + w, 0, 44, OL)
    rc(c, 1, 25, 7, 2, K('aka', 0)); hl(c, 1, 25, 7, K('aka', 1)); px(c, 4, 27, K('aka', -1)); outline(c, 0, 24, 9, 4)
    rc(c, 9, 12, 5, 5, K('shiro', 0)); px(c, 11, 14, OL); px(c, 12, 13, K('aka', 0)); outline(c, 8, 11, 7, 7)
    rc(c, 0, 44, 16, 4, K('conc', -1)); hl(c, 0, 44, 16, K('conc', 0)); hl(c, 0, 47, 16, K('yoru', -2))
    for (x, y) in ((3, 45), (8, 46), (12, 45)): px(c, x, y, K('garasu', -2))


@R.obj('wh-fountain-dry', '마른 분수대', w=2, h=2, up=0, kind='floor', use=('search',), tags=TM + ('광장', '분수', '보스'),
       place='지하상가 광장 한가운데 — 둘레를 한 바퀴 돌 수 있게', pair=('wh-mall-pillar', 'wh-mall-bench'),
       desc='물이 마른 지하상가 광장 분수대 2×2. 돌 테두리 윗면이 네모로 둘러 보이고, 속은 마른 바닥에 낙엽·종이 쓰레기, 가운데 녹슨 분수 꼭지 기둥. 앞쪽 돌 테 앞면.')
def _fountain(c):
    cut = (5, 3, 2, 1, 1, 0)                                                         # 팔각 모서리 깎기(위 6행)
    def row_span(y, top, bot):
        k = min(y - top, bot - y)
        k = cut[k] if k < len(cut) else 0
        return 1 + k, 30 - k
    for y in range(1, 27):                                                           # 돌 테 윗면
        a, b = row_span(y, 1, 26); hl(c, a, y, b - a + 1, K('conc', 1))
        px(c, a, y, K('conc', 2)); px(c, b, y, K('conc', 0))
    for y in range(1, 27):
        a, b = row_span(y, 1, 26)
        px(c, a - 1, y, OL); px(c, b + 1, y, OL)
    for y in range(4, 24):                                                           # 마른 속(어둠 + 낙엽·쓰레기)
        a, b = row_span(y, 4, 23)
        a += 3; b -= 3
        if b <= a: continue
        hl(c, a, y, b - a + 1, K('hodo', -2))
        for x in range(a, b + 1):
            if rnd(x, y, 271, 45): px(c, x, y, K('soil', -1))
            elif rnd(x, y, 272, 18): px(c, x, y, K('shiro', -2))
        px(c, a, y, K('yoru', -2))
    hl(c, 9, 4, 14, K('yoru', -2))
    rc(c, 14, 9, 4, 9, K('tekko', -1)); vl(c, 14, 9, 9, K('tekko', 0)); outline(c, 13, 8, 6, 11)   # 분수 꼭지 기둥
    rc(c, 12, 7, 8, 2, K('tekko', 0)); hl(c, 12, 7, 8, K('tekko', 1)); outline(c, 11, 6, 10, 4)
    rust_drip(c, 15, 10, 7, 3)
    for (x, y) in ((8, 18), (22, 10), (21, 19), (9, 9)): rc(c, x, y, 2, 1, K('daidai', -2)); px(c, x, y + 1, K('soil', 0))
    for y in range(27, 30):                                                          # 앞쪽 돌 테 앞면
        a, b = 2, 29
        hl(c, a, y, b - a + 1, (K('conc', 2), K('conc', -1), K('conc', -2))[y - 27])
    px(c, 1, 27, OL); px(c, 30, 27, OL); vl(c, 1, 27, 3, OL); vl(c, 30, 27, 3, OL); hl(c, 2, 30, 28, OL)
    hl(c, 2, 31, 28, K('yoru', -2))


# ══ 잔해 ═════════════════════════════════════════════════════════════════════
@R.obj('wh-debris-paper', '흩어진 종이·전단', w=1, h=1, up=0, kind='flat', tags=TM + TW + ('잔해', '종이', '쓰레기'),
       place='통로 바닥 아무 데나 — 밟고 지나간다',
       desc='바닥에 흩어진 구겨진 종이와 빛바랜 전단 몇 장(글자 없음, 색 띠만), 골판지 조각.')
def _paper(c):
    for (x, y, w, h, r_) in ((2, 3, 5, 4, 'shiro'), (8, 8, 6, 4, 'kinari'), (4, 11, 4, 3, 'shiro')):
        rc(c, x, y, w, h, K(r_, -1)); hl(c, x, y, w, K(r_, 0)); px(c, x + w - 1, y + h - 1, K(r_, -2))
        hl(c, x + 1, y + 1, w - 2, K('aka', -1) if r_ == 'kinari' else K('hodo', 0))
    rc(c, 11, 2, 3, 3, K('soil', 0)); px(c, 11, 2, K('soil', 1))
    hl(c, 2, 7, 5, K('yoru', -1)); hl(c, 8, 12, 6, K('yoru', -1))


@R.obj('wh-glass-shards', '깨진 유리 조각', w=1, h=1, up=0, kind='flat', tags=TM + ('잔해', '유리'),
       place='진열창·형광등 아래 바닥 — 밟고 지나간다(소리가 난다)',
       desc='바닥에 흩어진 깨진 유리 조각들. 뾰족한 조각마다 밝은 반사 점이 반짝인다.')
def _glass(c):
    for (x, y, k) in ((3, 4, 3), (9, 3, 2), (6, 9, 4), (12, 11, 2), (2, 12, 2)):
        for i in range(k): px(c, x + i, y + i // 2, K('garasu', 1)); px(c, x + i, y + 1 + i // 2, K('garasu', -1))
        px(c, x, y, K('shiro', 2))
    for (x, y) in ((8, 13), (13, 6), (5, 2)): px(c, x, y, K('garasu', 0))


@R.obj('wh-puddle', '물웅덩이', w=1, h=1, up=0, kind='flat', tags=TM + TW + ('물', '웅덩이', '누수'),
       place='배관·천장 누수 아래 바닥 — 밟고 지나간다',
       desc='천장에서 샌 물이 고인 검푸른 웅덩이. 가장자리 젖은 테, 표면에 천장 등빛 반사 줄 두 개.')
def _puddle(c):
    import math
    for y in range(16):
        for x in range(16):
            d = ((x - 8) / 7.2) ** 2 + ((y - 8) / 5.2) ** 2 + 0.12 * math.sin(x * 1.3 + y)
            if d < 0.75: px(c, x, y, K('tairu', -2))
            elif d < 1.0: px(c, x, y, K('tairu', -1))
    hl(c, 5, 6, 4, K('garasu', 0)); hl(c, 9, 9, 3, K('garasu', -1)); px(c, 6, 5, K('shiro', 0))


@R.obj('wh-fallen-panel', '떨어진 천장 판', w=1, h=1, up=0, kind='floor', use=('block',), tags=TM + ('잔해', '천장', '막힘'),
       place='통로를 막는 자리 — 잔해 더미와 이어 길을 끊는다',
       desc='천장에서 떨어져 비스듬히 기운 석고 천장 판과 매달린 전선, 바닥에 흩어진 흰 부스러기. 지나갈 수 없다.')
def _panelfall(c):
    for i in range(10):
        hl(c, 1 + i // 3, 3 + i, 12, K('shiro', -1) if i % 4 else K('shiro', -2))
    hl(c, 1, 3, 12, K('shiro', 0)); px(c, 6, 6, K('hodo', 0)); px(c, 9, 9, K('hodo', 0))
    for i in range(10): px(c, i // 3, 3 + i, OL); px(c, 13 + i // 3, 3 + i, OL)
    hl(c, 1, 2, 12, OL); hl(c, 4, 13, 12, OL)
    rc(c, 4, 13, 12, 1, K('shiro', -2))
    vl(c, 10, 0, 4, K('sumi', 0)); px(c, 11, 1, K('daidai', -1))
    for (x, y) in ((1, 14), (3, 15), (14, 15), (12, 14)): px(c, x, y, K('shiro', -1))


@R.obj('wh-rubble', '콘크리트 잔해 더미', w=1, h=1, up=0, kind='floor', use=('block',), tags=TM + TW + ('잔해', '막힘'),
       place='막힌 통로·무너진 벽 곁 — 두셋 이어 길을 막는다',
       desc='무너진 콘크리트 덩이와 휜 철근이 쌓인 잔해 더미. 덩이마다 윗면이 밝고, 사이 그늘이 깊다. 지나갈 수 없다.')
def _rubble(c):
    for (x, y, w, h, t) in ((1, 7, 6, 6, 0), (6, 4, 7, 7, 1), (9, 9, 6, 5, -1), (3, 11, 5, 4, 0)):
        rc(c, x, y, w, h, K('conc', t - 1)); hl(c, x, y, w, K('conc', t + 1)); vl(c, x, y, h, K('conc', t))
        outline(c, x - 1, y - 1, w + 2, h + 2, K('conc', -3))
    for i in range(6): px(c, 4 + i, 3 + i // 3, K('renga', -1))
    px(c, 3, 2, K('renga', 0))
    hl(c, 1, 15, 14, K('yoru', -2))


@R.obj('wh-toppled-shelf', '넘어진 진열대', w=2, h=1, up=0, kind='floor', use=('search',), tags=TM + ('잔해', '진열대', '막힘'),
       place='통로·빈 가게 바닥 — 길을 막거나 좁힌다',
       desc='옆으로 넘어진 쇠 진열대 2칸. 선반 칸막이가 위로 드러나고, 쏟아진 상자와 깡통이 앞에 흩어져 있다. 지나갈 수 없다.')
def _topple(c):
    rc(c, 1, 2, 30, 9, K('shiro', -2)); hl(c, 1, 2, 30, K('shiro', -1))
    for x in (8, 16, 24): vl(c, x, 2, 9, K('hodo', 0)); vl(c, x + 1, 2, 9, K('shiro', -1))
    for x in range(2, 30, 3):
        if x % 8: rc(c, x, 5, 2, 4, K('yoru', -2))
    outline(c, 0, 1, 32, 11)
    rc(c, 1, 11, 30, 2, K('hodo', -1)); hl(c, 1, 13, 30, OL)
    for (x, y, r_) in ((4, 13, 'aka'), (12, 14, 'kii'), (20, 13, 'sora'), (27, 14, 'midori')):
        rc(c, x, y, 3, 2, K(r_, -1)); px(c, x, y, K(r_, 0)); px(c, x + 3, y + 1, OL)
    hl(c, 1, 15, 30, K('yoru', -2))


# ══ 보물·단서 ═════════════════════════════════════════════════════════════════
@R.obj('wh-item-crate-open', '열린 나무 상자(보물)', w=1, h=1, up=0, kind='floor', use=('search',), tags=TW + TM + ('보물', '상자', '조사'),
       place='막다른 곳·밀수품 방 — 조사하면 물건이 나오는 자리',
       desc='뚜껑을 비껴 연 나무 상자. 속 노란 짚 사이로 쇠 물건 끝이 반짝인다. 뚜껑 널은 옆에 기대어 있다.')
def _crate_open(c):
    rc(c, 1, 2, 14, 5, K('kii', -1))
    for x in range(2, 14, 2): px(c, x, 2 + (x % 3), K('kii', 0)); px(c, x + 1, 4, K('kii', -2))
    rc(c, 6, 3, 3, 2, K('tekko', 1)); px(c, 6, 3, K('shiro', 2))
    outline(c, 0, 1, 16, 7); hl(c, 1, 1, 14, K('ita', 1))
    rc(c, 1, 7, 14, 7, K('ita', 0)); hl(c, 1, 7, 14, K('ita', 2)); hl(c, 1, 10, 14, K('ita', -1))
    vl(c, 1, 7, 7, K('ita', 1)); vl(c, 14, 7, 7, K('ita', -1)); outline(c, 0, 6, 16, 9)
    hl(c, 1, 15, 14, K('yoru', -2))


@R.obj('wh-item-safe', '작은 금고(단서)', w=1, h=1, up=0, kind='floor', use=('search', 'key'), tags=TW + TM + ('금고', '열쇠', '조사'),
       place='사무 칸·경비실 구석(막다른 곳) — 열쇠·단서 자리', pair=('wh-wicket-door', 'wh-item-manifest'),
       desc='검은 쇠 작은 금고(0.6m). 윗면, 앞면 둥근 다이얼과 손잡이, 경첩. 조사하면 열쇠가 나오는 자리.')
def _safe(c):
    box3(c, 1, 1, 14, 3, 9, 'tekko', -1)
    rc(c, 4, 7, 5, 5, K('tekko', 0)); outline(c, 3, 6, 7, 7); px(c, 6, 9, K('shiro', 0)); px(c, 6, 7, K('kii', 0))
    rc(c, 11, 8, 2, 3, K('tekko', 1)); px(c, 2, 7, K('tekko', 1)); px(c, 2, 11, K('tekko', 1))
    hl(c, 1, 15, 14, K('yoru', -2))


@R.obj('wh-item-manifest', '적하 목록 서류판(단서)', w=1, kind='hang', hrows=2, use=('read', 'search'), tags=TW + ('서류', '단서', '조사'),
       place='사무 칸·밀수품 방 북쪽 벽면 윗줄 — 못에 건 서류판', pair=('wh-item-safe',),
       desc='벽 못에 걸린 서류판(클립보드). 누런 종이 몇 장에 회색 줄(글자 아님)과 빨간 표시 하나. 읽으면 밀수품 단서가 된다.')
def _manifest(c):
    px(c, 7, 3, K('tekko', 1)); px(c, 8, 3, OL)
    rc(c, 3, 5, 10, 14, K('ita', 0)); outline(c, 2, 4, 12, 16)
    rc(c, 4, 7, 8, 11, K('kinari', 1)); hl(c, 4, 7, 8, K('kinari', 2))
    for y in (9, 11, 13, 15): hl(c, 5, y, 6 if y != 13 else 4, K('hodo', 0))
    px(c, 10, 13, K('aka', 1))
    rc(c, 6, 5, 4, 2, K('tekko', 1)); hl(c, 6, 5, 4, K('tekko', 2))
    hl(c, 3, 20, 10, K('yoru', -1))


@R.obj('wh-item-bag', '버려진 가방(보물)', w=1, h=1, up=0, kind='floor', use=('search',), tags=TM + TW + ('가방', '보물', '조사'),
       place='막다른 곳·빈 가게 안 — 조사하면 물건이 나오는 자리',
       desc='바닥에 놓인 감색 보스턴백. 위 지퍼가 반쯤 열려 속이 어둡고, 손잡이 두 줄과 흰 이음선.')
def _bag(c):
    rc(c, 2, 5, 12, 9, K('kon', 0)); hl(c, 2, 5, 12, K('kon', 1)); vl(c, 2, 5, 9, K('kon', 1)); vl(c, 13, 5, 9, K('kon', -1))
    hl(c, 3, 7, 10, K('yoru', -3)); hl(c, 3, 8, 10, K('kon', -2))
    for x in range(3, 13, 2): px(c, x, 6, K('tekko', 1))
    for x0 in (4, 9): hl(c, x0, 2, 3, K('kon', -1)); vl(c, x0, 3, 2, K('kon', -1)); vl(c, x0 + 2, 3, 2, K('kon', -1))
    hl(c, 2, 12, 12, K('shiro', -2))
    outline(c, 1, 4, 14, 11); hl(c, 2, 15, 12, K('yoru', -2))


@R.obj('wh-item-locker', '경비실 사물함(열쇠 자리)', w=1, h=1, up=16, kind='wall', use=('search', 'key'), tags=TM + TW + ('사물함', '경비실', '열쇠'),
       place='경비실·직원 휴게실 북쪽 벽 바로 아래 줄(막다른 방)', pair=('wh-shutter-gate',),
       desc='회색 강철 사물함 한 칸, 문이 조금 열려 안쪽 어둠 속 고리에 걸린 열쇠 꾸러미가 반짝인다. 윗면, 문 위 통풍 홈. 열쇠 자리.')
def _locker(c):
    rc(c, 1, 1, 14, 4, K('tekko', 0)); hl(c, 1, 1, 14, K('tekko', 1)); hl(c, 1, 5, 14, K('tekko', 1))
    rc(c, 1, 6, 14, 24, K('tekko', -1)); hl(c, 1, 6, 14, K('yoru', -2))
    rc(c, 3, 8, 9, 20, K('yoru', -3)); px(c, 6, 13, K('kii', 1)); px(c, 7, 14, K('kii', 0)); px(c, 6, 12, K('tekko', 0))
    rc(c, 11, 8, 3, 20, K('tekko', 0)); vl(c, 11, 8, 20, K('tekko', 1)); vl(c, 14, 8, 20, OL)
    for y in (10, 12): hl(c, 12, y, 2, K('yoru', -2))
    outline(c, 0, 0, 16, 31); hl(c, 1, 31, 14, K('yoru', -2))


@R.obj('wh-item-toolbox', '빨간 공구함(보물)', w=1, h=1, up=0, kind='floor', use=('search',), tags=TW + TM + ('공구함', '보물', '기계실'),
       place='기계실·창고 막다른 곳 — 조사 자리',
       desc='빨간 쇠 공구함. 위 손잡이, 뚜껑 윗면과 앞면 잠금 걸쇠, 옆에 떨어진 렌치 하나.')
def _toolbox(c):
    hl(c, 5, 1, 6, K('tekko', 0)); vl(c, 5, 1, 3, K('tekko', 0)); vl(c, 10, 1, 3, K('tekko', -1))
    box3(c, 1, 3, 14, 3, 7, 'aka', -1)
    px(c, 7, 9, K('tekko', 1)); px(c, 8, 9, K('tekko', 1))
    hl(c, 10, 15, 5, K('tekko', 1)); px(c, 14, 14, K('tekko', 0)); hl(c, 1, 15, 8, K('yoru', -2))


@R.obj('wh-item-firstaid', '구급함(벽걸이)', w=1, kind='hang', hrows=2, use=('heal', 'search'), tags=TM + TW + ('구급함', '회복'),
       place='경비실·사무 칸·기계실 북쪽 벽면 윗줄',
       desc='벽에 건 흰 구급함. 앞에 초록 십자(글자 없음), 손잡이 걸쇠, 아래 그늘. 열면 회복 물품.')
def _firstaid(c):
    rc(c, 2, 5, 12, 11, K('shiro', 0)); hl(c, 2, 5, 12, K('shiro', 1)); vl(c, 13, 5, 11, K('shiro', -1))
    rc(c, 7, 7, 2, 7, K('midori', 0)); rc(c, 5, 9, 6, 3, K('midori', 0)); px(c, 7, 7, K('midori', 1))
    outline(c, 1, 4, 14, 13); hl(c, 2, 17, 12, K('yoru', -1))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

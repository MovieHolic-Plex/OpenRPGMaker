#!/usr/bin/env python3
"""jp_city 4묶음 현대 던전 — 공사 중 빌딩·지하 주차장. id 머리 `cs-`.

  python3 scripts/content/jp-city/blocks/dungeon_construction.py   # selftest + tiledata/jp-city/blocks/dungeon_construction/_all-x3.png

조사·탐색·전투 장소로 쓰는 판이다 — 일반 실내보다 바닥·벽면이 1~2단 어둡고, 먹줄·물자국·녹·얼룩이 있다.
공사장: 맨 콘크리트 슬래브, 거푸집 자국 벽, 가설 합판 칸막이, 비계·철근·H빔·시멘트 포대·케이블 드럼·라바콘·바리케이드·발전기·
현장 사무실(프레하브 컨테이너)·방수포 자재·엘리베이터 갱도 구멍·가설 사다리·난간 없는 콘크리트 계단.
지하 주차장: 회색 에폭시 바닥, 흰·노랑 띠 벽, 모서리 보호대 기둥, 주차 칸 선·바퀴 멈춤턱·경사로 화살표, 주차된 승용차 둘(위에서 본 3/4),
소화전 상자(빨간 표시등)·정산기·셔터(잠긴 문 자리)·꺼진 형광등·비상구 초록 등, 경사로(위·아래).
사람·피·글자·숫자·상표 없음(번호판은 빈 판, 기둥 번호는 색 칸, 비상구 등은 초록 사각 + 화살표).

크기(1칸 = 16px = 1m, modern-style-bible §12-3 공식):
  비계(枠組足場) 폭 1.8m 틀 → 1칸씩 이어 붙임, 한 단 높이 1.7m + 발판 → up 16(세로로 이어 붙여도 칸마다 조각 둘).
  철근 묶음 2×1(길이 4m 를 줄임) 높이 0.3m → up 4.  시멘트 포대 3단(파레트 포함 0.8m) → up 6.
  H빔 3m(H300) 받침목 위 → 3×1, up 4.  케이블 드럼 지름 1.0m → 1×1, up 8.
  라바콘 0.7m → up 8.  바리케이드 0.8m → up 8, 1칸씩 이어 붙임.  작업등 스탠드 1.8m → up 24.
  엘리베이터 갱도 구멍 2×2(1.8m 각), 둘레 단관 난간 0.9m → up 8.  발전기 1.8×0.8×1.0m → 2×1, up 8.
  현장 사무실 컨테이너 3×2(실제 5.4×2.4m 를 줄임) 높이 2.6m → 벽 붙이 wall, up 16.
  방수포 덮은 자재 2×1 높이 0.8m → up 8.  가설 사다리·콘크리트 계단(벽 속으로 오름) → up 32.
  주차장 기둥 0.8m 각 천장까지 → up 32.  승용차 1.75×4.4m·높이 1.45m → 2×3, up 8(세로 진행 차량 c=0.65).
  소화전 상자 0.9m + 표시등, 정산기 1.6m → 벽 붙이 up 16.  경사로 폭 2m(줄임).

캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (up/16 + h)*16, hang = w*16 × hrows*16, door = 16×32.
분류는 interior/categories.py([dungeon_construction cs-] 칸 — construction 공사장 · parking 지하 주차장).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'dungeon_construction'
R = Registry(BLOCK, '공사장·주차장')
TC = ('공사장', '공사 중 빌딩', '工事現場', 'construction', '던전')
TP = ('지하 주차장', '地下駐車場', 'parking', '던전')


# ── 도우미(interior_office.py 와 같은 꼴) ─────────────────────────────────────
def kc(ramp, t): return K(ramp, t)


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


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        px(c, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)


def poly(c, pts, col):
    """다각형 채우기(칸 중심 판정)."""
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(c.w):
            inside = False; n = len(pts)
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
                if (y0 > y + .5) != (y1 > y + .5) and x + .5 < x0 + (y + .5 - y0) * (x1 - x0) / (y1 - y0): inside = not inside
            if inside: px(c, x, y, col)


def chunk(c, x, y, w, t, f, tone=0):
    """콘크리트 덩이 하나: 윗면 t 줄(밝음) + 앞면 f 줄(어둠), 왼쪽 위 모서리 한 점 깎음, 윤곽."""
    rc(c, x, y, w, t, kc('conc', tone + 1)); hl(c, x + 1, y, w - 2, kc('conc', tone + 2))
    rc(c, x, y + t, w, f, kc('conc', tone - 1)); hl(c, x, y + t, w, kc('conc', tone))
    vl(c, x + w - 1, y + 1, t + f - 1, kc('conc', tone - 2))
    hl(c, x, y - 1, w, OL); hl(c, x, y + t + f, w, OL); vl(c, x - 1, y, t + f, OL); vl(c, x + w, y, t + f, OL)
    px(c, x, y, OL); px(c, x + w - 1, y + t + f - 1, kc('conc', -3))


def hazard(c, x, y, w, h, period=8):
    """노랑·검정 사선 띠(주기 period px — 칸 16px 의 약수라 이어 붙여도 사선이 끊기지 않는다)."""
    for j in range(h):
        for i in range(w):
            px(c, x + i, y + j, kc('kii', 0) if ((x + i + y + j) // (period // 2)) % 2 == 0 else kc('sumi', 0))


def wrapd(a, b, m):
    d = abs(a - b) % m
    return min(d, m - d)


def stain(c, cx, cy, rx, ry, col, seed, edge=None):
    """주기 캔버스 위 얼룩(가장자리 감싸기) — 경계는 성긴 점."""
    for y in range(c.h):
        for x in range(c.w):
            dx, dy = wrapd(x, cx, c.w) / rx, wrapd(y, cy, c.h) / ry
            r = dx * dx + dy * dy
            if r <= 0.65: c.P(x, y, col)
            elif r <= 1.0 and rnd(x, y, seed, 450): c.P(x, y, edge or col)


# ══ 바닥 ════════════════════════════════════════════════════════════════════
@R.floor('cs-slab', '맨 콘크리트 슬래브(공사 중)', cols=4, rows=4, tags=TC,
         desc='마감 전 맨 콘크리트 슬래브 — 어두운 회색에 잔 점, 물자국 얼룩, 가는 먹줄(墨出し) 한 줄과 십자 표시, 잔금. 공사 중 빌딩 1층·2층 바닥.')
def _slab(c):
    for y in range(c.h):
        for x in range(c.w):
            col = kc('conc', -1)
            if rnd(x // 2, y // 2, 101, 28): col = kc('conc', -2)                   # 성긴 2px 얼룩 알
            elif rnd(x, y, 102, 18): col = kc('conc', 0)
            c.P(x, y, col)
    stain(c, 14, 46, 11, 7, kc('conc', -2), 103)                          # 물자국
    stain(c, 50, 14, 7, 5, kc('conc', -2), 104)
    for y in range(c.h):                                                 # 먹줄(세로 한 줄, 군데군데 닳음)
        if not rnd(40, y, 105, 180): c.P(40, y, kc('conc', -3))
    for x in range(34, 47):                                              # 먹줄 십자 표시
        if x != 40: c.P(x, 22, kc('conc', -3))
    for (x0, y0, steps) in ((6, 8, ((1, 1), (1, 0), (1, 1), (0, 1), (1, 1), (1, 0))), (54, 40, ((-1, 1), (0, 1), (-1, 1), (-1, 0), (0, 1)))):
        x, y = x0, y0                                                    # 잔금
        for dx, dy in steps:
            c.P(x % c.w, y % c.h, kc('conc', -3)); x += dx; y += dy


@R.floor('cs-parking-floor', '지하 주차장 에폭시 바닥', cols=4, rows=4, tags=TP,
         desc='어두운 회청색 에폭시를 칠한 지하 주차장 바닥 — 잔 점, 군데군데 짧은 광택, 타이어 자국 호. 차로·주차 칸 공통.')
def _parking_floor(c):
    for y in range(c.h):
        for x in range(c.w):
            col = kc('hodo', -2)
            if rnd(x // 2, y // 2, 111, 22): col = kc('hodo', -3)
            elif rnd(x, y, 114, 14): col = kc('hodo', -1)
            c.P(x, y, col)
    for k in range(5):                                                    # 짧은 광택(대각)
        x0, y0 = hs(k, 0, 112) % 64, hs(k, 1, 112) % 64
        for i in range(4): c.P((x0 + i) % 64, (y0 - i) % 64, kc('hodo', -1))
    for (cx, cy, r, a0, a1) in ((20, 70, 34, 200, 250), (52, 70, 34, 200, 250)):   # 타이어 자국 호(두 줄)
        for t in range(a0, a1):
            a = math.radians(t)
            x, y = round(cx + r * math.cos(a)), round(cy + r * math.sin(a))
            c.P(x % 64, y % 64, kc('hodo', -3))
    stain(c, 44, 30, 6, 4, kc('hodo', -3), 113)                           # 기름 얼룩


@R.floor('cs-parking-floor-dark', '지하 주차장 바닥(아래층, 더 어둡고 젖음)', cols=4, rows=4, tags=TP,
         desc='한 층 더 내려간 주차장의 더 어두운 에폭시 바닥 — 물이 번진 얼룩과 젖은 반사 점, 타이어 자국. 지하 2층(B2).')
def _parking_floor_dark(c):
    for y in range(c.h):
        for x in range(c.w):
            col = kc('hodo', -3)
            if rnd(x // 2, y // 2, 116, 22): col = kc('yoru', -2)
            elif rnd(x, y, 117, 12): col = kc('hodo', -2)
            c.P(x, y, col)
    stain(c, 18, 44, 13, 7, kc('yoru', -1), 118)                            # 번진 물(바닥보다 한 단만)
    for (x, y) in ((14, 42), (20, 46), (50, 11)): c.P(x, y, kc('garasu', -1)); c.P(x + 1, y, kc('garasu', -2))   # 젖은 반사
    for t in range(200, 250):                                             # 타이어 자국
        a = math.radians(t)
        for cx in (24, 40):
            c.P(round(cx + 30 * math.cos(a)) % 64, round(60 + 30 * math.sin(a)) % 64, kc('yoru', -2))


# ══ 벽면(2줄 = 32px) ═══════════════════════════════════════════════════════
def _tone(x, y, up, low, split=16, band=3):
    if y < split - band: return up
    if y >= split + band: return low
    return up if ((x + y) % 2 == 0) == (y < split) else low


@R.wall('cs-wall-bare', '맨 콘크리트 벽면(거푸집 자국)', cols=4, tags=TC,
        desc='거푸집을 뗀 맨 콘크리트 벽 — 패널 이음 세로줄, 세퍼레이터 구멍(P콘) 점, 위에서 흘러내린 물자국, 녹슨 철근 끝 둘, 아래 흙 때. 공사 중 빌딩.')
def _wall_bare(c):
    for y in range(32):
        for x in range(c.w):
            col = _tone(x, y, kc('conc', 0), kc('conc', -1))
            if rnd(x, y, 121, 45): col = kc('conc', -1) if col == kc('conc', 0) else kc('conc', -2)
            c.P(x, y, col)
    for x0 in range(0, c.w, 16):
        vl(c, x0, 0, 32, kc('conc', -2)); vl(c, x0 + 1, 0, 32, kc('conc', 1))
        for (hx, hy) in ((5, 7), (11, 7), (5, 21), (11, 21)):              # P콘 구멍
            px(c, x0 + hx, hy, kc('conc', -3)); px(c, x0 + hx + 1, hy, kc('conc', -3)); px(c, x0 + hx, hy + 1, kc('conc', -3))
            px(c, x0 + hx + 1, hy + 1, kc('conc', -2)); px(c, x0 + hx + 2, hy + 2, kc('conc', 1))
    for x in (9, 30, 51):                                                 # 물자국(위에서)
        n = 6 + hs(x, 0, 122) % 12
        for y in range(4, 4 + n): px(c, x, y, kc('conc', -2))
        for y in range(4, 4 + n // 2): px(c, x + 1, y, kc('conc', -2))
    for x in (40, 45):                                                    # 녹슨 철근 끝 + 녹물 줄
        px(c, x, 20, kc('kawara', 1)); px(c, x + 1, 20, kc('kawara', 0)); px(c, x, 21, kc('kawara', 0)); px(c, x + 1, 21, OL)
        for y in range(22, 29): px(c, x, y, kc('kawara', 0) if y < 25 else kc('kawara', -1))
        for y in range(22, 26): px(c, x + 1, y, kc('kawara', -1))
    for (x, y0, n) in ((20, 2, 9), (58, 4, 6)):                           # 백화(흰 소금기 줄)
        for y in range(y0, y0 + n): px(c, x, y, kc('conc', 2) if y % 3 else kc('conc', 1))
        px(c, x + 1, y0, kc('conc', 2))
    for x in range(c.w):
        px(c, x, 29, kc('conc', -2)); px(c, x, 30, kc('soil', -1) if rnd(x, 30, 123, 300) else kc('conc', -2)); px(c, x, 31, kc('conc', -3))


@R.wall('cs-plywood-wall', '가설 합판 벽면', cols=4, tags=TC,
        desc='콘크리트 거푸집용 합판(コンパネ)을 못으로 박은 가설 칸막이 — 주황빛 합판 판 이음·못 점, 허리 높이 각재 띠, 아래 물먹은 얼룩. 자재 창고·현장 칸막이.')
def _plywood(c):
    for y in range(32):
        for x in range(c.w):
            col = _tone(x, y, kc('yuka', 0), kc('yuka', -1))
            if (y + hs(x // 8, 0, 131) % 4) % 5 == 0 and rnd(x, y, 132, 600): col = kc('yuka', -1) if col == kc('yuka', 0) else kc('yuka', -2)   # 나뭇결
            c.P(x, y, col)
    for x0 in range(0, c.w, 16):
        vl(c, x0, 0, 32, kc('ita', -2))
        for y in range(3, 30, 5): px(c, x0 + 2, y, kc('tekko', 1)); px(c, x0 + 13, y + 2, kc('tekko', 1))   # 못
    rc(c, 0, 12, c.w, 3, kc('ita', 0)); hl(c, 0, 12, c.w, kc('ita', 1)); hl(c, 0, 15, c.w, kc('ita', -2))   # 각재 띠
    for x in range(c.w):
        if rnd(x, 0, 133, 500): px(c, x, 26, kc('yuka', -2))
        px(c, x, 27, kc('yuka', -2)); px(c, x, 28, kc('ita', -1)); px(c, x, 29, kc('ita', -1)); px(c, x, 30, kc('ita', -2)); px(c, x, 31, kc('ita', -3))


@R.wall('cs-parking-wall', '지하 주차장 벽면(흰·노랑 띠)', cols=4, tags=TP,
        desc='때 묻은 흰 칠 콘크리트 벽에 노랑 띠 한 줄, 아래 노랑·검정 사선 걸레받이, 4칸마다 파란 색 칸(기둥 번호 자리 — 숫자 없음). 위에서 흘러내린 물때.')
def _parking_wall(c):
    for y in range(32):
        for x in range(c.w):
            col = _tone(x, y, kc('shiro', -1), kc('shiro', -1))
            if rnd(x, y, 141, 40): col = kc('shiro', -2)
            c.P(x, y, col)
    for x in (6, 23, 37, 58):                                             # 물때
        n = 5 + hs(x, 1, 142) % 10
        for y in range(3, 3 + n): px(c, x, y, kc('shiro', -2))
    rc(c, 0, 16, c.w, 3, kc('kii', 0)); hl(c, 0, 16, c.w, kc('kii', 1)); hl(c, 0, 19, c.w, kc('shiro', -2))   # 노랑 띠
    hl(c, 0, 1, c.w, kc('tekko', 2)); hl(c, 0, 2, c.w, kc('tekko', 0)); hl(c, 0, 3, c.w, OL)                     # 노출 전선관
    for x0 in (14, 46):
        rc(c, x0, 0, 3, 4, kc('tekko', 1)); px(c, x0, 0, kc('tekko', 3))
        for y in range(4, 4 + 5 + x0 % 4): px(c, x0 + 1, y, kc('kawara', 0) if y < 7 else kc('kawara', -1))     # 녹물 줄
    rc(c, 4, 4, 9, 9, kc('sora', 0)); outline(c, 4, 4, 9, 9, kc('sora', -2)); rc(c, 6, 6, 3, 3, kc('sora', 1)); px(c, 10, 9, kc('sora', 1))   # 색 칸
    hl(c, 0, 25, c.w, kc('shiro', -2))
    hazard(c, 0, 26, c.w, 5)
    hl(c, 0, 31, c.w, OL)


@R.wall('cs-parking-wall-dark', '지하 주차장 벽면(아래층, 바랜 띠·물때)', cols=4, tags=TP,
        desc='더 어두운 회색으로 바랜 주차장 벽 — 칠이 벗겨진 노랑 띠, 굵은 물때 줄과 녹물, 아래 사선 걸레받이가 닳았다. 지하 2층(B2).')
def _parking_wall_dark(c):
    for y in range(32):
        for x in range(c.w):
            col = kc('shiro', -2)
            if rnd(x, y, 145, 50): col = kc('conc', -1)
            c.P(x, y, col)
    for x in (5, 6, 21, 33, 34, 50):                                       # 굵은 물때
        n = 8 + hs(x, 2, 146) % 12
        for y in range(2, 2 + n): px(c, x, y, kc('conc', -2))
    for x0 in (14, 46):                                                   # 노출 전선관 + 녹물
        rc(c, x0, 0, 3, 4, kc('tekko', 0)); px(c, x0, 0, kc('tekko', 2))
        for y in range(4, 12): px(c, x0 + 1, y, kc('kawara', 0) if y < 8 else kc('kawara', -1))
    hl(c, 0, 1, c.w, kc('tekko', 1)); hl(c, 0, 2, c.w, kc('tekko', -1)); hl(c, 0, 3, c.w, OL)
    for x in range(c.w):                                                  # 바랜 노랑 띠(벗겨짐)
        for y in (16, 17, 18):
            if not rnd(x // 2, y, 147, 300): px(c, x, y, kc('kii', -1) if y > 16 else kc('kii', 0))
    hl(c, 0, 25, c.w, kc('conc', -2))
    hazard(c, 0, 26, c.w, 5)
    for x in range(c.w):
        for y in range(26, 31):
            if rnd(x, y, 148, 220): px(c, x, y, kc('conc', -2))
    hl(c, 0, 31, c.w, OL)


@R.wall('cs-mesh-sheet', '비계 안전망 시트 벽면', cols=4, tags=TC,
        desc='벽이 아직 없는 층 가장자리 — 비계 철관 두 줄에 묶은 초록 안전망 시트, 그물코 사이로 바깥 어둠이 비치고 군데군데 찢어졌다. 공사 중 빌딩 위층 가장자리.')
def _mesh(c):
    for y in range(32):
        for x in range(c.w):
            col = kc('midori', -2)
            if x % 2 == 0 and y % 2 == 0: col = kc('midori', -1)
            elif (x + y) % 4 == 1: col = kc('yoru', -3)
            c.P(x, y, col)
    for (cx, cy) in ((22, 22), (49, 9)):                                   # 찢어진 곳
        for y in range(cy - 2, cy + 3):
            for x in range(cx - 3 + abs(y - cy), cx + 4 - abs(y - cy)): px(c, x, y, kc('yoru', -3))
        line(c, cx - 3, cy - 2, cx + 3, cy + 2, kc('midori', -1))
    for y0 in (3, 20):                                                    # 비계 철관
        hl(c, 0, y0, c.w, kc('tekko', 2)); hl(c, 0, y0 + 1, c.w, kc('tekko', 0)); hl(c, 0, y0 + 2, c.w, OL)
        for x0 in range(5, c.w, 16): rc(c, x0, y0 - 1, 3, 5, kc('tekko', 1)); px(c, x0, y0 - 1, kc('tekko', 3)); hl(c, x0, y0 + 3, 3, OL)   # 클램프
    for x in range(c.w):
        if x % 16 < 1: continue
        if (x // 3) % 2: px(c, x, 6 + (x % 3), kc('kinari', -1))           # 묶은 끈
    rc(c, 0, 28, c.w, 4, kc('conc', -2)); hl(c, 0, 28, c.w, kc('conc', 0)); hl(c, 0, 31, c.w, kc('conc', -3))   # 슬래브 끝


# ══ 공사장 ═══════════════════════════════════════════════════════════════════
@R.obj('cs-scaffold', '비계(틀 비계 한 칸)', w=1, h=1, up=16, kind='floor', use=('block',), tags=TC + ('비계', '足場'),
       place='공사장 바닥, 가로·세로로 1칸씩 이어 붙여 벽·통로를 만든다(비계 미로). 가로 줄 바로 북쪽에 1줄 통로를 두지 않는다(윗단이 덮는다).',
       desc='철관 기둥과 X 가새, 구멍 뚫린 강철 발판의 틀 비계(枠組足場) 한 칸(높이 2m 한 단). 가로로 이어 붙이면 발판·손잡이가 이어진다. 지나갈 수 없다.')
def _scaffold(c):
    line(c, 5, 11, 15, 27, OL); line(c, 5, 27, 15, 11, OL)                # X 가새(밝은 줄 + 그늘)
    line(c, 5, 10, 15, 26, kc('tekko', 2)); line(c, 5, 26, 15, 10, kc('tekko', 1))
    hl(c, 0, 1, 16, OL)                                                   # 강철 발판(윗단)
    rc(c, 0, 2, 16, 4, kc('tekko', 3)); hl(c, 0, 2, 16, kc('tekko', 4))
    for x in range(1, 16, 3): px(c, x, 4, kc('tekko', 1))
    hl(c, 0, 6, 16, kc('tekko', 4)); hl(c, 0, 7, 16, kc('tekko', 0)); hl(c, 0, 8, 16, OL)
    hl(c, 0, 18, 16, kc('tekko', 3)); hl(c, 0, 19, 16, OL)                # 손잡이 철관
    vl(c, 1, 0, 31, OL); vl(c, 2, 0, 30, kc('tekko', 3)); vl(c, 3, 0, 30, kc('tekko', 0)); vl(c, 4, 0, 31, OL)   # 철관 기둥
    rc(c, 1, 12, 4, 2, kc('tekko', 1)); px(c, 1, 12, kc('tekko', 4))      # 이음 클램프
    rc(c, 0, 29, 7, 2, kc('tekko', -1)); hl(c, 0, 29, 7, kc('tekko', 1)); hl(c, 0, 31, 7, OL)   # 받침 철판
    for x in range(7, 16):
        if rnd(x, 30, 151, 400): px(c, x, 30, kc('conc', -3))


@R.obj('cs-rebar', '철근 묶음', w=2, h=1, up=4, kind='floor', use=('block',), tags=TC + ('철근', '자재'),
       place='자재 야적(입구 가까운 넓은 곳), 받침목 위. 벽을 따라 또는 통로 가장자리에.',
       desc='받침목 두 개 위에 가로로 쌓아 철사로 묶은 이형 철근 묶음 2칸 — 윗면에 마디 결과 녹. 지나갈 수 없다.')
def _rebar(c):
    for x0 in (4, 24):                                                    # 받침목
        rc(c, x0, 25, 5, 6, kc('ita', -1)); hl(c, x0, 25, 5, kc('ita', 1)); vl(c, x0 + 4, 25, 6, kc('ita', -2)); outline(c, x0 - 1, 24, 7, 8)
    for i, y in enumerate(range(12, 26, 2)):
        front = y >= 22
        base = kc('tekko', -1 if front else 0); hi = kc('tekko', 0 if front else 1)
        hl(c, 0, y, 32, hi); hl(c, 0, y + 1, 32, kc('tekko', -2 if front else -1))
        for x in range(i % 3, 32, 3): px(c, x, y, base)                   # 마디
        for x in range(32):
            if rnd(x, y, 161, 90): px(c, x, y + (x % 2), kc('kawara', 0) if x % 3 else kc('soil', 0))   # 녹
    for x in (11, 20):                                                    # 결속선
        vl(c, x, 12, 14, kc('tekko', 3)); px(c, x, 11, kc('tekko', 2))
    hl(c, 0, 11, 32, OL); hl(c, 0, 26, 32, OL); vl(c, 0, 11, 16, OL); vl(c, 31, 11, 16, OL)
    for y in (13, 17, 21): px(c, 31, y, kc('tekko', 2)); px(c, 0, y + 1, kc('tekko', 1))   # 끝 단면


@R.obj('cs-cement-bags', '시멘트 포대 더미', w=1, h=1, up=6, kind='floor', use=('block',), tags=TC + ('자재',),
       place='자재 야적, 파레트째. 철근·H빔 곁.',
       desc='나무 파레트 위에 3단으로 쌓은 종이 시멘트 포대 — 윗면 두 포대가 볼록하고 앞에 단마다 포대 끝과 색 띠(글자 없음), 오른쪽 아래 터진 포대에서 흘러나온 가루.')
def _cement(c):
    rc(c, 0, 27, 16, 5, kc('ita', 0)); hl(c, 0, 27, 16, kc('ita', 1)); hl(c, 0, 28, 16, kc('ita', 0))
    for x0 in (0, 6, 12): rc(c, x0 + 1, 29, 3, 2, kc('ita', -1))
    for x in (4, 5, 9, 10, 11): rc(c, x, 29, 1, 2, kc('yoru', -2))
    hl(c, 0, 31, 16, OL)
    for k, y in enumerate((21, 15)):                                     # 단마다 포대 끝(앞면)
        rc(c, 1, y, 14, 6, kc('kinari', 0)); hl(c, 1, y, 14, kc('kinari', 1)); hl(c, 1, y + 5, 14, kc('kinari', -2))
        vl(c, 7 + k, y, 6, kc('kinari', -1)); vl(c, 8 + k, y, 6, kc('kinari', -2))
        hl(c, 2, y + 2, 5 + k, kc('midori', -1)); hl(c, 10 + k, y + 2, 4 - k, kc('midori', -1))
        vl(c, 1, y, 6, kc('kinari', 1)); vl(c, 14, y, 6, kc('kinari', -1))
    for x0 in (1, 8):                                                     # 맨 윗단 윗면
        rc(c, x0, 9, 7, 6, kc('kinari', 1)); hl(c, x0 + 1, 9, 5, kc('kinari', 2)); vl(c, x0, 10, 4, kc('kinari', 2))
        px(c, x0 + 3, 11, kc('kinari', 2)); hl(c, x0, 14, 7, kc('kinari', 0))
    vl(c, 8, 9, 6, kc('kinari', -1))
    outline(c, 0, 8, 16, 20)
    for (x, y) in ((13, 26), (14, 26), (12, 27), (15, 27), (14, 25)): px(c, x, y, kc('conc', 2))   # 터진 가루
    px(c, 13, 24, kc('kinari', -2)); px(c, 12, 25, kc('kinari', -2))


@R.obj('cs-steel-beam', 'H빔(철골 보)', w=3, h=1, up=4, kind='floor', use=('block',), tags=TC + ('철골', '자재'),
       place='자재 야적, 받침목 위에 가로로. 통로 가장자리를 막는 데도 쓴다.',
       desc='받침목 위에 누운 3m H형강 — 윗면은 위 플랜지, 앞에서 플랜지 날 사이로 웨브가 들어가 어둡다. 녹 얼룩. 지나갈 수 없다.')
def _beam(c):
    for x0 in (4, 38):
        rc(c, x0, 26, 6, 5, kc('ita', -1)); hl(c, x0, 26, 6, kc('ita', 1)); outline(c, x0 - 1, 25, 8, 7)
    hl(c, 1, 13, 46, OL)
    rc(c, 1, 14, 46, 5, kc('tekko', 1)); hl(c, 1, 14, 46, kc('tekko', 2)); vl(c, 1, 14, 5, kc('tekko', 2))   # 위 플랜지 윗면
    hl(c, 1, 18, 46, kc('tekko', 3))                                      # 앞 날 하이라이트
    rc(c, 1, 19, 46, 2, kc('tekko', -1))                                  # 위 플랜지 앞날
    rc(c, 1, 21, 46, 4, kc('yoru', -2)); hl(c, 1, 21, 46, OL)             # 들어간 웨브(그늘)
    for x in range(3, 46, 5): px(c, x, 23, kc('tekko', -2))
    rc(c, 1, 25, 46, 2, kc('tekko', 0)); hl(c, 1, 25, 46, kc('tekko', 1)); hl(c, 1, 27, 46, OL)   # 아래 플랜지 앞날
    vl(c, 0, 13, 15, OL); vl(c, 47, 13, 15, OL)
    for x in range(2, 46):
        if rnd(x, 15, 171, 110): px(c, x, 15 + (x % 3), kc('kawara', 0))
        if rnd(x, 19, 172, 160): px(c, x, 19, kc('kawara', -1))
    for x in (12, 13, 30, 31):                                            # 녹물 줄(앞날 아래)
        vl(c, x, 19, 2, kc('kawara', 0))


@R.obj('cs-cable-drum', '케이블 드럼', w=1, h=1, up=8, kind='floor', use=('block',), tags=TC + ('자재',),
       place='자재 야적·발전기 곁', pair=('cs-generator',),
       desc='나무 원판 둘 사이에 검은 전선을 감은 케이블 드럼 — 앞(남쪽) 원판이 보이고, 그 위로 감긴 전선 윗면과 뒤 원판 테가 보인다.')
def _drum(c):
    rc(c, 2, 8, 12, 3, kc('ita', -1)); hl(c, 2, 8, 12, kc('ita', 0)); hl(c, 1, 7, 14, OL)          # 뒤 원판 테
    for y in range(11, 17):                                               # 감긴 전선 윗면
        hl(c, 2, y, 12, kc('yoru', 1) if y % 2 else kc('yoru', -1))
    for x in range(2, 14, 3): px(c, x, 12, kc('yoru', 2))
    vl(c, 1, 8, 9, OL); vl(c, 14, 8, 9, OL)
    disc(c, 8, 22, 7.6, 7.6, OL)                                          # 앞 원판
    disc(c, 8, 22, 6.6, 6.6, kc('ita', 0))
    for x in range(2, 15, 4): vl(c, x, 15, 14, kc('ita', -1))             # 널 이음
    disc(c, 8, 22, 6.6, 6.6, None)
    for y in range(15, 30):
        for x in range(1, 16):
            dx, dy = x + .5 - 8, y + .5 - 22
            r = math.hypot(dx, dy)
            if 5.8 <= r <= 6.6: px(c, x, y, kc('ita', 1) if dx + dy < -1 else kc('ita', -2))
    disc(c, 8, 22, 2.2, 2.2, kc('yoru', -2)); px(c, 7, 21, kc('yoru', 0))  # 축 구멍
    for (x, y) in ((4, 18), (12, 18), (4, 26), (12, 26)): px(c, x, y, kc('tekko', 2))   # 볼트
    hl(c, 3, 30, 10, kc('conc', -3))


@R.obj('cs-cone', '라바콘', w=1, h=1, up=8, kind='floor', use=('block',), tags=TC + TP[:1] + ('콘',),
       place='통로 막기·구멍 둘레·주차장 빈 칸. 바리케이드 끝에.', pair=('cs-barrier',),
       desc='검은 사각 받침에 선 빨간 라바콘 — 흰 반사 띠 두 줄. 지나갈 수 없다.')
def _cone(c):
    rc(c, 1, 25, 14, 4, kc('yoru', -1)); hl(c, 1, 25, 14, kc('yoru', 1)); vl(c, 1, 25, 4, kc('yoru', 1))
    rc(c, 1, 29, 14, 2, kc('yoru', -3)); outline(c, 0, 24, 16, 8)
    for y in range(6, 27):
        hw = 1 + (y - 6) * 5 // 20
        for x in range(8 - hw, 8 + hw):
            band = y in (12, 13, 19, 20, 21)
            if x == 8 - hw: col = kc('shiro', 2) if band else kc('aka', 1)
            elif x >= 8 + hw - 2: col = kc('shiro', -1) if band else kc('aka', -1)
            else: col = kc('shiro', 1) if band else kc('aka', 0)
            px(c, x, y, col)
        px(c, 8 - hw - 1, y, OL); px(c, 8 + hw, y, OL)
    hl(c, 7, 5, 2, OL); px(c, 7, 6, kc('aka', 2))


@R.obj('cs-barrier', '공사 바리케이드', w=1, h=1, up=8, kind='floor', use=('block',), tags=TC + TP[:1] + ('바리케이드',),
       place='통로·층 가장자리·구멍 둘레를 막는 줄. 가로로 1칸씩 이어 붙인다(널이 이어진다), 끝에 라바콘.', pair=('cs-cone',),
       desc='흰 철 다리에 노랑·검정 사선 널 두 줄을 건 공사 바리케이드 한 칸. 이어 붙이면 널이 끊기지 않고 이어진다. 지나갈 수 없다.')
def _barrier(c):
    for x0 in (2, 12):                                                    # 다리
        vl(c, x0, 9, 21, kc('shiro', 1)); vl(c, x0 + 1, 9, 21, kc('shiro', -1)); vl(c, x0 - 1, 12, 18, OL); vl(c, x0 + 2, 12, 18, OL)
        rc(c, x0 - 1, 29, 4, 2, kc('yoru', -1)); hl(c, x0 - 1, 31, 4, OL)
    for y0, h in ((9, 6), (19, 4)):                                       # 사선 널(윗날 + 앞면)
        hl(c, 0, y0 - 1, 16, OL)
        hl(c, 0, y0, 16, kc('shiro', 1))
        hazard(c, 0, y0 + 1, 16, h - 1)
        hl(c, 0, y0 + h, 16, OL)


@R.obj('cs-work-light', '작업등 스탠드', w=1, h=1, up=24, kind='floor', use=('light',), tags=TC + ('조명',),
       place='공사장 넓은 곳·현장 사무실 앞·발전기 곁', pair=('cs-generator',),
       desc='삼각 다리 스탠드 위의 사각 투광 작업등 — 켜져 노랗게 빛나는 앞면과 보호 철망, 바닥으로 늘어진 전선. 지나갈 수 없다.')
def _wlight(c):
    rc(c, 2, 9, 12, 2, kc('tekko', 1)); hl(c, 2, 9, 12, kc('tekko', 2))   # 등 윗면
    rc(c, 2, 11, 12, 9, kc('tekko', -2))
    rc(c, 3, 12, 10, 7, kc('kii', 2)); hl(c, 3, 12, 10, kc('shiro', 2)); rc(c, 4, 13, 3, 2, kc('shiro', 2))
    for x in (5, 8, 11): vl(c, x, 12, 7, kc('kii', 1))                    # 철망
    hl(c, 3, 16, 10, kc('kii', 1))
    outline(c, 1, 8, 14, 13)
    rc(c, 6, 21, 3, 2, kc('tekko', 0)); outline(c, 5, 20, 5, 4)           # 받침 관절
    vl(c, 7, 24, 16, kc('tekko', 2)); vl(c, 8, 24, 16, kc('tekko', -1)); vl(c, 6, 24, 16, OL); vl(c, 9, 24, 16, OL)
    line(c, 7, 39, 2, 46, kc('tekko', 1)); line(c, 8, 39, 13, 46, kc('tekko', 0)); line(c, 8, 40, 8, 44, kc('tekko', 0))
    for (x, y) in ((2, 46), (13, 46), (8, 44)): px(c, x, y + 1, OL)
    line(c, 9, 30, 15, 45, kc('yoru', -1))                                # 전선


@R.obj('cs-shaft-hole', '엘리베이터 갱도 구멍', w=2, h=2, up=8, kind='floor', use=('block', 'trap'), tags=TC + ('갱도', '구멍'),
       place='공사장 가운데. 둘레를 1칸 길로 비워 한 바퀴 돌게 한다(고리 길). 몬스터·함정 자리.',
       desc='엘리베이터가 들어갈 자리에 뚫린 2×2 갱도 구멍 — 북쪽 안벽이 어둠 속으로 내려가고 가이드 레일 둘과 와이어가 보인다. 둘레에 노랑·검정 단관 난간. 지나갈 수 없다(떨어지는 함정 자리).')
def _shaft(c):
    rc(c, 0, 14, 32, 34, kc('conc', 0)); hl(c, 0, 14, 32, kc('conc', 1))  # 슬래브 둘레 윗면
    rc(c, 3, 17, 26, 27, kc('sumi', -1))                                  # 구멍
    for y, t in ((17, 0), (18, -1), (19, -1), (20, -2), (21, -2), (22, -3), (23, -3)):   # 북쪽 안벽이 어둠으로
        hl(c, 3, y, 26, kc('conc', t))
    for y in range(24, 30): hl(c, 3, y, 26, kc('yoru', -2) if y < 27 else kc('yoru', -3))
    for x in (9, 22):                                                     # 가이드 레일
        vl(c, x, 17, 24, kc('tekko', -1)); vl(c, x + 1, 17, 18, kc('tekko', -2))
    for x in (15, 16): vl(c, x, 17, 26, kc('tekko', -2) if x == 15 else kc('yoru', 0))   # 와이어
    vl(c, 3, 17, 27, kc('conc', -3)); vl(c, 28, 17, 27, kc('yoru', -3))
    hl(c, 3, 16, 26, OL); hl(c, 3, 44, 26, kc('conc', 2)); hl(c, 3, 45, 26, kc('conc', 0))   # 앞 턱
    hazard(c, 0, 46, 32, 2)
    # 단관 난간: 뒤(북) 가로대 → 옆 기둥 → 앞(남) 가로대
    for x in (1, 15, 30):
        vl(c, x, 8, 9, kc('tekko', 2)); vl(c, x + 1 if x < 30 else x - 1, 8, 9, OL)
    hazard(c, 1, 8, 30, 2, period=4); hl(c, 1, 7, 30, OL); hl(c, 1, 10, 30, OL)
    for x in (1, 30):
        vl(c, x, 10, 28, kc('kii', 1) if x == 1 else kc('kii', -1)); vl(c, x + (1 if x == 1 else -1), 12, 26, OL)
    for x in (1, 15, 30): vl(c, x, 37, 9, kc('tekko', 1))
    hazard(c, 1, 36, 30, 2, period=4); hl(c, 1, 35, 30, OL); hl(c, 1, 38, 30, OL)


@R.obj('cs-ladder-up', '가설 사다리(위층으로)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',), tags=TC + ('사다리', '梯子'),
       place='북쪽 벽 바로 아래 첫 바닥 줄. 발칸에 위층으로 가는 links — 위층 cs-ladder-down 아랫칸 옆에 내린다.', pair=('cs-ladder-down',),
       desc='북쪽 벽에 기대 세운 알루미늄 가설 사다리 — 천장 슬래브에 뚫린 어두운 구멍으로 올라간다. 발칸은 밟을 수 있고, 거기서 위층으로 간다.')
def _ladder_up(c):
    rc(c, 1, 0, 14, 7, kc('sumi', -1)); rc(c, 2, 1, 12, 4, kc('yoru', -3))   # 슬래브 구멍
    hl(c, 1, 6, 14, kc('conc', -1)); hl(c, 1, 7, 14, kc('conc', -2)); hl(c, 1, 8, 14, OL)
    for y in range(9, 45, 5):                                             # 가로대
        hl(c, 5, y, 6, kc('tekko', 3)); hl(c, 5, y + 1, 6, kc('tekko', 0))
    for x0 in (3, 11):                                                    # 세로대
        vl(c, x0 - 1, 2, 44, OL); vl(c, x0, 2, 44, kc('tekko', 4)); vl(c, x0 + 1, 2, 44, kc('tekko', 1)); vl(c, x0 + 2, 2, 44, OL)
        rc(c, x0 - 1, 45, 4, 2, kc('yoru', -1)); hl(c, x0 - 1, 47, 4, OL)
    for x in range(1, 15):
        px(c, x, 0, kc('sumi', -1))


@R.obj('cs-ladder-down', '가설 사다리 구멍(아래층으로)', w=1, h=2, up=16, kind='floor', walk=[(0, 1)], stairs='down', use=('travel',), tags=TC + ('사다리', '梯子'),
       place='위층 바닥. 아래층 cs-ladder-up 과 짝. 윗칸(구멍·사다리 끝)은 막히고 아랫칸을 밟으면 아래층으로 — 그 칸에 links.', pair=('cs-ladder-up',),
       desc='슬래브에 뚫린 사각 구멍으로 알루미늄 사다리 끝이 1m 솟아 있다. 구멍 둘레 노랑·검정 칠. 아랫칸에 서면 아래층으로 내려간다.')
def _ladder_down(c):
    hazard(c, 1, 16, 14, 2, period=4); hazard(c, 1, 30, 14, 2, period=4)
    vl(c, 1, 16, 16, kc('kii', 0)); vl(c, 14, 16, 16, kc('sumi', 0))
    rc(c, 2, 18, 12, 12, kc('sumi', -1)); hl(c, 2, 18, 12, kc('conc', -2)); hl(c, 2, 19, 12, kc('conc', -3))   # 구멍
    for y in range(22, 30, 4): hl(c, 5, y, 6, kc('tekko', -1))            # 구멍 속 가로대(어둠)
    for x0 in (3, 11):                                                    # 솟은 세로대
        vl(c, x0 - 1, 4, 26, OL); vl(c, x0, 4, 26, kc('tekko', 4)); vl(c, x0 + 1, 4, 26, kc('tekko', 1)); vl(c, x0 + 2, 4, 26, OL)
        rc(c, x0 - 1, 3, 4, 2, kc('yoru', -1)); hl(c, x0 - 1, 2, 4, OL)
    for y in (8, 13): hl(c, 5, y, 6, kc('tekko', 3)); hl(c, 5, y + 1, 6, kc('tekko', 0))
    outline(c, 0, 15, 16, 18)


@R.obj('cs-generator', '이동식 발전기', w=2, h=1, up=8, kind='floor', use=('switch',), tags=TC + ('발전기',),
       place='공사장 벽 곁·현장 사무실 가까이. 케이블 드럼·작업등과 함께.', pair=('cs-cable-drum', 'cs-work-light'),
       desc='노란 방음 상자형 이동식 발전기 2칸 — 윗면 배기관·고리, 앞면 왼쪽 계기판(꺼진 계기·빨간 점등), 오른쪽 통풍 루버. 글자·상표 없음. 켜고 끄는 장치(조명 이벤트 자리).')
def _generator(c):
    rc(c, 1, 8, 30, 6, kc('kii', 1)); hl(c, 1, 8, 30, kc('kii', 2)); vl(c, 1, 8, 6, kc('kii', 2))   # 윗면
    hl(c, 1, 13, 30, kc('kii', 2))
    rc(c, 1, 14, 30, 2, kc('kii', -1))                                    # 처마 그늘
    rc(c, 1, 16, 30, 13, kc('kii', 0)); vl(c, 1, 14, 15, kc('kii', 1)); vl(c, 30, 14, 15, kc('kii', -1))
    rc(c, 3, 17, 10, 8, kc('yoru', -1)); outline(c, 2, 16, 12, 10, kc('kii', -2))   # 계기판
    disc(c, 5.5, 20, 1.6, 1.6, kc('shiro', 0)); px(c, 5, 20, kc('yoru', -1)); disc(c, 9.5, 20, 1.6, 1.6, kc('shiro', 0)); px(c, 10, 19, kc('yoru', -1))
    px(c, 4, 23, kc('aka', 2)); px(c, 6, 23, kc('midori', -1)); hl(c, 8, 23, 4, kc('tekko', 1))
    for y in range(17, 27, 2): hl(c, 16, y, 13, kc('kii', -2)); hl(c, 16, y + 1, 13, kc('kii', 1))   # 루버
    rc(c, 24, 3, 3, 6, kc('tekko', -1)); vl(c, 24, 3, 6, kc('tekko', 1)); hl(c, 23, 2, 5, OL)   # 배기관
    rc(c, 12, 6, 6, 2, kc('tekko', 1)); hl(c, 12, 5, 6, OL)               # 고리
    rc(c, 2, 29, 28, 2, kc('tekko', -2)); hl(c, 1, 31, 30, OL)
    outline(c, 0, 7, 32, 23)


@R.obj('cs-site-office', '현장 사무실 컨테이너', w=3, h=2, up=16, kind='wall', use=('open', 'search'), tags=TC + ('현장 사무실', '詰所'),
       place='공사장 북쪽 벽 바로 아래(벽 붙이). 앞(남쪽) 한 줄을 비워 문 앞에 선다. 곁 막다른 곳에 안전모 선반·공구함.', pair=('cs-item-helmet-shelf', 'cs-item-toolbox'),
       desc='벽에 붙여 놓은 흰 프레하브 현장 사무실 3×2 — 골판 지붕 윗면, 왼쪽 회색 철문(작은 창), 오른쪽 블라인드가 반쯤 내린 알루미늄 창, 문 앞 철 디딤판. 문은 조사(이벤트) 자리.')
def _office(c):
    rc(c, 0, 0, 48, 10, kc('shiro', 0))                                   # 골판 지붕 윗면
    for x in range(2, 48, 4): vl(c, x, 0, 10, kc('shiro', -1)); vl(c, x + 1, 0, 10, kc('shiro', 1))
    for x in range(48):
        if rnd(x, 3, 181, 120): px(c, x, 2 + x % 7, kc('conc', 0))       # 먼지
    hl(c, 0, 0, 48, kc('shiro', 1)); hl(c, 0, 10, 48, kc('shiro', 2)); hl(c, 0, 11, 48, kc('tekko', 0))   # 처마 날
    rc(c, 0, 12, 48, 2, kc('shiro', -2))                                  # 처마 그늘
    rc(c, 0, 14, 48, 31, kc('shiro', 0))                                  # 앞 벽
    for x in range(0, 48, 8): vl(c, x, 14, 31, kc('shiro', -1))
    vl(c, 1, 12, 33, kc('shiro', 1)); vl(c, 46, 12, 33, kc('shiro', -2))
    for x in range(48):
        for y in range(40, 45):
            if rnd(x, y, 182, 250): px(c, x, y, kc('shiro', -2))           # 아래 때
    rc(c, 4, 17, 10, 28, kc('tekko', 1)); outline(c, 3, 16, 12, 29, kc('tekko', -2))   # 철문
    vl(c, 4, 17, 28, kc('tekko', 2)); vl(c, 13, 17, 28, kc('tekko', -1))
    rc(c, 6, 19, 6, 5, kc('garasu', -2)); px(c, 6, 19, kc('garasu', 0)); px(c, 7, 20, kc('garasu', 0))
    rc(c, 11, 30, 2, 2, kc('tekko', 3))
    rc(c, 21, 18, 22, 13, kc('garasu', -2)); outline(c, 20, 17, 24, 15, kc('tekko', 2))   # 창
    for y in range(18, 25, 2): hl(c, 21, y, 22, kc('shiro', -1))          # 블라인드(반쯤)
    vl(c, 31, 18, 13, kc('tekko', 1)); vl(c, 32, 18, 13, kc('tekko', -1))
    for i in range(4): px(c, 23 + i, 30 - i, kc('garasu', 0)); px(c, 35 + i, 30 - i, kc('garasu', 0))
    hl(c, 20, 32, 24, kc('tekko', 3))                                     # 창턱
    rc(c, 2, 45, 14, 2, kc('tekko', 1)); hl(c, 2, 45, 14, kc('tekko', 3)); hl(c, 2, 47, 14, OL)   # 디딤판
    hl(c, 16, 45, 32, kc('tekko', -2)); hl(c, 16, 46, 32, kc('yoru', -1)); hl(c, 0, 45, 2, kc('tekko', -2))
    outline(c, 0, 0, 48, 46)


@R.obj('cs-tarp', '방수포 덮은 자재', w=2, h=1, up=8, kind='floor', use=('search', 'block'), tags=TC + ('자재', '블루시트'),
       place='자재 야적·창고 구석. 무엇이 들었는지 조사하는 자리.',
       desc='파란 방수포(블루시트)를 덮고 끈으로 묶은 자재 더미 2칸 — 울퉁불퉁한 윗면 주름, 앞면 아래 단추 구멍, 모서리를 누른 모래 포대.')
def _tarp(c):
    top = [9, 7, 6, 6, 7, 8, 7, 6, 5, 5, 6, 7, 9]
    for x in range(1, 31):
        t = top[min(12, x * 12 // 30)]
        for y in range(t, 29):
            if y < 17: col = kc('sora', 0) if y > t + 1 else kc('sora', 1)
            else: col = kc('sora', -1)
            px(c, x, y, col)
        px(c, x, t - 1, OL)
    for (x0, x1) in ((8, 12), (20, 23)):                                  # 주름
        line(c, x0, 9, x1, 16, kc('sora', -1)); line(c, x0 + 1, 9, x1 + 1, 16, kc('sora', 1))
    hl(c, 1, 17, 30, kc('sora', 1))                                       # 앞 가장자리
    line(c, 3, 18, 6, 27, kc('sora', -2)); line(c, 26, 18, 24, 27, kc('sora', -2))
    for x in range(4, 30, 6): px(c, x, 26, kc('shiro', 1)); px(c, x + 1, 26, kc('tekko', -1))   # 단추 구멍
    line(c, 2, 12, 30, 8, kc('kinari', 0))                                # 묶은 끈
    vl(c, 15, 6, 23, kc('kinari', 0))
    for x0 in (0, 26):                                                    # 모래 포대
        rc(c, x0 + 1, 26, 5, 4, kc('kinari', 0)); hl(c, x0 + 1, 26, 5, kc('kinari', 1)); outline(c, x0, 25, 7, 6)
    vl(c, 0, 8, 22, OL); vl(c, 31, 9, 21, OL); hl(c, 1, 29, 30, OL)


@R.obj('cs-stairs-up-bare', '콘크리트 계단(위, 난간 없음)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',),
       tags=TC + ('계단', '階段'),
       place='공사장 북쪽 벽 바로 아래(벽 가구 자리). 발칸 두 칸에 위층으로 가는 links — 위층 cs-stairwell-down 아랫줄 옆에 내린다.', pair=('cs-stairwell-down',),
       desc='벽을 타고 올라가는 2칸 폭 맨 콘크리트 계단 — 난간이 아직 없고 디딤판 모서리가 깨졌으며 계단에 부스러기. 위로 올라가면 위층으로 이동.')
def _stairs_bare(c):
    c.R(0, 0, 32, 48, OL)
    c.R(1, 0, 30, 5, K('yoru', -3)); c.R(1, 4, 30, 2, K('yoru', -1))
    for i in range(8):
        yb = 46 - 5 * i; dim = 1 if i >= 6 else 0
        c.R(2, yb - 4, 28, 2, K('conc', 1 - dim)); c.HL(2, yb - 4, 28, K('conc', 2 - dim))
        c.R(2, yb - 2, 28, 1, K('yoru', -1)); c.R(2, yb - 1, 28, 2, K('conc', -1 - dim))
        c.HL(2, yb + 1, 28, K('conc', -3))
        for x in range(2, 30):
            if rnd(x, i, 191, 60): c.P(x, yb - 4, K('conc', -1))          # 깨진 모서리
            if rnd(x, i, 192, 40): c.P(x, yb - 3, K('conc', 3))           # 부스러기
    c.R(1, 6, 1, 41, K('conc', -2)); c.R(30, 6, 1, 41, K('conc', -3))     # 거푸집 단면(옆)
    for y in range(8, 46, 5): c.P(1, y, K('conc', 0)); c.P(30, y + 2, K('conc', -1))
    c.HL(0, 47, 32, OL)


@R.obj('cs-stairwell-down', '콘크리트 계단통(아래로, 난간 없음)', w=2, h=2, up=8, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)),
       tags=TC + ('계단', '階段'),
       place='위층 바닥 한쪽. 아래층 cs-stairs-up-bare 와 x 를 맞춘다. 아랫줄 두 칸에 아래층으로 가는 links.', pair=('cs-stairs-up-bare',),
       desc='슬래브에 뚫린 계단 구멍 — 난간 대신 북쪽 모서리에 라바콘 둘과 노랑·검정 막대 하나, 맨 콘크리트 계단이 어둠으로 내려간다. 윗줄은 막히고 아랫줄 두 칸을 밟으면 아래층으로.')
def _well(c):
    c.R(1, 18, 30, 29, OL); c.R(3, 20, 26, 24, K('yoru', -3))
    for i in range(6):
        y = 22 + i * 4
        c.R(4, y, 24, 2, K('conc', 1 - i)); c.HL(4, y, 24, K('conc', 2 - i)); c.HL(4, y + 1, 24, K('yoru', -1) if i < 3 else K('yoru', -2))
        c.R(4, y + 2, 24, 2, K('yoru', -3))
        for x in range(4, 28):
            if rnd(x, i, 201, 70): c.P(x, y, K('conc', -1 - i // 2))
    c.R(1, 44, 30, 3, K('conc', 0)); c.HL(1, 44, 30, K('conc', 2)); c.HL(1, 46, 30, K('conc', -2)); c.HL(1, 47, 30, K('conc', -3))
    c.R(1, 17, 30, 2, K('conc', 0)); c.HL(1, 17, 30, K('conc', 1))        # 북쪽 턱
    for x in (1, 30): c.R(x, 18, 1, 26, K('conc', -2 if x == 30 else 0))
    for x0 in (2, 25):                                                    # 라바콘 둘
        for y in range(6, 17):
            hw = 1 + (y - 6) * 2 // 10
            for x in range(x0 + 2 - hw, x0 + 2 + hw): c.P(x, y, K('shiro', 1) if y in (10, 11) else K('aka', 0 if x > x0 + 1 else 1))
            c.P(x0 + 1 - hw, y, OL); c.P(x0 + 2 + hw, y, OL)
        c.R(x0, 16, 5, 2, K('yoru', -1)); c.HL(x0, 15, 5, OL)
    hazard(c, 6, 9, 20, 2, period=4); c.HL(6, 8, 20, OL); c.HL(6, 11, 20, OL)


@R.obj('cs-column-bare', '맨 콘크리트 기둥', w=1, h=1, up=32, kind='floor', use=('block',), tags=TC + ('기둥',),
       place='벽 없는 위층·공사장 바닥에 3~4칸 간격. 기둥 사이를 비계·바리케이드로 막아 길을 짠다.',
       desc='천장 보까지 올라간 0.8m 각 맨 콘크리트 기둥 — 거푸집 이음줄과 P콘 구멍, 아래 물먹은 얼룩. 지나갈 수 없다.')
def _column_bare(c):
    rc(c, 0, 0, 16, 3, kc('conc', -3)); hl(c, 0, 3, 16, OL)               # 천장 보 밑
    rc(c, 2, 4, 12, 43, kc('conc', 0)); vl(c, 2, 4, 43, kc('conc', 1)); vl(c, 3, 4, 43, kc('conc', 1))
    vl(c, 12, 4, 43, kc('conc', -2)); vl(c, 13, 4, 43, kc('conc', -2))
    vl(c, 1, 4, 43, OL); vl(c, 14, 4, 43, OL)
    hl(c, 2, 4, 12, kc('conc', -2)); hl(c, 2, 25, 12, kc('conc', -1))     # 위 그늘·거푸집 이음
    for (x, y) in ((5, 12), (10, 12), (5, 33), (10, 33)): px(c, x, y, kc('conc', -3)); px(c, x + 1, y + 1, kc('conc', 1))
    for y in range(38, 47):
        for x in range(2, 14):
            if rnd(x, y, 211, 300 + (y - 38) * 60): px(c, x, y, kc('conc', -2))
    hl(c, 1, 47, 14, OL)


@R.obj('cs-site-gate', '가설 출입문 레일', kind='flat', use=('walk',), tags=TC + ('출입구',),
       place='공사장 맨 아래 출입구 틈 칸(거리와 잇는 칸). 출입구가 2칸이면 두 칸 모두.',
       desc='가설 울타리 출입문이 열려 드러난 바닥의 철 레일과 노랑·검정 칠 — 밟고 지나가는 문턱.')
def _gate(c):
    hl(c, 0, 4, 16, kc('tekko', -2)); hl(c, 0, 5, 16, kc('tekko', 2)); hl(c, 0, 6, 16, kc('tekko', 0)); hl(c, 0, 7, 16, OL)
    for x in range(1, 16, 5): px(c, x, 6, kc('tekko', 3))
    hazard(c, 0, 11, 16, 2, period=8)


@R.obj('cs-fallen-board', '떨어진 거푸집 합판', w=2, h=1, up=4, kind='floor', use=('block',), tags=TC + ('잔해',),
       place='공사장 통로를 반쯤 막는 잔해. 길을 돌아가게 할 때.',
       desc='무너져 내린 거푸집 합판 한 장과 부러진 각재 둘 — 합판 윗면 결과 깨진 모서리, 각재 끝 단면. 지나갈 수 없다.')
def _fallen(c):
    for y in range(12, 25):                                               # 비스듬히 누운 합판
        x0 = 2 + (y - 12) // 3; x1 = 29 - (24 - y) // 4
        for x in range(x0, x1):
            px(c, x, y, kc('yuka', 0) if (x + y * 3) % 11 else kc('yuka', -1))
        px(c, x0 - 1, y, OL); px(c, x1, y, OL)
    hl(c, 2, 11, 24, OL); hl(c, 3, 12, 22, kc('yuka', 1))
    rc(c, 6, 25, 23, 2, kc('yuka', -2)); hl(c, 6, 27, 23, OL)             # 합판 앞날
    for (x, y) in ((24, 12), (25, 13), (26, 12), (27, 14)): px(c, x, y, kc('sumi', -1))   # 깨진 모서리
    line(c, 1, 22, 14, 18, kc('ita', 1)); line(c, 1, 23, 14, 19, kc('ita', -1)); line(c, 1, 24, 14, 20, OL)   # 각재
    rc(c, 0, 21, 2, 3, kc('ita', 0)); px(c, 0, 21, kc('ita', 2))
    line(c, 18, 28, 30, 25, kc('ita', 0)); line(c, 18, 29, 30, 26, kc('ita', -2)); px(c, 31, 25, kc('ita', 1))
    for x in range(4, 30):
        if rnd(x, 29, 221, 250): px(c, x, 29 + x % 2, kc('conc', 1))


@R.obj('cs-rubble', '콘크리트 잔해 더미', w=1, h=1, up=6, kind='floor', use=('block',), tags=TC + TP[:1] + ('잔해',),
       place='통로 막기·무너진 곳. 1칸씩, 두세 개 붙여 막다른 길을 만든다.',
       desc='무너진 천장 슬래브가 깨진 덩이로 쌓인 잔해 더미 — 비스듬히 선 큰 판 조각, 작은 덩이들, 휘어 나온 녹슨 철근, 둘레의 부스러기 가루. 지나갈 수 없다.')
def _rubble(c):
    disc(c, 8, 27.5, 8.4, 4.6, OL)                                        # 가루 더미(밑)
    disc(c, 8, 27.5, 7.6, 3.9, kc('conc', -2))
    for y in range(23, 32):
        for x in range(16):
            if c.a[y, x, 3] and rnd(x, y, 232, 300): px(c, x, y, kc('conc', -1) if (x + y) % 2 else kc('conc', -3))
    chunk(c, 1, 19, 6, 3, 4, 0)                                            # 큰 덩이 둘
    chunk(c, 9, 18, 6, 3, 4, -1)
    poly(c, [(4, 18), (9, 13), (14, 14), (10, 19)], kc('conc', 1))         # 위에 걸친 판 조각(윗면)
    poly(c, [(10, 19), (14, 14), (15, 15), (11, 21)], kc('conc', -2))      # 판 두께
    line(c, 9, 13, 14, 14, kc('conc', 3)); line(c, 4, 18, 9, 13, OL); line(c, 14, 14, 15, 15, OL); line(c, 15, 15, 11, 21, OL)
    line(c, 4, 18, 10, 19, kc('conc', -2)); px(c, 7, 16, kc('conc', 2)); line(c, 8, 15, 11, 16, kc('conc', -1))
    chunk(c, 5, 25, 4, 2, 2, 1); chunk(c, 11, 26, 4, 1, 2, 0); chunk(c, 1, 27, 3, 1, 2, -1)
    line(c, 3, 19, 1, 12, kc('kawara', 0)); line(c, 4, 19, 2, 12, kc('tekko', -1)); px(c, 1, 11, OL)   # 휘어 나온 철근
    line(c, 13, 18, 15, 11, kc('kawara', 1)); px(c, 15, 10, OL); px(c, 14, 12, kc('kawara', -1))
    for x in range(16):
        if rnd(x, 31, 231, 300): px(c, x, 31, kc('conc', 1 if x % 2 else -1))


@R.obj('cs-debris', '콘크리트 부스러기·종이', kind='flat', use=('walk',), tags=TC + TP[:1] + ('잔해',),
       place='통로·방 바닥 아무 데나(밟고 지나간다). 무너진 곳 둘레에 몇 칸.',
       desc='바닥에 흩어진 콘크리트 부스러기, 구겨진 도면 종이 한 장, 깨진 유리 조각 — 밟고 지나간다.')
def _debris(c):
    for (x, y) in ((2, 3), (3, 3), (11, 2), (13, 9), (5, 12), (6, 12), (9, 14), (1, 9)):
        px(c, x, y, kc('conc', 1)); px(c, x + 1, y + 1, kc('conc', -3))
    rc(c, 6, 5, 5, 4, kc('shiro', 0)); hl(c, 6, 5, 5, kc('shiro', 1)); px(c, 10, 8, kc('shiro', -1)); px(c, 7, 7, kc('sora', -1)); px(c, 8, 6, kc('sora', -1))
    hl(c, 6, 9, 5, kc('conc', -3))
    for (x, y) in ((12, 12), (13, 13), (14, 12)): px(c, x, y, kc('garasu', 2))
    px(c, 13, 12, kc('shiro', 2)); px(c, 12, 13, kc('garasu', 0))


@R.obj('cs-puddle', '물웅덩이', kind='flat', use=('walk',), tags=TC + TP[:1] + ('물',),
       place='낮은 바닥·누수 아래. 1칸씩 또는 2칸 붙여.',
       desc='천장에서 샌 물이 고인 어두운 웅덩이 — 가장자리 젖은 테, 수면에 짧은 반사 줄. 밟고 지나간다.')
def _puddle(c):
    disc(c, 8, 8.5, 7.6, 6.0, kc('garasu', -2))                            # 젖은 테
    disc(c, 8.3, 8.8, 6.6, 5.0, kc('garasu', -1))                          # 물
    for y in range(16):
        for x in range(16):
            dx, dy = (x + .5 - 8) / 7.6, (y + .5 - 8.5) / 6.0
            if 1.0 < dx * dx + dy * dy <= 1.35 and rnd(x, y, 241, 550): px(c, x, y, kc('garasu', -2))
    hl(c, 4, 6, 4, kc('garasu', 1)); hl(c, 6, 7, 2, kc('garasu', 0)); hl(c, 9, 10, 3, kc('garasu', 0)); px(c, 3, 7, kc('garasu', 2))
    hl(c, 5, 13, 6, kc('garasu', -3))                                      # 아래쪽 어두운 물가


# ══ 지하 주차장 ═══════════════════════════════════════════════════════════════
@R.obj('cs-pillar', '주차장 기둥', w=1, h=1, up=32, kind='floor', use=('block',), tags=TP + ('기둥',),
       place='주차 칸 줄 사이·차로 가장자리에 3칸 간격(차 한 대 칸 + 선). 기둥 사이로 길을 짠다.',
       desc='천장 보까지 올라간 흰 칠 콘크리트 기둥 — 위쪽에 파란 색 칸(기둥 번호 자리, 숫자 없음), 아래 두 모서리에 노랑·검정 보호대, 밑동 때. 지나갈 수 없다.')
def _pillar(c):
    rc(c, 0, 0, 16, 3, kc('conc', -3)); hl(c, 0, 3, 16, OL)
    rc(c, 2, 4, 12, 43, kc('shiro', -1)); vl(c, 2, 4, 43, kc('shiro', 0)); vl(c, 3, 4, 43, kc('shiro', 0))
    vl(c, 12, 4, 43, kc('shiro', -2)); vl(c, 13, 4, 43, kc('shiro', -2))
    vl(c, 1, 4, 43, OL); vl(c, 14, 4, 43, OL)
    hl(c, 2, 4, 12, kc('shiro', -2))
    rc(c, 4, 10, 8, 7, kc('sora', 0)); outline(c, 4, 10, 8, 7, kc('sora', -2)); rc(c, 6, 12, 2, 2, kc('sora', 1)); rc(c, 9, 13, 1, 2, kc('sora', 1))
    hazard(c, 2, 30, 3, 15, period=4); hazard(c, 11, 30, 3, 15, period=4)   # 모서리 보호대
    vl(c, 5, 30, 15, kc('sumi', 0)); vl(c, 10, 30, 15, kc('sumi', 0))
    for x in range(5, 11):
        if rnd(x, 44, 251, 500): px(c, x, 44, kc('shiro', -2))
    rc(c, 2, 45, 12, 2, kc('conc', -2)); hl(c, 1, 47, 14, OL)


def _pline(c, v=True, h=False, half=False):
    for i in range(16):
        if v and not (half and i > 8):
            for x in (7, 8):
                if not rnd(x, i, 261, 90): px(c, x, i, kc('shiro', 0) if x == 7 else kc('shiro', -1))
        if h and not (half and i < 7):
            for y in (7, 8):
                if not rnd(i, y, 262, 90): px(c, i, y, kc('shiro', 0) if y == 7 else kc('shiro', -1))


@R.obj('cs-parking-line', '주차 칸 선(세로)', kind='flat', use=('walk',), tags=TP + ('주차 칸',),
       place='주차 칸 사이 칸(차 2칸 + 선 1칸 = 3칸 간격)에 세로로 이어 깐다. 칸 앞 끝(차로 쪽)은 cs-parking-line-corner.', pair=('cs-parking-line-h', 'cs-parking-line-corner'),
       desc='에폭시 바닥에 칠한 흰 주차 칸 경계선(남북) — 군데군데 닳았다. 밟고 지나간다.')
def _pl_v(c): _pline(c, True, False)


@R.obj('cs-parking-line-h', '주차 칸 선(가로)', kind='flat', use=('walk',), tags=TP + ('주차 칸',),
       place='주차 칸 앞 끝(차로와의 경계)·차로 가운데 선에 가로로 이어 깐다.', pair=('cs-parking-line', 'cs-parking-line-corner'),
       desc='에폭시 바닥에 칠한 흰 가로선(동서) — 주차 칸 앞 끝선. 밟고 지나간다.')
def _pl_h(c): _pline(c, False, True)


@R.obj('cs-parking-line-corner', '주차 칸 선(만나는 곳)', kind='flat', use=('walk',), tags=TP + ('주차 칸',),
       place='세로 경계선이 가로 앞 끝선과 만나는 칸(┴). 경계선 맨 아래 칸에.', pair=('cs-parking-line', 'cs-parking-line-h'),
       desc='흰 세로 경계선이 가로 앞 끝선과 만나는 ┴ 모양 칸. 밟고 지나간다.')
def _pl_c(c):
    _pline(c, True, False, half=True); _pline(c, False, True)


def _car(c, body, roof_t, kind):
    """주차된 승용차(앞이 북쪽 벽, 뒤가 남쪽 — 위에서 본 3/4). body = 차체 램프, kind = 'sedan'|'wagon'."""
    B0, B1, B2, Bm, Bd = kc(body, 0), kc(body, 1), kc(body, 2), kc(body, -1), kc(body, -2)
    G, Gd, Gh = kc('garasu', -2), kc('garasu', -3), kc('garasu', 0)
    if kind == 'sedan':
        hood, wind, roof, rwin, trunk, rear = (2, 14), (14, 22), (22, 36), (36, 42), (42, 46), (46, 58)
    else:
        hood, wind, roof, rwin, trunk, rear = (5, 11), (11, 19), (19, 41), (41, 41), (41, 41), (41, 58)
    # 차체 바깥(어깨선) — 위에서 본 옆면 띠
    rc(c, 2, hood[0], 28, rear[0] - hood[0], Bm)
    vl(c, 2, hood[0] + 2, rear[0] - hood[0] - 2, B0); vl(c, 29, hood[0] + 2, rear[0] - hood[0] - 2, Bd)
    rc(c, 4, hood[0], 24, hood[1] - hood[0], B0); hl(c, 5, hood[0], 22, B1)   # 보닛
    vl(c, 15, hood[0] + 2, hood[1] - hood[0] - 3, Bm); vl(c, 16, hood[0] + 2, hood[1] - hood[0] - 3, B1)
    px(c, 4, hood[0], OL); px(c, 27, hood[0], OL)
    for y in range(wind[0], wind[1]):                                     # 앞 유리
        inset = 5 + (wind[1] - 1 - y) // 4
        hl(c, inset, y, 32 - 2 * inset, G)
    line(c, 9, wind[1] - 2, 13, wind[0] + 1, Gh); line(c, 11, wind[1] - 2, 15, wind[0] + 1, Gh)
    hl(c, 8, wind[1] - 1, 16, Gd)
    rc(c, 6, roof[0], 20, roof[1] - roof[0], kc(body, roof_t)); hl(c, 6, roof[0], 20, B2); vl(c, 6, roof[0], roof[1] - roof[0], B2)   # 지붕
    vl(c, 25, roof[0], roof[1] - roof[0], B0)
    for x in range(7, 25):
        if rnd(x, roof[0], 271, 160): px(c, x, roof[0] + 1 + x % (roof[1] - roof[0] - 2), kc('conc', 1))   # 먼지
    vl(c, 3, wind[0] + 1, roof[1] - wind[0] + 2, G); vl(c, 28, wind[0] + 1, roof[1] - wind[0] + 2, Gd)   # 옆 유리(위에서)
    if rwin[1] > rwin[0]:
        for y in range(rwin[0], rwin[1]):
            inset = 6 + (y - rwin[0]) // 3
            hl(c, inset, y, 32 - 2 * inset, G)
        line(c, 10, rwin[1] - 1, 13, rwin[0], Gh)
    if trunk[1] > trunk[0]:
        rc(c, 5, trunk[0], 22, trunk[1] - trunk[0], B0); hl(c, 5, trunk[1] - 1, 22, B1)
    # 뒷면(남쪽 — 카메라 쪽)
    rc(c, 2, rear[0], 28, rear[1] - rear[0], Bm); hl(c, 2, rear[0], 28, B1)
    if kind == 'wagon':                                                   # 뒷유리(세운 문)
        rc(c, 6, rear[0] + 2, 20, 7, G); line(c, 9, rear[0] + 8, 13, rear[0] + 2, Gh); outline(c, 5, rear[0] + 1, 22, 9, Bd)
        lt = rear[0] + 10
    else:
        lt = rear[0] + 2
    for x0 in (3, 23):                                                    # 뒷등
        rc(c, x0, lt, 6, 3, kc('aka', 0)); hl(c, x0, lt, 6, kc('aka', 1)); px(c, x0 + 5, lt + 2, kc('aka', -2))
    rc(c, 12, lt + 1, 8, 4, kc('kinari', 1)); outline(c, 11, lt, 10, 6, Bd); hl(c, 12, lt + 1, 8, kc('kinari', 2))   # 빈 번호판
    rc(c, 2, rear[1] - 3, 28, 3, kc('tekko', -2)); hl(c, 2, rear[1] - 3, 28, kc('tekko', 0))   # 범퍼
    for x0 in (3, 23):                                                    # 바퀴
        rc(c, x0, rear[1], 6, 4, kc('yoru', -2)); hl(c, x0, rear[1], 6, kc('yoru', 0))
    rc(c, 9, rear[1], 14, 3, kc('yoru', -3))                              # 차 밑 그늘
    for (x, y) in ((0, wind[0] + 1), (30, wind[0] + 1)):                  # 사이드 미러
        rc(c, x, y, 2, 3, Bm); px(c, x, y, B1)
    # 윤곽
    outline(c, 1, hood[0] - 1, 30, rear[1] - hood[0] + 1)
    px(c, 1, hood[0] - 1, None); hl(c, 3, hood[0] - 1, 26, OL)
    hl(c, 2, rear[1] + 3, 28, OL)


@R.obj('cs-car-a', '주차된 승용차(흰 세단)', w=2, h=3, up=8, kind='floor', use=('block', 'search'), tags=TP + ('자동차', '車'),
       place='주차 칸(경계선 사이 2칸 폭)에 앞을 북쪽 벽으로 두고. 주차장마다 몇 대만, 빈 칸을 섞는다.', pair=('cs-car-b', 'cs-wheel-stop', 'cs-item-car-trunk'),
       desc='먼지 앉은 흰 세단 — 위에서 보닛·앞 유리·지붕·뒷유리·트렁크가 보이고 남쪽으로 뒷면(빨간 뒷등 둘, 글자 없는 빈 번호판, 검은 범퍼·바퀴). 2×3, 지나갈 수 없다.')
def _car_a(c): _car(c, 'shiro', 1, 'sedan')


@R.obj('cs-car-b', '주차된 승용차(빨간 경 왜건)', w=2, h=3, up=8, kind='floor', use=('block', 'search'), tags=TP + ('자동차', '車'),
       place='주차 칸(경계선 사이 2칸 폭)에 앞을 북쪽 벽으로 두고. 흰 세단과 섞어 몇 대만.', pair=('cs-car-a', 'cs-wheel-stop', 'cs-item-car-trunk'),
       desc='짧은 보닛과 긴 지붕의 빨간 경 왜건(박스형) — 위에서 지붕이 길게, 남쪽 뒷면에 세운 뒷유리·뒷등·빈 번호판. 2×3, 지나갈 수 없다.')
def _car_b(c): _car(c, 'aka', -1, 'wagon')


@R.obj('cs-wheel-stop', '바퀴 멈춤턱', kind='flat', use=('walk',), tags=TP + ('주차 칸',),
       place='빈 주차 칸 안쪽(북쪽 벽 쪽) 끝, 칸 하나에 두 개(바퀴마다).',
       desc='낮은 콘크리트 바퀴 멈춤턱 — 윗면에 노란 칠이 벗겨졌다. 밟고 넘는다.')
def _wstop(c):
    rc(c, 2, 7, 12, 2, kc('conc', 1)); hl(c, 2, 7, 12, kc('kii', 0)); hl(c, 2, 8, 12, kc('conc', 2))
    for x in (4, 9, 12): px(c, x, 7, kc('conc', 1))
    rc(c, 2, 9, 12, 2, kc('conc', -1)); hl(c, 2, 11, 12, kc('conc', -3))
    vl(c, 1, 7, 4, OL); vl(c, 14, 7, 4, OL); hl(c, 2, 6, 12, OL)


def _arrow(c, east=False):
    pts = set()
    for y in range(1, 8):
        hw = y - 1
        for x in range(8 - hw, 8 + hw): pts.add((x, y))
    for y in range(8, 15):
        for x in (6, 7, 8, 9): pts.add((x, y))
    for (x, y) in pts:
        X, Y = (15 - y, x) if east else (x, y)
        if rnd(X, Y, 281, 110): continue
        px(c, X, Y, kc('shiro', 0) if (X + Y) % 5 else kc('shiro', -1))


@R.obj('cs-ramp-arrow', '경사로 화살표(북)', kind='flat', use=('walk',), tags=TP + ('차로',),
       place='차로 바닥, 진행 방향(북)을 가리킨다. 경사로로 가는 길에 두세 칸 간격.', pair=('cs-ramp-arrow-e',),
       desc='에폭시 차로 바닥에 칠한 북쪽을 가리키는 흰 화살표(글자 없음) — 닳았다. 밟고 지나간다.')
def _arrow_n(c): _arrow(c)


@R.obj('cs-ramp-arrow-e', '경사로 화살표(동)', kind='flat', use=('walk',), tags=TP + ('차로',),
       place='차로 바닥, 동쪽을 가리킨다. 경사로로 가는 길에.', pair=('cs-ramp-arrow',),
       desc='에폭시 차로 바닥에 칠한 동쪽을 가리키는 흰 화살표(글자 없음). 밟고 지나간다.')
def _arrow_e(c): _arrow(c, east=True)


@R.obj('cs-fire-hose', '소화전 상자', w=1, h=1, up=16, kind='wall', use=('search',), tags=TP + ('소화전',),
       place='주차장·계단실 북쪽 벽 바로 아래(벽 붙이). 기둥 사이 벽에 한두 개.',
       desc='벽에 붙은 빨간 철 소화전 상자 — 위에 둥근 빨간 표시등이 켜져 있고(어둠 속 빨간 점), 앞에 들어간 문판과 손잡이, 흰 띠(글자 없음). 조사 자리.')
def _hose(c):
    disc(c, 8, 4, 3, 3, OL); disc(c, 8, 4, 2.2, 2.2, kc('aka', 1)); px(c, 7, 3, kc('aka', 2)); px(c, 7, 2, kc('pinku', 2))
    rc(c, 7, 7, 2, 2, kc('aka', -2))
    rc(c, 1, 9, 14, 3, kc('aka', 1)); hl(c, 1, 9, 14, kc('aka', 2)); hl(c, 1, 11, 14, kc('aka', 2))   # 윗면
    rc(c, 1, 12, 14, 18, kc('aka', 0)); vl(c, 1, 12, 18, kc('aka', 1)); vl(c, 14, 12, 18, kc('aka', -1))
    hl(c, 1, 12, 14, kc('aka', -2))                                       # 처마 그늘
    rc(c, 3, 14, 10, 14, kc('aka', -1)); rc(c, 4, 15, 8, 12, kc('aka', 0)); hl(c, 4, 15, 8, kc('aka', -2))
    hl(c, 4, 19, 8, kc('shiro', 1)); hl(c, 4, 20, 8, kc('shiro', -1))
    rc(c, 10, 22, 1, 3, kc('tekko', 3))
    hl(c, 1, 30, 14, kc('aka', -2))
    outline(c, 0, 8, 16, 24)


@R.obj('cs-pay-machine', '주차 정산기', w=1, h=1, up=16, kind='wall', use=('search',), tags=TP + ('정산기',),
       place='주차장 출입구(계단) 가까운 북쪽 벽 바로 아래. 앞 두 줄을 비운다.',
       desc='회색 주차 정산기 — 윗면, 꺼진 어두운 화면, 색 점 버튼, 표·카드 넣는 틈, 아래 동전 받이. 글자·숫자 없음. 조사 자리.')
def _pay(c):
    rc(c, 1, 4, 14, 4, kc('tekko', 2)); hl(c, 1, 4, 14, kc('tekko', 3)); hl(c, 1, 7, 14, kc('tekko', 3))   # 윗면
    rc(c, 1, 8, 14, 23, kc('tekko', 0)); vl(c, 1, 8, 23, kc('tekko', 1)); vl(c, 14, 8, 23, kc('tekko', -2))
    hl(c, 1, 8, 14, kc('tekko', -2))
    rc(c, 3, 10, 10, 6, kc('garasu', -3)); outline(c, 2, 9, 12, 8, kc('tekko', -2)); px(c, 4, 11, kc('garasu', -1)); hl(c, 4, 14, 3, kc('sora', -2))   # 화면
    for i, col in enumerate(('kii', 'midori', 'aka', 'sora')): px(c, 3 + i * 3, 18, kc(col, 1)); px(c, 3 + i * 3, 19, kc(col, -1))
    hl(c, 4, 21, 6, kc('yoru', -2)); hl(c, 11, 21, 2, kc('yoru', -2))     # 표·카드 틈
    rc(c, 5, 25, 6, 3, kc('yoru', -2)); hl(c, 5, 25, 6, kc('tekko', -2)); hl(c, 5, 28, 6, kc('tekko', 2))   # 동전 받이
    hl(c, 1, 30, 14, kc('tekko', -3)); outline(c, 0, 3, 16, 29)


@R.obj('cs-shutter', '셔터(반쯤 열림)', kind='door', use=('travel', 'open', 'key'), tags=TP + TC[:1] + ('셔터', '문'),
       place='기계실·자재 창고 같은 방의 가로 칸막이 1칸 틈 칸 — 잠긴 문 자리(잠금·열쇠는 이벤트로 단다).',
       desc='철 셔터가 허리 위로 반쯤 말려 올라간 문 — 양옆 가이드 레일, 위 셔터 날개 줄과 아랫단 막대, 바닥 문턱 레일. 지나갈 수 있는 틈이며 잠금은 이벤트(열쇠)로 단다.')
def _shutter(c):
    for x0 in (0, 13):
        rc(c, x0, 0, 3, 32, kc('tekko', 0)); vl(c, x0, 0, 32, kc('tekko', 2) if x0 == 0 else kc('tekko', 1)); vl(c, x0 + 2, 0, 32, kc('tekko', -2))
    rc(c, 3, 0, 10, 12, kc('tekko', 1))
    for y in range(0, 12, 2): hl(c, 3, y, 10, kc('tekko', 2)); hl(c, 3, y + 1, 10, kc('tekko', -1))
    rc(c, 3, 12, 10, 2, kc('tekko', -1)); hl(c, 3, 12, 10, kc('tekko', 0)); hl(c, 3, 14, 10, OL); rc(c, 7, 13, 2, 1, kc('kii', 0))
    rc(c, 1, 29, 14, 3, kc('tekko', 1)); hl(c, 1, 29, 14, kc('tekko', 3)); hl(c, 1, 31, 14, kc('tekko', -2))


@R.obj('cs-light-off', '꺼진 형광등', w=1, kind='hang', hrows=2, use=('light',), tags=TP + TC[:1] + ('조명',),
       place='북쪽 벽면 윗줄. 어두운 구역에 드문드문.',
       desc='벽 브래킷에 달린 꺼진 형광등 — 회색 관, 오른쪽 관 끝이 빠져 비스듬히 늘어졌다.')
def _light_off(c):
    rc(c, 2, 4, 3, 3, kc('tekko', 0)); rc(c, 11, 4, 3, 3, kc('tekko', 0))   # 브래킷
    rc(c, 1, 7, 14, 3, kc('shiro', -1)); hl(c, 1, 7, 14, kc('shiro', 0)); hl(c, 1, 9, 14, kc('tekko', -1)); outline(c, 0, 6, 16, 5)
    hl(c, 1, 11, 9, kc('shiro', -2)); hl(c, 1, 12, 9, kc('conc', -1))     # 꺼진 관
    line(c, 10, 11, 14, 16, kc('shiro', -2)); line(c, 10, 12, 13, 16, kc('conc', -2))
    px(c, 0, 11, OL); px(c, 0, 12, OL)


@R.obj('cs-exit-light', '비상구 등(초록)', w=1, kind='hang', hrows=2, use=('light',), tags=TP + TC[:1] + ('비상구',),
       place='계단·출구 쪽 벽면 윗줄, 출구 방향으로. 어두운 맵에서 길잡이.',
       desc='초록으로 켜진 비상구 유도등 — 초록 사각 판에 흰 화살표(오른쪽)만, 사람 그림·글자 없음.')
def _exit_light(c):
    rc(c, 1, 3, 14, 9, kc('midori', 1)); hl(c, 1, 3, 14, kc('midori', 2)); vl(c, 1, 3, 9, kc('midori', 2)); hl(c, 1, 11, 14, kc('midori', 0))
    outline(c, 0, 2, 16, 11, kc('tekko', 2)); hl(c, 0, 13, 16, OL)
    hl(c, 4, 7, 6, kc('shiro', 2)); hl(c, 4, 8, 6, kc('shiro', 1))       # 화살표
    for i in range(3): vl(c, 9 + i, 5 + i, 6 - 2 * i, kc('shiro', 2))


@R.obj('cs-ramp-up', '차로 경사로(위로)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',), tags=TP + ('경사로', 'スロープ'),
       place='아래층 주차장 북쪽 벽 바로 아래(벽 가구 자리). 발칸 두 칸에 위층으로 가는 links — 위층 cs-ramp-down 아랫줄 옆에 내린다.', pair=('cs-ramp-down',),
       desc='북쪽 벽 속으로 올라가는 2칸 폭 차로 경사로 — 미끄럼 막이 홈 줄이 위로 갈수록 어두워지고 양옆 노랑·검정 연석. 위로 올라가면 위층으로 이동.')
def _ramp_up(c):
    c.R(0, 0, 32, 48, OL)
    c.R(1, 0, 30, 6, kc('yoru', -3)); hl(c, 1, 5, 30, kc('yoru', -1))
    for y in range(6, 47):
        t = -3 if y < 14 else -2 if y < 24 else -1 if y < 36 else 0
        hl(c, 4, y, 24, kc('hodo', t) if y % 3 else kc('hodo', t - 1))
    hazard(c, 1, 6, 3, 41, period=4); hazard(c, 28, 6, 3, 41, period=4)
    for y in range(30, 44):                                               # 위 화살표(닳음)
        hw = max(0, 4 - (y - 30)) if y < 34 else 0
        for x in range(15 - hw, 17 + hw):
            if not rnd(x, y, 291, 150): px(c, x, y, kc('shiro', -1))
    hl(c, 0, 47, 32, OL)


@R.obj('cs-ramp-down', '차로 경사로(아래로)', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)),
       tags=TP + ('경사로', 'スロープ'),
       place='위층 주차장 차로 끝. 아래층 cs-ramp-up 과 짝. 아랫줄 두 칸에 아래층으로 가는 links.', pair=('cs-ramp-up',),
       desc='어둠 속으로 내려가는 2칸 폭 차로 경사로 입구 — 위에 쇠사슬로 매단 노랑·검정 높이 제한 막대, 양옆 연석, 홈 줄이 아래로 어두워진다. 윗줄은 막히고 아랫줄 두 칸을 밟으면 아래층으로.')
def _ramp_down(c):
    for x in (3, 28): vl(c, x, 0, 4, kc('tekko', 0))                      # 쇠사슬
    hazard(c, 1, 4, 30, 3, period=4); hl(c, 1, 3, 30, OL); hl(c, 1, 7, 30, OL)   # 높이 제한 막대
    rc(c, 0, 16, 32, 32, OL)
    for y in range(17, 47):
        t = -3 if y < 23 else -2 if y < 30 else -1 if y < 38 else 0
        hl(c, 3, y, 26, kc('hodo', t) if y % 3 else kc('hodo', t - 1))
    rc(c, 3, 17, 26, 4, kc('yoru', -3))
    for x0 in (0, 29):                                                    # 연석
        rc(c, x0, 9, 3, 38, kc('conc', -1)); hazard(c, x0, 16, 3, 31, period=4); hl(c, x0, 9, 3, kc('conc', 1)); vl(c, x0, 9, 38, OL if x0 == 0 else kc('conc', -2))
        rc(c, x0, 9, 3, 7, kc('conc', 0)); hl(c, x0, 9, 3, kc('conc', 2))
    hl(c, 0, 8, 32, OL) if False else None
    hl(c, 3, 46, 26, kc('hodo', 1)); hl(c, 0, 47, 32, OL)


# ══ 보물·단서(막다른 곳) ════════════════════════════════════════════════════
@R.obj('cs-item-toolbox', '공구함(단서)', w=1, h=1, up=0, kind='floor', use=('search', 'key'), tags=TC + ('보물', '단서'),
       place='막다른 곳(현장 사무실 곁·비계 미로 끝). 열쇠·공구를 두는 조사 자리.',
       desc='바닥에 놓인 빨간 철 공구함 — 위 손잡이, 뚜껑 윗면, 앞에 서랍 줄과 걸쇠. 열쇠·공구가 든 조사 자리.')
def _toolbox(c):
    rc(c, 6, 1, 4, 2, kc('tekko', 2)); vl(c, 5, 2, 3, kc('tekko', 1)); vl(c, 10, 2, 3, kc('tekko', 0)); hl(c, 5, 0, 6, OL)   # 손잡이
    rc(c, 2, 4, 12, 4, kc('aka', 1)); hl(c, 2, 4, 12, kc('aka', 2)); vl(c, 2, 4, 4, kc('aka', 2)); hl(c, 2, 7, 12, kc('aka', 2))
    rc(c, 2, 8, 12, 6, kc('aka', 0)); vl(c, 13, 8, 6, kc('aka', -1)); hl(c, 2, 8, 12, kc('aka', -2))
    hl(c, 3, 10, 10, kc('aka', -1)); rc(c, 7, 9, 2, 2, kc('tekko', 3))
    hl(c, 2, 14, 12, kc('aka', -2)); outline(c, 1, 3, 14, 12); hl(c, 2, 15, 12, kc('conc', -3))


@R.obj('cs-item-helmet-shelf', '안전모 선반(단서)', w=1, h=1, up=16, kind='wall', use=('search',), tags=TC + ('보물', '단서'),
       place='현장 사무실 곁 막다른 곳의 북쪽 벽 바로 아래(벽 붙이).', pair=('cs-site-office',),
       desc='철 선반 세 단 — 위에 흰·노란 안전모, 가운데 헤드램프 달린 안전모, 아래 장화 한 켤레. 조사 자리.')
def _helmets(c):
    rc(c, 1, 4, 14, 3, kc('tekko', 2)); hl(c, 1, 4, 14, kc('tekko', 3))   # 윗면
    for x0 in (1, 14): vl(c, x0, 4, 27, kc('tekko', 1) if x0 == 1 else kc('tekko', -1))
    for y0 in (17, 27): hl(c, 1, y0, 14, kc('tekko', 2)); hl(c, 1, y0 + 1, 14, kc('tekko', -1))
    hl(c, 2, 7, 12, kc('tekko', -2))
    for (x0, col) in ((2, 'shiro'), (8, 'kii')):                          # 안전모 둘
        disc(c, x0 + 3, 13, 3, 4, kc(col, 0)); disc(c, x0 + 2.5, 12, 1.6, 2, kc(col, 1)); hl(c, x0, 16, 7, kc(col, -1)); px(c, x0 + 1, 11, kc(col, 2))
    disc(c, 8, 23, 3, 3.6, kc('shiro', -1)); px(c, 7, 21, kc('shiro', 1)); rc(c, 7, 23, 2, 2, kc('kii', 2)); hl(c, 4, 26, 8, kc('shiro', -2))   # 헤드램프 안전모
    for x0 in (4, 9): rc(c, x0, 29 - 1, 3, 3, kc('yoru', 0)); px(c, x0, 28, kc('yoru', 1))   # 장화
    outline(c, 0, 3, 16, 29)


@R.obj('cs-item-blueprint', '설계도 통(단서)', w=1, h=1, up=0, kind='floor', use=('search', 'read'), tags=TC + ('보물', '단서'),
       place='막다른 곳·잠긴 창고 안 구석. 도면(단서)을 읽는 자리.',
       desc='바닥에 놓인 검은 원통 도면통과 그 곁에 말린 파란 도면 두 장 — 도면통 마개, 종이 끝의 말린 결. 단서를 읽는 자리.')
def _blueprint(c):
    for i in range(10):                                                   # 비스듬히 누운 도면통
        x, y = 2 + i, 11 - i // 2
        vl(c, x, y - 2, 4, kc('kon', -1)); px(c, x, y - 2, kc('kon', 0)); px(c, x, y + 1, kc('kon', -2))
        px(c, x, y - 3, OL); px(c, x, y + 2, OL)
    rc(c, 12, 3, 3, 4, kc('tekko', 1)); px(c, 12, 3, kc('tekko', 3)); outline(c, 11, 2, 5, 6)   # 마개
    for (x0, y0) in ((3, 12), (8, 13)):                                   # 말린 도면
        rc(c, x0, y0, 6, 2, kc('sora', 1)); hl(c, x0, y0, 6, kc('sora', 2)); disc(c, x0 + 6, y0 + 1, 1.2, 1.2, kc('shiro', 0)); px(c, x0 + 6, y0 + 1, kc('sora', 0))
        hl(c, x0, y0 + 2, 7, OL)


@R.obj('cs-item-car-trunk', '열어 둔 트렁크 짐 가방(단서)', w=1, h=1, up=8, kind='floor', use=('search',), tags=TP + ('보물', '단서'),
       place='주차된 차 바로 옆(동·서) 칸, 막다른 구석. 트렁크에서 꺼내 열어 둔 짐.', pair=('cs-car-a', 'cs-car-b'),
       desc='차 트렁크에서 꺼내 바닥에 열어 둔 검은 여행 가방 — 뒤로 젖힌 뚜껑의 붉은 안감과 끈, 안에 손전등·서류·천, 앞 손잡이. 조사 자리.')
def _trunk(c):
    poly(c, [(3, 9), (13, 9), (15, 18), (1, 18)], OL)                       # 뒤로 젖힌 뚜껑(위가 좁다 — 비스듬히 누움)
    poly(c, [(4, 10), (12, 10), (14, 17), (2, 17)], kc('aka', -2))          # 붉은 안감
    line(c, 4, 10, 2, 16, kc('aka', -1)); line(c, 5, 11, 10, 11, kc('aka', -1))
    line(c, 4, 15, 12, 13, kc('yoru', 1))                                   # 안감 끈 하나
    rc(c, 1, 18, 14, 5, kc('yoru', -2)); hl(c, 1, 18, 14, kc('yoru', -1))  # 안(위에서)
    rc(c, 2, 19, 6, 2, kc('kii', 1)); px(c, 2, 19, kc('shiro', 2)); px(c, 7, 20, kc('tekko', 2))      # 손전등
    rc(c, 9, 19, 5, 3, kc('shiro', 1)); hl(c, 9, 19, 5, kc('shiro', 2)); px(c, 13, 21, kc('shiro', -1))   # 서류
    hl(c, 2, 22, 7, kc('kon', 0))                                          # 천
    rc(c, 1, 23, 14, 6, kc('yoru', 0)); hl(c, 1, 23, 14, kc('yoru', 2)); vl(c, 14, 23, 6, kc('yoru', -2))   # 가방 몸통 앞면
    rc(c, 6, 25, 4, 1, kc('tekko', 2)); px(c, 6, 26, kc('tekko', 1)); px(c, 9, 26, kc('tekko', 1))        # 손잡이
    for x in (3, 12): vl(c, x, 23, 6, kc('yoru', 1))                        # 모서리 띠
    outline(c, 0, 17, 16, 13); hl(c, 1, 30, 14, kc('conc', -3))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

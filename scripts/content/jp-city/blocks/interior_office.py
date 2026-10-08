#!/usr/bin/env python3
"""jp_city 일본 실내 3묶음 — 사무실 빌딩(로비·사무층·회의실·급탕실·비상계단). id 머리 `of-`.

거리의 6층 사무 빌딩 `jp-bldg-office6`·잡거 빌딩 `jp-bldg-zakkyo5` 의 실내. 일본 중소기업 사무실 —
島型(섬) 책상 배치: 두 줄이 마주 보고 섬 끝(북쪽)에 과장 책상이 섬을 본다. 유리 칸막이 회의실, 給湯室·휴게 코너.

칸 16px = 1m(modern-style-bible §12-3). 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만.
글자·숫자·상표·사람 없음(안내판·화이트보드·층 표시는 색 줄·점뿐).
크기(1칸 = 16px = 1m):
  사무 책상 1.0×0.7m 높이 0.7m → 1×1 칸, 모니터 0.45m 가 위로 8px. 과장 책상 1.6×0.8m → 2×1.
  사무 의자 등받이 1.1m → up 16. 철제 서류장·서버 랙 1.8~2.0m → up 24~32(두 줄 솟음).
  엘리베이터 문 폭 0.9m ×2짝·높이 2.1m → 벽면 두 줄(32px)을 다 쓰는 2칸 폭. 복합기 1.1m → up 8.
  이동식 화이트보드 1.8×0.6m 높이 1.8m → 2×1, up 24. 로비 소파 2인 1.6m → 2×1, up 16. 큰 화분 1.6m → up 24.
  보안 게이트 기둥 1.0m → up 8, 사이 통로 1칸(사원증으로 지나는 줄). 자판기 1.8m → up 24.

캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (up/16 + h)*16, hang = w*16 × hrows*16, door = 16×32, table = fn(c,w,h).
분류는 interior/categories.py([interior_office of-] 칸 — office-lobby·office·pantry).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT

BLOCK = 'interior_office'
R = Registry(BLOCK, '사무실 빌딩')
TAGS = ('사무실', '사무 빌딩', 'オフィス', 'office')


# ── 도우미(interior_public.py 와 같은 꼴) ─────────────────────────────────────
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


def bev(c, x, y, w, h, ramp, t=0, olc=None):
    """외곽선 + 면 + 왼위 밝은 변 + 오른아래 어두운 변."""
    outline(c, x, y, w, h, olc)
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    rc(c, ix, iy, iw, ih, kc(ramp, t))
    hl(c, ix, iy, iw, kc(ramp, t + 1)); vl(c, ix, iy, ih, kc(ramp, t + 1))
    hl(c, ix, iy + ih - 1, iw, kc(ramp, t - 1)); vl(c, ix + iw - 1, iy, ih, kc(ramp, t - 1))


def box3(c, x, y, w, top, front, ramp, t=0, olc=None):
    """3/4 상자: 윗면 top 줄(밝게, 가장자리 1px 더 밝은 테) + 앞면 front 줄(어둡게). 외곽선 1px."""
    rc(c, x, y, w, top, kc(ramp, t + 2)); hl(c, x, y, w, kc(ramp, t + 3)); vl(c, x, y, top, kc(ramp, t + 3))
    hl(c, x, y + top - 1, w, kc(ramp, t + 3))                                   # 앞 가장자리 하이라이트
    rc(c, x, y + top, w, front, kc(ramp, t)); vl(c, x, y + top, front, kc(ramp, t + 1)); vl(c, x + w - 1, y + top, front, kc(ramp, t - 1))
    hl(c, x, y + top + front - 1, w, kc(ramp, t - 2))
    outline(c, x, y, w, top + front, olc or kc(ramp, -3))


# ══ 바닥 ════════════════════════════════════════════════════════════════════
@R.floor('of-lobby-stone', '로비 석재 바닥(광택)', cols=2, rows=2, tags=TAGS + ('로비',),
         desc='밝은 회백색 화강석 판 16px 이 반 칸씩 어긋나게 깔린 사무 빌딩 로비 바닥. 판마다 잔 점무늬, 대각 광택 한 줄. 로비·엘리베이터 홀.')
def _lobby_stone(c):
    for by in range(2):
        for bx in range(3):
            x0 = bx * 16 - (8 if by % 2 else 0); y0 = by * 16
            base = kc('conc', 3 if (bx + by) % 2 else 2)
            rc(c, x0, y0, 16, 16, base)
            for y in range(y0, y0 + 16):
                for x in range(x0, x0 + 16):
                    if 0 <= x < 32 and rnd(x % 32, y, 4, 35): px(c, x, y, kc('conc', 1 if (bx + by) % 2 else 3))
            for i in range(5): px(c, (x0 + 4 + i) % 32, y0 + 10 - i, kc('conc', 4))           # 광택(판마다 같은 자리)
            hl(c, x0, y0, 16, kc('conc', 1)); vl(c, x0 % 32, y0, 16, kc('conc', 1))           # 줄눈
    vl(c, 24, 16, 16, kc('conc', 1))


@R.floor('of-carpet-tile', '사무실 카펫 타일(회청)', cols=2, rows=2, tags=TAGS,
         desc='50cm 회청색 카펫 타일이 결 방향을 번갈아 깔린 사무실 바닥. 조용한 두 톤. 사무실·회의실·엘리베이터 홀.')
def _carpet(c):
    rc(c, 0, 0, 32, 32, kc('tairu', 0))
    for ty in range(2):
        for tx in range(2):
            horiz = (tx + ty) % 2 == 0                                          # 결 방향을 번갈아(짧은 결 자국만)
            for k in range(2, 15, 4):
                for j in range(1, 15, 4):
                    x, y = tx * 16 + (j if horiz else k), ty * 16 + (k if horiz else j)
                    if horiz: hl(c, x, y, 2, kc('tairu', 1))
                    else: vl(c, x, y, 2, kc('tairu', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 6, 40): px(c, x, y, kc('tairu', -1))
    for k in (0, 16): hl(c, 0, k, 32, kc('tairu', -1)); vl(c, k, 0, 32, kc('tairu', -1))   # 50cm 타일 이음(1m 마다)


@R.floor('of-pantry-tile', '급탕실 비닐 타일', cols=2, rows=2, tags=TAGS + ('급탕실', '휴게'),
         desc='크림·연베이지 30cm 비닐 타일 체크. 이음선이 가늘고 드문 얼룩 점. 급탕실·휴게 코너 바닥.')
def _pantry(c):
    for ty in range(2):
        for tx in range(2):
            rc(c, tx * 16, ty * 16, 16, 16, kc('kinari', 1 if (tx + ty) % 2 else 2))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 9, 18): px(c, x, y, kc('kinari', 0))
    hl(c, 0, 0, 32, kc('kinari', -1)); vl(c, 0, 0, 32, kc('kinari', -1)); hl(c, 0, 16, 32, kc('kinari', -1)); vl(c, 16, 0, 32, kc('kinari', -1))


@R.floor('of-stair-conc', '비상계단통 콘크리트 바닥', cols=2, rows=2, tags=TAGS + ('비상계단',),
         desc='회색 콘크리트를 칠한 비상계단통 바닥 — 잔 점, 1m 마다 얕은 이음. 비상계단 층계참.')
def _stair_conc(c):
    rc(c, 0, 0, 32, 32, kc('conc', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 13, 90): px(c, x, y, kc('conc', 0 if (x + y) % 3 else 2))
    hl(c, 0, 0, 32, kc('conc', 0)); vl(c, 0, 0, 32, kc('conc', 0)); hl(c, 0, 16, 32, kc('conc', 0)); vl(c, 16, 0, 32, kc('conc', 0))


# ══ 벽면 ════════════════════════════════════════════════════════════════════
@R.wall('of-wall', '사무 벽면(연회색·걸레받이)', cols=2, tags=TAGS,
        desc='연회색 비닐 벽지에 어두운 회색 걸레받이. 사무실·급탕실·계단통 벽.')
def _of_wall(c):
    rc(c, 0, 0, 32, 27, kc('conc', 3))
    for y in range(27):
        for x in range(32):
            if rnd(x, y, 11, 30): px(c, x, y, kc('conc', 2))
    vl(c, 0, 0, 27, kc('conc', 2)); vl(c, 16, 0, 27, kc('conc', 2))
    hl(c, 0, 26, 32, kc('conc', 1))
    rc(c, 0, 27, 32, 5, kc('tekko', -1)); hl(c, 0, 27, 32, kc('tekko', 1)); hl(c, 0, 31, 32, kc('tekko', -3))


@R.wall('of-lobby-wall', '로비 벽면(돌 판·나무 띠)', cols=2, tags=TAGS + ('로비',),
        desc='베이지 돌 판을 붙이고 허리 높이에 나무 띠를 두른 로비 벽. 맨 아래 돌 걸레받이.')
def _lobby_wall(c):
    rc(c, 0, 0, 32, 32, kc('kinari', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 12, 60): px(c, x, y, kc('kinari', 0))
    for y0 in (0, 11): hl(c, 0, y0, 32, kc('kinari', -1))                     # 판 가로 줄눈
    for x0 in (0, 16): vl(c, x0, 0, 18, kc('kinari', -1))
    vl(c, 8, 22, 6, kc('kinari', -1)); vl(c, 24, 22, 6, kc('kinari', -1))
    rc(c, 0, 18, 32, 4, kc('ita', 0)); hl(c, 0, 18, 32, kc('ita', 2)); hl(c, 0, 21, 32, kc('ita', -2))   # 나무 띠
    rc(c, 0, 28, 32, 4, kc('kinari', -1)); hl(c, 0, 28, 32, kc('kinari', 0)); hl(c, 0, 31, 32, kc('ita', -2))


@R.wall('of-glass-wall', '회의실 유리 칸막이 벽면', cols=2, tags=TAGS + ('회의실',),
        desc='알루미늄 틀에 판유리를 끼운 회의실 칸막이. 허리 높이에 젖빛 띠, 유리마다 대각 반사 줄. 맨 아래 알루미늄 걸레받이.')
def _glass_wall(c):
    rc(c, 0, 0, 32, 32, kc('garasu', 1))
    for y in range(32): hl(c, 0, y, 32, kc('garasu', 1 if y < 14 else 0))
    for x0 in (0, 16):
        for i in range(12):                                                     # 대각 반사 두 줄
            px(c, x0 + 3 + i // 2, 13 - i, kc('garasu', 3)); px(c, x0 + 4 + i // 2, 13 - i, kc('garasu', 3))
            if i < 7: px(c, x0 + 9 + i // 2, 13 - i, kc('garasu', 2))
    rc(c, 0, 15, 32, 3, kc('shiro', 1)); hl(c, 0, 15, 32, kc('shiro', 3)); hl(c, 0, 17, 32, kc('garasu', 0))   # 젖빛 띠
    for x0 in (0, 16): rc(c, x0, 0, 2, 32, kc('tekko', 2)); vl(c, x0, 0, 32, kc('tekko', 3)); vl(c, x0 + 1, 0, 32, kc('tekko', 0))
    rc(c, 0, 0, 32, 2, kc('tekko', 2)); hl(c, 0, 1, 32, kc('tekko', 0))
    rc(c, 0, 28, 32, 4, kc('tekko', 1)); hl(c, 0, 28, 32, kc('tekko', 3)); hl(c, 0, 31, 32, kc('tekko', -2))


# ══ 로비(1층) ═══════════════════════════════════════════════════════════════
@R.obj('of-reception', '로비 접수 카운터', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=TAGS + ('로비', '접수'),
       place='로비 안쪽, 가로로 이어 붙임(3~4칸). 남쪽(손님 쪽) 2줄을 비운다.',
       desc='흰 돌 상판에 짙은 호두나무 앞면, 허리에 밝은 띠가 지나는 사무 빌딩 로비 접수 카운터 한 칸. 가로로 이어 붙인다. 위에 전화·명함 상자를 놓는다.')
def _reception(c):
    rc(c, 0, 1, 16, 6, kc('shiro', 1)); hl(c, 0, 1, 16, kc('shiro', 2)); hl(c, 0, 6, 16, kc('shiro', 2))
    for x in range(16):
        if rnd(x, 3, 2, 200): px(c, x, 3 + (x % 2), kc('shiro', 0))
    hl(c, 0, 0, 16, OL); hl(c, 0, 7, 16, kc('conc', 0))
    rc(c, 0, 8, 16, 8, kc('ita', -2)); hl(c, 0, 8, 16, kc('ita', 0))
    rc(c, 0, 11, 16, 2, kc('kinari', 2)); hl(c, 0, 11, 16, kc('kinari', 1))       # 밝은 띠(간접등)
    for x in range(0, 16, 4): vl(c, x, 13, 2, kc('ita', -3))
    hl(c, 0, 15, 16, kc('ita', -3))


@R.obj('of-security-gate', '보안 게이트', w=1, h=1, up=8, kind='floor', use=('gate',), tags=TAGS + ('로비', '게이트'),
       place='로비와 엘리베이터 홀 사이를 가로지르는 한 줄 — 게이트 · 1칸 통로 · 게이트 · 1칸 통로 … 로 번갈아 놓는다.',
       desc='허리 높이 스테인리스 게이트 기둥 — 윗면에 카드 읽는 판(초록 점), 양옆으로 낮은 유리 날개. 기둥 사이 1칸이 사원증으로 지나는 통로다.')
def _gate(c):
    rc(c, 1, 17, 14, 7, kc('garasu', 2)); hl(c, 1, 17, 14, kc('garasu', 3)); outline(c, 0, 16, 16, 9, kc('garasu', -2))   # 유리 날개
    for i in range(4): px(c, 2 + i, 22 - i, kc('shiro', 3))
    rc(c, 5, 8, 6, 4, kc('yoru', 0)); hl(c, 5, 8, 6, kc('yoru', 2)); rc(c, 6, 9, 3, 2, kc('midori', 2)); px(c, 6, 9, kc('midori', 4))   # 윗면 카드판
    rc(c, 5, 12, 6, 17, kc('tekko', 2))
    for y in range(13, 29, 2): hl(c, 6, y, 4, kc('tekko', 3))
    vl(c, 5, 12, 17, kc('tekko', 3)); vl(c, 10, 12, 17, kc('tekko', 0))
    hl(c, 5, 12, 6, kc('tekko', 4)); hl(c, 5, 28, 6, kc('tekko', -2))
    outline(c, 4, 7, 8, 23)


@R.obj('of-elevator', '엘리베이터', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], use=('travel',), tags=TAGS + ('엘리베이터', 'エレベーター'),
       place='로비·각 층 엘리베이터 홀 북쪽 벽 바로 아래. 2대면 나란히, 사이에 호출 버튼(of-elevator-button). 문 앞 칸(발밑)에 층 이동(links)을 단다.',
       desc='북쪽 벽에 박힌 엘리베이터 — 스테인리스 문 두 짝이 닫혀 있고 위 어두운 띠에 층 표시 램프(호박색 점, 숫자 없음). 발밑 칸은 문턱만 있는 밟는 칸이고 거기서 다른 층으로 간다.')
def _elevator(c):
    rc(c, 1, 0, 30, 32, kc('tekko', 1)); vl(c, 1, 0, 32, kc('tekko', 3)); vl(c, 30, 0, 32, kc('tekko', -1))   # 문틀 판
    rc(c, 9, 1, 14, 4, kc('yoru', -1)); outline(c, 8, 0, 16, 6, kc('tekko', -2))                              # 층 표시 띠
    for i, x in enumerate(range(10, 22, 2)): px(c, x, 3, kc('kii', 2) if i == 2 else kc('yoru', 1))
    px(c, 14, 2, kc('kii', 3))
    rc(c, 4, 7, 24, 25, kc('tekko', -2))                                                                    # 문 홈
    for x0 in (5, 16):
        rc(c, x0, 8, 11, 24, kc('tekko', 2))
        for x in range(x0 + 1, x0 + 10, 3): vl(c, x, 9, 22, kc('tekko', 3))                                 # 결
        vl(c, x0, 8, 24, kc('tekko', 4) if x0 == 5 else kc('tekko', 3)); vl(c, x0 + 10, 8, 24, kc('tekko', 0))
        for i in range(6): px(c, x0 + 2 + i, 20 - i * 2, kc('shiro', 3))                                     # 반사
    vl(c, 15, 8, 24, OL); vl(c, 16, 8, 24, kc('tekko', 4))
    outline(c, 4, 7, 24, 25)
    outline(c, 0, 0, 32, 32)
    rc(c, 3, 32, 26, 3, kc('tekko', 3)); hl(c, 3, 32, 26, kc('tekko', 4)); hl(c, 3, 34, 26, kc('tekko', 0))   # 문턱
    hl(c, 3, 35, 26, kc('yoru', -1))


@R.obj('of-elevator-button', '엘리베이터 호출 버튼', w=1, kind='hang', hrows=2, use=('switch',), tags=TAGS + ('엘리베이터',),
       place='엘리베이터 두 대 사이 벽면, 또는 엘리베이터 옆 벽면 윗줄',
       desc='스테인리스 판에 둥근 호출 버튼 둘(위는 불 켜진 호박색, 아래는 꺼짐). 글자·화살표 없음.')
def _ebtn(c):
    rc(c, 5, 14, 6, 10, kc('tekko', 2)); vl(c, 5, 14, 10, kc('tekko', 4)); hl(c, 5, 14, 6, kc('tekko', 4)); outline(c, 4, 13, 8, 12, kc('tekko', -2))
    disc(c, 8, 17, 1.6, 1.6, kc('kii', 3)); px(c, 7, 16, kc('shiro', 4))
    disc(c, 8, 21, 1.6, 1.6, kc('conc', 1)); px(c, 7, 20, kc('conc', 3))


def _lobby_sofa(c, d):
    m = 'yoru'
    if d == 's':
        bev(c, 1, 3, 30, 13, m, 1)                                                                          # 등받이(북쪽)
        vl(c, 15, 4, 11, kc(m, 0)); vl(c, 16, 4, 11, kc(m, 3))
        bev(c, 0, 12, 4, 14, m, 0); bev(c, 28, 12, 4, 14, m, 0)                                             # 팔걸이
        bev(c, 4, 17, 24, 8, m, 2); vl(c, 15, 18, 6, kc(m, 0))
        hl(c, 4, 25, 24, kc(m, -1))
    else:
        bev(c, 1, 12, 30, 14, m, 1)                                                                         # 등받이 뒷면이 앞을 가림
        vl(c, 15, 13, 12, kc(m, 0)); vl(c, 16, 13, 12, kc(m, 3))
        bev(c, 0, 10, 4, 16, m, 0); bev(c, 28, 10, 4, 16, m, 0)
    for x in (3, 27): rc(c, x, 26, 2, 4, kc('tekko', 3)); vl(c, x + 1, 26, 4, kc('tekko', 0))               # 크롬 다리
    hl(c, 2, 30, 4, OL); hl(c, 26, 30, 4, OL)


for _d, _ko, _pl in (('s', '남향', '로비 벽 쪽(북쪽)에 두고 남쪽(입구·창)을 본다'), ('n', '북향', '로비 가운데에 두고 북쪽(접수·엘리베이터)을 본다')):
    def _mk(d=_d):
        return lambda c: _lobby_sofa(c, d)
    R.obj('of-lobby-sofa-' + _d, '로비 소파 2인(%s)' % _ko, w=2, h=1, up=16, kind='floor', use=('sit',), facing=_d.upper(), tags=TAGS + ('로비', '대기'),
          place=_pl, desc='짙은 남흑색 가죽 2인 소파 — 등받이 두 쪽, 양 팔걸이, 크롬 다리. 로비 손님 대기용.')(_mk())


@R.obj('of-plant-big', '큰 관엽 화분', w=1, h=1, up=24, kind='floor', tags=TAGS + ('로비', '화분'),
       place='로비 구석·엘리베이터 홀 모서리·자동문 안쪽 양옆',
       desc='키 1.6m 의 큰 관엽 식물(드라세나) — 흰 원통 화분 위로 가는 줄기 셋과 길쭉한 잎 덩이가 솟는다.')
def _plant_big(c):
    for x0, top in ((6, 14), (8, 9), (10, 16)):                                                             # 줄기
        vl(c, x0, top, 33 - top, kc('ita', -1)); vl(c, x0 + 1, top + 2, 31 - top, kc('ita', 1))
    for (cx, cy, rx, ry, t) in ((8, 8, 5.5, 4, 1), (4.5, 14, 4, 3.5, 0), (11.5, 16, 4, 3.5, 0), (8, 22, 5, 3, -1), (7, 4, 3, 2.5, 2)):
        disc(c, cx, cy, rx, ry, kc('midori', t - 1)); disc(c, cx - .6, cy - .8, rx - 1.2, ry - 1.1, kc('midori', t))
    for (x, y) in ((6, 5), (9, 7), (3, 12), (12, 14), (7, 20), (10, 3), (5, 16)): px(c, x, y, kc('midori', 2))
    for (x, y) in ((8, 12), (5, 18), (11, 19), (9, 24)): px(c, x, y, kc('midori', -2))
    rc(c, 3, 33, 10, 13, kc('shiro', 1)); disc(c, 8, 33, 5, 1.6, kc('shiro', 3)); disc(c, 8, 33, 3.6, .9, kc('soil', -1))   # 화분
    vl(c, 3, 33, 13, kc('shiro', 3)); vl(c, 12, 33, 13, kc('conc', 2)); hl(c, 3, 45, 10, kc('conc', 1))
    vl(c, 2, 33, 13, OL); vl(c, 13, 33, 13, OL); hl(c, 3, 46, 10, OL)


@R.obj('of-directory', '층 안내판', w=1, kind='hang', hrows=2, use=('read',), tags=TAGS + ('로비', '안내'),
       place='로비 엘리베이터 옆 벽면 윗줄', desc='짙은 남색 판에 층마다 회사 색 네모와 흰 줄이 6줄 늘어선 층 안내판. 글자·숫자 없이 색 줄뿐.')
def _directory(c):
    rc(c, 2, 2, 12, 26, kc('kon', -2)); outline(c, 1, 1, 14, 28, kc('tekko', 1)); hl(c, 1, 1, 14, kc('tekko', 3))
    cols = ('aka', 'sora', 'midori', 'kii', 'daidai', 'murasaki')
    for i, col in enumerate(cols):
        y = 4 + i * 4
        rc(c, 3, y, 2, 2, kc(col, 1)); hl(c, 6, y, 6 - (i % 3), kc('shiro', 2)); hl(c, 6, y + 1, 4, kc('kon', 0))
    hl(c, 2, 27, 12, kc('kon', -1))


@R.obj('of-mailbox-wall', '입주사 우편함', w=2, h=1, up=16, kind='wall', use=('open',), tags=TAGS + ('로비', '우편함'),
       place='로비 한쪽 벽(입구 가까이)', desc='회색 철제 우편함이 4열 4단으로 짜인 벽 붙이 — 칸마다 투입구 줄과 빈 이름표(글자 없음), 윗면이 보인다.')
def _mailbox(c):
    rc(c, 0, 2, 32, 4, kc('conc', 4)); hl(c, 0, 2, 32, kc('shiro', 3)); hl(c, 0, 5, 32, kc('conc', 4))
    rc(c, 0, 6, 32, 26, kc('conc', 2))
    for r in range(4):
        for k in range(4):
            x, y = 1 + k * 8, 7 + r * 6
            rc(c, x, y, 7, 5, kc('conc', 3)); hl(c, x, y, 7, kc('conc', 4)); vl(c, x, y, 5, kc('conc', 4))
            hl(c, x + 1, y + 1, 5, kc('yoru', -1)); rc(c, x + 2, y + 3, 3, 1, kc('shiro', 2)); px(c, x + 6, y + 3, kc('tekko', 4))
            hl(c, x, y + 4, 7, kc('conc', 0)); vl(c, x + 6, y, 5, kc('conc', 0))
    hl(c, 0, 31, 32, kc('conc', -2)); outline(c, 0, 2, 32, 30, kc('conc', -3))


# ══ 사무층 ══════════════════════════════════════════════════════════════════
def _desk_top(c, y0, h_top=9):
    """1칸 사무 책상: 연회색 멜라민 상판 + 앞 가장자리 + 회색 철제 앞판(서랍)."""
    rc(c, 0, y0, 16, h_top, kc('conc', 4)); hl(c, 0, y0, 16, kc('shiro', 2)); vl(c, 0, y0, h_top, kc('shiro', 2))
    hl(c, 0, y0 + h_top - 1, 16, kc('shiro', 3))
    yf = y0 + h_top
    rc(c, 0, yf, 16, 32 - yf if y0 >= 16 else 16 - yf, kc('tekko', 1))
    hl(c, 0, yf, 16, kc('tekko', -1))
    hb = (32 if y0 >= 16 else 16)
    vl(c, 15, yf, hb - yf, kc('tekko', -2)); vl(c, 0, yf, hb - yf, kc('tekko', 2))
    hl(c, 0, hb - 1, 16, kc('tekko', -3))
    outline(c, 0, y0, 16, hb - y0, kc('tekko', -3))


def _keyboard(c, x, y, w=6):
    rc(c, x, y, w, 3, kc('shiro', 3)); hl(c, x, y + 2, w, kc('conc', 2))
    for i in range(x + 1, x + w - 1, 2): px(c, i, y + 1, kc('conc', 2))


def _desk_side_monitor(c, east):
    """섬 책상 — 앉는 사람이 서쪽(east=True: 모니터가 동쪽 가장자리) 또는 동쪽. 모니터는 옆모습: 얇은 검은 몸통 + 앉는 쪽 화면 빛 1열 + 받침."""
    _desk_top(c, 17)
    # 비스듬한 옆모습: 화면 면 3열(앉는 쪽, 하늘색 + 반사) + 뒤판 2열(검정). 섬 가운데에서 맞은편 모니터 뒤판과 맞닿는다.
    if east: sx, bx = 10, 13
    else: sx, bx = 3, 1
    rc(c, sx, 9, 3, 11, kc('sora', 0)); rc(c, sx + (0 if east else 0), 10, 3, 9, kc('sora', 1))
    px(c, sx + 1, 11, kc('sora', 3)); px(c, sx + (0 if east else 2), 12, kc('sora', 2))
    rc(c, bx, 8, 2, 13, kc('yoru', -1)); hl(c, bx, 8, 2, kc('yoru', 1))
    outline(c, min(sx, bx) - 1, 7, 7, 15)
    mx = 12 if east else 2
    rc(c, mx, 22, 2, 1, kc('tekko', 0)); hl(c, mx - 1, 23, 4, kc('tekko', 2))                               # 받침
    _keyboard(c, 2 if east else 8, 21, 6)
    if east: rc(c, 2, 18, 4, 2, kc('shiro', 3)); px(c, 7, 24, kc('kon', 1))                                 # 메모·볼펜
    else: rc(c, 10, 18, 4, 2, kc('shiro', 3)); px(c, 9, 24, kc('kon', 1))
    rc(c, 2 if east else 9, 27, 5, 2, kc('tekko', 2)); hl(c, 3 if east else 10, 27, 3, kc('tekko', 4))       # 서랍 손잡이


@R.obj('of-desk-w', '섬 사무 책상(서쪽 자리)', w=1, h=1, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '島型'),
       place='책상 섬의 서쪽 열. 남북으로 3~4칸 이어 붙이고 동쪽에 of-desk-e 열을 맞붙인다. 서쪽에 of-desk-chair-e.',
       desc='연회색 상판의 사무 책상 한 칸 — 앉는 사람은 서쪽. 동쪽 가장자리에 모니터(옆모습, 화면 빛은 서쪽), 서쪽에 키보드·메모. 섬 가운데에서 맞은편 책상과 모니터 등이 맞닿는다.')
def _desk_w(c): _desk_side_monitor(c, True)


@R.obj('of-desk-e', '섬 사무 책상(동쪽 자리)', w=1, h=1, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '島型'),
       place='책상 섬의 동쪽 열. of-desk-w 열 동쪽에 맞붙인다. 동쪽에 of-desk-chair-w.',
       desc='연회색 상판의 사무 책상 한 칸 — 앉는 사람은 동쪽. 서쪽 가장자리에 모니터(옆모습, 화면 빛은 동쪽), 동쪽에 키보드·메모.')
def _desk_e(c): _desk_side_monitor(c, False)


def _desk_front_monitor(c, seat_n):
    """가로로 긴 섬의 책상 한 칸. seat_n=True: 북쪽 줄(앉는 사람은 북쪽, 모니터는 남쪽 가장자리 — 등판이 보인다).
    seat_n=False: 남쪽 줄(앉는 사람은 남쪽, 모니터는 북쪽 가장자리 — 화면이 남쪽으로 보이고 위로 솟아 맞은편 모니터 등판과 맞닿는다)."""
    if seat_n:
        rc(c, 0, 16, 16, 12, kc('conc', 4)); hl(c, 0, 16, 16, kc('shiro', 2)); vl(c, 0, 16, 12, kc('shiro', 2))     # 상판(이어진 섬 — 앞판은 얇게)
        rc(c, 0, 28, 16, 4, kc('tekko', 1)); hl(c, 0, 28, 16, kc('tekko', -1)); hl(c, 0, 31, 16, kc('tekko', -3))
        _keyboard(c, 4, 17, 8)
        rc(c, 2, 13, 12, 11, kc('yoru', 0)); hl(c, 2, 13, 12, kc('yoru', 2)); vl(c, 2, 13, 11, kc('yoru', 1))        # 모니터 등판
        rc(c, 6, 15, 4, 3, kc('yoru', -1)); outline(c, 1, 12, 14, 13)
        rc(c, 7, 25, 2, 2, kc('tekko', 0)); hl(c, 5, 27, 6, kc('tekko', 2))
        outline(c, 0, 15, 16, 17, kc('tekko', -3))
    else:
        rc(c, 0, 16, 16, 9, kc('conc', 4)); hl(c, 0, 16, 16, kc('shiro', 2)); vl(c, 0, 16, 9, kc('shiro', 2)); hl(c, 0, 24, 16, kc('shiro', 3))
        rc(c, 0, 25, 16, 7, kc('tekko', 1)); hl(c, 0, 25, 16, kc('tekko', -1)); vl(c, 0, 25, 7, kc('tekko', 2)); vl(c, 15, 25, 7, kc('tekko', -2))
        hl(c, 0, 31, 16, kc('tekko', -3)); rc(c, 9, 27, 5, 2, kc('tekko', 2)); hl(c, 10, 27, 3, kc('tekko', 4))
        outline(c, 0, 16, 16, 16, kc('tekko', -3))
        rc(c, 2, 7, 12, 10, kc('yoru', -1)); rc(c, 3, 8, 10, 7, kc('sora', 1)); hl(c, 3, 8, 10, kc('sora', 2))        # 모니터 화면(남향)
        px(c, 4, 9, kc('sora', 3)); px(c, 5, 9, kc('sora', 3)); hl(c, 4, 11, 6, kc('sora', 0)); hl(c, 4, 13, 4, kc('sora', 0))
        outline(c, 1, 6, 14, 12)
        rc(c, 7, 18, 2, 2, kc('tekko', 0)); hl(c, 5, 19, 6, kc('tekko', 2))
        _keyboard(c, 4, 21, 8)


@R.obj('of-desk-n', '섬 사무 책상(북쪽 줄)', w=1, h=1, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '島型'),
       place='가로로 긴 책상 섬의 북쪽 줄. 동서로 3~4칸 이어 붙이고 바로 남쪽에 of-desk-s 줄을 맞붙인다. 북쪽에 of-desk-chair-s.',
       desc='연회색 상판의 사무 책상 한 칸 — 앉는 사람은 북쪽(남쪽을 본다). 남쪽 가장자리에 모니터 등판이 서고 앞쪽(북쪽)에 키보드. 섬 가운데에서 맞은편 줄 모니터와 등을 맞댄다.')
def _desk_n(c): _desk_front_monitor(c, True)


@R.obj('of-desk-s', '섬 사무 책상(남쪽 줄)', w=1, h=1, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '島型'),
       place='가로로 긴 책상 섬의 남쪽 줄. of-desk-n 줄 바로 남쪽에 맞붙인다. 남쪽에 of-desk-chair-n.',
       desc='연회색 상판의 사무 책상 한 칸 — 앉는 사람은 남쪽(북쪽을 본다). 북쪽 가장자리에 모니터가 서서 화면(하늘색)이 보이고 앞쪽에 키보드, 아래 서랍.')
def _desk_s(c): _desk_front_monitor(c, False)


def _boss_v(c, seat_w):
    """세로 과장 책상 1×2 — 가로로 긴 섬의 끝에 붙어 섬을 본다. seat_w=True: 과장은 서쪽에 앉아 동쪽(섬)을 본다."""
    rc(c, 0, 16, 16, 26, kc('ita', 1)); hl(c, 0, 16, 16, kc('ita', 3)); vl(c, 0, 16, 26, kc('ita', 3))
    for y in (20, 27, 34): hl(c, 3, y, 9, kc('ita', 0))
    rc(c, 0, 42, 16, 6, kc('ita', -1)); hl(c, 0, 42, 16, kc('ita', -3)); hl(c, 0, 47, 16, kc('ita', -3))
    vl(c, 15, 16, 26, kc('ita', -2)); outline(c, 0, 16, 16, 32)
    mx = 11 if seat_w else 2                                                                                 # 모니터(옆모습, 화면은 과장 쪽)
    sx, bx = (mx - 2, mx + 1) if seat_w else (mx + 1, mx - 1)
    rc(c, sx, 14, 3, 12, kc('sora', 0)); rc(c, sx, 15, 3, 10, kc('sora', 1)); px(c, sx + 1, 16, kc('sora', 3))
    rc(c, bx, 13, 2, 14, kc('yoru', -1)); hl(c, bx, 13, 2, kc('yoru', 1)); outline(c, min(sx, bx) - 1, 12, 7, 16)
    rc(c, mx, 28, 2, 2, kc('tekko', 0))
    kx = 2 if seat_w else 8
    _keyboard(c, kx, 31, 6)
    rc(c, kx, 36, 6, 4, kc('shiro', 2)); hl(c, kx, 36, 6, kc('shiro', 4)); hl(c, kx, 38, 6, kc('conc', 2))       # 결재 서류함
    rc(c, 9 if seat_w else 2, 18, 5, 3, kc('yoru', 0)); hl(c, 9 if seat_w else 2, 18, 5, kc('yoru', 2))            # 전화


@R.obj('of-boss-desk-e', '과장 책상(섬 끝·동향)', w=1, h=2, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '과장', '島型'),
       place='가로로 긴 섬의 서쪽 끝에 섬 폭(2줄) 그대로 붙인다. 과장은 서쪽 의자(of-desk-chair-e)에 앉아 동쪽(섬)을 본다.',
       desc='섬 끝에 세로로 놓는 과장 책상 1×2 — 짙은 나무 상판, 동쪽 가장자리에 모니터(옆모습, 화면은 과장 쪽), 키보드·결재 서류함·전화.')
def _boss_e(c): _boss_v(c, True)


@R.obj('of-boss-desk-w', '과장 책상(섬 끝·서향)', w=1, h=2, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '과장', '島型'),
       place='가로로 긴 섬의 동쪽 끝에 섬 폭(2줄) 그대로 붙인다. 과장은 동쪽 의자(of-desk-chair-w)에 앉아 서쪽(섬)을 본다.',
       desc='섬 끝에 세로로 놓는 과장 책상 1×2 — 짙은 나무 상판, 서쪽 가장자리에 모니터(옆모습, 화면은 과장 쪽), 키보드·결재 서류함·전화.')
def _boss_w(c): _boss_v(c, False)


@R.obj('of-desk', '사무 책상(빈 상판)', w=1, h=1, up=0, kind='floor', surface=True, tags=TAGS + ('책상',),
       place='섬 끝·창가·회의실 옆 보조 책상. 위에 노트북·서류·머그·전화를 놓는다.',
       desc='연회색 멜라민 상판에 회색 철제 앞판(서랍 손잡이)의 사무 책상 한 칸. 상판이 비어 탁상 물건을 올린다.')
def _desk(c):
    _desk_top(c, 1, 8)
    rc(c, 9, 11, 5, 2, kc('tekko', 2)); hl(c, 10, 11, 3, kc('tekko', 4))
    hl(c, 0, 0, 16, OL)


def _office_chair(c, d):
    m = 'kon'
    if d == 's':
        bev(c, 4, 4, 8, 12, m, -1); hl(c, 5, 6, 6, kc(m, 1))
        for y in range(8, 14, 2): hl(c, 5, y, 6, kc(m, -2))                                                 # 메시
        bev(c, 3, 16, 10, 7, m, 0); hl(c, 4, 17, 8, kc(m, 2))
        vl(c, 2, 17, 4, kc('tekko', 0)); vl(c, 13, 17, 4, kc('tekko', 0))                                   # 팔걸이
    elif d == 'n':
        bev(c, 3, 13, 10, 11, m, -1); hl(c, 4, 14, 8, kc(m, 1))
        for y in range(16, 23, 2): hl(c, 4, y, 8, kc(m, -2))
        vl(c, 2, 18, 4, kc('tekko', 0)); vl(c, 13, 18, 4, kc('tekko', 0))
    else:
        e = d == 'e'                                                                                       # 동쪽을 본다 = 등받이가 서쪽
        bx = 3 if e else 10
        bev(c, bx, 4, 4, 17, m, -1); vl(c, bx + 1, 6, 13, kc(m, 1) if e else kc(m, -2))
        sx = 3 if e else 2
        bev(c, sx, 17, 11, 6, m, 0); hl(c, sx + 1, 18, 9, kc(m, 2))
        rc(c, (9 if e else 4), 15, 3, 2, kc('tekko', 0))                                                    # 팔걸이
    rc(c, 7, 23, 2, 5, kc('tekko', 1)); vl(c, 7, 23, 5, kc('tekko', 3)); vl(c, 8, 23, 5, kc('tekko', -2))     # 가스 기둥
    hl(c, 2, 28, 12, kc('yoru', 0)); hl(c, 3, 29, 10, kc('yoru', 1))                                          # 별 다리
    for x in (2, 7, 12): rc(c, x, 30, 2, 2, kc('yoru', -2)); px(c, x, 30, kc('yoru', 1))


for _d, _ko, _pl in (('s', '남향', '책상·과장 책상의 북쪽'), ('n', '북향', '책상의 남쪽'),
                     ('e', '동향', '섬 서쪽 열 책상(of-desk-w)의 서쪽'), ('w', '서향', '섬 동쪽 열 책상(of-desk-e)의 동쪽')):
    def _mk(d=_d):
        return lambda c: _office_chair(c, d)
    R.obj('of-desk-chair-' + _d, '사무 의자(%s)' % _ko, w=1, h=1, up=16, kind='floor', use=('sit',), facing=_d.upper(), tags=TAGS + ('의자',),
          place=_pl, desc='남색 메시 등받이에 팔걸이·가스 기둥·검은 별 다리의 사무 회전 의자. %s.' % _pl + (' 옆모습(L자).' if _d in 'ew' else ''))(_mk())


@R.obj('of-boss-desk', '과장 책상', w=2, h=1, up=8, kind='floor', use=('read',), tags=TAGS + ('책상', '과장', '島型'),
       place='책상 섬 북쪽 끝에 섬 폭 그대로 붙인다. 과장은 북쪽 의자(of-desk-chair-s)에 앉아 남쪽(섬)을 본다.',
       desc='섬 끝에 놓는 과장 책상 2칸 — 짙은 나무 상판, 모니터 뒷면(화면은 과장 쪽 북쪽), 서류함·전화, 남쪽 앞판은 나무 판.')
def _boss(c):
    rc(c, 0, 17, 32, 9, kc('ita', 1)); hl(c, 0, 17, 32, kc('ita', 3)); vl(c, 0, 17, 9, kc('ita', 3)); hl(c, 0, 25, 32, kc('ita', 3))
    for y in (19, 23): hl(c, 3 + (y % 3), y, 8, kc('ita', 0)); hl(c, 18, y, 7, kc('ita', 0))
    rc(c, 0, 26, 32, 6, kc('ita', -1)); hl(c, 0, 26, 32, kc('ita', -3)); vl(c, 15, 27, 4, kc('ita', -3)); vl(c, 16, 27, 4, kc('ita', 1))
    hl(c, 0, 31, 32, kc('ita', -3)); outline(c, 0, 17, 32, 15)
    rc(c, 10, 8, 12, 11, kc('yoru', 0)); hl(c, 10, 8, 12, kc('yoru', 2)); vl(c, 10, 8, 11, kc('yoru', 1)); outline(c, 9, 7, 14, 13)   # 모니터 뒷면
    rc(c, 15, 19, 2, 3, kc('tekko', 0)); hl(c, 13, 21, 6, kc('tekko', 2))
    rc(c, 2, 15, 6, 6, kc('shiro', 2)); hl(c, 2, 15, 6, kc('shiro', 4)); hl(c, 2, 17, 6, kc('conc', 2)); outline(c, 1, 14, 8, 8, kc('conc', -1))   # 서류함
    rc(c, 24, 19, 6, 4, kc('yoru', 0)); hl(c, 24, 19, 6, kc('yoru', 2)); rc(c, 25, 18, 4, 1, kc('yoru', 1)); outline(c, 23, 17, 8, 7)   # 전화


@R.obj('of-partition', '낮은 칸막이', w=1, h=1, up=8, kind='floor', tags=TAGS + ('칸막이',),
       place='섬과 통로·휴게 코너 사이, 가로로 이어 붙임(동서 한 줄)',
       desc='허리~가슴 높이의 회청색 천 칸막이 판 한 칸 — 위 알루미늄 갓, 아래 발. 가로로 이어 붙여 한 줄 칸막이를 만든다.')
def _partition(c):
    rc(c, 0, 9, 16, 3, kc('tekko', 3)); hl(c, 0, 9, 16, kc('tekko', 4)); hl(c, 0, 11, 16, kc('tekko', 1))      # 갓(윗면)
    rc(c, 0, 12, 16, 15, kc('sora', 0))
    for y in range(13, 26):
        for x in range(16):
            if (x + y) % 3 == 0: px(c, x, y, kc('sora', -1))
    hl(c, 0, 12, 16, kc('sora', 1)); hl(c, 0, 26, 16, kc('sora', -2))
    rc(c, 0, 27, 16, 2, kc('tekko', 1))
    rc(c, 2, 29, 2, 2, kc('tekko', 0)); rc(c, 12, 29, 2, 2, kc('tekko', 0))
    hl(c, 0, 8, 16, OL); hl(c, 0, 29, 16, OL)


@R.obj('of-cabinet', '철제 서류장', w=1, h=1, up=24, kind='wall', use=('open',), tags=TAGS + ('서류장', '캐비닛'),
       place='사무실 북쪽 벽 아래, 가로로 2~4칸 이어 붙임',
       desc='회색 철제 서류장(높이 1.8m) — 위 두 짝은 유리문이라 색색 바인더 등이 보이고, 아래 두 짝은 철문에 손잡이. 윗면이 보인다.')
def _cabinet(c):
    rc(c, 0, 8, 16, 4, kc('conc', 4)); hl(c, 0, 8, 16, kc('shiro', 3)); hl(c, 0, 11, 16, kc('shiro', 2))     # 윗면 T
    rc(c, 0, 12, 16, 36, kc('conc', 2)); vl(c, 0, 12, 36, kc('conc', 4)); vl(c, 15, 12, 36, kc('conc', 0))
    hl(c, 0, 12, 16, kc('conc', 0)); hl(c, 0, 13, 16, kc('conc', 1))                                          # 처마 그림자
    rc(c, 1, 14, 14, 14, kc('garasu', -1)); outline(c, 1, 14, 14, 14, kc('conc', 0))
    cols = ('kon', 'aka', 'shiro', 'midori', 'kii', 'sora')
    for r, y in enumerate((16, 22)):
        for i in range(6):
            x = 2 + i * 2; col = cols[(i + r * 2) % 6]
            rc(c, x, y, 2, 5, kc(col, 0)); px(c, x, y, kc(col, 2)); px(c, x, y + 3, kc('shiro', 3))
        hl(c, 2, y + 5, 12, kc('conc', 3))
    vl(c, 8, 14, 14, kc('conc', 1)); vl(c, 3, 15, 12, kc('garasu', 3))
    for y0 in (30, 39):
        rc(c, 1, y0, 14, 8, kc('conc', 3)); hl(c, 1, y0, 14, kc('conc', 4)); hl(c, 1, y0 + 7, 14, kc('conc', 0))
        vl(c, 8, y0, 8, kc('conc', 0)); rc(c, 6, y0 + 3, 1, 2, kc('tekko', 4)); rc(c, 9, y0 + 3, 1, 2, kc('tekko', 4))
    hl(c, 0, 47, 16, kc('conc', -3)); outline(c, 0, 8, 16, 40, kc('conc', -3))


@R.obj('of-copier', '복합기', w=1, h=1, up=8, kind='floor', use=('search',), tags=TAGS + ('복합기', '복사기'),
       place='사무실 벽 가까이·통로 끝(앞에 1칸 비움)',
       desc='흰·회색 복합기 — 윗면에 원고 덮개와 앞쪽 조작판(작은 하늘색 화면), 몸통에 용지함 서랍 셋, 옆에 출력 받침.')
def _copier(c):
    rc(c, 1, 8, 14, 6, kc('conc', 4)); hl(c, 1, 8, 14, kc('shiro', 3)); vl(c, 1, 8, 6, kc('shiro', 3))         # 원고 덮개(윗면)
    hl(c, 2, 10, 10, kc('conc', 3))
    rc(c, 1, 14, 14, 3, kc('yoru', 0)); rc(c, 3, 14, 5, 2, kc('sora', 2)); px(c, 10, 15, kc('midori', 3)); px(c, 12, 15, kc('kii', 2))   # 조작판
    rc(c, 1, 17, 14, 14, kc('shiro', 1)); vl(c, 1, 17, 14, kc('shiro', 3)); vl(c, 14, 17, 14, kc('conc', 2))
    rc(c, 2, 18, 9, 2, kc('yoru', -1)); rc(c, 3, 18, 6, 1, kc('shiro', 3))                                    # 출력 받침
    for y in (21, 25, 29): hl(c, 2, y, 12, kc('conc', 1)); rc(c, 6, y + 1, 4, 1, kc('conc', 2))
    hl(c, 1, 31, 14, kc('conc', -2)); outline(c, 0, 7, 16, 25, kc('conc', -2))


@R.obj('of-whiteboard', '이동식 화이트보드', w=2, h=1, up=24, kind='floor', tags=TAGS + ('화이트보드', '회의실'),
       place='회의실 탁자 한쪽 끝·사무실 섬 옆(벽에서 1칸 떨어져)',
       desc='알루미늄 틀의 흰 판에 색 펜 선(막대 그래프·화살 없는 선, 글자 없음), 아래 펜 받침, 바퀴 달린 두 다리.')
def _whiteboard(c):
    rc(c, 1, 3, 30, 26, kc('shiro', 3)); outline(c, 0, 2, 32, 28, kc('tekko', 1)); hl(c, 0, 2, 32, kc('tekko', 4))
    vl(c, 0, 2, 28, kc('tekko', 3))
    for i in range(10): px(c, 4 + i, 8 + (i % 3), kc('kon', 0))                                              # 펜 선
    for i, h in enumerate((5, 8, 4, 10)): rc(c, 17 + i * 3, 24 - h, 2, h, kc(('aka', 'sora', 'midori', 'aka')[i], 1))
    hl(c, 16, 25, 13, kc('kon', 0)); hl(c, 4, 14, 9, kc('aka', 1)); hl(c, 4, 18, 7, kc('kon', 0))
    for i in range(6): px(c, 22 + i, 6 + i // 2, kc('shiro', 1))
    rc(c, 1, 29, 30, 2, kc('tekko', 2)); hl(c, 1, 29, 30, kc('tekko', 4)); rc(c, 5, 28, 3, 1, kc('aka', 1)); rc(c, 9, 28, 3, 1, kc('kon', 0))   # 펜 받침
    for x in (3, 27):
        rc(c, x, 31, 2, 13, kc('tekko', 2)); vl(c, x, 31, 13, kc('tekko', 4)); vl(c, x + 1, 31, 13, kc('tekko', 0))
        rc(c, x - 2, 44, 6, 2, kc('tekko', 1)); hl(c, x - 2, 44, 6, kc('tekko', 3)); outline(c, x - 3, 43, 8, 4)
        rc(c, x - 2, 46, 2, 2, kc('yoru', -2)); rc(c, x + 2, 46, 2, 2, kc('yoru', -2))


@R.table('of-meeting-table', '회의 탁자', desc='흰 멜라민 상판에 은색 모서리 띠, 양 끝에만 철제 다리. 어떤 w×h 로도 이어 붙는다. 회의실 가운데, 둘레에 의자.', tags=TAGS + ('회의실',))
def _meeting(c, w, h):
    W, H = w * 16, h * 16
    ty1 = H - 9
    c.R(0, 1, W, ty1, K('shiro', 1)); c.HL(0, 1, W, K('shiro', 2))
    for y in range(3, ty1, 6):
        for x in range(0, W, 16): c.HL(x + (2 if (y // 6) % 2 else 9), y, 4, K('shiro', 0))
    c.R(0, ty1 + 1, W, 3, K('tekko', 2)); c.HL(0, ty1 + 1, W, K('tekko', 4)); c.HL(0, ty1 + 3, W, K('tekko', -1))
    c.VL(0, 1, ty1 + 3, K('shiro', 2)); c.VL(W - 1, 1, ty1 + 3, K('tekko', 0))
    c.HL(0, 0, W, OL); c.HL(0, ty1 + 4, W, OL); c.VL(0, 0, ty1 + 5, OL); c.VL(W - 1, 0, ty1 + 5, OL)
    for x0 in (1, W - 3):
        c.R(x0, ty1 + 5, 2, H - ty1 - 5, K('tekko', 1)); c.VL(x0, ty1 + 5, H - ty1 - 5, K('tekko', 3))


@R.obj('of-server-rack', '서버 랙', w=1, h=1, up=24, kind='wall', tags=TAGS + ('서버',),
       place='사무실 구석 북쪽 벽 아래(복합기·서류장 줄 끝)',
       desc='검은 서버 랙(높이 2m) — 타공 앞문 너머로 장비 단 줄과 초록·호박색 LED 점. 윗면이 보인다.')
def _rack(c):
    rc(c, 0, 8, 16, 4, kc('yoru', 1)); hl(c, 0, 8, 16, kc('yoru', 3)); hl(c, 0, 11, 16, kc('yoru', 2))
    rc(c, 0, 12, 16, 36, kc('yoru', -2)); vl(c, 0, 12, 36, kc('yoru', 0)); hl(c, 0, 12, 16, kc('sumi', -1))
    for r in range(8):
        y = 14 + r * 4
        rc(c, 2, y, 12, 3, kc('yoru', -1)); hl(c, 2, y, 12, kc('yoru', 0))
        px(c, 3, y + 1, kc('midori', 3) if (r % 3) else kc('kii', 3)); px(c, 5, y + 1, kc('midori', 2) if r % 2 else kc('yoru', 1))
        for x in range(8, 13, 2): px(c, x, y + 1, kc('yoru', 1))
    vl(c, 14, 14, 32, kc('tekko', 1))
    hl(c, 0, 47, 16, OL); outline(c, 0, 8, 16, 40)


@R.obj('of-coat-rack', '옷걸이 스탠드', w=1, h=1, up=24, kind='floor', tags=TAGS + ('옷걸이',),
       place='사무실 입구 옆·회의실 문 옆 구석',
       desc='검은 철제 옷걸이 스탠드 — 둥근 받침, 기둥, 위 갈고리에 남색 코트 한 벌과 회색 목도리.')
def _coat(c):
    vl(c, 7, 6, 38, kc('yoru', 0)); vl(c, 8, 6, 38, kc('yoru', 2))
    for (x, y) in ((4, 6), (5, 7), (10, 7), (11, 6), (6, 8), (9, 8)): px(c, x, y, kc('yoru', 1))
    rc(c, 5, 4, 6, 2, kc('yoru', 1)); hl(c, 5, 4, 6, kc('yoru', 3))
    rc(c, 3, 9, 6, 18, kc('kon', 0)); vl(c, 3, 9, 18, kc('kon', 1)); vl(c, 8, 10, 16, kc('kon', -2)); hl(c, 3, 26, 6, kc('kon', -2))   # 코트
    vl(c, 5, 10, 14, kc('kon', -1)); outline(c, 2, 8, 8, 20)
    rc(c, 9, 9, 3, 12, kc('conc', 2)); vl(c, 9, 9, 12, kc('conc', 4)); hl(c, 9, 20, 3, kc('conc', 0)); outline(c, 8, 8, 5, 14)   # 목도리
    disc(c, 8, 44, 5, 2, kc('yoru', 1)); disc(c, 7.5, 43.5, 3.5, 1, kc('yoru', 3))
    hl(c, 3, 46, 10, OL)


# ══ 문·창 ═══════════════════════════════════════════════════════════════════
def _door_frame(c, ramp):
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 0, 3, 32, kc(ramp, 1)); vl(c, x0 + (0 if f > 0 else 2), 0, 32, kc(ramp, 3 if f > 0 else -2)); vl(c, x0 + (2 if f > 0 else 0), 4, 28, kc(ramp, -2 if f > 0 else 2))
    rc(c, 0, 0, 16, 4, kc(ramp, 1)); hl(c, 0, 0, 16, kc(ramp, -3)); hl(c, 0, 1, 16, kc(ramp, 3)); hl(c, 0, 3, 16, kc(ramp, -2))


@R.obj('of-glass-door', '회의실 유리문(열림)', kind='door', use=('travel', 'open'), tags=TAGS + ('회의실', '문'),
       place='회의실 유리 칸막이(가로 칸막이)의 1칸 틈 칸',
       desc='알루미늄 문틀에 유리 문짝이 안쪽(동쪽 기둥)으로 열려 붙은 회의실 문. 가운데로 바닥이 보이고 지나간다.')
def _glass_door(c):
    _door_frame(c, 'tekko')
    rc(c, 9, 4, 4, 26, kc('garasu', 2)); vl(c, 9, 4, 26, kc('tekko', 3)); vl(c, 10, 6, 10, kc('shiro', 3)); hl(c, 9, 17, 4, kc('shiro', 1))   # 열린 유리 문짝
    rc(c, 10, 14, 1, 4, kc('tekko', 4))
    rc(c, 3, 29, 10, 3, kc('tekko', 2)); hl(c, 3, 29, 10, kc('tekko', 4)); hl(c, 3, 31, 10, kc('tekko', -2))


@R.obj('of-fire-door', '비상계단 철문(열림)', kind='door', use=('travel', 'open'), tags=TAGS + ('비상구', '문'),
       place='사무층·로비와 비상계단통 사이 가로 칸막이의 1칸 틈 칸',
       desc='회색 철제 방화문이 열려 문틀 옆에 붙어 있는 비상계단 출입구. 두꺼운 문짝 옆면과 레버 손잡이, 철 문턱.')
def _fire_door(c):
    _door_frame(c, 'conc')
    rc(c, 3, 4, 4, 26, kc('conc', 1)); vl(c, 3, 4, 26, kc('conc', 3)); vl(c, 6, 4, 26, kc('conc', -2)); rc(c, 5, 15, 2, 2, kc('tekko', 4))   # 열린 문짝(서쪽)
    hl(c, 3, 4, 4, kc('conc', 4))
    rc(c, 3, 29, 10, 3, kc('tekko', 1)); hl(c, 3, 29, 10, kc('tekko', 3)); hl(c, 3, 31, 10, kc('tekko', -2))


@R.obj('of-window-blind', '블라인드 창', w=2, kind='hang', hrows=2, tags=TAGS + ('창',),
       place='사무실·회의실 북쪽 벽면 윗줄(가구 위)',
       desc='알루미늄 틀 창에 흰 가로 블라인드가 2/3 내려와 있고 아래로 하늘이 보인다. 2칸.')
def _blind(c):
    rc(c, 1, 2, 30, 24, kc('sora', 2)); outline(c, 0, 1, 32, 26, kc('tekko', 1)); hl(c, 0, 1, 32, kc('tekko', 4))
    for y in range(3, 19, 2): hl(c, 1, y, 30, kc('shiro', 3)); hl(c, 1, y + 1, 30, kc('conc', 3))
    hl(c, 1, 19, 30, kc('conc', 1)); vl(c, 15, 2, 24, kc('tekko', 2)); vl(c, 16, 2, 24, kc('tekko', 0))
    for i in range(4): px(c, 4 + i, 24 - i, kc('sora', 4)); px(c, 20 + i, 24 - i, kc('sora', 4))
    rc(c, 0, 26, 32, 2, kc('tekko', 3)); hl(c, 0, 27, 32, kc('tekko', 0))


# ══ 급탕실·휴게 ═════════════════════════════════════════════════════════════
@R.obj('of-pantry-sink', '급탕실 개수대·전기 포트', w=2, h=1, up=16, kind='wall', surface=False, use=('search',), tags=TAGS + ('급탕실', '給湯室'),
       place='급탕실 북쪽 벽 아래', desc='흰 타일 벽 앞 스테인리스 개수대 2칸 — 개수구와 꺾인 수도꼭지, 오른쪽에 흰 전기 포트와 머그 둘, 아래 흰 수납장 문.')
def _sink(c):
    rc(c, 0, 0, 32, 12, kc('shiro', 2))
    for x in range(0, 32, 6): vl(c, x, 0, 12, kc('shiro', 1))
    for y in (4, 8): hl(c, 0, y, 32, kc('shiro', 1))
    rc(c, 0, 12, 32, 6, kc('tekko', 3)); hl(c, 0, 12, 32, kc('tekko', 4)); hl(c, 0, 17, 32, kc('tekko', 4))   # 상판
    rc(c, 3, 13, 12, 4, kc('tekko', 0)); hl(c, 3, 13, 12, kc('tekko', -2)); px(c, 9, 15, kc('yoru', -1))     # 개수구
    vl(c, 9, 7, 6, kc('tekko', 4)); hl(c, 9, 7, 3, kc('tekko', 4)); px(c, 11, 8, kc('tekko', 1))            # 수도꼭지
    rc(c, 20, 7, 6, 8, kc('shiro', 3)); hl(c, 20, 7, 6, kc('shiro', 4)); rc(c, 20, 14, 6, 2, kc('yoru', 0)); rc(c, 26, 9, 2, 3, kc('shiro', 1)); outline(c, 19, 6, 8, 10)   # 전기 포트
    rc(c, 28, 12, 3, 3, kc('aka', 1)); px(c, 28, 12, kc('aka', 3))
    rc(c, 0, 18, 32, 14, kc('shiro', 1)); vl(c, 15, 18, 14, kc('conc', 2)); vl(c, 16, 18, 14, kc('shiro', 3))
    hl(c, 0, 18, 32, kc('conc', 1)); rc(c, 12, 22, 2, 3, kc('tekko', 2)); rc(c, 18, 22, 2, 3, kc('tekko', 2))
    hl(c, 0, 31, 32, kc('conc', -2)); outline(c, 0, 0, 32, 32, kc('conc', -2))


@R.obj('of-fridge-small', '소형 냉장고', w=1, h=1, up=8, kind='wall', use=('open',), tags=TAGS + ('급탕실',),
       place='급탕실 개수대 옆 벽', desc='흰 소형 냉장고(높이 0.85m) — 윗면, 위 작은 냉동칸과 아래 문, 세로 손잡이.')
def _fridge(c):
    rc(c, 1, 8, 14, 4, kc('shiro', 3)); hl(c, 1, 8, 14, kc('shiro', 4)); hl(c, 1, 11, 14, kc('shiro', 4))
    rc(c, 1, 12, 14, 19, kc('shiro', 1)); vl(c, 1, 12, 19, kc('shiro', 3)); vl(c, 14, 12, 19, kc('conc', 2))
    hl(c, 1, 12, 14, kc('conc', 2)); hl(c, 1, 17, 14, kc('conc', 1)); vl(c, 12, 14, 2, kc('tekko', 2)); vl(c, 12, 20, 7, kc('tekko', 2))
    hl(c, 1, 31, 14, kc('conc', -2)); outline(c, 0, 7, 16, 25, kc('conc', -2))


@R.obj('of-vending', '음료 자판기', w=1, h=1, up=24, kind='wall', use=('search',), tags=TAGS + ('휴게', '자판기'),
       place='휴게 코너·엘리베이터 홀 북쪽 벽 아래',
       desc='빨간 음료 자판기(높이 1.8m) — 진열창에 색색 캔이 3단, 단마다 작은 버튼 점, 동전 투입구와 아래 꺼내는 칸. 글자·상표 없음.')
def _vending(c):
    rc(c, 0, 8, 16, 4, kc('aka', 1)); hl(c, 0, 8, 16, kc('aka', 2)); hl(c, 0, 11, 16, kc('aka', 2))
    rc(c, 0, 12, 16, 36, kc('aka', 0)); vl(c, 0, 12, 36, kc('aka', 1)); vl(c, 15, 12, 36, kc('aka', -2)); hl(c, 0, 12, 16, kc('aka', -2))
    rc(c, 2, 14, 12, 19, kc('shiro', 2)); outline(c, 1, 13, 14, 21, kc('aka', -2))
    cans = ('sora', 'kii', 'midori', 'daidai', 'kon', 'shiro')
    for r in range(3):
        y = 15 + r * 6
        for i in range(4):
            col = cans[(i + r) % 6]; x = 3 + i * 3
            rc(c, x, y, 2, 4, kc(col, 1)); px(c, x, y, kc(col, 2)); px(c, x, y + 3, kc(col, -1))
        for i in range(4): px(c, 3 + i * 3, y + 4, kc('kii', 3) if (i + r) % 3 == 0 else kc('conc', 2))
    vl(c, 2, 14, 19, kc('shiro', 4))
    rc(c, 10, 35, 3, 4, kc('yoru', 0)); px(c, 11, 36, kc('tekko', 4))                                        # 투입구
    rc(c, 3, 41, 10, 4, kc('yoru', -2)); hl(c, 3, 41, 10, kc('aka', -2))                                      # 꺼내는 칸
    hl(c, 0, 47, 16, OL); outline(c, 0, 8, 16, 40, kc('aka', -2))


@R.table('of-break-table', '휴게 탁자', desc='밝은 나무 상판에 흰 모서리 띠, 양 끝 철제 다리의 휴게 코너 탁자. 어떤 w×h 로도 이어 붙는다.', tags=TAGS + ('휴게', '급탕실'))
def _break(c, w, h):
    W, H = w * 16, h * 16
    ty1 = H - 9
    c.R(0, 1, W, ty1, K('yuka', 3)); c.HL(0, 1, W, K('yuka', 3))
    for y in range(4, ty1, 4):
        for x in range(0, W, 16): c.HL(x + (3 if (y // 4) % 2 else 10), y, 4, K('yuka', 2))
    c.R(0, ty1 + 1, W, 3, K('shiro', 1)); c.HL(0, ty1 + 1, W, K('shiro', 3)); c.HL(0, ty1 + 3, W, K('conc', 1))
    c.HL(0, 0, W, OL); c.HL(0, ty1 + 4, W, OL); c.VL(0, 0, ty1 + 5, OL); c.VL(W - 1, 0, ty1 + 5, OL)
    for x0 in (1, W - 3):
        c.R(x0, ty1 + 5, 2, H - ty1 - 5, K('tekko', 1)); c.VL(x0, ty1 + 5, H - ty1 - 5, K('tekko', 3))


@R.obj('of-stool', '둥근 스툴', w=1, h=1, up=0, kind='floor', use=('sit',), tags=TAGS + ('휴게', '의자'),
       place='휴게 탁자 둘레', desc='초록 둥근 좌판에 철제 다리 넷의 등받이 없는 스툴. 어느 쪽에서나 앉는다.')
def _stool(c):
    disc(c, 8, 6, 5.5, 3.2, kc('midori', -1)); disc(c, 8, 5.5, 4.8, 2.6, kc('midori', 1)); disc(c, 7, 5, 2.5, 1.2, kc('midori', 2))
    rc(c, 3, 8, 10, 2, kc('midori', -1)); hl(c, 3, 9, 10, kc('midori', -2))
    for x in (4, 11): vl(c, x, 10, 5, kc('tekko', 2)); px(c, x, 15, OL)
    for x in (6, 9): vl(c, x, 10, 4, kc('tekko', 0))
    hl(c, 4, 12, 8, kc('tekko', 1))
    for (x, y) in ((3, 4), (12, 4), (2, 6), (13, 6)): px(c, x, y, OL)
    hl(c, 4, 3, 8, OL); hl(c, 3, 10, 10, OL)


# ══ 비상계단 ═════════════════════════════════════════════════════════════════
@R.obj('of-stairs-up', '비상계단(위)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',), tags=TAGS + ('계단', '비상계단', '階段'),
       place='비상계단통 북쪽 벽 바로 아래(벽 가구 자리). 발칸에 위층으로 가는 links.',
       desc='북쪽 벽을 타고 올라가는 한 칸 폭 콘크리트 비상계단 — 회색 디딤판 끝마다 어두운 미끄럼 막이 줄, 오른쪽에 철제 난간·기둥, 왼쪽 벽 손잡이. 위로 올라가면 위층으로 이동.')
def _stairs(c):
    pw = 16; R0 = pw - 6
    c.R(0, 0, pw, 48, OL)
    c.R(1, 0, pw - 2, 5, K('yoru', -2)); c.R(1, 4, pw - 2, 2, K('yoru', 0))
    tx, tw = 3, R0 - 3
    for i in range(8):
        yb = 46 - 5 * i; dim = 1 if i >= 6 else 0
        c.R(tx, yb - 4, tw, 2, K('conc', 3 - dim)); c.HL(tx, yb - 4, tw, K('conc', 4 - dim))
        c.R(tx, yb - 2, tw, 1, K('yoru', 0)); c.R(tx, yb - 1, tw, 2, K('conc', 0 - dim))
        c.HL(tx, yb + 1, tw, K('conc', -3))
    c.R(1, 6, 2, 41, K('conc', -1)); c.VL(2, 6, 41, K('conc', 0)); c.VL(1, 8, 34, K('tekko', 3))
    NT = 30
    c.R(R0, 6, 1, NT - 6, K('tekko', -2)); c.R(R0 + 1, 6, 2, NT - 6, K('yoru', -2))
    for y in range(8, NT - 2, 5): c.R(R0 + 1, y, 2, 3, K('tekko', 1)); c.HL(R0 + 1, y, 2, K('tekko', 3))
    c.R(R0 + 3, 6, 2, NT - 6, K('tekko', 2)); c.VL(R0 + 3, 6, NT - 6, K('tekko', 4)); c.VL(R0 + 4, 6, NT - 6, K('tekko', 0))
    c.R(R0, NT, 6, 3, OL); c.R(R0 + 1, NT, 4, 2, K('tekko', 3))
    c.R(R0 + 1, NT + 3, 4, 47 - NT - 3, K('tekko', 1)); c.VL(R0 + 1, NT + 3, 47 - NT - 3, K('tekko', 3)); c.VL(R0 + 4, NT + 3, 47 - NT - 3, K('tekko', -2))
    c.R(R0, NT + 3, 1, 47 - NT - 3, OL); c.HL(R0, 47, 6, OL); c.HL(0, 47, pw, OL)


@R.obj('of-stairwell-down', '비상계단 내려가는 구멍(철 난간)', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)),
       tags=TAGS + ('계단', '비상계단', '階段', '난간'),
       place='위층 비상계단통 한쪽. 아래층 비상계단(of-stairs-up)과 x 를 맞춘다.',
       desc='위층 바닥에 뚫린 콘크리트 비상계단 구멍과 철제 난간. 북·동·서가 난간, 남쪽이 열린 입구. 2×2. 윗줄(난간)은 막히고 아랫줄 두 칸은 밟는다 — 그 칸에 아래층으로 가는 links 를 단다.')
def _well(c):
    c.R(1, 18, 30, 29, OL); c.R(3, 20, 26, 24, K('yoru', -2))
    for i in range(6):
        y = 22 + i * 4
        c.R(4, y, 24, 2, K('conc', 2 - i)); c.HL(4, y, 24, K('conc', 3 - i)); c.HL(4, y + 1, 24, K('yoru', 0) if i < 3 else K('yoru', -1))
        c.R(4, y + 2, 24, 2, K('yoru', -2))
    c.R(1, 44, 30, 3, K('conc', 1)); c.HL(1, 44, 30, K('conc', 3)); c.HL(1, 46, 30, K('conc', -2)); c.HL(1, 47, 30, K('conc', -3))
    c.R(2, 17, 28, 2, K('tekko', 3)); c.HL(2, 17, 28, K('tekko', 4)); c.R(2, 19, 28, 1, K('tekko', -2))
    for x in (6, 11, 16, 21, 26): c.R(x, 19, 1, 3, K('tekko', 1))
    for x in (1, 29):
        c.R(x, 18, 2, 27, K('tekko', 1)); c.VL(x, 18, 27, K('tekko', 3))
        c.R(x - 1 if x == 1 else x, 6, 3, 40, K('tekko', -2)); c.R(x, 7, 1, 38, K('tekko', 2))
        c.R(x - 1 if x == 1 else x, 4, 3, 2, K('tekko', 4))


# ══ 탁상 물건(R.good, 16×16) ═════════════════════════════════════════════════
@R.good('of-phone', '사무 전화기', desc='검회색 사무 전화기 — 왼쪽에 수화기, 오른쪽에 버튼 점 판(숫자 없음). 접수 카운터·과장 책상 위.')
def _phone(c):
    rc(c, 2, 6, 12, 7, kc('yoru', 0)); hl(c, 2, 6, 12, kc('yoru', 2)); outline(c, 1, 5, 14, 9)
    rc(c, 2, 4, 5, 3, kc('yoru', 1)); hl(c, 2, 4, 5, kc('yoru', 3)); outline(c, 1, 3, 7, 5)
    for r in range(3):
        for k in range(3): px(c, 9 + k * 2, 7 + r * 2, kc('conc', 4))
    rc(c, 3, 9, 4, 2, kc('sora', 1)); hl(c, 2, 13, 12, kc('yoru', -2))


@R.good('of-name-card-box', '명함 상자', desc='작은 투명 명함 받침에 흰 명함 몇 장과 볼펜 한 자루. 접수 카운터 위.')
def _cards(c):
    rc(c, 4, 7, 8, 5, kc('garasu', 2)); outline(c, 3, 6, 10, 7, kc('garasu', -2))
    for i in range(3): hl(c, 5 + i, 8 + i, 6, kc('shiro', 4 if i == 2 else 3))
    hl(c, 5, 10, 6, kc('conc', 2))
    rc(c, 11, 12, 4, 1, kc('kon', 1)); px(c, 14, 12, kc('aka', 1)); hl(c, 3, 13, 10, kc('garasu', -1))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

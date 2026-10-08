#!/usr/bin/env python3
"""jp_city 일본 실내 — 우체국·맨션 공용부. id 머리 `po-`(우체국)·`mc-`(맨션 공용부).

칸 16px = 1m, 3/4 시점(윗면 + 남쪽 앞면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만. 글자·숫자·상표·〒 기호·사람 없음.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, door = 16×32.

크기(§12-3 공식, 1칸 = 1m): 창구 카운터 높이 약 1m(상판 + 위로 아크릴 칸막이 0.5m → up 8) · 번호표 기계·ATM·오토록 1.4~1.6m(up 16) ·
기재대 1m 서서 쓰는 높이(up 8) · 대기 벤치 2m 폭 등받이(up 16) · 사서함·구분 선반 1.6m(up 16) · 우편 수레 0.9m(up 8) ·
엘리베이터 문 2.1m 문 + 표시등(up 32) · 택배 보관함 1.8m(up 32) · 계단 벽 속으로 오름(up 32) · 자전거 1.7m 길이 → 1칸 세로로 꽉(up 8).

분류는 interior/categories.py(post·mansion-common).
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT

BLOCK = 'interior_post'
R = Registry(BLOCK, '우체국·맨션 공용부')

PO, PO_KO = 'post', '우체국'
MC, MC_KO = 'mansion-common', '맨션 공용부'


# ── 도우미 ────────────────────────────────────────────────────────────────────
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


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def tall_box(c, x, y, w, h, ramp, t=0, top=4):
    """벽 붙은 키 큰 가구 몸통: 윗면 top px(밝음) + 앞 가장자리 하이라이트 1행 + 앞면. (x,y) = 윗면 왼위."""
    rc(c, x, y, w, top, kc(ramp, t + 2)); hl(c, x, y, w, kc(ramp, t + 1))
    hl(c, x, y + top, w, kc(ramp, t + 3))                                                              # 앞 가장자리 하이라이트
    rc(c, x, y + top + 1, w, h - top - 1, kc(ramp, t))
    vl(c, x, y + top + 1, h - top - 1, kc(ramp, t + 1)); vl(c, x + w - 1, y + top + 1, h - top - 1, kc(ramp, t - 1))
    outline(c, x, y, w, h)


def eave(c, x, y, w, ramp, t=0):
    """키 큰 가구 윗면 바로 밑 처마 그림자 2px."""
    hl(c, x + 1, y, w - 2, kc(ramp, t - 2)); hl(c, x + 1, y + 1, w - 2, kc(ramp, t - 1))


# ══ 우체국 바닥·벽 ═══════════════════════════════════════════════════════════
@R.floor('po-floor', '우체국 비닐 타일(연베이지)', cols=2, rows=2, tags=('우체국', '로비', '창구'),
         desc='연베이지·크림 16px 비닐 타일이 체크로 이어지고 드문 점 얼룩이 있는 바닥. 우체국 로비·창구 안쪽 바닥.')
def _po_floor(c):
    for by in (0, 1):
        for bx in (0, 1):
            a = (bx + by) % 2 == 0
            rc(c, bx * 16, by * 16, 16, 16, kc('kinari', 1) if a else kc('yuka', 2))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 11, 26): px(c, x, y, kc('kinari', 0) if ((x // 16) + (y // 16)) % 2 == 0 else kc('yuka', 1))
    for o in (0, 16):
        hl(c, 0, o, 32, kc('kinari', 0)); vl(c, o, 0, 32, kc('kinari', 0))                             # 줄눈
        hl(c, 1, o + 1, 31, kc('kinari', 2) if o == 0 else kc('yuka', 2))


@R.floor('po-back-floor', '우체국 작업실 바닥(회색)', cols=2, rows=2, tags=('우체국', '작업실'),
         desc='짙지 않은 회색 비닐 시트에 바퀴 자국 같은 옅은 결이 있는 작업실 바닥. 우체국 뒤 구분 작업실.')
def _po_back(c):
    rc(c, 0, 0, 32, 32, kc('conc', 0))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 13, 40): px(c, x, y, kc('conc', -1))
            elif rnd(x, y, 14, 18): px(c, x, y, kc('conc', 1))
    for x in (5, 21): vl(c, x, 0, 32, kc('conc', -1))                                                 # 수레 바퀴 자국(세로)
    hl(c, 0, 0, 32, kc('conc', -1)); vl(c, 0, 0, 32, kc('conc', -1))


@R.wall('po-wall', '우체국 벽(흰 벽 + 빨강 띠)', cols=2, tags=('우체국',),
        desc='흰 벽면 허리 높이에 우체국 빨강 띠 한 줄, 아래 회색 걸레받이. 로고·기호 없음. 우체국 로비·창구 벽.')
def _po_wall(c):
    rc(c, 0, 0, 32, 27, kc('shiro', 0))
    for x in (0, 16): vl(c, x, 0, 27, kc('shiro', -1))                                                # 벽판 이음
    for y in range(27):
        for x in range(32):
            if rnd(x, y, 21, 20): px(c, x, y, kc('shiro', 1))
    hl(c, 0, 17, 32, kc('aka', 1)); rc(c, 0, 18, 32, 3, kc('aka', 0)); hl(c, 0, 21, 32, kc('aka', -1))   # 빨강 띠
    hl(c, 0, 26, 32, kc('conc', 2)); rc(c, 0, 27, 32, 5, kc('conc', 0)); hl(c, 0, 27, 32, kc('conc', 1)); hl(c, 0, 31, 32, kc('conc', -2))


# ══ 우체국 창구 ═══════════════════════════════════════════════════════════════
def _counter_body(c):
    """창구 카운터 한 칸 아래 16px(발밑): 상판 + 앞면. 캔버스 16×32 — 위 16px 은 솟는 부분."""
    rc(c, 0, 16, 16, 7, kc('shiro', 1)); hl(c, 0, 16, 16, kc('shiro', 2)); hl(c, 0, 22, 16, kc('shiro', 2))   # 상판(손님 쪽 앞 모서리 밝음)
    hl(c, 0, 23, 16, kc('conc', -1))
    rc(c, 0, 24, 16, 8, kc('yuka', 1)); hl(c, 0, 24, 16, kc('yuka', 2))                               # 나무 앞판
    hl(c, 0, 27, 16, kc('aka', 0)); hl(c, 0, 28, 16, kc('aka', -1))                                   # 빨강 줄
    vl(c, 0, 24, 8, kc('yuka', 2)); vl(c, 15, 24, 8, kc('yuka', 0))
    hl(c, 0, 31, 16, kc('yuka', -2))


@R.obj('po-counter', '창구 카운터(아크릴 칸막이)', w=1, h=1, up=8, kind='floor', cat=PO, cat_ko=PO_KO, surface=True, use=('counter',),
       tags=('우체국', '창구'), place='창구 줄 — 로비와 창구 안쪽 사이를 가로로 이어 붙인다(창구 하나 = 한 칸)', pair=('po-counter-end', 'po-parcel-scale', 'po-envelope'),
       desc='우체국 창구 카운터 한 칸 — 흰 상판, 나무 앞판에 빨강 줄, 상판 가운데에 투명 아크릴 칸막이(아래 서류 구멍). 가로로 3칸쯤 이어 붙이고 앞(남쪽) 두 줄은 손님 자리로 비운다. 상판에 봉투·우표를 놓는다.')
def _po_counter(c):
    _counter_body(c)
    hl(c, 1, 7, 14, kc('shiro', 1)); hl(c, 1, 8, 14, kc('garasu', 2))                                # 투명 아크릴 판 — 윗변·옆변만, 속은 비친다
    vl(c, 1, 8, 10, kc('garasu', 2)); vl(c, 14, 8, 10, kc('garasu', 1))
    for i in range(4): px(c, 4 + i, 13 - i, kc('shiro', 1))                                           # 반사 사선 둘
    for i in range(2): px(c, 9 + i, 13 - i, kc('garasu', 2))
    hl(c, 2, 17, 3, kc('garasu', 1)); hl(c, 11, 17, 3, kc('garasu', 1))                               # 아래 서류 구멍 양옆 판 끝
    hl(c, 1, 18, 4, kc('tekko', 0)); hl(c, 11, 18, 4, kc('tekko', 0))                                 # 판 받침
    rc(c, 2, 19, 3, 2, kc('kon', 0)); px(c, 2, 19, kc('kon', 1))                                      # 손님 쪽 펜 받침


@R.obj('po-parcel-scale', '소포 창구(저울)', w=1, h=1, up=8, kind='floor', cat=PO, cat_ko=PO_KO, surface=False, use=('counter',),
       tags=('우체국', '창구', '소포'), place='창구 줄 한쪽 끝 칸(소포 창구)', pair=('po-counter', 'po-parcel'),
       desc='소포를 다는 창구 카운터 한 칸 — 상판에 넓은 은색 저울 판과 작은 어두운 표시창(숫자 없음, 초록 점). 아크릴 칸막이는 없다. 창구 카운터 줄에 이어 붙인다.')
def _po_scale(c):
    _counter_body(c)
    rc(c, 9, 11, 5, 5, kc('tekko', 0)); hl(c, 9, 11, 5, kc('tekko', 1)); outline(c, 8, 10, 7, 7)       # 작은 표시창(저울 뒤)
    rc(c, 10, 12, 3, 2, kc('kokuban', -2)); px(c, 11, 12, kc('midori', 1))
    rc(c, 2, 16, 12, 6, kc('tekko', 1)); hl(c, 2, 16, 12, kc('tekko', 3)); vl(c, 2, 16, 6, kc('tekko', 3))   # 저울 판
    for x in range(4, 13, 3): vl(c, x, 17, 4, kc('tekko', 0))
    outline(c, 1, 15, 14, 8, kc('tekko', -2))


@R.obj('po-counter-end', '창구 끝 여닫이 칸', w=1, h=1, up=0, kind='floor', cat=PO, cat_ko=PO_KO, walk=[(0, 0)], use=('walk',),
       tags=('우체국', '창구', '직원'), place='창구 카운터 줄의 맨 끝 한 칸 — 창구 안쪽과 로비를 잇는 직원 길', pair=('po-counter',),
       desc='카운터 줄 끝의 여닫이 칸 — 카운터 끝 마구리와 반쯤 열린 낮은 나무 문짝이 바닥에 보인다. 밟고 지나간다(직원 길).')
def _po_end(c):
    # 칸 안쪽(2~13px)에만 그린다 — 서쪽 벽 쪽으로 번지지 않게. 위로 젖혀 연 판은 동쪽(창구 카운터 쪽) 경첩에 붙는다.
    rc(c, 10, 2, 3, 11, kc('yuka', 2)); vl(c, 10, 2, 11, kc('yuka', 3)); vl(c, 12, 2, 11, kc('yuka', 0))   # 젖혀 세운 여닫이 판(윗변)
    outline(c, 9, 1, 5, 13)
    rc(c, 10, 12, 3, 1, kc('aka', 0))                                                                 # 판 끝 빨강 줄(카운터 앞판과 같은 색)
    px(c, 13, 3, kc('tekko', 2)); px(c, 13, 10, kc('tekko', 2))                                        # 경첩
    vl(c, 8, 2, 12, kc('kinari', 0))                                                                  # 판 그늘
    hl(c, 2, 14, 12, kc('kinari', 2)); hl(c, 2, 15, 12, kc('kinari', 0))                              # 문턱 줄


@R.obj('po-ticket-machine', '번호표 기계', w=1, h=1, up=16, kind='floor', cat=PO, cat_ko=PO_KO, use=('push',),
       tags=('우체국', '로비', '번호표'), place='입구 안쪽, 창구로 가는 길 옆 한 칸', pair=('po-bench-n',),
       desc='받침대 위에 선 번호표 기계 — 흰 몸통, 빨강 머리판, 버튼 셋(색 점)과 표가 나오는 구멍. 숫자·글자 없음. 입구 들어와 창구 앞으로 가는 길 옆에 하나.')
def _po_ticket(c):
    rc(c, 3, 2, 10, 4, kc('aka', 0)); hl(c, 3, 2, 10, kc('aka', 1)); hl(c, 3, 5, 10, kc('aka', -1))    # 머리판
    outline(c, 2, 1, 12, 6)
    tall_box(c, 3, 7, 10, 15, 'shiro', 0, top=2)
    eave(c, 3, 10, 10, 'shiro', 0)
    for i, col in enumerate(('sora', 'midori', 'kii')):                                               # 버튼
        rc(c, 5 + i * 2, 13, 1, 1, kc(col, 1)); px(c, 5 + i * 2, 14, kc(col, -1))
    rc(c, 6, 17, 4, 1, kc('sumi', 0)); px(c, 7, 18, kc('shiro', 2))                                   # 표 구멍 + 나온 표
    rc(c, 7, 22, 2, 6, kc('tekko', 0)); vl(c, 7, 22, 6, kc('tekko', 1))                               # 기둥
    rc(c, 3, 27, 10, 3, kc('tekko', 0)); hl(c, 3, 27, 10, kc('tekko', 2)); outline(c, 2, 27, 12, 4)    # 받침
    hl(c, 3, 31, 10, kc('kinari', -1))


@R.obj('po-atm', 'ATM', w=1, h=1, up=16, kind='wall', cat=PO, cat_ko=PO_KO, use=('push',),
       tags=('우체국', '로비', 'ATM'), place='로비 북쪽 벽 바로 아래, 입구 가까이', pair=('po-po-box',),
       desc='벽에 붙은 ATM 한 대 — 회백 몸통, 위 차양, 비스듬한 화면(밝은 하늘빛)·번호판 점·카드 구멍, 양옆 칸막이. 글자·로고 없음. 입구 가까운 벽에 1~2대.')
def _po_atm(c):
    tall_box(c, 1, 1, 14, 30, 'conc', 1, top=4)
    eave(c, 1, 6, 14, 'conc', 1)
    rc(c, 3, 8, 10, 7, kc('garasu', -1)); rc(c, 4, 9, 8, 5, kc('sora', 1)); hl(c, 4, 9, 8, kc('sora', 2))   # 화면
    rc(c, 5, 11, 3, 1, kc('shiro', 1)); rc(c, 5, 13, 5, 1, kc('sora', 0))
    outline(c, 3, 8, 10, 7, kc('tekko', -2))
    rc(c, 2, 16, 12, 5, kc('conc', 2)); hl(c, 2, 16, 12, kc('conc', 3)); hl(c, 2, 20, 12, kc('conc', -1))   # 앞으로 나온 조작대 윗면
    for j in range(2):
        for i in range(3): px(c, 4 + i * 2, 17 + j * 2, kc('tekko', -1))                              # 번호판
    rc(c, 10, 17, 3, 1, kc('sumi', 0)); px(c, 10, 19, kc('midori', 1))                                # 카드 구멍 · 불
    rc(c, 4, 23, 8, 1, kc('sumi', 0)); hl(c, 4, 24, 8, kc('conc', 2))                                 # 지폐 구멍
    rc(c, 2, 27, 12, 3, kc('conc', -1)); hl(c, 2, 27, 12, kc('conc', 0))


@R.obj('po-writing-desk', '기재대(서서 쓰는 탁자)', w=2, h=1, up=8, kind='floor', cat=PO, cat_ko=PO_KO, surface=True, use=('read',),
       tags=('우체국', '로비', '기재대'), place='로비 가운데나 벽 쪽 — 손님이 남쪽에 서서 쓴다', pair=('po-envelope', 'po-stamp-sheet'),
       desc='손님이 서서 서류를 쓰는 높은 탁자 2칸 — 연한 나무 상판, 뒤쪽 턱에 서류 꽂이(색 칸)·펜 꽂이 둘, 앞판 아래로 철 다리. 로비에 하나, 위에 봉투·우표를 놓는다.')
def _po_desk(c):
    W = 32
    rc(c, 2, 8, 28, 8, kc('kinari', 0)); outline(c, 1, 7, 30, 10)                                     # 뒤 턱(서류 꽂이 판)
    for i, col in enumerate(('aka', 'sora', 'kii', 'midori', 'shiro', 'sora')):                       # 서류 칸
        rc(c, 3 + i * 4, 9, 3, 5, kc(col, 1)); hl(c, 3 + i * 4, 9, 3, kc(col, 2))
    for x in (26, 28): rc(c, x, 6, 1, 4, kc('kon', 0)); px(c, x, 6, kc('kon', 2))                      # 펜 꽂이
    rc(c, 0, 16, W, 8, kc('yuka', 2)); hl(c, 0, 16, W, kc('yuka', 1)); hl(c, 0, 17, W, kc('kinari', 2))   # 상판
    for y in range(18, 23):
        for x in range(W):
            if rnd(x, y, 31, 60): px(c, x, y, kc('yuka', 1))
    hl(c, 0, 23, W, kc('yuka', 2)); hl(c, 0, 24, W, kc('yuka', 0))                                    # 앞 모서리
    rc(c, 1, 25, 30, 2, kc('yuka', 0)); hl(c, 1, 26, 30, kc('yuka', -1))
    for x in (3, 27): rc(c, x, 27, 2, 4, kc('tekko', 0)); vl(c, x, 27, 4, kc('tekko', 2))              # 다리
    hl(c, 2, 31, 28, kc('kinari', -1))
    outline(c, 0, 16, W, 11)


def _bench(c, d):
    m = 'kon'
    W = 32
    if d == 's':
        bev(c, 1, 8, 30, 9, m, 0)                                                                     # 낮은 등받이(뒤·북쪽)
        vl(c, 15, 9, 7, kc(m, -1)); vl(c, 16, 9, 7, kc(m, 1))
        bev(c, 1, 16, 30, 8, m, 1)                                                                    # 좌석 윗면
        vl(c, 15, 17, 6, kc(m, -1))
        hl(c, 2, 24, 28, kc(m, -2)); rc(c, 2, 25, 28, 2, kc(m, -1))                                   # 좌석 앞면
    else:
        bev(c, 1, 10, 30, 8, m, 1)                                                                    # 좌석 윗면(앞쪽이 북쪽)
        bev(c, 1, 16, 30, 11, m, 0)                                                                   # 낮은 등받이 뒷면이 좌석 앞을 가림
        vl(c, 15, 17, 9, kc(m, -1)); vl(c, 16, 17, 9, kc(m, 1))
        hl(c, 2, 26, 28, kc(m, -2))
    for x in (3, 27): rc(c, x, 27, 2, 4, kc('tekko', 0)); vl(c, x, 27, 4, kc('tekko', 2)); hl(c, x - 1, 31, 4, OL)
    hl(c, 5, 30, 22, kc('tekko', -1))


for _d, _ko, _f in (('n', '북향', 'N'), ('s', '남향', 'S')):
    def _reg(d=_d, ko=_ko, f=_f):
        @R.obj('po-bench-' + d, '대기 벤치 2인(%s)' % ko, w=2, h=1, up=8, kind='floor', cat=PO, cat_ko=PO_KO, use=('sit',), facing=f,
               tags=('우체국', '로비', '대기'), place='로비 — 창구를 보고(북향) 기재대·번호표 기계 곁에 1~2개', pair=('po-ticket-machine',),
               desc='감색 비닐 대기 벤치 2인용(2칸) — %s을 보고 앉는다. %s 철 다리.' % (ko, '낮은 등받이가 좌석 뒤(북쪽)에 서고 좌석 앞면이 보인다.' if d == 's' else '낮은 등받이 뒷면이 남쪽에 서서 좌석 앞을 가린다.'))
        def _fn(c): _bench(c, d)
    _reg()


@R.obj('po-po-box', '사서함 벽', w=2, h=1, up=16, kind='wall', cat=PO, cat_ko=PO_KO, use=('open',),
       tags=('우체국', '로비', '사서함'), place='로비 북쪽 벽 바로 아래(ATM 곁)', pair=('po-atm',),
       desc='작은 은색 문이 4열 5단으로 칸칸이 붙은 사서함 벽 2칸 — 문마다 열쇠 구멍 점, 위 윗면과 처마 그림자. 숫자·글자 없음.')
def _po_box(c):
    W = 32
    tall_box(c, 0, 2, W, 30, 'tekko', 1, top=4)
    eave(c, 0, 7, W, 'tekko', 1)
    for r in range(5):
        for col in range(4):
            x, y = 2 + col * 7, 9 + r * 4
            rc(c, x, y, 6, 3, kc('tekko', 2)); hl(c, x, y, 6, kc('tekko', 3)); hl(c, x, y + 2, 6, kc('tekko', 0))
            px(c, x + 4, y + 1, kc('sumi', 0))
    hl(c, 1, 29, 30, kc('tekko', -1)); rc(c, 1, 30, 30, 1, kc('tekko', 0))


@R.obj('po-poster', '게시 포스터', w=1, kind='hang', hrows=2, cat=PO, cat_ko=PO_KO, use=('read',),
       tags=('우체국', '게시'), place='로비·창구 벽면 윗줄',
       desc='벽에 붙인 안내 포스터 한 장 — 흰 종이에 빨강·하늘 색 덩이와 회색 줄뿐(글자·로고 없음), 네 귀 핀. 벽면 윗줄에 하나씩.')
def _po_poster(c):
    rc(c, 3, 4, 10, 15, kc('shiro', 2)); outline(c, 2, 3, 12, 17, kc('shiro', -2))
    rc(c, 4, 5, 8, 5, kc('aka', 1)); hl(c, 4, 5, 8, kc('aka', 2)); rc(c, 6, 7, 4, 2, kc('shiro', 2))
    rc(c, 4, 11, 5, 3, kc('sora', 2)); hl(c, 4, 15, 8, kc('conc', 0)); hl(c, 4, 17, 6, kc('conc', 0))
    for (x, y) in ((3, 4), (12, 4), (3, 18), (12, 18)): px(c, x, y, kc('aka', 0))
    hl(c, 3, 20, 10, kc('shiro', -1))                                                                 # 종이 밑 그림자


@R.obj('po-staff-desk', '직원 책상', w=2, h=1, up=16, kind='floor', cat=PO, cat_ko=PO_KO, surface=True, use=('read',),
       tags=('우체국', '창구', '직원'), place='창구 안쪽, 창구 카운터 뒤 북쪽 벽 앞', pair=('po-counter', 'po-envelope'),
       desc='회색 철제 사무 책상 2칸 — 뒤쪽에 모니터와 서류 상자가 솟고 상판에 키보드, 앞판에 서랍. 창구 뒤 직원 자리에 1~2개, 위에 봉투·소포를 놓는다.')
def _po_staff(c):
    W = 32
    bev(c, 3, 3, 12, 11, 'tekko', -1)                                                                 # 모니터
    rc(c, 5, 5, 8, 7, kc('garasu', -1)); hl(c, 5, 5, 8, kc('sora', 1)); rc(c, 6, 7, 5, 1, kc('shiro', 0)); rc(c, 6, 9, 4, 1, kc('shiro', -1))
    rc(c, 8, 14, 2, 2, kc('tekko', -1))
    rc(c, 19, 7, 10, 9, kc('kinari', 0)); hl(c, 19, 7, 10, kc('kinari', 1)); outline(c, 18, 6, 12, 10)   # 서류 상자
    for x in (21, 24, 27): vl(c, x, 8, 7, kc('shiro', 1))
    rc(c, 0, 16, W, 8, kc('conc', 1)); hl(c, 0, 16, W, kc('conc', 2)); vl(c, 0, 16, 8, kc('conc', 2))   # 상판
    rc(c, 4, 18, 11, 4, kc('shiro', 1)); hl(c, 5, 19, 9, kc('conc', 0)); hl(c, 5, 21, 9, kc('conc', 0)); outline(c, 3, 17, 13, 6, kc('conc', -2))
    hl(c, 0, 23, W, kc('conc', 3))                                                                    # 앞 가장자리
    rc(c, 0, 24, W, 7, kc('conc', -1)); hl(c, 0, 24, W, kc('conc', 0))
    rc(c, 18, 25, 12, 5, kc('conc', 0)); outline(c, 17, 24, 14, 7, kc('conc', -3)); rc(c, 22, 27, 4, 1, kc('tekko', 2))   # 서랍
    outline(c, 0, 16, W, 16)


# ══ 우체국 작업실 ═════════════════════════════════════════════════════════════
@R.obj('po-sorting-shelf', '우편 구분 선반', w=2, h=1, up=16, kind='wall', cat=PO, cat_ko=PO_KO, use=('search',),
       tags=('우체국', '작업실', '구분'), place='뒤 작업실 북쪽 벽 바로 아래', pair=('po-mail-cart', 'po-mail-bag'),
       desc='나무 칸칸 구분 선반 2칸 — 5열 4단 작은 칸마다 흰·연한 색 편지 묶음이 꽂혀 있다. 위 윗면과 처마 그림자. 우편을 동네별로 나누는 선반.')
def _po_sort(c):
    W = 32
    tall_box(c, 0, 2, W, 30, 'yuka', 0, top=4)
    eave(c, 0, 7, W, 'yuka', 0)
    for r in range(4):
        y = 9 + r * 5
        for col in range(5):
            x = 2 + col * 6
            rc(c, x, y, 5, 4, kc('yuka', -2))
            n = hs(col, r, 3) % 3
            for k in range(n + 1):
                rc(c, x + 1 + k, y + 1, 1, 3, kc('shiro', 2 if k % 2 == 0 else 1) if (col + r) % 4 else kc('sora', 2))
        hl(c, 1, y + 4, 30, kc('yuka', 1))
    for col in range(6): vl(c, 1 + col * 6, 8, 22, kc('yuka', 1))


@R.obj('po-mail-cart', '우편 수레', w=1, h=1, up=8, kind='floor', cat=PO, cat_ko=PO_KO, use=('search',),
       tags=('우체국', '작업실'), place='작업실 바닥, 구분 선반 앞', pair=('po-sorting-shelf', 'po-mail-bag'),
       desc='빨강 철 틀에 회색 철망 바구니를 얹은 우편 수레 — 바구니 속 흰 편지 묶음, 아래 바퀴 넷.')
def _po_cart(c):
    rc(c, 1, 9, 14, 4, kc('aka', 0)); hl(c, 1, 9, 14, kc('aka', 1)); outline(c, 0, 8, 16, 6)          # 손잡이·위 테
    rc(c, 2, 13, 12, 10, kc('tekko', 1))                                                              # 바구니 속(위에서)
    for y in range(14, 22):
        for x in range(3, 13):
            if (x + y) % 3 == 0: px(c, x, y, kc('tekko', 2))
    rc(c, 4, 15, 4, 3, kc('shiro', 2)); rc(c, 8, 16, 4, 4, kc('shiro', 1)); hl(c, 8, 16, 4, kc('shiro', 2))   # 편지 묶음
    rc(c, 1, 23, 14, 4, kc('tekko', 0)); hl(c, 1, 23, 14, kc('aka', 0))                               # 바구니 앞면
    for x in range(3, 14, 3): vl(c, x, 24, 3, kc('tekko', 2))
    outline(c, 1, 13, 14, 14, kc('aka', -2))
    for x in (2, 12): rc(c, x, 28, 2, 3, kc('sumi', 0)); px(c, x, 28, kc('tekko', 1))                  # 바퀴


@R.obj('po-mail-bag', '우편 자루', w=1, h=1, up=0, kind='floor', cat=PO, cat_ko=PO_KO, use=('search',),
       tags=('우체국', '작업실'), place='작업실 구석·수레 곁에 1~3개', pair=('po-mail-cart',),
       desc='묶은 입구가 위로 선 회갈색 천 우편 자루 둘이 기대어 있다. 빨강 끈.')
def _po_bag(c):
    for (x0, y0, w, t) in ((1, 4, 8, 0), (7, 6, 8, -1)):
        disc(c, x0 + w / 2, y0 + 6, w / 2, 5.5, kc('soil', t + 1))
        disc(c, x0 + w / 2 - 1, y0 + 5, w / 2 - 2, 3.5, kc('soil', t + 2))
        rc(c, x0 + w // 2 - 1, y0 - 2, 2, 3, kc('soil', t + 1)); px(c, x0 + w // 2 - 1, y0 - 2, kc('soil', t + 2))   # 묶은 입구
        hl(c, x0 + w // 2 - 2, y0, 4, kc('aka', 0))
        for y in range(y0, y0 + 12):
            for x in range(x0, x0 + w):
                if c.a[min(y, c.h - 1), min(x, c.w - 1), 3] and rnd(x, y, 41, 90): px(c, x, y, kc('soil', t))
    hl(c, 2, 15, 13, kc('soil', -2))


# ══ 우체국 탁상 ═══════════════════════════════════════════════════════════════
@R.good('po-envelope', '봉투 묶음', desc='흰 봉투 서너 장 — 맨 위 한 장은 빨강·감색 사선 테두리(항공 봉투 느낌, 글자 없음).')
def _g_env(c):
    for i, (x, y) in enumerate(((2, 8), (3, 6), (4, 4))):
        rc(c, x, y, 10, 6, kc('shiro', 1 if i < 2 else 2)); hl(c, x, y, 10, kc('shiro', 2)); hl(c, x, y + 5, 10, kc('conc', 0))
    for x in range(4, 14):
        px(c, x, 4, kc('aka', 0) if (x // 2) % 2 else kc('kon', 1)); px(c, x, 9, kc('aka', 0) if (x // 2) % 2 else kc('kon', 1))
    for i in range(4): px(c, 6 + i, 5 + (i if i < 2 else 3 - i), kc('conc', 0))                       # 봉투 덮개 선
    outline(c, 1, 3, 14, 12)


@R.good('po-stamp-sheet', '우표 시트', desc='작은 색 칸이 4×3 으로 줄지은 우표 시트 한 장(그림·숫자 없음, 칸마다 흰 톱니 테).')
def _g_stamp(c):
    rc(c, 2, 4, 12, 9, kc('shiro', 2)); outline(c, 1, 3, 14, 11, kc('conc', -1))
    cols = ('aka', 'sora', 'midori', 'kii')
    for r in range(3):
        for i in range(4):
            rc(c, 3 + i * 3, 5 + r * 3, 2, 2, kc(cols[(i + r) % 4], 1)); px(c, 3 + i * 3, 5 + r * 3, kc(cols[(i + r) % 4], 2))
    hl(c, 2, 14, 12, kc('conc', -1))


@R.good('po-parcel', '소포 상자', desc='갈색 골판지 소포 상자 하나 — 위 윗면 밝고 테이프 한 줄, 옆에 흰 송장(글자 없음).')
def _g_parcel(c):
    rc(c, 2, 3, 12, 5, kc('yuka', 2)); hl(c, 2, 3, 12, kc('kinari', 2)); rc(c, 7, 3, 2, 5, kc('kinari', 1))   # 윗면 + 테이프
    rc(c, 2, 8, 12, 6, kc('yuka', 0)); vl(c, 2, 8, 6, kc('yuka', 1)); hl(c, 2, 8, 12, kc('yuka', 2))
    rc(c, 9, 9, 4, 3, kc('shiro', 2)); hl(c, 10, 10, 2, kc('conc', 0))
    outline(c, 1, 2, 14, 13)


# ══ 맨션 공용부 바닥·벽 ═══════════════════════════════════════════════════════
@R.floor('mc-entrance-tile', '엔트런스 석재 타일', cols=2, rows=2, tags=('맨션', '엔트런스', '로비'),
         desc='짙은 회색 화강암풍 16px 석재 타일 — 판마다 결 점이 다르고 줄눈은 어둡고 가늘다. 맨션 엔트런스·바람막이·엘리베이터 홀 바닥.')
def _mc_tile(c):
    for by in (0, 1):
        for bx in (0, 1):
            a = (bx + by) % 2 == 0
            rc(c, bx * 16, by * 16, 16, 16, kc('hodo', 1))
            for y in range(16):
                for x in range(16):
                    gx, gy = bx * 16 + x, by * 16 + y
                    if rnd(gx, gy, 51, 90 if a else 55): px(c, gx, gy, kc('hodo', 0))
                    elif rnd(gx, gy, 52, 25 if a else 45): px(c, gx, gy, kc('hodo', 2))
            hl(c, bx * 16 + 1, by * 16 + 1, 14, kc('hodo', 2))                            # 윗변 광
    for o in (0, 16): hl(c, 0, o, 32, kc('hodo', -1)); vl(c, o, 0, 32, kc('hodo', -1))


@R.floor('mc-corridor', '외복도 장척 시트', cols=2, rows=1, tags=('맨션', '외복도', '복도'),
         desc='회색 미끄럼 방지 장척 시트 — 가로로 길게 이어지고 잔 엠보 점, 32px 마다 이음선. 맨션 위층 외복도 바닥(배수 줄은 난간 밑).')
def _mc_corr(c):
    rc(c, 0, 0, 32, 16, kc('conc', 0))
    for y in range(16):
        for x in range(32):
            if (x + 2 * y) % 5 == 0 and rnd(x, y, 61, 600): px(c, x, y, kc('conc', 1))
            elif rnd(x, y, 62, 25): px(c, x, y, kc('conc', -1))
    vl(c, 0, 0, 16, kc('conc', -1))


@R.wall('mc-wall', '공용부 벽(타일 판 + 돌 띠)', cols=2, tags=('맨션', '엔트런스', '로비'),
        desc='크림색 큰 타일 판 벽(가로 줄눈) 아래 짙은 석재 띠와 걸레받이. 맨션 엔트런스·바람막이·엘리베이터 홀 벽면.')
def _mc_wall(c):
    rc(c, 0, 0, 32, 22, kc('kinari', 1))
    for y in (0, 11): hl(c, 0, y, 32, kc('kinari', 0)); hl(c, 0, y + 1, 32, kc('kinari', 2))
    for x in (0, 16): vl(c, x, 0, 22, kc('kinari', 0))
    for y in range(22):
        for x in range(32):
            if rnd(x, y, 71, 18): px(c, x, y, kc('kinari', 0))
    hl(c, 0, 22, 32, kc('hodo', 2)); rc(c, 0, 23, 32, 9, kc('hodo', 0))                               # 돌 띠
    for y in range(23, 32):
        for x in range(32):
            if rnd(x, y, 72, 80): px(c, x, y, kc('hodo', -1))
    hl(c, 0, 23, 32, kc('hodo', 1)); hl(c, 0, 31, 32, kc('hodo', -2))


@R.wall('mc-corridor-wall', '외복도 세대 벽(흰 벽 + 기둥)', cols=4, tags=('맨션', '외복도'),
        desc='흰 뿜칠 벽에 가로 판 이음, 4칸마다 세대 사이 콘크리트 기둥이 살짝 앞으로 나온다. 맨션 외복도 북쪽 벽면(세대 현관문·계량기함을 거는 곳).')
def _mc_cwall(c):
    rc(c, 0, 0, 64, 27, kc('shiro', 0))
    for y in range(27):
        for x in range(64):
            if rnd(x, y, 81, 30): px(c, x, y, kc('shiro', -1))
    hl(c, 0, 13, 64, kc('shiro', -1)); hl(c, 0, 14, 64, kc('shiro', 1))
    rc(c, 0, 0, 5, 32, kc('conc', 1)); vl(c, 0, 0, 32, kc('conc', 2)); vl(c, 4, 0, 32, kc('conc', -1)); vl(c, 5, 0, 32, kc('shiro', -2))   # 기둥
    hl(c, 0, 27, 64, kc('conc', 1)); rc(c, 0, 28, 64, 4, kc('conc', -1)); hl(c, 0, 31, 64, kc('conc', -2))


# ══ 맨션 공용부 가구 ═════════════════════════════════════════════════════════
@R.obj('mc-autolock', '오토록 조작반', w=1, h=1, up=16, kind='floor', cat=MC, cat_ko=MC_KO, use=('push',),
       tags=('맨션', '엔트런스', '바람막이', '오토록'), place='바람막이(風除室) 안, 안쪽 자동문 바로 옆 한 칸', pair=('mc-autodoor', 'mc-mailboxes'),
       desc='스테인리스 기둥형 오토록 조작반 — 위에 작은 카메라 점, 어두운 화면(하늘빛 불), 번호 버튼 점 3×4, 열쇠 구멍. 숫자·글자 없음. 안쪽 자동문 옆에 하나.')
def _mc_autolock(c):
    tall_box(c, 3, 2, 10, 27, 'tekko', 1, top=3)
    eave(c, 3, 6, 10, 'tekko', 1)
    px(c, 8, 8, kc('sumi', 0)); px(c, 9, 8, kc('sora', 1))                                           # 카메라
    rc(c, 5, 10, 6, 4, kc('garasu', -1)); hl(c, 5, 10, 6, kc('sora', 1)); px(c, 6, 12, kc('sora', 2))   # 화면
    for j in range(4):
        for i in range(3): px(c, 5 + i * 2, 16 + j * 2, kc('tekko', 3) if (i + j) % 2 else kc('tekko', -1))
    px(c, 9, 24, kc('sumi', 0)); px(c, 9, 25, kc('kii', 1))                                          # 열쇠 구멍 · 불
    rc(c, 2, 28, 12, 3, kc('hodo', -1)); hl(c, 2, 28, 12, kc('hodo', 1)); outline(c, 2, 28, 12, 4)    # 받침


@R.obj('mc-autodoor', '안쪽 유리 자동문(열림)', kind='door', cat=MC, cat_ko=MC_KO, use=('travel',),
       tags=('맨션', '엔트런스', '자동문', '오토록'), place='바람막이와 엘리베이터 홀 사이 가로 칸막이의 1칸 틈 칸', pair=('mc-autolock',),
       desc='맨션 안쪽 유리 자동문이 열린 모습 — 알루미늄 문틀과 위 센서 상자, 양옆으로 밀린 유리 문짝 끝이 보이고 가운데는 비어 지나간다. 바닥에 문 레일. 오토록 조작반 옆.')
def _mc_autodoor(c):
    rc(c, 0, 0, 16, 5, kc('tekko', 1)); hl(c, 0, 0, 16, kc('tekko', 3)); hl(c, 0, 4, 16, kc('tekko', -2))   # 위 문틀
    rc(c, 6, 1, 4, 2, kc('sumi', 0)); px(c, 7, 2, kc('aka', 1))                                       # 센서 상자
    for x0, f in ((0, 1), (13, -1)):
        rc(c, x0, 5, 3, 27, kc('tekko', 0)); vl(c, x0 + (0 if f > 0 else 2), 5, 27, kc('tekko', 2 if f > 0 else -2))   # 기둥
    for xa in (3, 11):                                                                                # 밀린 유리 문짝 끝(2px)
        rc(c, xa, 5, 2, 24, kc('garasu', 1)); vl(c, xa, 5, 24, kc('garasu', 2)); hl(c, xa, 5, 2, kc('tekko', 1)); hl(c, xa, 28, 2, kc('tekko', 1))
    rc(c, 0, 29, 16, 3, kc('tekko', 1)); hl(c, 0, 29, 16, kc('tekko', 3)); hl(c, 0, 31, 16, kc('tekko', -2))   # 레일
    hl(c, 3, 30, 10, kc('tekko', -1))


@R.obj('mc-mailboxes', '집합 우편함', w=3, h=1, up=16, kind='wall', cat=MC, cat_ko=MC_KO, use=('open',), surface=True,
       tags=('맨션', '엔트런스', '바람막이', '우편함'), place='바람막이 북쪽 벽 바로 아래(오토록 바깥쪽)', pair=('mc-delivery-box', 'mc-autolock', 'mc-flyer'),
       desc='은회색 집합 우편함 3칸 — 작은 문이 6열 4단, 문마다 다이얼 점과 이름표 자리(색 점, 글자 없음), 위 윗면에 전단 올려 두는 턱. 세대 수만큼.')
def _mc_mail(c):
    W = 48
    tall_box(c, 0, 2, W, 30, 'conc', 1, top=4)
    eave(c, 0, 7, W, 'conc', 1)
    for r in range(4):
        for col in range(6):
            x, y = 2 + col * 7 + (1 if col >= 3 else 0), 9 + r * 5
            rc(c, x, y, 6, 4, kc('conc', 2)); hl(c, x, y, 6, kc('conc', 3)); hl(c, x, y + 3, 6, kc('conc', -1)); vl(c, x + 5, y, 4, kc('conc', -1))
            px(c, x + 1, y + 1, kc('kinari', 1)); px(c, x + 2, y + 1, kc('kinari', 1))                # 이름표 자리
            px(c, x + 4, y + 2, kc('sumi', 0))                                                       # 다이얼
    vl(c, 23, 8, 22, kc('conc', -2)); vl(c, 24, 8, 22, kc('conc', 2))
    hl(c, 1, 29, W - 2, kc('conc', -1))


@R.obj('mc-delivery-box', '택배 보관함', w=2, h=1, up=32, kind='wall', cat=MC, cat_ko=MC_KO, use=('open',),
       tags=('맨션', '엔트런스', '바람막이', '택배'), place='바람막이 북쪽 벽 바로 아래, 집합 우편함 반대쪽', pair=('mc-mailboxes',),
       desc='키 큰 택배 보관함 2칸 — 진한 감색 몸통에 크기가 다른 칸 문(작은 칸 위·큰 칸 아래), 가운데 칸에 조작 화면(하늘빛)과 버튼 점. 글자 없음.')
def _mc_delivery(c):
    W = 32
    tall_box(c, 0, 1, W, 47, 'kon', 0, top=5)
    eave(c, 0, 7, W, 'kon', 0)
    doors = ((2, 9, 13, 7), (17, 9, 13, 7), (2, 17, 13, 9), (2, 27, 13, 18), (17, 32, 13, 13))
    for x, y, w, h in doors:
        rc(c, x, y, w, h, kc('kon', 1)); hl(c, x, y, w, kc('kon', 2)); hl(c, x, y + h - 1, w, kc('kon', -1)); vl(c, x + w - 1, y, h, kc('kon', -1))
        rc(c, x + w - 3, y + h // 2, 1, 2, kc('tekko', 2))
    rc(c, 17, 17, 13, 14, kc('tekko', 1)); outline(c, 17, 17, 13, 14, kc('tekko', -2))               # 조작 칸
    rc(c, 19, 19, 9, 5, kc('garasu', -1)); hl(c, 19, 19, 9, kc('sora', 1)); px(c, 20, 21, kc('sora', 2))
    for i in range(4): px(c, 19 + i * 2, 26, kc('tekko', -1)); px(c, 19 + i * 2, 28, kc('tekko', -1))
    rc(c, 1, 45, 30, 2, kc('kon', -1))


@R.obj('mc-notice-board', '관리 게시판', w=2, kind='hang', hrows=2, cat=MC, cat_ko=MC_KO, use=('read',),
       tags=('맨션', '엘리베이터 홀', '게시'), place='엘리베이터 홀 벽면 윗줄(엘리베이터 곁)',
       desc='은색 테를 두른 코르크 관리 게시판 2칸 — 흰·노랑·하늘 안내문이 핀으로 꽂혀 있다(글자 없이 회색 줄). 엘리베이터 홀 벽에 하나.')
def _mc_notice(c):
    W = 32
    rc(c, 2, 3, 28, 18, kc('yuka', 1)); outline(c, 1, 2, 30, 20, kc('tekko', -1)); hl(c, 2, 3, 28, kc('tekko', 2))
    for y in range(4, 20):
        for x in range(2, 30):
            if rnd(x, y, 91, 120): px(c, x, y, kc('yuka', 0))
    for (x, y, w, h, col) in ((4, 5, 7, 9, 'shiro'), (13, 4, 6, 7, 'kii'), (21, 6, 7, 10, 'shiro'), (13, 13, 6, 6, 'sora')):
        rc(c, x, y, w, h, kc(col, 1)); hl(c, x, y, w, kc(col, 2))
        for yy in range(y + 2, y + h - 1, 2): hl(c, x + 1, yy, w - 2, kc('conc', 0))
        px(c, x + w // 2, y, kc('aka', 0))
    hl(c, 2, 22, 28, kc('kinari', -1))


@R.obj('mc-elevator', '엘리베이터 문(맨션)', w=2, h=1, up=32, kind='wall', cat=MC, cat_ko=MC_KO, use=('travel',),
       tags=('맨션', '엘리베이터 홀', '외복도', '엘리베이터'), place='엘리베이터 홀·외복도 북쪽 벽 바로 아래 — 문 앞 칸에 층 이동 links', pair=('mc-notice-board',),
       desc='세대용 엘리베이터 문 2칸 — 짙은 갈색 문 테 안에 은색 두 짝 문(가운데 이음, 작은 세로 창), 위 층 표시등(불 하나), 오른쪽 테에 호출 버튼 점. 문 앞 칸에 층 이동을 단다.')
def _mc_elev(c):
    W = 32
    rc(c, 0, 1, W, 46, kc('renga', -1)); outline(c, 0, 1, W, 47)                                      # 갈색 문 테
    hl(c, 1, 2, W - 2, kc('renga', 1)); vl(c, 1, 2, 45, kc('renga', 0)); vl(c, W - 2, 2, 45, kc('renga', -2))
    rc(c, 11, 4, 10, 4, kc('sumi', 0)); px(c, 13, 5, kc('daidai', 1)); px(c, 14, 5, kc('daidai', 0))   # 표시등
    rc(c, 4, 10, 24, 34, kc('tekko', 1)); outline(c, 3, 9, 26, 36, kc('renga', -2))                   # 문짝
    for x0 in (4, 16):
        vl(c, x0, 10, 34, kc('tekko', 2)); vl(c, x0 + 11, 10, 34, kc('tekko', 0))
        for y in range(12, 42, 5): px(c, x0 + 3, y, kc('tekko', 2))                                   # 헤어라인 결
    vl(c, 15, 10, 34, kc('tekko', -2)); vl(c, 16, 10, 34, kc('tekko', 3))                             # 가운데 이음
    rc(c, 12, 14, 2, 10, kc('garasu', -1)); rc(c, 18, 14, 2, 10, kc('garasu', -1)); px(c, 12, 14, kc('garasu', 2)); px(c, 18, 14, kc('garasu', 2))
    rc(c, 29, 24, 2, 5, kc('tekko', 1)); px(c, 29, 25, kc('kii', 1)); px(c, 29, 27, kc('tekko', -1))   # 호출 버튼(오른쪽 테)
    rc(c, 2, 44, 28, 3, kc('tekko', 1)); hl(c, 2, 44, 28, kc('tekko', 3)); hl(c, 2, 46, 28, kc('tekko', -2))   # 문턱


def _cstairs(c):
    """콘크리트 계단 한 칸 폭 16×48 — 아래(발칸)에서 북쪽 벽 속으로 오른다. 디딤판 밝고 챌판 어둡고 코마다 미끄럼 방지 줄."""
    rc(c, 0, 0, 16, 48, kc('yoru', -3))
    ys = (2, 7, 12, 17, 22, 28, 34, 40)                                                               # 단 위 끝(먼 단 → 가까운 단)
    for i, y in enumerate(ys):
        y1 = ys[i + 1] if i + 1 < len(ys) else 47
        t = -3 + (i * 4) // 7                                                                         # 먼 단은 어둡고 가까운 단일수록 밝다
        tread = max(2, (y1 - y) - 2)
        rc(c, 2, y, 11, tread, kc('conc', t + 1)); hl(c, 2, y, 11, kc('conc', t + 2))                  # 디딤판(코 밝음)
        hl(c, 2, y + 1, 11, kc('hodo', t))                                                            # 미끄럼 방지 홈
        rc(c, 2, y + tread, 11, y1 - y - tread, kc('yoru', -2 + i // 3))                              # 챌판(어둡게)
        rc(c, 2, y, 2, y1 - y, kc('yoru', -3 + i // 3)); px(c, 4, y, kc('conc', t))                   # 왼쪽 벽이 드리운 그늘
    rc(c, 2, 0, 11, 3, kc('yoru', -3))                                                                # 위는 벽 속 어둠으로 사라진다
    rc(c, 0, 0, 2, 48, kc('conc', 0)); vl(c, 0, 0, 48, OL); vl(c, 1, 0, 48, kc('conc', 1))            # 왼쪽 벽 끝
    rc(c, 13, 0, 3, 48, kc('conc', -1)); vl(c, 13, 0, 48, kc('tekko', 2)); vl(c, 14, 0, 48, kc('tekko', 0)); vl(c, 15, 0, 48, OL)   # 오른쪽 철 손잡이
    for y in range(6, 46, 8): px(c, 14, y, kc('tekko', 3))
    hl(c, 0, 47, 16, OL)


@R.obj('mc-stairs-up', '공용 계단(위)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',), cat=MC, cat_ko=MC_KO,
       tags=('계단', '맨션', '엘리베이터 홀', '階段'), place='엘리베이터 홀 북쪽 벽 바로 아래(벽 가구 자리) — 발칸에 위층 links',
       desc='맨션 공용 콘크리트 계단 한 칸 폭 — 북쪽 벽 속으로 오르고 디딤판 코마다 미끄럼 방지 줄, 오른쪽 철 손잡이. 발칸에서 위로 올라가면 위층으로 이동.')
def _mc_st(c): _cstairs(c)


@R.obj('mc-stairwell-down', '내려가는 공용 계단통', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)), cat=MC, cat_ko=MC_KO,
       tags=('계단', '맨션', '외복도', '階段', '난간'), place='외복도 한쪽 끝',
       desc='외복도 끝 바닥에 뚫린 내려가는 콘크리트 계단통 2×2 — 북·동·서는 철 난간, 남쪽이 열린 입구. 윗줄(난간)은 막히고 아랫줄 두 칸은 밟는다 — 그 칸에 아래층 links.')
def _mc_well(c):
    rc(c, 1, 18, 30, 29, OL)
    rc(c, 3, 20, 26, 24, kc('yoru', -2))
    for i in range(6):
        y = 22 + i * 4
        t = -2 + i // 2
        rc(c, 4, y, 24, 2, kc('conc', -t - 1)); hl(c, 4, y, 24, kc('conc', -t)); hl(c, 4, y + 1, 24, kc('kii', -2) if i % 2 == 0 else kc('conc', -t - 1))
        rc(c, 4, y + 2, 24, 2, kc('yoru', -1 - (i % 2)))
    rc(c, 1, 44, 30, 3, kc('conc', 0)); hl(c, 1, 44, 30, kc('conc', 2)); hl(c, 1, 46, 30, kc('conc', -2)); hl(c, 1, 47, 30, kc('conc', -3))
    rc(c, 2, 17, 28, 2, kc('tekko', 1)); hl(c, 2, 17, 28, kc('tekko', 3)); hl(c, 2, 19, 28, kc('tekko', -2))   # 북쪽 손잡이
    for x in (6, 11, 16, 21, 26): rc(c, x, 19, 1, 3, kc('tekko', 0))
    for x in (1, 29):
        c.R(x, 18, 2, 27, kc('tekko', 0)); vl(c, x, 18, 27, kc('tekko', 2))
        rc(c, x - 1 if x == 1 else x, 6, 3, 40, kc('tekko', -2)); rc(c, x, 7, 1, 38, kc('tekko', 0))   # 옆 난간 기둥
        rc(c, x - 1 if x == 1 else x, 4, 3, 2, kc('tekko', 3))


@R.obj('mc-railing', '외복도 난간(허리벽 + 철 난간)', w=1, h=1, up=0, kind='floor', cat=MC, cat_ko=MC_KO, use=('block',),
       tags=('맨션', '외복도', '난간'), place='외복도 남쪽 바깥 가장자리 한 줄 — 가로로 이어 붙여 막는다',
       desc='외복도 바깥 가장자리 — 안쪽 배수 홈(어두운 줄과 철망 점), 콘크리트 허리벽 윗갓과 앞면, 그 위 철 난간 막대 사이로 하늘빛이 보인다. 막힘, 한 줄로 이어 붙인다.')
def _mc_rail(c):
    rc(c, 0, 0, 16, 2, kc('conc', -2)); px(c, 3, 0, kc('tekko', 0)); px(c, 11, 0, kc('tekko', 0))     # 배수 홈
    for x in range(1, 16, 4): px(c, x, 1, kc('conc', -3))
    hl(c, 0, 2, 16, kc('tekko', 2)); hl(c, 0, 3, 16, kc('tekko', 0))                                  # 철 손잡이
    rc(c, 0, 4, 16, 3, kc('sora', 1)); hl(c, 0, 4, 16, kc('sora', 2))                                 # 난간 사이 하늘
    for x in (3, 11): vl(c, x, 4, 3, kc('tekko', -1))                                                 # 기둥
    hl(c, 0, 7, 16, kc('conc', 3)); rc(c, 0, 8, 16, 2, kc('conc', 2))                                 # 허리벽 윗갓
    hl(c, 0, 10, 16, kc('conc', -1))
    rc(c, 0, 11, 16, 5, kc('conc', 0))
    for x in range(16):
        if rnd(x, 12, 95, 200): px(c, x, 12 + (x % 3), kc('conc', -1))
    hl(c, 0, 15, 16, kc('conc', -2))


@R.obj('mc-unit-door', '세대 현관문(외복도)', w=1, kind='hang', hrows=2, cat=MC, cat_ko=MC_KO, use=('open',),
       tags=('맨션', '외복도', '현관문'), place='외복도 북쪽 벽면 — 세대마다 하나(장식, 잇지 않는다)', pair=('mc-meter-box',),
       desc='맨션 세대 철제 현관문 — 짙은 회색 문짝, 은색 레버 손잡이·도어 스코프 점, 문 옆 벽에 표찰(색 점, 글자 없음)과 인터폰 버튼. 외복도 북쪽 벽면에 거는 닫힌 문.')
def _mc_unit(c):
    rc(c, 1, 1, 12, 31, kc('tekko', -2)); outline(c, 1, 1, 12, 31)                                    # 문틀
    rc(c, 2, 2, 10, 30, kc('tekko', -1)); vl(c, 2, 2, 30, kc('tekko', 0)); hl(c, 2, 2, 10, kc('tekko', 0))
    hl(c, 3, 9, 8, kc('tekko', -2)); hl(c, 3, 23, 8, kc('tekko', -2))                                 # 문짝 홈
    px(c, 7, 7, kc('sumi', 0))                                                                        # 도어 스코프
    rc(c, 9, 16, 3, 1, kc('tekko', 3)); px(c, 9, 17, kc('tekko', 1))                                   # 레버
    px(c, 10, 12, kc('tekko', 1))
    rc(c, 13, 9, 3, 2, kc('kinari', 1)); px(c, 13, 9, kc('kinari', 2))                                # 표찰
    rc(c, 13, 13, 2, 3, kc('tekko', 1)); px(c, 13, 14, kc('sumi', 0))                                 # 인터폰
    hl(c, 2, 31, 10, kc('tekko', -3))


@R.obj('mc-meter-box', '계량기함(파이프 샤프트)', w=1, kind='hang', hrows=2, cat=MC, cat_ko=MC_KO, use=('open',),
       tags=('맨션', '외복도', '계량기'), place='외복도 북쪽 벽면, 세대 현관문 바로 옆', pair=('mc-unit-door',),
       desc='세대 현관문 옆 크림색 철판 계량기함 문 — 아래위 통풍 살, 작은 손잡이. 외복도 벽면에 세대마다 하나.')
def _mc_meter(c):
    rc(c, 3, 6, 10, 24, kc('kinari', 1)); outline(c, 2, 5, 12, 26, kc('kinari', -2))
    hl(c, 3, 6, 10, kc('kinari', 2)); vl(c, 3, 6, 24, kc('kinari', 2)); vl(c, 12, 6, 24, kc('kinari', 0))
    for y in (8, 10, 25, 27): hl(c, 5, y, 6, kc('kinari', -1))                                        # 통풍 살
    rc(c, 10, 17, 1, 3, kc('tekko', 0))
    hl(c, 3, 31, 10, kc('shiro', -1))


@R.obj('mc-bike-rack', '자전거 둔 자리', w=1, h=1, up=8, kind='floor', cat=MC, cat_ko=MC_KO, use=('search',),
       tags=('맨션', '엘리베이터 홀', '자전거'), place='엘리베이터 홀·엔트런스 한쪽 구석에 가로로 2~3칸',
       desc='낮은 철 자전거 받침에 세운 생활 자전거(마마차리) 한 대 — 옆모습으로 바퀴 둘, 빨강 틀·검은 안장·앞 바구니. 한 칸에 한 대, 가로로 이어 둔다.')
def _mc_bike(c):
    hl(c, 0, 29, 16, kc('hodo', -2)); hl(c, 1, 30, 14, kc('hodo', -1))                                # 바닥 그림자
    rc(c, 0, 20, 16, 1, kc('tekko', 0)); hl(c, 0, 19, 16, kc('tekko', 2))                             # 뒤 받침 막대
    for x in (1, 14): rc(c, x, 20, 1, 9, kc('tekko', -1))
    for cx in (4.5, 11.5):                                                                            # 바퀴 둘(옆모습)
        disc(c, cx, 24.5, 4.0, 4.0, kc('sumi', 0)); disc(c, cx, 24.5, 2.8, 2.8, kc('hodo', 1)); disc(c, cx, 24.5, 1.0, 1.0, kc('tekko', 2))
        px(c, int(cx) - 2, 21, kc('tekko', 0))
    for (x, y) in ((5, 23), (6, 22), (7, 21), (8, 21), (9, 21), (10, 21), (8, 22), (8, 23), (8, 24), (6, 24), (7, 24), (9, 22), (10, 23), (11, 24)):
        px(c, x, y, kc('aka', 0))                                                                     # 빨강 틀
    for x in (7, 8): px(c, x, 20, kc('aka', 1))
    vl(c, 6, 18, 3, kc('tekko', 1)); rc(c, 4, 17, 4, 2, kc('sumi', 1)); hl(c, 4, 17, 4, kc('tekko', 0))   # 안장
    vl(c, 11, 17, 4, kc('tekko', 1)); rc(c, 10, 16, 4, 1, kc('tekko', 2)); px(c, 9, 16, OL)            # 핸들
    rc(c, 12, 17, 4, 3, kc('tekko', 1)); hl(c, 12, 17, 4, kc('tekko', 3)); outline(c, 11, 16, 5, 5, kc('tekko', -2))   # 앞 바구니
    rc(c, 1, 19, 4, 1, kc('tekko', 2))                                                                # 짐받이


@R.good('mc-flyer', '전단 묶음', desc='우편함 위에 올려 둔 전단 몇 장 — 흰·노랑·하늘 종이가 어긋나 겹친다(글자 없음).')
def _g_flyer(c):
    for i, (x, y, col) in enumerate(((2, 8, 'kii'), (4, 6, 'sora'), (3, 4, 'shiro'))):
        rc(c, x, y, 10, 7, kc(col, 1)); hl(c, x, y, 10, kc(col, 2)); hl(c, x, y + 6, 10, kc(col, -1))
    for y in (6, 8): hl(c, 5, y, 6, kc('conc', 0))
    outline(c, 1, 3, 14, 13)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

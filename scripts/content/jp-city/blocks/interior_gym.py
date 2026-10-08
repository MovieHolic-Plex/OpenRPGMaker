#!/usr/bin/env python3
"""jp_city 일본 실내 — 학교 체육관·유치원. id 머리 `gy-`.

칸 16px = 1m, 3/4 시점(윗면 + 정면 한 면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만. 글자·숫자·상표·사람 없음.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, table = fn(c,w,h).
거리 외관 `jp-bldg-school-gym`(체육관)·`jp-bldg-kindergarten`(유치원)의 실내다.

크기(§12-3 공식: 폭 = W×16, 앞면 F = H×16, 윗면 T = D×16×압축, 칸 높이 = F+T 가 들어가는 첫 칸 수):
  · 이동식 농구 골대 1.8×2.5×3.9m — 축약 관례(골대 높이를 화면 한 장에 넣으려 줄임): 2×2 칸(받침 깊이), 위로 32px.
  · 무대: 앞면 1.0m 를 10px 로 줄인 탁자식(w×h 아무 크기). 계단 3단 0.9m: 1×1, 위로 4px.
  · 늑목 0.9×0.15×2.4m: 1칸 폭, F 38 → 벽면 두 줄을 덮는 위로 32px.
  · 매트 1.2×2.0×0.05m(깐 것 flat 2×1) · 쌓은 매트 4장 0.2m: 2×1, T 10 + F 6 → 위로 6px.
  · 뜀틀 0.9(길이)×0.4×0.9m: 1×1, F 14 + T 6 → 위로 8px.  공 바구니 0.8×0.6×0.9m: 1×1, 위로 10px.
  · 배구 지주 2.5m: 1×1, 위로 32px(축약).  점수판 0.8×0.4×1.4m: 1×1, 위로 16px.  접이 의자 수레 1.4m: 1×1, 위로 16px.
  · 아이 사물함 3.0×0.35×1.1m: 3×1 벽, F 18 + T 5 → 위로 10px.  업라이트 피아노 1.5×0.6×1.2m: 2×1 벽, F 19 + T 6 → 위로 10px.
  · 그림책 선반 1.6×0.35×0.8m: 2×1 벽, 위로 4px.  아이 세면대 1.8×0.5×0.7m(+수도꼭지): 2×1 벽, 위로 8px.
  · 아이 신발장 1.6×0.35×0.7m: 2×1, 위로 4px.  장난감 상자 0.6×0.4×0.5m: 1×1, 위로 0.  아이 의자: 1×1, 위로 4px.

분류는 interior/categories.py(gym·kindergarten).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT

BLOCK = 'interior_gym'
R = Registry(BLOCK, '체육관·유치원')

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


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ring(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 and ((x + .5 - cx) / (rx - 1)) ** 2 + ((y + .5 - cy) / max(.6, ry - 1)) ** 2 > 1: px(c, x, y, col)


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


def flip(c):
    """좌우 거울 — 빛 방향이 바뀌므로 그린 뒤 밝은 변을 다시 칠할 곳에만 쓴다."""
    c.a[:] = c.a[:, ::-1].copy()


# ══ 체육관 바닥·벽면 ══════════════════════════════════════════════════════════
@R.floor('gy-court', '체육관 마루(밝은 나무)', cols=4, rows=4, tags=('체육관', '강당'),
         desc='밝은 꿀색 단풍나무 널을 동서로 길게 깐 체육관 마루. 널 이음매가 엇갈리고 왼위 빛의 광택 점이 드문드문. 코트 선(gy-line-*)을 이 위에 깐다.')
def _court(c):
    W = H = 64
    c.R(0, 0, W, H, kc('yuka', 1))
    for row in range(H // 4):
        y0 = row * 4
        hl(c, 0, y0 + 3, W, kc('yuka', 0))                                                          # 널 사이 줄눈
        off = (row * 37) % W
        for j in range(2): vl(c, (off + j * 32) % W, y0, 3, kc('yuka', 0))                         # 엇갈린 이음매
        for x in range(W):
            if rnd(x, row, 4, 28): px(c, x, y0 + 1, kc('yuka', 2))                                  # 결
    for k in range(3):                                                                              # 광택(사선 띠, 주기 64)
        for t in range(10):
            x, y = (k * 21 + t * 2) % W, (k * 19 + t * 3 + 5) % H
            if (y % 4) != 3: px(c, x, y, kc('yuka', 2)); px(c, (x + 1) % W, y, kc('yuka', 2))


@R.floor('gy-store-floor', '체육 창고 콘크리트', cols=2, rows=2, tags=('체육관', '창고'),
         desc='회색 콘크리트 바닥 — 드문 얼룩 점과 2m 마다 신축 줄눈. 체육 창고·기계실.')
def _store_floor(c):
    c.R(0, 0, 32, 32, kc('conc', 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 11, 70): px(c, x, y, kc('conc', 0))
            elif rnd(x, y, 12, 30): px(c, x, y, kc('conc', 2))
    hl(c, 0, 0, 32, kc('conc', -1)); vl(c, 0, 0, 32, kc('conc', -1))


@R.floor('gy-kinder-floor', '유치원 놀이방 바닥(연노랑 나무)', cols=4, rows=4, tags=('유치원', '놀이방'),
         desc='연노랑 넓은 나무 널(쿠션 플로어) — 널 폭 8px, 이음매가 엇갈린다. 유치원 놀이방·낮잠 방.')
def _kinder_floor(c):
    W = H = 64
    c.R(0, 0, W, H, kc('mado', 1))
    for row in range(H // 8):
        y0 = row * 8
        hl(c, 0, y0, W, kc('mado', 2)); hl(c, 0, y0 + 7, W, kc('mado', 0))
        off = (row * 27) % W
        vl(c, off, y0, 7, kc('mado', 0)); vl(c, (off + 1) % W, y0 + 1, 6, kc('mado', 2))
        for x in range(W):
            if rnd(x, row, 7, 25): px(c, x, y0 + 3 + (x % 3), kc('mado', 0))


@R.wall('gy-wall', '체육관 벽면(나무 판 + 흰 벽 + 높은 창)', cols=2, tags=('체육관', '강당'),
        desc='윗줄에 철틀 높은 창이 줄지은 흰 벽, 아랫줄은 세로 나무 판 허리벽과 걸레받이. 체육관·강당 벽.')
def _gym_wall(c):
    c.R(0, 0, 32, 14, kc('shiro', 1))
    for x in range(0, 32, 16):                                                                      # 높은 창(칸마다 한 짝)
        rc(c, x + 1, 2, 14, 10, kc('tekko', 0))
        rc(c, x + 2, 3, 12, 8, kc('garasu', 2))
        vl(c, x + 8, 3, 8, kc('tekko', 1)); hl(c, x + 2, 7, 12, kc('tekko', 1))
        for i in range(4): px(c, x + 3 + i, 9 - i, kc('garasu', 3)); px(c, x + 10 + i, 6 - i, kc('garasu', 3))
        hl(c, x + 1, 12, 14, kc('shiro', 3))                                                        # 창턱
    rc(c, 0, 14, 32, 16, kc('yuka', 0))                                                             # 나무 허리벽
    for x in range(0, 32, 4): vl(c, x, 15, 15, kc('ita', 1))
    for x in range(2, 32, 8): vl(c, x, 16, 13, kc('yuka', 1))
    hl(c, 0, 13, 32, kc('ita', 0)); hl(c, 0, 14, 32, kc('yuka', 2))                                 # 위 띠
    rc(c, 0, 30, 32, 2, kc('ita', -1)); hl(c, 0, 30, 32, kc('ita', 0))                              # 걸레받이


# ── 코트 선(flat) — 선은 칸 가운데(7·8행·열)를 지난다. 이어 붙여 농구 코트 테두리·가운데 줄을 만든다 ──
_LC = ('shiro', 3)


def _line(c, segs, ramp=None):
    ramp = ramp or _LC
    for s in segs:
        if s == 'E': rc(c, 7, 7, 9, 2, kc(*ramp))
        if s == 'W': rc(c, 0, 7, 9, 2, kc(*ramp))
        if s == 'S': rc(c, 7, 7, 2, 9, kc(*ramp))
        if s == 'N': rc(c, 7, 0, 2, 9, kc(*ramp))


_LINES = (('h', 'EW', '가로 선', '코트 남·북 테두리 가운데 칸'), ('v', 'NS', '세로 선', '코트 동·서 끝 선·가운데 줄'),
          ('nw', 'ES', '북서 모서리', '코트 북서 모서리'), ('ne', 'WS', '북동 모서리', '코트 북동 모서리'),
          ('sw', 'EN', '남서 모서리', '코트 남서 모서리'), ('se', 'WN', '남동 모서리', '코트 남동 모서리'),
          ('tn', 'EWS', 'ㅜ자 이음', '북쪽 테두리와 가운데 줄이 만나는 칸'), ('ts', 'EWN', 'ㅗ자 이음', '남쪽 테두리와 가운데 줄이 만나는 칸'))
for _id, _segs, _ko, _pl in _LINES:
    R.obj('gy-line-' + _id, '코트 선(%s)' % _ko, w=1, h=1, kind='flat', use=('walk',), tags=('체육관', '농구', '코트'),
          place=_pl, pair=('gy-court', 'gy-line-circle'),
          desc='체육관 마루 위 흰 코트 선 — %s. 칸 가운데를 지나는 2px 선이라 이웃 선 칸과 이어진다. 밟고 지나간다.' % _ko)(lambda c, s=_segs: _line(c, s))


def _key(c, west):
    """제한 구역(키) 3×3 — 흰 테만(칠 없음). 선은 칸 가운데를 지난다(col 0 = 끝 선, col 2 = 자유투 선)."""
    x0, x1, y0, y1 = 7, 7 + 32, 7, 7 + 32
    rc(c, x0, y0, 34, 2, kc('shiro', 3)); rc(c, x0, y1, 34, 2, kc('shiro', 3))
    rc(c, x1, y0, 2, 34, kc('shiro', 3))
    rc(c, x0, 0, 2, 48, kc('shiro', 3))                                                               # 끝 선 세 칸
    for t in range(0, 26):                                                                            # 자유투 반원(점선 아님, 바깥쪽 반)
        a = -math.pi / 2 + math.pi * t / 25
        x, y = int(round(x1 + 1 + 6 * math.cos(a))), int(round(24 + 9 * math.sin(a)))
        px(c, x, y, kc('shiro', 3)); px(c, x, y + 1 if abs(math.sin(a)) < .9 else y, kc('shiro', 3))
    if not west: flip(c)


@R.obj('gy-key-w', '코트 제한 구역(서쪽 끝)', w=3, h=3, kind='flat', use=('walk',), tags=('체육관', '농구', '코트'),
       place='코트 서쪽 끝 선 위, 가운데 3줄 — 첫 열이 끝 선 칸(gy-line-v 대신)', pair=('gy-hoop-e', 'gy-line-v'),
       desc='골대 앞 제한 구역 3×3 — 흰 선 테와 자유투 반원, 끝 선 한 토막을 함께 그렸다(칠 없음, 마루가 보인다). 서쪽 끝 선 칸에 첫 열을 맞춰 끝 선(gy-line-v) 세 칸을 이것으로 바꾼다.')
def _key_w(c): _key(c, True)


@R.obj('gy-key-e', '코트 제한 구역(동쪽 끝)', w=3, h=3, kind='flat', use=('walk',), tags=('체육관', '농구', '코트'),
       place='코트 동쪽 끝 선 위, 가운데 3줄 — 마지막 열이 끝 선 칸', pair=('gy-hoop-w', 'gy-line-v'),
       desc='gy-key-w 의 거울 — 동쪽 끝 선 칸에 마지막 열을 맞춘다.')
def _key_e(c): _key(c, False)


@R.obj('gy-line-circle', '코트 가운데 원', w=3, h=3, kind='flat', use=('walk',), tags=('체육관', '농구', '코트'),
       place='코트 한가운데 — 가운데 세로 줄(gy-line-v) 위에 가운데 칸을 맞춰', pair=('gy-line-v', 'gy-line-tn', 'gy-line-ts'),
       desc='농구 코트 가운데 원 3×3 — 흰 원 테(칠 없음)를 가운데 세로 줄이 지난다.')
def _line_circle(c):
    disc(c, 24, 24, 15, 13, kc('shiro', 3))
    for y in range(48):
        for x in range(48):
            if ((x + .5 - 24) / 13) ** 2 + ((y + .5 - 24) / 11) ** 2 <= 1: c.a[y, x, 3] = 0
    rc(c, 23, 0, 2, 48, kc('shiro', 3))


@R.obj('gy-line-v-y', '배구 선(노랑 세로)', w=1, h=1, kind='flat', use=('walk',), tags=('체육관', '배구', '코트'),
       place='농구 코트 안 — 가운데 원과 제한 구역 사이 열에 위아래로 이어', pair=('gy-line-v',),
       desc='배구 공격선처럼 코트를 세로로 가로지르는 노란 선(칸 가운데 2px). 흰 농구 선과 다른 경기 색 — 이어 붙여 쓴다.')
def _line_vy(c): rc(c, 7, 0, 2, 16, kc('kii', 1))


@R.obj('gy-bench', '체육관 긴 의자', w=2, h=1, up=0, kind='floor', use=('sit',), tags=('체육관',),
       place='코트 바깥 벽 곁', desc='나무 판 하나에 철 다리 넷의 긴 의자 2칸 — 코트 바깥 벽을 따라 놓는다. 앉아서 경기를 본다.')
def _bench(c):
    rc(c, 0, 5, 32, 5, kc('yuka', 1)); hl(c, 0, 5, 32, kc('yuka', 2)); hl(c, 0, 9, 32, kc('yuka', 2))   # 앉는 판 윗면 + 앞 가장자리
    rc(c, 0, 10, 32, 2, kc('ita', 0)); hl(c, 0, 11, 32, kc('ita', -2))                               # 판 앞면
    for x in (2, 8, 23, 29):
        vl(c, x, 12, 3, kc('tekko', 1)); vl(c, x + 1, 12, 3, kc('tekko', -2))
    hl(c, 2, 14, 28, kc('tekko', 0))
    outline(c, 0, 4, 32, 9)


# ══ 체육관 가구 ═══════════════════════════════════════════════════════════════
def _hoop(c, east):
    """이동식 농구 골대(2×2 — 무게 받침이 남북으로 깊다, 위로 32). east=True 면 서쪽 끝에 서서 동쪽(코트)을 본다 — 옆모습."""
    W = 32
    X = (lambda x, w=1: x) if east else (lambda x, w=1: W - x - w)
    # 받침(무게 상자): 윗면 6 + 앞면 9, 파란 보호 패드
    bx = X(1, 18)
    rc(c, bx, 45, 18, 6, kc('kon', 1)); hl(c, bx, 45, 18, kc('kon', 2)); hl(c, bx, 50, 18, kc('kon', 2))
    rc(c, bx, 51, 18, 9, kc('kon', -1)); hl(c, bx, 51, 18, kc('kon', -2))
    for i in range(3): vl(c, bx + 4 + i * 5, 52, 7, kc('kon', -2))
    outline(c, bx, 44, 18, 17)
    for wx in (2, 14): rc(c, X(wx, 3), 60, 3, 3, OL)                                                 # 바퀴
    # 기둥(받침에서 위로) — 밝은 변은 언제나 왼쪽
    pxx = X(5, 3)
    rc(c, pxx, 9, 3, 37, kc('tekko', 0)); vl(c, pxx, 9, 37, kc('tekko', 2)); vl(c, pxx + 2, 9, 37, kc('tekko', -2))
    rc(c, pxx - 1, 30, 5, 14, kc('kon', 0)); vl(c, pxx - 1, 30, 14, kc('kon', 2)); outline(c, pxx - 1, 30, 5, 14)   # 기둥 패드
    hl(c, pxx - 1, 33, 5, kc('kon', 1))
    # 팔(기둥 끝 → 백보드)
    for i in range(16):
        ax = 7 + i
        y = 10 + (i // 6)
        rc(c, X(ax), y, 1, 2, kc('tekko', 1)); px(c, X(ax), y + 2, kc('tekko', -2)); px(c, X(ax), y - 1, OL)
    # 백보드(옆에서 본 두께 + 남북 깊이)
    bb = X(22, 4)
    rc(c, bb, 1, 4, 24, kc('shiro', 2)); vl(c, bb, 1, 24, kc('shiro', 4)); vl(c, bb + 3, 1, 24, kc('conc', 1))
    hl(c, bb, 1, 4, kc('shiro', 4)); rc(c, bb, 17, 4, 4, kc('aka', 1)); hl(c, bb, 17, 4, kc('aka', 2))    # 아래 빨간 테
    outline(c, bb - 1, 0, 6, 26)
    # 링(주황 타원) + 그물
    rcx = 28.5 if east else W - 28.5
    ring(c, rcx, 24, 4, 2, kc('daidai', 0)); hl(c, int(rcx - 2), 22, 4, kc('daidai', 2))
    for i in range(6):
        y = 26 + i
        hw = 3.5 - i * 0.35
        px(c, int(rcx - hw), y, kc('shiro', 3)); px(c, int(rcx + hw), y, kc('shiro', 2))
        if i % 2: px(c, int(rcx), y, kc('shiro', 3))
    hl(c, int(rcx - 2), 31, 4, kc('shiro', 2))
    rc(c, X(26, 2), 23, 2, 2, kc('tekko', 0))                                                       # 링 받침


@R.obj('gy-hoop-e', '이동식 농구 골대(동쪽을 봄)', w=2, h=2, up=32, kind='floor', use=('block',), facing='E', tags=('체육관', '농구'),
       place='농구 코트 서쪽 끝 선 바깥 — 받침 2×2 의 아랫줄을 코트 가운데 줄에 맞춰', pair=('gy-hoop-w', 'gy-line-v'),
       desc='바퀴 달린 파란 무게 받침에서 기둥이 서고 팔이 동쪽으로 뻗어 백보드(옆모습)와 주황 링·흰 그물이 코트 쪽에 걸린다. 코트 서쪽 끝에 하나, 동쪽 끝에는 gy-hoop-w.')
def _hoop_e(c): _hoop(c, True)


@R.obj('gy-hoop-w', '이동식 농구 골대(서쪽을 봄)', w=2, h=2, up=32, kind='floor', use=('block',), facing='W', tags=('체육관', '농구'),
       place='농구 코트 동쪽 끝 선 바깥 — 받침 2×2 의 아랫줄을 코트 가운데 줄에 맞춰. 창고 벽 바로 아래에 두지 않는다(백보드가 벽 창을 가린다)', pair=('gy-hoop-e', 'gy-line-v'),
       desc='gy-hoop-e 의 거울 — 받침이 동쪽, 백보드와 링이 서쪽(코트 쪽). 코트 동쪽 끝에 하나.')
def _hoop_w(c): _hoop(c, False)


@R.table('gy-stage', '무대(강당 단상)', tags=('체육관', '강당', '무대'),
         desc='나무 널을 깐 높은 단 — 윗면 널 + 앞 가장자리 밝은 테 + 짙은 나무 앞면 판(16px 마다 세로 띠). 북쪽 벽 바로 아래에 w×2 로 깔고 벽면에 막(gy-curtain)을 건다. 오르는 계단은 gy-stage-steps.')
def _stage(c, w, h):
    W, H = w * 16, h * 16
    F = 10
    c.R(0, 0, W, H - F, kc('yuka', 1))
    for y in range(3, H - F - 1, 4): hl(c, 0, y, W, kc('yuka', 0))                                   # 널 줄눈
    for y in range(1, H - F - 1, 4):
        for x in range(W):
            if rnd(x % 16, y % 16, 3, 50): px(c, x, y, kc('yuka', 2))
    hl(c, 0, H - F - 1, W, kc('yuka', 2))                                                           # 앞 가장자리 하이라이트
    rc(c, 0, H - F, W, F, kc('ita', 0))                                                             # 앞면
    hl(c, 0, H - F, W, kc('ita', -2)); hl(c, 0, H - F + 1, W, kc('ita', -1))                        # 처마 그림자
    for x in range(0, W, 16):
        vl(c, x + 1, H - F + 2, F - 3, kc('ita', 1)); vl(c, x + 14, H - F + 2, F - 3, kc('ita', -1))
        hl(c, x + 2, H - F + 4, 12, kc('ita', 1)); hl(c, x + 2, H - 3, 12, kc('ita', -1))
    hl(c, 0, H - 1, W, kc('ita', -3))
    outline(c, 0, 0, W, H)


@R.obj('gy-stage-steps', '무대 계단(3단)', w=1, h=1, up=4, kind='floor', use=('walk',), tags=('체육관', '강당', '무대'),
       place='무대(gy-stage) 바로 남쪽, 무대 가장자리', pair=('gy-stage',),
       desc='무대 앞에 붙이는 나무 계단 세 단. 단마다 밝은 디딤면과 짙은 챌면, 양옆 옆판. 무대 남쪽 끝에 한두 개.')
def _stage_steps(c):
    rc(c, 1, 12, 14, 20, kc('ita', 0))
    for k, (ty, th, rh) in enumerate(((12, 3, 4), (19, 3, 3), (25, 3, 3))):                         # 위 단부터: 디딤면 → 챌면
        x0 = 1 if k == 0 else 1
        rc(c, x0, ty, 14, th, kc('yuka', 1 if k else 2)); hl(c, x0, ty, 14, kc('yuka', 2)); hl(c, x0, ty + th - 1, 14, kc('yuka', 0))
        rc(c, x0, ty + th, 14, rh, kc('ita', 0)); hl(c, x0, ty + th, 14, kc('ita', -2))
        for x in (5, 10): vl(c, x, ty + th + 1, rh - 1, kc('ita', -1))
    vl(c, 1, 12, 19, kc('yuka', 2)); vl(c, 14, 12, 19, kc('ita', -1))
    hl(c, 1, 31, 14, kc('ita', -3))
    outline(c, 0, 11, 16, 21)


@R.obj('gy-curtain', '무대 막(짙은 자주)', w=2, kind='hang', hrows=2, tags=('체육관', '강당', '무대'),
       place='무대 뒤 북쪽 벽면 윗줄, 무대 폭만큼 이어 건다', pair=('gy-stage',),
       desc='짙은 자주색 벨벳 막 2칸 — 위에 금색 술 달린 가로 막(바란스), 아래로 주름이 이어진다. 무대 뒤 벽에 무대 폭만큼 나란히 건다.')
def _curtain(c):
    folds = (0, 1, 1, 0, -1, -1, -2, -1)
    for x in range(32):
        vl(c, x, 7, 25, kc('murasaki', folds[x % 8] - 1))
        if folds[x % 8] == 1: vl(c, x, 9, 20, kc('murasaki', 1))
    rc(c, 0, 0, 32, 7, kc('murasaki', -1)); hl(c, 0, 1, 32, kc('murasaki', 0))                       # 바란스
    for x in range(0, 32, 8): vl(c, x + 7, 1, 5, kc('murasaki', -2))
    for x in range(32): px(c, x, 6, kc('kii', 0) if x % 2 else kc('kii', -1))                        # 금색 술
    hl(c, 0, 0, 32, OL); hl(c, 0, 30, 32, kc('murasaki', -2)); hl(c, 0, 31, 32, OL)


@R.obj('gy-wall-bars', '늑목(벽 사다리)', w=1, h=1, up=32, kind='wall', use=('block',), tags=('체육관',),
       place='체육관 북쪽 벽 바로 아래 첫 바닥 줄 — 두세 개 나란히',
       desc='나무 기둥 둘 사이에 둥근 가로대가 촘촘히 걸린 벽 사다리(늑목). 벽면 두 줄을 덮고 솟는다. 체육관 벽에 2~3칸 이어 세운다.')
def _wall_bars(c):
    for x0 in (1, 12):
        rc(c, x0, 2, 3, 44, kc('yuka', 0)); vl(c, x0, 2, 44, kc('yuka', 2)); vl(c, x0 + 2, 2, 44, kc('ita', 0))
        rc(c, x0, 1, 3, 2, kc('yuka', 2)); outline(c, x0 - 1, 0, 5, 47)
    for y in range(6, 45, 4):
        hl(c, 4, y, 8, kc('yuka', 2)); hl(c, 4, y + 1, 8, kc('yuka', 0)); hl(c, 4, y + 2, 8, kc('ita', -2))
    rc(c, 0, 46, 16, 2, kc('ita', -2))


@R.obj('gy-mat', '체육 매트(깐 것)', w=2, h=1, kind='flat', use=('walk',), tags=('체육관',),
       place='코트 가장자리·무대 앞 빈 바닥', desc='바닥에 펼친 파란 체육 매트 2칸 — 누빈 줄과 앞 가장자리 두께 1줄. 밟고 지나간다.')
def _mat(c):
    rc(c, 1, 1, 30, 12, kc('sora', 1))
    hl(c, 1, 1, 30, kc('sora', 2)); vl(c, 1, 1, 12, kc('sora', 2))
    for x in (8, 16, 24): vl(c, x, 2, 11, kc('sora', 0))
    hl(c, 2, 7, 28, kc('sora', 0))
    rc(c, 1, 13, 30, 2, kc('sora', -1))
    for x in (4, 27): rc(c, x, 13, 2, 1, kc('shiro', 2))                                            # 손잡이 끈
    outline(c, 0, 0, 32, 16)


@R.obj('gy-mat-stack', '쌓은 체육 매트', w=2, h=1, up=6, kind='floor', use=('block',), tags=('체육관', '창고'),
       place='체육 창고 벽 곁', desc='파란 체육 매트 네 장을 포개 쌓은 더미 — 맨 위 누빈 윗면과 층층이 보이는 매트 옆면. 체육 창고에.')
def _mat_stack(c):
    rc(c, 1, 10, 30, 12, kc('sora', 1)); hl(c, 1, 10, 30, kc('sora', 2)); vl(c, 1, 10, 12, kc('sora', 2))
    for x in (8, 16, 24): vl(c, x, 11, 10, kc('sora', 0))
    hl(c, 2, 15, 28, kc('sora', 0)); hl(c, 1, 21, 30, kc('sora', 2))
    for k in range(4):
        y = 22 + k * 2 + (1 if k else 0)
        rc(c, 1, y, 30, 2, kc('sora', 0) if k % 2 == 0 else kc('kon', 1)); hl(c, 1, y + 1, 30, kc('kon', -1))
    hl(c, 1, 30, 30, kc('kon', -2))
    outline(c, 0, 9, 32, 23)


@R.obj('gy-vault-box', '뜀틀', w=1, h=1, up=10, kind='floor', use=('block',), tags=('체육관', '창고'),
       place='체육 창고 또는 매트 앞', desc='흰 천을 씌운 윗판 아래로 나무 단이 층층이 넓어지는 뜀틀(손잡이 구멍). 1칸.')
def _vault_box(c):
    rc(c, 4, 7, 8, 4, kc('shiro', 3)); hl(c, 4, 7, 8, kc('shiro', 4)); hl(c, 4, 10, 8, kc('shiro', 2))   # 흰 가죽 윗면
    for x in range(5, 12, 2): px(c, x, 9, kc('shiro', 1))                                            # 바늘땀
    outline(c, 3, 6, 10, 6)
    y = 12
    for k, (x0, w) in enumerate(((3, 10), (2, 12), (2, 12), (1, 14), (1, 14))):
        rc(c, x0, y, w, 3, kc('yuka', 1)); hl(c, x0, y, w, kc('yuka', 2)); vl(c, x0, y, 3, kc('yuka', 2)); vl(c, x0 + w - 1, y, 3, kc('ita', 1))
        hl(c, x0, y + 3, w, kc('ita', -2))                                                           # 단 사이 틈
        if k == 0: rc(c, 6, y + 1, 4, 1, kc('ita', -3))                                              # 손잡이 구멍
        vl(c, x0 - 1, y, 4, OL); vl(c, x0 + w, y, 4, OL)
        y += 4
    hl(c, 1, 31, 14, OL)

@R.obj('gy-ball-cart', '공 바구니 수레', w=1, h=1, up=10, kind='floor', use=('search',), tags=('체육관', '창고'),
       place='체육 창고·코트 가장자리', desc='철망 바구니 수레에 주황 농구공이 수북이 담겼다 — 위로 공이 솟고 앞면 철망 사이로 공이 보인다. 아래 바퀴 넷.')
def _ball_cart(c):
    rc(c, 1, 14, 14, 13, kc('tekko', -2))                                                           # 바구니 속
    for (bx, by) in ((4, 18), (10, 19), (7, 23), (12, 24), (3, 24)):
        disc(c, bx, by, 2.6, 2.6, kc('daidai', -1))
    for (bx, by) in ((4, 11), (9, 9), (12, 12), (6, 14), (11, 15)):                                 # 위로 솟은 공
        disc(c, bx, by, 3, 3, OL); disc(c, bx, by, 2.4, 2.4, kc('daidai', 0)); px(c, bx - 1, by - 1, kc('daidai', 2))
        hl(c, bx - 2, by, 4, kc('daidai', -2)); vl(c, bx, by - 2, 4, kc('daidai', -2))
    hl(c, 1, 14, 14, kc('tekko', 2)); hl(c, 1, 15, 14, kc('tekko', 0))                              # 테
    for x in range(1, 16, 3): vl(c, x, 15, 12, kc('tekko', 1))                                      # 철망
    for y in (19, 23): hl(c, 1, y, 14, kc('tekko', 1))
    outline(c, 0, 14, 16, 14)
    for wx in (1, 5, 10, 13): rc(c, wx, 28, 2, 3, OL); px(c, wx, 28, kc('tekko', 1))


@R.obj('gy-net-post', '배구 지주(네트 감음)', w=1, h=1, up=32, kind='floor', use=('block',), tags=('체육관', '창고', '배구'),
       place='체육 창고 벽 곁에 하나 또는 둘', desc='둥근 무게 받침에 선 은색 배구 지주 — 기둥에 흰 띠의 배구 네트를 둘둘 감아 세워 둔 것. 체육 창고에.')
def _net_post(c):
    rc(c, 7, 2, 3, 38, kc('tekko', 1)); vl(c, 7, 2, 38, kc('tekko', 3)); vl(c, 9, 2, 38, kc('tekko', -1))
    rc(c, 6, 1, 5, 2, kc('tekko', 3)); outline(c, 6, 0, 5, 41)
    for y in range(10, 31):                                                                         # 감긴 네트
        hw = 3 if 12 <= y <= 28 else 2
        for x in range(8 - hw, 9 + hw):
            col = kc('sumi', 1) if (x + y) % 3 == 0 else kc('conc', 0)
            px(c, x, y, col)
    for y in (10, 18, 26): hl(c, 5, y, 7, kc('shiro', 3)); hl(c, 5, y + 1, 7, kc('shiro', 1))       # 흰 띠
    vl(c, 4, 12, 17, OL); vl(c, 12, 12, 17, OL)
    disc(c, 8, 41.5, 6, 2.6, OL); disc(c, 8, 41, 5, 2, kc('tekko', 0)); hl(c, 5, 40, 5, kc('tekko', 2))   # 받침
    rc(c, 3, 42, 11, 3, kc('tekko', -2)); hl(c, 3, 44, 11, OL)


@R.obj('gy-score-board', '점수판(넘김식)', w=1, h=1, up=16, kind='floor', use=('read',), tags=('체육관',),
       place='코트 옆 선 바깥, 무대 반대쪽 벽 곁', desc='철 다리 위 넘김식 점수판 — 숫자 대신 빨강·파랑 색 칸 넘김장 두 묶음과 위 고리. 코트 옆에 하나.')
def _score_board(c):
    rc(c, 1, 4, 14, 14, kc('tekko', -1)); hl(c, 1, 4, 14, kc('tekko', 1)); outline(c, 0, 3, 16, 16)
    for i, (x, r) in enumerate(((2, 'aka'), (9, 'sora'))):
        rc(c, x, 7, 5, 9, kc('shiro', 3)); hl(c, x, 15, 5, kc('shiro', 1))
        rc(c, x + 1, 9, 3, 5, kc(r, 0)); hl(c, x + 1, 9, 3, kc(r, 2))
        for k in range(3): hl(c, x, 6 - k // 2, 5, kc('shiro', 2 - k))                             # 넘김장 겹
        px(c, x + 1, 4, kc('tekko', 3)); px(c, x + 3, 4, kc('tekko', 3))                           # 고리
    vl(c, 8, 7, 9, kc('tekko', -2))
    for x in (3, 12):                                                                                # 다리
        vl(c, x, 19, 10, kc('tekko', 1)); vl(c, x + 1, 19, 10, kc('tekko', -2))
    rc(c, 1, 28, 14, 2, kc('tekko', 1)); hl(c, 1, 28, 14, kc('tekko', 3)); hl(c, 1, 30, 14, OL)


@R.obj('gy-pipe-chair', '접이 의자 수레', w=1, h=1, up=16, kind='floor', use=('block',), tags=('체육관', '창고'),
       place='체육 창고·무대 옆', desc='낮은 수레에 접은 철제 파이프 의자를 여러 개 겹쳐 세운 것 — 갈색 좌판·등판 띠가 층층이, 은색 파이프 다리. 강당 행사용.')
def _pipe_chair(c):
    for k in range(7):
        y = 4 + k * 3
        rc(c, 3, y, 10, 2, kc('ita', 1) if k % 2 == 0 else kc('ita', 0)); hl(c, 3, y + 2, 10, kc('ita', -2))
        px(c, 3, y, kc('ita', 2))
    for x in (2, 13):
        vl(c, x, 3, 25, kc('tekko', 2)); vl(c, x + (1 if x == 2 else -1), 4, 23, kc('tekko', -1))
    hl(c, 2, 3, 12, kc('tekko', 3))
    outline(c, 1, 2, 14, 26)
    rc(c, 0, 27, 16, 3, kc('tekko', 0)); hl(c, 0, 27, 16, kc('tekko', 2)); hl(c, 0, 29, 16, OL)      # 수레
    for wx in (1, 13): rc(c, wx, 30, 2, 2, OL)


@R.obj('gy-clock-cage', '망 씌운 벽시계', w=1, kind='hang', hrows=2, use=('read',), tags=('체육관',),
       place='체육관 벽면 윗줄(공이 맞지 않게 철망 덮개)', pair=('gy-score-board',),
       desc='둥근 흰 벽시계에 공을 막는 철망 덮개를 씌운 것. 숫자 대신 눈금 점. 체육관 벽 윗줄에 하나.')
def _clock_cage(c):
    disc(c, 8, 10, 6, 6, OL); disc(c, 8, 10, 5, 5, kc('shiro', 3)); disc(c, 7, 9, 2, 2, kc('shiro', 4))
    for a in range(12):
        t = a * math.pi / 6
        px(c, int(round(8 + 4 * math.cos(t) - .5)), int(round(10 + 4 * math.sin(t) - .5)), kc('conc', 0))
    vl(c, 8, 6, 4, OL); hl(c, 8, 10, 3, OL)
    for y in range(3, 18, 2): hl(c, 2, y, 12, kc('tekko', 1))                                        # 철망
    for x in range(2, 15, 2): vl(c, x, 3, 15, kc('tekko', 0))
    outline(c, 1, 2, 14, 17, kc('tekko', -2))


@R.table('gy-folding-table', '접이 장탁자(강당용)', tags=('체육관', '강당', '교무'),
         desc='베이지 윗판에 철 다리를 접는 긴 탁자 — 강당 행사·체육 교사 자리. 아무 w×h. 위에 호루라기·초시계 같은 탁상 물건을 올린다.')
def _folding_table(c, w, h):
    W, H = w * 16, h * 16
    c.R(0, 0, W, H - 5, kc('kinari', 1))
    hl(c, 0, 1, W, kc('kinari', 2)); vl(c, 1, 0, H - 5, kc('kinari', 2))
    hl(c, 0, H - 6, W, kc('kinari', 2))
    rc(c, 0, H - 5, W, 2, kc('kinari', -1)); hl(c, 0, H - 3, W, kc('kinari', -2))
    for x in (2, W - 4): rc(c, x, H - 3, 2, 3, kc('tekko', 1))
    outline(c, 0, 0, W, H - 2)


# ══ 유치원 바닥·벽면 ══════════════════════════════════════════════════════════
@R.wall('gy-kinder-wall', '유치원 파스텔 벽(하늘색 허리)', cols=2, tags=('유치원', '놀이방'),
        desc='크림색 벽에 분홍·노랑 작은 물방울 점, 아래 하늘색 허리 판과 흰 테. 유치원 놀이방·낮잠 방.')
def _kinder_wall(c):
    c.R(0, 0, 32, 18, kc('kinari', 2))
    for (x, y, r) in ((4, 4, 'pinku'), (20, 3, 'kii'), (12, 10, 'sora'), (28, 11, 'pinku'), (6, 14, 'kii'), (22, 15, 'midori')):
        rc(c, x, y, 2, 2, kc(r, 2)); px(c, x, y, kc(r, 3) if r != 'kii' else kc('kinari', 2))
    hl(c, 0, 17, 32, kc('shiro', 4)); hl(c, 0, 18, 32, kc('sora', 1))
    rc(c, 0, 19, 32, 11, kc('sora', 2))
    for x in range(0, 32, 8): vl(c, x, 19, 11, kc('sora', 1))
    rc(c, 0, 30, 32, 2, kc('sora', 0)); hl(c, 0, 30, 32, kc('sora', 1))


# ══ 유치원 가구 ═══════════════════════════════════════════════════════════════
@R.obj('gy-cubby', '아이 사물함(3칸)', w=3, h=1, up=10, kind='wall', use=('open',), tags=('유치원', '놀이방'),
       place='놀이방 북쪽 벽 바로 아래 첫 바닥 줄', desc='낮은 나무 사물함 3칸 — 칸마다 색 스티커 표시(글자 없음), 윗단에 색 가방, 아랫단 고리에 노란 모자. 아이 열두 명 몫.')
def _cubby(c):
    W = 48
    rc(c, 0, 6, W, 4, kc('mado', 1)); hl(c, 0, 6, W, kc('mado', 0))                                 # 윗면(T 5)
    hl(c, 0, 10, W, kc('mado', 2))                                                                  # 앞 가장자리 하이라이트
    rc(c, 0, 11, W, 19, kc('mado', 0)); hl(c, 0, 11, W, kc('mado', -2)); hl(c, 0, 12, W, kc('mado', -1))   # 처마 그림자
    marks = ('pinku', 'kii', 'midori', 'sora', 'daidai', 'murasaki')
    for i in range(6):
        x = 1 + i * 8
        for (y, hgt) in ((13, 8), (22, 7)):
            rc(c, x, y, 6, hgt, kc('mado', -2)); hl(c, x, y, 6, OL)
            vl(c, x + 6, y, hgt, kc('mado', 1))
        r = marks[i % 6]
        rc(c, x + 2, 14, 2, 2, kc(r, 1))                                                            # 색 스티커
        if i % 3 != 2:                                                                               # 가방
            rc(c, x + 1, 17, 5, 4, kc(marks[(i + 2) % 6], 0)); hl(c, x + 1, 17, 5, kc(marks[(i + 2) % 6], 1))
        px(c, x + 3, 23, kc('tekko', 3))                                                             # 고리
        if i % 2 == 0:                                                                               # 노란 모자
            disc(c, x + 3, 26, 2.6, 2, kc('kii', 1)); hl(c, x + 1, 27, 5, kc('kii', -1))
    rc(c, 0, 30, W, 2, kc('mado', -2)); hl(c, 0, 31, W, OL)
    outline(c, 0, 5, W, 27)


@R.table('gy-kid-table', '유치원 낮은 탁자', tags=('유치원', '놀이방'),
         desc='연한 나무 윗판에 초록 테를 두른 낮은 아이 탁자 — 짧은 다리. 아무 w×h(보통 2×1). 둘레에 작은 의자(gy-kid-chair-*)가 탁자를 본다. 위에 크레용·색종이.')
def _kid_table(c, w, h):
    W, H = w * 16, h * 16
    c.R(0, 0, W, H - 5, kc('mado', 2))
    for y in range(3, H - 6, 5): hl(c, 0, y, W, kc('mado', 1))
    hl(c, 0, 0, W, kc('midori', 1)); vl(c, 0, 0, H - 5, kc('midori', 1)); vl(c, W - 1, 0, H - 5, kc('midori', 0))
    rc(c, 0, H - 5, W, 2, kc('midori', 0)); hl(c, 0, H - 5, W, kc('midori', 2))                     # 앞 테
    hl(c, 0, H - 3, W, kc('midori', -2))
    for x in (1, W - 3): rc(c, x, H - 3, 2, 3, kc('mado', -1))
    outline(c, 0, 0, W, H - 2)


def _kid_chair(c, f):
    col, dk = kc('kii', 1), kc('kii', -1)
    if f == 's':                                                    # 남향: 등받이가 북쪽(뒤)
        rc(c, 4, 13, 8, 6, col); hl(c, 4, 13, 8, kc('kii', 2)); outline(c, 3, 12, 10, 8)
        rc(c, 4, 20, 8, 4, kc('mado', 1)); hl(c, 4, 20, 8, kc('mado', 2)); outline(c, 3, 19, 10, 6)
        hl(c, 4, 25, 8, kc('mado', -1))
        for x in (4, 10): rc(c, x, 25, 2, 4, kc('mado', -1)); px(c, x, 28, OL)
    elif f == 'n':                                                  # 북향: 등받이가 남쪽(앞)
        rc(c, 4, 17, 8, 3, kc('mado', 1)); hl(c, 4, 17, 8, kc('mado', 2)); outline(c, 3, 16, 10, 4)   # 좌판(앞 탁자 칸 4층을 비운다)
        rc(c, 4, 20, 8, 6, col); hl(c, 4, 20, 8, kc('kii', 2)); hl(c, 4, 25, 8, dk); outline(c, 3, 19, 10, 8)
        for x in (4, 10): rc(c, x, 27, 2, 3, kc('mado', -1)); px(c, x, 29, OL)
    else:                                                           # 옆모습(L자): e = 동쪽을 봄 → 등받이 서쪽
        bx = 3 if f == 'e' else 11
        rc(c, 4, 20, 8, 3, kc('mado', 1)); hl(c, 4, 20, 8, kc('mado', 2)); outline(c, 3, 19, 10, 5)  # 좌판(윗면 3)
        rc(c, bx, 12, 2, 10, col); vl(c, bx, 12, 10, kc('kii', 2)); outline(c, bx - 1, 11, 4, 12)    # 등받이
        for x in (4, 10): rc(c, x, 24, 2, 5, kc('mado', -1)); px(c, x, 28, OL)


for _f, _k, _p in (('s', 'S', '탁자 북쪽'), ('n', 'N', '탁자 남쪽'), ('e', 'E', '탁자 서쪽'), ('w', 'W', '탁자 동쪽')):
    R.obj('gy-kid-chair-' + _f, '아이 의자(%s향)' % {'s': '남', 'n': '북', 'e': '동', 'w': '서'}[_f], w=1, h=1, up=4, kind='floor', use=('sit',), facing=_k,
          tags=('유치원', '놀이방'), place=_p, pair=('gy-kid-table',),
          desc='노란 등받이에 나무 좌판의 작은 아이 의자. %s에 놓고 탁자를 본다.' % _p)(lambda c, f=_f: _kid_chair(c, f))


@R.obj('gy-upright-piano', '업라이트 피아노', w=2, h=1, up=10, kind='wall', use=('sit',), tags=('유치원', '놀이방', '음악실'),
       place='놀이방 북쪽 벽 바로 아래 첫 바닥 줄', desc='검은 광택 업라이트 피아노 — 뚜껑 윗면, 악보 받침 앞판, 흰 건반 줄과 검은 건반, 아래 금색 페달. 놀이방 벽에 하나.')
def _piano(c):
    rc(c, 1, 6, 30, 4, kc('yoru', 1)); hl(c, 1, 6, 30, kc('yoru', 0)); hl(c, 1, 10, 30, kc('yoru', 3))   # 뚜껑 윗면 + 앞 가장자리
    rc(c, 1, 11, 30, 8, kc('yoru', -1)); hl(c, 1, 11, 30, kc('yoru', -3)); hl(c, 1, 12, 30, kc('yoru', -2))
    for x in (6, 22): vl(c, x, 13, 5, kc('yoru', 1))                                                   # 광택 결
    rc(c, 9, 13, 14, 3, kc('kinari', 2)); hl(c, 9, 15, 14, kc('kinari', 0))                            # 악보(글자 없는 줄)
    for x in range(10, 22, 3): px(c, x, 14, kc('kinari', 0))
    rc(c, 0, 19, 32, 4, kc('shiro', 3)); hl(c, 0, 19, 32, kc('yoru', -2))                              # 건반
    for x in range(1, 31, 2): px(c, x, 22, kc('shiro', 1))
    for x in (2, 5, 9, 12, 15, 19, 22, 26, 29): rc(c, x, 20, 1, 2, OL)
    hl(c, 0, 23, 32, kc('yoru', -2))
    rc(c, 1, 24, 30, 7, kc('yoru', -1)); vl(c, 2, 24, 7, kc('yoru', 1))
    for x in (13, 16, 19): px(c, x, 29, kc('kii', 2)); px(c, x, 30, kc('kii', 0))                     # 페달
    outline(c, 0, 5, 32, 27)


@R.obj('gy-picture-books', '그림책 낮은 선반', w=2, h=1, up=4, kind='wall', use=('read',), tags=('유치원', '놀이방', '도서'),
       place='놀이방 북쪽 벽 바로 아래 첫 바닥 줄', desc='아이 키 높이의 나무 선반 — 그림책 표지가 앞을 보게 두 단으로 세워 꽂혔다(표지는 색 덩이·도형뿐, 글자·사람 없음).')
def _picture_books(c):
    rc(c, 0, 12, 32, 3, kc('mado', 1)); hl(c, 0, 12, 32, kc('mado', 0)); hl(c, 0, 15, 32, kc('mado', 2))
    rc(c, 0, 16, 32, 14, kc('mado', -1)); hl(c, 0, 16, 32, kc('mado', -2))
    cols = ('aka', 'sora', 'kii', 'midori', 'pinku', 'daidai', 'kon', 'kii')
    for row, y in enumerate((17, 24)):
        for i in range(5):
            x = 1 + i * 6 + row * 1
            r = cols[(i + row * 3) % 8]
            rc(c, x, y, 5, 6, kc(r, 1)); hl(c, x, y, 5, kc(r, 2)); vl(c, x + 4, y, 6, kc(r, -1))
            if (i + row) % 2: disc(c, x + 2.5, y + 3.5, 1.4, 1.4, kc('shiro', 3))                   # 해·동그라미
            else: hl(c, x + 1, y + 4, 3, kc('shiro', 3))
        hl(c, 0, y + 6, 32, kc('mado', 0))
    rc(c, 0, 30, 32, 2, kc('mado', -2)); outline(c, 0, 11, 32, 21)


@R.obj('gy-toy-box', '장난감 상자', w=1, h=1, up=0, kind='floor', use=('open', 'search'), tags=('유치원', '놀이방'),
       place='놀이방 구석·매트 곁', desc='분홍 나무 상자에 공·쌓기 블록·고리 장난감이 넘치게 담겼다. 1칸.')
def _toy_box(c):
    rc(c, 1, 4, 14, 4, kc('pinku', -1))                                                             # 상자 속
    disc(c, 5, 4, 2.5, 2.5, kc('aka', 1)); px(c, 4, 3, kc('aka', 3))                                # 공
    rc(c, 8, 2, 3, 3, kc('kii', 2)); hl(c, 8, 2, 3, kc('kii', 3)); outline(c, 7, 1, 5, 5)          # 블록
    ring(c, 12.5, 4.5, 2.5, 2, kc('sora', 1))
    hl(c, 1, 7, 14, kc('pinku', 3))                                                                 # 앞 테(윗면 가장자리)
    rc(c, 1, 8, 14, 7, kc('pinku', 1)); hl(c, 1, 8, 14, kc('pinku', -1))
    for x in (5, 10): vl(c, x, 9, 5, kc('pinku', 2))
    hl(c, 1, 14, 14, kc('pinku', -1)); outline(c, 0, 3, 16, 13)


@R.obj('gy-blocks-mat', '놀이 매트(퍼즐)', w=2, h=2, kind='flat', use=('walk',), tags=('유치원', '놀이방'),
       place='놀이방 빈 바닥 한가운데', desc='분홍·노랑·초록·하늘색 폼 퍼즐 조각을 이어 붙인 놀이 매트 2×2. 밟고 앉아 논다.')
def _blocks_mat(c):
    cols = (('pinku', 2), ('kii', 2), ('midori', 2), ('sora', 2))
    for ty in range(2):
        for tx in range(2):
            r, t = cols[(tx + ty * 2 + ty) % 4]
            x0, y0 = tx * 16, ty * 16
            rc(c, x0, y0, 16, 16, kc(r, t - 1)); hl(c, x0, y0, 16, kc(r, t)); vl(c, x0, y0, 16, kc(r, t))
            hl(c, x0, y0 + 15, 16, kc(r, t - 2)); vl(c, x0 + 15, y0, 16, kc(r, t - 2))
            rc(c, x0 + 6, y0 + 15, 4, 2, kc(r, t - 1)); rc(c, x0 + 15, y0 + 6, 2, 4, kc(r, t - 1))   # 퍼즐 이음 혹
    outline(c, 0, 0, 32, 32, kc('conc', -1))


@R.obj('gy-nap-futon', '낮잠 이불(아이)', w=1, h=1, kind='flat', use=('sleep',), tags=('유치원', '낮잠'),
       place='낮잠 방 바닥에 줄지어', desc='아이 몸만 한 작은 요 — 흰 베개와 하늘색 별 무늬 덮개. 낮잠 방에 여러 장 줄지어 편다.')
def _nap_futon(c):
    rc(c, 2, 1, 12, 14, kc('kinari', 2)); outline(c, 1, 0, 14, 16, kc('kinari', -1))                # 요(크림)
    rc(c, 4, 2, 8, 3, kc('shiro', 4)); hl(c, 4, 4, 8, kc('shiro', 2)); vl(c, 11, 2, 3, kc('shiro', 2))   # 베개
    rc(c, 2, 6, 12, 8, kc('pinku', 2)); hl(c, 2, 6, 12, kc('shiro', 4)); hl(c, 2, 7, 12, kc('pinku', 3))   # 덮개(접힌 흰 단 + 분홍)
    hl(c, 2, 10, 12, kc('pinku', 1))                                                                  # 줄 하나
    vl(c, 13, 7, 7, kc('pinku', 0)); hl(c, 2, 14, 12, kc('kinari', 0))

@R.obj('gy-kids-sink', '아이 세면대(낮은 줄)', w=2, h=1, up=8, kind='wall', use=('open',), tags=('유치원', '세면'),
       place='세면·화장실 북쪽 벽 바로 아래 첫 바닥 줄', desc='아이 키 높이의 긴 흰 타일 개수대 — 은색 수도꼭지 셋, 오목한 물받이, 앞면 흰 타일.')
def _kids_sink(c):
    for x in (6, 15, 24):
        rc(c, x, 9, 2, 4, kc('tekko', 2)); px(c, x, 9, kc('shiro', 4)); px(c, x + 2, 12, kc('tekko', 1)); outline(c, x - 1, 8, 4, 6)
    rc(c, 1, 13, 30, 5, kc('shiro', 3)); hl(c, 1, 13, 30, kc('shiro', 4))                             # 윗면 테
    rc(c, 3, 14, 26, 3, kc('sora', 1)); hl(c, 3, 14, 26, kc('conc', 1))                              # 물받이 속
    hl(c, 1, 18, 30, kc('shiro', 4))
    rc(c, 1, 19, 30, 10, kc('shiro', 1)); hl(c, 1, 19, 30, kc('conc', 2))
    for x in range(1, 31, 5): vl(c, x, 20, 9, kc('shiro', 0))
    hl(c, 1, 24, 30, kc('shiro', 0))
    rc(c, 1, 29, 30, 2, kc('conc', 0)); outline(c, 0, 12, 32, 20)


@R.obj('gy-shoe-cubby', '아이 신발장', w=2, h=1, up=4, kind='floor', use=('open',), tags=('유치원', '현관'),
       place='출입구 곁, 들어온 줄 옆', desc='낮은 나무 신발장 2칸 — 두 단 여덟 칸에 작은 실내화·운동화가 한 켤레씩. 유치원 현관 곁.')
def _shoe_cubby(c):
    rc(c, 0, 12, 32, 3, kc('shiro', 3)); hl(c, 0, 12, 32, kc('shiro', 2)); hl(c, 0, 15, 32, kc('shiro', 4))   # 흰 윗면
    rc(c, 0, 16, 32, 15, kc('sora', 2)); hl(c, 0, 16, 32, kc('sora', 0))                               # 하늘색 몸통
    for row, y in enumerate((17, 24)):
        for i in range(3):
            x = 1 + i * 10 + (1 if i else 0)
            rc(c, x, y, 9, 6, kc('sora', -1)); hl(c, x, y, 9, kc('sora', -2)); vl(c, x + 9, y, 6, kc('sora', 3))
            if (i + row) % 3 != 2:                                                                    # 실내화 한 켤레(앞코가 앞)
                for sx in (x + 1, x + 5):
                    rc(c, sx, y + 2, 3, 4, kc('shiro', 3)); hl(c, sx, y + 2, 3, kc('shiro', 4))
                    hl(c, sx, y + 3, 3, kc(('aka', 'kon', 'midori')[(i + row) % 3], 1))               # 고무 밴드
                    hl(c, sx, y + 5, 3, kc('conc', 0))                                                 # 밑창
    rc(c, 0, 30, 32, 2, kc('sora', -1)); hl(c, 0, 31, 32, OL); outline(c, 0, 11, 32, 21)

@R.obj('gy-drawing-board', '그림 게시판', w=2, kind='hang', hrows=2, use=('read',), tags=('유치원', '놀이방'),
       place='놀이방 벽면 윗줄', desc='나무 틀 코르크 게시판에 아이들이 그린 색종이 그림(해·꽃·색 동그라미 — 사람·글자 없음)을 압정으로 붙였다.')
def _drawing_board(c):
    bev(c, 0, 2, 32, 26, 'mado', 0)
    rc(c, 2, 4, 28, 22, kc('soil', 2))
    for y in range(4, 26):
        for x in range(2, 30):
            if rnd(x, y, 21, 120): px(c, x, y, kc('soil', 1))
    papers = ((3, 5, 'pinku'), (10, 6, 'kii'), (17, 5, 'sora'), (24, 6, 'shiro'), (4, 15, 'midori'), (11, 16, 'shiro'), (18, 15, 'daidai'), (24, 16, 'kii'))
    for i, (x, y, r) in enumerate(papers):
        t = 3 if r == 'shiro' else 2
        rc(c, x, y, 6, 8, kc(r, t)); hl(c, x, y + 7, 6, kc(r, t - 2)); vl(c, x + 5, y, 8, kc(r, t - 1))
        k = i % 3
        if k == 0: disc(c, x + 3, y + 3, 1.6, 1.6, kc('daidai', 1))                                  # 해
        elif k == 1: hl(c, x + 1, y + 5, 4, kc('midori', 0)); px(c, x + 2, y + 3, kc('aka', 1)); px(c, x + 3, y + 2, kc('aka', 1))  # 꽃
        else: ring(c, x + 3, y + 4, 2.2, 2.2, kc('kon', 1))
        px(c, x + 2, y, kc('aka', 1))                                                                 # 압정


# ══ 탁상 물건 ═════════════════════════════════════════════════════════════════
@R.good('gy-crayons', '크레용 상자', desc='노란 상자를 연 크레용 — 빨강·파랑·초록·노랑 끝이 줄지었다. 아이 탁자 위.')
def _crayons(c):
    rc(c, 3, 8, 10, 5, kc('kii', 1)); hl(c, 3, 8, 10, kc('kii', 3)); hl(c, 3, 12, 10, kc('kii', -1))
    for i, r in enumerate(('aka', 'sora', 'midori', 'kii', 'pinku')):
        rc(c, 4 + i * 2, 5, 1, 3, kc(r, 1)); px(c, 4 + i * 2, 4, kc(r, 2))
    outline(c, 2, 7, 12, 7)
    rc(c, 6, 13, 6, 1, kc('kii', -2))


@R.good('gy-whistle', '호루라기', desc='은색 호루라기와 빨간 목줄 고리. 체육 교사 탁자 위.')
def _whistle(c):
    ring(c, 7, 8, 5, 4, kc('aka', 0)); px(c, 4, 6, kc('aka', 2))
    rc(c, 7, 9, 6, 4, kc('tekko', 2)); hl(c, 7, 9, 6, kc('shiro', 4)); disc(c, 10.5, 11.5, 2, 2, kc('tekko', 1))
    outline(c, 6, 8, 8, 6)


@R.good('gy-stopwatch', '초시계', desc='둥근 은색 초시계 — 흰 판에 바늘 하나, 위 단추. 숫자 없음.')
def _stopwatch(c):
    disc(c, 8, 9.5, 5, 5, OL); disc(c, 8, 9.5, 4, 4, kc('tekko', 2)); disc(c, 8, 9.5, 3, 3, kc('shiro', 3))
    px(c, 6, 7, kc('shiro', 4)); vl(c, 8, 7, 3, OL)
    rc(c, 7, 2, 3, 3, kc('tekko', 1)); hl(c, 7, 2, 3, kc('tekko', 3)); outline(c, 6, 1, 5, 4)


@R.good('gy-origami', '색종이·종이학', desc='분홍·하늘색 색종이 몇 장과 접은 종이학 하나. 아이 탁자 위.')
def _origami(c):
    rc(c, 2, 8, 7, 6, kc('sora', 2)); hl(c, 2, 8, 7, kc('sora', 3)); outline(c, 1, 7, 9, 8, kc('sora', -1))
    rc(c, 5, 10, 6, 5, kc('pinku', 2)); hl(c, 5, 10, 6, kc('pinku', 3)); outline(c, 4, 9, 8, 7, kc('pinku', -1))
    for i in range(5): hl(c, 10 + i // 2, 7 - i, 1, kc('kii', 2))                                    # 학 날개
    rc(c, 10, 6, 4, 2, kc('kii', 2)); px(c, 14, 5, kc('kii', 1)); px(c, 9, 7, kc('kii', 1)); hl(c, 10, 8, 4, kc('kii', -1))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

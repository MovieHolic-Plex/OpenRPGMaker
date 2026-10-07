#!/usr/bin/env python3
"""jp_city 일본 실내 — 공공·목욕탕 (센토·코인세탁·파출소·의원). id 머리 `pb-`.

칸 16px, 3/4 시점(윗면 + 정면 한 면), 왼위 빛, 외곽선 1px, 팔레트 modern3 만. 글자·숫자·상표·사람 없음.
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (up/16 + h)*16, hang = w*16 × hrows*16, table = fn(c,w,h).

※ 분류표(categories.py)에 이 id 들이 아직 없다 — 이 파일이 import 될 때 메모리에서만 BY_ID 에 끼워 넣는다
  (selftest·preview 가 돌도록). 정식 등록은 감독이 categories.py 에 해야 한다. 파일은 건드리지 않았다.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT
import categories as CATS

BLOCK = 'interior_public'
R = Registry(BLOCK, '공공·목욕탕')

# ── 분류 제안(감독이 categories.py 로 옮길 것) ────────────────────────────────
PROPOSED = {
    'sento': ('목욕탕', ['pb-bandai', 'pb-locker', 'pb-basket-shelf', 'pb-scale', 'pb-massage-chair', 'pb-milk-fridge',
                         'pb-wash-station', 'pb-wash-stool', 'pb-mural', 'pb-noren-m', 'pb-noren-f']),
    'laundry': ('코인세탁', ['pb-washer', 'pb-dryer', 'pb-fold-table', 'pb-bench', 'pb-vending', 'pb-changer']),
    'koban': ('파출소', ['pb-police-desk', 'pb-office-chair-s', 'pb-office-chair-n', 'pb-map-board', 'pb-file-cabinet', 'pb-bicycle']),
    'clinic': ('의원', ['pb-reception', 'pb-waiting-sofa-s', 'pb-waiting-sofa-n', 'pb-exam-bed', 'pb-curtain', 'pb-doctor-desk',
                        'pb-med-cabinet', 'pb-scale-height']),
}


def _patch_categories():
    for cat, (ko, ids) in PROPOSED.items():
        for i in ids:
            if i not in CATS.BY_ID:
                CATS.BY_ID[i] = (cat, ko)


_patch_categories()

# ── 도우미 ────────────────────────────────────────────────────────────────────
_KC = {}


def kc(ramp, t):
    key = (ramp, t)
    if key not in _KC:
        tt = t
        while True:
            try:
                _KC[key] = K(ramp, tt); break
            except Exception:
                if tt == 0: raise
                tt += -1 if tt > 0 else 1
    return _KC[key]


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


def ring(c, cx, cy, r, col):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) ** .5
            if r - 1.0 < d <= r: px(c, x, y, col)


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


# ══ 바닥·벽 ═══════════════════════════════════════════════════════════════════
@R.floor('pb-sento-tile', '목욕탕 타일 바닥', cols=2, rows=2, tags=('목욕탕', '센토'),
         desc='작은 흰색·하늘색 8px 타일. 줄눈은 연한 하늘색, 타일마다 윗·왼 변이 밝다. 목욕탕 탈의실·욕탕 바닥.')
def _sento_tile(c):
    for ty in range(4):
        for tx in range(4):
            x0, y0 = tx * 8, ty * 8
            blue = (tx + ty) % 2 == 1
            base = kc('sora', 3) if blue else kc('shiro', 1)
            c.R(x0, y0, 8, 8, base)
            hl(c, x0, y0, 8, kc('shiro', 3) if not blue else kc('sora', 4)); vl(c, x0, y0, 8, kc('shiro', 3) if not blue else kc('sora', 4))
            hl(c, x0, y0 + 7, 8, kc('sora', 1)); vl(c, x0 + 7, y0, 8, kc('sora', 1))
            if rnd(tx, ty, 5, 260): px(c, x0 + 3, y0 + 3, kc('sora', 2) if not blue else kc('sora', 4))


@R.wall('pb-sento-wall', '목욕탕 타일 벽', cols=2, tags=('목욕탕', '센토'),
        desc='하늘색 8px 타일 벽, 아래 한 단은 흰 타일 허리띠. 윗면(1행)과 앞면(2행)이 이어진다.')
def _sento_wall(c):
    for ty in range(4):
        for tx in range(4):
            x0, y0 = tx * 8, ty * 8
            low = ty == 3
            base = kc('shiro', 1) if low else kc('sora', 2)
            c.R(x0, y0, 8, 8, base)
            hl(c, x0, y0, 8, kc('shiro', 3) if low else kc('sora', 4)); vl(c, x0, y0, 8, kc('shiro', 3) if low else kc('sora', 4))
            hl(c, x0, y0 + 7, 8, kc('sora', 0) if low else kc('sora', 1)); vl(c, x0 + 7, y0, 8, kc('sora', 0) if low else kc('sora', 1))
    hl(c, 0, 23, 32, kc('sora', -1))                                                                 # 허리띠 위 선
    hl(c, 0, 24, 32, kc('shiro', 3))


@R.floor('pb-linoleum', '리놀륨 바닥(연녹·베이지 체크)', cols=2, rows=2, tags=('의원', '코인세탁', '파출소'),
         desc='연한 연녹·베이지 16px 판이 체크로 이어지고 드문 얼룩 점이 있는 리놀륨. 코인세탁·파출소·의원 공용 바닥.')
def _linoleum(c):
    for by in (0, 1):                                                                                  # 16px 판 체크 — 두 톤이 가깝다
        for bx in (0, 1):
            c.R(bx * 16, by * 16, 16, 16, kc('lino', 2 if (bx + by) % 2 == 0 else 1))
    for y in range(32):
        for x in range(32):
            if rnd(x, y, 3, 22): px(c, x, y, kc('lino', 3 if ((x // 16) + (y // 16)) % 2 == 0 else 2))   # 드문 얼룩 점
    hl(c, 0, 0, 32, kc('lino', 0)); vl(c, 0, 0, 32, kc('lino', 0))                                     # 판 이음선
    hl(c, 0, 16, 32, kc('lino', 0)); vl(c, 16, 0, 32, kc('lino', 0))


@R.wall('pb-office-wall', '사무실 벽(크림·회색 걸레받이)', cols=2, tags=('파출소', '의원', '코인세탁'),
        desc='크림색 벽에 아래 회색 걸레받이. 코인세탁·파출소·의원 공용 벽.')
def _office_wall(c):
    c.R(0, 0, 32, 26, kc('kinari', 2))
    for x in range(0, 32, 16): vl(c, x, 0, 26, kc('kinari', 1))                                       # 벽지 이음
    for y in range(32):
        for x in range(32):
            if y < 26 and rnd(x, y, 8, 25): px(c, x, y, kc('kinari', 1))
    hl(c, 0, 25, 32, kc('conc', 2))
    c.R(0, 26, 32, 6, kc('conc', 1)); hl(c, 0, 26, 32, kc('conc', 3)); hl(c, 0, 31, 32, kc('conc', -1)); hl(c, 0, 30, 32, kc('conc', 0))


# ══ 걸이(hang) ═══════════════════════════════════════════════════════════════
@R.obj('pb-mural', '후지산 벽화', w=3, kind='hang', hrows=2, cat='sento', cat_ko='목욕탕', tags=('목욕탕', '센토'), place='욕탕 북쪽 벽면',
       desc='타일에 칠한 후지산 벽화 3칸. 하늘·산·물·해뿐이고 사람과 글자는 없다. 욕조 뒤 벽 윗줄에 건다.')
def _mural(c):
    W, H = 48, 32
    c.R(0, 0, W, H, kc('sora', 3))
    for y in range(0, 14): hl(c, 0, y, W, kc('sora', 3 if y > 5 else 4))
    disc(c, 39, 7, 3.3, 3.3, kc('aka', 1)); disc(c, 38, 6, 1.4, 1.4, kc('aka', 2))                       # 해
    for (cx, cy, rx) in ((9, 8, 5), (14, 10, 4), (30, 4, 4)):                                             # 구름
        disc(c, cx, cy, rx, 1.8, kc('shiro', 3)); hl(c, cx - rx + 1, cy + 1, 2 * rx - 2, kc('sora', 4))
    cx = 24
    for y in range(8, 27):                                                                              # 산
        hw = 3.0 + (y - 8) * 1.35
        for x in range(int(cx - hw), int(cx + hw) + 1):
            dx = x - cx
            col = kc('kon', 1) if dx < -hw * .25 else (kc('kon', -1) if dx > hw * .45 else kc('kon', 0))
            if y <= 14 + (1 if (x + y) % 3 == 0 else 0) + (2 if abs(dx) > 5 else 0) * (1 if x % 2 else 0): col = kc('shiro', 3 if dx < hw * .3 else 1)
            px(c, x, y, col)
    for y in range(8, 27):
        hw = 3.0 + (y - 8) * 1.35
        px(c, int(cx - hw), y, kc('kon', 2) if y > 14 else kc('shiro', 3)); px(c, int(cx + hw), y, kc('kon', -2))
    for x in range(0, W):                                                                               # 물
        c.R(x, 25, 1, 7, kc('sora', 0))
    hl(c, 0, 25, W, kc('sora', 1))
    for y in range(26, 31):
        for x in range(W):
            if rnd(x, y, 9, 130): px(c, x, y, kc('shiro', 3) if y % 2 else kc('sora', 2))
    hl(c, 0, 31, W, kc('sora', -1))
    outline(c, 0, 0, W, H)


def _noren(c, ramp):
    rc(c, 0, 0, 16, 2, kc('ki', 1)); hl(c, 0, 0, 16, kc('ki', 3)); hl(c, 0, 2, 16, kc('ki', -2))        # 봉
    for x0, x1 in ((1, 7), (9, 15)):                                                                    # 두 폭
        for y in range(3, 15 + (1 if x0 == 1 else 0)):
            for x in range(x0, x1 + 1):
                col = kc(ramp, 0 if (x - x0) % 3 else 1)
                px(c, x, y, col)
        vl(c, x0, 3, 12, kc(ramp, 1)); vl(c, x1, 3, 12, kc(ramp, -2))
        hl(c, x0, 14, x1 - x0 + 1, kc(ramp, -2))
        outline(c, x0 - 1, 2, x1 - x0 + 3, 14, kc(ramp, -2))
    rc(c, 3, 7, 3, 3, kc('shiro', 2)); rc(c, 10, 7, 3, 3, kc('shiro', 2))                                # 무늬(글자 아님: 흰 점)
    px(c, 4, 8, kc(ramp, 0)); px(c, 11, 8, kc(ramp, 0))


@R.obj('pb-noren-m', '노렌(남탕·파랑)', w=1, kind='hang', hrows=1, cat='sento', cat_ko='목욕탕', tags=('목욕탕', '센토'), place='남탕 입구 위',
       desc='파란 천 노렌. 두 폭으로 갈라지고 가운데 흰 점 무늬만 있다(글자 없음). 남탕 문 위에 건다.')
def _noren_m(c): _noren(c, 'kon')


@R.obj('pb-noren-f', '노렌(여탕·빨강)', w=1, kind='hang', hrows=1, cat='sento', cat_ko='목욕탕', tags=('목욕탕', '센토'), place='여탕 입구 위',
       desc='붉은 천 노렌. 두 폭으로 갈라지고 가운데 흰 점 무늬만 있다(글자 없음). 여탕 문 위에 건다.')
def _noren_f(c): _noren(c, 'aka')


@R.obj('pb-map-board', '동네 지도판', w=2, kind='hang', hrows=2, cat='koban', cat_ko='파출소', tags=('파출소',), place='파출소 벽',
       desc='나무 틀의 동네 지도판 2칸. 길(흰)·블록(색)·공원·강만 있고 글자는 없다. 붉은 핀 몇 개.')
def _map_board(c):
    W, H = 32, 32
    bev(c, 0, 1, W, H - 2, 'ki', 0)
    rc(c, 3, 4, W - 6, H - 8, kc('kinari', 2))
    outline(c, 2, 3, W - 4, H - 6, kc('ki', -3))
    for x in (9, 20): rc(c, x, 4, 2, H - 8, kc('shiro', 3))                                              # 세로 길
    for y in (12, 21): rc(c, 3, y, W - 6, 2, kc('shiro', 3))                                             # 가로 길
    blocks = ((3, 4, 6, 8, 'kii'), (11, 4, 9, 8, 'daidai'), (22, 4, 7, 8, 'renga'), (3, 14, 6, 7, 'midori'),
              (11, 14, 9, 7, 'kii'), (22, 14, 7, 7, 'sora'), (3, 23, 6, 5, 'daidai'), (11, 23, 9, 5, 'midori'), (22, 23, 7, 5, 'kii'))
    for x, y, w, h, r in blocks:
        rc(c, x, y, w, h, kc(r, 2)); hl(c, x, y, w, kc(r, 3)); hl(c, x, y + h - 1, w, kc(r, 0))
    for x in range(22, 29): px(c, x, 16 + (x % 3), kc('sora', 3))                                         # 강 물결
    px(c, 14, 9, kc('aka', 1)); px(c, 14, 8, kc('aka', 2)); px(c, 24, 18, kc('aka', 1)); px(c, 24, 17, kc('aka', 2))   # 핀
    px(c, 6, 26, kc('aka', 1)); px(c, 6, 25, kc('aka', 2))


# ══ 목욕탕 가구 ═══════════════════════════════════════════════════════════════
@R.obj('pb-bandai', '반다이(번대)', w=1, h=1, up=16, kind='floor', cat='sento', cat_ko='목욕탕', surface=True, use=('counter',), tags=('목욕탕', '센토'),
       place='탈의실 입구 쪽', desc='센토 입구의 높은 번대. 뒤 칸막이 위로 솟고, 앞은 나무판 카운터. 윗면에 물건을 놓는다.')
def _bandai(c):
    # 위 16줄 = 뒤 칸막이(키나리 판 + 나무틀), 아래 16줄 = 발밑
    rc(c, 2, 2, 12, 15, kc('kinari', 2)); outline(c, 1, 1, 14, 16, kc('ki', -3))
    for y in (6, 10): hl(c, 2, y, 12, kc('ki', 1))
    vl(c, 8, 2, 15, kc('ki', 1)); vl(c, 2, 2, 15, kc('shiro', 3))
    rc(c, 4, 4, 3, 3, kc('sora', 3)); rc(c, 10, 8, 3, 3, kc('aka', 2))                                    # 안쪽 소품: 시계·꽃(점)
    # 카운터 윗면
    rc(c, 0, 17, 16, 6, kc('ki', 2)); hl(c, 0, 17, 16, kc('ki', 3)); vl(c, 0, 17, 6, kc('ki', 3))
    for x in (4, 10): px(c, x, 20, kc('ki', 1)); px(c, x + 1, 20, kc('ki', 1))
    rc(c, 2, 18, 5, 3, kc('tekko', 1)); hl(c, 2, 18, 5, kc('tekko', 3)); outline(c, 1, 17, 7, 5, kc('tekko', -3))   # 금고
    rc(c, 10, 19, 4, 2, kc('kii', 2))
    # 앞면
    rc(c, 0, 23, 16, 9, kc('ki', 0)); hl(c, 0, 23, 16, kc('ki', -2)); hl(c, 0, 24, 16, kc('ki', 3))
    for y in (26, 29): hl(c, 1, y, 14, kc('ki', -1))
    vl(c, 0, 23, 9, kc('ki', 2)); vl(c, 15, 23, 9, kc('ki', -2)); vl(c, 7, 24, 7, kc('ki', -1)); vl(c, 8, 24, 7, kc('ki', 2))
    hl(c, 0, 31, 16, kc('ki', -3)); outline(c, 0, 17, 16, 15)


@R.obj('pb-locker', '신발장·사물함', w=1, h=1, up=16, kind='wall', cat='sento', cat_ko='목욕탕', use=('open',), tags=('목욕탕', '센토'),
       place='탈의실·입구 벽', desc='작은 나무 문이 2열 5단으로 줄지은 높은 사물함. 위 윗면이 보이고 앞면에 손잡이 점.')
def _locker(c):
    rc(c, 0, 2, 16, 30, kc('ki', 1)); hl(c, 0, 3, 16, kc('ki', 3)); hl(c, 0, 4, 16, kc('ki', 3)); rc(c, 0, 5, 16, 2, kc('ki', 0))
    for r in range(5):
        for col in range(2):
            x, y = 2 + col * 7, 8 + r * 5
            rc(c, x, y, 6, 4, kc('ki', 2)); hl(c, x, y, 6, kc('ki', 3)); hl(c, x, y + 3, 6, kc('ki', -1))
            px(c, x + (4 if col == 0 else 1), y + 2, kc('tekko', 3))
    for r in range(6): hl(c, 1, 7 + r * 5, 14, kc('ki', -2))
    vl(c, 7, 7, 25, kc('ki', -2)); vl(c, 8, 7, 25, kc('ki', 3))
    hl(c, 0, 31, 16, kc('ki', -3)); outline(c, 0, 2, 16, 30)


@R.obj('pb-basket-shelf', '탈의 바구니 선반', w=2, h=1, up=0, kind='wall', cat='sento', cat_ko='목욕탕', surface=True, use=('search',), tags=('목욕탕', '센토'),
       place='탈의실 벽', desc='나무 선반 2단에 대나무 바구니가 줄지어 있는 선반 2칸. 윗면이 보이고 바구니 속이 살짝 보인다.')
def _basket_shelf(c):
    W = 32
    rc(c, 0, 0, W, 16, kc('ki', 1)); hl(c, 0, 0, W, kc('ki', 3)); hl(c, 0, 1, W, kc('ki', 2))
    for y0 in (3, 9):
        rc(c, 1, y0, W - 2, 5, kc('ki', -2))                                                           # 선반 안쪽 어둠
        for i in range(6):
            x = 2 + i * 5 + (0 if y0 == 3 else 2)
            if x + 4 > W - 1: continue
            rc(c, x, y0 + 1, 4, 3, kc('kii', 1)); hl(c, x, y0 + 1, 4, kc('kii', 3)); hl(c, x, y0 + 3, 4, kc('kii', -1))
            px(c, x + 1, y0 + 2, kc('kii', 0)); px(c, x + 3, y0 + 2, kc('kii', 0))
            if (i + y0) % 3 == 0: rc(c, x, y0 + 1, 4, 1, kc('shiro', 2))                               # 수건이 넘침
        hl(c, 0, y0 + 5, W, kc('ki', 3)); hl(c, 0, y0 + 6, W, kc('ki', -1))
    vl(c, 0, 0, 16, kc('ki', 3)); vl(c, W - 1, 0, 16, kc('ki', -2)); vl(c, 15, 2, 12, kc('ki', 0))
    outline(c, 0, 0, W, 16)


@R.obj('pb-scale', '체중계(옛 다이얼식)', w=1, h=1, up=16, kind='floor', cat='sento', cat_ko='목욕탕', tags=('목욕탕', '센토'),
       place='탈의실 구석', desc='옛 다이얼식 체중계 — 흰 발판 뒤쪽에 낮은 어두운 계기 하우징과 작은 눈금판. 붉은 바늘.')
def _scale(c):
    import math
    rc(c, 1, 17, 14, 5, kc('tekko', 1)); hl(c, 1, 17, 14, kc('tekko', 3)); vl(c, 1, 17, 5, kc('tekko', 3)); vl(c, 14, 17, 5, kc('tekko', -1))   # 지붕 모양 계기 하우징
    rc(c, 4, 9, 8, 8, kc('tekko', 1)); hl(c, 4, 9, 8, kc('tekko', 3)); vl(c, 4, 9, 8, kc('tekko', 3)); vl(c, 11, 9, 8, kc('tekko', -1))
    disc(c, 8, 13, 3, 3, kc('shiro', 3)); ring(c, 8, 13, 3, kc('conc', -1))                                  # 눈금판(작게)
    for (x, y) in ((8, 11), (10, 13), (8, 15), (6, 13)): px(c, x, y, kc('conc', -1))
    px(c, 9, 12, kc('aka', 1)); px(c, 8, 13, kc('aka', 1)); px(c, 10, 11, kc('aka', 1))                       # 바늘
    outline(c, 3, 8, 10, 10, kc('tekko', -3))
    rc(c, 0, 22, 16, 5, kc('shiro', 1)); hl(c, 0, 22, 16, kc('shiro', 4)); vl(c, 0, 22, 5, kc('shiro', 4)); hl(c, 0, 26, 16, kc('conc', 0))   # 발판 윗면
    for x in (3, 6, 9, 12): vl(c, x, 23, 3, kc('conc', 2))
    rc(c, 0, 27, 16, 3, kc('conc', 0)); hl(c, 0, 27, 16, kc('conc', 3)); hl(c, 0, 29, 16, kc('conc', -2))
    outline(c, 0, 16, 16, 14, kc('conc', -2))


@R.obj('pb-massage-chair', '안마 의자', w=1, h=1, up=16, kind='floor', cat='sento', cat_ko='목욕탕', use=('sit',), facing='S', tags=('목욕탕', '센토'),
       place='탈의실 한쪽', desc='붉은 갈색 비닐 안마 의자 — 등받이가 뒤로 솟고 팔걸이·두툼한 좌석, 철제 다리. 남쪽을 보고 앉는다.')
def _massage(c):
    m = 'renga'
    bev(c, 3, 2, 10, 15, m, 0)                                                                         # 등받이
    hl(c, 5, 5, 6, kc(m, -1)); hl(c, 5, 9, 6, kc(m, -1)); hl(c, 5, 6, 6, kc(m, 2)); hl(c, 5, 10, 6, kc(m, 2))
    bev(c, 1, 12, 3, 12, m, -1); bev(c, 12, 12, 3, 12, m, -1)                                           # 팔걸이
    bev(c, 4, 17, 8, 8, m, 1)                                                                          # 좌석
    hl(c, 5, 22, 6, kc(m, -2))
    rc(c, 4, 25, 8, 3, kc('tekko', 1)); hl(c, 4, 25, 8, kc('tekko', 3)); outline(c, 3, 25, 10, 4, kc('tekko', -3))
    for x in (3, 11): rc(c, x, 28, 2, 3, kc('tekko', 0)); vl(c, x, 28, 3, kc('tekko', 2)); hl(c, x - 1, 31, 4, kc('tekko', -3))


@R.obj('pb-milk-fridge', '우유 냉장 진열장', w=1, h=1, up=16, kind='wall', cat='sento', cat_ko='목욕탕', use=('search',), tags=('목욕탕', '센토'),
       place='탈의실 벽', desc='유리문 냉장고 — 안에 흰 우유병·커피 우유병이 3단으로 늘어서 있다. 위 파란 띠.')
def _milk_fridge(c):
    rc(c, 0, 2, 16, 30, kc('shiro', 1)); hl(c, 0, 2, 16, kc('shiro', 3)); hl(c, 0, 3, 16, kc('shiro', 2)); hl(c, 0, 4, 16, kc('conc', 1))
    rc(c, 2, 5, 12, 3, kc('sora', 1)); hl(c, 2, 5, 12, kc('sora', 3)); rc(c, 5, 6, 6, 1, kc('shiro', 3))     # 간판 띠(글자 대신 흰 막대)
    rc(c, 2, 9, 12, 19, kc('garasu', -1)); outline(c, 1, 8, 14, 21, kc('tekko', -2))
    for r in range(3):
        y = 11 + r * 6
        for i in range(4):
            x = 3 + i * 3
            br = (i + r) % 2
            rc(c, x, y + 1, 2, 4, kc('shiro', 3) if not br else kc('ita', 1))
            px(c, x, y, kc('aka', 1) if not br else kc('kii', 1)); px(c, x + 1, y, kc('aka', 1) if not br else kc('kii', 1))
        hl(c, 2, y + 5, 12, kc('garasu', 2))
    rc(c, 3, 9, 1, 19, kc('garasu', 3)); px(c, 4, 10, kc('shiro', 3))                                     # 유리 반사
    vl(c, 13, 14, 6, kc('tekko', 3))
    rc(c, 0, 29, 16, 3, kc('conc', 0)); hl(c, 0, 29, 16, kc('conc', 2)); outline(c, 0, 2, 16, 30)


@R.table('pb-bath', '욕조(큰 탕)', desc='타일 테두리와 하늘색 물, 흰 반짝임. 어떤 w×h 로도 이어 붙는다. 사람 없음.', tags=('목욕탕', '센토'))
def _bath(c, w, h):
    W, H = w * 16, h * 16
    c.R(0, 0, W, H, kc('sora', 1))
    for yy in range(7, H - 8, 6):                                                                       # 잔물결(16 주기)
        for xx in range(0, W, 16):
            hl(c, xx + (2 if (yy // 6) % 2 else 9), yy, 5, kc('sora', 2))
    for yy in range(7, H - 8):
        for xx in range(W):
            if rnd(xx % 16, yy % 16, 7, 14): px(c, xx, yy, kc('shiro', 3))                               # 반짝임(16 주기)
    rc(c, 0, 0, W, 5, kc('shiro', 2)); hl(c, 0, 4, W, kc('sora', -1)); hl(c, 0, 5, W, kc('sora', 0))       # 위 테두리 윗면
    rc(c, 0, 0, 4, H, kc('shiro', 2)); vl(c, 4, 4, H - 4, kc('sora', -1)); vl(c, 5, 5, H - 5, kc('sora', 0))
    rc(c, W - 4, 0, 4, H, kc('shiro', 1)); vl(c, W - 5, 4, H - 4, kc('sora', -1))
    rc(c, 0, H - 9, W, 3, kc('shiro', 3)); rc(c, 0, H - 6, W, 5, kc('sora', 2))                          # 앞 테두리 윗면 + 앞면
    hl(c, 4, H - 10, W - 8, kc('sora', 0)); hl(c, 0, H - 6, W, kc('sora', 1)); hl(c, 0, H - 2, W, kc('sora', -1))
    for x in range(0, W, 8): vl(c, x, 1, 3, kc('sora', 3)); vl(c, x, H - 5, 4, kc('sora', 1))             # 타일 줄눈
    for y in range(8, H - 9, 8): hl(c, 1, y, 3, kc('sora', 3)); hl(c, W - 4, y, 3, kc('sora', 3))
    outline(c, 0, 0, W, H)


@R.obj('pb-wash-station', '씻는 자리(거울·수도꼭지)', w=1, h=1, up=16, kind='wall', cat='sento', cat_ko='목욕탕', use=(), tags=('목욕탕', '센토'),
       place='욕탕 벽, 가로로 이어 붙임', desc='타일 벽 앞 씻는 자리 — 거울 하나, 수도꼭지 둘(빨강·파랑), 아래 타일 선반. 가로로 줄지어 붙는다.')
def _wash_station(c):
    rc(c, 0, 0, 16, 32, kc('sora', 2))
    for y in range(0, 32, 8): hl(c, 0, y + 7, 16, kc('sora', 1))
    for x in (7, 15): vl(c, x, 0, 32, kc('sora', 1))
    rc(c, 2, 1, 12, 12, kc('garasu', 3)); outline(c, 1, 0, 14, 14, kc('tekko', 1))                      # 거울
    for i in range(5): px(c, 4 + i, 9 - i, kc('shiro', 3)); px(c, 5 + i, 9 - i, kc('garasu', 4))
    hl(c, 2, 12, 12, kc('garasu', 2))
    for x0, rr in ((3, 'aka'), (10, 'sora')):                                                           # 수도꼭지
        rc(c, x0, 16, 3, 2, kc('tekko', 2)); hl(c, x0, 16, 3, kc('tekko', 4)); rc(c, x0, 18, 3, 1, kc(rr, 1))
        px(c, x0 + 1, 15, kc(rr, 1))
        rc(c, x0, 19, 1, 2, kc('tekko', 1))
    rc(c, 0, 20, 16, 4, kc('shiro', 2)); hl(c, 0, 20, 16, kc('shiro', 3)); hl(c, 0, 23, 16, kc('sora', 0))     # 선반 윗면
    rc(c, 0, 24, 16, 8, kc('sora', 1)); hl(c, 0, 24, 16, kc('sora', 0)); hl(c, 0, 31, 16, kc('sora', -2))     # 선반 앞면
    for y in (27, 30): hl(c, 0, y, 16, kc('sora', 0))
    rc(c, 3, 21, 4, 2, kc('midori', 2)); px(c, 4, 21, kc('shiro', 3))                                       # 비누
    outline(c, 0, 0, 16, 32)


@R.obj('pb-wash-stool', '목욕 의자·세숫대야', w=1, h=1, up=0, kind='floor', cat='sento', cat_ko='목욕탕', tags=('목욕탕', '센토'),
       place='씻는 자리 앞', desc='노란 낮은 의자와 하늘색 세숫대야(물 담김). 윗면 원이 보이고 다리 셋.')
def _wash_stool(c):
    disc(c, 5, 9, 4.5, 3, kc('kii', 3)); disc(c, 5, 8.5, 3.5, 2, kc('kii', 4))                           # 의자 윗면
    for x in range(1, 10): px(c, x, 12, kc('kii', 0))
    rc(c, 2, 13, 2, 3, kc('kii', 1)); rc(c, 7, 13, 2, 3, kc('kii', -1)); px(c, 5, 15, kc('kii', -2))
    for yy, xs in ((6, (3, 7)), (7, (1, 9)), (12, (1, 9))): px(c, xs[0], yy, OL); px(c, xs[1], yy, OL)
    disc(c, 11, 10, 4.2, 3, kc('sora', 1)); disc(c, 11, 9.5, 3.2, 2, kc('sora', 3)); disc(c, 10, 9, 1.5, .8, kc('shiro', 3))
    rc(c, 8, 11, 7, 3, kc('sora', 0)); hl(c, 8, 13, 7, kc('sora', -1))
    for x in range(1, 9): px(c, x, 6, OL) if x in (1, 8) else None
    for x in range(2, 8): px(c, x, 6, OL)
    hl(c, 8, 7, 7, OL); hl(c, 9, 14, 6, OL); vl(c, 7, 8, 5, OL); vl(c, 15, 8, 6, OL)
    hl(c, 1, 15, 8, OL)


# ══ 코인세탁 ═════════════════════════════════════════════════════════════════
@R.obj('pb-washer', '세탁기(드럼)', w=1, h=1, up=16, kind='wall', cat='laundry', cat_ko='코인세탁', use=('open',), tags=('코인세탁',),
       place='세탁실 벽, 가로로 이어 붙임', desc='흰 드럼 세탁기 — 윗면, 컨트롤 띠(동전 투입구·불빛), 둥근 유리문. 가로로 줄지어 붙는다.')
def _washer(c):
    rc(c, 0, 2, 16, 30, kc('shiro', 1)); rc(c, 0, 2, 16, 4, kc('shiro', 3)); hl(c, 0, 6, 16, kc('conc', 1))     # 윗면
    vl(c, 0, 6, 25, kc('shiro', 3)); vl(c, 15, 6, 25, kc('conc', 1))
    rc(c, 2, 7, 12, 4, kc('tekko', 1)); hl(c, 2, 7, 12, kc('tekko', 3)); outline(c, 1, 6, 14, 6, kc('conc', -1))   # 컨트롤 띠
    rc(c, 3, 8, 3, 2, kc('midori', 3)); px(c, 7, 8, kc('kii', 2)); px(c, 7, 9, kc('aka', 1)); rc(c, 10, 8, 2, 2, kc('kii', 3)); px(c, 12, 9, kc('shiro', 3))
    disc(c, 8, 20, 6.2, 6.2, kc('tekko', 0)); disc(c, 8, 20, 5.2, 5.2, kc('tekko', 2))                       # 문 테두리
    disc(c, 8, 20, 4, 4, kc('garasu', -2)); disc(c, 8.5, 20.5, 2.6, 2.6, kc('garasu', -3))                   # 유리·드럼
    for (x, y) in ((6, 18), (7, 17), (10, 22), (9, 23)): px(c, x, y, kc('garasu', 3))
    for (x, y) in ((8, 20), (9, 21)): px(c, x, y, kc('sora', 1))                                             # 안의 빨래
    ring(c, 8, 20, 6.2, OL)
    rc(c, 1, 28, 14, 3, kc('conc', 1)); hl(c, 1, 28, 14, kc('conc', 3)); hl(c, 0, 31, 16, kc('conc', -2))
    outline(c, 0, 2, 16, 30, kc('conc', -2))


@R.obj('pb-dryer', '건조기(2단)', w=1, h=1, up=16, kind='wall', cat='laundry', cat_ko='코인세탁', use=('open',), tags=('코인세탁',),
       place='세탁실 반대 벽, 가로로 이어 붙임', desc='진회색 2단 건조기 — 윗단·아랫단 둥근 유리문, 사이에 동전 슬롯 띠. 가로로 줄지어 붙는다.')
def _dryer(c):
    rc(c, 0, 2, 16, 30, kc('tekko', 2)); rc(c, 0, 2, 16, 3, kc('conc', 3)); hl(c, 0, 5, 16, kc('tekko', 0))
    vl(c, 0, 5, 27, kc('conc', 2)); vl(c, 15, 5, 27, kc('tekko', 0))
    for cy in (10, 24):
        disc(c, 8, cy, 5.4, 5.4, kc('tekko', 0)); disc(c, 8, cy, 4.6, 4.6, kc('tekko', 3))
        disc(c, 8, cy, 3.5, 3.5, kc('garasu', -2)); disc(c, 8.5, cy + .5, 2, 2, kc('garasu', -3))
        px(c, 6, cy - 2, kc('garasu', 3)); px(c, 7, cy - 3, kc('garasu', 3))
        ring(c, 8, cy, 5.4, OL)
    rc(c, 2, 16, 12, 3, kc('tekko', 1)); hl(c, 2, 16, 12, kc('tekko', 3)); outline(c, 1, 15, 14, 5, kc('conc', -1))
    rc(c, 3, 17, 2, 1, kc('midori', 3)); rc(c, 11, 17, 2, 1, kc('kii', 3)); px(c, 7, 17, OL); px(c, 8, 17, OL)
    hl(c, 0, 31, 16, kc('conc', -2)); outline(c, 0, 2, 16, 30, kc('conc', -2))


@R.obj('pb-fold-table', '빨래 개는 탁자', w=2, h=1, up=0, kind='floor', cat='laundry', cat_ko='코인세탁', surface=True, tags=('코인세탁',),
       place='세탁실 한가운데', desc='밝은 나무 윗판에 철 다리의 긴 탁자 2칸. 윗면이 넓게 보이고 앞 테두리 두 줄.')
def _fold_table(c):
    W = 32
    rc(c, 0, 1, W, 10, kc('ita', 2)); hl(c, 0, 1, W, kc('ita', 4)); vl(c, 0, 1, 10, kc('ita', 4))
    for y in (4, 7): hl(c, 2 + y % 3, y, 7, kc('ita', 1)); hl(c, 17 + y % 4, y, 8, kc('ita', 1))
    rc(c, 0, 11, W, 2, kc('ita', 0)); hl(c, 0, 11, W, kc('ita', 3)); hl(c, 0, 13, W, kc('ita', -2))
    for x in (2, W - 4): rc(c, x, 14, 2, 2, kc('tekko', 1)); px(c, x, 14, kc('tekko', 3))
    outline(c, 0, 0, W, 14)
    hl(c, 1, 15, 3, OL); hl(c, W - 5, 15, 3, OL)


@R.obj('pb-bench', '대기 벤치', w=2, h=1, up=0, kind='floor', cat='laundry', cat_ko='코인세탁', use=('sit',), facing='S', tags=('코인세탁',),
       place='세탁실 입구 옆', desc='주황색 플라스틱 좌석 둘이 철 틀에 붙은 2칸 벤치. 좌석 윗면이 보이고 다리 넷.')
def _bench(c):
    for x0 in (1, 17):
        rc(c, x0, 3, 14, 6, kc('daidai', 2)); hl(c, x0, 3, 14, kc('daidai', 4)); vl(c, x0, 3, 6, kc('daidai', 4))
        rc(c, x0, 9, 14, 3, kc('daidai', -1)); hl(c, x0, 9, 14, kc('daidai', 1)); hl(c, x0, 11, 14, kc('daidai', -2))
        outline(c, x0 - 1, 2, 16, 11)
    rc(c, 1, 12, 30, 1, kc('tekko', -1))
    for x in (2, 12, 18, 28): rc(c, x, 13, 2, 3, kc('tekko', 1)); px(c, x, 13, kc('tekko', 3)); hl(c, x - 1, 15, 4, OL)


@R.obj('pb-vending', '세제 자판기', w=1, h=1, up=16, kind='wall', cat='laundry', cat_ko='코인세탁', use=('search',), tags=('코인세탁',),
       place='세탁실 입구 쪽 벽', desc='하늘색 세제 자판기 — 진열창에 색색 상자(세제·섬유유연제), 동전 투입구, 배출구.')
def _vending(c):
    rc(c, 0, 2, 16, 30, kc('sora', 1)); rc(c, 0, 2, 16, 4, kc('sora', 3)); hl(c, 0, 6, 16, kc('sora', -1))
    vl(c, 0, 6, 25, kc('sora', 3)); vl(c, 15, 6, 25, kc('sora', -1))
    rc(c, 2, 7, 12, 13, kc('tekko', -2)); outline(c, 1, 6, 14, 15, kc('tekko', 0))
    cols = ('shiro', 'aka', 'kii', 'midori', 'daidai', 'sora')
    for r in range(3):
        for i in range(4):
            x, y = 3 + i * 3, 8 + r * 4
            rc(c, x, y, 2, 3, kc(cols[(i + r * 2) % 6], 2)); px(c, x, y, kc(cols[(i + r * 2) % 6], 4))
        hl(c, 2, 11 + r * 4, 12, kc('tekko', 1)) if r < 2 else None
    px(c, 13, 8, kc('garasu', 3)); px(c, 13, 9, kc('garasu', 3))
    rc(c, 3, 22, 4, 3, kc('tekko', 2)); outline(c, 2, 21, 6, 5, kc('tekko', -3)); px(c, 5, 23, OL)             # 동전 투입
    rc(c, 10, 22, 4, 2, kc('kii', 2)); hl(c, 10, 22, 4, kc('kii', 4))
    rc(c, 3, 27, 10, 4, kc('tekko', -2)); hl(c, 3, 27, 10, kc('tekko', 1)); outline(c, 2, 26, 12, 6, kc('tekko', -3))   # 배출구
    outline(c, 0, 2, 16, 30, kc('sora', -3))


@R.obj('pb-changer', '동전 교환기', w=1, h=1, up=16, kind='wall', cat='laundry', cat_ko='코인세탁', use=('search',), tags=('코인세탁',),
       place='세탁기 줄 옆', desc='녹색 동전 교환기 — 지폐 투입구, 노란 표시창, 동전 배출구.')
def _changer(c):
    rc(c, 1, 8, 14, 24, kc('midori', 0)); rc(c, 1, 8, 14, 3, kc('midori', 2)); hl(c, 1, 11, 14, kc('midori', -2))
    vl(c, 1, 11, 21, kc('midori', 2)); vl(c, 14, 11, 21, kc('midori', -2))
    rc(c, 3, 13, 8, 3, kc('tekko', -2)); rc(c, 4, 14, 6, 1, kc('kii', 3)); outline(c, 2, 12, 10, 5, kc('tekko', 0))   # 표시창
    rc(c, 3, 19, 10, 2, kc('tekko', -3)); hl(c, 3, 19, 10, kc('tekko', 1)); outline(c, 2, 18, 12, 4, kc('tekko', 0))  # 지폐구
    rc(c, 4, 25, 8, 4, kc('tekko', -2)); hl(c, 4, 25, 8, kc('tekko', 1)); outline(c, 3, 24, 10, 6, kc('tekko', 0))   # 동전구
    for x in (6, 8, 10): px(c, x, 27, kc('kii', 3))
    outline(c, 1, 8, 14, 24, kc('midori', -3))


# ══ 파출소 ═══════════════════════════════════════════════════════════════════
@R.obj('pb-police-desk', '경찰 책상', w=2, h=1, up=0, kind='floor', cat='koban', cat_ko='파출소', surface=True, use=('counter',), tags=('파출소',),
       place='파출소 입구 가까이', desc='회색 철제 책상 2칸 — 짙은 녹색 데스크 매트, 앞면에 서랍 둘. 윗면 위에 서류를 놓는다.')
def _police_desk(c):
    W = 32
    rc(c, 0, 1, W, 9, kc('conc', 2)); hl(c, 0, 1, W, kc('conc', 4)); vl(c, 0, 1, 9, kc('conc', 4))
    rc(c, 3, 3, 26, 6, kc('midori', -1)); hl(c, 3, 3, 26, kc('midori', 0)); vl(c, 3, 3, 6, kc('midori', 0))       # 데스크 매트
    rc(c, 0, 10, W, 6, kc('conc', 0)); hl(c, 0, 10, W, kc('conc', 3)); hl(c, 0, 11, W, kc('conc', 1))
    for x0 in (2, 18):
        rc(c, x0, 12, 12, 3, kc('conc', 1)); outline(c, x0 - 1, 11, 14, 5, kc('conc', -2)); rc(c, x0 + 4, 13, 4, 1, kc('tekko', 4))
    vl(c, 15, 11, 5, kc('conc', -2)); vl(c, 0, 10, 6, kc('conc', 3)); vl(c, W - 1, 10, 6, kc('conc', -1))
    hl(c, 0, 15, W, kc('conc', -2)); outline(c, 0, 0, W, 16, kc('conc', -3))


def _office_chair(c, d):
    m = 'kon'
    if d == 's':
        bev(c, 4, 4, 8, 12, m, 0); hl(c, 5, 7, 6, kc(m, -1)); hl(c, 5, 8, 6, kc(m, 2))                       # 등받이(뒤)
        bev(c, 3, 17, 10, 7, m, 1); hl(c, 4, 22, 8, kc(m, -2))
    else:
        bev(c, 3, 12, 10, 12, m, 0); hl(c, 4, 15, 8, kc(m, -1)); hl(c, 4, 16, 8, kc(m, 2)); vl(c, 8, 17, 6, kc(m, -1))   # 등받이 뒷면이 좌석을 가림
    rc(c, 7, 24, 2, 4, kc('tekko', 1)); vl(c, 7, 24, 4, kc('tekko', 3)); vl(c, 9, 24, 4, kc('tekko', -2))   # 기둥
    hl(c, 2, 28, 12, kc('tekko', 0)); hl(c, 2, 29, 12, kc('tekko', 2))                                       # 다리
    for x in (2, 7, 12): rc(c, x, 30, 2, 2, kc('tekko', -2)); px(c, x, 30, kc('tekko', 1))


@R.obj('pb-office-chair-s', '사무 의자(남향)', w=1, h=1, up=16, kind='floor', cat='koban', cat_ko='파출소', use=('sit',), facing='S', tags=('파출소', '의원'),
       place='책상 북쪽', desc='남색 회전 의자. 등받이가 좌석 뒤(북쪽)로 솟고 앞면이 보인다. 책상 북쪽에 놓고 남쪽을 본다.')
def _oc_s(c): _office_chair(c, 's')


@R.obj('pb-office-chair-n', '사무 의자(북향)', w=1, h=1, up=16, kind='floor', cat='koban', cat_ko='파출소', use=('sit',), facing='N', tags=('파출소', '의원'),
       place='책상 남쪽', desc='남색 회전 의자. 등받이 뒷면이 좌석을 가린다. 책상 남쪽에 놓고 북쪽을 본다.')
def _oc_n(c): _office_chair(c, 'n')


@R.obj('pb-file-cabinet', '서류 캐비닛', w=1, h=1, up=16, kind='wall', cat='koban', cat_ko='파출소', use=('open',), tags=('파출소', '의원'),
       place='뒷방·벽', desc='회색 철제 4단 서류 캐비닛 — 단마다 손잡이와 빈 이름표(글자 없음).')
def _file_cabinet(c):
    rc(c, 1, 3, 14, 29, kc('conc', 1)); rc(c, 1, 3, 14, 3, kc('conc', 4)); hl(c, 1, 6, 14, kc('conc', 0))
    vl(c, 1, 6, 26, kc('conc', 3)); vl(c, 14, 6, 26, kc('conc', -1))
    for r in range(4):
        y = 7 + r * 6
        rc(c, 3, y, 10, 5, kc('conc', 2)); hl(c, 3, y, 10, kc('conc', 4)); hl(c, 3, y + 4, 10, kc('conc', -1))
        rc(c, 6, y + 1, 4, 1, kc('shiro', 3)); rc(c, 6, y + 2, 4, 1, kc('tekko', 4))                           # 이름표·손잡이
    hl(c, 1, 31, 14, kc('conc', -3)); outline(c, 1, 3, 14, 29, kc('conc', -3))


@R.obj('pb-bicycle', '자전거(마마차리)', w=1, h=1, up=16, kind='floor', cat='koban', cat_ko='파출소', tags=('파출소',),
       place='파출소 입구 곁', desc='바구니 달린 은색 생활 자전거를 옆에서 본 모습. 앞뒤 바퀴, 안장, 핸들, 앞 바구니. 순찰용.')
def _bicycle(c):
    for cx in (4, 12):                                                                                     # 바퀴: 검은 타이어 + 밝은 림 + 빈 속(바닥색 비침) + 허브
        disc(c, cx, 23, 5, 5, OL); disc(c, cx, 23, 3.8, 3.8, kc('conc', 4)); disc(c, cx, 23, 2.6, 2.6, kc('conc', 2))
        px(c, cx, 23, kc('tekko', 0)); px(c, cx - 3, 21, kc('shiro', 4))
        hl(c, cx - 2, 23, 5, kc('conc', 0)); vl(c, cx, 21, 5, kc('conc', 0)); px(c, cx, 23, kc('tekko', -1))   # 바퀴살 십자
    for i in range(6):                                                                                     # 시트튜브·다운튜브: 붉은 관 + 밝은 윗결
        px(c, 4 + i, 22 - i, kc('aka', -1)); px(c, 5 + i, 22 - i, kc('aka', 1))
    for i in range(7): px(c, 12 - i, 17 + i // 2 + (1 if i > 5 else 0), kc('aka', 0))                      # 다운튜브
    hl(c, 5, 22, 8, kc('aka', -1))                                                                         # 체인스테이
    hl(c, 8, 16, 5, kc('aka', 1)); hl(c, 8, 17, 5, kc('aka', -1))                                          # 톱튜브
    vl(c, 12, 13, 10, kc('conc', 3)); vl(c, 13, 13, 10, kc('conc', 0))                                     # 포크·핸들대
    rc(c, 2, 13, 6, 3, kc('tekko', 1)); hl(c, 2, 13, 6, kc('tekko', 3)); hl(c, 2, 15, 6, OL)               # 안장
    rc(c, 10, 11, 6, 2, kc('tekko', 1)); hl(c, 10, 11, 6, kc('tekko', 3)); px(c, 15, 12, OL)               # 핸들
    rc(c, 13, 14, 3, 4, kc('conc', 2)); hl(c, 13, 14, 3, kc('conc', 4)); vl(c, 15, 14, 4, kc('conc', 0)); hl(c, 13, 17, 3, kc('conc', -1))   # 바구니
    hl(c, 1, 29, 14, kc('conc', -2)); hl(c, 2, 30, 12, kc('conc', -2))


# ══ 의원 ═════════════════════════════════════════════════════════════════════
@R.obj('pb-reception', '접수 카운터', w=1, h=1, up=0, kind='floor', cat='clinic', cat_ko='의원', surface=True, use=('counter',), tags=('의원',),
       place='대기실 앞, 가로로 이어 붙임', desc='흰 상판에 나무 앞면의 접수 카운터 한 칸. 가로로 이어 붙인다. 위에 물건을 놓는다.')
def _reception(c):
    rc(c, 0, 1, 16, 7, kc('shiro', 1)); hl(c, 0, 1, 16, kc('shiro', 4)); hl(c, 0, 2, 16, kc('shiro', 3))
    rc(c, 0, 8, 16, 2, kc('conc', 1)); hl(c, 0, 8, 16, kc('conc', 4)); hl(c, 0, 9, 16, kc('conc', -1))
    rc(c, 0, 10, 16, 6, kc('ki', 1)); hl(c, 0, 10, 16, kc('ki', 3))
    rc(c, 3, 12, 10, 3, kc('ki', 2)); outline(c, 2, 11, 12, 5, kc('ki', -2)); rc(c, 7, 13, 2, 1, kc('tekko', 4))
    vl(c, 0, 10, 6, kc('ki', 3)); vl(c, 15, 10, 6, kc('ki', -1)); vl(c, 0, 1, 9, kc('shiro', 4)); vl(c, 15, 1, 9, kc('conc', 1))
    hl(c, 0, 15, 16, kc('ki', -3)); hl(c, 0, 0, 16, kc('conc', -2))


def _sofa(c, d):
    m = 'sora'
    W = 48
    if d == 's':
        bev(c, 1, 3, 46, 13, m, 0)                                                                        # 등받이(뒤)
        for x in (16, 31): vl(c, x, 4, 11, kc(m, -1)); vl(c, x + 1, 4, 11, kc(m, 2))
        bev(c, 0, 12, 4, 15, m, -1); bev(c, 44, 12, 4, 15, m, -1)                                          # 팔걸이
        bev(c, 4, 17, 40, 8, m, 1)
        for x in (16, 31): vl(c, x, 18, 6, kc(m, -1))
        hl(c, 4, 25, 40, kc(m, -2))
    else:
        bev(c, 1, 11, 46, 16, m, 0)                                                                       # 등받이 뒷면이 앞을 가림
        for x in (16, 31): vl(c, x, 12, 14, kc(m, -1)); vl(c, x + 1, 12, 14, kc(m, 2))
        bev(c, 0, 8, 4, 19, m, -1); bev(c, 44, 8, 4, 19, m, -1)
        hl(c, 4, 24, 40, kc(m, -2))
    for x in (2, 44): rc(c, x, 28, 2, 4, kc('tekko', 1)); hl(c, x - 1, 31, 4, OL)


for _d, _ko in (('s', '남향'), ('n', '북향')):
    def _reg(d=_d, ko=_ko):
        @R.obj('pb-waiting-sofa-' + d, '대기실 소파 3인(%s)' % ko, w=3, h=1, up=16, kind='floor', cat='clinic', cat_ko='의원', use=('sit',), facing=d.upper(),
               tags=('의원',), place='대기실', desc='연한 청회색 비닐 3인 소파. %s을 보고 앉는다. %s' % (ko, '등받이가 좌석 뒤로 솟고 앞면이 보인다.' if d == 's' else '등받이 뒷면이 좌석을 가린다.'))
        def _f(c): _sofa(c, d)
    _reg()


@R.obj('pb-exam-bed', '진찰 침대', w=1, h=2, up=0, kind='floor', cat='clinic', cat_ko='의원', use=('sleep',), tags=('의원',),
       place='진찰실', desc='흰 시트의 높은 진찰 침대 1×2 — 위쪽에 베개, 아래에 접은 연하늘 담요. 앞면에 철 틀과 다리.')
def _exam_bed(c):
    rc(c, 1, 1, 14, 25, kc('shiro', 1)); hl(c, 1, 1, 14, kc('shiro', 4)); vl(c, 1, 1, 25, kc('shiro', 4)); vl(c, 14, 2, 24, kc('conc', 2))
    rc(c, 3, 2, 10, 6, kc('shiro', 3)); hl(c, 3, 7, 10, kc('conc', 2))
    hl(c, 3, 2, 10, kc('shiro', 4)); hl(c, 4, 6, 8, kc('conc', 3))                                          # 베개
    hl(c, 1, 14, 14, kc('conc', 3))                                                                       # 시트 접힘
    rc(c, 1, 15, 14, 9, kc('sora', 3)); hl(c, 1, 15, 14, kc('sora', 4)); hl(c, 1, 23, 14, kc('sora', 1))   # 담요
    for x in range(2, 14, 3): vl(c, x, 17, 5, kc('sora', 2))
    rc(c, 0, 26, 16, 4, kc('conc', 1)); hl(c, 0, 26, 16, kc('conc', 4)); hl(c, 0, 29, 16, kc('conc', -1))
    outline(c, 0, 0, 16, 30, kc('conc', -2))
    for x in (1, 13): rc(c, x, 30, 2, 2, kc('tekko', 1)); px(c, x, 30, kc('tekko', 3))
    hl(c, 0, 31, 3, OL); hl(c, 12, 31, 3, OL)


@R.obj('pb-curtain', '진찰 커튼', w=1, h=1, up=16, kind='floor', cat='clinic', cat_ko='의원', tags=('의원',),
       place='진찰 침대 곁', desc='이동식 레일에 걸린 연녹 천 칸막이 한 폭 — 세로 주름, 아래가 물결. 통과 못 한다.')
def _curtain(c):
    hl(c, 0, 2, 16, kc('tekko', 3)); hl(c, 0, 3, 16, kc('tekko', 0)); hl(c, 0, 1, 16, OL)                  # 레일
    for x in range(1, 15):
        col = kc('midori', 3 if x % 4 in (0, 1) else (2 if x % 4 == 2 else 1))
        end = 29 + (1 if x % 4 < 2 else 0)
        rc(c, x, 4, 1, end - 3, col)
    vl(c, 1, 4, 26, kc('midori', 4)); vl(c, 14, 4, 26, kc('midori', 0))
    for x in range(1, 15, 3): px(c, x, 4, kc('tekko', 3))                                                  # 고리
    vl(c, 0, 4, 27, kc('midori', -2)); vl(c, 15, 4, 27, kc('midori', -2)); hl(c, 1, 31, 14, kc('midori', -2))
    for x in range(1, 15):
        if x % 4 < 2: px(c, x, 31, kc('midori', -2))
    hl(c, 1, 30, 14, kc('midori', -1))
    rc(c, 7, 30, 2, 2, kc('tekko', 0))                                                                    # 받침 바퀴


@R.obj('pb-doctor-desk', '의사 책상·모니터', w=2, h=1, up=16, kind='wall', cat='clinic', cat_ko='의원', surface=True, use=('read',), tags=('의원',),
       place='진찰실 북쪽 벽', desc='나무 책상 2칸에 모니터와 키보드 — 모니터가 벽 쪽으로 솟는다. 윗면에 서류·청진기를 놓는다.')
def _doctor_desk(c):
    W = 32
    bev(c, 3, 3, 14, 12, 'conc', 1)                                                                       # 모니터
    rc(c, 5, 5, 10, 8, kc('garasu', -2)); rc(c, 6, 6, 8, 1, kc('sora', 3)); rc(c, 6, 8, 6, 1, kc('shiro', 2)); rc(c, 6, 10, 5, 1, kc('shiro', 1)); px(c, 12, 11, kc('midori', 3))
    rc(c, 8, 15, 4, 2, kc('conc', 0)); hl(c, 8, 15, 4, kc('conc', 3))                                      # 받침
    rc(c, 22, 8, 5, 8, kc('shiro', 2)); hl(c, 22, 8, 5, kc('shiro', 4)); outline(c, 21, 7, 7, 9, kc('conc', 0))  # 서류 꽂이
    rc(c, 0, 17, W, 8, kc('ita', 2)); hl(c, 0, 17, W, kc('ita', 4)); vl(c, 0, 17, 8, kc('ita', 4))        # 윗면
    rc(c, 4, 19, 11, 4, kc('shiro', 3)); hl(c, 5, 20, 8, kc('conc', 3)); hl(c, 5, 22, 8, kc('conc', 3)); outline(c, 3, 18, 13, 6, kc('conc', 1))   # 키보드
    rc(c, 0, 25, W, 7, kc('ita', 0)); hl(c, 0, 25, W, kc('ita', 3)); hl(c, 0, 26, W, kc('ita', 1))
    rc(c, 19, 27, 10, 3, kc('ita', 1)); outline(c, 18, 26, 12, 5, kc('ita', -2)); rc(c, 22, 28, 4, 1, kc('tekko', 4))
    vl(c, 0, 25, 7, kc('ita', 3)); vl(c, W - 1, 25, 7, kc('ita', -1)); hl(c, 0, 31, W, kc('ita', -3))
    outline(c, 0, 17, W, 15, kc('ita', -3))


@R.obj('pb-med-cabinet', '약장(유리문)', w=1, h=1, up=16, kind='wall', cat='clinic', cat_ko='의원', use=('search',), tags=('의원',),
       place='진찰실 벽', desc='흰 틀에 유리문 약장 — 위 3단에 약병(흰·갈색·녹색·붉은 마개)이 줄지고 아래는 닫힌 문 두 짝.')
def _med_cabinet(c):
    rc(c, 0, 2, 16, 30, kc('shiro', 1)); rc(c, 0, 2, 16, 3, kc('shiro', 4)); hl(c, 0, 5, 16, kc('conc', 1))
    rc(c, 2, 6, 12, 14, kc('garasu', -1)); outline(c, 1, 5, 14, 16, kc('conc', -1))
    for r in range(3):
        y = 7 + r * 4
        for i in range(4):
            x = 3 + i * 3
            col = ('shiro', 'ita', 'midori', 'shiro')[(i + r) % 4]
            rc(c, x, y + 1, 2, 3, kc(col, 3 if col != 'ita' else 1)); px(c, x, y, kc('aka' if (i + r) % 2 else 'kii', 1)); px(c, x + 1, y, kc('aka' if (i + r) % 2 else 'kii', 1))
        hl(c, 2, y + 4, 12, kc('garasu', 2))
    rc(c, 3, 6, 1, 14, kc('garasu', 3))
    rc(c, 2, 22, 5, 8, kc('shiro', 2)); rc(c, 9, 22, 5, 8, kc('shiro', 2)); hl(c, 2, 22, 5, kc('shiro', 4)); hl(c, 9, 22, 5, kc('shiro', 4))
    outline(c, 1, 21, 7, 10, kc('conc', 0)); outline(c, 8, 21, 7, 10, kc('conc', 0)); px(c, 6, 26, kc('tekko', 3)); px(c, 9, 26, kc('tekko', 3))
    outline(c, 0, 2, 16, 30, kc('conc', -2))


@R.obj('pb-scale-height', '신장·체중계', w=1, h=1, up=16, kind='floor', cat='clinic', cat_ko='의원', tags=('의원',),
       place='대기실 구석', desc='흰 발판에 눈금 기둥이 선 신장·체중계 — 기둥에 눈금 점과 붉은 슬라이더, 위에 작은 표시창.')
def _scale_height(c):
    rc(c, 5, 1, 6, 5, kc('tekko', 0)); hl(c, 5, 1, 6, kc('tekko', 3)); rc(c, 6, 3, 4, 2, kc('kii', 3)); outline(c, 4, 0, 8, 7, kc('tekko', -3))   # 표시창
    rc(c, 7, 7, 3, 19, kc('shiro', 2)); vl(c, 7, 7, 19, kc('shiro', 4)); vl(c, 9, 7, 19, kc('conc', 1)); outline(c, 6, 7, 5, 19, kc('conc', -1))
    for y in range(9, 25, 3): hl(c, 8, y, 1, kc('conc', -1))
    rc(c, 3, 12, 8, 2, kc('aka', 1)); hl(c, 3, 12, 8, kc('aka', 3)); outline(c, 2, 11, 10, 4, kc('aka', -2))   # 슬라이더
    rc(c, 1, 25, 14, 5, kc('shiro', 1)); hl(c, 1, 25, 14, kc('shiro', 4)); hl(c, 1, 29, 14, kc('conc', 0))
    for x in (4, 7, 10): vl(c, x, 26, 3, kc('conc', 2))
    rc(c, 1, 30, 14, 2, kc('conc', -1)); outline(c, 0, 24, 16, 8)


# ══ 탁상 소품(R.good, 16×16) ══════════════════════════════════════════════════
@R.good('pb-milk-bottle', '우유병 둘', desc='흰 우유병과 커피 우유병 한 병씩(종이 마개). 번대·냉장고 위 탁상용.')
def _milk_bottle(c):
    for x0, body, cap in ((4, 'shiro', 'aka'), (9, 'ita', 'kii')):
        rc(c, x0, 8, 3, 6, kc(body, 3 if body == 'shiro' else 1)); vl(c, x0, 8, 6, kc('shiro', 4) if body == 'shiro' else kc('ita', 2)); vl(c, x0 + 2, 8, 6, kc('conc', 1) if body == 'shiro' else kc('ita', -1))
        rc(c, x0 + 1, 6, 1, 2, kc('shiro', 3)); rc(c, x0, 5, 3, 2, kc(cap, 1)); px(c, x0, 5, kc(cap, 3))
        hl(c, x0, 14, 3, kc('conc', -2))
        px(c, x0 - 1, 9, OL); px(c, x0 + 3, 9, OL)
        vl(c, x0 - 1, 8, 6, OL); vl(c, x0 + 3, 8, 6, OL); px(c, x0 - 1, 14, OL)
        hl(c, x0, 15, 3, OL)
        vl(c, x0 - 1, 5, 3, OL); vl(c, x0 + 3, 5, 3, OL); hl(c, x0, 4, 3, OL)


@R.good('pb-detergent', '세제 상자', desc='세제 상자와 섬유유연제 병. 색 띠만 있고 글자는 없다.')
def _detergent(c):
    rc(c, 2, 5, 7, 9, kc('sora', 2)); hl(c, 2, 5, 7, kc('sora', 4)); vl(c, 2, 5, 9, kc('sora', 4)); vl(c, 8, 5, 9, kc('sora', 0))
    rc(c, 3, 8, 5, 3, kc('shiro', 3)); rc(c, 4, 9, 3, 1, kc('aka', 1)); outline(c, 1, 4, 9, 11)
    rc(c, 11, 8, 3, 6, kc('midori', 2)); vl(c, 11, 8, 6, kc('midori', 4)); vl(c, 13, 8, 6, kc('midori', 0))
    rc(c, 11, 5, 3, 3, kc('shiro', 3)); px(c, 12, 6, kc('conc', 1)); rc(c, 11, 10, 3, 2, kc('shiro', 2))
    vl(c, 10, 5, 10, OL); vl(c, 14, 5, 10, OL); hl(c, 11, 4, 3, OL); hl(c, 11, 15, 3, OL)


@R.good('pb-documents', '서류 더미', desc='클립으로 철한 서류 한 더미와 볼펜. 글자는 회색 줄뿐.')
def _documents(c):
    for i, (x, y) in enumerate(((1, 9), (2, 7), (3, 5))):                                                   # 어긋난 서류 세 장
        rc(c, x, y, 10, 8, kc('shiro', 2 if i == 2 else 1)); hl(c, x, y, 10, kc('shiro', 3)); vl(c, x, y, 8, kc('shiro', 3)); hl(c, x, y + 7, 10, kc('conc', 1))
    for y in (8, 10): hl(c, 5, y, 6, kc('conc', 2))                                                          # 글자 대신 회색 줄
    rc(c, 5, 4, 3, 3, kc('sora', 1)); hl(c, 5, 4, 3, kc('sora', 3)); hl(c, 5, 6, 3, kc('sora', -1))          # 파란 클립
    rc(c, 10, 12, 5, 2, kc('kon', 1)); hl(c, 10, 12, 5, kc('kon', 3)); px(c, 15, 12, kc('aka', 1)); px(c, 15, 13, kc('aka', 1))  # 볼펜
    outline(c, 0, 3, 16, 12)


@R.good('pb-stethoscope', '청진기', desc='검은 관이 둥글게 늘어진 청진기와 은색 가슴판.')
def _stethoscope(c):
    for t in range(0, 19):                                                                                 # 늘어진 관: 두 줄 굵기
        import math
        a = math.pi * (0.1 + 0.8 * t / 18)
        x = int(round(7.5 + 5.5 * math.cos(a + math.pi))); y = int(round(6 + 6 * math.sin(a)))
        px(c, x, y, kc('tekko', -1)); px(c, x + 1, y, kc('tekko', 1))
    for (x, y) in ((2, 5), (13, 5)): rc(c, x, y - 2, 2, 3, kc('conc', 4)); px(c, x, y - 2, kc('shiro', 4))   # 이어팁
    rc(c, 6, 11, 5, 4, kc('conc', 3)); hl(c, 6, 11, 5, kc('conc', 4)); hl(c, 6, 14, 5, kc('conc', 0)); px(c, 8, 12, kc('conc', 0))
    outline(c, 5, 10, 7, 6, kc('conc', -2))                                                                # 가슴판
    vl(c, 8, 8, 2, kc('tekko', 0))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

#!/usr/bin/env python3
"""jp_city 블록 interior_washitsu — 일본 실내 화실(和室) 가구·탁상 물건.
  python3 scripts/content/jp-city/blocks/interior_washitsu.py     # selftest + tiledata/jp-city/blocks/interior_washitsu/_all-x3.png
틀(칸 자르기·그림자·사양)은 interior/ikit.py. 여기는 가구 그림만 그린다. 색은 modern3 램프 K(램프, 단)만, 반투명 없음, 윤곽 OL, 빛은 왼쪽 위.
3/4 시점: 가로면(상판·방석·이부자리·뚜껑)은 위에서, 앞면은 남쪽 정면. 상판은 바닥(다다미 kinari 0)보다 밝고 대비가 높게, 윗 가장자리 1px 밝은 줄.

치수(1칸=16px=1m. bible §11-1 T/F 표·§12-3 와 같은 식. 표에 없는 것은 여기에 계산을 쓴다)
  chabudai   2×1 up0   — 지름 0.9m·높이 0.33m: 상판 타원 T≈12(둥근 면이라 깊이 12px) + 옆면 F≈3(§12-3 table_dining T4/F12 보다 낮은 밥상, 발 2px 포함 16 안)
  zataku     2×1 up0   — 길이 1.8m 폭 0.6m 높이 0.33m: 상판 T9 + 앞띠 F3 + 다리 2px
  kotatsu    2×1 up0   — 이불 치마 0.9m: 상판+이불 윗면 T9 / 치마 F7 (table_small T5/F11 에서 윗면을 키움 — 고타쓰는 앉은 눈높이 상 위)
  tansu      1×2(h1 up16) — 오동나무 장롱 높이 1.1m: chest_dresser T5/F16 의 앞면을 27 로 키움(총 32px = 2m 미만 1.1m 아님, 벽면 아랫단부터 벽 한 줄 반을 덮는 가구 관례). T6 / F26
  butsudan   1×2(h1 up16) — 불단 높이 1.5m: 지붕 T6 / 앞면 F26(상단 감실 12 + 아래 서랍장 12)
  tokonoma   2×1 up32  — 도코노마 폭 1.8m·벽 두 줄 전체: 인방 4 + 뒷벽 31 + 마루 단 4(도코가마치) = 48px
  chigaidana 1×1 up32  — 폭 0.9m: 벽 두 줄 전체 + 아래 지부쿠로 T3/F9
  zabuton    1×1 flat  — 0.55m 정사각 방석: 가로면 그림 11×11
  zaisu      1×1 up0   — 좌의자: 앉는 판 높이 T7(윗면)·F3(앞) + 등받이 가로 6px(chair T4/F12 의 앉은 판을 낮추고 등받이를 앞면으로 돌림)
  futon      1×2 flat  — 폭 0.9m 길이 1.9m: bed_single(T16)처럼 두께를 앞면 2px 로만 표시(바닥 무늬라 걸을 수 있다)
  futon-folded 1×1 up0 — 접은 이불 높이 0.55m: T6 / F7(윗면 6px+앞면 7px, 합 13 + 그림자 1)
  andon      1×1 up0   — 높이 0.7m 중 12px(0.75m): 갓 T3/F7 + 받침 F4
  ikebana    1×1 up0   — 화병 0.5m: 꽃 위 · 병 9px
  tv-old     1×1 up0 wall — 브라운관 TV 0.6m + 받침 0.3m: 윗면 T3, 앞면 F8, 받침 4 (합 15)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_washitsu'
R = Registry(BLOCK, '일본 실내 화실')


# ── 그리기 도우미 ──
def px(c, x, y, col):
    x, y = int(x), int(y)
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def box3(c, x, y, w, t, f, top, front, hi, ol=OL, lip=None):
    """윗면 t 줄 + 앞면 f 줄 상자. 윗면 왼쪽·위·앞 가장자리에 밝은 1px(hi), 앞면은 front."""
    c.R(x, y, w, t + f, ol)
    c.R(x + 1, y + 1, w - 2, t - 1, top)
    c.HL(x + 1, y + 1, w - 2, hi); c.VL(x + 1, y + 1, t - 1, hi)
    c.HL(x + 1, y + t - 1, w - 2, lip if lip is not None else hi)
    c.R(x + 1, y + t, w - 2, f - 1, front)


def W(s): return K('ita', s)


# ───────────── 낮은 탁자 ─────────────
@R.obj('chabudai', '차부다이(둥근 밥상)', w=2, h=1, up=0, kind='floor', surface=True, use=('block',), tags=('화실', '거실', '식사'),
       place='화실 한가운데, 방석 4장이 빙 둘러 놓인다', pair=('zabuton', 'tea-set', 'senbei-plate'),
       desc='둥근 낮은 밥상(卓袱台) 2×1칸 — 짙은 나무 상판에 밝은 가장자리, 짧은 접이 다리. 위에 차·과자를 놓는다. 방 가운데 1개.')
def d_chabudai(c):
    disc(c, 16, 9.5, 14.8, 6.2, OL)                       # 옆면 윤곽
    disc(c, 16, 9, 13.8, 5.4, W(-2))                      # 옆면(두께)
    disc(c, 16, 6.5, 14.8, 6.2, OL)                       # 상판 윤곽
    disc(c, 16, 6.5, 13.8, 5.2, W(3))                     # 가장자리 밝은 줄
    disc(c, 16.7, 7.2, 12.8, 4.3, W(2))                   # 상판 (왼쪽 위만 밝은 줄이 남는다)
    for (x0, y0, ww) in ((7, 5, 8), (14, 8, 9), (10, 10, 6)): c.HL(x0, y0, ww, W(1))     # 나뭇결
    for x0 in (7, 23): c.R(x0, 14, 3, 2, W(-3))           # 접이 다리 끝
    c.HL(7, 15, 3, OL); c.HL(23, 15, 3, OL)


@R.obj('zataku', '자타쿠(긴 낮은 탁자)', w=2, h=1, up=0, kind='floor', surface=True, use=('block',), tags=('화실', '거실', '식사'),
       place='화실 한쪽, 방석 둘씩 마주 앉는다', pair=('zabuton', 'tea-set'),
       desc='긴 사각 낮은 탁자(座卓) 2×1칸 — 옻칠한 짙은 상판에 밝은 가장자리, 앞띠, 짧은 네 다리.')
def d_zataku(c):
    box3(c, 1, 2, 30, 9, 4, W(1), W(-1), W(3), lip=W(2))
    c.HL(3, 6, 10, W(2)); c.HL(15, 8, 12, W(2)); c.HL(8, 4, 6, W(2))            # 나뭇결
    for x0 in (3, 26): c.R(x0, 14, 3, 2, W(-3)); c.HL(x0, 15, 3, OL)


# ───────────── 앉는 것 ─────────────
@R.obj('zabuton', '방석', w=1, h=1, up=0, kind='flat', walk=((0, 0),), use=('sit',), tags=('화실', '거실'),
       place='차부다이·고타쓰·자타쿠 둘레', pair=('chabudai', 'kotatsu', 'zataku'),
       desc='보라색 평평한 방석(座布団) 1칸 — 다다미 위 바닥 무늬라 걸을 수 있고 앉는 자리다. 탁자 한 면에 1장.')
def d_zabuton(c):
    col = lambda s: K('murasaki', s)
    c.HL(3, 2, 10, OL); c.HL(3, 13, 10, OL); c.VL(2, 3, 10, OL); c.VL(13, 3, 10, OL)          # 둥근 모서리 윤곽
    c.R(3, 3, 10, 7, col(0)); c.HL(3, 3, 10, col(2)); c.VL(3, 3, 7, col(1))                    # 윗면
    c.HL(3, 9, 10, col(1))                                                                      # 앞쪽 불룩한 줄
    c.R(3, 10, 10, 3, col(-2)); c.HL(3, 10, 10, col(-1))                                         # 앞면(두께)
    c.R(7, 5, 2, 2, col(-1)); px(c, 7, 5, col(3)); px(c, 8, 6, col(0))                          # 가운데 단추
    for (x, y) in ((3, 3), (12, 3)): px(c, x, y, col(3))                                         # 네 귀퉁이 술(위쪽 둘)


def _zaisu_s(c):                                          # 앉은 사람이 남쪽을 봄: 등받이가 북쪽, 안쪽 면이 보인다
    box3(c, 1, 0, 14, 3, 5, W(2), W(0), W(3))                                # 등받이 윗면 + 앞(안쪽)면
    for x in (4, 7, 10): c.VL(x, 3, 4, W(-1))                                # 살대
    box3(c, 1, 6, 14, 6, 3, K('kon', 1), W(-1), K('kon', 2), lip=K('kon', 2))
    c.R(1, 12, 14, 3, W(-1)); c.HL(1, 14, 14, OL); c.HL(2, 12, 12, W(1))
    c.R(7, 8, 2, 2, K('kon', 0)); px(c, 7, 8, K('kon', 3))               # 방석 단추


def _zaisu_n(c):                                          # 남쪽 아래에 등받이 뒷면이 서고, 위로 앉는 판 윗면이 보인다
    box3(c, 1, 1, 14, 8, 2, K('kon', 1), K('kon', -1), K('kon', 2), lip=K('kon', 2))
    c.R(7, 4, 2, 2, K('kon', 0)); px(c, 7, 4, K('kon', 3))
    box3(c, 1, 9, 14, 3, 4, W(2), W(-1), W(3), lip=W(1))                     # 등받이 윗단면 + 뒷면(밋밋)
    c.HL(2, 13, 12, W(-2)); c.HL(2, 12, 12, W(0))


def _zaisu_side(c, west):                                 # 옆모습: 등받이 단면이 세로 막대(ㄴ자 옆모습)로 보인다
    bx = 1 if west else 12                                # 등받이 슬랩 x (가로 3)
    sx = 4 if west else 1                                 # 앉는 판 x
    box3(c, bx, 0, 3, 10, 5, W(2), W(0), W(3), lip=W(2))                      # 슬랩 윗면 0..9 + 앞면 10..14
    c.VL(bx + 1, 2, 7, W(1))
    box3(c, sx, 5, 11, 6, 3, K('kon', 1), W(-1), K('kon', 2), lip=K('kon', 2))   # 앉는 판 윗면 5..10 + 앞면 11..13
    px(c, sx + 5, 7, K('kon', 0))
    c.HL(sx, 14, 11, OL)


R.obj('zaisu-s', '좌의자(남향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='s', tags=('화실', '거실'), place='탁자 북쪽, 앉은 사람이 남쪽을 본다',
      pair=('chabudai', 'zataku'), desc='다리 없는 좌의자(座椅子) 남향 1칸 — 등받이가 북쪽, 안쪽 살대가 보이고 남색 방석이 앉는 판.')(_zaisu_s)
R.obj('zaisu-n', '좌의자(북향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='n', tags=('화실', '거실'), place='탁자 남쪽, 앉은 사람이 북쪽을 본다',
      pair=('chabudai', 'zataku'), desc='다리 없는 좌의자 북향 1칸 — 등받이 뒷면이 남쪽 앞에 서고 앉는 판 윗면이 보인다.')(_zaisu_n)
R.obj('zaisu-e', '좌의자(동향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='e', tags=('화실', '거실'), place='탁자 서쪽, 앉은 사람이 동쪽을 본다',
      pair=('chabudai', 'zataku'), desc='다리 없는 좌의자 동향 1칸 — 등받이 단면이 서쪽 세로 막대, 앉는 판이 동쪽.')(lambda c: _zaisu_side(c, True))
R.obj('zaisu-w', '좌의자(서향)', w=1, h=1, up=0, kind='floor', use=('sit',), facing='w', tags=('화실', '거실'), place='탁자 동쪽, 앉은 사람이 서쪽을 본다',
      pair=('chabudai', 'zataku'), desc='다리 없는 좌의자 서향 1칸 — 등받이 단면이 동쪽 세로 막대, 앉는 판이 서쪽.')(lambda c: _zaisu_side(c, False))


@R.obj('kotatsu', '고타쓰', w=2, h=1, up=0, kind='floor', surface=True, use=('block',), tags=('화실', '거실', '겨울'),
       place='화실 한가운데, 방석 4장이 둘러 놓인다', pair=('zabuton', 'mikan-basket', 'tea-set', 'tv-old'),
       desc='이불 치마가 늘어진 고타쓰 2×1칸 — 가운데 나무 상판, 붉은 이불이 3면으로 처진다. 상판 위에 귤 바구니를 올린다. 방 가운데 1개.')
def d_kotatsu(c):
    a = lambda s: K('aka', s)
    c.R(1, 2, 30, 14, OL)
    c.R(2, 3, 28, 7, a(1)); c.HL(2, 3, 28, a(2))                   # 이불 윗면
    for x0 in range(3, 29, 6): px(c, x0, 5, a(2)); px(c, x0 + 3, 8, a(2))
    c.R(2, 10, 28, 5, a(0))                                         # 이불 치마
    for x0 in range(4, 29, 4): c.VL(x0, 10, 5, a(-1))               # 주름
    c.HL(2, 10, 28, a(-1)); c.R(2, 13, 28, 1, K('kinari', 1)); c.HL(2, 14, 28, a(-1))   # 단 + 아랫단 띠
    # 나무 상판(이불 위)
    c.R(5, 2, 22, 9, OL)
    c.R(6, 3, 20, 6, W(2)); c.HL(6, 3, 20, W(3)); c.VL(6, 3, 6, W(3))
    c.R(6, 9, 20, 1, W(3)); c.R(6, 10, 20, 0, W(0))
    c.HL(6, 10, 20, W(-1))
    c.HL(9, 5, 7, W(1)); c.HL(17, 7, 7, W(1))                         # 나뭇결


@R.obj('tansu', '오동나무 장롱(簞笥)', w=1, h=1, up=16, kind='wall', use=('open', 'search'), tags=('화실', '침실', '수납'),
       place='북쪽 벽 아래, 도코노마 곁', pair=('butsudan', 'tokonoma'),
       desc='서랍이 층층이 쌓인 오동나무 장롱(桐簞笥) 1×2 — 연한 갈회색 나무, 쇠 손잡이·모서리 쇠장식. 윗단은 여닫이.')
def d_tansu(c):
    c.R(0, 0, 16, 32, OL)
    c.R(1, 1, 14, 5, W(2)); c.HL(1, 1, 14, W(3)); c.VL(1, 1, 5, W(3)); c.HL(1, 5, 14, W(1))   # 윗면 T6
    c.R(1, 6, 14, 25, W(1))                                         # 앞면
    c.HL(1, 6, 14, W(-1)); c.HL(1, 7, 14, W(0))                       # 처마 그림자 2px
    c.VL(1, 8, 22, W(2)); c.VL(14, 8, 22, W(0))                       # 옆 기둥 빛·그늘
    for y in (15, 21, 27): c.HL(1, y, 14, W(-1))                      # 서랍 사이 홈
    for y in (9, 16, 22, 28): c.HL(2, y, 12, W(2))                    # 서랍 윗 모서리 빛
    c.VL(8, 9, 6, W(-1))                                              # 윗단 여닫이 가운데 선
    for x in (3, 11): c.R(x, 11, 2, 2, K('tekko', 1)); px(c, x, 11, K('tekko', 3))        # 여닫이 쇠 손잡이
    for y in (18, 24): c.R(6, y, 4, 1, K('tekko', 3)); c.R(6, y + 1, 4, 1, K('tekko', -1))  # 서랍 쇠 손잡이
    c.R(6, 29, 4, 1, K('tekko', 3)); c.R(6, 30, 4, 0, OL)
    for (x, y) in ((2, 8), (13, 8), (2, 14), (13, 14)): px(c, x, y, K('tekko', 2))        # 모서리 쇠
    c.R(0, 31, 16, 1, OL)


@R.obj('butsudan', '불단(仏壇)', w=1, h=1, up=16, kind='wall', use=('open', 'read'), tags=('화실', '거실', '제사'),
       place='북쪽 벽 아래, 장롱 곁', pair=('tansu', 'tokonoma'),
       desc='문이 열린 불단 1×2 — 검은 옻칠 지붕과 몸체, 안쪽 어두운 금빛 벽에 위패, 아래 두 짝 서랍장. 금은 감실과 손잡이에만 쓴다.')
def d_butsudan(c):
    y = lambda s: K('yoru', s)
    k = lambda s: K('kii', s)
    c.R(0, 0, 16, 32, OL)
    c.R(1, 1, 14, 5, y(1)); c.HL(1, 1, 14, y(3)); c.VL(1, 1, 5, y(3)); c.HL(1, 3, 14, y(2)); c.HL(1, 5, 14, y(0))   # 지붕 T6
    c.HL(2, 5, 12, k(0))                                              # 금 선 하나
    c.R(1, 6, 14, 12, y(0))                                           # 감실 틀
    c.R(3, 7, 10, 10, k(-1)); c.HL(3, 7, 10, k(-2)); c.VL(3, 7, 10, k(-2))      # 안쪽 금빛 벽(어둡게)
    c.R(6, 9, 4, 6, y(-3)); c.HL(6, 9, 4, k(1))                          # 위패
    c.R(5, 15, 6, 2, k(0)); c.HL(5, 15, 6, k(1))                         # 연화대
    c.R(1, 7, 2, 10, y(2)); c.VL(2, 7, 10, k(-1)); c.R(13, 7, 2, 10, y(1)); c.VL(13, 7, 10, k(-1))   # 열린 문짝
    c.R(1, 18, 14, 2, y(3)); c.HL(1, 18, 14, y(3)); c.HL(1, 19, 14, y(1))      # 가운데 선반(윗면 밝게)
    c.R(1, 20, 14, 11, y(0))                                           # 아래 서랍장
    for x0 in (2, 8): c.R(x0, 21, 6, 9, y(1)); c.HL(x0, 21, 6, y(2)); c.R(x0 + 1, 22, 4, 7, y(0))
    for x in (7, 8): px(c, x, 25, k(0))                                 # 금 손잡이
    c.R(0, 31, 16, 1, OL)


@R.obj('tokonoma', '도코노마(床の間)', w=2, h=1, up=32, kind='wall', use=('read',), tags=('화실', '손님방', '장식'),
       place='북쪽 벽 가운데, 장롱·불단 사이 또는 곁', pair=('chigaidana', 'tansu', 'butsudan'),
       desc='족자와 꽃병이 놓인 도코노마 2×1 — 인방과 도코바시라 사이 흙벽, 족자(둥근 먹 그림)·걸이막대, 낮은 마루 단 위 푸른 꽃병과 꽃가지. 벽 두 줄 전체.')
def d_tokonoma(c):
    k = lambda s: K('kinari', s)
    c.R(0, 0, 32, 47, OL)
    c.R(1, 1, 30, 4, W(0)); c.HL(1, 1, 30, W(2)); c.HL(1, 4, 30, W(-2))          # 인방
    c.R(1, 5, 3, 38, W(1)); c.VL(1, 5, 38, W(3)); c.VL(3, 5, 38, W(-1))           # 왼쪽 도코바시라
    c.R(28, 5, 3, 38, W(0)); c.VL(28, 5, 38, W(1)); c.VL(30, 5, 38, W(-1))
    c.R(4, 5, 24, 31, k(1)); c.R(4, 5, 24, 2, k(-1)); c.VL(4, 5, 31, k(0)); c.VL(5, 5, 31, k(0))   # 안쪽 벽 + 위·왼쪽 그늘
    # 족자
    c.HL(10, 8, 12, W(3)); px(c, 9, 8, W(2)); px(c, 22, 8, W(2))
    c.R(11, 9, 10, 21, K('kon', 0)); c.VL(11, 9, 21, K('kon', 1)); c.HL(11, 29, 10, K('kon', -1))
    c.R(13, 12, 6, 15, k(3)); c.HL(13, 12, 6, K('shiro', 3))
    disc(c, 16, 18.5, 2.6, 2.6, K('yoru', -3)); disc(c, 16, 18.5, 1.2, 1.2, k(3))   # 먹으로 그린 원(円相)
    px(c, 17, 16, k(3)); px(c, 14, 20, k(3))
    c.R(16, 23, 2, 2, K('aka', 1)); px(c, 16, 23, K('aka', 2))                       # 낙관(붉은 점)
    c.R(10, 30, 12, 1, W(2)); c.R(10, 31, 12, 1, W(-1))                               # 아래 축
    # 마루 단
    c.R(4, 36, 24, 7, K('yuka', 1)); c.HL(4, 36, 24, K('yuka', 3)); c.HL(4, 38, 24, K('yuka', 2)); c.HL(4, 41, 24, K('yuka', 0))
    c.R(1, 43, 30, 4, K('yoru', 1)); c.HL(1, 43, 30, K('yoru', 3)); c.HL(1, 44, 30, K('yoru', 2))   # 도코가마치(검은 앞 나무)
    # 꽃병 + 꽃가지
    c.R(23, 29, 2, 4, K('sora', 1)); px(c, 23, 29, K('sora', 3))
    disc(c, 24, 36, 3.2, 3.8, K('sora', 1)); px(c, 22, 35, K('sora', 3)); px(c, 22, 36, K('sora', 2)); c.HL(22, 39, 5, K('sora', -1))
    for (x, y) in ((24, 28), (25, 27), (26, 26), (26, 25)): px(c, x, y, K('midori', 0))
    disc(c, 26, 24, 1.5, 1.5, K('pinku', 2)); px(c, 26, 24, K('pinku', 3)); disc(c, 24, 26, 1.2, 1.2, K('aka', 3))
    c.R(0, 46, 32, 1, OL)


@R.obj('chigaidana', '지가이다나(違い棚)', w=1, h=1, up=32, kind='wall', use=('open',), tags=('화실', '손님방', '수납'),
       place='북쪽 벽 도코노마 곁', pair=('tokonoma',),
       desc='어긋난 선반 1×1(높이 3줄) — 위 작은 장지 수납(후쿠로토다나), 어긋나게 달린 선반 둘, 아래 지부쿠로 두 짝 문.')
def d_chigaidana(c):
    k = lambda s: K('kinari', s)
    c.R(0, 0, 16, 48, OL)
    c.R(1, 1, 14, 4, W(0)); c.HL(1, 1, 14, W(2))
    c.R(1, 5, 14, 31, k(1)); c.R(1, 5, 14, 2, k(-1))
    c.R(5, 6, 9, 9, W(1)); c.R(6, 7, 3, 7, K('shiro', 2)); c.R(10, 7, 3, 7, K('shiro', 2)); c.HL(6, 7, 3, K('shiro', 3)); c.HL(10, 7, 3, K('shiro', 3))
    c.VL(9, 7, 7, W(0)); px(c, 8, 10, K('tekko', 3)); px(c, 10, 10, K('tekko', 3))
    c.HL(5, 15, 9, W(2)); c.HL(5, 16, 9, W(-1))
    c.VL(9, 17, 13, W(1))                                              # 이음 기둥
    for (x0, y0, ww) in ((2, 21, 8), (6, 29, 8)):
        c.R(x0, y0, ww, 3, W(1)); c.HL(x0, y0, ww, W(3)); c.HL(x0, y0 + 2, ww, W(-1))
    px(c, 4, 19, K('sora', 1)); c.R(4, 19, 3, 2, K('sora', 1)); px(c, 4, 19, K('sora', 3))   # 선반 위 작은 찻항아리
    box3(c, 1, 36, 14, 3, 8, W(2), W(1), W(3), lip=W(2))
    c.VL(8, 40, 6, W(-1))
    px(c, 7, 43, K('tekko', 3)); px(c, 9, 43, K('tekko', 3))
    c.R(0, 47, 16, 1, OL)


# ───────────── 잠자리 ─────────────
@R.obj('futon', '깔린 이부자리(布団)', w=1, h=2, up=0, kind='flat', walk=((0, 0), (0, 1)), use=('sleep',), tags=('화실', '침실', '밤'),
       place='밤의 화실 다다미 위, 머리를 북쪽으로', pair=('futon', 'andon', 'futon-folded'),
       desc='깔린 이부자리 1×2 — 위쪽 메밀 베개, 흰 깃과 푸른 이불, 얇은 앞면. 바닥 무늬라 걸을 수 있고 자는 자리다.')
def d_futon(c):
    s = lambda v: K('shiro', v); b = lambda v: K('sora', v)
    c.HL(2, 1, 12, OL); c.HL(2, 30, 12, OL); c.VL(1, 2, 28, OL); c.VL(14, 2, 28, OL)
    c.R(2, 2, 12, 26, s(3))                                            # 요(깔개)
    c.R(3, 3, 10, 6, K('kinari', 3)); c.HL(3, 3, 10, K('kinari', 4)); c.HL(3, 8, 10, K('kinari', 1)); c.VL(3, 3, 6, K('kinari', 4))   # 베개
    c.HL(2, 9, 12, s(1))                                                # 요 위 그림자
    c.R(2, 11, 12, 3, s(4)); c.HL(2, 11, 12, s(4)); c.HL(2, 13, 12, s(2))          # 이불 깃
    c.R(2, 14, 12, 14, b(1)); c.HL(2, 14, 12, b(3)); c.VL(2, 14, 14, b(2))          # 이불 윗면
    for y in range(17, 28, 4):
        for x in range(4, 14, 4): px(c, x, y, b(2)); px(c, x + 2, y + 2, b(0))       # 누빔 점
    c.R(2, 28, 12, 2, b(-1)); c.HL(2, 28, 12, b(0))                                  # 앞면(두께)


@R.obj('futon-folded', '갠 이불', w=1, h=1, up=0, kind='floor', use=('open',), tags=('화실', '침실'),
       place='방 한쪽 구석이나 오시이레 곁', pair=('futon', 'andon'),
       desc='갠 이불 더미 1칸 — 맨 위 베개, 푸른 이불과 흰 요가 줄줄이 겹친 앞면.')
def d_futon_folded(c):
    box3(c, 1, 3, 14, 6, 7, K('sora', 1), K('sora', 0), K('sora', 3), lip=K('sora', 2))
    c.R(3, 4, 8, 3, K('kinari', 3)); c.HL(3, 4, 8, K('kinari', 4)); c.HL(3, 6, 8, K('kinari', 1))   # 맨 위 베개
    c.R(2, 9, 12, 2, K('shiro', 3)); c.HL(2, 10, 12, K('shiro', 1))                                # 요 단
    c.R(2, 12, 12, 2, K('sora', 0)); c.HL(2, 13, 12, K('sora', -1))
    c.R(1, 15, 14, 1, OL)


@R.obj('andon', '등롱(行灯)', w=1, h=1, up=0, kind='floor', use=('light',), tags=('화실', '침실', '밤'),
       place='이부자리 머리맡', pair=('futon',),
       desc='종이 등롱(行灯) 1칸 — 사각 종이 갓 안이 노랗게 빛나고, 나무 기둥·갓·받침.')
def d_andon(c):
    m = lambda s: K('mado', s)
    box3(c, 3, 2, 10, 3, 1, W(1), W(-1), W(3), lip=W(2))               # 갓(뚜껑)
    c.R(3, 4, 10, 8, OL)
    c.R(4, 5, 8, 6, m(3)); c.R(6, 6, 4, 4, m(4)); c.HL(4, 5, 8, m(4))     # 종이와 안쪽 불빛
    c.VL(4, 4, 8, W(0)); c.VL(11, 4, 8, W(-1)); c.HL(4, 8, 8, W(0))       # 기둥·가로살
    c.R(2, 11, 12, 3, W(-1)); c.HL(2, 11, 12, W(1)); c.R(2, 13, 12, 1, W(-2))   # 받침
    c.HL(3, 14, 10, OL)


@R.obj('ikebana', '꽃꽂이(生け花)', w=1, h=1, up=0, kind='floor', use=('block',), tags=('화실', '장식', '거실'),
       place='도코노마 앞이나 방 구석', pair=('tokonoma',),
       desc='작은 푸른 화병의 꽃꽂이 1칸 — 가지 세 갈래에 분홍·붉은·흰 꽃.')
def d_ikebana(c):
    for (x, y0) in ((7, 4), (9, 5), (5, 7)): c.VL(x, y0, 6, K('midori', 0))
    for (x, y) in ((6, 8), (10, 8), (4, 9)): px(c, x, y, K('midori', 3))
    for (cx, cy, col) in ((7, 3, K('pinku', 2)), (10, 5, K('aka', 3)), (4, 6, K('kinari', 3))):
        disc(c, cx, cy, 2, 2, col); px(c, cx - 1, cy - 1, K('shiro', 4))
    c.R(6, 9, 4, 1, K('sora', 3)); c.R(5, 10, 6, 5, K('sora', 1)); c.VL(5, 10, 5, K('sora', 3)); c.VL(10, 10, 5, K('sora', -1))
    c.HL(5, 14, 6, K('sora', -2)); c.HL(4, 15, 8, OL)


@R.obj('tv-old', '브라운관 TV', w=1, h=1, up=0, kind='wall', use=('block',), tags=('화실', '거실'),
       place='방 모서리, 북쪽 벽 아래 낮은 받침 위', pair=('kotatsu',),
       desc='낮은 받침 위의 브라운관 TV 1칸 — 회색 몸체에 둥근 푸른 화면, 오른쪽 조절 홈과 스피커 줄.')
def d_tv_old(c):
    t = lambda s: K('tekko', s)
    box3(c, 1, 0, 14, 4, 7, t(3), t(1), t(4), lip=t(2))
    c.R(3, 5, 8, 5, OL); c.R(4, 5, 6, 4, K('garasu', 1)); c.HL(4, 5, 6, K('garasu', 3)); px(c, 4, 6, K('garasu', 5)); px(c, 5, 6, K('garasu', 4))
    c.HL(4, 8, 6, K('garasu', 0)); px(c, 9, 7, K('garasu', 2))
    for y in (5, 7, 9): c.HL(12, y, 2, t(-1))                           # 스피커 줄
    px(c, 12, 6, K('kinari', 3)); px(c, 13, 6, K('kinari', 2))
    c.R(2, 11, 12, 4, W(0)); c.HL(2, 11, 12, W(2)); c.R(5, 12, 6, 2, W(-2))   # 받침
    c.HL(2, 14, 12, W(-1)); px(c, 3, 15, OL); px(c, 12, 15, OL); px(c, 2, 15, OL); px(c, 13, 15, OL)


# ───────────── 탁상 물건(16×16, 탁자 윗면에 놓인 자리 기준) ─────────────
@R.good('tea-set', '찻주전자와 찻잔')
def g_tea(c):
    s = lambda v: K('soil', v)
    c.R(1, 8, 14, 2, K('aka', -1)); c.HL(1, 8, 14, K('aka', 1))          # 쟁반
    disc(c, 5.5, 5.5, 3.6, 3.2, s(1)); c.R(4, 2, 3, 1, s(0)); px(c, 5, 1, s(3)); px(c, 3, 3, s(3)); px(c, 4, 3, s(2))   # 몸통·뚜껑·꼭지
    px(c, 1, 3, s(1)); px(c, 2, 4, s(1))                                 # 주둥이
    px(c, 9, 4, s(0)); px(c, 9, 5, s(0)); px(c, 9, 6, s(0)) ; px(c, 8, 7, s(0))   # 손잡이
    c.R(10, 5, 4, 3, K('shiro', 3)); c.HL(10, 5, 4, K('midori', 2)); c.HL(10, 7, 4, K('shiro', 1)); px(c, 10, 6, K('shiro', 4))   # 찻잔 + 녹차
    c.HL(1, 10, 14, OL)


@R.good('mikan-basket', '귤 바구니')
def g_mikan(c):
    d = lambda v: K('daidai', v)
    c.R(3, 7, 10, 4, K('yuka', 1)); c.HL(3, 7, 10, K('yuka', 3)); c.HL(3, 10, 10, K('yuka', -1))
    for x in range(4, 13, 2): c.VL(x, 8, 2, K('yuka', 0))                # 대나무 결
    c.HL(3, 11, 10, OL)
    for (cx, cy) in ((5, 5), (8, 4), (11, 5)):
        disc(c, cx, cy, 2.2, 2.2, d(2)); px(c, cx - 1, cy - 1, d(4)); px(c, cx + 1, cy + 1, d(1))
    px(c, 8, 2, K('midori', 1))                                           # 꼭지잎


@R.good('senbei-plate', '전병 접시')
def g_senbei(c):
    p = lambda v: K('shiro', v)
    disc(c, 8, 8, 7, 3.2, OL); disc(c, 8, 8, 6.2, 2.6, p(3)); disc(c, 8, 8.4, 4.8, 1.8, p(2))
    for (cx, cy) in ((6, 6.5), (10, 6.5), (8, 5)):
        disc(c, cx, cy, 2, 1.7, K('yuka', 2)); px(c, cx - 1, cy - 1, K('yuka', 4)); px(c, cx + 1, cy + 1, K('yuka', 0))


@R.good('ashtray', '유리 재떨이')
def g_ashtray(c):
    disc(c, 8, 8, 5.5, 2.8, K('garasu', -1)); disc(c, 8, 7.5, 4.8, 2.2, K('garasu', 4)); disc(c, 8, 8, 3.2, 1.3, K('garasu', 2))
    px(c, 4, 7, K('shiro', 4)); px(c, 5, 6, K('shiro', 3))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

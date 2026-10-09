#!/usr/bin/env python3
"""jp_city 일본 실내 — 쇼핑몰·영화관 `interior_mall` (id 머리 `ml-`). 5묶음(오락·숙박·상업).

  python3 scripts/content/jp-city/blocks/interior_mall.py     # selftest + tiledata/jp-city/blocks/interior_mall/_all-x3.png

밝고 영업 중인 몰(지하상가 `wh-` 의 밤·버려진 판이 아니다). 화풍은 편의점·가게(`cv-` `sh-`)를 따른다:
가구 윗면은 바닥보다 밝고 대비가 크다, 윗면 가장자리 1px 밝은 테, 윤곽은 sumi/재질 어두운 단, 빛 왼쪽 위.
사람·마네킹 머리·얼굴·글자·숫자·로고 없음 — 간판·메뉴판·안내판·포스터·스크린은 색 덩이·도형·빛 번짐으로만.

크기 근거(1칸 = 16px = 1m, modern-style-bible §12-3 공식 F = 높이×16, T = 깊이×16×압축):
  가게 앞 진열창 폭 3m·높이 2.6m(간판 띠 포함) → wall 3×1 up 32(F 40 + T 4 = 44 + 받침).
  옷걸이 행거 1.5×0.5×1.5m → floor 2×1 up 16(F 24, T 4). 잡화 벽 선반 1.8×0.4×1.8m → wall 2×1 up 16(F 28, T 4).
  진열 탁자 1.6×0.9×0.8m → floor 2×1 up 0(F 10, T 6). 토르소 받침 0.4×0.4×1.6m → 1×1 up 16.
  에스컬레이터 폭 1.6m·길이(층고 4m 를 30°) — 그림 안에서는 2칸 폭, 발판 1칸 + 경사 1칸만 보이고 나머지는 벽 속으로 → wall 2×2.
  몰 벤치 1.8×0.5×0.45m + 화분 0.8m → floor 3×1 up 16. 안내판 0.6×0.3×1.7m → 1×1 up 16.
  푸드코트 가게(카운터 1.1m·뒤 메뉴판·후드) 폭 2m → wall 2×1 up 32. 식기 반납대 1.8×0.6×1.4m → wall 2×1 up 16.
  매표 카운터 1m 칸 × 1.1m + 칸막이 유리 → floor 1×1 up 16. 매점 뒤 설비(팝콘 기계·음료기) → wall 2×1 up 32.
  극장 좌석 0.55×0.6×1.0m(등받이) → floor 1×1 up 8(바로 앞 줄과 겹쳐 계단식으로 보인다). 검표대 0.5×0.4×1.1m → 1×1 up 16.
  스크린 폭 8m(작은 상영관) → hang 8칸.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_mall'
R = Registry(BLOCK, '쇼핑몰·영화관')
TM = ('쇼핑몰', 'ショッピングモール', '몰')
TC = ('영화관', '映画館', '극장', '시네마')

_KC = {}


def kc(ramp, t):
    key = (ramp, t)
    if key not in _KC: _KC[key] = K(ramp, t)          # K 는 램프 끝 단으로 자른다
    return _KC[key]


def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    if 0 <= x < c.w and 0 <= y < c.h and col is not None: c.P(x, y, col)


def rc(c, x, y, w, h, col):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(c.w, x + w), min(c.h, y + h)
    if x1 > x0 and y1 > y0: c.R(x0, y0, x1 - x0, y1 - y0, col)


def hl(c, x, y, n, col): rc(c, x, y, n, 1, col)
def vl(c, x, y, n, col): rc(c, x, y, 1, n, col)


def outline(c, x, y, w, h, col=None):
    col = col or OL
    hl(c, x, y, w, col); hl(c, x, y + h - 1, w, col); vl(c, x, y, h, col); vl(c, x + w - 1, y, h, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ol_in(c, col=None):
    """윤곽: 투명 이웃(캔버스 안)에 닿는 불투명 칸을 col 로. 캔버스 가장자리는 건드리지 않는다."""
    col = col or OL
    a = c.a; H, W = a.shape[:2]; todo = []
    for y in range(H):
        for x in range(W):
            if a[y, x, 3] == 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and a[ny, nx, 3] == 0: todo.append((x, y)); break
    for x, y in todo: c.P(x, y, col)


def top_slab(c, x, y, w, t, ramp, base=1):
    """윗면 t 줄(벽 쪽이 한 단 어둡고) + 앞 가장자리 밝은 줄 + 처마 그림자 2줄. 다음 줄 y 를 돌려준다."""
    rc(c, x, y, w, t, kc(ramp, base)); hl(c, x, y, w, kc(ramp, base - 1))
    hl(c, x, y + t, w, kc(ramp, base + 2))
    hl(c, x, y + t + 1, w, kc(ramp, -2)); hl(c, x, y + t + 2, w, kc(ramp, -1))
    return y + t + 3


PROD = [('aka', 0), ('sora', 0), ('kii', 1), ('midori', 0), ('pinku', 0), ('daidai', 0), ('murasaki', 0), ('shiro', 1), ('kon', 1)]
CLOTH = [('aka', 0), ('sora', 1), ('kii', 1), ('shiro', 1), ('kon', 0), ('pinku', 1), ('midori', 0), ('kinari', 0), ('murasaki', 1), ('daidai', 1)]


def goods_row(c, x, y, w, h, seed, pal=PROD, pitch=3):
    xx = x
    while xx + pitch - 1 <= x + w:
        ramp, st = pal[hs(xx, y, seed) % len(pal)]
        ih = max(2, h - (hs(xx, y, seed + 1) % 2))
        rc(c, xx, y + h - ih, pitch - 1, ih, kc(ramp, st)); hl(c, xx, y + h - ih, pitch - 1, kc(ramp, st + 2)); hl(c, xx, y + h - 1, pitch - 1, kc(ramp, st - 2))
        xx += pitch


# ═════════════════════════ 바닥·벽면 ═════════════════════════
@R.floor('ml-floor', '몰 광택 타일', cols=4, rows=4, tags=TM + ('통로', '광장', '바닥'),
         desc='쇼핑몰 통로·광장의 밝은 광택 석재 타일. 32px(2m) 큰 판이 크림·흰색으로 엇갈리고 줄눈이 굵다. 판마다 비스듬한 짧은 반사 줄. 몰 통로·분수 광장·푸드코트 전체에 깐다.')
def _ml_floor(c):
    for y in range(c.h):
        for x in range(c.w):
            tx, ty, lx, ly = x // 32, y // 32, x % 32, y % 32
            a = (tx + ty) % 2
            col = kc('shiro', 1) if a == 0 else kc('kinari', 2)
            if rnd(x, y, 3, 18): col = kc('shiro', 0) if a == 0 else kc('kinari', 1)
            # 반사: 판마다 비스듬한 짧은 줄 두 개(왼위 빛)
            for k in range(2):
                ox = 5 + hs(tx, ty, 10 + k) % 14; oy = 8 + k * 12 + hs(tx, ty, 20 + k) % 5
                d = lx - ox
                if 0 <= d < 6 and ly == oy - d // 2: col = kc('shiro', 2)
            if lx == 0 or ly == 0: col = kc('conc', 1)
            elif lx == 31 or ly == 31: col = kc('conc', 2)
            elif lx == 1 or ly == 1: col = kc('shiro', 2)
            c.P(x, y, col)


@R.floor('ml-shop-floor', '가게 나무 바닥', cols=4, rows=4, tags=TM + ('가게', '매장', '바닥'),
         desc='몰 안 가게(옷·잡화·전자) 매장의 밝은 나무 널 바닥. 널 4px 줄이 반씩 엇갈려 이어진다. 몰 통로 타일과 색이 달라 가게 경계가 보인다.')
def _ml_shop_floor(c):
    for y in range(c.h):
        r, yy = y // 4, y % 4
        off = (r * 24) % 32
        for x in range(c.w):
            bid = ((x - off) // 32) % 2
            col = kc('yuka', 1) if hs(r, (x - off) // 32, 31) % 4 else kc('yuka', 2)
            if yy == 3: col = kc('yuka', 0)
            if (x - off) % 32 == 0: col = kc('yuka', -1) if yy < 3 else kc('yuka', 0)
            elif yy == 1 and rnd(x // 3, r, 32 + bid, 70) and x % 3 == 0: col = kc('yuka', 0)
            c.P(x, y, col)


@R.floor('ml-cinema-carpet', '영화관 카펫', cols=4, rows=4, tags=TC + ('로비', '상영관', '바닥'),
         desc='영화관 로비·상영관의 짙은 붉은 카펫. 마름모 격자 무늬(더 짙은 붉은 선)와 마름모 가운데 주황 점. 조용한 4톤.')
def _ml_carpet(c):
    for y in range(c.h):
        for x in range(c.w):
            lx, ly = x % 16, y % 16
            col = kc('aka', -1)
            dd = abs(lx - 8) + abs(ly - 8)
            if dd == 8: col = kc('aka', -2)
            elif lx == 8 and ly == 8 and ((x // 16 + y // 16) % 2 == 0): col = kc('daidai', -1)
            elif dd == 0: col = kc('aka', -2)
            elif rnd(x, y, 41, 25): col = kc('pinku', -2)
            c.P(x, y, col)


@R.wall('ml-wall', '몰 흰 패널 벽', cols=4, tags=TM + ('벽',),
        desc='쇼핑몰 벽면 — 큰 흰 패널(32px 마다 이음), 위 줄 가운데 은색 몰딩 띠, 맨 아래 스테인리스 걸레받이.')
def _ml_wall(c):
    for y in range(32):
        for x in range(c.w):
            col = kc('shiro', 1) if y < 16 else kc('shiro', 0)
            if x % 32 == 0: col = kc('conc', 1)
            elif x % 32 == 1: col = kc('shiro', 2)
            if y == 10: col = kc('conc', 2)
            if y == 11: col = kc('conc', 0)
            if y == 12: col = kc('shiro', 2)
            if y >= 27: col = (kc('conc', 2), kc('conc', 1), kc('conc', 1), kc('conc', 0), kc('conc', -2))[y - 27]
            c.P(x, y, col)


@R.wall('ml-cinema-wall', '극장 천 벽', cols=4, tags=TC + ('벽', '상영관', '로비'),
        desc='영화관 벽면 — 짙은 감색 흡음 천(세로 주름)에 작은 벽등이 칸마다 계단처럼 높이를 달리해 빛나고, 그 아래로 빛이 번진다. 맨 아래 검은 걸레받이.')
def _ml_cinema_wall(c):
    for y in range(32):
        for x in range(c.w):
            m = x % 4
            col = (kc('kon', -2), kc('kon', 0), kc('kon', -1), kc('kon', -1))[m]
            if y < 3: col = kc('kon', -2)
            c.P(x, y, col)
    # 벽등 — 16px 마다 하나, 높이가 5·8·11·8 로 계단처럼(주기 64px). 등 둘레 후광 한 겹 + 아래로 세로 빛 씻김(디더).
    for i, ly in enumerate((5, 8, 11, 8)):
        cx = i * 16 + 8
        for yy in range(ly + 2, 25):
            for dx in (-1, 0, 1):
                if (yy + dx) % 2 == 0 or (dx == 0 and yy < ly + 8): c.P(cx + dx, yy, kc('kon', 0))
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2)): c.P(cx + dx, ly + dy, kc('kon', 0))
        rc(c, cx - 1, ly - 1, 3, 3, kc('mado', 1)); c.P(cx, ly - 1, kc('mado', 2)); c.P(cx - 1, ly - 1, kc('mado', 2)); hl(c, cx - 1, ly + 1, 3, kc('mado', -1))
    for x in range(c.w):
        c.P(x, 26, kc('kon', -2)); c.P(x, 27, kc('tekko', -1))
        for y in (28, 29, 30): c.P(x, y, kc('tekko', -2))
        c.P(x, 31, kc('sumi', -1))


# ═════════════════════════ 쇼핑몰 ═════════════════════════
def _shopfront(c, accent, kind):
    """가게 앞 진열창 3×1(up 32): 간판 상자(윗면 4px) → 유리 진열창(안에 상품) → 받침. 오른쪽 끝 1칸은 입구 틀(유리문)."""
    W = 48
    # 간판 상자 윗면·앞 가장자리·처마 그림자
    rc(c, 0, 0, W, 4, kc('conc', 1)); hl(c, 0, 0, W, kc('conc', 0)); hl(c, 0, 4, W, kc('shiro', 2))
    rc(c, 0, 5, W, 8, kc(accent, 0)); hl(c, 0, 5, W, kc(accent, 1)); hl(c, 0, 12, W, kc(accent, -1))
    for x0 in (4, 20, 36): rc(c, x0, 7, 8, 3, kc(accent, 1)); hl(c, x0, 7, 8, kc('shiro', 2))     # 간판 색 판(글자 없음)
    hl(c, 0, 13, W, kc('tekko', -2)); hl(c, 0, 14, W, kc('tekko', -1))                              # 처마 그림자
    # 진열창 틀
    rc(c, 0, 15, W, 26, kc('tekko', 1)); vl(c, 0, 15, 26, kc('conc', 2)); vl(c, W - 1, 15, 26, kc('tekko', -1))
    rc(c, 2, 16, 44, 23, kc('garasu', 1))
    # 안 진열(가게마다)
    if kind == 'clothes':
        for i, x0 in enumerate((5, 15, 25)):            # 토르소 셋(머리·팔 없음) + 옷
            ramp, st = CLOTH[(i * 3 + 1) % len(CLOTH)]
            disc(c, x0 + 3.5, 20, 3.2, 1.6, kc('kinari', 1))
            rc(c, x0, 21, 8, 10, kc(ramp, st)); hl(c, x0, 21, 8, kc(ramp, st + 1)); vl(c, x0 + 7, 21, 10, kc(ramp, st - 1))
            px(c, x0 + 3, 21, kc('shiro', 2)); px(c, x0 + 4, 21, kc('shiro', 2))
            vl(c, x0 + 3, 31, 5, kc('tekko', 0)); hl(c, x0 + 1, 36, 6, kc('tekko', -1))
        for x0 in range(36, 45, 2):                      # 옷 걸린 봉
            ramp, st = CLOTH[hs(x0, 1, 5) % len(CLOTH)]
            rc(c, x0, 21, 2, 12, kc(ramp, st)); px(c, x0, 21, kc(ramp, st + 1))
        hl(c, 35, 20, 11, kc('tekko', 2))
    elif kind == 'goods':
        for j, y0 in enumerate((18, 25, 32)):
            goods_row(c, 3, y0, 42, 5, 70 + j, pal=PROD, pitch=4)
            hl(c, 2, y0 + 5, 44, kc('ita', 1)); hl(c, 2, y0 + 6, 44, kc('ita', -1))
    else:   # electronics
        for i, x0 in enumerate((4, 18, 32)):
            rc(c, x0, 18, 12, 8, kc('sumi', 0)); rc(c, x0 + 1, 19, 10, 6, kc('sora', 1 - (i % 2)))
            hl(c, x0 + 1, 19, 10, kc('sora', 2)); rc(c, x0 + 2, 22, 4, 2, kc('midori', 1 if i != 1 else 0)); px(c, x0 + 8, 20, kc('shiro', 2))
            vl(c, x0 + 6, 26, 2, kc('tekko', -1))
        for i, x0 in enumerate(range(4, 44, 5)):         # 아래 단: 휴대폰·태블릿
            rc(c, x0, 31, 3, 5, kc('sumi', 0)); rc(c, x0 + 1 - 1 + 1, 32, 1, 3, kc('sora', 2 - (i % 3)))
        hl(c, 2, 36, 44, kc('shiro', 1)); hl(c, 2, 37, 44, kc('conc', 0))
    # 유리 반사(대각선) — 진열 위에
    for k in range(7):
        px(c, 6 + k, 30 - k * 2, kc('garasu', 3)); px(c, 7 + k, 30 - k * 2, kc('garasu', 3))
        px(c, 30 + k, 33 - k * 2, kc('garasu', 3))
    hl(c, 2, 16, 44, kc('tekko', -1)); vl(c, 2, 16, 23, kc('tekko', -1))                              # 틀 안쪽 그늘(물러선 유리)
    vl(c, 23, 16, 23, kc('tekko', 0))                                                                # 가운데 멀리온
    # 받침(발밑 줄): 진열 단 윗면 + 앞판
    rc(c, 0, 39, W, 3, kc('shiro', 1)); hl(c, 0, 39, W, kc('shiro', 2)); hl(c, 0, 41, W, kc('conc', 0))
    rc(c, 0, 42, W, 5, kc(accent, -1)); hl(c, 0, 42, W, kc(accent, 0)); hl(c, 0, 46, W, kc('tekko', -2))
    hl(c, 0, 47, W, OL)
    vl(c, 0, 0, 48, OL); vl(c, W - 1, 0, 48, OL)


@R.obj('ml-shopfront-clothes', '가게 앞 진열창(옷)', w=3, h=1, up=32, kind='wall', use=('search',),
       tags=TM + ('가게 앞', '진열창', '옷가게', '쇼윈도'), place='몰 통로 북쪽 — 가게 칸막이 벽면 바로 아래 첫 바닥 줄, 가게 입구 틈 옆', pair=('ml-shopfront-goods', 'ml-torso-stand'),
       desc='옷가게 앞 쇼윈도 3×1. 분홍 간판 상자(글자 없음) 아래 유리창 안에 옷 입힌 토르소 셋(머리·팔 없음)과 옷 걸린 봉. 가게 칸막이 벽(통로 쪽) 아래에, 옆에 2칸 입구 틈.')
def _sf_clothes(c): _shopfront(c, 'pinku', 'clothes')


@R.obj('ml-shopfront-goods', '가게 앞 진열창(잡화)', w=3, h=1, up=32, kind='wall', use=('search',),
       tags=TM + ('가게 앞', '진열창', '잡화점', '쇼윈도'), place='몰 통로 북쪽 — 가게 칸막이 벽면 바로 아래 첫 바닥 줄, 가게 입구 틈 옆', pair=('ml-shopfront-clothes', 'ml-shelf-goods'),
       desc='잡화점 앞 쇼윈도 3×1. 초록 간판 상자(글자 없음) 아래 유리창 안에 나무 선반 세 단 — 색색 컵·상자·문구가 빽빽하다. 가게 칸막이 벽 아래에, 옆에 입구 틈.')
def _sf_goods(c): _shopfront(c, 'midori', 'goods')


@R.obj('ml-shopfront-tech', '가게 앞 진열창(전자)', w=3, h=1, up=32, kind='wall', use=('search',),
       tags=TM + ('가게 앞', '진열창', '전자 매장', '쇼윈도'), place='몰 통로 북쪽 — 가게 칸막이 벽면 바로 아래 첫 바닥 줄, 가게 입구 틈 옆', pair=('ml-tv-shelf', 'ml-gadget-table'),
       desc='전자 매장 앞 쇼윈도 3×1. 감색 간판 상자(글자 없음) 아래 유리창 안에 켜진 TV 셋(파란 화면, 그림 없음)과 아래 단 휴대폰·태블릿 줄. 가게 칸막이 벽 아래에, 옆에 입구 틈.')
def _sf_tech(c): _shopfront(c, 'kon', 'tech')


@R.obj('ml-clothes-rack', '옷걸이 행거', w=2, h=1, up=16, kind='floor', use=('search',),
       tags=TM + ('옷가게', '행거', '옷'), place='옷가게 안 바닥 — 벽 선반 앞 줄이나 가게 가운데, 줄 사이 1칸', pair=('ml-torso-stand', 'ml-display-table'),
       desc='크롬 봉 행거 2×1. 가로 봉에 색색 셔츠·재킷이 옷걸이에 촘촘히 걸려 있고, 아래 바퀴 달린 받침 틀. 옷가게 안에 1~2개.')
def _rack(c):
    # 받침 틀(위에서 보이는 H 틀) — 발밑 줄
    rc(c, 1, 26, 30, 3, kc('tekko', 1)); hl(c, 1, 26, 30, kc('tekko', 3)); hl(c, 1, 28, 30, kc('tekko', -1))
    for x0 in (1, 28): rc(c, x0, 24, 3, 7, kc('tekko', 0)); hl(c, x0, 24, 3, kc('tekko', 2))
    for x0 in (2, 29): rc(c, x0, 30, 2, 2, kc('sumi', 0))
    # 기둥
    vl(c, 2, 3, 22, kc('tekko', 2)); vl(c, 3, 3, 22, kc('tekko', 0)); vl(c, 29, 3, 22, kc('tekko', 1)); vl(c, 30, 3, 22, kc('tekko', -1))
    # 봉
    hl(c, 1, 3, 30, kc('shiro', 2)); hl(c, 1, 4, 30, kc('tekko', 0))
    # 옷 — 앞뒤 두 겹(뒤는 한 단 어둡게), 어깨선이 봉에 걸린다
    for layer, (y0, dk) in enumerate(((5, -1), (6, 0))):
        for x0 in range(4 + layer, 28, 3):
            ramp, st = CLOTH[hs(x0, layer, 7) % len(CLOTH)]
            ln = 13 + hs(x0, layer, 8) % 5
            rc(c, x0, y0, 3, ln, kc(ramp, st + dk)); hl(c, x0, y0, 3, kc(ramp, st + 1 + dk))
            vl(c, x0 + 2, y0 + 1, ln - 1, kc(ramp, st - 1 + dk))
            px(c, x0 + 1, y0 - 1, kc('tekko', -1))                    # 옷걸이 고리
    ol_in(c)


@R.obj('ml-shelf-goods', '잡화 벽 선반', w=2, h=1, up=16, kind='wall', use=('search',),
       tags=TM + ('잡화점', '선반', '진열'), place='잡화점·옷가게 북쪽 벽면 바로 아래 첫 바닥 줄 — 2~3개 이어서', pair=('ml-display-table', 'ml-shopping-bag'),
       desc='벽에 붙인 흰 틀 나무 선반 2×1(키 1.8m). 윗면 4px·앞 가장자리 밝은 줄·처마 그림자 아래로 세 단에 컵·작은 상자·문구·쿠션이 색색으로 빽빽하다. 가게 북쪽 벽을 따라 줄지어.')
def _shelf_goods(c):
    y = top_slab(c, 0, 0, 32, 4, 'shiro', 1)
    rc(c, 0, y, 32, 32 - y, kc('shiro', 0)); vl(c, 0, y, 32 - y, kc('shiro', 2)); vl(c, 31, y, 32 - y, kc('conc', -1))
    rc(c, 2, y, 28, 22, kc('ita', -2))                               # 들어간 안쪽(어두운 뒷판)
    for j, y0 in enumerate((y, y + 7, y + 14)):
        goods_row(c, 3, y0 + 1, 26, 5, 90 + j, pal=PROD, pitch=3)
        hl(c, 1, y0 + 6, 30, kc('ita', 1)); hl(c, 1, y0 + 7, 30, kc('ita', -1))
    rc(c, 0, 29, 32, 3, kc('conc', 0)); hl(c, 0, 29, 32, kc('conc', 2))
    ol_in(c)


@R.obj('ml-display-table', '진열 탁자', w=2, h=1, up=0, kind='floor', surface=True, use=('search',),
       tags=TM + ('옷가게', '잡화점', '평대', '진열'), place='가게 가운데·입구 안쪽 — 위에 쇼핑백·소품(탁상 물건)을 올린다', pair=('ml-clothes-rack', 'ml-shopping-bag'),
       desc='나무 진열 평대 2×1. 밝은 상판 왼쪽에 개어 쌓은 옷 두 더미, 오른쪽은 비어 탁상 물건을 올린다. 앞판·다리. 가게 가운데에 하나.')
def _display_table(c):
    rc(c, 0, 1, 32, 7, kc('yuka', 1)); hl(c, 0, 1, 32, kc('yuka', 2)); vl(c, 0, 1, 7, kc('yuka', 2)); hl(c, 0, 7, 32, kc('yuka', 2))
    for i, x0 in enumerate((2, 8)):                                  # 개어 쌓은 옷(위에서 본 사각, 층층 색 띠)
        ramp, st = CLOTH[(i * 4 + 2) % len(CLOTH)]
        rc(c, x0, 2, 5, 5, kc(ramp, st)); hl(c, x0, 2, 5, kc(ramp, st + 1)); hl(c, x0, 4, 5, kc(ramp, st - 1)); hl(c, x0, 6, 5, kc(ramp, st - 2))
    rc(c, 0, 8, 32, 5, kc('yuka', -1)); hl(c, 0, 8, 32, kc('yuka', 0)); hl(c, 0, 12, 32, kc('yuka', -2))
    for x0 in (1, 29): rc(c, x0, 13, 2, 3, kc('yuka', -2))
    ol_in(c)


@R.obj('ml-torso-stand', '토르소 받침(옷)', w=1, h=1, up=16, kind='floor', use=('search',),
       tags=TM + ('옷가게', '토르소', '디스플레이'), place='옷가게 입구 안쪽·쇼윈도 앞 — 1~2개', pair=('ml-clothes-rack', 'ml-shopfront-clothes'),
       desc='옷을 입힌 토르소(머리·팔 없는 원통 몸통) 1×1. 위 둥근 마개, 셔츠 입은 몸통, 가는 쇠 기둥과 둥근 받침. 사람 모형이 아니라 옷걸이 받침이다.')
def _torso(c):
    disc(c, 8, 29, 6, 2.2, kc('tekko', 0)); hl(c, 4, 28, 8, kc('tekko', 2))           # 받침 원판
    vl(c, 7, 19, 10, kc('tekko', 2)); vl(c, 8, 19, 10, kc('tekko', -1))             # 기둥
    disc(c, 8, 4, 2.5, 1.3, kc('kinari', 1)); px(c, 7, 4, kc('kinari', 2))           # 목 마개(둥근 뚜껑)
    rc(c, 3, 5, 10, 14, kc('midori', 0))                                            # 셔츠 몸통(원통)
    hl(c, 4, 5, 8, kc('midori', 1)); vl(c, 3, 6, 12, kc('midori', 1)); vl(c, 12, 6, 12, kc('midori', -1)); vl(c, 11, 7, 11, kc('midori', -1))
    for y in (8, 11, 14): px(c, 8, y, kc('shiro', 2))                               # 단추
    px(c, 6, 5, kc('shiro', 2)); px(c, 9, 5, kc('shiro', 2))                         # 깃
    hl(c, 3, 18, 10, kc('kon', 0)); hl(c, 4, 19, 8, kc('kon', -1))                   # 아래 단(바지 허리)
    px(c, 3, 5, None); px(c, 12, 5, None)
    ol_in(c)


@R.obj('ml-escalator-up', '에스컬레이터(위로)', w=2, h=2, up=32, kind='wall', walk=[(0, 1), (1, 1)], stairs='up', use=('travel',),
       tags=TM + ('에스컬레이터', 'エスカレーター', '이동', '위층'),
       place='북쪽 벽 바로 아래 첫 바닥 줄부터 2줄(벽 가구 자리) — 아랫줄 발판 두 칸에 위층으로 가는 links', pair=('ml-escalator-down', 'ml-info-board'),
       desc='움직이는 오르는 에스컬레이터 2×2. 은색 디딤판이 노란 테를 달고 북쪽 벽 속(위층 바닥 끝)으로 올라가고, 양옆 유리 난간과 검은 손잡이, 아래 끝 손잡이가 둥글게 감긴다. '
            '윗줄(경사)은 막히고 아랫줄 빗살 발판 두 칸을 밟으면 위층으로 간다.')
def _esc_up(c):
    # 위층 바닥 끝(벽 속으로 들어가는 곳): 어둠 + 슬래브 띠
    rc(c, 4, 0, 24, 8, kc('yoru', -2)); rc(c, 2, 4, 28, 4, kc('conc', 2)); hl(c, 2, 4, 28, kc('shiro', 2)); hl(c, 2, 7, 28, kc('conc', -1))
    hl(c, 2, 8, 28, kc('tekko', -2)); hl(c, 2, 9, 28, kc('tekko', -1))
    # 디딤판: 위로 갈수록 좁은 간격(멀어짐), 디딤면 밝게·챌면 어둡게, 양끝 노란 테
    y = 44
    i = 0
    while y > 10:
        tread = 3 if i < 4 else 2
        riser = 2
        rc(c, 5, y - tread, 22, tread, kc('tekko', 2 - (i > 4)))
        hl(c, 5, y - tread, 22, kc('shiro', 1) if i < 3 else kc('tekko', 2))
        for x in range(6, 26, 2): px(c, x, y - 1, kc('tekko', 0))                    # 홈
        rc(c, 5, y, 22, riser, kc('tekko', -1)); hl(c, 5, y + riser - 1, 22, kc('tekko', -2))
        px(c, 5, y - tread, kc('kii', 1)); px(c, 26, y - tread, kc('kii', 1)); px(c, 6, y - tread, kc('kii', 0)); px(c, 25, y - tread, kc('kii', 0))
        y -= tread + riser
        i += 1
    # 양옆 난간: 유리 판 + 검은 손잡이(위로 벽 속까지), 아래 끝 둥근 감김
    for (x, side) in ((0, -1), (27, 1)):
        rc(c, x + 1, 6, 3, 44, kc('garasu', 2))
        for yy in range(10, 48, 7): px(c, x + 2, yy, kc('garasu', 3)); px(c, x + 2, yy + 1, kc('shiro', 2))
        vl(c, x + (0 if side < 0 else 4), 2, 52, kc('yoru', -2)); vl(c, x + (1 if side < 0 else 3), 4, 48, kc('yoru', 0))
        rc(c, x, 48, 5, 6, kc('yoru', -1)); hl(c, x + 1, 48, 3, kc('yoru', 1)); hl(c, x, 53, 5, kc('sumi', -1))   # 손잡이 감김
        vl(c, x + (4 if side < 0 else 0), 6, 42, kc('tekko', 0))                     # 스커트 판
    px(c, 2, 50, kc('midori', 2)); px(c, 29, 50, kc('midori', 2))                     # 운전 표시등
    # 발판(빗살판) — 밟는 칸
    rc(c, 4, 48, 24, 16, kc('tekko', 1))
    hl(c, 4, 48, 24, kc('kii', 1)); hl(c, 4, 49, 24, kc('kii', -1)); hl(c, 4, 50, 24, kc('tekko', 2))
    for x in range(5, 27, 2): vl(c, x, 52, 9, kc('tekko', 0))
    hl(c, 4, 61, 24, kc('tekko', -1)); hl(c, 4, 62, 24, kc('conc', -1)); hl(c, 4, 63, 24, kc('conc', 0))
    rc(c, 0, 54, 4, 10, kc('conc', 1)); rc(c, 28, 54, 4, 10, kc('conc', 0)); vl(c, 0, 54, 10, kc('shiro', 2)); vl(c, 31, 54, 10, kc('conc', -2))


@R.obj('ml-escalator-down', '에스컬레이터(아래로)', w=2, h=2, up=16, kind='wall', walk=[(0, 1), (1, 1)], stairs='down', use=('travel',),
       tags=TM + ('에스컬레이터', 'エスカレーター', '이동', '아래층'),
       place='위층 북쪽 벽 바로 아래 첫 바닥 줄부터 2줄 — 아랫줄 발판 두 칸에 아래층으로 가는 links. 아래층 오르는 에스컬레이터 옆 x 에',
       pair=('ml-escalator-up',),
       desc='움직이는 내려가는 에스컬레이터 2×2. 발판에서 북쪽으로 은색 디딤판이 아래층 쪽 어둠으로 내려가며 좁아지고, 양옆 유리 난간·검은 손잡이, 북쪽 끝 유리 칸막이. '
            '윗줄은 막히고 아랫줄 빗살 발판 두 칸을 밟으면 아래층으로 간다.')
def _esc_down(c):
    rc(c, 4, 4, 24, 28, kc('yoru', -2))                                              # 아래층으로 뚫린 곳
    for i in range(7):                                                               # 북쪽으로 내려가며 어둡고 좁아지는 디딤판
        y = 30 - i * 4
        inset = 5 + i // 2
        t = 2 - i
        if t < -3: break
        hl(c, inset, y - 2, 32 - 2 * inset, kc('tekko', t + 1)); hl(c, inset, y - 1, 32 - 2 * inset, kc('tekko', t))
        px(c, inset, y - 2, kc('kii', 0 if i < 3 else -1)); px(c, 31 - inset, y - 2, kc('kii', 0 if i < 3 else -1))
    for (x, side) in ((0, -1), (27, 1)):                                             # 유리 난간(바닥 위로 솟음)
        rc(c, x + 1, 2, 3, 30, kc('garasu', 2))
        for yy in range(6, 30, 7): px(c, x + 2, yy, kc('garasu', 3)); px(c, x + 2, yy + 1, kc('shiro', 2))
        vl(c, x + (0 if side < 0 else 4), 0, 34, kc('yoru', -2)); vl(c, x + (1 if side < 0 else 3), 1, 32, kc('yoru', 0))
        rc(c, x, 30, 5, 5, kc('yoru', -1)); hl(c, x + 1, 30, 3, kc('yoru', 1)); hl(c, x, 34, 5, kc('sumi', -1))
    rc(c, 4, 1, 24, 3, kc('garasu', 2)); hl(c, 4, 0, 24, kc('yoru', -2)); hl(c, 5, 1, 22, kc('garasu', 3)); hl(c, 4, 4, 24, kc('yoru', 0))   # 북쪽 끝 유리 칸막이
    px(c, 2, 33, kc('aka', 1)); px(c, 29, 33, kc('aka', 1))                          # 운전 표시등(내려감)
    rc(c, 4, 32, 24, 16, kc('tekko', 1))                                             # 빗살판(밟는 칸)
    hl(c, 4, 32, 24, kc('kii', 1)); hl(c, 4, 33, 24, kc('kii', -1)); hl(c, 4, 34, 24, kc('tekko', 2))
    for x in range(5, 27, 2): vl(c, x, 36, 9, kc('tekko', 0))
    hl(c, 4, 45, 24, kc('tekko', -1)); hl(c, 4, 46, 24, kc('conc', -1)); hl(c, 4, 47, 24, kc('conc', 0))
    rc(c, 0, 35, 4, 13, kc('conc', 1)); rc(c, 28, 35, 4, 13, kc('conc', 0)); vl(c, 0, 35, 13, kc('shiro', 2)); vl(c, 31, 35, 13, kc('conc', -2))


@R.obj('ml-bench', '몰 벤치(화분 붙음)', w=3, h=1, up=16, kind='floor', use=('sit',),
       tags=TM + ('벤치', '휴게', '화분'), place='몰 통로·광장 가장자리, 분수 곁 — 통로 2칸을 남기고', pair=('ml-fountain', 'ml-info-board'),
       desc='몰 휴게 벤치 3×1 — 등받이 없는 나무 널 좌판 2칸(은색 다리)과 오른쪽 끝 네모 화분 1칸(둥근 관엽 잎). 통로 가장자리·분수 곁에 놓는다.')
def _bench(c):
    # 좌판(위에서 보이는 널 3장) + 앞날 + 다리 — 왼쪽 32px
    rc(c, 1, 18, 30, 7, kc('yuka', 1))
    for y in (18, 20, 22): hl(c, 1, y, 30, kc('yuka', 2))
    for y in (19, 21, 23): hl(c, 1, y, 30, kc('yuka', 1))
    hl(c, 1, 24, 30, kc('yuka', 2)); rc(c, 1, 25, 30, 2, kc('yuka', -1)); hl(c, 1, 27, 30, kc('yuka', -2))
    for x0 in (3, 26): rc(c, x0, 27, 3, 4, kc('tekko', 1)); vl(c, x0 + 2, 27, 4, kc('tekko', -1))
    # 화분 상자 — 오른쪽 16px: 윗면(흙) + 앞면 + 잎
    rc(c, 33, 16, 14, 4, kc('soil', 0)); hl(c, 33, 16, 14, kc('soil', -1)); hl(c, 33, 20, 14, kc('shiro', 2))
    rc(c, 33, 21, 14, 9, kc('shiro', 0)); hl(c, 33, 21, 14, kc('shiro', 1)); vl(c, 46, 21, 9, kc('conc', 0)); hl(c, 33, 29, 14, kc('conc', -1))
    for (cx, cy, r, t) in ((40, 10, 6, 0), (36, 13, 4, -1), (44, 13, 4, -1), (40, 6, 4, 1), (37, 8, 3, 1)):
        disc(c, cx, cy, r, r * 0.85, kc('ki', t))
    for (x0, y0) in ((38, 5), (41, 7), (36, 10), (43, 10), (39, 12)): px(c, x0, y0, kc('ki', 3))
    vl(c, 40, 14, 3, kc('ki', -2))
    ol_in(c)


@R.obj('ml-info-board', '몰 안내판', w=1, h=1, up=16, kind='floor', use=('read',),
       tags=TM + ('안내판', '층 안내', '지도'), place='출입구 안쪽·에스컬레이터 앞 — 통로를 막지 않는 가장자리', pair=('ml-escalator-up', 'ml-bench'),
       desc='세워 둔 층 안내판 1×1. 은색 틀 안에 가게 자리를 색 칸(분홍·초록·파랑·노랑)으로 나눈 평면도, 현재 위치 빨간 점(글자 없음). 아래 받침.')
def _info(c):
    rc(c, 2, 1, 12, 3, kc('conc', 2)); hl(c, 2, 1, 12, kc('conc', 1)); hl(c, 2, 4, 12, kc('shiro', 2))     # 윗면
    rc(c, 2, 5, 12, 21, kc('tekko', 0)); vl(c, 2, 5, 21, kc('tekko', 2)); vl(c, 13, 5, 21, kc('tekko', -2))
    rc(c, 3, 6, 10, 17, kc('shiro', 2))
    for (x0, y0, w, h, r) in ((4, 7, 4, 4, 'pinku'), (9, 7, 3, 4, 'midori'), (4, 12, 3, 4, 'sora'), (8, 12, 4, 4, 'kii'), (4, 17, 8, 3, 'daidai')):
        rc(c, x0, y0, w, h, kc(r, 1)); hl(c, x0, y0 + h - 1, w, kc(r, 0))
    hl(c, 3, 11, 10, kc('conc', 1)); vl(c, 8, 7, 4, kc('conc', 1))
    px(c, 7, 21, kc('aka', 1)); px(c, 8, 21, kc('aka', 0))
    rc(c, 5, 26, 6, 3, kc('tekko', -1)); rc(c, 3, 29, 10, 2, kc('tekko', 0)); hl(c, 3, 29, 10, kc('tekko', 2))
    ol_in(c)


@R.table('ml-fountain', '광장 분수', desc='쇼핑몰 광장 분수 — 둥근 모서리 흰 돌 수반, 안에 파란 물결, 윗줄 가운데 칸에 물기둥. 아무 크기(보통 3×2). 둘레 2칸 통로를 남긴다.',
         tags=TM + ('분수', '광장'))
def _fountain(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 0, W, H, kc('conc', 2))
    for (x, y) in ((0, 0), (1, 0), (0, 1), (W - 1, 0), (W - 2, 0), (W - 1, 1)): px(c, x, y, None)     # 둥근 모서리(위)
    hl(c, 2, 0, W - 4, kc('conc', 1)); hl(c, 1, 1, W - 2, kc('shiro', 2)); vl(c, 1, 2, H - 9, kc('shiro', 1))
    # 물(테 안)
    rc(c, 4, 4, W - 8, H - 12, kc('sora', 1))
    hl(c, 4, 4, W - 8, kc('sora', -1)); vl(c, 4, 4, H - 12, kc('sora', 0))                     # 테 그늘
    for y in range(7, H - 9, 4):
        for x in range(6 + (y // 4 % 2) * 3, W - 7, 7): hl(c, x, y, 3, kc('sora', 2))         # 물결
    # 앞(남쪽) 수반 벽 — 테 윗날 + 앞면 + 그늘
    hl(c, 2, H - 8, W - 4, kc('shiro', 2)); rc(c, 0, H - 7, W, 5, kc('conc', 1)); hl(c, 0, H - 3, W, kc('conc', -1)); hl(c, 0, H - 2, W, kc('conc', -2))
    for x in range(4, W - 2, 8): vl(c, x, H - 7, 4, kc('conc', 0))
    # 물기둥(가운데 칸)
    cx, cy = (w // 2) * 16 + 8, 10 if h > 1 else 7                # 물기둥은 윗줄 가운데 조각(3×2·3×3 모두 쓰는 MT)에
    rc(c, cx - 3, cy + 1, 6, 3, kc('conc', 1)); hl(c, cx - 3, cy + 1, 6, kc('shiro', 2))
    vl(c, cx - 1, cy - 6, 7, kc('shiro', 2)); vl(c, cx, cy - 7, 8, kc('garasu', 3))
    for (dx, dy) in ((-3, -5), (3, -4), (-4, -2), (4, -1), (-2, -7), (2, -6), (-5, 1), (5, 1)): px(c, cx + dx, cy + dy, kc('garasu', 3))
    for x in range(W): px(c, x, H - 1, OL)
    vl(c, 0, 2, H - 2, OL); vl(c, W - 1, 2, H - 2, OL); hl(c, 2, 0, W - 4, OL); px(c, 1, 1, OL); px(c, W - 2, 1, OL)


def _food_stall(c, accent, icon, seed):
    """푸드코트 가게 2×1(up 32): 위 간판 상자(색 + 음식 그림) → 뒤 메뉴판(색 사진 칸) + 스테인리스 주방 → 카운터."""
    W = 32
    rc(c, 0, 0, W, 4, kc(accent, 1)); hl(c, 0, 0, W, kc(accent, 0)); hl(c, 0, 4, W, kc(accent, 2))
    rc(c, 0, 5, W, 8, kc(accent, 0)); hl(c, 0, 12, W, kc(accent, -1))
    icon(c, 16, 9)
    hl(c, 0, 13, W, kc('tekko', -2)); hl(c, 0, 14, W, kc('tekko', -1))
    rc(c, 0, 15, W, 13, kc('conc', 1))                                                       # 주방 벽(스테인리스)
    for x in range(0, W, 8): vl(c, x, 15, 13, kc('conc', 0))
    rc(c, 2, 16, 28, 7, kc('sumi', 0))                                                       # 메뉴판(사진 칸 셋 + 값 띠)
    for i, x0 in enumerate((3, 12, 21)):
        ramp, st = (('daidai', 0), ('kii', 1), ('aka', 0), ('midori', 0), ('kinari', 1), ('pinku', 0))[(seed + i) % 6]
        rc(c, x0, 17, 8, 4, kc(ramp, st)); hl(c, x0, 17, 8, kc(ramp, st + 1)); px(c, x0 + 2, 18, kc('shiro', 2))
        hl(c, x0 + 1, 21, 6, kc('shiro', 0))
    rc(c, 3, 24, 6, 3, kc('tekko', -1)); rc(c, 22, 24, 7, 3, kc('tekko', 0)); hl(c, 22, 24, 7, kc('tekko', 2))   # 주방 기구
    # 카운터(발밑 줄): 상판 윗면 + 앞판(가게 색) + 받침
    rc(c, 0, 28, W, 5, kc('shiro', 1)); hl(c, 0, 28, W, kc('shiro', 0)); hl(c, 0, 32, W, kc('shiro', 2))
    rc(c, 22, 29, 6, 3, kc('conc', -1)); px(c, 24, 29, kc('aka', 1))                          # 호출벨 받침
    rc(c, 0, 33, W, 12, kc(accent, -1)); hl(c, 0, 33, W, kc(accent, 0)); hl(c, 0, 34, W, kc('tekko', -2))
    for x0 in (4, 18): rc(c, x0, 37, 10, 5, kc(accent, 0)); hl(c, x0, 37, 10, kc(accent, 1))
    rc(c, 0, 45, W, 3, kc('tekko', -2)); hl(c, 0, 47, W, OL)
    vl(c, 0, 0, 48, OL); vl(c, W - 1, 0, 48, OL); vl(c, 1, 5, 40, kc(accent, 1))


def _icon_bowl(c, x, y):
    rc(c, x - 5, y - 2, 10, 2, kc('kii', 2)); disc(c, x, y + 1, 5, 2.5, kc('shiro', 2)); hl(c, x - 4, y + 1, 8, kc('shiro', 0)); vl(c, x + 3, y - 4, 4, kc('ita', 1)); vl(c, x + 4, y - 4, 4, kc('ita', 0))


def _icon_rice(c, x, y):
    disc(c, x, y, 5, 2.5, kc('daidai', 1)); hl(c, x - 3, y - 1, 6, kc('shiro', 2)); hl(c, x - 4, y + 2, 8, kc('ita', 0))


def _icon_crepe(c, x, y):
    for k in range(6): hl(c, x - 3 + k // 2, y - 3 + k, 6 - k, kc('kii', 1))
    disc(c, x, y - 3, 3, 1.5, kc('pinku', 2)); px(c, x - 1, y - 4, kc('aka', 1))


def _icon_burger(c, x, y):
    disc(c, x, y - 2, 5, 2, kc('daidai', 1)); hl(c, x - 5, y, 10, kc('midori', 1)); hl(c, x - 5, y + 1, 10, kc('ita', -1)); hl(c, x - 4, y + 2, 8, kc('daidai', 0))


for _id, _ko, _acc, _icon, _seed, _what in (
        ('ml-food-stall', '푸드코트 가게(라멘)', 'aka', _icon_bowl, 0, '라멘·우동 — 붉은 간판에 그릇 그림'),
        ('ml-food-stall-b', '푸드코트 가게(덮밥)', 'daidai', _icon_rice, 1, '덮밥·카레 — 주황 간판에 밥 그림'),
        ('ml-food-stall-c', '푸드코트 가게(크레이프)', 'pinku', _icon_crepe, 2, '크레이프·아이스크림 — 분홍 간판에 크레이프 그림'),
        ('ml-food-stall-d', '푸드코트 가게(버거)', 'kii', _icon_burger, 3, '햄버거 — 노란 간판에 버거 그림')):
    def _mk(acc=_acc, icon=_icon, seed=_seed):
        return lambda c: _food_stall(c, acc, icon, seed)
    R.obj(_id, _ko, w=2, h=1, up=32, kind='wall', use=('counter',), tags=TM + ('푸드코트', 'フードコート', '음식점', '카운터'),
          place='푸드코트 북쪽 벽면 바로 아래 첫 바닥 줄 — 가게 넷을 업종 다르게 나란히, 카운터 앞 손님 자리 두 줄', pair=('ml-food-table', 'ml-tray-return'),
          desc='푸드코트 가게 카운터 2×1 — %s(글자 없음). 뒤에 음식 사진 색 칸 메뉴판과 스테인리스 주방, 앞에 흰 상판 카운터와 호출벨. 북쪽 벽을 따라 다른 가게와 나란히.' % _what)(_mk())


@R.table('ml-food-table', '푸드코트 탁자', desc='푸드코트 흰 멜라민 탁자 — 은색 테두리, 회색 다리. 아무 크기(보통 2×1). 의자(fd-chair-*)가 탁자를 본다. 위에 쟁반·컵(탁상 물건).',
         tags=TM + ('푸드코트', '탁자'))
def _food_table(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 1, W, H - 5, kc('shiro', 1)); hl(c, 0, 1, W, kc('shiro', 2)); vl(c, 0, 1, H - 5, kc('shiro', 2))
    for y in range(4, H - 6, 6):
        for x in range(3 + (y // 6 % 2) * 4, W - 2, 9): px(c, x, y, kc('shiro', 0))
    hl(c, 0, H - 4, W, kc('conc', 2)); hl(c, 0, H - 3, W, kc('tekko', 0))
    for x0 in range(1, W, 16): rc(c, x0 + 1, H - 2, 2, 2, kc('tekko', -1)); rc(c, x0 + 12, H - 2, 2, 2, kc('tekko', -1))
    hl(c, 0, 0, W, OL); vl(c, 0, 0, H - 2, OL); vl(c, W - 1, 0, H - 2, OL)


@R.obj('ml-tray-return', '식기 반납대', w=2, h=1, up=16, kind='wall', use=('search',),
       tags=TM + ('푸드코트', '반납대', '식기'), place='푸드코트 북쪽 벽면 아래, 가게 줄 끝 — 앞 2줄 비움', pair=('ml-tray', 'ml-food-table'),
       desc='푸드코트 식기 반납대 2×1. 스테인리스 선반 칸에 쟁반·그릇이 포개져 있고, 가운데 어두운 반납 구멍 위에 초록 띠(글자 없음), 아래 분리 쓰레기통 문.')
def _tray_return(c):
    y = top_slab(c, 0, 0, 32, 4, 'conc', 2)
    rc(c, 0, y, 32, 32 - y, kc('conc', 1)); vl(c, 0, y, 32 - y, kc('conc', 3)); vl(c, 31, y, 32 - y, kc('conc', -1))
    rc(c, 2, y, 28, 2, kc('midori', 0)); hl(c, 2, y, 28, kc('midori', 1))
    rc(c, 2, y + 3, 28, 8, kc('yoru', -1))                                                    # 반납 구멍(안쪽)
    for i, x0 in enumerate((4, 13, 22)):
        rc(c, x0, y + 7, 7, 4, kc('daidai', -1) if i != 1 else kc('kon', 0)); hl(c, x0, y + 7, 7, kc('daidai', 0) if i != 1 else kc('kon', 1))   # 쟁반
        disc(c, x0 + 3, y + 7, 2, 1, kc('shiro', 2))                                           # 그릇
    hl(c, 1, y + 11, 30, kc('conc', 3)); hl(c, 1, y + 12, 30, kc('conc', -1))
    for x0 in (2, 17): rc(c, x0, y + 14, 13, 30 - (y + 14), kc('conc', 0)); vl(c, x0, y + 14, 30 - (y + 14), kc('conc', 2)); hl(c, x0 + 4, y + 15, 5, kc('yoru', 0))
    px(c, 8, 29, kc('sora', 1)); px(c, 23, 29, kc('kii', 1))
    hl(c, 0, 30, 32, kc('tekko', -2))
    ol_in(c)


@R.obj('ml-tv-shelf', '전자 매장 TV 진열 선반', w=2, h=1, up=16, kind='wall', use=('search',),
       tags=TM + ('전자 매장', 'TV', '가전', '진열'), place='전자 매장 북쪽 벽면 바로 아래 첫 바닥 줄 — 2~3개 이어서', pair=('ml-gadget-table', 'ml-shopfront-tech'),
       desc='벽 진열 선반 2×1 — 위 단에 켜진 TV 두 대(파랑·초록 빛 화면, 그림·글자 없음), 아래 단에 상자째 쌓인 가전. 전자 매장 북쪽 벽을 따라.')
def _tv_shelf(c):
    y = top_slab(c, 0, 0, 32, 4, 'tekko', 1)
    rc(c, 0, y, 32, 32 - y, kc('tekko', -1)); vl(c, 0, y, 32 - y, kc('tekko', 1)); vl(c, 31, y, 32 - y, kc('tekko', -3))
    for i, x0 in enumerate((2, 17)):
        rc(c, x0, y + 1, 13, 10, kc('sumi', 0))
        ramp = ('sora', 'midori')[i]
        rc(c, x0 + 1, y + 2, 11, 8, kc(ramp, 0)); hl(c, x0 + 1, y + 2, 11, kc(ramp, 2)); rc(c, x0 + 1, y + 6, 11, 4, kc(ramp, -1))
        px(c, x0 + 2, y + 3, kc('shiro', 2)); px(c, x0 + 3, y + 3, kc('shiro', 2))
    hl(c, 1, y + 12, 30, kc('tekko', 2)); hl(c, 1, y + 13, 30, kc('tekko', -2))
    for i, x0 in enumerate((2, 10, 18, 25)):                                                  # 아래 단 상자
        rc(c, x0, y + 15, 6, 30 - (y + 15), kc('kinari', 0 if i % 2 else 1)); hl(c, x0, y + 15, 6, kc('kinari', 2)); vl(c, x0 + 5, y + 15, 30 - (y + 15), kc('kinari', -1))
        hl(c, x0 + 1, y + 18, 4, kc('sora', 0) if i % 2 else kc('aka', 0))
    hl(c, 0, 30, 32, kc('tekko', -2))
    ol_in(c)


@R.obj('ml-gadget-table', '휴대폰·태블릿 체험대', w=2, h=1, up=8, kind='floor', use=('search',),
       tags=TM + ('전자 매장', '휴대폰', '체험대', '진열'), place='전자 매장 가운데 — 둘레 1칸 이상 비워 손님이 만진다', pair=('ml-tv-shelf',),
       desc='흰 체험대 2×1 — 상판에 켜진 휴대폰·태블릿이 줄지어 놓였고(빛나는 화면, 글자 없음) 은색 거치대 줄, 앞판에 파란 띠. 전자 매장 가운데에.')
def _gadget(c):
    rc(c, 0, 4, 32, 11, kc('shiro', 1)); hl(c, 0, 4, 32, kc('shiro', 2)); vl(c, 0, 4, 11, kc('shiro', 2)); hl(c, 0, 14, 32, kc('shiro', 2))
    for i, x0 in enumerate((2, 8, 14, 21, 26)):
        w = 6 if i == 3 else 4
        rc(c, x0, 6, w, 7, kc('sumi', 0)); rc(c, x0 + 1, 7, w - 2, 5, kc(('sora', 'midori', 'murasaki', 'sora', 'daidai')[i], 1))
        px(c, x0 + 1, 7, kc('shiro', 2)); hl(c, x0, 13, w, kc('tekko', 0))
    rc(c, 0, 15, 32, 7, kc('shiro', 0)); hl(c, 0, 15, 32, kc('conc', 0)); hl(c, 1, 17, 30, kc('sora', 0)); hl(c, 1, 18, 30, kc('sora', -1))
    rc(c, 0, 22, 32, 2, kc('tekko', -2))
    ol_in(c)


@R.obj('ml-fitting-room', '피팅룸', w=1, h=1, up=32, kind='wall', use=('open',),
       tags=TM + ('옷가게', '피팅룸', '탈의실'), place='옷가게 북쪽 벽면 바로 아래 첫 바닥 줄, 가게 안쪽 구석', pair=('ml-clothes-rack',),
       desc='옷가게 피팅룸 1×1 — 흰 칸막이 상자 위 은색 테, 앞에 반쯤 열린 베이지 커튼, 안쪽 거울이 비친다. 가게 안쪽 벽에 하나.')
def _fitting(c):
    rc(c, 0, 0, 16, 4, kc('shiro', 1)); hl(c, 0, 0, 16, kc('shiro', 0)); hl(c, 0, 4, 16, kc('shiro', 2)); hl(c, 0, 5, 16, kc('conc', 0)); hl(c, 0, 6, 16, kc('conc', 1))
    rc(c, 0, 7, 16, 41, kc('shiro', 0)); vl(c, 0, 7, 41, kc('shiro', 2)); vl(c, 15, 7, 41, kc('conc', 0))
    rc(c, 2, 8, 12, 36, kc('conc', 1))                                                        # 안쪽
    rc(c, 9, 10, 4, 22, kc('garasu', 2)); vl(c, 9, 10, 22, kc('garasu', 3)); px(c, 11, 13, kc('shiro', 2))   # 거울
    hl(c, 2, 8, 12, kc('tekko', 1))                                                           # 커튼 봉
    for x in range(2, 9):                                                                     # 커튼(왼쪽으로 반쯤 젖힘)
        col = kc('kinari', 1) if x % 2 else kc('kinari', 0)
        vl(c, x, 9, 36, col)
    vl(c, 8, 9, 36, kc('kinari', -1))
    rc(c, 2, 44, 12, 3, kc('conc', 0)); hl(c, 0, 47, 16, OL)
    ol_in(c)


# ═════════════════════════ 영화관 ═════════════════════════
@R.obj('ml-ticket-counter', '매표 카운터', w=1, h=1, up=16, kind='floor', surface=True, use=('counter',),
       tags=TC + ('매표소', '카운터', '티켓'), place='영화관 로비 — 1×1 을 2~4칸 이어 붙인 줄, 앞 손님 자리 두 줄, 줄 끝 한 칸은 직원 틈', pair=('ml-concession', 'ml-poster'),
       desc='영화관 매표 카운터 한 칸. 위에 투명 칸막이와 작은 좌석 화면(파란 칸 격자, 글자 없음), 감색 상판 윗면(탁상 물건을 올린다)과 붉은 띠 앞판. 좌우로 이어 붙인다.')
def _ticket(c):
    rc(c, 1, 2, 14, 13, kc('garasu', 2)); hl(c, 1, 2, 14, kc('garasu', 3)); vl(c, 1, 2, 13, kc('garasu', 3))   # 칸막이 유리
    for (x, y) in ((3, 4), (4, 5), (5, 6), (10, 3), (11, 4)): px(c, x, y, kc('shiro', 2))
    rc(c, 4, 8, 8, 6, kc('sumi', 0)); rc(c, 5, 9, 6, 4, kc('sora', 1))                         # 좌석 화면
    for x in (5, 7, 9): px(c, x, 10, kc('sora', 2)); px(c, x + 1, 11, kc('aka', 1))
    ol_in(c)
    rc(c, 0, 16, 16, 5, kc('kon', 1)); hl(c, 0, 16, 16, kc('kon', 2)); hl(c, 0, 20, 16, kc('kon', 2))      # 상판
    rc(c, 0, 21, 16, 8, kc('kon', -1)); hl(c, 0, 21, 16, kc('sumi', 0)); hl(c, 0, 23, 16, kc('aka', 0)); hl(c, 0, 24, 16, kc('aka', -1))
    rc(c, 0, 29, 16, 2, kc('tekko', -2)); hl(c, 0, 31, 16, OL)
    vl(c, 0, 16, 15, kc('kon', 2)); vl(c, 15, 16, 15, kc('sumi', 0))


@R.obj('ml-concession', '매점 뒤 설비(팝콘·음료)', w=2, h=1, up=32, kind='wall', use=('counter',),
       tags=TC + ('매점', '팝콘', '음료'), place='영화관 로비 북쪽 벽면 바로 아래 첫 바닥 줄 — 바로 앞 한 줄은 직원 자리, 그 앞에 매점 카운터(ml-concession-counter)',
       pair=('ml-concession-counter', 'ml-popcorn', 'ml-drink-cup'),
       desc='영화관 매점 뒤 설비 2×1 — 위에 빛나는 메뉴 상자(팝콘·음료·핫도그 색 그림, 글자 없음), 왼쪽 빨간 지붕 유리 팝콘 기계(노란 팝콘이 가득), 오른쪽 음료 디스펜서(색 레버 넷). 아래 흰 조리대.')
def _concession(c):
    rc(c, 0, 0, 32, 4, kc('conc', 1)); hl(c, 0, 0, 32, kc('conc', 0)); hl(c, 0, 4, 32, kc('shiro', 2))
    rc(c, 0, 5, 32, 9, kc('sumi', 0))                                                         # 메뉴 빛 상자 셋
    for i, (x0, r) in enumerate(((1, 'kii'), (11, 'aka'), (21, 'sora'))):
        rc(c, x0, 6, 9, 7, kc(r, 1)); hl(c, x0, 6, 9, kc(r, 2)); hl(c, x0, 12, 9, kc(r, 0))
    disc(c, 5, 9, 2.5, 2, kc('shiro', 2)); px(c, 4, 8, kc('kii', 2)); px(c, 6, 9, kc('kii', 1))                      # 팝콘 그림
    rc(c, 14, 8, 3, 4, kc('shiro', 2)); vl(c, 16, 6, 3, kc('aka', -1))                                                # 컵 그림
    rc(c, 23, 9, 6, 2, kc('daidai', 0)); hl(c, 24, 8, 4, kc('kii', 1))                                                # 핫도그 그림
    hl(c, 0, 14, 32, kc('tekko', -2))
    rc(c, 0, 15, 32, 13, kc('kon', -2))                                                       # 뒤 벽(짙게)
    # 팝콘 기계(왼쪽): 빨간 지붕 + 유리 상자 + 노란 팝콘
    rc(c, 2, 15, 13, 3, kc('aka', 0)); hl(c, 2, 15, 13, kc('aka', 1))
    rc(c, 2, 18, 13, 10, kc('garasu', 2)); vl(c, 2, 18, 10, kc('garasu', 3))
    for y in range(22, 28):
        for x in range(3, 14):
            if (x + y) % 3 != 0 or y > 24: px(c, x, y, kc('kii', 2) if (x * 3 + y) % 4 else kc('kinari', 2))
    px(c, 8, 19, kc('shiro', 2)); vl(c, 14, 18, 10, kc('tekko', 0))
    # 음료 디스펜서(오른쪽)
    rc(c, 17, 15, 13, 13, kc('conc', 1)); vl(c, 17, 15, 13, kc('conc', 3)); hl(c, 17, 15, 13, kc('conc', 2))
    for i, r in enumerate(('aka', 'sora', 'daidai', 'midori')):
        rc(c, 18 + i * 3, 17, 2, 4, kc(r, 1)); px(c, 18 + i * 3, 22, kc('tekko', -2))
    rc(c, 18, 24, 11, 3, kc('tekko', -1)); hl(c, 18, 24, 11, kc('tekko', 1))
    # 조리대(발밑 줄)
    rc(c, 0, 28, 32, 4, kc('shiro', 1)); hl(c, 0, 28, 32, kc('shiro', 0)); hl(c, 0, 31, 32, kc('shiro', 2))
    rc(c, 0, 32, 32, 13, kc('shiro', 0)); hl(c, 0, 32, 32, kc('conc', 0))
    for x0 in (2, 17): rc(c, x0, 34, 13, 9, kc('shiro', 1)); vl(c, x0 + 12, 34, 9, kc('conc', 0)); hl(c, x0 + 5, 36, 3, kc('tekko', -1))
    rc(c, 0, 45, 32, 2, kc('tekko', -2)); hl(c, 0, 47, 32, OL)
    vl(c, 0, 0, 48, OL); vl(c, 31, 0, 48, OL)


@R.obj('ml-concession-counter', '매점 카운터(과자 진열)', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',),
       tags=TC + ('매점', '카운터', '과자'), place='매점 뒤 설비(ml-concession) 앞 한 줄 띄우고 가로로 이어 붙임, 앞 손님 자리 두 줄, 줄 끝 한 칸은 직원 틈',
       pair=('ml-concession', 'ml-popcorn', 'ml-drink-cup'),
       desc='매점 카운터 한 칸 — 감색 상판 윗면(팝콘·음료 컵을 올린다) 아래 유리 진열장 안에 색색 과자 봉지. 좌우로 이어 붙인다.')
def _conc_counter(c):
    rc(c, 0, 0, 16, 5, kc('kon', 1)); hl(c, 0, 0, 16, kc('kon', 0)); hl(c, 0, 4, 16, kc('kon', 2))
    rc(c, 0, 5, 16, 8, kc('garasu', 1)); hl(c, 0, 5, 16, kc('garasu', 3))
    for i, x0 in enumerate((1, 5, 9, 12)):
        ramp, st = PROD[hs(i, 2, 61) % len(PROD)]
        rc(c, x0, 8, 3, 4, kc(ramp, st)); hl(c, x0, 8, 3, kc(ramp, st + 1))
    px(c, 2, 6, kc('shiro', 2)); px(c, 3, 7, kc('shiro', 2))
    rc(c, 0, 13, 16, 2, kc('kon', -2)); hl(c, 0, 15, 16, OL)
    vl(c, 0, 0, 15, kc('kon', 2)); vl(c, 15, 0, 15, kc('sumi', 0))


def _poster(c, scene):
    rc(c, 1, 1, 14, 28, kc('tekko', 1)); outline(c, 1, 1, 14, 28, kc('tekko', -2)); hl(c, 2, 2, 12, kc('mado', 2)); vl(c, 2, 2, 26, kc('mado', 1))   # 빛 상자 틀
    x0, y0, w, h = 3, 3, 10, 21
    if scene == 'mountain':     # 노을 산
        for y in range(h):
            col = (kc('daidai', 2), kc('daidai', 1), kc('pinku', 1), kc('murasaki', 0))[min(3, y // 4)]
            hl(c, x0, y0 + y, w, col)
        disc(c, x0 + 6, y0 + 8, 2, 2, kc('kii', 2))
        for x in range(w):
            top = y0 + 12 + abs(x - 4) // 1 - (2 if x in (3, 4, 5) else 0)
            vl(c, x0 + x, top, y0 + h - top, kc('kon', -1))
        px(c, x0 + 4, y0 + 12, kc('shiro', 2)); px(c, x0 + 3, y0 + 13, kc('shiro', 1))
    elif scene == 'space':      # 고리 행성
        rc(c, x0, y0, w, h, kc('kon', -2))
        for (sx, sy) in ((1, 2), (7, 1), (8, 15), (2, 17), (5, 19), (9, 9)): px(c, x0 + sx, y0 + sy, kc('shiro', 2))
        disc(c, x0 + 5, y0 + 10, 3.5, 3.5, kc('daidai', 0)); hl(c, x0 + 3, y0 + 8, 3, kc('daidai', 2))
        hl(c, x0, y0 + 11, w, kc('kii', 1)); px(c, x0 + 4, y0 + 11, kc('daidai', -1))
    else:                       # 바다 물결과 돛배
        for y in range(h):
            col = kc('sora', 2) if y < 9 else kc('sora', 0) if y < 15 else kc('sora', -1)
            hl(c, x0, y0 + y, w, col)
        for y in (11, 14, 17):
            for x in range(y % 3, w, 4): hl(c, x0 + x, y0 + y, 2, kc('shiro', 2))
        vl(c, x0 + 5, y0 + 3, 7, kc('ita', -1))
        for k in range(5): hl(c, x0 + 6, y0 + 4 + k, k // 2 + 1, kc('shiro', 2))
        hl(c, x0 + 3, y0 + 10, 5, kc('ita', 0))
    rc(c, 3, 24, 10, 3, kc('sumi', 0)); hl(c, 4, 25, 8, kc('mado', 0))                         # 아래 띠(글자 없음)


for _id, _ko, _scene, _what in (('ml-poster', '영화 포스터(노을 산)', 'mountain', '노을 하늘과 산 능선'),
                                ('ml-poster-b', '영화 포스터(우주)', 'space', '별과 고리 행성'),
                                ('ml-poster-c', '영화 포스터(바다)', 'sea', '파도와 돛배')):
    def _mkp(scene=_scene):
        return lambda c: _poster(c, scene)
    R.obj(_id, _ko, w=1, kind='hang', hrows=2, use=('read',), tags=TC + ('포스터', '로비'),
          place='영화관 로비·몰 영화관 입구 북쪽 벽면 윗줄 — 2~3장을 다른 그림으로 띄엄띄엄', pair=('ml-ticket-counter', 'ml-cinema-entrance'),
          desc='빛 상자에 든 영화 포스터 — %s(사람·글자 없음), 아래 어두운 띠. 벽면 윗줄에 건다.' % _what)(_mkp())


@R.obj('ml-screen', '상영관 스크린', w=8, kind='hang', hrows=2, use=('read',), tags=TC + ('스크린', '상영관'),
       place='상영관 북쪽 벽면 윗줄 가운데 — 8칸. 그 앞 한두 줄은 비우고 좌석 줄이 남쪽으로', pair=('ml-seat-row', 'ml-aisle-light'),
       desc='상영관 큰 스크린 8칸 — 검은 테 안에 영사된 밝은 화면(하늘·지평선 빛 띠, 사람·글자 없음)이 빛나고 테 바깥 벽으로 빛이 번진다. 양끝 붉은 막 자락.')
def _screen(c):
    W = 128
    for y in range(32):                                                                      # 빛 번짐(테 바깥, 두 단)
        for x in range(W):
            if 1 <= y <= 30 and 2 <= x <= W - 3: c.P(x, y, kc('kon', 0))
    rc(c, 4, 2, W - 8, 28, kc('kon', 1))
    rc(c, 6, 3, W - 12, 26, kc('sumi', -1))                                                  # 검은 테
    x0, y0, w, h = 8, 5, W - 16, 21
    for y in range(h):
        col = (kc('shiro', 2), kc('shiro', 1), kc('sora', 2), kc('sora', 2), kc('garasu', 3), kc('kinari', 2), kc('kinari', 1))[min(6, y // 3)]
        hl(c, x0, y0 + y, w, col)
    for x in range(w):                                                                       # 지평선 언덕(빛나는 화면 속, 낮은 대비)
        top = y0 + 13 + (2 if (x // 9) % 3 == 0 else 1 if (x // 9) % 3 == 1 else 0) + (1 if x % 9 in (0, 8) else 0)
        vl(c, x0 + x, top, y0 + h - top, kc('midori', 1) if top < y0 + 16 else kc('lino', 2))
    disc(c, x0 + 78, y0 + 7, 4, 4, kc('kinari', 2)); disc(c, x0 + 78, y0 + 7, 2.5, 2.5, kc('shiro', 2))
    for (sx, sy) in ((20, 3), (21, 3), (44, 5), (45, 5), (46, 5)): px(c, x0 + sx, y0 + sy, kc('shiro', 2))
    for k in range(2):                                                                       # 양끝 막 자락
        xx = 0 if k == 0 else W - 6
        rc(c, xx, 0, 6, 32, kc('aka', -1))
        for x in range(6): vl(c, xx + x, 0, 32 - (x if k == 0 else 5 - x) * 2, kc('aka', 0) if x % 2 else kc('aka', -1))
        vl(c, xx + (5 if k == 0 else 0), 0, 32, kc('aka', -2))
    hl(c, 0, 0, W, kc('aka', -2))


@R.obj('ml-seat-row', '극장 좌석', w=1, h=1, up=8, kind='floor', use=('sit',), facing='N',
       tags=TC + ('좌석', '상영관', '의자'), place='상영관 — 스크린을 보게(북향) 좌우로 이어 붙여 줄, 줄을 남쪽으로 빈틈 없이 5~6줄(뒤 줄이 앞 줄 등받이 위로 한 단씩 높아 보인다). 한 덩이 폭 4칸까지, 양옆·가운데 통로',
       pair=('ml-screen', 'ml-step', 'ml-aisle-light'),
       desc='붉은 극장 좌석 한 칸(스크린 쪽 북향, 뒤에서 본 모습) — 위로 좌판 방석 띠, 둥근 등받이 윗날과 오목한 등받이 뒷면, 양옆 검은 팔걸이. 좌우로 이어 붙여 줄을 만든다.')
def _seat(c):
    rc(c, 2, 0, 12, 3, kc('aka', 0)); hl(c, 2, 0, 12, kc('aka', 1)); hl(c, 2, 2, 12, kc('aka', -1))         # 좌판 방석(등받이 너머로 보임)
    rc(c, 1, 3, 14, 5, kc('aka', 0)); hl(c, 2, 3, 12, kc('aka', 2)); hl(c, 1, 4, 14, kc('aka', 1))           # 등받이 윗부분(천, 둥근 어깨)
    px(c, 1, 3, None); px(c, 14, 3, None); hl(c, 1, 7, 14, kc('aka', -1))
    rc(c, 1, 8, 14, 10, kc('yoru', 0)); vl(c, 1, 8, 10, kc('yoru', 2)); vl(c, 14, 8, 10, kc('yoru', -2))       # 등받이 뒷면(검은 껍데기, 오목)
    rc(c, 4, 10, 8, 5, kc('yoru', -1)); hl(c, 4, 10, 8, kc('yoru', -2)); hl(c, 4, 15, 8, kc('yoru', 1))
    vl(c, 0, 6, 12, kc('yoru', 1)); px(c, 0, 6, kc('tekko', 1)); vl(c, 15, 6, 12, kc('yoru', -1))           # 팔걸이(이웃과 합쳐 2px)
    rc(c, 3, 18, 10, 4, kc('yoru', -2)); hl(c, 3, 18, 10, kc('yoru', -1))                                   # 받침
    rc(c, 0, 22, 16, 2, kc('sumi', -1))
    hl(c, 2, 0, 12, OL); px(c, 1, 1, OL); px(c, 14, 1, OL)


@R.obj('ml-step', '상영관 단(계단 띠)', w=1, h=1, kind='flat', use=('walk',), tags=TC + ('상영관', '통로', '단'),
       place='상영관 통로 칸 — 좌석 줄마다 한 칸(줄의 단 높이를 보여 준다). 통로등(ml-aisle-light)과 번갈아',
       pair=('ml-aisle-light', 'ml-seat-row'),
       desc='상영관 통로의 단 띠(밟는 무늬) — 칸 윗변에 은색 논슬립 테와 그 아래 챌면 그늘 줄, 나머지는 카펫이 비친다. 좌석 줄 옆 통로 칸마다.')
def _step(c):
    hl(c, 0, 0, 16, kc('tekko', 1)); hl(c, 0, 1, 16, kc('tekko', -1))
    for x in range(1, 16, 3): px(c, x, 0, kc('tekko', 2))
    hl(c, 0, 2, 16, kc('aka', -2)); hl(c, 0, 3, 16, kc('pinku', -2))


@R.obj('ml-aisle-light', '통로 발밑 등', w=1, h=1, kind='flat', use=('light', 'walk'), tags=TC + ('상영관', '통로', '조명'),
       place='상영관 통로 칸 — 좌석 줄 옆 단 띠 대신 두세 줄마다, 어두운 곳의 길잡이', pair=('ml-step', 'ml-seat-row'),
       desc='상영관 통로 발밑 등(밟는 무늬) — 단 띠의 은색 테 바로 아래 양끝에 작은 호박색 등, 카펫으로 빛이 번진다. 통로 칸에.')
def _aisle_light(c):
    _step(c)
    for x0 in (1, 12):
        rc(c, x0, 3, 3, 2, kc('mado', 1)); hl(c, x0, 3, 3, kc('mado', 2))
        for (dx, dy) in ((0, 5), (1, 5), (2, 5), (1, 6), (-1, 4), (3, 4)): px(c, x0 + dx, dy, kc('aka', 0))
        px(c, x0 + 1, 6, kc('daidai', -1))


@R.obj('ml-ticket-gate', '검표대', w=1, h=1, up=16, kind='floor', use=('gate',),
       tags=TC + ('검표', '입구', '상영관'), place='로비에서 상영관으로 가는 길목 옆 — 통로(2칸)를 막지 않게 한쪽에', pair=('ml-ticket-counter',),
       desc='영화관 검표대 1×1 — 기울어진 윗판(빛나는 초록 스캐너 창)이 위에서 보이고, 감색 기둥 몸통에 붉은 띠, 둥근 받침. 상영관 입구 길목 옆에 하나.')
def _gate(c):
    rc(c, 2, 6, 12, 7, kc('conc', 2)); hl(c, 2, 6, 12, kc('conc', 1)); hl(c, 2, 12, 12, kc('shiro', 2))     # 기운 윗판(위에서 보임)
    rc(c, 5, 8, 6, 3, kc('sumi', 0)); hl(c, 6, 9, 4, kc('midori', 2)); px(c, 6, 8, kc('midori', 1))
    rc(c, 2, 13, 12, 2, kc('kon', 0)); hl(c, 2, 14, 12, kc('kon', -2))
    rc(c, 5, 15, 6, 12, kc('kon', 0)); vl(c, 5, 15, 12, kc('kon', 2)); vl(c, 10, 15, 12, kc('kon', -2))
    hl(c, 5, 18, 6, kc('aka', 0)); hl(c, 5, 19, 6, kc('aka', -1))
    disc(c, 8, 28, 6, 2, kc('tekko', 0)); hl(c, 4, 27, 8, kc('tekko', 2))
    ol_in(c)


@R.obj('ml-cinema-entrance', '영화관 입구(열린 통로)', w=2, kind='hang', hrows=2, use=('travel',), tags=TC + TM + ('입구', '통로'),
       place='몰 위층 북쪽 벽면 윗줄 — 바로 앞 두 칸이 영화관 맵으로 가는 칸(links). 양옆에 포스터',
       pair=('ml-poster', 'ml-mall-passage'),
       desc='몰에서 영화관으로 들어가는 2칸 폭 열린 통로. 위에 전구가 줄지어 켜진 차양 띠, 문틀 너머로 붉은 카펫이 어두운 로비 안쪽으로 이어지고 양옆에 붉은 막. 문짝 없음.')
def _cin_entrance(c):
    rc(c, 0, 0, 32, 6, kc('sumi', 0)); hl(c, 0, 5, 32, kc('tekko', -1))
    for x in range(2, 31, 3): px(c, x, 2, kc('mado', 2)); px(c, x, 3, kc('mado', 0))           # 전구 줄
    rc(c, 3, 6, 26, 26, kc('kon', -2))                                                       # 안쪽 어둠
    for y in range(14, 32):                                                                  # 안쪽으로 이어지는 붉은 카펫(멀수록 좁다)
        inset = max(0, (31 - y) // 3)
        hl(c, 7 + inset, y, 18 - 2 * inset, kc('aka', -1) if y % 4 else kc('aka', -2))
    for x in range(10, 22, 4): px(c, x, 10, kc('mado', 0))                                   # 안쪽 벽등
    for k in range(2):                                                                       # 붉은 막
        xx = 3 if k == 0 else 25
        for x in range(4): vl(c, xx + x, 6, 26, kc('aka', 0) if x % 2 == k else kc('aka', -1))
    vl(c, 0, 0, 32, kc('conc', 2)); vl(c, 1, 0, 32, kc('conc', 1)); vl(c, 2, 0, 32, kc('tekko', -1))
    vl(c, 31, 0, 32, kc('tekko', -2)); vl(c, 30, 0, 32, kc('conc', 0)); vl(c, 29, 0, 32, kc('tekko', -1))


@R.obj('ml-mall-passage', '몰로 나가는 통로', w=2, kind='hang', hrows=2, use=('travel',), tags=TC + TM + ('출구', '통로'),
       place='영화관 로비 북쪽 벽면 윗줄 — 바로 앞 두 칸이 몰 위층으로 돌아가는 칸(links)', pair=('ml-cinema-entrance',),
       desc='영화관 로비에서 몰로 나가는 2칸 폭 열린 통로. 은색 문틀 너머로 밝은 몰 통로(흰 타일·벽 패널·화분 초록)가 보이고 위에 초록 비상구 빛 띠(글자 없음). 문짝 없음.')
def _mall_passage(c):
    rc(c, 0, 0, 32, 32, kc('conc', 1)); vl(c, 0, 0, 32, kc('conc', 3)); vl(c, 31, 0, 32, kc('conc', -2))
    hl(c, 0, 0, 32, kc('tekko', -1)); rc(c, 3, 1, 26, 3, kc('midori', 1)); hl(c, 4, 2, 6, kc('midori', 2))
    rc(c, 3, 5, 26, 27, kc('shiro', 1))                                                      # 밝은 몰
    hl(c, 3, 5, 26, kc('conc', 2)); rc(c, 3, 6, 26, 10, kc('shiro', 2))
    for x in range(3, 29, 8): vl(c, x, 6, 10, kc('conc', 2))
    for y in range(17, 32):
        hl(c, 3, y, 26, kc('kinari', 2) if (y // 4) % 2 else kc('shiro', 1))
    disc(c, 23, 12, 3, 3, kc('ki', 1)); rc(c, 21, 15, 5, 3, kc('shiro', 0))
    vl(c, 3, 5, 27, kc('tekko', 0)); vl(c, 28, 5, 27, kc('tekko', -1)); hl(c, 3, 5, 26, kc('tekko', -1))


# ═════════════════════════ 탁상 물건 ═════════════════════════
@R.good('ml-popcorn', '팝콘', desc='빨강·흰 줄무늬 팝콘 통에 노란 팝콘이 소복이.')
def _g_popcorn(c):
    for y in range(6, 14):
        w = 6 + (y - 6) // 3
        x0 = 8 - w // 2 - (0 if y < 9 else 0)
        for x in range(x0, x0 + 8 - (y - 6) // 3):
            px(c, x, y, kc('aka', 0) if (x // 2) % 2 else kc('shiro', 2))
    for (x, y) in ((5, 4), (6, 3), (7, 4), (8, 3), (9, 4), (10, 4), (6, 5), (8, 5), (9, 2), (7, 2), (10, 5), (5, 5)):
        px(c, x, y, kc('kii', 2) if (x + y) % 2 else kc('kinari', 2))
    ol_in(c)


@R.good('ml-drink-cup', '음료 컵', desc='뚜껑과 빨대가 꽂힌 큰 종이컵 두 개(빨강·파랑 띠).')
def _g_drink(c):
    for x0, r in ((2, 'aka'), (9, 'sora')):
        rc(c, x0, 6, 5, 8, kc('shiro', 2)); rc(c, x0, 9, 5, 2, kc(r, 0)); hl(c, x0 - 0, 5, 5, kc('conc', 1)); vl(c, x0 + 4, 6, 8, kc('shiro', 0))
        vl(c, x0 + 3, 2, 3, kc(r, 1))
    ol_in(c)


@R.good('ml-shopping-bag', '쇼핑백', desc='손잡이가 달린 종이 쇼핑백 두 개(분홍·감색, 글자 없음).')
def _g_bag(c):
    for x0, r, h in ((2, 'pinku', 9), (8, 'kon', 8)):
        y0 = 14 - h
        rc(c, x0, y0, 6, h, kc(r, 1 if r == 'pinku' else 2)); vl(c, x0 + 5, y0, h, kc(r, 0 if r == 'pinku' else 1)); hl(c, x0, y0, 6, kc(r, 2))
        hl(c, x0 + 1, y0 - 3, 4, kc('kinari', 0)); px(c, x0 + 1, y0 - 2, kc('kinari', 0)); px(c, x0 + 4, y0 - 2, kc('kinari', 0)); px(c, x0 + 1, y0 - 1, kc('kinari', 0)); px(c, x0 + 4, y0 - 1, kc('kinari', 0))
    ol_in(c)


@R.good('ml-tray', '푸드코트 쟁반', desc='주황 쟁반 위에 그릇 하나와 컵 하나.')
def _g_tray(c):
    rc(c, 1, 6, 14, 7, kc('daidai', 0)); hl(c, 1, 6, 14, kc('daidai', 1)); hl(c, 1, 12, 14, kc('daidai', -1))
    disc(c, 6, 9, 3.5, 2, kc('shiro', 2)); hl(c, 4, 9, 4, kc('kii', 1))
    rc(c, 11, 5, 3, 5, kc('shiro', 1)); hl(c, 11, 5, 3, kc('sora', 1))
    ol_in(c)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

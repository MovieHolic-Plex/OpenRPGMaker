#!/usr/bin/env python3
"""jp_city 일본 실내 — 숙박(비즈니스 호텔·료칸·노천탕). id 머리 `ht-`.
  python3 scripts/content/jp-city/blocks/interior_hotel.py     # selftest + tiledata/jp-city/blocks/interior_hotel/_all-x3.png

RPG 의 「여관」 — 쉬는 곳. 비즈니스 호텔(로비 프런트·엘리베이터·좁은 싱글 객실)과 료칸(현관 큰 단·나무 접수대·다다미 객실·
남탕/여탕 노렌·노천탕). 화실 가구(다다미·후스마·좌의자·방석·도코노마)와 엘리베이터 버튼·자판기·씻는 자리·안마 의자는 기존 id 를 쓴다.

칸 16px = 1m, 3/4 시점(수평 면 윗면 + 남쪽 앞면), 왼위 빛, 윤곽 sumi 또는 재질 어두운 단, 팔레트 modern3 램프만.
글자·숫자·상표·로고·사람 없음(객실 번호판·노렌·프런트 안내는 색 점·띠로만).
캔버스 규약(ikit): floor/wall 은 주기 캔버스, obj = w*16 × (ceil(up/16) + h)*16, hang = w*16 × hrows*16, door = 16×32, table = fn(c, w, h).
분류는 interior/categories.py(hotel·ryokan).

실제 크기(§12-3, 1칸 = 1m) — 표에 없는 것은 같은 공식(F = 높이×16, T = 깊이×16×압축):
  ht-front        프런트 카운터 1.0m 폭 단위 × 0.6 × 1.05 → 앞면 F 9(+받침 2) · 윗면 T 5 — 이어 붙이는 1×1 이라 판매대(2x2)보다 낮게 눌렀다(of-reception·pb-reception 과 같은 1칸 높이).
  ht-lobby-sofa   1.6 × 0.8 × 0.8 옆모습 1×2 · 등받이 띠가 북쪽으로 10px 솟는다.
  ht-elevator     문 1.2m 폭 × 2.0m(20×32px) + 둘레 틀 → 2×1 발자국, 위로 32px(벽면 두 줄을 덮는다). 윗면 T 5.
  ht-single-bed   1.0 × 2.0 × 0.5 → 1×2, 머리판 1.1m 이 벽면으로 16px 솟는다(bed_single 행).
  ht-desk-tv      1.4 × 0.5 × 0.72 책상 → 2×1, 윗면 T 6, 앞면 F 9 · 벽걸이 TV 는 벽면 아랫줄에 솟는다.
  ht-ice-machine  0.6 × 0.6 × 1.7 → 1×2 캔버스, T 4 · F 27(키 큰 벽 가구 규칙: T 4~6 + 앞 가장자리 하이라이트 + 처마 그림자 2px).
  ht-slipper-rack 0.8 × 0.35 × 1.0 → 1×2 캔버스, T 4 · F 16 + 받침.
  ht-stone-lantern 0.7 × 0.7 × 1.6 → 1×2 캔버스(가사 윗면 4px).
  ht-bamboo-fence 허리 높이 1.2m(F 20) · 윗갓 T 3 — 가로로 이어 붙는다(앞 통로를 덮지 않게 8px 만 솟는다).
  ht-tea-set-table 1.5 × 0.9 × 0.35 → 2×1, T 9 · F 4(좌탁 zataku 와 같은 틀).
  ht-engawa-chairs 의자 0.6 × 0.6 × 0.8 둘 + 탁자 0.5 → 2×1, 등받이가 8px 솟는다.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402

BLOCK = 'interior_hotel'
R = Registry(BLOCK, '숙박')

HOTEL = ('비즈니스 호텔', '호텔', 'ホテル', 'ビジネスホテル', '여관', '숙박')
RYOKAN = ('료칸', '旅館', '여관', '숙박', '온천')
ONSEN = ('온천', '노천탕', '露天風呂', '温泉', '료칸')


# ── 도우미 ────────────────────────────────────────────────────────────────────
def hs(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per): return hs(x, y, s) % 1000 < per


def px(c, x, y, col):
    x, y = int(x), int(y)
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


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


def box3(c, x, y, w, t, f, top, front, hi, ol=OL, lip=None):
    """윗면 t 줄 + 앞면 f 줄 상자. 윗면 왼쪽·위에 밝은 1px(hi), 앞 가장자리 lip, 앞면 front. 외곽선 ol."""
    rc(c, x, y, w, t + f, ol)
    rc(c, x + 1, y + 1, w - 2, t - 1, top)
    hl(c, x + 1, y + 1, w - 2, hi); vl(c, x + 1, y + 1, t - 1, hi)
    hl(c, x + 1, y + t - 1, w - 2, lip if lip is not None else hi)
    rc(c, x + 1, y + t, w - 2, f - 1, front)


IT = lambda t: K('ita', t)        # 짙은 나무(문·틀)
YK = lambda t: K('yuka', t)       # 밝은 나무(마루·삼나무)
MD = lambda t: K('mado', t)       # 꿀빛 나무·놋쇠·등불
KN = lambda t: K('kinari', t)
SH = lambda t: K('shiro', t)
TK = lambda t: K('tekko', t)
HD = lambda t: K('hodo', t)       # 화강암·젖은 돌
KW = lambda t: K('kawara', t)     # 옻칠 붉은 갈색·로비 가죽


# ══ 바닥 ═════════════════════════════════════════════════════════════════════
@R.floor('ht-lobby-floor', '호텔 로비 석재', cols=4, rows=4, tags=HOTEL + ('로비', '프런트'),
         desc='연한 베이지 대리석 판(2×2칸 = 2m 판). 판마다 옅은 얼룩이 몇 점, 줄눈은 가늘고 판 윗·왼 모서리가 밝다. 비즈니스 호텔 1층 로비·프런트 앞·엘리베이터 홀.')
def _lobby_floor(c):
    base, vein, joint, hi = KN(1), KN(0), KN(-1), KN(2)
    for y in range(64):
        for x in range(64):
            lx, ly = x % 32, y % 32
            col = base
            if lx == 0 or ly == 0: col = joint
            elif (lx == 1 and ly < 30) or (ly == 1 and lx < 30): col = hi          # 판 윗·왼 모서리 광택
            elif lx == 31 or ly == 31: col = vein                                   # 판 아래·오른 모서리 한 단 어둡게
            c.P(x, y, col)
    for ty in range(2):                                                             # 대리석 결: 판마다 옅은 얼룩 구름 몇 점(금처럼 보이는 선은 쓰지 않는다)
        for tx in range(2):
            for k in range(3):
                cx = tx * 32 + 6 + hs(tx, ty, 10 + k) % 20; cy = ty * 32 + 6 + hs(tx, ty, 20 + k) % 20
                tone = KN(2) if (k + tx + ty) % 2 else vein
                for (dx, dy) in ((0, 0), (1, 0), (2, 1), (-1, 1), (0, 1), (1, 1), (3, 1), (1, 2)):
                    if (dx + dy + k) % 3: c.P(cx + dx, cy + dy, tone)


@R.floor('ht-corridor-carpet', '호텔 복도 카펫', cols=2, rows=2, tags=HOTEL + ('복도',),
         desc='짙은 팥색 바탕에 마름모 격자와 가운데 작은 꽃점이 되풀이되는 호텔 복도 카펫. 객실 층 복도·엘리베이터 홀.')
def _corridor_carpet(c):
    for y in range(32):
        for x in range(32):
            col = K('renga', -1)
            if (x + y) % 16 == 0 or (x - y) % 16 == 0: col = K('renga', -2)           # 마름모 격자
            dx, dy = abs((x % 16) - 8), abs((y % 16) - 8)
            if dx + dy <= 2: col = K('renga', 0)                                     # 칸 가운데 작은 마름모
            if dx + dy == 0: col = K('renga', 1)
            if (dx, dy) in ((4, 0), (0, 4)): col = K('renga', 0)                     # 네 잎 점
            c.P(x, y, col)


@R.floor('ht-room-carpet', '객실 카펫', cols=2, rows=2, tags=HOTEL + ('객실',),
         desc='털 짧은 연갈색 고리 카펫 — 결 점만 있는 조용한 바닥. 비즈니스 호텔 싱글·더블 객실.')
def _room_carpet(c):
    for y in range(32):
        for x in range(32):
            col = K('soil', 1)
            if x % 4 == 1 and y % 4 == 1: col = K('soil', 2)
            elif x % 4 == 3 and y % 4 == 3: col = K('soil', 0)
            elif rnd(x, y, 71, 30): col = K('soil', 0)
            c.P(x, y, col)


def _ryokan_wood(c):
    """반들반들한 료칸 복도 마루: 널 폭 8px(칸에 두 장), 128px 주기, 칸 줄마다 밀려 깔린다(rowShift).
    이음새는 칸 안 두 널 줄끼리 10px 이상, 칸 줄 경계(아래 널 ↔ 다음 칸 위 널)에서는 x%16 이 3 이상 어긋난다(9·11 ↔ 14·0).
    광택은 널 윗부분의 짧은 밝은 줄(긴 띠는 넓은 바닥에서 줄무늬가 된다)."""
    W = c.w
    seams = ((9, 75), (46, 112))
    for y in range(16):
        r, yy = y // 8, y % 8
        a, b = seams[r]
        for x in range(W):
            bid = 0 if a <= x < b else 1
            s0 = a if bid == 0 else b
            pos = (x - s0) % W
            col = IT(0)
            if yy == 7: col = IT(-2)                                              # 널 사이 홈
            elif yy == 6: col = IT(-1)                                            # 홈 위 그늘
            elif yy == 0: col = IT(1) if 3 <= pos else IT(0)                      # 널 윗 모서리
            elif yy in (2, 4) and rnd(x // 5, r * 2 + bid, 81, 140): col = IT(-1)  # 성긴 나뭇결
            if yy == 1 and hs(r, bid, 83) % 2 == 0:                               # 광택: 널 둘 중 하나에 짧은 줄 하나
                st = 6 + hs(r, bid, 84) % 30; ln = 6 + hs(r, bid, 85) % 6
                if st <= pos < st + ln: col = IT(2)
            if yy == 3 and hs(r, bid, 86) % 3 == 0:
                st = 30 + hs(r, bid, 87) % 20; ln = 4 + hs(r, bid, 88) % 4
                if st <= pos < st + ln: col = IT(1)
            if x == a or x == b: col = IT(-2)                                     # 머리 맞댐 이음새
            c.P(x, y, col)


@R.floor('ht-ryokan-wood', '료칸 복도 마루', cols=8, rows=1, tags=RYOKAN + ('복도', '현관'), lay='rowShift',
         desc='반들반들 닦인 짙은 나무 널 마루(폭 넓은 널 두 장이 한 칸). 널 윗부분에 짧은 광택 줄. 료칸 현관 마루·복도·접수 앞.')
def _rw(c): _ryokan_wood(c)


@R.floor('ht-onsen-stone', '온천 돌 바닥', cols=4, rows=4, tags=ONSEN + ('탈의실',),
         desc='크기가 다른 둥근 화강암 판석을 짜 맞춘 젖은 돌 바닥. 줄눈은 짙고 돌마다 왼위가 밝다. 노천탕 마당.')
def _onsen_stone(c):
    N = 5; S = 64 / N
    pts = []
    for gy in range(N):
        for gx in range(N):
            jx = (hs(gx, gy, 91) % 9) - 4; jy = (hs(gx, gy, 92) % 9) - 4
            pts.append(((gx + .5) * S + jx, (gy + .5) * S + jy, hs(gx, gy, 93) % 3))

    def near(x, y):
        best = []
        for (px_, py_, t) in pts:
            dx = min(abs(x - px_), 64 - abs(x - px_)); dy = min(abs(y - py_), 64 - abs(y - py_))
            best.append((dx * dx + dy * dy, t, (px_, py_)))
        best.sort()
        return best[0], best[1]

    owner = {}
    for y in range(64):
        for x in range(64):
            (d1, t1, p1), (d2, _, _) = near(x + .5, y + .5)
            owner[(x, y)] = (p1, t1, d2 ** .5 - d1 ** .5)
    tones = ((HD(0), HD(1), HD(-1)), (HD(1), HD(2), HD(0)), (HD(-1), HD(0), HD(-2)))
    for y in range(64):
        for x in range(64):
            p1, t1, gap = owner[(x, y)]
            body, lit, dark = tones[t1]
            if gap < 1.3: col = HD(-3)                                             # 줄눈
            else:
                up = owner[(x, (y - 1) % 64)]; lf = owner[((x - 1) % 64, y)]
                dn = owner[(x, (y + 1) % 64)]; rt = owner[((x + 1) % 64, y)]
                if up[0] != p1 or lf[0] != p1 or up[2] < 1.3 or lf[2] < 1.3: col = lit        # 돌 윗·왼 모서리 밝게
                elif dn[0] != p1 or rt[0] != p1 or dn[2] < 1.3 or rt[2] < 1.3: col = dark      # 아래·오른 모서리 어둡게
                else:
                    col = body
                    if rnd(x, y, 95, 45): col = dark                               # 돌 결
            c.P(x, y, col)


# ══ 벽면(2줄 = 32px) ══════════════════════════════════════════════════════════
def _wall_tone(x, y, up, low, split=16, band=3):
    if y < split - band: return up
    if y >= split + band: return low
    return up if ((x + y) % 2 == 0) == (y < split) else low


@R.wall('ht-hotel-wall', '호텔 벽면(베이지 벽지)', cols=4, tags=HOTEL,
        desc='연한 베이지 비닐 벽지에 가는 세로 줄무늬, 아래 짙은 나무 걸레받이. 비즈니스 호텔 로비·복도·객실 공용 벽.')
def _hotel_wall(c):
    up, low = KN(1), KN(0)
    for y in range(32):
        for x in range(c.w):
            col = _wall_tone(x, y, up, low)
            if x % 8 == 3 and y < 26: col = KN(0) if col == up else KN(-1)           # 가는 세로 줄무늬
            elif x % 8 == 4 and y < 26 and col == up: col = KN(2) if y % 3 else up    # 줄무늬 옆 광택 점선
            c.P(x, y, col)
    hl(c, 0, 26, c.w, KN(-1))                                                       # 걸레받이 위 그림자
    hl(c, 0, 27, c.w, IT(1)); rc(c, 0, 28, c.w, 3, IT(-1)); hl(c, 0, 31, c.w, IT(-3))


@R.wall('ht-ryokan-wall', '료칸 벽면(흙벽·나무 기둥)', cols=4, tags=RYOKAN,
        desc='모래 섞인 황토빛 흙벽에 짙은 나무 기둥(4칸에 하나), 아래 나무 허리판(腰板). 료칸 현관·접수·복도 벽.')
def _ryokan_wall(c):
    up, low = K('soil', 2), K('soil', 1)
    for y in range(32):
        for x in range(c.w):
            col = _wall_tone(x, y, up, low)
            n = hs(x, y, 101) % 100
            if n < 6: col = KN(0) if col == up else K('soil', 2)                    # 밝은 모래알
            elif n < 11: col = K('soil', 1) if col == up else K('soil', 0)          # 어두운 알
            c.P(x, y, col)
    # 허리판(腰板): 세로 널 8px, 위 갓 1px 밝게
    hl(c, 0, 21, c.w, K('soil', 0))
    hl(c, 0, 22, c.w, IT(2)); hl(c, 0, 23, c.w, IT(0))
    for y in range(24, 31):
        for x in range(c.w):
            col = IT(-1)
            if x % 8 == 0: col = IT(-3)
            elif x % 8 == 1: col = IT(0)
            elif y == 24: col = IT(-2)
            c.P(x, y, col)
    hl(c, 0, 31, c.w, IT(-3))
    # 기둥(柱) 폭 4px — 왼쪽 밝고 오른쪽 어둡다, 오른쪽에 그림자 1px
    p = 40
    for y in range(32):
        c.P(p, y, IT(1)); c.P(p + 1, y, IT(0)); c.P(p + 2, y, IT(-1)); c.P(p + 3, y, IT(-2))
        c.P(p + 4, y, K('soil', 0) if y < 21 else IT(-3))
        if y % 9 == 4: c.P(p + 1, y, IT(-1))


@R.wall('ht-onsen-wall', '온천 나무 판 벽', cols=4, tags=ONSEN + ('탈의실',),
        desc='삼나무 널을 세로로 대고 이음매마다 좁은 덧널(目板)을 친 판벽, 아래 화강암 굽돌. 탈의실·노천탕 둘레 벽.')
def _onsen_wall(c):
    for y in range(32):
        for x in range(c.w):
            lx = x % 8
            col = _wall_tone(x, y, YK(1), YK(0))
            if lx == 0: col = YK(-2)                                                # 덧널 그늘
            elif lx == 1: col = YK(2) if y < 16 else YK(1)                         # 덧널 밝은 면
            elif lx == 2: col = YK(0)
            elif (x // 8) % 2 == 1 and col == YK(1) and rnd(x, y // 3, 111, 160): col = YK(0)   # 널 결
            elif (x // 8) % 2 == 0 and rnd(x, y // 4, 112, 90): col = YK(0)
            c.P(x, y, col)
    hl(c, 0, 26, c.w, YK(-2))
    rc(c, 0, 27, c.w, 5, HD(0)); hl(c, 0, 27, c.w, HD(2)); hl(c, 0, 31, c.w, HD(-2))
    for x in range(0, c.w, 16): vl(c, x + 5, 28, 3, HD(-2))                       # 굽돌 이음


# ══ 비즈니스 호텔 ════════════════════════════════════════════════════════════
@R.obj('ht-front', '호텔 프런트 카운터', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=HOTEL + ('프런트', '접수', 'フロント'),
       place='로비 한쪽에 가로로 이어 붙인다(3칸쯤). 직원은 북쪽, 손님은 남쪽 두 줄. 줄 한쪽 끝 한 칸은 직원이 드나드는 틈.',
       pair=('ht-bell', 'ht-card-key'),
       desc='연회색 돌 상판에 꿀빛 나무 세로 루버 앞판, 짙은 걸레받이의 프런트 카운터 한 칸. 이음 없이 가로로 이어 붙고 윗면에 호출 종·카드 키를 놓는다.')
def _front(c):
    hl(c, 0, 0, 16, OL)
    rc(c, 0, 1, 16, 5, K('conc', 2)); hl(c, 0, 1, 16, K('conc', 3))
    for x, y in ((3, 3), (11, 2), (7, 4)): px(c, x, y, K('conc', 1))                  # 돌 결 점
    hl(c, 0, 5, 16, K('conc', 3))                                                   # 앞 가장자리 하이라이트
    hl(c, 0, 6, 16, IT(-3))                                                         # 상판 밑 그림자
    rc(c, 0, 7, 16, 6, MD(-1)); hl(c, 0, 7, 16, IT(-2))
    for x in range(0, 16, 4):                                                       # 세로 루버
        vl(c, x, 8, 5, IT(-1)); vl(c, x + 1, 8, 5, MD(0)); vl(c, x + 2, 8, 5, MD(-1))
    rc(c, 0, 13, 16, 2, IT(-2)); hl(c, 0, 13, 16, IT(-1))
    hl(c, 0, 15, 16, OL)


def _lobby_sofa(c, east):
    """1×2 옆모습 소파(가죽 단추 박음). east = 동쪽을 봄(등받이 서쪽)."""
    M = KW
    bx0, bw = (1, 5) if east else (10, 5)                                           # 등받이 세로 띠
    sx0, sw = (5, 10) if east else (1, 10)                                          # 좌석
    rc(c, sx0, 18, sw, 28, OL)
    rc(c, sx0 + 1, 22, sw - 2, 18, M(1)); hl(c, sx0 + 1, 22, sw - 2, M(2))          # 좌석 윗면(길게)
    hl(c, sx0 + 1, 31, sw - 2, M(-1)); hl(c, sx0 + 1, 32, sw - 2, M(2))              # 쿠션 이음
    rc(c, sx0 + 1, 19, sw - 2, 4, M(0)); hl(c, sx0 + 1, 19, sw - 2, M(2)); hl(c, sx0 + 1, 22, sw - 2, M(-2))   # 북쪽 팔걸이
    rc(c, sx0 + 1, 38, sw - 2, 5, M(0)); hl(c, sx0 + 1, 38, sw - 2, M(3)); hl(c, sx0 + 1, 39, sw - 2, M(2)); hl(c, sx0 + 1, 42, sw - 2, M(-2))   # 남쪽 팔걸이(앞)
    rc(c, sx0 + 1, 43, sw - 2, 2, M(-1)); hl(c, sx0 + 1, 44, sw - 2, M(-2))           # 앞면
    rc(c, bx0, 10, bw, 36, OL)
    rc(c, bx0 + 1, 11, bw - 2, 34, M(0)); rc(c, bx0 + 1, 11, bw - 2, 3, M(2)); hl(c, bx0 + 1, 11, bw - 2, M(3))
    vl(c, bx0 + 1, 14, 31, M(1)); vl(c, bx0 + bw - 2, 14, 31, M(-2))
    for y in (19, 27, 35): px(c, bx0 + 2, y, M(-3)); px(c, bx0 + 2, y + 1, M(2))      # 단추
    vl(c, sx0 + 1 if east else sx0 + sw - 2, 23, 15, M(-2))                         # 등받이와 맞닿는 그늘
    for x in ((sx0 + 1, sx0 + sw - 3) if east else (sx0 + 1, sx0 + sw - 3)):
        rc(c, x, 45, 2, 2, IT(-2))                                                  # 나무 다리


for _e, _d in ((True, 'e'), (False, 'w')):
    def _reg_sofa(east=_e, d=_d):
        @R.obj('ht-lobby-sofa-' + d, '로비 소파(%s향)' % ('동' if east else '서'), w=1, h=2, up=16, kind='floor', use=('sit',), facing=d.upper(),
               tags=HOTEL + ('로비', '소파'), place='로비 한쪽, 낮은 탁자(ht-lobby-table)를 사이에 두고 동향·서향 둘이 마주 본다', pair=('ht-lobby-table',),
               desc='붉은 갈색 가죽 2인 소파 옆모습(1×2). %s쪽을 보고 앉는다 — 단추 박은 등받이 세로 띠가 %s쪽, 좌석 윗면이 길게 보인다.' % ('동' if east else '서', '서' if east else '동'))
        def _f(c): _lobby_sofa(c, east)
    _reg_sofa()


@R.table('ht-lobby-table', '로비 낮은 탁자', desc='짙은 호두나무 낮은 탁자 — 상판 테가 밝고 짧은 다리. 로비 소파 사이. 어떤 w×h 로도 이어 붙는다.',
         tags=HOTEL + ('로비',))
def _lobby_table(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 1, W, H - 2, OL)
    rc(c, 1, 2, W - 2, H - 7, IT(0))
    hl(c, 1, 2, W - 2, IT(2)); vl(c, 1, 2, H - 7, IT(2))
    for yy in range(5, H - 6, 6):                                                   # 나뭇결(16 주기)
        for xx in range(0, W, 16): hl(c, xx + (3 if (yy // 6) % 2 else 9), yy, 5, IT(1))
    hl(c, 1, H - 6, W - 2, IT(3))                                                   # 앞 가장자리
    rc(c, 1, H - 5, W - 2, 2, IT(-2)); hl(c, 1, H - 4, W - 2, IT(-3))
    for x in (2, W - 5): rc(c, x, H - 3, 3, 2, IT(-1)); px(c, x, H - 3, IT(1))
    hl(c, 2, H - 1, 3, OL); hl(c, W - 5, H - 1, 3, OL)


@R.obj('ht-elevator', '호텔 엘리베이터', w=2, h=1, up=32, kind='wall', use=('travel',), tags=HOTEL + ('엘리베이터', 'エレベーター'),
       place='로비·객실 층 엘리베이터 홀 북쪽 벽 바로 아래. 두 대면 사이에 호출 버튼(of-elevator-button)을 건다. 문 앞 칸(남쪽 한 칸)에 층 이동(links)을 단다.',
       pair=('of-elevator-button',),
       desc='짙은 호두나무 문틀에 샴페인 금빛 두 짝 문이 닫힌 호텔 엘리베이터. 위 어두운 띠에 층 표시 등(호박색 점, 숫자 없음), 아래 은빛 문턱. 발밑 칸은 막히고 바로 앞 칸이 타는 자리.')
def _elevator(c):
    rc(c, 0, 0, 32, 48, OL)
    rc(c, 1, 1, 30, 4, IT(1)); hl(c, 1, 1, 30, IT(2)); hl(c, 1, 4, 30, IT(3))      # 윗면 T5 + 앞 가장자리
    hl(c, 1, 5, 30, IT(-3)); hl(c, 1, 6, 30, IT(-2))                                # 처마 그림자 2px
    rc(c, 1, 7, 30, 40, IT(-1))
    for x0 in (1, 26):                                                              # 좌우 기둥(앞으로 나온 틀)
        rc(c, x0, 7, 5, 40, IT(0)); vl(c, x0, 7, 40, IT(2)); vl(c, x0 + 4, 7, 40, IT(-2))
        hl(c, x0, 7, 5, IT(1))
    rc(c, 9, 8, 14, 4, K('yoru', -2)); outline(c, 8, 7, 16, 6, IT(-3))             # 층 표시 띠
    for i, x in enumerate(range(10, 22, 2)): px(c, x, 9, MD(2) if i == 3 else K('yoru', 0))
    px(c, 16, 10, MD(1))
    rc(c, 6, 13, 20, 32, IT(-3))                                                    # 문 홈(들어간 면)
    for x0 in (7, 16):                                                              # 문 두 짝
        rc(c, x0, 14, 9, 30, MD(0))
        vl(c, x0, 14, 30, MD(2) if x0 == 7 else MD(1)); vl(c, x0 + 8, 14, 30, MD(-1))
        hl(c, x0, 14, 9, MD(2))
        for y in range(18, 42, 6): hl(c, x0 + 2, y, 5, MD(1))                        # 결
        for i in range(5): px(c, x0 + 2 + i, 32 - i * 2, KN(2))                      # 사선 반사
    vl(c, 15, 14, 30, IT(-3)); vl(c, 16, 14, 30, MD(2))                             # 가운데 이음
    rc(c, 6, 44, 20, 3, TK(2)); hl(c, 6, 44, 20, TK(3)); hl(c, 6, 46, 20, TK(-1))     # 문턱
    hl(c, 0, 47, 32, OL)


@R.obj('ht-room-door', '객실 문(열림)', kind='door', use=('travel',), tags=HOTEL + ('객실', '문'),
       place='복도와 객실 사이 가로 칸막이 1칸 틈 칸',
       desc='크림색 문틀 위에 놋쇠 번호판(글자 없이 색 점 하나), 안쪽으로 젖혀진 짙은 호두나무 문짝(카드 키 자물쇠·도어 클로저 팔), 은빛 문턱.')
def _room_door(c):
    for x0, hi_, mid, lo in ((0, KN(2), KN(1), KN(-1)), (12, KN(2), KN(1), KN(-1))):  # 좌우 문틀 4px
        rc(c, x0, 0, 4, 32, mid); vl(c, x0 + 1, 0, 32, hi_); vl(c, x0 + 3, 0, 32, lo)
    vl(c, 0, 0, 32, KN(-2)); vl(c, 15, 0, 32, KN(-2))
    rc(c, 0, 0, 16, 5, KN(1)); hl(c, 0, 0, 16, KN(2)); hl(c, 1, 4, 14, KN(-1))         # 위 문틀
    rc(c, 6, 1, 4, 3, MD(1)); hl(c, 6, 1, 4, MD(2)); px(c, 8, 2, K('sora', 0))        # 놋쇠 번호판 + 색 점
    hl(c, 4, 5, 8, IT(-3))                                                          # 상인방 밑 그늘
    for x in range(4, 12, 2): px(c, x, 6, IT(-3))
    for u in range(7):                                                              # 젖혀진 문짝(경첩 왼쪽, 자유 끝이 1px 낮다)
        sh = 1 if u >= 4 else 0
        for v in range(22):
            if u == 0: col = IT(-3)
            elif v == 0: col = IT(1)
            elif v == 21: col = IT(-3)
            elif u == 6: col = IT(1)
            else: col = IT(-1) if (u + v) % 7 else IT(0)
            px(c, 4 + u, 6 + v + sh, col)
        px(c, 4 + u, 28 + sh, IT(-3))
    hl(c, 5, 8, 5, TK(1)); px(c, 9, 8, TK(3))                                       # 도어 클로저 팔
    rc(c, 9, 16, 2, 4, K('yoru', -1)); px(c, 9, 17, K('midori', 2)); px(c, 10, 19, TK(3))   # 카드 키 자물쇠 + 손잡이
    hl(c, 4, 29, 8, TK(3)); hl(c, 4, 30, 8, TK(1)); hl(c, 4, 31, 8, TK(-2))           # 문턱


@R.obj('ht-single-bed', '싱글 침대(호텔)', w=1, h=2, up=16, kind='wall', use=('sleep',), tags=HOTEL + ('객실', '침대'),
       place='객실 북쪽 벽에 머리판을 대고(1×2). 곁에 책상·짐 받침.', pair=('ht-desk-tv', 'ht-luggage-rack'),
       desc='흰 시트·흰 이불의 호텔 싱글 침대(1×2). 짙은 천 머리판 위에 나무 선반과 노란 독서등, 발치에 남색 베드 스로(띠).')
def _single_bed(c):
    rc(c, 0, 0, 16, 18, OL)                                                         # 머리판
    rc(c, 1, 1, 14, 3, IT(1)); hl(c, 1, 1, 14, IT(2)); hl(c, 1, 3, 14, IT(3))         # 선반 윗면 + 앞 가장자리
    hl(c, 1, 4, 14, IT(-3))
    rc(c, 1, 5, 14, 12, K('soil', -1)); vl(c, 1, 5, 12, K('soil', 0)); vl(c, 14, 5, 12, K('soil', -2))
    for x in (5, 10): vl(c, x, 6, 10, K('soil', -2))                                # 천 판 이음
    rc(c, 2, 6, 3, 2, MD(2)); px(c, 2, 6, MD(1)); px(c, 3, 8, MD(1)); px(c, 3, 9, MD(0))     # 독서등
    rc(c, 0, 15, 16, 31, OL)                                                        # 매트리스
    rc(c, 1, 16, 14, 26, SH(1))
    rc(c, 2, 17, 12, 6, SH(2)); hl(c, 2, 22, 12, SH(0)); vl(c, 13, 17, 6, SH(0)); px(c, 7, 19, SH(0)); px(c, 8, 19, SH(0))   # 베개
    hl(c, 1, 24, 14, SH(2)); hl(c, 1, 25, 14, SH(0))                                # 이불 접힌 깃
    for y, x0 in ((28, 3), (31, 8), (39, 4)): hl(c, x0, y, 4, SH(0))                 # 이불 주름
    rc(c, 1, 33, 14, 4, K('kon', 0)); hl(c, 1, 33, 14, K('kon', 1)); hl(c, 1, 36, 14, K('kon', -1))   # 베드 스로
    rc(c, 1, 42, 14, 2, SH(0)); hl(c, 1, 43, 14, SH(-1))                            # 앞으로 늘어진 시트
    rc(c, 1, 44, 14, 2, IT(-2))
    hl(c, 0, 46, 16, OL)


@R.obj('ht-desk-tv', '좁은 책상과 벽걸이 TV', w=2, h=1, up=16, kind='wall', surface=True, use=('read',), tags=HOTEL + ('객실', '책상', 'TV'),
       place='객실 북쪽 벽 바로 아래(2×1). 남쪽에 북향 의자(desk-chair-n).', pair=('desk-chair-n', 'ht-single-bed'),
       desc='벽에 건 검은 평면 TV 아래 밝은 나무 좁은 책상 — 왼쪽 끝에 작은 스탠드, 책상 밑 오른쪽에 흰 소형 냉장고. 윗면 오른쪽에 탁상 물건을 놓는다.')
def _desk_tv(c):
    rc(c, 8, 1, 18, 12, OL)                                                         # 벽걸이 TV
    rc(c, 9, 2, 16, 10, K('yoru', -2))
    for i in range(6): px(c, 12 + i, 9 - i, K('garasu', -1)); px(c, 13 + i, 9 - i, K('garasu', -2))   # 화면 반사
    px(c, 23, 10, K('aka', 0))                                                       # 대기 불
    rc(c, 15, 13, 4, 2, K('yoru', -1))                                               # 받침 쇠
    rc(c, 2, 9, 5, 4, KN(2)); hl(c, 2, 9, 5, SH(2)); outline(c, 1, 8, 7, 6, KN(-1))   # 스탠드 갓
    vl(c, 4, 14, 3, TK(0))
    box3(c, 0, 15, 32, 7, 10, YK(1), YK(-1), YK(2), lip=YK(2))                      # 책상: 윗면 T6 + 앞면
    hl(c, 4, 18, 8, YK(0)); hl(c, 16, 19, 9, YK(0))                                 # 나뭇결
    hl(c, 1, 22, 30, YK(-2))                                                        # 상판 밑 그늘
    rc(c, 3, 23, 11, 3, YK(0)); outline(c, 2, 22, 13, 5, YK(-2)); hl(c, 6, 24, 4, YK(2))   # 서랍
    rc(c, 18, 23, 11, 8, SH(0)); outline(c, 17, 22, 13, 10, OL); hl(c, 18, 23, 11, SH(1)); vl(c, 27, 25, 4, TK(1))   # 소형 냉장고
    rc(c, 1, 27, 2, 4, YK(-2)); hl(c, 0, 31, 17, OL)


@R.obj('ht-unit-bath-door', '유닛 배스 문', w=1, kind='hang', hrows=2, use=('open',), tags=HOTEL + ('객실', '욕실', 'ユニットバス'),
       place='객실 북쪽 벽면 윗줄, 앞 바닥 한 칸은 비운다(들어가지 않는 문 — 조사 이벤트 자리)', pair=('ht-single-bed',),
       desc='객실 벽에 달린 흰 수지 유닛 배스 문(닫힘) — 회색 테, 은빛 레버, 아래 환기 살, 문 밑 한 단 높은 문턱. 글자 없음.')
def _unit_bath_door(c):
    rc(c, 1, 1, 14, 31, OL)
    rc(c, 2, 2, 12, 29, K('conc', 1)); vl(c, 2, 2, 29, K('conc', 2)); hl(c, 2, 2, 12, K('conc', 2))   # 문틀
    rc(c, 4, 4, 8, 25, SH(1)); hl(c, 4, 4, 8, SH(2)); vl(c, 4, 4, 25, SH(2)); vl(c, 11, 4, 25, SH(-1))   # 문짝
    outline(c, 3, 3, 10, 27, K('conc', -1))
    for y in (22, 24, 26): hl(c, 5, y, 6, K('conc', 0))                              # 환기 살
    hl(c, 9, 15, 3, TK(3)); px(c, 9, 16, TK(0))                                     # 레버
    rc(c, 2, 29, 12, 2, K('conc', 2)); hl(c, 2, 30, 12, K('conc', 0))                 # 한 단 높은 문턱


@R.obj('ht-luggage-rack', '짐 받침', w=1, h=1, up=0, kind='floor', surface=True, use=('open',), tags=HOTEL + ('객실',),
       place='객실 침대 발치나 문 곁 바닥', pair=('ht-single-bed',),
       desc='나무 살 셋을 띠 두 줄로 묶은 짐 받침 — 위에서 살이 보이고 아래 X 자 은빛 다리.')
def _luggage_rack(c):
    rc(c, 1, 3, 14, 6, OL)
    for i, y in enumerate((4, 6)):
        rc(c, 2, y, 12, 2, YK(1)); hl(c, 2, y, 12, YK(2))
    hl(c, 2, 8, 12, YK(3))                                                          # 앞 살 가장자리
    for x in (5, 10): vl(c, x, 3, 6, K('soil', -1)); px(c, x, 8, K('soil', 0))      # 띠
    for i in range(6):                                                              # X 다리
        px(c, 3 + i, 9 + i, TK(2)); px(c, 12 - i, 9 + i, TK(0))
    hl(c, 2, 15, 3, OL); hl(c, 11, 15, 3, OL)


@R.obj('ht-ice-machine', '제빙기', w=1, h=1, up=16, kind='wall', use=('open',), tags=HOTEL + ('엘리베이터 홀', '자판기 코너'),
       place='객실 층 엘리베이터 홀·자판기 코너 북쪽 벽 바로 아래',
       desc='스테인리스 제빙기(키 1.7m) — 윗면, 위 조작판에 파란 띠와 초록 불, 아래 얼음 통 문과 가로 손잡이, 밑 통풍 살.')
def _ice_machine(c):
    rc(c, 1, 0, 14, 32, OL)
    rc(c, 2, 1, 12, 3, TK(2)); hl(c, 2, 1, 12, TK(3)); hl(c, 2, 4, 12, TK(3))        # 윗면 T4 + 앞 가장자리
    hl(c, 2, 5, 12, TK(-3)); hl(c, 2, 6, 12, TK(-2))                                # 처마 그림자
    rc(c, 2, 7, 12, 24, TK(1)); vl(c, 2, 7, 24, TK(2)); vl(c, 13, 7, 24, TK(-1))
    rc(c, 3, 8, 10, 5, TK(0)); hl(c, 3, 9, 10, K('sora', 1)); hl(c, 3, 10, 10, K('sora', 0))   # 조작판 + 파란 띠
    px(c, 11, 12, K('midori', 2)); px(c, 4, 12, TK(3))
    rc(c, 3, 15, 10, 10, TK(0)); outline(c, 3, 15, 10, 10, TK(-2)); hl(c, 4, 16, 8, TK(2))   # 얼음 통 문(들어간 면)
    hl(c, 5, 18, 6, TK(3)); hl(c, 5, 19, 6, TK(-2))                                 # 가로 손잡이
    for y in (27, 29): hl(c, 3, y, 10, TK(-2))                                      # 통풍 살
    hl(c, 1, 31, 14, OL)


# ══ 료칸 ═════════════════════════════════════════════════════════════════════
@R.obj('ht-genkan-step', '료칸 현관 큰 단(式台)', w=1, h=1, kind='flat', use=('walk',), tags=RYOKAN + ('현관', '단', '玄関'),
       place='타타키와 마루 사이 한 줄에 가로로 이어 깐다(신발을 벗고 올라서는 단). 위 줄 마루에 슬리퍼.', pair=('slippers', 'ht-slipper-rack'),
       desc='반들반들 닦은 두꺼운 느티나무 판 단(式台) — 넓은 윗면에 짧은 광택, 밝은 앞 모서리, 짙은 챌판, 아래 타타키에 그림자. 가로로 이어 붙는 1×1, 밟는 바닥 무늬.')
def _genkan_step(c):
    rc(c, 0, 0, 16, 10, IT(1))
    hl(c, 0, 0, 16, IT(0))
    for (x, y, n) in ((2, 2, 5), (10, 4, 4), (5, 7, 3)): hl(c, x, y, n, IT(2))        # 광택
    for (x, y, n) in ((9, 2, 3), (1, 5, 4), (12, 7, 3)): hl(c, x, y, n, IT(0))       # 결
    hl(c, 0, 10, 16, IT(3))                                                         # 앞 모서리
    rc(c, 0, 11, 16, 3, IT(-1)); hl(c, 0, 13, 16, IT(-2))                            # 챌판
    hl(c, 0, 14, 16, K('yoru', -1)); hl(c, 0, 15, 16, K('hodo', -2))                 # 타타키 위 그림자


@R.obj('ht-slipper-rack', '슬리퍼 선반', w=1, h=1, up=16, kind='floor', use=('open',), tags=RYOKAN + ('현관', '슬리퍼'),
       place='현관 큰 단 옆 마루(타타키가 아니라 올라선 쪽)', pair=('ht-genkan-step', 'slippers'),
       desc='밝은 나무 3단 슬리퍼 선반 — 단마다 감색·팥색 손님 슬리퍼가 발끝을 앞으로 두 켤레씩 꽂혀 있다.')
def _slipper_rack(c):
    rc(c, 1, 1, 14, 31, OL)
    rc(c, 2, 2, 12, 3, YK(1)); hl(c, 2, 2, 12, YK(2)); hl(c, 2, 4, 12, YK(3))         # 윗면 T4
    hl(c, 2, 5, 12, YK(-2))
    vl(c, 2, 5, 26, YK(1)); vl(c, 13, 5, 26, YK(-1))                                # 옆판
    rc(c, 3, 6, 10, 25, YK(-2))                                                     # 안쪽 그늘
    for i, y in enumerate((12, 20, 28)):                                            # 선반 3단
        hl(c, 3, y, 10, YK(2)); hl(c, 3, y + 1, 10, YK(0))
        ramp = 'kon' if i != 1 else 'kawara'
        for x0 in (4, 9):                                                           # 슬리퍼 한 켤레(발끝 둥근 앞모습)
            rc(c, x0, y - 4, 3, 4, K(ramp, 0)); px(c, x0, y - 4, K(ramp, -1)); px(c, x0 + 2, y - 4, K(ramp, -1))
            hl(c, x0, y - 3, 3, K(ramp, 1)); px(c, x0 + 1, y - 1, KN(1))
    hl(c, 1, 31, 14, OL)


@R.obj('ht-ryokan-front', '료칸 나무 접수대', w=1, h=1, up=0, kind='floor', surface=True, use=('counter',), tags=RYOKAN + ('접수', '프런트', '帳場'),
       place='현관 마루 곁 접수 자리에 가로로 이어 붙인다. 직원은 북쪽, 손님은 남쪽 두 줄. 줄 끝 한 칸은 직원 틈.',
       pair=('ht-bell', 'ht-card-key'),
       desc='두꺼운 느티나무 상판에 짙은 나무 격자(格子) 앞판의 료칸 접수대 한 칸. 이음 없이 가로로 이어 붙고 윗면에 종·열쇠를 놓는다.')
def _ryokan_front(c):
    hl(c, 0, 0, 16, OL)
    rc(c, 0, 1, 16, 5, YK(1)); hl(c, 0, 1, 16, YK(2))
    hl(c, 3, 3, 6, YK(0)); hl(c, 11, 4, 4, YK(0))                                   # 나뭇결
    hl(c, 0, 5, 16, YK(3))
    rc(c, 0, 6, 16, 2, YK(-1)); hl(c, 0, 7, 16, IT(-3))                              # 두꺼운 상판 앞면
    rc(c, 0, 8, 16, 6, IT(-2))
    for x in range(0, 16, 4): vl(c, x + 1, 8, 6, IT(0)); vl(c, x + 2, 8, 6, IT(-1))   # 격자 살
    hl(c, 0, 8, 16, IT(-3))
    rc(c, 0, 14, 16, 1, IT(-3)); hl(c, 0, 15, 16, OL)


def _onsen_noren(c, ramp):
    """노천탕 노렌 통로: 짙은 나무 기둥·들보, 대나무 봉에 두 폭 긴 노렌(위 고리 띠, 아래 흰 물결 두 줄), 아래로 바닥이 보인다."""
    for x0 in (0, 12):
        rc(c, x0, 0, 4, 32, IT(-2)); vl(c, x0 + 1, 0, 32, IT(0)); vl(c, x0 + 3, 0, 32, IT(-3))
    vl(c, 0, 0, 32, IT(-3)); vl(c, 15, 0, 32, IT(-3))
    rc(c, 0, 0, 16, 4, IT(-1)); hl(c, 0, 0, 16, IT(1)); hl(c, 1, 3, 14, IT(-3))       # 들보
    hl(c, 3, 4, 10, MD(1)); hl(c, 3, 5, 10, MD(-1))                                 # 대나무 봉
    for xa in (4, 8):                                                               # 두 폭(4px) + 가운데 갈라짐
        rc(c, xa, 6, 4, 17, K(ramp, 0))
        vl(c, xa, 6, 17, K(ramp, 1)); vl(c, xa + 3, 6, 17, K(ramp, -1))
        for x in range(xa, xa + 4): px(c, x, 6 + (x % 2), K(ramp, -2))              # 위 고리(乳)
        hl(c, xa, 8, 4, K(ramp, -1))
        for i, y in enumerate((16, 19)):                                            # 흰 물결 두 줄
            for x in range(xa, xa + 4):
                px(c, x, y + ((x + i) % 2), SH(2) if (x + i) % 2 == 0 else SH(0))
        hl(c, xa, 22, 4, K(ramp, -2))
    vl(c, 7, 9, 13, K(ramp, -2)); vl(c, 8, 9, 13, K(ramp, 1))                         # 가운데 갈라짐
    hl(c, 4, 23, 8, IT(-3))                                                         # 노렌 밑 그늘(바닥)
    hl(c, 4, 29, 8, YK(2)); hl(c, 4, 30, 8, YK(0)); hl(c, 4, 31, 8, YK(-2))           # 문턱 널


@R.obj('ht-noren-onsen-m', '온천 노렌(남탕·감색)', kind='door', use=('travel',), tags=ONSEN + ('남탕', '노렌', '暖簾'),
       place='복도·로비와 남탕 탈의실 사이 가로 칸막이의 1칸 틈 칸', pair=('ht-noren-onsen-f',),
       desc='남탕 탈의실로 드는 통로. 짙은 나무 문틀의 대나무 봉에 감색 긴 노렌 두 폭(위 고리 띠, 아래 흰 물결 두 줄 — 글자 없음)이 걸리고 아래로 바닥이 보인다.')
def _noren_m(c): _onsen_noren(c, 'kon')


@R.obj('ht-noren-onsen-f', '온천 노렌(여탕·다홍)', kind='door', use=('travel',), tags=ONSEN + ('여탕', '노렌', '暖簾'),
       place='복도·로비와 여탕 탈의실 사이 가로 칸막이의 1칸 틈 칸', pair=('ht-noren-onsen-m',),
       desc='여탕 탈의실로 드는 통로. 짙은 나무 문틀의 대나무 봉에 다홍 긴 노렌 두 폭(위 고리 띠, 아래 흰 물결 두 줄 — 글자 없음)이 걸리고 아래로 바닥이 보인다.')
def _noren_f(c): _onsen_noren(c, 'aka')


@R.obj('ht-guest-futon', '손님용 이부자리(료칸)', w=1, h=2, up=0, kind='flat', walk=((0, 0), (0, 1)), use=('sleep',), tags=RYOKAN + ('객실', '화실', '밤'),
       place='료칸 다다미 객실에 두 채를 나란히(머리 북쪽). 좌탁은 방 한쪽으로 민다.', pair=('ht-tea-set-table', 'ht-yukata'),
       desc='두툼한 요 위에 흰 홑청 이불(엷은 감색 마름모 점·테두리)과 흰 베개를 편 료칸 손님 이부자리 1×2. 바닥 무늬라 밟을 수 있고 자는 자리. 집의 푸른 이불(futon)과 다르다.')
def _guest_futon(c):
    rc(c, 0, 1, 16, 31, OL)
    rc(c, 1, 2, 14, 28, SH(0))                                                      # 두툼한 요
    rc(c, 3, 3, 10, 6, SH(2)); hl(c, 3, 8, 10, SH(0)); vl(c, 12, 3, 6, SH(0)); px(c, 7, 5, SH(0)); px(c, 8, 5, SH(0))   # 베개
    outline(c, 2, 2, 12, 8, SH(-1))
    rc(c, 1, 10, 14, 17, SH(1))                                                     # 이불
    hl(c, 1, 10, 14, SH(2)); hl(c, 1, 11, 14, SH(2)); hl(c, 1, 12, 14, SH(0))         # 접힌 깃
    vl(c, 1, 13, 14, K('kon', 2)); vl(c, 14, 13, 14, K('kon', 1)); hl(c, 1, 26, 14, K('kon', 1))   # 테두리
    for y in range(15, 26, 4):                                                      # 마름모 점
        for x in range(4 + (2 if (y // 4) % 2 else 0), 13, 4): px(c, x, y, K('kon', 2))
    rc(c, 1, 27, 14, 3, SH(-1)); hl(c, 1, 27, 14, SH(0))                             # 요 두께(앞면)
    hl(c, 0, 31, 16, OL)


@R.obj('ht-tea-set-table', '객실 좌탁과 차 세트', w=2, h=1, up=0, kind='floor', surface=True, use=('block',), tags=RYOKAN + ('객실', '화실', '좌탁'),
       place='료칸 객실 다다미 가운데(낮에는 가운데, 밤에는 이부자리를 펴고 한쪽으로). 둘레에 좌의자(zaisu-*)나 방석.', pair=('zaisu-e', 'zaisu-w', 'zabuton', 'ht-tea-cup', 'ht-yukata'),
       desc='붉은빛 옻칠 좌탁(座卓) 2×1 — 왼쪽 칸에 검은 쟁반 위 급須 찻주전자와 찻잔 둘·과자 그릇, 오른쪽 칸 윗면은 비어 유카타·찻잔을 올린다.')
def _tea_table(c):
    box3(c, 1, 2, 30, 9, 4, KW(-1), KW(-2), KW(1), lip=KW(2))
    for i in range(4): px(c, 18 + i * 2, 4 + (i % 2), KW(0))                         # 옻칠 광택
    hl(c, 4, 4, 5, KW(0))
    for x0 in (3, 26): rc(c, x0, 14, 3, 2, KW(-3)); hl(c, x0, 15, 3, OL)
    disc(c, 8.5, 6.5, 6.4, 3.4, OL); disc(c, 8.5, 6.5, 5.6, 2.7, K('yoru', -1))       # 검은 쟁반
    disc(c, 6, 5.8, 2.3, 2.0, K('soil', 1)); px(c, 6, 3, K('soil', 2)); px(c, 5, 4, K('soil', 2)); px(c, 3, 6, K('soil', 0))   # 찻주전자
    px(c, 8, 5, K('soil', 0))
    for cx in (10, 12):                                                              # 찻잔 둘
        rc(c, cx - 1, 6, 2, 2, SH(2)); px(c, cx - 1, 6, K('midori', 1)); px(c, cx, 7, SH(0))
    disc(c, 9, 8.6, 1.4, 0.9, MD(1))                                                # 과자 그릇


def _engawa_chair(c, x0, east):
    """広縁 등나무 안락의자 옆모습 — east = 동쪽을 봄(등받이 서쪽)."""
    bx = x0 if east else x0 + 9                                                     # 등받이 세로 띠 x
    sx = x0 + 3 if east else x0                                                     # 좌석 x
    rc(c, bx, 4, 3, 24, OL); rc(c, bx + 1, 5, 1, 22, MD(0)); px(c, bx + 1, 5, MD(2))  # 등받이
    rc(c, sx, 14, 9, 13, OL)
    rc(c, sx + 1, 15, 7, 7, KN(1)); hl(c, sx + 1, 15, 7, KN(2))                       # 방석 윗면
    for x in range(sx + 2, sx + 7, 2): px(c, x, 18, KN(0))
    hl(c, sx + 1, 12, 7, MD(1)); rc(c, sx, 11, 9, 3, OL); hl(c, sx + 1, 12, 7, MD(1))  # 북쪽 팔걸이
    hl(c, sx + 1, 22, 7, MD(2)); rc(c, sx + 1, 23, 7, 3, MD(0))                      # 앞 팔걸이·앞면(등나무)
    for x in range(sx + 1, sx + 8, 2): px(c, x, 24, MD(-1))
    rc(c, sx + 1, 26, 1, 3, MD(-1)); rc(c, sx + 6, 26, 1, 3, MD(-1))                  # 다리
    hl(c, sx, 29, 8, OL)


@R.obj('ht-engawa-chairs', '広縁 의자 둘과 작은 탁자', w=2, h=1, up=16, kind='floor', use=('sit',), tags=RYOKAN + ('객실', '広縁', '창가'),
       place='료칸 객실 창가(広縁) — 쇼지 창(shoji-window) 아래 북쪽 줄', pair=('shoji-window',),
       desc='료칸 객실 창가 마루(広縁)의 등나무 안락의자 둘이 마주 보고, 가운데 둥근 나무 탁자에 작은 찻잔. 2×1, 등받이가 위로 솟는다.')
def _engawa(c):
    _engawa_chair(c, 0, True)
    _engawa_chair(c, 20, False)
    disc(c, 16, 17.5, 5.2, 2.6, OL); disc(c, 16, 17.2, 4.4, 1.9, IT(1)); hl(c, 13, 16, 4, IT(2))   # 둥근 상판
    rc(c, 15, 20, 2, 7, IT(-1)); px(c, 15, 20, IT(0))                                # 기둥
    disc(c, 16, 27.5, 3.2, 1.2, IT(-2)); hl(c, 13, 29, 7, OL)                        # 받침
    rc(c, 16, 15, 2, 2, SH(2)); px(c, 16, 15, K('midori', 1))                         # 찻잔


@R.table('ht-rotenburo', '노천탕', desc='둥근 바위로 테를 두른 노천탕 — 엷은 청록빛 온천물에 잔물결과 흰 김. 어떤 w×h 로도 이어 붙는다. 사람 없음.',
         tags=ONSEN)
def _rotenburo(c, w, h):
    W, H = w * 16, h * 16
    rc(c, 0, 0, W, H, K('sora', 0))                                                 # 물
    for yy in range(8, H - 9):
        for xx in range(W):
            lx, ly = xx % 16, yy % 16
            if ly in (3, 11) and (lx + (4 if ly == 11 else 0)) % 16 < 5: px(c, xx, yy, K('sora', 1))    # 잔물결
            if (lx, ly) in ((10, 5), (2, 13)): px(c, xx, yy, SH(2))                  # 반짝임
            if (lx, ly) in ((5, 7), (6, 6), (6, 7), (7, 6), (13, 1), (14, 0), (14, 1)): px(c, xx, yy, SH(1))   # 김
    # 바위 테 — 둥근 돌(타원)을 겹쳐 쌓는다. 뒤·좌우 테는 윗면만, 앞 테는 윗면 + 앞면(어두운 아랫단).
    def rock(cx, cy, rx, ry, t, front=0):
        if front: disc(c, cx, cy + front, rx, ry, OL); disc(c, cx, cy + front - .5, rx - .9, ry - .9, HD(t - 2))
        disc(c, cx, cy, rx, ry, OL)
        disc(c, cx, cy, rx - .9, ry - .9, HD(t))
        disc(c, cx - rx * .3, cy - ry * .35, rx * .5, ry * .4, HD(t + 1))
        px(c, cx - rx * .45, cy - ry * .55, HD(t + 2))
    for xx in range(0, W, 16):
        rock(xx + 4, 2.5, 5.2, 3.6, 0); rock(xx + 12, 3, 5.0, 3.8, 1)                    # 뒤 테
        rock(xx + 12, H - 7, 5.4, 3.4, 0, 3); rock(xx + 4, H - 6.5, 5.2, 3.2, 1, 3)       # 앞 테
    for yy in range(0, H, 16):
        rock(2.5, yy + 5, 3.6, 4.6, 1); rock(2.5, yy + 13, 3.8, 4.4, 0)                  # 왼 테
        rock(W - 3, yy + 6, 3.6, 4.6, 0); rock(W - 3, yy + 14, 3.8, 4.4, 1)              # 오른 테
    hl(c, 0, H - 1, W, OL)


@R.obj('ht-bamboo-fence', '대나무 울타리', w=1, h=1, up=8, kind='floor', use=('block',), tags=ONSEN + ('울타리', '竹垣'),
       place='노천탕 마당 가장자리(탕과 건물 사이 가림)에 가로로 이어 붙인다. 앞(북쪽)에 걷는 칸을 남긴다.', pair=('ht-stone-lantern', 'ht-rotenburo'),
       desc='쪼갠 대나무를 세로로 촘촘히 세우고 둥근 대 두 줄을 검은 끈으로 묶은 허리 높이 울타리(建仁寺垣) 한 칸 — 위에 둥근 대 갓. 가로로 이어 붙는다.')
def _bamboo_fence(c):
    hl(c, 0, 7, 16, OL)
    rc(c, 0, 8, 16, 3, MD(0)); hl(c, 0, 8, 16, MD(2)); hl(c, 0, 9, 16, MD(1)); hl(c, 0, 10, 16, MD(-2))   # 갓(笠竹) 윗면
    for x in range(16):                                                             # 쪼갠 대 세로 살(4px)
        vl(c, x, 11, 20, (MD(1), MD(0), MD(-1), MD(-2))[x % 4])
    for x0 in range(0, 16, 4):                                                       # 대 마디(살마다 높이가 다르다)
        for y in (14 + (x0 * 3) % 3, 26 + (x0 * 7) % 3):
            hl(c, x0, y, 3, MD(-2)); px(c, x0, y + 1, MD(2))
    for y in (16, 23):                                                              # 둥근 대(押縁) + 검은 끈
        hl(c, 0, y, 16, MD(1)); hl(c, 0, y + 1, 16, MD(-1)); hl(c, 0, y + 2, 16, MD(-2))
        for x in (3, 11): vl(c, x, y - 1, 4, K('sumi', 0)); px(c, x + 1, y, K('sumi', 1))
    hl(c, 0, 31, 16, OL)


@R.obj('ht-stone-lantern', '석등', w=1, h=1, up=16, kind='floor', use=('light',), tags=ONSEN + ('정원', '石灯籠'),
       place='노천탕 바위 곁이나 정원 모퉁이', pair=('ht-bamboo-fence', 'ht-rotenburo'),
       desc='화강암 석등(石灯籠) — 꼭대기 보주, 처마 끝이 휜 삿갓 지붕(윗면이 보인다), 불빛 새는 화창, 받침대·기둥·밑돌.')
def _stone_lantern(c):
    disc(c, 8, 2.5, 1.6, 1.6, OL); px(c, 7, 2, HD(2)); px(c, 8, 2, HD(1))            # 보주
    rc(c, 1, 4, 14, 7, OL)                                                          # 삿갓 지붕
    rc(c, 2, 5, 12, 3, HD(1)); hl(c, 3, 5, 10, HD(2)); hl(c, 2, 7, 12, HD(2))         # 윗면 + 앞 가장자리
    rc(c, 2, 8, 12, 2, HD(-1)); px(c, 1, 9, HD(1)); px(c, 14, 9, HD(-1))             # 처마 앞면 + 휜 끝
    rc(c, 4, 11, 8, 7, OL); rc(c, 5, 11, 6, 6, HD(0)); vl(c, 5, 11, 6, HD(1))        # 화사(火袋)
    rc(c, 7, 12, 3, 4, MD(1)); px(c, 8, 13, MD(2)); hl(c, 7, 15, 3, MD(0))            # 화창 불빛
    rc(c, 3, 18, 10, 3, OL); hl(c, 4, 18, 8, HD(2)); hl(c, 4, 19, 8, HD(0))           # 중대(받침)
    rc(c, 6, 21, 4, 6, OL); rc(c, 7, 21, 2, 6, HD(0)); vl(c, 7, 21, 6, HD(1))         # 기둥
    rc(c, 3, 27, 10, 4, OL); hl(c, 4, 27, 8, HD(2)); rc(c, 4, 28, 8, 2, HD(-1))       # 밑돌
    hl(c, 4, 31, 9, HD(-3))


# ══ 탁상 물건 ════════════════════════════════════════════════════════════════
@R.good('ht-card-key', '카드 키', desc='흰 카드 키 한 장(파란 띠)과 짙은 가죽 키 홀더 — 프런트 카운터·객실 책상 위.')
def _g_card(c):
    rc(c, 3, 6, 9, 5, K('yoru', -1)); hl(c, 3, 6, 9, K('yoru', 1))                  # 키 홀더
    rc(c, 6, 3, 7, 5, SH(2)); hl(c, 6, 5, 7, K('sora', 1)); outline(c, 5, 2, 9, 7, SH(-1))   # 카드
    px(c, 7, 3, SH(1)); hl(c, 3, 11, 9, OL)


@R.good('ht-bell', '호출 종', desc='검은 받침 위 금빛 반구 호출 종(꼭지 하나) — 프런트·접수대 위.')
def _g_bell(c):
    disc(c, 8, 7, 4.2, 3.4, OL); disc(c, 8, 7.2, 3.4, 2.7, MD(1)); px(c, 6, 6, MD(2)); px(c, 7, 5, MD(2))
    rc(c, 7, 2, 2, 2, TK(2)); px(c, 7, 2, TK(3))                                     # 꼭지
    rc(c, 3, 9, 10, 2, K('yoru', -1)); hl(c, 3, 9, 10, K('yoru', 1)); hl(c, 3, 11, 10, OL)


@R.good('ht-tea-cup', '찻잔과 찻잔 받침', desc='나무 받침(茶托) 위 흰 찻잔에 녹차 — 좌탁·広縁 탁자 위.')
def _g_teacup(c):
    disc(c, 8, 9.5, 5, 1.8, OL); disc(c, 8, 9.4, 4.2, 1.2, IT(0))                    # 받침
    rc(c, 5, 4, 6, 5, SH(2)); vl(c, 5, 4, 5, SH(2)); vl(c, 10, 4, 5, SH(0)); outline(c, 4, 3, 8, 7, SH(-1))
    hl(c, 5, 4, 5, K('midori', 1)); px(c, 6, 4, K('midori', 2))                        # 녹차
    hl(c, 5, 7, 5, K('kon', 1))                                                     # 찻잔 띠


@R.good('ht-yukata', '접힌 유카타', desc='네모로 접은 흰 바탕 감색 무늬 유카타와 그 위 감색 띠(오비) — 객실 좌탁·이부자리 곁.')
def _g_yukata(c):
    rc(c, 2, 4, 12, 8, OL); rc(c, 3, 5, 10, 6, SH(1)); hl(c, 3, 5, 10, SH(2))
    for x, y in ((4, 7), (7, 9), (10, 7), (12, 9), (6, 6)): px(c, x, y, K('kon', 1))  # 무늬
    rc(c, 3, 8, 10, 2, K('kon', -1)); hl(c, 3, 8, 10, K('kon', 0))                   # 띠
    rc(c, 3, 11, 10, 1, SH(-1)); hl(c, 2, 12, 12, OL)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

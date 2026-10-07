#!/usr/bin/env python3
"""jp_city 블록 interior_home2 — 일본 집 보강(베란다·맨션·목조 아파트·단층 옛집) 바닥·가구·탁상 물건. id 머리 h2-.
  python3 scripts/content/jp-city/blocks/interior_home2.py     # selftest + tiledata/jp-city/blocks/interior_home2/_all-x3.png
틀(칸 자르기·그림자·사양)은 interior/ikit.py. 여기는 그림만 그린다. 색은 modern3 램프 K(램프, 단)만, 반투명 없음, 윤곽 OL, 빛은 왼쪽 위.
3/4 시점: 가로면(상판·윗면·뚜껑)은 위에서, 앞면은 남쪽 정면. 키 큰 벽 가구는 윗면 4~6px + 윗줄 1px 밝은 테두리 + 처마 그림자 2px + 앞면은 안으로 들어가게.
기존 가구 97종(jpInteriorSpec.json)은 그대로 쓰고 없는 것만 그렸다. 주방 섬(system kitchen)은 기존 kcounter 탁자로 충분해 그리지 않았다.

치수(1칸=16px=1m. bible §12-3 와 같은 식)
  veranda-floor  floor 4×4          — 방수 콘크리트 마감 바닥. 32px(2m)마다 줄눈. 4톤.
  railing        1×1 up0           — 난간 높이 1.1m: 윗덮개 T4(윗면 2+앞 1+그림자 1) / 유리판 F8 / 콘크리트 밑단 F3 = 15 + 윤곽 1
  railing-metal  1×1 up0           — 철제 난간 1.0m: 윗봉 3 + 세로살(간격 4px) 10 + 밑봉 2. 살 사이는 비어 베란다 바닥이 보인다
  laundry-pole   2×1 up0           — 빨래 장대 길이 2m: 두 받침(발 4px) + 장대 y3, 빨래 8~10px
  ac-outdoor     1×1 up0           — 실외기 0.7m 폭 0.8m: 윗면 T4 / 앞면 F11(원형 그릴 지름 8)
  planter        1×1 up0           — 화분 0.5m: 잎 7 + 테라코타 윗면 2 + 몸통 6
  sandals        1×1 flat          — 슬리퍼 한 켤레 0.25m×0.1m: 바닥 위에 5×8 두 짝
  sash-door      2×1 flat          — 큰 유리 미닫이 문턱 폭 2m: 레일 2줄(알루미늄 ST) + 문틀 3px
  genkan-door-steel 1×1 flat       — 철제 현관문 문턱: 문틀 2px + 문턱판 4px + 현관 콘크리트
  shoe-closet    1×1 up16 wall     — 신발장 높이 1.2m 중 벽 한 줄 반을 덮음(tansu 와 같은 관례): 윗면 T5 / 앞면 F26(루버 문)
  bed-side       1×1 up0 wall      — 침대 옆 수납 0.5m: 윗면 T5 / 앞면 F10(서랍 2단)
  old-sink       2×1 up0 wall      — 스테인리스 싱크 1.2m + 1구 가스 레인지: 윗면 T5 / 앞면 F10
  old-fridge     1×1 up16 wall     — 작은 2도어 냉장고 높이 1.3m: 윗면 T4 / 앞면 F24(냉동 7 + 냉장 17)
  cardboard      1×1 up0           — 쌓은 박스 0.5m 2개: 윗면 T4 / 앞면 F9
  hanger-rail    1×1 up16 wall     — 행거 높이 1.4m: 윗봉 + 옷 길이 18
  futon-dry      2×(hang 2줄)      — 창가에 넌 이불 1.5m×1.4m: 봉 + 이불 28×24
  engawa         floor 8×4         — 옛 툇마루 널 바닥: 폭 4px 긴 널(ita 램프)
  garden-step    1×1 flat          — 디딤돌 0.5m 둥근돌
  shoji-door     1×1 flat          — 장지문 문턱(가모이 홈 두 줄)
  irori          1×1 up0           — 이로리 0.9m 화덕: 나무 틀 윗면 T11 안에 재·숯, 쇠 주전자 높이 6
  hibachi        1×1 up0           — 화로 0.35m: 윗면(타원) T6 + 도기 몸통 F7
  old-tansu      2×1 up16 wall     — 계단 장롱 폭 2m: 왼쪽 낮은 단 높이 0.8m, 오른쪽 높은 단 1.4m
  (탁상) teapot-iron 철 주전자, potted-herb 허브 화분, instant-noodle 컵라면, ashtray-old 옛 재떨이
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_home2'
R = Registry(BLOCK, '집 보강')

_KC = {}


def kc(ramp, t):
    """K 를 부르되 램프 범위를 벗어나면 가장 가까운 단으로."""
    key = (ramp, t)
    if key not in _KC:
        tt = t
        while True:
            try: _KC[key] = K(ramp, tt); break
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
    x, y = int(x), int(y)
    if 0 <= x < c.w and 0 <= y < c.h: c.P(x, y, col)


def disc(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: px(c, x, y, col)


def ring(c, cx, cy, rx, ry, col, outl=OL):
    """윤곽이 있는 타원: 바깥 OL, 안쪽 col."""
    disc(c, cx, cy, rx + 1, ry + 1, outl); disc(c, cx, cy, rx, ry, col)


def box(c, x, y, w, h, ramp, top, hi=3, mid=1, lo=-1, outline=True):
    """3/4 상자 하나. x,y,w,h = 윤곽 포함 전체. 윗면 top px(맨 윗줄은 밝은 테두리), 앞면은 왼쪽 빛(+1)·오른쪽 그늘(-1)·바닥 줄(lo)."""
    if outline: c.R(x, y, w, h, OL)
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    for j in range(ih):
        for i in range(iw):
            if j < top: v = hi if j == 0 else hi - 1
            else: v = mid
            if j >= top and i == 0: v = mid + 1
            if j >= top and i == iw - 1: v = mid - 1
            if j == ih - 1: v = lo
            c.P(ix + i, iy + j, kc(ramp, v))
    return ix, iy, iw, ih


# ───────────────── 바닥 ─────────────
@R.floor('h2-veranda-floor', '베란다 방수 바닥', cols=4, rows=4, tags=('베란다', '맨션', '콘크리트', '실외'),
         desc='회색 방수 콘크리트 마감 바닥. 32px 줄눈 + 성긴 얼룩. 실내 마룻바닥 아래 남쪽 띠에 깔고 난간·실외기·빨래 장대를 얹는다.')
def _veranda(c):
    base, lo, hi, dk = kc('conc', 1), kc('conc', 0), kc('conc', 2), kc('conc', -1)
    for y in range(c.h):
        for x in range(c.w):
            col = base
            if rnd(x, y, 3, 55): col = lo
            elif rnd(x, y, 4, 35): col = hi
            if x % 32 == 0 or y % 32 == 0: col = dk
            elif x % 32 == 1 or y % 32 == 1: col = hi
            c.P(x, y, col)


@R.floor('h2-engawa', '툇마루', cols=8, rows=4, tags=('옛집', '평지', '툇마루', '나무'),
         desc='오래된 나무 툇마루 널. 폭 4px 긴 널이 가로로 이어지고 이음새가 어긋난다. 단층 옛집 남쪽 띠에 깐다.')
def _engawa(c):
    hi, mid, lo = kc('ita', 2), kc('ita', 1), kc('ita', -1)
    W, H = c.w, c.h
    rows = H // 4
    seams = []
    for r in range(rows):
        a = (r * 41 + 7 + hs(r, 0, 9) % 11) % W
        b = (a + 48 + hs(r, 1, 9) % 30) % W
        seams.append((a, b))
    for y in range(H):
        r, yy = y // 4, y % 4
        a, b = seams[r]
        for x in range(W):
            if a < b: bid = 0 if a <= x < b else 1
            else: bid = 0 if (x >= a or x < b) else 1
            col = hi if hs(r, bid, 12) % 5 == 0 else mid
            if yy == 3: col = lo
            elif x == a or x == b: col = lo
            elif yy in (1, 2) and rnd(x // 4, r, 14, 60) and x % 4 == 1: col = lo
            c.P(x, y, col)


# ───────────────── 베란다 ─────────────────
@R.obj('h2-railing', '베란다 난간(콘크리트+유리)', 1, 1, up=0, kind='floor', use=('block',), place='베란다 남쪽 가장자리 한 줄',
       pair=('h2-veranda-floor',), tags=('베란다', '맨션', '난간'),
       desc='콘크리트 밑단과 유리판 난간. 한 줄로 이어 붙여 베란다 끝을 막는다.')
def h2_railing(c):
    # 윗덮개
    c.HL(0, 0, 16, OL)
    c.HL(0, 1, 16, kc('conc', 4)); c.HL(0, 2, 16, kc('conc', 3)); c.HL(0, 3, 16, kc('conc', 1))
    c.HL(0, 4, 16, kc('conc', -3))
    # 유리판(왼쪽 빛, 사선 반짝임)
    for y in range(5, 12):
        for x in range(16):
            v = 1
            if x in (0, 1): v = 0       # 기둥 쪽
            if (x - y) % 8 == 2: v = 3
            c.P(x, y, kc('garasu', v))
    c.VL(0, 5, 7, kc('conc', 2)); c.VL(1, 5, 7, kc('conc', 1)); c.VL(15, 5, 7, kc('conc', -1))
    c.HL(0, 12, 16, kc('conc', -2))
    # 콘크리트 밑단
    c.HL(0, 13, 16, kc('conc', 2)); c.HL(0, 14, 16, kc('conc', 0)); c.HL(0, 15, 16, OL)


@R.obj('h2-railing-metal', '베란다 난간(철제)', 1, 1, up=0, kind='floor', use=('block',), place='집 베란다·툇마루 가장자리',
       pair=('h2-veranda-floor',), tags=('난간', '철제', '집'),
       desc='세로살 철제 난간. 살 사이가 비어 바닥이 보인다. 한 줄로 이어 붙인다.')
def h2_railing_metal(c):
    c.HL(0, 2, 16, OL); c.HL(0, 3, 16, kc('tekko', 3)); c.HL(0, 4, 16, kc('tekko', 1)); c.HL(0, 5, 16, OL)
    for x in (1, 5, 9, 13):
        c.VL(x - 1, 6, 8, OL); c.VL(x + 1, 6, 8, OL)       # 살 윤곽
        c.VL(x, 6, 8, kc('tekko', 2))
    c.HL(0, 13, 16, OL); c.HL(0, 12, 16, kc('tekko', 1)); c.HL(0, 14, 16, OL)
    for x in range(0, 16, 4): c.P(x, 15, kc('conc', -2))      # 바닥에 떨어진 살 그림자


@R.obj('h2-laundry-pole', '빨래 장대', 2, 1, up=0, kind='floor', use=('block',), place='베란다 윗줄', pair=('h2-veranda-floor',),
       tags=('베란다', '빨래', '장대'), desc='두 받침 위에 장대. 수건·셔츠 빨래가 걸렸다. 사람은 없다.')
def h2_laundry(c):
    for x0 in (1, 27):            # 받침
        c.R(x0, 2, 4, 14, OL); c.R(x0 + 1, 2, 2, 13, kc('tekko', 1)); c.VL(x0 + 1, 2, 13, kc('tekko', 3))
        c.R(x0 - 1, 14, 6, 2, OL); c.R(x0, 14, 4, 1, kc('tekko', 0))
    c.HL(2, 3, 28, OL); c.HL(2, 4, 28, kc('tekko', 2)); c.HL(2, 5, 28, OL)   # 장대
    # 빨래: 수건(흰) · 셔츠(하늘) · 수건(분홍) · 셔츠(노랑)
    def towel(x, w, ramp, h):
        c.R(x, 6, w, h, OL); c.R(x + 1, 6, w - 2, h - 1, kc(ramp, 3))
        c.VL(x + 1, 6, h - 1, kc(ramp, 4)); c.VL(x + w - 2, 6, h - 1, kc(ramp, 1)); c.HL(x + 1, 6 + h - 3, w - 2, kc(ramp, 1))
    def shirt(x, ramp):
        c.R(x, 6, 10, 9, OL); c.R(x + 1, 6, 8, 8, kc(ramp, 2)); c.R(x - 1, 6, 12, 3, OL); c.R(x, 6, 10, 2, kc(ramp, 2))
        c.VL(x, 6, 2, kc(ramp, 3)); c.VL(x + 1, 8, 6, kc(ramp, 3)); c.VL(x + 8, 8, 6, kc(ramp, 0)); c.P(x + 4, 6, OL); c.P(x + 5, 6, OL)
        c.HL(x + 1, 13, 8, kc(ramp, -1))
    towel(5, 6, 'shiro', 9); shirt(12, 'sora'); towel(23, 3, 'pinku', 8)


@R.obj('h2-ac-outdoor', '에어컨 실외기', 1, 1, up=0, kind='floor', use=('block',), place='베란다 구석', pair=('h2-veranda-floor',),
       tags=('베란다', '에어컨', '실외기'), desc='흰 실외기. 둥근 팬 그릴. 베란다 한쪽 구석에 둔다.')
def h2_ac(c):
    x, y, iw, ih = box(c, 1, 3, 14, 12, 'shiro', 4, hi=4, mid=2, lo=0)
    disc(c, 8, 10, 4.6, 4.2, OL); disc(c, 8, 10, 3.8, 3.5, kc('tekko', 1))
    for k in range(-3, 4):      # 십자 그릴
        px(c, 8 + k, 10, kc('tekko', -1)); px(c, 8, 10 + k, kc('tekko', -1))
    px(c, 6, 8, kc('tekko', 3)); px(c, 7, 8, kc('tekko', 3)); px(c, 6, 9, kc('tekko', 3))
    c.R(11, 5, 2, 1, kc('conc', 0))     # 단자 덮개
    c.HL(2, 15, 12, kc('conc', -2))      # 그림자


@R.obj('h2-planter', '베란다 화분', 1, 1, up=0, kind='floor', use=('block',), place='베란다·툇마루', tags=('베란다', '화분', '식물'),
       desc='테라코타 화분에 푸른 잎. 베란다 한 칸에 둔다.')
def h2_planter(c):
    for (cx, cy, rx, ry, v) in ((5, 5, 3.4, 3, 1), (11, 5, 3.4, 3, 1), (8, 3.5, 3.6, 3.2, 2)):
        disc(c, cx, cy, rx + 1, ry + 1, OL)
    for (cx, cy, rx, ry, v) in ((5, 5, 3.4, 3, 1), (11, 5, 3.4, 3, 1), (8, 3.5, 3.6, 3.2, 2)):
        disc(c, cx, cy, rx, ry, kc('midori', v))
    for (x, y) in ((4, 3), (7, 2), (10, 3), (6, 5), (12, 5)): px(c, x, y, kc('midori', 3))
    c.HL(2, 8, 12, OL)
    c.R(2, 9, 12, 2, kc('renga', 2)); c.HL(2, 9, 12, kc('renga', 3))        # 윗테
    c.R(3, 11, 10, 4, kc('renga', 1)); c.VL(3, 11, 4, kc('renga', 2)); c.VL(12, 11, 4, kc('renga', 0))
    c.VL(2, 9, 2, OL); c.VL(13, 9, 2, OL); c.VL(2, 11, 4, OL); c.VL(13, 11, 4, OL); c.HL(3, 15, 10, OL)
    c.HL(3, 14, 10, kc('renga', 0))


@R.obj('h2-sandals', '베란다 슬리퍼', 1, 1, up=0, kind='flat', walk=((0, 0),), place='베란다 문 앞', tags=('베란다', '슬리퍼', '신발'),
       desc='바닥 위에 놓인 슬리퍼 한 켤레. 밟고 지나간다.')
def h2_sandals(c):
    # 발끝이 위(북)를 향한 슬리퍼 한 켤레: 둥근 코, 바닥 그림자, 발등 끈
    for (x0, ramp) in ((2, 'sora'), (9, 'pinku')):
        disc(c, x0 + 2.5, 6.2, 3.4, 3.6, OL)
        c.R(x0, 7, 5, 6, OL)
        disc(c, x0 + 2.5, 6.2, 2.5, 2.7, kc(ramp, 2))
        c.R(x0 + 1, 7, 3, 5, kc(ramp, 2))
        c.VL(x0 + 1, 5, 6, kc(ramp, 3)); c.VL(x0 + 3, 7, 5, kc(ramp, 0))
        c.HL(x0 + 1, 6, 3, kc('shiro', 3)); px(c, x0 + 1, 6, kc('shiro', 4))        # 발등 끈
        c.HL(x0 + 1, 12, 3, kc(ramp, -1))                                            # 뒤꿈치
        c.HL(x0 + 1, 13, 5, kc('conc', -1))                                          # 바닥 그림자


@R.obj('h2-sash-door', '베란다 유리 미닫이 문턱', 2, 1, up=0, kind='flat', walk=((0, 0), (1, 0)), use=('open',), place='실내와 베란다 사이 칸막이 틈',
       pair=('h2-veranda-floor',), tags=('베란다', '미닫이', '문턱', '유리'),
       desc='큰 유리 미닫이 문의 알루미늄 레일 문턱. 2칸 폭 틈에 깐다.')
def h2_sash(c):
    # 위에서 본 큰 유리 미닫이 문턱: 알루미늄 틀 + 두 레일, 가운데 유리 홈
    c.R(0, 0, 32, 16, kc('conc', 1))
    for x in range(1, 31, 3): px(c, x, 14, kc('conc', 0))
    c.R(0, 0, 3, 16, OL); c.VL(1, 0, 16, kc('tekko', 3)); c.VL(2, 0, 16, kc('tekko', 1))     # 문틀
    c.R(29, 0, 3, 16, OL); c.VL(29, 0, 16, kc('tekko', 1)); c.VL(30, 0, 16, kc('tekko', -1))
    # 위쪽 알루미늄 레일(두 홈)
    c.HL(3, 1, 26, OL); c.HL(3, 2, 26, kc('tekko', 4)); c.HL(3, 3, 26, kc('tekko', 2)); c.HL(3, 4, 26, kc('tekko', -2)); c.HL(3, 5, 26, kc('tekko', 1))
    c.HL(3, 6, 26, kc('tekko', 3)); c.HL(3, 7, 26, OL)
    # 가운데: 유리가 낀 홈(맑은 청회색)
    for y in range(8, 11):
        for x in range(3, 29): c.P(x, y, kc('garasu', 2 if y == 8 else 1))
    c.HL(3, 8, 26, kc('garasu', 3))
    for x in range(8, 26, 7): px(c, x, 9, kc('shiro', 4)); px(c, x + 1, 8, kc('shiro', 4))
    # 아래쪽 레일
    c.HL(3, 11, 26, OL); c.HL(3, 12, 26, kc('tekko', 4)); c.HL(3, 13, 26, kc('tekko', 2)); c.HL(3, 14, 26, kc('tekko', -2)); c.HL(3, 15, 26, OL)


# ───────────────── 맨션 ─────────────────
@R.obj('h2-genkan-door-steel', '맨션 철제 현관문 문턱', 1, 1, up=0, kind='flat', walk=((0, 0),), use=('open',), place='맨션 현관 아래 한 줄 틈',
       pair=('agarikamachi',), tags=('맨션', '현관', '철문', '문턱'),
       desc='회색 철제 현관문의 문턱판과 문틀. 콘크리트 현관 위에 깐다. 위 칸에 agarikamachi.')
def h2_genkan_steel(c):
    # 위에서 본 철제 문턱: 양쪽 문틀 + 가운데 알루미늄 문턱판(리벳), 앞 현관 콘크리트
    c.R(0, 0, 16, 16, kc('conc', 1))
    for x in range(2, 15, 3): px(c, x, 2, kc('conc', 0)); px(c, x + 1, 13, kc('conc', 0))
    c.R(0, 0, 3, 16, OL); c.VL(1, 0, 16, kc('tekko', 3)); c.VL(2, 0, 16, kc('tekko', 1))
    c.R(13, 0, 3, 16, OL); c.VL(13, 0, 16, kc('tekko', 0)); c.VL(14, 0, 16, kc('tekko', -2))
    c.HL(3, 3, 10, OL); c.R(3, 4, 10, 7, kc('tekko', 2)); c.HL(3, 4, 10, kc('tekko', 4)); c.HL(3, 5, 10, kc('tekko', 3))
    c.HL(3, 9, 10, kc('tekko', 0)); c.HL(3, 10, 10, kc('tekko', -2)); c.HL(3, 11, 10, OL)
    for x in (4, 11): px(c, x, 7, kc('shiro', 4)); px(c, x + 1, 7, kc('tekko', 0))        # 리벳
    c.HL(3, 12, 10, kc('conc', 3)); c.HL(3, 13, 10, kc('conc', -1))


@R.obj('h2-shoe-closet', '신발장(맨션 키 큰)', 1, 1, up=16, kind='wall', use=('open',), place='맨션 현관 옆 벽', pair=('h2-genkan-door-steel',),
       tags=('맨션', '현관', '신발장', '수납'), desc='흰 루버 문 키 큰 신발장. 천장 가까이까지 닿는다.')
def h2_shoe_closet(c):
    # 3/4 키 큰 수납: 윗면 5px(맨 윗줄 밝음) · 처마 그림자 2px · 움푹한 루버 문 · 아래 발판
    c.R(0, 0, 16, 32, OL)
    for y in range(1, 31):
        for x in range(1, 15):
            if y <= 5: v = 4 if y == 1 else 3          # 윗면
            elif y <= 7: v = -1                        # 처마 그림자(앞면 위)
            else: v = 2
            c.P(x, y, kc('ita', v))
    c.VL(1, 8, 22, kc('ita', 4)); c.VL(14, 8, 22, kc('ita', 0))
    # 앞면 안쪽으로 들어간 문판(OL 틀 + 안쪽 한 단 어둡게)
    c.R(2, 8, 12, 21, kc('ita', 1)); c.R(3, 9, 10, 19, kc('ita', 2))
    c.VL(3, 9, 19, kc('ita', 3)); c.VL(12, 9, 19, kc('ita', 1))
    for y in range(10, 27, 3):                                              # 루버
        c.HL(4, y, 8, kc('conc', 0)); c.HL(4, y + 1, 8, kc('conc', -2))
    c.VL(8, 9, 19, OL)                                                      # 문 가운데 틈
    c.R(6, 17, 1, 3, kc('tekko', 2)); c.R(9, 17, 1, 3, kc('tekko', 2))      # 손잡이
    c.HL(1, 29, 14, kc('ita', -1)); c.HL(1, 30, 14, kc('ita', 0))        # 발판


@R.obj('h2-bed-side', '침대 옆 수납', 1, 1, up=0, kind='wall', use=('open',), place='침대 머리 옆', pair=('bed-single',),
       tags=('맨션', '침실', '수납'), desc='침대 머리맡 곁의 서랍 수납. 위에 탁상 물건을 놓는다.')
def h2_bed_side(c):
    box(c, 1, 3, 14, 13, 'ita', 5, hi=3, mid=1, lo=-1)
    c.HL(2, 9, 12, kc('ita', -1)); c.HL(2, 10, 12, kc('ita', 0))              # 서랍 사이 줄눈
    c.HL(2, 13, 12, kc('ita', -1))
    c.R(7, 8, 2, 1, kc('tekko', 3)); c.R(7, 12, 2, 1, kc('tekko', 3))
    c.VL(2, 7, 7, kc('ita', 2))


# ───────────────── 목조 아파트(6조) ─────────────────
@R.obj('h2-old-sink', '낡은 싱크와 1구 레인지', 2, 1, up=0, kind='wall', use=('open',), place='목조 아파트 부엌 벽쪽',
       pair=('h2-old-fridge',), tags=('목조아파트', '부엌', '싱크', '가스레인지'),
       desc='스테인리스 작은 싱크와 1구 가스 레인지가 붙은 낡은 주방대.')
def h2_old_sink(c):
    # 낮은 주방대 3/4: 스테인리스 윗면(싱크 구덩이·수전·1구 화구) + 앞면 수납문 두 짝
    box(c, 0, 3, 32, 13, 'conc', 6, hi=4, mid=1, lo=-2)
    c.HL(1, 4, 30, kc('tekko', 4))                                                              # 윗면 앞쪽 하이라이트
    c.R(2, 5, 12, 4, OL); c.R(3, 6, 10, 2, kc('tekko', -2)); c.HL(3, 5, 10, kc('tekko', 1))     # 싱크 구덩이
    c.HL(3, 8, 10, kc('tekko', 2))                                                              # 싱크 앞림
    c.R(7, 4, 3, 1, OL); c.R(8, 4, 1, 1, kc('tekko', 4)); px(c, 9, 5, kc('tekko', 3))           # 수전
    disc(c, 23, 7, 4.4, 2.6, OL); disc(c, 23, 7, 3.6, 2.0, kc('tekko', -2))
    c.HL(20, 7, 7, kc('tekko', 1)); px(c, 23, 6, kc('tekko', 3)); px(c, 22, 7, kc('aka', 3))    # 화구
    px(c, 28, 6, kc('aka', 2)); px(c, 28, 7, kc('tekko', 3))                                    # 다이얼
    c.HL(1, 9, 30, kc('conc', -1))                                                              # 윗면 아랫선(앞면 시작)
    c.VL(16, 10, 5, OL)
    for x0 in (1, 17):                                                                          # 수납 문
        c.R(x0 + 1, 11, 13, 3, kc('conc', 2)); c.VL(x0 + 1, 11, 3, kc('conc', 3)); c.VL(x0 + 13, 11, 3, kc('conc', 0))
        c.R(x0 + (11 if x0 == 1 else 2), 11, 1, 2, kc('tekko', 3))


@R.obj('h2-old-fridge', '작은 2도어 냉장고', 1, 1, up=16, kind='wall', use=('open',), place='목조 아파트 부엌 옆',
       pair=('h2-old-sink',), tags=('목조아파트', '냉장고', '부엌'), desc='낡은 흰 2도어 소형 냉장고. 위가 냉동실.')
def h2_old_fridge(c):
    c.R(1, 3, 14, 29, OL)
    for y in range(4, 31):
        for x in range(2, 14):
            if y <= 6: v = 4 if y == 4 else 3                 # 윗면
            elif y == 7: v = 0                                # 처마 그늘
            else: v = 2
            if y > 7 and x == 2: v = 3
            if y > 7 and x == 13: v = 1
            c.P(x, y, kc('kinari', v))
    c.HL(2, 15, 12, kc('tekko', -2)); c.HL(2, 16, 12, kc('kinari', 0))            # 냉동/냉장 도어 사이 홈
    c.HL(2, 30, 12, kc('kinari', 0))
    c.R(11, 9, 1, 4, kc('tekko', 2)); c.R(11, 18, 1, 6, kc('tekko', 2))           # 손잡이
    c.R(3, 28, 3, 2, kc('tekko', -1)); c.R(10, 28, 3, 2, kc('tekko', -1))         # 발
    c.R(4, 19, 2, 2, kc('aka', 1)); c.P(4, 19, kc('aka', 3))                       # 자석 한 개


@R.obj('h2-cardboard', '쌓아 둔 박스', 1, 1, up=0, kind='floor', use=('block',), place='목조 아파트 구석', tags=('박스', '짐', '목조아파트'),
       desc='골판지 박스 두 개를 쌓아 둔 것.')
def h2_cardboard(c):
    ix, iy, iw, ih = box(c, 1, 8, 14, 8, 'soil', 3, hi=4, mid=2, lo=0)
    c.HL(3, 9, 10, kc('kinari', 3))                                                  # 테이프
    box(c, 3, 1, 11, 8, 'soil', 3, hi=4, mid=2, lo=0)
    c.VL(8, 2, 3, kc('kinari', 3)); c.HL(4, 5, 9, kc('soil', 1))


@R.obj('h2-hanger-rail', '옷 걸린 행거', 1, 1, up=16, kind='wall', use=('search',), place='목조 아파트 벽쪽',
       tags=('목조아파트', '행거', '옷'), desc='봉 하나에 셔츠·재킷이 걸린 간이 행거.')
def h2_hanger(c):
    # 봉 윗면 + 두 다리 + 걸린 옷 둘(밝은 셔츠·짙은 바지) — 다리 사이는 비워 둔다
    c.R(0, 2, 16, 4, OL); c.HL(1, 3, 14, kc('tekko', 4)); c.HL(1, 4, 14, kc('tekko', 2))
    for x0 in (0, 14): c.R(x0, 5, 2, 26, OL); c.VL(x0 + (1 if x0 == 0 else 0), 6, 24, kc('tekko', 2))
    c.HL(0, 31, 16, OL)
    def cloth(x, w, h, ramp, hi):
        c.R(x, 6, w, 3, OL); c.R(x + 1, 6, w - 2, 2, kc(ramp, hi))                  # 어깨
        c.R(x, 8, w, h, OL); c.R(x + 1, 8, w - 2, h - 1, kc(ramp, hi - 1))
        c.VL(x + 1, 8, h - 1, kc(ramp, hi)); c.VL(x + w - 2, 9, h - 2, kc(ramp, hi - 3))
    cloth(3, 5, 13, 'shiro', 3)
    cloth(9, 5, 18, 'aka', 3)


@R.obj('h2-futon-dry', '창가에 넌 이불', 2, 1, kind='hang', hrows=2, place='창 아래 벽면(목조 아파트)', tags=('목조아파트', '이불', '창'),
       desc='베란다 봉에 널어 말리는 이불. 창 앞 벽면에 건다.')
def h2_futon_dry(c):
    # 봉에 두 겹으로 접혀 걸린 이불: 크림색 겉감 + 하늘색 줄무늬 단 + 누빔 점선, 빨래집게 둘
    c.R(0, 3, 32, 3, OL); c.HL(1, 4, 30, kc('tekko', 4)); c.HL(1, 5, 30, kc('tekko', 2))     # 봉
    c.R(3, 6, 26, 24, OL)
    for y in range(7, 29):
        for x in range(4, 28):
            v = 3 if y < 13 else 2
            if y == 13: v = 0
            if x == 4: v += 1
            if x == 27: v -= 1
            c.P(x, y, kc('kinari', v))
    for y in (22, 23): c.HL(4, y, 24, kc('sora', 2 if y == 22 else 1))                      # 줄무늬 단
    for y in range(16, 22, 3):
        for x in range(7, 27, 4): px(c, x, y, kc('kinari', -1))                              # 누빔 점선
    c.HL(4, 28, 24, kc('kinari', -2))
    for x in (7, 22): c.R(x, 3, 3, 6, OL); c.R(x + 1, 4, 1, 4, kc('daidai', 3))              # 빨래집게


# ───────────────── 단층 옛집(平屋) ─────────────────
@R.obj('h2-garden-step', '디딤돌', 1, 1, up=0, kind='flat', walk=((0, 0),), place='툇마루 앞', pair=('h2-engawa',), tags=('옛집', '정원', '디딤돌'),
       desc='툇마루 앞 둥근 디딤돌. 밟고 지나간다.')
def h2_step(c):
    disc(c, 8, 8, 6.4, 5.0, OL); disc(c, 8, 8, 5.6, 4.2, kc('conc', 1))
    disc(c, 7, 7, 3.6, 2.6, kc('conc', 2)); px(c, 5, 6, kc('conc', 3)); px(c, 6, 5, kc('conc', 3))
    disc(c, 10, 10, 1.6, 1.0, kc('conc', 0)); px(c, 11, 6, kc('midori', 1)); px(c, 12, 7, kc('midori', 0)); px(c, 4, 10, kc('midori', 1))


@R.obj('h2-shoji-door', '장지문 문턱', 1, 1, up=0, kind='flat', walk=((0, 0),), use=('open',), place='다다미 방 사이 칸막이 틈',
       tags=('옛집', '장지', '문턱'), desc='장지문 열린 틈의 나무 문턱(가모이). 홈 두 줄. 칸막이 틈 한 칸에 깐다.')
def h2_shoji(c):
    # 위에서 본 장지문 문턱: 양옆 나무 문틀 + 가운데 창호지(밝은 종이) 격자
    c.R(0, 0, 3, 16, OL); c.VL(1, 0, 16, kc('ita', 2)); c.VL(2, 0, 16, kc('ita', 0))
    c.R(13, 0, 3, 16, OL); c.VL(13, 0, 16, kc('ita', 1)); c.VL(14, 0, 16, kc('ita', -1))
    c.R(3, 0, 10, 16, kc('ita', 1))
    c.HL(3, 3, 10, OL); c.HL(3, 12, 10, OL)
    for y in range(4, 12):
        for x in range(3, 13): c.P(x, y, kc('kinari', 3 if y < 8 else 2))
    c.HL(3, 4, 10, kc('shiro', 4))
    for x in (5, 8, 11): c.VL(x, 4, 8, kc('ita', 2))                  # 살
    c.HL(3, 7, 10, kc('ita', 1)); c.HL(3, 11, 10, kc('ita', -1))


@R.obj('h2-irori', '이로리(화덕)', 1, 1, up=0, kind='floor', use=('light',), place='옛집 마루방 한가운데', tags=('옛집', '화덕', '불'),
       desc='나무 틀 안에 재와 숯불, 쇠 주전자가 걸린 화덕. 불빛이 보인다.')
def h2_irori(c):
    # 나무 틀(윗면 4px + 앞면 3px) 안에 움푹 파인 재 구덩이, 숯불, 쇠 주전자
    c.R(1, 2, 14, 13, OL)
    for y in range(3, 14):
        for x in range(2, 14):
            if y < 7: v = 3 if y == 3 else 2                      # 윗면(밝음)
            else: v = 1 if y < 12 else 0                           # 앞면
            if y >= 7 and x == 2: v += 1
            if y >= 7 and x == 13: v -= 1
            if y == 13: v = -1
            c.P(x, y, kc('ita', v))
    c.R(3, 4, 10, 8, OL)                                           # 구덩이 테두리
    for y in range(5, 11):
        for x in range(4, 12): c.P(x, y, kc('tekko', 0 if y > 5 else -1))   # 재 (위쪽 안벽 그늘)
    for (x, y) in ((5, 8), (10, 9), (6, 10), (9, 7)): px(c, x, y, kc('conc', 1))   # 재 얼룩
    for (x, y) in ((5, 9), (7, 9), (10, 8), (8, 10)): px(c, x, y, kc('yoru', 0))   # 숯
    px(c, 7, 8, kc('daidai', 3)); px(c, 8, 8, kc('aka', 3)); px(c, 9, 9, kc('daidai', 2)); px(c, 6, 9, kc('aka', 2)); px(c, 8, 9, kc('kii', 3))
    disc(c, 8, 6, 3.6, 2.4, OL); disc(c, 8, 6, 2.7, 1.6, kc('tekko', 1))   # 주전자 몸통(위에서 본 둥근 뚜껑)
    c.HL(7, 5, 3, kc('tekko', 3)); px(c, 8, 4, OL); px(c, 8, 3, kc('tekko', -1))
    c.P(12, 6, OL); c.P(13, 6, OL); c.P(12, 5, kc('tekko', 2))     # 주둥이


@R.obj('h2-hibachi', '화로(히바치)', 1, 1, up=0, kind='floor', use=('block',), place='옛집 다다미방', tags=('옛집', '화로', '도기'),
       desc='푸른 무늬 도기 화로. 재와 불씨가 담겼다.')
def h2_hibachi(c):
    # 둥근 도기 화로: 위쪽 타원 주둥이(재+불씨) + 아래 몸통(흰 바탕·푸른 띠) + 굽
    for y in range(7, 14):                                         # 몸통(아래로 둥글게 좁아짐)
        half = 7 if y < 11 else (6 if y < 13 else 5)
        c.R(8 - half - 1, y, 2 * half + 2, 1, OL)
        for x in range(8 - half, 8 + half):
            v = 3 if x < 8 - half + 2 else (1 if x < 8 + half - 3 else -1)
            if y >= 12: v -= 1
            c.P(x, y, kc('shiro', v))
    c.R(3, 13, 10, 1, OL); c.HL(4, 12, 8, kc('shiro', -1))
    for x in range(2, 14):                                         # 푸른 띠
        c.P(x, 9, kc('sora', 1 if x < 10 else 0)); c.P(x, 10, kc('sora', 2 if x < 10 else 1))
    ring(c, 8, 6, 7, 3.4, kc('shiro', 3))                          # 주둥이 둘레
    disc(c, 8, 6.3, 5.2, 2.3, kc('tekko', 0))                      # 재
    for (x, y) in ((6, 5), (10, 7), (11, 6)): px(c, x, y, kc('conc', 1))
    for (x, y) in ((7, 6), (9, 5)): px(c, x, y, kc('yoru', 0))
    px(c, 8, 6, kc('daidai', 3)); px(c, 9, 6, kc('aka', 3)); px(c, 8, 7, kc('daidai', 2))


@R.obj('h2-old-tansu', '층층 장롱(階段箪笥)', 2, 1, up=16, kind='wall', use=('open', 'search'), place='옛집 다다미방 벽',
       tags=('옛집', '장롱', '수납', '階段箪笥'), desc='높이가 다른 두 단의 옛 나무 장롱. 왼쪽이 낮다.')
def h2_old_tansu(c):
    # 왼쪽 낮은 단(y 11~31) · 오른쪽 높은 단(y 1~31)
    for (x0, y0, w, top) in ((0, 11, 16, 4), (16, 1, 16, 5)):
        h = 32 - y0
        c.R(x0, y0, w, h, OL)
        for y in range(y0 + 1, 31):
            for x in range(x0 + 1, x0 + w - 1):
                j = y - (y0 + 1)
                v = (4 if j == 0 else 3) if j < top else (0 if j < top + 2 else 1)
                if j >= top + 2 and x == x0 + 1: v = 2
                c.P(x, y, kc('soil', v))
        c.VL(x0 + w - 2, y0 + top + 2, 31 - (y0 + top + 2), kc('soil', -1))
        c.HL(x0 + 1, 30, w - 2, kc('soil', -1))
        for yy in range(y0 + top + 5, 30, 6):
            c.HL(x0 + 1, yy, w - 2, kc('soil', -1)); c.R(x0 + w // 2 - 1, yy - 3, 2, 1, kc('tekko', 3))
    c.VL(15, 11, 20, OL)


# ───────────────── 탁상 물건 ─────────────────
@R.good('h2-teapot-iron', '철 주전자')
def g_teapot(c):
    disc(c, 8, 8, 5.6, 4.6, OL); disc(c, 8, 8, 4.8, 3.8, kc('tekko', 1)); disc(c, 7, 7, 2.6, 1.8, kc('tekko', 3)); px(c, 6, 6, kc('tekko', 4))
    c.R(6, 3, 5, 2, OL); c.R(7, 3, 3, 1, kc('tekko', 2)); px(c, 8, 2, OL)
    c.R(2, 6, 3, 2, OL); px(c, 3, 6, kc('tekko', 1)); px(c, 1, 5, OL)
    c.R(12, 6, 2, 5, OL); px(c, 12, 7, kc('tekko', 2))
    c.HL(4, 12, 8, OL)


@R.good('h2-potted-herb', '허브 화분')
def g_herb(c):
    for (cx, cy) in ((5, 5), (8, 3.5), (11, 5)): disc(c, cx, cy, 3, 2.8, OL)
    for (cx, cy, v) in ((5, 5, 1), (8, 3.5, 2), (11, 5, 1)): disc(c, cx, cy, 2.2, 2.0, kc('midori', v))
    for (x, y) in ((4, 4), (8, 2), (11, 4)): px(c, x, y, kc('midori', 3))
    c.R(4, 8, 8, 6, OL); c.R(5, 8, 6, 5, kc('renga', 1)); c.HL(5, 8, 6, kc('renga', 3)); c.VL(5, 9, 4, kc('renga', 2))


@R.good('h2-instant-noodle', '컵라면')
def g_noodle(c):
    c.R(3, 3, 10, 2, OL); c.R(4, 3, 8, 1, kc('shiro', 3))                      # 뚜껑 둘레
    c.R(3, 5, 10, 8, OL)
    for y in range(6, 12):
        for x in range(4, 12): c.P(x, y, kc('aka', 2))
    c.HL(4, 6, 8, kc('aka', 3)); c.R(4, 8, 8, 2, kc('kii', 3)); c.VL(4, 6, 6, kc('aka', 3)); c.VL(11, 6, 6, kc('aka', 0))
    c.R(5, 12, 6, 1, kc('shiro', 1)); c.HL(4, 13, 8, OL)
    c.R(12, 1, 1, 4, kc('soil', 2)); c.R(13, 1, 1, 4, OL)                       # 젓가락


@R.good('h2-ashtray-old', '옛 재떨이')
def g_ashtray_old(c):
    disc(c, 8, 9, 6.4, 3.4, OL); disc(c, 8, 8.6, 5.4, 2.8, kc('yuka', 1)); disc(c, 8, 8.4, 3.6, 1.8, kc('tekko', 0))
    c.R(9, 6, 3, 1, kc('shiro', 4)); px(c, 12, 6, kc('aka', 2)); px(c, 6, 8, kc('conc', 2))
    px(c, 3, 7, kc('yuka', 3)); px(c, 4, 6, kc('yuka', 3))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

#!/usr/bin/env python3
"""jp_city 일본 실내 — 상점가(商店街) 작은 가게 블록 interior_shop (id 머리 sh-).
틀: interior/ikit.py(칸 자르기·그림자·통행·사양 굽기는 틀이 한다). 여기는 그림 함수만.
3/4 시점: 가로면은 윗면(밝게, 위 1px 림)+남쪽 앞면. 빛은 왼쪽 위. 색은 K(램프, 단)만, 반투명 없음. 글자·숫자·상표 없음
(메뉴판은 색 띠, 가격표는 색 점). 앞이 트인 가게 — 물건이 입구 쪽으로 쏟아져 나오게 진열대가 낮고 넓다.

크기표(1칸 = 16px = 1m, 윗면 T + 앞면 F 가 발밑 칸 높이를 채운다 — modern-style-bible §12-3)
  계산대 W16(이음 없이 이어짐) T6 F9 (높이 0.9m) · 레지 +W10 H7 (계산대 위로 솟음)
  빵 진열장(벽) W32 H29(1.8m) T4 · 빵 매대 W32 T9 F6 (0.75m) · 오븐 W14 H27 · 쟁반 스탠드 W12 T6 F8
  책장(벽) W14 H29 T4 · 평대 W30 T9 F6 · 섬 서가 W30 H23(1.4m, 양면) 위 간판 띠 5
  약 선반(벽) W14 H29 · 약 섬 W30 H23 · 상담 쇼케이스 W16 T5 F10
  화분 통 계단 W30 H26(뒤 3단 계단식) · 꽃 냉장고(벽) W14 H29 · 화분 W8 H14 · 포장 작업대 W32 T9 F6
  채소 경사 진열대 W30 H24(뒤 높고 앞 낮은 3단) · 과일 상자 W14 T8 F8 · 생선 얼음 W30 T10 F5(스테인리스 트레이)
  이발 의자 W10 F12 T4 + 등받이 H18 · 거울(벽) W15 H29 · 샴푸대(벽) W14 H29 · 대기 벤치 W30 H20 · 사인 폴 W6 H24
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, run_block, ROOT   # noqa
import categories as CATS                           # noqa

BLOCK = 'interior_shop'
R = Registry(BLOCK, '상점')



# ─────────────────────────── 공통 부품 ───────────────────────────
def hs(x, y, s):
    return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xFFFFFF


def rnd(x, y, s, per):
    return hs(x, y, s) % 1000 < per


def box(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def ell(c, cx, cy, rx, ry, ramp, st=0, ol=True):
    """타원 덩이: 왼쪽 위 밝게 오른쪽 아래 어둡게, 가장자리는 어두운 단."""
    def inside(x, y): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if not inside(x, y): continue
            edge = not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            d = ((x + .5 - cx) / rx) + ((y + .5 - cy) / ry)
            s = st + (1 if d < -.5 else -1 if d > .45 else 0)
            if edge and ol: s = st - 2 if d > 0 else st - 1
            c.P(x, y, K(ramp, s))


def slab(c, x, y, w, T, m, l=True, r=True):
    """윗면 T줄: 윗 윤곽 · 림(+3) · 채움(+2). 좌우 끝은 닫을 때만 윤곽."""
    c.HL(x, y, w, K(m, -3)); c.HL(x, y + 1, w, K(m, 3)); c.R(x, y + 2, w, T - 2, K(m, 2))
    if l: c.VL(x, y, T, K(m, -3))
    if r: c.VL(x + w - 1, y, T, K(m, -3))


def cab(c, x, y, w, T, F, m, l=True, r=True, face=0):
    """가구 몸통: 윗면 T + 앞 테두리 하이라이트 1 + 앞면 F(왼쪽 +1, 오른쪽 -1, 바닥 윤곽)."""
    slab(c, x, y, w, T, m, l, r)
    c.HL(x + (1 if l else 0), y + T, w - (1 if l else 0) - (1 if r else 0), K(m, 3))
    fy = y + T + 1
    c.R(x, fy, w, F - 1, K(m, face))
    if l: c.VL(x, fy, F - 1, K(m, face + 1))
    if r: c.VL(x + w - 1, fy, F - 1, K(m, face - 1))
    c.HL(x, y + T + F, w, K(m, -3))
    if l: c.VL(x, y + T, F + 1, K(m, -3))
    if r: c.VL(x + w - 1, y + T, F + 1, K(m, -3))


def shelf(c, x, y, w, hgt, m, levels, filler, T=4, seed=1, back=-2):
    """벽·섬 서가: 윗면 T + 처마 그림자 2px + 안으로 들어간 뒤판 + 선반 판(윗 림·밑 그림자) + 물건."""
    slab(c, x, y, w, T, m)
    fy = y + T
    c.R(x, fy, w, hgt - T, K(m, 0)); c.VL(x, fy, hgt - T, K(m, -3)); c.VL(x + w - 1, fy, hgt - T, K(m, -3))
    c.HL(x + 1, fy, w - 2, K(m, 3))
    c.HL(x + 1, y + hgt - 1, w - 2, K(m, -3)); c.HL(x + 1, y + hgt - 2, w - 2, K(m, -1))          # 받침(걸레받이)
    ix, iw = x + 2, w - 4; iy = fy + 1; ih = hgt - T - 4                                           # 안쪽(뒤판) 영역
    c.R(ix, iy, iw, ih, K(m, back)); c.HL(ix, iy, iw, K(m, -3)); c.HL(ix, iy + 1, iw, K(m, -3))  # 처마 그림자 2px
    c.VL(ix, iy, ih, K(m, -3))
    lv = ih // levels
    for i in range(levels):
        by = iy + (i + 1) * lv - 2                                                                 # 선반 판(2px)
        c.HL(x + 1, by, w - 2, K(m, 2)); c.HL(x + 1, by + 1, w - 2, K(m, -1))
        if filler: filler(c, ix + 1, iy + 2 + i * lv, iw - 2, lv - 4, i, seed)


def tbl_top(c, x, y, w, h, m, st=2):
    c.R(x, y, w, h, K(m, st))


# ─────────────────────────── 채움(진열품) ───────────────────────────
def f_books(c, x0, y0, w, h, lvl, seed):
    # 단마다 비슷한 색 두세 가지만 쓰고, 같은 색 책을 2~3권씩 묶어 한 덩이(2~3px)로 읽히게 한다
    fam = ((('soil', 1), ('soil', 0), ('kinari', 0)), (('sora', -1), ('kon', 0), ('tekko', 1)),
           (('midori', -2), ('midori', -1), ('soil', 0)), (('aka', -2), ('aka', -1), ('soil', 1)))[hs(lvl, seed, 3) % 4]
    x = x0; n = 0
    while x < x0 + w:
        sw = min(2 + hs(x, lvl, seed) % 2, x0 + w - x)
        ramp, st = fam[(n // 2 + hs(lvl, n // 2, seed)) % len(fam)]
        hh = h - (1 if hs(x, lvl, seed + 7) % 4 == 0 else 0)
        top = y0 + h - hh
        c.R(x, top, sw, hh, K(ramp, st)); c.VL(x, top, hh, K(ramp, st + 1)); c.VL(x + sw - 1, top, hh, K(ramp, st - 1))
        n += 1; x += sw


def f_bread(c, x0, y0, w, h, lvl, seed):
    x = x0 + 1
    while x < x0 + w - 2:
        k = hs(x, lvl, seed) % 4
        if k == 0:                                                                                 # 바게트(가로로 누움)
            ell(c, x + 3, y0 + h - 2, 3.4, 1.6, 'daidai', 0)
            x += 7
        elif k == 1:                                                                               # 둥근 빵
            ell(c, x + 2, y0 + h - 2.2, 2.2, 2.1, 'ki', 1)
            x += 5
        elif k == 2:                                                                               # 식빵 덩이
            c.R(x, y0 + h - 4, 5, 4, K('kii', 0)); c.HL(x, y0 + h - 4, 5, K('kii', 2)); c.VL(x + 4, y0 + h - 3, 3, K('daidai', -1)); c.HL(x, y0 + h - 1, 5, K('daidai', -1))
            c.P(x, y0 + h - 4, None)
            x += 6
        else:                                                                                      # 크루아상 같은 초승달
            ell(c, x + 2.5, y0 + h - 2, 2.6, 1.8, 'daidai', 1)
            c.P(x + 2, y0 + h - 4, K('daidai', 2)); x += 6


def f_boxes(c, x0, y0, w, h, lvl, seed):
    # 단마다 상자 색 하나·띠 색 하나로 통일, 폭 4 고정의 규칙적인 줄
    r = ('shiro', 'sora', 'midori', 'pinku', 'shiro')[hs(lvl, seed, 1) % 5]
    ac = ('sora', 'midori', 'kon')[hs(lvl, seed, 6) % 3]
    bh = 5; top = y0 + h - bh
    x = x0
    while x < x0 + w:
        bw = min(4, x0 + w - x)
        c.R(x, top, bw, bh, K(r, 1)); c.HL(x, top, bw, K(r, 2)); c.VL(x + bw - 1, top, bh, K(r, -1)); c.HL(x, top + bh - 1, bw, K(r, -2))
        c.HL(x, top + 2, bw, K(ac, 0))
        x += bw


def f_flowers_cool(c, x0, y0, w, h, lvl, seed):
    cols = (('pinku', 0), ('aka', 0), ('kii', 1), ('murasaki', 0), ('shiro', 1), ('daidai', 0))
    for x in range(x0, x0 + w - 2, 4):
        r, st = cols[hs(x, lvl, seed) % len(cols)]
        c.VL(x + 1, y0 + h - 4, 4, K('midori', -1)); ell(c, x + 1.5, y0 + h - 6, 2.3, 2.1, r, st)
        c.P(x + 1, y0 + h - 7, K(r, st + 2))


def top_lumps(c, x, y, w, h, kinds, seed, size=2.0):
    """윗면에서 본 덩이들(격자 + 흔들림). kinds = ((램프,단),…)"""
    step = int(size * 2)
    for j, yy in enumerate(range(y, y + h - 1, max(step - 1, 3))):
        for i, xx in enumerate(range(x + (step // 2 if j % 2 else 0), x + w - 1, step)):
            r, st = kinds[hs(xx, yy, seed) % len(kinds)]
            ell(c, xx + size, yy + size, size, size * .9, r, st)


# ─────────────────────────── 바닥 ───────────────────────────
@R.floor('sh-concrete', '가게 콘크리트 바닥', cols=4, rows=4, tags=('빵집', '약국', '채소가게', '생선가게', '상점가', '가게'),
         desc='가게 앞 콘크리트 인조석 바닥. 32px 줄눈에 잔돌 점. 조용한 4단 회색이라 진열대 윗면이 더 밝게 읽힌다.')
def _concrete(c):
    for y in range(c.h):
        for x in range(c.w):
            col = K('conc', 1)
            n = hs(x, y, 11) % 100
            if n < 6: col = K('conc', 2)
            elif n < 12: col = K('conc', 0)
            elif n < 14: col = K('conc', -1)
            if x % 32 == 31 or y % 32 == 31: col = K('conc', -1)
            elif x % 32 == 0 or y % 32 == 0: col = K('conc', 2)
            c.P(x, y, col)


@R.floor('sh-wood', '가게 밝은 나무 바닥', cols=4, rows=4, tags=('서점', '꽃집', '이발소', '상점가', '가게'),
         desc='밝은 나무 널 바닥. 8px 널이 줄마다 엇갈리고 결 점이 있다. 서점·꽃집·이발소.')
def _wood(c):
    for y in range(c.h):
        j = y // 8
        for x in range(c.w):
            seg = ((x + j * 11) // 32) % 3
            col = K('yuka', (1, 0, 1)[seg])
            if y % 8 == 0: col = K('yuka', -1)
            elif y % 8 == 1: col = K('yuka', 2)
            elif (x + j * 11) % 32 == 0: col = K('yuka', -1)
            elif rnd(x, y, 21, 35): col = K('yuka', -1 if col == K('yuka', 0) else 0)
            c.P(x, y, col)


@R.wall('sh-white', '가게 흰 벽(나무 걸레받이)', cols=4, tags=('빵집', '약국', '서점', '꽃집', '이발소', '가게'),
        desc='밝은 흰 벽. 위 줄은 밝고 아래 줄은 한 단 어둡고, 굵은 나무 걸레받이가 붙는다.')
def _white(c):
    for y in range(32):
        for x in range(c.w):
            col = K('shiro', 1) if y < 16 else K('shiro', 0)
            if y == 16: col = K('shiro', -1)
            elif rnd(x, y, 31, 40): col = K('shiro', 2) if y < 16 else K('shiro', 1)
            c.P(x, y, col)
    for x in range(c.w):
        c.P(x, 26, K('shiro', -2))
        c.P(x, 27, K('ita', 2)); c.P(x, 28, K('ita', 1)); c.P(x, 29, K('ita', 0)); c.P(x, 30, K('ita', 0)); c.P(x, 31, K('ita', -2))


# ─────────────────────────── 공통 ───────────────────────────
def counter_body(c, y0):
    """이어붙는 계산대 한 칸. y0 = 윗면 첫 줄. 좌우 윤곽 없음(옆 칸과 이음 없음)."""
    cab(c, 0, y0, 16, 6, 9, 'ki', l=False, r=False, face=0)
    c.R(0, y0 + 2, 16, 4, K('shiro', 2)); c.HL(0, y0 + 1, 16, K('shiro', 3)); c.HL(0, y0 + 5, 16, K('shiro', 0))    # 흰 라미네이트 윗면
    c.HL(0, y0, 16, K('ki', -3))
    c.R(2, y0 + 9, 12, 5, K('ki', -1)); c.HL(2, y0 + 9, 12, K('ki', -3)); c.HL(2, y0 + 14, 12, K('ki', 1)); c.VL(2, y0 + 10, 4, K('ki', -2))   # 앞 판넬


@R.obj('sh-counter', '계산대', 1, 1, up=0, kind='floor', surface=True, use=('counter',),
       desc='가게 계산대 한 칸. 흰 라미네이트 윗면에 나무 앞판, 좌우 이음 없이 한 줄로 이어 붙는다. 윗면에 레지·진열품을 놓는다.',
       tags=('계산대', '가게', '빵집', '서점', '약국', '꽃집', '채소가게'), place='가게 입구 쪽 가로로 2~4칸 이어서, 직원 쪽 통로를 한 칸 남긴다', pair=('sh-register',))
def sh_counter(c): counter_body(c, 1)


@R.obj('sh-register', '계산대(레지)', 1, 1, up=16, kind='floor', surface=False, use=('counter',),
       desc='계산대 한 칸 위에 금전등록기. 검은 본체에 밝은 청색 화면, 키패드 색 점, 아래 서랍. 계산대 줄의 끝에 둔다.',
       tags=('계산대', '레지', '가게'), place='계산대 줄 한쪽 끝 칸에 sh-counter 대신', pair=('sh-counter',))
def sh_register(c):
    counter_body(c, 17)
    c.R(3, 9, 10, 7, K('tekko', -1)); box(c, 3, 9, 10, 7, K('yoru', -2)); c.HL(4, 10, 8, K('tekko', 1))                  # 본체
    c.R(4, 4, 7, 5, K('yoru', -2)); box(c, 4, 4, 7, 5, K('yoru', -3)); c.R(5, 5, 5, 3, K('sora', 2)); c.HL(5, 5, 5, K('sora', 3))    # 화면
    for i, col in enumerate((K('aka', 0), K('kii', 0), K('midori', 0), K('conc', 2))): c.R(4 + i * 2 + (i // 2), 11, 1, 1, col)
    c.HL(5, 13, 6, K('conc', 1)); c.HL(4, 15, 8, K('tekko', 2))


def threshold(c, w):
    W = w * 16
    c.R(0, 4, W, 8, K('conc', 1)); c.HL(0, 3, W, K('conc', -2)); c.HL(0, 4, W, K('conc', 3)); c.HL(0, 11, W, K('conc', -2)); c.HL(0, 12, W, K('yoru', 0))
    c.HL(0, 7, W, K('tekko', 0)); c.HL(0, 8, W, K('conc', 2))                                                        # 셔터 홈
    for x in range(2, W, 8): c.P(x, 5, K('conc', -1)); c.P(x, 10, K('conc', -1))                                       # 나사 점
    c.R(0, 5, 2, 6, K('tekko', 1)); c.R(W - 2, 5, 2, 6, K('tekko', -1))


@R.obj('sh-shutter', '셔터 문턱(3칸)', 3, 1, up=0, kind='flat', desc='걷어올린 셔터가 내려오는 가게 앞 문턱. 금속 판에 가운데 홈 두 줄과 나사 점. 걸어 지나간다.',
       tags=('셔터', '문턱', '가게', '상점가'), place='가게 앞 개구부 한 줄(3칸)에', pair=('sh-shutter-2',))
def sh_shutter(c): threshold(c, 3)


@R.obj('sh-shutter-2', '셔터 문턱(2칸)', 2, 1, up=0, kind='flat', desc='셔터 문턱 2칸짜리. 좁은 가게 앞.',
       tags=('셔터', '문턱', '가게'), place='가게 앞 개구부 두 칸에', pair=('sh-shutter',))
def sh_shutter2(c): threshold(c, 2)


@R.obj('sh-wall-shelf', '벽 선반(빈 것)', 1, 1, up=16, kind='wall', use=('search',),
       desc='나무 벽 선반 3단. 비어 있어 가게마다 물건을 놓아 쓴다. 빵·책·약 선반과 같은 높이로 이어진다.',
       tags=('선반', '가게'), place='북쪽 벽면 아래, 다른 가게 선반 옆에', pair=('sh-bread-shelf', 'sh-bookshelf', 'sh-drug-shelf'))
def sh_wall_shelf(c): shelf(c, 0, 3, 16, 29, 'ki', 3, None)


# ─────────────────────────── 빵집 ───────────────────────────
@R.obj('sh-bread-shelf', '빵 진열장', 2, 1, up=16, kind='wall', use=('search',),
       desc='2칸 벽 진열장. 3단 선반에 바게트·둥근 빵·식빵·초승달 빵 덩이가 가득하다. 앞 매대와 같은 갈색 빵 색.',
       tags=('빵집', '진열', '빵'), place='북쪽 벽면 아래 2칸, 앞에 빵 매대', pair=('sh-bread-table', 'sh-oven'))
def sh_bread_shelf(c): shelf(c, 0, 3, 32, 29, 'ki', 3, f_bread, seed=3)


@R.obj('sh-bread-table', '빵 매대', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='낮은 매대 2칸. 윗면에서 본 빵 쟁반 두 개(갈색 덩이)와 나무 앞판. 입구 쪽으로 내놓는다.',
       tags=('빵집', '매대', '빵'), place='가게 가운데·입구 쪽, 계산대 앞', pair=('sh-bread-shelf', 'sh-tray-stand'))
def sh_bread_table(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    for x0 in (2, 17):
        c.R(x0, 3, 13, 6, K('conc', 1)); box(c, x0, 3, 13, 6, K('conc', -2)); c.HL(x0 + 1, 3, 11, K('conc', 3))              # 쟁반
        top_lumps(c, x0 + 1, 4, 11, 5, (('daidai', 0), ('ki', 1), ('kii', 0), ('daidai', 1)), 5 + x0, 1.7)
    c.HL(2, 12, 28, K('ki', -1)); c.HL(2, 13, 28, K('ki', 1))


@R.obj('sh-tray-stand', '쟁반 스탠드', 1, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='쟁반과 집게를 쌓아 둔 작은 스탠드. 쌓인 갈색 쟁반 더미와 집게.', tags=('빵집', '쟁반', '집게'), place='빵 매대·계산대 옆', pair=('sh-bread-table',))
def sh_tray_stand(c):
    cab(c, 1, 3, 14, 6, 7, 'conc', face=0)
    for cy, st in ((7.4, -1), (6.4, 0), (5.4, 1), (4.4, 1)):                                                                  # 쌓인 갈색 쟁반 원판
        ell(c, 6.5, cy, 4.4, 1.9, 'soil', st)
    c.HL(4, 4, 5, K('soil', 3))
    for i in range(5):                                                                                                         # 집게: 두 날이 X 로 겹친 쇠
        c.P(10 + i, 7 - (i if i < 3 else 4 - i), K('tekko', 2)); c.P(10 + i, 5 + (i if i < 3 else 4 - i), K('tekko', -1))
    c.P(12, 6, K('conc', 3)); c.P(10, 5, K('tekko', 3)); c.P(10, 7, K('tekko', 3))


@R.obj('sh-oven', '오븐', 1, 1, up=16, kind='wall', surface=False, use=('search',),
       desc='스테인리스 오븐. 유리창 속에 주황색 불빛과 빵 줄, 위에 환기 홈, 아래 다이얼 점.', tags=('빵집', '오븐'), place='북쪽 벽면 아래, 빵 진열장 옆', pair=('sh-bread-shelf',))
def sh_oven(c):
    cab(c, 0, 3, 16, 5, 24, 'conc', face=0)
    for x in range(2, 14, 2): c.P(x, 5, K('conc', -2))
    c.R(2, 11, 12, 11, K('yoru', -2)); box(c, 2, 11, 12, 11, K('tekko', 1)); c.R(3, 12, 10, 9, K('daidai', 1))
    c.HL(3, 12, 10, K('daidai', 2)); c.HL(3, 20, 10, K('daidai', -1))
    for y in (14, 17): c.HL(3, y, 10, K('tekko', -1)); c.HL(4, y - 1, 8, K('kii', 1))                                      # 빵 줄
    c.VL(4, 13, 7, K('kii', 3)); c.R(11, 24, 2, 2, K('aka', 0)); c.R(4, 24, 2, 2, K('kii', 0)); c.R(7, 24, 2, 2, K('sora', 0))
    c.HL(2, 27, 12, K('conc', 3))


# ─────────────────────────── 서점 ───────────────────────────
@R.obj('sh-bookshelf', '서가(서점)', 1, 1, up=16, kind='wall', use=('search', 'read'),
       desc='서점 벽 서가. 집 책장보다 책등이 촘촘하고 4단. 다양한 색 책등 줄(띠는 글자가 아니다).',
       tags=('서점', '서가', '책'), place='북쪽 벽면 아래 여러 칸 이어서', pair=('sh-book-table', 'sh-book-island'))
def sh_bookshelf(c): shelf(c, 0, 3, 16, 29, 'ki', 4, f_books, seed=7)


@R.obj('sh-book-table', '평대(서점)', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='책을 눕혀 표지를 보이는 평대 2칸. 위에서 본 표지 색 칸 줄과 나무 앞판.', tags=('서점', '평대', '책'), place='가게 가운데 입구 쪽', pair=('sh-bookshelf',))
def sh_book_table(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    pal = (('aka', 0), ('sora', 0), ('kii', 0), ('midori', 0), ('murasaki', 0), ('shiro', 0), ('daidai', 0), ('pinku', 0))
    for j in range(2):
        for i in range(6):
            r, st = pal[hs(i, j, 41) % len(pal)]
            x, y = 2 + i * 5, 3 + j * 3 - (0 if j else 0)
            c.R(x, y, 4, 3, K(r, st)); c.HL(x, y, 4, K(r, st + 2)); c.VL(x, y, 3, K(r, st + 1)); c.HL(x, y + 2, 4, K(r, st - 2))
    c.R(2, 9, 28, 1, K('ki', 3))
    c.HL(2, 12, 28, K('ki', -1)); c.HL(2, 13, 28, K('ki', 1))


def island(c, filler, levels, seed, band, m='ki'):
    """양면 섬 서가 2×1: 윗 간판 띠(색 띠) + 서가."""
    c.R(0, 4, 32, 5, K(band, 0)); box(c, 0, 4, 32, 5, K(band, -3)); c.HL(1, 5, 30, K(band, 3)); c.HL(1, 7, 30, K(band, -1))
    for x in range(3, 29, 6): c.R(x, 6, 3, 1, K('shiro', 1))                                                              # 색 띠 장식(글자 아님)
    shelf(c, 0, 9, 32, 23, m, levels, filler, T=3, seed=seed)


@R.obj('sh-book-island', '양면 서가(서점)', 2, 1, up=16, kind='floor', use=('search', 'read'),
       desc='서점 가운데 섬 서가 2칸. 양면 책 선반에 위에 색 간판 띠. 벽 서가보다 낮다(1.4m).', tags=('서점', '섬', '서가', '책'), place='가게 가운데, 앞뒤로 한 칸씩 비워서', pair=('sh-bookshelf',))
def sh_book_island(c): island(c, f_books, 3, 9, 'sora')


# ─────────────────────────── 약국 ───────────────────────────
@R.obj('sh-drug-shelf', '약 선반', 1, 1, up=16, kind='wall', use=('search',),
       desc='약국 벽 선반. 작은 약 상자(흰·청·녹·분홍) 줄이 5단 빽빽하다. 상자 가운데에 색 띠(글자 아님).', tags=('약국', '약', '선반'), place='북쪽 벽면 아래 여러 칸', pair=('sh-drug-island', 'sh-consult'))
def sh_drug_shelf(c): shelf(c, 0, 3, 16, 29, 'shiro', 5, f_boxes, seed=11, back=-1)


@R.obj('sh-drug-island', '약 섬 선반', 2, 1, up=16, kind='floor', use=('search',),
       desc='약국 가운데 양면 섬 선반 2칸. 위에 초록 간판 띠, 약 상자가 3단.', tags=('약국', '섬', '약'), place='가게 가운데', pair=('sh-drug-shelf',))
def sh_drug_island(c): island(c, f_boxes, 3, 13, 'midori', 'shiro')


@R.obj('sh-consult', '상담 쇼케이스', 1, 1, up=0, kind='floor', surface=True, use=('counter',),
       desc='유리 진열 겸 상담 카운터. 흰 윗면, 앞이 유리라 안에 약 상자와 병이 보인다.', tags=('약국', '상담', '쇼케이스'), place='약국 입구 쪽, 계산대 옆', pair=('sh-counter',))
def sh_consult(c):
    cab(c, 0, 1, 16, 5, 10, 'conc', face=0)
    c.R(1, 2, 14, 3, K('shiro', 2)); c.HL(1, 1, 14, K('shiro', 3))
    c.R(2, 8, 12, 6, K('garasu', 2)); box(c, 2, 8, 12, 6, K('tekko', 1)); c.HL(3, 8, 10, K('garasu', 3))
    for i, r in enumerate(('sora', 'midori', 'pinku')): c.R(3 + i * 4, 10, 3, 3, K(r, 1)); c.HL(3 + i * 4, 10, 3, K(r, 2))
    c.P(12, 9, K('shiro', 3))


# ─────────────────────────── 꽃집 ───────────────────────────
FL = (('pinku', 0), ('aka', 0), ('kii', 1), ('murasaki', 0), ('shiro', 1), ('daidai', 0), ('pinku', 1), ('sora', 1))


def bucket_tier(c, x, y, w, seed, st):
    """계단 한 단: 양동이 줄(앞면) + 꽃 덩이(윗)."""
    for k, xx in enumerate(range(x, x + w, 8)):
        c.R(xx, y + 6, 8, 5, K('conc', 0)); c.VL(xx, y + 6, 5, K('conc', 2)); c.VL(xx + 7, y + 6, 5, K('conc', -2)); c.HL(xx, y + 6, 8, K('conc', 3)); c.HL(xx, y + 10, 8, K('tekko', -1))
        c.HL(xx, y + 7, 8, K('tekko', 1))
        for t in range(3):
            r, s = FL[hs(xx + t, st, seed) % len(FL)]
            c.VL(xx + 2 + t * 2, y + 4, 3, K('midori', -1)); ell(c, xx + 2.5 + t * 2, y + 2.5, 2.4, 2.2, r, s)


@R.obj('sh-flower-buckets', '꽃 양동이 계단', 2, 1, up=16, kind='floor', use=('search',),
       desc='꽃집 앞 3단 계단 진열 2칸. 단마다 양철 양동이와 색색 꽃 덩이, 줄기가 보인다. 뒤가 높고 앞이 낮다.',
       tags=('꽃집', '꽃', '양동이'), place='가게 입구 쪽 가운데, 앞뒤로 비워서', pair=('sh-flower-cooler', 'sh-wrap-table'))
def sh_flower_buckets(c):
    for t in range(3):
        y = 3 + t * 8
        c.R(0, y + 9, 32, 5 if t == 2 else 3, K('ki', 0)); c.HL(0, y + 9, 32, K('ki', 2)); c.VL(0, y + 9, 5, K('ki', -3)); c.VL(31, y + 9, 5, K('ki', -3))    # 계단 널
        bucket_tier(c, 0, y, 32, 20 + t, t)
    c.HL(0, 31, 32, K('ki', -3)); c.HL(0, 30, 32, K('ki', -1))


@R.obj('sh-flower-cooler', '꽃 냉장고', 1, 1, up=16, kind='wall', use=('search',),
       desc='유리문 꽃 냉장고. 흰 틀에 하늘색 유리, 안에 꽃 줄기와 꽃 덩이가 두 단.', tags=('꽃집', '냉장고', '꽃'), place='북쪽 벽면 아래', pair=('sh-flower-buckets',))
def sh_flower_cooler(c):
    cab(c, 0, 3, 16, 4, 25, 'shiro', face=0)
    c.R(2, 9, 12, 20, K('garasu', 1)); box(c, 2, 9, 12, 20, K('conc', -1)); c.HL(3, 10, 10, K('garasu', 3)); c.VL(3, 10, 17, K('garasu', 2))
    c.HL(3, 18, 10, K('conc', 1))
    f_flowers_cool(c, 3, 11, 10, 7, 0, 5); f_flowers_cool(c, 3, 19, 10, 8, 1, 6)
    c.R(12, 18, 1, 3, K('conc', 3)); c.HL(2, 29, 12, K('conc', -2))


@R.obj('sh-plant-pot', '화분', 1, 1, up=16, kind='floor', use=('block',),
       desc='토분에 심은 잎 식물. 6장 잎이 위로 퍼지고 굵은 흙 점. 가게 앞·계산대 옆 장식.', tags=('꽃집', '화분', '식물'), place='가게 앞·구석', pair=('sh-flower-buckets',))
def sh_plant_pot(c):
    c.R(4, 24, 8, 7, K('renga', 0)); c.HL(3, 24, 10, K('renga', 2)); c.VL(4, 25, 6, K('renga', 1)); c.VL(11, 25, 6, K('renga', -1)); c.HL(4, 30, 8, K('renga', -3))
    c.HL(5, 25, 6, K('soil', -1))
    for (x, y, rx, ry, s) in ((5, 20, 3, 2.6, 0), (11, 19, 3, 2.6, 0), (8, 14, 3, 3.4, 1), (4, 15, 2.4, 3, -1), (12, 14, 2.4, 3, 0), (8, 21, 2.4, 2.4, 1)):
        ell(c, x, y, rx, ry, 'midori', s)
    c.VL(8, 21, 4, K('midori', -2))


@R.obj('sh-wrap-table', '포장 작업대', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='꽃 포장 작업대 2칸. 나무 윗면에 갈색 포장지 한 장, 분홍 리본 실패, 가위 자국. 앞은 서랍 선.',
       tags=('꽃집', '포장', '작업대'), place='꽃집 계산대 안쪽 또는 옆', pair=('sh-flower-buckets', 'sh-counter'))
def sh_wrap_table(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    c.R(3, 3, 14, 6, K('kinari', 2)); box(c, 3, 3, 14, 6, K('kinari', -1)); c.HL(4, 3, 12, K('kinari', 3)); c.HL(5, 6, 10, K('kinari', 1))
    ell(c, 23, 5.5, 3, 2.6, 'pinku', 0); c.P(23, 5, K('conc', 1)); ell(c, 28, 6, 2, 2, 'sora', 0)
    c.HL(2, 12, 28, K('ki', -1)); c.VL(15, 11, 4, K('ki', -2)); c.P(14, 13, K('conc', 2)); c.P(17, 13, K('conc', 2))


# ─────────────────────────── 채소·생선 ───────────────────────────
VEG = (('midori', 0), ('aka', 0), ('daidai', 0), ('midori', 1), ('kii', 0), ('murasaki', -1))


@R.obj('sh-veg-stand', '채소 경사 진열대', 2, 1, up=16, kind='floor', use=('search',),
       desc='채소가게 3단 경사 진열대 2칸. 뒤 단이 높고 앞 단이 낮아 입구 쪽으로 쏟아져 나온다. 광주리마다 초록·빨강·주황 채소 덩이.',
       tags=('채소가게', '진열대', '채소'), place='가게 앞 입구 쪽, 가장 바깥에', pair=('sh-fruit-box', 'sh-scale'))
def sh_veg_stand(c):
    for t in range(3):
        y = 4 + t * 8
        c.R(0, y + 5, 32, 3 + (2 if t == 2 else 0), K('ki', 0 if t < 2 else -1)); c.HL(0, y + 5, 32, K('ki', 3)); c.VL(0, y + 5, 3 + (2 if t == 2 else 0), K('ki', -3)); c.VL(31, y + 5, 5, K('ki', -3))
        c.R(1, y, 30, 6, K('ki', -2)); c.HL(1, y, 30, K('ki', -3))
        top_lumps(c, 1, y + 1, 30, 5, VEG, 30 + t * 5, 2.2)
        c.HL(0, y + 6, 32, K('ki', 2)); c.HL(0, y + 7 + (2 if t == 2 else 0), 32, K('ki', -3))
    c.R(1, 28, 3, 3, K('ki', -2)); c.R(28, 28, 3, 3, K('ki', -2))


@R.obj('sh-fruit-box', '과일 상자', 1, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='나무 과일 상자 한 칸. 위에서 본 사과·귤·레몬 덩이와 나무 널 앞면.', tags=('채소가게', '과일', '상자'), place='채소 진열대 곁·입구 앞', pair=('sh-veg-stand',))
def sh_fruit_box(c):
    cab(c, 1, 2, 14, 8, 6, 'ki', face=0)
    c.R(2, 3, 12, 6, K('ki', -2)); top_lumps(c, 2, 3, 12, 6, (('aka', 0), ('daidai', 0), ('kii', 0), ('midori', 0)), 51, 1.8)
    c.HL(2, 12, 12, K('ki', -1)); c.HL(2, 13, 12, K('ki', 1))


@R.obj('sh-fish-ice', '생선 얼음 진열', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='생선가게 스테인리스 트레이 2칸. 하얀 얼음 위에 은빛 생선이 줄지어 눕고, 앞은 스테인리스 판.', tags=('생선가게', '얼음', '생선'), place='가게 입구 쪽 가운데', pair=('sh-scale',))
def sh_fish_ice(c):
    cab(c, 0, 1, 32, 10, 5, 'conc', face=1)
    c.R(1, 2, 30, 8, K('shiro', 2))
    for y in range(2, 10):
        for x in range(1, 31):
            if rnd(x, y, 61, 120): c.P(x, y, K('sora', 2))
            elif rnd(x, y, 62, 70): c.P(x, y, K('shiro', 3))
    for k, (x, y) in enumerate(((3, 4), (12, 4), (21, 4), (8, 7), (17, 7), (25, 7))):
        c.R(x, y, 6, 2, K('conc', 2)); c.HL(x, y - 1, 5, K('sora', -1)); c.HL(x, y, 6, K('conc', 3)); c.HL(x + 1, y + 2, 5, K('conc', 0)); c.P(x + 1, y, K('yoru', -2))
        c.P(x + 6, y, K('conc', 1)); c.P(x + 7, y - 1, K('conc', 0)); c.P(x + 7, y + 1, K('conc', 0))
    c.HL(1, 11, 30, K('conc', 3))


# ─────────────────────────── 이발소 ───────────────────────────
def barber_chair(c, d):
    red = lambda s: K('aka', s - 1)
    ch = lambda s: K('conc', s)
    if d == 's':          # 남쪽을 봄: 등받이 뒤 + 팔걸이 + 앞 발받침
        c.R(4, 4, 8, 6, red(0)); box(c, 4, 4, 8, 6, red(-3)); c.HL(5, 5, 6, red(2))                                  # 머리받침
        c.R(3, 10, 10, 10, red(0)); box(c, 3, 10, 10, 10, red(-3)); c.VL(4, 11, 8, red(2)); c.HL(5, 12, 6, red(1))
        c.R(2, 16, 2, 6, ch(1)); c.R(12, 16, 2, 6, ch(-1)); c.HL(2, 16, 2, ch(3)); c.HL(12, 16, 2, ch(2))                  # 팔걸이
        c.R(4, 20, 8, 4, red(1)); c.HL(4, 20, 8, red(3)); c.HL(4, 23, 8, red(-2)); box(c, 4, 20, 8, 4, red(-3)); c.HL(5, 20, 6, red(3))
        c.R(7, 24, 2, 4, ch(0)); c.HL(4, 27, 8, ch(2)); c.HL(4, 28, 8, ch(-1))                                           # 기둥·발받침
        c.R(4, 29, 8, 2, ch(1)); c.HL(4, 29, 8, ch(3)); c.HL(4, 31, 8, K('yoru', 0))
    elif d == 'n':        # 북쪽을 봄: 등 뒤 — 큰 등받이 뒷면
        c.R(4, 3, 8, 4, red(1)); box(c, 4, 3, 8, 4, red(-3)); c.HL(5, 4, 6, red(3))
        c.R(3, 7, 10, 15, red(0)); box(c, 3, 7, 10, 15, red(-3)); c.VL(4, 8, 13, red(2)); c.VL(11, 8, 13, red(-1)); c.HL(5, 11, 6, red(-1)); c.HL(5, 16, 6, red(-1))
        c.R(2, 16, 2, 5, ch(1)); c.R(12, 16, 2, 5, ch(-1))
        c.R(7, 22, 2, 6, ch(0)); c.VL(7, 22, 6, ch(2)); c.VL(8, 22, 6, ch(-2))
        c.R(4, 28, 8, 3, ch(1)); c.HL(4, 28, 8, ch(3)); c.HL(4, 30, 8, K('yoru', 0)); c.HL(5, 31, 6, K('yoru', -2))
    else:                 # 옆 모습 L자: e = 등받이 서쪽, w = 등받이 동쪽
        e = d == 'e'
        f = (lambda x: x) if e else (lambda x: 15 - x)
        def R(x0, y0, w, h, col):
            xs = [f(x0 + i) for i in range(w)]; c.R(min(xs), y0, w, h, col)
        def V(x0, y0, h, col): c.VL(f(x0), y0, h, col)
        R(2, 6, 4, 18, red(0)); R(2, 6, 4, 1, red(2)); V(2, 6, 18, red(-3)); V(5, 7, 17, red(-2)) if e else V(5, 7, 17, red(-2))
        V(3, 8, 14, red(2))                                                                                                  # 등받이(빛 쪽)
        R(2, 20, 10, 4, red(1)); R(2, 20, 10, 1, red(3)); R(2, 23, 10, 1, red(-3)); V(2, 20, 4, red(-3)); V(11, 20, 4, red(-3))
        R(6, 16, 5, 2, ch(2)); R(6, 18, 5, 1, ch(-1))                                                                        # 팔걸이
        R(11, 24, 3, 3, ch(1)); R(11, 26, 4, 1, ch(-1)); R(13, 24, 2, 1, ch(3))                                              # 발받침
        R(6, 24, 2, 5, ch(0)); R(4, 29, 7, 2, ch(1)); R(4, 29, 7, 1, ch(3)); R(4, 31, 7, 1, K('yoru', 0))


def _chair(d, ko, desc):
    return R.obj('sh-barber-chair-' + d, ko, 1, 1, up=16, kind='floor', use=('sit',), facing={'n': 'N', 's': 'S', 'e': 'E', 'w': 'W'}[d],
                 desc=desc, tags=('이발소', '의자', '이발 의자'), place='거울 앞 한 칸씩 띄워서(북쪽을 보는 -n 이 기본), 뒤에 통로 한 칸', pair=('sh-barber-mirror', 'sh-shampoo'))


def _mk_chair(d, ko, desc):
    def fn(c): barber_chair(c, d)
    _chair(d, ko, desc)(fn)


_mk_chair('n', '이발 의자(북향)', '붉은 가죽 이발 의자. 북쪽 거울을 보고 앉아 등받이 뒷면과 크롬 기둥이 보인다.')
_mk_chair('s', '이발 의자(남향)', '붉은 가죽 이발 의자. 남쪽을 보는 앞모습: 머리받침·팔걸이·발받침.')
_mk_chair('e', '이발 의자(동향)', '붉은 가죽 이발 의자. 동쪽을 보는 옆모습(L자): 등받이가 서쪽.')
_mk_chair('w', '이발 의자(서향)', '붉은 가죽 이발 의자. 서쪽을 보는 옆모습(L자): 등받이가 동쪽.')


@R.obj('sh-barber-mirror', '이발소 거울대', 1, 1, up=16, kind='wall', surface=True, use=('search',),
       desc='벽 가득 큰 거울 + 아래 선반 한 칸. 거울에 비스듬한 하이라이트 두 줄, 선반 위에 빗·병 색 점. 옆으로 이어 붙는다(세로 틀 1px).',
       tags=('이발소', '거울'), place='북쪽 벽면 아래 2~3칸 이어서, 앞에 의자', pair=('sh-barber-chair-n', 'sh-shampoo'))
def sh_barber_mirror(c):
    c.R(0, 2, 16, 14, K('ki', 0)); c.HL(0, 2, 16, K('ki', 3)); c.VL(0, 2, 14, K('ki', 1))
    c.R(1, 4, 15, 12, K('garasu', 3)); c.HL(1, 4, 15, K('garasu', 1)); c.HL(1, 5, 15, K('garasu', 2)); c.HL(1, 15, 15, K('garasu', 0))
    for k in range(0, 10): c.P(4 + k, 14 - k, K('shiro', 3)); c.P(5 + k, 14 - k, K('shiro', 2))                           # 대각 하이라이트
    cab(c, 0, 16, 16, 5, 11, 'ki', l=False, r=False, face=0)
    c.R(0, 18, 16, 3, K('shiro', 2)); c.HL(0, 17, 16, K('shiro', 3))
    for x, r in ((2, 'sora'), (6, 'aka'), (10, 'midori')): c.R(x, 17, 2, 3, K(r, 0)); c.P(x, 17, K(r, 2))              # 병
    c.HL(12, 19, 3, K('yoru', 0)); c.HL(12, 18, 3, K('conc', 2))                                                           # 빗
    c.R(2, 26, 12, 4, K('ki', -1)); c.HL(2, 26, 12, K('ki', -3)); c.HL(2, 30, 12, K('ki', 1))


@R.obj('sh-shampoo', '샴푸대', 1, 1, up=16, kind='wall', use=('search',),
       desc='이발소 샴푸대(세면대). 흰 도기 대야에 크롬 수전과 샤워 헤드, 아래 나무 캐비닛, 위 벽에 작은 거울.', tags=('이발소', '샴푸', '세면대'), place='북쪽 벽면 아래 끝, 거울대 옆', pair=('sh-barber-mirror',))
def sh_shampoo(c):
    c.R(2, 3, 12, 8, K('garasu', 2)); box(c, 2, 3, 12, 8, K('ki', -1)); c.HL(3, 4, 4, K('garasu', 3))
    cab(c, 0, 14, 16, 6, 13, 'ki', face=0)
    c.R(1, 15, 14, 4, K('shiro', 2)); c.HL(1, 15, 14, K('shiro', 3)); c.R(3, 16, 10, 3, K('shiro', -1)); c.HL(3, 16, 10, K('conc', -1))
    c.VL(8, 9, 6, K('conc', 3)); c.VL(9, 9, 6, K('conc', -1)); c.HL(6, 8, 4, K('conc', 3)); c.R(5, 8, 2, 3, K('conc', 1)); c.P(5, 11, K('sora', 1)); c.P(6, 11, K('sora', 0))
    c.R(3, 22, 10, 7, K('ki', -1)); c.HL(3, 22, 10, K('ki', -3)); c.HL(3, 28, 10, K('ki', 1)); c.P(8, 25, K('conc', 3))


@R.obj('sh-waiting-bench', '대기 벤치', 2, 1, up=16, kind='floor', use=('sit',), facing='S',
       desc='이발소 대기 벤치 2칸. 갈색 비닐 등받이와 방석, 크롬 다리. 남쪽을 보고 앉는다.', tags=('이발소', '벤치', '대기'), place='입구 옆 벽 쪽 한 줄', pair=('sh-barber-pole',))
def sh_waiting_bench(c):
    c.R(1, 8, 30, 10, K('renga', 0)); box(c, 1, 8, 30, 10, K('renga', -3)); c.HL(2, 9, 28, K('renga', 2)); c.HL(2, 13, 28, K('renga', -1)); c.VL(2, 10, 7, K('renga', 1))
    c.R(1, 19, 30, 5, K('renga', 1)); c.HL(1, 19, 30, K('renga', 3)); c.HL(1, 23, 30, K('renga', -3)); c.VL(1, 19, 5, K('renga', -3)); c.VL(30, 19, 5, K('renga', -3))
    c.HL(2, 24, 28, K('ki', -2))
    for x in (3, 26): c.R(x, 25, 2, 6, K('conc', 1)); c.VL(x, 25, 6, K('conc', 3)); c.VL(x + 1, 25, 6, K('tekko', 0)); c.HL(x - 1, 31, 4, K('yoru', 0))


@R.obj('sh-barber-pole', '사인 폴', 1, 1, up=16, kind='floor', use=('block',),
       desc='이발소 사인 폴. 유리 원통에 빨강·흰·파랑 빗금 줄이 감겨 있고 크롬 위·아래 뚜껑.', tags=('이발소', '사인 폴', '입구'), place='가게 입구 옆(안쪽 구석이 아니라 문 곁)', pair=('sh-waiting-bench',))
def sh_barber_pole(c):
    c.R(5, 29, 6, 2, K('conc', 1)); c.HL(5, 29, 6, K('conc', 3)); c.HL(5, 31, 6, K('yoru', 0)); c.R(6, 27, 4, 2, K('tekko', 0))
    c.R(5, 3, 6, 2, K('conc', 1)); c.HL(5, 3, 6, K('conc', 3)); c.R(6, 1, 4, 2, K('tekko', 0)); c.HL(6, 1, 4, K('conc', 2))
    for y in range(5, 27):
        for x in range(5, 11):
            ph = ((y + x) // 4) % 3
            col = (K('aka', 0), K('shiro', 1), K('kon', 0))[ph]
            if x == 5: col = (K('aka', 2), K('shiro', 3), K('kon', 2))[ph]
            elif x == 10: col = (K('aka', -2), K('shiro', -1), K('kon', -2))[ph]
            c.P(x, y, col)
    c.VL(4, 6, 20, K('yoru', 0)); c.VL(11, 6, 20, K('yoru', 0))


# ─────────────────────────── 2회차: 가게별 뒷방 가구 + 공용 노렌 ───────────────────────────
# 크기표(추가): 노렌 W16 H32(문틀 안쪽 10px) · 반죽대 W32 T9 F6 · 발효 선반 W14 H28 · 책 상자 더미 W14 H27 · 반품 서가(벽) W14 H29
#  조제대 W32 T9 F6 · 재고 약장(벽) W14 H29 · 꽃 양동이 줄 W32 H24 · 포장지 작업대 W32 T9 F6 · 채소 상자 더미 W14 H26
#  저울 작업대 W32 T9 F6 · 수건 건조대 W14 H27 · 소형 세탁기 W12 H24


@R.obj('sh-noren', '노렌 통로', kind='door', use=('travel',), tags=('노렌', '가게', '뒷방', '통로'),
       place='가로 칸막이 1칸 틈 칸(가게와 뒷방 사이)',
       desc='가게 안쪽 통로. 두 쪽으로 갈라진 남색 천 노렌이 가로대에 걸려 있고(글자 없음) 아래로 뒷방 바닥이 보인다. 나무 문틀, 문턱 널.')
def sh_noren(c):
    # 문틀(좌우 기둥 + 위 들보)
    for x0, f in ((0, 1), (13, -1)):
        c.R(x0, 0, 3, 32, K('ki', 0)); c.VL(x0, 0, 32, K('ki', 1 if f > 0 else -1) if False else K('ki', 1)); c.VL(x0 + 2, 0, 32, K('ki', -1))
        c.VL(x0 + (0 if f > 0 else 2), 0, 32, K('ki', -3)); 
    c.VL(2, 5, 27, K('ki', -2)); c.VL(13, 5, 27, K('ki', -3))
    c.R(0, 0, 16, 5, K('ki', 1)); c.HL(0, 0, 16, K('ki', -3)); c.HL(0, 1, 16, K('ki', 3)); c.HL(0, 4, 16, K('ki', -3)); c.VL(0, 0, 5, K('ki', -3)); c.VL(15, 0, 5, K('ki', -3))
    # 가로대(조금 밝은 쇠봉) + 봉 걸이
    c.HL(3, 5, 10, K('tekko', 1)); c.HL(3, 6, 10, K('yoru', 0))
    # 천 두 쪽: 가운데 갈라짐 2px, 아래는 물결 단
    for xa, xb in ((3, 6), (9, 12)):
        w = xb - xa + 1
        c.R(xa, 7, w, 13, K('kon', 0)); c.VL(xa, 7, 13, K('kon', 1)); c.VL(xb, 7, 13, K('kon', -1))
        c.HL(xa, 7, w, K('kon', 2))
        c.HL(xa, 11, w, K('shiro', 1)); c.HL(xa, 12, w, K('shiro', -1)) if False else c.HL(xa, 12, w, K('shiro', 0))   # 흰 가로 띠(글자 아님)
        c.HL(xa, 20, w, K('kon', -3)); c.HL(xa, 19, w, K('kon', -2))
        c.VL(xa - 0, 7, 13, K('kon', 1)); c.VL(xb, 7, 13, K('kon', -2))
    c.P(3, 20, None); c.P(6, 20, None); c.P(9, 20, None); c.P(12, 20, None)          # 물결 단 모서리
    c.P(3, 19, K('kon', -3)); c.P(12, 19, K('kon', -3))
    c.VL(6, 8, 12, K('kon', -3)); c.VL(9, 8, 12, K('kon', -3))                          # 갈라진 가장자리 윤곽
    # 문턱 널
    c.R(3, 29, 10, 3, K('ki', 0)); c.HL(3, 29, 10, K('ki', 3)); c.HL(3, 31, 10, K('ki', -3))


@R.obj('sh-dough-bench', '반죽 작업대', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='빵집 뒷방 반죽대 2칸. 나무 상판 위에 밀가루 포대 둘과 반죽 덩이, 밀대. 앞판에 서랍 두 개.', tags=('빵집', '반죽', '밀가루', '뒷방'),
       place='뒷방 벽 쪽 한 줄(가게 쪽 칸막이 앞이 아니라 안쪽)', pair=('sh-proof-rack', 'sh-oven'))
def sh_dough_bench(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    c.R(2, 3, 28, 6, K('ki', 2))
    for sx in (7, 25):                                                        # 밀가루 포대
        ell(c, sx, 6, 4.6, 3.3, 'kinari', 2); c.HL(sx - 2, 3, 4, K('kinari', -1)); c.P(sx, 2, K('kinari', 3)); c.P(sx - 1, 6, K('kinari', 3)); c.P(sx + 1, 7, K('kinari', 0))
    ell(c, 16, 6, 3.4, 2.3, 'kinari', 3); c.P(15, 5, K('shiro', 3))             # 반죽 덩이
    c.HL(11, 8, 10, K('ki', -1)) if False else None
    c.R(12, 8, 9, 1, K('ki', 1)); c.HL(12, 9, 9, K('ki', -2))                   # 밀대
    c.HL(2, 12, 12, K('ki', -2)); c.HL(18, 12, 12, K('ki', -2)); c.VL(15, 11, 5, K('ki', -2)); c.VL(16, 11, 5, K('ki', 2))
    c.R(6, 13, 4, 1, K('conc', 2)); c.R(22, 13, 4, 1, K('conc', 2))


@R.obj('sh-proof-rack', '발효 선반', 1, 1, up=16, kind='floor', use=('search',),
       desc='빵집 뒷방 발효 선반. 쇠 기둥 네 단 선반마다 부풀기 시작한 반죽 덩이가 놓인 쟁반이 줄지어 있다.', tags=('빵집', '발효', '선반', '쟁반', '뒷방'),
       place='뒷방 벽 쪽, 반죽대 옆', pair=('sh-dough-bench',))
def sh_proof_rack(c):
    c.R(0, 7, 16, 25, K('tekko', -2)); box(c, 0, 7, 16, 25, K('yoru', 0))
    slab(c, 0, 3, 16, 4, 'conc')
    for yy in (14, 21, 28):                                                   # 쟁반 단
        c.R(1, yy, 14, 2, K('conc', 2)); c.HL(1, yy, 14, K('conc', 3)); c.HL(1, yy + 2, 14, K('yoru', 0))
        for k, bx in enumerate((4, 8, 12)):
            ell(c, bx, yy - 2.2, 2.2, 2.0, 'daidai', 1 if k % 2 == 0 else 0)
        c.HL(1, yy - 5, 14, K('tekko', -1)) if False else None
    c.VL(1, 7, 24, K('conc', 1)); c.VL(14, 7, 24, K('conc', -2)); c.VL(0, 7, 25, K('yoru', 0)); c.VL(15, 7, 25, K('yoru', 0))
    c.HL(0, 31, 16, K('yoru', 0))


@R.obj('sh-book-crates', '책 상자 더미', 1, 1, up=16, kind='floor', use=('search',),
       desc='서점 뒷방 책 상자 더미. 나무 상자 둘이 포개지고 위에 책 묶음이 얹혔다. 상자 앞판에 널 틈 줄.', tags=('서점', '상자', '책', '뒷방'),
       place='뒷방 한쪽 구석, 반품 서가 앞이 아니라 옆', pair=('sh-returns-shelf',))
def sh_book_crates(c):
    cab(c, 0, 19, 16, 4, 8, 'ki', face=0)
    c.HL(2, 27, 12, K('ki', -2)); c.HL(2, 24, 12, K('ki', -2)); c.VL(7, 24, 7, K('ki', -2))
    cab(c, 2, 11, 12, 4, 6, 'ki', face=1)
    c.HL(3, 17, 10, K('ki', -1)); c.VL(7, 16, 5, K('ki', -1))
    for bx, w, ramp, st in ((3, 6, 'sora', 0), (4, 7, 'aka', -1)):             # 책 묶음 둘(옆 단면 크림)
        pass
    c.R(3, 6, 10, 5, K('kon', 0)); box(c, 3, 6, 10, 5, K('kon', -3)); c.HL(4, 7, 8, K('kon', 2)); c.HL(4, 9, 8, K('kinari', 2))
    c.R(4, 3, 8, 3, K('aka', -1)); box(c, 4, 3, 8, 3, K('aka', -3)); c.HL(5, 4, 6, K('aka', 1)); c.VL(8, 6, 5, K('soil', 1))
    c.P(3, 6, None) if False else None


def f_bundles(c, x0, y0, w, h, lvl, seed):
    """묶음 책: 노끈으로 묶은 가로 책 더미(단마다 색)."""
    fam = (('kinari', 0), ('soil', 1), ('sora', -1))[hs(lvl, seed, 3) % 3]
    x = x0
    while x + 4 <= x0 + w:
        bw = min(5, x0 + w - x)
        for k in range(2 if h >= 7 else 1):
            ty = y0 + h - 3 * (k + 1)
            c.R(x, ty, bw, 3, K(*fam)); c.HL(x, ty, bw, K(fam[0], fam[1] + 2)); c.HL(x, ty + 2, bw, K(fam[0], fam[1] - 2))
            c.VL(x, ty, 3, K(fam[0], fam[1] + 1)); c.VL(x + bw - 1, ty, 3, K(fam[0], fam[1] - 1))
        c.VL(x + bw // 2, y0 + h - (6 if h >= 7 else 3), 6 if h >= 7 else 3, K('soil', -2))
        x += bw + 1


@R.obj('sh-returns-shelf', '반품 서가', 1, 1, up=16, kind='wall', use=('search',),
       desc='서점 뒷방 반품 서가. 노끈으로 묶은 책 더미가 3단으로 쌓여 있고 위쪽 귀퉁이에 붉은 꼬리표가 붙었다.', tags=('서점', '반품', '서가', '뒷방'),
       place='뒷방 북쪽 벽 아래', pair=('sh-book-crates',))
def sh_returns_shelf(c):
    shelf(c, 0, 3, 16, 29, 'ki', 3, f_bundles, seed=5, back=-2)
    c.R(12, 5, 3, 2, K('aka', 0)); c.HL(12, 5, 3, K('aka', 2)); c.HL(12, 7, 3, K('aka', -3))


@R.obj('sh-dispense-counter', '조제대', 2, 1, up=0, kind='floor', surface=True, use=('counter',),
       desc='약국 뒷방 조제대 2칸. 흰 상판에 갈색 약병과 유리병, 막자사발이 놓이고 앞은 작은 서랍이 줄지었다.', tags=('약국', '조제', '막자사발', '약병', '뒷방'),
       place='뒷방 안쪽 벽 쪽', pair=('sh-stock-shelf',))
def sh_dispense_counter(c):
    cab(c, 0, 1, 32, 9, 6, 'conc', face=0)
    c.R(2, 3, 28, 6, K('shiro', 2)); c.HL(1, 2, 30, K('shiro', 3))
    for bx, ramp, st in ((3, 'daidai', -1), (8, 'daidai', -2), (13, 'sora', -1)):   # 약병
        c.R(bx, 4, 3, 5, K(ramp, st)); c.VL(bx, 4, 5, K(ramp, st + 1)); c.VL(bx + 2, 4, 5, K(ramp, st - 1)); c.HL(bx, 8, 3, K(ramp, -3)); c.HL(bx, 3, 3, K('shiro', 3)); c.HL(bx, 4, 3, K('shiro', 0)) if False else None
        c.HL(bx, 3, 3, K('shiro', 3)); c.P(bx + 1, 6, K('shiro', 2))
    ell(c, 24, 6, 4.6, 2.9, 'conc', 1); ell(c, 24, 5.6, 3, 1.6, 'tekko', -1)           # 막자사발
    c.R(26, 2, 1, 5, K('kinari', 0)); c.P(26, 2, K('kinari', 3))                         # 막자
    for dx in (2, 17):
        for k in range(2):
            c.R(dx + k * 7, 11, 6, 4, K('conc', 0)); box(c, dx + k * 7, 11, 6, 4, K('conc', -2)); c.P(dx + k * 7 + 2, 13, K('tekko', 2)); c.P(dx + k * 7 + 3, 13, K('tekko', 2)); c.HL(dx + k * 7 + 1, 11, 4, K('conc', 2))


def f_stock(c, x0, y0, w, h, lvl, seed):
    if lvl >= 3:                                                                         # 맨 아랫단은 큰 박스
        x = x0
        while x + 4 <= x0 + w:
            bw = min(6, x0 + w - x)
            c.R(x, y0 + h - 5, bw, 5, K('kinari', 0)); box(c, x, y0 + h - 5, bw, 5, K('soil', -2)); c.HL(x + 1, y0 + h - 4, bw - 2, K('kinari', 2)); c.HL(x + 1, y0 + h - 3, bw - 2, K('soil', 0))
            x += bw + 1
        return
    x = x0 + 1
    while x + 2 < x0 + w:
        k = hs(x, lvl, seed) % 3
        ramp, st = (('daidai', -1), ('sora', -1), ('daidai', -2))[k]
        bh = 5 if k != 1 else 6
        c.R(x, y0 + h - bh, 3, bh, K(ramp, st)); c.VL(x, y0 + h - bh, bh, K(ramp, st + 1)); c.VL(x + 2, y0 + h - bh, bh, K(ramp, st - 1))
        c.HL(x, y0 + h - bh, 3, K('shiro', 3)); c.P(x + 1, y0 + h - 3, K('shiro', 2))
        x += 4


@R.obj('sh-stock-shelf', '재고 약장', 1, 1, up=16, kind='wall', use=('search',),
       desc='약국 뒷방 재고 약장. 쇠 회색 4단 선반 위 3단에는 갈색·남색 약병이, 맨 아래에는 포장 상자가 쌓였다.', tags=('약국', '재고', '약병', '뒷방'),
       place='뒷방 북쪽 벽 아래', pair=('sh-dispense-counter',))
def sh_stock_shelf(c): shelf(c, 0, 3, 16, 29, 'conc', 4, f_stock, seed=17, back=-2)


@R.obj('sh-bucket-row', '꽃 양동이 줄', 2, 1, up=16, kind='floor', use=('search',),
       desc='꽃집 뒷방 바닥에 한 줄로 놓인 양동이 네 개. 줄기가 길게 솟고 꽃이 크게 핀 것과 봉오리가 섞였다.', tags=('꽃집', '양동이', '꽃', '뒷방'),
       place='뒷방 바닥 한 줄, 벽 쪽', pair=('sh-paper-table',))
def sh_bucket_row(c):
    for k in range(4):
        x = k * 8
        for t in range(3):
            sx = x + 2 + t * 2
            top = 6 + (hs(k, t, 4) % 8)
            c.VL(sx, top + 3, 21 - top, K('midori', -1))
            r, s = FL[hs(k, t, 9) % len(FL)]
            ell(c, sx + .5, top + 1.5, 2.4, 2.2, r, s)
        c.R(x + 1, 22, 7, 9, K('conc', 0)); c.VL(x + 1, 22, 9, K('conc', 2)); c.VL(x + 6, 22, 9, K('conc', -2)); c.HL(x + 1, 22, 6, K('conc', 3)); c.HL(x + 1, 23, 6, K('tekko', 0))
        c.HL(x + 1, 30, 6, K('tekko', -1)); c.HL(x + 1, 31, 6, K('yoru', 0)); c.VL(x, 22, 10, K('yoru', 0)); c.VL(x + 7, 22, 10, K('yoru', 0)); c.HL(x, 21, 8, K('yoru', 0))
        c.VL(x + 3, 25, 4, K('conc', 1))


@R.obj('sh-paper-table', '포장지 작업대', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='꽃집 뒷방 작업대 2칸. 분홍·하늘 포장지 두루마리 둘과 붉은 리본 실패가 놓인 나무 상판.', tags=('꽃집', '포장지', '리본', '뒷방'),
       place='뒷방 안쪽 벽 쪽', pair=('sh-bucket-row',))
def sh_paper_table(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    c.R(2, 3, 28, 6, K('ki', 2))
    for rx, ramp in ((2, 'pinku'), (15, 'sora')):                                # 포장지 두루마리(옆으로 누움)
        c.R(rx, 3, 11, 5, K(ramp, 1)); box(c, rx, 3, 11, 5, K(ramp, -3)); c.HL(rx + 1, 4, 9, K(ramp, 3)); c.HL(rx + 1, 6, 9, K(ramp, -1))
        c.R(rx + 9, 4, 2, 3, K('shiro', 2)); c.VL(rx + 10, 4, 3, K('conc', -1))
    ell(c, 28, 6, 2.5, 2.6, 'aka', 0); c.P(28, 6, K('shiro', 2))
    c.HL(2, 12, 12, K('ki', -2)); c.HL(18, 12, 12, K('ki', -2)); c.VL(15, 11, 5, K('ki', -2)); c.VL(16, 11, 5, K('ki', 2))


@R.obj('sh-crate-stack', '채소 상자 더미', 1, 1, up=16, kind='floor', use=('search',),
       desc='채소가게 뒷방 상자 더미. 널 틈이 벌어진 나무 상자 셋이 쌓이고 맨 위에 잎채소와 무가 수북하다.', tags=('채소가게', '상자', '채소', '뒷방'),
       place='뒷방 한쪽, 저울 작업대 옆', pair=('sh-scale-table',))
def sh_crate_stack(c):
    cab(c, 0, 18, 16, 4, 9, 'ki', face=0)
    for xx in (3, 7, 11): c.VL(xx, 23, 7, K('ki', -2))
    c.HL(1, 26, 14, K('ki', -2))
    cab(c, 1, 9, 14, 4, 5, 'ki', face=1)
    for xx in (4, 8, 12): c.VL(xx, 14, 4, K('ki', -2))
    for k, (r, s) in enumerate((('midori', 0), ('midori', 1), ('aka', 0), ('shiro', 2))):
        ell(c, 3.5 + k * 3.2, 7 - (k % 2), 2.4, 2.2, r, s)
    ell(c, 8, 5, 2.4, 2, 'midori', 1)


@R.obj('sh-scale-table', '저울 작업대', 2, 1, up=0, kind='floor', surface=True, use=('search',),
       desc='채소가게 뒷방 작업대 2칸. 접시저울과 눈금판이 놓인 나무 상판, 한쪽에 당근·무 다발.', tags=('채소가게', '저울', '다듬기', '뒷방'),
       place='뒷방 안쪽 벽 쪽', pair=('sh-crate-stack',))
def sh_scale_table(c):
    cab(c, 0, 1, 32, 9, 6, 'ki', face=0)
    c.R(2, 3, 28, 6, K('ki', 2))
    c.R(3, 7, 12, 2, K('conc', 1)); c.HL(3, 7, 12, K('conc', 3)); c.HL(3, 8, 12, K('tekko', -1)); c.VL(3, 7, 2, K('yoru', 0)); c.VL(14, 7, 2, K('yoru', 0)); c.HL(3, 9, 12, K('yoru', 0))
    c.R(7, 2, 4, 5, K('shiro', 2)); box(c, 7, 2, 4, 5, K('yoru', 0)); c.HL(8, 3, 2, K('shiro', 3)); c.P(8, 4, K('aka', 0)); c.P(9, 4, K('yoru', 0)); c.P(9, 5, K('yoru', 0))
    ell(c, 21, 6.5, 4.5, 1.8, 'conc', 2); c.HL(17, 5, 9, K('yoru', 0)) if False else None
    for k in range(3):
        ell(c, 26.2 + k * 1.8, 6, 1.4, 2.6, ('daidai', 'shiro', 'daidai')[k], (1, 2, 0)[k])
        c.P(26 + k * 2, 2, K('midori', 0))
    c.HL(2, 12, 12, K('ki', -2)); c.HL(18, 12, 12, K('ki', -2)); c.VL(15, 11, 5, K('ki', -2)); c.VL(16, 11, 5, K('ki', 2))


@R.obj('sh-towel-rack', '수건 건조대', 1, 1, up=16, kind='floor', use=('search',),
       desc='이발소 뒷방 수건 건조대. 나무 기둥 사이 가로봉 두 개에 흰·하늘색 수건이 걸려 늘어졌다.', tags=('이발소', '수건', '건조대', '뒷방'),
       place='뒷방 한쪽, 세탁기 옆', pair=('sh-washer',))
def sh_towel_rack(c):
    slab(c, 0, 3, 16, 3, 'ki')
    for x0 in (0, 13):
        c.R(x0, 6, 3, 25, K('ki', 0)); c.VL(x0, 6, 25, K('ki', 1)); c.VL(x0 + 2, 6, 25, K('ki', -2)); c.VL(x0 + (0 if x0 == 0 else 2), 6, 25, K('ki', -3))
    c.HL(0, 31, 3, K('ki', -3)); c.HL(13, 31, 3, K('ki', -3))
    for yy, rows in ((9, 8), (19, 8)):
        c.HL(3, yy, 10, K('ki', 3)); c.HL(3, yy + 1, 10, K('ki', -3))
        for k, (r, s) in enumerate((('shiro', 1), ('sora', 1))):
            tx = 4 + k * 5
            c.R(tx, yy + 2, 4, rows, K(r, s)); c.VL(tx, yy + 2, rows, K(r, s + 1)); c.VL(tx + 3, yy + 2, rows, K(r, s - 1)); c.HL(tx, yy + rows + 1, 4, K('conc' if r == 'shiro' else r, -2))
        c.HL(4, yy + 4, 9, K('aka', 0)) if False else None


@R.obj('sh-washer', '소형 세탁기', 1, 1, up=16, kind='floor', use=('search',),
       desc='이발소 뒷방 소형 세탁기. 흰 몸통 앞에 둥근 유리 문과 손잡이 둘, 위쪽에 하늘색 조작 띠.', tags=('이발소', '세탁기', '뒷방'),
       place='뒷방 한쪽, 수건 건조대 옆', pair=('sh-towel-rack',))
def sh_washer(c):
    cab(c, 2, 8, 12, 4, 20, 'shiro', face=0)
    c.R(3, 14, 10, 2, K('sora', 0)); c.HL(3, 14, 10, K('sora', 2)); c.P(4, 15, K('aka', 0)); c.P(7, 15, K('shiro', 3))
    ell(c, 8, 23, 4.2, 4.2, 'conc', 2); ell(c, 8, 23, 2.8, 2.8, 'sora', -1); c.P(7, 22, K('sora', 3)); c.P(6, 23, K('sora', 2))
    c.HL(3, 29, 3, K('yoru', 0)); c.HL(10, 29, 3, K('yoru', 0)); c.R(3, 30, 2, 1, K('tekko', 0)); c.R(11, 30, 2, 1, K('tekko', 0))


# ─────────────────────────── 탁상 물건(16×16) ───────────────────────────
@R.good('sh-bread', '빵 쟁반', desc='쟁반에 놓인 갈색 빵 덩이 세 개(바게트·둥근 빵·식빵).')
def g_bread(c):
    c.R(2, 6, 12, 3, K('conc', 1)); c.HL(2, 6, 12, K('conc', 3)); c.HL(2, 8, 12, K('conc', -2))
    ell(c, 5, 4, 3.4, 1.7, 'daidai', 0); ell(c, 10, 4.2, 2.3, 2.2, 'ki', 1); c.R(12, 3, 3, 3, K('kii', 0)); c.HL(12, 3, 3, K('kii', 2)); c.HL(12, 5, 3, K('daidai', -1))


@R.good('sh-bouquet', '꽃다발', desc='갈색 포장지에 싼 꽃다발. 분홍·주황·노랑 꽃 덩이와 초록 줄기.')
def g_bouquet(c):
    c.R(5, 4, 6, 5, K('kinari', 2)); c.HL(5, 4, 6, K('kinari', 3)); c.VL(10, 5, 4, K('kinari', -1)); c.P(5, 4, None); c.P(10, 4, None); c.HL(6, 8, 4, K('kinari', 0)); c.P(8, 7, K('pinku', 1))
    ell(c, 5, 3, 2.2, 2, 'pinku', 0); ell(c, 8, 1.8, 2.2, 2, 'aka', 0); ell(c, 11, 3, 2.2, 2, 'kii', 1); c.P(8, 3, K('midori', 0))


@R.good('sh-medicine', '약 상자·병', desc='흰 약 상자와 갈색 병. 상자에 청색 띠(글자 아님), 병에 흰 뚜껑.')
def g_medicine(c):
    c.R(2, 2, 6, 6, K('shiro', 1)); c.HL(2, 2, 6, K('shiro', 3)); c.VL(7, 3, 5, K('shiro', -1)); c.HL(2, 7, 6, K('shiro', -2)); c.HL(2, 4, 6, K('sora', 0)); c.HL(2, 5, 6, K('sora', 0)); box(c, 2, 2, 6, 6, K('conc', -2)); c.P(2, 2, None)
    c.R(10, 3, 4, 5, K('daidai', -1)); c.VL(10, 3, 5, K('daidai', 0)); c.HL(10, 7, 4, K('daidai', -3)); c.R(10, 1, 4, 2, K('shiro', 2)); c.HL(10, 1, 4, K('shiro', 3)); c.HL(11, 5, 2, K('kinari', 2))


@R.good('sh-scale', '저울', desc='채소·생선 가게 저울. 둥근 은색 접시 + 흰 눈금판(빨간 바늘, 숫자 없음).')
def g_scale(c):
    c.R(3, 6, 10, 2, K('conc', 1)); c.HL(3, 6, 10, K('conc', 3)); c.HL(3, 8, 10, K('conc', -2))
    c.R(5, 1, 6, 5, K('shiro', 2)); box(c, 5, 1, 6, 5, K('conc', -1)); c.VL(8, 2, 3, K('aka', 0)); c.P(7, 2, K('aka', 1)); c.HL(6, 4, 4, K('conc', 2))
    ell(c, 8, 7, 5, 1.2, 'conc', 1)


@R.good('sh-scissors', '가위', desc='이발 가위. 은색 날 두 장이 엇갈리고 붉은 손잡이 고리 두 개.')
def g_scissors(c):
    for i in range(6): c.P(7 + i, 2 + i // 2, K('conc', 2)); c.P(7 + i, 4 - i // 2, K('conc', 0))
    c.P(7, 3, K('tekko', 0)); box(c, 3, 4, 4, 4, K('aka', -1)); box(c, 3, 1, 4, 4, K('aka', 0)); c.P(4, 2, K('aka', 2))


@R.good('sh-price-dots', '가격표 점', desc='작은 흰 가격표 세 장. 글자 대신 색 점(빨강·노랑·초록)만 찍혀 있다.')
def g_price_dots(c):
    for i, r in enumerate(('aka', 'kii', 'midori')):
        x = 1 + i * 5
        c.R(x, 2, 4, 5, K('shiro', 2)); c.HL(x, 2, 4, K('shiro', 3)); c.HL(x, 6, 4, K('shiro', -1)); c.VL(x + 3, 3, 3, K('shiro', 0))
        c.P(x + 1, 4, K(r, 0)); c.P(x + 2, 4, K(r, 1)); c.P(x + 1, 3, K('conc', 0))

# ─────────────────────────── 3차: 가게마다 다른 벽·뒷방 ───────────────────────────
@R.obj('sh-pass-window', '타일 공방 창구(판유리)', w=1, kind='hang', hrows=2, tags=('빵집', '창구', '공방'),
       place='빵집 칸막이 매장 쪽 벽면, 아래에 카운터 한 칸', pair=('sh-counter', 'sh-oven'),
       desc='나무 틀에 판유리를 끼운 작은 창구. 유리 너머로 흰 타일 벽과 오븐 불빛이 보인다. 아래 카운터에 빵을 내준다.')
def sh_pass_window(c):
    c.R(0, 2, 16, 26, K('ki', -3)); c.R(1, 3, 14, 24, K('ki', 0)); c.HL(1, 3, 14, K('ki', 3))
    c.R(2, 5, 12, 18, K('shiro', 2))                                           # 유리 너머 흰 타일 벽
    for y in (8, 12, 16, 20): c.HL(2, y, 12, K('shiro', 0))
    for x in (6, 10): c.VL(x, 5, 18, K('shiro', 0))
    c.R(3, 13, 10, 10, K('conc', -2)); box(c, 3, 13, 10, 10, K('tekko', -2))   # 공방 오븐 문
    c.R(5, 15, 6, 5, K('daidai', 1)); c.HL(5, 15, 6, K('kii', 1)); c.HL(5, 19, 6, K('daidai', -1))
    c.HL(2, 5, 12, K('shiro', -1)); c.VL(2, 5, 18, K('shiro', 0))
    for i in range(5): c.P(3 + i * 2, 6 + i // 2, K('garasu', 3))              # 유리 반사
    c.P(11, 7, K('garasu', 3)); c.P(12, 8, K('garasu', 3))
    c.R(0, 26, 16, 4, K('ki', 2)); c.HL(0, 26, 16, K('ki', 3)); c.HL(0, 29, 16, K('ki', -2)); c.HL(0, 28, 16, K('ki', -1))


def f_baskets(c, x0, y0, w, h, lvl, seed):
    x = x0
    while x + 4 <= x0 + w:
        bw = min(5, x0 + w - x)
        veg = ('midori', 'aka', 'daidai', 'kii', 'murasaki')[hs(x, lvl, seed) % 5]
        top = y0 + h - 6
        c.R(x + 1, top, bw - 2, 2, K(veg, 1)); c.HL(x + 1, top, bw - 2, K(veg, 2)); c.P(x, top + 1, K(veg, 0)); c.P(x + bw - 1, top + 1, K(veg, -1))
        c.R(x, top + 2, bw, 4, K('kinari', 0)); c.HL(x, top + 2, bw, K('kinari', 2)); c.HL(x, top + 5, bw, K('kinari', -2))
        for i in range(1, bw, 2): c.P(x + i, top + 3, K('kinari', -1)); c.P(x + i - 1 if i > 1 else x + 1, top + 4, K('kinari', 1))
        x += bw + 1


@R.obj('sh-basket-shelf', '바구니 선반', 1, 1, up=16, kind='wall', use=('search',),
       desc='나무 벽 선반 3단. 단마다 엮은 바구니에 채소·과일이 담겨 있다. 채소가게 북쪽 벽면.',
       tags=('채소가게', '선반', '바구니'), place='북쪽 벽면 아래, 앞에 경사 진열대', pair=('sh-veg-stand', 'sh-fruit-box'))
def sh_basket_shelf(c): shelf(c, 0, 3, 16, 29, 'ki', 3, f_baskets, seed=5)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)

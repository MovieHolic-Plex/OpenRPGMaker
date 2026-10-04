#!/usr/bin/env python3
"""강남 3/4 데모 조각 그리기 — 손 도트, modern3 램프만, 버들항 킷 문법(16px 폭 열 조각 · 밴드 적층 · walk 격자 F/X/C/S).
  python3 tiledata/atlas-pick/gangnam-v2/draw_parts.py   → parts.png + parts.json

방법: 건물은 「밴드」(지붕 32 · 층 32 · 1층 64/48) 마다 폭 W 짜리 띠를 그린 뒤 16px 열로 잘라 내용이 같은 열은 한 조각으로 합친다
(버들항 킷이 16px 폭 열로 되어 있는 것과 같은 구조). 장면은 compose.py 가 parts.json 의 이름만으로 조립한다.
그림 원료는 scripts/content/atlas-pick/view34_proof.py 의 도트 함수(직접 찍은 것)이며, 다른 자산의 픽셀은 복사하지 않는다."""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from modern_style_bible_proof import K, Cv, hero, RAMPS, wall_fill, window
import view34_proof as V
from view34_proof import (new, roof_top, roof_box, roof_tank, awning34, slab34, window34, pilaster, balcony34,
                          bulkhead34, glass34, doorway34, t_pave, t_alley, t_curb, t_road, vending2, taxi_h, tree34, lower, blit)

PARTS = {}      # name -> dict(cv, layer, role)
_HASH = {}      # 내용 해시 -> 조각 이름 (같은 열은 한 조각)
KITS = {}

def add(name, cv, layer='up', note=''):
    PARTS[name] = dict(cv=cv, layer=layer, note=note)
    return name

def crop(cv, x, y, w, h):
    o = Cv(w, h); o.a[:, :] = cv.a[y:y + h, x:x + w]; return o

def slice_band(prefix, cv, layer='up'):
    """띠를 16px 열로 잘라 같은 열은 재사용. 이름 목록을 돌려준다."""
    names = []
    for i in range(cv.w // 16):
        col = crop(cv, i * 16, 0, 16, cv.h)
        key = hashlib.md5(col.a.tobytes() + bytes([cv.h])).hexdigest()
        if key not in _HASH:
            _HASH[key] = add(f'{prefix}{i}', col, layer)
        names.append(_HASH[key])
    return names

# ───────────────────────── 밴드 그리기 ─────────────────────────
def roof_band(W, items):
    c = new(W, 32); roof_top(c, 0, 0, W, 32, 'conc', items=items); return c

def bay_strip(W, mat, wkind, slabmat, kind, spec):
    """층 띠. spec = 베이마다 ('win'|'winlit'|'balc'|'sign', ...). 베이 폭 32: 왼쪽 붙임기둥 0..3, 창 8..23. 끝 16px = 붙임기둥 열."""
    c = new(W, 32)
    wall_fill(c, 0, 3, W, 29, mat, wkind)
    if kind == 'top':
        c.HL(0, 0, W, K(mat, -3)); c.HL(0, 1, W, K(mat, -2)); c.HL(0, 2, W, K(mat, -1))
    else:
        slab34(c, 0, 0, W, slabmat, shadow=True)
    for k, s in enumerate(spec):
        x = k * 32
        pilaster(c, x, 9, 23, mat)
        if s in ('win', 'winlit', 'balc'):
            window34(c, x + 8, 10, mat, lit=(s == 'winlit'))
            if s == 'balc': balcony34(c, x + 4, 21, 28)
        elif s == 'sign':
            sign_plate(c, x + 6, 12, 22, 12, 'aka')
    pilaster(c, W - 16, 9, 23, mat)
    return c

def sign_plate(c, x, y, w, h, col):
    """붙은 간판(벽 위로 튀어나온 판): 윗면 2 + 앞 h + 아래 그림자 2. 글자는 블록."""
    c.HL(x, y - 2, w, K(col, 3)); c.HL(x, y - 1, w, K(col, 2))
    c.R(x, y, w, h, K(col, 0)); c.HL(x, y, w, K(col, 1)); c.HL(x, y + h - 1, w, K(col, -2)); c.VL(x, y, h, K(col, 1)); c.VL(x + w - 1, y, h, K(col, -2))
    for i in range(x + 3, x + w - 4, 5): c.R(i, y + 4, 3, h - 8, K('kinari', 2)); c.HL(i, y + 4, 3, K('kinari', 3))
    for i in range(w): lower(c, x + i, y + h, 2); lower(c, x + i, y + h + 1, 1)

def shop_ground(W, mat, wkind, slabmat, awn, glass_l, door_x, glass_r, sign_l, sign_r, sign_col, cafe=False):
    """1층(가게) 64: 슬래브 9 + 벽 55. 간판판 · 들어간 유리 · 유리 받침 · 들어간 입구 · 차양."""
    H = 64; gy = 9; gF = 64
    c = new(W, H)
    slab34(c, 0, 0, W, slabmat, shadow=True)
    wall_fill(c, 0, gy, W, gF - gy, mat, wkind); c.HL(0, gy, W, K(mat, -2))
    c.VL(0, gy, gF - gy, K(mat, 1))
    gh = 24 if cafe else 16
    for (x0, x1) in (glass_l, glass_r):
        ww = x1 - x0
        glass34(c, x0, gF - 11 - gh, ww, gh)
        for i in range(x0 + 14, x1 - 2, 14): c.VL(i, gF - 11 - gh + 1, gh - 1, K('tekko', 0))
        if cafe:                                            # 카페 안: 펜던트 램프 · 탁자 · 컵
            for i in range(x0 + 6, x1 - 4, 14): c.VL(i, gF - 11 - gh + 3, 3, K('tekko', 0)); c.R(i - 1, gF - 11 - gh + 6, 3, 2, K('kii', 2))
            for i in range(x0 + 5, x1 - 5, 14): c.R(i, gF - 21, 8, 2, K('ita', 1)); c.R(i + 1, gF - 23, 2, 2, K('kinari', 2)); c.R(i + 5, gF - 23, 2, 2, K('daidai', 1)); c.R(i + 2, gF - 19, 2, 8, K('ita', -2))
        else:
            for i in range(x0 + 3, x1 - 4, 6):
                c.R(i, gF - 20, 4, 6, K(('midori', 'daidai', 'pinku', 'kii', 'sora', 'aka')[(i // 6) % 6], 1))
        bulkhead34(c, x0, gF - 11, ww, 7, mat if mat != 'tairu' else 'tairu')
    pilaster(c, 0, gy, gF - gy, mat, 4); pilaster(c, W - 4, gy, gF - gy, mat, 4)
    doorway34(c, door_x, gF, 5)
    for (a, b, col) in ((sign_l, None, sign_col), (sign_r, None, 'sora')):
        if a:
            x0, x1 = a
            c.R(x0, gy + 14, x1 - x0, 2, K(col, 3)); c.R(x0, gy + 16, x1 - x0, 5, K(col, 0)); c.HL(x0, gy + 20, x1 - x0, K(col, -2))
            for i in range(x0 + 4, x1 - 4, 8): c.R(i, gy + 17, 4, 2, K('aka' if col == 'kinari' else 'kinari', -1 if col == 'kinari' else 2))
    awning34(c, 2, gy + 1, W - 4, awn)
    c.HL(0, gF - 1, W, K(mat, -3))
    return c

def conbini_ground(W):
    """편의점 1층 48: 처마 그늘 3 + 튀어나온 간판판 + 들어간 유리벽 + 유리 받침 + 자동문 + 양끝 붙임기둥 6."""
    H = 48; gF = 48; c = new(W, H)
    wall_fill(c, 0, 0, W, H, 'conc', 'panel')
    c.HL(0, 0, W, K('conc', -3)); c.HL(0, 1, W, K('conc', -2)); c.HL(0, 2, W, K('conc', -1))
    sy = 6
    c.HL(4, sy - 2, W - 8, K('sora', 3)); c.HL(4, sy - 1, W - 8, K('sora', 2))
    c.R(4, sy, W - 8, 12, K('sora', 0)); c.HL(4, sy, W - 8, K('sora', 1)); c.HL(4, sy + 11, W - 8, K('sora', -2))
    c.R(4, sy + 4, W - 8, 2, K('midori', 1)); c.R(4, sy + 6, W - 8, 1, K('kinari', 2))
    for i in range(10, W - 12, 7): c.R(i, sy + 8, 4, 2, K('kinari', 1))
    for i in range(4, W - 4): lower(c, i, sy + 12, 3); lower(c, i, sy + 13, 2); lower(c, i, sy + 14, 1)
    gh = 22
    for x0, ww in ((7, 61), (93, 60)):
        glass34(c, x0, gF - 11 - gh, ww, gh)
        for i in range(x0 + 15, x0 + ww - 1, 15): c.VL(i, gF - 11 - gh + 1, gh - 1, K('tekko', 0))
        for i in range(x0 + 4, x0 + ww - 4, 5):
            c.R(i, gF - 21, 3, 6, K(('aka', 'kii', 'midori', 'sora', 'daidai', 'pinku')[(i // 5) % 6], 1)); c.R(i, gF - 26, 3, 4, K(('kii', 'sora', 'aka', 'midori')[(i // 5) % 4], 0))
        bulkhead34(c, x0, gF - 11, ww, 7, 'conc')
    doorway34(c, 72, gF, 5)
    for x in (0, W - 6): pilaster(c, x, 3, H - 3, 'conc', 6)
    c.HL(0, gF - 1, W, K('conc', -3))
    return c

# ───────────────────────── 건물 조립 (밴드 → 조각 이름표) ─────────────────────────
def register_building(name, W, bands, doors, note):
    """bands = [(라벨, 그림 Cv)] 위→아래. 조각 이름표 + walk 격자(맨 아래 2줄 = 발자국 S, 문 칸 F, 나머지 = 뒤로 걸으면 가려지는 C)."""
    y = 0; rows = []
    for label, cv in bands:
        names = slice_band(f'{name}.{label}.', cv)
        rows.append(dict(band=label, y=y, h=cv.h, parts=names)); y += cv.h
    cols = W // 16; nrows = y // 16
    walk = []
    for r in range(nrows):
        line = []
        for cidx in range(cols):
            if r < nrows - 2: line.append('C')
            elif r == nrows - 1 and cidx in doors: line.append('F')
            else: line.append('S')
        walk.append(''.join(line))
    KITS[name] = dict(w=cols, h=nrows, px=[W, y], bands=rows, walk=walk, role='building',
                      doors=[dict(dx=d, dy=nrows - 1, note='문 앞 칸(포장 바닥)') for d in doors], description=note)

def build_tower():
    W = 144
    roof = roof_band(W, (lambda c: roof_box(c, 16, 27, 10, 8, 8, 'tekko', 'ac'), lambda c: roof_tank(c, 48, 25),
                         lambda c: roof_box(c, 80, 25, 16, 8, 12, 'conc', 'door'), lambda c: roof_box(c, 112, 27, 10, 8, 8, 'tekko', 'ac')))
    fl = lambda kind, spec: bay_strip(W, 'tairu', 'tile', 'tairu', kind, spec)
    gnd = shop_ground(W, 'tairu', 'tile', 'tairu', 'aka', (4, 60), 72, (96, 140), (4, 60), (96, 140), 'kinari')
    bands = [('roof', roof), ('f5', fl('top', ['win', 'winlit', 'win', 'win'])), ('f4', fl('slab', ['sign', 'win', 'winlit', 'win'])),
             ('f3', fl('slab', ['winlit', 'win', 'balc', 'winlit'])), ('f2', fl('slab', ['win', 'balc', 'win', 'winlit'])), ('f1', gnd)]
    register_building('tower', W, bands, [4, 5], '5층 상가 건물 144×224. 지붕 윗면 D=2(32) + 층 32×4(슬래브 9 · 붙임기둥 · 들어간 창 · 발코니 · 간판판) + 1층 64(차양 · 유리 · 들어간 입구). 통짜 up, y정렬로 가림.')

def build_cafe():
    W = 112
    roof = roof_band(W, (lambda c: roof_box(c, 20, 27, 10, 8, 8, 'tekko', 'ac'), lambda c: roof_tank(c, 68, 25)))
    up = bay_strip(W, 'renga', 'brick', 'conc', 'top', ['winlit', 'win', 'win'])
    gnd = shop_ground(W, 'renga', 'brick', 'conc', 'midori', (4, 54), 60, (82, 108), (8, 50), (84, 106), 'kinari', cafe=True)
    register_building('cafe', W, [('roof', roof), ('f2', up), ('f1', gnd)], [3, 4], '카페 112×128. 벽돌 2층 + 초록 차양 + 큰 유리(안쪽 펜던트·탁자).')

def build_conbini():
    W = 160
    roof = roof_band(W, (lambda c: roof_box(c, 10, 27, 12, 8, 8, 'tekko', 'ac'), lambda c: roof_box(c, 26, 27, 12, 8, 8, 'tekko', 'ac'),
                         lambda c: roof_box(c, 42, 27, 12, 8, 8, 'tekko', 'ac'), lambda c: roof_tank(c, 108, 26)))
    register_building('conbini', W, [('roof', roof), ('f1', conbini_ground(W))], [4, 5], '편의점 160×80. 튀어나온 간판판 + 들어간 유리벽 + 자동문.')

# ───────────────────────── 소품 ─────────────────────────
def prop(name, cv, walk, role='prop', note='', tags=()):
    add(name, cv, 'up')
    KITS[name] = dict(w=(cv.w + 15) // 16, h=(cv.h + 15) // 16, px=[cv.w, cv.h], walk=walk, role=role, description=note, tags=list(tags))

def lamp34():
    """가로등 16×48: 머리 상자(윗면 3 + 앞 5 + 렌즈 따뜻한 색) · 기둥 2px 원통 · 받침 윗면 + 앞."""
    c = new(16, 48)
    c.R(1, 0, 14, 3, K('tekko', 2)); c.HL(1, 0, 14, K('tekko', 3)); c.VL(1, 0, 3, K('tekko', 3))
    c.R(1, 3, 14, 6, K('tekko', -1)); c.VL(1, 3, 6, K('tekko', 1)); c.VL(14, 3, 6, K('tekko', -2)); c.HL(1, 8, 14, K('tekko', -3))
    c.R(3, 5, 10, 3, K('kii', 1)); c.HL(3, 5, 10, K('kii', 2)); c.HL(3, 7, 10, K('kii', -1))
    c.R(7, 9, 2, 35, K('tekko', 0)); c.VL(7, 9, 35, K('tekko', 2)); c.VL(8, 9, 35, K('tekko', -2))
    c.R(4, 42, 8, 3, K('tekko', 2)); c.HL(5, 42, 6, K('tekko', 3)); c.R(4, 45, 8, 3, K('tekko', -1)); c.HL(4, 47, 8, K('tekko', -3))
    return c

def busstop34():
    """버스 정류장 48×48: 지붕판 윗면 10 + 앞 3 + 그림자, 기둥, 뒤 유리 + 광고 라이트박스, 의자 윗면 + 앞, 노선 표지."""
    c = new(48, 48)
    c.R(0, 0, 48, 10, K('tekko', 2)); c.HL(0, 0, 48, K('tekko', 3)); c.VL(0, 0, 10, K('tekko', 3)); c.VL(47, 0, 10, K('tekko', 1))
    c.R(3, 3, 42, 4, K('tekko', 1)); c.HL(3, 6, 42, K('tekko', 3))
    c.R(0, 10, 48, 3, K('tekko', 0)); c.HL(0, 10, 48, K('tekko', 2)); c.HL(0, 12, 48, K('tekko', -2))
    for i in range(48): lower(c, i, 13, 2); lower(c, i, 14, 1)
    c.R(4, 13, 40, 27, K('garasu', 1)); c.R(4, 13, 40, 6, K('garasu', 0)); c.HL(4, 13, 40, K('garasu', -2)); c.HL(4, 14, 40, K('garasu', -1))
    c.VL(4, 13, 27, K('garasu', -2)); c.VL(5, 15, 25, K('garasu', -1)); c.VL(43, 15, 25, K('garasu', 2))
    c.R(7, 17, 14, 18, K('sora', -1)); c.R(8, 18, 12, 16, K('sora', 0)); c.R(8, 18, 12, 3, K('sora', 1)); c.R(10, 24, 8, 2, K('kinari', 2)); c.R(10, 28, 6, 2, K('kinari', 1))   # 광고판
    for k in range(3): c.P(33 + k * 3, 21 + k, K('garasu', 2))
    for x in (2, 44):
        c.R(x, 13, 2, 35, K('tekko', 0)); c.VL(x, 13, 35, K('tekko', 2)); c.VL(x + 1, 13, 35, K('tekko', -2))
    c.R(2, 45, 4, 3, K('tekko', -1)); c.R(42, 45, 4, 3, K('tekko', -1)); c.HL(2, 47, 4, K('tekko', -3)); c.HL(42, 47, 4, K('tekko', -3))
    c.R(20, 34, 22, 3, K('ita', 3)); c.R(20, 37, 22, 3, K('ita', 0)); c.HL(20, 39, 22, K('ita', -2)); c.VL(20, 40, 5, K('tekko', -1)); c.VL(41, 40, 5, K('tekko', -1))   # 의자
    c.R(21, 41, 20, 4, K('ita', -2)); c.HL(21, 44, 20, K('ita', -3))
    c.R(46, 6, 2, 0, K('sora', 0))
    c.R(38, 14, 8, 8, K('sora', 1)); c.HL(38, 14, 8, K('sora', 3)); c.R(40, 17, 4, 2, K('kinari', 3)); c.HL(38, 21, 8, K('sora', -2))                      # 노선 표지
    return c

def bins34():
    """분리수거함 2개 16×16: 윗면 3 + 앞 9 + 뚜껑 선."""
    c = new(16, 16)
    for x, col in ((0, 'midori'), (8, 'sora')):
        c.R(x, 4, 8, 3, K(col, 2)); c.HL(x, 4, 8, K(col, 3)); c.VL(x, 4, 3, K(col, 3))
        c.R(x, 7, 8, 8, K(col, 0)); c.VL(x, 7, 8, K(col, 1)); c.VL(x + 7, 7, 8, K(col, -2)); c.HL(x, 7, 8, K(col, 1)); c.HL(x, 15, 8, K(col, -3))
        c.HL(x + 1, 9, 6, K(col, -1)); c.R(x + 2, 11, 4, 2, K('kinari', 1))
    return c

def hero_variant(recolor=None):
    c = new(16, 24); hero(c, 0, 0)
    if recolor:
        src = {(int(h) >> 16 & 255, int(h) >> 8 & 255, int(h) & 255): K(recolor, i - 1) for i, h in enumerate(RAMPS['sora'][2:4], 1)}
        for j in range(24):
            for i in range(16):
                p = tuple(int(v) for v in c.a[j, i, :3])
                if c.a[j, i, 3] and p in src:
                    h = src[p]; c.a[j, i, :3] = ((h >> 16) & 255, (h >> 8) & 255, h & 255)
    return c

# ───────────────────────── 바닥(lo) ─────────────────────────
def t_crosswalk():
    """횡단보도: 차 진행 방향과 나란한 흰 띠(사다리꼴 배열) — 위에서 본 1:1."""
    c = new(16, 16); c.R(0, 0, 16, 16, K('yoru', 0))
    for (x, y, t) in ((3, 2, 1), (11, 4, -1), (7, 9, 1), (1, 12, 1), (13, 13, -1)): c.P(x, y, K('yoru', t))
    for y in (1, 6, 11):
        c.R(0, y, 16, 3, K('kinari', 1)); c.HL(0, y, 16, K('kinari', 2)); c.HL(0, y + 2, 16, K('kinari', -1)); c.HL(0, y + 3, 16, K('yoru', -1))
    return c

def t_curb_far():
    """건너편 연석: 앞면은 카메라 반대쪽이라 안 보이고 윗면 3줄만."""
    c = new(16, 16); blit(c, t_pave(), 0, 0)
    c.HL(0, 0, 16, K('hodo', 3)); c.HL(0, 1, 16, K('hodo', 3)); c.HL(0, 2, 16, K('hodo', 2)); c.HL(0, 3, 16, K('hodo', 1))
    return c

def t_far_wall(win=True):
    """뒷골목 안쪽 끝의 먼 건물 벽(어두운 벽 + 불 꺼진 창 줄)."""
    c = new(16, 16); c.R(0, 0, 16, 16, K('yoru', -2)); c.HL(0, 0, 16, K('yoru', -3)); c.HL(0, 15, 16, K('yoru', -3))
    if win:
        c.R(3, 4, 10, 6, K('tekko', -3)); c.HL(3, 4, 10, K('yoru', -3)); c.HL(3, 10, 10, K('hodo', -2))
    return c

def t_alley_dk(n):
    c = new(16, 16); blit(c, t_alley(), 0, 0)
    for j in range(16):
        for i in range(16): lower(c, i, j, n)
    return c

# ───────────────────────── 저장 ─────────────────────────
def pack(out_png, out_json):
    order = sorted(PARTS.items(), key=lambda kv: (-kv[1]['cv'].h, kv[0]))
    SW = 512; x = y = rowh = 0; rects = {}
    for n, p in order:
        w, h = p['cv'].w, p['cv'].h
        if x + w > SW: x = 0; y += rowh; rowh = 0
        rects[n] = (x, y, w, h); x += w; rowh = max(rowh, h)
    H = y + rowh
    sheet = Cv(SW, H)
    for n, (px, py, w, h) in rects.items(): sheet.a[py:py + h, px:px + w] = PARTS[n]['cv'].a
    sheet.save(out_png)
    meta = dict(tile=16, sheet=os.path.basename(out_png), size=[SW, H],
                parts={n: dict(x=r[0], y=r[1], w=r[2], h=r[3], layer=PARTS[n]['layer']) for n, r in rects.items()}, kits=KITS)
    json.dump(meta, open(out_json, 'w'), ensure_ascii=False, indent=1)
    return len(PARTS), (SW, H)

def vend34(col, cans):
    """자판기 16×32. 윗면 8(평평·왼쪽 위 빛으로 밝게, 앞쪽 모서리에 어두운 립) + 앞면 24. 윗면에 광고판을 올리지 않는다(윗면은 평평해야 읽힌다)."""
    c = new(16, 32); T = 8; fy = T
    c.R(0, 0, 16, T, K(col, 2)); c.HL(0, 0, 16, K(col, 3)); c.VL(0, 0, T, K(col, 3)); c.VL(15, 1, T - 1, K(col, 1))
    c.HL(0, T - 1, 16, K(col, 1))
    c.R(0, fy, 16, 32 - fy, K(col, 0)); c.VL(0, fy, 32 - fy, K(col, 1)); c.VL(15, fy, 32 - fy, K(col, -2)); c.HL(0, fy, 16, K(col, 1)); c.HL(0, fy + 1, 16, K(col, -1))
    c.HL(0, 31, 16, K(col, -3))
    c.R(2, fy + 3, 12, 12, K('garasu', -2)); c.HL(2, fy + 3, 12, K('garasu', -3))
    for k, m in enumerate(cans): c.R(3 + k * 3, fy + 5, 2, 3, K(m, 1)); c.R(3 + k * 3, fy + 10, 2, 3, K(m, 0))
    c.R(3, fy + 16, 3, 2, K('tekko', -1)); c.R(8, fy + 16, 5, 1, K('kinari', 1))
    c.R(3, fy + 19, 10, 3, K('sumi', 1)); c.HL(3, fy + 19, 10, K('sumi', 2))
    return c

def main():
    build_tower(); build_cafe(); build_conbini()
    prop('lamp', lamp34(), ['C', 'C', 'S'] and ['C', 'C', 'S'], note='가로등 16×48. 발자국 아래 한 칸만 막힘.', tags=['street'])
    prop('tree', tree34(), ['CC', 'CC', 'SS'], note='가로수 32×48. 수관은 지나가면 가려짐, 밑동 한 줄 막힘.', tags=['street'])
    prop('vend_a', vend34('sora', ('aka', 'kii', 'midori', 'daidai')), ['C', 'S'], note='자판기 1×2 (파랑).', tags=['street'])
    prop('vend_b', vend34('aka', ('sora', 'kii', 'pinku', 'midori')), ['C', 'S'], note='자판기 1×2 (빨강).', tags=['street'])
    prop('busstop', busstop34(), ['CCC', 'CCC', 'SSS'], note='버스 정류장 48×48. 지붕판 윗면 10.', tags=['street'])
    prop('taxi_r', taxi_h('right'), ['CCCC', 'CCCC', 'SSSS'], role='vehicle', note='택시(오른쪽 보기) 64×36.', tags=['vehicle'])
    prop('taxi_l', taxi_h('left'), ['CCCC', 'CCCC', 'SSSS'], role='vehicle', note='택시(왼쪽 보기) 64×36.', tags=['vehicle'])
    prop('bins', bins34(), ['S'], note='분리수거함 2개 16×16.', tags=['alley'])
    prop('hero_a', hero_variant(), ['S'], role='character', note='주인공 16×24.')
    prop('hero_b', hero_variant('aka'), ['S'], role='character', note='행인(빨간 옷) 16×24.')
    for n, cv in (('pave', t_pave()), ('alley', t_alley()), ('alley_dk1', t_alley_dk(1)), ('alley_dk2', t_alley_dk(2)),
                  ('curb', t_curb()), ('curb_far', t_curb_far()), ('road', t_road()), ('road_dash', t_road(True)),
                  ('xwalk', t_crosswalk()), ('far_wall', t_far_wall()), ('far_wall_plain', t_far_wall(False))):
        add(n, cv, 'lo')
    n, size = pack(os.path.join(HERE, 'parts.png'), os.path.join(HERE, 'parts.json'))
    bl = sum(1 for p in PARTS.values() if p['layer'] == 'up')
    print('parts', n, 'sheet', size, '(up', bl, ' lo', n - bl, ')')
    for k, v in KITS.items():
        if v['role'] == 'building': print(k, v['px'], 'cells', sum(len(b['parts']) for b in v['bands']), 'unique', len({p for b in v['bands'] for p in b['parts']}))

if __name__ == '__main__': main()

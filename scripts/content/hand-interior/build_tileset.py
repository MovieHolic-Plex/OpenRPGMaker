# 손 도트 실내 v5 → atlas_biome_interior (oprn-atlas) 한 장 시트 + 정의 + 조립 사양 + 예제 26맵.
#
# 원본: tiledata/hand-interior/v5 (Python 손 도트: 가구 381종·바닥 27·벽면 19·천장 7+기본·자동 타일·줄 자동 타일·탁상 물건,
# 건물 25동 26맵의 정답 배열). 이 스크립트는 그 모듈을 그대로 불러 칸 단위로 자른다.
#
# 1) 표면은 월드 좌표 절차 무늬라 주기가 없다 → 표면마다 「짜임 주기」(판자·돌 줄눈·기둥 간격)의 배수로 접는다(64px 이상).
#    무늬 속 구조(벽 기둥·지지목·줄눈)가 원본과 같은 자리에 서고, 접는 경계는 줄눈 위에 떨어진다. 바닥 = 열×줄 칸, 벽면 = 열×2줄 칸.
# 2) 칸 사전(라이브러리): 빈 칸 · 공허 · 천장(스타일 8 × 이웃 32) · 바닥(27 × 16 위치 × 그림자 4) · 벽면(19 × 8 × 서쪽 그림자 2)
#    · 가구 381종(발밑 칸 = 막힘, 솟은 칸 = ★, 걸이 = ★, 바닥 무늬 = 밟음, 계단 = 밟음; 움직이는 칸은 12프레임 연속)
#    · 탁자 자동 타일(스타일별 조각) · 줄 자동 타일(깔개·선로·울타리·창살·난간·증기관) · 탁상 물건 119.
#    같은 (그림, 통행 종류) 칸은 한 번만 싣는다.
# 3) 예제 맵: room4.compose 와 같은 순서로 칸마다 층을 나눈다. 1층 = 구조(천장·벽면·바닥, 창 빛은 따로 구운 칸),
#    2층 = 바닥 무늬(깔개·단), 3·4층 = 그리는 순서대로 가구 조각(셋 이상 겹치면 앞의 것들을 합친 칸). 사전에 없는
#    칸(탁상 물건을 얹은 가구 등)은 시트 끝에 합성 칸으로 싣는다. 그다음 네 층을 다시 쌓아 원본 합성(주기 표면)과
#    픽셀 단위로 비교하고, 통행 BFS 를 원본 정답 배열(grid)과 비교한다.
#
# 산출: public/assets/atlas-interior/interior-chipset.png, src/assets/atlasBiomeInteriorTileset.json,
#       src/assets/atlasBiomeInteriorSheet.json, src/assets/handInteriorSpec.json,
#       tiledata/hand-interior/v5-maps/maps.json (+ render/<map>.png, check.json)
# 사용: python3 scripts/content/hand-interior/build_tileset.py   (저장소 루트에서)
import sys, os, json, math, hashlib
sys.path.insert(0, 'tiledata/hand-interior/v5')
if os.environ.get('HAND_INTERIOR_V6') == '1':   # v6 소품으로 교체 (tiledata/hand-interior/v6-objects/swap6.py). 기본은 v5 그대로
    sys.path.insert(0, 'tiledata/hand-interior/v6-objects'); import apply6; apply6.install()
# 사용자가 고르는 화면(18302)에서 고른 후보(tiledata/hand-interior/pick/picks.json)를 넣는다. 기본 켜짐, HAND_INTERIOR_PICKS=0 이면 v5 그대로.
# 크기가 같은 선택은 rooms4 import 전에(예제 맵도 새 그림), 크기를 바꾼 선택은 뒤에(예제 맵은 v5 칸 점유 그대로 — 정답 격자가 v5 기준).
PICKS = None
if os.environ.get('HAND_INTERIOR_PICKS', '1') != '0':
    sys.path.insert(0, 'scripts/content/hand-interior-pick'); import install_picks as PICKS; PICKS.install()
import meta5  # noqa: F401  (v5 전체 준비: 이름·설명 표 갱신)
import notes6
import room2, room4, rooms4, anim4, kit4, kit5, tiles5
import tiles as TL
from kit4 import OBJ, STY, PIECES
from kit5 import LINEKITS, mask_at
from mat import G
from PIL import Image
if PICKS: PICKS.install_resized()

P = 64                 # 최소 접는 주기(px) — 16px 반복이 띠로 보이지 않게
# 짜임 주기(px): 해시 잡음 H 를 상수로 바꿔 무늬의 구조만 남긴 뒤 잰 가장 짧은 16 배수 주기(2026-09-29 실측).
#   None = 연속 함수(sin)라 주기가 없다 → 손으로 정한 값(광산 지지목 48, 룬 돌 줄 등).
FLOOR_WEAVE = {'boards': (32, 16), 'casino': (16, 16), 'cave': (16, 16), 'check': (16, 16), 'cobble': (16, 16), 'dplank': (32, 16),
               'dungeon': (48, 96), 'dwarf': (32, 32), 'earth': (16, 16), 'elfstone': (48, 32), 'flag': (16, 16), 'grate': (16, 16),
               'grey': (16, 16), 'hobbit': (144, 48), 'ktile': (16, 16), 'marble': (32, 32), 'narshe': (240, 16), 'ovenf': (80, 192),
               'plank': (32, 16), 'rush': (80, 80), 'slum': (208, 144), 'snowmat': (16, 16), 'soot': (16, 16), 'stage': (48, 48),
               'straw': (112, 112), 'terra': (16, 16), 'wetstone': (112, 80)}
WALL_WEAVE = {'goldwood': 48, 'hobbitw': 240, 'logdark': 16, 'marblewall': 16, 'riveted': 96, 'rune': 240, 'stablew': 112,
              'velvet': 80, 'mine': 48, 'rock': 64, 'livewood': 240, 'dungeonw': 64, 'slumw': 64, 'plaster': 64}
def fold_period(weave):
    return weave * math.ceil(P / weave)
TPR = 48               # 시트 가로 칸 수(12프레임 띠가 줄을 넘지 않게 12의 배수)
N = anim4.N            # 12 프레임
FPS = round(1000 / anim4.MS)
OUT_PNG = 'public/assets/atlas-interior/interior-chipset.png'
OUT_DEF = 'src/assets/atlasBiomeInteriorTileset.json'
OUT_SHEET = 'src/assets/atlasBiomeInteriorSheet.json'
OUT_SPEC = 'src/assets/handInteriorSpec.json'
OUT_MAPS = 'tiledata/hand-interior/v5-maps'
META = json.load(open('tiledata/hand-interior/v5/interior-meta.json'))
if PICKS: PICKS.variant_meta(META)
OBJ_META = {o['id']: o for o in META['objects']}
FLOOR_KO = {f['id'][6:]: f['name_ko'] for f in META['floors']}
WALL_KO = {w['id'][5:]: w['name_ko'] for w in META['walls']}
GOODS_KO = {g['id'][6:]: g['name_ko'] for g in META['goods']}

# ---------------------------------------------------------------- 1) 표면을 64px 주기로 접는다
RAW_FLOORFN = dict(TL.FLOORFN); RAW_FACEFN = dict(room2.FACEFN)
FLOORS = sorted(TL.FLOORFN)
WALLS = sorted(set(room2.FACE) | set(room2.FACEFN))
FPX = {n: fold_period(FLOOR_WEAVE[n][0]) for n in FLOORS}; FPY = {n: fold_period(FLOOR_WEAVE[n][1]) for n in FLOORS}
WPX = {w: fold_period(WALL_WEAVE.get(w, 16)) for w in WALLS}
for n, fn in list(TL.FLOORFN.items()):
    TL.FLOORFN[n] = (lambda f, px, py: (lambda X, Y: f(X % px, Y % py)))(fn, FPX[n], FPY[n])
for n, fn in list(room2.FACEFN.items()):
    room2.FACEFN[n] = (lambda f, px: (lambda X, fy: f(X % px, fy)))(fn, WPX[n])
FCOLS = {n: FPX[n] // 16 for n in FLOORS}; FROWS = {n: FPY[n] // 16 for n in FLOORS}; WCOLS = {w: WPX[w] // 16 for w in WALLS}
CEIL_STYLES = ['default'] + list(tiles5.CEILS)
CEIL_RGB = {'default': ((34, 30, 40), (27, 24, 32)), **{k: tuple(tuple(c) for c in v) for k, v in tiles5.CEILS.items()}}
BR = room2.BR
VOID = room2.VOID
mul = room2.mul

# ---------------------------------------------------------------- 칸 사전
class Sheet:
    def __init__(s):
        s.cells = []          # list of frames(list[Image]) ; len 1 static, N animated (N consecutive ids)
        s.info = []           # per id: dict(pass=..., layer=..., label=..., role=..., desc=...)
        s.index = {}          # (bytes..., pass) -> id
        s.strips = []
    def _pad_to_strip(s):
        while len(s.cells) % N:
            s.cells.append(None); s.info.append(None)
    def key(s, frames, pc):
        return (tuple(f.tobytes() for f in frames), pc)
    def add(s, frames, pc, label, role, desc='', tags=()):
        frames = [f.convert('RGBA') for f in frames]
        if len(frames) > 1 and all(f.tobytes() == frames[0].tobytes() for f in frames[1:]): frames = frames[:1]
        k = s.key(frames, pc)
        if k in s.index: return s.index[k]
        if len(frames) > 1:
            s._pad_to_strip(); base = len(s.cells)
            for i, f in enumerate(frames):
                s.cells.append([f]); s.info.append(dict(pc=pc, label=label + (f' (프레임 {i + 1}/{N})' if i else ''), role=role, desc=desc, tags=list(tags), frame=i))
            s.strips.append({'baseTile': base, 'frames': len(frames), 'fps': FPS})
            s.index[k] = base
            return base
        tid = len(s.cells)
        # a static cell may not land inside a later strip slot; strips pad first, so any free position is fine
        s.cells.append(frames); s.info.append(dict(pc=pc, label=label, role=role, desc=desc, tags=list(tags)))
        s.index[k] = tid
        return tid
    def find(s, frames, pc):
        frames = [f.convert('RGBA') for f in frames]
        if len(frames) > 1 and all(f.tobytes() == frames[0].tobytes() for f in frames[1:]): frames = frames[:1]
        return s.index.get(s.key(frames, pc))

SH = Sheet()
BLANK = SH.add([Image.new('RGBA', (16, 16))], 'blank', '빈 칸', 'empty', '투명 빈 칸. 쓰지 않는다.')

def solid(c):
    return Image.new('RGBA', (16, 16), tuple(c) + (255,))
VOID_TILE = SH.add([solid(VOID)], 'wall', '공허(벽 속)', 'wall', '두꺼운 벽 속·건물 밖. 천장 띠가 닿지 않는 막힌 칸.', ('천장', '벽'))

def ceil_cell(style, bits):
    s_in, n_in, w_in, e_in, nv = [(bits >> i) & 1 for i in range(5)]
    im = Image.new('RGBA', (16, 16)); px = im.load()
    c0, c1 = CEIL_RGB[style]
    for ly in range(16):
        for lx in range(16):
            c = (c0 if (lx + ly) % 2 else c1) if style == 'default' else (c1 if (lx + ly) % 2 else c0)   # room2: default odd→first, CEIL[(X+Y)%2]
            if s_in and ly >= 12: c = BR[5] if ly == 12 else (BR[4] if ly == 13 else (BR[2] if ly == 14 else BR[0]))
            if n_in and ly <= 1: c = BR[0] if ly == 0 else BR[3]
            if w_in and lx <= 2: c = BR[0] if lx == 0 else (BR[4] if lx == 1 else BR[3])
            if e_in and lx >= 13: c = BR[0] if lx == 15 else (BR[2] if lx == 14 else BR[3])
            if nv and ly == 0: c = VOID
            px[lx, ly] = tuple(c) + (255,)
    return im
CEIL = {}
for st in CEIL_STYLES:
    CEIL[st] = [SH.add([ceil_cell(st, b)], 'wall', f'천장({st}) 이웃{b:02d}', 'wall',
                       '', ('천장',)) for b in range(32)]

def west_shadow(im):
    px = im.load()
    for ly in range(16):
        for lx in range(6):
            r, g, b, a = px[lx, ly]; px[lx, ly] = mul((r, g, b), 0.62 + 0.06 * lx) + (255,)
    return im
def floor_cell(n, qx, qy, sh):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for ly in range(16):
        for lx in range(16):
            c = TL.FLOORFN[n](qx * 16 + lx, qy * 16 + ly)[:3]
            if sh & 1 and ly < 3: c = mul(c, 0.6 + 0.12 * ly)
            px[lx, ly] = tuple(c) + (255,)
    return west_shadow(im) if sh & 2 else im
FLOOR = {}
for n in FLOORS:
    c_, r_ = FCOLS[n], FROWS[n]
    # 칸마다 긴 설명은 싣지 않는다(프로젝트마다 복제되는 정의 크기) — 규칙은 타일 그룹 설명이 한 번 말한다.
    FLOOR[n] = [SH.add([floor_cell(n, (i // 4) % c_, i // (4 * c_), i % 4)], 'floor', f'바닥 · {FLOOR_KO.get(n, n)}', 'floor',
                       '', ('바닥',))
                for i in range(c_ * r_ * 4)]
    # index = (((y%rows)*cols + x%cols)*4 + sh)
def face_cell(w, col, row, west):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for ly in range(16):
        for lx in range(16):
            X = col * 16 + lx; fy = ly + (row - 1) * 16
            if w in room2.FACEFN: c = room2.FACEFN[w](X, fy)[:3]
            else: r, g, b, _ = room2.FACE[w][X % 16, fy]; c = (r, g, b)
            if w == 'plaster' and X % 64 in (0, 1, 2) and 3 < fy < 14: c = (room2.WD[4] if X % 64 == 0 else room2.WD[3] if X % 64 == 1 else room2.WD[2])
            if fy < 4: c = mul(c, 0.62 + 0.08 * fy)
            px[lx, ly] = tuple(c) + (255,)
    return west_shadow(im) if west else im
WALL = {}
for w in WALLS:
    c_ = WCOLS[w]
    WALL[w] = [SH.add([face_cell(w, (i // 2) % c_, 1 + i // (2 * c_), i % 2)], 'wall', f'벽면 · {WALL_KO.get(w, w)}', 'wall',
                      '', ('벽',))
               for i in range(c_ * 4)]
    # index = (((row-1)*cols + x%cols)*2 + west)

# ---------------------------------------------------------------- 가구·조각을 칸으로 자르기
def item_frames(f, on=()):
    frs = f.frames if getattr(f, 'frames', None) else [f.im]
    if len(frs) == 1 and on and any(g in anim4.GA for g, _, _ in on): frs = [f.im] * N
    out = []
    for t, im in enumerate(frs):
        layer = Image.new('RGBA', im.size); layer.alpha_composite(im)
        if on:
            x0, y0, x1, y1 = f.surf
            for g, fx, fy in on:
                gi = room4.good_img(g, t); gx = int(x0 + fx * (x1 - x0) - gi.width / 2); gy = int(y0 + fy * (y1 - y0) - gi.height + 1)
                layer.alpha_composite(gi, (max(0, min(layer.width - gi.width, gx)), max(0, gy)))
        out.append(layer)
    return out

def is_stairs(f):
    i = getattr(f, 'id', '') or ''
    return i.startswith('stairs up') or i.startswith('stairs down') or i.startswith('stairwell') or getattr(f, 'stairs', None) in ('up', 'down')   # spiral stair = 막힌 장식

def cut(f, x, y, frames):
    """→ {(cx,cy): (frames16[], passclass)} for an item whose footprint top-left is cell (x,y)"""
    X0, Y0, _, _ = room4.item_rect(f, x, y)
    w, h = frames[0].size
    foot = set(room4.cells_of(f, x, y))
    out = {}
    for cy in range(math.floor(Y0 / 16), math.ceil((Y0 + h) / 16)):
        for cx in range(math.floor(X0 / 16), math.ceil((X0 + w) / 16)):
            pcs = []
            for fr in frames:
                c = Image.new('RGBA', (16, 16)); c.alpha_composite(fr, (X0 - cx * 16, Y0 - cy * 16)); pcs.append(c)
            if all(p.getbbox() is None for p in pcs): continue
            if f.kind == 'hang': pc = 'star'
            elif f.kind == 'flat': pc = 'flat'
            elif (cx, cy) in foot: pc = 'stair' if is_stairs(f) else 'solid'
            else: pc = 'star'
            if f.kind == 'flat' and is_stairs(f): pc = 'stair'
            out[(cx, cy)] = (pcs, pc)
    return out

PC_LAYER = {'flat': 2, 'star': 3, 'solid': 3, 'stair': 3}
def obj_label(i):
    m = OBJ_META.get(i)
    return (m['name_ko'] if m else i), (m['category_ko'] if m else ''), (m['description'] if m else '')

OBJECTS = {}
for n, (cat, bf) in OBJ.items():
    f = bf(); f.id = getattr(f, 'id', None) or n
    ko, cko, desc = obj_label(n)
    pieces = cut(f, 0, 0, item_frames(f))
    cells = []
    for (cx, cy), (pcs, pc) in sorted(pieces.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        role = {'flat': 'decor', 'star': 'furniture', 'solid': 'furniture', 'stair': 'stairs'}[pc]
        tid = SH.add(pcs, pc, f'{ko} ({cx},{cy})', role, desc, (cko,) if cko else ())
        cells.append([cx, cy, tid, PC_LAYER[pc]])
    e = {'ko': ko, 'category': cat, 'category_ko': cko, 'kind': f.kind, 'w': f.fw, 'h': f.fh, 'up': f.up, 'cells': cells}
    if getattr(f, 'surf', None): e['surface'] = list(f.surf)
    if getattr(f, 'frames', None): e['animated'] = True
    if is_stairs(f): e['stairs'] = 'up' if n.startswith('stairs up') else 'down'
    if getattr(f, 'cells', None): e['footprint'] = [list(c) for c in f.cells]
    OBJECTS[n] = e

TABLES = {}
for st in STY:
    up = STY[st]['up']; e = {'ko': STY[st].get('ko', st), 'up': up, 'oneRow': kit4.ONE_ROW(st), 'pieces': {}}
    kind = 'wall' if st == 'sideboard' else 'floor'
    for (cc, rc), im in sorted(PIECES[st].items()):
        first = rc in ('S', 'T')
        f = kit4.F(im, 1, 1, up if first else 0, kind)
        cells = []
        for (cx, cy), (pcs, pc) in sorted(cut(f, 0, 0, [im]).items(), key=lambda kv: (kv[0][1], kv[0][0])):
            tid = SH.add(pcs, pc, f'{e["ko"]} 자동 타일 {cc}{rc} ({cx},{cy})', 'furniture', f'{e["ko"]} 자동 타일 조각(열 {cc}·줄 {rc}). 윗면에 탁상 물건을 올린다.', ('탁자',))
            cells.append([cx, cy, tid, 3])
        e['pieces'][cc + rc] = cells
    TABLES[st] = e

import chapel5
DAISES = {}
DAIS_KO = {'marble': '대리석', 'wood': '나무', 'stone': '돌'}
for kind, fn, mats in (('dais', kit5.dais, ('marble', 'wood', 'stone')), ('dais-w', chapel5.dais_w, ('marble', 'stone'))):
    for mat in mats:
        pieces = {}
        for Wc in (1, 2, 3, 4):
            for Hc in (1, 2, 3, 4):
                im = fn(Wc, Hc, mat).im
                for j in range(Hc):
                    rc = 'S' if Hc == 1 else ('T' if j == 0 else 'B' if j == Hc - 1 else 'M')
                    for i in range(Wc):
                        cc = 'S' if Wc == 1 else ('L' if i == 0 else 'R' if i == Wc - 1 else 'M')
                        k = f'{cc}{rc}{(i + j) % 2}'
                        c = im.crop((i * 16, j * 16, i * 16 + 16, j * 16 + 16))
                        if k in pieces: assert pieces[k].tobytes() == c.tobytes(), (kind, mat, k, Wc, Hc)
                        else: pieces[k] = c
        ko = ('서쪽 계단 단' if kind == 'dais-w' else '단') + f'({DAIS_KO[mat]})'
        DAISES[f'{kind} {mat}'] = {'ko': ko, 'pieces': {k: SH.add([c], 'flat', f'{ko} {k}', 'decor', f'{ko} 조각(열·줄·체크 칸). 밟는 단 — 바닥 무늬 2층.', ('단',)) for k, c in sorted(pieces.items())}}

def piece_key(m, ic): return (m or '0') + ('+' + ic if ic else '')
def all_line_pieces(K):
    # every 4-mask with every combination of inner corners, in mask_at's order (Ne Es Sw Wn)
    out = {}
    for n in range(16):
        m = ''.join(d for i, (d, _, _) in enumerate(kit5.DIRS) if n >> i & 1)
        opts = [a + b.lower() for a, b in (('N', 'E'), ('E', 'S'), ('S', 'W'), ('W', 'N')) if a in m and b in m]
        for k in range(1 << len(opts)):
            ic = ''.join(o for j, o in enumerate(opts) if k >> j & 1)
            out[(m, ic)] = K.piece(m, ic)
    return out
LINES = {}
for name, K in LINEKITS.items():
    up = getattr(K, 'up', 0); e = {'ko': K.ko, 'kind': K.kind, 'up': up, 'pieces': {}}
    for (m, ic), im in sorted(all_line_pieces(K).items()):
        f = kit4.F(im, 1, 1, up, K.kind)
        cells = []
        for (cx, cy), (pcs, pc) in sorted(cut(f, 0, 0, [im]).items(), key=lambda kv: (kv[0][1], kv[0][0])):
            tid = SH.add(pcs, pc, f'{K.ko} {piece_key(m, ic)} ({cx},{cy})', 'decor' if pc == 'flat' else 'furniture',
                         f'{K.ko}. 칸 목록의 4방 이웃(N E S W)과 안쪽 모서리로 고르는 조각.', ('자동 타일',))
            cells.append([cx, cy, tid, PC_LAYER[pc]])
        e['pieces'][piece_key(m, ic)] = cells
    LINES[name] = e

GOODS = {}
for g in list(G) + list(anim4.GA):
    frs = [room4.good_img(g, t) for t in range(N)] if g in anim4.GA else [room4.good_img(g)]
    cells = []
    for gi in frs:
        c = Image.new('RGBA', (16, 16)); c.alpha_composite(gi, ((16 - gi.width) // 2, 12 - gi.height)); cells.append(c)
    GOODS[g] = SH.add(cells, 'goods', f'탁상 물건 · {GOODS_KO.get(g, g)}', 'prop', '가구 윗면(4층)에 얹는 작은 물건. 바닥에 두지 않는다.', ('탁상 물건',))
LIBRARY_END = len(SH.cells)

# ---------------------------------------------------------------- 구조(평면 문자열 → 1층) — TS 조립기와 같은 규칙
def structure(plan, floor, wall, zones, ceil_style):
    W, H, g, face, top, inn = room2.analyse(plan)
    def mat(x, y):
        f, w = floor, wall
        for z in zones:
            x0, y0, x1, y1, ff, ww = z
            if x0 <= x <= x1 and y0 <= y <= y1: f, w = ff or f, ww or w
        return f, w
    lower = []
    for cy in range(H):
        for cx in range(W):
            f, w = mat(cx, cy)
            west = 0 if inn(cx - 1, cy) else 1
            if g[cy][cx] and face[cy][cx]:
                lower.append(WALL[w][(((face[cy][cx] - 1) * WCOLS[w] + cx % WCOLS[w]) * 2) + west])
            elif g[cy][cx]:
                sh = (1 if (cy > 0 and face[cy - 1][cx]) else 0) | (2 if west else 0)
                lower.append(FLOOR[f][((cy % FROWS[f]) * FCOLS[f] + cx % FCOLS[f]) * 4 + sh])
            elif top[cy][cx]:
                nv = 1 if cy == 0 else (0 if (inn(cx, cy - 1) or top[cy - 1][cx]) else 1)
                b = (1 if inn(cx, cy + 1) else 0) | (2 if inn(cx, cy - 1) else 0) | (4 if inn(cx - 1, cy) else 0) | (8 if inn(cx + 1, cy) else 0) | (16 * nv)
                lower.append(CEIL[ceil_style][b])
            else:
                lower.append(VOID_TILE)
    return W, H, lower

def tile_img(tid, t=0):
    frs = SH.cells[tid]
    if frs is None: return None
    strip = next((s for s in SH.strips if s['baseTile'] <= tid < s['baseTile'] + s['frames']), None)
    if strip: return SH.cells[strip['baseTile'] + (t % strip['frames'])][0]
    return frs[0]

def stack_render(W, H, layers, t=0):
    im = Image.new('RGBA', (W * 16, H * 16))
    for L in layers:
        for i, tid in enumerate(L):
            if tid is None or tid < 0: continue
            c = tile_img(tid, t)
            if c is not None: im.alpha_composite(c, ((i % W) * 16, (i // W) * 16))
    return im

def composite(entries):
    """entries: list of (frames16[], pc) in draw order → (frames16[], pc)"""
    n = max(len(e[0]) for e in entries)
    frs = []
    for t in range(n):
        c = Image.new('RGBA', (16, 16))
        for pcs, _ in entries: c.alpha_composite(pcs[t % len(pcs)])
        frs.append(c)
    pcs = [e[1] for e in entries]
    pc = 'solid' if 'solid' in pcs else ('stair' if 'stair' in pcs else ('flat' if all(p == 'flat' for p in pcs) else 'star'))
    return frs, pc

def place(frames, pc, label):
    tid = SH.find(frames, pc)
    if tid is None: tid = SH.add(frames, pc, label, 'furniture' if pc in ('solid', 'star') else 'decor', '예제 맵 합성 칸(탁상 물건을 얹은 가구·겹친 조각). 사전 칸으로는 같은 모양을 만들 수 없어 구운 칸.', ('합성',))
    return tid

GRID_WALK = set('.cuSD,')
def convert(key, b, m):
    ceil_style = next((k for k, v in tiles5.CEILS.items() if tuple(tuple(c) for c in v) == tuple(tuple(c) for c in m['ceil'])), 'default') if m.get('ceil') else 'default'
    zones = m.get('zones', ())
    W, H, lower = structure(m['plan'], m['floor'], m['wall'], zones, ceil_style)
    # verify the structure layer against the (periodic) v5 base render, before lights
    room2.CEIL = m.get('ceil'); base = room2.render(m['plan'], m['floor'], m['wall'], zones); room2.CEIL = None
    ref0 = stack_render(W, H, [lower])
    struct_diff = sum(1 for a, c in zip(ref0.get_flattened_data(), base.get_flattened_data()) if a != c)
    # window light: bake the lit floor cells (residual)
    if m.get('lights'):
        px = base.load()
        for (wx, wy) in m['lights']:
            for Y in range((wy + 2) * 16, (wy + 4) * 16):
                sh = (Y - (wy + 2) * 16) // 3
                for X in range(wx * 16 + 2 + sh, wx * 16 + 14 + sh):
                    if X < base.width and Y < base.height:
                        r, g2, bb, a = px[X, Y]; px[X, Y] = (min(255, int(r * 1.18 + 8)), min(255, int(g2 * 1.16 + 8)), min(255, int(bb * 1.1 + 6)), a)
        for i in range(W * H):
            cx, cy = i % W, i // W
            c = base.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16))
            if c.tobytes() != tile_img(lower[i]).tobytes():
                lower[i] = SH.find([c], 'floor') if SH.find([c], 'floor') is not None else SH.add([c], 'floor', f'{m["name"]} 창 빛 바닥', 'floor', '창으로 든 빛이 닿은 바닥(예제 맵에서 구운 칸).', ('바닥', '빛'))
    # items → per-cell entries in draw order
    per = {}
    for order, it in enumerate(m['items']):
        f, x, y = it[:3]; on = it[3] if len(it) > 3 else ()
        key_ = y * 16 if f.kind == 'hang' else (-1 if f.kind == 'flat' else (y + f.fh) * 16)
        for (cx, cy), (pcs, pc) in cut(f, x, y, item_frames(f, on)).items():
            if not (0 <= cx < W and 0 <= cy < H): continue
            per.setdefault((cx, cy), []).append((key_, order, pcs, pc, getattr(f, 'id', '') or ''))
    L2 = [-1] * (W * H); L3 = [-1] * (W * H); L4 = [-1] * (W * H)
    over2 = 0
    for (cx, cy), es in per.items():
        es.sort(key=lambda e: (e[0], e[1]))
        i = cy * W + cx
        flats = [e for e in es if e[3] == 'flat' or (e[0] == -1)]
        rest = [e for e in es if not (e[3] == 'flat' or e[0] == -1)]
        if flats and (SH.info[lower[i]] or {}).get('pc') != 'floor':
            # 원본이 깔개를 벽면·천장 위까지 그린 칸: 밟는 무늬 칸을 올리면 엔진이 그 벽을 걸을 수 있게 만든다
            # → 그림은 그대로 두고 1층 구조 칸에 구워 막힘으로 둔다.
            frs, _ = composite([([tile_img(lower[i])], 'wall')] + [(e[2], e[3]) for e in flats])
            lower[i] = place(frs, 'wall', f'{m["name"]} 벽 위 깔개 끝 ({cx},{cy})')
        elif flats:
            frs, pc = composite([(e[2], e[3]) for e in flats]) if len(flats) > 1 else (flats[0][2], flats[0][3])
            L2[i] = place(frs, pc, f'{m["name"]} 바닥 무늬 ({cx},{cy})')
        if len(rest) == 1:
            L3[i] = place(rest[0][2], rest[0][3], f'{m["name"]} {rest[0][4]} ({cx},{cy})')
        elif len(rest) >= 2:
            if len(rest) > 2: over2 += 1
            head = rest[:-1]
            frs, pc = composite([(e[2], e[3]) for e in head]) if len(head) > 1 else (head[0][2], head[0][3])
            L3[i] = place(frs, pc, f'{m["name"]} 겹친 조각 ({cx},{cy})')
            L4[i] = place(rest[-1][2], rest[-1][3], f'{m["name"]} {rest[-1][4]} ({cx},{cy})')
    return dict(key=key, W=W, H=H, lower=lower, L2=L2, L3=L3, L4=L4, struct_diff=struct_diff, over2=over2, m=m, b=b, ceil=ceil_style)

MAPS = [convert(m['key'], b, m) for k, b, m in rooms4.all_maps()]

# ---------------------------------------------------------------- 칸 번호 고정 (pin_ids.py — 이미 깐 맵이 다시 굽기에 깨지지 않게)
import pin_ids
PREV = pin_ids.load_previous(OUT_SPEC, OUT_DEF, OUT_PNG, f'{OUT_MAPS}/maps.json')
OLD_DEF, PIN_STATS = None, None
def map_id(key): return f'hand-{key.replace("_", "-")}'
if PREV:
    old_slots, OLD_DEF, old_png = PREV
    new_slots = pin_ids.slots(BLANK, VOID_TILE, FLOOR, WALL, CEIL, {n: e['cells'] for n, e in OBJECTS.items()},
                              {n: e['pieces'] for n, e in TABLES.items()}, {n: e['pieces'] for n, e in LINES.items()},
                              {n: e['pieces'] for n, e in DAISES.items()}, GOODS,
                              {map_id(mp['key']): {L: mp[L] for L in ('lower', 'L2', 'L3', 'L4')} for mp in MAPS})
    perm, legacy, final_count, PIN_STATS = pin_ids.plan(
        new_slots, old_slots, {s_['baseTile']: s_['frames'] for s_ in SH.strips}, {s_['baseTile']: s_['frames'] for s_ in OLD_DEF['animationStrips']},
        len(SH.cells), OLD_DEF['count'], N, skip={t for t, c in enumerate(SH.cells) if c is None})
    def RM(t): return perm[t] if t >= 0 else t
    cells, info = [None] * final_count, [None] * final_count
    for nt, ft in perm.items(): cells[ft], info[ft] = SH.cells[nt], SH.info[nt]
    legacy_set = set(legacy)
    for t in legacy:
        cells[t] = [old_png.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))]; info[t] = {'legacy': t}
    SH.cells, SH.info = cells, info
    SH.strips = sorted([{**s_, 'baseTile': RM(s_['baseTile'])} for s_ in SH.strips] + [s_ for s_ in OLD_DEF['animationStrips'] if s_['baseTile'] in legacy_set], key=lambda s_: s_['baseTile'])
    SH.index = {k: RM(v) for k, v in SH.index.items()}
    BLANK, VOID_TILE = RM(BLANK), RM(VOID_TILE)
    for d in (CEIL, FLOOR, WALL): d.update({k: [RM(t) for t in v] for k, v in d.items()})
    for e in OBJECTS.values(): e['cells'] = [[dx, dy, RM(t), L] for dx, dy, t, L in e['cells']]
    for d in (TABLES, LINES): [e['pieces'].update({k: [[dx, dy, RM(t), L] for dx, dy, t, L in v] for k, v in e['pieces'].items()}) for e in d.values()]
    for e in DAISES.values(): e['pieces'] = {k: RM(t) for k, t in e['pieces'].items()}
    GOODS.update({k: RM(t) for k, t in GOODS.items()})
    for mp in MAPS:
        for L in ('lower', 'L2', 'L3', 'L4'): mp[L] = [RM(t) for t in mp[L]]
    print('pin', PIN_STATS, 'count', OLD_DEF['count'], '->', final_count, flush=True)

# ---------------------------------------------------------------- 통행 정의
PASS = {'up': True, 'down': True, 'left': True, 'right': True}
SOLID = {'up': False, 'down': False, 'left': False, 'right': False}
def pass_of(pc):
    return {'blank': (SOLID, 'lower'), 'wall': (SOLID, 'lower'), 'floor': (PASS, 'lower'), 'flat': (PASS, 'lower'), 'stair': (PASS, 'lower'),
            'star': (PASS, 'upper'), 'solid': (SOLID, 'upper'), 'goods': (SOLID, 'upper')}[pc]
def tile_pass(tid):
    inf = SH.info[tid]
    return pass_of(inf['pc'])[0] if inf else SOLID
def is_star(tid):
    inf = SH.info[tid]; return bool(inf) and inf['pc'] == 'star'
def cell_walk(mp, i):
    base = mp['lower'][i]
    if not tile_pass(base)['up']: return False
    for L in (mp['L4'], mp['L3'], mp['L2']):
        t = L[i]
        if t < 0 or is_star(t): continue
        return tile_pass(t)['up']
    return True

report = []
for mp in MAPS:
    m = mp['m']; W, H = mp['W'], mp['H']
    grid = next(mm for bb in META['buildings'] for mm in bb['maps'] if mm['id'] == mp['key'])['grid']
    diff_walk = [(x, y) for y in range(H) for x in range(W) if cell_walk(mp, y * W + x) != (grid[y][x] in GRID_WALK)]
    # BFS from the entrance (bottom row inside cells) or the start cells
    start = [tuple(s) for s in (m.get('start') or [(x, H - 1) for x in range(W) if grid[H - 1][x] in GRID_WALK])]
    seen = set(s for s in start if cell_walk(mp, s[1] * W + s[0])); q = list(seen)
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            X, Y = x + dx, y + dy
            if 0 <= X < W and 0 <= Y < H and (X, Y) not in seen and cell_walk(mp, Y * W + X): seen.add((X, Y)); q.append((X, Y))
    unreached = [(x, y) for y in range(H) for x in range(W) if grid[y][x] in '.cuSD' and (x, y) not in seen]
    # pixel check against room4.compose with the same periodic surfaces, every frame
    px_diff = 0
    for t in range(N):
        ref = room4.compose(m, t); got = stack_render(W, H, [mp['lower'], mp['L2'], mp['L3'], mp['L4']], t)
        px_diff += sum(1 for a, c in zip(ref.get_flattened_data(), got.get_flattened_data()) if a != c)
        if t == 0:
            # 원본(주기 없는 표면) 대비 — 접은 표면이 원본과 얼마나 같은지
            fl, fa = dict(TL.FLOORFN), dict(room2.FACEFN); TL.FLOORFN.update(RAW_FLOORFN); room2.FACEFN.update(RAW_FACEFN)
            orig = room4.compose(m, 0); TL.FLOORFN.update(fl); room2.FACEFN.update(fa)
            od = orig.get_flattened_data(); gd = got.get_flattened_data()
            orig_same = sum(1 for a, c in zip(od, gd) if a == c) / max(1, len(gd))
            os.makedirs(f'{OUT_MAPS}/render', exist_ok=True)
            got.save(f'{OUT_MAPS}/render/{mp["key"]}.png'); ref.save(f'/tmp/hand-interior-ref-{mp["key"]}.png')
    mp['seen'] = seen
    report.append({'map': mp['key'], 'size': [W, H], 'structDiffPx': mp['struct_diff'], 'pixelDiffAllFrames': px_diff,
                   'walkMismatch': len(diff_walk), 'walkMismatchCells': diff_walk[:12], 'unreached': unreached[:12],
                   'reachable': len(seen), 'cellsOver2': mp['over2'], 'sameAsUnfoldedOriginal': round(orig_same, 4)})

# ---------------------------------------------------------------- 시트·정의 쓰기
count = len(SH.cells)
rows = math.ceil(count / TPR)
sheet = Image.new('RGBA', (TPR * 16, rows * 16))
for tid, frs in enumerate(SH.cells):
    if frs is None: continue
    sheet.alpha_composite(frs[0], ((tid % TPR) * 16, (tid // TPR) * 16))
os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
sheet.save(OUT_PNG, optimize=True)
passability, priority, terrain, tileMeta = [], [], [], []
PASSAGE_KO = {'blank': 'solid', 'wall': 'solid', 'floor': 'passable', 'flat': 'passable', 'stair': 'passable', 'star': 'passable', 'solid': 'solid', 'goods': 'solid'}
for tid in range(count):
    inf = SH.info[tid]
    if inf is not None and 'legacy' in inf:   # 아무도 안 쓰는 옛 칸: 옛 정의 그대로(옛 맵 호환)
        o = inf['legacy']; m_ = dict(OLD_DEF['tileMeta'][o]); LEG = '옛 굽기 칸(옛 맵 호환용) — 새로 쓰지 않는다. '
        if m_.get('label') and not m_.get('description', '').startswith(LEG): m_['description'] = LEG + m_.get('description', '')
        passability.append(OLD_DEF['passability'][o]); priority.append(OLD_DEF['priority'][o]); terrain.append(OLD_DEF['terrain'][o]); tileMeta.append(m_); continue
    if inf is None:
        passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
        tileMeta.append({'label': '', 'description': '빈 칸(움직임 띠 정렬).', 'source': 'unknown'}); continue
    p, pr = pass_of(inf['pc'])
    passability.append(dict(p)); priority.append(pr); terrain.append(0)
    home = 'lower' if inf['pc'] in ('floor', 'wall', 'blank') else ('lower' if inf['pc'] == 'flat' else 'upper')
    meta = {'label': inf['label'], 'description': inf['desc'], 'role': inf['role'], 'passage': PASSAGE_KO[inf['pc']],
            'defaultLayer': home, 'tags': ['손 도트 실내'] + inf['tags'], 'source': 'bundled-default', 'confidence': 'high',
            'repeatability': 'repeat' if inf['pc'] in ('floor', 'wall') else 'fixed'}
    if inf['pc'] == 'star': meta['description'] = (meta['description'] + ' 솟은 칸·걸이(★): 캐릭터 위에 그리고 통행은 아래 층이 정한다.').strip()
    if inf['pc'] in ('flat', 'stair'):
        # 밟는 무늬·계단: 붓 홈은 위층(바닥을 지우지 않는다), priority 는 lower(o — 캐릭터 밑에 그리고 칸을 걸을 수 있게 정한다).
        # 커스텀 칩셋의 홈은 priority 를 따르므로 잠근 defaultLayer 로 홈만 따로 준다(runtimeTileMetadata.userTileLayerOverride).
        meta['defaultLayer'] = 'upper'; meta['locked'] = True
        meta['description'] = (meta['description'] + ' 밟는 칸(o): 붓은 위층에 깔고(바닥 유지), 캐릭터 밑에 그린다. 조립 도구는 2층에 둔다.').strip()
    tileMeta.append(meta)

def flat_ids(e): return sorted({c[2] for c in e})
tileGroups = []
for n in FLOORS:
    tileGroups.append({'id': f'hand-interior:floor:{n}', 'name': f'바닥 · {FLOOR_KO.get(n, n)}', 'role': 'floor', 'defaultLayer': 'lower', 'tileIds': FLOOR[n],
                       'description': f'손 도트 실내 바닥 {FLOOR_KO.get(n, n)}: {FCOLS[n] * FROWS[n] * 4}칸 = {FCOLS[n]}×{FROWS[n]} 위치(칸 x%{FCOLS[n]}, y%{FROWS[n]}) × 그림자 4(없음·벽면 밑 접촉·서쪽·둘 다). 번호 = 첫 칸 + ((y%{FROWS[n]})*{FCOLS[n]} + x%{FCOLS[n]})*4 + 그림자.',
                       'placementRules': '방 바닥. build_hand_interior_room 이 평면 문자열에서 자동으로 고른다.', 'source': 'bundled-default', 'confidence': 'high'})
for w in WALLS:
    tileGroups.append({'id': f'hand-interior:wall:{w}', 'name': f'벽면 · {WALL_KO.get(w, w)}', 'role': 'wall', 'defaultLayer': 'lower', 'tileIds': WALL[w],
                       'description': f'손 도트 실내 벽면 {WALL_KO.get(w, w)}: {WCOLS[w] * 4}칸 = 윗줄/아랫줄 × {WCOLS[w]}열(x%{WCOLS[w]}) × 서쪽 그림자. 번호 = 첫 칸 + ((줄*{WCOLS[w]} + x%{WCOLS[w]})*2 + 서쪽).',
                       'placementRules': '막힌 칸 바로 아래 두 줄. 이어진 벽 하나에 재질 하나.', 'source': 'bundled-default', 'confidence': 'high'})
for st in CEIL_STYLES:
    tileGroups.append({'id': f'hand-interior:ceiling:{st}', 'name': f'천장 · {st}', 'role': 'wall', 'defaultLayer': 'lower', 'tileIds': CEIL[st],
                       'description': '천장 띠 32칸 = 비트(1 남쪽 안·2 북쪽 안·4 서쪽 안·8 동쪽 안·16 북쪽 공허). 안에 닿는 변마다 밝은 테두리.',
                       'placementRules': '실내에 닿는 막힌 칸. 안에 닿지 않는 막힌 칸은 공허 칸.', 'source': 'bundled-default', 'confidence': 'high'})
tileGroups.append({'id': 'hand-interior:void', 'name': '공허', 'role': 'wall', 'defaultLayer': 'lower', 'tileIds': [VOID_TILE], 'description': '벽 속·건물 밖.', 'placementRules': '안쪽에 닿지 않는 막힌 칸.', 'source': 'bundled-default', 'confidence': 'high'})
tileGroups.append({'id': 'hand-interior:goods', 'name': '탁상 물건', 'role': 'prop', 'defaultLayer': 'upper', 'tileIds': sorted(set(GOODS.values())),
                   'description': '가구 윗면(4층)에 얹는 작은 물건 119종.', 'placementRules': '표면이 있는 가구 칸 위 4층에만.', 'source': 'bundled-default', 'confidence': 'high'})

# autotile groups (brush): ceilings (4-neighbour, bit set = neighbour is ceiling/void) and flat line kits (8-neighbour, upper)
autotileGroups = []
all_ceiling = sorted({t for st in CEIL_STYLES for t in CEIL[st]} | {VOID_TILE})
for st in CEIL_STYLES:
    vm = {}
    for mask in range(16):
        n_c, e_c, s_c, w_c = mask & 1, mask & 2, mask & 4, mask & 8
        bits = (0 if s_c else 1) | (0 if n_c else 2) | (0 if w_c else 4) | (0 if e_c else 8)
        vm[str(mask)] = CEIL[st][bits]
    autotileGroups.append({'id': f'hand-interior:ceiling:{st}', 'name': f'손 도트 천장 · {st}', 'neighborhood': 4, 'memberTileIds': sorted(set(vm.values())),
                           'connectTileIds': all_ceiling, 'variantMap': vm, 'layer': 'lower', 'edgeConnects': True})
DIR8 = [('N', 0, -1, 1), ('E', 1, 0, 2), ('S', 0, 1, 4), ('W', -1, 0, 8), ('NE', 1, -1, 16), ('SE', 1, 1, 32), ('SW', -1, 1, 64), ('NW', -1, -1, 128)]
for name, e in LINES.items():
    if e['kind'] != 'flat' or e['up']: continue
    vm = {}
    for mask in range(256):
        cells = {(0, 0)} | {(dx, dy) for _, dx, dy, bit in DIR8 if mask & bit}
        mm, ic = mask_at(cells, 0, 0)
        pcs = e['pieces'][piece_key(mm, ic)]
        vm[str(mask)] = next(c[2] for c in pcs if c[0] == 0 and c[1] == 0)
    autotileGroups.append({'id': f'hand-interior:line:{name}', 'name': f'손 도트 {e["ko"]}', 'neighborhood': 8, 'memberTileIds': sorted(set(vm.values())),
                           'variantMap': vm, 'layer': 'upper'})

structureKits = []
for n, e in OBJECTS.items():
    xs = [c[0] for c in e['cells']]; ys = [c[1] for c in e['cells']]
    if not xs: continue
    x0, y0 = min(xs), min(ys); Wk, Hk = max(xs) - x0 + 1, max(ys) - y0 + 1
    grid_ = [[-1] * Wk for _ in range(Hk)]
    for cx, cy, tid, _ in e['cells']: grid_[cy - y0][cx - x0] = tid
    m = OBJ_META.get(n, {})
    rules = '; '.join(m.get('placement', [])) or e['kind']
    structureKits.append({'id': f'hand-interior:{n}', 'kind': 'section', 'name': e['ko'], 'width': Wk, 'height': Hk,
                          'rows': [{'tiles': [-1] * Wk, 'upperTiles': r} for r in grid_],
                          'ai': {'snap': 'wall' if e['kind'] in ('wall', 'hang') else 'floor', 'tags': ['손 도트 실내', e['category_ko'] or e['category']], 'origin': 'ai',
                                 'layerHome': 'upper', 'description': (m.get('description') or e['ko'])[:400], 'repeatability': 'fixed', 'placementRules': rules[:400],
                                 'anchor': {'dx': -x0, 'dy': -y0}},
                          'learnedFrom': 'hand-interior-v5'})

# spec for build_hand_interior_room (TS). Tile ids only; every rule the builder needs is here.
# 소품 설명·태그·놓는 곳·짝 소품, 방 종류·건물 → 자주 쓰는 가구(tiledata/hand-interior/v5/notes6.py). 조수 도구 list_hand_interior_parts 가 쓴다.
NOTES, ROOM_TABLE = notes6.spec_notes(META, set(OBJECTS), set(TABLES), set(LINES), set(DAISES))
for n, e in OBJECTS.items(): e.update(NOTES[n])
PICKED = None
if PICKS:
    R = PICKS.REPORT
    PICKED = {'picks': 'tiledata/hand-interior/pick/picks.json', 'applied': len(R['applied']), 'resized': len(R['resized']), 'variants': len(R['variants']), 'skipped': len(R['skipped'])}
    os.makedirs('tiledata/hand-interior/pick/out', exist_ok=True)
    json.dump(dict(PICKED, **R), open('tiledata/hand-interior/pick/out/baked.json', 'w'), ensure_ascii=False, indent=1)
spec = {'version': 1, 'source': 'tiledata/hand-interior/v5', **({'picked': PICKED} if PICKED else {}), 'tileSize': 16, 'blank': BLANK, 'void': VOID_TILE,
        'floors': {n: {'ko': FLOOR_KO.get(n, n), 'cols': FCOLS[n], 'rows': FROWS[n], 'tiles': FLOOR[n]} for n in FLOORS},
        'walls': {w: {'ko': WALL_KO.get(w, w), 'cols': WCOLS[w], 'tiles': WALL[w]} for w in WALLS},
        'ceilings': {st: CEIL[st] for st in CEIL_STYLES},
        'objects': OBJECTS, 'tables': TABLES, 'lines': LINES, 'daises': DAISES, 'goods': GOODS, 'rooms': ROOM_TABLE}
data = {'id': 'atlas_biome_interior', 'name': '실내 · 손 도트 v5 (아틀라스)', 'textureKey': 'tex_atlas_biome_interior', 'family': 'oprn-atlas',
        'tileSize': 16, 'tilesPerRow': TPR, 'count': count, 'libraryEnd': LIBRARY_END,
        'passability': passability, 'priority': priority, 'terrain': terrain, 'tileMeta': tileMeta,
        'tileGroups': tileGroups, 'autotileGroups': autotileGroups, 'animationStrips': SH.strips, 'structureKits': structureKits}
json.dump(data, open(OUT_DEF, 'w'), ensure_ascii=False, separators=(',', ':'))
open(OUT_DEF, 'a').write('\n')
json.dump({'count': count, 'tilesPerRow': TPR}, open(OUT_SHEET, 'w')); open(OUT_SHEET, 'a').write('\n')
json.dump(spec, open(OUT_SPEC, 'w'), ensure_ascii=False, separators=(',', ':')); open(OUT_SPEC, 'a').write('\n')

# ---------------------------------------------------------------- 예제 맵
def transfer_event(eid, name, x, y, to, tx, ty, direction):
    page = {'id': f'{eid}-p1', 'name': '1', 'conditions': [], 'graphic': {}, 'trigger': {'kind': 'playerTouch'}, 'priority': 'below', 'overlapForbidden': False,
            'movement': {'type': 'fixed', 'speed': 3, 'frequency': 3},
            'commands': [{'kind': 'transfer', 'mapId': to, 'x': tx, 'y': ty, 'direction': direction, 'fade': 'black'}]}
    return {'id': eid, 'name': name, 'x': x, 'y': y, 'trigger': {'kind': 'playerTouch'}, 'commands': [], 'pages': [page]}
MAP_ID = {mp['key']: f'hand-{mp["key"].replace("_", "-")}' for mp in MAPS}
out_maps = {}; plans = []
for mp in MAPS:
    m = mp['m']; W, H = mp['W'], mp['H']
    events = []
    for li, ln in enumerate(m.get('links', ())):
        if ln['to'] not in MAP_ID: continue
        tgt = next(t for t in MAPS if t['key'] == ln['to'])
        # arrive on the walkable cell just south of the target stairs (not on the stairs: no bounce)
        tx, ty = ln['toX'] + 1, ln['toY'] + 1
        for dx in range(ln.get('w', 1)):
            events.append(transfer_event(f'{MAP_ID[mp["key"]]}-stairs-{li}-{dx}', ('위층으로' if ln['kind'] == 'stairs_up' else '아래층으로'),
                                         ln['x'] + dx, ln['y'], MAP_ID[ln['to']], tx, ty, 'down'))
    start = [tuple(s) for s in (m.get('start') or [(x, H - 1) for x in range(W) if (x, H - 1) in mp['seen']])]
    out_maps[MAP_ID[mp['key']]] = {'id': MAP_ID[mp['key']], 'name': f'손 도트 · {m["name"]}', 'width': W, 'height': H, 'tilesetId': 'atlas_biome_interior', 'tileSize': 16,
                                    'lowerTiles': mp['lower'], 'lowerOverlayTiles': mp['L2'], 'upperTiles': mp['L3'], 'upperOverlayTiles': mp['L4'], 'events': events,
                                    'climate': {'mode': 'indoor'}}
    plans.append({'id': MAP_ID[mp['key']], 'key': mp['key'], 'building': mp['b']['name'], 'name': m['name'], 'floor': m['floor'], 'wall': m['wall'],
                  'zones': [list(z) for z in m.get('zones', ())], 'ceil': mp['ceil'], 'plan': m['plan'], 'rooms': [list(r) for r in m.get('rooms', ())],
                  'entry': list(start[len(start) // 2]) if start else [W // 2, H - 1], 'links': m.get('links', [])})
os.makedirs(OUT_MAPS, exist_ok=True)
json.dump({'tilesetId': 'atlas_biome_interior', 'maps': out_maps, 'plans': plans}, open(f'{OUT_MAPS}/maps.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(report, open(f'{OUT_MAPS}/check.json', 'w'), ensure_ascii=False, indent=1)
# 예제 맵의 가구 목록·정답 격자(META buildings). 고른 후보로 크기를 바꾼 가구는 새 자리·칸 수로 고쳐져 있다 — prepare-references 가 이것으로 도구 인자를 만든다.
json.dump(META['buildings'], open(f'{OUT_MAPS}/buildings.json', 'w'), ensure_ascii=False, separators=(',', ':')); open(f'{OUT_MAPS}/buildings.json', 'a').write('\n')
print('cells', count, 'library', LIBRARY_END, 'residual', count - LIBRARY_END, 'strips', len(SH.strips), 'sheet', sheet.size,
      'objects', len(OBJECTS), 'tables', len(TABLES), 'lines', len(LINES), 'goods', len(GOODS), 'kits', len(structureKits), 'maps', len(MAPS))
bad = [r for r in report if r['structDiffPx'] or r['pixelDiffAllFrames'] or r['walkMismatch'] or r['unreached']]
for r in report: print(r['map'], r['size'], 'struct', r['structDiffPx'], 'px', r['pixelDiffAllFrames'], 'walk', r['walkMismatch'], r['walkMismatchCells'][:4], 'unreached', r['unreached'][:4], 'over2', r['cellsOver2'])
print('BAD', len(bad))
if PICKS: print('picks: applied', PICKED['applied'], 'resized', PICKED['resized'], 'variants', PICKED['variants'], 'skipped', PICKED['skipped'], '→ tiledata/hand-interior/pick/out/baked.json')

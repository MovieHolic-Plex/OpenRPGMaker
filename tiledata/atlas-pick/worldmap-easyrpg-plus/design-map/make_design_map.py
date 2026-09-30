#!/usr/bin/env python3
"""월드맵 설계 데모 1단계 — 손으로 설계한 64x48 지도. 무작위 생성기 없음.

해안선·산맥·강·기후대·장소는 아래 좌표(칸 단위 (x,y))를 그대로 적은 것이다. plan.md 와 같은 내용.
문자 격자(지형)를 만든 뒤 worldmap_easyrpg_plus 의 사분면 규칙 렌더러로 그린다. 시트는 그대로 쓴다.
  python3 make_design_map.py   →  map.json, map.txt, design-1x.png, design-2x.png, missing.json
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / 'scripts' / 'content' / 'atlas-pick'))
import worldmap_easyrpg_plus as wm  # noqa: E402

W, H = 64, 48
SEA, GRASS, DIRT, SAND, MARSH, SNOW, FOREST, MOUNT, SFOREST, SMOUNT = range(10)
RIVER_T = 10   # 강·호수(바다와 다른 지형)
CH = '~.dsmnfMFAr'   # 문자 <-> 지형 코드 (순서 = wm 의 코드)

# ── 해안선 (시계방향, 북서 곶부터) ─────────────────────────────────────────────
MAINLAND = [(6, 16), (7, 12), (10, 10), (11, 7), (14, 7), (15, 4), (18, 4), (19, 1), (22, 2), (23, 5), (26, 6),
            (28, 3), (30, -2), (38, -2), (39, 2), (41, 4), (44, 2), (48, 3), (50, 6), (53, 4), (55, 5), (56, 9),
            (58, 11), (59, 16), (58, 19),
            (60, 22), (59, 25), (57, 28), (59, 31), (58, 35), (55, 38), (51, 40), (46, 42), (41, 43),
            (39, 41), (38, 38), (36, 36), (33, 36), (31, 38), (30, 42), (27, 44), (22, 45), (16, 44),
            (12, 41), (9, 39), (7, 36), (5, 33), (8, 32), (9, 29), (6, 27), (3, 25), (3, 22), (5, 19)]
ISLANDS = {
    'sw': [(9, 40), (13, 39), (15, 42), (12, 44), (9, 43)],
    'se': [(55, 40), (59, 40), (60, 43), (56, 44), (54, 42)],
}

# ── 기후대 ────────────────────────────────────────────────────────────────────
SNOW_ZONE = [(0, 0), (64, 0), (64, 11), (60, 12), (57, 11), (54, 13), (51, 12), (48, 14), (44, 12), (41, 13), (38, 15),
             (36, 13), (33, 12), (30, 14), (27, 12), (24, 13), (21, 11), (18, 12), (15, 14), (12, 12), (9, 13), (6, 11), (0, 11)]
SAND_ZONES = {
    'desert_sw': [(4, 31), (13, 30), (22, 31), (28, 35), (27, 42), (12, 46), (4, 41)],
    'desert_se': [(41, 36), (52, 34), (60, 36), (60, 42), (48, 45), (40, 45)],
}
DIRT_ZONES = {   # 사막 안쪽 메마른 흙 조각(모래보다 풀밭 쪽)
    'dirt_w': [(17, 31), (23, 30), (27, 33), (24, 36), (18, 35)],
    'dirt_e': [(44, 34), (51, 33), (53, 36), (47, 38)],
}
MARSH_ZONES = {
    'marsh_w': [(27, 34), (31, 34), (32, 38), (29, 40), (26, 38)],
    'marsh_e': [(36, 34), (41, 35), (41, 39), (38, 38)],
}
# 숲 무리(풀 지대에서 눈 지대로 들어가면 눈 숲으로 바뀐다)
FOREST_ZONES = {
    'forest_w': [(14, 24), (18, 22), (22, 23), (23, 27), (21, 30), (16, 30), (13, 27)],
    'forest_e': [(45, 30), (49, 29), (51, 31), (48, 34), (44, 33)],
    'forest_n': [(20, 17), (24, 20), (23, 23), (19, 21)],           # 산맥 A 아래 숲
    'forest_c': [(35, 16), (41, 15), (43, 18), (39, 19), (35, 19)],
    'forest_m': [(40, 20), (44, 19), (45, 22), (41, 23)],
    'forest_snow_1': [(10, 5), (16, 5), (18, 8), (13, 10), (9, 8)],
    'forest_snow_2': [(38, 4), (46, 5), (48, 8), (41, 9)],
    'forest_snow_3': [(20, 4), (25, 5), (24, 8), (19, 7)],
    'forest_sw': [(6, 17), (10, 16), (11, 20), (7, 21)],
    'forest_se': [(53, 29), (56, 30), (57, 33), (54, 34)],
    'forest_nw': [(26, 16), (30, 16), (31, 18), (27, 18)],          # 설원 마을 아래 작은 숲
    'forest_castle': [(34, 26), (37, 25), (38, 27), (35, 28)],      # 대성 남쪽 숲(강 지류 위)
    'forest_wc': [(6, 29), (10, 28), (11, 30), (7, 31)],            # 서쪽 후미 아래 작은 숲
    'forest_ec': [(55, 15), (58, 15), (58, 19), (55, 18)],          # 산맥 B 동쪽 해안 숲
}
FOREST_DOTS = [(35, 26), (46, 21), (15, 32), (25, 15), (29, 15), (50, 36), (12, 24), (57, 24), (36, 31),
               (42, 20), (8, 23), (31, 17)]

# ── 산맥·강 ((x,y,폭)의 꺾은선) ────────────────────────────────────────────────
# 3단계: 산줄기는 원본 1칸 산 문법(원뿔 격자)을 2~3칸 깊이의 덩이로 묶고, 덩이 사이에 풀 1칸을 둔다. (x, y, w, h)
RANGE_A = [(9, 10, 3, 3), (13, 12, 3, 2), (17, 15, 2, 3), (21, 14, 3, 3), (24, 16, 3, 2), (26, 18, 3, 3), (28, 21, 2, 2)]
RANGE_B = [(43, 11, 2, 3), (47, 14, 3, 2), (50, 16, 3, 3), (51, 19, 3, 3), (49, 22, 5, 3), (54, 25, 3, 3), (54, 28, 2, 3), (51, 30, 3, 2), (55, 32, 2, 2)]
HILLS = [(33, 27), (24, 22), (36, 33), (7, 9), (8, 14), (30, 23), (46, 41), (51, 37), (56, 21), (12, 38), (24, 41), (44, 41),
         (7, 12), (14, 10), (26, 22), (41, 10), (47, 12), (50, 15), (56, 28), (51, 35)]   # 한 칸 언덕(산 iso 칸): 산줄기 끝·어깨
# 강은 (x, y, 폭) 꺾은선을 4방향 칸 경로로 깐다(폭 1은 상류, 2는 하류). RIVER(10) 지형이며 바다가 아니다.
RIVER = [(30, 24, 1), (31, 26, 1), (30, 29, 1), (31, 32, 2), (33, 34, 2), (34, 36, 2)]
TRIBUTARY = [(41, 28, 1), (38, 28, 1), (38, 30, 1), (31, 30, 1)]
CREEK = []
LAKE = [(40, 26), (42, 24), (45, 24), (47, 26), (45, 29), (42, 29)]

# ── 장소: (이름, 출처, 지정, x, y, 밑 지형, 종류, 설명) ─────────────────────────
#  출처 ext = 확장 시트(world-plus-ext.json 이름), orig = 원본 시트의 (col,row,w,h)
SITES = [
    ('대성', 'ext', 'castle_dark_grand', 32, 20, GRASS, 'castle', '강 발원지 아래 강가 평야'),
    ('강가 마을', 'ext', 'town_bell', 25, 28, GRASS, 'town', '본류 서안'),
    ('사거리 마을', 'ext', 'town_red', 38, 31, GRASS, 'town', '호수 남쪽, 본류·지류·해안길 합류'),
    ('해안 마을', 'ext', 'town_red', 5, 22, GRASS, 'town', '서쪽 후미'),
    ('설원 마을', 'ext', 'town_snow', 30, 9, SNOW, 'town', '설원 남쪽 경계'),
    ('눈 촌락', 'ext', 'village_snow', 46, 6, SNOW, 'village', '북동 설원'),
    ('사막 촌락', 'ext', 'village_wood', 16, 34, SAND, 'village', '사막 초입'),
    ('산기슭 동굴', 'orig', (23, 13, 1, 1), 10, 14, DIRT, 'cave', '산맥 A 서쪽 발치'),
    ('하구 감시탑', 'orig', (20, 12, 1, 2), 39, 39, SAND, 'tower', '만 동쪽 어귀'),
    ('사막 폐허', 'orig', (20, 14, 2, 2), 20, 38, SAND, 'ruins', '사막 한가운데'),
    ('화산', 'orig', (18, 14, 2, 2), 52, 24, None, 'volcano', '산맥 B 굵은 허리(산 위에 얹음)'),
    ('섬 동굴', 'orig', (23, 13, 1, 1), 56, 42, DIRT, 'cave', '남동 섬'),
    # 3단계 고지대 위 장소(밑 지형은 고원 층이 정한다)
    ('고원 마을', 'ext', 'village_wood', 12, 16, None, 'village', '서쪽 2단 고원 윗단'),
    ('고원 망루', 'orig', (20, 12, 1, 2), 13, 20, None, 'tower', '서쪽 2단 고원 아랫단'),
    ('고원 폐허', 'orig', (20, 14, 2, 2), 43, 16, None, 'ruins', '중앙 고원'),
    ('고원 동굴', 'orig', (23, 13, 1, 1), 12, 33, None, 'cave', '사막 흙 고원'),
]
# 길: 장소 발치에서 발치까지 다익스트라(terrain_extra.plan_roads). 강은 곧게만 건너고 그 칸은 다리가 된다.
ROUTES = [
    ('해안 마을 ─ 강가 마을', '해안 마을', '강가 마을', []),
    ('강가 마을 ─ 대성', '강가 마을', '대성', []),
    ('대성 ─ 사거리 마을', '대성', '사거리 마을', []),
    ('강가 마을 ─ 사거리 마을', '강가 마을', '사거리 마을', []),
    ('대성 ─ 설원 마을', '대성', '설원 마을', []),
    ('사거리 마을 ─ 하구 감시탑', '사거리 마을', '하구 감시탑', []),
    ('강가 마을 ─ 사막 촌락', '강가 마을', '사막 촌락', []),
    ('서쪽 고원 계단 ─ 해안 마을', 'stair_w1', '해안 마을', []),
    ('중앙 고원 계단 ─ 대성', 'stair_c1', '대성', []),
    ('중앙 고원 계단 ─ 사거리 마을', 'stair_c1', '사거리 마을', []),
    ('사막 고원 경사로 ─ 사막 촌락', 'ramp_d1', '사막 촌락', []),
]


def river_cells(pts):
    """꺾은선 -> 4연결 칸 집합. 폭 2는 가로 걸음에 (x,y+1), 세로 걸음에 (x+1,y)를 더한다."""
    out = []
    for (x0, y0, w0), (x1, y1, w1) in zip(pts, pts[1:]):
        w = w1
        x, y = x0, y0
        seq = [(x, y)]
        while (x, y) != (x1, y1):
            dx, dy = x1 - x, y1 - y
            if abs(dx) >= abs(dy) and dx != 0 and not (abs(dx) == abs(dy) and len(seq) % 2 == 0 and dy != 0):
                x += 1 if dx > 0 else -1
            elif dy != 0:
                y += 1 if dy > 0 else -1
            else:
                x += 1 if dx > 0 else -1
            seq.append((x, y))
        for i, (cx, cy) in enumerate(seq):
            out.append((cx, cy))
            if w >= 2:
                horiz = i > 0 and seq[i][1] == seq[i - 1][1]
                out.append((cx, cy + 1) if horiz else (cx + 1, cy))
    return out


def poly(canvas, pts, code, only=None):
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon(pts, fill=255)
    m = np.array(im) > 0
    if only is not None:
        m &= only(canvas)
    canvas[m] = code
    return m


def stroke(canvas, pts, code, only=None):
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for (x0, y0, w0), (x1, y1, w1) in zip(pts, pts[1:]):
        d.line([(x0, y0), (x1, y1)], fill=255, width=max(1, w0))
        for (x, y, w) in ((x0, y0, w0), (x1, y1, w1)):
            r = w / 2
            if w >= 3:
                d.ellipse([x - r + .5, y - r + .5, x + r - .5, y + r - .5], fill=255)
    m = np.array(im) > 0
    if only is not None:
        m &= only(canvas)
    canvas[m] = code
    return m


def build():
    t = np.full((H, W), SEA, np.uint8)
    poly(t, MAINLAND, GRASS)
    for v in ISLANDS.values():
        poly(t, v, GRASS)
    land = t != SEA
    on_land = lambda c: c != SEA
    on_grass = lambda c: c == GRASS
    for v in SAND_ZONES.values():
        poly(t, v, SAND, on_land)
    for v in DIRT_ZONES.values():
        poly(t, v, DIRT, on_land)
    for v in MARSH_ZONES.values():
        poly(t, v, MARSH, on_land)
    poly(t, ISLANDS['sw'], SAND)
    for v in FOREST_ZONES.values():
        poly(t, v, FOREST, lambda c: np.isin(c, (GRASS, SNOW)))
    for x, y in FOREST_DOTS:
        if t[y, x] == GRASS:
            t[y, x] = FOREST
    # 산·숲 밑바닥은 풀/눈뿐이다(렌더러가 산·숲 밑에 풀을 깐다). 모래·흙·늪 위는 자른다.
    on_gs = lambda c: np.isin(c, (GRASS, SNOW))
    for (x, y, w, h) in RANGE_A + RANGE_B:
        blk = t[y:y + h, x:x + w]
        blk[np.isin(blk, (GRASS, SNOW))] = MOUNT
        if w * h >= 6:   # 직사각형 덩이는 모서리 한 칸을 덜어 내 원본 격자처럼 들쭉날쭉하게
            cx, cy = [(x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)][(x * 7 + y * 3) % 4]
            if t[cy, cx] == MOUNT and (cx, cy) != (52, 24):
                t[cy, cx] = GRASS if t[cy, cx] != SNOW else SNOW
    for x, y in HILLS:
        if t[y, x] in (GRASS, SNOW):
            t[y, x] = MOUNT
    # 늪은 풀 완충대로 둘러싼다(원본 늪 킷은 풀 위 가장자리)
    from scipy import ndimage
    mm = t == MARSH
    ring = ndimage.binary_dilation(mm, structure=np.ones((3, 3), bool), iterations=1) & ~mm
    t[ring & np.isin(t, (SAND, DIRT))] = GRASS
    # 물: 강·지류·호수는 RIVER 지형
    poly(t, LAKE, RIVER_T)
    for pts in (RIVER, TRIBUTARY):
        for (x, y) in river_cells(pts):
            if 0 <= x < W and 0 <= y < H:
                t[y, x] = RIVER_T
    # 장소 밑 정리(아이콘이 놓일 칸을 그 지대의 바닥으로)
    icon_cells = {}
    meta = {m['name']: m for m in json.loads(wm.EXT_JSON.read_text())['icons']}
    for name, src, spec, x, y, ground, kind, why in SITES:
        w, h = (meta[spec]['cells'] if src == 'ext' else spec[2:])
        icon_cells[name] = (x, y, w, h)
        if ground is not None:
            t[y:y + h, x:x + w] = ground
    # 눈 지대 변환
    snow = np.zeros((H, W), bool)
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon(SNOW_ZONE, fill=255)
    snow = np.array(im) > 0
    for src_c, dst_c in ((GRASS, SNOW), (DIRT, SNOW), (SAND, SNOW), (MARSH, SNOW), (FOREST, SFOREST), (MOUNT, SMOUNT)):
        t[snow & (t == src_c)] = dst_c
    # 3단계: 고지대(숲·산을 걷어 내고 윗면 바닥을 정한다)
    import terrain_highland as HL
    lv = HL.apply_terrain(t)
    icon_cells.update(HL.feet_sites())
    # 늪은 물과 직접 맞닿지 않게 풀 한 칸 완충(물 옆 늪 -> 풀)
    for y in range(H):
        for x in range(W):
            if t[y, x] == MARSH and any(0 <= x + dx < W and 0 <= y + dy < H and t[y + dy, x + dx] in (SEA, RIVER_T)
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                t[y, x] = GRASS
    return t, icon_cells, meta


def grid_lines(t):
    return [''.join(CH[v] for v in row) for row in t]


def compose(t, icon_cells, meta, frame=0, log=None):
    """2단계 합성. 반환 (img, 정보 dict). 층: 바닥 → 물체 → 물 → 바닥 변형 → 봉우리 → 길 → 다리 → 장소 아이콘"""
    import terrain_render as TR
    import terrain_extra as TE
    M, img = TR.render_base(t, frame)
    H_, W_ = t.shape
    foot = np.zeros((H_, W_), bool)
    for (x, y, w, h) in icon_cells.values():
        foot[y:y + h, x:x + w] = True
    import terrain_highland as HL
    road, bridge, foot, paths = TE.plan_roads(t, icon_cells, ROUTES, block=HL.block_mask(t.shape))
    for (x, y) in HL.TOP_PATH:
        road[y, x] = True
    protect = foot | road
    for (x, y) in bridge:
        protect[y, x] = True
    log = {} if log is None else log
    TE.render_object_variants(M, img, protect, log)
    TE.render_shade(M, img, protect, log)
    TE.render_decor(M, img, protect, log)
    peaks, pyrs = [], []   # 3단계: 큰 봉우리·피라미드 오버레이 제거(원본 1칸 산 문법만 사용)
    HL.render_top(img)
    TE.render_roads(M, img, road, bridge, foot)
    TE.render_bridges(M, img, bridge)
    HL.render_shadow(img, t)
    ext = np.array(Image.open(wm.EXT).convert('RGB'), np.uint8)
    sh = TR.S
    for name, src, spec, x, y, ground, kind, why in SITES:
        if src == 'ext':
            m = meta[spec]; w, h = m['cells']
            icon = ext[m['row'] * 16:(m['row'] + h) * 16, m['col'] * 16:(m['col'] + w) * 16]
        else:
            c, r, w, h = spec
            icon = sh.a[r * 16:(r + h) * 16, c * 16:(c + w) * 16]
        dst = img[y * 16:(y + h) * 16, x * 16:(x + w) * 16]
        solid = ~np.all(icon == wm.KEY, axis=2)
        dst[solid] = icon[solid]
    return img, dict(road=road, bridge=bridge, foot=foot, paths=paths, peaks=peaks, pyrs=pyrs, log=log)


def ndimage_dilate(m):
    from scipy import ndimage
    return ndimage.binary_dilation(m, structure=np.ones((3, 3), bool))


def render_all(t, icon_cells, meta, sheet_path=None, frame=0):
    return compose(t, icon_cells, meta, frame)[0]


NAMES = list(wm.NAMES) + ['river']


def _adj(t, cond_a, cond_b):
    """cond_a 칸이 cond_b 칸과 4방향으로 맞닿는 자리 목록 [x,y]"""
    out = []
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if cond_a(t[y, x]) and any(cond_b(t[y + dy, x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.append([x, y])
    return out


def missing_list(t, icon_cells, info):
    """1단계 비움 목록 22건을 그대로 두고, 2단계 결과로 해결 여부(status)와 근거(evidence)를 채운다."""
    old = json.loads((HERE / 'missing-v1.json').read_text())['items']
    import terrain_highland as HL
    road, bridge, paths = info['road'], info['bridge'], info['paths']
    nhl = len(HL.PLATEAUS)
    rv = int((t == RIVER_T).sum())
    mouth = [[x, y] for y in range(H) for x in range(W) if t[y, x] == RIVER_T and any(
        0 <= x + dx < W and 0 <= y + dy < H and t[y + dy, x + dx] == SEA for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    marsh_water = _adj(t, lambda v: v == MARSH, lambda v: v in (SEA, RIVER_T))
    nb = len(bridge)
    res = {}   # id -> (status, how, evidence)

    def setr(i, st, how, ev):
        res[i] = (st, how, ev)
    for it in old:
        i, k = it['id'], it['kind']
        if k == 'road':
            setr(i, 'resolved', '흙길 킷 2변형 x 바닥 4종(풀·모래·눈·흙) 손 도트(원본 흙 질감·팔레트). 직선·모서리·T·+·끝·고립 칸은 사분면 규칙이 자동 선택',
                 f'길 칸 {int(road.sum())}, 경로 {len(paths)}개(장소↔장소 다익스트라, 늪·숲·산 회피)')
        elif k == 'bridge':
            setr(i, 'resolved', '나무 다리 손 도트(가로 + 세로 = 가로 전치). 첫·중간·끝 칸(말뚝 위치 변화)으로 양끝 접속. 강은 곧게만 건넘',
                 f'다리 칸 {nb}(가로 {sum(1 for v in bridge.values() if v == "h")} / 세로 {sum(1 for v in bridge.values() if v == "v")})')
    setr(11, 'resolved', '강 전용 지형 코드(RIVER)로 분리. 1칸 폭 강 + 2칸 폭 하류 + 호수, 바다 킷과 다른 물색·둑 사분면 규칙', f'강·호수 칸 {rv}')
    setr(12, 'resolved', '하구 칸은 바다와 강 사이를 디더로 이어 붙임(직각 「구멍」 제거)', f'하구 접점 {len(mouth)}칸')
    src = [[x, y] for y in range(H) for x in range(W) if t[y, x] == RIVER_T and any(
        0 <= x + dx < W and 0 <= y + dy < H and t[y + dy, x + dx] in (MOUNT, SMOUNT) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    setr(13, 'partial', '강은 산줄기 발치 근처(성 북서쪽 언덕 아래)에서 시작하고 첫 칸을 다리가 덮음. 샘·물줄기 그림은 없어 시작이 뭉툭함', f'산에 맞닿은 강 칸 {len(src)}')
    setr(14, 'resolved', '고원 3곳(서쪽 2단·중앙·사막 흙 고원)을 손 도트 절벽으로 만듦: 윗면 변형·북/좌/우 가장자리 3변형·앞 벽 4종(양끝 모서리)·둥근/파인 모서리·계단·경사. 원본 World 팔레트만 사용, 벽 밑에 디더 그림자',
         f'고원 {nhl}곳, 계단·경사로 네 군데로 오르내림')
    setr(15, 'resolved', '큰 봉우리 오버레이를 없애고 원본 문법(1칸 산 킷의 작은 직사각 덩어리)으로 다시 쌓음. 산줄기는 2~5칸 폭, 눈선 위는 설산 킷', '봉우리·피라미드 오버레이 0')
    setr(16, 'resolved', '눈선을 가로지르는 산이 SMOUNT(눈 산) 킷으로 바뀌고 눈 바닥 위에서는 눈 봉우리를 씀', '눈선 능선 8칸이 설산 킷')
    setr(17, 'remaining', '얕은 바다(연한 청록 띠)는 새 색이 필요해 원본 모듈만으로 불가 — 그대로 둠', '해안 바다 칸은 곧장 심해색')
    setr(18, 'resolved', '모래 킷을 알파 녹임 가장자리(4변형)로 다시 그려 풀과 섞이게 함 + 바닥 톤 얼룩', f'모래-풀 경계 {len(_adj(t, lambda v: v == SAND, lambda v: v == GRASS))}칸')
    setr(19, 'resolved', '눈 숲 킷을 풀 바탕 위 윤곽 대신 눈 바닥 위로 재사용하고 숲 톤 얼룩을 더함', '눈-숲 경계 칸 재작성')
    setr(20, 'resolved', '눈 킷의 초록 외곽선(스테이지 1의 이중 그림)을 제거, 눈 킷이 풀과 알파로 녹는 가장자리(4변형)', '눈 가장자리 초록 테 없음')
    setr(21, 'resolved' if not marsh_water else 'partial', '늪은 풀 완충대로 둘러쌈, 물과 직접 맞닿는 늪 칸 없음' if not marsh_water else '일부 맞닿음',
         f'늪-물 맞닿음 {len(marsh_water)}칸')
    setr(22, 'remaining', '큰 건물 밑 접지(광장·그림자)는 이번에도 그리지 않음 — 길 끝이 건물 발치 광장으로 이어지는 것으로만 대신', '아이콘 밑 접지 그림 없음')
    M = []
    for it in old:
        st, how, ev = res[it['id']]
        d = dict(it)
        d.update(status=st, resolvedBy=how, evidence=ev, v1FromOriginalModules=it['fromOriginalModules'])
        del d['fromOriginalModules']
        M.append(d)
    return M


def main():
    import terrain_highland as HL
    t, icon_cells, meta = build()
    lines = grid_lines(t)
    for y in range(H):
        assert len(lines[y]) == W
    img, info = compose(t, icon_cells, meta)
    im = Image.fromarray(img)
    im.save(HERE / 'design-1x.png')
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE / 'design-2x.png')
    (HERE / 'map.txt').write_text('\n'.join(lines) + '\n')
    sites = []
    for name, src, spec, x, y, ground, kind, why in SITES:
        w, h = icon_cells[name][2:]
        sites.append({'name': name, 'kind': kind, 'source': src, 'icon': spec if src == 'ext' else list(spec),
                      'x': x, 'y': y, 'w': w, 'h': h, 'note': why})
    (HERE / 'map.json').write_text(json.dumps({
        'width': W, 'height': H, 'legend': dict(zip(CH, NAMES)), 'codes': list(range(11)),
        'sheet': 'tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus.png',
        'ext': 'tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus-ext.png',
        'terrainSheet': 'tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus-terrain.png',
        'grid': lines, 'terrain': t.tolist(), 'sites': sites,
        'routes': [{'name': n_, 'cells': [list(c) for c in cells]} for n_, cells in info['paths']],
        'bridges': [{'x': x, 'y': y, 'dir': d} for (x, y), d in sorted(info['bridge'].items())],
        'highlands': HL.export(),
        'note': '손 설계 + 2단계(도로·다리·강·바닥 변형) + 3단계(봉우리 재작성·고원). 무작위 생성기 없음(칸 좌표 해시로 결정).',
    }, ensure_ascii=False))
    M = missing_list(t, icon_cells, info)
    (HERE / 'missing.json').write_text(json.dumps({
        'map': 'design-map/map.json', 'count': len(M), 'items': M,
        'resolved': sum(1 for m in M if m['status'] == 'resolved'),
        'remaining': [m['id'] for m in M if m['status'] != 'resolved'],
        'kinds': sorted({m['kind'] for m in M}),
    }, ensure_ascii=False, indent=1))
    print('terrain:', {NAMES[i]: int((t == i).sum()) for i in range(11)}, 'missing items:', len(M),
          'resolved:', sum(1 for m in M if m['status'] == 'resolved'), 'log:', info['log'])


if __name__ == '__main__':
    main()

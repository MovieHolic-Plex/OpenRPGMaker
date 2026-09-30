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
CH = '~.dsmnfMFA'   # 문자 <-> 지형 코드 (순서 = wm 의 코드)

# ── 해안선 (시계방향, 북서 곶부터) ─────────────────────────────────────────────
MAINLAND = [(19, 3), (24, 2), (37, 2), (42, 3), (48, 4), (53, 6), (57, 8), (58, 12), (59, 16), (58, 19),
            (60, 22), (59, 25), (57, 28), (59, 31), (58, 35), (55, 38), (51, 40), (46, 42), (41, 43),
            (39, 41), (38, 38), (36, 36), (33, 36), (31, 38), (30, 42), (27, 44), (22, 45), (16, 44),
            (12, 41), (9, 39), (7, 36), (5, 33), (8, 32), (9, 29), (6, 27), (3, 25), (3, 22), (5, 19),
            (6, 16), (8, 12), (11, 8), (15, 5)]
ISLANDS = {
    'sw': [(9, 40), (13, 39), (15, 42), (12, 44), (9, 43)],
    'ne': [(60, 8), (62, 8), (63, 9), (63, 11), (61, 12), (60, 11)],
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
RIDGE_A = [(9, 10, 2), (12, 12, 3), (16, 14, 3), (20, 16, 3), (24, 18, 3), (27, 20, 3), (29, 22, 2)]
RIDGE_B = [(43, 11, 2), (45, 14, 3), (49, 18, 3), (52, 22, 4), (54, 26, 4), (54, 30, 3), (52, 34, 3),
           (49, 37, 2), (47, 39, 1)]
HILLS = [(33, 27), (24, 22), (36, 33), (7, 9), (8, 14), (30, 23), (46, 41), (51, 37), (56, 21), (12, 38), (24, 41), (44, 41)]   # 한 칸 언덕(산 iso 칸)
RIVER = [(28, 22, 2), (29, 24, 2), (31, 26, 2), (30, 29, 2), (31, 32, 2), (33, 34, 2), (34, 36, 2)]
TRIBUTARY = [(41, 28, 2), (38, 28, 2), (38, 30, 2), (31, 30, 2)]
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
]
# 길이 지나야 할 구간(시트에 길 타일이 없어 그리지 않는다) — 웨이포인트는 장소 중심 근처
ROADS = [
    ('해안 마을 ─ 강가 마을', [(7, 24), (12, 27), (18, 29), (24, 29)]),
    ('강가 마을 ─ 대성', [(27, 28), (29, 26), (31, 24), (32, 22)]),
    ('대성 ─ 사거리 마을', [(36, 23), (38, 27), (39, 31)]),
    ('강가 마을 ─ 사거리 마을', [(27, 30), (31, 31), (35, 31), (38, 32)]),
    ('대성 ─ 설원 마을', [(33, 20), (32, 16), (31, 12)]),
    ('사거리 마을 ─ 하구 감시탑', [(39, 34), (39, 37), (39, 39)]),
    ('강가 마을 ─ 사막 촌락', [(26, 31), (21, 33), (17, 34)]),
]


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
    poly(t, ISLANDS['ne'], SNOW)
    for v in FOREST_ZONES.values():
        poly(t, v, FOREST, lambda c: np.isin(c, (GRASS, SNOW)))
    for x, y in FOREST_DOTS:
        if t[y, x] == GRASS:
            t[y, x] = FOREST
    stroke(t, RIDGE_A, MOUNT, on_land)
    stroke(t, RIDGE_B, MOUNT, on_land)
    for x, y in HILLS:
        if t[y, x] != SEA:
            t[y, x] = MOUNT
    # 물
    poly(t, LAKE, SEA)
    stroke(t, RIVER, SEA)
    stroke(t, TRIBUTARY, SEA)
    stroke(t, CREEK, SEA)
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
    return t, icon_cells, meta


def grid_lines(t):
    return [''.join(CH[v] for v in row) for row in t]


def render_all(t, icon_cells, meta, sheet_path=wm.PLUS, frame=0):
    sh = wm.Sheet(sheet_path)
    img = wm.render(sh, t, frame)
    ext = np.array(Image.open(wm.EXT).convert('RGB'), np.uint8)
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
    return img


def bres(p, q):
    (x0, y0), (x1, y1) = p, q
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]


def road_cells(pts):
    out = []
    for a, b in zip(pts, pts[1:]):
        out += bres(a, b)
    return out


def missing_list(t, icon_cells):
    """설계 지도에서 어색하거나 시트에 없어 비워 둔 자리. 2단계(원본 모듈로 새 칸 조립)의 입력."""
    M = []

    def add(kind, need, at, made, note, n=None):
        M.append({'id': len(M) + 1, 'kind': kind, 'need': need, 'at': at, 'count': n if n is not None else len(at),
                  'fromOriginalModules': made, 'note': note})
    # 길/다리
    for name, pts in ROADS:
        cells = road_cells(pts)
        water = [c for c in cells if t[c[1], c[0]] == SEA]
        add('road', '길 타일(풀밭 위 흙길: 직선·모서리·T·+ 교차 16종)', [list(c) for c in cells if c not in water],
            'partial', f'{name}. 시트에 길 타일 없음 → 빈자리. 흙 킷(6,0)의 몸통·가장자리 사분면을 잘라 1칸 폭 길로 짤 수는 있으나 원본에 그런 조각은 없다')
        if water:
            add('bridge', '다리(물 위 나무다리, 가로·세로 2종 + 양끝 접속)', [list(c) for c in water], 'no',
                f'{name}. 길이 물을 건너는 자리. 원본에 다리 없음 → 새로 그려야 함(회색 성벽 조각(22..23,13..15)은 색·모양이 맞지 않음)')
    # 강
    river_cells = sorted({(x, y) for y in range(H) for x in range(W) if t[y, x] == SEA and _is_inland_water(t, x, y)})
    add('river', '강 전용 칸(1칸 폭 물길, 굽이 4방향, 합류 T, 둑)', [list(c) for c in river_cells[:0]] or [[28, 22], [31, 26], [33, 34]],
        'partial', f'강·지류·호수 물칸 {len(river_cells)}칸을 바다 킷으로 대신함(2칸 폭 수로). 1칸 폭 강·굽이·T 합류는 바다 킷 사분면 조합으로 만들 수 있으나 지금은 임시')
    add('river_mouth', '강 하구(강이 만에 들어가는 삼각 하구·모래톱)', [[33, 36], [34, 36], [35, 36]], 'partial',
        '수로와 만이 직각으로 붙어 「구멍」처럼 보인다. 바다+모래 킷 사분면 조합으로 가능')
    add('river_source', '발원(산 속 샘/폭포 끝칸)', [[28, 22]], 'partial', '산맥 A 발치에서 물이 갑자기 시작한다. 산 킷 + 바다 킷 끝칸 조합')
    # 산: 절벽·고원
    foot = []
    for (x0, y0, w0), (x1, y1, w1) in zip(RIDGE_B, RIDGE_B[1:]):
        foot.append([(x0 + x1) // 2 - 2, (y0 + y1) // 2])
    add('cliff', '산 발치 절벽·고원 옆면(풀밭→산 사이 어두운 단차, 시트 (18..23,0..7) 절벽 킷 사용)', foot, 'yes',
        '산맥 B 서쪽 발치가 풀밭에 바로 붙어 높이 차이가 안 보인다. 시트에 절벽·고원 킷(풀/흙/눈)이 있으나 킷 사분면 규칙에 없어 이번에는 배치하지 않음')
    add('ridge_end', '산맥 끝의 낮아지는 언덕(작은 봉우리 1칸 변형)', [[h[0], h[1]] for h in HILLS], 'yes',
        '언덕 전용 칸이 없어 산 킷의 iso 칸(한 칸 봉우리)로 대신함. 원본 산 아이콘에서 크기 다른 봉우리를 잘라 만들 수 있음')
    add('mountain_snow_seam', '설산↔산 이음(눈선을 가로지르는 능선의 색 이행)', [[x, 12] for x in range(9, 15)] + [[43, 12], [44, 12]], 'yes',
        '능선이 눈선을 지나며 설산 킷과 산 킷이 그냥 맞닿는다. 두 킷 사분면 조합')
    # 얕은 바다
    coast = []
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if t[y, x] == SEA and any(t[y + dy, x + dx] != SEA for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                coast.append([x, y])
    add('shallow_sea', '얕은 바다(연한 청록 띠 1~2칸, 해안·섬 둘레)', coast[:0] or [[24, 1], [20, 45], [60, 22], [3, 23], [62, 10], [57, 43]],
        'no', f'해안 바다칸 {len(coast)}칸이 곧장 짙은 심해다. 시트의 바다는 한 종류(눈 옆 밝은 변형 열 3~5는 눈 지대 전용). 새 색이 필요 → 원본 모듈만으론 불가')
    # 사막/풀 경계
    edge = [[x, y] for y in range(1, H - 1) for x in range(1, W - 1)
            if t[y, x] == SAND and any(t[y + dy, x + dx] == GRASS for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    add('desert_grass_seam', '모래↔풀 이행(풀이 드문드문 섞인 반사막·모래 언덕)', edge, 'partial',
        '모래 킷 가장자리와 풀이 곧장 맞닿아 선이 딱 떨어진다. 흙 킷 가장자리 사분면을 중간 단계로 끼우면 됨(원본 조각)')
    edge = [[x, y] for y in range(1, H - 1) for x in range(1, W - 1)
            if t[y, x] in (SNOW, SFOREST) and any(t[y + dy, x + dx] in (GRASS, FOREST) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    add('snow_forest_seam', '눈↔숲/풀 이행(눈 덮인 침엽수 → 침엽수 → 활엽수)', edge, 'yes',
        '눈선이 반듯한 가로 띠처럼 보이는 곳. 눈 숲 킷과 숲 킷 사분면 조합')
    rim = [[x, y] for y in range(1, H - 1) for x in range(1, W - 1)
           if t[y, x] == SFOREST and any(t[y + dy, x + dx] == SNOW for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    add('snow_rim', '눈 위에 놓인 눈 숲/눈 산의 가장자리(눈 바탕 위 가장자리 킷)', rim, 'partial',
        '눈 숲·눈 산 킷은 풀밭 위 가장자리라 눈 한가운데에서는 초록 테두리가 둘린다. 눈 킷 바탕에 맞춘 가장자리 사분면을 눈 킷 사분면과 눈 숲 킷 사분면 조합으로 시도할 수 있으나 색이 안 맞으면 새 조각이 필요하다')
    add('marsh_water', '늪↔물 이행(늪 킷이 물과 바로 맞닿음)', [[29, 37], [37, 37]], 'partial', '하구 늪이 만 물과 이어지는 자리. 늪+바다 킷 조합')
    # 장소 밑 그림자/광장
    for name, src, spec, x, y, ground, kind, why in SITES:
        if kind in ('castle', 'town') and ground in (GRASS, SNOW):
            pass
    add('site_ground', '큰 건물 밑 접지(성·마을 밑 풀/흙 광장 조각, 그림자)', [[icon_cells[n][0], icon_cells[n][1]] for n in ('대성', '사거리 마을', '강가 마을')], 'partial',
        '5×5·3×3 아이콘 가장자리가 풀밭에 딱 붙어 떠 보일 수 있다. 흙 킷 가장자리 사분면으로 광장 밑동 처리')
    return M


def _is_inland_water(t, x, y):
    """바다 칸 중 대륙 안쪽(강·호수·지류): 상하좌우로 육지에 둘러싸인 방향이 둘 이상."""
    if not (0 <= x < W and 0 <= y < H):
        return False
    n = 0
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H and t[yy, xx] != SEA:
            n += 1
    return n >= 2 or (x, y) in _LAKE_RIVER


_LAKE_RIVER = set()


def main():
    t, icon_cells, meta = build()
    lines = grid_lines(t)
    for y in range(H):
        assert len(lines[y]) == W
    # 육지에 둘러싸인 물칸(강·호수)
    lab = np.zeros((H, W), int)
    from scipy import ndimage
    comp, n = ndimage.label(t == SEA)
    edge_labels = set(comp[0]) | set(comp[-1]) | set(comp[:, 0]) | set(comp[:, -1])
    for y in range(H):
        for x in range(W):
            if t[y, x] == SEA and comp[y, x] not in edge_labels:
                _LAKE_RIVER.add((x, y))
    img = render_all(t, icon_cells, meta)
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
        'width': W, 'height': H, 'legend': dict(zip(CH, wm.NAMES)), 'codes': list(range(10)),
        'sheet': 'tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus.png',
        'ext': 'tiledata/atlas-pick/worldmap-easyrpg-plus/world-plus-ext.png',
        'grid': lines, 'terrain': t.tolist(), 'sites': sites,
        'roads': [{'name': n_, 'waypoints': p} for n_, p in ROADS],
        'note': '손 설계. 무작위 생성기 없음. 길 타일은 시트에 없어 비움(missing.json).',
    }, ensure_ascii=False))
    M = missing_list(t, icon_cells)
    (HERE / 'missing.json').write_text(json.dumps({
        'map': 'design-map/map.json', 'count': len(M), 'items': M,
        'kinds': sorted({m['kind'] for m in M}),
    }, ensure_ascii=False, indent=1))
    print('terrain:', {wm.NAMES[i]: int((t == i).sum()) for i in range(10)}, 'missing items:', len(M))


if __name__ == '__main__':
    main()

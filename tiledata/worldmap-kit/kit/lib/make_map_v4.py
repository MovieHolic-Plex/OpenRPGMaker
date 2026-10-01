#!/usr/bin/env python3
"""월드맵 설계 데모 4단계 — 96x72 대륙 2개 + 내해 + 섬줄기. 무작위 생성기 없음(칸 좌표 해시 노이즈).

지형은 손으로 적은 꺾은선·다각형(칸 좌표)에 결정적 노이즈 왜곡만 얹어 만든다.
  python3 make_map_v4.py  →  map-v4.json, map-v4.txt, design-1x-v4.png, design-2x-v4.png
"""
import json
import sys
from pathlib import Path

import numpy as np
import scipy.ndimage as ndi
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
# [worldmap-kit 복사본] 원본 저장소 경로 삽입 제거
sys.path.insert(0, str(HERE))
import worldmap_easyrpg_plus as wm  # noqa: E402
import terrain_v4 as V  # noqa: E402
import terrain_extra as TE  # noqa: E402
from terrain_v4 import *  # noqa: E402,F401,F403
from terrain_lib import hh, rnd  # noqa: E402

W, H = 96, 72
BAD = []
_DBG = None


def dump(land, G, ic):
    for y in range(H):
        row = ''
        for x in range(W):
            c = '#' if land[y, x] else '.'
            for n, (a, b, w, h) in ic.items():
                if a <= x < a + w and b <= y < b + h:
                    c = '@'
            row += c
        print('%02d %s' % (y, row))
_VN = {}


def vn(scale, salt):
    """부드러운 값 노이즈(0..1), 결정적."""
    k = (scale, salt)
    if k in _VN:
        return _VN[k]
    gx, gy = int(W / scale) + 3, int(H / scale) + 3
    g = np.array([[rnd(i, j, salt) for i in range(gx)] for j in range(gy)])
    ys, xs = np.mgrid[0:H, 0:W]
    fx, fy = xs / scale, ys / scale
    i0, j0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - i0, fy - j0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = g[j0, i0] * (1 - tx) + g[j0, i0 + 1] * tx
    b = g[j0 + 1, i0] * (1 - tx) + g[j0 + 1, i0 + 1] * tx
    _VN[k] = a * (1 - ty) + b * ty
    return _VN[k]


def clean(m, minsize=4):
    lab, n = ndi.label(m)
    if n:
        sz = ndi.sum(m, lab, range(1, n + 1))
        for i, s in enumerate(sz):
            if s < minsize:
                m[lab == i + 1] = False
    holes = ~m
    lab, n = ndi.label(holes)
    if n:
        sz = ndi.sum(holes, lab, range(1, n + 1))
        for i, s in enumerate(sz):
            if s < 3:
                m[lab == i + 1] = True
    return m


def polymask(pts, warp=1.4, salt=0, S=4, minsize=4):
    im = Image.new('L', (W * S, H * S), 0)
    ImageDraw.Draw(im).polygon([(x * S + S // 2, y * S + S // 2) for x, y in pts], fill=255)
    hi = np.array(im) > 0
    ys, xs = np.mgrid[0:H, 0:W]
    dx = (vn(7, salt) - .5) * 2 * warp + (vn(2.6, salt + 1) - .5) * warp * .9
    dy = (vn(7, salt + 2) - .5) * 2 * warp + (vn(2.6, salt + 3) - .5) * warp * .9
    sx = np.clip(((xs + dx) * S + S // 2).astype(int), 0, W * S - 1)
    sy = np.clip(((ys + dy) * S + S // 2).astype(int), 0, H * S - 1)
    return clean(hi[sy, sx], minsize)


def ellipse(cx, cy, rx, ry, n=12, salt=0, jit=.28):
    out = []
    for i in range(n):
        a = 6.2832 * i / n
        r = 1 + (rnd(i, salt, 9) - .5) * 2 * jit
        out.append((cx + np.cos(a) * rx * r, cy + np.sin(a) * ry * r))
    return out


def dense(pts, step=.5):
    out = []
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(np.hypot(bx - ax, by - ay) / step))
        for i in range(n):
            out.append((ax + (bx - ax) * i / n, ay + (by - ay) * i / n))
    out.append(pts[-1])
    return out


def disc(m, x, y, r):
    x0, x1, y0, y1 = int(x - r - 1), int(x + r + 2), int(y - r - 1), int(y + r + 2)
    for yy in range(max(y0, 0), min(y1, H)):
        for xx in range(max(x0, 0), min(x1, W)):
            if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                m[yy, xx] = True


def river_cells(pts, salt=0, amp=.9, wide=None):
    """꺾은선 -> 4방향 이어진 칸. wide=[(구간 시작 비율,폭)] 하류로 갈수록 넓어짐."""
    d = dense(pts, .5)
    n = len(d)
    cells = []
    for k, (x, y) in enumerate(d):
        u = k / max(n - 1, 1)
        nx, ny = d[min(k + 1, n - 1)][0] - d[max(k - 1, 0)][0], d[min(k + 1, n - 1)][1] - d[max(k - 1, 0)][1]
        L = max(np.hypot(nx, ny), 1e-6)
        off = (vn(5, 40 + salt)[min(int(y), H - 1), min(int(x), W - 1)] - .5) * 2 * amp * np.sin(np.pi * min(u * 6, 1))
        px, py = x + (-ny / L) * off, y + (nx / L) * off
        c = (int(round(px)), int(round(py)))
        if not cells or cells[-1] != c:
            if cells and abs(c[0] - cells[-1][0]) + abs(c[1] - cells[-1][1]) == 2:
                cells.append((c[0], cells[-1][1]) if hh(c[0], c[1], salt) % 2 else (cells[-1][0], c[1]))
            cells.append(c)
    out = set(cells)
    if wide:
        for i, c in enumerate(cells):
            u = i / max(len(cells) - 1, 1)
            if u >= wide:
                x, y = c
                prev = cells[max(i - 1, 0)]
                out.add((x + 1, y) if prev[1] != y else (x, y + 1))
    return out


def ridge_mask(pts, peak, wmax, wmin=.85, salt=0, spurs=True):
    d = dense(pts, .5)
    n = len(d)
    pi = min(range(n), key=lambda k: (d[k][0] - peak[0]) ** 2 + (d[k][1] - peak[1]) ** 2)
    m = np.zeros((H, W), bool)
    for k, (x, y) in enumerate(d):
        u = abs(k - pi) / max(pi, n - 1 - pi, 1)
        r = wmin + (wmax - wmin) * max(0, 1 - u * 1.25) ** 1.15 + (rnd(int(x * 2), int(y * 2), salt) - .5) * .55
        disc(m, x, y, max(r, .55))
        if spurs and k % 7 == 3 and hh(int(x), int(y), salt + 5) % 3 != 0:
            nx, ny = d[min(k + 1, n - 1)][0] - d[max(k - 1, 0)][0], d[min(k + 1, n - 1)][1] - d[max(k - 1, 0)][1]
            L = max(np.hypot(nx, ny), 1e-6)
            sgn = 1 if hh(int(x), int(y), salt + 6) % 2 else -1
            ln = 2 + hh(int(x), int(y), salt + 7) % 3
            for t in range(1, ln + 1):
                disc(m, x + (-ny / L) * sgn * t * .9, y + (nx / L) * sgn * t * .9, .62)
    return m


def foothills(ridge, avoid, lo=1.6, hi=3.4, p=.16, salt=0):
    d = ndi.distance_transform_edt(~ridge)
    out = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            if lo < d[y, x] <= hi and not avoid[y, x] and rnd(x, y, 210 + salt) < p:
                if not out[max(y - 1, 0):y + 2, max(x - 1, 0):x + 2].any():
                    out[y, x] = True
    return out


# ═══════════ 대륙·바다 ═══════════
CONT_A = [(8, 22), (9, 14), (15, 8), (23, 5), (32, 4), (41, 6), (47, 11), (51, 18), (52, 27), (53, 36), (52, 45), (49, 53), (45, 59),
          (38, 63), (30, 64), (22, 62), (15, 58), (10, 52), (6, 44), (5, 36), (7, 28)]
CONT_B = [(60, 15), (66, 9), (74, 7), (83, 9), (90, 14), (92, 23), (91, 32), (87, 41), (81, 47), (72, 48), (66, 44), (62, 38), (59, 29)]
INLAND = [(32, 36), (38, 33), (45, 35), (47, 40), (44, 46), (37, 47), (32, 43)]
STRAIT = [(38, 43), (42, 43), (42, 66), (38, 66)]
ISLES = {
    'i1': ellipse(52, 65, 4.2, 2.6, 10, 1), 'i2': ellipse(61, 66, 5, 2.6, 11, 2), 'i3': ellipse(70, 63, 4.3, 3.2, 11, 3),
    'i4': ellipse(79, 60, 4.2, 3, 11, 4), 'i5': ellipse(86, 55, 3.4, 3, 10, 5),
    'n1': ellipse(58, 4, 3.6, 2, 9, 6), 'n2': ellipse(67, 3, 2.6, 1.6, 8, 7), 'w1': ellipse(3.5, 58, 2.8, 3, 9, 8),
}

# 기본 바닥 다각형: (다각형, 바닥, warp) — 나중 것이 위에 덮는다
BIOMES_A = [
    ([(6, 40), (26, 40), (38, 44), (38, 52), (10, 52)], SAVANNA, 1.5),
    ([(6, 16), (20, 14), (32, 12), (44, 12), (52, 14), (52, 22), (40, 20), (28, 19), (16, 23), (6, 26)], TUNDRA, 1.6),
    ([(12, 4), (30, 3), (46, 6), (50, 12), (40, 13), (30, 11), (20, 14), (10, 15)], SNOW, 1.4),
    ([(22, 3), (38, 3), (41, 6), (34, 9), (26, 8)], GLACIER, 1.0),
    ([(10, 47), (38, 45), (38, 62), (28, 67), (16, 64), (9, 55)], SAND, 1.5),
    ([(15, 52), (31, 50), (33, 58), (26, 65), (18, 61)], DUNE, 1.3),
    ([(28, 44), (38, 44), (38, 52), (30, 52)], BADLANDS, 1.3),
    ([(4, 30), (15, 29), (16, 40), (9, 46), (4, 42)], SWAMP, 1.4),
        ([(40, 49), (53, 44), (53, 58), (45, 63), (40, 59)], JUNGLE, 1.4),
]
BIOMES_B = [
    ([(59, 28), (68, 30), (68, 46), (60, 44)], GRASS, 1.4),
    ([(68, 8), (84, 9), (86, 22), (80, 26), (68, 22)], ASH, 1.5),
    ([(73, 12), (85, 13), (86, 20), (78, 23), (73, 19)], BASALT, 1.2),
    ([(59, 12), (68, 11), (70, 19), (62, 23)], MARSH, 1.3),
    ([(84, 4), (93, 9), (93, 19), (87, 16)], SNOW, 1.2),
    ([(83, 31), (93, 29), (93, 40), (86, 45), (80, 40)], SAND, 1.4),
    ([(85, 33), (92, 32), (91, 40), (85, 42)], DUNE, 1.2),
    ([(62, 38), (72, 43), (84, 46), (82, 40), (66, 34)], BADLANDS, 1.3),
]
ISLE_GROUND = {'i1': GRASS, 'i2': SAND, 'i3': JUNGLE, 'i4': BADLANDS, 'i5': ASH, 'n1': SNOW, 'n2': GLACIER, 'w1': SWAMP}
FARMS = [(22, 27, 4, 2, FARM), (22, 30, 3, 2, CROP), (33, 29, 3, 3, FARM), (36, 22, 3, 2, CROP), (40, 27, 2, 3, FARM),
         (69, 27, 3, 2, CROP), (62, 33, 3, 3, FARM), (66, 37, 3, 2, CROP), (20, 33, 3, 2, FARM)]

# 고원: (윗면 다각형, 층, 바닥)
PLATEAUS = [
    ([(9, 17), (16, 15), (22, 18), (24, 26), (19, 31), (11, 29)], 1, GRASS),
    ([(13, 19), (18, 18), (21, 21), (19, 25), (14, 25)], 2, TUNDRA),
    ([(66, 32), (71, 31), (74, 33), (79, 31), (81, 35), (79, 40), (74, 39), (72, 43), (67, 41), (65, 36)], 1, BADLANDS),
    ([(26, 47), (33, 46), (37, 50), (34, 56), (27, 55)], 1, DIRT),
]

# 능선: (이름, 꺾은선, 정점, 최대폭, 물체, salt)
RIDGES = [
    ('북서 능선', [(9, 14), (14, 12), (20, 13), (25, 10), (31, 12)], (20, 13), 2.0, SMOUNT, 11),
    ('중앙 산줄기', [(44, 11), (43, 16), (45, 21), (44, 27), (47, 31)], (44, 19), 2.3, MOUNT, 12),
    ('정글 능선', [(46, 50), (49, 54), (50, 58)], (49, 54), 1.6, MOUNT, 13),
    ('동대륙 서릉', [(64, 17), (62, 23), (64, 29), (63, 36)], (62, 24), 2.0, MOUNT, 14),
    ('사막 메사', [(13, 49), (15, 53), (19, 57)], (15, 53), 1.5, MESA, 15),
    ('동대륙 북릉', [(72, 9), (78, 8), (84, 9)], (78, 8), 1.5, MOUNT, 16),
]
PASSES = [(28.5, 11.5, 1.6), (44, 24.5, 1.5), (63, 26.5, 1.5)]

# 강: (이름, 꺾은선, 폭 시작 비율, salt)
RIVERS = [
    ('본류', [(43, 20), (40, 23), (36, 25), (33, 27), (33, 31), (34, 34)], .55, 1),
    ('북 지류', [(30, 12), (32, 16), (35, 19), (37, 24)], 2, 2),
    ('서 하천', [(24, 30), (23, 34), (25, 38), (28, 42), (31, 43)], .6, 3),
    ('동대륙 본류', [(63, 27), (68, 28), (74, 29), (80, 29), (86, 28), (92, 29)], .5, 4),
    ('동대륙 지류', [(70, 21), (68, 24), (67, 27)], 2, 5),
]
LAVA_LINE = [(79, 19), (82, 20), (85, 22)]
TOXIC_POOLS = [[(62.5, 16, 1.3), (64, 17.2, 1.7), (65.6, 18.3, 1.4), (67, 19.6, 1.0)],
               [(66.5, 22.5, 1.2), (68, 23.4, 1.5), (69.6, 23.9, 1.0)],
               [(61.5, 21, 1.1), (62.8, 22.2, 1.3)]]
OASIS = (86.5, 37.5, 2.6, 1.9)
CHASM_LINE = [(80, 30), (82, 33), (81, 36), (83, 40)]

# 숲: (다각형, 물체, 문턱, salt)
FORESTS = [
    ([(75, 58), (82, 57), (83, 62), (76, 63)], MESA, .58, 41),
    ([(83, 53), (88, 52), (89, 57), (84, 57)], MOUNT, .60, 42),
    ([(18, 33), (27, 33), (28, 40), (19, 40)], BROAD, .44, 21),
    ([(10, 21), (13, 21), (13, 29), (10, 29)], BROAD, .42, 22),
    ([(8, 14), (24, 13), (30, 16), (18, 19), (8, 18)], CONIFER, .42, 23),
    ([(14, 4), (28, 3), (30, 8), (16, 10)], SNOWF, .45, 24),
    ([(34, 4), (46, 7), (47, 12), (36, 11)], SNOWF, .45, 25),
    ([(32, 15), (40, 15), (41, 21), (34, 21)], BROAD, .5, 26),
    ([(40, 49), (53, 44), (53, 58), (45, 63), (40, 59)], JUNGLEF, .32, 27),
    ([(4, 30), (15, 29), (16, 40), (9, 46), (4, 42)], DEAD, .72, 28),
    ([(60, 30), (68, 32), (68, 44), (60, 42)], BROAD, .44, 29),
    ([(59, 12), (68, 11), (70, 19), (62, 23)], DEAD, .68, 30),
    ([(84, 4), (93, 9), (93, 19), (87, 16)], SNOWF, .45, 31),
    ([(68, 8), (84, 9), (86, 22), (80, 26), (68, 22)], DEAD, .8, 32),
    ([(48, 62), (56, 62), (55, 68), (48, 68)], BROAD, .5, 33),
    ([(66, 60), (75, 60), (74, 67), (66, 67)], JUNGLEF, .35, 34),
    ([(11, 30), (24, 30), (24, 44), (11, 44)], BROAD, .82, 35),
    ([(44, 26), (52, 26), (52, 44), (45, 44)], CONIFER, .7, 36),
    ([(85, 24), (91, 24), (91, 30), (85, 30)], BROAD, .6, 37),
    ([(82, 33), (91, 33), (91, 42), (82, 42)], JUNGLEF, .78, 38),
    ([(48, 60), (56, 61), (56, 69), (48, 69)], BROAD, .5, 39),
    ([(56, 62), (66, 62), (66, 69), (56, 69)], BROAD, .68, 40),
    ([(54, 1), (61, 1), (61, 7), (54, 7)], SNOWF, .55, 41),
    ([(20, 12), (46, 12), (46, 24), (20, 24)], BROAD, .84, 42),
]

# 장소: (이름, 출처, 지정, x, y, 밑 바닥(None=그대로), 종류, 설명)
SITES = [
    ('대성', 'ext', 'castle_dark_grand', 26, 22, GRASS, 'castle', '서대륙 중앙 평야'),
    ('강가 마을', 'ext', 'town_bell', 38, 26, GRASS, 'town', '본류 동안'),
    ('내해 항구', 'ext', 'town_red', 40, 30, GRASS, 'town', '내해 북안'),
    ('설원 마을', 'ext', 'town_snow', 33, 8, SNOW, 'town', '설원 남쪽'),
    ('눈 촌락', 'ext', 'village_snow', 19, 10, SNOW, 'village', '북서 설원'),
    ('고원 마을', 'ext', 'village_wood', 15, 21, None, 'village', '서쪽 2단 고원 윗단'),
    ('산기슭 동굴', 'orig', (23, 13, 1, 1), 8, 24, DIRT, 'cave', '서쪽 고원 발치'),
    ('사막 촌락', 'ext', 'village_wood', 20, 50, SAND, 'village', '사막 초입'),
    ('사막 폐허', 'orig', (20, 14, 2, 2), 21, 56, SAND, 'ruins', '사막 깊은 곳'),
    ('정글 마을', 'ext', 'village_wood', 46, 54, JUNGLE, 'village', '정글 능선 발치'),
    ('고갯길 요새', 'ext', 'castle_dark', 45, 24, None, 'castle', '중앙 산줄기의 고개'),
    ('해협 감시탑', 'orig', (20, 12, 1, 2), 33, 50, DIRT, 'tower', '해협 서안'),
    ('화산', 'orig', (18, 14, 2, 2), 77, 16, None, 'volcano', '동대륙 북부 화구'),
    ('화염 요새', 'ext', 'castle_dark', 71, 16, ASH, 'castle', '화산재 벌판'),
    ('사바나 마을', 'ext', 'town_red', 72, 24, SAVANNA, 'town', '동대륙 중앙'),
    ('오아시스 촌락', 'ext', 'village_wood', 84, 34, SAND, 'village', '사막 오아시스'),
    ('협곡 폐허', 'orig', (20, 14, 2, 2), 75, 36, BADLANDS, 'ruins', '붉은 협곡토'),
    ('북동 눈 촌락', 'ext', 'village_snow', 85, 14, SNOW, 'village', '동대륙 북동 설원'),
    ('동쪽 항구', 'ext', 'town_bell', 86, 24, SAVANNA, 'town', '동안'),
    ('독늪 탑', 'orig', (20, 12, 1, 2), 64, 12, None, 'tower', '독 늪 가장자리'),
    ('섬 동굴', 'orig', (23, 13, 1, 1), 51, 64, GRASS, 'cave', '남쪽 섬줄기 첫 섬'),
    ('섬 탑', 'orig', (20, 12, 1, 2), 61, 65, SAND, 'tower', '섬줄기 둘째 섬'),
    ('남섬 마을', 'ext', 'village_wood', 69, 62, JUNGLE, 'village', '섬줄기 정글 섬'),
    ('섬 폐허', 'orig', (20, 14, 2, 2), 85, 55, ASH, 'ruins', '섬줄기 끝 재의 섬'),
    ('북섬 촌락', 'ext', 'village_snow', 57, 3, SNOW, 'village', '북쪽 빙하 섬'),
]
# 고원 경사로: (이름, 열, 윗층, 최소 y)
RAMPS = [
    ('서 고원 윗 경사로', 17, 2, 22), ('서 고원 아랫 경사로', 15, 1, 26),
    ('동 고원 아랫 경사로', 70, 1, 38),
    ('사막 고원 경사로', 30, 1, 52),
]
ROUTES = [
    ('설원 마을 ─ 눈 촌락', '설원 마을', '눈 촌락', []),
    ('설원 마을 ─ 대성', '설원 마을', '대성', []),
    ('대성 ─ 강가 마을', '대성', '강가 마을', []),
    ('강가 마을 ─ 내해 항구', '강가 마을', '내해 항구', []),
    ('대성 ─ 고갯길 요새', '대성', '고갯길 요새', []),
    ('고갯길 요새 ─ 내해 항구', '고갯길 요새', '내해 항구', []),
    ('고갯길 요새 ─ 정글 마을', '고갯길 요새', '정글 마을', []),
    ('대성 ─ 서 고원 아랫 경사로', '대성', '서 고원 아랫 경사로', []),
    ('서 고원 아랫 경사로 ─ 윗 경사로', '서 고원 아랫 경사로', '서 고원 윗 경사로', []),
    ('서 고원 윗 경사로 ─ 고원 마을', '서 고원 윗 경사로', '고원 마을', []),
    ('대성 ─ 산기슭 동굴', '대성', '산기슭 동굴', []),
    ('강가 마을 ─ 사막 촌락', '강가 마을', '사막 촌락', []),
    ('사막 촌락 ─ 사막 폐허', '사막 촌락', '사막 폐허', []),
    ('사막 촌락 ─ 사막 고원 경사로', '사막 촌락', '사막 고원 경사로', []),
    ('사막 고원 경사로 ─ 해협 감시탑', '사막 고원 경사로', '해협 감시탑', []),
    ('화염 요새 ─ 화산', '화염 요새', '화산', []),
    ('화염 요새 ─ 사바나 마을', '화염 요새', '사바나 마을', []),
    ('화염 요새 ─ 독늪 탑', '화염 요새', '독늪 탑', []),
    ('사바나 마을 ─ 동쪽 항구', '사바나 마을', '동쪽 항구', []),
    ('동쪽 항구 ─ 북동 눈 촌락', '동쪽 항구', '북동 눈 촌락', []),
    ('사바나 마을 ─ 오아시스 촌락', '사바나 마을', '오아시스 촌락', []),
    ('사바나 마을 ─ 동 고원 경사로', '사바나 마을', '동 고원 아랫 경사로', []),
    ('동 고원 경사로 ─ 협곡 폐허', '동 고원 아랫 경사로', '협곡 폐허', []),
]


def build():
    G = np.full((H, W), SEA, np.int16)
    O = np.zeros((H, W), np.int16)
    Hh = np.zeros((H, W), np.int16)
    log = {}
    # 1. 땅
    landA = polymask(CONT_A, 1.7, 100)
    landB = polymask(CONT_B, 1.7, 110)
    isles = {k: polymask(p, .9, 120 + i, minsize=3) for i, (k, p) in enumerate(ISLES.items())}
    inl = polymask(INLAND, 1.2, 130) | polymask(STRAIT, .8, 131)
    land = landA | landB
    for m in isles.values():
        land |= m
    land &= ~inl
    G[land] = GRASS
    G[landB & land] = SAVANNA
    for k, m in isles.items():
        G[m & land] = ISLE_GROUND[k]
    # 2. 바이옴
    for i, (poly, g, w) in enumerate(BIOMES_A):
        G[polymask(poly, w, 200 + i) & landA & land] = g
    for i, (poly, g, w) in enumerate(BIOMES_B):
        G[polymask(poly, w, 300 + i) & landB & land] = g
    # 3. 물
    water = np.zeros((H, W), bool)
    for name, pts, wide, salt in RIVERS:
        for (x, y) in river_cells(pts, salt, .9, wide if wide < 1 else None):
            if 0 <= x < W and 0 <= y < H and land[y, x]:
                G[y, x] = RIVER
                water[y, x] = True
    for chain in TOXIC_POOLS:
        m = np.zeros((H, W), bool)
        for x, y, r in chain:
            disc(m, x, y, r)
        G[m & land & (G >= 10)] = TOXIC
    m = polymask(ellipse(OASIS[0], OASIS[1], OASIS[2], OASIS[3], 10, 70, .2), .6, 610, minsize=3)
    G[m & land] = RIVER
    for (x, y) in river_cells(CHASM_LINE, 8, 1.2):
        if 0 <= x < W and 0 <= y < H and land[y, x] and G[y, x] >= 10:
            G[y, x] = CHASM
    lv = np.zeros((H, W), bool)
    for (x, y) in river_cells(LAVA_LINE, 6, .6):
        if land[y, x]:
            G[y, x] = LAVA
    cm = np.zeros((H, W), bool)
    disc(cm, 77.5, 16.5, 2.6)
    G[cm & land & (G >= 10)] = CRATER
    # 4. 고원
    for i, (poly, lvl, g) in enumerate(PLATEAUS):
        m = polymask(poly, 1.1, 400 + i) & land & (G >= 10)
        Hh[m] = lvl
        G[m] = g
    # 5. 밭
    for x, y, w, h, g in FARMS:
        sl = (slice(y, y + h), slice(x, x + w))
        ok = (G[sl] >= 10) & (Hh[sl] == 0) & (G[sl] != SWAMP)
        G[sl][ok] = g
    # 5b. 작은 얼룩 정리: 5칸 미만 바닥 섬은 이웃 다수 바닥으로 흡수
    for g in np.unique(G):
        if g < 10 or g in (FARM, CROP, CHASM, CRATER):
            continue
        lab, nl = ndi.label(G == g)
        for k in range(1, nl + 1):
            cm_ = lab == k
            if cm_.sum() >= 5:
                continue
            ring = ndi.binary_dilation(cm_) & ~cm_
            vals = [v for v in G[ring] if v >= 10 and v != g]
            if vals:
                G[cm_] = max(set(vals), key=vals.count)
    # 6. 장소 발치(물체 치움용)
    icon_cells = {}
    meta = {m['name']: m for m in json.loads(wm.EXT_JSON.read_text())['icons']}
    keep = np.zeros((H, W), bool)
    for name, src, spec, x, y, ground, kind, why in SITES:
        w, h = (meta[spec]['cells'] if src == 'ext' else spec[2:])
        icon_cells[name] = (x, y, w, h)
        keep[max(y - 1, 0):y + h + 1, max(x - 1, 0):x + w + 1] = True
    # 7. 물체
    free = land & (G >= 10) & ~keep
    ridges = np.zeros((H, W), bool)
    for name, pts, peak, wmax, obj, salt in RIDGES:
        rm = ridge_mask(pts, peak, wmax, salt=salt, spurs=(name != '북서 능선'))
        for px, py, pr in PASSES:
            pm = np.zeros((H, W), bool)
            disc(pm, px, py, pr)
            rm &= ~pm
        fm = rm & free & (Hh == 0)
        O[fm] = obj
        ridges |= fm
        hills = foothills(fm, ~free | (Hh > 0), p=.085, salt=salt)
        O[hills & (O == 0)] = obj
    for i, (poly, obj, thr, salt) in enumerate(FORESTS):
        pm = polymask(poly, 1.1, 500 + i)
        fm = pm & free & (O == 0) & (vn(2.7, salt) > thr) & (Hh <= 1)
        O[fm] = obj
    # 화산 덩이
    vm = np.zeros((H, W), bool)
    disc(vm, 77.5, 16.5, 3.6)
    vm2 = np.zeros((H, W), bool)
    disc(vm2, 77.5, 16.5, 2.6)
    for y in range(H):
        for x in range(W):
            if vm[y, x] and not vm2[y, x] and land[y, x] and (G[y, x] >= 10) and rnd(x, y, 77) > .12:
                O[y, x] = VOLC
    global _DBG
    _DBG = (land.copy(), G.copy(), Hh.copy(), O.copy())
    # 8. 장소 밑 정리
    for name, src, spec, x, y, ground, kind, why in SITES:
        w, h = icon_cells[name][2:]
        if not land[y:y + h, x:x + w].all() or (G[y:y + h, x:x + w] < 10).any():
            BAD.append(('물', name, x, y, land[y:y + h, x:x + w].astype(int).tolist(), G[y:y + h, x:x + w].tolist()))
            continue
        if ground is not None:
            G[y:y + h, x:x + w] = ground
        O[max(y - 1, 0):y + h + 1, max(x - 1, 0):x + w + 1] = np.where(
            np.isin(O[max(y - 1, 0):y + h + 1, max(x - 1, 0):x + w + 1], MOUNTS), O[max(y - 1, 0):y + h + 1, max(x - 1, 0):x + w + 1], 0)
        O[y:y + h, x:x + w] = 0
        hv = Hh[y:y + h, x:x + w]
        if not (hv == hv.flat[0]).all():
            BAD.append(('높이', name, x, y, hv.tolist()))
    Hh[G < 10] = 0
    if BAD:
        print('BAD', BAD)
        dump(land, G, icon_cells)
        raise SystemExit(1)
    # 9. 경사로 2패스
    M = Map4(G, O, Hh)
    RAMP = np.zeros((H, W), bool)
    for name, xc, lvl, ymin in RAMPS:
        bands = []
        for (x, y), (j, n, rock) in sorted(M.face.items(), key=lambda kv: (kv[0][0], kv[0][1])):
            if x in (xc, xc + 1) and j == 0 and y >= ymin and Hh[y - 1, x] == lvl:
                bands.append((y, x))
        if not bands:
            raise RuntimeError('경사로 자리 없음 ' + name)
        ytop = min(y for y, x in bands)
        for x in (xc, xc + 1):
            for (yy, xx) in [(y, x_) for y, x_ in bands if y == ytop and x_ == x]:
                for j in range(M.face[(xx, yy)][1]):
                    RAMP[yy + j, xx] = True
        icon_cells[name] = (xc, ytop - 1, 1, 1)
    M = Map4(G, O, Hh, RAMP=RAMP)
    for name, (x, y, w, h) in icon_cells.items():
        if w == 1 and h == 1 and name.endswith('경사로'):
            assert not M.is_face(x, y), name
    return M, icon_cells, meta, dict(land=land, landA=landA, landB=landB, isles=isles)


def render(M, icon_cells, meta):
    t = old_grid(M)
    block = road_block(M)
    for name, (x, y, w, h) in icon_cells.items():
        block[y:y + h, x:x + w] = False
    road, bridge, foot, paths = TE.plan_roads(t, icon_cells, ROUTES, block=block)
    protect = foot | road
    for (x, y) in bridge:
        protect[y, x] = True
    img = render_ground(M)
    render_faces(M, img)
    render_objects(M, img)
    render_water(M, img)
    render_depth(M, img)
    render_decor(M, img, protect)
    render_roads(M, img, road, bridge, foot)
    TE.render_bridges(M, img, bridge)
    render_ramps(M, img)
    ext = np.array(Image.open(wm.EXT).convert('RGB'), np.uint8)
    import terrain_render as TR
    sh = TR.S
    for name, src, spec, x, y, ground, kind, why in SITES:
        if src == 'ext':
            m = meta[spec]
            w, h = m['cells']
            icon = ext[m['row'] * 16:(m['row'] + h) * 16, m['col'] * 16:(m['col'] + w) * 16]
        else:
            c, r, w, h = spec
            icon = sh.a[r * 16:(r + h) * 16, c * 16:(c + w) * 16]
        dst = img[y * 16:(y + h) * 16, x * 16:(x + w) * 16]
        solid = ~np.all(icon == wm.KEY, axis=2)
        dst[solid] = icon[solid]
    return img, dict(road=road, bridge=bridge, foot=foot, paths=paths)


CH = {SEA: '~', RIVER: 'r', LAVA: 'L', TOXIC: 'x', GRASS: '.', FARM: 'f', SAVANNA: 'v', SAND: 's', DUNE: 'd', DIRT: 'D', BADLANDS: 'b',
      ASH: 'a', BASALT: 'B', SWAMP: 'w', MARSH: 'm', TUNDRA: 't', SNOW: 'n', GLACIER: 'g', JUNGLE: 'j', CHASM: 'c', CRATER: 'o', CROP: 'p'}


def main():
    M, icon_cells, meta, info0 = build()
    img, info = render(M, icon_cells, meta)
    im = Image.fromarray(img)
    im.save(HERE / 'design-1x-v4.png')
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(HERE / 'design-2x-v4.png')
    lines = []
    for y in range(H):
        lines.append(''.join(('^' if M.O[y, x] in MOUNTS else '%' if M.O[y, x] else CH[int(M.G[y, x])]) for x in range(W)))
    (HERE / 'map-v4.txt').write_text('\n'.join(lines) + '\n')
    sites = []
    for name, src, spec, x, y, ground, kind, why in SITES:
        w, h = icon_cells[name][2:]
        sites.append({'name': name, 'kind': kind, 'source': src, 'icon': spec if src == 'ext' else list(spec), 'x': x, 'y': y, 'w': w, 'h': h,
                      'note': why})
    (HERE / 'map-v4.json').write_text(json.dumps({
        'width': W, 'height': H, 'ground': M.G.tolist(), 'object': M.O.tolist(), 'height_level': M.Hh.tolist(),
        'ramp': [[x, y] for y, x in zip(*np.nonzero(M.RAMP))],
        'names': {str(k): v for k, v in NAMES.items()}, 'sites': sites,
        'routes': [{'name': n_, 'cells': [list(c) for c in cells]} for n_, cells in info['paths']],
        'bridges': [{'x': x, 'y': y, 'dir': d} for (x, y), d in sorted(info['bridge'].items())],
        'note': '손 설계 다각형·꺾은선 + 결정적 노이즈 왜곡. 무작위 생성기 없음.',
    }, ensure_ascii=False, default=int))
    used = {NAMES.get(g, {0: '바다', 1: '강·호수', 2: '용암', 3: '독수'}.get(g)): int((M.G == g).sum()) for g in np.unique(M.G)}
    print('ground:', used)
    print('objects:', {int(o): int((M.O == o).sum()) for o in np.unique(M.O)}, 'faces:', len(M.face), 'ramps:', int(M.RAMP.sum()))
    lab, n = ndi.label(M.G >= 10)
    print('land comps >30:', sorted([int(s) for s in ndi.sum(M.G >= 10, lab, range(1, n + 1)) if s > 30], reverse=True))


if __name__ == '__main__':
    main()

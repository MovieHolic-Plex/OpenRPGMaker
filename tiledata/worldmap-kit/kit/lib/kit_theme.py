#!/usr/bin/env python3
"""월드맵 키트 테마 층 — 세계관마다 「지형 위에 덧칠할 것」을 고른다.

테마 = 아이콘 세트 + 팔레트 + 덧칠(overlay) 목록. `themes/<id>.json` (`worldmap-theme/1`):
  { "id", "name", "iconset", "palette", "overlays": ["paved_roads", "sprawl:modern", ...], "kind": "land" | "space" }

덧칠은 팔레트를 입힌 지형 그림(아이콘 없음) 위에서, 아이콘을 붙이기 전에 돈다. 지형 모양·장소 발자국·여정은 그대로다.
그림은 전부 이 파일 안에서 좌표·문자 지도로 찍은 16px 도트다(생성 이미지·트레이싱 없음).

  paved_roads      흙길 → 아스팔트(연석 + 노란 가운데 점선), 나무 다리 → 콘크리트 다리
  rail             흙길 → 철길(자갈 바닥 + 침목 + 두 줄 레일), 나무 다리 → 철교(트러스)
  sprawl:<style>   도시 둘레를 시가지 구역으로: 구역 바닥(modern = 콘크리트 보도, steam = 자갈 포장) + 칸마다 건물
                   (modern = 주택·아파트·사무동·주차장 / steam = 벽돌 연립·공장·가스탱크·석탄장, 굴뚝 연기)
  smog             공업 도시 둘레를 그을음 빛으로 디더(거리에 따라 4단)
  kind=space       땅 대신 우주: 바다 = 공허, 땅 = 성운 구역(바닥 종류별 색, 경계는 노이즈로 휜다), 산·절벽 = 소행성대,
                   화산 = 붉은 거성, 숲 = 성단, 사구 바다 = 이온 폭풍, 길 = 초공간 항로, 다리 = 워프 게이트

길 칸의 실제 모양(실측): 띠가 x 4~11(8px), 바깥 테두리 1px 이 ±1 흔들린다. 새 길은 같은 띠(4~11)를 칸 가운데에 반듯하게 다시 찍고,
옛 테두리가 띠 밖으로 나간 화소는 옆 바닥 화소로 메운다 — 이웃 칸끼리 띠가 항상 같은 자리에서 만난다.
"""
import json
import zlib
from pathlib import Path

import numpy as np

TS = 16
DIRS = {'N': (0, -1), 'E': (1, 0), 'S': (0, 1), 'W': (-1, 0)}
B0, B1 = 4, 12                      # 길 띠 [B0, B1) — 8px

BUILD_G = {10, 11, 12, 13, 15, 21, 22, 24, 27}          # 시가지를 올릴 수 있는 바닥(초원·밭·사바나·사막·황무지·툰드라·설원·정글 바닥)
CITY_RING = {'capital': 2, 'fort_city': 2, 'harbor_city': 2, 'large_town': 1}


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def h32(*a):
    return zlib.crc32(repr(a).encode()) & 0xffffffff


BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def bayer(h, w, oy=0, ox=0):
    return np.tile(BAYER4, (h // 4 + 2, w // 4 + 2))[oy % 4:oy % 4 + h, ox % 4:ox % 4 + w]


# ──────────────────────────────── 테마 읽기 ────────────────────────────────
def load_theme(path):
    d = json.loads(Path(path).read_text())
    for k in ('id', 'name', 'iconset', 'palette'):
        if k not in d:
            raise ValueError('테마 %s: %s 가 없다' % (path, k))
    d.setdefault('overlays', [])
    d.setdefault('kind', 'land')
    if d['kind'] not in ('land', 'space'):
        raise ValueError('테마 %s: kind 는 land | space' % d['id'])
    for o in d['overlays']:
        base = o.split(':')[0]
        if base not in OVERLAYS:
            raise ValueError('테마 %s: 모르는 덧칠 %s (있는 것: %s)' % (d['id'], o, ', '.join(sorted(OVERLAYS))))
    return d


class Ctx:
    """덧칠이 보는 지형 정보 — 세계 JSON(칸 배열·길·발자국·다리)에서 만든다."""

    def __init__(self, world):
        self.w = world
        self.G = np.array(world['ground'], np.int16)
        self.O = np.array(world['object'], np.int16)
        self.Hh = np.array(world['height_level'], np.int16)
        self.H, self.W = self.G.shape
        self.road = self._mask(world['road_cells'])
        self.foot = self._mask(world['foot_cells'])
        self.face = self._mask([f[:2] for f in world['face']])
        self.ramp = self._mask(world['ramp'])
        self.dune = self._mask(world['dune_sea'])
        self.bridge = {(b['x'], b['y']): b['dir'] for b in world['bridges']}
        self.places = world['places']
        self.occupied = np.zeros((self.H, self.W), bool)          # 장소 발자국(천공섬 포함)
        for p in self.places:
            self.occupied[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']] = True
        _n, sx, sy, sw, sh = world['sky_site']
        self.sky = (sx, sy, sw, sh)
        self.occupied[sy:sy + sh, sx:sx + sw] = True

    def _mask(self, cells):
        m = np.zeros((self.H, self.W), bool)
        for x, y in cells:
            m[y, x] = True
        return m

    road_px = None                                   # 옛 흙길 테두리 화소(지도 크기 bool) — 있으면 발자국 쪽 연결을 그 흔적으로 가린다

    def _entered(self, X, Y, d):
        """옛 길이 발자국 칸 (X, Y) 으로 실제로 들어갔는가 — 맞닿은 가장자리 4줄의 띠 안에 옛 길 테두리 화소가 있는가."""
        if self.road_px is None:
            return True
        t = self.road_px[Y * TS:(Y + 1) * TS, X * TS:(X + 1) * TS]
        strip = {'S': t[0:4, B0 - 1:B1 + 1], 'N': t[TS - 4:TS, B0 - 1:B1 + 1], 'E': t[B0 - 1:B1 + 1, 0:4], 'W': t[B0 - 1:B1 + 1, TS - 4:TS]}[d]
        return bool(strip.any())

    def links(self, x, y):
        """길 칸이 이어지는 방향(길·다리·경사로 쪽, 그리고 옛 길이 실제로 들어간 발자국 쪽)."""
        out = []
        for d, (dx, dy) in DIRS.items():
            X, Y = x + dx, y + dy
            if not (0 <= X < self.W and 0 <= Y < self.H):
                continue
            if self.road[Y, X] and not self.foot[Y, X] or (X, Y) in self.bridge or self.ramp[Y, X]:
                out.append(d)
            elif self.foot[Y, X] and self._entered(X, Y, d):
                out.append(d)
        return out

    def path_cells(self):
        return [(int(x), int(y)) for y, x in zip(*np.nonzero(self.road)) if not self.foot[y, x]]


def band_mask(links):
    """16x16 띠 마스크 — 가운데 사각 + 이어진 쪽 팔."""
    m = np.zeros((TS, TS), bool)
    m[B0:B1, B0:B1] = True
    for d in links:
        if d == 'N':
            m[0:B0, B0:B1] = True
        if d == 'S':
            m[B1:TS, B0:B1] = True
        if d == 'W':
            m[B0:B1, 0:B0] = True
        if d == 'E':
            m[B0:B1, B1:TS] = True
    return m


def _dilate(m):
    d = m.copy()
    d[1:] |= m[:-1]
    d[:-1] |= m[1:]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def fill_global(img, dirty, blocked):
    """dirty 화소를 가장 가까운 깨끗한 화소(dirty·blocked 아닌 곳)의 색으로 메운다 — 지도 전체를 한 번에(8방 번짐).
    칸마다 따로 메우면 이웃 칸의 아직 안 지운 흙을 재료로 집어 왔다(실측: 굽이 아래 흙 삼각형)."""
    out = img.copy()
    unk = dirty.copy()
    src = ~dirty & ~blocked
    H, W = unk.shape
    for _ in range(3 * TS):
        if not unk.any():
            break
        got = np.zeros_like(unk)
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            ys = slice(max(0, -dy), H - max(0, dy))
            yd = slice(max(0, dy), H - max(0, -dy))
            xs = slice(max(0, -dx), W - max(0, dx))
            xd = slice(max(0, dx), W - max(0, -dx))
            # 목적지 (y, x) 가 unknown 이고 원천 (y-dy, x-dx) 가 깨끗하면 복사
            m = unk[yd, xd] & src[ys, xs] & ~got[yd, xd]
            if m.any():
                o = out[yd, xd]
                o[m] = out[ys, xs][m]
                got[yd, xd] |= m
        if not got.any():
            break
        unk &= ~got
        src |= got
    return out


def _edge(band, links):
    """띠 가장자리(밖과 닿는 화소). 칸 경계에서 이어지는 팔 끝은 가장자리가 아니다."""
    pad = np.pad(band, 1, constant_values=False)
    for d in links:                                  # 이어진 쪽은 칸 밖도 띠로 친다
        if d == 'N':
            pad[0, 1 + B0:1 + B1] = True
        if d == 'S':
            pad[-1, 1 + B0:1 + B1] = True
        if d == 'W':
            pad[1 + B0:1 + B1, 0] = True
        if d == 'E':
            pad[1 + B0:1 + B1, -1] = True
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    low = band & ~(pad[2:, 1:-1] & pad[1:-1, 2:])    # 남쪽·동쪽 가장자리(그늘 쪽)
    return band & ~inner, low


# ──────────────────────────────── 아스팔트 ────────────────────────────────
ASPH = dict(dark=hx('3b3d47'), mid=hx('4b4e5a'), lite=hx('5c606d'), curb=hx('a3a7b0'), curb_d=hx('6f727c'), line=hx('e8c24c'))


def draw_asphalt(t, band, links, x, y):
    noise = bayer(TS, TS, y * 3, x * 5)
    t[band] = ASPH['mid']
    t[band & (noise < .18)] = ASPH['dark']
    t[band & (noise > .86)] = ASPH['lite']
    edge, low = _edge(band, links)
    t[edge] = ASPH['curb']
    t[edge & low] = ASPH['curb_d']
    c = 7                                            # 가운데 노란 점선(3 켜고 3 끄고, 전역 좌표라 칸을 넘어 이어진다)
    horiz = [d for d in links if d in 'EW']
    vert = [d for d in links if d in 'NS']
    for xx in range(TS):
        if (x * TS + xx) // 3 % 2 == 0 and ((xx < B0 and 'W' in links) or (xx >= B1 and 'E' in links) or (B0 <= xx < B1 and horiz and not vert)):
            t[c, xx] = ASPH['line']
    for yy in range(TS):
        if (y * TS + yy) // 3 % 2 == 0 and ((yy < B0 and 'N' in links) or (yy >= B1 and 'S' in links) or (B0 <= yy < B1 and vert and not horiz)):
            t[yy, c] = ASPH['line']
    return t


def draw_concrete_bridge(t, d, x, y):
    if d == 'h':
        t[B0 - 1:B1 + 1, :] = ASPH['mid']
        t[B0 - 2, :] = hx('7c808a')
        t[B0 - 1, :] = hx('c9ccd3')
        t[B1, :] = hx('8d919b')
        t[B1 + 1, :] = hx('3a3d46')
        for xx in range(0, TS, 4):
            t[B0 - 2, xx] = hx('e3e6ec')
        for xx in range(TS):
            if (x * TS + xx) // 3 % 2 == 0:
                t[7, xx] = ASPH['line']
    else:
        t[:, B0 - 1:B1 + 1] = ASPH['mid']
        t[:, B0 - 2] = hx('7c808a')
        t[:, B0 - 1] = hx('c9ccd3')
        t[:, B1] = hx('8d919b')
        t[:, B1 + 1] = hx('3a3d46')
        for yy in range(TS):
            if (y * TS + yy) // 3 % 2 == 0:
                t[yy, 7] = ASPH['line']
    return t


# ──────────────────────────────── 철길 ────────────────────────────────
RAIL = dict(bal_d=hx('4a4038'), bal=hx('62584e'), bal_l=hx('7e7266'), tie=hx('3e2a1c'), tie_l=hx('6b4a33'),
            rail=hx('c8ccd4'), rail_d=hx('4a4e58'), stop=hx('c2452f'))


def draw_rail(t, band, links, x, y):
    noise = bayer(TS, TS, y * 7, x * 3)
    t[band] = RAIL['bal']
    t[band & (noise < .3)] = RAIL['bal_d']
    t[band & (noise > .8)] = RAIL['bal_l']
    edge, _low = _edge(band, links)
    t[edge] = RAIL['bal_d']
    lk = set(links)
    r1, r2 = B0 + 1, B1 - 3                          # 레일 두 줄: 5, 9 (+ 그림자 1px)

    def ties_h(x0, x1):          # 가로 선로의 침목(세로 막대)
        for xx in range(x0, x1):
            if (x * TS + xx) % 3 == 0:
                t[B0 + 1:B1 - 1, xx] = RAIL['tie']
                t[B0 + 1, xx] = RAIL['tie_l']

    def ties_v(y0, y1):
        for yy in range(y0, y1):
            if (y * TS + yy) % 3 == 0:
                t[yy, B0 + 1:B1 - 1] = RAIL['tie']
                t[yy, B0 + 1] = RAIL['tie_l']

    def rail_h(yy, x0, x1):
        t[yy, x0:x1] = RAIL['rail']
        t[yy + 1, x0:x1] = RAIL['rail_d']

    def rail_v(xx, y0, y1):
        t[y0:y1, xx] = RAIL['rail']
        t[y0:y1, xx + 1] = RAIL['rail_d']

    straight_h = bool(lk) and lk <= {'E', 'W'}
    straight_v = bool(lk) and lk <= {'N', 'S'}
    if straight_h or not lk:
        ties_h(0, TS)
        rail_h(r1, 0, TS)
        rail_h(r2, 0, TS)
    elif straight_v:
        ties_v(0, TS)
        rail_v(r1, 0, TS)
        rail_v(r2, 0, TS)
    elif len(lk) == 2:                               # 굽이: 두 레일을 ㄱ 자로
        v = 'N' if 'N' in lk else 'S'
        h = 'E' if 'E' in lk else 'W'
        ties_v(*((0, B0) if v == 'N' else (B1, TS)))
        ties_h(*((B1, TS) if h == 'E' else (0, B0)))
        ox, ix = (r1, r2) if h == 'E' else (r2, r1)
        oy, iy = (r2, r1) if v == 'N' else (r1, r2)
        if v == 'N':
            rail_v(ox, 0, oy + 2)
            rail_v(ix, 0, iy + 2)
        else:
            rail_v(ox, oy, TS)
            rail_v(ix, iy, TS)
        if h == 'E':
            rail_h(oy, ox, TS)
            rail_h(iy, ix, TS)
        else:
            rail_h(oy, 0, ox + 2)
            rail_h(iy, 0, ix + 2)
    else:                                            # 갈림(3·4갈래): 각 팔을 가운데까지 + 가운데 전철기 판
        t[B0 + 1:B1 - 1, B0 + 1:B1 - 1] = RAIL['tie']
        for d in lk:
            if d == 'E':
                ties_h(B1, TS)
                rail_h(r1, B0, TS)
                rail_h(r2, B0, TS)
            elif d == 'W':
                ties_h(0, B0)
                rail_h(r1, 0, B1)
                rail_h(r2, 0, B1)
            elif d == 'N':
                ties_v(0, B0)
                rail_v(r1, 0, B1)
                rail_v(r2, 0, B1)
            else:
                ties_v(B1, TS)
                rail_v(r1, B0, TS)
                rail_v(r2, B0, TS)
    if len(lk) == 1:                                 # 끝: 차막이
        d = next(iter(lk))
        if d in 'EW':
            t[B0 + 1:B1 - 1, B0 if d == 'E' else B1 - 1] = RAIL['stop']
        else:
            t[B0 if d == 'S' else B1 - 1, B0 + 1:B1 - 1] = RAIL['stop']
    return t


def draw_truss_bridge(t, d, x, y):
    iron, iron_d, iron_l = hx('4b4f5c'), hx('2c2f38'), hx('8a90a2')
    if d == 'h':
        t[B0 - 1:B1 + 1, :] = RAIL['bal_d']
        for xx in range(TS):
            if (x * TS + xx) % 3 == 0:
                t[B0 + 1:B1 - 1, xx] = RAIL['tie']
        for r in (B0 + 1, B1 - 3):
            t[r, :] = RAIL['rail']
            t[r + 1, :] = RAIL['rail_d']
        t[B0 - 3, :] = iron_d
        t[B0 - 2, :] = iron_l
        t[B1 + 1, :] = iron
        t[B1 + 2, :] = iron_d
        for xx in range(TS):                         # 트러스 기둥
            if (x * TS + xx) % 4 == 0:
                t[B0 - 3:B0, xx] = iron_l
    else:
        t[:, B0 - 1:B1 + 1] = RAIL['bal_d']
        for yy in range(TS):
            if (y * TS + yy) % 3 == 0:
                t[yy, B0 + 1:B1 - 1] = RAIL['tie']
        for r in (B0 + 1, B1 - 3):
            t[:, r] = RAIL['rail']
            t[:, r + 1] = RAIL['rail_d']
        t[:, B0 - 3] = iron_d
        t[:, B0 - 2] = iron_l
        t[:, B1 + 1] = iron
        t[:, B1 + 2] = iron_d
    return t


def road_interior_colors(img, ctx, road_role_px):
    """옛 흙길 띠 안쪽 색(곧은 길 칸의 가운데 줄에서 센다) — 띠 밖·발자국 안에 남은 옛 길 바닥을 찾는 데 쓴다."""
    from collections import Counter
    cnt = Counter()
    for (x, y) in ctx.path_cells()[:400]:
        tile = img[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        rp = road_role_px[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        for yy in range(B0 + 2, B1 - 2):
            for xx in range(B0 + 2, B1 - 2):
                if not rp[yy, xx]:
                    cnt[tuple(int(v) for v in tile[yy, xx])] += 1
    tot = sum(cnt.values()) or 1
    return {c for c, n in cnt.items() if n / tot > .003}


def overlay_roads(img, ctx, style, road_role_px):
    """흙길 → 아스팔트/철길. ① 지울 화소(옛 테두리·띠 안쪽 색, 띠 밖과 길에 맞닿은 발자국 칸)를 지도 전체에서 먼저 모으고
    ② 한 번에 바닥으로 메운 뒤 ③ 새 띠를 그린다."""
    ctx.road_px = road_role_px
    colors = road_interior_colors(img, ctx, road_role_px)
    H, W = img.shape[:2]
    cmatch = np.zeros((H, W), bool)
    for c in colors:
        cmatch |= np.all(img == np.array(c, np.uint8), -1)
    dirty = np.zeros((H, W), bool)
    bands = np.zeros((H, W), bool)
    cells = []
    for (x, y) in ctx.path_cells():
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        if (x, y) in ctx.bridge:
            bands[sl] = True
            continue
        links = ctx.links(x, y)
        band = band_mask(links)
        bands[sl] |= band
        dirty[sl] |= (_dilate(band) | road_role_px[sl] | cmatch[sl]) & ~band
        cells.append((x, y, links, band))
    for y, x in zip(*np.nonzero(ctx.foot)):
        if any(0 <= x + dx < ctx.W and 0 <= y + dy < ctx.H and ctx.road[y + dy, x + dx] and not ctx.foot[y + dy, x + dx]
               for dx, dy in DIRS.values()):
            sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            dirty[sl] |= road_role_px[sl] | cmatch[sl]
    out = fill_global(img, dirty & ~bands, bands)
    for x, y, links, band in cells:
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        tile = out[sl].copy()
        out[sl] = draw_asphalt(tile, band, links, x, y) if style == 'paved' else draw_rail(tile, band, links, x, y)
    for (x, y), d in ctx.bridge.items():
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        tile = out[sl].copy()
        out[sl] = draw_concrete_bridge(tile, d, x, y) if style == 'paved' else draw_truss_bridge(tile, d, x, y)
    return out


# ──────────────────────────────── 시가지 ────────────────────────────────
# 문자 지도 16x16. '.' = 투명(구역 바닥이 보인다). 빛은 왼쪽 위, 정면 3/4(윗면 + 남쪽 벽). 'z' = 바닥 그림자(밑을 어둡게).
SPRITE_COLORS = {
    'modern': {
        'K': '2a2632', 'r': 'c8483a', 'R': 'e0705a', 'q': '8e2f28', 'b': '3f6fb8', 'B': '6a98d8', 'p': '2b4c86',
        'w': 'd9cdb4', 'W': 'f2ead8', 'v': 'a89c86', 'i': '3c4a66', 'g': '8fc0e8', 'G': 'cfe6f7', 'd': '5a4636', 'y': 'f0d070',
        's': 'a7abb4', 'S': 'c9ccd3', 't': '7c808a', 'a': '4b4e5a', 'L': 'dfe3ea', 'c': '3a7a3a', 'C': '5aa04a', 'n': '2e5a2e',
        'o': 'd8a040', 'm': '6d7180', 'M': '8d919b', 'e': 'e65a4a',
    },
    'steam': {
        'K': '231c1c', 'h': '7a3a2c', 'H': 'a0533a', 'j': '5a2a22', 'l': '3e3f4c', 'L': '5e6072', 'u': '2a2b36',
        'g': 'f0c060', 'd': '3a2a20', 's': '8a8e98', 'S': 'b4b8c2', 'x': '6b6e78', 'k': '2e2f38', 'c': '9a9ea8', 'C': 'd2d4da',
        'o': 'b07a3a', 'O': 'd8a24a', 'm': '4a4038', 'M': '6a5e52', 'q': '1a1614', 'Q': '3a3430',
    },
}

SPRITES = {
    'modern': {
        'suburb': [                                  # 단독 주택 둘(빨강·파랑 지붕) + 나무
            '................',
            '.KKKKKK.........',
            'KRRRRRRK........',
            'KrrrrrrK..KKKKKK',
            'KqqqqqqK.KBBBBBB',
            'KwgwwgwKzKbbbbbb',
            'KwgwdgwKzKpppppp',
            'KvvvdvvKzKwgwwgw',
            '.KKKKKKzzKwgwdgw',
            '..zzzzzz.KvvvdvK',
            '..........KKKKKz',
            '....nnc...zzzzzz',
            '...cCCCc........',
            '...cCCcc........',
            '....ncdz........',
            '.....zz.........',
        ],
        'apartment': [                               # 아파트 한 동(평평한 지붕·실외기·창 격자)
            '................',
            '..KKKKKKKKKKKK..',
            '..KSSSSSSSSSSK..',
            '..KSmmSSSSSSSK..',
            '..KSmMSSSSStSK..',
            '..KssssssssssKz.',
            '..KKKKKKKKKKKKz.',
            '..KwiwiwiwiwiKz.',
            '..KwvwvwvwvwvKz.',
            '..KwiwywiwiwyKz.',
            '..KwvwvwvwvwvKz.',
            '..KwiwiwdKwiwKz.',
            '..KvvvvvdKvvvKz.',
            '..KKKKKKKKKKKKz.',
            '...zzzzzzzzzzzz.',
            '................',
        ],
        'office': [                                  # 유리 사무동 + 낮은 상가
            '....KKKKK.......',
            '....KSSSK.......',
            '....KsssK.......',
            '....KKKKKz......',
            '....KGgGKz......',
            '....KgGgKz......',
            '....KGgGKz......',
            '....KgGgKKKKKKK.',
            '....KGgGKKoooooK',
            '....KgGgKKKKKKKz',
            '....KGgGKKwWwWwK',
            '....KgGgKKwdwwwK',
            '....KbdbKKvdvvvK',
            '....KKKKKKKKKKKz',
            '.....zzzzzzzzzzz',
            '................',
        ],
        'lot': [                                     # 주차장(흰 칸선 + 차 셋) — 테두리는 연석 회색
            '................',
            '................',
            '.tttttttttttttt.',
            '.taaaaaaaaaaaat.',
            '.taLaaLaaLaaLat.',
            '.taLaaLaaLaaLat.',
            '.taLKKLaaLKKLKt.',
            '.taKeeKaaKBBKbt.',
            '.taKeeKaaKbbKbt.',
            '.taKKKKaaKKKKKt.',
            '.taaaaaaaaaaaat.',
            '.taaaaaaaaaaaat.',
            '.ttttttttttttttz',
            '..zzzzzzzzzzzzzz',
            '................',
            '................',
        ],
    },
    'steam': {
        'rowhouse': [                                # 벽돌 연립 셋(슬레이트 지붕·굴뚝)
            '..K.....K.......',
            '.KxK...KxK......',
            '.KxK...KxK......',
            'KKKKKKKKKKKKKKK.',
            'KLLLLLLLLLLLLLK.',
            'KlllllllllllllK.',
            'KuuuuuuuuuuuuuKz',
            'KHgHhHgHhHgHhHKz',
            'KhghhhghhhghhhKz',
            'KHHdHHHdHHHdHHKz',
            'KhhdhhhdhhhdhhKz',
            'KjjjjjjjjjjjjjKz',
            'KKKKKKKKKKKKKKKz',
            '.zzzzzzzzzzzzzzz',
            '................',
            '................',
        ],
        'factory': [                                 # 톱니 지붕 공장 + 높은 굴뚝
            '..........KK....',
            '..........KxK...',
            '..........KxK...',
            '..........KsK...',
            '..........KxK...',
            '.K..K..K..KsK...',
            'KLKKLKKLKKKxK...',
            'KlLKlLKlLKKsKz..',
            'KllLllLllLKxKz..',
            'KKKKKKKKKKKKKz..',
            'KHgHHgHHgHHHHKz.',
            'KhghhghhghhhhKz.',
            'KHHHHdddHHHHHKz.',
            'KjjjjdddjjjjjKz.',
            'KKKKKKKKKKKKKKz.',
            '.zzzzzzzzzzzzzz.',
        ],
        'gasometer': [                               # 가스 탱크(원통·테 두름)
            '................',
            '....KKKKKKK.....',
            '...KSSSSSSSK....',
            '..KScccccccSK...',
            '..KKKKKKKKKKK...',
            '..KCsxxxxxsxKz..',
            '..KKKKKKKKKKKz..',
            '..KCsxxxxxsxKz..',
            '..KKKKKKKKKKKz..',
            '..KCsxxxxxsxKz..',
            '..KCsxxxxxsxKz..',
            '..KkkkkkkkkkKz..',
            '...KKKKKKKKKzz..',
            '....zzzzzzzzz...',
            '................',
            '................',
        ],
        'yard': [                                    # 석탄 더미 + 철제 창고
            '................',
            '.........KKKKKK.',
            '........KMMMMMMK',
            '........KmmmmmmK',
            '........KKKKKKKz',
            '........KoOoOoKz',
            '........KoKKoOKz',
            '...KKK..KoKKoOKz',
            '..KQQqK.KKKKKKKz',
            '.KQQqqqK.zzzzzzz',
            'KQqqqqqqK.......',
            'KqqqqqqqKz......',
            '.KKKKKKKzz......',
            '..zzzzzzz.......',
            '................',
            '................',
        ],
    },
}

DISTRICT = {      # 구역 바닥: (바탕, 어두운 점, 밝은 점, 바깥 테두리)
    'modern': ('aca89c', '989488', 'bdb9ad', '6f6b62'),
    'steam': ('5e544a', '4c443a', '70665a', '362e28'),
}
SMOKE = ['dcd8d0', 'b8b4ac', '908c86']


def sprite(style, name):
    rows = SPRITES[style][name]
    pal = SPRITE_COLORS[style]
    a = np.zeros((TS, TS, 3), np.uint8)
    m = np.zeros((TS, TS), np.uint8)              # 0 투명 · 1 그림 · 2 그림자
    assert len(rows) == TS, (style, name)
    for y, row in enumerate(rows):
        assert len(row) == TS, (style, name, y, len(row))
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            if ch == 'z':
                m[y, x] = 2
                continue
            a[y, x] = hx(pal[ch])
            m[y, x] = 1
    return a, m


def stamp(img, x, y, spr, flip=False):
    a, m = spr
    if flip:
        a, m = a[:, ::-1], m[:, ::-1]
    sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
    t = img[sl]
    t[m == 1] = a[m == 1]
    t[m == 2] = (t[m == 2].astype(np.float32) * .62).astype(np.uint8)


def _buildable(ctx, x, y, hl):
    if not (0 <= x < ctx.W and 0 <= y < ctx.H):
        return False
    if ctx.occupied[y, x] or ctx.road[y, x] or ctx.foot[y, x] or ctx.face[y, x] or ctx.ramp[y, x] or (x, y) in ctx.bridge:
        return False
    return ctx.G[y, x] in BUILD_G and not ctx.O[y, x] and ctx.Hh[y, x] == hl and not ctx.dune[y, x]


def sprawl_cells(ctx):
    """시가지 구역 칸 → {(x, y): (도시까지 고리 거리, 도시 역할)}.
    고리 1 은 쓸 수 있는 칸 전부, 고리 2 는 고리 1 구역에 4방으로 붙은 칸만 60 % — 구역이 도시에서 끊기지 않고 덩이로 자란다."""
    cand = {}
    for p in ctx.places:
        r = CITY_RING.get(p['role'])
        if not r:
            continue
        x0, y0, x1, y1 = p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']
        hl = int(np.median(ctx.Hh[y0:y1, x0:x1]))
        others = [q for q in ctx.places if q is not p and q['role'] not in CITY_RING]
        for ring in range(1, r + 1):
            for y in range(y0 - ring, y1 + ring):
                for x in range(x0 - ring, x1 + ring):
                    if max(x0 - x, x - (x1 - 1), y0 - y, y - (y1 - 1)) != ring or not _buildable(ctx, x, y, hl):
                        continue
                    if any(q['x'] - 1 <= x <= q['x'] + q['w'] and q['y'] - 1 <= y <= q['y'] + q['h'] for q in others):
                        continue                    # 도시가 아닌 장소 아이콘 둘레 1칸은 비운다
                    if ring >= 2:
                        if not any(cand.get((x + dx, y + dy), (9,))[0] < ring for dx, dy in DIRS.values()):
                            continue
                        if h32('sprawl', x, y) % 100 >= 60:
                            continue
                    if (x, y) not in cand or cand[(x, y)][0] > ring:
                        cand[(x, y)] = (ring, p['role'])
    return cand


def draw_district_ground(img, cells, style, ctx):
    base, dk, lt, rim = (hx(c) for c in DISTRICT[style])
    D = bayer(TS, TS)
    for (x, y) in cells:
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        t = img[sl]
        t[:] = base
        n = bayer(TS, TS, y * 5 + h32('dg', x, y) % 4, x * 3)
        t[n < .14] = dk
        t[n > .9] = lt
        if style == 'steam':                         # 자갈 포장: 4px 마다 줄눈
            t[3::4, :][D[3::4, :] < .6] = dk
        # 바깥 테두리: 구역·도시·길이 아닌 이웃 쪽 가장자리 1px
        for d, (dx, dy) in DIRS.items():
            X, Y = x + dx, y + dy
            inside = (X, Y) in cells or (0 <= X < ctx.W and 0 <= Y < ctx.H and (ctx.occupied[Y, X] or ctx.road[Y, X] or ctx.foot[Y, X]))
            if inside:
                continue
            if d == 'N':
                t[0, :] = rim
            if d == 'S':
                t[TS - 1, :] = rim
            if d == 'W':
                t[:, 0] = rim
            if d == 'E':
                t[:, TS - 1] = rim


def overlay_sprawl(img, ctx, style):
    out = img.copy()
    cells = sprawl_cells(ctx)
    draw_district_ground(out, cells, style, ctx)
    if style == 'modern':
        inner = ['apartment', 'office', 'apartment', 'lot', 'office']
        outer = ['suburb', 'suburb', 'suburb', 'lot', 'apartment']
    else:
        inner = ['factory', 'rowhouse', 'gasometer', 'rowhouse', 'yard']
        outer = ['rowhouse', 'rowhouse', 'yard', 'factory', 'rowhouse']
    sprs = {n: sprite(style, n) for n in SPRITES[style]}
    placed = []
    for (x, y), (ring, role) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):   # 위 줄부터 — 아래 건물이 위 건물 그림자를 덮는다
        pool = inner if (ring == 1 and role in ('capital', 'fort_city', 'harbor_city')) else outer
        name = pool[h32('kind', x, y) % len(pool)]
        stamp(out, x, y, sprs[name], flip=(name == 'suburb' and h32('flip', x, y) % 2 == 0))
        placed.append((x, y, name))
    if style == 'steam':
        for x, y, name in placed:
            tops = {'factory': [(11, 0)], 'rowhouse': [(2, 0), (9, 0)]}.get(name, [])
            for k, (cx, cy) in enumerate(tops):
                draw_smoke(out, x * TS + cx, y * TS + cy, h32('sm', x, y, k))
    return out, placed


def draw_smoke(img, gx, gy, h):
    """굴뚝 위로 커지며 오른쪽으로 흘러가는 연기 덩이 셋(2x2 → 3x2 → 3x3)."""
    puffs = [(0, -2, 2, 2), (1 + h % 2, -5, 3, 2), (3, -8, 3, 3)]
    for i, (dx, dy, w, hh) in enumerate(puffs):
        c = hx(SMOKE[i])
        for yy in range(hh):
            for xx in range(w):
                if (w == 3 and hh == 3) and (xx, yy) in ((0, 0), (2, 0), (0, 2), (2, 2)):
                    continue                          # 3x3 은 모서리를 깎아 둥글게
                X, Y = gx + dx + xx, gy + dy + yy
                if 0 <= X < img.shape[1] and 0 <= Y < img.shape[0]:
                    img[Y, X] = c


# ──────────────────────────────── 그을음 ────────────────────────────────
def overlay_smog(img, ctx):
    out = img.astype(np.float32)
    H, W = ctx.H * TS, ctx.W * TS
    yy, xx = np.mgrid[0:H, 0:W]
    field = np.zeros((H, W), np.float32)
    for p in ctx.places:
        if p['role'] not in ('capital', 'fort_city', 'harbor_city', 'large_town'):
            continue
        cx, cy = (p['x'] + p['w'] / 2) * TS, (p['y'] + p['h'] / 2) * TS
        r = (6 if p['role'] == 'capital' else 4) * TS
        field = np.maximum(field, np.clip(1 - np.hypot(xx - cx, yy - cy) / r, 0, 1))
    lv = np.clip(np.floor(field * 4 + bayer(H, W)) / 4.0, 0, 1)[..., None]
    soot = np.array([70, 60, 52], np.float32)
    out = out * (1 - .32 * lv) + soot * (.32 * lv)
    return np.clip(out, 0, 255).astype(np.uint8)


# ──────────────────────────────── 우주 ────────────────────────────────
SPACE = {
    'void': hx('070816'), 'void2': hx('0b0d22'), 'fringe': hx('121638'),
    'star': [hx('ffffff'), hx('cfe0ff'), hx('ffe8b0'), hx('ffb6a0')],
    'lane': hx('5fe6ff'), 'lane_g': hx('1d5f78'), 'lane_n': hx('ffffff'), 'gate': hx('ffd66a'),
    'rock_d': hx('3a3240'), 'rock': hx('6a5e6e'), 'rock_l': hx('a2949e'), 'rock_k': hx('120e18'),
}
NEB = {     # 바닥 종류 → 성운 색 3단(어두움 → 밝음)
    'grass': ('122a44', '1c4560', '2c6a80'), 'farm': ('22264a', '343866', '4c5288'),
    'savanna': ('341f3e', '512f58', '744678'), 'sand': ('3a2418', '62401f', '94642c'), 'dirt': ('261e34', '3c3050', '58486e'),
    'badlands': ('3a1626', '5e223c', '883454'), 'ash': ('2e1016', '50181e', '7c2626'), 'swamp': ('122a1c', '1e4a2a', '30703a'),
    'tundra': ('17263c', '243a58', '385478'), 'snow': ('1c2c4c', '34527a', '6088b4'),
}
G_NEB = {10: 'grass', 24: 'grass', 27: 'grass', 11: 'farm', 12: 'savanna', 13: 'sand', 14: 'sand', 15: 'dirt', 16: 'badlands',
         17: 'ash', 18: 'ash', 25: 'ash', 26: 'ash', 19: 'swamp', 20: 'swamp', 21: 'tundra', 22: 'snow', 23: 'snow', 2: 'ash', 3: 'swamp'}
NEB_ORDER = list(NEB)


def vnoise(H, W, cell, seed):
    gh, gw = H // cell + 2, W // cell + 2
    g = np.random.default_rng(seed).random((gh, gw))
    yy, xx = np.mgrid[0:H, 0:W] / cell
    y0, x0 = yy.astype(int), xx.astype(int)
    fy, fx = yy - y0, xx - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _neb_class(ctx):
    """칸 → 성운 번호(-1 = 공허). 강은 둘레 땅의 다수 종류로 메운다(우주에 강은 없다)."""
    cls = np.full((ctx.H, ctx.W), -1, np.int16)
    for g, n in G_NEB.items():
        cls[ctx.G == g] = NEB_ORDER.index(n)
    river = ctx.G == 1
    for _ in range(6):
        if not (river & (cls < 0)).any():
            break
        new = cls.copy()
        for y, x in zip(*np.nonzero(river & (cls < 0))):
            vals = [cls[y + dy, x + dx] for dx, dy in DIRS.values() if 0 <= y + dy < ctx.H and 0 <= x + dx < ctx.W and cls[y + dy, x + dx] >= 0]
            if vals:
                new[y, x] = max(set(vals), key=vals.count)
        cls = new
    return cls


def render_space(ctx, seed=11, road_px=None):
    """땅 대신 우주 지도를 처음부터 그린다. 칸 배열(바닥·물체·사구·길)을 그대로 읽어 같은 여정·같은 장벽 자리를 지킨다."""
    ctx.road_px = road_px
    H, W = ctx.H * TS, ctx.W * TS
    img = np.empty((H, W, 3), np.uint8)
    cls = _neb_class(ctx)
    # 칸 경계를 노이즈로 휜다: 화소마다 ±12px 옮긴 자리의 칸을 읽는다 → 성운 경계가 칸 모양을 벗는다
    wx = (vnoise(H, W, 28, seed + 3) - .5) * 24
    wy = (vnoise(H, W, 28, seed + 4) - .5) * 24
    yy, xx = np.mgrid[0:H, 0:W]
    cx = np.clip(((xx + wx) // TS).astype(int), 0, ctx.W - 1)
    cy = np.clip(((yy + wy) // TS).astype(int), 0, ctx.H - 1)
    P = cls[cy, cx]
    # 공허 쪽 끝자락: 땅에서 거리(칸)를 같은 휜 좌표로 읽어 3단 디더
    land = cls >= 0
    dist = np.where(land, 0, 99).astype(np.int16)
    for k in range(1, 4):
        nb = _dilate(dist == k - 1)
        dist[nb & (dist == 99)] = k
    Dp = dist[cy, cx]
    nz = .62 * vnoise(H, W, 44, seed) + .38 * vnoise(H, W, 12, seed + 1)
    D = bayer(H, W)
    img[:] = SPACE['void']
    img[(nz + D * .25) > .62] = SPACE['void2']
    v = nz + (D - .5) * .22
    lvl = np.where(v > .64, 2, np.where(v > .42, 1, 0))
    for i, name in enumerate(NEB_ORDER):
        m = P == i
        if m.any():
            for k, c in enumerate(NEB[name]):
                img[m & (lvl == k)] = hx(c)
    for k, thr in ((1, .5), (2, .25), (3, .1)):
        img[(Dp == k) & (D < thr)] = SPACE['fringe']
    # 별: 성운 위는 밝고 많게, 공허는 드물게
    rng = np.random.default_rng(seed + 7)
    n = int(W * H / 90)
    sx, sy = rng.integers(1, W - 1, n), rng.integers(1, H - 1, n)
    sc, big, keepr = rng.integers(0, 4, n), rng.random(n), rng.random(n)
    for x, y, c, b, kr in zip(sx, sy, sc, big, keepr):
        if P[y, x] < 0 and kr > .45:
            continue
        col = SPACE['star'][c]
        if b > .985:                                  # 십자 반짝
            dim = (col.astype(np.int16) * 6 // 10).astype(np.uint8)
            img[y, x] = col
            img[y - 1, x] = img[y + 1, x] = img[y, x - 1] = img[y, x + 1] = dim
        elif b > .8:
            img[y, x] = col
        else:
            img[y, x] = (col.astype(np.int16) * 55 // 100).astype(np.uint8)
    for y in range(ctx.H):
        for x in range(ctx.W):
            o = int(ctx.O[y, x])
            if o in (1, 2, 3, 5):                     # 숲 → 성단: 밝은 별 5개 + 가운데 빛무리
                for i in range(5):
                    h = h32('cl', x, y, i)
                    img[y * TS + 2 + h % 12, x * TS + 2 + (h >> 8) % 12] = SPACE['star'][(h >> 16) % 3]
            elif o in (6, 7, 9) or ctx.face[y, x]:
                draw_asteroids(img, x, y)
            elif o == 8:
                draw_red_giant(img, x, y)
    draw_ion_storm(img, ctx)
    draw_hyperlanes(img, ctx)
    return img


def draw_asteroids(img, x, y):
    """한 칸에 소행성 2~3개 — 빛은 왼쪽 위(밝음), 오른쪽 아래 어두움 + 검은 테 1px."""
    rocks = [(4, 5, 4), (11, 10, 3), (11, 3, 2)] if h32('ast', x, y) % 2 else [(5, 10, 4), (11, 5, 3), (3, 3, 2)]
    for i, (cx, cy, r) in enumerate(rocks):
        if i == 2 and h32('ast3', x, y) % 3 == 0:
            continue
        cx += h32('ax', x, y, i) % 3 - 1
        cy += h32('ay', x, y, i) % 3 - 1
        for yy in range(-r - 1, r + 2):
            for xx in range(-r - 1, r + 2):
                d = (xx * xx) / (r * r) + (yy * yy) / (r * r * .72)
                X, Y = x * TS + cx + xx, y * TS + cy + yy
                if not (0 <= X < img.shape[1] and 0 <= Y < img.shape[0]):
                    continue
                if d <= 1.0:
                    light = -xx - yy
                    c = SPACE['rock_l'] if light > r * .6 else SPACE['rock'] if light > -r * .4 else SPACE['rock_d']
                    if (xx * 7 + yy * 13 + x + y) % 11 == 0 and light < r * .6:
                        c = SPACE['rock_d']                     # 크레이터 점
                    img[Y, X] = c
                elif d <= 1.5 and not (img[Y, X] == SPACE['rock']).all() and not (img[Y, X] == SPACE['rock_l']).all():
                    img[Y, X] = SPACE['rock_k']


def draw_red_giant(img, x, y):
    cx, cy, r = x * TS + 8, y * TS + 8, 6
    for yy in range(-r - 2, r + 3):
        for xx in range(-r - 2, r + 3):
            d = np.hypot(xx, yy)
            X, Y = cx + xx, cy + yy
            if not (0 <= X < img.shape[1] and 0 <= Y < img.shape[0]):
                continue
            if d <= r:
                light = (-xx - yy) / r
                img[Y, X] = hx('ffd27a') if light > .7 else hx('ff8a3a') if light > -.2 else hx('c2361e')
            elif d <= r + 1.5 and (xx + yy) % 2 == 0:
                img[Y, X] = hx('6a1a14')


def draw_ion_storm(img, ctx):
    """사구 바다 칸(사막선이 있어야 건너던 장벽) → 보라 이온 폭풍: 물결 줄무늬 3단 + 번개."""
    a, b, c = hx('2a1450'), hx('5a2a8a'), hx('b06aff')
    for y in range(ctx.H):
        for x in range(ctx.W):
            if not ctx.dune[y, x] or ctx.occupied[y, x]:
                continue
            gy, gx = np.mgrid[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            w = np.sin(gx * .35 + np.sin(gy * .18) * 2.2 + gy * .12)
            t = img[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            t[w > -.1] = a
            hi = w > .55
            t[hi] = b
            t[hi & ((gx + gy) % 5 == 0)] = c
            h = h32('zap', x, y)
            if h % 4 == 0:
                px, py = 3 + h % 9, 2 + (h >> 4) % 9
                for k in range(5):
                    if py + k < TS:
                        t[py + k, min(TS - 1, px + (k % 2))] = hx('ffffff')


def draw_hyperlanes(img, ctx):
    """길 칸 → 초공간 항로: 칸 가운데를 잇는 1px 청록 선 + 양옆 1px 빛 + 전역 8px 마다 흰 항로 표지."""
    def put(X, Y, horiz):
        if not (1 <= X < img.shape[1] - 1 and 1 <= Y < img.shape[0] - 1):
            return
        img[Y, X] = SPACE['lane_n'] if (X + Y) % 8 == 0 else SPACE['lane']
        for ox, oy in (((0, -1), (0, 1)) if horiz else ((-1, 0), (1, 0))):
            q = img[Y + oy, X + ox]
            if not (q == SPACE['lane']).all() and not (q == SPACE['lane_n']).all():
                img[Y + oy, X + ox] = np.maximum(q, SPACE['lane_g'])
    for (x, y) in ctx.path_cells():
        if (x, y) in ctx.bridge:
            continue
        cx, cy = x * TS + 7, y * TS + 7
        links = ctx.links(x, y) or ['E']
        for d in links:
            dx, dy = DIRS[d]
            for k in range(0, 9):
                put(cx + dx * k, cy + dy * k, dx != 0)
    for (x, y), d in ctx.bridge.items():             # 다리 → 워프 게이트 구간(양끝 금색 고리)
        cx, cy = x * TS + 7, y * TS + 7
        for k in range(-7, 9):
            put(cx + k, cy, True) if d == 'h' else put(cx, cy + k, False)
        for e in (-5, 6):
            for t in range(-3, 4):
                X, Y = (cx + e, cy + t) if d == 'h' else (cx + t, cy + e)
                img[Y, X] = SPACE['gate']


# ──────────────────────────────── 적용 ────────────────────────────────
def apply_land(img, world, theme, road_role_px):
    """팔레트를 입힌 지형 그림에 테마 덧칠을 차례로 적용한다. 반환 (그림, 덧칠별 개수 보고)."""
    ctx = Ctx(world)
    rep = {}
    out = img
    for o in theme['overlays']:
        base, _, arg = o.partition(':')
        if base in ('paved_roads', 'rail'):
            out = overlay_roads(out, ctx, 'paved' if base == 'paved_roads' else 'rail', road_role_px)
            rep[o] = len(ctx.path_cells())
        elif base == 'sprawl':
            out, placed = overlay_sprawl(out, ctx, arg or 'modern')
            rep[o] = len(placed)
        elif base == 'smog':
            out = overlay_smog(out, ctx)
            rep[o] = 1
    return out, rep


OVERLAYS = {'paved_roads', 'rail', 'sprawl', 'smog'}

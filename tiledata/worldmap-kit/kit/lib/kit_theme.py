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
  erase_roads      흙길을 지운다(옆 바닥으로 메움) — 문명 이전 세계
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
    d.setdefault('terrain', None)                    # terrains/<id> — 지형 모양 편집(없으면 공용 지형)
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
        lay = world.get('layout') or {}
        self.systems = lay.get('systems')                # 생성 우주(galaxy): [[x, y, 반지름, 성단 번호], …] — 성계 별·궤도·은하 핵을 그린다
        self.core = lay.get('core')
        self.spiral = lay.get('spiral')                  # 나선팔 매개변수(kit_space.galaxy_land): 핵에서 뻗는 팔을 그린다

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
        """길 칸이 이어지는 방향. 길·다리는 그대로, 경사로·장소 쪽은 옛 길 흔적이 그쪽 가장자리에 있을 때만.
        장소 쪽은 길이 거기서 끝나는 칸(장소 아닌 연결이 하나 이하)에서만 — 길이 장소 옆을 지나가며 빗살 팔을 돋우지 않게(QA 2026-10-02).
        장소 = 실제 아이콘 발자국(occupied). world 의 foot 칸에는 장소 밖 길 칸도 섞여 있어 그것을 장소로 치면 선로가 경사로 앞에서 끊겼다."""
        out, side = [], []
        for d, (dx, dy) in DIRS.items():
            X, Y = x + dx, y + dy
            if not (0 <= X < self.W and 0 <= Y < self.H):
                continue
            if (self.road[Y, X] and not self.occupied[Y, X]) or (X, Y) in self.bridge:
                out.append(d)
            elif self.ramp[Y, X] and self._entered(X, Y, d):
                out.append(d)
            elif self.occupied[Y, X] and self._entered(X, Y, d):
                side.append(d)
        if len(out) <= 1 and side:
            out.append(side[0])
        return out

    def path_cells(self):
        return [(int(x), int(y)) for y, x in zip(*np.nonzero(self.road)) if not self.occupied[y, x]]


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


def _erode4(m):
    e = m.copy()
    e[1:] &= m[:-1]
    e[:-1] &= m[1:]
    e[:, 1:] &= m[:, :-1]
    e[:, :-1] &= m[:, 1:]
    return e


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
    """콘크리트 다리 — 차도 폭은 길과 같은 8px(띠 4~11), 바깥 1px 난간, 물 위로 그림자 2px + 4px 마다 교각."""
    rail_l, rail_d, shade = hx('d3d6dc'), hx('6f727c'), (t.astype(np.float32) * .55).astype(np.uint8)
    if d == 'h':
        t[B1 + 1:B1 + 3, :] = shade[B1 + 1:B1 + 3, :]
        for xx in range(TS):
            if (x * TS + xx) % 8 in (2, 3):
                t[B1 + 1:B1 + 4, xx] = hx('8d919b')
        t[B0:B1, :] = ASPH['mid']
        t[B0 - 1, :] = rail_l
        t[B1, :] = rail_d
        for xx in range(TS):
            if (x * TS + xx) % 4 == 0:
                t[B0 - 2, xx] = rail_l
            if (x * TS + xx) // 3 % 2 == 0:
                t[7, xx] = ASPH['line']
    else:
        t[:, B1 + 1:B1 + 3] = shade[:, B1 + 1:B1 + 3]
        t[:, B0:B1] = ASPH['mid']
        t[:, B0 - 1] = rail_l
        t[:, B1] = rail_d
        for yy in range(TS):
            if (y * TS + yy) // 3 % 2 == 0:
                t[yy, 7] = ASPH['line']
    return t


# ──────────────────────────────── 철길 ────────────────────────────────
RAIL = dict(bal_d=hx('3e352e'), bal=hx('544a42'), bal_l=hx('6e6258'), tie=hx('8a5a34'), tie_l=hx('b88450'),
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

    def ties_h(x0, x1):          # 가로 선로의 침목(세로 막대, 띠 끝까지 — 레일 밖으로 내밀어 1배에서도 철길로 읽힌다)
        for xx in range(x0, x1):
            if (x * TS + xx) % 3 == 0:
                t[B0:B1, xx] = RAIL['tie']
                t[B0, xx] = RAIL['tie_l']

    def ties_v(y0, y1):
        for yy in range(y0, y1):
            if (y * TS + yy) % 3 == 0:
                t[yy, B0:B1] = RAIL['tie']
                t[yy, B0] = RAIL['tie_l']

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
    else:                                            # 갈림(3·4갈래): 각 팔을 가운데까지 + 가운데 전철기 판(레일 위에)
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
    if len(lk) >= 3:
        t[B0 + 1:B1 - 1, B0 + 1:B1 - 1] = hx('4a3a2c')
        t[B0 + 1, B0 + 1:B1 - 1] = RAIL['tie_l']
        t[B0 + 3:B1 - 3, B0 + 3:B1 - 3] = RAIL['rail']
    if len(lk) == 1:                                 # 끝: 차막이
        d = next(iter(lk))
        if d in 'EW':
            t[B0 + 1:B1 - 1, B0 if d == 'E' else B1 - 1] = RAIL['stop']
        else:
            t[B0 if d == 'S' else B1 - 1, B0 + 1:B1 - 1] = RAIL['stop']
    return t


def draw_truss_bridge(t, d, x, y):
    """철교 — 선로 양옆에 현재(위·아래 보) + X 자 사재가 이어지는 트러스(4px 마다 칸)."""
    iron, iron_d, iron_l = hx('4b4f5c'), hx('22252c'), hx('9aa0b2')
    shade = (t.astype(np.float32) * .55).astype(np.uint8)
    def truss_strip(get, n0):              # 3줄짜리 트러스 띠: 위 현재 · X 사재 · 아래 현재
        for k in range(TS):
            g = (n0 + k) % 4
            get(0, k, iron_l)
            get(2, k, iron_d)
            get(1, k, iron_l if g in (0, 2) else iron)
    if d == 'h':
        t[B1 + 3:B1 + 4, :] = shade[B1 + 3:B1 + 4, :]
        t[B0:B1, :] = RAIL['bal_d']
        for xx in range(TS):
            if (x * TS + xx) % 3 == 0:
                t[B0:B1, xx] = RAIL['tie']
        for r in (B0 + 1, B1 - 3):
            t[r, :] = RAIL['rail']
            t[r + 1, :] = RAIL['rail_d']
        for top in (B0 - 3, B1):
            truss_strip(lambda i, k, c, top=top: t.__setitem__((top + i, k), c), x * TS)
    else:
        t[:, B1 + 3:B1 + 4] = shade[:, B1 + 3:B1 + 4]
        t[:, B0:B1] = RAIL['bal_d']
        for yy in range(TS):
            if (y * TS + yy) % 3 == 0:
                t[yy, B0:B1] = RAIL['tie']
        for r in (B0 + 1, B1 - 3):
            t[:, r] = RAIL['rail']
            t[:, r + 1] = RAIL['rail_d']
        for left in (B0 - 3, B1):
            truss_strip(lambda i, k, c, left=left: t.__setitem__((k, left + i), c), y * TS)
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
    g = lane_graph(ctx)
    for (x, y), d in ctx.bridge.items():             # 다리 칸 밑을 옆 물 칸 그림으로 — 옛 나무 다리가 칸 폭 전체라 지우면 모래가 비쳤다(QA (84,37–40))
        side = [(1, 0), (-1, 0)] if d == 'v' else [(0, 1), (0, -1)]
        for dx, dy in side + [(2 * a, 2 * b) for a, b in side]:
            X, Y = x + dx, y + dy
            if 0 <= X < ctx.W and 0 <= Y < ctx.H and ctx.G[Y, X] in (0, 1) and (X, Y) not in ctx.bridge:
                img[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS] = img[Y * TS:(Y + 1) * TS, X * TS:(X + 1) * TS]
                break
    for (x, y), links in sorted(g.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        if (x, y) in ctx.bridge:
            bands[sl] = True
            continue
        band = band_mask(links)
        if style == 'erase':                         # 길을 지운다(원시 세계) — 띠까지 바닥으로
            dirty[sl] |= _dilate(_dilate(band)) | road_role_px[sl] | cmatch[sl]
            continue
        bands[sl] |= band
        dirty[sl] |= (_dilate(_dilate(band)) | road_role_px[sl] | cmatch[sl]) & ~band
        cells.append((x, y, links, band))
    for y, x in zip(*np.nonzero(ctx.ramp & ~ctx.occupied)):     # 그물에서 걸러진 경사로 칸의 옛 흙길도 지운다
        if (int(x), int(y)) not in g:
            sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            dirty[sl] |= road_role_px[sl]
    for y, x in zip(*np.nonzero(ctx.occupied)):
        if any(0 <= x + dx < ctx.W and 0 <= y + dy < ctx.H and ctx.road[y + dy, x + dx] and not ctx.occupied[y + dy, x + dx]
               for dx, dy in DIRS.values()):
            sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            dirty[sl] |= road_role_px[sl] | cmatch[sl]
    if style == 'erase':
        return _erase_by_donor(img, ctx, g, dirty & ~bands, bands)
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


def _erase_by_donor(img, ctx, g, dirty, bands):
    """길 지우기(선사): 칸 그림을 가까운 같은 바닥 칸에서 통째로(길 칸) 또는 같은 자리 화소로(둘레 칸) 빌려 온다.
    8방향 전파로 넓게 메우면 화소가 한 줄로 늘어진 줄무늬가 남았다(QA 2026-10-03 prehistoric 불합격)."""
    out = img.copy()
    roadset = {c for c in g if c not in ctx.bridge}
    bad = ctx.occupied | ctx.ramp | ctx.face | ctx.road
    cache = {}

    K8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]

    def sig(x, y):                                   # 8 이웃이 같은 (바닥, 물체)인가 — 가장자리 무늬(숲 그늘·해안)가 맞는 칸을 고른다
        k = (ctx.G[y, x], ctx.O[y, x])
        return tuple(0 <= x + dx < ctx.W and 0 <= y + dy < ctx.H and (ctx.G[y + dy, x + dx], ctx.O[y + dy, x + dx]) == k for dx, dy in K8)

    def donor(x, y):
        k = (int(ctx.G[y, x]), int(ctx.O[y, x]))
        me = sig(x, y)
        best = None
        for dy in range(-10, 11):
            for dx in range(-10, 11):
                X, Y = x + dx, y + dy
                if (dx, dy) == (0, 0) or not (0 <= X < ctx.W and 0 <= Y < ctx.H) or bad[Y, X] or (X, Y) in ctx.bridge or (X, Y) in roadset:
                    continue
                if (int(ctx.G[Y, X]), int(ctx.O[Y, X])) != k or dirty[Y * TS:(Y + 1) * TS, X * TS:(X + 1) * TS].any():
                    continue
                s = sum(p != q for p, q in zip(me, sig(X, Y))) * 40 + dx * dx + dy * dy
                if best is None or s < best[0]:
                    best = (s, X, Y)
        return best[1:] if best else None
    rest = np.zeros_like(dirty)
    for y in range(ctx.H):
        for x in range(ctx.W):
            sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
            if not dirty[sl].any() and (x, y) not in roadset:
                continue
            if ctx.ramp[y, x]:                       # 경사로는 흙 비탈 그대로 둔다(선사에도 오르는 길은 있다)
                continue
            if ctx.occupied[y, x]:
                rest[sl] |= dirty[sl]
                continue
            d = donor(x, y)
            if d is None:
                rest[sl] |= dirty[sl]
                continue
            X, Y = d
            src = img[Y * TS:(Y + 1) * TS, X * TS:(X + 1) * TS]
            if (x, y) in roadset:
                out[sl] = src
            else:
                m = dirty[sl]
                out[sl][m] = src[m]
    if rest.any():
        out = fill_global(out, rest, bands)
    return out


# ──────────────────────────────── 시가지 ────────────────────────────────
# 문자 지도 16x16. '.' = 투명(구역 바닥이 보인다). 빛은 왼쪽 위, 정면 3/4(윗면 + 남쪽 벽). 'z' = 바닥 그림자(밑을 어둡게).
SPRITE_COLORS = {
    'modern': {
        'K': '2a2632', 'r': 'c8483a', 'R': 'e0705a', 'q': '8e2f28', 'b': '3f6fb8', 'B': '6a98d8', 'p': '2b4c86',
        'w': 'd9cdb4', 'W': 'f2ead8', 'v': 'a89c86', 'i': '3c4a66', 'g': '8fc0e8', 'G': 'cfe6f7', 'd': '5a4636', 'y': 'f0d070',
        's': 'a7abb4', 'S': 'c9ccd3', 't': '7c808a', 'a': '4b4e5a', 'L': 'dfe3ea', 'c': '3a7a3a', 'C': '5aa04a', 'n': '2e5a2e',
        'o': 'd8a040', 'm': '6d7180', 'M': '8d919b', 'e': 'e65a4a', 'Y': '6ef0f4', 'u': '2a8a9a', 'U': '1c5a68',
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
        'office': [                                  # 유리 사무동(세로 창 띠) + 낮은 상가
            '....KKKKK.......',
            '....KSSSK.......',
            '....KsssK.......',
            '....KKKKKz......',
            '....KGgGKz......',
            '....KGgGKz......',
            '....KGgGKz......',
            '....KGgGKKKKKKK.',
            '....KGgGKKoooooK',
            '....KGgGKKKKKKKz',
            '....KGgGKKwWwWwK',
            '....KGgGKKwdwwwK',
            '....KbdbKKvdvvvK',
            '....KKKKKKKKKKKz',
            '.....zzzzzzzzzzz',
            '................',
        ],
        'lot': [                                     # 주차장(흰 칸선 + 차 셋: 지붕·앞유리·바퀴)
            '................',
            '................',
            '.tttttttttttttt.',
            '.taaaaaaaaaaaat.',
            '.taLaaaLaaaLaat.',
            '.taLKKKLKKKLaat.',
            '.taLKeKLKBKLaat.',
            '.taLKGKLKGKLaat.',
            '.taLKeKLKbKLaat.',
            '.taLnKnLnKnLaat.',
            '.taaaaaaaaaaaat.',
            '.taaaaaaaaaaaat.',
            '.ttttttttttttttz',
            '..zzzzzzzzzzzzzz',
            '................',
            '................',
        ],
        'tower': [                                   # 고층 빌딩(현대·SF 도심용)
            '.....KKKKK......',
            '.....KSSSK......',
            '.....KKKKK......',
            '....KKKKKKK.....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KGgGgGKz....',
            '....KbbdbbKz....',
            '....KKKKKKKz....',
            '.....zzzzzzz....',
            '................',
        ],
        'spire': [
            '.......KK.......',
            '......KYYK......',
            '......KSSK......',
            '......KSsKz.....',
            '.....KKSsKKz....',
            '.....KGSsgKz....',
            '.....KGSsgKz....',
            '....KKGSsgKKz...',
            '....KgGSsguKz...',
            '....KgGSsguKz...',
            '...KKgGSsguKKz..',
            '...KSSSSsssstKz.',
            '...KaaaYaaYaaKz.',
            '...KKKKKKKKKKKz.',
            '....zzzzzzzzzzz.',
            '................',
        ],
        'dome': [
            '................',
            '................',
            '................',
            '.....KKKKKK.....',
            '...KKGGgggUKK...',
            '..KGGLGgggUUuK..',
            '..KGLGggguUuuKz.',
            '.KGGGgggguUuuUKz',
            '.KGGgggguuUuuUKz',
            '.KSSSSSSSssssttK',
            '.KaYaaYaaYaaYaaK',
            '.KaaaaaaaaaaaaaK',
            '.KKKKKKKKKKKKKKz',
            '..zzzzzzzzzzzzzz',
            '................',
            '................',
        ],
        'pods': [
            '................',
            '..KKK.....KKK...',
            '.KSSSK...KSSSK..',
            '.KYYsK...KYYsK..',
            '.KSSsKz..KSSsKz.',
            '.KsstKz..KsstKz.',
            '.KYYtKz..KYYtKz.',
            '.KaaaKz..KaaaKz.',
            '..KKKzzKKKKKzz..',
            '..zzzzKSSSSSK...',
            '......KYYYYsKz..',
            '......KSSSsstKz.',
            '......KYYYYtKz..',
            '......KaaaaaaKz.',
            '......KKKKKKKz..',
            '.......zzzzzzz..',
        ],
        'pad': [
            '................',
            '................',
            '..KKKKKKKKKKKK..',
            '.KMMMMMMMMMMMMK.',
            '.KMyyyyyyyyyyMK.',
            '.KMyMMMMMMMMyMK.',
            '.KMyMyMMMMyMyMK.',
            '.KMyMyyyyyyMyMK.',
            '.KMyMyMMMMyMyMK.',
            '.KMyMMMMMMMMyMK.',
            '.KMyyyyyyyyyyMK.',
            '.KmmmmmmmmmmmmK.',
            '.KaYaaaaaaaaYaKz',
            '.KKKKKKKKKKKKKKz',
            '..zzzzzzzzzzzzzz',
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
DISTRICT['sf'] = DISTRICT['modern']
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
                        if h32('sprawl', x, y) % 100 >= 85:
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


POOLS = {   # (도심 고리 1, 그 밖)
    'modern': (['apartment', 'office', 'apartment', 'lot', 'office'], ['suburb', 'suburb', 'suburb', 'lot', 'apartment']),
    'sf': (['tower', 'spire', 'dome', 'tower', 'pods', 'pad'], ['pods', 'dome', 'spire', 'pad', 'tower', 'pods']),
    'steam': (['factory', 'rowhouse', 'gasometer', 'rowhouse', 'yard'], ['rowhouse', 'rowhouse', 'yard', 'factory', 'rowhouse']),
}


# 빈 광장 비율(도심 고리 1, 그 밖) — SF 는 탑·돔이 칸을 꽉 채워 소품 무늬로 읽혔다(QA 4차): 바깥을 성기게
PLAZA = {'modern': (16, 16), 'sf': (18, 42), 'steam': (16, 16)}


def overlay_sprawl(img, ctx, style):
    out = img.copy()
    art = 'modern' if style == 'sf' else style
    cells = sprawl_cells(ctx)
    # 도시 발자국 안도 구역 바닥으로 — 아이콘의 투명한 자리에 풀밭이 비치면 「도심이 풀밭, 바깥이 포장」이 된다(QA)
    feet = set()
    for p in ctx.places:
        if p['role'] in CITY_RING:
            for y in range(p['y'], p['y'] + p['h']):
                for x in range(p['x'], p['x'] + p['w']):
                    if not ctx.road[y, x] or ctx.foot[y, x]:
                        feet.add((x, y))
    draw_district_ground(out, set(cells) | feet, art, ctx)
    inner, outer = POOLS[style]
    sprs = {n: sprite(art, n) for n in SPRITES[art]}
    placed, name_at = [], {}
    for (x, y), (ring, role) in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):   # 위 줄부터 — 아래 건물이 위 건물 그림자를 덮는다
        core = ring == 1 and role in ('capital', 'fort_city', 'harbor_city')
        if h32('plaza', x, y) % 100 < PLAZA[style][0 if core else 1]:   # 빈 광장·마당 — 칸마다 건물이 박히면 무늬 타일처럼 읽혔다(QA 3차)
            continue
        pool = inner if core else outer
        k = h32('kind', x, y) % len(pool)
        for _ in range(len(pool)):                   # 왼쪽·위 이웃과 같은 건물은 피한다
            if pool[k] not in (name_at.get((x - 1, y)), name_at.get((x, y - 1))):
                break
            k = (k + 1) % len(pool)
        name = pool[k]
        name_at[(x, y)] = name
        stamp(out, x, y, sprs[name], flip=(name == 'suburb' and h32('flip', x, y) % 2 == 0))
        placed.append((x, y, name))
    if art == 'steam':
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
                if 0 <= X < img.shape[1] and 0 <= Y < img.shape[0] and (i == 0 or (X + Y) % 2 == 0 or (xx, yy) == (1, 1)):
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
        r = (9 if p['role'] == 'capital' else 6.5) * TS
        field = np.maximum(field, np.clip(1 - np.hypot(xx - cx, yy - cy) / r, 0, 1))
    lv = np.clip(np.floor(field * 4 + bayer(H, W)) / 4.0, 0, 1)[..., None]
    soot = np.array([52, 44, 38], np.float32)
    out = out * (1 - .55 * lv) + soot * (.55 * lv)
    return np.clip(out, 0, 255).astype(np.uint8)


# ──────────────────────────────── 우주 ────────────────────────────────
SPACE = {
    'void': hx('070816'), 'void2': hx('0a0c1e'), 'rift': hx('020208'), 'rift_e': hx('3a1a6a'),
    'star': [hx('ffffff'), hx('cfe0ff'), hx('ffe8b0'), hx('ffb6a0')],
    'lane': hx('7af0ff'), 'lane_g': hx('2a8aa8'), 'lane_n': hx('ffffff'),
    'gate': hx('ffd66a'), 'gate_d': hx('a8741e'), 'gate_k': hx('3a2408'),
    'rock_d': hx('3a3240'), 'rock': hx('6a5e6e'), 'rock_l': hx('a2949e'), 'rock_k': hx('120e18'),
    'dust': hx('241e30'), 'dust_l': hx('3a3248'),
}
NEB = {     # 바닥 종류 → 성운 색 4단(옅음 → 핵). 사막 = 호박·금빛, 늪 = 청록·에메랄드(QA 2026-10-03)
    'grass': ('0f2238', '17364f', '22506a', '3a7a92'), 'farm': ('1b1e3e', '2a2e5a', '3d437c', '5a64a6'),
    'savanna': ('2a1934', '432650', '61386e', '8a5698'), 'sand': ('2e2010', '4a3416', '70501e', 'a8822e'),
    'dirt': ('211a2e', '342a48', '4c3e66', '6c5a8c'), 'badlands': ('32142a', '4e1f40', '72305c', 'a04a80'),
    'ash': ('2a0e14', '461620', '6a2028', '9a3434'), 'swamp': ('0c2626', '124038', '1a5c4c', '2a8a6c'),
    'tundra': ('141f34', '1f3150', '2f4870', '486a9a'), 'snow': ('182644', '2c4670', '46689a', '78a0cc'),
}
G_NEB = {10: 'grass', 24: 'grass', 27: 'grass', 11: 'farm', 12: 'savanna', 13: 'sand', 14: 'sand', 15: 'dirt', 16: 'badlands',
         17: 'ash', 18: 'ash', 25: 'ash', 26: 'ash', 19: 'swamp', 20: 'swamp', 21: 'tundra', 22: 'snow', 23: 'snow', 2: 'ash', 3: 'swamp'}
NEB_ORDER = list(NEB)
NEB_RGB = np.array([[hx(c) for c in NEB[n]] for n in NEB_ORDER], np.uint8)      # (종류, 단, 3)


def vnoise(H, W, cell, seed):
    gh, gw = H // cell + 2, W // cell + 2
    g = np.random.default_rng(seed).random((gh, gw))
    yy, xx = np.mgrid[0:H, 0:W] / cell
    y0, x0 = yy.astype(int), xx.astype(int)
    fy, fx = yy - y0, xx - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _boxblur(a, r):
    """가로·세로 상자 흐림(반지름 r px) — 누적합."""
    k = 2 * r + 1
    p = np.pad(a, ((r + 1, r), (0, 0)), mode='edge')
    c = np.cumsum(p, axis=0)
    a = (c[k:] - c[:-k]) / k
    p = np.pad(a, ((0, 0), (r + 1, r)), mode='edge')
    c = np.cumsum(p, axis=1)
    return (c[:, k:] - c[:, :-k]) / k


def _neb_class(ctx):
    """칸 → 성운 번호(-1 = 공허). 강은 둘레 땅으로 메우고(우주에 강은 없다), 3x3 다수결 2번 + 작은 덩이(<6칸) 흡수로
    밭·강 조각 같은 작은 네모를 지운다(QA: 「대륙을 색만 바꾼 것처럼 읽힌다」)."""
    H, W = ctx.H, ctx.W
    cls = np.full((H, W), -1, np.int16)
    for g, n in G_NEB.items():
        cls[ctx.G == g] = NEB_ORDER.index(n)
    land = cls >= 0
    land |= ctx.G == 1
    K = len(NEB_ORDER)

    def votes(c):
        v = np.zeros((K, H, W), np.int16)
        p = np.pad(c, 1, constant_values=-1)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                s = p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
                for k in range(K):
                    v[k] += s == k
        return v
    for _ in range(8):                                   # 강 → 이웃 다수
        hole = land & (cls < 0)
        if not hole.any():
            break
        best = votes(cls).argmax(0)
        has = votes(cls).max(0) > 0
        cls[hole & has] = best[hole & has]
    for _ in range(2):                                   # 다수결
        v = votes(cls)
        best, top = v.argmax(0), v.max(0)
        own = np.take_along_axis(v, np.clip(cls, 0, K - 1)[None].astype(np.int64), 0)[0]
        ch = land & (top >= 5) & (top > own)
        cls[ch] = best[ch]
    seen = np.zeros((H, W), bool)                        # 작은 덩이 흡수
    for y0, x0 in zip(*np.nonzero(land)):
        if seen[y0, x0]:
            continue
        k = cls[y0, x0]
        comp, st = [], [(y0, x0)]
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            comp.append((y, x))
            for dx, dy in DIRS.values():
                Y, X = y + dy, x + dx
                if 0 <= Y < H and 0 <= X < W and not seen[Y, X] and land[Y, X] and cls[Y, X] == k:
                    seen[Y, X] = True
                    st.append((Y, X))
        if len(comp) < 6:
            nb = [cls[y + dy, x + dx] for y, x in comp for dx, dy in DIRS.values()
                  if 0 <= y + dy < H and 0 <= x + dx < W and land[y + dy, x + dx] and cls[y + dy, x + dx] != k]
            if nb:
                kk = max(set(nb), key=nb.count)
                for y, x in comp:
                    cls[y, x] = kk
    return cls


def _nearest_fill(cls):
    """공허 칸에도 가장 가까운 성운 번호를 채운 사본 — 바깥 끝자락·가스 실이 어느 성운 색을 쓸지 정한다."""
    c = cls.copy()
    H, W = c.shape
    for _ in range(max(H, W)):
        hole = c < 0
        if not hole.any():
            break
        p = np.pad(c, 1, constant_values=-1)
        for dx, dy in DIRS.values():
            s = p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
            f = hole & (s >= 0)
            c[f] = s[f]
            hole &= ~f
    return c


def _components(mask):
    H, W = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        comp, st = [], [(y0, x0)]
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            comp.append((int(x), int(y)))
            for dx, dy in DIRS.values():
                Y, X = y + dy, x + dx
                if 0 <= Y < H and 0 <= X < W and mask[Y, X] and not seen[Y, X]:
                    seen[Y, X] = True
                    st.append((Y, X))
        out.append(comp)
    return out


def render_space(ctx, seed=11, road_px=None):
    """땅 대신 우주 지도를 처음부터 그린다. 칸 배열(바닥·물체·사구·길)을 그대로 읽어 같은 여정·같은 장벽 자리를 지킨다.

    성운은 칸 덩어리가 아니라 밀도장이다: 휜 좌표로 읽은 땅 마스크를 흐려 밀도를 얻고, 안쪽은 노이즈로 밝기·빈 구멍,
    바깥은 2~3칸에 걸쳐 옅어지며 가스 실이 공허로 뻗는다. 색은 바닥 종류(가장 가까운 성운)가 정한다."""
    ctx.road_px = road_px
    H, W = ctx.H * TS, ctx.W * TS
    cls = _neb_class(ctx)
    near = _nearest_fill(cls)
    yy, xx = np.mgrid[0:H, 0:W]
    wx = (vnoise(H, W, 28, seed + 3) - .5) * 24 + (vnoise(H, W, 9, seed + 5) - .5) * 8
    wy = (vnoise(H, W, 28, seed + 4) - .5) * 24 + (vnoise(H, W, 9, seed + 6) - .5) * 8
    cx = np.clip(((xx + wx) // TS).astype(int), 0, ctx.W - 1)
    cy = np.clip(((yy + wy) // TS).astype(int), 0, ctx.H - 1)
    Lp = (cls >= 0)[cy, cx].astype(np.float32)
    d = _boxblur(_boxblur(Lp, 13), 13)                   # 0 공허 … 1 깊은 안쪽, 해안 ≈ .5
    n1 = .6 * vnoise(H, W, 40, seed) + .4 * vnoise(H, W, 12, seed + 1)
    din = np.clip((d - .32) / .5, 0, 1)
    pocket = np.clip((.30 - vnoise(H, W, 64, seed + 9)) / .12, 0, 1) * np.clip((din - .5) * 2, 0, 1)
    B = din * (.3 + .95 * n1) - (.45 if ctx.systems else 1.1) * pocket   # 은하: 구멍을 옅은 패임으로(검은 호수처럼 읽혔다 — 적대 QA)
    ridge = 1 - np.abs(2 * vnoise(H, W, 18, seed + 12) - 1)
    wisp = (d > .03) & (d < .45) & (ridge > .9 - .5 * d)
    Bd = B + (bayer(H, W) - .5) * .12
    lvl = np.select([Bd > .95, Bd > .68, Bd > .4, Bd > .1], [4, 3, 2, 1], 0)
    lvl = np.where((lvl == 0) & wisp, 1, lvl)
    lvl = np.where((lvl == 0) & (d > .2) & (d <= .32) & (bayer(H, W) < (d - .2) / .12 * .5), 1, lvl)   # 끝자락 디더 한 단
    # 성운 종류는 크게 휜 좌표로 고른다 — 바닥 다각형의 곧은 변이 성운 경계에 그대로 남아 세로 직선이 됐다(QA 4차, (68,18~22))
    wx3 = (vnoise(H, W, 46, seed + 31) - .5) * 84 + (vnoise(H, W, 15, seed + 32) - .5) * 14
    wy3 = (vnoise(H, W, 46, seed + 33) - .5) * 84 + (vnoise(H, W, 15, seed + 34) - .5) * 14
    P = near[np.clip(((yy + wy3) // TS).astype(int), 0, ctx.H - 1), np.clip(((xx + wx3) // TS).astype(int), 0, ctx.W - 1)]
    wx2 = (vnoise(H, W, 22, seed + 21) - .5) * 30
    wy2 = (vnoise(H, W, 22, seed + 22) - .5) * 30
    P2 = near[np.clip(((yy + wy2) // TS).astype(int), 0, ctx.H - 1), np.clip(((xx + wx2) // TS).astype(int), 0, ctx.W - 1)]
    mix = (P2 != P) & (bayer(H, W) < .5)                 # 성운 종류 경계는 2~3칸 폭으로 섞인다(QA: 칸 계단)
    P = np.where(mix, P2, P)
    img = np.empty((H, W, 3), np.uint8)
    img[:] = SPACE['void']
    img[vnoise(H, W, 50, seed + 2) + (bayer(H, W) - .5) * .08 > .68] = SPACE['void2']
    m = lvl > 0
    img[m] = NEB_RGB[P[m], lvl[m] - 1]
    cool = (lvl == 1) & (din < .2)                       # 바깥 가스 실·끝자락은 공허 쪽 푸른빛으로 — 사막 성운 실이 갈색 뿌리처럼 보였다(QA)
    if ctx.systems:                                      # 은하: 띠로 두르면 해안선처럼 읽혔다 — 반만 디더
        cool &= bayer(H, W) < .5
    img[cool] = (img[cool].astype(np.float32) * .5 + hx('16204a').astype(np.float32) * .5).astype(np.uint8)

    # 별 — 성운 단이 높을수록 많다
    rng = np.random.default_rng(seed + 7)
    n = int(W * H / 80)
    sx, sy = rng.integers(1, W - 1, n), rng.integers(1, H - 1, n)
    sc, big, keepr = rng.integers(0, 4, n), rng.random(n), rng.random(n)
    keep_by = np.array([.22, .45, .65, .85, 1.0])
    for x, y, c, b, kr in zip(sx, sy, sc, big, keepr):
        if kr > keep_by[lvl[y, x]]:
            continue
        col = SPACE['star'][c]
        if b > .99:
            _cross(img, x, y, col)
        elif b > .82:
            img[y, x] = col
        else:
            img[y, x] = (col.astype(np.int16) * 55 // 100).astype(np.uint8)

    # 소행성대 먼지 띠(산·절벽 칸, 휜 좌표) → 이온 폭풍 → 성단 → 거성 → 소행성
    rockcell = np.isin(ctx.O, (6, 7, 9)) | ctx.face
    bwx = np.clip(((xx + wx + (vnoise(H, W, 13, seed + 41) - .5) * 20) // TS).astype(int), 0, ctx.W - 1)
    bwy = np.clip(((yy + wy + (vnoise(H, W, 13, seed + 42) - .5) * 20) // TS).astype(int), 0, ctx.H - 1)
    belt = rockcell[bwy, bwx]
    belt_d = _boxblur(_boxblur(belt.astype(np.float32), 6), 6) * (.55 + .9 * vnoise(H, W, 11, seed + 14))
    D = bayer(H, W)
    dz = (belt_d > .3) & (D < np.clip(belt_d - .2, 0, .75))
    img[dz] = np.where((vnoise(H, W, 7, seed + 13)[dz] > .55)[:, None], SPACE['dust_l'], SPACE['dust'])
    draw_ion_storm(img, ctx, cy, cx)
    for y, x in zip(*np.nonzero(np.isin(ctx.O, (1, 2, 3, 5)))):
        draw_cluster(img, int(x), int(y))
    vol = ctx.O == 8                                     # 화산은 2칸 안쪽끼리 한 무리 → 무리마다 거성 하나
    grp = _dilate(_dilate(vol))
    for comp in _components(grp):
        cells = [c for c in comp if vol[c[1], c[0]]]
        free = [c for c in cells if not ctx.occupied[max(0, c[1] - 1):c[1] + 2, max(0, c[0] - 1):c[0] + 2].any()]
        if free:
            draw_red_giant(img, cells, free)
    for y, x in zip(*np.nonzero(rockcell)):
        draw_asteroids(img, int(x), int(y))
    if ctx.systems:
        draw_galaxy(img, ctx, seed)
    # 아이콘 받침: 발자국 안 성운을 공허 쪽으로 눌러 아이콘 윤곽이 묻히지 않게
    # 받침은 발자국 네모가 아니라 가운데 둥근 어둠(타원, 가장자리로 갈수록 옅게 2단 디더) — 네모 받침이 1배에서 구멍처럼 보였다(QA 3차)
    a = np.zeros((H, W), np.float32)
    sites = [(p['x'], p['y'], p['w'], p['h']) for p in ctx.places] + [ctx.sky]
    for (px, py, pw, ph) in sites:
        cxp, cyp = (px + pw / 2) * TS, (py + ph / 2) * TS
        rx, ry = pw * TS * .62, ph * TS * .62
        y0, y1 = max(0, int(cyp - ry)), min(H, int(cyp + ry) + 1)
        x0, x1 = max(0, int(cxp - rx)), min(W, int(cxp + rx) + 1)
        gy, gx = np.mgrid[y0:y1, x0:x1]
        r = np.hypot((gx - cxp) / rx, (gy - cyp) / ry)
        a[y0:y1, x0:x1] = np.maximum(a[y0:y1, x0:x1], np.clip((1 - r) * 1.6, 0, 1))
    Dd = bayer(H, W)
    for thr, mul in ((.15, .72), (.55, .5)):
        mm = (a > thr) & (Dd < np.clip((a - thr) / .3, 0, 1))
        img[mm] = (img[mm].astype(np.float32) * mul + SPACE['void'].astype(np.float32) * (1 - mul)).astype(np.uint8)
    draw_hyperlanes(img, ctx)
    return img


SUN = {   # 성운 종류 → 성계 별 색(핵 · 빛 · 테)
    'sand': ('fff6c8', 'ffd060', 'b06a10'), 'ash': ('ffe0c0', 'ff7a40', '8a2010'), 'badlands': ('ffe0f0', 'ff8ac0', '8a2a60'),
    'snow': ('ffffff', 'a8d0ff', '3a5a9a'), 'tundra': ('f0f6ff', '9ab8f0', '34508a'), 'swamp': ('f0fff6', '8ef0c0', '1e6a50'),
    'savanna': ('fff0ff', 'd8a0ff', '5a2a8a'), 'dirt': ('f4f0ff', 'b8a8f0', '4a3a7a'), 'farm': ('f0f4ff', 'a8b4ff', '343c8a'),
    'grass': ('f6ffff', '9ae8ff', '1e5a7a'),
}


def draw_galaxy(img, ctx, seed=11):
    """생성 우주의 성계 층: 은하 핵 빛무리 · 나선팔 먼지 띠(공허 속 염주 사이) · 성계 별과 궤도. 장소 발자국 둘레는 비운다."""
    H, W = img.shape[:2]
    occ = np.zeros((ctx.H, ctx.W), bool)
    for p in ctx.places:
        occ[max(p['y'] - 1, 0):p['y'] + p['h'] + 1, max(p['x'] - 1, 0):p['x'] + p['w'] + 1] = True
    sx_, sy_, sw_, sh_ = ctx.sky
    occ[max(sy_ - 1, 0):sy_ + sh_ + 1, max(sx_ - 1, 0):sx_ + sw_ + 1] = True
    occ |= ctx.road | ctx.dune
    occ_px = np.kron(occ.astype(np.uint8), np.ones((TS, TS), np.uint8)).astype(bool)
    foot = np.zeros((ctx.H, ctx.W), bool)                     # 빛무리·팔은 발자국만 비운다(길·여백까지 비우면 네모 구멍이 났다)
    for p in ctx.places:
        foot[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']] = True
    foot[sy_:sy_ + sh_, sx_:sx_ + sw_] = True
    foot_px = np.kron(foot.astype(np.uint8), np.ones((TS, TS), np.uint8)).astype(bool)
    D = bayer(H, W)
    yy, xx = np.mgrid[0:H, 0:W]
    void = ~np.kron((ctx.G != 0).astype(np.uint8), np.ones((TS, TS), np.uint8)).astype(bool)
    # 나선팔 먼지 띠: 같은 성단의 이웃 성계, 다른 성단이어도 같은 팔에서 이어지던 성계 사이(공허 쪽에만, 옅게)
    arm = np.zeros((H, W), np.float32)
    byc = {}
    for x, y, r, c in ctx.systems:
        byc.setdefault(int(c), []).append((x, y))
    chain = [pt for c in sorted(byc) if c > 0 for pt in byc[c]]
    for (x0, y0), (x1, y1) in zip(chain, chain[1:]):
        if np.hypot(x1 - x0, y1 - y0) > 16:
            continue
        n = int(np.hypot(x1 - x0, y1 - y0) * 4) + 2
        for t in np.linspace(0, 1, n):
            X, Y = int((x0 + (x1 - x0) * t) * TS + 8), int((y0 + (y1 - y0) * t) * TS + 8)
            arm[max(Y - 10, 0):Y + 11, max(X - 10, 0):X + 11] += 1
    arm = _boxblur(np.minimum(arm, 6) / 6, 6) * (.5 + .8 * vnoise(H, W, 20, seed + 70))
    dust = void & (D < arm * .55) & (arm > .12)
    img[dust] = (img[dust].astype(np.float32) * .55 + hx('2a3a6a').astype(np.float32) * .45).astype(np.uint8)
    rng = np.random.default_rng(seed + 71)
    for _ in range(int(W * H / 140)):                    # 팔 위 별이 더 많다 — 나선이 별빛으로 읽히게
        X, Y = int(rng.integers(0, W)), int(rng.integers(0, H))
        if void[Y, X] and rng.random() < arm[Y, X] * 1.4:
            img[Y, X] = SPACE['star'][int(rng.integers(0, 3))]
    # 나선팔: 핵에서 로그 나선을 따라 별빛 띠(공허·성운 위 모두 옅게) — 성계 염주만으로는 팔이 안 보였다(적대 QA)
    if ctx.core and ctx.spiral:
        sp = ctx.spiral
        cx0, cy0 = ctx.core
        band = np.zeros((H, W), np.float32)
        for k in range(int(sp['n'])):
            th = .4
            while True:
                r = 3.2 * np.exp(sp['b'] * th * 2.0)
                if r > W * .62:
                    break
                a = sp['th0'] + 2 * np.pi * k / sp['n'] + th
                X = int((cx0 + np.cos(a) * r * 1.1) * TS + 8)
                Y = int((cy0 + np.sin(a) * r * sp['squash']) * TS + 8)
                wdt = int(10 + r * .9)
                if -wdt <= X < W + wdt and -wdt <= Y < H + wdt:
                    band[max(Y - wdt, 0):max(Y + wdt + 1, 0), max(X - wdt, 0):max(X + wdt + 1, 0)] += 1.0 / (1 + r * .04)
                th += .025
        band = _boxblur(_boxblur(np.minimum(band, 8) / 8, 9), 9) * (.55 + .7 * vnoise(H, W, 26, seed + 80))
        lane = (D < band * .8) & (band > .08) & ~foot_px
        a_ = np.where(void, .5, .22)[lane][:, None]                  # 공허 위는 또렷하게, 성운 위는 살짝
        img[lane] = (img[lane].astype(np.float32) * (1 - a_) + hx('5a6ab0').astype(np.float32) * a_).astype(np.uint8)
        hi = (D < (band - .45) * .9) & (band > .45) & void & ~foot_px  # 팔 가운데 밝은 줄기
        img[hi] = (img[hi].astype(np.float32) * .45 + hx('9aa8e0').astype(np.float32) * .55).astype(np.uint8)
        rng2 = np.random.default_rng(seed + 81)
        for _ in range(int(W * H / 30)):
            X, Y = int(rng2.integers(0, W)), int(rng2.integers(0, H))
            if not foot_px[Y, X] and rng2.random() < band[Y, X] * 1.2:
                img[Y, X] = SPACE['star'][int(rng2.integers(0, 4))]
    # 은하 핵: 넓은 팽대부(옅게, 성운 위도) + 둥근 빛무리 4단 디더 + 가운데 흰 점
    if ctx.core:
        cx, cy = ctx.core[0] * TS + 8, ctx.core[1] * TS + 8
        rr = np.hypot((xx - cx) / 1.25, (yy - cy) / .78)
        bulge = np.clip(1 - rr / (11 * TS), 0, 1) ** 1.6
        bm = (D < bulge * .55) & ~foot_px
        img[bm] = (img[bm].astype(np.float32) * .6 + hx('8a6a7a').astype(np.float32) * .4).astype(np.uint8)
        R = 5.2 * TS
        t = np.clip(1 - rr / R, 0, 1)
        swirl = .5 + .5 * np.sin(np.arctan2(yy - cy, xx - cx) * 2 + rr / 9.0)
        lvl = t * (.75 + .5 * swirl)
        cols = [hx('3a2a5a'), hx('8a5a8a'), hx('f0b070'), hx('fff0c8'), hx('ffffff')]
        for k, th in enumerate((.12, .3, .52, .74, .92)):
            m = (lvl > th) & (D < np.clip((lvl - th) / .14, 0, 1)) & ~foot_px
            img[m] = cols[k]
    # 성계 별 + 궤도
    for i, (x, y, r, c) in enumerate(ctx.systems):
        gx, gy = int(round(x)), int(round(y))
        if not (0 <= gx < ctx.W and 0 <= gy < ctx.H) or ctx.G[gy, gx] == 0:
            continue
        name = G_NEB.get(int(ctx.G[gy, gx]), 'grass')
        core_c, glow_c, rim_c = (hx(v) for v in SUN.get(name, SUN['grass']))
        cx, cy = int(x * TS + 8), int(y * TS + 8)
        # 궤도 두 개(점선 타원) — 장소·길·사구 둘레는 건너뛴다
        for k, f in enumerate((.42, .7)):
            rx, ry = r * f * TS, r * f * TS * .62
            n = int(2 * np.pi * max(rx, ry) / 2)
            ph = (i * 37 + k * 11) % 7
            for j in range(n):
                if (j + ph) % 2:
                    continue
                a = 2 * np.pi * j / n
                X, Y = int(cx + np.cos(a) * rx), int(cy + np.sin(a) * ry)
                if 0 <= X < W and 0 <= Y < H and not occ_px[Y, X]:
                    img[Y, X] = (img[Y, X].astype(np.float32) * .2 + glow_c.astype(np.float32) * .8).astype(np.uint8)
            a = 2 * np.pi * ((i * 0.37 + k * .5) % 1.0)          # 궤도 위 행성 하나
            X, Y = int(cx + np.cos(a) * rx), int(cy + np.sin(a) * ry)
            if 2 <= X < W - 2 and 2 <= Y < H - 2 and not occ_px[Y - 2:Y + 3, X - 2:X + 3].any():
                img[Y - 1:Y + 2, X - 1:X + 2] = rim_c
                img[Y - 1, X - 1] = glow_c
        if occ[gy, gx]:
            continue
        rad = 4 if r < 4 else 6
        for dy in range(-rad - 7, rad + 8):
            for dx in range(-rad - 7, rad + 8):
                X, Y = cx + dx, cy + dy
                if not (0 <= X < W and 0 <= Y < H) or occ_px[Y, X]:
                    continue
                d = np.hypot(dx, dy)
                if d <= rad - 1.5:
                    img[Y, X] = core_c
                elif d <= rad:
                    img[Y, X] = glow_c if (-dx - dy) > -rad * .3 else rim_c
                elif d <= rad + 7 and BAYER4[Y % 4, X % 4] < (1 - (d - rad) / 7) * .8:
                    img[Y, X] = (img[Y, X].astype(np.float32) * .5 + glow_c.astype(np.float32) * .5).astype(np.uint8)
        _cross(img, cx, cy, core_c, rad + 3)


def _cross(img, x, y, col, arm=1):
    dim = (col.astype(np.int16) * 6 // 10).astype(np.uint8)
    img[y, x] = col
    for k in range(1, arm + 1):
        for X, Y in ((x - k, y), (x + k, y), (x, y - k), (x, y + k)):
            if 0 <= X < img.shape[1] and 0 <= Y < img.shape[0]:
                img[Y, X] = dim if k == arm else col


def draw_cluster(img, x, y):
    """숲 칸 → 성단: 칸마다 빛무리(가운데로 갈수록 밝게, 디더) + 밝은 별 4~6개, 셋 중 하나는 십자 별."""
    h = h32('cl', x, y)
    ccx, ccy = x * TS + 4 + h % 8, y * TS + 4 + (h >> 4) % 8
    glow = hx('cfe0ff').astype(np.float32)
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            r = np.hypot(dx, dy) / 6
            X, Y = ccx + dx, ccy + dy
            if r < 1 and 0 <= X < img.shape[1] and 0 <= Y < img.shape[0] and BAYER4[Y % 4, X % 4] < (1 - r) * .9:
                img[Y, X] = (img[Y, X] * (1 - .28 * (1 - r)) + glow * .28 * (1 - r)).astype(np.uint8)
    for i in range(4 + h % 3):
        g = h32('cls', x, y, i)
        img[y * TS + 2 + g % 12, x * TS + 2 + (g >> 8) % 12] = SPACE['star'][(g >> 16) % 3]
    if h % 3 == 0:
        _cross(img, ccx, ccy, SPACE['star'][0], 2)


AST_LAYOUTS = [
    [(4, 5, 4), (11, 10, 3), (12, 3, 1)],
    [(5, 10, 4), (11, 5, 3), (3, 3, 1)],
    [(8, 8, 5), (2, 13, 1)],
    [(4, 4, 2), (10, 6, 2), (6, 11, 3), (13, 12, 1)],
    [(3, 9, 3), (9, 4, 2), (12, 11, 2)],
    [(7, 5, 3), (3, 12, 2), (12, 12, 2), (13, 2, 1)],
]


def draw_asteroids(img, x, y):
    """한 칸에 소행성 1~4개(6가지 배치) — 빛은 왼쪽 위, 오른쪽 아래 어두움 + 검은 테 1px."""
    rocks = AST_LAYOUTS[h32('ast', x, y) % len(AST_LAYOUTS)]
    for i, (cx, cy, r) in enumerate(rocks):
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
                    if r >= 3 and (xx * 7 + yy * 13 + x + y) % 11 == 0 and light < r * .6:
                        c = SPACE['rock_d']
                    img[Y, X] = c
                elif d <= 1.6 and not any((img[Y, X] == SPACE[k]).all() for k in ('rock', 'rock_l', 'rock_d')):
                    img[Y, X] = SPACE['rock_k']


def draw_red_giant(img, comp, free):
    """화산 무리 하나 → 붉은 거성 하나(무리 가운데에 가장 가까운, 장소에서 떨어진 칸). 크기 3단, 바깥 빛무리 디더 링."""
    mx, my = np.mean([c[0] for c in comp]), np.mean([c[1] for c in comp])
    fx, fy = min(free, key=lambda c: (c[0] - mx) ** 2 + (c[1] - my) ** 2)
    cx, cy = fx * TS + 8, fy * TS + 8
    r = 5 if len(comp) <= 3 else 7 if len(comp) <= 10 else 9
    halo = r + 6
    for yy in range(-halo, halo + 1):
        for xx in range(-halo, halo + 1):
            dd = np.hypot(xx, yy)
            X, Y = cx + xx, cy + yy
            if not (0 <= X < img.shape[1] and 0 <= Y < img.shape[0]):
                continue
            if dd <= r:
                light = (-xx - yy) / r
                img[Y, X] = hx('fff0b0') if light > 1.0 else hx('ffd27a') if light > .55 else hx('ff8a3a') if light > -.3 else hx('c2361e')
            elif dd <= r + 1:
                img[Y, X] = hx('7a1c14')
            elif dd <= halo:
                t = 1 - (dd - r - 1) / (halo - r - 1)
                if BAYER4[Y % 4, X % 4] < t * .8:
                    img[Y, X] = (img[Y, X] * .55 + hx('a8301e') * .45).astype(np.uint8)


def draw_ion_storm(img, ctx, cy, cx):
    """사구 바다(사막선이 있어야 건너던 장벽) → 보라 이온 폭풍. 휜 좌표로 읽어 경계가 칸 모양을 벗고,
    물결 줄무늬 3단 + 2~3px 굵기 지그재그 번개. 발자국 밑에도 깐다(아이콘이 위를 덮는다)."""
    if not ctx.dune.any():
        return
    H, W = img.shape[:2]
    m = ctx.dune[cy, cx]
    yy, xx = np.mgrid[0:H, 0:W]
    w = (np.sin(xx * .22 + np.sin(yy * .09 + xx * .03) * 2.0 + yy * .07) * .6
         + np.sin(xx * .07 - yy * .19 + vnoise(H, W, 30, 33) * 6) * .5 + (vnoise(H, W, 16, 31) - .5) * 1.4)
    cloud = vnoise(H, W, 26, 35) > .78                   # 밝은 폭풍 구름 덩이
    img[m & cloud & (bayer(H, W) < .5)] = hx('3a1e66')
    a, b, c = hx('2a1450').astype(np.float32), hx('4a2680'), hx('9a62e8')
    img[m] = (img[m] * .45 + a * .55).astype(np.uint8)          # 아래 성운이 비치는 보라 막
    I = vnoise(H, W, 72, 37)                              # 폭풍 세기: 잔잔한 눈과 거센 띠가 섞여 고른 무늬가 되지 않게(QA 3차 「물방울 카펫」)
    s = m & (w > 1.15 - .8 * I)
    img[s] = b
    img[s & (w > 1.35 - .7 * I) & (bayer(H, W) < .35)] = c
    for y, x in zip(*np.nonzero(ctx.dune)):
        h = h32('zap', int(x), int(y))
        if I[min(H - 1, y * TS + 8), min(W - 1, x * TS + 8)] < .58 or h % 5:
            continue
        X, Y = x * TS + 2 + h % 12, y * TS + (h >> 5) % 6     # 갈래 번개: 길이·꺾임 간격·가지 수·방향이 칸마다 다르다
        L = 9 + (h >> 9) % 14
        step = 2 + (h >> 13) % 3
        lean = 1 if (h >> 15) & 1 else -1
        forks = [(h >> 17) % L, (h >> 21) % L][:1 + (h >> 25) % 2]
        pts = []
        for k in range(L):
            if k % step == 0:
                X += lean if (h >> (k % 20)) & 1 else -lean
            pts.append((X, Y + k))
            if k in forks and k > 2:
                fx, sgn = X, (1 if (h >> (k + 3)) & 1 else -1)
                for j in range(1, 3 + (h >> (k + 5)) % 4):
                    pts.append((fx + sgn * j, Y + k + j))
        for X2, Y2 in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= Y2 + dy < H and 0 <= X2 + dx < W and (X2 + dx, Y2 + dy) not in pts:
                    img[Y2 + dy, X2 + dx] = np.maximum(img[Y2 + dy, X2 + dx], hx('7a4ad0'))
        for X2, Y2 in pts:
            if 0 <= Y2 < H and 0 <= X2 < W:
                img[Y2, X2] = hx('f4e8ff')


def lane_graph(ctx):
    """항로 칸과 이어지는 방향. 길 칸 + 경사로 칸(장소 밖) + 다리 칸이 한 그물. 장소 쪽은 끝 칸에서만 한 팔."""
    S = {(x, y) for x, y in ctx.path_cells()} | set(ctx.bridge)
    if getattr(ctx, '_lanes', None) is not None:
        return ctx._lanes
    base = set(S)
    R = {(int(x), int(y)) for y, x in zip(*np.nonzero(ctx.ramp & ~ctx.occupied))}
    S |= R

    def free(c):
        return 0 <= c[0] < ctx.W and 0 <= c[1] < ctx.H and not ctx.occupied[c[1], c[0]] and c not in S

    def deg(c):
        return sum((c[0] + dx, c[1] + dy) in S for dx, dy in DIRS.values())

    def nb(c):
        return [(c[0] + dx, c[1] + dy) for dx, dy in DIRS.values() if (c[0] + dx, c[1] + dy) in S]

    def blocks():
        return [[(x + ax + i, y + ay + j) for i in (0, 1) for j in (0, 1)] for (x, y) in S for ax in (-1, 0) for ay in (-1, 0)
                if all((x + ax + i, y + ay + j) in S for i in (0, 1) for j in (0, 1))]
    while True:                                      # 경사로 2x2 덩이: 덩이 밖 이웃이 가장 적은 경사로부터 걷는다(줄 위의 칸은 남는다)
        bl = blocks()
        if not bl:
            break
        blk = bl[0]
        cand = [c for c in blk if c in R and c not in base]
        if not cand:
            break
        S.discard(min(cand, key=lambda c: (sum(q not in blk for q in nb(c)), -c[0], -c[1])))
    changed = True
    while changed:                                   # 장소로 안 가는 막다른 경사로를 걷는다
        changed = False
        for c in sorted((R - base) & S):
            x, y = c
            occ_nb = any(0 <= x + dx < ctx.W and 0 <= y + dy < ctx.H and ctx.occupied[y + dy, x + dx] for dx, dy in DIRS.values())
            if (len(nb(c)) <= 1 and not occ_nb) or not nb(c):
                S.discard(c)
                changed = True
    gaps = set()
    # 한 칸 틈 메우기: 지형이 길을 한 칸 끊어 놓은 곳(실측 (17,25) 곧은 틈, (71,42)-(70,43) 대각 틈) — 양쪽이 막다른 끝일 때만
    for c in sorted(S):
        x, y = c
        if deg(c) > 1:
            continue
        for dx, dy in ((0, 2), (2, 0)):
            o, mid = (x + dx, y + dy), (x + dx // 2, y + dy // 2)
            if o in S and deg(o) <= 1 and free(mid):
                S.add(mid)
                gaps.add(mid)
                ctx.road[mid[1], mid[0]] = True
        for dx, dy in ((1, 1), (-1, 1)):
            o = (x + dx, y + dy)
            if o in S and deg(o) <= 1 and deg(c) <= 1:
                mids = [m for m in ((x + dx, y), (x, y + dy)) if free(m)]
                if len(mids) == 2:
                    m = max(mids, key=lambda q: (ctx.road_px is not None and ctx.road_px[q[1] * TS:(q[1] + 1) * TS, q[0] * TS:(q[0] + 1) * TS].any(), ctx.G[q[1], q[0]] != 0))
                    S.add(m)
                    gaps.add(m)
                    ctx.road[m[1], m[0]] = True

    out = {}
    for (x, y) in S:
        ls, side = [], []
        for d, (dx, dy) in DIRS.items():
            X, Y = x + dx, y + dy
            if (X, Y) in S:
                ls.append(d)
            elif 0 <= X < ctx.W and 0 <= Y < ctx.H and ctx.occupied[Y, X]:
                side.append((not ctx._entered(X, Y, d), d))
        if len(ls) <= 1 and side:                          # 끝 칸은 장소로 꼭 들어간다(옛 길 흔적이 있는 쪽 먼저)
            ls.append(min(side)[1])
        if ls:
            out[(x, y)] = ls
    ctx._lanes = out
    ctx._gaps = gaps
    return out


def mend_roads(img, ctx, road_role_px):
    """길을 다시 그리지 않는 테마(흙길 그대로)에서 공용 지형의 한 칸 틈을 메운다: 틈 칸과 그 이웃 길 칸을
    지도 안에서 같은 바닥·같은 연결 모양을 가진 다른 흙길 칸 그림으로 바꾼다(QA 3차: (17,25)·(15,29) 가 모든 판타지 계열에서 끊김)."""
    ctx.road_px = road_role_px
    g = lane_graph(ctx)

    def painted(x, y):                               # 옛 흙길이 실제로 칸의 어느 가장자리까지 그려져 있나
        s = road_role_px[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        e = {'N': s[0:3, B0:B1], 'S': s[TS - 3:TS, B0:B1], 'W': s[B0:B1, 0:3], 'E': s[B0:B1, TS - 3:TS]}
        return {d for d, m in e.items() if m.sum() >= 3}
    gaps = set(ctx._gaps)

    def flat(x, y):                                  # 높이가 같은 칸 사이의 경사로 = 계단 그림이 없는 평지 칸
        return all(not (0 <= x + dx < ctx.W and 0 <= y + dy < ctx.H) or ctx.Hh[y + dy, x + dx] == ctx.Hh[y, x] for dx, dy in DIRS.values())

    def mismatch(x, y):
        occ = {d for d in DIRS if 0 <= y + DIRS[d][1] < ctx.H and 0 <= x + DIRS[d][0] < ctx.W and ctx.occupied[y + DIRS[d][1], x + DIRS[d][0]]}
        return set(g[(x, y)]) - occ != painted(x, y) - occ

    def ok(c):
        x, y = c
        return c in g and c not in ctx.bridge and not ctx.face[y, x] and (not ctx.ramp[y, x] or flat(x, y))
    core = {c for c in g if ok(c) and (c in gaps or (ctx.ramp[c[1], c[0]] and mismatch(*c)))}
    todo = set(core)
    for (x, y) in core:                              # 틈에 맞닿은 끝 칸(막다른 모양으로 그려져 있다)도 새 모양으로
        for dx, dy in DIRS.values():
            c = (x + dx, y + dy)
            if ok(c) and mismatch(*c):
                todo.add(c)
    ctx._gaps = todo
    if not todo:
        return img
    out = img.copy()
    shape = {c: tuple(sorted(ls)) for c, ls in g.items()}
    for (x, y) in sorted(todo):
        want = shape.get((x, y))
        best = None
        for (X, Y), s in shape.items():
            if s != want or (X, Y) in todo or (X, Y) in ctx.bridge or ctx.ramp[Y, X] or ctx.face[Y, X] or ctx.occupied[Y, X]:
                continue
            if ctx.G[Y, X] != ctx.G[y, x] or ctx.O[Y, X] != 0:
                continue
            d = (X - x) ** 2 + (Y - y) ** 2 + 400 * sum(
                (0 <= x + a < ctx.W and 0 <= y + b < ctx.H and ctx.G[y + b, x + a] != ctx.G[y, x]) !=
                (0 <= X + a < ctx.W and 0 <= Y + b < ctx.H and ctx.G[Y + b, X + a] != ctx.G[Y, X])
                for a in (-1, 0, 1) for b in (-1, 0, 1))
            if best is None or d < best[0]:
                best = (d, X, Y)
        if best:
            _, X, Y = best
            out[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS] = img[Y * TS:(Y + 1) * TS, X * TS:(X + 1) * TS]
    return out


def draw_hyperlanes(img, ctx):
    """초공간 항로: 칸 가운데를 잇는 1px 청록 선(꺾임은 둥글게) + 2px 빛무리 + 전역 8px 마다 흰 표지.
    다리 줄 = 워프 구간: 밑에 검은 균열, 선은 점선, 줄 양끝에만 금색 고리."""
    H, W = img.shape[:2]
    core = np.zeros((H, W), bool)
    g = lane_graph(ctx)
    OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}

    def seg(x0, y0, x1, y1):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for t in range(n + 1):
            X, Y = round(x0 + (x1 - x0) * t / max(n, 1)), round(y0 + (y1 - y0) * t / max(n, 1))
            if 0 <= X < W and 0 <= Y < H:
                core[Y, X] = True
    # 항로를 사슬(갈림·끝 사이)로 모아 차이킨 곡선으로 — 칸마다 직각으로 꺾여 회로 기판처럼 보였다(적대 QA 2026-10-03)
    beacons = []
    nodes = {c for c in g if c not in ctx.bridge}
    nbr = lambda c: [(c[0] + DIRS[d][0], c[1] + DIRS[d][1]) for d in g[c]]
    deg = {c: len(g[c]) for c in nodes}
    seen = set()
    chains = []
    for c in sorted(nodes):
        if deg[c] == 2:
            continue
        if deg[c] == 1:
            beacons.append((c[0] * TS + 7, c[1] * TS + 7))
        for n in nbr(c):
            e = frozenset((c, n))
            if e in seen:
                continue
            seen.add(e)
            path, prev, cur = [c], c, n
            while cur in nodes and deg[cur] == 2 and cur not in path:
                path.append(cur)
                nxt = [m for m in nbr(cur) if m != prev]
                if not nxt:
                    break
                seen.add(frozenset((cur, nxt[0])))
                prev, cur = cur, nxt[0]
            path.append(cur)
            chains.append(path)
    def walk(c, first):                                    # c 에서 first 쪽으로, 노드 밖(장소·워프)이나 갈림에 닿을 때까지
        out, prev, cur = [], c, first
        while True:
            out.append(cur)
            seen.add(frozenset((prev, cur)))
            if cur not in nodes or deg[cur] != 2 or cur == c:
                return out
            nxt = [m for m in nbr(cur) if m != prev]
            if not nxt:
                return out
            prev, cur = cur, nxt[0]
    for c in sorted(nodes):                                # 갈림·끝 없이 장소에서 장소로 가는 항로(양쪽이 모두 발자국)
        if deg[c] != 2 or any(frozenset((c, n)) in seen for n in nbr(c)):
            continue
        n0, n1 = nbr(c)
        fw = walk(c, n0)
        bw = walk(c, n1)
        chains.append(list(reversed(bw)) + [c] + fw)
    def pt(c, other):
        x, y = c[0] * TS + 7.0, c[1] * TS + 7.0
        if 0 <= c[0] < ctx.W and 0 <= c[1] < ctx.H and ctx.occupied[c[1], c[0]] and other is not None:
            x += (c[0] - other[0]) * 7.0                    # 장소로 들어가는 팔은 발자국 안쪽까지(아이콘이 덮는다)
            y += (c[1] - other[1]) * 7.0
        return (x, y)
    for path in chains:
        P = [pt(path[0], path[1] if len(path) > 1 else None)] + [pt(c, None) for c in path[1:-1]] + [pt(path[-1], path[-2] if len(path) > 1 else None)]
        if len(P) > 4:                                     # 칸 점을 3칸마다 하나로 줄여 계단을 사선·곡선으로(칸 길에서 1칸 안쪽)
            P = [P[0]] + P[1:-1][1::3] + [P[-1]]
        for _ in range(4):
            if len(P) < 3:
                break
            Q = [P[0]]
            for (x0, y0), (x1, y1) in zip(P, P[1:]):
                Q += [(x0 * .75 + x1 * .25, y0 * .75 + y1 * .25), (x0 * .25 + x1 * .75, y0 * .25 + y1 * .75)]
            Q.append(P[-1])
            P = Q
        for (x0, y0), (x1, y1) in zip(P, P[1:]):
            seg(int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1)))
    # 워프 구간
    rings = []
    for comp in _components(np.array([[(x, y) in ctx.bridge for x in range(ctx.W)] for y in range(ctx.H)])):
        d = ctx.bridge[comp[0]]
        for (x, y) in comp:                                # 균열: 칸 가로질러 검은 띠 + 보라 가장자리
            for k in range(TS):
                for t in range(-4, 5):
                    X, Y = (x * TS + k, y * TS + 7 + t) if d == 'h' else (x * TS + 7 + t, y * TS + k)
                    if 0 <= X < W and 0 <= Y < H:
                        j = (h32('rf', X, Y) % 3) - 1
                        if abs(t) <= 2 + j:
                            img[Y, X] = SPACE['rift']
                        elif abs(t) <= 3 + j:
                            img[Y, X] = SPACE['rift_e']
            for k in range(TS):
                if k % 4 < 2:
                    X, Y = (x * TS + k, y * TS + 7) if d == 'h' else (x * TS + 7, y * TS + k)
                    core[Y, X] = True
        xs, ys = [c[0] for c in comp], [c[1] for c in comp]
        if d == 'h':
            rings += [(min(xs) * TS - 1, ys[0] * TS + 7), ((max(xs) + 1) * TS, ys[0] * TS + 7)]
        else:
            rings += [(xs[0] * TS + 7, min(ys) * TS - 1), (xs[0] * TS + 7, (max(ys) + 1) * TS)]
    g1 = _dilate(core) & ~core
    g2 = _dilate(_dilate(core)) & ~core & ~g1
    G = SPACE['lane_g'].astype(np.float32)
    img[g1] = np.maximum(img[g1], (img[g1] * .3 + G * .7).astype(np.uint8))
    img[g2] = np.maximum(img[g2], (img[g2] * .65 + G * .35).astype(np.uint8))
    img[core] = SPACE['lane']
    img[core & ((xx_global(H, W) + yy_global(H, W)) % 8 == 0)] = SPACE['lane_n']
    for (bx, by) in beacons:                               # 막다른 끝 → 항로 표지(7px 마름모 고리 + 흰 핵)
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                r = abs(dx) + abs(dy)
                if r == 3:
                    img[by + dy, bx + dx] = SPACE['lane']
                elif r == 2:
                    img[by + dy, bx + dx] = SPACE['rift']
                elif r <= 1:
                    img[by + dy, bx + dx] = SPACE['lane_n'] if r == 0 else SPACE['lane']
    for (rx, ry) in rings:                                 # 금색 고리 r=4, 가운데 검게
        for dy in range(-5, 6):
            for dx in range(-5, 6):
                r = np.hypot(dx, dy)
                X, Y = rx + dx, ry + dy
                if not (0 <= X < W and 0 <= Y < H):
                    continue
                if r <= 2.2:
                    img[Y, X] = SPACE['rift']
                elif r <= 3.6:
                    img[Y, X] = SPACE['gate'] if dx + dy < 0 else SPACE['gate_d']
                elif r <= 4.6:
                    img[Y, X] = SPACE['gate_k']


def xx_global(H, W):
    return np.arange(W)[None, :].repeat(H, 0)


def yy_global(H, W):
    return np.arange(H)[:, None].repeat(W, 1)


# ──────────────────────────────── 적용 ────────────────────────────────
def force_road_band(img, world, C, ukeys, role, pal, road_px):
    """흙길 띠 안쪽 화소를 길 색으로 다시 칠한다. 길 화소 중 바닥(협곡·사막)과 같은 색인 것은 색 표에서 그 바닥 role 로 잡혀
    팔레트가 바닥 색으로 칠했다 — 외계 협곡 위에서 길이 자주색으로 묻히고 한 길 안에서 색이 바뀌었다(QA 3차).
    띠는 칸 x 4~11 이고 테두리가 ±1 흔들리므로 1px 깎은 안쪽만 바꾼다."""
    import kit_palette as KP
    if KP.is_identity(pal) or 'road' not in pal.get('roles', {}):
        return img
    ctx = Ctx(world)
    ctx.road_px = road_px
    g = lane_graph(ctx)
    H, W = img.shape[:2]
    m = np.zeros((H, W), bool)
    for (x, y), ls in g.items():
        if (x, y) in ctx.bridge or ctx.ramp[y, x] or ctx.occupied[y, x]:
            continue
        b = band_mask(ls)
        e = b.copy()
        e[1:] &= b[:-1]
        e[:-1] &= b[1:]
        e[:, 1:] &= b[:, :-1]
        e[:, :-1] &= b[:, 1:]
        sl = np.s_[y * TS:(y + 1) * TS, x * TS:(x + 1) * TS]
        if (x, y) in ctx._gaps:
            continue
        if len(ls) <= 1:                             # 장소로 들어가는 막다른 팔: 옛 길 화소가 바닥 색으로 잡혀 links 가 못 본다(외계 (79,16)·(65,12) 분홍 토막)
            keys = KP.key_of(C[sl])
            core = set(np.unique(keys[e]).tolist())
            for d, (dx, dy) in DIRS.items():
                X, Y = x + dx, y + dy
                if d in ls or not (0 <= X < ctx.W and 0 <= Y < ctx.H and ctx.occupied[Y, X]):
                    continue
                arm = _erode4(band_mask([d])) & ~band_mask([])
                e = e | (arm & np.isin(keys, list(core)))
        m[sl] = e
    if not m.any():
        return img
    rr, _ = KP.recolor_terrain(C, ukeys, np.full_like(role, KP.GID['road']), pal, ctx.G)
    out = img.copy()
    out[m] = rr[m]
    return out


def apply_land(img, world, theme, road_role_px):
    """팔레트를 입힌 지형 그림에 테마 덧칠을 차례로 적용한다. 반환 (그림, 덧칠별 개수 보고)."""
    ctx = Ctx(world)
    rep = {}
    out = img.copy()
    if not any(o.split(':')[0] in ('paved_roads', 'rail', 'erase_roads') for o in theme['overlays']):
        out = mend_roads(out, ctx, road_role_px)
        rep['mend_roads'] = len(ctx._gaps)
    for o in theme['overlays']:
        base, _, arg = o.partition(':')
        if base in ('paved_roads', 'rail', 'erase_roads'):
            out = overlay_roads(out, ctx, {'paved_roads': 'paved', 'rail': 'rail', 'erase_roads': 'erase'}[base], road_role_px)
            rep[o] = len(lane_graph(ctx))
        elif base == 'sprawl':
            out, placed = overlay_sprawl(out, ctx, arg or 'modern')
            rep[o] = len(placed)
        elif base == 'smog':
            out = overlay_smog(out, ctx)
            rep[o] = 1
    return out, rep


OVERLAYS = {'paved_roads', 'rail', 'erase_roads', 'sprawl', 'smog'}

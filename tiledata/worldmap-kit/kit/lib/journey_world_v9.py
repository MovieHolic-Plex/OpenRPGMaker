#!/usr/bin/env python3
"""월드맵 설계 데모 9단계(여정 설계) — v8 세계를 불러와 「장벽이 정말 장벽이 되도록」 고친 세계.

v8 은 건드리지 않는다. 여기서 하는 일은 모두 v8 빌드 결과(M)에 얹는 수정이다.
  1. 중앙 산줄기를 북쪽 해안에서 내해까지 끊김 없이 막고, 고갯길 요새를 유일한 관문(관문 칸)으로 만든다.
  2. 서남 대사막(y>=53)을 걸어서 못 건너는 「사구 바다」로 만든다(해안까지). 폐허·신전·고원은 그 안의 섬이 된다.
  3. 거대한 탑을 관문 동쪽으로 두 칸 옮겨 산벽이 들어갈 자리를 만든다.
  4. 동대륙의 작은 사구는 모래로 되돌린다(사구 = 대사막 하나, 규칙을 하나로).
  5. 장벽을 가로지르는 옛 길 4개를 뺀다(길이 못 지나가는 곳을 지나가면 거짓말이다).
통행 규칙과 막(幕)별 도달 영역은 이 모듈이 정의하고, journey_check_v9.py 가 증명하며, 페이지가 그린다.
"""
import os
import sys
import json
from collections import deque
from pathlib import Path

os.environ['CITY_TAG'] = 'v8'
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np
import scipy.ndimage as ndi
import make_map_v5 as m5
import make_map_v4 as M4
import terrain_v4 as V
import terrain_extra as TE

W, H = M4.W, M4.H
START = (39, 27)                 # 시작 지점: 강가 마을 한가운데
WINDOW = (20, 15)                # 한 화면(칸): 가로 20 x 세로 15
GATE_SITE = '고갯길 요새'
TOWER_NEW_X = 49                 # 거대한 탑 이동(관문 산벽이 들어갈 자리)
SW_DUNE_FROM_Y = 52              # 대사막(사구 바다) 시작 행(열마다 52~54로 물결)
SW_DUNE_X_MAX = 40
SKY_SITE = ('천공섬', 58, 49, 5, 4)   # make_map_v5.SKY 와 같은 자리
HARBOUR_SITE = '내해 항구'        # 배를 타는 장소(여정 barriers[ship].gate)
LAYOUT = None                    # 생성 지형(kit_fit)의 배치: dict(wall=[(x,y)…], dune=bool 칸 마스크, …). None 이면 손 대륙의 고정 좌표

# 막(幕) 정의: 막 k 에서 쓰는 수단과 그 수단을 얻는 곳
ACTS = [
    dict(id=0, name='1막 · 시작 대륙 서부', means=None, color='#4fa3ff'),
    dict(id=1, name='2막 · 관문 너머 동쪽 띠', means='pass', color='#35c48b'),
    dict(id=2, name='3막 · 동대륙과 섬들', means='ship', color='#f2b84b'),
    dict(id=3, name='4막 · 대사막 속', means='skiff', color='#ff7a3d'),
    dict(id=4, name='5막 · 천공섬', means='air', color='#c77dff'),
]
MEANS = {
    'pass': dict(name='요새 통행증', source='산기슭 동굴', barrier='중앙 산줄기'),
    'ship': dict(name='범선', source='정글 마을', barrier='서·동 대륙 사이 바다'),
    'skiff': dict(name='사막선', source='오아시스 촌락', barrier='서남 대사막(사구 바다)'),
    'air': dict(name='비공정', source='사막 신전', barrier='하늘(천공섬)'),
}

# 산벽: 관문 위(행 23)와 관문 아래(열 45~47, 행 27~34). 북쪽 능선은 v8 것을 그대로 쓴다.
WALL_EXTRA = []
for x in range(42, 49):
    WALL_EXTRA.append((x, 23))
for y in range(27, 35):
    for x in (45, 46, 47):
        WALL_EXTRA.append((x, y))
WALL_EXTRA += [(44, 22), (43, 22), (48, 22)]

# 장벽을 가로질러 그려지던 옛 길: 그리지 않는다
DROP_ROUTES = ('사막 촌락 ─ 사막 폐허', '사막 촌락 ─ 사막 고원 경사로', '사막 폐허 ─ 사막 신전' , '사막 신전 ─ 사막 폐허',
               '거대한 탑 ─ 내해 항구')


def build_world():
    # 거대한 탑 이동(빌드 전에 입력 상수를 고친다)
    for i, s in enumerate(m5.LANDMARK_SITES):
        if s[0] == '거대한 탑':
            m5.LANDMARK_SITES[i] = (s[0], s[1], TOWER_NEW_X, s[3], s[4], s[5])
    M, ic, meta = m5.build_v5()
    M4.ROUTES[:] = [r for r in M4.ROUTES if r[0] not in DROP_ROUTES]
    G, O = M.G, M.O
    if LAYOUT is not None:
        return _apply_layout(M, ic, meta)
    # 1. 산벽
    for (x, y) in WALL_EXTRA:
        if G[y, x] >= 10:
            O[y, x] = M4.MOUNT
    # 2. 대사막: 사구 바다. 동대륙 사구는 모래로
    ys, xs = np.mgrid[0:H, 0:W]
    nz = M4.vn(4.5, 903)                       # 사구 바다의 북쪽 가장자리를 물결치게(곧은 가로선 금지)
    edge_y = np.full(W, SW_DUNE_FROM_Y + 1, int)          # 열마다 걷는 열의 해시 보행으로 52~55 물결
    e = SW_DUNE_FROM_Y + 1
    for x in range(SW_DUNE_X_MAX):
        r_ = M4.rnd(x, 0, 904)
        e += -1 if r_ < .30 else (1 if r_ > .70 else 0)
        e = int(np.clip(e, SW_DUNE_FROM_Y, SW_DUNE_FROM_Y + 3))
        edge_y[x] = e
    edge_y[16:27] = np.minimum(edge_y[16:27], 53)      # 사막 폐허(21,56) 북쪽에 사구가 4칸 이상 놓이게
    sw = (ys >= edge_y[None, :]) & (xs < SW_DUNE_X_MAX)
    east_dune = (G == M4.DUNE) & (xs >= 60)
    G[east_dune] = M4.SAND
    north_dune = (G == M4.DUNE) & (xs < SW_DUNE_X_MAX) & ~sw
    G[north_dune] = M4.SAND
    sea_of_sand = sw & np.isin(G, (M4.SAND, M4.DUNE)) & (M.Hh == 0) & ~np.isin(O, M4.MOUNTS)
    # 장소 칸(발자국)은 사구에서 제외 — 사구 바다에 뜬 섬
    for n, (x, y, w, h) in ic.items():
        sea_of_sand[y:y + h, x:x + w] = False
    G[sea_of_sand] = M4.DUNE
    # 사구 위에 선 물체(모래 폐허 가장자리 등)는 치운다. 메사(산)는 그대로.
    O[(G == M4.DUNE) & ~np.isin(O, M4.MOUNTS)] = 0
    M.dune_sea = (G == M4.DUNE) & (xs < SW_DUNE_X_MAX)
    return M, ic, meta


def _apply_layout(M, ic, meta):
    """생성 지형: 산벽과 사구 바다를 배치(kit_fit)가 정한 칸에 놓는다. 손 대륙의 고정 좌표(WALL_EXTRA·x<40 사구)는 쓰지 않는다."""
    G, O = M.G, M.O
    for (x, y) in LAYOUT['wall']:
        if G[y, x] >= 10:
            O[y, x] = M4.MOUNT
    region = LAYOUT['dune']
    G[(G == M4.DUNE) & ~region] = M4.SAND                 # 사구 = 사구 바다 하나(규칙을 하나로)
    sea_of_sand = region & (G >= 10) & (M.Hh == 0) & ~np.isin(O, M4.MOUNTS) & (G != M4.CHASM)
    for n, (x, y, w, h) in ic.items():
        sea_of_sand[y:y + h, x:x + w] = False
    G[sea_of_sand] = M4.DUNE
    O[(G == M4.DUNE) & ~np.isin(O, M4.MOUNTS)] = 0
    M.dune_sea = (G == M4.DUNE) & region
    return M, ic, meta


# ───────────── 통행 ─────────────
def cliff_block(M):
    return V.road_block(M)


def base_walk(M, ic):
    """걸어서 갈 수 있는 칸(관문 칸은 막힘, 다리·경사로·장소 발자국은 열림)."""
    G, O = M.G, M.O
    blk = cliff_block(M)
    walk = (G >= 10) & (G != M4.CHASM) & ~np.isin(O, M4.MOUNTS) & ~blk & (G != M4.DUNE)
    for (x, y) in M.face:
        walk[y, x] = False
    walk |= M.RAMP & (G >= 10)
    return walk


def bridges_and_routes(M, ic):
    t = V.old_grid(M)
    block = patched_road_block(M)
    for n, (x, y, w, h) in ic.items():
        block[y:y + h, x:x + w] = False
    road, bridge, foot, paths = TE.plan_roads(t, ic, M4.ROUTES, block=block)
    return road, bridge, foot, paths


def patched_road_block(M):
    b = V.road_block(M)
    b |= np.isin(M.O, M4.MOUNTS)
    b |= (M.G == M4.DUNE)
    return b


def install_road_patch():
    """M4.render 가 부르는 road_block 을 장벽 규칙과 같게 바꾼다."""
    M4.road_block = patched_road_block


def gate_cells(ic):
    x, y, w, h = ic[GATE_SITE]
    return [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)]


def footprint(ic, name):
    x, y, w, h = ic[name]
    return [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)]


def neighbors4(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = x + dx, y + dy
        if 0 <= a < W and 0 <= b < H:
            yield a, b


def flood(starts, passable):
    seen = np.zeros((H, W), bool)
    q = deque()
    for (x, y) in starts:
        if passable[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((x, y))
    while q:
        x, y = q.popleft()
        for a, b in neighbors4(x, y):
            if passable[b, a] and not seen[b, a]:
                seen[b, a] = True
                q.append((a, b))
    return seen


def sky_cells():
    n, x, y, w, h = SKY_SITE
    return [(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)]


class World:
    """통행 규칙과 막별 도달 영역."""

    def __init__(self):
        install_road_patch()
        self.M, self.ic, self.meta = build_world()
        M, ic = self.M, self.ic
        self.walk0 = base_walk(M, ic)
        road, bridge, foot, paths = bridges_and_routes(M, ic)
        self.road, self.bridge, self.foot, self.paths = road, bridge, foot, paths
        for (x, y) in bridge:
            self.walk0[y, x] = True
        # 장소 발자국은 걸을 수 있다. 관문(고갯길 요새)만 열쇠가 필요하다.
        self.sites = {n: v for n, v in ic.items() if not n.endswith('경사로')}
        self.site_kind = {s[0]: s[6] for s in M4.SITES}
        self.site_kind[SKY_SITE[0]] = 'sky'
        self.gate = set(gate_cells(ic))
        for n, (x, y, w, h) in self.sites.items():
            self.walk0[y:y + h, x:x + w] = True
        self.walk_closed = self.walk0.copy()
        for (x, y) in self.gate:
            self.walk_closed[y, x] = False
        self.sea = (M.G == M4.SEA)
        self.dune = (M.G == M4.DUNE)
        self.sky = set(sky_cells())
        self.sea_nosky = self.sea.copy()
        self._compute_stages()

    # 배: 바다 칸으로 이동, 걸을 수 있고 높이 0 인 해안 칸에서 타고 내린다
    def landing_cells(self, sea_reach, walk):
        ok = np.zeros((H, W), bool)
        for y in range(H):
            for x in range(W):
                if walk[y, x] and self.M.Hh[y, x] == 0 and (x, y) not in self.sky:
                    if any(sea_reach[b, a] for a, b in neighbors4(x, y)):
                        ok[y, x] = True
        return ok

    def dock_cells(self):
        """내해 항구에서 배를 탄다: 항구 발자국과 맞닿은 바다 칸."""
        out = []
        for (xx, yy) in footprint(self.ic, HARBOUR_SITE):
            for a, b in neighbors4(xx, yy):
                if self.sea[b, a] and (a, b) not in self.sky:
                    out.append((a, b))
        return out

    def landing_cell_ok(self, x, y):
        return bool(self.walk0[y, x]) and self.M.Hh[y, x] == 0 and (x, y) not in self.sky

    def reach_with(self, means):
        """가진 수단(means: 'pass','ship','skiff','air' 부분집합)으로 닿는 칸. 수단이 서로를 열어 주는 고정점까지 되풀이."""
        means = set(means)
        walk = self.walk0 if 'pass' in means else self.walk_closed
        r = flood([START], walk)
        sea_ok = self.sea.copy()
        for (x, y) in self.sky:
            sea_ok[y, x] = False
        sea_reach = np.zeros((H, W), bool)
        for _ in range(6):
            before = int(r.sum()) + int(sea_reach.sum())
            if 'ship' in means:
                # 배: 항구에 닿으면 승선. 하선은 걸을 수 있고 높이 0 인 해안 어디서든.
                port_cells = footprint(self.ic, HARBOUR_SITE)
                if any(r[y, x] for (x, y) in port_cells):
                    docks = self.dock_cells()
                    sea_reach = flood(docks, sea_ok)
                    land = self.landing_cells(sea_reach, walk)
                    r = flood([(x, y) for y, x in zip(*np.nonzero(r | land))], walk)
            if 'skiff' in means:
                wk = walk | self.dune
                r = flood([(x, y) for y, x in zip(*np.nonzero(r))], wk)
            if 'air' in means and r.any():
                # 비공정: 이륙한 곳에서 천공섬 발판으로만 더 간다(걷는 땅은 이미 위 단계가 정한 대로)
                r = r.copy()
                for (x, y) in self.sky:
                    r[y, x] = True
            if int(r.sum()) + int(sea_reach.sum()) == before:
                break
        self.last_sea = sea_reach
        return r

    def _compute_stages(self):
        order = ['pass', 'ship', 'skiff', 'air']
        self.reach = []
        self.reach.append(self.reach_with([]))
        for k in range(1, 5):
            self.reach.append(self.reach_with(order[:k]))
        self.sea_reach = self.last_sea if hasattr(self, 'last_sea') else None
        # 배가 다니는 바다(항구에서 닿는 바다)
        self.sea_reach = None
        self.reach_with(['pass', 'ship'])
        self.sea_reach = self.last_sea.copy()
        self.landing2 = self.landing_cells(self.sea_reach, self.walk0)
        self.reach_with(order)   # last_sea 를 마지막 상태로

    def place_stage(self, name):
        """그 장소에 처음 닿는 막 번호(발자국 혹은 맞닿은 칸 기준)."""
        if name == SKY_SITE[0]:
            cells = list(self.sky)
        else:
            cells = footprint(self.ic, name)
        for k, r in enumerate(self.reach):
            for (x, y) in cells:
                if r[y, x]:
                    return k
            if name == GATE_SITE:       # 관문은 서쪽에서 닿으면 닿은 것
                for (x, y) in cells:
                    if any(r[b, a] for a, b in neighbors4(x, y)):
                        return k
        return None

    def site_list(self):
        names = [s[0] for s in M4.SITES] + [SKY_SITE[0]]
        return names


def save_map_json(w, path):
    M = w.M
    sites = []
    for name, src, spec, x, y, ground, kind, why in M4.SITES:
        ww, hh = w.ic[name][2:]
        sites.append(dict(name=name, kind=kind, x=x, y=y, w=ww, h=hh, note=why))
    n, x, y, ww, hh = SKY_SITE
    sites.append(dict(name=n, kind='sky', x=x, y=y, w=ww, h=hh, note='두 대륙 사이 바다 위에 뜬 대륙'))
    Path(path).write_text(json.dumps(dict(
        width=W, height=H, ground=M.G.tolist(), object=M.O.tolist(), height_level=M.Hh.tolist(),
        ramp=[[int(x), int(y)] for y, x in zip(*np.nonzero(M.RAMP))],
        names={str(k): v for k, v in V.NAMES.items()}, sites=sites,
        routes=[dict(name=n_, cells=[list(c) for c in cells]) for n_, cells in w.paths],
        bridges=[dict(x=int(x), y=int(y), dir=d) for (x, y), d in sorted(w.bridge.items())],
        start=list(START), gate=GATE_SITE, dune_sea=[[int(x), int(y)] for y, x in zip(*np.nonzero(M.dune_sea))],
        note='v8 세계에 장벽(산벽·사구 바다)을 더한 9단계 여정 지도. v8 은 그대로.'), ensure_ascii=False))


if __name__ == '__main__':
    w = World()
    for k, r in enumerate(w.reach):
        print('R%d' % k, int(r.sum()))
    for n in w.site_list():
        print(n, w.place_stage(n))

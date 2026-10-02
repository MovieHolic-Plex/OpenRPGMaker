#!/usr/bin/env python3
"""월드맵 키트: 여정 템플릿·아이콘 세트로 v9-final3 지형 파이프라인을 돌린다(지형 모듈은 그대로, 입력만 템플릿에서).

원본 흐름(fix4_build.py)과 같은 순서이되 둘이 다르다.
  1) 장소·길은 모듈의 하드코딩 대신 여정 템플릿(places/roads)에서 읽는다. 아이콘 이름은 세트가 고른 것을 쓴다(발자국은 역할의 칸 수).
  2) 지형을 먼저 아이콘 없이 끝까지 그리고(render_terrain), 아이콘은 팔레트를 적용한 뒤에 붙인다(paste_icons).
     천공섬은 바다 그림자(지형)만 지형 단계에서 드리우고 아이콘은 다른 아이콘과 함께 붙인다.
프로세스당 install 은 한 번만 부른다(모듈 전역을 고친다).
"""
import json
import os
import sys
import tempfile
from pathlib import Path

os.environ['CITY_TAG'] = 'v8'
import numpy as np  # noqa: E402

import make_map_v4 as M4  # noqa: E402
import make_map_v5 as m5  # noqa: E402
import terrain_v4 as V  # noqa: E402
import worldmap_easyrpg_plus as wm  # noqa: E402
import boundary_v5 as B5  # noqa: E402
import fix3_patches as P  # noqa: E402
import fix4_patches as P4  # noqa: E402
import journey_world_v9 as J  # noqa: E402
import terrain_f1  # noqa: E402
import swamp_final  # noqa: E402
import journey_fx_v9 as FX  # noqa: E402
import make_map_icons_v9 as MI  # noqa: E402
from terrain_lib import rnd  # noqa: E402
from kit_common import KitError  # noqa: E402

TERRAIN_BOUND_IDS = ('내해 항구', '고갯길 요새', '사막 신전', '사막 폐허', '설원 마을')   # 공용 지형 코드가 이름으로 부르는 장소
_installed = False
KEY = (255, 103, 139)


def install(journey, roles, iconset, assign):
    """모듈 전역을 템플릿·세트에 맞춘다. 아이콘 세트 시트/메타는 wm.EXT/EXT_JSON 으로 건다(발자국 칸 수를 M4.build 가 읽는다)."""
    global _installed
    if _installed:
        raise RuntimeError('kit_world.install 은 프로세스당 한 번만 부를 수 있다')
    _installed = True
    ids = {p['id'] for p in journey['places']}
    miss = [i for i in TERRAIN_BOUND_IDS if i not in ids]
    if miss:
        raise KitError('여정 %s: 공용 지형이 이름으로 참조하는 장소가 없다 — %s' % (journey['id'], ', '.join(miss)))
    sky = [p for p in journey['places'] if p['role'] == 'floating']
    if len(sky) != 1:
        raise KitError('여정 %s: 역할 floating 장소는 정확히 하나여야 한다(지금 %d)' % (journey['id'], len(sky)))
    sky = sky[0]
    gate = [b for b in journey['barriers'] if b['means'] == 'pass']
    if not gate:
        raise KitError('여정 %s: means=pass 장벽(관문)이 없다' % journey['id'])
    if tuple(iconset.shadow_key) != (254, 103, 139):
        raise KitError('아이콘 세트 %s: shadow_key 는 [254,103,139] 만 지원한다' % iconset.id)
    tmp = Path(tempfile.mkdtemp(prefix='wmkit-'))
    meta = dict(key=list(iconset.key), icons=[dict(name=n, cells=ic['cells'], col=ic['col'], row=ic['row']) for n, ic in iconset.icons.items()])
    (tmp / 'meta.json').write_text(json.dumps(meta))
    wm.EXT = iconset.sheet_path
    wm.EXT_JSON = tmp / 'meta.json'
    sites = []
    for p in journey['places']:
        if p['role'] == 'floating':
            continue
        ground = getattr(M4, p['ground']) if p.get('ground') else None
        sites.append((p['id'], 'ext', assign[p['id']], p['x'], p['y'], ground, p['kind'], p.get('note', '')))
    routes = [(r['id'], r['from'], r['to'], list(r.get('via', []))) for r in journey['roads']]
    cw, ch = roles['floating']['cells']
    set_world_constants(journey['start']['cell'], gate[0]['gate'], (sky['id'], sky['x'], sky['y'], cw, ch))
    m5.SKY = (sky['id'], assign[sky['id']], sky['x'], sky['y'], sky.get('note', ''))
    m5.ext_with_cities = lambda: None
    m5.SKY_PASTE_ICON = False
    V.Map4._compute_faces = terrain_f1.compute_faces_f1          # F1: 동·서 가장자리 벽 1칸 + 외톨이 1칸 벽 지우기
    V.DECOR[V.SWAMP] = []                                        # 옛 「물웅덩이」 점 스프라이트 제거(늪 후처리의 일부)

    def kit_build_v5(*a, **k):
        M4.SITES[:] = sites
        M4.ROUTES[:] = routes
        M4.render_ground = B5.render_ground_v5
        M4.render_depth = B5.render_depth_v5
        import coast_v6
        coast_v6.install(M4)
        import cliff_v8
        cliff_v8.install(M4)
        M, icon_cells, meta_, info0 = M4.build()
        M.G[34, 40:45] = 0                                       # 항구 부두가 바다에 닿도록
        return M, icon_cells, meta_
    m5.build_v5 = kit_build_v5
    ob = J.build_world

    def bw():
        M, ic, meta_ = ob()
        P.soften_world(M, ic)                                    # 장소 밑 사각 패치(지형 코드·물체)
        P4.add_pond(M)                                           # 분화구 호수 자리 = 연못 지형
        return M, ic, meta_
    J.build_world = bw


def set_world_constants(start, gate, sky_site):
    J.START = tuple(start)
    J.GATE_SITE = gate
    J.SKY_SITE = tuple(sky_site)


def make_world():
    w = J.World()
    J.World = lambda: w                                          # 검사기가 같은 세계를 다시 부르게 한다(빌드 두 번 금지: SITES 가 누적된다)
    return w


# ──────────────────────────────── 지형 렌더(아이콘 없음) ────────────────────────────────
def _render_base(w):
    snap = {}
    of = M4.render_faces

    def rf(M_, img):
        snap['g'] = img.copy()
        return of(M_, img)
    M4.render_faces = rf
    M4.render = m5.paste_sky(MI.render_base)
    img, info = M4.render(w.M, w.ic, w.meta)
    M4.render_faces = of
    return img, info, snap['g']


def render_terrain(w):
    """아이콘 없는 지형 그림 C(길·다리·경사로·늪·연못·사구 후처리 포함)와 렌더 info."""
    old_ramps = M4.render_ramps
    M4.render_ramps = lambda M_, img_: P.render_ramps_fix3(M_, img_, old_ramps)
    img, info, snap = _render_base(w)
    M4.render_ramps = old_ramps
    img = swamp_final.run(img, snap, w.M.G)
    img = P4.paint_pond(img)
    island = P.island_mask(w.M, w.ic)
    C = P.dune_fx3(img, w.M, w.ic, w.dune | island, rnd, FX._vnoise, mesa=island)
    paths_same = [list(map(list, c)) for _, c in info['paths']] == [list(map(list, c)) for _, c in w.paths]
    return C, info, paths_same


# ──────────────────────────────── 아이콘 붙이기 ────────────────────────────────
def paste_icons(img, ic, sky_site, iconset, assign, tint_icon):
    """팔레트가 적용된 지형 위에 아이콘을 붙인다. 천공섬이 먼저(원래도 지형 단계에서 먼저 붙었다), 나머지는 ic 순서.
    tint_icon(arr) -> arr : 팔레트 빛 틴트(키색은 그대로). ic: {장소: (x,y,w,h)}, sky_site: (이름,x,y,w,h)."""
    img = img.copy()
    sname, sx, sy, sw, sh = sky_site
    sky_icon = tint_icon(iconset.array(assign[sname]))
    dst = img[sy * 16:(sy + sh) * 16, sx * 16:(sx + sw) * 16]
    solid = ~np.all(sky_icon == np.array(KEY, np.uint8), axis=2)
    dst[solid] = sky_icon[solid]
    for name, (x, y, ww, hh) in ic.items():
        if name.endswith('경사로') or name not in assign:
            continue
        arr = tint_icon(iconset.array(assign[name]))
        if arr.shape[1] // 16 != ww or arr.shape[0] // 16 != hh:
            raise KitError('아이콘 %s 칸 수(%dx%d)가 장소 %s 발자국(%dx%d)과 다르다' % (assign[name], arr.shape[1] // 16, arr.shape[0] // 16, name, ww, hh))
        P.paste_icon_soft(img, arr, x, y, assign[name])
    return img


# ──────────────────────────────── 세계 JSON ────────────────────────────────
def world_dict(w, journey, assign):
    tmp = Path(tempfile.mkdtemp(prefix='wmkit-')) / 'm.json'
    J.save_map_json(w, tmp)
    d = json.loads(tmp.read_text())
    d['schema'] = 'worldmap-world/1'
    d['journey'] = journey['id']
    d['sky_site'] = list(J.SKY_SITE)
    d['ic'] = {k: [int(v) for v in vv] for k, vv in w.ic.items()}
    d['face'] = [[int(x), int(y), int(j), int(n)] for (x, y), (j, n, _r) in sorted(w.M.face.items())]
    d['road_cells'] = [[int(x), int(y)] for y, x in zip(*np.nonzero(w.road))]
    d['foot_cells'] = [[int(x), int(y)] for y, x in zip(*np.nonzero(w.foot))]
    byid = {p['id']: p for p in journey['places']}
    d['places'] = []
    for s in d['sites']:
        p = byid[s['name']]
        d['places'].append(dict(id=s['name'], role=p['role'], act=p['act'], x=s['x'], y=s['y'], w=s['w'], h=s['h'], icon=assign[s['name']]))
    d['roads'] = d.pop('routes')
    d.pop('note', None)
    return d


class MapStub:
    """지도 JSON 에서 복원한 지형(통행 판정에 필요한 배열과 절벽 칸)."""

    def __init__(self, d):
        self.G = np.array(d['ground'], np.int16)
        self.O = np.array(d['object'], np.int16)
        self.Hh = np.array(d['height_level'], np.int16)
        self.H, self.W = self.G.shape
        self.RAMP = np.zeros((self.H, self.W), bool)
        for x, y in d['ramp']:
            self.RAMP[y, x] = True
        self.face = {(x, y): (j, n, None) for x, y, j, n in d['face']}
        self.dune_sea = np.zeros((self.H, self.W), bool)
        for x, y in d['dune_sea']:
            self.dune_sea[y, x] = True

    def inb(self, x, y):
        return 0 <= x < self.W and 0 <= y < self.H

    def is_face(self, x, y):
        return (x, y) in self.face


class MapWorld(J.World):
    """J.World 와 같은 통행 규칙·막별 도달 영역. 지형 빌드·길 계획만 건너뛰고 world.json 에서 읽는다."""

    def __init__(self, d):
        set_world_constants(d['start'], d['gate'], d['sky_site'])
        self.M = M = MapStub(d)
        self.ic = ic = {k: tuple(v) for k, v in d['ic'].items()}
        self.meta = None
        self.walk0 = J.base_walk(M, ic)
        self.road = np.zeros((M.H, M.W), bool)
        self.foot = np.zeros((M.H, M.W), bool)
        for x, y in d['road_cells']:
            self.road[y, x] = True
        for x, y in d['foot_cells']:
            self.foot[y, x] = True
        self.bridge = {(b['x'], b['y']): b['dir'] for b in d['bridges']}
        self.paths = [(r['name'], [tuple(c) for c in r['cells']]) for r in d['roads']]
        for (x, y) in self.bridge:
            self.walk0[y, x] = True
        self.sites = {n: v for n, v in ic.items() if not n.endswith('경사로')}
        self.site_kind = {s['name']: s['kind'] for s in d['sites']}
        self.site_kind['천공섬'] = 'sky'
        self.gate = set(J.gate_cells(ic))
        for n, (x, y, ww, hh) in self.sites.items():
            self.walk0[y:y + hh, x:x + ww] = True
        self.walk_closed = self.walk0.copy()
        for (x, y) in self.gate:
            self.walk_closed[y, x] = False
        self.sea = (M.G == V.SEA)
        self.dune = (M.G == V.DUNE)
        self.sky = set(J.sky_cells())
        self.sea_nosky = self.sea.copy()
        self._compute_stages()

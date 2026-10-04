#!/usr/bin/env python3
"""예제 도시 맵 굽기 — compose_town 의 도시 한 장(60x60칸)을 modern_city 타일셋의 칸 번호 격자로 옮긴다.

  python3 src/harnesses/modern-chipset/bake_map.py [--seed N] [--no-write]

입력  compose_town.build(run_town.sh 와 같은 인자)가 돌려주는 (그림, 통계, Town) — Town.sprites(건물·소품·차량)·Town.kind(칸 종류표).
      src/assets/modernCityTileset.json + public/assets/modern-city/modern-city-chipset.png(시트·정의만 읽는다. 새 그림은 그리지 않는다)
      tiledata/modern-city/kit-index.json(문·접근 칸)
출력  tiledata/modern-city/map/modern-city-<seed>.json         맵 JSON(build_tileset.py 의 out_maps 와 같은 모양)
      tiledata/modern-city/map/modern-city-<seed>-report.json  검증 숫자(렌더 비교·도달성·칸 번호 범위·대체 횟수)
      verify-shots/modern-city/map-<seed>.png(960x960) / map-<seed>-x2.png  맵을 시트+정의만으로 다시 그린 그림
      verify-shots/modern-city/ref-<seed>.png                  비교 기준(compose_town 원본에서 사람·전선만 뺀 그림)
      verify-shots/modern-city/diff-<seed>.png                 둘의 차이(빨강)

레이어 규칙
  lowerTiles         땅(아스팔트·보도·연석·횡단보도·공원 잔디·꽃밭·벽돌·길·물·생울타리) — 원본 바닥 칸을 시트 칸과 화소로 맞춰 고른다
  lowerOverlayTiles  도로 표시(중앙선·정지선·화살표·맨홀·배수구)와 접지 그림자(2층, 투명 오버레이)
  upperTiles         건물·소품·차량 키트 칸. 그리기 순서(발끝 y)대로 덮어쓴다
  upperOverlayTiles  한 칸에 둘 이상이 필요할 때(뒤 건물 앞에 선 가로등, 키 큰 소품의 윗칸 등) 뒤에 그린 것이 반투명이면 여기에 얹는다
사람(Actor1)·전선은 타일이 아니므로 넣지 않는다. 이벤트는 만들지 않는다.
"""
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
CWD0 = os.getcwd()
import bake_lib as BL            # noqa: E402
import compose_town as CT        # noqa: E402
import town_lib as TL            # noqa: E402

T = 16
W = H = CT.W
PX = CT.PX
DEF_PATH = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET_PATH = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
KITS_PATH = os.path.join(ROOT, 'tiledata/modern-city/kit-index.json')
MAP_DIR = os.path.join(ROOT, 'tiledata/modern-city/map')
SHOT_DIR = os.path.join(ROOT, 'verify-shots/modern-city')
MAP_ID = 'modern-city-example'
ASSETS = os.path.join(ROOT, 'harness-data/modern-chipset/town_assets.json')
RUN_ARGS = ['--ground', 'v1002-121948:A', '--green', 'v1002-184242:A', '--props', 'v1002-182800:A',
            '--car', ','.join(f'v1002-085924:{c}' for c in 'ABCDE'), '--car-front', 'v1002-184143:A,v1002-184143:C',
            '--car-back', 'v1002-184145:A,v1002-184145:B,v1002-184145:C']          # run_town.sh 와 같은 인자
SKIP_KINDS = ('person', 'wire')              # 타일이 아니다
DRAW_ORDER = {'bld': 0, 'prop': 1, 'parked': 1, 'car': 1, 'wire': 1, 'rb': 1, 'person': 2}


# ====================================================================== 시트·정의
class Sheet:
    def __init__(self):
        self.d = json.load(open(DEF_PATH, encoding='utf-8'))
        self.img = Image.open(SHEET_PATH).convert('RGBA')
        self.tpr = self.d['tilesPerRow']; self.count = self.d['count']
        self.kits = {k['id']: k for k in self.d['structureKits']}
        self.kit_index = json.load(open(KITS_PATH, encoding='utf-8'))['kits']
        self._cell = {}
        self.label_id = {}
        for i, m in enumerate(self.d['tileMeta']):
            if m.get('label'): self.label_id.setdefault(m['label'], i)
        self.group_ids = {g['id']: g['tileIds'] for g in self.d['tileGroups']}

    def cell(self, tid):
        c = self._cell.get(tid)
        if c is None: c = self._cell[tid] = BL.read_cell(self.img, tid, self.tpr)
        return c

    def opaque(self, tid):
        return bool((np.asarray(self.cell(tid))[:, :, 3] == 255).all())

    def passable(self, tid, d='up'):
        return self.d['passability'][tid][d]

    def star(self, tid):
        return self.d['tileMeta'][tid].get('passage') == 'star'

    def kit_image(self, kid):
        """시트+정의만으로 다시 조립한 키트 그림(정규화 RGBA)."""
        return BL.reassemble(self.kits[kid], self.img, self.tpr)


# ====================================================================== 도시 만들기 + 캡처
def baked_building_keys(S):
    """시트가 가진 건물 키트의 (건물이름, 글자, 벽색, 지붕색) 집합. 벽색 변형은 지붕색 기본, 지붕색 변형은 벽색 원본만 있다."""
    keys = set()
    for kid, info in S.kit_index.items():
        if info['kind'] != 'building': continue
        keys.add((info['source']['name'], info['source']['letter'], info['variant'].get('wall'), info['variant'].get('roof') or 'base'))
    return keys


class ExactBuildings:
    """compose_town 이 건물을 시트가 정확히 가진 그림만으로 조립하게 하는 끼움 장치(compose_town.py 는 건드리지 않는다).
      · 벽색 변형(`~색`)은 굽힌 키트가 있는 것만 풀에 남긴다.
      · 옥상 설비·간판은 굽기와 같은 시드·같은 인자(room=ROOF_ROOM, 새 예산)로 다시 만든다 — 같은 건물 그림이 나온다.
      · 지붕색은 키트가 있는 색만(없으면 기본색)."""
    def __init__(self, S):
        self.keys = baked_building_keys(S); self.rng = {}; self.stats = collections.Counter()

    @staticmethod
    def parts(b):
        base, _, wall = b['name'].partition('~')
        fam, letter = base.split(':')
        return fam, letter, (wall or None), base

    def install(self):
        import random as _r, bake_tileset as BT
        self._o = (CT.load_assets, TL.decorate_roof, TL.add_facade_sign)
        o_load, o_deco, o_sign = self._o

        def load_assets(a):
            pool, props2, vehicles, note, park, extra = o_load(a)
            keep = []
            for b in pool:
                fam, letter, wall, _ = self.parts(b)
                if (fam, letter, wall, 'base') in self.keys: keep.append(b)
                else: self.stats['pool_dropped_unbaked_wall_variant'] += 1
            return keep, props2, vehicles, note, park, extra

        def deco(b, rng, RP, room, ramp_name='base', budget=None):
            fam, letter, wall, base = self.parts(b)
            ramp = ramp_name if (wall is None and (fam, letter, None, ramp_name) in self.keys) else 'base'
            if ramp != ramp_name: self.stats['roof_color_remapped_to_base'] += 1
            r2 = _r.Random(f'mc-bake:{BT.BAKE_SEED}:{base}'); self.rng['last'] = r2
            return o_deco(b, r2, RP, BT.ROOF_ROOM, ramp, {})

        def sign(im, b, info, Sg, rng): return o_sign(im, b, info, Sg, self.rng['last'])
        CT.load_assets, TL.decorate_roof, TL.add_facade_sign = load_assets, deco, sign
        return self

    def uninstall(self):
        CT.load_assets, TL.decorate_roof, TL.add_facade_sign = self._o


def run_town(seed, exact=None):
    """compose_town.build 를 돌리고, 그리기 직전 바닥 그림(그림자·스프라이트 전)을 make_shadows 호출 지점에서 붙잡는다.
    exact(ExactBuildings 또는 None): 건물을 시트가 정확히 가진 그림으로만 조립한다."""
    a = CT.parser().parse_args(['--out', '/tmp/_mc_town.png', '--seed', str(seed), '--assets', ASSETS] + RUN_ARGS)
    cap = {}
    orig = TL.make_shadows

    def hook(sprites, kind, PX_):
        cap['base'] = sys._getframe(1).f_locals['im'].copy()
        return orig(sprites, kind, PX_)
    TL.make_shadows = hook
    if exact: exact.install()
    try:
        im, stat, town = CT.build(a)
    finally:
        TL.make_shadows = orig
        if exact: exact.uninstall()
    audit, _ = CT.audit(town)
    return dict(im=im, stat=stat, town=town, base=cap['base'], audit=audit, exact_stats=dict(exact.stats) if exact else None)


def sorted_sprites(sprites):
    return sorted(sprites, key=lambda s: (s['foot'], DRAW_ORDER[s['k']]))


def reference_image(base, town):
    """비교 기준: 바닥 + (사람 뺀) 접지 그림자 + 스프라이트(사람·전선 뺀) 발끝 순서. compose_town 의 최종 그리기 순서와 같다."""
    keep = [s for s in town.sprites if s['k'] not in SKIP_KINDS]
    sh, _ = TL.make_shadows(keep, town.kind, PX)
    im = base.copy(); im.alpha_composite(sh)
    for s in sorted_sprites(keep):
        x, y, img = s['x'], s['y'], s['img']
        if 0 <= x and 0 <= y and x + img.width <= PX and y + img.height <= PX: im.alpha_composite(img, (x, y))
        else: CT._clip(im, img, x, y)
    return im


# ====================================================================== 땅 · 도로 표시
def classify_ground(S, base):
    """바닥 그림의 칸마다 시트 땅 칸(1..24) 중 화소 차이가 가장 작은 것. 도로 표시가 얹힌 칸도 표시 화소만큼 같이 어긋나므로 같은 선택이 된다."""
    ids = [S.label_id[l] for l in GROUND_LABELS + GREEN_LABELS]
    arr = np.asarray(base).astype(np.int32)
    cand_arr = {t: np.asarray(S.cell(t)).astype(np.int32) for t in ids}
    out = [[-1] * W for _ in range(H)]; resid = {}
    for cy in range(H):
        for cx in range(W):
            blk = arr[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T]
            best = None
            for t, c in cand_arr.items():
                # 바닥 칸은 불투명이라 알파는 비교하지 않는다
                d = int((np.abs(blk[:, :, :3] - c[:, :, :3]).sum(-1) > 0).sum())
                if best is None or d < best[0]: best = (d, t)
            out[cy][cx] = best[1]; resid[(cx, cy)] = best[0]
    return out, resid


GROUND_LABELS = ['아스팔트', '아스팔트(얼룩)', '차선 점선(가로, 구형)', '차선 점선(세로, 구형)', '횡단보도(가로 도로 위, 줄 가로)', '횡단보도(세로 도로 위, 줄 세로)', '보도 포석', '보도 포석(얼룩)',
                 '연석(남쪽이 도로)', '연석(북쪽이 도로)', '연석(동쪽이 도로)', '연석(서쪽이 도로)', '연석 모서리(남동쪽이 도로)', '연석 모서리(남서쪽이 도로)', '연석 모서리(북동쪽이 도로)', '연석 모서리(북서쪽이 도로)']
GREEN_LABELS = ['공원 잔디', '공원 잔디(변형)', '꽃밭', '벽돌 포장(밝음)', '벽돌 포장(어두움)', '공원 길(모래)', '연못 물', '생울타리']


def overlay_exact(S, base, ground, tol=5):
    """바닥 칸 위에 도로 표시 오버레이 칸(그룹 mc:marking-center·mc:marking-stop) 하나를 얹어 원본 칸과 같은(채널 차이 <= tol) 경우만 채택한다.
    정지선 흰색은 굽기에서 modern4 램프색으로 바뀌어(최대 4/255) 화소 일치가 아니라 tol 로 본다. 반환 {(cx,cy): tid}, 어긋난 칸 수."""
    ov_ids = [t for g in ('mc:marking-center', 'mc:marking-stop') for t in S.group_ids[g]]
    arr = np.asarray(base).astype(int)
    out = {}; off = 0; offcells = []
    for cy in range(H):
        for cx in range(W):
            blk = arr[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T, :3]
            g = S.cell(ground[cy][cx])
            if np.array_equal(np.asarray(g).astype(int)[:, :, :3], blk): continue       # 표시 없음
            hit = None
            for t in ov_ids:
                comp = g.copy(); comp.alpha_composite(S.cell(t))
                if np.abs(np.asarray(comp).astype(int)[:, :, :3] - blk).max() <= tol: hit = t; break
            if hit is None: off += 1; offcells.append((cx, cy))
            else: out[(cx, cy)] = hit
    return out, off


# ====================================================================== 스프라이트 → 키트
class KitIndex:
    """prop/vehicle/building 키트를 시트+정의에서 다시 조립한 그림으로 색인한다(해시 일치 → 같은 그림, 아니면 같은 크기에서 화소 차이가 가장 작은 키트)."""
    def __init__(self, S):
        self.S = S
        self.exact = {}          # (kind class, 캔버스 바이트 해시) → [kit id]
        self.by_size = collections.defaultdict(list)    # (kind class, w, h) → [(kid, ndarray)]
        self.arrs = {}
        for kid, info in S.kit_index.items():
            kc = {'building': 'bld', 'prop': 'prop', 'vehicle': 'prop'}.get(info['kind'])
            if kc is None: continue
            im = S.kit_image(kid); a = np.asarray(im)
            self.arrs[kid] = a
            self.exact.setdefault((kc, hash(a.tobytes())), []).append(kid)
            self.by_size[(kc, im.width, im.height)].append((kid, a))

    @staticmethod
    def diff(a, b):
        return int((a != b).any(-1).sum())

    def match(self, kc, canvas, fam=None, letter=None, name_hint=None):
        """반환 (kit id, 화소 차이, 방식). 방식: exact | nearest | nearest-name(같은 건물·글자 안에서)."""
        a = np.asarray(BL.norm(canvas))
        hit = self.exact.get((kc, hash(a.tobytes())))
        if hit:
            if fam:   # 건물: 같은 건물이름 우선
                pref = [k for k in hit if self.S.kit_index[k]['source']['name'] == fam and self.S.kit_index[k]['source']['letter'] == letter]
                if pref: return pref[0], 0, 'exact'
            if name_hint:
                pref = [k for k in hit if name_hint in k]
                if pref: return pref[0], 0, 'exact'
            return hit[0], 0, 'exact'
        cands = self.by_size.get((kc, canvas.width, canvas.height), [])
        how = 'nearest'
        if fam:
            same = [(k, b) for k, b in cands if self.S.kit_index[k]['source']['name'] == fam and self.S.kit_index[k]['source']['letter'] == letter]
            if same: cands = same; how = 'nearest-name'
        if not cands: return None, None, 'none'
        best = min(((self.diff(a, b), k) for k, b in cands))
        return best[1], best[0], how


def sprite_placements(S, KI, town):
    """스프라이트(사람·전선 제외)를 발끝 순서로 훑어 [dict(kid, ox, oy(칸 좌표), …)] 를 만든다."""
    out = []
    for s in sorted_sprites([q for q in town.sprites if q['k'] not in SKIP_KINDS]):
        k = s['k']
        if k == 'bld':
            fam, rest = s['name'].split(':'); letter = rest.split('~')[0]
            canvas, off = BL.building_canvas(s['img'])
            kid, d, how = KI.match('bld', canvas, fam, letter)
            if kid is None: out.append(dict(sprite=s, kid=None, how='none')); continue
            kh = S.kits[kid]['height']
            ox = s['x'] // T; oy = (s['foot'] - kh * T) // T
            out.append(dict(sprite=s, kid=kid, diff=d, how=how, ox=ox, oy=oy, w=S.kits[kid]['width'], h=kh, shift=(0, 0)))
        else:
            canvas, off = BL.sprite_canvas(s['img'])
            if canvas is None: continue
            kid, d, how = KI.match('prop', canvas)
            if kid is None: out.append(dict(sprite=s, kid=None, how='none')); continue
            kit = S.kits[kid]; kh = kit['height']; kw = kit['width']
            px = s['x'] + off['srcBBox'][0] - off['padLeft']; py = s['y'] + off['srcBBox'][3] - kh * T
            ox, oy = round(px / T), round(py / T)
            out.append(dict(sprite=s, kid=kid, diff=d, how=how, ox=ox, oy=oy, w=kw, h=kh, shift=(round(ox * T - px), round(oy * T - py))))
    return out


# ====================================================================== 쌓기
class Layers:
    def __init__(self):
        n = W * H
        self.lower = [-1] * n; self.lo2 = [-1] * n; self.upper = [-1] * n; self.up4 = [-1] * n
        self.own3 = [-1] * n; self.own4 = [-1] * n          # 그 칸의 3·4층 칸을 낸 배치 번호
        self.log = collections.Counter()


def stamp_kit(S, L, kid, ox, oy, owner):
    """키트 칸을 위층(3층)에 쌓는다. 비어 있으면 3층, 이미 차 있으면: 새 칸이 불투명이면 덮어쓰고(아래 4층 내용도 가려진다), 반투명이면 4층에 얹는다."""
    kit = S.kits[kid]
    for y, row in enumerate(kit['rows']):
        for x, t in enumerate(row['upperTiles']):
            if t < 0: continue
            cx, cy = ox + x, oy + y
            if not (0 <= cx < W and 0 <= cy < H): L.log['out_of_map_cells'] += 1; continue
            i = cy * W + cx
            if L.upper[i] < 0: L.upper[i] = t; L.own3[i] = owner; L.log['stamped_3'] += 1
            elif S.opaque(t): L.upper[i] = t; L.own3[i] = owner; L.up4[i] = -1; L.own4[i] = -1; L.log['overwritten_opaque'] += 1
            else:
                if L.up4[i] >= 0: L.log['layer4_overflow'] += 1
                L.up4[i] = t; L.own4[i] = owner; L.log['stamped_4'] += 1


def shadow_layer(S, placements, town):
    """접지 그림자를 칸에 맞춘 그림(발끝이 칸 경계)으로 다시 만들어 시트의 그림자 칸에 맞춘다. 반환 {(cx,cy): tid}, 통계."""
    fake = []
    for p in placements:
        if p.get('kid') is None: continue
        s = p['sprite']
        if s['k'] not in ('bld', 'prop'): continue
        img = S.kit_image(p['kid'])
        d = dict(k=s['k'], name=s.get('name', ''), img=img, x=p['ox'] * T, y=p['oy'] * T, foot=(p['oy'] + p['h']) * T)
        fake.append(d)
    layer, _ = TL.make_shadows(fake, town.kind, PX)
    a = np.asarray(layer)
    lib = {t: np.asarray(S.cell(t)) for t in S.group_ids['mc:shadow']}
    libhash = {v.tobytes(): t for t, v in lib.items()}
    out = {}; st = collections.Counter(); dsum = 0
    for cy in range(H):
        for cx in range(W):
            blk = a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T]
            if not blk[:, :, 3].any(): continue
            # 그림자 칸은 RGB 가 같은 먹색이고 알파만 다르다. 알파 0 화소의 RGB 는 정규화(0)로 맞춘다.
            n = blk.copy(); n[n[:, :, 3] == 0] = 0
            t = libhash.get(n.tobytes())
            if t is not None: out[(cx, cy)] = t; st['exact'] += 1; continue
            best = min(((int(np.abs(n[:, :, 3].astype(int) - v[:, :, 3].astype(int)).sum()), t) for t, v in lib.items()))
            out[(cx, cy)] = best[1]; st['nearest'] += 1; dsum += best[0]
    st['alpha_abs_diff_sum_of_nearest'] = dsum
    return out, dict(st)


def mark_tiles(S, town):
    """화살표·맨홀·배수구 — 교차로·표시 사각 중심을 가장 가까운 칸에 놓는다."""
    ids = {l: S.label_id[l] for l in ('직진 화살표(오른쪽)', '직진 화살표(왼쪽)', '직진 화살표(위)', '직진 화살표(아래)', '맨홀(고리)', '맨홀(격자)', '배수구(왼쪽 반)', '배수구(오른쪽 반)')}
    out = []                                                                   # [(cx, cy, tid, 종류)]
    inter = [(c, r) for r in CT.ROW0 for c in CT.COL0]
    for kind, (x0, y0, x1, y1) in town.marks:
        if kind != 'arrow': continue
        cxp, cyp = (x0 + x1) / 2, (y0 + y1) / 2
        c, r = min(inter, key=lambda q: (cxp / T - (q[0] + 3)) ** 2 + (cyp / T - (q[1] + 3)) ** 2)
        if (x1 - x0) > (y1 - y0): name = '직진 화살표(오른쪽)' if cxp < c * T + 3 * T else '직진 화살표(왼쪽)'
        else: name = '직진 화살표(아래)' if cyp < r * T + 3 * T else '직진 화살표(위)'
        out.append((int(cxp // T), int(cyp // T), ids[name], 'arrow'))
    for i, (_n, (x0, y0, x1, y1)) in enumerate(town.manholes):
        out.append((int(((x0 + x1) / 2) // T), int(((y0 + y1) / 2) // T), ids['맨홀(고리)' if i % 2 == 0 else '맨홀(격자)'], 'manhole'))
    for _n, (x0, y0, x1, y1) in town.drains:
        w = x1 - x0; left = round((x0 - (32 - w) / 2) / T); cy = int(((y0 + y1) / 2) // T)
        out.append((left, cy, ids['배수구(왼쪽 반)'], 'drain')); out.append((left + 1, cy, ids['배수구(오른쪽 반)'], 'drain'))
    return out


# ====================================================================== 통행(엔진 규칙을 그대로 옮긴 것: collision.ts passabilityOf)
DIRS = (('up', 0, -1), ('down', 0, 1), ('left', -1, 0), ('right', 1, 0))
OPP = {'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left'}


def cell_pass(S, L, i):
    """네 층 통행: 1층이 막히면 막힘, 4→2층 순으로 빈칸·★ 를 건너뛰고 처음 만난 칸이 정한다, 없으면 1층. 막힘이면 None."""
    l1 = L.lower[i]
    if l1 < 0: return None
    for t in (L.up4[i], L.upper[i], L.lo2[i]):
        if t < 0 or S.star(t): continue
        return S.d['passability'][t]
    return S.d['passability'][l1]


def blocker(S, L, i):
    """그 칸 통행을 정하는 위층 칸을 낸 배치 번호(없으면 -1: 땅이 정한다)."""
    for t, o in ((L.up4[i], L.own4[i]), (L.upper[i], L.own3[i])):
        if t < 0 or S.star(t): continue
        return o
    return -1


def can_move(S, L, fx, fy, dx, dy):
    d = 'right' if dx > 0 else 'left' if dx < 0 else 'down' if dy > 0 else 'up'
    tx, ty = fx + dx, fy + dy
    if not (0 <= tx < W and 0 <= ty < H): return False
    a = cell_pass(S, L, fy * W + fx); b = cell_pass(S, L, ty * W + tx)
    return bool(a and b and a[d] and b[OPP[d]])


def reachable(S, L, start):
    seen = {start}; q = collections.deque([start])
    while q:
        x, y = q.popleft()
        for _d, dx, dy in DIRS:
            n = (x + dx, y + dy)
            if n not in seen and can_move(S, L, x, y, dx, dy): seen.add(n); q.append(n)
    return seen


# ====================================================================== 그리기(시트 + 정의만으로)
def render(S, L):
    out = Image.new('RGBA', (PX, PX), (0, 0, 0, 255))
    for layer in (L.lower, L.lo2, L.upper, L.up4):
        for i, t in enumerate(layer):
            if t >= 0: out.alpha_composite(S.cell(t), ((i % W) * T, (i // W) * T))
    return out


# ====================================================================== 맵 만들기
def build_layers(S, KI, r, placements, dropped, ground, ov_exact, shadows, marks):
    L = Layers()
    for cy in range(H):
        for cx in range(W): L.lower[cy * W + cx] = ground[cy][cx]
    for (cx, cy), t in ov_exact.items(): L.lo2[cy * W + cx] = t
    for cx, cy, t, kind in marks:
        if 0 <= cx < W and 0 <= cy < H:
            i = cy * W + cx
            if L.lo2[i] < 0: L.lo2[i] = t
            else: L.log['mark_vs_marking_conflict'] += 1
    for (cx, cy), t in shadows.items():
        i = cy * W + cx
        if L.lo2[i] < 0: L.lo2[i] = t
        else: L.log['shadow_dropped_marking_wins'] += 1
    for n, p in enumerate(placements):
        if p.get('kid') is None or n in dropped: continue
        stamp_kit(S, L, p['kid'], p['ox'], p['oy'], n)
    return L


def door_cells(town):
    out = []
    for x0, x1, foot in town.doors:
        out.append([(cx, foot // T) for cx in range(x0 // T, (x1 - 1) // T + 1)])
    return out


def pick_start(S, L, town):
    c, r = CT.COL0[0], CT.ROW0[0]
    for dx, dy in ((-3, -3), (-4, -4), (-3, -4), (-4, -3), (-2, -2), (-5, -5)):
        x, y = c + dx, r + dy
        if cell_pass(S, L, y * W + x) and can_move(S, L, x, y, 1, 0) or (cell_pass(S, L, y * W + x) and can_move(S, L, x, y, 0, 1)): return (x, y)
    raise SystemExit('시작 위치 후보가 모두 막혀 있다')


def compare(a, b):
    A = np.asarray(a.convert('RGB')).astype(int); B = np.asarray(b.convert('RGB')).astype(int)
    d = (A != B).any(-1)
    return d


SHIFTS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)]


def make_map(S, KI, seed, fix=True, exact=True):
    import heapq
    r = run_town(seed, ExactBuildings(S) if exact else None); town = r['town']
    ground, resid = classify_ground(S, r['base'])
    ov_exact, ov_off = overlay_exact(S, r['base'], ground)
    placements = sprite_placements(S, KI, town)
    marks = mark_tiles(S, town)
    doors = door_cells(town)
    dropped = {}; moved = {}
    shadows = {}; shst = {}

    def evaluate():
        L = build_layers(S, KI, r, placements, set(dropped), ground, ov_exact, {}, marks)
        start = pick_start(S, L, town)
        reach = reachable(S, L, start)
        bad = [(di, c) for di, cells in enumerate(doors) for c in cells if c not in reach]
        return L, start, reach, bad

    def conflicts(L): return L.log['overwritten_opaque'] + L.log['stamped_4'] + L.log['layer4_overflow']
    for rnd in range(60):
        L, start, reach, bad = evaluate()
        if not bad or not fix: break
        goal = {c for _di, c in bad}
        dist = {c: 0 for c in reach}; prev = {}; pq = [(0, c) for c in reach]; heapq.heapify(pq); hit = None
        while pq:
            dcur, cur = heapq.heappop(pq)
            if dcur > dist.get(cur, 1e9): continue
            if cur in goal: hit = cur; break
            for _d, dx, dy in DIRS:
                n = (cur[0] + dx, cur[1] + dy)
                if not (0 <= n[0] < W and 0 <= n[1] < H): continue
                dname = {(0, -1): 'up', (0, 1): 'down', (-1, 0): 'left', (1, 0): 'right'}[(dx, dy)]
                pn = cell_pass(S, L, n[1] * W + n[0]); pc = cell_pass(S, L, cur[1] * W + cur[0])
                on = blocker(S, L, n[1] * W + n[0]); oc = blocker(S, L, cur[1] * W + cur[0])
                drop_n = on >= 0 and placements[on]['sprite']['k'] != 'bld' and not (pn and any(pn.values()))
                drop_c = oc >= 0 and placements[oc]['sprite']['k'] != 'bld' and not (pc and any(pc.values()))
                if drop_n: cost = 4
                elif pn and pn[OPP[dname]] and ((pc and pc[dname]) or drop_c): cost = 0
                else: continue
                nd = dcur + cost
                if nd < dist.get(n, 1e9): dist[n] = nd; prev[n] = cur; heapq.heappush(pq, (nd, n))
        if hit is None: break
        owners = []
        cur = hit
        while cur in prev:
            i = cur[1] * W + cur[0]; o = blocker(S, L, i)
            if o >= 0 and placements[o]['sprite']['k'] != 'bld' and o not in dropped and o not in owners and not (cell_pass(S, L, i) and any(cell_pass(S, L, i).values())): owners.append(o)
            cur = prev[cur]
        if not owners: break
        o = owners[-1]                                   # 도달 집합에서 가장 가까운 걸림돌부터
        p = placements[o]; base_cost = (len(bad), conflicts(L)); done = False
        for sx, sy in SHIFTS:
            p['ox'] += sx; p['oy'] += sy
            L2, _s2, _r2, bad2 = evaluate()
            if (len(bad2), conflicts(L2)) < base_cost or (len(bad2) < len(bad) and conflicts(L2) <= conflicts(L)):
                moved[o] = dict(name=p['sprite'].get('name'), kid=p['kid'], cells=[sx, sy], reason=f'접근 칸 {hit} 까지의 길을 막아 칸 단위로 옮김'); done = True; break
            p['ox'] -= sx; p['oy'] -= sy
        if not done: dropped[o] = dict(name=p['sprite'].get('name'), kid=p['kid'], reason=f'접근 칸 {hit} 까지의 길을 막아 뺌(옮길 자리 없음)')
    # 최종 위치로 접지 그림자를 다시 만든다(옮긴·뺀 배치 반영)
    live = [q for n, q in enumerate(placements) if n not in dropped]
    shadows, shst = shadow_layer(S, live, town)
    L = build_layers(S, KI, r, placements, set(dropped), ground, ov_exact, shadows, marks)
    start = pick_start(S, L, town); reach = reachable(S, L, start)
    bad = [(di, c) for di, cells in enumerate(doors) for c in cells if c not in reach]
    return dict(r=r, ground=ground, resid=resid, ov_exact=ov_exact, ov_off=ov_off, placements=placements, shadows=shadows, shadow_stats=shst, marks=marks,
                dropped=dropped, moved=moved, L=L, start=start, reach=reach, doors=doors, bad_doors=bad)


# ====================================================================== 검증·출력
def validate_ids(S, L):
    """맵 안 모든 칸 번호가 정의 범위 안인지(1층은 빈칸 금지, 나머지는 -1 허용)."""
    bad = []
    for name, arr, allow_empty in (('lowerTiles', L.lower, False), ('lowerOverlayTiles', L.lo2, True), ('upperTiles', L.upper, True), ('upperOverlayTiles', L.up4, True)):
        for i, t in enumerate(arr):
            if t == -1 and allow_empty: continue
            if not (0 <= t < S.count): bad.append((name, i, t))
    return bad


def map_json(L, seed):
    def layer(a): return [int(t) for t in a]
    d = dict(id=f'modern-city-{seed}', name=f'현대 도시 예제 · 시드 {seed}', width=W, height=H, tilesetId='modern_city', tileSize=T,
             lowerTiles=layer(L.lower), lowerOverlayTiles=layer(L.lo2), upperTiles=layer(L.upper), upperOverlayTiles=layer(L.up4), events=[],
             climate={'mode': 'inherit'})
    return d


def stats(S, m, ref, img):
    town = m['r']['town']; L = m['L']
    d = compare(img, ref)
    foot = np.zeros((H, W), bool)
    for n, p in enumerate(m['placements']):
        if p.get('kid') is None or n in m['dropped'] or p['sprite']['k'] != 'bld': continue
        foot[max(0, p['oy']):p['oy'] + p['h'], p['ox']:p['ox'] + p['w']] = True
    fm = np.kron(foot.astype(np.uint8), np.ones((T, T), np.uint8)).astype(bool)
    cover = np.zeros((PX, PX), bool)                      # 원본·맵 어느 쪽이든 스프라이트(사람·전선 제외)가 닿은 화소
    for q in town.sprites:
        if q['k'] in SKIP_KINDS: continue
        a_ = np.asarray(q['img'])[:, :, 3] > 0; x0, y0 = max(0, q['x']), max(0, q['y']); x1, y1 = min(PX, q['x'] + a_.shape[1]), min(PX, q['y'] + a_.shape[0])
        if x1 > x0 and y1 > y0: cover[y0:y1, x0:x1] |= a_[y0 - q['y']:y1 - q['y'], x0 - q['x']:x1 - q['x']]
    for i, t in enumerate(L.upper):
        if t >= 0: cover[(i // W) * T:(i // W) * T + T, (i % W) * T:(i % W) * T + T] = True
    for i, t in enumerate(L.up4):
        if t >= 0: cover[(i // W) * T:(i // W) * T + T, (i % W) * T:(i % W) * T + T] = True
    cc = cover.reshape(H, T, W, T).any(axis=(1, 3))        # 칸 단위로 닿은 칸
    gm = ~np.kron(cc.astype(np.uint8), np.ones((T, T), np.uint8)).astype(bool)
    cls = np.zeros((H, W), np.uint8)                      # 칸 분류: 1 건물 2 소품 3 차량(원본 스프라이트가 닿았거나 키트가 놓인 칸)
    for p in m['placements']:
        if p.get('kid') is None: continue
        c = 1 if p['sprite']['k'] == 'bld' else 3 if p['kid'].startswith('mc-veh') else 2
        sp = p['sprite']; a_ = np.asarray(sp['img'])[:, :, 3] > 0
        ys, xs = np.nonzero(a_)
        if len(xs):
            for cy in range(max(0, (sp['y'] + ys.min()) // T), min(H, (sp['y'] + ys.max()) // T + 1)):
                for cx in range(max(0, (sp['x'] + xs.min()) // T), min(W, (sp['x'] + xs.max()) // T + 1)): cls[cy, cx] = max(cls[cy, cx], c) if cls[cy, cx] != 1 else 1
        for cy in range(max(0, p['oy']), min(H, p['oy'] + p['h'])):
            for cx in range(max(0, p['ox']), min(W, p['ox'] + p['w'])): cls[cy, cx] = max(cls[cy, cx], c) if cls[cy, cx] != 1 else 1
    clsp = np.kron(cls, np.ones((T, T), np.uint8))
    region = {nm: dict(px=int((clsp == k).sum()), mismatch_px=int((d & (clsp == k)).sum()), mismatch_pct=round(100 * float((d & (clsp == k)).sum()) / max(1, int((clsp == k).sum())), 2)) for nm, k in (('building_cells', 1), ('prop_cells', 2), ('vehicle_cells', 3), ('untouched_cells', 0))}
    bld = [p for p in m['placements'] if p['sprite']['k'] == 'bld']
    other = [p for p in m['placements'] if p['sprite']['k'] != 'bld']
    def sumhow(ps): return dict(collections.Counter(p['how'] for p in ps))
    bpx = [(p['diff'], int((np.asarray(p['sprite']['img'])[:, :, 3] > 0).sum())) for p in bld if p.get('kid')]
    shifts = [max(abs(p['shift'][0]), abs(p['shift'][1])) for p in other if p.get('kid')]
    resid_cells = sum(1 for v in m['resid'].values() if v > 0)
    return dict(
        seed=None, size=[W, H], pixels=PX * PX,
        render_vs_reference=dict(by_cell_class=region, mismatch_px=int(d.sum()), mismatch_pct=round(100 * float(d.mean()), 2),
                                 inside_building_footprints_px=int((d & fm).sum()), inside_building_footprints_pct=round(100 * float((d & fm).sum()) / max(1, int(fm.sum())), 2),
                                 outside_building_footprints_px=int((d & ~fm).sum()), outside_building_footprints_pct=round(100 * float((d & ~fm).sum()) / max(1, int((~fm).sum())), 2)),
        buildings=dict(count=len(bld), exact=sum(1 for p in bld if p['how'] == 'exact'), substituted=sum(1 for p in bld if p['how'] != 'exact'), how=sumhow(bld),
                       sprite_vs_kit_diff_px=sum(a for a, _b in bpx), sprite_opaque_px=sum(b for _a, b in bpx),
                       sprite_vs_kit_diff_pct=round(100 * sum(a for a, _b in bpx) / max(1, sum(b for _a, b in bpx)), 2),
                       per_building=[dict(name=p['sprite']['name'], kit=p['kid'], how=p['how'], diff_px=p['diff'], at=[p['ox'], p['oy']], size=[p['w'], p['h']]) for p in bld]),
        props_vehicles=dict(count=len(other), how=sumhow(other), snap_shift_px_max_per_axis_hist=dict(sorted(collections.Counter(shifts).items())),
                            substituted=[dict(name=p['sprite'].get('name'), kit=p['kid'], diff_px=p['diff']) for p in other if p['how'] != 'exact'], dropped=list(m['dropped'].values()), moved=list(m['moved'].values())),
        ground=dict(cells=W * H, ground_only_cells=int(cc.size - cc.sum()), ground_only_mismatch_px=int((d & gm).sum()), ground_only_mismatch_pct=round(100 * float((d & gm).sum()) / max(1, int(gm.sum())), 3), cells_with_residual_vs_tile=resid_cells, note='잔차 칸 = 바닥 칸에 도로 표시(화살표·맨홀·배수구·연석 주차 틱)가 얹힌 칸'),
        overlays=dict(exact_marking_cells=len(m['ov_exact']), unmatched_marking_cells=m['ov_off'], mark_tiles_placed=len(m['marks']), shadow=m['shadow_stats'],
                      note='연석 주차 칸 틱(ㄴ자)은 시트에 칸이 없어 넣지 않았다. 화살표·맨홀·배수구는 가장 가까운 칸에 스냅'),
        layer_log=dict(L.log))


def write_outputs(S, m, seed, write=True):
    town = m['r']['town']; L = m['L']
    img = render(S, L); ref = reference_image(m['r']['base'], town)
    st = stats(S, m, ref, img); st['seed'] = seed
    bad_ids = validate_ids(S, L)
    # 문 접근 칸: Town.doors(원본)와 키트 색인(kit-index 의 access)이 같은 칸을 가리키는지
    kit_access = set()
    for n, p in enumerate(m['placements']):
        if p.get('kid') is None or p['sprite']['k'] != 'bld' or n in m['dropped'] or not p['sprite'].get('front'): continue      # 뒷줄 건물(front=False)의 문은 앞 건물에 가려져 접근 칸이 없다
        for a in S.kit_index[p['kid']]['access']: kit_access.add((p['ox'] + a['dx'], p['oy'] + a['dy']))
    town_access = {c for cells in m['doors'] for c in cells}
    walk = [(x, y) for y in range(H) for x in range(W) if (lambda p: p is not None and any(p.values()))(cell_pass(S, L, y * W + x))]
    st['reachability'] = dict(method='python BFS(collision.ts 규칙을 그대로 옮긴 can_move) — 최종 증명은 tiledata/modern-city/map/check-reach.mts(repo 엔진 canMove)',
                              start=list(m['start']), doors=len(m['doors']), access_cells=len(town_access), unreachable_access_cells=len(m['bad_doors']),
                              walkable_cells=len(walk), reachable_cells=len(m['reach']), walkable_unreachable_cells=sum(1 for c in walk if c not in m['reach']),
                              kit_access_vs_town_doors=dict(only_in_kit=sorted(map(list, kit_access - town_access)), only_in_town=sorted(map(list, town_access - kit_access))))
    st['tile_id_range'] = dict(tileset_count=S.count, out_of_range=len(bad_ids), examples=bad_ids[:5], lower_empty_cells=sum(1 for t in L.lower if t < 0))
    st['audit_compose_town'] = {k: v for k, v in m['r']['audit'].items() if v or k == 'TOTAL'}
    st['compose_stat'] = {k: v for k, v in m['r']['stat'].items() if k != 'note'}
    st['exact_buildings_hook'] = m['r']['exact_stats']
    if not write: return st, img, ref
    os.makedirs(MAP_DIR, exist_ok=True); os.makedirs(SHOT_DIR, exist_ok=True)
    mj = map_json(L, seed)
    plan = dict(seed=seed, start=list(m['start']), roads=dict(rows=list(CT.ROW0), cols=list(CT.COL0), width=CT.RW),
                park=dict(block=list(town.park_tpl[0]), template=town.park_tpl[1]),
                doors=[[list(c) for c in cells] for cells in m['doors']],
                placements=[dict(order=n, kit=p['kid'], at=[p['ox'], p['oy']], size=[p['w'], p['h']], kind=S.kit_index[p['kid']]['kind'], sprite=p['sprite'].get('name'), how=p['how'], diff_px=p.get('diff'), snap_shift_px=list(p['shift']),
                                 dropped=(n in m['dropped'])) for n, p in enumerate(m['placements']) if p.get('kid')],
                marks=[dict(at=[cx, cy], tile=t, kind=k) for cx, cy, t, k in m['marks']])
    errs = MapChecker(S).run(mj, plan)                                       # 저장 전 검사: 하나라도 있으면 아무 파일도 쓰지 않는다
    if errs:
        print(json.dumps(dict(refused=True, errors=len(errs), by_code=dict(collections.Counter(e['code'] for e in errs)), first=errs[:8]), ensure_ascii=False, indent=1))
        raise SystemExit('자동 검사 실패 — 맵을 저장하지 않았다')
    st['self_check'] = dict(errors=0, codes_checked=list(CHECK_CODES))
    json.dump(mj, open(os.path.join(MAP_DIR, f'modern-city-{seed}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(plan, open(os.path.join(MAP_DIR, f'modern-city-{seed}-plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(st, open(os.path.join(MAP_DIR, f'modern-city-{seed}-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    img.convert('RGB').save(os.path.join(SHOT_DIR, f'map-{seed}.png'), optimize=True)
    img.convert('RGB').resize((PX * 2, PX * 2), Image.NEAREST).save(os.path.join(SHOT_DIR, f'map-{seed}-x2.png'), optimize=True)
    ref.convert('RGB').save(os.path.join(SHOT_DIR, f'ref-{seed}.png'), optimize=True)
    d = compare(img, ref); o = np.asarray(img.convert('RGB')).copy(); o[d] = [255, 0, 0]
    Image.fromarray(o).save(os.path.join(SHOT_DIR, f'diff-{seed}.png'), optimize=True)
    # 도달성 그림: 걸을 수 있는데 시작 위치에서 닿지 않는 칸(빨강), 문 접근 칸(초록 테두리), 시작 위치(파랑)
    o = np.asarray(img.convert('RGB')).copy()
    for (cx, cy) in walk:
        if (cx, cy) not in m['reach']: o[cy * T:cy * T + T, cx * T:cx * T + T] = (o[cy * T:cy * T + T, cx * T:cx * T + T] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
    for cells in m['doors']:
        for (cx, cy) in cells: o[cy * T:cy * T + T, cx * T:cx * T + 2] = (0, 255, 0); o[cy * T:cy * T + T, cx * T + T - 2:cx * T + T] = (0, 255, 0); o[cy * T:cy * T + 2, cx * T:cx * T + T] = (0, 255, 0); o[cy * T + T - 2:cy * T + T, cx * T:cx * T + T] = (0, 255, 0)
    sx, sy = m['start']; o[sy * T:sy * T + T, sx * T:sx * T + T] = (0, 120, 255)
    Image.fromarray(o).save(os.path.join(SHOT_DIR, f'reach-{seed}.png'), optimize=True)
    return st, img, ref


# ====================================================================== 자동 좌표 검증(구조·통행만)
SIDEWALK_LABELS = ('보도 포석', '보도 포석(얼룩)')
GREEN_WALK_LABELS = ('공원 잔디', '공원 잔디(변형)', '꽃밭', '벽돌 포장(밝음)', '벽돌 포장(어두움)', '공원 길(모래)')
ROAD_LABELS = ('아스팔트', '아스팔트(얼룩)', '차선 점선(가로, 구형)', '차선 점선(세로, 구형)')
CROSS_LABELS = ('횡단보도(가로 도로 위, 줄 가로)', '횡단보도(세로 도로 위, 줄 세로)')
CURB_PREFIX = ('연석(', '연석 모서리(')

CHECK_CODES = collections.OrderedDict([
    ('tile-out-of-range', '칸 번호가 정의 범위(0..count-1)를 벗어났다(1층은 빈칸 -1 도 금지).'),
    ('layer-mismatch', '맵 3·4층 배열이 배치 목록(키트 id·원점·순서)을 그대로 다시 찍은 결과와 다르다 — 낱칸 편집·잘못된 층·빠진 키트.'),
    ('building-in-lower-layer', '건물·소품 칸(위층 홈, 막힘/★)이 1층(lowerTiles)에 있다. 위층(3층)으로 옮긴다.'),
    ('overlay-in-base-layer', '투명 오버레이 칸(도로 표시·그림자)이 1층에 있다. 아래 땅이 사라져 검게 보인다. 2층(lowerOverlayTiles)으로 옮긴다.'),
    ('ground-in-object-layer', '불투명 땅 칸이 3·4층에 있다. 1층으로 옮긴다.'),
    ('door-access-blocked', '앞줄 건물 문 앞 접근 칸(키트 바깥 한 줄 아래)이 소품·차량·땅 때문에 막혔거나 시작 위치에서 닿지 않는다.'),
    ('door-not-on-sidewalk', '문 앞 접근 칸의 땅이 보도가 아니다.'),
    ('building-on-nonwalk', '건물 밑변 줄의 땅이 보도가 아니다(도로·연석·횡단보도·공원 위에 건물을 얹음).'),
    ('back-over-front', '겹치는 두 건물을 뒷줄(발이 위)이 나중에 찍었다 — 뒷건물이 앞건물 위로 올라온다. 뒤 건물을 먼저 찍는다.'),
    ('marking-in-intersection', '중앙선 칸이 교차로 중심(도로 두 줄이 만나는 6×6)에 들어왔다. 중앙선은 교차로 구간 밖에서 끝낸다.'),
    ('tall-prop-on-road', '키 큰 소품(가로등·신호등·전신주·가로수)의 발밑 칸이 도로·연석·횡단보도 위다. 보도·공원에 둔다.'),
    ('curb-mismatch', '보도·연석 오토타일 규칙(mc-sidewalk-curb)과 다른 연석 칸 — 도로가 있는 쪽의 방향이 맞지 않는다.'),
])


class MapChecker:
    """맵 JSON(4층 배열)과 배치 목록(키트 id·원점·찍은 순서·dropped 여부)만으로 구조·통행을 검사한다.
    검사하지 않는 것: 이벤트 실행·NPC·움직이는 차·미적 품질·낮은 모델의 성공률. 저장 전에 하나라도 오류면 그 맵은 저장하지 않는다."""
    def __init__(self, S):
        self.S = S
        lid = lambda labels: {S.label_id[l] for l in labels}
        self.sidewalk = lid(SIDEWALK_LABELS); self.green = lid(GREEN_WALK_LABELS); self.road = lid(ROAD_LABELS)
        self.cross = lid(CROSS_LABELS)
        self.curb = {i for l, i in S.label_id.items() if l.startswith(CURB_PREFIX)}
        self.marking_center = set(S.group_ids['mc:marking-center']); self.marking_all = set().union(*[set(S.group_ids[g]) for g in ('mc:marking-center', 'mc:marking-stop', 'mc:marking-arrow', 'mc:marking-manhole', 'mc:shadow')])
        self.tall = set(json.load(open(os.path.join(ROOT, 'tiledata/modern-city/bake-report.json'), encoding='utf-8'))['tall_props'])
        at = S.d['autotileGroups'][0]; self.at_member = set(at['memberTileIds']); self.at_conn = set(at['connectTileIds']); self.at_map = at['variantMap']

    def restamp(self, plan, order=None):
        L = Layers()
        pls = plan['placements']; seq = order if order is not None else range(len(pls))
        for n in seq:
            p = pls[n]
            if p.get('dropped'): continue
            stamp_kit(self.S, L, p['kit'], p['at'][0], p['at'][1], n)
        return L

    def run(self, mj, plan):
        S = self.S; errs = []
        def err(code, x, y, kit=None, **kw): errs.append(dict(code=code, x=x, y=y, kit=kit, **kw))
        w, h = mj['width'], mj['height']
        layers = dict(lower=mj['lowerTiles'], lo2=mj.get('lowerOverlayTiles') or [-1] * (w * h), upper=mj['upperTiles'], up4=mj.get('upperOverlayTiles') or [-1] * (w * h))
        # 1 범위
        for nm, arr in layers.items():
            for i, t in enumerate(arr):
                if (t == -1 and nm != 'lower') : continue
                if not (0 <= t < S.count): err('tile-out-of-range', i % w, i // w, layer=nm, tile=t)
        if errs: return errs
        # 2 키트를 다시 찍은 결과와 비교
        exp = self.restamp(plan)
        for i in range(w * h):
            if exp.upper[i] != layers['upper'][i] or exp.up4[i] != layers['up4'][i]:
                err('layer-mismatch', i % w, i // w, expected=[exp.upper[i], exp.up4[i]], found=[layers['upper'][i], layers['up4'][i]])
        # 3 층별 홈
        for i, t in enumerate(layers['lower']):
            if t < 0: continue
            m = S.d['tileMeta'][t]; x, y = i % w, i // w
            if t in self.marking_all: err('overlay-in-base-layer', x, y, tile=t)
            elif S.d['priority'][t] == 'upper': err('building-in-lower-layer', x, y, tile=t)
        for nm in ('upper', 'up4'):
            for i, t in enumerate(layers[nm]):
                if t >= 0 and S.d['priority'][t] == 'lower' and t not in self.marking_all and S.d['tileMeta'][t].get('passage') != 'star' and S.d['tileMeta'][t].get('defaultLayer') == 'lower':
                    err('ground-in-object-layer', i % w, i // w, tile=t, layer=nm)
        # 4 건물 위치·문
        pls = plan['placements']
        L = Layers(); L.lower = list(layers['lower']); L.lo2 = list(layers['lo2']); L.upper = list(layers['upper']); L.up4 = list(layers['up4'])
        for n, p in enumerate(pls):                                                           # 소유 정보(통행 걸림돌 판정용)
            if p.get('dropped'): continue
        own = Layers()
        for n in range(len(pls)):
            if not pls[n].get('dropped'): stamp_kit(S, own, pls[n]['kit'], pls[n]['at'][0], pls[n]['at'][1], n)
        L.own3, L.own4 = own.own3, own.own4
        start = tuple(plan['start'])
        reach = reachable(S, L, start) if (w, h) == (W, H) and cell_pass(S, L, start[1] * W + start[0]) else set()
        blds = [(n, p) for n, p in enumerate(pls) if S.kit_index[p['kit']]['kind'] == 'building' and not p.get('dropped')]
        for n, p in blds:
            ox, oy = p['at']; bw, bh = p['size']
            for dx in range(bw):                                                              # 밑변 줄의 땅
                t = layers['lower'][(oy + bh - 1) * w + ox + dx] if 0 <= oy + bh - 1 < h and 0 <= ox + dx < w else -1
                if S.kits[p['kit']]['rows'][bh - 1]['upperTiles'][dx] >= 0 and t not in self.sidewalk:
                    err('building-on-nonwalk', ox + dx, oy + bh - 1, p['kit'], tile=t)
            for a in S.kit_index[p['kit']]['access']:
                ax, ay = ox + a['dx'], oy + a['dy']
                if not (0 <= ax < w and 0 <= ay < h): err('door-access-blocked', ax, ay, p['kit'], why='맵 밖'); continue
                i = ay * w + ax
                o = blocker(S, L, i)
                hidden_by_building = o >= 0 and S.kit_index[pls[o]['kit']]['kind'] == 'building' and o != n    # 뒷줄 건물의 문: 앞 건물에 가려져 문 앞이 없다(정상)
                if hidden_by_building: continue
                if layers['lower'][i] not in self.sidewalk: err('door-not-on-sidewalk', ax, ay, p['kit'], tile=layers['lower'][i])
                if (ax, ay) not in reach: err('door-access-blocked', ax, ay, p['kit'], why='막힘' if cell_pass(S, L, i) is None or not any(cell_pass(S, L, i).values()) else '시작 위치에서 닿지 않음',
                                              blocker=pls[o]['kit'] if o >= 0 else None)
        # 5 겹치는 건물의 찍는 순서
        for a_i in range(len(blds)):
            for b_i in range(a_i + 1, len(blds)):
                (na, pa), (nb, pb) = blds[a_i], blds[b_i]
                ax0, ay0 = pa['at']; aw, ah = pa['size']; bx0, by0 = pb['at']; bw, bh = pb['size']
                ox0, ox1 = max(ax0, bx0), min(ax0 + aw, bx0 + bw); oy0, oy1 = max(ay0, by0), min(ay0 + ah, by0 + bh)
                if ox0 >= ox1 or oy0 >= oy1: continue
                fa, fb = ay0 + ah, by0 + bh
                if fa == fb: continue
                first, later = (pa, pb) if na < nb else (pb, pa)
                if (first['at'][1] + first['size'][1]) > (later['at'][1] + later['size'][1]):       # 앞줄(발이 아래)이 먼저 찍혔다 → 뒷줄이 위로 올라온다
                    err('back-over-front', ox0, oy0, later['kit'], front=first['kit'], overlap=[ox0, oy0, ox1 - 1, oy1 - 1])
        # 6 교차로 중심의 중앙선
        rows, cols, rw = plan['roads']['rows'], plan['roads']['cols'], plan['roads']['width']
        for r in rows:
            for c in cols:
                for y in range(r, r + rw):
                    for x in range(c, c + rw):
                        if layers['lo2'][y * w + x] in self.marking_center: err('marking-in-intersection', x, y, tile=layers['lo2'][y * w + x])
        # 7 키 큰 소품의 발
        for n, p in enumerate(pls):
            if p.get('dropped') or p['kit'] not in self.tall: continue
            ox, oy = p['at']; bw, bh = p['size']
            for dx in range(bw):
                if S.kits[p['kit']]['rows'][bh - 1]['upperTiles'][dx] < 0: continue
                x, y = ox + dx, oy + bh - 1
                if 0 <= x < w and 0 <= y < h and layers['lower'][y * w + x] not in (self.sidewalk | self.green): err('tall-prop-on-road', x, y, p['kit'], tile=layers['lower'][y * w + x])
        # 8 연석 오토타일
        low = layers['lower']
        for y in range(h):
            for x in range(w):
                t = low[y * w + x]
                if t not in self.at_member: continue
                def c(dx, dy): return True if not (0 <= x + dx < w and 0 <= y + dy < h) else low[(y + dy) * w + x + dx] not in (self.road | self.cross)    # 연석은 도로·횡단보도 쪽에만 선다(공원·생울타리 쪽은 보도와 같다)
                mask = (1 if c(0, -1) else 0) | (2 if c(1, 0) else 0) | (4 if c(0, 1) else 0) | (8 if c(-1, 0) else 0)
                if self.at_map[str(mask)] != t: err('curb-mismatch', x, y, tile=t, expected=self.at_map[str(mask)])
        return errs


def run_check(path):
    path = os.path.abspath(os.path.join(CWD0, path))
    S = Sheet(); mj = json.load(open(path, encoding='utf-8'))
    plan_path = path.replace('.json', '-plan.json')
    plan = json.load(open(plan_path, encoding='utf-8'))
    errs = MapChecker(S).run(mj, plan)
    by = collections.Counter(e['code'] for e in errs)
    print(json.dumps(dict(map=path, errors=len(errs), by_code=dict(by), first=errs[:10]), ensure_ascii=False, indent=1))
    return errs


# ====================================================================== 지역(번들 배포)
PLACE_ID = 'modern-city-60x60'
REGION_DIR = os.path.join(ROOT, 'public/assets/region-references')
TEMPLATE_DOWNLOAD = os.path.join(REGION_DIR, 'interior-inn-tavern-1f.oprn.json')       # 기본 프로젝트 몸체(데이터베이스·시스템·세션)를 빌려 온다


def publish(S, m, seed, st, img):
    """번들 지역으로 내보낸다: 내려받기(.oprn.json) + 미리보기 PNG + 스냅샷 JSON + 장소 목록 TS.
    등록은 TS 두 줄(regionReferences.ts 의 import·PLACE_REFERENCES 펼침, regionReferenceSnapshots.ts 의 SNAPSHOT_FILES 한 줄)이 따로 있어야 한다."""
    L = m['L']; mj = map_json(L, seed); mj['id'] = 'modern-city-example'; mj['name'] = '현대 도시 · 도쿄풍 예제 거리'
    d = S.d
    refs_path = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
    tileset = dict(id=d['id'], name=d['name'], image=dict(type='bundled', id=d['textureKey']), kind='custom', family=d['family'], tileSize=d['tileSize'], tilesPerRow=d['tilesPerRow'], count=d['count'],
                   passability=d['passability'], priority=d['priority'], terrain=d['terrain'], tileMeta=d['tileMeta'], tileGroups=d['tileGroups'], autotileGroups=d['autotileGroups'],
                   animationStrips=d['animationStrips'], structureKits=d['structureKits'], referenceDocuments=json.load(open(refs_path, encoding='utf-8')) if os.path.exists(refs_path) else [])
    proj = json.load(open(TEMPLATE_DOWNLOAD, encoding='utf-8'))
    proj['meta']['title'] = mj['name']
    proj['tilesets'] = {d['id']: tileset}
    proj['maps'] = {mj['id']: mj}
    proj['mapTree'] = dict(mapId=mj['id'], children=[])
    proj['startMapId'] = mj['id']; proj['startPos'] = dict(x=m['start'][0], y=m['start'][1])
    proj['mapConnections'] = []
    json.dump(proj, open(os.path.join(REGION_DIR, 'modern-city.oprn.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    img.convert('RGB').save(os.path.join(REGION_DIR, 'modern-city.png'), optimize=True)
    slim = dict(id=d['id'], image=dict(type='bundled', id=d['textureKey']), tileSize=d['tileSize'], tilesPerRow=d['tilesPerRow'], count=d['count'], passability=d['passability'], priority=d['priority'], terrain=d['terrain'])
    snap_dir = os.path.join(ROOT, 'src/project/regionReferences'); os.makedirs(snap_dir, exist_ok=True)
    json.dump(dict(map=mj, tileset=slim), open(os.path.join(snap_dir, 'modern-city.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    b = st['buildings']; r = st['reachability']; pv = st['props_vehicles']
    entry = dict(
        id=PLACE_ID, name='현대 도시 · 도쿄풍 예제 거리', kind='completed-place', placeKind='settlement', revision=1, x=0, y=0, width=W, height=H, tilesetId=d['id'],
        preview='/assets/region-references/modern-city.png', tilesetPreview='/assets/modern-city/modern-city-chipset.png', projectDownload='/assets/region-references/modern-city.oprn.json',
        sourceProjectId='oprn-bundled-modern-city', sourceMapId=mj['id'], snapshotProjectId='oprn-place-modern-city-v1',
        rules=[
            f'가로 도로 둘·세로 도로 하나(6칸 폭, 노란 이중 중앙선)가 만나는 60×60칸 도시 거리. 교차로마다 횡단보도 네 곳·정지선·직진 화살표가 있고 도로 위 차량은 정차 그림이다. 공원 한 곳(분수·연못·화단·벽돌 광장)과 건물 {b["count"]}채.',
            '건물은 모두 키트 하나를 통째로 3층(upperTiles)에 찍었다(변형 대체 0, 키트 그림과 화소 일치). 뒷줄 건물이 먼저, 앞줄이 나중이라 앞줄 지붕이 뒷줄 몸통 아래를 덮는다. 문 앞 한 줄 아래 칸은 모두 보도다.',
            '땅(아스팔트·보도·연석·횡단보도·공원)은 1층, 도로 표시·접지 그림자는 2층(lowerOverlayTiles), 소품·차량은 3층이고 한 칸에 둘이 겹칠 때만 4층. 사람(Actor1)·전선은 타일이 아니라 넣지 않았다.',
            f'시작 위치 ({m["start"][0]},{m["start"][1]})에서 문 앞 접근 칸 {r["access_cells"]}곳 모두 런타임 이동 규칙(canMove)으로 닿는 것을 확인했다. 소품·차량이 접근 칸 길을 막는 {len(pv["moved"])}곳은 한 칸 옮기고 {len(pv["dropped"])}곳은 뺐다.',
            '공용 AI 문서 「현대 도시 · 완성 예제」에 배치 목록·네 층 전체 배열이, 「조립 정답」에 건물·도로 키트 배열이 있다.'],
        limitations='지형·건물·소품 배치 참고 사례. 움직이는 차·행인·문 이동·NPC 이벤트는 포함하지 않는다. 소품·차량은 16px 칸에 맞춰 원본 그림에서 최대 8px 옮겨 앉았고 연석 주차 칸 표시(ㄴ자 틱)는 칸이 없어 뺐다. 자동 생성 프리셋이 아니다.')
    ts = ('// Generated by src/harnesses/modern-chipset/bake_map.py --publish. The modern city example under 장소; snapshot in regionReferences/modern-city.json.\n'
          'export const MODERN_CITY_PLACE_REFERENCES = ' + json.dumps([entry], ensure_ascii=False, indent=2) + ' as const;\n')
    open(os.path.join(ROOT, 'src/project/modernCityPlaceReferences.ts'), 'w', encoding='utf-8').write(ts)
    return dict(download=os.path.getsize(os.path.join(REGION_DIR, 'modern-city.oprn.json')), preview=os.path.getsize(os.path.join(REGION_DIR, 'modern-city.png')),
                snapshot=os.path.getsize(os.path.join(snap_dir, 'modern-city.json')))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--no-write', action='store_true')
    ap.add_argument('--raw', action='store_true', help='건물 끼움 장치를 끈다(compose_town 그대로: 벽색 변형·옥상 설비가 시트와 어긋날 수 있다)')
    ap.add_argument('--publish', action='store_true', help='번들 지역(public/assets/region-references/modern-city.*·regionReferences/modern-city.json·modernCityPlaceReferences.ts)도 쓴다')
    ap.add_argument('--check', metavar='MAP_JSON', help='맵 JSON 하나를 자동 좌표 검증(옆의 -plan.json 필요)하고 끝낸다')
    ap.add_argument('--no-fix', action='store_true', help='접근 칸을 막은 소품 치우기를 끈다(진단용)')
    a = ap.parse_args()
    if a.check: raise SystemExit(1 if run_check(a.check) else 0)
    S = Sheet(); KI = KitIndex(S)
    m = make_map(S, KI, a.seed, fix=not a.no_fix, exact=not a.raw)
    st, _img, _ref = write_outputs(S, m, a.seed, write=not a.no_write)
    if a.publish and not a.no_write: print('publish', publish(S, m, a.seed, st, _img))
    print(json.dumps({k: v for k, v in st.items() if k not in ('buildings', 'props_vehicles')}, ensure_ascii=False, indent=1))
    b = st['buildings']; print('buildings', {k: v for k, v in b.items() if k != 'per_building'}); print('props', {k: v for k, v in st['props_vehicles'].items() if k not in ('substituted',)})


if __name__ == '__main__':
    main()

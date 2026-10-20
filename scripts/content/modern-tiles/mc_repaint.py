#!/usr/bin/env python3
"""modern_city 마지막 다시 칠하기 굽기 — 바닥·연석·측구·점자 블록·잔디·가로수·평지붕·처마 그늘·건물 그림자/기초 (2026-10-20 승인 시안).

  python3 scripts/content/modern-tiles/mc_repaint.py [--dry]     # 굽기(시트·정의·소유 기록)
  python3 scripts/content/modern-tiles/mc_repaint.py gate        # 3/4 관문에 낼 PNG·items.jsonl 만 쓴다(판정은 감독이 돌린다)

왜 제자리인가: 칸 번호가 같아야 이미 저장된 맵이 저절로 새 그림을 받는다. 그래서
  · 바닥(아스팔트·보도·연석·횡단보도·도로 표시 칸·잔디)·그림자 칸은 번호 그대로 다시 칠한다(직접 지정 목록 DIRECT).
  · 키트 칸(가로수 4종·건물 259종)은 키트마다 새 그림을 만들고, 칸 번호마다 «그 번호를 쓰는 모든 자리»가 원하는 그림을 모아
    가장 많은 그림으로 제자리 칠, 나머지 자리는 새 칸을 덧붙여 그 키트 격자만 옮긴다(repoint). 범위 밖 키트가 같은 번호를 쓰면
    그 자리는 «옛 그림»을 원하는 표로 센다(옛 그림이 이기면 칠하지 않는다).
  · 새 조각(아스팔트·보도·잔디 변형, 잔디 경계석, 측구, 점자 블록, 건물 기초·그림자 오버레이, 나무 구덩이 가로수)은 끝에 덧붙인다.
번호 고정: 처음 굽기 때 칠할 번호의 «옛 그림»을 tiledata/modern-city/modern-tiles/originals.png 에 떠 두고, 다시 구울 때는 그 사본에서
그린다(같은 입력 → 같은 시트). 덧붙인 칸은 내용 키 → 번호를 manifest.json 에 적어 같은 번호를 다시 쓴다.
검사: 칠하거나 덧붙인 번호 말고는 시트 화소가 하나도 바뀌지 않았는지 끝에서 확인한다.

순서: bake_tileset.py(거리) → bake_interior → bake_green → bake_anim → 이 파일(맨 끝). 주의: 2026-10-20 지금 bake_tileset.py main 전체
사슬은 R10 이후 실내 칸(핀에 없는 12263..13813)을 떨어뜨리므로 돌리지 않는다 — 이 파일은 지금 시트 위에서 따로 돈다.
"""
import collections
import hashlib
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import art_dress as AD     # noqa: E402
import art_ground as G     # noqa: E402
import art_roof as AR      # noqa: E402
import art_tree as AT      # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
OUT = os.path.join(ROOT, 'tiledata/modern-city/modern-tiles')
ORIG_PNG = os.path.join(OUT, 'originals.png')
ORIG_JSON = os.path.join(OUT, 'originals.json')
MANIFEST = os.path.join(OUT, 'manifest.json')
GATE = os.path.join(OUT, '_gate')
T = 16

TREE_KITS = list(AT.TREES)
PIT_KITS = {k: k.replace('mc-prop-street-tree-', 'mc-prop-street-tree-pit-').replace('mc-prop-keyaki-', 'mc-prop-keyaki-pit-') for k in TREE_KITS}


def key_of(im, pc=''):
    a = np.array(im.convert('RGBA')); a[a[:, :, 3] == 0] = 0
    return hashlib.sha1(a.tobytes() + b'|' + pc.encode()).hexdigest()[:24]


def norm(im):
    a = np.array(im.convert('RGBA')); a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, 'RGBA')


class Sheet:
    def __init__(self, path, tpr):
        self.im = Image.open(path).convert('RGBA'); self.tpr = tpr

    def xy(self, t):
        return (t % self.tpr) * T, (t // self.tpr) * T

    def get(self, t):
        x, y = self.xy(t)
        if y + T > self.im.height:
            return Image.new('RGBA', (T, T))
        return self.im.crop((x, y, x + T, y + T))

    def put(self, t, cell):
        x, y = self.xy(t)
        if y + T > self.im.height:
            big = Image.new('RGBA', (self.im.width, y + T)); big.paste(self.im, (0, 0)); self.im = big
        self.im.paste(Image.new('RGBA', (T, T)), (x, y)); self.im.paste(norm(cell), (x, y))


class Originals:
    """처음 굽기의 옛 칸 그림·옛 키트 격자 사본."""
    def __init__(self, sheet, data):
        self.sheet = sheet
        self.meta = json.load(open(ORIG_JSON)) if os.path.exists(ORIG_JSON) else {'ids': [], 'kits': {}}
        self.idx = {t: i for i, t in enumerate(self.meta['ids'])}
        self.strip = Image.open(ORIG_PNG).convert('RGBA') if os.path.exists(ORIG_PNG) else None
        self.new = {}
        self.kits_now = {k['id']: k for k in data['structureKits']}

    def cell(self, t):
        if t in self.idx:
            i = self.idx[t]; x, y = (i % 48) * T, (i // 48) * T
            return self.strip.crop((x, y, x + T, y + T))
        if t not in self.new:
            self.new[t] = self.sheet.get(t)
        return self.new[t]

    def rows(self, kid):
        if kid in self.meta['kits']:
            return self.meta['kits'][kid]
        rows = json.loads(json.dumps(self.kits_now[kid]['rows']))
        self.meta['kits'][kid] = rows
        return rows

    def kit_image(self, kid, layer='upperTiles'):
        k = self.kits_now[kid]; rows = self.rows(kid)
        out = Image.new('RGBA', (k['width'] * T, k['height'] * T))
        for r, row in enumerate(rows):
            for c, t in enumerate(row.get(layer) or []):
                if t is not None and t >= 0:
                    out.alpha_composite(self.cell(t), (c * T, r * T))
        return out

    def save(self):
        ids = self.meta['ids'] + sorted(t for t in self.new if t not in self.idx)
        strip = Image.new('RGBA', (48 * T, math.ceil(len(ids) / 48) * T))
        for i, t in enumerate(ids):
            strip.paste(self.cell(t), ((i % 48) * T, (i // 48) * T))
        self.meta['ids'] = ids
        os.makedirs(OUT, exist_ok=True)
        strip.save(ORIG_PNG, optimize=True)
        json.dump(self.meta, open(ORIG_JSON, 'w'), ensure_ascii=False, separators=(',', ':'))


def cut(im):
    W, H = im.size
    return [[im.crop((x * T, y * T, x * T + T, y * T + T)) for x in range(W // T)] for y in range(H // T)]


def empty(c):
    return not np.asarray(c)[:, :, 3].any()


# ====================================================================== 바닥 직접 지정
CURB_KIND = {9: 'S', 10: 'N', 11: 'E', 12: 'W', 13: 'SE', 14: 'SW', 15: 'NE', 16: 'NW'}
MARKED = [3, 4, 5, 6] + list(range(77, 93))
OVERLAY_MARKED = list(range(25, 49))     # 겹층 표시 칸(투명 바탕): 중앙선 25–36 · 정지선/띠 37–48 — r2 에서 같은 굵기로


def ground_direct(orig):
    """번호 → (16×16 목록 그림, 설명). 표시가 구워진 도로 칸은 옛 표시 모양 그대로 새 아스팔트·페인트로."""
    d = {1: (G.asphalt(0), '아스팔트'), 2: (G.asphalt(5), '아스팔트(결 배치 2)'), 7: (G.sidewalk(0), '보도'), 8: (G.sidewalk(1), '보도(둘째 톤 판)'),
         17: (G.grass(0), '잔디'), 18: (G.grass(1), '잔디(덩이 배치 2)')}
    for t, k in CURB_KIND.items():
        d[t] = (G.curb(k, 0), f'연석 {k}')
    for i, t in enumerate(MARKED):
        d[t] = (G.paint_marks(orig.cell(t), var=(0, 5, 6, 7)[i % 4], seed=t), '도로 표시')
    for t in OVERLAY_MARKED:
        d[t] = (G.paint_marks(orig.cell(t), seed=t, overlay=True), '도로 표시(겹층)')
    return d


def shadow_direct(orig):
    d = {57: (AD.east_mid(), '건물 그림자 동쪽'), 58: (None, '건물 그림자 남쪽'), 59: (AD.south_east(), '건물 그림자 남동')}
    a = np.zeros((T, T, 4), np.uint8)
    for y in range(6):
        for x in range(T):
            a[y, x, :3] = AD.SH; a[y, x, 3] = AD.A_IN if y < 2 else AD.A_OUT
    d[58] = (Image.fromarray(a, 'RGBA'), d[58][1])
    for t in range(60, 77):
        d[t] = (AD.restyle_prop_shadow(orig.cell(t)), '소품 그림자')
    return d


# ====================================================================== 키트 새 그림
def building_new(orig, kid):
    im = orig.kit_image(kid)
    stem = kid.split('-roof-')[0].replace('-ochre', '')
    new, info = AR.reroof(im, stem)
    if new is None:
        return AR.eave_and_seam(im, -99), dict(skip=info)
    return AR.eave_and_seam(new, info['eave']), info


def main(dry=False, gate_only=False):
    data = json.load(open(DEF, encoding='utf-8'))
    tpr = data['tilesPerRow']
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    base_count = man.get('baseCount', data['count'])
    sheet = Sheet(PNG, tpr)
    before = sheet.im.copy()
    orig = Originals(sheet, data)
    K = orig.kits_now
    passab, prio, tmeta = data['passability'], data['priority'], data['tileMeta']

    repaint = {}          # id -> (img, why)
    appended = {}         # key -> dict(img, pc_src, label, kind)
    prev_app = man.get('appended', {})
    next_id = [max([base_count] + [v + 1 for v in prev_app.values()])]
    app_ids = {}

    legacy_groups = {g['id']: g['tileIds'] for g in data['tileGroups']}

    def append(img, src, label, group, key_extra='', slot=None, legacy=None):
        """slot 이 있으면 그림 내용이 아니라 자리 이름(묶음#순번)으로 번호를 잇는다 — 그림을 다시 그려도 번호가 그대로다.
        처음 slot 을 쓰는 판에서는 지금 정의의 같은 묶음·순번 번호를 물려받는다(옛 내용 열쇠에서 옮김)."""
        k = ('slot:' + slot) if slot else key_of(img, str(src) + key_extra)
        if k not in app_ids:
            taken = set(app_ids.values())
            tid = prev_app.get(k)
            if tid in taken:
                tid = None
            if tid is None and slot and legacy is not None and legacy >= base_count and legacy not in taken:
                tid = legacy
            if tid is None and slot and '#' in slot:
                gid, i = slot.rsplit('#', 1)
                lg = legacy_groups.get(gid) or []
                if int(i) < len(lg) and lg[int(i)] >= base_count:
                    tid = lg[int(i)]
            if tid is not None and tid in taken:
                tid = None
            if tid is None:
                tid = next_id[0]; next_id[0] += 1
            app_ids[k] = tid
            appended[k] = dict(img=norm(img), src=src, label=label, group=group, id=tid)
        return app_ids[k]

    # ---- 1. 바닥·그림자 직접 지정
    gd = ground_direct(orig)
    gimg = {t: G.to_img(v[0]) for t, v in gd.items()}
    for t, im in list(gimg.items()):
        repaint[t] = (im, gd[t][1])
    for t, (im, why) in shadow_direct(orig).items():
        repaint[t] = (im, why)
    DIRECT = set(repaint)

    cur_rows0 = {k['id']: k['rows'] for k in data['structureKits']}   # 지금 정의(지난 판 번호) — 자리 이름 첫 판 물려받기용
    # ---- 2. 키트 새 그림(자리마다)
    want = collections.defaultdict(list)      # id -> [(kid, r, c, layer, img or None)]
    roof_info = {}
    newimg = {}
    for kid in TREE_KITS:
        newimg[kid] = AT.tree_kit_image(kid, pit=False)
    for kid in sorted(k for k in K if k.startswith('mc-bld-')):
        im, info = building_new(orig, kid); newimg[kid] = im; roof_info[kid] = info
    scope = set(newimg)
    lost = []
    for kid in scope:
        rows = orig.rows(kid); cells = cut(newimg[kid])
        for r, row in enumerate(rows):
            for c, t in enumerate(row.get('upperTiles') or []):
                if t is None or t < 0:
                    if not empty(cells[r][c]):
                        lost.append(f'{kid} ({c},{r})')
                    continue
                want[t].append((kid, r, c, 'upperTiles', cells[r][c]))
    touched = set(want) - DIRECT
    for k in K.values():          # 범위 밖 키트의 같은 번호 = 옛 그림을 원한다
        if k['id'] in scope or k['id'] in PIT_KITS.values():
            continue
        for r, row in enumerate(orig.rows(k['id']) if k['id'] in orig.meta['kits'] else k['rows']):
            for ly in ('tiles', 'upperTiles'):
                for c, t in enumerate(row.get(ly) or []):
                    if t in touched:
                        want[t].append((k['id'], r, c, ly, None))
    repoint = collections.defaultdict(list)    # kid -> [(r, ly, c, new_id)]
    stats = collections.Counter()
    for t in sorted(touched):
        okey = key_of(orig.cell(t))
        groups = collections.OrderedDict()
        for kid, r, c, ly, im in want[t]:
            kk = okey if im is None else key_of(im)
            groups.setdefault(kk, dict(img=im if im is not None else orig.cell(t), uses=[]))['uses'].append((kid, r, c, ly))
        # 동률이면 지난 판에 이 번호를 제자리로 쓰던 무리가 이긴다(r3) — 그림을 고칠 때마다 이긴 무리가 바뀌어 번호가 출렁이지 않게
        def held(kk):
            return any(kid in cur_rows0 and cur_rows0[kid][r][ly][c] == t for kid, r, c, ly in groups[kk]['uses'])
        best = max(groups, key=lambda kk: (len(groups[kk]['uses']), held(kk), kk != okey, kk))
        if best != okey:
            repaint[t] = (groups[best]['img'], 'kit')
            stats['kit_inplace'] += 1
        for kk, g in groups.items():
            if kk == best:
                continue
            if kk == okey:
                nid = append(g['img'], t, (tmeta[t] or {}).get('label', ''), 'kit-copy', key_extra='')
            else:   # r3: 새 그림 무리는 «자리 이름»(그 무리의 가장 앞 자리)으로 번호를 잇는다 → 지붕을 다시 그려도 번호가 그대로
                ukid, ur, uc, uly = min(g['uses'])
                taken = set(app_ids.values())
                leg = next((v for v in (cur_rows0[a][b][d][e] for a, b, e, d in sorted(g['uses'])) if v >= base_count and v not in taken), None)
                nid = append(g['img'], t, (tmeta[t] or {}).get('label', ''), 'kit', slot=f'kit:{t}:{ukid}:{ur}:{uc}:{uly}', legacy=leg)
            stats['kit_appended_uses'] += len(g['uses'])
            for kid, r, c, ly in g['uses']:
                repoint[kid].append((r, ly, c, nid))

    # ---- 3. 새 조각(덧붙임)
    groups_new = collections.OrderedDict()

    def add_group(gid, ids):
        groups_new.setdefault(gid, [])
        for i in ids:
            if i not in groups_new[gid]:
                groups_new[gid].append(i)
    asph = [1, 2] + [append(G.to_img(G.asphalt(v)), 1, '아스팔트(' + G.ASPHALT_VARIANTS[v] + ')', 'mc:asphalt', slot=f'mc:asphalt#{i + 2}') for i, v in enumerate((1, 6, 7, 2, 3, 4))]
    add_group('mc:asphalt', asph)
    pav = [7, 8] + [append(G.to_img(G.sidewalk(v)), 7, '보도(' + G.SIDEWALK_VARIANTS[v] + ')', 'mc:paving', slot=f'mc:paving#{i + 2}') for i, v in enumerate((5, 6, 2, 3, 4))]
    add_group('mc:paving', pav)
    grs = [17, 18] + [append(G.to_img(G.grass(v)), 17, '잔디(' + G.GRASS_VARIANTS[v] + ')', 'mc:grass', slot=f'mc:grass#{i + 2}') for i, v in enumerate((5, 6, 2, 3, 4))]
    add_group('mc:grass', grs)
    add_group('mc:grass-edge-s', [append(G.to_img(G.grass_edge_south(v)), 17, '잔디 끝 경계석(남쪽이 보도)', 'mc:grass-edge', slot=f'mc:grass-edge-s#{i}') for i, v in enumerate((0, 1, 5))])
    add_group('mc:paving-under-grass', [append(G.to_img(G.sidewalk_under_grass(v)), 7, '보도(북쪽 잔디 경계석 그늘)', 'mc:grass-edge', slot=f'mc:paving-under-grass#{i}') for i, v in enumerate((0, 1, 5))])
    add_group('mc:grass-edge-n', [append(G.to_img(G.grass_edge_north(v)), 17, '잔디 끝 경계석(북쪽이 보도)', 'mc:grass-edge', slot=f'mc:grass-edge-n#{i}') for i, v in enumerate((0, 1))])
    tac = append(G.to_img(G.tactile()), 7, '점자 블록(횡단보도 앞)', 'mc:tactile', slot='mc:tactile#0')
    add_group('mc:tactile', [tac])

    # 측구 — 도로 키트 자리마다(바탕 칸의 새 그림 위에 측구)
    def gut(base, side, ext=None, legacy=None):
        t = G.from_img(gimg[base] if base in gimg else orig.cell(base))
        G.gutter_overlay(t, side, ext)
        return append(G.to_img(t), base, f'측구({side}) — 연석 곁 차도', 'mc:gutter', key_extra=side + repr(ext),
                      slot=f'gut:{base}:{side}:{ext}', legacy=legacy)
    GUT = {
        'mc-street-ew-section': [(3, 0, 'N', None), (8, 0, 'S', None)],
        'mc-street-ns-section': [(0, 3, 'W', None), (0, 8, 'E', None)],
        'mc-intersection-12x12': [(3, 0, 'N', None), (3, 1, 'N', None), (3, 2, 'N', (0, 6)), (3, 9, 'N', (10, 16)), (3, 10, 'N', None), (3, 11, 'N', None),
                                  (8, 0, 'S', None), (8, 1, 'S', None), (8, 2, 'S', (0, 6)), (8, 9, 'S', (10, 16)), (8, 10, 'S', None), (8, 11, 'S', None),
                                  (0, 3, 'W', None), (1, 3, 'W', None), (2, 3, 'W', (0, 6)), (9, 3, 'W', (10, 16)), (10, 3, 'W', None), (11, 3, 'W', None),
                                  (0, 8, 'E', None), (1, 8, 'E', None), (2, 8, 'E', (0, 6)), (9, 8, 'E', (10, 16)), (10, 8, 'E', None), (11, 8, 'E', None)],
    }
    gut_ids = []
    cur_rows = {k['id']: k['rows'] for k in data['structureKits']}   # 지금 정의(지난 판 측구 번호) — slot 첫 판 물려받기용
    for kid, spots in GUT.items():
        rows = orig.rows(kid)
        for r, c, side, ext in spots:
            base = rows[r]['tiles'][c]
            nid = gut(base, side, ext, legacy=cur_rows[kid][r]['tiles'][c]); gut_ids.append(nid)
            repoint[kid].append((r, 'tiles', c, nid))
    for (r, c) in ((1, 1), (1, 10), (10, 1), (10, 10)):
        repoint['mc-intersection-12x12'].append((r, 'tiles', c, tac))
    add_group('mc:gutter', gut_ids)

    # 건물 그림자·기초 오버레이(키트 ai.dress)
    e_top = append(AD.east_top(), 57, '건물 그림자 동쪽(시작)', 'mc:dress')
    dress = {}
    dress_ids = [57, 58, 59, e_top]
    for kid in sorted(k for k in scope if k.startswith('mc-bld-')):
        k = K[kid]; w, h = k['width'], k['height']
        res = AD.plinth_row(newimg[kid], with_sig=True)
        if res is None:
            continue
        cells, sigs = res
        prev_d = {(e[0], e[1]): e[2] for e in (k.get('ai') or {}).get('dress') or []}
        lst = []
        for c, cell in enumerate(cells):   # r3: 입력(밑변 벽/문 열·끝 자리) 서명으로 번호를 잇는다 → 기초 그림을 고쳐도 번호가 그대로
            nid = append(cell, 58, '건물 기초·접촉선·남쪽 그늘(2층)', 'mc:dress', slot='dress:' + sigs[c], legacy=prev_d.get((c, h)))
            lst.append([c, h, nid]); dress_ids.append(nid)
        r0 = max(1, math.ceil(h * 0.35))
        for r in range(r0, h):
            lst.append([w, r, e_top if r == r0 else 57])
        lst.append([w, h, 59])
        dress[kid] = lst
    add_group('mc:dress', dress_ids)

    # 나무 구덩이 가로수(보도용 새 키트)
    pit_kits = []
    tree_ids = []
    for kid in TREE_KITS:
        im = AT.tree_kit_image(kid, pit=True); w, h = im.width // T, im.height // T
        cells = cut(im); rows = []
        plain = cut(newimg[kid])
        for y in range(h):
            row = []
            for x in range(w):
                c = cells[y][x]
                if empty(c):
                    row.append(-1); continue
                src_id = orig.rows(kid)[y]['upperTiles'][x]
                if key_of(c) == key_of(plain[y][x]):
                    row.append(src_id)
                else:
                    row.append(append(c, src_id, f'{K[kid]["name"]} 나무 구덩이 ({x + 1},{y + 1})', 'mc:prop:tree-pit'))
            rows.append(row)
        tree_ids += [t for r in rows for t in r if t >= 0]
        base = K[kid]
        pit_kits.append(dict(id=PIT_KITS[kid], kind='section', name=base['name'] + '(보도 나무 구덩이)', width=w, height=h, tileSize=16,
                             rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                             ai=dict(description=(base['ai'].get('description', '') + ' 보도용: 줄기 밑에 콘크리트 테 나무 구덩이(흙).')[:400],
                                     placementRules='보도에 세운다. 맨 아랫줄 가운데(줄기)가 보도 칸에 서고 수관은 위로. 위층에 키트째 찍는다.',
                                     tags=list(base['ai'].get('tags', [])) + ['보도', '나무 구덩이'], role='prop', repeatability='fixed', layerHome='upper',
                                     themes=['현대 도시'], origin='ai', confidence='high')))
    add_group('mc:prop:tree-pit', tree_ids)

    # ---- 4. 관문 그림만?
    if gate_only:
        return gate_export(gimg, appended, newimg, roof_info, pit_kits, sheet, repaint)

    # ---- 5. 시트 쓰기
    for t, (im, _w) in repaint.items():
        sheet.put(t, im)
    for a in appended.values():
        sheet.put(a['id'], a['img'])
    count = max(data['count'], next_id[0])
    rows_n = math.ceil(count / tpr)
    if sheet.im.height < rows_n * T:
        big = Image.new('RGBA', (sheet.im.width, rows_n * T)); big.paste(sheet.im, (0, 0)); sheet.im = big
    # 칠한·덧붙인 번호 말고는 그대로인지
    mine = set(repaint) | {a['id'] for a in appended.values()} | set(prev_app.values())
    b0 = np.asarray(before); b1 = np.asarray(sheet.im)[:before.height]
    changed = []
    for t in range(min(data['count'], (before.height // T) * tpr)):
        if t in mine:
            continue
        x, y = (t % tpr) * T, (t // tpr) * T
        if not np.array_equal(b0[y:y + T, x:x + T], b1[y:y + T, x:x + T]):
            changed.append(t)
    assert not changed, ('범위 밖 번호 그림이 바뀌었다', changed[:20])

    # ---- 6. 정의
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    FLAT_GROUPS = {'mc:dress'}
    for a in appended.values():
        tid, src = a['id'], a['src']
        if a['group'] in FLAT_GROUPS:
            passab[tid] = dict(PASS); prio[tid] = 'lower'
            tmeta[tid] = dict(label=a['label'], description='투명 바닥 표시(2층, 사람 밑). 건물 키트 ai.dress 가 정한 자리에 깐다.', role='detail', passage='passable',
                              defaultLayer='upper', tags=['modern-city', 'shadow', '그림자', '기초'], source='bundled-default', confidence='high', repeatability='fixed', locked=True, layerBacking='none')
        else:
            passab[tid] = dict(passab[src]); prio[tid] = prio[src]
            m = dict(tmeta[src]); m['label'] = a['label'] or m.get('label', '')
            if a['group'] not in ('kit', 'kit-copy'):
                m['description'] = a['label'] + ' — 2026-10-20 modern-tiles 굽기.'
                m['tags'] = list(dict.fromkeys(list(m.get('tags') or []) + [a['group']]))
            tmeta[tid] = m
        data['terrain'][tid] = 0
    for t, (im, why) in repaint.items():
        if t in gd:
            m = dict(tmeta[t]); m['label'] = m.get('label', ''); tmeta[t] = m
    data['count'] = count
    if data.get('libraryEnd') is not None:
        data['libraryEnd'] = count
    # 키트 격자: 원본 격자에서 다시 시작해 옮긴다(다시 구워도 같다)
    for kid, moves in repoint.items():
        rows = json.loads(json.dumps(orig.rows(kid)))
        for r, ly, c, nid in moves:
            rows[r][ly][c] = nid
        K[kid]['rows'] = rows
    for kid, lst in dress.items():
        K[kid].setdefault('ai', {})['dress'] = lst
    pit_ids = {k['id'] for k in pit_kits}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in pit_ids] + pit_kits
    GNAME = {'mc:asphalt': ('아스팔트 변형', 'terrain', 'lower', '앞 다섯(바탕 둘·바퀴 자국 결·결 배치 둘)을 칸 해시로 섞고, 뒤 셋(덧씌운 보수 판·실링 균열·기름 얼룩)은 드물게(5%).'),
             'mc:paving': ('보도 판석(16×8 러닝 본드) 변형', 'terrain', 'lower', '보도 바탕 + 둘째 톤 판 + 알갱이 배치 2(앞 넷 흔함) + 닳은 판·금 간 판·껌 자국(드물게). 칸 해시로 섞는다.'),
             'mc:grass': ('잔디(청록) 변형', 'terrain', 'lower', '잔디 바탕 2 + 흐린 볕 자리 2(화소 잔점, 칸 격자 반복 없음) + 큰 그늘 덩이·맨땅·토끼풀(드물게).'),
             'mc:grass-edge-s': ('잔디 끝 경계석(남쪽이 보도)', 'terrain', 'lower', '잔디 칸, 바로 아래가 보도일 때. 경계석 윗면·앞면 + 넘어온 잎끝.'),
             'mc:paving-under-grass': ('보도(북쪽 잔디 경계석 그늘)', 'terrain', 'lower', '보도 칸, 바로 위가 잔디(경계석)일 때.'),
             'mc:grass-edge-n': ('잔디 끝 경계석(북쪽이 보도)', 'terrain', 'lower', '잔디 칸, 바로 위가 보도일 때.'),
             'mc:tactile': ('점자 블록', 'terrain', 'lower', '횡단보도 끝 보도 모서리 칸. 교차로 키트에 들어 있다.'),
             'mc:gutter': ('측구(연석 곁 차도)', 'terrain', 'lower', '도로 키트의 연석 바로 곁 차도 칸(남향 연석 아래는 접촉 그늘 + 콘크리트 측구). 도로 키트에 들어 있다.'),
             'mc:dress': ('건물 그림자·기초(오버레이, 2층)', 'terrain', 'upper', '건물 키트 ai.dress 의 [dx,dy,번호] 자리에 2층으로 깐다: 접근칸 줄 = 기초·접촉선·남쪽 그늘, 오른쪽 열 = 동쪽 그림자, 오른쪽 아래 = 모서리.'),
             'mc:prop:tree-pit': ('가로수(보도 나무 구덩이)', 'prop', 'mixed', '보도용 가로수 키트 칸(나무 구덩이 포함).')}
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] not in groups_new]
    for gid, ids in groups_new.items():
        nm, role, layer, desc = GNAME[gid]
        data['tileGroups'].append(dict(id=gid, name=nm, role=role, defaultLayer=layer, tileIds=ids, description=desc, placementRules=desc, source='bundled-default', confidence='high',
                                       layerHome=layer if layer in ('lower', 'upper') else 'perCell'))
    # ---- 7. 쓰기
    roofed = sorted(k for k, v in roof_info.items() if 'skip' not in v)
    skipped = {k: v['skip'] for k, v in roof_info.items() if 'skip' in v}
    rep = dict(baseCount=base_count, countBefore=data['count'] if False else None, count=count, sheet=[sheet.im.width, sheet.im.height],
               repaintedInPlace=dict(ground=sorted(t for t in repaint if t in gd), shadow=sorted(t for t in repaint if 57 <= t <= 76),
                                     kitCells=len([t for t in repaint if t not in DIRECT])),
               appendedCells=len(appended), stats=dict(stats), lostCells=lost[:40], lostCount=len(lost),
               repointedKits=sorted(repoint), roofed=len(roofed), roofSkipped=skipped, pitKits=sorted(pit_ids))
    out_man = dict(version=1, baseCount=base_count, appended={k: a['id'] for k, a in sorted(appended.items(), key=lambda kv: kv[1]['id'])},
                   repaint=sorted(repaint), appendedById={str(a['id']): dict(group=a['group'], src=a['src'], label=a['label']) for a in sorted(appended.values(), key=lambda a: a['id'])},
                   roofs={k: v for k, v in roof_info.items()}, report=rep)
    if dry:
        return rep
    orig.save()
    sheet.im.save(PNG, optimize=True)
    wr = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    wr(DEF, data, separators=(',', ':'))
    wr(SHEET, dict(count=count, tilesPerRow=tpr), separators=(',', ': '))
    wr(MANIFEST, out_man, indent=0)
    return rep


def apply(root=ROOT):
    """bake_tileset.py main 이 bake_anim.apply() 다음, 맨 끝에 부른다."""
    return main()


# ====================================================================== 관문 그림
def gate_export(gimg, appended, newimg, roof_info, pit_kits, sheet, repaint):
    os.makedirs(GATE, exist_ok=True)
    for f in os.listdir(GATE):
        if f.endswith('.png'):
            os.remove(os.path.join(GATE, f))
    rows = []

    def save(name, im, kind, ko):
        p = os.path.join(GATE, name + '.png'); im.save(p)
        rows.append(dict(png=p, kind=kind, name=ko, label='modern_city/modern-tiles/' + name))

    def rep3(cell):
        im = Image.new('RGBA', (48, 48))
        for dx in (0, 16, 32):
            for dy in (0, 16, 32):
                im.paste(cell, (dx, dy))
        return im

    def board(grid):
        h, w = len(grid), len(grid[0]); im = Image.new('RGBA', (w * T, h * T))
        for y, row in enumerate(grid):
            for x, c in enumerate(row):
                im.alpha_composite(G.to_img(c) if isinstance(c, list) else c, (x * T, y * T))
        return im
    for v in range(8):
        save(f'asphalt-{v}', rep3(G.to_img(G.asphalt(v))), 'terrain', '아스팔트 ' + G.ASPHALT_VARIANTS[v] + ' (3×3 반복)')
    for v in (0, 1, 2, 3, 4, 5, 6):
        save(f'paving-{v}', rep3(G.to_img(G.sidewalk(v))), 'terrain', '보도 ' + G.SIDEWALK_VARIANTS[v] + ' (3×3 반복)')
    for v in range(7):
        save(f'grass-{v}', rep3(G.to_img(G.grass(v))), 'terrain', '잔디 ' + G.GRASS_VARIANTS[v] + ' (3×3 반복)')
    save('tactile', rep3(G.to_img(G.tactile())), 'terrain', '점자 블록 (3×3 반복)')
    save('transition-grass-paving-curb-road', board([[G.grass(0)] * 3, [G.grass_edge_south(0)] * 3, [G.sidewalk_under_grass(0)] * 3, [G.sidewalk(0)] * 3,
                                                     [G.curb('S')] * 3, [G.gutter_overlay(G.asphalt(0), 'N')] * 3, [G.asphalt(0)] * 3,
                                                     [G.gutter_overlay(G.asphalt(0), 'S')] * 3, [G.curb('N')] * 3, [G.grass_edge_north(0)] * 3]),
         'terrain', '잔디→경계석→보도→연석(남향 앞면)→측구→차도→측구→북향 연석→잔디 전이판')
    corner = [[G.sidewalk(0), G.sidewalk(0), G.curb('E'), G.gutter_overlay(G.asphalt(0), 'W')],
              [G.curb('S'), G.curb('S'), G.curb('SE'), G.asphalt(0)],
              [G.gutter_overlay(G.asphalt(0), 'N'), G.gutter_overlay(G.asphalt(0), 'N'), G.gutter_overlay(G.asphalt(0), 'N', (0, 6)), G.asphalt(0)]]
    save('curb-corner-se', board(corner), 'terrain', '보도 모서리 연석(남동쪽이 도로) 전이판')
    for t in MARKED:
        save(f'road-mark-{t}', rep3(gimg[t]) if t not in (77, 78, 79, 80) else board([[gimg[t]] * 3]), 'terrain', f'도로 표시 칸 {t} (새 아스팔트·페인트)')
    save('road-centre', board([[gimg[77]] * 4, [gimg[78]] * 4]), 'terrain', '노란 중앙선(두 줄) 위아래 칸')
    for t in (57, 58, 59):
        save(f'shadow-{t}', repaint[t][0], 'flat', f'건물 그림자 오버레이 {t}')
    for kid in TREE_KITS:
        save('tree-' + kid, newimg[kid], 'organic', K_NAME.get(kid, kid))
        save('tree-pit-' + kid, AT.tree_kit_image(kid, pit=True), 'organic', K_NAME.get(kid, kid) + ' (보도 나무 구덩이)')
    for kid, v in sorted(roof_info.items()):
        if 'skip' in v:
            continue
        save('roof-' + kid, newimg[kid], 'structure', f'{kid} — 평지붕 {AR.MAT_KO[v["mat"]]}·처마 그늘·밑변 이음')
    with open(os.path.join(GATE, 'items.jsonl'), 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    return dict(items=len(rows), path=os.path.join(GATE, 'items.jsonl'))


K_NAME = {'mc-prop-street-tree-a': '가로수 2×3 a', 'mc-prop-street-tree-b': '가로수 2×3 b', 'mc-prop-keyaki-a': '느티나무 가로수 3×4 a', 'mc-prop-keyaki-b': '느티나무 가로수 3×4 b'}

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gate':
        print(json.dumps(main(gate_only=True), ensure_ascii=False, indent=1))
    else:
        print(json.dumps(main(dry='--dry' in sys.argv), ensure_ascii=False, indent=1, default=str))

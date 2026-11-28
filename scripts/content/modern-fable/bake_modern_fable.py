#!/usr/bin/env python3
"""Unified Fable Modern Tileset Baker, Round-Trip Selftest & Day/Night City Showcase Renderer.

Inputs:
  - tiledata/modern-fable/ground/manifest.json + *.png (27 ground/road/curb/marking tiles)
  - tiledata/modern-fable/objects/batch_01..05/manifest.json + *.png (100 modern objects)
  - tiledata/modern-fable/buildings/pack01..10/manifest.json + *.png (100 modern buildings)

Outputs:
  - public/assets/modern-fable/modern-fable-chipset.png (deduplicated 16px atlas, 64 cols)
  - src/assets/modernFableTileset.json (OPRN BundledTilesetJson compatible)
  - public/assets/modern-fable/catalog.json (full searchable catalog + light anchors)
  - public/assets/modern-fable/demo_modern_day.png (84x56-tile multi-district daytime showcase)
  - public/assets/modern-fable/demo_modern_night.png (84x56-tile twilight/night with light-anchor glow)
  - public/assets/modern-fable/gallery_objects_100.png (compact 100-object visual index)
  - public/assets/modern-fable/gallery_buildings_100.png (compact 100-building visual index)
"""
import glob
import json
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA_ROOT = os.path.join(REPO, 'tiledata', 'modern-fable')
PUB_OUT = os.path.join(REPO, 'public', 'assets', 'modern-fable')
SRC_OUT = os.path.join(REPO, 'src', 'assets', 'modernFableTileset.json')

TILES_PER_ROW = 64
TILE = 16


def load_all_assets():
    # 1. Ground tiles
    g_dir = os.path.join(DATA_ROOT, 'ground')
    g_man = json.load(open(os.path.join(g_dir, 'manifest.json'), encoding='utf-8'))
    grounds = []
    for it in g_man.get('tiles', g_man.get('items', [])):
        p = os.path.join(g_dir, f"{it['id']}.png")
        if os.path.exists(p):
            it = dict(it)
            it['category'] = it.get('layer', it.get('category', 'ground'))
            it['path'] = p
            grounds.append(it)

    # 2. Objects (batch_01..05)
    objects = []
    obj_root = os.path.join(DATA_ROOT, 'objects')
    for b in sorted(os.listdir(obj_root)):
        bdir = os.path.join(obj_root, b)
        mpath = os.path.join(bdir, 'manifest.json')
        if not os.path.isfile(mpath):
            continue
        man = json.load(open(mpath, encoding='utf-8'))
        for it in man.get('items', []):
            p = os.path.join(bdir, f"{it['id']}.png")
            if os.path.exists(p):
                it = dict(it)
                it['batch'] = b
                it['path'] = p
                objects.append(it)

    # 3. Buildings (pack01..10)
    buildings = []
    bldg_root = os.path.join(DATA_ROOT, 'buildings')
    for pk in sorted(os.listdir(bldg_root)):
        pdir = os.path.join(bldg_root, pk)
        mpath = os.path.join(pdir, 'manifest.json')
        if not os.path.isfile(mpath):
            continue
        man = json.load(open(mpath, encoding='utf-8'))
        for it in man.get('items', []):
            p = os.path.join(pdir, f"{it['id']}.png")
            if os.path.exists(p):
                it = dict(it)
                it['pack'] = pk
                it['path'] = p
                buildings.append(it)

    return grounds, objects, buildings


def norm_light_anchors(spec, w_px, h_px):
    """Normalize lightAnchor / lightAnchors from varied batch formats into [[x, y], ...]."""
    out = []
    la = spec.get('lightAnchors')
    if isinstance(la, list):
        for pt in la:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                out.append([int(pt[0]), int(pt[1])])
    s = spec.get('lightAnchor')
    if isinstance(s, (list, tuple)) and len(s) >= 2:
        out.append([int(s[0]), int(s[1])])
    elif s is True:
        out.append([w_px // 2, max(6, h_px // 3)])
    return out


class TileAtlasBuilder:
    def __init__(self):
        # Tile 0 = empty transparent
        empty = Image.new('RGBA', (TILE, TILE), (0, 0, 0, 0))
        self.tiles = [empty]
        self.key_to_id = {}
        self.passability = [{'up': False, 'down': False, 'left': False, 'right': False}]
        self.priority = ['lower']
        self.terrain = [0]
        self.tileMeta = [{'label': '빈 칸', 'description': '빈 칸 — 쓰지 않는다.', 'source': 'modern-fable'}]

    def add_tile(self, tile_im, passable=True, priority='lower', label='', desc=''):
        raw = tile_im.tobytes()
        # Transparent tile -> return -1 (skip)
        if not any(raw[3::4]):
            return -1
        key = (raw, bool(passable), priority)
        if key in self.key_to_id:
            return self.key_to_id[key]
        tid = len(self.tiles)
        self.tiles.append(tile_im.copy())
        self.key_to_id[key] = tid
        p = bool(passable)
        self.passability.append({'up': p, 'down': p, 'left': p, 'right': p})
        self.priority.append(priority)
        self.terrain.append(0)
        self.tileMeta.append({
            'label': label or f'tile_{tid}',
            'description': desc or label,
            'source': 'modern-fable',
        })
        return tid

    def save_sheet(self, out_png):
        count = len(self.tiles)
        rows = (count + TILES_PER_ROW - 1) // TILES_PER_ROW
        sheet = Image.new('RGBA', (TILES_PER_ROW * TILE, rows * TILE), (0, 0, 0, 0))
        for idx, tim in enumerate(self.tiles):
            r = idx // TILES_PER_ROW
            c = idx % TILES_PER_ROW
            sheet.paste(tim, (c * TILE, r * TILE))
        os.makedirs(os.path.dirname(out_png), exist_ok=True)
        sheet.save(out_png)
        return sheet


def bake_tileset(grounds, objects, buildings):
    atlas = TileAtlasBuilder()
    tile_groups = []
    structure_kits = []
    catalog = {'ground': [], 'objects': [], 'buildings': []}

    # --- 1. Ground tiles ---
    g_by_cat = {}
    for g in grounds:
        im = Image.open(g['path']).convert('RGBA')
        w_t, h_t = im.width // TILE, im.height // TILE
        passable = bool(g.get('passable', True))
        if 'water' in g['id'] or 'bank' in g['id']:
            passable = False
        tids = []
        for ty in range(h_t):
            for tx in range(w_t):
                crop = im.crop((tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE))
                tid = atlas.add_tile(crop, passable=passable, priority='lower', label=g.get('name', g['id']))
                tids.append(tid)
        cat = g.get('category', 'ground')
        g_by_cat.setdefault(cat, []).extend([t for t in tids if t > 0])
        catalog['ground'].append({
            'id': g['id'], 'name': g.get('name', g['id']), 'category': cat,
            'w': im.width, 'h': im.height, 'passable': passable, 'tileIds': tids,
        })

    for cat, tids in sorted(g_by_cat.items()):
        tile_groups.append({
            'id': f'mf:gnd:{cat}',
            'name': f'현대 지면 · {cat}',
            'role': 'terrain',
            'defaultLayer': 'lower',
            'tileIds': sorted(set(tids)),
            'description': f'Fable 현대 타일셋 지면 ({cat}), 16px 탑-3/4.',
        })

    # --- 2. Objects (100) ---
    o_by_cat = {}
    for obj in objects:
        im = Image.open(obj['path']).convert('RGBA')
        w_t, h_t = im.width // TILE, im.height // TILE
        tags = obj.get('tags', [])
        is_flat = ('flat' in tags) or obj.get('pc') == 'flat' or obj['id'].endswith(('speed_bump', 'tactile_drain_set'))
        top_pass_rows = obj.get('passableTopRows')
        if top_pass_rows is None:
            top_pass_rows = h_t if is_flat else max(0, h_t - 1)
        rows = []
        used_tids = []
        for ty in range(h_t):
            lo_row = [-1] * w_t
            up_row = [-1] * w_t
            is_top_pass = (ty < top_pass_rows)
            for tx in range(w_t):
                crop = im.crop((tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE))
                if is_flat:
                    tid = atlas.add_tile(crop, passable=True, priority='lower', label=obj.get('name', obj['id']))
                    lo_row[tx] = tid
                else:
                    tid = atlas.add_tile(
                        crop,
                        passable=is_top_pass,
                        priority='upper' if is_top_pass else 'lower',
                        label=obj.get('name', obj['id']),
                    )
                    up_row[tx] = tid
                if tid > 0:
                    used_tids.append(tid)
            rows.append({'tiles': lo_row, 'upperTiles': up_row})

        la = norm_light_anchors(obj, im.width, im.height)
        kit = {
            'id': obj['id'],
            'kind': 'prop',
            'name': obj.get('name', obj['id']),
            'category': obj.get('category', 'prop'),
            'width': w_t,
            'height': h_t,
            'tileSize': TILE,
            'rows': rows,
            'tags': tags,
        }
        if la:
            kit['lightAnchors'] = la
        structure_kits.append(kit)
        cat = obj.get('category', 'prop')
        o_by_cat.setdefault(cat, []).extend(used_tids)
        catalog['objects'].append({
            'id': obj['id'], 'name': obj.get('name', obj['id']), 'category': cat, 'batch': obj['batch'],
            'w': im.width, 'h': im.height, 'wTiles': w_t, 'hTiles': h_t,
            'lightAnchors': la, 'tags': tags, 'kitId': obj['id'],
        })

    for cat, tids in sorted(o_by_cat.items()):
        tile_groups.append({
            'id': f'mf:obj:{cat}',
            'name': f'현대 기물 · {cat}',
            'role': 'object',
            'defaultLayer': 'upper',
            'tileIds': sorted(set(tids)),
            'description': f'Fable 현대 오브젝트 ({cat}), 3/4 탑뷰.',
        })

    # --- 3. Buildings (100) ---
    b_by_pack = {}
    for bldg in buildings:
        im = Image.open(bldg['path']).convert('RGBA')
        w_t, h_t = im.width // TILE, im.height // TILE
        rows = []
        used_tids = []
        for ty in range(h_t):
            lo_row = [-1] * w_t
            up_row = [-1] * w_t
            # Top roof row is passable upper overhang so characters can walk behind the roof ridge
            is_roof_overhang = (ty == 0)
            for tx in range(w_t):
                crop = im.crop((tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE))
                tid = atlas.add_tile(
                    crop,
                    passable=is_roof_overhang,
                    priority='upper' if is_roof_overhang else 'lower',
                    label=bldg.get('name', bldg['id']),
                )
                up_row[tx] = tid
                if tid > 0:
                    used_tids.append(tid)
            rows.append({'tiles': lo_row, 'upperTiles': up_row})

        la = norm_light_anchors(bldg, im.width, im.height)
        kit = {
            'id': bldg['id'],
            'kind': 'section',
            'name': bldg.get('name', bldg['id']),
            'pack': bldg['pack'],
            'width': w_t,
            'height': h_t,
            'tileSize': TILE,
            'doorCol': bldg.get('doorCol', w_t // 2),
            'rows': rows,
            'tags': bldg.get('tags', []),
        }
        if la:
            kit['lightAnchors'] = la
        structure_kits.append(kit)
        b_by_pack.setdefault(bldg['pack'], []).extend(used_tids)
        catalog['buildings'].append({
            'id': bldg['id'], 'name': bldg.get('name', bldg['id']), 'pack': bldg['pack'],
            'w': im.width, 'h': im.height, 'wTiles': w_t, 'hTiles': h_t,
            'doorCol': bldg.get('doorCol', w_t // 2), 'lightAnchors': la,
            'tags': bldg.get('tags', []), 'kitId': bldg['id'],
        })

    for pk, tids in sorted(b_by_pack.items()):
        tile_groups.append({
            'id': f'mf:bldg:{pk}',
            'name': f'현대 건물 · {pk}',
            'role': 'building',
            'defaultLayer': 'upper',
            'tileIds': sorted(set(tids)),
            'description': f'Fable 현대 건물 팩 ({pk}), 3/4 탑뷰, 층 복제 없음.',
        })

    # Save atlas PNG
    atlas_png = os.path.join(PUB_OUT, 'modern-fable-chipset.png')
    sheet = atlas.save_sheet(atlas_png)

    # Save OPRN BundledTilesetJson
    count = len(atlas.tiles)
    ts_json = {
        'id': 'modern_fable',
        'name': '현대 도시 · Fable 5.2 통합 (기물 100 · 건물 100)',
        'textureKey': 'tex_modern_fable',
        'family': 'oprn-modern-fable',
        'tileSize': TILE,
        'tilesPerRow': TILES_PER_ROW,
        'count': count,
        'libraryEnd': count,
        'passability': atlas.passability,
        'priority': atlas.priority,
        'terrain': atlas.terrain,
        'tileMeta': atlas.tileMeta,
        'tileGroups': tile_groups,
        'autotileGroups': [],
        'animationStrips': [],
        'structureKits': structure_kits,
    }
    os.makedirs(os.path.dirname(SRC_OUT), exist_ok=True)
    with open(SRC_OUT, 'w', encoding='utf-8') as f:
        json.dump(ts_json, f, ensure_ascii=False, separators=(',', ':'))

    with open(os.path.join(PUB_OUT, 'catalog.json'), 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    # --- 4. 100% Pixel-Exact Round-Trip Selftest ---
    reloaded = Image.open(atlas_png).convert('RGBA')
    mismatches = 0
    checked = 0
    kit_by_id = {k['id']: k for k in structure_kits}

    def tile_crop(tid):
        r = tid // TILES_PER_ROW
        c = tid % TILES_PER_ROW
        return reloaded.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE))

    for g_it in catalog['ground']:
        orig = Image.open(os.path.join(DATA_ROOT, 'ground', f"{g_it['id']}.png")).convert('RGBA')
        rec = Image.new('RGBA', orig.size, (0, 0, 0, 0))
        w_t = orig.width // TILE
        for idx, tid in enumerate(g_it['tileIds']):
            if tid > 0:
                rec.paste(tile_crop(tid), ((idx % w_t) * TILE, (idx // w_t) * TILE))
        if orig.tobytes() != rec.tobytes():
            mismatches += 1
        checked += 1

    for src_list in (objects, buildings):
        for it in src_list:
            orig = Image.open(it['path']).convert('RGBA')
            kit = kit_by_id[it['id']]
            rec = Image.new('RGBA', orig.size, (0, 0, 0, 0))
            for ty, row in enumerate(kit['rows']):
                for tx in range(kit['width']):
                    for tid in (row['tiles'][tx], row['upperTiles'][tx]):
                        if tid > 0:
                            rec.alpha_composite(tile_crop(tid), (tx * TILE, ty * TILE))
            if orig.tobytes() != rec.tobytes():
                mismatches += 1
            checked += 1

    print(
        f'BAKE OK: tiles={count} ({sheet.width}x{sheet.height}), '
        f'ground={len(grounds)}, objects={len(objects)}, buildings={len(buildings)}, '
        f'kits={len(structure_kits)}, roundtrip={checked - mismatches}/{checked} EXACT'
    )
    assert mismatches == 0, f'Round-trip pixel mismatches: {mismatches}'
    return ts_json, catalog


def render_city_showcases(grounds, objects, buildings):
    """Compose an 84x56-tile (1344x896px) rich multi-district Fable city showcase (Day + Night)."""
    W_T, H_T = 84, 56
    W, H = W_T * TILE, H_T * TILE
    g_map = {g['id']: Image.open(g['path']).convert('RGBA') for g in grounds}
    o_map = {o['id']: (Image.open(o['path']).convert('RGBA'), o) for o in objects}
    b_map = {b['id']: (Image.open(b['path']).convert('RGBA'), b) for b in buildings}

    day = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    emissive_eligible = np.zeros((H, W), dtype=bool)
    lights = []  # (cx, cy, radius, (r, g, b), intensity)

    def put_tile(gid, tx, ty, rot=None):
        if 0 <= tx < W_T and 0 <= ty < H_T and gid in g_map:
            im = g_map[gid]
            if rot is not None:
                im = im.transpose(rot)
            day.alpha_composite(im, (tx * TILE, ty * TILE))

    # --- 1. Base Ground Layout (coprime 2D hash — zero vertical/diagonal striping!) ---
    for ty in range(H_T):
        for tx in range(W_T):
            h = ((tx * 37 + ty * 53) ^ ((tx * 17) + (ty * 29))) % 11
            if ty < 4:
                # Lush north city greenbelt backdrop behind North Boulevard
                put_tile('mf-gnd-lawn-a' if h != 0 else 'mf-gnd-lawn-b', tx, ty)
            elif ty == 4:
                put_tile('mf-gnd-sidewalk-a', tx, ty)
                put_tile('mf-curb-n', tx, ty)
            elif ty < 17:
                # North civic/campus/terrace plaza forecourt & sidewalk (aligned to building gaps!)
                if tx < 37:
                    put_tile('mf-gnd-sidewalk-a' if h > 1 else 'mf-gnd-sidewalk-b', tx, ty)
                elif tx < 58:
                    put_tile('mf-gnd-forecourt', tx, ty)
                else:
                    put_tile('mf-gnd-sidewalk-brick' if ty >= 14 else ('mf-gnd-sidewalk-a' if h > 1 else 'mf-gnd-sidewalk-b'), tx, ty)
            elif ty == 17:
                put_tile('mf-gnd-sidewalk-a' if h > 1 else 'mf-gnd-sidewalk-b', tx, ty)
                # Tactile paving ONLY at real crosswalk curb approaches!
                if tx in range(18, 22) or tx in range(58, 62):
                    put_tile('mf-floor-tactile', tx, ty)
            elif ty == 18:
                put_tile('mf-gnd-sidewalk-a', tx, ty)
                put_tile('mf-curb-s', tx, ty)
            elif 19 <= ty <= 24:
                # 6-tile wide Grand Avenue asphalt (true center at y=352 = ty=21/22 seam!)
                gid = 'mf-gnd-asphalt-patch' if ((tx * 13 + ty * 29) ^ (tx * 7)) % 23 == 0 else (
                    'mf-gnd-asphalt-a' if (tx + ty) % 2 == 0 else 'mf-gnd-asphalt-b'
                )
                put_tile(gid, tx, ty)
                # Symmetrical lane dashes at ty=20 (westbound) and ty=23 (eastbound)
                if ty in (20, 23) and tx % 3 == 0 and tx not in range(15, 25) and tx not in range(55, 65):
                    put_tile('mf-mark-dash-h', tx, ty)
                # Crosswalks
                if tx in (18, 19, 20, 21, 58, 59, 60, 61):
                    put_tile('mf-mark-zebra-h', tx, ty)
                # Properly rotated vertical stop lines for E-W traffic!
                if tx in (16, 56) and ty in (22, 23, 24):
                    put_tile('mf-mark-stop', tx, ty, rot=Image.Transpose.ROTATE_90)
                if tx in (23, 63) and ty in (19, 20, 21):
                    put_tile('mf-mark-stop', tx, ty, rot=Image.Transpose.ROTATE_270)
            elif ty == 25:
                put_tile('mf-gnd-sidewalk-a', tx, ty)
                put_tile('mf-curb-n', tx, ty)
            elif 26 <= ty <= 39:
                # Mid-South bustling shopping street & cozy side alleys
                if tx in (25, 26, 52, 53):
                    put_tile('mf-gnd-alley', tx, ty)
                elif ty >= 36:
                    put_tile('mf-gnd-sidewalk-brick' if h > 2 else 'mf-gnd-forecourt', tx, ty)
                else:
                    put_tile('mf-gnd-sidewalk-a' if h > 1 else 'mf-gnd-sidewalk-b', tx, ty)
                # South crosswalk tactile paving approach at ty=26
                if ty == 26 and (tx in range(18, 22) or tx in range(58, 62)):
                    put_tile('mf-floor-tactile', tx, ty)
            elif 40 <= ty <= 48:
                # South Park & Waterfront Promenade
                if tx < 42:
                    put_tile('mf-gnd-lawn-a' if h != 0 else 'mf-gnd-lawn-b', tx, ty)
                else:
                    put_tile('mf-gnd-sidewalk-brick' if ty >= 46 else 'mf-gnd-forecourt', tx, ty)
            elif ty == 49:
                put_tile('mf-gnd-sidewalk-brick', tx, ty)
                put_tile('mf-bank-canal', tx, ty)
            else:
                put_tile('mf-gnd-water', tx, ty)

    # Centered yellow road divider exactly along the ty=21/22 seam (y=352)
    if 'mf-mark-yellow-h' in g_map:
        yel = g_map['mf-mark-yellow-h']
        for tx in range(W_T):
            if tx not in range(17, 23) and tx not in range(57, 63):
                day.alpha_composite(yel, (tx * TILE, 21 * TILE + 8))

    # Park paved paths crossing the lawn (x=18..21, y=40..48 & horizontal promenade y=47..48)
    for ty in range(40, 49):
        for tx in range(18, 22):
            put_tile('mf-gnd-forecourt', tx, ty)
    for tx in range(0, 44):
        put_tile('mf-gnd-sidewalk-brick', tx, 47)
        put_tile('mf-gnd-sidewalk-brick', tx, 48)
    # Paved stone pads under grated park trees (so grates never sit directly on bare grass!)
    for ptx, pty in ((22, 42), (23, 42), (22, 43), (23, 43), (40, 42), (41, 42), (40, 43), (41, 43)):
        put_tile('mf-gnd-forecourt', ptx, pty)
    # Manholes & storm drains along avenue
    for tx in (8, 32, 46, 72):
        put_tile('mf-floor-manhole', tx, 20)
        put_tile('mf-floor-grate', tx + 1, 19)
        put_tile('mf-floor-grate', tx + 2, 24)

    # North greenbelt garden edge (non-overlapping stone tree pads + backdrop trees + boxwood hedges along ty=0..4)
    north_trees = (4, 16, 26, 36, 48, 60, 72, 80)
    tree_occupied = set()
    for ttx in north_trees:
        tree_occupied.update((ttx - 1, ttx, ttx + 1, ttx + 2))
        # Paved stone alcove pad under every north greenbelt tree (no bare-grass grates!)
        for ptx in (ttx, ttx + 1):
            for pty in (2, 3):
                put_tile('mf-gnd-forecourt', ptx, pty)
    for tx in range(0, W_T, 4):
        if tx not in tree_occupied and (tx + 1) not in tree_occupied:
            if 'mf-obj-boxwood_hedge' in o_map:
                im, _ = o_map['mf-obj-boxwood_hedge']
                day.alpha_composite(im, (tx * TILE, 4 * TILE - im.height))
    for tx in north_trees:
        tid = 'mf-obj-tree_cherry_blossom' if tx in (16, 60) else ('mf-obj-tree_grate_ginkgo' if tx in (36, 80) else 'mf-obj-tree_grate_spring')
        if tid in o_map:
            im, _ = o_map[tid]
            day.alpha_composite(im, (tx * TILE, 4 * TILE - im.height))

    # Curated night light anchor overrides for buildings whose default manifest anchors need showcase tuning
    BLDG_LIGHT_OVERRIDES = {
        'mf-bldg-sig_lcorner_conv_bar': [(32, 86, 54, (255, 232, 180), 0.62), (96, 86, 52, (255, 205, 130), 0.62), (104, 34, 48, (255, 195, 120), 0.58)],
        'mf-bldg-camp_bell_tower': [(32, 54, 46, (255, 224, 150), 0.65)],
        'mf-bldg-kr_piloti_brick_villa': [(68, 108, 42, (255, 212, 138), 0.52), (34, 62, 42, (255, 212, 138), 0.50)],
        'mf-bldg-pk_lakeside_boathouse': [(28, 64, 46, (255, 212, 138), 0.56), (76, 48, 42, (255, 212, 138), 0.50)],
        'mf-bldg-nl_karaoke_neon_tower': [(40, 36, 58, (255, 150, 215), 0.72), (40, 74, 58, (130, 230, 255), 0.72), (40, 118, 56, (255, 215, 130), 0.68)],
        'mf-bldg-nl_retro_arcade': [(48, 32, 56, (130, 225, 255), 0.72), (48, 88, 58, (255, 160, 220), 0.70)],
        'mf-bldg-sig_neon_nightmarket_hall': [(72, 16, 62, (255, 175, 225), 0.68), (72, 78, 64, (255, 215, 140), 0.66)],
        'mf-bldg-kr_corner_conv24': [(48, 66, 60, (255, 236, 195), 0.68)],
        'mf-bldg-kr_chicken_pub': [(48, 86, 56, (255, 205, 130), 0.62), (88, 58, 44, (255, 218, 135), 0.60)],
    }

    def mark_emissive(im, px, py, skip_top=0):
        a = np.array(im)[:, :, 3] > 0
        y0 = max(0, py + skip_top)
        y1 = min(H, py + im.height)
        x0 = max(0, px)
        x1 = min(W, px + im.width)
        if y1 > y0 and x1 > x0:
            emissive_eligible[y0:y1, x0:x1] |= a[y0 - py:y1 - py, x0 - px:x1 - px]

    def place_bldg(bid, tx, bottom_ty):
        if bid not in b_map:
            return
        im, spec = b_map[bid]
        px = tx * TILE
        py = bottom_ty * TILE - im.height
        for sx in range(tx, min(W_T, tx + im.width // TILE)):
            put_tile('mf-shade-south', sx, bottom_ty)
        day.alpha_composite(im, (px, py))
        # Building windows/signs are emissive-eligible (skip top 4px roof silhouette edge)
        mark_emissive(im, px, py, skip_top=4)
        if bid in BLDG_LIGHT_OVERRIDES:
            for ax, ay, rad, col_rgb, inten in BLDG_LIGHT_OVERRIDES[bid]:
                lights.append((px + ax, py + ay, rad, col_rgb, inten))
            return
        anchors = norm_light_anchors(spec, im.width, im.height)
        if not anchors:
            anchors = [[im.width // 2, im.height - 24]]
        for ax, ay in anchors:
            is_neon = any(t in spec.get('tags', []) for t in ('neon', 'nightlife', 'arcade', 'karaoke', 'conv', 'pharmacy'))
            col_rgb = (135, 225, 255) if ('arcade' in bid or 'pcbang' in bid) else (
                (255, 165, 210) if 'karaoke' in bid else (255, 212, 138)
            )
            lights.append((px + ax, py + ay, 60 if is_neon else 48, col_rgb, 0.66 if is_neon else 0.52))

    LUMINOUS_OBJ_KEYS = (
        'streetlamp', 'lantern', 'neon', 'pylon', 'pharmacy_cross',
        'vending_drink_lit', 'vending_snack', 'traffic_signal', 'ped_signal',
        'plaza_clock_pillar', 'noren_lantern_stand', 'retro_arcade_cab',
        'pojangmacha_cart', 'subway_stair_rail', 'bus_shelter',
    )

    def place_obj(oid, px_x, bottom_y, tint=None, flip_x=False):
        if oid not in o_map:
            return
        im, spec = o_map[oid]
        if flip_x:
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        py = bottom_y - im.height
        day.alpha_composite(im, (px_x, py))
        if any(k in oid for k in LUMINOUS_OBJ_KEYS):
            mark_emissive(im, px_x, py, skip_top=0)

        # Custom vehicle/prop lighting (no floating bus roof orb; crisp emergency strobes & lanterns!)
        if oid == 'mf-obj-city_bus_side':
            hx = (im.width - 6) if flip_x else 6
            lights.append((px_x + hx, py + im.height - 10, 34, (255, 232, 175), 0.52))
            return
        if oid == 'mf-obj-police_car_side':
            lights.append((px_x + im.width // 2 - 4, py + 7, 28, (95, 175, 255), 0.68))
            lights.append((px_x + im.width // 2 + 4, py + 7, 26, (255, 95, 95), 0.60))
            return
        if oid == 'mf-obj-ambulance_side':
            lights.append((px_x + (im.width - 14 if flip_x else 14), py + 6, 28, (255, 95, 95), 0.68))
            return
        if oid == 'mf-obj-city_taxi_side':
            lights.append((px_x + im.width // 2, py + 6, 24, (255, 224, 145), 0.55))
            return
        if oid == 'mf-obj-vending_drink_lit':
            lights.append((px_x + 8, py + 14, 46, (150, 225, 255), 0.72))
            return
        if oid == 'mf-obj-vending_snack':
            lights.append((px_x + 8, py + 14, 42, (255, 205, 138), 0.66))
            return
        if oid == 'mf-obj-pojangmacha_cart':
            lights.append((px_x + 24, py + 16, 52, (255, 195, 115), 0.70))
            return
        if oid == 'mf-obj-retro_arcade_cab':
            lights.append((px_x + 8, py + 14, 38, (145, 225, 255), 0.68))
            return
        if oid == 'mf-obj-noren_lantern_stand':
            lights.append((px_x + 16, py + 12, 42, (255, 195, 120), 0.68))
            return

        anchors = norm_light_anchors(spec, im.width, im.height)
        for ax, ay in anchors:
            if flip_x:
                ax = im.width - ax
            is_lamp = 'streetlamp' in oid or 'lantern' in oid or 'clock' in oid
            is_sign = 'neon' in oid or 'pylon' in oid or 'pharmacy' in oid or 'vending' in oid
            col_rgb = tint or (
                (140, 255, 185) if 'pharmacy' in oid else
                (150, 225, 255) if 'vending_drink' in oid else
                (255, 215, 145)
            )
            rad = 70 if is_lamp else (48 if is_sign else 34)
            inten = 0.82 if is_lamp else (0.68 if is_sign else 0.52)
            lights.append((px_x + ax, py + ay, rad, col_rgb, inten))

    # --- 2. North Boulevard Row (bottom at y=15, leaving clean 3-tile boulevard sidewalk!) ---
    north_row = [
        ('mf-bldg-sig_wide_cafe_corner', 1),       # 9 tiles (1..10)
        ('mf-bldg-kr_hagwon_cafe', 11),            # 6 tiles (11..17)
        ('mf-bldg-sig_3tier_stepped_terrace', 18), # 9 tiles (18..27)
        ('mf-bldg-civic_city_hall_clock', 28),     # 9 tiles (28..37)
        ('mf-bldg-camp_school_main', 38),          # 10 tiles (38..48)
        ('mf-bldg-sig_glass_atrium_arcade', 49),   # 9 tiles (49..58)
        ('mf-bldg-hi_setback_depato', 59),         # 9 tiles (59..68)
        ('mf-bldg-tr_train_station_clock', 69),    # 10 tiles (69..79)
        ('mf-bldg-camp_bell_tower', 79),           # 4 tiles (79..83)
    ]
    for bid, tx in north_row:
        place_bldg(bid, tx, 15)

    # North sidewalk life (zero door blocks, zero signal/lamp collisions, trees grounded at ty=18!)
    for tx in (0, 10, 27, 37, 48, 62, 68, 82):
        place_obj('mf-obj-streetlamp_single', tx * TILE, 18 * TILE)
    place_obj('mf-obj-cafe_bistro_set', 2 * TILE, 17 * TILE)
    place_obj('mf-obj-aframe_chalkboard', 4 * TILE, 17 * TILE)
    place_obj('mf-obj-tree_cherry_blossom', 8 * TILE, 18 * TILE)
    place_obj('mf-obj-vending_drink_lit', 16 * TILE, 17 * TILE)
    place_obj('mf-obj-traffic_signal', 17 * TILE, 18 * TILE)
    place_obj('mf-obj-ped_signal', 22 * TILE, 18 * TILE)
    place_obj('mf-obj-bus_shelter', 29 * TILE, 18 * TILE)
    place_obj('mf-obj-tree_grate_ginkgo', 34 * TILE, 18 * TILE)
    place_obj('mf-obj-bike_rack_4', 41 * TILE, 17 * TILE)
    place_obj('mf-obj-notice_board', 46 * TILE, 17 * TILE)
    place_obj('mf-obj-tree_grate_spring', 51 * TILE, 18 * TILE)
    place_obj('mf-obj-subway_pylon', 56 * TILE, 18 * TILE)
    place_obj('mf-obj-traffic_signal', 57 * TILE, 18 * TILE)
    place_obj('mf-obj-subway_stair_rail', 63 * TILE, 18 * TILE)
    place_obj('mf-obj-plaza_clock_pillar', 72 * TILE, 18 * TILE)
    place_obj('mf-obj-red_mailbox', 75 * TILE, 17 * TILE)
    place_obj('mf-obj-bike_share_dock', 77 * TILE, 18 * TILE)

    # --- 3. Grand Avenue Traffic (westbound top lanes, eastbound flipped bottom lanes!) ---
    place_obj('mf-obj-city_bus_side', 6 * TILE, 21 * TILE + 4, flip_x=False)
    place_obj('mf-obj-car_compact_side', 26 * TILE, 21 * TILE + 4, flip_x=False)
    place_obj('mf-obj-kei_truck_side', 43 * TILE, 21 * TILE + 4, flip_x=False)
    place_obj('mf-obj-police_car_side', 67 * TILE, 21 * TILE + 4, flip_x=False)
    place_obj('mf-obj-city_taxi_side', 11 * TILE, 24 * TILE + 4, flip_x=True)
    place_obj('mf-obj-ambulance_side', 34 * TILE, 24 * TILE + 4, flip_x=True)
    place_obj('mf-obj-delivery_scooter', 50 * TILE, 24 * TILE + 4, flip_x=True)
    place_obj('mf-obj-car_compact_side', 73 * TILE, 24 * TILE + 4, flip_x=True)

    # --- 4. Mid-South Shopping / Sangga / Shotengai / Nightlife Row (bottom at y=35) ---
    # Draw north-side south-curb fixtures BEFORE southern buildings so Z-order is strictly top-to-bottom!
    for tx in (2, 14, 22, 38, 54, 64, 78):
        place_obj('mf-obj-streetlamp_double' if tx in (22, 54) else 'mf-obj-streetlamp_single', tx * TILE, 27 * TILE)
    place_obj('mf-obj-kr_shade_umbrella', 17 * TILE, 27 * TILE)
    place_obj('mf-obj-kr_shade_umbrella', 57 * TILE, 27 * TILE)
    place_obj('mf-obj-fire_hydrant', 3 * TILE, 26 * TILE)
    place_obj('mf-obj-fire_hydrant', 62 * TILE, 26 * TILE)
    place_obj('mf-obj-street_trash_bin', 31 * TILE, 26 * TILE)
    place_obj('mf-obj-street_trash_bin', 68 * TILE, 26 * TILE)

    mid_row = [
        ('mf-bldg-kr_corner_conv24', 1),          # 6 tiles (1..7)
        ('mf-bldg-kr_chicken_pub', 7),            # 6 tiles (7..13)
        ('mf-bldg-jp_ramen_shop', 13),            # 5 tiles (13..18)
        ('mf-bldg-jp_bakery_terrace', 18),        # 7 tiles (18..25)
        # Walkable 2-tile alley at x=25..27!
        ('mf-bldg-kr_piloti_brick_villa', 27),    # 6 tiles (27..33)
        ('mf-bldg-sig_lcorner_conv_bar', 33),     # 8 tiles (33..41)
        ('mf-bldg-nl_retro_arcade', 41),          # 6 tiles (41..47)
        ('mf-bldg-nl_karaoke_neon_tower', 47),    # 5 tiles (47..52)
        # Walkable 2-tile alley at x=52..54!
        ('mf-bldg-sig_neon_nightmarket_hall', 54),# 9 tiles (54..63)
        ('mf-bldg-jp_izakaya_corner', 63),        # 6 tiles (63..69)
        ('mf-bldg-sig_extstair_bookstore', 69),   # 7 tiles (69..76)
        ('mf-bldg-kr_corner_pharmacy', 76),       # 5 tiles (76..81)
    ]
    for bid, tx in mid_row:
        place_bldg(bid, tx, 35)

    # Alley & mid-promenade life (1-tile alley walls kept open so both alleys are walkable!)
    place_obj('mf-obj-utility_pole', 25 * TILE, 31 * TILE)
    place_obj('mf-obj-utility_pole', 52 * TILE, 31 * TILE)
    place_obj('mf-obj-street_trash_bin', 26 * TILE, 35 * TILE)
    place_obj('mf-obj-street_trash_bin', 53 * TILE, 35 * TILE)
    place_obj('mf-obj-conv_pylon_sign', 0 * TILE, 36 * TILE)
    place_obj('mf-obj-vending_snack', 6 * TILE, 37 * TILE)
    place_obj('mf-obj-pojangmacha_cart', 9 * TILE, 38 * TILE)
    place_obj('mf-obj-noren_lantern_stand', 14 * TILE, 37 * TILE)
    place_obj('mf-obj-bakery_bread_rack', 20 * TILE, 37 * TILE)
    place_obj('mf-obj-parasol_patio_set', 22 * TILE, 39 * TILE)
    place_obj('mf-obj-parked_bicycle', 28 * TILE, 37 * TILE)
    place_obj('mf-obj-plastic_crates', 30 * TILE, 37 * TILE)
    place_obj('mf-obj-coffee_cart', 34 * TILE, 38 * TILE)
    place_obj('mf-obj-retro_arcade_cab', 43 * TILE, 37 * TILE)
    place_obj('mf-obj-neon_blade_cafe', 49 * TILE, 37 * TILE)
    place_obj('mf-obj-recycle_bin_trio', 51 * TILE, 38 * TILE)
    place_obj('mf-obj-pojangmacha_cart', 56 * TILE, 38 * TILE)
    place_obj('mf-obj-fruit_veg_stand', 60 * TILE, 37 * TILE)
    place_obj('mf-obj-lantern_stand', 65 * TILE, 37 * TILE)
    place_obj('mf-obj-book_stall', 71 * TILE, 37 * TILE)
    place_obj('mf-obj-flower_bucket_stand', 74 * TILE, 37 * TILE)
    place_obj('mf-obj-pharmacy_cross', 81 * TILE, 36 * TILE)

    # --- 5. South Park, Conservatory & Canal Waterfront (y=40..50) ---
    place_bldg('mf-bldg-pk_glass_conservatory', 2, 46)
    place_bldg('mf-bldg-pk_onsen_steam_terrace', 44, 47)
    place_bldg('mf-bldg-sig_canal_bridge_shop', 53, 47)
    place_bldg('mf-bldg-hb_pier_terrace_pub', 63, 47)
    place_bldg('mf-bldg-pk_lakeside_boathouse', 73, 47)

    place_obj('mf-obj-park_fountain', 12 * TILE, 46 * TILE)
    place_obj('mf-obj-park_gazebo', 24 * TILE, 46 * TILE)
    place_obj('mf-obj-playground_slide', 30 * TILE, 46 * TILE)
    place_obj('mf-obj-swing_set', 35 * TILE, 46 * TILE)
    place_obj('mf-obj-tree_cherry_blossom', 10 * TILE, 43 * TILE)
    place_obj('mf-obj-tree_grate_spring', 22 * TILE, 44 * TILE)
    place_obj('mf-obj-tree_grate_ginkgo', 40 * TILE, 44 * TILE)
    place_obj('mf-obj-park_bench_wood', 15 * TILE, 48 * TILE)
    place_obj('mf-obj-plaza_bench_stone', 24 * TILE, 48 * TILE)
    place_obj('mf-obj-park_stone_lantern', 43 * TILE, 48 * TILE)
    place_obj('mf-obj-park_stone_lantern', 52 * TILE, 48 * TILE)
    # Parasol patio relocated cleanly east of boathouse (zero overlap on TEA CAFE!)
    place_obj('mf-obj-parasol_patio_set', 80 * TILE, 48 * TILE)
    # Waterfront streetlamps positioned cleanly in building gaps & behind the canal railing!
    for tx in (8, 28, 61, 71):
        place_obj('mf-obj-streetlamp_single', tx * TILE, 48 * TILE + 12)

    # Continuous uninterrupted canal safety railing along waterfront y=49
    for tx in range(0, W_T, 2):
        place_obj('mf-obj-canal_railing', tx * TILE, 49 * TILE + 8)

    day_path = os.path.join(PUB_OUT, 'demo_modern_day.png')
    day.save(day_path)

    # --- 6. Atmospheric Night Rendering with Masked Emissive Windows, Light Pools & Rippled Canal Reflection ---
    arr = np.array(day, dtype=np.float32)
    rgb = arr[:, :, :3]
    night = np.empty_like(rgb)
    night[:, :, 0] = rgb[:, :, 0] * 0.33 + 6.0
    night[:, :, 1] = rgb[:, :, 1] * 0.39 + 10.0
    night[:, :, 2] = rgb[:, :, 2] * 0.59 + 22.0

    # Strictly mask emissive pixels to buildings & luminous street fixtures (NO glowing roads/trees/taxis!)
    warm_mask = (rgb[:, :, 0] > 210) & (rgb[:, :, 1] > 165) & (rgb[:, :, 2] < 165)
    cyan_mask = (rgb[:, :, 2] > 200) & (rgb[:, :, 1] > 180) & (rgb[:, :, 0] < 140)
    pink_mask = (rgb[:, :, 0] > 215) & (rgb[:, :, 2] > 155) & (rgb[:, :, 1] < 165)
    emissive = (warm_mask | cyan_mask | pink_mask) & emissive_eligible
    night[emissive] = np.clip(rgb[emissive] * 1.05, 0, 255)

    # Additive radial glow pools from every registered lightAnchor
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.zeros_like(night)
    for cx, cy, rad, (lr, lg, lb), inten in lights:
        x0 = max(0, int(cx - rad))
        x1 = min(W, int(cx + rad + 1))
        y0 = max(0, int(cy - rad))
        y1 = min(H, int(cy + rad + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        dx = xx[y0:y1, x0:x1] - cx
        dy = (yy[y0:y1, x0:x1] - cy) * 1.15
        d = np.sqrt(dx * dx + dy * dy) / float(rad)
        falloff = np.clip(1.0 - d, 0.0, 1.0) ** 2.1 * inten
        glow[y0:y1, x0:x1, 0] += falloff * lr * 0.65
        glow[y0:y1, x0:x1, 1] += falloff * lg * 0.65
        glow[y0:y1, x0:x1, 2] += falloff * lb * 0.65

    lit_factor = np.clip(glow.max(axis=2, keepdims=True) / 140.0, 0.0, 0.72)
    final_rgb = night * (1.0 - lit_factor * 0.45) + rgb * (lit_factor * 0.68) + glow * 0.55

    # Smooth 96px rippled canal water reflection with soft vertical falloff (ZERO hard horizontal seam!)
    wy0 = 50 * TILE
    rh = min(H - wy0, 96)
    ref_raw = final_rgb[wy0 - rh:wy0, :, :][::-1].copy()
    for r in range(rh):
        shift = int(round(math.sin(r * 0.55) * (1.0 + r * 0.035)))
        if shift != 0:
            ref_raw[r] = np.roll(ref_raw[r], shift, axis=0)
    fade = (0.34 * ((1.0 - np.linspace(0.0, 1.0, rh)) ** 1.8))[:, None, None]
    final_rgb[wy0:wy0 + rh] = final_rgb[wy0:wy0 + rh] * (1.0 - fade) + ref_raw * fade

    final_arr = np.zeros((H, W, 4), dtype=np.uint8)
    final_arr[:, :, :3] = np.clip(final_rgb, 0, 255).astype(np.uint8)
    final_arr[:, :, 3] = 255
    night_im = Image.fromarray(final_arr, 'RGBA')
    night_path = os.path.join(PUB_OUT, 'demo_modern_night.png')
    night_im.save(night_path)
    print(f'DEMO OK: day -> {day_path} ({W}x{H}), night -> {night_path} (light pools={len(lights)})')


def render_galleries(objects, buildings):
    """Build compact full-catalog visual index sheets for the morning report (all 100 objects & all 100 buildings)."""
    # 1. Objects 100 gallery (10 cols x 10 rows, 2x scale in uniform cells)
    cols = 10
    cell_w, cell_h = 112, 92
    rows = (len(objects) + cols - 1) // cols
    og = Image.new('RGBA', (cols * cell_w + 16, rows * cell_h + 36), (26, 30, 38, 255))
    dr = ImageDraw.Draw(og)
    dr.text((12, 10), f'Fable Modern Objects — Complete 100-Asset Index ({len(objects)} sprites, locked palette)', fill=(240, 245, 255, 255))
    for i, o in enumerate(objects):
        im = Image.open(o['path']).convert('RGBA')
        scale = 2 if (im.width * 2 <= cell_w - 14 and im.height * 2 <= cell_h - 24) else 1
        ims = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
        r, c = i // cols, i % cols
        bx, by = 8 + c * cell_w, 30 + r * cell_h
        bg = Image.new('RGBA', (cell_w - 8, cell_h - 20), (96, 114, 88, 255))
        bg.alpha_composite(ims, ((bg.width - ims.width) // 2, bg.height - ims.height - 4))
        og.alpha_composite(bg, (bx + 4, by + 16))
        dr.text((bx + 6, by + 2), o['id'].replace('mf-obj-', '')[:16], fill=(215, 224, 238, 255))
    og.save(os.path.join(PUB_OUT, 'gallery_objects_100.png'))

    # 2. Buildings 100 gallery (10 cols x 10 rows — 1 row per themed pack!, 1x native crisp scale)
    b_cols = 10
    bw, bh = 166, 206
    b_rows = (len(buildings) + b_cols - 1) // b_cols
    bg_im = Image.new('RGBA', (b_cols * bw + 16, b_rows * bh + 36), (24, 28, 36, 255))
    drb = ImageDraw.Draw(bg_im)
    drb.text((12, 10), f'Fable Modern Buildings — Complete 100-Building Index (10 Themed Packs x 10, 1x Native)', fill=(240, 245, 255, 255))
    for i, b in enumerate(buildings):
        im = Image.open(b['path']).convert('RGBA')
        r, c = i // b_cols, i % b_cols
        bx, by = 8 + c * bw, 30 + r * bh
        pad = Image.new('RGBA', (bw - 8, bh - 20), (92, 108, 84, 255))
        pad.alpha_composite(im, ((pad.width - im.width) // 2, pad.height - im.height - 2))
        bg_im.alpha_composite(pad, (bx + 4, by + 16))
        drb.text((bx + 6, by + 2), b['id'].replace('mf-bldg-', '')[:22], fill=(220, 228, 240, 255))
    bg_im.save(os.path.join(PUB_OUT, 'gallery_buildings_100.png'))
    print(f'GALLERIES OK: {PUB_OUT}/gallery_objects_100.png & gallery_buildings_100.png')


def main():
    os.makedirs(PUB_OUT, exist_ok=True)
    grounds, objects, buildings = load_all_assets()
    print(f'Loaded: {len(grounds)} ground, {len(objects)} objects, {len(buildings)} buildings')
    bake_tileset(grounds, objects, buildings)
    render_city_showcases(grounds, objects, buildings)
    render_galleries(objects, buildings)


if __name__ == '__main__':
    main()

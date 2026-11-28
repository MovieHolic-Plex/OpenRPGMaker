#!/usr/bin/env python3
"""Append-only baker for Carbon Medium remakes across jp_city, modern_city, and modern_campus.

  python3 scripts/content/bake_carbon_remakes.py [--dry]
  python3 scripts/content/bake_carbon_remakes.py gate

Rules:
- Strictly enforces object_gate.refusal(im, kind=..., context='bundle') is None for every piece.
- Strictly append-only: verifies 0 pixel mutations on every pre-existing tile across all sheets.
- Stable slot pinning via each bundle's baked.json (idempotent across re-runs).
- Zero color remapping / zero resampling: raw RGBA pixels from pieces/<id>.png are preserved bit-for-bit.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))

import numpy as np
from PIL import Image
import object_gate as OG

T = 16
SOLID = dict(up=False, down=False, left=False, right=False)
PASS = dict(up=True, down=True, left=True, right=True)
PC_TABLE = {
    'solid': ('lower', False, 'blocked', 'upper'),
    'star': ('upper', True, 'overhead', 'upper'),
    'flat': ('lower', True, 'walkable', 'lower'),
}
PC_NOTE = {
    'solid': '막힘(위층)',
    'star': '솟은 칸 ★(통행 가능·사람 위에 그림)',
    'flat': '바닥 그림(통행 가능·사람 밑)',
}

BUNDLES = [
    dict(
        tileset='jp_city',
        theme_ko='일본 도시',
        spec='tiledata/jp-city/carbon-city/spec.json',
        png='public/assets/jp-city/jp-city-chipset.png',
        def_json='src/assets/jpCityTileset.json',
        sheet_json='src/assets/jpCitySheet.json',
        pins_json=None,
        group_id='jp:carbon-remake',
        group_name='Carbon 재작화(일본 도시)',
        pin_prefix='carbon_jp',
    ),
    dict(
        tileset='modern_city',
        theme_ko='현대 도시',
        spec='tiledata/modern-city/carbon-interior/spec.json',
        png='public/assets/modern-city/modern-city-chipset.png',
        def_json='src/assets/modernCityTileset.json',
        sheet_json='src/assets/modernCitySheet.json',
        pins_json='tiledata/modern-city/pins.json',
        group_id='mc:carbon-interior',
        group_name='Carbon 재작화(현대 도시 실내)',
        pin_prefix='carbon_mc',
    ),
    dict(
        tileset='modern_campus',
        theme_ko='현대 캠퍼스',
        spec='tiledata/modern-campus/carbon-campus/spec.json',
        png='public/assets/modern-campus/modern-campus-chipset.png',
        def_json='src/assets/modernCampusTileset.json',
        sheet_json='src/assets/modernCampusSheet.json',
        pins_json=None,
        group_id='campus:carbon-remake',
        group_name='Carbon 재작화(캠퍼스)',
        pin_prefix='carbon_campus',
    ),
]


def gate_kind(it):
    k = it.get('kind', 'other')
    if k in ('prop',):
        return 'other'
    if k == 'furniture':
        return 'box'
    return k


def load_bundle_pieces(bundle):
    spec_path = os.path.join(ROOT, bundle['spec'])
    base_dir = os.path.dirname(spec_path)
    sp = json.load(open(spec_path, encoding='utf-8'))
    out = []
    for it in sp['items']:
        im = Image.open(os.path.join(base_dir, 'pieces', f"{it['id']}.png")).convert('RGBA')
        assert im.size == (it['w'] * T, it['h'] * T), (it['id'], im.size, (it['w'] * T, it['h'] * T))
        out.append((it, im))
    return sp, base_dir, out


def check_gate_all():
    opened, blocked = [], []
    for b in BUNDLES:
        _sp, _bd, pcs = load_bundle_pieces(b)
        for it, im in pcs:
            label = f"{b['tileset']}/{it['id']}"
            why = OG.refusal(im, kind=gate_kind(it), context='bundle')
            if why is None:
                opened.append(label)
            else:
                blocked.append((label, why))
    return opened, blocked


def solid_cells(it):
    w, h = it['w'], it['h']
    if 'block' in it:
        return {tuple(c) for c in it['block']}
    if it.get('type') == 'building':
        ps = set(it.get('pass', []))
        depth = int(it.get('depth', 2))
        return {(x, y) for y in range(h - depth, h) for x in range(w) if x not in ps}
    if it.get('place') in ('roof', 'decal'):
        return set()
    return {(x, h - 1) for x in range(w)}


def bake_bundle(bundle, dry=False):
    sp, base_dir, pcs = load_bundle_pieces(bundle)
    waiver_id = sp.get('waiver', 'carbon-remake-w1-3-2026-11-28')

    # Gate check first
    for it, im in pcs:
        why = OG.refusal(im, kind=gate_kind(it), context='bundle')
        if why is not None:
            raise SystemExit(f"3/4 관문 출구 막힘 {bundle['tileset']}/{it['id']}: {why}")

    def_path = os.path.join(ROOT, bundle['def_json'])
    sheet_path = os.path.join(ROOT, bundle['sheet_json'])
    png_path = os.path.join(ROOT, bundle['png'])
    own_path = os.path.join(base_dir, 'baked.json')
    pins_path = os.path.join(ROOT, bundle['pins_json']) if bundle['pins_json'] else None

    data = json.load(open(def_path, encoding='utf-8'))
    own = json.load(open(own_path, encoding='utf-8')) if os.path.exists(own_path) else {'version': 1, 'cells': {}}
    pins = json.load(open(pins_path, encoding='utf-8')) if pins_path and os.path.exists(pins_path) else None

    count0, tpr = int(data['count']), int(data['tilesPerRow'])
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}
    kit_defs = []

    def slot(name):
        nonlocal count
        if name in own['cells']:
            return own['cells'][name]
        tid = count
        count += 1
        own['cells'][name] = tid
        if pins is not None:
            pins['cells'][name] = tid
        return tid

    how_waiver = f"3/4 관문 미통과 — 오너 면제 그림({waiver_id})."

    for it, im in pcs:
        w, h = int(it['w']), int(it['h'])
        decal = it.get('place') == 'decal'
        solid = solid_cells(it)
        kid = it['id']
        rows = []
        for y in range(h):
            r = []
            for x in range(w):
                cell = im.crop((x * T, y * T, x * T + T, y * T + T))
                arr = np.asarray(cell)
                if not arr[:, :, 3].any():
                    r.append(-1)
                    continue
                pc = 'flat' if decal else ('solid' if (x, y) in solid else 'star')
                tid = slot(f"{bundle['pin_prefix']}:{kid}:{x},{y}")
                mine[tid] = (cell, pc, f"{it['name']} ({x + 1},{y + 1})", kid, it)
                r.append(tid)
            rows.append(r)

        is_bldg = it.get('type') == 'building'
        ps = set(it.get('pass', []))
        doors = list(it.get('doors', []))
        parts = [dict(kind='entrance', x=c, y=h - 1, w=1, h=1, label='출입구') for c in doors if c not in ps] if is_bldg else []
        access = [dict(x=c, y=h) for c in doors] if is_bldg else []
        role = 'building' if is_bldg else 'prop'
        desc = f"{it['name']} ({it['en']}) — Carbon Medium 재작화(대체: {it.get('replaces', '')}). {how_waiver}"

        ai = dict(
            description=desc[:400],
            placementRules=it.get('rule', ''),
            tags=['Carbon 그림', bundle['tileset']] + list(it.get('tags', [])) + list(it.get('words', [])),
            role=role,
            repeatability='fixed',
            layerHome='upper',
            themes=[bundle['theme_ko']],
            origin='ai',
            confidence='high',
        )
        if is_bldg:
            ai['snap'] = 'floor'
            ai['anchor'] = dict(dx=w // 2, dy=h - 1)
            ai['access'] = access
        else:
            ai['snap'] = 'floor'
            ai['anchor'] = dict(dx=0, dy=h - 1)

        kit_obj = dict(
            id=kid,
            kind='section',
            name=it['name'],
            width=w,
            height=h,
            tileSize=T,
            rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows],
            learnedFrom='db-authored',
            ai=ai,
        )
        if parts:
            kit_obj['parts'] = parts
        kit_defs.append(kit_obj)

    old = Image.open(png_path).convert('RGBA')
    rows_n = math.ceil(count / tpr)
    assert rows_n * T <= 8192, (bundle['tileset'], rows_n * T)
    sheet = Image.new('RGBA', (tpr * T, max(rows_n * T, old.height)), (0, 0, 0, 0))
    sheet.paste(old, (0, 0))
    for tid, (cell, *_rest) in mine.items():
        x, y = (tid % tpr) * T, (tid // tpr) * T
        sheet.paste(Image.new('RGBA', (T, T), (0, 0, 0, 0)), (x, y))
        sheet.paste(cell, (x, y))
        assert np.array_equal(np.asarray(sheet.crop((x, y, x + T, y + T))), np.asarray(cell)), tid

    # Strict append-only guarantee: zero prior tiles mutated (including already-pinned owned slots)
    a0 = np.asarray(old)
    a1 = np.asarray(sheet)[:old.height]
    prior_slots = min(count0, (old.height // T) * tpr)
    changed = [
        t for t in range(prior_slots)
        if not np.array_equal(
            a0[(t // tpr) * T:(t // tpr) * T + T, (t % tpr) * T:(t % tpr) * T + T],
            a1[(t // tpr) * T:(t // tpr) * T + T, (t % tpr) * T:(t % tpr) * T + T],
        )
    ]
    assert not changed, (bundle['tileset'], '앞 번호 그림이 바뀌었다', changed[:10])

    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(
                dict(SOLID) if key == 'passability'
                else 'lower' if key == 'priority'
                else 0 if key == 'terrain'
                else dict(label='', description='사용하지 않는 칸.', source='unknown')
            )

    for tid, (_cell, pc, label, kid, it) in mine.items():
        prio, passable, passage, home = PC_TABLE[pc]
        data['passability'][tid] = dict(PASS) if passable else dict(SOLID)
        data['priority'][tid] = prio
        data['terrain'][tid] = 0
        data['tileMeta'][tid] = dict(
            label=label,
            description=f"{PC_NOTE[pc]}. 키트 {kid} 로 찍는다(낱칸으로 칠하지 않는다). {how_waiver}",
            role='building' if it.get('type') == 'building' else 'prop',
            passage=passage,
            defaultLayer=home,
            tags=['Carbon 그림', bundle['tileset'], kid] + list(it.get('words', [])),
            source='bundled-default',
            confidence='high',
            repeatability='fixed',
            layerBacking='none',
        )

    data['count'] = max(count0, count)
    if data.get('libraryEnd') is not None:
        data['libraryEnd'] = data['count']

    gid = bundle['group_id']
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] != gid]
    data['tileGroups'].append(dict(
        id=gid,
        name=bundle['group_name'],
        role='prop',
        defaultLayer='upper',
        tileIds=sorted(mine),
        description=f"Carbon Medium 재작화 키트({len(kit_defs)}종): " + ' · '.join(it['name'] for it, _ in pcs) + f". {how_waiver}",
        placementRules='키트째 위층에 찍는다. 낱칸으로 칠하지 않는다.',
        source='bundled-default',
        confidence='high',
        layerHome='upper',
    ))

    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids] + kit_defs

    report = dict(
        tileset=bundle['tileset'],
        waiver=waiver_id,
        count_before=count0,
        count_after=data['count'],
        owned_cells=len(mine),
        kits=[k['id'] for k in kit_defs],
        sheet=[sheet.width, sheet.height],
        prior_tiles_changed=0,
    )
    if not dry:
        sheet.save(png_path, optimize=True)
        with open(def_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        with open(sheet_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(dict(count=data['count'], tilesPerRow=tpr), ensure_ascii=False, separators=(',', ': ')) + '\n')
        if pins is not None and pins_path is not None:
            pins['count'] = max(pins.get('count', 0), data['count'])
            with open(pins_path, 'w', encoding='utf-8') as f:
                f.write(json.dumps(pins, ensure_ascii=False, separators=(',', ':')) + '\n')
        own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
        with open(own_path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(own, ensure_ascii=False, indent=0) + '\n')
    return report


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gate':
        opened, blocked = check_gate_all()
        print(f"gate: open={len(opened)} blocked={len(blocked)}")
        for b in blocked:
            print(f"  BLOCKED {b[0]}: {b[1]}")
        sys.exit(1 if blocked else 0)
    dry = '--dry' in sys.argv
    out = [bake_bundle(b, dry=dry) for b in BUNDLES]
    print(json.dumps(out, ensure_ascii=False, indent=2))

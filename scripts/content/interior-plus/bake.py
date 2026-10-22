"""interior-plus 굽기 — 박물관·배 안·투기장 조각을 atlas_biome_interior 시트 끝에 덧붙인다(기존 칸 번호 불변, 덧붙이기 전용).

  python3 scripts/content/interior-plus/bake.py [--repack]

- 번호 핀: tiledata/hand-interior/plus/pins.json — {base, slots:{키: 칸}}. 같은 키는 늘 같은 칸, 새 키는 끝에 붙는다.
  base = 덧붙이기 전 시트 칸 수(build_tileset.py 의 굽기 끝). 다시 돌리면 base 뒤를 지우고 핀 순서로 다시 싣는다.
- object-gate: 기물(가구·걸이·무늬)마다 그림 화소 해시 영수증이 통과여야 한다(require_all, context bundle). 바닥·벽면은 조립 방 영수증
  (gate_rooms.py) 이 그 칸을 화소 그대로 품을 때만 통과로 센다.
- 시트에 쓰기 전에 실내 공통 팔레트 v6 로 옮긴다(palette_snap — build_tileset.py 와 같은 단계).
- 산출: public/assets/atlas-interior/interior-chipset.png · src/assets/atlasBiomeInteriorTileset.json · atlasBiomeInteriorSheet.json ·
  handInteriorSpec.json(floors·walls·objects·rooms) — 덧붙인 부분만 바뀐다.
"""
import json, os, sys, hashlib
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, iplib
ROOT = iplib.ROOT; TD = iplib.TD
SHEET = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
TSJ = os.path.join(ROOT, 'src/assets/atlasBiomeInteriorTileset.json')
SHJ = os.path.join(ROOT, 'src/assets/atlasBiomeInteriorSheet.json')
SPJ = os.path.join(ROOT, 'src/assets/handInteriorSpec.json')
PINS = os.path.join(TD, 'pins.json')
MARK = 'interior-plus'
CAT_KO = {'museum': '박물관·미술관', 'ship': '배 선실', 'arena': '투기장', 'puzzle': '퍼즐 방', 'observatory': '천문대'}
SLIDE = {'ice': 'ice'}   # 미끄러지는 바닥 → 타일셋 slideTiles 규칙(src/project/slideTiles.ts)
PIT_SIDE = (('N', 1, '북'), ('E', 4, '동'), ('S', 16, '남'), ('W', 64, '서'))
STAR = ' 솟은 칸·걸이(★): 캐릭터 위에 그리고 통행은 아래 층이 정한다.'
FLAT = ' 밟는 칸(o): 붓은 위층에 깔고(바닥 유지), 캐릭터 밑에 그린다. 조립 도구는 2층에 둔다.'


def mul(c, f): return tuple(max(0, min(255, int(round(v * f)))) for v in c[:3])


def floor_tile(fd, qx, qy, sh):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for ly in range(16):
        for lx in range(16):
            c = fd['fn'](qx * 16 + lx, qy * 16 + ly)[:3]
            if sh & 1 and ly < 3: c = mul(c, 0.6 + 0.12 * ly)
            if sh & 2 and lx < 6: c = mul(c, 0.62 + 0.06 * lx)
            px[lx, ly] = c + (255,)
    return im


def wall_tile(wd, col, row, west):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for ly in range(16):
        for lx in range(16):
            fy = ly + (row - 1) * 16
            c = wd['fn'](col * 16 + lx, fy)[:3]
            if fy < 4: c = mul(c, 0.62 + 0.08 * fy)
            if west and lx < 6: c = mul(c, 0.62 + 0.06 * lx)
            px[lx, ly] = c + (255,)
    return im


def cells_of(p, im):
    """그림 → [(dx, dy, 16px 그림, 발밑?)]. 발밑 칸은 비어도 남긴다(막힘), 솟은 칸·걸이는 빈 칸을 뺀다."""
    out = []
    W, H = im.width // 16, im.height // 16
    if p['kind'] in ('floor', 'wall'):
        top = H - p['h']
        for j in range(H):
            for i in range(W):
                t = im.crop((i * 16, j * 16, i * 16 + 16, j * 16 + 16))
                foot = j >= top
                if not foot and t.getbbox() is None: continue
                out.append((i, j - top, t, foot))
    else:
        for j in range(H):
            for i in range(W):
                t = im.crop((i * 16, j * 16, i * 16 + 16, j * 16 + 16))
                if t.getbbox() is None: continue
                out.append((i, j, t, False))
    return out


def gate_items(reg):
    """기물 그림(투명 PNG)과 판정 종류 — gate_export.py 와 같은 목록."""
    return [(pid, iplib.render(reg.pieces[pid]), reg.pieces[pid]['gate']) for pid in reg.order]


def main(repack=False):
    reg = loader.load()
    pins = json.load(open(PINS)) if os.path.exists(PINS) else {}
    ts = json.load(open(TSJ)); sp = json.load(open(SPJ)); sheet = Image.open(SHEET).convert('RGBA')
    base = pins.get('base')
    if base is None or not (ts['count'] >= base and (ts['count'] == base or MARK in (ts['tileMeta'][base].get('tags') or []))):
        base = ts['count']
        if pins.get('base') is not None: print('base 가 바뀌었다(시트를 다시 구웠다) — 덧붙임을 새 끝에서 다시 시작', pins['base'], '→', base)
        pins = {'base': base, 'slots': {}}
    slots = pins.setdefault('slots', {})
    mine = {k.split(':')[1] for k in slots if k.startswith(('floor:', 'wall:'))}
    if repack:   # 아직 내보내지 않은 판에서만 — 번호를 처음부터 다시 빽빽하게(이미 깐 맵의 칸이 바뀐다)
        prev_ids = pins.get('ids', [])
        pins = {'base': base, 'slots': {}, 'ids': prev_ids}; slots = pins['slots']

    # 기존 덧붙임 지우기(사양·정의에서 plus 항목)
    plus_prev = set(pins.get('ids', []))
    for k in ('passability', 'priority', 'terrain', 'tileMeta'): ts[k] = ts[k][:base]
    ts['tileGroups'] = [g for g in ts['tileGroups'] if not g['id'].startswith('hand-interior:plus') and not g['id'].startswith('hand-interior:pit:')]
    ts['tileGroups'] = [g for g in ts['tileGroups'] if g['id'] not in {f'hand-interior:floor:{f}' for f in reg.floors} | {f'hand-interior:wall:{w}' for w in reg.walls}]
    ts['structureKits'] = [k for k in ts['structureKits'] if k['id'][len('hand-interior:'):] not in plus_prev]
    clash = [f for f in list(reg.floors) + list(reg.walls) if (f in sp['floors'] or f in sp['walls']) and f not in mine]
    if clash: raise SystemExit(f'이미 있는 v5 바닥·벽면 id 와 겹친다: {clash}')
    for f in reg.floors: sp['floors'].pop(f, None)
    for w in reg.walls: sp['walls'].pop(w, None)
    for o in plus_prev: sp['objects'].pop(o, None)
    sp.setdefault('pits', {})
    for pid in reg.pits: sp['pits'].pop(pid, None)
    ts['slideTiles'] = {k: v for k, v in (ts.get('slideTiles') or {}).items() if int(k) < base}

    import gate_rooms   # 기물 영수증 + 바닥·벽면 조립 방 영수증(미보정 프로필이면 현재 프로필 PASS 를 임시 통과로 센다 — 보고에 적힌다). 우회 인자는 없다(--no-gate 는 2026-10-15 제거)
    gate_rooms.require_structure(reg)

    tiles = {}   # 칸 번호 → (그림, meta, pass, prio)
    nxt = [max([base - 1] + list(slots.values())) + 1]

    def slot(key):
        if key not in slots: slots[key] = nxt[0]; nxt[0] += 1
        return slots[key]

    def put(key, im, meta, solid, prio):
        n = slot(key); tiles[n] = (im, meta, solid, prio); return n

    def meta(label, desc, role, passage, layer, tags, locked=False):
        m = {'label': label, 'description': desc, 'role': role, 'passage': passage, 'defaultLayer': layer, 'tags': ['손 도트 실내'] + tags + [MARK],
             'source': 'bundled-default', 'confidence': 'high', 'repeatability': 'repeat' if role in ('floor', 'wall') else 'fixed'}
        if locked: m['locked'] = True
        return m

    for fid, fd in reg.floors.items():
        ids = []
        for i in range(fd['cols'] * fd['rows'] * 4):
            qx, qy, sh = (i // 4) % fd['cols'], i // (4 * fd['cols']), i % 4
            ids.append(put(f'floor:{fid}:{i}', floor_tile(fd, qx, qy, sh), meta(f'바닥 · {fd["ko"]}', '', 'floor', 'passable', 'lower', ['바닥']), False, 'lower'))
        sp['floors'][fid] = {'ko': fd['ko'], 'cols': fd['cols'], 'rows': fd['rows'], 'tiles': ids}
        ts['tileGroups'].append({'id': f'hand-interior:floor:{fid}', 'name': f'바닥 · {fd["ko"]}', 'role': 'floor', 'defaultLayer': 'lower', 'tileIds': ids,
            'description': f'손 도트 실내 바닥 {fd["ko"]}: {len(ids)}칸 = {fd["cols"]}×{fd["rows"]} 위치(칸 x%{fd["cols"]}, y%{fd["rows"]}) × 그림자 4(없음·벽면 밑 접촉·서쪽·둘 다). 번호 = 첫 칸 + ((y%{fd["rows"]})*{fd["cols"]} + x%{fd["cols"]})*4 + 그림자.',
            'placementRules': '방 바닥. build_hand_interior_room 이 평면 문자열에서 자동으로 고른다.', 'source': 'bundled-default', 'confidence': 'high'})
    for wid, wd in reg.walls.items():
        ids = []
        for i in range(wd['cols'] * 4):
            col, row, west = (i // 2) % wd['cols'], 1 + i // (2 * wd['cols']), i % 2
            ids.append(put(f'wall:{wid}:{i}', wall_tile(wd, col, row, west), meta(f'벽면 · {wd["ko"]}', '', 'wall', 'solid', 'lower', ['벽']), True, 'lower'))
        sp['walls'][wid] = {'ko': wd['ko'], 'cols': wd['cols'], 'tiles': ids}
        ts['tileGroups'].append({'id': f'hand-interior:wall:{wid}', 'name': f'벽면 · {wd["ko"]}', 'role': 'wall', 'defaultLayer': 'lower', 'tileIds': ids,
            'description': f'손 도트 실내 벽면 {wd["ko"]}: {len(ids)}칸 = 윗줄/아랫줄 × {wd["cols"]}열(x%{wd["cols"]}) × 서쪽 그림자. 번호 = 첫 칸 + ((줄*{wd["cols"]} + x%{wd["cols"]})*2 + 서쪽).',
            'placementRules': '막힌 칸 바로 아래 두 줄. 이어진 벽 하나에 재질 하나.', 'source': 'bundled-default', 'confidence': 'high'})

    for fid, rule in SLIDE.items():
        if fid in sp['floors'] and fid in reg.floors:
            for n in sp['floors'][fid]['tiles']: ts['slideTiles'][str(n)] = rule

    for pid, pd in reg.pits.items():
        ids = []
        for m in iplib.PIT_MASKS:
            sides = [ko for _, b, ko in PIT_SIDE if not m & b]
            inner = [ko for b, ko, need in ((2, '북동', 1 | 4), (8, '남동', 16 | 4), (32, '남서', 16 | 64), (128, '북서', 1 | 64)) if (m & need) == need and not m & b]
            name = ('가장자리 ' + '·'.join(sides) if sides else '속') + (' + 안모서리 ' + '·'.join(inner) if inner else '')
            desc = f'{pd["ko"]}(밑 없는 구멍) {name} — 마스크 {m}. 막힌 칸. 위에 판자 다리(plank bridge)를 2층에 덮어 건너게 한다.'
            ids.append(put(f'pit:{pid}:{m}', iplib.pit_render(pd, m), meta(f'{pd["ko"]} · {name}', desc, 'terrain', 'solid', 'lower', [pd['ko'], '구멍', '퍼즐 방']), True, 'lower'))
        sp['pits'][pid] = {'ko': pd['ko'], 'masks': list(iplib.PIT_MASKS), 'tiles': ids}
        ts['tileGroups'].append({'id': f'hand-interior:pit:{pid}', 'name': f'{pd["ko"]} 가장자리(47)', 'role': 'terrain', 'defaultLayer': 'lower', 'tileIds': ids,
            'description': f'{pd["ko"]} 오토타일 47칸: 8이웃 마스크(N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, 켜짐 = 그 이웃도 구멍, 대각은 양옆 직교가 둘 다 켜졌을 때만) → 칸. '
                           f'사양 handInteriorSpec.pits.{pid} 의 masks[i] ↔ tiles[i]. 북이 바닥이면 먼 벽 바위 낯, 남이 바닥이면 가까운 바닥 입술, 서·동은 옆벽 띠.',
            'placementRules': '구멍 칸마다 이웃으로 마스크를 계산해 고른다. 지도 밖은 바닥으로 본다. 건너는 길은 판자 다리를 2층에 덮는다.', 'source': 'bundled-default', 'confidence': 'high'})

    clash = [pid for pid in reg.order if pid in sp['objects']]
    if clash: raise SystemExit(f'이미 있는 v5 기물 id 와 겹친다 — 이름을 바꾼다: {clash}')
    ids_done = []
    for pid in reg.order:
        p = reg.pieces[pid]; im = iplib.render(p)
        cat_ko = CAT_KO.get(p['cat'], p['cat'])
        cells = []
        rows_kit = {}
        for dx, dy, t, foot in cells_of(p, im):
            if p['kind'] == 'flat':
                n = put(f'obj:{pid}:{dx},{dy}', t, meta(f'{p["ko"]} ({dx},{dy})', p['desc'] + FLAT, 'decor', 'passable', 'upper', [cat_ko], locked=True), False, 'lower')
                cells.append([dx, dy, n, 2])
            elif foot:
                n = put(f'obj:{pid}:{dx},{dy}', t, meta(f'{p["ko"]} ({dx},{dy})', p['desc'], 'furniture', 'solid', 'upper', [cat_ko]), True, 'upper')
                cells.append([dx, dy, n, 3])
            else:
                n = put(f'obj:{pid}:{dx},{dy}', t, meta(f'{p["ko"]} ({dx},{dy})', p['desc'] + STAR, 'furniture', 'passable', 'upper', [cat_ko]), False, 'upper')
                cells.append([dx, dy, n, 3])
            rows_kit[(dx, dy)] = n
        h_spec = 0 if p['kind'] == 'hang' else p['h']
        o = {'ko': p['ko'], 'category': p['cat'], 'category_ko': cat_ko, 'kind': p['kind'], 'w': p['w'], 'h': h_spec, 'up': p['up'] if p['kind'] in ('floor', 'wall') else 0,
             'cells': cells, 'desc': p['desc'][:60], 'tags': p['tags'][:4], 'place': p['place'][:60], 'pair': p['pair'][:3], 'use': p['use']}
        if p['facing']: o['facing'] = p['facing']
        if p['surface']: o['surface'] = [1]
        sp['objects'][pid] = o
        ids_done.append(pid)
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
        y0, y1 = min(ys), max(ys); x1 = max(xs)
        kit_rows = [{'tiles': [-1] * (x1 + 1), 'upperTiles': [rows_kit.get((x, y), -1) for x in range(x1 + 1)]} for y in range(y0, y1 + 1)]
        snap = 'wall' if p['kind'] in ('wall', 'hang') else 'floor'
        rules = {'hang': '벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다', 'flat': '밟을 수 있다. 다른 기물 밑에 먼저 깐다'}.get(p['kind'])
        if not rules:
            rules = ('발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다; ' if p['kind'] == 'wall' else '') + \
                    (f'그림이 발밑 칸 위로 {p["up"]}px 솟는다 → 위 {-y0}칸은 플레이어 위에 그리는 겹침층; ' if y0 < 0 else '') + '출입문 칸과 문으로 이어지는 통로를 막지 않는다'
        ts['structureKits'].append({'id': f'hand-interior:{pid}', 'kind': 'section', 'name': p['ko'], 'width': x1 + 1, 'height': y1 - y0 + 1, 'rows': kit_rows,
            'ai': {'snap': snap, 'tags': ['손 도트 실내', cat_ko], 'origin': 'ai', 'layerHome': 'upper', 'description': p['desc'], 'repeatability': 'fixed',
                   'placementRules': rules, 'anchor': {'dx': 0, 'dy': -y0}}, 'learnedFrom': 'hand-interior-plus'})

    # 방 종류·건물·예제
    rj = os.path.join(TD, 'rooms.json')
    if os.path.exists(rj):
        R = json.load(open(rj))
        for k, v in R.get('kinds', {}).items(): sp['rooms']['kinds'][k] = v
        for k, v in R.get('buildings', {}).items(): sp['rooms']['buildings'][k] = v
        prev_ex = set(R.get('example_maps', []))
        sp['rooms']['examples'] = [e for e in sp['rooms']['examples'] if e[0] not in prev_ex] + R.get('examples', [])

    # 칸 채우기(번호 순, 빈 번호 없이)
    count = max(tiles) + 1 if tiles else base
    missing = [n for n in range(base, count) if n not in tiles]
    if missing: raise SystemExit(f'핀에 빈 번호 {missing[:10]} — 없어진 조각이 있다. pins.json 을 확인하고 그 키를 남기거나 같은 그림으로 채운다')
    # 팔레트 v6 로 옮기기(한 장으로 모아 한 번에)
    sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'hand-interior-pick'))
    from palette_snap import snap as snap_image
    rows_needed = (count + 47) // 48
    out = Image.new('RGBA', (48 * 16, rows_needed * 16), (0, 0, 0, 0))
    out.paste(sheet.crop((0, 0, 48 * 16, min(sheet.height, ((base + 47) // 48) * 16))), (0, 0))
    # base 뒤 칸은 비우고 다시 그린다
    for n in range(base, rows_needed * 48):
        x, y = (n % 48) * 16, (n // 48) * 16
        out.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y))
    strip = Image.new('RGBA', ((count - base) * 16, 16), (0, 0, 0, 0))
    for n in range(base, count): strip.paste(tiles[n][0], ((n - base) * 16, 0))
    strip = snap_image(strip)[0]
    for n in range(base, count):
        x, y = (n % 48) * 16, (n // 48) * 16
        out.paste(strip.crop(((n - base) * 16, 0, (n - base) * 16 + 16, 16)), (x, y))
    for n in range(base, count):
        im, m, solid, prio = tiles[n]
        ts['passability'].append({'up': not solid, 'down': not solid, 'left': not solid, 'right': not solid})
        ts['priority'].append(prio); ts['terrain'].append(0); ts['tileMeta'].append(m)
    ts['count'] = count
    out.save(SHEET, optimize=True)
    json.dump(ts, open(TSJ, 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'count': count, 'tilesPerRow': 48}, open(SHJ, 'w'))
    with open(SPJ, 'w') as f: json.dump(sp, f, ensure_ascii=False, separators=(',', ':'))
    pins['ids'] = ids_done
    os.makedirs(TD, exist_ok=True)
    json.dump(pins, open(PINS, 'w'), ensure_ascii=False, indent=0)
    print(f'base {base} → count {count} (+{count - base}), 기물 {len(ids_done)}, 바닥 {len(reg.floors)}, 벽면 {len(reg.walls)}, 구멍 {len(reg.pits)}, 미끄럼 {len(ts["slideTiles"])}')


if __name__ == '__main__':
    main(repack='--repack' in sys.argv)

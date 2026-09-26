"""Build user-local direct-authoring family tilesets from the user's PAW PNGs and reviewed catalog recipes.

Usage: prepare-pixel-art-world-direct-families.py <user PNG dir> <shared-content.sqlite> <private output dir>
Writes <out>/library.json (a shared-content library value) plus review sheets. No pixels are written to Git.
Each family atlas copies whole source cells: floors, one wall stack per sheet, every reviewed recipe, and the
47-variant ceiling autotile from the installed modern-interiors atlas. Numbers in the dictionary are atlas numbers.
"""
import sys, json, base64, io, hashlib, sqlite3, glob, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src_dir, db_file, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
spec = json.loads(Path('tiledata/pixel-art-world/direct-families.json').read_text())
method = Path('tiledata/pixel-art-world/DIRECT-AUTHORING.md').read_text()
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 13)
S = 32

packs = {}
for f in sorted(glob.glob('src/assets/pixelArtWorld*Catalog.json')):
    d = json.loads(Path(f).read_text())
    for p in d if isinstance(d, list) else d.get('packs', []):
        name = str(p.get('filename', ''))
        if name.startswith('ST-') and p.get('recipes') and name not in packs:
            packs[name] = p

loose, loose_images = {}, {}
for pack in json.loads(Path('src/assets/pixelArtWorldLooseCatalog.json').read_text())['packs']:
    for r in pack['recipes']:
        loose[r['id']] = (pack, r)
def loose_image(pack):
    if pack['id'] not in loose_images:
        data = (src_dir / 'by-source/sozai/chips' / pack['filename']).read_bytes()
        if hashlib.sha256(data).hexdigest() != pack['sha256']:
            raise SystemExit('Loose source edition differs: ' + pack['filename'])
        loose_images[pack['id']] = Image.open(io.BytesIO(data)).convert('RGBA')
    return loose_images[pack['id']]

sources = {}
def source(sheet):
    if sheet not in sources:
        pack = packs['ST-' + sheet + '.png']
        data = (src_dir / pack['filename']).read_bytes()
        if hashlib.sha256(data).hexdigest() != pack['sha256']:
            raise SystemExit('Source edition differs: ' + pack['filename'])
        sources[sheet] = (pack, Image.open(io.BytesIO(data)).convert('RGBA'))
    return sources[sheet]

def cell(im, n):
    return im.crop((n % 8 * S, n // 8 * S, n % 8 * S + S, n // 8 * S + S))

def opaque(img):
    return img.getchannel('A').getextrema()[0] == 255

db = sqlite3.connect(f'file:{db_file}?mode=ro', uri=True)
lib = json.loads(db.execute("select payload from content_libraries where id='pixel-art-world-local'").fetchone()[0])
modern = lib['tilesets']['shared_paw_modern_interiors']
modern_img = Image.open(io.BytesIO(base64.b64decode(lib['assets'][modern['image']['id']]['dataUrl'].split(',')[1]))).convert('RGBA')
ceiling_group = next(g for g in modern['autotileGroups'] if g['id'] == 'paw-wall-a01')

def data_url(im, fmt='PNG'):
    buf = io.BytesIO(); im.save(buf, format=fmt, **({'lossless': True} if fmt == 'WEBP' else {}))
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(buf.getvalue()).decode()

library = {'version': 1, 'projectDefaults': True, 'roots': [], 'places': {}, 'regions': {}, 'maps': {}, 'tilesets': {}, 'assets': {}, 'previews': {}}
report = []
for fam in spec['families']:
    cells, keys = [], {}          # atlas cell -> (image, meta)
    def take(img, key, meta):
        if key not in keys:
            keys[key] = len(cells); cells.append((img, meta))
        return keys[key]
    remap = {n: take(cell(modern_img, n), ('ceiling', n), {'label': '연결 천장', 'passage': 'blocked', 'layer': 'lower'})
             for n in ceiling_group['memberTileIds']}
    ceiling = {'paintTile': remap[ceiling_group['memberTileIds'][0]],
               'variantMap': {k: remap[v] for k, v in ceiling_group['variantMap'].items()}}
    materials, objects, kits, sheet_info, sheet_info_loose = {}, [], [], [], []
    for sheet in fam['sheets']:
        pack, im = source(sheet)
        conf = spec['sheets'][sheet]; key = conf['key']
        floors = [n for n in range(16) if opaque(cell(im, n))]
        if pack['floorTile'] in floors:
            floors.remove(pack['floorTile']); floors.insert(0, pack['floorTile'])
        materials['floor-' + key] = {'kind': 'floor', 'source': pack['id'], 'tiles': [floors],
            'mapped': [[take(cell(im, n), (sheet, n), {'label': f'{key} 바닥', 'passage': 'passable', 'layer': 'lower'}) for n in floors]]}
        for name, block in conf.get('extraFloors', {}).items():
            # Patterned floors (tatami) repeat as the whole block, never as single centre cells.
            materials[f'floor-{key}-{name}'] = {'kind': 'floor', 'source': pack['id'], 'tiles': block, 'repeatAsBlock': True,
                'mapped': [[take(cell(im, n), (sheet, n), {'label': f'{key} {name}', 'passage': 'passable', 'layer': 'lower'}) for n in row] for row in block]}
        materials['wall-' + key] = {'kind': 'wall', 'source': pack['id'], 'tiles': [[n] for n in conf['wall']],
            'mapped': [[take(cell(im, n), (sheet, n), {'label': f'{key} 벽 정면', 'passage': 'blocked', 'layer': 'lower'})] for n in conf['wall']]}
        count = 0
        for r in pack['recipes']:
            # The audit knows floor-standing and wall-mounted parts only. Countertop props share an upper cell with
            # their counter, which a two-layer map cannot hold, so they stay out until a layered rule exists.
            if r.get('placementKind') not in ('standing', 'wall-mounted') or 'supportCells' not in r:
                continue
            tiles = [[take(cell(im, n), (sheet, n), {'label': r['name'], 'passage': 'blocked', 'layer': 'upper'}) for n in row] for row in r['tiles']]
            oid = r['id'] if r['id'] not in {o['id'] for o in objects} else key + '-' + r['id']
            kind, support = r['placementKind'], r['supportCells']
            if kind == 'wall-mounted' and len(r['tiles']) > len(conf['wall']) and 'window' not in r['id']:
                # Taller than this sheet's wall face (a urinal or door on a two-row wall; windows stay wall-mounted): its foot stands on the floor.
                kind, support = 'standing', [{'x': x, 'y': len(r['tiles']) - 1} for x in range(len(r['tiles'][0]))]
            objects.append({'id': oid, 'name': r['name'], 'sourceId': pack['id'], 'filename': pack['filename'], 'sha256': pack['sha256'],
                            'originalTiles': r['tiles'], 'tiles': tiles, 'placementKind': kind, 'facing': r['facing'], 'supportCells': support})
            count += 1
        sheet_info.append({'sheet': pack['filename'], 'floor': 'floor-' + key, 'wall': 'wall-' + key, 'wallRows': len(conf['wall']), 'objects': count})
    # Loose single-object sheets: render the reviewed pixel rectangle into its output cell box, then copy cells.
    for rid in fam.get('loose', []):
        pack, r = loose[rid]
        src = loose_image(pack)
        box = r['outputRect']; off = r.get('pixelOffset', {'x': 0, 'y': 0}); pr = r['pixelRect']
        canvas = Image.new('RGBA', (box['width'] * S, box['height'] * S), (0, 0, 0, 0))
        canvas.alpha_composite(src.crop((pr['x'], pr['y'], pr['x'] + pr['width'], pr['y'] + pr['height'])), (off['x'], off['y']))
        wall_kind = r['placementKind'] == 'wall'
        tiles = [[take(canvas.crop((x * S, y * S, x * S + S, y * S + S)), ('loose', rid, x, y), {'label': r['name'], 'passage': 'blocked', 'layer': 'upper'})
                  for x in range(box['width'])] for y in range(box['height'])]
        objects.append({'id': rid, 'name': r['name'], 'sourceId': pack['id'], 'filename': pack['filename'], 'sha256': pack['sha256'],
                        'pixelRect': pr, 'tiles': tiles, 'placementKind': 'wall-mounted' if wall_kind else 'standing', 'facing': r.get('facing', 'south'),
                        'supportCells': [] if wall_kind else [{'x': x, 'y': box['height'] - 1} for x in range(box['width'])]})
        sheet_info_loose.append(rid)
    ids = [o['id'] for o in objects]
    if len(ids) != len(set(ids)):
        raise SystemExit('Duplicate object id in ' + fam['id'])
    tid = 'shared_paw_direct_' + fam['id']
    rows = (len(cells) + 7) // 8
    atlas = Image.new('RGBA', (8 * S, rows * S), (0, 0, 0, 0))
    for i, (img, _) in enumerate(cells):
        atlas.paste(img, (i % 8 * S, i // 8 * S))
    atlas.save(out / f'{tid}.png')
    dictionary = {'tilesetId': tid, 'tileSize': S, 'columns': 8,
                  'sources': [{'filename': source(s)[0]['filename'], 'sha256': source(s)[0]['sha256']} for s in fam['sheets']],
                  'materials': materials, 'ceiling': ceiling, 'objects': objects}
    header = (f"# {fam['name']} — 직접 배치 계열\n\n이 타일셋 하나로 다음 유형을 직접 설계한다: {', '.join(fam['types'])}.\n"
              "시트마다 바닥 재료 floor-<키>와 벽 재료 wall-<키>가 있다. 한 맵의 모든 천장 아래에는 같은 벽 재료를 쓰고, "
              "inspect_interior_layout의 wallMaterial에 그 이름을 넣는다. 가구는 시트가 달라도 섞어 쓸 수 있다. "
              "repeatAsBlock 바닥(다다미)은 mapped 전체 블록을 통째로 반복한다. "
              "카운터 위 소품(계산대 POS·현미경 등)은 카운터와 같은 상위 칸을 써야 해서 이 사전에 없다. 카운터 완전체만 쓴다.\n\n"
              "| 원본 | 바닥 | 벽 | 벽 행 | 가구 수 |\n|---|---|---|---|---|\n"
              + ''.join(f"| {i['sheet']} | {i['floor']} | {i['wall']} | {i['wallRows']} | {i['objects']} |\n" for i in sheet_info)
              + (f"\n낱장 소품 {len(sheet_info_loose)}개(paw-loose-*): 원본 낱장 그림의 검토 영역 전체. standing은 맨 아래 행이 받침, wall-mounted는 벽 정면에 건다.\n" if sheet_info_loose else '') + "\n")
    general = re.sub(r'wall-wood/clinic은2행, wall-sento/gym은3행이다\.', '벽 행 수는 위 표를 따른다.', method)
    dict_md = ('# 직접 배치 재료·가구 사전\n\n완성 맵 좌표나 배열은 없다. 객체 tiles는 현재 번호, originalTiles는 원본 번호.\n\n```json\n'
               + json.dumps(dictionary, ensure_ascii=False, separators=(',', ':')) + '\n```\n')
    if len(dict_md) > 120000:
        raise SystemExit(f'{fam["id"]} dictionary too large: {len(dict_md)}')
    images = []
    # Material swatch: each sheet's floors and wall stack with atlas numbers.
    sw = Image.new('RGB', (1000, 90 * len(sheet_info) + 10), '#ddd'); d = ImageDraw.Draw(sw)
    for j, info in enumerate(sheet_info):
        y = 10 + j * 90; d.text((6, y), info['sheet'], fill='black', font=font)
        x = 180
        for n in materials[info['floor']]['mapped'][0]:
            sw.paste(cells[n][0], (x, y + 20), cells[n][0]); d.text((x, y + 54), str(n), fill='black', font=font); x += 38
        x += 20
        for k, row in enumerate(materials[info['wall']]['mapped']):
            sw.paste(cells[row[0]][0], (x, y + 4 + k * 26), cells[row[0]][0])
        d.text((x + 36, y + 30), info['wall'] + ' ' + str([r[0] for r in materials[info['wall']]['mapped']]), fill='black', font=font)
    images.append({'id': 'materials', 'name': 'materials.webp', 'caption': '시트별 바닥(왼쪽, 번호) · 벽 정면 세로 스택(오른쪽). 번호는 이 타일셋 번호.', 'dataUrl': data_url(sw, 'WEBP')})
    # Object sheets: normal and bottom-row-missing error, like the modern-interiors dictionary.
    for start in range(0, len(objects), 12):
        sheet_img = Image.new('RGB', (1200, 1100), '#ddd'); d = ImageDraw.Draw(sheet_img)
        for j, o in enumerate(objects[start:start + 12]):
            h, w = len(o['tiles']), len(o['tiles'][0])
            pic = Image.new('RGBA', ((2 * w + 1) * S, h * S), (0, 0, 0, 0))
            for yy, row in enumerate(o['tiles']):
                for xx, n in enumerate(row):
                    pic.paste(cells[n][0], (xx * S, yy * S))
                    if not (yy == h - 1 and xx == 0):
                        pic.paste(cells[n][0], ((w + 1 + xx) * S, yy * S))
            x, y = j % 3 * 400, j // 3 * 275
            d.text((x + 5, y + 4), o['id'], font=font, fill='black')
            pic.thumbnail((390, 238), Image.Resampling.NEAREST); sheet_img.paste(pic, (x + 5, y + 30), pic)
        name = f'objects-{start // 12 + 1}'
        images.append({'id': name, 'name': name + '.webp', 'caption': '각 객체 왼쪽 정상 / 오른쪽 하단 한 칸 누락. ' + ', '.join(o['id'] for o in objects[start:start + 12]), 'dataUrl': data_url(sheet_img, 'WEBP')})
    category = {'id': 'direct-authoring', 'name': '직접 배치 · 재료와 가구 사전', 'description': fam['name'] + ' — 완성 맵 없이 새 평면 설계. 재료/가구 전체 배열/지지/방향/정상·오류.',
                'documents': [{'id': 'method', 'name': '직접 배치 방법', 'markdown': header + general},
                              {'id': 'dictionary', 'name': '재료·가구 사전', 'markdown': dict_md}], 'images': images}
    meta = [m for _, m in cells]
    image_id = tid + '_image'
    library['assets'][image_id] = {'id': image_id, 'name': tid + '-local.png', 'kind': 'chipset',
        'meta': {'tileSize': S, 'width': 8 * S, 'height': rows * S, 'frameWidth': S, 'frameHeight': S, 'frames': rows * 8}, 'dataUrl': data_url(atlas)}
    pad = rows * 8 - len(cells)
    meta += [{'label': '정렬 공백', 'passage': 'blocked', 'layer': 'lower'}] * pad
    library['tilesets'][tid] = {
        'id': tid, 'name': 'PAW 직접 배치 · ' + fam['name'], 'kind': 'custom', 'image': {'type': 'uploaded', 'id': image_id},
        'tileSize': S, 'tilesPerRow': 8, 'count': rows * 8,
        'passability': [{d: m['passage'] == 'passable' for d in ('up', 'down', 'left', 'right')} for m in meta],
        'priority': [m['layer'] for m in meta], 'terrain': [0] * len(meta),
        'tileMeta': [{'label': m['label'], 'description': m['label'], 'defaultLayer': m['layer'], 'passage': m['passage'], 'source': 'imported'} for m in meta],
        'tileGroups': [],
        'autotileGroups': [{'id': 'paw-wall-a01', 'name': ceiling_group.get('name', '연결 천장'), 'neighborhood': ceiling_group.get('neighborhood', 8),
                            'memberTileIds': [remap[n] for n in ceiling_group['memberTileIds']], 'variantMap': ceiling['variantMap']}],
        'structureKits': [{'id': o['id'], 'name': o['name'], 'kind': 'section', 'width': len(o['tiles'][0]), 'height': len(o['tiles']), 'tileSize': S,
                           'rows': [{'tiles': [-1] * len(row), 'upperTiles': row} for row in o['tiles']], 'learnedFrom': 'db-authored',
                           'ai': {'description': o['name'], 'placementRules': '전체 고정 배열. ' + o['placementKind'] + ' 받침 ' + json.dumps(o['supportCells']),
                                  'repeatability': 'fixed', 'layerHome': 'upper', 'origin': 'ai'}} for o in objects],
        'referenceDocuments': [category]}
    report.append({'family': fam['id'], 'tilesetId': tid, 'cells': len(cells), 'objects': len(objects), 'dictionaryChars': len(dict_md), 'sheets': sheet_info})
(out / 'library.json').write_text(json.dumps(library, ensure_ascii=False))
(out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
for r in report:
    print(r['family'], r['tilesetId'], 'cells', r['cells'], 'objects', r['objects'], 'dict', r['dictionaryChars'])

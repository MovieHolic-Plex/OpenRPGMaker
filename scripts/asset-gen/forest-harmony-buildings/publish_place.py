"""「개울 건너 숲성 마을」을 공용 「장소」 저장본으로 싣는다(비취 대계곡·언덕 위 숲마을과 같은 형식).
  재생성: author_village2.mjs → hand_props.py --install → author_village2.mjs → 이것.
  python3 publish_place.py [VDIR 폴더]
쓰는 것:
  src/project/regionReferences/forest-fantasy-town.json   {map, tileset} (타일셋 정의 통째로 동결)
  public/assets/forest-harmony/fantasy-town-buildings.png  생성 건물·손 도트 소품 시트(tileGrafts 소스 tex_forest_harmony_fantasy_town)
  public/assets/region-references/forest-fantasy-town.png  16px/칸 미리보기(주민 그림 없이)"""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(__file__))
from fhlib import ROOT, OUT
import village_render

vdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'village2')
v = json.load(open(os.path.join(vdir, 'village.json')))
KEY, TS_ID = 'tex_forest_harmony_fantasy_town', 'forest_harmony_fantasy_town'
ts = dict(v['tileset']); ts['id'] = TS_ID; ts['name'] = '개울 건너 숲성 마을 · 숲마을 + 생성 건물'
assert all(g['sourceChipset'] != 'tex_gen_fh_buildings' for g in ts['tileGrafts']), '옛 작업 키가 남았다 — author_village2 를 다시 돌릴 것'
m = v['map']
keep = ('id', 'name', 'width', 'height', 'tileSize', 'tilesetId', 'layoutPlan', 'lowerTiles', 'upperTiles', 'events')
# ── 건물·소품 목록: 조수가 이름으로 고르게(「3층 대저택」「마법사의 탑」…). 생성 그림은 태그 「생성형 이미지」, 손 도트는 「손 도트」. ──
gen = json.load(open(os.path.join(vdir, 'gen-tiles.json'))); base = v['genTileBase']
bps = {b['id']: b for b in json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))['blueprints']}
used = {}
for b in v['buildings']: used.setdefault(b['art'], []).append(b)
for p in v['props']:
    if p.get('generated'): used.setdefault(p['generated'], []).append(p)
def image_kind(b): return '손 도트' if b.get('hand') else '생성형 이미지'
ts['tileMeta'] = list(ts['tileMeta']); ts['structureKits'] = [k for k in ts.get('structureKits', []) if not k['id'].startswith('fft-')]
kits = []
for art, b in sorted(gen['buildings'].items()):
    if b.get('native'): continue                       # 칩셋 원래 칸(수정·들꽃)은 칩셋 쪽 이름표를 그대로 쓴다
    kind = image_kind(b); w, h = b['w'], b['h']; bp = bps.get(b['blueprint'], {})
    label = b['label']; kit_id = f"fft-{art}"
    here = [f"{u.get('role') or u.get('name')} ({u['x']},{u['y']})" for u in used.get(art, [])]
    lower = [[-1] * w for _ in range(h)]; upper = [[-1] * w for _ in range(h)]
    for i, c in enumerate(b['cells']):
        if not c: continue
        x, y = i % w, i // w
        t = c['orig'] if 'orig' in c else base + c['k']
        (upper if c['layer'] == 'U' else lower)[y][x] = t
        if 'k' in c:
            meta = dict(ts['tileMeta'][t] or {})
            meta.update({'label': f"{label} · {kind}", 'tags': [kind, label, b['blueprint'], '건물' if b.get('kind') != 'prop' else '소품'],
                         'description': f"{label} 의 한 칸. {kind}" + (" — god-tibo-imagen 으로 그려 설계도 검사를 통과한 그림." if kind == '생성형 이미지' else " — 칩셋 색만 쓴 손 도트."),
                         'origin': 'ai', 'source': 'ai'})
            ts['tileMeta'][t] = meta
    desc = f"{label}" + (f" · {bp['stories']}층" if bp.get('stories') else '') + f" · {w}×{h}칸 · {kind}"
    if kind == '생성형 이미지': desc += " (god-tibo-imagen, 설계도 검사 통과작 — 숲마을 칩셋 화풍·팔레트)"
    if b.get('doors'): desc += f" · 입구 {len(b['doors'])}칸(문 이벤트는 입구 칸, 접근은 바로 아래 칸)"
    if here: desc += " · 이 마을: " + ", ".join(here)
    kit = {'id': kit_id, 'kind': 'section', 'name': label, 'width': w, 'height': h, 'tileSize': 16,
           'rows': [{'tiles': lower[y], 'upperTiles': upper[y]} for y in range(h)],
           'parts': [{'id': f"door-{n}", 'kind': 'entrance', 'dx': d['x'], 'dy': d['y'], 'w': 1, 'h': 1} for n, d in enumerate(b.get('doors', []))],
           'learnedFrom': 'db-authored',
           'ai': {'description': desc, 'placementRules': "칸 역할은 설계도가 정했다: 머리 칸(굴뚝·첨탑)은 상위·통행, 몸은 하위·막힘. 문 아래 칸을 길에 잇는다." if b.get('kind') != 'prop' else "소품. 윗줄은 상위·통행, 아랫줄은 막힘(1칸 풀·꽃·버섯은 통행).",
                  'tags': [kind, label, b['blueprint'], '개울 건너 숲성 마을'], 'role': 'prop' if b.get('kind') == 'prop' else 'building',
                  'layerHome': 'perCell', 'repeatability': 'fixed', 'origin': 'ai', 'confidence': 'high'}}
    ts['structureKits'].append(kit)
    kits.append({'kit': kit_id, 'name': label, 'image': kind, 'blueprint': b['blueprint'], 'width': w, 'height': h, 'stories': bp.get('stories'), 'usedHere': here})
buildings = [{'id': b['id'], 'role': b['role'], 'name': b['label'], 'kit': f"fft-{b['art']}", 'image': '생성형 이미지',
              'x': b['x'], 'y': b['y'], 'width': b['w'], 'height': b['h'], 'doors': [{'x': d['x'], 'y': d['y']} for d in b['doors']]} for b in v['buildings']]
snap = {'map': {**{k: m[k] for k in keep if k in m}, 'tilesetId': TS_ID}, 'tileset': ts, 'buildings': buildings, 'kits': kits}
json.dump(snap, open(os.path.join(ROOT, 'src/project/regionReferences/forest-fantasy-town.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
shutil.copyfile(os.path.join(vdir, 'gen-sheet.png'), os.path.join(ROOT, 'public/assets/forest-harmony/fantasy-town-buildings.png'))
village_render.render(v).convert('RGB').save(os.path.join(ROOT, 'public/assets/region-references/forest-fantasy-town.png'), optimize=True)
from PIL import Image
sh = Image.open(os.path.join(vdir, 'gen-sheet.png'))
print('ok', m['width'], 'x', m['height'], 'sheet', sh.size, 'frames', (sh.width // 16) * (sh.height // 16), 'events', len(m['events']), 'kits', len(kits), 'buildings', len(buildings))

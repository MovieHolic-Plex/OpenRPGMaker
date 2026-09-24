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
snap = {'map': {**{k: m[k] for k in keep if k in m}, 'tilesetId': TS_ID}, 'tileset': ts}
json.dump(snap, open(os.path.join(ROOT, 'src/project/regionReferences/forest-fantasy-town.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
shutil.copyfile(os.path.join(vdir, 'gen-sheet.png'), os.path.join(ROOT, 'public/assets/forest-harmony/fantasy-town-buildings.png'))
village_render.render(v).convert('RGB').save(os.path.join(ROOT, 'public/assets/region-references/forest-fantasy-town.png'), optimize=True)
from PIL import Image
sh = Image.open(os.path.join(vdir, 'gen-sheet.png'))
print('ok', m['width'], 'x', m['height'], 'sheet', sh.size, 'frames', (sh.width // 16) * (sh.height // 16), 'events', len(m['events']))

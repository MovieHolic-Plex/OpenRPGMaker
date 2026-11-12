"""조립한 조각(out/) → 저장소 tiledata/sf-station/redraw/ (pieces·units) + 오너 면제 묶음용 manifest. 옛 그림을 그대로 둔 조각(source=old)은 내보내지 않는다(옛 코드가 그린다)."""
import json, os, shutil
from PIL import Image
import sfr_lib as L
H = L.HERE
DST = f'{L.REPO}/tiledata/sf-station/redraw'
SEL = '/home/main/z-project/assistant-fable-runs/object-oneshot/pilot/selected'
INV = {o['id']: o for o in json.load(open(f'{H}/inventory.json'))}
res = json.load(open(f'{H}/assembled.json'))
os.makedirs(f'{DST}/pieces', exist_ok=True); os.makedirs(f'{DST}/units', exist_ok=True)
for f in os.listdir(f'{DST}/pieces'): os.remove(f'{DST}/pieces/{f}')
for f in os.listdir(f'{DST}/units'): os.remove(f'{DST}/units/{f}')
items = []; kept = []
for pid, r in res.items():
    if r['source'] == 'old': kept.append(pid); continue
    shutil.copy(f'{H}/out/{pid}.png', f'{DST}/pieces/{pid}.png')
    items.append(dict(png=f'{DST}/pieces/{pid}.png', kind=INV[pid]['kind'], label=f'sf_station/sf-{pid}'))
for a in ('terminal', 'alarm', 'supply-capsule', 'toilet'): shutil.copy(f'{SEL}/sf-{a}.png', f'{DST}/pieces/{a}.png')
D = json.load(open(f'{H}/units.json'))['objects']; results = {r['id']: r for r in json.load(open(f'{H}/results.json'))}
n = 0
for o in D:
    r = results.get(o['id'])
    if not r or not r['picture']: continue
    d = json.load(open(f'{H}/shots/{o["id"]}__{r["picture"]}.json')); a = L.read_answer(o, d['cli']['result'])
    json.dump(dict(unit=o['id'], name=o['name'], w=o['w'], h=o['h'], cls=o['cls'], role=o['role'], mirror=bool(o.get('mirror')), shot=r['picture'], legend=a['legend'], rows=a['rows'], note=a['note']),
              open(f'{DST}/units/{o["id"]}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0); n += 1
json.dump(dict(items=items), open(f'{H}/waiver-manifest.json', 'w'), ensure_ascii=False, indent=1)
json.dump(dict(batch='fable-redraw-sf_station-2026-11-12', redrawn=sorted(p for p, r in res.items() if r['source'] != 'old'), byCode=sorted(p for p, r in res.items() if r['source'] == 'code'), keptOld=sorted(kept),
               pieces={p: dict(source=r['source'], units=r['units']) for p, r in res.items()}), open(f'{DST}/assembled.json', 'w'), ensure_ascii=False, indent=0)
print('pieces', len(items), 'kept old', kept, 'units', n)

"""끼워 넣기 검사(모델 없음): 굽기 전(before/) ↔ 후 정의 JSON. 키트 id·크기·칸 번호·입구, 칸 통행·층, 오토타일 변형 표, 타일 그룹, 핀이 그대로인가."""
import json
import sfr_lib as L
a = json.load(open(f'{L.HERE}/before/sfStationTileset.json')); b = json.load(open(f'{L.REPO}/src/assets/sfStationTileset.json'))
bad = []
ka = {k['id']: k for k in a['structureKits']}; kb = {k['id']: k for k in b['structureKits']}
gained = 0
for i, k in ka.items():
    n = kb.get(i)
    if not n: bad.append(('kit missing', i)); continue
    if (k['width'], k['height']) != (n['width'], n['height']): bad.append(('kit size', i))
    if k.get('parts') != n.get('parts'): bad.append(('kit parts', i))
    for y, (ro, rn) in enumerate(zip(k['rows'], n['rows'])):
        for key in ('tiles', 'upperTiles'):
            for x, (to, tn) in enumerate(zip(ro.get(key) or [], rn.get(key) or [])):
                if to >= 0 and to != tn: bad.append(('kit cell', i, x, y, key, to, tn))
                if to < 0 and tn >= 0: gained += 1
for t in range(a['count']):
    if a['passability'][t] != b['passability'][t]: bad.append(('passability', t))
    if a['priority'][t] != b['priority'][t]: bad.append(('priority', t))
    for key in ('passage', 'defaultLayer', 'role', 'label'):
        if a['tileMeta'][t].get(key) != b['tileMeta'][t].get(key): bad.append(('meta ' + key, t, a['tileMeta'][t].get(key), b['tileMeta'][t].get(key)))
ga = {g['id']: g for g in a['autotileGroups']}; gb = {g['id']: g for g in b['autotileGroups']}
for i, g in ga.items():
    if g != gb.get(i): bad.append(('autotile', i))
ta = {g['id']: g for g in a['tileGroups']}; tb = {g['id']: g for g in b['tileGroups']}
for i, g in ta.items():
    n = tb.get(i)
    if not n or not set(g['tileIds']) <= set(n['tileIds']) or g.get('defaultLayer') != n.get('defaultLayer'): bad.append(('tile group', i))
print(f"kits {len(ka)} -> {len(kb)} (new: {sorted(set(kb) - set(ka))}) · tiles {a['count']} -> {b['count']} · cells newly filled in old kits {gained} · problems {len(bad)}")
for x in bad[:30]: print('  ', x)

#!/usr/bin/env python3
"""던전 VQA 보조 — 조수 시도 폴더(live.json)의 맵마다 이벤트 요약(이동·적·상자·보스·세이브)을 events.json 으로 쓴다.
   python3 scripts/qa/dungeons/event-digest.py <run-dir> [...]"""
import gzip, json, os, sys

def load(path):
    if os.path.exists(path): return json.load(open(path))
    return json.load(gzip.open(path + '.gz'))

def kinds(cmds, out):
    for c in cmds or []:
        if not isinstance(c, dict): continue
        k = c.get('kind')
        if k == 'transfer': out.append(f"transfer→{c.get('mapId')}({c.get('x')},{c.get('y')}) face {c.get('direction','-')}")
        elif k in ('battle', 'startBattle', 'encounter'): out.append(f"battle {c.get('troopId')}{' noEscape' if c.get('canEscape') is False else ''}")
        elif k in ('changeItems', 'gainItem', 'changeGold', 'gainGold'): out.append(k)
        elif k in ('save', 'openSave', 'openSaveMenu'): out.append('save')
        for v in c.values():
            if isinstance(v, list): kinds(v, out)

for run in sys.argv[1:]:
    p = load(os.path.join(run, 'live.json'))
    before = load(os.path.join(run, 'before.json'))
    res = {'startMapId': p.get('startMapId'), 'startPos': p.get('startPos'), 'maps': {}}
    for mid, m in p['maps'].items():
        b = before['maps'].get(mid)
        if b and json.dumps([b.get('lowerTiles'), b.get('events')]) == json.dumps([m.get('lowerTiles'), m.get('events')]): continue
        evs = []
        for e in m.get('events', []):
            acts = []
            for pg in e.get('pages') or []:
                kinds(pg.get('commands'), acts)
            trig = (e.get('pages') or [{}])[0].get('trigger', {}).get('kind') if e.get('pages') else None
            pri = (e.get('pages') or [{}])[0].get('priority') if e.get('pages') else None
            evs.append({'id': e['id'], 'name': e.get('name'), 'x': e['x'], 'y': e['y'], 'trigger': trig, 'priority': pri, 'does': sorted(set(acts))[:6]})
        res['maps'][mid] = {'name': m.get('name'), 'size': [m['width'], m['height']], 'tileset': m.get('tilesetId'),
                            'locations': [{'name': l.get('name'), 'x': l.get('x'), 'y': l.get('y'), 'w': l.get('w'), 'h': l.get('h')} for l in m.get('locations') or []],
                            'events': evs}
    json.dump(res, open(os.path.join(run, 'events.json'), 'w'), ensure_ascii=False, indent=1)
    print(run, {k: len(v['events']) for k, v in res['maps'].items()})

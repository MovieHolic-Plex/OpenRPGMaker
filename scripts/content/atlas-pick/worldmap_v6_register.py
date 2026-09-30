#!/usr/bin/env python3
"""6판 신규 slug 를 배정표(jobs-worldmap.json)에 등록한다(멱등). 소스는 candidates-worldmap/<slug>/info.json 중 worker=='v6'.
검사기(check_candidate)는 배정표의 items 만 기물로 인정하므로, 새 slug 는 여기서 먼저 올려야 한다."""
import json, os, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
JOBS = os.path.join(ROOT, 'tiledata/atlas-pick/jobs-worldmap.json')
j = json.load(open(JOBS, encoding='utf-8'))
have = {i['slug'] for i in j['items'] if i.get('worker') != 'v6'}   # v6 항목은 info.json 으로 매번 덮어쓴다
j['items'] = [i for i in j['items'] if i.get('worker') != 'v6' or i['slug'] not in have]
j['items'] = [i for i in j['items'] if i.get('worker') != 'v6']
added = []
for p in sorted(glob.glob(os.path.join(ROOT, 'tiledata/atlas-pick/candidates-worldmap/*/info.json'))):
    it = json.load(open(p, encoding='utf-8'))
    if it.get('worker') != 'v6' or it['slug'] in have: continue
    j['items'].append(it); added.append(it['slug'])
mine = sorted({i['slug'] for i in j['items'] if i.get('worker') == 'v6'} | set(j['workers'].get('v6', [])))
j['workers']['v6'] = mine
if True:
    json.dump(j, open(JOBS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(JOBS, 'a').write('\n')
print('등록', added)

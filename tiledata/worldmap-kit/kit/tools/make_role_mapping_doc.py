#!/usr/bin/env python3
"""docs/role-mapping.md 를 roles.json · iconsets/fantasy/manifest.json · journeys/fantasy-5act.json 에서 다시 쓴다."""
import json
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
WM = KIT.parent
roles = json.loads((KIT / 'roles.json').read_text())
man = json.loads((WM / 'iconsets' / 'fantasy' / 'manifest.json').read_text())
jr = json.loads((WM / 'journeys' / 'fantasy-5act.json').read_text())
rc = {r['id']: r for r in roles['roles']}
by_role = {}
for l in roles['legacy_fantasy']:
    by_role.setdefault(l['role'], []).append(l)
places = {}
for p in jr['places']:
    places.setdefault(p['role'], []).append(p['id'])
pins = man['pins']
L = []
L.append('# 역할 매핑 — v9 최종3 한 장짜리 → 17 역할')
L.append('')
L.append('> `kit/roles.json` 이 정본이다. 이 문서는 `kit/tools/make_role_mapping_doc.py` 가 roles.json · fantasy 매니페스트 · fantasy-5act 템플릿에서 쓴다.')
L.append('')
L.append('## 세어 둔 숫자')
L.append('')
n_icons = len(roles['legacy_fantasy'])
unfit = [l for l in roles['legacy_fantasy'] if not l['fits']]
L.append('- 아이콘 **%d종** (v9 최종2 는 39종이었으나 최종3 에서 `crater_lake`(분화구 호수)를 장소와 시트에서 뺐다 — 그 자리는 연못 지형).' % n_icons)
L.append('- 장소 **%d곳** = 아이콘 장소 30 + 천공섬 1 (`journey_plan_v9` 의 PLACES 31곳과 같다). 지시서의 「30곳」은 천공섬을 뺀 숫자다.' % len(jr['places']))
L.append('- 역할 **%d개**. fantasy 세트는 17개 역할을 모두 채운다. 칸 수가 역할과 다른 아이콘(`fits:false`): **%d종** — %s.' % (
    len(rc), len(unfit), ', '.join('`%s`(%dx%d, 역할 %s 는 %dx%d)' % (l['icon'], *l['cells'], l['role'], *l['role_cells']) for l in unfit) or '없음'))
L.append('  이 아이콘은 지도에 쓰이지 않았다(장소가 `city_capital` 6x6 을 쓴다). 빌더는 역할의 칸 수와 같은 아이콘만 후보로 삼는다.')
L.append('')
L.append('## 역할 표 (칸 수 · fantasy 세트의 채움 · 이 역할을 쓰는 장소)')
L.append('')
L.append('| 역할 id | 칸 | 이름 | fantasy 아이콘(맞는 것) | 장소(fantasy-5act) |')
L.append('|---|---|---|---|---|')
for r in roles['roles']:
    ic = by_role.get(r['id'], [])
    fit = [l['icon'] for l in ic if l['fits']]
    bad = [l['icon'] + '(fits:false)' for l in ic if not l['fits']]
    L.append('| `%s` | %dx%d | %s | %s | %s |' % (r['id'], *r['cells'], r['name'], ', '.join(['`%s`' % x for x in fit + bad]) or '—', ', '.join(places.get(r['id'], [])) or '—'))
L.append('')
L.append('## 아이콘 → 역할 (38종 전부)')
L.append('')
L.append('| 아이콘 | 칸 | 역할 | fits | 출처 묶음 |')
L.append('|---|---|---|---|---|')
for l in roles['legacy_fantasy']:
    L.append('| `%s` | %dx%d | `%s` | %s | %s |' % (l['icon'], *l['cells'], l['role'], 'true' if l['fits'] else '**false** (%dx%d 필요)' % tuple(l['role_cells']), l['origin']))
L.append('')
L.append('## 장소 → 역할 → fantasy 가 고른 아이콘')
L.append('')
L.append('`pins` 는 fantasy 세트가 원래 한 장짜리에서 손으로 고른 배정을 그대로 고정한 것이다(그래서 화소 동일). pins 가 없는 세트는 같은 역할의 맞는 변형 중 `crc32(장소 id) % 변형 수` 로 결정한다.')
L.append('')
L.append('| 장소 id | 역할 | 막 | 아이콘(pins) |')
L.append('|---|---|---|---|')
for p in jr['places']:
    L.append('| %s | `%s` | %d막 | `%s` |' % (p['id'], p['role'], p['act'] + 1, pins.get(p['id'], '—')))
L.append('')
(WM / 'docs' / 'role-mapping.md').write_text('\n'.join(L) + '\n')
print('wrote', n_icons, 'icons', len(jr['places']), 'places')

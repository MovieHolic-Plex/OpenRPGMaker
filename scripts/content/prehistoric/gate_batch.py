#!/usr/bin/env python3
"""object-gate 묶음 목록 만들기: 모든 그룹의 _gate/*.png(가장자리 낱칸 w-* 제외 — 조립 표본이 덮는다) + 조립 표본.
  python3 gate_batch.py [그룹 ...] > /tmp/ph-gate.jsonl
판정자에게는 영어 이름(id 에서 만든)을 준다. 영수증이 이미 있는 그림은 judge 가 건너뛴다(--force 없으면)."""
import json, os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'art'))
import terrain as TR, dwellings as DW, nature as NA, props as PR
REGS = {'terrain': TR.R, 'dwellings': DW.R, 'nature': NA.R, 'props': PR.R}
try:
    import interior as IN
    REGS['interior'] = IN.R
except ImportError:
    pass
OUT = os.path.join(HERE, '..', '..', '..', 'tiledata', 'prehistoric')
EN = {
    'hut': 'round prehistoric hut', 'tipi': 'hide tipi tent', 'cave': 'cave entrance in rocky hill', 'bone-hut': 'mammoth bone hut',
}
# 낱말만으로 잘못 읽히는 조각(「rack」= 세운 걸이로 읽힌다)에 실제 생김새를 적는다. 이미 받은 영수증의 이름은 바꾸지 않는다.
DESC = {
    'spear-rack': 'low log bench with a fur pad and spears lying on top',
}
only = set(sys.argv[1:])
for g, R in REGS.items():
    if only and g not in only: continue
    for it in R.items:
        if it['id'].startswith(('w-', 'lane-')): continue
        if g == 'interior' and it['id'].startswith(('wall-', 'paint-', 'ceil')): continue
        png = os.path.abspath(os.path.join(OUT, g, '_gate', 'ph-%s.png' % it['id']))
        base = re.sub(r'-f\d+$', '', it['id'])
        name = 'prehistoric stone-age ' + DESC.get(base, base.replace('-', ' '))
        print(json.dumps(dict(png=png, kind=it['kind'], name=name, label='prehistoric/ph-' + it['id'])))
    if g == 'terrain' or (g == 'interior' and 'interior' in REGS):
        d = os.path.join(OUT, g, '_gate_assembled')
        if os.path.exists(os.path.join(d, 'items.jsonl')):
            for line in open(os.path.join(d, 'items.jsonl')):
                r = json.loads(line); r['png'] = os.path.abspath(os.path.join(d, r['png'])); print(json.dumps(r))

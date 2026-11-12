"""이야기 기물 — 이미 그려진 그림(PNG)을 화소 그대로 싣는 조각(다시 그리지 않는다).

목록 tiledata/hand-interior/plus/oneshot/spec.json(이름·찾는 말·크기·놓는 법·막힌 칸·규칙) + pieces/<src>.
그림은 Claude Fable 5.2 medium 한 방 그림이고 3/4 관문을 통과하지 않았다 — 오너 면제 묶음 fable-oneshot-2026-11-12 가 그림 화소 해시·종류에
묶여 번들 출구만 연다(gate_rooms.state 가 관문 자신의 출구 규칙 object_gate.refusal(context='bundle') 에 묻는다). 한 화소라도 바꾸면 면제가 풀린다.
새 항목은 spec.json 의 items 끝에만 덧붙인다.
"""
import json, os
from iplib import REG, TD

DIR = os.path.join(TD, 'oneshot')
for it in json.load(open(os.path.join(DIR, 'spec.json'), encoding='utf-8'))['items']:
    p = it['piece']
    REG.picture(it['id'], os.path.join(DIR, 'pieces', it['src']), it['name'], it['cat'], p['kind'], p['w'], p['h'], p['up'], it['kind'],
                it['desc'] + ' 3/4 관문 미통과 — 오너 면제 그림(fable-oneshot-2026-11-12).', it['rooms'], it['rule'], pair=it['pair'], use=tuple(it['use']),
                rows=p.get('rows'), short=it['short'], words=it['words'], stamp=it['place'])

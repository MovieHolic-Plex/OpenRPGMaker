"""pirate_isles 이야기 기물(쪽지·보물 지도 조각 · 항해 일지 — tiledata/pirate-isles/objects/spec.json).

코드로 그린 그림이 아니다: pieces/<src> PNG 를 **그대로** 조각 등록부에 싣는다(한 화소라도 바뀌면 오너 면제가 풀린다).
이 그림들은 3/4 관문 미통과 — 오너 면제 묶음(spec.waiver)이다. 영수증이 없으므로 pi_core.status_of 가 관문 자신의 번들 출구 규칙
(object_gate.refusal, context='bundle')에 묻는다 — 여기에 둘째 규칙은 없다.
"""
import json, os
import numpy as np
from PIL import Image
import pi_core as C

OBJ = os.path.join(C.OUT, 'objects')
SPEC = json.load(open(os.path.join(OBJ, 'spec.json'), encoding='utf-8'))
IDS = [it['id'] for it in SPEC['items']]


def _picture(it):
    a = np.asarray(Image.open(os.path.join(OBJ, 'pieces', it['src'])).convert('RGBA'))
    assert a.shape[:2] == (it['h'] * C.T, it['w'] * C.T), (it['id'], a.shape)

    def draw(c):
        c.a[:, :, :] = a       # 그림 그대로(윤곽·색 맞춤 없음)
    return draw


for _it in SPEC['items']:
    _flat = _it['place'] == 'decal'
    _how = '바닥 그림, 밟고 지나간다.' if _flat else '서 있는 기물, 막힌 칸 %s, 나머지 칸은 사람 위에 그려진다.' % ' '.join('(%d,%d)' % tuple(c) for c in _it['block'])
    C.piece(_it['id'], _it['name'], _it['w'], _it['h'], _it['kind'], group='props', solid=[tuple(c) for c in _it['block']],
            tags=['이야기 기물', '주제 소품'] + list(_it['words']) + [_it['place']],
            desc=f"{_it['desc']} ({_it['en']}) — {_how} 3/4 관문 미통과 — 오너 면제 그림({SPEC['waiver']}).", rule=_it['rule'])(_picture(_it))

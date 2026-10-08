#!/usr/bin/env python3
"""일본 실내 방 표 — 예제 맵(tiledata/jp-city/interior/examples/*.json 의 rooms 사각형)에서 방마다 쓰인 가구를 세어
tiledata/jp-city/interior/rooms.json 을 쓴다. bake_interior_spec.py 가 사양의 rooms 로 싣고, list_hand_interior_parts({tileset:"jp_city", room}) 가 읽는다.
    python3 scripts/content/jp-city/interior/rooms.py
"""
import collections, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
EX = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'examples')
OUT = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'rooms.json')

KINDS = {
    'genkan': ('현관', ['玄関', '현관', '신발 벗는 곳', '타타키', 'entrance']),
    'hall': ('복도·계단', ['廊下', '복도', '계단', '階段', '2층 복도']),
    'washitsu': ('화실(다다미방)', ['和室', '다다미방', '다다미', '응접 화실', '불단']),
    'ldk': ('거실·식당(LDK)', ['LDK', '리빙', '거실', '다이닝', '식당', 'living']),
    'kitchen': ('부엌', ['キッチン', '台所', '주방', '부엌', 'kitchen']),
    'bath': ('욕실', ['風呂', '浴室', '욕조', '목욕', 'bath']),
    'dressing': ('탈의실·세면실', ['脱衣所', '洗面所', '세면대', '세탁기', '탈의실']),
    'toilet': ('화장실', ['トイレ', '변기', 'toilet']),
    'bedroom': ('부부 침실', ['寝室', '안방', '침실', '더블 침대']),
    'kids': ('아이방', ['子供部屋', '공부방', '아이 방', '이층침대']),
    'oneroom': ('원룸 방', ['ワンルーム', '1K', '자취방', '원룸', '아파트 방']),
    'unitbath': ('유닛 배스', ['ユニットバス', '욕실 겸 화장실']),
}
BUILDINGS = {
    'jp_house': '일본 2층 단독주택 — 1층 현관·화실·LDK·욕실·화장실, 2층 침실·아이방(house-1f·house-2f)',
    'jp_apartment': '일본 원룸 아파트(1K) — 현관·부엌 복도·유닛 배스·방(apartment-1k)',
}
MAPS = (('house-1f', 'jp_house'), ('house-2f', 'jp_house'), ('apartment-1k', 'jp_apartment'))
# 2묶음(가게·공공·집 보강): 예제마다 맵 전체가 방 하나 — 종류·건물·별칭은 examples/places2.json(interior.mjs 가 장소로 게시하는 표와 같은 것).
PLACES2 = json.load(open(os.path.join(EX, 'places2.json'), encoding='utf-8'))
for _p in PLACES2:
    KINDS[_p['kind']] = (_p['kindKo'], _p['alias'])
    BUILDINGS[_p['building']] = '%s(%s)' % (_p['name'], _p['file'])
MAPS = MAPS + tuple((_p['file'], _p['building']) for _p in PLACES2)
# 3묶음(학교·역·사무실 …): examples/places3*.json. 한 장소 = 맵 여러 장(maps) · 방 여러 개(rooms 사각형) — 방 종류는 roomKinds {id: [한국어, 별칭]}.
PLACES3 = [p for f in sorted(os.listdir(EX)) if f.startswith('places3') and f.endswith('.json')
           for p in json.load(open(os.path.join(EX, f), encoding='utf-8'))]
for _p in PLACES3:
    KINDS[_p['kind']] = (_p['kindKo'], _p['alias'])
    for _k, (_ko, _al) in (_p.get('roomKinds') or {}).items(): KINDS[_k] = (_ko, _al)
    BUILDINGS[_p['building']] = '%s(%s)' % (_p['name'], ', '.join(_p.get('maps') or [_p['file']]))
MAPS = MAPS + tuple((_f, _p['building']) for _p in PLACES3 for _f in (_p.get('maps') or [_p['file']]))


def main():
    examples = []
    for f, b in MAPS:
        d = json.load(open(os.path.join(EX, f + '.json'), encoding='utf-8'))
        rooms = d['rooms']
        def room_of(x, y):
            for r in rooms:
                if r['x0'] <= x <= r['x1'] and r['y0'] <= y <= r['y1']: return r['room']
            return None
        per = collections.OrderedDict((r['room'], collections.Counter()) for r in rooms)
        for o in d.get('objects', []):
            k = room_of(o['x'], o['y'])
            assert k, ('방 밖 가구', f, o)
            per[k][o['id']] += 1
        for t in d.get('tables', []):
            per[room_of(t['x'], t['y'])][t['style']] += 1
        for k, c in per.items():
            assert k in KINDS, k
            if c: examples.append([f, b, k, [[i, n] for i, n in c.items()]])
    out = dict(kinds={k: dict(ko=v[0], alias=v[1]) for k, v in KINDS.items()}, buildings=BUILDINGS, examples=examples, docPrefix='jp-interior-ex-')
    open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('rooms.json: 방 종류 %d · 건물 %d · 예제 방 %d' % (len(KINDS), len(BUILDINGS), len(examples)))


if __name__ == '__main__': main()

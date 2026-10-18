# 2026-10-18 19:18 사용자 「자동차는 기존에 쓰던 게 있었는데. 흠 다른 타일셋인가.. 확인좀 해봐」.
# 거리용 차량 키트(modernCityTileset.json structureKits mc-veh-*, 같은 modern_city 칩셋 타일)를 새 그림 없이 실내 사물로 등록한다 -
# 병원 응급실 하차장의 구급차·승용차가 거리 맵과 같은 픽셀이다. 위 줄은 지나가고(y -1) 아래 두 줄이 차체 발자국.
# 실행: python3 scripts/content/modern-city-int/r10/reuse_vehicles.py
import json, os, sys

REPO = os.path.abspath(__file__).rsplit('/scripts/', 1)[0]
TS = f'{REPO}/src/assets/modernCityTileset.json'
RS = f'{REPO}/src/assets/modernCityRoomSpec.json'

REUSE = [
    ('hosp-ambulance-e', 'mc-veh-ambulance-a', '구급차(오른쪽 향함)', '거리 맵과 같은 흰 구급차 - 빨간 띠와 경광등, 응급실 하차장에 대 둔다.', ['병원', '응급', '차량']),
    ('hosp-ambulance-w', 'mc-veh-ambulance-a-l', '구급차(왼쪽 향함)', '거리 맵과 같은 흰 구급차(왼쪽 향함).', ['병원', '응급', '차량']),
    ('park-sedan-white-e', 'mc-veh-sedan-a-white', '승용차(흰색·오른쪽 향함)', '거리 맵과 같은 흰 승용차 - 하차장·실내 주차장.', ['주차', '차량']),
    ('park-sedan-red-w', 'mc-veh-sedan-a-red-l', '승용차(빨강·왼쪽 향함)', '거리 맵과 같은 빨간 승용차 - 하차장·실내 주차장.', ['주차', '차량']),
    ('park-bus-e', 'mc-veh-bus-a', '버스(오른쪽 향함)', '거리 맵과 같은 시내버스 - 차고·터미널.', ['버스', '차량']),
]


def main():
    ts = json.load(open(TS)); rs = json.load(open(RS))
    kits = {k['id']: k for k in ts['structureKits']}
    for oid, kid, ko, desc, tags in REUSE:
        if oid in rs['objects']: sys.exit(f'already registered: {oid}')
        k = kits[kid]; rows = k['rows']
        cells = [[x, ry - (len(rows) - 2), t, 3] for ry, r in enumerate(rows) for x, t in enumerate(r['upperTiles']) if t >= 0]
        rs['objects'][oid] = {'ko': ko, 'kind': 'floor', 'desc': desc, 'tags': tags, 'place': '실내 배치(하차장·차고)', 'category': 'hospital' if '병원' in tags else 'commercial',
                              'category_ko': '병원' if '병원' in tags else '상업·공공', 'cells': cells, 'w': k['width'], 'h': 2, 'up': (len(rows) - 2) * 16,
                              'use': ['block']}
    open(RS, 'w').write(json.dumps(rs, ensure_ascii=True, separators=(',', ':')) + '\n')
    print('registered', len(REUSE), 'vehicle objects from street kits')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""거리 구성기 사전(생성물) — 타일셋 정의에서 건물 키트 표와 야외 키트 크기 표를 뽑아 src/assets/jpCityStreetCatalog.json 을 쓴다.
  python3 scripts/content/jp-city/street/catalog.py [--check]
구성기(src/project/jpCityScene*.ts)는 타일셋 없이 계획을 짜야 해서(순수 함수 — 조수 빌더가 씨앗을 미리 본다) 이 표를 읽는다. 굽기 뒤에 다시 돌린다.
건물: id · 칸 크기 · 문 열(entrance 부품) · 양옆 처마 칸(맨 아래 줄이 빈 열) · 분류(cat) · 가게 종류(role, 이름표 태그) · 급(tier) · 이름.
손으로 쓰는 것은 거리 종류·장면 벌·톤(src/assets/jpCityStreetKinds.json)뿐이다."""
import json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
SRC = os.path.join(ROOT, 'src', 'assets', 'jpCityTileset.json')
OUT = os.path.join(ROOT, 'src', 'assets', 'jpCityStreetCatalog.json')

# 옛 손 도트 건물(jp-bldg-*)의 가게 종류. 없는 id 는 분류 태그로 정한다.
ROLE = {'conbini': 'konbini', 'shop-izakaya': 'izakaya', 'shop-ramen': 'ramen', 'shop-cafe': 'cafe', 'sento': 'sento', 'house-machiya': 'machiya', 'office6': 'office', 'zakkyo5': 'office',
        'shop-soba': 'restaurant', 'shop-sushi': 'restaurant', 'shop-teishoku': 'restaurant', 'supermarket': 'market', 'market-hall': 'market', 'coin-laundry': 'laundry', 'post-office': 'post',
        'station-small': 'station', 'school': 'school', 'school-gym': 'school', 'shrine-haiden': 'shrine', 'koban': 'koban', 'clinic': 'clinic', 'kindergarten': 'kindergarten', 'factory': 'factory', 'warehouse': 'warehouse', 'machikoba-home': 'factory', 'gas-office': 'gas'}
CAT_BY_TAG = {'단독주택': 'house', '공동주택': 'apartment', '가게': 'shop', '음식점': 'food', '상업 건물': 'commercial', '공공 건물': 'public', '공장·창고': 'industry'}
ZONE_ONLY = {'station-small': 'station', 'school': 'school', 'school-gym': 'school', 'shrine-haiden': 'shrine', 'gas-office': 'gas', 'market-hall': 'market'}   # 구획(역 앞·교정·경내·주유소)이 부르는 건물 — 줄에 섞지 않는다
# 새 건물(jp-bldg-f-*, 그리는 일꾼 JP) 가운데 급만으로 분류가 안 되는 것
F_CAT = {'ramen': 'food', 'sushi': 'food', 'izakaya': 'food', 'yakitori': 'food', 'kissa': 'food', 'toilet': 'utility', 'bus-shelter': 'utility', 'jizo-hall': 'sacred', 'lottery': 'utility', 'bunka-apart': 'apartment', 'temple-hall': 'sacred', 'grand-temple': 'sacred',
         'community-hall': 'public', 'fire-brigade': 'public', 'dentist': 'public', 'vet': 'public', 'acupuncture': 'public', 'landmark-torii': 'sacred', 'landmark-castle': 'castle',
         'bullet-station': 'station', 'bus-terminal': 'station', 'university': 'school', 'plant': 'industry', 'wholesale-market': 'market', 'ballpark': 'stadium', 'car-repair': 'industry'}
F_ROLE = {'ramen': 'ramen', 'sushi': 'restaurant', 'izakaya': 'izakaya', 'yakitori': 'izakaya', 'kissa': 'cafe', 'sentaku': 'laundry', 'zakkyo': 'office', 'bento': 'bento', 'business-hotel': 'hotel', 'bank': 'bank', 'ryokan': 'ryokan', 'karaoke': 'karaoke', 'pachinko': 'pachinko', 'game-center': 'arcade', 'manga-cafe': 'cafe', 'tea': 'cafe',
          'family-restaurant': 'restaurant', 'soba-stand': 'restaurant', 'takoyaki': 'restaurant', 'taiyaki': 'restaurant', 'hospital': 'clinic', 'dentist': 'clinic', 'vet': 'clinic', 'acupuncture': 'clinic',
          'ward-office': 'office', 'tv-station': 'office', 'library': 'library', 'museum': 'museum', 'cinema': 'cinema', 'police-station': 'koban', 'fire-station': 'fire', 'department-store': 'mall',
          'shopping-mall': 'mall', 'electronics': 'mall', 'bunka-apart': 'apartment', 'pool-hall': 'gym'}
FLAVOR = ['jp-shop-greengrocer', 'jp-izakaya-brick-wall', 'jp-vending-stripe-alcove', 'jp-mansion-tile', 'jp-monthly-parking', 'jp-fg-rooftop-dish', 'jp-alley-stair-tree', 'jp-fg-tiled-balcony',
          'jp-shop-market-kissa', 'jp-shop-market-butcher', 'jp-shop-market-fish', 'jp-shop-market-drug', 'jp-coin-parking', 'jp-shotengai-canopy']
SKIP_SIZE = re.compile(r'^jp-(in|sf|recipe|door|subway|roof)-')


def build():
    t = json.load(open(SRC, encoding='utf-8'))
    buildings, sizes, lower = [], {}, []
    for k in t['structureKits']:
        kid, w, h = k['id'], k['width'], k['height']
        if not SKIP_SIZE.match(kid):
            sizes[kid] = [w, h]
            if any(v >= 0 for r in k['rows'] for v in (r.get('tiles') or [])): lower.append(kid)   # 제 바닥 칸을 가져오는 키트 — 4층 덧그림으로 찍지 않는다
        if not kid.startswith('jp-bldg-') or '-row-' in kid: continue
        tags = (k.get('ai') or {}).get('tags') or []
        bottom = k['rows'][-1].get('upperTiles') or []
        solid = lambda x: bottom[x] >= 0 and not all(t['passability'][bottom[x]].values())   # 처마 칸은 맨 아래 줄까지 ★(걷는 칸)이다 — 벽은 막힌 칸
        ml = 0
        while ml < w and not solid(ml): ml += 1
        mr = 0
        while mr < w - ml and not solid(w - 1 - mr): mr += 1
        doors = sorted({p['dx'] for p in k.get('parts') or [] if p.get('kind') == 'entrance' and p.get('dy') == h - 1})
        short = kid[len('jp-bldg-'):]
        tier = next((x[5:] for x in tags if x.startswith('tier:')), None)
        if short.startswith('f-'):
            s = short[2:]
            tier = tier or 'medium'
            cat = F_CAT.get(s) or ('house' if s.startswith(('house', 'nagaya', 'minka')) else None) or ('landmark' if tier == 'landmark' else 'civic' if tier in ('large', 'xlarge') else 'commercial' if tier == 'medium' else 'shop')
            role = F_ROLE.get(s) or ('house' if cat == 'house' else None) or ('shop' if cat == 'shop' else s)
        else:
            base = short[:-5] if short.endswith('-shut') else short
            cat = next((CAT_BY_TAG[x] for x in tags if x in CAT_BY_TAG), 'shop')
            role = ROLE.get(base) or {'house': 'house', 'apartment': 'apartment'}.get(cat, 'shop')
            if short.endswith('-shut') or short == 'shop-vacant': cat = 'shut'
            if base in ZONE_ONLY: cat = ZONE_ONLY[base]
            tier = tier or ('large' if w >= 14 or h >= 13 else 'medium' if w >= 9 or h >= 11 else 'small')
        b = dict(id=kid, w=w, h=h, doors=doors, ml=ml, mr=mr, cat=cat, role=role, tier=tier, ko=k.get('name') or kid)
        if short.endswith('-shut'): b['look'] = 'jp-bldg-' + short[:-5]
        buildings.append(b)
    # 시타마치·쇼텐가이 일체형 줄 키트(shitamachi_pack — 문 없는 풍경 건물, 처마 칸 없음). 거리 종류의 mix.flavor 가 부른다.
    byid = {k['id']: k for k in t['structureKits']}
    for kid in FLAVOR:
        k = byid.get(kid)
        if k: buildings.append(dict(id=kid, w=k['width'], h=k['height'], doors=[], ml=0, mr=0, cat='flavor', role='landmark', tier='small', ko=(k.get('name') or kid).split('(')[0]))
    return dict(_doc='생성물 — scripts/content/jp-city/street/catalog.py. 손으로 고치지 않는다.', buildings=buildings, sizes=sizes, lower=sorted(lower))


if __name__ == '__main__':
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':')) + '\n'
    if '--check' in sys.argv:
        same = os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == text
        print('catalog', 'same' if same else 'DIFFERENT'); sys.exit(0 if same else 1)
    open(OUT, 'w', encoding='utf-8').write(text)
    d = json.loads(text); import collections
    print('buildings', len(d['buildings']), dict(collections.Counter(b['cat'] for b in d['buildings'])), 'sizes', len(d['sizes']), 'bytes', len(text))

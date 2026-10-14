"""plans/*.json → tiledata/hand-interior/plus/rooms.json (방 종류 이름·찾는 말, 건물, 예제 방별 가구 수). bake.py 가 사양 rooms 에 덧붙인다.
   python3 scripts/content/interior-plus/rooms_json.py"""
import json, os, glob
from collections import Counter
TD = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'tiledata', 'hand-interior', 'plus')
KINDS = {
    'museum_lobby': ('박물관 입구 홀', ['박물관', '미술관', '박물관 입구', '매표소', '로비', 'museum']),
    'museum_gallery': ('미술관 전시실', ['미술관', '화랑', '그림 전시실', '전시실', '갤러리', 'gallery']),
    'museum_relics': ('유물 전시실', ['박물관', '유물실', '보물 전시실', '진열실', '전시실']),
    'museum_sculpture': ('조각 전시실', ['조각실', '조각 전시실', '석상 전시실', '전시실']),
    'museum_natural': ('자연사 전시실', ['자연사', '화석 전시실', '자연사 박물관', '전시실']),
    'ship_cabin': ('선장실', ['선장실', '선실', '배 안', '해적선', '범선', 'captain cabin', 'cabin']),
    'ship_helm': ('조타실', ['조타실', '함교', '키 잡는 곳', '항해실', 'bridge', 'helm']),
    'ship_galley': ('배 주방', ['배 주방', '선상 주방', '갤리', '주방', 'galley']),
    'ship_crew': ('선원 숙소', ['선원 숙소', '선실', '해먹', '배 안', 'crew quarters']),
    'ship_gundeck': ('포 갑판', ['포 갑판', '대포 갑판', '함포', '해적선', 'gun deck']),
    'ship_cargo': ('화물칸', ['화물칸', '선창', '짐칸', 'cargo hold', 'hold']),
    'ship_brig': ('배 감방', ['배 감방', '선상 감옥', '영창', 'brig']),
    'arena_stands': ('관중석', ['관중석', '투기장', '콜로세움', '원형 경기장', 'stands']),
    'arena_floor': ('투기장 모래 마당', ['투기장', '콜로세움', '경기장', '결투장', 'arena']),
    'arena_armory': ('투기장 무기고', ['무기고', '검투사 대기실', '투기장 무기고', 'armory']),
    'gladiator_cell': ('검투사 방', ['검투사', '검투사 방', '검투사 감방', '대기 감방', 'gladiator cell']),
}
BUILD = {
    'museum': '박물관 — 입구 홀·미술 전시실·유물실·조각실·자연사실 (판타지·중세 박물관/미술관. 호러·고딕 미술관은 고딕 저택 도구)',
    'ship': '범선 위 갑판 — 선장실·조타실·배 주방·선원 숙소 (해적선·상선)',
    'ship_hold': '범선 아래 갑판 — 포 갑판·화물칸·감방',
    'arena': '투기장 — 관중석·모래 마당·검투사 방·무기고 (콜로세움)',
}
kinds = {k: {'ko': v[0], 'alias': v[1]} for k, v in KINDS.items()}
examples, maps = [], []
for f in sorted(glob.glob(os.path.join(TD, 'plans', '*.json'))):
    ex = json.load(open(f)); m = os.path.basename(f)[:-5]; maps.append(m)
    for r in ex['rooms']:
        ins = lambda x, y: r['x0'] <= x <= r['x1'] and r['y0'] <= y <= r['y1']
        c = Counter(o['id'] for o in ex.get('objects', []) if ins(o['x'], o['y']))
        for t in ex.get('tables', []):
            if ins(t['x'], t['y']): c[f"{t['style']} {t['w']}x{t['h']}"] += 1
        for l in ex.get('lines', []):
            if any(ins(p['x'], p['y']) for p in l.get('cells', [])): c[l['id']] += 1
        for d in ex.get('daises', []):
            if ins(d['x'], d['y']): c[d['id']] += 1
        examples.append([m, ex['building'], r['kind'], sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))])
json.dump({'kinds': kinds, 'buildings': BUILD, 'examples': examples, 'example_maps': maps}, open(os.path.join(TD, 'rooms.json'), 'w'), ensure_ascii=False, indent=1)
print(len(kinds), 'kinds', len(examples), 'example rooms')

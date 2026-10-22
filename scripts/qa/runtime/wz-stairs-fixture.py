"""wz-stairs 시나리오 픽스처 — 마법 학교 계단 다시 그림(2026-10-22)을 출하 플레이어에서 오르내린다.

  python3 scripts/qa/runtime/wz-stairs-fixture.py /tmp/wz-stairs.json
  QA_RECORD_VIDEO=<폴더> node scripts/runtime-qa.mjs --scenario wz-stairs --project /tmp/wz-stairs.json --netns

공용 장소 세 곳(시계탑 기어실 · 부엉이 탑 · 허니듀크 지하)의 게시본 맵과 성채 대연회장 예제(올라가는 성채 계단 + 이 픽스처가 찍는
내려가는 성채 계단통)를 한 프로젝트에 모으고, 계단 계약(src/assets/stairContracts.json)대로 이동 칸에 층 이동을, 짝 계단의 앞 칸에
계단을 등진 도착을 단다.
  시계탑 올라가는 정비 계단 ↔ 부엉이 탑 내려가는 계단통
  허니듀크 올라가는 계단 ↔ 대연회장 내려가는 성채 계단통
  대연회장 올라가는 성채 계단 → 부엉이 탑 계단통 앞
엔진 계약 픽스처다 — 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
"""
import copy, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
out = sys.argv[1]
load = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
proj = load('public/assets/region-references/wz-space-clocktower.oprn.json')
for pid in ('owlery', 'honeydukes'):
    proj['maps'].update(load(f'public/assets/region-references/wz-space-{pid}.oprn.json')['maps'])
TS = load('src/assets/wizardingWorldTileset.json')
KITS = {k['id']: k for k in TS['structureKits']}
CON = load('src/assets/stairContracts.json')
CON = (CON.get('kits') or CON)['wizarding_world']

CLOCK, OWL, HD, HALL = 'wz-place-space-clocktower', 'wz-place-space-owlery', 'wz-place-space-honeydukes', 'wz-fixture-castle-hall'

# 성채 대연회장 예제 → 맵 + 내려가는 성채 계단통을 (1,4) 에(바닥은 y4..7, y8..9 는 남벽)
ex = load('tiledata/wizarding/examples/wz-castle-example-hall.json')
W, H = ex['w'], ex['h']
hall = copy.deepcopy(proj['maps'][CLOCK])
hall.update(id=HALL, name='마법 학교 · 대연회장(픽스처)', width=W, height=H, lowerTiles=list(ex['lower']),
            lowerOverlayTiles=[-1] * (W * H), upperTiles=list(ex['upper']), upperOverlayTiles=[-1] * (W * H), events=[])
for dy, row in enumerate(KITS['wz-castle-stair-down']['rows']):
    for dx in range(2):
        i = (4 + dy) * W + 1 + dx
        if row['tiles'][dx] >= 0: hall['lowerTiles'][i] = row['tiles'][dx]
        if (row.get('upperTiles') or [-1, -1])[dx] >= 0: hall['upperTiles'][i] = row['upperTiles'][dx]
proj['maps'][HALL] = hall

STAIRS = {  # (맵, 키트, 원점)
    'clock': (CLOCK, 'wz-clock-stair', 1, 2), 'owl': (OWL, 'wz-owl-stair-down', 1, 8),
    'hd': (HD, 'wz-hd-stairs-down', 13, 2), 'hall-down': (HALL, 'wz-castle-stair-down', 1, 4), 'hall-up': (HALL, 'wz-castle-stair-up', 11, 2),
}
FACING = {'S': 'down', 'N': 'up', 'E': 'right', 'W': 'left'}


def cells(name, key):
    m, kit, ox, oy = STAIRS[name]
    return [(ox + x, oy + y) for x, y in CON[kit][key]]


def arrive(name):
    m, kit, ox, oy = STAIRS[name]
    ax, ay = cells(name, 'approach')[-1]
    return m, ax, ay, FACING.get(CON[kit]['side'], 'down')


def link(src, dst):
    m = STAIRS[src][0]
    tm, tx, ty, d = arrive(dst)
    for n, (x, y) in enumerate(cells(src, 'trigger')):
        eid = f'{m}-wzst-{src}-{n}'
        proj['maps'][m].setdefault('events', []).append({
            'id': eid, 'name': f'계단 {src}→{dst}', 'x': x, 'y': y, 'trigger': {'kind': 'playerTouch'}, 'commands': [],
            'pages': [{'id': eid + '-p1', 'name': '1', 'conditions': [], 'graphic': {}, 'trigger': {'kind': 'playerTouch'},
                       'priority': 'below', 'overlapForbidden': False, 'movement': {'type': 'fixed', 'speed': 3, 'frequency': 3},
                       'commands': [{'kind': 'transfer', 'mapId': tm, 'x': tx, 'y': ty, 'direction': d, 'fade': 'black'}]}]})


link('clock', 'owl'); link('owl', 'clock'); link('hd', 'hall-down'); link('hall-down', 'hd'); link('hall-up', 'owl')
proj['startMapId'] = CLOCK
proj['startPos'] = {'x': 2, 'y': 8}
proj['meta']['title'] = 'wz stairs QA'
proj.get('system', {}).pop('opening', None)   # 첫 장 제목 카드가 입력을 잡아 첫 걸음이 먹지 않았다
json.dump(proj, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
for k in STAIRS: print(k, STAIRS[k][1], 'trigger', cells(k, 'trigger'), 'front', cells(k, 'approach'))
print('->', out)

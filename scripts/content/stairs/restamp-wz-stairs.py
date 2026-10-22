"""마법 학교 공용 장소 세 곳의 계단 칸을 다시 찍는다(2026-10-22, 계단 다시 그리기 — 사용자 「계단들이 다 씹창」).

  python3 scripts/content/stairs/restamp-wz-stairs.py [--write]

bake_wz.py 로 새 계단 그림을 구운 뒤에 돌린다. 옛 계단 칸(자리 고정)을 그 방 바닥으로 되돌리고 새 키트를 찍는다.
  · 시계탑 기어실  wz-clock-stair 2×2 (1,11) 방 가운데 → 2×3 (1,2) 북벽: 올라가는 계단은 북벽 문틀 안으로 오른다(홀로 선 계단은
                   「어디로 가는지 모르는 단상」으로 읽혔다). 그 자리 벽걸이 공구 걸이판(1,1)은 뗀다(같은 걸이판이 (4,1)에 하나 더 있다).
  · 부엉이 탑      wz-owl-stair-up (1,8) → wz-owl-stair-down (1,8): 탑 꼭대기 방이라 여기서는 아래층으로 내려간다.
  · 허니듀크 지하  wz-hd-stairs-down (13,2) 2×3 그대로(문틀 안으로 오르는 계단) — 맨 아래 줄이 투명 덧그림이 됐다.
                   계단 앞 칸 (14,5)를 막던 사탕 상자 더미 wz-hd-stack-2x2 (14,5) 를 한 칸 동쪽 (15,5) 로 옮긴다(앞 칸 두 칸을 비운다).
고치는 파일: tiledata/wizarding/spaces/<id>.json(+.png) · src/project/regionReferences/<id>.json · public/assets/region-references/<id>.oprn.json(+.png).
게시본의 묶은 타일셋 사본(snapshot passability 등)은 새 굽기 값으로 바꾼다 — 새 칸 번호가 옛 사본 범위(count) 밖이기 때문.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
TS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png')).convert('RGBA')
KITS = {k['id']: k for k in TS['structureKits']}
LAYERS = ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles')
TPR = TS['tilesPerRow']

# 장소 → (새 키트, 원점 x, y, 옛 계단 칸 {(x,y): {층: 값}})
PLACES = {
    'wz-space-clocktower': ('wz-clock-stair', 1, 2, {**{(x, y): {'lowerTiles': 919} for x in (1, 2) for y in (11, 12)},
                                                     (1, 1): {'upperOverlayTiles': -1}, (1, 2): {'upperOverlayTiles': -1}}),
    'wz-space-owlery': ('wz-owl-stair-down', 1, 8, {(x, y): {'lowerTiles': 577} for x in (1, 2) for y in (8, 9)}),
    'wz-space-honeydukes': ('wz-hd-stairs-down', 13, 2, {**{(x, 2): {'upperOverlayTiles': -1} for x in (13, 14)},
                                                        **{(x, y): {'lowerTiles': 1419} for x in (13, 14) for y in (3, 4)}}),
}


def restamp(m, W, kit_id, ox, oy, reset):
    for (x, y), lv in reset.items():
        for L, v in lv.items(): m[L][y * W + x] = v
    k = KITS[kit_id]
    for dy, row in enumerate(k['rows']):
        for dx in range(k['width']):
            i = (oy + dy) * W + ox + dx
            lo = row['tiles'][dx]; up = (row.get('upperTiles') or [-1] * k['width'])[dx]
            if lo >= 0:
                m['lowerTiles'][i] = lo
                if up < 0: m['upperTiles'][i] = -1; m['upperOverlayTiles'][i] = -1   # 벽 줄에 찍은 아래층 계단 칸: 벽을 걷어낸다
            if up >= 0:
                if m['upperTiles'][i] < 0 or m['upperTiles'][i] in kit_tiles(kit_id): m['upperTiles'][i] = up
                else: m['upperOverlayTiles'][i] = up


def move_kit(m, W, kit_id, x0, y0, x1, y1):
    """윗층에 찍힌 키트(같은 크기)를 (x0,y0) → (x1,y1) 로 옮긴다. 이미 옮겼으면 그대로 둔다."""
    k = KITS[kit_id]
    ups = [(dx, dy, t) for dy, r in enumerate(k['rows']) for dx, t in enumerate(r.get('upperTiles') or []) if t >= 0]
    if not all(m['upperTiles'][(y0 + dy) * W + x0 + dx] == t for dx, dy, t in ups): return False
    for dx, dy, t in ups: m['upperTiles'][(y0 + dy) * W + x0 + dx] = -1
    for dx, dy, t in ups:
        i = (y1 + dy) * W + x1 + dx
        assert m['upperTiles'][i] < 0 and m['upperOverlayTiles'][i] < 0, ('옮길 자리가 비지 않았다', kit_id, x1 + dx, y1 + dy)
        m['upperTiles'][i] = t
    return True


MOVES = {'wz-space-honeydukes': [('wz-hd-stack-2x2', 14, 5, 15, 5)]}


def kit_tiles(kit_id):
    k = KITS[kit_id]
    return {t for r in k['rows'] for t in r['tiles'] + (r.get('upperTiles') or []) if t >= 0}


def render(m, W, H):
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for L in LAYERS:
        for i, t in enumerate(m.get(L) or []):
            if t >= 0: im.alpha_composite(SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16)), ((i % W) * 16, (i // W) * 16))
    return im


def refresh_snapshot_tileset(t):
    for key in ('count', 'passability', 'priority', 'terrain'):
        if key in t: t[key] = TS[key]
    for key in ('tileMeta', 'tileGroups', 'autotileGroups', 'animationStrips', 'structureKits', 'libraryEnd'):
        if key in t: t[key] = TS[key]


write = '--write' in sys.argv
for pid, (kit, ox, oy, reset) in PLACES.items():
    sp_path = os.path.join(ROOT, 'tiledata/wizarding/spaces', pid + '.json')
    rr_path = os.path.join(ROOT, 'src/project/regionReferences', pid + '.json')
    op_path = os.path.join(ROOT, 'public/assets/region-references', pid + '.oprn.json')
    sp = json.load(open(sp_path, encoding='utf-8'))
    rr = json.load(open(rr_path, encoding='utf-8'))
    op = json.load(open(op_path, encoding='utf-8'))
    W, H = sp['w'], sp['h']
    restamp(sp, W, kit, ox, oy, reset)
    for mk, x0, y0, x1, y1 in MOVES.get(pid, []):
        if move_kit(sp, W, mk, x0, y0, x1, y1):
            sp['placed'] = [dict(p, x=x1, y=y1) if (p['kit'], p['x'], p['y']) == (mk, x0, y0) else p for p in sp['placed']]
    sp['placed'] = [p for p in sp['placed'] if 'stair' not in p['kit'] and not (pid == 'wz-space-clocktower' and p['kit'] == 'wz-clock-toolrack' and (p['x'], p['y']) == (1, 1))] + [dict(kit=kit, x=ox, y=oy)]
    for m in (rr['map'], op['maps'][rr['map']['id']]):
        assert m['width'] == W and m['height'] == H
        restamp(m, W, kit, ox, oy, reset)
        for mk, x0, y0, x1, y1 in MOVES.get(pid, []): move_kit(m, W, mk, x0, y0, x1, y1)
        for L in LAYERS: assert m[L] == sp[L], (pid, L)
    refresh_snapshot_tileset(rr['tileset'])
    refresh_snapshot_tileset(op['tilesets']['wizarding_world'])
    im = render(sp, W, H)
    print(pid, kit, (ox, oy), 'placed', [p for p in sp['placed'] if p['kit'] == kit])
    if write:
        json.dump(sp, open(sp_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        json.dump(rr, open(rr_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        json.dump(op, open(op_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        im.save(sp_path[:-5] + '.png'); im.save(op_path[:-10] + '.png')

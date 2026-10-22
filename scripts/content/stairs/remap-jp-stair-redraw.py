#!/usr/bin/env python3
"""jp_city 실내 계단 13종 다시 그리기(2026-10-22) 뒤, 이미 게시된 jp_city 장소가 새 그림 칸을 쓰게 옮긴다.

bake_jp.py 는 그림이 바뀐 자리 키에 @r<해시> 를 붙여 새 번호(시트 끝)를 주고 옛 번호는 옛 그림으로 남긴다(이미 깔린 맵 보호).
그래서 굽기만 하면 공용 장소의 계단은 옛 그림 그대로다. 이 스크립트는 계단 키트 자리 키(아래 STAIR_OBJS)에 한해서만
옛 번호 → 가장 최근 @r 번호로 장소 내려받기(public/assets/region-references/jp-city-*.oprn.json)와 스냅숏
(src/project/regionReferences/jp-city-*.json)의 칸을 바꾼다. 다른 칸은 건드리지 않는다. 옮긴 장소 이름을 출력한다 —
이어서 node scripts/content/jp-city/maps/remap-refs.mjs --retile-only --only <이름들> 로 타일셋 사본을 지금 정의로 바꾼다.

  python3 scripts/content/stairs/remap-jp-stair-redraw.py [--dry]
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
STAIR_OBJS = re.compile(r'^(interior_entry|interior_school|interior_post|interior_office|dungeon_school|dungeon_construction)/obj\.'
                        r'(stairs-up-wood|stairs-up-wood-wide|stairwell-down-wood|(sc|mc|of|as|cs)-[a-z-]*stair[a-z-]*)\.\d+\.\d+$')
LAYERS = ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles')

cells = json.load(open(os.path.join(ROOT, 'tiledata/jp-city/pins.json')))['cells']
latest = {}
for k, t in cells.items():
    if '@r' not in k: continue
    base = k.split('@r')[0]
    if not STAIR_OBJS.match(base) or base not in cells: continue
    if base not in latest or t > latest[base][1]: latest[base] = (k, t)
remap = {cells[b]: t for b, (_, t) in latest.items()}
# 앞선 다시 그리기 판의 @r 번호를 들고 있는 맵도 최신으로
for k, t in cells.items():
    if '@r' in k and k.split('@r')[0] in latest and t != latest[k.split('@r')[0]][1]: remap[t] = latest[k.split('@r')[0]][1]
print(f'계단 자리 키 {len(latest)}개 · 옮길 번호 {len(remap)}개', file=sys.stderr)

def move(m):
    n = 0
    for L in LAYERS:
        a = m.get(L)
        if not isinstance(a, list): continue
        for i, t in enumerate(a):
            if t in remap: a[i] = remap[t]; n += 1
    return n

dry = '--dry' in sys.argv
touched = []
RR = os.path.join(ROOT, 'public/assets/region-references')
for f in sorted(os.listdir(RR)):
    m = re.match(r'^jp-city-(.*)\.oprn\.json$', f)
    if not m: continue
    name = m.group(1); p = os.path.join(RR, f)
    proj = json.load(open(p))
    maps = proj['maps'].values() if isinstance(proj['maps'], dict) else proj['maps']
    n = sum(move(mp) for mp in maps)
    sp = os.path.join(ROOT, 'src/project/regionReferences', f'jp-city-{name}.json')
    sn = 0
    if os.path.exists(sp):
        snap = json.load(open(sp)); sn = move(snap['map'])
    if n or sn:
        touched.append(name); print(f'{name}: 장소 {n}칸 · 스냅숏 {sn}칸', file=sys.stderr)
        if not dry:
            json.dump(proj, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
            if sn: json.dump(snap, open(sp, 'w'), ensure_ascii=False, separators=(',', ':'))
print(','.join(touched))

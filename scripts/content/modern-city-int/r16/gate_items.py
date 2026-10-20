#!/usr/bin/env python3
"""r16 다시 그린 기물을 object-gate 입력으로 내보낸다: OUT/<id>.png + OUT/items.jsonl({png,kind,name,label}).
  python3 gate_items.py OUT
종류는 감사 분류 + 이름 낱말로 정한다(아래 KIND). 판정은 npm run harness -- object-gate review --batch OUT/items.jsonl"""
import json, os, re, sys
import grid as G
AUDIT = '/home/main/claude-viz/interior-props-34-audit-1.json'
CAT = {'appliances_machines': 'tall_furniture', 'cabinets_lockers': 'tall_furniture', 'shelves_racks': 'tall_furniture',
       'counters_stalls': 'low_furniture', 'desks_tables': 'low_furniture', 'wall_mounted': 'wall_mounted',
       'doors_stairs_screens': 'structure', 'beds_sleeping': 'low_furniture', 'bath_sanitary': 'container',
       'pianos_instruments': 'tall_furniture', 'plants_nature': 'organic', 'flat_floor': 'flat'}
WORD = [(r'pillar|column|pole', 'column'), (r'bin|basket|bag|bucket|umbrella|candy', 'container'),
        (r'ambulance|truck|car|bus|sedan', 'other'), (r'hut|torii|booth|office|kiosk', 'structure'),
        (r'plinth|crate|box', 'box'), (r'fence|rack|stand', 'frame')]

def kind(pid, cat):
    for pat, k in WORD:
        if re.search(pat, pid): return k
    return CAT.get(cat, 'other')

def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    cats = {x['propId']: x['category'] for x in json.load(open(AUDIT)) if x['tileset'] == 'modern_city_interior'}
    lines = []
    for f in sorted(os.listdir(G.GRIDS)):
        pid = f[:-5]; png = os.path.join(out, pid + '.png')
        G.to_img(G.load(pid)).save(png)
        lines.append(json.dumps(dict(png=png, kind=kind(pid, cats.get(pid, '')), name=pid.replace('-', ' '), label='modern_city_interior/' + pid)))
    open(os.path.join(out, 'items.jsonl'), 'w').write('\n'.join(lines) + '\n')
    print(len(lines), 'items ->', os.path.join(out, 'items.jsonl'))

if __name__ == '__main__':
    main()

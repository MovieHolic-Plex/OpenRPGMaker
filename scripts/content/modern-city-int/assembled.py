#!/usr/bin/env python3
"""조립 관문 그림 — 혼자서는 윗면을 보일 수 없는 부품(문 넷·옆문)을 화소 그대로 품은 방 그림으로 object-gate(kind structure)에 낸다.
gothic assemble.py / jp gate_assembled.py 와 같은 규칙: 부품을 한 화소라도 다시 그리면 조립 그림 해시가 바뀌어 덮임이 풀린다
(굽기가 이 그림을 다시 만들어 영수증을 찾는다).
    python3 scripts/content/modern-city-int/assembled.py   → _gate/assembled-*.png + _gate/assembled.jsonl
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from preview import render_room                     # noqa: E402

DOORS = dict(
    plan=['#################',
          '#...............#',
          '#...............#',
          '#...............#',
          '#...............#',
          '##.###.###.###.##',
          '#...............#',
          '#...............#',
          '#...............#',
          '#...............#',
          '#######..########'],
    floor='mci-stone-lobby', wall='mci-wall-office',
    zones=[dict(x0=0, x1=16, y0=5, y1=10, floor='mci-vinyl-hospital', wall='mci-wall-hospital')],
    objects=[{'id': 'mci-door-wood', 'x': 2, 'y': 5}, {'id': 'mci-door-glass', 'x': 6, 'y': 5},
             {'id': 'mci-door-steel', 'x': 10, 'y': 5}, {'id': 'mci-door-hospital', 'x': 14, 'y': 5}],
)
SIDE = dict(
    plan=['#########',
          '#...#...#',
          '#...#...#',
          '#...#...#',
          '#...#...#',
          '#.......#',
          '#.......#',
          '#.......#',
          '#...#...#',
          '#...#...#',
          '##..#####'],
    floor='mci-wood-oak', wall='mci-wall-home',
    objects=[{'id': 'mci-sidedoor-wood', 'x': 4, 'y': 7}],
)


def assembled():
    out = []
    # 옆문(SIDE)은 2026-10-14 조립 판정 불합격(세로 칸막이 윗면 없음)으로 조각째 뺐다 — 평면은 이력으로 남긴다.
    for key, room, name, covers in (('doors', DOORS, '사무·병원 복도 칸막이에 단 열린 문 넷(위에서 본 방 두 칸)', ['mci-door-wood', 'mci-door-glass', 'mci-door-steel', 'mci-door-hospital']),):
        img, iss = render_room(room)
        assert not iss, (key, iss)
        out.append(dict(label='modern_city/assembled/' + key, kind='structure', name=name, img=img, covers=covers))
    return out


if __name__ == '__main__':
    D = os.path.join(HERE, '..', '..', '..', 'tiledata', 'modern-city', 'interior', '_gate')
    rows = []
    for a in assembled():
        p = os.path.abspath(os.path.join(D, a['label'].split('/')[-1].join(['assembled-', '.png'])))
        a['img'].save(p); rows.append(dict(png=p, kind=a['kind'], name=a['name'], label=a['label']))
    open('/tmp/mci-assembled.jsonl', 'w').write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
    print(rows)

#!/usr/bin/env python3
"""steampunk_city 이야기 기물 — 게임의 단계가 쓰는 물건(기록부 책상 · 정지 레버 · 벽 레버 · 지하 입구 해치 · 방 사이 철문 · 대심장 기관).

목록·이름·꼬리표·막힌 칸의 정본은 tiledata/steampunk-city/objects/spec.json 이고 여기서는 그 목록을 등록부(묶음 story)로 읽기만 한다.
그림은 Fable 5.2 medium 한 방(fable/draw.py 의 s-·x-heart- 주문 → fable/build.py → fable-redraw/pieces/story/sp-<id>.png) — 코드 도트가 없다.
등록부 순서: 굽기에서 실내(interior) 뒤에 온다 — 키트 목록에서 실내 계단(sp-stairs-down)이 거리 해치(sp-hatch-down)보다 먼저 오게.

  python3 story.py        # _gate/sp-<id>.png · items.jsonl 내보내기
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import Reg, contact, OUT

SPEC_PATH = os.path.join(OUT, 'objects', 'spec.json')
SPEC = json.load(open(SPEC_PATH, encoding='utf-8'))
R = Reg('story')
for _it in SPEC['items']:
    _tags = list(_it['words']) + (['실내'] if _it.get('indoor') and not _it.get('outdoor') else [])
    # solid = 막힌 칸(선언 그대로, 나머지 칸은 ★) · place = 놓는 법(굽기가 꼬리표로 옮긴다: decal 밟는 바닥 그림 · wallmount/walldoor 벽면 위)
    R.add_png(_it['id'], _it['name'], _it['w'], _it['h'], _it['kind'], tags=_tags, rules=_it['rule'], solid=[list(c) for c in _it['block']], place=_it['place'],
              note=_it['desc'], indoor=bool(_it.get('indoor') and not _it.get('outdoor')))


def sheet(path=None, z=4):
    items = [(it['id'], R.picture(it)) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'story', 'preview.png'), z=z, W=1200)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'story')

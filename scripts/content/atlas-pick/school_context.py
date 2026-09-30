#!/usr/bin/env python3
"""학원 세트 후보를 실내(또는 운동장) 맥락에 놓은 그림.
  python3 scripts/content/atlas-pick/school_context.py tiledata/atlas-pick/candidates-school/<slug>/s1-A.pxg   # → s1-A.ctx.png (4배)

공통 context.py 는 거리(현대 시트 보도·아스팔트) 둘레만 깐다. 학원 세트 대부분은 실내라서 여기서 따로 깐다.
  info.json place == 'in'  : v5 손 도트 실내 아틀라스의 밝은 널마루(floor:plank) 바닥, 벽 걸이·벽면은 회벽+판자 징두리(wall:plaster) 위.
  info.json place == 'out' : 공통 context.py 의 거리 맥락 그대로(보도·아스팔트).
v5 아틀라스(tiledata/hand-interior/v5/interior-atlas.png)는 읽기만 한다. 맥락 그림은 참고용 — 후보 검사·팔레트와 상관없다."""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import context

V5_ATLAS = os.path.join(ROOT, 'tiledata/hand-interior/v5/interior-atlas.png')
V5_META = os.path.join(ROOT, 'tiledata/hand-interior/v5/interior-meta.json')
FLOOR_ID, WALL_ID = 'floor:plank', 'wall:plaster'
_SW = {}

def swatch(kind, sid):
    if sid not in _SW:
        m = read_json(V5_META, {}); at = next(x['atlas'] for x in m[kind] if x['id'] == sid)
        _SW[sid] = Image.open(V5_ATLAS).convert('RGBA').crop((at['x'], at['y'], at['x'] + at['w'], at['y'] + at['h']))
    return _SW[sid]

def tiled(sw, wpx, hpx):
    im = Image.new('RGBA', (wpx, hpx))
    for y in range(0, hpx, sw.height):
        for x in range(0, wpx, sw.width):
            im.paste(sw, (x, y))
    return im

def room(wc, hc, wall_rows=0):
    im = tiled(swatch('floors', FLOOR_ID), wc * 16, hc * 16)
    if wall_rows:   # v5 회벽 견본(32×32) = 윗 반 회벽·아랫 반 판자 징두리. 회벽 속살만 위로 쌓고, 맨 아래 한 줄에 징두리
        sw = swatch('walls', WALL_ID); plaster = sw.crop((0, 4, sw.width, 12)); skirt = sw.crop((0, 16, sw.width, 32))
        im.paste(tiled(plaster, wc * 16, (wall_rows - 1) * 16), (0, 0))
        im.paste(tiled(skirt, wc * 16, 16), (0, (wall_rows - 1) * 16))
    return im

def indoor(it, slot):
    w, h = it['cells']; layer = it['layer']
    if layer == 'ground':      # 바닥 조각은 자기끼리 이어 붙인 판 둘레에 v5 마루 — 이음이 맞는지 본다
        wc, hc = w * 3 + 2, h * 3 + 2; im = room(wc, hc)
        for j in range(3):
            for i in range(3): im.alpha_composite(slot, ((1 + i * w) * 16, (1 + j * h) * 16))
        return im
    if layer == 'wall':
        wc, hc = w + 4, h + 4; im = room(wc, hc, h + 3); ox, oy = 2, 1
    elif layer == 'facade':    # 벽면 조각: 좌우로 세 번 이어 붙이고 발치에 마루
        wc, hc = w * 3 + 2, h + 2; im = room(wc, hc)
        for i in range(3): im.alpha_composite(slot, ((1 + i * w) * 16, 0))
        return im
    else:                      # object·decal: 뒤에 벽 한 줄, 앞은 마루
        wc, hc = w + 4, h + 3; im = room(wc, hc, 1); ox, oy = 2, 1
    im.alpha_composite(slot, (ox * 16, oy * 16))
    return im

def context_image(it, slot):
    if it.get('place') == 'out':
        context.BACKDROP = {}
        return context.jp_context(it, slot)
    return indoor(it, slot)

def main():
    for f in sys.argv[1:]:
        d = os.path.dirname(os.path.abspath(f)); it = read_json(os.path.join(d, 'info.json'))
        png = os.path.splitext(f)[0] + '.png'
        if not os.path.exists(png):
            sys.path.insert(0, PXGRID); import pxgrid; pxgrid.render(f, png)
        im = context_image(it, Image.open(png).convert('RGBA'))
        out = os.path.splitext(f)[0] + '.ctx.png'
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out); print(out)

if __name__ == '__main__':
    main()

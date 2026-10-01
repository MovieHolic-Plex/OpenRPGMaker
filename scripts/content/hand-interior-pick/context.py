#!/usr/bin/env python3
"""방 안 맥락 그림: 기물을 v5 예제 방(벽·바닥·옆 기물 그대로)에 놓고, 그 기물만 후보 그림으로 바꿔 잘라 낸다.
v5 예제 방 26곳에 없는 기물은 작은 견본 방(널마루·회벽)을 만들어 놓는다.

  python3 scripts/content/hand-interior-pick/context.py candidates/<slug>/w1-A.pxg   → w1-A.ctx.png (4배)
  python3 scripts/content/hand-interior-pick/context.py --v5 <slug>                   → candidates/<slug>/v5.ctx.png
새 기물(new/items.json)은 v5 그림이 없으므로 contextRoom 의 빈 자리에 임시로 한 번 놓는다(정본 방은 그대로).
고르는 화면(pick_server.py)도 이 모듈의 context_image() 를 쓴다.
"""
import copy, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

_IDX = None
def _index():
    """기물 id → (방, 그 방 안 항목 번호) 첫 등장. 가장 많이 놓인 방을 먼저."""
    global _IDX
    if _IDX is None:
        rooms4, _ = v5_modules(); cnt = {}
        for b, v in rooms4.B.items():
            for m in v['maps']:
                for k, it in enumerate(m['items']):
                    i = getattr(it[0], 'id', None)
                    cnt.setdefault(i, {}).setdefault(m['key'], (m, []))[1].append(k)
        _IDX = {i: max(d.values(), key=lambda mk: len(mk[1])) for i, d in cnt.items()}
    return _IDX

def to_item_image(o, slot):
    """후보 캔버스(v5 칸 자리, 패딩 포함) → 방 조립용 그림(패딩 뺀 image 크기)."""
    pad = geom(o)['padTop']
    return slot.crop((0, pad, slot.width, slot.height))

def _swap(f, im, fw=None):
    g = copy.copy(f)
    if fw is not None:   # 크기를 바꾼 기물(resize.json): 그림 그대로, 칸 수만 새로
        g.im = im; g.frames = None; g.fw = fw; return g
    if im.size != f.im.size:   # v5 스크립트 그림과 아틀라스 크기가 다른 드문 경우: 아래 맞춤
        c = Image.new('RGBA', f.im.size); c.alpha_composite(im.crop((0, max(0, im.height - f.im.height), min(im.width, f.im.width), im.height)), (0, max(0, f.im.height - im.height))); im = c
    g.im = im; g.frames = None
    return g

def _synthetic(o):
    rooms4, room4 = v5_modules(); import kit4
    f = kit4.OBJ[o['id']][1](); f.id = o['id']
    W = max(8, f.fw + 6); plan = ['#' * W] + ['#' + '.' * (W - 2) + '#'] * 6 + ['#' * W]
    x = (W - f.fw) // 2
    y = 1 if f.kind == 'hang' else (3 if f.kind == 'wall' else 4)
    items = [(f, x, y)]
    for r in o.get('related', [])[:2]:
        if r['id'] in kit4.OBJ:
            g = kit4.OBJ[r['id']][1](); g.id = r['id']
            gx = x + f.fw + 1 if len(items) == 1 else x - g.fw - 1
            gy = 1 if g.kind == 'hang' else (3 if g.kind == 'wall' else 4)
            if 1 <= gx and gx + g.fw <= W - 1: items.append((g, gx, gy))
    return dict(key='synthetic', name='견본 방', floor='plank', wall='plaster', zones=(), plan=plan, rooms=[], items=items), [0]

def context_image(o, slot=None, margin=(3, 3)):
    """1배 맥락 그림. slot=None 이면 v5 그대로. 반환 (그림, 방 이름)."""
    rooms4, room4 = v5_modules()
    if o.get('new'):   # 새 기물: 예제 방에 없다 → contextRoom 에 임시로 한 번 놓는다(new_items.context)
        import new_items
        return new_items.context(o, slot if slot is not None else v5_slot(o), margin)
    idx = _index().get(o['id'])
    m, ks = idx if idx else _synthetic(o)
    items = list(m['items'])
    if slot is not None:
        im = to_item_image(o, slot)
        G = geom(o); fw = G['footprint']['w'] if G['resized'] else None
        for k in ks:
            it = items[k]; items[k] = (_swap(it[0], im, fw),) + tuple(it[1:])
    n = dict(m); n['items'] = items
    full = room4.compose(n)
    f, x, y = items[ks[0]][:3]
    X0, Y0, X1, Y1 = room4.item_rect(f, x, y)
    mx, my = margin[0] * 16, margin[1] * 16
    box = (max(0, X0 - mx), max(0, Y0 - my), min(full.width, X1 + mx), min(full.height, Y1 + my))
    return full.crop(box), m.get('name') or m['key']

def main():
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument('pxg', nargs='?'); ap.add_argument('--v5'); a = ap.parse_args()
    if a.v5:
        o = objects_by_slug()[a.v5]; im, name = context_image(o); out = os.path.join(CAND, a.v5, 'v5.ctx.png')
    else:
        sys.path.insert(0, PXGRID); import pxgrid
        s = os.path.basename(os.path.dirname(os.path.abspath(a.pxg))); o = objects_by_slug()[s]
        _, slot = pxgrid.render(a.pxg, os.path.splitext(a.pxg)[0] + '.png')
        im, name = context_image(o, slot.convert('RGBA')); out = os.path.splitext(a.pxg)[0] + '.ctx.png'
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out)
    print(out, im.size, name)

if __name__ == '__main__':
    main()

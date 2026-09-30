# 16px 판 데모 방 (v5 소품 / v6 소품). 저장소 루트에서: python3 tiledata/hand-interior/v32-demo/room16.py OUTDIR
import sys, os
for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects', 'tiledata/hand-interior/v32-demo'):
    sys.path.insert(0, p)
import rooms4, room4, apply6
from rooms4 import o, T
from layout import PLAN, ITEMS, OBJECTS

def obj16(n):
    if n == 'dining 2x2':
        f = T('dining', 2, 2); f.id = n; return f
    return o(n)

def objects(v6=False, t=0):
    out = {}
    for n in OBJECTS:
        f = obj16(n)
        if v6: f = apply6.patch_item(f)
        out[n] = f
    return out

def room(v6=False, t=0):
    items = []
    for n, x, y in ITEMS:
        f = obj16(n)
        if v6: f = apply6.patch_item(f)
        items.append((f, x, y))
    m = dict(key='demo', plan=PLAN, floor='plank', wall='plaster', items=items)
    return room4.compose(m, t)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for tag, v in (('v5', False), ('v6', True)):
        im = room(v); im.save(f'{out}/room16-{tag}.png'); print(tag, im.size)

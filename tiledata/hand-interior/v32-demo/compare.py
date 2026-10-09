# 소품 한 종을 16px v5 / 16px v6 / 32px 로 같은 화면 크기로 나란히 (16px 는 2배 확대 후 배율 s/2… 즉 같은 칸 크기)
import sys
for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects', 'tiledata/hand-interior/v32-demo'):
    if p not in sys.path: sys.path.insert(0, p)
from PIL import Image
import room16, objs32 as O
BG = (150, 112, 76, 255)
B32 = {'dining 2x2': O.dining, 'chair S': lambda: O.chair('S'), 'chair N': lambda: O.chair('N'), 'barrel': O.barrel, 'water jar': O.jar}
def more():
    for k in ('bed', 'bed2', 'bookshelf', 'wardrobe', 'clock', 'sofa', 'armchair', 'fireplace'):
        if hasattr(O, k): pass
    if hasattr(O, 'bed'):
        B32['double bed red'] = lambda: O.bed(64, 'red'); B32['bed blue'] = lambda: O.bed(32, 'blue')
    for n, k in (('bookshelf 2w', 'bookshelf'), ('wardrobe', 'wardrobe'), ('clock', 'clock'), ('sofa', 'sofa'), ('armchair', 'armchair'), ('fireplace', 'fireplace')):
        if hasattr(O, k): B32[n] = getattr(O, k)
more()
_c5 = _c6 = None
def ims(n):
    global _c5, _c6
    if _c5 is None: _c5 = room16.objects(False); _c6 = room16.objects(True)
    a = _c5[n]; b = _c6[n]
    a = a.frames[0] if getattr(a, 'frames', None) else a.im
    b = b.frames[0] if getattr(b, 'frames', None) else b.im
    z = B32[n]() if n in B32 else None
    return a, b, z
def on_bg(im, s):
    b = Image.new('RGBA', im.size, BG); b.alpha_composite(im); return b.resize((im.width * s, im.height * s), Image.NEAREST)
def card(n, s=4):
    """s = 32px 판 배율. 16px 판은 2s 배."""
    a, b, z = ims(n)
    parts = [on_bg(a, 2 * s), on_bg(b, 2 * s)] + ([on_bg(z, s)] if z else [])
    W = sum(p.width for p in parts) + 16 * (len(parts) - 1); Hh = max(p.height for p in parts)
    o = Image.new('RGBA', (W, Hh), (30, 28, 34, 255)); x = 0
    for p in parts: o.alpha_composite(p, (x, Hh - p.height)); x += p.width + 16
    return o

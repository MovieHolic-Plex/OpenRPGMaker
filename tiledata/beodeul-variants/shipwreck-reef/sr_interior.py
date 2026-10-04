# 난파선 안쪽 세 방 — 선장실(16x14)·화물칸(24x14)·선원실(16x14). interior.room + compose, 가로로 나란히 한 장에.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4, interior
from interior import room, compose, SIZE
from interior_demo import rugset, lit

WALLOBJ = {'win', 'win.curtain', 'sconce', 'painting', 'shelf.wall', 'herbs', 'fireplace'}
WALKOVER = {'mat', 'candles'}

def _lum(p): return 0.299*p[0]+0.587*p[1]+0.114*p[2]

def _restyle(G, base):
    """3/4 재작업: 벽면(천장 밑 2칸)은 어둡고 가로 널 이음, 바닥은 밝고 세로 결 —
    벽 밑 그림자 줄, 천장 경계의 밝은 줄+어두운 줄을 더한다."""
    px = base.load(); RH = len(G); RW = len(G[0])
    for cy in range(RH):
        for cx in range(RW):
            n = G[cy][cx]
            if n.startswith('wall.'):
                for y in range(16):
                    for x in range(16):
                        X, Y = cx * 16 + x, cy * 16 + y
                        r, g, b, a = px[X, Y]
                        f = 0.60
                        if n.split('.')[2] == 'u' and y < 1: f = 1.05            # 천장 경계 밝은 줄
                        elif n.split('.')[2] == 'u' and y < 3: f = 0.30          # 그 밑 어두운 줄(천장 그늘)
                        elif y % 8 == 7: f = 0.40                                  # 가로 널 이음
                        px[X, Y] = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)), a)
                if n.split('.')[2] == 'b':                                          # 벽 밑 그림자(벽 앞면 마지막 줄 + 바닥 위 3줄)
                    for y in range(13, 16):
                        for x in range(16):
                            r, g, b, a = px[cx * 16 + x, cy * 16 + y]
                            px[cx * 16 + x, cy * 16 + y] = (int(r * .6), int(g * .6), int(b * .6), a)
            elif n.startswith('floor'):
                for y in range(16):
                    for x in range(16):
                        X, Y = cx * 16 + x, cy * 16 + y
                        r, g, b, a = px[X, Y]
                        px[X, Y] = (min(255, int(r * 1.22) + 6), min(255, int(g * 1.2) + 4), min(255, int(b * 1.12)), a)
                # 벽 바로 아래 바닥 3줄은 그림자(벽 밑 선)
                if cy > 0 and G[cy - 1][cx].startswith('wall.') and G[cy - 1][cx].split('.')[2] == 'b':
                    for y in range(0, 3):
                        for x in range(16):
                            r, g, b, a = px[cx * 16 + x, cy * 16 + y]
                            k = (.55, .68, .8)[y]
                            px[cx * 16 + x, cy * 16 + y] = (int(r * k), int(g * k), int(b * k), a)
    return base

def _finish(G, objs, RW, RH):
    base = _restyle(G, compose(G, []))
    for (n, x, y) in sorted(objs, key=lambda t: t[2] + SIZE[t[0]][1]):
        base.alpha_composite(interior.render(n), (x * 16, y * 16))
    im = base
    walk = np.zeros((RH, RW), bool)
    for y in range(RH):
        for x in range(RW):
            n = G[y][x]; walk[y, x] = n.startswith('floor') or n.startswith('rug')
    for (n, x, y) in objs:
        if n in WALKOVER or n in WALLOBJ: continue
        w, h = SIZE[n]; walk[y:y + h, x:x + w] = False
    return im, walk

def cabin():
    RW, RH = 16, 14
    G = room(RW, RH, 'wod', floor='wood', exit=12)             # 출구 = 갑판으로 나가는 문(오른쪽 아래)
    lit(G, 4, 3, 'wood')
    rugset(G, 4, 6, 5, 4)
    o = [('win', 3, 1), ('win', 6, 1), ('sconce', 9, 1), ('painting', 11, 1),
         ('bookshelf', 1, 2), ('bed.double', 12, 3), ('chest', 12, 6), ('wardrobe', 14, 2) if False else ('cupboard', 14, 1) if False else ('herbs', 13, 1) if False else ('shelf.wall', 13, 1),
         ('table.sq', 5, 7), ('chair.r', 4, 7), ('chair.l', 7, 7), ('candles', 6, 7),
         ('barrels', 1, 10), ('crate', 3, 11), ('sacks', 13, 10), ('plant', 14, 12), ('stool', 9, 10)]
    return _finish(G, o, RW, RH)

def hold():
    RW, RH = 24, 14
    G = room(RW, RH, 'wod', floor='wood', exit=None)
    lit(G, 9, 3, 'wood'); lit(G, 14, 3, 'wood')
    o = [('sconce', 4, 1), ('sconce', 12, 1), ('sconce', 20, 1), ('shelf.wall', 7, 1), ('shelf.wall', 15, 1),
         ('stairs.up', 9, 1),                                    # 갑판 승강구로
         ('stairs.down', 19, 3),                                 # 선원실로
         ('barrels', 1, 3), ('barrels', 3, 3), ('crates', 1, 5), ('sacks', 3, 6), ('crate', 1, 8),
         ('crates', 6, 5), ('sacks', 8, 5) if False else ('sacks', 6, 8),
         ('crates', 13, 5), ('barrels', 15, 5), ('crate', 13, 8), ('pots', 16, 8) if False else ('pots', 15, 8),
         ('chest', 9, 10), ('cauldron', 21, 9), ('stove', 19, 9) if False else ('stove', 20, 9),
         ('barrels', 1, 11), ('crates', 4, 11), ('sacks', 12, 11), ('crate', 17, 11), ('mat', 8, 12) if False else ('mat', 10, 8)]
    return _finish(G, o, RW, RH)

def crew():
    RW, RH = 16, 14
    G = room(RW, RH, 'wod', floor='wood', exit=None)
    lit(G, 6, 3, 'wood')
    o = [('win', 5, 1), ('sconce', 3, 1), ('sconce', 10, 1), ('painting', 12, 1),
         ('stairs.up', 1, 1),                                    # 화물칸에서 내려오는 계단
         ('bed.single', 4, 3), ('bed.single', 7, 3), ('bed.single', 12, 3),
         ('chest', 4, 6), ('chest', 7, 6), ('chest', 12, 6),
         ('table.long', 5, 9), ('bench', 5, 11) if False else ('stool', 5, 11), ('stool', 8, 11), ('candles', 6, 9),
         ('barrels', 13, 10), ('sacks', 11, 12) if False else ('sacks', 14, 12), ('plant', 1, 11)]
    return _finish(G, o, RW, RH)

def build_all(P=None):
    rooms = [('선장실', cabin()), ('화물칸', hold()), ('선원실', crew())]
    W = sum(r[1][0].width for r in rooms)
    strip = Image.new('RGBA', (W, 14 * 16), (12, 8, 18, 255))
    ims, walks, x = [], [], 0
    for name, (im, w) in rooms:
        strip.paste(im, (x, 0)); x += im.width; ims.append(im); walks.append(w)
    return strip, ims, walks

if __name__ == '__main__':
    strip, ims, walks = build_all()
    strip.save(os.path.join(HERE, '..', '_out-4', 'sr_int.png')); print(strip.size)

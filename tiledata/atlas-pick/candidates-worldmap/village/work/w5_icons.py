import os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../..'))
sys.path.insert(0, ROOT + '/scripts/content/atlas-pick')
from pxg_emit import emit
CWM = ROOT + '/tiledata/atlas-pick/candidates-worldmap'

LEG = {'k': ('wstone', 1), 'K': ('wstone', 0), 's': ('wstone', 5), 't': ('wstone', 4), 'u': ('wstone', 3), 'v': ('wstone', 2), 'S': ('wstone', 6),
       'p': ('mwhite', 2), 'q': ('mwhite', 1), 'r': ('mwhite', 0), 'P': ('mwhite', 3),
       '1': ('wroofr', 4), '2': ('wroofr', 3), '3': ('wroofr', 2), '4': ('wroofr', 1), '5': ('wroofr', 0),
       'a': ('wroofb', 4), 'b': ('wroofb', 3), 'c': ('wroofb', 2), 'd': ('wroofb', 1), 'e': ('wroofb', 0),
       'G': ('wgold', 4), 'H': ('wgold', 3), 'I': ('wgold', 2), 'J': ('wgold', 1),
       'D': ('wbark', 1), 'E': ('wbark', 0), 'B': ('wbark', 2),
       'w': ('mdglass', 1), 'y': ('myellow', 3), 'Y': ('myellow', 1),
       'x': ('wdirt', 3), 'z': ('wdirt', 2), 'Z': ('wdirt', 1), 'X': ('wdirt', 4),
       'F': ('mred', 3), 'f': ('mred', 2), 'g': ('wgrass', 2), 'h': ('wgrass', 3)}

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.g = [['.'] * w for _ in range(h)]
    def put(s, x, y, c, over=True):
        if 0 <= x < s.w and 0 <= y < s.h and (over or s.g[y][x] == '.'): s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else '.'
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def hl(s, x0, x1, y, c):
        for x in range(x0, x1 + 1): s.put(x, y, c)
    def rows(s): return [''.join(r) for r in s.g]
    def shadow(s, bw=1):
        """발치 오른쪽 아래 반투명 그림자: 바닥 줄 아래 1줄 + 오른쪽 옆으로 2칸 (빈 칸에만)"""
        H, W = s.h, s.w
        base = {}
        for x in range(W):
            for y in range(H - 1, -1, -1):
                if s.g[y][x] != '.': base[x] = y; break
        for x, y in base.items():
            if y + 1 < H: s.put(x + 1, y + 1, '~', over=False)
            if y + 2 < H and x + 2 < W: s.put(x + 2, y + 2, '-', over=False)

def gable(c, x0, x1, ybot, h, lit, dark, out, ridge=None, under=None, split=None):
    """대칭 삼각(박공/원뿔) 지붕. 아래 폭 x0..x1, 높이 h. 왼쪽 밝게·오른쪽 어둡게."""
    W = x1 - x0 + 1; cx = (x0 + x1 + 1) / 2
    top = ybot - h + 1
    for i in range(h):
        y = top + i
        f = (h - 1 - i) / max(1, h - 1)
        ins = int(round(((W - 2) / 2) * f))
        l, r = x0 + ins, x1 - ins
        for x in range(l, r + 1):
            col = lit if x + 0.5 < (split if split is not None else cx) else dark
            c.put(x, y, col)
        c.put(l, y, out); c.put(r, y, out)
    if ridge:
        for i in range(h):
            y = top + i
            f = (h - 1 - i) / max(1, h - 1); ins = int(round(((W - 2) / 2) * f)); l = x0 + ins
            if i < h - 1: c.put(l + 1, y, ridge)
    if under:
        c.hl(x0, x1, ybot, under)
    return top

def house(c, x0, w, yb, wallh, roofh, rf, wl, door=True, shade_r=1, win=False):
    """집: 벽(wl=(밝,중,어둠)) + 박공지붕(rf=(밝,어둠,테,마루))."""
    x1 = x0 + w - 1
    ytop = yb - wallh + 1
    c.rect(x0, ytop, x1, yb, wl[1])
    c.rect(x0, ytop, x0, yb, wl[0])
    c.rect(x1 - shade_r + 1, ytop, x1, yb, wl[2])
    c.hl(x0, x1, yb, wl[2])
    if door:
        dx = x0 + w // 2 - 1
        c.rect(dx, yb - 2, dx + 1, yb, 'D')
    if win:
        c.put(x0 + 1, ytop + 1, 'w'); c.put(x1 - 2, ytop + 1, 'w')
    gable(c, x0 - 1, x1 + 1, ytop - 1, roofh, rf[0], rf[1], rf[2], rf[3], under=rf[2])

def save(slug, key, c, title, note):
    d = f'{CWM}/{slug}'
    open(f'{d}/w5-{key}.pxg', 'w').write(emit(c.rows(), LEG, f'{slug} w5-{key} {title}'))
    open(f'{d}/w5-{key}.note', 'w').write(note + '\n')

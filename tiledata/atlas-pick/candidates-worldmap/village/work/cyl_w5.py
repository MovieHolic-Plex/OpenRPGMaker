from w5_icons import *
BLU = {'A': ('b','c','d','a'), 'B': ('b','d','e','a')}
RED = {'A': ('3','4','5','2'), 'B': ('2','4','5','1')}

def cyl(c, x0, x1, ytop, ybot, mode, win=True, roof=None, roofh=0, crenel=False):
    W = x1 - x0 + 1
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            f = (x - x0) / max(1, W - 1)
            if mode == 'A': col = 's' if f < .5 else 't'
            else: col = 'S' if f < .2 else ('s' if f < .5 else ('t' if f < .8 else 'u'))
            c.put(x, y, col)
    if mode == 'B':
        c.rect(x1, ytop, x1, ybot, 'k'); c.rect(x0, ytop, x0, ybot, 'S')
        c.hl(x0, x1, ybot, 'v')
        for y in range(ytop + 3, ybot, 4):
            c.hl(x0 + 1, x1 - 1, y, 't' if mode == 'B' else 's')
    else:
        c.hl(x0, x1, ybot, 'u')
        for y in range(ytop + 3, ybot, 4):
            c.hl(x0, x1, y, 't' if False else 's')
    if win:
        mx = (x0 + x1) // 2
        c.put(mx, ytop + 3, 'K'); c.put(mx, ytop + 4, 'K')
    if roof:
        gable(c, x0 - 1, x1 + 1, ytop - 1, roofh, roof[0], roof[1], roof[2], roof[3], under=roof[2])
    if crenel:
        for x in range(x0, x1 + 1):
            if (x - x0) % 2 == 0:
                c.put(x, ytop - 1, 't'); c.put(x, ytop - 2, 's')
        c.hl(x0, x1, ytop, 'S' if mode == 'B' else 's')

def door(c, gx, ytop, ybot, w=4):
    c.rect(gx, ytop, gx + w - 1, ybot, 'K')
    c.hl(gx + 1, gx + w - 2, ytop - 1, 'K')
    c.rect(gx + 1, ytop + 2, gx + w - 2, ybot, 'E'); c.hl(gx + 1, gx + w - 2, ytop + 1, 'B')

def flag(c, x, y, h, col1, col2):
    for i in range(h): c.put(x, y + i, 'K')
    c.rect(x + 1, y, x + 4, y + 2, col1); c.hl(x + 1, x + 4, y + 2, col2); c.put(x + 5, y + 1, col2)

def wallseg(c, x0, x1, ytop, ybot, mode):
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            c.put(x, y, 's' if mode == 'A' else ('S' if y == ytop else 't'))
    for x in range(x0, x1 + 1):
        if (x - x0) % 3 == 0: c.put(x, ytop - 1, 't'); c.put(x, ytop - 2, 's')
    c.hl(x0, x1, ybot, 'u' if mode == 'A' else 'v')
    if mode == 'B':
        c.rect(x0, ytop + 1, x0, ybot, 's')

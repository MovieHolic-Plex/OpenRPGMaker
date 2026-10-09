import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
LG = L(tarn='yzABCD', flame='EFGHIJ', wax='KLMNOP', void='abcd', dust='STUVWXY', blood='QRVWXZ'[:0] or 'qrstuv')
def flame(g, x, y, lean=0, big=1):
    """x: 왼쪽 열, 2px 폭. y: 심지 바로 위 줄. 불꽃 4줄(big=1) : 끝 F, 중간 G/H, 심 I(밝음)"""
    g.pts('F', x + lean * 2, y - 3)
    g.pts('G', x + lean, y - 2, x + lean + 1, y - 2)
    g.pts('H', x, y - 1, x + 1, y - 1) if lean == 0 else g.pts('H', x, y - 1, x + 1, y - 1)
    g.pts('I', x, y, x + 1, y)
    g.pts('J', x + (0 if lean == 0 else 0), y - 1) if False else None
def glow(g, cx, cy, r):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and g.get(x, y) == '.' and 0 <= x < g.w and 0 <= y < g.H:
                if x < 0 or y < 0: continue
                g.put(x, y, '%')

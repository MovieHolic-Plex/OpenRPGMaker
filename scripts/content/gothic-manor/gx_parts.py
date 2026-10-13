"""고딕 건물 조립 부품 — 지붕(寄棟·피라미드·유리)·벽·창·문·담쟁이·굴뚝·총안."""
from gx_core import *

def hip(c, x, y, w, h, ins, mat='slate', back=4, wear=0, s=0):
    """寄棟/피라미드 지붕 윗면: 뒤쪽 마루 띠(밝음) + 앞 사면(사다리꼴, 위 ins 만큼 좁다). 왼쪽 빛."""
    for r in range(h):
        t = r / max(1, h - 1); l = int(ins * (1 - t)); xs = x + l; xe = x + w - l
        for xx in range(xs, xe):
            edge_l = xx - xs; edge_r = xe - 1 - xx
            tone = 1 if (r % 4) else 0
            if (r // 4 + xx // 4) % 2 == 0 and r % 4 == 1: tone = 2        # 기와 비늘
            if edge_l < 3 + (r > h // 2): tone += 1
            if edge_r < 3: tone -= 2
            if wear and hsh(xx, r, s) % 11 < wear: tone -= 2               # 낡은 얼룩
            c.P(xx, y + r, K(mat, tone))
    # 마루 뒷면 띠
    lb = int(ins); 
    for r in range(back):
        for xx in range(x + lb + 1 + r, x + w - lb - 1 - r + (0 if r else 0)):
            c.P(xx, y - back + r, K(mat, 3 if r < back - 1 else 2))
    c.HL(x + lb + 1, y - 1, max(1, w - 2 * lb - 2), K(mat, 3))
    c.HL(x + int(ins) - 1, y, max(1, w - 2 * int(ins) + 2), K(mat, 3))

def eave(c, x, y, w, mat='stone'):
    """처마 밑 그늘 띠 2행 + 벽 윗선."""
    c.HL(x - 1, y, w + 2, K('slate', -3)); c.HL(x - 1, y + 1, w + 2, K('shadow' if False else 'stone', -3))

def wall(c, x, y, w, h, mat='stone', s=0):
    if mat == 'brick':
        c.R(x, y, w, h, K('blood', 0))
        for j in range(0, h, 3):
            c.HL(x, y + j + 2, w, K('blood', -2)) if j + 2 < h else None
            for i in range((4 if (j // 3) % 2 else 0), w, 8):
                for k in range(2):
                    if j + k < h: c.P(x + i, y + j + k, K('blood', -2))
            if j + 1 < h and j % 6 == 0:
                for i in range(2, w, 5):
                    c.P(x + i, y + j, K('blood', 1 + (hsh(i, j, s) % 2)))
        c.VL(x, y, h, K('blood', 2)); c.VL(x + w - 1, y, h, K('blood', -2))
    else:
        stones(c, x, y, w, h, mat, s)

def gwin(c, x, y, w=6, h=11, lit=False, arch=True, bars=True, mat='stone'):
    """고딕 창: 돌 틀 + 어두운 유리(+노란 불빛) + 십자 살 + 문미석."""
    c.R(x - 1, y - 1, w + 2, h + 2, K(mat, 2)); c.R(x - 1, y + h, w + 2, 1, K(mat, -2))
    c.R(x, y, w, h, K('glass', -1) if not lit else K('lamp', 0))
    if lit:
        c.HL(x, y, w, K('lamp', 1)); c.R(x + 1, y + 2, w - 2, h - 3, K('lamp', 2)); c.HL(x + 1, y + 2, w - 2, K('lamp', 3))
    else:
        c.HL(x, y, w, K('glass', 1)); c.VL(x, y, h, K('glass', 0)); c.P(x + 1, y + 2, K('glass', 3))
    if arch:
        c.P(x - 1, y - 1, OL); c.P(x + w, y - 1, OL); c.P(x, y, K(mat, 2)); c.P(x + w - 1, y, K(mat, 2))
        c.HL(x + 1, y - 2, w - 2, K(mat, 3))
    if bars:
        c.VL(x + w // 2, y, h, K('iron', 0)); c.HL(x, y + h // 2, w, K('iron', 0))
    c.HL(x - 2, y + h + 1, w + 4, K(mat, 3)); c.HL(x - 2, y + h + 2, w + 4, K(mat, -3))

def gdoor(c, x, y, w=10, h=14, mat='wood'):
    c.R(x - 2, y - 2, w + 4, h + 2, K('stone', 2)); c.R(x - 2, y + h - 1, w + 4, 1, K('stone', -2))
    c.R(x, y, w, h, K(mat, -1))
    for i in range(1, w - 1, 3): c.VL(x + i, y + 1, h - 1, K(mat, 0)); c.VL(x + i + 1, y + 1, h - 1, K(mat, -2))
    c.HL(x, y, w, K(mat, 1)); c.HL(x, y + 3, w, K('iron', 1)); c.HL(x, y + h - 4, w, K('iron', 1)); c.P(x + w - 3, y + h // 2, K('lamp', 1))
    c.P(x - 2, y - 2, OL); c.P(x + w + 1, y - 2, OL); c.HL(x - 1, y - 3, w + 2, K('stone', 3))
    c.HL(x - 3, y + h, w + 6, K('stone', 3)); c.HL(x - 3, y + h + 1, w + 6, K('stone', -3))

def ivy(c, x, y, w, h, s=0, dens=40):
    for j in range(h):
        for i in range(w):
            r = hsh(x + i, y + j, s) % 100
            lim = dens * (1 - j / (h + 1))
            if r < lim and c.has(x + i, y + j): c.P(x + i, y + j, K('ivy', (r % 3) - 1 + (1 if hsh(i, j, s + 7) % 5 == 0 else 0)))
    for i in range(0, w, 3):                                       # 늘어진 덩굴
        n = 2 + hsh(x + i, s, 9) % (h // 2 + 1)
        for j in range(n):
            if c.has(x + i, y + j): c.P(x + i, y + j, K('ivy', -1 + (j % 2)))

def chimney(c, x, y, w=5, top=4, front=7, mat='stone'):
    cube(c, x, y, w, top, front, mat, tt=2, ft=-1, ol=False); c.R(x + 1, y + 1, w - 2, top - 2, K('shadow', 1))

def plinth(c, x, y, w, h=3, mat='stone'):
    c.R(x, y, w, h, K(mat, -1)); c.HL(x, y, w, K(mat, 2)); c.HL(x, y + h - 1, w, K(mat, -3))

def battlements(c, x, y, w, mat='stone', n=None):
    """총안 흉벽: 앞 모서리를 따라 석재 덩이(윗면 3 + 앞면 3)와 틈."""
    step = 8
    for bx in range(x, x + w - 3, step):
        cube(c, bx, y, 6, 3, 4, mat, tt=3, ft=0, ol=False)

import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
LG = L(mahog='0123456', murk='efghijk', moon='lmnopq', void='abcd', dust='STUVWXY', sheet='rstuvwx')
OUT = {0: (5, 10), 1: (3, 12), 2: (2, 13)}
def outer(y):
    if y in OUT: return OUT[y]
    return (1, 14) if 3 <= y <= 23 else None
def inner(y):
    if y == 2: return (5, 10)
    if 3 <= y <= 21: return (3, 12)
    return None
def inside(x, y, f):
    r = f(y); return r is not None and r[0] <= x <= r[1]

def mirror(light=1, lightside=True):
    g = G(16, 32)
    for y in range(0, 24):
        for x in range(0, 16):
            if not inside(x, y, outer): continue
            if inside(x, y, inner): continue           # 유리는 나중에
            out4 = lambda dx, dy: not inside(x + dx, y + dy, outer)
            if any(out4(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                t = 0 if (out4(1, 0) or out4(0, 1)) else 1
                if y == 0 or (out4(0, -1) and not out4(1, 0)): t = 2 if light > 1 else 1
                if out4(-1, 0) and not out4(0, 1): t = 2
            else:
                gl = lambda dx, dy: inside(x + dx, y + dy, inner) and y + dy <= 21
                if gl(1, 0) or gl(0, 1): t = 4 if light == 1 else 5
                elif gl(-1, 0) or gl(0, -1): t = 2 if light == 1 else 1
                else: t = 3 if light == 1 else 4
                if x <= 3 and t == 3: t = 4
                if x >= 12 and t == 3: t = 2 if light == 1 else 1
                if light > 1 and x <= 2: t = 6
            g.put(x, y, '0123456'[t])
    # 유리
    for y in range(2, 22):
        for x in range(3, 13):
            if not inside(x, y, inner): continue
            d = x + y
            t = 'gfhg'[(x * 3 + y) % 4] if False else 'g'
            if light == 1:
                c = 'g'
                if 12 <= d <= 14: c = 'i'
                elif d == 11 or d == 15: c = 'h'
                elif d > 24: c = 'f'
                elif x == 3 or y == 3: c = 'f'
            else:   # 강한 대비: 어두운 판 + 아주 밝은 사선
                c = 'f'
                if 11 <= d <= 12: c = 'j'
                elif 13 <= d <= 14: c = 'k'
                elif d == 10 or d == 15: c = 'h'
                elif d > 22: c = 'e'
                elif x == 3 or y == 3: c = 'e'
            g.put(x, y, c)
    # 하단 레일 + 서랍 받침
    g.h(1, 14, 22, '5' if light == 1 else '6'); g.h(1, 14, 23, '2')
    g.put(1, 22, '1'); g.put(14, 22, '1'); g.put(1, 23, '1'); g.put(14, 23, '0')
    g.h(2, 13, 24, '5' if light == 1 else '6')
    for y in range(25, 30): g.h(2, 13, y, '3')
    g.v(2, 25, 29, '4'); g.v(13, 25, 29, '1'); g.h(2, 13, 29, '1'); g.put(13, 29, '0')
    g.rect(4, 26, 11, 28, '2'); g.h(4, 11, 26, '1'); g.h(4, 11, 28, '4'); g.put(4, 27, '1'); g.put(11, 27, '4')
    g.pts('6', 7, 27, 8, 27); g.pts('1', 8, 28, 7, 28) if False else None
    g.pts('2', 3, 30, 4, 30, 11, 30, 12, 30, 3, 31, 4, 31, 11, 31, 12, 31); g.pts('1', 4, 31, 12, 31, 4, 30, 12, 30)
    return g

def cracks(g, bright='p', dark='b'):
    L1 = [(9,10),(8,9),(7,8),(6,7),(5,6),(4,5)]
    L2 = [(10,9),(11,8),(11,7),(12,6),(12,5)]
    L3 = [(9,11),(8,12),(8,13),(7,14),(6,15),(6,16),(5,17)]
    L4 = [(10,11),(11,12),(12,13),(12,14)]
    L5 = [(8,10),(7,10),(6,11),(5,11),(4,12)]
    for ln in (L1, L2, L3, L4, L5):
        for x, y in ln:
            if g.get(x, y) in 'efghijk':
                g.put(x, y, bright)
        for x, y in ln[1:]:
            if g.get(x + 1, y + 1) in 'efghijk': g.put(x + 1, y + 1, dark)
    g.put(9, 10, 'q'); 
def fragment(g):
    for y, xs in ((4, (10, 12)), (5, (10, 12)), (6, (11, 12)), (7, (12, 12))):
        for x in range(xs[0], xs[1] + 1): g.put(x, y, 'a' if y > 5 or x == 12 else 'b')
    g.pts('o', 9, 4, 9, 5, 10, 6, 11, 7)      # 깨진 가장자리 밝은 결
    g.pts('1', 10, 4, 10, 5, 11, 6)           # 뒷판 나무가 살짝 보임
def dustline(g):
    g.h(6, 9, 0, 'X') ; g.pts('W', 5, 1, 10, 1, 4, 2); g.pts('X', 3, 22 + 1 - 1, 12, 24)

# A: v5 를 늙힘
a = mirror(1); cracks(a); fragment(a); dustline(a); a.pts('W', 3, 24, 9, 24)
# B: 강한 명암 + 바닥 그림자
b = mirror(2); cracks(b, 'q', 'a'); fragment(b)
b.put(6, 0, '6'); b.h(6, 9, 0, '5')
for x in range(5, 16): b.put(x, 31 if x > 12 else 31, b.get(x, 31))
b.pts('~', 13, 30, 14, 30, 15, 30, 13, 31, 14, 31, 15, 31, 5, 31, 6, 31, 7, 31, 8, 31, 9, 31, 10, 31)
b.pts('-', 15, 29, 15, 28)
# C: 거울 속 사람 그림자
c = mirror(1)
for y in range(3,22):
    for x in range(3,13):
        m={'f':'h','g':'i','h':'i'}
        if c.get(x,y) in m: c.put(x,y,m[c.get(x,y)])
cracks(c); fragment(c)
for y, (x0, x1) in {12: (7, 9), 13: (6, 10), 14: (6, 10), 15: (5, 11), 16: (4, 12), 17: (4, 12), 18: (4, 12), 19: (4, 12), 20: (4, 12), 21: (4, 12)}.items():
    pass
# 머리(둥글게) + 어깨: 유리 안쪽 아래 중앙, 갈라진 선 아래에 놓아 균열이 얼굴을 가르도록
for (y, x0, x1) in ((11, 7, 9), (12, 6, 10), (13, 6, 10), (14, 6, 10), (15, 7, 9), (16, 6, 10), (17, 5, 11), (18, 4, 12), (19, 4, 12), (20, 4, 12), (21, 4, 12)):
    for x in range(x0, x1 + 1):
        if c.get(x, y) in 'efghijklmnopq': c.put(x, y, 'a' if c.get(x, y) not in 'pq' else c.get(x, y))
c.pts('r', 7, 13, 9, 13)      # 창백한 눈 두 점
c.pts('t', 8, 15) if False else None
cracks_keep = None
notes = {'A': ('v5 거울을 묵힘: 방사형 균열(밝은 선+어두운 짝), 오른쪽 위 조각 하나 떨어져 뒷판이 보임, 틀·서랍 위에 먼지', a),
         'B': ('빛 대비 강화: 틀 왼쪽 최고 밝기·오른쪽 최암, 유리에 강한 사선 반사, 균열이 더 하얗게, 바닥 오른쪽 아래 접촉 그림자', b),
         'C': ('거울 속에 서 있는 사람 그림자(머리·어깨, 흰 눈 두 점)가 균열 선에 갈려 있다 — 비치는 것이 나와 다르다', c)}
finish('mirror_cracked', notes, LG)

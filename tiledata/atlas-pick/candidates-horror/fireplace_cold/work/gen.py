import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
LG = L(vstone='0123456', rot='ghijklm', void='nopq', dust='rstuvwx', soil='yzABCD', vgold='EFGHIJK', paper='LMNOPQR')
def st(t): return '0123456'[max(0, min(6, t))]
def rt(t): return 'ghijklm'[max(0, min(6, t))]
def ds(t): return 'rstuvwx'[max(0, min(6, t))]
def sl(t): return 'yzABCD'[max(0, min(5, t))]
def build(k):
    g = G(32, 32)
    if k == 'A': f, lit, drk, jn = 3, 4, 2, 1
    else: f, lit, drk, jn = 3, 5, 1, 0
    # 받침판
    for y in range(29, 32):
        for x in range(2, 30):
            t = lit if y == 29 else (f if y == 30 else drk)
            if k == 'B': t = (lit if y == 29 else 2 if y == 30 else 0)
            g.put(x, y, st(t))
    for x in (8, 15, 22): g.put(x, 30, st(jn)); 
    g.h(2, 29, 31, st(jn))
    # 기둥
    for side, x0 in (('L', 3), ('R', 23)):
        for y in range(14, 29):
            row = (y - 14) // 4
            for x in range(x0, x0 + 6):
                i = x - x0
                t = f
                if k == 'B': t = lit - 0 if side == 'L' and i < 3 else (drk if side == 'R' and i >= 3 else f)
                if k == 'B' and side == 'L': t = lit if i < 2 else (f if i < 5 else drk)
                if k == 'B' and side == 'R': t = f if i < 2 else (drk if i < 5 else 0)
                if k == 'A' and side == 'L' and i == 0: t = lit
                if k == 'A' and side == 'R' and i == 5: t = drk
                g.put(x, y, st(t))
            if (y - 14) % 4 == 3: g.h(x0, x0 + 5, y, st(jn))
            vj = x0 + (2 if row % 2 == 0 else 4)
            if (y - 14) % 4 != 3: g.put(vj, y, st(jn))
    # 상인방
    for y in range(10, 14):
        for x in range(3, 29):
            t = f
            if y == 10: t = lit
            if y == 13: t = drk if k == 'A' else 0
            if k == 'B' and x >= 20: t = max(t - 2, 0)
            g.put(x, y, st(t))
    for x in (8, 14, 20, 25): g.v(x, 11, 12, st(jn))
    # 선반
    for x in range(1, 31):
        g.put(x, 5, rt(5 if k == 'B' else 4)); g.put(x, 6, rt(4 if k == 'B' else 3)); g.put(x, 7, rt(3 if k == 'A' else 3))
        g.put(x, 8, rt(3 if k == 'A' else 3)); g.put(x, 9, rt(2 if k == 'A' else 1))
    g.h(1, 30, 5, rt(5 if k == 'B' else 4))
    g.h(1, 30, 8, rt(3)); g.h(1, 30, 9, rt(1 if k == 'B' else 2))
    g.put(1, 5, rt(5)); g.put(1, 6, rt(4))
    g.h(2, 29, 10, st(0))  # 선반 밑 그림자 줄(돌)
    # 아궁이 안
    for y in range(14, 29):
        for x in range(9, 23):
            g.put(x, y, 'o' if (x < 11 or x > 20 or y < 16) else 'p')
    g.h(9, 22, 14, 'n'); g.h(9, 22, 15, 'n')
    g.v(9, 14, 28, 'n')
    for y in range(16, 26):
        for x in range(12, 20): g.put(x, y, 'q' if (x in (14, 15, 16, 17) and y > 18) else 'p')
    # 재 더미
    for y in range(25, 29):
        for x in range(9, 23):
            d = abs(x - 15.5) / 7
            if y == 28 or (y == 27 and d < 0.95) or (y == 26 and d < 0.7) or (y == 25 and d < 0.4):
                g.put(x, y, ds(1 if (x + y) % 3 else 2))
    g.h(11, 20, 28, ds(0)); g.pts(ds(3), 13, 26, 17, 27, 11, 27); g.pts(ds(3), 19, 28)
    # 통나무 둘(타다 남음)
    for i in range(9):
        g.put(11 + i, 24 - (i // 3), sl(1)); g.put(11 + i, 25 - (i // 3), sl(2 if i < 5 else 1)); g.put(11 + i, 26 - (i // 3), sl(0))
    g.pts(sl(3), 11, 24, 12, 24); g.pts(sl(0), 14, 23, 17, 22, 19, 23)
    for i in range(7):
        g.put(19 - i, 22 - (i // 3), sl(1)); g.put(19 - i, 23 - (i // 3), sl(0))
    g.pts(sl(2), 19, 22, 18, 22); g.put(20, 22, sl(3)); g.put(20, 23, sl(1))
    # 그을음 부채
    for x in range(10, 22): g.put(x, 13, st(0))
    for x in range(12, 20): g.put(x, 12, st(0))
    for x in range(14, 18): g.put(x, 11, st(0))
    g.pts(st(1), 11, 13, 21, 13, 13, 12, 18, 12, 15, 10, 16, 10, 12, 11, 19, 11)
    g.pts(st(0), 15, 9, 16, 9) if False else None
    # 선반 위 먼지
    for x in (3, 4, 8, 12, 13, 17, 26, 27):
        g.put(x, 5, ds(4))
    g.pts(ds(3), 6, 6, 10, 6, 15, 6, 23, 6, 29, 6)
    return g
def frame(g, x, y, k):
    # 선반 윗면에 누운 액자 (x..x+8, y..y+2)
    for i in range(9):
        for j in range(3):
            g.put(x + i, y + j, 'F' if j < 3 else 'F')
    g.h(x, x + 8, y, 'H' if k != 'B' else 'I'); g.h(x + 1, x + 7, y + 1, 'M'); g.h(x, x + 8, y + 2, 'E')
    g.put(x, y + 1, 'G'); g.put(x + 8, y + 1, 'E')
    g.pts('L', x + 4, y + 1, x + 5, y + 1); g.put(x + 3, y + 1, 'O') ; g.put(x + 6, y + 1, 'L')
gA = build('A'); frame(gA, 19, 5, 'A')
gB = build('B'); frame(gB, 19, 5, 'B')
for y in range(11, 32): gB.put(30, y, '~') if gB.get(30, y) == '.' else None
for y in range(11, 32): gB.put(31, y, '-') if gB.get(31, y) == '.' else None
for x in range(2, 30): pass
# C: 재 속 작은 두개골과 갈비 한 쌍
gC = build('A'); frame(gC, 19, 5, 'A')
# 통나무 하나 치우고 그 자리에 뼈
for y in range(22, 27):
    for x in range(10, 21): gC.put(x, y, 'p' if y < 25 else gC.get(x, y)) if y < 25 else None
for i in range(9):
    for y in range(22, 26): pass
# 두개골(5x5) x13..17,y21..25
sk = ['.rvvv.'[0:0] ]
skull = [' xvvvx ', 'xwwwwwx', 'xwrwrwx', 'xwwswwx', ' xwwwx ', '  xtx  ']
for j, row in enumerate(skull):
    for i, c in enumerate(row):
        if c != ' ':
            m = {'x': ds(2), 'v': ds(3), 'w': ds(4), 'r': 'q', 's': ds(2), 't': ds(3)}[c]
            gC.put(12 + i, 20 + j, m)
gC.pts('q', 14, 22, 16, 22)
gC.pts(ds(5), 14, 21)
# 갈비 (왼쪽 재 위)
gC.pts(ds(4), 10, 24, 11, 23, 11, 24, 10, 25) ; gC.pts(ds(3), 19, 24, 20, 25, 21, 25)
notes = {'A': ('낡은 돌 벽난로(2×2): 돌 틀·나무 선반, 아궁이 안 재와 타다 남은 통나무, 상인방까지 번진 그을음, 선반 위 먼지와 쓰러져 누운 액자 — 불 없음', gA),
         'B': ('빛 대비 강화: 왼쪽 돌 면 두 단 밝게·오른쪽 안쪽 어둡게, 선반 윗면 밝은 모서리, 오른쪽 옆과 밑에 반투명 접촉 그림자', gB),
         'C': ('실루엣 재해석: 재와 통나무 사이에 작은 두개골이 놓여 있고 눈구멍 속은 아궁이보다 검다, 갈비 조각이 재 위에', gC)}
finish('fireplace_cold', notes, LG, 10)

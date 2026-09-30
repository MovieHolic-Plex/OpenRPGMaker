import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
LG = L(ward='abcdefg', murk='hijklmn', vwood='012345678', vgreen='opqrstu', blood='vwxyzA', dust='BCDEFGH', void='IJKL')
def wd(t): return 'abcdefg'[max(0, min(6, t))]
def mk(t): return 'hijklmn'[max(0, min(6, t))]
def build(k):
    g = G(16, 32)
    if k == 'B': body, hi, lo, edge = 3, 6, 1, 0
    else: body, hi, lo, edge = 3, 4, 2, 1
    # 몸통 x1..13
    for y in range(0, 32):
        for x in range(1, 14):
            t = body
            if x == 1: t = hi
            if x == 13: t = lo
            if y == 0: t = hi
            g.put(x, y, wd(t))
    g.h(1, 13, 31, wd(edge)); g.h(1, 13, 30, wd(lo)); g.put(1, 30, wd(body))
    g.v(1, 0, 31, wd(hi)) ; g.put(1, 31, wd(edge))
    g.h(1, 13, 4, wd(lo)); g.h(1, 13, 5, wd(edge)) if False else None
    # 유리문 안쪽(어두운 안 선반 칸): 좌 x2..6, 우 x8..12, y5..16
    for (x0, x1) in ((2, 6), (8, 12)):
        for y in range(5, 17):
            for x in range(x0, x1 + 1):
                g.put(x, y, mk(1 if k == 'B' else 2))
        for x in range(x0, x1 + 1):
            g.put(x, 8, wd(edge if k == 'B' else 2)); g.put(x, 12, wd(edge if k == 'B' else 2)); g.put(x, 16, wd(edge if k == 'B' else 2))
    # 중앙 기둥
    g.v(7, 5, 17, wd(lo + 1)); g.h(2, 12, 17, wd(lo))
    # 문 테두리(유리 둘레)
    for x in range(2, 13):
        if x != 7: g.put(x, 4, wd(lo))
    # 약병
    def bottle(x, y, brown):
        c = '3' if brown else 'r'; d = '1' if brown else 'p'; l = '5' if brown else 't'
        g.pts(c, x, y + 1, x, y + 2); g.pts(l if k == 'B' else c, x, y + 1) ; g.pts(d, x + 1, y + 1, x + 1, y + 2)
        g.pts('4' if brown else 's', x, y)
        g.put(x + 1, y, d)
    for (bx, by, br) in ((3, 9, True), (5, 9, False), (3, 13, False), (5, 13, True), (3, 5, True), (5, 6, False),):
        bottle(bx, by, br)
    for (bx, by, br) in ((9, 9, False), (11, 9, True), (9, 13, True), (11, 13, False), (9, 6, True), (11, 5, False)):
        bottle(bx, by, br)
    # 서랍 y18..30
    g.h(2, 12, 18, wd(lo))
    for (y0, y1) in ((19, 24), (26, 29)):
        for y in range(y0, y1 + 1):
            for x in range(2, 13):
                g.put(x, y, wd(body + 1 if y == y0 else body))
        g.h(2, 12, y1, wd(lo)); g.v(12, y0, y1, wd(lo + 0))
    g.h(2, 12, 25, wd(edge)); g.h(2, 12, 30, wd(edge))
    for (y) in (22, 28):
        g.h(6, 8, y, 'B' if False else 'H' if k == 'B' else 'F'); g.put(9, y, 'D')
    # 붉은 십자 (x6..8, y0..3 위쪽 띠) — 상단 띠는 y0..3
    for y in range(0, 4):
        for x in range(2, 13): g.put(x, y, wd(body if y else hi))
    g.h(1, 13, 0, wd(hi))
    for x in range(2, 13): g.put(x, 3, wd(lo))
    return g
def cross(g, tone=3):
    g.pts('y', 7, 0, 7, 1, 7, 2, 6, 1, 8, 1)
    g.pts('z', 7, 1) if tone > 3 else None
def dust(g, k):
    for x in (2, 4, 6, 9, 11): g.put(x, 0, 'F') if k != 'B' else None
    g.pts('E', 3, 1, 10, 1, 12, 0)
def broken(g, x0=8, kind='A'):
    # 오른쪽 문 유리 위쪽이 깨져 비었다 (x9..12,y5..10 안쪽은 어둠)
    for y in range(5, 11):
        for x in range(9, 13):
            if (x, y) in ((9, 5), (10, 5)) and kind == 'A': continue
            g.put(x, y, 'J' if y > 5 else 'I')
    g.pts('l', 9, 5, 10, 6, 12, 5, 8, 6, 12, 10) if kind == 'A' else g.pts('k', 8, 5)
    g.pts('n', 8, 8, 9, 7) if False else None
gA = build('A'); cross(gA); dust(gA, 'A'); broken(gA)
# 쓰러진 병: 오른쪽 셋째 칸(y13..15)에서 병 하나를 눕힌다
for x in range(9, 13): gA.put(x, 15, 'o' if x % 2 else 'p'); gA.put(x, 14, gA.get(x, 14))
gA.pts('r', 9, 15, 10, 15, 11, 15); gA.pts('p', 12, 15); gA.pts('t', 9, 14)
# 유리 파편이 서랍 위 턱에
gA.pts('m', 3, 17, 9, 17, 10, 17); gA.pts('l', 4, 17)
gB = build('B'); cross(gB); dust(gB, 'B'); broken(gB, kind='B')
# 유리 반사 사선
for i in range(6):
    gB.put(2 + i // 2 * 1 + 0, 5 + i * 2 if 5 + i * 2 < 16 else 5, 'm') if False else None
for (x, y) in ((3, 6), (2, 7), (2, 10), (3, 9), (2, 14), (3, 13)):
    if gB.get(x, y) in 'hijk': gB.put(x, y, 'm')
for y in range(1, 32):
    if y >= 3: gB.put(14, y, '~')
    if y >= 3: gB.put(15, y, '-')
gB.h(2, 14, 31, '~') if False else None
gB.pts('~', 14, 31); 
gC = build('A'); dust(gC, 'A')
# 십자에서 핏방울이 기둥 아래로 흐른다
gC.pts('y', 7, 0, 7, 1, 7, 2, 6, 1, 8, 1); gC.pts('y', 7, 3); gC.pts('x', 7, 4)
# 오른쪽 문: 유리가 깨져 안이 캄캄한데 눈 두 점이 이쪽을 본다
for y in range(5, 17):
    for x in range(8, 13): gC.put(x, y, 'J' if y > 5 else 'I')
gC.pts('l', 8, 5, 12, 5, 9, 6, 12, 16, 8, 16)
for x in (8, 12): gC.put(x, 8, gC.get(x, 8)); 
gC.pts('J', 8, 8, 9, 8, 10, 8, 11, 8, 12, 8, 8, 12, 9, 12, 10, 12, 11, 12, 12, 12)
gC.pts('F', 9, 10, 11, 10); gC.pts('G', 9, 11, 11, 11) if False else None
gC.pts('K', 10, 10, 10, 11) if False else None
gC.put(9, 10, 'G'); gC.put(11, 10, 'G'); gC.put(9, 9, 'H') if False else None
# 왼쪽 문 병: 하나가 없다 (빈 자리)
for x in (5, 6): 
    for y in (9, 10, 11): gC.put(x, y, mk(2))
notes = {'A': ('벽 앞 흰 쇠 약장 낡음: 윗단 유리문 둘 중 오른쪽 위가 깨져 어두운 칸이 비고, 안 선반 세 단에 갈색·초록 약병, 병 하나가 누웠고 서랍 위 턱에 유리 조각, 서랍 손잡이·상단 띠에 붉은 십자와 먼지', gA),
         'B': ('빛 대비 강화: 왼쪽 모서리·위 판을 밝게, 오른쪽을 두 단 어둡게, 유리에 사선 반사, 오른쪽에 반투명 접촉 그림자', gB),
         'C': ('실루엣 재해석: 오른쪽 문의 깨진 유리 너머 캄캄한 칸에 밝은 두 점(눈)이 이쪽을 보고, 십자에서 피가 한 줄 흘러내린다', gC)}
finish('medicine_cabinet', notes, LG, 10)

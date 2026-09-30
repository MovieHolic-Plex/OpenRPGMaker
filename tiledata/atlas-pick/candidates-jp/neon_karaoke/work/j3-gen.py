import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'neon_karaoke'
KA = ["....XX...", "XXXXXXXXX", "XXXXXXXXX", "...XX.XX.", "...XX.XX.", "..XX..XX.", "..XX..XX.", ".XX...XX.", "XX....XX.", "XX..XXXX."]
RA = ["..XXXXX..", "..XXXXX..", ".........", "XXXXXXXXX", "XXXXXXXXX", "......XX.", ".....XX..", "...XXX...", "..XX.....", "XXX......"]
O_ = ["...XX....", "XXXXXXXXX", "...XX.XX.", "..XXX.X..", "..XXXXX..", ".XX.XX...", "XX..XX...", "....XX...", "....XX...", "XXXXXX..."]
KE = ["..XX.....", ".XXXXXXXX", "XX.......", "XXXXXXXXX", "XXXXXXXXX", "....XX...", "...XX....", "..XX.....", ".XX......", "XX......."]
GL = [KA, RA, O_, KE]
XS = [3, 14, 25, 36]
def cells(dx=0, dy=3):
    s = set()
    for gl, x0 in zip(GL, XS):
        for j, r in enumerate(gl):
            for i, ch in enumerate(r):
                if ch == 'X': s.add((x0+i+dx, j+dy))
    return s
def plate(g, x0, y0, x1, y1, fill, rim, rimd):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1): g.px(x, y, fill)
    g.hl(x0+1, y0, x1-x0-1, rim); g.hl(x0+1, y1, x1-x0-1, rimd); g.vl(x0, y0+1, y1-y0-1, rim); g.vl(x1, y0+1, y1-y0-1, rimd)
def A():
    g = Grid(48, 16); plate(g, 0, 1, 47, 14, C('lacq', 1), C('neonc', 4), C('neonc', 2))
    P = cells()
    for (x, y) in P:
        c = C('neon', 4) if ((x, y-1) not in P or (x-1, y) not in P) else C('neon', 3)
        if (x+1, y) not in P or (x, y+1) not in P: c = C('neon', 2)
        g.px(x, y, c)
    g.hl(2, 15, 44, '%')
    return g, '강남 조각 결로 어두운 옻 바탕에 청록 네온 테(오른쪽·아래 한 단 어둡게)와 분홍 글자, 글자 위·왼쪽 밝게 오른쪽·아래 어둡게, 아래에 빛 번짐 한 줄. 「카라오케」는 네 자다(일 설명의 다섯 자는 오기로 보고 넷으로 그림)'
def B():
    g = Grid(48, 16); plate(g, 0, 1, 47, 14, C('lacq', 0), C('neonc', 5), C('neonc', 3))
    P = cells()
    for (x, y) in P:  # 글자 둘레 번짐: 판 위에 밝은 어두움
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x+dx, y+dy)
            if q not in P and 2 <= q[0] <= 45 and 2 <= q[1] <= 13: g.px(q[0], q[1], C('lacq', 2))
    for (x, y) in P:
        core = all((x+dx, y+dy) in P for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        c = C('neon', 5) if core else C('neon', 4)
        if (x, y-1) not in P or (x-1, y) not in P: c = C('neon', 5)
        elif (x+1, y) not in P or (x, y+1) not in P: c = C('neon', 3)
        g.px(x, y, c)
    g.hl(1, 15, 46, '%'); g.hl(4, 0, 40, '%')
    return g, '판을 아주 어둡게(0단) 누르고 글자 안쪽은 가장 밝은 분홍(5단)·가장자리는 4단, 글자 둘레에 판보다 밝은 번짐 픽셀, 위·아래 두 줄 빛 번짐으로 네온이 빛나는 대비를 키움'
def Cc():
    g = Grid(48, 16)
    # 알약 모양 분홍 판에 어두운 글자(음각)
    for y in range(1, 15):
        for x in range(0, 48):
            if (y in (1, 14)) and (x < 2 or x > 45): continue
            if (y in (2, 13)) and (x < 1 or x > 46): continue
            g.px(x, y, C('neon', 3))
    g.hl(2, 1, 44, C('neon', 4)); g.hl(1, 2, 46, C('neon', 4)); g.vl(0, 3, 10, C('neon', 4))
    g.hl(2, 14, 44, C('neon', 1)); g.hl(1, 13, 46, C('neon', 2)); g.vl(47, 3, 10, C('neon', 2))
    for x in range(3, 45): g.px(x, 3, C('neonc', 4)) if False else None
    P = cells()
    for (x, y) in P:
        g.px(x, y, C('lacq', 1))
    for (x, y) in P:
        if (x-1, y) not in P and (x, y+1) not in P: pass
    g.hl(2, 15, 44, '~')
    return g, '같은 3칸 폭에서 알약 모양 분홍 판에 어두운 옻색 글자를 파낸 음각 간판으로 실루엣을 바꿈. 밝은 위·왼쪽 테, 어두운 오른쪽·아래 테'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')

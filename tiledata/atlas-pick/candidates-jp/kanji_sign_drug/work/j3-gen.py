import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import *
SL = 'kanji_sign_drug'
YAKU = ["..XX....XX..", "XXXXXXXXXXXX", "..XXXXXXXX..", ".XX.XXXX.XX.", "..X.X..X.X..", ".XX.XXXX.XX.", ".XXXXXXXXXX.", ".X...XX...X.", ".XXXXXXXXXX.", "....XXXX....", ".XXX.XX.XXX.", "XX...XX...XX"]
def stamp(g, x0, y0, rows, cf, chi, clo):
    P = {(x0+i, y0+j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == 'X'}
    for (x, y) in P:
        c = cf
        if (x, y-1) not in P or (x-1, y) not in P: c = chi
        elif (x+1, y) not in P or (x, y+1) not in P: c = clo
        g.px(x, y, c)
    return P
def cross(g, x, y, cg, chi, clo):
    for j in range(7):
        for i in range(7):
            if (2 <= i <= 4) or (2 <= j <= 4): g.px(x+i, y+j, cg)
    g.hl(x+2, y, 3, chi); g.vl(x, y+2, 3, chi) if False else None; g.vl(x+2, y, 2, chi); g.hl(x, y+2, 2, chi)
    g.hl(x+5, y+4, 2, clo); g.vl(x+4, y+5, 2, clo)
def A():
    g = Grid(16, 32)
    for y in range(1, 30):
        for x in range(1, 15): g.px(x, y, C('taxi', 3))
    g.hl(1, 1, 14, C('taxi', 4)); g.vl(1, 1, 29, C('taxi', 4)); g.hl(1, 29, 14, C('taxi', 1)); g.vl(14, 1, 29, C('taxi', 1))
    stamp(g, 2, 4, YAKU, C('lacq', 1), C('lacq', 2), C('lacq', 0))
    cross(g, 4, 20, C('kgreen', 3), C('kgreen', 4), C('kgreen', 2))
    outline(g, C('taxi', 0), C('taxi', 0), only={'taxi'})
    g.px(0, 0, None)
    g.vl(15, 3, 27, '~'); g.hl(2, 31, 14, '-')
    return g, '강남 조각 결로 노랑 판(왼쪽·위 밝은 테, 오른쪽·아래 어두운 테) 위에 옻색 「薬」 12x12(1~2px 획)와 아래 초록 십자 표시, 오른쪽·아래에 얇은 그림자'
def B():
    g = Grid(16, 32)
    for y in range(1, 30):
        for x in range(1, 13): g.px(x, y, C('taxi', 4))
    for y in range(2, 30):
        for x in range(13, 15): g.px(x, y, C('taxi', 1))  # 판 두께가 보이는 어두운 옆면
    g.hl(1, 1, 12, C('taxi', 5)); g.hl(2, 1, 12, C('taxi', 5)); g.vl(1, 1, 29, C('taxi', 5)); g.hl(1, 29, 14, C('taxi', 0))
    g.hl(13, 1, 2, C('taxi', 2)); g.px(14, 1, C('taxi', 2))
    stamp(g, 1, 4, YAKU, C('lacq', 0), C('lacq', 1), C('lacq', 0))
    cross(g, 3, 20, C('kgreen', 3), C('kgreen', 5), C('kgreen', 1))
    outline(g, C('taxi', 0), C('taxi', 0), only={'taxi'})
    g.vl(15, 3, 27, '~'); g.hl(2, 31, 14, '~')
    g.hl(3, 0, 10, '%')
    return g, '판 앞면은 밝은 4~5단, 오른쪽 옆면(두께 2px)은 1단까지 눌러 어둡게 해 상자 간판의 입체를 크게 벌리고, 짙은 글자와 위쪽 빛 번짐 한 줄'
def Cc():
    g = Grid(16, 32)
    # 위가 뾰족한 세로 깃발형 판
    for y in range(2, 31):
        k = max(0, 5 - (y - 2)) if y < 8 else 0
        for x in range(2 + k, 14 - k): g.px(x, y, C('taxi', 3))
    for y in range(2, 31):
        row = [x for x in range(16) if isinstance(g.get(x, y), tuple)]
        if row: g.px(row[0], y, C('taxi', 4)); g.px(row[-1], y, C('taxi', 1))
    g.hl(2, 30, 12, C('taxi', 1))
    stamp(g, 2, 9, YAKU, C('lacq', 1), C('lacq', 2), C('lacq', 0))
    for x in range(4, 12): g.px(x, 24, C('kgreen', 3)); g.px(x, 25, C('kgreen', 2))
    outline(g, C('taxi', 0), C('taxi', 0), only={'taxi'})
    g.vl(14, 12, 18, '~'); g.hl(4, 31, 10, '-')
    return g, '위가 뾰족한 깃발형 세로 판으로 실루엣을 바꾸고 글자를 판 가운데로 내려 놓고 아래에 초록 띠 한 줄'
for k, f in zip('ABC', (A, B, Cc)):
    g, n = f(); g.emit(os.path.join(HERE, '..', f'j3-{k}.pxg'), n, header=f'{SL} j3-{k}')

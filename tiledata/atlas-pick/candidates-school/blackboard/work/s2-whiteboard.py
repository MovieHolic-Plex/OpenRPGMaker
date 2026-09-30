import sys; sys.path.insert(0, '.')
from s2lib import *
exec(open('s2-boards.py').read().split("# ---------------- 칠판")[0].split("import sys; sys.path.insert(0, '.')\nfrom s2lib import *")[1])

def scribble(c, x, y, n, ch, gap=5):
    for i in range(n):
        if i % gap != gap - 1: c.put(x + i, y, ch)

def whiteboard(tag):
    W, H = 48, 32
    c = C(W, H)
    if tag == 'A':
        L = {'h': ('tray', 5), 'm': ('tray', 4), 'l': ('tray', 2), 'd': ('tray', 1),
             'k': ('wboard', 4), 'K': ('wboard', 3), 'q': ('wboard', 3), 'n': ('vblack', 3), 'a': ('vblue', 4), 'r': ('vred', 4),
             'g': ('vgreen', 4), 'p': ('vred', 3), 'w': ('vwhite', 6), 'f': ('vlinen', 4), 'b': ('vblack', 2),
             't': ('tray', 4), 'u': ('tray', 3), 'v': ('tray', 1)}
        x0, y0, x1, y1 = 1, 1, W - 2, 24
        frame(c, x0, y0, x1, y1, 'h', 'm', 'l', 'd')
        c.rect(x0 + 2, y0 + 2, x1 - x0 - 3, y1 - y0 - 3, 'k')
        c.hl(x0 + 2, y0 + 2, x1 - x0 - 3, 'K'); c.vl(x1 - 2, y0 + 2, y1 - y0 - 3, 'K')
        scribble(c, 6, 6, 14, 'n'); scribble(c, 6, 8, 10, 'n'); scribble(c, 6, 10, 12, 'a')
        scribble(c, 24, 6, 12, 'a'); scribble(c, 24, 8, 8, 'a')
        c.hl(24, 14, 14, 'r'); c.vl(24, 14, 6, 'r') if False else None
        c.hl(8, 16, 9, 'n'); c.hl(8, 18, 6, 'n')
        # 자석
        c.rect(37, 16, 3, 3, 'p'); c.put(37, 16, 'w'); c.put(39, 18, 'r') if False else None
        # 받침 + 펜 셋
        c.hl(x0 + 1, 25, x1 - x0 - 1, 't'); c.hl(x0 + 1, 26, x1 - x0 - 1, 't')
        c.hl(x0 + 1, 27, x1 - x0 - 1, 'u'); c.hl(x0, 28, x1 - x0 + 1, 'v'); c.put(x0 + 1, 25, 'h')
        c.hl(8, 25, 4, 'b'); c.hl(14, 25, 4, 'r'); c.hl(20, 25, 4, 'a')
        c.hl(8, 26, 4, 'f'); c.hl(14, 26, 4, 'f'); c.hl(20, 26, 4, 'f')
        c.hl(x0 + 2, 29, x1 - x0 - 2, '-')
    if tag == 'B':
        L = {'h': ('tray', 5), 'e': ('tray', 4), 'm': ('tray', 3), 'l': ('tray', 2), 'd': ('tray', 0), 'H': ('tray', 5),
             'k': ('wboard', 4), 'K': ('wboard', 2), 'J': ('wboard', 3), 'n': ('vblack', 3), 'a': ('vblue', 4), 'r': ('vred', 4),
             'p': ('vred', 3), 'w': ('vwhite', 6), 'f': ('vlinen', 5), 'b': ('vblack', 2)}
        x0, y0, x1, y1 = 1, 1, W - 3, 23
        frame(c, x0, y0, x1, y1, 'h', 'e', 'l', 'd')
        c.rect(x0 + 2, y0 + 2, x1 - x0 - 3, y1 - y0 - 3, 'k')
        c.hl(x0 + 2, y0 + 2, x1 - x0 - 3, 'K'); c.hl(x0 + 2, y0 + 3, x1 - x0 - 3, 'J')
        c.vl(x0 + 2, y0 + 2, y1 - y0 - 3, 'K'); c.vl(x0 + 3, y0 + 3, y1 - y0 - 5, 'J')
        scribble(c, 7, 7, 14, 'n'); scribble(c, 7, 9, 10, 'n'); scribble(c, 7, 11, 12, 'a')
        scribble(c, 24, 7, 12, 'a'); scribble(c, 24, 9, 8, 'a')
        c.hl(24, 15, 13, 'r'); c.hl(8, 17, 9, 'n'); c.hl(8, 19, 6, 'n')
        c.rect(36, 16, 3, 3, 'p'); c.put(36, 16, 'w')
        c.hl(x0 + 1, 24, x1 - x0 - 1, 'H'); c.hl(x0 + 1, 25, x1 - x0 - 1, 'e')
        c.hl(x0 + 1, 26, x1 - x0 - 1, 'm'); c.hl(x0, 27, x1 - x0 + 1, 'l'); c.hl(x0 + 1, 28, x1 - x0 - 1, 'd')
        c.hl(8, 24, 4, 'b'); c.hl(14, 24, 4, 'r'); c.hl(20, 24, 4, 'a')
        c.hl(8, 25, 4, 'f'); c.hl(14, 25, 4, 'f'); c.hl(20, 25, 4, 'f')
        c.hl(x0 + 3, 29, x1 - x0 - 1, '~'); c.hl(x0 + 4, 30, x1 - x0 - 3, '-')
        c.vl(x1 + 1, y0 + 2, 26, '~'); c.vl(x1 + 2, y0 + 3, 27, '-')
    if tag == 'C':
        L = {'h': ('hinoki', 6), 'e': ('hinoki', 5), 'm': ('hinoki', 4), 'l': ('hinoki', 3), 'd': ('hinoki', 1), 'g': ('hinoki', 2),
             'k': ('wboard', 4), 'K': ('wboard', 3), 'n': ('vblack', 3), 'a': ('vblue', 4), 'r': ('vred', 4),
             'p': ('vred', 3), 'w': ('vwhite', 6), 'f': ('vlinen', 4), 'b': ('vblack', 2), 'i': ('viron', 4),
             'y': ('washi', 4), 'z': ('washi', 3), 's': ('vblack', 4)}
        c.hl(0, 0, W, 'e'); c.hl(0, 1, W, 'm'); c.hl(0, 2, W, 'g'); c.hl(0, 3, W, '~')
        xa, xb, ya, yb = 1, 46, 4, 25
        frame(c, xa, ya, xb, yb, 'h', 'e', 'm', 'g')
        c.rect(xa + 2, ya + 2, xb - xa - 3, yb - ya - 3, 'k')
        c.hl(xa + 2, ya + 2, xb - xa - 3, 'K')
        # 붙인 시간표 종이 (실루엣에 튀어나온 덩이)
        c.rect(30, 9, 11, 9, 'y'); c.hl(30, 9, 11, 'z') if False else None
        c.vl(40, 9, 9, 'z'); c.hl(30, 17, 11, 'z')
        scribble(c, 32, 11, 7, 's'); scribble(c, 32, 13, 7, 's'); scribble(c, 32, 15, 5, 's')
        c.rect(34, 8, 3, 2, 'p'); c.put(34, 8, 'w')
        scribble(c, 5, 8, 14, 'n'); scribble(c, 5, 10, 10, 'n'); scribble(c, 5, 12, 12, 'a')
        c.hl(6, 17, 10, 'r'); c.hl(8, 19, 8, 'n')
        c.hl(1, 26, 44, 'e'); c.hl(1, 27, 44, 'm'); c.hl(0, 28, 46, 'l'); c.hl(0, 29, 46, 'd')
        c.hl(5, 26, 4, 'b'); c.hl(11, 26, 4, 'r'); c.hl(17, 26, 4, 'a')
        c.vl(46, 8, 10, '~') if False else None
    return c, L

NOTES = {'A': '알루미늄 틀·받침 위치는 칠판 A 와 같다. 흰판 위 검정·파랑·빨강 마커 줄, 자석 하나, 받침에 펜 셋',
         'B': '칠판 B 와 같은 3단 틀·안쪽 그늘·벽 그림자. 받침 윗면을 밝게, 펜은 받침 위에 또렷이',
         'C': '칠판 C 와 같은 나무 틀·위 레일·굵은 받침, 판에 시간표 종이를 붙여 실루엣에 튀어나온 덩이를 만든다'}
if __name__ == '__main__':
    ps = []
    for t in 'ABC':
        c, L = whiteboard(t)
        ps.append(save('whiteboard', t, c, L, NOTES[t]))
    check(ps)

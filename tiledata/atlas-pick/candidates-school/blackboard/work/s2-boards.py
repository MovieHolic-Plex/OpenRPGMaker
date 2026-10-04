import sys; sys.path.insert(0, '.')
from s2lib import *

D1 = ["XXX".replace('X','X')]  # placeholder
G = {'1': [".X.", "XX.", ".X.", ".X.", "XXX"],
     '2': ["XXX", "..X", "XXX", "X..", "XXX"],
     '3': ["XXX", "..X", ".XX", "..X", "XXX"]}
def digits(c, x, y, s, ch):
    for k, d in enumerate(s):
        for j, r in enumerate(G[d]):
            for i, v in enumerate(r):
                if v == 'X': c.put(x + k * 5 + i, y + j, ch)

def frame(c, x0, y0, x1, y1, hi, mid, lo, dk, fr_thick=2):
    # 2px frame: top/left light, bottom/right dark
    c.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, mid)
    c.hl(x0, y0, x1 - x0 + 1, hi); c.vl(x0, y0, y1 - y0 + 1, hi)
    c.hl(x0 + 1, y0 + 1, x1 - x0 - 1, mid) if False else None
    c.hl(x0, y1, x1 - x0 + 1, dk); c.vl(x1, y0, y1 - y0 + 1, dk)
    c.hl(x0 + 1, y1 - 1, x1 - x0 - 1, lo); c.vl(x1 - 1, y0 + 1, y1 - y0 - 1, lo)

# ---------------- 칠판 ----------------
def blackboard(tag):
    W, H = 64, 32
    c = C(W, H)
    if tag == 'A':
        L = {'h': ('tray', 5), 'm': ('tray', 4), 'l': ('tray', 2), 'd': ('tray', 1),
             'k': ('kokuban', 3), 'K': ('kokuban', 2), 'q': ('kokuban', 4), 'c': ('kokuban', 5),
             'w': ('vwhite', 5), 'y': ('vyellow', 5), 'r': ('vred', 4), 'b': ('vblack', 2), 'f': ('vlinen', 4),
             't': ('tray', 4), 'u': ('tray', 3), 'v': ('tray', 1)}
        x0, y0, x1, y1 = 1, 1, W - 2, 24
        frame(c, x0, y0, x1, y1, 'h', 'm', 'l', 'd')
        c.rect(x0 + 2, y0 + 2, x1 - x0 - 3, y1 - y0 - 3, 'k')
        c.hl(x0 + 2, y0 + 2, x1 - x0 - 3, 'K'); c.vl(x1 - 2, y0 + 2, y1 - y0 - 3, 'K')  # 틀 그늘
        # 지운 자국
        c.hl(20, 15, 14, 'q'); c.hl(24, 16, 10, 'q'); c.hl(42, 11, 9, 'q'); c.hl(44, 12, 6, 'q')
        digits(c, 6, 6, '123', 'w')
        for (x, y, n) in ((6, 14, 12), (6, 16, 8), (6, 18, 10)):
            for i in range(n):
                if i % 4 != 3: c.put(x + i, y, 'c')
        for (x, y, n) in ((34, 6, 14), (34, 8, 10), (34, 10, 12)):
            for i in range(n):
                if i % 5 != 4: c.put(x + i, y, 'c')
        c.hl(44, 19, 12, 'c')
        # 받침
        c.hl(x0 + 1, 25, x1 - x0 - 1, 't'); c.hl(x0 + 1, 26, x1 - x0 - 1, 't')
        c.hl(x0 + 1, 27, x1 - x0 - 1, 'u'); c.hl(x0, 28, x1 - x0 + 1, 'v'); c.hl(x0 + 1, 25, 1, 'h')
        c.hl(6, 25, 5, 'w'); c.hl(6, 26, 5, 'f'); c.hl(13, 25, 3, 'y'); c.hl(13, 26, 3, 'f')
        c.hl(46, 24, 9, 'b'); c.hl(46, 25, 9, 'b'); c.hl(46, 26, 9, 'b'); c.hl(46, 24, 9, 'f')
        c.hl(46, 25, 9, 'r') if False else None
        c.hl(x0 + 2, 29, x1 - x0 - 2, '-')
    if tag == 'B':
        L = {'h': ('tray', 5), 'e': ('tray', 4), 'm': ('tray', 3), 'l': ('tray', 2), 'd': ('tray', 0), 'g': ('tray', 1),
             'k': ('kokuban', 3), 'K': ('kokuban', 1), 'J': ('kokuban', 2), 'q': ('kokuban', 4), 'c': ('kokuban', 5),
             'w': ('vwhite', 6), 'y': ('vyellow', 5), 'r': ('vred', 4), 'b': ('vblack', 2), 'f': ('vlinen', 5),
             'H': ('tray', 5), 't': ('tray', 5), 'u': ('tray', 3), 'v': ('tray', 0), 'z': ('tray', 2)}
        x0, y0, x1, y1 = 1, 1, W - 3, 23
        frame(c, x0, y0, x1, y1, 'h', 'e', 'l', 'd')
        c.hl(x0, y0 + 1, x1 - x0 + 1, 'H') if False else None
        c.rect(x0 + 2, y0 + 2, x1 - x0 - 3, y1 - y0 - 3, 'k')
        # 안쪽 그늘: 위·왼쪽 틀 밑으로 두 줄 어둡게
        c.hl(x0 + 2, y0 + 2, x1 - x0 - 3, 'K'); c.hl(x0 + 2, y0 + 3, x1 - x0 - 3, 'J')
        c.vl(x0 + 2, y0 + 2, y1 - y0 - 3, 'K'); c.vl(x0 + 3, y0 + 3, y1 - y0 - 5, 'J')
        # 빛 받는 오른쪽 아래 넓은 밝은 면(창 쪽 빛)
        c.rect(30, 12, 26, 8, 'q') if False else None
        for j in range(12, 20):
            c.hl(28 + (j - 12) // 2, j, 25 - (j - 12) // 2, 'q') if False else None
        c.hl(20, 16, 14, 'q'); c.hl(24, 17, 10, 'q'); c.hl(42, 12, 9, 'q'); c.hl(44, 13, 6, 'q')
        digits(c, 7, 7, '123', 'w')
        for (x, y, n) in ((7, 15, 12), (7, 17, 8)):
            for i in range(n):
                if i % 4 != 3: c.put(x + i, y, 'c')
        for (x, y, n) in ((34, 7, 14), (34, 9, 10), (34, 11, 12)):
            for i in range(n):
                if i % 5 != 4: c.put(x + i, y, 'c')
        # 받침(윗면 2줄 밝게, 앞면, 밑 어두움)
        c.hl(x0, 24, x1 - x0 + 1, 'd') if False else None
        c.hl(x0 + 1, 24, x1 - x0 - 1, 'H'); c.hl(x0 + 1, 25, x1 - x0 - 1, 'e')
        c.hl(x0 + 1, 26, x1 - x0 - 1, 'm'); c.hl(x0, 27, x1 - x0 + 1, 'l'); c.hl(x0 + 1, 28, x1 - x0 - 1, 'd')
        c.hl(6, 24, 5, 'w'); c.hl(6, 25, 5, 'f'); c.put(11, 25, 'l') if False else None
        c.hl(13, 24, 3, 'y'); c.hl(13, 25, 3, 'f')
        c.hl(46, 23, 9, 'f'); c.hl(46, 24, 9, 'b'); c.hl(46, 25, 9, 'b')
        # 벽에 지는 그림자: 받침 밑과 틀 오른쪽
        c.hl(x0 + 3, 29, x1 - x0 - 1, '~'); c.hl(x0 + 4, 30, x1 - x0 - 3, '-')
        c.vl(x1 + 1, y0 + 2, 26, '~'); c.vl(x1 + 2, y0 + 3, 27, '-')
    if tag == 'C':
        # 밀어 여는 두 짝 칠판: 나무 틀, 가운데 문지방, 위 걸이 레일, 큰 받침
        L = {'h': ('hinoki', 6), 'e': ('hinoki', 5), 'm': ('hinoki', 4), 'l': ('hinoki', 3), 'd': ('hinoki', 1), 'g': ('hinoki', 2),
             'k': ('kokuban', 3), 'K': ('kokuban', 2), 'q': ('kokuban', 4), 'c': ('kokuban', 5),
             'w': ('vwhite', 5), 'y': ('vyellow', 5), 'r': ('vred', 4), 'b': ('vblack', 2), 'f': ('vlinen', 4),
             'i': ('viron', 4), 'j': ('viron', 2)}
        # 위 레일
        c.hl(0, 0, W, 'e'); c.hl(0, 1, W, 'm'); c.hl(0, 2, W, 'g'); c.hl(0, 3, W, '~')
        # 두 짝: 왼쪽 y 4..24, 오른쪽 y 6..26 (어긋난)
        for (xa, xb, ya, yb) in ((1, 31, 4, 24), (32, 62, 6, 26)):
            frame(c, xa, ya, xb, yb, 'h', 'e', 'm', 'g')
            c.rect(xa + 2, ya + 2, xb - xa - 3, yb - ya - 3, 'k')
            c.hl(xa + 2, ya + 2, xb - xa - 3, 'K')
        digits(c, 5, 9, '123', 'w')
        for (x, y, n) in ((5, 17, 12), (5, 19, 8)):
            for i in range(n):
                if i % 4 != 3: c.put(x + i, y, 'c')
        for (x, y, n) in ((36, 12, 14), (36, 14, 10), (36, 16, 12)):
            for i in range(n):
                if i % 5 != 4: c.put(x + i, y, 'c')
        c.hl(40, 20, 9, 'q'); c.hl(42, 21, 6, 'q'); c.hl(12, 20, 8, 'q')
        # 손잡이 쇠
        c.vl(30, 12, 4, 'i'); c.vl(33, 15, 4, 'i')
        # 받침(굵은 나무 턱)
        c.hl(1, 27, 62, 'e'); c.hl(1, 28, 62, 'm'); c.hl(0, 29, 64, 'l'); c.hl(0, 30, 64, 'd')
        c.hl(6, 27, 5, 'w'); c.hl(13, 27, 3, 'y'); c.hl(50, 26, 9, 'b') if False else None
        c.hl(48, 26, 9, 'b') if False else None
        c.hl(3, 25, 0, 'w') if False else None
    return c, L

NOTES = {'A': '알루미늄 틀 2px(위·왼 밝게, 아래·오른 어둡게) + 잔잔한 판 두 단 + 흐린 분필 줄·숫자 123 + 분필·지우개 얹은 받침 (v5 결)',
         'B': '틀 3단 모따기·판 위/왼 안쪽 그늘 두 줄·받침 윗면 밝고 앞면 어둡게 + 벽에 지는 그림자(~ -) 로 떠 보이는 입체',
         'C': '밀어 여는 두 짝 칠판: 나무 틀(hinoki)·위 레일·오른 짝이 낮게 어긋남·굵은 받침 — 실루엣이 두 덩이로 읽힌다'}

if __name__ == '__main__':
    ps = []
    for t in 'ABC':
        c, L = blackboard(t)
        ps.append(save('blackboard', t, c, L, NOTES[t]))
    check(ps)

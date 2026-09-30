import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
P, G = 'mpurple', 'mgran'

def win(c, x, y, ramp='mred', st=4, h=2):
    for i in range(h): c.put(x, y + i, ramp, st)

def A():
    c = Cv('dark_castle', 32, 32)
    wall = c.body(3, 28, 22, 30, P, hi=3, lo=1, cyl=False)
    c.crenel(3, 28, 22, P, hi=3, period=3, mw=2, h=2)
    c.texture(wall, 3, 2, dark=1)
    # 곁탑 둘 + 중앙 탑
    for (a, b, top, tip) in ((1, 7, 14, 6), (24, 30, 14, 6), (12, 19, 9, 0)):
        t = c.body(a, b, top, 30, P, hi=4, lo=1)
        c.texture(t, 4, a, dark=1)
        mid = (a + b) // 2
        c.cone(mid, tip, top - 1, (b - a) // 2 + 1, G, hi=2, lo=0)
        win(c, mid, top + 4)
    # 안쪽 작은 뾰족탑 둘
    for (a, b) in ((8, 11), (20, 23)):
        t = c.body(a, b, 15, 22, P, hi=4, lo=1)
        mid = (a + b) // 2
        c.cone(mid, 9, 14, 3, G, hi=2, lo=0)
    win(c, 15, 12); win(c, 16, 12)
    c.door(14, 17, 25, 30)
    win(c, 5, 20); win(c, 26, 20)
    return c

def B():
    c = Cv('dark_castle', 32, 32)
    wall = c.body(3, 28, 22, 29, P, hi=4, lo=0, cyl=False)
    c.crenel(3, 28, 22, P, hi=4, period=3, mw=2, h=2)
    c.texture(wall, 3, 2, dark=1)
    for (a, b, top, tip) in ((1, 7, 13, 4), (24, 30, 13, 4), (12, 19, 8, 0)):
        t = c.body(a, b, top, 29, P, hi=5, lo=0)
        c.texture(t, 4, a, dark=1)
        mid = (a + b) // 2
        c.cone(mid, tip, top - 1, (b - a) // 2 + 2, G, hi=2, lo=0)
        c.rect(a - 1 if a > 0 else a, top, b + 1 if b < 31 else b, top, P, 2)
        win(c, mid, top + 4, 'wlava', 4)
    for (a, b) in ((8, 11), (20, 23)):
        c.body(a, b, 15, 22, P, hi=5, lo=0)
        c.cone((a + b) // 2, 8, 14, 3, G, hi=2, lo=0)
        win(c, (a + b) // 2, 17, 'wlava', 3)
    for x in (15, 16):
        win(c, x, 11, 'wlava', 5); win(c, x, 13, 'wlava', 4, 1)
    c.door(14, 17, 24, 29, dark=('mout', 0))
    c.put(15, 27, 'wlava', 3); c.put(16, 27, 'wlava', 3)
    c.shadow(dx=2, dy=2, rows=3)
    return c

def C():
    """뿔 실루엣 — 바깥으로 휘는 뿔 탑 둘과 가운데 가장 높은 창끝."""
    c = Cv('dark_castle', 32, 32)
    wall = c.body(6, 25, 23, 30, P, hi=3, lo=1, cyl=False)
    c.texture(wall, 3, 1)
    # 뿔 탑: 몸통 + 바깥으로 휘는 뿔
    def horn(side):
        if side < 0:
            xs = range(1, 8)
        else:
            xs = range(24, 31)
        a, b = (1, 7) if side < 0 else (24, 30)
        t = c.body(a, b, 15, 30, P, hi=4, lo=1)
        c.texture(t, 4, a)
        rows = {}
        for i, y in enumerate(range(14, 2, -1)):
            wdt = max(1, 3 - i // 3)
            shift = (i // 3) if side < 0 else -(i // 3)
            cx = (a + b) // 2 + shift
            rows[y] = (cx - wdt + 1, cx + wdt - 1)
        c.spans(rows, G, hi=2, lo=0)
        win(c, (a + b) // 2, 19)
    horn(-1); horn(1)
    # 가운데 높은 창끝탑
    t = c.body(12, 19, 12, 30, P, hi=4, lo=1)
    c.texture(t, 4, 3)
    c.cone(15, 0, 11, 6, G, hi=2, lo=0)
    win(c, 15, 16, 'wlava', 4); win(c, 16, 16, 'wlava', 4)
    c.door(13, 18, 25, 30)
    c.crenel(6, 11, 23, P, hi=3, period=3, mw=2, h=2)
    c.crenel(20, 25, 23, P, hi=3, period=3, mw=2, h=2)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 어두운 보랏빛 돌, 뾰족탑 다섯(가운데가 가장 높음), 톱니 성벽, 붉은 창'),
                       ('B', B, '명암 강화 — 왼쪽 밝고 오른쪽 아주 어두운 원통, 처마 띠, 용암빛 창과 성문 불빛, 발치 오른쪽 아래 반투명 그림자'),
                       ('C', C, '다른 해석 — 안쪽으로 굽은 뿔 모양 탑 둘과 가운데 창끝 탑의 세로 실루엣')):
        c = f(); c.emit('wv8-' + n, note)

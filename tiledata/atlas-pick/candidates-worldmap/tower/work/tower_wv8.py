import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
ST, RB, RR = 'wstone', 'wroofb', 'wroofr'

def A():
    """1x2 원통 탑: 톱니 머리 + 층 띠 + 창 점 + 밑 문."""
    c = Cv('tower', 16, 32)
    t = c.body(2, 13, 8, 31, ST)
    c.texture(t, 4, 1)
    c.rect(1, 7, 14, 9, ST, 5); c.rect(14, 7, 14, 9, ST, 1); c.rect(1, 9, 14, 9, ST, 0)
    # 지붕 콘
    c.cone(7, 0, 6, 6, RB, hi=3, lo=1)
    for y in (16, 23):
        c.rect(3, y, 12, y, ST, 1)
    for (x, y) in ((6, 13), (9, 13), (7, 19), (7, 26)):
        c.put(x, y, 'mout', 0); c.put(x, y + 1, 'mout', 0)
    c.door(5, 9, 26, 31)
    return c

def B():
    c = Cv('tower', 16, 32)
    t = c.body(3, 12, 10, 30, ST, hi=5, lo=1)
    c.texture(t, 4, 2, dark=1)
    c.cone(7, 1, 9, 6, RR, hi=3, lo=1)
    c.rect(2, 9, 13, 10, ST, 3); c.rect(2, 10, 13, 10, ST, 1); c.rect(13, 9, 13, 10, ST, 0)
    for y in (17, 24):
        c.rect(3, y, 12, y, ST, 2)
    for (x, y) in ((6, 13), (8, 13)):
        c.put(x, y, 'myellow', 3); c.put(x, y + 1, 'myellow', 2)
    for (x, y) in ((7, 20), (7, 27)):
        c.put(x, y, 'mout', 0); c.put(x, y + 1, 'mout', 0)
    c.door(5, 9, 26, 30) if False else c.door(5, 9, 25, 30)
    c.shadow(dx=2, dy=1, rows=2)
    return c

def C():
    """뾰족 첨탑(뾰족 지붕이 길게) + 발치가 넓은 원뿔형 받침."""
    c = Cv('tower', 16, 32)
    t = c.body(4, 11, 13, 31, ST)
    c.texture(t, 4, 3)
    c.cone(7, 0, 12, 5, 'wgold', hi=3, lo=1)
    c.rect(2, 12, 13, 13, ST, 4); c.rect(13, 12, 13, 13, ST, 1); c.rect(2, 13, 13, 13, ST, 0)
    # 아래 받침
    c.spans({28: (2, 13), 29: (1, 14), 30: (0, 15), 31: (0, 15)}, ST, hi=4, lo=1)
    for (x, y) in ((7, 17), (7, 23)):
        c.put(x, y, 'mout', 0); c.put(x, y + 1, 'mout', 0)
    c.door(6, 9, 25, 31)
    c.shadow(dx=2, dy=1, rows=1)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 1×2 원통 탑, 톱니 머리 위 푸른 뾰족 지붕, 층 띠와 창 점, 밑 문'),
                       ('B', B, '명암 강화 — 붉은 뾰족 지붕, 처마 띠, 창에 노란 불빛, 발치 오른쪽 아래 반투명 그림자'),
                       ('C', C, '다른 해석 — 금빛 긴 첨탑, 발치가 넓은 받침, 가는 실루엣')):
        c = f(); c.emit('wv8-' + n, note)

from wv8_lib import *
ST, RB, RR = 'wstone', 'wroofb', 'wroofr'

def flag(c, x, y, h=4, col=(RR, 3)):
    for i in range(h):
        c.put(x, y + i, ST, 1)
    c.rect(x + 1, y, x + 4, y + 2, col[0], col[1])
    c.put(x + 5, y + 1, col[0], col[1] - 1)
    c.hl = None

def windows(c, xs, y, glow=False):
    for x in xs:
        c.put(x, y, 'mout', 0); c.put(x, y + 1, 'mout', 0)

def A():
    c = Cv('castle', 32, 32)
    # 주탑(뒤) — 파란 뾰족 지붕
    keep = c.body(10, 21, 9, 24, ST)
    c.texture(keep, 4, 1)
    c.cone(15, 3, 10, 7, RB)
    for i in range(0, 3): c.put(15, 0 + i, ST, 1)  # 깃대
    c.rect(16, 0, 19, 1, RR, 3); c.put(20, 0, RR, 2); c.put(16, 2, RR, 1) if False else None
    windows(c, [15, 16], 13)
    # 앞 성벽 + 톱니
    wall = c.body(6, 25, 20, 29, ST, cyl=False)
    c.crenel(6, 25, 20, ST, period=3, mw=2, h=2)
    c.texture(wall, 3, 2)
    # 곁탑 둘 (원통, 톱니)
    for (a, b) in ((0, 8), (23, 31)):
        t = c.body(a, b, 13, 29, ST)
        c.crenel(a, b, 13, ST, period=3, mw=2, h=2)
        c.texture(t, 4, a)
        # 아래 턱(테두리 튀어나옴)
        c.rect(a, 15, b, 15, ST, 2 if a == 0 else 2)
        c.put(a + 3, 19, 'mout', 0); c.put(a + 3, 20, 'mout', 0)
    # 성문
    c.door(13, 18, 23, 29)
    return c


def B():
    """깊은 명암 — 곁탑도 붉은 뾰족 지붕, 왼쪽 밝고 오른쪽 어둡게, 창에 불빛, 발치 그림자."""
    c = Cv('castle', 32, 32)
    keep = c.body(11, 20, 8, 25, ST, hi=5, lo=2)
    c.texture(keep, 4, 1, dark=1)
    c.cone(15, 2, 9, 7, RB, hi=3, lo=1)
    for i in range(0, 3): c.put(15, 0 + i, ST, 1)
    c.rect(16, 0, 19, 1, RR, 3); c.put(20, 0, RR, 2)
    c.put(15, 12, 'myellow', 3); c.put(16, 12, 'myellow', 3); c.put(15, 13, 'myellow', 2); c.put(16, 13, 'myellow', 2)
    wall = c.body(6, 25, 21, 28, ST, cyl=False, hi=4, lo=2)
    c.crenel(6, 25, 21, ST, hi=4, period=3, mw=2, h=2)
    c.texture(wall, 3, 2)
    for (a, b) in ((0, 7), (24, 31)):
        t = c.body(a, b, 15, 28, ST, hi=5, lo=1)
        c.texture(t, 4, a)
        c.cone((a + b) // 2, 8, 14, 5, RR, hi=3, lo=1)
        c.put(a + 3, 19, 'mout', 0); c.put(a + 3, 20, 'mout', 0)
    c.door(13, 18, 23, 28)
    c.rect(12, 22, 12, 28, ST, 1); c.rect(19, 22, 19, 28, ST, 0)
    c.shadow(dx=2, dy=2, rows=3)
    return c

def C():
    """다른 해석 — 가늘고 높은 사탑 네 개가 성벽 위로 솟는 세로 실루엣, 금빛 첨탑 꼭대기."""
    c = Cv('castle', 32, 32)
    wall = c.body(2, 29, 22, 29, ST, cyl=False)
    c.crenel(2, 29, 22, ST, period=4, mw=2, h=2)
    c.texture(wall, 3, 4)
    specs = [(0, 5, 14, RR, 9), (26, 31, 14, RR, 9), (8, 12, 8, RB, 8), (19, 23, 8, RB, 8)]
    for (a, b, top, rf, rh) in specs:
        t = c.body(a, b, top, 29, ST)
        c.texture(t, 4, a)
        mid = (a + b) // 2
        c.cone(mid, top - rh, top - 1, (b - a) // 2 + 1, rf, hi=3, lo=1)
        c.put(mid, top + 3, 'mout', 0); c.put(mid, top + 4, 'mout', 0)
    # 중앙 성문탑 (가장 높음)
    t = c.body(13, 18, 6, 29, ST)
    c.texture(t, 4, 3)
    c.cone(15, 0, 5, 4, 'wgold', hi=3, lo=1)
    c.put(15, 9, 'mout', 0); c.put(16, 9, 'mout', 0)
    c.door(14, 17, 24, 29)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 큰 주탑 위 푸른 뾰족 지붕과 붉은 깃발, 톱니 두른 원통 곁탑 둘, 앞 성벽과 어두운 성문'),
                       ('B', B, '명암 강화 — 곁탑도 붉은 뾰족 지붕, 왼쪽 밝고 오른쪽 어두운 원통, 창 불빛, 발치 오른쪽 아래 반투명 그림자'),
                       ('C', C, '다른 해석 — 가늘고 높은 사탑 넷과 금빛 첨탑 성문탑이 성벽 위로 솟는 세로 실루엣')):
        c = f(); c.emit('wv8-' + n, note)

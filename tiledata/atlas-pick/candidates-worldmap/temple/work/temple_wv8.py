import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
W = 'mwhite'

def steps(c, x0, x1, y0, n=2, hi=4):
    for i in range(n):
        c.body(x0 - i, x1 + i, y0 + i * 2, y0 + i * 2 + 1, W, hi=hi - i, lo=1, cyl=False)

def column(c, x, y0, y1, w=3):
    c.body(x, x + w - 1, y0, y1, W, hi=4, lo=1)

def A():
    """박공 지붕 + 기둥 넷 + 계단."""
    c = Cv('temple', 32, 32)
    # 박공(삼각) 지붕
    rows = {}
    for i, y in enumerate(range(3, 11)):
        hw = 3 + i * 1.7
        rows[y] = (int(16 - hw), int(16 + hw - 1))
    c.spans(rows, W, hi=4, lo=2)
    c.rect(3, 11, 28, 12, W, 4); c.rect(3, 12, 28, 12, W, 1)
    c.rect(28, 11, 28, 12, W, 0)
    # 안쪽 벽(어둠)
    c.rect(6, 13, 25, 24, 'mout', 1)
    # 기둥 넷
    for x in (5, 11, 18, 24):
        column(c, x, 13, 25)
    # 계단
    steps(c, 4, 27, 26, 2)
    c.door(14, 17, 18, 25) if False else None
    return c

def B():
    c = Cv('temple', 32, 32)
    rows = {}
    for i, y in enumerate(range(2, 10)):
        hw = 3 + i * 1.8
        rows[y] = (int(16 - hw), int(16 + hw - 1))
    c.spans(rows, W, hi=4, lo=1)
    c.put(16, 6, 'wgold', 3); c.put(15, 6, 'wgold', 3); c.put(15, 7, 'wgold', 2); c.put(16, 7, 'wgold', 2)
    c.rect(2, 10, 29, 11, W, 5); c.rect(2, 11, 29, 11, W, 2); c.rect(29, 10, 29, 11, W, 0)
    c.rect(5, 12, 26, 24, 'mout', 0)
    for x in (4, 10, 18, 25):
        column(c, x, 12, 25)
        c.rect(x - 1, 12, x + 3, 12, W, 3)
        c.rect(x - 1, 25, x + 3, 25, W, 2)
    steps(c, 3, 28, 26, 2, hi=5)
    c.put(15, 20, 'myellow', 3); c.put(16, 20, 'myellow', 3); c.put(15, 21, 'myellow', 2); c.put(16, 21, 'myellow', 2)
    c.shadow(dx=2, dy=2, rows=2)
    return c

def C():
    """다른 해석 — 둥근 돔 신전: 반구 지붕 + 기둥 넷 + 넓은 계단."""
    c = Cv('temple', 32, 32)
    rows = {}
    import math
    for y in range(3, 13):
        hw = math.sqrt(max(0, 1 - ((12 - y) / 9.5) ** 2)) * 10
        rows[y] = (int(16 - hw), int(16 + hw - 1))
    c.spans(rows, W, hi=4, lo=1)
    c.put(15, 1, 'wgold', 3); c.put(16, 1, 'wgold', 3); c.put(15, 2, 'wgold', 2); c.put(16, 2, 'wgold', 2)
    c.rect(4, 13, 27, 14, W, 4); c.rect(4, 14, 27, 14, W, 1); c.rect(27, 13, 27, 14, W, 0)
    c.rect(7, 15, 24, 24, 'mout', 1)
    c.rect(7, 15, 24, 15, W, 1)
    for x in (5, 11, 18, 24):
        column(c, x, 15, 25, 3)
    steps(c, 4, 27, 26, 2)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 흰 돌 박공 지붕, 기둥 넷, 아래 두 단 계단'),
                       ('B', B, '명암 강화 — 흰 돌 명암을 늘리고 박공에 금빛 표식, 안쪽 성소 불빛, 발치 그림자'),
                       ('C', C, '다른 해석 — 둥근 돔 지붕과 금빛 꼭지의 신전')):
        c = f(); c.emit('wv8-' + n, note)

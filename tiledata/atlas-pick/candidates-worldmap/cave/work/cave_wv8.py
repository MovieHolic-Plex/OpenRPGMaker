import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
R = 'wrock'

def mound(c, rows, hi=4, lo=1):
    c.spans(rows, R, hi=hi, lo=lo)

def A():
    """바위 언덕 + 검은 아치 입구(칸 60%)."""
    c = Cv('cave', 16, 16)
    rows = {2: (5, 10), 3: (3, 12), 4: (2, 13), 5: (1, 14), 6: (0, 15), 7: (0, 15), 8: (0, 15), 9: (0, 15), 10: (0, 15),
            11: (0, 15), 12: (0, 15), 13: (0, 15), 14: (0, 15), 15: (0, 15)}
    mound(c, rows)
    for y in range(6, 16):
        for x in range(3, 13):
            if y >= 8 or (y == 7 and 4 <= x <= 11) or (y == 6 and 5 <= x <= 10):
                c.put(x, y, 'mout', 0)
    c.rect(3, 15, 12, 15, R, 1)  # 문지방
    c.rect(4, 14, 11, 14, 'mout', 0)
    for x in range(3, 13):
        c.put(x, 15, R, 2)
    return c

def B():
    c = Cv('cave', 16, 16)
    rows = {1: (5, 10), 2: (3, 12), 3: (2, 13), 4: (1, 14), 5: (0, 15)}
    for y in range(6, 16): rows[y] = (0, 15)
    mound(c, rows, hi=5, lo=0)
    for y in range(6, 16):
        for x in range(3, 13):
            if y >= 8 or (y == 7 and 4 <= x <= 11) or (y == 6 and 5 <= x <= 10):
                c.put(x, y, 'mout', 0)
    for x in range(2, 14):
        c.put(x, 5, R, 6) if x < 8 else None
    # 입구 안쪽 어렴풋한 붉은 눈
    c.put(6, 12, 'wlava', 4); c.put(9, 12, 'wlava', 4)
    for x in range(3, 13): c.put(x, 15, R, 3)
    c.shadow(dx=2, dy=1, rows=1)
    return c

def C():
    """다른 해석 — 입 벌린 세로 틈 동굴: 뾰족 바위 두 개 사이 좁고 높은 틈."""
    c = Cv('cave', 16, 16)
    rows = {0: (7, 8), 1: (6, 9), 2: (5, 10), 3: (4, 11), 4: (3, 12), 5: (2, 13), 6: (1, 14)}
    for y in range(7, 16): rows[y] = (0, 15)
    mound(c, rows)
    for y in range(4, 16):
        w = min(3, (y - 3) // 2 + 1)
        for x in range(8 - w - 1, 8 + w + 1):
            c.put(x, y, 'mout', 0)
    for y in range(9, 16):
        for x in range(2, 14):
            c.put(x, y, 'mout', 0) if abs(x - 7.5) <= 4.5 else None
    for x in range(2, 14): c.put(x, 15, R, 2)
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 바위 언덕에 칸의 60% 넘는 검은 아치 입구'),
                       ('B', B, '명암 강화 — 언덕 윗면 하이라이트, 입구 안 붉은 눈빛 두 점, 오른쪽 아래 그림자'),
                       ('C', C, '다른 해석 — 뾰족 바위 사이 위로 좁아지는 높은 틈 입구')):
        c = f(); c.emit('wv8-' + n, note)

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'castle', 'work'))
from wv8_lib import *
ST = 'wstone'

def stub(c, x0, x1, ytop_l, ytop_r, ybot=15, hi=5, lo=3):
    """윗면이 비스듬히 부서진 벽 토막."""
    pts = set()
    for x in range(x0, x1 + 1):
        t = round(ytop_l + (ytop_r - ytop_l) * (x - x0) / max(1, x1 - x0))
        for y in range(t, ybot + 1):
            pts.add((x, y))
    def sh(x, y):
        v = hi if x < (x0 + x1) / 2 else lo
        return v + (1 if (y - min(p[1] for p in pts if p[0] == x)) < 1 else 0)
    c.shape(pts, ST, sh)
    c.texture(pts, 3, x0)
    return pts

def rubble(c, cells):
    for (x, y, s) in cells:
        c.put(x, y, ST, s)
        c.put(x + 1, y, ST, max(0, s - 2))

def A():
    c = Cv('ruins', 32, 16)
    stub(c, 1, 6, 6, 9)
    stub(c, 11, 18, 3, 7)  # 가운데 높은 조각
    c.put(14, 3, ST, 5)
    stub(c, 24, 30, 8, 5)
    # 문틀이 남은 곳: 가운데 조각 밑 어두운 틈
    c.rect(14, 12, 15, 15, 'mout', 0)
    rubble(c, [(7, 14, 4), (9, 15, 3), (19, 14, 4), (21, 15, 3), (22, 13, 2), (5, 15, 3)])
    return c

def B():
    c = Cv('ruins', 32, 16)
    stub(c, 0, 5, 5, 8, hi=6, lo=3)
    stub(c, 10, 18, 2, 6, hi=6, lo=3)
    stub(c, 25, 31, 9, 4, hi=6, lo=3)
    c.rect(13, 10, 15, 15, 'mout', 0)
    for (x, y) in ((12, 5), (16, 3)):
        c.put(x, y, 'wgrass', 3)  # 덩굴 자락
    for x, y in ((3, 6), (26, 8), (20, 9)):
        c.put(x, y, 'wgrass', 2); c.put(x + 1, y, 'wgrass', 3)
    rubble(c, [(6, 14, 4), (8, 15, 3), (19, 13, 4), (21, 15, 3), (23, 14, 2), (22, 15, 4)])
    c.shadow(dx=2, dy=1, rows=1)
    return c

def C():
    """다른 해석 — 아치가 남은 돌문 폐허(가운데 아치 + 양옆 무너진 기둥)."""
    c = Cv('ruins', 32, 16)
    # 아치: 두 기둥 + 위 반쪽 상인방
    stub(c, 5, 9, 4, 6)
    stub(c, 22, 26, 3, 10)
    pts = {(x, y) for x in range(5, 19) for y in (2, 3)}
    c.shape(pts, ST, lambda x, y: 5 if x < 12 else 3)
    c.rect(11, 4, 14, 4, 'mout', 1) if False else None
    c.rect(10, 6, 21, 15, 'mout', 0) if False else None
    stub(c, 15, 18, 5, 9)
    c.rect(10, 6, 14, 15, 'mout', 0)
    for (x, y) in ((10, 5), (14, 5)):
        c.put(x, y, 'mout', 0)
    rubble(c, [(1, 14, 4), (3, 15, 3), (19, 14, 3), (27, 14, 4), (29, 15, 3), (21, 15, 4)])
    return c

if __name__ == '__main__':
    for n, f, note in (('A', A, 'World.png 구조를 우리 팔레트로 — 윗면이 비스듬히 부서진 성벽 토막 셋과 돌무더기'),
                       ('B', B, '명암 강화 — 돌 명암 단을 늘리고 이끼 덩굴, 발치 오른쪽 아래 그림자'),
                       ('C', C, '다른 해석 — 상인방이 반쯤 남은 돌문 아치와 무너진 기둥')):
        c = f(); c.emit('wv8-' + n, note)

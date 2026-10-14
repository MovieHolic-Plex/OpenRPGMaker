#!/usr/bin/env python3
"""steampunk_city 배관 도랑 — 땅에 판 돌 도랑 속을 굵은 구리관 + 가는 무쇠관이 지나간다(위에서 내려다본 바닥 조각, 오토타일처럼 잇는다).

연결 방향 집합(NESW)마다 한 칸. 도랑 둘레는 석탄재 마당 + 밝은 돌 갓, 북쪽 안벽은 남쪽을 보고 있어 보인다(어둡게).
사람은 도랑을 못 건넌다 — 길과 만나는 칸은 무쇠 덮개(pipe-grate-ew/ns, 지나갈 수 있다)로 덮는다.
밸브·이음통처럼 땅 위로 솟은 것은 별도 소품(pipe-valve-stand, pipe-junction)이다.

  python3 pipes.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, tex_cluster, box3, disc, rivets
from kit import Reg, contact, OUT

R = Reg('pipes')
LO, HI = 4, 12          # 도랑 안쪽 범위(가로 도랑 y / 세로 도랑 x)


def ground(c):
    def f(wx, wy, i, j):
        m, t = tex_cluster(i, j, 'cinder', 3, s=4, scale=3, amt=0.22)
        r = rnd(i, j, 17)
        if r < 0.025: return ('coal', 1)
        return (m, t)
    c.F(0, 0, 16, 16, f)


def mask_of(conn):
    m = [[False] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            inc = LO <= x < HI and LO <= y < HI
            if 'N' in conn and LO <= x < HI and y < HI: inc = True
            if 'S' in conn and LO <= x < HI and y >= LO: inc = True
            if 'W' in conn and LO <= y < HI and x < HI: inc = True
            if 'E' in conn and LO <= y < HI and x >= LO: inc = True
            m[y][x] = inc
    return m


def trench(c, conn, grate=False):
    ground(c)
    m = mask_of(conn)
    inside = lambda x, y: (m[y][x] if 0 <= x < 16 and 0 <= y < 16 else (
        ('N' in conn and y < 0 and LO <= x < HI) or ('S' in conn and y > 15 and LO <= x < HI) or
        ('W' in conn and x < 0 and LO <= y < HI) or ('E' in conn and x > 15 and LO <= y < HI)))
    # 갓돌(도랑 둘레 2px, 밝은 윗면 — 위쪽 갓은 뒤 가장자리라 어둡게 한 줄)
    for y in range(16):
        for x in range(16):
            if m[y][x]: continue
            near = [(dx, dy) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if inside(x + dx, y + dy)]
            if near:
                d = min(abs(dx) + abs(dy) for dx, dy in near)
                c.P(x, y, 'stone', 6 if d == 1 else 5)
                if not inside(x, y + 1) and inside(x, y + 2) and d == 2: c.P(x, y, 'stone', 4)
    # 도랑 바닥 + 북쪽 안벽(남쪽을 보는 면, 2행) + 서쪽 안벽 그늘 1열
    for y in range(16):
        for x in range(16):
            if not m[y][x]: continue
            t = 1
            if not inside(x, y - 1): t = 3
            elif not inside(x, y - 2): t = 2
            if not inside(x - 1, y) and t == 1: t = 2
            c.P(x, y, 'stone', t)
    # 관(굵은 구리관 4px + 가는 무쇠관 2px) — 가운데 이음통 둘레로 이어진다
    def hrun(x0, x1):
        for j, t in enumerate((5, 4, 3, 2)): c.HL(x0, 6 + j, x1 - x0, 'copper', t)
        c.HL(x0, 10, x1 - x0, 'iron', 4); c.HL(x0, 11, x1 - x0, 'iron', 2)
        for bx in range(x0 + 2, x1, 6): c.VL(bx, 6, 4, 'brass', 4); c.P(bx, 9, 'brass', 2)
    def vrun(y0, y1):
        for i, t in enumerate((4, 5, 3, 2)): c.VL(6 + i, y0, y1 - y0, 'copper', t)
        c.VL(10, y0, y1 - y0, 'iron', 4); c.VL(11, y0, y1 - y0, 'iron', 2)
        for by in range(y0 + 2, y1, 6): c.HL(6, by, 4, 'brass', 4); c.P(9, by, 'brass', 2)
    if 'W' in conn: hrun(0, 8 if conn != 'EW' else 16)
    if 'E' in conn: hrun(8 if conn != 'EW' else 0, 16)
    if 'N' in conn: vrun(0, 8 if conn != 'NS' else 16)
    if 'S' in conn: vrun(8 if conn != 'NS' else 0, 16)
    if conn not in ('EW', 'NS'):
        # 가운데 이음 원판(관이 꺾이는 놋쇠 테 이음, 위에서 본다)
        disc(c, 8, 8, 3.6, 2.8, 'copper', 4, band=1, bt=2, rim=False)
        c.ell(8, 8, 3.6, 2.8, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2) if d > 0.7 else None)
        c.P(7, 7, 'copper', 5)
    if len(conn) == 1:
        # 막힌 끝: 관 끝 플랜지
        if conn in 'EW':
            fx = 7 if conn == 'E' else 8
            c.VL(fx, 5, 7, 'iron', 5); c.VL(fx + (1 if conn == 'E' else -1), 5, 7, 'iron', 3)
        else:
            fy = 7 if conn == 'S' else 8
            c.HL(5, fy, 7, 'iron', 5); c.HL(5, fy + (1 if conn == 'S' else -1), 7, 'iron', 3)
    if grate:
        # 무쇠 덮개(도랑 위를 덮는 격자 판 — 지나갈 수 있다)
        if conn == 'EW':
            c.R(0, LO - 1, 16, HI - LO + 2, 'iron', 3)
            for x in range(0, 16, 3): c.VL(x, LO, HI - LO, 'iron', 1)
            c.HL(0, LO - 1, 16, 'iron', 5); c.HL(0, HI, 16, 'iron', 2)
        else:
            c.R(LO - 1, 0, HI - LO + 2, 16, 'iron', 3)
            for y in range(0, 16, 3): c.HL(LO, y, HI - LO, 'iron', 1)
            c.VL(LO - 1, 0, 16, 'iron', 5); c.VL(HI, 0, 16, 'iron', 2)


NAMES = {'EW': '가로', 'NS': '세로', 'NE': '북·동 꺾임', 'NW': '북·서 꺾임', 'SE': '남·동 꺾임', 'SW': '남·서 꺾임',
         'NEW': '가로 + 북 갈래', 'SEW': '가로 + 남 갈래', 'NES': '세로 + 동 갈래', 'NSW': '세로 + 서 갈래',
         'E': '서쪽 막힌 끝(동으로 이어짐)', 'W': '동쪽 막힌 끝(서로 이어짐)', 'N': '남쪽 막힌 끝(북으로 이어짐)', 'S': '북쪽 막힌 끝(남으로 이어짐)'}
RULE = ('배관 도랑은 끊기지 않게 잇는다: 이웃 칸과 연결 방향이 맞아야 한다(동쪽이 열린 칸의 동쪽 이웃은 서쪽이 열린 칸). '
        '도랑은 지나갈 수 없다 — 사람 길과 겹치는 칸만 pipe-grate-ew/ns(덮개)로 바꾼다. 끝은 보일러실·공장 벽 앞 칸 또는 밸브 소품 옆.')

for conn, nm in NAMES.items():
    R.add('pipe-' + conn.lower(), '배관 도랑 — ' + nm, 1, 1, 'terrain', tags=['배관', '공장', '증기', '도랑'], rules=RULE, conn=conn)(
        lambda c, conn=conn: trench(c, conn))
R.add('pipe-grate-ew', '배관 도랑 덮개(가로 — 사람이 건너는 무쇠 격자)', 1, 1, 'terrain', tags=['배관', '덮개', '길'], rules=RULE, conn='EW', passable=True)(
    lambda c: trench(c, 'EW', grate=True))
R.add('pipe-grate-ns', '배관 도랑 덮개(세로 — 사람이 건너는 무쇠 격자)', 1, 1, 'terrain', tags=['배관', '덮개', '길'], rules=RULE, conn='NS', passable=True)(
    lambda c: trench(c, 'NS', grate=True))


def sheet(path=None, z=4):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'pipes', 'preview.png'), z=z, W=1600)


if __name__ == '__main__':
    import glob
    for f in glob.glob(os.path.join(OUT, 'pipes', '_gate', '*.png')): os.remove(f)
    R.export(); sheet()
    print(len(R.items), 'pipes')

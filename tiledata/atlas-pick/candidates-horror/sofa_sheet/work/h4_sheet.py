import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')

def mask_from(rows):
    m = set()
    for y, spans in rows.items():
        if isinstance(spans[0], int): spans = [spans]
        for l, r in spans:
            for x in range(l, r + 1): m.add((x, y))
    return m

def edge_dist(m, x, y):
    for d in (1, 2, 3):
        for dx in range(-d, d + 1):
            for dy in range(-d, d + 1):
                if max(abs(dx), abs(dy)) == d and (x + dx, y + dy) not in m: return d
    return 4

def shade(c, m, direction, folds, strength):
    xs = [p[0] for p in m]; ys = [p[1] for p in m]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    W = x1 - x0 + 1; H = y1 - y0 + 1
    for (x, y) in m:
        fx = (x - x0) / max(1, W - 1); fy = (y - y0) / max(1, H - 1)
        t = 4.0 + (0.5 - fx) * 2.2 * strength + (0.45 - fy) * 1.8 * strength
        d = edge_dist(m, x, y)
        if d == 1:
            # 윤곽: 한 단 어두운. 오른쪽·아래 쪽은 더 어둡게
            rb = ((x + 1, y) not in m) or ((x, y + 1) not in m)
            t = 1.0 if rb else 2.0
        elif d == 2 and (((x + 1, y + 1) not in m) or ((x, y + 1) not in m) or ((x + 1, y) not in m) or ((x + 2, y) not in m) or ((x, y + 2) not in m)):
            t = min(t, 3.0)
        c.set(x, y, P('dust', int(round(t))))
    for (fx, fy0, fy1, wob) in folds:
        for y in range(fy0, fy1 + 1):
            x = fx + (wob[(y - fy0) % len(wob)] if wob else 0)
            if (x, y) in m and edge_dist(m, x, y) > 1:
                c.set(x, y, P('dust', 1 if direction == 'B' else 2))
                if (x - 1, y) in m and edge_dist(m, x - 1, y) > 1: c.set(x - 1, y, P('dust', 5 if direction != 'C' else 4))
                if direction == 'B' and (x + 1, y) in m and edge_dist(m, x + 1, y) > 1: c.set(x + 1, y, P('dust', 2))

def shadow(c, m, w, h, rows_down=3):
    for (x, y) in list(m):
        pass
    for (x, y) in sorted(m):
        for dx, dy in ((1, 1), (2, 1), (2, 2), (3, 2), (1, 2), (3, 3), (0, 1), (0, 2), (2, 3), (1, 3)):
            q = (x + dx, y + dy)
            if q in m or not (0 <= q[0] < w and 0 <= q[1] < h): continue
            if c.get(*q) is None:
                c.set(*q, '~' if (dy <= 2 and dx <= 2) else '-')

# ---------------- 소파 ----------------
def sofa(d):
    c = Cv(32, 16)
    if d == 'C':
        rows = {1: (13, 18), 2: (11, 20), 3: (10, 21), 4: (10, 21), 5: (9, 22), 6: [(4, 27)], 7: (2, 29), 8: (1, 30), 9: (1, 30),
                10: (1, 30), 11: (1, 30), 12: (1, 30), 13: (0, 31), 14: (0, 31)}
        rows[13] = [(0, 31)]
    elif d == 'B':
        rows = {2: (6, 25), 3: (4, 27), 4: (3, 28), 5: (2, 29), 6: (1, 30), 7: (1, 30), 8: (1, 30), 9: (1, 30), 10: (1, 30), 11: (1, 30), 12: (1, 30)}
    else:
        rows = {2: (6, 25), 3: (4, 27), 4: (3, 28), 5: (2, 29), 6: (1, 30), 7: (1, 30), 8: (1, 30), 9: (1, 30), 10: (1, 30), 11: (1, 30), 12: (1, 30), 13: (0, 31), 14: (0, 31)}
    m = mask_from(rows)
    if d == 'A':
        # 아래 끝 물결 늘어짐
        for x in range(32):
            if x % 5 in (1, 2): m.add((x, 15)) if 0 < x < 31 else None
            if x % 7 == 3: m.discard((x, 14))
    if d == 'C':
        for x in range(0, 32):
            if x % 6 in (2, 3, 4): m.add((x, 15))
    folds = [(11, 9, 14, [0]), (16, 9, 15, [0]), (21, 9, 14, [0])]
    if d == 'C': folds = [(6, 9, 14, [0]), (25, 9, 14, [0]), (16, 12, 15, [0])]
    shade(c, m, d, folds, 1.0 if d != 'B' else 1.5)
    if d != 'C':
        # 좌석 등받이 경계 접힘(등받이 앞 가로 주름)
        for x in range(7, 25):
            if (x, 8) in m and edge_dist(m, x, 8) > 1: c.set(x, 8, P('dust', 3 if d == 'A' else 2))
        # 팔걸이 옆 세로 주름
        for y in range(7, 13):
            for x in (6, 25):
                if (x, y) in m: c.set(x, y, P('dust', 2))
    else:
        # 앉은 사람 형상: 두 눈구멍
        c.set(14, 4, P('void', 0)); c.set(15, 4, P('void', 0)); c.set(14, 5, P('void', 0)); c.set(17, 4, P('void', 0)); c.set(18, 4, P('void', 0)); c.set(17, 5, P('void', 0))
        # 입 자리 늘어짐 (긴 세로 검은 줄)
        c.set(16, 6, P('dust', 0)); c.set(16, 7, P('dust', 0)); c.set(16, 8, P('dust', 1))
    # 다리 끝 하나 (rot)
    lx = {'A': 26, 'B': 26, 'C': 3}[d]
    if d == 'B':
        c.set(lx, 13, P('rot', 1)); c.set(lx + 1, 13, P('rot', 2))
        c.set(lx, 14, P('rot', 1)); c.set(lx + 1, 14, P('rot', 0))
    elif d == 'A':
        c.set(lx, 15, P('rot', 2)); c.set(lx + 1, 15, P('rot', 1))
    else:
        c.set(lx, 15, P('rot', 3)); c.set(lx + 1, 15, P('rot', 1)); c.set(lx, 14, P('rot', 1))
    if d == 'B':
        allm = set(m) | {(lx, 13), (lx + 1, 13), (lx, 14), (lx + 1, 14)}
        shadow(c, m, 32, 16)
    return c

# ---------------- 안락의자 ----------------
def armchair(d):
    c = Cv(16, 16)
    if d == 'C':
        rows = {1: (6, 9), 2: (5, 10), 3: (5, 10), 4: (4, 11), 5: (3, 12), 6: (2, 13), 7: (1, 14), 8: (1, 14), 9: (1, 14), 10: (1, 14), 11: (1, 14), 12: (0, 15), 13: (0, 15)}
    elif d == 'B':
        rows = {1: (4, 11), 2: (3, 12), 3: (2, 12), 4: (2, 13), 5: (2, 13), 6: (1, 14), 7: (1, 14), 8: (1, 14), 9: (1, 14), 10: (1, 14), 11: (1, 14)}
    else:
        rows = {1: (4, 11), 2: (3, 12), 3: (2, 13), 4: (2, 13), 5: (2, 13), 6: (1, 14), 7: (1, 14), 8: (1, 14), 9: (1, 14), 10: (1, 14), 11: (1, 14), 12: (1, 14), 13: (0, 15)}
    m = mask_from(rows)
    if d == 'A':
        for x in range(16):
            if x % 5 in (1, 2): m.add((x, 14)) if 0 < x < 15 else None
    if d == 'C':
        for x in range(16):
            if x % 6 in (1, 2, 3): m.add((x, 14))
            if x % 6 == 2: m.add((x, 15))
    folds = [(6, 8, 12, [0]), (10, 7, 12, [0])]
    if d == 'B': folds = [(6, 8, 11, [0]), (10, 7, 11, [0])]
    if d == 'C': folds = [(3, 8, 13, [0]), (12, 8, 13, [0])]
    shade(c, m, d, folds, 1.0 if d != 'B' else 1.5)
    if d != 'C':
        for x in range(4, 12):
            if (x, 6) in m and edge_dist(m, x, 6) > 1: c.set(x, 6, P('dust', 3 if d == 'A' else 2))
    else:
        for (x, y) in ((6, 3), (7, 3), (6, 4), (9, 3), (10, 3)):
            pass
        c.set(6, 3, P('void', 0)); c.set(6, 4, P('void', 0)); c.set(9, 3, P('void', 0)); c.set(9, 4, P('void', 0))
        c.set(7, 6, P('dust', 0)); c.set(8, 6, P('dust', 0)); c.set(8, 7, P('dust', 1))
    lx = {'A': 11, 'B': 11, 'C': 2}[d]
    if d == 'B':
        c.set(lx, 12, P('rot', 1)); c.set(lx + 1, 12, P('rot', 2)); c.set(lx, 13, P('rot', 1)); c.set(lx + 1, 13, P('rot', 0))
        shadow(c, m, 16, 16)
    elif d == 'A':
        c.set(lx, 15, P('rot', 2)); c.set(lx + 1, 15, P('rot', 1))
    else:
        c.set(lx, 15, P('rot', 3)); c.set(lx + 1, 15, P('rot', 1))
    return c

NS = {
 'A': '흰 천 소파 v5 자리(32×16, 바닥선 같은 y): 등받이·팔걸이 둥근 덩이, 주름 세로 3줄, 아래 끝이 물결로 늘어지고 오른쪽 밑에 rot 다리 끝 하나',
 'B': '왼쪽 위 강한 빛: 천 윗면 밝고 오른쪽 아래 어둡게, 주름 골이 깊고 어두움, 천 아래 오른쪽 아래로 ~ 그림자 3줄, 다리 끝이 그림자 속에 보임',
 'C': '앉은 사람 형상: 가운데 머리 덩이와 좁은 어깨, 천에 뚫린 눈구멍 둘과 늘어진 입 자국, 양옆 주름이 팔처럼 흘러내림 — 소파가 사람을 덮은 듯',
}
NA = {
 'A': '천 덮인 안락의자(16×16): 높은 등받이 덩이, 주름 두 줄, 아래 끝 늘어짐, 오른쪽 다리 끝 하나 — 소파 A 와 같은 천 처리',
 'B': '소파 B 와 같은 빛: 왼쪽 위 밝음·오른쪽 아래 어둠, ~ 그림자 2~3줄, 다리 끝 그림자 속',
 'C': '소파 C 와 같이 앉은 사람 형상: 머리 덩이·눈구멍 둘·늘어진 입, 양옆 주름이 팔',
}
for d in 'ABC':
    sofa(d).emit(f'{CH}/sofa_sheet/h4-{d}.pxg', f'sofa_sheet h4-{d}')
    open(f'{CH}/sofa_sheet/h4-{d}.note', 'w', encoding='utf-8').write(NS[d] + '\n')
    armchair(d).emit(f'{CH}/armchair_sheet/h4-{d}.pxg', f'armchair_sheet h4-{d}')
    open(f'{CH}/armchair_sheet/h4-{d}.note', 'w', encoding='utf-8').write(NA[d] + '\n')

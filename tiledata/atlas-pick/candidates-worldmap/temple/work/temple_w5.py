import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/village/work')
from cyl_w5 import *

def temple(mode, C=False):
    c = Cv(32, 32)
    A = mode == 'A'
    x0, x1 = (2, 29) if not C else (4, 27)
    # 계단 기단 3단
    steps = [(x0 - 2, x1 + 2, 30), (x0 - 1, x1 + 1, 28), (x0, x1, 26)] if not C else [(x0 - 3, x1 + 3, 30), (x0 - 2, x1 + 2, 28), (x0 - 1, x1 + 1, 26)]
    for (a, b, y) in steps:
        c.hl(a, b, y, 'r' if A else 'r'); c.hl(a, b, y + 1, 'p' if A else 'P')
    c.hl(steps[0][0], steps[0][1], 31, '.')
    ytop_col = 14 if not C else 12
    ybase = 25
    # 몸체 뒷벽(어둡게)
    for y in range(ytop_col, ybase + 1):
        for x in range(x0 + 1, x1):
            c.put(x, y, 'P' if not A else 'p')
    # 기둥 4개
    n = 4
    span = x1 - x0 - 2
    cols = [x0 + 2 + round(i * (span - 3) / 3) for i in range(n)]
    for cx in cols:
        for y in range(ytop_col, ybase + 1):
            if A:
                c.put(cx, y, 'r'); c.put(cx + 1, y, 'r'); c.put(cx + 2, y, 'q')
            else:
                c.put(cx, y, 'r'); c.put(cx + 1, y, 'q'); c.put(cx + 2, y, 'P')
        c.hl(cx - 1, cx + 3, ytop_col, 'r'); c.hl(cx - 1, cx + 3, ybase, 'q')
        if not A:
            c.rect(cx + 2, ytop_col + 1, cx + 2, ybase - 1, 'P')
        # 사이 그늘
    for i in range(n - 1):
        for x in range(cols[i] + 3, cols[i + 1]):
            for y in range(ytop_col + 1, ybase):
                c.put(x, y, 'P' if not A else 'p')
    # 문 (가운데 어두운 틈)
    mid = (x0 + x1) // 2
    # 엔타블러처 + 박공
    c.hl(x0 - 1, x1 + 1, ytop_col - 1, 'q'); c.hl(x0 - 1, x1 + 1, ytop_col - 2, 'r')
    c.hl(x0 - 1, x1 + 1, ytop_col - 3, 'G' if A else 'H')
    gh = 6 if not C else 8
    for i in range(gh):
        y = ytop_col - 4 - i
        w = (x1 - x0 + 3) // 2 - int(i * ((x1 - x0 + 3) / 2) / gh)
        a, b = mid - w + 1, mid + w
        c.hl(a, b, y, 'r' if i > 0 or True else 'r')
        c.put(a, y, 'H' if not A else 'G'); c.put(a+1, y, 'H' if not A else 'G'); c.put(b, y, 'G'); c.put(b-1, y, 'G')
        if i < gh - 1:
            pass
    # 박공 안쪽 어둡게 (삼각 그늘)
    for i in range(1, gh):
        y = ytop_col - 4 - i
        w = (x1 - x0 + 3) // 2 - int(i * ((x1 - x0 + 3) / 2) / gh)
        for x in range(mid - w + 2, mid + w - 1):
            c.put(x, y, 'q' if A else ('q' if x < mid else 'P'))
    # 문
    c.rect(mid - 1, ybase - 6, mid, ybase, 'K')
    tr = str.maketrans('rqpP', 'Ppqr')
    c.g = [[ch.translate(tr) for ch in row] for row in c.g]
    return c

c = temple('A'); save('temple', 'A', c, '', 'oprn 아틀라스 결 — 흰 돌 신전, 낮은 삼각 박공에 금 선 한 줄, 기둥 넷과 사이 그늘, 3단 기단, 평평한 면')
c = temple('B'); c.shadow(); save('temple', 'B', c, '', '빛·부피 — 기둥 왼쪽 밝고 오른쪽 어둡게 원통으로, 박공 금 선, 기단 3단, 발치 반투명 그림자')
c = temple('B', C=True); c.shadow(); save('temple', 'C', c, '', '실루엣 재해석 — 좁고 높은 박공에 기둥 넷, 멀리서 뾰족한 삼각 이마로 읽힘')

import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 결의 낡은 돌우물 — 위에서 약간 내려다본 둥근 돌 테(윗줄 한 단 밝게)와 새까만 입(void), 벽은 어긋나게 쌓은 돌, 아래·테 위에 이끼, 오른쪽에 썩은 뚜껑 판이 비스듬히 기대었고 왼쪽 앞에 끊어진 두레박 줄이 늘어졌다.",
 'B': "B: 왼쪽 위 빛 — 돌 테 왼쪽 윗면이 가장 밝고 오른쪽 벽은 깊게 어둡다. 입 안쪽은 윗벽 한 줄만 빛을 받고 나머지 새까맣다. 우물 오른쪽·아래에 반투명 접촉 그림자, 뚜껑 판도 그늘에 잠긴다.",
 'C': "C: 실루엣 재해석 — 우물 입이 세로로 길게 찢어져 비명 지르는 입처럼 보이고, 테 돌 몇 개가 이빨처럼 안쪽으로 튀어나왔다. 어긋난 곳은 세로 입과 돌 이빨. 뚜껑 판은 기대지 않고 바닥에 눕는다.",
}
def build(k):
    c = Canvas('old_well', 32, 32)
    cx, cy = 12.5, 12.0
    rx, ry, H = 11.5, 6.5, 10
    if k == 'C': cx, cy, rx, ry, H = 12.5, 12.0, 9.5, 6.5, 11
    def rim(x, y):
        dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
        return dx * dx + dy * dy
    # 벽 (앞면)
    for x in range(32):
        dx = (x + .5 - cx) / rx
        if abs(dx) > 1: continue
        yb = cy + ry * math.sqrt(1 - dx * dx)
        for y in range(int(cy), int(yb + H) + 1):
            if y > yb + H: continue
            course = (y - 4) // 4
            joint = (x + (2 if course % 2 else 0) + 0) % 5 == 0
            u = (x - (cx - rx)) / (2 * rx)
            s = 4 - int(u * 3.2)
            if k == 'B': s = 5 - int(u * 4.5)
            if joint: s -= 1
            if (y - 4) % 4 == 0: s -= 1
            if y > yb + H - 2: s -= 1
            c.px(x, y, f'vstone:{max(0, min(6, s))}')
    # 테 (윗면)
    for y in range(32):
        for x in range(32):
            d = rim(x, y)
            if d <= 1:
                u = (x - (cx - rx)) / (2 * rx); v = (y - (cy - ry)) / (2 * ry)
                s = 4 - int(u * 1.5) - (0 if v < .25 else 0)
                if y <= cy - ry + 1.2: s = 6 if k != 'B' else 6
                elif d > .86: s = max(2, s - 1)
                if k == 'B' and u < .45: s += 1
                seg = int((math.atan2(y + .5 - cy, x + .5 - cx) + math.pi) / (2 * math.pi) * 16)
                edge_of = (d > .9 and (int((math.atan2(y + .5 - cy, x + .5 - cx) + 3.1416) * 8) % 3 == 0))
                if edge_of: s -= 1
                c.px(x, y, f'vstone:{max(0, min(6, s))}')
    # 입 (void)
    if k == 'C':
        mrx, mry, mcx, mcy = 3.6, 5.2, cx, cy
    else:
        mrx, mry, mcx, mcy = 8.0, 3.6, cx, cy + .5
    for y in range(32):
        for x in range(32):
            dx = (x + .5 - mcx) / mrx; dy = (y + .5 - mcy) / mry
            if dx * dx + dy * dy <= 1:
                key = 'void:0'
                if dy < -.35: key = 'void:2' if k != 'B' else ('vstone:1' if dx < .1 else 'void:1')
                elif dy < -.1: key = 'void:1'
                c.px(x, y, key)
    if k == 'C':  # 돌 이빨
        for (tx, ty) in [(10, 8), (14, 8), (10, 16), (12, 17), (15, 16)]:
            c.px(tx, ty, 'vstone:6'); c.px(tx, ty + (1 if ty < 12 else -1), 'vstone:5')
    # 이끼
    moss = [(2, 16, 4), (3, 19, 3), (5, 24, 5), (9, 26, 4), (18, 25, 5), (21, 21, 3), (22, 15, 3), (6, 10, 3), (18, 6, 3)]
    for (mx, my, n) in moss:
        for i in range(n):
            xx, yy = mx + i, my + (1 if i % 3 == 1 else 0)
            cur = c.get(xx, yy)
            if cur and cur.startswith('vstone'):
                c.px(xx, yy, f'hmoss:{3 if (i + my) % 2 else 2}' if k != 'B' else f'hmoss:{3 if xx < 12 else 1}')
                if i % 2 == 0 and c.get(xx, yy + 1) and c.get(xx, yy + 1).startswith('vstone'): c.px(xx, yy + 1, 'hmoss:1')
    # 끊어진 두레박 줄 (왼쪽 앞, 테에서 벽 위로)
    rx0 = 5
    for i, y in enumerate(range(12, 19)):
        c.px(rx0 + (1 if i in (3, 4) else 0), y, 'tarn:4' if i % 2 == 0 else 'tarn:3')
    c.px(rx0 + 1, 19, 'tarn:2'); c.px(rx0 + 2, 19, 'tarn:3'); c.px(rx0, 19, 'tarn:4')
    # 뚜껑 판 (오른쪽 기댐)
    def plank(x0, y0, x1, y1, wdt, tone):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            px_ = round(x0 + (x1 - x0) * i / n); py_ = round(y0 + (y1 - y0) * i / n)
            for w in range(wdt):
                s = tone + (1 if w == 0 else 0) - (1 if w == wdt - 1 else 0)
                if (i % 7 == 3) and w == 1: s -= 2   # 판 틈/옹이
                c.px(px_ + w, py_, f'rot:{max(0, min(6, s))}')
    if k != 'C':
        plank(24, 29, 29, 11, 4, 4 if k != 'B' else 3)
        # 부러진 윗끝
        for (x, y) in [(29, 10), (30, 10), (28, 10), (31, 11)]: c.px(x, y, None)
        c.px(30, 11, 'rot:1'); c.px(29, 12, 'rot:1')
        for y in (16, 17): c.px(28, y, 'hmoss:2'); c.px(27, y + 1, 'hmoss:1')
    else:
        # 눕힌 판: 우물 발치 바닥에 가로
        for x in range(14, 31):
            for w in range(3):
                s = 4 - w + (0 if w != 1 else 0)
                c.px(x, 28 + w if x < 27 else 27 + w, f'rot:{max(1, s)}')
        c.px(20, 29, 'rot:1'); c.px(23, 28, 'rot:1')
    if k == 'B':  # 반투명 접촉 그림자 — 빈 칸 위에만
        for y in range(24, 32):
            for x in range(22, 32):
                if c.get(x, y) is None and (x - 22) + (y - 24) * 0.0 <= 9 - (0 if y < 30 else 2): 
                    if y >= 29 or (y >= 26 and x < 26): c.px(x, y, '~' if y >= 30 or x < 25 else '-')
        for x in range(2, 24):
            if c.get(x, 31) is None and c.get(x, 30) is not None: c.px(x, 31, '~')
    # 밤 방에서 살도록 돌 전체를 한 단 낮춤(윗줄 밝기는 유지 차이)
    for yy in range(32):
        for xx in range(32):
            kk = c.get(xx, yy)
            if kk and kk.startswith('vstone:'):
                n = '0123456789abcde'.index(kk[-1]); c.px(xx, yy, f'vstone:{max(0, n - 1)}')
    # 아래쪽 어두운 접지선
    c.outline(dtl=2, dbr=3, mins={'vstone': 0, 'rot': 0, 'hmoss': 0})
    return c
for k in 'ABC': build(k).save(f'h1-{k}', NOTES[k])

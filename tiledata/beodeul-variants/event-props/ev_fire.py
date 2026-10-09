# 불 이벤트 소품(모두 4프레임 띠): 벽 횃불, 화로, 모닥불.
# 불꽃 모양은 ev_base.flame_rows(손으로 찍은 4장 — 혀가 좌우로 흔들리고 키가 바뀐다), 받침은 버들항 px2.C.
# 참고(읽기만): volcano-field temple_brazier 의 문자열 불꽃, cultist-tower ct_kit.flame 의 「아래 넓고 위 뾰족, 가운데 밝다」.
import math
from ev_base import *
from ev_base import _hash


def _embers(px, W, H, pts, f):
    """떠오르는 불티: 프레임마다 위로 2px 씩, 4프레임 주기."""
    for k, (x, y0) in enumerate(pts):
        y = y0 - ((f + k) % 4) * 2
        if 0 <= y < H and px[x, y][3] == 0: put(px, W, H, x + ((f + k) % 2), y, rgb('flame', 5 if (f + k) % 4 < 2 else 3))


def _flame(px, W, H, f, size, x0, y0):
    rows = flame_rows(f, size)
    draw_rows(px, W, H, rows, x0, y0, 'flame')
    # 불꽃 바깥 한 겹: 어두운 주황(색 윤곽 대신 — 버들항 등불처럼 불은 검은 윤곽이 없다)
    pts = set()
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch.isdigit(): pts.add((x0 + i, y0 + j))
    for (x, y) in list(pts):
        for (dx, dy) in ((-1, 0), (1, 0), (0, -1)):
            q = (x + dx, y + dy)
            if q not in pts and 0 <= q[0] < W and 0 <= q[1] < H and px[q[0], q[1]][3] == 0 and _hash(q[0], q[1], f + 3) < .55:
                put(px, W, H, q[0], q[1], rgb('flame', 2))


def torch_wall(frame=0):
    """벽 횃불(1x1, 벽 앞면에 붙인다): 쇠 고리 받침판 + 비스듬히 꽂은 나무 자루 + 기름 먹인 천 머리, 불꽃 4프레임 + 벽에 비친 빛 점."""
    W = H = 16; f = frame % 4
    c = C(W, H, seed=3101)
    c.group(1); c.new()
    for y in range(10, 15):                                           # 벽에 박은 쇠 받침판
        for x in range(6, 10): c.tone(x, y, 'iron', 5 if x == 6 or y == 10 else (2 if x == 9 or y == 14 else 3))
    c.tone(7, 12, 'iron', 1); c.tone(8, 12, 'iron', 2)
    c.group(2); c.new()
    for y in range(7, 14):                                            # 나무 자루(2px, 왼쪽 빛)
        c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    for x in range(6, 10): c.tone(x, 11, 'iron', 4 if x < 8 else 2)   # 고리 띠
    c.group(3); c.new()
    for y in range(5, 8):                                             # 천 머리(그을림)
        for x in range(6, 10): c.tone(x, y, 'char', (4, 3, 3, 2)[x - 6])
    im = F(c); px = im.load()
    _flame(px, W, H, f, 0, 5, 0)
    # 자루 쇠 띠에 비친 불빛(프레임마다 한 점)
    put(px, W, H, 6 + f % 2, 11, rgb('flame', 4))
    _embers(px, W, H, [(4, 3), (11, 4)], f)
    return im


def brazier(frame=0):
    """화로(1x1): 세 발 쇠 대야(3/4: 둥근 테 윗면이 보인다) 속 숯 위로 타는 불, 4프레임 불꽃 + 불티."""
    W = H = 16; f = frame % 4
    c = C(W, H, seed=3201)
    c.shadow(8, 14.6, 6, 1.2, 90)
    c.group(1); c.new()
    for (x0, x1) in ((4, 3), (11, 12)):                               # 다리(바깥으로 벌어짐)
        c.line(x0, 11, x1, 14, 'iron', 3)
    c.line(8, 12, 8, 14, 'iron', 2)
    c.group(2); c.cylinder(8, 8, 11, 5.6, 'iron', cap=True, capry=1.8, amb=0.3)
    c.new()
    for y in range(7, 10):                                            # 대야 속 숯(어둡게, 불빛 점)
        for x in range(4, 13):
            if ((x + .5 - 8) / 4.2) ** 2 + ((y + .5 - 8) / 1.3) ** 2 <= 1: c.tone(x, y, 'char', 2 if _hash(x, y, f) > .25 else 4)
    for x in range(3, 14): c.tone(x, 10, 'iron', 4 if x < 8 else 2)  # 대야 테 아래 그늘 띠
    im = F(c); px = im.load()
    for (x, y) in ((6, 8), (9, 8), (8, 9), (11, 8)):                 # 숯불 점(프레임마다 바뀜)
        if _hash(x, y, f + 11) > .4: put(px, W, H, x, y, rgb('flame', 4))
    _flame(px, W, H, f, 1, 5, 1)
    _embers(px, W, H, [(3, 4), (12, 3), (8, 1)], f)
    return im


def campfire(frame=0):
    """모닥불(1x1): 둥글게 놓은 돌 여덟 + 엇갈린 장작 둘 + 큰 불꽃 4프레임 + 불티. 돌 둘레가 불빛을 받는다."""
    W = H = 16; f = frame % 4
    c = C(W, H, seed=3301)
    c.shadow(8, 14.2, 7, 1.4, 70)
    c.group(1)
    for k in range(8):                                                # 돌 고리(3/4 납작 타원)
        a = 2 * math.pi * k / 8 + .2
        x = 8 + 5.6 * math.cos(a); y = 12 + 2.4 * math.sin(a)
        c.ellipsoid(x, y, 1.7, 1.3, 'stone', amb=.3, bias=-.02 + (.06 if math.sin(a) > 0 else 0))
    c.group(2); c.new()
    c.line(3, 13, 12, 9, 'wood', 4); c.line(3, 12, 12, 8, 'wood', 5)   # 장작(엇갈림)
    c.line(4, 9, 13, 12, 'wood', 3); c.line(4, 10, 13, 13, 'wood', 2)
    c.new()
    for (x, y) in ((12, 8), (13, 12)): c.tone(x, y, 'cream', 4)      # 잘린 마구리
    im = F(c); px = im.load()
    _flame(px, W, H, f, 2, 4, 3)
    for k in range(8):                                                # 앞쪽 돌에 비친 불빛
        a = 2 * math.pi * k / 8 + .2
        if math.sin(a) > 0:
            x = int(round(8 + 5.6 * math.cos(a))); y = int(round(12 + 2.4 * math.sin(a))) - 1
            if (k + f) % 2 == 0: put(px, W, H, x, y, rgb('flame', 3))
    _embers(px, W, H, [(2, 4), (13, 3), (11, 1)], f)
    return im

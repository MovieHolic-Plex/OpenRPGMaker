"""windmill — 탑 풍차(덩어리 모형 M30). 둥근 돌 받침 위 원뿔대 돌 탑 + 나무 널 배 모양 회전 지붕 + X자 격자 날개 넷(정지),
아래 아치 문(받침에 돌계단). 6×8 칸(96×128). 문 하나. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dovecote'))
from towerlib import (Canvas, pix, ST, sclamp, fill_walk, taper_wall, ring_y, on_cyl,  # noqa: E402
                      outline, darken, PINK)
from common import door, moss, window  # noqa: E402

c = Canvas(6, 8)
W, H = 96, 128
GY = H - 1
CX = 40.0

# ---------------------------------------------------------------- 네모 돌 단(윗면 포석이 보이고 앞면 마름돌) — 3/4: 윗면 + 남쪽 앞면만
PX0, PX1 = 1, 94
PTOP, PFR = 95, 120          # 윗면 위끝·앞끝, 앞면 PFR+1..GY
FLAG_W = [9, 10, 8, 11, 9, 10, 9, 8, 11, 10]
WR = 'WYaeghijkmn'
for y in range(PTOP, PFR + 1):
    row = (y - PTOP) // 6
    lv = (y - PTOP) % 6
    off = [0, 4, 7, 2, 5][row % 5]
    xs = []
    u = PX0 - off
    k = row * 3
    while u < PX1 + 14:
        xs.append(u)
        u += FLAG_W[k % len(FLAG_W)]
        k += 1
    for x in range(PX0, PX1 + 1):
        # 모서리 둥글게 깎기(윗면 뒤 모서리)
        su = max(v for v in xs if v <= x)
        lu = x - su
        sid = xs.index(su) + row * 5
        t = 7 if x < 24 else (6 if x < 66 else 5)
        t += [0, 1, 0, -1, 0, 1, 0, 0, -1, 1, 0][sid % 11]
        if lv == 5 or lu == 0:
            t -= 3
        elif lv == 0 or lu == 1:
            t += 1
        ch = WR[max(0, min(len(WR) - 1, t))]
        if y == PTOP:
            ch = 'a'
        c.put(x, y, ch)
# 앞 모서리 갓돌(밝은 윗선) + 앞면 마름돌
for x in range(PX0, PX1 + 1):
    c.put(x, PFR, 'r' if x % 11 else 'n')
front = pix.Ashlar([4, 4], seed=1, widths=[11, 8, 13, 9, 12, 10, 14, 8], dark=3)
for y in range(PFR + 1, GY + 1):
    for x in range(PX0, PX1 + 1):
        sh = 1 if x < 20 else (0 if x < 60 else -1)
        ch = front.color(x + 40, y - PFR - 1, sh - (1 if y == PFR + 1 else 0))
        c.put(x, y, ch)
for x in range(PX0, PX1 + 1):
    c.put(x, GY, darken(c.get(x, GY), 1))

# ---------------------------------------------------------------- 원뿔대 돌 탑
RB, RT = 25.0, 17.0
TOP, BOT = 38, 112
SAG = 4


def rad(y):
    return RT + (RB - RT) * (y - TOP) / (BOT - TOP)


ash = pix.Ashlar([4, 5, 4, 5, 4], seed=5, widths=[6, 8, 5, 9, 7, 5, 8, 6, 10, 5, 7, 9, 6, 5, 8, 7], dark=1, warm=True)
taper_wall(c, CX, rad, TOP, BOT, ash, SAG, remap=PINK)
# 탑 밑 기초 한 줄(회색 큰 돌)
base = pix.Ashlar([5], seed=7, widths=[13, 10, 15, 11, 9, 14, 12], dark=2)
taper_wall(c, CX, lambda y: RB + 0.6, BOT - 5, BOT, base, SAG)
# 가운데 높이 돌림띠 하나(원통 둘레)
for band_y in (72,):
    rb = rad(band_y) + 0.8
    for x in range(int(CX - rb) - 1, int(CX + rb) + 2):
        o = on_cyl(CX, rb, x)
        if not o:
            continue
        dx, cosv, sh = o
        y = band_y + round(SAG * cosv)
        c.put(x, y, PINK.get(sclamp(10 + sh), 'z'))
        c.put(x, y + 1, PINK.get(sclamp(7 + sh), 'x'))
        c.put(x, y + 2, 'J' if sh < 0 else 't')
        g = c.get(x, y + 3)
        if g != '.' and abs(dx) <= rb - 0.8:
            c.put(x, y + 3, darken(g, 2))

# 작은 창 둘(가운데 세로줄 — 아래 날개 사이)
for (wx, wy) in [(40, 50)]:
    c.rows(wx - 3, wy, [
        '..3zzy..',
        '.3zDDxw.',
        '3zDFEAxw',
        '2zF^DAxw',
        '2zDAAAxw',
        '2zεεεεxw',
        '2zDAABxw',
        '2zAABBxw',
        '2zABBBxw',
        '3zzzyyxv',
        'nmkkjjie',
        'xwwvvutt',
    ])

# 문(아치 + 돌 테) — 받침에 돌계단
DX0, DW, DY0 = 34, 12, 87
for (dx, dy) in [(-2, 6), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -3), (9, -2), (11, 0), (12, 2), (12, 4), (12, 6)]:
    for j in range(2):
        for k in range(2):
            c.put(DX0 + dx + k, DY0 + dy + j, '3' if (j == 0 and k == 0) else ('z' if j == 0 else 'x'))
for y in range(DY0 + 8, BOT + 2):
    c.put(DX0 - 2, y, '2' if y % 4 else 'z')
    c.put(DX0 - 1, y, 'x')
    c.put(DX0 + DW, y, 'w')
    c.put(DX0 + DW + 1, y, 'x' if y % 4 else 'v')
door(c, DX0, DY0, DW, BOT + 2 - DY0)
# 계단(단 앞면을 파고 내려간다): 디딤 윗면 밝게, 챌면 어둡게
for k in range(2):
    y = PFR + 1 + k * 4
    for x in range(DX0 - 2, DX0 + DW + 2):
        c.put(x, y, 'r' if x % 6 else 'n')
        c.put(x, y + 1, 'm' if x % 6 else 'k')
        c.put(x, y + 2, 'a' if x % 5 else 'Y')
        c.put(x, y + 3, 'W' if k == 0 else 'Y')
for y in range(PFR, GY + 1):
    c.put(DX0 - 3, y, 'a')
    c.put(DX0 + DW + 2, y, 'W')

# ---------------------------------------------------------------- 배 모양 회전 지붕(나무 널)
# 앞에서 위로 본 엎은 배: 가운데 용골(세로 밝은 선), 널은 용골과 나란히 휜다. 왼쪽 밝고 오른쪽 어둡다.
CAPW, CAPT, CAPB = 23.0, 14, 42
WOOD = ['_', '-', 'γ', 'δ', 'ε', 'ζ', 'η', 'ξ', 'σ']
for y in range(CAPT, CAPB + 4):
    for x in range(int(CX - CAPW) - 1, int(CX + CAPW) + 2):
        dx = x + 0.5 - CX
        f = dx / CAPW
        if abs(f) > 1:
            continue
        # 윤곽: 위는 둥근 지붕(타원 위 반), 아래는 처진 밑선
        top = CAPB - (CAPB - CAPT) * math.sqrt(max(0.0, 1 - f ** 2)) ** 0.8
        bot = CAPB + 3 * math.sqrt(max(0.0, 1 - f * f))
        if y < top or y > bot:
            continue
        # 널: 둘레각으로 나눈다(용골과 나란한 세로 띠가 위로 모인다)
        ang = math.asin(max(-1, min(1, f)))
        plank = int((ang + 1.6) * 5.2)
        pf = ((ang + 1.6) * 5.2) % 1
        base_t = 6 if f < -0.55 else (5 if f < -0.1 else (4 if f < 0.35 else (3 if f < 0.7 else 2)))
        t = base_t
        if pf < 0.18:
            t -= 2
        elif pf > 0.8 and f < 0:
            t += 1
        # 널 이음(가로 짧은 틈) — 널마다 다른 높이(손 순서)
        seam = [6, 11, 4, 9, 13, 7, 3, 10, 5, 12, 8, 6, 11][plank % 13]
        if (y - CAPT) % 14 == seam % 14 and pf > 0.25:
            t -= 1
        # 위쪽은 빛을 받는다
        if y < top + 3 and f < 0.3:
            t += 1
        c.put(x, y, WOOD[max(0, min(len(WOOD) - 1, t))])
        if y >= bot - 1:
            c.put(x, y, '_' if f > 0 else '-')
        if y == bot - 2:
            c.put(x, y, 'γ' if f > 0.2 else 'ε')
# 용골(가운데 밝은 마룻대) + 꼭대기 쇠 장식
for y in range(CAPT, CAPB - 1):
    c.put(int(CX) - 1, y, 'σ' if y % 5 else 'ξ')
    c.put(int(CX), y, 'ζ')
c.rows(int(CX) - 2, CAPT - 3, ['..Y..', '.akY.', '.eiY.'])
# 지붕이 탑 위에 지는 그늘
for x in range(int(CX - RT) - 1, int(CX + RT) + 2):
    yy = ring_y(CX, CAPW, CAPB + 3, 0, x)
    for d in range(1, 4):
        y = CAPB + 3 + d + round(3 * math.sqrt(max(0, 1 - ((x + 0.5 - CX) / CAPW) ** 2))) - 3
        g = c.get(x, y)
        if g != '.' and g not in WOOD:
            c.put(x, y, darken(g, 3 - d + 1))

# ---------------------------------------------------------------- 날개 넷(X, 정지) — 굴대 머리 앞
HX, HY = 40.0, 37.0
L = 43.0
SAIL = []
for k, a_deg in enumerate((-135, -45, 45, 135)):
    a = math.radians(a_deg)
    SAIL.append((math.cos(a), math.sin(a), k))
pts = {}
for y in range(0, H):
    for x in range(0, W):
        px, py = x + 0.5 - HX, y + 0.5 - HY
        for (dxa, dya, k) in SAIL:
            al = px * dxa + py * dya
            ac = -px * dya + py * dxa      # 시계 방향 뒤쪽이 +
            if al < 3 or al > L:
                continue
            ch = None
            if abs(ac) < 1.6:
                # 굴대 막대(채): 위쪽 테 밝게
                ch = 'η' if ac < 0 else 'ε'
                if al > L - 2:
                    ch = 'ζ'
            elif 1.6 <= ac <= 10.2 and al >= 11:
                outer = ac > 9.0
                rung = (al - 11) % 5.6 < 1.05 or al > L - 1.1
                mid = 4.8 <= ac <= 5.8
                if outer:
                    ch = 'ζ' if k in (0, 3) else 'δ'
                elif rung:
                    ch = 'ξ' if ac < 5 else 'η'
                elif mid:
                    ch = 'η'
            if ch:
                pts[(x, y)] = ch
for (x, y), ch in pts.items():
    c.put(x, y, ch)
# 날개 아래 돌·지붕에 지는 얇은 그늘(오른쪽 아래 1px)
for (x, y), ch in pts.items():
    for (ax, ay) in ((1, 1),):
        q = (x + ax, y + ay)
        if q not in pts:
            g = c.get(*q)
            if g != '.':
                c.put(q[0], q[1], darken(g, 2))
# 굴대 머리(둥근 쇠 보스)
c.rows(int(HX) - 4, int(HY) - 4, [
    '..YWWY..',
    '.YiekaW.',
    'YieηζeYU',
    'WkησηζaU',
    'WjζηζεYU',
    '.YaeYYU.',
    '..WUUU..',
])

# 탑이 단 윗면에 지는 그림자(빛 왼쪽 위 → 오른쪽 뒤로 눕는다)
for y in range(PTOP, PFR):
    for x in range(int(CX), PX1 + 1):
        e = ((x - (CX + 14)) / (RB + 12)) ** 2 + ((y - (BOT - 6)) / 10.0) ** 2
        g = c.get(x, y)
        if e < 1 and g in 'WYaeghijkmn' and (abs(x + 0.5 - CX) > RB + 0.7 or y > BOT):
            c.put(x, y, darken(g, 3 if e < 0.6 else 2))
# 곡식 자루 더미(단 윗면 오른쪽, 탑 곁)
SACKS = [
    '.....-ε......',
    '....ημμη.....',
    '...ησLσξμ....',
    '..ησσσξξμη...',
    '..ηξσξξμηε...',
    '.-ε.εημηε.-ε.',
    'ημ-ξη..ημ-ξη.',
    'μσLσξμησLσξμε',
    'μσσσξμησσξμηε',
    'ηξσξμηεξσξμηε',
    '.εηηε..εηηεε.',
]
c.rows(70, 104, SACKS)
for x in range(70, 84):
    g = c.get(x, 115)
    if g != '.' and g in ST:
        c.put(x, 115, darken(g, 3))
    g = c.get(x, 116)
    if g in ST:
        c.put(x, 116, darken(g, 1))
# 이끼·풀
moss(c, [(4, 100, 1), (88, 102, 2), (60, 97, 2)])
for (x, y, ch) in [(2, GY - 1, 'N'), (3, GY - 1, 'O'), (90, GY - 2, 'N'), (60, GY - 1, 'O')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

# 바깥 윤곽(재질 어두운 단): 돌·회벽만
outline(c, {ch: 'a' for ch in ST} | {k: 't' for k in 'tuvwxyz01234'}, x1=int(CX) - 1)
outline(c, {ch: 'Y' for ch in ST} | {k: 'J' for k in 'tuvwxyz01234'}, x0=int(CX))

walk = ['******', '******', '******', '******', '******', '******', 'XXXXXX', 'XXDXXX']
meta = {'name': '탑 풍차', 'massing': 'M30', 'material': 'stone',
        'refs': ['bd-house-mill1', 'bd-mpart-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('windmill', meta)
print('fails', fails, 'warns', warns)

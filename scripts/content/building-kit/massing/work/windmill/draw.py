"""windmill — 탑 풍차(덩어리 모형 M30). 낮은 팔각 돌 받침 위 원뿔대 흰 회벽 탑(작은 박힌 돌 점) + 나무 비늘 둥근 갓 +
갓 앞 굴대 머리에 + 자(세로·가로) 날개 넷. 날개 = 굵은 채(stock) + 바깥 테 + 가로살 + 그 사이 돛천 판(바람개비 방향으로
채 한쪽에 붙는다). 세로 날개는 3/4 시점이라 가로 날개보다 짧다. 아치 문 하나(받침을 뚫고 땅까지). 5×9 칸(80×144). 난수 없음."""
import math
import os
import sys
import importlib.util as _iu

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'dovecote'))
from towerlib import Canvas, pix, fill_walk, darken  # noqa: E402
from common import door, moss  # noqa: E402


def _load(name):
    sp = _iu.spec_from_file_location(name + '_wm', os.path.join(HERE, name + '.py'))
    m = _iu.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


DF = _load('domefix')
edgefix = _load('edgefix')

c = Canvas(5, 9)
W, H = 80, 144
GY = H - 1
CX = 40.0

# ---------------------------------------------------------------- 둥근 돌 받침(위에서 보이는 타원 턱 + 둥근 앞면)
BCY, BHW, BHD = 126.0, 30.0, 9.0      # 윗면 타원 중심 y, 반폭, 반깊이(3/4 로 눌림)
BX0, BX1 = int(CX - BHW), int(CX + BHW) - 1   # 10..69


def _s(x):
    px = (x + 0.5 - CX) / BHW
    return math.sqrt(max(0.0, 1 - px * px))


def oct_front(x):
    return BCY + BHD * _s(x)


def oct_back(x):
    return BCY - BHD * _s(x)


def face_tone(x):
    px = (x + 0.5 - CX) / BHW
    for lim, t in ((-0.85, 7), (-0.55, 9), (-0.2, 8), (0.2, 7), (0.5, 6), (0.78, 5)):
        if px < lim:
            return t
    return 4


GREY = ['U', 'W', 'Y', 'a', 'e', 'i', 'j', 'k', 'm', 'n', 'r']    # 어두움 → 밝음
# 받침 앞면 막돌: 줄 높이·돌 폭을 손으로 정한 표(작고 촘촘한 회색 돌, 2~5px)
COURSES = [4, 3, 4, 3, 4]
BW = [[5, 4, 6, 3, 5, 7, 4, 5, 6, 4, 5, 3, 6, 5, 4, 7, 5, 4, 6, 5],
      [3, 6, 5, 4, 7, 4, 5, 6, 3, 5, 4, 6, 5, 7, 4, 5, 3, 6, 4, 5],
      [6, 4, 5, 5, 3, 6, 4, 7, 5, 4, 6, 3, 5, 4, 6, 5, 7, 4, 5, 6],
      [4, 5, 7, 4, 5, 3, 6, 5, 4, 6, 5, 4, 7, 3, 5, 6, 4, 5, 6, 4],
      [5, 7, 3, 6, 4, 5, 5, 4, 6, 7, 3, 5, 4, 6, 5, 4, 6, 5, 3, 6]]
BTONE = '0102010201200101021020'     # 돌마다 밝기 보정(손 순서)


def course_stone(v, x):
    acc, ci = 0, 0
    while True:
        h = COURSES[ci % len(COURSES)]
        if v < acc + h:
            break
        acc += h
        ci += 1
    lv, h = v - acc, COURSES[ci % len(COURSES)]
    u, k = -[0, 3, 1, 4, 2][ci % 5], 0
    ws = BW[ci % len(BW)]
    while True:
        w = ws[k % len(ws)]
        if x < u + w:
            return ci, lv, h, x - u, w, k
        u += w
        k += 1


for x in range(BX0, BX1 + 1):
    ft = int(round(oct_front(x)))
    ybot = GY - int(0.25 * BHD * (1 - _s(x)))
    ft0 = face_tone(x)
    for y in range(ft, ybot + 1):
        v = y - ft
        ci, lv, h, lu, w, k = course_stone(v, x)
        base = ft0 + int(BTONE[(ci * 5 + k) % len(BTONE)]) - 1
        if lv == h - 1 or lu == w - 1:
            t = base - 3
        else:
            t = base + (1 if lv == 0 else 0) + (1 if lu == 0 else 0) - (1 if lv == h - 2 and h > 3 else 0)
        if y == ft:
            t = ft0 + 3              # 앞 모서리 갓돌 밝은 선
        elif y == ft + 1:
            t = ft0 - 2              # 갓돌 밑 그늘
        if y == ybot:
            t -= 2
        c.put(x, y, GREY[max(0, min(len(GREY) - 1, t))])

# 윗면 턱(판돌): 타원 고리 — 판돌 이음은 방사선, 가운데 한 줄 동심 이음
for x in range(BX0, BX1 + 1):
    yb, yf = int(round(oct_back(x))), int(round(oct_front(x)))
    for y in range(yb, yf):
        px = (x + 0.5 - CX) / BHW
        py = (y + 0.5 - BCY) / BHD
        t = 10 if px < -0.45 else (9 if px < 0.35 else 8)
        ang = math.atan2(py, px)
        seg = (ang + math.pi) / (2 * math.pi) * 22
        rr = math.hypot(px, py)
        if seg % 1 < 0.09 or abs(rr - 0.86) < 0.045:
            t -= 3
        elif seg % 1 < 0.2:
            t += 0 if t >= 10 else 1
        if y == yb:
            t -= 1
        c.put(x, y, GREY[max(0, min(10, t))])

# ---------------------------------------------------------------- 원뿔대 흰 회벽 탑
RB, RT = 22.0, 16.0
TOP, BOT, SAG = 40, 129, 6
PL = ['J', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '2', '3', '4', '5']   # 회벽 어두움 → 밝음


def rad(y):
    return RT + (RB - RT) * (y - TOP) / (BOT - TOP)


# 박힌 돌 점(손 무늬, 원통 둘레 u·높이 v 로 감긴다): o 돌, h 돌 윗빛, d 돌 밑 그늘
FLECK = [
    '..............................',
    '.hho..............hhho........',
    '.ood.......hh.....oood....h...',
    '...........od.............od..',
    '.....hhho.........ho..........',
    '.....oood....hho..od.......hho',
    '.............ood...........ood',
    'hh....................hho.....',
    'od......hhho..........ood.....',
    '........oood....hh............',
    '..hh............od.......hhh..',
    '..od.....................ood..',
    '..........hho.....hhho........',
    '.....h....ood.....oood........',
    '.....od.......................',
    '......................hh......',
    '..hhho........hh......od......',
    '..oood........od..............',
]


def plaster_tone(dx, r):
    f = dx / r
    for lim, t in ((-0.9, 8), (-0.6, 11), (-0.25, 10), (0.12, 9), (0.38, 8), (0.6, 7), (0.8, 6), (0.92, 5)):
        if f < lim:
            return t
    return 4


for x in range(0, W):
    for y in range(TOP - SAG, BOT + 1):
        r = rad(y)
        dx = x + 0.5 - CX
        if abs(dx) > r:
            continue
        cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
        if y > BOT - round(SAG * (1 - cosv)):
            continue
        t = plaster_tone(dx, r)
        u = int(math.asin(max(-1, min(1, dx / r))) * RB + 300)
        v = int(y - SAG * cosv) + 40
        m = FLECK[v % len(FLECK)][u % len(FLECK[0])]
        if m == 'o':
            t -= 2
        elif m == 'h':
            t -= 1
        elif m == 'd':
            t -= 3
        c.put(x, y, PL[max(0, min(len(PL) - 1, t))])

# 탑 밑동이 턱에 앉는 그늘 줄 + 탑이 턱 오른쪽에 지는 그림자
for x in range(0, W):
    r = RB
    dx = x + 0.5 - CX
    if abs(dx) > r:
        continue
    cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
    yb = BOT - round(SAG * (1 - cosv))
    c.put(x, yb, 'u' if dx < 0 else 't')
    g = c.get(x, yb + 1)
    if g in GREY:
        c.put(x, yb + 1, darken(g, 2))
for x in range(int(CX + 4), BX1 + 1):
    for y in range(int(round(oct_back(x))), int(round(oct_front(x)))):
        g = c.get(x, y)
        e = ((x + 0.5 - (CX + 12)) / 22.0) ** 2 + ((y + 0.5 - (BOT - 1)) / 5.0) ** 2
        if g in GREY and e < 1:
            c.put(x, y, darken(g, 2 if e < 0.55 else 1))

# 탑 둘레 돌림띠(회색 돌 2줄 — 원통을 따라 처진다)
for band_y in (106,):
    for x in range(0, W):
        r = rad(band_y) + 0.6
        dx = x + 0.5 - CX
        if abs(dx) > r:
            continue
        cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
        y = band_y + round(SAG * cosv)
        t = plaster_tone(dx, r)
        c.put(x, y - 1, PL[max(0, t - 4)])            # 띠 위 그늘(띠가 살짝 나온다)
        c.put(x, y, GREY[max(0, min(10, t - 1))])
        c.put(x, y + 1, GREY[max(0, min(10, t - 3))])

# ---------------------------------------------------------------- 창 둘(서로 다른 높이·크기) — 문 바로 위는 비운다
WIN_A = [   # 오른쪽 위(그늘 쪽) 좁은 창, 갓 아래
    '.kkkj.',
    'kζηηεY',
    'ηDEDεW',
    'ηF^Dδ.',
    'ηDDAδ.',
    'ηεεεδ.',
    'ηDABδ.',
    'ηAABδ.',
    'jmkkiY',
    '.YWWW.',
]
WIN_B = [   # 왼쪽 아래(빛 쪽) 창, 덧문 하나 열림
    '..mmmk...',
    '.mζηηεY..',
    'ηζDEDεWδ.',
    'ηηF^DδWε.',
    'ζηDDAδWε.',
    'ηηεεεδWδ.',
    'ζηDABδWε.',
    'ηηAABδWε.',
    'ζηABBδWδ.',
    '.rnmmkiY.',
    '..aYYWW..',
]
c.rows(48, 67, WIN_A)
c.rows(24, 92, WIN_B)

# ---------------------------------------------------------------- 문(아치 + 돌 테) — 받침을 뚫고 땅까지
DX0, DW, DY0 = 34, 12, 117
for (dx, dy, ch) in [(-2, 8, 'k'), (-2, 6, 'm'), (-2, 4, 'k'), (-1, 2, 'm'), (0, 0, 'n'), (1, -1, 'm'), (3, -2, 'n'),
                     (5, -2, 'm'), (7, -2, 'k'), (9, -1, 'j'), (10, 0, 'i'), (11, 2, 'e'), (12, 4, 'e'), (12, 6, 'a'),
                     (12, 8, 'e')]:
    for j in range(2):
        for k in range(2):
            c.put(DX0 + dx + k, DY0 + dy + j, ch if j == 0 and k == 0 else darken(ch, 1 + j + k))
for y in range(DY0 + 10, GY + 1):
    c.put(DX0 - 2, y, 'k' if y % 4 else 'j')
    c.put(DX0 - 1, y, 'i')
    c.put(DX0 + DW, y, 'a')
    c.put(DX0 + DW + 1, y, 'Y' if y % 4 else 'W')
door(c, DX0, DY0, DW, GY + 1 - DY0)
for x in range(DX0 - 2, DX0 + DW + 2):     # 문턱 돌
    c.put(x, GY, 'i' if x % 4 else 'e')
    c.put(x, GY - 1, 'n' if x < DX0 + 6 else 'k')

# ---------------------------------------------------------------- 둥근 갓(나무 비늘 돔, 윗면이 크게 보인다)
CAPW, CAPT, CAPB, ELL = 26.0, 9, 36, 8
DF.dome(c, CX, CAPT, CAPB, CAPW, ELL, start=2)
DF.dome_eave(c, CX, CAPB, CAPW, ELL)
# 갓이 탑 머리에 지는 그늘(처마 바로 밑 3줄)
for x in range(0, W):
    dx = x + 0.5 - CX
    if abs(dx) >= CAPW:
        continue
    ye = int(round(CAPB + ELL * math.sqrt(max(0, 1 - (dx / CAPW) ** 2))))
    for d, n in ((2, 3), (3, 2), (4, 1)):
        g = c.get(x, ye + d)
        if g in PL:
            c.put(x, ye + d, darken(g, n))

# ---------------------------------------------------------------- 날개 넷(+, 정지) — 갓 앞 굴대 머리
HX, HY = 40, 57
LV, LH = 31, 39            # 세로 날개는 3/4 로 눌려 짧다
LAT0, LATW = 7, 7          # 돛 판이 채 옆으로 붙는 시작(채에서 거리)·폭
# (방향, 돛 판이 붙는 쪽) — 바람개비처럼 돌아가는 방향으로 한쪽에만
ARMS = [((0, -1), (1, 0), LV, 0), ((1, 0), (0, 1), LH, 1), ((0, 1), (-1, 0), LV, 2), ((-1, 0), (0, -1), LH, 3)]
CLOTH = {0: ['L', 'L', 'σ'], 1: ['σ', 'L', 'ξ'], 2: ['σ', 'L', 'ξ'], 3: ['L', 'L', 'σ']}   # 판마다 (바탕, 볕, 그늘)
SLAT = 5
sail = {}
for (ax, ay), (sx, sy), L, k in ARMS:
    # 채(stock): 3px, 굴대에서 끝까지 — 볕 쪽 밝게
    for al in range(3, L + 1):
        for ac in (-1, 0, 1):
            x, y = HX + ax * al + sx * ac, HY + ay * al + sy * ac
            lit = (x - (HX + ax * al)) + (y - (HY + ay * al))  # 왼쪽·위가 볕
            ch = 'ζ' if lit < 0 else ('δ' if lit == 0 else 'γ')
            if al >= L - 1:
                ch = 'δ' if lit <= 0 else 'γ'
            sail[(x, y)] = ch
    # 돛 판: 채 옆 ac=2..LATW+1, al=LAT0..L
    for al in range(LAT0, L + 1):
        for ac in range(2, LATW + 2):
            x, y = HX + ax * al + sx * ac, HY + ay * al + sy * ac
            outer = ac == LATW + 1
            tip = al == L
            root = al == LAT0
            slat = (al - LAT0) % SLAT == 0
            base, hi, lo = CLOTH[k]
            if outer or tip or root:
                ch = 'δ' if (k in (0, 3)) else 'γ'
                if outer and slat:
                    ch = 'ε'
            elif slat:
                ch = 'ε' if k in (0, 3) else 'δ'
            else:
                ch = base
                # 판 안 명암: 살 바로 다음(볕 반대쪽)은 그늘, 바깥 테 옆은 볕
                after = (al - LAT0) % SLAT == 1
                if after and ay != 0:
                    ch = lo if ay < 0 else ch
                if (al - LAT0) % SLAT == SLAT - 1 and ay > 0:
                    ch = lo
                if ax != 0 and ac == 2:
                    ch = lo if sy < 0 else ch
                if ac == LATW and (sx > 0 or sy < 0):
                    ch = hi
                if ax != 0 and (al - LAT0) % SLAT == (1 if ax < 0 else SLAT - 1):
                    ch = lo
            sail[(x, y)] = ch
    # 돛 판과 채를 잇는 안쪽 테(채 쪽 ac=2 첫 줄은 살 색)
for (x, y), ch in sail.items():
    c.put(x, y, ch)
# 날개가 갓·탑에 지는 그늘(오른쪽 아래로 1~2px)
for (x, y) in list(sail):
    for (ox, oy, n) in ((1, 1, 2), (1, 2, 1), (2, 2, 1)):
        q = (x + ox, y + oy)
        if q in sail or not (0 <= q[0] < W and 0 <= q[1] < H):
            continue
        g = c.get(*q)
        if g != '.':
            c.put(q[0], q[1], darken(g, n))
# 굴대 머리(쇠 띠 두른 나무 보스) + 갓 속으로 들어가는 굴대 그림자
c.rows(HX - 5, HY - 5, [
    '...δηηδ...',
    '..δξσηεδ..',
    '.δσηYWηεγ.',
    'δηYjkiWεδγ',
    'ηξWknmaYδγ',
    'ηηWiraYWδγ',
    'δεYaiYWδγ-',
    '.δεWWWδγ-.',
    '..γδεδγ-..',
    '...-γγ-...',
])

# ---------------------------------------------------------------- 마감: 바깥 윤곽 = 재질 어두운 단
SIDE = ((1, 0), (-1, 0), (0, -1))
pts = []
for y in range(H - 1):
    for x in range(W):
        ch = c.get(x, y)
        if ch == '.':
            continue
        if not any(not (0 <= x + ax < W and 0 <= y + ay < H) or c.get(x + ax, y + ay) == '.' for ax, ay in SIDE):
            continue
        left = x < CX
        if ch in PL:
            pts.append((x, y, 'v' if left else 't'))
        elif ch in GREY:
            pts.append((x, y, 'e' if left else 'Y'))
        elif ch in ('3', '4', '2', '1', '0', 'z'):
            pts.append((x, y, 'ε'))
for x, y, ch in pts:
    c.put(x, y, ch)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))

# 이끼·풀(받침 밑 그늘진 모서리)
moss(c, [(13, 138, 2), (63, 139, 2)])
for (x, y, ch) in [(16, GY, 'N'), (17, GY, 'O'), (58, GY, 'N'), (28, GY, 'O')]:
    if c.get(x, y) != '.':
        c.put(x, y, ch)

walk = ['*****', '*****', '*****', '*****', '*****', '*****', '*****', 'XXXXX', 'XXDXX']
meta = {'name': '탑 풍차', 'massing': 'M30', 'material': 'stone',
        'refs': ['bd-house-mill1', 'bd-mpart-tower'], 'walk': fill_walk(c, walk)}
holes = sum(1 for y in range(1, H - 1) for x in range(1, W - 1) if c.get(x, y) == '.' and
            all(c.get(x + a, y + b) != '.' for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))))
print('  안쪽 투명 핀홀', holes)
fails, warns = c.save('windmill', meta)
print('fails', fails, 'warns', warns)

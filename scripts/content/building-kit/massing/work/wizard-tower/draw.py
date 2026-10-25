"""wizard-tower — 마법사 탑(덩어리 모형 C15), 7차 다시 그림.
버들항 청석(대성당 지붕 파랑·보라) 비늘 원뿔 세 단(단마다 은회색 처마 띠 + 아래 그늘 = 계단 고리) + 흰 돌 원통
(연보라 줄눈, 왼쪽 밝음 → 오른쪽 어둠) + 짙은 마법석 띠 둘(청록 룬 점) + 밑으로 벌어지는 짙은 돌 받침 + 서로 다른
빛나는 창(보라 첨두창 · 청록 둥근창 · 좁은 틈창 · 작은 아치창) + 한 칸 열(x 32..47) 안의 아치 문.
회전체(단면 반지름 표)를 깊이 버퍼로 찍는다 — 화소마다 (부위, 둘레각, 축 높이)를 알고 재질을 손 표로 고른다. 난수 없음.
4×11 칸(64×176)."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'dovecote'))
from towerlib import Canvas, fill_walk  # noqa: E402

c = Canvas(4, 11)
W, H = 64, 176
TCX = 38.0          # 축(화소 경계 37|38) — 문이 x 32..47 한 열 안에 들어간다
K = 0.32            # 깊이 → 화면 세로 눌림(원 둘레가 타원으로)

# ---------------------------------------------------------------- 단면 표: (부위, 축 y 위, 축 y 아래, 반지름 위, 반지름 아래)
SECTIONS = [
    ('roof1', 9.0, 32.0, 0.0, 9.5),
    ('fas1', 32.0, 34.0, 9.5, 9.5),
    ('roof2', 34.0, 49.0, 7.0, 14.5),
    ('fas2', 49.0, 51.0, 14.5, 14.5),
    ('roof3', 51.0, 65.0, 11.0, 20.5),
    ('fas3', 65.0, 67.5, 20.5, 20.5),
    ('shaft', 62.0, 140.0, 15.0, 15.0),
    ('bandA', 104.0, 107.0, 15.8, 15.8),
    ('bandB', 136.0, 140.0, 16.2, 16.2),
    ('flare', 140.0, 163.0, 16.0, 23.5),
    ('ledge', 163.0, 163.0, 23.0, 26.5),
    ('plinth', 163.0, 172.0, 26.5, 26.5),
]
ROOF_N = {'roof1': 13, 'roof2': 20, 'roof3': 28}       # 둘레 한 바퀴 비늘 수(단마다 일정 → 위로 좁아진다)

buf = {}            # (x, y) → (z, 부위, θ, 축 y, 반지름)
for name, y0, y1, r0, r1 in SECTIONS:
    disc = y1 == y0
    steps = int((r1 - r0) * 6) + 1 if disc else int((y1 - y0) * 6) + 1
    for i in range(steps + 1):
        if disc:
            v, r = y0, r0 + (r1 - r0) * i / steps
        else:
            v = y0 + (y1 - y0) * i / steps
            r = r0 + (r1 - r0) * (v - y0) / (y1 - y0)
        nth = max(8, int(r * 2 * math.pi * 3))
        for j in range(nth):
            th = -math.pi + 2 * math.pi * (j + 0.5) / nth
            sx = TCX + r * math.sin(th)
            z = r * math.cos(th)
            sy = v + K * z
            px, py = int(math.floor(sx)), int(math.floor(sy))
            if not (0 <= px < W and 0 <= py < H):
                continue
            key = (px, py)
            if key not in buf or z > buf[key][0] + 1e-9:
                buf[key] = (z, name, th, v, r)


def lvl(th, n=6):
    """둘레각 → 명암 단(0 밝음 … 5 어둠). 빛 왼쪽 위. 왼끝은 한 단 내려 둥글게."""
    f = math.sin(th)
    if f < -0.9:
        return 1
    if f < -0.5:
        return 0
    if f < -0.12:
        return 1
    if f < 0.22:
        return 2
    if f < 0.52:
        return 3
    if f < 0.82:
        return 4
    return 5


# ---------------------------------------------------------------- 재질 표(손으로 씀)
# 지붕 비늘: 단마다 (바탕, 빛, 아래 그늘)
ROOF = [('G', 'H', 'E'), ('G', 'H', 'B'), ('F', 'H', 'B'), ('E', 'G', 'B'), ('E', 'F', 'C'), ('B', 'E', 'A')]
ROOF_VAR = '0010210001200101002100'          # 비늘마다 한 단 어둡게(0·1·2)
# 흰 돌: 단마다 (바탕 후보 셋, 줄눈)
STONE = [('rnH', 'j'), ('nrI', 'j'), ('mnk', 'i'), ('kmj', 'h'), ('jik', 'e'), ('ige', 'a')]
COURSES = [4, 3, 4, 4, 3, 4, 3, 4, 4, 3]
SW = [5, 7, 4, 6, 8, 5, 4, 7, 6, 5, 9, 4, 6, 5, 7]
FACE_PICK = '0101100102101001101010110012'
# 짙은 마법석(받침·띠): 단마다 (바탕, 밝은 윗턱, 줄눈)
DARK = [('e', 'd', 'X'), ('e', 'd', 'X'), ('a', 'e', 'U'), ('X', 'a', 'U'), ('W', 'X', 'T'), ('U', 'W', 'T')]
FL_COURSES = [5, 6, 5, 4, 5]
FL_SW = [8, 6, 9, 7, 10, 6, 8, 7]
# 은회색 처마 띠
TRIM = ['r', 'n', 'm', 'k', 'i', 'e']


def stone_px(th, v, r, top, courses, widths, start=0):
    """(줄 번호, 줄 안 행, 줄 높이, 돌 번호, 돌 안 위치, 돌 폭)"""
    vv = v - top
    k = start
    acc = 0.0
    while True:
        hgt = courses[k % len(courses)]
        if acc + hgt > vv:
            break
        acc += hgt
        k += 1
    row = int(vv - acc)
    s = (th + math.pi) * r + (k * 11) % 9
    j = (k * 5) % len(widths)
    a2 = 0.0
    n = 0
    while a2 + widths[j % len(widths)] <= s:
        a2 += widths[j % len(widths)]
        j += 1
        n += 1
    return k, row, courses[k % len(courses)], n, s - a2, widths[j % len(widths)]


def shade(name, th, v, r):
    L = lvl(th)
    if name.startswith('roof'):
        t0 = dict((s[0], s[1]) for s in SECTIONS)[name]
        N = ROOF_N[name]
        rowf = (v - t0) / 3.0
        row = int(rowf)
        fr = rowf - row
        u = (th + math.pi) / (2 * math.pi) * N + (0.5 if row % 2 else 0.0)
        ui = int(math.floor(u))
        fu = u - ui
        LL = min(5, L + (1 if ROOF_VAR[(ui * 3 + row * 7) % len(ROOF_VAR)] == '2' else 0))
        face, hi, edge = ROOF[LL]
        if fr >= 0.67:
            return face if (0.38 <= fu <= 0.62 and L <= 3) else edge
        if fr < 0.34 and 0.2 <= fu <= 0.5 and LL <= 2:
            return hi
        if fu < 0.12 and L >= 3:
            return edge
        return face
    if name.startswith('fas'):
        y0 = dict((s[0], s[1]) for s in SECTIONS)[name]
        rr = v - y0
        t = TRIM[min(5, L + (0 if rr < 0.8 else (1 if rr < 1.7 else 2)))]
        return t
    if name == 'shaft':
        k, row, hgt, n, su, w = stone_px(th, v, r, 62.0, COURSES, SW)
        faces, joint = STONE[L]
        if row == hgt - 1 or su < 1.0:
            return joint
        f = faces[int(FACE_PICK[(n + k * 3) % len(FACE_PICK)])]
        if row == 0 and L <= 3 and su < 3.0:
            return STONE[max(0, L - 1)][0][0]
        return f
    if name in ('bandA', 'bandB'):
        y0 = dict((s[0], s[1]) for s in SECTIONS)[name]
        rr = v - y0
        base, lit, jnt = DARK[L]
        if rr < 0.9:
            return lit if L < 4 else base
        if rr > (y0 and (2.1 if name == 'bandA' else 3.1)):
            return jnt
        return base
    if name == 'flare':
        k, row, hgt, n, su, w = stone_px(th, v, r, 140.0, FL_COURSES, FL_SW, start=1)
        LL = max(0, L - 1) if v < 152 else L        # 위로 기운 면은 하늘을 받아 한 단 밝다
        base, lit, jnt = DARK[min(5, LL + (1 if (n + k) % 4 == 3 else 0))]
        if row == hgt - 1 or su < 1.0:
            return jnt
        if row == 0:
            return lit
        return base
    if name == 'ledge':
        # 받침 둘레 윗면(걷는 돌 고리): 밝은 회색 판석, 안쪽(원통 쪽) 끝은 그늘
        if r < 24.2:
            return 'a' if L < 3 else 'X'
        s_ = (th + math.pi) * 25.0
        return ('j' if L < 3 else 'i') if int(s_ / 7) % 5 else 'g'
    if name == 'plinth':
        k, row, hgt, n, su, w = stone_px(th, v, r, 163.0, [3, 4, 4], [11, 8, 13, 9, 12, 10], start=0)
        faces, joint = STONE[min(5, L + 2)]
        if row == hgt - 1 or su < 1.0:
            return joint
        if row == 0 and k == 0:
            return STONE[min(5, L + 1)][0][0]
        return faces[n % 2]
    return 'a'


meta_px = {}
for (x, y), (z, name, th, v, r) in buf.items():
    c.put(x, y, shade(name, th, v, r))
    meta_px[(x, y)] = (name, th, v)
# 땅에 닿는 줄: 받침 맨 아래 두 화소 줄은 짙은 기초돌
for x in range(W):
    for y in (H - 2, H - 1):
        if meta_px.get((x, y), ('',))[0] == 'plinth':
            c.put(x, y, ('X' if (x // 6) % 3 else 'a') if y == H - 2 else ('U' if x < TCX + 8 else 'T'))

# ---------------------------------------------------------------- 처마 아래 그늘(빛 왼쪽 위 → 오른쪽으로 조금 더 길게)
DARKER = {'H': 'G', 'I': 'H', 'G': 'E', 'F': 'E', 'E': 'B', 'B': 'C', 'C': 'A', 'D': 'A',
          'r': 'k', 'n': 'j', 'm': 'i', 'k': 'h', 'j': 'g', 'i': 'e', 'h': 'e', 'g': 'a', 'e': 'a', 'd': 'a',
          'a': 'X', 'X': 'U', 'W': 'U', 'U': 'T', 'T': 'T', 'Y': 'W'}
LOWER = {'fas1': ('roof2',), 'fas2': ('roof3',), 'fas3': ('shaft', 'bandA')}
for x in range(W):
    for fas, under in LOWER.items():
        ys = [y for y in range(H) if meta_px.get((x, y), ('',))[0] == fas]
        if not ys:
            continue
        yb = max(ys)
        th = meta_px[(x, yb)][1]
        depth = 3 + (1 if math.sin(th) > 0.3 else 0) + (1 if fas == 'fas3' else 0)
        for d in range(1, depth + 1):
            p = meta_px.get((x, yb + d))
            if not p or p[0] not in under:
                continue
            ch = c.get(x, yb + d)
            ch = DARKER.get(ch, ch)
            if d <= 2:
                ch = DARKER.get(ch, ch)
            c.put(x, yb + d, ch)

# 원통이 받침 윗면에 지는 그늘은 받침이 짙어 생략 — 대신 받침 오른쪽 아래에 더 짙은 단은 shade 가 낸다.


def sag_at(x):
    dx = x + 0.5 - TCX
    return K * 15.0 * math.sqrt(max(0.0, 1 - (dx / 15.0) ** 2))


def put_rows(x, y, rows):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                c.put(x + i, y + j, ch)


def on_shaft(x, y0):
    """원통 앞면 곡선을 따라 창을 붙일 자리(앞 가운데 윗줄 y0 기준)."""
    return int(round(y0 - (K * 15.0 - sag_at(x))))


# ---------------------------------------------------------------- 빛나는 창(넷 다 다르게)
# 위층 가운데: 보라 첨두창(밝은 돌 문설 · 어두운 홈 · 가운데 흰 빛이 아래로 보랏빛, 가로살 하나)
LANCET = ['.....r.....',
          '....naX....',
          '...naHXg...',
          '..naIsGXg..',
          '..naHsGEXg.',
          '.naHIsIGEXg',
          '.naHIssHGXg',
          '.naHIsIHGXg',
          '.naGHIIHEXg',
          '.naXaaaaXXg',
          '.naGHIHGEXg',
          '.naGHIHGFXg',
          '.naGHHGFEXg',
          '.naFGHGFBXg',
          '.naFGGFEBXg',
          '.nrnmmkkjie',
          '..aXXUUUTT.']
put_rows(int(TCX) - 6, on_shaft(int(TCX), 82), LANCET)
# 위층 왼쪽: 좁은 청록 틈창(곡면 가장자리 쪽이라 폭 4)
SLIT = ['.nr.', 'na>X', 'n^sX', 'n^>X', 'ns^X', 'n^>X', 'n^^X', 'n>>X', 'rkje', '.aX.']
put_rows(int(TCX) - 13, on_shaft(int(TCX) - 11, 88), SLIT)
# 위층 오른쪽(그늘 쪽): 둥근 머리 작은 보라창
SQ = ['.aXU.', 'aEHBU', 'aGsEU', 'aEHBU', 'aBGBU', 'aBEBU', 'hgeaX']
put_rows(int(TCX) + 8, on_shaft(int(TCX) + 10, 90), SQ)
# 아래층 가운데 오른쪽: 청록 둥근창(빛나는 고리 + 흰 별빛 가운데)
OCULUS = ['..aaXXX..',
          '.a>^^^>X.',
          'a>^^s^^>X',
          'a^^sss^^X',
          'a^ssIss^X',
          'a^^sss^^X',
          'a>^^s^^>X',
          '.a>^^^>X.',
          '..XXUUU..']
put_rows(int(TCX) - 1, on_shaft(int(TCX) + 3, 119), OCULUS)
# 아래층 왼쪽: 작은 보라 아치창
SMALL = ['.naX.', 'naHXg', 'aIsGX', 'aHsGX', 'aHIEX', 'aGHEX', 'aGFBX', 'nmkie']
put_rows(int(TCX) - 12, on_shaft(int(TCX) - 10, 121), SMALL)

# ---------------------------------------------------------------- 띠 위 룬(청록 점 — 글자 아님, 불규칙 간격)
for (x, yb, ch) in ((int(TCX) - 9, 104, '^'), (int(TCX) - 3, 104, '>'), (int(TCX) + 5, 104, '^'), (int(TCX) + 11, 104, '>'),
                    (int(TCX) - 12, 137, '>'), (int(TCX) - 5, 137, '^'), (int(TCX) + 3, 137, '^'), (int(TCX) + 9, 137, '>')):
    y = yb + 1 + int(round(sag_at(x) + (0.8 if yb == 137 else 0.4)))
    if c.get(x, y) not in '.':
        c.put(x, y, ch)

# ---------------------------------------------------------------- 아치 문(x 32..46 안, 문짝 34..44)
DX0, DX1 = 34, 44                  # 문짝(포함)
DTOP, DBOT = 148, 170              # 아치 꼭대기 · 문지방
# 짙은 마법석 홍예(쐐기돌 + 청록 이맛돌)
ARCH = [(-2, 6), (-2, 4), (-2, 2), (-1, 0), (1, -2), (3, -3), (5, -3), (7, -2), (9, 0), (10, 2), (10, 4), (10, 6)]
for (dx, dy) in ARCH:
    for j in range(2):
        for k in range(2):
            lit = dx < 4
            ch = ('e' if lit else 'a') if j == 0 else ('a' if lit else 'X')
            if k == 1 and j == 1:
                ch = 'U'
            c.put(DX0 + dx, DTOP + dy + j, ch)
c.put(DX0 + 4, DTOP - 4, 'e')
c.put(DX0 + 5, DTOP - 4, 'a')
c.put(DX0 + 4, DTOP - 3, '^')
c.put(DX0 + 5, DTOP - 3, '>')
# 문설 기둥 돌
for y in range(DTOP + 8, DBOT + 1):
    c.put(DX0 - 2, y, 'e' if (y - DTOP) % 4 else 'a')
    c.put(DX0 - 1, y, 'X')
    c.put(DX1 + 1, y, 'U')
    c.put(DX1 + 2, y, 'X' if (y - DTOP) % 4 else 'W')
# 문짝: 짙은 나무 널 + 쇠띠 + 손잡이, 아치로 깎은 윗줄
DW = DX1 - DX0 + 1
for j in range(DBOT - DTOP):
    cut = [3, 2, 1, 1, 0][j] if j < 5 else 0
    for i in range(DW):
        if i < cut or i >= DW - cut:
            ch = 'T'                          # 아치 안 깊은 그늘
        elif j == 0 or i == cut or i == DW - cut - 1:
            ch = '_'
        elif i % 3 == 0:
            ch = '-'
        elif i % 3 == 1:
            ch = 'ζ' if j < 9 else 'ε'
        else:
            ch = 'ε' if i < DW // 2 else 'δ'
        c.put(DX0 + i, DTOP + j, ch)
for yy in (DTOP + 7, DBOT - 6):
    for i in range(1, DW - 1):
        c.put(DX0 + i, yy, 'X' if i % 2 else 'a')
    for i in (2, 5, 8):
        c.put(DX0 + i, yy, 'k')
c.put(DX0 + 7, DTOP + 12, 'K')
c.put(DX0 + 7, DTOP + 13, 'τ')
for i in range(-2, DW + 3):
    c.put(DX0 + i, DBOT, 'i' if i % 3 else 'k')
# 문 앞 디딤돌(받침 앞면에서 땅으로)
for y in range(DBOT + 1, H):
    for i in range(-2, DW + 3):
        x = DX0 + i
        if y == DBOT + 1:
            ch = 'm' if i < DW // 2 else 'k'
        elif y == H - 1:
            ch = 'U'
        else:
            ch = 'j' if (i + y) % 7 else 'i'
            if i in (-2, DW + 2):
                ch = 'a'
        c.put(x, y, ch)
# 문 옆 작은 등(쇠 받침 + 청록 불)
put_rows(DX1 + 3, DTOP + 4, ['XU.', '.a.', 'e^a', 'a>U', '.U.'])

# ---------------------------------------------------------------- 받침 아래 왼쪽 이끼(손으로 고른 자리)
for (x, y, ch) in ((17, 163, 'N'), (18, 163, 'O'), (19, 162, 'N'), (18, 164, 'M'), (22, 160, 'O'), (23, 160, 'N'),
                   (21, 161, 'M'), (27, 159, 'N'), (52, 162, 'M'), (53, 163, 'M')):
    if meta_px.get((x, y), ('',))[0] in ('flare', 'ledge'):
        c.put(x, y, ch)

# ---------------------------------------------------------------- 꼭대기 금별 깃대(원뿔 꼭짓점까지 내려와 붙는다)
put_rows(int(TCX) - 3, 0, ['...K...', '..KLK..', '.KLsLτ.', '..Kτ...', '...τ...', '...Y...', '...a...', '...Y...',
                           '...a...', '...Y...', '..EGB..'])

# ---------------------------------------------------------------- 바깥 윤곽: 밝은 테두리 화소 → 재질 어두운 단, 안쪽 투명 메움
BLUE = set('ABCDEFGHI')
EDGE_OF = {}
for ch in 'HIGF':
    EDGE_OF[ch] = 'E'
for ch in 'rnmkjihgsd':
    EDGE_OF[ch] = 'e'
for ch in 'KL':
    EDGE_OF[ch] = 'τ'


def opaque(x, y):
    return 0 <= x < W and 0 <= y < H and c.get(x, y) != '.'


todo = []
for y in range(H - 1):
    for x in range(W):
        ch = c.get(x, y)
        if ch == '.' or ch not in EDGE_OF:
            continue
        if any(not opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            right = x + 0.5 > TCX
            e = EDGE_OF[ch]
            if right and e == 'E':
                e = 'B'
            if right and e == 'e':
                e = 'a'
            todo.append((x, y, e))
for x, y, ch in todo:
    c.put(x, y, ch)
holes = 0
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if c.get(x, y) == '.' and all(opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.put(x, y, 'B' if y < 92 else 'U')
            holes += 1
print('  안쪽 투명 메움', holes, '· 윤곽', len(todo))

walk = ['****', '****', '****', '****', '****', '****', '****', '****', '****', 'XXDX', 'XXDX']
meta = {'name': '마법사 탑', 'massing': 'C15', 'material': 'stone',
        'refs': ['bd-mpart-tower', 'bd-house-cathedral'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('wizard-tower', meta)
print('fails', fails, 'warns', warns)

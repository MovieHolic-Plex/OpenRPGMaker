"""l-farmhouse — ㄱ자 농가(덩어리 모형 7). 9×6 칸(144×96). 2026-10-25 재도전(argon #15 MAJOR 고침).
긴 1층 본채(정면과 나란한 용마루, 양 끝 모임) + 오른쪽 앞으로 나온 박공 정면 날개(문 하나).
날개 지붕은 ㉚ 규약(버들항 h124_0·h122_0): 꼭짓점이 본채 용마루와 같은 높이에서 시작해 골(물받이) 두 줄로 본채 앞 사면을 가르고
처마까지 세로 열 기와(왼 밝음·오른 그늘)로 내려온다. 박공 삼각벽은 그 지붕 아래 남쪽에 앉는다.
왼쪽 본채 벽은 이 집만의 것: 아래 막돌 허리벽 + 위 반목조, 창 셋이 모두 다르고, 벽 앞 장작더미."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from kit import Canvas  # noqa: E402

W, H = 144, 96
c = Canvas(9, 6)

# 손 표(이 집만의 것 — 다른 건물과 같은 8×8 조각이 나오지 않게)
T_FRONT = ['0102000400100020', '200010006000100', '00100400002001003', '1000002010010004',  # 줄 길이가 달라
           '004010000060002', '00020001000020012', '6000040010000100', '010000020040100']  # 같은 칸 반복이 없다
T_HL = ['01200', '30102', '00410', '20003', '10200', '04001']
T_HR = ['01230', '20104', '00302', '31000', '02013']
T_WL = ['0130205', '2004010', '0301300', '1020402', '0500103', '3010020', '0204001', '1003020',
        '0020610', '4100302']
T_WR = ['01204', '30010', '00521', '20103', '10032', '02400', '30012', '00201']
DOTS = [  # 회벽 점묘(15×12, 손)
    '...y.....1.....',
    '.z.....y....2..',
    '......1....y...',
    '..2.y......z..y',
    'y.......z......',
    '....1......1.z.',
    '.y.....2.......',
    '...z.y....y..1.',
    '1.........z....',
    '.....z.1.....y.',
    '..y.......2....',
    '.....y....y..z.',
]
FOUND = 'imaiimiaimmiiaim'

# ---------------------------------------------------------------- 본채 지붕(모임, 꼭대기 y=10, 처마 y=40)
R_Y, E_Y = 10, 40
lx, rx, out_l, out_r = kit.hip_roof(c, 0, W - 1, R_Y, E_Y, 30, 122, T_FRONT, T_HL, T_HR)

# 굴뚝(본채 앞 사면, 용마루 가까이) — 머리 윗면(갓돌 고리 + 연기 구멍), 몸 막돌, 밑동은 지붕 경사 따라
CH_X, CH_TOP = 46, 1
CHIM = ['.WkkkkW.', 'WkTTTTkW', 'WjTUUTjW', 'XhhhhhhX', 'YVVcVVVY',
        '9JJ$9*J6', '9$9JJJ96', '9J*J9$J6', '99$JJ9*6', '9JJ9$JJ6', '9*J$9JJ6', '9$9JJ*96', '9JJ$9J$6', '9J9*J$96', '9$JJ9*J6', '9J$9JJ$6']
for j, row in enumerate(CHIM):
    for i, ch in enumerate(row):
        if ch == '.' or (j >= 13 and i >= 8 - (j - 12) * 2):     # 밑동: 오른쪽이 지붕에 먼저 묻힌다(경사)
            continue
        c.put(CH_X + i, CH_TOP + j, ch)
for y in range(6, 19):                          # 지붕에 지는 굴뚝 그늘(오른쪽 두 화소)
    for x in (CH_X + 8, CH_X + 9):
        g = c.get(x, y)
        if g != '.':
            c.put(x, y, kit.DARKER.get(g, g))

# ---------------------------------------------------------------- 본채 벽(물러난 1층) — 땅선 y=79
MX0, MX1 = 2, 89
WY0 = E_Y + 3                                    # 43
kit.eave_shadow(c, MX0, MX1, WY0)
kit.plaster(c, MX0, WY0 + 5, MX1, 66, DOTS, ox=2, oy=1)
# 막돌 허리벽(y 67..77): 크기 다른 돌이 엇물린다 — 줄마다 손 순서
STONE_ROWS = [
    ('xvwvxwvuxvwxvvuwxvwvxuvwxwvvxuwvxvwuvxwvvxuwvxvwvuxvwxvvuwxvwvxuvwxwvvxuwvxvwuvxwvvxuwv', [5, 4, 6, 3, 5, 7, 4, 5, 6, 3, 4, 6, 5, 4, 7, 3, 5, 6, 4, 5]),
    ('wvxuvwvxwvuxvwvxwuvxvwxvuwvxvwuxvwvxwvuxvwvxwuvxvwxvuwvxvwuxvwvxwvuxvwvxwuvxvwxvuwvxvw', [4, 6, 3, 5, 7, 4, 5, 3, 6, 4, 5, 7, 3, 4, 6, 5, 4, 6, 3, 5]),
    ('vxwvuxwvxvwuvxwvxvuwxvwvxuwvxvwxuvwxvvwxuvwxvwvuxwvxvwuvxwvxvuwxvwvxuwvxvwxuvwxvvwxuvw', [6, 3, 5, 4, 6, 5, 3, 7, 4, 5, 6, 3, 5, 4, 6, 4, 5, 3, 6, 5]),
]
LT = {'v': 'x', 'w': 'z', 'x': 'p', 'u': 'w'}
SD = {'v': 't', 'w': 'v', 'x': 'v', 'u': 't'}
y = 67
for k, (faces, widths) in enumerate(STONE_ROWS):
    hgt = (4, 3, 4)[k]
    x = MX0 - (k * 2) % 4
    n = 0
    while x <= MX1:
        sw = widths[n % len(widths)]
        f = faces[n % len(faces)]
        for j in range(hgt):
            for i in range(sw):
                px, py = x + i, y + j
                if px < MX0 or px > MX1:
                    continue
                if i == sw - 1 or j == hgt - 1:
                    ch = 'C' if (i == sw - 1 and j == hgt - 1) else 'J'
                elif i == 0 and j == 0 and n % 3 != 1:
                    ch = LT[f]
                elif j == hgt - 2 and i == sw - 2 and n % 4 == 2:
                    ch = SD[f]
                else:
                    ch = f
                c.put(px, py, ch)
        x += sw
        n += 1
    y += hgt
# 허리벽 윗돌(갓돌 띠) — 빛 받는 윗면
for x in range(MX0, MX1 + 1):
    c.put(x, 66, 'p' if x % 6 else 'z')
    c.put(x, 65, 'y' if x % 9 else 'x')
# 반목조: 기둥 · 보 · 가새(모두 보에서 보로)
for px, g in ((MX0, 0), (25, 1), (50, 2), (73, 3)):
    kit.post(c, px, WY0 + 2, 64, grain=g)
kit.beam(c, MX0, MX1, WY0 + 4, grain=3)
kit.brace(c, 5, 63, 12, 50)
kit.brace(c, 28, 50, 33, 63)
kit.brace(c, 76, 63, 80, 56)
kit.brace(c, 80, 56, 84, 50)


def window(x, y, w, h, kind):
    """창 셋이 다 다르게: kind 0 덧문 두 짝 · 1 꽃상자 작은 네모 · 2 넓은 세 칸 창 + 차양 판."""
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) or j in (0, h - 1):
                ch = 'η' if (i == 0 or j == 0) else 'β'
            else:
                ch = 'E' if j == 1 else ('D' if j < h // 2 else ('B' if j < h - 2 else 'A'))
            c.put(x + i, y + j, ch)
    if kind == 2:
        for j in range(1, h - 1):
            c.put(x + w // 3, y + j, 'ε')
            c.put(x + 2 * w // 3, y + j, 'ε')
    else:
        for j in range(1, h - 1):
            c.put(x + w // 2, y + j, 'ε')
        for i in range(1, w - 1):
            c.put(x + i, y + h // 2, 'ε')
    c.put(x + 1, y + 1, 'H')
    c.put(x + 2, y + 1, '^')
    c.put(x + 1, y + 2, '^')
    c.put(x + w - 3, y + h // 2 + 1, 'F')
    if kind == 0:   # 덧문(세로 널, 아래 걸쇠)
        for side, xx in ((0, x - 4), (1, x + w)):
            for j in range(h):
                for i in range(4):
                    ch = 'ε' if i in (1, 2) else ('η' if i == 0 else 'β')
                    if j in (2, h - 3):
                        ch = 'δ'
                    c.put(xx + i, y + j, ch)
        for i in range(-4, w + 4):
            c.put(x + i, y + h, 'm' if i < w // 2 else 'h')
            c.put(x + i, y + h + 1, 'Y')
    elif kind == 1:  # 꽃상자
        fl = 'NκMLNOκM'
        for i in range(w):
            c.put(x + i, y + h - 1, fl[i % len(fl)])
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'η')
            c.put(x + i, y + h + 1, 'δ' if i % 3 else 'ζ')
            c.put(x + i, y + h + 2, '-')
    else:            # 차양 판(창 위 작은 널 지붕: 윗면이 보인다)
        for i in range(-2, w + 2):
            c.put(x + i, y - 3, 'ξ' if i % 3 else 'σ')
            c.put(x + i, y - 2, 'η' if i % 4 else 'ζ')
            c.put(x + i, y - 1, '-')
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'm' if i % 5 else 'h')


window(10, 51, 9, 11, 0)
window(36, 52, 9, 8, 1)
window(56, 52, 14, 10, 2)

# 장작더미(허리벽 앞): 통나무 마구리가 엇갈려 쌓인다 — 사이 틈은 짙은 그늘
LOG = ['.ηε.', 'ησξβ', 'ηξμβ', '.ββ.']
LOG2 = ['.ηε.', 'ηξσβ', 'ημξβ', '.ββ.']
PX, PY = 31, 68
for row, (n, off) in enumerate(((5, 0), (4, 2), (3, 4))):
    yy = PY + 8 - row * 4
    for k in range(n):
        x = PX + off + k * 4
        for j in range(4):
            for i in range(4):
                c.put(x + i, yy + j, '_' if j in (0, 3) and i in (0, 3) else '-')
for row, (n, off) in enumerate(((5, 0), (4, 2), (3, 4))):
    yy = PY + 8 - row * 4
    for k in range(n):
        lg = LOG if (k + row) % 2 else LOG2
        for j, r in enumerate(lg):
            for i, ch in enumerate(r):
                if ch != '.':
                    c.put(PX + off + k * 4 + i, yy + j, ch)
kit.foundation(c, MX0, MX1, 78, FOUND)

# ---------------------------------------------------------------- 날개 지붕(남북 박공, 꼭짓점 = 본채 용마루 높이)
CTR, HALF = 114.0, 29.0
W_EAVE = 62
inside, hw = kit.ns_roof(c, CTR, HALF, R_Y, E_Y, W_EAVE, T_WL, T_WR)
kit.valley(c, inside, 80, W - 1, R_Y + 1, E_Y)          # 골 두 줄(본채 앞 사면과 만남)
kit.rim(c, inside, 80, W - 1, E_Y + 1, W_EAVE)          # 날개 처마 세로 테
for x in range(84, W):                                   # 날개 처마 끝 마구리
    if inside(x, W_EAVE):
        c.put(x, W_EAVE + 1, '9' if x % 4 == 1 else '&')
        c.put(x, W_EAVE + 2, '_' if x % 5 else '-')
# 본채 용마루가 날개 꼭짓점에 닿는 자리: 마룻기와 끝 막음
c.put(int(CTR) - 2, R_Y, 'ζ')
c.put(int(CTR) + 1, R_Y, '-')

# 박공 삼각벽(날개 처마 위에 앉고, 지붕 사면이 그 위·옆으로 보인다)
GPEAK, GBASE, GHALF = 45, W_EAVE + 2, 23.0
kit.gable_wall(c, CTR, GPEAK, GBASE, GHALF, DOTS, ox=4, attic=(8, 7, 53))

# ---------------------------------------------------------------- 날개 벽(앞으로 나온 1층) — 땅선 y=95
NX0, NX1 = 87, 140
WY1 = GBASE + 1                                  # 65
kit.beam(c, NX0, NX1, WY1, grain=5)
kit.eave_shadow(c, NX0, NX1, WY1 + 3, rows=('-', 'c', 'f', 'l'))
kit.plaster(c, NX0, WY1 + 7, NX1, 93, DOTS, ox=9, oy=5)
DOOR_X, DOOR_W = 114, 12
for px, g in ((NX0, 2), (DOOR_X - 3, 0), (DOOR_X + DOOR_W, 1), (NX1 - 2, 3)):
    kit.post(c, px, WY1 + 3, 93, grain=g)
# 문(널 + 쇠띠 + 징 + 고리 손잡이), 위에 작은 처마 받침
for j in range(24):
    for i in range(DOOR_W):
        cut = (2, 1, 0)[j] if j < 3 else 0
        if i < cut or i >= DOOR_W - cut:
            continue
        if j == 0 or i == cut or i == DOOR_W - cut - 1:
            ch = '_'
        else:
            ch = 'ηεεβ'[(i - 1) % 4] if j < 12 else 'εεβδ'[(i - 1) % 4]
        c.put(DOOR_X + i, 70 + j, ch)
for yy in (74, 88):
    for i in range(1, DOOR_W - 1):
        c.put(DOOR_X + i, yy, 'X' if i % 2 else 'W')
    for i in (2, 5, 8):
        c.put(DOOR_X + i, yy, 'k')
c.put(DOOR_X + 8, 81, 'K')
c.put(DOOR_X + 8, 82, 'τ')
c.put(DOOR_X + 9, 82, 'K')
for i in range(DOOR_W):
    c.put(DOOR_X + i, 93, 'i' if i % 3 else 'm')
window(94, 75, 10, 10, 1)
window(129, 74, 7, 11, 2)
kit.foundation(c, NX0, NX1, 94, FOUND[3:] + FOUND[:3], step=(DOOR_X - 1, DOOR_X + DOOR_W))
# 날개 왼 모서리 기둥이 본채 벽 앞에 선다: 본채 벽 쪽에 짧은 그늘 한 줄
for yy in range(WY0, 78):
    g = c.get(NX0 - 1, yy)
    c.put(NX0 - 1, yy, {'3': 'y', 'y': 'x', 'z': 'x', '1': 'y', '2': 'y', 'η': 'ε', 'ε': 'β', 'p': 'x',
                        'x': 'v', 'v': 't', 'w': 'u'}.get(g, g))

# ---------------------------------------------------------------- 풍화·이끼(손 좌표)
for (x, yy, ch) in [(3, 77, 'N'), (4, 77, 'O'), (26, 77, 'N'), (52, 77, 'O'), (88, 93, 'N'), (89, 93, 'O'),
                    (138, 93, 'N'), (17, 58, 'z'), (45, 57, 'y'), (66, 63, 'z'), (99, 90, 'y'), (134, 89, 'z')]:
    c.put(x, yy, ch)
for (x, yy, shape) in [(6, 37, ['.OP.', 'NOON']), (62, 36, ['OP', 'NO']), (124, 58, ['.P', 'ON'])]:
    for j, row in enumerate(shape):
        for i, ch in enumerate(row):
            if ch != '.' and c.get(x + i, yy + j) != '.':
                c.put(x + i, yy + j, ch)

# ---------------------------------------------------------------- 마감: 핀홀 · 바깥 윤곽(재질 어두운 단)
TOUCH = [(66, 21), (84, 21), (75, 36)]
# 손 낱장 손질: 같은 8×8 칸이 건물 안에서 되풀이되지 않게 기와 몇 장을 묵히거나 이 빠지게(손 좌표)
for (x, yy) in TOUCH:
    g = c.get(x, yy)
    c.put(x, yy, kit.DARKER.get(g, g))
    g = c.get(x + 1, yy)
    c.put(x + 1, yy, kit.DARKER.get(g, g))

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_lf', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))
print('  안쪽 투명', len(kit.interior_holes(c)))

walk = []
for cy in range(6):
    r = ''
    for cx in range(9):
        op = any(c.g[yy][xx] != '.' for yy in range(cy * 16, cy * 16 + 16) for xx in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
            continue
        wing = cx >= 6 or (cx == 5 and cy >= 4)
        if cx == 7 and cy in (4, 5):
            r += 'D'
        elif wing:
            r += 'X' if cy >= 4 else '*'
        else:
            r += 'X' if cy >= 3 else '*'
    walk.append(r)
print('\n'.join(walk))
meta = {'name': 'ㄱ자 농가', 'massing': '7', 'material': 'plaster',
        'refs': ['bd-house-h124_0', 'bd-house-h122_0'], 'walk': walk}
fails, warns = c.save('l-farmhouse', meta)
print('fails', fails, 'warns', warns)

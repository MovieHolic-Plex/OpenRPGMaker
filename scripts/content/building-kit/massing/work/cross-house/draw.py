"""cross-house — 교차 박공 십자형 집(덩어리 모형 18). 9×8 칸(144×128). 2026-10-25 재도전(argon #06 MAJOR 고침).
정면과 나란한 본채(양 끝 모임)를 남북으로 긴 박공 날개가 가로지른다(십자 + 평면):
- 날개 북쪽 팔: 본채 용마루 뒤로 지붕이 계속 이어져 화면 위로 솟고(왼 밝은 세로 열 · 오른 그늘 세로 열) 꼭짓점에서 닫힌다.
- 본채 앞 사면 위: 날개 사면이 양쪽 골(물받이) 두 줄로 본채 지붕을 가르고 처마까지 내려온다.
- 날개 남쪽 팔: 앞으로 나온 박공 정면(㉚ 규약 — 지붕 사면이 삼각벽 위·옆으로 물러나 보인다), 문 하나.
그리기 도우미는 이 폴더의 kit.py(손 표는 이 파일 것 — 다른 건물과 같은 8×8 조각이 나오지 않게)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from kit import Canvas  # noqa: E402

W, H = 144, 128
c = Canvas(9, 8)

T_FRONT = ['10002001000400102', '002000060010020', '01001000020000010', '400002010010002',  # 줄마다 길이가 달라
           '00100000400020001', '2001000100000106', '00004020001001003', '020001000002000', '1000600010002000']  # 같은 칸 반복이 없다
T_HL = ['10302', '02010', '30040', '00201', '41003', '00130']
T_HR = ['20130', '01002', '30210', '00104', '12003']
T_WL = ['1030020', '0201403', '3000105', '0410200', '2003010', '0100302', '5020041', '0301000',
        '1002603', '0040120', '3100002']
T_WR = ['20103', '01420', '30012', '02301', '10024', '43100', '00213', '21030', '03102']
DOTS = [  # 회벽 점묘(13×14, 손)
    '..1.....y....',
    'y......2...z.',
    '....z.......1',
    '.2.....y.....',
    '.......1...y.',
    'z..y.........',
    '.....2....z..',
    '..........1..',
    '.y...z.......',
    '.....y...2..y',
    '1..2.........',
    '......z...y..',
    '..y.......1..',
    '.......y.....',
]
FOUND = 'miaimmiiamiima'

# ---------------------------------------------------------------- 본채 지붕(모임, 용마루 y=30, 처마 y=64)
R_Y, E_Y = 30, 64
kit.hip_roof(c, 0, W - 1, R_Y, E_Y, 34, 109, T_FRONT, T_HL, T_HR)

# 굴뚝(본채 앞 사면 오른쪽, 용마루 가까이) — 갓돌 고리 + 연기 구멍 윗면, 막돌 몸, 밑동은 지붕 경사 따라
CH_X, CH_TOP = 98, 19
CHIM = ['.XjjjjX.', 'XjTTTTkX', 'XhTUUTkX', 'YiiiiiiY', 'UVVVVVVU',
        '9*$J9J*6', '9J9*$J96', '9$*J9*$6', '99J$*9J6', '9*J9$J*6', '9$J*9J$6', '9J9$*J96', '9*$J9*$6', '9$9J*$96', '9J*$9$J6']
for j, row in enumerate(CHIM):
    for i, ch in enumerate(row):
        if ch == '.' or (j >= 12 and i >= 8 - (j - 11) * 2):
            continue
        c.put(CH_X + i, CH_TOP + j, ch)
for y in range(24, 36):
    for x in (CH_X + 8, CH_X + 9):
        g = c.get(x, y)
        if g != '.':
            c.put(x, y, kit.DARKER.get(g, g))

# ---------------------------------------------------------------- 본채 벽(물러난 1층) — 땅선 y=111
MX0, MX1 = 2, W - 3
UY0 = E_Y + 3                                    # 67
kit.eave_shadow(c, MX0, MX1, UY0)
kit.plaster(c, MX0, UY0 + 5, MX1, 107, DOTS, ox=3, oy=2)
for px, g in ((MX0, 1), (21, 2), (40, 0), (101, 3), (120, 1), (MX1 - 2, 2)):
    kit.post(c, px, UY0 + 2, 107, grain=g)
kit.beam(c, MX0, MX1, UY0 + 4, grain=2)
kit.beam(c, MX0, MX1, 96, h=1, grain=6)        # 허리 가로대(창 아래)
# 가로대 아래 칸: 칸마다 방향이 다른 사선 가새 하나(보에서 보로)
kit.brace(c, 5, 106, 18, 98)
kit.brace(c, 24, 98, 37, 106)
kit.brace(c, 104, 98, 117, 106)
kit.brace(c, 123, 106, 135, 98)

def window(x, y, w, h, kind):
    """kind 0 덧문 두 짝 · 1 꽃상자 · 2 반원 머리 창 · 3 세 칸 창 + 차양."""
    for j in range(h):
        for i in range(w):
            if kind == 2 and j < 2 and i in (0, 1, w - 2, w - 1) and not (j == 1 and i in (1, w - 2)):
                continue
            if i in (0, w - 1) or j in (0, h - 1) or (kind == 2 and j == 1 and i in (1, w - 2)):
                ch = 'η' if (i <= 1 or j == 0) else 'β'
            else:
                ch = 'E' if j <= 2 else ('D' if j < h // 2 else ('B' if j < h - 2 else 'A'))
            c.put(x + i, y + j, ch)
    if kind == 3:
        for j in range(1, h - 1):
            c.put(x + w // 3, y + j, 'ε')
            c.put(x + 2 * w // 3, y + j, 'ε')
    else:
        for j in range(2, h - 1):
            c.put(x + w // 2, y + j, 'ε')
        c.put(x + w // 2, y + 1, 'ε' if kind != 2 else 'η')
        for i in range(1, w - 1):
            c.put(x + i, y + h // 2 + 1, 'ε')
    c.put(x + 2, y + 2, 'H')
    c.put(x + 2, y + 3, '^')
    c.put(x + w - 3, y + h // 2 + 2, 'F')
    if kind == 0:
        for xx, side in ((x - 4, 0), (x + w, 1)):
            for j in range(h):
                for i in range(4):
                    ch = ('η', 'ε', 'δ', 'β')[i] if side == 0 else ('η', 'δ', 'ε', 'β')[i]
                    if j in (1, h - 2):
                        ch = 'ζ'
                    c.put(xx + i, y + j, ch)
        for i in range(-4, w + 4):
            c.put(x + i, y + h, 'n' if i < w // 2 else 'h')
            c.put(x + i, y + h + 1, 'Y')
    elif kind == 1:
        fl = 'OκNMLκNOM'
        for i in range(w):
            c.put(x + i, y + h - 1, fl[i % len(fl)])
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'ζ')
            c.put(x + i, y + h + 1, 'ε' if i % 4 else 'δ')
            c.put(x + i, y + h + 2, '-')
    elif kind == 2:
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'm' if i % 3 else 'n')
            c.put(x + i, y + h + 1, 'Y')
    else:
        for i in range(-2, w + 2):
            c.put(x + i, y - 3, 'σ' if i % 4 else 'ξ')
            c.put(x + i, y - 2, 'ζ' if i % 3 else 'η')
            c.put(x + i, y - 1, '-')
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'h' if i % 4 else 'm')


window(9, 77, 9, 13, 0)
window(28, 79, 9, 10, 2)
window(106, 80, 12, 10, 3)
window(126, 78, 9, 11, 1)
kit.foundation(c, MX0, MX1, 108, FOUND)
for x in range(MX0, MX1 + 1):                    # 땅에 닿는 둘째 기초 줄(짙은 돌)
    c.put(x, 110, 'X' if x % 5 else 'U')
    c.put(x, 111, 'U' if x % 4 else 'T')

# ---------------------------------------------------------------- 십자 날개 지붕(남북 박공) — 북쪽 팔 + 골 + 남쪽 팔
CTR, HALF = 72.0, 26.0
APEX, W_EAVE = 4, 86
inside, hw = kit.ns_roof(c, CTR, HALF, APEX, E_Y, W_EAVE, T_WL, T_WR, lower=(R_Y, E_Y))
# 북쪽 팔 바깥 테(본채 용마루 위로 솟은 박공 끝선)
kit.rim(c, lambda x, y: inside(x, y) and y < R_Y, 40, 104, APEX, R_Y - 1)
c.put(int(CTR) - 1, APEX - 1, '-')
c.put(int(CTR), APEX - 1, '-')
# 본채 용마루가 북쪽 팔 밑변을 지나간다: 용마루 기와 줄을 날개 밑에서 다시 그어 이음매를 보인다
for x in range(int(CTR - HALF) - 1, int(CTR + HALF) + 2):
    c.put(x, R_Y, 'ζ' if x % 5 else 'η')
    c.put(x, R_Y + 1, '-' if abs(x + 0.5 - CTR) > 2 else '_')
# 골 두 줄(본채 앞 사면과 만남)
kit.valley(c, lambda x, y: inside(x, y) and y > R_Y + 1, 40, 104, R_Y + 2, E_Y)
# 남쪽 팔 세로 처마 테
kit.rim(c, lambda x, y: inside(x, y) and y > E_Y, 40, 104, E_Y + 1, W_EAVE)
for x in range(44, 101):
    if inside(x, W_EAVE):
        c.put(x, W_EAVE + 1, '%' if x % 3 else '9')
        c.put(x, W_EAVE + 2, '-' if x % 4 else '_')
# 박공 삼각벽
GPEAK, GBASE, GHALF = 66, W_EAVE + 2, 21.0
kit.gable_wall(c, CTR, GPEAK, GBASE, GHALF, DOTS, ox=7, attic=(9, 8, 74))

# ---------------------------------------------------------------- 날개 남쪽 팔 벽 — 땅선 y=127
NX0, NX1 = 49, 94
WY0 = GBASE + 1                                  # 89
kit.beam(c, NX0, NX1, WY0, grain=4)
kit.eave_shadow(c, NX0, NX1, WY0 + 3, rows=('-', 'c', 'f', 'l'))
kit.plaster(c, NX0, WY0 + 7, NX1, H - 3, DOTS, ox=5, oy=9)
DOOR_X, DOOR_W = 66, 12
for px, g in ((NX0, 3), (DOOR_X - 3, 1), (DOOR_X + DOOR_W, 2), (NX1 - 2, 0)):
    kit.post(c, px, WY0 + 3, H - 3, grain=g)
kit.beam(c, DOOR_X - 3, DOOR_X + DOOR_W + 2, WY0 + 9, h=1, grain=1)
# 문(아치 머리 널문 + 쇠띠 + 징 + 고리 손잡이)
DY = WY0 + 12                                    # 101
for j in range(H - 2 - DY):
    for i in range(DOOR_W):
        cut = (3, 2, 1, 1)[j] if j < 4 else 0
        if i < cut or i >= DOOR_W - cut:
            continue
        if j == 0 or i == cut or i == DOOR_W - cut - 1:
            ch = '_'
        else:
            ch = 'εηεβ'[(i + 1) % 4] if j < 11 else 'εεβδ'[(i + 1) % 4]
        c.put(DOOR_X + i, DY + j, ch)
for yy in (DY + 5, DY + 18):
    for i in range(1, DOOR_W - 1):
        c.put(DOOR_X + i, yy, 'W' if i % 2 else 'X')
    for i in (3, 6, 9):
        c.put(DOOR_X + i, yy, 'j')
c.put(DOOR_X + 3, DY + 12, 'K')
c.put(DOOR_X + 3, DY + 13, 'τ')
c.put(DOOR_X + 2, DY + 13, 'K')
for i in range(DOOR_W):
    c.put(DOOR_X + i, H - 3, 'm' if i % 4 else 'i')
window(52, 103, 7, 10, 2)
window(83, 102, 8, 10, 1)
# 쇠 받침에 매단 등불(문 왼쪽 기둥)
for (x, y, ch) in [(62, 99, 'X'), (61, 99, 'W'), (60, 99, 'X'), (60, 100, 'U'), (59, 101, 'X'), (60, 101, 'K'),
                   (61, 101, 'X'), (59, 102, 'K'), (60, 102, 'L'), (61, 102, 'τ'), (59, 103, 'X'), (60, 103, 'U'),
                   (61, 103, 'X')]:
    c.put(x, y, ch)
kit.foundation(c, NX0, NX1, H - 2, FOUND[5:] + FOUND[:5], step=(DOOR_X - 1, DOOR_X + DOOR_W))
# 날개 벽이 본채 벽 앞에 선다: 날개 오른쪽 본채 벽에 짧은 그늘(빛 왼쪽 위)
SH = {'3': 'z', 'z': 'x', 'y': 'w', '1': 'y', '2': 'y', 'ε': 'β', 'η': 'ε', 'β': '_', 'c': 'Y', 'f': 'c',
      'l': 'f', 'i': 'a', 'm': 'i', 'a': 'X'}
for y in range(UY0, 108):
    for k in range(4):
        x = NX1 + 1 + k
        g = c.get(x, y)
        if g != '.' and k < 4 - (y - UY0) // 14:
            c.put(x, y, SH.get(g, g))

# ---------------------------------------------------------------- 풍화·이끼(손 좌표)
for (x, yy, ch) in [(3, 107, 'N'), (4, 107, 'O'), (41, 107, 'N'), (99, 107, 'O'), (139, 107, 'N'), (50, 125, 'N'),
                    (51, 125, 'O'), (92, 125, 'N'), (16, 86, 'y'), (34, 100, 'z'), (114, 102, 'y'), (130, 92, 'z'),
                    (58, 118, 'y'), (88, 116, 'z')]:
    c.put(x, yy, ch)
for (x, yy, shape) in [(10, 60, ['.OP.', 'NOON']), (127, 59, ['OP', 'NO']), (52, 80, ['.P', 'ON']),
                       (75, 12, ['P.', 'ON'])]:
    for j, row in enumerate(shape):
        for i, ch in enumerate(row):
            if ch != '.' and c.get(x + i, yy + j) != '.':
                c.put(x + i, yy + j, ch)

TOUCH = [(107, 51), (116, 51)]
# 손 낱장 손질: 같은 8×8 칸이 건물 안에서 되풀이되지 않게 기와 몇 장을 묵히거나 이 빠지게(손 좌표)
for (x, yy) in TOUCH:
    g = c.get(x, yy)
    c.put(x, yy, kit.DARKER.get(g, g))
    g = c.get(x + 1, yy)
    c.put(x + 1, yy, kit.DARKER.get(g, g))

import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_ch', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))
print('  안쪽 투명', len(kit.interior_holes(c)))

walk = []
for cy in range(8):
    r = ''
    for cx in range(9):
        op = any(c.g[yy][xx] != '.' for yy in range(cy * 16, cy * 16 + 16) for xx in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 4 and cy in (6, 7):
            r += 'D'
        else:
            r += '*' if cy < 4 else 'X'
    walk.append(r)
meta = {'name': '교차 박공 십자형 집', 'massing': '18', 'material': 'plaster',
        'refs': ['bd-house-h124_0', 'bd-house-h122_0'], 'walk': walk}
print('\n'.join(walk))
fails, warns = c.save('cross-house', meta)
print('fails', fails, 'warns', warns)

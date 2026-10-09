"""골조 판 frame-r1 — 묶음 frame 7항목 × 줄 A·B × 후보 2 (A1 A2 B1 B2).

줄의 화풍 기준은 style-r1 의 그 글자 조각이다(seed lines.<줄>.origin). 같은 램프·같은 결(판재 폭·돌 모양·기와 골)·
같은 윤곽 두께(먹 1px)로 그린다. 그림은 전부 행 문자열 격자이거나, 손으로 고른 좌표·조각을 찍는 보조 함수다
(style_r1 의 _course·_rep·_overlay 와 같은 방식). 도형 마스크·노이즈로 본체를 만들지 않는다.

세트 항목은 seed pieces 의 칸 배치대로 한 장에 담는다. meta['pieces'][조각 id]['top'] = 조각 안 윗면 행 범위.
"""
from tk import Cv, grid, stamp, T
import style_r1 as S

ROUND = 'frame-r1'
WAVE = 'frame'


# ---------------------------------------------------------------------------
# 공용 보조
# ---------------------------------------------------------------------------
def put_rows(cv, rows, legend, x, y):
    """grid 와 같지만 기존 캔버스 위 (x, y) 에. 행 길이 검사 포함."""
    w = len(rows[0])
    for j, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f'행 {j} 길이 {len(r)} ≠ {w}: {r!r}')
    stamp(cv, rows, legend, x, y)


def sheet(size, parts):
    """parts = [(rows, legend, 칸x, 칸y)] → 세트 한 장."""
    cv = Cv(size[0] * T, size[1] * T)
    for rows, legend, tx, ty in parts:
        put_rows(cv, rows, legend, tx * T, ty * T)
    return cv


def shade_rows(rows, shifts):
    """숫자 단 글자를 행마다 shifts[y] 만큼 낮춘다(벽 밑 그늘). 숫자 아닌 글자는 그대로."""
    out = []
    for y, r in enumerate(rows):
        d = shifts[y] if y < len(shifts) else 0
        out.append(''.join(str(max(0, int(c) - d)) if c.isdigit() else c for c in r))
    return out


def setc(rows, pts):
    """rows 의 (x, y) 몇 자리를 손으로 바꾼다. pts = [(x, y, 글자)]"""
    rows = [list(r) for r in rows]
    for x, y, ch in pts:
        rows[y % len(rows)][x % len(rows[0])] = ch
    return [''.join(r) for r in rows]


# ---------------------------------------------------------------------------
# 1. 객잔 마루 세트 (8×2) — v1 v2 v3 (2×2) + foot (2×2)
# ---------------------------------------------------------------------------
SONG = {str(i): ('song', i) for i in range(7)}
MU = {str(i): ('mu', i) for i in range(7)}


# 변형끼리 섞어 깔아도 판이 이음 없이 색을 바꾸지 않게, 판 줄(가로)·판 열(세로)마다 바탕 단은 style 조각과 같다.
# 변형은 이음 자리·결 자국·이음 사이 판 한 장(seg)의 색으로만 다르다.
A_BASES = [4, 3, 4, 5, 4, 3, 4, 4]      # style-r1 A 마루 판 8장의 바탕 단
B_BASES = [4, 4, 4, 4]                  # style-r1 B 마루 판 4장의 바탕 단


def hplanks(spec, w=32):
    """줄 A 가로 판재(style-r1 A 와 같은 화법): 판 하나 = 틈 줄 '2' + 몸 3줄.
    spec = 판마다 ([이음 x...], [(몸 행 1~3, x, 글자열)...], [(x0, x1, 단)...] 이음 사이 판 한 장 색).
    이음: 왼쪽 그늘(바탕-1)·틈 2·오른쪽 윗줄 밝은 끝(바탕+1). 좌표는 전부 손으로 고른다."""
    rows = []
    for base, (joints, marks, segs) in zip(A_BASES, spec):
        b = str(base)
        body = [[b] * w for _ in range(3)]
        for x0, x1, t in segs:
            for x in range(x0, x1):
                body[0][x % w] = body[1][x % w] = str(t)
                body[2][x % w] = str(max(t - 1, 1))
        for ry, x, st in marks:
            for i, ch in enumerate(st):
                body[ry - 1][(x + i) % w] = ch
        for jx in joints:
            for ry in range(3):
                body[ry][(jx - 1) % w] = str(max(int(body[ry][(jx - 1) % w]) - 1, 1))
                body[ry][jx % w] = '2'
            body[0][(jx + 1) % w] = str(min(int(body[0][(jx + 1) % w]) + 1, 6))
        rows.append('2' * w)
        rows += [''.join(r) for r in body]
    return rows


def vplanks(spec, h=32):
    """줄 B 세로 판재(style-r1 B 와 같은 화법): 판 하나 = 8열(틈 2·밝은 모서리·몸 5열·그늘).
    spec = 판마다 ([판 끝 행...], [(몸 열 0~4, y, 세로 글자열)...], [(y0, y1, 단)...] 판 끝 사이 한 장 색).
    판 끝: 위 행 그늘·틈 '2' 한 줄·아래 행 밝은 윗모서리."""
    cols = []
    for base, (ends, marks, segs) in zip(B_BASES, spec):
        b = str(base)
        col = [['2', str(base + 1)] + [b] * 5 + [str(base - 1)] for _ in range(h)]
        for y0, y1, t in segs:
            for y in range(y0, y1):
                col[y % h] = ['2', str(min(t + 1, 6))] + [str(t)] * 5 + [str(max(t - 1, 1))]
        for x, y, st in marks:
            for i, ch in enumerate(st):
                col[(y + i) % h][2 + x] = ch
        for e in ends:
            above = col[(e - 1) % h]
            t = int(above[3])
            col[(e - 1) % h] = [str(max(t - 1, 1))] + [str(t)] * 5 + [str(max(t - 1, 1))] * 2
            col[e % h] = ['2'] * 8
            below = col[(e + 1) % h]
            t2 = int(below[3])
            col[(e + 1) % h] = [str(min(t2 + 1, 6))] * 7 + [str(t2)]
        cols.append(col)
    return [''.join(''.join(c[y]) for c in cols) for y in range(h)]


# 줄 A · 후보 1 — style 그대로(판 32px 에 이음 하나), 변형은 옹이·땜질한 새 판·닳은 길
A1_V1 = [
    ([6], [(1, 12, '5555'), (2, 22, '333'), (3, 0, '33'), (3, 27, '333')], []),
    ([19], [(1, 2, '444'), (2, 9, '222'), (3, 25, '2222')], []),
    ([28], [(1, 9, '55555'), (2, 16, '333'), (3, 3, '3333')], []),
    ([13], [(1, 20, '666'), (2, 3, '444'), (3, 24, '4444')], []),
    ([1], [(1, 18, '555'), (2, 8, '333'), (3, 12, '33')], []),
    ([24], [(1, 6, '4444'), (2, 14, '222'), (3, 0, '22')], []),
    ([9], [(1, 26, '55'), (2, 18, '3333'), (3, 2, '333')], []),
    ([17], [(1, 3, '555'), (2, 25, '333'), (3, 9, '3333')], []),
]
A1_V2 = [  # 옹이 둘 · 땜질한 새 판 한 장(이음 둘 사이 밝은 짧은 판)
    ([21], [(1, 3, '555'), (2, 9, '343'), (3, 9, '323'), (3, 26, '333')], []),          # 옹이(9~11열)
    ([4], [(1, 14, '444'), (2, 24, '222'), (3, 16, '2222')], []),
    ([15], [(1, 22, '5555'), (2, 2, '333'), (3, 28, '33')], []),
    ([7, 19], [(1, 10, '6'), (1, 24, '66'), (3, 26, '444')], [(8, 19, 6)]),            # 땜질한 새 판(8~18열)
    ([27], [(1, 5, '555'), (2, 16, '333'), (3, 2, '333')], []),
    ([11], [(1, 19, '444'), (2, 25, '232'), (3, 25, '212'), (3, 3, '22')], []),        # 옹이(25~27열, 어두운 판)
    ([2], [(1, 14, '5555'), (2, 22, '333'), (3, 8, '33')], []),
    ([24], [(1, 7, '555'), (2, 13, '333'), (3, 28, '333')], []),
]
A1_V3 = [  # 닳은 길: 가운데(10~23열)가 밝게 닳았다
    ([5], [(1, 11, '555555'), (2, 13, '5555'), (3, 26, '33')], []),
    ([26], [(1, 9, '4444444'), (2, 12, '44'), (3, 2, '222')], []),
    ([16], [(1, 8, '555'), (1, 19, '555'), (2, 11, '55'), (3, 28, '333')], []),
    ([30], [(1, 10, '666666'), (2, 14, '6666'), (3, 4, '444')], []),
    ([12], [(1, 15, '5555'), (2, 18, '55'), (3, 1, '33')], []),
    ([22], [(1, 9, '444444'), (2, 12, '444'), (3, 27, '222')], []),
    ([3], [(1, 12, '55555'), (2, 17, '55'), (3, 24, '333')], []),
    ([18], [(1, 10, '5555'), (2, 25, '333'), (3, 6, '33')], []),
]


def floor_set(v1, v2, v3, foot, legend, note, size=(8, 2)):
    cv = sheet(size, [(v1, legend, 0, 0), (v2, legend, 2, 0), (v3, legend, 4, 0), (foot, legend, 6, 0)])
    return cv, {'note': note}


FOOT_H = [2, 2, 2, 2, 1, 1, 1, 1]          # 가로 판: 첫 판 두 단, 둘째 판 한 단 어둡게
FOOT_V = [2, 2, 2, 2, 2, 1, 1, 1, 1, 1]    # 세로 판: 위 10행


def floor_a1():
    v1 = hplanks(A1_V1)
    return floor_set(v1, hplanks(A1_V2), hplanks(A1_V3), shade_rows(v1, FOOT_H), SONG,
                     '줄 A · style 그대로(4px 가로 판, 32px 에 이음 하나, 판 줄 바탕도 style 과 같다). 변형 = 옹이 둘·땜질한 새 판 / 가운데가 밝게 닳은 길. foot = 벽 밑 두 판 그늘.')


# 줄 A · 후보 2 — 판 길이 16px(이음 둘, 줄마다 엇갈림), 변형은 못 머리·바랜 판 섞기
A2_J = [[3, 19], [11, 27], [7, 23], [15, 31], [1, 17], [9, 25], [13, 29], [5, 21]]
A2_V1 = [
    (A2_J[0], [(1, 8, '555'), (2, 24, '333'), (3, 12, '33')], []),
    (A2_J[1], [(1, 14, '44'), (2, 2, '222'), (3, 20, '222')], []),
    (A2_J[2], [(1, 26, '5555'), (2, 12, '333'), (3, 0, '333')], []),
    (A2_J[3], [(1, 3, '666'), (2, 20, '444'), (3, 7, '44')], []),
    (A2_J[4], [(1, 22, '555'), (2, 6, '333'), (3, 28, '33')], []),
    (A2_J[5], [(1, 2, '444'), (2, 15, '222'), (3, 18, '22')], []),
    (A2_J[6], [(1, 18, '555'), (2, 4, '333'), (3, 22, '333')], []),
    (A2_J[7], [(1, 9, '55'), (2, 27, '333'), (3, 14, '333')], []),
]
A2_V2 = [  # 못 머리: 판 몇 장의 이음 오른쪽에 짙은 못 1px 둘(위·아래 줄)
    (A2_J[0], [(1, 8, '555'), (2, 24, '333'), (1, 21, '1'), (3, 21, '1')], []),
    (A2_J[1], [(1, 14, '44'), (3, 20, '222')], []),
    (A2_J[2], [(1, 26, '5555'), (2, 12, '333'), (1, 9, '2'), (3, 9, '2')], []),
    (A2_J[3], [(1, 3, '666'), (3, 7, '44')], []),
    (A2_J[4], [(1, 22, '555'), (3, 28, '33'), (1, 19, '2'), (3, 19, '2')], []),
    (A2_J[5], [(1, 2, '444'), (3, 18, '22')], []),
    (A2_J[6], [(1, 18, '555'), (3, 22, '333'), (1, 15, '2'), (3, 15, '2')], []),
    (A2_J[7], [(1, 9, '55'), (2, 27, '333')], []),
]
A2_V3 = [  # 바랜 판(6)·새로 깐 짙은 판(3) 섞기 — 이음 사이 한 장씩
    (A2_J[0], [(1, 8, '555')], []),
    (A2_J[1], [(3, 20, '222')], [(12, 27, 6)]),          # 바랜 판
    (A2_J[2], [(1, 26, '5555'), (2, 12, '333')], []),
    (A2_J[3], [(1, 20, '33')], [(0, 15, 3)]),            # 새로 깐 짙은 판
    (A2_J[4], [(1, 22, '555'), (2, 6, '333')], []),
    (A2_J[5], [(2, 15, '222')], [(26, 41, 5)]),          # 조금 바랜 판(감아 넘어간다)
    (A2_J[6], [(3, 22, '333')], [(14, 29, 6)]),          # 바랜 판
    (A2_J[7], [(1, 9, '55'), (3, 14, '333')], []),
]


def floor_a2():
    v1 = hplanks(A2_V1)
    foot = shade_rows(v1, [3, 3, 3, 3, 1, 1, 1, 1])
    foot = setc(foot, [(x, 1, '1') for x in range(32)])     # 굽도리 바로 밑 진한 그늘 한 줄
    return floor_set(v1, hplanks(A2_V2), hplanks(A2_V3), foot, SONG,
                     '줄 A · 판 길이 16px(이음 둘, 줄마다 엇갈림). 변형 = 이음 옆 못 머리 / 바랜 판·새로 깐 짙은 판 섞기. foot = 굽도리 밑 진한 그늘.')


# 줄 B · 후보 1 — style 그대로(8px 세로 칠 판, 판마다 끝 하나), 변형은 옹이·갈아 끼운 판·닳은 길
B1_V1 = [
    ([9], [(1, 2, '333'), (3, 18, '555'), (2, 26, '33')], []),
    ([25], [(2, 4, '333'), (1, 14, '55'), (3, 20, '333')], []),
    ([3], [(0, 10, '3333'), (2, 22, '55'), (3, 28, '333')], []),
    ([16], [(3, 4, '555'), (1, 22, '333'), (2, 9, '33')], []),
]
B1_V2 = [  # 옹이 둘 · 갈아 끼운 짙은 판 한 장(판 끝 둘 사이)
    ([20], [(1, 4, '3'), (2, 3, '323'), (3, 4, '3'), (3, 26, '55')], []),          # 옹이
    ([7, 23], [(1, 12, '222'), (2, 26, '33')], [(8, 23, 3)]),                       # 갈아 끼운 짙은 판(8~22행)
    ([29], [(0, 6, '333'), (2, 14, '55'), (3, 20, '333')], []),
    ([12], [(2, 22, '333'), (1, 2, '55'), (2, 26, '232'), (1, 27, '3'), (3, 27, '3')], []),   # 옹이
]
B1_V3 = [  # 닳은 길: 판 가운데가 밝게 닳았다
    ([14], [(1, 2, '55555'), (2, 18, '5555'), (3, 26, '333')], []),
    ([30], [(2, 2, '5555'), (2, 10, '555'), (1, 18, '55')], []),
    ([6], [(1, 10, '555555'), (2, 22, '555'), (3, 28, '33')], []),
    ([22], [(3, 4, '333'), (1, 12, '55'), (2, 26, '333')], []),
]


def floor_b1():
    v1 = vplanks(B1_V1)
    return floor_set(v1, vplanks(B1_V2), vplanks(B1_V3), shade_rows(v1, FOOT_V), MU,
                     '줄 B · style 그대로(8px 세로 칠 판, 판 끝 엇갈림). 변형 = 옹이·갈아 끼운 짙은 판 / 판 가운데가 밝게 닳은 길. foot = 벽 밑 그늘.')


# 줄 B · 후보 2 — 판마다 끝 둘(16px 판), 변형은 칠 벗겨짐·밝은 판 섞기
B2_E = [[5, 21], [13, 29], [9, 25], [1, 17]]
B2_V1 = [
    (B2_E[0], [(1, 10, '333'), (3, 26, '55')], []),
    (B2_E[1], [(2, 2, '333'), (1, 18, '55')], []),
    (B2_E[2], [(0, 14, '3333'), (3, 2, '555')], []),
    (B2_E[3], [(3, 6, '555'), (2, 24, '333')], []),
]
B2_V2 = [  # 칠 벗겨진 자리(밝은 5·6 얼룩, 판 가운데)
    (B2_E[0], [(1, 9, '56'), (2, 10, '665'), (3, 12, '5'), (3, 26, '55')], []),
    (B2_E[1], [(2, 2, '333'), (1, 17, '5'), (2, 18, '66'), (3, 19, '5')], []),
    (B2_E[2], [(0, 14, '3333'), (2, 3, '565')], []),
    (B2_E[3], [(3, 6, '555'), (1, 24, '5'), (2, 25, '665'), (3, 27, '5')], []),
]
B2_V3 = [  # 판 끝 사이 한 장씩 짙은 판(3)·밝은 판(5)
    (B2_E[0], [(1, 10, '222')], [(6, 21, 3)]),
    (B2_E[1], [(2, 2, '333')], [(14, 29, 5)]),
    (B2_E[2], [(3, 2, '555')], []),
    (B2_E[3], [(2, 24, '222')], [(18, 33, 3)]),
]


def floor_b2():
    v1 = vplanks(B2_V1)
    foot = shade_rows(v1, [3, 3, 2, 2, 2, 1, 1, 1, 1, 1])
    return floor_set(v1, vplanks(B2_V2), vplanks(B2_V3), foot, MU,
                     '줄 B · 짧은 세로 판(판마다 끝 둘, 16px 엇갈림). 변형 = 칠 벗겨진 자리 / 짙은 판·밝은 판 섞기. foot = 벽 밑 진한 그늘.')


# ---------------------------------------------------------------------------
# 2. 마당 돌바닥 세트 (9×3) — v1 v2 + 풀 가장자리 3×3 + 안쪽 모서리 넷 + 풀
# 글자: 숫자 = 청석(shi) 단, a~g = 풀(cao, 조선 잎 램프) 0~6, h~l = 흙(huang) 1~5
# ---------------------------------------------------------------------------
YARD = {str(i): ('shi', i) for i in range(7)}
YARD.update({c: ('cao', i) for i, c in enumerate('abcdefg')})
YARD.update({c: ('huang', i + 1) for i, c in enumerate('hijkl')})

# 풀 한 칸(16×16, 감아 이어짐). 바탕 e(cao4). 풀잎 = 밝은 끝 f 위·어두운 밑동 d 아래 두 화소(손으로 찍은 자리).
GRASS = [
    "eeeeeeeeeeeeeeee",
    "eeefeeeeeeeefeee",
    "eeedeeeeeeeedeee",
    "eeeeeeefeeeeeeee",
    "eeeeeeedeeeeeeef",
    "efeeeeeeeeeeeeed",
    "edeeeeeeeeefeeee",
    "eeeeeefeeeedeeee",
    "eeeeeedeeeeeeeee",
    "eeeeeeeeeeeeefee",
    "eeefeeeeeeeeedee",
    "eeedeeeeeffeeeee",
    "eeeeeeeeeddeeeee",
    "eeeeeeeeeeeeeeee",
    "efeeeeefeeeeeeee",
    "edeeeeedeeeeeeee",
]
DIRT = [  # 흙 한 칸(16×16, 감아 이어짐). 바탕 k(huang4), 자갈 = 밝은 l 위·어두운 i 아래 두 화소.
    "kkkkkkkkkkkkkkkk",
    "kkklkkkkkkkkkkkk",
    "kkkikkkkkklkkkkk",
    "kkkkkkkkkkikkkkk",
    "kkkkkkkkkkkkkkkl",
    "kkkkkklkkkkkkkki",
    "kkkkkkikkkkkkkkk",
    "kkkkkkkkkkkkkkkk",
    "klkkkkkkkkkklkkk",
    "kikkkkkkkkkkikkk",
    "kkkkkkkklkkkkkkk",
    "kkkkkkkkikkkkkkk",
    "kkkklkkkkkkkkkkk",
    "kkkkikkkkkkkklkk",
    "kkkkkkkkkkkkkikk",
    "kkkkkkkkkkkkkkkk",
]


def blank(w=16, h=16, fill='.'):
    return [[fill] * w for _ in range(h)]


def stone_a(m, x0, y0, w, h, base, spots=()):
    """줄 A 판석 화법(style-r1 A): 위 줄·왼 열 틈 '1', 그 안쪽 밝은 줄(바탕+1), 오른 열·아래 줄 그늘(바탕-1)."""
    for y in range(h):
        for x in range(w):
            if y == 0 or x == 0:
                c = 1
            elif y == h - 1 or x == w - 1:
                c = base - 1
            elif y == 1 or x == 1:
                c = base + 1
            else:
                c = base
            m[y0 + y][x0 + x] = str(c)
    for dx, dy, ch in spots:
        m[y0 + dy][x0 + dx] = ch


def stone_b(m, x0, y0, w, h, base, spots=()):
    """줄 B 장대석 화법(style-r1 B 의 _course): 위 줄·오른 열 틈 '1', 둘째 줄 밝음, 아래 줄·오른쪽 둘째 열 그늘. 왼 밝은 열 없음."""
    for y in range(h):
        for x in range(w):
            if y == 0 or x == w - 1:
                c = 1
            elif y == h - 1 or x == w - 2:
                c = base - 1
            elif y == 1:
                c = base + 1
            else:
                c = base
            m[y0 + y][x0 + x] = str(c)
    for dx, dy, ch in spots:
        m[y0 + dy][x0 + dx] = ch


def mrows(m):
    return [''.join(r) for r in m]


def tiled_layer(m, tile, region):
    """region(x, y) 가 참인 자리에 16 주기 바탕(풀·흙)을 깐다."""
    for y in range(len(m)):
        for x in range(len(m[0])):
            if region(x, y):
                m[y][x] = tile[y % 16][x % 16]


def tufts(m, grass, tx, ty, deep='d', edge='d'):
    """풀 경계 손질. grass(x,y) = 풀 자리. tx = {x: 깊이} 가로 경계(위·아래)에서 풀 포기가 비풀 쪽으로 내미는 깊이,
    ty = {y: 깊이} 세로 경계(왼·오른)에서. 포기와 경계의 풀 가장자리 화소는 어두운 풀(d)."""
    h, w = len(m), len(m[0])
    G = [[grass(x, y) for x in range(w)] for y in range(h)]
    add = []
    for y in range(h):
        for x in range(w):
            if not G[y][x]:
                continue
            for dx, dy, tab in ((0, 1, tx), (0, -1, tx), (1, 0, ty), (-1, 0, ty)):
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h and not G[Y][X]:
                    k = tab.get(x if dy else y, 0)
                    for i in range(1, k + 1):
                        XX, YY = x + dx * i, y + dy * i
                        if 0 <= XX < w and 0 <= YY < h and not G[YY][XX]:
                            add.append((XX, YY, 'e' if i < k else deep))
                    m[y][x] = edge if k == 0 else m[y][x]
    for x, y, ch in add:
        m[y][x] = ch


# 판 화법별 마당 세트 조립. P = 후보 매개변수(손으로 정한 값들).
def yard_edges(P):
    """가장자리 3×3 + 안쪽 모서리 넷 + 풀 한 칸 + 한 칸 돌. P['gd'] 풀 폭, P['dd'] 흙 폭, P['curb'](m, 조각, 영역) 경계석 그리기."""
    gd, dd = P['gd'], P['dd']
    o = gd + dd                       # 경계석이 시작하는 깊이
    R = 16 - o                        # 반대쪽 경계
    regions = {   # (풀 영역, 흙+풀 영역)
        'n': (lambda x, y: y < gd, lambda x, y: y < o),
        's': (lambda x, y: y >= 16 - gd, lambda x, y: y >= R),
        'w': (lambda x, y: x < gd, lambda x, y: x < o),
        'e': (lambda x, y: x >= 16 - gd, lambda x, y: x >= R),
        'nw': (lambda x, y: y < gd or x < gd, lambda x, y: y < o or x < o),
        'ne': (lambda x, y: y < gd or x >= 16 - gd, lambda x, y: y < o or x >= R),
        'sw': (lambda x, y: y >= 16 - gd or x < gd, lambda x, y: y >= R or x < o),
        'se': (lambda x, y: y >= 16 - gd or x >= 16 - gd, lambda x, y: y >= R or x >= R),
        'inw': (lambda x, y: y < gd and x < gd, lambda x, y: y < o and x < o),
        'ine': (lambda x, y: y < gd and x >= 16 - gd, lambda x, y: y < o and x >= R),
        'isw': (lambda x, y: y >= 16 - gd and x < gd, lambda x, y: y >= R and x < o),
        'ise': (lambda x, y: y >= 16 - gd and x >= 16 - gd, lambda x, y: y >= R and x >= R),
    }
    out = {}
    for pid, (gr, dr) in regions.items():
        m = blank()
        P['curb'](m, pid, o)
        if dd:
            tiled_layer(m, DIRT, dr)
        tiled_layer(m, GRASS, gr)
        tufts(m, gr, P['tx'], P['ty'])
        out[pid] = mrows(m)
    g = blank()
    tiled_layer(g, GRASS, lambda x, y: True)
    out['g'] = mrows(g)
    out['c'] = P['single']()
    return out


def curb_rects(o):
    """조각별 경계석 사각형(가장자리와 나란한 긴 돌)과 풀이 있는 쪽. (x, y, w, h, 풀 쪽 'N'·'S'·'W'·'E'·'NW'…)"""
    R = 16 - o
    return {
        'n': [(0, o, 16, R, 'N')], 's': [(0, 0, 16, R, 'S')], 'w': [(o, 0, R, 16, 'W')], 'e': [(0, 0, R, 16, 'E')],
        'nw': [(o, o, R, R, 'NW')], 'ne': [(0, o, R, R, 'NE')], 'sw': [(o, 0, R, R, 'SW')], 'se': [(0, 0, R, R, 'SE')],
        'inw': [(o, 0, R, o, 'W'), (0, o, 16, R, 'N')], 'ine': [(0, 0, R, o, 'E'), (0, o, 16, R, 'N')],
        'isw': [(0, 0, 16, R, 'S'), (o, R, R, o, 'W')], 'ise': [(0, 0, 16, R, 'S'), (0, R, R, o, 'E')],
    }


def stone_b_side(m, x0, y0, w, h, base, side, ring=None):
    """줄 B 경계석: 틈 줄을 풀 쪽에 둔다(위 틈은 늘 있고, 풀이 왼쪽이면 왼 열이 틈).
    ring = [(시작, 길이, 단)...] 길이 합 16 — 칸을 꽉 채운 띠를 16 주기로 감아 도는 돌 배치(손으로 정함).
    시작을 음수로 두면 칸 경계가 돌 한가운데에 와서 이어 깔아도 경계에 이음이 안 생긴다."""
    if ring:
        assert sum(r[1] for r in ring) == 16, ring
        horiz = w >= h
        n = w if horiz else h
        for st, ln, b in ring:
            t = blank(ln if horiz else w, h if horiz else ln)
            stone_b_side(t, 0, 0, ln if horiz else w, h if horiz else ln, b, side)
            for d in range(ln):
                p = (st + d) % 16
                if p >= n:
                    continue
                if horiz:
                    for yy in range(h):
                        m[y0 + yy][x0 + p] = t[yy][d]
                else:
                    for xx in range(w):
                        m[y0 + p][x0 + xx] = t[d][xx]
        return
    mirror = 'W' in side
    for y in range(h):
        for x in range(w):
            xx = (w - 1 - x) if mirror else x
            if y == 0 or xx == w - 1:
                c = 1
            elif y == h - 1 or xx == w - 2:
                c = base - 1
            elif y == 1:
                c = base + 1
            else:
                c = base
            m[y0 + y][x0 + x] = str(c)


def yard_set(v1, v2, edges, note):
    parts = [(v1, YARD, 0, 0), (v2, YARD, 2, 0)]
    pos = {'nw': (4, 0), 'n': (5, 0), 'ne': (6, 0), 'w': (4, 1), 'c': (5, 1), 'e': (6, 1), 'sw': (4, 2), 's': (5, 2), 'se': (6, 2),
           'inw': (7, 0), 'ine': (8, 0), 'isw': (7, 1), 'ise': (8, 1), 'g': (7, 2)}
    for pid, (tx, ty) in pos.items():
        parts.append((edges[pid], YARD, tx, ty))
    return sheet((9, 3), parts), {'note': note}


def slabs_2x2(slabs):
    """줄 A 판석 깔기(style-r1 A 와 같은 격자): 윗줄 판석 x=0·16, 아랫줄 x=8·24(반 칸 어긋남, 감음)."""
    cv_rows = blank(32, 32)
    for (x, y), sl in zip(((0, 0), (16, 0), (8, 16), (24, 16)), slabs):
        for j, r in enumerate(sl):
            for i, ch in enumerate(r):
                cv_rows[(y + j) % 32][(x + i) % 32] = ch
    return mrows(cv_rows)


def slab(base, spots=(), w=16, h=16):
    m = blank(w, h)
    stone_a(m, 0, 0, w, h, base, spots)
    return mrows(m)


# 줄 A · 후보 1 — 잘 다듬은 판석, 풀이 경계석에 바로 닿는다
def yard_a1():
    v1 = slabs_2x2([
        slab(4, [(4, 5, '3'), (5, 5, '3'), (11, 9, '5'), (12, 9, '5'), (7, 12, '3')]),
        slab(4, [(9, 3, '5'), (10, 3, '5'), (3, 10, '3'), (4, 11, '3'), (5, 11, '3')]),
        slab(3, [(5, 4, '4'), (6, 4, '4'), (10, 11, '2')]),
        slab(4, [(3, 3, '3'), (12, 6, '5'), (6, 12, '3'), (7, 12, '3')]),
    ])
    v2 = slabs_2x2([  # 금 간 판석·모서리 깨진 판석
        slab(4, [(5, 3, '2'), (6, 4, '2'), (6, 5, '2'), (7, 6, '2'), (8, 7, '2'), (8, 8, '2'), (9, 9, '2'), (7, 4, '5'), (9, 7, '5')]),
        slab(3, [(4, 6, '4'), (10, 10, '2'), (11, 10, '2')]),
        slab(4, [(13, 1, '1'), (14, 1, '1'), (14, 2, '1'), (12, 1, '2'), (13, 2, '2'), (14, 3, '2'), (4, 9, '3'), (5, 9, '3')]),
        slab(5, [(6, 5, '4'), (7, 5, '4'), (11, 11, '6'), (3, 12, '4')]),
    ])
    o = 6

    def curb(m, pid, oo):
        for (x, y, w, h, side) in curb_rects(oo)[pid]:
            stone_a(m, x, y, w, h, 4, [])
        if pid == 'n':
            m[10][5] = m[10][6] = '3'
        if pid == 'w':
            m[9][11] = m[10][11] = '3'

    P = {'gd': 6, 'dd': 0, 'curb': curb,
         'tx': {2: 1, 3: 2, 4: 1, 9: 1, 12: 2, 13: 1},
         'ty': {1: 1, 5: 2, 6: 1, 11: 1, 14: 2},
         'single': lambda: slab(4, [(5, 5, '3'), (6, 5, '3'), (10, 10, '5')])}
    return yard_set(v1, v2, yard_edges(P),
                    '줄 A · 다듬은 큰 판석(style 판석 화법 그대로). 변형 = 금 간 판석·모서리 깨진 판석. 가장자리 = 판석 화법 경계석(10px)에 풀이 바로 닿고 포기가 경계석 위로 조금 내민다.')


# 줄 A · 후보 2 — 오래된 마당: 판석 틈에 풀, 경계석과 풀 사이 흙 띠
def yard_a2():
    def grassy(rows, pts):
        return setc(rows, pts)
    v1 = slabs_2x2([
        slab(4, [(3, 4, '3'), (10, 6, '5'), (11, 6, '5'), (6, 11, '3')]),
        slab(3, [(8, 4, '4'), (4, 10, '2'), (11, 12, '4')]),
        slab(4, [(5, 3, '5'), (6, 3, '5'), (9, 10, '3'), (10, 10, '3')]),
        slab(4, [(11, 4, '3'), (4, 8, '5'), (8, 12, '3')]),
    ])
    v1 = grassy(v1, [(0, 5, 'd'), (0, 6, 'e'), (16, 3, 'd'), (21, 16, 'd'), (22, 16, 'e'), (8, 24, 'e'), (8, 25, 'd'), (31, 0, 'd')])
    v2 = slabs_2x2([
        slab(5, [(4, 4, '4'), (5, 4, '4'), (12, 9, '6')]),
        slab(4, [(3, 3, '2'), (4, 4, '2'), (5, 4, '2'), (6, 5, '2'), (7, 6, '2'), (5, 3, '5'), (8, 6, '5'), (11, 12, '3')]),
        slab(3, [(6, 6, '4'), (10, 9, '2')]),
        slab(4, [(7, 3, '3'), (8, 3, '3'), (12, 11, '5')]),
    ])
    v2 = grassy(v2, [(16, 7, 'd'), (16, 8, 'e'), (16, 9, 'd'), (4, 0, 'e'), (5, 0, 'd'), (24, 20, 'd'), (24, 21, 'e'), (12, 16, 'd'), (13, 16, 'e'), (0, 26, 'd')])

    def curb(m, pid, oo):
        for (x, y, w, h, side) in curb_rects(oo)[pid]:
            stone_a(m, x, y, w, h, 3, [])

    P = {'gd': 4, 'dd': 3, 'curb': curb,
         'tx': {1: 1, 6: 2, 7: 1, 11: 1, 14: 2},
         'ty': {3: 1, 8: 2, 9: 1, 13: 1},
         'single': lambda: setc(slab(4, [(9, 9, '5'), (4, 6, '3')]), [(0, 7, 'd'), (0, 8, 'e'), (7, 0, 'd')])}
    return yard_set(v1, v2, yard_edges(P),
                    '줄 A · 오래 쓴 판석 마당: 판석 틈 곳곳에 풀. 가장자리 = 조금 어두운 경계석(9px) + 흙 띠(3px) + 풀.')


# 줄 B — 장대석 줄(style-r1 B 와 같은 줄 높이 11·10·11)
def course(stones, shift, hgt, w=32):
    """style-r1 _course 와 같은 화법, 폭만 바꿀 수 있게. stones = [(폭, 바탕 단, {(dx, dy): 단})]."""
    rows = [[] for _ in range(hgt)]
    for sw, b, mot in stones:
        for dy in range(hgt):
            for dx in range(sw):
                if dy == 0 or dx == sw - 1:
                    c = 1
                elif dy == hgt - 1 or dx == sw - 2:
                    c = b - 1
                elif dy == 1:
                    c = b + 1
                else:
                    c = mot.get((dx, dy), b)
                rows[dy].append(str(c))
    rows = [''.join(r) for r in rows]
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    return [r[-shift:] + r[:-shift] if shift else r for r in rows]


def courses_b(c1, c2, c3):
    return course(*c1[:2], 11) + course(*c2[:2], 10) + course(*c3[:2], 11)


def yard_b1():
    v1 = courses_b(([(18, 4, {(5, 4): 3, (6, 4): 3, (12, 7): 5}), (14, 3, {(4, 5): 4, (9, 3): 2})], 3),
                   ([(22, 4, {(3, 3): 5, (4, 3): 5, (15, 6): 3, (16, 6): 3}), (10, 4, {(4, 4): 3})], 12),
                   ([(15, 4, {(4, 4): 3, (5, 4): 3, (10, 7): 5}), (17, 3, {(6, 6): 4, (11, 3): 2})], 21))
    v2 = courses_b(([(13, 3, {(4, 4): 2, (5, 5): 2, (6, 6): 2}), (19, 4, {(5, 3): 5, (6, 3): 5, (12, 6): 3})], 9),
                   ([(16, 4, {(3, 5): 3, (4, 5): 3, (9, 3): 5}), (16, 5, {(6, 4): 6, (10, 6): 4})], 20),
                   ([(21, 4, {(4, 6): 3, (13, 3): 5, (14, 3): 5}), (11, 3, {(3, 4): 4})], 6))

    def curb(m, pid, oo):
        # 장대석 경계석: 이음을 칸 안(8px)에 두어 칸 경계에서 돌이 끊기지 않게
        for (x, y, w, h, side) in curb_rects(oo)[pid]:
            if w == 16 or h == 16:
                # 돌 하나가 16px 를 한 바퀴 감는다 → 이음 한 줄/주기. 가로 줄눈 행은 v1 줄 경계(y=11)에 맞춘다
                stone_b_side(m, x, y, w, h, 4, side, ring=[(-5 if w >= h else 11, 16, 4)])
            else:
                stone_b_side(m, x, y, w, h, 4, side)

    P = {'gd': 6, 'dd': 0, 'curb': curb,
         'tx': {0: 1, 4: 2, 5: 1, 10: 1, 13: 1},
         'ty': {2: 1, 7: 2, 8: 1, 12: 1},
         'single': lambda: course([(16, 4, {(5, 3): 5, (6, 3): 5, (10, 5): 3})], 6, 8, 16) +
         course([(16, 3, {(4, 4): 4, (11, 3): 2})], 13, 8, 16)}
    return yard_set(v1, v2, yard_edges(P),
                    '줄 B · 긴 장대석 줄(style 줄 높이 11·10·11 그대로, 돌 길이 10~22px). 변형 = 금 간 돌·밝은 새 돌. 가장자리 = 장대석 화법 경계석에 풀이 바로 닿는다.')


def yard_b2():
    v1 = courses_b(([(12, 4, {(4, 4): 3, (5, 4): 3}), (10, 4, {(3, 5): 5}), (10, 3, {(4, 3): 2})], 2),
                   ([(14, 4, {(5, 3): 5, (6, 3): 5}), (8, 3, {(3, 4): 4}), (10, 4, {(4, 6): 3})], 9),
                   ([(9, 4, {(3, 4): 3}), (13, 4, {(6, 7): 5, (7, 7): 5}), (10, 3, {(4, 5): 2})], 15))
    v2 = courses_b(([(10, 4, {(3, 3): 5}), (12, 3, {(5, 5): 2, (6, 5): 2}), (10, 4, {(4, 7): 3})], 7),
                   ([(9, 5, {(3, 4): 6}), (12, 4, {(4, 3): 3, (5, 3): 3}), (11, 4, {(6, 6): 5})], 1),
                   ([(13, 4, {(5, 4): 3, (6, 4): 3}), (9, 4, {(3, 6): 5}), (10, 3, {(4, 4): 4})], 12))

    def curb(m, pid, oo):
        # 짧은 경계석: 가장자리 방향으로 8px 마다 돌 하나, 밝기를 번갈아(4·3)
        for (x, y, w, h, side) in curb_rects(oo)[pid]:
            if w == 16 or h == 16:
                stone_b_side(m, x, y, w, h, 4, side, ring=[(-4, 8, 4), (4, 8, 3)])
            else:
                stone_b_side(m, x, y, w, h, 4, side)

    P = {'gd': 5, 'dd': 3, 'curb': curb,
         'tx': {2: 1, 3: 1, 8: 2, 9: 1, 13: 1},
         'ty': {0: 1, 4: 1, 10: 2, 11: 1},
         'single': lambda: course([(8, 4, {(3, 3): 5}), (8, 3, {})], 0, 8, 16) +
         course([(8, 3, {(4, 4): 2}), (8, 4, {(3, 3): 5})], 4, 8, 16)}
    return yard_set(v1, v2, yard_edges(P),
                    '줄 B · 짧은 장대석(8~14px)을 촘촘히. 가장자리 = 8px 짧은 경계석(밝기 번갈아) + 흙 띠 + 풀(강남 골목 마당).')


# ---------------------------------------------------------------------------
# 3. 객잔 벽 세트 (12×2) — l(1) m(3) win(3) door(4) r(1)
# 기둥은 24px 간격. 모든 조각이 첫 기둥을 x=9(왼끝은 1, 오른끝은 9)에 두어 어떤 순서로 이어도 간격이 유지된다.
# 기둥 사이 칸(bay, 18px)의 무늬는 기둥에 붙여 그린다 → 조각 경계에서 칸이 잘려도 이어진다.
# 바탕 줄은 16 주기라 조각 순서와 상관없이 맞물린다.
# ---------------------------------------------------------------------------
WL = dict(S.WALL_LEG)
WL.update({'A': ('wa', 1), 'B': ('wa', 2), 'C': ('wa', 3), 'D': ('wa', 4), 'E': ('wa', 5), 'F': ('wa', 6), 'O': ('wa', 0),
           'Z': ('mu', 0), 'k': ('shi', 6), 'l': ('shi', 1)})


def overlay(rows, ov, x0, y0=0, w=None):
    """rows(글자 목록 리스트) 위에 ov 를 (x0, y0) 부터 덮는다. '.' 는 건너뛴다. 조각 밖은 자른다(감지 않음)."""
    W = len(rows[0])
    for j, r in enumerate(ov):
        for i, ch in enumerate(r):
            X, Y = x0 + i, y0 + j
            if ch != '.' and 0 <= X < W and 0 <= Y < len(rows):
                rows[Y][X] = ch


def wall_piece(width, W, pillars, bays, extra=(), stains=()):
    """W = 후보 정의 {'bg': 16폭 32행, 'bay': 18폭 32행('.' 투명), 'pil': (dx, 행들), 'post_l': .., 'post_r': ..}.
    pillars = 기둥 x 목록, bays = 칸 시작 x 목록(음수 가능), extra = [(행들, x, y)] 창·문, stains = [(x, y, 글자)]."""
    rows = [list((r * (width // 16 + 1))[:width]) for r in W['bg']]
    for bx in bays:
        overlay(rows, W['bay'], bx)
    for ov, x, y in extra:
        overlay(rows, ov, x, y)
    for px in pillars:
        dx, pr = W['pil']
        overlay(rows, pr, px + dx)
    for x, y, ch in stains:
        rows[y][x] = ch
    return [''.join(r) for r in rows]


def wall_set(W, note, top):
    """조각 다섯을 만든다. 왼끝 l: 바깥 테두리 + 기둥(1). 오른끝 r: 기둥(9) + 바깥 테두리."""
    l = wall_piece(16, W, [1], [7], stains=W['st']['l'])
    overlay_l = [list(r) for r in l]
    overlay(overlay_l, W['edge_l'], 0)
    l = [''.join(r) for r in overlay_l]
    m = wall_piece(48, W, [9, 33], [-9, 15, 39], stains=W['st']['m'])
    win = wall_piece(48, W, [9, 33], [-9, 15, 39], extra=[(W['win'], 15 + W['win_dx'], W['win_y'])], stains=W['st']['win'])
    door = wall_piece(64, W, [9, 49], [-9, 55], extra=[(W['door'], 15, 0)], stains=W['st']['door'])
    r = wall_piece(16, W, [9], [-9], stains=W['st']['r'])
    overlay_r = [list(x) for x in r]
    overlay(overlay_r, W['edge_r'], 15)
    r = [''.join(x) for x in overlay_r]
    cv = sheet((12, 2), [(l, WL, 0, 0), (m, WL, 1, 0), (win, WL, 4, 0), (door, WL, 7, 0), (r, WL, 11, 0)])
    return cv, {'note': note, 'pieces': {k: {'top': top} for k in ('l', 'm', 'win', 'door', 'r')}}


def col(ch_by_row):
    """세로 한 열(32행) 덮개: {행: 글자} 또는 (y0, y1, 글자) 목록 → 1폭 행 목록."""
    out = ['.'] * 32
    for y0, y1, ch in ch_by_row:
        for y in range(y0, y1):
            out[y] = ch
    return out


# --- 줄 A · 후보 1: style 그대로(보 윗면 3행·띠장·굽도리·살창). 문 칸 = 나무 문틀·문지방, 안은 어둡다.
A1_BG = (["b" * 16, "e" * 16, "d" * 16, "a" * 16, "d" * 16, "c" * 16, "c" * 16, "b" * 16, "a" * 16, "2" * 16]
         + ["6" * 16] * 7 + ["d" * 16, "c" * 16, "b" * 16] + ["6" * 16] * 7
         + ["5" * 16, "d" * 16, "c" * 16, "b" * 16, "a" * 16])
assert len(A1_BG) == 32
A1_PIL = (-1, ["." * 9] * 9 + [".rssssr.."] + [".ruvutr45"] * 7 + [".ruvutr.."] * 3 + [".ruvutr45"] * 7
          + [".ruvutr4.", "hjjjjjjh.", "giiiiiih.", "ghhhhhhg.", "........."])
A1_WIN = ["bbbbbbbbbbbb", "b5c55c55c55b", "bccccccccccb", "b5c55c55c55b", "b5c55c55c55b",
          "bccccccccccb", "b5c55c55c55b", "eddddddddddd", "bbbbbbbbbbbb"]
A1_DOOR = (["." * 34] * 9
           + ["a" + "d" * 32 + "a", "a" + "c" * 32 + "a", "a" + "b" * 32 + "a", "c" + "K" * 32 + "c"]
           + ["c" + "Z" * 32 + "c"] * 11
           + ["c" + "a" * 32 + "c", "c" + "a" * 32 + "c", "c" + "b" * 32 + "c", "c" + "b" * 32 + "c"]
           + ["e" * 34, "d" * 34, "c" * 34, "a" * 34])
assert len(A1_DOOR) == 32
A1 = {
    'bg': A1_BG, 'bay': ["." * 18] * 32, 'pil': A1_PIL,
    'win': A1_WIN, 'win_dx': 3, 'win_y': 10, 'door': A1_DOOR,
    'edge_l': col([(0, 9, 'a'), (9, 28, 'r')]), 'edge_r': col([(0, 9, 'a'), (9, 28, 'r')]),
    'st': {
        'l': [(5, 1, 'f'), (6, 1, 'f'), (10, 5, 'b'), (11, 5, 'b'), (11, 13, '5'), (12, 13, '5')],
        'm': [(4, 1, 'f'), (5, 1, 'f'), (29, 1, 'f'), (30, 1, 'f'), (31, 1, 'f'), (17, 5, 'b'), (18, 5, 'b'), (40, 6, 'b'), (41, 6, 'b'),
              (20, 12, '5'), (21, 12, '5'), (43, 22, '5'), (44, 22, '5'), (24, 24, '5')],
        'win': [(10, 1, 'f'), (11, 1, 'f'), (36, 1, 'f'), (37, 1, 'f'), (5, 5, 'b'), (6, 5, 'b'), (42, 13, '5'), (43, 13, '5'), (19, 23, '5'), (20, 23, '5')],
        'door': [(8, 1, 'f'), (9, 1, 'f'), (52, 1, 'f'), (53, 1, 'f'), (30, 5, 'b'), (31, 5, 'b'), (58, 14, '5'), (59, 14, '5'), (3, 22, '5'), (4, 22, '5')],
        'r': [(3, 1, 'f'), (4, 1, 'f'), (6, 6, 'b'), (7, 6, 'b'), (2, 21, '5'), (3, 21, '5')],
    },
}


def wall_a1():
    return wall_set(A1, '줄 A · style 벽 그대로(흰 회벽·주칠 둥근 기둥 24px·보 윗면 3행·띠장·굽도리·초석). 왼끝·오른끝 = 모서리 기둥과 보 끝. 창 칸 = 살창, 문 칸 = 나무 문틀·문지방(문간 2칸).', (0, 3))


# --- 줄 A · 후보 2: 보 아래 주칠 낙양각(花牙子) 띠·띠장 없는 높은 회벽·청석 기단. 창 칸 = 둥근 창(月窗).
A2_BG = (["b" * 16, "e" * 16, "d" * 16, "a" * 16, "d" * 16, "c" * 16, "b" * 16, "a" * 16]
         + ["vvvvvvvvvvvvvvvv",     # 낙양 위 띠(밝은 주칠)
            "ttstt4444ttstt44",     # 낙양 투각: 주칠 살 사이로 그늘진 회벽(4)
            "t44s4444t44s4444",
            "44444ts44444ts44",
            "rrrrrrrrrrrrrrrr"]     # 낙양 아래 테
         + ["6" * 16] * 12 + ["5" * 16]
         + ["l" * 16, "k" * 16, "j" * 16, "i" * 16, "h" * 16, "g" * 16])   # 청석 기단(틈 l·윗면 k j·앞면 i h g)
assert len(A2_BG) == 32, len(A2_BG)
A2_PIL = (-1, ["." * 9] * 8 + [".rvvutr.."] + [".ruvutr.."] * 4 + [".ruvutr45"] * 10
          + ["hjjjjjjh4", "giiiiiih4", "ghhhhhhg."]
          + ["." * 9] * 6)
assert len(A2_PIL[1]) == 32, len(A2_PIL[1])
A2_BAY = ["." * 18] * 29 + [".........h........", ".........h........", "." * 18]
A2_WIN = [   # 둥근 창 14×12: 주칠 테(왼쪽 위 밝음) 안에 창호지와 살 두 줄
    ".....rrrr.....",
    "...rrvvvvrr...",
    "..rvvr55rrur..",
    ".rvr5t55t5rtr.",
    ".rvr5t55t5rtr.",
    "rvr5tttttt5rtr",
    "rur55t55t55rtr",
    "rur55t55t55rtr",
    ".rur5tttt5rtr.",
    ".rtr5t55t5rtr.",
    "..rttrrrrttr..",
    "...rrttttrr...",
]
A2_WIN = [r.ljust(14, '.') for r in A2_WIN]
A2_DOOR = (["." * 34] * 13
           + ["a" + "K" * 32 + "a"] + ["a" + "Z" * 32 + "a"] * 8 + ["a" + "a" * 32 + "a"] * 3
           + ["a" + "b" * 32 + "a"]
           + ["l" * 34, "k" * 34, "j" * 34, "i" * 34, "h" * 34, "g" * 34])
assert len(A2_DOOR) == 32, len(A2_DOOR)
A2 = {
    'bg': A2_BG, 'bay': A2_BAY, 'pil': A2_PIL,
    'win': A2_WIN, 'win_dx': 2, 'win_y': 13, 'door': A2_DOOR,
    'edge_l': col([(0, 8, 'a'), (8, 26, 'r')]), 'edge_r': col([(0, 8, 'a'), (8, 26, 'r')]),
    'st': {
        'l': [(6, 1, 'f'), (7, 1, 'f'), (11, 16, '5'), (12, 16, '5')],
        'm': [(3, 1, 'f'), (4, 1, 'f'), (27, 1, 'f'), (28, 1, 'f'), (19, 5, 'b'), (20, 5, 'b'), (22, 17, '5'), (23, 17, '5'), (42, 21, '5'), (43, 21, '5')],
        'win': [(12, 1, 'f'), (13, 1, 'f'), (39, 1, 'f'), (40, 1, 'f'), (3, 5, 'b'), (4, 5, 'b'), (43, 19, '5'), (44, 19, '5')],
        'door': [(6, 1, 'f'), (7, 1, 'f'), (56, 1, 'f'), (57, 1, 'f'), (60, 18, '5'), (61, 18, '5'), (2, 15, '5'), (3, 15, '5')],
        'r': [(2, 1, 'f'), (3, 1, 'f'), (4, 20, '5'), (5, 20, '5')],
    },
}


def wall_a2():
    return wall_set(A2, '줄 A · 보 아래 주칠 낙양각 띠·띠장 없는 높은 흰 회벽·청석 기단(초석이 기단 위). 창 칸 = 둥근 창(月窗), 문 칸 = 기단을 디딤돌로 쓰는 문간.', (0, 3))


# --- 줄 B · 후보 1: style 벽 그대로(기와 담머리·금띠 보·황토 회벽·판벽 징두리·까치발). 창 칸 = 주칠 창살, 문 칸 = 나무 문틀.
B_TOP = ["B" * 16, "DEDC" * 4, "DEDC" * 4, "CDCB" * 4, "BDEB" * 4, "KAAK" * 4, "d" * 16, "x" * 16, "c" * 16, "b" * 16, "a" * 16]
B1_BG = B_TOP + ["p" * 16] * 9 + ["e" * 16, "d" * 16, "b" * 16] + ["c" * 16] * 7 + ["b" * 16, "a" * 16]
assert len(B1_BG) == 32
B1_BAY = (["." * 18] * 11 + ["mno..............m"] + ["no................"] * 8 + ["." * 18] * 3
          + ["cddddddddcdddddddc", "cdbbbbbbbcdbbbbbbc", "cdbbbbbbbcdbbbbbbc", "cdbbcbbbbcdbbbcbbc",
             "cdbbbbbbbcdbbbbbbc", "cdbbbbbbbcdbbbbbbc", "caaaaaaaacaaaaaaac"]
          + ["." * 18] * 2)
assert len(B1_BAY) == 32
B1_PIL = (-4, ["." * 14] * 10 + ["....rssssr....", "tuuuruvutruuut", "rtuuruvutruutr", ".rtyruvutrytr.", "..ryruvutryr.."]
          + ["....ruvutr...."] * 13 + ["...hjjjjjjh...", "...giiiiiih...", "...ghhhhhhg...", ".............."])
assert len(B1_PIL[1]) == 32
B1_WIN = ["ssssssssssss", "sqtqqtqqtqqs", "sttttttttttS".replace('S', 's'), "sqtqqtqqtqqs", "sqtqqtqqtqqs",
          "ssssssssssss", "vvvvvvvvvvvv"]
B1_DOOR = (["." * 34] * 11
           + ["a" + "d" * 32 + "a", "a" + "c" * 32 + "a", "a" + "K" * 32 + "a"]
           + ["c" + "Z" * 32 + "c"] * 10
           + ["c" + "a" * 32 + "c", "c" + "a" * 32 + "c", "c" + "b" * 32 + "c", "c" + "b" * 32 + "c"]
           + ["e" * 34, "d" * 34, "c" * 34, "a" * 34])
B1_DOOR = B1_DOOR[:32]
assert len(B1_DOOR) == 32, len(B1_DOOR)
B1 = {
    'bg': B1_BG, 'bay': B1_BAY, 'pil': B1_PIL,
    'win': B1_WIN, 'win_dx': 3, 'win_y': 12, 'door': B1_DOOR,
    'edge_l': col([(0, 5, 'A'), (5, 10, 'a'), (10, 29, 'r')]), 'edge_r': col([(0, 5, 'A'), (5, 10, 'a'), (10, 29, 'r')]),
    'st': {
        'l': [(10, 2, 'F'), (12, 14, 'q'), (13, 14, 'q')],
        'm': [(5, 2, 'F'), (21, 2, 'F'), (37, 2, 'F'), (10, 8, 'b'), (11, 8, 'b'), (35, 8, 'b'), (24, 15, 'q'), (25, 15, 'q'), (44, 17, 'o'), (45, 17, 'o')],
        'win': [(13, 2, 'F'), (45, 2, 'F'), (6, 8, 'b'), (7, 8, 'b'), (42, 16, 'q'), (43, 16, 'q')],
        'door': [(1, 2, 'F'), (57, 2, 'F'), (26, 8, 'b'), (27, 8, 'b'), (59, 14, 'q'), (60, 14, 'q')],
        'r': [(6, 2, 'F'), (3, 16, 'q'), (4, 16, 'q')],
    },
}


def wall_b1():
    return wall_set(B1, '줄 B · style 벽 그대로(청회 기와 담머리·금띠 보·황토 회벽·짙은 판벽 징두리·기둥 까치발). 창 칸 = 주칠 창살, 문 칸 = 나무 문틀·문지방.', (0, 4))


# --- 줄 B · 후보 2: 담머리·금띠 보는 같고, 판벽 대신 황토 회벽이 청석 굽까지 내려온다. 까치발 대신 기둥머리 금테.
#     창 칸 = 기와 조각으로 짠 누창(漏窗, 강남 담장 꽃창), 문 칸 = 돌 문틀(石庫門).
B2_BG = B_TOP + ["p" * 16] * 14 + ["o" * 16] + ["l" * 16, "k" * 16, "j" * 16, "i" * 16, "h" * 16, "g" * 16]
assert len(B2_BG) == 32, len(B2_BG)
B2_BAY = (["." * 18] * 11 + ["no................"] * 14 + ["o" + "." * 17]
          + ["." * 18, ".........l........", ".........i........", ".........h........", "." * 18, "." * 18])
assert len(B2_BAY) == 32, len(B2_BAY)
B2_PIL = (-1, ["." * 8] * 10 + [".xyyyyx.", ".zyyyyx."] + [".ruvutr."] * 12 + [".ruvutr.", "hjjjjjjh"]
          + ["l" * 8, "k" * 8, "j" * 8, "i" * 8, "h" * 8, "g" * 8])
assert len(B2_PIL[1]) == 32, len(B2_PIL[1])
B2_WIN = [   # 누창 12×10: 청석 테, 안에 기와 조각 동전 무늬
    "kjjjjjjjjjjh",
    "jBDDBBBBDDBh",
    "jDKKDBBDKKDh",
    "jDKKDBBDKKDh",
    "jBDDBDDBDDBh",
    "jBBBDKKDBBBh",
    "jBDDBDDBDDBh",
    "jDKKDBBDKKDh",
    "jBDDBBBBDDBh",
    "hhhhhhhhhhhg",
]
B2_DOOR = (["." * 34] * 11
           + ["k" + "j" * 32 + "h", "j" + "i" * 32 + "h", "j" + "h" * 32 + "h"]
           + ["j" + "K" * 32 + "g"] + ["j" + "Z" * 32 + "g"] * 11
           + ["j" + "a" * 32 + "g"]
           + ["k" * 34, "j" * 34, "i" * 34, "h" * 34, "g" * 34])
assert len(B2_DOOR) == 32, len(B2_DOOR)
B2 = {
    'bg': B2_BG, 'bay': B2_BAY, 'pil': B2_PIL,
    'win': B2_WIN, 'win_dx': 3, 'win_y': 13, 'door': B2_DOOR,
    'edge_l': col([(0, 5, 'A'), (5, 10, 'a'), (10, 26, 'r')]), 'edge_r': col([(0, 5, 'A'), (5, 10, 'a'), (10, 26, 'r')]),
    'st': {
        'l': [(11, 2, 'F'), (11, 15, 'q'), (12, 15, 'q')],
        'm': [(2, 2, 'F'), (26, 2, 'F'), (42, 2, 'F'), (14, 8, 'b'), (15, 8, 'b'), (21, 18, 'q'), (22, 18, 'q'), (44, 13, 'q'), (45, 13, 'q')],
        'win': [(9, 2, 'F'), (33, 2, 'F'), (40, 8, 'b'), (41, 8, 'b'), (40, 20, 'q'), (41, 20, 'q')],
        'door': [(4, 2, 'F'), (60, 2, 'F'), (12, 8, 'b'), (13, 8, 'b'), (3, 19, 'q'), (4, 19, 'q'), (58, 16, 'q'), (59, 16, 'q')],
        'r': [(4, 2, 'F'), (2, 18, 'q'), (3, 18, 'q')],
    },
}


def wall_b2():
    return wall_set(B2, '줄 B · 담머리·금띠 보는 같고 판벽 대신 황토 회벽이 청석 굽까지. 기둥머리 금테. 창 칸 = 기와 조각 누창(강남 담장 꽃창), 문 칸 = 돌 문틀(石庫門)·디딤돌.', (0, 4))


# ---------------------------------------------------------------------------
# 4. 기와 지붕 세트 (3×3) — 용마루·사면·처마 줄 × 왼끝·가운데·오른끝
# 가운데 열: 16 주기 무늬(용마루 8행 + 사면 줄 시작, 사면 16행, 사면 8행 + 처마 8행). 사면은 4행 단(段)이라 위아래로도 이어진다.
# 끝 열: 박공 쪽 수키와 띠(垂脊) 4px + 사면, 용마루 끝 장식, 처마 끝은 열마다 손으로 정한 높이(dy)만큼 들어 올린다(추녀).
# 오른끝은 모양만 거울로 뒤집고, 사면·처마 무늬는 가운데와 같은 자리에서 가져온다(빛 방향 유지).
# ---------------------------------------------------------------------------
def rep16(unit):
    return (unit * (16 // len(unit) + 1))[:16]


def roof_pieces(P):
    """P: ridge(8행) slope(16행) eave(8행) 각 16폭 · vL/vR 박공 띠(4폭, 4행 주기) · vx 박공 띠 시작 열 · ornL 용마루 끝 장식(8행, '.' 투명)
    · dy 처마 끝 들림(왼끝 열 0~15) · tipL 추녀 끝 덧그림 [(x, y, 글자)]. 반환 {조각 id: 행 목록}."""
    R, Sl, E = P['ridge'], P['slope'], P['eave']
    vx = P['vx']
    out = {}
    out['rm'] = R + Sl[:8]
    out['sm'] = list(Sl)
    out['em'] = Sl[:8] + E

    def side(mirror):
        def gx(x):           # 거울 좌표(모양용)
            return 15 - x if mirror else x
        vband = P['vR'] if mirror else P['vL']
        rl, sl, el = blank(), blank(), blank()
        for y in range(16):
            for x in range(16):
                g = gx(x)
                # 사면·박공(용마루 줄 아래 8행, 사면 줄 16행)
                for tile, yy, src_y in ((rl, y, y - 8), (sl, y, y)):
                    if src_y < 0:
                        continue
                    if g >= vx + 4:
                        tile[yy][x] = Sl[src_y % 16][x]
                    elif g >= vx:
                        tile[yy][x] = vband[src_y % 4][(g - vx) if not mirror else (3 - (g - vx))]
                # 용마루 줄 위 8행
                if y < 8 and g >= vx + 1:
                    rl[y][x] = R[y][x]
                # 처마 끝: 열마다 들린 만큼 처마 띠를 올린다
                d = P['dy'][g]
                t = y + d - 8
                if 0 <= t < 8:
                    el[y][x] = E[t][x]
                elif t < 0:
                    if g >= vx + 4:
                        el[y][x] = Sl[y % 16][x]
                    elif g >= vx:
                        el[y][x] = vband[y % 4][(g - vx) if not mirror else (3 - (g - vx))]
        orn = P['ornL']
        for j, r in enumerate(orn):
            for i, ch in enumerate(r):
                if ch != '.':
                    rl[j][gx(i)] = ch
        for x, y, ch in P.get('tipL', []):
            el[y][gx(x)] = ch
        return [mrows(rl), mrows(sl), mrows(el)]

    out['rl'], out['sl'], out['el'] = side(False)
    out['rr'], out['sr'], out['er'] = side(True)
    return out


# 윗면 행: 용마루 윗면(1~2행) / 사면은 한 단 아래 어두운 겹침 줄 앞까지 / 처마 줄은 막새 단까지(style-r1 roof_b 와 같은 선언)
ROOF_TOPS = {'rl': (1, 3), 'rm': (1, 3), 'rr': (1, 3), 'sl': (0, 15), 'sm': (0, 15), 'sr': (0, 15), 'el': (0, 11), 'em': (0, 11), 'er': (0, 11)}
ROOF_TOPS_B = dict(ROOF_TOPS, sl=(0, 12), sm=(0, 12), sr=(0, 12))


def roof_set(P, note, legend=None):
    pcs = roof_pieces(P)
    pos = {'rl': (0, 0), 'rm': (1, 0), 'rr': (2, 0), 'sl': (0, 1), 'sm': (1, 1), 'sr': (2, 1), 'el': (0, 2), 'em': (1, 2), 'er': (2, 2)}
    cv = sheet((3, 3), [(pcs[k], legend or WL, x, y) for k, (x, y) in pos.items()])
    return cv, {'note': note, 'pieces': {k: {'top': P.get('tops', ROOF_TOPS)[k]} for k in pos}}


def courses(rows_by_kind, order, offsets=None):
    """사면 16행: order = 행마다 단 종류(lip·body·joint …), offsets = 행마다 가로 밀기(비늘 어긋남)."""
    out = []
    for y, k in enumerate(order):
        r = rep16(rows_by_kind[k])
        o = offsets[y] if offsets else 0
        out.append(r[-o:] + r[:-o] if o else r)
    return out


# 처마 끝 들림(왼끝 열 x=0..15 의 dy). 박공 띠 밖(x<4)은 추녀 끝이 위로 들린다.
DY_SOFT = [6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0]
DY_HIGH = [8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 0, 0, 0]

# --- 줄 A · 후보 1: style 수키와(볼록 기와 + 골, 8px)·둥근 막새·주칠 서까래 끝. 용마루는 민무늬, 끝에 치미(꼬리 들린 장식).
A1_ROOF = {
    'ridge': ["C" * 16, rep16("DEED"), "D" * 16, rep16("CCCCCCCB"), "B" * 16, rep16("BBBABBBB"), "A" * 16, rep16("ACCBAAAA")],
    'slope': courses({'lip': "AFFEDABB", 'body': "AEEDCABB", 'body2': "AEDDCABB", 'joint': "ACCBAAAA"},
                     ['lip', 'body', 'body2', 'joint'] * 4),
    'eave': [rep16("ACDDCAAA"), rep16("DFEEDBAA"), rep16("DEEEDBAA"), rep16("CDDDCAAA"),
             rep16("ACCCAAAA"), "A" * 16, rep16("rvurrvur"), rep16("rutrrutr")],
    'vL': ["CFEA", "CEDA", "CEDA", "CBBA"], 'vR': ["AEDA", "AEDA", "ADCA", "ABBA"], 'vx': 4,
    'ornL': ["..CCC...", ".CEDA...", ".CDCAAAA", "..CDCCDE", "...CCCDD", "...CBCCC", "....CBBB", "....CAAA"],
    'dy': DY_SOFT,
    'tipL': [(0, 1, 'C'), (1, 1, 'C'), (0, 2, 'A')],
}


def roof_a1():
    return roof_set(A1_ROOF, '줄 A · style 수키와(볼록 기와+골, 8px 단위·4행 단)·둥근 막새·주칠 서까래 끝. 민무늬 용마루 끝에 치미, 박공 수키와 띠, 처마 끝이 부드럽게 들린다.')


# --- 줄 A · 후보 2: 가는 수키와(4px)·용마루 투각 띠·막새 두 겹·추녀가 높이 들린다.
A2_ROOF = {
    'ridge': ["K" * 16, rep16("DEEDEEDE"), "D" * 16, rep16("CBDBCCBD"), rep16("BCBCBBCB"), "A" * 16, rep16("KxyK"), "A" * 16],
    'slope': courses({'lip': "FDCB", 'body': "EDCB", 'joint': "CDBA"},
                     ['lip', 'body', 'body', 'joint'] * 4),
    'eave': [rep16("DEAB"), rep16("ECAK"), rep16("AAKK"), rep16("DEEB"), rep16("CDDA"), "K" * 16, rep16("KvuK"), rep16("KtsK")],
    'vL': ["KFDA", "KEDA", "KECA", "KCBA"], 'vR': ["ADCK", "ADCK", "ACBK", "ABAK"], 'vx': 4,
    'ornL': ["...KK...", "..KEDK..", ".KEDCK.K", ".KDCKKKD", "..KCKDEE", "...KDDDD", "...KCBDB", "...KBCBC"],
    'dy': DY_HIGH,
    'tipL': [(0, 0, 'K'), (1, 0, 'K'), (0, 1, 'E'), (0, 2, 'K')],
}


def roof_a2():
    return roof_set(A2_ROOF, '줄 A · 가는 수키와(4px 골)·용마루 투각 띠와 금 장식·막새 두 겹·추녀가 높이 들린 전각 지붕.')


# --- 줄 B · 후보 1: style 비늘 평기와(8×4, 단마다 반 장 어긋남)·주칠 처마판과 금 점. 용마루 끝은 제비꼬리(燕尾).
B_SCALE = {'s0': "ABBBBBBA", 's1': "BCDDDDCB", 's2': "CDEEEEDC", 's3': "BDEFEEDB"}
B1_ROOF = {
    'ridge': ["D" * 16, "E" * 16, "D" * 16, rep16("CCCB"), "B" * 16, "A" * 16, "A" * 16, rep16("ABBBBBBA")],
    'slope': courses(B_SCALE, ['s0', 's1', 's2', 's3'] * 4, [0, 0, 0, 0, 4, 4, 4, 4] * 2),
    'eave': [rep16("CDEFFEDC"), rep16("BDEEEEDB"), rep16("ACDDDDCA"), rep16("AAAAAAAA"),
             "v" * 16, rep16("uuuyyuuu"), "s" * 16, "r" * 16],
    'vL': ["CEDA", "CEDA", "CDCA", "CBAA"], 'vR': ["ADCA", "ADCA", "ACBA", "AABA"], 'vx': 4,
    'ornL': ["DD......", "DED.....", ".DEA....", ".DDEAAAA", "..CDDEEE", "...CDDDD", "....CCCC", "....CBBB"],
    'dy': DY_SOFT,
    'tipL': [(0, 2, 'A'), (0, 3, 'v')],
    'tops': ROOF_TOPS_B,
}


def roof_b1():
    return roof_set(B1_ROOF, '줄 B · style 비늘 평기와(8×4, 단마다 반 장 어긋남)·주칠 처마판·금 점. 용마루 끝 제비꼬리(燕尾脊), 처마 끝 부드럽게 들림.')


# --- 줄 B · 후보 2: 작은 비늘(4×4)·기와 조각 꽃용마루(花脊, 동전 무늬 구멍)·주칠 처마판에 금띠·추녀 높이 들림(嫩戗發戗).
B2_ROOF = {
    'ridge': ["K" * 16, rep16("EEDE"), rep16("DKKD"), rep16("CKKC"), rep16("DCCD"), "B" * 16, "K" * 16, rep16("ABBA")],
    'slope': courses({'s0': "ACCA", 's1': "CDDC", 's2': "DEFD", 's3': "BDDB"}, ['s0', 's1', 's2', 's3'] * 4, [0, 0, 0, 0, 2, 2, 2, 2] * 2),
    'eave': [rep16("BDDB"), rep16("ACCA"), rep16("KAAK"), "K" * 16, "v" * 16, "x" * 16, "s" * 16, "K" * 16],
    'vL': ["KFDA", "KEDA", "KDCA", "KBBA"], 'vR': ["EDCK", "EDCK", "DCBK", "CBBK"], 'vx': 4,
    'ornL': ["K.......", "KEK.....", "KDEK....", ".KDEKKKK", ".KCDKEED", "..KCKDDD", "...KKCCC", "....KBBB"],
    'dy': DY_HIGH,
    'tipL': [(0, 0, 'K'), (0, 1, 'x')],
    'tops': dict(ROOF_TOPS_B, el=(0, 8), em=(0, 8), er=(0, 8)),   # 추녀가 높이 들려 처마 줄은 사면(0~7행)만 윗면으로
}


def roof_b2():
    return roof_set(B2_ROOF, '줄 B · 작은 비늘 평기와(4×4)·기와 조각 꽃용마루(동전 무늬 구멍)·주칠 처마판에 금띠·추녀가 높이 들린 강남 지붕.')


# ---------------------------------------------------------------------------
# 5. 두 짝 판문 (2×2) — 벽 세트 문 칸의 문간(문 칸 x 16~47)에 그대로 얹는다.
# 위는 그 후보 벽의 보·담머리 줄(16 주기 바탕) 그대로, 문짝은 줄 행 틀(row kind)로 손으로 정했다.
# ---------------------------------------------------------------------------
def leaves(seq, L, R):
    """seq = 행마다 종류, L/R = 종류 → 왼짝·오른짝 16폭 행."""
    return [L[k] + R[k] for k in seq]


def door_rows(bg, top_n, mid, leaf_rows, bottom):
    rows = [rep16(r) * 2 for r in bg[:top_n]] + mid + leaf_rows + bottom
    assert len(rows) == 32 and all(len(r) == 32 for r in rows), (len(rows), [len(r) for r in rows])
    return rows


# 줄 A · 후보 1: 주칠 판문 + 금 문정(두 화소 세로 쌍) + 고리 문고리
A1_LEAF_L = {
    'top': "rsssssssssssssss", 'body': "rvuuuuuuuuuuuutr", 'stud': "rvuyuuyuuyuuyutr", 'stud2': "rvuxuuxuuxuuxutr",
    'ring0': "rvuuuuuuuuuxxutr", 'ring1': "rvuuuuuuuuxuuxtr", 'ring2': "rvuuuuuuuuxuuxtr", 'ring3': "rvuuuuuuuuuyyutr",
    'bot': "rrrrrrrrrrrrrrrr",
}
A1_LEAF_R = {
    'top': "sssssssssssssssr", 'body': "rvuuuuuuuuuuuutr", 'stud': "rvuyuuyuuyuuyutr", 'stud2': "rvuxuuxuuxuuxutr",
    'ring0': "rvuxxuuuuuuuuutr", 'ring1': "rvxuuxuuuuuuuutr", 'ring2': "rvxuuxuuuuuuuutr", 'ring3': "rvuyyuuuuuuuuutr",
    'bot': "rrrrrrrrrrrrrrrr",
}
A1_SEQ = ['top', 'body', 'stud', 'stud2', 'body', 'body', 'ring0', 'ring1', 'ring2', 'ring3', 'body', 'stud', 'stud2', 'body', 'body', 'bot']


def door_a1():
    rows = door_rows(A1_BG, 9, ["d" * 32, "c" * 32, "b" * 32], leaves(A1_SEQ, A1_LEAF_L, A1_LEAF_R), ["e" * 32, "d" * 32, "c" * 32, "a" * 32])
    return grid(rows, WL), {'top': (0, 3), 'note': '줄 A · 주칠 두 짝 판문·금 문정 넷 줄·고리 문고리. 위는 벽 A1 의 보 윗면·문미, 아래 문지방 윗면 — 벽 A1 문 칸에 얹는다.'}


# 줄 A · 후보 2: 주칠 격자 창호문(위 살창 + 창호지, 아래 궁창 판)
A2_LEAF = {
    'top': "rssssssssssssssr", 'latA': "rv6t66t66t66t6tr", 'latB': "rvtttttttttttttr", 'mid': "rvsssssssssssstr",
    'panT': "rvvvvvvvvvvvvvtr", 'pan': "rvuuuuuuuuuuuutr", 'panK': "rvuuuuxyyxuuuutr", 'bot': "rrrrrrrrrrrrrrrr",
}
A2_SEQ = ['top', 'latA', 'latB', 'latA', 'latA', 'latB', 'latA', 'mid', 'panT', 'pan', 'panK', 'pan', 'bot']


def door_a2():
    rows = door_rows(A2_BG, 13, [], leaves(A2_SEQ, A2_LEAF, A2_LEAF), [rep16(r) * 2 for r in A2_BG[26:32]])
    return grid(rows, WL), {'top': (0, 3), 'note': '줄 A · 주칠 격자 창호문(위 살창+창호지, 아래 궁창 판에 금 장식). 위는 벽 A2 의 보·낙양 띠, 아래 청석 기단 — 벽 A2 문 칸에 얹는다.'}


# 줄 B · 후보 1: 주칠 판문에 가로 금띠 둘 + 문고리
B1_LEAF_L = {
    'top': "rsssssssssssssss", 'body': "rvuuuuuuuuuuuutr", 'band': "rzyyyyyyyyyyyyxr", 'band2': "rxxxxxxxxxxxxxxr",
    'ring0': "rvuuuuuuuuuxxutr", 'ring1': "rvuuuuuuuuxuuxtr", 'ring2': "rvuuuuuuuuuyyutr", 'bot': "rrrrrrrrrrrrrrrr",
}
B1_LEAF_R = dict(B1_LEAF_L, top="sssssssssssssssr", ring0="rvuxxuuuuuuuuutr", ring1="rvxuuxuuuuuuuutr", ring2="rvuyyuuuuuuuuutr")
B1_SEQ = ['top', 'body', 'band', 'band2', 'body', 'body', 'ring0', 'ring1', 'ring2', 'body', 'body', 'band', 'band2', 'body', 'bot']


def door_b1():
    rows = door_rows(B1_BG, 11, ["d" * 32, "c" * 32], leaves(B1_SEQ, B1_LEAF_L, B1_LEAF_R), ["e" * 32, "d" * 32, "c" * 32, "a" * 32])
    return grid(rows, WL), {'top': (0, 4), 'note': '줄 B · 주칠 판문에 가로 금띠 둘·문고리. 위는 벽 B1 의 기와 담머리·금띠 보 — 벽 B1 문 칸에 얹는다.'}


# 줄 B · 후보 2: 짙은 나무 세로 판문(돌 문틀 안) + 쇠 문고리
B2_LEAF_L = {
    'top': "aaaaaaaaaaaaaaaa", 'body': "adcccdcccdcccdca", 'ring0': "adcccdcccdcxxdca", 'ring1': "adcccdcccdxccxca",
    'ring2': "adcccdcccdcyycca", 'bot': "aaaaaaaaaaaaaaaa",
}
B2_LEAF_R = dict(B2_LEAF_L, ring0="adcxxdcccdcccdca", ring1="adxccxcccdcccdca", ring2="adcyycccdcccdcca")
B2_SEQ = ['top', 'body', 'body', 'body', 'body', 'ring0', 'ring1', 'ring1', 'ring2', 'body', 'body', 'body', 'bot']


def door_b2():
    rows = door_rows(B2_BG, 11, ["j" * 32, "i" * 32, "h" * 32], leaves(B2_SEQ, B2_LEAF_L, B2_LEAF_R), [rep16(r) * 2 for r in B2_BG[27:32]])
    return grid(rows, WL), {'top': (0, 4), 'note': '줄 B · 짙은 나무 세로 판문·쇠 문고리, 위 돌 문미·아래 디딤돌. 벽 B2 의 돌 문틀(石庫門) 문 칸에 얹는다.'}


# ---------------------------------------------------------------------------
# 6. 나무 계단 (2×3, 물체) — 화면 위(북)로 올라간다. 위는 위층으로 뚫린 어둠, 디딤판(밝은 윗면 2행)·챌판(어두운 앞면 2행)이 번갈아.
# ---------------------------------------------------------------------------
def stair_rows(rail_l, rail_r, tread, riser, top_dark, post_l, post_r, top_edge=None, bot_edge=None):
    """rail_* = 줄마다 난간 글자열(손으로, 폭 자유, 행 주기 반복), tread/riser = 디딤판·챌판 2행씩(안쪽 폭 그대로 손으로 쓴 행),
    top_dark = 위층으로 뚫린 어둠 행들, post_* = 아래 끝 기둥(행 목록). 반환 48행 32폭.
    0~1행 투명(위 귀퉁이), 2행 먹 윤곽, 맨 아래 46행 먹 윤곽·47행 그림자."""
    wl, wr = len(rail_l[0]), len(rail_r[0])
    inner = 32 - wl - wr
    for r in tread + riser + top_dark:
        assert len(r) == inner, (len(r), inner, r)
    body = list(top_dark)
    while len(body) < 43:
        body += tread + riser
    body = body[:43]
    rows = ["." * 32, "." * 32, top_edge or "K" * 32]
    for j, r in enumerate(body):
        rows.append(rail_l[j % len(rail_l)] + r + rail_r[j % len(rail_r)])
    rows += [bot_edge or "K" * 32, "~" * 32]
    assert len(rows) == 48, len(rows)
    for k, r in enumerate(post_l):
        y = 47 - len(post_l) + k
        rows[y] = r + rows[y][len(r):]
    for k, r in enumerate(post_r):
        y = 47 - len(post_r) + k
        rows[y] = rows[y][:32 - len(r)] + r
    rows[47] = "." + rows[47][1:]
    return rows


STAIR_LEG = dict(WL)
STAIR_LEG.update({str(i): ('song', i) for i in range(7)})
POST_A = ["KKKKKK", "KwvvuK", "KvuutK", "KuuttK", "KuttsK", "KtssrK"]
POST_A1L = ["uvvvvu", "uwvvur", "uvuutr", "uuuttr", "uuttsr", "rtssrr"]
POST_A1R = ["uvvvvr", "uwvvur", "uvuutr", "uuuttr", "uuttsr", "rtssrr"]


def stairs_a1():
    # 먹 윤곽 없음: 밝은 쪽(위·왼쪽)=주칠 4단, 그늘쪽(아래·오른쪽)=주칠 1단, 맨 윗줄·구멍 아랫줄은 나무 1단
    rows = stair_rows(rail_l=["uvut"], rail_r=["vutr"],
                      tread=["666666655666666666666665", "555555555554455555554444", "555555555555555555555555"],
                      riser=["333333333333333333333333", "222222222222222222222222"],
                      top_dark=["Z" * 24, "Z" * 24, "a" * 24, "a" * 24],
                      post_l=POST_A1L, post_r=POST_A1R,
                      top_edge="u" * 4 + "a" * 24 + "u" * 4, bot_edge="r" * 32)
    return grid(rows, STAIR_LEG), {'top': (7, 9), 'note': '줄 A · 밝은 소나무 디딤판(윗면 2행)·챌판, 양옆 주칠 손잡이(윗면 밝은 줄)·아래 기둥 머리. 위는 위층으로 뚫린 어둠.'}


def stairs_a2():
    # 남북으로 놓인 난간벽은 위에서 윗면만 보인다: 흰 회벽 윗면(W X) 띠 양옆에 짙은 나무 갓 모서리(d c), 8행마다 갓 이음.
    wall_l = ["KdWWXcK", "KdWWXcK", "KdWXXcK", "KdWWXcK", "KdWWXcK", "KdWXXcK", "KdWWXcK", "KccccbK"]
    wall_r = ["KdWWXcK", "KdWXXcK", "KdWWXcK", "KdWWXcK", "KdWXXcK", "KdWWXcK", "KdWWXcK", "KccccbK"]
    post = ["KKKKKKK", "KeeeedK", "KdddcbK", "KWWWXXK", "KWXXXYK", "KXXYYVK"]    # 아래 끝 = 난간벽 앞면(회벽)
    rows = stair_rows(rail_l=wall_l, rail_r=wall_r,
                      tread=["555555555555555555", "444444444444444443"],
                      riser=["222222222222222222", "111111111111111111"],
                      top_dark=["Z" * 18, "Z" * 18, "Z" * 18, "K" * 18],
                      post_l=post, post_r=post)
    leg = dict(STAIR_LEG, W=('bai', 6), X=('bai', 5), Y=('bai', 4), V=('bai', 3))
    return grid(rows, leg), {'top': (7, 9), 'note': '줄 A · 양옆이 흰 회벽 난간벽(위에서 보이는 윗면 띠 + 짙은 나무 갓 모서리)인 좁은 계단, 디딤판은 밝은 소나무. 아래 끝은 회벽 앞면.'}


def stairs_b1():
    postl = ["uzzyxu", "uyxxwr", "uvuutr", "uuttsr", "uttssr", "rtssrr"]
    postr = ["uzzyxr", "uyxxwr", "uvuutr", "uuttsr", "uttssr", "rtssrr"]
    rows = stair_rows(rail_l=["uvut", "uvut", "uvut", "uxyt"], rail_r=["vutr", "vutr", "vutr", "xytr"],
                      tread=["eeeeeeeeeeeeeeeeeeeeeeed", "ddddddddcddddddddddddccc", "dddddddddddddddddddddddd"],
                      riser=["bbbbbbbbbbbbbbbbbbbbbbbb", "aaaaaaaaaaaaaaaaaaaaaaaa"],
                      top_dark=["Z" * 24, "Z" * 24, "a" * 24],
                      post_l=postl, post_r=postr,
                      top_edge="u" * 4 + "a" * 24 + "u" * 4, bot_edge="r" * 32)
    return grid(rows, dict(WL)), {'top': (6, 8), 'note': '줄 B · 붉은 칠 짙은 나무 디딤판·주칠 손잡이에 금 테 마디(4행마다)·기둥 머리 금 갓. 위는 위층으로 뚫린 어둠.'}


def stairs_b2():
    # 황토 난간벽의 윗면 = 청회 기와 갓(지붕 박공 띠와 같은 화법, 4행마다 기와 이음)
    wall_l = ["KFEDA", "KEDCA", "KEDCA", "KBBAA"]
    wall_r = ["AEDCK", "AEDCK", "ADCBK", "AABBK"]
    post = ["KKKKK", "KFEDK", "KCCBK", "KpppK", "KoonK", "KnnmK"]     # 아래 끝 = 난간벽 앞면(황토) 위 기와 갓
    rows = stair_rows(rail_l=wall_l, rail_r=wall_r,
                      tread=["dddddddddddddddddddddc", "cccccccccccbcccccccbbb"],
                      riser=["aaaaaaaaaaaaaaaaaaaaaa", "ZZZZZZZZZZZZZZZZZZZZZZ"],
                      top_dark=["Z" * 22, "Z" * 22, "K" * 22],
                      post_l=post, post_r=post)
    return grid(rows, dict(WL)), {'top': (6, 8), 'note': '줄 B · 짙은 나무 디딤판, 양옆 황토 난간벽은 위에서 기와 갓 띠로 보인다(담머리 화법). 아래 끝은 황토 벽 앞면.'}


# ---------------------------------------------------------------------------
# 7. 2층 난간 (3×1, 물체, 가로 반복)
# ---------------------------------------------------------------------------
def rail_a1():
    unit = [   # 16폭 반복: 손잡이 윗면 2행·손잡이 앞면·동자(3px) 사이 비침·아래 띠
        "................",
        "uuuuuuuuuuuuuuuu",
        "vvvvvvvvvvvvvvvv",
        "vvvvvvvvvvvvvvvv",
        "ssssssssssssssss",
        "uvurrrrruvurrrrr",
        "uvt.....uvt.....",
        "uvt.....uvt.....",
        "uvt.....uvt.....",
        "uvt.....uvt.....",
        "uvt.....uvt.....",
        "uvurrrrruvurrrrr",
        "vvvvvvvvvvvvvvvv",
        "ssssssssssssssss",
        "rrrrrrrrrrrrrrrr",
        "~~~~~~~~~~~~~~~~",
    ]
    return grid([r * 3 for r in unit], WL), {'top': (2, 4), 'note': '줄 A · 주칠 난간: 손잡이 윗면 2행·동자 8px 간격(사이로 뒤가 비친다)·아래 띠. 가로 반복.'}


def rail_a2():
    unit = [   # 24폭 반복(기둥 간격과 같다): 기둥 머리·卍 자 살 난간 판
        "........................",
        "KKKKKKKKKKKKKKKKKKKKKKKK",
        "wwwwwwwwwwwwwwwwwwwwwwww",
        "vvvvvvvvvvvvvvvvvvvvvvvv",
        "ssssssssssssssssssssssss",
        "KvuKKKKKKKKKKKKKKKKKKKKK",
        "Kvt.rrrr.r..r.rrrr.r..r.",
        "Kvt.r....r..r.r....r..r.",
        "Kvt.rrrrrr..rrrrrrrr..r.",
        "Kvt....r.r..r....r.r..r.",
        "Kvt.rrrr.r..rrrr.r.rrrr.",
        "KvuKKKKKKKKKKKKKKKKKKKKK",
        "vvvvvvvvvvvvvvvvvvvvvvvv",
        "ssssssssssssssssssssssss",
        "KKKKKKKKKKKKKKKKKKKKKKKK",
        "~~~~~~~~~~~~~~~~~~~~~~~~",
    ]
    return grid([r * 2 for r in unit], WL), {'top': (2, 4), 'note': '줄 A · 주칠 卍자 살 난간: 기둥(24px 간격, 벽 기둥과 같은 박자) 사이를 卍 무늬 살로 채웠다. 가로 반복.'}


def rail_b1():
    unit = [   # 16폭: 짙은 나무 손잡이(윗면 넓게) + 주칠 꽃병 모양 동자 둘(가운데 금 띠), 사이로 비친다
        "................",
        "eeeeeeeeeeeeeeee",
        "eeeeeeeeeeeeeeee",
        "dddddddddddddddd",
        "bbbbbbbbbbbbbbbb",
        ".uvtr....uvtr...",
        ".uvtr....uvtr...",
        "uvuutr..uvuutr..",
        "uvuyutr.uvuyutr.",
        "uvuutr..uvuutr..",
        ".uvtr....uvtr...",
        ".uvtr....uvtr...",
        "aaaaaaaaaaaaaaaa",
        "dddddddddddddddd",
        "aaaaaaaaaaaaaaaa",
        "~~~~~~~~~~~~~~~~",
    ]
    return grid([r * 3 for r in unit], WL), {'top': (2, 4), 'note': '줄 B · 짙은 나무 손잡이(윗면 넓게)·주칠 꽃병 모양 동자(가운데 금 띠) 8px 간격·짙은 나무 아래 띠. 가로 반복.'}


def rail_b2():
    unit = [   # 16폭: 낮은 황토 난간벽 위 청회 기와 갓, 벽에 기와 조각 동전 무늬 구멍
        "................",
        "KKKKKKKKKKKKKKKK",
        "DEDCDEDCDEDCDEDC",
        "CDCBCDCBCDCBCDCB",
        "KAAKKAAKKAAKKAAK",
        "pppppppppppppppp",
        "ppKAAKppppKAAKpp",
        "ppA..AppppA..App",
        "ppA..AppppA..App",
        "ppKAAKppppKAAKpp",
        "pppppppppppppppp",
        "oooooooooooooooo",
        "nnnnnnnnnnnnnnnn",
        "mmmmmmmmmmmmmmmm",
        "KKKKKKKKKKKKKKKK",
        "~~~~~~~~~~~~~~~~",
    ]
    return grid([r * 3 for r in unit], WL), {'top': (2, 4), 'note': '줄 B · 낮은 황토 난간벽 + 청회 기와 갓(담머리 화법)·기와 조각 동전 무늬 구멍. 가로 반복.'}


# ---------------------------------------------------------------------------
# 조립 보기(시트 PREVIEWS·장면용) — 조각을 칸 배치대로 붙인다
# ---------------------------------------------------------------------------
def _img(w, h):
    from PIL import Image
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def quad(im, qx, qy):
    """2×2 조각의 한 칸."""
    return im.crop((qx * T, qy * T, qx * T + T, qy * T + T))


def place(canvas, im, tx, ty):
    canvas.alpha_composite(im, (tx * T, ty * T))


YARD_MASK = [   # 1 = 돌바닥. ㄱ자로 꺾인 마당(안쪽 모서리가 생기게)
    "00000000",
    "01111110",
    "01111110",
    "01111000",
    "01111000",
    "00000000",
]


def yard_patch(crops, style_ref, mask=YARD_MASK):
    """마스크로 가장자리·안쪽 모서리를 고르는 자동 깔기. 안쪽은 v1·v2·style 을 2×2 단위로 번갈아."""
    H, W = len(mask), len(mask[0])
    M = lambda x, y: 0 <= x < W and 0 <= y < H and mask[y][x] == '1'
    cv = _img(W * T, H * T)
    fills = [crops['v1'], crops['v2']] + ([style_ref] if style_ref is not None else [])
    for y in range(H):
        for x in range(W):
            if not M(x, y):
                place(cv, crops['g'], x, y)
                continue
            n, s_, w, e = not M(x, y - 1), not M(x, y + 1), not M(x - 1, y), not M(x + 1, y)
            if n and w:
                pid = 'nw'
            elif n and e:
                pid = 'ne'
            elif s_ and w:
                pid = 'sw'
            elif s_ and e:
                pid = 'se'
            elif n:
                pid = 'n'
            elif s_:
                pid = 's'
            elif w:
                pid = 'w'
            elif e:
                pid = 'e'
            elif not M(x - 1, y - 1):
                pid = 'inw'
            elif not M(x + 1, y - 1):
                pid = 'ine'
            elif not M(x - 1, y + 1):
                pid = 'isw'
            elif not M(x + 1, y + 1):
                pid = 'ise'
            else:
                f = fills[((x // 2) + (y // 2)) % len(fills)]
                place(cv, quad(f, x % 2, y % 2), x, y)
                continue
            place(cv, crops[pid], x, y)
    return cv


def floor_patch(crops, style_ref):
    """6×6 칸: 맨 위 두 줄 foot(벽 밑), 그 아래 style·v1·v2·v3 를 2×2 단위로 섞어 깐다."""
    cv = _img(6 * T, 6 * T)
    order = [['foot', 'foot', 'foot'], ['v1', 'v2', '@'], ['v3', '@', 'v1']]
    for by, row in enumerate(order):
        for bx, pid in enumerate(row):
            im = style_ref if pid == '@' else crops[pid]
            if im is not None:
                cv.alpha_composite(im, (bx * 32, by * 32))
    return cv


def roof_patch(c, width=5):
    """지붕 width 칸 폭(왼끝 + 가운데 반복 + 오른끝) × 3줄."""
    cv = _img(width * T, 3 * T)
    for row, (l, m, r) in enumerate((('rl', 'rm', 'rr'), ('sl', 'sm', 'sr'), ('el', 'em', 'er'))):
        for x in range(width):
            place(cv, c[l if x == 0 else r if x == width - 1 else m], x, row)
    return cv


def wall_patch(c, order=('l', 'm', 'win', 'm', 'door', 'r')):
    w = {'l': 1, 'm': 3, 'win': 3, 'door': 4, 'r': 1}
    cv = _img(sum(w[k] for k in order) * T, 2 * T)
    x = 0
    for k in order:
        cv.alpha_composite(c[k], (x * T, 0))
        x += w[k]
    return cv


PREVIEWS = {
    'floor_wood_inn': lambda c, st: [('섞어 깔기 6×6(위 두 줄 foot · 가운데·오른쪽 아래에 style 조각)', floor_patch(c, st.get('inn_floor_wood')))],
    'floor_stone_yard': lambda c, st: [('ㄱ자 마당 자동 깔기 8×6(가장자리·안쪽 모서리·style 조각 포함)', yard_patch(c, st.get('yard_floor_stone')))],
    'wall_inn_set': lambda c, st: [('이어 붙임: 왼끝·가운데·창·가운데·문·오른끝', wall_patch(c)),
                                   ('순서 바꿈: 왼끝·문·창·오른끝', wall_patch(c, ('l', 'door', 'win', 'r')))],
    'roof_set': lambda c, st: [('3칸 폭', roof_patch(c, 3)), ('6칸 폭', roof_patch(c, 6))],
}


def scenes(get, style, actor):
    """줄별 장면 6×5 칸(96×80) 셋: 바깥(지붕·벽·판문), 안(벽·창·마루·계단·난간·style 탁자), 마당(돌바닥 가장자리·style 목인장)."""
    from PIL import Image
    out = {}
    roof, wall, door, floor, yard = get('roof_set'), get('wall_inn_set'), get('door_double'), get('floor_wood_inn'), get('floor_stone_yard')
    stairs, rail = get('stairs_wood'), get('railing_upper')
    if roof and wall:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        v.alpha_composite(roof_patch(roof, 6), (0, 0))
        w = wall_patch(wall, ('l', 'door', 'r'))
        v.alpha_composite(w, (0, 48))
        if door is not None:
            v.alpha_composite(door, (32, 48))
        v.alpha_composite(actor, (70, 47))
        out['바깥: 지붕 6칸·벽(왼끝·문·오른끝)·판문'] = v
    if wall and floor:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        v.alpha_composite(wall_patch(wall, ('l', 'win', 'm')).crop((0, 0, 96, 32)), (0, 0))
        fp = floor_patch(floor, style.get('inn_floor_wood'))
        v.alpha_composite(fp.crop((0, 0, 96, 48)), (0, 32))
        if stairs is not None:
            v.alpha_composite(stairs, (64, 32))
        tb = style.get('round_table_stools')
        if tb is not None:
            v.alpha_composite(tb, (10, 34))
        if rail is not None:
            v.alpha_composite(rail, (0, 64))
        v.alpha_composite(actor, (40, 38))
        out['안: 벽(왼끝·창)·마루(foot)·계단·난간·style 탁자'] = v
    if yard:
        mask = ["11111111", "11111110", "11111110", "11110000", "11110000", "00000000", "00000000"]
        big = yard_patch(yard, style.get('yard_floor_stone'), mask)
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        v.alpha_composite(big.crop((16, 16, 112, 96)), (0, 0))
        dm = style.get('training_dummy')
        if dm is not None:
            v.alpha_composite(dm, (22, 8))
        v.alpha_composite(actor, (52, 18))
        out['마당: 돌바닥·경계석·풀·style 목인장'] = v
    return out


CANDIDATES = {
    'floor_wood_inn': {'A1': floor_a1, 'A2': floor_a2, 'B1': floor_b1, 'B2': floor_b2},
    'floor_stone_yard': {'A1': yard_a1, 'A2': yard_a2, 'B1': yard_b1, 'B2': yard_b2},
    'wall_inn_set': {'A1': wall_a1, 'A2': wall_a2, 'B1': wall_b1, 'B2': wall_b2},
    'roof_set': {'A1': roof_a1, 'A2': roof_a2, 'B1': roof_b1, 'B2': roof_b2},
    'door_double': {'A1': door_a1, 'A2': door_a2, 'B1': door_b1, 'B2': door_b2},
    'stairs_wood': {'A1': stairs_a1, 'A2': stairs_a2, 'B1': stairs_b1, 'B2': stairs_b2},
    'railing_upper': {'A1': rail_a1, 'A2': rail_a2, 'B1': rail_b1, 'B2': rail_b2},
}

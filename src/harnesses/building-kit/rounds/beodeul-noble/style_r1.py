"""building-kit beodeul-noble style-r1 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

버들항 귀족 구역 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r1'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_mansard_A
def cand_roof_mansard_A():
    def gen(H, brk):
        W = 48
        g = [['.'] * W for _ in range(H)]
        top = brk - 1
        low = H - 6
        for y in range(H):
            for x in range(W):
                lx = x if x < 24 else W - 1 - x          # 끝에서 잰 거리(좌우 대칭)
                left = x < 24
                if y < brk:
                    clip = (top - y) * 13 // top
                    face = clip + 5
                elif y < low:
                    clip = 0
                    face = 2 + 3 * (low - 1 - y) // (low - 1 - brk)
                else:
                    clip = face = 0
                if lx < clip:
                    continue
                if y == brk:
                    ch = 'U' if lx > 0 or left else 'X'
                elif y == brk + 1:
                    ch = 'Y'
                elif lx < face:                          # 모임지붕 끝 경사면: l 밝게, r 어둡게
                    k = (y + lx) % 3
                    if lx == face - 1:
                        ch = 'U' if left else 'X'
                    elif left:
                        ch = 'V' if k else 'W'
                    else:
                        ch = 'Y' if k else 'Z'
                elif y == 0:
                    ch = 'U' if x % 2 else 'V'
                elif y == 1:
                    ch = 'W'
                elif y < brk:
                    c = (y - 2) % 3
                    xx = (x + ((y - 2) // 3 % 2) * 2) % 4
                    t = xx in (1, 2)                     # 바뀜은 0|1·2|3 에만 → 조각 경계(3|0)가 매끈
                    ch = ('VWX'[c] if t else 'WXY'[c])
                elif y < low:
                    c = (y - brk - 2) % 4
                    xx = (x + ((y - brk - 2) // 4 % 2) * 2) % 4
                    t = xx in (1, 2)
                    ch = ('WXYY'[c] if t else 'XYYZ'[c])
                else:
                    e = y - low
                    xx = x % 4
                    t = xx in (1, 2)
                    ch = ('W' if t else 'X', 'X', 'Y', 'Y' if t else 'Z', 'Y', 'Z')[e]
                    if lx < 2:
                        ch = ('W' if lx == 0 else 'X') if left else 'Z'
                g[y][x] = ch
        return [''.join(r) for r in g]
    leg = dot.legend('beodeul-noble', Z=('roof', 0), Y=('roof', 1), X=('roof', 2), W=('roof', 3),
                     V=('roof', 4), U=('roof', 5))
    return dot.grid(gen(48, 13), leg), {}
# <<< cand_roof_mansard_A

# >>> cand_roof_mansard_B
def cand_roof_mansard_B(courses=5, edge=None, hip=None):
    """B 망사드: 밝은 용마루·윗면(E/F) → 흰 꺾임선 → 중간 사면(D) → 어두운 처마(C/B). 끝은 모임지붕 경사면."""
    leg = dot.legend('beodeul-noble', A=('roof', 0), B=('roof', 1), C=('roof', 2),
                     D=('roof', 3), E=('roof', 4), F=('roof', 5))
    rot = lambda s, n=4: s[n:] + s[:n]
    # 박자는 칸 경계가 기와 골에 걸리지 않게 민 위상
    up1 = [rot(r, 2) for r in ['DEDDDDCBDEDDDDCB', 'DDDDDCCBDDDDDCCB', 'CCCCCCCBCCCCCCCB']]
    # 사면·처마는 4px 붉은 기와(왼위 주황 빛·자주 골), 켜마다 2px 어긋남
    st1 = ['DCAD' * 4, 'CBAC' * 4, 'BBAB' * 4, 'BAAA' * 4]
    ev1 = ['BAAC' * 4, 'BAAB' * 4, 'AAAB' * 4, 'AAAA' * 4]
    mid, kind = [], []

    def add(rows, k):
        mid.extend(rows)
        kind.extend(k)
    add(['CCCCCCCCCCCCCCCC', 'FFFFFFFFFFFFFFFF', 'DEDDDEDDDEDDDEDD'], ['edge', 'ridge', 'cap'])
    for i in range(3):
        add(up1 if i % 2 == 0 else [rot(r) for r in up1], ['ub', 'ub', 'ul'])
    add(['FFFFFFFFFFFFFFFF', 'AAAAAAAAAAAAAAAA'], ['curb', 'crease'])
    # 사면 켜는 y=14 에서 시작 → 칸 경계(16·32·48)가 켜 가운데에 온다
    for i in range(courses):
        add(st1 if i % 2 == 0 else [rot(r, 2) for r in st1], ['sb', 'sb', 'sb', 'sl'])
    hip_end = len(mid)
    add([rot(r, 2) for r in ev1] + ev1, ['e'] * 8)
    add(['CCBD' * 4, 'CBAC' * 4, 'BAAB' * 4,
         'DDDDDDDDDDDDDDDD', 'AAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBB'], ['e'] * 6)
    if edge is None:
        edge = [12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6,
                5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0]
        hip = [12, 13, 13, 13, 12, 12, 12, 12, 12, 11, 11, 11, 11, 11,
               10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 7, 7, 7]
    # 끝 경사면 색: l 은 빛 받는 쪽(밝게), r 은 그늘(어둡게)
    lit = dict(edge='D', ridge='F', cap='F', ub='F', ul='E', curb='F', crease='C', sb='E', sl='D')
    shd = dict(edge='B', ridge='C', cap='C', ub='C', ul='B', curb='D', crease='A', sb='B', sl='A')
    darker = dict(F='E', E='D', D='C', C='B', B='A', A='A')

    def end(side):
        rows = []
        for y, row in enumerate(mid):
            if y >= hip_end:
                rows.append('C' + row[1:] if side == 'l' else row[:15] + 'B')
                continue
            c, h = edge[y], hip[y]
            out = []
            for x in range(16):
                xx = x if side == 'l' else 15 - x
                if xx < c:
                    out.append('.')
                elif xx == h:
                    out.append('B' if side == 'l' else 'E')
                elif xx == c:
                    out.append('C' if side == 'l' else 'B')
                elif xx < h:
                    tone = (lit if side == 'l' else shd)[kind[y]]
                    # 경사면 기와 이음: 줄마다 4px 박자로 한 점 어둡게
                    if kind[y] in ('ub', 'sb') and (xx + y // 3) % 4 == 0:
                        tone = darker[tone]
                    out.append(tone)
                else:
                    out.append(row[x])
            rows.append(''.join(out))
        return rows
    L, R = end('l'), end('r')
    rows = [L[y] + mid[y] + R[y] for y in range(len(mid))]
    return dot.grid(rows, leg), {}
# <<< cand_roof_mansard_B

# >>> cand_roof_mansard_C
def cand_roof_mansard_C(tall=False):
    # 망사드: 윗면(완만)·꺾임 돌림·가파른 아랫면·처마. l·r 끝은 모임지붕 경사(l 밝게, r 어둡게).
    H = 64 if tall else 48
    U = 22 if tall else 14          # 꺾임 돌림 줄
    E = H - 6                       # 처마 띠 시작
    leg = dot.legend('beodeul-noble', a=('roof', 0), b=('roof', 1), c=('roof', 2),
                     d=('roof', 3), e=('roof', 4), f=('roof', 5))

    def edge(y):                    # 끝 조각 실루엣: 꺾임 위는 크게 비우고 아래는 가파르게
        if y >= E:
            return 0
        if y <= U:
            return 13 - (y * 10) // U
        return 3 - ((y - U) * 3) // (E - U)

    UP = (('c', 'f', 'e', 'e'), ('c', 'e', 'd', 'd'), ('b', 'c', 'c', 'c'))
    ST = (('a', 'd', 'c', 'b'), ('a', 'c', 'b', 'b'), ('a', 'b', 'b', 'b'), ('a', 'a', 'a', 'a'))
    HL_UP = (('d', 'f', 'e', 'e'), ('d', 'e', 'e', 'd'), ('c', 'd', 'd', 'd'))
    HL_ST = (('d', 'e', 'e', 'e'), ('c', 'e', 'd', 'd'), ('c', 'd', 'd', 'c'), ('c', 'c', 'c', 'c'))
    HR_UP = (('a', 'c', 'c', 'b'), ('a', 'b', 'b', 'b'), ('a', 'a', 'b', 'a'))
    HR_ST = (('a', 'c', 'b', 'b'), ('a', 'b', 'b', 'a'), ('a', 'b', 'a', 'a'), ('a', 'a', 'a', 'a'))

    def tex(x, y, up, st):
        if y < U:
            k, r = divmod(y - 3, 3)
            return up[r][(x + 2 * (k % 2)) % 4]
        k, r = divmod(y - U - 2, 4)
        return st[r][(x + 2 * (k % 2)) % 4]

    def eave(x, y, side):
        r = y - E
        if r == 0:
            return 'a'
        if side == 'L' and x == 0:
            return 'c'
        if side == 'R' and x == 47:
            return 'a' if r < 5 else 'c'
        if r == 1:
            return 'b' if x % 4 == 0 else 'e'
        if r == 2:
            return 'a' if x % 4 == 0 else 'd'
        if r == 3:
            return 'b' if x % 4 == 0 else 'c'
        return 'a' if r == 4 else 'c'

    rows = []
    for y in range(H):
        s = []
        for x in range(48):
            p, lx = divmod(x, 16)
            side = 'L' if p == 0 else ('R' if p == 2 else 'M')
            if y >= E:
                s.append(eave(x, y, side))
                continue
            d = 99
            if side == 'L':
                d = lx - edge(y)
            elif side == 'R':
                d = (15 - lx) - edge(y)
            hw = 4 if y <= U + 1 else 3
            if d < 0:
                s.append('.')
            elif d == 0:
                s.append('c' if side == 'L' else 'a')
            elif d <= hw:
                if y in (U, U + 1):
                    s.append(('f' if y == U else 'd') if side == 'L' else ('c' if y == U else 'a'))
                elif y < 3:
                    s.append('e' if side == 'L' else 'b')
                else:
                    s.append(tex(x, y, HL_UP, HL_ST) if side == 'L' else tex(x, y, HR_UP, HR_ST))
            elif d == hw + 1:
                s.append('f' if side == 'L' else 'd')
            elif y == 0:
                s.append('c')
            elif y == 1:
                s.append('f')
            elif y == 2:
                s.append('d')
            elif y == U:
                s.append('f')
            elif y == U + 1:
                s.append('a')
            else:
                s.append(tex(x, y, UP, ST))
        rows.append(''.join(s))
    return dot.grid(rows, leg), {}
# <<< cand_roof_mansard_C

# >>> cand_roof_mansard_tall_A
def cand_roof_mansard_tall_A():
    def gen(H, brk):
        W = 48
        g = [['.'] * W for _ in range(H)]
        top = brk - 1
        low = H - 6
        for y in range(H):
            for x in range(W):
                lx = x if x < 24 else W - 1 - x          # 끝에서 잰 거리(좌우 대칭)
                left = x < 24
                if y < brk:
                    clip = (top - y) * 13 // top
                    face = clip + 5
                elif y < low:
                    clip = 0
                    face = 2 + 3 * (low - 1 - y) // (low - 1 - brk)
                else:
                    clip = face = 0
                if lx < clip:
                    continue
                if y == brk:
                    ch = 'U' if lx > 0 or left else 'X'
                elif y == brk + 1:
                    ch = 'Y'
                elif lx < face:                          # 모임지붕 끝 경사면: l 밝게, r 어둡게
                    k = (y + lx) % 3
                    if lx == face - 1:
                        ch = 'U' if left else 'X'
                    elif left:
                        ch = 'V' if k else 'W'
                    else:
                        ch = 'Y' if k else 'Z'
                elif y == 0:
                    ch = 'U' if x % 2 else 'V'
                elif y == 1:
                    ch = 'W'
                elif y < brk:
                    c = (y - 2) % 3
                    xx = (x + ((y - 2) // 3 % 2) * 2) % 4
                    t = xx in (1, 2)                     # 바뀜은 0|1·2|3 에만 → 조각 경계(3|0)가 매끈
                    ch = ('VWX'[c] if t else 'WXY'[c])
                elif y < low:
                    c = (y - brk - 2) % 4
                    xx = (x + ((y - brk - 2) // 4 % 2) * 2) % 4
                    t = xx in (1, 2)
                    ch = ('WXYY'[c] if t else 'XYYZ'[c])
                else:
                    e = y - low
                    xx = x % 4
                    t = xx in (1, 2)
                    ch = ('W' if t else 'X', 'X', 'Y', 'Y' if t else 'Z', 'Y', 'Z')[e]
                    if lx < 2:
                        ch = ('W' if lx == 0 else 'X') if left else 'Z'
                g[y][x] = ch
        return [''.join(r) for r in g]
    leg = dot.legend('beodeul-noble', Z=('roof', 0), Y=('roof', 1), X=('roof', 2), W=('roof', 3),
                     V=('roof', 4), U=('roof', 5))
    return dot.grid(gen(64, 22), leg), {}
# <<< cand_roof_mansard_tall_A

# >>> cand_roof_mansard_tall_B
def cand_roof_mansard_tall_B():
    """B 4행: 같은 윗면·꺾임선, 사면 기와 8줄, 끝 경사면은 더 길게 내려온다."""
    edge = [12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6,
            5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1] + [0] * 13
    hip = [12, 13, 13, 13, 13, 12, 12, 12, 12, 12, 11, 11, 11, 11,
           11, 11, 11, 11, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 8, 8, 8, 8, 8, 8,
           7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6]
    return cand_roof_mansard_B(courses=9, edge=edge, hip=hip)
# <<< cand_roof_mansard_tall_B

# >>> cand_roof_mansard_tall_C
def cand_roof_mansard_tall_C():
    # 같은 망사드를 4행으로 — 윗면 19줄·아랫면 34줄.
    return cand_roof_mansard_C(tall=True)
# <<< cand_roof_mansard_tall_C

# >>> cand_wall_storey_A
def cand_wall_storey_A():
    SPECK = {(3, 6), (11, 9), (6, 14), (14, 17), (1, 21), (9, 25), (4, 28), (12, 13), (7, 19), (15, 4), (2, 11), (10, 30)}
    LITE = {(8, 7), (13, 23), (5, 25), (0, 16)}
    def stucco(lx, y):
        if (lx, y % 32) in SPECK:
            return 'c'
        if (lx, y % 32) in LITE:
            return 'e'
        return 'd'
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            p, lx = divmod(x, 16)
            ch = stucco(lx, y)
            if p == 0:                                   # 왼끝 붙임기둥
                if lx < 2:
                    continue
                if 2 <= lx <= 6 and (y in (3, 4) or y in (28, 29)):
                    ch = 'e'
                elif 2 <= lx <= 6 and y in (5, 30):
                    ch = 'b'
                elif 2 <= lx <= 5:
                    ch = 'eddb'[lx - 2]
            elif p == 4:                                 # 오른끝 붙임기둥
                if lx > 13:
                    continue
                if 9 <= lx <= 13 and (y in (3, 4) or y in (28, 29)):
                    ch = 'e'
                elif 9 <= lx <= 13 and y in (5, 30):
                    ch = 'b'
                elif 10 <= lx <= 13:
                    ch = 'edcb'[lx - 10]
            elif p == 2:                                 # 덧창 창
                if 1 <= lx <= 3 and 6 <= y <= 24 or 12 <= lx <= 14 and 6 <= y <= 24:
                    slat = (y - 6) % 2
                    if lx in (1, 12):
                        ch = 't' if slat == 0 else 's'
                    elif lx in (3, 14):
                        ch = 'o'
                    else:
                        ch = 's' if slat == 0 else 'p'
                elif 4 <= lx <= 11 and y == 5:
                    ch = 'e'
                elif 4 <= lx <= 11 and y == 24:
                    ch = 'e'
                elif 4 <= lx <= 11 and y == 25:
                    ch = 'b'
                elif lx in (4, 11) and 6 <= y <= 23:
                    ch = 'e' if lx == 4 else 'c'
                elif 5 <= lx <= 10 and 6 <= y <= 23:
                    if y == 6:
                        ch = 'i'
                    elif y == 14:
                        ch = 'e'
                    elif (lx, y) in {(6, 8), (6, 9), (7, 8), (6, 16), (6, 17), (7, 16)}:
                        ch = 'k'
                    elif y in (15, 7):
                        ch = 'i'
                    else:
                        ch = 'j'
            elif p == 3:                                 # 문
                if 2 <= lx <= 13 and 3 <= y <= 4:
                    ch = 'e'
                elif 2 <= lx <= 13 and y == 5 and lx in (2, 3, 12, 13):
                    ch = 'e'
                elif lx in (2, 3) and y >= 5:
                    ch = 'e' if lx == 2 else 'd'
                elif lx in (12, 13) and y >= 5:
                    ch = 'c' if lx == 12 else 'b'
                elif 4 <= lx <= 11 and y >= 5:
                    dx = lx - 4 if lx < 8 else lx - 8
                    if y == 5:
                        ch = '1'
                    elif lx in (7, 8):
                        ch = '1' if lx == 8 else '2'
                    elif (lx in (7, 8) or dx in (1, 2)) and y == 19:
                        ch = 'g' if dx == 2 and lx < 8 else '3'
                    elif 1 <= dx <= 2 and (8 <= y <= 16 or 21 <= y <= 29):
                        ch = '5' if (y in (8, 21) or dx == 1) else '4'
                    elif dx == 0:
                        ch = '4'
                    else:
                        ch = '3'
            if y == 0 and ch != '.':
                ch = 'a'
            elif y == 1 and ch != '.':
                ch = 'b'
            g[y][x] = ch
    rows = [''.join(r) for r in g]
    leg = dot.legend('beodeul-noble', a=('stucco', 0), b=('stucco', 1), c=('stucco', 2), d=('stucco', 3),
                     e=('stucco', 4), i=('iron', 0), j=('iron', 1), k=('iron', 3),
                     o=('shutter', 0), p=('shutter', 1), s=('shutter', 2), t=('shutter', 5),
                     g=('marble', 4), **{'1': ('wood', 1), '2': ('wood', 2), '3': ('wood', 3),
                                         '4': ('wood', 4), '5': ('wood', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
def cand_wall_storey_B():
    """B 대리석 현관: 크림 스투코 + 대리석 붙임기둥·창틀, 문은 대리석 기둥 두 개가 받치는 현관."""
    leg = dot.legend('beodeul-noble',
                     s=('stucco', 0), t=('stucco', 1), u=('stucco', 2), v=('stucco', 3), w=('stucco', 4),
                     a=('marble', 0), b=('marble', 2), c=('marble', 3), d=('marble', 5), g=('marble', 4),
                     h=('shutter', 1), j=('shutter', 2), k=('shutter', 5),
                     i=('iron', 0), n=('iron', 1), o=('iron', 2), p=('iron', 3),
                     q=('wood', 1), r=('wood', 2), x=('wood', 3), y=('wood', 4))
    body = [
        'ssssssssssssssss',
        'tttttttttttttttt',
        'uvvvvvuvvvvvvvvv',
        'vvvvvvvvvvvuvvvv',
        'vvvuvvvvvvvvvvvv',
        'vvvvvvvvtvvvvvuv',
        'vuvvvvvvvvvvvvvv',
        'vvvvvuvvvvvvvvvv',
        'vvvvvvvvvvvvtvvv',
        'vvvtvvvvvvvvvvvv',
        'vvvvvvvvvuvvvvvv',
        'uvvvvvvvvvvvvvvv',
        'vvvvvvvuvvvvvtvv',
        'vvvvvvvvvvvvvvvv',
        'vvtvvvvvvvvvvvvv',
        'vvvvvvvvvvuvvvvv',
        'vvvvvuvvvvvvvvvu',
        'vvvvvvvvvvvvvvvv',
        'vuvvvvvvtvvvvvvv',
        'vvvvvvvvvvvvvuvv',
        'vvvvvvuvvvvvvvvv',
        'vvvuvvvvvvvvvvvv',
        'vvvvvvvvvvvtvvvv',
        'tvvvvvvvvvvvvvvv',
        'vvvvvvvvuvvvvvvv',
        'vvvvuvvvvvvvvvvu',
        'vvvvvvvvvvvvvvvv',
        'vvvvvvvvvvvuvvvv',
        'vvuvvvvvvvvvvvvv',
        'vvvvvvvvvvvvvvvv',
        'uuuuuuuuuuuuuuuu',
        'tttttttttttttttt',
    ]

    def over(top, block):
        # block 은 top 행부터 덮는다. ' ' 는 바탕 유지.
        rows = list(body)
        for k, b in enumerate(block):
            y = top + k
            rows[y] = ''.join(rows[y][x] if b[x] == ' ' else b[x] for x in range(16))
        return rows
    m = body
    # 덧창 창: 대리석 상인방·창대, 갈색 덧창, 철빛 유리 + 가로살·세로살
    pane = [('pon', 'on'), ('onn', 'nn'), ('nni', 'ni'), ('nii', 'ii'), ('iii', 'ii'), ('iii', 'ii'), None,
            ('onn', 'on'), ('nni', 'nn'), ('nii', 'ni'), ('iii', 'ii'), ('iii', 'ii'), ('iii', 'ii'), ('iin', 'in')]
    win = ['   dddddddddd   ', '   bbbbbbbbbb   ', '  kjaaaaaaaakh  ']
    for k, pr in enumerate(pane):
        sh = ('kj', 'kh') if k % 2 == 0 else ('jh', 'jh')
        glass = 'cccccc' if pr is None else pr[0] + 'c' + pr[1]
        win.append('  ' + sh[0] + 'c' + glass + 'c' + sh[1] + '  ')
    win += ['   dddddddddd   ', '    aaaaaaaa    ', '    tttttttt    ']
    w = over(5, win)
    # 문: 대리석 엔타블러처 + 기둥 둘, 반원 채광창, 나무 두 짝 문
    door = ['  dddddddddddd  ', '  cccccccccccc  ', '  aaaaaaaaaaaa  ',
            'bdddbaaaaaabdddb', ' dcaqqqqqqqqdca ', ' dcaqopnpnoqdca ', ' dcaqnninnnqdca ',
            ' dcaqqqqqqqqdca ']
    leaf = ['qyyxyyxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq',
            'qyyxyyxq', 'qyxgyxxq', 'qyyxyyxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq',
            'qyrxyrxq', 'qyrxyrxq', 'qyrxyrxq', 'qyyxyyxq', 'qxxxxxxq']
    for lf in leaf:
        door.append(' dca' + lf + 'dca ')
    door += ['bdddbqqqqqqbdddb', 'aaaaaqqqqqqaaaaa']
    d = over(2, door)
    # 붙임기둥: 왼끝 x2-6, 오른끝 x9-13, 바깥 2px 투명
    lp = {2: 'dddddd', 3: 'cccccc', 4: 'aaaaaa', 28: 'dddddd', 29: 'cccccc', 30: 'bbbbbb', 31: 'aaaaaa'}
    rp = {2: 'dddddd', 3: 'cccccc', 4: 'aaaaaa', 28: 'dddddd', 29: 'cccccc', 30: 'bbbbbb', 31: 'aaaaaa'}
    l, r = [], []
    for y, row in enumerate(body):
        if y < 2:
            l.append('..' + row[2:])
            r.append(row[:14] + '..')
        elif y in lp:
            l.append('..' + lp[y] + row[8:])
            r.append(row[:8] + rp[y] + '..')
        else:
            l.append('..adccbt' + row[8:])
            r.append(row[:9] + 'ddcba..')
    rows = [l[y] + m[y] + w[y] + d[y] + r[y] for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C(ivy=True, H=32):
    # 크림 스투코 한 층: l(붙임기둥)·m·w(덧창 창)·d(문)·r(붙임기둥). 줄 C 는 담쟁이.
    leg = dot.legend('beodeul-noble',
                     g=('stucco', 0), h=('stucco', 1), i=('stucco', 2), j=('stucco', 3), k=('stucco', 4),
                     l=('marble', 0), m=('marble', 1), n=('marble', 2), o=('marble', 3), p=('marble', 4),
                     q=('marble', 5),
                     t=('shutter', 1), u=('shutter', 2), v=('shutter', 3), x=('shutter', 5),
                     M=('iron', 0), N=('iron', 1), O=('iron', 2), P=('iron', 3),
                     R=('wood', 1), S=('wood', 2), T=('wood', 3), U=('wood', 4),
                     A=('ivy', 0), B=('ivy', 1), C=('ivy', 2), D=('ivy', 3), E=('ivy', 4))
    W = 80
    g = [['j'] * W for _ in range(H)]
    for y in range(H):                          # 스투코 결: 고른 좌표에만 어두운 점
        for (sx, sy) in ((3, 4), (9, 2), (13, 9), (6, 11), (1, 14), (11, 13), (7, 7)):
            if y % 16 == sy:
                for p in range(5):
                    g[y][p * 16 + sx] = 'i'
    for x in range(W):                          # 처마 그늘 맨 위 2줄
        g[0][x] = 'g'
        g[1][x] = 'h'

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            g[y][x] = c

    def pilaster(x0, cols):                     # 붙임기둥: 대리석 머리·받침
        for y in range(2, H):
            for i, c in enumerate(cols):
                put(x0 + i, y, c)
        for i in range(len(cols)):
            put(x0 + i, 2, 'q')
            put(x0 + i, 3, 'n')
            if H == 32:
                put(x0 + i, 29, 'p')
                put(x0 + i, 30, 'o')
                put(x0 + i, 31, 'n')

    pilaster(2, 'hkjjih')
    pilaster(72, 'kjjihg')

    # 덧창 창 (w: x 32..47)
    ox = 32
    for y in range(8, 23):
        for sx in (1, 12):                      # 덧창 살
            for i in range(3):
                c = 't' if y % 2 == 0 else 'u'
                if i == 0 and sx == 1:
                    c = 'x' if y % 2 else 'u'
                if i == 2 and sx == 12:
                    c = 't'
                put(ox + sx + i, y, c)
    for x in range(4, 12):
        put(ox + x, 7, 'q')
        put(ox + x, 8, 'o')
    for y in range(9, 23):
        put(ox + 4, y, 'p')
        put(ox + 11, y, 'n')
        for x in range(5, 11):
            put(ox + x, y, 'N')
        put(ox + 7, y, 'o')
        put(ox + 8, y, 'n')
    for x in range(5, 11):
        if x not in (7, 8):
            put(ox + x, 15, 'o')
            put(ox + x, 22, 'M')
    for (x, y) in ((5, 9), (6, 9), (5, 10), (9, 9), (9, 10), (5, 16), (6, 16), (9, 16)):
        put(ox + x, y, 'P')
    for x in range(3, 13):                      # 창턱
        put(ox + x, 23, 'q')
        put(ox + x, 24, 'm')
        put(ox + x, 25, 'i')

    # 문 (d: x 48..63) — 32px 높이
    ox = 48
    for y in range(2, H):
        put(ox + 2, y, 'o')
        put(ox + 3, y, 'q')
        put(ox + 12, y, 'n')
        put(ox + 13, y, 'm')
    for x in range(2, 14):
        put(ox + x, 2, 'q')
        put(ox + x, 3, 'o')
    for y in range(4, 8):
        for x in range(4, 12):
            put(ox + x, y, 'N')
    for (x, y) in ((4, 4), (5, 4), (4, 5), (8, 4)):
        put(ox + x, y, 'P')
    for x in range(4, 12):
        put(ox + x, 8, 'o')
    for y in range(9, H):
        for x in range(4, 12):
            put(ox + x, y, 'T')
        put(ox + 4, y, 'U')
        put(ox + 7, y, 'R')
        put(ox + 8, y, 'S')
        put(ox + 11, y, 'S')
    for (y0, y1) in ((11, 19), (21, 29)):       # 문짝 판
        for x0 in (5, 9):
            for x in range(x0, x0 + 2):
                put(ox + x, y0, 'S')
                put(ox + x, y1, 'U')
            for y in range(y0, y1 + 1):
                put(ox + x0 - 0, y, 'S' if y < y1 else 'U')
    put(ox + 9, 20, 'p')                         # 손잡이
    put(ox + 6, 20, 'p')
    for x in range(2, 14):                      # 문턱
        put(ox + x, H - 1, 'o' if x < 12 else 'n')

    if ivy:
        def clump(cx, cy, hi=True):
            put(cx, cy - 1, 'C')
            put(cx - 1, cy, 'C')
            put(cx, cy, 'B')
            put(cx + 1, cy, 'B')
            put(cx, cy + 1, 'A')
            put(cx + 1, cy + 1, 'A')
            if hi:
                put(cx - 1, cy - 1, 'D')

        def stem(x, y0, y1):
            for y in range(y0, y1):
                put(x, y, 'B' if y % 3 else 'A')

        # 왼 붙임기둥을 타고 오른 덩어리
        stem(4, 5, H)
        stem(6, 12, H)
        for (cx, cy) in ((4, 5), (3, 8), (5, 10), (3, 13), (6, 14), (4, 17), (7, 19),
                         (3, 21), (5, 23), (8, 25), (3, 26), (6, 28), (9, 29), (4, 30)):
            clump(cx, cy)
        # 창 둘레: 왼 덧창 위·창 머리를 덮고 오른쪽으로 늘어진다
        for (cx, cy) in ((33, 5), (35, 4), (37, 6), (34, 8), (39, 5), (33, 11), (34, 14),
                         (41, 5), (33, 18), (44, 6)):
            clump(cx, cy)
        stem(33, 5, 21)
        # 문 머리 왼 모서리만
        for (cx, cy) in ((49, 3), (51, 2)):
            clump(cx, cy)
        # 오른 붙임기둥 위쪽
        for (cx, cy) in ((73, 7), (75, 9), (74, 12)):
            clump(cx, cy, hi=False)
        stem(74, 7, 15)

    for y in range(H):                          # 바깥 2px 투명(inset 2)
        for x in (0, 1, 78, 79):
            g[y][x] = '.'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_storey_C

# >>> cand_band_trim_A
def cand_band_trim_A():
    SPECK = {(3, 6), (11, 9), (6, 7), (14, 10), (1, 8), (9, 6)}
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            p, lx = divmod(x, 16)
            if y in (0, 13):
                ch = 'f'
            elif y in (1, 12):
                ch = 'e'
            elif y == 2:
                ch = 'd'
            elif y == 3:
                ch = 'e' if x % 4 < 2 else 'c'          # 이빨 장식
            elif y in (4, 15):
                ch = 'b'
            elif y == 14:
                ch = 'd'
            else:
                ch = 'c' if (lx, y) in SPECK else 'd'
                if p == 0 and 2 <= lx <= 5:
                    ch = 'eddb'[lx - 2]
                elif p == 2 and 10 <= lx <= 13:
                    ch = 'edcb'[lx - 10]
            if p == 0 and lx < 2:                        # 띠 끝면: 왼쪽 밝게
                ch = 'f' if lx == 0 or y in (0, 12, 13) else 'e'
                if y == 15:
                    ch = 'c'
            elif p == 2 and lx > 13:                     # 오른쪽 어둡게
                ch = 'b' if lx == 15 or y == 15 else 'c'
            g[y][x] = ch
    leg = dot.legend('beodeul-noble', b=('stucco', 1), c=('stucco', 2), d=('stucco', 3), e=('stucco', 4),
                     f=('marble', 5))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_band_trim_A

# >>> cand_band_trim_B
def cand_band_trim_B():
    """B 층 띠: 스투코 사이 흰 대리석 처마돌림(위 밝은 단·아래 그늘), 끝은 벽보다 2px 튀어나온다. 붙임기둥은 띠 위아래로 이어진다."""
    leg = dot.legend('beodeul-noble', t=('stucco', 1), u=('stucco', 2), v=('stucco', 3),
                     a=('marble', 0), b=('marble', 2), c=('marble', 3), d=('marble', 5))
    # 위 돌림띠(밝은 윗면·그늘 밑면) · 스투코 프리즈(대리석 꽃돌 8px 박자) · 아래 돌림띠
    m = ['tttttttttttttttt',
         'dddddddddddddddd',
         'cccccccccccccccc',
         'bbbbbbbbbbbbbbbb',
         'aaaaaaaaaaaaaaaa',
         'tttttttttttttttt',
         'vvvcvvvvvvvcvvvv',
         'vvcdbvvvvvcdbvvv',
         'vvvbvvvvvvvbvvvv',
         'uvvvvvvvuvvvvvvv',
         'uuuuuuuuuuuuuuuu',
         'dddddddddddddddd',
         'cccccccccccccccc',
         'bbbbbbbbbbbbbbbb',
         'aaaaaaaaaaaaaaaa',
         'tttttttttttttttt']
    # 끝: 벽보다 2px 튀어나온 대리석 끝돌(왼쪽 밝게, 오른쪽 그늘). 맨 윗줄은 위층 붙임기둥 발치와 잇는다.
    l = ['aaaaaaaa' + m[0][8:]] + ['ad' + row[2:] for row in m[1:15]] + [m[15]]
    r = [m[0][:8] + 'aaaaaaaa'] + [row[:14] + 'ba' for row in m[1:15]] + [m[15]]
    rows = [l[y] + m[y] + r[y] for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_band_trim_B

# >>> cand_band_trim_C
def cand_band_trim_C():
    # 흰 처마돌림: 위아래는 벽 스투코, 돌림은 벽보다 2px 튀어나온다. 붙임기둥·담쟁이가 띠를 넘어 잇는다.
    leg = dot.legend('beodeul-noble',
                     g=('stucco', 0), h=('stucco', 1), i=('stucco', 2), j=('stucco', 3), k=('stucco', 4),
                     l=('marble', 0), m=('marble', 1), n=('marble', 2), o=('marble', 3), q=('marble', 5),
                     A=('ivy', 0), B=('ivy', 1), C=('ivy', 2), D=('ivy', 3), E=('ivy', 4))
    W = 48
    g = [['j'] * W for _ in range(16)]
    for (sx, sy) in ((3, 2), (9, 13), (13, 1), (6, 14), (11, 12)):
        for p in range(3):
            g[sy][p * 16 + sx] = 'i'
    for y in range(16):
        for i, c in enumerate('hkjjih'):
            g[y][2 + i] = c
        for i, c in enumerate('kjjihg'):
            g[y][40 + i] = c
    for x in range(W):
        g[5][x] = 'q'
        g[6][x] = 'o'
        g[7][x] = 'o'
        g[8][x] = 'n'
        g[9][x] = 'l'
        g[10][x] = 'g'
        g[11][x] = 'h'
    g[5][0] = g[6][0] = g[7][0] = g[8][0] = 'n'
    g[5][47] = g[6][47] = g[7][47] = 'm'
    g[8][47] = 'l'

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < 16:
            g[y][x] = c

    for y in range(16):                          # 왼 붙임기둥 담쟁이 줄기
        put(4, y, 'B' if y % 3 else 'A')
    for (cx, cy) in ((4, 1), (3, 4), (5, 7), (3, 10), (6, 12), (4, 14)):
        put(cx, cy - 1, 'C')
        put(cx - 1, cy, 'C')
        put(cx, cy, 'B')
        put(cx + 1, cy, 'B')
        put(cx, cy + 1, 'A')
        put(cx + 1, cy + 1, 'A')
        put(cx - 1, cy - 1, 'D')
    for y in range(16):                          # 바깥 2px: 돌림 끝 마구리(벽보다 튀어나온 면)
        if y < 5 or y > 9:
            g[y][0], g[y][1] = 'n', 'o'
            g[y][46], g[y][47] = 'm', 'l'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_band_trim_C

# >>> cand_base_stone_A
def cand_base_stone_A():
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            p, lx = divmod(x, 16)
            if y == 0:
                ch = 'F'
            elif y == 1:
                ch = 'E'
            elif y == 2:
                ch = 'C'
            elif y == 15:
                ch = 'B'
            else:
                c, r = divmod(y - 3, 4)
                off = 6 if c % 2 else 2
                if r == 3:
                    ch = 'C'
                elif (x + off) % 8 == 7:
                    ch = 'C'
                elif r == 0:
                    ch = 'E'
                else:
                    ch = 'D'
            if p == 0 and lx == 0 and y > 0:
                ch = 'E'
            if p == 2 and lx == 15 and y > 0:
                ch = 'B'
            g[y][x] = ch
    leg = dot.legend('beodeul-noble', B=('stone', 1), C=('stone', 2), D=('stone', 3), E=('stone', 4),
                     F=('stone', 5))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_base_stone_A

# >>> cand_base_stone_B
def cand_base_stone_B():
    """B 기단: 대리석 계단식 — 밝은 판석 윗단(코 끝 밝게) + 그늘 아래 한 단 들어간 회색 돌 아랫단, 붙임기둥 밑 받침돌."""
    leg = dot.legend('beodeul-noble', A=('marble', 0), B=('marble', 2), C=('marble', 3), D=('marble', 5),
                     e=('stone', 1), f=('stone', 2), g=('stone', 3), h=('stone', 4))
    rot = lambda s, n: s[n:] + s[:n]
    # 윗단 판석: 윗면 2줄 · 코 · 앞면 · 밑 그늘(이음은 16 주기, 칸 경계 밖 x=11)
    slab = ['BBBBBBBBBBBABBBB',
            'CCCCCCCCCCCBCCCC',
            'CCCCCCCCCCCBCCCC',
            'DDDDDDDDDDDBDDDD',
            'BBBBBBBBBBBABBBB',
            'BBBBBBBBBBBABBBB',
            'AAAAAAAAAAAAAAAA',
            'eeeeeeeeeeeeeeee']
    # 아랫단 돌: 8px 박자, 켜 하나라 줄눈만 3px 밀어 칸 경계를 피한다
    step = [rot(r, 5) for r in ['hhhhhhhfhhhhhhhf', 'gggggggfgggggggf', 'gggggggfgggggggf',
                                'gggggggfgggggggf', 'gggggggfgggggggf', 'fffffffefffffffe']]
    m = slab + step + ['ffffffffffffffff', 'eeeeeeeeeeeeeeee']
    # 받침돌(붙임기둥 밑): 윗면 → 앞면(왼 밝게·오른 그늘) → 밑동
    plinth = ['CCCCCCCB', 'DCCCCCCB', 'DCCCCCCB', 'DDDDDDDA', 'DCCCCCBA', 'DCBBBBBA', 'DCBBBBBA',
              'DCBBBBBA', 'DCBBBBBA', 'DCBBBBBA', 'DCBBBBBA', 'DCBBBBBA', 'DBBBBBBA', 'CAAAAAAA',
              'ffffffff', 'eeeeeeee']

    def end(side):
        rows = []
        for y, row in enumerate(m):
            row = list(row)
            if y >= 8:                       # 아랫단은 판석보다 2px 들어간다
                for x in ((0, 1) if side == 'l' else (14, 15)):
                    row[x] = 'e'
            x0 = 1 if side == 'l' else 7
            row[x0:x0 + 8] = plinth[y]
            if y < 8:                        # 판석 끝면: 왼쪽 밝게, 오른쪽 그늘
                if side == 'l':
                    row[0] = 'D' if y < 4 else 'C'
                else:
                    row[15] = 'B' if y < 4 else 'A'
            rows.append(''.join(row))
        return rows
    L, R = end('l'), end('r')
    rows = [L[y] + m[y] + R[y] for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_B

# >>> cand_base_stone_C
def cand_base_stone_C():
    # 회색 주춧돌 기단: 위 갓돌 2줄, 엇갈린 돌 두 켜, 아래 굽돌.
    leg = dot.legend('beodeul-noble', **{'0': ('stone', 0), '1': ('stone', 1), '2': ('stone', 2),
                                         '3': ('stone', 3), '4': ('stone', 4), '5': ('stone', 5)})
    rows = []
    for y in range(16):
        s = []
        for x in range(48):
            if y == 0:
                c = '4'
            elif y == 1:
                c = '5'
            elif y >= 13:
                c = '1' if y < 15 or x % 8 else '0'
            elif y == 12:
                c = '2'
            elif y in (2, 7):
                c = '2'
            else:
                top = 3 if y < 7 else 8
                xs = (x + (0 if y < 7 else 4)) % 8
                if xs == 0:
                    c = '2'
                elif xs == 7 and y > top - 1:
                    c = '3'
                elif y == top or xs == 1:
                    c = '4'
                elif y == top + 3:
                    c = '2'
                else:
                    c = '3'
            if x == 0 and 1 < y < 13:
                c = '3'
            if x == 47 and 1 < y < 13:
                c = '1'
            s.append(c)
        rows.append(''.join(s))
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_C


CANDIDATES = {
    'roof.mansard': {'A': cand_roof_mansard_A, 'B': cand_roof_mansard_B, 'C': cand_roof_mansard_C},
    'roof.mansard.tall': {'A': cand_roof_mansard_tall_A, 'B': cand_roof_mansard_tall_B, 'C': cand_roof_mansard_tall_C},
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'band.trim': {'A': cand_band_trim_A, 'B': cand_band_trim_B, 'C': cand_band_trim_C},
    'base.stone': {'A': cand_base_stone_A, 'B': cand_base_stone_B, 'C': cand_base_stone_C},
}

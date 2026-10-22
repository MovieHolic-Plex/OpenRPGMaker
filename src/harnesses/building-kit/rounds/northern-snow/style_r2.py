"""building-kit northern-snow style-r2 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

설원 북방 마을 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r2'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_steep_A
def cand_roof_steep_A(tall=False):
    # 눈 덮인 모임지붕 — 용마루(밝은 선)·눈 사면·눈 처마 턱·너와·서까래 끝·고드름. l·r 위 귀퉁이를 사선으로 비운다.
    leg = dot.legend('northern-snow',
                     A=('snow', 5), B=('snow', 4), C=('snow', 3), D=('snow', 2), E=('snow', 1), F=('snow', 0),
                     g=('shake', 1), p=('shake', 2), h=('shake', 3), i=('shake', 4), j=('shake', 5),
                     **{'1': ('wood', 1), '2': ('wood', 2), '3': ('wood', 3), '4': ('wood', 4), '5': ('wood', 5)})
    top = ['FFFFFFFFFFFFFFFF',
           'BBBBBBBBBBBBBBBB',
           'AAAAAAAAAAAAAAAA',
           'AAAAAAAAAAAAAAAA',
           'EEEEECEEEEEEECEE']
    # 눈 사면: 바람 결(밝은 둔덕 B 위·그늘 E 아래), 16 주기
    up = ['CCCCCCBBBBCCCCCC',
          'CCCCCCCEEECCCCCC',
          'CCCCCCCCCCCCCCCC',
          'BBCCCCCCCCCCCBBB',
          'CECCCCCCCCCCCCEE',
          'CCCCCCCCCCCCCCCC']
    lo = ['CCCECCCCCCCCECCC',
          'CCCCCCCCCCCCCCCC',
          'ECCCCCCECCCCCCCE',
          'CCCCCCCCCCCCCCCC']
    # 처마 눈 턱 + 늘어진 눈 자락(칸마다 고른 길이) 뒤로 너와 두 단
    shingle = ['jjjgjjjjgjjjgjjj',
               'iiigiiiigiiigiii',
               'hhhghhhhghhhghhh',
               'pppppppppppppppp',
               'jgjjjjgjjjgjjjjg',
               'igiiiigiiigiiiig',
               'hghhhhghhhghhhhg',
               'pppppppppppppppp',
               'jjjgjjjjgjjjgjjj',
               'iiigiiiigiiigiii',
               'hhhghhhhghhhghhh',
               'pppppppppppppppp']
    drip = [5, 7, 8, 6, 5, 5, 9, 7, 5, 6, 8, 10, 7, 5, 6, 5]
    lip = ['AAAAAAAAAAAAAAAA',
           'BBBBBBBBBBBBBBBB',
           'BBBBBBBBBBBBBBBB',
           'CCCCCCCCCCCCCCCC',
           'CCCCCCCCCCCCCCCC']
    for k in range(5, 17):
        row = ''
        for c in range(16):
            if k < drip[c]:
                row += 'C'
            elif k == drip[c]:
                row += 'E'
            elif k == drip[c] + 1:
                row += 'p'
            else:
                row += shingle[k - 5][c]
        lip.append(row)
    lip += ['5541554155415541',
            '4431443144314431',
            '3321332133213321',
            'gBggBggggBggBggg',
            'gDggDggggDgggggg',
            'gEggggggggggggggg'[:16]]
    if tall:
        slope = up * 4 + lo * 3
        hip = [15, 15, 14, 14, 14, 13, 13, 13, 12, 12, 12, 11, 11, 11, 11, 10, 10, 10, 9, 9, 9,
               9, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4]
    else:
        slope = up * 2 + lo * 2
        hip = [15, 14, 14, 13, 13, 12, 12, 11, 11, 11, 10, 10, 9, 9, 8, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4]
    m = top + slope + lip
    n_up = len(top) + len(slope)
    assert len(hip) == n_up
    # 끝 조각: 비운 귀퉁이 → 모임 경사면(l 밝게·r 어둡게) → 골 선 → 앞 사면
    face_l = 'AAABAAAAABAAAAAA'
    face_r = 'EEEFEEEEEFEEEEEE'
    l_rows, r_rows = [], []
    for y in range(len(m)):
        row = m[y]
        if y < n_up:
            s = max(13 - y, 0)
            xh = hip[y]
            lr = ''
            for x in range(16):
                if x < s:
                    lr += '.'
                elif x == s:
                    lr += 'F'
                elif x < xh:
                    lr += face_l[(x + y) % 16]
                elif x == xh:
                    lr += 'E'
                else:
                    lr += row[x]
            rr = ''
            for c in range(16):
                x = 15 - c
                if x < s:
                    rr += '.'
                elif x == s:
                    rr += 'F'
                elif x < xh:
                    rr += face_r[(x + y) % 16]
                elif x == xh:
                    rr += 'B'
                else:
                    rr += row[c]
        else:
            k = y - n_up
            if k < 6:
                lr, rr = 'D' + row[1:], row[:15] + 'E'
            elif k < 17:
                lr, rr = '24' + row[2:], row[:14] + '32'
            elif k < 20:
                lr, rr = '3' + row[1:], row[:15] + '2'
            else:
                lr, rr = row, row
        l_rows.append(lr)
        r_rows.append(rr)
    rows = [l_rows[y] + m[y] + r_rows[y] for y in range(len(m))]
    return dot.grid(rows, leg), {}
# <<< cand_roof_steep_A

# >>> cand_roof_steep_B
_B_ROOF = dict(W=('snow', 5), w=('snow', 4), s=('snow', 3), t=('snow', 2), u=('snow', 1), v=('snow', 0),
               a=('shake', 1), b=('shake', 2), c=('shake', 3), d=('shake', 4), e=('shake', 5), f=('shake', 6),
               n=('wood', 1), o=('wood', 2), p=('wood', 3), q=('wood', 4))

# 눈 사면 — 위 1/3 은 밝은 단(w), 아래로 s, 끝 무렵 바람 결(t·u) 이 늘어난다. 줄 조각은 16 주기.
_B_SLOPE_HI = ['wwwwwwwwwwwwwwww', 'wwwwwwwwwsswwwww', 'wwwsssswwwwwwwww', 'wwwwwwwwwwwwwwww']
_B_SLOPE_MID = ['ssssssssswwwssss', 'ssssssssssssssss', 'sssssssssssstttt', 'ssssssssssssssss',
                'ttsssssssssssssw', 'ssssssssssssssss']
_B_SLOPE_LO = ['sssssstttttsssss', 'ssssssssssssssss', 'uuuusssssssssuuu', 'ssssssssssssssss',
               'sssuuuuussssssss', 'tttttttttttttttt']

# 눈 끝 덩이 8행 — 칸마다 눈 깊이(행 수), 그 아래는 너와가 드러난다(덩이 바로 밑은 그늘).
_B_LUMP = [8, 8, 8, 7, 5, 4, 4, 5, 7, 8, 8, 6, 3, 3, 5, 7]
_B_SHAKE = ['dddcdddddddcdddd', 'cccccccccccccccc', 'aaaaaaaaaaaaaaaa', 'eeeeeeeeeeeeeeee',
            'ddddcdddddddcddd', 'cccccccccccccccc', 'aaaaaaaaaaaaaaaa', 'eeeeeeeeeeeeeeee']
# 처마 16행 — 너와 두 단 · 널 끝(4px 박자) · 처마 밑 그늘과 고드름(맨 아래까지 불투명)
_B_EAVE = [
    'ddddcdddddddcddd',
    'cccccccccccccccc',
    'aaaaaaaaaaaaaaaa',
    'eeeeeeeeeeeeeeee',
    'dddcdddddddcdddd',
    'cccccccccccccccc',
    'bbbbbbbbbbbbbbbb',
    'aaaaaaaaaaaaaaaa',
    'qqqpqqqpqqqpqqqp',
    'qoopqoopqoopqoop',
    'nnnnnnnnnnnnnnnn',
    'awwaaaawwaaawwaa',
    'auuaaaasuaaasuaa',
    'aauaaaasuaaaaua',
    'aauaaaaauaaaaaaa',
    'aaaaaaaaaaaaaaaa',
]
_B_EAVE[13] += 'a'

def _b_lump_rows():
    rows = [list(r) for r in _B_SHAKE]
    for x, dep in enumerate(_B_LUMP):
        for y in range(dep):
            rows[y][x] = 'v' if y == dep - 1 else ('u' if y == dep - 2 else ('t' if y < 2 else 's'))
        if dep < 8:
            rows[dep][x] = 'a'
    return [''.join(r) for r in rows]

def _b_roof_rows(slope_rows):
    m = ['vuuuuuuuuuuuuuuu',
         'WWWWWWWWWWWWWWWW',
         'wWwwwwWwwwwwWwww',
         'uuuuuuuuuuuuuuuu']
    hi = slope_rows // 4
    lo = len(_B_SLOPE_LO)
    m += [_B_SLOPE_HI[i % 4] for i in range(hi)]
    m += [_B_SLOPE_MID[i % 6] for i in range(slope_rows - hi - lo)]
    m += _B_SLOPE_LO
    return m + _b_lump_rows() + _B_EAVE

def _b_hip_end(m, cut, hip, side):
    """끝 조각 — 위 귀퉁이를 사선으로 비우고(cut), 모임지붕 끝면(cut~hip)을 l 밝게·r 어둡게."""
    face, crease, edge = ('W', 'u', 'w') if side == 'l' else ('v', 'u', 'v')
    out = []
    for y, row in enumerate(m):
        r = list(row if side == 'l' else row[::-1])
        x0 = cut[y] if y < len(cut) else 0
        if y < len(hip):
            xh = hip[y]
            for x in range(16):
                if x < x0:
                    r[x] = '.'
                elif x < xh:
                    r[x] = edge if x == x0 else face
                elif x == xh and y > 3:
                    r[x] = crease
        else:
            r[0] = 'q' if side == 'l' else 'o'
        out.append(''.join(r if side == 'l' else r[::-1]))
    return out

def _b_roof(slope_rows, hip):
    leg = dot.legend('northern-snow', **_B_ROOF)
    m = _b_roof_rows(slope_rows)
    cut = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    l = _b_hip_end(m, cut, hip, 'l')
    r = _b_hip_end(m, cut, hip, 'r')
    return dot.grid([a + b + c for a, b, c in zip(l, m, r)], leg), {}

def cand_roof_steep_B():
    # 모임지붕 끝선 — 용마루 끝(12,0)에서 앞 처마 모서리(0,29)로
    hip = [12, 12, 11, 11, 10, 10, 10, 9, 9, 8, 8, 8, 7, 7, 6, 6, 6, 5, 5, 4, 4, 4, 3, 3, 2, 2, 2, 1, 1, 0]
    return _b_roof(20, hip)
# <<< cand_roof_steep_B

# >>> cand_roof_steep_C
def _c_roof(tiles):
    """줄 C 눈 지붕 — 모임지붕 끝(l 밝게·r 어둡게) + 눈 처마 립 + 널 끝 + 고드름. tiles=3 또는 4."""
    W, H = 48, 16 * tiles
    sl1 = H - 18          # 눈 처마 립 시작 행
    sh0 = sl1 + 3         # 눈 아래 드러난 너와 지붕
    fa0 = sl1 + 11        # 널 끝(처마 판)
    un0 = sl1 + 14        # 처마 밑(고드름)
    g = [['.'] * W for _ in range(H)]
    drift = {0: (1, 5), 1: (9, 14), 2: (4, 8), 3: (12, 16)}   # 사면 결 줄 x 구간(16 주기)
    lip = [2, 3, 3, 1, 0, 1, 4, 6, 5, 2, 0, 0, 1, 3, 2, 1]     # 눈 처마 덩이가 너와 위로 처진 길이
    splits = ({3, 9, 14}, {0, 6, 12})                          # 너와 단 세로 이음
    icic = {2: 4, 7: 2, 10: 3, 14: 1}                          # 고드름 길이
    for y in range(H):
        for x in range(W):
            u = x % 16
            if y == 0:
                c = 'b'
            elif y in (1, 2):
                c = 'f'
            elif y == 3:
                c = 'e'
            elif y == 4:
                c = 'c'
            elif y < sl1:
                c = 'd'
                k = (y - 5) % 6
                a, b = drift[((y - 5) // 6) % 4]
                if k == 4 and a <= u < b:
                    c = 'e'
                elif k == 5 and a <= u < b:
                    c = 'b'
            elif y == sl1:
                c = 'e'
            elif y == sl1 + 1:
                c = 'f' if u % 8 in (1, 2, 3, 4) else 'e'
            elif y == sl1 + 2:
                c = 'd'
            elif y < fa0:
                t = y - sh0
                if t < lip[u]:
                    c = 'a' if t == lip[u] - 1 else ('c' if t == 0 else 'd')
                else:
                    r0 = t % 4
                    if (u in splits[(t // 4) % 2]) and r0 != 3:
                        c = 'g'
                    else:
                        c = ('m', 'k', 'j', 'h')[r0]
            elif y < un0:
                t = y - fa0
                if t == 0:
                    c = 'i'
                elif u % 4 == 3:
                    c = 'g'
                elif u % 4 == 0:
                    c = 'm'
                else:
                    c = 'k'
            else:
                t = y - un0
                c = 'h' if t == 0 else 'g'
                ln = icic.get(u, 0)
                if ln > t:
                    c = 'a' if t == ln - 1 else ('e' if t == 0 else 'c')
            g[y][x] = c
    # 모임지붕 끝 — 위쪽 바깥 모서리를 사선으로 비우고, 끝 경사면(l 밝게·r 어둡게)
    cut = 13
    for y in range(sl1):
        hip = 14 - round(11 * max(0, y - 1) / (sl1 - 1))
        for x in range(16):
            for side in ('l', 'r'):
                X = x if side == 'l' else W - 1 - x
                lit = side == 'l'
                if y < cut and x < cut - y:
                    g[y][X] = '.'
                elif (y < cut and x == cut - y) or (y >= cut and x == 0):
                    g[y][X] = 'c' if lit else 'a'      # 바깥 가장자리 = 재질 어두운 단
                elif x < hip:
                    if lit:
                        g[y][X] = 'e' if (x + y) % 7 == 0 else 'f'
                    else:
                        g[y][X] = 'a' if (x + y) % 7 == 0 else 'b'
                elif x == hip:
                    g[y][X] = 'b' if lit else 'a'      # 모임 능선
    # 처마 끝 널 마구리(바깥 2px)
    for y in range(sh0, un0):
        if g[y][0] in 'gijkmh':
            g[y][0] = 'h'
            g[y][1] = 'm'
        if g[y][W - 1] in 'gijkmh':
            g[y][W - 1] = 'g'
            g[y][W - 2] = 'h'
    rows = [''.join(r) for r in g]
    lg = dot.legend('northern-snow',
                    a=('snow', 0), b=('snow', 1), c=('snow', 2), d=('snow', 3), e=('snow', 4), f=('snow', 5),
                    g=('shake', 1), h=('shake', 2), i=('shake', 3), j=('shake', 4),
                    k=('shake', 5), m=('shake', 6))
    return dot.grid(rows, lg), {}

def cand_roof_steep_C():
    return _c_roof(3)
# <<< cand_roof_steep_C

# >>> cand_roof_steep_tall_A
def cand_roof_steep_tall_A():
    # 2층용 4행 — 같은 눈 지붕에 사면을 16px 늘리고 모임 경사선도 길게.
    return cand_roof_steep_A(tall=True)
# <<< cand_roof_steep_tall_A

# >>> cand_roof_steep_tall_B
def cand_roof_steep_tall_B():
    # 사면 40행 — 끝선은 (12,0)→(0,45)
    hip = [12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6,
           5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 0]
    return _b_roof(36, hip)
# <<< cand_roof_steep_tall_B

# >>> cand_roof_steep_tall_C
def cand_roof_steep_tall_C():
    return _c_roof(4)
# <<< cand_roof_steep_tall_C

# >>> cand_wall_storey_A
def cand_wall_storey_A():
    # 통나무 벽 한 층 — 맨 위 처마 그늘 2행, 5px 통나무 단 6줄, 양끝 마구리, 눈 얹힌 창, 널 문.
    leg = dot.legend('northern-snow',
                     **{'1': ('log', 1), '2': ('log', 2), '3': ('log', 3), '4': ('log', 4), '5': ('log', 5), '6': ('log', 6)},
                     W=('wood', 5), V=('wood', 4), U=('wood', 3), T=('wood', 2), t=('wood', 1),
                     S=('snow', 4), R=('snow', 2), Q=('snow', 0), G=('iron', 1), H=('iron', 2), I=('iron', 3))
    course = [['4444444444444444', '3333233333333333', '3333333333332333', '2222222222222222', '1111111111111111'],
              ['4444444444444444', '3333333333233333', '3332333333333333', '2222222222222222', '1111111111111111']]
    m = ['1111111111111111', '2222222222222222']
    for c in range(6):
        m += course[c % 2]
    end_l = ['25662', '56645', '56445', '25452', '12221']
    end_r = ['24552', '45542', '45422', '24221', '12221']
    l, r = [], []
    for y, row in enumerate(m):
        if y < 2:
            l.append('..' + row[2:])
            r.append(row[:14] + '..')
        else:
            k = (y - 2) % 5
            l.append('..' + end_l[k] + '1' + row[8:])
            r.append(row[:8] + '2' + end_r[k] + '..')
    win = {7: 'SSSSSSSSSS', 8: 'WWWWWWWWWW',
           9: 'WVVVVVVVVt', 10: 'WQQGGVHGGt', 11: 'WQGGGVGGHt', 12: 'WGGGHVGGGt', 13: 'WGGGGVGGGt',
           14: 'WVVVVVVVVt', 15: 'WQGGGVQGGt', 16: 'WGGGHVGGGt', 17: 'WGGGGVGGHt', 18: 'WGGGGVGGGt',
           19: 'RSSSSSSSSR', 20: 'WWWWWWWWWW', 21: 'tttttttttt'}
    w = [row[:3] + win[y] + row[13:] if y in win else row for y, row in enumerate(m)]
    plank = '2WVUUtVUUtT1'
    door = {2: '2WWWWWWWWWW2', 3: '2VVVVVVVVVV1', 4: '2WttttttttT1',
            9: '2WIHIIIIHIT1', 25: '2WIHIIIIHIT1',
            17: '2WVUUtVUItT1', 18: '2WVUUtVUItT1', 31: '2WTTTTTTTTT1'}
    d = [row[:2] + door.get(y, plank) + row[14:] if y >= 2 else row for y, row in enumerate(m)]
    rows = [l[y] + m[y] + w[y] + d[y] + r[y] for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
# 회벽 얼룩 — 행 번호 → 열(세로 2px 짝)
_B_SPECK_UP = {2: (3, 13), 3: (3, 13), 6: (1, 11), 7: (1, 11), 8: (4, 14), 9: (4, 14)}
_B_SPECK_LO = {2: (2, 12), 3: (2, 12), 5: (5, 10), 6: (5, 10), 8: (1, 14), 9: (1, 14, 4), 10: (4, 11), 11: (11,)}

def cand_wall_storey_B():
    # 반목조 — 회벽(H) + 기둥·가로대·가새(목재), 처마 그늘은 맨 위 두 줄 목재 어두운 단
    leg = dot.legend('northern-snow', H=('hplaster', 3), g=('hplaster', 1), h=('hplaster', 0),
                     n=('wood', 1), o=('wood', 2), p=('wood', 3), q=('wood', 4), r=('wood', 5),
                     k=('iron', 1), j=('iron', 2), z=('iron', 3), w=('snow', 4), u=('snow', 1))
    # 처마 그늘 두 줄 — 지붕 고드름(1·2·7·12 열)이 그늘 위로 이어진다
    top = ['nuunnnnunnnnnunn', 'nunnnnnunnnnnnnn', 'qqqqrqqqqqqqrqqq', 'oooooooooooooooo']
    rail = ['qqqqqqqqqqqqqqqq', 'oooooooooooooooo']
    sill = ['pppppppppppppppp', 'oooooooooooooooo', 'oooooooooooooooo']

    def panel(n, brace=None):
        rows = []
        for i in range(n):
            r = list(('g' if i == 0 else 'H') * 16)
            r[7:9] = 'qo'
            for x in (_B_SPECK_UP if n == 11 else _B_SPECK_LO).get(i, ()):
                r[x] = 'h'
            if brace:
                a, b = 5 - i // 2, 9 + i // 2
                if 0 <= a:
                    r[a:a + 2] = 'qp'
                if b <= 14:
                    r[b:b + 2] = 'po'
            rows.append(''.join(r))
        return rows

    win = ['nnnnnnnnnn', 'oojjkojjko', 'oozjkozjko', 'oojkkojkko', 'ookkkokkko', 'oooooooooo',
           'oojjkojjko', 'ookkkokkko', 'oooooooooo']
    m = top + panel(11, '/') + rail + panel(12) + sill
    w = top + panel(11) + rail + panel(12) + sill
    w = [list(r) for r in w]
    for i, s in enumerate(win):
        w[4 + i][3:13] = s
    w[13][2:14] = 'wwwwwwwwwwww'
    w[14][2:14] = 'qqqqqqqqqqqq'
    w = [''.join(r) for r in w]

    d = [list(r) for r in top + panel(11) + rail + panel(12) + sill]
    for y in range(5, 29):
        if y == 5:
            d[y][3:13] = 'oooooooooo'
        elif y in (10, 22):
            d[y][3:13] = 'oqqqqqqqqn'
        else:
            d[y][3:13] = 'oqppoqppon'
    d[16][10:12] = 'zj'
    d[17][10:12] = 'jk'
    d[28][3:13] = 'nnnnnnnnnn'
    d = [''.join(r) for r in d]

    def end(rows, side):
        out = []
        for y, row in enumerate(rows):
            r = list(row)
            if side == 'l':
                r[0:2] = '..'
                r[2:5] = 'qpo' if y >= 4 else row[2] * 3
            else:
                r[14:16] = '..'
                r[11:14] = 'qpo' if y >= 4 else row[11] * 3
            out.append(''.join(r))
        return out

    l = end(m, 'l')
    r = end(m, 'r')
    rows = [a + b + c + e + f for a, b, c, e, f in zip(l, m, w, d, r)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C():
    """두꺼운 마름돌 벽 — 처마 그늘 2행, 모퉁이 귀돌, 깊은 작은 창(눈 쌓인 창턱), 아치 나무문."""
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    dark_blocks = {(1, 0), (3, 1), (4, 0), (0, 1)}   # (단, 16 주기 안 돌 번호) 조금 어두운 돌
    for y in range(H):
        for x in range(2, W - 2):
            if y == 0:
                c = 'o'
            elif y == 1:
                c = 'p'
            else:
                course = (y - 2) // 6
                j = (y - 2) % 6 if y < H - 1 else 1
                u = (x + (6 if course % 2 else 2)) % 16
                v = u % 8
                base = 'q' if (course, u // 8) in dark_blocks else 'r'
                if j == 5 or v == 7:
                    c = 'p'
                elif j == 0 and v < 6:
                    c = 's' if base == 'r' else 'r'
                elif j == 4 or v == 6:
                    c = 'q' if base == 'r' else 'p'
                else:
                    c = base
            g[y][x] = c
    # 모퉁이 귀돌(긴 돌·짧은 돌 번갈아) — l 밝게, r 어둡게
    for y in range(2, H):
        course = (y - 2) // 6
        j = (y - 2) % 6 if y < H - 1 else 1
        ln = 8 if course % 2 == 0 else 5
        for k in range(ln):
            for side in ('l', 'r'):
                X = 2 + k if side == 'l' else W - 3 - k
                if j == 5 or k == ln - 1:
                    c = 'p' if side == 'l' else 'o'
                elif side == 'l':
                    c = 't' if (j == 0 or k == 1) else ('r' if j == 4 else 's')
                else:
                    c = 'r' if j == 0 else ('p' if j == 4 or k == 1 else 'q')
                if k == 0:
                    c = 'q' if side == 'l' else 'o'     # 바깥 모서리 = 어두운 단
                g[y][X] = c
    # 창(x33~45)
    win = {
        6:  'ptttttttttttp',
        7:  'psssssssssssp',
        8:  'pqqqqqqqqqqqp',
        9:  'psoooooooooqp',
        10: 'psoWWWWWWWqrp',
        11: 'psoWxvWvvWqrp',
        12: 'psoWvxWvvWqrp',
        13: 'psoWvvWvvWqrp',
        14: 'psoWWWWWWWqrp',
        15: 'psoWvvWxvWqrp',
        16: 'psoWvvWvxWqrp',
        17: 'psoWvvWvvWqrp',
        18: 'psoVVVVVVVqrp',
        19: 'effffffffffff',
        20: 'ssssssssssssr',
        21: 'ppppppppppppp',
    }
    for y, s in win.items():
        for i, c in enumerate(s):
            g[y][33 + i] = c
    # 문(x50~61) — 돌 아치 + 나무 널 + 쇠 띠
    for y in range(2, H):
        for x in range(50, 62):
            if y == 2:
                c = 't' if x < 56 else 's'
            elif x == 50:
                c = 's'
            elif x == 61:
                c = 'q'
            elif y == 3:
                c = 'o' if x in (51, 60) else ('s' if x in (52, 59) else 'B')
            elif y == 4 and x in (51, 60):
                c = 'o'
            elif y == 4:
                c = 'B'
            else:
                k = (x - 51) % 3
                if x == 51:
                    c = 'E'
                elif x == 60:
                    c = 'B'
                elif k == 2:
                    c = 'C'
                else:
                    c = 'D' if k == 0 else 'F'
                if y in (9, 25):
                    c = 'x' if x in (52, 55, 58) else 'y'
                if y == H - 1:
                    c = 'C'
            g[y][x] = c
    g[17][58] = 'x'
    g[18][58] = 'z'
    rows = [''.join(r) for r in g]
    lg = dot.legend('northern-snow',
                    o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), t=('stone', 5),
                    e=('snow', 4), f=('snow', 5),
                    B=('wood', 1), C=('wood', 2), D=('wood', 4), E=('wood', 5), F=('wood', 3),
                    V=('wood', 2), W=('wood', 3),
                    v=('iron', 1), x=('iron', 3), y=('iron', 2), z=('iron', 0))
    return dot.grid(rows, lg), {}
# <<< cand_wall_storey_C

# >>> cand_base_stone_A
def cand_base_stone_A():
    # 돌 기단 — 윗면 밝은 단, 마름돌 두 단(줄눈 엇갈림), 아래는 눈 더미가 덮는다.
    leg = dot.legend('northern-snow',
                     **{'1': ('stone', 1), '2': ('stone', 2), '3': ('stone', 3), '4': ('stone', 4), '5': ('stone', 5)},
                     A=('snow', 5), B=('snow', 4), C=('snow', 3), E=('snow', 1), F=('snow', 0))
    blk = ['44433321', '43333321', '33333221', '22222221']
    m = ['2222222222222222', '4444444444444444']
    m += [(b + b)[2:] + (b + b)[:2] for b in blk]
    m += ['1111111111111111']
    m += [(b + b)[6:] + (b + b)[:6] for b in blk]
    m += ['22BAB2222BAAB222',
          'BBCCBBB2BCCCCBBB',
          'CCCCCCCBCCCCCCCC',
          'CCCCCEECCCCCCEEC',
          'EFEEEEEEEFEEEEEE']
    m = m[:16]
    l, r = [], []
    for y, row in enumerate(m):
        if y < 11:
            l.append(('2' if y == 0 else '4' if y == 1 else '3') + row[1:])
            r.append(row[:15] + ('2' if y < 2 else '1'))
        else:
            l.append(row)
            r.append(row)
    rows = [l[y] + m[y] + r[y] for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_A

# >>> cand_base_stone_B
def cand_base_stone_B():
    # 마름돌 기단 — 갓돌 윗면 · 두 단 쌓기(엇물림) · 발치에 쌓인 눈
    leg = dot.legend('northern-snow', B=('stone', 4), C=('stone', 3), D=('stone', 2), E=('stone', 1),
                     w=('snow', 4), s=('snow', 3), t=('snow', 2), u=('snow', 1))
    m = ['EEEEEEEEEEEEEEEE',
         'BBBBBBBBBBBBBBBB',
         'CCCCCCCCCCCCCCCC',
         'EEEEEEEEEEEEEEEE',
         'CCCCCCCECCCCCCCE',
         'CDDDDDDECDDDDDDE',
         'DDDDDDDEDDDDDDDE',
         'EEEEEEEEEEEEEEEE',
         'CCCECCCCCCCECCCC',
         'DDDECDDDDDDECDDD',
         'DDDEDDDDDDDEDDDD',
         'EEEEEEEEEEEEEEEE',
         'DtuEDDDDDtuuEDDD',
         'ttsuuEDDtssuuuEt',
         'wwwssuttwwwsssuw',
         'ssssssssssssssss']
    l = ['C' + r[1:] if 0 < y < 12 else r for y, r in enumerate(m)]
    r = [r[:15] + 'E' if y < 12 else r for y, r in enumerate(m)]
    return dot.grid([a + b + c for a, b, c in zip(l, m, r)], leg), {}
# <<< cand_base_stone_B

# >>> cand_base_stone_C
def cand_base_stone_C():
    """눈 위 돌 기단 — 윗턱(밝은 단) + 거친 큰 돌 + 발치에 쌓인 눈 둔덕."""
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    drift = [3, 3, 2, 2, 2, 3, 4, 4, 3, 2, 2, 3, 3, 4, 4, 3]   # 눈 둔덕 높이(16 주기, 아래에서)
    for y in range(H):
        for x in range(W):
            u = x % 16
            top = H - 1 - drift[u]
            if y == 0:
                c = 's' if x < 36 else 'r'      # 윗턱 — 오른쪽 끝은 그늘 쪽
            elif y == 1:
                c = 'r' if x < 36 else 'q'
            elif y == 2:
                c = 'p'
            else:
                j = (y - 3) % 5
                course = (y - 3) // 5
                joints = (4, 11) if course % 2 == 0 else (1, 8)   # 6·10 폭 돌, 16 주기
                if j == 4 or u in joints:
                    c = 'o'
                elif j == 0 or (u - 1) % 16 in joints:
                    c = 'r'
                elif j == 3:
                    c = 'p'
                else:
                    c = 'q'
            if y > top:
                c = 'b' if y == H - 1 else ('e' if y == top + 1 else 'd')
            elif y == top:
                c = 'p'      # 눈과 돌 사이 그늘
            g[y][x] = c
    for y in range(H):
        if g[y][0] not in 'bde':
            g[y][0] = 'q' if y else 's'
        if g[y][W - 1] not in 'bde':
            g[y][W - 1] = 'o'
    rows = [''.join(r) for r in g]
    lg = dot.legend('northern-snow',
                    o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), t=('stone', 5),
                    b=('snow', 1), d=('snow', 3), e=('snow', 4))
    return dot.grid(rows, lg), {}
# <<< cand_base_stone_C


CANDIDATES = {
    'roof.steep': {'A': cand_roof_steep_A, 'B': cand_roof_steep_B, 'C': cand_roof_steep_C},
    'roof.steep.tall': {'A': cand_roof_steep_tall_A, 'B': cand_roof_steep_tall_B, 'C': cand_roof_steep_tall_C},
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'base.stone': {'A': cand_base_stone_A, 'B': cand_base_stone_B, 'C': cand_base_stone_C},
}

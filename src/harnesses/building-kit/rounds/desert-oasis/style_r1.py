"""building-kit desert-oasis style-r1 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

사막 오아시스 도시 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r1'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_flat_A
def _adobe_legend_A():
    return dot.legend('desert-oasis', A=('adobe', 0), B=('adobe', 1), C=('adobe', 2), D=('adobe', 3),
                      E=('adobe', 4), F=('adobe', 5), G=('adobe', 6),
                      v=('wood', 1), w=('wood', 2), x=('wood', 3), y=('wood', 5),
                      h=('sandstone', 1), i=('sandstone', 3), j=('sandstone', 4), k=('sandstone', 5))


def cand_roof_flat_A():
    # 3×3칸 = 48×48. 위 칸: 뒤 난간(총안)·안쪽 면, 가운데 칸: 다진 흙 지붕 면, 아래 칸: 남쪽 난간·들보 끝·처마 그늘.
    m = [
        'FGGGFDCDFGGGFDCD',  # 0 뒤 총안 머리(빛)
        'EFFFEDCDEFFFEDCD',
        'EEEEEDCDEEEEEDCD',
        'FFFFFFFFFFFFFFFF',  # 3 난간 갓돌
        'EEEEEEEEEEEEEEEE',
        'DDDDDEDDDDDDDDED',  # 5 뒤 난간 안쪽 면
        'DDDDDDDDDDEDDDDD',
        'DDDEDDDDDDDDDDDD',
        'CDDDDDDDCDDDDDDD',
        'CCCCCCCCCCCCCCCC',  # 9 난간 그림자
        'DDDDDDDDDDDDDDDD',
        'DEDDDDDEDDDDDEDD',
        'EEEEEEEEEEEEEEEE',  # 12 지붕 면 시작
        'EEEFEEEEEEEEEEEE',
        'EEEEEEEEEEDEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEFEEEEEEEEE',
        'EDEEEEEEEEEEEEFE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEDEEEEEE',
        'EEFEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEDE',
        'EEEEEFEEEEEEEEEE',
        'EEEEEEEEEEEFEEEE',
        'EEEEEEEEEEEEEEEE',
        'EDEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEDEEEEEEEE',
        'EEEEEEEEEEEEEFEE',
        'EEEEEEEEEEEEEEEE',
        'DEEEDEEEDEEEDEEE',  # 32 앞 난간에 가까워지며 살짝 그늘
        'DDDDDDDDDDDDDDDD',
        'GGGGDDDDGGGGDDDD',  # 34 남쪽 총안 머리
        'FFFFCCCCFFFFCCCC',
        'EFFECCCCEFFECCCC',
        'GGGGGGGGGGGGGGGG',  # 37 앞 난간 갓돌
        'FFFFFFFFFFFFFFFF',
        'EEEEEEEEEEEEEEEE',  # 39 정면 위 띠
        'EEDEEEEEEEEDEEEE',
        'EEyxEEEEEEyxEEEE',  # 41 들보 끝(나무)
        'EExwEEEEEExwEEEE',
        'DDCCDDDDDDCCDDDD',
        'DDDDDDDDDDDDDDDD',  # 44 처마 그늘
        'DCDDDDDCDDDDDDCD',
        'CCCCCCCCCCCCCCCC',
        'BBBBBBBBBBBBBBBB',
    ]

    # 지붕 윗면은 햇볕을 정면으로 받아 벽보다 한 단 밝다
    lit = str.maketrans('DEF', 'EFG')
    m = [row.translate(lit) if 12 <= y <= 31 else row for y, row in enumerate(m)]

    def edge_l(y, row):
        r = list(row)
        if y <= 2:
            r[0:5] = ['CFGGF', 'CFFFE', 'CEEEE'][y]
        elif y <= 4:
            r[0] = 'C'
        elif y <= 36:
            r[0:5] = 'CGFDD' if not 34 <= y <= 36 else 'CGF' + row[3:5]
        elif y <= 40:
            r[0] = 'C'
        else:
            r[0:3] = 'CDD' if y < 44 else 'BCC'  # 처마 바깥 끝(벽 inset 2 위로 튀어나옴)
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        if y <= 4:
            r[15] = 'B'
        elif y <= 36:
            r[11:16] = 'EFFDB' if not 34 <= y <= 36 else row[11:13] + 'FDB'
        elif y <= 40:
            r[14:16] = 'DB'
        else:
            r[13:16] = 'CCB' if y < 44 else 'BBA'
        return ''.join(r)

    rows = [edge_l(y, m[y]) + m[y] + edge_r(y, m[y]) for y in range(48)]
    return dot.grid(rows, _adobe_legend_A()), {}
# <<< cand_roof_flat_A

# >>> cand_roof_flat_B
def cand_roof_flat_B():
    # 사암 돔 줄 — 뒤 테 · 흙 다짐 지붕 면 · 남쪽 총안 난간 · 띠돌림 · 처마 띠. 가로 16 주기.
    L = dot.legend('desert-oasis',
                   a=('sandstone', 0), b=('sandstone', 1), c=('sandstone', 2), d=('sandstone', 3),
                   e=('sandstone', 4), f=('sandstone', 5), g=('sandstone', 6),
                   h=('adobe', 5), i=('adobe', 6))
    W = 48
    rows = []

    def band(ch):
        rows.append(ch * W)

    band('g'); band('f'); band('f'); band('d'); band('c')          # 0~4 뒤 테·테 그늘
    band('e'); band('e')                                            # 5~6 테 그늘 진 지붕 면
    speck = dict([((9, 3), 'e'), ((14, 11), 'e'), ((19, 6), 'i'), ((23, 13), 'e'), ((12, 1), 'i'),
                  ((16, 8), 'e'), ((21, 2), 'e'), ((10, 9), 'i'), ((25, 4), 'e'), ((18, 14), 'i')])
    for y in range(7, 26):                                          # 7~25 흙 다짐 지붕 면
        rows.append(''.join(speck.get((y, x % 16), 'h' if y in (7, 8) else 'f') for x in range(W)))
    for y in range(26, 30):                                         # 26~29 총안(높은 칸 5·틈 3)
        r = ''
        for x in range(W):
            p = (x + 2) % 8
            if p < 5:
                r += 'g' if y == 26 else ('f' if p == 0 else ('d' if p == 4 else 'e'))
            else:
                r += 'c' if y < 29 else 'd'
        rows.append(r)
    band('g'); band('f')                                            # 30~31 난간 윗면
    band('d')                                                       # 32 윗면 → 앞면 꺾임
    for y in range(33, 40):                                         # 33~39 난간 앞면(매끈한 회반죽, 줄눈 드묾)
        rows.append(''.join('c' if (x % 16 == 5 and 34 <= y < 38) else ('e' if y == 33 else 'd') for x in range(W)))
    band('f'); band('e'); band('c')                                 # 40~42 띠돌림
    band('c'); band('b'); band('b'); band('b'); band('a')           # 43~47 처마 그림자(불투명)
    out = []
    for y, r in enumerate(rows):
        r = list(r)
        if 5 <= y < 26:                                             # 옆 테(윗면에서 본 좌우 난간)
            r[0:5] = list('cfedd')
            r[43:48] = list('effdb')
        else:
            r[0] = 'c'; r[1] = 'f' if y < 43 else 'c'
            r[46] = 'd' if y < 43 else 'a'; r[47] = 'b' if y < 43 else 'a'
        out.append(''.join(r))
    return dot.grid(out, L), {}
# <<< cand_roof_flat_B

# >>> cand_roof_flat_C
def _ww_legend_C():
    # 흰 회칠 줄: 회칠 4단 + 돌 그늘, 다진 흙 지붕(사암), 주황 차양, 청록 문, 나무 들보 끝
    return dot.legend('desert-oasis', P=('whitewash', 3), Q=('whitewash', 2), R=('whitewash', 1),
                      S=('whitewash', 0), T=('stone', 3), U=('stone', 2), X=('stone', 5), Y=('stone', 4),
                      a=('sandstone', 3), b=('sandstone', 4), c=('sandstone', 5), e=('sandstone', 6),
                      f=('awning', 4), g=('awning', 3), h=('awning', 1),
                      n=('dome', 1), o=('dome', 2), p=('dome', 3), q=('dome', 4),
                      w=('wood', 2), x=('wood', 3), y=('wood', 5))


def cand_roof_flat_C():
    # 3×3칸 = 48×48. 위 칸: 뒤 난간 갓·안쪽 면, 가운데 칸: 다진 흙 지붕 면, 아래 칸: 둥근 총안·앞 난간·들보 끝·처마.
    m = [
        'RRRRRRRRRRRRRRRR',  # 0 뒤 난간 먼 모서리
        'QQQQQQQQQQQQQQQQ',
        'PPPPPPPPPPPPPPPP',  # 2 뒤 난간 갓(빛)
        'PPPPPPPPPPPPPPPP',
        'QQQQQQQQQQQQQQQQ',  # 4 뒤 난간 안쪽 면(남향)
        'QQQQQQRQQQQQQQQQ',
        'QQQQQQQQQQQQQRQQ',
        'RRRRRRRRRRRRRRRR',  # 7 난간 발치
        'aaaaaaaaaaaaaaaa',  # 8 난간이 지붕 면에 드리운 그늘
        'bbbbbbbbbbbbbbbb',
        'cccccccccccccccc',  # 10 다진 흙 지붕 면
        'cccbcccccccccccc',
        'cccccccccccecccc',
        'cccccccccccccccc',
        'bbcccbbbccccbbbc',  # 14 흙손 결
        'cccccccccccccccc',
        'ccccccecccccccbc',
        'cccccccccccccccc',
        'cbcccccccccccccc',
        'cccccccccccccccc',
        'ccccbbbcccccbbbc',  # 20 흙손 결
        'cccccccccccccccc',
        'ccccccccccbccccc',
        'ccecccccccccccce',
        'cccccccccccccccc',
        'cccccbcccccccccc',
        'cccccccccccccccc',
        'bbbcccccbbbcccbb',  # 27 흙손 결
        'cccccccccccccccc',
        'ccccccccceccccbc',
        'cccccccccccccccc',
        'bccccccbcccccccc',
        'bbbbbbbbbbbbbbbb',  # 32 앞 난간 쪽 그늘
        'bbbQPPQbbbbQPPQb',  # 33 둥근 총안 머리
        'bbQPPPPQbbQPPPPQ',
        'abQPPPPQRaQPPPPQ',
        'PPPPPPPPPPPPPPPP',  # 36 앞 난간 갓(빛)
        'PPPPPPPPPPPPPPPP',
        'QQQQQQQQQQQQQQQQ',  # 38 난간 바깥 면
        'QQQQQQQQQRQQQQQQ',
        'QQRQQQQQQQQQQQQQ',
        'QQQQQQQQQQQQQQRQ',
        'QQQyxQQQQQQyxQQQ',  # 42 들보 끝(나무)
        'QQQxwQQQQQQxwQQQ',
        'RRRRwRRRRRRRwRRR',  # 44 들보 그늘
        'RRRRRRRRRRRRRRRR',
        'SSSSSSSSSSSSSSSS',  # 46 처마 아랫단
        'TTTTTTTTTTTTTTTT',
    ]

    def edge_l(y, row):
        r = list(row)
        if y <= 7:
            r[0] = 'S'
            r[1:3] = ('PP' if 2 <= y <= 3 else row[1:3])
        elif y <= 35:
            r[0:5] = 'SPPQ' + ('a' if y >= 8 else row[4])  # 서쪽 난간 갓, 동쪽으로 그늘
        elif y <= 45:
            r[0] = 'S'
        else:
            r[0] = 'T' if y == 46 else 'U'
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        if y <= 7:
            r[15] = 'T'
        elif y <= 35:
            r[11:16] = 'cQPPT' if y < 33 else row[11] + 'QPPT'  # 동쪽 난간 안쪽 면(서향 빛)·갓
        elif y <= 45:
            r[15] = 'T'
            r[14] = 'S' if y >= 38 else r[14]
        else:
            r[14:16] = 'TU'
        return ''.join(r)

    rows = [edge_l(y, m[y]) + m[y] + edge_r(y, m[y]) for y in range(48)]
    return dot.grid(rows, _ww_legend_C()), {}
# <<< cand_roof_flat_C

# >>> cand_wall_storey_A
def cand_wall_storey_A():
    # 5×2칸 = 80×32. 흙벽돌 회반죽 벽, 맨 위 2행 처마 그늘, 아치 창·아치 문. l·r 바깥 2px 투명.
    m = [
        'CCCCCCCCCCCCCCCC',  # 0 처마 그늘
        'CCCCCCCCCCCCCCCC',
        'DDDDDDDDDDDDDDDD',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEDEEEEEEEEE',
        'EEEEEEEEEEEEEFEE',
        'EFEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEDEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEDEEEEEEEEEEEE',
        'EEEEEEEEEEEEFEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEFEEEEEEEEE',
        'EEEEEEEEEEEEEEED',
        'EEEEEEEEEEEEEEEE',
        'EDEEEEEEEEEEEEEE',
        'EEEEEEEEEDEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEFEEEEEEEEEEE',
        'EEEEEEEEEEEEDEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEDEEEEEEEEEEEEE',
        'EEEEEEEEEEFEEEEE',
        'EEEEEEEEEEEEEEEE',
        'EEEEEEEEEEEEEEEE',
        'DEEEEEEDEEEEEEDE',  # 28 발치 쪽 흙 튐
        'DDDDDDDDDDDDDDDD',
        'DDDDDDDDDDDDDDDD',
        'DDCDDDDDDCDDDDDD',
    ]
    # 아치 창: x4..11, y7..21
    win = {
        7:  '....CCCC....',
        8:  '...CAAAAC...',
        9:  '..CAAAAAAC..',
        10: '..CAAAAAAD..',
        11: '..CAAAAAAD..',
        12: '..CAAAAAAD..',
        13: '..CAAAAAAD..',
        14: '..CvwvvwvD..',
        15: '..CvwvvwvD..',
        16: '..CvwvvwvD..',
        17: '.GFFFFFFFFD.',
        18: '..DCCCCCCD..',
    }
    # 아치 문: x2..13, y4..31 (32px 키)
    door = {
        4:  '....hhhh....',
        5:  '..hhiiiihh..',
        6:  '.hikkkkkkih.',
        7:  '.hkjvvvvjih.',
        8:  'hkjvwwwwvjih',
        9:  'hkjvwxxwvjih',
    }
    for y in range(10, 30):
        door[y] = 'hkjvxwvxwvih' if y % 7 else 'hkjvvvvvvvih'
    door[18] = 'hkjvxwvxyvih'  # 손잡이
    door[30] = 'hkiBBBBBBBih'
    door[31] = 'hiiBBBBBBBhh'

    def put(row, x0, pat):
        r = list(row)
        for i, ch in enumerate(pat):
            if ch != '.':
                r[x0 + i] = ch
        return ''.join(r)

    def edge_l(y, row):
        r = list(row)
        r[0:2] = '..'
        if y >= 2:
            r[2:4] = 'DG' if y < 28 else 'CF'
            if y >= 30:
                r[2:4] = 'CD'
        else:
            r[2] = 'B'
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        r[14:16] = '..'
        if y >= 2:
            r[12:14] = 'DC' if y < 30 else 'CB'
        else:
            r[13] = 'A'
        return ''.join(r)

    rows = []
    for y in range(32):
        row = m[y]
        w = put(row, 2, win[y]) if y in win else row
        d = put(row, 2, door[y]) if y in door else row
        rows.append(edge_l(y, row) + row + w + d + edge_r(y, row))
    return dot.grid(rows, _adobe_legend_A()), {}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
def cand_wall_storey_B():
    # 다듬은 사암 한 층 — 처마 그늘 2행 · 5행 줄 쌓기(세로 줄눈 8 주기 엇갈림) · 아치 창 · 붉은 테 아치 문.
    L = dot.legend('desert-oasis',
                   a=('sandstone', 0), b=('sandstone', 1), c=('sandstone', 2), d=('sandstone', 3),
                   e=('sandstone', 4), f=('sandstone', 5), g=('sandstone', 6),
                   n=('dome', 0), o=('dome', 1), v=('wood', 2), w=('wood', 3), x=('wood', 1),
                   y=('wood', 4), q=('iron', 1), r=('awning', 1), s=('awning', 4))

    def stone(x, y):
        if y == 0:
            return 'b'
        if y == 1:
            return 'c'
        if y == 2 or y == 31:
            return 'd' if y == 2 else 'c'
        course, k = divmod(y - 3, 5)
        if k == 4:
            return 'd'
        if (x + (course % 2) * 4) % 8 == 1:
            return 'd'
        return 'f' if k == 0 else 'e'

    rows = [[stone(x, y) for x in range(80)] for y in range(32)]
    win = {
        7: '...gggg...', 8: '..gnnnnc..', 9: '.gnnoonnc.', 10: '.gnonnnnc.',
        16: '.gvvvvvvc.', 21: '.gvvvvvvc.', 22: 'gggggggggd', 23: '.bbbbbbbb.',
    }
    for y in range(7, 24):
        t = win.get(y, '.gnnvvnnc.')
        for i, ch in enumerate(t):
            if ch != '.':
                rows[y][32 + 3 + i] = ch
    door = {3: '....ssssrr....', 4: '..sssxxxxxrr..', 5: '.ssxxyyyyyxxr.', 6: '.sxyyywwwwwxr.',
            31: '.dddddddddddd.'}
    for y in range(3, 32):                                 # 문: 폭 12(Actor1 24px 의 절반 칸 이상), 높이 29
        t = door.get(y, '.sxywwwxywwxr.')
        if y in (12, 23):
            t = '.sxywqwxywqxr.'
        for i, ch in enumerate(t):
            if ch != '.':
                rows[y][48 + 1 + i] = ch
    for y in range(32):                                    # 끝: 바깥 2px 투명(inset 2), 모서리 돌
        rows[y][0] = rows[y][1] = '.'
        rows[y][78] = rows[y][79] = '.'
        if y >= 2:
            rows[y][2] = 'g' if y < 31 else 'd'
            rows[y][3] = 'f' if y < 31 else 'd'
            rows[y][76] = 'c'
            rows[y][77] = 'b'
    return dot.grid([''.join(r) for r in rows], L), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C():
    # 5×2칸 = 80×32. 흰 회칠 벽, 맨 위 2행 처마 그늘, 주황 줄무늬 차양 아치 창, 청록 칠 아치 문. l·r 바깥 2px 투명.
    m = [
        'SSSSSSSSSSSSSSSS',  # 0 처마 그늘
        'SSSSSSSSSSSSSSSS',
        'RRRRRRRRRRRRRRRR',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQQQQQQPPQQ',
        'QQQQRRQQQQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QPPQQQQQQQRRQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQPPQQQQQQRR',
        'QQRRQQQQQQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQQQPPQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQRRQQQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QPPQQQQQQQQQRRQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQQPPQQQQQQ',
        'QQQRRQQQQQQQQQQQ',
        'QQQQQQQQQQQQQQPP',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQRRQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QPPQQQQQQQQRRQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQQQQQQQQQQQQQQQ',
        'QQRRQQQQQRRQQQQQ',  # 28 발치
        'RRRRRRRRRRRRRRRR',
        'RbRRRRbRRRRRRbRR',  # 30 모래 튐
        'SSSSSSSSSSSSSSSS',
    ]
    # 주황 줄무늬 차양 + 아치 창: x2..13, y3..19
    win = {
        3:  'hhhhhhhhhhhh',
        4:  'fPPffPPffPPf',
        5:  'fPPffPPffPPf',
        6:  'gQQggQQggQQg',
        7:  'g..gg..gg..g',
        8:  '.RRRRRRRRRR.',
        9:  '....SSSS....',
        10: '...SnnnnP...',
        11: '..SnnnnnnP..',
        12: '..SnonnonP..',
        13: '..SnonnonP..',
        14: '..SnonnonP..',
        15: '..SnonnonP..',
        16: '..SnonnonP..',
        17: '..SnnnnnnP..',
        18: '.PPPPPPPPPR.',
        19: '..RRRRRRRR..',
    }
    # 청록 칠 아치 문: x2..13, y2..31 (32px 키)
    door = {
        2:  '....TTTT....',
        3:  '..TTnnnnTT..',
        4:  '.TSnoppponT.',
        5:  '.TSoppnopPT.',
    }
    for y in range(6, 30):
        door[y] = 'TSoqpnoqpnPT' if y in (8, 14, 20, 26) else 'TSoppnoppnPT'
    door[17] = 'TSoppnyppnPT'  # 손잡이
    door[30] = 'TScccccccePT'
    door[31] = 'TSbbbbbbbbST'

    def put(row, x0, pat):
        r = list(row)
        for i, ch in enumerate(pat):
            if ch != '.':
                r[x0 + i] = ch
        return ''.join(r)

    def edge_l(y, row):
        r = list(row)
        r[0:2] = '..'
        r[2:4] = ('SS' if y < 2 else 'RP' if y < 29 else 'SR')
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        r[14:16] = '..'
        r[12:14] = ('ST' if y < 2 else 'RS' if y < 29 else 'ST')
        return ''.join(r)

    rows = []
    for y in range(32):
        row = m[y]
        w = put(row, 2, win[y]) if y in win else row
        d = put(row, 2, door[y]) if y in door else row
        rows.append(edge_l(y, row) + row + w + d + edge_r(y, row))
    return dot.grid(rows, _ww_legend_C()), {}
# <<< cand_wall_storey_C

# >>> cand_base_stone_A
def cand_base_stone_A():
    # 3×1칸 = 48×16. 사암 낮은 기단(엇갈린 돌 8px), 아래는 모래 위 그림자.
    m = [
        'iiiiiiiiiiiiiiii',  # 0 벽 밑 그늘
        'kkkkkkkkkkkkkkkk',  # 1 기단 윗면(빛)
        'jjjjjjjjjjjjjjjj',
        'hjjjjjjihjjjjjji',
        'hjiiiiiihjiiiiii',
        'hiiiiiiihiiiiiii',
        'hiiiiiiihiiiiiii',
        'hhhhhhhhhhhhhhhh',  # 7 줄눈
        'jjjihjjjjjjjihjj',
        'jiiihjiiiiiiihji',
        'iiiihiiiiiiiihii',
        'iiiihiiiiiiiihii',
        'iiiihiiiiiiiihii',
        'hhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhh',  # 14 모래에 묻힌 밑단
        'hhhhhhhhhhhhhhhh',
    ]

    def edge_l(y, row):
        r = list(row)
        r[0] = 'h'
        if 1 <= y < 13:
            r[1] = 'k' if y < 7 else 'j'
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        r[15] = 'h'
        return ''.join(r)

    rows = [edge_l(y, m[y]) + m[y] + edge_r(y, m[y]) for y in range(16)]
    return dot.grid(rows, _adobe_legend_A()), {}
# <<< cand_base_stone_A

# >>> cand_base_stone_B
def cand_base_stone_B():
    # 모래 위 낮은 사암 기단 — 윗면 3행 · 앞면 돌 5행(8 주기 줄눈) · 발치 그림자.
    L = dot.legend('desert-oasis', a=('sandstone', 0), b=('sandstone', 1), c=('sandstone', 2),
                   d=('sandstone', 3), e=('sandstone', 4), f=('sandstone', 5))
    W = 48
    rows = ['c' * W, 'f' * W, 'e' * W, 'd' * W]                     # 0 벽 발치 그늘 · 1~2 턱 윗면 · 3 꺾임
    for y in range(4, 14):                                         # 4~13 앞면 큰 돌 두 단(엇갈린 줄눈)
        if y == 8:
            rows.append('b' * W)
            continue
        off = 0 if y < 8 else 4
        rows.append(''.join('b' if (x + off) % 8 == 1 else ('e' if y in (4, 9) else 'd') for x in range(W)))
    rows += ['b' * W, 'a' * W]                                     # 14~15 모래에 닿는 그늘 단
    for y in range(1, 16):
        rows[y] = ('f' if y < 14 else 'b') + rows[y][1:47] + ('b' if y < 14 else 'a')
    return dot.grid(rows, L), {}
# <<< cand_base_stone_B

# >>> cand_base_stone_C
def cand_base_stone_C():
    # 3×1칸 = 48×16. 회색 돌 낮은 기단(엇갈린 돌 8px), 위는 벽 밑 그늘, 아래는 모래에 묻힌 밑단.
    m = [
        'TTTTTTTTTTTTTTTT',  # 0 벽 밑 그늘
        'XXXXXXXXXXXXXXXX',  # 1 기단 윗면(빛)
        'XXXXXXXXXXXXXXXX',
        'YYYYYYYYYYYYYYYY',
        'TYYYYYYYTXYYYYYY',  # 4 앞면 돌
        'TYYYYYYYTYYYYYYY',
        'TYYYYYYYTYYYYYYY',
        'TTTTTTTTTTTTTTTT',  # 7 줄눈
        'YYYTXYYYYYYYTXYY',
        'YYYTYYYYYYYYTYYY',
        'YYYTYYYYYYYYTYYY',
        'YYYTYYYYYYYYTYYY',
        'TTTTTTTTTTTTTTTT',
        'aaaaaaaaaaaaaaaa',  # 13 모래에 묻힌 밑단
        'bababbbabbbbabbb',
        'bbbbbbbbbbbbbbbb',
    ]

    def edge_l(y, row):
        r = list(row)
        r[0] = 'T' if 1 <= y <= 12 else row[0]
        if 1 <= y <= 11:
            r[1] = 'X'
        return ''.join(r)

    def edge_r(y, row):
        r = list(row)
        if 1 <= y <= 12:
            r[15] = 'U'
        return ''.join(r)

    rows = [edge_l(y, m[y]) + m[y] + edge_r(y, m[y]) for y in range(16)]
    return dot.grid(rows, _ww_legend_C()), {}
# <<< cand_base_stone_C


CANDIDATES = {
    'roof.flat': {'A': cand_roof_flat_A, 'B': cand_roof_flat_B, 'C': cand_roof_flat_C},
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'base.stone': {'A': cand_base_stone_A, 'B': cand_base_stone_B, 'C': cand_base_stone_C},
}

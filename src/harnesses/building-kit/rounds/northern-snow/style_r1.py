"""building-kit northern-snow style-r1 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

설원 북방 마을 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r1'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_steep_A
# 눈 사면 줄무늬(16 주기, 고른 좌표) — 위는 밝은 눈, 아래로 갈수록 그늘 결.
_RS_SLOPE = [
    'bbbbbbbbbbbbbbbb',  # 4 용마루 밑 그늘 띠
    'ssssssssssssssss',
    'sSssssssssSSssss',
    'ssssssssssssssss',
    'sssssSSsssssssss',  # 8
    'ssssssssssssssnn',
    'nnssssssssssssss',
    'sssssssnnsssssss',
    'ssssssssssssssss',  # 12
    'snnnnsssssssnnns',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnssssnnnnn',
    'nnnnnnnnnnnnnnnn',  # 16
    'ssnnnnnnnnnnnbbn',
    'nnnnnnnnnnnnnnnn',
    'nnnnbbbnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',  # 20
    'nnnnnnnnnnbbbnnn',
    'bnnnnnnnnnnnnnnb',
    'nnnbbnnnnnnnbbbn',
    'bbnnnnnnbbnnnnnn',  # 24
    'cbnnnbbnnbbnnnbc',
    'ccnnbbbccbnnbccn',
]
# 눈 테두리가 너와 위로 늘어지는 깊이(열마다 마지막 눈 행).
_RS_DRIP = [31, 32, 33, 32, 30, 29, 29, 30, 33, 35, 34, 31, 29, 29, 30, 30]
_RS_JOINT = ([2, 7, 12], [4, 9, 14], [0, 5, 10], [3, 8, 13])  # 너와 줄마다 이음 열
_RS_ICE = {1: 47, 4: 44, 6: 46, 10: 47, 13: 45, 8: 43}  # 고드름 열 → 끝 행
_RS_DARK = {'n': 'c', 's': 'n', 'S': 's', 'b': 'c', 'c': 'd', 'o': 'g', 'h': 'f', 'g': 'f',
            'f': 'e', 'q': 'v', 'w': 'u', 'v': 'u', 'u': 't'}


def _rs_column(x, edge):
    """열 x(0..15, 16 주기) 의 48행. edge 면 끝 조각 바깥 열 — 재질 어두운 단."""
    col = []
    drip = _RS_DRIP[x]
    for y in range(48):
        if y == 0:
            ch = 'c'
        elif y in (1, 2):
            ch = 'S'
        elif y == 3:
            ch = 'c'
        elif y <= 26:
            ch = _RS_SLOPE[y - 4][x]
        elif y in (27, 28):
            ch = 'S' if y == 27 else 's'
        elif y <= drip:
            ch = 'd' if y == drip else ('c' if y == drip - 1 else 'n')
        elif y <= 41:
            k, r = (y - 28) // 4, (y - 28) % 4
            if r == 3 or y == drip + 1:
                ch = 'e'
            elif x in _RS_JOINT[k % 4]:
                ch = 'f'
            else:
                ch = 'o' if r == 0 else ('h' if r == 1 else 'g')
        else:
            ch = ('qwwt', 'wwvt', 'vvut')[y - 42][x % 4] if y <= 44 else ('f' if y == 47 else 'e')  # 널 끝
            end = _RS_ICE.get(x)
            if end is not None and y <= end:  # 고드름: 널 끝 위로 매달려 내려온다
                ch = 'S' if y == 42 else ('b' if y < end else 'c')
        col.append(ch)
    if edge:
        col = [_RS_DARK.get(c, c) for c in col]
    return col


def cand_roof_steep_A():
    leg = dot.legend('northern-snow',
                     S=('snow', 5), s=('snow', 4), n=('snow', 3), b=('snow', 2), c=('snow', 1), d=('snow', 0),
                     o=('shake', 5), h=('shake', 4), g=('shake', 3), f=('shake', 2), e=('shake', 1), x=('shake', 0),
                     q=('wood', 5), w=('wood', 4), v=('wood', 3), u=('wood', 2), t=('wood', 1))
    W = 48
    cols = [_rs_column(X % 16, X in (0, W - 1)) for X in range(W)]
    g = [[cols[X][y] for X in range(W)] for y in range(48)]
    # 모임지붕 끝 경사면: 바깥 위 귀퉁이를 사선(ec)으로 비우고, 사선~귀마루(hp) 사이를 l 밝게·r 어둡게.
    for y in range(29):
        ec = 14 - y if y < 14 else -1
        hp = 15 - y // 3
        for x in range(16):
            L, R = x, W - 1 - x
            if x < ec:
                g[y][L] = g[y][R] = '.'
            elif x == ec:
                g[y][L], g[y][R] = 'n', 'd'
            elif y < 27 and x < hp:
                g[y][L] = 'S' if (x + y) % 7 == 0 else 's'
                g[y][R] = 'b' if (x + y) % 7 == 0 else 'c'
            elif y < 27 and x == hp:
                g[y][L], g[y][R] = 'n', 'S'
        if 14 <= y < 27:
            g[y][0], g[y][W - 1] = 'n', 'd'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_steep_A

# >>> cand_roof_steep_B
def cand_roof_steep_B():
    # 줄 B — 가파른 눈 모임지붕: 용마루(밝은 선) · 눈 사면(가로 결) · 눈 처마 덩이 · 너와 단 · 널 끝+고드름.
    leg = dot.legend('northern-snow',
                     W=('snow', 5), w=('snow', 4), v=('snow', 3), u=('snow', 1), q=('snow', 0), i=('snow', 2),
                     K=('shake', 6), k=('shake', 5), h=('shake', 4), g=('shake', 3), f=('shake', 1), e=('shake', 2),
                     n=('wood', 6), o=('wood', 4), p=('wood', 2), b=('wood', 1))
    m = [
        "uuuuuuuuuuuuuuuu",  # 0 용마루 윗변
        "WWWWWWWWWWWWWWWW",  # 1 용마루 밝은 선
        "WWwWWWWWWwWWWWWW",
        "wwwwwwwwwwwwwwww",
        "uuvuuuuvuuuuvuuu",  # 4 용마루 아래 그늘
        "wwwwwwwwwwwwwwww",  # 5 위 사면 — 밝게
        "wwWWwwwwwwwwwwww",
        "wwwwwwwwwvwwwwww",
        "wwwwwwwwwwwWWwww",
        "vwwwwwvwwwwwwwwv",
        "wwwwwwwwwwwwwwww",
        "wwwWWwwwwwwwvvww",
        "wwwwwwwwwwwwwwww",
        "wvwwwwwvvwwwwwww",
        "vvvvvvvvvvvvvvvv",  # 14 아래 사면 — 한 단 어둡게
        "vvvvvvvwwvvvvvvv",
        "vvvvvvvvvvvvvvvv",
        "uvvvvvvvvvvvuvvu",
        "vvvvvvvvvvvvvvvv",
        "vvwwvvvvvvvvvvvv",
        "vvvvvvvvvuuvvvvv",
        "vvvvvvvvvvvvvvvv",
        "uvvvvuuvvvvvvvvu",
        "vvvvvvvvvvvvvvvv",
        "uuuvuuuuuuvuuuuu",  # 24 처마 덩이 윗선(꺾임)
        "wwwwwwwwwwwwwwww",  # 25 눈 처마 덩이 앞면
        "WWWWWWWWWWWWWWWW",
        "wwwwwwwwwwwwwwww",
        "vvvvvvvvvvvvvvvv",
        "uvvvvvvuvvvvvvvu",
        "quvvvvuqquvvvvuq",  # 30 덩이 아래 끝
        "kquvvuqkkquvvuqk",
        "hkquuqhkhkquuqkh",
        "ghkqqkghghkuqhgh",
        "ffffffffffqqffff",  # 너와 1단 밑
        "kKKgkKKgkKKgkKKg",
        "hkkghkkghkkghkkg",
        "ffffffffffffffff",
        "KgkKKgkKKgkKKgkK",
        "kghkkghkkghkkghk",
        "ffffffffffffffff",
        "bbbbbbbbbbbbbbbb",  # 41 처마널 위
        "bnobbnobbnobbnob",  # 42 널 끝
        "bobbbobbbobbbobb",
        "pipppppvippppipp",  # 44 고드름(길이 다르게)
        "pippppppippppipp",
        "puppppppippppppp",
        "pppppppppppppppp",
    ]
    # 모임지붕 끝: 줄마다 비우는 칸(바깥 위 귀퉁이)과 모임 마루선 칸 — 고른 좌표.
    cut = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    hip = [14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1]

    def end(row_m, y, edge, face, ridge):
        c = cut[y] if y < len(cut) else 0
        hl = hip[y] if y < len(hip) else -1
        out = []
        for x in range(16):
            if x < c:
                out.append('.')
            elif x == c and (y < len(cut) or y < len(hip)):
                out.append(edge)
            elif x < hl:
                out.append(face)
            elif x == hl:
                out.append(ridge)
            else:
                out.append(row_m[x])
        return ''.join(out)

    l = [end(m[y], y, 'u', 'W', 'v') for y in range(48)]
    rr = [end(m[y][::-1], y, 'q', 'u', 'v')[::-1] for y in range(48)]
    # 끝 처마널 단면(바깥 2px): 너와·널 줄 끝을 나무 끝판으로 닫는다.
    for y in range(31, 44):
        l[y] = ('o' if y < 41 else 'n') + 'p' + l[y][2:]
        rr[y] = rr[y][:14] + 'b' + 'p'
    rows = [l[y] + m[y] + rr[y] for y in range(48)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_steep_B

# >>> cand_roof_steep_C
# 줄 C 지붕 — 눈 이불 밑으로 돌 너와(슬레이트)가 드러나고, 눈 끝이 열마다 다른 깊이로 늘어진다(16 주기 고른 표).
_RC_DRIP = [29, 30, 31, 31, 30, 28, 27, 27, 28, 30, 32, 33, 33, 32, 30, 29]  # 열마다 눈 끝 행
_RC_JOINT = ({3, 11}, {7, 15}, {1, 9}, {5, 13})  # 슬레이트 단마다 이음 열(엇갈림)
_RC_ICE = {2: 47, 6: 45, 11: 47, 14: 46}  # 고드름 열 → 끝 행
_RC_STREAK = {5: (3, 7), 7: (10, 14), 9: (0, 2), 11: (6, 9), 13: (12, 15), 16: (2, 5),
              18: (9, 12), 20: (0, 3), 22: (6, 10), 24: (12, 15)}  # 사면 바람결(행 → 열 구간)


def _rc_column(x):
    col = []
    drip = _RC_DRIP[x]
    for y in range(48):
        if y == 0:
            ch = 'u'
        elif y in (1, 2):
            ch = 'W'
        elif y == 3:
            ch = 'i'
        elif y < drip - 1:
            up = y < 15
            ch = 'w' if up else 'v'
            a = _RC_STREAK.get(y)
            if a and a[0] <= x <= a[1]:
                ch = 'W' if up else 'i'
            if y == drip - 3:
                ch = 'W'  # 눈 끝 덩이 앞 밝은 볼
        elif y == drip - 1:
            ch = 'i'
        elif y == drip:
            ch = 'u'
        elif y == drip + 1:
            ch = 'Y'  # 눈 덩이 밑 그늘
        elif y <= 40:
            k, r = (y - 26) // 4, (y - 26) % 4
            if r == 3:
                ch = 'X'
            elif x in _RC_JOINT[k % 4]:
                ch = 'X' if r else 'U'
            else:
                ch = 'S' if r == 0 else ('T' if r == 1 else 'U')
        elif y == 41:
            ch = 'Y'
        elif y <= 43:
            ch = ('nopb', 'opbb')[y - 42][x % 4]  # 처마널 끝
        elif y == 44:
            ch = 'd'
        else:
            ch = 'b'
            end = _RC_ICE.get(x)
            if end is not None and y <= end:
                ch = 'i' if y < end else 'u'
            elif x in (4, 11) and y == 45:
                ch = 'u'
        col.append(ch)
    return col


def cand_roof_steep_C():
    leg = dot.legend('northern-snow',
                     W=('snow', 5), w=('snow', 4), v=('snow', 3), i=('snow', 2), u=('snow', 1), q=('snow', 0),
                     S=('stone', 4), T=('stone', 3), U=('stone', 2), X=('stone', 1), Y=('stone', 0),
                     n=('wood', 6), o=('wood', 4), p=('wood', 2), b=('wood', 1), d=('wood', 0))
    W = 48
    cols = [_rc_column(X % 16) for X in range(W)]
    g = [[cols[X][y] for X in range(W)] for y in range(48)]
    # 모임지붕 끝: 위 8줄은 바깥 귀퉁이를 사선으로 비우고(줄마다 2px), 귀마루는 반 기울기로 내려온다.
    # 귀마루 바깥 경사면 = 왼쪽 밝게, 오른쪽 그늘(드러난 슬레이트도 같이).
    lit = {'w': 'W', 'v': 'w', 'i': 'v', 'T': 'S', 'U': 'T', 'X': 'U'}
    shade = {'W': 'v', 'w': 'i', 'v': 'u', 'i': 'u', 'S': 'T', 'T': 'U', 'U': 'X', 'X': 'Y'}
    for y in range(41):
        ec = 14 - 2 * y if y < 8 else -1
        hp = 15 - y // 2
        for x in range(16):
            L, R = x, W - 1 - x
            if x < ec:
                g[y][L] = g[y][R] = '.'
            elif x == ec:
                g[y][L], g[y][R] = 'v', 'q'
            elif x < hp:
                g[y][L] = lit.get(g[y][L], g[y][L])
                g[y][R] = shade.get(g[y][R], g[y][R])
            elif x == hp and y < 30:
                g[y][L], g[y][R] = 'W', 'u'
    # 끝 처마널 단면(바깥 2px): 슬레이트·널 끝을 나무 끝판으로 닫는다.
    for y in range(30, 45):
        g[y][0], g[y][1] = ('n' if y < 42 else 'o'), 'p'
        g[y][W - 2], g[y][W - 1] = 'b', 'd'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_steep_C

# >>> cand_wall_log_A
_WL_LOG = 'eddca'  # 통나무 한 단(5행): 빛 받는 윗등 → 그늘 아랫배 → 틈
_WL_GRAIN = ({3, 4, 11, 12, 13}, {6, 7, 8, 14})  # 단마다 나뭇결 열(16 주기)
_WL_END_L = ['.gig.', 'gijig', 'gijig', '.ggg.', '.....']  # 왼끝 마구리(빛 쪽)
_WL_END_R = ['.huh.', 'hwvwh', 'hwvwh', '.hhh.', '.....']  # 오른끝 마구리(그늘 쪽)
_WL_WIN = [
    'wwwwwwwwwwww',  # 7 인방
    'wllllvvllllu',
    'wmmklvvlkkku',
    'wmkklvvlmkku',
    'wkkklvvlkkku',
    'wkkklvvlkkku',
    'wkkklvvlkkku',
    'wvvvvvvvvvvu',  # 14 가로살
    'wmkklvvlmkku',
    'wkkklvvlkkku',
    'wkkklvvlkkku',
    'wkkklvvlkkku',
    'wkkklvvlkkku',
]
_WL_DOOR_PLANK = 'wvvu'


def cand_wall_log_A():
    leg = dot.legend('northern-snow',
                     a=('log', 0), b=('log', 1), c=('log', 2), d=('log', 3), e=('log', 4),
                     g=('wood', 4), i=('wood', 6), j=('wood', 5), h=('wood', 2), z=('wood', 3),
                     w=('wood', 4), v=('wood', 3), u=('wood', 2), t=('wood', 1), y=('wood', 0),
                     k=('iron', 0), l=('iron', 1), m=('iron', 3), n=('snow', 3), s=('snow', 5), r=('iron', 2))
    W, H = 80, 32
    g = [[' '] * W for _ in range(H)]
    for y in range(H):
        for X in range(W):
            x = X % 16
            if y == 0:
                ch = 'a'
            elif y == 1:
                ch = 'b'
            else:
                k, r = (y - 2) // 5, (y - 2) % 5
                ch = _WL_LOG[r]
                if r == 2 and x in _WL_GRAIN[k % 2]:
                    ch = 'c'
            g[y][X] = ch
    # 끝 조각: 바깥 2px 투명(inset 2), 그다음 5px 마구리 단면이 단마다 쌓인다.
    for y in range(H):
        for x in (0, 1):
            g[y][x] = g[y][W - 1 - x] = '.'
        for i in range(5):
            if y < 2:
                g[y][2 + i] = g[y][W - 7 + i] = 'a' if y == 0 else 'b'
                continue
            r = (y - 2) % 5
            el, er = _WL_END_L[r][i], _WL_END_R[r][i]
            g[y][2 + i] = el if el != '.' else ('a' if r == 4 else 'c')
            g[y][W - 7 + i] = er if er != '.' else ('a' if r == 4 else 'b')
    # 창(w 조각, x 32..47): 인방·두 칸 유리·가로살, 눈 얹은 창턱.
    for i, row in enumerate(_WL_WIN):
        for j, ch in enumerate(row):
            g[7 + i][34 + j] = ch
    for j in range(33, 47):
        g[20][j], g[21][j] = 'n' if j in (33, 46) else 's', 'w'
    for j in range(34, 46):
        g[22][j] = 'u'
    # 문(d 조각, x 48..63): 32px 판문, 쇠띠 두 줄, 손잡이.
    for y in range(1, H):
        g[y][49], g[y][62] = 'w', 't'
        for X in range(50, 62):
            ch = _WL_DOOR_PLANK[(X - 50) % 4] if y > 1 else 'y'
            if y in (7, 25):
                ch = 'r' if X % 4 else 'm'
            g[y][X] = ch
    g[1][49] = g[1][62] = 'y'
    g[16][59], g[17][59] = 'm', 'l'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_log_A

# >>> cand_wall_log_B
def cand_wall_log_B():
    # 줄 B — 통나무 단 사이에 회벽 메움(반목조 회벽 결), 모서리 기둥과 통나무 마구리. 맨 위 2행 처마 그늘.
    leg = dot.legend('northern-snow',
                     B=('log', 1), M=('log', 2), L=('log', 3), H=('log', 4),
                     z=('hplaster', 0), Z=('hplaster', 3),
                     n=('wood', 6), y=('wood', 5), o=('wood', 4), p=('wood', 2), b=('wood', 1),
                     G=('iron', 2), I=('iron', 1), J=('iron', 3), q=('snow', 0), u=('snow', 1), w=('snow', 4))
    # 통나무 한 단 = 6행: 회벽 메움 · 밝은 윗결 · 몸 · 결 · 그늘 · 밑
    log = [
        "zZzzzzzZzzzzzzzz",
        "HHHHLHHHHHHHHHLH",
        "LLLLLLLLMLLLLLLL",
        "LLMMLLLLLLLLLMML",
        "MMMMMMMMMMMMMMMM",
        "BBMBBBBBBBMBBBBB",
    ]
    eave = ["BBBBBBBBBBBBBBBB", "MBMMMBMMMMBMMMBM"]
    m = eave + log * 5
    # 끝 마구리(통나무 단면) 4px — 단마다 하나
    cap = ["zzzz", "pnyp", "nyyo", "nyoo", "yoop", "BppB"]
    capd = ["zzzz", "pyop", "yoop", "yopp", "oppB", "BBpB"]
    l = []
    r = []
    for y in range(32):
        row = m[y]
        if y < 2:
            l.append(".." + row[2:])
            r.append(row[:14] + "..")
            continue
        k = (y - 2) % 6
        l.append(".." + cap[k] + "b" + row[7:])
        r.append(row[:9] + "b" + capd[k][::-1] + "..")
    # 창: 나무 틀 + 유리(쇠 어두운 단) + 눈 쌓인 창턱
    win = {
        6:  "pppppppppp",
        7:  "poooooooop",
        8:  "poGGqoGGqp",
        9:  "poGqGoGqGp",
        10: "poGGGoGGGp",
        11: "poooooooop",
        12: "poGGGoGGGp",
        13: "poIGGoIGGp",
        14: "poooooooop",
        15: "wwwwwwwwww",
        16: "uuuuuuuuuu",
        17: "bppppppppb",
    }
    wv = [row if y not in win else row[:3] + win[y] + row[13:] for y, row in enumerate(m)]
    # 문: 32px — 위 2행 상인방, 30행 널문
    door = []
    for y in range(32):
        row = m[y]
        if y < 2:
            mid = "bbbbbbbbbbbb" if y == 0 else "bppppppppppb"
        elif y in (8, 24):
            mid = "bIIIIIIIIIIb"
        elif y == 17:
            mid = "bonyponyponb"[:9] + "J" + "ob"
        else:
            mid = "bonyponyponb" if y > 3 else "bpopppoppppb"
        door.append(row[:2] + mid + row[14:])
    rows = [l[y] + m[y] + wv[y] + door[y] + r[y] for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_log_B

# >>> cand_wall_log_C
# 줄 C 벽 — 5px 통나무 여섯 단(윗등 밝음·결·그늘·틈), 끝은 단마다 작은 나이테 마구리.
# 창은 돌 인방·돌 창턱(눈 얹음) 안의 나무 십자 창, 문은 돌 상인방·문설주에 쇠띠 널문. 맨 위 2행 처마 그늘.
_WC_LOG = 'HLLMB'  # 한 단(5행)
_WC_GRAIN = ({2, 3, 4, 10, 11}, {6, 7, 13, 14, 15}, {0, 1, 8, 9}, {4, 5, 12, 13})  # 단마다 결 열(16 주기)
_WC_CAP_L = ['BnyoB', 'nyrpo', 'yrnro', 'Bopp.', 'BBBB.']  # 왼끝 마구리(빛 쪽)
_WC_CAP_R = ['BopbB', 'oprbp', 'prbpp', '.ppbB', '.BBBB']  # 오른끝 마구리(그늘 쪽)
_WC_WIN = [
    'SSSSSSSSSSSU',  # 5 돌 인방
    'TUUUUUUUUUUX',
    'ToooooooopUX',  # 7 창틀
    'ToqkkoqkkpUX',
    'TokkGokkGpUX',
    'TooooooooopX',
    'TokkGokkGpUX',
    'ToGGGoGGGpUX',
    'TppppppppbUX',
    'wwwwwwwwwwww',  # 14 창턱 눈
    'SSSSSSSSSSST',  # 15 돌 창턱
    'UUUUUUUUUUUX',
    '.BBBBBBBBBB.',  # 17 창턱 밑 그늘
]


def cand_wall_log_C():
    leg = dot.legend('northern-snow',
                     A=('log', 0), B=('log', 1), M=('log', 2), L=('log', 3), H=('log', 4),
                     S=('stone', 4), T=('stone', 3), U=('stone', 2), X=('stone', 1),
                     n=('wood', 6), y=('wood', 5), o=('wood', 4), r=('wood', 3), p=('wood', 2), b=('wood', 1),
                     k=('iron', 0), G=('iron', 1), J=('iron', 3), I=('iron', 2), q=('snow', 0), w=('snow', 4))
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for X in range(W):
            x = X % 16
            if y < 2:
                ch = 'A' if y == 0 else ('A' if x % 5 == 0 else 'B')
            else:
                k, r = (y - 2) // 5, (y - 2) % 5
                ch = _WC_LOG[r]
                if r == 2 and x in _WC_GRAIN[k % 4]:
                    ch = 'M'
            g[y][X] = ch
    # 끝 조각: 바깥 2px 투명(inset 2), 다음 5px 는 단마다 마구리 단면.
    for y in range(H):
        for x in (0, 1):
            g[y][x] = g[y][W - 1 - x] = '.'
        if y < 2:
            continue
        r = (y - 2) % 5
        for i in range(5):
            el, er = _WC_CAP_L[r][i], _WC_CAP_R[r][i]
            if el != '.':
                g[y][2 + i] = el
            if er != '.':
                g[y][W - 7 + i] = er
    # 창(w 조각, x 32..47)
    for i, row in enumerate(_WC_WIN):
        for j, ch in enumerate(row):
            if ch != '.':
                g[5 + i][34 + j] = ch
    # 문(d 조각, x 48..63): 돌 문설주 2px · 돌 상인방 · 12px 널문(세로 널 · 쇠띠 둘 · 손잡이)
    for y in range(2, H):
        g[y][49], g[y][50] = 'S', 'T'
        g[y][61], g[y][62] = 'U', 'X'
        for X in range(51, 61):
            if y in (2, 3):
                ch = 'S' if y == 2 else 'U'
            elif y == 4:
                ch = 'b'
            elif y in (9, 25):
                ch = 'J' if X in (52, 59) else 'I'
            else:
                ch = 'yorb'[(X - 51) % 4] if X < 60 else 'b'
            g[y][X] = ch
    for X in (49, 50, 61, 62):
        g[2][X] = 'S' if X < 61 else 'U'
        g[3][X] = 'U' if X < 61 else 'X'
    g[17][58], g[18][58] = 'J', 'G'
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_log_C

# >>> cand_base_stone_A
_BS_DRIFT = [9, 8, 8, 7, 7, 8, 9, 10, 10, 9, 8, 8, 9, 10, 10, 9]  # 기단에 쌓인 눈 윗선(16 주기)
_BS_JOINT = ({5, 13}, {1, 9})


def cand_base_stone_A():
    leg = dot.legend('northern-snow',
                     a=('stone', 1), b=('stone', 2), c=('stone', 3), d=('stone', 4), e=('stone', 5),
                     S=('snow', 5), s=('snow', 4), n=('snow', 3), m=('snow', 1), o=('snow', 0))
    W = 48
    g = [['.'] * W for _ in range(16)]
    for X in range(W):
        x = X % 16
        top = _BS_DRIFT[x]
        for y in range(16):
            if y == 0:
                ch = 'b'
            elif y == 1:
                ch = 'e'
            elif y <= 9:
                k, r = (y - 2) // 4, (y - 2) % 4
                ch = 'a' if (r == 3 or x in _BS_JOINT[k]) else ('d' if r == 0 else ('c' if r == 1 else 'b'))
            else:
                ch = 'a'
            if y >= top:
                ch = 'S' if y == top else ('s' if y == top + 1 else ('n' if y < 13 else ('m' if y < 15 else 'o')))
            g[y][X] = ch
    for y in range(16):
        g[y][0] = {'e': 'd', 'd': 'c', 'c': 'b', 'b': 'a', 'S': 'n', 's': 'n'}.get(g[y][0], g[y][0])
        g[y][W - 1] = {'e': 'c', 'd': 'b', 'c': 'a', 'b': 'a', 'S': 'm', 's': 'm', 'n': 'm'}.get(g[y][W - 1], g[y][W - 1])
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_base_stone_A

# >>> cand_base_stone_B
def cand_base_stone_B():
    # 줄 B — 눈 위 돌 기단: 윗돌 면 · 두 줄 돌 · 발치 눈 덩이.
    leg = dot.legend('northern-snow',
                     S=('stone', 5), T=('stone', 4), U=('stone', 3), V=('stone', 2), X=('stone', 1),
                     W=('snow', 5), w=('snow', 4), v=('snow', 3), u=('snow', 1), q=('snow', 0))
    m = [
        "VVVVVVVVVVVVVVVV",  # 벽 밑 그늘
        "UUUUUTUUUUUUUTUU",
        "TTTTTTTTTTTTTTTT",  # 윗돌 면
        "VVVVVVVVVVVVVVVV",
        "TTTTTTTXTTTTTTTT",
        "UUTUUUUXUUUTUUUU",
        "UUUUUUUXUUUUUUUU",
        "VVVVVVVXVVVVVVVV",
        "XXXXXXXXXXXXXXXX",
        "TTTXTTTTTTTXTTTT",
        "UUUXUUTUUUUXUUUU",
        "VVVXVVVVVVVXVVVV",
        "vvvqVVVvvvvvqVVv",  # 발치 눈 덩이
        "wwwvuqvwwWWwvuqv",
        "WwWWwvvwWWwwvwWW",
        "vvvvvuuvvvvuuvvv",
    ]
    # 끝돌: 왼쪽은 밝은 모서리, 오른쪽은 그늘 모서리
    l = ["T" + row[1:] if 2 <= y <= 11 else row for y, row in enumerate(m)]
    r = [row[:15] + "X" if 2 <= y <= 11 else row for y, row in enumerate(m)]
    rows = [l[y] + m[y] + r[y] for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_B

# >>> cand_base_stone_C
def cand_base_stone_C():
    # 줄 C — 다듬은 돌 두 단(윗면 밝음 · 엇갈린 줄눈) 밑에 눈 둔덕이 기대어 쌓인다.
    leg = dot.legend('northern-snow',
                     S=('stone', 5), T=('stone', 4), U=('stone', 3), V=('stone', 2), X=('stone', 1), Y=('stone', 0),
                     W=('snow', 5), w=('snow', 4), v=('snow', 3), i=('snow', 2), u=('snow', 1), q=('snow', 0))
    m = [
        "YYYYYYYYYYYYYYYY",  # 벽 밑 그늘
        "TTTTTTTTTSTTTTTT",  # 윗돌 윗면
        "SSSSSSSXSSSSSSSX",
        "UUTUUUUXUUUUTUUX",
        "VVVVVVVXVVVVVVVX",
        "XXXXXXXXXXXXXXXX",  # 줄눈
        "TTTXTTTTTTTXTTTT",  # 아랫단(엇갈림)
        "UUUXUUUUTUUXUUUU",
        "VVVXVVVVVVVXVVVV",
        "XuuXuuuuuuuXuuXX",  # 눈 둔덕이 돌에 기댄다
        "uiiiiwwwwiiiiuuu",
        "iwwWWWWWWWWwwwii",
        "wwWWWWWWWWWWWWww",
        "wwwwwwWWWwwwwwww",
        "vvvvvvvvvvvvvvvv",
        "uuvvvuuuvvvvuuuv",
    ]
    l = [("S" if 1 <= y <= 2 or y == 6 else "T") + row[1:] if 1 <= y <= 8 and y != 5 else row for y, row in enumerate(m)]
    r = [row[:15] + "Y" if 1 <= y <= 8 else row for y, row in enumerate(m)]
    rows = [l[y] + m[y] + r[y] for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_C


CANDIDATES = {
    'roof.steep': {'A': cand_roof_steep_A, 'B': cand_roof_steep_B, 'C': cand_roof_steep_C},
    'wall.log': {'A': cand_wall_log_A, 'B': cand_wall_log_B, 'C': cand_wall_log_C},
    'base.stone': {'A': cand_base_stone_A, 'B': cand_base_stone_B, 'C': cand_base_stone_C},
}

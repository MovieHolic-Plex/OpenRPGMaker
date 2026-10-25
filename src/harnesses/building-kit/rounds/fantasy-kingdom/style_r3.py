"""building-kit fantasy-kingdom style-r3 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

중세 판타지 왕국 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r3'
WAVE = 'style'
NOTES = {}

# >>> cand_wall_storey_A
def cand_wall_storey_A():
    """줄 A 1층 반목조 — 크림 회벽 + 16px 기둥 박자 + 가운데 띠 + 가새, 맨 아래 3px 회색 주춧돌."""
    leg = dot.legend('fantasy-kingdom',
                     S=('plaster', 0), P=('plaster', 1), o=('plaster', 2), p=('plaster', 3),
                     k=('timber', 2), b=('timber', 3), q=('timber', 4), Q=('timber', 5),
                     g=('stone', 4), h=('stone', 3), f=('stone', 2), e=('stone', 1),
                     G=('slate', 1), H=('slate', 2), I=('slate', 3),
                     T=('wood', 1), U=('wood', 2), V=('wood', 3), W=('wood', 4), X=('wood', 5),
                     i=('iron', 1), J=('iron', 3),
                     L=('grass', 4), M=('grass', 1), R=('roof', 3), Y=('roof', 4))
    speck = {(5, 6), (10, 9), (12, 5), (7, 12), (3, 11), (4, 20), (11, 22), (8, 25), (13, 19), (6, 18)}

    def base(lx, y):
        post = lx in (15, 0)
        if y <= 1:
            return 'k' if post else 'SP'[y]
        if y in (2, 15):
            return 'q'
        if y in (3, 16, 28):
            return 'b'
        if y >= 29:
            if y > 29 and lx in ((5, 13) if y == 30 else (1, 9)):
                return 'e'
            return 'ghf'[y - 29]
        if post:
            return 'q'
        if lx == 1 or (lx, y) in speck:
            return 'o'
        return 'p'

    window = ["qqqqqqqqqq",
              "qbbbbqbbbb",
              "qIHGqbIHGb",
              "qHGGqbHGGb",
              "qGGGqbGGGb",
              "qbbbqbbbbb",
              "qHGGqbHGGb",
              "qGGGqbGGGb",
              "qGGGqbGGGb",
              "qGGGqbGGGb",
              "QQQQQQQQQQ",
              "..........",
              "..........",
              "LRLMLYLRLM",
              "XWWWWWWWWV",
              "VUUUUUUUUU"]
    door = ["qqqqqqqqqq",
            "qbbbbbbbbb"] + ["qTTTTTTTTb"] + \
           ["qWVUWVUWVb"] * 3 + ["qiXXXXXXXb"] + ["qWVUWVUWVb"] * 7 + ["qWVUWVJWVb", "qWVUWViWVb"] + \
           ["qWVUWVUWVb"] * 5 + ["qiXXXXXXXb"] + ["qWVUWVUWVb"] * 5 + ["qggggggggb"]

    def piece(role):
        g = [[base(x, y) for x in range(16)] for y in range(32)]
        if role in 'lmr':
            for y in range(17, 28):
                if role == 'l':
                    x = 4 + (y - 17)
                else:
                    x = (2 if role == 'm' else 1) + (27 - y)
                g[y][x] = 'q'
                if x + 1 < 15:
                    g[y][x + 1] = 'b'
        if role == 'l':
            for y in range(32):
                g[y][0] = g[y][1] = '.'
                if 2 <= y <= 28:
                    g[y][2], g[y][3] = 'Q', 'q'
                elif y <= 1:
                    g[y][2] = g[y][3] = 'k'
        if role == 'r':
            for y in range(32):
                g[y][14] = g[y][15] = '.'
                if 2 <= y <= 28:
                    g[y][12], g[y][13] = 'q', 'b'
                elif y <= 1:
                    g[y][12] = g[y][13] = 'k'
        tpl = {'w': window, 'd': door}.get(role)
        if tpl:
            for j, row in enumerate(tpl):
                for i, ch in enumerate(row):
                    if ch != '.':
                        g[4 + j][3 + i] = ch
        return g

    ps = [piece(r) for r in 'lmwdr']
    rows = [''.join(''.join(p[y]) for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
def cand_wall_storey_B():
    """밝은 마름돌 한 층 — 처마 그늘 2행 · 8px 마름돌 줄눈 · 쇠틀 창 · 쇠띠 나무문 · 어두운 돌 기초."""
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    courses = [(2, 7), (8, 13), (14, 19), (20, 25), (26, 28)]  # 마름돌 줄(위·아래 행)

    def ashlar(x, y):
        if y < 2:
            return 'b'                                # 처마 그늘
        if y >= 29:
            return 'c' if y == 29 else 'b'            # 돌 기초
        for i, (t, btm) in enumerate(courses):
            if t <= y <= btm:
                off = 0 if i % 2 == 0 else 4
                if y == btm:
                    return 'c'                        # 가로 줄눈
                if (x + off) % 8 == 2:
                    return 'c'                        # 세로 줄눈
                if y == t and (x + off) % 8 == 3:
                    return 'g'                        # 돌 왼 위 하이라이트
                if (x + off) % 8 == 1 or y == btm - 1:
                    return 'e'
                return 'f'
        return 'f'

    for y in range(H):
        for x in range(W):
            g[y][x] = ashlar(x, y)
    # 왼끝·오른끝 — 바깥 2px 투명, 모퉁이 돌
    for y in range(H):
        g[y][0] = g[y][1] = '.'
        g[y][78] = g[y][79] = '.'
        if 2 <= y < 29:
            g[y][2] = 'f'
            g[y][77] = 'c'
            g[y][76] = 'd' if g[y][76] in 'efg' else g[y][76]
    # 창 (x 32..47) — 쇠틀·청석 유리·돌 문턱
    ox = 32
    for y in range(6, 24):
        for x in range(4, 12):
            if y == 6:
                c = 'g' if 4 < x < 11 else 'c'        # 상인방 돌
            elif y == 23:
                c = 'g' if x < 11 else 'd'            # 문턱
            elif x in (4, 11) or y == 7:
                c = 'i'                               # 쇠틀
            elif x in (7, 8):
                c = 'i' if x == 7 else 'j'            # 가운데 살
            elif y == 15:
                c = 'i'
            elif (x, y) in ((5, 8), (9, 8), (5, 16), (9, 16)):
                c = 's'                               # 유리 반짝임
            elif x in (5, 9) or y in (8, 16):
                c = 'q'
            else:
                c = 'p'
            g[y][ox + x] = c
        g[y][ox + 12] = 'd' if 7 <= y < 23 else g[y][ox + 12]
    for x in range(3, 13):
        g[24][ox + x] = 'd'
    # 문 (x 48..63) — 아치 돌 · 나무 판 · 쇠띠, 아래는 칸 경계까지
    ox = 48
    for y in range(2, 32):
        for x in range(1, 15):
            if x in (1, 14):
                c = 'g' if x == 1 else 'c'            # 문설주 돌
                if y >= 29:
                    c = 'c'
            elif y == 2 or (y == 3 and x in (2, 13)):
                c = 'f'                               # 아치 돌
            elif y == 3 or (y == 4 and x in (2, 13)) or x in (2, 13):
                c = 'k'                               # 문틀 그늘
            elif y in (8, 24):
                c = 'i' if x != 3 else 'j'            # 쇠띠
            elif y in (9, 25):
                c = 'k'
            elif x == 11 and y == 17:
                c = 'j'                               # 고리
            elif x in (5, 8):
                c = 'l'                               # 판 이음
            elif x == 3:
                c = 'n'
            elif y == 31:
                c = 'l'
            else:
                c = 'm'
            g[y][ox + x] = c
    leg = dot.legend('fantasy-kingdom', b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3), e=('ashlar', 4),
                     f=('ashlar', 5), g=('ashlar', 6), i=('iron', 1), j=('iron', 3),
                     k=('wood', 1), l=('wood', 2), m=('wood', 3), n=('wood', 4),
                     p=('slate', 0), q=('slate', 1), s=('slate', 2))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C():
    """줄 C 통나무 벽 한 층 — 5줄 통나무(윗면 밝게·아래 틈 어둡게), 끝 조각은 밝은 통나무 마구리, 맨 아래 3px 돌 기초."""
    leg = dot.legend('fantasy-kingdom', a=('wood', 0), b=('wood', 1), c=('wood', 2), d=('wood', 3), e=('wood', 4),
                     f=('wood', 5), g=('wood', 6), s=('stone', 1), t=('stone', 2), u=('stone', 3),
                     k=('slate', 0), m=('slate', 1), n=('slate', 2), i=('iron', 1), j=('iron', 3))
    LOG = 'eddcb'                      # 통나무 한 줄: 윗면 → 아래 틈
    KNOT = {0: (9,), 1: (3, 13), 2: (7,), 3: (11,), 4: (4,)}
    GLINT = {0: 6, 1: 12, 2: 1, 3: 9, 4: 14}
    END_L = ('cfgc', 'egfe', 'efed', 'cedc', 'bbbb')   # 왼끝 마구리(빛 받음)
    END_R = ('cefc', 'dfed', 'dedc', 'cdcc', 'bbbb')   # 오른끝 마구리(그늘)

    def logs(x, y):
        if y == 0:
            return 'a'
        if y == 1:
            return 'b'
        if y == 27:
            return 'c'
        if y == 28:
            return 'b'
        if y == 29:
            return 't' if x in (4, 12) else 'u'
        if y == 30:
            return 's' if x in (0, 8) else 't'
        if y == 31:
            return 's'
        k, r = divmod(y - 2, 5)
        if r in (1, 2) and x in KNOT[k]:
            return 'c'
        if r == 0 and x == GLINT[k]:
            return 'f'
        return LOG[r]

    def piece(kind):
        rows = []
        for y in range(32):
            row = ''
            for x in range(16):
                ch = logs(x, y)
                if kind == 'l':
                    if x < 2:
                        ch = '.'
                    elif 2 <= x <= 5 and 2 <= y <= 26:
                        ch = END_L[(y - 2) % 5][x - 2]
                elif kind == 'r':
                    if x > 13:
                        ch = '.'
                    elif 10 <= x <= 13 and 2 <= y <= 26:
                        ch = END_R[(y - 2) % 5][x - 10]
                elif kind == 'w' and 2 <= x <= 13 and 7 <= y <= 20:
                    if y == 7:
                        ch = 'f' if 3 <= x <= 12 else ch
                    elif y == 19:
                        ch = 'e'
                    elif y == 20:
                        ch = 'b'
                    elif x in (2, 13):
                        pass
                    elif x == 3:
                        ch = 'c'
                    elif x == 12:
                        ch = 'b'
                    elif x in (7, 8) or y == 13:
                        ch = 'c'
                    elif (x, y) in ((5, 9), (10, 9), (5, 15)):
                        ch = 'n'
                    elif y in (8, 14):
                        ch = 'm'
                    else:
                        ch = 'k'
                elif kind == 'd' and 2 <= x <= 13 and y >= 3:
                    if y == 3:
                        ch = 'f' if x < 13 else 'c'
                    elif x == 2:
                        ch = 'b'
                    elif x == 13:
                        ch = 'a'
                    elif y == 4:
                        ch = 'b'
                    elif y in (9, 25) and x <= 8:
                        ch = 'i'
                    elif (x, y) == (11, 18):
                        ch = 'j'
                    elif x in (6, 9):
                        ch = 'b'
                    elif x == 3:
                        ch = 'd'
                    else:
                        ch = 'c'
                if y < 2 and ch != '.':
                    ch = 'a' if y == 0 else 'b'
                row += ch
            rows.append(row)
        return rows

    ps = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {'note': '통나무 5줄·마구리 끝·돌 기초 3px'}
# <<< cand_wall_storey_C

# >>> cand_band_trim_A
def cand_band_trim_A():
    """줄 A 층 띠 — 2층 들보 장선 끝 + 짧은 기와 차양 + 회색 띠돌. 끝 조각은 차양 끝을 접는다."""
    leg = dot.legend('fantasy-kingdom',
                     k=('timber', 2), b=('timber', 3), q=('timber', 4), Q=('timber', 5),
                     a=('roof', 0), c=('roof', 1), d=('roof', 2), r=('roof', 3),
                     A=('ashlar', 1), B=('ashlar', 2), D=('ashlar', 3), F=('ashlar', 5), K=('ashlar', 6))

    def base(lx, y):
        if y == 0:
            return 'q' if lx % 4 in (1, 2) else 'k'
        if y == 1:
            return 'b' if lx % 4 in (1, 2) else 'k'
        if y == 2:
            return 'Q' if lx % 4 == 1 else 'q'
        if y == 3:
            return 'b'
        if y == 4:
            return 'r' if lx % 8 == 3 else 'd'
        if 5 <= y <= 9:
            if (y - 5) % 2 == 0:
                return 'c'
            sep = 2 if (y - 5) // 2 % 2 == 0 else 6
            if lx % 8 == sep:
                return 'c'
            return 'r' if lx % 16 == sep + 1 and y == 6 else 'd'
        if y == 10:
            return 'a' if lx % 4 == 3 else 'c'
        if y == 11:
            return 'a'
        if y == 12:
            return 'K'
        if y == 13:
            return 'F' if lx % 8 != 6 else 'B'
        if y == 14:
            return 'D' if lx % 8 != 6 else 'B'
        return 'A'

    g = [[base(x, y) for x in range(48)] for y in range(16)]
    for y in range(4, 12):
        g[y][0] = 'a'
        g[y][1] = 'c' if y < 11 else 'a'
        g[y][47] = 'a'
        g[y][46] = 'a' if y >= 9 else 'c'
    for y in range(12, 16):
        g[y][0] = 'F' if y == 12 else 'B'
        g[y][47] = 'A'
    rows = [''.join(r) for r in g]
    return dot.grid(rows, leg), {}
# <<< cand_band_trim_A

# >>> cand_band_trim_B
def cand_band_trim_B():
    """층 띠 — 위층 들보 · 청석 차양 · 쇠 까치발 · 마름돌 돌림띠."""
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y < 2:
                c = 'u' if y == 1 else 't'            # 위층 들보
            elif y < 8:
                k = y - 2
                off = 0 if k < 3 else 4
                if k in (2, 5):
                    c = 'a'
                elif (x + off) % 8 == 7:
                    c = 'b'
                elif k in (0, 3) and (x + off) % 16 == 0:
                    c = 'd'
                else:
                    c = 'c' if k in (0, 3) else 'b'
            elif y == 8:
                c = 'b'
            elif y == 9:
                c = 'a'                               # 차양 처마
            elif y == 10:
                c = 'i'
            elif y == 11:
                c = 'g'                               # 돌림띠 윗면
            elif y == 12:
                c = 'f'
            elif y == 13:
                c = 'e'
            elif y == 14:
                c = 'h'
            else:
                c = 'k'
            if y in (10, 11, 12) and x % 16 in (7, 8):
                c = 'j' if (x % 16 == 7 and y == 10) else 'i'   # 쇠 까치발
            g[y][x] = c
    for y in range(H):                                # 끝 마감
        g[y][0] = 'h' if y >= 10 else 'a'
        g[y][47] = 'k' if y >= 10 else 'a'
    leg = dot.legend('fantasy-kingdom', a=('slate', 0), b=('slate', 1), c=('slate', 2), d=('slate', 3),
                     t=('timber', 2), u=('timber', 1), i=('iron', 1), j=('iron', 3),
                     e=('ashlar', 4), f=('ashlar', 5), g=('ashlar', 6), h=('ashlar', 3), k=('ashlar', 1))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_band_trim_B

# >>> cand_band_trim_C
def cand_band_trim_C():
    """줄 C 층 띠 — 들보 2px + 너와 눈썹지붕 2줄 + 어두운 처마 4px."""
    leg = dot.legend('fantasy-kingdom', a=('shingle', 0), b=('shingle', 1), c=('shingle', 2), d=('shingle', 3),
                     e=('shingle', 4))
    SPLIT = ((1, 6, 11), (3, 9, 14))

    def px(x, y):
        if y == 0:
            return 'b'
        if y == 1:
            return 'c'
        if y <= 11:
            k, r = divmod(y - 2, 5)
            sp = SPLIT[k % 2]
            if r == 0 or x in sp:
                return 'c'
            if r == 1 and x == (sp[k % 3] + 1) % 16:
                return 'e'
            return 'd'
        if y == 12:
            return 'b' if x in SPLIT[0] else 'c'
        if y == 13:
            return 'b'
        return 'a'

    rows = []
    for y in range(16):
        row = ''
        for X in range(48):
            ch = px(X % 16, y)
            if X == 0 and y >= 2:
                ch = 'b'
            elif X == 47 and y >= 1:
                ch = 'a'
            row += ch
        rows.append(row)
    return dot.grid(rows, leg), {'note': '너와 눈썹지붕 띠'}
# <<< cand_band_trim_C

# >>> cand_roof_hip_A
def cand_roof_hip_A(cells=3):
    """줄 A 테라코타 모임지붕 — 짧고 밝은 용마루, 가로 기와 줄 사면(roof2 위주, roof3 한 점씩),
    끝 조각 2칸 안에 처마 모서리→용마루 끝 모임 사선(roof0)과 사선 바깥 삼각 그늘, 가장 어두운 처마 띠.
    cells=4 는 2층용 .tall."""
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), c=('roof', 1), d=('roof', 2), r=('roof', 3), y=('roof', 4))
    H, W = cells * 16, 80
    ridge_d = 17
    ridge_y = 3
    eave = H - 7
    sil_y = 22 if cells == 3 else 30

    def sil(y):
        return 0 if y >= sil_y else round(ridge_d * (sil_y - y) / sil_y)

    def hip(y):
        return round(ridge_d * (eave - 1 - y) / (eave - 1 - ridge_y))

    def slope(x, y):
        k, r = (y - 5) // 4, (y - 5) % 4
        if r == 0:
            return 'a' if x % 8 in (1, 5) else 'c'
        sep = 2 if k % 2 == 0 else 6
        if x % 8 == sep:
            return 'c'
        if r == 1 and x % 8 == sep + 1:
            return 'y' if (x % 16 == sep + 1 and k % 4 == 1) else 'r'
        if r == 3:
            return 'a' if x % 8 == sep - 1 else 'c'
        return 'd'

    def ridge(x, y):
        if y == 0:
            return 'c'
        if y == 1:
            return 'r'
        if y == 2:
            return 'y' if x % 16 in (4, 11) else 'r'
        if y == 3:
            return 'd'
        return 'a'

    def face(x, y, lit):
        r = (y - 5) % 4
        if r == 0:
            return 'a'
        if lit and r == 2 and x % 8 == 3:
            return 'd'
        if not lit and r == 2 and x % 16 == 5:
            return 'a'
        if r == 2 and x % 16 == 11:
            return 'd'
        return 'c'

    def eaves(x, y):
        e = y - eave
        if e == 0:
            return 'c'
        if e <= 3:
            if x % 4 == 3:
                return 'a'
            return 'd' if e == 1 and x % 4 == 0 else 'c'
        return 'a'

    def px(x, y):
        if x < 32:
            dd, side = x, 'l'
        elif x >= 48:
            dd, side = 79 - x, 'r'
        else:
            dd, side = 99, 'm'
        if y >= eave:
            return 'a' if dd == 0 else eaves(x, y)
        if dd < sil(y):
            return '.'
        if dd == sil(y) and side != 'm':
            return 'a'
        if y >= sil_y and dd == 0:
            return 'a'
        if side != 'm' and y >= ridge_y and dd <= hip(y):
            if dd == hip(y):
                return 'a'
            return face(x, y, side == 'l')
        if side != 'm' and y < ridge_y + 2 and dd < ridge_d:
            return face(x, y, side == 'l')
        if side != 'm' and dd == hip(y) + 1 and y >= 5:
            return 'r' if side == 'l' else 'd'
        if y <= 4:
            return ridge(x, y)
        return slope(x, y)

    rows = [''.join(px(x, y) for x in range(W)) for y in range(H)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_hip_A

# >>> cand_roof_hip_B
def cand_roof_hip_B():
    """청석 모임지붕 3행 — 용마루 밝은 선 · 슬레이트 사면 · 끝 2칸 모임 사선 · 어두운 처마."""
    cells = 3
    W, H = 80, cells * 16
    eave = H - 6                      # 처마 띠 시작 행
    back = 12 if cells == 3 else 15   # 끝 조각 바깥 위 뒷면 사선이 바깥 가장자리에 닿는 행
    rx = 20                          # 용마루 끝(끝 조각 안 x)
    g = [['.'] * W for _ in range(H)]

    def slope(x, y, facet):
        if y == 0:
            return 'b'
        if y == 1:
            return 'd' if x % 8 == 2 else 'c'   # 용마루 — 밝은 선, 한 화소씩 하이라이트
        if y == 2:
            return 'c'
        if y == 3:
            return 'a'
        k = (y - 4) % 4
        c = (y - 4) // 4
        off = 0 if c % 2 == 0 else 2
        q = (x + off) % 4
        low = y >= eave - 10
        # 청석 비늘 한 장 4×4 — 위·왼 밝고 아래·오른 어둡다
        t = ('bccb', 'cccc', 'bbbb', 'abba')[k][q]
        if k == 0 and q == 1 and c % 3 == 0 and (x + off) % 16 == 5 and not low and not facet:
            return 'd'
        if low and t == 'c' and k == 1 and q in (0, 3):
            t = 'b'
        if facet:
            t = 'b' if t == 'c' else t
        return t

    for y in range(H):
        for x in range(W):
            if x < 32:
                lx, side = x, 'l'
            elif x >= 48:
                lx, side = W - 1 - x, 'r'
            else:
                lx, side = x, 'm'
            if y >= eave:
                k = y - eave
                if k == 0:
                    g[y][x] = 'c' if x % 8 != 3 else 'b'
                elif k == 1:
                    g[y][x] = 'b'
                elif k == 2:
                    g[y][x] = 'e' if x % 16 in (3, 11) else 'a'
                else:
                    g[y][x] = 'a' if k < 5 else 'f'
                continue
            if side == 'm':
                g[y][x] = slope(x, y, False)
                continue
            if lx < rx and y < (rx - lx) * back // rx:
                continue                                      # 뒷면 사선 바깥 — 비움
            hx = 1 + (eave + 2 - y) * (rx - 1) // (eave - 1)  # 모임 사선 x
            if lx >= rx and y <= 3:
                g[y][x] = slope(x, y, False)
            elif lx == hx:
                g[y][x] = 'a'                                 # 모임 사선 — 어두운 단
            elif lx == hx + 1 and side == 'l':
                g[y][x] = 'c'
            elif lx < hx:
                t = slope(x, y, True)
                if side == 'r' and (y - 4) % 4 >= 2:            # 오른 끝 면은 한 단 더 그늘
                    t = 'a'
                g[y][x] = t
            elif y <= 3:
                g[y][x] = 'a' if y == 3 else 'b'
            else:
                g[y][x] = slope(x, y, False)
    leg = dot.legend('fantasy-kingdom', a=('slate', 0), b=('slate', 1), c=('slate', 2), d=('slate', 3),
                     e=('iron', 3), f=('iron', 1))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_hip_B

# >>> cand_roof_hip_C
def cand_roof_hip_C(H=48):
    """줄 C 너와 모임지붕 — 짧고 밝은 용마루, 너와 5px 줄, 끝 2칸 안 모임 사선(sh0) + 사선 밖 모임면 그늘, 처마 4행 어둡게."""
    if H == 48:   # 왼끝 조각 모임 사선 x (y=3..43) · 모임면 윗선 y (x=0..25)
        HX = (26, 25, 25, 24, 24, 23, 22, 22, 21, 21, 20, 19, 19, 18, 18, 17, 16, 16, 15, 15, 14, 13, 13, 12, 12,
              11, 10, 10, 9, 9, 8, 7, 7, 6, 6, 5, 4, 4, 3, 3, 2)
        TB = (12, 12, 11, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3)
    else:         # y=3..59 · x=0..25
        HX = (26, 26, 25, 25, 24, 24, 23, 23, 23, 22, 22, 21, 21, 20, 20, 20, 19, 19, 18, 18, 17, 17, 17, 16, 16,
              15, 15, 14, 14, 14, 13, 13, 12, 12, 11, 11, 11, 10, 10, 9, 9, 8, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3,
              2, 2)
        TB = (16, 15, 15, 15, 14, 13, 13, 13, 12, 11, 11, 11, 10, 9, 9, 9, 8, 7, 7, 7, 6, 5, 5, 5, 4, 3)
    leg = dot.legend('fantasy-kingdom', a=('shingle', 0), b=('shingle', 1), c=('shingle', 2), d=('shingle', 3),
                     e=('shingle', 4), f=('shingle', 5), g=('shingle', 6))
    E = H - 5                         # 마지막 사면 행
    O = (E + 1) - 5 * ((E - 3) // 5)  # 너와 줄 시작 행(처마에 줄이 딱 맞게)
    RS = 26                           # 끝 조각 안 용마루 시작 x
    SPLIT = ((1, 6, 11), (3, 9, 14), (0, 5, 12))   # 줄마다 너와 이음 x(16 주기, 세 가지 엇갈림)
    LONG = ((6,), (9,), (12,))                      # 아래로 1px 더 내려오는 긴 너와(밑단 들쭉날쭉)
    RIDGE = 'dfdb'
    NK = (E + 1 - O) // 5                           # 너와 줄 수
    DARKER = {'e': 'd', 'd': 'c', 'c': 'b', 'b': 'a', 'a': 'a'}

    def courses(u, y, base, line, hi):
        k, r = divmod(y - O, 5)
        sp = SPLIT[k % 3]
        if O + 5 * k + 4 >= H - 17:                 # 맨 아래 칸(앞 처마 쪽)에 걸친 줄은 한 단 어둡게
            base, line, hi = DARKER[base], DARKER[line], DARKER[hi]
        if r == 0:
            up = SPLIT[(k - 1) % 3]
            for s in LONG[(k - 1) % 3]:
                if s < u < s + 5 and u not in up:
                    return base if k < NK - 1 else DARKER[base]
            return line
        if u in sp:
            return line if r < 4 else DARKER[line]
        if r == 1 and (u == (sp[k % 3] + 1) % 16 or (k < 3 and u == (sp[(k + 1) % 3] + 2) % 16)):
            return hi
        if r == 4 and (u + 1) % 16 in sp:
            return line
        return base

    def px(u, g, y, side):
        """u = 무늬 x(16 주기), g = 끝 조각 안 기하 x(바깥에서 0), side = 'l'|'r'|'m'."""
        if y > E:
            return ('b' if u in SPLIT[0] else 'c', 'b', 'a', 'a')[y - E - 1]
        if side == 'm' or g >= RS:
            if y < 4:
                if side != 'm' and g == RS and y < 3:
                    return 'c'
                return 'g' if (y == 1 and u in (2, 10)) else RIDGE[y]
            return courses(u, y, 'd', 'c', 'e')
        if y < TB[g]:
            return '.'
        if y == TB[g]:
            return 'b' if side == 'l' else 'a'
        hx = HX[y - 3]
        if g < hx:
            if g == 0:
                return 'b' if side == 'l' else 'a'
            return courses(u, y, 'd', 'b', 'e') if side == 'l' else courses(u, y, 'c', 'b', 'e')
        if g == hx:
            return 'a'
        if g == hx + 1:
            return 'e' if side == 'l' else 'c'
        return courses(u, y, 'd', 'c', 'e')

    rows = []
    for y in range(H):
        row = ''
        for x in range(32):
            row += px(x % 16, x, y, 'l')
        for x in range(16):
            row += px(x, 0, y, 'm')
        for x in range(32):
            row += px(x % 16, 31 - x, y, 'r')
        rows.append(row)
    return dot.grid(rows, leg), {'note': '너와 모임지붕 %d행' % (H // 16)}
# <<< cand_roof_hip_C

# >>> cand_roof_hip_tall_A
def cand_roof_hip_tall_A():
    """줄 A 2층용 4행 모임지붕 — cand_roof_hip_A 와 같은 문법을 64px 높이로(사면 13줄)."""
    return cand_roof_hip_A(4)
# <<< cand_roof_hip_tall_A

# >>> cand_roof_hip_tall_B
def cand_roof_hip_tall_B():
    """청석 모임지붕 4행 — 용마루 밝은 선 · 슬레이트 사면 · 끝 2칸 모임 사선 · 어두운 처마."""
    cells = 4
    W, H = 80, cells * 16
    eave = H - 6                      # 처마 띠 시작 행
    back = 12 if cells == 3 else 15   # 끝 조각 바깥 위 뒷면 사선이 바깥 가장자리에 닿는 행
    rx = 20                          # 용마루 끝(끝 조각 안 x)
    g = [['.'] * W for _ in range(H)]

    def slope(x, y, facet):
        if y == 0:
            return 'b'
        if y == 1:
            return 'd' if x % 8 == 2 else 'c'   # 용마루 — 밝은 선, 한 화소씩 하이라이트
        if y == 2:
            return 'c'
        if y == 3:
            return 'a'
        k = (y - 4) % 4
        c = (y - 4) // 4
        off = 0 if c % 2 == 0 else 2
        q = (x + off) % 4
        low = y >= eave - 10
        # 청석 비늘 한 장 4×4 — 위·왼 밝고 아래·오른 어둡다
        t = ('bccb', 'cccc', 'bbbb', 'abba')[k][q]
        if k == 0 and q == 1 and c % 3 == 0 and (x + off) % 16 == 5 and not low and not facet:
            return 'd'
        if low and t == 'c' and k == 1 and q in (0, 3):
            t = 'b'
        if facet:
            t = 'b' if t == 'c' else t
        return t

    for y in range(H):
        for x in range(W):
            if x < 32:
                lx, side = x, 'l'
            elif x >= 48:
                lx, side = W - 1 - x, 'r'
            else:
                lx, side = x, 'm'
            if y >= eave:
                k = y - eave
                if k == 0:
                    g[y][x] = 'c' if x % 8 != 3 else 'b'
                elif k == 1:
                    g[y][x] = 'b'
                elif k == 2:
                    g[y][x] = 'e' if x % 16 in (3, 11) else 'a'
                else:
                    g[y][x] = 'a' if k < 5 else 'f'
                continue
            if side == 'm':
                g[y][x] = slope(x, y, False)
                continue
            if lx < rx and y < (rx - lx) * back // rx:
                continue                                      # 뒷면 사선 바깥 — 비움
            hx = 1 + (eave + 2 - y) * (rx - 1) // (eave - 1)  # 모임 사선 x
            if lx >= rx and y <= 3:
                g[y][x] = slope(x, y, False)
            elif lx == hx:
                g[y][x] = 'a'                                 # 모임 사선 — 어두운 단
            elif lx == hx + 1 and side == 'l':
                g[y][x] = 'c'
            elif lx < hx:
                t = slope(x, y, True)
                if side == 'r' and (y - 4) % 4 >= 2:            # 오른 끝 면은 한 단 더 그늘
                    t = 'a'
                g[y][x] = t
            elif y <= 3:
                g[y][x] = 'a' if y == 3 else 'b'
            else:
                g[y][x] = slope(x, y, False)
    leg = dot.legend('fantasy-kingdom', a=('slate', 0), b=('slate', 1), c=('slate', 2), d=('slate', 3),
                     e=('iron', 3), f=('iron', 1))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_hip_tall_B

# >>> cand_roof_hip_tall_C
def cand_roof_hip_tall_C():
    """줄 C 너와 모임지붕 4행 — roof.hip C 와 같은 문법, 사면만 길게."""
    return cand_roof_hip_C(64)
# <<< cand_roof_hip_tall_C

# >>> cand_wall_stone_A
def cand_wall_stone_A():
    """줄 A 1층 마름돌 — 6px 단 마름돌(위·왼 밝은 모서리, 아래·오른 그늘), 엇갈린 줄눈, 맨 아래 큰 기초돌 단."""
    leg = dot.legend('fantasy-kingdom',
                     A=('ashlar', 0), B=('ashlar', 1), C=('ashlar', 2), D=('ashlar', 3), E=('ashlar', 4),
                     F=('ashlar', 5), K=('ashlar', 6),
                     G=('slate', 1), H=('slate', 2), I=('slate', 3),
                     T=('wood', 1), U=('wood', 2), V=('wood', 3), W=('wood', 4), X=('wood', 5),
                     i=('iron', 1), J=('iron', 3))

    def base(lx, y):
        if y == 0:
            return 'B'
        if y == 1:
            return 'C'
        if y >= 26:
            r = y - 26
            if r == 0:
                return 'C'
            if lx % 16 == 9:
                return 'B'
            if lx % 16 == 10 and r < 4:
                return 'F'
            return 'EDDCB'[r - 1]
        k, r = (y - 2) // 6, (y - 2) % 6
        if r == 0:
            return 'C'
        j = 2 if k % 2 == 0 else 6
        m = lx % 8
        if m == j:
            return 'C'
        if r == 5:
            return 'D'
        if m == (j + 1) % 8 or r == 1:
            return 'K'
        if m == (j - 1) % 8:
            return 'D'
        return 'F' if r <= 2 else 'E'

    window = ["KKKKKKKK",
              "DDDDDDDD",
              "KBAAAAAD",
              "KBGIHGGD",
              "KBGHGGGD",
              "KBGGGGGD",
              "KBBBBBBD",
              "KBGHGGGD",
              "KBGGGGGD",
              "KBGGGGGD",
              "KKKKKKKK",
              "DDDDDDDD"]
    door = ["...CKKKKKKC...",
            "..CKEEEEEEDC..",
            ".CKEBBBBBBEDC.",
            ".KEBTTTTTTBED.",
            ".KBTWVWVWVTBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBXXXXXXXXBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUJVBD.",
            ".KBWVUWVUiVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBXXXXXXXXBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBWVUWVUWVBD.",
            ".KBTTTTTTTTBD.",
            ".KKFFFFFFFFFD.",
            ".DDDDDDDDDDDD."]

    def piece(role):
        g = [[base(x, y) for x in range(16)] for y in range(32)]
        if role == 'l':
            for y in range(32):
                g[y][0] = g[y][1] = 'B' if y == 0 else '.'
                if y >= 2 and g[y][2] != 'C':
                    g[y][2] = 'K'
        if role == 'r':
            for y in range(32):
                g[y][14] = g[y][15] = 'B' if y == 0 else '.'
                if y >= 2 and g[y][13] != 'C':
                    g[y][13] = 'D'
        tpl, ox, oy = {'w': (window, 4, 6), 'd': (door, 1, 5)}.get(role, (None, 0, 0))
        if tpl:
            for j, row in enumerate(tpl):
                for i, ch in enumerate(row):
                    if ch != '.':
                        g[oy + j][ox + i] = ch
        return g

    ps = [piece(r) for r in 'lmwdr']
    rows = [''.join(''.join(p[y]) for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_stone_A

# >>> cand_wall_stone_B
def cand_wall_stone_B():
    """1층 큰 돌벽 — 회색 둥근 마름돌 4줄 · 작고 깊은 창 · 쇠띠 나무문 · 어두운 돌 기초."""
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    courses = [(2, 8, (4, 13)), (9, 15, (0, 8)), (16, 22, (5, 12)), (23, 28, (2, 10))]

    def stone(x, y):
        if y < 2:
            return 'a' if y == 0 else 'b'             # 처마 그늘
        if y >= 29:
            return 'b' if y < 31 else 'a'             # 돌 기초
        for t, btm, joints in courses:
            if t <= y <= btm:
                lx = x % 16
                if y == btm or lx in joints:
                    return 'b'                        # 줄눈
                left = (lx - 1) % 16 in joints
                right = (lx + 1) % 16 in joints
                if (y == t or y == btm - 1) and (left or right):
                    return 'b'                        # 둥근 귀
                if y == t or left:
                    return 'e'                        # 빛 받는 위·왼
                if y == btm - 1 or right:
                    return 'c'
                if (lx * 3 + y) % 11 == 0:
                    return 'c'                        # 돌 결
                return 'd'
        return 'd'

    for y in range(H):
        for x in range(W):
            g[y][x] = stone(x, y)
    for y in range(2, H):                             # 위 2행(처마·층 띠 그늘)만 끝까지, 아래는 바깥 2px 비움
        g[y][0] = g[y][1] = '.'
        g[y][78] = g[y][79] = '.'
        if 2 <= y < 29:
            g[y][2] = 'e' if g[y][2] != 'b' else 'c'
            g[y][77] = 'b' if g[y][77] == 'b' else 'c'
    # 작고 깊은 창 (x 32..47)
    ox = 32
    for y in range(8, 21):
        for x in range(4, 12):
            if y == 8:
                c = 'f'                               # 상인방
            elif y == 20:
                c = 'f' if x < 11 else 'd'            # 문턱
            elif x in (4, 11):
                c = 'b' if x == 11 else 'c'           # 깊은 측벽
            elif y == 9 or x == 5:
                c = 'a'                               # 안쪽 그늘
            elif x == 8:
                c = 'i'
            elif (x, y) in ((6, 10), (9, 10)):
                c = 's'
            elif y == 10 or x in (6, 9):
                c = 'q'
            else:
                c = 'p'
            g[y][ox + x] = c
    for x in range(4, 13):
        g[21][ox + x] = 'b'
    # 문 (x 48..63)
    ox = 48
    for y in range(2, 32):
        for x in range(1, 15):
            if x in (1, 14):
                c = 'e' if x == 1 else 'b'
            elif y == 2 or (y == 3 and x in (2, 13)):
                c = 'f'
            elif y == 3 or (y == 4 and x in (2, 13)) or x in (2, 13):
                c = 'k'
            elif y in (8, 24):
                c = 'i' if x != 3 else 'j'
            elif y in (9, 25):
                c = 'k'
            elif x == 11 and y == 17:
                c = 'j'
            elif x in (5, 8):
                c = 'l'
            elif x == 3:
                c = 'n'
            elif y == 31:
                c = 'l'
            else:
                c = 'm'
            g[y][ox + x] = c
    leg = dot.legend('fantasy-kingdom', a=('stone', 1), b=('stone', 2), c=('cobble', 3), d=('stone', 3),
                     e=('stone', 4), f=('stone', 5), i=('iron', 1), j=('iron', 3),
                     k=('wood', 1), l=('wood', 2), m=('wood', 3), n=('wood', 4),
                     p=('slate', 0), q=('slate', 1), s=('slate', 2))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_stone_B

# >>> cand_wall_stone_C
def cand_wall_stone_C():
    """줄 C 막돌 벽 1층 — 크고 들쭉날쭉한 돌 4켜(줄눈 16 주기), 작고 깊은 창, 통널 문, 맨 아래 3px 어두운 돌 기초."""
    leg = dot.legend('fantasy-kingdom', a=('ashlar', 0), b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3),
                     f=('ashlar', 5), g=('ashlar', 6), k=('slate', 0), m=('slate', 1), n=('slate', 2),
                     p=('wood', 1), q=('wood', 2), r=('wood', 3), s=('wood', 4), i=('iron', 1), j=('iron', 3))
    COURSE = ((2, 8, (3, 12)), (9, 15, (7,)), (16, 22, (1, 10)), (23, 28, (5, 14)))  # (윗행, 줄눈행, 세로 줄눈 x)

    def stone(x, y):
        if y == 0:
            return 'a'
        if y == 1:
            return 'b'
        if y == 29:
            return 'b' if x in (0, 8) else 'c'
        if y == 30:
            return 'b'
        if y == 31:
            return 'a'
        for ys, ye, J in COURSE:
            if ys <= y <= ye:
                if y == ye or x in J:
                    return 'b'
                left = (x - 1) % 16 in J
                if y == ys:
                    return 'g' if left else 'f'
                if left:
                    return 'f'
                if (x + 1) % 16 in J or y == ye - 1:
                    return 'c'
                return 'd'

    def piece(kind):
        rows = []
        for y in range(32):
            row = ''
            for x in range(16):
                ch = stone(x, y)
                if kind == 'l':                     # 바깥 2px 비움 — 단 맨 위 2행은 층 띠 밑 그늘이라 채운다
                    if x < 2 and y >= 2:
                        ch = '.'
                    elif x == 2 and 2 <= y < 29:
                        ch = 'f'
                elif kind == 'r':
                    if x > 13 and y >= 2:
                        ch = '.'
                    elif x == 13 and 2 <= y < 29:
                        ch = 'c'
                elif kind == 'w' and 4 <= x <= 11 and 8 <= y <= 19:
                    if y == 8 or y == 18:
                        ch = 'f'
                    elif y == 19:
                        ch = 'c'
                    elif x in (4, 11):
                        pass
                    elif x == 5 or y == 9:
                        ch = 'a'
                    elif x == 10:
                        ch = 'b'
                    elif (x, y) == (7, 11):
                        ch = 'n'
                    elif y == 10:
                        ch = 'm'
                    else:
                        ch = 'k'
                elif kind == 'd' and 2 <= x <= 13 and y >= 2:
                    if y == 2:
                        ch = 'g' if x < 13 else 'f'
                    elif y == 3:
                        ch = 'f' if x < 13 else 'c'
                    elif x == 2:
                        ch = 'f'
                    elif x == 13:
                        ch = 'b'
                    elif y == 4:
                        ch = 'a'
                    elif x == 12:
                        ch = 'p'
                    elif y in (9, 25) and x <= 8:
                        ch = 'i'
                    elif (x, y) == (10, 18):
                        ch = 'j'
                    elif x in (6, 9):
                        ch = 'p'
                    elif x == 3:
                        ch = 's'
                    else:
                        ch = 'r'
                if y < 2 and ch != '.':
                    ch = 'a' if y == 0 else 'b'
                row += ch
            rows.append(row)
        return rows

    ps = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {'note': '막돌 4켜·깊은 창·돌 기초'}
# <<< cand_wall_stone_C

# >>> cand_wall_timber_A
def cand_wall_timber_A():
    """줄 A 2층 반목조 — 크림 회벽, 16px 기둥 + 무릎 가새, 아래 판에 X 가새, 덧창 달린 창, 맨 아래 2px 나무 들보."""
    leg = dot.legend('fantasy-kingdom',
                     S=('plaster', 0), P=('plaster', 1), o=('plaster', 2), p=('plaster', 3),
                     n=('timber', 1), k=('timber', 2), b=('timber', 3), q=('timber', 4), Q=('timber', 5),
                     G=('slate', 1), H=('slate', 2), I=('slate', 3),
                     T=('wood', 1), U=('wood', 2), V=('wood', 3), W=('wood', 4), X=('wood', 5),
                     i=('iron', 1), J=('iron', 3),
                     L=('grass', 4), M=('grass', 1), R=('roof', 3), Y=('roof', 4))
    speck = {(5, 8), (10, 11), (12, 6), (7, 13), (4, 22), (11, 21), (8, 26), (13, 25)}

    def base(lx, y):
        post = lx in (15, 0)
        if y <= 1:
            return 'k' if post else 'SP'[y]
        if y in (2, 16):
            return 'q'
        if y in (3, 17):
            return 'b'
        if y == 29:
            return 'Q' if lx % 8 == 3 else 'q'
        if y == 30:
            return 'b'
        if y == 31:
            return 'k'
        if post:
            return 'q'
        if lx == 1 or (lx, y) in speck:
            return 'o'
        return 'p'

    knee_l = [(1, 4), (2, 5), (3, 6)]
    knee_r = [(14, 4), (13, 5), (12, 6)]

    def xbrace(g, x0, x1):
        n = x1 - x0
        for y in range(18, 29):
            t = (y - 18) / 10
            a = x0 + round(n * t)
            c = x1 - round(n * t)
            for x, ch in ((a, 'q'), (c, 'b')):
                if 0 < x < 15:
                    g[y][x] = ch

    window = ["QbbbbbbbbbbQ",
              "QqqqqqqqqqqQ",
              "QqIHGqbIHGbQ",
              "bqHGGqbHGGbb",
              "QqGGGqbGGGbQ",
              "bqbbbqbbbbbb",
              "QqHGGqbHGGbQ",
              "bqGGGqbGGGbb",
              "QqGGGqbGGGbQ",
              "bQQQQQQQQQQb",
              "..LRLMLYLR..",
              "..XWWWWWWV..",
              ]
    door = ["qqqqqqqqqq",
            "qbTTTTTTbb",
            "qTTWVWVTTb",
            "qTWVUWVUTb"] + ["qWVUWVUWVb"] * 4 + ["qWiiWViiVb"] + ["qWVUWVUWVb"] * 5 + \
           ["qWVUWVJWVb", "qWVUWViWVb"] + ["qWVUWVUWVb"] * 3 + ["qWiiWViiVb"] + ["qWVUWVUWVb"] * 5 + ["qkkkkkkkkb"]

    def piece(role):
        g = [[base(x, y) for x in range(16)] for y in range(32)]
        if role in 'lmr':
            for x, y in (knee_r if role == 'l' else knee_l if role == 'r' else knee_l + knee_r):
                g[y][x] = 'b'
            if role == 'm':
                xbrace(g, 2, 13)
            elif role == 'l':
                xbrace(g, 5, 13)
            else:
                xbrace(g, 2, 10)
        if role == 'l':
            for y in range(32):
                g[y][0] = g[y][1] = '.'
                if 2 <= y <= 28:
                    g[y][2], g[y][3] = 'Q', 'q'
                elif y <= 1:
                    g[y][2] = g[y][3] = 'k'
        if role == 'r':
            for y in range(32):
                g[y][14] = g[y][15] = '.'
                if 2 <= y <= 28:
                    g[y][12], g[y][13] = 'q', 'b'
                elif y <= 1:
                    g[y][12] = g[y][13] = 'k'
        tpl, ox, oy = {'w': (window, 2, 4), 'd': (door, 3, 4)}.get(role, (None, 0, 0))
        if tpl:
            for j, row in enumerate(tpl):
                for i, ch in enumerate(row):
                    if ch != '.':
                        g[oy + j][ox + i] = ch
        return g

    ps = [piece(r) for r in 'lmwdr']
    rows = [''.join(''.join(p[y]) for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_timber_A

# >>> cand_wall_timber_B
def cand_wall_timber_B():
    """반목조 한 층 — 크림 회벽 · 칸 경계 2px 기둥 · 가운데 띠장 · 가새 · 쇠틀 창 · 아래 들보."""
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]

    def panel(x, y):
        lx = x % 16
        if y < 2:
            return 'a' if y == 0 else 'b'             # 처마 그늘(회벽 어두운 단)
        if y == 2:
            return 't'                                # 도리
        if y >= 29:
            return 't' if y == 29 else 'u'            # 아래 들보
        if lx == 7 and not 32 <= x < 48:
            return 'w'                                # 기둥 밝은 왼쪽
        if lx == 8 and not 32 <= x < 48:
            return 'u'
        if y in (15, 16):
            return 'v' if y == 15 else 't'            # 띠장
        if y == 3 or (lx == 9 and not 32 <= x < 48):
            return 'b'                                # 기둥·도리 밑 그늘
        if (lx * 5 + y * 3) % 23 == 0:
            return 'c'                                # 회벽 결
        return 'd'

    for y in range(H):
        for x in range(W):
            g[y][x] = panel(x, y)
    # 가운데 조각 아래 판에 기둥으로 기대는 가새 한 쌍
    for y in range(18, 29):
        d = (28 - y) * 5 // 10
        g[y][16 + 1 + d] = 'v'
        g[y][16 + 14 - d] = 't'
    # 끝 조각 — 바깥 2px 투명, 모퉁이 기둥
    for y in range(H):
        g[y][0] = g[y][1] = '.'
        g[y][78] = g[y][79] = '.'
        if 3 <= y < 29:
            g[y][2] = 'w'
            if y not in (15, 16):
                g[y][3] = 'u'
                g[y][4] = 'b'
            g[y][76] = 'v'
            g[y][77] = 'u'
    # 창 (x 32..47) — 위 판, 나무틀·청석 유리·쇠 받침
    ox = 32
    for y in range(4, 15):
        for x in range(4, 12):
            if y in (4, 14) or x in (4, 11):
                c = 'u' if y == 14 or x == 11 else 't'
            elif x == 7 or y == 9:
                c = 't'
            elif (x, y) in ((5, 5), (8, 5)):
                c = 's'
            elif x in (5, 8) or y in (5, 10):
                c = 'q'
            else:
                c = 'p'
            g[y][ox + x] = c
    for x in range(3, 13):
        g[14][ox + x] = 'w' if x < 12 else 'u'
    for x in (4, 11):
        g[15][ox + x] = 'j'
    # 창 아래 판에 X 가새
    for i in range(10):
        g[18 + i][ox + 3 + i] = 'v'
        g[18 + i][ox + 12 - i] = 't'
    # 문 (x 48..63)
    ox = 48
    for y in range(3, 32):
        for x in range(2, 14):
            if x in (2, 13) or y == 3:
                c = 'u' if x == 13 else 't'           # 문틀
            elif y == 4:
                c = 'k'
            elif y in (9, 24):
                c = 'i' if x != 4 else 'j'
            elif y in (10, 25):
                c = 'k'
            elif x == 11 and y == 17:
                c = 'j'
            elif x in (6, 9):
                c = 'l'
            elif x == 3:
                c = 'k'
            elif x == 4:
                c = 'n'
            elif y == 31:
                c = 'l'
            else:
                c = 'm'
            g[y][ox + x] = c
    leg = dot.legend('fantasy-kingdom', a=('plaster', 0), b=('plaster', 1), c=('plaster', 2), d=('plaster', 3),
                     t=('timber', 2), u=('timber', 1), v=('timber', 4), w=('timber', 5),
                     i=('iron', 1), j=('iron', 3), k=('wood', 1), l=('wood', 2), m=('wood', 3), n=('wood', 4),
                     p=('slate', 0), q=('slate', 1), s=('slate', 2))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_timber_B

# >>> cand_wall_timber_C
def cand_wall_timber_C():
    """줄 C 반목조 벽 — 크림 회벽, 조각 경계마다 2px 기둥, 가운데 조각에 가새 하나, 허리 들보, 맨 아래 2px 들보."""
    leg = dot.legend('fantasy-kingdom', a=('timber', 0), b=('timber', 1), c=('timber', 2), d=('timber', 3),
                     e=('timber', 4), f=('timber', 5), h=('plaster', 0), i=('plaster', 1),
                     j=('plaster', 2), k=('plaster', 3), q=('slate', 0), r=('slate', 1), s=('slate', 2),
                     t=('iron', 1), u=('iron', 3))
    BR = (13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2)  # 가새 x (y=4..29)
    SPECK = ((4, 6), (11, 9), (6, 12), (13, 20), (3, 24), (9, 27))
    LIGHT = ((8, 5), (5, 19), (10, 23))

    def wall(x, y):
        if y == 0:
            return 'b'
        if y == 1:
            return 'c'
        if y == 2:
            return 'e'
        if y == 3:
            return 'c'
        if y == 15:
            return 'e'
        if y == 16:
            return 'c'
        if y == 30:
            return 'd'
        if y == 31:
            return 'b'
        if x == 15:
            return 'e'
        if x == 0:
            return 'c'
        if y in (4, 17):
            return 'i'
        if (x, y) in SPECK:
            return 'i'
        if (x, y) in LIGHT:
            return 'k'
        return 'j'

    def piece(kind):
        rows = []
        for y in range(32):
            row = ''
            for x in range(16):
                ch = wall(x, y)
                if kind == 'm' and 4 <= y <= 29 and y not in (15, 16):
                    bx = BR[y - 4]
                    if x == bx:
                        ch = 'e'
                    elif x == bx + 1:
                        ch = 'c'
                elif kind == 'l':
                    if x < 2:
                        ch = '.'
                    elif 2 <= y <= 29 and x == 2:
                        ch = 'e'
                    elif 2 <= y <= 29 and x == 3:
                        ch = 'c'
                elif kind == 'r':
                    if x > 13:
                        ch = '.'
                    elif 2 <= y <= 29 and x == 12:
                        ch = 'd'
                    elif 2 <= y <= 29 and x == 13:
                        ch = 'b'
                elif kind == 'w' and 3 <= x <= 12 and 6 <= y <= 20:
                    if y == 6:
                        ch = 'c'
                    elif y == 19:
                        ch = 'f'
                    elif y == 20:
                        ch = 'b'
                    elif x == 3:
                        ch = 'd'
                    elif x == 12:
                        ch = 'b'
                    elif x in (7, 8) or y == 12:
                        ch = 'c'
                    elif (x, y) in ((5, 8), (10, 8), (5, 14)):
                        ch = 's'
                    elif y in (7, 13):
                        ch = 'r'
                    else:
                        ch = 'q'
                elif kind == 'd' and 2 <= x <= 13 and y >= 4:
                    if x == 2 or y == 4:
                        ch = 'c'
                    elif x == 13:
                        ch = 'a'
                    elif y == 5:
                        ch = 'b'
                    elif y in (10, 25) and x <= 8:
                        ch = 't'
                    elif (x, y) == (11, 18):
                        ch = 'u'
                    elif x in (6, 9):
                        ch = 'c'
                    elif x == 3:
                        ch = 'f'
                    else:
                        ch = 'e'
                if y < 2 and ch != '.':
                    ch = 'b' if y == 0 else 'c'
                row += ch
            rows.append(row)
        return rows

    ps = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in ps) for y in range(32)]
    return dot.grid(rows, leg), {'note': '회벽 반목조·경계 기둥·가새'}
# <<< cand_wall_timber_C


CANDIDATES = {
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'band.trim': {'A': cand_band_trim_A, 'B': cand_band_trim_B, 'C': cand_band_trim_C},
    'roof.hip': {'A': cand_roof_hip_A, 'B': cand_roof_hip_B, 'C': cand_roof_hip_C},
    'roof.hip.tall': {'A': cand_roof_hip_tall_A, 'B': cand_roof_hip_tall_B, 'C': cand_roof_hip_tall_C},
    'wall.stone': {'A': cand_wall_stone_A, 'B': cand_wall_stone_B, 'C': cand_wall_stone_C},
    'wall.timber': {'A': cand_wall_timber_A, 'B': cand_wall_timber_B, 'C': cand_wall_timber_C},
}

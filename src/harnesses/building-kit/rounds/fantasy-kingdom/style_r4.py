"""building-kit fantasy-kingdom style-r4 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

중세 판타지 왕국 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r4'
WAVE = 'style'
NOTES = {}

# >>> cand_wall_storey_A
# 줄 A 공용 — 범례 글자: 지붕 a~e(roof 0~4) · 회벽 p~t(plaster 0~4) · 나무 0~6(timber 0~6)
#                      돌 A~F(stone 0~5) · 유리 G~J(slate 0~3) · 쇠 K~N(iron 0~3)
_FKA_LEG = dict(
    a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3), e=('roof', 4),
    p=('plaster', 0), q=('plaster', 1), r=('plaster', 2), s=('plaster', 3), t=('plaster', 4),
    A=('stone', 0), B=('stone', 1), C=('stone', 2), D=('stone', 3), E=('stone', 4), F=('stone', 5),
    G=('slate', 0), H=('slate', 1), I=('slate', 2), J=('slate', 3),
    K=('iron', 0), L=('iron', 1), M=('iron', 2), N=('iron', 3),
    **{str(i): ('timber', i) for i in range(7)})


def _fkA_legend():
    return dot.legend('fantasy-kingdom', **_FKA_LEG)


def _fkA_join(pieces):
    """조각(16px 칸 단위 글자 격자)들을 가로로 이어 행 문자열로."""
    h = len(pieces[0])
    return [''.join(''.join(p[y]) for p in pieces) for y in range(h)]


# 회벽 얼룩 — 고른 좌표(16 주기)
_FKA_SPECK = {(5, 7): 'r', (11, 10): 'r', (6, 15): 'r', (12, 19): 'r', (4, 23): 'r', (9, 26): 'r',
              (12, 4): 'r', (8, 21): 'r', (6, 11): 't', (10, 24): 't', (3, 18): 'q'}


def _fkA_wall(role, style):
    """반목조 벽 조각 16×32. style 'storey'(가새) | 'timber'(가운데 띠장·무거운 밑 들보)."""
    W, H = 16, 32
    g = [['s'] * W for _ in range(H)]
    for (x, y), ch in _FKA_SPECK.items():
        g[y][x] = ch
    for x in range(W):
        g[0][x], g[1][x] = '1', '2'           # 처마 그늘 = 도리(어두운 나무)
        g[2][x], g[3][x] = 'q', 'r'           # 처마 밑 회벽 그늘
    for y in range(2, H):                     # 조각 경계를 넘는 기둥(x15|x0) + 기둥 오른쪽 그늘
        g[y][15] = g[y][0] = '3'
        if g[y][1] in 'st':
            g[y][1] = 'r'
    if style == 'storey':
        if role == 'm':
            for y in range(3, 28):            # 2:1 가새(왼아래 → 오른위)
                x = 2 + (27 - y) // 2
                g[y][x] = '4'
                if x + 1 < 15:
                    g[y][x + 1] = '2'
        for x in range(W):
            g[28][x], g[29][x] = '4', '2'     # 밑 들보
            g[30][x] = 'C' if x % 8 == 5 else 'D'   # 돌 기초
            g[31][x] = 'B' if x % 8 == 5 else 'C'
    else:
        if role == 'm':
            for x in range(1, 15):
                g[15][x], g[16][x] = '4', '2'  # 가운데 띠장
        for x in range(W):
            g[28][x], g[29][x], g[30][x], g[31][x] = '5', '4', '3', '2'   # 무거운 밑 들보
    if role == 'w':
        for x in range(3, 13):
            g[5][x] = '2'                     # 인방
            g[19][x] = '5'                    # 창턱(밝은 윗면)
            g[20][x] = '3'
        g[19][2] = g[19][13] = '5'
        g[20][2] = g[20][13] = '3'
        for y in range(6, 19):
            g[y][3], g[y][12] = '4', '2'
            for x in range(4, 12):
                g[y][x] = 'H'
            g[y][7] = g[y][8] = '3'           # 가운데 살
        for x in range(4, 12):
            g[6][x] = 'G'                     # 인방 밑 그늘
            g[12][x] = '3'                    # 가로 살
        for x in (4, 9):
            g[7][x] = 'J'                     # 유리 반짝임(드문 한 화소)
        for x in (6, 11):
            g[17][x] = g[18][x] = 'G'
        g[13][4] = g[13][9] = 'I'
    if role == 'd':
        top = 3
        for x in range(3, 13):
            g[top - 1][x] = '2'               # 문 인방
        for y in range(top, H):
            g[y][3], g[y][12] = '4', '2'      # 문틀
            for i, x in enumerate(range(4, 12)):
                g[y][x] = '45434543'[i]       # 널(빛·그늘 번갈아)
            g[y][7] = '2'                     # 널 사이 홈
        g[top][4] = g[top][11] = '2'          # 둥근 문머리 귀
        for x in range(4, 12):
            g[top + 6][x] = g[H - 7][x] = 'M'  # 쇠 띠
            g[H - 1][x] = '2'                 # 문지방 그늘
        g[top + 6][4] = g[H - 7][4] = 'N'
        g[17][10] = '6'                       # 손잡이
    if role == 'l':
        for y in range(2, H):
            g[y][0] = g[y][1] = '.'
            g[y][2], g[y][3] = '4', '3'       # 모서리 기둥(빛 쪽)
    if role == 'r':
        for y in range(2, H):
            g[y][14] = g[y][15] = '.'
            g[y][12], g[y][13] = '3', '2'     # 모서리 기둥(그늘 쪽)
    return g


def _fkA_stone(role):
    """마름돌 벽 조각 16×32 — 돌 8×6 엇갈림, 맨 위 처마 그늘, 맨 아래 어두운 돌 기초."""
    W, H = 16, 32
    g = [['D'] * W for _ in range(H)]
    for y in range(2, 26):
        k, j = (y - 2) // 6, (y - 2) % 6
        for x in range(W):
            i = (x + 2 + 4 * (k % 2)) % 8     # 조각 경계가 돌 한가운데에 오도록
            if j == 5 or i == 7:
                ch = 'B'                      # 줄눈
            elif j == 0 and i in (1, 2):
                ch = 'E'                      # 돌 윗면 빛(드문 두 화소)
            elif j == 0 or (i == 0 and j <= 2):
                ch = 'D'
            elif j >= 3 or i >= 5:
                ch = 'C'                      # 돌 아래·오른 그늘
            else:
                ch = 'D' if (i + j) % 3 else 'C'
            g[y][x] = ch
        if j == 2:
            g[y][(3 + 4 * (k % 2)) % 16] = 'C'  # 고른 얼룩
    for x in range(W):
        g[0][x], g[1][x] = 'A', 'B'           # 처마 그늘
        g[26][x] = 'E' if x not in (5, 13) else 'B'   # 기초 위 턱
        g[27][x] = 'D' if x not in (5, 13) else 'B'
        g[28][x] = 'C' if x not in (5, 13) else 'B'
        g[29][x] = 'B'                        # 기초 = 어두운 돌
        g[30][x] = 'C' if x % 16 not in (3, 11) else 'A'
        g[31][x] = 'A'
    if role == 'w':                           # 작고 깊은 창
        for x in range(4, 12):
            g[6][x], g[7][x] = 'E', 'D'       # 인방돌
            g[18][x], g[19][x] = 'E', 'C'     # 창턱돌
        g[7][11] = 'C'
        for y in range(8, 18):
            g[y][4], g[y][11] = 'E', 'C'      # 문설주 돌
            g[y][5] = 'A'                     # 깊은 옆 그늘
            for x in range(6, 11):
                g[y][x] = 'H'
        for x in range(5, 11):
            g[8][x] = 'A'                     # 깊은 윗 그늘
        for y in range(9, 18):
            g[y][8] = '2'                     # 살
        g[10][6] = 'J'
        g[13][9] = 'I'
        for x in (7, 10):
            g[16][x] = g[17][x] = 'G'
    if role == 'd':                           # 아치 문
        for x in range(4, 12):
            g[2][x] = 'E'                     # 아치 머리돌
        g[3][3] = g[3][12] = 'E'
        g[2][3] = g[2][12] = 'D'
        for y in range(3, H):
            g[y][3] = 'E' if y < 29 else 'C'
            g[y][12] = 'C' if y < 29 else 'B'
        g[2][7] = g[2][8] = 'F'               # 쐐기돌 빛
        for y in range(3, H):
            for i, x in enumerate(range(4, 12)):
                g[y][x] = '45434543'[i]
            g[y][7] = '2'
        g[3][4] = g[3][11] = 'B'              # 아치 귀 그늘
        g[4][4] = g[4][11] = '2'
        for x in range(4, 12):
            g[9][x] = g[H - 7][x] = 'M'
            g[H - 1][x] = '2'
        g[9][4] = g[H - 7][4] = 'N'
        g[17][10] = '6'
    if role == 'l':
        for y in range(2, H):
            g[y][0] = g[y][1] = '.'
            if 2 <= y < 29:
                g[y][2] = 'E' if (y - 2) % 6 != 5 else 'D'   # 모서리 빛
    if role == 'r':
        for y in range(2, H):
            g[y][14] = g[y][15] = '.'
            if 2 <= y < 29:
                g[y][13] = 'C' if (y - 2) % 6 != 5 else 'B'  # 모서리 그늘
    return g


# 기와 — 4px 기와 한 장, 줄마다 2px 엇갈림(16 주기). 맨 윗행 용마루, 맨 아래 처마 띠.
_FKA_SIDE_L = {'e': 'c', 'd': 'c', 'c': 'b', 'b': 'b', 'a': 'a'}
_FKA_SIDE_R = {'e': 'b', 'd': 'b', 'c': 'b', 'b': 'a', 'a': 'a'}


def _fkA_tile(gx, y, H):
    if y == 0:
        return 'e' if gx % 8 == 3 else 'd'    # 용마루 — 짧고 밝은 선
    if y == 1:
        return 'b'                            # 용마루 밑 그늘
    if y == H - 1:
        return 'a'                            # 처마 끝(가장 어둡다)
    k, r = (y - 2) // 4, (y - 2) % 4
    u = (gx + 1 + 2 * (k % 2)) % 4            # 조각 경계(x15|x0)가 기와 한가운데에 오도록
    if y == H - 2:
        return 'cbba'[u]                      # 기와 끝 입술
    eave = y >= H - 6
    if r == 0:
        if u == 0 and (gx + 1 + 2 * (k % 2)) % 16 == 8 and k % 2 == 0 and not eave:
            return 'e'                        # 드문 한 화소 하이라이트
        return ('cbbb' if eave else 'dccb')[u]
    if r == 1:
        return ('bbba' if eave else 'cccb')[u]
    if r == 2:
        return ('bbaa' if eave else 'bcbb')[u]
    return 'baaa'[u]                          # 기와 줄 그늘


def _fkA_roof(H, R):
    """모임지붕 세트 rows — l 32 · m 16 · r 32. R = 용마루 끝 x(l 조각 안)."""
    W = 80

    def end_px(m, gx, y, side):
        if y >= H - 3:
            return _fkA_tile(gx, y, H)
        xs = R if y == 0 else max(0, R - (3 * y) // 2)       # 바깥 실루엣
        xh = R if y == 0 else max(1, R - (y - 1) // 2)       # 모임 사선(2:1)
        if m < xs:
            return '.'
        if y == 0:
            return 'c' if m == R else _fkA_tile(gx, y, H)
        if m == xh:
            return 'a'
        if m == xs:
            if side == 'l':
                return 'd' if xs > 0 else 'c'
            return 'a'
        if m < xh:
            t = _fkA_tile(gx, y, H)
            return (_FKA_SIDE_L if side == 'l' else _FKA_SIDE_R)[t]
        return _fkA_tile(gx, y, H)

    rows = []
    for y in range(H):
        row = []
        for gx in range(W):
            if gx < 32:
                row.append(end_px(gx, gx, y, 'l'))
            elif gx < 48:
                row.append(_fkA_tile(gx, y, H))
            else:
                row.append(end_px(79 - gx, gx, y, 'r'))
        rows.append(''.join(row))
    return rows


def cand_wall_storey_A():
    rows = _fkA_join([_fkA_wall(r, 'storey') for r in 'lmwdr'])
    return dot.grid(rows, _fkA_legend()), {'note': '반목조 회벽 — 경계 기둥·2:1 가새·밑 들보+돌 기초'}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
def cand_wall_storey_B():
    # 청석 줄 1층 — 밝은 마름돌(ashlar) 8px 블록, 4px 엇갈림, 16 주기. 맨 아래 3px 회색 돌 기초.
    L = dot.legend('fantasy-kingdom',
                   a=('ashlar', 0), b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3), e=('ashlar', 4),
                   f=('ashlar', 5), g=('ashlar', 6), s=('stone', 2), t=('stone', 1),
                   k=('slate', 1), K=('slate', 2), i=('iron', 1), o=('iron', 3),
                   w=('wood', 3), W=('wood', 2), v=('wood', 4), x=('wood', 1))
    MORT = (7, 13, 19, 25)
    def body(x, y):
        if y == 0: return 'b'
        if y == 1: return 'c'
        if y == 29: return 's'
        if y == 30: return 't' if x % 8 == 2 else 's'
        if y == 31: return 't'
        if y in MORT: return 'c'
        ci = sum(1 for m in MORT if y > m)
        top = 2 if ci == 0 else MORT[ci - 1] + 1
        bot = (MORT[ci] - 1) if ci < len(MORT) else 28
        jo = 2 if ci % 2 == 0 else 6
        bx = (x - jo) % 8
        if bx == 0: return 'c'
        if y == bot: return 'd'
        if bx == 7: return 'e'
        if y == top and y > 2 and bx <= 3: return 'g'
        return 'e' if (((x - jo) // 8) % 2 + ci) % 3 == 0 else 'f'
    def window(x, y):
        if y == 8 and 4 <= x <= 11: return 'g'
        if y == 9 and 4 <= x <= 11: return 'd'
        if 10 <= y <= 21:
            if x in (4, 11): return 'e' if x == 4 else 'd'
            if 5 <= x <= 10:
                if y == 10 or x == 5: return 'a'
                if x == 8 or y == 15: return 'b'
                if (x, y) in ((6, 11), (6, 12), (9, 16), (9, 17)): return 'K'
                return 'k'
        if y == 22 and 3 <= x <= 12: return 'g'
        if y == 23 and 4 <= x <= 11: return 'c'
        return None
    def door(x, y):
        if y < 4: return None
        if y == 4: return 'g' if 5 <= x <= 10 else None
        if y == 5:
            if x == 4: return 'g'
            if x == 11: return 'e'
            return 'x' if 5 <= x <= 10 else None
        if y == 6:
            if x == 3: return 'g'
            if x == 12: return 'e'
            return 'x' if 4 <= x <= 11 else None
        if x == 2: return 'g'
        if x == 13: return 'd'
        if 3 <= x <= 12:
            if y == 7: return 'x'
            if y in (11, 25): return 'o' if x in (5, 10) else 'i'
            if (x, y) == (10, 18): return 'o'
            if (x, y) == (10, 19): return 'i'
            if x == 3: return 'x'
            if x == 4: return 'v'
            return 'W' if x % 3 == 0 else 'w'
        return None
    def piece(kind):
        rows = []
        for y in range(32):
            r = ''
            for x in range(16):
                if kind == 'l' and x < 2 or kind == 'r' and x > 13:
                    r += '.'; continue
                ch = None
                if kind == 'w': ch = window(x, y)
                if kind == 'd': ch = door(x, y)
                if ch is None:
                    ch = body(x, y)
                    if (kind == 'l' and x == 2 or kind == 'r' and x == 13) and 2 <= y <= 28:
                        ch = 'c' if kind == 'r' else 'd'
                r += ch
            rows.append(r)
        return rows
    parts = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in parts) for y in range(32)]
    return dot.grid(rows, L), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C():
    # 통나무 벽: 4px 통나무 7단, 맨 위 2행 처마 그늘, 맨 아래 2행 돌 기초. 무늬는 16 주기 좌표.
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for x in range(W):
        lx = x % 16
        g[0][x], g[1][x] = 'b', 'c'
        for i in range(7):
            y0 = 2 + 4 * i
            g[y0][x] = 'f' if (lx + 7 * i) % 16 == 6 else 'e'
            g[y0 + 1][x] = 'd' if lx in ((3 + 5 * i) % 16, (11 + 5 * i) % 16) else 'e'
            g[y0 + 2][x] = 'd'
            g[y0 + 3][x] = 'c'
        g[30][x] = 's' if lx in (5, 13) else ('u' if lx in (1, 9) else 't')
        g[31][x] = 's'
    # 왼끝·오른끝: 바깥 2px 투명, 통나무 마구리
    for side in ('l', 'r'):
        for y in range(H):
            for k in range(2):
                g[y][k if side == 'l' else W - 1 - k] = '.'
        cols = (2, 3, 4) if side == 'l' else (77, 76, 75)
        for i in range(7):
            y0 = 2 + 4 * i
            for yy, row in zip(range(y0, y0 + 4), ('dgf', 'egf', 'dfe', 'ccc')):
                for cx, ch in zip(cols, row):
                    g[yy][cx] = ch
    # 창 (x32..47)
    o = 32
    for y in range(8, 22):
        for x in range(3, 13):
            g[y][o + x] = 'b' if x in (3, 12) or y in (8, 21) else 'c'
    for y in range(10, 20):
        for x in range(5, 11):
            ch = 'n'
            if x == 8 or y == 14:
                ch = 'c'
            elif y in (10, 15) or x == 5:
                ch = 'k'
            elif (x, y) in ((6, 11), (9, 16)):
                ch = 'p'
            elif (x + y) % 5 == 0:
                ch = 'o'
            g[y][o + x] = ch
    for x in range(2, 14):
        g[22][o + x] = 'f'
        g[23][o + x] = 'c'
    # 문 (x48..63) — 아래 경계까지
    o = 48
    for y in range(3, 32):
        for x in range(3, 13):
            if x in (3, 12) or y == 3:
                ch = 'b'
            else:
                ch = 'c' if x in (6, 9) else ('e' if x == 4 else 'd')
                if y == 4:
                    ch = 'a'
                if (y in (8, 26) and 4 <= x <= 7) or (x, y) == (10, 18):
                    ch = 'k'
            g[y][o + x] = ch
    leg = dot.legend('fantasy-kingdom', a=('wood', 0), b=('wood', 1), c=('wood', 2), d=('wood', 3),
                     e=('wood', 4), f=('wood', 5), g=('wood', 6), s=('stone', 1), t=('stone', 2),
                     u=('stone', 3), k=('iron', 0), n=('slate', 1), o=('slate', 2), p=('slate', 3))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_storey_C

# >>> cand_band_trim_A
def cand_band_trim_A():
    """층 띠 = 도리 + 짧은 기와 차양(처마돌림)."""
    rows = []
    for y in range(16):
        row = []
        for gx in range(48):
            ch = '4' if y == 0 else '2' if y == 1 else _fkA_tile(gx, y, 16)
            if gx == 0 and 2 <= y < 14:
                ch = 'c'                      # 왼끝 빛
            if gx == 47 and 2 <= y < 15:
                ch = 'a'                      # 오른끝 그늘
            row.append(ch)
        rows.append(''.join(row))
    return dot.grid(rows, _fkA_legend()), {'note': '도리 + 기와 차양'}
# <<< cand_band_trim_A

# >>> cand_band_trim_B
def cand_band_trim_B():
    # 층 사이 처마돌림 — 마름돌 선반 + 짧은 청석 덧지붕 + 쇠 물받이 + 아래 벽에 지는 처마 그늘. 16 주기.
    L = dot.legend('fantasy-kingdom',
                   A=('slate', 0), B=('slate', 1), C=('slate', 2), D=('slate', 3),
                   b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3), f=('ashlar', 5), g=('ashlar', 6),
                   i=('iron', 1), j=('iron', 2))
    def px(x, y):
        if y == 0: return 'c'
        if y == 1: return 'g' if x % 8 != 0 else 'f'
        if y == 2: return 'f' if x % 8 != 0 else 'd'
        if y == 3: return 'c'
        if 4 <= y <= 11:
            ry = (y - 4) % 4; c = (y - 4) // 4
            jo = 0 if c % 2 == 0 else 4
            if ry == 3: return 'B'
            if (x - jo) % 8 == 0: return 'B'
            if ry == 0 and (x - jo) % 16 == 2: return 'D'
            return 'C' if c == 0 or ry < 2 else 'B'
        if y == 12: return 'B'
        if y == 13: return 'A'
        if y == 14: return 'j' if x % 8 == 3 else 'i'
        return 'b'
    def piece(kind):
        rows = []
        for y in range(16):
            r = ''
            for x in range(16):
                ch = px(x, y)
                if kind == 'l' and x == 0 and 4 <= y <= 13: ch = 'B'
                if kind == 'r' and x == 15 and 4 <= y <= 13: ch = 'A'
                r += ch
            rows.append(r)
        return rows
    parts = [piece(k) for k in 'lmr']
    rows = [''.join(p[y] for p in parts) for y in range(16)]
    return dot.grid(rows, L), {}
# <<< cand_band_trim_B

# >>> cand_band_trim_C
def cand_band_trim_C():
    # 층 사이 너와 차양: 위 들보 → 너와 2단 → 처마 끝 → 아래 벽 그늘.
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    for x in range(W):
        lx = x % 16
        col = ['b', 'f', 'e',
               'g' if lx in (2, 11) else 'D',
               'C' if lx in (0, 8) else 'D', 'C', 'B',
               'D' if lx not in (4, 12) else 'C',
               'C' if lx in (4, 12) else 'D', 'C', 'B',
               'B', 'A', 'A', 'a', 'b']
        for y in range(H):
            g[y][x] = col[y]
    for y in range(3, 14):
        g[y][0] = 'B' if y < 12 else 'A'
        g[y][W - 1] = 'A'
    leg = dot.legend('fantasy-kingdom', a=('timber', 1), b=('timber', 2), e=('timber', 4), f=('timber', 5),
                     g=('shingle', 5), A=('shingle', 0), B=('shingle', 1), C=('shingle', 2), D=('shingle', 3))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_band_trim_C

# >>> cand_roof_hip_A
def cand_roof_hip_A():
    return dot.grid(_fkA_roof(48, 22), _fkA_legend()), {'note': '3행 모임지붕 — 2:1 모임 사선, 용마루 짧고 밝게'}
# <<< cand_roof_hip_A

# >>> cand_roof_hip_B
def cand_roof_hip_B():
    # 청석 슬레이트 모임지붕 3행 — 용마루 밝은 줄, 사면 중간 단, 끝 조각 모임 사선 + 바깥 그늘 삼각, 처마 쇠 물받이.
    H = 48
    L = dot.legend('fantasy-kingdom',
                   A=('slate', 0), B=('slate', 1), C=('slate', 2), D=('slate', 3), i=('iron', 1))
    RX = 18
    def xo(y):  # 바깥 실루엣 — 위 (6,2) → 처마 모서리 (0,H-4)
        return round(6 - 6 * (y - 2) / (H - 6))
    def xh(y):  # 모임 사선 — 용마루 끝 (RX,2) → 처마 모서리 (1,H-4)
        return round(RX - (RX - 1) * (y - 2) / (H - 6))
    def face(x, y):  # 겹친 슬레이트 — 줄 맨 아래 가장 어두운 선, 이음은 위 2행만, 장마다 아래 행 명암 갈림
        c = (y - 1) // 4; ry = (y - 1) % 4
        jo = 0 if c % 2 == 0 else 4
        bx = (x - jo) % 8
        if ry == 3: return 'A' if bx != 4 else 'B'
        if bx == 0 and ry < 2: return 'B'
        if ry == 0 and (x - jo) % 16 == 2 and y < H - 10: return 'D'
        if ry == 2: return 'B' if ((x - jo) // 8 + c) % 2 == 0 or y >= H - 12 else 'C'
        return 'C'
    def px(x, y, kind, W):
        if y >= H - 4:
            if y == H - 4: return 'B'
            if y == H - 3: return 'A' if x % 4 == 2 else 'B'
            if y == H - 2: return 'A'
            return 'i'
        g = x if kind != 'r' else W - 1 - x
        if kind == 'm' or g > RX:
            if y == 0: return 'B'
            if y == 1: return 'C' if x % 4 == 3 else 'D'
            if y == 2: return 'A'
            return face(x, y)
        if y < 2: return '.'
        if g == RX and y <= 2: return 'C'
        if g < xo(y): return '.'
        h = xh(y)
        if g == h: return 'A'
        if g < h:
            if kind == 'l':
                if y % 4 == 0: return 'A'
                return 'C' if y % 4 == 1 and (g + y // 4) % 3 != 0 else 'B'
            if y % 4 == 0: return 'A'
            return 'B' if y % 4 == 1 or (y % 4 == 2 and g % 3 == 0) else 'A'
        if y == 2: return 'A'
        return face(x, y)
    def piece(kind, W):
        return [''.join(px(x, y, kind, W) for x in range(W)) for y in range(H)]
    parts = [piece('l', 32), piece('m', 16), piece('r', 32)]
    rows = [''.join(p[y] for p in parts) for y in range(H)]
    return dot.grid(rows, L), {}
# <<< cand_roof_hip_B

# >>> cand_roof_hip_C
def cand_roof_hip_C():
    # 너와 모임지붕 3행: 용마루(위) → 앞 사면 너와 4px 단 → 처마 띠(가장 어둡다). 끝 조각에 모임 사선.
    W, H, RX, EC = 80, 48, 16, 6
    top = H - 5  # 이 행부터 5행이 처마 띠
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        sil = round(RX * (1 - y / top)) if y < top else 0
        hip = round(RX + (EC - RX) * (y - 2) / (top - 2)) if 2 <= y < top else -1
        for x in range(W):
            mx = min(x, W - 1 - x)
            if mx < sil:
                continue
            lx = x % 16
            if y >= top:
                ch = ('c', 'b', 'b', 'a', 'a')[y - top] if y > top or lx not in (3, 11) else 'B'
                if y == top + 1 and lx in (0, 8):
                    ch = 'a'
            elif y < 3 and mx >= RX:
                ch = ('d', 'f', 'c')[y]
                if y == 1 and lx in (5, 13):
                    ch = 'g'
            elif mx < hip:
                # 모임 사면(끝 삼각): 왼쪽은 그늘, 오른쪽은 더 짙은 그늘
                r = (y - 3 + (hip - mx) // 2) % 4
                up = y < H - 16
                if x < W // 2:
                    ch = ('c' if r == 3 else 'd') if up else ('b' if r == 3 else 'c')
                else:
                    ch = ('b' if r == 3 else 'c') if up else ('a' if r == 3 else 'b')
            elif mx == hip:
                ch = 'b' if x < W // 2 else 'a'
            else:
                c, r = divmod(y - 3, 4)
                hi = y < H - 16  # 맨 아래 칸 행만 한 단 어둡게 — 윗면이 처마보다 밝다
                if r == 0:
                    ch = 'e' if (lx + 5 * c) % 16 == 3 else 'd'
                elif r == 3:
                    ch = 'b'
                elif (lx + 4 * (c % 2)) % 8 == 0:
                    ch = 'c' if hi else 'b'
                else:
                    ch = 'd' if hi else 'c'
                if x >= W // 2 and mx - hip <= 1 and r != 3:
                    ch = 'b'
            g[y][x] = ch
    leg = dot.legend('fantasy-kingdom', a=('shingle', 0), b=('shingle', 1), c=('shingle', 2),
                     d=('shingle', 3), e=('shingle', 5), f=('shingle', 4), g=('shingle', 6), B=('wood', 3))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_hip_C

# >>> cand_wall_stone_A
def cand_wall_stone_A():
    rows = _fkA_join([_fkA_stone(r) for r in 'lmwdr'])
    return dot.grid(rows, _fkA_legend()), {'note': '마름돌 8×6 엇갈림 · 깊은 창 · 아치 문'}
# <<< cand_wall_stone_A

# >>> cand_wall_stone_B
def cand_wall_stone_B():
    # 1층 돌벽 — 회색 큰 마름돌(stone) 6/10px 블록, 16 주기, 작고 깊은 창, 맨 아래 3px 어두운 돌 기초.
    L = dot.legend('fantasy-kingdom',
                   a=('stone', 0), b=('stone', 1), c=('stone', 2), d=('stone', 3), e=('stone', 4), g=('stone', 5),
                   q=('ashlar', 4), p=('ashlar', 3),
                   k=('slate', 1), K=('slate', 2), i=('iron', 1), o=('iron', 3),
                   w=('wood', 3), W=('wood', 2), v=('wood', 4), x=('wood', 1))
    MORT = (8, 15, 22)
    def body(x, y):
        if y == 0: return 'b'
        if y == 1: return 'c'
        if y == 29: return 'c'
        if y == 30: return 'b' if x % 8 == 5 else 'c'
        if y == 31: return 'b'
        if y in MORT: return 'b'
        ci = sum(1 for m in MORT if y > m)
        top = 2 if ci == 0 else MORT[ci - 1] + 1
        bot = (MORT[ci] - 1) if ci < len(MORT) else 28
        jo = (2, 8, 4, 11)[ci]
        bx = (x - jo) % 16
        if bx == 0 or bx == 10: return 'b'
        if y == bot: return 'c'
        if bx in (9, 15): return 'p'
        if y == top and y > 2 and bx in (1, 2, 3, 11, 12): return 'e'
        return 'q' if (bx < 10) == (ci % 2 == 0) else 'd'
    def window(x, y):
        if y == 9 and 5 <= x <= 10: return 'e'
        if y == 10 and 5 <= x <= 10: return 'c'
        if 11 <= y <= 19:
            if x == 5: return 'd'
            if x == 10: return 'c'
            if 6 <= x <= 9:
                if y in (11, 12) or x == 6: return 'a'
                if (x, y) in ((7, 13), (7, 14)): return 'K'
                return 'k'
        if y == 20 and 4 <= x <= 11: return 'g'
        if y == 21 and 5 <= x <= 10: return 'b'
        return None
    def door(x, y):
        if y < 4: return None
        if y == 4: return 'e' if 5 <= x <= 10 else None
        if y == 5:
            if x == 4: return 'e'
            if x == 11: return 'c'
            return 'x' if 5 <= x <= 10 else None
        if y == 6:
            if x == 3: return 'e'
            if x == 12: return 'c'
            return 'x' if 4 <= x <= 11 else None
        if x == 2: return 'd'
        if x == 13: return 'c'
        if 3 <= x <= 12:
            if y == 7: return 'x'
            if y in (11, 25): return 'o' if x in (5, 10) else 'i'
            if (x, y) == (10, 18): return 'o'
            if (x, y) == (10, 19): return 'i'
            if x == 3: return 'x'
            if x == 4: return 'v'
            return 'W' if x % 3 == 0 else 'w'
        return None
    def piece(kind):
        rows = []
        for y in range(32):
            r = ''
            for x in range(16):
                if kind == 'l' and x < 2 or kind == 'r' and x > 13:
                    r += 'b' if y == 0 else '.'; continue
                ch = None
                if kind == 'w': ch = window(x, y)
                if kind == 'd': ch = door(x, y)
                if ch is None:
                    ch = body(x, y)
                    if (kind == 'l' and x == 2 or kind == 'r' and x == 13) and 2 <= y <= 28:
                        ch = 'b' if kind == 'r' else 'c'
                r += ch
            rows.append(r)
        return rows
    parts = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in parts) for y in range(32)]
    return dot.grid(rows, L), {}
# <<< cand_wall_stone_B

# >>> cand_wall_stone_C
def cand_wall_stone_C():
    # 마름돌 1층: 4px 단(돌 3 + 줄눈 1) 7단, 8px 돌을 단마다 반 칸 엇갈림. 맨 위 그늘, 맨 아래 어두운 기초.
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for x in range(W):
        lx = x % 16
        g[0][x], g[1][x] = 'a', 'b'
        for i in range(7):
            y0 = 2 + 4 * i
            sx = (lx + 4 * (i % 2)) % 16
            bx, k = divmod(sx, 8)
            body = 'd' if (bx + i) % 3 else 'e'
            for r in range(3):
                ch = body
                if k == 0:
                    ch = 'b'
                elif r == 0 or k == 1:
                    ch = 'f'
                elif k == 7 or r == 2:
                    ch = 'c'
                g[y0 + r][x] = ch
            g[y0 + 3][x] = 'b'
        g[30][x] = 'b' if lx in (6, 14) else 'c'
        g[31][x] = 'a'
    for y in range(1, H):
        for k in range(2):
            g[y][k] = '.'
            g[y][W - 1 - k] = '.'
    for y in range(2, 30):
        g[y][2] = 'f' if y % 4 != 1 else 'b'
        g[y][77] = 'c' if y % 4 != 1 else 'a'
    # 작고 깊은 창 (x32..47)
    o = 32
    for x in range(4, 12):
        g[8][o + x] = 'g'
        g[9][o + x] = 'e'
    for y in range(10, 20):
        for x in range(5, 11):
            if x == 5 or y == 10:
                ch = 'a'
            elif x == 10:
                ch = 'c'
            else:
                ch = 'n' if (x + y) % 6 else 'o'
                if (x, y) == (7, 12):
                    ch = 'p'
                if x == 8:
                    ch = 'k'
            g[y][o + x] = ch
    for x in range(4, 12):
        g[20][o + x] = 'f'
        g[21][o + x] = 'c'
    # 문 (x48..63): 돌 아치 문틀 + 나무 널문, 아래 경계까지
    o = 48
    for y in range(3, 32):
        for x in range(2, 14):
            edge = x in (2, 3, 12, 13) or y in (3, 4)
            if y == 3 and x in (2, 13):
                continue
            if edge:
                ch = 'g' if (x in (2, 3) or y == 3) else 'c'
                if y % 4 == 1 and x in (2, 3, 12, 13):
                    ch = 'b'
            else:
                ch = 'w' if x in (7, 10) else ('x' if x == 4 else 'v')
                if y == 5:
                    ch = 'u'
                if (y in (9, 26) and 4 <= x <= 8) or (x, y) == (10, 18):
                    ch = 'k'
            g[y][o + x] = ch
    leg = dot.legend('fantasy-kingdom', a=('ashlar', 0), b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3),
                     e=('ashlar', 4), f=('ashlar', 5), g=('ashlar', 6), k=('iron', 0), n=('slate', 1),
                     o=('slate', 2), p=('slate', 3), u=('wood', 0), v=('wood', 3), w=('wood', 2), x=('wood', 4))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_stone_C

# >>> cand_wall_timber_A
def cand_wall_timber_A():
    rows = _fkA_join([_fkA_wall(r, 'timber') for r in 'lmwdr'])
    return dot.grid(rows, _fkA_legend()), {'note': '반목조 — 가운데 띠장·무거운 밑 들보'}
# <<< cand_wall_timber_A

# >>> cand_wall_timber_B
def cand_wall_timber_B():
    # 2층 반목조 — 크림 회벽 + 짙은 기둥(16 주기 x0-1), 가운데 띠장, 아래칸 가새, 맨 아래 들보 2행.
    L = dot.legend('fantasy-kingdom',
                   p=('plaster', 0), q=('plaster', 1), r=('plaster', 2), s=('plaster', 3),
                   a=('timber', 1), b=('timber', 2), c=('timber', 3), d=('timber', 4), e=('timber', 5),
                   k=('slate', 1), K=('slate', 2), i=('iron', 1), o=('iron', 3),
                   w=('wood', 3), W=('wood', 2), v=('wood', 4), x=('wood', 1))
    def wall(x, y, kind):
        if y == 0: return 'b'
        if y == 1: return 'p'
        if y == 2: return 'c'
        if y == 15: return 'd'
        if y == 16: return 'b'
        if y == 29: return 'c'
        if y == 30: return 'b'
        if y == 31: return 'a'
        px_ = x % 16
        if px_ == 7: return 'd'
        if px_ == 8: return 'b'
        if kind == 'm' and 17 <= y <= 28:
            dx = px_ - (9 + (28 - y) // 2)
            if dx in (0, 1): return 'c' if dx == 0 else 'b'
        if y in (3, 17): return 'p'
        if (px_ * 7 + y * 5) % 23 == 0: return 'q'
        if px_ == 9: return 's'
        return 'r'
    def window(x, y):
        if y == 4 and 3 <= x <= 12: return 'c'
        if 5 <= y <= 13:
            if x in (3, 12): return 'c' if x == 3 else 'b'
            if 4 <= x <= 11:
                if y == 5 or x == 4: return 'a'
                if x == 8 or y == 9: return 'b'
                if (x, y) in ((5, 6), (5, 7), (9, 10), (9, 11)): return 'K'
                return 'k'
        if y == 14 and 2 <= x <= 13: return 'e'
        return None
    def door(x, y):
        if y == 3 and 2 <= x <= 13: return 'c'
        if y == 4 and 2 <= x <= 13: return 'b'
        if y >= 5:
            if x == 2: return 'd'
            if x == 13: return 'b'
            if 3 <= x <= 12:
                if y == 5: return 'x'
                if y in (10, 25): return 'o' if x in (5, 10) else 'i'
                if (x, y) == (10, 18): return 'o'
                if (x, y) == (10, 19): return 'i'
                if x == 3: return 'x'
                if x == 4: return 'v'
                return 'W' if x % 3 == 0 else 'w'
        return None
    def piece(kind):
        rows = []
        for y in range(32):
            r = ''
            for x in range(16):
                if kind == 'l' and x < 2 or kind == 'r' and x > 13:
                    r += 'b' if y == 0 else '.'; continue
                ch = None
                if kind == 'w': ch = window(x, y)
                if kind == 'd': ch = door(x, y)
                if ch is None:
                    ch = wall(x, y, kind)
                    if kind == 'l' and x in (2, 3) and 2 <= y <= 31: ch = 'd' if x == 2 else 'b'
                    if kind == 'r' and x in (12, 13) and 2 <= y <= 31: ch = 'c' if x == 12 else 'a'
                r += ch
            rows.append(r)
        return rows
    parts = [piece(k) for k in 'lmwdr']
    rows = [''.join(p[y] for p in parts) for y in range(32)]
    return dot.grid(rows, L), {}
# <<< cand_wall_timber_B

# >>> cand_wall_timber_C
def cand_wall_timber_C():
    # 반목조: 크림 회벽 + 16px 마다 2px 기둥(이음에 걸침), 가운데 띠장, 가새, 맨 아래 들보.
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for x in range(W):
        lx = x % 16
        for y in range(H):
            if y == 0:
                ch = 'b'
            elif y == 1:
                ch = 'A'
            elif y == 2:
                ch = 'c'
            elif y >= 29:
                ch = ('e', 'c', 'b')[y - 29]
            elif lx == 15:
                ch = 'd'
            elif lx == 0:
                ch = 'b'
            elif y in (15, 16):
                ch = 'd' if y == 15 else 'b'
            elif lx == 1 or y in (3, 17):
                ch = 'C'
            else:
                ch = 'C' if (lx * 3 + y * 5) % 23 == 0 else 'D'
            g[y][x] = ch
    # 가운데(x16..31) 가새: 위 칸 '/', 아래 칸 '\'
    for y in range(3, 15):
        x = 16 + 14 - (y - 3) * 13 // 11
        g[y][x], g[y][x + 1] = 'd', 'b'
    for y in range(17, 29):
        x = 16 + 1 + (y - 17) * 12 // 11
        g[y][x], g[y][x + 1] = 'd', 'b'
    # 끝: 바깥 2px 투명 + 모서리 기둥
    for y in range(1, H):
        for k in range(2):
            g[y][k] = '.'
            g[y][W - 1 - k] = '.'
        if y >= 2:
            g[y][2], g[y][3] = 'd', 'c'
            g[y][76], g[y][77] = 'c', 'b'
    # 창 (x32..47): 띠장을 끊고 위아래로 긴 창
    o = 32
    for y in range(5, 22):
        for x in range(4, 12):
            if x in (4, 11) or y in (5, 21):
                ch = 'b'
            elif x == 5 or y == 6:
                ch = 'k'
            elif x == 8 or y == 13:
                ch = 'c'
            else:
                ch = 'n' if (x + y) % 5 else 'o'
                if (x, y) in ((6, 8), (9, 15)):
                    ch = 'p'
            g[y][o + x] = ch
    for x in range(3, 13):
        g[22][o + x] = 'e'
        g[23][o + x] = 'b'
    # 문 (x48..63) — 아래 경계까지
    o = 48
    for y in range(4, 32):
        for x in range(3, 13):
            if x in (3, 12) or y == 4:
                ch = 'b'
            else:
                ch = 'c' if x in (6, 9) else ('f' if x == 4 else 'e')
                if y == 5:
                    ch = 'a'
                if (y in (9, 26) and 4 <= x <= 7) or (x, y) == (10, 18):
                    ch = 'k'
            g[y][o + x] = ch
    leg = dot.legend('fantasy-kingdom', a=('timber', 0), b=('timber', 2), c=('timber', 3), d=('timber', 4),
                     e=('timber', 5), f=('timber', 6), A=('plaster', 0), C=('plaster', 2), D=('plaster', 3),
                     k=('iron', 0), n=('slate', 1), o=('slate', 2), p=('slate', 3))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_wall_timber_C

# >>> cand_roof_hip_low_A
def cand_roof_hip_low_A():
    return dot.grid(_fkA_roof(32, 15), _fkA_legend()), {'note': '2행 낮은 모임지붕 — 같은 기와 줄'}
# <<< cand_roof_hip_low_A

# >>> cand_roof_hip_low_B
def cand_roof_hip_low_B():
    # 청석 슬레이트 낮은 모임지붕 2행 — roof.hip 과 같은 기와 줄·사선 규칙.
    H = 32
    L = dot.legend('fantasy-kingdom',
                   A=('slate', 0), B=('slate', 1), C=('slate', 2), D=('slate', 3), i=('iron', 1))
    RX = 18
    def xo(y):  # 바깥 실루엣 — 위 (6,2) → 처마 모서리 (0,H-4)
        return round(6 - 6 * (y - 2) / (H - 6))
    def xh(y):  # 모임 사선 — 용마루 끝 (RX,2) → 처마 모서리 (1,H-4)
        return round(RX - (RX - 1) * (y - 2) / (H - 6))
    def face(x, y):  # 겹친 슬레이트 — 줄 맨 아래 가장 어두운 선, 이음은 위 2행만, 장마다 아래 행 명암 갈림
        c = (y - 1) // 4; ry = (y - 1) % 4
        jo = 0 if c % 2 == 0 else 4
        bx = (x - jo) % 8
        if ry == 3: return 'A' if bx != 4 else 'B'
        if bx == 0 and ry < 2: return 'B'
        if ry == 0 and (x - jo) % 16 == 2 and y < H - 10: return 'D'
        if ry == 2: return 'B' if ((x - jo) // 8 + c) % 2 == 0 or y >= H - 12 else 'C'
        return 'C'
    def px(x, y, kind, W):
        if y >= H - 4:
            if y == H - 4: return 'B'
            if y == H - 3: return 'A' if x % 4 == 2 else 'B'
            if y == H - 2: return 'A'
            return 'i'
        g = x if kind != 'r' else W - 1 - x
        if kind == 'm' or g > RX:
            if y == 0: return 'B'
            if y == 1: return 'C' if x % 4 == 3 else 'D'
            if y == 2: return 'A'
            return face(x, y)
        if y < 2: return '.'
        if g == RX and y <= 2: return 'C'
        if g < xo(y): return '.'
        h = xh(y)
        if g == h: return 'A'
        if g < h:
            if kind == 'l':
                if y % 4 == 0: return 'A'
                return 'C' if y % 4 == 1 and (g + y // 4) % 3 != 0 else 'B'
            if y % 4 == 0: return 'A'
            return 'B' if y % 4 == 1 or (y % 4 == 2 and g % 3 == 0) else 'A'
        if y == 2: return 'A'
        return face(x, y)
    def piece(kind, W):
        return [''.join(px(x, y, kind, W) for x in range(W)) for y in range(H)]
    parts = [piece('l', 32), piece('m', 16), piece('r', 32)]
    rows = [''.join(p[y] for p in parts) for y in range(H)]
    return dot.grid(rows, L), {}
# <<< cand_roof_hip_low_B

# >>> cand_roof_hip_low_C
def cand_roof_hip_low_C():
    # 낮은 너와 모임지붕 2행 — roof.hip C 와 같은 단·같은 너와 줄, 사면만 짧다.
    W, H, RX, EC = 80, 32, 20, 7
    top = H - 5
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        sil = round(RX * (1 - y / top)) if y < top else 0
        hip = round(RX + (EC - RX) * (y - 2) / (top - 2)) if 2 <= y < top else -1
        for x in range(W):
            mx = min(x, W - 1 - x)
            if mx < sil:
                continue
            lx = x % 16
            if y >= top:
                ch = ('c', 'b', 'b', 'a', 'a')[y - top] if y > top or lx not in (3, 11) else 'B'
                if y == top + 1 and lx in (0, 8):
                    ch = 'a'
            elif y < 3 and mx >= RX:
                ch = ('d', 'f', 'c')[y]
                if y == 1 and lx in (5, 13):
                    ch = 'g'
            elif mx < hip:
                r = (y - 3 + (hip - mx) // 2) % 4
                if x < W // 2:
                    ch = 'b' if r == 3 else 'c'
                else:
                    ch = 'a' if r == 3 else 'b'
            elif mx == hip:
                ch = 'b' if x < W // 2 else 'a'
            else:
                c, r = divmod(y - 3, 4)
                hi = y < H - 16  # 맨 아래 칸 행만 한 단 어둡게 — 윗면이 처마보다 밝다
                if r == 0:
                    ch = 'e' if (lx + 5 * c) % 16 == 3 else 'd'
                elif r == 3:
                    ch = 'b'
                elif (lx + 4 * (c % 2)) % 8 == 0:
                    ch = 'c' if hi else 'b'
                else:
                    ch = 'd' if hi else 'c'
                if x >= W // 2 and mx - hip <= 1 and r != 3:
                    ch = 'b'
            g[y][x] = ch
    leg = dot.legend('fantasy-kingdom', a=('shingle', 0), b=('shingle', 1), c=('shingle', 2),
                     d=('shingle', 3), e=('shingle', 5), f=('shingle', 4), g=('shingle', 6), B=('wood', 3))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_hip_low_C

# >>> cand_roof_spire_A
def cand_roof_spire_A():
    """첨탑 — m 은 1칸 탑용 연필 첨탑, l·r 은 2칸 탑용 반쪽(빛 쪽·그늘 쪽). 주 지붕과 같은 roof 램프."""
    H = 64

    def tone(gx, y, f):
        t = 3 if f < 0.25 else 2 if f < 0.6 else 1 if f < 0.85 else 0
        k, r = (y - 2) // 4, (y - 2) % 4
        if r == 3:
            t -= 1                            # 기와 줄 그늘
        if (gx + 2 * (k % 2)) % 4 == 3:
            t -= 1                            # 기와 사이 홈
        return 'abcd'[max(0, t)]

    def piece(lo_of, n_of, base):
        """base = 이 조각 왼쪽 열의 첨탑 좌표(lo_of·n_of 와 같은 좌표계)."""
        g = []
        for y in range(H):
            lo, n = lo_of(y), n_of(y)
            row = []
            for x in range(16):
                gx = base + x
                if y == H - 1:
                    row.append('a')
                    continue
                if not lo <= gx < lo + n:
                    row.append('.')
                    continue
                f = (gx - lo) / max(n - 1, 1)
                if y == H - 2:
                    ch = ('cbba' if f < 0.5 else 'bbaa')[(gx + 2) % 4]   # 처마 입술
                elif gx == lo and y % 8 == 2:
                    ch = 'e'                  # 빛 쪽 드문 하이라이트
                else:
                    ch = tone(gx, y, f)
                row.append(ch)
            g.append(''.join(row))
        return g

    def hw1(y):
        return 8 if y >= H - 2 else 7 if y >= 24 else 1 + y // 4

    def hw2(y):
        return 16 if y >= H - 2 else 15 if y >= 28 else 1 + y // 2

    l = piece(lambda y: 16 - hw2(y), lambda y: 2 * hw2(y), 0)
    m = piece(lambda y: 8 - hw1(y), lambda y: 2 * hw1(y), 0)
    r = piece(lambda y: 16 - hw2(y), lambda y: 2 * hw2(y), 16)
    l[0] = l[0][:15] + 'e'                    # 끝 꼭지
    m[0] = m[0][:7] + 'e' + m[0][8:]
    rows = [l[y] + m[y] + r[y] for y in range(H)]
    return dot.grid(rows, _fkA_legend()), {'note': '붉은 기와 연필 첨탑 — 왼쪽 빛·오른쪽 그늘'}
# <<< cand_roof_spire_A

# >>> cand_roof_spire_B
def cand_roof_spire_B():
    # 청석 첨탑 — 주 지붕과 같은 slate 램프, 왼쪽 밝고 오른쪽 어두운 4단, 비늘 줄, 쇠 꼭지, 맨 아래 2행 꽉 참.
    L = dot.legend('fantasy-kingdom',
                   A=('slate', 0), B=('slate', 1), C=('slate', 2), D=('slate', 3),
                   i=('iron', 1), j=('iron', 2), o=('iron', 3))
    def px(x, y):
        if y == 0: return 'o' if x == 7 else '.'
        if y in (1, 2): return ('o' if x == 7 else 'j') if x in (7, 8) else '.'
        if y == 3: return 'i' if x in (7, 8) else '.'
        if y >= 58:
            if y == 58: return 'C' if x < 8 else 'B'
            if y == 59: return 'B'
            if y in (60, 61): return 'A' if x % 4 == 1 else 'B'
            if y == 62: return 'A'
            return 'i'
        half = 1 + (y - 4) * 7 // 53
        l0 = 8 - half; r0 = 7 + half
        if x < l0 or x > r0: return '.'
        w = r0 - l0 + 1
        t = (x - l0) / max(1, w - 1)
        if x == r0: return 'A'
        if (y - 4) % 4 == 3: return 'A' if t > 0.5 else 'B'
        if t < 0.2 and w >= 4: return 'D' if y % 8 in (1, 2) else 'C'
        if t < 0.55: return 'C'
        return 'B'
    one = [''.join(px(x, y) for x in range(16)) for y in range(64)]
    rows = [r * 3 for r in one]
    return dot.grid(rows, L), {}
# <<< cand_roof_spire_B

# >>> cand_roof_spire_C
def cand_roof_spire_C():
    # 너와 첨탑 — 각 조각이 폭 1칸 첨탑 하나. 왼쪽 밝은 단 → 오른쪽 어두운 단, 꼭대기 뾰족.
    W, H = 48, 64
    g = [['.'] * W for _ in range(H)]
    eave = H - 4
    for y in range(H):
        hw = 8 if y >= eave else 1 + (y * 7) // eave
        for o in (0, 16, 32):
            for lx in range(8 - hw, 8 + hw):
                x = o + lx
                if y >= eave:
                    ch = ('c', 'b', 'a', 'a')[y - eave]
                elif y < 2:
                    ch = 'g' if lx == 7 else 'c'
                else:
                    t = (lx - (8 - hw)) / (2 * hw)  # 0 = 왼끝, 1 = 오른끝
                    ch = 'f' if t < 0.25 else ('d' if t < 0.5 else ('c' if t < 0.8 else 'b'))
                    if y % 4 == 3:
                        ch = {'f': 'd', 'd': 'c', 'c': 'b', 'b': 'a'}[ch]
                    elif lx == 8 - hw:
                        ch = 'e'
                    elif lx == 7 + hw:
                        ch = 'a'
                g[y][x] = ch
    leg = dot.legend('fantasy-kingdom', a=('shingle', 0), b=('shingle', 1), c=('shingle', 2),
                     d=('shingle', 3), e=('shingle', 5), f=('shingle', 4), g=('shingle', 6))
    return dot.grid([''.join(r) for r in g], leg), {}
# <<< cand_roof_spire_C


CANDIDATES = {
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'band.trim': {'A': cand_band_trim_A, 'B': cand_band_trim_B, 'C': cand_band_trim_C},
    'roof.hip': {'A': cand_roof_hip_A, 'B': cand_roof_hip_B, 'C': cand_roof_hip_C},
    'wall.stone': {'A': cand_wall_stone_A, 'B': cand_wall_stone_B, 'C': cand_wall_stone_C},
    'wall.timber': {'A': cand_wall_timber_A, 'B': cand_wall_timber_B, 'C': cand_wall_timber_C},
    'roof.hip.low': {'A': cand_roof_hip_low_A, 'B': cand_roof_hip_low_B, 'C': cand_roof_hip_low_C},
    'roof.spire': {'A': cand_roof_spire_A, 'B': cand_roof_spire_B, 'C': cand_roof_spire_C},
}

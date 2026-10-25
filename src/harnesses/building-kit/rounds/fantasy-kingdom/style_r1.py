"""building-kit fantasy-kingdom style-r1 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

중세 판타지 왕국 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r1'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_gable_A
def cand_roof_gable_A():
    # 붉은 기와 박공: 용마루 6행(밝은 선) · 사면 32행(기와 8줄, 4px 박자, 줄마다 2px 엇갈림) · 처마 10행(어두운 기와 끝·널).
    # l·r 바깥 3px 은 박공 널(처마 돌출분), 위 바깥 귀퉁이는 사선으로 비운다.
    W, H = 48, 48
    ridge = ['b', 'h', 'c', 'b', 'a', 'a']
    tones = [('h', 'c', 'b', 'a'), ('c', 'c', 'b', 'a'), ('c', 'c', 'b', 'a'),
             ('c', 'c', 'b', 'a'), ('c', 'b', 'a', 'a'), ('c', 'b', 'a', 'a'),
             ('b', 'b', 'a', 'a'), ('b', 'b', 'a', 'a')]
    rows = []
    for y in range(H):
        row = []
        for x in range(W):
            if y < 6:
                ch = ridge[y]
                if y in (2, 3) and x % 8 == 7:
                    ch = 'b'
            elif y < 38:
                k, r = divmod(y - 6, 4)
                hi, base, dk, gap = tones[k]
                u = (x + (2 if k % 2 else 0)) % 4
                if r == 3:
                    ch = gap
                elif r == 0:
                    ch = hi if u == 0 else base
                elif r == 1:
                    ch = gap if u == 3 else base
                else:
                    ch = gap if u == 3 else (dk if u == 2 else base)
            elif y == 38:
                ch = 'z'
            elif y < 42:
                u = x % 4
                ch = 'z' if u == 3 else ('a' if y < 41 else 'z')
                if y == 39 and u == 0:
                    ch = 'b'
            elif y < 44:
                ch = 'z'
            elif y < 46:
                ch = 'z' if y == 44 else 'm'
            else:
                ch = 'n' if y == 46 else 'm'
            row.append(ch)
        # 박공 널: 왼쪽은 빛 받는 단, 오른쪽은 그늘 단. 위 귀퉁이는 사선으로 비운다.
        cut = max(0, 6 - y)
        for x in range(cut):
            row[x] = '.'
            row[W - 1 - x] = '.'
        for i, ch in enumerate(('m', 'p', 'n')):
            row[cut + i] = ch
        for i, ch in enumerate(('o', 'n', 'm')):
            row[W - 3 - cut + i] = ch
        rows.append(''.join(row))
    leg = dot.legend('fantasy-kingdom',
                     z=('roof', 0), a=('roof', 1), b=('roof', 2), c=('roof', 3), h=('roof', 4),
                     m=('timber', 2), n=('timber', 3), o=('timber', 4), p=('timber', 5))
    return dot.grid(rows, leg), {}
# <<< cand_roof_gable_A

# >>> cand_roof_gable_B
def cand_roof_gable_B():
    # 청석 슬레이트: 용마루(밝은 선) · 비늘 사면 11단(위 5단 밝고 아래 어둡게) · 처마(어두운 줄 + 쇠 처마널)
    W, H = 48, 48
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y == 0:
                c = 'b'
            elif y == 1:
                c = 'd'
            elif y == 2:
                c = 'c' if x % 4 == 2 else 'd'
            elif y == 3:
                c = 'c'
            elif y == 4:
                c = 'a'
            elif y < 38:
                # 비늘 슬레이트: 4px 폭·3px 단, 단마다 2px 엇갈림, 아래 끝이 둥글다
                k, rr = divmod(y - 5, 3)
                j = (x + (2 if k % 2 else 0)) % 4
                hi = k < 5
                if rr == 0:
                    c = 'b' if j == 0 else ('d' if j == 1 and hi else 'c')
                elif rr == 1:
                    c = 'b' if j == 0 else ('d' if j == 1 and k < 2 else 'c')
                else:
                    if j in (1, 2):
                        c = 'c' if hi else 'b'
                    else:
                        c = 'b' if hi else 'a'
            elif y < 42:
                r = y - 38
                j = (x + 6) % 8
                if r == 0:
                    c = 'a' if j == 0 else 'c'
                elif r == 3:
                    c = 'b' if j == 4 else 'a'
                else:
                    c = 'a' if j == 0 else 'b'
            elif y == 42:
                c = 'b'
            elif y == 43:
                c = 'a'
            elif y == 44:
                c = 'i'
            elif y == 45:
                c = 'j'
            elif y == 46:
                c = 'j' if x % 8 == 4 else 'k'
            else:
                c = 'm'
            g[y][x] = c
    # 박공 끝: 바깥 위 귀퉁이를 비우고 쇠 널(밝은 왼쪽, 어두운 오른쪽)로 닫는다
    for y in range(44):
        cut = max(0, 5 - y // 2)
        for x in range(cut):
            g[y][x] = '.'
            g[y][W - 1 - x] = '.'
        g[y][cut] = 'i'
        g[y][cut + 1] = 'j'
        g[y][cut + 2] = 'a'
        g[y][W - 1 - cut] = 'k'
        g[y][W - 2 - cut] = 'j'
        g[y][W - 3 - cut] = 'a'
    for y in (44, 45, 46, 47):  # 처마널 모서리
        g[y][0] = 'j' if y < 46 else 'k'
        g[y][W - 1] = 'k' if y < 46 else 'm'
    rows = [''.join(r) for r in g]
    leg = dot.legend('fantasy-kingdom', a=('slate', 0), b=('slate', 1), c=('slate', 2), d=('slate', 3),
                     i=('iron', 3), j=('iron', 2), k=('iron', 1), m=('iron', 0))
    return dot.grid(rows, leg), {}
# <<< cand_roof_gable_B

# >>> cand_roof_gable_C
def cand_roof_gable_C():
    # 너와(나무 널) 박공 지붕 — 용마루 밝은 선 · 널 7줄 사면 · 어두운 처마 널판. l·r 은 널 끝 바지보드.
    leg = dot.legend('fantasy-kingdom',
                     b=('shingle', 1), c=('shingle', 2), d=('shingle', 3), e=('shingle', 4),
                     f=('shingle', 5), g=('shingle', 6),
                     T=('wood', 1), U=('wood', 3), V=('wood', 5), W=('wood', 6))
    W_, H_ = 48, 48
    body = ['f', 'f', 'f', 'e', 'e', 'e', 'd']      # 위 널줄일수록 밝다
    hi = ['g', 'g', 'g', 'f', 'f', 'e', 'e']

    def base(x, y):
        if y == 0:
            return 'd'
        if y <= 3:                                   # 용마루 덮개 — 밝은 선, 덮개 마디
            if x % 8 == 5:
                return 'd' if y == 3 else 'e'
            return 'g' if y in (1, 2) else 'e'
        if y == 4:
            return 'b'
        if y < 40:                                   # 사면: 널 7줄 × 5행, 아래 끝(널 엉덩이)이 빛을 받는다
            k, r = divmod(y - 5, 5)
            u = x % 16
            joints = (2, 7, 12) if k % 2 == 0 else (4, 9, 14)
            if r == 0:
                return 'c' if k < 3 else 'b'
            if r == 4:
                return 'c' if u in joints else hi[k]
            if u in joints:
                return 'c' if r >= 2 else 'd'
            if r == 3 and (u - 2) % 16 in joints:
                return 'd' if k < 4 else 'c'
            if r == 1:
                return 'e' if k < 2 else ('d' if k < 5 else 'c')
            return body[k]
        r = y - 40                                   # 처마 널판
        if r == 0:
            return 'b'
        if r == 1:
            return 'e'
        if r == 2:
            return 'd'
        if r == 7:
            return 'b'
        return 'c'

    def edge(y):                                     # 박공 윤곽 — 위로 갈수록 안쪽
        return max(0, 5 - y // 4)

    rows = []
    for y in range(H_):
        e = edge(y)
        row = []
        for x in range(W_):
            if x < 16:                               # 왼쪽 널 끝(빛 받는 쪽)
                if x < e:
                    row.append('.'); continue
                if x == e:
                    row.append('V' if y < 46 else 'T'); continue
                if x == e + 1:
                    row.append('W' if y < 46 else 'U'); continue
                if x == e + 2:
                    row.append('U' if y < 46 else 'T'); continue
                if x == e + 3 and 4 < y < 40:
                    row.append('b'); continue
            elif x >= 32:                            # 오른쪽 널 끝(그늘)
                xr = 47 - x
                if xr < e:
                    row.append('.'); continue
                if xr == e:
                    row.append('T'); continue
                if xr == e + 1:
                    row.append('U' if y < 46 else 'T'); continue
                if xr == e + 2:
                    row.append('V' if y < 46 else 'U'); continue
            row.append(base(x, y))
        rows.append(''.join(row))
    return dot.grid(rows, leg), {}
# <<< cand_roof_gable_C

# >>> cand_wall_storey_A
def cand_wall_storey_A():
    # 크림 회벽 반목조 한 층(32px): 처마 그늘 2행 · 윗보 · 띠보 · 아랫보, 기둥은 칸 가운데 2px(16 박자).
    # 아래 칸 가새 '/' 는 기둥 사이 판(칸 경계를 넘는다)마다 같은 좌표로 반복 — 어느 순서로 이어도 이어진다.
    # w 는 위 칸 창, d 는 아랫보를 끊고 바닥까지 닿는 문. l·r 바깥 2px 투명, 그 안쪽 3px 모퉁이 기둥.
    W, H = 80, 32
    brace = {19 + i: (9 + 13 - (i * 13 + 4) // 8) % 16 for i in range(9)}
    rows = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            u = x % 16
            if y == 0:
                ch = 'q'
            elif y == 1:
                ch = 'r'
            elif y in (2, 16, 28):
                ch = 'o'
            elif y in (3, 17, 29, 30):
                ch = 'n'
            elif y == 31:
                ch = 'm'
            elif u == 7:
                ch = 'p'
            elif u == 8:
                ch = 'n'
            elif y in (19, 20, 21, 22, 23, 24, 25, 26, 27) and u == brace[y]:
                ch = 'o'
            elif y in (19, 20, 21, 22, 23, 24, 25, 26, 27) and u == (brace[y] + 1) % 16:
                ch = 'n'
            elif u == 9 or y in (4, 18):
                ch = 's'
            else:
                ch = 't'
                if (u * 5 + y * 3) % 11 == 0:
                    ch = 's'
            if y < 2 and u in (7, 8):
                ch = 'm'
            rows[y][x] = ch
    def put(x, y, ch):
        rows[y][x] = ch
    # l·r: 바깥 2px 투명 + 모퉁이 기둥. 모퉁이 옆 판은 가새 없이 회벽.
    for y in range(H):
        for x in (0, 1, 78, 79):
            put(x, y, '.')
        if 4 <= y < 28 and y not in (16, 17):
            for x in range(5, 9):
                put(x, y, 's' if x == 5 or y in (4, 18) else 't')
            for x in range(71, 75):
                put(x, y, 's' if y in (4, 18) else 't')
        for x, ch in ((2, 'n'), (3, 'p'), (4, 'o'), (75, 'o'), (76, 'n'), (77, 'm')):
            put(x, y, 'm' if y < 2 else ch)
    # w(32..47): 위 칸 창 x36..44, y6..14, 창턱 y15
    ox = 32
    for y in range(6, 15):
        for x in range(4, 13):
            edge = y in (6, 14) or x in (4, 12)
            if edge:
                ch = 'n' if (y == 14 or x == 12) else 'o'
            elif x == 8 or y == 10:
                ch = 'n'
            elif x in (5, 6, 9, 10) and y in (7, 11):
                ch = 'g'
            elif x in (5, 9) or y in (7, 11):
                ch = 'f'
            else:
                ch = 'e'
            put(ox + x, y, ch)
    for x in range(3, 14):
        put(ox + x, 15, 'p')
    # d(48..63): 문틀 x50..61, y4..31(바닥 경계까지), 문짝 널 x51..60, 위 귀 둥글게
    ox = 48
    for y in range(3, 32):
        for x in range(2, 14):
            put(ox + x, y, 'p' if y == 3 else ('o' if x == 2 else ('m' if x == 13 else 'n')))
    for y in range(5, 32):
        for x in range(3, 13):
            if y == 5 and x in (3, 12):
                continue
            if x in (5, 8, 11):
                ch = 'j'
            elif x in (3, 6, 9):
                ch = 'l'
            else:
                ch = 'k'
            if y in (11, 25) and x not in (3, 12):
                ch = 'i' if x % 2 else 'v'
            put(ox + x, y, ch)
    put(ox + 10, 18, 'v'); put(ox + 10, 19, 'i')
    rows = [''.join(r) for r in rows]
    leg = dot.legend('fantasy-kingdom',
                     q=('plaster', 0), r=('plaster', 1), s=('plaster', 2), t=('plaster', 3),
                     m=('timber', 2), n=('timber', 3), o=('timber', 4), p=('timber', 6),
                     e=('slate', 1), f=('slate', 2), g=('slate', 3),
                     j=('wood', 2), k=('wood', 3), l=('wood', 4), i=('iron', 2), v=('iron', 3))
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_A

# >>> cand_wall_storey_B
def cand_wall_storey_B():
    # 밝은 마름돌: 처마 그늘 2행 · 5px 단 6줄(8px 돌, 줄마다 4px 엇갈림) · 창(쇠 창살) · 문(아치·쇠 띠)
    W, H = 80, 32
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y == 0:
                c = 'b'
            elif y == 1:
                c = 'c'
            elif y == 31:
                c = 'c'
            else:
                k, r = divmod(y - 2, 5)
                j = (x + (4 if k % 2 else 0)) % 8
                if r == 4 or j == 0:
                    c = 'd'
                elif r == 0 or j == 1:
                    c = 'g'
                elif j == 7 or r == 3:
                    c = 'e'
                else:
                    c = 'f'
                if r == 0 and k == 0:
                    c = 'd' if j else 'c'  # 그늘 바로 밑 단은 한 단 어둡게
            g[y][x] = c
    # 끝 조각: 바깥 2px 투명, 모서리 기둥은 어두운 단
    for y in range(H):
        g[y][0] = g[y][1] = '.'
        g[y][W - 1] = g[y][W - 2] = '.'
        if y >= 2:
            g[y][2] = 'f' if (y - 2) % 5 != 4 else 'd'
            g[y][3] = 'g' if (y - 2) % 5 != 4 else 'd'
            g[y][W - 3] = 'c'
            g[y][W - 4] = 'd'
    # 창 (조각 w, x 32..47)
    ox = 32
    for x in range(ox + 4, ox + 12):
        g[6][x] = 'g'
        g[7][x] = 'e'
        g[24][x] = 'g'
        g[25][x] = 'c'
    for y in range(8, 24):
        for x in range(ox + 5, ox + 11):
            lx = x - ox
            if lx in (5, 10) or y == 8:
                c = 'k'
            elif lx == 6 and y < 13 or (lx == 7 and y == 9):
                c = 'r'
            elif lx == 8:
                c = 'i'
            elif y == 16:
                c = 'i'
            else:
                c = 'p'
            g[y][x] = c
        g[y][ox + 4] = 'e'
        g[y][ox + 11] = 'c'
    # 문 (조각 d, x 48..63): 아치 돌, 나무 널, 쇠 띠
    ox = 48
    arch = {3: (5, 10), 4: (4, 11), 5: (3, 12)}
    for y in range(2, 32):
        lo, hi = arch.get(y, (3, 12)) if y >= 3 else (6, 9)
        g[y][ox + lo - 1] = 'c'
        g[y][ox + hi + 1] = 'c'
        for x in range(ox + lo, ox + hi + 1):
            g[y][x] = 'g' if y < 3 else 'e'
    for y in range(5, 32):
        for x in range(ox + 4, ox + 12):
            lx = x - ox
            if y == 5 and lx in (4, 11):
                continue
            if y in (10, 22):
                c = 'K' if lx in (5, 9) else 'J'
            elif y in (11, 23):
                c = 'k'
            elif lx in (6, 9):
                c = 'w'
            elif lx == 4:
                c = 'W'
            elif lx == 11:
                c = 'w'
            else:
                c = 'v' if (lx % 2 == 0) else 'u'
            g[y][x] = c
    g[17][ox + 10] = 'K'
    g[18][ox + 10] = 'k'
    for x in range(ox + 3, ox + 13):
        g[31][x] = 'c'
    rows = [''.join(r) for r in g]
    leg = dot.legend('fantasy-kingdom', a=('ashlar', 0), b=('ashlar', 1), c=('ashlar', 2), d=('ashlar', 3),
                     e=('ashlar', 4), f=('ashlar', 5), g=('ashlar', 6),
                     i=('iron', 2), k=('iron', 0), J=('iron', 2), K=('iron', 3),
                     p=('slate', 0), r=('slate', 2),
                     u=('wood', 3), v=('wood', 4), w=('wood', 2), W=('wood', 5))
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_B

# >>> cand_wall_storey_C
def cand_wall_storey_C():
    # 통나무 벽 — 처마 그늘 2행 + 통나무 6단(5행 주기). 귀는 엇물린 통나무 끝. 창 하나·널문 하나.
    leg = dot.legend('fantasy-kingdom',
                     b=('wood', 1), c=('wood', 2), d=('wood', 3), e=('wood', 4), f=('wood', 5), g=('wood', 6),
                     H=('slate', 1), I=('slate', 2), J=('slate', 3), K=('iron', 2), L=('iron', 3))
    W_, H_ = 80, 32

    def log(x, y):
        if y == 0:
            return 'b'
        if y == 1:
            return 'c'
        k, r = divmod(y - 2, 5)
        u = (x + 5 * k) % 16
        if r == 4:
            return 'c'
        if r == 0:
            return 'f'
        if r == 3:
            return 'd'
        if r == 2 and u in (3, 4, 5):                # 나뭇결
            return 'd'
        if r == 1 and u in (10, 11):
            return 'f'
        return 'e'

    end_lit = ['dffed', 'fgegd', 'fegfd', 'dffdc', 'ccccc']   # 통나무 끝(빛)
    end_dim = ['cdedc', 'defdc', 'dedec', 'cddcb', 'ccccb']   # 통나무 끝(그늘)

    rows = []
    for y in range(H_):
        row = []
        for x in range(W_):
            p, lx = divmod(x, 16)
            ch = log(x, y)
            if p == 0:                                # l: 바깥 2px 투명, 2~6 통나무 끝
                if lx < 2:
                    ch = '.'
                elif lx <= 6 and y >= 2:
                    k, r = divmod(y - 2, 5)
                    ch = end_lit[r][lx - 2]
                elif lx == 7 and y >= 2:
                    ch = 'c'
            elif p == 4:                              # r: 바깥 2px 투명
                if lx > 13:
                    ch = '.'
                elif lx >= 9 and y >= 2:
                    k, r = divmod(y - 2, 5)
                    ch = end_dim[r][lx - 9]
                elif lx == 8 and y >= 2:
                    ch = 'c'
            elif p == 2:                              # w: 창
                if 6 <= y <= 18 and 3 <= lx <= 12:
                    if y == 6:
                        ch = 'g'
                    elif y == 18:
                        ch = 'd'
                    elif lx == 3:
                        ch = 'g'
                    elif lx == 12:
                        ch = 'd'
                    elif y == 7 or lx == 4:
                        ch = 'c'
                    elif lx == 8 or y == 12:
                        ch = 'f'
                    else:
                        gx = lx - 5 if lx < 8 else lx - 9
                        gy = y - 8 if y < 12 else y - 13
                        ch = 'J' if (gx, gy) in ((0, 0), (1, 0), (0, 1)) else ('I' if gx + gy == 3 else 'H')
                elif y == 19 and 2 <= lx <= 13:
                    ch = 'g'
                elif y == 20 and 2 <= lx <= 13:
                    ch = 'c'
            elif p == 3:                              # d: 널문(바닥까지)
                if 3 <= lx <= 12 and y >= 2:
                    if y == 2:
                        ch = 'g'
                    elif y == 3:
                        ch = 'd'
                    elif lx == 3:
                        ch = 'f'
                    elif lx == 12:
                        ch = 'c'
                    elif y in (9, 25) and 4 <= lx <= 11:
                        ch = 'L' if lx == 4 else 'K'
                    elif lx == 10 and y in (17, 18):
                        ch = 'L'
                    elif lx in (6, 9):
                        ch = 'c'
                    elif lx in (4, 7, 10):
                        ch = 'e'
                    else:
                        ch = 'd'
            row.append(ch)
        rows.append(''.join(row))
    return dot.grid(rows, leg), {}
# <<< cand_wall_storey_C

# >>> cand_base_stone_A
def cand_base_stone_A():
    # 회색 주춧돌 줄: 윗면 2행 · 마름돌 두 단(8px 돌, 단마다 4px 엇갈림, 줄눈은 칸 경계를 피한다) · 맨 아래 어두운 접지 행.
    W, H = 48, 16
    rows = []
    for y in range(H):
        row = []
        for x in range(W):
            if y == 0:
                ch = 'c'
            elif y == 1:
                ch = 'e'
            elif y == 2:
                ch = 'b'
            elif y == 15:
                ch = 'a'
            elif y in (8, 14):
                ch = 'b'
            else:
                top = y < 8
                u = (x + (2 if top else 6)) % 8
                r = y - (3 if top else 9)
                if u == 7:
                    ch = 'b'
                elif r == 0 or u == 0:
                    ch = 'e' if (r == 0 and u < 4) else 'd'
                elif r >= 3 or u == 6:
                    ch = 'b' if (r >= 3 and u == 6) else 'c'
                else:
                    ch = 'd'
            row.append(ch)
        rows.append(row)
    for y in range(1, 15):
        rows[y][0] = 'd'
        rows[y][W - 1] = 'b'
    rows = [''.join(r) for r in rows]
    leg = dot.legend('fantasy-kingdom',
                     a=('ashlar', 1), b=('ashlar', 2), c=('ashlar', 3), d=('ashlar', 4),
                     e=('ashlar', 5))
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_A

# >>> cand_base_stone_B
def cand_base_stone_B():
    # 주춧돌: 갓돌 띠 위 2행 · 큰 돌 두 줄(12px 돌) · 맨 아래 어두운 접지선. 끝은 왼쪽 밝게·오른쪽 어둡게
    W, H = 48, 16
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y == 0:
                c = 'e'
            elif y == 1:
                c = 'd'
            elif y == 2:
                c = 'b'
            elif y == 15:
                c = 'a'
            elif y == 14:
                c = 'b'
            else:
                k = 0 if y < 8 else 1
                r = y - (3 if k == 0 else 8)
                j = (x + (6 if k else 0)) % 12
                if r == 5 or j == 0:
                    c = 'b'
                elif r == 0 or j == 1:
                    c = 'd'
                elif j == 11 or r == 4:
                    c = 'B'
                else:
                    c = 'c'
            g[y][x] = c
    for y in range(H):
        g[y][0] = 'e' if y < 2 else ('d' if y < 14 else 'b')
        g[y][W - 1] = 'b' if y < 14 else 'a'
    rows = [''.join(r) for r in g]
    leg = dot.legend('fantasy-kingdom', a=('stone', 0), b=('stone', 1), B=('stone', 2),
                     c=('stone', 3), d=('stone', 4), e=('stone', 5))
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_B

# >>> cand_base_stone_C
def cand_base_stone_C():
    # 막돌 주춧돌 두 줄 — 위 갓돌 밝게, 아래 2행은 땅에 묻힌 어두운 단.
    leg = dot.legend('fantasy-kingdom',
                     p=('stone', 1), q=('stone', 2), r=('stone', 2), s=('stone', 3), t=('stone', 4))
    W_, H_ = 48, 16
    j1, j2 = (0, 7), (3, 12)                         # 줄마다 이음 자리(16 주기)

    def px(x, y):
        u = x % 16
        if y == 0:
            return 'q'
        if y == 1:
            return 's'
        if y >= 14:
            return 'q' if y == 14 else 'p'
        if 2 <= y <= 7:
            joints, r = j1, y - 2
        else:
            joints, r = j2, y - 8
        if r == 5 or u in joints:
            return 'p'
        if r == 0 or (u - 1) % 16 in joints:
            return 't' if r == 0 and (u - 1) % 16 in joints else 's'
        if r == 4 or (u + 1) % 16 in joints:
            return 'q'
        return 'r'

    rows = []
    for y in range(H_):
        row = []
        for x in range(W_):
            ch = px(x, y)
            if x == 0 and y >= 2:
                ch = 'q' if y < 14 else 'p'
            if x == 47 and y >= 2:
                ch = 'p'
            row.append(ch)
        rows.append(''.join(row))
    return dot.grid(rows, leg), {}
# <<< cand_base_stone_C


CANDIDATES = {
    'roof.gable': {'A': cand_roof_gable_A, 'B': cand_roof_gable_B, 'C': cand_roof_gable_C},
    'wall.storey': {'A': cand_wall_storey_A, 'B': cand_wall_storey_B, 'C': cand_wall_storey_C},
    'base.stone': {'A': cand_base_stone_A, 'B': cand_base_stone_B, 'C': cand_base_stone_C},
}

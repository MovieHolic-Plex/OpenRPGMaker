"""building-kit fantasy-kingdom style-r5 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

중세 판타지 왕국 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r5'
WAVE = 'style'
NOTES = {}

# >>> cand_band_trim_A
def cand_band_trim_A():
    # 2층 들보 밑면 + 돌 처마돌림(윗면 밝게·앞면) + 까치발 줄 + 그 밑 그늘
    leg = dot.legend('fantasy-kingdom', **{'1': ('timber', 1), '2': ('timber', 2),
                                           'A': ('stone', 0), 'B': ('stone', 1), 'C': ('stone', 2),
                                           'D': ('stone', 3), 'E': ('stone', 4)})

    def cell(x, y):
        if y == 0:
            return '2'
        if y == 1:
            return '1'
        if y in (2, 3):
            return 'D' if x % 16 == 10 else 'E'
        if y == 4:
            return 'D'
        if y <= 8:
            return 'B' if x % 16 == 10 else 'D'
        if y == 9:
            return 'C'
        if y <= 12:
            k = x % 8
            if k in (2, 3, 4):
                return ('D', 'C', 'B')[y - 10] if k == 2 else ('C', 'C', 'B')[y - 10] if k == 3 else 'B'
            return 'A'
        return 'A' if y == 13 else 'B'

    rows = []
    for y in range(16):
        l = [cell(x, y) for x in range(16)]
        if 2 <= y <= 9:
            l[0] = 'E'
        elif y >= 10:
            l[0] = l[1] = 'B'
        m = [cell(x, y) for x in range(16)]
        r = [cell(x, y) for x in range(16)]
        if 2 <= y <= 9:
            r[14], r[15] = 'C', 'B'
        elif y >= 10:
            r[14] = r[15] = 'A'
        rows.append(''.join(l + m + r))
    return dot.grid(rows, leg), {}
# <<< cand_band_trim_A

# >>> cand_band_trim_B
def cand_band_trim_B():
    # 층 띠 — 쇠 그늘 · 돌 갓돌 · 마름돌 프리즈 + 쇠 띠쇠 · 아래 돌 몰딩
    rows = [
        'jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj',
        'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
        'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxut',
        'xwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwut',
        'xvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvut',
        'xuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuut',
        'x552555555525555555255555552555555525555555255ut',
        'x4425444l44254444442544l4442544444425444l44254ut',
        'x442544jkj425444444254jkj44254444442544jkj4254ut',
        'x4425444k44254444442544k4442544444425444k44254ut',
        'x4425444k44254444442544k4442544444425444k44254ut',
        'x442544444425444444254444442544444425444444254ut',
        'wvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvut',
        'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwut',
        'wuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuut',
        '222222222222222222222222222222222222222222222222',
    ]
    leg = dot.legend('fantasy-kingdom', **{'2': ('ashlar', 2), '4': ('ashlar', 4), '5': ('ashlar', 5), 'j': ('iron', 1), 'k': ('iron', 2), 'l': ('iron', 3), 't': ('stone', 1), 'u': ('stone', 2), 'v': ('stone', 3), 'w': ('stone', 4), 'x': ('stone', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_band_trim_B

# >>> cand_band_trim_C
def cand_band_trim_C():
    """줄 C 너와 통나무 — 처마돌림 들보 + 장선 머리(나무)."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        'CEFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFCB',
        'CDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEECB',
        'CDDDEEEEEEDEEEEEEEDDEEEEEEDEEEEEEEDDEEEEEEDEEECB',
        'CDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEECB',
        'CDEEEEEDEEEEEDEEEEEEEEEDEEEEEDEEEEEEEEEDEEEEEDCB',
        'CDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEECB',
        'CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCB',
        'CDCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCB',
        'BFEEEBBBBFEEEBBBBFEEEBBBBFEEEBBBBFEEEBBBBFEEEBBB',
        'BEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBB',
        'BEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBBBEDDDBBB',
        'BCCCCBBBBCCCCBBBBCCCCBBBBCCCCBBBBCCCCBBBBCCCCBBB',
        'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_band_trim_C

# >>> cand_extra_chimney_A
def cand_extra_chimney_A():
    # 벽돌 굴뚝 + 돌 갓돌(윗면·연기 구멍) — 빛은 왼쪽 위
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3),
                     A=('stone', 0), B=('stone', 1), C=('stone', 2), D=('stone', 3), E=('stone', 4))
    rows = ['................',
            '................',
            '..DEEEEEEEEEEC..',
            '..EEAAAAAAAADC..',
            '..EDBAAAAAABDC..',
            '..DEEEEEEEEDDC..',
            '..DDDDDDDDDCCB..',
            '..BCCCCCCCCBBB..',
            '...aaaaaaaaaa...']
    for y in range(9, 27):
        ci, rr = (y - 9) // 3, (y - 9) % 3
        row = ['.'] * 16
        for x in range(3, 13):
            if x == 12:
                ch = 'a'
            elif rr == 2:
                ch = 'b' if x == 3 else 'a'
            elif (x - 3 + 2 * (ci % 2)) % 5 == 4:
                ch = 'a'
            elif x <= 7:
                ch = 'd' if rr == 0 and x in (3, 4) else 'c'
            else:
                ch = 'b'
            row[x] = ch
        rows.append(''.join(row))
    rows.append('...aaaaaaaaaa...')
    rows += ['................'] * 4
    return dot.grid(rows, leg), {}
# <<< cand_extra_chimney_A

# >>> cand_extra_chimney_B
def cand_extra_chimney_B():
    # 마름돌 굴뚝 — 갓돌 윗면·그을음 구멍, 쇠 띠, 밑동 쇠 물받이(지붕 위)
    rows = [
        '...vwwwwwwwv....',
        '..vxxxxxxxxwv...',
        '..xwiiiiiijwu...',
        '..xwiiiiiijwu...',
        '..xxwwwwwwwvu...',
        '..wwwwwwwwvvu...',
        '...uuuuuuuut....',
        '...6556553233...',
        '...6556553232...',
        '...6556553232...',
        '...3333333332...',
        '...6553556232...',
        '...6553556232...',
        '...6553556232...',
        '...3333333332...',
        '...6556553232...',
        '...jkkkkkkjjj...',
        '...6556553232...',
        '...3333333332...',
        '...6553556232...',
        '...6553556232...',
        '...6553556232...',
        '...3333333332...',
        '...6556553232...',
        '...6556553232...',
        '...6556553232...',
        '...3333333332...',
        '...6553556232...',
        '..kllkkkkkkjjj..',
        '..kkkkkkkkkjjj..',
        '..jjjjjjjjjjjj..',
        '..jjjjjjjjjjjj..',
    ]
    leg = dot.legend('fantasy-kingdom', **{'2': ('ashlar', 2), '3': ('ashlar', 3), '5': ('ashlar', 5), '6': ('ashlar', 6), 'i': ('iron', 0), 'j': ('iron', 1), 'k': ('iron', 2), 'l': ('iron', 3), 't': ('stone', 1), 'u': ('stone', 2), 'v': ('stone', 3), 'w': ('stone', 4), 'x': ('stone', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_extra_chimney_B

# >>> cand_extra_chimney_C
def cand_extra_chimney_C():
    """줄 C 너와 통나무 — 막돌 굴뚝 · 밝은 갓돌 윗면 · 밑동 너와 접합."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '....eeeeeeee....',
        '...eeaaaaaaee...',
        '...edaaaaaadd...',
        '...eddddddddc...',
        '...ccccccccccb..',
        '....bbbbbbbb....',
        '....eddbeddc....',
        '....dddbdddc....',
        '....cccbcccb....',
        '....bbbbbbbb....',
        '....eddddbec....',
        '....dddddbdc....',
        '....cccccbcb....',
        '....bbbbbbbb....',
        '....eddbeddc....',
        '....cccbcccb....',
        '....bbbbbbbb....',
        '....eddddbec....',
        '....dddddbdc....',
        '....cccccbcb....',
        '....bbbbbbbb....',
        '....eddbeddc....',
        '....dddbdddc....',
        '....cccbcccb....',
        '....bbbbbbbb....',
        '....eddddbec....',
        '....dddddbdc....',
        '....cccccbcb....',
        '....bbbbbbbb....',
        '....cccccccb....',
        '...1bbbbbbbb0...',
        '...1111111100...',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_extra_chimney_C

# >>> cand_roof_hip_A
def cand_roof_hip_A():
    # 붉은 비늘 기와 모임지붕 — 짧고 밝은 용마루, 사면은 처마 쪽으로 어두워지고, 끝 조각에 모임 사선과 그늘 삼각
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3), e=('roof', 4))
    W, H = 80, 48

    def slope(x, y):
        if y == 0:
            return 'b'
        if y == 1:
            return 'e' if x % 4 == 1 else 'd'
        if y == 2:
            return 'b' if x % 4 == 0 else 'c'
        if y == 3:
            return 'a'
        if y == 44:
            return 'c' if x % 4 < 2 else 'b'
        if y == 45:
            return 'a' if x % 4 == 3 else 'b'
        if y >= 46:
            return 'a'
        ci, rr = (y - 4) // 4, (y - 4) % 4
        xs = x + 2 * (ci % 2)
        xx = xs % 4
        if rr == 3:
            lvl = 'g' if xx in (3, 0) else 'l'
        elif rr == 0:
            lvl = 'h' if xs % 8 == 0 else 'm' if xx < 3 else 'l'
        elif rr == 1:
            lvl = 'm' if xx < 3 else 'l'
        else:
            lvl = 'm' if xx < 2 else 'l'
        tone = ({'h': 'd', 'm': 'c', 'l': 'b', 'g': 'a'},
                {'h': 'c', 'm': 'c', 'l': 'b', 'g': 'a'},
                {'h': 'c', 'm': 'b', 'l': 'b', 'g': 'a'})[0 if ci < 3 else 1 if ci < 7 else 2]
        return tone[lvl]

    sil = [20, 19, 17, 16, 15, 13, 12, 11, 9, 8, 7, 5, 4, 3, 1]          # 뒤 모임 사선(윤곽) 시작
    hip = []
    for hx, n in ((20, 2), (19, 3), (18, 2), (17, 2), (16, 3), (15, 2), (14, 2), (13, 3), (12, 2), (11, 2),
                  (10, 3), (9, 2), (8, 2), (7, 3), (6, 2), (5, 2), (4, 3), (3, 2), (2, 2)):
        hip += [hx] * n                                                       # 앞 모임 사선, 0~43행

    def end(xm, x, y, dark):
        s = sil[y] if y < len(sil) else 0
        if xm < s:
            return '.'
        if y >= 44:
            return slope(x, y)
        h = hip[y]
        if xm < h:
            if xm == s:
                return 'a'
            return (('a', 'b') if dark else ('b', 'c'))[xm % 4 == 1]
        if xm == h:
            return 'a'
        return slope(x, y)

    rows = []
    for y in range(H):
        row = [end(x, x, y, False) for x in range(32)]
        row += [slope(x, y) for x in range(16)]
        row += [end(31 - x, x, y, True) for x in range(32)]
        rows.append(''.join(row))
    return dot.grid(rows, leg), {}
# <<< cand_roof_hip_A

# >>> cand_roof_hip_B
def cand_roof_hip_B():
    # 청석 모임지붕 — 밝은 용마루, 위 두 칸 밝은 기와 줄, 아래 처마 앞면 어둡게, 양끝 모임 사선 밖 그늘 쐐기
    rows = [
        '..........DCCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDDD..........',
        '..........DCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDD..........',
        '..........DCCACBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBDDD..........',
        '..........DCCACBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBDDD..........',
        '.........DCCCACBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBDDDD.........',
        '.........DCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDD.........',
        '.........DCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDD.........',
        '.........DCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDD.........',
        '........DCCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDDD........',
        '........DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD........',
        '........DCCABBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBDDD........',
        '........DCCABBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBDDD........',
        '.......DCCCABBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBDDDD.......',
        '.......DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD.......',
        '.......DCCCABBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBDDDD.......',
        '.......DCCABBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBDDD.......',
        '......DCCCABBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBDDDD......',
        '......DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD......',
        '......DCCCABBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBDDDD......',
        '......DCCABBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBBDDD......',
        '.....DCCCABBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBBDDDD.....',
        '.....DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD.....',
        '.....DCCCACBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBDDDD.....',
        '.....DCCCACBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBDDDD.....',
        '....DCCCABCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBDDDD....',
        '....DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD....',
        '....DCCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDDD....',
        '....DCCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDDD....',
        '...DCCCCABBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBDDDDD...',
        '...DCCCACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBDDDD...',
        '...DCCCABBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBDDDD...',
        '...DCCCABBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBBCBBBBBBDDDD...',
        '..DDDDDBDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCDDDDD..',
        '..DDDDBCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCDDDD..',
        '..DDDDBCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCDDDD..',
        '..DDDDBCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCDDDD..',
        '.DDDDDBDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCDDDDD.',
        '.DDDDDBCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDDDDD.',
        '.DDDDBCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCCDDDD.',
        '.DDDDBCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCCDDDD.',
        'DDDDDBDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCDDDDD',
        'DDDDDBDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCDDDDD',
        'DDDDDBDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCDDDDD',
        'DDDDBCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCCCDCCCCCDDDD',
        'DDDDBDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCDDDD',
        'DDDDCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCDDDD',
        'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ]
    leg = dot.legend('fantasy-kingdom', **{'A': ('slate', 3), 'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0)})
    return dot.grid(rows, leg), {}
# <<< cand_roof_hip_B

# >>> cand_roof_hip_C
def cand_roof_hip_C():
    """줄 C 너와 통나무 — 너와 모임지붕 — 짧은 밝은 용마루 · 모임 사선 · 짙은 처마."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '.........................103333333333333333333333333301.........................',
        '.......................1110555555555555556555555555550011.......................',
        '....................1111220222222222222222222222222220101111....................',
        '.................1112222203332333233333233333233323333012222111.................',
        '...............11222222220323332333332333332333233333202222122211...............',
        '............11101111101101101110111110111110111011111010000000000111............',
        '..........112221222221220221222122222122222122212222212011101110111111..........',
        '.......111222222222222203323332333332333332333233333233302122212222212111.......',
        '....111222222222222222033332333323333343333233332333334330212222122222222111....',
        '..1111101111011101111100111101110111111011110111011111101000000000000000000011..',
        '01222221222212221222202122221222122222212222122212222221220101110111111011110110',
        '01222222222222222222202333323333233333233332333323333323330122221222221222212210',
        '01222222222222322222033323333343333233332333334333323333233022222221222212222210',
        '01101111011110111110011101111011111011110111101111101111011000000000000000000010',
        '01212222122221222220222212222122222122221222212222212222122200111110111101111010',
        '01222222222222222202333223333223332233322333322333223332233330122211222112222110',
        '01222222222222222203333323332333332333332333233333233333233320222212222212221210',
        '01111110111110111011111011111011101111101111101110111110111110000000000000000010',
        '01222221222221222022222122222122212222212222212221222221222221011011111011111010',
        '01222222222222220233333233333233323333323333323332333332333332302122222122222110',
        '01222222222222203333323333323332333332333332333233333233333233320222212222212210',
        '01111011111011101111101111101110111110111110111011111011111011100000000000000010',
        '01222122222122012222212222212221222221222221222122222122222122212011101111101110',
        '01222222222222033333233333233323333323333323332333332333332333233022122222122210',
        '01222232222220332333334333323333233333433332333323333343333233332302222222212210',
        '01111110111100110111111011110111011111101111011101111110111101110100000000000010',
        '01222221222202221222222122221222122222212222122212222221222212221220111011110110',
        '01222222222033332333332333323333233333233332333323333323333233332333021222212210',
        '01222222222033433332333323333343333233332333334333323333233333433332022212222210',
        '01101111010110111110111101111011111011110111101111101111011110111110100000000010',
        '01212222120221222221222212222122222122221222212222212222122221222221201101111010',
        '01222222203332233322333223333223332233322333322333223332233332233322330112222110',
        '01222222033323333323333323332333332333332333233333233333233323333323333012221210',
        '01111110011110111011111011111011101111101111101110111110111110111011111000000010',
        '01222220222221222122222122222122212222212222212221222221222221222122222101111010',
        '01222220333332333233333233333233323333323333323332333332333332333233333202222110',
        '01222203333233323333323333323332333332333332333233333233333233323333323330212210',
        '01111001111011101111101111101110111110111110111011111011111011101111101110000010',
        '01222022222122212222212222212221222221222221222122222122222122212222212222001110',
        '01220333332333233333233333233323333323333323332333332333332333233333233333202210',
        '01220343333233332333334333323333233333433332333323333343333233332333334333302210',
        '01101110111101110111111011110111011111101111011101111110111101110111111011110010',
        '01202221222212221222222122221222122222212222122212222221222212221222222122220110',
        '01033323333233332333332333323333233333233332333323333323333233332333332333323010',
        '21111121111211112111112111121111211111211112111121111121111211112111112111121110',
        '11111111111111111111111111111111111111111111111111111111111111111111111111111110',
        '11011111011110111101111101111011110111110111101111011111011110111101111101111010',
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_roof_hip_C

# >>> cand_wall_stone_A
def cand_wall_stone_A():
    # 마름돌 한 층 — 8px 돌, 줄마다 4px 엇갈림, 위 처마 그늘, 아래 어두운 기초
    leg = dot.legend('fantasy-kingdom', **{'G': ('ashlar', 0), 'H': ('ashlar', 1), 'I': ('ashlar', 2),
                                           'J': ('ashlar', 3), 'K': ('ashlar', 4), 'L': ('ashlar', 5),
                                           'M': ('ashlar', 6),
                                           '1': ('timber', 1), '2': ('timber', 2), '4': ('timber', 4),
                                           '5': ('timber', 5),
                                           'z': ('slate', 0), 'w': ('slate', 1), 'x': ('slate', 2), 'y': ('slate', 3),
                                           'i': ('iron', 1), 'j': ('iron', 3)})
    courses = [(2, 6), (8, 7), (15, 7), (22, 7)]

    def stone(x, y):
        if y == 0:
            return 'G'
        if y == 1:
            return 'G' if x % 8 == 7 else 'H'
        if y == 29:
            return 'H' if x % 16 in (5, 13) else 'I'
        if y == 30:
            return 'H'
        if y == 31:
            return 'G'
        for ci, (y0, h) in enumerate(courses):
            if y0 <= y < y0 + h:
                rr = y - y0
                bx = (x + 2 + 4 * (ci % 2)) % 8
                if rr == h - 1 or bx == 7:
                    return 'H'
                if rr == 0 or bx == 0:
                    lvl = 2
                elif rr == h - 2 or bx == 6:
                    lvl = 0
                else:
                    lvl = 1
                if lvl == 1 and bx == 2 and rr == 2:
                    lvl = 2
                return 'IJL'[lvl] if ci else 'HIJ'[lvl]
        return 'H'

    def piece(kind):
        out = []
        for y in range(32):
            g = [stone(x, y) for x in range(16)]
            if kind == 'w':
                if y == 5:
                    g[3:13] = ['M'] * 10
                elif y == 6:
                    g[3:13] = ['K'] * 10
                elif 7 <= y <= 20:
                    g[3], g[12] = 'L', 'I'
                    for x in range(4, 12):
                        if y == 7 or x == 4:
                            g[x] = 'z'
                        elif x == 8 or y == 13:
                            g[x] = 'H'
                        else:
                            g[x] = 'w'
                    if y in (9, 10):
                        g[6] = 'y' if y == 9 else 'x'
                    if y == 9:
                        g[7] = 'x'
                    if y == 15:
                        g[6] = 'x'
                elif y == 21:
                    g[3:13] = ['M'] * 10
                elif y == 22:
                    g[3:13] = ['H'] * 10
            if kind == 'd' and y >= 1:
                if y == 1:
                    g[2:14] = ['M'] * 12
                elif y == 2:
                    g[2:14] = ['K'] * 12
                else:
                    g[2], g[13] = 'L', 'I'
                    for x in range(3, 13):
                        if y == 3:
                            g[x] = '1'
                        elif x in (6, 9):
                            g[x] = '2'
                        elif y == 31:
                            g[x] = '2'
                        else:
                            g[x] = '5' if x in (3, 7, 10) else '4'
                    if y in (7, 25):
                        g[3:7] = ['i'] * 4
                    if y in (17, 18):
                        g[11] = 'j'
            if kind == 'l':
                g[0] = g[1] = 'G' if y == 0 else '.'
                if 2 <= y <= 28 and g[2] != 'H':
                    g[2] = 'L'
            if kind == 'r':
                if 2 <= y <= 28:
                    g[13] = 'H'
                g[14] = g[15] = 'G' if y == 0 else '.'
            out.append(g)
        return out

    parts = [piece(k) for k in ('l', 'm', 'w', 'd', 'r')]
    rows = [''.join(sum((p[y] for p in parts), [])) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_stone_A

# >>> cand_wall_stone_B
def cand_wall_stone_B():
    # 마름돌 벽 — 처마 그늘 2행, 6행 단 8px 엇갈림, 돌 기단 3행, 깊은 창, 둥근 아치 판문
    rows = [
        '11111111111111111111111111111111111111111111111111111111111111111111111111111111',
        '22222222222222222222222222222222222222222222222222222222222222222222222222222222',
        '6366666663666666636666666366666663666666636666666366wwwwwwww66666366666663666643',
        '635555555355555553555555535555555355555553555555535wwmmmmmmvv5555355555553555543',
        '63555555535555555355555553555555535555555355555553wwmmmmmmmmvv555355555553555543',
        '63555555535555555355555553555555535555555355555553wmnnoonnoonv555355555553555543',
        '63444444434444444344444443444444434444444344444443wmzoozyoozyv444344444443444443',
        '33333333333333333333333333333333333333333333333333wmzoozyoozyv333333333333333333',
        '66666366666663666666636666666366666663wwww66636666wmzoozyoozyv666666636666666343',
        '6555535555555355555553555555535555555wDDDDv5535555wmzoozyoozyv555555535555555343',
        '655553555555535555555355555553555555wDDCCCDv535555wjlkkjlkkjjv555555535555555343',
        '655553555555535555555355555553555555wDCBCCCv535555wmzoozyoozyv555555535555555343',
        '644443444444434444444344444443444444wDCCjCCv434444wmzoozyoozyv444444434444444343',
        '333333333333333333333333333333333333wDCCjCCv333333wmzoozyoozyv333333333333333333',
        '636666666366666663666666636666666366wDjjjjjv666663wmzoozyoozyv666366666663666643',
        '635555555355555553555555535555555355wDCCjCCv555553wmzoozyoozyv555355555553555543',
        '635555555355555553555555535555555355wDCBjCCv555553wmzoozyoozyv555355555553555543',
        '635555555355555553555555535555555355wDCCjCCv555553wmzoozyolzyv555355555553555543',
        '634444444344444443444444434444444344wDCCjCCv444443wmzoozyokzyv444344444443444443',
        '333333333333333333333333333333333333wDCCjCCv333333wmzoozyoozyv333333333333333333',
        '66666366666663666666636666666366666xxxxxxxxxx36666wmzoozyoozyv666666636666666343',
        '65555355555553555555535555555355555uuuuuuuuuu35555wmzoozyoozyv555555535555555343',
        '65555355555553555555535555555355555553555555535555wmzoozyoozyv555555535555555343',
        '65555355555553555555535555555355555553555555535555wjlkkjlkkjjv555555535555555343',
        '64444344444443444444434444444344444443444444434444wmzoozyoozyv444444434444444343',
        '33333333333333333333333333333333333333333333333333wmzoozyoozyv333333333333333333',
        '63666666636666666366666663666666636666666366666663wmzoozyoozyv666366666663666643',
        '63555555535555555355555553555555535555555355555553wmzoozyoozyv555355555553555543',
        '33333333333333333333333333333333333333333333333333wmnnnnnnnnnv333333333333333333',
        'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvuvvvvvvvvvvvvvvvvvv',
        'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
        'tttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt',
    ]
    leg = dot.legend('fantasy-kingdom', **{'1': ('ashlar', 1), '2': ('ashlar', 2), '3': ('ashlar', 3), '4': ('ashlar', 4), '5': ('ashlar', 5), '6': ('ashlar', 6), 'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0), 'j': ('iron', 1), 'k': ('iron', 2), 'l': ('iron', 3), 'm': ('wood', 1), 'n': ('wood', 2), 'o': ('wood', 3), 't': ('stone', 1), 'u': ('stone', 2), 'v': ('stone', 3), 'w': ('stone', 4), 'x': ('stone', 5), 'y': ('wood', 4), 'z': ('wood', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_wall_stone_B

# >>> cand_wall_stone_C
def cand_wall_stone_C():
    """줄 C 너와 통나무 — 막돌 벽 — 켜 줄눈 엇갈림 · 깊은 창 · 판문 · 짙은 돌 기초."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
        '..eccbecdddddbedcccccbecdddddbedcccccbecdddddbedcceeeeeeeeeeeeedcccccbecdddddc..',
        '..eccbccddddcbddcccccbccddddcbddcccccbccddddcbddccccccccccccccddcccccbccddddcc..',
        '..eccbccddddcbddcccccbccddddcbddcccccbccddddcbddceBCCCCCCCCCCBcdcccccbccddddcc..',
        '..eccbccddddcbddcccccbccddddcbddcccccbccddddcbddceBFECEECEDCDBcdcccccbccddddcc..',
        '..eccbccddddcbddcccccbccddddcbddcccccbccddddcbddceBFECEECEDCDBcdcccccbccddddcc..',
        '..eccbcccccccbcccccccbcccccccbcccccccbcccccccbccceBFECEECEDCDBcccccccbcccccccc..',
        '..cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbeeeeeeeebbbbbeBFECEECEDCDBcbbbbbbbbbbbbbbb..',
        '..eddddddbeddddddbeddddddbeddddddbedaappppdedddddeBxxyxxxEDCDBcddbeddddddbeddc..',
        '..edddddcbddddddcbddddddcbddddddcbddaqqqqqdeddddceBFECEECEDCDBcdcbddddddcbdddc..',
        '..edddddcbddddddcbddddddcbddddddcbddaqrqqqdeddddceBFECEECEDCDBcdcbddddddcbdddc..',
        '..edddddcbddddddcbddddddcbddddddcbddaqqqqqdeddddceBFECEECEDCDBcdcbddddddcbdddc..',
        '..eccccccbcccccccbcccccccbcccccccbccappppqdeccccceBFECEECEDCDBcccbcccccccbcccc..',
        '..cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbaqqqqqdebbbbbeBFECEECEDCDBcbbbbbbbbbbbbbbb..',
        '..edddbeccccccbeddddddbeccccccbeddddaqqqrqdeccbedeBFECEECEDCDBceddddddbecccccc..',
        '..eddcbdccccccbcdddddcbdccccccbcddddaqqqqqdeccbcdeBFECEECEDCDBccdddddcbdcccccc..',
        '..eddcbdccccccbcdddddcbdccccccbcddddaqqqqqdeccbcdeBFECEECEDCDBccdddddcbdcccccc..',
        '..eddcbdccccccbcdddddcbdccccccbcddddaqqqqqdeccbcdeBFECEECEDCzBccdddddcbdcccccc..',
        '..eddcbdccccccbcdddddcbdccccccbcddddeeeeeeeeccbcdeBFECEECEDCxBccdddddcbdcccccc..',
        '..eddcbdccccccbcdddddcbdccccccbcddddccccccccccbcdeBFECEECEDCDBccdddddcbdcccccc..',
        '..ecccbcccccccbcccccccbcccccccbcccccccbcccccccbcceBFECEECEDCDBccccccccbccccccc..',
        '..cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbeBFECEECEDCDBcbbbbbbbbbbbbbbb..',
        '..ebeddddddbeddddddbeddddddbeddddddbeddddddbeddddeBFECEECEDCDBcddddbeddddddbec..',
        '..ebddddddcbddddddcbddddddcbddddddcbddddddcbdddddeBFECEECEDCDBcdddcbddddddcbdc..',
        '..ebddddddcbddddddcbddddddcbddddddcbddddddcbdddddeBxxyxxxEDCDBcdddcbddddddcbdc..',
        '..ebddddddcbddddddcbddddddcbddddddcbddddddcbdddddeBFECEECEDCDBcdddcbddddddcbdc..',
        '..ebddddddcbddddddcbddddddcbddddddcbddddddcbdddddeBFECEECEDCDBcdddcbddddddcbdc..',
        '..ebcccccccbcccccccbcccccccbcccccccbcccccccbccccceBFECEECEDCDBcccccbcccccccbcc..',
        '..cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbeBFECEECEDCDBcbbbbbbbbbbbbbbb..',
        '..ccbcccccccbcccccccbcccccccbcccccccbcccccccbcccceBFECEECEDCDBccccccbcccccccbc..',
        '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBBBBBbbbbbbbbbbbbbbbb..',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_wall_stone_C

# >>> cand_wall_timber_A
def cand_wall_timber_A():
    # 크림 회벽 + 짙은 기둥(조각 경계 2px)·중간 띠장·가새, 위 처마 그늘, 아래 들보
    leg = dot.legend('fantasy-kingdom', **{'p': ('plaster', 0), 'q': ('plaster', 1), 'r': ('plaster', 2),
                                           's': ('plaster', 3),
                                           '1': ('timber', 1), '2': ('timber', 2), '3': ('timber', 3),
                                           '4': ('timber', 4), '5': ('timber', 5),
                                           'z': ('slate', 0), 'w': ('slate', 1), 'x': ('slate', 2), 'y': ('slate', 3),
                                           'i': ('iron', 1), 'j': ('iron', 3)})

    def base(y):
        if y == 0:
            return '2'
        if y in (1, 2):
            return 'p'
        if y == 3:
            return 'q'
        if y == 14:
            return '5'
        if y == 15:
            return '3'
        if y == 16:
            return 'r'
        if y == 29:
            return '4'
        if y == 30:
            return '2'
        if y == 31:
            return '1'
        return 's'

    def post(g, x, y, ch='4'):
        g[x] = '1' if y in (1, 2) else ch if y >= 3 else g[x]

    def piece(kind):
        out = []
        for y in range(32):
            g = [base(y) for _ in range(16)]
            plaster = 3 <= y <= 28 and y not in (14, 15)
            if kind == 'm' and 17 <= y <= 28:                       # 가새 /
                bx = 30 - y
                g[bx], g[bx + 1] = '4', '3'
                if bx + 2 <= 14:
                    g[bx + 2] = 'r'
            if kind == 'w':
                if y == 4:
                    g[2:14] = ['5'] * 12
                elif 5 <= y <= 18:
                    g[3], g[12] = '3', '3'
                    for x in range(4, 12):
                        if x in (7, 8) or y == 11:
                            g[x] = '3'
                        elif y == 5:
                            g[x] = 'z'
                        else:
                            g[x] = 'w'
                    if y in (6, 7, 12):
                        for x in (4, 9) if y != 7 else (4, 9):
                            g[x] = 'y' if y == 6 else 'x'
                        if y == 6:
                            g[5], g[10] = 'x', 'x'
                elif y == 19:
                    g[2:14] = ['5'] * 12
                elif y == 20:
                    g[2:14] = ['2'] * 12
                elif y == 21:
                    g[3:13] = ['r'] * 10
            if kind == 'd' and y >= 1:
                if y == 1:
                    g[2:14] = ['5'] * 12
                elif y == 2:
                    g[2:14] = ['3'] * 12
                else:
                    g[2], g[13] = '4', '3'
                    for x in range(3, 13):
                        if y == 3:
                            g[x] = '1'
                        elif x in (6, 9):
                            g[x] = '2'
                        elif y == 31:
                            g[x] = '2'
                        else:
                            g[x] = '5' if x in (3, 7, 10) else '4'
                    if y in (7, 25):
                        g[3:7] = ['i'] * 4
                    if y in (17, 18):
                        g[11] = 'j'
            if kind != 'l':
                post(g, 0, y)
                if plaster and g[1] == 's':
                    g[1] = 'r'
            if kind != 'r':
                post(g, 15, y)
            if kind == 'l':
                g[0] = g[1] = '1' if y == 0 else '.'
                post(g, 2, y, '5')
                post(g, 3, y)
                if plaster and g[4] == 's':
                    g[4] = 'r'
            if kind == 'r':
                post(g, 12, y)
                post(g, 13, y, '3')
                g[14] = g[15] = '1' if y == 0 else '.'
            out.append(g)
        return out

    parts = [piece(k) for k in ('l', 'm', 'w', 'd', 'r')]
    rows = [''.join(sum((p[y] for p in parts), [])) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_wall_timber_A

# >>> cand_wall_timber_B
def cand_wall_timber_B():
    # 반목조 벽 — 회벽 + 기둥·중인방·버팀대, 처마 그늘, 아래 토대, 판문
    rows = [
        '..FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF..',
        '..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..',
        '..HGrrrrrrrrrrrrrrrrrrrHGrrrrrrrHGrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGGGGGGGGGGGGPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGGGGGGGGGGPPPPPGmmmmmmmmmmFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDDDDDDDDGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCCCGCCCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCBCGCBCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCCCGCCCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGGGGGGGGGGPPPPPGjlkkjlkkjjFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCCCGCCCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCCCGCCCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPGDCCCGCCCGPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPHHHHHHHHHHPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGHHHHHHHHHHHHHHHHHHHHGHHHHHHHHHHFFFFFFFFFFHHHHHGmzyozyozyoFHHHHHHHHHHHHHHHF..',
        '..HGGGGGGGGGGGGGGGGGGGGHGGGGGGGGGGGGGGGGGGGGGGGGGGGmzyozyolyoFGGGGGGGGGGGGGGHF..',
        '..HGrrrrrrrrrrrrrrrrrrrHGrrrrrrrHGrrrrrrrrrrrrrrrrGmzyozyokyoFrrrrrrrrrrrrrrHF..',
        '..HGPPPPPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPPPPPPPPHF..',
        '..HGPPPPPPPPPGHPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPHGPPPPPPPPPHF..',
        '..HGPPPPPPPPGHPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPHGPPPPPPPPHF..',
        '..HGPPPPPPPGHPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPHGPPPPPPPHF..',
        '..HGPPPPPPGHPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPHGPPPPPPHF..',
        '..HGPPPPPGHPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPHGPPPPPHF..',
        '..HGPPPPGHPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGjlkkjlkkjjFPPPPPPPPHGPPPPHF..',
        '..HGPPPGHPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPPPHGPPPHF..',
        '..HGPPGHPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPPPPHGPPHF..',
        '..HGPGHPPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPPPPPHGPHF..',
        '..HGGHPPPPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPPPPPPPPPPGmzyozyozyoFPPPPPPPPPPPPHGHF..',
        '..HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHGmnnnnnnnnnFHHHHHHHHHHHHHHHH..',
        '..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGmnnnnnnnnnFGGGGGGGGGGGGGGGG..',
        '..FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFGvvvvvvvvvvuFFFFFFFFFFFFFFFF..',
    ]
    leg = dot.legend('fantasy-kingdom', **{'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0), 'F': ('timber', 2), 'G': ('timber', 3), 'H': ('timber', 4), 'P': ('plaster', 3), 'j': ('iron', 1), 'k': ('iron', 2), 'l': ('iron', 3), 'm': ('wood', 1), 'n': ('wood', 2), 'o': ('wood', 3), 'r': ('plaster', 2), 'u': ('stone', 2), 'v': ('stone', 3), 'y': ('wood', 4), 'z': ('wood', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_wall_timber_B

# >>> cand_wall_timber_C
def cand_wall_timber_C():
    """줄 C 너와 통나무 — 통나무 벽 — 4행 켜 · 모서리 통나무 머리 · 창 · 판문."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC..',
        '..DFFECFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFEEEEEEEEEEEEFFFFFFFFGFFCDEED..',
        '..EFFDCEEEEDEEEEEEEDDEEEEEEDEEEEEEEDDEEEEEEDEEEEEEBBBBBBBBBBBBEEEEEDDEEEECDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDBCCCCCCCCCCBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBFECEECEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFBFECEECEDCDBFFFFFFFFFFFCDEED..',
        '..EFFDCDDEEEEEDEEEEEEEEDDEEEEEDEEEEEEEEDDEEEEEDEEEBFECEECEDCDBDEEEEEEEEDDCDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDBBBBBBBBBBDDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCBppppppppBCCCCCBxxyxxxEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECFFFFFFFFFFFFFGFFFFFFFFFFFFFFBqqqDDqqrBFFFFFBFECEECEDCDBFFFFFFGFFFFCDEED..',
        '..EFFDCEEEDEEEEEEDDEEEEEEEDEEEEEEDDBqrqDDqqqBEEEEDBFECEECEDCDBEEEDDEEEEEECDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDBqqqDDqqqBDDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCBqqqDDqqqBCCCCCBFECEECEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECFFGFFFFFFFFFFFFFFFGFFFFFFFFFBDDDDDDDDBFFFFFBFECEECEDCDBFFFFFFFFFFFCDEED..',
        '..EFFDCEEEEEEDEEEEEEEDDEEEEEEDEEEEEBqqqDDqqqBDEEEEBFECEECEDCDBEEEEEEEDDEECDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDBqqqDDqrqBDDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCBqqqDDqqqBCCCCCBFECEECEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECFFFFFFFGFFFFFFFFFFFFFFFGFFFFBqqqDDqqqBFGFFFBFECEECEDCzBGFFFFFFFFFFCDEED..',
        '..EFFDCEDDEEEEEEDEEEEEEEDDEEEEEEDEEBBBBBBBBBBEEEDEBFECEECEDCxBEEDEEEEEEEDCDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDFFFFFFFFFFFFDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBFECEECEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGBFECEECEDCDBFFFGFFFFFFFCDEED..',
        '..EFFDCEEEEEDEEEEEEEDDEEEEEEDEEEEEEEDDEEEEEEDEEEEEBFECEECEDCDBEEEEEEDDEEECDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBxxyxxxEDCDBCCCCCCCCCCCBCCBB..',
        '..DFFECGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFBFECEECEDCDBFFFFFFFFFGFCDEED..',
        '..EFFDCEEDDEEEEEEEDEEEEEEDDEEEEEEEDEEEEEEDDEEEEEEEBFECEECEDCDBEEEEDEEEEEECDEDC..',
        '..DEEDCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDBFECEECEDCDBDDDDDDDDDDDCDDCB..',
        '..CDDCBCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBFECEECEDCDBCCCCCCCCCCCBCCBB..',
        '..CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBFECEECEDCDBCCCCCCCCCCCCCCCC..',
        '..BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB..',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_wall_timber_C

# >>> cand_gable_front_A
def cand_gable_front_A():
    # 남쪽을 보는 반목조 박공벽 — 박공널 2px, 크림 회벽, 마룻대공·버팀대·평보, 4칸은 환기창
    leg = dot.legend('fantasy-kingdom', **{'a': ('roof', 0), 'b': ('roof', 1), 'c': ('roof', 2), 'd': ('roof', 3),
                                           'p': ('plaster', 0), 'q': ('plaster', 1), 'r': ('plaster', 2),
                                           's': ('plaster', 3),
                                           '1': ('timber', 1), '2': ('timber', 2), '3': ('timber', 3),
                                           '4': ('timber', 4), '5': ('timber', 5),
                                           'w': ('slate', 1), 'x': ('slate', 2), 'y': ('slate', 3)})

    def lit(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 3 or yy == 3:
            return 'b'
        if xx == 0 and yy == 0:
            return 'd'
        return 'c'

    def shade(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 0 or yy == 3:
            return 'a'
        if xx == 1 and yy == 0 and col % 2 == 0:
            return 'c'
        return 'b'

    def gable(x, y, w, el, beam, post, struts, vent):
        er = w - 1 - el
        if x in (el - 1, er + 1):
            return 'a'
        if x in (el - 2, er + 2):
            return 'b'
        if x < el - 2:
            return 'a' if x == 0 else 'b' if x == 1 else lit(x, y)
        if x > er + 2:
            return 'a' if x >= w - 2 else shade(x, y)
        # 박공벽 안쪽
        if y == beam:
            return '5'
        if y > beam:
            return '3'
        c = w // 2
        if x in (c - 1, c) and post[0] <= y <= post[1]:
            return '4' if x == c - 1 else '3'
        if y == struts[0]:                       # 깃보(collar)
            return '4'
        if y == struts[0] + 1:
            return 'r'
        if vent:
            vx0, vx1, vy0, vy1 = vent
            if vx0 <= x <= vx1 and vy0 <= y <= vy1:
                if x in (vx0, vx1) or y in (vy0, vy1):
                    return '3'
                if (x, y) in ((vx0 + 1, vy0 + 1), (vx0 + 2, vy0 + 1)):
                    return 'y'
                if (x, y) == (vx0 + 1, vy0 + 2):
                    return 'x'
                return 'w'
            if vy0 <= y <= vy1 + 1 and x == vx1 + 1 or y == vy1 + 1 and vx0 + 1 <= x <= vx1 + 1:
                return 'r'
        if x in (el, el + 1):
            return 'p'
        if x == er:
            return 'q'
        if y == beam - 1:
            return 'r'
        return 's'

    g3_el = [25, 24, 22, 21, 19, 18, 16, 15, 13, 12, 10, 9, 7, 6, 4, 2]

    def px(x, y):
        if x < 48:
            if y >= 16:
                return '.'
            return gable(x, y, 48, g3_el[y], 14, (6, 13), (9, 13), None)
        return gable(x - 48, y, 64, 33 - y, 30, (19, 29), (21, 29), (29, 34, 9, 15))

    rows = [''.join(px(x, y) for x in range(112)) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_gable_front_A

# >>> cand_gable_front_B
def cand_gable_front_B():
    # 앞 박공 g3·g4 — 위 모서리는 청석 사면, 쇠 테 박공널, 회벽 삼각 + 대공·보
    rows = [
        'DCBBBCBBBCBBBCBBBCBBBCDljDDCCCDCCCDCCCDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCDljDDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBDDlrrjDDCCDCCCDCCCDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBBBCBBBDlrrjDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCCCCCBBBCCCCCBBBCCDlrPPPPrjDDDCCCDDDDDCCCDDDDDDDCCCCCBBBCCCCCBBBCCCCCBBBCCCDlrrrrjDDDDCCCDDDDDCCCDDDDDCCCDDDDDD',
        'DCBBBCBBBCBBBCBBBDDlrPPHGPPrjDDCCCDCCCDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBBBCBDlrPHGPrjDCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBDDlrPPPPHGPPPPrjDDCDCCCDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBBBCDlrPPHGPPrjDDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCDlrPPPPPPHGPPPPPPrjDDCCCDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBBBDlrPPPHGPPPrjDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCCCCCBBDDlrPPPPPPPHGPPPPPPPrjDDCCDDDDDCCCDDDCBBBCCCCCBBBCCCCCBBBCCCDlrPPPPHGPPPPrjDDDDCCCDDDDDCCCDDDDDCCCDD',
        'DCBBBCBBBCDDlrPPPPPPPPPHGPPPPPPPPPrjDDDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCBDlrPPPPPHGPPPPPrjDCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBDlrPPPPPPPPPPPHGPPPPPPPPPPPrjDCCCDCCCDDDCBBBCBBBCBBBCBBBCBBBCDlrPPPPPPHGPPPPPPrjDDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBDDlrPPPPPPPPPPPPHGPPPPPPPPPPPPrjDDCDCCCDDDCBBBCBBBCBBBCBBBCBBBDlrPPPPPPPHGPPPPPPPrjDCCCDCCCDCCCDCCCDCCCDD',
        'DCCCCDDlrPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPrjDDDDDDDDCCCCCBBBCCCCCBBBCCCDlrPPPPPPPPHGPPPPPPPPrjDDDDCCCDDDDDCCCDDDDDD',
        'DCBBDlrPPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPPrjDCCDDDCBBBCBBBCBBBCBBBCBDlrPPPPPPPPPHGPPPPPPPPPrjDCDCCCDCCCDCCCDCCCDD',
        'DCDDlrPPPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPPPrjDDDDDCBBBCBBBCBBBCBBBCDlrPPPPPPPPPPHGPPPPPPPPPPrjDDCCCDCCCDCCCDCCCDD',
        'DDlrPPPPPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPPPPPrjDDDCBBBCBBBCBBBCBBBDlrPPPPPPPPPPPHGPPPPPPPPPPPrjDCCCDCCCDCCCDCCCDD',
        'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHDCBBBCCCCCBBBCCCDlrPPPPPPPPPPPPHGPPPPPPPPPPPPrjDDDDCCCDDDDDCCCDD',
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFDCBBBCBBBCBBBCBDlHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHjDCDCCCDCCCDCCCDD',
        '................................................DCBBBCBBBCBBBCDlGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGjDDCCCDCCCDCCCDD',
        '................................................DCBBBCBBBCBBBDlrPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPrjDCCCDCCCDCCCDD',
        '................................................DCCCCCBBBCCCDlrPPPPPPPPPPPPPPHGHGGFPPPPPPPPPPPPPPrjDDDDCCCDDDDDD',
        '................................................DCBBBCBBBCBDlrPPPPPPPPPPPPPPHGPHGPGFPPPPPPPPPPPPPPrjDCDCCCDCCCDD',
        '................................................DCBBBCBBBCDlrPPPPPPPPPPPPPPHGPPHGPPGFPPPPPPPPPPPPPPrjDDCCCDCCCDD',
        '................................................DCBBBCBBBDlrPPPPPPPPPPPPPPHGPPPHGPPPGFPPPPPPPPPPPPPPrjDCCCDCCCDD',
        '................................................DCBBBCCCDlrPPPPPPPPPPPPPPHGPPPPHGPPPPGFPPPPPPPPPPPPPPrjDDDDCCCDD',
        '................................................DCBBBCBDlrPPPPPPPPPPPPPPHGPPPPPHGPPPPPGFPPPPPPPPPPPPPPrjDCDCCCDD',
        '................................................DCBBBCDlrPPPPPPPPPPPPPPHGPPPPPPHGPPPPPPGFPPPPPPPPPPPPPPrjDDCCCDD',
        '................................................DCBBBDlrPPPPPPPPPPPPPPHGPPPPPPPHGPPPPPPPGFPPPPPPPPPPPPPPrjDCCCDD',
        '................................................DCCCDlrPPPPPPPPPPPPPPHGPPPPPPPPHGPPPPPPPPGFPPPPPPPPPPPPPPrjDDDDD',
        '................................................DCBDlrPPPPPPPPPPPPPPHGPPPPPPPPPHGPPPPPPPPPGFPPPPPPPPPPPPPPrjDCDD',
        '................................................DCDlrPPPPPPPPPPPPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPPPPPPPPPPPPrjDDD',
        '................................................DDlrPPPPPPPPPPPPPPPPPPPPPPPPPPPHGPPPPPPPPPPPPPPPPPPPPPPPPPPPrjDD',
        '................................................HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
        '................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    ]
    leg = dot.legend('fantasy-kingdom', **{'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0), 'F': ('timber', 2), 'G': ('timber', 3), 'H': ('timber', 4), 'P': ('plaster', 3), 'j': ('iron', 1), 'l': ('iron', 3), 'r': ('plaster', 2)})
    return dot.grid(rows, leg), {}
# <<< cand_gable_front_B

# >>> cand_gable_front_C
def cand_gable_front_C():
    """줄 C 너와 통나무 — 널 박공 정면 — 세로 널 · 짙은 바지보드 ^ · 귀퉁이는 사면 앞 끝."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '4434444434443444443444411222122222122222122212224434444434443444443444443444344112122222122212222212222212221222',
        '2122222122222122212222100100000000000000000000002122222122222122212222212222211001000000000000000000000000000000',
        '32333332333332333233110CC011101110111110111110113233333233333233323333323333310CC0111110111110111011111011111011',
        '4344444344444344431100CECC0011222122222122222122434444434444434443444443444410CECC012221222221222122222122222122',
        '44444344444344434100CCEECFCC0011222221222221222144444344444344434444434444410CEECFC01122222122212222212222212221',
        '222221222221222110CCCFEECFEECC0110000000000000002222212222212221222221222210CFEECFEC0100000000000000000000000000',
        '33333233333233100CEECBBBBFEECFC00111101111101110333332333332333233333233310CCFEECFEEC011111011101111101111101110',
        '444434444434110CCFEECBwwBFEECFECC01112222212221244443444443444344444344410CECFEECFEECC01221222122222122222122212',
        '34444454441100CECFEECBBBBFEECFEECC001132222122223444445444434444344444510CEECFEECFEECFC0122122221222223222212222',
        '122222212100CCEECFEECFEECFEECFEECFCC001000000000122222212222122212222210CFEECFEECFEECFEC010000000000000000000000',
        '2333333110CCCFEECFEECFEECFEECFEECFEECC011111011123333332333323332333310CCFEECFEECFEECFEEC01101110111111011110111',
        '344444100CEECFEECFEECFEECFEECFEECFEECFC0012122223444443444434444344410CECFEECFEECFEECFEECC0122221222221222212222',
        '4443110CCFEECFEECFEECFEECFEECFEECFEECFECC0112232444344443444445444410CEECFEECFEECFEECFEECFC012322221222212222232',
        '221100CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC00110022212222122221222210CFEECFEEBBBBBBBBCFEECFEC01000000000000000000',
        '3100CCFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGCC00113332333323333233310CCFEECFEEBwwwwwwBCFEECFEEC0111110111101111011',
        '10CCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDCC01443344433444433410CECFEECFEEBwCwwCwBCFEECFEECC012211222112222112',
        '................................................44344444344434410CEECFEECFEEBwwwwwwBCFEECFEECFC01212222212221222',
        '................................................2122222122222110CFEECFEECFEEBwCwwCwBCFEECFEECFEC0100000000000000',
        '................................................323333323333310CCFEECFEECFEEBBBBBBBBCFEECFEECFEEC011111011111011',
        '................................................43444443444410CECFEECFEECFEECCCCCCCCCFEECFEECFEECC01222122222122',
        '................................................4444434444410CEECFEECFEECFEECFEECFEECFEECFEECFEECFC0112222212221',
        '................................................222221222210CFEECFEECFEECFEECFEECFEECFEECFEECFEECFEC010000000000',
        '................................................33333233310CCFEECFEECFEECFEECFEECFEECFEECFEECFEECFEEC01111101110',
        '................................................4444344410CECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECC0122122212',
        '................................................344444510CEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFC012212222',
        '................................................12222210CFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEC01000000',
        '................................................2333310CCFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEEC0110111',
        '................................................344410CECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECC012222',
        '................................................44410CEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFEECFC01232',
        '................................................2210CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC0100',
        '................................................310CFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFFFFFFFFFFFFFFGFFC011',
        '................................................10CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDC01',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_gable_front_C

# >>> cand_gable_step_A
def cand_gable_step_A():
    # g5: 계단식 박공(마름돌, 단마다 갓돌) + 뾰족창 · b5: 같은 계단 윤곽의 북쪽 끝, 아래는 지붕 경사
    leg = dot.legend('fantasy-kingdom', **{'a': ('roof', 0), 'b': ('roof', 1), 'c': ('roof', 2), 'd': ('roof', 3),
                                           'e': ('roof', 4),
                                           'C': ('stone', 2), 'E': ('stone', 4),
                                           'H': ('ashlar', 1), 'I': ('ashlar', 2), 'J': ('ashlar', 3),
                                           'K': ('ashlar', 4), 'L': ('ashlar', 5), 'M': ('ashlar', 6),
                                           'z': ('slate', 0), 'w': ('slate', 1), 'y': ('slate', 3)})
    top = [0, 6, 12, 18, 24]
    el = [34, 26, 18, 9, 0]

    def lit(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 3 or yy == 3:
            return 'b'
        if xx == 0 and yy == 0:
            return 'd'
        return 'c'

    def shade(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 0 or yy == 3:
            return 'a'
        if xx == 1 and yy == 0 and col % 2 == 0:
            return 'c'
        return 'b'

    def level(x):
        for k in range(5):
            if el[k] <= x <= 79 - el[k]:
                return k
        return 4

    def slope(x, y):
        if x == 0:
            return 'a'
        if x == 1:
            return 'b'
        if x >= 78:
            return 'a'
        if x == 39:
            return 'd'
        if x == 40:
            return 'c'
        if x == 41:
            return 'a'
        return lit(x, y) if x < 39 else shade(x, y)

    def g5(x, y):
        k = level(x)
        t = top[k]
        if y < t:
            return slope(x, y)
        if y == t:
            return 'E'
        if y == t + 1:
            return 'C'
        if y == 30:
            return 'K'
        if y == 31:
            return 'I'
        # 뾰족창
        if 10 <= y <= 20 and 37 <= x <= 42:
            if y == 20:
                return 'M'
            half = {10: 0, 11: 1}.get(y, 2)
            lo, hi = 39 - half, 40 + half
            if x < lo or x > hi:
                pass
            elif x in (lo, hi) or y == 10:
                return 'M' if x == lo or y == 10 else 'I'
            elif x == lo + 1:
                return 'z'
            elif (x, y) in ((39, 13), (39, 14), (40, 13)):
                return 'y'
            else:
                return 'w'
        if y == t + 2:
            return 'H'
        if x == el[k]:
            return 'L'
        if x == 79 - el[k]:
            return 'H'
        ci, rr = y // 5, y % 5
        bx = (x + 4 * (ci % 2)) % 8
        if rr == 4 or bx == 7:
            return 'H'
        if rr == 0 or bx == 0:
            return 'L'
        if rr == 3 or bx == 6:
            return 'I'
        return 'J'

    def b5(x, y):
        k = level(x)
        t = top[k]
        if y < t:
            return '.'
        if y == t:
            return 'E'
        if y == t + 1:
            return 'C'
        if y in (t + 2, t + 3):
            if x == el[k]:
                return 'L'
            if x == 79 - el[k]:
                return 'H'
            return 'J' if y == t + 2 else 'I'
        if y == t + 4:
            return 'a'
        return slope(x, y)

    rows = [''.join(g5(x, y) if x < 80 else b5(x - 80, y) for x in range(160)) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_gable_step_A

# >>> cand_gable_step_B
def cand_gable_step_B():
    # 계단 박공 g5(앞 마름돌 + 뾰족창)·b5(뒤 계단, 지붕 면이 벽 앞에서 시작)
    rows = [
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD................................................................................',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD................................................................................',
        'DCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBxxxxxxxxxxxxxxxxCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDD................................xxxxxxxxxxxxxxxx................................',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBwwwwwwwwwwwwwwwwCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD................................wwwwwwwwwwwwwwww................................',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBvvvvvvvvvvvvvvvvCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD................................vvvvvvvvvvvvvvvv................................',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBB5555555355555553CCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD................................4444444444444444................................',
        'DCBBBCCCCCBBBCCCCCBBBCCCxxxxxxxx5555555355555553xxxxxxxxDDDCCCDDDDDCCCDDDDDCCCDD........................xxxxxxxx4444444444444444xxxxxxxx........................',
        'DCBBBCBBBCBBBCBBBCBBBCBBwwwwwwww5555555355555553wwwwwwwwCCDCCCDCCCDCCCDCCCDCCCDD........................wwwwwwww444444DDDD444444wwwwwwww........................',
        'DCBBBCBBBCBBBCBBBCBBBCBBvvvvvvvv3333333333333333vvvvvvvvCCDCCCDCCCDCCCDCCCDCCCDD........................vvvvvvvv4444DDBABCDD4444vvvvvvvv........................',
        'DCBBBCBBBCBBBCBBBCBBBCBB66636666666366666663666666636663CCDCCCDCCCDCCCDCCCDCCCDD........................54444444444DBCBABCDCD44444444443........................',
        'DCCCCCBBBCCCCCBBBCCCCCBB65535555555355555553555555535553CCDDDDDCCCDDDDDCCCDDDDDD........................544444444DDCCCBABCDDDDD444444443........................',
        'DCBBBCBBBCBBBCBBBCBBBCBB65535555555355wwww53555555535553CCDCCCDCCCDCCCDCCCDCCCDD........................5444444DDCBBBCBABCDCCCDDD4444443........................',
        'DCBBBCBBBCBBBCBBxxxxxxxx6553555555535wDDDDv3555555535553xxxxxxxxCCDCCCDCCCDCCCDD................xxxxxxxx544444DBBCBBBCBABCDCCCDCCD444443xxxxxxxx................',
        'DCBBBCBBBCBBBCBBwwwwwwww655355555553wDDCCCDv555555535553wwwwwwwwCCDCCCDCCCDCCCDD................wwwwwwww5444DDBBBCBBBCBABCDCCCDCCCDD4443wwwwwwww................',
        'DCBBBCCCCCBBBCCCvvvvvvvv633333333333wDCCCCCv333333333333vvvvvvvvDDDCCCDDDDDCCCDD................vvvvvvvv544DBCCCCCBBBCCABDDCCCDDDDDCD443vvvvvvvv................',
        'DCBBBCBBBCBBBCBB66666663666666636666wDCBCCCv66636666666366666663CCDCCCDCCCDCCCDD................544444445DDBBCBBBCBBBCBABCDCCCDCCCDCCDD344444443................',
        'DCBBBCBBBCBBBCBB65555553655555535555wDCCjCCv55535555555355555553CCDCCCDCCCDCCCDD................5444444DDCBBBCBBBCBBBCBABCDCCCDCCCDCCCDDD4444443................',
        'DCBBBCBBBCBBBCBB65555553655555535555wDCCjCCv55535555555355555553CCDCCCDCCCDCCCDD................544444DBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCD444443................',
        'DCCCCCBBxxxxxxxx65555553655555535555wDjjjjjv55535555555355555553xxxxxxxxCCDDDDDD........xxxxxxxx5444DDBBBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCCDD4443xxxxxxxx........',
        'DCBBBCBBwwwwwwww65555553655555535555wDCCjCCv55535555555355555553wwwwwwwwCCDCCCDD........wwwwwwww544DBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCD443wwwwwwww........',
        'DCBBBCBBvvvvvvvv63333333633333333333wDCBjCCv33333333333333333333vvvvvvvvCCDCCCDD........vvvvvvvv5DDBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCDD3vvvvvvvv........',
        'DCBBBCBB6663666666636666666366666663wDCCjCCv6666666366636663666366636663CCDCCCDD........5444444DDCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDDD4444443........',
        'DCBBBCCC6553555565535555655355555553wDCCjCCv5555555355535553555355535553DDDCCCDD........544444DCCCBBBCCCCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCCDDDD444443........',
        'DCBBBCBB6553555565535555655355555553xxxxxxxx5555555355535553555355535553CCDCCCDD........5444DDBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDD4443........',
        'xxxxxxxx6553555565535555655355555553uuuuuuuu5555555355535553555355535553xxxxxxxxxxxxxxxx54DDBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCDD43xxxxxxxx',
        'wwwwwwww6553555565535555655355555553555555535555555355535553555355535553wwwwwwwwwwwwwwww5DBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCD3wwwwwwww',
        'vvvvvvvv6333333363333333633333333333333333333333333333333333333333333333vvvvvvvvvvvvvvvDDCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDDDvvvvvvv',
        '66666663666666636666666366666663666666636666666366666663666666636666666366666663544444DBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCD444443',
        '655555536555555365555553655555535555555355555553555555535555555355555553555555535444DDBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD4443',
        '6555555365555553655555536555555355555553555555535555555355555553555555535555555354DDBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCDD43',
        'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww5DBBBCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCD3',
        'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
    ]
    leg = dot.legend('fantasy-kingdom', **{'3': ('ashlar', 3), '4': ('ashlar', 4), '5': ('ashlar', 5), '6': ('ashlar', 6), 'A': ('slate', 3), 'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0), 'j': ('iron', 1), 'u': ('stone', 2), 'v': ('stone', 3), 'w': ('stone', 4), 'x': ('stone', 5)})
    return dot.grid(rows, leg), {}
# <<< cand_gable_step_B

# >>> cand_gable_step_C
def cand_gable_step_C():
    """줄 C 너와 통나무 — 돌 계단 박공 앞·뒤 — 계단마다 밝은 갓돌 윗면."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '44344444344434444434444434443444443444441222122222122222122212222212222212221222................................eeeeeeeeeeeeeeee................................',
        '21222221222221222122222122222122eeeeeeeeeeeeeeee00000000000000000000000000000000................................dddddddddddddddd................................',
        '32333332333332333233333233333233dddddddddddddddd10111110111110111011111011111011................................bbbbbbbbbbbbbbbb................................',
        '43444443444443444344444344444344cccccccccccccccc21222221222221222122222122222122................................4344444512222122................................',
        '44444344444344434444434444434443ccccbcccccccbccc22222122222122212222212222212221................................4444434612212221................................',
        '22222122222122212222212222212221bbbbbbbbbbbbbbbb00000000000000000000000000000000................................2222212510000000................................',
        '33333233333233323333323333323332bedddddcbedddddc11111011111011101111101111101110........................eeeeeeee3333323511101110eeeeeeee........................',
        '444434444434443444443444eeeeeeeebddddddcbddddddceeeeeeee221222122222122222122212........................dddddddd4444344512122212dddddddd........................',
        '344444544443444434444454ddddddddbddddddcbddddddcdddddddd222122221222223222212222........................bbbbbbbb3444445612212222bbbbbbbb........................',
        '122222212222122212222221ccccccccbdddeeeeeeeedddccccccccc000000000000000000000000........................22221222122222251000000000000000........................',
        '233333323333233323333332bcccccccbcccaappppdeccccbccccccc111101110111111011110111........................33332333233333351111011101111110........................',
        '344444344443444434444434bbbbbbbbbbbbaqqrqqdebbbbbbbbbbbb222122221222221222212222........................44434444344444351221222212222212........................',
        '444344443444445444434444dddcbedddddcaqqqqqdebedddddcbedd122222322221222212222232................eeeeeeee34444454444344461222223222212222eeeeeeee................',
        '2221222212222122eeeeeeeedddcbddddddcappppqdebddddddcbdddeeeeeeee0000000000000000................dddddddd12222122222122251000000000000000dddddddd................',
        '3332333323333233dddddddddddcbddddddcaqqqqqdebddddddcbddddddddddd1110111101111011................bbbbbbbb23333233333233351111101111101111bbbbbbbb................',
        '4433444334444334ccccccccdddcbddddddcaqqqrqdebddddddcbdddcccccccc2211222112222112................443344433444433444334445122221122211222112222112................',
        '4434444434443444ccccbcccccccbcccccccaqqqqqdebcccccccbcccccccbccc2212222212221222................443444443444344444344446122212222212222212221222................',
        '2122222122222122bbbbbbbbbbbbbbbbbbbbeeeeeeeebbbbbbbbbbbbbbbbbbbb0000000000000000................212222212222212221222225100000000000000000000000................',
        '3233333233333233bedddddcbedddddcbeddccccccccdddcbedddddcbedddddc1011111011111011........eeeeeeee323333323333323332333335111110111011111011111011eeeeeeee........',
        '43444443eeeeeeeebddddddcbddddddcbddddddcbddddddcbddddddcbddddddceeeeeeee22222122........dddddddd434444434444434443444445122221222122222122222122dddddddd........',
        '44444344ddddddddbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcdddddddd22212221........bbbbbbbb444443444443444344444346122122212222212222212221bbbbbbbb........',
        '22222122ccccccccbddddddcbddddddcbddddddcbddddddcbddddddcbddddddccccccccc00000000........2221222122222122222122212222212510000000000000000000000000000000........',
        '33333233bcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbccccccc11101110........3332333233333233333233323333323511101110111110111110111011111011........',
        '44443444bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb22122212........4434443444443444443444344444344512122212222212222212221222221222........',
        '34444454dddcbedddddcbedddddcbedddddcbedddddcbedddddcbedddddcbedddddcbedd22212222eeeeeeee4443444434444454444344443444445612212222122222322221222212222232eeeeeeee',
        'eeeeeeeedddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbdddeeeeeeeedddddddd2222122212222221222212221222222510000000000000000000000000000000dddddddd',
        'dddddddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbdddddddddddbbbbbbbb3333233323333332333323332333333511110111011111101111011101111110bbbbbbbb',
        'ccccccccdddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbddddddcbdddcccccccc34444434444344443444443444434444344444351221222212222212222122221222221222212222',
        'ccccbcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbcccccccbccc44434444344444544443444434444454444344461222223222212222122222322221222212222232',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb22212222122221222221222212222122222122251000000000000000000000000000000000000000',
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd33323333233332333332333323333233333233351111101111101111011110111110111101111011',
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc44334443344443344433444334444334443344451222211222112221122221122211222112222112',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_gable_step_C

# >>> cand_roof_gf_slope_A
def cand_roof_gf_slope_A():
    # 남북 용마루 박공 지붕 몸통 — 기와 줄이 세로(남북)로, 왼쪽 경사 밝고 오른쪽 경사 어둡게, 용마루 2px
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3), e=('roof', 4))

    def lit(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 3 or yy == 3:
            return 'b'
        if xx == 0 and yy == 0:
            return 'd'
        return 'c'

    def shade(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 0 or yy == 3:
            return 'a'
        if xx == 1 and yy == 0 and col % 2 == 0:
            return 'c'
        return 'b'

    def ridge(x, y, c):
        if x < c:
            return lit(x, y)
        if x == c:
            return 'd'
        if x == c + 1:
            return 'c'
        if x == c + 2:
            return 'a'
        return shade(x, y)

    def px(x, y):
        if x < 16:                                   # l — 서쪽 처마
            return 'a' if x == 0 else 'b' if x == 1 else lit(x, y)
        if x < 32:                                   # ml
            return lit(x, y)
        if x < 48:                                   # k — 용마루 국소 7,8
            return ridge(x, y, 39)
        if x < 80:                                   # k2 — 용마루 국소 15,16
            return ridge(x, y, 63)
        if x < 96:                                   # mr
            return shade(x, y)
        return 'a' if x >= 110 else shade(x, y)      # r — 동쪽 처마

    rows = [''.join(px(x, y) for x in range(112)) for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_slope_A

# >>> cand_roof_gf_slope_B
def cand_roof_gf_slope_B():
    # 박공 정면 사면 띠 — 기와 줄은 세로선(처마와 나란), 왼 사면 밝음·오른 사면 어두움, 용마루 2px
    rows = [
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBABCDDDDDCBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCABDDCCCDDCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBABCDDDDDCBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'DCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCCCCBBBCCABDDCCCDDCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDD',
        'DCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
    ]
    leg = dot.legend('fantasy-kingdom', **{'A': ('slate', 3), 'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0)})
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_slope_B

# >>> cand_roof_gf_slope_C
def cand_roof_gf_slope_C():
    """줄 C 너와 통나무 — 너와 사면 띠 — 왼쪽 밝은·오른쪽 짙은 사면 · 가운데 2px 용마루."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '1234444434443444443444443444344444344446122212224434444434443446121222221222122222122222122212222212222212221210',
        '1222222122222122212222212222212221222225100000002122222122222125100000000000000000000000000000000000000000000010',
        '1233333233333233323333323333323332333335111110113233333233333235101111101111101110111110111110111011111011111010',
        '1244444344444344434444434444434443444445122221224344444344444345112222212222212221222221222221222122222122222110',
        '1244434444434443444443444443444344444346122122214444434444434446122221222221222122222122222122212222212222212210',
        '1222212222212221222221222221222122222125100000002222212222212225100000000000000000000000000000000000000000000010',
        '1233323333323332333332333332333233333235111011103333323333323335111110111110111011111011111011101111101111101110',
        '1244344444344434444434444434443444443445121222124444344444344435122212222212221222221222221222122222122222122210',
        '1244445444434444344444544443444434444456122122223444445444434446122222322221222212222232222122221222223222212210',
        '1222222122221222122222212222122212222225100000001222222122221225100000000000000000000000000000000000000000000010',
        '1233333233332333233333323333233323333335111101112333333233332335111111101111011101111110111101110111111011110110',
        '1244443444434444344444344443444434444435122122223444443444434445122222122221222212222212222122221222221222212210',
        '1243444434444454444344443444445444434446122222324443444434444456122122221222223222212222122222322221222212222210',
        '1221222212222122222122221222212222212225100000002221222212222125100000000000000000000000000000000000000000000010',
        '1232333323333233333233332333323333323335111110113332333323333235111011110111101111101111011110111110111101111010',
        '1233444334444334443344433444433444334445122221124433444334444335121122211222211222112221122221122211222112222110',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_slope_C

# >>> cand_roof_gf_back_A
def cand_roof_gf_back_A():
    # b4: 남북 용마루의 북쪽 끝 ^ (박공널 2px) · v3: 날개가 본채 경사에 닿는 골 삼각형
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3), e=('roof', 4))

    def lit(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 3 or yy == 3:
            return 'b'
        if xx == 0 and yy == 0:
            return 'd'
        return 'c'

    def shade(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 0 or yy == 3:
            return 'a'
        if xx == 1 and yy == 0 and col % 2 == 0:
            return 'c'
        return 'b'

    def body(x, y, c):
        if x < c:
            return lit(x, y)
        if x == c:
            return 'd'
        if x == c + 1:
            return 'c'
        if x == c + 2:
            return 'a'
        return shade(x, y)

    def b4(x, y):
        lo, hi = 31 - y, 32 + y
        if x < lo or x > hi:
            return '.'
        if x == lo or x == hi:
            return 'a'
        if x == lo + 1:
            return 'b'
        if x == hi - 1:
            return 'b' if x > 33 else body(x, y, 31)
        return body(x, y, 31)

    edge = [23, 21, 20, 18, 17, 15, 14, 12, 11, 9, 8, 6, 5, 3, 2, 0]

    def v3(x, y):
        if y >= 16:
            return '.'
        lo, hi = edge[y], 47 - edge[y]
        if x < lo or x > hi:
            return '.'
        plo = edge[y - 1] - 1 if y else lo
        if x <= max(lo, plo) or x >= min(hi, 47 - edge[y - 1] + 1 if y else hi):
            return 'a'
        if x == 0:
            return 'a'
        if x == 1:
            return 'b'
        if x >= 46:
            return 'a'
        return body(x, y, 23)

    rows = [''.join(b4(x, y) if x < 64 else v3(x - 64, y) for x in range(112)) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_back_A

# >>> cand_roof_gf_back_B
def cand_roof_gf_back_B():
    # 뒤 끝 b4(^ 쇠 테) · 골 v3(본채 지붕 위에서 끝나는 ^ 골)
    rows = [
        '...............................DD......................................................DD.......................',
        '..............................DljD...................................................DDCDDD.....................',
        '.............................DlABjD.................................................DCBABCDD....................',
        '............................DlBABCjD..............................................DDCCBABCDDDD..................',
        '...........................DlCBABCDjD............................................DCBBCBABCDCCDD.................',
        '..........................DlBCBABCDCjD.........................................DDCBBBCBABCDCCCDDD...............',
        '.........................DlBBCCABDDCCjD.......................................DCCCBBBCCABDDCCCDDDD..............',
        '........................DlBBBCBABCDCCCjD....................................DDCBBCBBBCBABCDCCCDCCDDD............',
        '.......................DlCBBBCBABCDCCCDjD..................................DCCBBBCBBBCBABCDCCCDCCCDDD...........',
        '......................DlBCBBBCBABCDCCCDCjD...............................DDCBCBBBCBBBCBABCDCCCDCCCDCDDD.........',
        '.....................DlBBCCCCCBABCDDDDDCCjD.............................DCCCCCBBBCCCCCBABCDDDDDCCCDDDDDD........',
        '....................DlBBBCBBBCBABCDCCCDCCCjD..........................DDCCBBBCBBBCBBBCBABCDCCCDCCCDCCCDDDD......',
        '...................DlCBBBCBBBCBABCDCCCDCCCDjD........................DCBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCDD.....',
        '..................DlBCBBBCBBBCBABCDCCCDCCCDCjD.....................DDCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDDD...',
        '.................DlBBCCCCCBBBCCABDDCCCDDDDDCCjD...................DCBCCCCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCDD..',
        '................DlBBBCBBBCBBBCBABCDCCCDCCCDCCCjD................DDCBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCDDD',
        '...............DlCBBBCBBBCBBBCBABCDCCCDCCCDCCCDjD...............................................................',
        '..............DlBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCjD..............................................................',
        '.............DlBBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCjD.............................................................',
        '............DlBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCjD............................................................',
        '...........DlCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDjD...........................................................',
        '..........DlBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCjD..........................................................',
        '.........DlBBCCCCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCjD.........................................................',
        '........DlBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCjD........................................................',
        '.......DlCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDjD.......................................................',
        '......DlBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCjD......................................................',
        '.....DlBBCCCCCBBBCCCCCBBBCCCCCBABCDDDDDCCCDDDDDCCCDDDDDCCjD.....................................................',
        '....DlBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCjD....................................................',
        '...DlCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDjD...................................................',
        '..DlBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCjD..................................................',
        '.DlBBCCCCCBBBCCCCCBBBCCCCCBBBCCABDDCCCDDDDDCCCDDDDDCCCDDDDDCCjD.................................................',
        'DlBBBCBBBCBBBCBBBCBBBCBBBCBBBCBABCDCCCDCCCDCCCDCCCDCCCDCCCDCCCjD................................................',
    ]
    leg = dot.legend('fantasy-kingdom', **{'A': ('slate', 3), 'B': ('slate', 2), 'C': ('slate', 1), 'D': ('slate', 0), 'j': ('iron', 1), 'l': ('iron', 3)})
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_back_B

# >>> cand_roof_gf_back_C
def cand_roof_gf_back_C():
    """줄 C 너와 통나무 — 뒤 끝 ^ 바지보드 · 골 접힘선."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '...............................11......................................................00.......................',
        '..............................1211....................................................0210......................',
        '.............................125111.................................................00251100....................',
        '............................12451111..............................................002245121100..................',
        '...........................1244612211............................................02243461221110.................',
        '..........................122225100011.........................................002222125100000100...............',
        '.........................12233351111111.......................................02233332351110111110..............',
        '........................1234443512221211....................................002444443445121222122100............',
        '.......................124434446122222311.................................0022443444445612212222121100..........',
        '......................12222212251000000011...............................022122212222225100000000000110.........',
        '.....................1223333233511111110111............................0023323332333333511110111011111100.......',
        '....................123444434445122222122211..........................022443444434444435122122221222221110......',
        '...................12444344444561221222212211.......................0024344444544443444612222232222122221100....',
        '..................1222221222212510000000000011....................00222212222122222122251000000000000000001100..',
        '.................122333323333235111011110111111..................0223333233332333332333511111011111011110111110.',
        '................12334443344443351211222112222111................023344433444433444334445122221122211222112222110',
        '...............1243444443444344612122222122212211...............................................................',
        '..............122122222122222125100000000000000011..............................................................',
        '.............12332333332333332351011111011111011111.............................................................',
        '............1244434444434444434511222221222221222111............................................................',
        '...........124434444434444434446122221222221222122211...........................................................',
        '..........12222122222122222122251000000000000000000011..........................................................',
        '.........1223332333332333332333511111011111011101111111.........................................................',
        '........123444344444344444344435122212222212221222221211........................................................',
        '.......12443444434444454444344461222223222212222122222311.......................................................',
        '......1222221222122222212222122510000000000000000000000011......................................................',
        '.....122333323332333333233332335111111101111011101111110111.....................................................',
        '....12344443444434444434444344451222221222212222122222122211....................................................',
        '...1244434444454444344443444445612212222122222322221222212211...................................................',
        '..122222122221222221222212222125100000000000000000000000000011..................................................',
        '.12233332333323333323333233332351110111101111011111011110111111.................................................',
        '1233444334444334443344433444433512112221122221122211222112222111................................................',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_back_C

# >>> cand_roof_lean_side_A
def cand_roof_lean_side_A():
    # 옆으로 흐르는 달개지붕 — 기와 줄 남북, 본채 그늘이라 한 단 어둡게, 앞 끝은 사다리꼴 반목조 벽
    leg = dot.legend('fantasy-kingdom', **{'a': ('roof', 0), 'b': ('roof', 1), 'c': ('roof', 2),
                                           'p': ('plaster', 0), 'r': ('plaster', 2), 's': ('plaster', 3),
                                           '2': ('timber', 2), '3': ('timber', 3), '4': ('timber', 4)})

    def lean(x, y):
        col, xx = (x + 2) // 4, (x + 2) % 4
        yy = (y + 2 * (col % 2)) % 4
        if xx == 3 or yy == 3:
            return 'a'
        if xx == 0 and yy == 0:
            return 'c'
        return 'b'

    def lb2(x, y):
        t = x // 3
        if y < t:
            return '.'
        if y == t or x in (0, 31):
            return 'a'
        if y == t + 1:
            return 'c'
        return lean(x, y)

    def lf2(x, y):
        e = 2 + x // 3
        if y < e:
            return 'a' if x in (0, 31) else lean(x, y)
        if y == e:
            return 'a'
        if y == e + 1 or y == 15:
            return '2'
        if x >= 30:
            return 'a'
        if x == 28:
            return '4'
        if x == 29:
            return '3'
        if x in (0, 15, 16):
            return '4' if x != 16 else '3'
        if y == e + 2 or y == 14:
            return 'p'
        return 'r' if x in (1, 17) else 's'

    def px(x, y):
        if x < 32:
            return lb2(x, y)
        if x < 48:
            return 'a' if x == 32 else lean(x, y)
        if x < 64:
            return lean(x, y)
        if x < 80:
            return 'a' if x == 79 else 'b' if x == 78 else lean(x, y)
        return lf2(x - 80, y)

    rows = [''.join(px(x, y) for x in range(112)) for y in range(16)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_lean_side_A

# >>> cand_roof_lean_side_B
def cand_roof_lean_side_B():
    # 외쪽 — 동쪽(오른쪽) 처마로 내려가는 어두운 사면, 높은 쪽 쇠 물받이, 앞 끝 회벽
    rows = [
        'DDD.............................jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDDDDCCCDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'jkjDDD..........................jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDjjjDDDDCCCDCCCDCCCDCCCDCCCDCCCDD',
        'jkDjjjDDD.......................jkDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDDrrrjjjDDDCDDDDDCCCDDDDDCCCDDDDDD',
        'jkDCCCjjjDDD....................jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGrrjjjDDDCCDCCCDCCCDCCCDCCCDD',
        'jkDCCCDCCjjjDDD.................jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPrrrjjjDDDCCCDCCCDCCCDCCCDD',
        'jkDCCCDCCCDCjjjDDD..............jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPrrrjjjDDDDCCCDCCCDCCCDD',
        'jkDCCCDDDDDCCCDjjjDDD...........jkDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDPPHGPPPPPPPPrrrjjjDDDCDDDDDCCCDD',
        'jkDCCCDCCCDCCCDCCCjjjDDD........jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPrrrjjjDDDCCDCCCDD',
        'jkDCCCDCCCDCCCDCCCDCCjjjDDD.....jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPPPPrrrjjjDDDCCCDD',
        'jkDCCCDCCCDCCCDCCCDCCCDCjjjDDD..jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPPPPPPPrrrjjjDDDDD',
        'jkDDDDDCCCDDDDDCCCDDDDDCCCDjjjDDjkDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDDPPHGPPPPPPPPPPPPPPPPPPPPrrrjjjDD',
        'jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCjjjkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPPPPPPPPPPPPPrrrjj',
        'jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDjkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPPPPPPPPPPPPPPPPrr',
        'jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDjkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDPPHGPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
        'jkDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDjkDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDDDDCCCDDHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
        'jkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDjkDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDCCCDDFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    ]
    leg = dot.legend('fantasy-kingdom', **{'C': ('slate', 1), 'D': ('slate', 0), 'F': ('timber', 2), 'G': ('timber', 3), 'H': ('timber', 4), 'P': ('plaster', 3), 'j': ('iron', 1), 'k': ('iron', 2), 'r': ('plaster', 2)})
    return dot.grid(rows, leg), {}
# <<< cand_roof_lean_side_B

# >>> cand_roof_lean_side_C
def cand_roof_lean_side_C():
    """줄 C 너와 통나무 — 외쪽 헛간 지붕 — 오른쪽으로 내려가는 짙은 너와 · 앞 끝 통나무 벽."""
    leg = dot.legend('fantasy-kingdom', **{
        '0': ('shingle', 0), '1': ('shingle', 1), '2': ('shingle', 2), '3': ('shingle', 3),
        '4': ('shingle', 4), '5': ('shingle', 5), '6': ('shingle', 6),
        'B': ('wood', 1), 'C': ('wood', 2), 'D': ('wood', 3), 'E': ('wood', 4), 'F': ('wood', 5), 'G': ('wood', 6),
        'a': ('stone', 0), 'b': ('stone', 1), 'c': ('stone', 2), 'd': ('stone', 3), 'e': ('stone', 4),
        'w': ('iron', 0), 'x': ('iron', 1), 'y': ('iron', 2), 'z': ('iron', 3),
        'p': ('slate', 0), 'q': ('slate', 1), 'r': ('slate', 2)})
    rows = [
        '111.............................03122222122212222212222212221222221222221222121022122222122212222212222212221220',
        '222111..........................03000000000000000000000000000000000000000000001011100000000000000000000000000000',
        '10122211........................03111110111110111011111011111011101111101111101000011110111110111011111011111010',
        '21222222111.....................022222212222212221222221222221222122222122222110CCC00011222221222122222122222120',
        '2222212222211...................032221222221222122222122222122212222212222212210FFFCCC00111122212222212222212220',
        '0000000000022111................030000000000000000000000000000000000000000000010EEEEEECC000111000000000000000000',
        '111110111110122211..............031110111110111011111011111011101111101111101110DDDDDDDDCCC000111111101111101110',
        '222212222212221222111...........022212222212221222221222221222122222122222122210CCCCCCCCCCCCCC000111122222122210',
        '12222232222122221222211.........032222322221222212222232222122221222223222212210FFFFGFFFFFFFFFCCC000111222212220',
        '00000000000000000000022111......030000000000000000000000000000000000000000000010EDDEEEEEEEDEEEEEECCC000111000000',
        '0111111011110111011111122211....031111101111011101111110111101110111111011110110DDDDDDDDDDDDDDDDDDDDCCC000110110',
        '1222221222212222122222122222111.022222122221222212222212222122221222221222212210CCCCCCCCCCCCCCCCCCCCCCCCCC001120',
        '22212222122222322221222212222221032122221222223222212222122222322221222212222210FFFFFFFFFGFFFFFFFFFFFFFFFGCC0010',
        '00000000000000000000000000000002030000000000000000000000000000000000000000000010EEEEEDDEEEEEEDEEEEEEEDDEEEEECC00',
        '11101111011110111110111101111011031011110111101111101111011110111110111101111010EEEEEEEEEEEEEEEEEEEEEEEEEEEEEECC',
        '22112221122221122211222112222112021122211222211222112221122221122211222112222110CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ]
    return dot.grid(rows, leg), {}
# <<< cand_roof_lean_side_C


CANDIDATES = {
    'band.trim': {'A': cand_band_trim_A, 'B': cand_band_trim_B, 'C': cand_band_trim_C},
    'extra.chimney': {'A': cand_extra_chimney_A, 'B': cand_extra_chimney_B, 'C': cand_extra_chimney_C},
    'roof.hip': {'A': cand_roof_hip_A, 'B': cand_roof_hip_B, 'C': cand_roof_hip_C},
    'wall.stone': {'A': cand_wall_stone_A, 'B': cand_wall_stone_B, 'C': cand_wall_stone_C},
    'wall.timber': {'A': cand_wall_timber_A, 'B': cand_wall_timber_B, 'C': cand_wall_timber_C},
    'gable.front': {'A': cand_gable_front_A, 'B': cand_gable_front_B, 'C': cand_gable_front_C},
    'gable.step': {'A': cand_gable_step_A, 'B': cand_gable_step_B, 'C': cand_gable_step_C},
    'roof.gf.slope': {'A': cand_roof_gf_slope_A, 'B': cand_roof_gf_slope_B, 'C': cand_roof_gf_slope_C},
    'roof.gf.back': {'A': cand_roof_gf_back_A, 'B': cand_roof_gf_back_B, 'C': cand_roof_gf_back_C},
    'roof.lean.side': {'A': cand_roof_lean_side_A, 'B': cand_roof_lean_side_B, 'C': cand_roof_lean_side_C},
}

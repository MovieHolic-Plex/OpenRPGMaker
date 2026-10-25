"""building-kit fantasy-kingdom style-r8 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).

중세 판타지 왕국 · 화풍 판(줄 글자 A·B·C 가 곧 줄).
한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.
"""
import dot

ROUND = 'style-r8'
WAVE = 'style'
NOTES = {}

# >>> cand_roof_gf_valley_A
def cand_roof_gf_valley_A():
    # 날개 지붕이 본채 지붕 속으로 올라가는 골 — 사면 띠(style-r5)의 결을 그대로 위로 잇고, ^ 접힘선은 가장 어두운 단 1px
    leg = dot.legend('fantasy-kingdom', a=('roof', 0), b=('roof', 1), c=('roof', 2), d=('roof', 3))

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

    def valley(x, y, w):
        c = w // 2 - 1                                # 용마루 c, c+1
        if x in (c, c + 1):
            return 'd' if x == c else 'c'
        dist = c - x if x < c else x - (c + 1)
        line = (dist * 31 + c // 2) // c              # 접힘선 높이 — 양 끝은 맨 아래 행
        if y < line:
            return '.'
        if y == line:
            return 'a'
        if x < c:
            return 'a' if x == 0 else 'b' if x == 1 else lit(x, y)
        if x == c + 2:
            return 'a'
        if y == line + 1 and x < w - 2:
            return 'c'                                # 그늘 사면도 골 밑 기와 끝 1px — 접힘선이 줄눈에 묻히지 않게
        return 'a' if x >= w - 2 else shade(x, y)

    def px(x, y):
        if x < 64:
            return valley(x, y, 64)
        if x < 144:
            return valley(x - 64, y, 80)
        return valley(x - 144, y, 96)

    rows = [''.join(px(x, y) for x in range(240)) for y in range(32)]
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_valley_A

# >>> cand_roof_gf_valley_B
def cand_roof_gf_valley_B():
    # 청석 날개 골 v4·v5·v6 — 아래는 사면 띠(r5 B)의 결을 그대로 이어 받고, 위는 ^ 접힘선(가장 어두운 단 1px) 위를 비워 본채 지붕이 비친다
    slope = [  # 사면 띠 l|ml|k|k2|mr|r 16행 — 골 32행 = 띠 두 바퀴라 맨 아래 행이 띠 맨 윗행과 이어진다
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
    cut = {'l': (0, 16), 'ml': (16, 32), 'k': (32, 48), 'k2': (48, 80), 'mr': (80, 96), 'r': (96, 112)}
    order = {4: ('l', 'k2', 'r'), 5: ('l', 'ml', 'k', 'mr', 'r'), 6: ('l', 'ml', 'k2', 'mr', 'r')}
    H = 32

    def valley(cells):
        w = cells * 16
        half = w // 2 - 1  # 왼 용마루 열 = 가운데 2px 의 왼쪽
        out = []
        for y in range(H):
            band = ''.join(slope[y % 16][cut[p][0]:cut[p][1]] for p in order[cells])
            row = []
            for x in range(w):
                d = half - x if x <= half else x - (half + 1)  # 용마루에서 떨어진 거리(0 = 용마루 2px)
                edge = (d * (H - 1) + half // 2) // half  # ^ 접힘선이 지나는 행 — 양 끝 d=half 에서 맨 아래 행
                if d == 0:
                    row.append(band[x])  # 용마루는 꼭대기 행부터 끊기지 않는다
                elif y < edge:
                    row.append('.')  # 선 위 귀퉁이 — 본채 지붕이 비친다
                elif y == edge or (y > edge and edge_prev(d, half) > y):
                    row.append('D')  # 골 접힘선 1px — 완만한 폭에서도 화소가 끊기지 않게 이어 찍는다
                else:
                    row.append(band[x])
            out.append(''.join(row))
        return out

    def edge_prev(d, half):
        return ((d - 1) * (H - 1) + half // 2) // half if d > 1 else -1

    rows = [a + b + c for a, b, c in zip(valley(4), valley(5), valley(6))]
    leg = dot.legend('fantasy-kingdom', A=('slate', 3), B=('slate', 2), C=('slate', 1), D=('slate', 0))
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_valley_B

# >>> cand_roof_gf_valley_C
def cand_roof_gf_valley_C():
    # 날개 골 — 사면 띠(style-r5 C)의 널 결을 위로 2행 더 잇고, ^ 골선(가장 어두운 단 1px) 위는 비운다.
    # 사면 띠 한 행(16px, 4행 주기 널 줄). 조각: l 0:16 · ml 16:32 · k 32:48 · k2 48:80 · mr 80:96 · r 96:112
    band = [
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
    cut = {'l': (0, 16), 'ml': (16, 32), 'k': (32, 48), 'k2': (48, 80), 'mr': (80, 96), 'r': (96, 112)}
    order = {4: ('l', 'k2', 'r'), 5: ('l', 'ml', 'k', 'mr', 'r'), 6: ('l', 'ml', 'k2', 'mr', 'r')}

    def piece(cells):
        W, H = cells * 16, 32
        a = W // 2 - 1                      # 용마루 왼 열(밝은 줄), a+1 = 그늘 줄
        # 골선 x(y): 꼭대기 a(행 0) → 0(행 31), 곧은 물매. 한 행에 1px 이상 내려가면 이어 칠한다.
        xs = [round(a * (H - 1 - y) / (H - 1)) for y in range(H)]
        rows = []
        for y in range(H):
            src = ''.join(band[y % 16][cut[p][0]:cut[p][1]] for p in order[cells])
            row = list(src)
            hi = xs[y - 1] - 1 if y > 0 else xs[0]
            lo = xs[y]
            for x in range(a + 1):
                m = W - 1 - x                     # 오른쪽 거울
                if y == 0:
                    # 꼭대기 행: 용마루 끝 2px 만 골선 단, 나머지는 본채 지붕이 비친다
                    row[x] = '0' if x == a else '.'
                    row[m] = '0' if x == a else '.'
                elif x < lo:
                    row[x] = row[m] = '.'
                elif x <= max(lo, hi) and x < a:
                    row[x] = row[m] = '0'
            # 그늘 사면의 어두운 널 줄이 골선과 붙어 계단처럼 끊기지 않게 골선 바로 안쪽 1px 은 한 단 밝힌다
            if y > 0:
                inner = W - 1 - (max(lo, hi) + 1)
                if inner > a + 1 and row[inner] == '0':
                    row[inner] = '1'
            rows.append(''.join(row))
        return rows

    parts = [piece(4), piece(5), piece(6)]
    rows = [parts[0][y] + parts[1][y] + parts[2][y] for y in range(32)]
    leg = dot.legend('fantasy-kingdom', **{str(i): ('shingle', i) for i in range(7)})
    return dot.grid(rows, leg), {}
# <<< cand_roof_gf_valley_C


CANDIDATES = {
    'roof.gf.valley': {'A': cand_roof_gf_valley_A, 'B': cand_roof_gf_valley_B, 'C': cand_roof_gf_valley_C},
}

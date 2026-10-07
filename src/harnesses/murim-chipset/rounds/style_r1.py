"""스타일 시험 판 style-r1 — 항목 6개 × 후보 A/B/C.

모든 그림은 행 문자열 격자다. 글자 하나 = 화소 하나. 범례는 후보마다 따로 둔다.
후보끼리는 색만 바꾼 것이 아니라 구조(판재 방향·돌 모양·벽 구성·기와 구성·받침 구조)가 다르다.
meta['top'] = (y0, y1): 윗면(위에서 보이는 수평 면)이 그려진 행 범위(y1 미포함). 관문 F 가 읽는다.
"""
from tk import grid, Cv, stamp

ROUND = 'style-r1'
WAVE = 'style'

# ---------------------------------------------------------------------------
# 1. 객잔 나무 마루 (2×2, 반복 타일)
# ---------------------------------------------------------------------------
SONG = {str(i): ('song', i) for i in range(7)}
MU = {str(i): ('mu', i) for i in range(7)}


def floor_wood_a():
    """가로 판재 4px, 이음매 엇갈림. 밝은 소나무."""
    rows = [
        # P0 base 4, 이음 x=11
        "22222222222222222222222222222222",
        "45555544443254444445555554444444",
        "44444444443244444333444444444444",
        "33344444333243344444444443333444",
        # P1 base 3, 이음 x=24
        "22222222222222222222222222222222",
        "34444333333333333333333124433333",
        "33333333322223333333333123333333",
        "22333333333333333332222122333222",
        # P2 base 4, 이음 x=4
        "22222222222222222222222222222222",
        "44432554444444445555544444444444",
        "44432444444333444444444444444444",
        "33332444444444444444443333444444",
        # P3 base 5(밝은 판), 이음 x=18
        "22222222222222222222222222222222",
        "55555666655555555432655555555555",
        "55555555555544455432555555566555",
        "44455555555555555432555544444555",
        # P4 base 4, 이음 x=29
        "22222222222222222222222222222222",
        "44444455555444444444444444325444",
        "44444444444444443334444444324444",
        "33444444444333444444444443324433",
        # P5 base 3, 이음 x=8
        "22222222222222222222222222222222",
        "33333331244333333444333333333333",
        "33333331233333333333333332223333",
        "23333221233333332222333333333322",
        # P6 base 4, 이음 x=21
        "22222222222222222222222222222222",
        "44445555544444444444325444555544",
        "44444444444443334444324444444444",
        "33344444444444444444324443333444",
        # P7 base 4, 이음 x=1
        "22222222222222222222222222222222",
        "32554444444445555544444444444444",
        "32444444333444444444444444443344",
        "32444443333444444444433344444443",
    ]
    return grid(rows, SONG), {'note': '가로 판재(4px)·이음 엇갈림·밝은 소나무. 조선 마루와 같은 방향, 더 밝고 노랗다.'}


def floor_wood_b():
    """세로 판재 8px, 판 끝 엇갈림. 붉은 기가 도는 칠한 나무."""
    # 판마다 32행 × 8열을 손으로 적는다: 열0 틈(2) 열1 밝은 모서리(5) 열2-6 몸 열7 그늘(3)
    # 판 끝(가로 이음) 행: 틈 '2' 한 줄 + 그 아래 줄 밝은 윗모서리 '5'
    b0 = [
        "25444443", "25443443", "25443443", "25443443", "25444443", "25444543", "25444543", "25444443",
        "34444433", "22222222", "55555554", "25444443", "25444443", "25344443", "25344443", "25344443",
        "25444443", "25444443", "25445443", "25445443", "25445443", "25444443", "25444443", "25444343",
        "25444343", "25444343", "25444443", "25444443", "25544443", "25544443", "25444443", "25444443",
    ]
    b1 = [
        "25444443", "25444443", "25443443", "25443443", "25443443", "25444443", "25444443", "25444443",
        "25454443", "25454443", "25454443", "25444443", "25444443", "25444433", "25444433", "25444433",
        "25444443", "25444443", "25344443", "25344443", "25344443", "25344443", "25444443", "25444443",
        "34444433", "22222222", "55555554", "25444443", "25444543", "25444543", "25444443", "25444443",
    ]
    b2 = [
        "25444443", "25444443", "34444433", "22222222", "55555554", "25444443", "25443443", "25443443",
        "25443443", "25444443", "25444443", "25444443", "25544443", "25544443", "25544443", "25444443",
        "25444443", "25444343", "25444343", "25444443", "25444443", "25444443", "25444443", "25344443",
        "25344443", "25344443", "25444443", "25444443", "25444543", "25444543", "25444543", "25444443",
    ]
    b3 = [
        "25444443", "25444443", "25444443", "25445443", "25445443", "25445443", "25444443", "25444443",
        "25444443", "25443443", "25443443", "25443443", "25443443", "25444443", "25444443", "34444433",
        "22222222", "55555554", "25444443", "25444443", "25344443", "25344443", "25444443", "25444443",
        "25444433", "25444433", "25444433", "25444443", "25444443", "25454443", "25454443", "25444443",
    ]
    rows = [b0[y] + b1[y] + b2[y] + b3[y] for y in range(32)]
    return grid(rows, MU), {'note': '세로 판재(8px)·판 끝 엇갈림·붉은 기 도는 칠 나무. 대청·도장(道場) 마루 느낌.'}


def floor_wood_c():
    """격자틀 마루: 16칸마다 짙은 귀틀(2px)이 지나가고, 틀 안의 짧은 판이 칸마다 방향을 바꾼다."""
    # 귀틀: 위 2행(밝은 윗면 5 / 그늘 3), 왼쪽 2열(밝은 4 / 2). 틀 안 14×14.
    HC = [  # 가로 판 3장 + 틈(14×14)
        "44455444444444",
        "44444444444333",
        "33444444444444",
        "33333443333333",
        "22222222222222",
        "44444445544444",
        "44443344444444",
        "44444444444433",
        "33334433333333",
        "22222222222222",
        "45544444444444",
        "44444444334444",
        "44444444444444",
        "33333333333333",
    ]
    VC = [  # 세로 판 3장 + 틈(14×14)
        "45443245443243",
        "44443244443244",
        "44433244443244",
        "44433245443244",
        "44443245443234",
        "44443244443234",
        "45443244433234",
        "45443244433244",
        "44443244443244",
        "44443245443244",
        "44343245443244",
        "44343244443244",
        "44443244443244",
        "33333233333233",
    ]
    rows = []
    for cy in range(2):
        cell_rows = []
        for r in range(16):
            line = ''
            for cx in range(2):
                inner = HC if (cx + cy) % 2 == 0 else VC
                if r == 0:
                    line += '1' + 'a' * 15  # 귀틀 윗면(밝음)
                elif r == 1:
                    line += '1' + 'b' * 15  # 귀틀 윗면(앞 모서리)
                elif r == 2:
                    line += '12' + '2' * 14  # 귀틀 앞면 그늘(판보다 낮은 단)
                else:
                    line += '2' + '3' + inner[r - 2]
            cell_rows.append(line)
        rows += cell_rows
    legend = dict(SONG)
    legend.update({'1': ('mu', 1), '2': ('mu', 2), '3': ('mu', 3), 'a': ('mu', 5), 'b': ('mu', 4)})
    # 귀틀 글자(1·2·3)와 판 글자(2·3·4·5)가 겹치므로 판 쪽은 아래에서 다시 칠한다
    cv = Cv(32, 32)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            in_frame = (y % 16) < 3 or (x % 16) < 2
            stamp(cv, [ch], legend if in_frame else SONG, ox=x, oy=y)
    return cv, {'note': '격자틀 마루: 짙은 귀틀(16px 간격) 안에 짧은 판, 칸마다 방향이 바뀐다. 무게 있는 객잔 대청.'}


# ---------------------------------------------------------------------------
# 2. 연무장 돌바닥 (2×2, 반복 타일) — 청석(shi)
# ---------------------------------------------------------------------------
SHI = {str(i): ('shi', i) for i in range(7)}


def floor_stone_a():
    """큰 네모 판석 16×16, 줄마다 반 칸 어긋남. 판석마다 결·금·이 빠진 모서리를 따로 찍었다."""
    S1 = [
        "1111111111111111",
        "1555555555555553",
        "1544444444444443",
        "1544444444444443",
        "1544334444444443",
        "1544433444445443",
        "1544444444455443",
        "1544444444444443",
        "1544444444444443",
        "1544444444444443",
        "1544444443344443",
        "1545444433334443",
        "1544444444444443",
        "1544444444444443",
        "1544444444444443",
        "1333333333333333",
    ]
    S2 = [  # 금 간 판석
        "1111111111111111",
        "1555555555555553",
        "1544444444444443",
        "1544452444444443",
        "1544442444444443",
        "1544444254444443",
        "1544444424444443",
        "1544444424444443",
        "1544444442544443",
        "1544444442444443",
        "1544444444244443",
        "1544444444425443",
        "1544444444424443",
        "1544444444444443",
        "1544444444444443",
        "1333333333333333",
    ]
    S3 = [  # 어두운 판석
        "1111111111111111",
        "1444444444444442",
        "1433333333333332",
        "1433334433333332",
        "1433344433333332",
        "1433333333343332",
        "1433333333443332",
        "1433333333333332",
        "1433333333333332",
        "1433333333333332",
        "1433322333333332",
        "1433332333333332",
        "1433333333334332",
        "1433333333333332",
        "1433333333333332",
        "1222222222222222",
    ]
    S4 = [  # 오른쪽 위 모서리가 깨진 판석
        "1111111111111111",
        "1555555555521111",
        "1544444444442211",
        "1544444444444221",
        "1544455444444443",
        "1544555444444443",
        "1544444444444443",
        "1544444444444443",
        "1544444444444443",
        "1544444444444443",
        "1544444433444443",
        "1544444444334443",
        "1544444444444443",
        "1544444444444443",
        "1544444444444443",
        "1333333333333333",
    ]
    cv = Cv(32, 32)
    stamp(cv, S1, SHI, 0, 0)
    stamp(cv, S2, SHI, 16, 0)
    stamp(cv, S3, SHI, 8, 16, wrap=True)
    stamp(cv, S4, SHI, 24, 16, wrap=True)
    return cv, {'note': '큰 네모 판석(16px)·반 칸 어긋남. 판석 넷이 서로 다르다(보통·금 간 것·어두운 것·모서리 깨진 것).'}


def _course(stones, shift, hgt):
    """한 줄 장대석. stones = [(폭, 바탕 단, {(dx, dy): 단})] — 폭에 오른쪽 이음 1열 포함.
    윗줄 이음(1), 밝은 윗모서리 한 줄(바탕+1), 오른쪽 어두운 열·아래 어두운 줄(바탕-1). 바닥이라 왼쪽 밝은 열은 없다(벽돌처럼 부풀지 않게).
    결 자리는 손으로 고른다."""
    rows = [[] for _ in range(hgt)]
    for w, b, mot in stones:
        for dy in range(hgt):
            for dx in range(w):
                if dy == 0 or dx == w - 1:
                    c = 1
                elif dy == hgt - 1 or dx == w - 2:
                    c = b - 1
                elif dy == 1:
                    c = b + 1
                else:
                    c = mot.get((dx, dy), b)
                rows[dy].append(str(c))
    rows = [''.join(r) for r in rows]
    assert all(len(r) == 32 for r in rows), [len(r) for r in rows]
    return [r[-shift:] + r[:-shift] if shift else r for r in rows]


def floor_stone_b():
    """긴 장대석 바닥. 줄 높이 11·10·11px, 돌 길이 14~22px, 이음 자리가 줄마다 다르다."""
    rows = []
    rows += _course([(20, 4, {(4, 4): 3, (5, 4): 3, (6, 4): 3, (13, 7): 5, (14, 7): 5, (9, 8): 3}),
                     (12, 3, {(3, 5): 4, (4, 5): 4, (8, 3): 2})], 6, 11)
    rows += _course([(14, 4, {(3, 3): 5, (4, 3): 5, (8, 6): 3, (9, 6): 3}),
                     (18, 4, {(5, 4): 3, (6, 4): 3, (7, 4): 3, (12, 6): 5, (13, 6): 5})], 17, 10)
    rows += _course([(17, 3, {(4, 4): 4, (5, 4): 4, (11, 7): 2}),
                     (15, 4, {(3, 6): 3, (4, 6): 3, (5, 6): 3, (9, 3): 5, (10, 3): 5})], 26, 11)
    return grid(rows, SHI), {'note': '긴 장대석(14~22px) 가로 줄·이음 엇갈림. 큰 문파 연무장의 반듯한 돌바닥.'}


def floor_stone_c():
    """작은 네모 방전(8×8) 바둑판 깔기. 벽돌마다 밝기·닳은 자리를 손으로 정했다."""
    # (바탕 단, {(dx, dy): 단}) — 4×4 = 16장, 왼쪽 위부터 가로로
    bricks = [
        (4, {(3, 4): 3, (4, 4): 3}), (3, {}), (4, {(4, 3): 5, (5, 3): 5}), (4, {(2, 5): 3}),
        (4, {}), (4, {}), (3, {(2, 4): 2}), (4, {(3, 5): 3}),
        (3, {(4, 5): 4}), (4, {(2, 2): 3, (3, 2): 3}), (4, {}), (4, {(3, 4): 5, (4, 4): 5}),
        (4, {(5, 5): 3}), (4, {}), (3, {(3, 3): 2}), (4, {(2, 3): 3, (3, 3): 3}),
    ]
    rows = [[''] * 32 for _ in range(32)]
    rows = [list('0' * 32) for _ in range(32)]
    for i, (b, mot) in enumerate(bricks):
        bx, by = (i % 4) * 8, (i // 4) * 8
        for dy in range(8):
            for dx in range(8):
                if dy == 0 or dx == 0:
                    c = 1
                elif dy == 7 or dx == 7:
                    c = b - 1
                elif dy == 1:
                    c = b + 1
                else:
                    c = mot.get((dx, dy), b)
                rows[by + dy][bx + dx] = str(c)
    # 닳아 깨진 귀퉁이 두 곳(손으로 고른 좌표)
    for x, y, c in ((15, 9, 1), (14, 9, 2), (15, 10, 2), (24, 31, 2), (25, 31, 2), (24, 30, 2)):
        rows[y][x] = str(c)
    rows = [''.join(r) for r in rows]
    return grid(rows, SHI), {'note': '작은 네모 방전(8px) 바둑판·이음 곧음. 벽돌마다 밝기가 다르다. 관청·도관 마당 느낌.'}


# ---------------------------------------------------------------------------
# 3. 객잔 벽면 — 붉은 기둥 + 회벽 (3×2, 가로 반복)
# 맨 위 3행이 보(도리) 윗면 = 위에서 보이는 면. 그 아래 앞면.
# ---------------------------------------------------------------------------
WALL_LEG = {
    'K': 'ink',
    'a': ('mu', 1), 'b': ('mu', 2), 'c': ('mu', 3), 'd': ('mu', 4), 'e': ('mu', 5), 'f': ('mu', 6),
    'r': ('zhu', 1), 's': ('zhu', 2), 't': ('zhu', 3), 'u': ('zhu', 4), 'v': ('zhu', 5), 'w': ('zhu', 6),
    '2': ('bai', 2), '3': ('bai', 3), '4': ('bai', 4), '5': ('bai', 5), '6': ('bai', 6),
    'g': ('shi', 2), 'h': ('shi', 3), 'i': ('shi', 4), 'j': ('shi', 5),
    'm': ('huang', 2), 'n': ('huang', 3), 'o': ('huang', 4), 'p': ('huang', 5), 'q': ('huang', 6),
    'x': ('jin', 3), 'y': ('jin', 4), 'z': ('jin', 5),
}


def _overlay(rows, col_rows, x0, y0):
    """rows(문자열 목록) 위에 col_rows 를 (x0, y0) 부터 덮는다. 가로는 감는다(반복 벽)."""
    rows = [list(r) for r in rows]
    w = len(rows[0])
    for j, cr in enumerate(col_rows):
        for i, ch in enumerate(cr):
            if ch != '.':
                rows[y0 + j][(x0 + i) % w] = ch
    return [''.join(r) for r in rows]


PILLAR = "ruvutr"          # 둥근 주칠 기둥 6px: 윤곽·밝은 왼쪽·하이라이트·몸·그늘·윤곽
PLINTH_TOP = "hjjjjjjh"    # 초석 윗면(8px)
PLINTH_F1 = "giiiiiih"
PLINTH_F2 = "ghhhhhhg"


def wall_a():
    """흰 회벽 + 주칠 기둥(24px 간격) + 가운데 띠장, 한 칸에 살창. 보 윗면 3행."""
    rows = [
        "b" * 48,
        "eeeeffeeeeeeeeeeeeeefffeeeeeeeeeeeeeeeeeeffeeeee",
        "dddddddddeeddddddddddddddddddeeedddddddddddddddd",
        "a" * 48,                                                     # 윗면/앞면 경계
        "dddddddddddddddddddddddddddddddddddddddddddddddd",
        "cccccbbccccccccccccccccccccccbbbcccccccccccccccc",
        "cccccccccccccccbbbccccccccccccccccccccccccbbcccc",
        "b" * 48,
        "a" * 48,                                                     # 보 밑 그늘
        "22222222222222222222222222222222222222222222222",
    ]
    rows[-1] = "2" * 48
    plaster = [
        "666455666666666666666556666445666666666666665566",
        "666456666666656666666666666456666666666666666666",
        "666456666666666666666666666456666666666666666666",
        "666456666655666666666666666456666666655666666666",
        "666456666666666666666666666456666666666666666666",
        "666456666666666666666666666456666666666666666666",
        "666456666666666666666556666456666666666666666666",
        "dddddddddddddddddddddddddddddddddddddddddddddddd",           # 띠장 윗면
        "cccccccccccccccccccccccccccccccccccccccccccccccc",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "666456666666666666666666666456666666666666666666",
        "666456666666666666666666666456666666666556666666",
        "666456665566666666666666666456666666666666666666",
        "666456666666666666666666666456666666666666666666",
        "666456666666666666666666666456666666666666666666",
        "666456666666666666655666666456666666666666666666",
        "666456666666666666666666666456666666666666666666",
        "555455555555555555555555555455555555555555555555",
    ]
    rows += plaster
    rows += [
        "dddddddddddddddddddddddddddddddddddddddddddddddd",           # 굽도리 윗면
        "cccccccccccccccccccccccccccccccccccccccccccccccc",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "a" * 48,
    ]
    rows = rows[:32]
    # 살창(두 번째 칸): 틀 b, 살 c, 창호지 5, 창턱 윗면 d
    win = [
        "bbbbbbbbbbbb",
        "b5c55c55c55b",
        "bcccccccccc b".replace(' ', ''),
        "b5c55c55c55b",
        "b5c55c55c55b",
        "bcccccccccc b".replace(' ', ''),
        "b5c55c55c55b",
        "eddddddddddd",
        "bbbbbbbbbbbb",
    ]
    win = [w[:12] for w in win]
    rows = _overlay(rows, win, 30, 10)
    assert len(rows) == 32, len(rows)
    pil = [PILLAR] * 19
    pil[0] = "rssssr"  # 보 밑 그늘이 기둥 머리에 진다
    for x in (21, 45):
        rows = _overlay(rows, pil, x, 9)
        rows = _overlay(rows, [PLINTH_TOP, PLINTH_F1, PLINTH_F2], x - 1, 28)
    return grid(rows, WALL_LEG), {'top': (0, 3), 'note': '흰 회벽·주칠 둥근 기둥(24px 간격)·가운데 띠장·살창 하나·초석. 맨 위 3행이 보 윗면.'}



def wall_b():
    """기와 얹은 담머리(윗면) + 황토 회벽 위 + 짙은 나무 징두리 판벽 아래 + 기둥 양옆 까치발(주칠)."""
    W = dict(WALL_LEG)
    W.update({'A': ('wa', 1), 'B': ('wa', 2), 'C': ('wa', 3), 'D': ('wa', 4), 'E': ('wa', 5), 'F': ('wa', 6)})
    rows = [
        "B" * 48,
        "DEDCDEDCDEDCDEDCDEDCDEDCDEDCDEDCDEDCDEDCDEDCDEDC",     # 담머리 기와 윗면
        "DEDCDFDCDEDCDEDCDEDCDFDCDEDCDEDCDEDCDEDCDFDCDEDC",
        "CDCBCDCBCDCBCDCBCDCBCDCBCDCBCDCBCDCBCDCBCDCBCDCB",
        "BDEBBDEBBDEBBDEBBDEBBDEBBDEBBDEBBDEBBDEBBDEBBDEB",     # 막새
        "KAAKKAAKKAAKKAAKKAAKKAAKKAAKKAAKKAAKKAAKKAAKKAAK",
        "dddddddddddddddddddddddddddddddddddddddddddddddd",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",     # 보에 칠한 금띠
        "cccccccccbbccccccccccccccccccccccccbbbcccccccccc",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "a" * 48,
        "mmmnoppppppppppppppppppmmmmmmmmnoppppppppppppppp",
        "ppnopppppppqqppppppppppppppppnoppppppppppppppqqp",
        "ppnoppppppppppppppppopppppppnopppppppppppppppppp",
        "ppnopppppppppppppppppppppppnoppppppppoppppppppppp"[:48],
        "ppnoppppppppppppppppppppppppnopppppppppppppppppp",
        "ppnoppppppppoppppppppppppppnopppppppppppppppppppp"[:48],
        "ppnopppppppppppppppppppppppnopppppppppppppppppqp"[:48],
        "ppnoppppppppppppppppppppppppnopppppppppppppppppp",
        "ppnopppppppppppppppppppqpppnopppppppppppppppppppp"[:48],
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",     # 징두리 띠 윗면
        "dddddddddddddddddddddddddddddddddddddddddddddddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "cccdddddddcddddddddcccccccdddddddcddddddddcccccc",     # 판벽: 띠 c, 판 윗모서리 d
        "cccdbbbbbbcdbbbbbbbcccccccdbbbbbbcdbbbbbbbcccccc",
        "cccdbbbbbbcdbbbbbbbcccccccdbbbbbbcdbbbbbbbcccccc",
        "cccdbbcbbbcdbbbbcbbcccccccdbbbbbbcdbbbcbbbcccccc",
        "cccdbbbbbbcdbbbbbbbcccccccdbbbbbbcdbbbbbbbcccccc",
        "cccdbbbbbbcdbbbbbbbcccccccdbbbbbbcdbbbbbbbcccccc",
        "cccaaaaaaacaaaaaaaacccccccaaaaaaacaaaaaaaacccccc",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "a" * 48,
    ]
    assert len(rows) == 32, len(rows)
    pil = [PILLAR] * 19
    pil[0] = "rssssr"
    for x in (21, 45):
        rows = _overlay(rows, pil, x, 10)
        rows = _overlay(rows, ["tuuu", "rtuu", ".rty", "..ry"], x - 4, 11)       # 왼쪽 까치발
        rows = _overlay(rows, ["uuut", "uutr", "ytr.", "yr.."], x + 6, 11)       # 오른쪽 까치발
        rows = _overlay(rows, [PLINTH_TOP, PLINTH_F1, PLINTH_F2], x - 1, 28)
    return grid(rows, W), {'top': (0, 4), 'note': '담머리에 청회색 기와(윗면 4행)·금띠 칠한 보·황토 회벽·짙은 판벽 징두리·기둥 까치발. 바깥 담/객잔 정면.'}


def wall_c():
    """주칠 격자 창살 벽: 16px 간격 가는 기둥 사이를 창살문(위)과 궁창 판(아래)으로 채웠다."""
    rows = [
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "eeeeeeeffeeeeeeeeeeeeeeeeeeeeeffeeeeeeeeeeeeeeee",     # 보 윗면
        "dddddddddddddddddddddeedddddddddddddddddddddddde",
        "a" * 48,
        "ddddddddddddddddddddddddddddddddddddddddddddddde",
        "cccccccbbccccccccccccccccccccccccbbbcccccccccccc",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "a" * 48,
    ]
    # 칸 하나(16px) = 기둥 5px + 창살 11px. 창살: 틀 s, 살 t, 창호지 6/5
    bay = [
        "sssssssssss",
        "s6t66t66t6s",
        "s6t66t66t6s",
        "sttttttttts",
        "s6t66t66t6s",
        "s6t66t66t6s",
        "sttttttttts",
        "s6t66t66t6s",
        "s5t66t66t5s",
        "sttttttttts",
        "s6t66t66t6s",
        "s5t55t55t5s",
        "sssssssssss",
        "vvvvvvvvvvv",     # 가운데 띠 윗면
        "uuuuuuuuuuu",
        "sssssssssss",
        "svvvvvvvvvs",     # 궁창 판: 윗모서리 밝음
        "svuuuuuuuts",
        "svuuxxxuuts",     # 금 장식 하나
        "svuuuuuuuts",
        "sttttttttts",
        "sssssssssss",
    ]
    pil = "ruvtr"
    for y in range(22):
        line = ''
        for bx in range(3):
            line += (pil if y > 0 else "rsssr") + bay[y]
        rows.append(line)
    rows += [
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",     # 문지방 윗면
        "a" * 48,
    ]
    assert len(rows) == 32, len(rows)
    return grid(rows, WALL_LEG), {'top': (0, 3), 'note': '주칠 창살문 벽(16px 간격 가는 기둥)·창호지·궁창 판·문지방. 객잔 2층 객실 앞·찻집 칸막이.'}


# ---------------------------------------------------------------------------
# 4. 청회색 기와 지붕 조각 (3×2, 가로 반복) — 지붕 앞사면(윗면) + 처마
# ---------------------------------------------------------------------------
ROOF_LEG = dict(WALL_LEG)
ROOF_LEG.update({'A': ('wa', 1), 'B': ('wa', 2), 'C': ('wa', 3), 'D': ('wa', 4), 'E': ('wa', 5), 'F': ('wa', 6), 'O': ('wa', 0)})


def _rep(period, n, patch=None):
    """한 주기 문자열을 n 번 잇고, patch {x: 글자} 로 몇 자리를 손으로 바꾼다."""
    line = list(period * n)
    for x, ch in (patch or {}).items():
        line[x] = ch
    return ''.join(line)


def roof_a():
    """수키와 세로 골(6px 주기)·5행마다 기와 이음·둥근 막새·처마 밑 주칠 서까래 끝."""
    body = "AEDCAB"      # 수키와(A 골 그늘 E 빛 D C) + 암키와 골(A B)
    joint = "OCBAOA"     # 기와 이음 줄(윗기와 끝 그늘)
    lip = "AFEDAB"       # 이음 바로 아래 겹친 모서리 빛
    rows = []
    for y in range(21):
        k = (y + 2) % 5
        if k == 4:
            rows.append(_rep(joint, 8))
        elif k == 0:
            rows.append(_rep(lip, 8))
        else:
            rows.append(_rep(body, 8, {13: 'D', 31: 'C', 44: 'D'} if y in (3, 13) else None))
    rows += [
        _rep("OCDCOA", 8),    # 막새 윗부분
        _rep("DFEDBA", 8),    # 막새 얼굴(빛)
        _rep("DEEDBA", 8),
        _rep("CDDCKA", 8),    # 막새 아래 + 암막새 뾰족
        _rep("KCCKKK", 8),
        _rep("KKKKKK", 8),    # 처마 그늘
        _rep("KvuKKK", 8),    # 서까래 끝(주칠 둥근 머리)
        _rep("KutKaa", 8),
        _rep("aaaaaa", 8),
        _rep("bbbbbb", 8),    # 처마도리
        _rep("aaaaaa", 8),
    ]
    assert len(rows) == 32
    return grid(rows, ROOF_LEG), {'top': (0, 21), 'note': '수키와 세로 골(6px)·둥근 막새·처마 밑 주칠 서까래 끝. 정통 청회색 기와.'}


def roof_b():
    """평기와 물고기 비늘 겹침 — 4행마다 한 단, 단마다 반 장 어긋남, 기와 아래끝이 둥글다. 처마는 주칠 판."""
    tile = [            # 6×4 한 장: 윗부분은 윗단에 덮이고 아래끝이 둥글게 끝난다
        "ABBBBA",
        "BCDDCB",
        "CDEEDC",
        "BDEFDB",
    ]
    rows = []
    for c in range(6):            # 6단 × 4행 = 24행
        off = 0 if c % 2 == 0 else 3
        for r in tile:
            line = r * 8
            rows.append(line[-off:] + line[:-off] if off else line)
    rows[9] = rows[9][:20] + 'E' + rows[9][21:]   # 손으로 몇 장 밝게(유약 반짝임)
    rows[17] = rows[17][:38] + 'E' + rows[17][39:]
    rows += [
        _rep("BDEEDB", 8),    # 막새 단
        _rep("ACDDCA", 8),
        _rep("KACCAK", 8),
        _rep("KKAAKK", 8),
        _rep("vvvvvv", 8),    # 주칠 처마판 윗모서리
        _rep("uuuyuu", 8),    # 금 점 장식
        _rep("ssssss", 8),
        _rep("KKKKKK", 8),
    ]
    assert len(rows) == 32
    return grid(rows, ROOF_LEG), {'top': (0, 26), 'note': '평기와 물고기 비늘 겹침(단마다 반 장 어긋남)·주칠 처마판·금 점. 강남 객잔풍, 밝고 평평하다.'}


def roof_c():
    """용마루부터 처마까지 한 조각: 위 6행 용마루(투각 무늬 띠), 가운데 수키와 4px 골, 아래 막새·두공 끝."""
    rows = [
        _rep("KKKK", 12),
        _rep("DEEDEEDEEDEE", 4),        # 용마루 윗면(밝음)
        _rep("DDDDDDDDDDDD", 4),
        _rep("CBDBCCBDBCCB", 4),        # 투각 무늬 띠
        _rep("BCBCBBCBCBBC", 4),
        _rep("AAAA", 12),               # 용마루 아래 그늘
    ]
    for y in range(18):
        k = y % 4
        if k == 3:
            rows.append(_rep("CDBA", 12))
        elif k == 0 and y > 0:
            rows.append(_rep("FDCB", 12))
        else:
            rows.append(_rep("EDCB", 12))
    rows += [
        _rep("DEAB", 12),               # 작은 막새
        _rep("ECAK", 12),
        _rep("AAKK", 12),
        _rep("KKKK", 12),
        _rep("KxyyKKKKxyyK", 4),        # 두공 끝(금)
        _rep("KtuuKaaKtuuK", 4),        # 두공(주칠)
        _rep("aaaaaaaaaaaa", 4),
        _rep("bbbbbbbbbbbb", 4),
    ]
    assert len(rows) == 32, len(rows)
    return grid(rows, ROOF_LEG), {'top': (1, 24), 'note': '용마루(무늬 띠)~앞사면~처마를 한 조각에: 좁은 전각·문루 지붕용. 골이 가늘고(4px) 처마 밑에 두공.'}


# ---------------------------------------------------------------------------
# 5. 목인장 (1×2, 물체) — 통나무 윗면(나이테)이 위에서 보여야 한다
# ---------------------------------------------------------------------------
DUMMY_LEG = {str(i): ('song', i) for i in range(7)}
DUMMY_LEG.update({'K': 'ink', 'a': ('mu', 1), 'b': ('mu', 2), 'c': ('mu', 3), 'd': ('mu', 4), 'e': ('mu', 5), 'f': ('mu', 6),
                  'g': ('shi', 2), 'h': ('shi', 3), 'i': ('shi', 4), 'j': ('shi', 5), 'k': ('shi', 6),
                  'm': ('huang', 2), 'n': ('huang', 3), 'o': ('huang', 4), 'p': ('huang', 5), 'q': ('huang', 6)})


def dummy_a():
    """나무 받침판 위에 선 목인장: 위로 뻗은 두 팔·가운데 팔(나뭇결 끝이 보임)·아래 다리."""
    rows = [
        "................",
        "......KKKK......",
        "....KK5665KK....",   # 통나무 윗면(나이테)
        "....K564465K....",
        "....K456654K....",
        "....KK5555KK....",   # 윗면 앞 테두리
        "....K454332K....",
        "....K454332K....",
        ".KKKK454332KKKK.",   # 위 팔 둘(앞으로 뻗어 끝면이 보임)
        "K565K454332K553K",
        "K342K454332K322K",
        ".KKKK454332KKKK.",
        "....K454332K....",
        "....K45KK32K....",
        "....K4K65K2K....",   # 가운데 팔 끝면
        "....K4K43K2K....",
        "....K45KK32K....",
        "....K454332K....",
        "....K454332K....",
        "....K454332K....",
        "...KKK54332K....",
        "..K54K54332K....",   # 다리(아래 왼쪽으로 꺾임)
        "..K43KK4332K....",
        "...KK.K4332K....",
        "......K4332K....",
        ".KKKKKKKKKKKKKK.",
        "K66666555555555K",   # 받침판 윗면
        "K55555555554444K",
        "K33333333333322K",   # 받침판 앞면
        "K22222222222211K",
        ".KKKKKKKKKKKKKK~",
        "..~~~~~~~~~~~~~~",
    ]
    return grid(rows, DUMMY_LEG), {'top': (2, 5), 'note': '받침판 위 목인장(밝은 소나무)·윗면 나이테·두 팔과 가운데 팔 끝면·꺾인 다리·받침판 윗면.'}


def dummy_b():
    """돌 받침 위 짙은 나무 목인장, 몸통에 새끼줄 두 줄. 팔은 짧고 굵다."""
    rows = [
        "................",
        ".....KKKKKK.....",
        "....KeffeedK....",   # 통나무 윗면
        "....KfedcdeK....",
        "....KeeddeeK....",
        "....KKddddKK....",
        "....KdedcbaK....",
        "....KoqpponK....",   # 새끼줄
        "....KnoonmmK....",
        "..KKKdedcbaKKK..",
        ".KedKdedcbaKdcK.",   # 위 팔
        ".KcbKdedcbaKbaK.",
        "..KKKdedcbaKKK..",
        "....KdedcbaK....",
        "....KdeKKbaK....",
        "....KdKedKaK....",   # 가운데 팔 끝면
        "....KdKcbKaK....",
        "....KdeKKbaK....",
        "....KoqpponK....",   # 새끼줄
        "....KnoonmmK....",
        "....KdedcbaK....",
        "..KKKdedcbaK....",
        ".KedKKedcbaK....",   # 다리
        ".KcbK.KdcbaK....",
        "..KK..KdcbaK....",
        "..KKKKKKKKKKKK..",
        ".KkkkjjjjjjjiiK.",   # 돌 받침 윗면
        ".KjjjjiiiiiiihK.",
        ".KiiiiihhhhhhgK.",   # 돌 받침 앞면
        ".KhhhhhhgggggggK"[:16],
        "..KKKKKKKKKKKK~~",
        "...~~~~~~~~~~~~.",
    ]
    rows[29] = ".KhhhhhhgggggggK"
    return grid(rows, DUMMY_LEG), {'top': (2, 5), 'note': '돌 받침 위 짙은 나무 목인장·새끼줄 두 줄·짧고 굵은 팔. 오래 쓴 무관(武館) 것.'}


def dummy_c():
    """가로대 두 개에 꿰어 건 목인장(벽걸이식): 가로대 끝 나뭇결이 보이고 몸통 뒤로 지나간다. 받침 없이 땅에 박은 기둥 둘."""
    rows = [
        "................",
        "......KKKK......",
        "....KK5665KK....",   # 통나무 윗면
        "....K564465K....",
        "....KK5555KK....",
        "KKKKK454332KKKKK",   # 위 가로대(윗면 한 줄 + 앞면)
        "56655454332555K5"[:16],
        "4444K454332K4433",
        "KKKKK454332KKKKK",
        ".KKK.454332.KKK.",
        "K565K454332K553K",   # 위 팔
        "K342K454332K322K",
        ".KKKK454332KKKK.",
        "....K45KK32K....",
        "....K4K65K2K....",   # 가운데 팔 끝면
        "....K4K43K2K....",
        "....K45KK32K....",
        "....K454332K....",
        "...KKK54332K....",
        "..K54K54332K....",   # 다리
        "..K43KK4332K....",
        "KKKKKKK4332KKKKK",   # 아래 가로대
        "5665555K332K5555",
        "4444443K332K4433",
        "KKKKKKKK332KKKKK",
        "K54K..K4332K.K3K",   # 가로대를 받친 말뚝 둘(앞면)
        "K43K..K4332K.K2K",
        "K43K..KKKKKK.K2K",
        "K43K.........K2K",
        "K32K.........K1K",
        "KKKK~~~~~~~~~KKK",
        ".~~~~~~~~~~~~~~~",
    ]
    rows[6] = "5665K454332K555K"
    return grid(rows, DUMMY_LEG), {'top': (2, 4), 'note': '가로대 두 개에 꿴 목인장(땅에 박은 말뚝 둘이 받침). 가로대 윗면·통나무 윗면이 보인다.'}


# ---------------------------------------------------------------------------
# 6. 둥근 탁자 + 걸상 넷 (2×2, 물체 묶음) — 덤
# ---------------------------------------------------------------------------
def _ell(inners, edge='K'):
    """타원 행 목록: inners 는 행마다 손으로 쓴 안쪽 화소열(가운데 정렬). 첫·끝 행은 윤곽만 쓴다."""
    wmax = max(len(i) for i in inners) + 2
    rows = []
    for i in inners:
        pad = (wmax - len(i) - 2) // 2
        rows.append('.' * pad + edge + i + edge + '.' * (wmax - len(i) - 2 - pad))
    return rows


# 탁자 윗면(26×11): 빛은 왼쪽 위, 앞 오른쪽으로 갈수록 어둡다
TOP_INNERS = [
    "KKKKKKKKKKKK",
    "66666666666655KK"[:16],
    "666666666666666655KK"[:20],
    "6666666666666666655554",
    "6666666666666666665554",
    "5666666666666666655544",
    "55566666666666665555443"[:22],
    "4555555555555555544433"[:22],
    "44445555555555444433",
    "KK333444444443333KK"[:16],
    "KKKKKKKKKKKK",
]


def _top(face, edge):
    """윗면 타원 + 2행 아래로 내린 같은 타원(두께 띠)."""
    inner = [r for r in TOP_INNERS]
    body = _ell(inner)
    band = _ell([''.join(edge if c not in 'K' else 'K' for c in r) for r in inner])
    w, h = len(body[0]), len(body) + 2
    cv_rows = [list('.' * w) for _ in range(h)]
    for j, r in enumerate(band):
        for i, ch in enumerate(r):
            if ch != '.':
                cv_rows[j + 2][i] = ch
    for j, r in enumerate(body):
        for i, ch in enumerate(r):
            if ch != '.':
                cv_rows[j][i] = face.get(ch, ch)
    return [''.join(r) for r in cv_rows]


STOOL_DRUM = [      # 둥근 북 걸상 8×8: 윗면 타원 + 몸통
    "..KKKK..",
    ".K6655K.",
    "K665554K",
    "K455543K",
    "KKKKKKKK",
    "K5u4u32K",
    "K4433u2K",
    ".KKKKKK.",
]
STOOL_SQUARE = [    # 네모 걸상 8×8: 윗면 판 + 다리 넷
    "KKKKKKKK",
    "K666665K",
    "K555544K",
    "KKKKKKKK",
    "K4K..K2K",
    "K4K..K2K",
    "K3K..K1K",
    "KKK..KKK",
]
STOOL_STONE = [     # 돌 북 걸상 8×8
    "..KKKK..",
    ".K6655K.",
    "K665554K",
    "K455543K",
    "K544332K",
    "K443322K",
    "K332221K",
    ".KKKKKK.",
]


def _table(leg, top_face, edge, stool, pedestal, deco=None):
    cv = Cv(32, 32)
    stamp(cv, stool, leg, 12, 0)                   # 뒤 걸상(탁자에 반쯤 가림)
    top = _top(top_face, edge)
    stamp(cv, pedestal, leg, 12, 16)               # 받침 기둥
    stamp(cv, top, leg, 3, 5)                      # 윗면 + 두께
    if deco:
        for rows, x, y in deco:
            stamp(cv, rows, leg, x, y)
    stamp(cv, stool, leg, 0, 15)                   # 왼쪽 걸상
    stamp(cv, stool, leg, 24, 15)                  # 오른쪽 걸상
    stamp(cv, stool, leg, 12, 24)                  # 앞 걸상
    for x, y in ((8, 23), (9, 23), (31, 23), (20, 31), (21, 31), (22, 30), (23, 22), (22, 23)):
        cv.shadow(x, y)
    return cv


def table_a():
    """짙은 나무 둥근 탁자 + 둥근 북 걸상(붉은 테) 넷. 가운데 기둥 하나."""
    leg = {str(i): ('mu', i) for i in range(7)}
    leg.update({'K': 'ink', 'u': ('zhu', 3)})
    ped = ["KK44KK..", ".K43K...", ".K32K...", "KK32KK..", "K4332K..", "KKKKKK.."]
    ped = [r[:6] for r in ped]
    grain = [(["5555"], 9, 8), (["555"], 17, 10), (["44444"], 12, 13)]
    return _table(leg, {}, '2', STOOL_DRUM, ped, grain), {'top': (5, 15), 'note': '짙은 나무 둥근 탁자·가운데 기둥·둥근 북 걸상 넷(붉은 테). 탁자 윗면·걸상 윗면이 보인다.'}


def table_b():
    """밝은 소나무 둥근 탁자에 주칠 테두리, 위에 찻주전자와 잔 넷. 네모 걸상."""
    leg = {str(i): ('song', i) for i in range(7)}
    leg.update({'K': 'ink', 'u': ('zhu', 3), 'r': ('zhu', 2), 'w': ('bai', 6), 'x': ('bai', 5), 'y': ('bai', 4), 'z': ('bai', 3),
                'g': ('zhuz', 4)})
    ped = ["K4KK2K", "K4KK2K", "K3KK1K", "K3KK1K", "KKKKKK", "......"]
    teapot = ["..K...", ".KwK..", "KwwxKK", "KwxyKg", ".KKK.."]   # 뚜껑 꼭지·오른쪽 주둥이
    cup = ["KyK", ".K."]
    deco = [(teapot, 8, 7), (cup, 17, 8), (cup, 21, 10), (cup, 15, 12)]
    return _table(leg, {}, 'r', STOOL_SQUARE, ped, deco), {'top': (5, 15), 'note': '밝은 소나무 탁자·주칠 두께 띠·찻주전자와 잔 넷·네모 걸상. 객잔 찻자리.'}


def table_c():
    """돌 북 탁자(石鼓桌): 기둥 없이 통째 북 모양 — 둥근 윗면 아래로 앞면(원통)이 길게 보인다. 돌 북 걸상은 네 귀퉁이에."""
    leg = {str(i): ('shi', i) for i in range(7)}
    leg.update({'K': 'ink'})
    drum = [   # 20×19 손으로: 윗면 타원(0~6행) + 원통 앞면(7~16행) + 아래 곡선
        "......KKKKKKKK......",
        "...KKK66666655KKK...",
        "..K66666666666555K..",
        ".K6666666665566554K.",
        "K566666666666655544K",
        "K455556666655554443K",
        "K244455555554444332K",
        "K443333333333333221K",
        "K443333333333332221K",
        "K422222222222222211K",   # 새긴 홈
        "K454444444444443321K",
        "K443333333333333221K",
        "K443333333333332221K",
        "K433333333333332211K",
        "K433333333333322211K",
        ".K3322222222222211K.",
        "..KK22222222221KKK..",
        "....KKKKKKKKKKK.....",
        "...................."[:20],
    ]
    stool = [  # 돌 북 걸상 7×8: 윗면 타원 + 새긴 띠
        ".KKKKK.",
        "K66655K",
        "K45554K",
        "KKKKKKK",
        "K43321K",
        "K22221K",
        "K43321K",
        ".KKKKK.",
    ]
    cv = Cv(32, 32)
    stamp(cv, stool, leg, 2, 1)      # 왼쪽 뒤
    stamp(cv, stool, leg, 23, 1)     # 오른쪽 뒤
    stamp(cv, drum, leg, 6, 6)
    stamp(cv, stool, leg, 1, 22)     # 왼쪽 앞
    stamp(cv, stool, leg, 24, 22)    # 오른쪽 앞
    for x, y in ((24, 23), (25, 23), (23, 22), (22, 23), (8, 30), (9, 30), (31, 30), (31, 29)):
        cv.shadow(x, y)
    return cv, {'top': (6, 12), 'note': '청석 북 탁자(기둥 없는 통짜 원통·새긴 홈)·돌 북 걸상 넷을 귀퉁이에. 마당·정원·산중 정자용.'}


CANDIDATES = {
    'inn_floor_wood': {'A': floor_wood_a, 'B': floor_wood_b, 'C': floor_wood_c},
    'yard_floor_stone': {'A': floor_stone_a, 'B': floor_stone_b, 'C': floor_stone_c},
    'inn_wall_pillar': {'A': wall_a, 'B': wall_b, 'C': wall_c},
    'roof_tile_eave': {'A': roof_a, 'B': roof_b, 'C': roof_c},
    'training_dummy': {'A': dummy_a, 'B': dummy_b, 'C': dummy_c},
    'round_table_stools': {'A': table_a, 'B': table_b, 'C': table_c},
}

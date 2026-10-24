"""theme-props-r2 — 광차·금 간 바닥 다시 그림(2026-10-24). r1 독립 VQA(sonnet+argon) 반영:
  광차  「윗면이 앞에서 본 납작한 판 · 통 안이 안 보임 · 바퀴가 선로 두 줄을 밟지 않음」
        → 3/4: 뒤 테두리(4~5행) · 통 안 광석 더미(6~10행, 뒤 테두리 위로 봉우리가 솟음) · 앞 테두리 밝은 쇠(11~12행) ·
          앞면 널(13~22행, 다섯 줄마다 1화소씩 좁아지는 사다리꼴 = 위가 넓은 통) · 쇠테 두 줄 + 모서리 쇠 + 못 ·
          앞 바퀴 둘이 선로 두 레일(5행·11행) 위에 걸치게 놓는다(장면).
  금 간 바닥 「흐린 번짐 · 북쪽 안쪽에 판석 두께 없음 · A2 베벨 판」
        → 성 판석 2×2(바닥 키트와 같은 줄눈 자리) 가운데가 깨져 꺼짐: 구멍 북쪽 안벽 = 판석 옆면 빛(c) · 그늘(b) · 짙은 끝(j) ·
          깊은 어둠, 남쪽 테두리 = 밝은 턱(k), 방사 금 1화소 어둠 + 오른쪽 빛, 떨어진 돌 조각. 번짐 없음.
          A1 = 성 판석, A2 = 신전 석회 판석(marble).
도깨비불 A1·얼음 벽은 이 판에 없다(도깨비불 A1 은 r1 두 검수 PASS, 얼음 벽은 r3 따로).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_earth_r1 as E1  # noqa: E402
import theme_props_r1 as P1  # noqa: E402

WAVE = 'theme_props'
L = P1.L
G = P1.G

CART = [
    '................................',
    '................................',
    '.............tu....p............',
    '..........ttu.ttuu..pq..........',
    '...lkkkksttuutsttukpqpoktukij...',
    '...lkiiiiiiiiiiiiiiiiiiiiiiij...',
    '...lksttsoptsstuttsooppsttsij...',
    '...lktsnopossttsnopqosstsstij...',
    '...lkssttsonssttssnossttsssij...',
    '...lkgssstssggsstssgssstssgij...',
    '...lkgggsgggggsgggggsggggsgij...',
    '...lllllllllllllllllllllllllk...',
    '...kkkkkkkkkkkkkkkkkkkkkkkkki...',
    '...jkbbbbbbbbbbbbbbbbbbbbbbhg...',
    '...jkddedddbdeddddddbdccdcchg...',
    '...kliiiiiiliiiiiiiijihhhhhjg...',
    '...jkhhhhhhhhhhhhhhhhhggggghg...',
    '...jkdeddddbdddeddddbdccccchg...',
    '....jkdddddbddddddddbccdcchg....',
    '....jkddeddbddddddddbccccchg....',
    '....lkiiiiiliiiiiiiijhhhhhjg....',
    '....jkhhhhhhhhhhhhhhhggggghg....',
    '....jkjkkjdbddddedddbjkkjchg....',
    '.....jllkijgggggggggjllkij......',
    '.....klhhikg........klhhik......',
    '.....kkhgikhhhhhhhhhkkhgik......',
    '.....jiihij.........jiihij......',
    '......jiij...........jiij.......',
    '......~~~~~~~~~~~~~~~~~~~~......',
    '........~~~~~~~~~~~~~~~~........',
    '................................',
    '................................',
]

CRACK = [
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggjkggggghhhhhdggggggjkgg',
    'hhhhhdggggjkgggghhhhhdgggggjkggg',
    'hhhhhdgggggjkggghhhhhdggggjkgggg',
    'hhhhhdgggggjkggghhhhhdggjkgggggg',
    'dddddddddddddddddddddddddddddddd',
    'ggggggdggggggjdddddggjdggggggggg',
    'ggggggdgggggddcccccddgdggggggggg',
    'ggggggdgggddccbbbbbccddggggggggg',
    'ggjjkgdggdccbbjjjjjbbcdggggggggg',
    'ggggjkdgjcbbjjpqppqjjbcdgbcggggg',
    'ggggggdjdbjjppqppqppqjbckggggggg',
    'ggggggdjcjqppqoooooqppjbdggggggg',
    'dddddddjbqppoooooooooqpjcjdddddd',
    'hhhhhdgjjpoooooooooooopqkggjjkgg',
    'hhhhhdcgkjooooooooooooopkggggjjk',
    'hhhhhdggjjoooooooooooookgggggggg',
    'hhhhhdgggkjoooooooooookggggggggg',
    'hhhhhdgggjkjoooooooookgggggggggg',
    'hhhhhdggjkgkkjoooookkdgggggggggg',
    'hhhhhdgjkggggkkkkkjkhdgggggggggg',
    'dddddddddddddddddddddddddddddddd',
    'gggggjdgggcbgggggggjkgdggggggggg',
    'ggggjkdggggggggggggjkgdggggggggg',
    'gggjkgdgggggggggggggjkdggggggggg',
    'ggjkggdgggggggggggggjkdggggggggg',
    'ggggggdggggggggggggggjdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'dddddddddddddddddddddddddddddddd',
]
CRACK2 = [
    'gggggggggggggggghhhhhhhhhhhhhhhh',
    'gggggggggggggggghhhhhhhhhhhhhhhh',
    'gggggggggggggggghhhhhhhhhhhhhhhh',
    'gggggggggjkggggghhhhhhhhhhhhjkhh',
    'ggggggggggjkgggghhhhhhhhhhhjkhhh',
    'gggggggggggjkggghhhhhhhhhhjkhhhh',
    'gggggggggggjkggghhhhhhhhjkhhhhhh',
    'ggggggggggggjkgghhhhhhhjkhhhhhhh',
    'gggggggggggggjbbbbbhhjkhhhhhhhhh',
    'ggggggggggggbbcccccbbhhhhhhhhhhh',
    'ggggggggggbbccbbbbbccbhhhhhhhhhh',
    'ggjjkggggbccbbjjjjjbbcbhhhhhhhhh',
    'ggggjkjkjcbbjjpqppqjjbcbhbchhhhh',
    'gggggggjbbjjppqppqppqjbckhhhhhhh',
    'gggggggjcjqppqoooooqppjbbhhhhhhh',
    'gggggggjbqppoooooooooqpjcjjkhhhh',
    'gggggggjjpoooooooooooopqkggjjkgg',
    'ggggggcgkjooooooooooooopkggggjjk',
    'ggggggggjjoooooooooooookgggggggg',
    'gggggggggkjoooooooooookggggggggg',
    'gggggggggjkjoooooooookgggggggggg',
    'ggggggggjkgkkjoooookkggggggggggg',
    'gggggggjkggggkkkkkjkgggggggggggg',
    'ggggggggggggggggggjkgggggggggggg',
    'gggggjkgggcbgggggggjkggggggggggg',
    'ggggjkgggggggggggggjkggggggggggg',
    'gggjkgggggggggggggggjkgggggggggg',
    'ggjkggggggggggggggggjkgggggggggg',
    'gggggggggggggggggggggjkggggggggg',
    'gggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggg',
    'gggggggggggggggggggggggggggggggg',
]  # 신전 판석(16px 큰 판, 줄눈 없음 — 바닥 키트 floor-trav 와 같은 짜임)
# A1 성 판석(바닥 키트 floor-castle 과 같은 단: g crock6 · h cata4 · k cata6) · 줄눈·금 d castle3 · 판석 옆면 c b j · 구멍 o p q
LCRK = L('g:crock6 h:cata4 k:castle6 d:vrock2 c:vrock4 b:vrock3 j:vrock2 o:ostone1 p:ostone3 q:ostone2 G:cata5 H:cata3 M:cata6 N:vrock3 r:vrock1 R:castle5 D:castle2')
# A2 신전 석회 판석(floor-trav: marble6 · marble5)
LCRK2 = L('g:crock6 h:cata4 k:castle6 d:moss2 c:moss4 b:moss3 j:moss1 o:leaf0 p:moss1 q:leaf1 G:cata5 H:cata3 M:cata6 N:moss3 r:moss0 R:castle5 D:castle2')


def c_cart(n):
    def fn():
        cv = G(CART, P1.LCART if n == 1 else P1.LCART2)
        sc = E1.scene('mine', 7, 6, face_h=2)
        rail = E1.kit_cv('bd-pick-dungeon-theme-rails-ew')
        for x in range(7):
            E1.place(sc, rail, x, 4)
        # 바퀴 밑(28행) = 선로 아래 레일(11행) → 광차 윗끝 = 레일 칸 위로 한 칸 반
        E1.place(sc, cv, 2, 3, dy=-1)
        E1.put_actor(sc, 5, 4)
        return cv, {'kind': 'objects', 'parts': {'광차': cv}, 'vignette': sc}
    return fn


def textured(base=None):
    """판석 결(r2 object-gate: 「평면 채움」): 판석마다 해시 잡티 한 단 위·아래 + 드문 패인 점, 판석 윗줄 빛·아랫줄 그늘.
    구멍 깊은 곳은 o(가장 어두운 허공 void2 — 근흑 윤곽 아님) 바깥 p 로 한 단."""
    base = base or CRACK
    out = [list(r) for r in base]
    for y, r in enumerate(base):
        for x, c in enumerate(r):
            h = (x * 73856093 ^ y * 19349663 ^ 7 * 83492791) & 0xffffff
            if c == 'g':
                if base is CRACK and y % 8 == 0:
                    out[y][x] = 'M' if h % 3 else 'g'
                elif base is CRACK and y % 8 == 6:
                    out[y][x] = 'G'
                elif h % 5 == 0:
                    out[y][x] = 'M' if (h >> 4) % 2 else 'G'
                elif h % 23 == 1:
                    out[y][x] = 'H'
            elif c == 'h':
                if base is CRACK and y % 8 == 0:
                    out[y][x] = 'G'
                elif base is CRACK and y % 8 == 6:
                    out[y][x] = 'H'
                elif h % 5 == 0:
                    out[y][x] = 'G' if (h >> 4) % 2 else 'H'
                elif h % 23 == 1:
                    out[y][x] = 'N'
            elif c == 'o' and h % 9 == 0:
                out[y][x] = 'p' if False else 'o'
    return [''.join(r) for r in out]


def slab_shaded():
    """r2b: 판석마다 칠(object-gate: 「판석 한 장씩 음영이 없다·윤곽 근흑」). 성 판석 줄눈 자리는 바닥 키트와 같다(가로 7·15·23·31행,
    세로 5·21열 / 6·22열 엇갈림). 판석마다 몸 단(해시 g·G·h·H) · 윗줄과 왼 열 빛 M · 아랫줄과 오른 열 그늘 N · 결 잡티.
    구멍·금·줄눈 글자(o p q j b c d k)는 CRACK 그대로."""
    out = [list(r) for r in CRACK]
    bodies = ['g', 'G', 'h', 'g', 'H', 'G']
    for y, r in enumerate(CRACK):
        band = y // 8
        js = (5, 21) if band % 2 == 0 else (6, 22)
        for x, c in enumerate(r):
            if c not in 'gh':
                continue
            if x < js[0]:
                sx0, sx1, sid = -10, js[0] - 1, 0
            elif x < js[1]:
                sx0, sx1, sid = js[0] + 1, js[1] - 1, 1
            else:
                sx0, sx1, sid = js[1] + 1, js[0] + 31, 2
            hb = (band * 2654435761 ^ sid * 40503 ^ 0x5bd1) & 0xffff
            body = bodies[hb % len(bodies)]
            yy = y % 8
            h = (x * 73856093 ^ y * 19349663 ^ 83492791) & 0xffffff
            if (yy == 0 and x == sx0) or (yy == 6 and x == sx1):
                ch = 'd'                                   # 둥근 모서리(줄눈 색)
            elif yy == 0:
                ch = 'R'                                   # 윗변 빛 줄(가장 밝은 단)
            elif x == sx0 or yy == 1:
                ch = 'M'
            elif yy == 6 or x == sx1:
                ch = 'N'
            elif yy == 5 or x == sx1 - 1:
                ch = 'H' if body in 'gG' else 'N'
            elif h % 6 == 0:
                ch = {'g': 'G', 'G': 'h', 'h': 'H', 'H': 'h'}[body] if (h >> 4) % 2 else {'g': 'M', 'G': 'g', 'h': 'G', 'H': 'h'}[body]
            elif h % 29 == 3:
                ch = 'N'
            else:
                ch = body
            out[y][x] = ch
    # 금(j 바로 오른쪽이 빛 k)을 셋에 하나 N 으로 — 한 줄로 이어진 어두운 선이 아니라 단 차이로 읽히게
    for y in range(32):
        for x in range(31):
            if out[y][x] == 'j' and out[y][x + 1] == 'k' and (x + y) % 3 == 0:
                out[y][x] = 'N'
    return [''.join(r) for r in out]


def decal():
    """r2c: 투명 덧그림(바닥 위층, 걷는 칸) — 금·구멍·깨진 판 턱만 남기고 판석은 비운다. 성·묘지·신전 어느 바닥 위에도
    줄눈 경계 없이 앉는다(바탕 판석을 그려 넣으면 바닥 키트와 다른 칸이 사각 조각으로 보인다). 금·구멍 그늘은 재질 색조(근흑 아님)."""
    base = slab_shaded()
    hole = {(x, y) for y, r in enumerate(CRACK) for x, c in enumerate(r) if c in 'opq'}
    out = []
    for y, r in enumerate(CRACK):
        row = []
        for x, c in enumerate(r):
            near = any((x + dx, y + dy) in hole for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
            if c in 'opqjbck' or (near and c not in 'gh' + 'd'):
                row.append(base[y][x])
            elif near and c == 'd':
                row.append('b')            # 구멍 가 줄눈 = 깨진 판 그늘
            elif near:
                row.append('H' if (x + y) % 4 else 'N')   # 구멍 둘레 판 = 내려앉아 한 단 어둡다
            else:
                row.append('.')
        out.append(''.join(row))
    return out


def damaged():
    """r2d: 불투명 판석(판석마다 칠) — 줄눈은 바닥 키트와 같은 무채 회색(D), 구멍·금 둘레 3화소 안의 줄눈만 먼지 낀 재질 색조(d).
    2×2 바깥 변은 바닥과 같은 줄눈이라 사각 조각 경계가 생기지 않는다."""
    base = slab_shaded()
    dmg = {(x, y) for y, r in enumerate(CRACK) for x, c in enumerate(r) if c in 'opqjk'}
    out = []
    for y, r in enumerate(base):
        row = list(r)
        for x, c in enumerate(r):
            if CRACK[y][x] == 'd':
                near = any((x + dx, y + dy) in dmg for dx in range(-3, 4) for dy in range(-3, 4))
                row[x] = 'd' if near else 'D'
        out.append(''.join(row))
    return out


def c_crack(n):
    def fn():
        cv = G(damaged(), LCRK if n == 1 else LCRK2)
        floor = 'bd-pick-castle-catacombs-floor-castle'
        sc = E1.scene('castle' if n == 1 else 'catacomb', 7, 6, face_h=2, floor_kit=floor)
        E1.place(sc, cv, 3, 3)
        E1.put_actor(sc, 1, 4)
        return cv, {'kind': 'tile', 'parts': {'금 간 바닥': cv}, 'vignette': sc}
    return fn


NOTES = {
    ('prop.minecart', 'A1'): '3/4 광차: 뒤 테두리·통 안 금빛 광석 더미·앞 테두리·위가 넓은 널 통·쇠테 둘, 앞 바퀴가 두 레일에 걸침',
    ('prop.minecart', 'A2'): '같은 통 + 청록 마광석',
    ('prop.cracked_floor', 'A1'): '성 판석 2×2(판석마다 칠, 바깥 줄눈 = 바닥 키트 회색) 가운데가 꺼진 구멍(북쪽 안벽 판석 두께 세 단·남쪽 밝은 턱), 방사 금, 구멍 바닥 = 자두빛 어둠',
    ('prop.cracked_floor', 'A2'): '같은 판석, 금·구멍 그늘 = 이끼 낀 녹회색 톤(묘지·유적용)',
}
FNS = {'prop.minecart': {'A1': c_cart(1), 'A2': c_cart(2)}, 'prop.cracked_floor': {'A1': c_crack(1), 'A2': c_crack(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {k: P1.BOARD_REFS[k] for k in FNS}


def line_scenes():
    return {}

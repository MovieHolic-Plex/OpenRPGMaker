"""theme-cave-stal-r3 — r2 도 object-gate 화풍 반려(색 6, 종유석마다 3단, 윤곽 51% 무채색). r3: 종유석마다 가로 단면 명암 6단
(왼 윤곽 cfloor 1 갈색 → 빛 면 rim 5·4 → 몸 rim 3·2 → 그늘 rim 1 → 오른 윤곽 cfloor 0 갈색), 세로로는 2행마다 결 띠·잔점,
처마 턱은 rim 2~5 + 이끼 moss 2·3. 모양은 r1 A1 손 그림 그대로(열마다 덩이 너비로 단면을 다시 칠한다).

이하 r2 설명.

theme-cave-stal-r2 — r1 A1(Sonnet PASS) 모양 그대로, object-gate 화풍 반려(질감 없음·칸 정보량 부족 4/4)를 고친다:
종유석 몸에 바위 결(층 띠 2px 마다 한 단 아래·위, 화소 해시 얼룩), 처마 턱에 흙 잔점·이끼 몇 화소, 끝 물방울 빛.
원(A1) 모양 행 문자열은 그대로 두고 단만 바꾼다 — 모양은 손, 결은 규칙(열·행 해시).

이하 r1 설명.

theme-cave-stal-r1 — 자연 동굴 종유석(벽 앞면 걸이) tc.cave_stalactite (2026-10-27).

profiles.ts MISSING cave 「종유석 천장 늘어짐」. 줄 A(해안 흙굴) 바위 앞면 위 윗단에 매달린 흙빛 종유석 — 고른 얼음굴 고드름
(theme-climate-r1 tc.ice_icicles A2 「유리 고드름」)과 같은 짜임(처마 + 굵게 성긴 원뿔, 1칸·2칸 따로 손으로)을 흙굴 바위 단으로 다시 그렸다.
색: 줄 A 앞면 재질 rim 0~4 · cfloor 0·1(그늘) · moss 2(젖은 이끼 몇 화소). 먹 윤곽 없음 — 왼 가장자리 rim 1(바위 몸),
빛 받는 면 rim 3, 반짝 rim 4(뿌리 가까이), 몸 rim 2, 그늘 면 cfloor 1, 오른 윤곽 cfloor 0, 끝 = 물기 맺힌 rim 4 한 점.
A1 「굵은 종유석」(뿌리 넓고 짧게) · A2 「가는 종유석」(가늘고 길게, 몇 갈래).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
from theme_climate_lib import Cv, T, hcat, leg, ramp_chars, stamp  # noqa: E402

WAVE = 'theme_climate'
# k rim0 · b rim1 · m rim2 · l rim3 · h rim4 · d cfloor0 · c cfloor1 · g moss2
LG = leg(ramp_chars('rim', 'kbmlhwW'), ramp_chars('cfloor', 'dc'), g=('moss', 2), G=('moss', 3))


def cv_of(w, h, pieces):
    cv = Cv(w, h)
    for rows, x, y in pieces:
        stamp(cv, rows, LG, x, y)
    return cv


# 앞면 바위(rim 1·cfloor 0~1)와 갈리게: 종유석 몸은 한두 단 밝게(빛 면 h rim4 · 몸 l rim3 · 그늘 면 m rim2), 왼 가장자리 b rim1,
# 오른쪽에 바위 위로 드리운 그늘 한 줄 k(rim0) — 바위 앞면에서 떨어져 매달린 덩이로 읽히게. 뿌리는 처마 턱(위 2줄)에서 나온다.
A1_ONE = [
    'bhhlhlhhlhhlhlhb',
    'bllmllblllmllllm',
    '.bhlmk..bhlmk...',
    '.bhllmk.bhlmk...',
    '.bhllmk..blmk...',
    '..bhlmk..bhlk...',
    '..bhlmk..blmk...',
    '..bhlmk...blk...',
    '...blmk...bmk...',
    '...bhlk...bh....',
    '...blmk....h....',
    '....blk.........',
    '....bhk.........',
    '.....h..........',
    '................',
    '................',
]
A1_TWO = [
    'bhhlhlhhlhhlhlhbbhhlhlhhlhhlhlhb',
    'bllmllblllmllllmbllmllblllmllllm',
    '.bhllmk..bhlk....bhlmk.....bhlk.',
    '.bhhlmk..bhlk....bhllmk....bhlk.',
    '..bhlmk..bhk.....bhllmk....blmk.',
    '..bhllmk..bk......bhlmk.....blk.',
    '..bhlmk...h.......bhlmk.....bh..',
    '...bhlmk..........bhlmk......h..',
    '...bhlmk...........blmk.........',
    '...bhlk............bhlk.........',
    '....blmk...........bhk..........',
    '....bhlk............h...........',
    '.....blk........................',
    '.....bh.........................',
    '......h.........................',
    '................................',
]
A2_ONE = [
    'bhlhhlhhlhhlhhlb',
    'bllmllbllmlllllm',
    '.bhlk.bhk..bhlk.',
    '.bhlk.blk..bhlk.',
    '.bhlk..bk...blk.',
    '..blk..h....bhk.',
    '..bhk.......blk.',
    '..blk........bk.',
    '..bhk........bk.',
    '...bk........h..',
    '...bk...........',
    '...bh...........',
    '...h............',
    '................',
    '................',
    '................',
]
A2_TWO = [
    'bhlhhlhhlhhlhhlbbhlhhlhhlhhlhhlb',
    'bllmllbllmlllllmbllmllbllmlllllm',
    '.bhlk.bhk...bhk..bhlk.bhk.bhlk..',
    '.bhlk.blk...blk..bhlk.bk..bhlk..',
    '..blk..bk...bk...bhlk.h...bhlk..',
    '..bhk..h....bk....blk......blk..',
    '..blk.......h.....bhk......bhk..',
    '..bhk.............blk.......bk..',
    '...bk.............bhk.......bk..',
    '...bk..............bk.......h...',
    '...bk..............bk...........',
    '...h...............bh...........',
    '...................h............',
    '................................',
    '................................',
    '................................',
]


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


UP = {'k': 'b', 'b': 'm', 'm': 'l', 'l': 'h', 'h': 'h', 'c': 'm', 'd': 'c'}
DN = {'k': 'd', 'b': 'k', 'm': 'b', 'l': 'm', 'h': 'l', 'c': 'd', 'd': 'd'}


def textured(rows, salt):
    """손 모양(.=투명) 의 덩이마다 가로 단면을 6단으로 다시 칠한다: 맨 왼 = c(cfloor1 갈색 윤곽) · 1 = w(rim5 빛) · 2 = h(rim4) ·
    가운데 = l/m(rim3·2) · 오른 끝 앞 = b(rim1 그늘) · 맨 오른 = d(cfloor0 갈색 윤곽). 폭 1~2 끝은 l·b. 세로로 2행마다 한 단 결 띠, 해시 잔점.
    처마(위 2줄) = rim 2~5 결 + 이끼 g·G 몇 화소, 밑줄은 그늘 b."""
    H, W = len(rows), len(rows[0])
    out = [list(r) for r in rows]
    for y in range(H):
        r = rows[y]
        if y <= 1:
            for x, ch in enumerate(r):
                if ch == '.':
                    continue
                v = _h(x, y, salt) % 13
                if y == 0:
                    out[y][x] = 'w' if v < 3 else 'h' if v < 8 else 'l' if v < 11 else 'G'
                else:
                    out[y][x] = 'm' if v < 5 else 'b' if v < 9 else 'l' if v < 12 else 'g'
            continue
        x = 0
        while x < W:
            if r[x] == '.':
                x += 1
                continue
            x0 = x
            while x < W and r[x] != '.':
                x += 1
            w = x - x0
            if w == 1:
                seq = ['l']
            elif w == 2:
                seq = ['h', 'b']
            elif w == 3:
                seq = ['c', 'h', 'b']
            elif w == 4:
                seq = ['c', 'w', 'm', 'd']
            elif w == 5:
                seq = ['c', 'w', 'l', 'b', 'd']
            else:
                seq = ['c', 'w', 'h'] + ['l', 'm'][: max(0, w - 5)] + ['m'] * max(0, w - 7) + ['b', 'd']
                seq = seq[:w]
            band = (y // 2 + x0) % 3 == 0
            for j, ch in enumerate(seq):
                X = x0 + j
                if band and ch in 'whl':
                    ch = {'w': 'h', 'h': 'l', 'l': 'm'}[ch]
                v = _h(X, y, salt, 3) % 9
                if v == 0 and ch in 'lm':
                    ch = 'h'
                elif v == 1 and ch in 'hl':
                    ch = 'm'
                out[y][X] = ch
            # 끝(아래 칸이 비었으면) 물방울 빛
            for X in range(x0, x):
                if y + 1 >= H or rows[y + 1][X] == '.':
                    if w <= 2:
                        out[y][X] = 'w'
    return [''.join(r) for r in out]


def parts(n):
    one, two = A1_ONE, A1_TWO
    if n == 2:   # A2 = A1 을 좌우로 뒤집은 짝(모양 변주) — r1 A2 막대 모양은 반려
        one, two = [r[::-1] for r in A1_ONE], [r[::-1] for r in A1_TWO]
    return cv_of(16, 16, [(textured(one, 1 + n), 0, 0)]), cv_of(32, 16, [(textured(two, 7 + n), 0, 0)])


def scene_cave(one, two):
    """출하된 자연 동굴 벽(gap-rock-r1 줄 A A1 바위 윗면·앞면, 시공기 cave 가 쓰는 그것) 장면의 벽 앞면 윗단에 매단다."""
    import cave_r1 as CR
    import dot
    import gap_rock_r1 as GR
    g = ['##############', '##############', '##############', '####..######.#', '###....####..#', '##......##...#',
         '##.......#...#', '###..........#', '##############']
    at, face, floor = GR.rock('A', 1), GR.face('A', 1), CR.part('A', 1, 'floor')
    cv = dot.render_cave(g, at, face, floor)
    k = dot.classify(g)
    spots = []
    for y in range(len(g)):
        for x in range(len(g[0])):
            if k[y][x] == 'hi':
                spots.append((x, y))
    for i, (x, y) in enumerate(spots):
        if i % 3 == 0:
            cv.paste(one, x * T, y * T)
        elif i % 5 == 1 and x + 1 < len(g[0]) and (x + 1, y) in spots:
            cv.paste(two, x * T, y * T)
    lib.put_actor(cv, 4, 5)
    return cv


def mk(n):
    def run():
        one, two = parts(n)
        return hcat(one, two), {'kind': 'objects', 'parts': {'1칸': one, '2칸': two}, 'vignette': scene_cave(one, two)}
    return run


CANDIDATES = {'tc.cave_stalactite': {'A1': mk(1), 'A2': mk(2)}}
NOTES = {('tc.cave_stalactite', 'A1'): 'r1 A1 모양 · 단면 6단 명암(갈색 윤곽) · 결 띠 · 처마 이끼',
         ('tc.cave_stalactite', 'A2'): 'A1 거울 모양 · 같은 단면 명암(빛은 왼쪽)'}


def line_scenes():
    return {}

"""theme-cave-stal-r2 — r1 A1(Sonnet PASS) 모양 그대로, object-gate 화풍 반려(질감 없음·칸 정보량 부족 4/4)를 고친다:
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
LG = leg(ramp_chars('rim', 'kbmlh'), ramp_chars('cfloor', 'dc'), g=('moss', 2))


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
    """손 모양 위에 바위 결: 2행마다 층 띠(몸 단 한 단 아래), 화소 해시 얼룩(위·아래 한 단), 처마 줄 흙 잔점·이끼."""
    out = []
    for y, r in enumerate(rows):
        row = list(r)
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            v = _h(x, y, salt) % 11
            if y <= 1:   # 처마 턱
                if v == 0:
                    row[x] = 'g'
                elif v in (1, 2):
                    row[x] = DN[ch]
                elif v == 3:
                    row[x] = UP[ch]
                continue
            if ch in 'lm' and (y + (x // 3)) % 4 == 0:
                row[x] = DN[ch]          # 층 띠
            elif ch in 'lmb' and v == 0:
                row[x] = UP[ch]
            elif ch in 'lm' and v in (1, 2):
                row[x] = DN[ch]
            elif ch == 'h' and y >= 2 and (y + 1 >= len(rows) or rows[y + 1][x] == '.'):
                row[x] = 'h'             # 끝 물방울 빛 그대로
        out.append(''.join(row))
    return out


def parts(n):
    one, two = A1_ONE, A1_TWO
    if n == 2:   # A2 = A1 을 좌우로 뒤집은 짝(모양 변주) — r1 A2 막대 모양은 반려
        one, two = [r[::-1] for r in A1_ONE], [r[::-1] for r in A1_TWO]
        one = [r.replace('k', '#').replace('b', 'k').replace('#', 'b') if y >= 2 else r for y, r in enumerate(one)]
        two = [r.replace('k', '#').replace('b', 'k').replace('#', 'b') if y >= 2 else r for y, r in enumerate(two)]
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
NOTES = {('tc.cave_stalactite', 'A1'): 'r1 A1 모양 + 바위 결(층 띠·얼룩)·처마 잔점·이끼',
         ('tc.cave_stalactite', 'A2'): 'A1 거울 짝(빛 쪽은 왼쪽 그대로)'}


def line_scenes():
    return {}

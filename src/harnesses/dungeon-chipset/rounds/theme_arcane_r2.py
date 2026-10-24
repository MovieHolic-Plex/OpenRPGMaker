"""theme-arcane-r2 — 마계 두 항목 다시 그리기(묶음 theme_arcane, 2026-10-23).

r1 에서 패널이 고른 후보(A1)가 object-gate 에서 떨어진 두 항목만 다시 그린다. 나머지 r1 항목·도구는 그대로 가져다 쓴다.
  other.portal     r1 실패: 「정면도(front_elevation) · 윗면 2행 < 3 · 큰 부분이 윗면 없이 세로 면만」(4/4).
                   → 3/4 로 다시 쌓는다: 넓은 돌 단(윗면 판석 6줄 + 밝은 앞 모서리 + 앞면 3줄), 두 기둥은 상인방보다 높이 솟아
                     위에서 본 머릿돌 윗면(5줄)과 앞면을 보이고, 상인방도 윗면 판석 4줄 + 앞면. 소용돌이는 아치 안에만.
  other.void_edge  r1 실패: 화풍 「판정자 fail 3/4 · 명암 3단 < 4」. 그림 = 허공 칸이 절반, 턱·섬 밑 바위가 2~3 단.
                   → 턱 = 윗면 끝 밝은 모서리(ostone 5·4) + 보라 빛 테(arcane 1·2) 4단, 섬 밑 바위 = ostone 0~5 여섯 단 돌 켜
                     (돌마다 위 빛·아래 그늘, 알갱이·틈). 후보 그림 = 6×2 칸 떠 있는 섬 조립(윗면·턱·섬 밑 1단 + 허공 한 열).
섬 윗면은 패널이 고른 other.ground A2 몸통 그대로(바꾸지 않는다).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
from cave_r1 import autotile_cv, hcat, variants_sheet  # noqa: E402
from dot import Cv, grid, stamp  # noqa: E402
from theme_arcane_r1 import (L, T, anim_scenes, bevel, halves, hbevel, noise, objs_meta, put_actor, speckle,  # noqa: E402
                             spiral_rows, stone_blocks, tr)

WAVE = 'theme_arcane'


# ================================================================================================ 봉인된 차원문 3×3
# 글자: f 가장 밝은 모서리 · e 윗면 · d 윗면 이음/앞면 빛 · c 앞면 · b 앞면 그늘 · a 깊은 틈 · '~' 그림자 · 숫자 = 아치 안 고리.
# 왼쪽 반 24열을 쌓고 거울(오른쪽 반은 한 단 어둡게 바꿔 칠함 — 빛은 왼쪽 위).
def _portal_half():
    W, H = 24, 48
    g = [['.'] * W for _ in range(H)]

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            g[y][x] = c

    # ---- 돌 단(맨 밑): 윗면 30~41행(판석, 문 앞으로 넓게 보인다), 앞 모서리 42, 앞면 43~45, 그림자 46. 왼 앞 모서리는 둥글게.
    def dais_x0(y):
        return {30: 5, 31: 3, 32: 2, 33: 1, 43: 1, 44: 2, 45: 3, 46: 5}.get(y, 0)
    for y in range(30, 47):
        for x in range(dais_x0(y), W):
            if y <= 41:
                c = 'e'
            elif y == 42:
                c = 'f'
            elif y == 43:
                c = 'm'
            elif y == 44:
                c = 'd'
            elif y == 45:
                c = 'c'
            else:
                c = '~'
            put(x, y, c)
    for y in range(31, 42):                   # 왼 끝 모서리 빛
        put(dais_x0(y), y, 'f')               # 왼 끝 모서리 빛
    for y in range(34, 42):                   # 앞뒤로 긴 판석 — 이음은 세로로만(가로 이음은 벽돌 켜로 읽힌다)
        for jx in (7, 17):
            put(jx, y, 's')
    for x, y in ((6, 36), (16, 40), (2, 40), (12, 35), (21, 39), (3, 32)):   # 판석 알갱이 빛
        put(x, y, 'f')
    for x in (7, 15, 23):                     # 앞면 세로 이음
        for y in (43, 44):
            put(x, y, 'b')
        put(x, 45, 'a')

    # ---- 기둥(상인방보다 높이 솟는다): 머릿돌 윗면 0~5행(위에서 본 판, 뒤 모서리 0), 앞 모서리 6, 앞면 7~9, 처마 그늘 10.
    for y in range(0, 6):
        for x in range(1, 12):
            if y == 0 and x in (1, 11):
                continue
            put(x, y, 's' if y == 0 else 'e')
    for x, y in ((3, 2), (9, 1), (10, 4)):
        put(x, y, 'f')
    for y in range(1, 6):
        put(1, y, 'f')                        # 왼 모서리 빛
    put(6, 3, 'D'); put(5, 3, 'B'); put(7, 3, 'B'); put(6, 2, 'B'); put(6, 4, 'B')   # 머릿돌 윗면 빛 룬(위에서 보이는 새김)
    for x in range(1, 12):
        put(x, 6, 'f')
        put(x, 7, 'm')
        put(x, 8, 'd')
        put(x, 9, 'c')
        put(x, 10, 'a')
    for x in (4, 8):
        for y in (7, 8, 9):
            put(x, y, 'b')
    # 기둥 몸(앞면): 11~29행 x 2~10, 블록 이음 5줄마다
    for y in range(11, 30):
        for x in range(2, 11):
            if (y - 11) % 5 == 4:
                c = 'b'
            else:
                c = 'm' if x == 2 else ('c' if x == 9 else ('b' if x == 10 else 'd'))
            put(x, y, c)
    for (x, y) in ((5, 13), (6, 14), (5, 15), (4, 14), (6, 23), (5, 24), (6, 25), (7, 24)):   # 앞면 빛 새김
        put(x, y, 'D')
    # 기둥 밑동(단 위에 놓인 받침돌): 윗면 30~31, 앞 모서리 32, 앞면 33~34
    for y in range(30, 35):
        for x in range(1, 12):
            put(x, y, {30: 'e', 31: 'e', 32: 'f', 33: 'm', 34: 'd'}[y])
    put(1, 30, 's'); put(11, 30, 's'); put(1, 31, 'f')
    for y in (35,):
        for x in range(1, 12):
            put(x, y, 'a')                   # 받침돌이 단 윗면에 드리운 그늘

    # ---- 상인방(두 기둥 사이, 기둥 머리보다 낮다): 뒤 모서리 5, 윗면 판 6~10, 앞 모서리 11, 앞면 12~13, 처마 그늘 14.
    for x in range(12, W):
        put(x, 5, 's')
        for y in range(6, 11):
            put(x, y, 'e')
        put(x, 11, 'f')
        put(x, 12, 'm')
        put(x, 13, 'd')
        put(x, 14, 'a')
    for y in range(5, 14):
        put(12, y, 'a' if y < 11 else 'b')   # 기둥 옆에 끼인 그늘 한 열
    for x, y in ((14, 7), (20, 8), (22, 6), (17, 9)):
        put(x, y, 'f')
    for y in (12, 13):
        put(16, y, 'b')
    # 쐐기돌 보석(앞면 가운데, 금 테 q·o)
    for (y, x), c in {(11, 21): 'q', (11, 22): 'q', (11, 23): 'q', (12, 21): 'q', (12, 22): 'E', (12, 23): 'C',
                      (13, 21): 'o', (13, 22): 'C', (13, 23): 'D', (14, 21): 'o', (14, 22): 'o', (14, 23): 'o'}.items():
        put(x, y, c)

    # ---- 아치 안(15~33행, x 11~23): 고리 번호 + 둥근 아치 머리(가운데 (24, 26) 반지름 13 밖 = 어깨 돌) + 안쪽 깊이 한 열
    # (r2 패널 1: 구멍이 사람 키의 반 → 19줄로 키우고 위를 아치로)
    cx, cy = 23.5, 24.0
    for y in range(15, 34):
        for x in range(11, W):
            r = math.hypot(x - cx + 0.5, (y - cy) * 0.85)
            g[y][x] = '9' if r < 1.8 else str(int(r / 2.4) % 5)
    for y in range(15, 26):
        for x in range(11, W):
            d = math.hypot(x + 0.5 - 24.0, y + 0.5 - 26.0)
            if d >= 13.0:
                g[y][x] = 'b' if d >= 13.9 else 'a'
    for y in range(15, 34):
        if g[y][11] in '01234':
            g[y][11] = 'a'
    for x in range(12, W):                    # 문턱(아치 밑 낮은 돌 한 단 — 단 윗면 위) + 소용돌이 빛이 단 윗면에 번진다
        g[34][x] = 'f'
        g[35][x] = 'b'
        g[36][x] = 'B' if x % 3 else 'D'
        if g[37][x] == 'e' and x % 2 == 0:
            g[37][x] = 'B'
    return [''.join(r) for r in g]


FRONT_ROWS = set(range(0, 48))   # 앞면·윗면은 글자로 갈린다(앞면 m d c b a · 윗면 f e u s)
TOP_ROWS = set(range(0, 48))
LICHEN = [(4, 24), (5, 24), (8, 18), (9, 18), (3, 11), (14, 44), (15, 44), (2, 43), (20, 45), (21, 45), (6, 34), (7, 34),
          (18, 11), (19, 11)]
GLOW_CRACK = [(9, 22), (9, 23), (8, 23), (11, 44), (12, 44)]


TOP_CRACKS = [(3, 37), (4, 38), (5, 38), (6, 39), (12, 33), (13, 32), (20, 40), (21, 40), (22, 41), (15, 6), (16, 7), (4, 3)]


def _top_grain(r, y):
    """윗면 판 결: 두 화소 덩이 알갱이(u 어둡게 · f 밝게)와 드문 1화소 점 — 판은 고르게 밝되 매끈한 한 색 면이 아니다.
    가로·세로 이음 줄은 만들지 않는다(벽돌 켜로 읽히지 않게)."""
    row = list(r)
    x = 0
    while x < len(row):
        if row[x] == 'e':
            h = (((x * 73856093) ^ (y * 19349663) ^ 0x5bd1) & 0xffff) % 23
            if h in (0, 7):
                row[x] = 'u'
                if x + 1 < len(row) and row[x + 1] == 'e':
                    row[x + 1] = 'u'
                    x += 1
            elif h in (3, 15):
                row[x] = 'f'
                if x + 1 < len(row) and row[x + 1] == 'e' and h == 3:
                    row[x + 1] = 'f'
                    x += 1
            elif h == 11:
                row[x] = 's'
        x += 1
    for cx, cy in TOP_CRACKS:
        if cy == y and row[cx] in 'euf':
            row[cx] = 's'
    return ''.join(row)


def _portal_shade(rows):
    """돌 한 장씩 칠하기. 앞면(m 빛 · d 몸 · c 그늘 · b 이음 · a 깊은 틈): 블록마다 단 들쭉 + 위 빛 · 아래 그늘 + 알갱이.
    윗면(f 모서리 · e 판 · u 판 그늘 · s 이음): 고른 판에 드문 알갱이만(위에서 본 판으로 읽히게). 앞면 돌 몇 장은 회색 돌(w·y·z). 보라 이끼(l·L) 몇 덩이,
    보라 빛 금(B) 몇 줄."""
    H = len(rows)
    fr = [r if y in FRONT_ROWS else '.' * len(r) for y, r in enumerate(rows)]
    fr = stone_blocks(fr, 'dc', 'abcdm', 7)
    out = []
    for y in range(H):
        r = list(rows[y])
        for x, c in enumerate(r):
            if y in FRONT_ROWS and fr[y][x] != '.' and c in 'dc':
                r[x] = fr[y][x]
        out.append(''.join(r))
    # 앞면 돌 몇 장은 회색 돌(w·y·z)로 바꿔 끼운다 — 돌마다 재질이 조금씩 다르다(윗면 판석은 고르게 둔다)
    g = [list(r) for r in out]
    seen = set()
    sw = {'m': 'w', 'd': 'y', 'c': 'z'}
    for sy in sorted(FRONT_ROWS):
        for sx in range(len(out[0])):
            if out[sy][sx] not in 'mdc' or (sx, sy) in seen:
                continue
            comp, st = [], [(sx, sy)]
            seen.add((sx, sy))
            while st:
                x, y = st.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if ny in FRONT_ROWS and 0 <= nx < len(out[0]) and (nx, ny) not in seen and out[ny][nx] in 'mdc':
                        seen.add((nx, ny))
                        st.append((nx, ny))
            if len(comp) >= 6 and (min(comp)[0] * 5 + min(y for _, y in comp) * 3) % 4 == 0:
                for x, y in comp:
                    g[y][x] = sw[out[y][x]]
    out = [''.join(r) for r in g]
    res = []
    for y, r in enumerate(out):
        r = noise(speckle([r], {'d': ('c', 9), 'c': ('b', 13), 'y': ('z', 9)}, 5 + y), 'bcdm', 7, 32 + y)[0]
        r = noise([r], 'zyw', 7, 70 + y)[0]
        r = _top_grain(r, y)
        res.append(r)
    g = [list(r) for r in res]
    for i, (x, y) in enumerate(LICHEN):
        if g[y][x] in 'abcdmwyz':
            g[y][x] = 'L' if i % 3 == 0 else 'l'
    for x, y in GLOW_CRACK:
        if g[y][x] in 'abcdmwyz':
            g[y][x] = 'B'
    return [''.join(r) for r in g]


PORTAL_L = _portal_shade(_portal_half())
for _r in PORTAL_L:
    assert len(_r) == 24, _r
_seal = [['.'] * 24 for _ in range(48)]
for _t in range(8):                            # X 자 쇠사슬(거울로 X) — 아치 안만
    for _x, _y in ((12 + _t, 18 + _t), (12 + _t, 19 + _t), (12 + _t, 32 - _t), (12 + _t, 31 - _t)):
        _seal[_y][_x] = 'g' if (_t % 2 == 0) else 'h'
for _i, _r in enumerate(['..qqq', '.qooo', 'qoBBB', 'qoBDE', 'qoBEC', 'qoBDE', 'qoBBB', '.qooo', '..qqq']):
    for _j, _c in enumerate(_r):
        if _c != '.':
            _seal[21 + _i][19 + _j] = _c
PORTAL_SEAL = [''.join(r) for r in _seal]

LPO = {'A1': L('f:iron5 e:iron4 u:iron3 s:iron2 w:iron3 y:iron2 z:iron1 m:vrock4 d:vrock3 c:vrock2 b:vrock1 a:vrock0 '
               'l:ostone3 L:ostone4 q:gold4 o:gold2 '
               'E:arcane5 C:arcane4 D:arcane3 B:arcane2 g:iron4 h:iron2 Z:arcane0 Y:vrock1 X:vrock0 W:vrock2'),
       'A2': L('f:bone3 e:bone1 u:bone0 s:ostone5 w:vrock3 y:vrock2 z:vrock1 m:ostone4 d:ostone3 c:ostone2 b:ostone1 a:ostone0 '
               'l:red0 L:vrock2 q:gold4 o:gold2 '
               'E:fire5 C:fire4 D:red3 B:red1 g:iron4 h:iron2 Z:ostone2 Y:ostone1 X:ostone0 W:ostone3')}
# 윗면(f 모서리 · e 판 · s 판 이음)은 밝은 단, 앞면(d·c·b·a)은 어두운 단 — 윗면과 앞면이 한눈에 갈린다(3/4).
SWIRL = {'A1': R1.SWIRL['A1'], 'A2': ['ostone1', 'red0', 'arcane1', 'red1', 'arcane3', 'arcane5']}   # A2 = 핏빛 보라(불빛 주황은 벽난로로 읽혔다)
RIGHT = {'f': 'e', 'm': 'd', 'w': 'y'}   # 오른쪽 반: 모서리 빛 한 단 내림


def _halves(rows):
    return halves(rows, RIGHT)


def portal(key, opened, k=0):
    leg = dict(LPO[key])
    if not opened:
        rows = _halves(noise(tr(PORTAL_L, {'0': 'X', '1': 'Y', '2': 'W', '3': 'Z', '4': 'W', '9': 'X'}), 'XZYW', 4, 31))
        cv = grid(rows, leg)
        stamp(cv, halves(PORTAL_SEAL, {'E': 'C'}), leg, 0, 0)
        return cv
    sw = SWIRL[key]
    for i in range(6):
        leg[str(i)] = L(f'x:{sw[i]}')['x']
    return grid(spiral_rows(_halves(PORTAL_L), k), leg)


def c_portal(key):
    def fn():
        shut = portal(key, False)
        opens = [portal(key, True, k) for k in range(3)]

        def place(v, f):
            v.paste(f, 4 * T, 1 * T)
            put_actor(v, 2, 4)
        sc = anim_scenes([shut] + opens, place, lambda: void_edge('A1').render(R1.ISLAND))
        parts = {'닫힘': shut}
        parts.update({f'열림{i + 1}': f for i, f in enumerate(opens)})
        m = objs_meta(parts, sc)
        m['anim'] = [sc[0]] * 3 + sc[1:] * 2
        return hcat(shut, *opens), m
    return fn


# ================================================================================================ 허공 가장자리(떠 있는 섬)
# r1 과 같은 짜임(바닥 턱 오토타일 + 섬 밑 앞면 2단 + 허공 몸통 셋, VoidEdge.render). 바뀐 것은 재질:
#   턱(북·서·동): 허공(k) 1~2화소 → 보라 빛 테 g(arcane1) → 윗면 끝 밝은 모서리 h(ostone5)·H(arcane2) — 네 단.
#   남 턱: 윗면 끝 H(ostone5) · h(ostone4) 두 줄 → 그 밑 섬 밑 앞면.
#   섬 밑 앞면: ostone 0~5 여섯 단 돌 켜(돌마다 윗줄 빛 · 가운데 몸 · 아랫줄 그늘, 이음 틈 0단), 아래로 갈수록 한 단씩 어두워지고
#   맨 밑은 짧은 고드름으로 끊긴다. 끝 마구리는 안으로 좁아진다. 보라 빛 티끌은 틈 몇 곳에만.
VE_FRAME = [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkgggggggkkkggggggggggkkgggggkk',
    'kkgHhhhhhhgggHhhhhhhhhhggHhhhhgk',
    'kgHh.......hh..........hh.....dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgH...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgH...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgH...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgH...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgH...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'kgh...........................dk',
    'khhhhhhhhhhhhhhhhhhhhhhhhhhhhhdk',
    'kHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHk',
]
VE_INNER = ['gh............dk', 'h..............d'] + ['................'] * 13 + ['k..............k']


# 섬 밑 바위 조각(손으로 놓은 깨진 면): (x, y, 단) — x 는 16 주기 칸 열. 면 하나 = 가장 가까운 점의 자리(가로는 16 주기로 감김).
# r2 패널 1: 「켜마다 고른 네모 벽돌 = 석축 벽으로 읽힘, 16 화소마다 같은 무늬」 → 크기·모양이 제각각인 깨진 바위 면으로.
# 위쪽 면이 밝고(단 4~5), 아래로 갈수록 어두워진다(단 1~2). 같은 줄 안에서도 단이 들쭉날쭉.
VE_FACETS = [(1.5, 2.0, 4), (6.0, 1.5, 5), (11.5, 2.5, 4), (15.0, 1.0, 3),
             (3.5, 6.5, 3), (8.5, 5.5, 4), (13.0, 7.0, 3),
             (0.5, 11.0, 3), (5.5, 11.5, 2), (10.0, 10.0, 3), (14.5, 12.5, 2),
             (3.0, 16.0, 2), (8.0, 15.5, 2), (12.0, 17.5, 1),
             (1.0, 20.5, 1), (6.0, 21.0, 2), (10.5, 22.0, 1), (14.5, 20.0, 1)]
VE_GLINT = {(3, 9), (11, 14), (7, 19)}     # 깨진 틈 속 희미한 보라 빛 세 점(칸마다 자리 다름은 16 주기 안에서)


def _ve_face():
    """섬 밑 앞면 표본 32×32(칸 열 tc 16 주기). 0행 = 턱 밑 그늘(1). 바위 면마다: 위 모서리 한 줄 빛(+1), 아래·오른 모서리 그늘(-1),
    면 경계 = 깨진 틈(0). 밑단은 길이가 제각각인 고드름 끝으로 끊기고, 끝 마구리는 안으로 좁아진다."""
    t = 2 * math.pi / 16
    bottom = lambda tc: 20 + round(2 * math.sin(t * tc + 0.7) + 1.5 * math.sin(3 * t * tc + 2.1))  # noqa: E731
    drips = {3: 5, 4: 2, 10: 4, 13: 2, 7: 1}

    def near(tc, y):
        best = None
        for i, (fx, fy, tone) in enumerate(VE_FACETS):
            dx = min(abs(tc + 0.5 - fx), 16 - abs(tc + 0.5 - fx))
            d = dx * dx + ((y + 0.5 - fy) * 1.3) ** 2
            if best is None or d < best[0]:
                best = (d, i)
        return best[1]
    fid = [[near(tc, y) for tc in range(16)] for y in range(32)]
    out = []
    for y in range(32):
        r = []
        for c in range(32):
            tc = c if c < 8 else (c - 8 if c < 24 else c - 16)
            inset = 1 + y // 3 if (c < 8 or c >= 24) else 0
            ok = (c >= inset) if c < 8 else ((c <= 31 - inset) if c >= 24 else True)
            bot = bottom(tc) + drips.get(tc, 0)
            if c < 8 or c >= 24:
                bot = min(bot, 23 - (7 - c if c < 8 else c - 24))
            if not ok or y >= bot:
                r.append('.')
                continue
            f = fid[y][tc]
            tone = VE_FACETS[f][2]
            up = fid[y - 1][tc] if y > 0 else f
            dn = fid[y + 1][tc] if y < 31 else f
            rt = fid[y][(tc + 1) % 16]
            lt = fid[y][(tc - 1) % 16]
            if y == 0:
                ch = '1'
            elif lt != f and up == f:
                ch = '0'                                    # 왼쪽 틈(세로)
            elif up != f:
                ch = str(min(5, tone + 1))                  # 빛 받는 위 모서리
            elif dn != f:
                ch = '0' if (tc + y) % 3 == 0 else str(max(0, tone - 1))   # 아래 모서리 = 그늘, 군데군데 틈
            elif rt != f:
                ch = str(max(0, tone - 1))                  # 아래·오른 모서리 그늘
            elif y >= bot - 1:
                ch = '0'
            else:
                ch = str(tone)
            if y >= bot - 1 and ch not in '0.':
                ch = str(max(0, int(ch) - 1))
            if (c < 8 and c == inset) or (c >= 24 and c == 31 - inset):
                ch = '0' if y > 6 else '1'
            if (tc, y) in VE_GLINT and ch == '0':
                ch = 'v'
            r.append(ch)
        out.append(''.join(r))
    return out


VE_FACE = _ve_face()
for _r in VE_FRAME + VE_FACE:
    assert len(_r) == 32, _r
LVE = {'A1': L('k:vrock0 N:arcane0 n:ostone1 d:ostone2 g:arcane1 h:ostone4 H:ostone5 e:ostone0 a:arcane0 A:arcane2 '
               '0:ostone0 1:ostone1 2:ostone2 3:ostone3 4:ostone4 5:ostone5 v:arcane3'),
       'A2': L('k:vrock0 N:arcane0 n:ostone1 d:ostone2 g:red0 h:ostone4 H:ostone5 e:ostone0 a:arcane0 A:arcane2 '
               '0:vrock0 1:ostone0 2:ostone1 3:ostone2 4:ostone3 5:ostone4 v:red1')}


def void_edge(key):
    leg = LVE[key]
    gat = R1.ground_at('A2')       # 섬 윗면 = 패널이 고른 마계 바닥 A2 몸통(그대로)
    at = autotile_cv(gat.body, grid(noise(VE_FRAME, 'ghH', 5, 41), leg, 32, 32), grid(VE_INNER, leg, 16, 16), gat.bodies[1:])
    voids = [grid(b, leg) for b in R1.VOID_BODIES]
    raw = grid(noise(VE_FACE, '12345', 11, 31), leg, 32, 32)
    face_trans = dot.Face(raw)
    block = Cv(32, 32)
    for y in range(32):
        for c in range(32):
            tc = c if c < 8 else (c - 8 if c < 16 else (c - 8 if c < 24 else c - 16))
            block.a[y, c] = voids[0].a[y % 16, tc]
    block.paste(raw, 0, 0)
    ve = R1.VoidEdge(at, dot.Face(block), voids)
    ve.face_raw = face_trans
    return ve


ISLAND_BIG = R1.ISLAND_BIG
STRIP = ['..... ', '..... ']   # 후보 그림 = 6×2 조립: 윗면·턱(북·서·남) + 동쪽 허공 한 열 … 아래 줄은 섬 밑이 보이도록 render 가 처리


def candidate_strip(ve):
    """6×2 칸(96×32): 떠 있는 섬 한 덩이 — 윗줄 = 북·서 턱이 있는 윗면 5칸 + 허공, 아랫줄 = 남 턱 윗면 4칸 + 섬 밑 앞면 …
    섬 밑 앞면이 그림에 들어가도록 3줄로 그려 아래 두 줄(윗면 남 턱 줄 + 섬 밑 1단)을 잘라 쓴다."""
    return ve.render([' .... ', '      '])


def c_void_edge(key):
    def fn():
        ve = void_edge(key)
        v = ve.render(ISLAND_BIG)
        put_actor(v, 6, 3)
        put_actor(v, 15, 7)
        blk = candidate_strip(ve)
        small = ve.render(['      ', ' ..   ', ' ..  .', '      ', '      '])
        return blk, {'kind': 'autotile', 'autotiles': {'edge': ve.at}, 'faces': {'underside': ve.face},
                     'tiles': {f'void{i}': t for i, t in enumerate(ve.voids)}, 'vignette': v,
                     'extras': [('47 변형(허공 쪽 턱)', variants_sheet(ve.at), 2), ('섬 밑 앞면 표본 32×32', ve.face.b, 3),
                                ('떠 있는 작은 발판', small, 2), ('허공 몸통 6×6 섞음', R1.void_mosaic(ve), 2)]}
    return fn


ITEM_FNS = {
    'other.void_edge': c_void_edge,
    'other.portal': c_portal,
}
NOTES = {
    ('other.void_edge', 'A1'): '윗면 = 마계 바닥 A2(그대로), 턱 = 허공 → 보라 빛 테 → 밝은 모서리 4단, 섬 밑 = 보라 검은 돌 켜 6단(돌마다 빛·그늘)',
    ('other.void_edge', 'A2'): '같은 짜임, 턱 테 = 붉은 재빛, 섬 밑 = 한 단 어두운 돌 켜',
    ('other.portal', 'A1'): '푸른 회색 돌 — 넓은 단(윗면 판석) 위 두 기둥(위에서 본 머릿돌)과 낮은 상인방(윗면 판석), 닫힘 = 굳은 판 + X 쇠사슬 + 봉인 메달, 열림 = 보라 소용돌이(3장면)',
    ('other.portal', 'A2'): '보라 검은 돌 같은 짜임 — 열림 = 붉은·불빛 소용돌이',
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(mk(k), NOTES[(item, k)]) for k in ('A1', 'A2')} for item, mk in ITEM_FNS.items()}


def line_scenes():
    return {}

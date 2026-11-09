"""snow-road-r1 — 밟힌 눈길 오토타일(줄 공통). 항목 tc.snow_road.

왜: 폴른 스타 서리나루(fs2_frostford)의 밟힌 눈길·광장이 던전 얼음굴 바닥(`beodeul_dungeon_ice_ground`, iron 회색 #bec6d4)으로 칠해져
눈밭(#e6f0fa) 위에서 평평한 회색 계단 띠로 읽혔다(1.35 #23·1.36 「그대로」). 이 판은 버들항 설원 눈 타일(25839·25864~25869)의
두 색(snow 2 #e6f0fa 바탕 · snow 1 #cadaee 그늘)에서 한 단 어두운 snow 0(#a6bcdc)까지만 쓴 다진 눈길이다 — 바위 회색·갈색 없음.

  A1 「다진 눈」 — 길 = snow 1 바탕 + snow 0 드문 자국(발자국 쌍·썰매 홈·눈 덩이는 몸통 변형에만, 자리 제각각).
                   테두리 = 얕게(2~4px) 물결치는 눈 둑(snow 2 = 눈밭 색)이 2×2 덩이로 길에 섞이고, 북·서 둑 밑에만 끊긴 snow 0 그늘. 오른쪽·아래 그림자 없음.
  (첫 그림의 A2 「얕은 눈」 점묘안은 Opus 판정 3/3 이 「노이즈로 읽힘」으로 반려해 뺐다. 흰 점·1px 톱니 테두리도 같은 판정으로 뺐다.)

모든 화소는 이 파일의 행 문자열과 손으로 적은 표(둑 깊이 표·모서리 반경)에서 온다. 조립은 cave_r1.autotile_cv(A2 사분면 규칙).
  - 둑 깊이 표는 칸 경계 열/행(0·7·8·15·16·23·24·31)에서 3px 로 맞춰 어느 조각끼리 붙어도 이어진다.
  - 바깥 모서리는 45° 사선 둑, 안 모서리는 삼각 둑 덩이 — 직선 사각 모서리를 피한다(감독 r3 반려 이유). 원호 모서리(반경 6~12)는 Opus 판정에서 사각으로 읽혀 버렸다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import a2_plus, autotile_cv, hcat, variants_sheet  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402

WAVE = 'theme_climate'
T = 16

# b = snow 0 (#a6bcdc, 밟힌 자국·북서 둑 밑 그늘) · c = snow 1 (#cadaee, 길 바탕) · e = snow 2 (#e6f0fa, 눈밭과 같은 색 = 둑)
LEG = legend(b=('snow', 0), c=('snow', 1), e=('snow', 2))

# 몸통: snow 1 바탕 + 드문 자국. 칸 둘레 한 줄에는 자국을 두지 않는다(변형끼리 아무 순서로 붙도록). 흰 점은 r1 판정에서 격자로 읽혀 뺐다.
BODY = [
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccbcccccccccccc',
    'ccccbccccccccccc',
    'cccccccccccccccc',
    'cccccccccccbbccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cccccccccccccccc',
    'cbbccccccccccccc',
    'cccccccccccccccc',
    'ccccccccccccc' + 'bcc',
    'cccccccccccccccc',
    'cccccbcccccccccc',
    'ccccccbccccccccc',
    'cccccccccccccccc',
]
VARS = [
    [(['bb', '..', '..', '.bb'], 4, 3), (['bb', '..', '..', '.bb'], 9, 9)],   # 발자국 쌍(엇갈림)
    [(['bbbbb'], 3, 6), (['bbbbb'], 6, 10)],                                  # 썰매 홈 두 줄
    [(['ee', 'ee'], 10, 3), (['e'], 4, 11)],                                  # 길에 남은 눈 덩이
]

# 둑 깊이 표(px, 0~31 열/행). 칸 경계 열·행(0·7·8·15·16·23·24·31)은 3 — 사분면 경계 깊이가 같아 바꿔 끼워도 이어진다. 2~4 로 얕게 물결친다.
DN = [3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 3, 3]
DS = [3, 3, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3]
DW = [3, 3, 4, 4, 3, 3, 2, 3, 3, 2, 2, 3, 3, 4, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 2, 2, 3, 3, 3]
DE = [3, 3, 3, 2, 2, 3, 3, 3, 3, 4, 4, 3, 3, 3, 2, 3, 3, 3, 2, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 2, 3, 3]
CHAMFER = 13    # 바깥 모서리 사선: 모서리 칸 꼭짓점에서 |dx|+|dy| < 13 은 둑(45° 사선, 8×8 사분면 안)
INNER_CUT = 10  # 안 모서리 둑 삼각: 꼭짓점에서 |dx|+|dy| < 10


def _clump(x, y, n):
    """2×2 덩이 단위로 자리 제각각인 섞임 — 1px 체크(톱니)로 보이지 않게."""
    return ((x // 2) * 7 + (y // 2) * 13) % 5 < n


def snow_bank():
    """32×32 틀: 둑(e) + 둑에 닿은 길 화소 중 덩이 섞임(e) + 북·서 둑 밑 끊긴 그늘(b). '.' = 몸통 그대로.
    바깥 모서리는 원호 대신 45° 사선 — 원호(반경 6~12)는 판정 5판 내내 「사각 모서리」로 읽혔다(r1~r5)."""
    g = [[False] * 32 for _ in range(32)]
    for y in range(32):
        for x in range(32):
            bank = y < DN[x] or y >= 32 - DS[x] or x < DW[y] or x >= 32 - DE[y]
            for cx, cy in ((0, 0), (31, 0), (0, 31), (31, 31)):
                ax, ay = abs(x - cx), abs(y - cy)
                if ax < 8 and ay < 8 and ax + ay < CHAMFER + (1 if _clump(x, y, 1) else 0):
                    bank = True
            g[y][x] = bank
    out = [['.'] * 32 for _ in range(32)]
    for y in range(32):
        for x in range(32):
            if g[y][x]:
                out[y][x] = 'e'
                continue
            touch = any(0 <= x + dx < 32 and 0 <= y + dy < 32 and g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if touch and _clump(x, y, 2):
                out[y][x] = 'e'
            elif touch and ((y > 0 and g[y - 1][x]) or (x > 0 and g[y][x - 1])) and ((x // 2) + (y // 2)) % 3 == 0:
                out[y][x] = 'b'
    return [''.join(r) for r in out]


def inner_bank():
    rows = [['.'] * 16 for _ in range(16)]
    for cx, cy in ((0, 0), (15, 0), (0, 15), (15, 15)):
        for y in range(16):
            for x in range(16):
                if (x < 8) != (cx == 0) or (y < 8) != (cy == 0):
                    continue
                if abs(x - cx) + abs(y - cy) < INNER_CUT + (1 if _clump(x, y, 1) else 0):
                    rows[y][x] = 'e'
    return [''.join(r) for r in rows]


def stamp(rows, marks):
    g = [list(r) for r in rows]
    for pat, ox, oy in marks:
        for yy, r in enumerate(pat):
            for xx, ch in enumerate(r):
                if ch != '.':
                    g[oy + yy][ox + xx] = ch
    return [''.join(r) for r in g]


def road():
    bodies = [grid(stamp(BODY, v), LEG) for v in VARS]
    return autotile_cv(grid(BODY, LEG), grid(snow_bank(), LEG), grid(inner_bank(), LEG), bodies)


SNOW_FIELD = ['e' * 16] * 16   # 눈밭 칸(25839 과 같은 색) — 장면 바탕
# 장면: 광장 덩이, 굽은 길, 갈림(T), 막다른 길, 외딴 칸.
SCENE = [
    '..............',
    '.....ppp......',
    '....ppppp.....',
    '...ppp.pppppp.',
    '...pp.......p.',
    '..ppp...p...p.',
    'pppp....p..pppp',
    '.......pppp....',
    '.........pp....',
    '.........pp....',
]
SCENE = [r.ljust(15, '.') for r in SCENE]
ACTOR_AT = (9, 7)


def scene(actor=True):
    at = road()
    snow = grid(SNOW_FIELD, LEG)
    cv = Cv(len(SCENE[0]) * T, len(SCENE) * T)
    for y, r in enumerate(SCENE):
        for x, ch in enumerate(r):
            t = at.tile_at(dot.mask_at(SCENE, x, y, lambda c, X, Y: c == 'p'), x, y) if ch == 'p' else snow
            cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
    if actor:
        cx, cy = ACTOR_AT
        cv.paste(dot.Cv.of(dot.actor1_frame(1, 0, 0)), cx * T - 4, cy * T - 14)
    return cv


NOTE = ('「다진 눈」 — snow 1 길 + snow 0 드문 자국(발자국 쌍·썰매 홈·눈 덩이는 몸통 변형에만) · 얕게 물결치는 눈 둑(2~4px)이 2×2 덩이로 섞임 · '
        '바깥 모서리 45° 사선 · 안 모서리 삼각 둑 · 북·서 둑 밑만 끊긴 그늘 · 흰 점 없음(r1 판정: 격자로 읽힘)')
SCENE_LEAD = '눈밭(버들항 설원 25839 색) 위에 눈길로 깐 15×10 — 광장 덩이, 굽은 길, 갈림, 막다른 길. Actor1.'


def cand():
    at = road()
    return a2_plus(at), {
        'kind': 'autotile', 'autotiles': {'road': at}, 'vignette': scene(),
        'note': NOTE + f' — 원본 = 눈길 A2(+몸통 변형 {len(at.bodies) - 1})',
        'extras': [('길 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('눈길 47 변형', variants_sheet(at), 2)]}


CANDIDATES = {'tc.snow_road': {'A1': cand}}

"""theme-props-r9 — 얼음굴 벽 앞면 새 출발(2026-10-25). r7(층 바위 + 틈 얼음)은 패널 9~12 내내 「바위가 얼음으로 안 읽힘 · 가로 띠 반복」.
버들항 동굴 앞면(sea-cave face-cave-3h)의 틀(윗단 한 줄 빛 턱 · 몸 · 아랫단 두 줄 그늘, 16열 가운데 칸 + 끝 2열)을 그대로 두고
재질만 얼음으로. 가로 띠·벽돌 없음 — 깨진 면(facet)으로 칠한다(FF6 나르셰 절벽 · 크로노 트리거 얼음 동굴: 큰 평평한 면 + 단단한 빛 가장자리).
  A1 빙하 면: 큰 다각 면(보로노이), 면마다 한 단, 위·왼 경계 = 옅은 빛 테 · 아래·오른 경계 = 짙은 속 · 고드름 드립 · 서리 줄 · 반짝 한 화소.
  A2 얼음 덮인 바위: 짙은 청회 바위가 반투명 얼음판 밑에 비친다(얼음판 = 면, 판 안은 바위색이 한 단 밝게 비침, 판 테 = 옅은 얼음).
  A3 결정 기둥: 세로로 길쭉한 프리즘 면(위 끝이 비스듬히 잘림), 면 왼쪽 빛·오른쪽 그늘 · 고드름.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_walls_r5 as W5  # noqa: E402
from dot import Cv, stamp  # noqa: E402

WAVE = 'theme_props'
T = 16
L = P1.L
G = P1.G
# 0 가장 깊은 속 · 1~5 몸 단(어두움→밝음) · 6 옅은 테 · 7 가장 밝은 테 · 8 반짝 · d 고드름 그늘 · e 고드름 몸 · f 고드름 심
LG = {1: L('0:vrock0 1:water0 2:water1 3:water2 4:ice0 5:ice1 6:ice2 7:ice3 8:ice4 d:water2 e:ice1 f:ice2 g:ice3'),
      2: L('0:vrock0 1:vrock1 2:vrock2 3:iron2 4:water2 5:ice0 6:ice1 7:ice2 8:ice4 d:water2 e:ice1 f:ice2 g:ice3'),
      3: L('0:vrock0 1:vrock1 2:water0 3:water1 4:water2 5:ice0 6:ice1 7:ice2 8:ice4 d:water1 e:ice0 f:ice1 g:ice2')}


def _h(*a):
    v = 0x9e3779b9
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 2654435761) & 0xffffffff
        v ^= v >> 15
    return v


# 면 씨앗(16열 가로 둘레가 이어지는 원통 위). (x, y, 몸 단). r9b: 씨앗을 줄여 면을 크게(SNES 얼음 = 큰 평평한 면)
SEEDS = {
    1: [(4, 6, 3), (12, 9, 4), (8, 22, 3), (1, 27, 4), (13, 34, 3), (6, 41, 4)],
    2: [(3, 6, 2), (11, 4, 3), (7, 17, 3), (15, 20, 2), (3, 30, 3), (11, 33, 2), (7, 42, 2)],
    3: [(2, 14, 3), (7, 10, 4), (12, 16, 3), (4, 36, 3), (10, 32, 4), (15, 38, 3)],
}
ANG = {1: 0.55, 2: 0.4, 3: 0.0}   # 각진 거리: max + ANG·min(맨해튼과 체비쇼프 사이) — 둥근 덩이 대신 모난 면


def facets(n):
    """칸마다 가장 가까운 씨앗(가로는 16 둘레). A3 은 세로로 길쭉한 거리(결정 기둥)."""
    sx, sy = (1.0, 1.0) if n != 3 else (1.0, 0.25)
    own = [[0] * 16 for _ in range(48)]
    for y in range(48):
        for x in range(16):
            best, bi = 1e9, 0
            for i, (px, py, _) in enumerate(SEEDS[n]):
                dx = min(abs(x - px), 16 - abs(x - px)) * sx
                dy = abs(y - py) * sy
                d = max(dx, dy) + ANG[n] * min(dx, dy) + (_h(x, y, i, n) % 5) * 0.06
                if d < best:
                    best, bi = d, i
            own[y][x] = bi
    return own


def body(n):
    own = facets(n)
    S = SEEDS[n]
    rows = [['3'] * 16 for _ in range(48)]
    for y in range(48):
        for x in range(16):
            i = own[y][x]
            t = S[i][2]
            up = own[y - 1][x] if y > 0 else i
            dn = own[y + 1][x] if y < 47 else i
            rt = own[y][(x + 1) % 16]
            if dn != i or rt != i:
                c = '1'                                        # 면 사이 금 = 한 줄 짙은 속
            elif up != i:
                c = str(min(6, t + (2 if t >= 4 else 1)))     # 면 윗변 = 단단한 빛 가장자리(한 줄)
            else:
                d = y - max(yy for yy in range(0, y + 1) if (own[yy - 1][x] if yy > 0 else -1) != i)   # 면 윗변에서 내려온 거리
                k = t + (1 if d == 1 else 0) - (1 if d >= 7 else 0)   # 윗변 아래 한 줄 밝게, 면 아래쪽은 한 단 어둡게(앞으로 기운 면)
                if n == 2:
                    k = t - (1 if d >= 5 else 0)
                g = _h(x, y, n, 11) % (29 if n == 3 else 17)
                k += 1 if g == 0 else (-1 if g == 1 else 0)
                c = str(max(1, min(5, k)))
            rows[y][x] = c
    # 서리 줄: 면 하나를 비스듬히 지나는 짧은 옅은 줄
    for (x0, y0, ln) in {1: [(3, 21, 4), (11, 36, 3)], 2: [(5, 12, 3), (12, 28, 4)], 3: [(4, 22, 3)]}[n]:
        for k in range(ln):
            x, y = (x0 + k) % 16, y0 - k // 2
            if rows[y][x] in '2345':
                rows[y][x] = '6'
    for (x, y) in {1: [(12, 19), (5, 31)], 2: [(13, 24)], 3: [(8, 21), (14, 41)]}[n]:
        rows[y][x] = '8'
    # 버들항 동굴 앞면 틀: 윗단 0행 빛 턱 · 맨 아래 두 줄 그늘
    rows[0] = list(''.join('6' if _h(x, 0, n) % 4 else '5' for x in range(16)))
    rows[46] = [('2' if c in '345' else c) for c in rows[46]]
    rows[47] = list(''.join('1' if _h(x, 47, n) % 3 else '0' for x in range(16)))
    return [''.join(r) for r in rows]


def drips(rows, n, long=False):
    """윗변 고드름 드립: 열마다 길이(0~4, long 이면 다발 7~12), 몸 e · 심 f · 그늘 d(오른쪽)."""
    out = [list(r) for r in rows]
    for x in range(16):
        h = _h(x, n, 3 if long else 2)
        ln = (h % 5) if not long else ([0, 3, 7, 11, 5, 9, 12, 4, 0, 6, 10, 8, 3, 0, 5, 2][x])
        if not long and h % 3 == 0:
            ln = 0
        for y in range(1, 1 + ln):
            w = ln - (y - 1)
            out[y][x] = 'g' if y == 1 else ('f' if w > 2 else 'e')
            if x + 1 < 16 and out[y][x + 1] not in 'efg' and w > 1:
                out[y][x + 1] = 'd'
    return [''.join(r) for r in out]


def ends(mid):
    el = [('1' if y < 47 else '0') + mid[y][1] for y in range(48)]
    er = [mid[y][14] + ('1' if y < 47 else '0') for y in range(48)]
    el[0], er[0] = '6' + mid[0][1], mid[0][14] + '6'
    return el, er


LEDGE = [
    '................',
    '..66......66....',
    '.6775.66.6775.66',
    '6544576657445765',
    '4332454434324543',
    '3221233322213322',
    '1111111111111111',
]
CRYSTAL = [
    '...7....',
    '..765...',
    '.76542..',
    '.75431..',
    '..6421..',
    '...21...',
]


def ice_kit(n):
    lg = LG[n]
    m_ = drips(body(n), n)
    el, er = ends(m_)
    k = W5.Kit()
    k.face3 = W5.kit_of(W5.cols3(m_, el, er), lg)
    k.face2 = W5.kit_of(W5.cols3([m_[i] for i in W5.TWO], [el[i] for i in W5.TWO], [er[i] for i in W5.TWO]), lg)
    g_ = drips(body(n), n, long=True)
    k.glyph3 = G(g_, lg)
    k.glyph2 = G([g_[i] for i in W5.TWO], lg)
    cells = [G(r, lg) for r in W5.cols3(m_[32:48], el[32:48], er[32:48])]
    for c in cells:
        stamp(c, LEDGE, lg, 0, 9)
    k.base3 = W5.hcat(*cells)
    alt = G(m_[16:32], lg)
    stamp(alt, CRYSTAL, lg, 4, 5)
    k.alt3 = alt
    return k


def ice_room(n, plan=W5.ROOM):
    k = ice_kit(n)
    rim = W5.tower_rim(1)
    fp = os.path.join(lib.VAR, 'snowfield', 'parts', 'ground-snow.png')
    floor = lib.bd_part('snowfield/ground-snow') if os.path.exists(fp) else None
    fl = (lambda x, y: floor.crop((x % (floor.w // T)) * T, (y % (floor.h // T)) * T, T, T)) if floor else W5.floor_fn('tower')
    out = lib.rooms_render(plan, rim, k.face3, k.face2, fl)
    H, W = len(plan), len(plan[0])
    for y in range(H - 1):
        for x in range(1, W - 1):
            if plan[y + 1][x] == '.' and plan[y][x] == '#' and plan[y + 1][x - 1] == '.' and plan[y + 1][x + 1] == '.' and (x * 7 + y) % 5 == 2:
                out.paste(k.glyph3, x * T, (y - 2) * T)
    return out


def c_ice(n):
    def fn():
        k = ice_kit(n)
        v = ice_room(n)
        lib.put_actor(v, 3, 6)
        return k.image(), {'kind': 'tile', 'parts': k.parts(), 'vignette': v, 'extras': [('test map', ice_room(n, W5.TEST), 2)]}
    return fn


NOTES = {('wall.ice_face', 'A1'): '빙하 면: 큰 다각 얼음 면(면마다 한 단) · 위·왼 단단한 빛 테 · 아래·오른 짙은 속 · 윗변 고드름 드립 · 서리 줄 · 반짝 한 화소',
         ('wall.ice_face', 'A2'): '얼음 덮인 바위: 짙은 청회 바위 위 반투명 얼음판(판 테 옅은 얼음, 판 안 바위가 한 단 밝게 비침)',
         ('wall.ice_face', 'A3'): '결정 기둥: 세로로 길쭉한 프리즘 면(기둥 왼 빛·오른 그늘) · 고드름 드립'}
FNS = {'wall.ice_face': {'A1': c_ice(1), 'A2': c_ice(2), 'A3': c_ice(3)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'wall.ice_face': ['bd-pick-sea-cave-face-cave-3h', 'bd-dg-rock-C-face']}


def line_scenes():
    return {}

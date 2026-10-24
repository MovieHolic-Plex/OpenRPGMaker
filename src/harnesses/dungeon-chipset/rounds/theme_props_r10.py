"""theme-props-r10 — 얼음굴 벽 앞면 2판(2026-10-25). 패널 13 두 심사 모두 A1(빙하 면)이 가장 낫다, 고칠 것 하나:
  sonnet 「반복되는 금 칸 대신 칸 줄마다 2~3개의 큰 평평한 면 + 면마다 단단한 빛 가장자리 하나 · 채도 낮춘 파랑 · 가운데 칸 변형 2~3」
  argon 「16px 비늘·가로 줄 대신 칸 경계를 넘어 이어지는 큰 비대칭 평평한 면 + 날카로운 사선·세로 빛 가장자리」.
→ 가운데를 48열 폭 한 덩이로 그린다(직선 경계의 유클리드 보로노이 = 볼록 다각 면, 48 둘레로 이어짐). 굽기는 `-mid` 키트(3칸 폭)로,
  시공기가 벽 가운데 칸을 x % 3 으로 고른다 → 반복 주기 48px. 면마다 평평한 한 단 · 윗변·왼변 = 빛 가장자리 한 줄 · 아랫변·오른변 = 짙은 금.
  색 줄 둘: 물빛 얼음(water·ice) · 채도 낮은 청회(iron) — 면마다 해시로, 이웃 면과 다른 단.
  A1 = 면 지름 ~11px · A2 = 면 지름 ~14px(더 크고 적게).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_props_r9 as R9  # noqa: E402
import theme_walls_r5 as W5  # noqa: E402
from dot import Cv, stamp  # noqa: E402

WAVE = 'theme_props'
T = 16
L = P1.L
G = P1.G
MW = 48     # 가운데 덩이 폭(3칸)
# 0 깊은 속 · 1 금 · 몸 단 a~e(물빛 얼음) / A~E(청회) · 6 빛 가장자리 · 7 가장 밝은 가장자리 · 8 반짝 · d/e/f/g 고드름(r9 과 같음)
LG = L('0:vrock0 1:water0 a:water1 b:water2 c:ice0 d:water2 e:ice1 '
       '6:ice2 7:ice3 8:ice4 f:ice2 g:ice3 h:ice1 5:ice1 2:water1 3:water2 4:ice0 9:tide0 x:water3 y:ice2')
LAD = '91abcexy7'    # 짙은 속 → water0 · water1 · water2 · ice0 · ice1 · (x 옅은 청회) · ice2 · ice3


def _h(*a):
    return R9._h(*a)


def seeds(n):
    """48×48 위 지터 격자 씨앗. n=1 간격 11 · n=2 간격 14."""
    step = 11 if n == 1 else 14
    out = []
    for gy in range(-1, 48 // step + 2):
        for gx in range(MW // step):
            h = _h(gx, gy, n, 77)
            x = (gx * step + (h % step) + (gy % 2) * step // 2) % MW
            y = gy * step + ((h >> 8) % step)
            out.append((x, y))
    return out


def body(n):
    S = seeds(n)
    own = [[0] * MW for _ in range(48)]
    for y in range(48):
        for x in range(MW):
            best, bi = 1e18, 0
            for i, (px, py) in enumerate(S):
                dx = min(abs(x - px), MW - abs(x - px))
                d = dx * dx * 1.0 + (y - py) * (y - py) * 1.15
                if d < best:
                    best, bi = d, i
            own[y][x] = bi
    # r10b: 면 = 반투명 얼음판. 사다리 LAD(짙은 속 → 옅은 테) 위에서 면마다 바탕 단 1~3,
    # 위·왼 경계 = 빛 테(바탕+3, 옅은 거의 흰빛) · 아래·오른 경계 = 그 면의 그늘(바탕-1) — 검은 줄눈 없음,
    # 면 안은 위·왼에서 멀어질수록 한 단씩 깊어진다(속이 비치는 깊은 파랑).
    base = {i: 3 + _h(i, n, 9) % 3 for i in set(v for r in own for v in r)}   # r10c: 바탕 단 3~5(밝은 반투명 얼음)
    dist = [[0] * MW for _ in range(48)]
    for y in range(48):
        for x in range(MW):
            i = own[y][x]
            du = 0
            while y - du - 1 >= 0 and own[y - du - 1][x] == i and du < 9:
                du += 1
            dl = 0
            while dl < 9 and own[y][(x - dl - 1) % MW] == i:
                dl += 1
            dist[y][x] = min(du, dl) + (du + dl) // 4
    rows = [['b'] * MW for _ in range(48)]
    for y in range(48):
        for x in range(MW):
            i = own[y][x]
            t = base[i]
            up = own[y - 1][x] if y > 0 else i
            lf = own[y][(x - 1) % MW]
            dn = own[y + 1][x] if y < 47 else i
            rt = own[y][(x + 1) % MW]
            if dn != i or rt != i:
                k = t - 2                                   # 아래·오른 경계: 두 단 깊게(금, 먹 아님)
            elif up != i or lf != i:
                k = t + 2 if _h(x, y, n) % 4 else t + 3     # 위·왼 경계: 단단한 빛 가장자리
            else:
                d = dist[y][x]
                k = t + (1 if d == 1 else 0) - (1 if d >= 7 else 0)   # 면은 평평하게 — 빛 가장자리 밑 한 줄 · 깊은 안쪽만 한 단
                if _h(x, y, n, 13) % 37 == 0:
                    k += 1
            rows[y][x] = LAD[max(0, min(len(LAD) - 1, k))]
    # 서리 줄(면 하나 안을 비스듬히) · 반짝
    for (x0, y0, ln) in ([(4, 22, 4), (27, 13, 3), (39, 35, 4)] if n == 1 else [(9, 18, 4), (33, 31, 4)]):
        for k in range(ln):
            x, y = (x0 + k) % MW, y0 - k // 2
            if rows[y][x] not in '0167':
                rows[y][x] = 'e'
    for (x, y) in ([(13, 17), (30, 33), (44, 9)] if n == 1 else [(20, 24), (41, 13)]):
        rows[y][x] = '8'
    # 버들항 동굴 앞면 틀: 윗단 0행 빛 턱 · 맨 아래 두 줄 그늘
    rows[0] = list(''.join('6' if _h(x, 0, n) % 4 else 'c' for x in range(MW)))
    rows[46] = [('a' if c in 'bce67' else c) for c in rows[46]]
    rows[47] = list(''.join('1' if _h(x, 47, n) % 3 else '0' for x in range(MW)))
    return [''.join(r) for r in rows]


def drips(rows, n, long=False):
    out = [list(r) for r in rows]
    W = len(out[0])
    for x in range(W):
        h = _h(x, n, 3 if long else 2)
        ln = (h % 5) if not long else ([0, 3, 7, 11, 5, 9, 12, 4, 0, 6, 10, 8, 3, 0, 5, 2][x % 16])
        if not long and h % 3 == 0:
            ln = 0
        for y in range(1, 1 + ln):
            w = ln - (y - 1)
            out[y][x] = 'g' if y == 1 else ('f' if w > 2 else 'h')
            if x + 1 < W and out[y][x + 1] not in 'fgh' and w > 1:
                out[y][x + 1] = 'd'
    return [''.join(r) for r in out]


def cut(rows, x0):
    return [r[x0:x0 + 16] for r in rows]


def ends(mid):
    el = [('1' if y < 47 else '0') + mid[y][1] for y in range(48)]
    er = [mid[y][MW - 2] + ('1' if y < 47 else '0') for y in range(48)]
    el[0], er[0] = '6' + mid[0][1], mid[0][MW - 2] + '6'
    return el, er


LEDGE = [
    '................',
    '..66......66....',
    '.6776.66.6776.66',
    '6c44c76674cc4776',
    'c4bbccc4cbb4c4cc',
    'b4abbbab4aabbb4a',
    '1111111111111111',
]
CRYSTAL = R9.CRYSTAL


class Kit(W5.Kit):
    def parts(s):
        p = super().parts()
        p['mid3h'] = s.mid3
        p['mid2h'] = s.mid2
        return p


def ice_kit(n):
    m48 = drips(body(n), n)
    el, er = ends(m48)
    m_ = cut(m48, 0)
    k = Kit()
    # 왼끝·오른끝 칸: 덩이 왼쪽 첫 칸·오른쪽 끝 칸 그림(끝 2열 = 짙은 끝선)
    l_rows = [e + r[2:16] for r, e in zip(cut(m48, 0), el)]
    r_rows = [r[:14] + e for r, e in zip(cut(m48, 32), er)]
    k.face3 = W5.hcat(G(l_rows, LG), G(m_, LG), G(r_rows, LG))
    T2 = W5.TWO
    k.face2 = W5.hcat(G([l_rows[i] for i in T2], LG), G([m_[i] for i in T2], LG), G([r_rows[i] for i in T2], LG))
    k.mid3 = G(m48, LG)
    k.mid2 = G([m48[i] for i in T2], LG)
    g_ = drips(cut(body(n), 16), n, long=True)
    k.glyph3 = G(g_, LG)
    k.glyph2 = G([g_[i] for i in T2], LG)
    cells = [G(r, LG) for r in (l_rows[32:48], m_[32:48], r_rows[32:48])]
    for c in cells:
        stamp(c, LEDGE, LG, 0, 9)
    k.base3 = W5.hcat(*cells)
    alt = G(cut(m48, 16)[16:32], LG)
    stamp(alt, CRYSTAL, R9.LG[1], 4, 5)
    k.alt3 = alt
    return k


def ice_room(n, plan=W5.ROOM):
    """시공기와 같은 규칙: 벽 가운데 칸은 mid 키트의 x % 3 열."""
    k = ice_kit(n)
    rim = W5.tower_rim(1)
    fp = os.path.join(lib.VAR, 'snowfield', 'parts', 'ground-snow.png')
    floor = lib.bd_part('snowfield/ground-snow') if os.path.exists(fp) else None
    fl = (lambda x, y: floor.crop((x % (floor.w // T)) * T, (y % (floor.h // T)) * T, T, T)) if floor else W5.floor_fn('tower')
    out = lib.rooms_render(plan, rim, k.face3, k.face2, fl)
    H, W = len(plan), len(plan[0])
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] != '#'  # noqa: E731
    for y in range(H):
        for x in range(W):
            if not walk(x, y) or walk(x, y - 1):
                continue
            run = 0
            while y - 1 - run >= 0 and not walk(x, y - 1 - run) and run < 4:
                run += 1
            h = min(3, 3 if run >= 4 else run - 1)
            for b in range(h):
                X, Y = x, y - 1 - b
                left = walk(X - 1, y) and not walk(X - 1, y - 1)
                right = walk(X + 1, y) and not walk(X + 1, y - 1)
                if left and right:
                    mk = k.mid3 if h >= 3 else k.mid2
                    out.paste(mk.crop((X % 3) * T, (h - 1 - b) * T, T, T), X * T, Y * T)
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
        # 그림(8×3칸): 3단 앞면 | 가운데 덩이 3칸 | 새김 열 | 변형·아랫단 가운데 (2단은 같은 그림의 윗단+아랫단, 부품에만)
        img = Cv(128, 48)
        img.paste(k.face3, 0, 0)
        img.paste(k.mid3, 48, 0)
        img.paste(k.glyph3, 96, 0)
        img.paste(k.alt3, 112, 0)
        img.paste(k.base3.crop(16, 0, 16, 16), 112, 32)
        img.paste(k.mid3.crop(0, 16, 16, 16), 112, 16)
        return img, {'kind': 'tile', 'parts': k.parts(), 'vignette': v, 'extras': [('test map', ice_room(n, W5.TEST), 2)]}
    return fn


NOTES = {('wall.ice_face', 'A1'): '빙하 면 2판: 48열 덩이(가운데 칸 x%3) · 직선 경계 다각 면(지름 ~11) · 면마다 평평한 한 단(물빛 얼음/청회 두 줄) · 위·왼 빛 가장자리 · 아래·오른 짙은 금',
         ('wall.ice_face', 'A2'): '같은 짜임, 면 지름 ~14(더 크고 적게)'}
FNS = {'wall.ice_face': {'A1': c_ice(1), 'A2': c_ice(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = R9.BOARD_REFS


def line_scenes():
    return {}

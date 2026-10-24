"""theme-props-r7 — 얼음굴 벽 앞면(2026-10-24). 패널 8 argon 「성벽 벽돌 질감을 그대로 씀 · 16px 기둥 반복 · 윗단 밝은 눈 띠가
천장 테두리와 떨어져 보임」 반영: 벽돌을 버리고 버들항 동굴 바위 줄 C(검푸른 층 바위)와 같은 **층 바위**로 —
  켜 다섯(두께 7~11줄, 경계가 열마다 0~2줄 오르내림, 16 주기로 이어짐) · 켜마다 위쪽 빛 한 줄 · 경계 = 그늘 + 짙은 틈 ·
  틈 둘에 하나는 얼음이 차서 굳은 줄(ice0~2, 2줄) · 바위 결 = 알갱이(버들항 동굴) · 얼음 흘러내림 두 갈래(밝은 끝 · 가운데 · 그늘 쪽).
  윗단 = 바위 그대로(눈 띠 없음). 새김 칸 = 긴 고드름 다발이 위 틈에서 내려옴 · 변형 = 바위에 박힌 얼음 덩이 · 아랫단 = 얼음 턱.
  A1 = 검푸른 바위(vrock) · A2 = 회색 바위(crock).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_props_r3 as P3  # noqa: E402
import theme_walls_r8 as W8  # noqa: E402
from dot import Cv, stamp  # noqa: E402

WAVE = 'theme_props'
T = 16
L = P1.L
G = P1.G

LIF = L('j:void1 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 A:vrock0 B:iron0 C:iron1 D:iron2 E:iron4 1:void1 2:vrock1 3:castle2 4:castle3 5:castle5 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')
LIF2 = L('j:vrock0 a:crock1 b:crock2 c:crock3 d:crock4 e:crock5 A:cata0 B:cata1 C:cata3 D:cata5 E:cata6 1:crock0 2:crock2 3:crock3 4:crock4 5:crock6 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')

# 켜 경계(위 → 아래) 기준 행 · 열마다 오르내림(16 주기) · 켜 몸 단
BOUND = [0, 9, 18, 27, 37, 48]
WAVY = [
    [0, 0, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 0, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0, 0, 0, 1],
    [0, 1, 1, 2, 2, 1, 0, 0, 0, 1, 1, 1, 2, 1, 1, 0],
    [2, 1, 1, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 1, 1, 2],
]
BODY = [2, 1, 2, 1, 1]
ICE_SEAM = {1, 3}            # 이 경계 틈엔 얼음이 찼다
RUNS = []   # 흘러내림 없음 — 가운데 칸마다 같은 자리에 와서 16px 줄무늬가 됐다(얼음은 틈·새김·턱에만)


def rock(seed=0):
    rows = [['c'] * 16 for _ in range(48)]
    for x in range(16):
        bs = [BOUND[0]] + [BOUND[i + 1] + WAVY[i][(x + seed * 5) % 16] for i in range(4)] + [48]
        for k in range(5):
            y0, y1 = bs[k], bs[k + 1]
            body = BODY[k]
            for y in range(y0, y1):
                d = y - y0
                t = body + 1 if d == 0 else (body - 1 if y == y1 - 1 else body)
                rows[y][x] = 'abcde'[max(0, min(4, t))]
            if 0 < k:
                if (k - 1) in ICE_SEAM:
                    rows[y0][x] = 'v' if (x + k) % 4 else 'j'      # 틈에 낀 얼음(어두운 얼음, 끊김)
                    if y0 - 1 >= 0:
                        rows[y0 - 1][x] = 'w' if (x * 3 + k) % 5 < 2 else 'a'
                else:
                    rows[y0][x] = 'j'
                    if y0 - 1 >= 0:
                        rows[y0 - 1][x] = 'a'
    for (x, a, b) in RUNS:
        for y in range(a, b):
            rows[y][x] = 'x' if y < b - 2 else 'w'
            rows[y][x - 1] = 'y' if y < b - 3 else rows[y][x - 1]
            if x + 1 < 16:
                rows[y][x + 1] = 'v' if rows[y][x + 1] in 'abcde' else rows[y][x + 1]
        rows[a][x] = 'z'
    # 켜 안 결(버들항 동굴 줄 C): 켜 가운데쯤 밝은 줄무늬 덩이(길이 3~7, 한 단 위) · 그 아래 그늘 한 화소 · 짙은 홈 점(두 화소)
    for y in range(48):
        for x in range(16):
            h = ((x + seed * 5) * 2654435761 ^ y * 40503 ^ 0x9e37) & 0xffff
            c = rows[y][x]
            if c not in 'bcd':
                continue
            if h % 13 == 0:
                ln = 3 + (h >> 4) % 5
                for i in range(ln):
                    xx = (x + i) % 16
                    if rows[y][xx] in 'bcd':
                        rows[y][xx] = 'abcde'['abcde'.index(rows[y][xx]) + 1]
                        if y + 1 < 48 and rows[y + 1][xx] in 'bcd':
                            rows[y + 1][xx] = 'abcde'['abcde'.index(rows[y + 1][xx]) - 1]
            elif h % 17 == 5 and x + 1 < 16 and rows[y][x + 1] in 'bcd':
                rows[y][x] = rows[y][x + 1] = 'a'
    # 판 나누기: 켜마다 세로 금 2~3개(자리·기울기가 켜마다 다름) → 판마다 몸 단·색 줄(abcde · ABCDE · 12345)을 해시로, 판 왼끝 빛 · 오른끝 그늘
    sets = ('abcde', 'ABCDE', '12345')
    for k in range(5):
        h0 = (k * 2654435761 ^ seed * 97 ^ 0x51ed) & 0xffff
        cuts = sorted({(h0 % 7) + 2, (h0 >> 3) % 6 + 9, 15 if (h0 >> 7) % 2 else 13})
        for x in range(16):
            bs = [BOUND[0]] + [BOUND[i + 1] + WAVY[i][(x + seed * 5) % 16] for i in range(4)] + [48]
            y0, y1 = bs[k], bs[k + 1]
            pid = sum(1 for c in cuts if x >= c)
            hp = (k * 40503 ^ pid * 2246822519 ^ seed * 31) & 0xffff
            ramp = sets[hp % 3]
            shift = (hp >> 4) % 3 - 1
            for y in range(y0 + 1, y1 - 1):
                c = rows[y][x]
                if c not in 'abcde':
                    continue
                i = max(0, min(4, 'abcde'.index(c) + shift))
                if x in cuts:
                    rows[y][x] = 'j' if (y + k) % 4 else 'a'
                    continue
                if x - 1 in cuts or x == 0 and 0 in cuts:
                    i = min(4, i + 1)
                if x + 1 in cuts:
                    i = max(0, i - 1)
                rows[y][x] = ramp[i]
    rows = [''.join(r) for r in rows]
    rows = W8.speck3(rows, 41 + seed, top=5)
    return W8.pit_speck(rows, 41 + seed, top=5)


def ends(mid):
    el = [r[:2] for r in mid]
    er = [r[-2:] for r in mid]
    el = [('b' if c in 'abcde' else c) + e[1] for c, e in zip([r[0] for r in mid], el)]
    er = [e[0] + ('a' if c in 'abcde' else c) for c, e in zip([r[-1] for r in mid], er)]
    return el, er


ICICLES = P3.ICICLES
FROZEN = P3.FROZEN
LEDGE = [
    '.........z......',
    '.zz.....zyz...zz',
    'zyyz.zzzyxyz.zyy',
    'yxxyzyyyxxwxzyxx',
    'xwwxyxxxwwvwyxww',
    'wvvwxwwwvvvvxwvv',
    'vvvvvvvvvvvvvvvv',
]


def ice_kit(n=1):
    lg = LIF if n == 1 else LIF2
    m_ = rock(0)
    el, er = ends(m_)
    k = W8.Kit()
    k.face3 = W8.kit_of(W8.cols3(m_, el, er), lg)
    k.face2 = W8.kit_of(W8.cols3([m_[i] for i in W8.TWO], [el[i] for i in W8.TWO], [er[i] for i in W8.TWO]), lg)
    m = G(m_, lg)
    g3 = Cv(16, 48)
    g3.a[:] = G(rock(1), lg).a
    stamp(g3, ICICLES, lg, 0, BOUND[1] + 1)
    k.glyph3 = g3
    g2 = Cv(16, 32)
    r1 = rock(1)
    g2.a[:] = G([r1[i] for i in W8.TWO], lg).a
    stamp(g2, ICICLES[:8], lg, 0, BOUND[1] + 1)
    k.glyph2 = g2
    cells = [G(r, lg) for r in W8.cols3(m_[32:48], el[32:48], er[32:48])]
    for c in cells:
        stamp(c, LEDGE, lg, 0, 9)
    k.base3 = W8.hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, FROZEN, lg, 3, 4)
    k.alt3 = alt
    return k


P3.ice_kit = ice_kit


def c_ice(n):
    return P3.c_ice_face(n)


NOTES = {('wall.ice_face', 'A1'): '검푸른 층 바위(켜 다섯·물결 경계·얼음 찬 틈 둘·얼음 흘러내림 두 갈래), 새김 = 고드름 다발, 변형 = 박힌 얼음 덩이, 아랫단 = 얼음 턱',
         ('wall.ice_face', 'A2'): '회색 층 바위 + 같은 얼음'}
FNS = {'wall.ice_face': {'A1': c_ice(1), 'A2': c_ice(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'wall.ice_face': P1.BOARD_REFS['wall.ice_face']}


def line_scenes():
    return {}

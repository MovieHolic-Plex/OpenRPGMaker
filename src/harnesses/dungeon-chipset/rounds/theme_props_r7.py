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

LIF = L('j:void1 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:iron4 A:iron0 B:iron1 C:iron2 D:iron3 E:iron5 1:void2 2:vrock1 3:iron1 4:crock3 5:crock5 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:water0 k:water1')
LIF2 = L('j:vrock0 a:crock1 b:crock2 c:crock3 d:crock4 e:crock5 A:cata0 B:cata1 C:cata3 D:cata5 E:cata6 1:crock0 2:crock2 3:crock3 4:crock4 5:crock6 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:water0 k:vrock1')

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
                    hh = ((x + seed * 5) * 2246822519 ^ k * 3266489917) & 0xffff
                    rows[y0][x] = 'j' if hh % 7 else 'o'      # r7d: 틈 = 바위 어둠, 얼음은 일곱에 하나 반짝(패널 10 「코발트 채도·16px 반복」) · r7b: 틈에 낀 얼음 = 짙은 물빛(채도 낮춤), 밝은 얼음은 드문드문
                    if y0 - 1 >= 0:
                        rows[y0 - 1][x] = 'v' if hh % 13 == 3 else 'a'
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
            if h % 17 == 0:
                ln = 3 + (h >> 4) % 4
                for i in range(ln):
                    xx = (x + i) % 16
                    if rows[y][xx] in 'bcd':
                        rows[y][xx] = 'abcde'['abcde'.index(rows[y][xx]) + 1]
                        if y + 1 < 48 and rows[y + 1][xx] in 'bcd':
                            rows[y + 1][xx] = 'abcde'['abcde'.index(rows[y + 1][xx]) - 1]
            # r7c: 짙은 홈 점 두 화소 없음 — 줄무늬와 합쳐 16px 마다 「E」 글자처럼 읽혔다
    # 판 나누기: 켜마다 세로 금 2~3개(자리·기울기가 켜마다 다름) → 판마다 몸 단·색 줄(abcde · ABCDE · 12345)을 해시로, 판 왼끝 빛 · 오른끝 그늘
    sets = ('abcde', 'ABCDE', '12345')
    for k in range(5):
        h0 = (k * 2654435761 ^ seed * 97 ^ 0x51ed) & 0xffff
        c1 = (h0 % 5) + 3                      # r7c: 금은 3~7 · 10~13 두 개(붙지 않게 — 붙으면 금·빛 줄이 합쳐 글자처럼 읽혔다)
        c2 = (h0 >> 3) % 4 + 10
        cuts = sorted({c1, c2})
        for x in range(16):
            bs = [BOUND[0]] + [BOUND[i + 1] + WAVY[i][(x + seed * 5) % 16] for i in range(4)] + [48]
            y0, y1 = bs[k], bs[k + 1]
            pid = sum(1 for c in cuts if x >= c)
            hp = (k * 40503 ^ pid * 2246822519 ^ seed * 31) & 0xffff
            ramp = sets[hp % 3]
            shift = 0   # r7c: 판마다 밝기 단은 같고 색 줄만 다르다(판 경계가 16px 세로 띠로 읽히지 않게)
            for y in range(y0 + 1, y1 - 1):
                c = rows[y][x]
                if c not in 'abcde':
                    continue
                i = max(0, min(4, 'abcde'.index(c) + shift))
                if x in cuts:
                    pass     # r7d: 금 자리도 몸 단 그대로(색 줄만 바뀐다) · r7b: 판 금 = 두 단 그늘(먹 줄 아님 — 16px 세로줄로 읽혔다)
                rows[y][x] = ramp[i]
    rows = [''.join(r) for r in rows]
    # r7c: 밝은 알갱이 덩이(speck3) 없음 — 버들항 동굴 줄 C 처럼 조용한 켜. 같은 줄 ±1 알갱이(r7e: 두 번 — 칸 정보량)
    rows = W8.pit_speck(W8.pit_speck(rows, 41 + seed, top=5), 77 + seed, top=5)
    # r7f: 켜 윗턱(경계 바로 아래 빛 줄)에 서리 — 넷에 하나 옅은 얼음 w, 그 옆 드물게 짙은 얼음 v (얼음굴 주제 · 칸 정보량)
    out = [list(r) for r in rows]
    for x in range(16):
        bs = [BOUND[0]] + [BOUND[i + 1] + WAVY[i][(x + seed * 5) % 16] for i in range(4)] + [48]
        for k in range(1, 5):
            y = bs[k] + 1
            h = ((x + seed * 5) * 2654435761 ^ k * 97) & 0xff
            if y < 48 and out[y][x] not in 'jovwxyz.':
                out[y][x] = 'v' if h % 5 == 0 else ('k' if h % 7 == 1 else out[y][x])   # r7g: 서리 = 짙은 얼음 v·물빛 k 만(밝은 점 = 색종이, 패널 11 argon)
    return [''.join(r) for r in out]


def ends(mid):
    el = [r[:2] for r in mid]
    er = [r[-2:] for r in mid]
    el = [('b' if c in 'abcde' else c) + e[1] for c, e in zip([r[0] for r in mid], el)]
    er = [e[0] + ('a' if c in 'abcde' else c) for c, e in zip([r[-1] for r in mid], er)]
    return el, er


ICICLES = P3.ICICLES
FROZEN = P3.FROZEN
# r7g: 얼음 턱 = 바위 위에 얹힌 둔한 얼음(윗선 한 단만 밝게, 몸은 짙은 얼음·물빛) — 밝은 물결 띠(패널 11 「장난감 같은 트림」) 대신
LEDGE = [
    '................',
    '................',
    '...xx...........',
    '.xxwvx.....xxx..',
    'xwvvkvxxxxxwvvx.',
    'vkkookvvwvvkookx',
    'kooooookkkkooooo',
]
# 변형 칸: 바위에 박힌 얼음 덩이(둔한 얼음, 빛 가장자리 한 줄) — 흰 심이 빛나는 구슬로 읽혔다
FROZEN_DULL = [
    '....kkvk........',
    '...kvwwvk.......',
    '..kvwxwwvk......',
    '..kvwwvvvkk.....',
    '...kvvvkkk......',
    '....kkkko.......',
    '.....ooo........',
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
    stamp(alt, FROZEN_DULL, lg, 3, 4)
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

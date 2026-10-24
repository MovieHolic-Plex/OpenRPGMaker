"""theme-props-r3 — 얼음굴 벽 앞면 다시 그림(2026-10-24). r1 독립 VQA(argon FAIL) 반영:
  「벽돌마다 얼음 점 도장 · 벽돌 격자가 그대로 · 고드름이 16px 마다 똑같이」
  → 돌 = r5 탑 앞면과 같은 돌마다 칠(세 줄 색 · 줄 넘는 잡티, object-gate 화풍 PASS 짜임)을 검푸른 얼음굴 바위로.
    윗단 = 깨진 면이 있는 얼음 껍질(빛 받는 왼쪽 면 · 가운데 · 그늘 면, 면 경계가 비스듬), 한 칸 안에서 길이가 다른 고드름 셋.
    새김 = 길이가 제각각인 큰 고드름 다발이 가운데단까지(좌우 비대칭), 변형 = 돌 틈을 메운 얼음 덩이(점 아님), 아랫단 = 쌓인 얼음 턱(울퉁불퉁).
  A1 = 검푸른 바위(vrock) · A2 = 회색 바위(crock).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_walls_r5 as W5  # noqa: E402
from dot import Cv, stamp  # noqa: E402

WAVE = 'theme_props'
T = 16
L = W5.L
G = W5.G

LIF = L('j:arcane0 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 A:iron0 B:iron1 C:iron2 D:iron3 E:iron4 '
        '1:castle0 2:castle1 3:castle2 4:castle4 5:castle5 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')
LIF2 = L('j:vrock1 a:crock1 b:crock2 c:crock3 d:crock4 e:crock5 A:cata0 B:cata1 C:cata3 D:cata5 E:cata6 '
         '1:castle0 2:castle1 3:castle2 4:castle4 5:castle5 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')
JOINT = [5, 13, 5, 13, 5, 13]
STONE = [(2, 1), (1, 2), (2, 2), (3, 2), (2, 3), (1, 2)]

# 얼음 껍질(윗단 0~10행, '.' = 돌 그대로). 면: z 윗끝 빛 · y 왼 면 · x 가운데 면 · w 그늘 면 · v 가장 어두운 끝·금.
GLAZE = [
    'zzyzzzzyzzzzzyzz',
    'yyyyxyyyyyxyyyyx',
    'xyyxwxyyyxwxyyxw',
    'wxxwvwxyxwvwxxwv',
    'vwxv.vwxxv.vwxv.',
    '.vwv.vwxwv..vwv.',
    '.vw...vxwv...vv.',
    '..v...vxwv....v.',
    '......vwv.......',
    '......vwv.......',
    '.......v........',
]
# 새김 칸(3단 16×48): 껍질 아래로 길이가 제각각인 고드름 다발(오른쪽이 더 길다)
ICICLES = [
    '.vw.vxw..vxwv.v.',
    '.vw.vxw..vxwv.wv',
    '.v..vxw..vyxwvwv',
    '.v..vxv..vyxw.wv',
    '.....xv..vyxw.v.',
    '.....wv..vyxwv..',
    '.....v...vxxw...',
    '.....v...vxwv...',
    '.........vxwv...',
    '..........xw....',
    '..........xv....',
    '..........wv....',
    '..........v.....',
    '..........v.....',
]
# 변형 칸: 돌 틈을 메운 얼음 덩이(가운데단)
FROZEN = [
    '....vvwv........',
    '...vwxyxwv......',
    '..vwxyzyxwv.....',
    '..vxyzyyxwvv....',
    '...vxyyxwwv.....',
    '....vwxwvv......',
    '.....vvv........',
]
# 아랫단: 쌓인 얼음 턱(울퉁불퉁한 윗선, 앞면 그늘)
LEDGE = [
    '..........z.....',
    '.zz......zyz..z.',
    'zyyz..zzzyxyzzyz',
    'yxxyzzyyxxwxyyxy',
    'xwwxyyxxwwvwxxwx',
    'wvvwxxwwvvvvwwvw',
    'vvvvvvvvvvvvvvvv',
]


def mid(n=1):
    rows = W5.stone_rows(JOINT, STONE, 'abcde', 21 + n)
    rows = W5.speck3(W5.three_ramp(rows, JOINT, 21 + n), 21 + n, top=5)
    rows = [list(r) for r in rows]
    for y, r in enumerate(GLAZE):
        for x, c in enumerate(r):
            if c != '.':
                rows[y][x] = c
    return [''.join(r) for r in rows]


def ends():
    el, er = W5.tower_ends()
    el = [('zy' if y == 0 else 'yx' if y < 3 else 'xw' if y < 5 else e) for y, e in enumerate(el)]
    er = [('yw' if y == 0 else 'xv' if y < 3 else 'wv' if y < 5 else e) for y, e in enumerate(er)]
    return el, er


def ice_kit(n=1):
    lg = LIF if n == 1 else LIF2
    m_ = mid(n)
    el, er = ends()
    k = W5.Kit()
    k.face3 = W5.kit_of(W5.cols3(m_, el, er), lg)
    k.face2 = W5.kit_of(W5.cols3([m_[i] for i in W5.TWO], [el[i] for i in W5.TWO], [er[i] for i in W5.TWO]), lg)
    m = G(m_, lg)
    g3 = Cv(16, 48)
    g3.a[:] = m.a
    stamp(g3, ICICLES, lg, 0, 6)
    k.glyph3 = g3
    g2 = Cv(16, 32)
    g2.a[:] = G([m_[i] for i in W5.TWO], lg).a
    stamp(g2, ICICLES[:8], lg, 0, 6)
    k.glyph2 = g2
    cells = [G(r, lg) for r in W5.cols3(m_[32:48], el[32:48], er[32:48])]
    for c in cells:
        stamp(c, LEDGE, lg, 0, 9)
    k.base3 = W5.hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, FROZEN, lg, 3, 4)
    k.alt3 = alt
    return k


def ice_room(n, plan=W5.ROOM):
    k = ice_kit(n)
    rim = W5.tower_rim(1)   # 장면 전용 천장 대용(얼음굴 천장 그룹 beodeul_dungeon_ceiling_ice 는 번들에 따로 있다)
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


def c_ice_face(n):
    def fn():
        k = ice_kit(n)
        v = ice_room(n)
        lib.put_actor(v, 3, 6)
        return k.image(), {'kind': 'tile', 'parts': k.parts(), 'vignette': v,
                           'extras': [('test map', ice_room(n, W5.TEST), 2)]}
    return fn


NOTES = {('wall.ice_face', 'A1'): '검푸른 바위 돌마다 칠 + 깨진 면 얼음 껍질·길이 다른 고드름, 새김 = 비대칭 고드름 다발, 변형 = 틈 얼음 덩이, 아랫단 = 얼음 턱',
         ('wall.ice_face', 'A2'): '회색 바위 + 같은 얼음'}
FNS = {'wall.ice_face': {'A1': c_ice_face(1), 'A2': c_ice_face(2)}}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = '줄 공통 — ' + note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'wall.ice_face': ['bd-dg-rock-C-face', 'bd-pick-castle-catacombs-face-castle-3h']}


def line_scenes():
    return {}

"""theme-props-r5 — 광차·얼음 벽(2026-10-24).
  얼음 벽: 패널 7 「얼음 띠를 성벽에 붙인 것 · 고드름이 16px 마다 · 돌에 얼음 기운 없음」 → 돌 둘째 줄 = 서리 낀 돌(vrock→ice0·ice1),
    가운데 칸 껍질 = 짧고 고르지 않은 얼음 턱(2~4줄, 고드름 없음), 긴 고드름은 새김 칸에만(시공기 14%). 돌 잡티 = 패인 점(r8).
  광차: 패널 7 argon 「사람보다 크다 · 옆에서 본 납작한 상자」 반영:
  버들항 광산 광차 cart-h 와 같은 크기(몸 24×14, 13~29행) — 광석 봉우리 두 줄 · 뒤 테두리 한 줄 · 통 안 세 줄(광석 더미) ·
  앞 테두리 두 줄 · 널 앞면 여덟 줄(쇠테 하나·못) · 바퀴 넷 중 앞 둘(3×3)이 아래 레일 위. 색은 r4 와 같다(어두운 쇠 = 강철 톤).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_earth_r1 as E1  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_props_r4 as P4  # noqa: E402
import theme_props_r3 as P3  # noqa: E402
import theme_walls_r8 as W8  # noqa: E402

WAVE = 'theme_props'
G = P1.G
CART = [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............tu...po.............',
    '........sttutsttupqo.tu.........',
    '.....lkkkkkkkkkkkkkkkkkkkkj.....',
    '....lktsnoptsstuttsoopqsttij....',
    '....lksttsonssttssnossttssij....',
    '....lllllllllllllllllllllllk....',
    '....kkkkkkkkkkkkkkkkkkkkkkki....',
    '....jkbbbbbbbbbbbbbbbbbbbbhg....',
    '....jkddedddbddddddbdccccchg....',
    '....jkddddddbddddddbdccdcchg....',
    '....jliiiiiiliiiiiijihhhhhjg....',
    '....jkddddddbddedddbdccccchg....',
    '....jkdddddebdddeddbdccccchg....',
    '....jkdddeddbddddddbdccccchg....',
    '....jkajkjaaaaaaaaaaaajkjahg....',
    '.......kliggggggggggggkli.......',
    '.......jij............jij.......',
    '......~~~~~~~~~~~~~~~~~~~~......',
    '................................',
]


def c_cart(n):
    def fn():
        cv = G(CART, P4.LCART if n == 1 else P4.LCART2)
        sc = E1.scene('mine', 7, 6, face_h=2)
        rail = E1.kit_cv('bd-pick-dungeon-theme-rails-ew')
        for x in range(7):
            E1.place(sc, rail, x, 4)
        E1.place(sc, cv, 2, 3)
        E1.put_actor(sc, 5, 4)
        return cv, {'kind': 'objects', 'parts': {'광차': cv}, 'vignette': sc}
    return fn


P3.W5 = W8
P3.LIF = P1.L('j:arcane0 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 A:vrock1 B:vrock2 C:iron3 D:iron4 E:snow0 '
              '1:vrock0 2:vrock1 3:vrock2 4:vrock3 5:iron4 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')
P3.LIF2 = P1.L('j:vrock1 a:crock1 b:crock2 c:crock3 d:crock4 e:crock5 A:crock1 B:crock2 C:iron3 D:iron4 E:snow0 '
               '1:crock1 2:crock2 3:crock3 4:crock4 5:iron4 v:ice0 w:ice1 x:ice2 y:ice3 z:ice4 o:void0')
P3.GLAZE = [
    'zzyzzzzzyzzzzyzz',
    'yxyyyxyyyyxyyxyy',
    'wxwxwvxxwxwvxwvx',
    'vw.vv.vwv.v..v.w',
    '.v.......v......',
]
_mid0 = P3.mid


def _mid(n=1):
    rows = _mid0(n)
    return W8.pit_speck(rows, 31 + n, top=5)


P3.mid = _mid


def c_ice(n):
    return P3.c_ice_face(n)


NOTES = {('prop.minecart', 'A1'): '버들항 광차 크기의 3/4 광차: 금빛 광석 더미가 보이는 통 안, 앞 바퀴가 아래 레일 위',
         ('prop.minecart', 'A2'): '같은 통 + 청록 마광석',
         ('wall.ice_face', 'A1'): '서리 낀 검푸른 바위(돌 둘째 줄 = 얼음빛) + 짧은 얼음 턱, 새김 칸에만 긴 고드름',
         ('wall.ice_face', 'A2'): '서리 낀 회색 바위 + 같은 얼음'}
FNS = {'prop.minecart': {'A1': c_cart(1), 'A2': c_cart(2)}, 'wall.ice_face': {'A1': c_ice(1), 'A2': c_ice(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'prop.minecart': P1.BOARD_REFS['prop.minecart'], 'wall.ice_face': P1.BOARD_REFS['wall.ice_face']}


def line_scenes():
    return {}

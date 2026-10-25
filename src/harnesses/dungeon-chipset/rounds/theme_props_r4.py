"""theme-props-r4 — 광차·얼음 벽 다시 그림(2026-10-24). 패널 6(argon) 반영:
  광차  「32×32 를 다 채운 키 큰 상자 · 바퀴가 아래 레일 하나만 · 몸이 북쪽 바닥으로 튀어나옴 · 옆에서 본 쓰레기통」
        → 버들항 광산 광차(cart-h)와 같은 낮은 몸(높이 19줄, 9~27행): 광석 봉우리 · 뒤 테두리 · 통 안 · 앞 테두리 · 널 앞면 7줄 ·
          바퀴 넷 중 앞 둘이 선로 아래 레일(27행)에, 몸 윗끝은 위 레일(21행) 위 한 칸 반(장면 dy 0).
  얼음 벽 「돌 안 한 화소 잡티(TV 잡음) · 고드름 16px 톱니 반복 · 밑 얼음 턱이 칸 경계에서 잘림」
        → 돌 잡티 = 2화소 덩이만(낱점 없음), 껍질·고드름은 세 칸(왼끝·가운데·오른끝) 다른 행 + 가운데 칸 두 벌(아랫단 변형으로 번갈아),
          얼음 턱은 칸 양끝에서 같은 높이로 이어지게(0열·15열 = 같은 행).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_earth_r1 as E1  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_props_r3 as P3  # noqa: E402
import theme_walls_r7 as W7  # noqa: E402

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
    '..............tu...p............',
    '........ttu.tsttupqo.tu.........',
    '......sttuutssttpqqotstu........',
    '....lkkkkkkkkkkkkkkkkkkkkkkj....',
    '...lksttsoptsstuttsooppsttskj...',
    '...lktsnopossttsnopqosstsstij...',
    '...lkgssttsonssttssnosstssgij...',
    '...lllllllllllllllllllllllllk...',
    '...kkkkkkkkkkkkkkkkkkkkkkkkki...',
    '...jkbbbbbbbbbbbbbbbbbbbbbbhg...',
    '...jkddedddbdeddddddbdcdccchg...',
    '...jkddddddbdddeddddbdccccchg...',
    '...jliiiiiiliiiiiiiijihhhhhjg...',
    '...jkddddddbddddddddbdccccchg...',
    '....jkddeddbddddedddbccccchg....',
    '....jkjkkjdbddddddddbcjkkjhg....',
    '.....hlhikhhhhhhhhhhhhlhikh.....',
    '......khhi~~~~~~~~~~~~khhi......',
    '......jiij............jiij......',
    '........~~~~~~~~~~~~~~~~........',
    '................................',
    '................................',
    '................................',
]


# 글자는 r1 과 같다. 어두운 쇠(g h) = 검푸른 강철 톤(vrock), 통 끝 j = 짙은 나무 갈색 — 무채 근흑 윤곽 대신 재질 어두운 톤.
LCART = P1.L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 g:vrock1 h:vrock2 i:iron2 j:wood0 k:iron4 l:iron5 '
             'm:gold1 n:gold2 o:gold3 p:gold4 q:gold5 s:crock2 t:crock4 u:crock6')
LCART2 = P1.L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 g:vrock1 h:vrock2 i:iron2 j:wood0 k:iron4 l:iron5 '
              'm:glow0 n:glow1 o:glow2 p:glow4 q:glow5 s:vrock1 t:vrock3 u:vrock4')


def c_cart(n):
    def fn():
        cv = G(CART, LCART if n == 1 else LCART2)
        sc = E1.scene('mine', 7, 6, face_h=2)
        rail = E1.kit_cv('bd-pick-dungeon-theme-rails-ew')
        for x in range(7):
            E1.place(sc, rail, x, 4)
        E1.place(sc, cv, 2, 3)
        E1.put_actor(sc, 5, 4)
        return cv, {'kind': 'objects', 'parts': {'광차': cv}, 'vignette': sc}
    return fn


# 얼음 벽: r3 짜임 + 잡티는 2화소 덩이만(W7.speck3), 고드름·턱 손질
P3.W5 = W7
P3.GLAZE = [
    'zzyzzzzyzzzzzyzz',
    'yyyyxyyyyyxyyyyx',
    'xyyxwxyyyxwxyyxw',
    'wxxwvwxyxwvwxxwv',
    'vwxv.vwxxv.vwxv.',
    '.vwv..vxwv..vwv.',
    '..v...vxwv...v..',
    '......vxw.......',
    '.......wv.......',
    '.......v........',
    '................',
]
P3.LEDGE = [
    '.........z......',
    '.zz.....zyz...zz',
    'zyyz.zzzyxyz.zyy',
    'yxxyzyyyxxwxzyxx',
    'xwwxyxxxwwvwyxww',
    'wvvwxwwwvvvvxwvv',
    'vvvvvvvvvvvvvvvv',
]


def c_ice(n):
    return P3.c_ice_face(n)


NOTES = {
    ('prop.minecart', 'A1'): '낮은 3/4 광차(버들항 cart-h 높이): 광석 봉우리·뒤 테두리·통 안·앞 테두리·널 앞면, 앞 바퀴 둘이 아래 레일 위',
    ('prop.minecart', 'A2'): '같은 통 + 청록 마광석',
    ('wall.ice_face', 'A1'): '검푸른 바위 돌마다 칠(2화소 결 덩이만) + 깨진 면 얼음 껍질(가운데 칸 고드름 하나), 새김 = 비대칭 고드름 다발, 아랫단 = 이어지는 얼음 턱',
    ('wall.ice_face', 'A2'): '회색 바위 + 같은 얼음',
}
FNS = {'prop.minecart': {'A1': c_cart(1), 'A2': c_cart(2)}, 'wall.ice_face': {'A1': c_ice(1), 'A2': c_ice(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'prop.minecart': P1.BOARD_REFS['prop.minecart'], 'wall.ice_face': P1.BOARD_REFS['wall.ice_face']}


def line_scenes():
    return {}

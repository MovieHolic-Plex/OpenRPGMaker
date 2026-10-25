"""theme-props-r1 — 던전 주제 남은 조각(2026-10-24, 감독 dungeon-themes 재개).

빌더가 찾지만 그림이 없어 옛 키트로 물러서던 것:
  prop.minecart       광산 광차 2×2(TK minecart) — 지금은 광산 마을 광차(작은 1칸 그림)로 물러선다. FF6 나르쉐 광차처럼
                      쇠테 두른 나무 통 + 광석 더미(윗면이 보인다: 통 안·광석 꼭대기), 바퀴 넷(앞 둘이 보임). 선로 rails-ew 위에 선다.
  prop.cracked_floor  금 간 바닥 함정 2×2(TK cracked-floor) — 성·묘지·유적의 꺼지는 바닥. 판석이 가운데로 내려앉아 금이 방사로
                      갈라지고 가운데는 깊은 틈(어둠). 밟을 수 있다(함정 이벤트 자리). 석회 판석(신전 바닥) 결.
  prop.wisp           도깨비불 1×1 3장면(TK will-o-wisp, 늪) — r1 두 후보 모두 object-gate 3/4·화풍 FAIL(「장난감 풍선·질감 없음」).
                      다시 그림: 불꽃 몸(밝은 심 → 바깥 단 다섯 단계, 결 있는 혀), 밑에 바닥에 닿지 않는 빛 그림자 없음, 대신 떨어지는
                      불티. 판정 종류는 organic(빛·불 덩이) 이 아니라 **flat 이 아님** — 서 있는 기물(other, 윗면 없음) 로 받으면 다시 떨어지므로
                      등불 받침(돌 위 작은 불꽃)으로 바꿔 윗면을 준다: 늪의 이끼 낀 돌 받침 위에 떠 있는 도깨비불.
  wall.ice_face       얼음굴 벽 앞면 키트(TK ice-face-3h|2h) — 시공기는 얼음굴에 gap 바위 줄 C 앞면을 쓰지만 profiles 의 rooms 문법·
                      rockLine 'none' 일 때를 위해 피라미드와 같은 배치로: 얼어붙은 청석 마름돌 위로 얼음이 흘러내려 굳은 띠·고드름 끝.

모든 화소는 이 파일의 행 문자열에서 온다. 빛은 왼쪽 위.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_climate_lib as lib  # noqa: E402
import theme_earth_r1 as E1  # noqa: E402
import theme_walls_r3 as W3  # noqa: E402
from dot import Cv, grid, stamp  # noqa: E402
from theme_arcane_r1 import noise  # noqa: E402

WAVE = 'theme_props'
T = 16
L = W3.L
G = W3.G


def up(cv, k):
    return cv


# ================================================================================================ 광차 2×2
# 글자: a~f wood0~5 · g~l iron0~5 · m~r gold0~5(광석 금빛) · s t u = crock 3·5·6(광석 돌) · ~ 그림자
LCART = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 g:iron0 h:iron1 i:iron2 j:iron3 k:iron4 l:iron5 '
          'm:gold1 n:gold2 o:gold3 p:gold4 q:gold5 s:crock2 t:crock4 u:crock6')
LCART2 = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 g:iron0 h:iron1 i:iron2 j:iron3 k:iron4 l:iron5 '
           'm:glow0 n:glow1 o:glow2 p:glow4 q:glow5 s:vrock1 t:vrock3 u:vrock4')
# 32×32. 윗면 = 광석 더미(위 0~9행) + 통 앞 테두리(10행 밝은 쇠 l) · 통 안 그늘 · 앞면 = 나무 널 셋(세로 이음) + 쇠테 두 줄 + 모서리 쇠
# 바퀴 = 앞 둘(26~31행), 바퀴 밑 그림자 ~. 손잡이(왼쪽 위 쇠 고리).
CART = [
    '................................',
    '................................',
    '..............tu................',
    '.........ttu.tuutu..p...........',
    '.......tttuutstttupqpo..tu......',
    '......sttttptsssttpqqots.tuu....',
    '.....sttsopqosttsooppnsstttu....',
    '....kssttnoponsssstnonssssttj...',
    '...klkkkkkkkkkkkkkkkkkkkkkkkkj..',
    '...lkiiiiiiiiiiiiiiiiiiiiiiikj..',
    '...lkgggggggggggggggggggggggkj..',
    '...lllllllllllllllllllllllllkj..',
    '...kkjjjjjjjjjjjjjjjjjjjjjjjji..',
    '...keeeeeeeebeeeeeeeebeeeeeedi..',
    '...kedddddddbddddddddbdddddcdi..',
    '...kedddcdddbddddcdddbddddddci..',
    '...kjjjjjjjjjjjjjjjjjjjjjjjjji..',
    '...kiiiiiiiiiiiiiiiiiiiiiiiihi..',
    '...kedddddddbddddddddbddddddci..',
    '...kedcddddcbdddddddcbddddcdci..',
    '...kddddddddbddddddddbddddddci..',
    '...kcccccccccccccccccccccccccbh..',
    '...jhhhhhhhhhhhhhhhhhhhhhhhhhhh.',
    '....hgggggggggggggggggggggggggh.',
    '.....~~~~~~~~~~~~~~~~~~~~~~~~~..',
    '......jkkj..............jkkj....',
    '.....jllkij............jllkij...',
    '.....kljhik............kljhik...',
    '.....kkhhik............kkhhik...',
    '.....jiihij............jiihij...',
    '......jiij..............jiij....',
    '.......~~~~~~~~~~~~~~~~~~~~.....',
]
CART = [r[:32].ljust(32, '.') for r in CART]


def c_cart(n):
    def fn():
        lg = LCART if n == 1 else LCART2
        cv = G(CART, lg)
        sc = E1.scene('mine', 7, 6, face_h=2)
        rail = E1.kit_cv('bd-pick-dungeon-theme-rails-ew')
        for x in range(7):
            E1.place(sc, rail, x, 4)
        E1.place(sc, cv, 2, 3)
        E1.put_actor(sc, 5, 4)
        return cv, {'kind': 'objects', 'parts': {'광차': cv}, 'vignette': sc}
    return fn


# ================================================================================================ 금 간 바닥 함정 2×2
# 신전 석회 판석(marble) 위에 가운데로 내려앉은 판: 금 j(어둠) · 금 위 빛 턱 f · 금 밑 그늘 b · 가운데 틈 = void.
LCRK = L('a:marble2 b:marble3 c:marble4 d:marble5 e:marble6 f:marble6 g:marble6 j:cfloor0 o:void0 k:cfloor1')
# A2 = 회색 성 판석(castle 램프)
LCRK2 = L('a:castle1 b:castle2 c:castle3 d:castle4 e:castle5 f:castle6 g:castle6 j:castle0 o:void0 k:castle1')
CRACK = [
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'efffffffffffbffffffffffffffffffd',
    'efeeeeeeeeeebeeeeeeeeeeeeeeeeeed',
    'efeeeeeeeeeeebeeeeeeeeeeeeeeeeed',
    'efeeeeeeeeeeeebeeeeejbeeeeeeeeed',
    'efeeeeeeeeeeeeejeeeejbeeeeeeeeed',
    'efeedeeeeeeeeeejbeeejeeeeeeeeeed',
    'efeeeeeeeeeeeeeejeeeebeeeeeeeeed',
    'efeeeeeeeeeeeeeejbejbeeeeeedeeed',
    'ebbbbbeeeeeeedddjdjjdddeeeeeeeed',
    'eeeeebjjbeedcccbjjojbcccdeeeeeed',
    'eeeeeeeeejjccbbjoooojbbcdeeeeeed',
    'efeeeeeeeedcbjjoooooojbbcdeeeeed',
    'efeeeeeeeedcbjoooooooojbcdeebbbd',
    'efeeeeeeeedcjooooooooojjcbjjeeed',
    'efeeeeeeeedcjoooooooooojcdeeeeed',
    'efeedeeeeedcbjooooooooojcdeeeeed',
    'efeeeeeeeedccjjoooooojjbcdeeeeed',
    'efeeeeeeeeeddcbjjoooojbbcdeeeeed',
    'efeeeeeeeeeeddccbjjjjbccdeeeeeed',
    'efeeeeeeeebbjdddccccccddjeeeeeed',
    'efeeeeeeejbeeeddddddddeebjeeeeed',
    'efeeeeeejbeeeeeeejbeeeeeeebjeeed',
    'efeeeeeebeeeeeeeeejeeeeeeeeebeed',
    'efeeedejeeeeeeeeeejbeeeeeeeeeeed',
    'efeeeeebeeeeeeeeeeejeeeeeedeeeed',
    'efeeeeeeeeeeeeeeeeejbeeeeeeeeeed',
    'efeeeeeeeeeeeeeeeeeeeeeeeeeeeeed',
    'efeeeeeeeeeeeeeeeeeeeeeeeeeeeeed',
    'efeeeeeeedeeeeeeeeeeeeeedeeeeeed',
    'eddddddddddddddddddddddddddddddd',
    'dccccccccccccccccccccccccccccccc',
]


def c_crack(n):
    def fn():
        lg = LCRK if n == 1 else LCRK2
        cv = G(noise(CRACK, 'de', 13, 3), lg)
        floor = 'bd-pick-temple-ruins-floor-trav' if n == 1 else 'bd-pick-castle-catacombs-floor-castle'
        sc = E1.scene('ruins' if n == 1 else 'castle', 7, 6, face_h=2, floor_kit=floor)
        E1.place(sc, cv, 3, 3)
        E1.put_actor(sc, 1, 4)
        return cv, {'kind': 'tile', 'parts': {'금 간 바닥': cv}, 'vignette': sc}
    return fn


# ================================================================================================ 도깨비불 등잔 1×2(3장면)
# 이끼 낀 돌 받침(윗면 판석 5줄 + 앞면) 위에 떠 있는 청록 불꽃. 불꽃 = 심 W(흰빛) → q p o n m 다섯 단, 혀 끝은 짙은 단.
# 장면마다 혀 모양·높이·불티 자리가 바뀐다.
LWISP = L('a:moss0 b:moss1 c:moss2 d:moss3 e:moss4 f:moss5 r:stone1 s:stone2 t:stone3 u:stone4 v:stone5 '
          'm:glow0 n:glow1 o:glow2 p:glow4 q:glow5 W:ice4 z:stone0')
LWISP2 = L('a:moss0 b:moss1 c:moss2 d:moss3 e:moss4 f:moss5 r:stone1 s:stone2 t:stone3 u:stone4 v:stone5 '
           'm:bog1 n:bog3 o:bog5 p:bog6 q:bog7 W:snow3 z:stone0')
FLAMES = [
    ['......m.........', '.....mn.........', '.....nom........', '....mopn........', '....npqom.......', '...mopWqon......',
     '...noqWWpn......', '...noqWqpnm.....', '...mopqqonm.....', '....nooonm......', '....mnnnm.......', '.....mmm........'],
    ['.......m........', '.......nm.......', '......mon.......', '......nopm......', '.....mopqn......', '.....nqWqom.....',
     '....mopWWpn.....', '....nopqWpn.....', '....mopqqom.....', '.....nooon......', '.....mnnnm......', '......mmm.......'],
    ['........m.......', '.......mn.......', '.......non......', '......nopm......', '.....mnqpn......', '.....npWqom.....',
     '....mopWWqn.....', '....nopqWpnm....', '....mnoqqon.....', '.....nooonm.....', '.....mnnnm......', '......mmm.......'],
]
SPARKS = [[(12, 2), (2, 9)], [(3, 3), (12, 8)], [(11, 1), (3, 6)]]
# 받침: 이끼 덮인 돌(16×16, 아래 칸). 윗면 0~5행(빛 v/u, 이끼 e/f) · 앞 모서리 6행 · 앞면 7~13 · 밑 그늘 14~15
BASE = [
    '....tuuuuuut....',
    '...tuvvvuvvut...',
    '..sufeevvveeus..',
    '..sueffeuuefus..',
    '..stuueeuuuuts..',
    '..ssttttttttss..',
    '..vvvvvvvvvvvu..',
    '..utteetttuttrz.',
    '..ttedettttssrz.',
    '..ttdcdtttstsrz.',
    '..stcbcttsstsrz.',
    '..ssbabsssssrrz.',
    '..rssssssssrrrz.',
    '..zzzzzzzzzzzzz.',
    '...~~~~~~~~~~~..',
    '................',
]


def wisp_frames(n):
    lg = LWISP if n == 1 else LWISP2
    out = []
    for i, f in enumerate(FLAMES):
        cv = Cv(16, 32)
        stamp(cv, BASE, lg, 0, 16)
        big = [r for r in f for _ in (0, 1)][:20]   # 혀를 세로로 늘려 덩이를 키운다(행 두 번씩)
        big = [(''.join(ch * 2 for ch in r[2:10])) for r in big]   # 가로도 두 배(가운데 8열 → 16열)
        stamp(cv, big, lg, 0, 0 + (1 if i == 1 else 0))
        for (x, y) in SPARKS[i]:
            stamp(cv, ['p'], lg, x, y)
        out.append(cv)
    return out


def c_wisp(n):
    def fn():
        fr = wisp_frames(n)
        img = lib.hcat(*fr)
        bg = lib.bd_kit('bd-pick-swamp-stilt-ground-mud') if True else None
        anim = []
        for f in fr:
            sc = lib.tile_fill(6, 4, bg)
            sc.a[:, :, :3] = (sc.a[:, :, :3] * 0.6).astype('uint8')
            sc.paste(f, 2 * T, 1 * T)
            lib.put_actor(sc, 4, 3)
            anim.append(sc)
        return img, {'kind': 'objects', 'parts': {f'장면{i + 1}': f for i, f in enumerate(fr)}, 'anim': anim, 'vignette': anim[0]}
    return fn


# ================================================================================================ 얼음굴 벽 앞면(피라미드·마계와 같은 배치)
# 얼어붙은 청석 켜(vrock) 위로 얼음(ice) 띠가 흘러내려 굳었다: 윗단 = 두꺼운 얼음 껍질(밝은 윗끝 + 흘러내린 혀), 가운데·아랫단 = 돌 + 얼음 결.
LIF = L('j:vrock0 a:vrock1 b:vrock2 c:vrock3 d:vrock4 e:ice0 f:ice1 g:ice2 h:ice3 i:ice4')
LIF2 = L('j:void1 a:crock1 b:crock2 c:crock3 d:crock4 e:ice0 f:ice1 g:ice2 h:ice3 i:ice4')
ICE_TONE = 'jabcd'
# 얼음 혀: 열마다 윗단에서 얼음이 내려온 깊이(16 주기, 손으로 적음)
ICE_DRIP = [7, 9, 8, 11, 6, 5, 8, 13, 10, 7, 6, 9, 12, 8, 6, 7]


def ice_mid(n=1):
    rows = [list(r) for r in W3.tower_mid(n)]
    rows = [[{'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'd', 'j': 'j'}.get(ch, ch) for ch in r] for r in rows]
    for x in range(16):
        d = ICE_DRIP[x]
        for y in range(d):
            if y == 0:
                ch = 'i'
            elif y == 1:
                ch = 'h'
            elif y == d - 1:
                ch = 'e'
            elif y == d - 2:
                ch = 'f'
            else:
                ch = 'g' if (x + y) % 5 else 'h'
            rows[y][x] = ch
    # 아랫단 몇 곳에 얼음 결(돌 틈에 낀 얼음)
    for (x, y) in [(3, 27), (4, 27), (11, 35), (12, 35), (7, 42), (8, 42), (14, 20), (1, 38)]:
        rows[y][x] = 'f'
    return [''.join(r) for r in rows]


def ice_ends():
    el, er = W3.tower_ends()
    el = [('ih' if y == 0 else 'hg' if y < 6 else e) for y, e in enumerate(el)]
    er = [('ge' if y == 0 else 'fe' if y < 6 else e) for y, e in enumerate(er)]
    return el, er


ICICLE = [   # 새김 가운데(3단): 큰 고드름 다발이 가운데단까지 늘어진다
    'iihhhhiiihhhhiii',
    'hhggghhhhgghhhhh',
    'gggfggggggfgggfg',
    '.gfeggf.gffegff.',
    '.gfe.gf..gfe.gf.',
    '.gf..gf..gf..gf.',
    '.fe..gf..gf..fe.',
    '.e...gf..gf...e.',
    '.....gf..ff.....',
    '.....fe..fe.....',
    '.....fe...e.....',
    '......e.........',
]


def ice_kit(n=1):
    lg = LIF if n == 1 else LIF2
    mid = ice_mid(n)
    el, er = ice_ends()
    k = W3.Kit()
    k.face3 = W3.kit_of(W3.cols3(mid, el, er), lg)
    k.face2 = W3.kit_of(W3.cols3([mid[i] for i in W3.TWO], [el[i] for i in W3.TWO], [er[i] for i in W3.TWO]), lg)
    m = G(mid, lg)
    g3 = Cv(16, 48)
    g3.a[:] = m.a
    stamp(g3, ICICLE, lg, 0, 0)
    k.glyph3 = g3
    g2 = Cv(16, 32)
    g2.a[:] = G([mid[i] for i in W3.TWO], lg).a
    stamp(g2, ICICLE[:9], lg, 0, 0)
    k.glyph2 = g2
    bot = W3.cols3(mid[32:48], el[32:48], er[32:48])
    cells = [G(r, lg) for r in bot]
    for c in cells:
        stamp(c, ['................', '.f......f.....f.', 'fgf....fgf...fgf', 'ghgffffghgfffghg', 'hhhhhhhhhhhhhhhh', 'gggggggggggggggg', 'ffffffffffffffff'], lg, 0, 8)
    k.base3 = lib.hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, ['................', '.....j..........', '....jgj.........', '...jghfj........', '...jgfej........', '....jej.........'], lg, 4, 4)
    k.alt3 = alt
    return k


def ice_room(n, plan=W3.ROOM):
    k = ice_kit(n)
    rim = lib.bd_kit  # 장면 천장 = 기존 얼음굴 천장 그룹이 없으면 마법탑 테두리 대용(장면 전용)
    rim = W3.tower_rim(1)
    floor = lib.bd_part('snowfield/ground-snow') if os.path.exists(os.path.join(lib.VAR, 'snowfield', 'parts', 'ground-snow.png')) else None
    fl = (lambda x, y: floor.crop((x % (floor.w // T)) * T, (y % (floor.h // T)) * T, T, T)) if floor else W3.floor_fn('tower')
    out = lib.rooms_render(plan, rim, k.face3, k.face2, fl)
    return out


def c_ice_face(n):
    def fn():
        k = ice_kit(n)
        img = k.image()
        v = ice_room(n)
        v.paste(k.glyph3, 4 * T, 1 * T)
        lib.put_actor(v, 3, 6)
        return img, {'kind': 'tile', 'parts': k.parts(), 'vignette': v,
                     'extras': [('test map', ice_room(n, W3.TEST), 2)]}
    return fn


FNS = {
    'prop.minecart': {'A1': c_cart(1), 'A2': c_cart(2)},
    'prop.cracked_floor': {'A1': c_crack(1), 'A2': c_crack(2)},
    'prop.wisp': {'A1': c_wisp(1), 'A2': c_wisp(2)},
    'wall.ice_face': {'A1': c_ice_face(1), 'A2': c_ice_face(2)},
}
NOTES = {
    ('prop.minecart', 'A1'): '쇠테 두른 나무 통 + 금빛 광석 더미(윗면: 통 테두리·광석 꼭대기), 앞 바퀴 둘',
    ('prop.minecart', 'A2'): '같은 통 + 청록 마광석(마도 광산)',
    ('prop.cracked_floor', 'A1'): '신전 석회 판석이 가운데로 내려앉은 2×2, 방사 금 + 깊은 틈',
    ('prop.cracked_floor', 'A2'): '회색 성 판석 같은 짜임',
    ('prop.wisp', 'A1'): '이끼 낀 돌 받침 위 청록 도깨비불 3장면(불꽃 다섯 단 + 흰 심, 불티)',
    ('prop.wisp', 'A2'): '같은 받침 + 늪빛 연두 불꽃',
    ('wall.ice_face', 'A1'): '청석 마름돌 위로 흘러내려 굳은 얼음 껍질(윗단), 돌 틈 얼음 결, 새김 = 고드름 다발, 아랫단 = 얼음 턱',
    ('wall.ice_face', 'A2'): '회색 바위 마름돌 + 같은 얼음',
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = '줄 공통 — ' + note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {
    'prop.minecart': ['bd-pick-mining-valley-cart-h', 'bd-pick-dungeon-theme-rails-ew'],
    'prop.cracked_floor': ['bd-pick-temple-ruins-floor-trav', 'bd-pick-castle-catacombs-floor-castle'],
    'prop.wisp': ['bd-pick-swamp-stilt-lantern'],
    'wall.ice_face': ['bd-dg-rock-C-face', 'bd-pick-castle-catacombs-face-castle-3h'],
}


def line_scenes():
    return {}

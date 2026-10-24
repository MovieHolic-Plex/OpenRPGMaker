"""theme-props-r2 — 광차·금 간 바닥 다시 그림(2026-10-24). r1 독립 VQA(sonnet+argon) 반영:
  광차  「윗면이 앞에서 본 납작한 판 · 통 안이 안 보임 · 바퀴가 선로 두 줄을 밟지 않음」
        → 3/4: 뒤 테두리(4~5행) · 통 안 광석 더미(6~10행, 뒤 테두리 위로 봉우리가 솟음) · 앞 테두리 밝은 쇠(11~12행) ·
          앞면 널(13~22행, 다섯 줄마다 1화소씩 좁아지는 사다리꼴 = 위가 넓은 통) · 쇠테 두 줄 + 모서리 쇠 + 못 ·
          앞 바퀴 둘이 선로 두 레일(5행·11행) 위에 걸치게 놓는다(장면).
  금 간 바닥 「흐린 번짐 · 북쪽 안쪽에 판석 두께 없음 · A2 베벨 판」
        → 성 판석 2×2(바닥 키트와 같은 줄눈 자리) 가운데가 깨져 꺼짐: 구멍 북쪽 안벽 = 판석 옆면 빛(c) · 그늘(b) · 짙은 끝(j) ·
          깊은 어둠, 남쪽 테두리 = 밝은 턱(k), 방사 금 1화소 어둠 + 오른쪽 빛, 떨어진 돌 조각. 번짐 없음.
          A1 = 성 판석, A2 = 신전 석회 판석(marble).
도깨비불 A1·얼음 벽은 이 판에 없다(도깨비불 A1 은 r1 두 검수 PASS, 얼음 벽은 r3 따로).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_earth_r1 as E1  # noqa: E402
import theme_props_r1 as P1  # noqa: E402

WAVE = 'theme_props'
L = P1.L
G = P1.G

CART = [
    '................................',
    '................................',
    '.............tu....p............',
    '..........ttu.ttuu..pq..........',
    '...lkkkksttuutsttukpqpoktukij...',
    '...lkiiiiiiiiiiiiiiiiiiiiiiij...',
    '...lksttsoptsstuttsooppsttsij...',
    '...lktsnopossttsnopqosstsstij...',
    '...lkssttsonssttssnossttsssij...',
    '...lkgssstssggsstssgssstssgij...',
    '...lkgggsgggggsgggggsggggsgij...',
    '...lllllllllllllllllllllllllk...',
    '...kkkkkkkkkkkkkkkkkkkkkkkkki...',
    '...jkbbbbbbbbbbbbbbbbbbbbbbhg...',
    '...jkddedddbdeddddddbdccdcchg...',
    '...kliiiiiiliiiiiiiijihhhhhjg...',
    '...jkhhhhhhhhhhhhhhhhhggggghg...',
    '...jkdeddddbdddeddddbdccccchg...',
    '....jkdddddbddddddddbccdcchg....',
    '....jkddeddbddddddddbccccchg....',
    '....lkiiiiiliiiiiiiijhhhhhjg....',
    '....jkhhhhhhhhhhhhhhhggggghg....',
    '....jkjkkjdbddddedddbjkkjchg....',
    '.....jllkijgggggggggjllkij......',
    '.....klhhikg........klhhik......',
    '.....kkhgikhhhhhhhhhkkhgik......',
    '.....jiihij.........jiihij......',
    '......jiij...........jiij.......',
    '......~~~~~~~~~~~~~~~~~~~~......',
    '........~~~~~~~~~~~~~~~~........',
    '................................',
    '................................',
]

CRACK = [
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggggggggghhhhhdgggggggggg',
    'hhhhhdgggjkggggghhhhhdggggggjkgg',
    'hhhhhdggggjkgggghhhhhdgggggjkggg',
    'hhhhhdgggggjkggghhhhhdggggjkgggg',
    'hhhhhdgggggjkggghhhhhdggjkgggggg',
    'dddddddddddddddddddddddddddddddd',
    'ggggggdggggggjdddddggjdggggggggg',
    'ggggggdgggggddcccccddgdggggggggg',
    'ggggggdgggddccbbbbbccddggggggggg',
    'ggjjkgdggdccbbjjjjjbbcdggggggggg',
    'ggggjkdgjcbbjjpqppqjjbcdgbcggggg',
    'ggggggdjdbjjppqppqppqjbckggggggg',
    'ggggggdjcjqppqoooooqppjbdggggggg',
    'dddddddjbqppoooooooooqpjcjdddddd',
    'hhhhhdgjjpoooooooooooopqkggjjkgg',
    'hhhhhdcgkjooooooooooooopkggggjjk',
    'hhhhhdggjjoooooooooooookgggggggg',
    'hhhhhdgggkjoooooooooookggggggggg',
    'hhhhhdgggjkjoooooooookgggggggggg',
    'hhhhhdggjkgkkjoooookkdgggggggggg',
    'hhhhhdgjkggggkkkkkjkhdgggggggggg',
    'dddddddddddddddddddddddddddddddd',
    'gggggjdgggcbgggggggjkgdggggggggg',
    'ggggjkdggggggggggggjkgdggggggggg',
    'gggjkgdgggggggggggggjkdggggggggg',
    'ggjkggdgggggggggggggjkdggggggggg',
    'ggggggdggggggggggggggjdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'dddddddddddddddddddddddddddddddd',
]
# A1 성 판석(바닥 키트 floor-castle 과 같은 단: g crock6 · h cata4 · k cata6) · 줄눈·금 d castle3 · 판석 옆면 c b j · 구멍 o p q
LCRK = L('g:crock6 h:cata4 k:cata6 d:castle3 c:castle4 b:castle2 j:castle0 o:void0 p:void1 q:void2')
# A2 신전 석회 판석(floor-trav: marble6 · marble5)
LCRK2 = L('g:marble6 h:marble5 k:snow0 d:marble3 c:marble4 b:marble2 j:marble0 o:void0 p:void1 q:void2')


def c_cart(n):
    def fn():
        cv = G(CART, P1.LCART if n == 1 else P1.LCART2)
        sc = E1.scene('mine', 7, 6, face_h=2)
        rail = E1.kit_cv('bd-pick-dungeon-theme-rails-ew')
        for x in range(7):
            E1.place(sc, rail, x, 4)
        # 바퀴 밑(28행) = 선로 아래 레일(11행) → 광차 윗끝 = 레일 칸 위로 한 칸 반
        E1.place(sc, cv, 2, 3, dy=-1)
        E1.put_actor(sc, 5, 4)
        return cv, {'kind': 'objects', 'parts': {'광차': cv}, 'vignette': sc}
    return fn


def c_crack(n):
    def fn():
        cv = G(CRACK, LCRK if n == 1 else LCRK2)
        floor = 'bd-pick-castle-catacombs-floor-castle' if n == 1 else 'bd-pick-temple-ruins-floor-trav'
        sc = E1.scene('castle' if n == 1 else 'ruins', 7, 6, face_h=2, floor_kit=floor)
        E1.place(sc, cv, 3, 3)
        E1.put_actor(sc, 1, 4)
        return cv, {'kind': 'tile', 'parts': {'금 간 바닥': cv}, 'vignette': sc}
    return fn


NOTES = {
    ('prop.minecart', 'A1'): '3/4 광차: 뒤 테두리·통 안 금빛 광석 더미·앞 테두리·위가 넓은 널 통·쇠테 둘, 앞 바퀴가 두 레일에 걸침',
    ('prop.minecart', 'A2'): '같은 통 + 청록 마광석',
    ('prop.cracked_floor', 'A1'): '성 판석 2×2 가운데가 꺼진 구멍(북쪽 안벽 판석 두께 세 단·남쪽 밝은 턱), 방사 금',
    ('prop.cracked_floor', 'A2'): '신전 석회 판석 같은 짜임',
}
FNS = {'prop.minecart': {'A1': c_cart(1), 'A2': c_cart(2)}, 'prop.cracked_floor': {'A1': c_crack(1), 'A2': c_crack(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {k: P1.BOARD_REFS[k] for k in FNS}


def line_scenes():
    return {}

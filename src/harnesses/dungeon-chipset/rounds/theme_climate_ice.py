"""theme-climate ice — 설산·얼음굴 부족분(2026-10-23): 고드름 · 얼음 수정 · 얼음 속 전사 · 눈 더미.

바닥·벽은 다른 작업자 gap-ice-r1 것(읽기 전용) — 장면은 그 그림의 사본 바탕(lib.backdrop 'ice-cave-backdrop-a/b', 18×12칸)
위에 실제 칸 자리로 얹는다. 바탕 칸 지도(a·b 같음): 0행 천장 · 1~2행 벽 앞면(1행 = 테두리 바로 밑 윗단) · 3행부터 바닥,
가운데 오른쪽 바위(11~14열) 앞면 = 5~6행. 색은 그 그림과 같은 ice·snow·iron·vrock 램프.

모든 화소는 아래 행 문자열에서 온다(손 도트). 고드름 묶음·수정 무리는 손으로 그린 낱개 조각을 손으로 고른 자리에 찍어 조립한다.
빛은 왼쪽 위 — 왼쪽 면 밝게, 오른쪽 면 어둡게, 먹 윤곽 없음. 바닥 위 물건은 '~' 접지 그림자.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
from theme_climate_lib import Cv, T, g, hcat, leg, ramp_chars, stamp  # noqa: E402

# 공용 글자: 눈 S s w W(어둠→밝음) · 얼음 a b c d e · 쇠 i j k l m n(iron 0~5) · 바위 p q r t(vrock 1~4)
LG = leg(ramp_chars('snow', 'SswW'), ramp_chars('ice', 'abcde'), ramp_chars('iron', 'ijklmn'),
         ramp_chars('vrock', 'opqrt'), ramp_chars('stone', 'uvxyz'), ramp_chars('water', 'ABCDE'))


def cv_of(w, h, pieces):
    """[(행, x, y)] 를 순서대로 찍는다(뒤에 찍은 것이 위)."""
    cv = Cv(w, h)
    for rows, x, y in pieces:
        stamp(cv, rows, LG, x, y)
    return cv


# ================================================================================================ 고드름 A1 「서리 고드름 다발」
# 서리 덩이(눈, 위 밝음·아래 그늘) 밑으로 가늘고 긴 고드름 여럿 — 길이 제각각, 왼쪽 면 흰 빛, 오른쪽 ice 0~1 그늘, 끝 반짝.
IC1_LONG = [          # 4×14 — 무리의 주인공
    'eWdb',
    'eddb',
    'edcb',
    '.ecb',
    '.eca',
    '.dcb',
    '.dca',
    '.ec.',
    '.db.',
    '.db.',
    '.cb.',
    '..b.',
    '..b.',
    '..d.',
]
IC1_LONG2 = [         # 4×12 — 2칸 묶음의 둘째 주인공(굽이 다름)
    'Wedb',
    'edcb',
    'edca',
    'ecba',
    '.eca',
    '.ecb',
    '.dca',
    '.db.',
    '.cb.',
    '.ca.',
    '.b..',
    '.d..',
]
IC1_MED = [           # 3×9
    'Wdb',
    'edb',
    'ecb',
    'eca',
    'dcb',
    '.cb',
    '.b.',
    '.b.',
    '.d.',
]
IC1_SHORT = [         # 3×6
    'edb',
    'ecb',
    'eca',
    '.cb',
    '.b.',
    '.d.',
]
IC1_TINY = [          # 2×4
    'db',
    'cb',
    'b.',
    'd.',
]
IC1_LUMP16 = [        # 서리 덩이 — 테두리 흰 띠 바로 밑에 붙는다
    '.wWWWwWWWWWwWWws',
    'swWWwSwWWwwswWwS',
    '.SsS.sSs..sS.sS.',
]
IC1_LUMP32 = [
    '.wWWWwWWWWWwWWwswWWwwWWWWwsWWWw.',
    'swWWwSwWWwwswWwSswWsSwWWwsSwWwsS',
    '.SsS.sSs..sS.sS..Ss.sSsS..s.SsS.',
]


def icicles_a1():
    one = cv_of(16, 16, [(IC1_LUMP16, 0, 0), (IC1_MED, 1, 2), (IC1_TINY, 5, 2), (IC1_LONG, 7, 1), (IC1_SHORT, 12, 2)])
    two = cv_of(32, 16, [(IC1_LUMP32, 0, 0), (IC1_SHORT, 1, 2), (IC1_LONG2, 4, 1), (IC1_TINY, 9, 2), (IC1_MED, 11, 2),
                         (IC1_LONG, 15, 1), (IC1_TINY, 20, 2), (IC1_SHORT, 22, 2), (IC1_MED, 26, 2), (IC1_TINY, 29, 2)])
    return one, two


# ================================================================================================ 고드름 A2 「유리 고드름」
# 맑은 푸른 얼음이 덮인 처마(얼음 덩이) 밑에 굵은 원뿔 고드름 몇 개 — 몸 ice 1~2, 왼쪽 흰 줄 빛, 오른쪽 ice 0, 끝에 물방울.
IC2_FAT = [           # 6×15
    'Wedcba',
    'edcbba',
    'edcbba',
    '.ecba.',
    '.ecba.',
    '.edba.',
    '.ecba.',
    '.eca..',
    '.ecb..',
    '.dca..',
    '..ea..',
    '..db..',
    '..ca..',
    '..b...',
    '..e...',
]
IC2_FAT2 = [          # 5×12
    'Wedba',
    'edcba',
    'ecbba',
    '.ecba',
    '.eca.',
    '.ecb.',
    '.dca.',
    '.cb..',
    '.cb..',
    '.b...',
    '.a...',
    '.e...',
]
IC2_MID = [           # 4×9
    'Wdca',
    'edba',
    'ecba',
    '.eba',
    '.eca',
    '.db.',
    '.ca.',
    '.b..',
    '.e..',
]
IC2_SMALL = [         # 3×5
    'edb',
    'eca',
    '.cb',
    '.b.',
    '.e.',
]
IC2_DROP = ['e', '.', 'd']
IC2_LIP16 = [         # 얼음 처마 — 흰 반짝 윗줄, 얼음 몸, 아래 그늘
    'eWeedWeeeWedeWee',
    'dcdccdcdccdccdcd',
    'b.ab.a.bab.ab..a',
]
IC2_LIP32 = [
    'eWeedWeeeWedeWeeWeedeWeeWdeeeWed',
    'dcdccdcdccdccdcdcdcdccdcdcdccdcc',
    'b.ab.a.bab.ab..abab.a.ba..ba.ab.',
]


def icicles_a2():
    one = cv_of(16, 16, [(IC2_LIP16, 0, 0), (IC2_FAT, 1, 1), (IC2_SMALL, 8, 1), (IC2_MID, 11, 1), (IC2_DROP, 9, 13)])
    two = cv_of(32, 16, [(IC2_LIP32, 0, 0), (IC2_MID, 1, 1), (IC2_FAT, 6, 1), (IC2_SMALL, 13, 1), (IC2_FAT2, 17, 1),
                         (IC2_SMALL, 23, 1), (IC2_MID, 27, 1), (IC2_DROP, 14, 12), (IC2_DROP, 28, 13)])
    return one, two


# ================================================================================================ 얼음 수정 A1 「눈 둔덕 수정 무리」
XT1_BIG = [           # 5×20 — 가운데 큰 기둥: 왼 면 흰빛, 가운데 능선, 오른 면 그늘
    '..W..',
    '.eWd.',
    '.eWdb',
    'eeWcb',
    'edWcb',
    'edecb',
    'edecb',
    'eddca',
    'edecb',
    'edeca',
    'eWdcb',
    'eddca',
    'edecb',
    'eddca',
    'cddba',
    'cdcba',
    'cccba',
    'ccbba',
    'bcbaa',
    'bbbaa',
]
XT1_RIGHT = [         # 4×13 — 오른쪽으로 기운 기둥
    '...W',
    '..ed',
    '.eWb',
    '.edb',
    'eeca',
    'edcb',
    'edca',
    'edcb',
    'dWca',
    'ddca',
    'dcba',
    'ccba',
    'cbba',
]
XT1_LEFT = [          # 3×9 — 왼쪽으로 기운 작은 기둥
    'W..',
    'ed.',
    'edb',
    'eWb',
    'dcb',
    'dca',
    'dcb',
    'cba',
    'bba',
]
XT1_BASE = [          # 16×9 — 눈 둔덕(윗면 밝음, 남쪽 푸른 회색 그늘) + 접지 그림자
    '.......ww.......',
    '...wWw.wWWw.ww..',
    '..wWWWWWWWwWWWw.',
    '.wWWwWWWWWWwWwws',
    '.sWwwWwwWWwwwwsS',
    'Sswwsswssswssss~',
    'SSssSSsSSssSSSS~',
    '~SSSSSSSSSSSSS~~',
    '..~~~~~~~~~~~~~.',
]


def crystal_a1():
    return cv_of(16, 32, [(XT1_LEFT, 2, 15), (XT1_RIGHT, 10, 11), (XT1_BIG, 5, 4), (XT1_BASE, 0, 23)])


# ================================================================================================ 얼음 수정 A2 「바위 위 큰 결정」
# 서리 앉은 바위(쇠 회청색)에서 솟은 큰 결정 하나 + 곁가지 둘. 빛 면은 눈 흰빛(W·w), 그늘 면은 짙은 얼음(c·b·a).
XT2_SHARD = [         # 6×22
    '..W...',
    '..We..',
    '.wWe..',
    '.wWca.',
    '.wWca.',
    'wWwcbb',
    'wWwcba',
    'wWscbb',
    'wwWcbB',
    'wWscba',
    'wwscbB',
    'wWscba',
    'swscbB',
    'swWcaB',
    'swscba',
    'ssscbB',
    'swscaB',
    'sSscbB',
    'SsscaB',
    'SsscaB',
    'SSscaB',
    'SSscaB',
]
XT2_SIDE_L = [        # 4×7
    'W...',
    'wd..',
    'wWd.',
    'swdb',
    '.wdb',
    '.sdc',
    '.sca',
]
XT2_SIDE_R = [        # 3×7
    '..e',
    '.Wd',
    'wdb',
    'wdb',
    'sca',
    'sdb',
    'sca',
]
XT2_ROCK = [          # 16×10 — 서리 앉은 바위 받침
    '...wWw..wWWw....',
    '..wWnWWwWWnWw...',
    '.wnmnnWmmnnmlw..',
    '.nmmllmmmllllk..',
    'wmllkkmllkkkkjk.',
    'mlkkjjlkkjjjjij~',
    'lkjjiikjjiiiiij~',
    'kjjiiijjiiiiii~~',
    '~~iiii~~iiii~~~.',
    '..~~~~~~~~~~~...',
]


def crystal_a2():
    return cv_of(16, 32, [(XT2_SIDE_L, 1, 15), (XT2_SIDE_R, 12, 14), (XT2_SHARD, 5, 2), (XT2_ROCK, 0, 22)])


# ================================================================================================ 얼음 속 전사 A1 「네모 얼음 덩이」
# 14×25 얼음 덩이: 윗면 5줄(밝음) + 앞면 20줄. 안에 투구·어깨·방패(왼)·세운 칼(오른) — 쇠빛이 얼음 색과 섞여 흐릿.
# 비스듬한 빛줄기(e·d)가 사람 위를 가로질러 「얼음 속」으로 읽힌다.
FZ1 = [
    '.deeeWeeeeWed.',
    'deeWeeedeeeedc',
    'dedeeeeddeeedc',
    'ddeeddeeeedddc',
    'eeeeeeeeeeeedb',
    'dcccccccccccba',
    'decccccccccmba',
    'dcecccbllbcmba',
    'dccdcblmlkbmba',
    'dcccdlkbklclaB',
    'dccccbkkkbcmaB',
    'dcbbllkkkllmaB',
    'dblmllkkkklkaB',
    'dlmmlbklkkkkaB',
    'dlmkldkkkkbcaB',
    'dlmklkdkkbccaB',
    'dlkklkkbkbccaB',
    'dblklkkkbbccaB',
    'dcblbkbbkdccaB',
    'dccbbkbbkbdcaB',
    'dcccbkbbkbccaB',
    'dcccbjbcbjccaB',
    'dcccbkbcbkbaBA',
    'cccbbbbbbbbaBA',
    'bbbbbbbbbbbaBA',
]
FZ1_SHADOW = ['.~~~~~~~~~~~~~~', '..~~~~~~~~~~~~.']


def frozen_a1():
    return cv_of(16, 32, [(FZ1, 1, 5), (FZ1_SHADOW, 1, 30)])


# ================================================================================================ 얼음 속 전사 A2 「눈 덮인 빙하 덩이」
# 들쭉날쭉한 빙하 덩이(윗면에 눈 모자) 안에 무릎 꿇고 칼을 비스듬히 든 전사, 더 짙은 푸른 얼음(ice 1 + water 3) 속 짙은 쇠빛 실루엣.
FZ2 = [
    '...wWWw..wW.....',
    '..wWWWWwwWWWw...',
    '.wWWwWWWWWwWWw..',
    '.swWWWwwWWWwwsd.',
    '.dSsswssswssSdc.',
    '.eddeddddeddddb.',
    '.ecDDcccDccccba.',
    '.eDcccccccjDcba.',
    'dcDcccccccjcDba.',
    'dcccbllbcjccDaB.',
    'dccblmlkjbcccaB.',
    'dcDblkbkjcDccaB.',
    'dccbbkkjbcccDaB.',
    'dcbllkklkkbccaB.',
    'dblmlkkkjlDcbaB.',
    'dlmklkklkbccDaB.',
    'dlkklkkkbcccDaB.',
    'dcbklkkkbccDcaB.',
    'dccbkkllkkbccaB.',
    'dccblkbblkbDcaB.',
    'dccbjjbbjjbcDaB.',
    'cDcccDccccDccaB.',
    'cccccccccccccaB.',
    'bcbbcbbbcbbbaBA.',
    'bbbbbbbbbbbaBA~.',
    '~~~~~~~~~~~~~~~.',
    '.~~~~~~~~~~~~~..',
]


def frozen_a2():
    return cv_of(16, 32, [(FZ2, 0, 5)])


# ================================================================================================ 눈 더미 A1 「둔덕 두 혹」
DR1_V1 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...wWw..........',
    '.wWWWWWw........',
    'wWWWWWWWWww.....',
    'sWWsWWWWWWWWww..',
    'SwWWWWsWWWWWWWw.',
    'SswwWWwwwsWWWwws',
    'nSSswwsssswwsssS',
    '.nSSssSSSSsSSSSn',
    '..nnSS~~SnSSn~~.',
    '.s...~~~~~~~~...',
]
DR1_V2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........wWw...',
    '.......wwWWWWw..',
    '....wwWWWWWWWWw.',
    '..wWWWWsWWWWWWWs',
    '.wWWWWWWWsWWWwws',
    'swwwWWwwwsSswsSS',
    'nSsswwsssSSSsSSn',
    '.nnSSSSnSSSSSn~~',
    '...~~~~~~~~~~~..',
]


def drift_a1():
    return g(DR1_V1, LG), g(DR1_V2, LG)


# ================================================================================================ 눈 더미 A2 「바람 물결 더미 + 언 땅」
# 바람에 쓸린 낮은 더미 — 윗면에 물결 줄(s), 남쪽 끝에 드러난 얼음 껍질(d·c)과 박힌 자갈(쇠빛).
DR2_V1 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........wWw...',
    '.......wWWWWWWw.',
    '....wWWsWWWWsWWs',
    '..wWWWWWsWWWwwsS',
    '.sWWsswwwssssSSn',
    '.SSSSSSSSSnnnn~.',
    '..wWWw.~~~~~~~..',
    'wWWsWWWw........',
    'SsswwssSn.......',
    '.SSSnn~~~.......',
]
DR2_V2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...wWWw.........',
    '.wWWWsWWWw......',
    'wWsWWWWsWWWWw...',
    'sWWWsWWWWWsWWWw.',
    'SswwwsssWWwwswws',
    'nSSSssSSsssSdcSS',
    '.nnSSSSnmlSSedcn',
    '...~~~~~~~~~~~~.',
    '................',
]


def drift_a2():
    return g(DR2_V1, LG), g(DR2_V2, LG)


# ================================================================================================ 장면
BG = {'A1': 'ice-cave-backdrop-a', 'A2': 'ice-cave-backdrop-b'}


def scene(cand, placements, actor_cell, x0=3, y0=0, w=10, h=7):
    """바탕 18×12 에서 (x0, y0) 부터 w×h 칸을 잘라 placements [(Cv, 칸x, 칸y, dx, dy)](바탕 칸 좌표) 를 얹고 사람을 세운다."""
    bg = lib.backdrop(BG[cand])
    cv = Cv(bg.w, bg.h)
    cv.a[:] = bg.a
    for p, cx, cy, dx, dy in placements:
        cv.paste(p, cx * T + dx, cy * T + dy)
    if actor_cell:   # 바탕 사본에 이미 Actor1 한 명(9열 4행 근처)이 서 있다 — 겹치지 않을 때만 더 세운다
        lib.put_actor(cv, *actor_cell)
    return cv.crop(x0 * T, y0 * T, w * T, h * T)


def mk_icicles(fn, cand):
    def run():
        one, two = fn()
        img = hcat(one, two)
        # 벽 앞면 윗단 = 1행(위 벽, 4~10열) · 5행(가운데 오른쪽 바위 앞면, 11~12열)
        v = scene(cand, [(one, 4, 1, 0, 0), (two, 6, 1, 0, 0), (two, 9, 1, 0, 0), (one, 11, 5, 0, 0)], None)
        return img, {'kind': 'objects', 'parts': {'1칸': one, '2칸': two}, 'vignette': v}
    return run


def mk_obj(fn, cand):
    def run():
        c = fn()
        # 회색 바닥 3~4행 · 얼음판 위 4~5행(바탕 a 의 얼음판 3~8열)
        v = scene(cand, [(c, 10, 2, 0, 0), (c, 5, 4, 0, 0)], None)
        return c, {'kind': 'object', 'parts': {'기본': c}, 'vignette': v}
    return run


def mk_drift(fn, cand):
    def run():
        a, b = fn()
        img = hcat(a, b)
        v = scene(cand, [(a, 9, 3, 0, 0), (b, 10, 3, 0, 0), (b, 3, 3, 0, 0), (a, 10, 5, 0, 0), (a, 4, 6, 0, 0),
                         (b, 9, 6, 0, 0)], None)
        return img, {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': v}
    return run


FNS = {
    'tc.ice_icicles': {'A1': mk_icicles(icicles_a1, 'A1'), 'A2': mk_icicles(icicles_a2, 'A2')},
    'tc.ice_crystal': {'A1': mk_obj(crystal_a1, 'A1'), 'A2': mk_obj(crystal_a2, 'A2')},
    'tc.ice_frozen': {'A1': mk_obj(frozen_a1, 'A1'), 'A2': mk_obj(frozen_a2, 'A2')},
    'tc.ice_drift': {'A1': mk_drift(drift_a1, 'A1'), 'A2': mk_drift(drift_a2, 'A2')},
}
NOTES_BY_ITEM = {
    'tc.ice_icicles': {'A1': '서리 고드름 다발 — 눈 덩이 밑 가늘고 긴 고드름 여럿(길이 제각각, 끝 반짝)',
                       'A2': '유리 고드름 — 맑은 얼음 처마 밑 굵은 원뿔 고드름 몇 개 + 물방울'},
    'tc.ice_crystal': {'A1': '눈 둔덕에서 솟은 얼음 결정 셋(가운데 큰 기둥, 좌우로 기운 작은 기둥)',
                       'A2': '서리 앉은 바위 위 큰 결정 하나 + 곁가지 둘(빛 면 눈 흰빛)'},
    'tc.ice_frozen': {'A1': '네모 얼음 덩이 속 투구·방패·세운 칼 전사, 빛줄기가 가로지름',
                      'A2': '눈 모자 쓴 들쭉날쭉 빙하 덩이 속 칼 든 전사(짙은 푸른 얼음)'},
    'tc.ice_drift': {'A1': '두 혹 눈 둔덕 / 길쭉한 둔덕 — 남쪽 푸른 회색 그늘',
                     'A2': '바람 물결 줄 더미 + 드러난 얼음 껍질·자갈'},
}

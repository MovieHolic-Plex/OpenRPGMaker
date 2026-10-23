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


# ================================================================================================ 고드름 — 판 3 공통 결
# 고드름 하나 = 왼 가장자리 1px 어두운 얼음(c, 투명과 닿는 곳) · 빛 받는 면(e) · 흰 반짝 줄(W) · 몸(d) · 그늘 면(b) ·
# 오른쪽·끝 푸른 재질 윤곽(a·B = ice 0 · water 1, 먹 아님). 끝은 옅은 얼음(d) 한 칸 뒤 b 로 맺힌다. 떠 있는 물방울 없음.
# 위 처마는 2~3줄 한 덩이(빛 받는 윗입술 · 몸 · 그늘 진 아랫면) — 세로 줄무늬 없이 긴 토막으로.
# 1칸과 2칸 그림은 서로 다른 배열(같은 무리를 옮겨 붙이지 않는다).

# ---------------------------------------------------------------- 고드름 A1 「눈 처마 고드름」 — 눈 처마 + 가는 고드름, 성기게
IC1_T13 = [           # 4×13
    'cWbB',
    'cWbB',
    'cdbB',
    'cWbB',
    '.cWB',
    '.cdB',
    '.cWB',
    '.cdB',
    '..cB',
    '..WB',
    '..cB',
    '..dB',
    '..a.',
]
IC1_T11 = [           # 4×11 — 굽이 다른 둘째
    'cWbB',
    'cWbB',
    'cdbB',
    '.cWB',
    '.cWB',
    '.cdB',
    '..WB',
    '..cB',
    '..cB',
    '..dB',
    '..a.',
]
IC1_T9 = [            # 4×9
    'cWbB',
    'cdbB',
    'cWbB',
    '.cWB',
    '.cdB',
    '..WB',
    '..cB',
    '..dB',
    '..a.',
]
IC1_T6 = [            # 3×6
    'cWB',
    'cdB',
    'cWB',
    '.cB',
    '.dB',
    '.a.',
]
IC1_T4 = [            # 3×4
    'cWB',
    'cdB',
    '.dB',
    '.a.',
]
IC1_LEDGE16 = [       # 눈 처마: 빛 윗입술 W · 몸 w · 푸른 그늘 아랫면 S
    'sWWWWWwWWWWWWwWs',
    'SwwwwwwwswwwwwwS',
    '.SSbSSSSbSSSSSS.',
]
IC1_LEDGE32 = [
    'sWWWWWWwWWWWWWWWWWwWWWWWWWWwWWWs',
    'SwwwwwswwwwwwwwwwwwwwwwswwwwwwwS',
    '.SSbSSSSbSSSSbSSSSSSSSSSSSSSSSS.',
]


def icicles_a1():
    one = cv_of(16, 16, [(IC1_LEDGE16, 0, 0), (IC1_T13, 2, 2), (IC1_T6, 7, 2), (IC1_T9, 10, 2), (IC1_T4, 13, 2)])
    two = cv_of(32, 16, [(IC1_LEDGE32, 0, 0), (IC1_T6, 1, 2), (IC1_T13, 4, 2), (IC1_T4, 9, 2), (IC1_T9, 12, 2),
                         (IC1_T4, 18, 2), (IC1_T11, 21, 2), (IC1_T6, 26, 2), (IC1_T4, 29, 2)])
    return one, two


# ---------------------------------------------------------------- 고드름 A2 「유리 고드름」 — 얼음 처마 + 굵게 성긴 원뿔
IC2_FAT = [           # 6×14
    'ceWdbB',
    'cewDbB',
    'ceWdCa',
    'cDedbB',
    '.ceWCB',
    '.cwdba',
    '.ceDbB',
    '.cWbB.',
    '.cdCa.',
    '..wbB.',
    '..cDa.',
    '..cWB.',
    '..dB..',
    '..a...',
]
IC2_FAT2 = [          # 5×12
    'ceWbB',
    'cwdCB',
    'ceWba',
    'cDdbB',
    '.cWCB',
    '.cdba',
    '.cwB.',
    '.cDa.',
    '..dB.',
    '..Wa.',
    '..dB.',
    '..a..',
]
IC2_MID = [           # 5×10
    'ceWbB',
    'cedCa',
    'cwDbB',
    '.cWba',
    '.cdCB',
    '..wbB',
    '..cDa',
    '..dB.',
    '..da.',
    '...a.',
]
IC2_SMALL = [         # 3×6
    'cWB',
    'cDa',
    'cwB',
    '.dB',
    '.da',
    '.a.',
]
IC2_NEEDLE = [        # 3×8
    'cWB',
    'cdC',
    'cwB',
    '.DB',
    '.Wa',
    '.cB',
    '.da',
    '.a.',
]
IC2_TWIN = [          # 7×9 — 붙어 난 두 고드름
    'ceWbcWB',
    'cwDCcdB',
    'ceWbDwa',
    '.cdB.cB',
    '.cWa.dB',
    '.cDB..a',
    '..dB...',
    '..Wa...',
    '..a....',
]
IC2_LEDGE16 = [       # 얼음 처마: 빛 윗입술 e·W · 몸 d · 그늘 아랫면 b
    'ceeWwWeeeWWweeeb',
    'cdDddcdDDddcddDa',
    '.bCbbaCbbbCabbB.',
]
IC2_LEDGE32 = [
    'ceeeWwWeeeeweWWWeeeWweeeWWeeweeb',
    'cdDddcddDDdddcdDDddcdddDDdcdDdda',
    '.bbCabbbCbbaCbbbbCabbbCbbaCbbCB.',
]


def icicles_a2():
    one = cv_of(16, 16, [(IC2_LEDGE16, 0, 0), (IC2_FAT, 1, 2), (IC2_SMALL, 8, 2), (IC2_MID, 11, 2)])
    two = cv_of(32, 16, [(IC2_LEDGE32, 0, 0), (IC2_MID, 0, 2), (IC2_NEEDLE, 6, 2), (IC2_FAT2, 10, 2),
                         (IC2_SMALL, 16, 2), (IC2_TWIN, 19, 2), (IC2_FAT, 26, 2)])
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
# 바람에 쓸린 낮은 더미(판 3) — 불투명한 눈 다섯 단: 흰 마루 W · 밝은 눈 w · 옅은 푸른 흰 몸 s · 푸른 회색 그늘 S · 바람 그늘 깊은 곳 D(water 3).
# 물결 마루·골, 푸른 흰 반짝(e), 얼음 껍질 금(c·d). 가장자리 흩어진 알갱이도 눈·얼음 색(회색 없음).
DR2_V1 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........wWW...',
    '.......wWWWeWWw.',
    '....wWWWeWwwWwws',
    '..wWWewwwswwswsS',
    '.wWwwsswsssSsSSD',
    'wWesssSSSSSDSDD~',
    'sswSSSSDDDcDD~~.',
    'SSSDDDD~~~~~~~..',
    '.~~~~~~~~.......',
    '..d.......s.....',
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
    '.wWWeWWWWw......',
    'wWWwwWWeWWWw....',
    'wwswwswWwwwWWw..',
    'sswsssswsswwwwws',
    'SSsSSSsSSsSScdSS',
    'DSDDSDDSDcDDedcD',
    '.DD~~~~~~~~~~~~.',
    '..~.....w...s...',
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
        meta = {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': v}
        if True:   # 관문 패치(A1·A2 둘 다): 바탕 a 의 맨 회색 얼음굴 바닥(4~7열 9~11행) 4×3칸 위 두 변형, 사람 없음
            patch = lib.backdrop('ice-cave-backdrop-a').crop(4 * T, 9 * T, 4 * T, 3 * T)
            for p_, cx, cy in ((a, 0, 0), (b, 2, 1), (b, 1, 2), (a, 3, 2)):
                patch.paste(p_, cx * T, cy * T)
            meta['extras'] = [('gate patch', patch, 1)]
        return img, meta
    return run


FNS = {
    'tc.ice_icicles': {'A1': mk_icicles(icicles_a1, 'A1'), 'A2': mk_icicles(icicles_a2, 'A2')},
    'tc.ice_crystal': {'A1': mk_obj(crystal_a1, 'A1'), 'A2': mk_obj(crystal_a2, 'A2')},
    'tc.ice_frozen': {'A1': mk_obj(frozen_a1, 'A1'), 'A2': mk_obj(frozen_a2, 'A2')},
    'tc.ice_drift': {'A1': mk_drift(drift_a1, 'A1'), 'A2': mk_drift(drift_a2, 'A2')},
}
NOTES_BY_ITEM = {
    'tc.ice_icicles': {'A1': '눈 처마 고드름(판 3) — 눈 처마 밑 가는 고드름 성기게, 왼 가장자리·오른 윤곽 얼음색, 반짝 줄',
                       'A2': '유리 고드름(판 3) — 한 덩이 얼음 처마 밑 굵게 성긴 원뿔, 다섯 결(가장자리·빛·반짝·몸·그늘+푸른 윤곽), 옅은 끝'},
    'tc.ice_crystal': {'A1': '눈 둔덕에서 솟은 얼음 결정 셋(가운데 큰 기둥, 좌우로 기운 작은 기둥)',
                       'A2': '서리 앉은 바위 위 큰 결정 하나 + 곁가지 둘(빛 면 눈 흰빛)'},
    'tc.ice_frozen': {'A1': '네모 얼음 덩이 속 투구·방패·세운 칼 전사, 빛줄기가 가로지름',
                      'A2': '눈 모자 쓴 들쭉날쭉 빙하 덩이 속 칼 든 전사(짙은 푸른 얼음)'},
    'tc.ice_drift': {'A1': '두 혹 눈 둔덕 / 길쭉한 둔덕 — 남쪽 푸른 회색 그늘',
                     'A2': '바람 물결 줄 더미 + 드러난 얼음 껍질·자갈'},
}

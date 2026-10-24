"""theme-climate-r2 — 관문에서 떨어진 기후 테마 세 항목을 다시 그린다(2026-10-23).

  tc.pyr_floor  피라미드 사암 판석 바닥 2×2(칸마다 섞음) — r1 은 「한 칸에 3켜 벽돌 + 윗변 빛·아랫변 줄눈 = 세운 벽돌 벽으로 읽힘,
                결 납작, 16px 이음에서 벽돌이 잘림」(evidence 2026-10-23-theme-climate-r1-refer-pyr_floor*.json) 으로 떨어졌다.
  tc.pyr_drift  판석 바닥 위 모래 더미 1×1 두 변형 · tc.ice_drift 동굴 바닥 위 눈 더미 1×1 두 변형 —
                r1 은 「질감 없음 · 칸 정보량 낮음」(작고 납작) 으로 관문에서 떨어졌다.

바닥 이음 규칙(칸을 아무렇게나 섞어도 판석이 이어진다):
  모든 칸의 가장자리 줄·열은 판석 몸통이고, 이음은 정해진 접점 넷에서만 칸 경계를 건넌다 —
  왼·오른 변은 y=10, 위·아래 변은 x=5. 칸 안에서는 접점끼리 비스듬한 이음(교차점 1~2개)으로 이어
  판석 하나가 칸 모서리 넷에 걸친 다각형(대략 칸 하나 크기)이 된다. 판석 빗면은 이음 기준(이음의 아래·오른쪽 = 판석의 위·왼 변 = 밝음,
  이음의 위·왼쪽 = 그늘)이라 경계를 건너도 같다.
  A1 「다듬은 판석」: 교차점이 접점에서 3px 안이라 이음이 거의 곧은 네모 판석(칸당 한 장 꼴). 2px 빗면(밝은 모서리 sand5 → sand4 →
       몸통 sand3 → wood5 → sand2 → 줄눈 sand1)으로 판석마다 볼록한 면, 판석 안에는 sand2·sand4·wood5·sand6 알갱이 결(평평한 5×5 0%), 7색 —
       패널 2·관문 화풍 「판석마다 명암·결 없음」 반영.
  A2 「막 깬 판석」: 교차점이 멀리 있어 비스듬한 다각 판석(패널 1 에서 「마른 진흙 금」으로 읽힌다는 지적).
  둘 다 줄눈 sand1, 판석 빗면 sand4/sand2, 줄눈 곳곳에 모래 알갱이(sand4), 닳은 점·패인 점·가는 금.
  (패널 1 의 A2 「모래 찬 밝은 줄눈」은 4/4 「갈라진 마른 땅」으로 떨어져 뺐다.)
  몸통 sand3 = 버들항 사막 광장(sand4 몸통)보다 한 단 어둡고 붉은 실내 사암.

더미: 투명 가장자리 · 빛 왼쪽 위 · 빛 받는 면(밝은 단)과 그늘 면(어두운 단)이 갈리는 마루 · 결(물결·흘러내린 줄) ·
  흩어진 알갱이 · 오른쪽 아래 '~' 접지 그림자.
  모래 A1 = [원뿔 더미 | 낮게 퍼진 자락] 9색(sand 1~6 + gold 5 마루 + wood 4·2 그늘 알갱이), 빛 면에 밝은 알갱이·그늘 면 안쪽에 짙은 띠,
       바깥 가장자리는 밝게 두어 딱딱한 밑 윤곽 없음(패널 2 「둘째 변형 = 바위·빵」 반영) ·
  모래 A2 = 패널 1 판(같은 모양, 명암 4단 — 관문 화풍 「명암 3단 · 정보량 낮음」으로 떨어진 판).
  눈 A1 = [처마 진 바람 더미 | 낮은 둔덕 + 초승달 골](패널 1 판, 관문 화풍 「명암 3단」으로 떨어짐) ·
  눈 A2 = [큰 처마 더미 | 작은 눈 덩이 무리] 11색(snow 4 + ice 3 반짝·껍질 + water 3 그늘 + iron 2 푸른 회색 알갱이), 윗면 흰 덮개 · 앞면 푸른 그늘.
  (패널 1: 관문 화풍 반쪽이 「명암 3단 < 4 · 칸 정보량 낮음」으로 떨어뜨려 명암 단과 결을 늘렸다.)

모든 후보 화소는 아래 행 문자열에서 온다(손 도트, 잠금 팔레트 sand · snow · ice · water 램프). 장면은 r1 에서 고른
피라미드 앞면·테두리 A1(theme_climate_desert) 과 얼음굴 바탕(theme_climate_ice) 을 맥락으로 깐다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_climate_desert as DS  # noqa: E402
import theme_climate_ice as IC  # noqa: E402
from theme_climate_lib import Cv, T, g, hcat, leg, ramp_chars  # noqa: E402,F401

WAVE = 'theme_climate'

# 글자 a..g = sand 0..6 (어둠 → 밝음)
LS = leg(ramp_chars('sand', 'abcdefg'))
# 바닥 A1: sand 0~6 + w = wood 5(빗면 얕은 그늘, sand2 와 sand3 사이) · i = wood 4
LF1 = leg(ramp_chars('sand', 'abcdefg'), w=('wood', 5), i=('wood', 4))
# 모래 더미 6단+ : sand 0~6 + h = gold 5(가장 밝은 마루) · i = wood 4 · j = wood 2(그늘 알갱이·밑둥)
LSD = leg(ramp_chars('sand', 'abcdefg'), h=('gold', 5), i=('wood', 4), j=('wood', 2))
# 눈 S s w W = snow 0..3 · 얼음 a..e = ice 0..4 · D = water 3(그늘) · B = water 2(처마 밑 가장 깊은 그늘)
LI = leg(ramp_chars('snow', 'SswW'), ramp_chars('ice', 'abcde'), D=('water', 3), B=('water', 2))
# 눈 더미 A2: 눈 4 + e d c = ice 4·3·2(반짝·얼음 껍질) + A D B = water 4·3·2(그늘) + m n = iron 5·4(푸른 회색 그늘 알갱이)
LI2 = leg(ramp_chars('snow', 'SswW'), e=('ice', 4), d=('ice', 3), c=('ice', 2), A=('water', 4), D=('water', 3), B=('water', 2),
          m=('iron', 5), n=('iron', 4))


# ================================================================================================ 바닥
F1 = [   # 다듬은 판석(이음 거의 곧게) — 2px 빗면: 이음 아래·오른쪽 sand5 모서리 · sand4, 이음 위·왼쪽 sand2 · wood5(얕은 그늘), 판석 안 알갱이 결
    [
        'ddwwcbfeddedcddd',
        'dedwcbceddddcdwd',
        'dddwwbfeddcddddd',
        'dccwcbbfedddddcd',
        'dddewfbfedddewdd',
        'dwddwcbfeedddddd',
        'ddddccffeddddded',
        'ddewwcbbfeccdddd',
        'wwwcccfbfcgcwwww',
        'cccbbbbbfbbbfccc',
        'bbfbfcffffwbbbbb',
        'feffeecbfeefccff',
        'egcewwcbfedeweee',
        'ddddwcbbfcddbbdd',
        'ddwwcbbfedddedbd',
        'dddccbfewddddcdd',
    ],
    [
        'dcdwcbfewddddded',
        'ddewcffeeddcddcd',
        'dddwwbfedddddcdd',
        'dddwcbfcddwdeddd',
        'dcwcbbfeddddeddd',
        'ddwcbwedddeddddd',
        'dcccbfedddddccdd',
        'dewcbfecdddddcdd',
        'wwwcffedddcdwdww',
        'cccbbfgddwwwwwcc',
        'bbfbfewwwcccccbb',
        'fffbfccccbbbbbbf',
        'eecbbbbfbbfffffe',
        'dccfwbffffeeceed',
        'dddecbfeeecdcwdd',
        'dddecbfedddddcdd',
    ],
    [
        'dddecbfecddddddd',
        'wddwcbfewdcdcddd',
        'dddwcbbfedddeddd',
        'ddwdwfbfecdddddd',
        'dcddwcbfewdddcdd',
        'ddddecbbfeddddwd',
        'ddcddwfffcdbbddd',
        'wddddwcbeeddbddd',
        'wwwcdwwbfedddwww',
        'cccwdwcbfewweccc',
        'bbbfewcbfccccbfb',
        'ffbbfecbbbbbbbwf',
        'ecfbbfbbwfffffee',
        'ddewfffbfeeccedd',
        'dddecbbbfedddded',
        'ddewwbffeddddddd',
    ],
    [
        'dddwcbfcddddwddd',
        'ddwwcbfedddcdddd',
        'dddwcffewddddddd',
        'cdwcbbfeddcdeded',
        'ddwwbfcddddddddd',
        'ddwcbfewwwddcddd',
        'dcccbbfcccwcwddd',
        'wcbbbbbbfbfcwddd',
        'cbbffffffbbbfeww',
        'cbfeceeeeffbbfcc',
        'bffcbfeddwefbbbb',
        'ffecbfeddddecfff',
        'eeccbfwdgdddceee',
        'dcwcbbfeddddwddd',
        'dddwfbfeccdddddd',
        'ddwwcbfeddcddcdd',
    ],
]
F2 = [   # 다각 판석(교차점이 멀리 — 막 깬 돌)
    [
        'ddddcbeddddccddd',
        'cdcdcbededdddddd',
        'dddccbeeddddecdf',
        'dddddebeddceeddd',
        'ddedccbeddddeddd',
        'dedddcbbedddcddd',
        'dcddddebecdddddd',
        'ddccecceeccdecdd',
        'dcbbbbebbbbecddd',
        'cbbeeeebeeebeecc',
        'beecddcbeddeebbb',
        'eecdddcbedddeeee',
        'ddeedcbbefdddddd',
        'dddedcbeddcdcddd',
        'ddcdcebedddddcdd',
        'dcddcbeddeddcddd',
    ],
    [
        'ddddcbedddcddddd',
        'decdcbeddddddcdd',
        'dddcbbedccdddddd',
        'dddcbeddddeededd',
        'dcccbedddddedddd',
        'ddcebececddddddd',
        'ddcbbbbebeccccdd',
        'decbeeeeebbbeddd',
        'ddcbedcdfeebeedd',
        'ccbbeddddddebbec',
        'bbebedeeddddebbb',
        'eeeebeddedcddeee',
        'dcdceedeedddcddd',
        'dcdcbbeddddbdddd',
        'ddddebedddcdbbdd',
        'dddecbecdddddcdd',
    ],
    [
        'ddddcbeddddcccdd',
        'ccddcbededdddddd',
        'dddccbeddcdddddf',
        'ddddcbbeddcddddd',
        'ddedcceeddddeedd',
        'deeddcbedddddedd',
        'dddddcbbecdddddd',
        'dccdddebeddceddd',
        'ddbdddcbbedddddd',
        'cccbccdebedcdccc',
        'bbebbbecbbeeebbb',
        'eeceeebbbebbbbee',
        'ddcdddeeebeeeedd',
        'dddddcccbeddeddd',
        'ddcdcbbeedddeedd',
        'ddddcbeededdcddd',
    ],
    [
        'ddddcbedddcddddd',
        'deddcbeddcddddcd',
        'ddcdcbedccdddddd',
        'dddcbbedddeededd',
        'ddccbedddddedddd',
        'ddcbebeedddddddd',
        'ddcbeebeecddccdd',
        'decbedeebbeddddd',
        'dcbbededfeeedddd',
        'ccecdeedddebeccc',
        'bbbedddddddebbeb',
        'eecddddddccbeeee',
        'dddddddeebeedddd',
        'dcdddccbbeeddcdd',
        'ddddcbbeedcddddd',
        'dddeceedddddccdd',
    ],
]


def floor_cells(n):
    return [g(c, LF1) for c in F1] if n == 1 else [g(c, LS) for c in F2]


def floor_img(n):
    out = Cv(32, 32)
    for i, cv in enumerate(floor_cells(n)):
        out.paste(cv, (i % 2) * T, (i // 2) * T)
    return out


def pyr_room(plan, n):
    """r1 에서 고른 피라미드 테두리·앞면 A1 방에 이 판 바닥 n 을 깐다(desert 모듈의 바닥 고르기만 잠시 바꿔 끼운다)."""
    orig = DS.floor_fn
    DS.floor_fn = lambda _n: lib.mix_cells(floor_cells(n))
    try:
        return DS.pyramid_room(plan, 1)
    finally:
        DS.floor_fn = orig


def mk_floor(n):
    def run():
        cells = floor_cells(n)
        v = pyr_room(DS.ROOM, n)
        lib.put_actor(v, 4, 5)
        meta = {'kind': 'tile', 'vignette': v,
                'extras': [('mix 6x6 random per cell', lib.tile_fill(6, 6, lib.mix_cells(cells)), 3),
                           ('test map', pyr_room(DS.TEST, n), 1)]}
        return floor_img(n), meta
    return run


# ================================================================================================ 모래 더미
PD1o = [
    '................',
    '................',
    '.......f........',
    '......fgf.......',
    '.....fggfe......',
    '....efgfged.....',
    '...efggfgeed....',
    '..efgffgfeddc...',
    '.efgfefgfedcdc..',
    '.effefgffedcdcc.',
    'efgfeffgeedddcc.',
    'eefeefffeedccbc~',
    '.e.eeeeeddccbb~~',
    '..e.e.dddcbb~~~.',
    '....e..~~~~~~...',
    '..e....e...d....',
]
PD2o = [
    '................',
    '................',
    '................',
    '.....e...e......',
    '..e.e.ef.e..e...',
    '....effgfee.....',
    '.e.efgggffge.e..',
    '..effeeeefgfe...',
    '.efgffgffeeffe..',
    'e.eefgggffeedfe.',
    '.effeeeefgffdde.',
    '..eeffgggfeeddc.',
    '.e.ddeeeeeddcc~.',
    '....~ddcdccc~~..',
    '..e...~~~~~...e.',
    '.........d......',
]
PD1 = [
    '................',
    '.......h........',
    '......hgf.......',
    '.....hgffe......',
    '....fgfgfed.....',
    '....gfhffedd....',
    '...fgffgfedcd...',
    '..egfgffeedcdc..',
    '..fgfhfefedcbci.',
    '.efgffeefedcbbc.',
    '.fgfgfefedcbjbc.',
    'effeefeededcbjbc',
    '.eedeeddddccbjbc',
    '..ddcddcdcbbic~~',
    '.c..cc~ccic~~~..',
    '...c...~~~~~..d.',
]
PD2 = [
    '................',
    '................',
    '................',
    '................',
    '.....f.e..h.....',
    '..e.fhgfe.......',
    '...fgghgfee.e...',
    '.efgfgffeeffe...',
    'effgfeeedeffgfe.',
    '.efeeddeeefgffe.',
    'e.edddceeeeeedde',
    '..dcdcidddcbbcc.',
    '.e.ccicccbjbcc~.',
    '...c.~~ccc~~~~..',
    '..d....~~~...d..',
    '......e.........',
]


def mk_pdrift(a_rows, b_rows, lg=LS):
    def run():
        a, b = g(a_rows, lg), g(b_rows, lg)
        base = pyr_room(DS.ROOM, 1)
        v = lib.on(base, (a, 2 * T, 4 * T), (b, 6 * T, 5 * T), (a, 7 * T, 4 * T), (b, 2 * T, 6 * T))
        lib.put_actor(v, 4, 5)
        patch = lib.on(lib.tile_fill(4, 3, lib.mix_cells(floor_cells(1))), (a, 0, 0), (b, 2 * T, T), (a, T, 2 * T), (b, 3 * T, 0))
        return hcat(a, b), {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': v,
                            'extras': [('on floor 4x3', patch, 3)]}
    return run


# ================================================================================================ 눈 더미
ID1 = [
    '................',
    '........w.......',
    '......wwWw......',
    '....wwWWWWw.....',
    '...wWWWWWWWw....',
    '..wWWwwwWWWWw...',
    '.wWWwsswwWWWWw..',
    'wWWwsSswWWWWWSD.',
    'wWwssswWWWWWSSD.',
    '.wwsswWWWWWSSDDb',
    'wwsswWWWwSSDDb~.',
    '.ssswwwSSDDbb~~.',
    '..sSSSSDDbb~~...',
    '...SDDDbb~~.....',
    '.w..~~~~~...s...',
    '.........s......',
]
ID2 = [
    '................',
    '................',
    '................',
    '................',
    '....w.ww........',
    '..wwWWWWw..w....',
    '.wWWWWWWWWw.....',
    'wWWWsswwWWWWw...',
    '.wWwwSSswwWWWw..',
    'swWWWwwSSswWWws.',
    '.swwwWWWwSSSwwsS',
    '..sSswwwwwwSSSSD',
    '...SDSSSSSSSDDb~',
    '....~~DDDDDDb~~.',
    '..w......~~.....',
    '.......s........',
]
ID3 = [
    '................',
    '................',
    '....wWWw.e......',
    '..wWWeWWWw......',
    '.wWWWWWeWWWw....',
    'wWWWwWWWWwWWw...',
    'wWWwwswwwwWWWw..',
    'wWwsswssswwwWWs.',
    '.wwssAsSSsswssmS',
    '.smsSSSnSSSSSAnD',
    '..ssSDSDDcDSDDnB',
    '...SDDDBDDDBDDBB',
    '....~BDBBBDBB~~.',
    '.....~~~~~~~~...',
    '..s.......e.....',
    '................',
]
ID4 = [
    '................',
    '...e............',
    '.....wWWw.......',
    '....wWeWWWw.....',
    '.w.wWWwwwWWs....',
    '...wwsAssSSm....',
    '....SnDDSDBn....',
    'wWWw.~~BB~~.....',
    'WeWws...........',
    'wsAsD.....wWWw..',
    'SnDB~...wWeWWWWw',
    '.~~~...wWWwwswWs',
    '..e....wssAssSSn',
    '........SnDDSDBB',
    '.....s...~BBB~~.',
    '..........~~~...',
]


def mk_idrift(a_rows, b_rows, cand, lg=LI):
    def run():
        a, b = g(a_rows, lg), g(b_rows, lg)
        v = IC.scene(cand, [(a, 9, 3, 0, 0), (b, 10, 3, 0, 0), (b, 3, 3, 0, 0), (a, 10, 5, 0, 0), (a, 4, 6, 0, 0),
                            (b, 9, 6, 0, 0)], None)
        patch = lib.backdrop('ice-cave-backdrop-a').crop(4 * T, 9 * T, 4 * T, 3 * T)
        for p_, cx, cy in ((a, 0, 0), (b, 2, 1), (b, 1, 2), (a, 3, 2)):
            patch.paste(p_, cx * T, cy * T)
        return hcat(a, b), {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': v,
                            'extras': [('on cave floor 4x3', patch, 3)]}
    return run


CANDIDATES = {
    'tc.pyr_floor': {'A1': mk_floor(1), 'A2': mk_floor(2)},
    'tc.pyr_drift': {'A1': mk_pdrift(PD1, PD2, LSD), 'A2': mk_pdrift(PD1o, PD2o)},
    'tc.ice_drift': {'A1': mk_idrift(ID1, ID2, 'A1'), 'A2': mk_idrift(ID3, ID4, 'A2', LI2)},
}

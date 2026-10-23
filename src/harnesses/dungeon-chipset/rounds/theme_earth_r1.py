"""theme-earth-r1 — 땅 계열 던전 테마 네 개(광산·지하묘지·성/요새·고대 유적)의 빠진 조각(2026-10-23, 조수 던전 테마 부족분).

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 생성 이미지·잡음 함수·도형 마스크 본체는 없다.
외곽선 규칙(seed rules.outline): 먹 윤곽 없이 재질 명암 — 빛 받는 위·왼 가장자리는 재질의 밝은 단, 그늘 아래·오른은 어두운 단.

항목은 모두 줄 공통(시드 common) — 테마 조각이라 줄(A·B·C 동굴 화풍)이 아니라 버들항 테마 키트(바다 동굴 앞면·지하 수도교 카타콤 앞면·
성 앞면·신전 폐허 바닥)에 붙는다. 후보 키 A1 A2. 장면(vignette)은 던전 빌더(src/editor/dungeonKit/beodeul/profiles.ts)가
그 테마에 실제로 까는 버들항 키트(천장 오토타일 beodeul_dungeon_ceiling · 앞면 3칸 표본 · 바닥 2×2 표본)로 짓는다 — 장면은 맥락이지 후보가 아니다.

덧그림(decal) 조각 — 선로·양탄자·풀 난 판석·광맥·납골 선반은 투명 바탕 위에 그린다. 바닥(아래층 1)이나 벽 앞면 위에 얹는 두 번째 바닥층
(MZ 4층의 아래층 2) 또는 벽 걸이 조각이다. 바탕 바닥·앞면이 버들항 그대로 비치므로 버들항 키트와 이음이 생기지 않는다.

범례(공통 BASE): 나무 a~f(wood 0~5) · 쇠 g~l(iron 0~5) · 금 m~r(gold 0~5) · 불 F G H J K L(fire 0~5) · 뼈 s~w(bone 0~4)
· 이끼 A B C D E Y(moss 0~5) · 붉은 S~W(red 0~4) · 풀 1~5 아님(기물마다 숫자는 그 기물의 돌 램프) · ';' ':' ',' void 0~2(구조물 안쪽에만)
'.' 투명, '~' 바닥 그림자(투명한 곳에만).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'theme_earth'
T = 16


def ramp_chars(ramp, chars):
    return {ch: (ramp, i) for i, ch in enumerate(chars)}


BASE = {}
for _r, _c in (('wood', 'abcdef'), ('iron', 'ghijkl'), ('gold', 'mnopqr'), ('fire', 'FGHJKL'), ('bone', 'stuvw'),
               ('moss', 'ABCDEY'), ('red', 'STUVW')):
    BASE.update(ramp_chars(_r, _c))
BASE.update(z=('rim', 0))
BASE.update({';': ('void', 0), ':': ('void', 1), ',': ('void', 2)})
LEG = legend(**BASE)


def leg(stone=None, **over):
    """BASE + 숫자 '0'~'6' = stone 램프 단(기물마다 다른 돌) + 덧쓰기."""
    d = dict(BASE)
    if stone:
        d.update({str(i): (stone, i) for i in range(len(dot.RAMPS[stone]))})
    d.update(over)
    return legend(**d)


def g(rows, lg=None):
    return grid(rows, lg or LEG)


def hcat(*cvs, gap=0):
    out = Cv(sum(c.w for c in cvs) + gap * (len(cvs) - 1), max(c.h for c in cvs))
    x = 0
    for c in cvs:
        out.paste(c, x, out.h - c.h)
        x += c.w + gap
    return out


def vcat(*cvs):
    out = Cv(max(c.w for c in cvs), sum(c.h for c in cvs))
    y = 0
    for c in cvs:
        out.paste(c, 0, y)
        y += c.h
    return out


def mirror(rows):
    return [r[::-1] for r in rows]


# ================================================================================================ 장면(맥락) — 버들항 키트
_REPO = dot.REPO
_TS = None
_SHEET = None


def _ts():
    global _TS, _SHEET
    if _TS is None:
        _TS = json.load(open(os.path.join(_REPO, 'src', 'assets', 'beodeulCityTileset.json'), encoding='utf-8'))
        _SHEET = Image.open(os.path.join(_REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')).convert('RGBA')
    return _TS


def cell(t):
    _ts()
    x, y = (t % 128) * 16, (t // 128) * 16
    return Cv.of(_SHEET.crop((x, y, x + 16, y + 16)))


def kit_rows(kid):
    return [r['tiles'] for r in next(k for k in _ts()['structureKits'] if k['id'] == kid)['rows']]


def kit_cv(kid):
    k = next(k for k in _ts()['structureKits'] if k['id'] == kid)
    cv = Cv(k['width'] * T, k['height'] * T)
    for r, row in enumerate(k['rows']):
        for lay in ('tiles', 'upperTiles'):
            for c, t in enumerate(row.get(lay) or []):
                if t is not None and t >= 0:
                    cv.paste(cell(t), c * T, r * T)
    return cv


def ceiling_tile(mask):
    gr = next(x for x in _ts()['autotileGroups'] if x['id'] == 'beodeul_dungeon_ceiling')
    vm = gr['variantMap']
    t = vm.get(str(mask))
    if t is None or (t == vm['255'] and mask != 255):
        t = vm['255']
    return t


# 테마 → (앞면 키트 접두, 바닥 키트) — 던전 빌더 profiles.ts 그대로
THEMES = {
    'mine': ('bd-pick-sea-cave-face-cave', 'bd-pick-sea-cave-floor-cave'),
    'catacomb': ('bd-pick-aqueduct-sewer-face-cata', 'bd-pick-aqueduct-sewer-floor-cata'),
    'castle': ('bd-pick-castle-catacombs-face-castle', 'bd-pick-castle-catacombs-floor-castle'),
    'ruins': ('bd-pick-temple-ruins-face-temple', 'bd-pick-temple-ruins-floor-ruin'),
}


def scene(theme, w, h, face_h=2, ceil_rows=1, floor_kit=None):
    """w×h 칸 방 한 자락: 위 ceil_rows 줄 천장(남쪽 테두리) · face_h 줄 벽 앞면 · 나머지 바닥. 양끝 앞면은 마구리."""
    face, floor = THEMES[theme]
    floor = floor_kit or floor
    fr = kit_rows(f'{face}-{face_h}h')
    fl = kit_rows(floor)
    cv = Cv(w * T, h * T)
    for y in range(h):
        for x in range(w):
            if y < ceil_rows:
                m = 255 if y < ceil_rows - 1 else 155
                t = ceiling_tile(m)
            elif y < ceil_rows + face_h:
                row = fr[y - ceil_rows]
                t = row[0] if x == 0 else row[2] if x == w - 1 else row[1]
            else:
                t = fl[(y - ceil_rows - face_h) % len(fl)][x % len(fl[0])]
            cv.paste(cell(t), x * T, y * T)
    return cv


def actor():
    return Cv.of(dot.actor1_frame(1, 0, 0))


def put_actor(cv, cx, cy):
    cv.paste(actor(), cx * T - 4, cy * T - 14)


def place(cv, piece, cx, cy, dx=0, dy=0):
    cv.paste(piece, cx * T + dx, cy * T + dy)


# ================================================================================================ 광산 — 선로 이음 세트
# 덧그림(투명 바탕) — 바닥 위 두 번째 바닥층(걸음 o). 칸 하나가 이음 한 가지. 이음 자리(빌더가 맞출 약속):
#   가로 레일 = 5·6행(위 k 밝음 · 아래 g) 과 11·12행 / 세로 레일 = 3·4열(왼 k · 오른 h) 과 11·12열. 모든 칸의 변에서 이 자리로만 레일이 나간다.
#   침목: 가로 = 2~4열·10~12열(4~13행) · 세로 = 2~4행·10~12행(1~14열) — 8px 주기라 칸을 넘어도 간격이 같다.
# 이름: H 가로 · V 세로 · 굽이 NE NW SE SW(이어지는 두 방향) · T 는 갈래 줄기 방향(TN = 가로 + 북쪽 갈래) · X 십자 ·
#        끝 EN ES EE EW = 그 방향 끝에 나무 막이(선로는 반대쪽에서 들어온다).
# A1 = 나무 침목 + 쇠 레일(props-r1 레일 그대로의 결), A2 = 쇠 못 박은 검은 침목 둘씩 + 자갈 깐 바닥(밸러스트).
# 굽이는 침목 행(TIE)과 레일 행(RL)을 따로 적고 레일을 침목 위에 찍는다 — 굽은 레일 밑으로 침목 셋이 부채꼴로 깔린다.
TIE_A1 = {
    'SE': [
        '................',
        '................',
        '................',
        '................',
        '............eed.',
        '............dcb.',
        '......eed...dcb.',
        '.......edc..dcb.',
        '........dcb.dcb.',
        '.........dcbdcb.',
        '..........dccba.',
        '.eeeeeeeeed.~~..',
        '.dddddddddc.....',
        '.bbbbbbbbba.....',
        '..~~~~~~~~~.....',
        '................',
    ],
    'SW': [
        '................',
        '................',
        '................',
        '................',
        '.eed............',
        '.dcb............',
        '.dcb...eed......',
        '.dcb..edc.......',
        '.dcb.edc........',
        '.dcbedc.........',
        '.dccbc..........',
        '..~~~eeeeeeeeed.',
        '.....dddddddddc.',
        '.....bbbbbbbbba.',
        '......~~~~~~~~~.',
        '................',
    ],
    'NE': [
        '................',
        '.eeeeeeeeed.....',
        '.dddddddddc.....',
        '.bbbbbbbbba.....',
        '..~~~~~~~~~.eed.',
        '.......edc..dcb.',
        '........edc.dcb.',
        '.........edcdcb.',
        '..........dcdcb.',
        '...........bdcb.',
        '............dcb.',
        '............dcb.',
        '............dcb.',
        '............cba.',
        '.............~~.',
        '................',
    ],
    'NW': [
        '................',
        '.....eeeeeeeeed.',
        '.....dddddddddc.',
        '.....bbbbbbbbba.',
        '.eed..~~~~~~~~~.',
        '.dcb..edc.......',
        '.dcb.edc........',
        '.dcbedc.........',
        '.dcedc..........',
        '.dcbc...........',
        '.dcb............',
        '.dcb............',
        '.dcb............',
        '.cba............',
        '..~~............',
        '................',
    ],
}
RL_A1 = {
    'SE': [
        '................',
        '................',
        '................',
        '................',
        '................',
        '............kkkk',
        '..........kkgggg',
        '........kkgg....',
        '......kkgg......',
        '.....kgg........',
        '.....kh.........',
        '....kh........kk',
        '....kh......kkgg',
        '...kh.......kg..',
        '...kh......kh...',
        '...kh......kh...',
    ],
    'SW': [
        '................',
        '................',
        '................',
        '................',
        '................',
        'kkkk............',
        'ggggkk..........',
        '....ggkk........',
        '......ggkk......',
        '........ggk.....',
        '.........kh.....',
        'kk........kh....',
        'ggkk......kh....',
        '..gkh......kh...',
        '...kh......kh...',
        '...kh......kh...',
    ],
    'NE': [
        '...kh......kh...',
        '...kh......kh...',
        '...kh......kh...',
        '...kh.......kh..',
        '....kh......kkk.',
        '....kh.......kkk',
        '.....kh.......gg',
        '.....kkh........',
        '......kgk.......',
        '.......ggkk.....',
        '.........ggkk...',
        '...........ggkkk',
        '.............ggg',
        '................',
        '................',
        '................',
    ],
    'NW': [
        '...kh......kh...',
        '...kh......kh...',
        '...kh......kh...',
        '..kh......kh....',
        '.kkh......kh....',
        'kkg.......kh....',
        'gg.......kh.....',
        '........kh......',
        '.......kgg......',
        '......kgg.......',
        '...kkkgg........',
        'kkkggg..........',
        'ggg.............',
        '................',
        '................',
        '................',
    ],
}
RAIL_A1 = {
    'H': [
        '................',
        '................',
        '................',
        '................',
        '..eed.....eed...',
        'kkkkkkkkkkkkkkkk',
        'gggggggggggggggg',
        '..dcb.....dcb...',
        '..dcb.....dcb...',
        '..dcb.....dcb...',
        '..dcb.....dcb...',
        'kkkkkkkkkkkkkkkk',
        'gggggggggggggggg',
        '..cba.....cba...',
        '...~~......~~...',
        '................',
    ],
    'V': [
        '...kh......kh...',
        '...kh......kh...',
        '.eekheeeeeekhed.',
        '.ddkhddddddkhdc.',
        '.cbkhbbbbbbkhba.',
        '..~kh~~~~~~kh~~.',
        '...kh......kh...',
        '...kh......kh...',
        '...kh......kh...',
        '...kh......kh...',
        '.eekheeeeeekhed.',
        '.ddkhddddddkhdc.',
        '.cbkhbbbbbbkhba.',
        '..~kh~~~~~~kh~~.',
        '...kh......kh...',
        '...kh......kh...',
    ],
}
END_A1 = {   # 끝 막이 — 나무 토막(윗면 f·e · 앞면 d·c · 쇠띠 j·k) + 그 앞에서 끊긴 레일
    'EE': [
        '................',
        '................',
        '.........fffff..',
        '........feeeeed.',
        '..eed...eddddcc.',
        'kkkkkkkkdddddcb.',
        'ggggggggdcccccb.',
        '..dcb...jkkkkih.',
        '..dcb...dcclccb.',
        '..dcb...dcccccb.',
        '..dcb...dcccccb.',
        'kkkkkkkkdcccccb.',
        'ggggggggcbbbbba.',
        '..cba....aaaaaa~',
        '...~~....~~~~~~~',
        '................',
    ],
    'EW': [
        '................',
        '................',
        '..fffff.........',
        '.feeeeed........',
        '.eddddcc..eed...',
        '.edddddbkkkkkkkk',
        '.dcccccbgggggggg',
        '.jkkkkih..dcb...',
        '.dcclccb..dcb...',
        '.dcccccb..dcb...',
        '.dcccccb..dcb...',
        '.dcccccbkkkkkkkk',
        '.cbbbbbagggggggg',
        '..aaaaaa~.cba...',
        '..~~~~~~~..~~...',
        '................',
    ],
    'EN': [
        '................',
        '.ffffffffffffff.',
        '.feeeeeeeeeeeed.',
        '.eddddddddddddc.',
        '.jkkkkkkkkkkkih.',
        '.dccccclcccccca.',
        '.cbbbbbbbbbbbba.',
        '..aaaaaaaaaaaa~.',
        '..~kh~~~~~~kh~~.',
        '...kh......kh...',
        '.eekheeeeeekhed.',
        '.ddkhddddddkhdc.',
        '.cbkhbbbbbbkhba.',
        '..~kh~~~~~~kh~~.',
        '...kh......kh...',
        '...kh......kh...',
    ],
    'ES': [
        '...kh......kh...',
        '...kh......kh...',
        '.eekheeeeeekhed.',
        '.ddkhddddddkhdc.',
        '.cbkhbbbbbbkhba.',
        '..~kh~~~~~~kh~~.',
        '...kh......kh...',
        '.ffffffffffffff.',
        '.feeeeeeeeeeeed.',
        '.eddddddddddddc.',
        '.jkkkkkkkkkkkih.',
        '.dccccclcccccca.',
        '.cbbbbbbbbbbbba.',
        '..aaaaaaaaaaaa~.',
        '...~~~~~~~~~~~~.',
        '................',
    ],
}
RAIL_NAMES = ('H', 'V', 'NE', 'NW', 'SE', 'SW', 'X', 'TN', 'TS', 'TE', 'TW', 'EN', 'ES', 'EE', 'EW')
JOIN = {   # 이름 → 겹쳐 찍을 조각(아래부터). 갈래·십자는 곧은 칸과 굽이를 겹친 것이다.
    'TN': ('H', 'NE', 'NW'), 'TS': ('H', 'SE', 'SW'), 'TE': ('V', 'NE', 'SE'), 'TW': ('V', 'NW', 'SW'), 'X': ('H', 'V'),
}


def rail_tiles(straight, ties, rails, ends, lg=None, stub=False):
    """이름 → 16×16 Cv. 굽이 = 침목 위에 레일. 갈래 = 침목을 모두 먼저, 레일을 그 위에(한 갈래의 레일이 다른 갈래 침목에 가리지 않게)."""
    lg = lg or LEG
    tie_of = dict(ties)
    rail_of = dict(rails)
    for k, rows in straight.items():   # 곧은 칸: 침목 = 레일 글자(k g h)를 지운 행, 레일 = 레일 글자만
        tie_of[k] = [''.join('.' if ch in 'kgh' else ch for ch in r) for r in rows]
        rail_of[k] = [''.join(ch if ch in 'kgh' else '.' for ch in r) for r in rows]
    out = {}
    for nm in RAIL_NAMES:
        if nm in ends:
            out[nm] = grid(ends[nm], lg)
            continue
        if stub and nm in STUB:
            out[nm] = _stub_tile(nm, tie_of, rail_of, lg)
            continue
        parts = JOIN.get(nm, (nm,))
        cv = Cv(T, T)
        for p in parts:
            stamp(cv, tie_of[p], lg)
        for p in parts:
            stamp(cv, rail_of[p], lg)
        out[nm] = cv
    return out


STUB = {   # 갈래·십자(A2): 바탕 곧은 칸 + 곁가지 곧은 칸에서 남길 범위(행 또는 열)
    'TN': ('H', 'V', 'rows', 0, 5), 'TS': ('H', 'V', 'rows', 13, 16),
    'TE': ('V', 'H', 'cols', 13, 16), 'TW': ('V', 'H', 'cols', 0, 3), 'X': ('H', 'V', 'all', 0, 16),
}


def _cut(rows, how, a, b):
    if how == 'rows':
        return [r if a <= y < b else '.' * len(r) for y, r in enumerate(rows)]
    if how == 'cols':
        return [''.join(ch if a <= x < b else '.' for x, ch in enumerate(r)) for r in rows]
    return rows


def _stub_tile(nm, tie_of, rail_of, lg):
    """바탕 침목 → 곁가지 침목 → 곁가지 레일 → 바탕 레일(바탕 레일이 맨 위라 이음이 한 줄로 끊김 없이 지나간다)."""
    base, br, how, a, b = STUB[nm]
    cv = Cv(T, T)
    stamp(cv, tie_of[base], lg)
    stamp(cv, _cut(tie_of[br], how, a, b), lg)
    stamp(cv, _cut(rail_of[br], how, a, b), lg)
    stamp(cv, rail_of[base], lg)
    return cv


def rail_sheet(tiles):
    """그림 = 8×2 칸: 윗줄 H V NE NW SE SW X (빈칸) · 아랫줄 TN TS TE TW EN ES EE EW."""
    cv = Cv(8 * T, 2 * T)
    for i, nm in enumerate(RAIL_NAMES):
        r, c = (0, i) if i < 7 else (1, i - 7)
        cv.paste(tiles[nm], c * T, r * T)
    return cv


# ================================================================================================ 광산 — 갱목 지지대
# 벽 걸이 틀 3×2(벽 앞면 2단 높이 32px 에 딱 맞음): 위 들보(윗면 2줄 밝음 · 앞면 4줄 · 밑 그늘 한 줄 · 벽에 지는 그림자) +
# 양쪽 기둥(왼 모서리 밝음 · 오른 그늘) + 가새(들보 밑과 기둥을 잇는 빗장) + 쇠띠. 기둥 사이는 투명 — 뒤의 버들항 벽 앞면이 보인다.
# 바닥 기둥 1×2: 칸 가운데 선 갱목(윗면 마구리 = 나이테가 보이는 윗면 3줄) + 머리 받침목.
FRAME_A1 = [
    '.ffffffffffffffffffffffffffffffffffffffffffffff.',
    'feeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeed',
    'eddddcdddddddddcddddddddddddcdddddddddddcddddddc',
    'edddcddddddddddddcddddddddddddddddcdddddddddddcb',
    'edcddddddddcddddddddddddcdddddddddddddddddcdddcb',
    'eddddddddddddddcdddddddddddddddcdddddddddddddddb',
    'bbcbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbba',
    '.eddcbeddc~~~~~~~~~~~~~~~~~~~~~~~~~~~~eddceddcb~',
    '.eddcb.eddc~~.......................~eddc.eddcb~',
    '.eddcb..eddc~~.....................~eddc..eddcb~',
    '.edccb...eddc~.....................eddc...edccb~',
    '.eddcb....eddc~...................eddc....eddcb~',
    '.jkkih.....edc~~.................eddc~....jkkih~',
    '.hhhgg......dc~~.................dc~~.....hhhgg~',
    '.eddcb....................................eddcb~',
    '.edccb....................................edccb~',
    '.eddcb....................................eddcb~',
    '.eddcb....................................edcdb~',
    '.edcdb....................................eddcb~',
    '.eddcb....................................eddcb~',
    '.eddcb....................................edccb~',
    '.edccb....................................eddcb~',
    '.eddcb....................................eddcb~',
    '.jkkih....................................jkkih~',
    '.hhhgg....................................hhhgg~',
    '.eddcb....................................eddcb~',
    '.edcdb....................................edcdb~',
    '.eddcb....................................eddcb~',
    '.eddcb....................................eddcb~',
    '.edccb....................................edccb~',
    '.dccba~...................................dccba~',
    '..~~~~~....................................~~~~~',
]
# r1 관문: 머리 받침이 앞에서 본 띠(윗면 1~2줄)라 3/4 가 아니라는 보류(2/4) → 머리 받침을 위에서 본 네모 판(윗면 4줄 f·e 결 + 앞 가장자리 e 한 줄 +
# 앞면 d·c 한 줄 + 밑 그늘 b)으로 다시 그리고, 기둥 몸을 두 줄 줄였다.
POST_A1 = [
    '................',
    '..ffffffffffff..',
    '.ffefffffeffffe.',
    '.fefffeffffffee.',
    '.ffffeffffeffed.',
    '.eeeeeeeeeeeeed.',
    '.dcddcdddcdddcb.',
    '.bbbbbbbbbbbbba.',
    '.edc.effedc.edc~',
    '..edcedddcbedc~~',
    '...edeedccbdc~~.',
    '.....eddcdb~~...',
    '.....edcccb~....',
    '.....jkkkih~....',
    '.....hhhhgg~....',
    '.....eddcdb.....',
    '.....edcdcb.....',
    '.....eddccb.....',
    '.....edcdcb.....',
    '.....eddcdb.....',
    '.....edccdb.....',
    '.....jkkkih.....',
    '.....hhhhgg.....',
    '.....eddcdb.....',
    '.....edcdcb.....',
    '.....eddccb.....',
    '.....edcdcb.....',
    '.....eddcdb.....',
    '....dedcccba....',
    '....cbbbbbaa~~..',
    '.....~~~~~~~~~..',
    '................',
]


# ================================================================================================ 광산 — 광맥(벽 앞면 덧그림)
# 버들항 바다 동굴 앞면(빌더의 광산 벽) 위에 얹는 벽 걸이 조각. 투명 바탕 — 앞면 결은 버들항 그대로 비친다.
# 갈라진 틈(crock 0·1 = 바위 안쪽 그늘) 둘레에 흰 석영(Q·P) 띠, 그 속에 금 덩이(o p q r, 빛 받는 위·왼 r) 또는 쇠 광석(h i j k l, 반짝 l).
# 그림 = [금 2×2 | 쇠 2×2 | 금 1×1 | 쇠 1×1] — 2×2 는 앞면 2단 높이 그대로, 1×1 은 어느 단에나.
ORE_LEG = dict(Q=('stone', 5), P=('stone', 3), O=('stone', 2))
# r1 패널 1: 돌덩이를 벽에 붙인 것처럼 보이고 금이 간 빗금이 다리처럼 튀어나옴(4명 모두) → 테두리·빗금을 없애고, 벽 속으로 파고든
# 어두운 광맥 띠(crock 0·1, 윗변만 3 으로 밝은 턱)에 금 알갱이(r 빛 · q p 몸 · o n 그늘)가 박힌 모양으로 다시 그림. 바탕은 투명 — 버들항 굴 벽이 그대로 보인다.
VEIN2_A1 = [   # 2×2: 띠 둘(위 길게 · 아래 짧게) + 흩어진 알갱이
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........................r.....',
    '...........3.............qpo....',
    '......3333.233..........3.o.....',
    '....33211112112333.....3311.....',
    '...3211rq0111rr011233332110.....',
    '..321rqqpo01qqpo1111221110......',
    '..21qqppoo0qrpoo0001011100......',
    '..1rqpp0oo01ppoo01rq0100........',
    '..10ppo00n01oo0n01qpo0n0........',
    '...10on0n00n0n0001oon00.........',
    '....100000.000.00000n0..........',
    '.........r.......0000...3.......',
    '........qpo.................r...',
    '.........o.................qo...',
    '......3333......................',
    '....33211233...............3....',
    '...32111rq123.............33....',
    '...211rqqpo11..........333211...',
    '...10qpppoo10........33211rq1...',
    '....10oo0n01........3211qqpo0...',
    '.....100000.........10qppoo0....',
    '....................10oo0n0.....',
    '.....................10000......',
    '................................',
    '................................',
    '................................',
    '................................',
]
VEIN1_A1 = [   # 1×1: 작은 주머니 하나
    '................',
    '................',
    '................',
    '..........r.....',
    '.....33..qpo....',
    '...3321233.o....',
    '..321rq1123.....',
    '..21qqpo0112....',
    '..1rqppoo0n1....',
    '..10qpo0n01rq...',
    '...10on0010po...',
    '....100000.0....',
    '................',
    '................',
    '................',
    '................',
]



# ================================================================================================ 지하묘지 — 납골 벽(벽 앞면 덧그림)
# 버들항 카타콤 앞면(지하 수도교 face-cata, 빌더의 지하묘지 벽) 위에 얹는 벽 걸이 3칸 폭. 벽을 파낸 선반 칸(뒤 = 그늘진 벽돌 0·1)에
# 해골 줄과 긴뼈 단을 번갈아 쌓고, 칸 사이에 돌 선반(윗면 밝은 5·6 · 앞 3 · 밑 그늘 1)을 둔다. 바깥 1px 은 투명 — 둘레 벽돌이 보인다.
# 숫자 = brick 램프(카타콤 앞면 벽돌색) · 뼈 s~w. 3단(48px)·2단(32px) 두 높이 = 빌더 앞면 3h/2h.
SKULLS = {   # 5×5 해골: 앞 · 왼돌 · 오른돌 · 기운 — 빛 받는 위·왼 w, 그늘 아래·오른 t·u, 눈구멍 ;
    'f': ['.vwv.', 'vwwwu', 'w;w;u', 'vwuwt', '.utt.'],
    'l': ['.wwv.', 'wwwvu', ';w;vu', 'wuvut', '.ttt.'],
    'r': ['.vwv.', 'vwwwv', 'vw;w;', 'tvwuw', '.ttu.'],
    't': ['..vw.', '.vwwv', 'w;wwu', 'v;wut', '.vutt'],
}
BONES = {   # 긴뼈 한 개(가로로 누움, 2줄): 길이별. 양끝 마디 w/u, 몸 v/t
    12: ['wvvvvvvvvvvw', 'utttttttttts'],
    10: ['wvvvvvvvvw', 'utttttttts'],
    8: ['wvvvvvvw', 'uttttttts'[:8]],
    14: ['wvvvvvvvvvvvvw', 'uttttttttttttts'[:14]],
}
# 칸(선반 사이) 짜기: (종류, x, y) — 손으로 정한 자리. 해골 줄 칸은 해골 일곱 + 밑 긴뼈 한 단, 뼈 칸은 긴뼈 세 단 + 해골 둘.
KNOBS = [   # 뼈 마구리 줄(쌓은 넓적다리뼈 끝): 둥근 끝 2×2 를 3px 마다, 몇 곳은 엇갈림
    'wv.wv.vw.wv.wv..wv.wv.vw.wv.wv.wv..wv.vw.w',
    'ut.ut.tu.ut.ut..ut.ut.tu.ut.ut.ut..ut.tu.u',
]
OSS_ROWS = {   # (종류, ...) — 'B' 긴뼈(길이, x, y) · 'S' 해골(모양, x, y) · 'K' 마구리 줄(y). x 는 칸 안 좌표(0~41)
    'skull': [('S', 'f', 0, 1), ('S', 'l', 6, 1), ('S', 'f', 12, 1), ('S', 'r', 18, 1), ('S', 't', 24, 1), ('S', 'f', 30, 1),
              ('S', 'l', 36, 1), ('B', 14, 0, 6), ('B', 14, 14, 6), ('B', 14, 28, 6), ('K', 8)],
    'bone': [('B', 14, 0, 1), ('B', 14, 14, 1), ('B', 14, 28, 1), ('K', 3), ('B', 12, 0, 5), ('B', 14, 12, 5),
             ('B', 8, 26, 5), ('B', 8, 34, 5), ('S', 'f', 7, 5), ('S', 'r', 29, 5), ('K', 9)],
    'skull2': [('S', 'r', 1, 1), ('S', 'f', 7, 1), ('S', 't', 13, 1), ('S', 'f', 19, 1), ('S', 'l', 25, 1), ('S', 'f', 31, 1),
               ('S', 'r', 37, 1), ('B', 12, 0, 6), ('B', 14, 12, 6), ('B', 8, 26, 6), ('B', 8, 34, 6), ('K', 8)],
}


def oss_band(kind, lg):
    """선반 사이 칸 하나: 폭 42(x 3~44) × 높이 11. 뒤 = 벽돌 1(맨 윗줄 = 선반 밑 그늘 벽돌 0)."""
    # 관문 2차: 뒤 벽 그늘을 중성 검정 대신 rim(따뜻한 보라갈색) Q · P 로, 벽돌 결 반점 4 를 손으로 찍음
    cv = grid(['Q' * 42, 'P2P22P222P22P2222P222P22P2222P22P222P22P22', '2' * 42] +
              ['333433333334333343333333343333334333333433', '333333343333333333333433333333333343333333'] * 4, lg)
    for it in OSS_ROWS[kind]:
        if it[0] == 'B':
            _, n, x, y = it
            stamp(cv, BONES[n], lg, x, y)
        elif it[0] == 'K':
            stamp(cv, KNOBS, lg, 0, it[1])
        else:
            _, v, x, y = it
            stamp(cv, SKULLS[v], lg, x, y)
    return cv


def ossuary(h, bands, lg):
    """h = 2 또는 3 칸. 선반(3줄) + 칸(11줄) 반복. 양옆 문설 2px(왼 빛 3·4 · 오른 그늘 1·2), 바깥 1px 투명."""
    H = h * T
    cv = Cv(48, H)
    lip = ['.' + '6656666656666666566666666566666666656666666566' + '.', '.' + '443444444443444454444444344444444434444444445' + '3.',
           '.' + '232222222222322222222322222223222222222232222' + 'P.']   # 선반 돌: 이 빠진 자리·결(손으로 찍은 5·3)
    y = 1
    for b in bands:
        stamp(cv, lip, lg, 0, y)
        y += 3
        stamp(cv, ['.43' + '.' * 42 + '2P.'] * 11, lg, 0, y)
        cv.paste(oss_band(b, lg), 3, y)
        y += 11
    stamp(cv, lip, lg, 0, y)
    return cv




# ================================================================================================ 지하묘지 — 석관 1×2(남북) · 2×1(동서), 닫힘·열림
# 숫자 = castle 램프(성 지하 벽 앞면 돌). 뚜껑 윗면이 몸의 대부분(3/4 — 누운 상자는 윗면이 넓다), 앞면은 짧은 마구리(남북) · 긴 옆판(동서).
# A1 = 뚜껑에 검 돋을새김 + 테두리. 열림 = 뚜껑이 비스듬히 밀려 한쪽에 걸치고, 열린 틈 안에 해골·갈비.
# r1 관문: 납작한 회색 판이라 화풍 실패(색 7개·명암 3단·결 없음)·전체 인상이 서 있는 판(눈 12/12) → 관 모양(어깨 넓고 머리·발 좁은 육각) 뚜껑에
# 박공 등줄(왼 빛 5 · 등줄 6 · 오른 4)·새긴 십자, 돌 결·이 빠진 곳·이끼를 손으로 찍고, 발치 마구리만 짧은 앞면으로. 어두운 가장자리는 rim(따뜻한 갈색).
# 관문 2차: 상자 종류는 앞면 8줄 이상 — 뚜껑 21줄(관 모양) + 발치 앞면 8줄(가장자리·입술·그늘·판넬 4줄·받침)
# 관문 3차: 앞면 7줄 판정(2/4) → 뚜껑 20줄 + 발치 앞면 9줄
SARC_NS_A1 = [
    '................',
    '..666666555555..',
    '.6666N666666664.',
    '.66666666666664~',
    '.65R5553655N554~',
    '.65555536555554~',
    '.655555365555R4~',
    '.65533333335554~',
    '.65566636665554~',
    '.6R555536555554~',
    '.65555536555P54~',
    '.65555536555554~',
    '.6555N536555554~',
    '.655555365R5554~',
    '.655R5536555554~',
    '.65555536553554~',
    '.65555536555554~',
    '.644N44444444X3~',
    '.6Z4444444P4X43~',
    '.64444N44444Z43~',
    '.54444444444442~',
    '.3222222222222P~',
    '.433333R3333332~',
    '.43111111111432~',
    '.43132223222432~',
    '.431222322234N2~',
    '.4X122322232432~',
    '.43244444444432~',
    '.43333N333X3332~',
    '.2PPPPPPPPPPPPQ~',
    '..~~~~~~~~~~~~~~',
    '................',
]
# 열림: 뚜껑이 동쪽으로 3px 밀려 서쪽 틈(어두운 rim 0·1, 근흑 void 아님)에 뼈가 보인다
# 관문 3차: 틈 하나 열린 모습이 서 있는 문처럼 읽힘(독립 눈 12/12) → 뚜껑을 들어낸 돌 상자를 위에서: 테두리 · 어두운 속(rim Q·P) · 남북으로 누운 해골
SARC_NS_OPEN_A1 = [
    '................',
    '..566666666664..',
    '.65555555555544.',
    '.65Q44444444444~',
    '.65Q32333233344~',
    '.65Q32333233344~',
    '.65Q22222222244~',
    '.65QQQQQQQQQ244~',
    '.65QQP665PPP244~',
    '.65QQ6QQ54PP244~',
    '.65QQQ654QQQ244~',
    '.65QQPP5PPPP244~',
    '.65QQ65654PP244~',
    '.65QQP5P4PPP244~',
    '.65QQ6564QQQ244~',
    '.65QQPP5PPPP244~',
    '.65QQP654PPP244~',
    '.65QQP5P4PPP244~',
    '.65QQQQQQQQQ244~',
    '.55555555555555~',
    '.44444444444444~',
    '.3222222222222P~',
    '.433333R3333332~',
    '.43111111111432~',
    '.43132223222432~',
    '.431222322234N2~',
    '.4X122322232432~',
    '.43244444444432~',
    '.43333N333X3332~',
    '.2PPPPPPPPPPPPQ~',
    '..~~~~~~~~~~~~~~',
    '................',
]
# r1 관문: 결·명암·앞면 높이 부족 → 모서리 깎은 뚜껑(6줄) + 앞면 8줄(가장자리 선·그늘·판넬 셋·받침)
SARC_EW_A1 = [
    '................................',
    '...66666666666666666666666663...',
    '..65R555555265R555555N55555553.~',
    '.6555552222262222222222225R5553~',
    '.6R555566662666666666666655P5Z3~',
    '.6555N5555526555N55355555555X53~',
    '..5444444444444444444444444443.~',
    '..533333333333333333333333333P.~',
    '...11111111111111111111111111.~.',
    '...4333333R333333333333333332.~.',
    '...43111111331111113311111132.~.',
    '...43122222331222223312222X32.~.',
    '...4N444444334444443344444432.~.',
    '...4333333333333333P333333332.~.',
    '...2PPPPPPPPPPPPPPPPPPPPPPPPQ.~.',
    '................................',
]
# 열림: 뚜껑이 남쪽으로 3줄 밀려 북쪽 틈에 뼈
SARC_EW_OPEN_A1 = [
    '................................',
    '..5555555555555555555555555555..',
    '..5QQwvQQQQQQQtQQQQQQvQQQQQQQ3.~',
    '..5PPPuPPvvtPPPvvuPPPPuPtvPPP3.~',
    '...66666666666666666666666663..~',
    '..65R555555265R555555N55555553.~',
    '.6555552222262222222222225R5553~',
    '.6R555566662666666666666655P5Z3~',
    '..544N4444426444N44344444444X3.~',
    '.533333333333333333333333333333~',
    '.22222222222222222222222222222P~',
    '...11111111111111111111111111..~',
    '...43111111331111113311111132..~',
    '...43222222332222223322222232..~',
    '...43333333333333333333333332..~',
    '...2PPPPPPPPPPPPPPPPPPPPPPPPQ..~',
]


# ================================================================================================ 지하묘지 — 새긴 묘석 바닥 2×2(아래층, 불투명)
# 바닥 판석 자리에 그대로 끼우는 큰 묘석 한 장. 둘레 1px 줄눈(cata 0 — 버들항 카타콤 바닥 줄눈과 같은 짙은 회색) + 판 윗면.
# 새김 = 파인 홈(어두운 단) 아래·오른 가장자리에 밝은 단 한 줄(빛이 왼쪽 위에서 들어와 홈의 먼 벽이 밝다).
# 숫자 = cata 램프(버들항 지하묘지 바닥 판석).
# 관문 2차(중성 검은 테·평면): 테 줄눈·새김 홈을 rim P·Q(따뜻한 보라갈색)로, 결 R·N 과 이끼 X·Z 를 더 찍음.
# r1 패널 1: 무늬 없는 회색 판이라 버들항 바닥 결보다 훨씬 밋밋하고, 바깥 검은 테가 판을 바닥 위로 띄운다(2명) →
# 테는 바닥 줄눈(0, 1px)과 같게, 판 면은 버들항 카타콤 벽돌처럼 왼쪽 4 · 오른쪽 3 으로(경계는 들쭉날쭉) 나누고 잔 반점·이 빠진 모서리·금을 손으로 찍음.
SLAB_A1 = [
    'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPQ',
    'P555555555555555555555555555554Q',
    'P5444444444463333333R333323333PQ',
    'P54644R4444433N333333333333333PQ',
    'P544PPPPPPPPPPPPPPPPPPPPPPPN33PQ',
    'P544P555555555555555555555P533PQ',
    'P544P544444443333333333323P5X3PQ',
    'P544P544442443333332333333PZ33PQ',
    'P54NP5444444433PP533332333P533PQ',
    'P544P5446544433PPR33333333P533PQ',
    'P544P5R44444433PP53333N333P523PQ',
    'P544P5444R44433PP533333233P533PQ',
    'P546P54444PPPPPPPPPPPP3333P53RPQ',
    'P542P54444PPPPPPPPPPPP333RP533PQ',
    'P544P544445555555555523333P533PQ',
    'P5R4P5444644433PP533333333P533PQ',
    'P544P5444444433PP533333263P533PQ',
    'P544P54N4444N33PP533333333P53NPQ',
    'P544P5424444443PP533R33333P533PQ',
    'P544P544P444443PP533333333P533PQ',
    'P524P5444444443PP533363333P533PQ',
    'P544P54R4444443PP533335333PX33PQ',
    'P544P5444442443PP533N33333P563PQ',
    'P544P5444444443PP5333333N3P532PQ',
    'P544P544444433355332P33333P53PPQ',
    'P544P54444443R333333333333P5P3PQ',
    'P544P5PPPPPPPPPPPPPPPPPPPPP5P3PQ',
    'P544X5555555555555N55555555P33PQ',
    'P5444X4444443323333333633PP32PPQ',
    'P544444444N433233333333R3333PPPQ',
    'P4PPPPPPPPPPPPPPPPPPPPPPPPPPPPPQ',
    'QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ',
]


# ================================================================================================ 지하묘지 — 세 갈래 촛대 1×2(불꽃 3장면)
# 금 촛대(m~r): 세 발 받침(바닥 윗면 타원 + 발) · 기둥(왼 밝음 r·q · 오른 o·n) · 가지 셋 · 초 받침 접시 · 흰 초(w v u) · 촛농.
# 불꽃은 장면마다 바뀌는 덧그림(받침·초 같음). 아래 칸 = 걸음 막힘, 위 칸 = ★(사람 뒤로 지나감).
CANDLE_BASE_A1 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.wv....wv....wv.',
    '.wu....wu....wu.',
    '.vu....vu....vu.',
    '.vt....vu....vt.',
    'qpon..qpon..qpon',
    '.on....on....on.',
    '..o....qo....o..',
    '..po...qo...on..',
    '...ponqrqoopn...',
    '.....nqpon......',
    '......qo........',
    '......qo........',
    '......qo........',
    '.....rqpo.......',
    '......qo........',
    '......qo........',
    '......qo........',
    '......qo........',
    '......qo........',
    '.....rqpo.......',
    '....rqppon......',
    '...qp.qo..pn....',
    '..qo..qo...on...',
    '.qo..rqpo...on..',
    '.nm...on....nm~.',
    '..~~~~~~~~~~~~~.',
    '................',
]
CANDLE_FLAMES_A1 = [   # 장면별 불꽃 세 개(초 심지 위 0~4행) — 흔들림이 서로 어긋나게
    ['................', '.K.....L......K.', '.KJ...KL.....LK.', '.JH....JH....JH.', '.H.....H......H.'],
    ['................', '..L....K.....K..', '.LK....LK....KL.', '.JH...JH.....JH.', '..H....H.....H..'],
    ['................', '.K......L....L..', '.KL...LK......K.', '.HJ....JH....HJ.', '.H......H....H..'],
]


# ================================================================================================ 성 — 옥좌와 단 3×3
# 단 = castle 돌(숫자): 윗면 넓게(13~35행) + 앞 두 계단(디딤 윗면 밝음 · 챌판 어두움). 가운데로 붉은 양탄자(S~W, 금 테 p)가
# 단 윗면에서 계단을 타고 내려온다. 옥좌 = 금 틀(m~r, 빛 받는 왼·위 r) + 붉은 벨벳 등받이 · 방석, 머리 장식 구슬 둘, 가운데 금 문장.
DAIS_TOP = [   # 단 윗면 판석 결(46폭, 6줄 주기): 줄눈 3 · 엇갈린 세로 줄눈 · 잔 반점 4·6 — 버들항 성 바닥과 같은 판석 결
    '5555555535555556555555555355555555555565555553',
    '5565555535555555555545555355555555555555555553',
    '5555555535555555555555555355554555555555555553',
    '5555455535555555556555555355555555555555556553',
    '3333333333333333333333333333333333333333333333',
    '5555555555555355555555555555555535555555555555',
    '5555565555555355555555455555555535555555555555',
    '5555555555555355555555555555555535555565555555',
    '5555555545555355565555555555555535555555555555',
    '3333333333333333333333333333333333333333333333',
]


def dais(top_rows, edge='4', carpet_from=18):
    """단 3×3 바탕(48×48): 위 12줄 투명 · 윗면 13~35행(판석 결, 왼 모서리 6 · 오른 4) · 앞 두 계단. 양탄자는 carpet_from 행부터 단 끝까지 + 계단."""
    rows = ['.' * 48] * 12 + ['.' + '6' * 46 + '.']
    for y in range(13, 36):
        body = top_rows[(y - 13) % len(top_rows)]
        if y >= carpet_from:
            body = body[:15] + 'p' + ('VV' if y == carpet_from else 'VU') + 'U' * 11 + 'T' + 'p' + body[31:]
        rows.append('6' + body + edge)
    car = lambda a, b, c: 'p' + a + b * 12 + c + 'p'   # noqa: E731  양탄자 16폭(윗면과 같은 16~31열)
    rows += [
        '4' * 16 + car('U', 'U', 'T') + '4' * 15 + '3',
        '3' * 16 + car('T', 'T', 'S') + '3' * 15 + '2',
        '2' * 16 + car('T', 'T', 'S') + '2' * 15 + '1',
        '.6' + '5' * 14 + car('V', 'U', 'T') + '5' * 14 + '4.',
        '.4' + '4' * 14 + car('U', 'U', 'T') + '4' * 14 + '3.',
        '.3' + '3' * 14 + car('T', 'T', 'S') + '3' * 14 + '2.',
        '.2' + '2' * 14 + car('T', 'T', 'S') + '2' * 14 + '1.',
        '..6' + '5' * 13 + car('V', 'U', 'T') + '5' * 13 + '4..',
        '..4' + '4' * 13 + car('U', 'U', 'T') + '4' * 13 + '3..',
        '..2' + '2' * 13 + car('T', 'T', 'S') + '2' * 13 + '1..',
        '..1' + '1' * 13 + 'o' + 'S' * 14 + 'o' + '1' * 13 + '0~.',
        '...' + '~' * 45,
    ]
    return rows


# 관문 2차(명암 3단·평면): 단 윗면에 반점 4·6·3·R 을 손으로, 단 위 양탄자에 결(T·V)을 엇갈려 찍음.
# r1 관문: 단 윗면이 벽돌 벽처럼 읽히고(윗면 없음 4/4) 가장자리가 중성 회색 → 단을 따뜻한 대리석 판석(윗면 5 · 줄눈 4 · 앞 가장자리 4 · 계단 디딤 5 · 챌면 2·1 · 가장자리 rim P·Q)으로
DAIS_A1 = [
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '.6666666666666666666666666666666666666666666666.',
    '66656666665646656666665646656666665636656666665P',
    '665555R55554465555R55554465555R55554465555R5555P',
    '66545555654446545555654436545555654446545555654P',
    '665R556555R44655556555R44655556555R44655R56555RP',
    '665R55554554365R55554554465R55554554465R5555455P',
    '66555455545446555455555446555455555436555455555P',
    '65455555444345455555444345455555444345455555444P',
    '64443444434444344443444434444344443444434444344P',
    '66665646656666665636656666665646656666665646656P',
    '655554465555R55554465555R55554465555R5555436555P',
    '65654436545555654446545555654446545555654446545P',
    '6555R44655556555R44655556555R43655556555R446555P',
    '654554R65R55554554465R55554554465R55554554465R5P',
    '655554465554555554365R5455555446555455555446555P',
    '65444345455555444345455555444345455555444335R55P',
    '6344443444434444pVUTUTUTUTUTUTSp444434444344443P',
    '6665666666564665pVTUTUTUTUTUTUSp665646656666665P',
    '665555R555544R55pVUTUTUTUTUTUTSp5554464555R5555P',
    '6654555565444654pVTUTUTUTUTUTUSp654446545555654P',
    '66R5556555R43655pVUTUTUTUTUTUTSp55R44655556555RP',
    '665R55554554465RpVTUTUTUTUTUTUSp4554365R55R5455P',
    '6655545555544655pVUTUTUTUTUTUTSp555446555455555P',
    '6545555544434545pVTUTUTUTUTUTUSp444345455555444P',
    '4444444444443444pUSUTUTUTUTUTUTp444444444444444P',
    '2222222232222222pTUTUTUTUTUTUTSp22R222R22222222P',
    '1111111111111111pUTUTUTUTUTUTUSp111111111111111Q',
    '.6554R5555R55555pTUTUTUTSTUTUTUp555545553555653.',
    '.443444444444444pUTUTUTUTUTUTUTp44444444444344P.',
    '.222222222222222pTUTUTUTUTUTUTSp22222222222222P.',
    '.111111111111111pUTUTUTUTUTUTUSp11111111111111Q.',
    '..65555R65555545pTUTSTUTUTUTUSUp55455R55R55553..',
    '..44442444444444pUTSTUTUTUTUTUTp4444444442444P..',
    '..22222222222222pTUTUTUTUTUTUTSp2222222222222P..',
    '..PPPPPPPPPPPPPPoSSSSSSSSSSSSSSoPPPPPPPPPPPPPQ~.',
    '...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]
THRONE_A1 = [
    '...r..............n...',
    '..rrp............pon..',
    '..rqp.rrrrrrrrqq.nom..',
    '..rrrrrqqqqqqqppppqn..',
    '..rrWWWWWWWWWWWWWTon..',
    '..rrWWTVVVTVVVTVTUon..',
    '..rrWVVTUTUTUTUTTTon..',
    '..rrWVVUTUrqTUTUTTon..',
    '..rrWVVVUrqpoTUVTTon..',
    '..rqWVVUSqrqoUTUSTon..',
    '..rrWVVTUTUTUTUTTTon..',
    '..rqVUSTTTSTTTSTSSon..',
    'rrrqSSSSSSSSSSSSSSonnm',
    'rrrqWVVVVVVVVVVVVUonnm',
    'rrrqVVVTVVVVUVVVVTonnm',
    'rqppVUTUTUTUTUTUTTonnm',
    'rqppVTUSUTUTUSUTTTonnm',
    'rqppTUTUTUTUTUTTTTonnm',
    'rqppUTTTTTTTTTTSSSonnm',
    'rqpprrrqqqqqqqpppoonmm',
    'qpoorqpooooooonnnnmmmm',
    'pponpponnnnnnnmmmmmmmm',
    'oonmpnmmmmmmmmmmmmmmmm',
    '.pn..................n',
    '.pn................mm.',
    '.on................mm.',
    '.nm~...............mm~',
    '..~~................~~',
]


# ================================================================================================ 성 — 왕실 양탄자(덧그림, 바닥 위 두 번째 바닥층, 걸음)
# 세로 한 줄 폭 1칸(12px) · 3칸(44px). 위 끝(술) · 가운데(16px 주기로 이어짐) · 아래 끝(술). 금 테(p 바깥 · q 안쪽 줄) + 붉은 바탕(U, 밝은 결 V, 그늘 T)
# + 가운데 금 마름모. 바닥에 납작하게 깔린 면이라 명암은 결 정도만 — 왼 테가 조금 밝다.
RUN1_MID_A1 = [
    '..qpTUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUqUUTpo..',
    '..qpUUUqrpUTpo..',
    '..qpUUqrUUpTpo..',
    '..qpUUUqVpUTpo..',
    '..qpUUUUpUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUVUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
]
RUN1_TOP_A1 = [
    '................',
    '..q.p.q.p.q.p...',
    '..q.p.q.p.q.p...',
    '..qqqqqqqqqqpo..',
    '..qpppppppppoo..',
    '..qpTTTTTTTTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUVUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpTTTTTTTTpo..',
    '..qpTUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
]
RUN1_BOT_A1 = [
    '..qpTUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpUUUUqUUTpo..',
    '..qpUUUqrpUTpo..',
    '..qpUUqrUUpTpo..',
    '..qpUUUqVpUTpo..',
    '..qpUUUUpUUTpo..',
    '..qpUUUUUUUTpo..',
    '..qpTTTTTTTTpo..',
    '..qppppppppppo..',
    '..oooooooooooo..',
    '..q.p.q.p.q.p...',
    '..q.p.q.p.q.p...',
    '...~.~.~.~.~.~..',
]


def run3(mid_kind):
    """3칸 폭 양탄자 한 줄(48×16): 왼 끝 칸 2열부터 오른 끝 칸 13열까지 44px. mid_kind = 'top' · 'mid' · 'bot'."""
    if mid_kind == 'mid':
        core = [
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUqUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUqrpUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUqrUUpUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUqrUVUUpUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUqUUUpUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUqUpUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUpUUUUUUUUUUUUUUUUUUT',
            'UUUUUVUUUUUUUUUUUUUUUUUUUUUUUUUVUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
            'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUT',
        ]
        return ['..qpq' + c + 'opo..' for c in core]
    band = '..q' + 'p' * 42 + 'o..'
    edge = '..q' + 'q' * 41 + 'po..'
    fringe = '..' + 'q.p.' * 11 + '..'
    if mid_kind == 'top':
        body = ['..qpq' + 'T' * 37 + 'Topo..'] + ['..qpq' + 'U' * 37 + 'Topo..'] * 9
        return ['.' * 48, fringe, fringe, edge, band, '..qpq' + 'q' * 37 + 'qopo..'] + body
    body = ['..qpq' + 'U' * 37 + 'Topo..'] * 10
    return body + ['..qpq' + 'q' * 37 + 'qopo..', band, '..' + 'o' * 44 + '..', fringe, fringe, '...' + '~.' * 22 + '.']


# ================================================================================================ 성 — 왕실 깃발 1×2(벽 걸이)
# 벽 앞면에 박은 쇠 막대(양끝 금 구슬) + 붉은 천(주름 = 세로 밝은 V · 그늘 T 줄) + 금 테 + 금 왕관 문장 + 제비꼬리 끝.
# 교단 깃발(버들항 aqueduct-sewer banner-cult: 붉은 바탕 금 마름모)과 달리 왕관 · 위아래 금 띠 · 갈라진 끝.
BANNER_A1 = [
    '................',
    '................',
    '.r............o.',
    'rqkkkkkkkkkkkkpo',
    '.pjhhhhhhhhhhgo.',
    '..qqqqqqqqqqqp..',
    '..qpppppppppoo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUqVqUqVUTo..',
    '..qVUqrqpqVUTo..',
    '..qVUrqqqpVUTo..',
    '..qVUqqqqpVUTo..',
    '..qVUppppoVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qqqqqqqqqqqp..',
    '..qpppppppppoo..',
    '..qVUUVUUUVUTo..',
    '..qVUUVUUUVUTo..',
    '..qVUUV..UVUTo..',
    '..qVUUV..UVUTo..',
    '..qVUT....VUTo..',
    '..qUT......UTo..',
    '..qT........To..',
    '..o..........n..',
]


# ================================================================================================ 성 — 갑옷 거치대 1×2
# 판금 갑옷(쇠 g~l, 빛 받는 왼·위 l): 투구(얼굴 가리개 틈 ;) · 어깨받이 둘 · 가슴판(가운데 능선) · 허리 띠 · 치마 판.
# 정강이받이까지 갖춘 사람 키(26px) 갑옷이 나무 받침(윗면 보임)에 선다. 붉은 깃 장식 하나(눈이 갈 곳), 금 허리 고리.
ARMOR_A1 = [
    '.......VT.......',
    '......VUT.......',
    '......VT........',
    '.....lkkjh......',
    '....lkkkjjh.....',
    '....lkkkjih.....',
    '....l;;;;;h.....',
    '....lkjjjih.....',
    '.....kjiih......',
    '..lllkkjjhiihh..',
    '.lkkkllkkjhjihg.',
    '.lkjhllkkjhhihg.',
    '.kjhglkkkjhghhg.',
    '.jhg.lkkkjih.hg.',
    '.....lkkkjih....',
    '.....lkkljih....',
    '.....hjkkjhh....',
    '.....dcpqcba....',
    '.....lkkjjih....',
    '....lkkjhjjih...',
    '....kjhh.hjhg...',
    '.....lkj.lih....',
    '.....lkj.kih....',
    '.....lkj.kih....',
    '.....kjh.jhg....',
    '....lkjh.kjhg...',
    '...effffeeeeed..',
    '..feeeeeeeeeddc.',
    '..dddddddddccbb.',
    '...cbbbbbbbbba~~',
    '....~~~~~~~~~~~~',
    '................',
]


# ================================================================================================ 성 — 내리닫이 쇠창살문 3×2(닫힘 · 올림)
# 벽 앞면 두 단 자리에 끼우는 문틀(castle 돌 숫자): 양 기둥 8px(돌 덩이 셋, 왼 모서리 밝음) + 상인방(아치 돌 · 쐐기돌) + 문턱.
# 안쪽 = 북쪽으로 이어지는 어두운 통로(void) + 바닥 띠. 닫힘 = 쇠 격자(세로 살 5px 마다 · 가로 띠 둘 · 아래 뾰족 끝),
# 올림 = 격자가 상인방 속으로 올라가 뾰족 끝 줄만 보이고 통로가 열린다. 두 상태 틀·문턱 화소 같음.
GATE_LINTEL_A1 = [   # 상인방 4줄(48): 큰 돌 셋 + 가운데 쐐기돌(빛 6 · 그늘 3)
    '666666666666666666666666666666666666666666666665',
    '655555555553333333365444333333333355555555555554',
    '644444444432222222254443222222222234444444444443',
    '333333333321111111143332111111111123333333333332',
]
GATE_PIER_A1 = [   # 기둥 10폭(왼): 돌 덩이 셋(5줄 · 6줄 · 6줄) + 문설 안쪽 그늘(32 21). 오른 기둥은 덩이 명암을 맞춰 따로 적는다
    '6555553322', '6555553321', '6555553321', '6444443321', '3333333321',
    '6555553321', '6555553321', '6555553321', '6555553321', '6444443321', '3333333321',
    '6555553321', '6555553321', '6555553321', '6555553321', '6444443321', '3333333321',
    '6555553321', '6555553321', '6555553321', '6555553322', '6444443322', '3333333322',
    '6555553333', '6555553333', '6444443333', '3333333333', '1111111111',
]
GATE_PIER_R_A1 = [
    '2233555554', '1233555554', '1233555554', '1233444443', '1233333332',
    '1235555554', '1235555554', '1235555554', '1235555554', '1234444443', '1233333332',
    '1233555554', '1233555554', '1233555554', '1233555554', '1233444443', '1233333332',
    '1233555554', '1233555554', '1233555554', '2233555554', '2233444443', '2233333332',
    '3333555554', '3333555554', '3333444443', '3333333332', '1111111110',
]
GATE_IN_A1 = (   # 문 안 28폭 × 26줄: 통로 어둠(void 0→1→2 로 멀어질수록 밝아지는 게 아니라 가까울수록 바닥이 보임) + 바닥 띠 + 문턱
    [';' * 28] * 10 + [':' + ';' * 26 + ':'] + [':' * 28] * 3 + [',' * 28] * 3 +
    ['1' * 28, '2' * 28, '2' * 28, '2222322222222222222223222222', '3333333333323333333333333333',
     '3' * 28, '4' * 28, '4' * 28, '5' * 28, '6' * 28, '1' * 28]
)
# r1 패널 1: 밝은 회색 문틀이 어두운 성 벽 앞면 위에서 따로 논다(2명) → 앞면 몸 색(castle 1)보다 한두 단만 밝게:
# 덩이 5·4 → 2, 윗변 빛 6 → 3, 줄눈 3 → 1, 문설 그늘 2·1 → 1·0. 성 앞면과 같은 녹회색 계열의 다듬은 돌로 읽힌다.
_DIM = str.maketrans('654321', '322110')
GATE_FRAME_A1 = ([r.translate(_DIM) for r in GATE_LINTEL_A1] +
                 [a.translate(_DIM) + b + c.translate(_DIM) for a, b, c in zip(GATE_PIER_A1, GATE_IN_A1, GATE_PIER_R_A1)])
GATE_GRID_A1 = [   # 문 안쪽(10~37열, 6~28행)에 얹는 쇠 격자 — 28×23
    'jhhjhhjhhjhhjhhjhhjhhjhhjhhj',
    'lkhlkhlkhlkhlkhlkhlkhlkhlkhl',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'llkllkllkllkllkllkllkllkllkl',
    'jhhjhhjhhjhhjhhjhhjhhjhhjhhj',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'llkllkllkllkllkllkllkllkllkl',
    'jhhjhhjhhjhhjhhjhhjhhjhhjhhj',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kj.kj.kj.kj.kj.kj.kj.kj.kj.k',
    'kh.kh.kh.kh.kh.kh.kh.kh.kh.k',
    'j..j..j..j..j..j..j..j..j..j',
    'h..h..h..h..h..h..h..h..h..h',
]

# 관문 2차: 문틀 돌 3단 명암·중성 검은 테·밝은 통로 바닥이 평면(4/4) → 문틀을 다듬은 돌 덩이로 다시 쌓는다(덩이마다 위·왼 4 · 몸 3 · 아래·오른 2,
# 이음 모서리 rim P), 상인방 윗면 6 · 쐐기돌 5·4, 손으로 찍은 반점 5·2·R. 문 안은 rim 0 어둠 → crock 1·3 통로 바닥 → 문턱 4·2.
GATE_L = leg(stone='castle', P=('rim', 1), Q=('rim', 0), R=('rim', 4), I=('crock', 1), N=('crock', 3))
# 관문 3차: 오른쪽 바깥 열이 중성 회색 2 라 '근흑 윤곽 82%' → 바깥 열을 rim P(따뜻한 갈색)로
GATE_FRAME2_A1 = [
    '66666666666665666666666666665666666566666666666P',
    '4445443333332444233246555552444R332444444333533P',
    '433333333R3324333332444444424333332433333233333P',
    '222222222222P222222P233333PP222222P222222222222P',
    '655555555244P4446QQQQQQQQQQQQQQ2P3333P655555555P',
    '4444333332P446QQQQQQQQQQQQQQQQQQQQ2P33444433333P',
    '43R333333246QQQQQQQQQQQQQQQQQQQQQQQQ23431533333P',
    '43333323326QQQQQQQQQQQQQQQQQQQQQQQQQQ24343333R3P',
    '222222222PQPQQQQQQQQQQQQQQQQQQQQQQQQQP222222222P',
    '6552655552QPQQQQQQQQQQQQQQQQQQQQQQQQQP655265555P',
    '4332443332QPQQQPQQQQQQQQQQQQQQQQQQQQQP433244333P',
    '4322433332QPQQQQQQQQQQQQQQQQQQQQQQQQQP433243312P',
    '4332433532QPQQQQQQQQQQQQQQQPQQQQQQQQQP43R243343P',
    '4332433332QPQQQQQQPQQIQQQQQQQQQIQQQQQP433243333P',
    '222P22222PQPQQQIQQQQQQQQQQQQQQIQQQQIQP222P22222P',
    '6555555552QPIQQQQQIIQQQQQIQQQQQQPQQQQP655555555P',
    '4444333332QPQQQQQQIQPIQQQQQIIQQQQIQQQP444433333P',
    '4333533332QPQIIQQQQQQQIQIQQQQQQQQIIQQP431332333P',
    '43331333R2QPQQQQIQIIQQQQQQQIQIPQQIQQQP434333333P',
    '4333433332QPIPQQQQQIQQIIQIQQQQQIQQQIQP453333333P',
    '222222222PQPQQIIQIQQQIQQPIIQQIQQIIQQQP222222222P',
    '6555265552QPIQQIQQIIQQIQIQQIIQQIQQIQQP655526555P',
    '4433244332QPQQQQQQQQQQQQQQQQQQQQQQQQQP443324433P',
    '4R33243332QPIIIIIIQIIIIIIQIIIIIIQIIIQP433354333P',
    '4333243232QPIQIIIIIIQIIIIIIQIIIIIIQIQP431324333P',
    '4333243332QPNNNQNNNNNNQNNNNNNQNNNNNNQP4343243R3P',
    '2222P2222PQPNNNNNINNNNNNINNNNNNINNNNQP2222P2222P',
    '6555555552QPI111111I111111I111111I11QP655555555P',
    '4442333332QP22I222222I222222I222222IQP444433333P',
    '433333R3323544444444444444444444444443433333533P',
    '222222222P2222222222222222222222222222222222222P',
    'QPPPPPPPPPPQPPPPPPPPPPQPPPPPPPPPPQPPPPPPPPPPQPPQ',
]


GATE_SPAN_A1 = {4: (17, 30), 5: (14, 33), 6: (12, 35), 7: (11, 36)}   # 아치 머리 줄마다 통로 폭(그 아래 8~28행 = 11~36열)


def portcullis(open_):
    """패널 3: 통로는 어둠(rim 0) + 앞으로 밝아지는 바닥, 머리는 아치(이맛돌). 쇠 격자는 아치 안에서만 보인다. 올림 = 이빨 줄만."""
    fr = [list(r) for r in GATE_FRAME2_A1]
    rows = GATE_GRID_A1[-4:] if open_ else GATE_GRID_A1[:-3] + GATE_GRID_A1[8:11] + GATE_GRID_A1[-3:]
    for dy, row in enumerate(rows):
        y = 4 + dy
        a, b = GATE_SPAN_A1.get(y, (11, 36))
        for dx, c in enumerate(row):
            if c != '.' and a <= 10 + dx <= b:
                fr[y][10 + dx] = c
    return grid([''.join(r) for r in fr], GATE_L)


# ================================================================================================ 유적 — 풀·뿌리가 뚫고 나온 판석(덧그림 2×2, 바닥 위 두 번째 바닥층, 걸음)
# 버들항 신전 폐허 바닥(floor-ruin) 위에 얹는다 — 판석 결은 버들항 그대로, 이 조각은 그 위의 풀·뿌리·깨진 자리만.
# 숫자 '1'~'5' = grass 램프(버들항 신전 풀 바닥 색) · 뿌리 = 나무(a~f, 위 밝음 e · 그늘 b) · 깨진 판 가장자리 그늘 = rim 0(z)·~.
# 판석 줄눈(가로 7·23행, 세로 7·15·23·31열 언저리)을 따라 풀이 솟고, 왼쪽 위 판 한 장은 깨져 풀밭이 드러난다.
OVERGROWN_A1 = [
    '.....2323..............2323.....',
    '................................',
    '................................',
    '......3323.3....................',
    '.....2323423z...................',
    '...3.32322323z..........3.3.....',
    '....223423332z.........232......',
    '.....32232343z..................',
    '......232332322z................',
    '.....3232233232z~...............',
    '...3.23432232323z~.3.3....ddd...',
    '....3323223234233z.232..ddb~c...',
    '.....2323222323zz~......b~~.b~..',
    '.....z3232323zz~................',
    '......zz2332z~..................',
    '.......zzzz~....................',
    '................................',
    '................................',
    '......3.3.......................',
    '.....2323.......................',
    '.......ddd......................',
    '......db~cdd....................',
    '.....b~....bdd....3.3...........',
    '.....~......~cdd.232.....dd.....',
    '...............bdd.....ddb~cd...',
    '................~~bddddb~~..~b..',
    '..............3.3..~~~~~.....~~.',
    '.............232.............3.3',
    '............................232.',
    '................................',
    '................................',
    '......3.3...............3.3.....',
]
GRASS_LEG = leg(**{str(i + 1): ('grass', i) for i in range(5)}, z=('rim', 0), y=('rim', 1))   # z·y = 갈라진 판석 금(패널 3)


# ================================================================================================ 유적 — 무너진 돌무더기 2×2
# 다듬은 대리석 덩이(숫자 = marble 램프: 윗면 5·6 · 앞면 3·4 · 그늘 옆 2 · 밑 1)가 엇갈려 쌓이고, 앞에 잔 조각, 틈에 이끼(A~E).
# 덩이마다 윗면이 보인다(3/4). 버들항 신전 폐허 부스러기(rubble-temple)·쓰러진 기둥과 같은 돌빛.
# 관문 보류 → Argon 판정 실패(덩이 일곱이 같은 틀 · 오른쪽 2px 옆면) → 서로 다른 조각으로 다시: 누운 기둥 토막(동서로 세로 홈 결) ·
# 모서리 깨진 큰 덩이 · 들쭉날쭉한 판석 조각 · 잔 조각 둘. 오른쪽 옆면 없이 앞면 안에서만 그늘.
RUBBLE_A1 = [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......4555N5666665655N66665....',
    '......5N666666656666666566665N..',
    '.....56556N5555556555555N55556..',
    '.....6N5544444N44444444N444445N.',
    '.....5544NN4444444N44444444N4444',
    '.....5434444N4444R44444444444444',
    '.....43333333333333333M333333333',
    '.....4323333R333333333333333M332',
    '......32222222222222222222222221',
    '.......11Q111111CB111111111111QQ',
    '..456666655......BC.............',
    '.4566N66665....D................',
    '.45666665N64..DC...4566665N5....',
    '.4566656666N4.....456N666666555.',
    '.456N666566664...4566666N66656N4',
    '.4444N444444N4..4555556555N56664',
    '.3333333R333332..444444N44444444',
    '.3M3333333333M2..3333R333333M333',
    '.33333M33333332..33333333333333M',
    '.3333333333R332..3M3333333R33333',
    '.22222222222222.4562222222222222',
    '.1111111111111Q.45N66111111111Q.',
    '..~~~~~QQ~~~~~~.4555642.N5......',
    '.......45N4.....3333321.4442....',
    '......45662...~.2222221.3321....',
    '......33331.....~~~~~~~..~~~....',
    '......~~~~~.....................',
]
# r1 관문: 색이 적고(10) 결이 없으며 가장 어두운 테가 중성 회색(대리석 0) → A1 은 RUIN_L: 가장 어두운 단을 rim 1(따뜻한 갈색)로,
# 윗면 반점 N(대리석 4)·앞면 결 R·M(rim 4·2)·밑 Q(rim 0)를 손으로 찍음.
RUIN_L = leg(**{'6': ('marble', 6), '5': ('marble', 5), '4': ('marble', 3), '3': ('marble', 2), '2': ('marble', 1), '1': ('rim', 1),
                'N': ('marble', 4), 'R': ('rim', 4), 'M': ('rim', 2), 'Q': ('rim', 0)})
# 무더기 범례: 윗면(6·5)은 밝게 두고 앞면·그늘(4 3 2 1)을 한 단씩 내려 밝은 폐허 바닥 위에서 덩이가 묻히지 않게 한다.
RUBBLE_LEG = leg(**{'6': ('marble', 6), '5': ('marble', 5), '4': ('marble', 3), '3': ('marble', 2), '2': ('marble', 1),
                    '1': ('marble', 0)})


# ================================================================================================ 유적 — 이끼 덮인 쓰러진 석상 머리 2×2
# 목에서 부러져 땅에 놓인 거대한 대리석 머리(정면, 살짝 기울어짐): 정수리 윗면에 이끼 덮개(E·Y 밝음 · C·B 그늘) · 감은 눈 · 콧날 ·
# 입술 · 수염 결 · 이마의 금(어두운 1·0). 빛은 왼쪽 위 — 얼굴 왼쪽 6·5, 오른 볼 3·2, 턱 밑 1. 땅에 닿는 곳은 묻혀 그림자.
HEAD_A1 = [
    '................................',
    '................................',
    '..........YYEYYEY...............',
    '.......YYEEDEEYEEDEY............',
    '.....YEEDDCDDEDDCDDEDY..........',
    '....YEDDCCBCDDCCBCCDDE5.........',
    '...6EDCCB665555CBBCCD544........',
    '...6EDC66665555555CD54444.......',
    '..666D6666555565554C44443.......',
    '..6666N665N55555555M4R4443......',
    '..6E66655552115555554444432.....',
    '..6EE6511111155511111444432.....',
    '..6ED512222115551222213M432.....',
    '..6DC5555555555515544444432.....',
    '..665555E5555555155544444432....',
    '..66555555555551115444R44432....',
    '..665555555N55111115444444432...',
    '..6655555555511111114444M4332...',
    '..66555N55555N555554R44443322...',
    '..66555551111111111114444432....',
    '...65555523222222232144M4332....',
    '...D555555111111111144443322....',
    '...DC5545R54545454543433332.~...',
    '...CDD545454545M5454343332~~....',
    '....CB54454545454543433322~~....',
    '.....BC44444R4444444333321~~....',
    '......BCQ4444444443333221~~.....',
    '.......~~22222222222221~~~......',
    '........~~~~~~~~~~~~~~~~~.......',
    '................................',
    '................................',
    '................................',
]


# ================================================================================================ A2 후보들
# ---- 선로 A2: 좁은 침목(2px)을 4px 마다 촘촘히 + 레일 윗면 밝은 줄(l) — 갱도용 협궤. 굽이·끝은 A1 자리를 짙은 나무·쇠판으로.
RAIL_A2 = {
    'H': [
        '................',
        '................',
        '................',
        '................',
        '.dc..dc..dc..dc.',
        'llllllllllllllll',
        'hhhhhhhhhhhhhhhh',
        '.cb..cb..cb..cb.',
        '.cb..cb..cb..cb.',
        '.cb..cb..cb..cb.',
        '.cb..cb..cb..cb.',
        'llllllllllllllll',
        'hhhhhhhhhhhhhhhh',
        '.ba..ba..ba..ba.',
        '..~..~...~...~..',
        '................',
    ],
    'V': [
        '...lh......lh...',
        '..dlhddddddlhc..',
        '..blhbbbbbblha..',
        '..~lh~~~~~~lh~..',
        '...lh......lh...',
        '..dlhddddddlhc..',
        '..blhbbbbbblha..',
        '..~lh~~~~~~lh~..',
        '...lh......lh...',
        '..dlhddddddlhc..',
        '..blhbbbbbblha..',
        '..~lh~~~~~~lh~..',
        '...lh......lh...',
        '..dlhddddddlhc..',
        '..blhbbbbbblha..',
        '..~lh~~~~~~lh~..',
    ],
}
_DARK_TIE = str.maketrans({'e': 'd', 'd': 'c', 'c': 'b', 'b': 'a'})
_RAIL2 = str.maketrans({'k': 'l', 'g': 'h'})
# r1 패널 1: 굽이 밑 침목이 없다·갈래가 엉킨다(4명 중 3명) → A2 굽이는 침목을 부채꼴 넷(곧은 칸과 같은 자리에서 이어짐)으로 다시 적고,
# 갈래는 굽이 둘을 겹치지 않고 곧은 칸 + 짧은 곁가지(레일이 바깥 레일에 닿아 멈춤), 십자는 두 곧은 칸을 겹쳐 가로 레일을 위로 한다.
TIE_A2 = {
    'SE': [
        '................',
        '................',
        '................',
        '................',
        '.............dc.',
        '.............cb.',
        '.....dd......cb.',
        '.....bdd.....cb.',
        '......bdd....cb.',
        '.......bdd...cb.',
        '...dd...bdd..cb.',
        '...bbdd..bdd.cb.',
        '.....bbdd.bddcb.',
        '..dddddddddddc..',
        '..bbbbbbbbbbba..',
        '..~~~~~~~~~~~~..',
    ],
    'SW': [
        '................',
        '................',
        '................',
        '................',
        '.cd.............',
        '.bc.............',
        '.bc......dd.....',
        '.bc.....ddb.....',
        '.bc....ddb......',
        '.bc...ddb.......',
        '.bc..ddb...dd...',
        '.bc.ddb..ddbb...',
        '.bcddb.ddbb.....',
        '..cddddddddddd..',
        '..abbbbbbbbbbb..',
        '..~~~~~~~~~~~~..',
    ],
    'NE': [
        '................',
        '..dddddddddddc..',
        '..bbbbbbbbbbba..',
        '..~~~~~~~~~~~~..',
        '...........ddc..',
        '..........ddbb..',
        '.........ddb.cb.',
        '........ddb..cb.',
        '.......ddb...cb.',
        '......ddb...dcb.',
        '.....ddb...ddcb.',
        '....bbb...ddbcb.',
        '..........bb.cb.',
        '.............ba.',
        '.............~~.',
        '................',
    ],
    'NW': [
        '................',
        '..cddddddddddd..',
        '..abbbbbbbbbbb..',
        '..~~~~~~~~~~~~..',
        '..cdd...........',
        '..bbdd..........',
        '.bc.bdd.........',
        '.bc..bdd........',
        '.bc...bdd.......',
        '.bcd...bdd......',
        '.bcdd...bdd.....',
        '.bcbdd...bbb....',
        '.bc.bb..........',
        '.ab.............',
        '.~~.............',
        '................',
    ],
}
RL_A2 = {k: [r.translate(_RAIL2) for r in v] for k, v in RL_A1.items()}
END_A2 = {k: [r.translate(_RAIL2) for r in v] for k, v in END_A1.items()}

# ---- 갱목 A2: 껍질 붙은 통나무 — 둥근 명암(위·왼 e · 가운데 d · 아래·오른 b), 껍질 결(c 점·줄), 이음에 쇠 대신 밧줄 감기(뼈색 w v u).
LOG_H = [   # 가로 통나무 들보 한 마디(16폭) — 세 번 이어 붙이고 양끝은 둥글게 깎는다
    'eeeeeeeeeeeeeeee',
    'eedeeeeeedeeeeee',
    'dddcddddddddcddd',
    'ddcdddddcddddddd',
    'cccbccccccbccccc',
    'bbbbabbbbbbbbabb',
]
LOG_V = ['eddcdb', 'edcddb', 'eddcdb', 'edddcb', 'edcdcb', 'eddcdb', 'eddccb', 'edcddb']   # 세로 통나무 기둥 결(8줄 주기)
ROPE = ['wvvvvu', 'uttvtt', 'wvvvvu', 'uttvtt']   # 기둥 머리 밧줄 감기


def log_frame():
    cv = Cv(48, 32)
    lin = [(r * 3)[1:47] for r in LOG_H]
    lin[0] = '.' + lin[0][1:-1] + '.'
    lin[-1] = '.' + lin[-1][1:-1] + '.'
    stamp(cv, lin, LEG, 1, 0)
    stamp(cv, ['..' + '~' * 44], LEG, 1, 6)
    for x in (2, 40):
        stamp(cv, [LOG_V[y % 8] for y in range(6, 30)], LEG, x, 6)
        stamp(cv, ROPE, LEG, x, 7)
        stamp(cv, ['dcbba~', '.~~~~~'], LEG, x, 30)
        stamp(cv, ['~'] * 22, LEG, x + 6, 8)
    for k in range(6):   # 가새(지름 2px 통나무 빗장)
        stamp(cv, ['edc'], LEG, 8 + k, 12 - k)
        stamp(cv, ['cde'[::-1]], LEG, 37 - k, 12 - k)
    return cv


POST_A2 = [
    '................',
    '................',
    '................',
    '....effffffe....',
    '....fedddddf....',
    '....fdecceef....',
    '....feddddee....',
    '....effffffd....',
    '....fedcdcdb~...',
    '....fedcddcb~...',
    '....fdecdccb~...',
    '....fedcdcdb~...',
    '....lkkkkkjj~...',
    '....kjjjjjii~...',
    '....fedcdccb~...',
    '....fedccdcb~...',
    '....fdecdcdb....',
    '....fedcdbcb....',
    '....fedbacdb....',
    '....fedcdcdb....',
    '....fdecdccb....',
    '....fedcdcdb....',
    '....fedccdcb....',
    '....fdecdcdb....',
    '....fedcdcbb....',
    '....fedcdcdb....',
    '...cfedcddcba...',
    '..cdeddcdcdcba..',
    '...bccbbbbbaa~~.',
    '....~~~~~~~~~~..',
    '................',
    '................',
]

# ---- 광맥 A2: 주머니 없이 앞면을 가로지르는 흰 석영 줄기(Q·P) 여럿, 줄기 위에 금 알갱이(q r)가 점점이 — 얇은 결 광맥.
VEIN2_A2 = [
    '................................',
    '................................',
    '.....P..........................',
    '......P.............P...........',
    '......QP...........PQ...........',
    '.......QP.........PQ............',
    '........QPrP.....PQ.............',
    '.........QqoP...PQ..............',
    '.........PQQPPPQQ...............',
    '..........P0QQQ0P...............',
    '...........PQrQP................',
    '...........PqoQP................',
    '............PQQQP...............',
    '.............P0QQP...PP.........',
    '..............PQrQPPPQQP........',
    '...............PqoQQQ0QP........',
    '................PQQ0PPP.........',
    '.................PQQP...........',
    '..................PQP...........',
    '..................PrQP..........',
    '..................PqoQP.........',
    '...................PQQP.........',
    '....................PQ0P........',
    '.....................PQP........',
    '......................P.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]
VEIN1_A2 = [
    '................',
    '................',
    '................',
    '....P...........',
    '....QP.....P....',
    '.....QP...PQ....',
    '.....PrPPPQ.....',
    '......qoQQ0P....',
    '......PQ0rQP....',
    '.......PQqoP....',
    '........PQQP....',
    '.........PQ.....',
    '..........P.....',
    '................',
    '................',
    '................',
]


# ---- 납골 벽 A2: 선반 없이 벽을 파낸 한 칸에 해골 줄과 넓적다리뼈 마구리 줄을 빽빽이 번갈아 쌓은 벽(파리 카타콤식) + 돌 문틀.
#      해골 줄은 줄마다 3px 엇갈리고, 가운데 줄에는 해골로 만든 십자 무늬(해골 대신 마구리 둘).
SKULL_ROW_ORDER = ('f', 'l', 'f', 'r', 't', 'f', 'l', 'r')


def oss_dense(h, lg):
    H = h * T
    cv = Cv(48, H)
    inner_h = H - 6
    fill = grid(['1' * 42] * inner_h, lg)
    y, k = 0, 0
    while y + 5 <= inner_h:
        off = 3 if k % 2 else 0
        for n, x in enumerate(range(-off, 42, 6)):
            v = SKULL_ROW_ORDER[(n + k) % len(SKULL_ROW_ORDER)]
            stamp(fill, SKULLS[v], lg, x, y)
        y += 5
        for _ in range(2):
            if y + 2 <= inner_h:
                stamp(fill, [r[off:] + r[:off] for r in KNOBS], lg, 0, y)
                y += 2
        k += 1
    stamp(cv, ['.' + '6' * 46 + '.', '.' + '4' * 45 + '3.', '.' + '2' * 45 + '1.'], lg, 0, 0)
    stamp(cv, ['.43' + '.' * 42 + '21.'] * (inner_h), lg, 0, 3)
    cv.paste(fill, 3, 3)
    stamp(cv, ['.' + '5' * 46 + '.', '.' + '2' * 45 + '1.', '..' + '~' * 46], lg, 0, H - 3)
    return cv


# ---- 석관 A2: 누운 사람 돋을새김(머리·모은 두 손·발끝) 뚜껑, 옆판은 민판. 열림 = 뚜껑이 비스듬히 밀려 아래 모서리가 바닥에 걸림.
SARC_NS_A2 = [
    '................',
    '..666666666665..',
    '.65555555555554.',
    '.65555666555554.',
    '.65556555345554.',
    '.65556555345554.',
    '.65555344455554.',
    '.65556666635554.',
    '.65566555553554.',
    '.65565555555354.',
    '.65565556655354.',
    '.65565565535354.',
    '.65565556635354.',
    '.65565555555354.',
    '.65565555555354.',
    '.65556555553554.',
    '.65556555553554.',
    '.65556555553554.',
    '.65555655535554.',
    '.65555655535554.',
    '.65555665335554.',
    '.64444444444443.',
    '.33333333333332.',
    '.21111111111110.',
    '.24444444444441.',
    '.24444444444441.',
    '.23333333333331.',
    '.23333333333331.',
    '.22222222222221.',
    '.11111111111110.',
    '..~~~~~~~~~~~~~~',
    '................',
]
SARC_NS_BOX = [   # 열린 남북 석관 바탕: 상자 윗테(5 · 4) 안 어둠(void)에 해골·갈비·뼈 — 뚜껑은 따로 비껴 얹는다
    '................',
    '.55555555555554.',
    '.5;;;;;;;;:;;;4.',
    '.5;;wvv;;;;;;;4.',
    '.5;;vuu;;:;;;;4.',
    '.5;;;tt;;;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;;vtvtv;;;;;4.',
    '.5;;t;t;t;;;:;4.',
    '.5:;vtvtv;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;;;;vu;;;;;;4.',
    '.5;;;;tt;;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;;;wv;;wv;;;4.',
    '.5;;;tu;;tu;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;:;;;;;;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.5;;;;;;;;;;;;4.',
    '.44444444444443.',
] + SARC_NS_A2[22:]


def sarc_ns_open(closed, dx, dy):
    """열림 = 바탕 상자 위에 닫힘 그림의 뚜껑(1~23행)을 (dx, dy) 비껴 얹는다. 칸 밖으로 나간 부분은 잘린다."""
    lg = leg(stone='marble')
    cv = grid(SARC_NS_BOX, lg)
    stamp(cv, [r[:16 - dx] for r in closed[1:24 - dy]], lg, dx, 1 + dy)
    return cv


SARC_EW_A2 = [
    '................................',
    '.666666666666666666666666666666.',
    '.655556665555555555555555555554.',
    '.655565553455566666666655555554.',
    '.655565553456655555555366555554.',
    '.655556665555555665555556555554.',
    '.655555345555566335555556555554.',
    '.655555555555555555555553555554.',
    '.644444444444444444444444444443.',
    '.333333333333333333333333333332.',
    '.244444444444444444444444444441.',
    '.244444444444444444444444444441.',
    '.233333333333333333333333333331.',
    '.222222222222222222222222222221.',
    '.111111111111111111111111111110.',
    '..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]
SARC_EW_BOX = [
    '................................',
    '.555555555555555555555555555554.',
    '.5;;;;:;;;;;;;;;;;;;;;:;;;;;;;4.',
    '.5;wvv;vtvtvtv;;tvvt;;vtv;wv;;4.',
    '.5;vuu;t;t;t;t;:;;;;;;t;t;tu;;4.',
    '.5;;tt;vtvtvtv;;;;;;;;;;;;;;;:4.',
    '.5;;;;;;;;;;;;;;;;;;;;;;;;;;;;4.',
    '.444444444444444444444444444443.',
] + SARC_EW_A2[8:]


def sarc_ew_open(closed, dy):
    """열림(동서) = 상자 위에 뚜껑(1~9행)을 남쪽으로 dy 밀어 얹는다 — 북쪽 틈으로 안이 보이고 뚜껑 앞이 상자 앞면을 덮는다."""
    lg = leg(stone='marble')
    cv = grid(SARC_EW_BOX, lg)
    stamp(cv, closed[1:10], lg, 0, 1 + dy)
    return cv


# ---- 묘석 A2: 해골과 엇갈린 뼈 새김 + 오른쪽 아래 모서리 금(갈라져 한 조각이 조금 내려앉음 — 어두운 틈 0 · 내려앉은 조각은 한 단 어둡게).
SLAB_A2 = [
    '00000000000000000000000000000000',
    '05555555555555555555555555555540',
    '05655555555555555555555555555540',
    '05555555555555555555555555555540',
    '05555555555555555555555555555540',
    '05555555555551111115555555555540',
    '05555555555511444441155555555540',
    '05555555555514555554615555555540',
    '05555555555145555555461555555540',
    '05555555555145115115461555555540',
    '05555555555145116116461555555540',
    '05555555555145555555461555555540',
    '05555555555514555155461555555540',
    '05555555555551456545615555555540',
    '05555555555555141416155555555540',
    '05555555555555516161555555555540',
    '05555551155555555555555551155540',
    '05555551461555555555555514615540',
    '05555555146115555555551146155540',
    '05555555551461155555114615555540',
    '05555555555514611511461555555540',
    '05555555555555144614615555555540',
    '05555555555511461146115555555540',
    '05555555551146155551461155555540',
    '05555555514615555555514615555000',
    '05555551461555555555555140000440',
    '05555551155555555555500044444440',
    '05555555555555555550044444444440',
    '05555555555555555004444444444440',
    '05555555555555550444444444444440',
    '04444444444444440333333333333330',
    '00000000000000000000000000000000',
]

# ---- 촛대 A2: 검은 쇠(g~l) 촛대 — 세 발 대신 둥근 받침 접시, 굽은 가지 둘 + 가운데 높은 초, 녹아내린 촛농이 길게.
# r1 관문: 받침이 앞에서 본 계단꼴이라 윗면이 없다(4/4) → 받침을 위에서 본 둥근 접시(타원 윗면 3줄 + 앞 테 2줄)로, 가지 끝 초받침도 작은 타원 잔으로.
CANDLE_BASE_A2 = [
    '................',
    '................',
    '................',
    '................',
    '.......wv.......',
    '.......wu.......',
    '..wv...wu...wv..',
    '..wu...vu...wu..',
    '..vu..wvuv..vt..',
    '..vt..lkkih.vt..',
    '.lkjih.ki.lkjih.',
    '.hggh..ki..hggh.',
    '..ki...ki...ih..',
    '...kh..ki..ih...',
    '....kjjkjjjh....',
    '.......ki.......',
    '.......ki.......',
    '......lkji......',
    '.......ki.......',
    '.......ki.......',
    '.......ki.......',
    '.......ki.......',
    '.......ki.......',
    '.......ki.......',
    '.....lkkij......',
    '...lkkjkijjih...',
    '..lkkjjkijjiih..',
    '..kjjjjjiiihhg..',
    '...ihhhhhhggg~..',
    '....hggggggg~~..',
    '.....~~~~~~~~...',
    '................',
]
CANDLE_FLAMES_A2 = [
    ['.......L........', '.......KL.......', '..K....JH....L..', '..KL...H.....KL.', '..JH.........JH.', '..H...........H.'][:0] or
    ['.......L........', '.......KL.......', '..L....JH....K..', '..KL...H.....LK.', '..JH.........HJ.', '..H...........H.'],
    ['........L.......', '.......LK.......', '..K....HJ.....L.', '.LK....H.....KL.', '..HJ.........JH.', '...H.........H..'],
    ['.......K........', '......LK........', '...L...JH...K...', '..KL...H.....LK.', '..JH.........JH.', '..H...........H.'],
]


# ---- 옥좌 A2: 돌 옥좌(castle 돌 — 높은 등받이 꼭대기 박공 + 금 테 한 줄) + 붉은 방석, 단 위 양탄자 없이 계단 가운데만 붉은 띠.
THRONE_A2 = [
    '..........66..........',
    '.........6554.........',
    '........655544........',
    '.......65555443.......',
    '......6555555443......',
    '.....655555555443.....',
    '....6qqqqqqqqqqqqp....',
    '....65555555555543....',
    '....65555555555543....',
    '....65555665555543....',
    '....65556rq4555543....',
    '....65555qp4555543....',
    '....65555544555543....',
    '....65555555555543....',
    '....65555555555543....',
    '....65555555555543....',
    '..665555555555555433..',
    '..655VVVVVVVVVVVV543..',
    '..654VUUUUUUUUUUU443..',
    '..654UUUUUUUUUUUT443..',
    '..654TTTTTTTTTTTS443..',
    '..654444444444444443..',
    '..653333333333333332..',
    '..652222222222222221..',
    '..651111111111111111..',
    '..65..............21..',
    '..54..............21..',
    '..43..............10~.',
    '...~~..............~~.',
    '......................',
]
DAIS_A2 = dais(DAIS_TOP, carpet_from=40)

# ---- 양탄자 A2: 짙은 진홍(T 바탕 · U 결) + 금 점 테두리 띠(p 바탕 위 q 점) + 사슬처럼 이어지는 작은 마름모. 끝은 짧은 술.
# r1 패널 1: 금 테두리의 2px 바둑판 점선이 1배에서 지글거리고, 3칸 끝 테두리 가운데로 노란 돌기가 튐(2명) →
# 테두리를 한 결의 띠(바깥 o · 금 p · 4줄마다 바늘땀 q · 안쪽 그늘 n)로 바꾸고, 끝 테두리 바로 옆 두 줄에서는 가운데 사슬을 비운다.
RUN1_MID_A2 = [   # 패널 3: 대칭 금 테두리 5단(o · q/r 수 · p · n), 붉은 결은 덩이 털결(PILE_A2), 반복 무늬 없음
    '..oqpnTTTTnpqo..',
    '..orpnTTTTnpro..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..orpnTTTTnpro..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..orpnTTTTnpro..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
    '..orpnTTTTnpro..',
    '..oqpnTTTTnpqo..',
    '..oqpnTTTTnpqo..',
]
RUN1_TOP_A2 = ['................', '...p..p..p..p...', '..oooooooooooo..', '..opppppppppppo.'[:16], '..opnnnnnnnnpo..'] + [r.replace('q', 'T').replace('U', 'T') if 5 <= y < 7 else r for y, r in enumerate(RUN1_MID_A2)][5:]
RUN1_BOT_A2 = [r.replace('q', 'T').replace('U', 'T') if 9 <= y < 11 else r for y, r in enumerate(RUN1_MID_A2[:11])] + ['..opnnnnnnnnpo..', '..opppppppppppo.'[:16], '..oooooooooooo..', '...p..p..p..p...', '...~..~..~..~...']

# r1 관문: 붉은 바탕이 평면 채움·명암 3단(4/4) → 털결 반점을 손으로 찍는다(16줄 주기, 이음매에서 끊기지 않게 칸 안 좌표만).
TWILL = ('TUTS', 'UTST', 'TSTU', 'STUT')
PILE_A2 = ['TUTUTUTUTUTUTUTU', 'UTUTUTUTUTUTUTUT', 'TVTUTUTUTVTUTUTU', 'UTUTUTUTUTUTUTUT', 'TUTUTUTUTUTUTUTU', 'UTUTUTUTUTUTUTUT', 'TUTUTVTUTUTUTVTU', 'UTUTUTUTUTUTUTUT', 'TUTUTUTUTUTUTUTU', 'UTUTUTUTUTUTUTUT', 'TVTUTUTUTVTUTUTU', 'UTUTUTUTUTUTUTUT', 'TUTUTUTUTUTUTUTU', 'UTUTUTUTUTUTUTUT', 'TUTUTVTUTUTUTVTU', 'UTUTUTUTUTUTUTUT']   # 패널 4: 덩이 반점이 「자갈·얼룩」(2/4) → 낮은 대비 T/U 짠 결 + 사선 V 광택(4×4 하나), 어두운 S 없음
PILE3 = {1: ((3, 'U'), (24, 'S'), (33, 'U')), 2: ((10, 'S'),), 3: ((27, 'U'), (4, 'S')), 5: ((12, 'U'), (31, 'S')),
         6: ((2, 'U'), (22, 'U')), 7: ((8, 'S'), (34, 'U')), 9: ((14, 'S'), (26, 'U'), (1, 'U')), 10: ((30, 'S'),),
         11: ((5, 'U'), (21, 'S')), 13: ((11, 'U'), (33, 'S')), 14: ((25, 'S'), (3, 'S')), 15: ((9, 'U'), (28, 'U'))}
PILE1 = {0: (6, 'U'), 3: (9, 'S'), 6: (7, 'S'), 9: (8, 'U'), 12: (6, 'S'), 14: (9, 'U')}   # 1칸 폭 붉은 줄(6~9열)


def _pile1(rows):
    """1칸 폭 붉은 줄(6~9열) 능직 결: 바탕 T 자리만 TWILL 로, 왼 6열 빛 V · 오른 9열 그늘 S."""
    out = []
    for y, r in enumerate(rows):
        r = list(r)
        for x in range(6, 10):
            if r[x] == 'T':
                r[x] = PILE_A2[y % 16][x]
        out.append(''.join(r))
    return out


def _plain(row, a, b):
    """row 의 a~b 열 안 금 무늬(q · U)를 진홍 바탕(T)으로 지운다 — 끝 테두리 옆 사슬 비우기."""
    return row[:a] + row[a:b].replace('q', 'T').replace('U', 'T') + row[b:]


def run3_a2(kind):
    """3칸 폭 A2: 한 결 금 테두리 띠 4px + 진홍 바탕 + 가운데 마름모 사슬."""
    if kind == 'mid':
        core = []
        for y in range(16):   # 패널 3: 가운데 마름모 사슬(16px 반복이 보임)·1px 능직 → 덩이 털결 + 안쪽 금 실선 두 줄(이어지는 무늬)
            row = [PILE_A2[y][x % 16] for x in range(36)]
            row[3] = row[32] = 'p'
            if y % 4 == 1:
                row[3] = row[32] = 'q'
            core.append(''.join(row))
        out = []
        for y, c in enumerate(core):
            st = 'q' if y % 4 == 1 else 'p'
            out.append('..o' + st + 'pn' + c + 'np' + st + 'o..')
        return out
    body = run3_a2('mid')
    top = ['.' * 48, '...' + 'p..' * 14 + '...', '..' + 'o' * 44 + '..', '..o' + 'p' * 42 + 'o..', '..op' + 'n' * 40 + 'po..']
    if kind == 'top':
        return top + [_plain(r, 6, 42) if y < 2 else r for y, r in enumerate(body[5:])]
    return [_plain(r, 6, 42) if y >= 9 else r for y, r in enumerate(body[:11])] + top[::-1][:4] + ['...' + '~..' * 14 + '...']


# ---- 깃발 A2: 쇠 막대에서 끈 둘로 매단 뾰족 끝 깃발 + 금 술 둘, 붉은 천에 금 방패 문장(가운데 세로 띠).
BANNER_A2 = [
    '................',
    '.r............o.',
    'rqkkkkkkkkkkkkpo',
    '.pjhhhhhhhhhhgo.',
    '..k.........h...',
    '..qk.......hp...'[:16],
    '..qqqqqqqqqqqp..',
    '..qTUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUrqqqqpUTo..',
    '..qVUqrqpqoUTo..',
    '..qVUqrqpqoUTo..',
    '..qVUqrqpqoUTo..',
    '..qVUqqqpqoUTo..',
    '..qVUUqqpoUUTo..',
    '..qVUUUqoUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '..qVUUUUUUUUTo..',
    '...qVUUUUUUTo...',
    '....qVUUUUTo....',
    '.....qVUUTo.....',
    '......qVTo......',
    '.......qo.......',
    '.......po.......',
    '......rqpo......',
    '.......qo.......',
    '................',
]


# ---- 갑옷 A2: 붉은 겉옷(S~W) 걸친 갑옷 + 왼손에 세운 연 모양 방패(쇠 테 · 붉은 바탕 · 금 십자) + 오른쪽에 세운 미늘창(나무 자루 · 쇠 날).
# r1 패널 1: 진홍 겉옷·금 십자·창 때문에 1배에서 살아 있는 경비병 NPC 로 읽힌다(2명) → 겉옷·방패를 바랜 포도주색(S 몸 · 빛 받는 왼 가장자리만 T)으로,
# 금 십자는 한 단 어둡게(p), 투구 눈구멍을 2px 로 줄이고, 다리 사이로 받침대 나무 기둥(c)이 보이게 해 '받침에 걸어 둔 빈 갑옷'으로 읽히게 함.
# 관문 2차: 받침 윗면이 1~2줄뿐(3/4 아님 4/4) → 발 밑 나무 받침을 위에서 본 판(윗면 4줄 f·e 결 + 앞 가장자리 d + 앞면 c·b)으로.
ARMOR_A2 = [
    '.............kl.',
    '............lkj.',
    '......lkjh..ki..',
    '.....lkkjih.kj..',
    '.....lkkjjh.ki..',
    '.....lj;;jh.db..',
    '.....lkjjih.dc..',
    '......jiih..db..',
    '...lkkSSSSjhdc..',
    '..lkkTSSSSSihb..',
    '.lklkTSpSSSihc..',
    '.kjhkTSpSSSihb..',
    'jkkkiTpppSSh.c..',
    'kSSShTSpSSSh.b..',
    'kSpShTSpSSSh.c..',
    'kppphTSSSSSh.b..',
    'kSpShdcppcba.c..',
    'kSpShTSSSSSh.b..',
    '.kShlTSSSSSSjc..',
    '..khkTSSSSSShb..',
    '...h.lkjckih.c..',
    '.....lkjckih.b..',
    '.....lkjckih.c..',
    '.....kjhcjhg.b..',
    '..eflkjhckjhgce.',
    '..fefffeeffeeed.',
    '..effeefeeefeed.',
    '..eeeeeeeeeeedc.',
    '..ddddddddddccb.',
    '..ccbbbbbbbbbba.',
    '...~~~~~~~~~~~~~',
    '................',
]

# ---- 창살문 A2: 뾰족 아치 문틀(성 돌 덩이 · 아치 고리 돌 2px — 왼쪽 빛 6·5, 오른쪽 그늘 3·2) + 마름모 격자 · 올림 = 아치 밑에 뾰족 끝만.
#      문틀 행은 왼 반쪽(24폭)을 손으로 적고 오른 반쪽은 거울 + 명암 바꿈(빛 6·5 → 그늘 3·2)으로 만든다(좌우 대칭 건축).
_ARCH_BLK = [
    '555553555555555555555555',
    '555553555555555555555555',
    '333333333333333333333333',
    '555555555555555355555555',
    '555555553555555355555555',
    '555555553555555355555555',
    '333333333333333333333333',
    '555553555555555555555555',
    '555553555555553555555555',
    '555553555555553555555555',
    '333333333333333333333333',
]
ARCH_STONE_A2 = ['6' * 24] + _ARCH_BLK * 2 + [   # 문틀 돌 결(왼 반쪽 24폭): 덩이 5 · 줄눈 3(엇갈림) · 맨 윗줄 상인방 윗면 빛 6 · 맨 밑 문턱 그늘 1
    '555355555555555555555555',
    '555355555555555555555555',
    '333333333333333333333333',
    '555555555555555555555555',
    '555355555555555555555555',
    '555355555555555555555555',
    '333333333333333333333333',
    '555555555555555555555555',
    '111111111111111111111111',
]
ARCH_OPEN_A2 = [0, 0, 1, 2, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14] + [15] * 18   # 줄마다 통로 반폭(가운데에서 바깥으로) — 뾰족 아치
ARCH_IN_A2 = [';'] * 14 + [':'] * 3 + [','] * 3 + list('1223333444566') [:0] + list('12233344456') + ['5', '1']   # 줄마다 통로 안 글자
_SHADE = str.maketrans({'6': '3', '5': '2'})


def arch_frame_a2():
    """48×32 문틀. 왼 반쪽 = 돌 결 + 아치 고리(6 5, 통로에 닿는 2px) + 통로 안. 오른 반쪽 = 거울, 고리만 그늘 명암(3 2)."""
    rows = []
    for y in range(32):
        ow = ARCH_OPEN_A2[y]
        st = ARCH_STONE_A2[y]
        inner = ARCH_IN_A2[y] if y < len(ARCH_IN_A2) else '5'
        if y == 0 or y == 31:
            rows.append(st + st[::-1])
            continue
        if ow == 0:   # 꼭대기 쐐기돌: 가운데 고리만
            left = st[:22] + '65'
            right = '23' + st[:22][::-1]
        else:
            left = st[:24 - ow - 2] + '65' + inner * ow
            right = inner * ow + '23' + st[:24 - ow - 2][::-1]
        rows.append(left + right)
    return rows
LATTICE = ['k....h', '.k..h.', '..kh..', '..hk..', '.h..k.', 'h....k']   # 마름모 격자 6×6 한 마디(빗살 둘이 엇갈림)
SPIKES = ['j', 'h']   # 격자 밑 뾰족 끝 2줄(세로 살 자리마다)


def portcullis_a2(open_):
    """문틀 행 위에, 통로 글자(; : , 와 통로 바닥) 자리에만 격자를 얹는다. 닫힘 = 문턱 위(28행)까지, 올림 = 아치 꼭대기 6줄만."""
    lg = leg(stone='castle')
    rows = [list(r) for r in arch_frame_a2()]
    bottom = 6 if open_ else 27
    for y in range(2, bottom + 1):
        ow = ARCH_OPEN_A2[y]
        for x in range(24 - ow, 24 + ow):
            ch = LATTICE[y % 6][x % 6]
            if y >= bottom - 1:
                ch = SPIKES[y - bottom + 1] if x % 6 in (0, 3) else '.'
            if ch != '.':
                rows[y][x] = ch
    return grid([''.join(r) for r in rows], lg)


# ---- 풀 난 판석 A2: 판석 틈마다 이끼 줄(moss A~E) + 담쟁이 덩굴 두 줄기(잎 = 풀 2~5, 줄기 = 나무 b·c)가 판 위를 기어감 + 잔풀 포기.
# 관문 보류 → Argon 판정 실패(네모 막대 틈 · 십자 잎 도장 · 같은 방향 뿌리) → 깨진 판석 구멍(rim 0 금 · 흙 a b)에서 풀 포기가 솟고,
# 굽은 뿌리 한 줄기가 줄눈을 따라 뻗고, 줄눈에 이끼(풀 1~4)가 덩이로 낀다. 버들항 폐허 바닥 줄눈(16칸 안 7·15행, 7·15열)에 맞춤.
OVERGROWN_A2 = [
    '...............5................',
    '............4..4..5.....2.32....',
    '............4.44.454...23432.2..',
    '.............343.44..52343.343..',
    '....3......5.3433343.4.2.232....',
    '..343...4...33423324343.........',
    '2343423.343.32212122.3..........',
    '12112211211211121121.1..........',
    '3232.32132321.2.3..22.23........',
    '.3...3.23.3...3...2343432.......',
    '..2...2.3.....3.2234434343......',
    '.zz.32.21....2342.23443432......',
    '.yyzzz.12.....2....2.3423.......',
    '...yyyz2.z3...........21........',
    '......y1.yzz24..................',
    '........3.yyzz..................',
    '............yy..................',
    '..32...........................2',
    '.23432.3.................5.....3',
    '..2343432.............4..4.5..41',
    '...2.23..............4.3434..3.2',
    '......................34332....3',
    '.....................322312.....',
    '.................2.12112121121.2',
    '..................3.3232.323....',
    '....45.4..............2322......',
    '...4534543..23......2342343.2...',
    '....3423...2343....23443432343..',
    '...4.21.3.23432...2343.2342.32..',
    '....2..2...232.....32..12.23....',
    '....................1....2......',
    '................................',
]

# ---- 돌무더기 A2: 쓰러진 기둥 토막(원통 — 윗면 타원 마구리가 보임) + 기둥머리 조각 + 잔 덩이 + 이끼.
RUBBLE_A2 = [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........6666665...............',
    '........66555555544.............',
    '.......6555666555443............',
    '.......6556555565443............',
    '.......4555666555433.666665.....',
    '.......34455555544332655555544..',
    '.......334444444433226555555443.',
    '.......3334434434322145444444332',
    '...66665333443443321234434434321',
    '..6555544233333332214333333332~~',
    '.655555443222222221~1222222221~.',
    '.4444444332111111111~~111111~~..',
    '.3443443322DCD.~~~~....~~~~~....',
    '.3333333321BC66665..............',
    '.222222222~.6555554.....665.....',
    '..1111111~~.4444443~...65554....',
    '...~~~~~~...3343332~...4444~....',
    '............2222221~...222~.....',
    '.............~~~~~~~....~~......',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]

# ---- 석상 머리 A2: 투구 쓴 머리가 옆으로 누움(왼뺨이 땅, 정수리가 오른쪽) — 투구 볏(이끼 덮임) · 감은 눈 둘이 세로로 · 코가 옆을 향함.
HEAD_A2 = [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........666666665.............',
    '.......6665555555554YE..........',
    '.....665555555555554EDY.........',
    '....65555555555555544EDCE.......',
    '...6555555E55555555443DCDY......',
    '...65555EEDE555555544443DCE.....',
    '..655555DCE5555555544443CDY.....',
    '..65551155555511555544443DCE....',
    '..65512215555122155544443CD.....',
    '..655555555555555555444433BC....',
    '..655555555555555554444433......',
    '..65555555511555555444433D......',
    '..65555555511155554444433C......',
    '..6555555551111555444443........',
    '..4555555555555555444433~.......',
    '..34555222222225544443322~......',
    '..334555511115555444333221~.....',
    '...33444444444444443332211~~....',
    '....3333333333333333322111~~....',
    '.....2222222222222222211~~~.....',
    '......~~~~~~~~~~~~~~~~~~~.......',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]


# ================================================================================================ 후보 표
# 모든 항목은 줄 공통(시드 common) — 후보 키 A1 A2. 장면은 그 테마에서 빌더가 실제로 까는 버들항 키트 위.
ORE_L = leg(stone='crock', **ORE_LEG)
_IRON = str.maketrans({'r': 'l', 'q': 'k', 'p': 'j', 'o': 'i', 'n': 'T'})   # 금 → 쇠 광석(같은 자리, 쇠 램프 + 가장 깊은 그늘만 녹 T)
BRICK_L = leg(stone='brick')
OSS_L = leg(stone='brick', P=('rim', 1), Q=('rim', 0), **{';': ('brick', 1)})   # 납골 벽: 해골 눈구멍을 void(근흑) 대신 벽돌 1 로
MARBLE_L = leg(stone='marble')
SARC_L = leg(stone='marble', P=('rim', 1), Q=('rim', 0), R=('rim', 5), N=('castle', 5), X=('moss', 4), Z=('moss', 2))   # 석관 A1: 대리석 + 따뜻한 rim 결·가장자리 + 이끼
CATA_L = leg(stone='cata')
SLAB_L = leg(stone='cata', P=('rim', 1), Q=('rim', 0), R=('rim', 4), N=('marble', 3), X=('moss', 4), Z=('moss', 2))   # 묘석 A1: 줄눈·홈을 따뜻한 rim 으로, 결 R N · 이끼 X Z
CASTLE_L = leg(stone='castle')
THRONE_L = leg(stone='marble', P=('rim', 1), Q=('rim', 0), R=('rim', 5))   # 옥좌 A1 단: 대리석 + rim 가장자리


def _scene_wall(theme, piece, cx, w=6, h=5, face_h=2, actor=(4, 4), extra=()):
    v = scene(theme, w, h, face_h=face_h)
    place(v, piece, cx, 1)
    for p, x, y, dx, dy in extra:
        place(v, p, x, y, dx, dy)
    put_actor(v, *actor)
    return v


def c_rails(R, T_, RL, E, stub=False):
    def fn():
        tiles = rail_tiles(R, T_, RL, E, stub=stub)
        sheet = rail_sheet(tiles)
        lay = ['EN - SE H TS H SW -', 'V - V - V - V -', 'SE H X H TW - V -', 'V - V - - - NE EW', 'NE H TN H EE - - -']
        v = scene('mine', 8, 8, face_h=2)
        for y, r in enumerate(lay):
            for x, n in enumerate(r.split()):
                if n != '-':
                    v.paste(tiles[n], x * T, (y + 3) * T)
        cart = kit_cv('bd-pick-mining-valley-cart-h')
        v.paste(cart, 4 * T, 7 * T - 20)
        cart_v = kit_cv('bd-pick-mining-valley-cart')
        v.paste(cart_v, 0, 4 * T - 6)
        put_actor(v, 5, 6)
        return sheet, {'kind': 'objects', 'parts': {n: tiles[n] for n in RAIL_NAMES}, 'vignette': v}
    return fn


def c_post(post_cv):
    def fn():
        v = scene('mine', 6, 5, face_h=2)
        place(v, post_cv, 1, 2, 0, 8)
        place(v, post_cv, 4, 3)
        put_actor(v, 3, 4)
        return post_cv, {'kind': 'object', 'parts': {'기둥': post_cv}, 'vignette': v}
    return fn


def c_ore(v2, v1):
    def fn():
        g2, g1 = grid(v2, ORE_L), grid(v1, ORE_L)
        i2, i1 = grid([r.translate(_IRON) for r in v2], ORE_L), grid([r.translate(_IRON) for r in v1], ORE_L)
        sheet = Cv(6 * T, 2 * T)
        sheet.paste(g2, 0, 0)
        sheet.paste(i2, 2 * T, 0)
        sheet.paste(g1, 4 * T, 0)
        sheet.paste(i1, 5 * T, 0)
        v = scene('mine', 8, 5, face_h=2)
        place(v, g2, 1, 1)
        place(v, i1, 3, 1)
        place(v, i2, 5, 1)
        place(v, g1, 4, 2)
        place(v, kit_cv('bd-pick-mining-valley-ore'), 5, 3)
        put_actor(v, 3, 4)
        return sheet, {'kind': 'objects', 'parts': {'금 2×2': g2, '쇠 2×2': i2, '금 1×1': g1, '쇠 1×1': i1}, 'vignette': v}
    return fn


def c_oss(make):
    def fn():
        o3, o2 = make(3), make(2)
        sheet = Cv(6 * T, 3 * T)
        sheet.paste(o3, 0, 0)
        sheet.paste(o2, 3 * T, T)
        v3 = scene('catacomb', 8, 5, face_h=3)
        place(v3, o3, 1, 1)
        put_actor(v3, 5, 4)
        v2 = scene('catacomb', 8, 5, face_h=2)
        place(v2, o2, 1, 1)
        place(v2, o2, 4, 1)
        put_actor(v2, 7, 4)
        return sheet, {'kind': 'objects', 'parts': {'3단': o3, '2단': o2}, 'vignette': vcat(v3, v2)}
    return fn


def c_sarc_ns(closed, opened):
    def fn():
        a, b = closed(), opened()
        v = scene('catacomb', 6, 6, face_h=2)
        place(v, a, 1, 3)
        place(v, b, 3, 3)
        place(v, a, 4, 3)
        put_actor(v, 2, 5)
        return hcat(a, b), {'kind': 'objects', 'parts': {'닫힘': a, '열림': b}, 'vignette': v}
    return fn


def c_sarc_ew(closed, opened):
    def fn():
        a, b = closed(), opened()
        v = scene('catacomb', 6, 6, face_h=2)
        place(v, a, 1, 3)
        place(v, b, 1, 4)
        place(v, a, 4, 4)
        put_actor(v, 4, 3)
        return hcat(a, b), {'kind': 'objects', 'parts': {'닫힘': a, '열림': b}, 'vignette': v}
    return fn


def c_slab(rows, lg=None):
    lg = lg or CATA_L

    def fn():
        s_ = grid(rows, lg)
        v = scene('catacomb', 6, 6, face_h=2)
        place(v, s_, 1, 3)
        place(v, s_, 3, 3)
        put_actor(v, 5, 5)
        return s_, {'kind': 'tile', 'parts': {'묘석': s_}, 'vignette': v}
    return fn


def c_candle(base, flames):
    def fn():
        fs = []
        for f in flames:
            c = grid(base, LEG)
            stamp(c, f, LEG, 0, 0)
            fs.append(c)
        anim = []
        for c in fs:
            v = scene('catacomb', 6, 5, face_h=2)
            place(v, c, 1, 2, 0, 8)
            place(v, c, 4, 2, 0, 8)
            put_actor(v, 3, 4)
            anim.append(v)
        return hcat(*fs), {'kind': 'objects', 'parts': {f'장면{i + 1}': c for i, c in enumerate(fs)}, 'vignette': anim[0], 'anim': anim}
    return fn


def c_throne(dais_rows, throne_rows, ty, lg=None):
    lg = lg or CASTLE_L

    def fn():
        d = grid(dais_rows, lg)
        stamp(d, throne_rows, lg, 13, ty)
        v = scene('castle', 7, 6, face_h=2)
        place(v, d, 2, 2)
        put_actor(v, 1, 5)
        return d, {'kind': 'object', 'parts': {'옥좌': d}, 'vignette': v}
    return fn


def c_carpet(top, mid, bot, r3):
    def fn():
        one = vcat(grid(top, LEG), grid(mid, LEG), grid(bot, LEG))
        three = vcat(*[grid(r3(k), LEG) for k in ('top', 'mid', 'bot')])
        sheet = hcat(one, three)
        v = scene('castle', 8, 9, face_h=2)
        for y, t in enumerate([top] + [mid] * 4 + [bot]):
            place(v, grid(t, LEG), 1, 3 + y)
        for y, k in enumerate(['top', 'mid', 'mid', 'mid', 'mid', 'bot']):
            place(v, grid(r3(k), LEG), 4, 3 + y)
        put_actor(v, 2, 6)
        return sheet, {'kind': 'objects', 'parts': {'한 칸 폭': one, '세 칸 폭': three}, 'vignette': v}
    return fn


def c_banner(rows):
    def fn():
        b = grid(rows, LEG)
        v = _scene_wall('castle', b, 1, extra=((b, 4, 1, 0, 0),), actor=(3, 4))
        return b, {'kind': 'object', 'parts': {'깃발': b}, 'vignette': v}
    return fn


def c_armor(rows):
    def fn():
        a = grid(rows, LEG)
        v = scene('castle', 6, 5, face_h=2)
        place(v, a, 1, 2, 0, 4)
        place(v, a, 4, 2, 0, 4)
        put_actor(v, 3, 4)
        return a, {'kind': 'object', 'parts': {'갑옷': a}, 'vignette': v}
    return fn


def c_gate(make):
    def fn():
        a, b = make(False), make(True)
        v = scene('castle', 8, 5, face_h=2)
        place(v, a, 1, 1)
        place(v, b, 4, 1)
        v.paste(actor(), 4 * T + 12, T + 6)
        put_actor(v, 2, 4)
        return hcat(a, b), {'kind': 'objects', 'parts': {'닫힘': a, '올림': b}, 'vignette': v}
    return fn


def c_overgrown(rows):
    def fn():
        o = grid(rows, GRASS_LEG)
        v = scene('ruins', 7, 6, face_h=2)
        place(v, o, 1, 3)
        place(v, o, 4, 4)
        put_actor(v, 6, 5)
        return o, {'kind': 'object', 'parts': {'풀 난 판석': o}, 'vignette': v}
    return fn


def c_ruin_obj(rows, lg, name):
    def fn():
        o = grid(rows, lg)
        v = scene('ruins', 6, 5, face_h=2)
        place(v, o, 1, 2, 0, 8)
        place(v, kit_cv('bd-pick-temple-ruins-column-temple-broken'), 4, 2)
        put_actor(v, 4, 4)
        return o, {'kind': 'object', 'parts': {name: o}, 'vignette': v}
    return fn


def c_frame_only(make_frame):
    def fn():
        f = make_frame()
        v = scene('mine', 7, 5, face_h=2)
        place(v, f, 1, 1)
        place(v, f, 4, 1)
        put_actor(v, 3, 4)
        return f, {'kind': 'object', 'parts': {'틀': f}, 'vignette': v}
    return fn


CANDIDATES = {
    'earth.rails': {'A1': c_rails(RAIL_A1, TIE_A1, RL_A1, END_A1), 'A2': c_rails(RAIL_A2, TIE_A2, RL_A2, END_A2, stub=True)},
    'earth.timber_frame': {'A1': c_frame_only(lambda: grid(FRAME_A1, LEG)), 'A2': c_frame_only(log_frame)},
    'earth.timber_post': {'A1': lambda: c_post(grid(POST_A1, LEG))(), 'A2': lambda: c_post(grid(POST_A2, LEG))()},
    'earth.ore_vein': {'A1': c_ore(VEIN2_A1, VEIN1_A1), 'A2': c_ore(VEIN2_A2, VEIN1_A2)},
    'earth.ossuary': {'A1': c_oss(lambda h: ossuary(h, ['skull', 'bone', 'skull2'][:h], OSS_L)),
                      'A2': c_oss(lambda h: oss_dense(h, BRICK_L))},
    'earth.sarc_ns': {'A1': c_sarc_ns(lambda: grid(SARC_NS_A1, SARC_L), lambda: grid(SARC_NS_OPEN_A1, SARC_L)),
                      'A2': c_sarc_ns(lambda: grid(SARC_NS_A2, MARBLE_L), lambda: sarc_ns_open(SARC_NS_A2, 3, 2))},
    'earth.sarc_ew': {'A1': c_sarc_ew(lambda: grid(SARC_EW_A1, SARC_L), lambda: grid(SARC_EW_OPEN_A1, SARC_L)),
                      'A2': c_sarc_ew(lambda: grid(SARC_EW_A2, MARBLE_L), lambda: sarc_ew_open(SARC_EW_A2, 4))},
    'earth.tomb_slab': {'A1': c_slab(SLAB_A1, SLAB_L), 'A2': c_slab(SLAB_A2)},
    'earth.candelabra': {'A1': c_candle(CANDLE_BASE_A1, CANDLE_FLAMES_A1), 'A2': c_candle(CANDLE_BASE_A2, CANDLE_FLAMES_A2)},
    'earth.throne': {'A1': c_throne(DAIS_A1, THRONE_A1, 0, THRONE_L), 'A2': c_throne(DAIS_A2, THRONE_A2, 6)},
    'earth.carpet': {'A1': c_carpet(RUN1_TOP_A1, RUN1_MID_A1, RUN1_BOT_A1, run3),
                     'A2': c_carpet(_pile1(RUN1_TOP_A2), _pile1(RUN1_MID_A2), _pile1(RUN1_BOT_A2), run3_a2)},
    'earth.banner': {'A1': c_banner(BANNER_A1), 'A2': c_banner(BANNER_A2)},
    'earth.armor_stand': {'A1': c_armor(ARMOR_A1), 'A2': c_armor(ARMOR_A2)},
    'earth.portcullis': {'A1': c_gate(portcullis), 'A2': c_gate(portcullis_a2)},
    'earth.overgrown': {'A1': c_overgrown(OVERGROWN_A1), 'A2': c_overgrown(OVERGROWN_A2)},
    'earth.rubble_heap': {'A1': c_ruin_obj(RUBBLE_A1, RUIN_L, '무더기'), 'A2': c_ruin_obj(RUBBLE_A2, RUBBLE_LEG, '무더기')},
    'earth.statue_head': {'A1': c_ruin_obj(HEAD_A1, RUIN_L, '머리'), 'A2': c_ruin_obj(HEAD_A2, RUBBLE_LEG, '머리')},
}

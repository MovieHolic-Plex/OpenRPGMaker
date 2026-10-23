"""theme-arcane-r1 — 던전 테마 「마법탑」·「마계/이세계」 조각 판(묶음 theme_arcane, 2026-10-23).

조수가 12 테마 던전을 지을 때 이 둘이 그 테마로 읽히게 하는 **빠진 그림**만 그린다. 이미 있는 것은 다시 그리지 않는다:
  - 버들항 마법사의 탑 키트(bd-pick-wizard-tower-*): 혼천의·증류로(athanor = 연금 탁자 몫)·지구본·태양계의·별자리 지도·달돌 표석·가로등
  - 다른 작업자 gap-tower-r1: 둥근 탑 벽·탑 계단·화살 구멍 창(이 판은 탑 안 바닥과 가구만)
  - props-r1: 바닥 마법진 2×2·발광 수정 1×2(이 판의 3×3 차원 이동진·받침 수정은 크기·용도가 달라 새로 그린다)

마법탑(줄 공통, 후보 A1·A2):
  arcane.tower_floor      탑 바닥 오토타일(몸통 + 몸통 변형 둘) + 2×2 룬 상감(같은 바닥 결 위)
  arcane.bookshelf        책장 2×2   · arcane.bookshelf_tall 높은 책장 2×3
  arcane.lectern          펼친 책 독서대 1×2
  arcane.teleport_circle  층 사이 차원 이동진 3×3(4장면 빛) — 사람 아래(2층 바닥 장식)
  arcane.crystal_pedestal 받침 위 수정 덩이 1×2(3장면 빛)
  arcane.candelabra       촛대 1×2(불꽃 3장면)
마계(줄 공통, 후보 A1·A2):
  other.ground            보라 검은 갈라진 돌 바닥 오토타일(희미한 빛 줄기, 몸통 변형)
  other.void_edge         허공 가장자리 — 바닥 칸의 북·서·동 턱(오토타일) + 남쪽 아래로 늘어진 섬 밑 바위 앞면 2단 + 허공 몸통.
                          떠 있는 발판도 같은 조각으로 나온다(장면)
  other.crystal           타락한 수정 1×2 · 2×2
  other.throne            단 위 마왕 옥좌 3×3
  other.bone_pillar       가시 돋은 뼈 기둥 1×2
  other.brazier           보라 불꽃 화로 1×2(3장면)
  other.portal            봉인된 차원문 3×3 닫힘 · 열림(열림 3장면)

손 도트 원칙: 모든 화소는 이 파일의 행 문자열에서 온다. 원·고리는 손으로 적은 사분면 행을 거울로 넷으로 놓고(사분면마다 빛 단을
바꿔 칠함), 좌우 대칭 기물은 왼쪽 반을 적고 오른쪽은 거울 + 그늘 단으로 바꿔 칠한다. 잡음 함수·생성 이미지·도형 마스크 본체는 없다.
외곽선 규칙(seed rules.outline): 먹 윤곽 없이 재질 명암. 마계 어둠도 void 램프가 아니라 ostone(버들항 설원 s1 의 보라 그늘) 0·1단.
빛 보라는 선언 램프 arcane(palette.py DECLARED — 공용 시트에 밝은 보라가 없다).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import style_r1 as SR  # noqa: E402  맥락 벽돌 앞면
import cave_r1 as CR  # noqa: E402  맥락 천장
from cave_r1 import autotile_cv, hcat, variants_sheet  # noqa: E402  조립 도구만
from dot import Cv, grid, stamp  # noqa: E402

WAVE = 'theme_arcane'
T = 16
RAMP_KEYS = {'void', 'rim', 'cfloor', 'crock', 'stone', 'cata', 'brick', 'water', 'pool', 'lava', 'ice', 'vrock', 'wood', 'iron',
             'fire', 'bone', 'moss', 'glow', 'gold', 'red', 'ostone', 'arcane'}


def L(spec, base=None):
    """'a:wood0 b:wood1 ...' → 범례. 램프 이름 + 단 번호."""
    d = dict(base or {})
    for tok in spec.split():
        ch, rt = tok[0], tok[2:]
        i = len(rt)
        while rt[i - 1].isdigit():
            i -= 1
        ramp, tone = rt[:i], int(rt[i:])
        assert ramp in RAMP_KEYS, ramp
        d[ch] = dot.C(ramp, tone)
    return d


def tr(rows, table):
    """행의 글자를 바꿔 칠한다(table: {글자: 글자})."""
    return [''.join(table.get(c, c) for c in r) for r in rows]


def mirror_h(rows):
    return [r[::-1] for r in rows]


def mirror_v(rows):
    return list(rows[::-1])


def quad4(q, tl=None, tr_=None, bl=None, br=None):
    """왼쪽 위 사분면 q(행) → 거울 넷. 사분면마다 바꿔 칠하기(빛은 왼쪽 위 — 오른·아래 사분면은 한 단 어둡게)."""
    top = [a + b for a, b in zip(tr(q, tl or {}), mirror_h(tr(q, tr_ or {})))]
    bot = [a + b for a, b in zip(mirror_v(tr(q, bl or {})), mirror_v(mirror_h(tr(q, br or {}))))]
    return top + bot


def halves(left, right_tr=None, mid=None):
    """좌우 대칭 기물: 왼쪽 반 행 + (가운데 열) + 거울(오른쪽 반, 그늘 단으로 바꿔 칠함)."""
    out = []
    for i, r in enumerate(left):
        m = mid[i] if mid else ''
        out.append(r + m + tr([r], right_tr or {})[0][::-1])
    return out


def actor():
    return Cv.of(dot.actor1_frame(1, 0, 0))


def put_actor(cv, cx, cy):
    cv.paste(actor(), cx * T - 4, cy * T - 14)


def lay(cv, rows, leg, x, y):
    return stamp(cv, rows, leg, x, y)


# ================================================================================================ 마법탑 바닥
# 버들항 성 바닥(castle-catacombs floor_castle·floor_cata)과 같은 문법: 8줄 한 켜(윗줄 빛 · 몸 6줄 · 맨 밑 이음 1줄),
# 세로 이음 한 열 + 그 오른쪽 빛 한 열, 드문 반점. 몸통 변형끼리 아무 순서로 붙어도 이어지게 — 칸 경계(0·15열)를 건너는 돌의 단은
# 켜마다 고정(윗켜 b · 아랫켜 c), 세로 이음은 0·15열에 두지 않는다. 안쪽 돌의 단·이음 자리·반점만 변형마다 다르다.
# A1 다듬은 회청 판석: J 이음(cata 0) · h/H 윗줄·왼열 빛(cata 6 · stone 4) · b/c 몸(cata 3·4) · s 어두운 반점 · t 푸른 밝은 반점
LFA1 = L('J:cata0 K:cata1 h:cata6 H:stone4 b:cata3 c:cata4 s:cata2 t:stone3')
FA1 = [
    [   # 몸통 0 — 윗켜 이음 5·11, 아랫켜 이음 3·10
        'hhhhhJHHHHHJhhhh',
        'bbbbbJHcccccJhbb',
        'bsbbbJHctcccJhbb',
        'bbbbbJHcccccJhbs',
        'bbbtbJHcccscJhbb',
        'bbbbbJHcccccJhbb',
        'bbbbbJHcccccJhbb',
        'JJJJJJJJJJJJJJJJ',
        'HHHJhhhhhhJHHHHH',
        'cccJhbbbbbJHcccc',
        'cccJhbbsbbJHcccc',
        'ctcJhbbbbbJHccsc',
        'cccJhbbbbbJHcccc',
        'cccJhbtbbbJHctcc',
        'cccJhbbbbbJHcccc',
        'JJJJJJJJJJJJJJJJ',
    ],
    [   # 몸통 1 — 윗켜 이음 3·9, 아랫켜 이음 6·13
        'hhhJHHHHHJhhhhhh',
        'bbbJHcccsJhbbbbb',
        'bbbJHccccJhbbbbb',
        'bsbJHtcccJhbbtbb',
        'bbbJHccccJhbbbbb',
        'bbbJHccccJhbbbsb',
        'bbbJHccccJhbbbbb',
        'JJJJJJJJJJJJJJJJ',
        'HHHHHHJhhhhhhJHH',
        'cccccsJhbbbbbJHc',
        'ccccccJhbbtbbJHc',
        'ctccccJhbbbbbJHc',
        'ccccccJhbbbbbJHc',
        'ccccccJhbbbsbJHc',
        'ccccccJhbbbbbJHc',
        'JJJJJJJJJJJJJJJJ',
    ],
    [   # 몸통 2 — 윗켜 이음 7 하나(긴 판석), 아랫켜 이음 2·12
        'hhhhhhhJhhhhhhhh',
        'bbbbbbbJhbbbbbbb',
        'bbsbbbbJhbbbbbbb',
        'bbbbbbbJhbbbtbbb',
        'bbbbbbbJhbbbbbbb',
        'btbbbbbJhbbbbsbb',
        'bbbbbbbJhbbbbbbb',
        'JJJJJJJJJJJJJJJJ',
        'HHJhhhhhhhhhJHHH',
        'ccJhbbbbbbbbJHcc',
        'ccJhbbbtbbbbJHcc',
        'ccJhbbbbbbbbJHsc',
        'ccJhbsbbbbbbJHcc',
        'ccJhbbbbbbtbJHcc',
        'ccJhbbbbbbbbJHcc',
        'JJJJJJJJJJJJJJJJ',
    ],
]

# A2 짙은 나무 널(버들항 하수도 floor_plank 결): 8줄 한 켜 = 윗줄 밝은 e · 몸 d 에 결 c · 맨 밑 이음 a. 세로 이음 a 한 열.
LFA2 = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5')
FA2 = [
    [
        'eeeeeeaeeeeeeeee',
        'ddddddadddcccddd',
        'dcccddaddddddddd',
        'ddddddaddddddccd',
        'dddcccaddddddddd',
        'ddddddadcccddddd',
        'ccccccaccccccccc',
        'aaaaaaaaaaaaaaaa',
        'eeeeeeeeeeeaeeee',
        'ddccdddddddadddd',
        'dddddddcccdadccd',
        'dddddddddddadddd',
        'dccccdddddcadddd',
        'dddddddddddaddcd',
        'ccccccccccca' + 'cccc',
        'aaaaaaaaaaaaaaaa',
    ],
    [
        'eeeaeeeeeeeeeeee',
        'dddadddddccddddd',
        'dcdaddcccddddddd',
        'dddadddddddddccd',
        'dddaddddddcccddd',
        'cddadddddddddddd',
        'cccacccccccccccc',
        'aaaaaaaaaaaaaaaa',
        'eeeeeeeeaeeeeeee',
        'dddddccdadddcccd',
        'dddddddda' + 'ddddddd',
        'dcccddddaddddddd',
        'ddddddddaddccddd',
        'ddddcccdaddddddd',
        'ccccccccaccccccc',
        'aaaaaaaaaaaaaaaa',
    ],
    [
        'eeeeeeeeeeaeeeee',
        'dddcccddddaddddd',
        'ddddddddddaddccd',
        'dccdddddddaddddd',
        'ddddddcccdaddddd',
        'dddddddddda' + 'dccdd',
        'cccccccccca' + 'ccccc',
        'aaaaaaaaaaaaaaaa',
        'eeeeaeeeeeeeeeee',
        'ddddadddcccddddd',
        'dccdaddddddddddd',
        'ddddaddddddccddd',
        'ddddadcccddddddd',
        'ddcdaddddddddcdd',
        'ccccaccccccccccc',
        'aaaaaaaaaaaaaaaa',
    ],
]
for _b in FA1 + FA2:
    assert len(_b) == 16 and all(len(r) == 16 for r in _b), _b

# 바닥 가장자리(벽·허공과 만나는 변): 북 = 벽 밑 그늘 2줄(K·s, 빛 쪽이라 0단은 쓰지 않음) · 서 K 한 열 · 동·남 J 한 열.
FLOOR_FRAME_A1 = (
    ['KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
     'KssssssssssssssssssssssssssssssJ']
    + ['K..............................J'] * 29
    + ['JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ'])
FLOOR_INNER_A1 = ['Ks............sJ', 's..............J'] + ['................'] * 12 + ['J..............J', 'J..............J']
FLOOR_FRAME_A2 = tr(FLOOR_FRAME_A1, {'K': 'b', 's': 'c', 'J': 'a'})
FLOOR_INNER_A2 = tr(FLOOR_INNER_A1, {'K': 'b', 's': 'c', 'J': 'a'})


def floor_rows(bodies):
    """켜 이음이 칸 경계(15|0행)에 오면 칸 격자가 드러난다(관문 S). 그래서 몸통을 4줄 내려 깐다 — 이음은 3·11행.
    그러면 아랫켜(8~15행)가 칸 경계를 넘어 아래 칸 0~3행으로 이어지므로, 모든 변형의 아랫켜는 몸통 0 의 아랫켜와 같게 둔다
    (세로 이음 자리·반점까지). 변형은 윗켜(0~7행)만 다르다."""
    out = []
    for b in bodies:
        rows = b[:8] + bodies[0][8:]
        out.append(rows[12:] + rows[:12])
    return out


def floor_at(key):
    bodies, leg, fr, inn = {'A1': (FA1, LFA1, FLOOR_FRAME_A1, FLOOR_INNER_A1),
                            'A2': (FA2, LFA2, FLOOR_FRAME_A2, FLOOR_INNER_A2)}[key]
    bs = [grid(b, leg) for b in floor_rows(bodies)]
    return autotile_cv(bs[0], grid(fr, leg, 32, 32), grid(inn, leg, 16, 16), bs[1:])


# 룬 상감 2×2(32×32, 같은 바닥 결 위 — 아래층 불투명). 고리 사분면을 손으로 적고 거울로 넷: R 바깥 고리 · r 안 고리 · D 원판 · . 바닥.
# 사분면마다 단을 바꿔 칠해 왼쪽 위가 빛을 받는다.
RUNE_Q = [
    '................',
    '..............RR',
    '..........RRRRRR',
    '........RRRrrrrr',
    '.......RRrrrDDDD',
    '......RRrrDDDDDD',
    '.....RRrDDDDDDDD',
    '....RRrDDDDDDdDD',
    '...RRrDDDDDDdDDD',
    '...RrrDDDDDdDDDD',
    '..RRrDDDDDdDDDDD',
    '..RrrDDDDdDDDDDD',
    '..RrDDDDDDDDDDuu',
    '..RrDDDDDDDDDuDD',
    '.RRrDDDuDDDDuDDD',
    '.RRrDDuDDDDuDDDE',
]
# A1: 놋쇠 고리(gold) + 짙은 검푸른 원판(vrock) + 얼음빛 룬 획(ice) · 가운데 점 E
LRA1 = L('R:gold4 r:gold2 S:gold3 Q:gold1 D:vrock2 d:ice1 u:ice2 E:ice4 F:vrock1 G:ice0 V:gold5', LFA1)
# A2: 놋쇠 고리 + 짙은 나무 원판(wood 1) + 금 룬 획
LRA2 = L('R:gold4 r:gold2 S:gold3 Q:gold1 D:wood1 d:gold2 u:gold3 E:gold5 F:wood0 G:gold1 V:gold5', LFA2)


def rune_inlay(key):
    q = quad4(RUNE_Q, tl={'R': 'V'}, tr_={}, bl={}, br={'R': 'S', 'r': 'Q', 'D': 'F', 'u': 'd', 'd': 'G'})
    fl = floor_at(key)
    leg = LRA1 if key == 'A1' else LRA2
    cv = Cv(32, 32)
    for j in range(2):
        for i in range(2):
            cv.paste(fl.tile_at(255, 7 + i, 3 + j), i * 16, j * 16)
    return stamp(cv, q, leg)


# ------------------------------------------------------------------------------------------------ 탑 방 장면(맥락)
# 천장 = cave-r1 C1(검푸른 돌 혹 테두리), 앞면 = style-r1 맥락 벽돌(성 벽돌), 바닥 = 후보. 둥근 탑 벽은 gap-tower-r1 몫이라 여기서는
# 네모 방으로 맥락만 보인다(대조 시트에는 둥근 탑 장면을 따로 붙인다).
TOWER_ROOM = [
    '##########',
    '##########',
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
]


def tower_room(key, g=TOWER_ROOM):
    return dot.render_cave(g, CR.part('C', 1, 'ceil'), SR.brick_face(), floor_at(key))


def c_floor(key):
    def fn():
        at = floor_at(key)
        inl = rune_inlay(key)
        v = tower_room(key)
        v.paste(inl, 4 * T, 4 * T)
        put_actor(v, 2, 5)
        a2 = Cv(48, 16)
        for i, b in enumerate(at.bodies):
            a2.paste(b, i * 16, 0)
        img = Cv(80, 32)
        img.paste(a2, 0, 0)
        img.paste(at.tile(dot.E | dot.S | dot.W | dot.SE | dot.SW), 0, 16)   # 북 변(벽 밑 그늘)
        img.paste(at.tile(dot.E | dot.S | dot.SE), 16, 16)                    # 북서 바깥 모서리
        img.paste(at.tile(255 & ~dot.NW), 32, 16)                             # 북서 안 모서리
        img.paste(inl, 48, 0)
        return img, {'kind': 'autotile', 'autotiles': {'floor': at}, 'tiles': {'rune': inl}, 'vignette': v,
                     'extras': [('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2), ('47 변형', variants_sheet(at), 2)]}
    return fn


# ================================================================================================ 책장
# 3/4: 윗면(널빤지 3줄 + 앞 턱 1줄) 아래 앞면 틀(왼 기둥 d·c 빛, 오른 기둥 b·a 그늘) · 칸마다 안쪽 어둠 a 위에 책등.
# 책등 한 권 = 2열(왼 빛 단 · 오른 그늘 단), 맨 윗줄은 더 밝은 단, 금박 띠 q·o. 눕힌 책 = 가로 띠(윗줄 빛 · 아랫줄 그늘). 선반 = 윗줄 e · 앞 c.
LSH = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 '
        'V:red4 U:red3 T:red1 Z:water3 Y:water2 X:water1 A:moss5 M:moss4 N:moss2 P:ostone5 O:ostone3 '
        'w:bone4 u:bone2 t:bone1 q:gold4 o:gold2 r:gold5 p:gold3 n:gold1 H:ice4 G:ice2 g:ice1 k:iron4 l:iron5 '
        'S:red2 E:arcane4 D:arcane2 B:arcane1')
SHELF_BOOKS_1 = [   # 칸 26열 × 9줄(맨 밑 줄이 선반에 닿음)
    'aaaaaaaaaaaaaaaaaaaaaaaaaa',
    'VVaaAAaaaaabbbbwwaaaaaaaaa',
    'UTZZMNaaaaabbbbwuZZaaAAaaa',
    'UTYXMNPPaaabbbbwuYXVVMNaaa',
    'qoYXMNPOVVaaaaawuYXUTqoaca',
    'UTqoMNqoUTaaaaawuYXUTMNHGg',
    'UTYXMNPOUTaYYYXwuqoUTMNGGg',
    'UTYXqoPOqoaUUUTwuYXUTMNGGg',
    'TTXXNNOOTTaMMMNuuXXTTNNggg',
]
SHELF_BOOKS_2 = [   # 칸 26열 × 10줄
    'aaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ZZaaVVbbbbaawwaaaZZaaPPaaa',
    'YXPPUTbbbbAAwuaaaYXrrPOaaa',
    'YXPOUTbbbbMNwuaVVYXpnPOAAA',
    'qoPOqoaaaaMNooaUTqopnqoMMN',
    'YXPOUTaaaaqowuaUTYXrrPOqqo',
    'YXqoUTPPPOMNwuaUTYXpnPOMMN',
    'YXPOUTwwwuMNwuaqoYXpnPOMMN',
    'YXPOUTYYYXMNwuaUTYXpnPOMMN',
    'XXOOTTXXXXNNuuaTTXXnnOONNN',
]
SHELF_BOOKS_3 = [   # 높은 책장 맨 아래 칸: 큰 책 눕혀 쌓음 + 선 책 + 둥근 병
    'aaaaaaaaaaaaaaaaaaaaaaaaaa',
    'wwaaZZaaaaaaaaaaVVaaaaaaaa',
    'wuaaYXAAaaaaaaaaUTPPaaaaaa',
    'wuqoYXMNaaacaaaaUTPOZZaaaa',
    'wuqoYXMNaaakaaaaqoPOYXaaaa',
    'oouoqoMNaaHGgaaaUTqoYXPPPP',
    'wuqoYXqoaGGGggaaUTPOYXOOOO',
    'wuqoYXMNaGGGggaUUUUUUUTqqo',
    'wuqoYXMNagGGggaTTTTTTTTMMN',
    'uuooXXNNaaggggaYYYYYYYXMMN',
]
SHELF_TOP_BOOKS = [   # 높은 책장 윗면에 눕힌 책 둘(윗면 위로 솟음 — 그림 맨 위 4줄, 첫 줄 빈 줄)
    '................................',
    '....PPPPPPP.....................',
    '....OOOOOOO.......ZZZZZ.........',
    '...qqqqqqqqo......YYYYYX........',
]
for _r in SHELF_BOOKS_1 + SHELF_BOOKS_2 + SHELF_BOOKS_3:
    assert len(_r) == 26, _r


def shelf(compartments, top_items=None, frame=('dc', 'ba')):
    """책장 행 조립: 윗면 3줄 + 앞 턱 + 윗 띠 + 칸(들) + 선반 + 받침 + 그림자. compartments = [칸 행 묶음]."""
    lf, rf = frame
    rows = []
    if top_items:
        rows += top_items
    rows += ['.' + 'e' * 30 + '.', '.' + 'f' * 30 + '.', '.fffefffffffffffffeffffffffffff.', '.' + 'd' * 29 + 'c.',
             '.' + lf + 'c' * 26 + rf + '.']
    for comp in compartments:
        rows += ['.' + lf + r + rf + '.' for r in comp]
        rows += ['.' + lf + 'e' * 26 + rf + '.', '.' + lf + 'c' * 26 + rf + '.']
    rows += ['.c' + 'b' * 28 + 'a.', '.b' + 'a' * 28 + 'a.', '.' + '~' * 30 + '.', '.' * 32]
    return rows


# A2 = 짙은 나무(b·c 몸) + 놋쇠 모서리 장식 · 칸막이로 나눈 두루마리 칸 / 병과 책
LSH2 = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 '
         'V:red4 U:red3 T:red1 Z:water3 Y:water2 X:water1 A:moss5 M:moss4 N:moss2 P:ostone5 O:ostone3 '
         'w:bone4 u:bone2 t:bone1 q:gold4 o:gold2 r:gold5 p:gold3 n:gold1 H:ice4 G:ice2 g:ice1 k:iron4 l:iron5 '
         'S:red2 E:arcane4 D:arcane2 B:arcane1 F:arcane3 C:arcane5')
SCROLLS_1 = [   # 칸막이 d 두 개(8·17열): 두루마리 더미 둘(둥근 끝 4×4 — 빛 w · 속 t · 그늘 u, 붉은 끈 S) · 눕힌 책 위 얼음빛 병
    'aaaaaaaadaaaaaaaadaaaaaaaa',
    'aaawwaaadaaawwaaadaaaaaaaa',
    'aawtwuaadaawSSuaadaaaaaaca',
    'aawwtuaadaawwtuaadaaaaaaka',
    'aaauuaaadaaauuaaadaaaaaHGg',
    'awwaawwadawwaawwadPPqqPGGg',
    'wtwuwtwudwtwuwtwudOOOOOggg',
    'wwtuwwtudwwtuwSSudUUUUUUUT',
    'auuaauuadauuaauuadTTTTTTTT',
]
_FLASK = ['aaaaa', 'aaaaa', 'aacaa', 'aakaa', 'aVUTa', 'VUUTT', 'UUUTT', 'UUTTT', 'aTTTa', 'aaaaa']
_BOOKS_L = ['aaaaaa', 'ZZaaVV', 'YXAAUT', 'YXMNUT', 'qoMNUT', 'YXMNqo', 'YXqoUT', 'YXMNUT', 'YXMNUT', 'XXNNTT']
_VIAL = ['aaa', 'aaa', 'aaa', 'aca', 'aka', 'CEB', 'EDB', 'DDB', 'DBB', 'BBB']
_BOOKS_R = ['aaaaaa', 'aaPPaa', 'rrPOaa', 'pnPOZZ', 'pnqoYX', 'pnPOYX', 'qoPOqo', 'pnPOYX', 'rrPOYX', 'nnOOXX']
_JAR = ['aaa', 'aaa', 'aaa', 'aaa', 'aaa', 'aaa', 'lkl', 'HGg', 'GGg', 'ggg']
POTIONS_2 = [f + 'a' + bl + 'a' + v + 'a' + br + j for f, bl, v, br, j in zip(_FLASK, _BOOKS_L, _VIAL, _BOOKS_R, _JAR)]
for _r in SCROLLS_1 + POTIONS_2:
    assert len(_r) == 26, _r


def shelf2(compartments, top_items=None):
    """A2 틀: 짙은 몸 + 놋쇠 윗 모서리(q·o)와 받침 장식."""
    rows = []
    if top_items:
        rows += top_items
    rows += ['.' + 'd' * 30 + '.', '.' + 'e' * 30 + '.', '.ede' + 'e' * 24 + 'dde.', '.q' + 'c' * 27 + 'oq.',
             '.oc' + 'b' * 26 + 'bo.']
    for comp in compartments:
        rows += ['.cb' + r + 'ba.' for r in comp]
        rows += ['.cb' + 'd' * 26 + 'ba.', '.cb' + 'b' * 26 + 'ba.']
    rows += ['.qb' + 'a' * 26 + 'ao.', '.ob' + 'a' * 26 + 'an.', '.' + '~' * 30 + '.', '.' * 32]
    return rows


def bookshelf(key, tall=False):
    if key == 'A1':
        comps = [SHELF_BOOKS_1, SHELF_BOOKS_2] + ([SHELF_BOOKS_3] if tall else [])
        return grid(shelf(comps, SHELF_TOP_BOOKS if tall else None), LSH)
    comps = [SCROLLS_1, POTIONS_2] + ([SHELF_BOOKS_3] if tall else [])
    return grid(shelf2(comps, SHELF_TOP_BOOKS if tall else None), LSH2)


# ================================================================================================ 독서대
# 1×2. 비스듬한 책상 윗면(펼친 책이 덮음, 책 양옆으로 책상 가장자리 e·d) → 책상 앞 턱 → 기둥 → 받침. 책: 쪽 w · 글줄 v · 가운데 골 u, 붉은 갈피끈 S.
LLE1 = L('a:wood0 b:wood1 c:wood2 d:wood3 e:wood4 f:wood5 w:bone4 v:bone2 u:bone3 t:bone1 S:red3 T:red1 q:gold4 o:gold2')
LECTERN_A1 = [
    '................',
    '................',
    '................',
    '................',
    '...wwww..wwww...',
    '..wwwwwwwwwwww..',
    '.ewvvvvutvvvvwd.',
    '.ewwwwwutwwwwud.',
    '.ewvvvwutvvvvud.',
    '.ewwwwwutwwwwud.',
    '.ewvvvvutvvvwud.',
    '.ewwwwwutwwwwud.',
    '.feeeeeeSeeeeed.',
    '..dccccSTccccb..',
    '...bbbbSTbbbba..',
    '......dcb.......',
    '......dcb.......',
    '......ecb.......',
    '.....qoooo......',
    '......dcb.......',
    '......dcb.......',
    '......dcb.......',
    '......dcb.......',
    '......dcb.......',
    '.....qoooo......',
    '......dcb.......',
    '.....edcbb......',
    '...eddcccbba....',
    '...dccccccbba...',
    '....bbbbbbaa~...',
    '....~~~~~~~~~...',
    '................',
]
# A2 = 돌 받침 독서대(cata·stone) + 놋쇠 책 받침 + 빛 나는 룬 쪽(얼음빛)
LLE2 = L('a:cata0 b:cata1 c:cata3 d:cata4 e:cata6 f:stone5 g:stone3 w:bone4 v:bone2 u:bone3 t:bone1 '
         'q:gold4 o:gold2 n:gold1 H:ice4 G:ice2 F:ice1 S:red3 T:red1')
LECTERN_A2 = [
    '................',
    '................',
    '................',
    '................',
    '...wwww..wwww...',
    '..wwwwwwwwwwww..',
    '.qwvvvvutwwwwwo.',
    '.qwwwwwutwGHww o'.replace(' ', 'w'),
    '.qwvvvwutwHFGwo.',
    '.qwwwwwutwwGwwo.',
    '.qwvvvvutvvvwwo.',
    '.qwwwwwutwwwwuo.',
    '.qooooooSoooooo.',
    '..fdddddSTdddc..',
    '..edddddSTdddb..',
    '...dccccccccb...',
    '....gdcccccb....',
    '....edcccccb....',
    '....edcgccca....',
    '....edcccccb....',
    '....edcccgcb....',
    '....edcccccb....',
    '....edgccccb....',
    '....edcccccb....',
    '...feeddddcbb...',
    '...edddccccba...',
    '..feddddcccbba..',
    '..edccccccccba..',
    '..dcccccccccba..',
    '...bbbbbbbbbba~.',
    '...~~~~~~~~~~~..',
    '................',
]
for _r in LECTERN_A1 + LECTERN_A2:
    assert len(_r) == 16, _r


def lectern(key):
    return grid(LECTERN_A1, LLE1) if key == 'A1' else grid(LECTERN_A2, LLE2)


# ================================================================================================ 차원 이동진 3×3
# 사분면(24×24)을 손으로 적고 거울로 넷. R·r 바깥 돌 테(빛 쪽 사분면이 밝다) · K 홈 · B 룬 띠 바탕 · g 룬 획(3×3, 사분면마다 셋) ·
# G 빛 고리 · D 안 바닥 · S 살(대각·축) · C 가운데 빛. 장면 4: 빛 고리·살·가운데가 맥동하고 룬 획은 사분면 하나씩 차례로 밝아진다(시계 방향).
CIRCLE_Q = [   # 안쪽 = 겹친 두 네모(팔각 별) + 작은 고리, 축·대각 살 없음
    '......................RR',
    '.................RRRRRRR',
    '..............RRRRrrrrrr',
    '............RRRrrrrKKKKK',
    '...........RRrrrKKKgBgBB',
    '.........RRrrrKKBBBBgggB',
    '........RRrrKKBBBBBBgBgB',
    '.......RRrrKBBBBBBBBBGGG',
    '......RRrrKBBBBBBBGGGGKK',
    '.....RRrrKBgBBBBGGKKKKDS',
    '.....RrrKBgggBGGKKDDDDSD',
    '....RrrKBBBgBGGKDDDDDSDD',
    '...RRrKBBBBBGKKDDDDDSDDD',
    '...RrrKBBBBGKKSSSSSSSSSS',
    '..RRrKBBBBGGKSDDDDSDDDDD',
    '..RrrKBBBBGKDSDDDSDDDDDD',
    '..RrKBBBBGKDDSDDSDDDDDDD',
    '.RRrKgBgBGKDDSDSDDDDDDDD',
    '.RrrKBggGKDDDSSDDDDDDDGG',
    '.RrKBgBBGKDDDSDDDDDDGGDD',
    '.RrKBBBBGKDDSSDDDDDGDDDD',
    '.RrKBBBGGKDSDSDDDDDGDDDC',
    'RRrKBBBGKDSDDSDDDDGDDDCC',
    'RRrKBBBGKSDDDSDDDDGDDCCC',
]
for _r in CIRCLE_Q:
    assert len(_r) == 24, _r

# 사분면 바꿔 칠하기: 테 빛(왼쪽 위 R · 오른쪽 위·왼쪽 아래 P · 오른쪽 아래 Q) · 룬 획 사분면 번호(시계 방향 1 2 3 4)
_CQ = {'tl': {'g': '1'}, 'tr': {'R': 'P', 'g': '2'}, 'br': {'R': 'Q', 'r': 'q', 'g': '3'}, 'bl': {'R': 'P', 'g': '4'}}
CIRCLE_ROWS = quad4(CIRCLE_Q, tl=_CQ['tl'], tr_=_CQ['tr'], bl=_CQ['bl'], br=_CQ['br'])
# 장면별 빛 단: (고리 G, 살 S, 가운데 C, 밝은 룬, 어두운 룬)
CIRCLE_BEAT = [(1, 0, 3), (2, 1, 4), (3, 2, 4), (2, 1, 3)]


def circle(key, k):
    g_, s_, c_ = CIRCLE_BEAT[k]
    if key == 'A1':   # 돌 테 + 검푸른 바닥에 얼음빛 룬
        leg = L(f'R:stone5 P:cata6 Q:cata4 r:cata4 q:cata2 K:vrock1 B:vrock2 D:vrock1 G:ice{g_} S:ice{s_} C:ice{c_}')
        for i, ch in enumerate('1234'):
            leg.update(L(f'{ch}:ice{4 if i == k else 1}'))
        return grid(CIRCLE_ROWS, leg)
    # A2: 바닥 위에 그은 보라 빛 선만(테·홈·바탕은 투명) — 바닥 결이 비친다
    rows = tr(CIRCLE_ROWS, {'K': '.', 'B': '.', 'D': '.', 'r': '.', 'q': '.'})
    leg = L(f'R:arcane{min(g_ + 2, 5)} P:arcane{g_ + 1} Q:arcane{g_} G:arcane{g_ + 1} S:arcane{s_ + 1} C:arcane{min(c_ + 1, 5)}')
    for i, ch in enumerate('1234'):
        leg.update(L(f'{ch}:arcane{5 if i == k else 2}'))
    return grid(rows, leg)


# ================================================================================================ 받침 위 수정 1×2 (3장면 빛)
# 수정 = 곧은 큰 결정(왼 면 L 빛 · 가운데 등 H · 오른 면 M·S 그늘) + 기운 작은 결정 둘. 받침 = 윗면 3줄(f·e) · 앞면 기둥(d·c 빛, b·a 그늘) · 금 띠 · 넓은 발.
# 장면마다 수정 빛 단이 한 단씩 오르내리고(H·L), 둘레에 빛 점 * 이 자리를 바꾼다.
XTAL_PED = [
    '................',
    '.......H........',
    '......LHS.......',
    '......LHMS......',
    '.....LLHMS......',
    '.....LLHMS......',
    '..H..LLHMS......',
    '..LH.LLHMS..H...',
    '..LLSLLHMS.LMS..',
    '...LLSLHMSLLMS..',
    '...LLSLHMSLMS...',
    '...LLSLHMMLMS...',
    '..fLLSLHMMSMSe..',
    '..ffDDLDMDDSee..',
    '..effffffeeeed..',
    '...dddddddddb...',
    '....qqoooooon...',
    '....dccccccba...',
    '....dccccccba...',
    '....dccccccba...',
    '....dccccccba...',
    '....dccccccba...',
    '....dccccccba...',
    '....qqoooooon...',
    '....dccccccba...',
    '...fdddcccccba..',
    '..feeddddcccbba.',
    '..eddcccccccbba.',
    '..dccccccccbbaa.',
    '...bbbbbbbbbaa~.',
    '...~~~~~~~~~~~..',
    '................',
]
XTAL_SPARK = [   # 장면별 빛 점(행, 열)
    [(3, 3), (9, 14)],
    [(1, 10), (5, 2)],
    [(4, 12), (10, 1)],
]
for _r in XTAL_PED:
    assert len(_r) == 16, _r
# 장면별 수정 단: (H 등, L 빛 면, M 가운데, S 그늘, D 밑)
XTAL_BEAT = [(4, 3, 2, 1, 0), (4, 4, 3, 2, 1), (4, 3, 2, 1, 0)]


def crystal_ped(key, k):
    h, l_, m, s_, d = XTAL_BEAT[k]
    if key == 'A1':   # 얼음빛 수정 + 회색 돌 받침 + 금 띠
        leg = L(f'H:ice{h} L:ice{l_} M:ice{m} S:ice{s_} D:ice{d} *:ice4 '
                'f:stone5 e:cata6 d:cata4 c:cata3 b:cata2 a:cata1 q:gold4 o:gold2 n:gold1')
    else:             # 보라 빛 수정 + 짙은 나무 받침 + 금 띠
        leg = L(f'H:arcane5 L:arcane{l_ + 1} M:arcane{m + 1} S:arcane{s_ + 1} D:arcane{d} *:arcane5 '
                'f:wood5 e:wood4 d:wood3 c:wood2 b:wood1 a:wood0 q:gold4 o:gold2 n:gold1')
    rows = [list(r) for r in XTAL_PED]
    for y, x in XTAL_SPARK[k]:
        if rows[y][x] == '.':
            rows[y][x] = '*'
    return grid([''.join(r) for r in rows], leg)


# ================================================================================================ 촛대 1×2 (불꽃 3장면)
# A1 = 쇠 촛대(가운데 높은 초 + 팔 둘, 놋쇠 잔, 세 발) · A2 = 넓은 쇠 접시 위 키가 다른 초 다섯(촛농이 흘러내림).
# 초 = 밀랍 w(빛)·u(그늘)·v(촛농 자국). 불꽃 = fire 단: 끝 L · 몸 K · 밑 J · 심지 H. 장면마다 불꽃 모양만 바뀐다(받침 같음).
LCA = L('w:bone4 u:bone3 v:bone2 q:gold4 o:gold2 n:gold1 g:iron0 h:iron1 i:iron2 j:iron3 k:iron4 l:iron5 '
        'F:fire0 G:fire1 H:fire2 J:fire3 K:fire4 L:fire5')
CANDELABRA_A1 = [
    '................',
    '................',
    '................',
    '................',
    '.......wu.......',
    '.......wu.......',
    '.......wv.......',
    '.......wu.......',
    '..wu...wu...wu..',
    '..wu...wu...wu..',
    '..vu..qoon..wv..',
    '..wu...kj...wu..',
    '.qoon..kj..qoon.',
    '..kj...kj...ki..',
    '..lkkkkkjjjjji..',
    '...iiiiiihhhhh..',
    '.......kj.......',
    '.......kj.......',
    '......lkji......',
    '......kjih......',
    '.......kj.......',
    '.......kj.......',
    '.......kj.......',
    '.......kj.......',
    '......qoon......',
    '.......kj.......',
    '......lkjh......',
    '.....lkjjih.....',
    '....kj.kj.ih....',
    '...kh..kj..ih...',
    '..~~~~~~~~~~~~..',
    '................',
]
CANDELABRA_A2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......wu........',
    '......wu........',
    '......vu..wu....',
    '...wu.wu..wv....',
    '...wu.wv..wu.wu.',
    '...vu.wu..wu.wu.',
    '.wuwu.wuwuwu.vu.',
    '.wvwuvwuwuwuwwu.',
    'lkkkkkkkjjjjjjih',
    '.iiiiiiihhhhhhh.',
    '...hiiiihhhhg...',
    '......kjih......',
    '.......kj.......',
    '.......kj.......',
    '......lkji......',
    '.......kj.......',
    '.......kj.......',
    '.......kj.......',
    '.......kj.......',
    '.......kj.......',
    '......lkji......',
    '.....lkjjih.....',
    '....lkjjjjih....',
    '...kjjjjjjjhh...',
    '...hhhhhhhhhg...',
    '..~~~~~~~~~~~~..',
    '................',
]
FLAMES = [['.L.', 'KLK', 'JKJ', '.H.'], ['L..', 'KL.', 'JKJ', '.H.'], ['..L', '.LK', 'JKJ', '.H.']]
# 불꽃 자리(왼쪽 위 x, y) — 심지 H 가 초 윗줄 바로 위
FLAME_AT = {'A1': [(6, 0), (1, 4), (11, 4)], 'A2': [(5, 1), (2, 4), (9, 3), (12, 5), (0, 7)]}
FLAME_SHIFT = {'A1': [0, 1, 2], 'A2': [0, 2, 1, 0, 2]}   # 불꽃마다 장면 박자를 어긋나게
for _r in CANDELABRA_A1 + CANDELABRA_A2:
    assert len(_r) == 16, _r


def candelabra(key, k):
    cv = grid(CANDELABRA_A1 if key == 'A1' else CANDELABRA_A2, LCA)
    for (x, y), sh in zip(FLAME_AT[key], FLAME_SHIFT[key]):
        stamp(cv, FLAMES[(k + sh) % 3], LCA, x, y)
    return cv


# ================================================================================================ 마계 바닥
# 보라 검은 돌(ostone 2) 판이 금(ostone 0)으로 갈라졌다. 금 왼쪽·위 = 그늘 d, 오른쪽·아래 = 빛 받는 턱 h(cave-r1 carve 와 같은 규칙).
# 몸통 변형끼리 이어지게 금은 변마다 한 곳(위·아래 5열, 왼·오른 10행)으로만 칸 경계를 건넌다 — 안쪽 갈래만 변형마다 다르다.
# A1: 큰 판 + 안쪽 금 한 토막만 빛 줄기(v·V) · A2: 더 어두운 바탕(ostone 1) + 모든 금이 희미하게 빛나는 그물(v), 갈래 마디 V.
from cave_r1 import carve, poly  # noqa: E402

GROUND_BASE = [
    [
        'bbbbbbbbbbbbbbbb',
        'bbsbbbbbbbbbcbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbsbbbbbbb',
        'bcbbbbbbbbbbbbsb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbsbbbbbcbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbsbbbbbbbbbbbbb',
        'bbbbbbbbbbbbsbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbcbbbbbbbb',
        'bsbbbbbbbbbbbbbb',
        'bbbbbbbbbbsbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbcbbbbbbbbbbb',
    ],
    [
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbsbbbbbb',
        'bcbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbcbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbsbbbbb',
        'bbsbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbsb',
        'bbbbbcbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbcbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbsbbbbbbbbbbbb',
        'bbbbbbbbbsbbbbbb',
        'bbbbbbbbbbbbbbbb',
    ],
    [
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbsb',
        'bbbbbbbbbbbbbbbb',
        'bbbsbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbcbbbbbb',
        'bsbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbsbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbsbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbcbbbbbbbbbbbbb',
        'bbbbbbbbbbbsbbbb',
    ],
    [
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbcbbb',
        'bsbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbsbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbsb',
        'bbbcbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbbbbsbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bsbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbbsbbbbbbbb',
    ],
]
# 금 갈래(손으로 고른 꼭짓점). 칸 경계는 (5,0)·(5,15)·(0,10)·(15,10) 네 곳에서만 건넌다 — 모든 변형이 네 곳 모두에 금이 닿되,
# 금은 이어지지 않고 2~3화소 들어가다 끊겨도 된다(끊긴 금 = 큰 판). 변형마다 이어진 정도가 달라 판 크기가 섞인다.
GROUND_CRACKS = [
    [((5, 0), (6, 4), (9, 7), (15, 10)), ((9, 7), (8, 11), (5, 15)), ((0, 10), (2, 11))],
    [((5, 0), (5, 2)), ((5, 15), (6, 13)), ((0, 10), (2, 9)), ((15, 10), (13, 11)), ((8, 5), (11, 6))],
    [((5, 0), (4, 4), (1, 8), (0, 10)), ((15, 10), (12, 12), (9, 12)), ((5, 15), (5, 13))],
    [((5, 0), (6, 2)), ((5, 15), (4, 12), (6, 9), (10, 8)), ((0, 10), (1, 10)), ((15, 10), (14, 9))],
]
GROUND_VEIN_A1 = [((6, 4), (9, 7)), ((8, 5), (11, 6)), ((4, 4), (1, 8)), ((6, 9), (10, 8))]
GROUND_NODES_A2 = [[(9, 7), (8, 11)], [(9, 5)], [(2, 6), (12, 12)], [(6, 9)]]

LGR = {'A1': L('b:ostone2 s:ostone3 c:iron1 k:ostone0 d:ostone1 h:ostone3 v:arcane2 V:arcane3'),
       'A2': L('b:ostone1 s:ostone2 c:ostone3 k:arcane1 d:ostone0 h:ostone3 v:arcane1 V:arcane3')}


def ground_rows(key, i):
    pts = [p for seg in GROUND_CRACKS[i] for p in poly(*seg)]
    rows = carve(GROUND_BASE[i] if key == 'A1' else tr(GROUND_BASE[i], {'c': 's'}), pts, dark='k', shade='d', lit='h')
    g = [list(r) for r in rows]
    if key == 'A1':
        seg = poly(*GROUND_VEIN_A1[i])
        for j, (x, y) in enumerate(seg):
            g[y % 16][x % 16] = 'V' if j == len(seg) // 2 else 'v'
    else:
        for x, y in GROUND_NODES_A2[i]:
            g[y % 16][x % 16] = 'V'
    return [''.join(r) for r in g]


# 벽·문턱과 만나는 보통 가장자리(허공 아닌 곳): 북 2줄 그늘 · 서 한 열 · 동·남 금 한 열
GROUND_FRAME = (
    ['dddddddddddddddddddddddddddddddd',
     'dkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk'.replace('k', 'd', 1)]
    + ['d..............................k'] * 29
    + ['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk'])
GROUND_INNER = ['dd............dk', 'd...............'] + ['................'] * 12 + ['k..............k', 'k..............k']


def ground_at(key):
    leg = LGR[key]
    bs = [grid(ground_rows(key, i), leg) for i in range(4)]
    return autotile_cv(bs[0], grid(GROUND_FRAME, leg, 32, 32), grid(GROUND_INNER, leg, 16, 16), bs[1:])


# ================================================================================================ 허공 가장자리(떠 있는 섬)
# 빌더는 걷는 자리 밖을 허공으로 그린다. 그래서 가장자리 그림은 **바닥 칸**이 진다(낭떠러지 edges.chasm 은 구덩이 칸에 끝선을 얹는
# 반대 문법이라 쓰지 않았다 — 구덩이는 바닥 속 구멍, 이것은 허공 속 바닥).
#   1) 바닥 오토타일(몸통 = other.ground 같은 후보) — 허공과 만나는 북·서·동 변은 허공(k)이 1~3화소 파고든 울퉁불퉁한 턱 +
#      턱 빛(북·서 h, 동 d — 빛은 왼쪽 위), 남 변은 곧은 밝은 턱 두 줄(h·H: 윗면 끝이 빛을 받는다).
#   2) 섬 밑 바위 앞면 2단(32×32 표본, dot.Face 와 같은 자리 규칙: 0~7 왼끝 · 8~23 가운데 16 주기 · 24~31 오른끝) —
#      바닥 바로 남쪽 허공 칸에 1단, 그 밑 칸에 2단. 1단은 위가 밝은 층리, 2단은 어두워지며 고드름처럼 끝이 뾰족하게 허공으로 끊긴다.
#      끝 마구리는 아래로 갈수록 안으로 좁아진다(떠 있는 섬). 투명 자리는 허공 몸통이 비친다(아래층 불투명).
#   3) 허공 몸통 16×16 변형 셋(엔진 해시로 섞음) — 아주 어두운 보라에 드문 빛 티끌.
# 사분면 경계(0·7·8·15열/행)는 표준 깊이(허공 1줄 + 턱 1줄)로 맞춰 조각을 바꿔 끼워도 이어진다.
VE_FRAME = [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkhhhhhhhkkkhhhhhhhhhkkhhhhhkkk',
    'kkh.......hhh.........hh.....hkk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kkh...........................dk',
    'kkh..........................dkk',
    'kkkh.........................dkk',
    'kkh..........................dkk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kkh...........................dk',
    'kkh...........................dk',
    'kkh..........................dkk',
    'kh...........................dkk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'kh............................dk',
    'khhhhhhhhhhhhhhhhhhhhhhhhhhhhhdk',
    'kHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHk',
]
VE_INNER = ['kh............dk', 'h..............d'] + ['................'] * 13 + ['k..............k']
# 섬 밑 앞면 표본 32×32: s 빛 받는 윗층(ostone 3) · b 몸(2) · d 그늘 층(1) · e 깊은 틈(0) · v·V 흘러내린 빛 줄기 · '.' 허공
VE_FACE = [
    '.ssssssssssssssssssssssssssssss.',
    '.bbsbbbbbbsbbbbbbbbbbsbbbbbbbbd.',
    '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbd.',
    '.dbbbbbbbddbbbbbbbbbbbbdddbbbdd.',
    '..ddbbbbbbbdddbbbbbbbddbbbbbbd..',
    '..bbbbbbbbbbbbbbbbbbbbbbbbbbbd..',
    '..bbvbbbbbbbbbbbbbbbbbbbbbbbbd..',
    '..bbvbbbbbbbbbbbbbbbbbbsbbbbdd..',
    '..ddVbbbbbbbbbbbbbbddddbbbbdd...',
    '...dvddbbbbbddddbbbbbbbbbbbdd...',
    '...bvbbbbbbbbbbbbbbbbbbbbbbd....',
    '...bbbbbbbbbbbbbbbbbbbbbbbdd....',
    '...dbbbbbbbbbbbbbbbbbbbbbbdd....',
    '...ddddbbbbbbbbbbbdddddbbdd.....',
    '....ddddddbbbbbbbbbbbbddddd.....',
    '....dddddddddddddddddddddd......',
    '....ddddddddddddddddddddddd.....',
    '....dddddddbddddddddddddvd......',
    '.....dddddddddddddedddddvd......',
    '.....deddddddddddddddddVd.......',
    '.....dddddddddddddddddedv.......',
    '.....ddddddeddddddddddddd.......',
    '......dddddddddddddddedd........',
    '......dddddddddddddeddd.........',
    '......dde.ddddddddd.ddd.........',
    '.......dd..dddd.ddd..ed.........',
    '.......e...ddd..dd...d..........',
    '...........dd...de..............',
    '............d...d...............',
    '................................',
    '................................',
    '................................',
]
# 허공 몸통 변형 셋: k 바탕(ostone 0) · d 드문 얼룩(1) · a 희미한 티끌(arcane 0) · A 빛 티끌(arcane 2)
VOID_BODIES = [
    ['kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkakkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkdkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkAkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkdk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'],
    ['kkkkkkkkkkkkkkkk', 'kkkkkkakkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkdkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kdkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkakkkkk', 'kkkkkkkkkkkkkkkk'],
    ['kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkakkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk',
     'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'],
]
for _r in VE_FRAME + VE_FACE:
    assert len(_r) == 32, _r
LVE = {'A1': L('k:ostone0 d:ostone2 h:ostone4 H:ostone5 s:ostone4 b:ostone3 e:ostone1 v:arcane2 V:arcane3 a:arcane0 A:arcane2'),
       'A2': L('k:ostone0 d:ostone1 h:ostone3 H:ostone4 s:ostone3 b:ostone2 e:ostone0 v:arcane1 V:arcane3 a:arcane0 A:arcane2')}


class VoidEdge:
    """허공 가장자리 한 벌: at(바닥+턱 오토타일) · face(섬 밑 앞면 2단, dot.Face) · voids(허공 몸통 변형)."""

    def __init__(s, at, face, voids):
        s.at, s.face, s.voids = at, face, voids

    def void(s, x, y):
        return s.voids[dot.cell_hash(x, y) % len(s.voids)]

    def render(s, g, objects=()):
        """g: '.' 바닥 · 그 밖 = 허공. 바닥 = 턱 오토타일, 바닥 바로 남쪽 허공 = 앞면 1단, 그 밑 = 2단, 나머지 = 허공."""
        H, W = len(g), len(g[0])
        out = Cv(W * T, H * T)
        isg = lambda X, Y: 0 <= X < W and 0 <= Y < H and g[Y][X] == '.'  # noqa: E731

        def depth(X, Y):
            for d in (1, 2):
                if isg(X, Y - d) and all(not isg(X, Y - e) for e in range(0, d)):
                    return d
            return 0
        for y in range(H):
            for x in range(W):
                if isg(x, y):
                    t = s.at.tile_at(dot.mask_at(g, x, y, lambda c, X, Y: c == '.', edge_conn=False), x, y)
                else:
                    d = depth(x, y)
                    if d:
                        t = Cv(T, T)
                        t.a[:] = s.void(x, y).a
                        t.paste(s.face_tile(d - 1, depth(x - 1, y) != d, depth(x + 1, y) != d), 0, 0)
                    else:
                        t = s.void(x, y)
                out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
        for o, ox, oy in objects:
            out.paste(o, ox, oy)
        return out

    def face_tile(s, level, lo, ro):
        return s.face_raw.tile(level, lo, ro)


def void_edge(key):
    leg = LVE[key]
    gat = ground_at(key)
    at = autotile_cv(gat.body, grid(VE_FRAME, leg, 32, 32), grid(VE_INNER, leg, 16, 16), gat.bodies[1:])
    voids = [grid(b, leg) for b in VOID_BODIES]
    raw = grid(VE_FACE, leg, 32, 32)            # 투명 = 허공(그릴 때 칸 자리 허공 몸통 위에 얹는다)
    face_trans = dot.Face(raw)
    block = Cv(32, 32)                         # 관문용 불투명 표본: 표본 열 c → 칸 열(0~7→0~7, 8~15→0~7, 16~23→8~15, 24~31→8~15) 의 허공 0번
    for y in range(32):
        for c in range(32):
            tc = c if c < 8 else (c - 8 if c < 16 else (c - 8 if c < 24 else c - 16))
            block.a[y, c] = voids[0].a[y % 16, tc]
    block.paste(raw, 0, 0)
    ve = VoidEdge(at, dot.Face(block), voids)
    ve.face_raw = face_trans
    return ve


def pad(rows, w):
    """손으로 적은 행의 오른쪽을 투명으로 채운다(넘치면 오류)."""
    for r in rows:
        assert len(r) <= w, (len(r), r)
    return [r + '.' * (w - len(r)) for r in rows]


# ================================================================================================ 타락한 수정 1×2 · 2×2
# 결정 = 등 H · 빛 면 L · 가운데 M · 그늘 면 S · 속 금 c(그늘 단의 짧은 틈) · 밑 D. 바위 받침 = o(윗면 빛) r(몸) q(그늘) p(밑 그늘).
# A1 보라 빛(arcane) · A2 붉은 빛(red·fire) 결정에 보라 검은 속 금.
XTAL_S = pad([
    '................',
    '................',
    '................',
    '................',
    '................',
    '........H.......',
    '.......LHS......',
    '.......LHMS.....',
    '......LLHMS.....',
    '......LLHMS.....',
    '......LcHMS.....',
    '......LLHcS.....',
    '.....LLLHMSS....',
    '.....LLcHMMS....',
    '.....LLLHMcS....',
    '.....LcLHMMS....',
    '.....LLLHMMS....',
    '..H..LLLHcMS....',
    '..LH.LcLHMMS....',
    '.LLHSLLLHMMSS...',
    '.LLHSLLLHMMSS.H.',
    '.LcHSLLLHMMSSLHS',
    '..LHSLLLHMcSSLMS',
    '..LHSLLcHMMSSLMS',
    '..LHSLLLHMMSSLMS',
    '.ooDDLLLHMMSDDDq',
    '.orroDDDDDDDDrqp',
    'orrrrooorrrrqqpp',
    'orrqrrrrrqrrqqp.',
    '.rrrrqrrrrqqqpp.',
    '..qqqqqqqqqpppp.',
    '...~~~~~~~~~~~..',
], 16)
XTAL_L = pad([
    '................................',
    '................H...............',
    '...............LHS..............',
    '..............LLHMS.............',
    '..............LLHMS.............',
    '.............LLLHMSS............',
    '.............LcLHMMS............',
    '......H......LLLHcMS............',
    '.....LHS.....LLLHMMS............',
    '.....LLHS....LLcHMMS.....H......',
    '.....LLHMS...LLLHMMS....LHS.....',
    '......LLHMS..LLLHMcS...LLHS.....',
    '......LcHMS..LcLHMMS...LLHMS....',
    '......LLLHMS.LLLHMMS..LLcHMS....',
    '.......LLHMS.LLLHMMS..LLLHMS....',
    '.......LcLHMSLLLHMMSS.LLHMMS....',
    '..H.....LLHMSLLcHMMSS.LLHMS.....',
    '.LHS....LLHMSLLLHMcSS.LcHMS.....',
    '.LLHS...LLLHMLLLHMMSSLLHMMS..H..',
    '.LcHS...LcLHMLLLHMMSSLLHMS..LHS.',
    '..LHMS...LLHMLLLHMMSSLLHMS..LHMS',
    '..LLHS...LLHMLcLHMMSLLHMMS.LLHMS',
    '..LLHMS..LLHMLLLHMMSLLHMS..LcHS.',
    '..LLHMSo.LLHMLLLHMMSLLHMSo.LLHS.',
    '.ooDDDSoooDDDDDDDDDDDDDDDoooDDDo',
    '.orrrroorrrrooorrrrrooorrrrrrrq.',
    'orrqrrrrrrqrrrrrrqrrrrrrqrrrrqqp',
    'orrrrrqrrrrrrrqrrrrrrrqrrrrqqqpp',
    '.qrrrrrrrqrrrrrrrrrrqrrrrrqqqpp.',
    '..qqqqqqqqqqqqqqqqqqqqqqqqqpppp.',
    '...pppppppppppppppppppppppppp...',
    '...~~~~~~~~~~~~~~~~~~~~~~~~~~...',
], 32)
LXC = {'A1': L('H:arcane5 L:arcane3 M:arcane2 S:arcane1 c:arcane1 D:arcane0 o:ostone4 r:ostone3 q:ostone2 p:ostone1'),
       'A2': L('H:fire5 L:red3 M:red1 S:red0 c:red0 D:ostone3 o:ostone4 r:ostone3 q:ostone2 p:ostone1')}


def corrupt_crystal(key):
    return grid(XTAL_S, LXC[key]), grid(XTAL_L, LXC[key])


# ================================================================================================ 마왕 옥좌 3×3 (단 위)
# 왼쪽 반(24열)을 적고 거울로 오른쪽 — 오른쪽 뿔·해골·보석은 그늘 단으로 바꿔 칠한다.
# 등받이 = 돌 가시 셋이 솟은 돌 틀(e 윗면 빛 · d·c 몸 · b 그늘) 안의 어두운 판 a 에 빛 마름모 새김 D·B · 꼭대기 보석 E·C·D·B · 앉는 자리만 붉은 천(T·R·S).
# 뿔 = 뼈(w·u·t), 팔걸이 끝 = 해골. 단 두 층 = 윗면(e·d) + 앞면(c·b 이음), 가운데로 붉은 깔개가 단을 타고 내려온다.
THRONE_L = [
    '........................',
    '.......................E',
    '...w...........e.......E',
    '...wu..........ed.....EC',
    '....wu........edd.....EC',
    '....wu..e.....edc....qCD',
    '.....wued.....edc....qDB',
    '.....wuedc...eddcc...qoB',
    '......wedcceeedddcceeqqo',
    '......wudddddddcccccddqq',
    '.......tdccbbbbbbbbbbbbb',
    '........dcbaaaaaaaaaaaaD',
    '........dcbaaaaaaaaaaaDB',
    '........dcbaaaaaaaaaaDaa',
    '........dcbaaaaaaaaaDaaa',
    '........dcbaaaaaaaaaaDaa',
    '........dcbaaaaaaaaaaaDB',
    '........dcbaaaaaaaaaaaaD',
    '........dcbaaaaaaaaaaaaB',
    '........dcbaaaaaaaaaaaaa',
    '........dcbbbbbbbbbbbbbb',
    '...eeeeeedcbqqqqqqqqqqqq',
    '..eddddddecbbbbbbbbbbbbb',
    '..dddddddecTTTTTTTTTTTTT',
    '..cuwwwucdcRRRRRRRRRRRRR',
    '..cwtwtwcdcRRRRRRRRRRRRR',
    '..cwwwwwcdcSSSSSSSSSSSSS',
    '..cuwuwucdcqqqqqqqqqqqqq',
    '..bccccccbcccccccccccccc',
    '..bccccccbccccbcccccbccc',
    '..bbbbbbbbbbbbbbbbbbbbbb',
    '.eeeeeeeeeeeeeeeeeeqTTTT',
    '.edddddddddddddddddqRRRR',
    '.ddddddddddddddddddqRRRR',
    '.ddddddddddddddddddqRRRR',
    '.ccccccccccccccccccqSSSS',
    '.cbccccbcccccbcccccqRRRR',
    '.ccccccccccccccccbcqRRRR',
    '.bbbbbbbbbbbbbbbbbbqSSSS',
    'eeeeeeeeeeeeeeeeeeeqTTTT',
    'dddddddddddddddddddqRRRR',
    'dddddddddddddddddddqRRRR',
    'cccccccccccccccccccqSSSS',
    'cbccccccbccccccbcccqRRRR',
    'cccccbcccccccbcccccqRRRR',
    'bbbbbbbbbbbbbbbbbbbqSSSS',
    '~~~~~~~~~~~~~~~~~~~~~~~~',
    '........................',
]
for _r in THRONE_L:
    assert len(_r) == 24, _r
LTH = {'A1': L('w:bone4 u:bone3 t:bone2 v:bone1 a:ostone1 b:ostone2 c:ostone3 d:ostone4 e:ostone5 q:gold4 o:gold2 '
               'R:red3 S:red1 T:red4 E:arcane5 C:arcane4 D:arcane3 B:arcane2'),
       'A2': L('w:bone4 u:bone3 t:bone2 v:bone1 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 q:gold4 o:gold2 '
               'R:arcane2 S:arcane1 T:arcane3 E:red4 C:red3 D:red1 B:red0')}


def throne(key):
    return grid(halves(THRONE_L, {'w': 'u', 'u': 't', 't': 'v', 'E': 'C', 'C': 'D', 'D': 'B', 'T': 'R'}), LTH[key])


# ================================================================================================ 가시 뼈 기둥 1×2
# 등뼈 마디를 쌓은 기둥(마디 윗면 w 빛 · u 몸 · t 그늘, 마디 사이 어두운 틈 v) + 양옆으로 뻗은 뼈 가시, 꼭대기 해골, 보라 검은 바위 받침.
BONE_PILLAR = pad([
    '................',
    '......wwww......',
    '.....wwwwuu.....',
    '.....wkwwku.....',
    '.....wwwwuu.....',
    '......wtwt......',
    '.......uu.......',
    '.w....wwuu......',
    '.uw..wuuuut..t..',
    '..uwwuuuuutuut..',
    '...tuvvvvvtt....',
    '.....wwwuu......',
    '....wuuuuut.....',
    '...wuvvvvvtt..w.',
    '.w...wwwuu...wu.',
    '.uw.wuuuuutuut..',
    '..uwuvvvvvtt....',
    '.....wwwuu......',
    '....wuuuuut.....',
    '....tvvvvvt.....',
    '.....wwwuu..w...',
    '..w.wuuuuutwu...',
    '..uwuvvvvvtt....',
    '...tvwwwuu......',
    '....wuuuuut.....',
    '...ooovvvvtqq...',
    '..orrrroorrqqp..',
    '.orrqrrrrrqrqqp.',
    '.rrrrrrqrrrrqpp.',
    '..qqqqqqqqqqpp..',
    '...~~~~~~~~~~...',
    '................',
], 16)
LBP = {'A1': L('w:bone4 u:bone3 t:bone2 v:bone0 k:ostone0 o:ostone4 r:ostone3 q:ostone2 p:ostone1'),
       'A2': L('w:ostone5 u:ostone4 t:ostone3 v:ostone1 k:arcane4 o:bone3 r:bone2 q:bone1 p:bone0')}


def bone_pillar(key):
    return grid(BONE_PILLAR, LBP[key])


# ================================================================================================ 보라 불꽃 화로 1×2 (3장면)
# A1 = 쇠 그릇 + 세 발 받침(버들항 화산 동굴 돌 화로 비례) · A2 = 보라 검은 돌 기둥 화로(앞면에 빛 새김).
# 불꽃 = arcane: 끝 C(5) · 몸 E(4) · F(3) · 밑 D(2) · 숯 B(1).
BRAZIER_A1 = pad([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..lllllllllll...',
    '..kBDBDBDBDBkh..',
    '..kjjjjjjjjjih..',
    '...jkkkjjjjih...',
    '....hiiiiiih....',
    '......kjh.......',
    '......kjh.......',
    '......kjh.......',
    '.....qoooon.....',
    '......kjh.......',
    '......kjh.......',
    '......kjh.......',
    '......kjh.......',
    '......kjh.......',
    '......kjh.......',
    '.....lkjih......',
    '....lkj.jih.....',
    '...lk..j..ih....',
    '..lk...j...ih...',
    '..k....j....h...',
    '..~~~~~~~~~~~~..',
    '................',
    '................',
    '................',
], 16)
BRAZIER_A2 = pad([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..eeeeeeeeeeee..',
    '..dBDBDBDBDBDb..',
    '..dccccccccccb..',
    '..cbbbbbbbbbba..',
    '...dcccccccba...',
    '....dcccccba....',
    '....dcDDccba....',
    '....dcDcccba....',
    '....dcDDccba....',
    '....dccccDba....',
    '....dccDDDba....',
    '....dcccccba....',
    '....dccccDba....',
    '....dcDDccba....',
    '....dcccccba....',
    '...edccccccba...',
    '..eddcccccccba..',
    '..dccccccccbba..',
    '..cbbbbbbbbbaa..',
    '...~~~~~~~~~~~..',
    '................',
    '................',
    '................',
    '................',
], 16)
VFLAMES = [   # 9×9, (3, 1) 에 얹는다(맨 밑 줄 = 그릇 속 숯 9행). 바깥 D(어두운 보라) → F → E → 밑 가운데 심 C(가장 밝음)
    ['....D....', '...DF....', '...DFD.D.', '..DFEFDF.', '..DFEEFD.', '.DFECEFD.', '.DFECCEFD', '.DFECCEFD', 'DDBDBDBDD'],
    ['.....D...', '....FD...', '.D..FFD..', '.FDDFEFD.', '.DFEEEFD.', 'DFEECEFD.', 'DFECCCEFD', '.DFECCEFD', 'DDBDBDBDD'],
    ['...D.....', '...DF..D.', '..DFFD.F.', '..DFEFDF.', '.DFEEEFD.', '.DFECEEFD', 'DFECCCEFD', 'DFEECCEFD', 'DDBDBDBDD'],
]
LBZ = {'A1': L('l:iron5 k:iron4 j:iron3 i:iron2 h:iron1 q:gold4 o:gold2 n:gold1 '
               'C:arcane5 E:arcane4 F:arcane3 D:arcane2 B:arcane1'),
       'A2': L('e:ostone5 d:ostone4 c:ostone3 b:ostone2 a:ostone1 '
               'C:arcane5 E:arcane4 F:arcane3 D:arcane2 B:arcane1')}


def brazier(key, k):
    cv = grid(BRAZIER_A1 if key == 'A1' else BRAZIER_A2, LBZ[key])
    stamp(cv, VFLAMES[k], LBZ[key], 3, 1)
    return cv


# ================================================================================================ 봉인된 차원문 3×3 (닫힘 · 열림 3장면)
# 왼쪽 반 24열 + 거울. 돌 기둥(뿔 장식 · 앞면 빛 새김 D) + 뾰족 아치(e 바깥 빛 · d·c 띠 · b·a 안 그늘) + 꼭대기 쐐기돌 보석 + 문턱 3줄.
# 안쪽 숫자 0~4 = 소용돌이 고리 번호(아치 안을 손으로 매긴 표 — 가운데 9). 닫힘 = 고리 번호를 어두운 돌 두 단(k·K)으로 칠해
# 굳은 소용돌이 판 + X 자 쇠사슬 + 가운데 봉인 메달. 열림 = 고리 번호를 빛 단으로 칠하고 장면마다 한 고리씩 밀어 안으로 빨려 든다.
PORTAL_L = [
    '........................',
    '..w.....................',
    '..wu...................e',
    '...wu................eeq',
    '...wu..............eedqE',
    '..eeeee..........eeddcqC',
    '.eddddde.......eeddccbqD',
    '.dcccccdc....eeddccbbaao',
    '.dcccccdcc.eeddccbba4444',
    '.dcccccdcceddccbba444433',
    '.dcccccdcdddccbba4443333',
    '.dcccccdcdccbba044433333',
    '.dcccccdcdcbba0444333332',
    '.dcccccdcdcba00444333222',
    '.dbbbbbdcdba000443332222',
    '.dcccccdcdba004443322221',
    '.dcDDDcdcdba004433322211',
    '.dccDccdcdba004433222111',
    '.dcDcDcdcdba044433222111',
    '.dccDccdcdba044333221110',
    '.dbbbbbdcdba044332221100',
    '.dcccccdcdba044332211100',
    '.dcccccdcdba044332211000',
    '.dcccccdcdba044332211000',
    '.dcccccdcdba044332211009',
    '.dcccccdcdba044332211109',
    '.dbbbbbdcdba044332221109',
    '.dcccccdcdba044333221119',
    '.dcccccdcdba044433222111',
    '.dcccccdcdba004433322222',
    '.dcccccdcdba004433322222',
    '.dcccccdcdba004443332222',
    '.dbbbbbdcdba000444333333',
    '.dcccccdcdba100444333333',
    '.dcccccdcdba100044443333',
    '.dcccccdcdba110004444444',
    '.dcccccdcdba110004444444',
    '.dcccccdcdba111000044444',
    '.dbbbbbdcdba111100000444',
    '.dcccccdcdba211110000000',
    '.dcccccdcdba221111000000',
    '.dcccccdcdba222111110000',
    '.eeeeeeeeeeeeeeeeeeeeeee',
    'eddddddddddddddddddddddd',
    'dcccccccccccccbccccccccc',
    'cbbbbbbbbbbbbbbbbbbbbbbb',
    '~~~~~~~~~~~~~~~~~~~~~~~~',
    '........................',
]
for _r in PORTAL_L:
    assert len(_r) == 24, _r
# 닫힘 덧칠(왼쪽 반): 쇠사슬 g·h(대각 둘 — 거울로 X) · 봉인 메달 q·o 테 + 빛 새김 B·D·E·C
PORTAL_SEAL = ['.' * 24] * 48
_seal = [list(r) for r in PORTAL_SEAL]
for _t in range(7):
    for _x, _y in ((12 + _t, 10 + _t), (12 + _t, 11 + _t), (12 + _t, 40 - _t), (12 + _t, 39 - _t)):
        _seal[_y][_x] = 'g' if (_t % 2 == 0) else 'h'
for _i, _r in enumerate(['..qqq', '.qooo', 'qoBBB', 'qoBDE', 'qoBEC', 'qoBDE', 'qoBBB', '.qooo', '..qqq']):
    for _j, _c in enumerate(_r):
        if _c != '.':
            _seal[21 + _i][19 + _j] = _c
PORTAL_SEAL = [''.join(r) for r in _seal]
LPO = {'A1': L('w:bone4 u:bone3 e:ostone5 d:ostone4 c:ostone3 b:ostone2 a:ostone1 q:gold4 o:gold2 '
               'E:arcane5 C:arcane4 D:arcane3 B:arcane2 g:iron4 h:iron2 k:ostone1 K:ostone0'),
       'A2': L('w:bone4 u:bone3 e:vrock4 d:vrock3 c:vrock2 b:vrock1 a:vrock0 q:gold4 o:gold2 '
               'E:fire5 C:fire4 D:red3 B:red1 g:iron4 h:iron2 k:vrock1 K:vrock0')}
SWIRL = {'A1': ['arcane0', 'arcane1', 'arcane2', 'arcane3', 'arcane4', 'arcane5'],
         'A2': ['red0', 'red1', 'red3', 'fire3', 'fire4', 'fire5']}


def portal(key, opened, k=0):
    leg = dict(LPO[key])
    if not opened:
        rows = halves(tr(PORTAL_L, {'0': 'k', '1': 'K', '2': 'k', '3': 'K', '4': 'k', '9': 'K'}), {'w': 'u'})
        cv = grid(rows, leg)
        stamp(cv, halves(PORTAL_SEAL, {'E': 'C'}), leg, 0, 0)
        return cv
    sw = SWIRL[key]
    for i in range(5):
        leg[str(i)] = L(f'x:{sw[(i + k) % 5]}')['x']
    leg['9'] = L(f'x:{sw[5]}')['x']
    return grid(halves(PORTAL_L, {'w': 'u'}), leg)


# ================================================================================================ 장면
# 마법탑 기물 = 탑 방(바닥 A1 다듬은 판석) 위 · 마계 기물 = 떠 있는 섬(허공 가장자리 A1) 위. 두 후보 모두 같은 장면 바탕.
ISLAND = [
    '            ',
    '  ........  ',
    ' .......... ',
    ' .......... ',
    ' .........  ',
    '  .......   ',
    '   .....    ',
    '            ',
    '            ',
]
ISLAND_BIG = [
    '                ',
    '  ...........   ',
    ' .............  ',
    ' .............. ',
    ' ............   ',
    '  ..........    ',
    '  .........   ..',
    '   ......     ..',
    '              ..',
    '                ',
    '                ',
]


def island(key='A1', g=ISLAND):
    return void_edge(key).render(g)


def anim_scenes(frames, place, base):
    out = []
    for f in frames:
        v = base()
        place(v, f)
        out.append(v)
    return out


def objs_meta(parts, scenes, top_rows=None):
    m = {'kind': 'objects' if len(parts) > 1 else 'object', 'parts': parts, 'vignette': scenes[0]}
    if len(scenes) > 1:
        m['anim'] = scenes
    if top_rows:
        m['top_rows'] = top_rows
    return m


def c_bookshelf(key, tall):
    def fn():
        cv = bookshelf(key, tall)
        v = tower_room('A1')
        v.paste(cv, 2 * T, (2 if not tall else 1) * T)
        v.paste(cv, 6 * T, (2 if not tall else 1) * T)
        put_actor(v, 5, 5)
        top = [4, 6] if tall else [0, 2]
        return cv, objs_meta({'책장': cv}, [v], {'책장': top})
    return fn


def c_lectern(key):
    def fn():
        cv = lectern(key)
        v = tower_room('A1')
        v.paste(cv, 4 * T, 3 * T)
        v.paste(bookshelf('A1'), 6 * T, 2 * T)
        put_actor(v, 4, 5)
        return cv, objs_meta({'독서대': cv}, [v])
    return fn


def c_circle(key):
    def fn():
        fs = [circle(key, k) for k in range(4)]

        def place(v, f):
            v.paste(f, 3 * T, 3 * T)
            put_actor(v, 7, 5)
        sc = anim_scenes(fs, place, lambda: tower_room('A1'))
        return hcat(*fs), objs_meta({f'장면{i + 1}': f for i, f in enumerate(fs)}, sc)
    return fn


def c_crystal_ped(key):
    def fn():
        fs = [crystal_ped(key, k) for k in range(3)]

        def place(v, f):
            v.paste(f, 2 * T, 3 * T)
            v.paste(f, 7 * T, 3 * T)
            put_actor(v, 5, 5)
        sc = anim_scenes(fs, place, lambda: tower_room('A1'))
        return hcat(*fs), objs_meta({f'장면{i + 1}': f for i, f in enumerate(fs)}, sc)
    return fn


def c_candelabra(key):
    def fn():
        fs = [candelabra(key, k) for k in range(3)]

        def place(v, f):
            v.paste(f, 2 * T, 3 * T)
            v.paste(f, 7 * T, 3 * T)
            put_actor(v, 5, 5)
        sc = anim_scenes(fs, place, lambda: tower_room('A1'))
        return hcat(*fs), objs_meta({f'장면{i + 1}': f for i, f in enumerate(fs)}, sc)
    return fn


def c_tower_floor(key):
    return c_floor(key)


def c_ground(key):
    def fn():
        at = ground_at(key)
        v = dot.render_cave(TOWER_ROOM, CR.part('C', 1, 'ceil'), SR.brick_face(), at)
        put_actor(v, 4, 5)
        img = Cv(64, 16)
        for i, b in enumerate(at.bodies):
            img.paste(b, i * 16, 0)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v,
                     'extras': [('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2), ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


def c_void_edge(key):
    def fn():
        ve = void_edge(key)
        v = ve.render(ISLAND_BIG)
        put_actor(v, 6, 3)
        put_actor(v, 15, 7)
        img = Cv(96, 32)
        img.paste(ve.at.tile(0), 0, 0)                         # 외딴 발판 한 칸
        img.paste(ve.at.tile(dot.E | dot.S | dot.SE), 16, 0)    # 북서 모서리
        img.paste(ve.at.tile(dot.W | dot.E | dot.S | dot.SW | dot.SE), 32, 0)   # 북 변
        img.paste(ve.voids[0], 48, 0)
        img.paste(ve.voids[1], 64, 0)
        img.paste(ve.voids[2], 80, 0)
        blk = Cv(96, 32)
        blk.paste(img.crop(0, 0, 96, 16), 0, 0)
        blk.paste(ve.face.b.crop(0, 0, 32, 16), 0, 16)
        blk.paste(ve.face.b.crop(0, 16, 32, 16), 32, 16)
        blk.paste(ve.voids[0], 64, 16)
        blk.paste(ve.voids[0], 80, 16)
        small = ve.render(['      ', ' ..   ', ' ..  .', '      ', '      '])
        return blk, {'kind': 'autotile', 'autotiles': {'edge': ve.at}, 'faces': {'underside': ve.face},
                     'tiles': {f'void{i}': t for i, t in enumerate(ve.voids)}, 'vignette': v,
                     'extras': [('47 변형(허공 쪽 턱)', variants_sheet(ve.at), 2), ('섬 밑 앞면 표본 32×32', ve.face.b, 3),
                                ('떠 있는 작은 발판', small, 2), ('허공 몸통 6×6 섞음', void_mosaic(ve), 2)]}
    return fn


def void_mosaic(ve, n=6):
    out = Cv(n * T, n * T)
    for j in range(n):
        for i in range(n):
            out.paste(ve.void(i, j), i * T, j * T)
    return out


def c_xtal(key, big):
    def fn():
        s_, l_ = corrupt_crystal(key)
        cv = l_ if big else s_
        v = island()
        if big:
            v.paste(cv, 3 * T, 2 * T)
        else:
            v.paste(cv, 3 * T, 2 * T)
            v.paste(cv, 8 * T, 3 * T)
        put_actor(v, 6, 4)
        return cv, objs_meta({'수정': cv}, [v])
    return fn


def c_throne(key):
    def fn():
        cv = throne(key)
        v = island()
        v.paste(cv, 4 * T, 1 * T)
        put_actor(v, 2, 4)
        return cv, objs_meta({'옥좌': cv}, [v])
    return fn


def c_bone_pillar(key):
    def fn():
        cv = bone_pillar(key)
        v = island()
        v.paste(cv, 3 * T, 2 * T)
        v.paste(cv, 8 * T, 2 * T)
        put_actor(v, 5, 4)
        return cv, objs_meta({'기둥': cv}, [v])
    return fn


def c_brazier(key):
    def fn():
        fs = [brazier(key, k) for k in range(3)]

        def place(v, f):
            v.paste(f, 3 * T, 2 * T)
            v.paste(f, 8 * T, 2 * T)
            put_actor(v, 5, 4)
        sc = anim_scenes(fs, place, island)
        return hcat(*fs), objs_meta({f'장면{i + 1}': f for i, f in enumerate(fs)}, sc)
    return fn


def c_portal(key):
    def fn():
        shut = portal(key, False)
        opens = [portal(key, True, k) for k in range(3)]

        def place(v, f):
            v.paste(f, 4 * T, 1 * T)
            put_actor(v, 2, 4)
        sc = anim_scenes([shut] + opens, place, island)
        parts = {'닫힘': shut}
        parts.update({f'열림{i + 1}': f for i, f in enumerate(opens)})
        m = objs_meta(parts, sc)
        m['anim'] = [sc[0]] * 3 + sc[1:] * 2   # 닫힘 1초 → 열림 소용돌이
        return hcat(shut, *opens), m
    return fn


ITEM_FNS = {
    'arcane.tower_floor': c_tower_floor,
    'arcane.bookshelf': lambda k: c_bookshelf(k, False),
    'arcane.bookshelf_tall': lambda k: c_bookshelf(k, True),
    'arcane.lectern': c_lectern,
    'arcane.teleport_circle': c_circle,
    'arcane.crystal_pedestal': c_crystal_ped,
    'arcane.candelabra': c_candelabra,
    'other.ground': c_ground,
    'other.void_edge': c_void_edge,
    'other.crystal': lambda k: c_xtal(k, False),
    'other.crystal_big': lambda k: c_xtal(k, True),
    'other.throne': c_throne,
    'other.bone_pillar': c_bone_pillar,
    'other.brazier': c_brazier,
    'other.portal': c_portal,
}
NOTES = {
    ('arcane.tower_floor', 'A1'): '다듬은 회청 판석(버들항 성 바닥 문법 — 8줄 켜, 윗줄·왼열 빛) 몸통 셋 + 놋쇠 고리·얼음빛 룬 상감 2×2',
    ('arcane.tower_floor', 'A2'): '짙은 나무 널(버들항 하수도 널 바닥 결) 몸통 셋 + 놋쇠 고리·금 룬 상감 2×2',
    ('arcane.bookshelf', 'A1'): '밝은 나무 틀, 두 칸에 색 책등(금박 띠)·눕힌 책·얼음빛 병',
    ('arcane.bookshelf', 'A2'): '짙은 나무 + 놋쇠 모서리, 위 칸 칸막이 두루마리 더미, 아래 칸 물약 병과 책',
    ('arcane.bookshelf_tall', 'A1'): '2×2 A1 에 큰 책 칸 하나 더 + 윗면에 눕힌 책',
    ('arcane.bookshelf_tall', 'A2'): '2×2 A2 에 큰 책 칸 하나 더 + 윗면에 눕힌 책',
    ('arcane.lectern', 'A1'): '나무 독서대(놋쇠 고리 둘, 세 발) 위 펼친 책 + 붉은 갈피끈',
    ('arcane.lectern', 'A2'): '돌 받침 독서대 + 놋쇠 책 받침, 쪽에 얼음빛 룬',
    ('arcane.teleport_circle', 'A1'): '돌 테 + 검푸른 바닥에 얼음빛 룬 띠·팔각 별·가운데 빛, 룬이 시계 방향으로 차례로 밝아짐(4장면)',
    ('arcane.teleport_circle', 'A2'): '바닥 위에 그은 보라 빛 선만(테 없음, 바닥 결이 비침), 같은 박자',
    ('arcane.crystal_pedestal', 'A1'): '회색 돌 받침 + 금 띠 + 얼음빛 수정 덩이, 빛 단·빛 점이 바뀜(3장면)',
    ('arcane.crystal_pedestal', 'A2'): '짙은 나무 받침 + 금 띠 + 보라 빛 수정 덩이',
    ('arcane.candelabra', 'A1'): '쇠 촛대 — 가운데 높은 초 + 팔 둘, 놋쇠 잔, 세 발(불꽃 3장면, 초마다 박자 다름)',
    ('arcane.candelabra', 'A2'): '넓은 쇠 접시 위 키가 다른 초 다섯 + 촛농',
    ('other.ground', 'A1'): '보라 검은 큰 판, 금 일부에 보라 빛 줄기(몸통 넷, 금은 칸 경계 네 곳에서만 건넘)',
    ('other.ground', 'A2'): '더 어두운 바탕, 모든 금이 희미하게 빛나는 그물 + 갈래 마디',
    ('other.void_edge', 'A1'): '허공 쪽 북·서·동 울퉁불퉁한 턱 + 남쪽 밝은 턱, 그 밑 섬 바위 2단(층리·빛 줄기·뾰족한 밑), 허공 몸통 셋',
    ('other.void_edge', 'A2'): 'A2 바닥 + 한 단 어두운 턱·섬 밑',
    ('other.crystal', 'A1'): '보라 빛 결정 + 작은 결정 둘, 보라 검은 바위 받침',
    ('other.crystal', 'A2'): '붉은 빛 결정(자주 그늘), 같은 받침',
    ('other.crystal_big', 'A1'): '보라 빛 결정 무리 다섯, 넓은 바위 받침',
    ('other.crystal_big', 'A2'): '붉은 빛 결정 무리',
    ('other.throne', 'A1'): '보라 검은 돌 옥좌 — 돌 가시 셋 + 뼈 뿔 + 꼭대기 보라 보석, 등판 빛 마름모, 해골 팔걸이, 두 층 단과 붉은 깔개',
    ('other.throne', 'A2'): '검푸른 화산암 옥좌, 붉은 보석·붉은 새김, 보라 깔개',
    ('other.bone_pillar', 'A1'): '등뼈 마디 기둥 + 양옆 뼈 가시 + 꼭대기 해골, 보라 검은 바위 받침',
    ('other.bone_pillar', 'A2'): '보라 검은 돌 마디 기둥(빛 눈) + 뼈 받침',
    ('other.brazier', 'A1'): '쇠 그릇 + 세 발 받침 + 보라 불꽃(3장면)',
    ('other.brazier', 'A2'): '보라 검은 돌 기둥 화로 + 앞면 빛 새김 + 보라 불꽃',
    ('other.portal', 'A1'): '보라 검은 돌 아치 — 닫힘 = 굳은 소용돌이 판 + X 쇠사슬 + 봉인 메달, 열림 = 보라 소용돌이(3장면)',
    ('other.portal', 'A2'): '검푸른 화산암 아치 + 붉은 새김 — 열림 = 붉은·불빛 소용돌이',
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(mk(k), NOTES[(item, k)]) for k in ('A1', 'A2')} for item, mk in ITEM_FNS.items()}


def line_scenes():
    """줄 대신 테마별 큰 장면(시트 맨 아래) — 후보 A1 끼리 / A2 끼리."""
    out = {}
    return out

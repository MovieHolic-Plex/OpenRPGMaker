"""theme-climate 피라미드 기물(2026-10-23) — 파라오 석관·오벨리스크·자칼/풍뎅이 석상·금 보물 더미·모래 더미.

행 문자열 손 도트. 글자 → (램프, 단):
  sand a..g(0..6) · gold m..r(0..5) · water(청금) H..L(0..4) · bone u..y(0..4) · red R..V(0..4) · glow A..F(0..5)
  vrock 6 7 8 9 *(0..4) · wood W X Y Z @ &(0..5) · rim(화강) i j k l s t z(0..6) · iron 0..5 · '~' 바닥 그림자 · '.' 투명
장면 바탕은 형제 모듈 theme_climate_desert.pyramid_room 이 있으면 그것, 없으면 버들항 조각(장면 전용)으로 깐다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as L  # noqa: E402
from theme_climate_lib import T, Cv, ramp_chars  # noqa: E402

LG = L.leg(ramp_chars('sand', 'abcdefg'), ramp_chars('gold', 'mnopqr'), ramp_chars('water', 'HIJKL'),
           ramp_chars('bone', 'uvwxy'), ramp_chars('red', 'RSTUV'), ramp_chars('glow', 'ABCDEF'),
           ramp_chars('vrock', '6789*'), ramp_chars('rim', 'ijklstz'), ramp_chars('iron', '012345'), ramp_chars('wood', 'WXYZ@&'))


def G(rows):
    return L.g(rows, LG)


def P(rows, w=16):
    """오른쪽 '.' 를 줄이고 쓴 행을 w 칸으로 채운다."""
    return [r.ljust(w, '.') for r in rows]


def stack(*layers, w=16, h=None):
    """행 격자들을 (rows, x, y) 순서로 겹쳐 찍은 Cv. 뒤에 오는 것이 위."""
    h = h or max(y + len(r) for r, x, y in layers)
    cv = Cv(w, h)
    for rows, x, y in layers:
        L.put(cv, rows, LG, x, y)
    return cv


def swap_inside(base, inner, keep_rows=()):
    """base 행마다 첫·끝 불투명 글자(테두리)는 두고 그 사이를 inner 같은 자리 글자로 갈아 끼운 행(뚜껑 연 관 안쪽)."""
    out = []
    for i, r in enumerate(base):
        if i in keep_rows or i >= len(inner):
            out.append(r)
            continue
        idx = [k for k, ch in enumerate(r) if ch not in '.~']
        if len(idx) < 3:
            out.append(r)
            continue
        a, b = idx[0], idx[-1]
        out.append(r[:a + 1] + inner[i][a + 1:b] + r[b:])
    return out


# ================================================================================================ 장면 바탕
def room(w, h):
    """피라미드 방 바탕(장면 전용). 형제 모듈의 pyramid_room 이 되면 그것을 쓴다."""
    try:
        import theme_climate_desert as S
        if hasattr(S, 'pyramid_room'):
            plan = ['#' * w] * 4 + ['#' + '.' * (w - 2) + '#'] * (h - 5) + ['#' * w]
            try:
                return S.pyramid_room(plan, n=1, floor_n=2)   # 고른 세트: 테두리 A1 + 앞면 A1 + 바닥 A2
            except TypeError:
                return S.pyramid_room(plan, n=1)
    except Exception:  # noqa: BLE001
        pass
    cv = Cv(w * T, h * T)
    vd = L.legend(v=('void', 0))['v']
    cv.a[:, :, :3] = vd
    cv.a[:, :, 3] = 255
    face = L.bd_part('castle-catacombs/face_cata_3h')
    fl = L.bd_part('desert-oasis/ground-plaza')
    for x in range(w):
        col = 0 if x == 0 else 2 if x == w - 1 else 1
        cv.paste(face.crop(col * T, 0, T, 3 * T), x * T, T)
    for y in range(4, h):
        for x in range(w):
            cv.paste(fl.crop((x % 3) * T, (y % 3) * T, T, T), x * T, y * T)
    return cv


def scene(pieces, w=9, h=8, actor=(1, 5)):
    """pieces: [(Cv, 칸 x, 칸 y)]. 사람 한 명을 곁에."""
    cv = room(w, h)
    for p, cx, cy in pieces:
        cv.paste(p, cx * T, cy * T)
    L.put_actor(cv, actor[0], actor[1])
    return cv


# ================================================================================================ 파라오 석관
SARC1 = [   # 누운 관(뚜껑 윗면 + 발치 앞면) 16×25 — 받침 위에 얹는다
    '......npqn......',
    '.....pqrrqo.....',
    '....pKLKKJIn....',
    '...oqrrrrqqpm...',
    '...KJqrrrqpIH...',
    '...qqrHrHqqpm...',
    '...KJqrrrqpIH...',
    '...qppqrqpoom...',
    '...KJopqpoIIH...',
    '..oqrrqJIqqpom..',
    '..KLKJJKJJJIIH..',
    '..pqTUqpqTUpom..',
    '..KrqJIJIJIqpH..',
    '..JKrqJIJIqpIH..',
    '..KJIrqJIqpJIH..',
    '..JKJIrqqpJIIH..',
    '...KJIJrqpoJI...',
    '...qrqpqpqpom...',
    '...KLKJIJIJIH...',
    '....qrqpqpom....',
    '....KJKJIJIH....',
    '....qrqqppom....',
    '....oqqppoom....',
    '....IJJIIIHH....',
    '....noonnmmm....',
]
SARC1_IN = [
    '......mnnm......',
    '.....mmmnno.....',
    '....mmxyyxno....',
    '...mmxyyyywno...',
    '...mnwyxxywno...',
    '...mnxvyyvxno...',
    '...mnwyxxwvno...',
    '...mnnwyywnno...',
    '...mnnvxxvnno...',
    '..mnxyyxwxyxno..',
    '..mnwvxyyxvwno..',
    '..mnyxwvxyxwno..',
    '..mnxyyxvwxvno..',
    '..mnwxvyyxwvno..',
    '..mnvwxyxvwxno..',
    '..mnxyvwxyvwno..',
    '...mnxyxwvxno...',
    '...mnwvyxyvno...',
    '...mnxyxwvwno...',
    '....mnyxwvno....',
    '....mnvwxwno....',
    '....mnnxwnno....',
]
PLINTH1 = (['.' * 16] * 3 + [
    '.gggggggggggggb.',
    '.gfffffffffffeX~',
    '.gffefffffffeeX~',
    '.gfffffffffffdX~',
    '.gefffffffffeeX~',
    '.gfffffffffffeX~',
    '.gffffffffffeeX~',
    '.gfefffffffffdX~',
    '.gfffffffffffeX~',
    '.gffffffffffeeX~',
    '.geeeeeeeeeeedX~',
    '.gfffffffffffeX~',
    '.gfeffffffffeeX~',
    '.gfffffffffffdX~',
    '.gffffffffffeeX~',
    '.gefffffffffeeX~',
    '.gfffffffffffdX~',
    '.gffefffffffeeX~',
    '.gfffffffffffeX~',
    '.gffffffffefeeX~',
    '.gfeffffffffedX~',
    '.gfffffffffffeX~',
    '.gffffeffffeeeX~',
    '.feeeeeeeeeeedX~',
    '.dcccccbccccccX~',
    '.dcaaaaaaaaaacX~',
    '.aXXXXXXWXXXXXW~',
    '..~~~~~~~~~~~~~~',
    '................',
])

SARC2 = [   # 선 관(앞면) 16×27 — 벽에 기대 받침 위에 선다
    '................',
    '......pqqp......',
    '.....qrrrqm.....',
    '....qKLKKJIm....',
    '....KqrrrqpH....',
    '...qJrrrrqpIm...',
    '...KqrHrHqpoH...',
    '...qJrrrrqpIm...',
    '...KqpqrqpoIH...',
    '...qJopqpoIIm...',
    '...KJnJIJnIIH...',
    '..oqqrqqqqppom..',
    '..JKLKJJJJJIIH..',
    '..TUVUTUTUTUSR..',
    '..qrqpqKJpqpom..',
    '..KrqqJKJIqpIH..',
    '..JKrqpIJqpoIH..',
    '...KJrqpqpoIH...',
    '...qrqpqpqpom...',
    '...KLKJKJIJIH...',
    '...UVUTUTUTSR...',
    '...qrqpqpqpom...',
    '....KJKJIJIH....',
    '....qrqpqpom....',
    '....KJIJIJIH....',
    '....qrqqppom....',
    '....nooonnmm....',
]
SARC2_IN = [
    '................',
    '......nmmn......',
    '.....nmmmmo.....',
    '....nmxyyxmn....',
    '....nmyxyxmn....',
    '...qmwyxyywmn...',
    '...KmxvyvxwmH...',
    '...qmwyxxywmn...',
    '...KmmwxxwmmH...',
    '...qmmvxxvmmn...',
    '...KmxywxyxmH...',
    '..omxyyxwxyxmm..',
    '..JmwvxyyxvwmH..',
    '..TmyxwvxyxwmR..',
    '..qmxyyxvwxvmm..',
    '..KmwxvyyxwvmH..',
    '..JmvwxyxvwxmH..',
    '...mxyvwxyvwm...',
    '...mmxyxwvxmm...',
    '...mmwvyxyvmm...',
    '...mmxyxwvwmm...',
    '...mmmyxwvmmm...',
    '....mmvwxwmm....',
    '....mmnxwnmm....',
    '....mmmnnmmm....',
]
PLINTH2 = ['.' * 16] * 25 + [
    '..gggggggggggf..',
    '..gfffffffffea~.',
    '..geeeeeeeeeca~.',
    '..dccccbccccbX~.',
    '..aXXXXWXXXXXW~.',
    '...~~~~~~~~~~~~.',
    '................',
]


# --- 2판: 3/4 로 다시 — 뚜껑 윗면(줄여 보임) + 관 상자 남쪽 앞면 + 받침 윗면 띠 + 받침 앞면 8줄
SARC3_PLINTH = [
    '................',
    '.ggggggggggggga.',
] + [
    '.gffffffffffffX~',
    '.gfeffffffffeeX~',
] * 9 + [
    '.gfffeffffffffX~',
    '.gffffffffffffX~',
    '.ggggggggggggga~',
    '.gfffeffffeffeX~',
    '.eeeeeeeeeeeeeX~',
    '.dccccbcccccccX~',
    '.dcccccbccccccX~',
    '.baaaaaaaaaaaaX~',
    '.dcccbcccccbccX~',
    '.dccccccbcccccX~',
    '.cbbbbbbbbbbbbX~',
    '.XWWWWWWWWWWWWW~',
    '..~~~~~~~~~~~~~~',
]
SARC3_LID = P([   # 닫힌 뚜껑 윗면(1~13줄) + 뚜껑 두께(14줄)
    '',
    '.....oqrrqo',
    '....qKLKKJn',
    '....KqrrrqpI',
    '....qrHrrHpn',
    '...oKqrqrpIpm',
    '...qJopqpoIIm',
    '..oKLKJIJIIJHm',
    '..qrqTUqpTUpom',
    '..KrqJIJIJIqpH',
    '..JKrqqJIqpoIH',
    '..qrqpqpqpqpom',
    '...KLKJIJIJIH',
    '...qrqpqpqpom',
    '...nooonnnmmm',
])
SARC3_OPEN = P([   # 뚜껑을 들어낸 관 속 — 붕대 감은 미라(밝은 띠 + 어두운 띠 줄)
    '',
    '.....oqqqqo',
    '....qmmmmmn',
    '....KmyyyxmI',
    '....qmxvvxmn',
    '...oKmyyyxmIm',
    '...qmmwyxwmmm',
    '..oKmyyyyyxmHm',
    '..qmvyxvyxvumm',
    '..KmyyyyyxxvmH',
    '..JmxvyxvyxumH',
    '..qmyyyyyxxvmm',
    '...mvyxvyxvmH',
    '...myyyyxxvmm',
    '...noooonnnmm',
])
SARC3_BOX = P([   # 관 상자 남쪽 앞면(발치) — 금 테·청금 판·금 날개
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    '...pqqqqppoon',
    '...oJKKJJIIHm',
    '...oKqrqqpoIm',
    '...oJIqppoIHm',
    '...opqppoonnm',
    '...nnnnmmmmmm',
])


def sarc_a1(opened):
    return stack((SARC3_PLINTH, 0, 0), (SARC3_OPEN if opened else SARC3_LID, 0, 0), (SARC3_BOX, 0, 0), h=32)


def sarc_a2(opened):
    body = swap_inside(SARC2, SARC2_IN, keep_rows=(0, 25, 26)) if opened else SARC2
    return stack((PLINTH2, 0, 0), (body, 0, 0), h=32)


def sarc_cand(fn, y):
    def f():
        a, b = fn(False), fn(True)
        img = L.hcat(a, b)
        sc = scene([(a, 3, y), (b, 6, y)], actor=(2, 5))
        return img, {'kind': 'objects', 'parts': {'닫힘': a, '열림': b}, 'vignette': sc}
    return f


# ================================================================================================ 오벨리스크
OBEL1_SHAFT = P([   # 2판: 금 뾰족 머리(빛 받는 왼 면 | 그늘 오른 면) + 오른쪽이 짙은 사암 기둥 + 음각 그림(눈·따오기·생명 열쇠·물결)
    '', '',
    '.......rn',
    '......rqon',
    '......rqon',
    '.....rqqonn',
    '.....rqqoon',
    '....rqqqoonn',
    '....qppponnm',
    '....gfeeecba',
    '....gfaaacba',
    '....gagagaba',
    '....gfaaacba',
    '....gfadeaba',
    '....gfeeecba',
    '....gfeeecba',
    '....gaaeecba',
    '....gfaaacba',
    '....gfaaaaba',
    '....gfeaacba',
    '....gfeadaba',
    '...ggfeeeecba',
    '...ggfeeeecba',
    '...ggfeaaacba',
    '...ggfeaeacba',
    '...ggfeaaacba',
    '...ggfaaaaaba',
    '...ggfeeaecba',
    '...ggfeeaecba',
    '...ggfeeeecba',
    '...ggfaeaeaba',
    '...ggfeaeaeba',
    '...ggfeeeecba',
    '...gfeeeedcba',
])
OBEL1_BASE = P([''] * 32 + [   # 위 단(윗면 4줄·앞면 3줄)
    '..gggggggggggb',
    '..gffffffffffa~',
    '..gfeffffffeea~',
    '..geeeeeeeeeea~',
    '..dccccbcccccX~',
    '..dcccccbccccX~',
    '..bbbbbbbbbbbX~',
])

OBEL1_LOW = P([''] * 36 + [   # 아래 단(윗면 3줄 보임·앞면 5줄)
    'ggggggggggggggb',
    'gfffffffffffffa~',
    'gfefffffffffffa~',
    'gfffffffeffffea~',
    'geeeeeeeeeeeeea~',
    'gffffeffffffffa~',
    'dcccbccccccbccX~',
    'dccccccbccccccX~',
    'baaaaaaaaaaaaaX~',
    'dccbcccccbccccX~',
    'XWWWWWWWWWWWWWW~',
    '.~~~~~~~~~~~~~~~',
])


OBEL2_SHAFT = P([   # 화강암 기둥 — 금 상감: 해 원반·코브라·물결·새·깃털
    '',
    '',
    '.......r',
    '......rqp',
    '......qqpo',
    '.....rqqpon',
    '.....qppoonm',
    '....ztsssllk',
    '....ztslllkj',
    '....ztlpqplj',
    '....ztqrqppj',
    '....ztpqqolj',
    '....ztlpolkj',
    '....ztlllllj',
    '....ztlllllj',
    '....ztqlllkj',
    '....ztqqllkj',
    '....ztlqqqkj',
    '....ztllqokj',
    '....ztlqollj',
    '....ztslllkj',
    '....ztlllllj',
    '....ztqlqlqj',
    '...ztslqlqlkj',
    '...ztsllllllj',
    '...ztsqqllllj',
    '...ztslqqqllj',
    '...ztslqqqpkj',
    '...ztslqlplkj',
    '...ztsllllllj',
    '...ztsllqqllj',
    '...ztslqqpllj',
    '...ztslqpllkj',
    '...ztslqlllkj',
    '...tssllllkkj',
])
OBEL2_BASE = P([''] * 32 + [
    '...zzzzzzzzzzt',
    '...tsssssssssk',
    '...lkkkkkkkkkj~',
    '...kjjjjjjjjji~',
    '.zzzzzzzzzzzzzt',
    '.ztssssssssssslk',
    '.tsssssssssssslk',
    '.lkkkkjkkkkkkjj~',
    '.kjjjjijjjjjjii~',
    '.lkkkkkkjkkkkkj~',
    '.kjjjjjjijjjjji~',
    '..~~~~~~~~~~~~~~',
    '',
    '',
    '',
    '',
])


def obel_a1():
    return stack((OBEL1_LOW, 0, 0), (OBEL1_BASE, 0, 0), (OBEL1_SHAFT, 0, 0), h=48)


def obel_a2():
    return stack((OBEL2_BASE, 0, 0), (OBEL2_SHAFT, 0, 0), h=48)


def obel_cand(fn):
    def f():
        img = fn()
        sc = scene([(img, 4, 4)], actor=(3, 6))
        return img, {'kind': 'object', 'parts': {'기본': img}, 'vignette': sc}
    return f


# ================================================================================================ 석상
JACKAL1 = [   # 앉은 자칼(옆모습, 왼쪽을 봄) + 높은 받침 — 2판: 위·왼 가장자리 빛, 금 귀 끝
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......q..q.....',
    '......*p.*9.....',
    '......*9.9*8....',
    '.....**9*988....',
    '...***9*99q87...',
    '.*99**9999877...',
    '.67888999887....',
    '...6777qrq87....',
    '.....*qppo87....',
    '.....*999987....',
    '.....**99988....',
    '.....**9989887..',
    '.....**9889*987.',
    '.....**98889*97.',
    '.....**98788987.',
    '....*999877877..',
    '...ggggggggggb..',
    '..gfffffffffffa.',
    '..geeeeeeeeeeeX~',
    '..dcccccccccccX~',
    '..dcqrqpqrqpqcX~',
    '..dcppoopoopocX~',
    '..dcccccccccccX~',
    '..cbbbbbbbbbbbX~',
    '..dccbccccbcccX~',
    '..XWWWWWWWWWWWW~',
    '...~~~~~~~~~~~~~',
]

SCARAB1 = P([   # 2판: 위·앞에서 본 청금 풍뎅이 — 이빨 머리, 앞가슴, 허리 홈, 가운데 갈라진 딱지날개, 짙은 다리 여섯
    '', '', '', '', '', '',
    '....J.J..J.H',
    '....IJKJJJIH',
    '.H6.6IJJJIH6.6H.',
    '6..H.HHHHHH.H..6',
    '...JKLLKKJJIIH..',
    '..JKLKKKJJJIIHH.',
    '.6IKKKJJJJIIIH6.',
    '6...HIIIIIIHH..6',
    '...JKLJJHJJIIH..',
    '.6IKLKJJHJIIIHH6',
    '6.JKKJJIHIIIHH.6',
    '.6.JJJIIHIIHH.6.',
    '..6.IIIIHIHH.6..',
    '.....HIIHHH.....',
])

SCARAB1_PED = P([''] * 16 + [
    '..gggggggggggb',
    '..gffffffffffa~',
    '..gfeffffffeea~',
    '..gfdccccccdea~',
    '..geeeeeeeeeea~',
    '..dqrqqrqqrqpX~',
    '..doppoppoppmX~',
    '..dccccccccccX~',
    '..dccbccccbccX~',
    '..cbbbbbbbbbbX~',
    '..dccbccccbccX~',
    '..dcccccbccccX~',
    '..dcccccccbccX~',
    '..cbbabbbbabbX~',
    '..XWWWWWWWWWWW~',
    '...~~~~~~~~~~~~',
])
JACKAL2 = [   # 엎드린 자칼(아누비스 궤 위) — 낮고 긴 실루엣
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....8.8.........',
    '...8p89.........',
    '...89*8.........',
    '..8899q8........',
    '6799*998........',
    '.67qrq98888877..',
    '...8pp9*999988..',
    '...8999*9998887.',
    '..69999999988*7.',
    '.6777877777788..',
    'ggggggggggggggb.',
    'gffffffffffffea.',
    'geeeeeeeeeeeeea~',
    'dIJKJIJIJIJIIHb~',
    'dqrqpqrqpqrqpob~',
    'dJIpIJpIJpIJpHb~',
    'dqrqpqrqpqrqpob~',
    'dIJKJIJIJIJIIHb~',
    'dccccbcccccbccX~',
    'aXXXXWXXXXXWXXW~',
    '.~~~~~~~~~~~~~~~',
    '................',
    '................',
    '................',
    '................',
]

SCARAB2 = P([   # 붉은 해 원반을 앞발로 받친 금 풍뎅이 + 낮은 사암 받침
    '',
    '......SUUS',
    '.....SUVVUS',
    '.....TUVrUT',
    '.....SUVUTS',
    '......RTTR',
    '....o.ommo.m',
    '.....opqqon',
    '...o.pqqpnm.m',
    '....qrrrqpnm',
    '...qrrrqqppn',
    '..o.mmmmmmmmm.m',
    '...qrrqpmqppnm',
    '..orrrqpmqpppnm',
    '...rrqqpmqppnm',
    '..orqqqpmpponm.',
    '...qqqppmponm',
    '..o.qppomonmm.m',
    '.....nmmmmm',
    '...ggggggggggb',
    '..gfffffffffffa',
    '..geeeeeeeeeeea~',
    '..dcbcccbcccbcX~',
    '..cbabbbabbbabX~',
    '..dcccccccccccX~',
    '..aXXXXXXXXXXXW~',
    '...~~~~~~~~~~~~~',
    '', '', '', '', '',
])


def statue_cand(a_rows, b_rows):
    def f():
        a = G(a_rows)
        b = stack(*[(r, 0, 0) for r in b_rows], h=32) if isinstance(b_rows, tuple) else G(b_rows)
        img = L.hcat(a, b)
        sc = scene([(a, 3, 3), (b, 5, 3)], actor=(4, 5))
        return img, {'kind': 'objects', 'parts': {'자칼': a, '풍뎅이': b}, 'vignette': sc}
    return f


# ================================================================================================ 금 보물 더미
def W32(rows):
    return P(rows, 32)


HEAP1 = W32([
    '', '', '',
    '.............nqn',
    '...........nqrponn',
    '.........nqrpoqrpnqn',
    '........opnoopnoqrpnom',
    '.......nqrpnqrpoopnqrpm',
    '......oopnoqrpnqrpnoopnqn',
    '.....nqrpnoopnoopnqrpoqrpm',
    '....opnoqrpnqrpoqrpnoopnoon',
    '...nqrpnoopnoopnoopnqrpnqrpm',
    '..opnoqrpnqrpoqrpnqrpnoopnoom',
    '.nnoopnoopnoopnoopnoopnoqrpnom',
    '..mmmmmnmmmmmmnmmmmmmnmmmmmm~~',
    '...~~~~~~~~~~~~~~~~~~~~~~~~~~',
])
GOBLET = ['orrqn', 'pqrqo', '.pqo.', '..p..', '.oqpn']
URN = [
    '..oqqo..',
    '..nppn..',
    '...JI...',
    '..KJIH..',
    '.KLKJIH.',
    'KLKJJIIH',
    'qrqqppon',
    'KJKJIIHH',
    'JKJIIIHH',
    '.JJIIHHH',
    '..IIHHH.',
    '..oppn..',
    '.~mmmm~~',
]
GEM_R = ['VU', 'TS']
GEM_T = ['EC', 'BA']

HEAP2 = W32([
    '', '', '', '', '', '',
    '.................rq',
    '................rqpn......nqrp',
    '...........nqrpnqopn....nqrpoqp',
    '.........nqrpoopnqrpoqrpnoopnqp',
    '........opnoqrpnoopnoopnqrpnoon~',
    '.......nqrpnoopnqrpnqrpnoopnom~',
    '.....oqrpnqrpnoopnoopnoqrpnom~',
    '...nqpnoopnoopnqrpnqrpnoopnm~',
    '...mmnnmnnmmnnmnnmmnnmnnmm~~',
    '....~~~~~~~~~~~~~~~~~~~~~~',
])
JAR = [   # 금화가 넘치는 진흙 단지(서 있음, 입 윗면이 보임)
    '...rqp...',
    '.ZqrqppX.',
    '.Y@&@ZYX.',
    '..XZYXW..',
    '..Y@ZYX..',
    '.Y@&ZZYXq',
    'Y@&&@ZZYXp',
    'Y&&&@ZZYXo',
    'XWWWWWWWW.',
    'Y@&@ZZYYX.',
    'XZ@ZZYYXW.',
    '.XZYYXXW.',
    '..XXXWW~~',
]
MASK = [   # 금 가면(청금 줄무늬 두건)
    '..oqqo..',
    '.qKJJIp.',
    'KqrrrqpH',
    'JrHrrHpI',
    'KqrrrqpH',
    'JqprqpoI',
    'KJqppoIH',
    '.IJnnIH.',
    '..~~~~..',
]


def gold_a1():
    return stack((HEAP1, 0, 0), (GOBLET, 7, 1), (GEM_R, 13, 9), (GEM_T, 19, 11), (['V'], 9, 11),
                 (URN, 24, 2), (['qp', 'nm'], 29, 13), w=32, h=16)


def gold_a2():
    return stack((HEAP2, 0, 0), (JAR, 2, 2), (MASK, 23, 4), (GEM_R, 17, 10), (['C'], 20, 12), (['U'], 14, 13),
                 w=32, h=16)


def gold_cand(fn):
    def f():
        img = fn()
        sc = scene([(img, 4, 5)], actor=(3, 5))
        return img, {'kind': 'object', 'parts': {'기본': img}, 'vignette': sc}
    return f


# ================================================================================================ 모래 더미
DRIFT1A = P([   # 동서로 길게 흐른 낮은 모래 자락(가로 물결)
    '', '', '', '', '',
    '.......e.eff',
    '..e..effgggffe',
    '.effgffeeeffffe',
    'effeeeffffggfffe',
    '.eefffgggffeeeed',
    '..deeeeefffffdd',
    '...e.dd.eeeddd',
    '..........d',
    '', '', '',
])
DRIFT1B = P([   # 비스듬한 띠 모양 자락(가로 물결)
    '',
    '..........e',
    '.........efff',
    '........efggfe',
    '.......effeeee',
    '......effffggfd',
    '.....efggffffd',
    '....eeeeefeedd',
    '...efffffggfd',
    '..efggffffffe',
    '.eeeefeeeedd',
    '.effffggfdd.e',
    '..dddeddd',
    '....d',
    '', '',
])
DRIFT2A = P([   # 2판: 낮고 넓은 모래 언덕 — 바람받이(왼·위) 밝음, 바람그늘(오른·아래) 그늘, 물결·알갱이
    '', '',
    '.....e...e',
    '...e.efe.ef.e',
    '..efeffgfefge',
    '.effgffeeffgfe.e',
    'efgfeeggffeefdd',
    '.efeeffffggfedc',
    'efffggfeeefffdcc',
    '.eeffeefgffeddc',
    '..deeeffffedddc',
    '.d.dddeeedddcc.e',
    '...c.ccdcdcc.c',
    '........c',
    '', '',
])
DRIFT2B = P([   # 2판: 동서로 낮게 깔린 모래 띠(물결 진 윗변·그늘진 아랫변) + 흩어진 알갱이
    '', '', '',
    '.e',
    '......e....e',
    '..e.efge.efe..e',
    '.efgffeefgffe',
    'efgfeeffgfeeffe',
    '.eeffggfeeffgfdd',
    'e.ddeeffffeedddc',
    '..c.ddcdeedcdc.c',
    '.....c..c.c',
    '', '', '', '',
])


def drift_cand(a_rows, b_rows):
    def f():
        a, b = G(a_rows), G(b_rows)
        img = L.hcat(a, b)
        sc = scene([(a, 2, 4), (b, 5, 5), (a, 6, 4)], actor=(4, 6))
        return img, {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': sc}
    return f


# ================================================================================================ 내보내기
FNS = {
    'tc.pyr_sarcophagus': {'A1': sarc_cand(sarc_a1, 4), 'A2': sarc_cand(sarc_a2, 3)},
    'tc.pyr_obelisk': {'A1': obel_cand(obel_a1), 'A2': obel_cand(obel_a2)},
    'tc.pyr_statue': {'A1': statue_cand(JACKAL1, (SCARAB1_PED, SCARAB1)), 'A2': statue_cand(JACKAL2, SCARAB2)},
    'tc.pyr_gold': {'A1': gold_cand(gold_a1), 'A2': gold_cand(gold_a2)},
    'tc.pyr_drift': {'A1': drift_cand(DRIFT1A, DRIFT1B), 'A2': drift_cand(DRIFT2A, DRIFT2B)},
}
NOTES_BY_ITEM = {
    'tc.pyr_sarcophagus': {'A1': '낮은 사암 받침 위에 남북으로 누운 금·청금 사람 모양 관, 열림=뚜껑 없이 붕대 미라',
                           'A2': '벽에 기대 선 금·청금·붉은 깃 무늬 관(받침 윗면 보임), 열림=관 속에 선 미라'},
    'tc.pyr_obelisk': {'A1': '사암 오벨리스크, 금 뾰족 머리, 앞면 음각 상형(눈·새·물결), 한 단 받침',
                       'A2': '화강암(붉은회색) 오벨리스크, 금 상감 상형, 두 단 계단 받침'},
    'tc.pyr_statue': {'A1': '[높은 받침 위 앉은 검은 자칼(금 목걸이·귀, 위·왼 가장자리 빛) | 금 띠 받침 위 넓적한 청금 풍뎅이(이빨 머리·큰턱·갈라진 딱지날개·금 다리 여섯)]',
                      'A2': '[줄무늬 궤 위 엎드린 자칼 | 붉은 해 원반을 민 사암 풍뎅이]'},
    'tc.pyr_gold': {'A1': '금화 무더기 + 잔 + 작은 단지, 붉은·청록 보석',
                    'A2': '쓰러진 금 단지에서 쏟아진 금화 + 붉은 보석 + 금 사발'},
    'tc.pyr_drift': {'A1': '[물결 진 모래 언덕 | 두 갈래 작은 더미]',
                     'A2': '[벽 모서리에서 흘러든 모래 자락 | 판석 틈 따라 흩어진 모래]'},
}

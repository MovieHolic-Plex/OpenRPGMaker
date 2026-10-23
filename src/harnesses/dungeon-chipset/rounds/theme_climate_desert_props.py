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


def sarc_a1(opened):
    body = swap_inside(SARC1, SARC1_IN, keep_rows=(22, 23, 24)) if opened else SARC1
    return stack((PLINTH1, 0, 0), (body, 0, 2), h=32)


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
def P(rows, w=16):
    """오른쪽 '.' 를 줄이고 쓴 행을 w 칸으로 채운다."""
    return [r.ljust(w, '.') for r in rows]


OBEL1_SHAFT = P([   # 사암 기둥(앞면만) — 음각 그림: 눈·따오기·물결·깃털·코브라
    '',
    '.......q',
    '.......rp',
    '......rqo',
    '......qqpn',
    '.....rqqpo',
    '.....qqppon',
    '....ggffeedX',
    '....gfeeeddX',
    '....gfebbbdX',
    '....gfbgabdX',
    '....gfebbbdX',
    '....gfebeebX',
    '....gfeeeedX',
    '....gfbbeedX',
    '....gfebbbdX',
    '....gfeebbdX',
    '....gfeebedX',
    '....gfeeeedX',
    '...ggfeeeeedX',
    '...gfbebebedX',
    '...gfebebebdX',
    '...gfeeeeeedX',
    '...gfeeebbedX',
    '...gfeebbbedX',
    '...gfeebbeedX',
    '...gfeebeeedX',
    '...gfeeeeeddca',
    '...gfbeeeebdca',
    '...gfbbeebbdca',
    '...gfebbbbedca',
    '...gfeeeeeedca',
    '...gfedeeeddca',
    '...gfeeedeedca',
    '...gfeeeeeddca',
    '...fedeeeddcca',
    '...feddddddcca',
])
OBEL1_BASE = P([''] * 34 + [
    '..gggggggggggb',
    '.gfffffffffffea',
    '.gffeffffffffea~',
    '.gfffffffeffffa~',
    '.geeeeeeeeeeeea~',
    '.dcccccbccccccW~',
    '.cbbbbbabbbbbbW~',
    '.dccbccccccbccW~',
    '.aXXWXXXXXXWXXW~',
    '..~~~~~~~~~~~~~~',
    '',
    '',
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
    return stack((OBEL1_BASE, 0, 0), (OBEL1_SHAFT, 0, 0), h=48)


def obel_a2():
    return stack((OBEL2_BASE, 0, 0), (OBEL2_SHAFT, 0, 0), h=48)


def obel_cand(fn):
    def f():
        img = fn()
        sc = scene([(img, 4, 4)], actor=(3, 6))
        return img, {'kind': 'object', 'parts': {'기본': img}, 'vignette': sc}
    return f


# ================================================================================================ 석상
JACKAL1 = [   # 앉은 자칼(옆모습, 왼쪽을 봄) + 높은 받침
    '................',
    '.......8..8.....',
    '......8p.89.....',
    '......89.9*8....',
    '.....889*988....',
    '...8899*99q87...',
    '.889**9999877...',
    '.67888999887....',
    '...6777qrq87....',
    '.....8qppo87....',
    '.....8999987....',
    '.....8*99988....',
    '.....8*9989887..',
    '.....8*9889*987.',
    '.....8*98889*97.',
    '.....8*98788987.',
    '....8999877877..',
    '...ggggggggggb..',
    '..gfffffffffffa.',
    '..geeeeeeeeeeea~',
    '..dcccccccccccX~',
    '..dcqrqpqrqpqcb~',
    '..dcppoopoopocb~',
    '..dcccccccccccX~',
    '..cbbbbbbbbbbbW~',
    '..dccbccccbcccX~',
    '..aXXWXXXXWXXXW~',
    '...~~~~~~~~~~~~~',
    '................',
    '................',
    '................',
    '................',
]

SCARAB1 = P([   # 청금 풍뎅이(등) + 금 테 받침
    '', '', '', '', '',
    '......HIIH',
    '.....IKJJIH',
    '..I..pqqqpo..H',
    '...IJKLKKJIHH',
    '..IJKLKKJJIIH',
    '.I.IJKKJJIIH.H',
    '...pqqrqqpoon',
    '..IJKLKqIJIIH',
    '.IJKLKJqJIIHHH',
    '.IJKKJJqJIIHHH',
    'I.JKJJIqIIIHH.H',
    '..IJJIIqIIHHH',
    '...IIIIpIHHH',
    '..I.ggggggggb.H',
    '..gfffffffffffa',
    '..geeeeeeeeeeea~',
    '..dqrqqrqqrqqpb~',
    '..doppoppoppomb~',
    '..dcccccccccccX~',
    '..cbbbbbbbbbbbW~',
    '..dccbccccbcccX~',
    '..aXXWXXXXWXXXW~',
    '...~~~~~~~~~~~~~',
    '', '', '', '',
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
        a, b = G(a_rows), G(b_rows)
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
DRIFT2A = P([   # 천장 틈에서 흘러내린 고깔 모래 더미 + 흩어진 알갱이
    '', '', '',
    '.......e',
    '......efe',
    '.....efgfe',
    '....efggffe',
    '...efgffedde.e',
    '..efgfffeddde',
    '.e.ffffeeddcde',
    '..eeeeedddccde.e',
    '...e.dddccce.e',
    '.....e.e.e',
    '', '', '',
])
DRIFT2B = P([   # 가늘게 흩어진 모래 줄 + 잔돌
    '', '',
    '..ef',
    '.efgfe',
    '..eeffe.....c',
    '....edfe...',
    '.....dde.......',
    '...........efe',
    '..........efgfe',
    '....c....efffde',
    '........eeedd',
    '.....eef.dd',
    '....efgfe....b',
    '.....edd',
    '', '',
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
    'tc.pyr_statue': {'A1': statue_cand(JACKAL1, SCARAB1), 'A2': statue_cand(JACKAL2, SCARAB2)},
    'tc.pyr_gold': {'A1': gold_cand(gold_a1), 'A2': gold_cand(gold_a2)},
    'tc.pyr_drift': {'A1': drift_cand(DRIFT1A, DRIFT1B), 'A2': drift_cand(DRIFT2A, DRIFT2B)},
}
NOTES_BY_ITEM = {
    'tc.pyr_sarcophagus': {'A1': '낮은 사암 받침 위에 남북으로 누운 금·청금 사람 모양 관, 열림=뚜껑 없이 붕대 미라',
                           'A2': '벽에 기대 선 금·청금·붉은 깃 무늬 관(받침 윗면 보임), 열림=관 속에 선 미라'},
    'tc.pyr_obelisk': {'A1': '사암 오벨리스크, 금 뾰족 머리, 앞면 음각 상형(눈·새·물결), 한 단 받침',
                       'A2': '화강암(붉은회색) 오벨리스크, 금 상감 상형, 두 단 계단 받침'},
    'tc.pyr_statue': {'A1': '[높은 받침 위 앉은 검은 자칼(금 목걸이·귀) | 금 띠 받침 위 청금 풍뎅이(등)]',
                      'A2': '[줄무늬 궤 위 엎드린 자칼 | 붉은 해 원반을 민 사암 풍뎅이]'},
    'tc.pyr_gold': {'A1': '금화 무더기 + 잔 + 작은 단지, 붉은·청록 보석',
                    'A2': '쓰러진 금 단지에서 쏟아진 금화 + 붉은 보석 + 금 사발'},
    'tc.pyr_drift': {'A1': '[물결 진 모래 언덕 | 두 갈래 작은 더미]',
                     'A2': '[벽 모서리에서 흘러든 모래 자락 | 판석 틈 따라 흩어진 모래]'},
}

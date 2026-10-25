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
SARC3_PLINTH = [   # 4판: 낮은 받침 — 관 둘레·앞으로 밝은 윗면 턱, 앞면 4줄(금 점 띠), 접지 그림자
    '................',
    '................',
    '................',
    '................',
    '................',
    '..ggggggggggga..',
] + [
    '..gffffffffffa~.',
    '..gfeffffffeea~.',
] * 9 + [
    '..gfffffffffea~.',
    '..gfdccccccdfa~.',
    '..gfffffffffea~.',
    '..geeeeeeeeeeX~.',
    '..dccccbcccccX~.',
    '..dbqpqpqpqpbX~.',
    '..cbbbbbabbbbX~.',
    '..XWWWWWWWWWWW~.',
    '...~~~~~~~~~~~~.',
]
SARC3_LID = P([   # 4판: 남북으로 누운 사람 모양 뚜껑 윗면(머리 북쪽, 발 남쪽으로 좁아짐) — 테두리 판 없음
    '',
    '......oqqo',
    '.....qrrqpo',
    '....qKLKKJIn',
    '....KqrrrqpI',
    '....qrHrrHpn',
    '...oKqrqrpIpm',
    '..oqJopqpoIJnm',
    '..KLKJIJIJIJIH',
    '..qrqTUqpTUpom',
    '..KrqJIJIJIqpH',
    '..JKrqqJIqpoIH',
    '...qrqpqpqpom',
    '...KLKJIJIJIH',
    '...qrqpqpqpom',
    '....KJKJIJIH',
    '....qrqpqpom',
    '.....KJIJIH',
    '.....nooonm',
])
SARC3_OPEN = P([   # 4판: 뚜껑을 들어낸 관 — 어두운 속, 동쪽 안벽 밝음, 머리 북쪽으로 길게 누운 미라(밝은 붕대 + 짙은 띠 줄)
    '',
    '......oqqo',
    '.....qmmmmo',
    '....qmmmmmmn',
    '....KmmyyxoI',
    '....qmxyyvon',
    '...oKmyxyvopm',
    '..oqmyyyyxvoom',
    '..KmvuvvuvuvoH',
    '..qmyyyxyyxvom',
    '..KmxyyyyxxuoH',
    '..JmvuvvuvvuoH',
    '...myyyxyyxom',
    '...mxyyyyxuoH',
    '...mvuvvuvuom',
    '....myyxyxom',
    '....mxyyxuoH',
    '.....mvuuom',
    '.....nooonm',
])
SARC3_BOX = P([   # 4판: 관 상자 벽 — 뚜껑 윤곽을 5줄 내린 자리(아래 가장자리·발치 앞면만 보임), 동쪽이 짙다
    '', '', '', '', '', '',
    '......onnm',
    '.....poonnm',
    '....poonnnmm',
    '....poonnnmm',
    '....poonnnmm',
    '...poonnnnnmm',
    '..poonnnnnnnmm',
    '..pIJIIIIIIIHm',
    '..poonnnnnnnmm',
    '..poonnnnnnnmm',
    '..pJIIIIIIIIHm',
    '...poonnnnnmm',
    '...poonnnnnmm',
    '...pIJIIIIIHm',
    '....poonnnmm',
    '....pqqppomm',
    '.....pIIIHm',
    '.....mmmmmm',
])


def sarc_a1(opened):
    return stack((SARC3_PLINTH, 0, 0), (SARC3_BOX, 0, 0), (SARC3_OPEN if opened else SARC3_LID, 0, 0), h=32)


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
OBEL1_SHAFT = P([   # 4판: 금 뾰족 머리를 3/4 로 — 북쪽 비탈 윗면(밝은 금, 4줄) | 꼭지 모서리 줄 | 남쪽 앞 비탈(짙은 금), 둘레에 기둥 윗면 턱 + 위로 좁아지는 사암 기둥(밝은 앞면 + 좁은 그늘 오른쪽) + 음각 그림(눈·따오기·생명 열쇠)
    '', '',
    '.....gggggf',
    '....rrrrrrrq',
    '....qrrrrrqo',
    '....qqrrrqoo',
    '....qqqrqoon',
    '....qqqmmoon',
    '....qqmppmon',
    '....qmpppomn',
    '....mppppoom',
    '....nnnnnmmm',
    '....gfeeedcb',
    '....gfaaadcb',
    '....gagagacb',
    '....gfaaadcb',
    '....gfagfacb',
    '....gfeeedcb',
    '....gaaeedcb',
    '....gfaaadcb',
    '....gfaaaacb',
    '...ggfeaadccb',
    '...ggfeagadcb',
    '...ggfeeeedcb',
    '...ggfeaaadcb',
    '...ggfeagadcb',
    '...ggfeaaadcb',
    '...ggfaaaaacb',
    '...ggfeeagdcb',
    '...ggfeeagdcb',
    '...gfeeeeddcb',
])
OBEL1_BASE = P([''] * 28 + [   # 위 단: 기둥 앞 윗면 3줄 + 앞면 3줄
    '..gggggggggggX',
    '..gffffffffffX~',
    '..gfeffffffeeX~',
    '..gffdccccdffX~',
    '..gfffeffffffX~',
    '..geeeeeeeeeeX~',
    '..dccccbcccccX~',
    '..dcccccbccccX~',
    '..bbbbbbbbbbbX~',
])

OBEL1_LOW = P([''] * 34 + [   # 아래 넓은 단: 윗면 5줄 보임 + 금 점 새김 띠 앞면
    'ggggggggggggggX',
    'gfffffffffffffX~',
    'gfefffffffffffX~',
    'gfffdccccccdffX~',
    'gfffffffefffffX~',
    'gfeffffffffeffX~',
    'gffffeffffffffX~',
    'geeeeeeeeeeeeeX~',
    'dcccbccccccbccX~',
    'dbqpqpqpqpqpbbX~',
    'dccccccbccccccX~',
    'cbbbbbbbabbbbbX~',
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
JACKAL1 = [   # 3판: 정면을 보고 앉은 검은 자칼(높이 선 두 귀·아래로 긴 주둥이·곧은 앞다리 둘·둥근 엉덩이), 금 목걸이, 위·왼 가장자리 빛
    '................',
    '....*......7....',
    '....**....97....',
    '....*p....p7....',
    '....*qp..pq7....',
    '....*9p..p97....',
    '....*9999997....',
    '...*9q*99*q87...',
    '....*999*987....',
    '.....*9*987.....',
    '.....*9*987.....',
    '......*987......',
    '......*987......',
    '....qrq66pon....',
    '....pqrqqpon....',
    '.....*99987.....',
    '....7*977*97....',
    '...*7*977*977...',
    '..*97*977*9797..',
    '..*97*977*9797..',
    '..*97*977*9797..',
    '..*97**77**797..',
    '...7677777767...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
]

JACKAL1_PED = P([''] * 20 + [
    '.gggggggggggggX',
    '.gfffffffffffeX~',
    '.gfeffffffffeeX~',
    '.gffdccccccdfeX~',
    '.gffffeffffffeX~',
    '.geeeeeeeeeeedX~',
    '.dcccccccccccbX~',
    '.dbqpqpqpqpqbbX~',
    '.dccccccccccbbX~',
    '.cbbbbbabbbbbbX~',
    '.XWWWWWWWWWWWWW~',
    '..~~~~~~~~~~~~~~',
])
SCARAB1 = P([   # 3판: 위·앞에서 본 금 새김 풍뎅이 — 머리 | 어두운 틈 | 둥근 앞가슴 | 틈 | 가운데 솔기 진 딱지날개 둘(타원), 몸 밖으로 비스듬히 뻗은 짙은 다리 세 쌍
    '', '', '', '', '', '', '', '',
    '.m....oqqo....m',
    '..mm.oqrqpo.mm',
    '.....mmmmmm',
    '....qrrqqpon',
    '.mmqrrqqqpponmm',
    '...qrqqqppoon',
    '....mmmmmmmm',
    '...qrqqpmpoon',
    '.mmqrqopmoonnmm',
    'm..qqqopmonnn..m',
    '....qpopmonn',
    '.....opmnn',
    '......nmm',
])

SCARAB1_PED = P([''] * 10 + [
    '.gggggggggggggX',
    '.gffffffffffffX~',
    '.gfefffffffeffX~',
    '.gffffffffffffX~',
    '.gfffeffffffffX~',
    '.gffffffffeeffX~',
    '.gffffffffffffX~',
    '.gfeffffffffffX~',
    '.gffffffffffefX~',
    '.gfffdccccdffeX~',
    '.gffffffffffffX~',
    '.gfffffefffffeX~',
    '.geeeeeeeeeeeeX~',
    '.dccccccccccccX~',
    '.dbqpqpqpqpqpbX~',
    '.dccccccccccccX~',
    '.cbbbbbbabbbbbX~',
    '.dccbccccccbccX~',
    '.cbbbbbbbbbbbbX~',
    '.XWWWWWWWWWWWWW~',
    '..~~~~~~~~~~~~~~',
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
        a = stack(*[(r, 0, 0) for r in a_rows], h=32) if isinstance(a_rows, tuple) else G(a_rows)
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
DRIFT2A = P([   # 3판: 낮고 넓은 모래 언덕 — 바람받이(왼·위) 밝음, 바람그늘(오른·아래) 그늘(6단), 물결·알갱이
    '', '',
    '.e...e.e.e..e',
    '...e.efe.ef.e',
    '..efeffgfefge',
    '.effgffeeffgfe.e',
    'efgfeeggfdeefde',
    '.efeeffffggfede',
    'efdfggfeeefgfcbe',
    '.eeffeefgffedde',
    '..eeeeffffedcbe',
    '.e.dedeeeddcee.e',
    '...e.eeeceee.e',
    '..e.....e...e',
    '', '',
])
DRIFT2B = P([   # 3판: 동서로 낮게 깔린 모래 띠(물결 진 윗변·그늘진 아랫변, 6단) + 흩어진 알갱이
    '', '', '',
    '.e.......e',
    '......e....e',
    '..e.efge.efe..e',
    '.efgffdefgffe',
    'efgfeeffgfedffe',
    '.eeffggfeeffgfde',
    'e.deeeffdfeeddee',
    '..e.ebedeedeee.e',
    '.....e.ee.e..e',
    '', '', '', '',
])


def gate_patch(a, b):
    """관문용: 고른 바닥(피라미드 바닥 A2) 4×3 칸 위에 두 변형을 얹은 조각(사람 없음, 1배)."""
    try:
        import theme_climate_desert as S
        fl = L.tile_fill(4, 3, S.floor_fn(2))
    except Exception:  # noqa: BLE001
        fl = L.tile_fill(4, 3, L.bd_part('desert-oasis/ground-plaza'))
    return L.on(fl, (a, 0, 0), (b, 2 * T, T), (a, T, 2 * T), (b, 3 * T, 0))


def drift_cand(a_rows, b_rows):
    def f():
        a, b = G(a_rows), G(b_rows)
        img = L.hcat(a, b)
        sc = scene([(a, 2, 4), (b, 5, 5), (a, 6, 4)], actor=(4, 6))
        return img, {'kind': 'objects', 'parts': {'변형1': a, '변형2': b}, 'vignette': sc,
                     'extras': [('gate patch', gate_patch(a, b), 1)]}
    return f


# ================================================================================================ 내보내기
FNS = {
    'tc.pyr_sarcophagus': {'A1': sarc_cand(sarc_a1, 4), 'A2': sarc_cand(sarc_a2, 3)},
    'tc.pyr_obelisk': {'A1': obel_cand(obel_a1), 'A2': obel_cand(obel_a2)},
    'tc.pyr_statue': {'A1': statue_cand((JACKAL1_PED, JACKAL1), (SCARAB1_PED, SCARAB1)), 'A2': statue_cand(JACKAL2, SCARAB2)},
    'tc.pyr_gold': {'A1': gold_cand(gold_a1), 'A2': gold_cand(gold_a2)},
    'tc.pyr_drift': {'A1': drift_cand(DRIFT1A, DRIFT1B), 'A2': drift_cand(DRIFT2A, DRIFT2B)},
}
NOTES_BY_ITEM = {
    'tc.pyr_sarcophagus': {'A1': '낮은 사암 받침 위에 남북으로 누운 금·청금 사람 모양 관, 열림=뚜껑 없이 붕대 미라',
                           'A2': '벽에 기대 선 금·청금·붉은 깃 무늬 관(받침 윗면 보임), 열림=관 속에 선 미라'},
    'tc.pyr_obelisk': {'A1': '사암 오벨리스크, 금 뾰족 머리, 앞면 음각 상형(눈·새·물결), 한 단 받침',
                       'A2': '화강암(붉은회색) 오벨리스크, 금 상감 상형, 두 단 계단 받침'},
    'tc.pyr_statue': {'A1': '[윗면 보이는 받침 위 정면으로 앉은 검은 자칼(선 귀·긴 주둥이·곧은 앞다리, 금 목걸이) | 넓은 받침 윗면에 앉은 금 새김 풍뎅이(머리·앞가슴·딱지날개 셋으로 갈리고 다리 세 쌍이 몸 밖으로)]',
                      'A2': '[줄무늬 궤 위 엎드린 자칼 | 붉은 해 원반을 민 사암 풍뎅이]'},
    'tc.pyr_gold': {'A1': '금화 무더기 + 잔 + 작은 단지, 붉은·청록 보석',
                    'A2': '쓰러진 금 단지에서 쏟아진 금화 + 붉은 보석 + 금 사발'},
    'tc.pyr_drift': {'A1': '[물결 진 모래 언덕 | 두 갈래 작은 더미]',
                     'A2': '[벽 모서리에서 흘러든 모래 자락 | 판석 틈 따라 흩어진 모래]'},
}

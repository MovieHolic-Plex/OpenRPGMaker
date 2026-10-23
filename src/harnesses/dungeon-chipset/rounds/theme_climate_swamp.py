"""theme-climate swamp — 늪 던전 조각(2026-10-23): 맹그로브 뿌리 아치 · 이끼 늘어진 고목 · 연잎 · 도깨비불 · 가라앉은 석상 · 부서진 널길.

모든 화소는 이 파일의 행 문자열(또는 손으로 고른 구간 문자열 S(...))에서 온다. 잡음 함수·도형 마스크 본체 없음.
빛은 왼쪽 위 — 윗면·왼쪽 가장자리는 재질의 밝은 단, 아래·오른쪽은 어두운 단. 먹 윤곽 없음.
장면(vignette·anim)에는 버들항 늪(swamp-stilt) 바닥 조각과 Actor1 을 깐다(크기·맥락 비교 전용).

공통 범례: 나무 a~f = wood 0~5 · g = sand 3(널 하이라이트) · 뼈 h~l = bone 0~4 · 이끼 m~r = moss 0~5 · 돌 s~x = stone 0~5
  · 늪 0~7 = bog 0~7 · 물 A~E = tide 0~4 · 웅덩이 F~K = pool 0~5 · 빛 L~Q = glow 0~5 · 잎 R S T U V W Y = leaf 0~6
  · '*' ice 3 · '@' ice 4 · '^' ice 2 · '!' gold 4 · '%' gold 5 · '~' 접지 그림자.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
from theme_climate_lib import Cv, T  # noqa: E402

LG = lib.leg(lib.ramp_chars('wood', 'abcdef'), lib.ramp_chars('bone', 'hijkl'), lib.ramp_chars('moss', 'mnopqr'),
             lib.ramp_chars('stone', 'stuvwx'), lib.ramp_chars('bog', '01234567'), lib.ramp_chars('tide', 'ABCDE'),
             lib.ramp_chars('pool', 'FGHIJK'), lib.ramp_chars('glow', 'LMNOPQ'), lib.ramp_chars('leaf', 'RSTUVWY'),
             g=('sand', 3), **{'*': ('ice', 3), '@': ('ice', 4), '^': ('ice', 2), '!': ('gold', 4), '%': ('gold', 5)})


def G(rows):
    return lib.g(rows, LG)


def P(cv, rows, x, y):
    return lib.put(cv, rows, LG, x, y)


def canvas(w, h):
    return [['.'] * w for _ in range(h)]


def S(c, y, x, s):
    """구간 찍기 — 손으로 쓴 문자열 s 를 (x, y) 부터. ' ' 는 건너뜀."""
    for i, ch in enumerate(s):
        if ch != ' ':
            c[y][x + i] = ch


def rows_of(c):
    return [''.join(r) for r in c]


# ================================================================================================ 장면 바탕(버들항 늪 조각)
_GROUND = {'w': 'ground-water', 'b': 'ground-bog', 'm': 'ground-mud', 'r': 'ground-reedbed', 'd': 'ground-deck', 'p': 'ground-path'}
_GCACHE = {}


def _gtex(ch):
    if ch not in _GCACHE:
        _GCACHE[ch] = lib.bd_part('swamp-stilt/' + _GROUND[ch])
    return _GCACHE[ch]


def ground(plan):
    """plan: 행 문자열(w 물 · b 늪 · m 진흙 · r 갈대밭 · d 널 · p 길) → 버들항 늪 바닥 장면(48px 조각을 제자리 좌표로 감아 깐다)."""
    H, W = len(plan), len(plan[0])
    out = Cv(W * T, H * T)
    for y in range(H):
        for x in range(W):
            tex = _gtex(plan[y][x])
            for yy in range(T):
                for xx in range(T):
                    X, Y = x * T + xx, y * T + yy
                    out.a[Y, X] = tex.a[Y % tex.h, X % tex.w]
    return out


def mangrove():
    return lib.bd_kit('bd-pick-swamp-stilt-mangrove')


# ================================================================================================ 연잎 무리 1×1 (두 변형) 32×16
# A1 짙은 잎(leaf) 둥근 연잎 — 홈 파인 큰 잎·중간·작은 잎 + 흰 수련 한 송이 / 두 번째는 말린 새잎과 봉오리.
# A2 누런 올리브(bog) 연잎 — 가장자리가 살짝 들린 큰 잎, 개구리밥 점, 줄기에 선 분홍기 도는 연꽃 봉오리.
PAD1_L = [
    '...VWWY.WV.',
    '.VWYYWW.YWV',
    'VWY6YWVWWWV',
    'UWYWWVWWWWV',
    'UVWWWVWWWVU',
    '.UVVWWWVVU.',
    '..TUUUUUT..',
]
PAD1_M = [
    '.VW.YV.',
    'VWY6WWV',
    'UWYWWVU',
    '.UVWVU.',
    '..TTT..',
]
PAD1_S = [
    '.W.Y.',
    'VY6WV',
    '.UTU.',
]
LILYFLOWER = [
    '..l..',
    '.klk.',
    'lk!kl',
    '.jkj.',
    '..i..',
]
PAD1_CURL = [
    '.Y.',
    'WYV',
    'VWU',
    'UWT',
    '.U.',
]
BUD1 = [
    '.l.',
    'klj',
    '.V.',
    '.U.',
]


def lily_a1():
    v1 = Cv(T, T)
    P(v1, ['..~~~~~~~..', '.~~~~~~~~~~'], 1, 10)
    P(v1, PAD1_L, 1, 5)
    P(v1, ['.~~~~~.'], 9, 6)
    P(v1, PAD1_M, 8, 1)
    P(v1, ['.~~~.'], 11, 15)
    P(v1, PAD1_S, 11, 12)
    P(v1, LILYFLOWER, 2, 3)
    v2 = Cv(T, T)
    P(v2, ['.~~~~~~~.'], 0, 6)
    P(v2, PAD1_L[:-1], 0, 1)
    P(v2, ['..~~~~~.'], 7, 15)
    P(v2, PAD1_M, 7, 10)
    P(v2, ['.~~~.'], 1, 15)
    P(v2, PAD1_S, 1, 12)
    P(v2, PAD1_CURL, 12, 3)
    P(v2, BUD1, 9, 8)
    P(v2, ['..ST.'], 1, 7)
    return v1, v2


PAD2_L = [
    '...6YYYY6...',
    '.6YVUVUVVY6.',
    '6YVUVWVWVVWY',
    'YVUVWVWVWWVY',
    'U6VVWVWWVWY6',
    '.UY6WVWW6YU.',
    '...TUUUUT...',
]
PAD2_M = [
    '.6YYY6..',
    '6VUVUVY.',
    'YUVWVWW6',
    '.6YWWY6.',
    '..TUUT..',
]
LOTUS = [   # 줄기에 선 연꽃 봉오리(분홍빛 도는 흰 꽃잎 = bone, 끝 = gold 5)
    '..%..',
    '.klk.',
    'jkllk',
    '.jkj.',
    '..2..',
    '..2..',
    '..1..',
]


def lily_a2():
    v1 = Cv(T, T)
    P(v1, ['..~~~~~~~~~.'], 0, 13)
    P(v1, PAD2_L, 0, 7)
    P(v1, PAD2_M, 8, 1)
    P(v1, LOTUS, 3, 1)
    for x, y, d in ((13, 9, ['W5', '.6']), (14, 12, ['5W']), (0, 3, ['5', 'W']), (11, 14, ['6W']), (1, 0, ['W5'])):
        P(v1, d, x, y)
    v2 = Cv(T, T)
    P(v2, ['.~~~~~~~.'], 7, 12)
    P(v2, PAD2_M, 8, 9)
    P(v2, ['..~~~~~~~~.'], 0, 8)
    P(v2, [r[:11] for r in PAD2_L[1:]], 0, 3)
    P(v2, PAD2_M, 8, 0)
    for x, y, d in ((2, 12, ['5W', '.6']), (14, 6, ['W', '5']), (5, 12, ['6W']), (0, 14, ['W5'])):
        P(v2, d, x, y)
    P(v2, LOTUS[2:], 12, 4)
    return v1, v2


def _lily(fn):
    def f():
        v1, v2 = fn()
        cv = lib.hcat(v1, v2)
        bg = ground(['wwwwwww', 'wwwwwww', 'dddddww', 'dddddww', 'bbbwwww', 'bbbwwww'])
        sc = lib.on(bg, (v1, 5 * T, 1 * T), (v2, 6 * T, 3 * T), (v1, 3 * T, 0), (v2, 4 * T, 5 * T), (v2, 1 * T, 0))
        lib.put_actor(sc, 2, 3)
        return cv, {'kind': 'objects', 'parts': {'변형1': v1, '변형2': v2}, 'vignette': sc}
    return f


# ================================================================================================ 도깨비불 1×1 3장면 48×16
# A1 청록 둥근 빛 덩이(glow + ice 심) — 아래로 흔들리는 꼬리, 장면마다 1px 오르내림.
# A2 연두 불꽃 혀(bog 6·7 + glow 5) — 위로 솟는 불꽃 모양, 둘레에 작은 불티 두 개가 돈다.
ORB = [
    '..MNNM..',
    '.NPQQPN.',
    'MPQ@@QPM',
    'NQ@@@*QN',
    'MPQ@*QPM',
    '.NPQQPN.',
    '..MNNM..',
]
ORB_TAILS = [   # 밑으로 가늘어지며 흔들리는 꼬리(장면마다 휘는 방향이 바뀐다)
    ['..NOON..', '..NPN...', '..MN....', '...M....', '...L....'],
    ['..NOON..', '...NPN..', '....NM..', '....M...', '...L....'],
    ['..NOON..', '..NPN...', '...NM...', '..M.....', '..L.....'],
]
ORB_HALO = [
    [(1, 0), (13, 3), (2, 9)],
    [(12, 0), (0, 5), (14, 8)],
    [(3, 1), (14, 5), (1, 8)],
]


def wisp_a1():
    frames = []
    for i, dy in enumerate((0, -1, 0)):
        f = Cv(T, T)
        oy = 3 + dy
        P(f, ORB_TAILS[i], 4, oy + 6)
        P(f, ORB, 4, oy)
        for (x, y) in ORB_HALO[i]:
            P(f, ['L'], x, y + dy + 2)
        frames.append(f)
    return frames


FLAME = [
    ['....5...', '...56...', '...667..', '..5677..', '.567Q76.', '.56QQ@6.', '.57Q@@75', '..6QQ76.', '..5776..', '...55...'],
    ['...5....', '...65...', '..766...', '..7765..', '.67Q765.', '.6@QQ65.', '57@@Q75.', '.67QQ6..', '..6775..', '...55...'],
    ['.....5..', '....65..', '...667..', '..56775.', '.567Q76.', '.56Q@Q6.', '.57@@Q75', '..6QQ76.', '..5776..', '...55...'],
]
SPARKS = [
    [(2, 9, 'Q'), (12, 2, '6')],
    [(1, 6, '6'), (13, 5, 'Q')],
    [(3, 3, 'Q'), (12, 9, '6')],
]


def wisp_a2():
    frames = []
    for i, dy in enumerate((0, -1, 0)):
        f = Cv(T, T)
        P(f, FLAME[i], 4, 2 + dy)
        for x, y, ch in SPARKS[i]:
            P(f, [ch], x, y + dy)
        frames.append(f)
    return frames


def _wisp(fn):
    def f():
        frames = fn()
        cv = lib.hcat(*frames)
        bg = ground(['bbbbbbb', 'bbmmbbb', 'bmmwwbb', 'bbwwwwb', 'bbbwwbb', 'bbbbbbb'])
        # 어두운 늪(밤) 느낌 — 장면 바탕을 한 단 어둡게(버들항 조각 그대로, 장면 전용)
        bg.a[:, :, :3] = (bg.a[:, :, :3] * 0.55).astype('uint8')
        snag = lib.bd_kit('bd-pick-swamp-stilt-snag')
        anim = []
        for fr in frames:
            sc = lib.on(bg, (snag, 0, 0))
            lib.put_actor(sc, 2, 4)
            sc.paste(fr, 4 * T, 2 * T)
            sc.paste(fr, 5 * T + 4, 3 * T + 6)
            anim.append(sc)
        return cv, {'kind': 'objects', 'parts': {f'장면{i + 1}': fr for i, fr in enumerate(frames)}, 'anim': anim, 'vignette': anim[0]}
    return f


# ================================================================================================ 부서진 널길 끝·조각 1×1 32×16
# 버들항 늪 널 바닥(ground-deck)과 같은 결: 가로 널 3줄 + 틈 1줄(4px 주기, 틈 = wood 0), 널 윗줄 밝음, 이음 세로 줄 wood 1.
# A1 끝 = 마지막 널 앞 마구리 + 앞 모서리 말뚝 둘 + 늘어진 밧줄 / 부서짐 = 이 빠진 널, 구멍 밑으로 세로 장선 둘과 물.
# A2 끝 = 들쭉날쭉 끝 널 + 굵은 계류 말뚝(밧줄 감김)·짧은 말뚝 + 바닥에 감긴 밧줄 / 부서짐 = 큰 구멍과 물에 비스듬히 잠긴 꺾인 널.
DECK_END1 = [   # 끝 칸 널 바탕(위 칸 널에서 이어 와 마지막 널 앞 마구리에서 끝난다)
    'eefeeeebeeeeegee',
    'dddddddbdddddddd',
    'ddcdddcbdddddcdd',
    'aaaaaaaaaaaaaaaa',
    'ffffbffffgffffff',
    'eeeebeeeeeeeeeee',
    'eedebeeeeeeedeee',
    'aaaaaaaaaaaaaaaa',
    'eeeeeeebeeeeeeee',
    'dfddddddbddddfdd',
    'dddcddddbddcdddd',
    'cccccccccccccccc',
    'bbbbbbbbbbbbbbbb',
    '~~~~~~~~~~~~~~~~',
]
PILE = ['gf', 'fe', 'ed', 'ed', 'ec', 'dc', 'dc', 'ec', 'dc', 'cb']
ROPE1 = [
    'f........f',
    'bgf....fgb',
    '..bfggfb..',
]
END1 = None
BROKEN1 = [
    'eeefeeeebeeeeeee',
    'dddddcddbddddddd',
    'ddcdddddbdddcddd',
    'aaaaaaaaaaaaaaaa',
    'eeeeeg.....geeee',
    'dddedc.dc..fdddd',
    'ddddb..dc...bcdd',
    'aaaa...dc....aaa',
    '.....gfeeeebeeee',
    '..dc.edddddbdddd',
    '..dc.cdcddddcddd',
    '..dc.aaaaaaaaaaa',
    'eeeeeeeefgf..gee',
    'dddcdddbfdd...dd',
    'ddddcddbdd...bdd',
    'aaaaaaaaaa...aaa',
]
DECK_END2 = [   # 마지막 널이 짧게 끝나 오른쪽 끝에 물이 보이는 끝 칸
    'eeeeeeebeeeeefee',
    'ddcdddddbddddddd',
    'dddddcddbdddddcd',
    'aaaaaaaaaaaaaaaa',
    'fffbffffffgfffff',
    'eeebeeeeeeeeeeee',
    'eedbeeeeedeeeeee',
    'aaaaaaaaaaaacccc',
    'eeeeeebeeeeebbbb',
    'dfddddbdddcd~~~~',
    'ddddcdbddddd....',
    'cccccccccccc....',
    'bbbbbbbbbbbb....',
    '~~~~~~~~~~~~~...',
    '................',
    '................',
]
MOOR = ['gff', 'fee', 'edc', 'gfg', 'fgf', 'edc', 'edc', 'edb', 'gfb', 'fgb', 'dcb', 'dcb', 'cba']
COIL = ['.gfg.', 'gbdbf', '.fgf.']


def end_a2():
    cv = G(DECK_END2)
    P(cv, MOOR, 12, 2)
    P(cv, ['gf', 'ed', 'dc', 'cb', 'cb'], 1, 11)
    P(cv, COIL, 3, 8)
    P(cv, ['..f', '.f.', 'g..'], 8, 8)
    P(cv, ['f'], 11, 7)
    return cv


BROKEN2 = [
    'eeeeeefeeebeeeee',
    'ddddddddddbddcdd',
    'dcddddcdddbddddd',
    'aaaaaaaaaaaaaaaa',
    'eeeg.......gfeee',
    'ddc~.......~bddd',
    'dcb.........bcdd',
    'aa...........aaa',
    'efe...dfg....gee',
    'ddc....edf...cdd',
    'dcb.....ced..bdd',
    'aa.......bcd.aaa',
    'eeeeg.....bc.gee',
    'dddcd......b.ddd',
    'ddddc........cdd',
    'aaaaa........aaa',
]


def end_a1():
    cv = G(DECK_END1 + ['.' * 16] * 2)
    P(cv, PILE, 1, 6)
    P(cv, PILE, 13, 6)
    P(cv, ROPE1, 3, 7)
    return cv


def _bw(end, broken):
    def f():
        e, b = (end() if callable(end) else G(end)), G(broken)
        cv = lib.hcat(e, b)
        sc = ground(['wwwwwww', 'wwddddw', 'wwddddw', 'wwdwwdw', 'wwwwwdw', 'wwwwwww'])
        sc.paste(e, 2 * T, 3 * T)      # 널길 끝(위 칸에서 이어 옴)
        sc.paste(b, 5 * T, 3 * T)      # 부서진 칸(널길 가운데 — 위·아래 칸이 널)
        sc.paste(e, 5 * T, 5 * T)
        lib.put_actor(sc, 3, 2)
        return cv, {'kind': 'objects', 'parts': {'끝': e, '부서짐': b}, 'vignette': sc}
    return f


# ================================================================================================ 맹그로브 뿌리 아치 2×2 (위층, 아래 줄로 지나감)
# 버들항 맹그로브와 같은 나무: 줄기 wood 3·4(밝은 왼쪽 wood 5, 그늘 wood 1·2), 잎 leaf 2~6, 늘어진 이끼 bog 1·3 / moss.
# A1 양쪽에서 굵은 뿌리 둘이 올라와 머리 위에서 만나는 둥근 아치 + 위에 잎 덤불 + 늘어진 이끼 가닥, 발은 바깥·안 갈래로 갈라져 진흙에 박힘.
# A2 가는 뿌리 둘이 서로 엇갈려 뾰족한 아치(가운데서 교차) + 바깥 버팀 뿌리 + 매달린 공기뿌리, 꼭대기에 작은 잎 몇 장.
ARCH1 = [
    '................................',
    '................................',
    '................................',
    '...........deeffeefeee..........',
    '........deeedfeddddeddeed.......',
    '......deedccdccccdcccdccdded....',
    '.....eedcccbcbbcbbbcbbcbcccdd...',
    '....edccbbab.aa..ab.aabbbbccdd..',
    '....edcba...............abbcdd..',
    '...eedcb..................bcddb.',
    '...edcbb..................cddbb.',
    '...edcb...................dccb..',
    '...edcb...................dccb..',
    '...eecb...................ddcb..',
    '...edcb...................dccb..',
    '...edcb...................dccb..',
    '...efcb...................dcbb..',
    '...edcb...................dccb..',
    '...edcbb..................dccbb.',
    '...edccb.................ddccb..',
    '..eddcbb.................dccbcb.',
    '..edb.cb.................dcb.cb.',
    '..ed..dcb...............dcb..dcb',
    '.ed...dcb...............dc...dcb',
    '.ed....dc..............ddc....cb',
    '.ed....dc..............dc.....cb',
    'ed.....dc..............dc.....cb',
    'ed.....dcb.............dcb....cb',
    'ed.....edc.............dcb....cb',
    'dc.....dcb.............dcb....cb',
    'dc~...~dcb~...........~dcb~..~cb',
    'cb~~.~~bcb~~.........~~bcb~~~~bb',
]
ARCH1_LEAF = [   # 버들항 맹그로브 수관처럼 둥근 잎 덩이 셋이 겹친 덤불(위 왼쪽 밝음, 밑 그늘 + 늘어진 이끼 띠)
    '.......UVWV..VWV......',
    '....UVWWYWWVUWYWWV....',
    '..UVWYYWVWWVVWWYWWVU..',
    '.UVWYWWVUVWWYWVVWWVVU.',
    'TUVWWVVUTUVWWWVUTUVVUT',
    'TUVVVUUTSTUVVVUTSTUUTS',
    '.STUUTS2.STUUTS2.STTS.',
    '..S3SS.3...SS3....3S..',
]
ARCH1_TUFT = [
    '.UVW.',
    'TUWVU',
    'STUTS',
    '.S.S.',
]
ARCH1_MOSS = [   # (x, y, 세로 가닥) — 아치 밑면에서 늘어진 이끼
    (8, 8, '343p'), (10, 8, '3p34o'), (13, 8, '43'), (18, 8, '3p4'), (21, 8, '43p3o'), (24, 9, '34p'),
]


def arch_a1():
    cv = G(ARCH1)
    P(cv, ARCH1_LEAF, 5, 0)
    P(cv, ARCH1_TUFT, 23, 2)
    P(cv, ['.UV', 'TVW', 'ST.'], 3, 5)
    for x, y, col in ARCH1_MOSS:
        P(cv, list(col), x, y)
    for x, y, ch in ((4, 12, 'f'), (4, 13, 'f'), (5, 17, 'b'), (5, 18, 'a'), (4, 22, '2'), (3, 19, 'q'), (28, 12, 'b'),
                     (28, 13, 'a'), (27, 18, 'e'), (27, 19, 'e'), (28, 23, '2'), (7, 27, 'f'), (24, 26, 'e'), (12, 4, 'f'),
                     (20, 5, 'b'), (16, 6, 'a')):
        P(cv, [ch], x, y)
    return cv


def arch_a2():
    c = canvas(32, 32)
    # 뒤 뿌리 B(오른쪽 아래 → 왼쪽 위, 한 단 어둡게)
    for y, x, seg in ((1, 11, 'bcd'), (2, 11, 'bccdd'), (3, 12, 'bbccdd'), (4, 14, 'bbccdd'), (5, 16, 'bccdd'),
                      (6, 18, 'bccd'), (7, 19, 'bccd'), (8, 20, 'bccd'), (9, 21, 'ccd'), (10, 22, 'ccd'), (11, 22, 'dcb'),
                      (12, 23, 'dcb'), (13, 23, 'dcb'), (14, 24, 'dcb'), (15, 24, 'dcb'), (16, 24, 'dcb'), (17, 24, 'dbb'),
                      (18, 24, 'dcb'), (19, 23, 'dcb'), (20, 23, 'dcb'), (21, 23, 'dbb'), (22, 23, 'dcb'), (23, 22, 'dcb'),
                      (24, 22, 'dcb'), (25, 22, 'dcb'), (26, 22, 'dbb'), (27, 22, 'dcb'), (28, 22, 'dcb'), (29, 22, 'dcb'),
                      (30, 21, '~dcb~'), (31, 21, '~cbb~')):
        S(c, y, x, seg)
    # 바깥 버팀 뿌리 B'
    for y, x, seg in ((14, 27, 'c'), (15, 27, 'dc'), (16, 27, 'db'), (17, 28, 'dc'), (18, 28, 'db'), (19, 28, 'dc'),
                      (20, 29, 'dc'), (21, 29, 'db'), (22, 29, 'dc'), (23, 29, 'dc'), (24, 29, 'db'), (25, 29, 'dc'),
                      (26, 29, 'dc'), (27, 30, 'dc'), (28, 30, 'db'), (29, 30, 'dc'), (30, 29, '~dc'), (31, 28, '~~cb')):
        S(c, y, x, seg)
    # 앞 뿌리 A(왼쪽 아래 → 오른쪽 위, 교차에서 앞)
    for y, x, seg in ((1, 18, 'efb'), (2, 16, 'eedcb'), (3, 14, 'eeddcb'), (4, 12, 'eedcbb'), (5, 11, 'edcbb'),
                      (6, 10, 'edcb'), (7, 9, 'edcb'), (8, 8, 'edcb'), (9, 8, 'edb'), (10, 7, 'edb'), (11, 7, 'edb'),
                      (12, 6, 'edb'), (13, 6, 'edb'), (14, 5, 'edb'), (15, 5, 'fdb'), (16, 5, 'edb'), (17, 5, 'edb'),
                      (18, 5, 'edc'), (19, 6, 'edb'), (20, 6, 'edb'), (21, 6, 'fdb'), (22, 6, 'edb'), (23, 7, 'edb'),
                      (24, 7, 'edb'), (25, 7, 'edb'), (26, 7, 'ecb'), (27, 7, 'edb'), (28, 7, 'edb'), (29, 7, 'edb'),
                      (30, 6, '~edb~'), (31, 6, '~dcb~')):
        S(c, y, x, seg)
    # 바깥 버팀 뿌리 A'
    for y, x, seg in ((14, 4, 'e'), (15, 3, 'ed'), (16, 3, 'ed'), (17, 2, 'ed'), (18, 2, 'ec'), (19, 2, 'ed'),
                      (20, 1, 'ed'), (21, 1, 'ec'), (22, 1, 'ed'), (23, 1, 'ed'), (24, 1, 'ec'), (25, 1, 'ed'),
                      (26, 1, 'ed'), (27, 0, 'ed'), (28, 0, 'ec'), (29, 0, 'ed'), (30, 0, 'dc~'), (31, 0, 'cb~~')):
        S(c, y, x, seg)
    # 매달린 공기뿌리·이끼
    for x, y, col in ((13, 6, 'cbcbd'), (20, 9, 'cbccbd'), (11, 7, '3p3'), (17, 6, '43p4o'), (22, 12, '34')):
        for k, ch in enumerate(col):
            S(c, y + k, x, ch)
    cv = G(rows_of(c))
    P(cv, ['..UV.W..', '.UWYVWV.', 'TUVWUVUT', '.ST.TS..'], 12, 0)
    return cv


def _arch(fn):
    def f():
        cv = fn()
        sc = ground(['bbbbbbbb', 'bbmmmbbb', 'wwwbbmww', 'wmmmmmmw', 'wwwbbmww', 'bbbbbbbb'])
        sc.paste(lib.actor(0), 3 * T + 4, 3 * T - 14)     # 아치 가운데 밑에 선 사람(위층 아치가 머리 위를 덮는다)
        lib.put_actor(sc, 1, 3, 1)
        sc.paste(cv, 3 * T, 2 * T)
        sc.paste(mangrove(), 6 * T - 8, -T)
        return cv, {'kind': 'object', 'parts': {'아치': cv}, 'vignette': sc}
    return f


# ================================================================================================ 이끼 늘어진 죽은 가지 1×2 16×32
# 버들항 고목(snag)과 같은 나무색(wood 1~5). 수염 이끼 = moss 2~5(회녹) + bog 3·4(누런 기), 밝은 가닥은 왼쪽, 끝은 가늘게.
# A1 곧은 고목 — 부러진 꼭대기 양옆으로 V 자 가지, 두 가지에서 이끼 가닥이 커튼처럼 늘어짐, 밑동 뿌리가 진흙에 박힘.
# A2 왼쪽으로 기운 굽은 고목 — 왼쪽으로 길게 뻗은 가로 가지 하나에 빽빽한 이끼 장막, 오른쪽 짧은 곁가지, 밑동 진흙 웅덩이.
SNAG1 = [
    '................',
    '................',
    '..............e.',
    '.............ed.',
    '.e...........dc.',
    '.ed.........ed.d',
    '..ed........dcec',
    '..ed.......edcb.',
    '...ed..f.g.ec...',
    '...ed.fedgedb...',
    '....edecddcb....',
    '.....edcdcb.....',
    '......edcb......',
    '......edcb......',
    '......edbb......',
    '......fdcb......',
    '......edcb......',
    '......edca......',
    '......ebcb......',
    '......edab......',
    '......edcb......',
    '......fdcb......',
    '......edcb......',
    '......edbb......',
    '......edcb......',
    '......edcbb.....',
    '.....eddcbb.....',
    '....eedcdcbb....',
    '...ed.edcb.cb...',
    '..ed.4edcb4.cb..',
    '.ed34.ddcb43.cb~',
    '~d3443~4334~~cb~',
]
SNAG1_MOSS = [   # (x, 시작 y, 세로 가닥) — 가닥마다 길이를 들쭉날쭉하게, 이웃 가닥은 밝기를 엇갈려 줄로 읽히게
    (0, 5, 'rq4p'), (1, 6, 'rqrq4qp3qo'), (2, 8, 'po3p'), (3, 10, 'rqr4qrq4p3o'), (4, 11, 'p3o'), (5, 11, 'rq4qp3'),
    (15, 7, 'q4p3o'), (14, 7, 'rqrq4qrq3po'), (13, 8, 'p3o'), (12, 10, 'rqr4qr4qp3o.o'), (11, 10, 'po3'), (10, 12, 'rq4p'),
    (7, 11, 'q'), (9, 16, 'q'), (6, 21, 'r'), (7, 22, 'q')]
SNAG2 = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......g.f.......',
    '......efde.....e',
    '......edcb....ed',
    '...eefedcb...ed.',
    'eefddcddcbb.ecb.',
    'ddcbbbbedcbecb..',
    'bbb...edcbcb....',
    '......edcb......',
    '.......edcb.....',
    '.......edcb.....',
    '.......edbb.....',
    '.......fdcb.....',
    '........edcb....',
    '........edcb....',
    '........edab....',
    '........fdcb....',
    '........edcb....',
    '........edbb....',
    '........edcb....',
    '........edcb....',
    '........edcb....',
    '.......eedcbb...',
    '......ed.dc.cb..',
    '.....ed4.dcb.cb.',
    '....34d4G4dc43b~',
    '...~3443HG433~~.',
]
SNAG2_MOSS = [(0, 13, 'rqr4qp3o'), (1, 13, 'po3p.o'), (2, 13, 'rqrq4qrqp4p3o'), (3, 12, 'p3op'),
              (4, 12, 'rqr4qrq3po'), (5, 12, 'qp3.o'), (6, 12, 'q'), (12, 12, 'rq4p3'), (13, 11, 'po'), (14, 9, 'q4p3o'),
              (9, 19, 'q'), (8, 13, 'q'), (10, 25, 'r')]


def _snag(rows, mossl):
    def f():
        c = [list(r) for r in rows]
        for x, y, col in mossl:
            for k, ch in enumerate(col):
                c[y + k][x] = ch
        cv = G(rows_of(c))
        sc = ground(['bbbbbbb', 'bbbmmbb', 'bbmmwwb', 'bmmwwww', 'bbbwwwb', 'bbbbbbb'])
        lib.put_actor(sc, 2, 3)
        sc.paste(cv, 3 * T, 1 * T)
        sc.paste(lib.bd_kit('bd-pick-swamp-stilt-snag'), 5 * T, 0)
        return cv, {'kind': 'object', 'parts': {'고목': cv}, 'vignette': sc}
    return f


# ================================================================================================ 가라앉은 석상 머리 2×2 32×32
# 돌 stone 1~5(윗면 정수리 밝음 · 앞 얼굴 중간 · 오른쪽 그늘), 이끼 bog 2·4·5 + moss, 덩굴 bog 1·2 + leaf.
# A1 턱까지 물에 잠긴 둥근 머리 — 이마 띠에 물결 새김, 깊은 눈두덩, 코, 물에 비친 잠긴 얼굴과 둘레 물결 고리.
# A2 진흙 둔덕에 눈 아래까지 묻혀 비스듬히 기운 관 쓴 머리 — 관 돌기 다섯, 이마를 가로지른 금, 둔덕에 풀·웅덩이.
def _rows(spec, w=32, h=32):
    c = canvas(w, h)
    for y, x0, body in spec:
        S(c, y, x0, body)
    return c


IDOL1 = [
    (1, 11, 'wxW2WYWv5v'),
    (2, 8, 'vwxx2WYW2wvq4vvu'),
    (3, 7, 'uwxwwq2W2wwvvvW2ut'),
    (4, 6, 'uvwxvvwwwvsxvvWY2vut'),
    (5, 5, 'tuvwvvvwvvsvwvvWq2uuts'),
    (6, 5, 'tuvvqvwvvvvsvvvvvW2tts'),
    (7, 5, 'tuuuuvuuuuvuuuuuutt21s'),
    (8, 5, 'uvvvvuvvvvvuvvvvuut21s'),
    (9, 5, 'uvutstvutstvutstvuts1s'),
    (10, 5, 'uvvvvvvvuvvvvvvvuuttVs'),
    (11, 4, 'twxxxwwwvuxvvwwwxwwvut1s'),
    (12, 4, 'uusssssstxwvutssssssttss'),
    (13, 4, 'uvuvvvvusxwvusuvvvvuutss'),
    (14, 4, 'vutsssstuxwuttsssstuttss'),
    (15, 4, 'uvvuuuuvuxwvtsuuquuttts2'),
    (16, 4, 'tvqvvuuuvxwvusuuuuttttss'),
    (17, 5, 'uvvvuuuvxwvussuutttsss'),
    (18, 6, 'uvvuuvswvussuuttttss'),
    (19, 6, 'tuuutssssssssttttsss'),
    (20, 6, 'sttuttttttttttttssss'),
    (21, 4, '.2.W22SSSS0SSSS0SSSS22W.2.'),
    (22, 2, 'W..0SStSutSttStutSStSS0..W'),
    (23, 1, '2...00SSttSStSSSStSSS00...2'),
    (24, 3, 'W2..00SSSSSSSSSSS00..2W'),
    (25, 2, '.2W....00000000000....W2'),
    (26, 7, 'W22.W2...2W.2W22.W2'),
    (19, 2, 'W'), (20, 1, '2W'), (19, 29, 'W'), (20, 29, 'W2'), (21, 0, '2'), (21, 31, '2'),
]
IDOL1_VINES = [(8, 4, '12V21'), (9, 5, '2U'), (17, 7, '12'), (6, 6, '2'), (12, 3, '1')]


def idol_a1():
    c = _rows(IDOL1)
    for x, y, col in IDOL1_VINES:
        for k, ch in enumerate(col):
            if c[y + k][x] != '.':
                c[y + k][x] = ch
    return G(rows_of(c))


IDOL2_MUD_BACK = [
    (10, 7, '2334433344433'),
    (11, 5, '23344544433445433'),
    (12, 3, '2334455443344554433443'),
    (13, 2, '233445554433445554433442'),
    (14, 1, '2334455544334455554433443'),
]
IDOL2_HEAD = [
    (-3, 15, 'wu'),
    (-2, 14, 'xwvt'),
    (-1, 10, 'w...vxwut...v'),
    (0, 9, 'wxu..vwxvuts..vut'),
    (1, 9, 'vwvt.uvwvuts.uvts'),
    (2, 8, 'uwxwvuvwxwvvuvvutt'),
    (3, 8, 'tvtutuvt!tutvtuts'),
    (4, 8, 'tsttsttsstttsttsts'),
    (5, 7, 'uvwxwvwwvwvvvvvvutt'),
    (6, 7, 'uvwvvsxvvvvvvvvuuts'),
    (7, 7, 'uvvvvvsxvvvvvuuutts'),
    (8, 7, 'uwxxwvvswxxxvvuutts'),
    (9, 7, 'uttttttsttttttttuts'),
    (10, 7, 'uvtsstvxvutsstuutts'),
    (11, 7, 'uvtw%svxvutw%stutts'),
    (12, 7, 'uvuttuvxvuttttuutts'),
    (13, 7, 'uvvuuvvxvuuuuuuttts'),
    (14, 7, 'tuuuuvsxvtsuuuttts'),
    (15, 7, 'ttuuuttttttuuttttss'),
]
IDOL2_MUD_FRONT = [
    (13, 20, '5654'),
    (14, 15, '4556654433'),
    (15, 4, '45565445555665544554433'),
    (16, 1, '3445543344554433445544333442'),
    (17, 1, '23344433443344433344433344332'),
    (18, 0, '2334432000233443344334433343321'),
    (19, 0, '23343S00200S3344334433343333321'),
    (20, 1, '2333S00002S03343333433333333221'),
    (21, 1, '223333SSSS333333333333333221'),
    (22, 2, '2223333333333233333332333221'),
    (23, 3, '1222223322222222322222221~'),
    (24, 5, '~11122111111111211111~~~'),
    (25, 7, '~~~~~~~~~~~~~~~~~~'),
]
IDOL2_TUFTS = [(3, 12, '6'), (3, 13, '5'), (4, 13, '6'), (2, 14, '5'), (27, 13, '6'), (28, 14, '5'), (26, 14, '6'),
               (12, 15, '6'), (13, 14, '5'), (24, 16, 'W'), (25, 15, '6'), (8, 22, '5'), (22, 21, '5'), (21, 22, '6')]
IDOL2_MOSS = [(9, 2, '2'), (10, 2, 'W'), (11, 2, 'Y'), (12, 2, '2'), (19, 2, 'W'), (20, 2, '2'), (24, 2, '1'), (25, 3, '2'),
              (10, -1, '2'), (11, 0, 'W'), (22, -1, '1'), (17, -3, '2'), (8, 4, '1'), (8, 5, '2'), (8, 6, '1'), (25, 5, '2'),
              (25, 6, '1'), (25, 7, 'V'), (14, 5, 'q'), (21, 6, 'q'), (24, 12, 'q')]


def idol_a2():
    c = canvas(32, 32)
    for spec in (IDOL2_MUD_BACK, IDOL2_HEAD, IDOL2_MUD_FRONT):
        for y, x0, body in spec:
            S(c, y + 5, x0, body)
    for x, y, ch in IDOL2_TUFTS + IDOL2_MOSS:
        c[y + 5][x] = ch
    return G(rows_of(c))


def _idol(fn):
    def f():
        cv = fn()
        sc = ground(['bbbbbbb', 'bbwwwwb', 'bwwwwwb', 'bwwwwbb', 'bbwwbbb', 'bbbbbbb'])
        sc.paste(cv, 2 * T + 8, 1 * T + 6)
        lib.put_actor(sc, 1, 4)
        return cv, {'kind': 'object', 'parts': {'석상': cv}, 'vignette': sc}
    return f


FNS = {
    'tc.sw_lily': {'A1': _lily(lily_a1), 'A2': _lily(lily_a2)},
    'tc.sw_wisp': {'A1': _wisp(wisp_a1), 'A2': _wisp(wisp_a2)},
    'tc.sw_root_arch': {'A1': _arch(arch_a1), 'A2': _arch(arch_a2)},
    'tc.sw_moss': {'A1': _snag(SNAG1, SNAG1_MOSS), 'A2': _snag(SNAG2, SNAG2_MOSS)},
    'tc.sw_idol': {'A1': _idol(idol_a1), 'A2': _idol(idol_a2)},
    'tc.sw_boardwalk': {'A1': _bw(end_a1, BROKEN1), 'A2': _bw(end_a2, BROKEN2)},
}
NOTES_BY_ITEM = {
    'tc.sw_idol': {'A1': '턱까지 늪물에 잠긴 둥근 석상 머리, 이마 물결 새김·깊은 눈두덩, 물에 비친 얼굴과 물결 고리',
                   'A2': '진흙 둔덕에 코까지 묻힌 관 쓴 석상 머리(잎 모양 관 돌기 셋, 새긴 띠, 이끼 낀 눈 박힌 금빛 돌), 둔덕 풀과 물웅덩이'},
    'tc.sw_moss': {'A1': '곧은 고목 V 자 가지 둘에서 회녹 수염 이끼가 커튼처럼, 밑동 뿌리가 진흙에',
                   'A2': '왼쪽으로 기운 고목의 긴 가로 가지에 빽빽한 이끼 장막, 밑동 진흙 웅덩이'},
    'tc.sw_root_arch': {'A1': '양쪽 굵은 뿌리가 머리 위에서 만나는 둥근 아치+위 잎 덤불+늘어진 이끼, 발은 두 갈래로 진흙에',
                        'A2': '가는 뿌리 둘이 엇갈린 뾰족 아치+바깥 버팀 뿌리+매달린 공기뿌리, 꼭대기 잎 몇 장'},
    'tc.sw_lily': {'A1': '짙은 초록 둥근 연잎(홈 파인 큰 잎·중간·작은 잎)+흰 수련 / 말린 새잎과 봉오리',
                   'A2': '누런 올리브 연잎(가장자리 들림)+개구리밥 점, 줄기에 선 연꽃 봉오리'},
    'tc.sw_wisp': {'A1': '청록 둥근 빛 덩이와 아래로 흔들리는 꼬리, 1px 오르내림',
                   'A2': '연두 불꽃 혀 모양 도깨비불, 둘레를 도는 불티 둘'},
    'tc.sw_boardwalk': {'A1': '끝: 마지막 널 마구리+앞 말뚝 둘+늘어진 밧줄 / 부서짐: 이 빠진 널 사이로 장선과 물',
                        'A2': '끝: 들쭉날쭉 끝 널+밧줄 감긴 계류 말뚝 / 부서짐: 큰 구멍과 물에 비스듬히 잠긴 꺾인 널'},
}

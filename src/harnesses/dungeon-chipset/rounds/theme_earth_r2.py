"""theme-earth-r2 — theme-earth-r1 의 네 항목(선로·광맥·풀 난 판석·납골 벽)을 다시 그린 판(2026-10-23).

r1 의 위임 고름 그림(판이 내는 cv.img() 그대로)이 object-gate 화풍 반쪽에서 떨어졌다:
  - earth.rails A2: 명암 3단 < 4, 결 없음(침목·레일만 띄운 얇은 덧그림)
  - earth.ore_vein A1: 윤곽이 근흑(crock 0·1 = 무채 어둠), 질감 없음
  - earth.overgrown A2: 칸 정보량이 기준보다 훨씬 낮음(흩어진 풀 포기), 명암 3단
  - earth.ossuary A1: 판정자 fail 3/4(되풀이 해골 도장, 근흑 눈구멍·선반 줄)
판정자는 덧그림만 따로 본다. 그래서 r2 덧그림은 저마다 자기 재질(밑자리 자갈·흙, 광맥 바위, 깨진 판석·흙·이끼, 석회암 문틀·뼈)을
버들항만큼 품는다 — 재질마다 명암 4단 이상, 어두운 가장자리는 재질 색(근흑 먹 아님), 칸마다 결.
그러면서도 장면에서 덧그림으로 얹힌다(가장자리는 들쭉날쭉하게 끊겨 버들항 바닥·앞면이 비친다).

모든 화소는 이 파일의 행 문자열에서 온다(손 도트). 결 표(16×16)·밑자리 모양(#)·침목·레일·광맥·판석·뼈는 손으로 적었다.
겹쳐 찍기·뒤집기(밑자리 모양 뒤집기)·결 표에서 그 자리 글자 가져오기만 코드가 한다. 잡음 함수·도형 마스크 본체는 없다.
장면(vignette)은 r1 과 같은 빌더 키트(theme_earth_r1.scene) 위.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402
import theme_earth_r1 as r1  # noqa: E402

WAVE = 'theme_earth'
T = 16
scene, kit_cv, place, put_actor, vcat, hcat = r1.scene, r1.kit_cv, r1.place, r1.put_actor, r1.vcat, r1.hcat


def flip_v(rows):
    return list(reversed(rows))


def flip_h(rows):
    return [r[::-1] for r in rows]


def tex_fill(mask, tex, ox=0, oy=0):
    """mask 의 '#' 자리에 결 표 tex(손으로 적은 16×16) 의 그 자리 글자를 넣은 행 문자열."""
    return [''.join(tex[(y + oy) % len(tex)][(x + ox) % len(tex[0])] if ch == '#' else '.' for x, ch in enumerate(row))
            for y, row in enumerate(mask)]


def over(base, top):
    """행 문자열 겹치기: top 의 '.' 아닌 글자가 base 를 덮는다."""
    return [''.join(t if t != '.' else b for b, t in zip(br, tr)) for br, tr in zip(base, top)]


# ================================================================================================ 광산 선로
# 이음 약속은 r1 그대로: 가로 레일 5·6행 / 11·12행, 세로 레일 3·4열 / 11·12열(굽이 레일 길도 r1 A1 그대로).
# r2: 레일·침목 밑에 **밑자리(바닥에 깐 자갈·다진 흙)** 를 깔아 덧그림이 자기 결을 갖는다. 밑자리 가장자리는 들쭉날쭉,
# 칸 변에서는 가로 = 2~13행 · 세로 = 1~14열이 늘 밑자리라 어느 이음이든 이어진다.
# 침목: 윗면(왼 빛 f · 몸 e · 결 c · 오른 d) + 남쪽 마구리(b) + 밑자리에 지는 그늘(1). 레일: 윗면 I(닳은 곳 J) · 옆 L · 그늘 M.
# A1 = 회색 자갈 밑자리 + 밝은 참나무 침목 · A2 = 석탄 가루 섞인 다진 흙 밑자리 + 기름 먹은 검은 침목 + 쇠 받침판.

BED_H = [
    '................',
    '..#...##....#...',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '################',
    '.#.##..##.###..#',
    '................',
]
BED_V = [
    '.##############.',
    '.###############',
    '###############.',
    '.##############.',
    '.###############',
    '.##############.',
    '###############.',
    '.##############.',
    '.##############.',
    '.###############',
    '.##############.',
    '###############.',
    '.##############.',
    '.###############',
    '.##############.',
    '.##############.',
]
BED_SE = [
    '................',
    '................',
    '...........#..##',
    '.........#######',
    '........########',
    '.......#########',
    '......##########',
    '.....###########',
    '....############',
    '...#############',
    '...#############',
    '..##############',
    '..##############',
    '.###############',
    '.##############.',
    '.##############.',
]
BED = {'H': BED_H, 'V': BED_V, 'SE': BED_SE, 'SW': flip_h(BED_SE), 'NE': flip_v(BED_SE), 'NW': flip_h(flip_v(BED_SE))}

# 침목(가로 선로: 남북으로 누운 판 둘 — 2~4열 · 10~12열). '1' = 밑자리에 지는 그늘, K = 못 머리.
TIE_H = [
    '................',
    '................',
    '................',
    '..fff.....fff...',
    '..KeK.....KeK...',
    '..fed.....fcd...',
    '..fed.....fed...',
    '..ccc.....ccc...',
    '..fcd.....fed...',
    '..fed.....fed...',
    '..KeK.....KcK...',
    '..fed.....fed...',
    '..fed.....fed...',
    '..ccc.....ccc...',
    '..bbb1....bbb1..',
    '...111.....111..',
]
# 침목(세로 선로: 동서로 누운 판 둘 — 2~4행 · 10~12행). 윗면 2줄 + 앞 마구리 1줄 + 그늘.
TIE_V = [
    '................',
    '................',
    '.ffffffffffffff.',
    '.eKeecfeeeecKed.',
    '.bbcbbbbbcbbbbb.',
    '..1111111111111.',
    '................',
    '................',
    '................',
    '................',
    '.ffffffffffffff.',
    '.eKeefeeecee.Kd.',
    '.bbbbbcbbbbbcbb.',
    '..1111111111111.',
    '................',
    '................',
]
TIE_V[11] = '.eKeefeeeceeeKd.'
# 굽이 침목(남동): 동쪽 끝 세운 판(12~14열) · 부채꼴 빗판 둘 · 남쪽 끝 누운 판(13~14행) — r1 A2 자리를 넓혀 명암을 넣음.
# 굽이 침목은 r1 A2 의 손으로 그린 부채꼴 자리(같은 굽이 레일 길에 맞춘 것 — r1 패널이 받아들인 꼴)를 그대로 쓰고,
# 명암만 다시 매긴다: 몸 e · 결/그늘 d · 아래 c · 마구리 b, 빛 받는 왼쪽·위쪽 끝 화소는 f.
_TIE_TONE = str.maketrans({'d': 'e', 'c': 'd', 'b': 'c', 'a': 'b', '~': '.'})


def tie_tone(rows):
    t = [r.translate(_TIE_TONE) for r in rows]
    out = [list(r) for r in t]
    for y, r in enumerate(t):
        for x, ch in enumerate(r):
            if ch == 'e' and (x == 0 or t[y][x - 1] == '.' or y == 0 or t[y - 1][x] == '.'):
                out[y][x] = 'f'
    return [''.join(r) for r in out]


def tie_shade(rows, bed):
    """침목 아래쪽 끝(c·b) 바로 아래 밑자리에 그늘 1 을 찍는다."""
    out = [list(r) for r in rows]
    for y in range(15):
        for x in range(16):
            if rows[y][x] in 'cb' and rows[y + 1][x] == '.' and bed[y + 1][x] == '#':
                out[y + 1][x] = '1'
    return [''.join(r) for r in out]


def _bed_under(bed, tie):
    """침목 끝이 밑자리 밖으로 나간 곳은 밑자리를 침목 둘레 1px 까지 넓힌다(침목이 허공에 뜨지 않게)."""
    out = [list(r) for r in bed]
    for y, r in enumerate(tie):
        for x, ch in enumerate(r):
            if ch != '.':
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if 0 <= y + dy < 16 and 0 <= x + dx < 16:
                            out[y + dy][x + dx] = '#'
    return [''.join(r) for r in out]


for _k in ('SE', 'SW', 'NE', 'NW'):
    BED[_k] = _bed_under(BED[_k], r1.TIE_A2[_k])
TIE = {'H': TIE_H, 'V': TIE_V, **{k: tie_shade(tie_tone(r1.TIE_A2[k]), BED[k]) for k in ('SE', 'SW', 'NE', 'NW')}}

# 레일: I 윗면 빛 · J 닳은 반짝 · L 옆(그늘) · M 밑자리에 지는 그늘.
RAIL_H = [
    '................',
    '................',
    '................',
    '................',
    '................',
    'IIIJIIIIIIIJIIII',
    'LLLLLLLLLLLLLLLL',
    'MMMMMMMMMMMMMMMM',
    '................',
    '................',
    '................',
    'IIIIIIJIIIIIIIJI',
    'LLLLLLLLLLLLLLLL',
    'MMMMMMMMMMMMMMMM',
    '................',
    '................',
]
RAIL_V = [
    '...ILM.....ILM..',
    '...ILM.....JLM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...JLM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....JLM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
    '...JLM.....ILM..',
    '...ILM.....ILM..',
    '...ILM.....ILM..',
]
_RL = str.maketrans({'k': 'I', 'g': 'L', 'h': 'L'})


def _curve_rail(nm):
    """굽이 레일 = r1 A1 의 손으로 그린 레일 길(같은 이음 자리) + 레일 아래·오른쪽 한 칸 그늘 M(밑자리 위에만)."""
    rows = [r.translate(_RL) for r in r1.RL_A1[nm]]
    out = [list(r) for r in rows]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == 'L':
                for dx, dy in ((0, 1),):
                    X, Y = x + dx, y + dy
                    if X < 16 and Y < 16 and rows[Y][X] == '.' and BED[nm][Y][X] == '#':
                        out[Y][X] = 'M'
    return [''.join(r) for r in out]


RAIL = {'H': RAIL_H, 'V': RAIL_V, **{k: _curve_rail(k) for k in ('SE', 'SW', 'NE', 'NW')}}

# 끝 막이(동·서·남·북 끝): 밑자리 위 나무 토막(윗면 f e · 앞면 d c · 쇠띠 K J · 그늘) — 레일은 반대쪽에서 들어와 토막 앞에서 멈춘다.
STOP_E = [   # 동쪽 끝 막이(EE): 9~14열
    '.........fffff..',
    '........feeeeed.',
    '........eedcedc.',
    '........JKKKKLb.',
    '........ddcdccb.',
    '........dcccdcb.',
    '........JKKKKLb.',
    '........cbbbbba1',
    '.........111111.',
]
STOP_N = [   # 북쪽 끝 막이(EN): 1~14열, 1~6행
    '.ffffffffffffff.',
    '.feeeeeeeeeceed.',
    '.eddddcddddddcc.',
    '.JKKKKKKKKKKKKL.',
    '.dccccdccccdccb.',
    '.cbbbbbbbbbbbba1',
    '..1111111111111.',
]


def _end_tiles():
    """끝 막이 넷: 곧은 칸에서 막이 너머 레일·침목을 지우고 막이 토막을 얹는다."""
    def cut_cols(rows, a, b):
        return [''.join(ch if a <= x < b else '.' for x, ch in enumerate(r)) for r in rows]

    def cut_rows(rows, a, b):
        return [r if a <= y < b else '.' * 16 for y, r in enumerate(rows)]

    pad = lambda rows, top: ['.' * 16] * top + rows + ['.' * 16] * (16 - top - len(rows))  # noqa: E731
    ee = {'bed': BED_H, 'tie': cut_cols(TIE_H, 0, 9), 'rail': cut_cols(RAIL_H, 0, 9), 'stop': pad(STOP_E, 3)}
    ew = {'bed': BED_H, 'tie': flip_h(cut_cols(flip_h(TIE_H), 0, 9)), 'rail': cut_cols(RAIL_H, 7, 16),
          'stop': pad(STOP_W, 3)}
    en = {'bed': BED_V, 'tie': cut_rows(TIE_V, 8, 16), 'rail': cut_rows(RAIL_V, 7, 16), 'stop': pad(STOP_N, 1)}
    es = {'bed': BED_V, 'tie': cut_rows(TIE_V, 0, 8), 'rail': cut_rows(RAIL_V, 0, 9), 'stop': pad(STOP_N, 8)}
    return {'EE': ee, 'EW': ew, 'EN': en, 'ES': es}


STOP_W = [   # 서쪽 끝 막이(EW): 1~6열 — 빛은 그대로 왼쪽 위(뒤집지 않고 손으로 다시 적음)
    '..fffff.........',
    '.feeeeed........',
    '.eedcedc........',
    '.JKKKKLb........',
    '.ddcdccb........',
    '.dcccdcb........',
    '.JKKKKLb........',
    '.cbbbbba1.......',
    '..111111........',
]


# 갈래·십자 = 바탕 곧은 칸 + 곁가지 곧은 칸 일부(r1 A2 방식 — 패널이 고른 꼴). 밑자리는 둘의 합.
STUB = {
    'TN': ('H', 'V', 'rows', 0, 5), 'TS': ('H', 'V', 'rows', 13, 16),
    'TE': ('V', 'H', 'cols', 13, 16), 'TW': ('V', 'H', 'cols', 0, 3), 'X': ('H', 'V', 'all', 0, 16),
}
NAMES = r1.RAIL_NAMES


def _cut(rows, how, a, b):
    return r1._cut(rows, how, a, b)


def _union(a, b):
    return [''.join('#' if '#' in (x, y) else '.' for x, y in zip(ra, rb)) for ra, rb in zip(a, b)]


def rail_set(tex, lg):
    """이름 → 16×16 Cv. 밑자리(결 표) → 침목 → 레일 → (끝) 막이."""
    out = {}
    ends = _end_tiles()
    for nm in NAMES:
        if nm in ends:
            e = ends[nm]
            cv = grid(tex_fill(e['bed'], tex), lg)
            for lay in ('tie', 'rail', 'stop'):
                stamp(cv, e[lay], lg)
            out[nm] = cv
            continue
        if nm in STUB:
            base, br, how, a, b = STUB[nm]
            bed = _union(BED[base], _cut(BED[br], how, a, b))
            cv = grid(tex_fill(bed, tex), lg)
            stamp(cv, TIE[base], lg)
            stamp(cv, _cut(TIE[br], how, a, b), lg)
            stamp(cv, _cut(RAIL[br], how, a, b), lg)
            stamp(cv, RAIL[base], lg)
            out[nm] = cv
            continue
        cv = grid(tex_fill(BED[nm], tex), lg)
        stamp(cv, TIE[nm], lg)
        stamp(cv, RAIL[nm], lg)
        out[nm] = cv
    return out


# 밑자리 결 표(손으로 적음). A1 회색 자갈: 5 빛 · 4 · 3 몸 · 2 그늘 · 1 틈(따뜻한 rim) · 6 7 흙(동굴 바닥 cfloor).
GRAVEL_A1 = [
    '5431643546431754',
    '3216721321642163',
    '6475431647543126',
    '1632176432163475',
    '4543164354316321',
    '3216432121674316',
    '7164321643543217',
    '5431675432162543',
    '3216431216474321',
    '6475436754321647',
    '1632121632164321',
    '4354316475436475',
    '3216743216321632',
    '6431654327543164',
    '5216321643216543',
    '3164754321647321',
]
RAIL_LEG_A1 = legend(
    f=('wood', 5), e=('wood', 4), d=('wood', 3), c=('wood', 2), b=('wood', 1), a=('wood', 0),
    I=('iron', 5), J=('iron', 4), K=('iron', 3), L=('iron', 2), M=('rim', 1),
    **{'1': ('rim', 1), '2': ('stone', 2), '3': ('stone', 3), '4': ('stone', 4), '5': ('stone', 5), '6': ('cfloor', 1), '7': ('cfloor', 2)})
# A2 다진 흙: 석탄 가루 섞인 짙은 흙(cfloor 0~3 · rim 1) + 박힌 잔돌(stone 3 · 4). 침목은 한 단 어둡게(기름 먹은 나무).
EARTH_A2 = [
    '2312621323126213',
    '1263132126312632',
    '3121236312123121',
    '2634121263412634',
    '1213263121326312',
    '3126312634121263',
    '2312123121263121',
    '1263412632312634',
    '3121263121126312',
    '2634121263412123',
    '1213263121326341',
    '3126312634121263',
    '2312123121263121',
    '1263412632312634',
    '3126121263121263',
    '2312634121263412',
]
RAIL_LEG_A2 = legend(
    f=('wood', 4), e=('wood', 3), d=('wood', 2), c=('wood', 1), b=('wood', 0), a=('wood', 0),
    I=('iron', 5), J=('iron', 4), K=('iron', 3), L=('iron', 2), M=('rim', 0),
    **{'1': ('rim', 1), '2': ('cfloor', 1), '3': ('cfloor', 2), '4': ('stone', 4), '6': ('stone', 3)})


def c_rails(tex, lg):
    def fn():
        tiles = rail_set(tex, lg)
        sheet = r1.rail_sheet(tiles)
        lay = ['EN - SE H TS H SW -', 'V - V - V - V -', 'SE H X H TW - V -', 'V - V - - - NE EW', 'NE H TN H EE - - -']
        v = scene('mine', 8, 8, face_h=2)
        for y, r in enumerate(lay):
            for x, n in enumerate(r.split()):
                if n != '-':
                    v.paste(tiles[n], x * T, (y + 3) * T)
        v.paste(kit_cv('bd-pick-mining-valley-cart-h'), 4 * T, 7 * T - 20)
        v.paste(kit_cv('bd-pick-mining-valley-cart'), 0, 4 * T - 6)
        put_actor(v, 5, 6)
        return sheet, {'kind': 'objects', 'parts': {n: tiles[n] for n in NAMES}, 'vignette': v}
    return fn


CANDIDATES = {
    'earth.rails': {'A1': c_rails(GRAVEL_A1, RAIL_LEG_A1), 'A2': c_rails(EARTH_A2, RAIL_LEG_A2)},
}


# ================================================================================================ 광산 광맥(벽 앞면 덧그림)
# 패널 2: 바위 덩이(둥근 윤곽 · 근흑 테)는 「벽에 붙인 돌」, 가는 구슬 줄은 「금 간 자국」으로 읽혔다. 다시:
#   A1 = **광맥 주머니** — 벽과 같은 바위 결(버들항 바다 동굴 앞면 crock 1~5 · moss 1)을 깐 자리에 석영 줄(w v)이 비스듬히 지나고,
#        그 줄 속에 금 알갱이(윗면 r · q · 몸 p · o · 밑 n · 그늘 x = gold 0 따뜻한 밤색)가 박힘. 둘레는 벽 덩이 빛(d e)만 듬성듬성 —
#        테두리 선이 없어 벽 속으로 녹는다.
#   A2 = **굵은 광맥 띠** — 4~5px 두께로 벽을 비스듬히 가르는 석영(쇠: 철광석) 띠. 윗변은 빛 받는 턱(e), 띠 몸 3단, 아랫변 그늘(m),
#        띠 속 금(쇠) 결정 무리. 띠 둘레 2~3px 은 벽 결.
# 그림 = [금 2×2 | 쇠 2×2 | 금 1×1 | 쇠 1×1] — r1 과 같은 배치.
# 패널 3·4 · 관문: 벽빛 바탕 덩이 = 「근흑 테·반짝이 스티커」, 바탕 없는 틈 = 「X 꼴 스티커 · 정보량 부족」(관문 FAIL) →
# **금 간 광석 바위 면**: 버들항 광석 바위와 같은 검푸른 바위(vrock 1~4)를 각진 결(쪼개진 면 — 둥근 덩이·빛 모자 없음)로 꽉 채운 조각,
# 그 면을 가르는 틈(k vrock 0 깊은 틈 · j 윗입술 그늘 vrock 1 · l 아랫입술 빛 vrock 4 — 밝은 회색 테 없음) 속에 금(쇠) 알갱이,
# 바위 면 곳곳에 박힌 작은 알갱이(버들항 광석 바위의 금 점과 같은 결).
ROCK_TEX = [   # 각진 쪼개짐 결 16×16(손으로 적음) — 1 vrock 1 · 2 · 3 · 4 빛 면
    '3344322112334432',
    '3443221123443321',
    '4432211234432211',
    '3321112344322112',
    '2211223443211223',
    '1122334432112334',
    '1223344321123443',
    '2334443211234432',
    '3344432112344321',
    '3444321123443211',
    '2333211234432112',
    '1222112344321123',
    '1111223443211234',
    '2112334432112343',
    '3223443321123432',
    '3334443211234321',
]
FACE = {   # 바위 면 윤곽: 줄 → [(시작, 끝)] (끝 포함) — 각진 들쭉날쭉, 손으로 정함
    2: {3: [(9, 12), (18, 21)], 4: [(7, 14), (17, 24)], 5: [(5, 26)], 6: [(4, 27)], 7: [(3, 28)], 8: [(3, 29)], 9: [(2, 29)],
        10: [(2, 30)], 11: [(2, 30)], 12: [(1, 30)], 13: [(2, 30)], 14: [(2, 29)], 15: [(3, 29)], 16: [(3, 30)], 17: [(4, 30)],
        18: [(5, 29)], 19: [(5, 28)], 20: [(6, 27)], 21: [(7, 22), (24, 26)], 22: [(8, 20)], 23: [(10, 18)], 24: [(12, 15)]},
    1: {2: [(5, 8)], 3: [(3, 10)], 4: [(2, 12)], 5: [(1, 13)], 6: [(1, 14)], 7: [(1, 14)], 8: [(2, 14)], 9: [(2, 13)],
        10: [(3, 13)], 11: [(4, 11)], 12: [(6, 9)]},
}
SPECK = {2: [(6, 6, 'q'), (26, 8, 'p'), (4, 16, 'p'), (17, 21, 'q'), (28, 13, 'o'), (10, 19, 'r'), (21, 6, 'o')],
         1: [(11, 4, 'q'), (3, 8, 'p')]}
CRACK_ORE = {
    2: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '......................jj........',
    '.....................jkkl.......',
    '.....................kqrkl......',
    '..........jj........jkpqol......',
    '...jjjj..jkqrj......kopnkl......',
    '..jkkkkjjkqppokj....jknkl.......',
    '...lllkkkpqpoonkjj...kkl........',
    '.....llkopponnkkkkj.jkl.........',
    '.......lkonnkllkqrkjkkl.........',
    '........lkkkll.kpqpokkkjj.......',
    '.........lll..jkopoonkkkkjj.....',
    '..............jkonnkllllkkkkj...',
    '.............jkkkkll...lkqrkkj..',
    '.............kkqrl.....lkpqpokl.',
    '.............kpqol......lkonnkl.',
    '............jkopol.......lkkkl..',
    '............kopnkl........lll...',
    '............kknkl...............',
    '............lkkl................',
    '.............ll.................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
],
    1: [
    '................',
    '................',
    '................',
    '.....jj.........',
    '...jjkqrj.......',
    '..jkkkpqokj.....',
    '...llkonnkkjj...',
    '.....lllkkqrkj..',
    '........lkpqpok.',
    '........jkonnkl.',
    '.......jkkkkll..',
    '........llll....',
    '................',
    '................',
    '................',
    '................',
],
}


def _ore_face(n):
    W = 16 * n
    cv = [['.'] * W for _ in range(W)]
    for y, spans in FACE[n].items():
        for x0, x1 in spans:
            for x in range(x0, x1 + 1):
                cv[y][x] = ROCK_TEX[y % 16][x % 16]
    out = [r[:] for r in cv]
    for y in range(W):
        for x in range(W):
            if cv[y][x] == '.':
                continue
            up = y == 0 or cv[y - 1][x] == '.'
            lf = x == 0 or cv[y][x - 1] == '.'
            dn = y == W - 1 or cv[y + 1][x] == '.'
            if up or lf:
                out[y][x] = '4' if (x + y) % 3 else '3'   # 빛 받는 위·왼 깨진 모서리
            elif dn:
                out[y][x] = '2'                            # 아래 가장자리 = 바위 그늘(먹 아님)
    for y, row in enumerate(CRACK_ORE[n]):
        for x, ch in enumerate(row):
            if ch != '.' and out[y][x] != '.':
                out[y][x] = ch
    for x, y, ch in SPECK[n]:
        if out[y][x] in '1234':
            out[y][x] = ch
    return [''.join(r) for r in out]


VEIN2 = {'A1': _ore_face(2)}
VEIN1 = {'A1': _ore_face(1)}

# A2 띠(패널 2·3 뒤): 둥근 막대(윗턱 빛·아랫그늘)는 「벽에 걸친 막대」, 옅은 석영은 「뼈·깃털 스티커」로 읽혔다 →
# **검푸른 광석 바위 띠**(버들항 광석 바위와 같은 vrock) — 벽 면과 같은 높이의 넓고 들쭉날쭉한 띠(가운데 7~8px, 끝 2px),
# 몸은 얼룩 결(w v u 손으로 적은 16×16), 그 속에 금(쇠) 알갱이. 바탕 덩이·테두리 없이 띠 자체가 벽에 박힌 광맥.
SEAM = {   # 열마다 띠 윗변 dy(+1 아래 · -1 위 · 0) · 두께(몸 줄 수, 16진 한 자리) · 양옆 바위 폭 up/dn(이웃 열과 1 이상 안 벌어짐 —
           # 주기 공식으로 들쭉날쭉하게 하면 빗살로 읽힌다: 심판) · 큰 알갱이 자리 nug(열 → 4×4 결정, 띠 가운데)
    2: dict(x0=0, y0=24, dy='0-0--0-+-0--0-0-0--+-0-0--0-0-00', th='33345676544567899987765554443333',
            up='11122233322223333333222222221111', dn='11112222333322222233332222211111', nug=[7, 15, 22]),
    1: dict(x0=0, y0=12, dy='0-0--0-0-0--0-0', th='3345654456765433',
            up='1122222333222211', dn='1112222232222111', nug=[7]),
}
NUGGET = ['.rq.', 'rqpo', 'qpon', '.nx.']   # 큰 결정: 빛 r · q · 몸 p · o · 밑 n · 그늘 x — 다섯 단
QTEX = [   # 광맥 얼룩 16×16 — w 빛 · v 몸 · u 그늘 · r q p o n 알갱이 · x 그늘
    'wvwrqvvwwvwvrqwv',
    'vwvqpouwuvwwqpox',
    'wvvonxuwvwvuonxu',
    'uwvwvvwwvvwwwvuv',
    'vrqwvwwvuwvvuvwv',
    'wqpowvuvwvrqwvvu',
    'vonxvvvwwvqpovwr',
    'vvwvvuwvwvonxvuq',
    'wrqvwvvwwuvwwvwv',
    'vqpowvvwuvvwrqvw',
    'wonxvvwvvwvqqpov',
    'uvwwvuwvwvvonxwu',
    'vwvvwrqvvwwvvwvv',
    'wvuvwqpowvuwvwrq',
    'vwvwwonxwqrvwvqp',
    'vvwvuvwvvqpovwon',
]


def _seam(n):
    sp = SEAM[n]
    W = 16 * n
    cv = [['.'] * W for _ in range(W)]
    tops = {}
    y = sp['y0']
    for i, (d, t) in enumerate(zip(sp['dy'], sp['th'])):
        x = sp['x0'] + i
        if x >= W:
            break
        y += {'0': 0, '-': -1, '+': 1}[d]
        t = int(t, 16)
        top = y - t // 2
        # 광맥 양옆 광석 바위(각진 결 ROCK_TEX vrock 1~4) — 폭은 손으로 적은 up/dn
        for yy in range(top - 1 - int(sp['up'][i]), top + t + 1 + int(sp['dn'][i])):
            if 0 <= yy < W:
                cv[yy][x] = ROCK_TEX[yy % 16][x % 16]
        tops[x] = (top, t)
        for k in range(t):
            yy = top + k
            if 0 <= yy < W:
                q = QTEX[yy % 16][x % 16]
                if t <= 2 and q in 'rqpnox':
                    q = 'v'
                cv[yy][x] = q
        # 파인 홈: 윗입술 밑 그늘 x(vrock 1) · 아랫입술 빛 e(vrock 4) — 거꾸로(위 빛·아래 그늘) 하면 튀어나온 막대로 읽힌다(패널 2)
        if 0 <= top - 1 < W:
            cv[top - 1][x] = 'x'
        if 0 <= top + t < W and (x * 5) % 7:
            cv[top + t][x] = 'e'
    for nx in sp['nug']:
        top, t = tops[nx]
        cy = top + t // 2 - 2
        for dy, row in enumerate(NUGGET):
            for dx, ch in enumerate(row):
                if ch != '.':
                    cv[cy + dy][nx + dx] = ch
    out = [r[:] for r in cv]
    for yy in range(W):
        for x in range(W):
            if cv[yy][x] not in '1234':
                continue
            if yy == 0 or cv[yy - 1][x] == '.' or x == 0 or cv[yy][x - 1] == '.':
                out[yy][x] = 'h' if (x + yy) % 3 else 'H'   # 빛 받는 위·왼 가장자리 = 벽 바위 빛(올리브 회색 moss 4 · crock 5) — 벽에 묻힘
            elif yy == W - 1 or cv[yy + 1][x] == '.':
                out[yy][x] = '2'
    return [''.join(r) for r in out]


VEIN2['A2'] = _seam(2)
VEIN1['A2'] = _seam(1)

# A1 틈 광석: 금 = 몸 p o(황토 gold 3 2) · 빛 q(gold 4 — 몇 화소만) · 반짝 r(gold 5 옅은 금) · 밑 n(gold 1). 쇠 = 쇠 결정 iron 5~1.
_CRACK_L = {'k': ('vrock', 0), 'j': ('vrock', 1), 'l': ('vrock', 4), '1': ('vrock', 1), '2': ('vrock', 2), '3': ('vrock', 3), '4': ('vrock', 4)}
ORE_GOLD = legend(**_CRACK_L, n=('gold', 1), o=('gold', 2), p=('gold', 3), q=('gold', 4), r=('gold', 5))
ORE_IRON = legend(**_CRACK_L, n=('iron', 1), o=('iron', 2), p=('iron', 3), q=('iron', 4), r=('iron', 5))
# A2 광맥 띠 = 버들항 광석 바위와 같은 **검푸른 광석 바위**(vrock 3 2 1 — 벽과 같은 밝기)에 박힌 금 알갱이(r gold 5 · q 4 · p 3 · o 2 · n 1).
# 쇠 띠 = 같은 광석 바위에 은빛 쇠 결정(iron 5~1) — 붉은 철광석 띠는 흙덩이로 읽혔다.
ORE_GOLD_A2 = legend(w=('vrock', 3), v=('vrock', 2), u=('vrock', 1), e=('vrock', 4), h=('moss', 4), H=('crock', 5), **{'1': ('vrock', 1), '2': ('vrock', 2), '3': ('vrock', 3), '4': ('vrock', 4)},
                     r=('gold', 5), q=('gold', 4), p=('gold', 3), o=('gold', 2), n=('gold', 1), x=('vrock', 1))
ORE_IRON_A2 = legend(w=('vrock', 3), v=('vrock', 2), u=('vrock', 1), e=('vrock', 4), h=('moss', 4), H=('crock', 5), **{'1': ('vrock', 1), '2': ('vrock', 2), '3': ('vrock', 3), '4': ('vrock', 4)},
                     r=('iron', 5), q=('iron', 4), p=('iron', 3), o=('sand', 2), n=('sand', 1), x=('vrock', 1))   # 쇠 결정 밑동에 녹(sand 2 1) — 1배에서 쇠가 바위에 묻히지 않게(패널 4)


def c_ore(key):
    def fn():
        gl, il = (ORE_GOLD_A2, ORE_IRON_A2) if key == 'A2' else (ORE_GOLD, ORE_IRON)
        g2, i2 = grid(VEIN2[key], gl), grid(VEIN2[key], il)
        g1, i1 = grid(VEIN1[key], gl), grid(VEIN1[key], il)
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


CANDIDATES['earth.ore_vein'] = {'A1': c_ore('A1'), 'A2': c_ore('A2')}


# ================================================================================================ 유적 풀·이끼·금 간 판석(바닥 덧그림 2×2)
# 패널 2: 들린 판·밝은 테두리는 「바닥 위 돌무더기 · 걸림돌」로 읽혔다. 다시 — 모든 조각은 **바닥과 같은 높이**, 버들항 폐허 바닥의 줄눈
# (칸마다 가로 7·15행 · 위 반 15열 · 아래 반 7열 — 어느 칸에 놓아도 맞는 자리)에 맞춘다. 판석 색 = 바닥 그대로(대리석 6 빛 · 5 몸 · 4 · 3 · 2 앞변),
# 줄눈 = 흙(k wood 1 · d e cfloor 1 2 · f cfloor 0)과 풀(A~E grass · L M 짙은 잎), 판 위 이끼(m n o moss 4 5 3).
#   A1 = **금 가고 꺼진 판석 넷** — 가운데 판이 세 조각으로 갈라져 한 조각이 내려앉고(윗변 그늘 2), 오른 판 모서리는 떨어져 나가 흙·풀 구덩이,
#        왼 판은 이끼에 덮이고, 줄눈마다 풀이 비집고 나온다.
#   A2 = **줄눈 따라 번진 이끼 + 긴 금** — 이끼가 줄눈을 타고 기어 나가 교차점에서 넓게 퍼지고(판석 몸은 그대로 보임 — 둥근 덩이 없음),
#        오른 위 판에는 길게 금이 가 그 속에 풀.
OVERGROWN = {
    'A1': [
        '................................',
        '................................',
        '................................',
        '...............B................',
        '...............C................',
        '..............BkA...............',
        '.............ACkDB..............',
        '..BAkdkkCDkdkLMkdkkdkBCAkdkdkB..',
        '......Bk66565L2222k6656kCA......',
        '......Dk65555M3443d5545dB.......',
        '.......d5545kL4334C5455k........',
        '......Bk554kDLM343k4555dA.......',
        '.......k545dECL332d4545k........',
        '.....ABk4544kB2333L3443kBA......',
        '......Ck33233k2222M3323dC.......',
        '.ABkdkLMkdkkdkBACkdkkdLMkdkBA...',
        '6565nm5565nm565k655565565565656B',
        '5nmn5555mnn5545d555455o55455545A',
        '5mnnmo5545mno54L5545554o5545455.',
        '45mn5455455mn54k4554554o5fkffkfB',
        '4455m5545455m44d455455o54kDCLdkC',
        '3445445m4455443k345545o43DECBLAA',
        '233232322323322L322323o32LMDCBk.',
        '.kdkBAkdkLMkdkkdkdkBCAkdkkLMBA..',
        '......Ak665656556565656kBA......',
        '.......k55455mn55455455dC.......',
        '......Bd5455mnnm5545545k........',
        '.......k45545mn54o54455LA.......',
        '.......d554455554o45545k........',
        '.......k4454455445o4454d........',
        '.......k332323322332323k........',
        '.........BAkdkkLMkdkBA..........',
    ],
}
MOSS_TEX = [   # 이끼·풀 깔개 결 16×16(손으로 적음): B C 풀 몸(grass 1 2) · D E 빛(grass 3 4) · L N 짙은 잎(leaf 4 5) — 가장자리는 n m(moss 5 4)
    'CBDCLCBEBCDBCNBC',
    'BLCBNBCDCLBCBCDB',
    'DCBCBLBCBCBNCBLC',
    'BCECBCDBLCBEBCBC',
    'CBLBCNBCBCBDCBNE',
    'BDCBCLBCECBCLCBB',
    'CBCBDBCBBLCBCBDC',
    'LCBCBCEBCDBCBLCB',
    'CBECLBCBCBCLECBC',
    'BCBCDCBLNBCBCBCD',
    'CDBLCBEBBCBDBLCB',
    'BCLBCBCBDCBCBCEB',
    'CBCEBLCBCBECBCBL',
    'ECBCBCBLBCBCBLBC',
    'BCBLDCECBCBDCBCB',
    'CBBCBCBCECBLCBDB',
]
MAT = [   # '#' 이끼(줄눈을 따라 기어 나가 교차점에서 넓어짐) · ':' 듬성한 풀잎(결이 E D 인 곳만) · '.' 바닥 그대로
    '................................',
    '................................',
    '...............:................',
    '..............:#:...............',
    '.............:###...............',
    '.............####:..............',
    '..........:.######:.............',
    '...:.:..:#############:.:.......',
    '.....:#####..#########..........',
    '....:#######.:#####:............',
    '...:########...:#:..............',
    '....#######:....................',
    '...:########:......:............',
    '..:##########:...:###:.:........',
    '.:#############:#########:......',
    ':##################.##########:.',
    '.:#########..##################:',
    '..:#######:...:#######:.:###:...',
    '...:#####:.....:####:...........',
    '....#####........::.............',
    '....:####:......................',
    '.....###:.......................',
    '....:###..............:.........',
    '..:#######:..:##:...:###:.......',
    '.:##############:.:#####:.......',
    '..:##########:.:#######:........',
    '.....:###:........:###:.........',
    '......:##:.........:#:..........',
    '.......#:.......................',
    '......:#........................',
    '.......:........................',
    '................................',
]
# 패널 3: 곧은 어둠 줄은 「나뭇가지」로 읽혔다 → 금은 바닥 줄눈과 같은 색(j 대리석 1 · c 뼈 2)으로 들쭉날쭉 꺾이며, 떨어진 모서리 4 · 금 속 풀 C L.
CRACK = [
    '................................',
    '..................jc............',
    '..................4jc...........',
    '...................jjc..........',
    '...................4Cj4.........',
    '....................cjjc........',
    '.....................4jc........',
    '......................jj........',
    '......................cjjc......',
    '.......................4Cjc.....',
    '........................cjj4....',
    '.........................4jc....',
    '.........................cjjc...',
    '..........................4jL...',
    '...........................jc...',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
]
# 판석 바탕 = 버들항 폐허 바닥 두 칸 결 그대로(손으로 옮겨 적음: 5 몸 · G 아래 판 · c j 줄눈 · D B F n 바닥에 원래 있던 풀점) —
# 이끼 사이로 보이는 판석이 실제 바닥과 같아, 깔개 둘레에 이음이 생기지 않고 2×2 가 꽉 찬 바닥 조각이 된다(관문: 「한 칸도 안 되는 잔가지」 → 채움).
FLOOR2 = [
    '555555555555555c5555555c555555jj',
    'c55555555555555j55j5c555555555jc',
    '55j555555555555c5555555555555cjj',
    '555555555555555j55555555555555jc',
    '555555555555555j55555555555555jc',
    '555555555c55555j555555555DDD55jj',
    'c55555555555j55j5c555c5DDBDD5jjc',
    'ccccjcccjjjjjjjjcjcjcccjjccjcjjj',
    '5555555c555j55555555555cFBF55555',
    'GGG5GGGj5nGGGGGG5555555c5nn55555',
    'GG5GGGGjFnBGGGGG55j5555c55n55555',
    'GGG5cGGc5nGGGGGG5555555j55555555',
    'GGGGGGGc5GGGGGGGcc5c55cj55555555',
    'G5GGGGnj5GGGGGGG5555555j55555555',
    'GGGGGGGc5GGGGGGc55j5555c55555555',
    'GGGGGGGj5nGGGGGG5555555c55555555',
]


def _mat():
    W = 32
    cv = [list(FLOOR2[y % 16]) for y in range(W)]
    for y in range(W):
        for x in range(W):
            m, t = MAT[y][x], MOSS_TEX[y % 16][x % 16]
            if m == '#':
                cv[y][x] = t
            elif m == ':' and t in 'ED':
                cv[y][x] = t
    out = [r[:] for r in cv]
    for y in range(W):
        for x in range(W):
            if MAT[y][x] != '#':
                continue
            up = y == 0 or MAT[y - 1][x] != '#'
            lf = x == 0 or MAT[y][x - 1] != '#'
            dn = y == W - 1 or MAT[y + 1][x] != '#'
            rt = x == W - 1 or MAT[y][x + 1] != '#'
            if up or lf or dn or rt:
                out[y][x] = 'n' if (x * 3 + y) % 4 else 'm'   # 돌에 번지는 가장자리 = 바랜 이끼(moss 5 4) — 납작, 두께 그늘 없음
            elif y in (7, 15, 23) or (x % 16 == 15 and y % 16 < 7) or (x % 16 == 7 and y % 16 > 7):
                out[y][x] = 'L' if (x + y) % 3 else 'M'   # 줄눈 위 = 가장 짙은 잎(틈의 그늘)
    for y in range(W):
        for x in range(W):
            if CRACK[y][x] != '.':
                out[y][x] = CRACK[y][x]
    return [''.join(r) for r in out]


OVERGROWN['A2'] = _mat()
GRASS_L = legend(**{'6': ('marble', 6), '5': ('marble', 5), '4': ('marble', 4), '3': ('marble', 3), '2': ('marble', 2)},
                 j=('marble', 1), c=('bone', 2), k=('wood', 1), d=('cfloor', 1), e=('cfloor', 2), f=('cfloor', 0),
                 A=('grass', 0), B=('grass', 1), C=('grass', 2), D=('grass', 3), E=('grass', 4), L=('leaf', 4), M=('leaf', 3), N=('leaf', 5),
                 m=('moss', 4), n=('moss', 5), o=('moss', 3), G=('bone', 3), F=('leaf', 6))


def c_overgrown(key):
    def fn():
        o = grid(OVERGROWN[key], GRASS_L)
        v = scene('ruins', 7, 6, face_h=2)
        place(v, o, 1, 3)
        place(v, o, 4, 4)
        put_actor(v, 6, 5)
        return o, {'kind': 'object', 'parts': {'풀 난 판석': o}, 'vignette': v}
    return fn


CANDIDATES['earth.overgrown'] = {'A1': c_overgrown('A1'), 'A2': c_overgrown('A2')}


# ================================================================================================ 지하묘지 납골 벽(벽 앞면 덧그림) 3단·2단
# r1 A1 은 같은 해골 도장 줄 + 근흑 눈구멍·밋밋한 선반 띠라 판정자 fail 3/4. r2: 앞면 3칸 폭을 통째로 덮는 **석회암 문틀 안 뼈 벽** —
# 문틀(대리석 6 빛 윗면 · 5 4 앞 · 3 2 그늘 · j 이음) 안에 해골 줄 · 넓적다리뼈 마구리 줄 · 누운 긴뼈 줄을 손으로 정한 자리에 빽빽이 쌓는다.
# 해골은 일곱 꼴(앞 · 왼돌 · 오른돌 · 기운 · 턱 없음 · 금 간 · 반쯤 묻힌)이고 뒷줄은 한 단 어둡게(깊이). 뼈 사이 틈은 따뜻한 어둠 z y(rim 0·1 — 먹 아님),
# 눈구멍도 y. 뼈 명암 = bone 0~4 다섯 단(w 빛 · v · u · t · s 그늘).
SK = {
    'F': ['.vwwwv.', 'vwwwwvu', 'wyywyyu', 'vyywyyt', 'uwwzwvt', '.vtvtu.', '..utu..'],
    'L': ['.wwwvu.', 'wwwwvut', 'yywyyvt', 'yywyyut', 'wzwwvtt', 'vtvtut.', '.utu...'],
    'R': ['.uvwww.', 'tuvwwww', 'tvyywyy', 'tuyywyy', 'ttvwwzw', '.tutvtv', '...utu.'],
    'T': ['..vwwv.', '.vwwwwu', 'vyywyyu', 'wyywyvt', 'vwzwvtt', '.vtvtu.', '.......'],
    'N': ['.vwwwv.', 'vwwwwvu', 'wyywyyu', 'vyywyyt', 'uvwzvut', '.uttut.', '.......'],
    'C': ['.vwzwv.', 'vwwzwvu', 'wyyzyyu', 'vyywzyt', 'uwwzwvt', '.vtvtu.', '..utu..'],
    'H': ['.vwwwv.', 'vwwwwvu', 'wyywyyu', 'zzzzzzz', '.......', '.......', '.......'],
}
_BACK = str.maketrans({'w': 'P', 'v': 'O', 'u': 'N', 't': 'M'})   # 뒷줄 해골 = 누렇게 바랜 오래된 뼈(rim 5 4 3 2) — 한 단 어둡고 따뜻하게
KNOB = ['uwv', 'wvu', 'vut']   # 넓적다리뼈 마구리 3×3(끝이 보이게 쌓은 뼈) — 4px 마다 찍어 마구리 사이로 어둠 틈이 보인다
KNOBS = [KNOB, ['uXv', 'Xvu', 'vut'], ['NPO', 'POu', 'OuM'], ['tvw', 'vwu', 'uts']]   # 마구리 넷(새 뼈 · 반짝 X · 바랜 뼈 · 기운 뼈) — 줄마다 손으로 정한 순서로 돈다
KNOB_ORDER = [0, 2, 1, 0, 3, 0, 2, 1, 3, 0, 1, 2]
LONG = {n: ['.wv' + '.' * (n - 6) + 'wv.', 'wwv' + 'v' * (n - 6) + 'vvu', '.ut' + '.' * (n - 6) + 'tu.'] for n in (9, 11, 13, 15)}


def _canvas(w, h, fill):
    return [[fill] * w for _ in range(h)]


def _put(cv, spr, x, y):
    for dy, row in enumerate(spr):
        for dx, ch in enumerate(row):
            if ch != '.' and 0 <= y + dy < len(cv) and 0 <= x + dx < len(cv[0]):
                cv[y + dy][x + dx] = ch


# ---- 패널 2 뒤 다시: 문틀을 없앴다(「벽에 건 액자」 · 밝은 틀이 녹회색 벽돌과 부딪힘 — 패널 2). 뼈 더미가 벽 앞면 폭을 끝까지 채우고,
# 둘레는 벽돌 자리마다 들쭉날쭉 끊겨(투명 — 밑의 실제 벽돌이 보인다) 벽을 헐어 뼈를 채운 자리로 읽힌다. 맨 위 2줄 · 맨 아래 1줄은 비워
# 벽의 처마 턱과 밑동이 그대로 이어진다. 뼈는 한 단 낮추고(빛 w = bone 3, 반짝 X 만 bone 4), 틈은 따뜻한 갈색 어둠 z(rim 1)에 깊은 곳 y(rim 0).
W_OSS = 48
OSS_BANDS = {   # 'S' 해골 줄(윗행, [(x, 꼴)], 앞줄?) — 뒷줄은 앞줄 해골 사이 틈에서 윗머리만 보인다. 'K' 마구리 줄 · 'B' 누운 긴뼈.
    3: [
        ('S', 2, [(4, 'T'), (14, 'N'), (24, 'F'), (34, 'L'), (43, 'N')], False),
        ('S', 5, [(-1, 'R'), (9, 'L'), (19, 'C'), (29, 'F'), (38, 'F')], True),
        ('B', 12, [(0, 11), (10, 13), (22, 9), (30, 13), (41, 9)]),
        ('K', 15, [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]),
        ('B', 18, [(2, 13), (14, 9), (22, 11), (32, 11), (42, 9)]),
        ('S', 20, [(4, 'F'), (14, 'C'), (24, 'T'), (34, 'F'), (44, 'T')], False),
        ('S', 23, [(-1, 'F'), (9, 'R'), (18, 'N'), (28, 'F'), (37, 'L')], True),
        ('B', 30, [(1, 13), (13, 9), (21, 15), (35, 11)]),
        ('K', 33, [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]),
        ('B', 36, [(0, 9), (8, 15), (22, 11), (32, 13)]),
        ('S', 39, [(3, 'L'), (13, 'F'), (23, 'R'), (33, 'C'), (42, 'F')], True),
        ('B', 44, [(0, 15), (14, 11), (24, 13), (37, 11)]),
    ],
    2: [
        ('S', 2, [(3, 'N'), (13, 'F'), (23, 'L'), (33, 'T'), (43, 'F')], False),
        ('S', 5, [(-1, 'L'), (8, 'F'), (18, 'R'), (28, 'C'), (38, 'F')], True),
        ('B', 12, [(0, 13), (12, 9), (20, 13), (32, 11), (42, 9)]),
        ('K', 15, [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45]),
        ('B', 18, [(2, 11), (12, 15), (26, 9), (34, 13)]),
        ('S', 21, [(-2, 'F'), (7, 'C'), (17, 'F'), (27, 'R'), (37, 'N')], True),
        ('B', 28, [(0, 9), (8, 15), (22, 11), (33, 15)]),
    ],
}
# 뼈 틈 결: 따뜻한 어둠 z(rim 1)에 깊은 틈 y(rim 0)·흙 g(cfloor 0) 반점 — 손으로 적은 한 줄 주기 셋(48폭).
GAP = ['zzyzzgzyzzzyzzgzzyzzzzyzgzyzzzzyzzgzzyzzzzgzzyzz',
       'zgzzyzzzzgzzzyzzzzzyzzgzzzzyzzzgzyzzzzgzyzzzyzzg',
       'zzzyzzgzzzyzzzzzgzzyzzzzyzzgzzyzzzzzyzzgzzzzgzyz']
# 둘레 벽돌 자리(버들항 지하수로 벽돌: 7줄 높이 단, 줄눈 앞면 7·15·23·31·39행). 단마다 왼·오른 쪽으로 남겨 둔 벽돌 폭(투명) — 손으로 정함.
EDGE_L = [0, 3, 1, 4, 0, 2, 3]
EDGE_R = [2, 0, 4, 1, 3, 0, 2]


def _course(y):
    return (y + 1) // 8


def bone_wall(h, bands=None):
    """h = 3 또는 2 → 48 × h*16 줄. 둘레·위 2줄·아래 1줄은 '.'(투명)."""
    H = h * T
    bands = bands or OSS_BANDS[h]
    cv = [list(GAP[y % 3]) for y in range(H)]
    for band in bands:
        if band[0] == 'S':
            _, y, items, front = band
            for x, k in items:
                spr = SK[k] if front else [r.translate(_BACK) for r in SK[k]]
                _put(cv, spr, x, y)
        elif band[0] == 'K':
            _, y, xs = band
            for i, x in enumerate(xs):
                _put(cv, KNOBS[KNOB_ORDER[(i + y) % len(KNOB_ORDER)]], x, y)
        else:
            _, y, items = band
            for x, n in items:
                _put(cv, LONG[n], x, y)
    # 둘레 깎기: 위 2줄 · 아래 1줄 · 단마다 왼·오른 벽돌 폭. 깎인 자리 바로 안쪽 한 줄은 그늘(위·왼 = y 깊은 그늘, 오른 = z).
    for y in range(H):
        c = _course(y)
        l, r = EDGE_L[c % len(EDGE_L)], EDGE_R[c % len(EDGE_R)]
        for x in range(W_OSS):
            if y < 2 or y >= H - 1 or x < l or x >= W_OSS - r:
                cv[y][x] = '.'
    out = [r[:] for r in cv]
    for y in range(H):
        for x in range(W_OSS):
            if cv[y][x] == '.':
                continue
            up = y == 0 or cv[y - 1][x] == '.'
            lf = x == 0 or cv[y][x - 1] == '.'
            rt = x == W_OSS - 1 or cv[y][x + 1] == '.'
            if (up or lf) and cv[y][x] in 'zyg':
                out[y][x] = 'z'   # 빛 쪽 안 가장자리 = 중간 어둠(가장 어두운 단은 먹 윤곽으로 읽힌다 — 관문 OUTLINE)
    return [''.join(r) for r in out]


def ossuary(h):
    return bone_wall(h)


# 뼈 = bone 0~3(빛 w = bone 3 — 한 단 낮춤) + 반짝 X(bone 4) + 바랜 뼈 P O N M(rim 5~2) · 틈 z rim 1 · 깊은 틈·눈구멍 y rim 0 · 흙 g cfloor 0.
OSS_L = legend(w=('bone', 3), v=('bone', 2), u=('bone', 1), t=('bone', 0), s=('rim', 2), X=('bone', 4),
               P=('rim', 5), O=('rim', 4), N=('rim', 3), M=('rim', 2), y=('rim', 0), z=('rim', 1), g=('cfloor', 0),
               b=('brick', 3), c=('brick', 4), d=('brick', 5), e=('brick', 2), f=('moss', 2))


def c_oss(make, lg):
    def fn():
        o3, o2 = grid(make(3), lg), grid(make(2), lg)
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


CANDIDATES['earth.ossuary'] = {'A1': c_oss(ossuary, OSS_L)}

# A2(패널 2 뒤 새로): **벽감 선반(로쿨리)** — 벽을 가로로 판 선반 둘(3단) · 하나 반(2단). 선반 사이는 투명이라 실제 벽돌 단이 선반 칸막이가 된다.
# 선반 안: 윗턱 그늘 2줄(y z) · 안쪽 벽 어둠 · 누운 긴뼈 단 위에 해골이 앞을 보고 줄지어 놓임 · 선반 바닥(아랫턱)은 벽돌 윗면 빛 d c(3/4 로 보이는 선반 바닥).
# 양끝 2px 은 벽 그대로(투명) — 액자 틀 없이 벽 속으로 파고든 선반.
NICHE = {   # h → [(윗행, 높이, 해골 [(x, 꼴)], 뼈 [(x, n)])]
    3: [(3, 18, [(3, 'F'), (12, 'L'), (21, 'T'), (30, 'F'), (39, 'R')], [(2, 15), (16, 11), (26, 13), (38, 9)]),
        (26, 18, [(5, 'N'), (14, 'F'), (23, 'C'), (32, 'L'), (40, 'F')], [(3, 11), (13, 15), (27, 9), (35, 11)])],
    2: [(3, 13, [(3, 'L'), (12, 'F'), (21, 'R'), (30, 'F'), (39, 'T')], [(2, 13), (15, 11), (26, 15)]),
        (20, 11, [(6, 'H'), (15, 'H'), (24, 'H'), (33, 'H')], [(3, 15), (18, 11), (30, 13)])],
}


def ossuary_a2(h):
    H = h * T
    cv = [['.'] * W_OSS for _ in range(H)]
    for top, nh, skulls, bones in NICHE[h]:
        x0, x1 = 2, W_OSS - 2
        for y in range(top, top + nh):
            for x in range(x0, x1):
                cv[y][x] = GAP[(y + x // 7) % 3][x]
        # 선반 바닥(아랫턱 3줄: 윗면 빛 d · c · 앞면 b) 위에 긴뼈 단(3줄) → 그 위 해골(7줄)
        fl = top + nh - 3
        for x in range(x0, x1):
            cv[fl][x] = 'd' if (x * 7) % 11 else 'c'
            cv[fl + 1][x] = 'c' if (x * 5) % 9 else 'b'
            cv[fl + 2][x] = 'b' if (x * 3) % 7 else 'e'
        for bx, n in bones:
            _put(cv, LONG[n], bx, fl - 3)
        if nh >= 16:   # 깊은 선반: 앞 해골 사이 뒤로 바랜 해골 윗머리(깊이)
            for (ax, _), (bx2, _) in zip(skulls, skulls[1:]):
                _put(cv, [r.translate(_BACK) for r in SK['N']][:5], (ax + bx2) // 2, fl - 13)
        for sx, k in skulls:
            _put(cv, SK[k], sx, fl - 3 - (6 if k != 'H' else 3))
        # 윗턱 그늘: 맨 윗줄 y, 둘째 줄 z(뼈 위는 덮지 않음) · 양 옆 첫 열 y
        for x in range(x0, x1):
            if cv[top][x] in 'zyg':
                cv[top][x] = 'z'
            if cv[top + 1][x] in 'zyg':
                cv[top + 1][x] = 'y' if x % 3 else 'z'   # 처마 그늘은 둘째 줄부터 깊게
        for y in range(top, fl):
            if cv[y][x1 - 1] in 'zyg':
                cv[y][x1 - 1] = 'y'   # 그늘 쪽(오른) 안벽
    return [''.join(r) for r in cv]


CANDIDATES['earth.ossuary']['A2'] = c_oss(ossuary_a2, OSS_L)

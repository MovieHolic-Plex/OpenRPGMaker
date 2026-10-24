"""theme-walls-r5 — r4 VQA + object-gate 화풍 판정(평면 채움·칸 정보량 낮음 4/4) 반영(2026-10-24):
  마계·마법탑 앞면 = 돌 몸에 해시 잡티(한 단 밝게·어둡게, 돌마다 자리가 다름 — 도장 없음), 가끔 두 단 밝은 알갱이.
  마계 테두리 = 앞면과 같은 자두빛 흑요석만(비전 보라 네온 테·허공 쪽 번짐·밝은 분홍 액자 제거), 그늘 한 줄 뒤 바로 허공.
--- r4 머리말:
  theme-walls-r4 — r3 독립 VQA(sonnet+argon) 반영(2026-10-24):
  마계 앞면   「아랫단 변형 칸의 빛 뿌리가 흐린 둥근 번짐 · 같은 금이 반복 · A2 붉은 금이 그림판 번개」
              → 아랫단 변형 = 금 없는 돌 그늘 켜, 금 칸 두 벌(경로가 다름: glyph3 · glyph2), A2 금 = 어두운 진홍(red0~2, 밝은 빨강 없음).
  마계 테두리 「분홍빛 · 흑요석으로 안 읽힘」 → 턱·윗면 = vrock(검푸른 흑요석) + ostone 끝선, 밝은 단 한 단 낮춤.
  마법탑 앞면 「돌마다 같은 점 세 개 도장 · 창이 바닥에 붙고 창턱이 평평한 회색 막대」
              → 돌 결 잡티 없음(돌마다 단 차이만), 창은 윗단~가운데단(바닥에서 떨어짐), 창턱 = 윗면 빛 + 앞 그늘 + 밑 그림자 세 줄.
--- r3 머리말:
  천장 테두리  「띠가 깊이마다 한 단씩 어두워져 흐린 빛 번짐으로 읽힘 · 턱 빛 한 줄이 이어진 레일 · 탑 테두리는 회색뿐」
               → 띠 = 밝은 턱(돌마다 끊김) · 갓돌 윗면 평판 3줄(결·이음) · 그늘 한 줄 · 어둠 쪽 끝선, 바로 허공(번짐 없음).
                 탑 테두리 안쪽 끝선 = 짙은 남보라(비전 결), 갓돌 이음도 남보라.
  마계 앞면    「빛 금이 둘째·셋째 단 사이에서 끊김 · 금이 벽돌 위에 그린 납작한 네온 선」
               → 금이 세 단 끝까지 이어지고, 금 왼쪽 = 깊은 틈 그늘, 가운데 빛, 오른쪽 = 희미한 번짐(파인 틈).
  마법탑 앞면  「놋쇠 띠가 팔레트에서 튀는 줄무늬 · 회색 성벽 · 룬 판이 단추·환기구」
               → 띠 없음. 돌 = 짙은 청석(vrock), 줄눈 = 남보라(비전 결). 새김 칸 = 밤하늘과 별이 보이는 높은 아치 창
                 (창 옆 벽 두께: 그늘 쪽·빛 쪽, 창턱 윗면). 2단 = 낮은 아치 창.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
import theme_climate_lib as lib  # noqa: E402
from dot import Cv, grid, stamp  # noqa: E402
from theme_arcane_r1 import noise  # noqa: E402

WAVE = 'theme_walls'


def two_ramp(rows, joints, seed, share=45):
    """돌마다 둘째 줄 색(같은 밝기, 결이 다른 돌): 켜·이음 쪽으로 돌을 나눠 해시로 골라 a~f 를 대문자로. 칸 정보량을 늘린다."""
    out = [list(r) for r in rows]
    for y, r in enumerate(out):
        J = joints[y // 8]
        for x, c in enumerate(r):
            if c in 'abcdef':
                h = ((y // 8) * 2654435761 ^ (x < J) * 40503 ^ seed * 97) & 0xffff
                if h % 100 < share:
                    out[y][x] = c.upper()
    return [''.join(r) for r in out]


def stone_rows(joints, table, letters, seed, last_dark=True):
    """돌마다 따로 칠한다(r5: 「돌이 똑같고 한 장씩 음영이 없다」). 돌 몸 단 = 표 값 ± 해시 한 단.
    돌 안: 윗줄 빛(+1, 왼 윗모서리 두 화소 +2) · 왼쪽 열 빛(+1) · 몸은 왼위→오른아래로 한 단 내려감 ·
    오른쪽 열 그늘(-1) · 아랫줄 그늘(-1, 오른 아래 모서리 -2). 이음 줄·열 = j."""
    top = len(letters) - 1
    rows = []
    for k in range(6):
        J = joints[k]
        for yy in range(8):
            r = []
            for x in range(16):
                if yy == 7 or x == J:
                    r.append('j')
                    continue
                side = (x < J) == (J > 8)
                sx = (x - J - 1) % 16          # 돌 왼끝에서의 거리 0..14
                h = (k * 2654435761 ^ (0 if side else 40503) ^ seed * 97) & 0xffff
                base = table[k][0 if side else 1] + ((h >> 3) % 3 - 1)
                if yy == 0:
                    t = base + (2 if sx <= 1 else 1)
                elif yy == 6:
                    t = (0 if (k == 5 and last_dark) else base - 1) - (1 if sx >= 13 else 0)
                elif sx == 0:
                    t = base + 1
                elif sx == 14:
                    t = base - 1
                else:
                    t = base - (1 if sx + 2 * yy > 18 else 0) + (1 if sx + 2 * yy < 5 else 0)
                r.append(letters[max(0, min(top, t))])
            rows.append(''.join(r))
    return rows


RAMPSETS = ('abcdef', 'ABCDEF', '123456')


def three_ramp(rows, joints, seed):
    """돌마다 세 줄 색 중 하나(같은 밝기 단, 결이 다른 돌) — 버들항 앞면은 칸마다 20~40색. 단 글자 a~f 를 그 돌의 줄로 옮긴다."""
    out = [list(r) for r in rows]
    for y, r in enumerate(out):
        J = joints[y // 8]
        for x, c in enumerate(r):
            if c in 'abcdef':
                h = ((y // 8) * 2654435761 ^ (x < J) * 40503 ^ seed * 97) & 0xffff
                out[y][x] = RAMPSETS[h % 3][ 'abcdef'.index(c)]
    return [''.join(r) for r in out]


def speck3(rows, seed, top=6):
    """세 줄을 넘나드는 잡티: 같은 단의 다른 줄 색(결 섞임) 또는 한 단 위·아래. 0행(윗모서리 빛)·이음은 그대로."""
    out = [list(r) for r in rows]
    for y, r in enumerate(rows):
        if y % 8 == 0:
            continue
        for x, c in enumerate(r):
            ramp = next((R for R in RAMPSETS if c in R[:top]), None)
            if not ramp:
                continue
            i = ramp.index(c)
            h = (x * 73856093 ^ y * 19349663 ^ seed * 83492791) & 0xffffff
            m = h % 7
            if m == 0:
                out[y][x] = RAMPSETS[(RAMPSETS.index(ramp) + 1 + (h >> 7) % 2) % 3][i]
            elif m == 1:
                out[y][x] = ramp[min(i + 1, top - 1)]
            elif m == 2 and (h >> 11) % 2:
                out[y][x] = ramp[max(i - 1, 0)]
            elif m == 3 and (h >> 13) % 5 == 0:
                out[y][x] = ramp[min(i + 2, top - 1)]
    return [''.join(r) for r in out]


def speck(rows, ramp, seed, density=4, bright=23):
    """돌 몸 잡티: 해시로 고른 화소를 한 단 밝게/어둡게, 드물게 두 단 밝게(버들항 마름돌의 흰 알갱이). 윗모서리 빛 줄(0행)·이음은 그대로."""
    out = [list(r) for r in rows]
    for y, r in enumerate(rows):
        if y % 8 == 0:
            continue
        for x, c in enumerate(r):
            if c not in ramp:
                continue
            h = (x * 73856093 ^ y * 19349663 ^ seed * 83492791) & 0xffffff
            i = ramp.index(c)
            if h % bright == 0:
                out[y][x] = ramp[min(i + 2, len(ramp) - 1)]
            elif (h >> 5) % density == 0:
                out[y][x] = ramp[min(i + 1, len(ramp) - 1)] if (h >> 9) % 3 else ramp[max(i - 1, 0)]
    return [''.join(r) for r in out]
T = 16


def L(spec):
    """'a:wood0 b:iron2 ...' → 범례(잠금 팔레트 램프 아무거나)."""
    d = {}
    for tok in spec.split():
        ch, rt = tok[0], tok[2:]
        i = len(rt)
        while rt[i - 1].isdigit():
            i -= 1
        assert rt[:i] in dot.RAMPS, rt
        d[ch] = dot.C(rt[:i], int(rt[i:]))
    return d


def G(rows, lg):
    return grid(rows, lg)


def vcat(*cvs):
    return lib.vcat(*cvs)


def hcat(*cvs):
    return lib.hcat(*cvs)


# ================================================================================================ 공통 조립(피라미드 FaceSet 과 같은 자리)
class Kit:
    """face3(48×48) face2(48×32) base3(48×16) glyph3(16×48) glyph2(16×32) alt3(16×16)."""

    def image(s):
        out = Cv(128, 48)
        out.paste(s.face3, 0, 0)
        out.paste(s.face2, 48, 0)
        out.paste(s.base3, 48, 32)
        out.paste(s.glyph3, 96, 0)
        out.paste(s.glyph2, 112, 0)
        out.paste(s.alt3, 112, 32)
        return out

    def parts(s):
        return {'face3h': s.face3, 'face2h': s.face2, 'base3h': s.base3, 'glyph3h': s.glyph3, 'glyph2h': s.glyph2, 'alt3h': s.alt3}


def cols3(mid, el, er):
    """가운데 16열 행 + 끝 기둥 2열 → 왼끝·가운데·오른끝 행 목록(피라미드 _cols 와 같은 규칙)."""
    return [e + m[2:] for m, e in zip(mid, el)], mid, [m[:14] + e for m, e in zip(mid, er)]


def kit_of(rows3, lg):
    l, m, r = rows3
    return hcat(G(l, lg), G(m, lg), G(r, lg))


TWO = list(range(16)) + list(range(32, 48))   # 2단 = 윗단 + 아랫단


# ================================================================================================ 마계 벽 앞면
# 마계 벽 = 흑요석 마름돌 8줄 켜 엇쌓기. 글자: j 이음(void0) · a~f = ostone 0~5 · p q r s = 빛 1~4 단.
LOF = L('j:void0 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone4 f:ostone5 A:crock0 B:rim0 C:cfloor0 D:red0 E:marble0 F:bone0 1:void2 2:ostone1 3:arcane0 4:ostone3 5:arcane1 6:ostone5 p:arcane0 q:arcane1 r:arcane2 s:arcane3')
LOF2 = L('j:void0 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone4 f:ostone5 A:crock0 B:rim0 C:cfloor0 D:red0 E:marble0 F:bone0 1:void2 2:ostone1 3:arcane0 4:ostone3 5:arcane1 6:ostone5 p:ostone3 q:red0 r:red1 s:red2')
TONES = 'abcdef'
# 켜(8줄)마다 세로 이음 열 — 번갈아 엇쌓기. 돌 단(몸) = 켜·돌마다 손으로 정한 표(왼 돌, 오른 돌).
OF_JOINT = [4, 12, 4, 12, 4, 12]
OF_TONE = [(3, 2), (2, 3), (3, 3), (2, 2), (2, 3), (1, 2)]   # 위 켜가 밝고 아래로 어두워진다


PATHS = [
    [(7, 1), (7, 2), (7, 3), (8, 4), (8, 5), (8, 6), (9, 7), (10, 8), (10, 9), (11, 10), (11, 11), (12, 12), (12, 13), (12, 14),
     (12, 15), (11, 16), (11, 17), (10, 18), (10, 19), (10, 20), (9, 21), (9, 22), (8, 23), (8, 24), (8, 25), (7, 26),
     (7, 27), (6, 28), (6, 29), (5, 30), (5, 31), (4, 32), (4, 33), (4, 34), (5, 35), (5, 36), (6, 37),
     (6, 38), (5, 39), (5, 40), (5, 41), (6, 42), (6, 43), (6, 44), (7, 45)],
    [(10, 1), (10, 2), (9, 3), (9, 4), (8, 5), (8, 6), (8, 7), (7, 8), (7, 9), (6, 10), (6, 11), (6, 12), (7, 13), (7, 14),
     (8, 15), (8, 16), (9, 17), (9, 18), (10, 19), (10, 20), (11, 21), (11, 22), (11, 23), (10, 24), (10, 25), (9, 26),
     (9, 27), (9, 28), (10, 29), (10, 30), (11, 31), (11, 32), (12, 33), (12, 34), (11, 35), (11, 36), (10, 37),
     (10, 38), (9, 39), (9, 40), (9, 41), (8, 42), (8, 43), (8, 44), (8, 45)],
]


def other_mid(n=1, cracked=False, flip=False):
    """가운데 칸 16×48 = 켜 여섯. 켜: 0행 윗모서리(몸+1) · 1~5행 몸 · 6행 그늘(몸-1) · 7행 이음 j.
    세로 이음 오른쪽 열 = 빛(몸+1), 왼쪽 열 = 그늘(몸-1). 맨 밑 켜 6행 = 바닥에 닿는 그늘 a."""
    rows = stone_rows(OF_JOINT, OF_TONE, 'abcdef', 3 + (5 if flip else 0) + (2 if cracked else 0))
    rows[0] = rows[0].replace('d', 'e').replace('c', 'e')     # 천장 테두리 밑 첫 줄 = 밝은 끝선
    if cracked:
        rows = [list(r) for r in rows]
        # 빛 틈: 이음을 타고 지그재그로 세 단을 내려간다(손으로 적은 화소 열). 틈 가운데 r(밝은 점 s), 왼쪽 q, 아래 번짐 p.
        path = PATHS[1 if flip else 0]
        _unused = [(7, 1), (7, 2), (7, 3), (8, 4), (8, 5), (8, 6), (9, 7), (10, 8), (10, 9), (11, 10), (11, 11), (12, 12), (12, 13), (12, 14),
                (12, 15), (11, 16), (11, 17), (10, 18), (10, 19), (10, 20), (9, 21), (9, 22), (8, 23), (8, 24), (8, 25), (7, 26),
                (7, 27), (6, 28), (6, 29), (5, 30), (5, 31), (4, 32), (4, 33), (4, 34), (5, 35), (5, 36), (6, 37),
                (6, 38), (5, 39), (5, 40), (5, 41), (6, 42), (6, 43), (6, 44), (7, 45)]
        for i, (x, y) in enumerate(path):
            rows[y][x] = 's' if i in (11, 24) else ('q' if i % 5 == 3 else 'r')
            if rows[y][x - 1] not in 'qrs':
                rows[y][x - 1] = 'j'          # 틈 왼쪽 = 깊은 그늘(파인 홈)
            if rows[y][x + 1] in 'abcdefj':
                rows[y][x + 1] = 'p'          # 오른쪽 = 희미한 빛 번짐
        rows = [''.join(r) for r in rows]
    if flip:   # 둘째 금 칸 = 같은 결을 좌우로 뒤집은 길(이음 자리는 다시 맞춘다)
        rows = [''.join(r) for r in rows]
    sd = 5 + (7 if flip else 0) + (3 if cracked else 0)
    return speck3(three_ramp(rows, OF_JOINT, sd), sd)


def other_ends():
    """끝 기둥 줄: 왼끝 = 빛 받는 모서리(e·d), 오른끝 = 그늘(b·a). 이음 줄(7행)은 j, 맨 밑 켜 그늘 줄은 a."""
    el, er = [], []
    for y in range(48):
        k = y % 8
        if k == 7:
            el.append('jj'); er.append('jj')
        elif y == 46:
            el.append('ba'); er.append('aj')
        elif k == 0:
            el.append('fe'); er.append('cb')
        else:
            el.append('ed' if y < 24 else 'dc'); er.append('ba')
    return el, er


# 봉인 눈(새김 가운데 3단의 가운데 칸, 16×16): 깨진 틈이 눈 모양으로 벌어져 빛이 샌다. 둘레 = 어두운 틈 테(x·0).
EYE = [
    '................',
    '................',
    '................',
    '.....jaaaaj.....',
    '...jaapqqpaaj...',
    '..japqrssrqpaj..',
    '.japqrsttsrqpaj.',
    '.japqsttttsqpaj.',
    '..japqrssrqpaj..',
    '...jaapqqpaaj...',
    '.....jaaaaj.....',
    '......p..p......',
    '.......pq.......',
    '.......q........',
    '................',
    '................',
]
# 2단 새김(윗단 칸): 세로로 길게 갈라진 빛 틈 하나
SLIT = [
    '................',
    '.......ja.......',
    '......japa......',
    '......apqa......',
    '.....jaqraj.....',
    '.....aprsqa.....',
    '.....aqsrqa.....',
    '.....aprspa.....',
    '.....jaqrqaj....',
    '......apqa......',
    '......japa......',
    '.......ap.......',
    '.......jq.......',
    '........p.......',
    '................',
    '................',
]
# 아랫단 변형: 바닥에서 빛 뿌리가 벽을 타고 오른다(16 가로 반복 — a·15열은 비움)
ROOTS = [
    '................',
    '................',
    '................',
    '.........p......',
    '.........q......',
    '........pq......',
    '........q.......',
    '...p....q.......',
    '...qp..pq.......',
    '....q..q....p...',
    '....qp.q...pq...',
    '.....qpq...q....',
    '.....qrq..pq....',
    '....pqrqppq.....',
    '...pqrsrqqp.....',
    '..pqrssrqp......',
]
# 가운데단 변형: 크게 금 간 바위(금 = j, 금 옆 빛 e)
CRACK = [
    '................',
    '......j.........',
    '......ej........',
    '.......ej.......',
    '........j.......',
    '.......je.......',
    '......j.........',
    '.....je.........',
    '......j.........',
    '..........j.....',
    '.........je.....',
    '..........j.....',
    '...........j....',
    '................',
    '................',
    '................',
]


def other_kit(n=1):
    lg = LOF if n == 1 else LOF2
    mid = other_mid(n)
    el, er = other_ends()
    k = Kit()
    k.face3 = kit_of(cols3(mid, el, er), lg)
    k.face2 = kit_of(cols3([mid[i] for i in TWO], [el[i] for i in TWO], [er[i] for i in TWO]), lg)
    m = G(mid, lg)
    mc = G(other_mid(n, cracked=True), lg)     # 빛 금이 세 단을 타고 내려가는 칸
    k.glyph3 = mc
    mc2 = G(other_mid(n, cracked=True, flip=True), lg)
    k.glyph2 = vcat(mc2.crop(0, 8, 16, 16), mc2.crop(0, 32, 16, 16))
    bot = cols3(mid[32:48], el[32:48], er[32:48])
    cells = [G(r, lg) for r in bot]
    k.base3 = hcat(*cells)   # 아랫단 = 금 없는 돌(r3 빛 뿌리는 흐린 번짐으로 읽혀 뺐다)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, CRACK, lg, 0, 0)
    k.alt3 = alt
    k.lg = lg
    return k


# ================================================================================================ 천장 테두리(마계·마법탑 공용 조립)
# 띠(바깥 → 안) 8줄을 **깊이 d(0~7) 마다 한 단**으로 정하고, 변·모서리 조각을 모두 같은 깊이 규칙으로 계산한다:
#   N 변 화소 (x, y) 깊이 = 7 - y(위가 안쪽 어둠, 아래가 바닥 쪽 턱)   … 띠는 칸 아래쪽 8줄(바닥·앞면과 닿는 쪽)
# 그런데 dot.Autotile 의 N 조각은 「위쪽이 열린 칸」의 위 띠다 — 열린 쪽(바깥)이 0행. 그래서 깊이 = 행 번호(0 = 열린 쪽 턱).
#   바깥 모서리 NW: 깊이 = min(x, y)  · 안 모서리 NW: 깊이 = max(... ) 가 아니라 대각 열린 칸까지의 거리 = max(x, y)
# 결(이음·점)은 띠 결 표 GRAIN[d] 가 열 x 에 따라 바꾸는 글자로 준다(변 방향을 따라 흐른다). 몸통 = 허공 어둠.
def band_piece(depth_tone, grain, w, h, depth_fn, along_fn):
    rows = []
    for y in range(h):
        r = []
        for x in range(w):
            d = depth_fn(x, y)
            if d > 7:
                r.append('.')
                continue
            ch = depth_tone[d]
            g = grain.get(d)
            if g and along_fn(x, y) % len(g) < len(g) and g[along_fn(x, y) % len(g)] != '.':
                ch = g[along_fn(x, y) % len(g)]
            r.append(ch)
        rows.append(''.join(r))
    return rows


def rim_autotile(depth_tone, grain, body, lg):
    N = band_piece(depth_tone, grain, 16, 8, lambda x, y: y, lambda x, y: x)
    W_ = band_piece(depth_tone, grain, 8, 16, lambda x, y: x, lambda x, y: y)
    ON = band_piece(depth_tone, grain, 8, 8, lambda x, y: min(x, y), lambda x, y: x + y)
    IN = band_piece(depth_tone, grain, 8, 8, lambda x, y: max(7 - x, 7 - y) if False else min(7, max(0, 8 - min(8 - x, 8 - y) - 0) if False else 0), lambda x, y: x)
    # 안 모서리 NW: 위·왼 칸은 천장으로 이어지고 북서 대각 칸만 열려 있다 → 열린 대각 꼭짓점(0,0)에서의 거리 = max(x, y)
    IN = band_piece(depth_tone, grain, 8, 8, lambda x, y: max(x, y), lambda x, y: x + y)
    edge, outer, inner = rot_pieces(N, W_, ON, IN, lg)
    return dot.Autotile(G(body, lg), edge, outer, inner)


def rot_pieces(Nrows, Wrows, ONrows, INrows, lg):
    vflip = lambda rs: rs[::-1]  # noqa: E731
    hflip = lambda rs: [r[::-1] for r in rs]  # noqa: E731
    edge = {'N': G(Nrows, lg), 'S': G(vflip(Nrows), lg), 'W': G(Wrows, lg), 'E': G(hflip(Wrows), lg)}
    outer = {'NW': G(ONrows, lg), 'NE': G(hflip(ONrows), lg), 'SW': G(vflip(ONrows), lg), 'SE': G(vflip(hflip(ONrows)), lg)}
    inner = {'NW': G(INrows, lg), 'NE': G(hflip(INrows), lg), 'SW': G(vflip(INrows), lg), 'SE': G(vflip(hflip(INrows)), lg)}
    return edge, outer, inner


RIM_BODY = [
    'xxxyxxxxxxxyxxxx',
    'xyxxxxxzxxxxxxyx',
    'xxxxxxxxxxxxxxxx',
    'xxxxyxxxxyxxxxxx',
    'yxxxxxxxxxxxxzxx',
    'xxxxxxyxxxxxxxxx',
    'xxzxxxxxxxxyxxxx',
    'xxxxxxxxxxxxxxxy',
    'xxxxxyxxxxxxxxxx',
    'xyxxxxxxxzxxyxxx',
    'xxxxxxxxxxxxxxxx',
    'xxxxxxxyxxxxxxxx',
    'yxxxxxxxxxxxxxyx',
    'xxxxzxxxxxyxxxxx',
    'xxxxxxxxxxxxxxxx',
    'xxyxxxxxxxxxxxxx',
]
# 마계 테두리: 깊이 0 밝은 턱 f · 1 e · 2~3 d(결 = 금 b) · 4 c · 5 b · 6 a · 7 j(어둠 쪽 끝)
LOR = L('j:void1 a:ostone0 b:ostone0 c:ostone1 d:ostone2 e:ostone3 f:ostone4 x:void0 y:void1 z:void2')
LOR2 = L('j:void1 a:ostone0 b:ostone1 c:ostone1 d:ostone2 e:ostone3 f:ostone5 x:void0 y:void1 z:void2')
OR_TONE = 'fedddbjj'     # 턱 · 윗면 빛 · 윗면 평판 3 · 그늘 · 끝선 · 어둠 쪽 끝
OR_GRAIN = {0: 'fffffcefffffffce', 1: 'eeeeebdeeeeeeebd', 2: 'ddcddbdddddeddbd', 3: 'dddddbddcdddddbd', 4: 'deddcbdddddcddbd'}


def other_rim(n=1):
    return rim_autotile(OR_TONE, OR_GRAIN, RIM_BODY, LOR if n == 1 else LOR2)


# ================================================================================================ 마법탑 벽 앞면
# 짙은 청석 마름돌 8줄 켜(엇쌓기, 돌마다 단이 달라 얼룩) · 줄눈 = 남보라(arcane0, 비전 결) · 돌 결 점.
# 글자: j 줄눈 · a~e = vrock 0~4 · u v w = 창 밤하늘(void1 · arcane0 · arcane1) · S 별(ice3) · t 별 희미(arcane3) · k l = 창턱 윗면(iron4·iron5)
LTF = L('j:arcane0 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 A:iron0 B:iron1 C:iron2 D:iron3 E:iron4 1:castle0 2:castle1 3:castle2 4:castle4 5:castle5 o:void0 u:void1 v:arcane0 w:arcane1 S:ice3 t:arcane3 k:iron4 l:iron5')
# A2 = 흰 대리석 탑(밝은 마름돌, 줄눈 = 짙은 남보라) — 창은 같은 밤하늘
LTF2 = L('j:arcane1 a:marble1 b:marble2 c:marble3 d:marble4 e:marble5 A:cfloor1 B:cfloor2 C:cfloor4 D:cfloor7 E:bone4 1:bone0 2:bone1 3:bone2 4:bone3 5:snow0 o:void0 u:void1 v:arcane0 w:arcane1 S:ice3 t:arcane3 k:iron4 l:iron5')
TF_TONE = 'abcde'
TF_JOINT = [5, 13, 5, 13, 5, 13]
TF_STONE = [(3, 2), (2, 3), (2, 2), (3, 2), (2, 3), (1, 2)]


def tower_mid(n=1):
    rows = stone_rows(TF_JOINT, TF_STONE, 'abcde', 7 + n)
    rows[0] = 'e' * 16
    return speck3(three_ramp(rows, TF_JOINT, 9 + n), 9 + n, top=5)   # r5: 세 줄 돌 + 줄 넘는 잡티


def tower_ends():
    el, er = [], []
    for y in range(48):
        k = y % 8
        if k == 7:
            el.append('jj'); er.append('jj')
        elif y == 46:
            el.append('ba'); er.append('aa')
        elif k == 0:
            el.append('ee'); er.append('ca')
        else:
            el.append('ed' if y < 24 else 'dc'); er.append('ba')
    return el, er


# 높은 아치 창(새김 3단, 16×48): 창 = 밤하늘(별), 왼쪽 벽 두께 = 그늘 a·b(빛이 오른쪽 위에서 안 들어옴), 오른쪽 두께 = 빛 d,
# 아치 머리 = 쐐기돌(e), 창턱 = 윗면 k·l + 앞 그늘. 위·아래 켜는 가운데 칸 돌결 그대로(창 둘레 2열은 돌).
WINDOW = [
    '................',
    '................',
    '....jjjjjjjj....',
    '...jeddddddej...',
    '..jedaouuuoedj..',
    '..jdaovvwvuodj..',
    '..jbauvvwSvudj..',
    '..jbauvvvvvudj..',
    '..jbauwtvvvudj..',
    '..jbauvvvvwudj..',
    '..jbauvvvvvudj..',
    '..jbauvSvvvudj..',
    '..jbauvvvvtudj..',
    '..jbauvvvvvudj..',
    '..jbauwvvvvudj..',
    '..jbauvvvvvudj..',
    '..jbauvvvtvudj..',
    '..jbauvvvvvudj..',
    '..jbauvvvvvudj..',
    '..jbauvvvvvudj..',
    '..jbaouuuuuodj..',
    '.jllllllllllllj.',
    '.jkkkkkkkkkkkkj.',
    '.jbbbbbbbbbbbbj.',
    '..aaaaaaaaaaaa..',
]
WINDOW_LOW = WINDOW[:5] + WINDOW[9:15] + WINDOW[20:25]   # 2단(32줄)용 낮은 창 16줄 + 위·아래 돌


def tower_kit(n=1):
    lg = LTF if n == 1 else LTF2
    mid = tower_mid(n)
    el, er = tower_ends()
    k = Kit()
    k.face3 = kit_of(cols3(mid, el, er), lg)
    k.face2 = kit_of(cols3([mid[i] for i in TWO], [el[i] for i in TWO], [er[i] for i in TWO]), lg)
    m = G(mid, lg)
    win = Cv(16, 48)
    win.a[:] = m.a
    stamp(win, WINDOW, lg, 0, 1)    # 창 = 윗단~가운데단(바닥에서 한 단 위)
    k.glyph3 = win
    m2 = G([mid[i] for i in TWO], lg)
    w2 = Cv(16, 32)
    w2.a[:] = m2.a
    stamp(w2, WINDOW_LOW, lg, 0, 1)
    k.glyph2 = w2
    bot = cols3(mid[32:48], el[32:48], er[32:48])
    cells = [G(r, lg) for r in bot]
    for c in cells:
        # r5: 굽도리 = 앞으로 나온 큰 돌 켜(돌마다 단·결이 다름, 위에 그림자 한 줄), 납작한 쇠 막대 아님
        stamp(c, ['aaaaaaaaaaaaaaaa', 'eEdedjd2eDeedj3e', 'dCcDcjc3dcCdcj2d', 'cB3cbjbc3bBccjcb', 'bAbabjab2abAbjba', 'jjjjjjjjjjjjjjjj'], lg, 0, 9)
    k.base3 = hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, ['.....jj.........', '....jabj........', '....jaoj........', '....jaoj........', '....jaoj........', '....jaoj........',
                '....jlkj........', '....jjjj........'], lg, 0, 4)     # 화살 구멍
    k.alt3 = alt
    k.lg = lg
    return k


# ================================================================================================ 마법탑 천장 테두리
# 갓돌 두 켜: 깊이 0 밝은 턱 e · 1 윗켜 d(이음 j, 8 주기) · 2 d · 3 줄눈 a · 4 아랫켜 c(이음 4·12 엇갈림) · 5 c · 6 b · 7 j
LTR = L('j:void1 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:vrock4 n:arcane0 x:void0 y:void1 z:void2')
LTR2 = L('j:void1 a:vrock0 b:vrock1 c:vrock2 d:vrock3 e:iron4 n:arcane1 x:void0 y:void1 z:void2')
TR_TONE = 'edcccbnj'     # 턱 · 갓돌 윗면 빛 · 평판 3 · 그늘 · 남보라 끝선 · 어둠 쪽 끝
TR_GRAIN = {k: v[-4:] + v[:-4] for k, v in {0: 'eeeeeeebeeeeeeeb', 1: 'ddddddnbddddddnb', 2: 'ccdccbnbcccdccnb', 3: 'cccccnbccccccnbc', 4: 'cdcccnbcccdccnbc'}.items()}   # 이음을 칸 경계(15열)에서 3·11열로


def tower_rim(n=1):
    return rim_autotile(TR_TONE, TR_GRAIN, RIM_BODY, LTR if n == 1 else LTR2)


# ================================================================================================ 장면
ROOM = [
    '##########',
    '##########',
    '##########',
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
]
TEST = [
    '##############',
    '##############',
    '##############',
    '##############',
    '##....########',
    '##....########',
    '##....###...##',
    '##..........##',
    '##..........##',
    '#####.....####',
    '#####.....####',
    '##############',
]


def floor_fn(theme):
    at = R1.ground_at('A2') if theme == 'other' else R1.floor_at('A1')
    bodies = at.bodies
    return lambda x, y: bodies[dot.cell_hash(x, y) % len(bodies)]


def room(theme, n, plan=ROOM, glyph=True, rim_n=None):
    k = other_kit(n) if theme == 'other' else tower_kit(n)
    rim = (other_rim if theme == 'other' else tower_rim)(rim_n or n)
    out = lib.rooms_render(plan, rim, k.face3, k.face2, floor_fn(theme))
    if glyph:
        # 가운데 칸 하나를 새김 칸으로(시공기 14% 규칙의 한 예)
        H, W = len(plan), len(plan[0])
        for y in range(H - 1):
            for x in range(1, W - 1):
                if plan[y + 1][x] == '.' and plan[y][x] == '#' and plan[y + 1][x - 1] == '.' and plan[y + 1][x + 1] == '.':
                    if (x * 7 + y) % 5 == 2:
                        out.paste(k.glyph3, x * T, (y - 2) * T)
    return out


def scene(theme, n, rim_n=None):
    v = room(theme, n, rim_n=rim_n)
    lib.put_actor(v, 3, 6)
    return v


def mk_face(theme, n):
    def run():
        k = other_kit(n) if theme == 'other' else tower_kit(n)
        img = k.image()
        wall = hcat(k.face3.crop(0, 0, 16, 48), k.face3.crop(16, 0, 16, 48), k.glyph3, k.face3.crop(16, 0, 16, 48),
                    vcat(k.face3.crop(16, 0, 16, 16), k.alt3, k.base3.crop(16, 0, 16, 16)), k.face3.crop(16, 0, 16, 48),
                    k.face3.crop(32, 0, 16, 48))
        return img, {'kind': 'tile', 'parts': k.parts(), 'vignette': scene(theme, n),
                     'extras': [('wall run 3h', wall, 3), ('test map', room(theme, n, TEST), 2)]}
    return run


def mk_rim(theme, n):
    def run():
        at = (other_rim if theme == 'other' else tower_rim)(n)
        img = lib.atlas47(at)
        return img, {'kind': 'autotile', 'autotiles': {'rim': at}, 'vignette': scene(theme, 1, rim_n=n),
                     'extras': [('body 6x6', dot.mosaic(at, 6, 6), 3), ('test map', room(theme, 1, TEST, rim_n=n), 2)]}
    return run


NOTES = {
    ('wall.other_face', 'A1'): '보라 검은 흑요석 바위 면(손으로 놓은 깨진 면 22장, 면마다 위 빛·아래 그늘) + 틈을 타는 보라 빛 줄기, 새김 = 빛이 새는 봉인 눈, 아랫단 = 빛 뿌리',
    ('wall.other_face', 'A2'): '같은 짜임, 줄기·눈 = 핏빛·불빛, 면 셋에 하나는 한 단 어둡게',
    ('wall.other_rim', 'A1'): '허공 어둠 몸통 + 깨진 보라 검은 돌 윗면 띠, 바닥 쪽 끝에 끊긴 보라 빛 테',
    ('wall.other_rim', 'A2'): '같은 띠, 빛 테 = 핏빛',
    ('wall.tower_face', 'A1'): '짙은 청석 마름돌 + 남보라 줄눈, 새김 = 밤하늘·별이 보이는 높은 아치 창, 아랫단 = 굽도리 돌림돌, 변형 = 화살 구멍',
    ('wall.tower_face', 'A2'): '흰 대리석 마름돌 + 짙은 남보라 줄눈, 같은 밤하늘 아치 창',
    ('wall.tower_rim', 'A1'): '청회색 갓돌 두 켜(이음 엇갈림) + 밝은 턱, 안쪽 어둠',
    ('wall.tower_rim', 'A2'): '회갈 갓돌 두 켜',
}
FNS = {
    'wall.other_face': {'A1': mk_face('other', 1), 'A2': mk_face('other', 2)},
    'wall.other_rim': {'A1': mk_rim('other', 1), 'A2': mk_rim('other', 2)},
    'wall.tower_face': {'A1': mk_face('tower', 1), 'A2': mk_face('tower', 2)},
    'wall.tower_rim': {'A1': mk_rim('tower', 1), 'A2': mk_rim('tower', 2)},
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = '줄 공통 — ' + note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}


def line_scenes():
    return {}


# VQA 보드에 같이 놓는 버들항 기준(같은 용도: 벽 앞면 키트·천장 둘레가 보이는 방)
BOARD_REFS = {
    'wall.other_face': ['bd-pick-castle-catacombs-face-castle-3h', 'bd-pick-sea-cave-face-cave-3h'],
    'wall.tower_face': ['bd-pick-castle-catacombs-face-castle-3h', 'bd-pick-temple-ruins-face-temple-3h'],
    'wall.other_rim': ['bd-pick-castle-catacombs-face-castle-3h'],
    'wall.tower_rim': ['bd-pick-castle-catacombs-face-castle-3h'],
}

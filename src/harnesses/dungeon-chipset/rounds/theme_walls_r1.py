"""theme-walls-r1 — 마계·마법탑 벽 앞면과 천장 테두리(2026-10-24, 감독 dungeon-themes 재개).

빌더(profiles.ts)는 마계(otherworld)·마법탑(tower)에 `TK("otherworld-face-3h|2h")`·`TK("tower-face-3h|2h")` 와 천장
`beodeul_dungeon_ceiling_void` 를 찾는데 그림이 없어, 두 주제 모두 회색 동굴·성 벽과 회색 테두리로 지어졌다(마계가 회색 성처럼 읽힘).
이 판은 그 네 조각을 그린다. 짜임은 피라미드(theme_climate_desert) 벽 키트와 같다 — 그래서 시공기·굽기 규칙을 그대로 쓴다.

  wall.other_face  마계 벽 앞면: 흑요석 같은 보라 검은 바위 면(손으로 놓은 깨진 면 표, 면마다 위 빛·아래 그늘), 면 사이 틈 몇 곳에
                   보라 빛 줄기. 새김 가운데 칸 = 틈에서 빛이 새는 봉인 눈(눈 모양 빛 틈). 아랫단 변형 = 바닥에서 올라온 빛 뿌리.
  wall.other_rim   마계 천장 테두리 47: 몸통 = 별 없는 허공 어둠, 띠 = 깨진 보라 검은 돌 윗면 + 바닥 쪽 끝에 밝은 턱과 보라 빛 테.
  wall.tower_face  마법탑 벽 앞면: 다듬은 청회색 마름돌(켜 6줄, 엇쌓기, 돌마다 위 빛·아래 그늘) + 가운데단에 놋쇠 띠돌.
                   새김 가운데 칸 = 띠돌 위 청색 빛 룬 판. 아랫단 변형 = 돌림띠 굽도리(밝은 턱 + 그늘).
  wall.tower_rim   마법탑 천장 테두리 47: 다듬은 갓돌 두 켜(이음 엇갈림) + 바닥 쪽 밝은 턱, 안쪽 어둠.

모든 화소는 이 파일의 행 문자열 또는 손으로 적은 면 표에서 온다. 빛은 왼쪽 위.
그림 배치(앞면, 128×48 — 피라미드와 같음): x0-47 3단 키트 · x48-95 y0-31 2단 키트 · y32-47 3단 아랫단 변형 ·
x96-111 새김 가운데 3단 · x112-127 y0-31 새김 가운데 2단 · y32-47 3단 가운데단 변형.
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
# 마계 벽 = 흑요석 큰 마름돌(크로노 트리거 마왕성처럼 단마다 큰 돌 한 장, 이음 자리는 단마다 엇갈림) + 금 몇 곳에서 보라 빛이 샌다.
# 글자: j 이음(void0) · a b c d e f = ostone 0~5(어둠 → 밝은 모서리) · p q r s t = arcane 1~5 빛.
LOF = L('j:void0 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone4 f:ostone5 p:arcane0 q:arcane1 r:arcane2 s:arcane3 t:arcane4')
# A2 = 핏빛 마계: 돌은 같고 빛 = 붉은·불빛
LOF2 = L('j:void0 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone4 f:ostone5 p:red0 q:red1 r:red3 s:fire3 t:fire5')
# 단(16줄)마다 이음 열 · 윤기 사선 시작 열 · 빛 금(손으로 적은 화소 목록, 단 안 좌표)
OF_TIERS = [
    dict(joint=5, sheen=8, crack=[(11, 4), (11, 5), (12, 6), (12, 7), (13, 8), (12, 9), (12, 10)]),
    dict(joint=12, sheen=2, crack=[(4, 3), (5, 4), (5, 5), (6, 6), (6, 7), (7, 8), (7, 9), (8, 10), (8, 11)]),
    dict(joint=3, sheen=10, crack=[(13, 2), (13, 3), (12, 4), (12, 5), (11, 6)]),
]


def other_tier(t, n):
    """16×16 단 하나: 0행 밝은 윗모서리 e(이음 j) · 이음 오른쪽 열 = 빛 d · 왼쪽 열 = 그늘 b · 몸 c 에 윤기 사선 d ·
    13행 b · 14행 a · 15행 이음. 빛 금 = 가운데 r(밝은 점 s), 금 왼·위 = q, 금 아래 한 화소 = p(번짐)."""
    J = t['joint']
    rows = []
    for y in range(16):
        r = []
        for x in range(16):
            if y == 15 or x == J:
                ch = 'j'
            elif y == 0:
                ch = 'f' if x == (J + 1) % 16 else 'e'
            elif y == 14:
                ch = 'a'
            elif y == 13:
                ch = 'b'
            elif x == (J + 1) % 16:
                ch = 'e' if y < 4 else 'd'
            elif x == (J - 1) % 16:
                ch = 'b'
            elif (x - t['sheen']) % 16 == (y // 2) % 16 and y < 11:
                ch = 'd'
            elif y == 1:
                ch = 'd'
            else:
                ch = 'c'
            r.append(ch)
        rows.append(r)
    for i, (x, y) in enumerate(t['crack']):
        rows[y][x] = 's' if i == len(t['crack']) // 2 else 'r'
        if rows[y][x - 1] not in 'rsj':
            rows[y][x - 1] = 'q'
        if y + 1 < 13 and rows[y + 1][x] not in 'rsj':
            rows[y + 1][x] = 'p'
    if n == 2 and t['crack']:   # A2: 금 가운데 한 점을 더 밝게(불빛 심)
        x, y = t['crack'][len(t['crack']) // 2]
        rows[y][x] = 't'
    return [''.join(r) for r in rows]


def other_mid(n=1, cracked=False):
    """가운데 칸 16×48. 반복 칸(cracked=False)은 금 없는 흑요석 마름돌 — 금이 16px 마다 같은 자리에 서면 무늬로 읽힌다.
    금 칸(cracked=True)은 새김 가운데 칸으로만 쓴다(시공기가 벽 가운데 칸의 14% 를 바꾼다)."""
    rows = []
    for t in OF_TIERS:
        rows += other_tier(t if cracked else dict(t, crack=[]), n)
    return noise(rows, 'bcd', 13, 5)


def other_ends():
    """끝 기둥 줄: 왼끝 = 빛 받는 모서리(f·e), 오른끝 = 그늘(b·a). 단마다 0행·13~15행은 그 자리 단에 맞춘다."""
    el, er = [], []
    for y in range(48):
        k = y % 16
        if k == 15:
            el.append('jj'); er.append('jj')
        elif k == 0:
            el.append('fe'); er.append('dj')
        elif k >= 13:
            el.append('cb' if k == 13 else 'ba'); er.append('aj')
        else:
            el.append('fe' if k < 4 else 'ed'); er.append('bj')
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
    eye = mc.crop(0, 16, 16, 16)
    stamp(eye, EYE, lg, 0, 0)
    k.glyph3 = vcat(mc.crop(0, 0, 16, 16), eye, mc.crop(0, 32, 16, 16))
    slit = mc.crop(0, 0, 16, 16)
    stamp(slit, SLIT, lg, 0, 0)
    k.glyph2 = vcat(slit, mc.crop(0, 32, 16, 16))
    bot = cols3(mid[32:48], el[32:48], er[32:48])
    cells = [G(r, lg) for r in bot]
    for c in cells[1:2]:
        stamp(c, ROOTS, lg, 0, 0)
    k.base3 = hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, CRACK, lg, 0, 0)
    k.alt3 = alt
    k.lg = lg
    return k


# ================================================================================================ 마계 천장 테두리
# 몸통 = 별 없는 허공 어둠(void 0~2 손 무늬). 띠 8줄(바깥 → 안): 보라 빛 테 r/q(바닥에 닿는 끝, 마계 빛) → 밝은 턱 5 →
# 깨진 돌 윗면 4·3(결 점) → 그늘 2 → 안쪽 끝 1·0. 빛 테는 바깥 한 줄에만, 군데군데 끊긴다(줄 전체를 빛내면 네온 테두리로 읽힘).
LOR = L('0:void1 1:ostone0 2:ostone1 3:ostone3 4:ostone4 5:bone0 x:void0 y:void1 z:void2 p:arcane1 q:arcane2 r:arcane3')
LOR2 = L('0:void1 1:ostone0 2:ostone1 3:ostone3 4:ostone4 5:bone0 x:void0 y:void1 z:void2 p:red0 q:red1 r:red3')
OR_BODY = [
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
OR_N = [
    '5545q554555q5455',   # 0 바닥 쪽 끝: 끊긴 빛 테 + 밝은 턱 점
    '5545555455545554',
    '4434443444344434',
    '3443344343443344',
    '2332332332332233',
    '2122212222122122',
    '1011101110111011',
    '0x00x000x00x0000',
]
OR_W = [
    '55432210', '55433210', '45432110', 'q4432100',
    '55332210', '55432200', '45433210', '55432110',
    '55432210', '54433100', '55432210', 'q5332110',
    '45432210', '55433200', '54432210', '55432110',
]
OR_ON = [            # 바깥 모서리 NW
    'xx555545',
    'x5554545',
    '55544434',
    '55443434',
    '5543,333',
    'q4433222',
    '5433221.',
    '54432111',
]
OR_IN = [            # 안 모서리 NW — 위 띠 끝줄·왼 띠 끝칸과 같은 단으로 이어진다
    '55432210',
    '55432110',
    '44432100',
    '43332210',
    '32222211',
    '22211110',
    '11110100',
    '000000x0',
]


def _fix(rows, fill):
    return [r.replace(',', fill).replace('.', fill) for r in rows]


def rot_pieces(Nrows, Wrows, ONrows, INrows, lg):
    vflip = lambda rs: rs[::-1]  # noqa: E731
    hflip = lambda rs: [r[::-1] for r in rs]  # noqa: E731
    edge = {'N': G(Nrows, lg), 'S': G(vflip(Nrows), lg), 'W': G(Wrows, lg), 'E': G(hflip(Wrows), lg)}
    outer = {'NW': G(ONrows, lg), 'NE': G(hflip(ONrows), lg), 'SW': G(vflip(ONrows), lg), 'SE': G(vflip(hflip(ONrows)), lg)}
    inner = {'NW': G(INrows, lg), 'NE': G(hflip(INrows), lg), 'SW': G(vflip(INrows), lg), 'SE': G(vflip(hflip(INrows)), lg)}
    return edge, outer, inner


def other_rim(n=1):
    lg = LOR if n == 1 else LOR2
    edge, outer, inner = rot_pieces(OR_N, OR_W, _fix(OR_ON, '2'), OR_IN, lg)
    return dot.Autotile(G(OR_BODY, lg), edge, outer, inner)


# ================================================================================================ 마법탑 벽 앞면
# 글자: j 줄눈(iron0) · a iron1 · b iron2 · c iron3 · d iron4 · e iron5 · g gold1 · h gold3 · k gold4 · m gold5 · u ice1 · v ice2 · w ice3
LTF = L('j:iron0 a:iron1 b:iron2 c:iron3 d:iron4 e:iron5 g:gold0 h:gold1 k:gold2 m:gold3 u:ice0 v:ice1 w:ice3 n:arcane3')
# A2 = 따뜻한 회갈 마름돌(성 쪽 마법사 탑) — 띠돌 = 붉은 동
LTF2 = L('j:castle0 a:castle1 b:castle2 c:castle3 d:castle4 e:castle5 g:wood2 h:wood4 k:gold3 m:gold4 u:arcane1 v:arcane2 w:arcane4 n:arcane3')
# 가운데 칸 16×48: 켜 8줄(빛 d 한 줄 · 몸 c/b · 그늘 a · 줄눈 j). 이음 자리는 켜마다 엇갈린다(0·15열에 두지 않음 → 끝 기둥과 안 겹침).
# 셋째 켜(16~23)는 놋쇠 띠돌(돌림띠): 위 빛 m · 몸 k/h · 아래 그늘 g · 줄눈 j.
TF_MID = [
    'dddddddddddddddd',   # 0 윗단 — 천장 테두리 밑 첫 켜(밝은 끝선)
    'cccccjdcccccccdc',
    'cbccbjdccbcccccc',
    'cccccjdcccbccbcc',
    'ccbccjdcccccccbc',
    'bccccjdbccccbccc',
    'aaaaajaaaaaaaaaa',
    'jjjjjjjjjjjjjjjj',
    'dddjddddddddjddd',   # 8
    'cccjdccbccccjdcc',
    'cbcjdccccccbjdcb',
    'cccjdcbccccccjdc',
    'ccbjdccccbcccjdc',
    'bccjdcccccbccjdb',
    'aaajaaaaaaaaajaa',
    'jjjjjjjjjjjjjjjj',
    'mmmmmmmmmmmmmmmm',   # 16 가운데단 — 놋쇠 띠돌
    'kkhkkkkhkkkkkhkk',
    'khhhkhhhhhkhhhhk',
    'hhhhhhhhhhhhhhhh',
    'gggggggggggggggg',
    'dddddjddddddjddd',
    'cbccbjdccbccjdcc',
    'jjjjjjjjjjjjjjjj',
    'ddddddddjddddddd',   # 24
    'cccbcccjdccccbcc',
    'ccccccbjdccccccc',
    'cbccccajdcbccccb',
    'cccccccjdccccccc',
    'bcccbccjdccbcccc',
    'aaaaaaajaaaaaaaa',
    'jjjjjjjjjjjjjjjj',
    'dddjddddddddjddd',   # 32 아랫단
    'cccjdcccbcccjdcc',
    'ccbjdcccccccjdbc',
    'cccjdcbccccbjdcc',
    'bccjdcccccccjdcb',
    'aaajaaaaaaaaajaa',
    'jjjjjjjjjjjjjjjj',
    'dddddddjdddddddd',
    'ccbccccjdccbcccc',
    'cccccbcjdccccccb',
    'bcccccbjdcbccccc',
    'cbccccajdccccbcc',
    'bbbbbbbjbbbbbbbb',
    'aaaaaaajaaaaaaaa',   # 45 바닥에 닿는 그늘
    'jajajajjjajajaja',
    'jjjjjjjjjjjjjjjj',
]
TF_EL = (['ed'] + ['dc'] * 5 + ['ca', 'jj'] + ['ed'] + ['dc'] * 5 + ['ca', 'jj'] + ['mk', 'kh', 'kh', 'hh', 'hg', 'ed', 'dc', 'jj']
         + ['ed'] + ['dc'] * 5 + ['ca', 'jj'] + ['ed'] + ['dc'] * 4 + ['ca', 'jj'] + ['ed'] + ['dc'] * 4 + ['cb', 'ba', 'ja', 'jj'])
TF_ER = (['ca'] + ['ba'] * 5 + ['aj', 'jj'] + ['ca'] + ['ba'] * 5 + ['aj', 'jj'] + ['kg', 'hg', 'hg', 'gg', 'gj', 'ca', 'ba', 'jj']
         + ['ca'] + ['ba'] * 5 + ['aj', 'jj'] + ['ca'] + ['ba'] * 4 + ['aj', 'jj'] + ['ca'] + ['ba'] * 4 + ['aa', 'aj', 'jj', 'jj'])
assert len(TF_EL) == 48 and len(TF_ER) == 48, (len(TF_EL), len(TF_ER))

# 룬 판(새김 가운데 3단의 가운데 칸 16×16): 띠돌 위에 박은 청색 빛 룬 — 둥근 판 테(놋쇠) 안에 별 모양 룬(얼음빛).
RUNE = [
    'mmmmmkmmmmkmmmmm',
    'kkhkgggggggkkhkk',
    'khhgjuuuuujghhhk',
    'hhgjuvvwvvujghhh',
    'gggjuvwnwvujgggg',
    'dddjuvnwnvujdjdd',
    'cbcjuvwnwvujjdcc',
    'jjjjjuvvvujjjjjj',
    'ddddddjuujdddddd',
    'cccbcccjdccccbcc',
    'ccccccbjdccccccc',
    'cbccccajdcbccccb',
    'cccccccjdccccccc',
    'bcccbccjdccbcccc',
    'aaaaaaajaaaaaaaa',
    'jjjjjjjjjjjjjjjj',
]
# 2단 새김(윗단 칸): 아치 창 모양 룬 벽감(안쪽 어둠 j·a, 가운데 빛 점)
NICHE = [
    'dddddddddddddddd',
    'cccccjjjjjcccccc',
    'cbccjaaaaajccccc',
    'cccjaaauaaajcbcc',
    'ccbjaauvuaajccbc',
    'bccjaauwuaajcccc',
    'cccjaaauaaajcccc',
    'cccjdddddddjccbc',
    'jjjjjjjjjjjjjjjj',
    'dddjddddddddjddd',
    'cccjdccbccccjdcc',
    'cbcjdccccccbjdcb',
    'cccjdcbccccccjdc',
    'bccjdccccbcccjdb',
    'aaajaaaaaaaaajaa',
    'jjjjjjjjjjjjjjjj',
]
# 아랫단 변형: 굽도리(바닥 위 돌림띠) — 아랫단 칸의 아래 8줄을 밝은 턱 + 그늘 띠로
PLINTH = ['eeeeeeeeeeeeeeee', 'dddddddddddddddd', 'cccccccccccccccc', 'bbbbbbbbbbbbbbbb', 'aaaaaaaaaaaaaaaa',
          'jajajajajajajaja', 'jjjjjjjjjjjjjjjj', 'jjjjjjjjjjjjjjjj']
# 가운데단 변형: 띠돌 대신 화살 구멍(어두운 세로 틈 + 창턱 빛)
LOOP = [
    'mmmmmmmmmmmmmmmm',
    'kkhkkkjjjkkkkhkk',
    'khhhhjaaajhhhhhk',
    'hhhhhjauajhhhhhh',
    'gggggjauajgggggg',
    'dddddjauajjddddd',
    'cbccbjaaajdccbcc',
    'jjjjjjdddjjjjjjj',
]


def tower_kit(n=1):
    lg = LTF if n == 1 else LTF2
    mid = noise(TF_MID, 'bcd', 11, 3 + n)
    k = Kit()
    k.face3 = kit_of(cols3(mid, TF_EL, TF_ER), lg)
    k.face2 = kit_of(cols3([mid[i] for i in TWO], [TF_EL[i] for i in TWO], [TF_ER[i] for i in TWO]), lg)
    m = G(mid, lg)
    k.glyph3 = vcat(m.crop(0, 0, 16, 16), G(RUNE, lg), m.crop(0, 32, 16, 16))
    k.glyph2 = vcat(G(NICHE, lg), m.crop(0, 32, 16, 16))
    bot = [list(r) for r in cols3(mid[32:48], TF_EL[32:48], TF_ER[32:48])]
    cells = []
    for i, rows in enumerate(bot):
        rr = rows[:8] + [(p if i == 1 else (p[:2] + p[2:] if i == 0 else p)) for p in PLINTH]
        if i == 0:
            rr = rows[:8] + ['e' + p[1:] for p in PLINTH[:1]] + PLINTH[1:]
        if i == 2:
            rr = rows[:8] + [p[:15] + 'a' for p in PLINTH[:5]] + PLINTH[5:]
        cells.append(G(rr, lg))
    k.base3 = hcat(*cells)
    alt = m.crop(0, 16, 16, 16)
    stamp(alt, LOOP, lg, 0, 0)
    k.alt3 = alt
    k.lg = lg
    return k


# ================================================================================================ 마법탑 천장 테두리
# 띠 8줄(바깥 → 안): 밝은 턱 e → 갓돌 윗켜 d(이음 j 5·13열) → 줄눈 a → 아랫켜 c(이음 1·9열) → 그늘 b → 안쪽 끝 a·j.
LTR = L('j:void1 a:iron0 b:iron1 c:iron2 d:iron3 e:iron4 x:void0 y:void1 z:void2')
LTR2 = L('j:void1 a:castle0 b:castle1 c:castle2 d:castle3 e:castle4 x:void0 y:void1 z:void2')
TR_N = [
    'eeeeeeeeeeeeeeee',
    'ddddjdddddddjddd',
    'dcddjdddcdddjddc',
    'aaaaaaaaaaaaaaaa',
    'cjcccccccjcccccc',
    'bjccbcccbjcccbcc',
    'aaaaaaaaaaaaaaaa',
    'jjjjjjjjjjjjjjjj',
]
TR_W = [
    'edcaccaj', 'eddaccaj', 'eddabbaj', 'edcaccaj',
    'eaaaaaaj', 'edcaccaj', 'eddacbaj', 'edcaccaj',
    'eddaccaj', 'edcaccaj', 'eddabcaj', 'eaaaaaaj',
    'edcaccaj', 'eddaccaj', 'edcacbaj', 'eddaccaj',
]
TR_ON = [
    'eeeeeeee',
    'eddddjdd',
    'eddcdjdd',
    'edaaaaaa',
    'edacjccc',
    'edacjcbc',
    'edacjcaa',
    'edacjcaj',
]
TR_IN = [
    'edcaccaj',
    'eddaccaj',
    'eddaccaj',
    'aaaaccaj',
    'ccccccaj',
    'cccbcbaj',
    'aaaaaaaj',
    'jjjjjjjj',
]
TR_BODY = OR_BODY


def tower_rim(n=1):
    lg = LTR if n == 1 else LTR2
    edge, outer, inner = rot_pieces(TR_N, TR_W, TR_ON, TR_IN, lg)
    return dot.Autotile(G(TR_BODY, lg), edge, outer, inner)


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
    ('wall.tower_face', 'A1'): '청회색 다듬은 마름돌(8줄 켜 엇쌓기) + 가운데단 놋쇠 띠돌, 새김 = 띠돌 위 얼음빛 룬 판·아치 벽감, 아랫단 = 굽도리, 변형 = 화살 구멍',
    ('wall.tower_face', 'A2'): '회갈 마름돌 + 붉은 동 띠돌, 룬 = 보랏빛',
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

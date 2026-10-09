"""cave-r1 — 동굴 묶음 판. 항목 6(천장·앞면·흙바닥·돌바닥·잔돌·석순) × 줄 A·B·C × 후보 2 (A1 A2 B1 B2 C1 C2).

줄의 화풍 기준은 style-r1 의 그 글자 조각이다(색·결·윤곽). 모든 화소는 이 파일의 행 문자열·옆선 깊이 표에서 온다(손 도트).
  - 천장·바닥 오토타일은 32×32 **틀**(모서리·변) + 16×16 **안 모서리** + 16×16 **몸통**. 틀의 변은 「옆선 표」— 변을 따라 16칸마다
    (바닥이 파고드는 홈 깊이, 테두리 깊이) 두 수를 손으로 적은 것 — 로 적고, 모서리 8×8 은 손으로 찍는다. 기호 글자(B·H·S·R…)는
    손으로 적은 16×16 결 표에서 그 자리 글자를 가져온다. 사분면 경계(8·16·24 열/행)는 줄마다 정한 「표준 깊이」로 맞춰
    바꿔 끼워도 이어진다(check_frame 이 어긋남을 잡는다).
  - 같은 줄의 1·2 는 같은 램프·같은 표준 깊이·같은 바닥 바탕색이라 서로 바꿔 끼울 수 있다(천장 A1 + 바닥 A2 도 이어진다).
  - 넓게 깔리는 몸통(A1·C2 돌바닥, B1·B2 천장)은 본몸통 + 변형 셋(엔진 AutotileGroup.interiorVariants 한 단). 8방이 다 이어진 칸만
    엔진과 같은 cellHash 로 고른다(dot.Autotile.tile_at). 변형끼리 어떤 순서로 붙어도 이어지게 칸 둘레 한 줄을 같게 맞춘다 —
    판석·바윗덩이는 「공통 이음 자리」(ports: 변마다 한 곳)로만 칸을 건너고 안쪽 이음은 변형마다 다르다(net_body).
  - 천장 테두리의 바닥색 홈('f'·'g')은 그 줄 흙바닥의 바탕색 한 단이다 — 칸 격자가 아니라 바위 윤곽이 울퉁불퉁하게 보이게 한다.

글자 범례는 줄마다 따로 둔다. '.' = 투명(오토타일 조각에서는 몸통 유지), '~' = 바닥 그림자.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import style_r1 as SR  # noqa: E402  화풍 기준 판 — 조립 도구(autotile·a2_block·wrap_stamp·wrap2·face_block·cap_cols)를 그대로 쓴다
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'cave'
T = 16
autotile, a2_block, wrap_stamp, wrap2, face_block, cap_cols = (SR.autotile, SR.a2_block, SR.wrap_stamp, SR.wrap2,
                                                              SR.face_block, SR.cap_cols)


# ================================================================================================ 틀 조립 도구
def strips(prof, layer, notch):
    """옆선 표 → 바깥→안쪽 8글자 띠 16개. prof = [(홈 깊이, 테두리 깊이)] 16개. layer(k, m) = 테두리 k번째(바깥 0) 글자, m = 테두리 두께."""
    out = []
    for n, d in prof:
        s = ''
        for i in range(8):
            if i < n:
                s += notch
            elif i >= d:
                s += '.'
            else:
                s += layer(i - n, d - n)
        out.append(s)
    return out


def bands(first, mid, last):
    def f(k, m):
        return first if k == 0 else last if k == m - 1 else mid
    return f


def mirror_h(rows):
    return [r[::-1] for r in rows]


def mirror_v(rows):
    return rows[::-1]


def frame(nw, ne, sw, se, n, s, w, e):
    """모서리 8×8 넷 + 변 띠(strips 결과, 바깥→안쪽) 넷 → 32×32 기호 틀. 가운데 16×16 은 비움."""
    rows = []
    for y in range(8):
        rows.append(nw[y] + ''.join(c[y] for c in n) + ne[y])
    for y in range(16):
        rows.append(w[y] + '.' * 16 + e[y][::-1])
    for y in range(8):
        rows.append(sw[y] + ''.join(c[7 - y] for c in s) + se[y])
    return rows


def inner_of(nw, ne=None, sw=None, se=None):
    """안 모서리 16×16. 주지 않은 귀는 nw 를 뒤집어 쓴다."""
    ne = ne or mirror_h(nw)
    sw = sw or mirror_v(nw)
    se = se or mirror_v(mirror_h(nw))
    return [nw[y] + ne[y] for y in range(8)] + [sw[y] + se[y] for y in range(8)]


def check_frame(name, fr, inner, strict_inner=True):
    """사분면 경계 맞춤 검사(기호 단계). 어긋나면 AssertionError — 그리는 사람이 고친다."""
    bad = []
    for y in range(8):
        for a, b in ((7, 8), (15, 16), (23, 24), (7, 16), (15, 24)):
            if fr[y][a] != fr[y][b]:
                bad.append(f'북 {y}행 {a}|{b}')
            if fr[31 - y][a] != fr[31 - y][b]:
                bad.append(f'남 {31 - y}행 {a}|{b}')
    for x in range(8):
        for a, b in ((7, 8), (15, 16), (23, 24), (7, 16), (15, 24)):
            if fr[a][x] != fr[b][x]:
                bad.append(f'서 {x}열 {a}|{b}')
            if fr[a][31 - x] != fr[b][31 - x]:
                bad.append(f'동 {31 - x}열 {a}|{b}')
    if strict_inner:
        for y in range(8):
            if inner[y][0] != fr[y][23] or inner[y][15] != fr[y][8]:
                bad.append(f'안 모서리 북 {y}행')
            if inner[15 - y][0] != fr[31 - y][23] or inner[15 - y][15] != fr[31 - y][8]:
                bad.append(f'안 모서리 남 {15 - y}행')
        for x in range(8):
            if inner[0][x] != fr[23][x] or inner[15][x] != fr[8][x]:
                bad.append(f'안 모서리 서 {x}열')
            if inner[0][15 - x] != fr[23][31 - x] or inner[15][15 - x] != fr[8][31 - x]:
                bad.append(f'안 모서리 동 {15 - x}열')
    assert not bad, f'{name} 틀 경계 어긋남: {bad[:8]}'


def tex_fill(rows, tex):
    """기호 글자 → 결 표의 그 자리 글자. tex = {기호: 16×16 행 문자열}."""
    out = []
    for y, r in enumerate(rows):
        out.append(''.join(tex[c][y % len(tex[c])][x % len(tex[c][0])] if c in tex else c for x, c in enumerate(r)))
    return out


def tex_grid(rows, tex, leg, w, h):
    return grid(tex_fill(rows, tex), leg, w, h)


def on_base(base, frame_rows, inner_rows, leg, base_ch=','):
    """돌바닥처럼 가장자리에 **흙바닥 몸통**이 비쳐야 하는 오토타일. base_ch 자리는 그 칸 자리의 base 몸통 화소로 채운다
    (틀 조각이 칸 안 어디에 놓이는지에 맞춰 — 북변은 x-8, 동변은 x-16, y-8 …)."""
    def at(fx, fy):
        cx = 'W' if fx < 8 else 'E' if fx >= 24 else 'M'
        cy = 'N' if fy < 8 else 'S' if fy >= 24 else 'M'
        dx = {'W': 0, 'M': -8, 'E': -16}[cx]
        dy = {'N': 0, 'M': -8, 'S': -16}[cy]
        tx, ty = fx + dx, fy + dy
        return base.a[ty % 16, tx % 16]
    fr = grid([r.replace(base_ch, '.') for r in frame_rows], leg, 32, 32)
    for y, r in enumerate(frame_rows):
        for x, ch in enumerate(r):
            if ch == base_ch:
                fr.a[y, x] = at(x, y)
    inn = grid([r.replace(base_ch, '.') for r in inner_rows], leg, 16, 16)
    for y, r in enumerate(inner_rows):
        for x, ch in enumerate(r):
            if ch == base_ch:
                inn.a[y, x] = base.a[y, x]
    return fr, inn


def autotile_cv(body, fr, inn, variants=()):
    q = lambda c, qx, qy: c.crop(qx * 8, qy * 8, 8, 8)  # noqa: E731
    edge = {'N': fr.crop(8, 0, 16, 8), 'S': fr.crop(8, 24, 16, 8), 'W': fr.crop(0, 8, 8, 16), 'E': fr.crop(24, 8, 8, 16)}
    outer = {'NW': q(fr, 0, 0), 'NE': q(fr, 3, 0), 'SW': q(fr, 0, 3), 'SE': q(fr, 3, 3)}
    inner = {'NW': q(inn, 0, 0), 'NE': q(inn, 1, 0), 'SW': q(inn, 0, 1), 'SE': q(inn, 1, 1)}
    return dot.Autotile(body, edge, outer, inner, variants)


def carve(rows, pts, dark='p', shade='q', lit='s'):
    """손으로 적은 갈라진 금 화소 목록 pts 를 몸통 행에 판다(16 주기로 감김). 금의 왼쪽·위 = 그늘, 오른쪽·아래 = 빛 받는 턱."""
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    P = {(x % w, y % h) for x, y in pts}
    for x, y in P:
        g[y][x] = dark
    for x, y in P:
        for dx, dy, ch in ((-1, 0, shade), (0, -1, shade), (1, 0, lit), (0, 1, lit)):
            X, Y = (x + dx) % w, (y + dy) % h
            if (X, Y) not in P and g[Y][X] == rows[Y][X]:
                g[Y][X] = ch
    return [''.join(r) for r in g]


def poly(*pts):
    """손으로 고른 꼭짓점을 잇는 금(8방 이웃 선). 반환 화소 목록."""
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            out.append((x0 + round((x1 - x0) * i / n), y0 + round((y1 - y0) * i / n)))
    return out


def ports(xs, ys):
    """칸 경계를 건너는 이음 자리. 위·아래 변을 x 에서, 왼·오른 변을 y 에서 2px 씩 — 변형 모두 같은 자리라 아무 순서로 붙여도 이어진다."""
    out = []
    for x in xs:
        out += [(x, 0), (x, 1), (x, 14), (x, 15)]
    for y in ys:
        out += [(0, y), (1, y), (14, y), (15, y)]
    return out


def base_turn(base, k):
    """바탕 점 자리를 변형마다 돌려 쓴다(0 그대로 · 1 좌우 · 2 상하 · 3 대각 뒤집기). 바탕 둘레는 한 글자라 둘레는 그대로다."""
    rows = [r[::-1] for r in base] if k == 1 else base[::-1] if k == 2 else [''.join(c) for c in zip(*base)] if k == 3 else base
    ring = {r[0] for r in base} | {r[-1] for r in base} | set(base[0]) | set(base[-1])
    assert len(ring) == 1, '바탕 둘레가 한 글자가 아니면 변형끼리 어긋난다'
    return list(rows)


def net_body(base, port, paths, check=True, **kw):
    """몸통 = base 에 (공통 이음 자리 + 이 변형의 금) 을 판다. 안쪽 금은 둘레 2px 에 들어가지 않는다(check)."""
    pts = list(port)
    for path in paths:
        for x, y in poly(*path):
            if check and not (2 <= x <= 13 and 2 <= y <= 13):
                raise AssertionError(f'금 ({x},{y}) 이 둘레 2px 에 들어갔다 — 변형끼리 어긋난다')
            pts.append((x, y))
    return carve(base, pts, **kw)


def a2_plus(at):
    """후보 원본: A2 모양 32×48 + 오른쪽에 몸통 변형(16×16 세로로)."""
    vs = at.bodies[1:]
    if not vs:
        return a2_block(at)
    cv = Cv(32 + 16 * ((len(vs) + 2) // 3), 48)
    cv.paste(a2_block(at), 0, 0)
    for i, b in enumerate(vs):
        cv.paste(b, 32 + 16 * (i // 3), 16 * (i % 3))
    return cv


def floor_frame(nprof, wprof, dark, mid):
    """흙바닥 틀: 북쪽(앞면 밑) 그늘 깊이 nprof[x](0~31열), 서쪽 그늘 wprof[y](0~31행). 첫 줄/열은 dark, 나머지 mid.
    동·남 가장자리는 몸통 그대로(빛이 왼쪽 위)."""
    rows = [['.'] * 32 for _ in range(32)]
    for x in range(32):
        for y in range(min(nprof[x], 8)):
            rows[y][x] = dark if y == 0 else mid
    for y in range(32):
        if 8 <= y < 24 or y < 8 or y >= 24:
            for x in range(min(wprof[y], 8)):
                if rows[y][x] == '.':
                    rows[y][x] = dark if x == 0 else mid
    return [''.join(r) for r in rows]


def shift(cv, dx, dy):
    """16 주기 몸통을 (dx, dy) 만큼 감아 민다 — 판석 이음이 칸 경계에 겹치면 칸 격자가 그대로 드러나서 이음을 칸 안쪽으로 옮긴다."""
    import numpy as np
    out = Cv(cv.w, cv.h)
    out.a = np.roll(np.roll(cv.a, dy, axis=0), dx, axis=1)
    return out


def hcat(*cvs):
    w = sum(c.w for c in cvs)
    h = max(c.h for c in cvs)
    out = Cv(w, h)
    x = 0
    for c in cvs:
        out.paste(c, x, 0)
        x += c.w
    return out


def variants_sheet(at, per_row=8):
    vs = at.variants()
    keys = sorted(vs)
    rows = (len(keys) + per_row - 1) // per_row
    out = Cv(per_row * 17 - 1, rows * 17 - 1)
    for i, k in enumerate(keys):
        out.paste(vs[k], (i % per_row) * 17, (i // per_row) * 17)
    return out


def face_run(face, n=6):
    cv = Cv(n * 16, 32)
    for i in range(n):
        cv.a[:16, i * 16:(i + 1) * 16] = face.tile(0, i == 0, i == n - 1).a
        cv.a[16:, i * 16:(i + 1) * 16] = face.tile(1, i == 0, i == n - 1).a
    return cv


# ================================================================================================ 줄 A — 해안 흙굴
# style-r1 A: 어둠 + 갈색 윗면 띠(rim b c d a) + 밝은 끝선 l, 녹회색 돌 앞면(crock), 갈색 반점 흙(cfloor, 바탕 2).
LA = legend(v=('void', 0), u=('void', 1), t=('void', 2),
            e=('rim', 0), d=('rim', 1), c=('rim', 2), b=('rim', 3), a=('rim', 4), k=('rim', 5), l=('rim', 6),
            f=('cfloor', 2), x=('crock', 5), y=('crock', 4), z=('crock', 2))
LA_FACE = legend(q=('moss', 2), r=('moss', 4), s=('moss', 5), **{str(i): ('crock', i) for i in range(7)})
LA_FLOOR = legend(x=('crock', 5), y=('crock', 3), z=('crock', 1), **{str(i): ('cfloor', i) for i in range(8)})

TEX_A1 = {'B': [   # 띠 결: 갈색 b·c 교대, d 어두운 점, a 밝은 점
    'bcbcbdbcbbcbacbc', 'cbdbcbbcbdbcbbcb', 'bcbbcacbcbbcbdbc', 'cbcbdbcbbcbcbcbb',
    'bdbcbbcbcbdbcbab', 'cbcabcbdbcbcbbcb', 'bcbcbcbbcabcbdbc', 'cbdbcbcbbcbcbcbb',
    'bcbbcbdbcbbcacbc', 'cbcbacbcbdbcbbcb', 'bcbdbcbbcbcbcbdb', 'cbcbbcbcabcbdbcb',
    'bdbcbcbdbcbbcbcb', 'cbcbbcbcbcbdbcab', 'bcacbdbcbcbcbbcb', 'cbcbcbbcbdbcbcbc']}

# A1 — 표준 깊이 6(끝선 l · 띠 4 · 안선 e). 북·서·동 변은 바닥(f)이 1~2px 파고들어 윤곽이 울퉁불퉁, 남변(벽 윗면)은 곧은 끝선.
A1_NW = ['ffflllll', 'fflBBBBB', 'flBBBBBB', 'lBBBBBBB', 'lBBBBBBB', 'lBBBBBee', 'lBBBBe..', 'lBBBBe..']
A1_IN = ['lBBBBe..', 'BBBBBe..', 'BBBBe...', 'BBBe....', 'BBe.....', 'ee......', '........', '........']
_A1 = bands('l', 'B', 'e')
A1_N = strips([(0, 6), (0, 6), (1, 7), (2, 7), (1, 6), (0, 5), (0, 5), (0, 6),
               (0, 6), (0, 7), (0, 7), (1, 6), (1, 6), (0, 5), (0, 6), (0, 6)], _A1, 'f')
A1_S = strips([(0, 6), (0, 6), (0, 7), (0, 7), (0, 6), (0, 5), (0, 5), (0, 6),
               (0, 6), (0, 5), (0, 5), (0, 6), (0, 7), (0, 7), (0, 6), (0, 6)], _A1, 'f')
A1_W = strips([(0, 6), (0, 6), (1, 7), (2, 7), (1, 7), (0, 6), (0, 5), (0, 6),
               (0, 6), (0, 6), (0, 7), (1, 6), (1, 6), (0, 5), (0, 5), (0, 6)], _A1, 'f')
A1_E = strips([(0, 6), (0, 7), (0, 7), (0, 6), (1, 6), (2, 7), (1, 6), (0, 6),
               (0, 6), (0, 5), (0, 5), (0, 6), (1, 7), (1, 7), (0, 6), (0, 6)], _A1, 'f')
A1_FRAME = frame(A1_NW, mirror_h(A1_NW), mirror_v(A1_NW), mirror_v(mirror_h(A1_NW)), A1_N, A1_S, A1_W, A1_E)
A1_INNER = inner_of(A1_IN)
A1_BODY = ['v' * 16] * 16

# A2 — 흙 띠 대신 **굵은 바위 혹** 테두리: 둥근 사암 덩이(rim, 위·왼 빛 k a, 아래·오른 그늘 c d, 윤곽 e)가 한 칸에 둘씩
# 늘어서고, 덩이 사이로 바닥(f)이 파고든다. 남변(벽 윗면)은 덩이 앞턱이 앞면 위로 둥글게 나온다. 어둠 몸통에 아주 옅은 결(u·t).
A2_N1 = ['feeeeeef', 'eakkkabe', 'dakaabcd', 'dabbbccd', 'ecbccdde', '.edddde.', '..eeee..', '........']
A2_N2 = ['feeeeeef', 'ekkaaabe', 'dkaabbcd', 'dbbbccdd', 'eccccdde', '.eeeeee.', '........', '........']
A2_S1 = ['........', '..eeee..', '.eakkae.', 'eakkaabe', 'dkaabbcd', 'dabbbccd', 'dbccccdd', 'edddddde']
A2_S2 = ['........', '........', '.eeeeee.', 'eakkaabe', 'dabbbbcd', 'dbbbcccd', 'dccccddd', 'edddddde']
A2_NW = ['ffffeeef', 'ffeeakbe', 'feakkbcd', 'eakabbcd', 'ekabbcde', 'eabbcde.', 'dbccde..', 'fedde...']
A2_SW = ['fedde...', 'eakde...', 'eakbbe..', 'eakabbee', 'ekabbccd', 'eabbcccd', 'edccdddd', 'feeeeeee']
A2_IN_NW = ['fedde...', 'eade....', 'dde.....', 'de......', 'e.......', '........', '........', '........']
A2_IN_SW = ['........', '........', '........', 'e.......', 'de......', 'dde.....', 'ddde....', 'fedde...']


def _tr(rows):
    return [''.join(c) for c in zip(*rows)]


def _lump_frame():
    w1, w2 = _tr(A2_N1), _tr(A2_N2)
    e1, e2 = mirror_h(w2), mirror_h(w1)
    ne, se = mirror_h(A2_NW), mirror_h(A2_SW)
    rows = [A2_NW[y] + A2_N1[y] + A2_N2[y] + ne[y] for y in range(8)]
    rows += [w1[y] + '.' * 16 + e1[y] for y in range(8)] + [w2[y] + '.' * 16 + e2[y] for y in range(8)]
    rows += [A2_SW[y] + A2_S2[y] + A2_S1[y] + se[y] for y in range(8)]
    return rows


A2_FRAME = _lump_frame()
A2_INNER = inner_of(A2_IN_NW, sw=A2_IN_SW, se=mirror_h(A2_IN_SW))
TEX_A2 = {}
A2_BODY = [
    'vvvvvvvvvvvvvvvv', 'vvvvuvvvvvvvvvvv', 'vvvvvuvvvvvvvvvv', 'vvvvvvuuvvvvvtvv',
    'vvvvvvvvuvvvvvvv', 'vvtvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvuvvvv',
    'vvvvvvvvvvvvuvvv', 'vvvvvvvvvvvvvuuv', 'vuvvvvvvvvvvvvvv', 'vvuvvvvtvvvvvvvv',
    'vvvuvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvu', 'vvvvvvvvtvvvvvvv']

check_frame('A1 천장', A1_FRAME, A1_INNER)
check_frame('A2 천장', A2_FRAME, A2_INNER, strict_inner=False)


def ceil_a(n):
    fr, inn, body, tex = {1: (A1_FRAME, A1_INNER, A1_BODY, TEX_A1), 2: (A2_FRAME, A2_INNER, A2_BODY, TEX_A2)}[n]
    return autotile_cv(grid(body, LA), tex_grid(fr, tex, LA, 32, 32), tex_grid(inn, tex, LA, 16, 16))


# 앞면 A1 — style-r1 A 의 돌 셋(손 도트)을 새 자리에 감아 찍고, 끝 마구리는 둥글게(바깥 0 · 안 1 · 위아래 귀를 0 으로 깎음).
A1_STONES = ((SR.A_STONE_MED, 0, 2), (SR.A_STONE_BIG, 6, 1), (SR.A_STONE_SML, 13, 3), (SR.A_STONE_SML, 3, 8),
             (SR.A_STONE_BIG, 9, 8), (SR.A_STONE_MED, 1, 13), (SR.A_STONE_SML, 7, 15), (SR.A_STONE_BIG, 12, 16),
             (SR.A_STONE_MED, 4, 19), (SR.A_STONE_BIG, 0, 23), (SR.A_STONE_SML, 9, 22), (SR.A_STONE_MED, 11, 25))
A_CAP_L = cap_cols(['0' * 32, '00' + '1' * 28 + '00', '0' + '.' * 30 + '0'])
A_CAP_R = cap_cols(['0' * 32, '0' + '1' * 29 + '00', '.' * 31 + '0'])


def face_a1():
    cv = grid(['0000000000000000', '1111111111111111']
              + [('1121111111112111' if y % 3 == 0 else '1111112111111111' if y % 3 == 1 else '2111111111211112')
                 for y in range(2, 30)] + ['1111111111111111', '0000000000000000'], LA_FACE)
    for rows, x, y in A1_STONES:
        wrap_stamp(cv, rows, LA_FACE, x, y)
    return face_block(cv, LA_FACE, A_CAP_L, A_CAP_R)


# 앞면 A2 — 갈라진 벼랑: 녹회색 바위 면(4) 에 가로 턱 둘·세로 금(1, 위·왼쪽 그늘 2, 아래·오른쪽 빛 5), 위 끝과 턱 위에 이끼(q r s).
def face_a2():
    base = (['0000000000000000', 'rsrrsrrrrsrrsrrr']
            + [('4434444443444434' if y % 5 == 0 else '4444434444444444' if y % 5 == 2 else '4444444444434444' if y % 5 == 3
                else '4' * 16) for y in range(2, 30)] + ['1111111111111111', '0000000000000000'])
    rows = carve(base, [
        (0, 9), (1, 9), (2, 10), (3, 10), (4, 10), (5, 9), (6, 9), (7, 8), (8, 8), (9, 9), (10, 9), (11, 10), (12, 10),
        (13, 10), (14, 9), (15, 9),
        (0, 20), (1, 21), (2, 21), (3, 21), (4, 20), (5, 20), (6, 20), (7, 21), (8, 21), (9, 21), (10, 20), (11, 19),
        (12, 19), (13, 20), (14, 20), (15, 20),
        (4, 3), (5, 4), (5, 5), (4, 6), (4, 7), (5, 8), (12, 11), (12, 12), (11, 13), (11, 14), (12, 15), (12, 16),
        (11, 17), (11, 18), (6, 22), (6, 23), (7, 24), (7, 25), (6, 26), (6, 27), (14, 3), (14, 4), (13, 5), (13, 6),
        (2, 24), (1, 25), (1, 26)], dark='1', shade='2', lit='5')
    rows = base[:2] + rows[2:30] + base[30:]
    cv = grid(rows, LA_FACE)
    for moss, x, y in ((['qrq', '.q.'], 1, 2), (['q', 'q', 'r'], 9, 2), (['rq', 'q.'], 13, 2), (['srr', 'rq.'], 1, 8),
                       (['rs', 'q.'], 9, 7), (['rsr'], 12, 18), (['qr'], 3, 19)):
        stamp(cv, moss, LA_FACE, x, y)
    return face_block(cv, LA_FACE, A_CAP_L, A_CAP_R)


# 흙바닥 A — 바탕 2. 북쪽 앞면 밑 그늘(첫 줄 0 · 나머지 1) 깊이 3, 서쪽 그늘 2. 동·남은 몸통.
A_FLOOR_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3]
A_FLOOR_W = [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2]
A_FLOOR_FRAME = floor_frame(A_FLOOR_N, A_FLOOR_W, '0', '1')
A_FLOOR_INNER = (['01......' + '....1000', '11......' + '......11', '1.......' + '.......1']
                 + ['.' * 16] * 10 + ['........' + '.' * 8, '0.......' + '.' * 8, '01......' + '.' * 8])
A1_FLOOR = [
    '2221122225522272', '2211112225552222', '2221112222522202', '2722222212222222',
    '2222052211122222', '2220222111112252', '2222222211122555', '1122222222222252',
    '1112272222222222', '2112222220222122', '2222225222221112', '2222255522221112',
    '2022225222222122', '2222222222722222', '2552221122222202', '2222211122222222']
A2_FLOOR = [   # 같은 바탕에 녹회색 자갈(x y z)과 젖은 얼룩(1)
    '2222223222211122', '22xy222221111112', '22zy222222111122', '2222222232222222',
    '2322211222222xy2', '2222111122222yz2', '2222211222222222', '2222222223222222',
    '2x22222222222232', '2z22322222111222', '2222222221111122', '2222xy2222111222',
    '1222yz2222222222', '1122222223222221', '1112222222222111', '2122223222222212']


def floor_a(n):
    body = grid(A1_FLOOR if n == 1 else A2_FLOOR, LA_FLOOR)
    return autotile_cv(body, grid(A_FLOOR_FRAME, LA_FLOOR, 32, 32), grid(A_FLOOR_INNER, LA_FLOOR, 16, 16))


# 돌바닥 A1 — 녹회색 판석(윗변·왼변 O 빛, 아랫변·오른변 K 그늘, 이음 J). 흙과 만나는 가장자리는 흙(,)이 파고들고 판석 끝 J.
LA_STONE = legend(J=('crock', 1), K=('crock', 2), M=('crock', 3), N=('crock', 4), O=('crock', 5),
                  **{str(i): ('cfloor', i) for i in range(8)})
# 판석은 「공통 이음 자리」(위·아래 변 x=4·11, 왼·오른 변 y=5·12 에서만 칸 경계를 건넌다) + 변형마다 다른 안쪽 이음.
# 본몸통 + 변형 셋이 아무 순서로 붙어도 이어지고, 판석 크기·배치는 칸마다 달라 넓게 깔아도 같은 줄이 안 생긴다.
A1_STONE_BASE = ['NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNMNNNNNN', 'NNNNNNNNNNNNNNNN',
                 'NNNMNNNNNNNNNNNN', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNMNNNN', 'NNNNNNNNNNNNNNNN',
                 'NNNNNMNNNNNNNNNN', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNNMNNN', 'NNNNNNNNNNNNNNNN',
                 'NNNNNNNNNNNNNNNN', 'NNNNNNNNMNNNNNNN', 'NNNNNNNNNNNNNNNN', 'NNNNNNNNNNNNNNNN']
A1_STONE_PORT = ports((5,), (9,))
A1_STONE_NETS = [
    [[(5, 2), (6, 5), (9, 7), (13, 9)], [(2, 9), (4, 10), (5, 13)], [(9, 7), (10, 11), (8, 13)], [(6, 5), (3, 6)]],
    [[(5, 2), (4, 5), (2, 9)], [(13, 9), (10, 8), (9, 12), (5, 13)], [(10, 8), (11, 4), (9, 3)]],
    [[(5, 2), (5, 6), (7, 9), (5, 13)], [(2, 9), (4, 8), (7, 9)], [(13, 9), (11, 10), (7, 9)], [(10, 3), (12, 5)]],
    [[(5, 2), (7, 4), (12, 6), (13, 9)], [(2, 9), (3, 8), (6, 11), (5, 13)], [(7, 4), (4, 6), (3, 8)]],
]


def a1_stone_bodies():
    return [grid(net_body(base_turn(A1_STONE_BASE, i), A1_STONE_PORT, n, dark='J', shade='K', lit='O'), LA_STONE)
            for i, n in enumerate(A1_STONE_NETS)]


_SJ = bands('J', 'J', 'J')
A1_STONE_NW = [',,,,,,,,', ',,,,,,,,', ',,,,JJJJ', ',,,J....', ',,J.....', ',,J.....', ',,J.....', ',,J.....']
A1_STONE_IN = [',,J.....', ',J......', 'J.......', '........', '........', '........', '........', '........']
A1_STONE_FRAME = frame(A1_STONE_NW, mirror_h(A1_STONE_NW), mirror_v(A1_STONE_NW), mirror_v(mirror_h(A1_STONE_NW)),
                       strips([(2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3),
                               (2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3)], _SJ, ','),
                       strips([(2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3),
                               (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3), (2, 3)], _SJ, ','),
                       strips([(2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (1, 2), (2, 3),
                               (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3)], _SJ, ','),
                       strips([(2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3),
                               (2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3)], _SJ, ','))
A1_STONE_INNER = inner_of(A1_STONE_IN)
check_frame('A1 돌바닥', A1_STONE_FRAME, A1_STONE_INNER)

# 돌바닥 A2 — 흙에 박힌 둥근 사암 자갈(rim k a b c d). 가장자리는 흙이 자갈 사이로 파고든다(어두운 흙 1 한 줄).
LA_COB = legend(k=('rim', 5), a=('rim', 4), b=('rim', 3), c=('rim', 2), d=('rim', 1), e=('rim', 0),
                **{str(i): ('cfloor', i) for i in range(8)})
COB6 = ['.kkaa.', 'kaaabc', 'aabbcd', 'abbccd', '.ccdd.']
COB5 = ['.kaa.', 'kaabc', 'abbcd', '.ccd.']
COB4 = ['.ka.', 'kabc', 'bccd', '.dd.']


def a2_stone_body():
    cv = grid(['1111211111112111', '1211111121111111', '1111111111111121', '1111211111211111',
               '2111111111111111', '1111112111111211', '1121111111111111', '1111111211112111',
               '1111111111111111', '1211121111111111', '1111111111121111', '1111111111111112',
               '1112111111111111', '1111111121111111', '1111111111111111', '2111121111111211'], LA_COB)
    for rows, x, y in ((COB6, 0, 0), (COB5, 7, 0), (COB4, 12, 1), (COB5, 2, 6), (COB6, 8, 5), (COB4, 14, 7),
                       (COB6, 4, 11), (COB5, 11, 11), (COB4, 0, 12)):
        wrap2(cv, rows, LA_COB, x, y)
    return cv


_SD = bands('1', '1', '1')
A2_STONE_NW = [',,,,,,,,', ',,,,,,,,', ',,,,,111', ',,,11...', ',,1.....', ',,1.....', ',,1.....', ',,1.....']
A2_STONE_IN = [',,1.....', ',1......', '1.......', '........', '........', '........', '........', '........']
A2_STONE_FRAME = frame(A2_STONE_NW, mirror_h(A2_STONE_NW), mirror_v(A2_STONE_NW), mirror_v(mirror_h(A2_STONE_NW)),
                       strips([(2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (3, 4), (2, 3),
                               (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3)], _SD, ','),
                       strips([(2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3),
                               (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3)], _SD, ','),
                       strips([(2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3),
                               (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3), (2, 3)], _SD, ','),
                       strips([(2, 3), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3),
                               (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3)], _SD, ','))
A2_STONE_INNER = inner_of(A2_STONE_IN)
check_frame('A2 돌바닥', A2_STONE_FRAME, A2_STONE_INNER)


def stone_a(n):
    dirt = grid(A1_FLOOR if n == 1 else A2_FLOOR, LA_FLOOR)
    if n == 1:
        bodies, fr, inn, leg = a1_stone_bodies(), A1_STONE_FRAME, A1_STONE_INNER, LA_STONE
    else:
        bodies, fr, inn, leg = [shift(a2_stone_body(), 6, 6)], A2_STONE_FRAME, A2_STONE_INNER, LA_COB
    f, i = on_base(dirt, fr, inn, leg)
    return autotile_cv(bodies[0], f, i, bodies[1:])


# 잔돌 A1 — 녹회색 돌(crock 0 윤곽 · 6 5 윗면 빛 · 4 3 2 앞면). 1×1 은 걸을 수 있는 작은 돌 둘, 2×1 은 쌓인 덩이.
A1_RUB_S = [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '....0000........', '...066550.......', '...055440.00....', '...0333200560...',
    '....0000~0330...', '.....~~~~~.00~~.', '..........~~~...', '................']
A1_BIG = ['..00000..', '.0665550.', '066555540', '065554440', '055444430', '033333320', '032332220', '.0222220.', '..00000..']
A1_MED = ['..0000..', '.066550.', '06555440', '05544430', '03333320', '.022220.', '..0000..']
A1_SML = ['.000.', '06550', '03320', '.000.']
A1_PEB = ['.00.', '0540', '.00.']


def pile(w, h, parts, shadows, leg):
    """뒤→앞 순서로 손 도트 덩이를 얹고(겹치면 앞이 덮음), 손으로 적은 그림자 줄을 투명한 곳에만 깐다."""
    cv = Cv(w, h)
    for rows, x, y in parts:
        stamp(cv, rows, leg, x, y)
    for x, y, n in shadows:
        for i in range(n):
            cv.shadow(x + i, y)
    return cv


def rubble_a1():
    small = grid(A1_RUB_S, LA_FACE)
    big = pile(32, 16, [(A1_MED, 11, 1), (A1_BIG, 3, 4), (A1_BIG, 17, 3), (A1_SML, 10, 10), (A1_PEB, 26, 11),
                        (A1_SML, 23, 9)],
               [(5, 13, 8), (13, 14, 5), (19, 12, 9), (24, 13, 5), (27, 14, 3)], LA_FACE)
    return small, big


# 잔돌 A2 — 무너진 흙 띠 조각(rim 사암): 납작한 판 조각이 겹쳐 쌓였다. 윤곽 e, 윗면 k a, 앞면 c d.
A2_SLAB = ['.eeeeeeee.', 'ekkaaaaabe', 'eaaabbbbce', 'eccccccdde', 'eddddddde.', '.eeeeeee..']
A2_SLAB_S = ['.eeeee.', 'ekaaabe', 'eaabbce', 'ecccdde', '.eeeee.']
A2_CHIP = ['.ee.', 'ekae', 'ecde', '.ee.']
A2_RUB_S = [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................', '.....eeeee......', '....ekaaabe.....', '....eaabbce.ee..',
    '....ecccdde~ekae', '.....eeeee~~ecde', '......~~~~~~~ee~', '................']


def rubble_a2():
    small = grid(A2_RUB_S, LA_COB)
    big = pile(32, 16, [(A2_SLAB, 12, 2), (A2_SLAB, 2, 5), (A2_SLAB_S, 21, 4), (A2_SLAB_S, 9, 8), (A2_CHIP, 19, 10),
                        (A2_SLAB_S, 23, 9), (A2_CHIP, 4, 11)],
               [(3, 11, 2), (6, 14, 4), (10, 13, 7), (21, 14, 3), (24, 14, 7)], LA_COB)
    return small, big


# 석순·바위 기둥 A1 — 띠와 같은 갈색 돌(rim). 원뿔은 왼쪽이 빛(k a), 오른쪽 그늘(c d), 윤곽 e, 4줄마다 고리 결.
# 기둥은 모래시계꼴(밑동·머리가 퍼짐), 머리 쪽으로 어두워져(d e) 천장 어둠에 묻힌다.
A1_STALAG = [
    '................', '................', '................', '................',
    '................', '................', '.......ee.......', '......ekde......',
    '......ekce......', '.....ekbcde.....', '.....ekabde.....', '.....eaabce.....',
    '....ekaabcde....', '....ekabbcde....', '....ecbcccde....', '....ekabbcde....',
    '...ekaabbccde...', '...ekabbbccde...', '...ecbbcccdde...', '...ekabbbccde...',
    '...eaabbbccde...', '..ekaabbbcccde..', '..eaabbbbcccde..', '..ecbbbbcccdde..',
    '..eaabbbbcccde..', '..ecbbbbcccdde..', '...eccccddde~~..', '....eeeeeeee~~..',
    '.....~~~~~~~~~..', '................', '................', '................']
A1_PILLAR = [
    '..eeeeeeeeeee...', '..eddddddddde...', '..edcddcdccde...', '...edccbcccde...',
    '...ekcbbbccde...', '...ekabbbccde...', '...ekabbccde....', '...eaabbccde....',
    '...ekabbccde....', '....ekabbcde....', '....eaabbcde....', '....ekabccde....',
    '....ecbcccde....', '....ekabbcde....', '....eaabbcde....', '....ekabbcde....',
    '....ekabccde....', '....ecbcccde....', '....eaabbcde....', '....ekabbcde....',
    '...ekaabbccde...', '...eaabbbccde...', '...ekabbbccde...', '..ekaabbbcccde..',
    '..eaabbbbcccde..', '..ecbbbbcccdde..', '.ekaabbbbcccdde.', '.ecbbbbbccccdde.',
    '..eeeeeeeeeeee~.', '...~~~~~~~~~~~..', '................', '................']


def stalag_a1():
    return grid(A1_STALAG, LA), grid(A1_PILLAR, LA)


# 석순 A2 — 녹회색 돌(crock)에 이끼(q r s)가 덮인 쌍둥이 석순(큰 것 + 작은 것), 기둥은 이끼 띠가 감긴 녹회색 기둥.
A2_STALAG = [
    '................', '................', '................', '................',
    '................', '..........00....', '.........0650...', '.........0640...',
    '........05430...', '........0r430...', '.......0r5s420..', '.......0rr4420..',
    '.......0544320..', '...00..0544320..', '..0650.05443320.', '..0640.05443320.',
    '.0r5420054433220', '.0rr442054433220', '.05443205rq43320', '.05443320544s320',
    '0r54433205443320', '0rr4433205443320', '0544332205433220', '0544332205443220',
    '0344332203433220', '.033322220333220', '..00000000000~~.', '...~~~~~~~~~~~..',
    '................', '................', '................', '................']
A2_PILLAR = [
    '..00000000000...', '..01111111110...', '..01121211210...', '...0221212210...',
    '...0r53344320...', '...0rr4444320...', '...0544443320...', '...0s54444320...',
    '...0544443320...', '...0544433320...', '...0544443320...', '...0rr5444320...',
    '...0rsrrqrq20...', '...0qrqqqrq20...', '...0544443320...', '...0544433320...',
    '...0544443320...', '...0544443320...', '...0544433320...', '...0r54444320...',
    '...0rr4443320...', '...0544443320...', '..055444433220..', '..054444433220..',
    '.0r544444333220.', '.0rr54444333220.', '.05544444333220.', '..0333333332220.',
    '...000000000000~', '....~~~~~~~~~~~.', '................', '................']


def stalag_a2():
    return grid(A2_STALAG, LA_FACE), grid(A2_PILLAR, LA_FACE)



# ================================================================================================ 줄 B — 산속 바위굴
# style-r1 B: 천장 대신 갈라진 회색 바위 윗면(stone 한 단 내려 찍음), 바닥과 만나는 가장자리는 어두운 윤곽 o,
# 앞면 위 남쪽 가장자리는 빛 받는 턱(h s r), 큰 바윗덩이 앞면(crock), 어두운 흙(cfloor 바탕 1)과 자갈.
LB = legend(o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), h=('stone', 5),
            f=('cfloor', 1), **{str(i): ('cfloor', i) for i in range(8)})
LB_TOP = SR.LB_TOP   # 윗면 몸통: r→stone2 · q→stone1 · p,o→stone0 · s→stone3
LB_FACE = legend(**{str(i): ('crock', i) for i in range(7)})


# 바위 윗면 — 본몸통 + 변형 셋(엔진 interiorVariants). B1: 금은 칸 둘레 2px 안쪽에만 있어 둘레가 모두 같다(아무 순서로 붙어도 이어짐).
# B2: 바윗덩이 사이 틈은 공통 이음 자리(위·아래 x=3·10, 왼·오른 y=4·11)로만 칸을 건너고, 덩이 모양은 변형마다 다르다.
B_TOP_BASE = ['rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrsrrrrrrrrrrrrr', 'rrrrrrrrrrrsrrrr',
              'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrqrrrrrrrrr', 'rrrrrrrrrrrrrrrr',
              'rrrrrrrrrrrrrsrr', 'rrrrsrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrqrrrrrr',
              'rrrrrrrrrrrrrrrr', 'rrsrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr']
B1_TOP_NETS = [   # 금의 양을 칸마다 달리(긴 금 · 없음 · 없음 · 갈래 진 금) — 넓게 깔면 금이 몰린 곳과 빈 곳이 생긴다
    [[(3, 3), (6, 5), (9, 8), (10, 12)], [(6, 5), (10, 4)]],
    [],
    [],
    [[(12, 3), (9, 6), (5, 7), (3, 10)], [(9, 6), (10, 9)]],
]
B2_TOP_PORT = ports((9,), (6,))
B2_TOP_NETS = [
    [[(9, 2), (8, 4), (5, 5), (2, 6)], [(13, 6), (11, 9), (9, 13)], [(8, 4), (10, 7), (11, 9)]],
    [[(9, 2), (10, 5), (13, 6)], [(2, 6), (4, 8), (6, 11), (9, 13)], [(10, 5), (7, 8), (4, 8)]],
    [[(9, 2), (8, 6), (10, 10), (9, 13)], [(2, 6), (5, 7), (8, 6)], [(13, 6), (12, 9), (10, 10)]],
    [[(2, 6), (4, 5), (7, 3), (9, 2)], [(13, 6), (11, 8), (8, 11), (9, 13)], [(4, 5), (5, 9), (8, 11)]],
]


def b_top_bodies(n):
    if n == 1:
        return [grid(net_body(base_turn(B_TOP_BASE, i), [], k, dark='q', shade='q'), LB_TOP) for i, k in enumerate(B1_TOP_NETS)]
    return [grid(net_body(base_turn(B_TOP_BASE, i), B2_TOP_PORT, k), LB_TOP) for i, k in enumerate(B2_TOP_NETS)]


TEX_B1 = {'H': ['hhshhhshhshhhshh', 'hshhhshhhhshhshh'] * 8, 'S': ['srsrssrsrsrrsrss', 'rssrsrssrsrsrsrs'] * 8,
          'R': ['r.r.rr.r.r.rr.r.', '.r.rr.r..r.r.rr.'] * 8}
TEX_B2 = {'H': ['hhhshhhhhshhhhsh', 'hhshhhhshhhhshhh'] * 8, 'S': ['sshssrssshssrsss', 'srsssshssrssssrs'] * 8,
          'R': ['rr.rrr.rr.rrrr.r', 'r.rrr.rrr.rr.rrr'] * 8}
_BO = bands('o', 'p', 'p')


def _b_lip(k, m):
    return 'H' if k == 0 else 'S' if k == 1 else 'R'


B_NW = ['fffooooo', 'ffoopppp', 'foopp...', 'fop.....', 'op......', 'op......', 'op......', 'op......']
B_SW = ['op......', 'op......', 'op......', 'op......', 'op......', 'opRRRRRR', 'oSSSSSSS', 'oHHHHHHH']
B_IN_NW = ['op......', 'p.......'] + ['........'] * 6
B_IN_SW = ['........'] * 5 + ['RR......', 'SS......', 'op......']
B_INNER = inner_of(B_IN_NW, sw=B_IN_SW, se=mirror_h(B_IN_SW))
B1_FRAME = frame(B_NW, mirror_h(B_NW), B_SW, mirror_h(B_SW),
                 strips([(0, 2), (0, 2), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (0, 2),
                         (0, 2), (0, 3), (1, 3), (1, 3), (0, 2), (0, 2), (0, 2), (0, 2)], _BO, 'f'),
                 strips([(0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (0, 2), (0, 2), (0, 3),
                         (0, 3), (0, 3), (0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3)], _b_lip, 'f'),
                 strips([(0, 2), (1, 3), (1, 3), (0, 2), (0, 2), (0, 2), (0, 3), (0, 2),
                         (0, 2), (0, 2), (1, 3), (2, 4), (1, 3), (0, 2), (0, 2), (0, 2)], _BO, 'f'),
                 strips([(0, 2), (0, 2), (0, 3), (1, 3), (1, 3), (0, 2), (0, 2), (0, 2),
                         (0, 2), (1, 3), (2, 4), (2, 3), (1, 2), (0, 2), (0, 2), (0, 2)], _BO, 'f'))
B2_FRAME = frame(B_NW, mirror_h(B_NW), B_SW, mirror_h(B_SW),
                 strips([(0, 2), (1, 3), (2, 4), (3, 5), (2, 4), (1, 3), (0, 2), (0, 2),
                         (0, 2), (0, 2), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (0, 2)], _BO, 'f'),
                 strips([(0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 4), (0, 4), (0, 3),
                         (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 3), (0, 3)], _b_lip, 'f'),
                 strips([(0, 2), (0, 2), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (0, 2),
                         (0, 2), (1, 3), (2, 4), (3, 5), (2, 4), (1, 3), (0, 2), (0, 2)], _BO, 'f'),
                 strips([(0, 2), (1, 3), (2, 4), (2, 4), (1, 3), (0, 2), (0, 2), (0, 2),
                         (0, 2), (0, 2), (1, 3), (2, 4), (3, 5), (2, 4), (1, 3), (0, 2)], _BO, 'f'))
check_frame('B1 천장', B1_FRAME, B_INNER, strict_inner=False)
check_frame('B2 천장', B2_FRAME, B_INNER, strict_inner=False)


def ceil_b(n):
    fr, tex = (B1_FRAME, TEX_B1) if n == 1 else (B2_FRAME, TEX_B2)
    tops = b_top_bodies(n)
    return autotile_cv(tops[0], tex_grid(fr, tex, LB, 32, 32), tex_grid(B_INNER, tex, LB, 16, 16), tops[1:])


# 앞면 B1 — style-r1 B 의 바윗덩이 셋을 새 자리에, B2 — 한 칸에 둘 들어가는 큰 바윗덩이(손 도트 12×11) 사이로 깊은 틈.
B_CAP_L = cap_cols(['0' * 32, '00' + '1' * 28 + '00', '0' + '.' * 30 + '0'])
B_CAP_R = cap_cols(['0' * 32, '0' + '1' * 29 + '00', '.' * 31 + '0'])
B2_BOULDER = ['....5554....', '..55554443..', '.5555444433.', '.5544444333.', '554444443332', '544444433332',
              '544444333322', '444443333322', '.4443333322.', '.3333332222.', '..22222222..']


def _b_face_bg(alt):
    return (['0000000000000000', '1111111111111111']
            + [(alt[0] if y % 4 == 0 else alt[1] if y % 4 == 2 else '1' * 16) for y in range(2, 30)]
            + ['1111111111111111', '0000000000000000'])


def face_b1():
    cv = grid(_b_face_bg(('1111211111121111', '1211111111111121')), LB_FACE)
    for rows, x, y in ((SR.B_FACE_MED, 0, 1), (SR.B_FACE_BIG, 6, 2), (SR.B_FACE_SML, 13, 2), (SR.B_FACE_SML, 2, 8),
                       (SR.B_FACE_BIG, 11, 9), (SR.B_FACE_MED, 3, 12), (SR.B_FACE_SML, 9, 17), (SR.B_FACE_BIG, 0, 18),
                       (SR.B_FACE_MED, 12, 19), (SR.B_FACE_SML, 7, 24), (SR.B_FACE_MED, 1, 25)):
        wrap_stamp(cv, rows, LB_FACE, x, y)
    return face_block(cv, LB_FACE, B_CAP_L, B_CAP_R)


def face_b2():
    cv = grid(_b_face_bg(('1101111111110111', '1111110111111111')), LB_FACE)
    for rows, x, y in ((B2_BOULDER, 0, 1), (B2_BOULDER, 9, 4), (SR.B_FACE_SML, 13, 0), (B2_BOULDER, 3, 13),
                       (SR.B_FACE_MED, 13, 14), (B2_BOULDER, 10, 21), (B2_BOULDER, 0, 24), (SR.B_FACE_SML, 7, 26)):
        wrap_stamp(cv, rows, LB_FACE, x, y)
    return face_block(cv, LB_FACE, B_CAP_L, B_CAP_R)


# 흙바닥 B — 바탕 1(어두운 흙), 0 점, 2 밝은 흙, 회색 자갈(stone). 그늘 0.
B_FLOOR_N = [3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 4, 4, 3, 3, 2, 3, 3, 2, 2, 3, 3, 3, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2]
B_FLOOR_W = [3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1]
B_FLOOR_FRAME = floor_frame(B_FLOOR_N, B_FLOOR_W, '0', '0')
B_FLOOR_INNER = (['00......' + '....0000', '00......' + '......00', '0.......' + '.......0']
                 + ['.' * 16] * 10 + ['.' * 16, '0.......' + '.' * 8, '00......' + '.' * 8])
B1_FLOOR = [
    '1111211111112111', '1121111012111111', '1111111111111211', '1211110111112111',
    '1111111211111110', '0111211111211111', '1111111111111121', '1112111101111111',
    '1111111111211111', '1211101111111211', '1111111121111111', '1101111111110111',
    '1111121111111111', '1211111112111121', '1111011111111111', '1111111211101111']
B_PEB = ['.rr.', 'rqqp', '.pp.']
B_PEB_S = ['rq', 'qp']


def floor_b(n):
    cv = grid(B1_FLOOR if n == 1 else [
        '1112111101111211', '1211111111121111', '1111101211111111', '2111111111112111',
        '1111121111111101', '1101111110211111', '1111111111111121', '1211211111111111',
        '1111111201111211', '1111011111111111', '1121111111210111', '1111111211111111',
        '1111111111111121', '0121111101211111', '1111121111111111', '1111111111111110'], LB)
    pebs = (((B_PEB, 2, 2), (B_PEB, 10, 9), (B_PEB_S, 5, 12)) if n == 1 else
            ((B_PEB, 1, 1), (B_PEB_S, 7, 3), (B_PEB, 12, 5), (B_PEB_S, 3, 8), (B_PEB, 8, 11), (B_PEB_S, 14, 13),
             (B_PEB_S, 1, 14)))
    for rows, x, y in pebs:
        wrap2(cv, rows, LB, x, y)
    return autotile_cv(cv, grid(B_FLOOR_FRAME, LB, 32, 32), grid(B_FLOOR_INNER, LB, 16, 16))


# 돌바닥 B1 — 흙 위로 드러난 평평한 바닥 암반(stone q 바탕, r 빛, 금 p). 가장자리는 윤곽 o 로 흙에 묻힌다.
# 돌바닥 B2 — 깨진 큰 바닥돌(s r 밝은 판, 틈 o), 틈마다 흙이 끼었다.
B1_ROCK = carve([
    'qqqqqqqqqqqqqqqq', 'qrqqqqqqqqqqqqqq', 'qqqqqqqqqrqqqqqq', 'qqqqqqqqqqqqqqqq',
    'qqqqqrqqqqqqqqrq', 'qqqqqqqqqqqqqqqq', 'qqqqqqqqqqqqqqqq', 'qqrqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqq', 'qqqqqqqqqqrqqqqq', 'qqqqqqqqqqqqqqqq', 'qqqqqqqqqqqqqqqq',
    'qqqqqqrqqqqqqqqq', 'qqqqqqqqqqqqqrqq', 'qqqqqqqqqqqqqqqq', 'qrqqqqqqqqqqqqqq'],
    [(5, 0), (5, 1), (6, 2), (6, 3), (7, 4), (8, 4), (9, 5), (10, 6), (11, 6), (12, 7), (13, 7), (14, 8), (15, 8),
     (0, 8), (1, 9), (2, 10), (2, 11), (3, 12), (4, 13), (4, 14), (5, 15), (9, 11), (10, 12), (11, 12)],
    dark='o', shade='p', lit='r')
B2_ROCK = [
    'sssssrqo1osssssr', 'shhsssrqoossshss', 'shsssssrqosssssr', 'ssssssssrqossssr',
    'sssssssssrqoosss', 'rssssssssssrqoss', 'qrrssssssssssrqo', 'oqqrrsssssssssrq',
    '1ooqqrrrssssssro', 'ooshsssqqrrrrrqo', 'oshsssssssqqqqo1', 'osssssssssssro1o',
    'osssshssssssrqoo', 'orssssssssssrqo1', 'oqrrsssssssrrqoo', 'o1oqqrrrrrrqqo1o']
_RO = bands('o', 'o', 'o')
B_STONE_NW = [',,,,,,,,', ',,,,,,,,', ',,,,oooo', ',,,o....', ',,o.....', ',,o.....', ',,o.....', ',,o.....']
B_STONE_IN = [',,o.....', ',o......', 'o.......'] + ['........'] * 5
B_STONE_INNER = inner_of(B_STONE_IN)


def _b_stone_frame(n, s, w, e):
    return frame(B_STONE_NW, mirror_h(B_STONE_NW), mirror_v(B_STONE_NW), mirror_v(mirror_h(B_STONE_NW)),
                 strips(n, _RO, ','), strips(s, _RO, ','), strips(w, _RO, ','), strips(e, _RO, ','))


B1_STONE_FRAME = _b_stone_frame(
    [(2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3), (2, 3)],
    [(2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3)],
    [(2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3)],
    [(2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (3, 4), (2, 3)])
B2_STONE_FRAME = _b_stone_frame(
    [(2, 3), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3)],
    [(2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3)],
    [(2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (2, 3), (3, 4), (2, 3)],
    [(2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (2, 3)])
check_frame('B1 돌바닥', B1_STONE_FRAME, B_STONE_INNER)
check_frame('B2 돌바닥', B2_STONE_FRAME, B_STONE_INNER)


def stone_b(n):
    dirt = floor_b(n).body
    if n == 1:
        body, fr = grid(B1_ROCK, LB), B1_STONE_FRAME
    else:
        body, fr = shift(grid(B2_ROCK, LB), 4, 3), B2_STONE_FRAME
    f, i = on_base(dirt, fr, B_STONE_INNER, LB)
    return autotile_cv(body, f, i)


# 잔돌 B — 회색 바위(stone: o 윤곽 · h s 윗면 · r q 앞면 · p 밑). B1 둥근 바윗덩이, B2 모가 난 깨진 바위 조각(갱도 잔해).
B1_BIG = ['..ooooo..', '.ohhssso.', 'ohhsssrro', 'ohssssrro', 'osssrrrqo', 'orrrrqqqo', 'oqqqqqppo', '.oppppppo', '..ooooo..']
B1_MED = ['..oooo..', '.ohhsso.', 'ohsssrro', 'osrrrqqo', 'oqqqqppo', '.oppppo.', '..oooo..']
B1_SML = ['.ooo.', 'ohsso', 'oqqpo', '.ooo.']
B1_PEB = ['.oo.', 'osro', '.oo.']
B1_RUB_S = ['................'] * 8 + [
    '.....ooo........', '....ohsso.......', '....osrqo.oo....', '....oqqpoosro...',
    '.....ooo~~.oo~..', '......~~~~~~~...', '................', '................']
B2_SHARD = ['....oo....', '...ohso...', '..ohssro..', '.ohssrrqo.', 'ohhsrrrqqo', 'ooqqqqpppo', '..ooooooo.']
B2_BLOCK = ['oooooooo', 'ohhhssso', 'ohsssrro', 'oqqqqqpo', 'oqqqqppo', 'oooooooo']
B2_CHIP = ['.oo..', 'ohso.', 'oqqpo', '.ooo.']
B2_RUB_S = ['................'] * 7 + [
    '......oo........', '.....ohso.......', '....ohssro......', '...ohsrrqo.oo...',
    '...oqqqqpoohso..', '....ooooo~oqqo~.', '.....~~~~~~ooo~.', '..........~~~...', '................']


def rubble_b(n):
    if n == 1:
        small = grid(B1_RUB_S, LB)
        big = pile(32, 16, [(B1_MED, 11, 1), (B1_BIG, 3, 4), (B1_BIG, 17, 3), (B1_SML, 10, 10), (B1_PEB, 26, 11),
                            (B1_SML, 23, 9)],
                   [(5, 13, 8), (13, 14, 5), (19, 12, 9), (24, 13, 5), (27, 14, 3)], LB)
    else:
        small = grid(B2_RUB_S, LB)
        big = pile(32, 16, [(B2_BLOCK, 13, 2), (B2_SHARD, 2, 4), (B2_SHARD, 19, 3), (B2_CHIP, 11, 9), (B2_BLOCK, 21, 9),
                            (B2_CHIP, 8, 11)],
                   [(4, 11, 8), (10, 13, 3), (14, 8, 6), (22, 15, 8), (9, 15, 4)], LB)
    return small, big


# 석순 B1 — 회색 원뿔(stone), 기둥은 바위 윗면 빛깔(r q)의 울퉁불퉁한 머리로 끝난다(천장이 어둠이 아니라 바위 윗면이므로).
B1_STALAG = ['................'] * 5 + [
    '.......oo.......', '......ohqo......', '......ohqo......', '.....ohsqpo.....', '.....ohsrqo.....',
    '.....osrrqo.....', '....ohssrqpo....', '....ohsrrqpo....', '....oqrrrqpo....', '....ohsrrqpo....',
    '...ohssrrqqpo...', '...ohsrrrqqpo...', '...oqrrrqqppo...', '...ohsrrrqqpo...', '...osrrrqqqpo...',
    '..ohssrrrqqqpo..', '..osrrrrqqqppo..', '..oqrrrrqqqppo..', '..osrrrrqqqqpo..', '..oqqqqqqqppppo.',
    '...oqqqqppppo~~.', '....oooooooo~~..', '.....~~~~~~~~~..'] + ['................'] * 4
B1_PILLAR = [
    '..o.oooo.ooo....', '.oqoqrrqoqrqo...', '.oqrrrrrrrqqo...', '..oqrrrrrqqo....', '..ohsssrrqpo....',
    '...ohsrrqpo.....', '...ohsrrqpo.....', '...osrrrqpo.....', '...ohsrrqpo.....', '...oqqqqqpo.....',
    '...ohsrrqpo.....', '...osrrrqpo.....', '...ohsrrqpo.....', '...ohsrrqpo.....', '...oqqqqqpo.....',
    '...ohsrrqpo.....', '...osrrrqpo.....', '...ohsrrqpo.....', '...ohsrrqpo.....', '..ohssrrqqpo....',
    '..osrrrrqqpo....', '..ohsrrrqqpo....', '.ohssrrrqqqpo...', '.osrrrrrqqqpo...', 'ohssrrrrqqqppo..',
    'osrrrrrrqqqppo..', 'oqqqqqqqqppppo..', '.oooooooooooo~~.', '..~~~~~~~~~~~~..'] + ['................'] * 3
# B2 — 부러진 석순 그루터기 둘(윗면 단면이 보인다) · 비스듬한 틈이 지나는 울퉁불퉁한 바위 기둥(머리는 바위 윗면 빛깔).
B2_STALAG = ['................'] * 9 + [
    '........oooo....', '.......ohhsso...', '.......osrrqo...', '.......ohsrqpo..', '.......osrrqpo..',
    '..oooo.ohsrqpo..', '.ohhssoosrrqpo..', '.osrrqoohsrqpo..',
    '.ohsrqpoosrqqpo.', '.osrrqpoohsrqpo.', '.ohsrqpoosrrqqpo', '.osrrqqpohsrrqpo', '.oqqqqppoqqqqppo',
    '..oooooo~ooooooo', '...~~~~~~~~~~~~.'] + ['................'] * 8
B2_BOUL_A = ['..ooooo..', '.ohhssqo.', 'ohssrrqpo', 'ohsrrrqpo', 'osrrrqqpo', 'oqrrqqppo', 'oqqqqpppo', '.oqpppoo.',
             '..ooooo..']
B2_BOUL_B = ['...ooooo...', '..ohhsssoo.', '.ohssrrrqo.', 'ohssrrrrqpo', 'ohsrrrrqqpo', 'osrrrrqqqpo', 'oqrrrqqqppo',
             'oqqqqqqpppo', '.oqqppppoo.', '..ooooooo..']
B2_BOUL_C = ['....ooooo....', '..oohhsssoo..', '.ohhssrrrrqo.', 'ohssrrrrrrqpo', 'ohsrrrrrrqqpo', 'osrrrrrrqqqpo',
             'osrrrrrqqqppo', 'oqrrrrqqqqppo', 'oqqqqqqqqpppo', '.ooqqqpppppo.', '...ooooooo...']


def b2_pillar():
    """둥근 바윗덩이 셋이 엇갈려 쌓인 기둥 — 아래(큰 덩이)부터 얹어 위 덩이가 아래 덩이 윗면을 덮는다. 덩이마다 위·왼 빛, 오른·아래 그늘."""
    return pile(16, 32, [(B2_BOUL_C, 1, 15), (B2_BOUL_B, 4, 9), (B2_BOUL_A, 2, 3)], [(2, 26, 13), (14, 25, 2)], LB)


def stalag_b(n):
    return (grid(B1_STALAG, LB), grid(B1_PILLAR, LB)) if n == 1 else (grid(B2_STALAG, LB), b2_pillar())



# ================================================================================================ 줄 C — 검푸른 심층굴
# style-r1 C: 깊은 어둠 + 울퉁불퉁한 돌 혹 테두리(vrock 1~4, 바깥이 밝고 어둠 쪽으로 어두워짐), 물결 층리 앞면(vrock),
# 차가운 회색 자갈 바닥(cata, 바탕 3). 테두리 홈 글자 g = 바닥 바탕색 cata 3.
LC = legend(v=('void', 0), u=('void', 1), g=('cata', 3), **{str(i): ('vrock', i) for i in range(5)})
LC_FLOOR = legend(**{str(i): ('cata', i) for i in range(7)}, **{k: ('vrock', i) for i, k in enumerate('vwxyz')})


def _c1_layer(k, m):
    return str(max(1, min(4, m - k)))


def _c1_layer_s(k, m):
    return str(max(1, min(3, m - k)))


def _c2_layer(k, m):
    """층 진 턱: 바깥 밝은 끝선 4 · 그늘 2 · 안쪽 턱 빛 3 · 어둠으로 떨어지는 1."""
    if m == 1:
        return '4'
    if k == 0:
        return '4'
    if k == m - 1:
        return '1'
    if k == m - 2:
        return '3'
    return '2'


C1_NW = ['ggg23332', 'gg234421', 'g234421.', '234421..', '34421...', '3421....', '331.....', '21......']
C1_IN = ['21......', '11......'] + ['........'] * 6
C1_FRAME = frame(C1_NW, mirror_h(C1_NW), mirror_v(C1_NW), mirror_v(mirror_h(C1_NW)),
                 strips([(0, 2), (0, 3), (0, 4), (1, 5), (1, 5), (0, 4), (0, 3), (0, 2),
                         (0, 2), (0, 3), (0, 3), (0, 4), (0, 4), (0, 3), (1, 3), (0, 2)], _c1_layer, 'g'),
                 strips([(0, 2), (0, 3), (0, 4), (0, 4), (0, 3), (0, 3), (0, 3), (0, 2),
                         (0, 2), (0, 3), (0, 3), (0, 4), (0, 5), (0, 4), (0, 3), (0, 2)], _c1_layer_s, 'g'),
                 strips([(0, 2), (0, 3), (0, 4), (0, 4), (1, 4), (0, 3), (0, 3), (0, 2),
                         (0, 2), (0, 3), (0, 4), (0, 5), (0, 4), (0, 4), (0, 3), (0, 2)], _c1_layer, 'g'),
                 strips([(0, 2), (0, 3), (0, 3), (0, 4), (0, 4), (0, 4), (0, 3), (0, 2),
                         (0, 2), (1, 3), (0, 3), (0, 4), (1, 5), (0, 4), (0, 3), (0, 2)], _c1_layer, 'g'))
C1_INNER = inner_of(C1_IN)
C2_NW = ['gg444444', 'g4422222', 'g4223333', '42231111', '4231....', '4231....', '4231....', '4231....']
C2_IN = ['4231....', '2231....', '331.....', '11......'] + ['........'] * 4
C2_FRAME = frame(C2_NW, mirror_h(C2_NW), mirror_v(C2_NW), mirror_v(mirror_h(C2_NW)),
                 strips([(0, 4), (0, 4), (0, 5), (1, 5), (1, 6), (0, 5), (0, 4), (0, 4),
                         (0, 4), (0, 3), (0, 3), (0, 4), (1, 5), (1, 5), (0, 4), (0, 4)], _c2_layer, 'g'),
                 strips([(0, 4), (0, 4), (0, 5), (0, 5), (0, 4), (0, 3), (0, 3), (0, 4),
                         (0, 4), (0, 5), (0, 6), (0, 5), (0, 4), (0, 4), (0, 3), (0, 4)], _c2_layer, 'g'),
                 strips([(0, 4), (0, 5), (0, 5), (0, 4), (0, 4), (1, 5), (1, 5), (0, 4),
                         (0, 4), (0, 4), (0, 3), (0, 3), (0, 4), (0, 5), (1, 6), (0, 4)], _c2_layer, 'g'),
                 strips([(0, 4), (0, 3), (0, 4), (0, 5), (1, 6), (1, 5), (0, 4), (0, 4),
                         (0, 4), (0, 5), (0, 5), (1, 5), (0, 4), (0, 3), (0, 4), (0, 4)], _c2_layer, 'g'))
C2_INNER = inner_of(C2_IN)
check_frame('C1 천장', C1_FRAME, C1_INNER)
check_frame('C2 천장', C2_FRAME, C2_INNER)
C2_BODY = [   # 어둠에 아주 옅은 검푸른 결(0 = vrock 0)
    'vvvvvvvvvvvvvvvv', 'vvvv0vvvvvvvvvvv', 'vvvvv0vvvvvvvvvv', 'vvvvvvvvvvvv0vvv',
    'vvvvvvvvvvvvv0vv', 'vvvvvvvvvvvvvvvv', 'v0vvvvvvvvvvvvvv', 'vv0vvvvv0vvvvvvv',
    'vvvvvvvvv0vvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvv0', 'vvvvv0vvvvvvvvvv',
    'vvvvvv0vvvvvvvvv', 'vvvvvvvvvvvv0vvv', 'vvvvvvvvvvvvvvvv', 'vvv0vvvvvvvvvvvv']


def ceil_c(n):
    fr, inn, body = (C1_FRAME, C1_INNER, ['v' * 16] * 16) if n == 1 else (C2_FRAME, C2_INNER, C2_BODY)
    return autotile_cv(grid(body, LC), grid(fr, LC, 32, 32), grid(inn, LC, 16, 16))


# 앞면 C1 — 굵은 층 셋, 층 경계가 물결(0 틈 · 1 아랫면 그늘 · 4 윗턱 빛). style-r1 C 와 같은 문법, 물결 자리를 새로.
C1_FACE = [
    '1111111111111111', '2222222222222222', '3332333333233333', '3333333333333333',
    '3333233333333323', '2333333332333333', '3333222233333322', '2222111122333221',
    '1111000011222110', '0000444400111004', '4444333344000443', '3333333333444333',
    '3323333333333333', '3333333323333333', '3333333333332333', '2333332333333333',
    '3333333333333332', '3322333333322333', '2211223333211222', '1100112222100111',
    '0044001111044000', '4433440000433444', '3333334444333333', '3333333333333233',
    '3233333233333333', '3333333333333333', '3333323333332333', '2333333333333333',
    '3333333333333332', '2333233333233333', '1111111111111111', '0000000000000000']
# 앞면 C2 — 얇은 층리를 **끊어서**: 홈(1)과 그 밑 빛(4)이 3~7칸 길이 토막으로, 층 간격 2~5줄, 토막마다 한 줄씩 어긋난다.
C2_GROOVES = ((4, 2, 7), (5, 8, 10), (7, 12, 18), (10, 4, 9), (12, 10, 13), (13, 14, 15), (16, 0, 3), (17, 4, 5),
              (18, 8, 13), (21, 1, 6), (23, 11, 17), (25, 6, 9), (27, 12, 14))


def c2_face_rows():
    rows = [list(r) for r in (['1' * 16, '2' * 16]
                              + [('3332333333333233' if y % 5 == 0 else '3333333233333333' if y % 5 == 3 else '3' * 16)
                                 for y in range(2, 29)] + ['2' * 16, '1' * 16, '0' * 16])]
    for y, x0, x1 in C2_GROOVES:
        for x in range(x0, x1 + 1):
            rows[y][x % 16] = '1'
            if rows[y + 1][x % 16] in '23':
                rows[y + 1][x % 16] = '4'
    return [''.join(r) for r in rows]


C_CAP_L = cap_cols(['0' * 32, '0' + '1' * 30 + '0'])
C_CAP_R = cap_cols(['0' * 32, '0' + '1' * 30 + '0'])


def face_c(n):
    if n == 1:
        cv = grid(C1_FACE, LC)
    else:
        cv = grid(c2_face_rows(), LC)
    return face_block(cv, LC, C_CAP_L, C_CAP_R)


# 흙바닥 C — 차가운 회색 자갈(cata, 바탕 3). C1 = style-r1 C 의 자갈 셋 자리를 새로, C2 = 잔자갈과 실금(어두운 1·2).
C_FLOOR_BASE = [
    '3323332323332333', '2333233332333232', '3332333233233333', '3233323333332323',
    '3333333323333332', '2323233333323333', '3333332323333233', '3233333333233333',
    '3332323333333323', '2333333232333333', '3323333333332333', '3333233323333323',
    '2333333333233333', '3332333233333233', '3233323333323333', '3333333333333332']
C_PEB = ['.55.', '5444', '.411']
C_PEB_S = ['54', '41']
C_PEB_F = ['554', '411']
C_FLOOR_N = [3, 3, 3, 3, 3, 2, 2, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2]
C_FLOOR_W = [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 3, 2, 2, 3, 3, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1]
C_FLOOR_FRAME = floor_frame(C_FLOOR_N, C_FLOOR_W, '0', '1')
C_FLOOR_INNER = (['01......' + '....1000', '11......' + '......11', '1.......' + '.......1']
                 + ['.' * 16] * 10 + ['.' * 16, '0.......' + '.' * 8, '01......' + '.' * 8])


def floor_c(n):
    cv = grid(C_FLOOR_BASE, LC_FLOOR)
    pebs = (((C_PEB, 3, 2), (C_PEB, 11, 7), (C_PEB, 2, 11), (C_PEB, 13, 13), (C_PEB_S, 8, 1), (C_PEB_S, 15, 4),
             (C_PEB_S, 6, 9), (C_PEB_S, 9, 14), (C_PEB_F, 12, 2), (C_PEB_F, 5, 6)) if n == 1 else
            ((C_PEB_S, 1, 1), (C_PEB_S, 6, 3), (C_PEB_S, 12, 1), (C_PEB_S, 9, 7), (C_PEB_S, 2, 9), (C_PEB_S, 14, 10),
             (C_PEB_S, 6, 13), (C_PEB_F, 11, 13), (C_PEB_F, 3, 5)))
    for rows, x, y in pebs:
        wrap2(cv, rows, LC_FLOOR, x, y)
    if n == 2:
        for rows, x, y in ((['1', '.1', '..1'], 9, 3), (['.21', '1..'], 4, 10), (['1.', '.1'], 13, 6)):
            wrap2(cv, rows, LC_FLOOR, x, y)
    return autotile_cv(cv, grid(C_FLOOR_FRAME, LC_FLOOR, 32, 32), grid(C_FLOOR_INNER, LC_FLOOR, 16, 16))


# 돌바닥 C1 — 검푸른 바닥 암반(vrock y)이 불규칙한 판으로 갈라져 드러남.
# 돌바닥 C2 — 옅은 회색 판석(cata 5 6 빛 · 4 · 이음 1). 둘 다 흙(자갈)이 가장자리로 파고든다.
C1_ROCK = carve([   # 검푸른 암반 윗면(y 바탕 · z 빛 점)을 손으로 적은 금(v)이 불규칙한 판으로 나눈다(금 위·왼 그늘 x, 아래·오른 빛 z)
    'yyyyyyyyyyyyyyyy', 'yyzyyyyyyyyyyyyy', 'yyyyyyyyyyyzyyyy', 'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy', 'yyyyyzyyyyyyyyyy', 'yyyyyyyyyyyyyyzy', 'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy', 'yzyyyyyyyyyyyyyy', 'yyyyyyyyyzyyyyyy', 'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy', 'yyyyyyyyyyyyyzyy', 'yyyyzyyyyyyyyyyy', 'yyyyyyyyyyyyyyyy'],
    [(0, 4), (1, 4), (2, 4), (3, 5), (4, 5), (5, 5), (6, 4), (7, 4), (8, 4), (9, 3), (10, 3), (11, 3), (12, 4),
     (13, 4), (14, 4), (15, 4), (6, 5), (6, 6), (7, 7), (7, 8), (7, 9), (8, 10), (9, 11), (10, 11), (11, 11),
     (12, 12), (13, 12), (14, 12), (15, 12), (0, 12), (1, 13), (2, 13), (3, 14), (3, 15), (3, 0), (3, 1), (2, 2),
     (2, 3), (12, 13), (12, 14), (11, 15), (11, 0), (12, 1), (12, 2), (12, 3)], dark='v', shade='x', lit='z')
C2_SLAB_BASE = ['5555555555555555', '5555555555555555', '5555455555555555', '5555555555555455',
                '5555555555555555', '5555555545555555', '5555555555555555', '5545555555555555',
                '5555555555554555', '5555555555555555', '5555555555555555', '5555555455555555',
                '5555555555555555', '5555455555555555', '5555555555555555', '5555555555555555']
C2_SLAB_PORT = ports((11,), (4,))
C2_SLAB_NETS = [
    [[(11, 2), (10, 4), (6, 5), (2, 4)], [(13, 4), (12, 7), (10, 10), (11, 13)], [(6, 5), (7, 9), (10, 10)]],
    [[(2, 4), (5, 6), (8, 5), (11, 2)], [(13, 4), (12, 6), (11, 9), (11, 13)], [(5, 6), (4, 10), (7, 12)]],
    [[(11, 2), (12, 3), (13, 4)], [(2, 4), (4, 7), (8, 8), (11, 13)], [(8, 8), (9, 4)], [(3, 11), (5, 12)]],
    [[(11, 2), (9, 5), (5, 7), (2, 4)], [(13, 4), (11, 7), (11, 13)], [(9, 5), (11, 7)], [(5, 7), (6, 11)]],
]


def c2_slab_bodies():
    return [grid(net_body(base_turn(C2_SLAB_BASE, i), C2_SLAB_PORT, n, dark='1', shade='4', lit='6'), LC_FLOOR)
            for i, n in enumerate(C2_SLAB_NETS)]


_CJ = bands('v', 'v', 'v')
_CJ2 = bands('1', '1', '1')
C_STONE_NW = [',,,,,,,,', ',,,,,,,,', ',,,,JJJJ', ',,,J....', ',,J.....', ',,J.....', ',,J.....', ',,J.....']
C_STONE_IN = [',,J.....', ',J......', 'J.......'] + ['........'] * 5


def _c_stone_frame(j, n, s, w, e):
    nw = [r.replace('J', j) for r in C_STONE_NW]
    lay = bands(j, j, j)
    return (frame(nw, mirror_h(nw), mirror_v(nw), mirror_v(mirror_h(nw)),
                  strips(n, lay, ','), strips(s, lay, ','), strips(w, lay, ','), strips(e, lay, ',')),
            inner_of([r.replace('J', j) for r in C_STONE_IN]))


C1_STONE_FRAME, C1_STONE_INNER = _c_stone_frame(
    'v',
    [(2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3)],
    [(2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3), (2, 3)],
    [(2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3), (2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3)],
    [(2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (3, 4), (2, 3)])
C2_STONE_FRAME, C2_STONE_INNER = _c_stone_frame(
    '1',
    [(2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3), (3, 4), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3)],
    [(2, 3), (3, 4), (2, 3), (1, 2), (1, 2), (2, 3), (3, 4), (2, 3), (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (3, 4), (2, 3), (2, 3)],
    [(2, 3), (2, 3), (3, 4), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (2, 3), (3, 4), (2, 3), (2, 3), (1, 2), (1, 2), (2, 3), (2, 3)],
    [(2, 3), (3, 4), (3, 4), (2, 3), (2, 3), (1, 2), (2, 3), (2, 3), (2, 3), (2, 3), (1, 2), (2, 3), (3, 4), (2, 3), (3, 4), (2, 3)])
check_frame('C1 돌바닥', C1_STONE_FRAME, C1_STONE_INNER)
check_frame('C2 돌바닥', C2_STONE_FRAME, C2_STONE_INNER)


def stone_c(n):
    dirt = floor_c(n).body
    bodies, fr, inn = (([grid(C1_ROCK, LC_FLOOR)], C1_STONE_FRAME, C1_STONE_INNER) if n == 1 else
                       (c2_slab_bodies(), C2_STONE_FRAME, C2_STONE_INNER))
    f, i = on_base(dirt, fr, inn, LC_FLOOR)
    return autotile_cv(bodies[0], f, i, bodies[1:])


# 잔돌 C1 — 둥근 검푸른 덩이(윗면 4 3 빛 · 앞 아래 2 1 그늘 · 앞면을 가로지르는 층 줄 1 · 윤곽 0). C2 — 쪼개진 얇은 판 조각과 작은 파편.
C1_BIG = ['...00000...', '..0444330..', '.044443320.', '04443333220', '04333332210', '01112222110', '.021111110.', '..0000000..']
C1_MED = ['..0000..', '.044330.', '04443320', '03332210', '01122110', '.011110.', '..0000..']
C1_SML = ['.000.', '04430', '01210', '.000.']
C2_PLATE = ['..00000000..', '.0444443330.', '033333322220', '.0111111110.', '..00000000..']
C2_SHARD = ['.0..', '040.', '0430', '0110', '.00.']
C2_FLAKE = ['.00.', '0430', '.00.']
C2_RUB_S = ['................'] * 9 + [
    '......0.........', '.....040..00....', '.....0430.0430..', '.....0110~.0110.',
    '......00~~..00~.', '.......~~~..~~..', '................']


def rubble_c(n):
    if n == 1:
        small = pile(16, 16, [(C1_MED, 3, 6), (C1_SML, 10, 9)], [(4, 13, 11)], LC)
        big = pile(32, 16, [(C1_MED, 11, 1), (C1_BIG, 2, 5), (C1_BIG, 17, 4), (C1_SML, 12, 9), (C1_SML, 27, 10)],
                   [(3, 13, 10), (13, 13, 4), (18, 12, 11), (28, 14, 4)], LC)
    else:
        small = grid(C2_RUB_S, LC)
        big = pile(32, 16, [(C2_PLATE, 9, 3), (C2_PLATE, 2, 7), (C2_SHARD, 22, 3), (C2_PLATE, 17, 8), (C2_SHARD, 14, 9),
                            (C2_FLAKE, 27, 11), (C2_FLAKE, 6, 11)],
                   [(4, 12, 8), (11, 8, 9), (19, 13, 10), (23, 8, 3), (28, 14, 3), (7, 14, 3)], LC)
    return small, big


# 석순 C1 — 검푸른 원뿔(버들항 화산굴 석순과 같은 vrock), 층 고리 1. 기둥은 층이 진 검푸른 기둥, 머리는 가장 어두운 단(0 1)으로 어둠에 묻힌다.
# 석순 C2 — 가늘고 긴 바늘 석순 + 짧은 것, 기둥은 위아래가 굵은 층암 기둥.
C1_STALAG = ['................'] * 4 + [
    '.......00.......', '......0430......', '......0430......', '.....043210.....', '.....043210.....',
    '.....011110.....', '....04332110....', '....04332210....', '....04322110....', '....01111110....',
    '...0433322110...', '...0433222110...', '...0432222110...', '...0111111110...', '..043332221110..',
    '..043322221110..', '..043322221110..', '..011111111110..', '..043322221110..', '.04433222211100.',
    '.04332222211110.', '..000000000000~~', '...~~~~~~~~~~~~.', '................', '................',
    '................', '................', '................']
C1_PILLAR = [
    '..000000000000..', '..011121111110..', '...0111111110...', '...0111111110...', '...0432222110...',
    '...0433222110...', '...0111111110...', '...0432222110...', '...0433222110...', '...0432222110...',
    '...0111111110...', '...0443322110...', '...0432222110...', '...0432222110...', '...0111111110...',
    '...0433222110...', '...0432222110...', '...0433222110...', '...0111111110...', '...0432222110...',
    '..043322221110..', '..043322221110..', '..011111111110..', '.04433222211100.', '.04332222211110.',
    '.04332222211110.', '..000000000000~.', '...~~~~~~~~~~~..', '................', '................',
    '................', '................']
C2_STALAG = ['................'] * 2 + [
    '.........0......', '.........0......', '........040.....', '........040.....', '........0410....',
    '........0410....', '.......04310....', '.......04310....', '.......04210....', '.......04210....',
    '.......04210....', '......043210....', '......043210....', '.0....042110....', '040...043210....',
    '040...0432110...', '0410..0422110...', '0410..0432110...', '04310.0432110...', '04210.0422110...',
    '04311004332110..', '04211004332110..', '0000000000000~~.', '.~~~~~~~~~~~~~..'] + ['................'] * 6
C2_PILLAR = [
    '..000000000000..', '..044433322110..', '..011111111110..', '...0432222110...', '...0111111110...',
    '....04322110....', '....04322110....', '....04222110....', '....01111110....', '....04322110....',
    '....04322110....', '....04222110....', '....04322110....', '....01111110....', '....04322110....',
    '....04322110....', '....04222110....', '....04322110....', '....01111110....', '...0432222110...',
    '...0111111110...', '..043322221110..', '..011111111110..', '.04433222211100.', '.04332222211110.',
    '..000000000000~.', '...~~~~~~~~~~~..', '................', '................', '................',
    '................', '................']


def stalag_c(n):
    return (grid(C1_STALAG, LC), grid(C1_PILLAR, LC)) if n == 1 else (grid(C2_STALAG, LC), grid(C2_PILLAR, LC))


# ================================================================================================ 조립·장면·후보 표
SETS = {}   # 줄 → 번호 → {'ceil','face','floor','stone','rubble','stalag'} 만드는 함수


def part(line, n, key):
    return SETS[line][n][key]()


def render(g, line, n, ceil=None, face=None, floor=None, stone=None):
    """g: '#' 바위 · '.' 흙 · 's' 돌바닥. 주지 않은 조각은 같은 줄·같은 번호."""
    ceil = ceil or part(line, n, 'ceil')
    face = face or part(line, n, 'face')
    floor = floor or part(line, n, 'floor')
    cv = dot.render_cave(g, ceil, face, floor)
    if any('s' in r for r in g):
        stone = stone or part(line, n, 'stone')
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                if ch == 's':
                    cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = stone.tile_at(dot.mask_at(g, x, y, lambda c, X, Y: c == 's'), x, y).a
    return cv


VIGN_GRID = [   # 천장·앞면·바닥 후보 장면 10×8 — 바깥/안 모서리, 앞면 끝, 한 칸 들어간 벽, 남쪽 바위 덩이
    '##########',
    '##########',
    '##########',
    '###...####',
    '#.....##.#',
    '#........#',
    '##.##....#',
    '##########',
]
STONE_GRID = [
    '#########',
    '#########',
    '#########',
    '#.......#',
    '#.sss...#',
    '#.ssss.s#',
    '#..ss.ss#',
    '#.......#',
    '#########',
]
ROOM_GRID = [
    '########',
    '########',
    '########',
    '#......#',
    '#......#',
    '#......#',
    '########',
]
# 줄별 장면 8×6 — 벽선이 칸마다 오르내리고(앞면 끝 마구리), 돌바닥 조각, 잔돌·석순·기둥, 사람.
SCENE_GRID = [
    '########',
    '########',
    '########',
    '##...###',
    '#.ss....',
    '#.sss...',
]


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def scene(line, n):
    cv = render(SCENE_GRID, line, n)
    stal, pil = part(line, n, 'stalag')
    small, big = part(line, n, 'rubble')
    cv.paste(pil, 1 * T, 3 * T + 8)        # 기둥: 밑동 (1,5)
    cv.paste(big, 5 * T, 3 * T + 4)        # 2×1 잔돌 덩이: (5,4)~(6,4) 앞면 밑
    cv.paste(stal, 7 * T, 3 * T + 8)       # 석순: 밑동 (7,5)
    cv.paste(small, 4 * T, 4 * T)          # 1×1 잔돌
    cv.paste(actor_cv(), 3 * T - 4, 4 * T - 12)
    return cv


def line_scenes():
    out = {}
    for ln in SETS:
        out[ln] = [(f'{ln}{n} 세트', NOTES.get(f'{ln}{n}', ''), scene(ln, n)) for n in SETS[ln]]
    return out


SCENE_LEAD = ('그 줄의 같은 번호 조각(천장·앞면·흙바닥·돌바닥·잔돌·석순/기둥)으로 깐 8×6 칸 동굴 한 자락 + Actor1. '
              '벽선이 칸마다 오르내려 앞면 끝 마구리와 천장 바깥/안 모서리가 다 나온다. 맵 가장자리는 잘린 것(맵이 이어진다고 본다).')


def cand_ceiling(line, n):
    def fn():
        at = part(line, n, 'ceil')
        v = render(VIGN_GRID, line, n, ceil=at)
        return a2_plus(at), {'kind': 'autotile', 'autotiles': {'ceil': at}, 'vignette': v, 'grid': VIGN_GRID,
                             'rim_check': True,
                             'extras': [(f'천장 몸통 8×8 (변형 {len(at.bodies) - 1} 섞음)', dot.mosaic(at, 8, 8), 2),
                                        ('47 변형', variants_sheet(at), 2)]}
    return fn


def cand_face(line, n):
    def fn():
        f = part(line, n, 'face')
        v = render(VIGN_GRID, line, n, face=f)
        return f.b, {'kind': 'face', 'faces': {'face': f}, 'vignette': v, 'grid': VIGN_GRID, 'rim_check': True,
                     'extras': [('앞면 6칸 이어 붙임(끝 마구리 포함)', face_run(f), 2)]}
    return fn


def cand_floor(line, n):
    def fn():
        at = part(line, n, 'floor')
        v = render(VIGN_GRID, line, n, floor=at)
        return a2_plus(at), {'kind': 'autotile', 'autotiles': {'floor': at}, 'vignette': v,
                             'extras': [(f'몸통 8×8 (변형 {len(at.bodies) - 1} 섞음)', dot.mosaic(at, 8, 8), 2),
                                        ('47 변형', variants_sheet(at), 2)]}
    return fn


def cand_stone(line, n):
    def fn():
        at = part(line, n, 'stone')
        v = render(STONE_GRID, line, n, stone=at)
        return a2_plus(at), {'kind': 'autotile', 'autotiles': {'stone': at}, 'vignette': v,
                             'extras': [(f'몸통 8×8 (변형 {len(at.bodies) - 1} 섞음)', dot.mosaic(at, 8, 8), 2),
                                        ('47 변형', variants_sheet(at), 2)]}
    return fn


def cand_rubble(line, n):
    def fn():
        small, big = part(line, n, 'rubble')
        v = render(ROOM_GRID, line, n)
        v.paste(small, 1 * T, 4 * T)
        v.paste(big, 3 * T, 3 * T + 4)
        v.paste(small, 6 * T, 5 * T)
        v.paste(actor_cv(), 5 * T - 4, 4 * T - 16)
        return hcat(small, big), {'kind': 'object', 'parts': {'small': small, 'big': big}, 'vignette': v}
    return fn


def cand_stalag(line, n):
    def fn():
        stal, pil = part(line, n, 'stalag')
        v = render(ROOM_GRID, line, n)
        v.paste(pil, 1 * T, 3 * T + 8)
        v.paste(stal, 3 * T, 3 * T + 8)
        v.paste(stal, 6 * T, 4 * T + 8)
        v.paste(actor_cv(), 4 * T + 4, 4 * T - 12)
        return hcat(stal, pil), {'kind': 'object', 'parts': {'stalagmite': stal, 'pillar': pil}, 'vignette': v}
    return fn


ITEM_FNS = {'cave.ceiling': cand_ceiling, 'cave.face': cand_face, 'cave.floor': cand_floor,
            'cave.floor_stone': cand_stone, 'cave.rubble': cand_rubble, 'cave.stalagmite': cand_stalag}
ITEM_KEY = {'cave.ceiling': 'ceil', 'cave.face': 'face', 'cave.floor': 'floor', 'cave.floor_stone': 'stone',
            'cave.rubble': 'rubble', 'cave.stalagmite': 'stalag'}
SKIP = {}   # {(줄, 항목)} — 시드 lines.<줄>.skip 과 같게. 줄 컨셉에 안 맞는 항목은 그리지 않는다.


def _candidates():
    out = {}
    for item, mk in ITEM_FNS.items():
        out[item] = {}
        for ln, ns in SETS.items():
            if (ln, item) in SKIP:
                continue
            for n in ns:
                out[item][f'{ln}{n}'] = _noted(mk(ln, n), ITEM_KEY[item], f'{ln}{n}')
    return out


def _noted(fn, key, cand):
    def g():
        cv, meta = fn()
        meta['note'] = ITEM_NOTES[key][cand]
        return cv, meta
    return g


SETS['A'] = {n: {'ceil': (lambda n=n: ceil_a(n)), 'face': (face_a1 if n == 1 else face_a2), 'floor': (lambda n=n: floor_a(n)),
                 'stone': (lambda n=n: stone_a(n)), 'rubble': (rubble_a1 if n == 1 else rubble_a2),
                 'stalag': (stalag_a1 if n == 1 else stalag_a2)} for n in (1, 2)}
SETS['B'] = {n: {'ceil': (lambda n=n: ceil_b(n)), 'face': (face_b1 if n == 1 else face_b2), 'floor': (lambda n=n: floor_b(n)),
                 'stone': (lambda n=n: stone_b(n)), 'rubble': (lambda n=n: rubble_b(n)),
                 'stalag': (lambda n=n: stalag_b(n))} for n in (1, 2)}
SETS['C'] = {n: {'ceil': (lambda n=n: ceil_c(n)), 'face': (lambda n=n: face_c(n)), 'floor': (lambda n=n: floor_c(n)),
                 'stone': (lambda n=n: stone_c(n)), 'rubble': (lambda n=n: rubble_c(n)),
                 'stalag': (lambda n=n: stalag_c(n))} for n in (1, 2)}
NOTES = {
    'A1': '해안 흙굴 1벌 — 하얀 끝선·울퉁불퉁한 흙 띠, 조약돌 벽, 갈색 반점 흙, 녹회색 판석',
    'A2': '해안 흙굴 2벌 — 굵은 사암 바위 혹 테두리, 이끼 낀 갈라진 벼랑, 자갈 섞인 흙, 사암 자갈',
    'B1': '산속 바위굴 1벌 — 금 간 바위 윗면, 바윗덩이 벽, 어두운 흙, 드러난 암반',
    'B2': '산속 바위굴 2벌 — 바윗덩이 밭 윗면, 큰 바윗덩이 벽, 거친 자갈 흙, 깨진 큰 바닥돌, 둥근 덩이 쌓인 기둥',
    'C1': '검푸른 심층굴 1벌 — 돌 혹 테두리, 굵은 물결 층리, 회색 자갈, 갈라진 검푸른 암반',
    'C2': '검푸른 심층굴 2벌 — 층 진 턱 테두리, 끊긴 얇은 층리, 잔자갈·실금, 옅은 판석',
}
ITEM_NOTES = {
    'ceil': {'A1': '띠 6px · 하얀 끝선 l. 북·서·동 변에 흙(f)이 1~2px 파고들어 윤곽이 울퉁불퉁, 남변(벽 윗면)은 곧은 끝선. 둥근 바깥 모서리',
             'A2': '흙 띠 대신 굵은 바위 혹 — 둥근 사암 덩이가 한 칸에 둘, 덩이 사이로 흙이 파고듦. 남변은 덩이 앞턱이 둥글게',
             'B1': '바위 윗면 + 몸통 변형 3(금 양이 칸마다 다름 — 긴 금·없음·갈래 금). 바닥 쪽 윤곽 o + 그늘 p(홈 1~2px), 앞면 위 빛 받는 턱 2~4줄',
             'B2': '바윗덩이 밭 + 몸통 변형 3(덩이 모양이 칸마다 다름, 칸 경계는 공통 이음 자리로만 건넘). 홈 최대 3px, 턱 3~5줄',
             'C1': '돌 혹 테두리 깊이 2~5(바깥 밝음 → 어둠 쪽 어두움), 바닥 홈 g',
             'C2': '층 진 턱 테두리(밝은 끝선 4 · 그늘 2 · 안쪽 턱 3 · 1), 어둠에 옅은 검푸른 결'},
    'face': {'A1': 'style-r1 A 의 돌 셋을 새 자리에, 끝 마구리 둥글게',
             'A2': '갈라진 녹회색 벼랑 + 가로 턱 둘, 위 끝·턱 위 이끼',
             'B1': 'style-r1 B 의 바윗덩이 셋을 새 자리에',
             'B2': '한 칸에 둘 들어가는 큰 바윗덩이, 사이 깊은 틈',
             'C1': '굵은 층 셋, 물결 경계(style-r1 C 문법)',
             'C2': '얇은 층리를 끊은 토막 — 홈 길이 3~7, 층 간격 2~5줄, 토막마다 어긋남'},
    'floor': {'A1': '갈색 반점 흙(바탕 2). 앞면 밑 그늘 2~4줄, 서쪽 그늘 1~3열',
              'A2': '같은 바탕에 녹회색 자갈과 젖은 얼룩',
              'B1': '어두운 흙(바탕 1) + 회색 자갈 셋',
              'B2': '같은 바탕에 자갈 일곱 — 더 거친 자갈 바닥',
              'C1': '차가운 회색 자갈(바탕 3), 자갈 열 개',
              'C2': '잔자갈 + 실금'},
    'stone': {'A1': '녹회색 판석 + 몸통 변형 3 — 판석 크기·배치가 칸마다 다름(칸 경계는 공통 이음 자리로만). 흙이 가장자리로 1~3px 파고듦',
              'A2': '흙에 박힌 둥근 사암 자갈',
              'B1': '흙 위로 드러난 바닥 암반(짧은 금), 윤곽 o',
              'B2': '깨진 큰 바닥돌(밝은 판), 틈에 흙',
              'C1': '검푸른 암반이 불규칙한 판으로 갈라짐',
              'C2': '옅은 회색 판석 + 몸통 변형 3 — 판석 모양이 칸마다 다름'},
    'rubble': {'A1': '1×1 작은 돌 둘(걸음) · 2×1 녹회색 둥근 돌 덩이(막힘)',
               'A2': '무너진 사암 띠 판 조각',
               'B1': '둥근 회색 바윗덩이',
               'B2': '모난 바위 조각(갱도 잔해)',
               'C1': '둥근 검푸른 덩이 — 윗면 빛, 앞면을 가로지르는 층 줄 하나',
               'C2': '얇은 판 조각·파편'},
    'stalag': {'A1': '갈색 원뿔 석순 / 모래시계 기둥(머리가 어둠 쪽으로 어두워짐)',
               'A2': '이끼 낀 쌍둥이 석순 / 이끼 띠 감긴 기둥',
               'B1': '회색 원뿔 / 바위 윗면 빛깔 머리의 기둥',
               'B2': '부러진 석순 그루터기 둘 / 둥근 바윗덩이 셋이 엇갈려 쌓인 기둥',
               'C1': '층 고리 진 검푸른 원뿔 / 층 기둥',
               'C2': '가는 바늘 석순 + 짧은 것 / 위아래가 굵은 층암 기둥'},
}
CANDIDATES = _candidates()

"""gap-ice-r5 — 얼음 동굴 벽(gap.ice_rock). r4 반려(독립 Sonnet, ~/claude-viz/dungeon-themes-3-raw/ice-wall-r4-sonnet.txt):
  윗면 = 납작한 회청 바탕에 드문 밝은 점(정보량·명암 단 부족) · 위 가장자리 2~3px 흰 입술이 윤곽선처럼 읽힘 ·
  앞면 = 채도 높은 납작한 파랑 막대(울타리·파이프) · 앞면 밑이 자로 그은 검은 띠 · 끝이 칼로 자른 세로선.

r5:
  윗면 — **고른 줄 C2 바위 윗면 그대로**(gap-rock-r1 C2, 덩이·금·5단 명암, object-gate·사람 허용 판)에 서리를 얹는다:
         덩이의 빛 받는 위·왼 화소(m·h·c)만 서리(snow 0/1)로, 가장 밝은 점은 snow 2. 틀(옆선·귀)도 C2 그대로 — 흰 입술 없음.
  앞면 — 바위 몸(vrock 1~3, 층 결)이 바탕이고, 그 위를 **얇은 얼음 판**이 군데군데 덮는다(덮는 비율 ≈ 45%):
         판 위쪽 = ice 1~2(빛 받음), 아래로 갈수록 water 2 → water 1 로 깊어지다가 바위로 풀린다(밑변이 열마다 들쭉날쭉).
         판 속에 바위 결이 비친다(바위 어두운 화소 자리는 얼음 한 단 어둡게). 판 왼 가장자리 1px 빛, 오른 가장자리 그늘.
         고드름은 판 밑변·처마에서 1~2px 굵기로 길이 2~13, 간격 제각각, 몇 개는 짧은 그루터기.
         처마(맨 위 0~3줄)는 윗면 C2 앞턱 색 그대로(밝은 흰 띠 없음) + 몇 화소 눈.
         밑 3줄 = 열마다 높이가 다른 그늘(바위 → 바닥 그림자), 군데군데 눈 더미 혹(snow 0/1)이 바닥 쪽으로 불룩.
  48px 가운데 덩이·이음 열 15·31·47 같은 화소 규칙은 r3·r4 와 같다.
  A1 「서리판」 — 넓은 얼음 판 둘 + 좁은 판 하나.   A2 「얼음 혀」 — 좁고 긴 판 넷, 고드름 많음.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import a2_plus, autotile_cv, hcat, on_base, variants_sheet  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402
import gap_ice_r1 as R1  # noqa: E402
import gap_ice_r3 as R3  # noqa: E402  장면 격자·render_scene·mid_run
import gap_rock_r1 as GR  # noqa: E402  고른 줄 C2 바위(윗면 몸통·틀)

WAVE = 'gap'
T = 16
MW = 48

# ================================================================================================ 윗면 — C2 바위 + 서리
TOP_LEG = dict(GR.LEG['C'])
TOP_LEG.update(legend(F=('snow', 0), G=('snow', 1), W=('snow', 2), I=('iron', 4)))


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


def frost(rows, i):
    """빛 받는 덩이 화소(m·c·h)에 서리. 덩이 위·왼 끝(위나 왼이 어두운 화소)은 snow 1, 안쪽은 snow 0, h 는 snow 2.
    서리는 덩이 위에만 앉는다 — 바탕(b·k)은 바위 그대로라 바위 결이 보인다."""
    g = [list(r) for r in rows]
    H, W = len(g), len(g[0])
    out = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c not in 'mch':
                continue
            up = g[(y - 1) % H][x]
            lf = g[y][(x - 1) % W]
            if c == 'h':
                out[y][x] = 'W'
            elif up in 'bkxd' or lf in 'bkxd':
                out[y][x] = 'G'
            elif c == 'c' and _h(x, y, i) % 3 == 0:
                out[y][x] = 'I'
            else:
                out[y][x] = 'F'
    # 서리 덩이 아래 한 화소는 그늘(k) — 쌓인 눈 두께
    for y in range(H - 1):
        for x in range(W):
            if out[y][x] in 'FGW' and out[y + 1][x] == 'b' and _h(x, y, i, 2) % 2 == 0:
                out[y + 1][x] = 'k'
    return [''.join(r) for r in out]


def rock_top(n):
    bodies = GR.quiet_first(GR.tops('C', 2))
    bodies = [frost(b, i) for i, b in enumerate(bodies)]
    floor = R1.ground(1)
    fr, inner = GR.rock_frame('C', GR.PROF2 if n == 2 else GR.PROF1, soft=False)
    frc, innc = on_base(floor.body, fr, inner, GR.LEG['C'])
    cvs = [grid(b, TOP_LEG, 16, 16) for b in bodies]
    return autotile_cv(cvs[0], frc, innc, cvs[1:])


# ================================================================================================ 앞면
# 바위: x vrock0 · k vrock1 · b vrock2 · m vrock3 · c iron2 / 얼음: 1 water1 · 2 water2 · 3 ice0 · 4 ice1 · 5 ice2 / 눈: F snow0 · G snow1
# 바닥 그림자 '0' cata0 (C2 앞면과 같은 접지색)
FACE_LEG = legend(x=('vrock', 0), k=('vrock', 1), b=('vrock', 2), m=('vrock', 3), c=('iron', 2),
                  **{'1': ('water', 1), '2': ('water', 2), '3': ('ice', 0), '4': ('ice', 1), '5': ('ice', 2), '0': ('cata', 0)},
                  F=('snow', 0), G=('snow', 1))


def _d(s, n):
    assert len(s) == n, (len(s), n, s)
    return [int(c, 36) for c in s]


# 바위 몸: 16 주기 얼룩(C2 앞면 FACE_MOTTLE 의 + / -) 위 층 결 둘
def rock_body(W, beds, foot):
    g = [['b'] * W for _ in range(32)]
    for y in range(32):
        m = GR.FACE_MOTTLE[(y - 3) % len(GR.FACE_MOTTLE)]
        for x in range(W):
            mk = m[x % 16]
            base = 'b' if y < 13 else 'k' if (x * 3 + y) % 4 else 'b'
            if mk == '+':
                base = 'm' if base == 'b' else 'b'
            elif mk == '-':
                base = 'k' if base == 'b' else 'x'
            g[y][x] = base
    for y0, offs in beds:
        for x, o in enumerate(offs):
            if o == '.':
                continue
            y = y0 + int(o)
            g[y - 1][x] = 'k'
            g[y][x] = 'x' if (x + y) % 4 else 'k'
            g[y + 1][x] = 'm' if x % 3 else 'c'
    # 처마(0~2줄): C2 앞턱 그대로 — 위 줄 m, 다음 c/m, 다음 k
    for x in range(W):
        g[0][x] = 'm'
        g[1][x] = 'c' if x % 5 else 'm'
        g[2][x] = 'k'
    # 밑: 열마다 높이 다른 그늘 → 바닥
    F = _d(foot, W)
    for x in range(W):
        f = F[x]   # 0..3 = 바위가 바닥까지 내려오는 깊이
        for y in range(28, 32):
            d = y - 28
            if d >= 4 - (f % 4) + 1:
                g[y][x] = '0'
            elif d >= 4 - (f % 4):
                g[y][x] = 'x'
            else:
                g[y][x] = 'k' if g[y][x] in 'mc' else g[y][x]
    return g


def ice_sheets(g, sheets, glints=(), icicles=(), snow=()):
    """sheets = [(x0, 위 표, 밑 표)] — 열마다 판 위 행·밑 행(36진). 판 속 단: 위 3줄 5/4, 그 밑 4, 가운데 3, 밑 3줄 2, 맨 밑 1.
    밑 바위가 어두운(k·x) 화소는 얼음도 한 단 어둡게. 판 왼 끝 열 한 단 밝게, 오른 끝 열 한 단 어둡게."""
    W = len(g[0])
    bot = {}
    for x0, tops, bots in sheets:
        Tp, Bt = [int(c, 36) for c in tops], [int(c, 36) for c in bots]
        assert len(Tp) == len(Bt)
        for j, (t, b) in enumerate(zip(Tp, Bt)):
            b = min(b, 25)   # 밑 3줄(바닥 그늘)·고드름 자리를 남긴다
            x = (x0 + j) % W
            bot[x] = b
            for y in range(t, b + 1):
                r = (y - t) / max(1, b - t)
                k = 5 if y - t < 2 else 4 if r < 0.35 else 3 if r < 0.7 else 2 if y < b else 1
                if g[y][x] in 'kx':
                    k -= 1
                if j == 0:
                    k += 1
                elif j == len(Tp) - 1:
                    k -= 1
                g[y][x] = str(max(1, min(5, k)))
    for x, y in glints:
        if g[y][x] in '34':
            g[y][x] = '5'
    for x, n, w in icicles:
        y0 = bot.get(x, 2) + 1
        for i in range(n):
            y = y0 + i
            if y >= 29:
                break
            ww = w if i < n * 0.4 else 1
            for j in range(ww):
                X = (x + j) % W
                g[y][X] = '2' if i == n - 1 else ('4' if j == 0 else '3')
            X = (x + ww) % W
            if g[y][X] in 'bm':
                g[y][X] = 'k'
    for x, y, rows in snow:   # 바닥 눈 더미 혹
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch != '.':
                    g[y + dy][(x + dx) % W] = ch
    return g


def ice_glaze(g, bottom, seeds, glints=(), icicles=(), snow=(), holes=()):
    """앞면 위쪽을 덮는 한 장의 얼음(결정면). bottom = 열마다 밑변 행(36진). seeds = [(x, y, 밝기 단 2~5)] 결정면 씨앗.
    면마다 단이 다르고, 면의 위·왼 경계 화소는 한 단 밝게(빛 모서리), 아래·오른 경계는 한 단 어둡게. 밑변 위 2줄은 깊은 단으로 풀린다.
    밑 바위가 어두운(k·x) 화소는 한 단 어둡게 비친다. holes = [(x, y, rows)] 얼음이 얇아 바위가 드러난 곳('#')."""
    W = len(g[0])
    B = _d(bottom, W)
    lab = {}
    for x in range(W):
        for y in range(3, B[x] + 1):
            best = min(range(len(seeds)), key=lambda i: min((x - seeds[i][0] + d) ** 2 for d in (-W, 0, W)) * 1.0 + 2.2 * (y - seeds[i][1]) ** 2)
            lab[(x, y)] = best
    for (x, y), i in lab.items():
        k = seeds[i][2]
        up = lab.get((x, y - 1), -1)
        lf = lab.get(((x - 1) % W, y), -1)
        dn = lab.get((x, y + 1), -1)
        rt = lab.get(((x + 1) % W, y), -1)
        if up != i or lf != i:
            k += 1
        elif dn != i or rt != i:
            k -= 1
        if B[x] - y <= 1:
            k = min(k, 2) - (1 if B[x] == y else 0)
        if g[y][x] in 'kx' and k <= 3:
            k -= 1
        g[y][x] = str(max(1, min(5, k)))
    for x0, y0, rows in holes:
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch == '#':
                    X, Y = (x0 + dx) % W, y0 + dy
                    g[Y][X] = 'm' if dy == 0 else 'b' if dx == 0 else 'k'
    for x, y in glints:
        if g[y][x] in '34':
            g[y][x] = '5'
    for x, n, w in icicles:
        y0 = B[x] + 1
        for i in range(n):
            y = y0 + i
            if y >= 29:
                break
            ww = w if i < n * 0.4 else 1
            for j in range(ww):
                X = (x + j) % W
                g[y][X] = '2' if i == n - 1 else ('4' if j == 0 else '3')
            X = (x + ww) % W
            if g[y][X] in 'bm':
                g[y][X] = 'k'
    for x, y, rows in snow:
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch != '.':
                    g[y + dy][(x + dx) % W] = ch
    return g


DRIFT_S = ['.GF.', 'GFFF']
DRIFT_L = ['..GF..', '.GFFF.', 'GFFFFk']

#                0         1         2         3         4
#                012345678901234567890123456789012345678901234567
HOLE_S = ['.##', '###', '.#.']
HOLE_M = ['.###.', '#####', '.###.', '..#..']
FACE = {
    1: dict(
        beds=[(21, '222111000001111222211100000111222111000011122211')],
        foot='122321012332211012232110123321101223321012332210',
        bottom='dfhjkjhfedeghhgfghjlmmlkihgfeeffhjlnoonmkihgfeef',
        seeds=[(3, 6, 4), (9, 12, 3), (13, 5, 3), (19, 9, 4), (24, 15, 3), (28, 6, 3), (34, 11, 4), (39, 18, 2), (42, 6, 4), (46, 13, 3)],
        holes=[(20, 13, HOLE_S), (37, 9, HOLE_M)],
        glints=[(2, 5), (3, 7), (12, 5), (19, 7), (20, 8), (28, 5), (33, 9), (42, 5), (43, 7)],
        icicles=[(2, 6, 2), (6, 3, 1), (10, 9, 1), (14, 2, 1), (18, 5, 1), (25, 7, 2), (30, 3, 1), (33, 10, 1), (36, 4, 1), (41, 6, 2), (45, 2, 1)],
        snow=[(10, 28, DRIFT_S), (34, 27, DRIFT_L)],
    ),
    2: dict(
        beds=[(21, '111000011112222111000001111222111000111222111100')],
        foot='211232101233221012332101122332101233221012232110',
        bottom='ghjihfdcdfhkmnmkhfdcceghjkkjigecbcfhkmopomjgfdeg',
        seeds=[(2, 9, 3), (7, 5, 4), (12, 14, 2), (16, 7, 3), (21, 12, 4), (27, 5, 3), (31, 10, 3), (37, 15, 3), (41, 7, 4), (45, 12, 3)],
        holes=[(5, 10, HOLE_M), (28, 9, HOLE_S), (43, 6, HOLE_S)],
        glints=[(7, 4), (8, 6), (16, 5), (21, 9), (22, 11), (41, 5), (42, 7)],
        icicles=[(1, 8, 2), (5, 3, 1), (9, 2, 1), (12, 11, 1), (17, 5, 2), (22, 3, 1), (26, 7, 1), (30, 2, 1), (37, 12, 2), (40, 4, 1), (44, 6, 1)],
        snow=[(5, 28, DRIFT_S), (23, 27, DRIFT_L), (41, 28, DRIFT_S)],
    ),
}
CAPS = {   # 8 열 끝 마구리
    1: dict(L=dict(beds=[(21, '22211100')], foot='01223321', bottom='9bdfgfed', seeds=[(4, 6, 4)], holes=[], glints=[(3, 5)], icicles=[(4, 5, 1)], snow=[]),
            R=dict(beds=[(21, '00011122')], foot='12332210', bottom='fgfdca98', seeds=[(2, 7, 3)], holes=[], glints=[(1, 5)], icicles=[(2, 4, 1)], snow=[(4, 28, DRIFT_S)])),
    2: dict(L=dict(beds=[(21, '11100001')], foot='01233221', bottom='8acegfdc', seeds=[(4, 7, 3)], holes=[], glints=[(4, 5)], icicles=[(5, 6, 1)], snow=[]),
            R=dict(beds=[(21, '12221110')], foot='12332110', bottom='dfedb998', seeds=[(1, 6, 4)], holes=[], glints=[(1, 5)], icicles=[(1, 4, 1)], snow=[(3, 28, DRIFT_S)])),
}


def _round_cap(g, side):
    """끝 마구리 바깥: 처마는 귀가 둥글게(맨 바깥 열 위 2줄 = 윗면 귀 밑으로 투명이 아니라 바위 그늘), 밑은 바닥으로 깎인다."""
    W = len(g[0])
    xs = (0, 1) if side == 'L' else (W - 1, W - 2)
    for i, x in enumerate(xs):
        for y in range(28 - (2 - i) * 2, 32):
            if y >= 30 - i:
                g[y][x] = '0'
            elif g[y][x] not in '0':
                g[y][x] = 'k' if side == 'R' else ('b' if g[y][x] in '12345' else g[y][x])
    return g


def build(W, spec):
    g = rock_body(W, spec['beds'], spec['foot'])
    return ice_glaze(g, spec['bottom'], spec['seeds'], spec['glints'], spec['icicles'], spec['snow'], spec['holes'])


def face_parts(n):
    g = build(MW, FACE[n])
    for y in range(32):
        g[y][31] = g[y][47] = g[y][15]
    for y in range(32):
        assert g[y][15] == g[y][31] == g[y][47]
    caps = {s: _round_cap(build(8, CAPS[n][s]), s) for s in 'LR'}
    block = [caps['L'][y] + g[y][:16] + caps['R'][y] for y in range(32)]
    return rows_cv(g), dot.Face(rows_cv(block))


def rows_cv(g):
    cv = Cv(len(g[0]), 32)
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            cv.put(x, y, FACE_LEG[ch])
    return cv


def scene(n, actor=True):
    g = [r.replace('i', 'w') for r in R3.SCENE]
    mid, face = face_parts(n)
    cv = R3.render_scene(g, rock_top(n), mid, face, R1.ground(1), R1.ice_floor(1))
    fz = R1.frozen_tiles(1)
    for x, y, k in R3.FROZEN_AT:
        cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = fz[k].a
    if actor:
        cx, cy = R3.ACTOR_AT
        cv.paste(dot.Cv.of(dot.actor1_frame(1, 0, 0)), cx * T - 4, cy * T - 14)
    return cv, g


NOTES = {
    'A1': '「서리판」 — 고른 C2 바위 윗면(덩이·금·5단) 위 서리. 앞면 = 층 진 바위 + 위가 밝고 밑이 깊어지는 얇은 얼음 판 넷(덮음 ≈45%), 판 밑 고드름, 바닥 눈 더미',
    'A2': '「얼음 혀」 — 같은 윗면. 앞면 = 좁고 긴 얼음 판 여섯, 고드름 많음, 층 결 셋',
}


def cand(n):
    def fn():
        at = rock_top(n)
        mid, face = face_parts(n)
        v, g = scene(n)
        return hcat(a2_plus(at), face.b, mid), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': face}, 'face_mid': mid, 'vignette': v, 'grid': g,
            'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 윗면 A2(+몸통 변형) | 앞면 표본 32×32 | 가운데 덩이 48×32',
            'extras': [('윗면 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('벽 줄 9칸', R3.mid_run(mid, face, 9), 3),
                       ('홑칸 앞면', hcat(face.tile(0, True, True), face.tile(1, True, True)), 4), ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {'gap.ice_rock': {'A1': cand(1), 'A2': cand(2)}}
SCENE_LEAD = R3.SCENE_LEAD

"""edges-r1 — 가장자리 묶음 판. 항목 5(물·용암·얼음·낭떠러지·다리) × 줄 A·B·C × 후보 2 (A1 A2 B1 B2 C1 C2).

줄의 화풍 기준은 style-r1 의 그 글자 조각이다(바닥·벽 앞면·물가). cave-r1 은 아직 사람이 고르지 않았으므로 쓰지 않는다.
모든 화소는 이 파일의 행 문자열에서 오거나, style-r1 에서 손으로 찍은 조각을 자리만 옮기고 램프 단만 내린 것이다(손 도트).

  - 오토타일은 32×32 기호 **틀**(모서리·변) + 16×16 **안 모서리** + 16×16 **몸통**. 틀의 ',' 는 그 칸 자리의 줄 바닥(style-r1)
    화소, 대문자 결 기호(F 등)는 칸 좌표로 적은 16×16 결 표의 그 자리 화소다(fill) — 틀 조각이 칸 어디에 놓여도 결이 이어진다.
  - 물·용암은 4장면(런타임 animationStrips — openwiki/autotiles.md 「Ditch 는 47변형마다 가로 4프레임」, 몬스터 키트 물도 4).
    물가·용암 턱 화소는 네 장면이 같고, 장면마다 바뀌는 것은 물·용암 화소뿐이다(관문 A). 몸통 = 바탕 + 손으로 찍은 움직이는 획
    (획마다 4장면 그림을 따로 적는다).
  - 얼음은 정지 1 + 깨짐 3상태(dungeon-concepts-research 3b). 상태는 몸통 가운데만 바뀌고 칸 둘레 2px 는 같다(관문 K) —
    깨진 칸이 안 깨진 이웃과 이어진다. slideTiles 의 ice 는 칸 번호별이라 47칸 × 상태를 모두 등록해야 한다.
  - 낭떠러지는 3/4 시점에서 북쪽(먼 쪽) 가장자리 아래로 떨어지는 벽 앞면이 보이고, 남쪽(가까운 쪽)은 바닥 끝 턱만 보인다.
    앞면 결은 그 줄 style-r1 벽 앞면의 손 도트를 깊이(행)마다 램프 단을 내려 어둠으로 꺼지게 한 것이다(deepen).
    <줄>1 = A2 사분면 그대로 8px 앞면 · <줄>2 = 북쪽이 열린 칸은 아랫단까지 14px 로 이어지는 깊은 앞면(DeepAutotile).
  - 다리는 윗층(투명 + 그림자) 키트 — 가로(서끝·가운데·동끝) / 세로(북끝·가운데·남끝). 버들항 걸음 구조물 규약
    (openwiki/beodeul-city.md 「투명 낀 칸 = 윗층 우선 lower, 사람 아래, 통행 o」).
"""
import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import style_r1 as SR  # noqa: E402  줄 화풍 기준(바닥·앞면·물가 조각)
from cave_r1 import autotile_cv, frame, hcat, mirror_h, mirror_v, poly, shift, variants_sheet, check_frame  # noqa: E402  조립 도구만
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'edges'
T = 16
N, E, S, W = dot.N, dot.E, dot.S, dot.W
NFRAMES = 4


# ================================================================================================ 조립 도구
def tile_xy(fx, fy):
    """틀 좌표 → 그 화소가 놓이는 칸 좌표(사분면 규칙: 북·서 모서리 그대로, 변은 -8, 남·동 모서리는 -16)."""
    dx = 0 if fx < 8 else -16 if fx >= 24 else -8
    dy = 0 if fy < 8 else -16 if fy >= 24 else -8
    return (fx + dx) % 16, (fy + dy) % 16


def fill(frame_rows, inner_rows, leg, tex):
    """기호 틀·안 모서리 → Cv. tex = {글자: 칸 좌표 16×16 Cv} 는 칸 자리의 화소를 가져온다(',' = 줄 바닥 등)."""
    fr = Cv(32, 32)
    for y, r in enumerate(frame_rows):
        assert len(r) == 32, (y, r)
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            if ch in tex:
                tx, ty = tile_xy(x, y)
                fr.a[y, x] = tex[ch].a[ty, tx]
            else:
                fr.put(x, y, leg[ch])
    inn = Cv(16, 16)
    for y, r in enumerate(inner_rows):
        assert len(r) == 16, (y, r)
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            if ch in tex:
                inn.a[y, x] = tex[ch].a[y, x]
            else:
                inn.put(x, y, leg[ch])
    return fr, inn


def uni(strip):
    return [strip] * 16


def edge_frame(nw, n, w, s=None, e=None, ne=None, sw=None, se=None):
    """모서리 8×8 + 변 띠(바깥→안쪽 8글자, 16칸 같은 띠). 주지 않은 것은 뒤집어 쓴다."""
    s = s or n
    e = e or w
    ne = ne or mirror_h(nw)
    sw = sw or mirror_v(nw)
    se = se or mirror_h(sw)
    return frame(nw, ne, sw, se, uni(n), uni(s), uni(w), uni(e))


def inner4(nw, ne, sw, se):
    return [nw[y] + ne[y] for y in range(8)] + [sw[y] + se[y] for y in range(8)]


def lines16(rows, leg):
    return grid(rows, leg, 16, 16)


def ramp_of(rgb, ramp):
    r = dot.RAMPS[ramp]
    return r.index(rgb) if rgb in r else None


def deepen(cv, ramp, steps, void_from=0):
    """손 도트 cv 의 ramp 화소를 행마다 steps[y] 단 내린다(바닥 밑으로 멀어질수록 어둡게). 단이 0 밑으로 가면 어둠(void 2→1→0).
    다른 램프 화소는 그대로. 새 모양을 짓지 않는다 — 찍은 화소의 색 단만 바꾼다."""
    out = Cv(cv.w, cv.h)
    out.a[:] = cv.a
    vd = dot.RAMPS['void']
    for y in range(cv.h):
        d = steps[y] if y < len(steps) else steps[-1]
        if d == 0:
            continue
        for x in range(cv.w):
            p = cv.a[y, x]
            if p[3] == 0:
                continue
            t = ramp_of(tuple(int(v) for v in p[:3]), ramp)
            if t is None:
                continue
            nt = t - d
            out.a[y, x, :3] = dot.RAMPS[ramp][nt] if nt >= void_from else vd[max(0, len(vd) + nt - void_from)]
    return out


class DeepAutotile(dot.Autotile):
    """북쪽이 열린 칸(낭떠러지 먼 가장자리)은 몸통 대신 「깊은 몸통」(아랫단까지 이어지는 앞면을 깐 16×16)을 바탕으로 조립한다.
    마스크만의 함수라 엔진 47 변형 그대로 쓴다(사분면 조각은 그 위에 같은 규칙으로 얹힌다)."""

    def __init__(s, body, deep_body, edge, outer, inner, variants=()):
        super().__init__(body, edge, outer, inner, variants)
        s.deep_body = deep_body

    def tile(s, mask):
        if mask & N:
            return super().tile(mask)
        b = s.body
        s.body = s.deep_body
        try:
            return super().tile(mask)
        finally:
            s.body = b


def deep_autotile(body, deep_body, fr, inn):
    at = autotile_cv(body, fr, inn)
    return DeepAutotile(body, deep_body, at.edge, at.outer, at.inner)


def anim_set(make_body, frame_rows, inner_rows, leg, tex):
    """장면마다 몸통만 바뀌는 오토타일 4장 — 틀은 한 벌(물가 화소 동일)."""
    fr, inn = fill(frame_rows, inner_rows, leg, tex)
    return [autotile_cv(make_body(k), fr, inn) for k in range(NFRAMES)]


def movers(base_rows, leg, sprites, k):
    """바탕 몸통 + 움직이는 획. sprites = [(4장면 그림 [행 문자열…]×4, x, y, 위상)] — 장면 k 는 그림 (k+위상)%4 를 감아 찍는다."""
    cv = grid(base_rows, leg, 16, 16)
    for states, x, y, ph in sprites:
        SR.wrap2(cv, states[(k + ph) % NFRAMES], leg, x, y)
    return cv


def a2_frames(ats):
    """장면별 A2 32×48 을 옆으로."""
    return hcat(*[SR.a2_block(a) for a in ats])


# ------------------------------------------------------------------------------------------------ 줄 기준(style-r1)
CAVE = {}


def cave(line):
    if line not in CAVE:
        CAVE[line] = SR.CAVES[line]()
    return CAVE[line]


def floor_body(line):
    return cave(line)['floor'].body


def face_tex(line, y0):
    """줄 style-r1 앞면 표본(32×32)의 가운데 16칸 열을 y0 행부터 16행 — 낭떠러지 먼 벽 결."""
    f = cave(line)['face'].b
    out = Cv(16, 16)
    for y in range(16):
        out.a[y] = f.a[(y0 + y) % 32, 8:24]
    return out


FACE_RAMP = {'A': 'crock', 'B': 'crock', 'C': 'vrock'}


# ================================================================================================ 낭떠러지 (edges.chasm)
# 기호: ',' 줄 바닥 · 'L' 바닥 끝 밝은 턱 · 'D' 바닥 끝 윤곽 · 'F' 먼 벽 앞면 결 · '.' 몸통(어둠).
# 북(먼 쪽): 0 L · 1 D · 2~7 앞면(F). 남(가까운 쪽): 13 D · 14 L · 15 바닥. 서: 0·1 바닥 · 2 D. 동: 15·14 바닥 · 13 D.
CH_N = 'LDFFFFFF'
CH_S = ',LD.....'      # 바깥(15행) → 안쪽
CH_W = ',,D.....'
CH_NW = [',,,LLLLL', ',,LDDDDD', ',,DFFFFF', ',,DFFFFF', ',,DFFFFF', ',,DFFFFF', ',,DFFFFF', ',,DFFFFF']
CH_SW = [',,D.....', ',,D.....', ',,D.....', ',,D.....', ',,D.....', ',,DDDDDD', ',,,LLLLL', ',,,,,,,,']
CH_IN_NW = ['LLD.....', 'DDD.....', 'FFD.....', 'FFD.....', 'FFD.....', 'FFD.....', 'FFD.....', 'FFD.....']
CH_IN_SW = ['........'] * 5 + ['DDD.....', 'LLD.....', ',,D.....']
CH_FRAME = edge_frame(CH_NW, CH_N, CH_W, s=CH_S, sw=CH_SW)
CH_INNER = inner4(CH_IN_NW, mirror_h(CH_IN_NW), CH_IN_SW, mirror_h(CH_IN_SW))
# 사분면 경계 검사(check_frame)는 쓰지 않는다 — 북쪽 앞면(F)이 아랫단에서 어둠(몸통)·깊은 몸통으로 이어지는 것이 의도다.

# 줄별 턱 색(바닥 램프의 밝은 단 · 윤곽) — style-r1 바닥 바탕: A cfloor 2 · B cfloor 1 · C cata 3.
CH_LIP = {'A': (('cfloor', 7), ('cfloor', 0)), 'B': (('cfloor', 4), ('stone', 0)), 'C': (('cata', 6), ('vrock', 0))}
# 앞면 결을 가져오는 표본 행(벽 앞면 표본 32행 중) — 줄마다 돌이 잘 보이는 자리를 손으로 골랐다.
CH_FACE_Y0 = {'A': 9, 'B': 12, 'C': 1}
# 깊이: 행 → 내릴 단. 1 = 8px(2~7행) · 2 = 14px(2~13행, 깊은 몸통 8~13행).
CH_DEPTH = {1: [0, 0, 0, 0, 0, 1, 1, 2, 9, 9, 9, 9, 9, 9, 9, 9],
            2: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 5, 9, 9]}
VOID_BODY = [   # 어둠 몸통 — 아주 옅은 먼 바닥 결(void 1·2) 몇 점
    'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvuvvv', 'vvvvvvvvvvvvvvvv',
    'vvvvuvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvuvvvv',
    'vvvvvvvvvvvvvvvv', 'vuvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvv',
    'vvvvvvvutvvvvvvv', 'vvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvuv', 'vvvvvvvvvvvvvvvv']
LV = legend(v=('void', 0), u=('void', 1), t=('void', 2))


def chasm(line, n):
    (lr, lt), (dr, dt) = CH_LIP[line]
    leg = legend(L=(lr, lt), D=(dr, dt))
    face = deepen(face_tex(line, CH_FACE_Y0[line] - 2), FACE_RAMP[line], CH_DEPTH[n])
    tex = {',': floor_body(line), 'F': face}
    fr, inn = fill(CH_FRAME, CH_INNER, leg, tex)
    body = grid(VOID_BODY, LV)
    if n == 1:
        return autotile_cv(body, fr, inn)
    deep = Cv(16, 16)
    deep.a[:] = body.a
    deep.a[8:14] = face.a[8:14]
    return deep_autotile(body, deep, fr, inn)


# ================================================================================================ 장면 렌더
def render(g, line, layers, objects=()):
    """g: '#' 바위 · '.' 바닥 · 그 밖의 글자 = layers[글자] 오토타일(그 글자끼리 이어짐). 바위·바닥은 줄 style-r1 조각.
    objects = [(Cv, 화소 x, 화소 y)] 윗층(다리·사람)."""
    c = cave(line)
    cv = dot.render_cave(g, c['ceil'], c['face'], c['floor'])
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch in layers:
                m = dot.mask_at(g, x, y, lambda cc, X, Y, ch=ch: cc == ch)
                cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = layers[ch].tile_at(m, x, y).a
    for o, x, y in objects:
        cv.paste(o, x, y)
    return cv


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def at_cell(cx, cy):
    """Actor1 을 칸 (cx, cy) 에 세우는 화소 자리(발이 칸 아래쪽)."""
    return cx * T - 4, cy * T - 14


# ================================================================================================ 물 (edges.water)
# 물가(틀·안 모서리)는 style-r1 의 그 줄 물가 그대로(사람이 줄마다 고른 화법). 장면마다 몸통의 물결 획만 움직인다.
# 획 = style-r1 물 몸통에 손으로 찍힌 바탕 아닌 글자의 가로 줄(strokes 가 그 자리를 읽는다 — 새 획을 짓지 않는다).
WATER = {'A': (SR.WA_BODY, SR.WA_FRAME, SR.WA_INNER, SR.LWA),
         'B': (SR.WB_BODY, SR.WB_FRAME, SR.WB_INNER, SR.LWB),
         'C': (SR.WC_BODY, SR.WC_FRAME, SR.WC_INNER, SR.LWC)}
LIQUID = {'A': ['water'], 'B': ['pool'], 'C': ['water']}


def strokes(rows, base='b'):
    """몸통 행에서 바탕이 아닌 가로 줄 [(x, y, 글자열)]. 칸 오른끝에서 왼끝으로 감겨 이어진 획은 한 획으로 읽는다
    (둘로 읽으면 두 반쪽이 다른 박자로 움직여 칸 경계에 이음이 생긴다)."""
    out = []
    w = len(rows[0])
    for y, r in enumerate(rows):
        if base not in r:
            continue
        s0 = r.index(base)            # 바탕 한 칸에서 시작해 한 바퀴 돈다
        x = 0
        while x < w:
            i = (s0 + x) % w
            if r[i] != base:
                n = 0
                while n < w and r[(i + n) % w] == r[i]:
                    n += 1
                out.append((i, y, r[i] * n))
                x += n
            else:
                x += 1
    return out


# B·C 물은 style-r1 몸통 획이 드물어(고인 물) 움직임이 거의 안 보인다 — 장면용 획을 손으로 몇 개 더 둔다(바탕 몸통은 그대로).
WATER_EXTRA = {'B': [(6, 1, 'cc'), (10, 7, 'dd'), (11, 13, 'cc'), (1, 10, 'c')],
               'C': [(6, 1, 'cc'), (12, 7, 'dd'), (5, 14, 'cc'), (14, 11, 'c')]}
# 획마다 위상(손으로 적은 순서 — 이웃 획이 같이 움직이지 않게)
PHASES = [0, 2, 1, 3, 3, 1, 0, 2, 2, 0, 3, 1, 1, 3, 2, 0, 0, 2, 1, 3]
FLOW = [0, 1, 2, 1]          # <줄>1 흐름: 획이 오른쪽으로 0→1→2→1 px 밀렸다 돌아온다(한 바퀴가 끊김 없이 이어진다)


def flow_states(s):
    return [['.' * d + s] for d in FLOW]


# <줄>2 반짝임: 밝은 획은 제자리에서 밝아졌다(가운데 한 단 위) → 짧아졌다 → 사라졌다 돌아온다. 어두운 획(물결 골)은 반 박자 늦게 한 칸 옮긴다.
BRIGHTER = {'c': 'd', 'd': 'e', 'a': 'a', 'e': 'e'}


def glint_states(s, dark):
    n = len(s)
    if dark:
        return [[s], [s], ['.' + s], ['.' + s]]
    mid = s[:n // 2] + BRIGHTER[s[0]] + s[n // 2 + 1:] if n >= 2 else BRIGHTER[s[0]]
    short = ('.' + s[1:]) if n >= 2 else s
    return [[s], [mid], [short], ['b' * n]]


def water(line, n):
    body, fr_rows, inn_rows, leg = WATER[line]
    base = ['b' * 16] * 16
    st = strokes(body) + WATER_EXTRA.get(line, [])
    dark = {'a'}
    sprites = []
    for i, (x, y, s) in enumerate(st):
        ph = PHASES[i % len(PHASES)]
        sprites.append((flow_states(s) if n == 1 else glint_states(s, s[0] in dark), x, y, ph))
    fr, inn = fill(fr_rows, inn_rows, leg, {})
    return [autotile_cv(movers(base, leg, sprites, k), fr, inn) for k in range(NFRAMES)]


# ================================================================================================ 용암 (edges.lava) — 줄 B·C (A 는 뺌: 시드 lines.A.skip)
# 「검은 화산암 턱 + 빛나는 가장자리」. 기호: ',' 바닥 · 'L' 바닥 끝 턱 · 'R' 턱 바위 앞면 결 · 'K' 화산암 윤곽(vrock 0)
# · 'Q' 빛 받는 턱 윗면(vrock 2) · 'G' 용암이 바위에 닿아 가장 밝은 줄(lava 3).
# 북(먼 쪽): 0 L · 1~5 바위 앞면(R, 아래 두 줄 한 단 어둡게) · 6 G. 서·동·남: 바닥 · K · Q · G(밝은 줄은 1px — 두꺼우면 액자처럼 보인다).
LV_N = 'LRRRRRG.'
LV_W = ',KQG....'
LV_NW = [',,LLLLLL', ',KRRRRRR', ',KRRRRRR', ',KRRRRRR', ',KRRRRRR', ',KQRRRRR', ',KQGGGGG', ',KQG....']
LV_SW = [',KQG....', ',KQG....', ',KQG....', ',KQG....', ',KQGGGGG', ',KQQQQQQ', ',,KKKKKK', ',,,,,,,,']
LV_IN_NW = [',KQG....', 'RKQG....', 'RRQG....', 'RRQG....', 'RRQG....', 'RRQG....', 'GGGG....', '........']
LV_IN_SW = ['........', '........', '........', '........', 'G.......', 'QG......', 'KQG.....', ',KQG....']
LV_FRAME = edge_frame(LV_NW, LV_N, LV_W, s=LV_W, sw=LV_SW)
LV_INNER = inner4(LV_IN_NW, mirror_h(LV_IN_NW), LV_IN_SW, mirror_h(LV_IN_SW))
check_frame('용암 틀', LV_FRAME, LV_INNER, strict_inner=False)
LV_LEG = legend(K=('vrock', 0), Q=('vrock', 3), G=('lava', 3))
# B 의 턱 바위는 style-r1 B 바윗덩이 앞면(crock)을 화산암 램프로 옮겨 칠한 것(단 대응은 손으로 정함), C 는 C 층리 앞면 그대로.
CROCK_TO_VROCK = {0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4}


def recolor(cv, src, dst, table):
    out = Cv(cv.w, cv.h)
    out.a[:] = cv.a
    for y in range(cv.h):
        for x in range(cv.w):
            t = ramp_of(tuple(int(v) for v in cv.a[y, x, :3]), src)
            if t is not None and cv.a[y, x, 3]:
                out.a[y, x, :3] = dot.RAMPS[dst][table[t]]
    return out


def lava_rock(line):
    f = face_tex(line, {'B': 1, 'C': 7}[line])
    if line == 'B':
        f = recolor(f, 'crock', 'vrock', CROCK_TO_VROCK)
    return deepen(f, 'vrock', [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])


LL = legend(a=('lava', 0), b=('lava', 1), c=('lava', 2), d=('lava', 3), k=('vrock', 0), m=('vrock', 1))
# 굳은 껍질 판 + 빛나는 금. 금은 손으로 고른 꼭짓점을 잇는다(16 주기로 감겨 칸 경계를 건너도 이어진다).
CRUST_B = ['aaaaaaaaaaaaaaaa', 'aakaaaaaaaaakaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaakaaaaaa',
           'aaaaaaaaaaaaaaaa', 'akaaaaaaaaaaaaka', 'aaaaaaaaaaaaaaaa', 'aaaakaaaaaaaaaaa',
           'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaakaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa',
           'aaakaaaaaaaaaaaa', 'aaaaaaaaaaaaakaa', 'aaaaaaaakaaaaaaa', 'aaaaaaaaaaaaaaaa']
CRACKS_B = [[(0, 4), (4, 3), (7, 5), (11, 4), (15, 5)],
            [(6, 0), (7, 5)], [(7, 5), (6, 9), (8, 12), (6, 15)],
            [(6, 9), (10, 10), (13, 9), (17, 11)], [(1, 11), (3, 9), (6, 9)]]
CRUST_C = ['kkkmkkkkkkkkmkkk', 'kmkkkkkkkkkkkkkk', 'kkkkkkkmkkkkkkkk', 'kkkkkkkkkkkkkkmk',
           'kkmkkkkkkkkkkkkk', 'kkkkkkkkkkmkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkmkkkkkkkkkk',
           'kkkkkkkkkkkkkkkk', 'kmkkkkkkkkkkkmkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkmkkkkkkk',
           'kkkkkkkkkkkkkkkk', 'kkkmkkkkkkkkkkkk', 'kkkkkkkkkkkkkkmk', 'kkkkkkkkkkkkkkkk']
CRACKS_C = [[(0, 2), (3, 2), (5, 4), (9, 3), (12, 1), (15, 2)],
            [(5, 4), (4, 8), (1, 10), (-1, 11)], [(4, 8), (8, 9), (11, 7), (12, 1)],
            [(8, 9), (9, 13), (12, 15), (13, 18)], [(9, 13), (5, 14), (3, 18)], [(11, 7), (15, 9), (16, 10)]]


# 금이 칸 경계를 비스듬히 여럿 건너면 칸 격자가 드러난다 — B 는 금 그물을 오른쪽으로 3칸 밀어 경계가 금 사이 판을 지나게 한다.
CRUST_SHIFT = {'B': 3, 'C': 0}


def crack_pts(paths):
    pts = []
    for p in paths:
        for x, y in poly(*p):
            q = (x % 16, y % 16)
            if q not in pts:
                pts.append(q)
    return pts


def crust_body(base, paths, k, hot='d', vein='c', halo='b', roll=0):
    """껍질 판 몸통 장면 k: 금(vein) + 금 양옆 달아오른 테(halo) + 금을 따라 흐르는 빛(hot, 4칸마다 한 점이 한 칸씩 나아간다)."""
    g = [list(r) for r in base]
    pts = crack_pts(paths)
    P = set(pts)
    for x, y in pts:
        g[y][x] = vein
    for x, y in pts:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            X, Y = (x + dx) % 16, (y + dy) % 16
            if (X, Y) not in P:
                g[Y][X] = halo
    for i, (x, y) in enumerate(pts):
        if i % 4 == k:
            g[y][x] = hot
    cv = grid([''.join(r) for r in g], LL)
    return shift(cv, roll, 0) if roll else cv


# 녹은 용암: 바탕 + 손으로 찍은 물결 획(흐름 0→1→2→1) + 껍질 조각 + 거품(4장면: 점 → 부풂 → 터진 고리 → 식은 자국).
MOLTEN = {'B': ['b' * 16] * 16, 'C': ['c' * 16] * 16}
MOLTEN_STROKES = {'B': [(1, 1, 'ccc'), (9, 3, 'cc'), (4, 6, 'cccc'), (12, 9, 'ccc'), (2, 12, 'cc'), (8, 14, 'ccc'),
                        (6, 2, 'aa'), (13, 6, 'a'), (0, 9, 'aaa'), (10, 12, 'aa')],
                  'C': [(1, 1, 'ddd'), (9, 3, 'dd'), (4, 6, 'dddd'), (12, 9, 'ddd'), (2, 12, 'dd'), (8, 14, 'ddd'),
                        (6, 2, 'bb'), (13, 6, 'b'), (0, 9, 'bbb'), (10, 12, 'bb')]}
BUBBLE = {'B': [['c'], ['.c.', 'cdc', '.c.'], ['.d.', 'd.d', '.d.'], ['a.a', '...', 'a.a']],
          'C': [['d'], ['.d.', 'ddd', '.d.'], ['.d.', 'd.d', '.d.'], ['b.b', '...', 'b.b']]}
BUBBLES = [(5, 9, 0), (12, 2, 2), (13, 13, 1)]


def molten_body(line, k):
    sprites = [(flow_states(s), x, y, PHASES[i]) for i, (x, y, s) in enumerate(MOLTEN_STROKES[line])]
    sprites += [(BUBBLE[line], x - 1, y - 1, ph) for x, y, ph in BUBBLES]
    return movers(MOLTEN[line], LL, sprites, k)


def lava(line, n):
    lip_r, lip_t = CH_LIP[line][0]
    leg = dict(LV_LEG, L=dot.C(lip_r, lip_t))
    tex = {',': floor_body(line), 'R': lava_rock(line)}
    if n == 1:
        base, paths = (CRUST_B, CRACKS_B) if line == 'B' else (CRUST_C, CRACKS_C)
        mk = lambda k: crust_body(base, paths, k, roll=CRUST_SHIFT[line])  # noqa: E731
    else:
        mk = lambda k: molten_body(line, k)  # noqa: E731
    return anim_set(mk, LV_FRAME, LV_INNER, leg, tex)


# ================================================================================================ 얼음판 (edges.ice) — 줄 A·B·C 공통 재료(연구 문서 2a)
# 바닥 위로 살짝 솟은 얼음판. 색은 설원 얼음(ice 램프) 그대로. 기호: ',' 줄 바닥 · 'o' 얼음판 윤곽(줄의 어두운 색)
# · 'h' 빛 받는 북·서 가장자리(ice 4) · 'k' 그늘진 동 가장자리(ice 1) · 'g' 'f' 남쪽 두께 앞면 2px(ice 1 · ice 0)
# · 'z' 판이 바닥에 드리운 그늘(바닥 램프 어두운 단 — 아래층이라 반투명을 쓰지 않는다).
IC_N = ',oh.....'
IC_E = 'zok.....'
IC_S = 'zofg....'
IC_NW = [',,,,,,,,', ',,,ooooo', ',,ohhhhh', ',oh.....', ',oh.....', ',oh.....', ',oh.....', ',oh.....']
IC_NE = [',,,,,,,,', 'oooooo,,', 'hhhhhko,', '.....koz', '.....koz', '.....koz', '.....koz', '.....koz']
IC_SW = [',oh.....', ',oh.....', ',oh.....', ',oh.....', ',ogggggg', ',offffff', ',,oooooo', ',,,zzzzz']
IC_SE = ['.....koz', '.....koz', '.....koz', '.....koz', 'ggggggoz', 'ffffffoz', 'oooooooz', 'zzzzzzz,']
IC_IN_NW = [',oh.....', 'ooh.....', 'hhh.....'] + ['........'] * 5
IC_IN_NE = ['.....koz', '.....koo', '.....khh'] + ['........'] * 5
IC_IN_SW = ['........'] * 4 + ['go......', 'fo......', 'ooh.....', ',oh.....']
IC_IN_SE = ['........'] * 4 + ['......og', '......of', '.....koo', '.....koz']
IC_FRAME = frame(IC_NW, IC_NE, IC_SW, IC_SE, uni(IC_N), uni(IC_S), uni(IC_N), uni(IC_E))
IC_INNER = inner4(IC_IN_NW, IC_IN_NE, IC_IN_SW, IC_IN_SE)
check_frame('얼음 틀', IC_FRAME, IC_INNER, strict_inner=False)
IC_LINE = {'A': dict(o=('cfloor', 0), z=('cfloor', 1)), 'B': dict(o=('stone', 0), z=('cfloor', 0)),
           'C': dict(o=('vrock', 0), z=('cata', 1))}
LI = legend(h=('ice', 4), k=('ice', 1), g=('ice', 1), f=('ice', 0), w=('water', 0), x=('water', 1),
            **{str(i): ('ice', i) for i in range(5)})
ICE_BODY = {
    1: [   # 맑은 얼음 — 비스듬한 반사 획(4·3)과 옅은 결(1)
        '2222222222222222', '2222222222222342', '2232222222223422', '2234222222234222',
        '2342222222242222', '2422222222222222', '2222222222221122', '2222222222211222',
        '2222222222222222', '2221122222222222', '2211222222222322', '2222222222223422',
        '2222222322234222', '2222223422242222', '2222234222222222', '2222222222222222'],
    2: [   # 서리 낀 얼음 — 밝은 바탕(3), 서리 덩이(4), 갇힌 거품 고리(2)
        '3333333333333333', '3344333333333333', '3444433333332333', '3344333333323233',
        '3333333333332333', '3333333233333333', '3333332323333333', '3333333233333443',
        '3333333333334443', '3233333333333433', '3323333333333333', '3332333334433333',
        '3333333344443333', '3333323334433333', '3333232333333333', '3333323333333333'],
}
# 깨짐 3상태 — 칸 가운데(둘레 2px 밖)만 그린다. 금 = 0(ice 0) + 금 아래·오른쪽 빛 4. 깨진 구멍은 북쪽 벽에 얼음 두께(g f)가 보이고 그 밑이 물.
ICE_CRACK = [
    (5, 5, ['..0....', '..40...', '...400.', '.004...', '.4..0..', '.....4.']),
    (3, 3, ['..0........', '..40....0..', '...40..04..', '....4004...', '0000.40....', '4444.04000.',
            '....04.4440', '...04.0....', '..04..40...', '..4....4...']),
    (3, 3, ['...0000....', '..0gggg00..', '.0gffffgg0.', '0gfwwwwff0.', '0fwwxwwww0.', '0wwwwwxw0..',
            '.0wxwwww0..', '..00ww00.0.', '.4..00..04.', '........4..']),
]


def ice(line, n):
    leg = dict(LI, **legend(**IC_LINE[line]))
    fr, inn = fill(IC_FRAME, IC_INNER, leg, {',': floor_body(line)})
    out = []
    for st in range(4):
        body = grid(ICE_BODY[n], leg)
        if st:
            x, y, rows = ICE_CRACK[st - 1]
            stamp(body, rows, leg, x, y)
        out.append(autotile_cv(body, fr, inn))
    return out


# ================================================================================================ 다리 (edges.bridge) — 윗층 키트(투명 + 그림자 '~')
# 가로 다리(동서로 건넘): 상판 윗면 + 남쪽 앞면(두께) + 아래(남쪽) 그림자. 세로 다리(남북): 상판 윗면 + 동쪽 그림자(빛이 왼쪽 위).
# 세로 다리 북끝은 먼 둑 앞면을 가리고(다리가 앞에 있다), 남끝은 가까운 둑과 같은 높이라 두께가 보이지 않는다.
# 끝 조각 = 가운데 조각 + 손으로 찍은 기둥·말뚝(가로 서끝 기둥을 좌우로 뒤집어 동끝).
# roll = (가로 가운데 열, 세로 가운데 행)을 감아 미는 칸 수 — 널 틈·판돌 이음이 칸 경계에 겹치면 칸 격자가 드러나서 안쪽으로 옮긴다.
LW = legend(W=('wood', 0), X=('wood', 1), Y=('wood', 2), Z=('wood', 3), U=('wood', 4), T=('wood', 5),
            R=('bone', 2), S=('bone', 3), I=('iron', 1), J=('iron', 4))
BRIDGE = {}
BRIDGE[('A', 1)] = dict(   # 밧줄 널다리 — 널 3px + 틈, 남북 가장자리 밧줄
    leg=LW, roll=(2, 2),
    h=['................', '................', '................', 'WWWWWWWWWWWWWWWW', 'RSRSRSRSRSRSRSRS',
       'TTTWTTTWTTTWTTTW', 'UUUWUUZWUUUWUZUW', 'UZUWUUUWUZUWUUUW', 'ZZZWZZZWZZZWZZZW', 'RSRSRSRSRSRSRSRS',
       'XXXWXXXWXXXWXXXW', 'WWWWWWWWWWWWWWWW', '~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~', '................',
       '................'],
    h_post=['WW.', 'TU.', 'TU.', 'TUW', 'TUR', 'XXW', 'WWW', 'TUW', 'TUW', 'TUR', 'XXW', 'WWW', '~~~'],
    v=['.RWTTTTTTTTTTWR~', '.SWUUUUZUUUUUWS~', '.RWZZZZZZZZZZWR~', '.SWWWWWWWWWWWWS~',
       '.RWTTTTTTTTTTWR~', '.SWUUZUUUUUUZWS~', '.RWZZZZZZZZZZWR~', '.SWWWWWWWWWWWWS~',
       '.RWTTTTTTTTTTWR~', '.SWUUUUUUZUUUWS~', '.RWZZZZZZZZZZWR~', '.SWWWWWWWWWWWWS~',
       '.RWTTTTTTTTTTWR~', '.SWUZUUUUUUUUWS~', '.RWZZZZZZZZZZWR~', '.SWWWWWWWWWWWWS~'],
    v_n=['WW............WW', 'TU............TU', 'TU............TU', 'XX............XX'],
    v_s=['WW............WW', 'TU............TU', 'TU............TU', 'XX............XX'],
)
BRIDGE[('A', 2)] = dict(   # 통나무 다리 — 통나무 둘(가로) / 셋(세로)을 밧줄로 묶음, 남끝에 통나무 단면
    leg=LW,
    h=['................', '................', '................', 'WWWWWWWWWWWWWWWW', 'TTTTTUTTTTTTTRTT',
       'UUZUUUUUUZUUURUU', 'XXXXXXZXXXXXXSXX', 'WWWWWWWWWWWWWRWW', 'TTTUTTTTTTTUTSTT', 'UUUUUZUUUUUUURUU',
       'XXXXXXXXXZXXXSXX', 'WWWWWWWWWWWWWWWW', '~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~', '................',
       '................'],
    h_post=['...', '...', '...', '.WW', 'WUZ', 'WZU', '.WW', '.WW', 'WUZ', 'WZU', '.WW', '...', '...'],
    v=['..WTUXWTUXWTUXW~', '..WTUXWTUZWTUXW~', '..WTUXWTUXWTUXW~', '..WTZXWTUXWTUXW~',
       '..WTUXWTUXWTUXW~', '..WTUXWTUXWZUXW~', '..WTUXWTUXWTUXW~', '..RSRSRSRSRSRSR~',
       '..SRSRSRSRSRSRS~', '..WTUXWTUXWTUXW~', '..WTUXWZUXWTUXW~', '..WTUXWTUXWTUXW~',
       '..WTUXWTUXWTUZW~', '..WTUXWTUXWTUXW~', '..WTZXWTUXWTUXW~', '..WTUXWTUXWTUXW~'],
    v_n=[],
    v_s=['..WUUWWUUWWUUW~~', '..UZZUUZZUUZZU~~', '..WUUWWUUWWUUW~~'],
)
BRIDGE[('B', 1)] = dict(   # 갱도 목재 다리 — 굵은 널 + 쇠 볼트 박은 옆 들보, 쇠띠 감은 기둥
    leg=LW, roll=(0, 2),
    h=['................', '................', '................', 'WWWWWWWWWWWWWWWW', 'YYYJYYYYYYYJYYYY',
       'WWWWWWWWWWWWWWWW', 'ZZZZWZZZZZZZWZZZ', 'YYZYWYYYYZYYWYYY', 'YYYYWYYZYYYYWYZY', 'WWWWWWWWWWWWWWWW',
       'YYYJYYYYYYYJYYYY', 'XXXXXXXXXXXXXXXX', 'WWWWWWWWWWWWWWWW', '~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~',
       '................'],
    h_post=['WWW', 'YZW', 'IJW', 'YZW', 'YZW', 'IJW', 'YZW', 'YZW', 'IJW', 'YZW', 'YZW', 'XXW', 'WWW', '~~~'],
    v=['..WYJWZZZZZZWJYW', '..WYYWYYZYYYWYYW', '..WYYWYYYYYZWYYW', '..WYYWWWWWWWWYYW',
       '..WYYWZZZZZZWYYW', '..WYYWYZYYYYWYYW', '..WYYWYYYYZYWYYW', '..WYYWWWWWWWWYYW',
       '..WYJWZZZZZZWJYW', '..WYYWYYYZYYWYYW', '..WYYWYZYYYYWYYW', '..WYYWWWWWWWWYYW',
       '..WYYWZZZZZZWYYW', '..WYYWYYYYYYWYYW', '..WYYWYYZYYYWYYW', '..WYYWWWWWWWWYYW'],
    v_n=['.WWW......WWW', '.YZW......YZW', '.IJW......IJW', '.XXW......XXW'],
    v_s=['.WWW......WWW', '.YZW......YZW', '.IJW......IJW', '.XXW......XXW'],
)
LST = legend(o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), h=('stone', 5))
BRIDGE[('B', 2)] = dict(   # 돌판 다리 — 8px 판돌, 판 사이 이음 o, 남쪽 두께 2줄
    leg=LST, roll=(4, 4),
    h=['................', '................', '................', 'oooooooooooooooo', 'hhhhhhhohhhhhhho',
       'srsssrsossrsssso', 'ssssrssosssssrso', 'srssssrossssrsso', 'qqqqqqqoqqqqqqqo', 'pppppppppppppppp',
       'pqppppqppppqpppp', 'oooooooooooooooo', '~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~', '................',
       '................'],
    h_post=['...', '...', 'oo.', 'hso', 'sro', 'rqo', 'oo.', '...', '...', '...', '...', '...', '...'],
    v=['..ohsssrsssssqo~', '..ohsrsssssrsqo~', '..ohssssrssssqo~', '..ohssssssrssqo~',
       '..ohsrssssssrqo~', '..ohsssssrsssqo~', '..ohssrssssssqo~', '..oooooooooooo~~',
       '..ohsssssrsssqo~', '..ohssrssssssqo~', '..ohsssssssrsqo~', '..ohsrsssssssqo~',
       '..ohssssrssssqo~', '..ohsssssssrsqo~', '..ohsrsssssssqo~', '..oooooooooooo~~'],
    v_n=['.oo.........oo.', 'ohso.......ohso', 'orqo.......orqo', '.oo.........oo.'],
    v_s=['.oo.........oo.', 'ohso.......ohso', 'orqo.......orqo', '.oo.........oo.'],
)
LVR = legend(**{str(i): ('vrock', i) for i in range(5)}, g=('glow', 1), G=('glow', 5), c=('cata', 6))
BRIDGE[('C', 1)] = dict(   # 옛 화산암 다리 — 깎은 테두리(밝은 턱 4·그늘 1), 가운데 층결, 남쪽 두께에 층 줄
    leg=LVR,
    h=['................', '................', '................', '0000000000000000', '4444444444444444',
       '1111111111111111', '3323333233333323', '3333233333323333', '2222222222222222', '0000000000000000',
       '2122212221222122', '1111111111111111', '0000000000000000', '~~~~~~~~~~~~~~~~', '~~~~~~~~~~~~~~~~',
       '................'],
    h_post=['...', '000', '044', '043', '043', '043', '043', '043', '022', '000', '021', '011', '000', '~~~'],
    v=['..04133323332310', '..04133233333210', '..04133333323310', '..04132333333210',
       '..04133333233310', '..04133323333210', '..04133333333210', '..04132333323310',
       '..04133333333210', '..04133233333310', '..04133333233210', '..04133323333310',
       '..04132333333210', '..04133333323310', '..04133333333210', '..04133332333210'],
    v_n=['..000000000000.', '..044444444440.'],
    v_s=['..000000000000.', '..022222222220.', '..021222122210.', '..000000000000.'],
)
BRIDGE[('C', 2)] = dict(   # 판석 다리 + 청록 빛 홈 — 가운데 빛줄(glow), 양끝 빛 박힌 기둥돌
    leg=legend(**{str(i): ('cata', i) for i in range(7)}, g=('glow', 1), G=('glow', 5), k=('vrock', 0)),
    h=['................', '................', '................', 'kkkkkkkkkkkkkkkk', '6666666666666666',
       '5545555545555545', '4444444444444444', 'gGggggGggggggGgg', '4444444444444444', '3343333433343333',
       'kkkkkkkkkkkkkkkk', '2222222222222222', '1121112111211121', 'kkkkkkkkkkkkkkkk', '~~~~~~~~~~~~~~~~',
       '~~~~~~~~~~~~~~~~'],
    h_post=['.kk', 'k66', 'k65', 'k55', 'kG5', 'k55', 'k44', 'k33', 'k33', 'kkk', 'k21', 'k11', 'kkk', '~~~'],
    v=['..k6554g4433k~~.', '..k6544g4443k~~.', '..k6554G4433k~~.', '..k6554g4343k~~.',
       '..k6544g4433k~~.', '..k6554g4433k~~.', '..k6554g4443k~~.', '..k6544G4433k~~.',
       '..k6554g4433k~~.', '..k6554g4343k~~.', '..k6544g4433k~~.', '..k6554g4433k~~.',
       '..k6554G4443k~~.', '..k6544g4433k~~.', '..k6554g4433k~~.', '..k6554g4343k~~.'],
    v_n=['.kkk.......kkk.', 'k665k.....k665k', 'k5G5k.....k5G5k', 'k443k.....k443k', '.kkk.......kkk.'],
    v_s=['.kkk.......kkk.', 'k665k.....k665k', 'k5G5k.....k5G5k', 'k443k.....k443k', '.kkk.......kkk.'],
)


def bridge(line, n):
    """→ {'h': [서끝, 가운데, 동끝], 'v': [북끝, 가운데, 남끝]} (16×16 Cv, 투명 + 그림자)."""
    d = BRIDGE[(line, n)]
    leg = d['leg']
    hm = shift(grid(d['h'], leg, 16, 16), d.get('roll', (0, 0))[0], 0)
    vm = shift(grid(d['v'], leg, 16, 16), 0, d.get('roll', (0, 0))[1])

    def with_(base, rows, x, y):
        cv = Cv(16, 16)
        cv.a[:] = base.a
        if rows:
            w = max(len(r) for r in rows)
            stamp(cv, [r.ljust(w, '.') for r in rows], leg, x, y)
        return cv
    hw = with_(hm, d['h_post'], 0, 0)
    he = with_(hm, mirror_h(d['h_post']), 16 - len(d['h_post'][0]), 0)
    vn = with_(vm, d['v_n'], 0, 0)
    vs = with_(vm, d['v_s'], 0, 16 - len(d['v_s']))
    return {'h': [hw, hm, he], 'v': [vn, vm, vs]}


def kit_sheet(k):
    """후보 원본 64×48: 둘째 줄에 가로 서끝·가운데·동끝, 오른쪽 열에 세로 북끝·가운데·남끝."""
    cv = Cv(64, 48)
    for i, p in enumerate(k['h']):
        cv.paste(p, i * 16, 16)
    for i, p in enumerate(k['v']):
        cv.paste(p, 48, i * 16)
    return cv


def place_h(k, x0, x1, y):
    """가로 다리를 칸 x0..x1(양끝 포함), 행 y 에."""
    return [(k['h'][0 if x == x0 else 2 if x == x1 else 1], x * T, y * T) for x in range(x0, x1 + 1)]


def place_v(k, x, y0, y1):
    return [(k['v'][0 if y == y0 else 2 if y == y1 else 1], x * T, y * T) for y in range(y0, y1 + 1)]


# ================================================================================================ 후보·장면
POOL_GRID = SR.POOL_GRID   # style-r1 물 장면과 같은 웅덩이(바깥/안 모서리·한 칸 혹)
CHASM_GRID = ['##########', '##########', '##########', '#........#', '#.cccc...#', '#.cccccc.#', '#..cc.cc.#',
              '#..c.....#', '#........#', '##########']
ICE_GRID = ['##########', '##########', '##########', '#........#', '#..iii...#', '#.iiiiii.#', '#..ii.ii.#',
            '#..i.....#', '#........#', '##########']
ICE_STATE_CELLS = [(3, 5), (4, 5), (5, 5)]   # 깨짐 1·2·3 상태를 놓은 칸
BRIDGE_GRID = ['############', '############', '############', '#..........#', '#.cccc.www.#', '#.cccc.www.#',
               '#.cccc.www.#', '#..........#', '############']
# 줄별 장면 8×6 두 장 — α: 물 + 가로 다리 + 얼음판 / β: 낭떠러지 + 세로 다리 + 용암(줄 A 는 용암 대신 얼음판)
SCENE_A = ['###.iii.', '###.iii.', '###.....', '...wwww.', '...wwww.', '........']
SCENE_B = ['##......', '##...LLL', '##...LLL', '..ccc...', '..ccc...', '........']


def layers_at(line, n, k=0):
    """장면 k 의 오토타일 묶음(용암 없는 줄은 L 자리에 얼음판)."""
    ly = {'w': water(line, n)[k], 'c': chasm(line, n), 'i': ice(line, n)[0]}
    ly['L'] = lava(line, n)[k] if not skip_lava(line) else ly['i']
    return ly


def skip_lava(line):
    return (line, 'edges.lava') in SKIP


def scene_frames(line, n, which):
    k_ = bridge(line, n)
    out = []
    for k in range(NFRAMES):
        ly = layers_at(line, n, k)
        if which == 'a':
            objs = place_h(k_, 3, 6, 4) + [(actor_cv(),) + at_cell(5, 4)]
            out.append(render(SCENE_A, line, ly, objs))
        else:
            objs = place_v(k_, 3, 3, 4) + [(actor_cv(),) + at_cell(6, 4)]
            out.append(render(SCENE_B, line, ly, objs))
    return out


def body_strip(ats, k=1):
    return hcat(*[a.body for a in ats])


def cand_water(line, n):
    def fn():
        fs = water(line, n)
        anim = [render(POOL_GRID, line, {'w': f}) for f in fs]
        return a2_frames(fs), {'kind': 'autotile', 'autotiles': {'water': fs[0]}, 'frames': {'water': fs},
                               'liquid': LIQUID[line], 'vignette': anim[0], 'anim': anim,
                               'extras': [('몸통 4장면', body_strip(fs), 4), ('47 변형(장면 1)', variants_sheet(fs[0]), 2)]}
    return fn


def cand_lava(line, n):
    def fn():
        fs = lava(line, n)
        g = [r.replace('w', 'l') for r in POOL_GRID]
        anim = [render(g, line, {'l': f}) for f in fs]
        return a2_frames(fs), {'kind': 'autotile', 'autotiles': {'lava': fs[0]}, 'frames': {'lava': fs},
                               'liquid': ['lava'], 'vignette': anim[0], 'anim': anim,
                               'extras': [('몸통 4장면', body_strip(fs), 4), ('47 변형(장면 1)', variants_sheet(fs[0]), 2)]}
    return fn


def cand_ice(line, n):
    def fn():
        sts = ice(line, n)
        v = render(ICE_GRID, line, {'i': sts[0]})
        for s_, (cx, cy) in zip(sts[1:], ICE_STATE_CELLS):
            v.a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = s_.tile_at(255, cx, cy).a
        return hcat(*[SR.a2_block(s_) for s_ in sts]), {
            'kind': 'autotile', 'autotiles': {'ice': sts[0]}, 'states': {'ice': sts}, 'vignette': v,
            'extras': [('몸통: 정지 · 금 1 · 금 2 · 깨짐', body_strip(sts), 4), ('47 변형(정지)', variants_sheet(sts[0]), 2)]}
    return fn


def cand_chasm(line, n):
    def fn():
        at = chasm(line, n)
        v = render(CHASM_GRID, line, {'c': at}, [(actor_cv(),) + at_cell(7, 4)])
        return SR.a2_block(at), {'kind': 'autotile', 'autotiles': {'chasm': at}, 'vignette': v,
                                 'extras': [('47 변형', variants_sheet(at), 2)]}
    return fn


def cand_bridge(line, n):
    def fn():
        k = bridge(line, n)
        objs = place_v(k, 3, 4, 6) + place_h(k, 7, 9, 5) + [(actor_cv(),) + at_cell(3, 5)]
        v = render(BRIDGE_GRID, line, {'c': chasm(line, n), 'w': water(line, n)[0]}, objs)
        return kit_sheet(k), {'kind': 'kit', 'kit': k, 'vignette': v,
                              'extras': [('가로 5칸 · 세로 4칸 이어 붙임', bridge_runs(k), 3)]}
    return fn


def bridge_runs(k):
    cv = Cv(6 * T + 8, 4 * T)
    for i, x in enumerate(range(5)):
        cv.paste(k['h'][0 if x == 0 else 2 if x == 4 else 1], x * T, T)
    for y in range(4):
        cv.paste(k['v'][0 if y == 0 else 2 if y == 3 else 1], 5 * T + 8, y * T)
    return cv


ITEM_FNS = {'edges.water': cand_water, 'edges.lava': cand_lava, 'edges.ice': cand_ice,
            'edges.chasm': cand_chasm, 'edges.bridge': cand_bridge}
ITEM_KEY = {'edges.water': 'water', 'edges.lava': 'lava', 'edges.ice': 'ice', 'edges.chasm': 'chasm', 'edges.bridge': 'bridge'}
SKIP = {('A', 'edges.lava')}   # 시드 lines.A.skip 과 같게 — 해안 흙굴에 용암은 컨셉 밖
LINES = ('A', 'B', 'C')


def _candidates():
    out = {}
    for item, mk in ITEM_FNS.items():
        out[item] = {}
        for ln in LINES:
            if (ln, item) in SKIP:
                continue
            for n in (1, 2):
                out[item][f'{ln}{n}'] = _noted(mk(ln, n), ITEM_KEY[item], f'{ln}{n}')
    return out


def _noted(fn, key, cand):
    def g():
        cv, meta = fn()
        meta['note'] = ITEM_NOTES[key][cand]
        return cv, meta
    return g


def line_scenes():
    out = {}
    for ln in LINES:
        out[ln] = []
        for n in (1, 2):
            out[ln].append((f'{ln}{n} 물가', SCENE_NOTES['a'] + (' (용암 없는 줄)' if skip_lava(ln) else ''), scene_frames(ln, n, 'a')))
            out[ln].append((f'{ln}{n} 낭떠러지', SCENE_NOTES['b'] if not skip_lava(ln) else SCENE_NOTES['b_nolava'],
                            scene_frames(ln, n, 'b')))
    return out


SCENE_NOTES = {'a': '물 + 가로 다리(사람이 다리 위) + 얼음판', 'b': '낭떠러지 + 세로 다리 + 용암',
               'b_nolava': '낭떠러지 + 세로 다리 + 얼음판(줄 A 는 용암을 뺐다)'}
SCENE_LEAD = ('그 줄 style-r1 조각(천장·앞면·바닥)과 같은 번호 edges 후보로 깐 8×6 칸 두 장 + Actor1 한 명. 물·용암은 4장면 움직임(3fps). '
              '맵 가장자리는 잘린 것(맵이 이어진다고 본다).')
NOTES = {}
ITEM_NOTES = {
    'water': {'A1': 'style-r1 A 물가 그대로 · 흐름: 물결 획이 0→1→2→1px 오른쪽으로 밀렸다 돌아옴(획마다 박자 어긋남)',
              'A2': 'style-r1 A 물가 그대로 · 반짝임: 밝은 획이 제자리에서 밝아짐→짧아짐→사라짐, 어두운 골은 한 칸 옮김',
              'B1': 'style-r1 B 바위 둑 그대로 · 흐름. 고인 물이라 획이 드물어 장면용 획 4개를 손으로 더함',
              'B2': 'style-r1 B 바위 둑 그대로 · 반짝임(획 드묾 — 움직임이 약함)',
              'C1': 'style-r1 C 얕은 물가 그대로 · 흐름(점 반짝이 + 장면용 획 4개)',
              'C2': 'style-r1 C 얕은 물가 그대로 · 반짝임(점이 깜빡임 — 움직임이 약함)'},
    'lava': {'B1': '굳은 껍질 판 + 빛나는 금, 빛이 금을 따라 흐름. 턱 바위 = style-r1 B 바윗덩이를 화산암 색으로',
             'B2': '녹은 용암 + 껍질 조각이 흔들리고 거품 셋이 부풀었다 터짐. 턱은 B1 과 같음',
             'C1': '검은 화산암 껍질 + 주황 금, 빛이 금을 따라 흐름. 턱 바위 = style-r1 C 층리 앞면',
             'C2': '더 뜨거운 주황 녹은 용암 + 노란 획·거품. 턱은 C1 과 같음'},
    'ice': {'A1': '맑은 얼음(비스듬한 반사 획) · 두께 앞면 2px · 그늘 = 갈색 흙 어두운 단',
            'A2': '서리 낀 흰 얼음(서리 덩이·갇힌 거품) · 테두리는 A1 과 같음',
            'B1': '맑은 얼음 · 윤곽 = B 의 어두운 돌 윤곽 o',
            'B2': '서리 낀 얼음 · 윤곽 o',
            'C1': '맑은 얼음 · 윤곽 = 검푸른 화산암, 그늘 = 회색 자갈 어두운 단',
            'C2': '서리 낀 얼음 · 윤곽 화산암'},
    'chasm': {'A1': '먼 벽 8px — style-r1 A 돌 앞면이 아래로 어두워짐 · 턱 = 밝은 흙 끝선',
              'A2': '먼 벽 14px(북이 열린 칸은 아랫단까지) — 같은 돌 앞면이 더 깊게 꺼짐',
              'B1': '먼 벽 8px — style-r1 B 바윗덩이 앞면 · 턱 윤곽 o',
              'B2': '먼 벽 14px — 바윗덩이가 두 단으로 꺼짐',
              'C1': '먼 벽 8px — style-r1 C 물결 층리 · 턱 = 밝은 자갈 끝선',
              'C2': '먼 벽 14px — 층리 두 겹이 어둠으로 꺼짐'},
    'bridge': {'A1': '밧줄 널다리 — 널 3px + 틈, 남북 가장자리 밧줄, 끝에 말뚝 둘',
               'A2': '통나무 다리 — 가로는 통나무 둘, 세로는 셋을 밧줄로 묶음, 남끝에 통나무 단면',
               'B1': '갱도 목재 다리 — 굵은 널 + 쇠 볼트 박은 옆 들보, 쇠띠 감은 기둥',
               'B2': '돌판 다리 — 8px 판돌, 남쪽 두께 2줄, 끝에 낮은 돌 말뚝',
               'C1': '옛 화산암 다리 — 깎은 밝은 턱 + 그늘, 남쪽 두께에 층 줄',
               'C2': '판석 다리 + 청록 빛 홈 — 가운데 빛줄, 빛 박힌 기둥돌'},
}
CANDIDATES = _candidates()

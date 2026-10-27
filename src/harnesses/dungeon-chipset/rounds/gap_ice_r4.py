"""gap-ice-r4 — 얼음 동굴 벽(gap.ice_rock) 다시 그림. r3 A2 는 object-gate 를 넘었지만 독립 Sonnet 검수에서 FAIL:
  ① 윗면이 서리 없는 평평한 회색 바위 ② 앞면이 「어두운 돌 + 청록 물방울」(반투명 얼음으로 안 읽힘)
  ③ 고드름 길이·간격이 고름 ④ 16px 마다 빗금·고드름 무늬 반복 ⑥ 앞면 둘레에 1px 밝은 테(끝 마구리 바깥 열·바닥 귀)
  ⑦ 바닥과 만나는 곳이 곧은 밝은 선.

r4 수정:
  윗면 — r3 의 몸통 배치를 그대로 읽되 서리 덩이 값을 눈 램프로 올린다(h snow 0 · H snow 1, 잔결 g iron 3) → 검푸른 바위 위 서리·눈 덩이.
  앞면 — 맨 위 = 열마다 깊이 2~5 인 눈 처마(덩이 앞쪽만 snow 2, 밑은 snow 0 → 얼음 그늘), 그 밑은 바위 앞을 덮은 **반투명 얼음 폭포**:
         폭 3~7 열의 얼음 기둥마다 왼(빛) 열 한 단 밝게·오른 열 한 단 어둡게, 위에서 아래로 ice 2 → ice 1 → ice 0 → water 1 로 깊어지고(경계는 열마다 어긋남),
         얼음 속에 비치는 바위 덩이(water 1/0), 빛 획(ice 3), 기둥 사이 몇 곳은 얼음이 얇아 바위(vrock 2·3)가 드러난다.
         고드름은 처마 밑에서 2~14px, 굵기 1~3, 몇 개는 부러진 그루터기. 밑은 열마다 높이가 다른 어두운 바닥 그늘(밝은 선 없음) + 얼음 발치 혹.
  48px 가운데 덩이·이음 열 15·31·47 같은 화소 규칙은 r3 와 같다(compose.ts 의 face_mid 위상 규칙).
모든 화소는 이 파일의 열 표·손으로 고른 자리에서 온다. 3/4: 윗면 → 남쪽 앞면 2단(32px), 옆면 없음, 빛은 왼쪽 위.
  A1 「빙폭」 — 넓은 얼음 기둥 위주, 바위 창 둘.   A2 「빙주」 — 가는 기둥 여럿, 바위 창 넷, 긴 고드름 많음.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import a2_plus, autotile_cv, hcat, on_base, variants_sheet  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402
import gap_ice_r1 as R1  # noqa: E402  읽기 전용 — 고른 얼음 바닥 A1 · 얼음굴 바닥 A1
import gap_ice_r3 as R3  # noqa: E402  읽기 전용 — 윗면 몸통 배치·틀·장면 격자

WAVE = 'gap'
T = 16
MW = 48

# ================================================================================================ 윗면 — 서리·눈 덩이 낀 바위
TOP_LEG = legend(x=('vrock', 1), B=('vrock', 3), g=('snow', 0), n=('vrock', 2), h=('snow', 1), H=('snow', 2))


# 가장자리 칸이 쓰는 본몸통 — r3 본몸통의 굽은 금(nnxx)이 가장자리 칸마다 16px 로 되풀이됐다. 조용한 바탕 + 잔결 몇 화소 + 작은 서리 한 점.
EDGE_BODY = {
    1: ['BBBBBBBBBBBBBBBB', 'BBBBBBBBBnBBBBBB', 'BBBhhBBBBBBBBBBB', 'BBBhgBBBBBBBBnBB', 'BBBBBBBBBBBBBBBB', 'BnBBBBBBBBBBBBBB',
        'BBBBBBBBnBBBBBBB', 'BBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBhgBB', 'BBBBBnBBBBBBBBBB', 'BBBBBBBBBBBBBBBB', 'BBBBBBBBBBBnBBBB',
        'BBnBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBB', 'BBBBBBBgBBBBBBBB', 'BBBBBBBBBBBBBBBB'],
    2: ['BBBBBBBBBBBBBBBB', 'BBBBBBBnBBBBBBBB', 'BBBBBBBBBBBBBBBB', 'BBBBBBBBBBhhgBBB', 'BnBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBB',
        'BBBBBnBBBBBBBBBB', 'BBBBBBBBBBBBBBnB', 'BBBBBBBBBBBBBBBB', 'BBhhgBBBBBBBBBBB', 'BBBBBBBBBnBBBBBB', 'BBBBBBBBBBBBBBBB',
        'BBBBBBBBBBBBBBBB', 'BBBBBBnBBBBBBBBB', 'BBBBBBBBBBBBgBBB', 'BBBBBBBBBBBBBBBB'],
}


def rock_top(n):
    floor = R1.ground(1)
    fr, inner = R3.top_frame(n)
    frc, innc = on_base(floor.body, fr, inner, R3.FRAME_LEG)
    bodies = [grid(R3.sq(r), TOP_LEG, 16, 16) for r in [EDGE_BODY[n]] + R3.TOP_BODIES[n]]
    return autotile_cv(bodies[0], frc, innc, bodies[1:])


# ================================================================================================ 앞면
# 글자: 눈 S2 snow2 · S snow1 · s snow0 / 얼음 단 0..4 = water1 · ice0 · ice1 · ice2 · ice3 / 비친 바위 d water1 · D water0
#       바위 r vrock2 · R vrock3 · k vrock1 · x vrock0
FACE_LEG = legend(W=('snow', 2), S=('snow', 1), s=('snow', 0),
                  **{'0': ('water', 1), '1': ('ice', 0), '2': ('ice', 1), '3': ('ice', 2), '4': ('ice', 3)},
                  d=('water', 1), D=('water', 0), r=('vrock', 2), R=('vrock', 3), k=('vrock', 1), x=('vrock', 0))


def _d(s, n):
    s = s.replace(' ', '')
    assert len(s) == n, (len(s), n, s)
    return [int(c, 36) for c in s]


def face_grid(W, spec):
    """spec: cornice(처마 깊이) · bump(처마 앞 snow2 자리 '1') · fall(L 빛 열 · M 가운데 · R 그늘 열 · r 바위 창) ·
    band(열마다 단 경계 어긋남 0~3) · bot(얼음 밑 행) · blobs[(x,y,rows)] · glints[(x,y)] · icicles[(x,len,w)]"""
    C, BUMP, BAND, BOT = _d(spec['cornice'], W), _d(spec['bump'], W), _d(spec['band'], W), _d(spec['bot'], W)
    FALL = spec['fall'].replace(' ', '')
    assert len(FALL) == W, (len(FALL), W)
    g = [['k'] * W for _ in range(32)]
    for x in range(W):
        c, b, off, f = C[x], BOT[x], BAND[x], FALL[x]
        # 눈 처마
        for y in range(c):
            if y == 0:
                g[y][x] = 'S'
            elif y == 1 and BUMP[x]:
                g[y][x] = 'W'
            elif y == c - 1:
                g[y][x] = 's'
            else:
                g[y][x] = 'S'
        top = c
        for y in range(top, 32):
            if y > b:
                # 바닥 그늘: 얼음 밑 한 줄 k, 그 밑 x (밝은 선 없음)
                g[y][x] = 'k' if y == b + 1 else 'x'
                continue
            if f == 'r':   # 얼음이 얇아 바위가 드러난 열
                lvl = 'R' if (y - top) < 3 + off else 'r'
                if b - y <= 1:
                    lvl = 'k'
                g[y][x] = lvl
                continue
            t = y - top + off
            span = b - top + 3
            if y == top:
                k = 1   # 처마 밑 그늘
            elif t < span * 0.28:
                k = 3
            elif t < span * 0.62:
                k = 2
            elif t < span * 0.86:
                k = 1
            else:
                k = 0
            if f == 'L':
                k = min(4 if 3 < y - top < 9 else 3, k + 1)
            elif f == 'R':
                k = max(0, k - 1)
            g[y][x] = str(k)
    for x0, y0, rows in spec.get('blobs', ()):
        for dy, r in enumerate(rows):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                X, Y = x0 + dx, y0 + dy
                if g[Y][X] in '1234':
                    g[Y][X] = ch
    for x0, y, w in spec.get('ledges', ()):   # 얼음 턱: 밝은 윗줄 + 밑 그늘 줄(가로로 끊어 세로 줄무늬를 깬다)
        for X in range(x0, min(W, x0 + w)):
            if g[y][X] in '1234' and g[y + 1][X] in '01234':
                g[y][X] = '4' if X - x0 < w // 2 else '3'
                g[y + 1][X] = str(max(0, int(g[y + 1][X]) - 2))
    for x, y in spec.get('glints', ()):
        if g[y][x] in '23':
            g[y][x] = '4'
    for x, n, w in spec.get('icicles', ()):
        y0 = C[x]
        for i in range(n):
            y = y0 + i
            if y > BOT[x]:
                break
            ww = w if i < n * 0.35 else max(1, w - 1) if i < n * 0.7 else 1
            for j in range(ww):
                X = x + j
                if X >= W:
                    break
                tip = i == n - 1
                g[y][X] = '3' if tip else ('W' if j == 0 and i < 2 else '4' if j == 0 else 's' if j == ww - 1 and ww > 1 else '4')
            X = x + ww
            if X < W and g[y][X] in '123':   # 고드름 오른쪽 그늘 한 화소
                g[y][X] = str(max(0, int(g[y][X]) - 1))
    return g


def check_seam(g):
    for y in range(32):
        assert g[y][15] == g[y][31] == g[y][47], ('이음 열 15·31·47', y, g[y][15], g[y][31], g[y][47])


BLOB_A = ['.dd.', 'dDdd', '.dd.']
BLOB_B = ['.dd', 'dDd', 'dd.', '.d.']
BLOB_C = ['dd..', 'dDd.', '.ddd', '..d.']

#            0         1         2         3         4
#            012345678901234567890123456789012345678901234567
FACE = {
    1: dict(   # 넓은 기둥 셋(폭 9·11·12) + 좁은 기둥, 바위 창 2~3열 셋. 밑변이 기둥마다 크게 다르다.
        cornice='344332234454333234554332234454323455443322454333',
        bump=   '011000101110010001110001001110000111000100110010',
        fall=   'LLMMMMMMRrrLMMRrLLMMMMMMMMRRrrrLMMMMRLLMMMMMMMRM',
        band=   '012332100123210011233210012332100122332100123210',
        bot=    'pqrsssrqnkkmpqonopqrsstsrqpnkkkmoqrsrqoprsttsrqr',
        blobs=[(3, 15, BLOB_A), (20, 11, BLOB_B), (23, 18, BLOB_A), (40, 12, BLOB_C), (43, 19, BLOB_B)],
        ledges=[(0, 9, 13), (17, 10, 9), (36, 11, 12)],
        glints=[(1, 7), (1, 8), (2, 10), (6, 6), (6, 7), (17, 7), (18, 8), (18, 9), (25, 6), (37, 6), (38, 7), (38, 8), (44, 7)],
        icicles=[(2, 9, 2), (5, 3, 1), (8, 14, 3), (12, 4, 1), (14, 7, 1), (18, 4, 1), (21, 12, 2), (24, 2, 1), (27, 6, 1),
                 (33, 3, 1), (35, 15, 2), (39, 5, 1), (41, 2, 1), (44, 9, 2), (46, 3, 1)],
    ),
    2: dict(   # 가는 기둥(폭 3~6) 여럿, 바위 창 넷(폭 2~4), 바위가 밑까지 드러나는 곳이 많다.
        cornice='433443223443322234433223433443223443322234433222',
        bump=   '010010001100100001100010011001000100010011001000',
        fall=   'LMMRrrLMMMRrrrLMMLMMRrrLMMMMRrLMMRLMMRrrrLMMMRrM',
        band=   '123210012332100121001233210012321001233210012310',
        bot=    'rsstnmqrsrqmllnprqsronmqrsttsqmorrqsrqnmmlqrsrnr',
        blobs=[(7, 14, BLOB_B), (25, 17, BLOB_A), (43, 12, BLOB_C)],
        ledges=[(6, 12, 5), (24, 13, 6), (41, 10, 5)],
        glints=[(0, 7), (0, 9), (6, 6), (6, 8), (7, 10), (17, 6), (18, 8), (23, 7), (24, 9), (31, 6), (34, 8), (41, 7), (42, 9)],
        icicles=[(1, 12, 2), (4, 4, 1), (7, 16, 2), (11, 3, 1), (15, 10, 2), (18, 5, 1), (20, 14, 2), (25, 2, 1), (27, 9, 1),
                 (31, 4, 1), (34, 13, 2), (38, 3, 1), (42, 11, 2), (45, 6, 1)],
    ),
}
# 끝 마구리 8열. 왼끝 = 바깥 두 열은 바위 모서리(눈 처마가 둥글게 내려앉음), 오른끝 = 얼음이 끝나고 그늘 바위 두 열.
CAPS = {
    1: dict(L=dict(cornice='54433223', bump='00110010', fall='rrLMMMMR', band='00011221', bot='nopqqrrq',
                   blobs=[], glints=[(2, 7), (3, 9)], icicles=[(3, 7, 2), (6, 3, 1)]),
            R=dict(cornice='32234455', bump='01001100', fall='LMMMRrrr', band='10012210', bot='qrqqpoon',
                   blobs=[(1, 13, ['dd', 'dD'])], glints=[(0, 8)], icicles=[(1, 10, 2), (4, 2, 1)])),
    2: dict(L=dict(cornice='55443343', bump='00100100', fall='rrLMRrLM', band='00122100', bot='nopqrrsr',
                   blobs=[], glints=[(2, 8), (6, 7)], icicles=[(2, 9, 1), (6, 12, 2)]),
            R=dict(cornice='43344555', bump='01000100', fall='LMMRrrrr', band='11221000', bot='rssqponn',
                   blobs=[], glints=[(0, 8)], icicles=[(0, 13, 2), (3, 4, 1)])),
}


SEAM = dict(cornice='3', bump='0', fall='M', band='1', bot='r')


def _seamed(spec):
    """이음 열 15·31·47 을 같은 값으로 — 그 셋은 위상마다 서로 바뀌어 오른끝 마구리 앞에 선다."""
    out = dict(spec)
    for k, v in SEAM.items():
        c = list(spec[k])
        for x in (15, 31, 47):
            c[x] = v
        out[k] = ''.join(c)
    return out


def face_parts(n):
    g = face_grid(MW, _seamed(FACE[n]))
    for y in range(32):   # 고드름 그늘·덩이가 이음 열에 닿은 화소까지 같게 — 열 15 를 정본으로
        g[y][31] = g[y][47] = g[y][15]
    check_seam(g)
    caps = {s: face_grid(8, CAPS[n][s]) for s in 'LR'}
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
    assert not dot.structure_errors(g), dot.structure_errors(g)
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
    'A1': '「빙폭」 — 검푸른 바위 윗면에 눈·서리 덩이. 앞면 = 깊이 2~5 눈 처마 + 넓은 반투명 얼음 기둥(위 밝고 밑 깊음, 비친 바위·빛 획), 바위 창 둘, 고드름 2~14px',
    'A2': '「빙주」 — 같은 윗면(결 따라 누운 서리 줄). 앞면 = 가는 얼음 기둥 여럿 사이 바위 창 넷, 긴 고드름 많음',
}


def cand(n):
    def fn():
        at = rock_top(n)
        mid, face = face_parts(n)
        v, g = scene(n)
        return hcat(a2_plus(at), face.b, mid), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': face}, 'face_mid': mid, 'vignette': v, 'grid': g,
            'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 윗면 A2(+몸통 변형 8) | 앞면 표본 32×32(끝 마구리 + 가운데 16) | 가운데 덩이 48×32',
            'extras': [('윗면 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('벽 줄 9칸(끝 마구리 + 48px 덩이)', R3.mid_run(mid, face, 9), 3),
                       ('홑칸 앞면', hcat(face.tile(0, True, True), face.tile(1, True, True)), 4), ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {'gap.ice_rock': {'A1': cand(1), 'A2': cand(2)}}
SCENE_LEAD = R3.SCENE_LEAD

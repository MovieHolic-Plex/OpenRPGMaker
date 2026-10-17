"""sf_station 바닥·오토타일 v2 — Opus 손 도트 다시 그리기(2026-10-14). 같은 id 로 sf_terrain(Sonnet 초안)을 대신한다.
asphalt·sidewalk·regolith·wall-face 는 이번 세션 QA 개선에서 직접 다시 쓴 함수를 그대로 쓴다(sf_terrain 안). 나머지는 여기서 새로 그린다.
바닥 원칙: 한 칸 안에서 위·왼 이음(어두움)+바로 안 밝은 턱만 그려 이어 붙였을 때 판 이음이 한 줄로 보이게 한다. 점 노이즈는 드물게(별·체커로 안 보이게)."""
from sf_kit import *
import sf_terrain as T

TERRAIN, FLAT = 'terrain', 'flat'
N, E, S, W = 1, 2, 4, 8


def soft(c, ox, oy, mat, t0, seed, w=16, h=16, lo=1, hi=1):
    """2단 결: 4×4 덩이 밝기 + 드문 점. 별·체커로 보이지 않을 만큼 옅게."""
    for y in range(h):
        for x in range(w):
            b = hsh((ox + x) // 4, (oy + y) // 4, seed) % 5
            t = t0 + (1 if b == 4 else -1 if b == 0 else 0) * lo
            n = hsh(x + ox, y + oy, seed + 7) % 29
            if n == 0: t -= 1
            elif n == 1: t += hi
            c.P(ox + x, oy + y, K(mat, t))


# ───────── 갑판 판
def deck_plate(c, ox, v, oy=0):
    """청회 갑판 판(16×16), 화풍 정렬 2026-10-14 2차(버들항 포석·기와 문법 = 단위마다 빛면·그늘면, 낱점 노이즈 금지):
    깨끗한 금속 면 + 넓은 2단 그라데이션(위 밝음 → 아래 한 단 어두움, 경계는 한 줄 엇갈림) + 위/왼 빛 턱 1행 + 아래/오른 그늘 1~2행
    + 한 방향(가로) 솔결 짧은 획 몇 개 + 이음·리벳 둘레에만 모인 때. 이음은 선체 -2 한 줄. 변형 1 눌린 점검 판, 2 반판 이음, 3 바닥 등."""
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    for y in range(16):
        for x in range(16):
            t = 0 if y < 8 else -1
            if y == 8 and (x + v) % 2 == 0: t = 0                 # 그라데이션 경계 한 줄 엇갈림
            P(x, y, K('hull', t))
    for x in range(16): P(x, 0, K('hull', -2))                  # 위 이음
    for y in range(16): P(0, y, K('hull', -2))                  # 왼 이음
    for x in range(1, 15): P(x, 1, K('hull', 1))                # 위 빛 턱
    for y in range(2, 15): P(1, y, K('hull', 1 if y < 8 else 0))  # 왼 빛 턱
    for x in range(2, 16): P(x, 15, K('hull', -2)); P(x, 14, K('hull', -2) if x >= 13 else None)   # 아래 그늘(오른쪽 끝 2행)
    for y in range(2, 15): P(15, y, K('hull', -2))              # 오른 그늘
    for y in range(9, 14): P(14, y, K('hull', -2) if y >= 12 else None)
    # 솔결: 가로 짧은 획(윗판은 한 단 밝게, 아랫판은 윗판 색으로)
    strokes = [((4, 4), 4), ((9, 6), 3), ((5, 11), 3), ((10, 12), 2)]
    for i, ((x, y), n) in enumerate(strokes):
        x = x + (hsh(i, v, 161) % 3) - 1
        c.HL(ox + x, oy + y, n, K('hull', 1 if y < 8 else 0))
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)):        # 리벳: 빛점 + 오른아래 그림자 + 둘레 때
        P(x, y, K('hull', 2)); P(x + 1, y + 1, K('hull', -3))
    P(13, 13, K('hull', -3)); P(4, 13, K('hull', -2)); P(13, 4, K('hull', -2) if v != 3 else None)
    P(2 + hsh(v, 2, 153) % 3, 14, K('hull', -2)); P(14, 6 + hsh(v, 3, 155) % 3, K('hull', -3))      # 이음 곁 때
    if v == 1:                                           # 눌린 점검 판(안쪽 위·왼 그늘, 아래·오른 빛 턱, 손잡이 홈)
        c.R(ox + 5, oy + 5, 7, 7, K('hull', -1)); c.HL(ox + 5, oy + 5, 7, K('hull', -3)); c.VL(ox + 5, oy + 5, 7, K('hull', -3))
        c.HL(ox + 6, oy + 6, 5, K('hull', -2))
        c.HL(ox + 6, oy + 11, 6, K('hull', 1)); c.VL(ox + 11, oy + 6, 6, K('hull', 0)); c.HL(ox + 7, oy + 8, 3, K('hull', -3)); c.HL(ox + 7, oy + 9, 3, K('hull', 0))
    if v == 2:                                           # 반판 이음(가로): 위판 아래 그늘 + 어두운 줄 + 아래판 빛 턱
        c.HL(ox + 1, oy + 7, 15, K('hull', -1)); c.HL(ox + 1, oy + 8, 15, K('hull', -2)); c.HL(ox + 2, oy + 9, 13, K('hull', 1))
    if v == 3:                                           # 바닥 작은 시안 등(빛 번짐)
        c.R(ox + 7, oy + 7, 3, 2, K('cyan', 1)); c.HL(ox + 7, oy + 7, 3, K('cyan', 3)); c.HL(ox + 6, oy + 9, 5, K('hull', -3))
        for (x, y) in ((6, 7), (10, 8), (8, 6)): P(x, y, K('cyan', -2))


def deck_grate(c, ox, v):
    """점검 격자: 어두운 바닥 위 가로 창살(윗변 밝음·아랫변 그늘) 사이로 밑의 시안 빛과 배관."""
    for y in range(16):
        for x in range(16):
            c.P(ox + x, y, K('cable', -3 if (x + y + v) % 7 else -2))
    for x in range(16): c.P(ox + x, 11 if v == 0 else 6, K('cyan', -1 if x % 5 else 0))   # 밑 배관 빛
    for y in range(1, 16, 3):
        c.HL(ox, y, 16, K('hull', 0)); c.HL(ox, y - 1, 16, K('hull', -2)) if y > 0 else None
    for y in range(0, 16, 3): c.HL(ox, y, 16, K('hull', 1) if y % 6 == 0 else K('hull', -1))
    c.VL(ox, 0, 16, K('hull', -2)); c.VL(ox + 8, 0, 16, K('hull', -1)); c.VL(ox + 9, 0, 16, K('hull', 1))
    c.P(ox + 4, 2, K('cyan', 2)); c.P(ox + 12, 8, K('cyan', 1))


def deck_hazard(c, ox, v):
    """위험 줄 바닥: 노랑·검정 사선(폭 4) + 칠 벗겨진 자리(철판이 비침) + 위·왼 이음."""
    for y in range(16):
        for x in range(16):
            yel = ((x + y + v * 2) // 4) % 2 == 0
            col = K('yellow', 1) if yel else K('cable', -2)
            if yel and hsh(x, y, 40 + v) % 13 == 0: col = K('hull', -1)
            if yel and (x + y + v * 2) % 4 == 0: col = K('yellow', 2)
            c.P(ox + x, y, col)
    c.HL(ox, 0, 16, K('cable', -3)); c.VL(ox, 0, 16, K('cable', -3))


def deck_lane(c, ox, v, vertical):
    """복도 안내 바닥: 갑판 판 + 가운데 눌린 홈 속 시안 띠 램프(심 밝음) + 양옆 빛 번짐."""
    deck_plate(c, ox, 0 if v == 0 else 2)
    for k in range(16):
        x, y = (7, k) if vertical else (k, 7)
        def P(dx, dy, col):
            if vertical: c.P(ox + x + dx, y, col)
            else: c.P(ox + x, y + dy, col)
        P(-2, -2, K('hull', -3)); P(-1, -1, K('cyan', -1)); P(0, 0, K('cyan', 2 if k % 4 else 3)); P(1, 1, K('cyan', 1)); P(2, 2, K('hull', 0))
    if v:
        for k in (3, 11):
            if vertical: c.P(ox + 7, k, K('glow', 1))
            else: c.P(ox + k, 7, K('glow', 1))


def lab_floor(c, ox, v):
    """연구실 흰 타일(8×8): 메지 줄(위·왼 어두움) + 타일 안 아래·오른 밝은 턱 + 옅은 광택 사선 + 변형 1 배수구."""
    for y in range(16):
        for x in range(16):
            c.P(ox + x, y, K('white', 2 if (hsh(x // 8, y // 8, v) % 3) else 1))
    for k in (0, 8):
        c.HL(ox, k, 16, K('white', -1)); c.VL(ox + k, 0, 16, K('white', -1))
    for (tx, ty) in ((0, 0), (8, 0), (0, 8), (8, 8)):
        c.P(ox + tx + 2, ty + 2, K('white', 3)); c.P(ox + tx + 3, ty + 2, K('white', 3)); c.P(ox + tx + 2, ty + 3, K('white', 3))
        b = 2 if (hsh(tx // 8, ty // 8, v) % 3) else 1             # 타일 아래·오른 안쪽 한 단 그늘(유약 두께) 
        for k in range(2, 8): c.P(ox + tx + k, ty + 7, K('white', b - 1)); c.P(ox + tx + 7, ty + k, K('white', b - 1))

    if v:
        c.line(ox + 10, 5, ox + 13, 4, K('white', 0)); c.P(ox + 4, 12, K('white', 0))


def crew_floor(c, ox, v):
    """숙소 남색 고무 바닥: 결 + 4px 간격 둥근 돌기(윗점 밝음·아랫점 그늘) — 엇갈린 줄."""
    soft(c, ox, 0, 'navy', 0, 51 + v, lo=1, hi=0)
    for y in range(2, 16, 4):
        for x in range(2 + (y // 4 % 2) * 2, 16, 4):
            c.P(ox + x, y, K('navy', 2)); c.P(ox + x, y + 1, K('navy', -2))
    c.HL(ox, 0, 16, K('navy', -2)); c.VL(ox, 0, 16, K('navy', -2))
    if v: c.HL(ox + 1, 15, 15, K('violet', -1))


def cargo_floor(c, ox, v):
    """화물칸 줄무늬 철판(diamond plate): 엇갈린 짧은 사선 돌기 + 위·왼 이음 + 변형 1 노란 안전선."""
    soft(c, ox, 0, 'cable', 1, 61 + v, lo=1, hi=0)
    for y in range(1, 16, 4):
        for x in range(1 + (y // 4 % 2) * 2, 16, 4):
            c.P(ox + x, y, K('hull', 0)); c.P(ox + x + 1, y + 1, K('hull', -1)); c.P(ox + x + 1, y + 2, K('cable', -2))
    c.HL(ox, 0, 16, K('cable', -2)); c.VL(ox, 0, 16, K('cable', -2)); c.HL(ox + 1, 1, 15, K('cable', 2))
    if v:
        c.R(ox, 12, 16, 3, K('yellow', 1)); c.HL(ox, 12, 16, K('yellow', 2)); c.HL(ox, 14, 16, K('yellow', -1))
        for x in range(0, 16, 5): c.P(ox + x + 2, 13, K('cable', 0))


def glass_floor(c, ox, v):
    """전망 유리 바닥: 깊은 우주(남색→검정) + 별(밝기 셋) + 굵은 금속 틀 이음 + 유리 사선 반사 둘."""
    for y in range(16):
        for x in range(16): c.P(ox + x, y, K('star', -2 if (x + y) % 9 else -1))
    for k in range(5 + v * 2):
        x, y = 2 + hsh(k, v, 71) % 13, 2 + hsh(k, v, 72) % 13
        c.P(ox + x, y, K('star', 1 + hsh(k, v, 73) % 3))
    c.HL(ox, 0, 16, K('hull', 0)); c.VL(ox, 0, 16, K('hull', 0)); c.HL(ox, 1, 16, K('hull', -3)); c.VL(ox + 1, 1, 15, K('hull', -3))
    c.line(ox + 3, 13, ox + 9, 7, K('glass', -1)); c.line(ox + 5, 14, ox + 11, 8, K('glass', -2))


def void_star(c, ox, v):
    """우주 공허: 거의 검은 남색 + 아주 드문 성운 얼룩(보라) + 별 밝기 셋 + 변형 3 십자 빛 별."""
    for y in range(16):
        for x in range(16):
            c.P(ox + x, y, K('violet', -3) if (v % 2 and hsh(ox + x, y, 85) % 23 == 0) else K('star', -3))
    for k in range(2 + v % 3):
        x, y = hsh(k, v, 82) % 16, hsh(k, v, 83) % 16
        c.P(ox + x, y, K('star', hsh(k, v, 84) % 3))
    if v == 3: c.P(ox + 8, 8, K('star', 3)); c.P(ox + 7, 8, K('star', 0)); c.P(ox + 9, 8, K('star', 0)); c.P(ox + 8, 7, K('star', 0)); c.P(ox + 8, 9, K('star', 0))


def landing_plate(c, ox, v):
    """착륙장 콘크리트 판: 결 + 판 이음 + 변형 0 위험 갈매기 띠 / 변형 1 시안 착륙등 + 그을음."""
    soft(c, ox, 0, 'conc', 0, 91 + v, lo=1, hi=1)
    c.HL(ox, 0, 16, K('conc', -2)); c.VL(ox, 0, 16, K('conc', -2)); c.HL(ox + 1, 1, 15, K('conc', 2))
    if v == 0:
        for x in range(16):
            for y in range(10, 15):
                c.P(ox + x, y, K('yellow', 1) if ((x + (14 - y)) // 3) % 2 == 0 else K('cable', -1))
    else:
        for (x, y) in ((4, 4), (12, 12)): c.P(ox + x, y, K('cyan', 3)); c.P(ox + x + 1, y, K('cyan', 1)); c.P(ox + x, y + 1, K('cyan', 0))
        c.ell(ox + 10, 6, 3, 2, K('conc', -2)); c.P(ox + 10, 6, K('conc', -3))


def lane_dash(c, ox, v):
    """도로 중앙 점선: 아스팔트 위 바랜 흰 선(두께 2, 길이 8 + 끝 바랜 점). v0 가로, v1 세로."""
    T.asphalt(c, ox, v)
    for k in range(3, 13):
        t = 2 if 4 <= k <= 11 else 0
        if v == 0: c.P(ox + k, 7, K('white', t)); c.P(ox + k, 8, K('white', t - 1))
        else: c.P(ox + 7, k, K('white', t)); c.P(ox + 8, k, K('white', t - 1))
    c.P(ox + 6, 7 if v == 0 else 6, K('conc', -1))


def crosswalk(c, ox, v):
    """횡단보도: 아스팔트 위 굵은 흰 띠(폭 3·간격 2) + 띠 위 닳은 점(아스팔트 비침). v0 가로 건너기, v1 세로 건너기."""
    T.asphalt(c, ox, 1 + v)
    for k in range(0, 16, 5):
        for a in range(3):
            for b in range(1, 15):
                x, y = (k + a, b) if v == 0 else (b, k + a)
                col = K('white', 1 if a else 2)
                if hsh(x, y, 101 + v) % 11 == 0: col = K('conc', 0)
                c.P(ox + x, y, col)


def puddle(c, ox, v):
    """물웅덩이(덧그림, 투명 바탕): 어두운 물 + 테 젖은 밝은 선 + 비친 네온 띠(마젠타·시안)."""
    cx, cy, rx, ry = (8, 9, 6, 3) if v == 0 else (7, 8, 5, 4)
    c.ell(ox + cx, cy, rx, ry, K('navy', -3)); c.ell(ox + cx, cy, rx - 1, ry - 1, K('navy', -2))
    c.HL(ox + cx - rx + 2, cy - ry, 2 * rx - 4, K('glass', 0))
    c.HL(ox + cx - 3, cy - 1, 4, K('magenta', 0)); c.P(ox + cx - 2, cy - 1, K('magenta', 2))
    c.HL(ox + cx, cy + 1, 4, K('cyan', 0)); c.P(ox + cx + 2, cy + 1, K('cyan', 2))


def hydro_soil(c, ox, v):
    """수경 흙 판: 짙은 갈색 흙 결 + 고랑 두 줄(그늘) + 새싹(두 잎, 밝은 왼잎) + 물 점적관(시안 점)."""
    soft(c, ox, 0, 'rust', -2, 111 + v, lo=1, hi=1)
    for y in (5, 12): c.HL(ox, y, 16, K('rust', -3)); c.HL(ox, y + 1, 16, K('rust', -1))
    for k, (x, y) in enumerate(((3, 3), (10, 3), (6, 10), (13, 10))[: 3 + v]):
        c.P(ox + x, y + 1, K('plant', -1)); c.P(ox + x - 1, y, K('plant', 2)); c.P(ox + x + 1, y, K('plant', 0)); c.P(ox + x, y - 1, K('plant', 3) if k % 2 else K('plant', 1))
    for x in range(1, 16, 5): c.P(ox + x, 7, K('cyan', 1))


def strip(fn, n):
    def draw(c):
        for v in range(n): fn(c, v * 16, v)
    return draw


def reg(id_, name, n, fn, kind=TERRAIN, tags=(), desc=''):
    p = T.C if False else None
    import sf_core as C
    old = C.PIECES[id_]
    piece2(id_, name, n, 1, kind, group='terrain', tags=old['tags'], desc=old.get('desc', desc))(strip(fn, n))


reg('deck-plate', 'station deck floor plating, four variants (brushed steel panel, recessed hatch, half-plate seam, floor light)', 4, deck_plate)
reg('deck-grate', 'dark maintenance grating with cyan light and pipes glowing below the bars, two variants', 2, deck_grate)
reg('deck-hazard', 'worn yellow and black diagonal hazard stripe floor, two variants', 2, deck_hazard)
reg('deck-lane-h', 'station corridor floor with recessed horizontal cyan guide light, two variants', 2, lambda c, ox, v: deck_lane(c, ox, v, False))
reg('deck-lane-v', 'station corridor floor with recessed vertical cyan guide light, two variants', 2, lambda c, ox, v: deck_lane(c, ox, v, True))
reg('lab-floor', 'white glazed laboratory floor tiles with grout and gloss, two variants (one with drain)', 2, lab_floor)
reg('crew-floor', 'navy studded rubber crew quarters floor, two variants', 2, crew_floor)
reg('cargo-floor', 'dark diamond-plate cargo bay floor, two variants (one with yellow safety line)', 2, cargo_floor)
reg('glass-floor', 'transparent viewport floor with metal frame showing stars below, two variants', 2, glass_floor)
reg('void-star', 'deep space void with faint nebula and scattered stars, four variants', 4, void_star)
reg('landing-plate', 'concrete landing plate with hazard chevrons or landing lights, two variants', 2, landing_plate)
reg('lane-dash', 'asphalt road with worn white dashed center line, horizontal and vertical', 2, lane_dash)
reg('crosswalk', 'asphalt road with worn white zebra crosswalk bars, horizontal and vertical', 2, crosswalk)
reg('puddle', 'wet puddle reflecting magenta and cyan neon, two variants (overlay on road)', 2, puddle, kind=FLAT)
reg('hydro-soil', 'dark hydroponic soil bed with furrows, sprouts and drip line, two variants', 2, hydro_soil)
# 이번 세션 QA 개선 패스에서 직접 다시 쓴 함수(sf_terrain 안)도 v2 로 표시한다.
reg('asphalt', 'night city asphalt road, four variants (aggregate, crack, oil stain, wet neon reflection)', 4, T.asphalt)
reg('sidewalk', 'grey concrete sidewalk slabs, two variants (one with drain grate)', 2, T.sidewalk)
reg('regolith', 'grey moon regolith ground with pebbles and small craters, four variants', 4, T.regolith)


# ───────── 오토타일
def at_deck(c, m, ox, oy):
    """떠 있는 갑판: 판 + 열린 북 = 뒤 난간 턱(밝은 윗선 + 그늘) · 열린 서/동 = 테 · 열린 남 = 선체 앞면 6행(밝은 턱·판 이음·시안 띠·바닥 그림자)."""
    t = Cv(16, 16); deck_plate(t, 0, (ox // 16 * 3 + oy // 16) % 4); c.a[oy:oy + 16, ox:ox + 16] = t.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    if not m & N:
        for x in range(16): P(x, 0, K('hull', 3)); P(x, 1, K('hull', 1)); P(x, 2, K('hull', -3))
    if not m & W:
        for y in range(16): P(0, y, K('hull', 2)); P(1, y, K('hull', 0))
    if not m & E:
        for y in range(16): P(15, y, K('hull', -3)); P(14, y, K('hull', -2))
    if not m & S:
        for y in range(10, 16):
            for x in range(16): P(x, y, K('hull', -1 if y < 13 else -2))
        for x in range(16):
            P(x, 10, K('hull', 3)); P(x, 11, K('hull', 0)); P(x, 13, K('cyan', 1 if x % 4 else 2)); P(x, 15, K('shadow', 0))
        for x in (4, 12): P(x, 12, K('hull', 2)); P(x, 14, K('hull', -3))
        if not m & W:
            for y in range(10, 15): P(0, y, K('hull', 1))
        if not m & E:
            for y in range(10, 15): P(15, y, K('hull', -3))


def at_wall(c, m, ox, oy, mat='hull'):
    """격벽 천장(윗면): 어두운 철판 결 + 큰 판 이음(8px) + 열린 쪽 가장자리 밝은 턱(빛 받는 모서리) + 열린 남쪽은 천장 끝 턱(아래 wall-face 가 이어진다).
    viewport 도 천장은 hull 과 같다(창은 앞면 띠)."""
    base, acc = {'hull': ('hull', 'orange'), 'white': ('white', 'cyan'), 'viewport': ('hull', 'cyan')}[mat]
    t0 = -1 if base == 'hull' else 0
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    for y in range(16):                                   # 판 몸(8px 판마다): 깨끗한 면 + 위 2행 한 단 밝음 · 아래 1행·오른 1열 한 단 어두움
        for x in range(16):
            b = hsh((ox + x) // 8, (oy + y) // 8, 5) % 3
            t = t0 + (1 if b == 2 else 0); px, py = x % 8, y % 8
            if py in (1, 2) and px >= 1: t += 1
            elif py == 7 or px == 7: t -= 1
            P(x, y, K(base, t))
    for k in (0, 8):                                      # 이음: 한 단 어두운 줄(최암 아님) + 왼 빛 턱
        for x in range(16): P(x, k, K(base, t0 - 2))
        for y in range(16): P(k, y, K(base, t0 - 2))
        for y in range(16):
            if y % 8 not in (0, 7): P(k + 1, y, K(base, t0 + 1))
    for (x, y) in ((2, 3), (10, 11)): P(x, y, K(base, t0 + 2)); P(x + 1, y + 1, K(base, t0 - 2))   # 리벳 몇 개만
    caph = 16 if m & S else 13
    if not m & N:
        for x in range(16): P(x, 0, K(base, t0 - 3)); P(x, 1, K(base, t0 + 3)); P(x, 2, K(base, t0 + 1))
    if not m & W:
        for y in range(caph): P(0, y, K(base, t0 + 3)); P(1, y, K(base, t0 + 1))
    if not m & E:
        for y in range(caph): P(15, y, K(base, t0 - 3)); P(14, y, K(base, t0 - 1))
    if not m & S:
        for x in range(16): P(x, 12, K(acc, 1)); P(x, 13, K(base, t0 + 3)); P(x, 14, K(base, t0)); P(x, 15, K(base, t0 - 3))


def at_road(c, m, ox, oy):
    """도로: 아스팔트 + 열린 쪽 연석(북·서·동: 콘크리트 윗면 3줄 + 아스팔트 쪽 그늘 / 남: 연석 윗면 + 앞면 + 그늘)."""
    t = Cv(16, 16); T.asphalt(t, 0, (ox // 16 * 3 + oy // 16) % 4); c.a[oy:oy + 16, ox:ox + 16] = t.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    if not m & N:
        for x in range(16): P(x, 0, K('conc', 2)); P(x, 1, K('conc', 1)); P(x, 2, K('conc', -1)); P(x, 3, K('cable', -3))
    if not m & W:
        for y in range(16): P(0, y, K('conc', 3)); P(1, y, K('conc', 1)); P(2, y, K('cable', -3))
    if not m & E:
        for y in range(16): P(15, y, K('conc', -1)); P(14, y, K('conc', 1)); P(13, y, K('cable', -3))
    if not m & S:
        for x in range(16): P(x, 11, K('cable', -3)); P(x, 12, K('conc', 2)); P(x, 13, K('conc', 1)); P(x, 14, K('conc', -1)); P(x, 15, K('conc', -2))
        for x in range(3, 16, 8): P(x, 14, K('conc', -3))


def at_regolith_path(c, m, ox, oy):
    """달 기지 다져진 길: 레골리스보다 한 단 밝고 매끈한 바닥(아주 드문 결) + 이어진 방향 바퀴 자국 한 줄씩(옅은 그늘) + 열린 쪽은 들쭉날쭉 밝은 둔덕 → 흙으로 풀림."""
    g = Cv(16, 16); T.regolith(g, 0, (ox // 16 + oy // 16 * 3) % 4); c.a[oy:oy + 16, ox:ox + 16] = g.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    inner = {}
    for y in range(16):
        for x in range(16):
            d = 99
            if not m & N: d = min(d, y)
            if not m & S: d = min(d, 15 - y)
            if not m & W: d = min(d, x)
            if not m & E: d = min(d, 15 - x)
            j = 2 + hsh(ox + x, oy + y, 7) % 2
            if d > j:
                P(x, y, K('regolith', 1 if hsh(ox + x, oy + y, 9) % 23 else 0)); inner[(x, y)] = 1
            elif d == j: P(x, y, K('regolith', 2 if hsh(ox + x, oy + y, 3) % 3 else 1))
    vert = bool(m & (N | S)) and not (m & (W | E)) or m in (N, S, N | S)
    hor = bool(m & (W | E)) and not (m & (N | S)) or m in (W, E, W | E)
    for k in range(16):
        if vert:
            for x in (5, 10):
                if (x, k) in inner: P(x, k, K('regolith', 0))
        if hor:
            for y in (5, 10):
                if (k, y) in inner: P(k, y, K('regolith', 0))


def at_rail(c, m, ox, oy):
    """자기부상 궤도: 자갈 침목 바닥 + 이웃 방향 두 줄 레일(윗면 밝음) + 가운데 시안 유도선 + 교차 허브 판."""
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    for y in range(16):
        for x in range(16): P(x, y, K('conc', -2 if hsh(ox + x, oy + y, 21) % 5 else -1))
    arms = {N: (0, 8), S: (8, 16), W: (0, 8), E: (8, 16)}
    vert = [d for d in (N, S) if m & d]; hor = [d for d in (W, E) if m & d]
    def vband(y0, y1):
        for y in range(y0, y1):
            for x in range(4, 12): P(x, y, K('navy', -2))
            if y % 4 == 0:
                for x in range(3, 13): P(x, y, K('rust', -2))
            P(4, y, K('hull', 3)); P(5, y, K('hull', 0)); P(11, y, K('hull', 3)); P(10, y, K('hull', 0)); P(8, y, K('cyan', 2 if y % 3 else 3))
    def hband(x0, x1):
        for x in range(x0, x1):
            for y in range(4, 12): P(x, y, K('navy', -2))
            if x % 4 == 0:
                for y in range(3, 13): P(x, y, K('rust', -2))
            P(x, 4, K('hull', 3)); P(x, 5, K('hull', 0)); P(x, 11, K('hull', 1)); P(x, 10, K('hull', -1)); P(x, 8, K('cyan', 2 if x % 3 else 3))
    for d in vert: vband(*arms[d])
    for d in hor: hband(*arms[d])
    if m == 0 or (vert and hor) or len(vert) + len(hor) == 1:
        for y in range(4, 12):
            for x in range(4, 12): P(x, y, K('hull', -1))
        for x in range(4, 12): P(x, 4, K('hull', 2)); P(x, 11, K('hull', -3))
        P(7, 7, K('cyan', 3)); P(8, 8, K('cyan', 3)); P(7, 8, K('cyan', 1)); P(8, 7, K('cyan', 1))


def at_lightline(c, m, ox, oy):
    """바닥 안내선 덧그림(투명): 두 줄 굵기 시안 선(심 밝음·가장자리 어두움) — 이웃 방향으로 뻗고, 4칸마다 밝은 화살 점."""
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    hub = m == 0 or bin(m).count('1') != 2 or m in (N | E, E | S, S | W, W | N)
    if hub: 
        for y in (6, 7, 8, 9):
            for x in (6, 7, 8, 9): P(x, y, K('cyan', 0 if x in (6, 9) or y in (6, 9) else 2))
    for d in (N, E, S, W):
        if not m & d: continue
        rng = range(0, 7) if d in (N, W) else range(9, 16)
        for k in rng:
            if d in (N, S): P(7, k, K('cyan', 2)); P(8, k, K('cyan', 0))
            else: P(k, 7, K('cyan', 2)); P(k, 8, K('cyan', 0))
        kk = 3 if d in (N, W) else 12
        if d in (N, S): P(7, kk, K('glow', 1))
        else: P(kk, 7, K('glow', 1))
    if m in (N | S,):
        for k in range(16): P(7, k, K('cyan', 2)); P(8, k, K('cyan', 0))
    if m in (W | E,):
        for k in range(16): P(k, 7, K('cyan', 2)); P(k, 8, K('cyan', 0))


def autosheet(fn, **kw):
    def draw(c):
        for m in range(16): fn(c, m, (m % 4) * 16, (m // 4) * 16, **kw)
    return draw


def auto2(id_, name, fn, kind=TERRAIN, **kw):
    import sf_core as C
    old = C.PIECES[id_]
    piece2(id_, name, 4, 4, kind, group='terrain', tags=old['tags'], desc=old.get('desc', ''))(autosheet(fn, **kw))
    T.AUTO[id_].update(name=name)


auto2('at-deck', 'floating station deck autotile: plated floor, back rail, side rims and hull front face with cyan strip, 16 variants', at_deck)
auto2('at-wall-hull', 'hull bulkhead ceiling autotile: dark plated top with lit rims, 16 variants', at_wall, mat='hull')
auto2('at-wall-white', 'white lab wall ceiling autotile: plated top with lit rims and cyan edge, 16 variants', at_wall, mat='white')
auto2('at-wall-viewport', 'viewport wall ceiling autotile (front face strip carries the windows), 16 variants', at_wall, mat='viewport')
auto2('at-road', 'night city asphalt road autotile with concrete curb on open sides, 16 variants', at_road)
auto2('at-regolith-path', 'compacted moon regolith road autotile with wheel ruts and berm edges, 16 variants', at_regolith_path)
auto2('at-rail', 'maglev track autotile: twin rails, sleepers and cyan guide line toward neighbours, 16 variants', at_rail)
auto2('at-lightline', 'floor guide light decal autotile, cyan line toward neighbours, transparent, 16 variants', at_lightline, kind=FLAT)

# wall-face-* 는 QA 개선 패스에서 직접 쓴 함수(sf_terrain.wall_face) — v2 로 표시.
for _m in ('hull', 'white', 'viewport'):
    import sf_core as _C
    _o = _C.PIECES['wall-face-' + _m]
    piece2('wall-face-' + _m, _o['name'], 4, 2, TERRAIN, group='terrain', tags=_o['tags'], desc=_o['desc'])(lambda c, _m=_m: T.wall_face(c, _m))

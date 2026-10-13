"""sf_station 바닥·벽·오토타일 — 갑판 바닥 · 연구실/승무원/화물 바닥 · 레골리스 · 네온 거리 아스팔트·보도 · 우주 공허 + 4방향 오토타일 8벌(4×4 시트, 인덱스 = 마스크).
마스크 비트: N=1 E=2 S=4 W=8 (그 방향 이웃이 같은 그룹이면 켠다). 시트 한 장(64×64)을 kind terrain/flat 한 그림으로 관문에 낸다 — 칸 해시는 영수증이 들고 있다.
단일 바닥은 변형 묶음(가로 줄)을 한 장으로 낸다."""
from sf_core import *

TERRAIN, FLAT = 'terrain', 'flat'


def noise_fill(c, base, ramp_t=(-1, 0, 1), seed=0, x0=0, y0=0, w=16, h=16):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            n = hsh(x, y, seed) % 12
            t = ramp_t[0] if n < 3 else ramp_t[2] if n == 11 else ramp_t[1]
            c.P(x, y, K(base, t))


# ------------------------------------------------------------------ 바닥 타일(16×16)
def deck_plate(c, ox, v):
    """청회색 갑판 판: 위·왼 이음선(어두움)+바로 안쪽 밝은 줄, 모서리 리벳, 변형마다 얼룩·환기홈."""
    noise_fill(c, 'hull', (-2, -2, -1), v + 3, ox, 0)
    c.HL(ox, 0, 16, K('hull', -3)); c.VL(ox, 0, 16, K('hull', -3))
    c.HL(ox + 1, 1, 15, K('hull', 0)); c.VL(ox + 1, 1, 15, K('hull', 0))
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)): c.P(ox + x, y, K('hull', 2))
    if v == 1: c.R(ox + 6, 6, 4, 4, K('hull', -3)); c.HL(ox + 7, 7, 2, K('hull', 1))
    if v == 2:
        for k in range(5): c.P(ox + 5 + hsh(k, 1, 5) % 6, 5 + hsh(k, 2, 5) % 6, K('hull', 1 - k % 2 * 3))
    if v == 3: c.HL(ox + 4, 8, 8, K('hull', -3)); c.HL(ox + 4, 9, 8, K('hull', 1))


def deck_grate(c, ox, v):
    c.R(ox, 0, 16, 16, K('cable', 0))
    for j in range(0, 16, 2): c.HL(ox, j, 16, K('hull', -2 if j % 4 == 0 else -1))
    for i in range(0, 16, 4): c.VL(ox + i, 0, 16, K('hull', -3))
    for k in range(3 + v * 2): c.P(ox + 1 + hsh(k, v, 8) % 14, 1 + 2 * (hsh(k, v, 9) % 7), K('cyan', -1 + (k % 2)))
    c.HL(ox, 0, 16, K('hull', 0)); c.VL(ox, 0, 16, K('hull', 0))


def deck_hazard(c, ox, v):
    for y in range(16):
        for x in range(16):
            on = ((x + y + (4 if v else 0)) // 4) % 2 == 0
            c.P(ox + x, y, K('yellow', 1 + (1 if y % 4 == 0 else 0)) if on else K('cable', 0 + (1 if x % 4 == 0 else 0)))
    c.HL(ox, 0, 16, K('cable', -2)); c.HL(ox, 15, 16, K('cable', -2))


def deck_lane(c, ox, v, vertical):
    deck_plate(c, ox, 0 if v == 0 else 2)
    for k in range(16):
        on = (k // 4) % 2 == 0 if v == 0 else (k // 6) % 2 == 0
        if vertical: c.R(ox + 6, k, 4, 1, K('cyan', 1 if on else -2)); c.P(ox + 7, k, K('cyan', 3 if on else -1))
        else: c.R(ox + k, 6, 1, 4, K('cyan', 1 if on else -2)); c.P(ox + k, 7, K('cyan', 3 if on else -1))


def lab_floor(c, ox, v):
    for y in range(16):
        for x in range(16):
            blk = ((x // 8) + (y // 8) + v) % 2
            c.P(ox + x, y, K('white', 2 if blk else 3))
    c.HL(ox, 0, 16, K('white', -1)); c.HL(ox, 8, 16, K('white', -1)); c.VL(ox, 0, 16, K('white', -1)); c.VL(ox + 8, 0, 16, K('white', -1))
    c.HL(ox + 1, 1, 7, K('white', 5)); c.HL(ox + 9, 9, 7, K('white', 5))
    if v: c.P(ox + 12, 4, K('cyan', 1)); c.P(ox + 3, 12, K('cyan', 0))


def crew_floor(c, ox, v):
    noise_fill(c, 'navy', (0, 1, 2), v + 11, ox, 0)
    for y in range(0, 16, 4):
        for x in range((2 if (y // 4) % 2 else 0), 16, 4): c.P(ox + x, y + 1, K('navy', 3)); c.P(ox + x + 1, y + 2, K('navy', -1))
    c.HL(ox, 15, 16, K('navy', -2)); c.VL(ox + 15, 0, 16, K('navy', -2))
    if v: c.R(ox + 5, 5, 6, 1, K('orange', 0)); c.R(ox + 5, 10, 6, 1, K('orange', -1))


def cargo_floor(c, ox, v):
    noise_fill(c, 'deck', (0, 0, 1), v + 21, ox, 0)
    c.HL(ox, 0, 16, K('deck', -2)); c.VL(ox, 0, 16, K('deck', -2)); c.HL(ox + 1, 1, 15, K('deck', 2))
    if v == 0: c.HL(ox, 7, 16, K('yellow', 0)); c.HL(ox, 8, 16, K('yellow', 1))
    else:
        c.VL(ox + 7, 0, 16, K('yellow', 0)); c.VL(ox + 8, 0, 16, K('yellow', 1))
    for (x, y) in ((3, 3), (12, 12)): c.P(ox + x, y, K('deck', 3))


def glass_floor(c, ox, v):
    c.R(ox, 0, 16, 16, K('star', -1))
    for k in range(9 + 3 * v):
        c.P(ox + hsh(k, v, 31) % 14 + 1, hsh(k, v, 32) % 14 + 1, K('star', 2 + (k % 3 == 0) * 2))
    c.HL(ox, 0, 16, K('hull', 1)); c.VL(ox, 0, 16, K('hull', 1)); c.HL(ox, 15, 16, K('hull', -2)); c.VL(ox + 15, 0, 16, K('hull', -2))
    c.HL(ox + 2, 3 + v, 6, K('glass', 3)); c.P(ox + 9, 3 + v, K('glass', 4))


def void_star(c, ox, v):
    for y in range(16):
        for x in range(16): c.P(ox + x, y, K('star', -3 + (1 if hsh(x // 4, y // 4, v + 41) % 7 == 0 else 0) + (1 if hsh(x // 6, y // 5, 45) % 9 == 0 else 0)))
    for k in range(3 + (v % 2) * 2):
        x, y = ox + 1 + hsh(k, v, 51) % 14, 1 + hsh(k, v, 52) % 14
        c.P(x, y, K('star', 2 + (k + v) % 3))
        if (k + v) % 4 == 0: c.P(x + 1, y, K('star', 0)); c.P(x, y + 1, K('star', 0))


def regolith(c, ox, v):
    noise_fill(c, 'regolith', (-1, 0, 1), v + 61, ox, 0)
    for k in range(6):
        x, y = hsh(k, v, 62) % 13 + 1, hsh(k, v, 63) % 13 + 1
        c.P(ox + x, y, K('regolith', 2)); c.P(ox + x + 1, y + 1, K('regolith', -2))
    if v >= 2:                                           # 작은 크레이터(어두운 안쪽 + 밝은 둘레)
        cx, cy = 5 + (v - 2) * 5, 6 + (v - 2) * 2
        c.ell(ox + cx, cy, 3, 2, K('regolith', -2)); c.ell(ox + cx + 1, cy + 1, 2, 1, K('regolith', -3)); c.HL(ox + cx - 3, cy - 2, 6, K('regolith', 3))


def landing_plate(c, ox, v):
    noise_fill(c, 'conc', (-1, 0, 0), v + 71, ox, 0)
    c.HL(ox, 0, 16, K('conc', -3)); c.VL(ox, 0, 16, K('conc', -3)); c.HL(ox + 1, 1, 15, K('conc', 2))
    if v: hazard(c, ox, 12, 16, 4, 'yellow', 'cable', 4)
    for (x, y) in ((3, 4), (12, 9)): c.P(ox + x, y, K('conc', 3))


def asphalt(c, ox, v):
    noise_fill(c, 'navy', (-1, 0, 1), v + 81, ox, 0)
    if v in (0, 2): c.P(ox + 4 + v * 3, 5, K('cyan', 0)); c.P(ox + 11, 11 - v, K('magenta', 0))
    if v == 1: c.line(ox + 3, 4, ox + 9, 9, K('navy', -2)); c.line(ox + 9, 9, ox + 12, 8, K('navy', -2))
    if v == 3:
        c.R(ox + 4, 9, 7, 2, K('navy', 2)); c.HL(ox + 5, 9, 3, K('magenta', 1)); c.HL(ox + 8, 10, 2, K('cyan', 1))      # 젖은 반사


def lane_dash(c, ox, v):
    asphalt(c, ox, 0)
    if v == 0: c.R(ox + 1, 7, 6, 2, K('white', 3)); c.R(ox + 9, 7, 6, 2, K('white', 3)); c.HL(ox + 1, 7, 6, K('white', 5)); c.HL(ox + 9, 7, 6, K('white', 5))
    else: c.R(7, 1, 2, 6, K('white', 3)) if False else None; c.R(ox + 7, 1, 2, 6, K('white', 3)); c.R(ox + 7, 9, 2, 6, K('white', 3)); c.VL(ox + 7, 1, 6, K('white', 5)); c.VL(ox + 7, 9, 6, K('white', 5))


def crosswalk(c, ox, v):
    asphalt(c, ox, 0)
    for k in range(0, 16, 4):
        if v == 0: c.R(ox + 1, k + 1, 14, 2, K('white', 3)); c.HL(ox + 1, k + 1, 14, K('white', 5))
        else: c.R(ox + k + 1, 1, 2, 14, K('white', 3)); c.VL(ox + k + 1, 1, 14, K('white', 5))


def sidewalk(c, ox, v):
    for y in range(16):
        for x in range(16): c.P(ox + x, y, K('conc', 1 + (1 if ((x // 8) + (y // 8) + v) % 2 else 0) + (1 if hsh(x, y, v + 91) % 13 == 0 else 0)))
    c.HL(ox, 0, 16, K('conc', -2)); c.HL(ox, 8, 16, K('conc', -2)); c.VL(ox, 0, 16, K('conc', -2)); c.VL(ox + 8, 0, 16, K('conc', -2))
    c.HL(ox + 1, 1, 7, K('conc', 4)); c.HL(ox + 9, 9, 7, K('conc', 4))
    if v: c.P(ox + 12, 4, K('violet', 1)); c.P(ox + 3, 12, K('cyan', 0))


def puddle(c, ox, v):
    cx, cy, rx, ry = (8, 8, 6, 3) if v == 0 else (7, 9, 5, 4)
    c.ell(ox + cx, cy, rx, ry, K('navy', -2)); c.ell(ox + cx, cy - 1, rx - 2, max(1, ry - 2), K('navy', -1))
    c.HL(ox + cx - 3, cy - 1, 3, K('magenta', 2)); c.HL(ox + cx + 1, cy, 2, K('cyan', 2)); c.P(ox + cx - 4, cy + 1, K('violet', 2))


def hydro_soil(c, ox, v):
    noise_fill(c, 'rust', (-3, -2, -1), v + 101, ox, 0)
    c.HL(ox, 0, 16, K('rust', -3)); c.HL(ox, 15, 16, K('rust', -3))
    for k in range(5):
        x, y = hsh(k, v, 102) % 12 + 2, hsh(k, v, 103) % 9 + 5
        c.P(ox + x, y, K('plant', 2)); c.P(ox + x, y - 1, K('plant', 3)); c.P(ox + x - 1, y - 2, K('plant', 1)); c.P(ox + x + 1, y - 2, K('plant', 1))


def strip(fn, n):
    def draw(c):
        for v in range(n): fn(c, v * 16, v)
    return draw


def reg(id_, name, n, fn, kind=TERRAIN, tags=(), desc=''):
    piece(id_, name, n, 1, kind, group='terrain', tags=['바닥'] + list(tags), desc=desc)(strip(fn, n))


reg('deck-plate', 'station deck floor plating, four variants (steel blue panels with rivets)', 4, deck_plate, tags=['갑판'], desc='정거장 복도·광장 기본 바닥. 네 변형을 섞는다.')
reg('deck-grate', 'dark metal grating floor with faint cyan glow below, two variants', 2, deck_grate, tags=['격자', '기관실'], desc='기관실·점검 통로 바닥.')
reg('deck-hazard', 'yellow and black diagonal hazard stripe floor, two variants', 2, deck_hazard, tags=['위험'], desc='에어록 앞·화물 구역 경계.')
reg('deck-lane-h', 'station corridor floor with horizontal cyan guide light strip, two variants', 2, lambda c, ox, v: deck_lane(c, ox, v, False), tags=['복도', '가로'], desc='가로 복도 중앙 안내등.')
reg('deck-lane-v', 'station corridor floor with vertical cyan guide light strip, two variants', 2, lambda c, ox, v: deck_lane(c, ox, v, True), tags=['복도', '세로'], desc='세로 복도 중앙 안내등.')
reg('lab-floor', 'white ceramic laboratory floor tiles with grout lines, two variants', 2, lab_floor, tags=['연구실', '의무실'], desc='연구실·의무실 바닥.')
reg('crew-floor', 'navy rubber crew quarters floor with small dots, two variants', 2, crew_floor, tags=['숙소'], desc='승무원 숙소·휴게실 바닥.')
reg('cargo-floor', 'dark cargo bay floor with yellow safety lines, two variants', 2, cargo_floor, tags=['화물'], desc='화물칸·격납고 바닥.')
reg('glass-floor', 'transparent viewport floor showing stars below, two variants', 2, glass_floor, tags=['유리', '전망'], desc='전망 통로 유리 바닥.')
reg('void-star', 'deep space void with scattered stars, four variants', 4, void_star, tags=['우주', '공허'], desc='정거장 바깥 배경 바닥. 갑판 오토타일 가장자리 밖.')
reg('regolith', 'grey moon regolith ground with pebbles and small craters, four variants', 4, regolith, tags=['달', '레골리스'], desc='달 기지 기본 땅. 네 변형을 섞는다.')
reg('landing-plate', 'concrete landing plate with hazard border, two variants', 2, landing_plate, tags=['착륙장'], desc='착륙 패드·격납고 앞.')
reg('asphalt', 'night city asphalt road, four variants (cracks and wet neon reflections)', 4, asphalt, tags=['도로', '아스팔트'], desc='네온 거리 도로 기본.')
reg('lane-dash', 'asphalt road with white dashed center line, horizontal and vertical', 2, lane_dash, tags=['차선'], desc='도로 중앙 점선(가로·세로).')
reg('crosswalk', 'asphalt road with white zebra crosswalk, horizontal and vertical', 2, crosswalk, tags=['횡단보도'], desc='횡단보도(가로·세로).')
reg('sidewalk', 'grey concrete sidewalk paving with faint neon glints, two variants', 2, sidewalk, tags=['보도'], desc='거리 보도.')
reg('puddle', 'wet puddle reflecting magenta and cyan neon, two variants (overlay on road)', 2, puddle, kind=FLAT, tags=['물웅덩이', '덧그림'], desc='도로·보도 위 덧그림.')
reg('hydro-soil', 'dark hydroponic soil bed with green sprouts, two variants', 2, hydro_soil, tags=['수경재배', '흙'], desc='온실·농장 모듈 바닥.')


# ------------------------------------------------------------------ 4방향 오토타일(마스크 0..15, 시트 4×4: 인덱스 = 마스크, 행 = 마스크//4, 열 = 마스크%4)
N, E, S, W = 1, 2, 4, 8


def at_deck(c, m, ox, oy):
    """갑판 판 + 이웃 없는 쪽: 북=뒷난간 띠, 서·동=옆 테두리, 남=앞면 선체(아래 6행)."""
    t = Cv(16, 16); deck_plate(t, 0, (ox // 16 + oy // 16) % 4); a = t.a
    c.a[oy:oy + 16, ox:ox + 16] = a
    def P(x, y, col): c.P(ox + x, oy + y, col)
    if not m & N:
        for x in range(16): P(x, 0, K('hull', 4)); P(x, 1, K('hull', 2)); P(x, 2, K('hull', -2))
    if not m & W:
        for y in range(16): P(0, y, K('hull', 3)); P(1, y, K('hull', 0)) if y > 2 else None
    if not m & E:
        for y in range(16): P(15, y, K('hull', -3)); P(14, y, K('hull', -1)) if y > 2 else None
    if not m & S:
        for y in range(10, 16):
            for x in range(16): P(x, y, K('hull', 0 if y < 15 else -3))
        for x in range(16): P(x, 10, K('hull', 4)); P(x, 11, K('hull', 1))
        for x in range(3, 16, 5): P(x, 13, K('hull', 2)); P(x + 1, 13, K('hull', -2))
        P(0, 12, K('hull', 3)) if m & W else None
        for y in range(10, 16): P(0 if not m & W else 15, y, K('hull', -2)) if False else None
        c.HL(ox, oy + 15, 16, K('shadow', 0))


def wall_mat(mat):
    return {'hull': ('hull', 'orange'), 'white': ('white', 'cyan'), 'viewport': ('hull', 'cyan')}[mat]


def at_wall(c, m, ox, oy, mat='hull'):
    """격벽: 남쪽 이웃이 벽이 아니면 위 6행 윗면 + 아래 10행 앞면(판넬·줄), 남쪽이 벽이면 윗면만. 서·동·북은 모서리 띠."""
    base, acc = wall_mat(mat)
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    caph = 16 if m & S else 6
    for y in range(caph):
        for x in range(16):
            tone = 3 - (1 if (y < 2 and not m & N) else 0)
            if (x % 8 == 7 and y % 4 != 0): tone = 2
            P(x, y, K(base, tone))
        if y % 5 == 4 and y != caph - 1: c.HL(ox + 1, oy + y, 14, K(base, 2))
    if not m & N:
        for x in range(16): P(x, 0, K(base, -1)); P(x, 1, K(base, 4))
    if not m & S:
        for y in range(6, 16):
            for x in range(16):
                f = -2 if y > 12 else -1
                P(x, y, K(base, f))
        for x in range(16): P(x, 6, K(base, 4)); P(x, 7, K(base, 1))
        for x in range(0, 16, 8): c.VL(ox + x, oy + 8, 7, K(base, -3)); c.VL(ox + x + 1, oy + 8, 7, K(base, 0))
        if mat == 'viewport':
            for x in range(2, 14): P(x, 9, K('hull', 4)); P(x, 13, K('hull', -3))
            for y in range(10, 13):
                for x in range(2, 14): P(x, y, K('star', -1 + (1 if hsh(x, y, ox + 5) % 11 == 0 else 0)))
            P(5, 11, K('star', 3)); P(10, 10, K('star', 2)); P(8, 12, K('glass', 3)); c.HL(ox + 3, oy + 10, 4, K('glass', 2))
        else:
            c.HL(ox, oy + 12, 16, K(acc, 1 if mat == 'hull' else 2)); c.HL(ox, oy + 13, 16, K(acc, -1))
            c.P(ox + 3, oy + 9, K('cyan', 3) if mat == 'white' else K('orange', 3))
        for x in range(16): P(x, 15, K('shadow', 1))
    if not m & W:
        for y in range(16): P(0, y, K(base, 4 if y < caph else 2)); P(1, y, K(base, 1)) if y < caph else None
    if not m & E:
        for y in range(16): P(15, y, K(base, -2)); P(14, y, K(base, 0)) if y < caph else None


def at_road(c, m, ox, oy):
    """아스팔트 + 이웃이 도로가 아닌 쪽에 연석(북·서·동 = 윗면 띠, 남 = 연석 앞면)."""
    t = Cv(16, 16); asphalt(t, 0, (ox // 16 + oy // 16) % 3); c.a[oy:oy + 16, ox:ox + 16] = t.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    if not m & N:
        for x in range(16): P(x, 0, K('conc', 4)); P(x, 1, K('conc', 2)); P(x, 2, K('conc', 0)); P(x, 3, K('navy', -3))
    if not m & W:
        for y in range(16): P(0, y, K('conc', 4)); P(1, y, K('conc', 2)); P(2, y, K('navy', -3))
    if not m & E:
        for y in range(16): P(15, y, K('conc', 0)); P(14, y, K('conc', 3)); P(13, y, K('navy', -3))
    if not m & S:
        for y in range(12, 16):
            for x in range(16): P(x, y, K('conc', 3 if y == 12 else 1 if y < 15 else -2))
        for x in range(16): P(x, 11, K('navy', -3))


def at_regolith_path(c, m, ox, oy):
    """다져진 길(밝고 바퀴 자국) — 이웃이 길이 아닌 쪽은 레골리스 땅으로 들쭉날쭉 풀린다."""
    g = Cv(16, 16); regolith(g, 0, (ox // 16 + oy // 16) % 2); c.a[oy:oy + 16, ox:ox + 16] = g.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    for y in range(16):
        for x in range(16):
            d = 99
            if not m & N: d = min(d, y)
            if not m & S: d = min(d, 15 - y)
            if not m & W: d = min(d, x)
            if not m & E: d = min(d, 15 - x)
            if d > 2 + hsh(x, y, 7) % 3 - 1:
                P(x, y, K('regolith', 1 + (1 if hsh(x, y, 5) % 9 == 0 else 0) - (1 if hsh(x, y, 6) % 9 == 0 else 0)))
    for y in range(16):                                       # 바퀴 자국 두 줄(가로 길은 가로, 세로는 세로) — 이어지는 방향으로만
        if (m & N) or (m & S):
            if (m & N) and y < 8 or (m & S) and y >= 8: P(5, y, K('regolith', -1)); P(10, y, K('regolith', -1))
    for x in range(16):
        if (m & W and x < 8) or (m & E and x >= 8): P(x, 5, K('regolith', -1)); P(x, 10, K('regolith', -1))


def at_rail(c, m, ox, oy):
    """자기부상 궤도: 자갈 바닥 위 팔이 이웃 방향으로 뻗는다. 중앙 허브 + 시안 가이드 선."""
    noise = Cv(16, 16); noise_fill(noise, 'conc', (-3, -2, -2), 7); c.a[oy:oy + 16, ox:ox + 16] = noise.a
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    def bed(x0, y0, w, h):
        for yy in range(y0, y0 + h):
            for xx in range(x0, x0 + w): P(xx, yy, K('navy', -1))
    bed(5, 5, 6, 6)
    arms = {N: (5, 0, 6, 6), S: (5, 10, 6, 6), W: (0, 5, 6, 6), E: (10, 5, 6, 6)}
    for d, r in arms.items():
        if m & d: bed(*r)
    for d, r in arms.items():
        if m & d:
            x0, y0, w, h = r
            if d in (N, S): [P(x0, y, K('hull', 3)) or P(x0 + w - 1, y, K('hull', 3)) or P(x0 + 2, y, K('cyan', 2 if y % 2 else 0)) for y in range(y0, y0 + h)]
            else: [P(x, y0, K('hull', 3)) or P(x, y0 + h - 1, K('hull', 3)) or P(x, y0 + 2, K('cyan', 2 if x % 2 else 0)) for x in range(x0, x0 + w)]
    for (x, y) in ((5, 5), (10, 5), (5, 10), (10, 10)): P(x, y, K('hull', 4))
    if not m & N: c.HL(ox + 5, oy + 5, 6, K('hull', 3))
    if not m & S: c.HL(ox + 5, oy + 10, 6, K('hull', -2))


def at_lightline(c, m, ox, oy):
    """갑판 위 덧그림 안내선(투명 바탕): 이웃 방향으로 시안 선이 뻗는다."""
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    P(7, 7, K('cyan', 3)); P(8, 7, K('cyan', 3)); P(7, 8, K('cyan', 3)); P(8, 8, K('cyan', 3))
    for d in (N, E, S, W):
        if not m & d: continue
        for k in range(8):
            on = k % 4 != 3
            if not on: continue
            if d == N: P(7, 6 - k, K('cyan', 2)); P(8, 6 - k, K('cyan', 3))
            if d == S: P(7, 9 + k, K('cyan', 2)); P(8, 9 + k, K('cyan', 3))
            if d == W: P(6 - k, 7, K('cyan', 3)); P(6 - k, 8, K('cyan', 2))
            if d == E: P(9 + k, 7, K('cyan', 3)); P(9 + k, 8, K('cyan', 2))
    if m == 0: c.R(ox + 6, oy + 6, 4, 4, K('cyan', 1)); P(7, 7, K('glow', 1))


def autosheet(fn, **kw):
    def draw(c):
        for m in range(16): fn(c, m, (m % 4) * 16, (m // 4) * 16, **kw) if kw else fn(c, m, (m % 4) * 16, (m // 4) * 16)
    return draw


AUTO = {}   # id → (이름, 연결 기준 설명) — 굽기가 오토타일 그룹으로 만든다


def auto(id_, name, fn, kind=TERRAIN, desc='', tags=(), **kw):
    piece(id_, name, 4, 4, kind, group='terrain', tags=['오토타일'] + list(tags), desc=desc)(autosheet(fn, **kw))
    AUTO[id_] = dict(name=name, kind=kind, desc=desc)


auto('at-deck', 'station deck floor autotile sheet with back rail, side rims and hull front face, 16 variants', at_deck, desc='갑판 바닥 가장자리: 우주 공허 위에 뜬 정거장 바닥. 이웃 없는 남쪽은 선체 앞면.', tags=['갑판'])
auto('at-wall-hull', 'hull bulkhead wall autotile: top cap and front panel face, 16 variants', at_wall, desc='선체 격벽(청회색+주황 띠). 남쪽이 벽이 아니면 앞면.', tags=['벽', '선체'], mat='hull')
auto('at-wall-white', 'white ceramic lab wall autotile: top cap and front panel face with cyan stripe, 16 variants', at_wall, desc='연구실·의무실 흰 벽.', tags=['벽', '연구실'], mat='white')
auto('at-wall-viewport', 'hull wall with star viewport window on the front face, autotile, 16 variants', at_wall, desc='전망창 벽: 앞면에 우주 창.', tags=['벽', '전망창'], mat='viewport')
auto('at-road', 'night city asphalt road autotile with concrete curb on open sides, 16 variants', at_road, desc='네온 거리 도로(이웃 없는 쪽은 연석).', tags=['도로'])
auto('at-regolith-path', 'compacted moon regolith road autotile with wheel tracks and ragged edges, 16 variants', at_regolith_path, desc='달 기지 길.', tags=['달', '길'])
auto('at-rail', 'maglev rail track autotile connecting to neighbors with cyan guide line, 16 variants', at_rail, desc='자기부상 궤도(연결된 방향으로 뻗음).', tags=['궤도'])
auto('at-lightline', 'floor guide light line decal autotile, cyan dashes connecting to neighbors, transparent, 16 variants', at_lightline, kind=FLAT, desc='갑판 위 투명 안내선 덧그림.', tags=['안내선'])

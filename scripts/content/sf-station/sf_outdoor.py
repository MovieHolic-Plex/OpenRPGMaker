"""sf_station 야외 조각(줄 A — 우주 정거장·식민지·달 기지). sf_base 의 12종 위에 얹는 기본 조립 키트."""
from sf_core import *


def wins(c, x, y, n, ww, wh, gap, lit='cyan', every=2, seed=0, glass='glass'):
    """정면 창 줄: 틀 + 창턱 + (켜진 창: 천장등 띠·바닥빛 / 꺼진 창: 유리 그러데이션·대각 반사)."""
    for i in range(n):
        xx = x + i * (ww + gap)
        window(c, xx, y, ww, wh, lit if (i + seed) % every == 0 else None, seed=i + seed, frame=K('hull', -3), sill=K('hull', 2))


def baseline(c, w, y, mat='hull'):
    c.HL(0, y, w, K(mat, 2)); c.HL(0, y + 1, w, K(mat, -3))


def stripe(c, x, y, w, col='orange'):
    c.HL(x, y, w, K(col, 2)); c.HL(x, y + 1, w, K(col, -1))


def door_low(c, x, y, w, h):
    c.R(x - 1, y - 1, w + 2, h + 1, K('hull', -2)); c.R(x, y, w, h, K('cable', 0)); c.HL(x, y, w, K('cyan', 2)); c.VL(x + w // 2, y + 1, h - 1, K('hull', -1))
    hazard(c, x, y + h - 2, w, 2)


# ------------------------------------------------------------------ 돔
@piece('hab-dome-s', '소형 거주 돔(유리 돔 + 원통 기단)', 3, 3, 'structure', group='outdoor', solid=[(x, 2) for x in range(3)], tags=['돔', '거주구'], desc='작은 식민지 돔. 문은 정면 아래.')
def _(c):
    cyl(c, 24, 28, 22, 9, 9, 'hull', tt=3, ft=-1, ol=False)
    dome(c, 24, 25, 17, 7, 'glass', ribs=2)
    door_panel(c, 20, 33, 8, 9)
    for i in (7, 40): c.HL(i, 35 + abs(24 - i) // 8, 3, K('cyan', 3))
    c.outline()


@piece('hab-dome-l', '대형 거주 돔(큰 유리 돔 + 두 줄 원통 기단)', 6, 5, 'structure', group='outdoor', solid=[(x, 4) for x in range(6)] + [(x, 3) for x in (0, 1, 4, 5)], tags=['돔', '거주구', '대형'], desc='식민지 중심 대형 돔. 문은 정면 아래.')
def _(c):
    cyl(c, 48, 46, 45, 17, 17, 'hull', tt=3, ft=-1, ol=False, bands=1)
    dome(c, 48, 42, 37, 14, 'glass', ribs=4)
    door_panel(c, 40, 56, 16, 14)
    for i in range(10, 90, 8):
        if abs(i - 48) > 12: c.HL(i, 62 + abs(48 - i) // 9, 3, K('cyan', 3 if i % 16 else 1))
    c.R(44, 36, 8, 4, K('white', 2)); c.HL(44, 36, 8, K('white', 4))
    c.outline()


@piece('greenhouse-dome', '온실 돔(안에 초록 식물이 보이는 유리 돔)', 4, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(4)] + [(0, 2), (3, 2)], tags=['돔', '온실', '식물'], desc='수경 재배 온실 돔.')
def _(c):
    cyl(c, 32, 38, 29, 12, 10, 'hull', tt=3, ft=-1, ol=False)
    dome(c, 32, 34, 24, 10, 'glass', ribs=2)
    for k, (px, py, r) in enumerate(((22, 36, 5), (31, 33, 6), (41, 36, 5), (27, 30, 4), (37, 30, 4))):
        for y in range(py - r // 2 - 1, py + 2):
            for x in range(px - r, px + r + 1):
                if ((x - px) / (r + .5)) ** 2 + ((y - py) / (r / 2 + 1)) ** 2 <= 1 and ((x - 32) / 24.5) ** 2 + ((y - 34) / 10.5) ** 2 < .8:
                    c.P(x, y, K('plant', 2 + (1 if (x + y + k) % 3 == 0 else 0) - (1 if y > py else 0)))
    for i in range(3): c.P(30 + i, 24 + (i % 2), K('glow', 0))
    door_panel(c, 27, 44, 10, 9)
    for i in (9, 50): c.HL(i, 47 + abs(32 - i) // 7, 3, K('green', 3))
    c.outline()


# ------------------------------------------------------------------ 모듈 건물
@piece('hab-module', '주거 모듈(조립식 평지붕 건물, 창 줄과 문)', 4, 3, 'structure', group='outdoor', solid=[(x, 2) for x in range(4)] + [(0, 1), (3, 1)], tags=['건물', '모듈', '주거'], desc='프리팹 주거 모듈. 문은 정면 가운데.')
def _(c):
    tcube(c, 0, 6, 64, 15, 25, 'white', ins=5, tt=3, ft=-2, topmat='hull', ol=False)
    roof_detail(c, 7, 8, 50, 12, 'hull', seed=1, hatch=False)
    stripe(c, 1, 22, 62, 'orange')
    wins(c, 5, 27, 2, 8, 6, 3); wins(c, 41, 27, 2, 8, 6, 3)
    door_low(c, 27, 30, 10, 14)
    texture_face(c, 0, 22, 64, 24, 'white', -2, seam=8, band=0, seed=1)
    baseline(c, 64, 46); c.outline()


@piece('hab-module-3', '대형 주거 모듈(긴 평지붕, 창 두 줄과 가운데 문)', 6, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(6)] + [(0, 2), (5, 2)], tags=['건물', '모듈', '주거'], desc='긴 프리팹 주거동. 문은 정면 가운데.')
def _(c):
    tcube(c, 0, 6, 96, 19, 37, 'hull', ins=8, tt=3, ft=-3, ol=False)
    roof_detail(c, 10, 8, 76, 16, 'hull', seed=2, pipes=True)
    hazard(c, 1, 27, 94, 2)
    wins(c, 6, 33, 2, 10, 8, 4, seed=0); wins(c, 66, 33, 2, 10, 8, 4, seed=1)
    wins(c, 6, 46, 2, 10, 8, 4, seed=1); wins(c, 66, 46, 2, 10, 8, 4, seed=0)
    door_panel(c, 40, 40, 16, 17)
    texture_face(c, 0, 26, 96, 36, 'hull', -3, seam=8, band=12, seed=2)
    baseline(c, 96, 62); c.outline()


@piece('lab-module', '연구 모듈(시안 창이 큰 실험동, 지붕 안테나)', 5, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '연구소', '안테나'], desc='연구 실험동. 문은 정면 가운데.')
def _(c):
    tcube(c, 0, 12, 80, 16, 33, 'white', ins=7, tt=3, ft=-2, topmat='hull', ol=False)
    roof_detail(c, 8, 14, 64, 13, 'hull', seed=0, hatch=False)
    cube(c, 56, 16, 10, 4, 4, 'white', tt=3, ft=-1, ol=False); c.P(60, 18, K('cyan', 3))
    cube(c, 12, 18, 8, 4, 3, 'hull', tt=3, ft=-1, ol=False)
    cube(c, 36, 2, 8, 4, 8, 'hull', tt=3, ft=-1, ol=False)     # 안테나 기둥(굵게) + 윗면
    c.R(38, 0, 4, 2, K('hull', 2)); c.P(39, 0, K('orange', 3))
    stripe(c, 1, 29, 78, 'cyan')
    c.R(6, 35, 68, 8, K('glass', -1)); c.HL(6, 35, 68, K('cyan', 3)); c.HL(6, 43, 68, K('hull', 2))
    for i in range(6, 74, 11): c.VL(i + 11 - 1, 36, 7, K('white', -1)); c.R(i + 2, 38, 6, 3, K('cyan', 1))
    door_low(c, 33, 46, 14, 15)
    texture_face(c, 0, 29, 80, 33, 'white', -2, seam=10, band=0, seed=3)
    baseline(c, 80, 62); c.outline()


@piece('hab-block', '주거 블록(위아래 두 층을 쌓은 건물)', 6, 5, 'structure', group='outdoor', solid=[(x, 4) for x in range(6)] + [(x, 3) for x in (0, 1, 4, 5)], tags=['건물', '블록', '주거'], desc='두 층 주거 블록. 문은 정면 가운데 아래.')
def _(c):
    tcube(c, 0, 38, 96, 12, 29, 'white', ins=6, tt=3, ft=-2, topmat='hull', ol=False)
    roof_detail(c, 8, 40, 80, 8, 'hull', seed=1, hatch=False, vents=False)
    tcube(c, 14, 10, 68, 12, 20, 'hull', ins=5, tt=3, ft=-3, ol=False)
    roof_detail(c, 20, 12, 56, 9, 'hull', seed=2, hatch=False)
    cube(c, 34, 14, 12, 4, 3, 'white', tt=3, ft=-1, ol=False)
    wins(c, 20, 27, 4, 9, 6, 4, seed=1); hazard(c, 15, 22, 66, 2)
    stripe(c, 1, 51, 94, 'orange')
    wins(c, 6, 56, 2, 10, 6, 4); wins(c, 66, 56, 2, 10, 6, 4)
    door_low(c, 41, 55, 14, 12)
    texture_face(c, 0, 51, 96, 18, 'white', -2, seam=8, band=0, seed=4); texture_face(c, 14, 23, 68, 20, 'hull', -3, seam=8, band=0, seed=5)
    baseline(c, 96, 69); c.outline()


@piece('airlock-wide', '화물 에어록(넓은 화물 베이 문)', 5, 3, 'structure', group='outdoor', solid=[(x, 2) for x in range(5)] + [(0, 1), (4, 1)], tags=['에어록', '화물', '문'], desc='선체 바깥 화물 출입구.')
def _(c):
    tcube(c, 0, 4, 80, 15, 27, 'hull', ins=7, tt=3, ft=-3, ol=False)
    cube(c, 10, 7, 14, 5, 3, 'white', tt=3, ft=-1, ol=False); cube(c, 56, 7, 14, 5, 3, 'white', tt=3, ft=-1, ol=False)
    hazard(c, 1, 21, 78, 2)
    c.R(14, 26, 52, 17, K('hull', -2)); c.HL(14, 26, 52, K('hull', 2)); c.R(16, 28, 48, 14, K('cable', 0))
    for j in range(29, 41, 3): c.HL(16, j, 48, K('hull', -1)); c.HL(16, j + 1, 48, K('hull', -3))
    c.VL(40, 28, 14, K('hull', 2)); c.HL(15, 43, 50, K('orange', 3)); c.R(38, 24, 4, 2, K('orange', 3))
    hazard(c, 15, 42, 50, 2)
    texture_face(c, 0, 20, 80, 26, 'hull', -3, seam=8, band=0, seed=6)
    baseline(c, 80, 46); c.outline()


@piece('docking-gate', '도킹 게이트(둥근 도킹 고리와 해치)', 4, 4, 'round_body', group='outdoor', solid=[(x, 3) for x in range(4)] + [(1, 2), (2, 2)], tags=['도킹', '고리'], desc='우주선 도킹 고리.')
def _(c):
    cyl(c, 32, 30, 28, 12, 16, 'white', tt=3, ft=-2, ol=False, bands=1)
    c.ell(32, 30, 21, 8, K('hull', 0)); c.ell(32, 30, 18, 7, K('cable', -1)); c.ell(32, 31, 12, 4, K('cyan', 0)); c.ell(32, 31, 8, 2, K('cyan', 2))
    for x, y in ((6, 28), (57, 28), (32, 20), (14, 38), (50, 38)):
        c.R(x - 2, y - 1, 5, 3, K('orange', 2)); c.HL(x - 2, y - 1, 5, K('orange', 3))
    door_panel(c, 26, 47, 12, 12)
    c.outline()


@piece('tube-h', '연결 통로 튜브(가로로 누운 가압 통로, 깊은 윗면과 유리 창 줄)', 4, 2, 'structure', group='outdoor', solid=[(x, 1) for x in range(4)], tags=['통로', '튜브'], desc='모듈 사이 가압 통로. 가로로 이어 붙인다.')
def _(c):
    tcube(c, 5, 1, 54, 13, 14, 'white', ins=5, tt=3, ft=-2, topmat='hull', ol=False)
    roof_detail(c, 12, 3, 40, 10, 'hull', seed=1, hatch=False, vents=False)
    c.R(10, 17, 44, 6, K('glass', -1)); c.HL(10, 17, 44, K('cyan', 3)); [c.VL(i, 18, 5, K('hull', 1)) for i in range(20, 52, 11)]
    for x in (0, 56):
        cube(c, x, 3, 8, 9, 19, 'hull', tt=3, ft=-2, ol=False); c.HL(x + 1, 19, 6, K('orange', 3))
    stripe(c, 9, 24, 46, 'orange')
    baseline(c, 64, 28, 'hull'); c.outline()


@piece('tube-cross', '통로 교차 허브(네 방향 통로가 만나는 가압 마디)', 2, 2, 'structure', group='outdoor', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['통로', '교차'], desc='통로가 만나는 마디.')
def _(c):
    cube(c, 11, 1, 10, 4, 4, 'hull', tt=3, ft=-2, ol=False)
    cube(c, 8, 6, 16, 7, 12, 'white', tt=3, ft=-2, ol=False, tex='plate')
    cube(c, 0, 10, 10, 5, 10, 'hull', tt=3, ft=-2, ol=False); cube(c, 22, 10, 10, 5, 10, 'hull', tt=3, ft=-2, ol=False)
    cube(c, 10, 23, 12, 3, 5, 'hull', tt=3, ft=-2, ol=False)
    c.R(11, 21, 10, 3, K('glass', -1)); c.HL(11, 21, 10, K('cyan', 3))
    c.P(16, 9, K('orange', 3)); c.outline()


# ------------------------------------------------------------------ 탑·설비 건물
@piece('control-tower', '관제탑(넓은 기단 + 몸통 + 유리 관제실)', 3, 5, 'structure', group='outdoor', solid=[(x, 4) for x in range(3)] + [(0, 3), (2, 3), (1, 3)], tags=['탑', '관제'], desc='착륙장 관제탑.')
def _(c):
    tcube(c, 0, 52, 48, 10, 17, 'hull', ins=4, tt=3, ft=-3, ol=False)
    cube(c, 14, 28, 20, 6, 26, 'white', tt=3, ft=-2, ol=False, tex='plate')
    for j in (40, 47): c.HL(15, j, 18, K('white', -3))
    c.R(17, 38, 14, 3, K('glass', -1)); c.HL(17, 38, 14, K('cyan', 2))
    tcube(c, 6, 10, 36, 9, 12, 'hull', ins=4, tt=3, ft=-2, ol=False, seams=False)
    c.R(9, 22, 30, 7, K('glass', -1)); c.HL(9, 22, 30, K('cyan', 3)); [c.VL(i, 23, 6, K('hull', 2)) for i in (17, 25, 33)]
    cube(c, 18, 3, 12, 4, 4, 'white', tt=3, ft=-1, ol=False); c.R(22, 0, 4, 3, K('hull', 1)); c.P(23, 0, K('orange', 3))
    door_low(c, 19, 62, 10, 6)
    texture_face(c, 0, 62, 48, 8, 'hull', -3, seam=8, band=0, seed=7, grime=2)
    baseline(c, 48, 70); c.outline()


@piece('radome-tower', '레이돔 탑(받침 + 둥근 레이돔)', 3, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(3)] + [(1, 2)], tags=['탑', '레이더'], desc='레이더 돔 탑.')
def _(c):
    cube(c, 6, 36, 36, 10, 18, 'hull', tt=3, ft=-2, ol=False, tex='plate')
    c.R(11, 50, 26, 5, K('glass', -1)); c.HL(11, 50, 26, K('cyan', 2)); door_low(c, 21, 55, 6, 6)
    cyl(c, 24, 24, 17, 8, 14, 'white', tt=3, ft=-2, ol=False)
    c.ell(24, 23, 11, 4, K('white', 4)); c.ell(24, 22, 6, 2, K('white', 5)); c.P(21, 21, K('glow', 2))
    for x in (12, 36): c.R(x, 30, 3, 6, K('cyan', 1))
    c.R(22, 10, 4, 6, K('hull', 1)); c.HL(22, 10, 4, K('hull', 3)); c.P(23, 9, K('orange', 3))
    baseline(c, 48, 62); c.outline()


@piece('reactor-building', '반응로 건물(지붕에 둥근 코어가 솟은 설비동)', 5, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '반응로'], desc='동력 설비동. 문은 정면 가운데.')
def _(c):
    tcube(c, 0, 24, 80, 14, 25, 'hull', ins=6, tt=3, ft=-3, ol=False)
    cyl(c, 40, 25, 17, 6, 8, 'white', tt=3, ft=-2, ol=False, bands=1)
    c.ell(40, 25, 11, 4, K('cyan', 0)); c.ell(40, 25, 7, 2, K('cyan', 2)); c.P(40, 25, K('glow', 2))
    cube(c, 6, 28, 12, 4, 3, 'white', tt=3, ft=-1, ol=False); cube(c, 62, 28, 12, 4, 3, 'white', tt=3, ft=-1, ol=False)
    hazard(c, 1, 40, 78, 2)
    wins(c, 6, 47, 2, 9, 6, 3, lit='orange'); wins(c, 53, 47, 2, 9, 6, 3, lit='orange')
    door_panel(c, 32, 48, 16, 13)
    texture_face(c, 0, 38, 80, 24, 'hull', -3, seam=8, band=0, seed=9)
    baseline(c, 80, 62); c.outline()


@piece('cooling-plant', '냉각 설비(굴뚝 같은 둥근 냉각탑 셋과 배관)', 5, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '냉각'], desc='열 방출 설비. 냉각탑은 지붕 위.')
def _(c):
    tcube(c, 0, 26, 80, 12, 25, 'hull', ins=4, tt=3, ft=-3, ol=False)
    c.R(4, 36, 72, 2, K('rust', 1)); c.HL(4, 36, 72, K('rust', 3))
    for cx in (16, 40, 64):
        cyl(c, cx, 24, 9, 4, 10, 'white', tt=3, ft=-2, ol=False, bands=1)
        c.ell(cx, 24, 6, 2, K('cable', 0)); c.P(cx - 2, 23, K('cyan', 2)); c.P(cx + 2, 24, K('cyan', 1))
    wins(c, 8, 45, 2, 9, 6, 3, lit='cyan'); wins(c, 55, 45, 2, 9, 6, 3, lit='cyan')
    door_low(c, 34, 47, 12, 14)
    stripe(c, 1, 40, 78, 'cyan')
    texture_face(c, 0, 38, 80, 24, 'hull', -3, seam=8, band=0, seed=10)
    baseline(c, 80, 62); c.outline()


@piece('cargo-hangar', '화물 격납고(넓은 롤 셔터 문이 있는 큰 평지붕 건물)', 7, 5, 'structure', group='outdoor', solid=[(x, 4) for x in range(7)] + [(x, 3) for x in (0, 1, 5, 6)], tags=['건물', '격납고', '화물'], desc='화물 격납고. 문은 정면 가운데.')
def _(c):
    tcube(c, 0, 6, 112, 28, 42, 'hull', ins=10, tt=3, ft=-3, ol=False)
    roof_detail(c, 12, 8, 88, 24, 'hull', seed=0, pipes=True)
    cube(c, 18, 12, 14, 6, 4, 'white', tt=3, ft=-1, ol=False)
    hazard(c, 1, 36, 110, 2)
    c.R(20, 42, 72, 30, K('hull', -2)); c.HL(20, 42, 72, K('hull', 2)); c.R(23, 45, 66, 27, K('cable', 0))
    for j in range(46, 70, 4): c.HL(23, j, 66, K('hull', -1)); c.HL(23, j + 1, 66, K('hull', -3))
    c.R(54, 40, 4, 2, K('orange', 3)); c.R(21, 44, 2, 28, K('orange', 2)); c.R(89, 44, 2, 28, K('orange', 2))
    hazard(c, 23, 70, 66, 2)
    wins(c, 4, 52, 1, 10, 7, 1); wins(c, 98, 52, 1, 10, 7, 1)
    texture_face(c, 0, 34, 112, 43, 'hull', -3, seam=8, band=14, seed=8)
    baseline(c, 112, 77); c.outline()


@piece('shuttle', '착륙한 셔틀(흰 동체, 날개, 착륙 다리)', 5, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(5)] + [(1, 2), (2, 2), (3, 2)], tags=['탈것', '셔틀', '우주선'], desc='착륙장에 서 있는 셔틀.')
def _(c):
    for x in (16, 54): cube(c, x, 52, 10, 3, 7, 'cable', tt=3, ft=0, ol=False)
    tcube(c, 0, 26, 20, 11, 9, 'hull', ins=3, tt=3, ft=-3, ol=False, seams=False); tcube(c, 60, 26, 20, 11, 9, 'hull', ins=3, tt=3, ft=-3, ol=False, seams=False)
    tcube(c, 10, 8, 60, 24, 20, 'white', ins=14, tt=3, ft=-2, ol=False, seams=False)
    c.R(32, 10, 16, 6, K('glass', 0)); c.HL(32, 10, 16, K('cyan', 3)); c.R(36, 17, 8, 2, K('white', 1))
    hazard(c, 22, 14, 6, 2, 'orange'); hazard(c, 52, 14, 6, 2, 'orange')
    c.R(22, 36, 36, 6, K('glass', -1)); c.HL(22, 36, 36, K('cyan', 2)); [c.VL(i, 37, 5, K('white', -1)) for i in (30, 40, 50)]
    stripe(c, 11, 32, 58, 'orange'); c.R(34, 44, 12, 5, K('cable', 0)); c.HL(34, 44, 12, K('hull', 2))
    cube(c, 33, 0, 14, 5, 5, 'orange', tt=3, ft=-2, ol=False)
    c.outline()


# ------------------------------------------------------------------ 탱크·설비·소품
@piece('fuel-tank', '연료 탱크(세워 둔 둥근 원통 탱크, 주황 띠)', 2, 2, 'round_body', group='outdoor', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['탱크', '연료'], desc='연료 저장 탱크.')
def _(c):
    cyl(c, 16, 12, 13, 6, 11, 'white', tt=3, ft=-2, ol=False, bands=0)
    c.ell(16, 12, 8, 3, K('white', 2)); c.ell(16, 12, 4, 1, K('hull', 1)); c.P(15, 11, K('glow', 0))
    for x in range(4, 29):
        u = (x - 16) / 13.5
        if abs(u) < 1: dy = int(round(6 * (1 - u * u) ** .5)); c.P(x, 20 + dy, K('orange', 2)); c.P(x, 21 + dy, K('orange', 0))
    cube(c, 22, 22, 7, 3, 4, 'hull', tt=3, ft=-1, ol=False); c.outline()


@piece('gas-tank-pair', '가스 탱크 한 쌍(두 개의 둥근 원통 탱크와 연결 배관)', 3, 2, 'round_body', group='outdoor', solid=[(x, 1) for x in range(3)] + [(0, 0), (2, 0)], tags=['탱크', '가스'], desc='가스 저장 탱크 한 쌍.')
def _(c):
    c.R(14, 17, 20, 3, K('rust', 1)); c.HL(14, 17, 20, K('rust', 3))
    cyl(c, 13, 11, 11, 5, 12, 'hull', tt=3, ft=-1, ol=False, bands=1)
    cyl(c, 35, 11, 11, 5, 12, 'white', tt=3, ft=-2, ol=False, bands=1)
    for cx, col in ((13, 'cyan'), (35, 'orange')): c.ell(cx, 11, 5, 2, K(col, 1)); c.P(cx - 1, 10, K(col, 3))
    c.outline()


@piece('solar-array-l', '대형 태양광 패널(두 장을 이은 넓은 패널과 받침 상자)', 5, 2, 'structure', group='outdoor', solid=[(x, 1) for x in range(5)], tags=['태양광', '패널', '대형'], desc='식민지 대형 발전 패널.')
def _(c):
    cube(c, 1, 1, 78, 17, 4, 'navy', tt=2, ft=-2, ol=False, topmat='glass')
    for i in range(10, 78, 16): c.VL(i, 2, 15, K('hull', 2))
    c.VL(40, 2, 15, K('white', 2))
    for j in (7, 13): c.HL(2, j, 76, K('hull', 2))
    for k in range(9): c.P(4 + k * 8, 3 + k % 4, K('glow', 0))
    for x in (10, 56): cube(c, x, 22, 14, 4, 6, 'hull', tt=3, ft=-1, ol=False); led(c, x + 3, 27, 'green')
    c.outline()


@piece('dish-small', '소형 안테나 접시(받침 윗면과 작은 접시)', 1, 2, 'structure', group='outdoor', solid=[(0, 1)], tags=['안테나', '접시'], desc='작은 통신 접시.')
def _(c):
    cube(c, 2, 20, 12, 6, 8, 'hull', tt=3, ft=-1, ol=False, tex='plate')
    c.R(6, 12, 4, 8, K('hull', 1)); c.VL(9, 12, 8, K('hull', -1))
    for y in range(2, 14):
        for x in range(1, 15):
            d = ((x - 7.5) / 7) ** 2 + ((y - 7.5) / 5.5) ** 2
            if d <= 1: c.P(x, y, K('white', 2 + (1 if x + y < 13 else 0) - (1 if d > .75 else 0)))
    c.P(7, 7, K('cyan', 3)); c.outline()


@piece('antenna-mast', '안테나 마스트(세 단으로 좁아지는 굵은 탑과 꼭대기 램프)', 2, 4, 'structure', group='outdoor', solid=[(0, 3), (1, 3)], tags=['안테나', '마스트'], desc='통신 마스트.')
def _(c):
    tcube(c, 1, 44, 30, 8, 12, 'hull', ins=3, tt=3, ft=-2, ol=False, seams=False); c.HL(3, 56, 26, K('orange', 2))
    tcube(c, 6, 28, 20, 7, 13, 'white', ins=3, tt=3, ft=-2, ol=False, seams=False); c.R(9, 38, 14, 2, K('cyan', 2))
    tcube(c, 10, 14, 12, 6, 11, 'hull', ins=2, tt=3, ft=-2, ol=False, seams=False); c.HL(12, 22, 8, K('cyan', 3))
    cube(c, 12, 4, 8, 4, 5, 'orange', tt=3, ft=-1, ol=False); c.P(15, 6, K('glow', 1)); c.outline()


@piece('radiator-panel', '방열 패널(눕혀 놓은 핀 판, 윗면에 세로 핀)', 3, 2, 'structure', group='outdoor', solid=[(x, 1) for x in range(3)], tags=['방열', '패널'], desc='열 방출 패널.')
def _(c):
    tcube(c, 1, 1, 46, 17, 8, 'hull', ins=5, tt=3, ft=-2, topmat='white', ol=False, seams=False)
    for i in range(7, 41, 3):
        for r in range(3, 17):
            l = int(round(5 * (1 - r / 16)))
            if 1 + l + 2 < i < 46 - l - 2: c.P(i, 1 + r, K('white', 0 if i % 6 == 1 else 1))
    c.R(1, 19, 46, 3, K('orange', 1)); c.HL(1, 19, 46, K('orange', 3))
    for x in (6, 34): cube(c, x, 23, 8, 3, 3, 'cable', tt=3, ft=0, ol=False)
    c.outline()


@piece('battery-bank', '축전지 뱅크(윗면에 전지 셀이 놓인 낮은 상자)', 2, 1, 'box', group='outdoor', solid=[(0, 0), (1, 0)], tags=['전지', '발전'], desc='식민지 축전지 상자.')
def _(c):
    tcube(c, 1, 1, 30, 8, 6, 'hull', ins=3, tt=3, ft=-1, topmat='white', ol=False, seams=False)
    for i in (4, 12, 20): cube(c, i, 2, 7, 3, 3, 'green', tt=2, ft=-1, ol=False); c.P(i + 3, 7, K('green', 3))
    c.HL(1, 14, 30, K('hull', -3)); led(c, 5, 12, 'green'); led(c, 15, 12, 'orange'); led(c, 25, 12, 'green'); c.outline()


@piece('oxygen-tank-row', '산소 탱크 줄(받침판 위에 늘어선 흰 원통 셋)', 3, 2, 'round_body', group='outdoor', solid=[(x, 1) for x in range(3)], tags=['탱크', '산소'], desc='생명유지 산소 탱크.')
def _(c):
    cube(c, 1, 23, 46, 5, 4, 'hull', tt=3, ft=-1, ol=False)
    for cx in (10, 24, 38):
        cyl(c, cx, 12, 6, 3, 8, 'white', tt=3, ft=-2, ol=False); c.ell(cx, 12, 3, 1, K('cyan', 1)); c.P(cx - 1, 11, K('cyan', 3))
    c.outline()


@piece('crate-stack', '화물 상자 더미(큰 상자 위에 작은 상자를 올림)', 2, 2, 'box', group='outdoor', solid=[(0, 1), (1, 1), (0, 0)], tags=['화물', '상자'], desc='쌓아 둔 화물 상자.')
def _(c):
    cube(c, 1, 14, 18, 7, 10, 'hull', tt=3, ft=-1, ol=False, tex='plate'); c.VL(10, 21, 10, K('hull', -3)); hazard(c, 3, 29, 6, 1)
    cube(c, 4, 6, 11, 5, 5, 'orange', tt=3, ft=-1, ol=False)
    cube(c, 20, 19, 11, 6, 7, 'orange', tt=3, ft=-1, ol=False, tex='plate'); c.HL(21, 28, 9, K('orange', -3)); c.outline()


@piece('container', '운송 컨테이너(홈이 파인 큰 직육면체)', 3, 2, 'box', group='outdoor', solid=[(x, 1) for x in range(3)], tags=['컨테이너', '화물'], desc='화물 컨테이너.')
def _(c):
    cube(c, 1, 2, 46, 12, 16, 'hull', tt=3, ft=-1, ol=False, tex='panel')
    for i in range(4, 46, 4): c.VL(i, 14, 15, K('hull', -2)); c.VL(i + 1, 15, 14, K('hull', 1))
    c.R(1, 14, 46, 2, K('orange', 2)); c.HL(1, 14, 46, K('orange', 4)); c.HL(1, 29, 46, K('orange', -1)); c.outline()


@piece('container-stack', '컨테이너 더미(두 대를 위아래로 쌓음)', 3, 3, 'box', group='outdoor', solid=[(x, 2) for x in range(3)] + [(1, 1)], tags=['컨테이너', '화물', '쌓기'], desc='쌓은 화물 컨테이너.')
def _(c):
    cube(c, 1, 22, 46, 9, 14, 'orange', tt=3, ft=-1, ol=False, tex='panel')
    for i in range(4, 46, 4): c.VL(i, 31, 13, K('orange', -2))
    cube(c, 5, 4, 38, 8, 12, 'hull', tt=3, ft=-1, ol=False, tex='panel')
    for i in range(8, 42, 4): c.VL(i, 12, 11, K('hull', -2))
    hazard(c, 6, 22, 36, 1); c.outline()


@piece('beacon', '착륙 유도등 상자(윗면에 주황 렌즈가 박힌 낮은 상자)', 1, 1, 'box', group='outdoor', solid=[(0, 0)], tags=['비콘', '램프'], desc='착륙장 유도등.')
def _(c):
    tcube(c, 1, 2, 14, 9, 4, 'hull', ins=2, tt=3, ft=-1, topmat='white', ol=False, seams=False)
    c.ell(8, 6, 3, 2, K('orange', 1)); c.ell(8, 6, 2, 1, K('orange', 3)); c.P(7, 5, K('glow', 1)); c.P(3, 12, K('cyan', 3)); c.P(12, 12, K('cyan', 3)); c.outline()


@piece('sign-chunky', '경고 표지 상자(깊은 윗면이 있는 높은 표지 상자)', 1, 2, 'box', group='outdoor', solid=[(0, 1)], tags=['표지', '경고'], desc='구역 경고 표지.')
def _(c):
    cube(c, 1, 2, 14, 8, 22, 'hull', tt=4, ft=-1, ol=False, topmat='white', tex='plate')
    c.R(3, 13, 10, 8, K('orange', 1)); c.HL(3, 13, 10, K('orange', 3)); hazard(c, 3, 22, 10, 2)
    for k in range(3): c.HL(7 - k, 15 + k * 2, 2 + 2 * k, K('cable', -2))
    c.outline()


@piece('barrier', '위험 차단벽(노랑·검정 줄무늬 낮은 방벽)', 2, 1, 'box', group='outdoor', solid=[(0, 0), (1, 0)], tags=['방벽', '위험'], desc='통행 차단 방벽.')
def _(c):
    tcube(c, 1, 1, 30, 8, 6, 'cable', ins=3, tt=4, ft=0, topmat='yellow', ol=False, seams=False)
    hazard(c, 1, 9, 30, 5, diag=4); c.HL(1, 9, 30, K('yellow', 3)); c.HL(1, 13, 30, K('cable', -2)); c.outline()


@piece('vent-stack', '배기 굴뚝(받침 위의 짧고 굵은 원통)', 1, 2, 'structure', group='outdoor', solid=[(0, 1)], tags=['환기', '굴뚝'], desc='선체 배기구.')
def _(c):
    cube(c, 1, 19, 14, 6, 6, 'hull', tt=3, ft=-1, ol=False)
    cyl(c, 8, 10, 5, 3, 9, 'white', tt=3, ft=-2, ol=False); c.ell(8, 10, 3, 1, K('cable', 0)); c.P(7, 10, K('cyan', 2))
    c.HL(3, 16, 10, K('orange', 2)); c.outline()


@piece('comms-relay', '통신 중계기(받침 위의 장비 상자와 작은 접시)', 2, 2, 'structure', group='outdoor', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['통신', '중계'], desc='통신 중계 장비.')
def _(c):
    tcube(c, 1, 14, 30, 9, 9, 'hull', ins=3, tt=3, ft=-1, ol=False, seams=False)
    cube(c, 4, 9, 11, 4, 5, 'white', tt=3, ft=-1, ol=False); c.P(7, 13, K('green', 3)); c.P(10, 13, K('cyan', 3))
    for y in range(3, 14):
        for x in range(17, 30):
            d = ((x - 23.5) / 6.5) ** 2 + ((y - 8) / 5.5) ** 2
            if d <= 1: c.P(x, y, K('white', 2 + (1 if x + y < 30 else 0) - (1 if d > .75 else 0)))
    c.P(23, 8, K('cyan', 3)); c.R(22, 14, 3, 3, K('hull', 1)); c.outline()


@piece('rover', '달 탐사 로버(굵은 바퀴 슬래브 위의 흰 차체, 지붕 해치)', 3, 2, 'structure', group='outdoor', solid=[(x, 1) for x in range(3)], tags=['탈것', '로버'], desc='달 표면 탐사 차량.')
def _(c):
    for x in (3, 35): cube(c, x, 24, 10, 3, 5, 'cable', tt=3, ft=0, ol=False); c.HL(x + 2, 28, 6, K('cable', 5))
    tcube(c, 1, 1, 46, 13, 9, 'white', ins=7, tt=3, ft=-2, ol=False, seams=False)
    roof_detail(c, 10, 2, 28, 11, 'white', seed=1, hatch=False, vents=False)
    cube(c, 28, 3, 10, 4, 3, 'hull', tt=3, ft=-1, ol=False); c.P(32, 6, K('cyan', 3))
    c.R(6, 16, 36, 4, K('glass', 0)); c.HL(6, 16, 36, K('cyan', 3)); c.VL(23, 16, 4, K('hull', 0))
    stripe(c, 2, 21, 44, 'orange'); c.outline()


# ------------------------------------------------------------------ 바닥·지형(걷는 면)
@piece('landing-pad', '착륙장 바닥(둥근 위험 고리와 사각 표적이 칠해진 판)', 4, 3, 'flat', group='outdoor', solid=[], tags=['착륙장', '바닥'], desc='셔틀 착륙 바닥. 걷는다.')
def _(c):
    c.R(0, 0, 64, 48, K('deck', 1))
    for i in range(0, 64, 16): c.VL(i, 0, 48, K('deck', -1)); c.VL(i + 1, 0, 48, K('deck', 3))
    for j in range(0, 48, 16): c.HL(0, j, 64, K('deck', -1)); c.HL(0, j + 1, 64, K('deck', 3))
    for y in range(48):
        for x in range(64):
            d = ((x - 31.5) / 27) ** 2 + ((y - 23.5) / 20) ** 2
            if .8 <= d <= 1.0: c.P(x, y, K('yellow', 1) if ((x + y) // 3) % 2 == 0 else K('cable', 0))
            elif d < .8 and d >= .72: c.P(x, y, K('white', 2))
    c.R(22, 15, 20, 18, K('deck', 0)); c.HL(22, 15, 20, K('white', 3)); c.HL(22, 32, 20, K('white', 3)); c.VL(22, 15, 18, K('white', 3)); c.VL(41, 15, 18, K('white', 3))
    c.R(29, 20, 6, 8, K('orange', 2)); c.HL(29, 20, 6, K('orange', 4)); c.R(28, 23, 8, 2, K('orange', 2))
    for x, y in ((4, 4), (59, 4), (4, 43), (59, 43)): c.R(x, y, 2, 2, K('cyan', 3))


def rock(c, cx, cy, rx, ry, seed=0, mat='regolith'):
    """달 바위 덩이: 불규칙 반타원을 «면(facet)» 여럿으로 쪼갠다 — 면마다 빛 방향으로 단을 정하고(윗면 밝음·아래 어두움),
    면 경계는 밝은 능선/어두운 골, 아래 접지 그림자 한 줄 + 윤곽. 둥근 그러데이션 덩이(평평한 회색)가 되지 않게."""
    n = 3 + (rx * ry) // 30
    seeds = [(cx + ((hsh(k, 1, seed) % (2 * rx + 1)) - rx) * .8, cy + ((hsh(k, 2, seed) % (2 * ry + 1)) - ry) * .8) for k in range(n)]
    tone = []
    for sx, sy in seeds:
        lit = (cx - sx) / (rx + 1) * .6 + (cy - sy) / (ry + 1) * 1.1 + ((hsh(int(sx), int(sy), seed) % 3) - 1) * .25
        tone.append(3 if lit > .55 else 2 if lit > .15 else 1 if lit > -.3 else 0 if lit > -.7 else -1)
    own = {}
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            j = ((hsh(x, y, seed) % 5) - 2) * .035
            d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 + j
            if d > 1: continue
            k = min(range(n), key=lambda i: (x - seeds[i][0]) ** 2 + ((y - seeds[i][1]) * 1.3) ** 2)
            own[(x, y)] = k
            t = tone[k] - (1 if y > cy + ry * .55 else 0)
            if hsh(x, y, seed + 7) % 13 == 0: t -= 1
            c.P(x, y, K(mat, t))
    for (x, y), k in own.items():                     # 면 경계: 위 이웃과 면이 다르면 능선(밝음)/골(어두움)
        up = own.get((x, y - 1)); lf = own.get((x - 1, y))
        if up is not None and up != k: c.P(x, y, K(mat, max(tone[k], tone[up]) + 1 if tone[up] < tone[k] else min(tone[k], tone[up]) - 1))
        elif lf is not None and lf != k and hsh(x, y, seed) % 2: c.P(x, y, K(mat, min(tone[k], tone[lf]) - 1))
    for x in range(cx - rx + 1, cx + rx):                # 접지 그림자: 바닥 한 줄 어둡게
        for y in range(cy + ry + 1, cy - ry - 2, -1):
            if (x, y) in own: c.P(x, y, K(mat, -2)); break
    c.outline()


@piece('rock-regolith-s', '작은 달 바위(회색 돌덩이)', 1, 1, 'organic', group='outdoor', solid=[(0, 0)], tags=['바위', '달'], desc='달 표면 작은 바위.')
def _(c): rock(c, 8, 9, 5, 4, 1)


@piece('rock-regolith-m', '중간 달 바위(가로로 긴 회색 돌덩이)', 2, 1, 'organic', group='outdoor', solid=[(0, 0), (1, 0)], tags=['바위', '달'], desc='달 표면 중간 바위.')
def _(c): rock(c, 16, 9, 12, 5, 2)


@piece('rock-regolith-l', '큰 달 바위(높게 솟은 회색 바위 덩이)', 2, 2, 'organic', group='outdoor', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['바위', '달'], desc='달 표면 큰 바위.')
def _(c): rock(c, 16, 17, 13, 11, 3)


@piece('boulder-cluster', '바위 무더기(크고 작은 돌덩이 여럿)', 3, 2, 'organic', group='outdoor', solid=[(0, 1), (1, 1), (2, 1), (1, 0)], tags=['바위', '달'], desc='달 표면 바위 무더기.')
def _(c):
    rock(c, 14, 21, 11, 8, 4); rock(c, 33, 20, 12, 9, 5); rock(c, 25, 12, 8, 7, 6); rock(c, 42, 26, 5, 4, 7); rock(c, 6, 27, 4, 3, 8)


@piece('crater', '운석 구덩이(둥근 테두리와 어두운 안쪽)', 3, 2, 'flat', group='outdoor', solid=[], tags=['구덩이', '달'], desc='달 표면 구덩이. 걷는다.')
def _(c):
    for y in range(32):
        for x in range(48):
            d = ((x - 23.5) / 22.5) ** 2 + ((y - 15.5) / 14.5) ** 2
            if d > 1 + (hsh(x, y, 3) % 4) * .015: continue
            if d > .62:
                lit = (23.5 - x) * .5 + (15.5 - y) * .9
                t = 2 if lit > 8 else 1 if lit > 0 else 0
                c.P(x, y, K('regolith', t))
            else:
                lit = (x - 23.5) * .5 + (y - 15.5) * .9
                c.P(x, y, K('regolith', -2 if lit < 2 else -1 if lit < 7 else 0))
    for x, y in ((8, 15), (38, 18), (22, 3), (30, 27)): c.P(x, y, K('regolith', 3))

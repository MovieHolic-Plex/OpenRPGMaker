"""sf_station 야외(줄 A — 정거장·식민지·달 기지) 조각 v2 — Opus 손 도트 다시 그리기(2026-10-14). 같은 id 로 Sonnet 초안을 대신한다.
건물 문법: 사다리꼴 윗면 지붕(tcube — 관문이 «뒤로 물러나는 면»으로 읽는다) + 지붕 위 장비(그림자 떨어뜨림) + 판 이음 앞면 + 띠 + 창(window) + 문(door2) + 기초 띠."""
from sf_kit import *

O = dict(group='outdoor')


def roof_unit(c, x, y, w, d, h, mat='hull', roofmat='hull', tt=2):
    """지붕 위 장비 상자: 오른쪽 아래로 그림자(지붕 어두운 단) + 윗면·앞면."""
    c.R(x + 2, y + d + h, w, 1, K(roofmat, -1)); c.R(x + w, y + 2, 2, d + h - 1, K(roofmat, -1))
    box2(c, x, y, w, d, h, mat, tt=tt, ft=-1)
    c.outline() if False else None


def roof_grille(c, x, y, w, h, roofmat='hull'):
    c.R(x + 1, y + h, w, 1, K(roofmat, -1))
    c.R(x, y, w, h, K('cable', 0)); [c.HL(x + 1, y + k, w - 2, K('hull', 0)) for k in range(0, h, 2)]; c.HL(x, y, w, K('hull', 1))


def door2(c, x, y, w, h, mat='hull', lamp='cyan', sill=True):
    """미닫이 문: 튀어나온 틀 + 두 장(가운데 틈) + 장마다 작은 창 + 위 램프 + 아래 위험 띠 문턱."""
    c.R(x - 2, y - 2, w + 4, h + 2, K(mat, -2)); c.HL(x - 2, y - 2, w + 4, K(mat, 1)); c.VL(x - 2, y - 1, h + 1, K(mat, 0))
    hw = w // 2
    raised(c, x, y, hw, h, 'white', -1); raised(c, x + hw, y, w - hw, h, 'white', -2)
    c.VL(x + hw, y, h, K('cable', -1))
    c.R(x + 1, y + 2, hw - 2, 3, K('glass', 0)); c.HL(x + 1, y + 2, hw - 2, K('glass', 2))
    c.R(x + hw + 1, y + 2, w - hw - 2, 3, K('glass', -1)); c.HL(x + hw + 1, y + 2, w - hw - 2, K('glass', 1))
    c.R(x + hw - 1, y - 2, 2, 1, K(lamp, 3))
    if sill: hazard(c, x, y + h - 2, w, 2)


def module(c, x, y, w, roof, front, wall='white', roofmat='hull', ins=5, ft=-2, band='orange', seed=0):
    """조립 모듈 몸: 사다리꼴 윗면 지붕 + 앞면(판 이음·띠·기초). 앞면 y 를 돌려준다."""
    tcube(c, x, y, w, roof, front, wall, ins=ins, tt=2, ft=ft, topmat=roofmat, ol=False, s=seed)
    fy = y + roof
    c.HL(x + ins, y, w - 2 * ins, K(roofmat, 3))                              # 지붕 뒤 턱
    for r in range(1, roof - 1):                                              # 지붕 둘레 낮은 난간(안쪽 1칸 밝은 줄)
        l = int(round(ins * (1 - r / max(1, roof - 1))))
        c.P(x + l + 1, y + r, K(roofmat, 3)); c.P(x + w - l - 2, y + r, K(roofmat, 0))
    if band: c.HL(x, fy + 2, w, K(band, 2)); c.HL(x, fy + 3, w, K(band, -1))
    texture_face(c, x, fy + 1, w, front - 1, wall, ft, seam=8, band=0, seed=seed, grime=3, light=2)
    c.HL(x, fy + front - 2, w, K('hull', -2)); c.HL(x, fy + front - 1, w, K('hull', -3))
    return fy


# =================================================================== 돔
def dome_body(c, cx, base_y, rx, ry, bh, door_w, door_h, lamps=6, plants=False, seed=0):
    """거주 돔: 원통 기단(판 이음·창 띠·문) + 유리 돔(리브·반사)."""
    cyl(c, cx, base_y, rx, ry, bh, 'white', tt=2, ft=-1, ol=False, bands=0)
    for x in range(cx - rx, cx + rx + 1):                                       # 기단 창 띠(호를 따라)
        u = (x - cx) / (rx + .5)
        if abs(u) > .92: continue
        dy = int(round(ry * (1 - u * u) ** .5)); yy = base_y + dy + bh // 3
        if (x - cx) % 6 in (1, 2, 3) and abs(x - cx) > door_w // 2 + 2: c.P(x, yy, K('cyan', 1 if u < 0 else 0)); c.P(x, yy + 1, K('glass', -1))
        if (x - cx) % 6 == 5: c.P(x, base_y + dy + 1, K('white', 0)); [c.P(x, base_y + dy + k, K('white', -2)) for k in range(2, bh)]
    for x in range(cx - rx, cx + rx + 1):                                       # 아래 기초 띠
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        dy = int(round(ry * (1 - u * u) ** .5)); c.P(x, base_y + bh + dy - 1, K('hull', -2))
    import math
    for y in range(base_y - ry, base_y + ry + 1):                              # 기단 윗면 고리: 방사 이음 + 안쪽 시안 등줄
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx) / (rx + .5)) ** 2 + ((y - base_y) / (ry + .5)) ** 2
            if d > 1: continue
            a = math.degrees(math.atan2((y - base_y) * rx / max(1, ry), x - cx)) % 30
            if a < 2.2 and d > .55: c.P(x, y, K('white', 0))
            elif .5 < d < .62 and y > base_y - ry // 2: c.P(x, y, K('cyan', 1 if x < cx else 0))
    dome2(c, cx, base_y + 1, rx - 3, min(rx - 4, int(ry * 2.0)), 'glass', s=seed)
    if plants:
        from sf2_interior import plant
        for k, (dx, dy) in enumerate(((-14, -3), (-8, -6), (-2, -8), (4, -7), (10, -5), (15, -2), (-11, 0), (-5, -2), (1, -3), (7, -1), (12, 1))):
            plant(c, cx + dx - 2, base_y - 4 + dy, 1 - k % 2, big=k % 3 == 0)
        dome_hl = lambda: None
    door2(c, cx - door_w // 2, base_y + ry + bh - door_h, door_w, door_h, 'white')


@piece2('hab-dome', '거주 돔(유리 돔 + 창 띠 두른 원통 기단 + 문)', 4, 4, 'structure', solid=[(x, 3) for x in range(4)] + [(x, 2) for x in (0, 3)], tags=['돔', '거주구', '건물'], desc='식민지 거주 돔. 문은 정면 아래 가운데.', **O)
def _(c):
    dome_body(c, 32, 36, 29, 12, 13, 10, 11, seed=1); c.outline()


@piece2('hab-dome-s', '소형 거주 돔(유리 돔 + 원통 기단 + 문)', 3, 3, 'structure', solid=[(x, 2) for x in range(3)], tags=['돔', '거주구', '건물'], desc='작은 식민지 돔. 문은 정면 아래 가운데.', **O)
def _(c):
    dome_body(c, 24, 26, 22, 9, 9, 8, 9, seed=2); c.outline()


@piece2('hab-dome-l', '대형 거주 돔(큰 유리 돔 + 두 줄 창 띠 기단 + 넓은 문)', 6, 5, 'structure', solid=[(x, 4) for x in range(6)] + [(x, 3) for x in (0, 1, 4, 5)], tags=['돔', '거주구', '대형', '건물'], desc='식민지 중심 대형 돔. 문은 정면 아래 가운데.', **O)
def _(c):
    dome_body(c, 48, 46, 45, 16, 16, 16, 14, seed=3); c.outline()


@piece2('greenhouse-dome', '온실 돔(유리 돔 안 초록 잎 + 기단 + 문)', 4, 4, 'structure', solid=[(x, 3) for x in range(4)] + [(0, 2), (3, 2)], tags=['돔', '온실', '식물', '건물'], desc='수경 재배 온실 돔. 문은 정면 아래 가운데.', **O)
def _(c):
    dome_body(c, 32, 38, 29, 11, 11, 10, 10, plants=True, seed=4); c.outline()


# =================================================================== 모듈 건물
@piece2('hab-module', '주거 모듈(사다리꼴 지붕 + 환기 상자 + 흰 판 앞면 + 창 넷 + 문)', 4, 3, 'structure', solid=[(x, 2) for x in range(4)] + [(0, 1), (3, 1)], tags=['건물', '모듈', '주거'], desc='프리팹 주거 모듈. 문은 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 4, 64, 16, 27, 'white', 'hull', ins=6, seed=1)
    roof_unit(c, 12, 7, 10, 4, 3); roof_grille(c, 38, 8, 12, 5)
    for x0 in (4, 15, 40, 51): window(c, x0, fy + 7, 8, 7, 'cyan' if x0 in (4, 51) else None, frame=K('hull', -3), sill=K('white', 2))
    door2(c, 27, fy + 9, 10, 15)
    c.outline()


@piece2('hab-module-3', '대형 주거 모듈(긴 지붕 + 해치·배관 + 두 줄 창 + 가운데 문)', 6, 4, 'structure', solid=[(x, 3) for x in range(6)] + [(0, 2), (5, 2)], tags=['건물', '모듈', '주거'], desc='긴 프리팹 주거동. 문은 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 4, 96, 20, 38, 'hull', 'hull', ins=8, ft=-3, band='yellow', seed=2)
    roof_unit(c, 14, 8, 12, 5, 3); roof_grille(c, 66, 9, 14, 6)
    c.HL(30, 14, 30, K('rust', 1)); c.HL(30, 15, 30, K('rust', -2)); c.R(44, 11, 6, 4, K('hull', 3)); c.HL(44, 15, 6, K('hull', -1))
    for row in (0, 1):
        for x0 in (6, 20, 66, 80): window(c, x0, fy + 7 + row * 13, 10, 8, 'cyan' if (x0 + row * 14) % 28 == 6 else ('orange' if x0 == 80 and row else None), frame=K('hull', -3), sill=K('hull', 0))
    door2(c, 41, fy + 18, 14, 18)
    c.outline()


@piece2('lab-module', '연구 모듈(지붕 안테나·장비 + 넓은 시안 관측창 + 문)', 5, 4, 'structure', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '연구소', '안테나'], desc='연구 실험동. 문은 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 12, 80, 16, 34, 'white', 'hull', ins=7, band='cyan', seed=3)
    roof_unit(c, 12, 16, 9, 4, 3); roof_unit(c, 56, 15, 11, 5, 3, 'white')
    box2(c, 36, 3, 8, 3, 13, 'hull', tt=2, ft=-1); c.R(38, 0, 4, 3, K('hull', 2)); c.P(39, 0, K('orange', 3)); c.P(40, 0, K('glow', 0))
    c.R(5, fy + 7, 70, 10, K('hull', -3))
    for i in range(6): pane(c, 6 + i * 12, fy + 8, 11, 8, 'glass', 0)
    for i in range(6): c.HL(6 + i * 12, fy + 13, 11, K('cyan', 1)) if i % 2 else None
    door2(c, 33, fy + 19, 14, 13)
    c.outline()


@piece2('hab-block', '주거 블록(위층 모듈을 얹은 2층, 위험 띠 + 창 줄)', 6, 5, 'structure', solid=[(x, 4) for x in range(6)] + [(x, 3) for x in (0, 1, 4, 5)], tags=['건물', '블록', '주거'], desc='두 층 주거 블록. 문은 정면 가운데 아래.', **O)
def _(c):
    fy = module(c, 0, 38, 96, 12, 32, 'white', 'hull', ins=6, seed=4)
    fy2 = module(c, 14, 8, 68, 13, 22, 'hull', 'hull', ins=5, ft=-3, band='yellow', seed=5)
    roof_unit(c, 26, 11, 12, 5, 3, 'white'); roof_grille(c, 50, 12, 14, 5)
    for i in range(4): window(c, 20 + i * 15, fy2 + 7, 9, 7, 'orange' if i == 2 else 'cyan' if i == 0 else None, frame=K('hull', -3), sill=K('hull', 0))
    for x0 in (6, 20, 66, 80): window(c, x0, fy + 8, 10, 8, 'cyan' if x0 in (6, 80) else None, frame=K('hull', -3), sill=K('white', 2))
    door2(c, 41, fy + 13, 14, 16)
    c.outline()


@piece2('airlock', '에어록 모듈(사다리꼴 지붕 + 회전 경고등 + 미닫이 문 + 위험 띠)', 3, 3, 'structure', solid=[(0, 2), (1, 2), (2, 2), (0, 1), (2, 1)], tags=['에어록', '문', '건물'], desc='선체 바깥 출입구. 문은 가운데 아래.', **O)
def _(c):
    fy = module(c, 0, 3, 48, 15, 27, 'hull', 'hull', ins=5, ft=-3, band='yellow', seed=6)
    c.R(21, 7, 6, 5, K('orange', 1)); c.HL(21, 7, 6, K('orange', 3)); c.R(22, 9, 4, 1, K('glow', 0)); c.HL(21, 12, 6, K('hull', -1))
    roof_grille(c, 8, 9, 8, 4); roof_grille(c, 32, 9, 8, 4)
    door2(c, 15, fy + 8, 18, 17)
    c.outline()


@piece2('airlock-wide', '화물 에어록(넓은 화물 베이 셔터 + 양옆 경고등)', 5, 3, 'structure', solid=[(x, 2) for x in range(5)] + [(0, 1), (4, 1)], tags=['에어록', '화물', '문', '건물'], desc='선체 바깥 화물 출입구. 문은 가운데 아래.', **O)
def _(c):
    fy = module(c, 0, 4, 80, 15, 27, 'hull', 'hull', ins=7, ft=-3, band='yellow', seed=7)
    roof_unit(c, 10, 7, 14, 5, 3, 'white'); roof_unit(c, 54, 7, 14, 5, 3, 'white')
    c.R(12, fy + 5, 56, 21, K('hull', -2)); c.HL(12, fy + 5, 56, K('hull', 0))
    c.R(14, fy + 7, 52, 17, K('cable', 1))
    for j in range(fy + 8, fy + 23, 3): c.HL(14, j, 52, K('hull', -1)); c.HL(14, j + 1, 52, K('cable', -1))
    hazard(c, 14, fy + 22, 52, 2)
    for x in (8, 70): c.R(x, fy + 7, 3, 4, K('orange', 1)); c.P(x + 1, fy + 8, K('glow', 0))
    c.outline()


@piece2('docking-gate', '도킹 게이트(둥근 도킹 고리 + 안쪽 해치 + 고정 집게 넷)', 4, 4, 'round_body', solid=[(x, 3) for x in range(4)] + [(1, 2), (2, 2)], tags=['도킹', '고리'], desc='우주선 도킹 고리.', **O)
def _(c):
    cyl(c, 32, 30, 28, 12, 16, 'white', tt=2, ft=-1, ol=False, bands=1)
    c.ell(32, 30, 22, 9, K('hull', 0)); c.ell(32, 30, 20, 8, K('hull', -2)); c.ell(32, 31, 16, 6, K('cable', -1)); c.ell(32, 32, 12, 4, K('cable', 0))
    c.ell(32, 32, 9, 3, K('hull', 1)); c.ell(32, 32, 7, 2, K('hull', -1)); c.HL(26, 31, 12, K('hull', 3)); c.P(32, 32, K('cyan', 3))
    for (x, y) in ((8, 29), (55, 29), (32, 20), (20, 38), (44, 38)):
        c.R(x - 3, y - 1, 6, 3, K('orange', 1)); c.HL(x - 3, y - 1, 6, K('orange', 3)); c.HL(x - 3, y + 1, 6, K('orange', -2))
    door2(c, 26, 46, 12, 12, 'white')
    c.outline()


@piece2('tube-h', '연결 통로 튜브(가로로 누운 가압 통로 + 유리 창 줄 + 이음 고리)', 4, 2, 'structure', solid=[(x, 1) for x in range(4)], tags=['통로', '튜브'], desc='모듈 사이 가압 통로. 가로로 이어 붙인다.', **O)
def _(c):
    tcube(c, 4, 2, 56, 12, 14, 'white', ins=4, tt=2, ft=-2, topmat='hull', ol=False, seams=False)
    c.HL(8, 2, 48, K('hull', 3))
    for x in (4, 26, 48): c.R(x + 4, 3, 2, 10, K('hull', 0))
    c.R(8, 17, 48, 6, K('hull', -3))
    for i in range(4): pane(c, 9 + i * 12, 18, 10, 4, 'glass', 0)
    for x in (0, 58):
        box2(c, x, 4, 6, 9, 16, 'hull', tt=2, ft=-1); c.P(x + 2, 15, K('cyan', 3))
    c.HL(4, 27, 56, K('hull', -3)); c.outline()


@piece2('tube-cross', '통로 교차 허브(사방 통로가 만나는 가압 마디 + 윗면 해치)', 2, 2, 'structure', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['통로', '교차'], desc='통로 교차점.', **O)
def _(c):
    cyl(c, 16, 12, 14, 7, 12, 'white', tt=2, ft=-1, ol=False)
    c.ell(16, 12, 8, 4, K('hull', 1)); c.ell(16, 12, 6, 3, K('hull', -1)); c.ell(16, 12, 4, 2, K('hull', 2)); c.P(16, 12, K('orange', 3))
    for x in (1, 27): c.R(x, 18, 4, 8, K('hull', -1)); c.VL(x, 18, 8, K('hull', 1))
    c.R(12, 24, 8, 4, K('hull', -2)); c.HL(12, 24, 8, K('cyan', 2))
    c.outline()


@piece2('control-tower', '관제탑(넓은 기단 + 굵은 몸통 + 유리 관제실 + 지붕 안테나)', 3, 5, 'structure', solid=[(x, 4) for x in range(3)] + [(0, 3), (2, 3), (1, 3)], tags=['탑', '관제', '건물'], desc='착륙장 관제탑. 문은 기단 가운데.', **O)
def _(c):
    fy = module(c, 0, 52, 48, 10, 18, 'hull', 'hull', ins=4, ft=-3, band='yellow', seed=8)
    box2(c, 14, 26, 20, 4, 24, 'white', tt=2, ft=-1)                        # 몸통
    texture_face(c, 14, 31, 20, 18, 'white', -1, seam=6, band=0, seed=9)
    for y in (34, 42): window(c, 21, y, 6, 4, 'cyan' if y == 34 else None, frame=K('hull', -3))
    tcube(c, 6, 8, 36, 9, 13, 'hull', ins=4, tt=2, ft=-2, ol=False, seams=False)   # 관제실
    c.R(8, 18, 32, 8, K('hull', -3))
    for i in range(4): pane(c, 9 + i * 8, 19, 7, 6, 'glass', 1)
    c.HL(8, 22, 32, K('cyan', 1))
    c.R(22, 0, 4, 9, K('hull', 1)); c.VL(22, 0, 9, K('hull', 3)); c.R(21, 0, 6, 2, K('orange', 1)); c.P(23, 0, K('glow', 0))
    door2(c, 19, fy + 4, 10, 12)
    c.outline()


@piece2('radome-tower', '레이돔 탑(판 기단 + 굵은 기둥 + 육각 판 레이돔)', 3, 4, 'structure', solid=[(x, 3) for x in range(3)] + [(1, 2)], tags=['탑', '레이더'], desc='레이더 돔 탑.', **O)
def _(c):
    fy = module(c, 2, 46, 44, 8, 16, 'hull', 'hull', ins=4, ft=-3, band=None, seed=10)
    c.R(18, 30, 12, 18, K('hull', -1)); c.VL(18, 30, 18, K('hull', 1)); c.VL(29, 30, 18, K('hull', -3)); c.HL(18, 38, 12, K('hull', -3))
    for y in range(2, 34):
        for x in range(4, 44):
            d = ((x - 24) / 19.5) ** 2 + ((y - 18) / 15.5) ** 2
            if d <= 1:
                lit = (24 - x) * .5 + (18 - y) * .9
                t = 3 if lit > 9 else 2 if lit > 0 else 1 if lit > -8 else 0
                if (x // 5 + y // 4) % 2 == 0 and ((x % 5 == 0) or (y % 4 == 0)): t -= 1
                c.P(x, y, K('white', t))
    c.HL(10, 30, 28, K('white', -1)); c.P(14, 8, K('glow', 0)); c.P(15, 7, K('white', 4))
    c.P(42, 50, K('green', 3)); c.P(6, 50, K('orange', 3))
    c.outline()


@piece2('reactor-building', '반응로 건물(지붕에 솟은 빛나는 코어 원통 + 배관 + 경고 띠 + 문)', 5, 4, 'structure', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '반응로'], desc='반응로 설비동. 문은 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 22, 80, 14, 27, 'hull', 'hull', ins=6, ft=-3, band='yellow', seed=11)
    cyl(c, 40, 14, 15, 6, 10, 'white', tt=2, ft=-1, ol=False, bands=1)
    c.ell(40, 14, 11, 4, K('hull', -2)); c.ell(40, 14, 9, 3, K('cyan', 0)); c.ell(40, 14, 6, 2, K('cyan', 2)); c.ell(40, 14, 2, 1, K('glow', 1))
    for x in (12, 64): c.R(x, 24, 8, 3, K('rust', 0)); c.HL(x, 24, 8, K('rust', 2)); c.HL(x, 26, 8, K('rust', -2))
    for x0 in (6, 62): window(c, x0, fy + 8, 12, 7, 'orange' if x0 == 6 else None, frame=K('hull', -3), sill=K('hull', 0))
    hazard(c, 22, fy + 6, 36, 2)
    door2(c, 33, fy + 10, 14, 15)
    c.outline()


@piece2('cooling-plant', '냉각 설비(넓은 지붕 위 굵은 냉각탑 셋 + 배관 + 창)', 5, 4, 'structure', solid=[(x, 3) for x in range(5)] + [(0, 2), (4, 2)], tags=['건물', '냉각'], desc='정거장 냉각 설비. 문은 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 24, 80, 12, 28, 'hull', 'hull', ins=4, ft=-3, band='cyan', seed=12)
    for k, x in enumerate((16, 40, 64)):
        cyl(c, x, 12, 9, 4, 14, 'white', tt=2, ft=-1, ol=False, bands=1)
        c.ell(x, 12, 6, 2, K('hull', -3)); c.ell(x, 12, 4, 1, K('cable', -1)); c.P(x - 2, 11, K('cyan', 1))
    c.HL(4, 30, 72, K('rust', 1)); c.HL(4, 31, 72, K('rust', -2))
    for x0 in (6, 62): window(c, x0, fy + 9, 12, 7, 'cyan' if x0 == 62 else None, frame=K('hull', -3), sill=K('hull', 0))
    door2(c, 33, fy + 11, 14, 15)
    c.outline()


@piece2('cargo-hangar', '화물 격납고(넓은 지붕 + 천창 줄 + 큰 롤 셔터 + 옆 창)', 7, 5, 'structure', solid=[(x, 4) for x in range(7)] + [(x, 3) for x in (0, 1, 5, 6)], tags=['건물', '격납고', '화물'], desc='화물 격납고. 셔터는 정면 가운데.', **O)
def _(c):
    fy = module(c, 0, 4, 112, 28, 44, 'hull', 'hull', ins=10, ft=-3, band='yellow', seed=13)
    for i in range(5):
        x = 22 + i * 14
        c.R(x, 10, 10, 12, K('glass', -1)); c.HL(x, 10, 10, K('glass', 2)); c.HL(x, 21, 10, K('hull', -1)); c.P(x + 2, 12, K('glass', 3))
    roof_grille(c, 14, 24, 12, 4); roof_grille(c, 86, 24, 12, 4)
    c.R(26, fy + 6, 60, 36, K('hull', -2)); c.HL(26, fy + 6, 60, K('hull', 0))
    c.R(28, fy + 8, 56, 32, K('cable', 1))
    for j in range(fy + 9, fy + 39, 3): c.HL(28, j, 56, K('hull', -1)); c.HL(28, j + 1, 56, K('cable', -1))
    c.VL(26, fy + 6, 36, K('orange', 2)); c.VL(85, fy + 6, 36, K('orange', 2)); hazard(c, 28, fy + 38, 56, 2)
    for x0 in (6, 94): window(c, x0, fy + 12, 12, 9, 'cyan' if x0 == 6 else None, frame=K('hull', -3), sill=K('hull', 0))
    c.outline()


@piece2('shuttle', '착륙한 셔틀(흰 동체 윗면 + 조종석 유리 + 날개 + 착륙 다리 + 그림자)', 5, 4, 'structure', solid=[(x, 3) for x in range(5)] + [(1, 2), (2, 2), (3, 2)], tags=['탈것', '셔틀', '우주선'], desc='착륙장에 내린 셔틀.', **O)
def _(c):
    tcube(c, 0, 26, 22, 10, 8, 'white', ins=4, tt=2, ft=-2, topmat='hull', ol=False, seams=False)       # 왼 날개
    tcube(c, 58, 26, 22, 10, 8, 'white', ins=4, tt=2, ft=-2, topmat='hull', ol=False, seams=False)      # 오른 날개
    c.HL(4, 34, 14, K('orange', 2)); c.HL(62, 34, 14, K('orange', 2))
    tcube(c, 12, 6, 56, 26, 20, 'white', ins=14, tt=2, ft=-1, ol=False, seams=False)                  # 동체
    plating(c, 24, 10, 32, 20, 'white', 2, pw=8, ph=7)
    c.R(30, 8, 20, 6, K('glass', 0)); c.HL(30, 8, 20, K('glass', 3)); c.P(33, 9, K('glow', 0)); c.HL(30, 13, 20, K('glass', -2))
    c.HL(14, 34, 52, K('orange', 2)); c.HL(14, 35, 52, K('orange', -1))
    for x0 in (22, 50): window(c, x0, 39, 8, 4, None, frame=K('hull', -3))
    door2(c, 36, 38, 8, 12, 'white', 'orange')
    for x in (18, 60): c.R(x, 52, 3, 7, K('hull', -1)); c.HL(x - 2, 59, 7, K('hull', 0))
    c.outline(); drop_shadow(c, 40, 60, 30, 2)


# =================================================================== 설비·소품
@piece2('fuel-tank', '연료 탱크(세운 원통 + 주황 띠 + 윗면 밸브 + 계량 창)', 2, 2, 'round_body', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['탱크', '연료'], desc='연료 저장 탱크.', **O)
def _(c):
    cyl(c, 16, 7, 13, 5, 19, 'white', tt=2, ft=-1, ol=False, bands=0)
    for x in range(3, 30):
        u = (x - 16) / 13.5; dy = int(round(5 * (1 - u * u) ** .5)) if abs(u) <= 1 else 0
        c.P(x, 15 + dy, K('orange', 2 if u < 0 else 1)); c.P(x, 16 + dy, K('orange', 0)); c.P(x, 17 + dy, K('orange', -1))
    c.ell(16, 7, 4, 2, K('hull', 1)); c.R(15, 4, 3, 3, K('hull', 2)); c.P(15, 4, K('white', 3))
    c.R(22, 19, 3, 7, K('cable', -1)); c.R(23, 22, 1, 4, K('orange', 2))
    c.outline()


@piece2('gas-tank-pair', '가스 탱크 한 쌍(흰·시안 원통 둘 + 이음 배관)', 3, 2, 'round_body', solid=[(x, 1) for x in range(3)] + [(0, 0), (2, 0)], tags=['탱크', '가스'], desc='가스 저장 탱크 둘.', **O)
def _(c):
    c.R(14, 14, 20, 3, K('rust', 0)); c.HL(14, 14, 20, K('rust', 2)); c.HL(14, 16, 20, K('rust', -2))
    for x, col in ((11, 'white'), (37, 'hull')):
        cyl(c, x, 7, 9, 4, 18, col, tt=2, ft=-1, ol=False)
        c.ell(x, 7, 3, 1, K('hull', -1)); c.P(x, 6, K('cyan', 3))
        for y in (14, 22): 
            for xx in range(x - 9, x + 10):
                u = (xx - x) / 9.5; dy = int(round(4 * (1 - u * u) ** .5)) if abs(u) <= 1 else 0
                c.P(xx, y + dy, K('cyan', 1 if col == 'white' else 2))
    c.outline()


@piece2('solar-array', '태양광 패널 열(기울어진 셀 판 + 반사 + 받침 상자)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['태양광', '패널'], desc='식민지 발전 패널.', **O)
def _(c):
    box2(c, 18, 20, 12, 4, 7, 'hull', tt=2, ft=-1); c.P(21, 26, K('green', 3))
    c.R(22, 15, 4, 5, K('hull', -1)); c.VL(22, 15, 5, K('hull', 1))
    tcube(c, 1, 1, 46, 13, 4, 'hull', ins=3, tt=2, ft=-2, topmat='glass', ol=False, seams=False)
    for r in range(1, 12):
        l = int(round(3 * (1 - r / 12))); 
        for x in range(1 + l, 47 - l):
            if (x - 1) % 6 == 0 or r % 4 == 0: c.P(x, 1 + r, K('hull', 1))
            elif (x + r) % 9 == 0: c.P(x, 1 + r, K('glass', 3))
    c.line(10, 11, 16, 3, K('glass', 3)); c.line(12, 11, 18, 3, K('glass', 2))
    c.outline()


@piece2('solar-array-l', '대형 태양광 패널(두 장 + 셀 격자 + 받침 상자 둘)', 5, 2, 'structure', solid=[(x, 1) for x in range(5)], tags=['태양광', '패널'], desc='대형 발전 패널.', **O)
def _(c):
    for x0 in (12, 56): box2(c, x0, 20, 12, 4, 7, 'hull', tt=2, ft=-1); c.P(x0 + 3, 26, K('green', 3))
    for x0 in (1, 41):
        tcube(c, x0, 1, 38, 13, 4, 'hull', ins=3, tt=2, ft=-2, topmat='glass', ol=False, seams=False)
        for r in range(1, 12):
            l = int(round(3 * (1 - r / 12)))
            for x in range(x0 + l, x0 + 38 - l):
                if (x - x0) % 6 == 0 or r % 4 == 0: c.P(x, 1 + r, K('hull', 1))
        c.line(x0 + 8, 11, x0 + 14, 3, K('glass', 3))
    c.outline()


@piece2('dish', '안테나 접시(판 받침 + 굵은 기둥 + 기울어진 흰 접시 + 수신기)', 2, 3, 'structure', solid=[(0, 2), (1, 2)], tags=['안테나', '접시'], desc='통신 접시.', **O)
def _(c):
    box2(c, 3, 33, 26, 7, 8, 'hull', tt=2, ft=-1, tex='plate'); c.P(7, 44, K('green', 3))
    c.R(13, 22, 6, 12, K('hull', -1)); c.VL(13, 22, 12, K('hull', 1)); c.VL(18, 22, 12, K('hull', -3))
    for y in range(4, 26):
        for x in range(1, 31):
            d = ((x - 15.5) / 14.5) ** 2 + ((y - 15) / 10.5) ** 2
            if d <= 1:
                rim = d > .82
                t = (3 if x + y < 26 else 2 if x + y < 36 else 1) if not rim else 0
                if not rim and d < .5 and x + y > 28: t -= 1
                c.P(x, y, K('white', t))
    c.ell(16, 15, 3, 2, K('hull', 0)); c.line(16, 15, 25, 5, K('hull', 2)); c.line(16, 15, 7, 6, K('hull', 1))
    c.R(24, 3, 3, 3, K('hull', 1)); c.P(25, 3, K('orange', 3))
    c.outline()


@piece2('dish-small', '소형 안테나 접시(받침 상자 + 작은 흰 접시)', 1, 2, 'structure', solid=[(0, 1)], tags=['안테나', '접시'], desc='작은 통신 접시.', **O)
def _(c):
    box2(c, 2, 19, 12, 5, 7, 'hull', tt=2, ft=-1); c.P(4, 25, K('cyan', 3))
    c.R(7, 12, 2, 8, K('hull', 0))
    for y in range(2, 14):
        for x in range(1, 15):
            d = ((x - 7.5) / 6.5) ** 2 + ((y - 7.5) / 5.5) ** 2
            if d <= 1: c.P(x, y, K('white', 0 if d > .75 else 3 if x + y < 12 else 2))
    c.P(8, 7, K('hull', 0)); c.line(8, 7, 12, 3, K('hull', 2)); c.P(12, 2, K('cyan', 3))
    c.outline()


@piece2('antenna-mast', '안테나 마스트(세 단 굵은 탑 + 위험 띠 + 꼭대기 경고등)', 2, 4, 'structure', solid=[(0, 3), (1, 3)], tags=['안테나', '마스트'], desc='통신 마스트.', **O)
def _(c):
    box2(c, 1, 44, 30, 8, 12, 'hull', tt=2, ft=-1, tex='plate'); hazard(c, 2, 53, 28, 2)
    box2(c, 6, 28, 20, 6, 14, 'white', tt=2, ft=-1); c.HL(7, 37, 18, K('cyan', 2))
    box2(c, 10, 14, 12, 5, 13, 'hull', tt=2, ft=-1); c.P(13, 22, K('cyan', 3)); c.P(18, 22, K('cyan', 1))
    box2(c, 12, 4, 8, 4, 8, 'orange', tt=2, ft=-1); c.R(14, 6, 4, 1, K('glow', 0))
    c.R(15, 0, 2, 4, K('hull', 2)); c.P(15, 0, K('orange', 3))
    c.outline()


@piece2('radiator-panel', '방열 패널(눕힌 핀 판 윗면 + 받침 상자)', 3, 2, 'structure', solid=[(x, 1) for x in range(3)], tags=['방열', '패널'], desc='열 방출 패널.', **O)
def _(c):
    box2(c, 14, 20, 20, 4, 7, 'hull', tt=2, ft=-1); c.P(17, 26, K('orange', 3))
    tcube(c, 1, 1, 46, 16, 4, 'hull', ins=4, tt=2, ft=-2, topmat='white', ol=False, seams=False)
    for x in range(6, 43, 3):
        for r in range(2, 15): c.P(x, 1 + r, K('white', 0 if r % 2 else 1))
        c.P(x + 1, 3, K('white', 4))
    c.HL(4, 9, 40, K('rust', 1))
    c.outline()


@piece2('battery-bank', '축전지 뱅크(윗면 전지 셀 넷 + 전극 + 충전 램프)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['전지', '발전'], desc='식민지 축전지 상자.', **O)
def _(c):
    box2(c, 1, 1, 30, 9, 5, 'hull', tt=2, ft=-1)
    for i in range(4):
        x = 3 + i * 7
        rnd(c, x, 2, 6, 6, K('green', 0)); c.HL(x + 1, 2, 4, K('green', 2)); c.HL(x + 1, 7, 4, K('green', -2))
        c.P(x + 1, 3, K('white', 2)); c.P(x + 4, 3, K('cable', 0))
    inset(c, 3, 11, 26, 3, 'hull', 0); leds(c, 5, 12, 4, ('green', 'green', 'orange'), 3, 1)
    c.outline()


@piece2('oxygen-tank-row', '산소 탱크 줄(받침판 + 흰 원통 셋 + 시안 띠 + 밸브)', 3, 2, 'round_body', solid=[(x, 1) for x in range(3)], tags=['탱크', '산소'], desc='생명 유지 산소 탱크.', **O)
def _(c):
    box2(c, 1, 22, 46, 4, 5, 'hull', tt=2, ft=-1)
    for x in (9, 24, 39):
        cyl(c, x, 6, 6, 3, 15, 'white', tt=2, ft=-1, ol=False)
        for xx in range(x - 6, x + 7):
            u = (xx - x) / 6.5; dy = int(round(3 * (1 - u * u) ** .5)) if abs(u) <= 1 else 0
            c.P(xx, 13 + dy, K('cyan', 1)); c.P(xx, 14 + dy, K('cyan', -1))
        c.R(x - 1, 2, 3, 3, K('hull', 1)); c.P(x - 1, 2, K('hull', 3))
    c.outline()


@piece2('crate-stack', '화물 상자 더미(큰 회색 상자 + 위 주황 상자 + 옆 작은 상자)', 2, 2, 'box', solid=[(0, 1), (1, 1), (0, 0)], tags=['화물', '상자'], desc='쌓아 둔 화물 상자.', **O)
def _(c):
    box2(c, 1, 12, 19, 7, 11, 'hull', tt=2, ft=-1); c.HL(2, 15, 17, K('hull', 0)); hazard(c, 3, 25, 6, 2)
    box2(c, 3, 2, 14, 6, 6, 'orange', tt=2, ft=-1); c.HL(4, 4, 12, K('orange', 0)); c.P(9, 11, K('hull', 1))
    box2(c, 21, 19, 10, 5, 7, 'orange', tt=2, ft=-1); c.HL(22, 21, 8, K('orange', 0))
    c.outline()


@piece2('container', '운송 컨테이너(주름 판 앞면 + 윗면 이음 + 문 잠금대)', 3, 2, 'box', solid=[(x, 1) for x in range(3)], tags=['컨테이너', '화물'], desc='화물 컨테이너.', **O)
def _(c):
    box2(c, 1, 2, 46, 10, 17, 'orange', tt=2, ft=-1, tex='plate')
    for x in range(3, 45, 3): c.VL(x, 13, 15, K('orange', 1)); c.VL(x + 1, 13, 15, K('orange', -2))
    for x in (34, 39): c.R(x, 14, 1, 13, K('hull', 2))
    c.R(4, 15, 8, 4, K('white', 1)); c.HL(4, 15, 8, K('white', 3))
    c.outline()


@piece2('container-stack', '컨테이너 더미(아래 남색 + 위 주황, 두 대)', 3, 3, 'box', solid=[(x, 2) for x in range(3)] + [(1, 1)], tags=['컨테이너', '화물', '쌓기'], desc='쌓은 컨테이너.', **O)
def _(c):
    box2(c, 1, 18, 46, 8, 20, 'navy', tt=2, ft=0)
    for x in range(3, 45, 3): c.VL(x, 27, 18, K('navy', 2)); c.VL(x + 1, 27, 18, K('navy', -2))
    box2(c, 5, 2, 38, 8, 13, 'orange', tt=2, ft=-1)
    for x in range(7, 41, 3): c.VL(x, 11, 11, K('orange', 1)); c.VL(x + 1, 11, 11, K('orange', -2))
    c.R(3, 18, 44, 1, K('navy', -1))
    hazard(c, 6, 22, 36, 1); c.outline()


@piece2('beacon', '착륙 유도등 상자(낮은 상자 + 윗면 주황 렌즈 + 빛)', 1, 1, 'box', solid=[(0, 0)], tags=['비콘', '램프'], desc='착륙장 유도등.', **O)
def _(c):
    tcube(c, 1, 3, 14, 8, 4, 'hull', ins=2, tt=2, ft=-1, topmat='white', ol=False, seams=False)
    c.ell(8, 6, 3, 2, K('orange', 0)); c.ell(8, 6, 2, 1, K('orange', 2)); c.P(7, 5, K('glow', 0))
    c.R(3, 13, 10, 1, K('hull', -3)); c.P(3, 12, K('cyan', 3)); c.outline()


@piece2('sign-chunky', '경고 표지 상자(깊은 윗면 + 주황 삼각 경고면 + 받침)', 1, 2, 'box', solid=[(0, 1)], tags=['표지', '경고'], desc='구역 경고 표지.', **O)
def _(c):
    box2(c, 1, 2, 14, 7, 17, 'hull', tt=2, ft=-1)
    c.R(3, 11, 10, 9, K('orange', 0)); c.HL(3, 11, 10, K('orange', 2))
    for j in range(5): c.HL(8 - j, 12 + j, 2 * j + 1, K('yellow', 2))
    c.R(7, 13, 2, 2, K('cable', 0)); c.P(7, 16, K('cable', 0))
    box2(c, 3, 26, 10, 2, 4, 'hull', tt=2, ft=-2)
    c.outline()


@piece2('barrier', '위험 차단벽(노랑 윗면 + 노랑·검정 사선 앞면)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['방벽', '위험'], desc='통행 차단 방벽.', **O)
def _(c):
    tcube(c, 1, 2, 30, 7, 6, 'cable', ins=2, tt=3, ft=0, topmat='yellow', ol=False, seams=False)
    hazard(c, 1, 9, 30, 5, diag=4); c.HL(1, 9, 30, K('yellow', 3)); c.HL(1, 13, 30, K('cable', -2))
    c.P(4, 4, K('orange', 3)); c.P(27, 4, K('orange', 3)); c.outline()


@piece2('vent-stack', '배기 굴뚝(받침 상자 위 짧고 굵은 원통 + 어두운 입구)', 1, 2, 'structure', solid=[(0, 1)], tags=['환기', '굴뚝'], desc='선체 배기구.', **O)
def _(c):
    box2(c, 1, 20, 14, 4, 7, 'hull', tt=2, ft=-1)
    cyl(c, 8, 6, 5, 2, 13, 'white', tt=2, ft=-1, ol=False, bands=1)
    c.ell(8, 6, 3, 1, K('cable', -1)); c.HL(3, 16, 10, K('orange', 2))
    c.outline()


@piece2('comms-relay', '통신 중계기(넓은 장비 상자 윗면(환기 격자·안테나 받침) + 위를 향한 작은 접시 + 앞 램프 패널)', 2, 2, 'structure', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['통신', '중계'], desc='통신 중계기.', **O)
def _(c):
    fy = box2(c, 1, 8, 30, 12, 10, 'hull', tt=2, ft=-1, tex='plate', seed=3)
    grille(c, 4, 11, 10, 4, 'hull', 1)
    inset(c, 4, fy + 2, 14, 5, 'hull', 0); leds(c, 6, fy + 4, 5, ('green', 'cyan'), 2)
    c.R(24, fy + 2, 4, 6, K('cable', -1)); c.P(25, fy + 3, K('orange', 3))
    c.R(22, 12, 3, 5, K('hull', 0)); c.VL(22, 12, 5, K('hull', 2))           # 접시 받침
    c.ell(23, 7, 7, 4, K('white', 1)); c.ell(23, 7, 6, 3, K('white', 3)); c.ell(24, 8, 3, 1, K('white', 0))   # 위를 향한 접시(안쪽이 보임)
    c.line(23, 7, 27, 2, K('hull', 1)); c.P(27, 1, K('cyan', 3))
    c.R(6, 3, 2, 8, K('hull', 1)); c.P(6, 2, K('orange', 3))
    c.outline()


@piece2('rover', '달 탐사 로버(넓은 흰 지붕 윗면 + 태양 전지판 + 앞 조종석 유리 + 어두운 옆판 + 바퀴 넷 + 그림자)', 3, 2, 'structure', solid=[(x, 1) for x in range(3)], tags=['탈것', '로버'], desc='달 표면 탐사차. 왼쪽이 앞.', **O)
def _(c):
    drop_shadow(c, 24, 29, 21, 2, 1)
    for x in (4, 34):
        c.R(x, 19, 10, 9, K('cable', -1)); c.HL(x, 19, 10, K('cable', 1)); c.HL(x, 27, 10, K('cable', -3))
        for k in range(x + 1, x + 10, 2): c.P(k, 22, K('cable', 2)); c.P(k, 25, K('cable', -2))
        c.R(x + 3, 22, 4, 3, K('hull', 1))
    fy = box2(c, 1, 2, 46, 13, 7, 'white', tt=2, ft=-2)
    c.R(16, 4, 22, 9, K('navy', 0))                                            # 태양 전지판(윗면)
    for x in range(16, 38, 4): c.VL(x, 4, 9, K('navy', -2))
    c.HL(16, 8, 22, K('navy', -2)); c.HL(16, 4, 22, K('navy', 2)); c.P(18, 5, K('glass', 3)); c.P(22, 5, K('glass', 2))
    c.R(3, 4, 10, 8, K('glass', 0)); c.HL(3, 4, 10, K('glass', 3)); c.line(4, 10, 8, 5, K('glass', 2))   # 조종석 유리(윗면 앞쪽)
    c.R(40, 4, 5, 5, K('hull', 1)); c.HL(40, 4, 5, K('hull', 3)); c.P(42, 1, K('orange', 3)); c.VL(42, 2, 2, K('hull', 0))
    c.HL(2, fy + 2, 44, K('orange', 1)); c.P(2, fy + 1, K('yellow', 3)); c.P(45, fy + 1, K('magenta', 2))
    for dx in (16, 31): c.VL(dx, fy + 1, 5, K('white', -3))
    c.outline()


@piece2('landing-pad', '착륙장 바닥(판 이음 + 노랑 위험 고리 + 사각 표적 + 모서리 등)', 4, 3, 'flat', solid=[], tags=['착륙장', '바닥'], desc='셔틀 착륙 바닥. 걷는다.', **O)
def _(c):
    c.R(0, 0, 64, 48, K('hull', -2)); plating(c, 0, 0, 64, 48, 'hull', -2, pw=16, ph=16)
    c.HL(0, 0, 64, K('hull', 0)); c.VL(0, 0, 48, K('hull', 0)); c.HL(0, 47, 64, K('hull', -3)); c.VL(63, 0, 48, K('hull', -3))
    import math
    for a in range(0, 360, 3):
        x = 32 + 24 * math.cos(math.radians(a)); y = 24 + 18 * math.sin(math.radians(a))
        c.P(int(round(x)), int(round(y)), K('yellow', 1) if (a // 15) % 2 else K('cable', 0))
        c.P(int(round(32 + 23 * math.cos(math.radians(a)))), int(round(24 + 17 * math.sin(math.radians(a)))), K('yellow', 0) if (a // 15) % 2 else K('cable', 0))
    c.R(24, 18, 16, 12, K('white', 2)); c.R(26, 20, 12, 8, K('hull', -2)); c.R(30, 22, 4, 4, K('orange', 2)); c.P(30, 22, K('orange', 3))
    for (x, y) in ((3, 3), (60, 3), (3, 44), (60, 44)): c.P(x, y, K('cyan', 3)); c.P(x + 1, y, K('cyan', 1))


for _rid in ('rock-regolith-s', 'rock-regolith-m', 'rock-regolith-l', 'boulder-cluster'): REDRAWN.add(_rid)   # 면 바위 rock() 은 Opus 가 이 세션에서 다시 쓴 것


@piece2('crater', '운석 구덩이(밝은 둘레 언덕 + 그늘진 안쪽 사면 + 바닥 + 흩어진 파편)', 3, 2, 'flat', solid=[], tags=['구덩이', '달'], desc='달 표면 구덩이. 걷는다.', **O)
def _(c):
    import math
    for y in range(32):
        for x in range(48):
            nx = (x - 23.5) / 22.5; ny = (y - 15.5) / 14.5; d = nx * nx + ny * ny + (hsh(x, y, 3) % 4) * .012
            if d > 1: continue
            if d > .66:                                                       # 둘레 언덕: 왼쪽 위 밝음
                lit = -nx * .6 - ny * .8
                c.P(x, y, K('regolith', 3 if lit > .45 else 2 if lit > 0 else 1 if lit > -.45 else 0))
            elif d > .3:                                                      # 안쪽 사면: 빛 반대(왼쪽 위 사면이 그늘)
                lit = nx * .6 + ny * .8
                c.P(x, y, K('regolith', 1 if lit > .35 else 0 if lit > 0 else -1 if lit > -.35 else -2))
            else:
                c.P(x, y, K('regolith', -2 if hsh(x, y, 9) % 9 == 0 else -1))
    for k in range(9):
        a = hsh(k, 1, 7) % 360; r = 1.05 + (hsh(k, 2, 7) % 10) / 40
        x = int(23.5 + 22.5 * r * math.cos(math.radians(a))); y = int(15.5 + 14.5 * r * math.sin(math.radians(a)))
        if 0 <= x < 48 and 0 <= y < 32: c.P(x, y, K('regolith', 2)); c.P(min(47, x + 1), y, K('regolith', -1))

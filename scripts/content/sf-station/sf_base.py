"""sf_station 기본 조각(관문 보정 통과 12종 — 이후 조각의 기준 그림)."""
from sf_core import *

@piece('hab-dome', '거주 돔(유리 돔 + 원통 기단)', 4, 4, 'structure', group='outdoor', solid=[(x, 3) for x in range(4)] + [(x, 2) for x in (0, 3)], tags=['돔', '거주구', '건물'], desc='식민지 거주 돔. 문은 정면 아래.')
def _dome(c):
    cyl(c, 32, 36, 29, 12, 12, 'hull', tt=3, ft=-1, ol=False, bands=0)
    dome(c, 32, 33, 23, 10, 'glass', ribs=3)
    door_panel(c, 27, 41, 10, 10)
    for i in (9, 14, 44, 49): c.HL(i, 44 + abs(32 - i) // 6, 3, K('cyan', 3))
    c.outline()

@piece('airlock', '에어록 모듈(사다리꼴 지붕 윗면 + 미닫이 문)', 3, 3, 'structure', group='outdoor', solid=[(0, 2), (1, 2), (2, 2), (0, 1), (2, 1)], tags=['에어록', '문'], desc='선체 바깥 출입구. 문은 가운데 아래.')
def _airlock(c):
    tcube(c, 0, 3, 48, 15, 26, 'hull', ins=5, tt=3, ft=-3, ol=False)
    cube(c, 18, 7, 12, 5, 3, 'white', tt=3, ft=-1, ol=False)
    hazard(c, 1, 20, 46, 2); door_panel(c, 16, 25, 16, 15)
    texture_face(c, 0, 18, 48, 26, 'hull', -3, seam=8, band=0, seed=11)
    c.HL(0, 44, 48, K('hull', 2)); c.HL(0, 45, 48, K('hull', -3)); c.outline()

@piece('neon-sign-tower', '네온 간판 탑(콘크리트 윗면 + 간판 상자, 글자 없음)', 1, 3, 'box', group='street', solid=[(0, 2)], tags=['네온', '간판'], desc='거리 간판 탑. 마젠타 띠.', line='B')
def _neon(c):
    cube(c, 1, 3, 14, 8, 25, 'cable', tt=4, ft=-1, ol=False, topmat='conc', tex='plate')
    c.R(3, 13, 10, 14, K('navy', -2))
    for k in range(4): c.HL(4, 15 + k * 3, 8, K('magenta', 3 if k % 2 == 0 else 2))
    cube(c, 2, 36, 12, 5, 7, 'conc', tt=3, ft=-1, ol=False); c.outline()

@piece('console-desk', '조종 콘솔(윗면 계기 + 앞면 패널)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['콘솔', '계기'], desc='함교 조종 책상.')
def _console(c):
    cube(c, 1, 2, 30, 8, 5, 'hull', tt=3, ft=-1, ol=False)
    screen(c, 4, 3, 10, 5, 'cyan', 1, 'graph'); screen(c, 17, 3, 10, 5, 'green', 2, 'lines')
    c.P(15, 4, K('orange', 3)); c.P(15, 6, K('orange', 2))
    led(c, 5, 11, 'cyan'); led(c, 8, 11, 'orange'); led(c, 11, 11, 'green'); c.outline()

@piece('vending', '자판기(윗면 + 앞 유리창 + 버튼)', 1, 2, 'tall_furniture', group='street', solid=[(0, 1), (0, 0)], tags=['자판기'], desc='거리 자판기.', line='B')
def _vend(c):
    cube(c, 1, 2, 14, 8, 20, 'hull', tt=3, ft=-1, ol=False, tex='plate')
    c.R(3, 12, 8, 14, K('glass', -1)); c.HL(3, 12, 8, K('cyan', 3))
    for j in range(3):
        for i in range(2): c.R(4 + i * 4, 14 + j * 4, 3, 3, K(('magenta', 'cyan', 'orange')[(i + j) % 3], 2))
    c.R(12, 14, 2, 7, K('cable', 0)); c.P(12, 15, K('green', 3)); c.R(5, 28, 6, 2, K('cable', -2)); c.outline()

@piece('cargo-crate', '화물 상자(윗면 + 앞면 띠)', 1, 1, 'box', group='interior', solid=[(0, 0)], tags=['화물'], desc='화물 상자.')
def _crate(c):
    cube(c, 1, 2, 14, 7, 6, 'orange', tt=3, ft=-1, ol=False, tex='plate'); c.VL(8, 9, 6, K('orange', -3)); c.HL(1, 11, 14, K('orange', -2)); hazard(c, 2, 13, 5, 1); c.outline()

@piece('reactor', '소형 반응로(원통 코어)', 2, 2, 'round_body', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['반응로'], desc='기관실 반응로 코어.')
def _reactor(c):
    cyl(c, 16, 10, 13, 6, 14, 'hull', tt=3, ft=-1, ol=False, bands=2)
    c.ell(16, 10, 8, 3, K('cyan', 1)); c.ell(16, 10, 5, 2, K('cyan', 3)); c.P(16, 10, K('glow', 1))
    for x in (6, 26): c.R(x, 18, 2, 6, K('cyan', 2))
    c.outline()

@piece('solar-array', '태양광 패널 열(경사 패널 + 프레임)', 3, 2, 'structure', group='outdoor', solid=[(0, 1), (1, 1), (2, 1)], tags=['태양광', '패널'], desc='식민지 발전 패널.')
def _solar(c):
    cube(c, 1, 2, 46, 14, 4, 'navy', tt=2, ft=-2, ol=False, topmat='glass')
    for i in range(6, 46, 8): c.VL(i, 3, 12, K('hull', 2))
    for j in (7, 12): c.HL(2, j, 44, K('hull', 2))
    for k in range(5): c.P(3 + k * 9, 4 + k % 3, K('glow', 0))
    cube(c, 18, 20, 12, 5, 7, 'hull', tt=3, ft=-1, ol=False); led(c, 22, 24, 'green'); c.outline()

@piece('dish', '안테나 접시(받침 윗면 + 타원 접시)', 2, 3, 'structure', group='outdoor', solid=[(0, 2), (1, 2)], tags=['안테나'], desc='통신 접시.')
def _dish(c):
    cube(c, 3, 34, 26, 7, 7, 'hull', tt=3, ft=-1, ol=False, tex='plate')
    cyl(c, 16, 38, 5, 2, 0, 'cable', ol=False)
    c.VL(16, 22, 14, K('hull', 1)); c.VL(17, 22, 14, K('hull', -1))
    for y in range(6, 24):
        for x in range(2, 30):
            d = ((x - 15.5) / 13.5) ** 2 + ((y - 15) / 9) ** 2
            if d <= 1: c.P(x, y, K('white', 2 + (1 if x - 15 + y - 15 < -4 else 0) - (1 if d > .8 else 0) - (1 if d < .12 else 0)))
    c.ell(16, 15, 2, 1, K('cyan', 3)); c.line(16, 15, 24, 4, K('hull', 3)); c.P(24, 3, K('orange', 3)); c.outline()

@piece('pod-car', '호버 포드(사다리꼴 캐노피 윗면 + 측면 패널)', 3, 2, 'structure', group='street', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '포드'], desc='거리 호버 포드.', line='B')
def _pod(c):
    tcube(c, 2, 4, 44, 14, 9, 'magenta', ins=6, tt=3, ft=-2, ol=False)
    c.R(14, 7, 20, 6, K('glass', 0)); c.HL(14, 7, 20, K('cyan', 3)); c.R(23, 7, 2, 6, K('hull', -1))
    c.R(4, 21, 8, 1, K('cyan', 3)); c.R(36, 21, 8, 1, K('cyan', 3)); c.HL(6, 24, 36, K('shadow', 1)); c.outline(); drop_shadow(c, 24, 29, 18, 2)

@piece('server-rack', '서버 랙(윗면 + 램프 줄)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['서버'], desc='서버 랙.')
def _rack(c):
    cube(c, 1, 2, 14, 8, 20, 'cable', tt=3, ft=0, ol=False, tex='grate')
    for j in range(5):
        c.HL(3, 12 + j * 3, 10, K('hull', -1)); 
        for i in range(4): c.P(4 + i * 2, 13 + j * 3, K(('green', 'cyan', 'orange')[(i + j) % 3], 3))
    c.outline()

@piece('bunk', '이층 침대(윗면 매트리스 + 사다리)', 2, 2, 'low_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['침대'], desc='승무원 이층 침대.')
def _bunk(c):
    cube(c, 1, 2, 30, 11, 14, 'hull', tt=3, ft=-1, ol=False, topmat='white')
    c.R(3, 4, 12, 6, K('cyan', 1)); c.HL(3, 4, 12, K('cyan', 3)); c.R(3, 4, 8, 3, K('white', 4))
    c.R(2, 17, 28, 9, K('hull', -2)); c.R(4, 19, 24, 5, K('cable', 0)); c.HL(4, 19, 24, K('hull', 1)); c.VL(30, 14, 12, K('hull', 2)); c.outline()

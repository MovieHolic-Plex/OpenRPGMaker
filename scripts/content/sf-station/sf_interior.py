"""sf_station 실내 조각(정거장·실험실·달기지: 함교·승무원실·의무실·실험실·화물칸·기관실·수경재배실·식당).
기준 그림은 sf_base 의 console-desk · bunk · server-rack · cargo-crate · reactor. 새 id 만 등록한다."""
from sf_core import *


def box(c, x, y, w, top, front, mat, **kw):
    kw.setdefault('tt', 3); kw.setdefault('ft', -1)
    cube(c, x, y, w, top, front, mat, ol=False, **kw)


def legs(c, x, y, w, h, lw=3, mat='hull'):
    """앞면 아래 굵은 다리 두 개 + 가운데 그림자(탁자·침대 앞면)."""
    c.R(x, y, w, h, K('shadow', 1))
    c.R(x, y, lw, h, K(mat, -1)); c.VL(x, y, h, K(mat, 1)); c.R(x + w - lw, y, lw, h, K(mat, -2))


# =================================================================== 1) 함교 · 의자 · 식당
@piece('console-big', '함교 주 조종 콘솔(윗면 화면 셋 + 앞 패널)', 3, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0), (2, 0)], tags=['콘솔', '함교'], desc='함교 중앙 큰 콘솔. 벽을 향해 놓는다.')
def _consolebig(c):
    box(c, 1, 2, 46, 8, 5, 'hull', tex='panel')
    screen(c, 4, 3, 11, 5, 'cyan', 3, 'graph'); screen(c, 18, 3, 12, 5, 'green', 4, 'radar'); screen(c, 33, 3, 11, 5, 'cyan', 5, 'lines')
    c.R(16, 4, 1, 3, K('orange', 2)); c.R(31, 4, 1, 3, K('orange', 2))
    c.R(6, 9, 6, 1, K('hull', 5)); c.R(20, 9, 8, 1, K('hull', 5)); c.R(35, 9, 7, 1, K('hull', 5))
    for i, col in enumerate(('cyan', 'orange', 'green', 'cyan', 'orange', 'green', 'cyan', 'orange')): led(c, 5 + i * 5, 11, col)
    c.HL(2, 12, 44, K('hull', -3)); c.outline()


def _chair(c, back, cushion, arm=None, ledcol=None, wide=True, tall=True):
    bx0, bx1 = (3, 13) if wide else (4, 12)
    box(c, bx0, 1, bx1 - bx0, 2, 5 if tall else 4, back, tt=3, ft=-1)
    c.R(bx0 + 2, 4, bx1 - bx0 - 4, 3, K(cushion, 1)); c.HL(bx0 + 2, 4, bx1 - bx0 - 4, K(cushion, 3))
    if arm:
        box(c, 1, 6, 3, 4, 5, arm, tt=3, ft=-1); box(c, 12, 6, 3, 4, 5, arm, tt=3, ft=-1)
    box(c, 3, 7, 10, 5, 4, cushion, tt=3, ft=-2, lip=True)
    c.R(6, 11, 4, 1, K('cushion' if False else 'white', 4)) if False else None
    c.R(6, 11, 4, 5, K('hull', -2)) if False else None
    c.R(5, 12, 6, 3, K('hull', -2)); c.HL(4, 14, 8, K('hull', -3))
    if ledcol: led(c, 2, 8, ledcol); led(c, 13, 8, ledcol)
    c.outline()


@piece('pilot-seat', '조종사 좌석(등받이 + 시안 쿠션 윗면 + 양옆 팔걸이 콘솔)', 1, 1, 'seat', group='interior', solid=[(0, 0)], tags=['의자', '조종석'], desc='함교 조종석.')
def _pilot(c): _chair(c, 'hull', 'cyan', arm='hull', ledcol='orange')

@piece('crew-chair', '승무원 의자(흰 등받이 + 회색 쿠션)', 1, 1, 'seat', group='interior', solid=[(0, 0)], tags=['의자'], desc='승무원 일반 의자.')
def _crew(c): _chair(c, 'white', 'hull', wide=False)

@piece('captain-chair', '함장 의자(높은 등받이 + 주황 쿠션 + 팔걸이)', 1, 1, 'seat', group='interior', solid=[(0, 0)], tags=['의자', '함장'], desc='함장석.')
def _captain(c): _chair(c, 'hull', 'orange', arm='white', ledcol='cyan')


@piece('stool', '둥근 걸상(원통 + 타원 쿠션 윗면)', 1, 1, 'round_body', group='interior', solid=[(0, 0)], tags=['걸상'], desc='식당·실험실 둥근 걸상.')
def _stool(c):
    cyl(c, 8, 7, 6, 3, 3, 'white', tt=3, ft=-1, ol=False)
    c.ell(8, 7, 4, 2, K('cyan', 2)); c.P(7, 6, K('cyan', 4))
    c.R(6, 12, 4, 2, K('hull', -2)); c.HL(4, 14, 8, K('hull', -1)); c.outline()


@piece('bench', '긴 벤치(쿠션 윗면 + 받침 상자)', 2, 1, 'seat', group='interior', solid=[(0, 0), (1, 0)], tags=['벤치'], desc='복도·식당 긴 벤치.')
def _bench(c):
    box(c, 1, 2, 30, 7, 4, 'cyan', tt=2, ft=-2, topmat='cyan')
    c.R(3, 3, 12, 4, K('cyan', 4)); c.HL(3, 3, 12, K('cyan', 6)); c.R(17, 3, 12, 4, K('cyan', 4)); c.HL(17, 3, 12, K('cyan', 6)); c.VL(15, 3, 4, K('cyan', 0)); c.VL(16, 3, 4, K('cyan', 0))
    box(c, 3, 10, 26, 3, 3, 'hull', tt=2, ft=-2, lip=False); c.R(3, 13, 3, 2, K('hull', -2)); c.R(26, 13, 3, 2, K('hull', -2)); c.outline()


@piece('mess-table', '식당 탁자(흰 윗면 + 식판 + 굵은 다리)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['탁자', '식당'], desc='식당·휴게실 탁자.')
def _mess(c):
    box(c, 1, 1, 30, 9, 3, 'white', tt=3, ft=-2)
    for x, col in ((4, 'orange'), (13, 'cyan'), (22, 'green')):
        c.R(x, 3, 6, 4, K('hull', -1)); c.R(x + 1, 3, 4, 3, K(col, 2)); c.HL(x + 1, 3, 4, K(col, 4)); c.HL(x, 6, 6, K('hull', -3))
    c.R(11, 2, 2, 2, K('white', 5)); c.R(30 - 4, 2, 2, 2, K('white', 5))
    legs(c, 2, 13, 28, 2, 4, 'hull'); c.outline()


@piece('bed-single', '1인 침대(흰 매트리스 + 베개 + 담요 윗면)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['침대'], desc='승무원실 1인 침대.')
def _bed(c):
    box(c, 1, 1, 30, 11, 4, 'hull', tt=3, ft=-1)
    c.R(2, 2, 28, 8, K('white', 3)); c.HL(2, 2, 28, K('white', 5)); c.VL(2, 3, 7, K('white', 4))
    c.R(3, 3, 8, 4, K('white', 6)); c.HL(3, 3, 8, K('white', 5)); c.HL(3, 6, 8, K('white', 3))
    c.R(11, 4, 18, 6, K('cyan', 1)); c.HL(11, 4, 18, K('cyan', 3)); c.VL(11, 5, 5, K('cyan', 2)); c.HL(11, 9, 18, K('cyan', 0))
    c.R(2, 15, 3, 1, K('hull', -2)); c.R(27, 15, 3, 1, K('hull', -2)); led(c, 14, 13, 'cyan'); led(c, 17, 13, 'orange'); c.outline()


@piece('med-bed', '의무실 침대(흰 매트리스 + 머리맡 모니터 + 담요)', 2, 2, 'low_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['침대', '의무실'], desc='의무실 환자 침대.')
def _medbed(c):
    box(c, 2, 9, 28, 14, 6, 'white', tt=3, ft=-2)
    c.R(4, 10, 24, 11, K('cyan', 2)); c.HL(4, 10, 24, K('cyan', 4)); c.VL(4, 11, 10, K('cyan', 3)); c.HL(4, 20, 24, K('cyan', 1))
    c.R(5, 11, 8, 5, K('white', 6)); c.HL(5, 11, 8, K('white', 5)); c.HL(5, 15, 8, K('white', 3))
    c.R(14, 14, 13, 6, K('white', 3)); c.HL(14, 14, 13, K('white', 5)); c.VL(14, 15, 5, K('white', 4))
    box(c, 3, 1, 12, 4, 4, 'hull', tt=3, ft=-1); screen(c, 5, 2, 8, 3, 'green', 7, 'graph')
    c.R(2, 29, 4, 2, K('hull', -2)); c.R(26, 29, 4, 2, K('hull', -2)); led(c, 10, 27, 'green'); led(c, 13, 27, 'cyan'); c.outline()


@piece('med-scanner', '의무실 링 스캐너(환형 터널 몸체 + 이동 베드)', 2, 2, 'structure', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['스캐너', '의무실'], desc='의무실 단층 스캐너. 환자 베드가 앞으로 나온다.')
def _scan(c):
    tcube(c, 2, 1, 28, 9, 14, 'white', ins=3, tt=3, ft=-2, ol=False, seams=False)
    c.ell(16, 16, 8, 6, K('hull', -1)); c.ell(16, 16, 7, 5, K('cable', -1)); c.ell(16, 16, 5, 3, K('cyan', -1)); c.ell(16, 17, 3, 1, K('cyan', 1))
    for x in range(8, 25):
        u = (x - 16) / 8.5
        if abs(u) <= 1: c.P(x, 16 - int(round(6 * (1 - u * u) ** .5)), K('cyan', 3))
    led(c, 4, 12, 'green'); led(c, 27, 12, 'orange')
    box(c, 7, 21, 18, 5, 4, 'hull', tt=3, ft=-1, topmat='white'); c.R(10, 22, 12, 3, K('cyan', 1)); c.HL(10, 22, 12, K('cyan', 3))
    c.R(8, 30, 3, 1, K('hull', -2)); c.R(21, 30, 3, 1, K('hull', -2)); c.outline()


@piece('med-cabinet', '의료 보관장(윗면 + 유리문 + 약품 칸)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['캐비닛', '의무실'], desc='의무실 약품장.')
def _medcab(c):
    box(c, 1, 2, 14, 8, 20, 'white', tt=3, ft=-2)
    c.R(3, 12, 10, 12, K('glass', -1)); c.HL(3, 12, 10, K('cyan', 3)); c.VL(8, 12, 12, K('hull', -1))
    for j in range(3):
        for i in range(2): c.R(4 + i * 5, 14 + j * 4, 3, 2, K(('green', 'orange', 'cyan')[(i + j) % 3], 3))
        c.HL(3, 16 + j * 4, 10, K('white', -2))
    c.R(3, 26, 10, 3, K('white', -1)); c.HL(3, 26, 10, K('white', 1)); led(c, 6, 28, 'green'); c.outline()


# =================================================================== 2) 의무 · 실험실
@piece('cryo-pod', '냉동 수면 포드(상자 몸체 + 윗면 유리 뚜껑 + 안의 형체 없는 안개)', 1, 2, 'box', group='interior', solid=[(0, 1), (0, 0)], tags=['냉동', '포드'], desc='냉동 수면 포드 1기. 여러 개 나란히.')
def _cryo(c):
    box(c, 1, 2, 14, 15, 14, 'white', tt=3, ft=-2)
    c.R(3, 4, 10, 11, K('cable', 0)); c.R(4, 5, 8, 9, K('cyan', 0)); c.R(4, 5, 8, 3, K('cyan', 2)); c.HL(4, 5, 8, K('cyan', 5)); c.VL(4, 6, 7, K('cyan', 3))
    c.R(5, 10, 6, 3, K('white', 3)); c.HL(5, 10, 6, K('white', 5))
    c.HL(3, 14, 10, K('white', 5)); c.HL(2, 16, 12, K('hull', 1))
    c.R(3, 19, 10, 9, K('hull', -2)); c.HL(3, 19, 10, K('hull', 2)); led(c, 5, 22, 'cyan'); led(c, 8, 22, 'green'); led(c, 11, 22, 'orange')
    c.R(4, 25, 8, 2, K('cable', -1)); c.R(2, 30, 3, 1, K('hull', -2)); c.R(11, 30, 3, 1, K('hull', -2)); c.outline()


@piece('cryo-bank', '냉동 수면 포드 세 기 묶음(윗면 유리 뚜껑 셋 + 공용 제어 띠)', 3, 2, 'box', group='interior', solid=[(x, y) for x in range(3) for y in (0, 1)], tags=['냉동', '포드'], desc='냉동 수면 포드 3기 한 덩이.')
def _cryobank(c):
    box(c, 1, 2, 46, 15, 14, 'white', tt=3, ft=-2)
    for k in range(3):
        x = 3 + k * 15
        c.R(x, 4, 12, 11, K('cable', 0)); c.R(x + 1, 5, 10, 9, K('cyan', 0)); c.R(x + 1, 5, 10, 3, K('cyan', 2)); c.HL(x + 1, 5, 10, K('cyan', 5)); c.VL(x + 1, 6, 7, K('cyan', 3))
        c.R(x + 3, 10, 6, 3, K('white', 3)); c.HL(x + 3, 10, 6, K('white', 5))
    c.HL(2, 14, 44, K('white', 5)); c.HL(2, 16, 44, K('hull', 1))
    c.R(3, 19, 42, 9, K('hull', -2)); c.HL(3, 19, 42, K('hull', 2))
    for k in range(3):
        x = 5 + k * 15; led(c, x, 22, 'cyan'); led(c, x + 3, 22, 'green'); led(c, x + 6, 22, 'orange'); c.R(x, 25, 9, 2, K('cable', -1))
    for x in (2, 14, 28, 42): c.R(x, 30, 3, 1, K('hull', -2))
    c.outline()


@piece('lab-bench', '실험대(흰 상판 + 유리 기구 + 시료병 + 아래 수납)', 3, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0), (2, 0)], tags=['실험대', '실험실'], desc='실험실 긴 작업대.')
def _labbench(c):
    box(c, 1, 1, 46, 9, 5, 'white', tt=3, ft=-2)
    c.R(4, 3, 6, 5, K('glass', 0)); c.R(5, 4, 4, 4, K('green', 2)); c.HL(5, 4, 4, K('green', 4)); c.HL(4, 3, 6, K('cyan', 4))
    c.R(13, 4, 4, 4, K('cyan', 2)); c.HL(13, 4, 4, K('cyan', 5)); c.R(14, 3, 2, 1, K('white', 5))
    c.R(20, 3, 7, 5, K('cable', 0)); c.R(21, 4, 5, 3, K('cyan', 2)); c.P(25, 4, K('orange', 3))
    c.R(30, 4, 4, 4, K('orange', 2)); c.HL(30, 4, 4, K('orange', 4)); c.R(36, 3, 3, 5, K('magenta', 2)); c.HL(36, 3, 3, K('magenta', 4)); c.R(41, 4, 4, 4, K('green', 2)); c.HL(41, 4, 4, K('green', 4))
    for x in (4, 18, 32): c.R(x, 11, 12, 3, K('hull', -2)); c.HL(x, 11, 12, K('hull', 2)); c.R(x + 5, 12, 2, 1, K('white', 5))
    c.R(2, 14, 3, 1, K('hull', -2)); c.R(43, 14, 3, 1, K('hull', -2)); c.outline()


@piece('lab-sink-bench', '실험실 세면 작업대(상판 + 푹 들어간 싱크 + 수전)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['싱크', '실험실'], desc='실험실 세척대.')
def _labsink(c):
    box(c, 1, 1, 30, 9, 5, 'white', tt=3, ft=-2)
    c.R(4, 3, 12, 6, K('hull', -1)); c.R(5, 4, 10, 4, K('cyan', 1)); c.HL(5, 4, 10, K('cyan', -1)); c.HL(5, 7, 10, K('cyan', 3)); c.P(9, 5, K('cyan', 5)); c.P(11, 6, K('cyan', 5))
    c.R(19, 2, 3, 4, K('hull', 3)); c.HL(19, 2, 3, K('hull', 5)); c.R(19, 5, 6, 2, K('hull', 2)); c.P(24, 7, K('cyan', 5))
    c.R(25, 4, 4, 4, K('orange', 2)); c.HL(25, 4, 4, K('orange', 4))
    c.R(3, 11, 12, 3, K('hull', -2)); c.HL(3, 11, 12, K('hull', 2)); c.R(17, 11, 12, 3, K('hull', -2)); c.HL(17, 11, 12, K('hull', 2)); led(c, 15, 12, 'cyan'); c.outline()


@piece('microscope-station', '현미경 작업대(작은 상판 + 현미경 + 화면)', 1, 1, 'low_furniture', group='interior', solid=[(0, 0)], tags=['현미경', '실험실'], desc='실험실 현미경 한 대.')
def _micro(c):
    box(c, 1, 5, 14, 5, 5, 'white', tt=3, ft=-2)
    c.R(3, 1, 5, 9, K('hull', 1)); c.HL(3, 1, 5, K('hull', 4)); c.VL(3, 2, 7, K('hull', 3)); c.R(5, 3, 3, 3, K('cable', 0)); c.R(4, 8, 8, 2, K('hull', -1)); c.HL(4, 8, 8, K('hull', 3))
    screen(c, 9, 2, 5, 4, 'green', 9, 'graph'); c.R(9, 6, 5, 1, K('hull', -2)); c.R(3, 11, 10, 3, K('hull', -2)); c.HL(3, 11, 10, K('hull', 2)); led(c, 11, 12, 'cyan'); c.outline()


@piece('centrifuge', '원심분리기(원통 몸체 + 윗면 타원 뚜껑 + 시험관 고리)', 1, 1, 'round_body', group='interior', solid=[(0, 0)], tags=['원심분리기', '실험실'], desc='실험실 원심분리기.')
def _centri(c):
    cyl(c, 8, 5, 7, 3, 6, 'white', tt=3, ft=-1, ol=False)
    c.ell(8, 5, 5, 2, K('cable', 0)); c.ell(8, 5, 3, 1, K('hull', 2)); c.P(8, 5, K('cyan', 4))
    for dx in (-4, -1, 2, 5): c.P(8 + dx, 5 + (1 if abs(dx) < 3 else 0), K('orange', 3))
    led(c, 5, 12, 'green'); led(c, 8, 12, 'cyan'); led(c, 11, 12, 'orange'); c.outline()


@piece('fume-hood', '흄 후드 실험장(윗면 환기구 + 유리 앞창 + 안의 기구)', 2, 2, 'tall_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['후드', '실험실'], desc='실험실 유독 가스 후드. 벽 쪽에 놓는다.')
def _fume(c):
    box(c, 1, 2, 30, 11, 19, 'white', tt=3, ft=-2, lip=True, tex='panel')
    c.R(5, 5, 8, 3, K('cable', 0)); [c.HL(6, 5 + k, 6, K('hull', 2)) for k in (0, 2)]; c.R(17, 5, 4, 3, K('white', 0)); c.R(23, 4, 5, 5, K('white', 1)); c.HL(23, 4, 5, K('white', 5)); c.ell(25, 6, 1, 1, K('cable', 0))
    c.R(4, 15, 24, 10, K('glass', -1)); c.HL(4, 15, 24, K('cyan', 3)); c.VL(16, 15, 10, K('white', 0))
    c.R(6, 20, 6, 5, K('green', 2)); c.HL(6, 20, 6, K('green', 4)); c.R(7, 18, 2, 2, K('white', 4)); c.R(19, 21, 4, 4, K('orange', 2)); c.HL(19, 21, 4, K('orange', 4)); c.R(24, 19, 3, 6, K('cyan', 2)); c.HL(24, 19, 3, K('cyan', 5))
    c.R(4, 26, 24, 4, K('hull', -2)); c.HL(4, 26, 24, K('hull', 2)); led(c, 6, 28, 'green'); led(c, 9, 28, 'orange'); c.outline()


@piece('specimen-tank', '표본 수조(받침 상자 + 원통 유리 + 초록 용액)', 1, 2, 'round_body', group='interior', solid=[(0, 1), (0, 0)], tags=['수조', '표본'], desc='연구소 표본 수조.')
def _tank(c):
    cyl(c, 8, 8, 7, 3, 12, 'glass', tt=3, ft=0, ol=False)
    for x in range(2, 15):
        u = (x - 8) / 7.5
        if abs(u) <= 1:
            dy = int(round(3 * (1 - u * u) ** .5))
            for y in range(11, 8 + 12 + dy): c.P(x, y, K('green', 0 + (1 if x < 6 else -1 if x > 11 else 0)))
    c.ell(8, 8, 5, 2, K('green', 3)); c.ell(8, 8, 3, 1, K('green', 5)); c.R(4, 15, 2, 3, K('white', 4)); c.P(10, 17, K('white', 6)); c.P(11, 14, K('white', 6)); c.P(7, 19, K('plant', 3))
    c.R(7, 17, 3, 3, K('plant', 1)); c.P(8, 17, K('plant', 3))
    box(c, 1, 24, 14, 4, 4, 'hull', tt=3, ft=-1, lip=True); led(c, 4, 29, 'cyan'); led(c, 11, 29, 'orange'); c.outline()


@piece('analysis-console', '분석 콘솔(윗면 화면 둘 + 샘플 트레이 + 앞 패널)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['분석', '실험실'], desc='실험실 분석 장비 콘솔.')
def _analysis(c):
    box(c, 1, 2, 30, 8, 5, 'white', tt=3, ft=-2)
    c.R(3, 3, 11, 6, K('cable', -1)); c.HL(3, 3, 11, K('cable', 2)); c.ell(8, 6, 4, 2, K('green', 0)); c.P(8, 6, K('green', 4)); c.P(10, 5, K('green', 3))
    screen(c, 16, 3, 8, 5, 'cyan', 11, 'graph'); c.R(26, 3, 3, 5, K('hull', 0)); c.P(27, 4, K('orange', 3)); c.P(27, 6, K('green', 3))
    c.R(3, 11, 26, 3, K('hull', -2)); c.HL(3, 11, 26, K('hull', 2))
    for i in range(5): c.R(5 + i * 5, 12, 3, 1, K('cable', -2))
    c.outline()


@piece('holo-table', '홀로 테이블(낮은 원판 윗면 + 시안 홀로 원뿔)', 2, 2, 'low_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['홀로', '함교'], desc='전술 홀로그램 테이블.')
def _holo(c):
    box(c, 1, 17, 30, 9, 6, 'hull', tt=3, ft=-1, tex='panel')
    c.ell(16, 21, 11, 3, K('cable', -1)); c.ell(16, 21, 9, 2, K('cyan', -1)); c.ell(16, 21, 6, 1, K('cyan', 1))
    for k in range(10):
        w = 1 + k // 2; y = 18 - k
        c.HL(16 - w, y, 2 * w + 1, K('cyan', 4 if k % 2 == 0 else 3))
    for k in range(10):
        c.P(16 - 1 - k // 2, 18 - k, K('cyan', 5)); c.P(16 + 1 + k // 2, 18 - k, K('cyan', 2))
    c.R(14, 2, 5, 3, K('cyan', 5)); c.R(15, 1, 3, 1, K('glow', 1)); c.P(16, 3, K('glow', 2))
    led(c, 4, 24, 'cyan'); led(c, 27, 24, 'orange'); c.R(6, 28, 20, 2, K('shadow', 1))
    c.outline()


@piece('3d-printer', '3D 프린터(상자 몸체 + 윗면 출력 베드 + 유리 덮개)', 2, 2, 'box', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['프린터', '공작'], desc='공작실 대형 3D 프린터.')
def _printer(c):
    box(c, 1, 2, 30, 12, 16, 'hull', tt=3, ft=-1, tex='panel')
    c.ell(16, 8, 9, 3, K('cable', -1)); c.ell(16, 8, 8, 2, K('hull', -1)); c.ell(16, 8, 6, 2, K('cyan', 1)); c.ell(16, 8, 3, 1, K('orange', 2)); c.P(15, 7, K('orange', 5)); c.P(10, 7, K('cyan', 5))
    c.R(4, 17, 24, 11, K('cable', -1)); c.R(5, 18, 22, 9, K('glass', 1)); c.HL(5, 18, 22, K('cyan', 5)); c.VL(5, 19, 8, K('cyan', 3))
    c.R(10, 22, 8, 4, K('orange', 2)); c.HL(10, 22, 8, K('orange', 4)); c.R(12, 19, 4, 3, K('hull', 3)); c.P(14, 21, K('cyan', 5)); c.VL(8, 19, 8, K('hull', 3)); c.VL(23, 19, 8, K('hull', 3))
    c.R(4, 28, 24, 2, K('hull', -2)); led(c, 6, 29, 'green'); led(c, 9, 29, 'orange')
    c.R(2, 30, 3, 1, K('hull', -2)); c.R(27, 30, 3, 1, K('hull', -2)); c.outline()


# =================================================================== 3) 수경재배 · 숙소 · 식당 · 기관실 · 화물
def leaves(c, x, y, w, s=0, tt=2):
    """윗면 위에 올라선 잎 덩이(둥근 윗선 + 밝은 점) — 수경 재배용."""
    for i in range(w):
        h = 2 + (hsh(i, s, 7) % 3) + (1 if 1 < i < w - 2 else 0)
        for j in range(h): c.P(x + i, y - j, K('plant', tt + (1 if j == h - 1 else 0) + (1 if (i + j) % 3 == 0 else 0)))
    c.P(x + 1, y - 3, K('plant', 5)); c.P(x + w - 3, y - 4, K('plant', 5))


@piece('hydroponic-rack', '수경 재배 선반(윗면 + 잎 + 보라 재배등 + 물 트레이)', 2, 2, 'tall_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['수경', '재배'], desc='수경 재배실 선반 한 단. 줄지어 놓는다.')
def _hydro(c):
    box(c, 1, 2, 30, 11, 19, 'hull', tt=3, ft=-1, tex='grate')
    c.R(5, 4, 22, 6, K('cable', -1)); c.R(6, 5, 20, 4, K('cyan', -1)); c.HL(6, 5, 20, K('cyan', -2)); c.HL(6, 8, 20, K('cyan', 1))
    leaves(c, 7, 8, 6, 1); leaves(c, 15, 8, 5, 2); leaves(c, 21, 8, 4, 3)
    c.R(3, 15, 26, 12, K('cable', -1)); c.R(4, 16, 24, 3, K('violet', 3)); c.HL(4, 16, 24, K('violet', 6)); c.HL(4, 18, 24, K('violet', 0))
    c.R(4, 20, 24, 6, K('cyan', 0)); c.HL(4, 20, 24, K('cyan', 2)); leaves(c, 6, 25, 6, 4, 1); leaves(c, 15, 25, 8, 5, 1)
    c.R(3, 28, 26, 2, K('hull', -2)); led(c, 6, 29, 'green'); led(c, 9, 29, 'cyan'); led(c, 12, 29, 'orange')
    c.R(2, 30, 3, 1, K('hull', -2)); c.R(27, 30, 3, 1, K('hull', -2)); c.outline()


@piece('planter-box', '재배 상자(흙 윗면 + 초록 식물 덩이 + 금속 테)', 2, 1, 'organic', group='interior', solid=[(0, 0), (1, 0)], tags=['식물', '재배'], desc='휴게실·수경실 낮은 화단 상자.')
def _planter(c):
    box(c, 1, 5, 30, 6, 5, 'hull', tt=3, ft=-1)
    c.R(2, 6, 28, 4, K('rust', -2)); c.HL(2, 6, 28, K('rust', -3))
    leaves(c, 3, 9, 8, 6); leaves(c, 12, 9, 8, 7); leaves(c, 22, 9, 7, 8)
    c.R(3, 12, 26, 1, K('hull', 2)); led(c, 14, 13, 'green'); c.R(2, 15, 3, 1, K('hull', -2)); c.R(27, 15, 3, 1, K('hull', -2)); c.outline()


def _locker(c, w, n, x0=1, cols=('hull', 'white', 'orange')):
    box(c, x0, 2, w, 8, 20, 'hull', tt=3, ft=-1, tex='plate')
    dw = (w - 2) // n
    for k in range(n):
        x = x0 + 1 + k * dw
        c.R(x, 12, dw - 1, 16, K('hull', 0 if k % 2 == 0 else -1)); c.HL(x, 12, dw - 1, K('hull', 3)); c.VL(x, 13, 15, K('hull', 2))
        for j in range(3): c.HL(x + 2, 14 + j * 2, max(2, dw - 5), K('cable', 0))
        c.P(x + dw - 3, 20, K('white', 5)); c.P(x + dw - 3, 21, K('white', 3))
        c.P(x + 1, 26, K(cols[k % 3] if cols[k % 3] != 'hull' else 'cyan', 3))
    c.R(x0 + 1, 29, w - 2, 1, K('hull', -3))


@piece('locker', '개인 사물함(윗면 + 환기 틈 문 + 손잡이)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['사물함'], desc='승무원실 사물함 한 칸.')
def _lockerone(c): _locker(c, 14, 1); c.outline()

@piece('locker-row', '사물함 두 칸 열(윗면 + 문 둘 + 환기 틈)', 2, 2, 'tall_furniture', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['사물함'], desc='승무원실 사물함 줄.')
def _lockerrow(c): _locker(c, 30, 3); c.outline()


@piece('galley-counter', '조리 카운터(스테인리스 상판 + 가열판 + 아래 수납)', 3, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0), (2, 0)], tags=['주방', '식당'], desc='식당 조리대.')
def _galley(c):
    box(c, 1, 1, 46, 9, 5, 'white', tt=3, ft=-2)
    c.R(4, 3, 13, 5, K('cable', 0)); c.ell(8, 5, 3, 1, K('orange', 1)); c.ell(14, 5, 2, 1, K('orange', 2)); c.P(8, 5, K('orange', 5))
    c.R(20, 3, 10, 5, K('hull', -1)); c.R(21, 4, 8, 3, K('cyan', 1)); c.HL(21, 4, 8, K('cyan', -1)); c.R(24, 2, 3, 2, K('hull', 4))
    c.R(33, 3, 5, 5, K('white', 5)); c.HL(33, 3, 5, K('white', 6)); c.R(40, 3, 5, 5, K('orange', 2)); c.HL(40, 3, 5, K('orange', 4))
    for x in (3, 19, 33): c.R(x, 11, 13, 3, K('hull', -2)); c.HL(x, 11, 13, K('hull', 2)); c.R(x + 5, 12, 3, 1, K('white', 5))
    c.R(2, 14, 3, 1, K('hull', -2)); c.R(43, 14, 3, 1, K('hull', -2)); c.outline()


@piece('galley-fridge', '식당 냉장고(윗면 + 두 문 + 손잡이)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['냉장고', '식당'], desc='식당 냉장고.')
def _fridge(c):
    box(c, 1, 2, 14, 8, 20, 'white', tt=3, ft=-1)
    c.R(3, 12, 10, 7, K('white', 1)); c.HL(3, 12, 10, K('white', 5)); c.R(3, 20, 10, 8, K('white', 0)); c.HL(3, 20, 10, K('white', 4)); c.HL(3, 19, 10, K('hull', -2))
    c.VL(11, 14, 3, K('hull', 3)); c.VL(11, 22, 4, K('hull', 3)); c.R(4, 13, 3, 2, K('cyan', 3)); c.P(5, 13, K('glow', 1)); led(c, 6, 29, 'cyan'); c.outline()


@piece('vending-int', '실내 자판기(윗면 + 음식 진열창 + 투입구)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['자판기', '식당'], desc='휴게실 자판기.')
def _vendint(c):
    box(c, 1, 2, 14, 8, 20, 'orange', tt=3, ft=-1, tex='plate')
    c.R(3, 12, 8, 14, K('glass', -1)); c.HL(3, 12, 8, K('cyan', 4))
    for j in range(3):
        c.HL(3, 16 + j * 4, 8, K('hull', 0))
        for i in range(2): c.R(4 + i * 4, 13 + j * 4, 3, 2, K(('green', 'white', 'cyan', 'magenta', 'orange', 'white')[(i + j * 2) % 6], 3 if i % 2 == 0 else 2))
    c.R(12, 13, 2, 8, K('cable', 0)); c.P(12, 14, K('green', 3)); c.P(12, 17, K('orange', 3)); c.R(5, 28, 6, 1, K('cable', -2)); c.R(3, 27, 8, 2, K('orange', -2)); c.outline()


@piece('shower-pod', '샤워 포드(윗면 + 반투명 유리문 + 배수 패널)', 1, 2, 'tall_furniture', group='interior', solid=[(0, 1), (0, 0)], tags=['샤워', '위생'], desc='위생실 샤워 칸.')
def _shower(c):
    box(c, 1, 2, 14, 8, 20, 'white', tt=3, ft=-1)
    c.R(3, 12, 10, 14, K('glass', 1)); c.HL(3, 12, 10, K('cyan', 5)); c.VL(3, 13, 13, K('cyan', 3)); c.VL(12, 13, 13, K('glass', -1))
    c.R(5, 14, 6, 3, K('hull', 3)); c.ell(8, 15, 2, 1, K('cyan', 5)); [c.P(5 + i * 2, 19 + (i % 2) * 2, K('cyan', 5)) for i in range(4)]
    c.R(11, 18, 2, 3, K('hull', -1)); c.P(11, 19, K('orange', 3))
    c.R(3, 27, 10, 2, K('hull', -2)); c.HL(3, 27, 10, K('hull', 2)); led(c, 5, 28, 'cyan'); led(c, 11, 28, 'green'); c.outline()


@piece('sink-unit', '세면대 유닛(흰 상판 + 푹 들어간 세면볼 + 수전 + 아래 수납)', 1, 1, 'low_furniture', group='interior', solid=[(0, 0)], tags=['세면대', '위생'], desc='숙소 세면대.')
def _sinku(c):
    box(c, 1, 2, 14, 8, 4, 'white', tt=3, ft=-2)
    c.R(3, 3, 10, 5, K('hull', -1)); c.R(4, 4, 8, 3, K('cyan', 1)); c.HL(4, 4, 8, K('cyan', -1)); c.HL(4, 6, 8, K('cyan', 3)); c.P(8, 5, K('cyan', 5))
    c.R(7, 1, 3, 3, K('hull', 4)); c.HL(7, 1, 3, K('hull', 5)); c.R(3, 11, 10, 3, K('hull', -2)); c.HL(3, 11, 10, K('hull', 2)); c.R(7, 12, 2, 1, K('white', 5)); c.outline()


@piece('pipe-cluster', '배관 다발(굵은 구리관 셋 + 흰 밸브 + 받침 상자)', 1, 2, 'column', group='interior', solid=[(0, 1), (0, 0)], tags=['배관', '기관실'], desc='기관실 굵은 배관 묶음.')
def _pipes(c):
    cube(c, 1, 18, 14, 7, 7, 'hull', tt=3, ft=-1, ol=False, tex='plate')
    for cx, yt, rx, col, tt in ((5, 5, 4, 'rust', 3), (11, 9, 3, 'hull', 4)):
        cyl(c, cx, yt, rx, 2, 12 if cx == 5 else 10, col, tt=tt, ft=0, ol=False)
        c.ell(cx, yt, rx - 1, 1, K('cable', -1))
        for x in range(cx - rx, cx + rx + 1):
            u = (x - cx) / (rx + .5)
            if abs(u) <= 1: c.P(x, yt + 7 + int(round(2 * (1 - u * u) ** .5)), K('white', 3 if x < cx else 1))
    c.R(2, 25, 12, 2, K('hull', -2)); c.HL(2, 25, 12, K('hull', 2)); led(c, 4, 26, 'orange'); led(c, 7, 26, 'green'); c.outline()


@piece('power-conduit', '전력 도관 상자(윗면 + 굵은 케이블 + 번개 램프)', 2, 1, 'low_furniture', group='interior', solid=[(0, 0), (1, 0)], tags=['전력', '기관실'], desc='기관실 바닥 전력 케이블 박스.')
def _conduit(c):
    box(c, 1, 3, 30, 7, 5, 'cable', tt=4, ft=0, topmat='hull', tex='panel')
    c.R(3, 5, 26, 2, K('yellow', 2)); c.HL(3, 5, 26, K('yellow', 5)); [c.P(5 + i * 5, 6, K('cable', -1)) for i in range(5)]
    c.R(12, 10, 8, 4, K('cable', -2)); c.R(13, 11, 6, 2, K('cyan', 2)); led(c, 4, 12, 'orange'); led(c, 27, 12, 'green')
    c.R(1, 13, 3, 2, K('cable', 2)); c.R(28, 13, 3, 2, K('cable', 2)); c.outline()


@piece('cargo-pallet', '화물 팔레트 적재(받침 판 + 상자 둘 + 그물 띠)', 2, 1, 'box', group='interior', solid=[(0, 0), (1, 0)], tags=['화물'], desc='화물칸 팔레트 위 상자 적재.')
def _pallet(c):
    box(c, 1, 9, 30, 5, 3, 'hull', tt=2, ft=-2, lip=False)
    box(c, 3, 1, 12, 6, 6, 'orange', tt=3, ft=-1, tex='plate'); c.VL(9, 7, 6, K('orange', -3)); hazard(c, 4, 11, 4, 1)
    box(c, 17, 3, 12, 6, 6, 'hull', tt=3, ft=-1, topmat='white'); c.HL(17, 11, 12, K('cyan', 2)); c.VL(23, 9, 5, K('hull', -3)); c.R(20, 4, 6, 3, K('cyan', 2))
    c.R(2, 14, 28, 1, K('shadow', 0)); c.R(3, 14, 3, 1, K('hull', 0)); c.R(26, 14, 3, 1, K('hull', 0)); c.outline()


@piece('cargo-container-int', '화물 컨테이너(큰 주름 상자 + 윗면 이음 + 문 손잡이)', 2, 2, 'box', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['컨테이너', '화물'], desc='화물칸 컨테이너. 쌓지 않는다.')
def _container(c):
    box(c, 1, 2, 30, 12, 17, 'hull', tt=3, ft=-1, tex='panel')
    c.R(2, 3, 28, 1, K('orange', 2)); c.HL(2, 3, 28, K('orange', 3))
    for i in range(3, 29, 4): c.VL(i, 14, 15, K('hull', -2)); c.VL(i + 1, 14, 15, K('hull', 1))
    c.R(1, 15, 30, 3, K('orange', 1)); c.HL(1, 15, 30, K('orange', 4)); hazard(c, 2, 16, 28, 2)
    c.VL(15, 18, 11, K('hull', -3)); c.VL(16, 18, 11, K('hull', -3)); c.R(12, 22, 2, 5, K('white', 4)); c.R(18, 22, 2, 5, K('white', 4)); c.R(5, 27, 5, 2, K('white', 3)); c.R(22, 27, 5, 2, K('white', 3))
    c.outline()


@piece('cargo-lift-pad', '화물 리프트 발판(바닥 원판 + 노랑 테두리 + 중앙 시안 표식)', 3, 2, 'flat', group='interior', solid=[], tags=['리프트', '화물'], desc='화물칸 바닥 리프트 판. 위로 걷는다.')
def _liftpad(c):
    c.R(1, 1, 46, 30, K('hull', -2)); c.R(2, 2, 44, 28, K('hull', 0)); c.R(4, 4, 40, 24, K('deck', 2)); c.R(5, 5, 38, 22, K('deck', 0))
    hazard(c, 1, 1, 46, 2, 'yellow', 'cable'); hazard(c, 1, 29, 46, 2, 'yellow', 'cable')
    for j in range(3, 29, 2): c.HL(6, j, 36, K('deck', 1) if j % 4 == 3 else K('deck', -1))
    c.R(18, 11, 12, 10, K('cable', 0)); c.R(19, 12, 10, 8, K('cyan', 0)); c.R(21, 14, 6, 4, K('cyan', 3)); c.HL(19, 12, 10, K('cyan', 2)); c.VL(23, 13, 6, K('cyan', 5)); c.VL(24, 13, 6, K('cyan', 5))
    for x, y in ((6, 6), (40, 6), (6, 24), (40, 24)): c.R(x, y, 2, 2, K('white', 3))
    c.outline()


# =================================================================== 4) 구조 · 바닥 · 벽 부착물
@piece('elevator-door', '승강기 문(사다리꼴 윗면 문틀 + 두 장 미닫이 + 층 표시 램프)', 2, 2, 'structure', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['승강기', '문'], desc='복도 승강기 문. 벽에 붙여 놓는다.')
def _elev(c):
    tcube(c, 1, 2, 30, 10, 18, 'white', ins=4, tt=3, ft=-2, ol=False, seams=True)
    c.R(12, 4, 8, 4, K('cable', 0)); c.R(13, 5, 6, 2, K('cyan', 3)); c.P(15, 5, K('glow', 1))
    c.R(5, 14, 22, 15, K('hull', -2)); c.R(6, 15, 10, 14, K('hull', 2)); c.R(17, 15, 9, 14, K('hull', 1)); c.VL(16, 14, 15, K('cable', -1))
    for j in range(17, 28, 3): c.HL(7, j, 8, K('hull', 3)); c.HL(18, j, 7, K('hull', 2))
    c.VL(6, 15, 14, K('white', 4)); c.R(28, 18, 2, 5, K('cable', 0)); c.P(29, 19, K('green', 3)); c.P(29, 21, K('orange', 3))
    hazard(c, 5, 30, 22, 1, 'yellow', 'cable'); c.outline()


@piece('airlock-inner', '내부 에어록 격벽문(사다리꼴 윗면 틀 + 큰 원형 해치 + 위험 띠)', 2, 2, 'structure', group='interior', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['에어록', '문'], desc='구역 사이 격벽 에어록.')
def _airin(c):
    tcube(c, 0, 2, 32, 11, 18, 'hull', ins=5, tt=3, ft=-2, ol=False, seams=True)
    hazard(c, 1, 13, 30, 2); c.R(10, 4, 12, 5, K('cable', 0)); c.R(11, 5, 4, 3, K('orange', 3)); c.R(17, 5, 4, 3, K('green', 2))
    c.ell(16, 22, 8, 6, K('hull', -2)); c.ell(16, 22, 7, 5, K('hull', 2)); c.ell(16, 22, 5, 4, K('white', 0)); c.ell(16, 22, 2, 2, K('hull', 0)); c.R(13, 21, 6, 2, K('orange', 3)); c.VL(16, 18, 9, K('cable', 0))
    for dx, dy in ((-6, 0), (6, 0), (0, -5), (0, 5)): c.P(16 + dx, 22 + dy, K('white', 5))
    c.R(3, 30, 26, 1, K('hull', -3)); c.outline()


@piece('hatch-floor', '바닥 해치(정사각 판 + 가운데 손잡이 + 경고 모서리)', 1, 1, 'flat', group='interior', solid=[], tags=['해치', '바닥'], desc='갑판 바닥 점검 해치. 위로 걷는다.')
def _hatch(c):
    c.R(1, 1, 14, 14, K('hull', -2)); c.R(2, 2, 12, 12, K('hull', 1)); c.R(3, 3, 10, 10, K('deck', 3)); c.HL(2, 2, 12, K('hull', 4)); c.VL(2, 3, 11, K('hull', 3))
    c.R(6, 7, 4, 2, K('cable', 0)); c.HL(6, 7, 4, K('hull', 4)); [c.P(x, y, K('white', 4)) for x, y in ((3, 3), (12, 3), (3, 12), (12, 12))]
    c.HL(4, 4, 8, K('yellow', 2)); c.HL(4, 11, 8, K('yellow', 1)); c.outline()


@piece('rug-hex', '육각 바닥 깔개(육각형 + 시안 테 + 가운데 무늬)', 2, 2, 'flat', group='interior', solid=[], tags=['깔개', '바닥'], desc='숙소·휴게실 바닥 장식 깔개. 위로 걷는다.')
def _rug(c):
    pts = [(8, 1), (23, 1), (30, 16), (23, 30), (8, 30), (1, 16)]
    for y in range(32):
        for x in range(32):
            # 육각형 내부 판정: 가운데 (15.5,15.5), 반지름 15
            dx, dy = abs(x - 15.5), abs(y - 15.5)
            if dy <= 15 and dx <= 15 - dy * 0.5 * (1 if dx > 7.5 else 0) * 0 and (dx + dy * 0.5) <= 15.5: c.P(x, y, K('navy', 0))
    for y in range(32):
        for x in range(32):
            dx, dy = abs(x - 15.5), abs(y - 15.5)
            if dy <= 12 and (dx + dy * 0.5) <= 12.5: c.P(x, y, K('violet', 0 if (x + y) % 6 else 1))
            if dy <= 9 and (dx + dy * 0.5) <= 9.5: c.P(x, y, K('navy', 1))
            if dy <= 5 and (dx + dy * 0.5) <= 5.5: c.P(x, y, K('cyan', 1 if (x + y) % 4 else 2))
    c.P(15, 15, K('cyan', 5)); c.P(16, 16, K('cyan', 5)); c.outline()


def _wall_frame(c, w=16, h=16):
    c.R(1, 1, w - 2, h - 2, K('hull', -1)); c.HL(1, 1, w - 2, K('hull', 4)); c.VL(1, 2, h - 3, K('hull', 3)); c.HL(1, h - 2, w - 2, K('hull', -3)); c.VL(w - 2, 2, h - 3, K('hull', -2))


@piece('wall-screen-a', '벽 부착 화면(시안 그래프 막대)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '화면'], desc='벽에 걸린 시안 계기 화면.')
def _wsa(c):
    _wall_frame(c); screen(c, 3, 3, 10, 9, 'cyan', 21, 'graph'); c.P(11, 4, K('orange', 3)); c.outline()

@piece('wall-screen-b', '벽 부착 화면(초록 줄 데이터)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '화면'], desc='벽에 걸린 초록 터미널 화면.')
def _wsb(c):
    _wall_frame(c); screen(c, 3, 3, 10, 9, 'green', 22, 'lines'); c.P(4, 11, K('green', 5)); c.outline()

@piece('wall-screen-c', '벽 부착 경고 화면(주황 경고판 + 레이더)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '경고'], desc='벽에 걸린 주황 경고 화면.')
def _wsc(c):
    _wall_frame(c); c.R(3, 3, 10, 9, K('cable', -1)); c.R(4, 4, 8, 3, K('orange', 1)); c.HL(4, 4, 8, K('orange', 4)); c.ell(8, 9, 2, 1, K('cyan', 0)); c.P(8, 9, K('cyan', 4)); c.P(10, 8, K('orange', 5)); c.outline()


@piece('wall-map-display', '벽 부착 항로 지도 화면(큰 화면 + 점·선 항로)', 2, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '지도'], desc='함교 벽 항로 지도.')
def _wmap(c):
    _wall_frame(c, 32, 16); c.R(3, 3, 26, 9, K('cable', -1)); c.HL(3, 3, 26, K('cable', 2))
    for i in range(4, 28, 4):
        for j in (5, 8, 11): c.P(3 + i - 2, j - 1, K('cyan', 0))
    c.line(5, 10, 12, 6, K('cyan', 3)); c.line(12, 6, 19, 9, K('cyan', 3)); c.line(19, 9, 26, 5, K('orange', 3))
    for x, y in ((5, 10), (12, 6), (19, 9)): c.R(x - 1, y - 1, 2, 2, K('cyan', 5))
    c.R(25, 4, 3, 3, K('orange', 4)); c.outline()


def _porthole(c, bg):
    c.ell(8, 8, 7, 7, K('hull', -2)); c.ell(8, 8, 6, 6, K('hull', 3)); c.ell(8, 8, 5, 5, K('star', 0)); bg(c)
    for x, y in ((8, 2), (8, 14), (2, 8), (14, 8)): c.P(x, y, K('white', 4))
    c.P(5, 5, K('glow', 1)); c.outline()


@piece('porthole-star', '벽 현창(둥근 금속 테 + 별이 보이는 우주)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '현창'], desc='벽에 낸 둥근 창, 별.')
def _ps(c):
    def bg(c):
        for x, y in ((6, 6), (10, 5), (7, 10), (11, 9), (9, 8), (5, 9)): c.P(x, y, K('star', 6 if (x + y) % 2 else 4))
        c.P(8, 4, K('star', 3))
    _porthole(c, bg)

@piece('porthole-planet', '벽 현창(둥근 금속 테 + 푸른 행성의 둥근 가장자리)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '현창'], desc='벽에 낸 둥근 창, 행성.')
def _pp(c):
    def bg(c):
        c.ell(8, 12, 5, 4, K('glass', 1), only=lambda x, y: 4 <= x <= 12 and y <= 12 and ((x - 8) ** 2 + (y - 8) ** 2) <= 25)
        c.ell(8, 12, 4, 3, K('cyan', 0), only=lambda x, y: ((x - 8) ** 2 + (y - 8) ** 2) <= 25)
        for x in range(4, 13): c.P(x, 9 + (0 if 6 <= x <= 10 else 1), K('cyan', 4))
        c.P(5, 6, K('star', 6)); c.P(11, 5, K('star', 5))
    _porthole(c, bg)


@piece('wall-lamp', '벽 램프(금속 받침 판 + 길쭉한 발광 등)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '조명'], desc='복도 벽 램프.')
def _wl(c):
    c.R(2, 4, 12, 8, K('hull', -1)); c.HL(2, 4, 12, K('hull', 4)); c.VL(2, 5, 7, K('hull', 2))
    c.R(4, 6, 8, 4, K('cyan', 2)); c.HL(4, 6, 8, K('glow', 1)); c.R(5, 7, 6, 2, K('glow', 0)); c.HL(4, 9, 8, K('cyan', 1)); c.outline()


@piece('vent-grill', '벽 환기 격자(네모 틀 + 가로 살)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '환기'], desc='벽 환기구.')
def _vg(c):
    _wall_frame(c); c.R(3, 3, 10, 10, K('cable', -1))
    for j in range(4, 12, 2): c.HL(3, j, 10, K('hull', 3)); c.HL(3, j + 1, 10, K('hull', -2))
    c.P(2, 2, K('white', 4)); c.P(13, 2, K('white', 4)); c.P(2, 13, K('white', 3)); c.P(13, 13, K('white', 3)); c.outline()


@piece('wall-pipes', '벽 배관 두 줄(구리 파이프 + 이음 고리)', 2, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '배관'], desc='벽을 따라 가는 배관.')
def _wp(c):
    c.R(0, 3, 32, 4, K('rust', 0)); c.HL(0, 3, 32, K('rust', 4)); c.HL(0, 6, 32, K('rust', -3))
    c.R(0, 9, 32, 4, K('hull', 0)); c.HL(0, 9, 32, K('hull', 4)); c.HL(0, 12, 32, K('hull', -3))
    for x in (5, 16, 26): c.R(x, 2, 3, 12, K('white', 1)); c.VL(x, 2, 12, K('white', 5)); c.VL(x + 2, 2, 12, K('white', -2))
    c.outline()


@piece('fire-extinguisher', '벽 소화기 상자(붉은 통 + 흰 케이스)', 1, 1, 'wall_mounted', group='interior', solid=[], tags=['벽', '안전'], desc='복도 벽 소화기함.')
def _fe(c):
    c.R(3, 1, 10, 14, K('white', 2)); c.HL(3, 1, 10, K('white', 5)); c.VL(3, 2, 13, K('white', 4)); c.VL(12, 2, 13, K('white', -1)); c.HL(3, 14, 10, K('white', -2))
    c.R(6, 4, 4, 9, K('orange', 1)); c.VL(6, 5, 7, K('orange', 3)); c.R(6, 3, 4, 1, K('hull', 1)); c.R(5, 2, 2, 1, K('hull', 4)); c.P(10, 6, K('cable', 0)); c.R(6, 8, 4, 1, K('white', 5)); c.outline()

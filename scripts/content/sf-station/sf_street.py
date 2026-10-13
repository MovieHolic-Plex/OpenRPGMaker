"""sf_station 줄 B(사이버 네온 거리) 조각 — 건물·간판·탈것·소품. group='street'."""
from sf_core import *

NEON = ('magenta', 'cyan', 'violet', 'orange')


# ------------------------------------------------------------------ 공용 부품
def roof_box(c, x, y, w, top=3, front=3, mat='hull', tt=3):
    cube(c, x, y, w, top, front, mat, tt=tt, ft=-1, ol=True, sides=True)


def roof_tank(c, cx, y, r=4):
    cyl(c, cx, y, r, 2, 4, 'rust', tt=3, ft=0, ol=True)


def roof_fan(c, x, y, w=8):
    cube(c, x, y, w, 3, 3, 'cable', tt=4, ft=1, ol=True)
    c.HL(x + 2, y + 1, w - 4, K('cyan', 2))


def roof_neon_slab(c, x, y, w, col='magenta'):
    cube(c, x, y, w, 4, 3, 'navy', tt=3, ft=0, ol=True, topmat=col)


def windows(c, x, y, w, h, rows, cols, seed=0, pal=('cyan', 'orange', 'magenta', 'violet'), dark=0.28, ww=None, wh=None):
    """x,y,w,h 영역에 rows×cols 창(켜진 직사각형 + 어두운 틀). 글자 없음."""
    cw = w // cols; rh = h // rows
    ww = ww or cw - 2; wh = wh or rh - 2
    for r in range(rows):
        for q in range(cols):
            wx = x + q * cw + (cw - ww) // 2; wy = y + r * rh + (rh - wh) // 2
            v = hsh(q, r, seed)
            c.R(wx - 1, wy - 1, ww + 2, wh + 2, K('navy', -3))
            if (v % 100) / 100 < dark:
                c.R(wx, wy, ww, wh, K('glass', -1)); c.HL(wx, wy, ww, K('glass', 1))
            else:
                col = pal[(v >> 4) % len(pal)]
                c.R(wx, wy, ww, wh, K(col, 1)); c.HL(wx, wy, ww, K(col, 3))
                if wh >= 4: c.HL(wx, wy + wh - 1, ww, K(col, 0))


def neon_band(c, x, y, w, col='magenta', h=2):
    c.R(x, y, w, h, K(col, 2)); c.HL(x, y, w, K(col, 3)); c.HL(x, y + h, w, K(col, -2))


def vneon(c, x, y, h, col='cyan'):
    c.VL(x, y, h, K(col, 3)); c.VL(x + 1, y, h, K(col, 1))


def awning(c, x, y, w, col='orange', depth=3):
    """문 위 차양: 윗면 띠(밝음) + 앞 줄무늬."""
    c.R(x, y, w, depth, K(col, 3)); c.HL(x, y, w, K(col, 4 if False else 3))
    for i in range(0, w, 4): c.R(x + i, y + depth, 2, 2, K(col, 1)); c.R(x + i + 2, y + depth, 2, 2, K(col, 2))
    c.HL(x, y + depth + 2, w, K('shadow', 1))


def door(c, x, y, w, h, col='cyan'):
    c.R(x - 1, y - 1, w + 2, h + 1, K('navy', -3)); c.R(x, y, w, h, K('glass', 0)); c.R(x + 1, y + 1, w - 2, h - 1, K(col, 0))
    c.HL(x + 1, y + 1, w - 2, K(col, 2)); c.VL(x + w // 2, y + 1, h - 1, K('navy', -2))


def base_strip(c, x, y, w):
    c.HL(x, y, w, K('conc', 2)); c.HL(x, y + 1, w, K('conc', -2))


def building(c, w, h, top, ins, wall, rows, cols, seed, accent='magenta', accent2='cyan', topmat='conc', wintop=None, dark=0.3,
             door_w=8, door_col='cyan', neon_top=True, base=3, ft=-2, pal=('cyan', 'orange', 'magenta', 'violet'), ww=None, wh=None):
    """w,h 는 픽셀. 윗면 사다리꼴(top 행) + 앞면. 앞면 위에 창 격자·옆 네온 띠·문."""
    x0 = 1; ww_ = w - 2
    front = h - 2 - top
    tcube(c, x0, 1, ww_, top, front, wall, ins=ins, tt=3, ft=ft, topmat=topmat, ol=False, s=seed)
    fy = 1 + top
    # 옆 네온 띠
    vneon(c, x0 + 2, fy + 4, front - 12, accent); vneon(c, x0 + ww_ - 4, fy + 4, front - 12, accent2)
    if neon_top: neon_band(c, x0 + 1, fy + 1, ww_ - 2, accent, 1)
    wy = fy + 5; wh_tot = front - base - 17 - 3
    windows(c, x0 + 6, wy, ww_ - 12, max(wh_tot, 8), rows, cols, seed, pal, dark, ww, wh)
    # 아래: 문 + 차양
    dx = x0 + ww_ // 2 - door_w // 2
    base_strip(c, x0, fy + front - base, ww_)
    door(c, dx, fy + front - base - 11, door_w, 11, door_col)
    return fy, front


# ------------------------------------------------------------------ 건물
@piece('street-tower-s', '소형 네온 타워(사다리꼴 옥상 + 창 격자 + 네온 띠)', 4, 6, 'structure', group='street',
       solid=[(x, y) for x in range(4) for y in (4, 5)], tags=['건물', '타워', '네온'], desc='거리 소형 고층. 마젠타/시안 띠.', line='B')
def _ts(c):
    fy, fr = building(c, 64, 96, 14, 6, 'navy', 5, 3, 1, 'magenta', 'cyan')
    roof_box(c, 10, 5, 14); roof_fan(c, 38, 6, 10); roof_neon_slab(c, 26, 3, 10, 'cyan')
    c.outline()


@piece('street-tower-m', '중형 네온 타워(사다리꼴 옥상 + 안테나 상자 + 창 격자)', 5, 8, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (6, 7)], tags=['건물', '타워', '네온'], desc='거리 중형 고층. 시안 띠.', line='B')
def _tm(c):
    fy, fr = building(c, 80, 128, 16, 7, 'violet', 7, 4, 2, 'cyan', 'magenta', topmat='conc')
    roof_box(c, 12, 5, 16); roof_tank(c, 54, 6, 5); roof_neon_slab(c, 32, 4, 14, 'magenta'); roof_fan(c, 60, 8, 10)
    c.outline()


@piece('street-tower-l', '대형 네온 타워(넓은 옥상 장비 + 층층 창 격자)', 6, 10, 'structure', group='street',
       solid=[(x, y) for x in range(6) for y in (8, 9)], tags=['건물', '타워', '네온'], desc='거리 대형 고층. 마젠타·주황.', line='B')
def _tl(c):
    fy, fr = building(c, 96, 160, 18, 8, 'navy', 9, 5, 3, 'magenta', 'orange', topmat='conc')
    roof_box(c, 14, 6, 18); roof_tank(c, 46, 7, 6); roof_neon_slab(c, 56, 5, 18, 'cyan'); roof_fan(c, 78, 9, 10)
    c.outline()


@piece('street-apartment', '네온 아파트 블록(사다리꼴 옥상 + 발코니 창 격자)', 5, 6, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (4, 5)], tags=['건물', '아파트'], desc='주거 블록. 주황 불빛 창.', line='B')
def _ap(c):
    fy, fr = building(c, 80, 96, 14, 6, 'conc', 4, 5, 4, 'orange', 'violet', topmat='conc', pal=('orange', 'orange', 'cyan', 'magenta'), dark=0.2, ft=-1)
    for k in range(4): c.HL(8, fy + 16 + k * 14, 64, K('conc', 3))
    roof_box(c, 8, 5, 14); roof_tank(c, 40, 6, 5); roof_fan(c, 54, 6, 10)
    c.outline()


@piece('street-noodle-shop', '국수 가게(사다리꼴 옥상 + 주황 차양 + 따뜻한 창)', 4, 4, 'structure', group='street',
       solid=[(x, y) for x in range(4) for y in (2, 3)], tags=['건물', '가게', '음식'], desc='네온 국수 가게. 주황 차양.', line='B')
def _nd(c):
    tcube(c, 1, 1, 62, 12, 50, 'rust', ins=5, tt=3, ft=-2, topmat='conc', ol=False)
    fy = 13
    neon_band(c, 2, fy + 1, 60, 'orange', 2)
    c.R(6, fy + 8, 20, 14, K('navy', -3)); c.R(7, fy + 9, 18, 12, K('orange', 1)); c.HL(7, fy + 9, 18, K('orange', 3))
    for i in range(3): c.R(9 + i * 5, fy + 13, 3, 6, K('cable', 0))
    c.R(34, fy + 8, 24, 14, K('navy', -3)); c.R(35, fy + 9, 22, 12, K('cyan', 1)); c.HL(35, fy + 9, 22, K('cyan', 3))
    awning(c, 4, fy + 22, 56, 'magenta', 3)
    door(c, 28, fy + 30, 8, 12, 'orange'); base_strip(c, 1, fy + 47, 62)
    roof_tank(c, 14, 4, 4); roof_fan(c, 38, 4, 10); roof_neon_slab(c, 48, 3, 9, 'orange')
    c.outline()


@piece('street-arcade', '게임 아케이드(사다리꼴 옥상 + 큰 네온 간판 띠 + 화면 벽)', 5, 4, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '아케이드', '네온'], desc='오락실. 큰 시안/마젠타 띠.', line='B')
def _ar(c):
    tcube(c, 1, 1, 78, 13, 49, 'violet', ins=6, tt=3, ft=-2, topmat='conc', ol=False)
    fy = 14
    c.R(4, fy + 2, 72, 10, K('navy', -3))
    for i in range(0, 72, 6): c.R(5 + i, fy + 3, 5, 8, K(NEON[(i // 6) % 3], 2)); c.HL(5 + i, fy + 3, 5, K(NEON[(i // 6) % 3], 3))
    windows(c, 8, fy + 16, 28, 16, 1, 3, 5, ('cyan', 'magenta', 'violet'), 0.1, ww=6, wh=12)
    windows(c, 44, fy + 16, 28, 16, 1, 3, 6, ('cyan', 'magenta', 'violet'), 0.1, ww=6, wh=12)
    door(c, 35, fy + 24, 10, 11, 'magenta'); base_strip(c, 1, fy + 46, 78)
    roof_neon_slab(c, 30, 3, 20, 'cyan'); roof_fan(c, 10, 5, 10); roof_box(c, 58, 5, 12)
    c.outline()


@piece('street-club', '나이트클럽(사다리꼴 옥상 + 보라 벽 + 마젠타 간판 상자)', 5, 4, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '클럽', '네온'], desc='밤 클럽. 보라 벽, 마젠타 간판.', line='B')
def _cl(c):
    tcube(c, 1, 1, 78, 13, 49, 'navy', ins=6, tt=3, ft=-2, topmat='violet', ol=False)
    fy = 14
    c.R(14, fy + 2, 52, 12, K('navy', -3)); c.R(15, fy + 3, 50, 10, K('magenta', 1)); c.HL(15, fy + 3, 50, K('magenta', 3)); c.HL(15, fy + 12, 50, K('magenta', 0))
    for i in range(18, 62, 6): c.R(i, fy + 6, 3, 4, K('glow', 0)) if (i // 6) % 2 else c.R(i, fy + 6, 3, 4, K('violet', 3))
    vneon(c, 4, fy + 4, 36, 'cyan'); vneon(c, 74, fy + 4, 36, 'cyan')
    c.R(10, fy + 18, 12, 12, K('violet', -1)); c.HL(10, fy + 18, 12, K('violet', 2)); c.R(58, fy + 18, 12, 12, K('violet', -1)); c.HL(58, fy + 18, 12, K('violet', 2))
    c.R(13, fy + 21, 6, 6, K('cyan', 2)); c.R(61, fy + 21, 6, 6, K('orange', 2))
    door(c, 34, fy + 24, 12, 11, 'magenta'); c.R(30, fy + 20, 20, 2, K('orange', 3)); base_strip(c, 1, fy + 46, 78)
    cube(c, 28, 3, 24, 5, 3, 'navy', tt=3, ft=0, topmat='cyan'); roof_fan(c, 8, 5, 10); roof_fan(c, 62, 5, 10)
    c.outline()


@piece('street-clinic', '네온 진료소(사다리꼴 옥상 + 흰 벽 + 시안 십자 표시)', 4, 4, 'structure', group='street',
       solid=[(x, y) for x in range(4) for y in (2, 3)], tags=['건물', '병원'], desc='거리 진료소. 시안 십자 램프.', line='B')
def _cn(c):
    tcube(c, 1, 1, 62, 12, 50, 'white', ins=5, tt=2, ft=-3, topmat='white', ol=False)
    fy = 13
    neon_band(c, 2, fy + 1, 60, 'cyan', 1)
    c.R(26, fy + 5, 12, 12, K('navy', -3)); c.R(29, fy + 6, 6, 10, K('cyan', 2)); c.R(27, fy + 9, 10, 4, K('cyan', 2)); c.HL(29, fy + 6, 6, K('cyan', 3)); c.HL(27, fy + 9, 10, K('cyan', 3))
    windows(c, 6, fy + 20, 20, 14, 1, 2, 7, ('cyan', 'cyan', 'green'), 0.1, ww=7, wh=10)
    windows(c, 38, fy + 20, 20, 14, 1, 2, 8, ('cyan', 'cyan', 'green'), 0.1, ww=7, wh=10)
    door(c, 28, fy + 30, 8, 12, 'cyan'); base_strip(c, 1, fy + 47, 62)
    roof_box(c, 8, 4, 12, mat='white'); roof_fan(c, 42, 4, 10); cube(c, 26, 3, 10, 4, 3, 'white', tt=3, ft=-1, topmat='cyan')
    c.outline()


@piece('street-capsule-hotel', '캡슐 호텔(사다리꼴 옥상 + 작은 캡슐 창 격자)', 5, 5, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (3, 4)], tags=['건물', '호텔'], desc='캡슐 호텔. 작은 창이 줄지은 벽.', line='B')
def _ch(c):
    fy, fr = building(c, 80, 80, 13, 6, 'hull', 5, 8, 9, 'cyan', 'violet', topmat='conc', pal=('cyan', 'violet', 'orange', 'cyan'), dark=0.25, ww=5, wh=5, ft=-2, door_w=10, door_col='violet')
    roof_box(c, 10, 5, 14); roof_neon_slab(c, 32, 3, 16, 'violet'); roof_fan(c, 56, 5, 10)
    c.outline()


@piece('street-data-center', '데이터 센터(사다리꼴 옥상 + 냉각기 + 램프 줄 벽)', 6, 5, 'structure', group='street',
       solid=[(x, y) for x in range(6) for y in (3, 4)], tags=['건물', '서버'], desc='데이터 센터. 녹색·시안 램프.', line='B')
def _dc(c):
    tcube(c, 1, 1, 94, 16, 62, 'cable', ins=7, tt=4, ft=0, topmat='conc', ol=False)
    fy = 17
    for r in range(3):
        for q in range(7):
            x = 8 + q * 12; y = fy + 6 + r * 13
            c.R(x, y, 9, 10, K('hull', -2)); c.HL(x, y, 9, K('hull', 1))
            for k in range(3): c.P(x + 1 + k * 3, y + 3, K(('green', 'cyan', 'orange')[(q + r + k) % 3], 3)); c.P(x + 1 + k * 3, y + 6, K(('cyan', 'green', 'magenta')[(q + r + k) % 3], 2))
    vneon(c, 3, fy + 4, 44, 'green'); vneon(c, 91, fy + 4, 44, 'cyan')
    door(c, 42, fy + 40, 12, 14, 'green'); base_strip(c, 1, fy + 59, 94)
    for x in (10, 40, 66): cube(c, x, 5, 16, 6, 5, 'hull', tt=3, ft=-1, tex='grate'); c.HL(x + 2, 12, 12, K('cyan', 2))
    c.outline()


@piece('street-drone-garage', '드론 차고(사다리꼴 옥상 + 이륙 패드 + 셔터 문)', 5, 4, 'structure', group='street',
       solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '드론', '차고'], desc='드론 차고. 옥상 이륙 패드.', line='B')
def _dg(c):
    tcube(c, 1, 1, 78, 15, 47, 'hull', ins=6, tt=3, ft=-2, topmat='conc', ol=False)
    fy = 16
    c.R(26, 4, 26, 9, K('conc', 1)); c.ell(39, 8, 9, 3, K('conc', 4)); c.ell(39, 8, 6, 2, K('yellow', 2)); c.ell(39, 8, 3, 1, K('conc', 3))
    c.R(10, fy + 8, 60, 28, K('navy', -3)); c.R(12, fy + 10, 56, 26, K('cable', 1))
    for j in range(5): c.HL(12, fy + 12 + j * 5, 56, K('cable', 3))
    hazard(c, 12, fy + 34, 56, 3); vneon(c, 4, fy + 6, 30, 'orange'); vneon(c, 74, fy + 6, 30, 'orange')
    neon_band(c, 20, fy + 2, 40, 'orange', 2); base_strip(c, 1, fy + 44, 78)
    c.outline()


@piece('street-transit-station', '환승 정거장(넓은 사다리꼴 지붕 + 승강장 벽 + 시안 띠)', 6, 4, 'structure', group='street',
       solid=[(x, y) for x in range(6) for y in (2, 3)], tags=['건물', '정거장', '교통'], desc='네온 환승 정거장. 넓은 캐노피.', line='B')
def _tsn(c):
    tcube(c, 1, 1, 94, 15, 47, 'navy', ins=8, tt=3, ft=-2, topmat='hull', ol=False)
    fy = 16
    c.R(8, 3, 80, 3, K('cyan', 2)); c.HL(8, 3, 80, K('cyan', 3))
    for i in range(10, 86, 14): c.R(i, 7, 6, 5, K('glass', 1)); c.HL(i, 7, 6, K('glass', 3))
    neon_band(c, 2, fy + 1, 92, 'cyan', 2)
    windows(c, 8, fy + 8, 38, 22, 2, 4, 10, ('cyan', 'cyan', 'violet'), 0.1, ww=7, wh=8)
    windows(c, 50, fy + 8, 38, 22, 2, 4, 11, ('cyan', 'cyan', 'violet'), 0.1, ww=7, wh=8)
    c.R(40, fy + 6, 16, 5, K('cable', 0)); c.R(41, fy + 7, 14, 3, K('green', 1)); c.HL(41, fy + 7, 14, K('green', 3))
    door(c, 40, fy + 22, 16, 14, 'cyan'); hazard(c, 2, fy + 40, 92, 2); base_strip(c, 1, fy + 44, 94)
    c.outline()


# ------------------------------------------------------------------ 노점·키오스크
def stall(c, col='magenta', col2='cyan', goods=0):
    cube(c, 2, 12, 28, 6, 12, 'conc', tt=3, ft=-1, ol=False, tex='plate')
    c.R(5, 19, 22, 7, K('cable', -1))
    for i in range(4): c.R(6 + i * 5, 20 + (i % 2), 4, 3, K(NEON[(i + goods) % 4], 2))
    # 차양(윗면 있는 지붕판)
    cube(c, 1, 2, 30, 7, 3, 'navy', tt=3, ft=0, ol=False, topmat=col)
    for i in range(2, 30, 4): c.R(i, 9, 2, 3, K(col2, 2))
    c.outline()


@piece('street-market-stall-a', '네온 노점(차양 지붕 + 진열대 상자)', 2, 2, 'box', group='street', solid=[(0, 1), (1, 1)], tags=['노점', '가게'], desc='거리 노점. 마젠타 차양.', line='B')
def _msa(c): stall(c, 'magenta', 'cyan', 0)


@piece('street-market-stall-b', '네온 노점(차양 지붕 + 진열대 상자)', 2, 2, 'box', group='street', solid=[(0, 1), (1, 1)], tags=['노점', '가게'], desc='거리 노점. 시안 차양.', line='B')
def _msb(c): stall(c, 'cyan', 'orange', 2)


@piece('street-kiosk', '정보 키오스크(넓은 윗면 + 윗면 위 간판판 + 화면 앞면)', 2, 2, 'box', group='street', solid=[(0, 1), (1, 1)], tags=['키오스크'], desc='거리 정보 부스.', line='B')
def _ki(c):
    tcube(c, 2, 5, 28, 10, 15, 'hull', ins=3, tt=3, ft=-1, topmat='conc', ol=False)
    c.R(8, 17, 16, 9, K('cable', -1)); c.HL(8, 17, 16, K('cyan', 3))
    for k in range(3): c.HL(10, 19 + k * 3, 10 - k * 2, K('cyan', 2)); c.R(20, 19 + k * 3, 2, 2, K(NEON[k], 3))
    cube(c, 9, 7, 14, 4, 2, 'navy', tt=3, ft=0, ol=False, topmat='magenta')
    plinth(c, 2, 28, 28, 2, 'conc'); c.outline()


# ------------------------------------------------------------------ 간판
def bars(c, x, y, w, h, cols, step=3, t=2):
    for k, j in enumerate(range(0, h, step)):
        col = cols[k % len(cols)]
        c.HL(x, y + j, w - (k * 3) % 5, K(col, t + 1)); c.HL(x, y + j + 1, w - (k * 3) % 5, K(col, t - 1)) if step > 2 else None


@piece('street-neon-billboard', '네온 광고판(사다리꼴 윗면 슬랩 + 램프 면 + 기단, 글자 없음)', 3, 2, 'box', group='street', solid=[(0, 1), (1, 1), (2, 1)], tags=['간판', '광고', '네온'], desc='큰 네온 광고판. 도형 띠만.', line='B')
def _bb(c):
    tcube(c, 1, 2, 46, 10, 17, 'navy', ins=4, tt=3, ft=-1, topmat='magenta', ol=False)
    c.R(4, 13, 40, 11, K('magenta', 1)); c.HL(4, 13, 40, K('magenta', 3)); c.HL(4, 23, 40, K('magenta', -1))
    c.ell(14, 18, 5, 3, K('cyan', 3)); c.ell(14, 18, 2, 1, K('glow', 0))
    bars(c, 22, 15, 20, 8, ('cyan', 'orange'), 3, 2)
    plinth(c, 6, 28, 36, 3, 'conc'); c.outline()


@piece('street-neon-arrow', '화살표 간판 상자(윗면 + 램프 앞면 화살표 도형)', 1, 1, 'box', group='street', solid=[(0, 0)], tags=['간판', '화살표'], desc='방향 간판. 시안 화살표 도형.', line='B')
def _na(c):
    cube(c, 1, 2, 14, 6, 8, 'navy', tt=3, ft=0, ol=False, topmat='conc')
    c.R(3, 9, 10, 6, K('cable', -1))
    c.HL(4, 12, 6, K('cyan', 3)); c.HL(4, 11, 6, K('cyan', 2)); c.P(10, 10, K('cyan', 3)); c.P(11, 11, K('cyan', 3)); c.P(11, 12, K('cyan', 3)); c.P(10, 13, K('cyan', 3))
    c.P(12, 12, K('cyan', 3)); c.outline()


@piece('street-holo-ad', '홀로 광고 슬랩(투사기 기단 + 두꺼운 시안 광고판 윗면 포함)', 2, 3, 'box', group='street', solid=[(0, 2), (1, 2)], tags=['간판', '홀로', '광고'], desc='시안 홀로 광고.', line='B')
def _ha(c):
    cube(c, 3, 36, 26, 7, 5, 'cable', tt=3, ft=0, ol=False, topmat='hull', tex='plate')
    tcube(c, 4, 3, 24, 7, 28, 'glass', ins=2, tt=3, ft=0, topmat='cyan', ol=False, seams=False)
    for j in range(0, 24, 3): c.HL(6, 12 + j, 20, K('cyan', 2 if j % 6 == 0 else 1))
    c.ell(16, 22, 4, 3, K('glow', 0)); c.ell(16, 22, 2, 1, K('cyan', 3))
    c.R(7, 35, 18, 2, K('cyan', 3)); c.outline()


@piece('street-sign-vertical', '세로 네온 간판(굵은 슬랩 + 윗면 + 세로 램프 띠)', 1, 2, 'box', group='street', solid=[(0, 1), (0, 0)], tags=['간판', '세로'], desc='세로 간판. 마젠타·시안 띠.', line='B')
def _sv(c):
    cube(c, 1, 2, 14, 7, 20, 'navy', tt=3, ft=0, ol=False, topmat='conc')
    for i, col in enumerate(('magenta', 'cyan', 'magenta')):
        c.R(3 + i * 4, 11, 3, 16, K(col, 2)); c.VL(3 + i * 4, 11, 16, K(col, 3))
    c.R(2, 28, 12, 3, K('conc', 0)); c.HL(2, 28, 12, K('conc', 2)); c.outline()


@piece('street-neon-bars-wall', '벽면 네온 막대 간판(벽에 붙은 가로 램프 띠 판)', 2, 1, 'wall_mounted', group='street', solid=[], tags=['간판', '벽'], desc='벽면 부착 간판.', line='B')
def _nbw(c):
    c.R(1, 2, 30, 12, K('navy', -2)); c.HL(1, 2, 30, K('navy', 1)); c.VL(1, 2, 12, K('navy', 0))
    for k, col in enumerate(('magenta', 'cyan', 'orange')):
        c.HL(4, 4 + k * 3, 24 - k * 3, K(col, 3)); c.HL(4, 5 + k * 3, 24 - k * 3, K(col, 1))
    c.outline()


@piece('street-neon-ring-wall', '벽면 네온 링 간판(벽에 붙은 둥근 램프)', 1, 1, 'wall_mounted', group='street', solid=[], tags=['간판', '벽'], desc='벽면 부착 원형 간판.', line='B')
def _nrw(c):
    c.ell(8, 8, 6, 6, K('navy', -2)); c.ell(8, 8, 5, 5, K('magenta', 3)); c.ell(8, 8, 3, 3, K('navy', -2)); c.P(8, 8, K('cyan', 3)); c.P(7, 7, K('cyan', 2)); c.outline()


@piece('street-neon-flat-strip', '바닥 네온 유도선(아스팔트 위 칠한 띠)', 2, 1, 'flat', group='street', solid=[], tags=['바닥', '네온'], desc='바닥 유도선. 걷는 면.', line='B')
def _nfs(c):
    c.R(0, 1, 32, 14, K('navy', -2))
    for i in range(0, 32, 8):
        for k in range(4): c.P(i + 5 - k, 4 + k, K('cyan', 3)); c.P(i + 5 - k, 11 - k, K('cyan', 3))
    c.HL(0, 7, 32, K('magenta', 2)); c.HL(0, 8, 32, K('magenta', 1)); c.HL(0, 1, 32, K('conc', -1)); c.HL(0, 14, 32, K('conc', -2))


# ------------------------------------------------------------------ 탈것
def pod(c, body, glass_top='cyan', trim='cyan'):
    tcube(c, 2, 4, 44, 14, 9, body, ins=6, tt=3, ft=-2, ol=False)
    c.R(14, 7, 20, 6, K('glass', 0)); c.HL(14, 7, 20, K(glass_top, 3)); c.R(23, 7, 2, 6, K('hull', -1))
    c.R(4, 21, 8, 1, K(trim, 3)); c.R(36, 21, 8, 1, K(trim, 3)); c.HL(6, 24, 36, K('shadow', 1))


@piece('street-pod-car-cyan', '시안 호버 포드(사다리꼴 캐노피 윗면 + 측면 패널)', 3, 2, 'structure', group='street', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '포드'], desc='시안 호버 포드.', line='B')
def _pcc(c): pod(c, 'cyan', 'glow', 'magenta'); c.outline()


@piece('street-pod-taxi', '호버 택시(주황 사다리꼴 캐노피 윗면 + 지붕 표지판 슬랩)', 3, 2, 'structure', group='street', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '택시'], desc='주황 호버 택시.', line='B')
def _ptx(c):
    pod(c, 'orange', 'cyan', 'yellow'); cube(c, 19, 5, 10, 3, 2, 'yellow', tt=3, ft=0, topmat='yellow'); hazard(c, 6, 19, 8, 2, 'yellow', 'cable'); hazard(c, 34, 19, 8, 2, 'yellow', 'cable'); c.outline()


@piece('street-pod-truck', '화물 호버 트럭(넓은 화물칸 윗면 + 앞쪽 낮은 캐빈 윗면)', 4, 2, 'structure', group='street', solid=[(x, 1) for x in range(4)], tags=['탈것', '트럭'], desc='화물 트럭.', line='B')
def _ptk(c):
    tcube(c, 1, 1, 52, 13, 11, 'hull', ins=5, tt=3, ft=-1, ol=False, topmat='white')
    roof_detail(c, 4, 3, 44, 10, 'white', seed=2, hatch=False, vents=True)
    hazard(c, 3, 16, 40, 2)
    tcube(c, 38, 11, 25, 8, 8, 'orange', ins=3, tt=3, ft=-2, ol=False, topmat='orange')
    c.R(42, 20, 17, 4, K('glass', 1)); c.HL(42, 20, 17, K('cyan', 3)); c.R(50, 20, 1, 4, K('hull', -1)); c.R(44, 14, 9, 3, K('glass', 0)); c.HL(44, 14, 9, K('cyan', 3))
    c.R(40, 26, 21, 1, K('magenta', 3)); c.HL(4, 28, 56, K('shadow', 1)); c.outline()


@piece('street-hover-bike', '호버 바이크(굵은 차체 윗면 + 시트 + 밑 네온 빛)', 2, 1, 'structure', group='street', solid=[(0, 0), (1, 0)], tags=['탈것', '바이크'], desc='1인 호버 바이크.', line='B')
def _hb(c):
    tcube(c, 2, 1, 28, 7, 6, 'violet', ins=3, tt=3, ft=-2, ol=False)
    c.R(9, 3, 10, 3, K('cable', 0)); c.HL(9, 3, 10, K('cable', 3)); c.R(25, 3, 3, 3, K('glow', 0))
    c.HL(4, 14, 24, K('magenta', 3)); c.HL(6, 15, 20, K('magenta', 1)); c.outline()


@piece('street-drone-pad', '드론 이륙 패드(낮은 단 윗면 + 노란 원 + 모서리 램프)', 2, 2, 'box', group='street', solid=[(0, 1), (1, 1)], tags=['드론', '패드'], desc='드론 착륙 패드.', line='B')
def _dp(c):
    cube(c, 1, 3, 30, 20, 6, 'conc', tt=3, ft=-1, ol=False, tex='plate')
    c.ell(16, 13, 11, 6, K('conc', 1)); c.ell(16, 13, 9, 4, K('conc', 4)); c.ell(16, 13, 6, 3, K('yellow', 2)); c.ell(16, 13, 3, 1, K('conc', 3))
    for x, y in ((3, 6), (28, 6), (3, 19), (28, 19)): c.P(x, y, K('orange', 3))
    c.HL(2, 28, 28, K('cyan', 3)); c.outline()


@piece('street-cargo-drone', '화물 드론(굵은 몸통 윗면 + 회전날개 원 넷 + 화물 상자)', 2, 1, 'structure', group='street', solid=[(0, 0), (1, 0)], tags=['드론', '화물'], desc='화물 드론.', line='B')
def _cd(c):
    for x in (4, 28): c.ell(x, 6, 3, 2, K('hull', 3)); c.ell(x, 6, 1, 1, K('cable', 0)); c.ell(x, 11, 3, 2, K('hull', 1)); c.ell(x, 11, 1, 1, K('cable', -1))
    tcube(c, 7, 1, 18, 9, 5, 'white', ins=3, tt=2, ft=-2, ol=False)
    cube(c, 12, 3, 8, 4, 2, 'orange', tt=3, ft=0, ol=False)
    c.HL(9, 13, 14, K('orange', 3)); c.P(16, 11, K('cyan', 3)); c.outline()


# ------------------------------------------------------------------ 소품
@piece('street-vending-cyan', '시안 자판기(깊은 윗면 + 앞 유리창 + 버튼)', 1, 2, 'tall_furniture', group='street', solid=[(0, 1), (0, 0)], tags=['자판기'], desc='시안 거리 자판기.', line='B')
def _vc(c):
    cube(c, 1, 2, 14, 9, 19, 'hull', tt=3, ft=-1, ol=False, tex='plate', topmat='white')
    c.R(3, 13, 8, 13, K('glass', -2)); c.HL(3, 13, 8, K('cyan', 3)); c.R(2, 12, 1, 15, K('cyan', 2))
    for j in range(3):
        for i in range(2): c.R(4 + i * 4, 15 + j * 4, 3, 3, K(('orange', 'magenta', 'cyan')[(i + j) % 3], 2))
    c.R(12, 15, 2, 6, K('cable', 0)); c.P(12, 16, K('green', 3)); c.R(5, 28, 6, 2, K('cable', -2)); c.outline()


@piece('street-atm-kiosk', '현금 단말기 부스(윗면 + 화면 + 카드 투입구)', 1, 2, 'tall_furniture', group='street', solid=[(0, 1), (0, 0)], tags=['단말기'], desc='거리 단말기.', line='B')
def _atm(c):
    cube(c, 1, 2, 14, 9, 20, 'conc', tt=3, ft=0, ol=False, tex='plate')
    c.R(3, 13, 10, 7, K('cable', -1)); c.HL(3, 13, 10, K('green', 3)); c.HL(4, 15, 6, K('green', 2)); c.HL(4, 17, 4, K('green', 1))
    c.R(4, 22, 8, 2, K('cable', -2)); c.R(5, 22, 6, 1, K('orange', 3)); c.R(3, 27, 10, 2, K('cable', 0)); c.outline()


@piece('street-trash-bin', '네온 쓰레기통(원통 몸통 + 윗면 구멍)', 1, 1, 'round_body', group='street', solid=[(0, 0)], tags=['쓰레기통'], desc='거리 쓰레기통.', line='B')
def _tb(c):
    cyl(c, 8, 6, 6, 3, 6, 'conc', tt=3, ft=0, ol=False, bands=1); c.ell(8, 6, 3, 1, K('cable', -2)); c.HL(4, 11, 8, K('cyan', 2)); c.outline()


@piece('street-bench-neon', '네온 벤치(긴 앉는 면 윗면 + 등받이 슬랩 + 밑 네온)', 2, 1, 'low_furniture', group='street', solid=[(0, 0), (1, 0)], tags=['벤치'], desc='거리 벤치.', line='B')
def _bn(c):
    cube(c, 2, 1, 28, 3, 3, 'navy', tt=3, ft=0, ol=False, topmat='violet')
    cube(c, 1, 6, 30, 5, 3, 'conc', tt=3, ft=-1, ol=False, tex='plate')
    c.HL(3, 14, 26, K('magenta', 3)); c.HL(4, 15, 24, K('magenta', 1)); c.outline()


@piece('street-planter-neon', '네온 화분 상자(윗면 + 잎 덩이)', 1, 1, 'organic', group='street', solid=[(0, 0)], tags=['화분', '식물'], desc='거리 화분.', line='B')
def _pl(c):
    cube(c, 1, 5, 14, 5, 5, 'conc', tt=3, ft=-1, ol=False)
    c.ell(8, 4, 6, 3, K('plant', 1)); c.ell(6, 3, 3, 2, K('plant', 2)); c.ell(10, 4, 3, 2, K('plant', 0)); c.P(5, 2, K('magenta', 3)); c.P(11, 3, K('cyan', 3))
    c.HL(2, 14, 12, K('violet', 3)); c.outline()


@piece('street-lamp-post', '굵은 가로등 기둥 상자(윗면 + 긴 램프창 + 받침)', 1, 2, 'box', group='street', solid=[(0, 1)], tags=['가로등'], desc='굵은 가로등.', line='B')
def _lp(c):
    cube(c, 2, 22, 12, 5, 6, 'conc', tt=3, ft=-1, ol=False)
    cube(c, 3, 2, 10, 8, 20, 'hull', tt=3, ft=-1, ol=False, topmat='white')
    c.R(5, 12, 6, 8, K('cyan', 1)); c.HL(5, 12, 6, K('glow', 0)); c.VL(5, 12, 8, K('cyan', 3)); c.HL(4, 22, 8, K('cable', 0)); c.outline()


@piece('street-bollard', '발광 볼라드(원통 + 윗면 램프)', 1, 1, 'round_body', group='street', solid=[(0, 0)], tags=['볼라드'], desc='차단 말뚝.', line='B')
def _bo(c):
    cyl(c, 8, 6, 5, 3, 6, 'hull', tt=3, ft=0, ol=False, bands=0); c.ell(8, 6, 3, 1, K('orange', 3)); hazard(c, 4, 10, 9, 2, 'yellow', 'cable'); c.outline()


@piece('street-barrier-stripe', '줄무늬 차단 바리케이드(윗면 + 위험 띠 앞면)', 2, 1, 'box', group='street', solid=[(0, 0), (1, 0)], tags=['바리케이드'], desc='도로 차단.', line='B')
def _bs(c):
    cube(c, 1, 2, 30, 7, 6, 'orange', tt=3, ft=-1, ol=False, tex='plate'); hazard(c, 2, 9, 28, 4, 'yellow', 'cable'); c.P(4, 4, K('glow', 0)); c.P(27, 4, K('glow', 0)); c.outline()


@piece('street-manhole', '맨홀 뚜껑(바닥에 박힌 둥근 철판)', 1, 1, 'flat', group='street', solid=[], tags=['맨홀', '바닥'], desc='바닥 맨홀.', line='B')
def _mh(c):
    c.ell(8, 8, 7, 7, K('conc', -2)); c.ell(8, 8, 6, 6, K('conc', 1))
    for j in range(-4, 5, 2): c.HL(4, 8 + j, 9, K('conc', -2))
    c.VL(8, 3, 11, K('conc', -1)); c.P(5, 5, K('conc', 4)); c.P(11, 11, K('rust', 1))


@piece('street-ac-cluster', '실외기 묶음(상자 둘 + 윗면 환풍 팬)', 2, 1, 'box', group='street', solid=[(0, 0), (1, 0)], tags=['실외기'], desc='공조 실외기.', line='B')
def _ac(c):
    for x in (1, 17):
        cube(c, x, 2, 14, 8, 5, 'hull', tt=3, ft=-1, ol=False)
        c.ell(x + 7, 6, 5, 3, K('cable', 0)); c.ell(x + 7, 6, 3, 2, K('cable', 3)); c.P(x + 7, 6, K('cyan', 3))
        c.HL(x + 2, 12, 10, K('cable', 1)); c.HL(x + 2, 13, 10, K('cable', -1)); c.P(x + 12, 11, K('green', 3))
    c.outline()


@piece('street-transit-stop', '정류장 쉼터(사다리꼴 지붕 윗면 + 유리 벽 + 안 벤치)', 3, 2, 'structure', group='street', solid=[(0, 1), (1, 1), (2, 1)], tags=['정류장'], desc='버스 정류장.', line='B')
def _tst(c):
    tcube(c, 1, 2, 46, 10, 19, 'navy', ins=4, tt=3, ft=-2, topmat='hull', ol=False)
    c.R(4, 13, 40, 12, K('glass', -1)); c.HL(4, 13, 40, K('cyan', 3))
    for i in range(10, 40, 12): c.VL(i, 14, 11, K('hull', 1))
    c.R(7, 20, 16, 3, K('violet', 2)); c.HL(7, 20, 16, K('violet', 3)); c.R(30, 15, 9, 7, K('cyan', 1)); c.HL(30, 15, 9, K('cyan', 3))
    c.HL(2, 28, 44, K('conc', 2)); c.outline()


@piece('street-crate-pile', '화물 상자 더미(쌓은 상자 윗면들)', 2, 1, 'box', group='street', solid=[(0, 0), (1, 0)], tags=['상자'], desc='쌓인 화물.', line='B')
def _cp(c):
    cube(c, 1, 5, 14, 5, 6, 'orange', tt=3, ft=-1, ol=False, tex='plate')
    cube(c, 17, 3, 14, 6, 7, 'hull', tt=3, ft=-1, ol=False, tex='plate'); hazard(c, 18, 11, 6, 1, 'yellow', 'cable')
    cube(c, 4, 1, 9, 3, 2, 'rust', tt=3, ft=-1, ol=False); c.outline()


@piece('street-puddle-neon', '네온 웅덩이(바닥 물웅덩이에 비친 마젠타·시안 빛)', 1, 1, 'flat', group='street', solid=[], tags=['웅덩이', '바닥'], desc='네온 반사 웅덩이.', line='B')
def _pd(c):
    c.ell(8, 8, 7, 4, K('navy', -2)); c.ell(8, 8, 6, 3, K('navy', 0))
    c.HL(4, 7, 4, K('magenta', 2)); c.HL(8, 8, 4, K('cyan', 2)); c.P(6, 9, K('magenta', 1)); c.P(10, 7, K('cyan', 3))

"""줄 B 실내 기물(공방·보일러실·기관실·연구소·여관). 윗면은 사다리꼴(taper)로 깊게, 위에 놓인 물건은 윗면 위에 그림자와 함께."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def legs(c, xs, y, h, ramp='iron', t=-1):
    for x in xs:
        c.VL(x, y, h, K(ramp, t + 1)); c.VL(x + 1, y, h, K(ramp, t - 1))


def flask(c, x, y, liquid='patina', h=6):
    """유리 플라스크(둥근 몸 + 목): 액체 색 아래, 유리 빛 위."""
    c.VL(x + 1, y, 2, K('glass', 3)); c.P(x + 2, y, K('glass', 2))
    for j in range(h - 2):
        for i in range(-1, 5):
            if abs(i - 1.5) <= 1.5 + (j > 0) * .8:
                c.P(x + i, y + 2 + j, K(liquid, 2 if j > (h - 2) // 2 else 3) if j > 0 else K('glass', 3))
    c.P(x, y + 3, K('glass', 4))


@piece('steam-i-workbench', '공방 작업대(바이스·공구)', 2, 1, kind='low_furniture', line='B', solid=[(0, 0), (1, 0)], tags=['공방', '작업대'])
def workbench(c):
    top_slab(c, 1, 2, 30, 7, 'wood', 1, tex='plank', taper=.3)
    front(c, 1, 9, 30, 6, 'wood', -1, mat='plank', seed=4)
    # 바이스(왼쪽 끝) · 망치 · 톱니 몇 개 · 기름 깡통
    c.R(3, 3, 6, 4, K('iron', 0)); c.HL(3, 3, 6, K('iron', 2)); c.HL(2, 7, 8, K('iron', -2)); c.P(9, 4, K('brass', 3))
    c.HL(13, 5, 7, K('wood', -1)); c.R(19, 4, 3, 3, K('iron', 1)); c.P(19, 4, K('iron', 3))
    gear(c, 25, 5, 2.5, teeth=6, ramp='brass', spokes=0, hub=False); c.P(25, 5, K('iron', -3))
    c.P(15, 7, K('copper', 2)); c.P(16, 7, K('copper', 0))
    c.R(4, 11, 7, 3, K('wood', -2)); c.HL(4, 11, 7, K('wood', 0)); c.P(7, 12, K('brass', 3))      # 서랍
    c.R(20, 11, 7, 3, K('wood', -2)); c.HL(20, 11, 7, K('wood', 0)); c.P(23, 12, K('brass', 3))
    c.outline()


@piece('steam-i-lathe', '선반 기계(주철 받침·놋쇠 척)', 2, 1, kind='box', line='B', solid=[(0, 0), (1, 0)], tags=['공방', '기계'])
def lathe(c):
    top_slab(c, 1, 5, 30, 5, 'iron', 0, taper=.4)
    front(c, 1, 10, 30, 5, 'iron', -1, mat='plain')
    for X in (4, 26): c.R(X, 10, 3, 5, K('iron', -3))
    # 머리 상자(왼쪽) + 척 + 공작물 + 심압대
    box3(c, 2, 0, 9, 4, 6, 'patina', 'patina', 0)
    c.R(11, 4, 2, 4, K('brass', 2)); c.HL(13, 5, 10, K('copper', 2)); c.HL(13, 6, 10, K('copper', -1))
    box3(c, 23, 2, 6, 3, 5, 'patina', 'patina', 0)
    c.outline()


@piece('steam-i-drillpress', '탁상 드릴 프레스', 1, 2, kind='other', line='B', solid=[(0, 1)], tags=['공방', '기계'])
def drillpress(c):
    top_slab(c, 1, 22, 14, 6, 'iron', 0, taper=.5)
    front(c, 1, 28, 14, 3, 'iron', -1)
    c.R(4, 8, 3, 16, K('iron', 0)); c.VL(4, 8, 16, K('iron', 2)); c.VL(6, 8, 16, K('iron', -2))
    box3(c, 3, 2, 11, 4, 6, 'patina', 'patina', 0)
    c.VL(11, 12, 6, K('iron', 1)); c.P(11, 18, K('iron', 3))
    c.R(8, 18, 6, 2, K('iron', 1)); c.HL(8, 18, 6, K('iron', 3))
    c.line(13, 8, 15, 12, K('red', 0)); c.P(15, 12, K('red', 2))
    c.outline()


@piece('steam-i-toolboard', '공구 걸이판(벽)', 2, 2, kind='wall_mounted', line='B', tags=['공방', '벽'])
def toolboard(c):
    front(c, 1, 2, 30, 26, 'wood', 0, mat='plank', seed=3)
    for j in range(6, 26, 4):
        for i in range(4, 30, 4): c.P(i, j, K('wood', -3))
    # 공구 실루엣: 렌치 2, 망치, 톱, 톱니
    c.line(5, 6, 8, 16, K('iron', 1)); c.line(6, 6, 9, 16, K('iron', -1)); c.R(4, 4, 4, 3, K('iron', 1))
    c.R(12, 6, 6, 2, K('iron', 1)); c.VL(15, 8, 9, K('wood', -2))
    c.R(21, 5, 8, 3, K('wood', 1)); c.HL(21, 8, 8, K('iron', 0)); c.HL(21, 9, 8, K('iron', 2))
    gear(c, 9, 22, 3, teeth=8, ramp='brass', spokes=0)
    gear(c, 23, 21, 4, teeth=10, ramp='copper', spokes=3)
    c.outline()


@piece('steam-i-toolchest', '서랍 공구함(붉은 철)', 1, 1, kind='box', line='B', solid=[(0, 0)], tags=['공방', '보관'])
def toolchest(c):
    top_slab(c, 1, 1, 14, 5, 'red', 1, taper=.5)
    front(c, 1, 6, 14, 9, 'red', -1)
    for j in (7, 10, 13):
        c.HL(2, j, 12, K('red', -3)); c.HL(6, j - 1, 4, K('iron', 2))
    c.R(5, 2, 6, 2, K('iron', 0)); c.HL(5, 2, 6, K('iron', 2))
    c.outline()


@piece('steam-i-forge', '대장간 화덕(달군 숯이 위에서 보임)', 2, 2, kind='container', line='B', solid=[(0, 1), (1, 1)], tags=['대장간', '화덕', '불'])
def forge(c):
    # 벽돌 화덕: 윗면 테(벽돌) 안쪽 아가리 = 달군 숯(타원), 앞면 벽돌 + 풀무 + 뒤 갓
    for j in range(14):
        for i in range(28):
            X, Y = 2 + i, 10 + j
            u = (i + .5 - 14) / 14; v = (j + .5 - 7) / 7
            d = u * u + v * v
            if d <= 1:
                inner = (u / .78) ** 2 + (v / .62) ** 2 <= 1
                if inner:
                    r = hv(i // 2, j // 2, 3)
                    tt = 4 if ((u / .4) ** 2 + (v / .35) ** 2 <= 1 and r > .3) else (3 if r > .45 else (2 if r > .2 else 0))
                    c.P(X, Y, K('fire', tt) if tt > 0 else K('soot', -3))
                else:
                    c.P(X, Y, K('brick', 1 if v < 0 else -1))
    front(c, 2, 24, 28, 7, 'brick', -1, mat='brick', seed=5)
    # 뒤 연기 갓(사다리꼴 철판) + 연통
    for j in range(8):
        hw = 5 + j
        for i in range(-hw, hw + 1): c.P(16 + i, 2 + j, K('iron', (1 if i < -hw / 3 else (0 if i < hw / 3 else -2))))
        c.P(16 - hw - 1, 2 + j, OL); c.P(16 + hw + 1, 2 + j, OL)
    c.R(14, 0, 5, 2, K('iron', -1))
    c.R(27, 22, 4, 6, K('wood', -1)); c.HL(27, 22, 4, K('wood', 1))             # 풀무
    c.outline()


@piece('steam-i-boiler', '기관실 큰 보일러(세운 원통·화구·계기)', 3, 3, kind='round_body', line='B', solid=[(i, j) for i in range(3) for j in (1, 2)], tags=['보일러실', '보일러', '기관실'])
def boiler_big(c):
    cylinder(c, 4, 4, 40, 14, 26, 'copper', -1, bands=(4, 16), lid=True)
    # 뚜껑 위 안전밸브 + 증기관(위로)
    cylinder(c, 26, 1, 6, 3, 6, 'brass', 0, bands=())
    c.R(15, 6, 4, 3, K('iron', 0)); c.HL(15, 6, 4, K('iron', 2))
    # 화구(아래 앞) + 불빛
    c.R(16, 30, 16, 11, K('iron', -3)); c.HL(16, 30, 16, K('iron', 0))
    for Y in range(32, 40):
        for X in range(18, 30):
            d = math.hypot((X + .5 - 24) / 6, (Y + .5 - 40) / 8)
            c.P(X, Y, K('fire', 4 if d < .4 else (3 if d < .7 else 2)))
    for X in range(19, 30, 3): c.VL(X, 32, 8, K('iron', -3))
    # 압력계 2(앞 위)
    for gx in (14, 34):
        for Y in range(17, 25):
            for X in range(gx - 4, gx + 4):
                d = math.hypot(X + .5 - gx, Y + .5 - 21)
                if d <= 3.6: c.P(X, Y, K('brass', 2 if X < gx else -1) if d > 2.6 else K('canvas', 3))
        c.line(gx, 21, gx + 1, 19, K('red', 0))
    c.outline()


@piece('steam-i-engine', '가로 증기 기관(큰 플라이휠)', 3, 2, kind='box', line='B', solid=[(0, 1), (1, 1), (2, 1)], tags=['기관실', '기관'])
def engine(c):
    top_slab(c, 2, 16, 44, 8, 'iron', 0, taper=.4)
    front(c, 2, 24, 44, 7, 'iron', -1, mat='plate')
    # 실린더(누운 구리 원통, 윗면 밝은 띠) + 피스톤 막대 + 플라이휠
    for X in range(5, 21):
        for j in range(9):
            c.P(X, 9 + j, K('copper', [3, 2, 2, 1, 0, 0, -1, -2, -2][j]))
    for X in (5, 12, 20): c.VL(X, 8, 11, K('brass', 1)); c.P(X, 8, K('brass', 3))
    c.HL(21, 13, 14, K('iron', 2)); c.HL(21, 14, 14, K('iron', -1))
    gear(c, 38, 11, 9.5, teeth=0, ramp='iron', t=0, spokes=6)
    for Y in range(0, 23):
        for X in range(28, 48):
            d = math.hypot(X + .5 - 38, Y + .5 - 11)
            if 8.2 < d <= 9.6: c.P(X, Y, K('iron', 1 if Y < 11 else -1))
    c.P(38, 11, K('brass', 4))
    c.outline()


@piece('steam-i-pipewall', '벽 배관(관·밸브·압력계)', 2, 2, kind='wall_mounted', line='B', tags=['보일러실', '배관', '벽'])
def pipewall(c):
    pipe_h(c, 0, 4, 32, d=5, ramp='copper', flanges=(10, 24))
    pipe_h(c, 0, 13, 32, d=3, ramp='iron', flanges=(16,))
    pipe_v(c, 6, 9, 22, d=4, ramp='copper', flanges=(12,))
    pipe_v(c, 24, 16, 15, d=3, ramp='iron')
    for (vx, vy) in ((17, 22),):
        c.ell(vx, vy, 4, 4, K('red', 0)); c.ell(vx, vy, 2.4, 2.4, K('soot', -3)); c.HL(vx - 4, vy, 9, K('red', 1)); c.VL(vx, vy - 4, 9, K('red', 1)); c.P(vx, vy, K('brass', 3))
    for Y in range(18, 27):
        for X in range(25, 32):
            d = math.hypot(X + .5 - 28.5, Y + .5 - 21.5)
            if d <= 3.5: c.P(X, Y, K('brass', 1) if d > 2.5 else K('canvas', 3))
    c.outline()


@piece('steam-i-gauge-panel', '계기판(압력계 3·레버)', 2, 1, kind='wall_mounted', line='B', tags=['기관실', '계기', '벽'])
def gauge_panel(c):
    front(c, 1, 1, 30, 14, 'brass', -1, mat='plain')
    for (X, Y) in ((3, 2), (28, 2), (3, 13), (28, 13)): c.P(X, Y, K('brass', 3))
    for gx in (7, 16, 25):
        for Y in range(3, 12):
            for X in range(gx - 4, gx + 5):
                d = math.hypot(X + .5 - gx - .5, Y + .5 - 7.5)
                if d <= 4: c.P(X, Y, K('iron', -2) if d > 3 else K('canvas', 3))
        c.line(gx, 8, gx + (gx % 3) - 1, 5, K('red', 0)); c.P(gx, 8, K('iron', -3))
    c.outline()


@piece('steam-i-coal-bunker', '석탄 칸(나무 테 안에 석탄)', 2, 1, kind='container', line='B', solid=[(0, 0), (1, 0)], tags=['보일러실', '석탄'])
def coal_bunker(c):
    for j in range(9):
        for i in range(30):
            edge = j < 2 or i < 2 or i > 27
            if edge: c.P(1 + i, 1 + j, K('wood', 2 if j < 1 or i < 1 else 1))
            else:
                r = hv(i // 2, j, 5)
                c.P(1 + i, 1 + j, K('soot', -3 + (r > .5) + (r > .85) + (j < 5)))
    c.HL(1, 0, 30, OL)
    front(c, 1, 10, 30, 5, 'wood', -1, mat='plank', seed=6)
    c.R(22, 3, 3, 4, K('iron', 1)); c.line(24, 3, 28, 0, K('wood', 0))       # 삽
    c.outline()


@piece('steam-i-control-desk', '조종 책상(놋쇠 레버·다이얼)', 2, 1, kind='low_furniture', line='B', solid=[(0, 0), (1, 0)], tags=['기관실', '조종실'])
def control_desk(c):
    top_slab(c, 1, 3, 30, 7, 'brass', 0, taper=.3)
    front(c, 1, 10, 30, 5, 'wood', -1, mat='plank')
    for k, X in enumerate((6, 10, 14)):
        c.VL(X, 0, 5 + (k == 1), K('iron', 1)); c.ell(X, 0.5, 1.2, 1.2, K('red', 1 + (k == 0)))
    for gx in (21, 27):
        c.ell(gx, 6, 2.5, 1.6, K('canvas', 3)); c.P(gx, 6, K('red', 0)); c.P(gx - 1, 5, K('iron', -3))
    c.outline()


@piece('steam-i-lab-table', '연구 탁자(플라스크·버너)', 2, 1, kind='low_furniture', line='B', solid=[(0, 0), (1, 0)], tags=['연구소', '실험'])
def lab_table(c):
    top_slab(c, 1, 5, 30, 6, 'stone', 1, taper=.3)
    legs(c, (3, 27), 11, 4); c.HL(3, 13, 26, K('wood', -1))
    flask(c, 5, 0, 'patina'); flask(c, 12, 2, 'magi'); flask(c, 20, 1, 'red')
    c.R(25, 4, 3, 4, K('brass', 1)); c.P(26, 2, K('fire', 4)); c.P(26, 3, K('fire', 3))      # 버너
    c.outline()


@piece('steam-i-tesla-coil', '테슬라 코일(구리 감김·위 고리)', 1, 2, kind='column', line='B', solid=[(0, 1)], tags=['연구소', '전기'])
def tesla(c):
    # 위 고리(타원 도넛 — 위에서 본 윗면)
    for Y in range(0, 8):
        for X in range(0, 16):
            d = math.hypot((X + .5 - 8) / 7.5, (Y + .5 - 4) / 3.6)
            if d <= 1:
                c.P(X, Y, K('iron', 2 if Y < 4 else 0) if d > .5 else K('iron', -2))
    for Y in range(8, 23):
        for X in range(5, 11):
            c.P(X, Y, K('copper', (2 if X < 7 else (0 if X < 9 else -2)) + (1 if Y % 2 else 0)))
    top_slab(c, 2, 22, 12, 5, 'iron', 0, taper=.5)
    front(c, 2, 27, 12, 4, 'iron', -1)
    c.P(2, 2, K('magi', 4)); c.P(1, 1, K('magi', 3)); c.P(14, 3, K('magi', 4))
    c.outline()


@piece('steam-i-bar-counter', '여관 술 계산대(놋쇠 꼭지)', 3, 1, kind='low_furniture', line='B', solid=[(0, 0), (1, 0), (2, 0)], tags=['여관', '주점'])
def bar_counter(c):
    top_slab(c, 1, 3, 46, 6, 'wood', 1, tex='plank', taper=.3)
    front(c, 1, 9, 46, 6, 'wood', -1, mat='plank', seed=9)
    c.HL(1, 12, 46, K('brass', 2))
    for X in (8, 12, 16):
        c.VL(X, 0, 5, K('brass', 2)); c.P(X, 0, K('brass', 4)); c.P(X + 1, 1, K('brass', 1))
    for X in (26, 33):         # 술잔(윗면 거품)
        c.R(X, 3, 3, 4, K('glass', 2)); c.HL(X, 3, 3, K('canvas', 4)); c.P(X + 3, 4, K('glass', 1))
    c.R(39, 2, 4, 5, K('patina', 0)); c.HL(39, 2, 4, K('patina', 2))
    c.outline()


@piece('steam-i-keg-rack', '술통 거치대(통 마구리가 보임)', 2, 2, kind='frame', line='B', solid=[(0, 1), (1, 1)], tags=['여관', '주점', '보관'])
def keg_rack(c):
    top_slab(c, 1, 1, 30, 9, 'wood', 1, tex='plank', taper=.4)
    c.R(1, 10, 2, 20, K('wood', 0)); c.R(29, 6, 2, 24, K('wood', -2))
    for (cx, cy) in ((9, 16), (23, 16), (9, 26), (23, 26)):
        for Y in range(cy - 6, cy + 6):
            for X in range(cx - 6, cx + 6):
                d = math.hypot(X + .5 - cx, Y + .5 - cy)
                if d <= 5.8:
                    c.P(X, Y, K('iron', 0) if d > 4.8 else K('wood', 2 if (X + Y) % 3 else 1))
        c.R(cx - 1, cy + 1, 2, 3, K('brass', 1)); c.P(cx - 1, cy + 1, K('brass', 3))
    c.HL(1, 21, 30, K('wood', 1)); c.HL(1, 22, 30, K('wood', -2)); c.HL(1, 31, 30, K('wood', -2))
    c.outline()


@piece('steam-i-table', '여관 탁자(맥주잔·접시)', 2, 2, kind='low_furniture', line='B', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['여관', '탁자'])
def table(c):
    top_slab(c, 2, 4, 28, 14, 'wood', 1, tex='plank', taper=.25)
    front(c, 2, 18, 28, 4, 'wood', -1)
    legs(c, (4, 26), 22, 8, 'wood', 0)
    for (X, Y) in ((8, 7), (20, 10)):
        shade_rect(c, X + 1, Y + 5, 4, 1, 1)
        c.R(X, Y, 4, 5, K('glass', 2)); c.HL(X, Y, 4, K('canvas', 4)); c.P(X + 4, Y + 2, K('glass', 1))
    c.ell(14, 12, 3, 1.6, K('canvas', 3)); c.ell(14, 12, 1.6, .8, K('red', 1))
    c.outline()


@piece('steam-i-stool', '둥근 의자', 1, 1, kind='seat', line='B', tags=['여관', '의자'])
def stool(c):
    cylinder(c, 2, 2, 12, 6, 2, 'wood', 0, bands=(), lid=True)
    legs(c, (4, 11), 7, 7, 'wood', -1)
    c.HL(4, 11, 9, K('wood', -2))
    c.outline()


@piece('steam-i-chair', '등받이 의자(붉은 방석)', 1, 1, kind='seat', line='B', tags=['여관', '의자'])
def chair(c):
    """앉는 면이 크게 보이는 의자: 뒤 등받이(위 가로대 윗면 2줄) + 방석 윗면 7줄(사다리꼴) + 앞 다리."""
    top_slab(c, 3, 1, 10, 2, 'wood', 1)
    c.R(3, 3, 10, 3, K('wood', -1)); c.VL(5, 3, 3, K('wood', -3)); c.VL(10, 3, 3, K('wood', -3))
    top_slab(c, 2, 6, 12, 6, 'red', 0, taper=.3)
    c.HL(2, 12, 12, K('red', -2))
    legs(c, (3, 11), 13, 3, 'wood', -1)
    c.outline()


@piece('steam-i-bed', '여관 침대(퀼트 이불)', 1, 2, kind='low_furniture', line='B', solid=[(0, 0), (0, 1)], tags=['여관', '침대'])
def bed(c):
    c.R(1, 0, 14, 4, K('wood', 0)); c.HL(1, 0, 14, K('wood', 2)); c.P(2, 1, K('brass', 3)); c.P(13, 1, K('brass', 3))
    top_slab(c, 1, 4, 14, 22, 'canvas', 1, taper=.15)
    c.R(3, 5, 10, 5, K('canvas', 3)); c.HL(3, 9, 10, K('canvas', 1))         # 베개
    for j in range(11, 25):
        for i in range(2, 14):
            q = ((i // 4) + (j // 4)) % 2
            c.P(1 + i, 4 + j - 3, K('red' if q else 'patina', 1 if j < 18 else 0))
    front(c, 1, 26, 14, 4, 'wood', -1)
    c.outline()


@piece('steam-i-stove', '주철 난로(연통)', 1, 2, kind='tall_furniture', line='B', solid=[(0, 1)], tags=['여관', '공방', '난로'])
def stove(c):
    pipe_v(c, 6, 0, 14, d=4, ramp='iron', flanges=(6,))
    top_slab(c, 1, 12, 14, 7, 'iron', 1, taper=.4)
    front(c, 1, 19, 14, 10, 'iron', -1)
    c.R(4, 20, 8, 6, K('iron', -3))
    for Y in range(21, 25):
        for X in range(5, 11): c.P(X, Y, K('fire', 4 if Y > 22 and 6 < X < 9 else 3))
    c.HL(1, 28, 14, K('iron', -3)); c.P(2, 30, K('iron', -1)); c.P(13, 30, K('iron', -2))
    c.outline()


@piece('steam-i-bookshelf', '책장(가죽 장정)', 2, 2, kind='tall_furniture', line='B', solid=[(0, 1), (1, 1)], tags=['연구소', '여관', '책'])
def bookshelf(c):
    top_slab(c, 1, 1, 30, 5, 'wood', 1, taper=.3)
    front(c, 1, 6, 30, 25, 'wood', -2)
    for sy in (7, 15, 23):
        x = 3
        k = 0
        while x < 29:
            bw = 2 + (k * 7 + sy) % 2
            ramp = ('red', 'patina', 'copper', 'magi', 'wood')[(k + sy) % 5]
            hh = 6 - (k + sy) % 2
            c.R(x, sy + 7 - hh, bw, hh, K(ramp, 0)); c.VL(x, sy + 7 - hh, hh, K(ramp, 2)); c.P(x, sy + 9 - hh, K('brass', 2))
            x += bw + (1 if k % 4 == 3 else 0); k += 1
        c.HL(2, sy + 7, 28, K('wood', 1)); c.HL(2, sy + 8, 28, K('wood', -3))
    c.outline()


@piece('steam-i-blueprint-table', '설계 탁자(청사진)', 2, 1, kind='low_furniture', line='B', solid=[(0, 0), (1, 0)], tags=['공방', '연구소'])
def blueprint_table(c):
    top_slab(c, 1, 2, 30, 8, 'wood', 1, taper=.3)
    for Y in range(3, 9):
        for X in range(5, 25):
            c.P(X, Y, K('sky', -2 if (X + Y) % 9 else -1))
    for X in range(7, 23, 4): c.VL(X, 4, 3, K('cloud', 3))
    c.HL(8, 5, 12, K('cloud', 2)); c.ell(18, 6, 2, 1.2, K('cloud', 3))
    c.R(26, 4, 3, 3, K('brass', 2))
    legs(c, (3, 27), 10, 5, 'wood', 0); c.HL(3, 13, 26, K('wood', -1))
    c.outline()


@piece('steam-i-rug', '깔개(톱니 무늬 테두리)', 2, 2, kind='flat', line='B', tags=['여관', '연구소', '깔개'])
def rug(c):
    for Y in range(3, 29):
        for X in range(1, 31):
            e = min(X - 1, 30 - X, Y - 3, 28 - Y)
            if e < 2: col = K('brass', 1 if e == 0 else 0)
            elif e < 5: col = K('red', -1 if (X + Y) % 4 else 0)
            else: col = K('red', 0 if ((X // 3 + Y // 3) % 2) else 1)
            c.P(X, Y, col)
    gear(c, 16, 16, 5, teeth=8, ramp='brass', t=-1, spokes=0)
    c.outline()


@piece('steam-i-crate-parts', '부품 상자(톱니·관이 위로 보임)', 1, 1, kind='container', line='B', solid=[(0, 0)], tags=['공방', '보관'])
def crate_parts(c):
    for j in range(8):
        for i in range(14):
            edge = j == 0 or j == 7 or i == 0 or i == 13
            c.P(1 + i, 1 + j, K('wood', 2 if (j == 0 or i == 0) else 1) if edge else K('soot', -3))
    gear(c, 5, 4, 2.6, teeth=6, ramp='brass', spokes=0, hub=False)
    c.HL(7, 6, 6, K('copper', 2)); c.HL(7, 7, 6, K('copper', -1))
    c.P(11, 3, K('iron', 2)); c.P(12, 4, K('iron', 0))
    front(c, 1, 9, 14, 6, 'wood', -1, mat='plank')
    c.outline()


@piece('steam-i-wall-lamp', '벽 가스등(놋쇠 팔)', 1, 1, kind='wall_mounted', line='B', tags=['실내', '조명', '벽'])
def wall_lamp(c):
    c.R(6, 9, 4, 6, K('brass', 0)); c.HL(6, 9, 4, K('brass', 2))
    c.line(8, 9, 8, 7, K('brass', 1))
    for Y in range(1, 7):
        for X in range(5, 11):
            c.P(X, Y, K('fire', 4 if 6 < X < 9 and 2 < Y < 6 else 3))
    c.HL(4, 0, 8, K('iron', 1)); c.HL(5, 7, 6, K('iron', -1))
    c.outline()

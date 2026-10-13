"""줄 B 애니메이션 띠(4프레임). 프레임마다 관문을 따로 받는다(모두 통과해야 PASS)."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def puff(c, cx, cy, r, t=0, ramp='smoke'):
    """연기·증기 덩이(구): 왼쪽 위 밝음, 오른쪽 아래 어둠, 테두리 한 단 어둡게."""
    for Y in range(int(cy - r) - 1, int(cy + r) + 2):
        for X in range(int(cx - r) - 1, int(cx + r) + 2):
            dx, dy = X + .5 - cx, Y + .5 - cy; d = math.hypot(dx, dy)
            if d > r: continue
            lit = -(dx * .6 + dy * .8) / max(r, .1)
            tt = t + (2 if lit > .45 else (1 if lit > .05 else (0 if lit > -.35 else -1)))
            if d > r - 1: tt -= 1
            c.P(X, Y, K(ramp, tt))


@piece('steam-smoke-anim', '굴뚝 연기(4프레임, 위로 피어오름)', 2, 2, kind='organic', line='B', frames=4, tags=['연기', '애니메이션', '덧그림'])
def smoke(c, f):
    """굴뚝 아가리 위에 덧그리는 검댕 연기. 떨어진 덩이 4개가 프레임마다 한 덩이 간격의 1/4 씩 오른쪽 위로 오르며 커지고 옅어진다
    (아래 = 갓 나온 진한 회색, 위 = 흩어지는 밝은 회색). 마지막 덩이는 작아지며 사라져 위 끝이 잘리지 않는다."""
    for k in range(4):
        ph = k + f / 4                                     # 0..4
        y = 27 - ph * 6.6
        x = 8 + ph * 3.6
        r = 2.6 + ph * 1.25 if ph < 3 else (2.6 + 3 * 1.25) * (4 - ph) * .9
        if r < 1.6 or y - r < 0.5: continue
        t = -1 if ph < 1 else (0 if ph < 2 else 1)
        puff(c, x, y, r, t=t, ramp='smoke')
        if r > 3.5: puff(c, x + r * .55, y + r * .35, r * .55, t=t - 1, ramp='smoke')
    c.outline(OL)


@piece('steam-vent-anim', '증기 배출관(김이 뿜어 나옴, 4프레임)', 1, 2, kind='column', line='B', frames=4, solid=[(0, 1)], tags=['증기', '배관', '애니메이션'])
def vent_anim(c, f):
    """땅에서 솟은 굵은 배출관(구리, 위 아가리 타원 + 놋쇠 테) + 위로 뿜는 하얀 김 덩이(프레임마다 오름)."""
    top_slab(c, 0, 22, 16, 7, 'stone', 1, taper=.5)
    front(c, 0, 29, 16, 2, 'stone', -1, ol=False)
    cylinder(c, 2, 13, 12, 7, 10, 'copper', 0, bands=(6,), open_top=True)
    for k in range(3):
        ph = (f + k * 4 / 3) % 4
        y = 13 - ph * 3.0
        x = 8 + math.sin(ph * 1.3 + k) * 1.2
        r = 2.4 + ph * .55
        if y - r < 0: continue
        puff(c, x, y, r, t=2 - (ph > 2.6), ramp='cloud')
    c.outline()


@piece('steam-gear-anim', '벽 톱니바퀴(회전 4프레임)', 2, 2, kind='wall_mounted', line='B', frames=4, tags=['톱니', '애니메이션', '벽'])
def gear_anim(c, f):
    # 리벳 철판 받침(벽에 붙은 판)
    plate(c, 1, 1, 30, 30, 'iron', -1, pw=30, ph=30)
    c.outline()
    gear(c, 13, 13, 9, teeth=10, ramp='brass', t=0, phase=f * (2 * math.pi / 10) / 4, spokes=4)
    gear(c, 24, 24, 5, teeth=8, ramp='copper', t=0, phase=-f * (2 * math.pi / 8) / 4 * 1.25 + .2, spokes=0)
    for (x, y) in ((3, 28), (28, 3)): c.P(x, y, K('iron', 3)); c.P(x, y + 1, K('iron', -3))


@piece('steam-furnace-anim', '보일러 화로(불빛 깜빡임 4프레임)', 2, 2, kind='box', line='B', frames=4, solid=[(0, 1), (1, 1)], tags=['화로', '보일러', '애니메이션'])
def furnace_anim(c, f):
    # 윗면(리벳 철판 + 연통 아가리) + 앞면(벽돌 화구 + 불 문)
    top_slab(c, 2, 3, 28, 11, 'iron', 0, taper=.4)
    cylinder(c, 19, 1, 8, 4, 3, 'iron', -1, bands=(), open_top=True)
    front(c, 2, 14, 28, 16, 'brick', -1, mat='brick', seed=3)
    c.HL(2, 14, 28, K('iron', -1)); c.HL(2, 15, 28, K('iron', -3))
    fl = [0, 1, 0, -1][f]
    for Y in range(18, 28):
        for X in range(9, 23):
            d = math.hypot((X + .5 - 16) / 7, (Y + .5 - 27) / 10)
            tt = 4 if d < .35 else (3 if d < .6 else (2 if d < .85 else 1))
            c.P(X, Y, K('fire', min(4, tt + fl if d > .3 else tt)))
    c.HL(8, 17, 16, K('iron', 1)); c.VL(8, 17, 11, K('iron', 0)); c.VL(23, 17, 11, K('iron', -2))
    for X in range(10, 23, 3): c.VL(X, 18, 10, K('iron', -3))           # 화격자 살
    c.outline()


def lamp2(c, f, lit):
    """가스등: 둥근 등 = 세운 원통 유리(불빛) + 위 원판 뚜껑(타원 5줄, 위에서 보임) + 꼭지. 기둥 고리 없음. 둥근 돌 받침도 원판 뚜껑(6줄)."""
    cylinder(c, 3, 5, 10, 4, 6, 'glass', 0, bands=(), rivet_bands=False)
    if lit:                                   # 유리 안 작은 불꽃(가운데만) — 유리 원통 모양은 꺼진 등과 같다
        for Y in range(9, 14):
            for X in range(6, 11):
                d = math.hypot((X + .5 - 8) / 1.9, (Y + .5 - 11.5) / 2.4)
                if d <= 1: c.P(X, Y, K('fire', 4 if d < .45 else (3 if d < .75 else 2)))
    for X in ((5, 11) if lit else (5, 8, 11)): c.VL(X, 8, 6, K('iron', -2))
    cylinder(c, 2, 1, 12, 6, 1, 'iron', 0, bands=(), rivet_bands=False, lid=True)
    c.P(8, 0, K('brass', 3)); c.P(8, 1, K('brass', 1))
    c.R(6, 15, 4, 10, K('iron', 0)); c.VL(6, 15, 10, K('iron', 2)); c.VL(9, 15, 10, K('iron', -2))
    cylinder(c, 2, 23, 12, 6, 3, 'stone', 0, bands=(), lid=True)
    c.ell(8, 26, 2, 1, K('iron', -1)); c.P(7, 25, K('iron', 1))
    c.outline()


@piece('steam-gaslamp-lit', '가스등(켜짐·밤)', 1, 2, kind='column', line='B', solid=[(0, 1)], tags=['가로등', '거리', '밤'])
def gaslamp_lit(c):
    lamp2(c, 0, True)


@piece('steam-gaslamp', '가스등(꺼짐·낮)', 1, 2, kind='column', line='B', solid=[(0, 1)], tags=['가로등', '거리'])
def gaslamp(c):
    lamp2(c, 0, False)


@piece('steam-piston-anim', '세운 실린더 증기 기관(피스톤 오르내림 4프레임)', 2, 2, kind='box', line='B', frames=4, solid=[(0, 1), (1, 1)], tags=['피스톤', '기관', '애니메이션'])
def piston_anim(c, f):
    """리벳 철 받침 상자(윗면 8줄) 위에 세운 실린더 2(타원 윗면) — 피스톤 막대·십자머리가 번갈아 오르내린다."""
    top_slab(c, 2, 14, 28, 9, 'iron', 0, taper=.5)
    front(c, 2, 23, 28, 7, 'iron', -1, mat='plate')
    for k, cx in enumerate((10, 22)):
        up = [0, 2, 4, 2][(f + 2 * k) % 4]
        # 실린더(구리 세운 원통)
        cylinder(c, cx - 4, 12, 8, 4, 6, 'copper', 0, bands=(2,))
        # 피스톤 막대 + 십자머리(위로 튀어나옴)
        c.VL(cx - 1, 6 - up, 8, K('iron', 2)); c.VL(cx, 6 - up, 8, K('iron', -1))
        c.R(cx - 3, 5 - up, 6, 2, K('brass', 1)); c.HL(cx - 3, 5 - up, 6, K('brass', 3))
    c.outline()


@piece('steam-gauge-anim', '압력계(바늘 떨림 4프레임)', 1, 1, kind='wall_mounted', line='B', frames=4, tags=['압력계', '애니메이션', '벽'])
def gauge_anim(c, f):
    for Y in range(16):
        for X in range(16):
            d = math.hypot(X + .5 - 8, Y + .5 - 8)
            if d <= 7: c.P(X, Y, K('brass', 2 if (X < 8 and Y < 8) else -1) if d > 5.6 else K('canvas', 3 if Y < 8 else 2))
    for k in range(7):
        a = math.pi * (.75 + k * .25)
        c.P(int(8 + math.cos(a) * 4.6), int(8 + math.sin(a) * 4.6), K('iron', -3))
    c.P(int(8 + math.cos(math.pi * 2.25) * 4), int(8 + math.sin(math.pi * 2.25) * 4), K('red', 1))
    a = math.pi * (1.55 + [0, .12, .05, .18][f])
    c.line(8, 8, int(round(8 + math.cos(a) * 4.5)), int(round(8 + math.sin(a) * 4.5)), K('red', 0))
    c.P(8, 8, K('iron', -2))
    c.outline()

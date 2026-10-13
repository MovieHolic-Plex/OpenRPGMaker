"""줄 B 바깥 소품(거리·공장 마당·부두). 작은 것도 윗면을 크게: 상자 4줄+, 원통 뚜껑 타원 3줄+, 기둥 머리 윗면."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def ground_shadow(c, cx, y, rx, ry=1.5):
    """바닥 그림자(검은 보라 타원, 덩이 아래) — 투명 바탕에 그리므로 OL 색만 쓴다."""
    c.ell(cx, y, rx, ry, OL)


def crate(c, x, y, w=14, top=5, h=8, seed=0):
    """나무 상자: 윗면 판자(가로 줄) + 앞면 판자 + 쇠 모서리띠 + 대각 버팀."""
    top_slab(c, x, y, w, top, 'wood', 1, tex='plank')
    front(c, x, y + top, w, h, 'wood', -1, mat='plain')
    for j in range(h):
        for i in range(w):
            if j % 3 == 2: c.P(x + i, y + top + j, K('wood', -3))
    for k in range(min(w, h)):
        c.P(x + 1 + int(k * (w - 3) / max(h - 1, 1)), y + top + h - 1 - k, K('wood', 1)) if k < h else None
    for X in (x, x + w - 1):
        c.VL(X, y + top, h, K('iron', -1 if X == x else -3))
    c.HL(x, y + top, w, K('iron', -2))
    for (X, Y) in ((x, y), (x + w - 1, y)): c.P(X, Y, K('iron', 1))


@piece('steam-bollard', '주철 계류주(버섯 머리)', 1, 1, kind='column', line='B', solid=[(0, 0)], tags=['계류', '부두', '거리'])
def bollard(c):
    cylinder(c, 4, 9, 8, 4, 4, 'iron', 0, bands=())
    cylinder(c, 2, 2, 12, 5, 2, 'iron', 1, bands=())
    c.outline()


@piece('steam-standpipe', '소화 급수전(붉은 주철·밸브 바퀴)', 1, 1, kind='column', line='B', solid=[(0, 0)], tags=['급수전', '거리'])
def standpipe(c):
    cylinder(c, 3, 1, 10, 7, 7, 'red', 0, bands=(4,), lid=True)
    for Y in (8, 10):
        c.HL(0, Y, 3, K('brass', 2 if Y == 8 else 0)); c.HL(13, Y, 3, K('brass', 0 if Y == 8 else -2))
    c.P(8, 3, K('brass', 4)); c.P(7, 4, K('brass', 2)); c.P(8, 4, K('brass', 1))
    c.outline()


@piece('steam-pillarbox', '원통 우체통(붉은·둥근 뚜껑)', 1, 2, kind='column', line='B', solid=[(0, 1)], tags=['우체통', '거리'])
def pillarbox(c):
    cylinder(c, 3, 8, 10, 4, 16, 'red', 0, bands=())
    cylinder(c, 1, 1, 14, 9, 2, 'red', 1, bands=(), lid=True)            # 넓은 뚜껑(위에서 본 원판)
    c.HL(5, 15, 6, K('iron', -3)); c.HL(5, 16, 6, K('red', -2))       # 투입구
    c.R(6, 19, 4, 3, K('canvas', 2)); c.HL(6, 19, 4, K('canvas', 3))   # 수거 시간판(무늬만)
    top_slab(c, 2, 26, 12, 3, 'stone', 1, taper=.5)
    front(c, 2, 29, 12, 2, 'stone', -1)
    c.outline()


@piece('steam-bench', '주철 다리 나무 벤치', 2, 1, kind='seat', line='B', solid=[(0, 0), (1, 0)], tags=['벤치', '거리', '광장'])
def bench(c):
    # 등받이(뒤, 판자 2줄) + 앉는 판 윗면(판자 4줄) + 앞 테 + 주철 다리(소용돌이)
    for j, tt in ((0, 1), (1, -1), (3, 1), (4, -1)):
        c.HL(3, 1 + j, 26, K('wood', tt))
    for X in (4, 27): c.VL(X, 0, 7, K('iron', 0))
    top_slab(c, 2, 6, 28, 5, 'wood', 1, tex='plank')
    c.HL(2, 11, 28, K('wood', -2)); c.HL(2, 12, 28, K('wood', -3))
    for X in (3, 26):
        c.R(X, 12, 3, 3, K('iron', -1)); c.P(X, 14, K('iron', 1)); c.P(X + 2, 12, K('iron', -3))
    c.outline()


@piece('steam-crate', '나무 화물 상자', 1, 1, kind='box', line='B', solid=[(0, 0)], tags=['상자', '화물'])
def crate1(c):
    crate(c, 1, 1, 14, 5, 9)
    c.outline()


@piece('steam-crate-stack', '화물 상자 더미(쇠띠 상자 포함)', 2, 2, kind='box', line='B', solid=[(0, 1), (1, 1), (0, 0)], tags=['상자', '화물', '부두'])
def crate_stack(c):
    crate(c, 2, 3, 14, 5, 9)
    crate(c, 1, 16, 15, 5, 10)
    # 쇠띠 상자(리벳 철판)
    top_slab(c, 17, 9, 13, 5, 'iron', 1, tex='plate')
    front(c, 17, 14, 13, 13, 'iron', -1, mat='plate')
    c.R(21, 18, 5, 3, K('brass', 2)); c.HL(21, 18, 5, K('brass', 3))
    c.outline()


@piece('steam-barrel', '나무 통(쇠테·마개 뚜껑)', 1, 1, kind='round_body', line='B', solid=[(0, 0)], tags=['통', '화물'])
def barrel(c):
    """짧은 몸 + 큰 뚜껑 타원(전체 높이의 절반) — 뚜껑 판자 이음 두 줄·마개 구멍·앞 테 그늘로 윗면을 보인다."""
    cylinder(c, 1, 1, 14, 9, 5, 'wood', 0, bands=(1, 4), lid=True)
    cx, cy = 8, 5.5
    for X in range(2, 15):          # 뚜껑 판자 이음(가로) — 타원 안쪽만
        for yy in (4, 7):
            u = (X + .5 - cx) / 7; v = (yy + .5 - cy) / 4.5
            if u * u + v * v < .78: c.P(X, yy, K('wood', 0))
    c.P(10, 5, K('soot', -4)); c.P(11, 5, K('wood', -2))
    c.outline()


@piece('steam-oil-drum', '기름 드럼통(철)', 1, 1, kind='round_body', line='B', solid=[(0, 0)], tags=['드럼통', '공장'])
def oil_drum(c):
    cylinder(c, 2, 0, 12, 8, 7, 'patina', -1, bands=(3,), lid=True)
    c.ell(10.5, 3.2, 1.3, .8, K('iron', -3))
    c.outline()


@piece('steam-coal-pile', '석탄 더미', 2, 1, kind='organic', line='B', solid=[(0, 0), (1, 0)], tags=['석탄', '공장 마당', '보일러'])
def coal_pile(c):
    for Y in range(2, 16):
        for X in range(1, 31):
            h = 13 * math.exp(-((X - 15) / 9) ** 2) + 3 * math.exp(-((X - 26) / 4) ** 2) + 2
            if 15 - Y > h: continue
            r = hv(X // 2, Y // 2, 9)
            d = (15 - Y) / max(h, 1)
            tt = -3 + (1 if r > .5 else 0) + (1 if d > .65 and X < 18 else 0) + (1 if r > .88 else 0)
            c.P(X, Y, K('soot', tt))
            if r > .95 and X < 20: c.P(X, Y, K('iron', 1))
    c.outline()


@piece('steam-ore-cart', '광차(석탄 실음)', 1, 1, kind='container', line='B', solid=[(0, 0)], tags=['광차', '석탄', '선로'])
def ore_cart(c):
    # 아가리(윗면 안쪽: 석탄) 6줄 + 앞면 철판 + 작은 바퀴
    for j in range(7):
        for i in range(14):
            edge = j == 0 or j == 6 or i == 0 or i == 13
            if edge: c.P(1 + i, 1 + j, K('iron', 2 if (j == 0 or i == 0) else 0))
            else:
                r = hv(i, j, 4)
                c.P(1 + i, 1 + j, K('soot', -3 + (r > .5) + (r > .85) + (j < 3)))
    front(c, 1, 8, 14, 5, 'iron', -1, mat='plain')
    for X in range(2, 14, 3): c.P(X, 9, K('iron', 2))
    for wx in (4, 11): c.ell(wx, 14, 2, 1.5, K('iron', -2)); c.P(wx, 13, K('brass', 1))
    c.outline()


@piece('steam-gear-pile', '버려진 톱니 더미', 1, 1, kind='debris', line='B', tags=['톱니', '고철'])
def gear_pile(c):
    for (x, y, rx, ry, r) in ((6, 9, 5, 2.3, 'brass'), (11, 11, 3.5, 1.6, 'copper'), (5, 12, 3, 1.3, 'iron')):
        for Y in range(int(y - ry) - 1, int(y + ry) + 2):
            for X in range(int(x - rx) - 1, int(x + rx) + 2):
                dx, dy = (X + .5 - x) / rx, (Y + .5 - y) / ry
                d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                tooth = math.cos(a * 8) > .3
                if d <= .82 or (tooth and d <= 1.15):
                    tt = 1 if dy < 0 else -1
                    if d < .35: tt = -3
                    c.P(X, Y, K(r, tt))
    c.outline()


@piece('steam-valve-post', '밸브 기둥(위에 손바퀴)', 1, 1, kind='column', line='B', solid=[(0, 0)], tags=['밸브', '배관'])
def valve_post(c):
    pipe_v(c, 6, 6, 9, d=4, ramp='copper', flanges=(5,))
    # 손바퀴(위에서 본 타원 바퀴 + 살)
    for Y in range(1, 8):
        for X in range(1, 15):
            d = math.hypot((X + .5 - 8) / 6.5, (Y + .5 - 4) / 3)
            if .72 < d <= 1: c.P(X, Y, K('red', 1 if Y < 4 else -1))
    c.HL(3, 4, 10, K('red', 0)); c.VL(8, 2, 5, K('red', 0)); c.P(8, 4, K('brass', 3))
    c.outline()


@piece('steam-pressure-tank', '압력 탱크(구리·압력계)', 2, 2, kind='round_body', line='B', solid=[(0, 1), (1, 1)], tags=['탱크', '공장', '보일러'])
def pressure_tank(c):
    cylinder(c, 4, 1, 24, 12, 14, 'copper', 0, bands=(9,), lid=True)
    c.R(15, 3, 3, 3, K('brass', 1)); c.HL(15, 3, 3, K('brass', 3))
    for Y in range(13, 20):
        for X in range(19, 26):
            d = math.hypot(X + .5 - 22.5, Y + .5 - 16.5)
            if d <= 3.4: c.P(X, Y, K('brass', 1) if d > 2.5 else K('canvas', 3))
    c.line(22, 16, 24, 15, K('red', 0))
    top_slab(c, 2, 26, 28, 3, 'stone', 1)
    front(c, 2, 29, 28, 2, 'stone', -1)
    c.outline()


@piece('steam-boiler-small', '소형 증기 보일러(연통·화구)', 2, 2, kind='round_body', line='B', solid=[(0, 1), (1, 1)], tags=['보일러', '증기'])
def boiler_small(c):
    cylinder(c, 3, 6, 22, 7, 16, 'iron', 0, bands=(4, 12))
    cylinder(c, 15, 0, 6, 3, 8, 'iron', -1, bands=(), open_top=True)
    c.ell(9, 9, 3, 1.3, K('brass', 2))
    c.R(9, 18, 8, 6, K('iron', -3)); c.R(10, 19, 6, 4, K('fire', 3)); c.HL(10, 19, 6, K('fire', 4))
    pipe_h(c, 25, 18, 6, d=3, ramp='copper')
    c.outline()


@piece('steam-buffer-stop', '선로 끝 완충 멈춤목', 2, 1, kind='box', line='B', solid=[(0, 0), (1, 0)], tags=['선로', '철도'])
def buffer_stop(c):
    top_slab(c, 3, 1, 26, 5, 'wood', 1, tex='plank')
    front(c, 3, 6, 26, 6, 'red', 0, mat='plain')
    for i in range(3, 29):
        if (i // 3) % 2: c.P(i, 8, K('canvas', 3)); c.P(i, 9, K('canvas', 2))
    for bx in (6, 23):
        c.ell(bx + 1.5, 10.5, 2.5, 2, K('iron', 0)); c.P(bx + 1, 10, K('iron', 3))
    c.HL(3, 13, 26, K('iron', -2)); c.HL(3, 14, 26, K('iron', -3))
    c.outline()


@piece('steam-brick-wall', '벽돌 담(돌 갓돌)', 2, 1, kind='box', line='B', solid=[(0, 0), (1, 0)], tags=['담', '벽돌', '공장'])
def brick_wall(c):
    top_slab(c, 0, 1, 32, 5, 'stone', 1)
    for i in range(0, 32, 8): c.VL(i + 7, 2, 3, K('stone', 0))
    brick(c, 0, 6, 32, 10, 'brick', -1, bw=5, seed=7, soot=.4)
    c.HL(0, 6, 32, K('stone', -1)); c.HL(0, 7, 32, K('brick', -3))
    c.outline()


@piece('steam-iron-railing', '돌 받침 주철 울타리', 2, 1, kind='frame', line='B', solid=[(0, 0), (1, 0)], tags=['울타리', '거리', '공원'])
def iron_railing(c):
    # 낮은 돌 받침(윗면 4줄) + 창살(위 끝 창날) + 위 가로대
    top_slab(c, 1, 8, 30, 5, 'stone', 1, taper=.5)
    front(c, 1, 13, 30, 3, 'stone', -1)
    for X in range(3, 30, 3):
        c.VL(X, 3, 8, K('iron', 0)); c.P(X, 2, K('iron', 2))
    top_slab(c, 2, 3, 28, 3, 'iron', 0, taper=.5)
    c.outline()


@piece('steam-street-clock', '거리 기둥 시계(둥근 돌 받침·북 머리)', 1, 3, kind='column', line='B', solid=[(0, 2)], tags=['시계', '거리', '광장'])
def street_clock(c):
    """북 모양 시계 머리 = 큰 뚜껑 타원(7줄, 위에서 보이는 원판) + 앞 시계판. 기둥 고리 없음, 받침도 원판 뚜껑. 모든 수평 테는 타원으로 휜다."""
    cylinder(c, 1, 1, 14, 7, 9, 'patina', -1, bands=(), rivet_bands=False, lid=True)
    c.ell(8, 4.5, 1.5, 1, K('brass', 3))
    for Y in range(9, 17):
        for X in range(4, 13):
            d = math.hypot((X + .5 - 8) / 3.9, (Y + .5 - 12.6) / 3.7)
            if d <= 1: c.P(X, Y, K('brass', 2 if X < 8 else 0) if d > .76 else K('canvas', 3))
    c.line(8, 12, 8, 10, K('iron', -4)); c.line(8, 12, 10, 13, K('iron', -4))
    c.R(6, 18, 4, 15, K('iron', 0)); c.VL(6, 18, 15, K('iron', 2)); c.VL(9, 18, 15, K('iron', -2))
    cylinder(c, 1, 31, 14, 8, 7, 'stone', 0, bands=(), lid=True)
    c.ell(8, 34.5, 2.2, 1.2, K('iron', -1)); c.P(7, 34, K('iron', 1))
    c.outline()


@piece('steam-kiosk', '신문·차표 가판대(우진각 지붕)', 2, 2, kind='structure', line='B', solid=[(0, 1), (1, 1)], tags=['가판대', '거리', '역'])
def kiosk(c):
    pyramid_roof(c, 1, 2, 30, 9, 'patina', 0, top_w=10)
    c.P(16, 0, K('brass', 3)); c.P(16, 1, K('brass', 1))
    front(c, 3, 13, 26, 17, 'wood', 0, mat='plank', seed=2)
    arch_window(c, 6, 15, 20, 6, lit=True, arch=False, panes=(3, 1), sill=False, frame='wood')
    c.R(6, 21, 20, 2, K('wood', 2)); c.HL(6, 21, 20, K('wood', 3))           # 판매대 윗면
    for X in range(7, 25, 3): c.R(X, 21, 2, 1, K('canvas', 3))              # 신문(무늬만)
    c.outline()


@piece('steam-winch', '부두 캡스턴(세운 밧줄 감개·막대 넷)', 1, 1, kind='round_body', line='B', solid=[(0, 0)], tags=['권양기', '캡스턴', '부두', '기중기'])
def winch(c):
    """세운 쇠 원통 — 머리 타원(7줄) 위에 감개 막대 X(타원 면에 눕혀 짧아진 대각), 몸통엔 원통 곡선을 따라 휜 밧줄 감김."""
    cylinder(c, 2, 1, 12, 7, 6, 'iron', 0, bands=(), lid=True)
    rx, cy = 6, 4.5
    for k, by in enumerate((2, 4)):
        for i in range(12):
            u = (i + .5 - rx) / rx; e = 3.5 * (1 - u * u) ** .5
            yb = int(round(1 + 3.5 + by + e))
            c.P(2 + i, yb, K('canvas', 2 - k if u < 0 else -k)); c.P(2 + i, yb - 1, K('canvas', 3 - k if u < 0 else 1 - k))
    for (x0, y0, x1, y1) in ((3, 2, 13, 7), (13, 2, 3, 7)):          # 타원 면 위 X 막대
        c.line(x0, y0, x1, y1, K('wood', 1))
    c.ell(8, 4.5, 1.6, 1.0, K('brass', 3)); c.P(8, 5, K('brass', 1))
    c.outline()


@piece('steam-fuel-pump', '비공정 연료 펌프(놋쇠 원통·호스)', 1, 2, kind='column', line='B', solid=[(0, 1)], tags=['비공정', '부두', '연료'])
def fuel_pump(c):
    cylinder(c, 2, 1, 12, 8, 16, 'brass', -1, bands=(8,), lid=True)
    c.R(7, 1, 3, 3, K('iron', 0)); c.HL(7, 1, 3, K('iron', 2))
    for Y in range(13, 18):
        for X in range(5, 11):
            d = math.hypot(X + .5 - 8, Y + .5 - 15.5)
            if d < 2.8: c.P(X, Y, K('canvas', 3) if d < 2 else K('iron', -2))
    for k in range(10): c.P(13 + (k > 6), 16 + k, K('soot', -2)); c.P(14 + (k > 6), 16 + k, K('soot', -3))
    top_slab(c, 1, 26, 14, 3, 'stone', 1, taper=.5)
    front(c, 1, 29, 14, 2, 'stone', -1)
    c.outline()


@piece('steam-cable-drum', '케이블 감는 북(세움)', 1, 1, kind='round_body', line='B', solid=[(0, 0)], tags=['케이블', '공장', '부두'])
def cable_drum(c):
    cylinder(c, 1, 0, 14, 9, 5, 'wood', 0, bands=(), lid=True)
    for j in range(4):
        for X in range(2, 14):
            c.P(X, 9 + j, K('soot', -1 + (X % 2) - (j > 1)))
    c.ell(8, 4.5, 2.2, 1.2, K('wood', -3))
    c.outline()


@piece('steam-soot-tree', '그을린 거리 나무(쇠 보호 격자)', 2, 3, kind='organic', line='B', solid=[(0, 2), (1, 2)], tags=['나무', '거리', '공원'])
def soot_tree(c):
    # 줄기·가지 + 짙은 녹색 잎 덩이(검댕에 그을린 색) + 아래 쇠 보호 격자(윗면 타원)
    for Y in range(26, 42):
        c.P(15, Y, K('wood', -1)); c.P(16, Y, K('wood', -2)); c.P(17, Y, K('wood', -3))
    for (x, y, r) in ((16, 15, 10), (8, 18, 6.5), (24, 19, 6.5), (12, 9, 6), (21, 9, 6), (16, 22, 6)):
        for Y in range(int(y - r) - 1, int(y + r) + 2):
            for X in range(int(x - r) - 1, int(x + r) + 2):
                dx, dy = X + .5 - x, Y + .5 - y; d = math.hypot(dx, dy)
                if d > r: continue
                lit = -(dx * .6 + dy * .8) / r
                rr = hv(X // 2, Y // 2, 3)
                tt = (1 if lit > .4 else (0 if lit > 0 else (-1 if lit > -.4 else -2))) + (1 if rr > .82 else 0) - (1 if rr < .12 else 0)
                c.P(X, Y, K('grass', tt - 1))
    for Y in range(40, 46):
        for X in range(5, 28):
            d = math.hypot((X + .5 - 16) / 11, (Y + .5 - 43) / 3)
            if d <= 1: c.P(X, Y, K('iron', 1 if (X + Y) % 2 else -1) if d > .55 else K('earth', -1))
    c.outline()

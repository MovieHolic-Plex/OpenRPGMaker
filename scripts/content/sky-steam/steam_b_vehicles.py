"""줄 B 탈것(옆모습, 동쪽을 봄). 지붕·보일러 윗면이 위에서 보이고(밝은 판 6줄+, 양 끝 둥글게 줄어듦) 옆면이 앞면."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def wheel(c, cx, cy, r, ramp='iron', spokes=6, phase=0.0, rim='brass'):
    """옆에서 본 바퀴: 테(놋쇠 빛) + 살 + 축."""
    for Y in range(int(cy - r) - 1, int(cy + r) + 2):
        for X in range(int(cx - r) - 1, int(cx + r) + 2):
            dx, dy = X + .5 - cx, Y + .5 - cy; d = math.hypot(dx, dy)
            if d > r: continue
            lit = -(dx * .6 + dy * .8) / max(d, .1)
            if d > r - 1.3: c.P(X, Y, K(ramp, 0 if lit > 0 else -2))
            elif d > r - 2.3: c.P(X, Y, K(rim, 2 if lit > .2 else (0 if lit > -.3 else -2)))
            else:
                a = math.atan2(dy, dx) - phase
                sp = abs(((a / (2 * math.pi)) * spokes) % 1 - .5) > (.38 if r >= 6 else .3)
                if r < 6: c.P(X, Y, K(ramp, -1 if lit > 0 else -2) if sp or d < 1.2 else K('soot', -3))
                else: c.P(X, Y, K(ramp, 0 if lit > 0 else -1) if sp else K('soot', -4))
    c.P(int(cx), int(cy), K('brass', 3)); c.P(int(cx) - 1, int(cy), K('brass', 1))


def roof_cap(c, x, y, w, rows, ramp, t=1, round_end=4):
    """탈것 지붕 윗면: 양 끝이 둥글게 줄어드는 판(가운데 밝은 띠), 앞 끝 입술."""
    for j in range(rows):
        ins = int(round(round_end * (1 - math.sqrt(max(0, 1 - ((rows - 1 - j) / max(rows - 1, 1)) ** 2))))) if round_end else 0
        ins = round_end - int(round(round_end * math.sin((j + 1) / rows * math.pi / 2)))
        for i in range(ins, w - ins):
            tt = t + (1 if j < rows // 2 else 0) + (1 if j == 1 else 0) - (1 if i > w - ins - 3 else 0)
            c.P(x + i, y + j, K(ramp, tt))
        c.P(x + ins - 1, y + j, OL); c.P(x + w - ins, y + j, OL)
    ins0 = round_end - int(round(round_end * math.sin(1 / rows * math.pi / 2)))
    c.HL(x + ins0, y - 1, w - 2 * ins0, OL)
    c.HL(x, y + rows - 1, w, K(ramp, t + 2))


@piece('steam-tram', '증기 전차(적갈·크림, 지붕 윗면)', 5, 3, kind='structure', line='B', solid=[(i, 2) for i in range(5)], tags=['전차', '탈것', '거리'])
def tram(c):
    W, H = 80, 48
    x0, w = 3, 74
    roof_cap(c, x0 + 2, 5, w - 4, 8, 'slate', 0, round_end=5)
    # 지붕 위 채광 덧지붕(작은 판)
    top_slab(c, x0 + 18, 3, w - 36, 3, 'slate', 2)
    # 몸통: 위 크림 창 띠 + 아래 적갈 판 + 놋쇠 띠
    by = 13
    for j in range(22):
        for i in range(w):
            col = K('canvas', 2 - (i > w - 4)) if j < 13 else K('red', -1 + (j < 15) - (i > w - 4))
            c.P(x0 + i, by + j, col)
    for k in range(7):
        wx = x0 + 5 + k * 10
        for j in range(2, 10):
            for i in range(7):
                c.P(wx + i, by + j, K('glass', 2 if j < 4 else (1 if j < 8 else 0)) if not (k in (2, 5) and j > 3) else K('fire', 3 if j < 6 else 2))
        c.P(wx + 1, by + 3, K('glass', 3)); c.P(wx + 2, by + 2, K('glass', 3))
    c.HL(x0, by + 13, w, K('brass', 3)); c.HL(x0, by + 14, w, K('brass', 0))
    for i in range(4, w - 4, 4): c.P(x0 + i, by + 18, K('red', 1))
    c.HL(x0, by + 21, w, K('red', -3))
    c.VL(x0, by, 22, K('canvas', 3)); c.VL(x0 + w - 1, by, 22, K('red', -3))
    # 앞 등(동쪽 끝) + 번호판 자리(무늬만)
    c.P(x0 + w - 2, by + 16, K('fire', 4)); c.P(x0 + w - 3, by + 16, K('fire', 3))
    # 바퀴 4
    for wx in (14, 26, 54, 66): wheel(c, wx, 40, 5.5, spokes=6)
    c.R(x0 + 4, 36, w - 8, 2, K('iron', -3))
    c.outline()


@piece('steam-locomotive', '증기 기관차(남쪽을 봄 — 보일러 윗면·연통·운전실)', 3, 5, kind='structure', line='B',
       solid=[(i, j) for i in range(3) for j in range(1, 5)], tags=['기차', '탈것', '철도', '세로 선로'])
def locomotive(c):
    """남쪽(화면 아래)을 보는 기관차: 위=운전실 지붕, 가운데=누운 보일러의 윗면(가운데 밝은 띠, 놋쇠 고리), 연통·증기 돔은 타원 아가리,
    아래=연기 상자 둥근 앞문 + 붉은 완충 보 + 배장기. 세로 선로(steam-t-rail 세로) 위에 놓는다."""
    W, H = 48, 80
    cx = 24
    # 운전실 지붕(윗면 12줄, 둥근 앞 모서리) + 운전실 앞벽(창 2)
    roof_cap(c, 6, 3, 36, 12, 'iron', 0, round_end=4)
    front(c, 7, 15, 34, 8, 'red', -1, mat='plain')
    arch_window(c, 10, 16, 7, 5, lit=True, arch=False, panes=(1, 1), sill=False)
    arch_window(c, 31, 16, 7, 5, lit=True, arch=False, panes=(1, 1), sill=False)
    # 발판(양옆 줄무늬 강판 윗면)
    tread(c, 6, 23, 36, 38, 'iron', 0, pw=8, ph=10, rivets=False)
    c.VL(5, 23, 38, OL); c.VL(42, 23, 38, OL)
    # 보일러 윗면(세로 띠: 가운데 밝음 → 양옆 어둠), 놋쇠 고리
    for Y in range(23, 62):
        for X in range(cx - 11, cx + 11):
            u = (X + .5 - cx) / 11
            tt = 2 if -.55 < u < -.05 else (1 if -.8 < u < .3 else (0 if u < .7 else -1))
            if u < -.85: tt = 0
            c.P(X, Y, K('iron', tt - 1))
        if (Y - 23) % 11 == 5:
            for X in range(cx - 11, cx + 11):
                u = (X + .5 - cx) / 11
                c.P(X, Y, K('brass', 3 if u < -.2 else (1 if u < .4 else -1))); c.P(X, Y + 1, K('brass', -2))
    c.VL(cx - 12, 23, 39, OL); c.VL(cx + 11, 23, 39, OL)
    # 증기 돔(놋쇠, 윗면 타원) + 연통(아가리) — 위에서 본 원통
    cylinder(c, cx - 5, 30, 10, 6, 4, 'brass', 0, bands=())
    cylinder(c, cx - 5, 46, 10, 6, 5, 'iron', -1, bands=(), open_top=True)
    # 연기 상자 앞문(남쪽 면: 둥근 판 + 경첩 + 전조등)
    for Y in range(60, 74):
        for X in range(cx - 11, cx + 11):
            d = math.hypot((X + .5 - cx) / 11, (Y + .5 - 67) / 7)
            if d <= 1: c.P(X, Y, K('iron', -1 if X < cx else -2) if d < .82 else K('iron', 0))
    c.HL(cx - 6, 67, 12, K('iron', 1)); c.P(cx, 67, K('brass', 3))
    c.ell(cx, 61, 3, 2, K('fire', 4)); c.P(cx - 1, 60, K('fire', 4))
    # 완충 보(붉은) + 완충기 2 + 배장기
    front(c, 4, 72, 40, 4, 'red', 0, mat='plain')
    for bx in (6, 38): c.ell(bx + 2, 74, 2, 1.5, K('brass', 2))
    for k in range(4): c.HL(cx - 10 + k * 2, 76 + k, 20 - k * 4, K('iron', -1 - (k > 1)))
    # 바퀴(양옆 아래로 살짝)
    for wy in (30, 44, 56):
        c.R(3, wy, 3, 8, K('iron', -3)); c.VL(3, wy + 1, 6, K('brass', 0))
        c.R(42, wy, 3, 8, K('iron', -4)); c.VL(44, wy + 1, 6, K('brass', -2))
    c.outline()


@piece('steam-coal-wagon', '석탄 화차(위에서 석탄이 보임)', 4, 2, kind='container', line='B', solid=[(i, 1) for i in range(4)], tags=['화차', '석탄', '철도'])
def coal_wagon(c):
    W, H = 64, 32
    x0, w = 3, 58
    # 테두리 윗면(나무 테) + 안쪽 석탄(아가리 안)
    for j in range(12):
        for i in range(w):
            edge = j < 2 or j > 9 or i < 2 or i > w - 3
            if edge: c.P(x0 + i, 2 + j, K('wood', 2 if j < 2 or i < 2 else 1))
            else:
                r = hv(i // 2, j, 3)
                tt = -3 + (1 if r > .55 else 0) + (1 if r > .85 else 0) + (1 if j < 6 else 0)
                c.P(x0 + i, 2 + j, K('soot', tt))
                if r > .93: c.P(x0 + i, 2 + j, K('iron', 1))
    c.HL(x0, 1, w, OL)
    front(c, x0, 14, w, 10, 'wood', -1, mat='plank', seed=4)
    for bx in (x0, x0 + w // 2 - 1, x0 + w - 2):
        c.VL(bx, 14, 10, K('iron', -1)); c.VL(bx + 1, 14, 10, K('iron', -3))
    c.R(x0 + 4, 24, w - 8, 2, K('iron', -3))
    for wx in (14, 26, 38, 50): wheel(c, wx, 27, 4, spokes=4)
    c.outline()


@piece('steam-carriage', '증기 자동차(남쪽을 봄 — 캔버스 덮개·놋쇠 보일러)', 2, 3, kind='structure', line='B',
       solid=[(0, 1), (1, 1), (0, 2), (1, 2)], tags=['자동차', '탈것', '거리'])
def carriage(c):
    W, H = 32, 48
    cx = 16
    # 뒤: 캔버스 덮개 윗면(크게) · 가운데: 좌석 방석 윗면 · 앞: 세운 보일러(타원 윗면) + 연통
    roof_cap(c, 3, 2, 26, 12, 'canvas', 0, round_end=4)
    front(c, 4, 14, 24, 3, 'canvas', -1, mat='plain')
    top_slab(c, 5, 18, 22, 7, 'red', 0)
    for X in (4, 27): c.VL(X, 14, 12, K('iron', -2))
    top_slab(c, 3, 25, 26, 5, 'red', -1)
    front(c, 3, 30, 26, 8, 'red', -1, mat='plain')
    c.HL(3, 32, 26, K('brass', 2))
    cylinder(c, cx - 5, 26, 10, 6, 8, 'brass', 0, bands=(4,))
    cylinder(c, cx - 2, 22, 4, 3, 5, 'iron', -1, bands=(), open_top=True)
    c.ell(7, 35, 2, 1.5, K('fire', 4)); c.ell(25, 35, 2, 1.5, K('fire', 4))
    for wx in (1, 28):
        c.R(wx, 34, 3, 10, K('iron', -3)); c.VL(wx + 1, 35, 8, K('brass', 0))
    c.outline()

"""줄 B 부두·기중기(비공정 부두 조각 — 줄 A 비공정 6×4 와 맞춘다)."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def rail_posts(c, x, y, w, step=6, h=5):
    """난간: 놋쇠 기둥 + 위 손잡이(윗면 1px 밝음)."""
    c.HL(x, y, w, K('brass', 3)); c.HL(x, y + 1, w, K('brass', 0))
    for i in range(0, w, step):
        c.VL(x + i, y + 2, h - 2, K('brass', 1)); c.VL(x + i + 1, y + 2, h - 2, K('brass', -2))


def taper_lattice(c, cx, y0, y1, wt, wb, ramp='iron', t=0, cell=8):
    """아래로 넓어지는 격자 탑(앞면): 양 다리 사선 + 가로보 + X 버팀."""
    def half(Y): return wt / 2 + (wb - wt) / 2 * (Y - y0) / max(y1 - y0, 1)
    for Y in range(y0, y1):
        hw = half(Y)
        for d, tt in ((0, 1), (1, -1)):
            c.P(int(round(cx - hw)) + d, Y, K(ramp, t + tt)); c.P(int(round(cx + hw)) - d, Y, K(ramp, t - 1 - d))
    for Y in range(y0, y1, cell):
        hw = half(Y); hw2 = half(min(Y + cell, y1 - 1))
        c.HL(int(round(cx - hw)), Y, int(2 * hw) + 1, K(ramp, t + 1)); c.HL(int(round(cx - hw)), Y + 1, int(2 * hw) + 1, K(ramp, t - 2))
        c.line(int(round(cx - hw)) + 1, Y + 1, int(round(cx + hw2)) - 1, min(Y + cell, y1 - 1), K(ramp, t - 1))
        c.line(int(round(cx + hw)) - 1, Y + 1, int(round(cx - hw2)) + 1, min(Y + cell, y1 - 1), K(ramp, t))


@piece('steam-mooring-mast', '비공정 계류탑(격자 탑·꼭대기 승강판)', 3, 9, kind='structure', line='B',
       solid=[(0, 8), (1, 8), (2, 8)], tags=['비공정', '부두', '계류'])
def mooring_mast(c):
    W, H = 48, 144
    # 받침: 팔각 콘크리트 받침(윗면 타원)
    oct_deck(c, 24, 130, 22, 7, rim=6, ramp='stone', t=1, rail=False)
    taper_lattice(c, 24, 34, 130, 14, 36, 'iron', 0, cell=10)
    pipe_v(c, 21, 36, 92, d=6, ramp='copper', flanges=(18, 48, 78))
    # 꼭대기: 팔각 승강판(윗면 타원 + 난간) + 계류 원뿔
    oct_deck(c, 24, 24, 22, 9, rim=5, ramp='iron', t=0, rail=True)
    for j in range(10):
        hw = 1 + j // 2
        for i in range(-hw, hw + 1): c.P(24 + i, 9 + j, K('brass', (2 if i < 0 else (0 if i == 0 else -2)) + (j < 2)))
    c.ell(24, 19.5, 5, 2, K('iron', -1)); c.HL(20, 19, 9, K('iron', 1))
    c.P(24, 7, K('red', 3)); c.P(24, 6, K('red', 4)); c.P(23, 8, K('red', 1)); c.P(25, 8, K('red', 0))
    c.outline()


@piece('steam-dock-deck', '비공정 부두 철판 승강장(난간·계류주)', 6, 4, kind='structure', line='B',
       solid=[(i, 3) for i in range(6)], tags=['비공정', '부두', '갑판'])
def dock_deck(c):
    """깊은 리벳 철판 윗면(걷는 칸 = 상대 y 1~2) + 앞면 격자 거더(구름 위로 매달림) + 뒤 놋쇠 난간 + 앞 계류주 2."""
    W, H = 96, 64
    x0, w = 2, 92
    dy, dh = 8, 30
    tread(c, x0, dy, w, dh, 'iron', 1, pw=23, ph=10)
    c.HL(x0, dy, w, K('iron', 3))
    c.HL(x0, dy - 1, w, OL); c.VL(x0 - 1, dy - 1, dh + 1, OL); c.VL(x0 + w, dy - 1, dh + 1, OL)
    c.HL(x0, dy + dh - 1, w, K('iron', 3))
    # 노란 경고 띠(앞 모서리 안쪽)
    for i in range(w):
        c.P(x0 + i, dy + dh - 3, K('brass', 3) if (i // 3) % 2 else K('iron', -3))
    # 뒤 난간 + 양옆 난간(앞뒤로 뻗는 손잡이 — 깊이 신호)
    rail_posts(c, x0, dy - 6, w, step=8, h=6)
    for X, tt in ((x0, 3), (x0 + w - 1, 0)):
        for Y in range(dy - 6, dy + dh - 6):
            c.P(X, Y, K('brass', tt))
        for Y in range(dy - 6, dy + dh - 6, 6):
            c.VL(X, Y, 6, K('brass', tt)); c.P(X, Y + 5, K('brass', -2))
    # 짐(상자 2 + 밧줄 더미) — 갑판 위 그림자
    for (bx, by) in ((30, 14), (40, 18)):
        shade_rect(c, bx + 3, by + 9, 10, 2, 1)
        box3(c, bx, by, 10, 4, 6, 'wood', 'wood', 0, mat='plank')
    # 앞면 거더(격자 트러스)
    fy = dy + dh
    c.R(x0, fy, w, 4, K('iron', -1)); c.HL(x0, fy, w, K('iron', -3)); c.HL(x0, fy + 3, w, K('iron', -3))
    for i in range(0, w, 3): c.P(x0 + i, fy + 1, K('iron', 1))
    for k in range(0, w - 11, 12):
        for q in range(12):
            c.P(x0 + k + q, fy + 4 + q, K('iron', 0)); c.P(x0 + k + 11 - q, fy + 4 + q, K('iron', -1))
    for k in range(0, w - 1, 12):
        c.VL(x0 + k, fy + 4, 12, K('iron', -1)); c.VL(x0 + k + 1, fy + 4, 12, K('iron', -3))
    c.VL(x0 + w - 2, fy + 4, 12, K('iron', -1)); c.VL(x0 + w - 1, fy + 4, 12, K('iron', -3))
    c.R(x0, fy + 16, w, 3, K('iron', -2)); c.HL(x0, fy + 16, w, K('iron', 0))
    # 계류주 2(윗면 있는 놋쇠 버섯)
    for bx in (12, 78):
        cylinder(c, bx, dy + 16, 6, 3, 5, 'brass', -1, bands=())
    c.outline()


@piece('steam-gantry-crane', '갠트리 기중기(레일 위 문형 기중기)', 6, 6, kind='frame', line='B',
       solid=[(0, 5), (5, 5)], tags=['기중기', '공장 마당', '부두'])
def gantry(c):
    W, H = 96, 96
    # 위 상자 보(윗면 6줄 + 앞면 8줄, 노란 경고색 띠)
    top_slab(c, 2, 8, 92, 6, 'brass', 0, tex='plate')
    front(c, 2, 14, 92, 9, 'brass', -1, mat='plain')
    for i in range(2, 94):
        if (i // 4) % 2 == 0: c.P(i, 18, K('iron', -3)); c.P(i, 19, K('iron', -3))
    for i in range(4, 92, 3): c.P(i, 15, K('brass', 2))
    # 다리(A 틀) 양쪽 — 윗면 보이는 바퀴 상자 위
    for lx in (8, 76):
        for Y in range(23, 82):
            f = (Y - 23) / 59
            a = int(lx + 4 - f * 6); b = int(lx + 8 + f * 6)
            for d, tt in ((0, 1), (1, -1)):
                c.P(a + d, Y, K('brass', tt)); c.P(b - d, Y, K('brass', tt - 1))
            if Y % 10 == 3: c.HL(a, Y, b - a, K('brass', 0)); c.HL(a, Y + 1, b - a, K('brass', -3))
        box3(c, lx - 4, 80, 20, 4, 8, 'iron', 'iron', 0)
        for wx in (lx - 1, lx + 9):
            c.ell(wx + 2.5, 91, 3, 3, K('iron', -1)); c.P(wx + 2, 90, K('iron', 2))
    # 운반차(트롤리) + 줄 + 갈고리 + 매달린 상자
    box3(c, 40, 4, 16, 4, 5, 'iron', 'iron', 0)
    for X in (45, 50): c.VL(X, 23, 30, K('iron', -2))
    c.HL(44, 53, 8, K('iron', 1)); c.P(47, 54, K('iron', 0)); c.P(48, 55, K('iron', -1)); c.P(48, 56, K('iron', -1)); c.P(47, 57, K('iron', -2))
    c.line(46, 57, 38, 62, K('canvas', 0)); c.line(49, 57, 58, 62, K('canvas', 0))
    box3(c, 36, 62, 24, 5, 10, 'wood', 'wood', 0, mat='plank')
    c.outline()


@piece('steam-dock-crane', '부두 회전 기중기(운전실·격자 팔)', 4, 6, kind='structure', line='B',
       solid=[(1, 5), (2, 5)], tags=['기중기', '부두'])
def dock_crane(c):
    W, H = 64, 96
    # 받침(원통 회전대) + 운전실(지붕 윗면) + 격자 팔(왼쪽 위로)
    box3(c, 14, 74, 36, 6, 14, 'stone', 'stone', 0, top_tex='stone', mat='stone')
    cylinder(c, 22, 66, 20, 6, 8, 'iron', 0, bands=(4,))
    # 운전실(우진각 철판 지붕)
    pyramid_roof(c, 18, 38, 30, 9, 'iron', 0, top_w=14)
    front(c, 20, 49, 26, 19, 'brass', -1, mat='plate')
    arch_window(c, 24, 53, 8, 6, lit=True, arch=False, panes=(2, 1), sill=False)
    arch_window(c, 35, 53, 8, 6, lit=False, arch=False, panes=(2, 1), sill=False)
    c.R(26, 61, 6, 7, K('iron', -3))
    chimney_stack(c, 40, 30, 4, 8, seed=4)
    # 격자 팔(사선, 오른쪽 아래 → 왼쪽 위)
    for k in range(40):
        x = 22 - k * 0.5; y = 44 - k
        c.P(int(x), int(y), K('iron', 1)); c.P(int(x) + 1, int(y), K('iron', 0)); c.P(int(x) + 5, int(y) + 2, K('iron', -1)); c.P(int(x) + 6, int(y) + 2, K('iron', -2))
        if k % 5 == 0: c.line(int(x) + 1, int(y), int(x) + 5, int(y) + 2, K('iron', 0))
        elif k % 5 == 2: c.line(int(x) + 1, int(y) + 2, int(x) + 5, int(y), K('iron', -1))
    # 끝 도르래 + 줄 + 갈고리
    c.ell(3.5, 4.5, 2.5, 2.5, K('brass', 1)); c.P(3, 4, K('brass', 3))
    c.VL(2, 7, 40, K('canvas', -1))
    c.P(2, 47, K('iron', 1)); c.P(3, 48, K('iron', 0)); c.P(3, 49, K('iron', -1)); c.P(2, 50, K('iron', -2))
    c.outline()

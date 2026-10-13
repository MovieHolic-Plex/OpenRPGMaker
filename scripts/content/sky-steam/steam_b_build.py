"""줄 B 큰 건물(structure). 칸 = 16px. 문 높이 22~26px, 층 높이 ~32px(캐릭터 24×32)."""
from __future__ import annotations
from steam_b_lib import *  # noqa: F401,F403
from steam_b_lib import hv, darken, shade_rect


def sawtooth_roof(c, x, y, w, teeth=3, slope=9, glass=5, lit_seed=0, vents=()):
    """톱날 지붕(남향 채광창): 위→아래로 [경사 지붕면(윗면) slope줄 + 유리 띠(앞면) glass줄] × teeth. 반환 = 끝 y.
    경사면 = 골함석(부드러운 골, 위 밝음), 유리 띠 = 창살 5px 칸, 불 켜진 칸은 연속 3~5칸 묶음만."""
    yy = y
    for k in range(teeth):
        for j in range(slope):
            for i in range(w):
                p = i % 4
                tt = (1 if j < slope // 2 else 0) + (1 if p == 0 else (-1 if p == 3 else 0))
                c.P(x + i, yy + j, K('slate', tt))
        c.HL(x, yy, w, K('slate', 3) if k else K('slate', 2))
        c.HL(x, yy + slope - 1, w, K('slate', 2))
        yy += slope
        c.HL(x, yy, w, K('iron', -3))
        litrun = [hv(i // 20, k, lit_seed) > .55 and (i // 5) % 4 != 3 for i in range(w)]
        for j in range(1, glass):
            for i in range(w):
                tt = (1 if j == 1 else 0) - (1 if j == glass - 1 else 0)
                c.P(x + i, yy + j, K('fire', tt + 2) if litrun[i] else K('glass', tt))
            for i in range(0, w, 5): c.P(x + i, yy + j, K('iron', -2))
        for i in range(3, w, 17):
            if not litrun[i]:
                for q in range(glass - 2): c.P(x + i + q, yy + glass - 2 - q, K('glass', 2))
        yy += glass
        c.HL(x, yy, w, K('slate', -3))
        yy += 1
    c.VL(x - 1, y - 1, yy - y + 1, OL); c.VL(x + w, y - 1, yy - y + 1, OL); c.HL(x - 1, y - 1, w + 2, OL)
    for vx, vk in vents:      # 지붕 환기통(작은 원통, 경사면 위)
        vy = y + vk * (slope + glass + 1) + 1
        cylinder(c, x + vx, vy - 4, 6, 3, 4, 'iron', 0, bands=())
    return yy


def pier(c, x, y, w, h, ramp='brick', t=0):
    """벽기둥(앞으로 튀어나온 벽돌 기둥): 왼쪽 빛 2·오른쪽 그림자 + 벽에 지는 그림자 1px, 위 돌 머리(윗면), 아래 돌 받침."""
    brick(c, x, y, w, h, ramp, t + 1, bw=3, bh=2, seed=7)
    c.VL(x, y, h, K(ramp, t + 3)); c.VL(x + 1, y, h, K(ramp, t + 2)); c.VL(x + w - 1, y, h, K(ramp, t - 2))
    for j in range(h):
        if c.op(x + w, y + j): c.P(x + w, y + j, K(ramp, t - 3))
    c.HL(x - 1, y - 2, w + 2, K('stone', 3)); c.HL(x - 1, y - 1, w + 2, K('stone', 1)); c.HL(x - 1, y, w + 2, K('stone', -1))
    c.HL(x - 1, y + h - 2, w + 2, K('stone', 1)); c.HL(x - 1, y + h - 1, w + 2, K('stone', -1))


def plinth_base(c, x, y, w, h=3):
    """돌 기단(벽 아래)."""
    for j in range(h): c.HL(x, y + j, w, K('stone', 1 if j == 0 else -1))
    for i in range(x, x + w, 7): c.VL(i, y + 1, h - 1, K('stone', -3))


def string_course(c, x, y, w):
    """돌 띠(층 구분): 윗면 밝음 + 아래 그림자."""
    c.HL(x, y, w, K('stone', 2)); c.HL(x, y + 1, w, K('stone', 0)); c.HL(x, y + 2, w, K('brick', -3))


def sawtooth_ns(c, x, w, yv, teeth=4, rise=12, depth=26, seed=0):
    """남북 톱날 지붕: 앞 박공 윗선이 톱니(골 yv, 마루 yv-rise) 모양, 지붕면은 그 위로 depth 줄(뒤로 물러나는 면).
    지붕면 = 서향 경사(빛), 비스듬한 골함석 줄(경사 방향), 마루 쪽 2px 유리띠. 반환: 열별 박공 윗선 g(x)."""
    tw = w / teeth
    g = {}
    for i in range(w):
        k = int(i // tw); u = (i - k * tw) / tw
        g[i] = int(round(yv - rise * u))
    for i in range(w):
        k = int(i // tw); u = (i - k * tw) / tw
        top = g[i] - depth
        for j in range(top, g[i]):
            d = j - top                                    # 뒤에서부터 거리
            line = (d + int(round(rise * u))) % 4          # 경사 따라 비스듬한 골(4줄마다 어두운 골 + 그 위 밝은 등)
            tt = (1 if d < depth * .4 else 0) + (1 if u < .5 else 0) + (-2 if line == 3 else (1 if line == 0 else 0))
            if u > .9: tt = None                           # 마루 유리띠
            c.P(x + i, j, K('slate', tt) if tt is not None else K('glass', 2 if (j // 3) % 2 else 1))
        c.P(x + i, top - 1, OL)
        if u > .9 or u < .03: c.P(x + i, top, K('slate', 3))
    # 마루 수직 모서리(유리 끝) 윤곽 · 골 이음 그림자
    for k in range(1, teeth):
        i = int(round(k * tw))
        for j in range(g[i] - depth, g[i - 1] - depth + 1): c.P(x + i, j, OL)
        for j in range(g[i - 1] - depth, g[i - 1]): c.P(x + i - 1, j, K('glass', -1))
    return {x + i: g[i] for i in range(w)}


@piece('steam-factory-hall', '벽돌 공장 본관(우진각 지붕·채광 지붕창)', 8, 7, kind='structure', line='B',
       solid=[(i, j) for i in range(8) for j in range(1, 7) if not (j == 6 and i in (3, 4))], tags=['공장', '벽돌', '지붕창'])
def factory_hall(c):
    W, H = 128, 112
    x0, w = 2, 124
    ry, rh, hip = 10, 40, 12
    roof_slate(c, x0, ry, w, rh, 'slate', 0, course=3, hip=hip, seed=2)
    # 용마루 채광창(모니터): 작은 상자 — 윗면 판 + 앞 유리 띠
    mx, mw = x0 + hip + 14, w - 2 * hip - 28
    top_slab(c, mx, ry + 2, mw, 5, 'slate', 1)
    for j in range(5):
        for i in range(mw):
            lit = (i // 6) % 3 == 1
            c.P(mx + i, ry + 7 + j, K('fire', 3 - (j > 2)) if lit else K('glass', 1 - (j > 2)))
        for i in range(0, mw, 6): c.P(mx + i, ry + 7 + j, K('iron', -2))
    c.VL(mx - 1, ry + 7, 5, OL); c.VL(mx + mw, ry + 7, 5, OL)
    c.HL(mx - 1, ry + 12, mw + 2, K('slate', -3))
    chimney_stack(c, 100, 0, 10, 16, seed=4)
    wy = ry + rh + 2
    brick(c, x0, wy, w, H - 1 - wy, 'brick', 0, seed=13, soot=1.2)
    eaves_shadow(c, x0, wy, w, 3)
    # 모서리 돌 귓돌(quoin)
    for j in range(wy, H - 4, 4):
        for (qx, qw) in ((x0, 4 if (j // 4) % 2 else 6), (x0 + w - (4 if (j // 4) % 2 else 6), 4 if (j // 4) % 2 else 6)):
            c.R(qx, j, qw, 3, K('stone', 1)); c.HL(qx, j, qw, K('stone', 2)); c.HL(qx, j + 3, qw, K('stone', -2))
    for k, cx in enumerate((22, 46, 82, 106)):
        arch_window(c, cx - 6, wy + 8, 12, 24, lit=(k in (1, 3)), panes=(2, 4), seed=k + 20)
    # 가운데 큰 아치 문(사람 칸)
    door_double(c, 54, wy + 32, 20, H - 1 - wy - 36)
    for i in range(-4, 24):
        d = abs(i - 9.5)
        c.P(54 + i, wy + 29 + int(d * d / 40), K('stone', 2 if i % 3 else 3))
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-boilerhouse', '보일러실(벽돌·짧은 굴뚝)', 5, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(5) for j in range(1, 6) if not (j == 5 and i == 2)], tags=['보일러', '벽돌'])
def boilerhouse(c):
    W = 80
    chimney_stack(c, 54, 0, 12, 22, seed=5)
    # 평지붕(타르 + 난간 윗면) — 깊은 윗면
    rx, ry, rw, rh = 2, 16, W - 4, 22
    top_slab(c, rx, ry, rw, rh, 'slate', -2, tex='tar', seed=2)
    # 난간(파라펫) 윗면 테두리
    for i in range(rw): c.P(rx + i, ry, K('stone', 2)); c.P(rx + i, ry + 1, K('stone', 1))
    for j in range(rh): c.P(rx, ry + j, K('stone', 2)); c.P(rx + rw - 1, ry + j, K('stone', 0))
    # 지붕 위 환기통(작은 상자) + 지붕 맨홀
    box3(c, 10, ry + 4, 12, 5, 6, 'iron', 'iron', 0, top_tex='grate')
    cylinder(c, 30, ry + 5, 8, 4, 7, 'copper', 0, bands=(3,))
    chimney_stack(c, 54, 0, 12, 22, seed=5)
    wy = ry + rh
    c.HL(rx, wy - 1, rw, K('stone', 2))
    wh = 96 - 1 - wy
    brick(c, 2, wy, W - 4, wh, 'brick', -1, seed=21, soot=1.5)
    eaves_shadow(c, 2, wy, W - 4, 2)
    string_course(c, 2, wy + 3, W - 4)
    # 큰 아치 문(보일러 들이는 문) — 가운데
    door_double(c, 30, wy + 31, 20, 25)
    for i in range(-3, 23): c.P(29 + i - 0, wy + 28, K('stone', 1 if i % 3 else 2))
    arch_window(c, 8, wy + 14, 12, 14, lit=True, panes=(2, 3))
    arch_window(c, 60, wy + 14, 12, 14, lit=True, panes=(2, 3))
    # 벽을 뚫고 나온 증기관 + 밸브
    pipe_h(c, 2, wy + 40, 22, d=4, ramp='copper', flanges=(8,))
    pipe_h(c, 56, wy + 40, 22, d=4, ramp='copper', flanges=(12,))
    plinth_base(c, 2, 93, W - 4)
    c.outline()


@piece('steam-clocktower', '시계탑(놋쇠 톱니 시계판)', 4, 9, kind='structure', line='B',
       solid=[(i, j) for i in range(4) for j in range(2, 9) if not (j == 8 and i in (1, 2))], tags=['시계탑', '랜드마크', '톱니'])
def clocktower(c):
    W, H = 64, 144
    x0, w = 8, 48
    # 첨탑 지붕(우진각 피라미드, 슬레이트) + 꼭대기 놋쇠 침
    ry, rh = 14, 26
    for j in range(rh):
        ins = int((rh - 1 - j) * 20 / rh)
        for i in range(ins, w - ins):
            k = j % 3
            left = i < w / 2
            tt = (1 if left else -1) + (1 if k == 0 else (-1 if k == 2 else 0)) + (1 if i < ins + 3 else 0) - (1 if i > w - ins - 4 else 0)
            if (i + (j // 3) * 2) % 5 == 0 and k != 0: tt -= 1
            c.P(x0 + i, ry + j, K('slate', tt))
        c.P(x0 + ins - 1, ry + j, OL); c.P(x0 + w - ins, ry + j, OL)
    c.HL(x0 + 20, ry - 1, w - 40, OL)
    for j in range(0, ry):      # 침
        c.P(31, j + 2, K('brass', 3 if j % 4 else 1)); c.P(32, j + 2, K('brass', 0))
    c.P(30, 8, K('brass', 2)); c.P(33, 8, K('brass', -1)); c.HL(29, 12, 6, K('brass', 1)); c.HL(29, 13, 6, K('brass', -2))
    # 처마(놋쇠 띠)
    c.HL(x0 - 2, ry + rh, w + 4, K('brass', 3)); c.HL(x0 - 2, ry + rh + 1, w + 4, K('brass', 0)); c.HL(x0 - 2, ry + rh + 2, w + 4, K('brass', -3))
    c.VL(x0 - 3, ry + rh, 3, OL); c.VL(x0 + w + 2, ry + rh, 3, OL)
    # 시계 층(벽돌 + 큰 시계판)
    ty = ry + rh + 3
    brick(c, x0, ty, w, H - 1 - ty, 'brick', 0, bw=5, bh=2, seed=31, soot=.8)
    eaves_shadow(c, x0, ty, w, 2)
    for j in range(ty, H - 4, 4):     # 모서리 귓돌
        q = 4 if (j // 4) % 2 else 6
        for qx in (x0, x0 + w - q):
            c.R(qx, j, q, 3, K('stone', 1)); c.HL(qx, j, q, K('stone', 2)); c.HL(qx, j + 3, q, K('stone', -2))
    ccx, ccy, cr = 32, ty + 19, 15
    for Y in range(ccy - cr - 2, ccy + cr + 3):          # 시계판 테(놋쇠) + 판(크림)
        for X in range(ccx - cr - 2, ccx + cr + 3):
            d = math.hypot(X + .5 - ccx, Y + .5 - ccy)
            if d <= cr + 2:
                lit = -((X + .5 - ccx) * .6 + (Y + .5 - ccy) * .8) / max(d, .1)
                if d > cr: c.P(X, Y, K('brass', 2 if lit > .2 else (0 if lit > -.3 else -2)))
                elif d > cr - 1: c.P(X, Y, K('brass', -3))
                else: c.P(X, Y, K('canvas', 3 if lit > 0 else 2))
    for h in range(12):           # 시간 눈금
        a = h / 12 * 2 * math.pi
        for rr in ((cr - 3, cr - 2) if h % 3 else (cr - 4, cr - 3, cr - 2)):
            c.P(int(ccx + math.sin(a) * rr), int(ccy - math.cos(a) * rr), K('iron', -3))
    gear(c, ccx, ccy, 6, teeth=8, ramp='brass', t=0, spokes=0, hub=False)      # 가운데 톱니
    c.line(ccx, ccy, ccx + 6, ccy - 6, K('iron', -4)); c.line(ccx, ccy, ccx - 1, ccy - 10, K('iron', -4))
    c.P(ccx, ccy, K('brass', 4))
    # 아래층: 아치 창 2 + 문
    string_course(c, x0, ty + 40, w)
    arch_window(c, 14, ty + 48, 8, 16, lit=True, panes=(2, 3), seed=3)
    arch_window(c, 42, ty + 48, 8, 16, lit=False, panes=(2, 3), seed=4)
    door_double(c, 26, H - 1 - 28, 12, 24)
    for i in range(-2, 14): c.P(26 + i, H - 1 - 31 + int(abs(i - 5.5) ** 2 / 12), K('stone', 2 if i % 3 else 3))
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-chimney-tall', '공장 큰 굴뚝(벽돌 기둥)', 2, 8, kind='column', line='B', solid=[(0, 7), (1, 7)], tags=['굴뚝', '공장'])
def chimney_tall(c):
    """굵은 원형 벽돌 굴뚝: 위 아가리(윗면 타원·검댕 속), 쇠테 3개, 아래 돌 받침(윗면)."""
    W, H = 32, 128
    cx = 16
    for Y in range(8, 116):
        f = (Y - 8) / 108
        rw = 7 + f * 3.5                                  # 아래로 굵어짐
        for X in range(int(cx - rw), int(cx + rw) + 1):
            u = (X + .5 - cx) / rw
            if abs(u) > 1: continue
            row = (Y // 3); off = (row % 2) * 2
            mortar = (Y % 3 == 2) or ((X + off) % 4 == 3)
            tt = (1 if -.75 < u < -.25 else (0 if u < .35 else (-1 if u < .75 else -2)))
            if Y < 30: tt -= 1                            # 위쪽 그을음
            if Y < 18: tt -= 1
            c.P(X, Y, K('brick', tt - 3 if mortar else tt + (1 if (Y % 3 == 0 and not mortar) else 0)))
    for by in (16, 52, 88):           # 쇠테
        for X in range(5, 28):
            if c.op(X, by):
                u = (X + .5 - cx) / 10
                c.P(X, by, K('iron', 2 if u < -.2 else (0 if u < .4 else -2))); c.P(X, by + 1, K('iron', -3))
    # 아가리(윗면)
    for Y in range(2, 10):
        for X in range(6, 27):
            u = (X + .5 - cx) / 10; v = (Y + .5 - 6) / 4
            if u * u + v * v <= 1:
                inner = (u / .7) ** 2 + ((Y + .5 - 5.6) / 2.6) ** 2 <= 1
                c.P(X, Y, K('soot', -4) if inner else K('stone', 2 if v < 0 else 0))
    # 받침(돌 윗면 + 앞면)
    top_slab(c, 2, 112, 28, 6, 'stone', 1, tex='stone', seed=4)
    front(c, 2, 118, 28, 9, 'stone', 0, mat='stone', seed=5)
    for Y in range(108, 112):
        for X in range(5, 28):
            if c.op(X, Y): pass
    c.outline()


@piece('steam-tenement', '벽돌 공동주택(맨사드 지붕·지붕창)', 5, 8, kind='structure', line='B',
       solid=[(i, j) for i in range(5) for j in range(2, 8) if not (j == 7 and i == 2)], tags=['주택', '벽돌', '3층'])
def tenement(c):
    W, H = 80, 128
    x0, w = 2, 76
    # 맨사드 지붕: 윗면(평평한 위판) + 가파른 앞 경사(슬레이트) + 지붕창 2
    top_slab(c, x0 + 4, 8, w - 8, 8, 'slate', 0, tex='plate')
    for j in range(18):
        ins = max(0, 4 - j // 4)
        for i in range(ins, w - ins):
            k = j % 3
            tt = (1 if k == 0 else (-1 if k == 2 else 0)) + (0 if i > 6 else 1) - (1 if i > w - 7 else 0)
            if (i + (j // 3) * 2) % 5 == 0 and k: tt -= 1
            c.P(x0 + i, 16 + j, K('slate', tt))
        c.P(x0 + ins - 1, 16 + j, OL); c.P(x0 + w - ins, 16 + j, OL)
    chimney_stack(c, 12, 0, 8, 6, seed=8); chimney_stack(c, 60, 0, 8, 6, seed=9)
    for dx in (18, 52):       # 지붕창(작은 박공)
        for j in range(5):
            c.HL(x0 + dx - 6 + j, 14 + j - 0, 12 - 2 * j + 0, K('slate', 2 - (j > 2)))
        c.R(x0 + dx - 4, 19, 8, 11, K('stone', 1)); arch_window(c, x0 + dx - 3, 21, 6, 8, lit=(dx == 18), arch=False, panes=(2, 2), sill=False, seed=dx)
    c.HL(x0 - 1, 34, w + 2, K('stone', 3)); c.HL(x0 - 1, 35, w + 2, K('stone', 0)); c.HL(x0 - 1, 36, w + 2, K('brick', -3))
    wy = 37
    brick(c, x0, wy, w, H - 1 - wy, 'brick', -1, seed=41, soot=.8)
    # 2·3층 창 3개씩
    for fl, yy in enumerate((wy + 5, wy + 33)):
        for k, cx in enumerate((14, 40, 66)):
            arch_window(c, cx - 5, yy, 10, 16, lit=((fl + k) % 3 == 0), panes=(2, 3), seed=fl * 3 + k)
        string_course(c, x0, yy + 23, w)
    # 1층: 가게 앞(목재 쇼윈도 + 차양) + 계단 입구
    gy = wy + 61
    c.R(x0 + 2, gy, 44, H - 5 - gy, K('wood', -2)); c.HL(x0 + 2, gy, 44, K('wood', 1))
    arch_window(c, x0 + 5, gy + 6, 16, 14, lit=True, arch=False, panes=(3, 2), sill=False, frame='wood', seed=61)
    door_shop(c, x0 + 26, gy + 5, 10, H - 5 - gy - 5)
    # 차양(줄무늬 천, 윗면 보임)
    for j in range(5):
        for i in range(-1, 47):
            band = (i // 4) % 2
            c.P(x0 + 1 + i, gy - 3 + j, K('red' if band else 'canvas', (1 if j < 2 else 0) - (j == 4)))
    c.HL(x0, gy + 2, 48, K('red', -2))
    for i in range(0, 48, 4): c.P(x0 + 1 + i, gy + 2, K('red', -3)); c.P(x0 + 3 + i, gy + 2, K('canvas', 0))
    door_double(c, 58, gy + 3, 12, H - 5 - gy - 3)
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-workshop', '발명가 공방(박공 앞면·톱니 간판)', 5, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(5) for j in range(1, 6) if not (j == 5 and i == 2)], tags=['공방', '가게', '박공'])
def workshop(c):
    W, H = 80, 96
    x0, x1 = 2, 78
    def wall(cc, clip): planks(cc, x0, 10, x1 - x0, 40, 'wood', 0, pw=4, clip=clip, seed=5)
    rake = gable_front(c, x0, x1, 20, 44, 18, 'slate', 0, wall=wall)
    # 박공 둥근 창(톱니 테)
    gear(c, 40, 34, 6, teeth=10, ramp='brass', t=0, spokes=0, hub=False)
    for Y in range(30, 39):
        for X in range(36, 45):
            if math.hypot(X + .5 - 40, Y + .5 - 34) < 4: c.P(X, Y, K('fire', 3 if Y < 34 else 2))
    c.VL(40, 30, 9, K('wood', -3)); c.HL(36, 34, 9, K('wood', -3))
    wy = 47
    brick(c, x0, wy, x1 - x0, H - 1 - wy, 'brick', 0, seed=51, soot=.5)
    eaves_shadow(c, x0, wy, x1 - x0, 2)
    # 큰 진열창(놋쇠 틀) + 문
    arch_window(c, 8, wy + 8, 26, 18, lit=True, arch=False, panes=(4, 2), frame='brass', seed=12)
    door_shop(c, 44, wy + 21, 11, H - 5 - wy - 21)
    arch_window(c, 62, wy + 18, 10, 12, lit=False, panes=(2, 2), seed=13)
    # 톱니 간판(벽에서 튀어나온 쇠팔에 매달림)
    c.HL(56, wy + 2, 16, K('iron', 1)); c.HL(56, wy + 3, 16, K('iron', -2)); c.P(56, wy + 4, K('iron', -1))
    c.VL(67, wy + 4, 2, K('iron', -1))
    gear(c, 67, wy + 11, 5, teeth=8, ramp='brass', t=0, spokes=3)
    pipe_v(c, 4, wy + 2, H - 7 - wy, d=3, ramp='copper', flanges=(10,))
    plinth_base(c, x0, H - 4, x1 - x0)
    c.outline()


@piece('steam-inn', '증기 여관(반목조·우진각 지붕·간판)', 6, 7, kind='structure', line='B',
       solid=[(i, j) for i in range(6) for j in range(2, 7) if not (j == 6 and i in (2, 3))], tags=['여관', '주점', '반목조'])
def inn(c):
    W, H = 96, 112
    x0, w = 2, 92
    roof_slate(c, x0, 12, w, 30, 'red', -1, course=3, hip=10, seed=4)
    chimney_stack(c, 20, 2, 8, 10, seed=12)
    chimney_stack(c, 70, 0, 8, 12, seed=13)
    # 지붕창(작은 박공 + 불 켜진 창) 2개
    for dx in (32, 58):
        dormer(c, x0 + dx, 22, 12, roof='red', wall='canvas', lit=True)
    wy = 44
    # 2층: 회벽 + 목재 기둥/가새(반목조)
    for j in range(wy, wy + 30):
        for i in range(w):
            c.P(x0 + i, j, K('canvas', 2 if (i * 3 + j * 5) % 23 else 1))
    for bx in range(0, w, 15):
        c.R(x0 + bx, wy, 3, 30, K('wood', -1)); c.VL(x0 + bx, wy, 30, K('wood', 0)); c.VL(x0 + bx + 2, wy, 30, K('wood', -3))
    for bx in range(0, w - 15, 30):
        for k in range(12):
            c.P(x0 + bx + 3 + k, wy + 29 - k * 2, K('wood', -1)); c.P(x0 + bx + 3 + k, wy + 28 - k * 2, K('wood', -1))
    eaves_shadow(c, x0, wy, w, 2, 'canvas', 1)
    for k, cx in enumerate((24, 54, 84)):
        arch_window(c, cx - 5, wy + 8, 10, 12, lit=(k != 1), arch=False, panes=(2, 2), frame='wood', seed=70 + k)
    c.HL(x0, wy + 30, w, K('wood', 1)); c.HL(x0, wy + 31, w, K('wood', -1)); c.HL(x0, wy + 32, w, K('wood', -3))
    # 1층: 벽돌 + 넓은 출입문 + 둥근 퇴창
    gy = wy + 33
    brick(c, x0, gy, w, H - 1 - gy, 'brick', 0, seed=71, soot=.3)
    eaves_shadow(c, x0, gy, w, 2)
    door_double(c, 38, gy + 9, 18, H - 5 - gy - 9)
    arch_window(c, 9, gy + 7, 20, 14, lit=True, panes=(4, 2), seed=81)
    arch_window(c, 66, gy + 7, 20, 14, lit=True, panes=(4, 2), seed=82)
    # 매달린 간판(술잔 그림, 글자 없음)
    c.HL(56, gy + 1, 14, K('iron', 1)); c.HL(56, gy + 2, 14, K('iron', -2))
    c.R(60, gy + 4, 10, 9, K('wood', 1)); c.HL(60, gy + 4, 10, K('wood', 2)); c.VL(69, gy + 4, 9, K('wood', -2)); c.HL(60, gy + 12, 10, K('wood', -3))
    c.R(62, gy + 6, 4, 5, K('brass', 2)); c.VL(66, gy + 7, 3, K('brass', 1)); c.HL(62, gy + 6, 4, K('canvas', 4))
    for X in (60, 69): c.P(X, gy + 3, K('iron', 0))
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-warehouse', '골함석 창고(하역 도르래 보)', 6, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(6) for j in range(1, 6) if not (j == 5 and i in (2, 3))], tags=['창고', '골함석', '항구'])
def warehouse(c):
    W, H = 96, 96
    x0, x1 = 2, 94
    def wall(cc, clip): corrugated(cc, x0, 0, x1 - x0, 60, 'iron', 0, period=3, clip=clip)
    gable_front(c, x0, x1, 18, 40, 16, 'slate', -1, trim='iron', wall=wall)
    # 하역 문(박공 안) + 도르래 보
    c.R(41, 28, 14, 12, K('wood', -2)); c.HL(41, 28, 14, K('wood', 0)); planks(c, 42, 29, 12, 11, 'wood', -1, pw=3)
    c.HL(44, 21, 8, K('iron', 1)); c.HL(44, 22, 8, K('iron', -2))
    c.VL(51, 23, 9, K('canvas', 1)); c.P(50, 32, K('iron', 1)); c.P(51, 32, K('iron', 0)); c.P(52, 32, K('iron', -1))
    wy = 43
    corrugated(c, x0, wy, x1 - x0, H - 1 - wy, 'iron', -1, period=3)
    eaves_shadow(c, x0, wy, x1 - x0, 2, 'iron', 0)
    # 기둥(H형강) 4개
    for bx in (x0, 30, 64, x1 - 3):
        c.R(bx, wy, 3, H - 1 - wy, K('iron', -1)); c.VL(bx, wy, H - 1 - wy, K('iron', 1)); c.VL(bx + 2, wy, H - 1 - wy, K('iron', -3))
        for j in range(wy + 2, H - 2, 4): c.P(bx + 1, j, K('iron', 3))
    slide_door(c, 34, wy + 7, 28, H - 1 - wy - 10)
    arch_window(c, 10, wy + 6, 14, 8, lit=False, arch=False, panes=(3, 1), seed=3)
    arch_window(c, 70, wy + 6, 14, 8, lit=True, arch=False, panes=(3, 1), seed=4)
    c.R(x0, H - 4, x1 - x0, 3, K('stone', 0)); c.HL(x0, H - 4, x1 - x0, K('stone', 2))
    c.outline()


@piece('steam-gasholder', '가스 저장탑(원통 + 쇠 기둥 틀)', 5, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(5) for j in range(2, 6)], tags=['가스', '탱크', '공장'])
def gasholder(c):
    W, H = 80, 96
    cylinder(c, 8, 10, 64, 18, 66, 'iron', 0, bands=(14, 30, 46, 60), lid=True)
    # 윗면 가운데 판 + 맨홀
    for X in range(34, 46):
        for Y in range(16, 21):
            if ((X + .5 - 40) / 6) ** 2 + ((Y + .5 - 18.5) / 2.5) ** 2 <= 1: c.P(X, Y, K('iron', 1))
    c.HL(37, 18, 6, K('iron', -2))
    # 바깥 쇠 기둥 틀(앞 기둥 5개 + 가로 띠 2개)
    for k, bx in enumerate((4, 20, 38, 56, 72)):
        top = 6 if k in (0, 4) else 4
        for Y in range(top, H - 4):
            if True:
                c.P(bx, Y, K('iron', 2)); c.P(bx + 1, Y, K('iron', 0)); c.P(bx + 2, Y, K('iron', -2))
        c.R(bx - 1, top - 2, 5, 2, K('iron', 3)); c.HL(bx - 1, top - 2, 5, K('iron', 4))
    for by in (26, 58):
        c.HL(4, by, 71, K('iron', 1)); c.HL(4, by + 1, 71, K('iron', -3))
        for k in range(4):
            x0 = (4, 20, 38, 56)[k]; x1 = (20, 38, 56, 72)[k]
            for i in range(x1 - x0):
                yy = by + 2 + int(i * 26 / max(x1 - x0, 1)) if by == 26 else None
                if yy is not None and yy < 58: c.P(x0 + 2 + i, yy, K('iron', -1))
    top_slab(c, 2, H - 10, 76, 4, 'stone', 1, taper=.5)
    front(c, 2, H - 6, 76, 5, 'stone', -1, mat='stone')
    c.outline()


@piece('steam-pumphouse', '양수 펌프 오두막(벽돌·관)', 3, 4, kind='structure', line='B',
       solid=[(i, j) for i in range(3) for j in range(1, 4) if not (j == 3 and i == 1)], tags=['펌프', '벽돌', '소형'])
def pumphouse(c):
    W, H = 48, 64
    x0, x1 = 2, 46
    def wall(cc, clip): brick(cc, x0, 0, x1 - x0, 40, 'brick', 0, bw=4, seed=91, clip=clip)
    gable_front(c, x0, x1, 13, 26, 11, 'slate', 0, trim='wood', wall=wall)
    c.R(21, 18, 6, 5, K('glass', 0)); c.HL(21, 18, 6, K('glass', 2)); c.VL(24, 18, 5, K('iron', -2))
    wy = 29
    brick(c, x0, wy, x1 - x0, H - 1 - wy, 'brick', 0, bw=4, seed=92, soot=.4)
    eaves_shadow(c, x0, wy, x1 - x0, 2)
    door_double(c, 18, wy + 8, 12, H - 5 - wy - 8, arch=True)
    pipe_h(c, x0, wy + 5, 14, d=4, ramp='copper', flanges=(6,))
    pipe_h(c, 32, wy + 5, 14, d=4, ramp='copper', flanges=(5,))
    gear(c, 9, wy + 19, 4, teeth=8, ramp='brass', t=0, spokes=3)
    plinth_base(c, x0, H - 4, x1 - x0)
    c.outline()


@piece('steam-watertower', '급수탑(리벳 물탱크 + 벽돌 탑)', 3, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(3) for j in range(3, 6)], tags=['급수탑', '철도', '탱크'])
def watertower(c):
    W, H = 48, 96
    # 물탱크(리벳 철, 윗면 원뿔 지붕)
    for j in range(10):          # 원뿔 지붕(윗면)
        hw = 3 + j * 2
        for i in range(-hw, hw + 1):
            tt = (1 if i < -hw / 3 else (0 if i < hw / 3 else -1)) + (1 if j < 4 else 0)
            c.P(24 + i, 2 + j, K('slate', tt))
    c.P(24, 1, K('brass', 3))
    cylinder(c, 3, 10, 42, 8, 30, 'copper', -1, bands=(4, 14, 24))
    for j in range(10): pass
    c.HL(2, 12, 44, K('slate', 1)); c.HL(2, 13, 44, K('slate', -2))
    # 급수 주둥이(옆으로)
    pipe_h(c, 40, 34, 7, d=3, ramp='iron', flanges=())
    c.VL(46, 36, 6, K('iron', -1))
    # 벽돌 탑(아래)
    ty = 50
    brick(c, 8, ty, 32, H - 1 - ty, 'brick', 0, bw=4, seed=101, soot=.6)
    c.HL(6, ty - 1, 36, K('stone', 2)); c.HL(6, ty, 36, K('stone', 0))
    door_double(c, 18, H - 5 - 24, 12, 24, arch=True)
    plinth_base(c, 8, H - 4, 32)
    c.outline()


@piece('steam-lab', '발명가 연구소(구리 돔 천문대)', 5, 7, kind='structure', line='B',
       solid=[(i, j) for i in range(5) for j in range(2, 7) if not (j == 6 and i == 2)], tags=['연구소', '돔', '천문대'])
def lab(c):
    W, H = 80, 112
    # 평지붕(깊은 윗면: 판석 + 난간 갓돌) 위에 녹청 구리 돔
    rx0, ry0, rw, rh = 4, 22, 72, 24
    top_slab(c, rx0, ry0, rw, rh, 'stone', 0, tex='stone', seed=7)
    for i in range(rw): c.P(rx0 + i, ry0, K('stone', 3)); c.P(rx0 + i, ry0 + 1, K('stone', 2))
    for j in range(rh): c.P(rx0, ry0 + j, K('stone', 3)); c.P(rx0 + 1, ry0 + j, K('stone', 2)); c.P(rx0 + rw - 1, ry0 + j, K('stone', 0)); c.P(rx0 + rw - 2, ry0 + j, K('stone', 1))
    c.HL(rx0 + 2, ry0 + 2, rw - 4, K('stone', -2)); c.VL(rx0 + 2, ry0 + 2, rh - 3, K('stone', -2))
    dome(c, 40, 36, 22, 20, 'patina', 0, ribs=8)
    for Y in range(17, 36):
        for X in range(37, 43):
            if c.op(X, Y): c.P(X, Y, K('soot', -3) if X < 42 else K('soot', -2))
    for i in range(10): c.P(41 + i // 2, 20 - i, K('brass', 2)); c.P(42 + i // 2, 20 - i, K('brass', 0))
    # 지붕 위 작은 상자(환기통)
    box3(c, 64, ry0 + 6, 7, 4, 5, 'iron', 'iron', 0)
    c.HL(rx0, ry0 + rh - 1, rw, K('stone', 3))
    wy = ry0 + rh
    brick(c, 6, wy, 68, H - 1 - wy, 'brick', -1, seed=111, soot=.4)
    c.HL(rx0, wy, rw, K('stone', 0)); c.HL(rx0, wy + 1, rw, K('brick', -3))
    for j in range(wy + 2, H - 4, 4):
        q = 4 if (j // 4) % 2 else 6
        for qx in (6, 74 - q):
            c.R(qx, j, q, 3, K('stone', 1)); c.HL(qx, j, q, K('stone', 2)); c.HL(qx, j + 3, q, K('stone', -2))
    # 둥근 창(포트홀) 3 + 문
    for cx in (22, 40, 58):
        for Y in range(wy + 4, wy + 16):
            for X in range(cx - 6, cx + 6):
                d = math.hypot(X + .5 - cx, Y + .5 - wy - 10)
                if d <= 6: c.P(X, Y, K('brass', 2 if X < cx else -1) if d > 4.6 else K('fire' if cx == 40 else 'glass', 3 if Y < wy + 9 else 1))
    wy -= 2
    string_course(c, 6, wy + 22, 68)
    door_double(c, 33, H - 5 - 24, 14, 24)
    arch_window(c, 13, wy + 30, 12, 13, lit=True, panes=(2, 3), seed=5)
    arch_window(c, 55, wy + 30, 12, 13, lit=False, panes=(2, 3), seed=6)
    # 테슬라 막대(지붕 왼쪽 뒤)
    c.VL(12, 4, 24, K('copper', 1)); c.VL(13, 4, 24, K('copper', -1))
    for k in range(3): c.ell(12.5, 5 + k * 4, 2.5, 1.2, K('copper', 3 - k))
    c.R(10, 27, 6, 3, K('iron', 0)); c.HL(10, 27, 6, K('iron', 2))
    plinth_base(c, 6, H - 4, 68)
    c.outline()


def ridge_roof_ew(c, x, y, w, h, ramp='slate', t=0, course=3, louvre=False):
    """동서 용마루 지붕(남쪽 경사면이 보이는 윗면): 양 끝 박공 모서리 수직(OL), 위 끝 용마루. louvre = 용마루 환기 덧지붕."""
    for j in range(h):
        k = j % course; row = j // course
        for i in range(w):
            tt = t + (1 if k == 0 else (-1 if k == course - 1 else 0)) + (1 if j < h * .25 else 0)
            if k != 0 and (i + row * 2) % 5 == 0: tt -= 1
            if i < 2: tt += 1
            if i >= w - 2: tt -= 2
            c.P(x + i, y + j, K(ramp, tt))
    c.HL(x, y, w, K(ramp, t + 3)); c.HL(x, y - 1, w, OL); c.VL(x - 1, y - 1, h + 3, OL); c.VL(x + w, y - 1, h + 3, OL)
    c.HL(x, y + h, w, K('iron', 1)); c.HL(x, y + h + 1, w, K('iron', -2))
    if louvre:
        lx, lw = x + 8, w - 16
        top_slab(c, lx, y - 6, lw, 3, ramp, t + 1)
        for j in range(3):
            for i in range(lw):
                c.P(lx + i, y - 3 + j, K('iron', -3) if (i % 3 == 2 or j == 2) else K('slate', -1))
        c.VL(lx - 1, y - 3, 3, OL); c.VL(lx + lw, y - 3, 3, OL)


@piece('steam-engineshed', '기관고(아치 선로 문 2·용마루 환기창)', 8, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(8) for j in range(1, 6) if j < 5 or i in (0, 7, 3, 4)], tags=['철도', '기관고', '전차'])
def engineshed(c):
    W, H = 128, 96
    x0, w = 2, 124
    ridge_roof_ew(c, x0, 10, w, 26, 'slate', 0, louvre=True)
    wy = 38
    brick(c, x0, wy, w, H - 1 - wy, 'brick', 0, seed=131, soot=1.3)
    eaves_shadow(c, x0, wy, w, 2)
    for pxx in (x0, 60, 120):
        c.R(pxx, wy + 2, 6, H - 1 - wy - 2, K('brick', 1)); c.VL(pxx, wy + 2, H - 3 - wy, K('brick', 2)); c.VL(pxx + 5, wy + 2, H - 3 - wy, K('brick', -2))
    # 선로 아치 문 2(열린 문 — 안은 어둡고 선로 끝이 보인다)
    for ax in (10, 70):
        aw, ah = 46, 50
        for j in range(ah):
            for i in range(aw):
                u = (i + .5 - aw / 2) / (aw / 2)
                top = (aw / 2) * (1 - math.sqrt(max(0, 1 - u * u))) * .55
                if j >= top:
                    d = j - top
                    c.P(ax + i, H - 1 - ah + j, K('soot', -4 if d < ah * .5 else -3))
                elif j >= top - 3:
                    c.P(ax + i, H - 1 - ah + j, K('stone', 2 if (i % 4) else 3) if j >= top - 2 else K('stone', 0))
        # 열린 철문 두 짝(양옆 벽 앞에 접힘)
        c.R(ax - 1, H - 1 - ah + 14, 3, ah - 14, K('iron', 0)); c.VL(ax - 1, H - 1 - ah + 14, ah - 14, K('iron', 2))
        c.R(ax + aw - 2, H - 1 - ah + 14, 3, ah - 14, K('iron', -2))
        # 선로(안쪽으로 사라지는 두 줄)
        for j in range(18):
            yy = H - 2 - j
            sp = 7 - j // 5
            c.P(ax + aw // 2 - sp - 3, yy, K('iron', 1 - j // 7)); c.P(ax + aw // 2 + sp + 2, yy, K('iron', 1 - j // 7))
    for k, cx in enumerate((33, 93)):
        pass
    c.outline()


@piece('steam-station', '증기 철도역(유리 차양 승강장)', 8, 6, kind='structure', line='B',
       solid=[(i, j) for i in range(8) for j in range(1, 4)], tags=['철도', '역', '차양'])
def station(c):
    W, H = 128, 96
    x0, w = 2, 124
    ridge_roof_ew(c, x0, 6, w, 18, 'slate', 0)
    chimney_stack(c, 24, 0, 8, 4, seed=40); chimney_stack(c, 96, 0, 8, 4, seed=41)
    # 시계 박공(가운데, 지붕 위로)
    for j in range(10):
        for i in range(-j - 2, j + 3):
            c.P(64 + i, 6 + j, K('slate', (1 if i < 0 else -1) + (j < 3)))
        c.P(64 - j - 3, 6 + j, OL); c.P(64 + j + 3, 6 + j, OL)
    c.P(64, 5, OL)
    wy = 26
    brick(c, x0, wy, w, H - 7 - wy, 'brick', 0, seed=141, soot=.6)
    eaves_shadow(c, x0, wy, w, 2)
    for Y in range(14, 24):
        for X in range(58, 71):
            d = math.hypot(X + .5 - 64, Y + .5 - 19)
            if d < 5.6: c.P(X, Y, K('canvas', 3) if d < 4.5 else K('brass', 1))
    c.line(64, 19, 64, 16, K('iron', -4)); c.line(64, 19, 66, 19, K('iron', -4))
    for k, cx in enumerate((14, 34, 94, 114)):
        arch_window(c, cx - 5, wy + 8, 10, 14, lit=(k % 2 == 0), panes=(2, 3), seed=k)
    for Y in range(wy + 6, wy + 20):          # 가운데 둥근 창
        for X in range(56, 72):
            d = math.hypot(X + .5 - 64, Y + .5 - (wy + 13))
            if d <= 7: c.P(X, Y, K('stone', 2 if X < 64 else 0) if d > 5.6 else K('fire', 3 if Y < wy + 12 else 2))
    c.VL(64, wy + 7, 12, K('wood', -3)); c.HL(57, wy + 13, 14, K('wood', -3))
    # 차양(쇠·유리) — 윗면: 유리판 줄 + 쇠 갈빗대, 앞 끝 장식 띠
    cy0, ch = 56, 14
    # 차양 밑 그림자(벽에 드리움) + 창 2(아래층)
    for k, cx in enumerate((22, 106)):
        arch_window(c, cx - 6, 76, 12, 10, lit=True, arch=False, panes=(2, 2), sill=False, seed=30 + k)
    door_double(c, 54, 66, 20, 23, arch=False)
    for j in range(H - 7 - (cy0 + ch + 3)):
        for i in range(w):
            Y = cy0 + ch + 3 + j
            if j < 4: darken(c, x0 + i, Y, 2 if j < 2 else 1)
    for j in range(ch):
        for i in range(w + 2):
            rib = (i % 8 == 0)
            if rib: col = K('iron', 2 if j < 2 else (0 if j < ch - 3 else -1))
            elif i % 8 == 1: col = K('iron', -2)
            else: col = K('glass', 3 if j < 3 else (2 if j < ch // 2 else (1 if j < ch - 2 else 0)))
            c.P(x0 - 1 + i, cy0 + j, col)
        if j % 4 == 2:
            for i in range(0, w + 2, 2): pass
    for i in range(w + 2):
        c.P(x0 - 1 + i, cy0 - 1, OL)
        for j, tt in ((ch, 2), (ch + 1, 0), (ch + 2, -2)): c.P(x0 - 1 + i, cy0 + j, K('iron', tt))
        if i % 4 == 2: c.P(x0 - 1 + i, cy0 + ch + 3, K('iron', -1))      # 톱니 장식(밸런스)
    c.VL(x0 - 2, cy0 - 1, ch + 4, OL); c.VL(x0 + w + 1, cy0 - 1, ch + 4, OL)
    # 기둥(주철) 5개 + 승강장 바닥 앞 모서리
    for bx in (6, 36, 64, 92, 120):
        for Y in range(cy0 + ch + 3, H - 6):
            c.P(bx, Y, K('iron', 2)); c.P(bx + 1, Y, K('iron', 0)); c.P(bx + 2, Y, K('iron', -2))
        c.HL(bx - 1, H - 7, 5, K('iron', 1))
    top_slab(c, x0, H - 6, w, 2, 'stone', 1)
    front(c, x0, H - 4, w, 3, 'stone', 0, mat='plain')
    c.outline()


@piece('steam-foundry', '주물 공장(열린 화로 아치·큰 연통)', 6, 7, kind='structure', line='B',
       solid=[(i, j) for i in range(6) for j in range(2, 7) if not (j == 6 and i in (2, 3))], tags=['주물', '용광로', '공장'])
def foundry(c):
    W, H = 96, 112
    x0, w = 2, 92
    roof_slate(c, x0, 22, w, 26, 'slate', -1, course=3, hip=8, seed=6)
    # 큰 쇠 연통(사다리꼴 갓 + 원통) — 지붕 가운데 위로
    for j in range(8):
        hw = 6 + j
        for i in range(-hw, hw + 1):
            c.P(48 + i, 18 + j, K('iron', (1 if i < -hw / 3 else (0 if i < hw / 3 else -2)) + (j < 3)))
        c.P(48 - hw - 1, 18 + j, OL); c.P(48 + hw + 1, 18 + j, OL)
    cylinder(c, 41, 0, 14, 5, 16, 'iron', -1, bands=(6,), open_top=True)
    wy = 50
    brick(c, x0, wy, w, H - 1 - wy, 'brick', -1, seed=151, soot=1.8)
    eaves_shadow(c, x0, wy, w, 3)
    # 열린 화로 아치(안쪽에 녹은 쇠 불빛)
    ax, aw, ah = 26, 44, 40
    for j in range(ah):
        for i in range(aw):
            u = (i + .5 - aw / 2) / (aw / 2)
            top = (aw / 2) * (1 - math.sqrt(max(0, 1 - u * u))) * .5
            if j >= top:
                d = math.hypot(u * 1.0, (j - ah) / ah * 1.4)          # 아래 가운데(도가니)에서 거리
                tt = 4 if d < .25 else (3 if d < .45 else (2 if d < .65 else (1 if d < .85 else (0 if d < 1.05 else (-1 if d < 1.25 else None)))))
                c.P(ax + i, H - 1 - ah + j, K('fire', tt) if tt is not None else K('soot', -4))
            elif j >= top - 3:
                c.P(ax + i, H - 1 - ah + j, K('stone', 2 if j >= top - 2 else 0))
    # 쇳물 도가니(쇠 통 + 아가리 쇳물) 와 기둥 실루엣(일하는 기계)
    c.R(42, H - 12, 12, 7, K('iron', -3)); c.VL(42, H - 12, 7, K('fire', 1)); c.VL(53, H - 12, 7, K('iron', -4))
    c.ell(48, H - 12, 7, 2.5, K('iron', -2)); c.ell(48, H - 12, 5, 1.6, K('fire', 4))
    for X in (31, 32, 64, 65):
        c.VL(X, H - 1 - 30, 26, K('soot', -4))
    c.HL(31, H - 1 - 30, 35, K('soot', -4)); c.HL(31, H - 1 - 29, 35, K('iron', -3))
    for k, cx in enumerate((13, 83)):
        arch_window(c, cx - 5, wy + 10, 10, 14, lit=True, panes=(2, 3), seed=k + 9)
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-geartower', '톱니 탑(드러난 큰 톱니·구리 돔)', 4, 8, kind='structure', line='B',
       solid=[(i, j) for i in range(4) for j in range(3, 8) if not (j == 7 and i in (1, 2))], tags=['톱니', '탑', '랜드마크'])
def geartower(c):
    W, H = 64, 128
    x0, w = 6, 52
    # 녹청 구리 피라미드 지붕 + 꼭대기 작은 등탑(윗면 판)
    ry0, rh = 14, 28
    pyramid_roof(c, x0 - 2, ry0, w + 4, rh, 'patina', 0, top_w=12)
    box3(c, 26, 4, 12, 4, 8, 'patina', 'patina', 1)
    for X in range(28, 36, 3): c.VL(X, 9, 5, K('fire', 3))
    c.P(32, 2, K('brass', 3)); c.P(32, 1, K('brass', 4)); c.P(32, 3, K('brass', 1))
    wy = ry0 + rh + 2
    brick(c, x0, wy, w, H - 1 - wy, 'brick', -1, bw=5, seed=161, soot=.9)
    c.HL(x0, wy, w, K('stone', 0)); c.HL(x0, wy + 1, w, K('brick', -3))
    for j in range(wy + 2, H - 4, 4):
        q = 4 if (j // 4) % 2 else 6
        for qx in (x0, x0 + w - q):
            c.R(qx, j, q, 3, K('stone', 1)); c.HL(qx, j, q, K('stone', 2)); c.HL(qx, j + 3, q, K('stone', -2))
    wy -= 2
    # 벽에 뚫린 둥근 구멍 안에서 도는 큰 톱니 + 작은 톱니(맞물림)
    for Y in range(wy + 4, wy + 42):
        for X in range(x0 + 4, x0 + w - 4):
            d = math.hypot(X + .5 - 32, Y + .5 - (wy + 23))
            if d < 18: c.P(X, Y, K('soot', -4 if d < 16 else -3))
            elif d < 19.5: c.P(X, Y, K('stone', 2 if Y < wy + 23 else 0))
    gear(c, 32, wy + 23, 13, teeth=12, ramp='brass', t=0, phase=.1, spokes=5)
    gear(c, 44, wy + 34, 5, teeth=8, ramp='copper', t=0, phase=.3, spokes=0)
    door_double(c, 24, H - 5 - 24, 16, 24)
    plinth_base(c, x0, H - 4, w)
    c.outline()


@piece('steam-hangar', '비공정 격납고(동서 반원 지붕·큰 미닫이 입구)', 8, 7, kind='structure', line='B',
       solid=[(i, j) for i in range(8) for j in range(1, 7) if not (j >= 5 and 2 <= i <= 5)], tags=['비공정', '격납고', '부두'])
def hangar(c):
    """동서로 누운 반원통 지붕: 남쪽 반쪽이 윗면으로 보인다(위가 가장 밝고 앞 처마로 갈수록 어두움, 앞뒤로 뻗는 골 = 세로 줄,
    갈빗대 = 세로 굵은 줄). 양 끝은 둥근 박공 실루엣. 앞면 = 낮은 리벳 벽 + 열린 큰 미닫이 문(안에 비공정 옆모습)."""
    W, H = 128, 112
    x0, w = 2, 124
    rt, rb = 6, 58                                     # 지붕 위 끝(용마루 뒤) · 앞 처마
    for X in range(x0, x0 + w):
        e = (X - x0 + .5) / w
        dx = min(X - x0, x0 + w - 1 - X)            # 끝에서 거리
        for Y in range(rt, rb):
            v0 = (Y - rt) / (rb - rt)
            ins = 20 * (1 - v0) ** 1.4                 # 위로 갈수록 양 끝이 안으로(둥근 우진각 끝)
            if dx < ins: continue
            top = Y if 'top' not in dir() else top
        top = next((Y for Y in range(rt, rb) if dx >= 20 * (1 - (Y - rt) / (rb - rt)) ** 1.4), rb)
        for Y in range(top, rb):
            v = (Y - rt) / (rb - rt)                      # 0 = 꼭대기 → 1 = 처마
            tt = 2 if v < .2 else (1 if v < .45 else (0 if v < .7 else -1))
            k = (Y - rt) % 4                               # 겹친 철판 줄(가로) — 지붕 판 겹침
            tt += 1 if k == 0 else (-1 if k == 3 else 0)
            if (X - x0 + ((Y - rt) // 4) * 6) % 12 == 0 and k != 0: tt -= 1     # 판 이음(엇갈림)
            if (X - x0) % 32 == 0: tt -= 2                # 갈빗대(아치 트러스)
            vv = (Y - rt) / (rb - rt); ins = 20 * (1 - vv) ** 1.4
            if X - x0 < ins + 14: tt += 1                 # 왼쪽 끝 둥근 면(빛)
            if x0 + w - 1 - X < ins + 14: tt -= 2         # 오른쪽 끝 둥근 면(그늘)
            c.P(X, Y, K('iron', tt))
        c.P(X, top - 1, OL)

    # 지붕 위 채광창 띠(용마루 따라)
    for X in range(x0 + 20, x0 + w - 20):
        for Y in range(rt + 4, rt + 8):
            if (X - x0) % 32 != 0: c.P(X, Y, K('glass', 3 if Y < rt + 6 else 1) if (X % 6) else K('iron', 1))
    c.HL(x0, rb, w, K('iron', 1)); c.HL(x0, rb + 1, w, K('iron', -2))
    wy = rb + 2
    plate(c, x0, wy, w, H - 1 - wy, 'iron', -1, pw=16, ph=10, seed=3)
    # 열린 큰 문(가운데) — 안쪽 어둠 + 비공정 옆모습(기낭 + 곤돌라)
    dx0, dw = 30, 68
    for Y in range(wy + 3, H - 2):
        for X in range(dx0, dx0 + dw):
            c.P(X, Y, K('soot', -4 if Y > wy + 8 else -3))
    for Y in range(wy + 6, wy + 30):
        for X in range(dx0 - 6, dx0 + dw + 6):
            u = (X + .5 - 64) / 44; v = (Y + .5 - (wy + 17)) / 11
            if u * u + v * v > 1 or not (dx0 <= X < dx0 + dw): continue
            lit = -v * .9 - u * .2
            tt = 2 if lit > .5 else (1 if lit > .1 else (0 if lit > -.3 else -1))
            if (X - 20) % 9 == 0: tt -= 1
            c.P(X, Y, K('canvas', tt - 1))
    box3(c, 52, wy + 29, 24, 3, 6, 'wood', 'wood', 0, mat='plank')
    for X in range(54, 76, 4): c.P(X, wy + 34, K('fire', 3))
    # 문짝(밀려 열린 두 짝) + 위 레일
    for ddx in (dx0 - 12, dx0 + dw):
        plate(c, ddx, wy + 3, 12, H - 3 - wy - 3, 'iron', 0, pw=12, ph=8, seed=ddx)
        c.VL(ddx, wy + 3, H - 6 - wy, K('iron', 2)); c.VL(ddx + 11, wy + 3, H - 6 - wy, K('iron', -3))
    c.HL(x0, wy + 1, w, K('iron', 2)); c.HL(x0, wy + 2, w, K('iron', -3))
    c.R(x0, H - 3, w, 2, K('stone', 0)); c.HL(x0, H - 3, w, K('stone', 2))
    c.outline()

"""줄 B(증기 산업도시) 그리기 도구 — 2026-10-14 처음부터 다시 그림.

옛 줄 B(agent/sky-b)가 「매우 조잡」 판정을 받은 원인(8배 확대로 확인):
  · 재질을 무작위 점 잡음으로만 표현 → 벽돌·철판이 모래처럼 보였다.
  · 단색 평면 채움(앞면 한 색, 윗면 한 색) → 부피가 없었다.
  · 사람 크기와 안 맞는 문(높이 8px) → 캐릭터(24×32)가 못 지나간다.
그래서 여기서는 **낱개 단위로 음영을 준다**: 벽돌 한 장마다 윗줄 밝게·오른쪽 끝 어둡게, 철판 판재마다 이음매(어둠+빛)와 리벳(빛+그림자),
관은 원통 단면 5단, 지붕은 기와 줄마다 3단. 무작위 점은 쓰지 않는다(벽돌 색 고르기에만 해시를 쓴다).

시점 계약(3/4 탑뷰): 서 있는 것은 밝은 윗면 판(뒤 모서리 윤곽 OL) + 어두운 앞면. 빛은 왼쪽 위. 문 높이 22~26px(캐릭터 32px).
"""
from __future__ import annotations
import math
from registry import Cv, K, OL, piece, run_cli  # noqa: F401


def hv(x, y, s=0):
    """결정적 해시 0..1 (낱개 단위의 색 고르기 전용)."""
    v = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((v ^ (v >> 16)) & 0xFFFF) / 65535


def clipped(c, clip):
    """clip(x,y)->bool 안에서만 그리는 P."""
    def P(x, y, col):
        if clip is None or clip(x, y): c.P(x, y, col)
    return P


# ---------------------------------------------------------------- 재질(앞면)

def brick(c, x, y, w, h, ramp='brick', t=0, bw=6, bh=2, seed=0, soot=0.0, clip=None, mortar=None):
    """벽돌 벽. 한 장 = bw×bh, 줄눈 1px. 장마다 색(t-1/t/t+1)을 해시로 고르고 윗줄 밝게·오른쪽 끝 어둡게.
    soot = 위쪽 그을음 세기(0..2), 아래로 갈수록 옅어진다."""
    P = clipped(c, clip)
    mc = mortar if mortar is not None else K(ramp, t - 3)
    for j in range(h):
        for i in range(w): P(x + i, y + j, mc)
    row = 0
    yy = 0
    while yy < h:
        off = (row % 2) * ((bw + 1) // 2)
        bx = -off
        while bx < w:
            r = hv(bx + 97 * row, row, seed)
            tt = t + (-1 if r < .28 else (1 if r > .86 else 0))
            if soot: tt -= int(round(soot * max(0.0, 1 - yy / max(h * .7, 1))))
            for dy in range(bh):
                for dx in range(bw):
                    px, py = bx + dx, yy + dy
                    if not (0 <= px < w and 0 <= py < h): continue
                    col = K(ramp, tt)
                    if dy == 0 and 0 < dx < bw - 1: col = K(ramp, tt + 1)
                    if dx == bw - 1: col = K(ramp, tt - 1)
                    if dy == bh - 1 and dx == 0 and bh > 1: col = K(ramp, tt - 1)
                    P(x + px, y + py, col)
            bx += bw + 1
        yy += bh + 1; row += 1


def plate(c, x, y, w, h, ramp='iron', t=0, pw=12, ph=9, seed=0, rust=True, clip=None, rivets=True):
    """리벳 철판. 판재 pw×ph, 이음매 = 어두운 줄 + 아래/오른쪽 밝은 줄(돋을새김). 리벳 = 빛 1 + 아래 그림자 1, 3px 간격.
    판재마다 위가 밝고 아래가 어둡다. 녹물(구리 어두운 색)은 일부 리벳 아래 2~3px."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w):
            pj = j % ph
            tt = t + (1 if pj < 2 else 0) - (1 if pj >= ph - 2 else 0)
            P(x + i, y + j, K(ramp, tt))
    for j in range(h):
        for i in range(w):
            if j % ph == ph - 1: P(x + i, y + j, K(ramp, t - 3))
            elif j % ph == 0 and j: P(x + i, y + j, K(ramp, t + 2))
    for j in range(h):
        off = ((j // ph) % 2) * (pw // 2)
        for i in range(w):
            if (i + off) % pw == pw - 1 and j % ph != ph - 1: P(x + i, y + j, K(ramp, t - 2))
    if rivets:
        for j0 in range(0, h, ph):
            for i in range(1, w - 1, 3):
                yy = j0 + 1
                if yy + 1 < h:
                    P(x + i, y + yy, K(ramp, t + 3)); P(x + i, y + yy + 1, K(ramp, t - 2))
                    if rust and hv(i, j0, seed) > .82:
                        for q in range(2, 2 + 1 + int(hv(i, j0 + 1, seed) * 3)):
                            if yy + q < min(h, j0 + ph - 1): P(x + i, y + yy + q, K('copper', -2 + (q > 3)))


def corrugated(c, x, y, w, h, ramp='slate', t=0, period=3, clip=None, vertical=True):
    """골함석. 골 하나 = period px: 밝은 등 1·중간·어두운 골."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w):
            k = (i if vertical else j) % period
            tt = t + (1 if k == 0 else (-1 if k == period - 1 else 0))
            P(x + i, y + j, K(ramp, tt))


def planks(c, x, y, w, h, ramp='wood', t=0, pw=4, seed=0, vertical=True, clip=None):
    """판자. vertical=True 면 세로 판자(벽), False 면 가로 판자(바닥). 판마다 색 하나, 이음 어둡게, 판 끝 엇갈림."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w):
            a, b = (i, j) if vertical else (j, i)
            n = a // pw; k = a % pw
            joint = (b + int(hv(n, 0, seed) * 23)) % 24 == 0
            r = hv(n, 1, seed)
            tt = t + (-1 if r < .3 else (1 if r > .8 else 0))
            col = K(ramp, tt)
            if k == pw - 1 or joint: col = K(ramp, t - 2)
            elif k == 0: col = K(ramp, tt + 1)
            P(x + i, y + j, col)


def cobble(c, x, y, w, h, ramp='stone', t=0, seed=0, clip=None, sx=5, sy=4):
    """자갈(돌 낱개마다 윗왼쪽 빛·아래오른쪽 그림자, 틈 어둡게). 이음매 없는 반복을 위해 크기 고정 격자 + 줄 엇갈림."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w): P(x + i, y + j, K(ramp, t - 3))
    for row in range(-1, h // sy + 2):
        off = (row % 2) * (sx // 2) + int(hv(row, 5, seed) * 2)
        for col in range(-2, w // sx + 2):
            bx = col * sx - off; by = row * sy
            r = hv(col, row, seed)
            tt = t + (-1 if r < .3 else (1 if r > .85 else 0))
            for dy in range(sy - 1):
                for dx in range(sx - 1):
                    if (dx in (0, sx - 2)) and (dy in (0, sy - 2)): continue   # 모서리 둥글게
                    px, py = bx + dx, by + dy
                    if not (0 <= px < w and 0 <= py < h): continue
                    cc = K(ramp, tt)
                    if dy == 0 or dx == 0: cc = K(ramp, tt + 1)
                    if dy == sy - 2 or dx == sx - 2: cc = K(ramp, tt - 1)
                    P(x + px, y + py, cc)


def flagstone(c, x, y, w, h, ramp='stone', t=1, sw=8, sh=6, seed=0, clip=None):
    """판석 보도. 큰 판 sw×sh, 판마다 색, 윗줄 빛, 아래·오른쪽 틈."""
    P = clipped(c, clip)
    for j in range(h):
        row = j // sh; k = j % sh
        off = (row % 2) * (sw // 2)
        for i in range(w):
            n = (i + off) // sw; ki = (i + off) % sw
            r = hv(n, row, seed)
            tt = t + (-1 if r < .3 else (1 if r > .85 else 0))
            col = K(ramp, tt)
            if k == sh - 1 or ki == sw - 1: col = K(ramp, t - 2)
            elif k == 0: col = K(ramp, tt + 1)
            P(x + i, y + j, col)


def grate(c, x, y, w, h, ramp='iron', t=0, cell=4, clip=None):
    """쇠 격자 바닥: 가로세로 살(윗면 밝게) + 구멍(아주 어둡게, 아래에 김 빛 한 점)."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w):
            a, b = i % cell, j % cell
            if a == 0 or b == 0: col = K(ramp, t + 1 if b == 0 else t)
            elif b == 1 and a != 0: col = K(ramp, t - 3)
            else: col = K(ramp, -4)
            P(x + i, y + j, col)


# ---------------------------------------------------------------- 형태

def outline_box(c, x, y, w, h):
    c.HL(x - 1, y - 1, w + 2, OL); c.HL(x - 1, y + h, w + 2, OL); c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL)


def top_slab(c, x, y, w, rows, ramp, t=1, tex='plain', seed=0, ol=True, lip=True, taper=0.0):
    """3/4 윗면 판: 뒤 모서리 OL, 첫 줄 아주 밝음, 가운데 t+1, 앞 입술(마지막 줄) 밝은 모서리.
    taper>0 이면 뒤로 갈수록 양옆이 좁아지는 사다리꼴(줄마다 taper px) — 작은 소품의 윗면을 윗면으로 읽히게 하는 가장 센 신호.
    tex: plain | plate | plank | grate | stone | tar."""
    def ins(j): return int((rows - 1 - j) * taper)
    for j in range(rows):
        tt = t + (1 if j < rows // 2 else 0)
        c.HL(x + ins(j), y + j, w - 2 * ins(j), K(ramp, tt))
    inside = (lambda X, Y: x + ins(Y - y) <= X < x + w - ins(Y - y)) if taper else None
    if tex == 'plate':
        for j in range(rows):
            for i in range(w):
                if i % 10 == 9 and (inside is None or inside(x + i, y + j)): c.P(x + i, y + j, K(ramp, t - 1))
        for i in range(2, w - 1, 4):
            if rows >= 4 and (inside is None or inside(x + i, y + 1)): c.P(x + i, y + 1, K(ramp, t + 3))
    elif tex == 'plank':
        for j in range(rows):
            for i in range(w):
                if j % 3 == 2 and (inside is None or inside(x + i, y + j)): c.P(x + i, y + j, K(ramp, t - 1))
    elif tex == 'grate':
        grate(c, x + 1, y + 1, w - 2, rows - 2, 'iron', 1, clip=inside)
    elif tex == 'stone':      # 큰 판석(위에서 본 바닥): 낮은 대비, 이음만 한 단 어둡게
        for j in range(1, rows - 1):
            for i in range(w):
                if ((i + (j // 6) * 9) % 18 == 17 or j % 6 == 5) and (inside is None or inside(x + i, y + j)): c.P(x + i, y + j, K(ramp, t - 1))
    elif tex == 'tar':      # 루핑(두루마리 방수지) 가로 띠 5줄마다 겹친 이음(빛) + 그 밑 그림자
        for j in range(1, rows - 1):
            if j % 5 == 0: c.HL(x + 1 + ins(j), y + j, w - 2 - 2 * ins(j), K(ramp, t + 2))
            elif j % 5 == 1: c.HL(x + 1 + ins(j), y + j, w - 2 - 2 * ins(j), K(ramp, t - 1))
        for j in range(1, rows - 1):
            for i in range(1, w - 1):
                if (i * 7 + (j // 5) * 13) % 31 == 0 and j % 5 > 1 and (inside is None or inside(x + i, y + j)): c.P(x + i, y + j, K(ramp, t + 1))
    if lip: c.HL(x, y + rows - 1, w, K(ramp, t + 2))
    c.HL(x + ins(0), y, w - 2 * ins(0), K(ramp, t + 2))
    if ol:
        c.HL(x + ins(0), y - 1, w - 2 * ins(0), OL)
        for j in range(-1, rows):
            jj = max(j, 0)
            c.P(x - 1 + ins(jj), y + j, OL); c.P(x + w - ins(jj), y + j, OL)
        if taper:
            for j in range(rows):     # 사다리꼴 옆 사선 바깥 투명 칸 정리 + 옆 모서리 빛/그늘
                if ins(j): c.P(x + ins(j), y + j, K(ramp, t + 2)); c.P(x + w - 1 - ins(j), y + j, K(ramp, t - 1))


def front(c, x, y, w, h, ramp, t=-1, mat='plain', seed=0, ol=True, soot=0.0):
    """앞면: mat = plain|brick|plate|plank|corr|stone. 위 1줄 어둡게(윗판 밑 그림자), 오른쪽 끝 어둡게."""
    if mat == 'brick': brick(c, x, y, w, h, ramp, t, seed=seed, soot=soot)
    elif mat == 'plate': plate(c, x, y, w, h, ramp, t, seed=seed)
    elif mat == 'plank': planks(c, x, y, w, h, ramp, t, seed=seed)
    elif mat == 'corr': corrugated(c, x, y, w, h, ramp, t)
    elif mat == 'stone': flagstone(c, x, y, w, h, ramp, t, sw=7, sh=4, seed=seed)
    else:
        for j in range(h): c.HL(x, y + j, w, K(ramp, t))
    c.HL(x, y, w, K(ramp, t - 2))
    c.VL(x + w - 1, y, h, K(ramp, t - 2))
    if ol: c.VL(x - 1, y, h + 1, OL); c.VL(x + w, y, h + 1, OL); c.HL(x - 1, y + h, w + 2, OL)


def box3(c, x, y, w, top, h, top_ramp, face_ramp=None, t=0, top_tex='plain', mat='plain', seed=0):
    """윗면 top줄 + 앞면 h줄 상자. 윤곽 포함. (x,y)=윗면 왼쪽 위."""
    face_ramp = face_ramp or top_ramp
    front(c, x, y + top, w, h, face_ramp, t - 1, mat, seed)
    top_slab(c, x, y, w, top, top_ramp, t + 1, top_tex, seed)


def cylinder(c, x, y, w, cap, h, ramp, t=0, bands=(), rivet_bands=True, open_top=False, inner=None, lid=False):
    """선 원통(탱크·보일러·통): 윗면 타원 cap줄(밝음) + 몸통 h줄(왼쪽 1/4 밝은 띠, 오른쪽 어둠).
    bands = 몸통 위 y(상대) 목록: 쇠띠(리벳). open_top = 아가리(안쪽 어둡게 보임)."""
    rx = w / 2; cx = x + rx
    def shade_u(i):
        u = (i + .5 - rx) / rx
        return 2 if -.62 < u < -.3 else (1 if -.85 < u < -.05 else (0 if u < .45 else (-1 if u < .8 else -2)))
    cy = y + cap / 2
    for i in range(w):
        u = (i + .5 - rx) / rx
        e = (cap / 2) * math.sqrt(max(0, 1 - u * u))
        y0 = int(round(cy + e)) - 1
        for j in range(y0, y + cap // 2 + h):
            c.P(x + i, j, K(ramp, t + shade_u(i)))
        # 아래 끝 둥글게
        yb = y + cap // 2 + h + int(round(e)) - 1
        for j in range(y + cap // 2 + h, yb + 1): c.P(x + i, j, K(ramp, t + shade_u(i) - 1))
    for by in bands:
        yy = y + cap // 2 + by
        for i in range(w):
            u = (i + .5 - rx) / rx
            e = (cap / 2) * math.sqrt(max(0, 1 - u * u))
            yb = yy + int(round(e))
            sh = shade_u(i)
            c.P(x + i, yb - 1, K('iron' if ramp != 'iron' else 'slate', 1 + sh // 2))
            c.P(x + i, yb, K('iron' if ramp != 'iron' else 'slate', -1 + sh // 2))
            if rivet_bands and i % 3 == 1 and 1 < i < w - 2: c.P(x + i, yb - 1, K('brass', 3 if sh > 0 else 1))
    # 윗면 타원
    for i in range(w):
        u = (i + .5 - rx) / rx
        e = (cap / 2) * math.sqrt(max(0, 1 - u * u))
        for j in range(int(round(cy - e)), int(round(cy + e))):
            v = (j + .5 - cy) / max(cap / 2, 1)
            tt = t + 2 + (1 if v < -.2 and u < .2 else 0)
            if open_top:
                ri = max(0, 1 - (u / .78) ** 2)
                if abs(v) * (cap / 2) < (cap / 2 - 1.2) * math.sqrt(ri) and abs(u) < .78:
                    tt = None
            c.P(x + i, j, K(ramp, tt) if tt is not None else (inner or K('soot', -4)))
    if lid and not open_top:     # 뚜껑: 앞 테 어두운 선(입술 그림자) + 안쪽 테 고리 + 가운데 밝음 — 위에서 본 원판
        for i in range(w):
            u = (i + .5 - rx) / rx
            e = (cap / 2) * math.sqrt(max(0, 1 - u * u))
            c.P(x + i, int(round(cy + e)) - 1, K(ramp, t - 2 if u > -.4 else t - 1))
            c.P(x + i, int(round(cy - e)), K(ramp, t + 3))
        c.ell(cx, cy, rx * .62, cap / 2 * .58, K(ramp, t))
        c.ell(cx - rx * .06, cy - cap * .04, rx * .5, cap / 2 * .44, K(ramp, t + 3))
    # 테두리 윤곽
    c.outline()


def pipe_h(c, x, y, ln, d=4, ramp='copper', t=0, flanges=(), ol=True):
    """가로 관(앞에서 본 원통 단면 d줄): 위 밝음 → 아래 어둠. flanges = x(상대) 목록: 놋쇠 고리(1px 두꺼움)."""
    prof = {3: [2, 0, -2], 4: [2, 1, -1, -2], 5: [1, 3, 1, -1, -2], 6: [1, 3, 1, 0, -1, -2]}.get(d, [1, 2, 1, 0, -1, -2, -2][:d])
    for j in range(d):
        c.HL(x, y + j, ln, K(ramp, t + prof[j]))
    for f in flanges:
        fx = x + f
        for j in range(-1, d + 1):
            tt = 3 if j <= 0 else (1 if j < d // 2 else -1)
            c.P(fx, y + j, K('brass', tt)); c.P(fx + 1, y + j, K('brass', tt - 1))
        c.P(fx - 1, y + d // 2, K(ramp, t - 3))
    if ol: c.HL(x, y - 1, ln, OL); c.HL(x, y + d, ln, OL)


def pipe_v(c, x, y, ln, d=4, ramp='copper', t=0, flanges=(), ol=True):
    """세로 관: 왼쪽 밝음 → 오른쪽 어둠."""
    prof = {3: [2, 0, -2], 4: [1, 2, 0, -2], 5: [1, 3, 1, -1, -2], 6: [1, 3, 1, 0, -1, -2]}.get(d, [1, 2, 1, 0, -1, -2, -2][:d])
    for i in range(d):
        c.VL(x + i, y, ln, K(ramp, t + prof[i]))
    for f in flanges:
        fy = y + f
        for i in range(-1, d + 1):
            tt = 3 if i <= 0 else (1 if i < d // 2 else -1)
            c.P(x + i, fy, K('brass', tt + 1)); c.P(x + i, fy + 1, K('brass', tt - 1))
    if ol: c.VL(x - 1, y, ln, OL); c.VL(x + d, y, ln, OL)


def gear(c, cx, cy, r, teeth=8, ramp='brass', t=0, phase=0.0, hub=True, spokes=4):
    """정면 톱니바퀴(벽·탑 앞면). 왼쪽 위 빛. phase = 회전(라디안)."""
    R2 = r + 1.6
    for y in range(int(cy - R2) - 1, int(cy + R2) + 2):
        for x in range(int(cx - R2) - 1, int(cx + R2) + 2):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy); a = math.atan2(dy, dx) - phase
            tooth = (math.cos(a * teeth) > .25)
            if d <= r - .2 or (tooth and d <= R2):
                light = -(dx * .6 + dy * .8) / max(d, .01)
                tt = t + (1 if light > .3 else 0) - (1 if light < -.3 else 0)
                if d > r - 1.2 and d <= r - .2: tt -= 1                      # 테 안쪽 홈
                if d > r - .2: tt += 0
                rim_in = r * .55
                if spokes and rim_in - 1 < d < r - 1.2:
                    # 바퀴살 사이 구멍
                    sa = (a * spokes / (2 * math.pi)) % 1
                    if not (sa < .18 or sa > .82): tt = None
                c.P(x, y, K(ramp, tt) if tt is not None else K('soot', -4))
    if hub:
        hr = max(1.2, r * .28)
        for y in range(int(cy - hr) - 1, int(cy + hr) + 2):
            for x in range(int(cx - hr) - 1, int(cx + hr) + 2):
                if math.hypot(x + .5 - cx, y + .5 - cy) <= hr:
                    c.P(x, y, K('iron', 1 if (x + .5 < cx and y + .5 < cy) else -1))


def arch_window(c, x, y, w, h, lit=False, arch=True, panes=(2, 3), sill=True, frame='iron', seed=0):
    """공장 창: 둥근 윗부분(아치 개구부) + 세운 벽돌 아치 테(밝고 어두운 벽돌 번갈아) + 이맛돌 + 쇠 창살 + 유리.
    유리 = 위 밝고 아래 어둡게 + 왼쪽 위 반사 사선. lit = 안에서 불빛(위 노랑 → 아래 주황, 일부 칸은 기계 그림자)."""
    rise = 2 if (arch and w >= 8) else 0
    def inside(i, j):
        if rise and j < rise:
            # 둥근 모서리: 위 줄일수록 안쪽으로
            cut = (rise - j) * (2 if w >= 12 else 1)
            return cut <= i < w - cut
        return True
    for j in range(h):
        for i in range(w):
            if not inside(i, j): continue
            if lit:
                tt = 3 if j < h * .3 else (2 if j < h * .7 else 1)
                if hv(i // max(1, w // panes[0]), j // max(1, h // panes[1]), seed + 9) > .78: tt -= 2   # 칸 하나는 안쪽 기계 그림자
                col = K('fire', tt)
            else:
                tt = 1 if j < h * .35 else (0 if j < h * .75 else -1)
                col = K('glass', tt)
            c.P(x + i, y + j, col)
    if not lit:   # 반사 사선 두 줄
        for k in range(min(w, h)):
            for q, tt in ((0, 3), (1, 2)):
                i, j = 1 + k + q, h // 2 - k + 1
                if 0 <= j < h and i < w and inside(i, j): c.P(x + i, y + j, K('glass', tt))
    nx, ny = panes
    mc = K('wood', -3) if lit else K(frame, -2)
    for k in range(1, nx):
        xx = round(w * k / nx)
        for j in range(h):
            if inside(xx, j): c.P(x + xx, y + j, mc)
    for k in range(1, ny):
        yy = round(h * k / ny)
        for i in range(w):
            if inside(i, yy): c.P(x + i, y + yy, mc)
    # 창틀(개구부 가장자리 1px 어둡게, 오른쪽·아래 깊은 그림자)
    for j in range(h):
        for i in range(w):
            if inside(i, j) and (not inside(i - 1, j) or not inside(i + 1, j) or not inside(i, j - 1) or i in (0, w - 1)):
                c.P(x + i, y + j, K(frame, -3))
    if arch:   # 세운 벽돌 아치 테: 개구부 바깥 2줄
        for j in range(-2, rise + 1):
            for i in range(-2, w + 2):
                if inside(i, j) and 0 <= i < w and j >= 0: continue
                # 개구부까지 거리 1~2 인 바깥 칸만
                near = any(0 <= i + di < w and 0 <= j + dj < h and inside(i + di, j + dj) for di in (-2, -1, 0, 1, 2) for dj in (0, 1, 2) if abs(di) + dj <= 2)
                if not near: continue
                c.P(x + i, y + j, K('brick', 1 if i % 2 == 0 else -1))
        kx = x + w // 2 - (1 if w % 2 == 0 else 0)
        for i in range(kx, kx + (2 if w % 2 == 0 else 1)):
            c.P(i, y - 2, K('stone', 3)); c.P(i, y - 1, K('stone', 1))
    if sill:   # 창턱 윗면(밝음 2줄) + 아래 그림자
        c.HL(x - 2, y + h, w + 4, K('stone', 2)); c.HL(x - 2, y + h + 1, w + 4, K('stone', 0)); c.HL(x - 1, y + h + 2, w + 2, K('brick', -3))
        if lit:
            for i in range(1, w - 1, 2): c.P(x + i, y + h, K('fire', 4))


def door_double(c, x, y, w, h, ramp='wood', t=-1, iron_bands=True, arch=True):
    """양여닫이 나무 문(쇠띠·리벳), 아치 문틀. 사람 크기: h≈22~26."""
    for j in range(h):
        for i in range(w):
            k = i % 3
            c.P(x + i, y + j, K(ramp, t + (1 if k == 0 else (-1 if k == 2 else 0))))
    c.VL(x + w // 2, y, h, K(ramp, t - 3))
    if iron_bands:
        for by in (3, h - 5):
            c.HL(x, y + by, w, K('iron', -1)); c.HL(x, y + by + 1, w, K('iron', -3))
            for i in range(1, w - 1, 3): c.P(x + i, y + by, K('iron', 2))
    c.P(x + w // 2 - 2, y + h // 2, K('brass', 3)); c.P(x + w // 2 + 1, y + h // 2, K('brass', 3))
    c.VL(x - 1, y, h, K('stone', 0)); c.VL(x + w, y, h, K('stone', -2))
    if arch:
        c.HL(x - 1, y - 1, w + 2, K('stone', 2)); c.HL(x, y - 2, w, K('stone', 1)); c.P(x + w // 2, y - 2, K('stone', 3))
    c.HL(x - 1, y + h, w + 2, K('stone', 1))    # 문턱


def slide_door(c, x, y, w, h, t=-1):
    """공장 미닫이 철문(골함석 + X 버팀 + 레일)."""
    corrugated(c, x, y, w, h, 'iron', t, period=3)
    for k in range(max(w, h)):
        for sx in (1, -1):
            i = k if sx > 0 else w - 1 - k
            j = int(k * h / max(w, 1))
            if 0 <= i < w and 0 <= j < h: c.P(x + i, y + j, K('iron', t + 2)); c.P(x + i, y + j + 1 if j + 1 < h else y + j, K('iron', t - 2))
    c.HL(x - 1, y - 2, w + 2, K('iron', 1)); c.HL(x - 1, y - 1, w + 2, K('iron', -3))
    c.R(x, y + h - 2, w, 2, K('iron', t - 2))


def eaves_shadow(c, x, y, w, depth=2, ramp='brick', t=-1):
    """처마 밑 그림자(앞면 위쪽을 한 단 더 어둡게)."""
    for j in range(depth):
        for i in range(w):
            if c.op(x + i, y + j):
                c.P(x + i, y + j, K(ramp, t - 2 + j))


def roof_slate(c, x, y, w, h, ramp='slate', t=0, course=3, hip=0, seed=0, ridge=True):
    """남쪽으로 기운 지붕면(윗면): 기와 줄마다 밝은 입술·중간·어두운 겹침, 엇갈린 세로 이음. hip>0 이면 양 끝이 사선(우진각, 왼쪽 밝음 오른쪽 어둠).
    (x,y) = 지붕 왼쪽 위(용마루 왼쪽 끝 - hip), w 는 처마 폭."""
    for j in range(h):
        ins = int(round((h - 1 - j) * hip / max(h - 1, 1))) if hip else 0
        rj = j % course; row = j // course
        for i in range(ins, w - ins):
            off = (row % 2) * 2
            tt = t + (1 if rj == 0 else (-1 if rj == course - 1 else 0))
            if rj < course - 1 and (i + off) % 5 == 0: tt -= 1
            if hip and i < ins + max(1, hip // 2) + 1: tt += 1                        # 왼쪽 사면 밝게
            if hip and i >= w - ins - max(1, hip // 2) - 1: tt -= 2                   # 오른쪽 사면 어둡게
            tt += (1 if j < h * .3 else 0)
            c.P(x + i, y + j, K(ramp, tt))
        if ins: c.P(x + ins - 1, y + j, OL); c.P(x + w - ins, y + j, OL)
    if ridge:
        c.HL(x + hip, y, w - 2 * hip, K(ramp, t + 3)); c.HL(x + hip, y - 1, w - 2 * hip, OL)
    # 처마: 홈통(쇠)
    c.HL(x, y + h, w, K('iron', 1)); c.HL(x, y + h + 1, w, K('iron', -2))
    c.VL(x - 1, y + h - 1, 3, OL); c.VL(x + w, y + h - 1, 3, OL)


def chimney_stack(c, x, y, w, h, ramp='brick', t=0, cap_rows=4, band=True, seed=0):
    """벽돌 굴뚝(윗면 = 쇠테 두른 아가리가 위에서 보인다: 테두리 밝고 안은 검댕).
    (x,y) = 아가리 윗면 왼쪽 위, 몸통 높이 h."""
    brick(c, x, y + cap_rows, w, h, ramp, t, bw=4, bh=2, seed=seed, soot=1.6)
    # 왼쪽 빛 · 오른쪽 그림자 띠
    for j in range(h):
        c.P(x, y + cap_rows + j, K(ramp, t + 1)); c.P(x + w - 1, y + cap_rows + j, K(ramp, t - 2))
        if w > 6: c.P(x + w - 2, y + cap_rows + j, K(ramp, t - 2))
    if band:
        for by in (1, 2):
            c.HL(x - 1, y + cap_rows + by, w + 2, K('iron', 1 if by == 1 else -2))
    # 아가리 윗면
    c.HL(x - 1, y, w + 2, K('stone', 2))
    for j in range(1, cap_rows):
        c.HL(x - 1, y + j, w + 2, K('stone', 1 if j < cap_rows - 1 else 0))
        c.HL(x + 1, y + j, w - 2, K('soot', -4 if j > 1 else -3))
    c.HL(x - 1, y + cap_rows - 1, w + 2, K('stone', 2))
    c.P(x - 1, y + cap_rows - 1, K('stone', 0)); c.P(x + w, y + cap_rows - 1, K('stone', -1))


def lamp_head(c, cx, y, lit=True, f=0):
    """가스등 머리(4면 유리 등갓): 위 지붕판(윗면 보임) + 유리 몸통(불빛) + 아래 받침."""
    # 지붕 윗면(5줄): 사다리꼴 철판
    for j in range(4):
        hw = 2 + j
        c.HL(cx - hw, y + j, hw * 2 + 1, K('iron', 2 if j < 2 else 1))
    c.P(cx, y - 1, K('brass', 3)); c.P(cx, y - 2, K('brass', 1))
    c.HL(cx - 5, y + 4, 11, K('iron', -1)); c.HL(cx - 5, y + 5, 11, K('iron', -3))
    flick = [3, 2, 3, 4][f % 4] if lit else 0
    for j in range(6, 12):
        for i in range(-3, 4):
            if lit:
                tt = flick - (1 if abs(i) == 3 else 0) - (1 if j > 9 else 0)
                c.P(cx + i, y + j, K('fire', tt))
            else:
                c.P(cx + i, y + j, K('glass', 0 if i < 0 else -1))
    c.VL(cx - 3, y + 6, 6, K('iron', -2)); c.VL(cx + 3, y + 6, 6, K('iron', -3)); c.VL(cx, y + 6, 6, K('iron', -2) if not lit else K('fire', 4))
    c.HL(cx - 4, y + 12, 9, K('iron', 0)); c.HL(cx - 2, y + 13, 5, K('iron', -2))


def shade_right(c, x0, x1, amount=1):
    """이미 그린 덩이의 오른쪽 열 범위를 한 단 어둡게(덩이 전체 빛 방향 강조)."""
    pass


def gable_front(c, x0, x1, apex_y, eave_y, depth, ramp='slate', t=0, course=3, trim='wood', seed=0, wall=None):
    """남북 용마루 박공지붕(앞에 박공 삼각벽): 왼쪽 경사면 밝음·오른쪽 어둠, 기와 줄은 앞 처마선(사선)과 나란히.
    x0..x1 = 처마 폭, apex_y = 앞 박공 꼭대기 y, eave_y = 앞 처마 끝 y, depth = 지붕이 뒤로 물러나는 줄 수.
    wall(c, clip) 가 있으면 박공 삼각벽을 그 함수로 칠한다. 반환 rake(x) = 앞 처마선 y."""
    cx = (x0 + x1) / 2
    def rake(X):
        return apex_y + (eave_y - apex_y) * abs(X + .5 - cx) / ((x1 - x0) / 2)
    for X in range(x0, x1):
        r = rake(X); left = X + .5 < cx
        for Y in range(int(round(r - depth)), int(round(r))):
            d = r - Y                                      # 앞 처마선에서 위로 거리
            k = int(d) % course
            tt = t + (1 if left else -1) + (1 if k == course - 1 else (-1 if k == 0 else 0))
            row = int(d) // course
            if k != 0 and (X + row * 2) % 5 == 0: tt -= 1
            if d > depth - 2: tt += 1                     # 뒤 끝(용마루 쪽) 밝게
            c.P(X, Y, K(ramp, tt))
        c.P(X, int(round(r - depth)) - 1, OL)
    # 용마루(뒤로 뻗는 마루) — 꼭대기 열에서 수직선
    ax = int(cx)
    for Y in range(int(apex_y - depth), int(apex_y) + 1):
        c.P(ax, Y, K(ramp, t + 3)); c.P(ax - 1, Y, K(ramp, t + 2))
    # 박공 삼각벽
    if wall is not None:
        wall(c, lambda X, Y: x0 + 2 <= X < x1 - 2 and Y > rake(X) + 1 and Y <= eave_y + 1)
    # 앞 처마 판(박공널): 밝은 윗줄 + 어두운 아랫줄
    for X in range(x0, x1):
        r = int(round(rake(X)))
        c.P(X, r, K(trim, 2)); c.P(X, r + 1, K(trim, -1)); c.P(X, r + 2, K(trim, -3))
    return rake


def dome(c, cx, by, rx, ry, ramp='patina', t=0, ribs=6, finial=True):
    """돔(반타원, 바닥 by). 왼쪽 위 빛, 세로 갈빗대, 맨 위 꼭지(놋쇠). 3/4 에서는 돔 자체가 윗면."""
    for Y in range(int(by - ry) - 1, by + 1):
        for X in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (X + .5 - cx) / rx; v = (by - Y - .5) / ry
            if u * u + v * v > 1 or v < 0: continue
            lit = -u * .7 + v * .6
            tt = t + (2 if lit > .55 else (1 if lit > .15 else (0 if lit > -.3 else -1)))
            ang = math.asin(max(-1, min(1, u / max(math.sqrt(max(1 - v * v, 1e-6)), 1e-6))))
            if ribs and abs(((ang / math.pi + .5) * ribs) % 1 - .5) < .08: tt -= 1
            c.P(X, Y, K(ramp, tt))
    c.HL(int(cx - rx), by, int(2 * rx) + 1, K('brass', 1)); c.HL(int(cx - rx), by + 1, int(2 * rx) + 1, K('brass', -2))
    if finial:
        c.P(int(cx), int(by - ry) - 1, K('brass', 3)); c.P(int(cx), int(by - ry) - 2, K('brass', 2)); c.P(int(cx), int(by - ry) - 3, K('brass', 3))


def lattice(c, x, y, w, h, ramp='iron', t=0, cell=6):
    """쇠 격자 골조(X 버팀): 테두리 기둥 2px + 가로보 + 대각선."""
    for j in range(h):
        c.P(x, y + j, K(ramp, t + 1)); c.P(x + 1, y + j, K(ramp, t - 1))
        c.P(x + w - 2, y + j, K(ramp, t)); c.P(x + w - 1, y + j, K(ramp, t - 2))
    for j0 in range(0, h, cell):
        c.HL(x, y + j0, w, K(ramp, t + 1)); c.HL(x, y + j0 + 1, w, K(ramp, t - 2))
        for k in range(cell):
            if j0 + k >= h: break
            fx = x + 2 + int((w - 4) * k / cell); bx = x + w - 3 - int((w - 4) * k / cell)
            c.P(fx, y + j0 + k, K(ramp, t)); c.P(bx, y + j0 + k, K(ramp, t - 1))


def door_shop(c, x, y, w=10, h=24, ramp='wood', t=0, glass=True):
    """가게 문(한 짝, 위쪽 유리창 + 아래 판, 놋쇠 손잡이, 위 채광창)."""
    c.R(x - 1, y - 1, w + 2, h + 1, K('wood', -3))
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + j, K(ramp, t + (1 if i == 0 else (-1 if i == w - 1 else 0))))
    if glass:
        for j in range(3, h // 2):
            for i in range(2, w - 2):
                c.P(x + i, y + j, K('fire', 2) if j > 4 else K('fire', 3))
        c.VL(x + w // 2, y + 3, h // 2 - 3, K('wood', -2))
    for j in range(h // 2 + 2, h - 3, 5):
        c.R(x + 2, y + j, w - 4, 3, K(ramp, t - 1)); c.HL(x + 2, y + j, w - 4, K(ramp, t + 1)); c.VL(x + w - 3, y + j, 3, K(ramp, t - 2))
    c.P(x + w - 3, y + h // 2 + 1, K('brass', 4)); c.P(x + w - 3, y + h // 2 + 2, K('brass', 1))
    c.HL(x - 1, y + h, w + 2, K('stone', 2))


def dormer(c, cx, y, w=12, roof='slate', wall='stone', lit=True, seed=0):
    """지붕창: 작은 박공 지붕(윗면 경사 왼쪽 밝음·오른쪽 어둠, 윤곽) + 앞 벽 + 창. (cx,y)=박공 꼭대기."""
    hw = w // 2
    for j in range(hw):
        for i in range(-j - 1, j + 2):
            tt = (1 if i < 0 else -1) + (1 if j < 2 else 0)
            c.P(cx + i, y + j, K(roof, tt))
        c.P(cx - j - 2, y + j, OL); c.P(cx + j + 2, y + j, OL)
    c.P(cx, y - 1, OL)
    wy = y + hw
    c.HL(cx - hw - 1, wy - 1, w + 3, K(roof, -2))
    c.R(cx - hw + 1, wy, w - 1, 8, K(wall, 1)); c.VL(cx + hw - 1, wy, 8, K(wall, -1))
    c.VL(cx - hw, wy, 8, OL); c.VL(cx + hw, wy, 8, OL)
    for j in range(1, 7):
        for i in range(-hw + 3, hw - 2):
            c.P(cx + i, wy + j, K('fire', 3 - (j > 3)) if lit else K('glass', 1 - (j > 3)))
    c.VL(cx, wy + 1, 6, K('wood', -3)); c.HL(cx - hw + 3, wy + 4, w - 5, K('wood', -3))
    c.HL(cx - hw, wy + 8, w + 1, K(roof, -3))


from palette import RAMPS as _RAMPS  # noqa: E402
_REV = {}
for _n, _r in _RAMPS.items():
    for _i, _col in enumerate(_r):
        _REV.setdefault(tuple(_col), (_n, _i - 4))


def darken(c, x, y, steps=1):
    """그 칸 색을 같은 램프에서 steps 단 어둡게(팔레트 잠금 유지). 투명·윤곽은 그대로."""
    if not c.op(x, y): return
    col = tuple(int(v) for v in c.a[y, x, :3])
    if col not in _REV: return
    n, t = _REV[col]
    c.P(x, y, K(n, t - steps))


def shade_rect(c, x, y, w, h, steps=1):
    for j in range(h):
        for i in range(w): darken(c, x + i, y + j, steps)


def dome3(c, cx, cy, rx, ry, h, ramp='copper', t=0, ribs=6, finial=True, rim='brass'):
    """3/4 돔: 바닥 테가 타원(가운데 cy, 반지름 rx×ry — 앞쪽 테가 아래로 휘어 보인다), 꼭대기는 cy-h.
    윗면으로 읽히게 앞 테 아래 1줄 그림자, 갈빗대는 꼭지에서 앞 테로 모이는 곡선."""
    for X in range(int(cx - rx) - 1, int(cx + rx) + 2):
        u = (X + .5 - cx) / rx
        if abs(u) > 1: continue
        s = math.sqrt(max(0, 1 - u * u))
        top = cy - h * s; bot = cy + ry * s
        for Y in range(int(math.floor(top)), int(math.ceil(bot))):
            v = (Y + .5 - top) / max(bot - top, 1)          # 0 = 꼭대기, 1 = 앞 테
            lit = -u * .75 + (1 - v) * .5
            tt = t + (2 if lit > .65 else (1 if lit > .25 else (0 if lit > -.2 else (-1 if lit > -.55 else -2))))
            if ribs and abs(((math.asin(max(-1, min(1, u))) / math.pi + .5) * ribs) % 1 - .5) < .07 and v > .1: tt -= 1
            c.P(X, Y, K(ramp, tt))
        b = int(math.ceil(bot))
        c.P(X, b - 1, K(rim, 2 if u < 0 else 0)); c.P(X, b, K(rim, -1 if u < .3 else -3))
    if finial:
        ty = int(cy - h)
        c.P(int(cx), ty - 1, K('brass', 3)); c.P(int(cx), ty - 2, K('brass', 2)); c.P(int(cx), ty - 3, K('brass', 4))


def pyramid_roof(c, x0, y0, w, h, ramp='slate', t=0, top_w=4, course=3):
    """피라미드(사방 경사) 지붕: 위로 갈수록 좁아지는 사다리꼴, 왼쪽 사면 밝음·가운데 남면·오른쪽 사면 어둠, 기와 줄."""
    for j in range(h):
        ins = int(round((h - 1 - j) * (w - top_w) / 2 / max(h - 1, 1)))
        for i in range(ins, w - ins):
            k = j % course
            side = -1 if i < ins + (w / 2 - ins) * .45 else (1 if i > w - ins - (w / 2 - ins) * .45 else 0)
            tt = t + (1 if side < 0 else (-2 if side > 0 else 0)) + (1 if k == 0 else (-1 if k == course - 1 else 0))
            if (i + (j // course) * 2) % 5 == 0 and k: tt -= 1
            c.P(x0 + i, y0 + j, K(ramp, tt))
        c.P(x0 + ins - 1, y0 + j, OL); c.P(x0 + w - ins, y0 + j, OL)
    ins0 = int(round((h - 1) * (w - top_w) / 2 / max(h - 1, 1)))
    c.HL(x0 + ins0, y0 - 1, w - 2 * ins0, OL)
    c.HL(x0 - 1, y0 + h, w + 2, K('brass', 2)); c.HL(x0 - 1, y0 + h + 1, w + 2, K('brass', -2))


def tread(c, x, y, w, h, ramp='iron', t=1, pw=16, ph=12, clip=None, rivets=True):
    """줄무늬 강판(위에서 본 바닥판): 엇갈린 짧은 사선 돌기(빛 1 + 그림자 1) + 판 이음(어둠) + 모서리 리벳."""
    P = clipped(c, clip)
    for j in range(h):
        for i in range(w):
            pi, pj = i % pw, j % ph
            col = K(ramp, t)
            if pi == pw - 1 or pj == ph - 1: col = K(ramp, t - 2)
            elif pi == 0 or pj == 0: col = K(ramp, t + 1)
            else:
                a = (i // 3 + j // 2) % 2
                if (i % 3 == 1 and j % 4 == (0 if a else 2)): col = K(ramp, t + 2)
                elif (i % 3 == 2 and j % 4 == (1 if a else 3)): col = K(ramp, t - 1)
            if rivets and pi in (2, pw - 3) and pj in (2, ph - 3): col = K(ramp, t + 3)
            P(x + i, y + j, col)


def oct_deck(c, cx, cy, rx, ry, rim=4, ramp='iron', t=1, rail=True, face_ramp=None):
    """위에서 본 팔각/타원 갑판(윗면) + 앞 테두리 면 rim 줄 + 둘레 난간 기둥(뒤쪽은 짧게). 타원 = 3/4 윗면의 가장 센 신호."""
    face_ramp = face_ramp or ramp
    for Y in range(int(cy - ry) - 1, int(cy + ry) + rim + 2):
        for X in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (X + .5 - cx) / rx; v = (Y + .5 - cy) / ry
            if abs(u) > 1: continue
            e = math.sqrt(max(0, 1 - u * u))
            if abs(v) <= e:
                tt = t + (1 if v < -.2 else 0) + (1 if (X + Y) % 4 == 0 and v < .6 else 0)
                c.P(X, Y, K(ramp, tt))
            elif v > e and Y + .5 <= cy + ry * e + rim:
                k = Y + .5 - (cy + ry * e)
                tt = t - 1 - (1 if u > .3 else 0) - (1 if k > rim - 1.5 else 0) + (1 if u < -.5 else 0)
                c.P(X, Y, K(face_ramp, tt))
    for X in range(int(cx - rx), int(cx + rx) + 1):        # 앞 가장자리 밝은 입술
        u = (X + .5 - cx) / rx
        if abs(u) <= 1:
            c.P(X, int(cy + ry * math.sqrt(max(0, 1 - u * u))), K(ramp, t + 2))
    if rail:
        n = 12
        for k in range(n):
            a = k / n * 2 * math.pi
            px = cx + math.cos(a) * (rx - 1.5); py = cy + math.sin(a) * (ry - 1.2)
            hh = 3 if math.sin(a) < 0 else 5
            c.VL(int(px), int(py) - hh, hh, K('brass', 1 if math.cos(a) < 0 else -1))
        for k in range(120):
            a = k / 120 * 2 * math.pi
            px = cx + math.cos(a) * (rx - 1.5); py = cy + math.sin(a) * (ry - 1.2)
            hh = 3 if math.sin(a) < 0 else 5
            c.P(int(px), int(py) - hh, K('brass', 3 if math.sin(a) > 0 else 1))

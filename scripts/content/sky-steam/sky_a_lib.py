"""줄 A(하늘섬) 그리기 도구 — 3/4 윗면 판·앞면·섬 덩이·지붕. 모든 서 있는 그림은 윗면(밝고 결 있는 5줄+)·뒷모서리 윤곽·어두운 앞 입술."""
from __future__ import annotations
import math
from registry import Cv, K, OL, piece, run_cli  # noqa: F401


def hn(x, y, s=0):
    """결정적 화소 잡음 0..1."""
    v = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((v ^ (v >> 16)) & 0xFFFF) / 65535


def slab(c, x, y, w, rows, ramp, t=1, taper=0.4, lip=True, grain=True, seed=0, ol=True):
    """3/4 윗면 판(사다리꼴: 뒤쪽이 좁음). 위 절반 밝음, 결 점·짧은 줄, 안쪽 테두리 홈, 앞 입술 1줄 어둡게."""
    for j in range(rows):
        ins = int((rows - 1 - j) * taper)
        x0, ww = x + ins, w - 2 * ins
        base = K(ramp, t + 1) if j < rows * 0.55 else K(ramp, t)
        c.HL(x0, y + j, ww, base)
        if grain:
            for i in range(x0, x0 + ww):
                r = hn(i, y + j, seed)
                if r > .86: c.P(i, y + j, K(ramp, t + 3))
                elif r < .10: c.P(i, y + j, K(ramp, t - 1))
        if rows >= 5 and 0 < j < rows - 1 and ww > 4:
            c.P(x0 + 1, y + j, K(ramp, t - 1)); c.P(x0 + ww - 2, y + j, K(ramp, t - 1))
        if ol: c.P(x0 - 1, y + j, OL); c.P(x0 + ww, y + j, OL)
    if rows >= 5: c.HL(x + int((rows - 1) * taper) + 1, y + 1, w - 2 * int((rows - 1) * taper) - 2, K(ramp, t + 3))
    if lip: c.HL(x, y + rows - 1, w, K(ramp, t - 3))
    if ol: c.HL(x + int((rows - 1) * taper), y - 1, w - 2 * int((rows - 1) * taper), OL)


def face(c, x, y, w, h, ramp, t=0, kind='plain', seed=0, ol=True):
    """앞면(남쪽 면): 왼쪽 밝고 오른쪽·아래 어둡다. kind = plain|brick|plank|plate(리벳)|stone."""
    c.R(x, y, w, h, K(ramp, t - 1))
    c.VL(x, y, h, K(ramp, t + 1)); c.VL(x + w - 1, y, h, K(ramp, t - 3)); c.HL(x, y + h - 1, w, K(ramp, t - 3))
    c.HL(x, y, w, K(ramp, t - 3))        # 윗판 밑 그림자
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            r = hn(x + i, y + j, seed + 3)
            if kind == 'brick':
                row = (j - 1) // 3; off = (row % 2) * 3
                if (j - 1) % 3 == 2: c.P(x + i, y + j, K(ramp, t - 3)); continue
                if (i + off) % 6 == 0: c.P(x + i, y + j, K(ramp, t - 3)); continue
                if r > .8: c.P(x + i, y + j, K(ramp, t + 1))
            elif kind == 'plank':
                if i % 4 == 0: c.P(x + i, y + j, K(ramp, t - 2)); continue
                if r > .9: c.P(x + i, y + j, K(ramp, t + 1))
            elif kind == 'plate':
                if (j - 1) % 6 == 5: c.P(x + i, y + j, K(ramp, t - 3)); continue
                if i % 6 == 3 and (j - 1) % 6 in (0, 3): c.P(x + i, y + j, K(ramp, t + 3)); continue
            elif kind == 'stone':
                if r > .88: c.P(x + i, y + j, K(ramp, t + 1))
                elif r < .1: c.P(x + i, y + j, K(ramp, t - 2))
            else:
                if r > .93: c.P(x + i, y + j, K(ramp, t + 1))
    if ol:
        c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, OL); c.HL(x, y + h, w, OL)


def box(c, x, y, w, top, h, ramp, t=1, kind='plain', taper=0.3, seed=0):
    """윗면 top줄 + 앞면 h줄 상자."""
    face(c, x, y + top, w, h, ramp, t, kind, seed)
    slab(c, x, y, w, top, ramp, t + 1, taper, seed=seed)


def tex_ell(c, cx, cy, rx, ry, ramp, t=0, seed=0, light=(-.35, -.5)):
    """빛(왼쪽 위) 받는 결 있는 타원체 단면(구·기낭·돔)."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
            d = u * u + v * v
            if d > 1: continue
            s = (u * light[0] + v * light[1])          # -1..1 : 음수 = 빛 쪽
            tt = t + (1 if s < -.25 else 0) + (1 if s < -.55 else 0) - (1 if s > .25 else 0) - (1 if s > .6 else 0)
            r = hn(x, y, seed)
            if r > .9: tt += 1
            elif r < .06: tt -= 1
            c.P(x, y, K(ramp, tt))


def island(c, x, y, w, top_rows, cliff_h, seed=0, grass=True, trees=0, roots=True, tip=1.0, rock='rock'):
    """하늘섬 덩이: 윗면(풀 타원, top_rows줄) + 앞 절벽면(바위 줄무늬, 아래로 좁아지는 뿔) + 매달린 뿌리·바위.
    x,y = 왼쪽 위(윗면 뒤쪽 끝), w = 폭."""
    cx = x + w / 2; rx = w / 2; ry = top_rows / 2; cy = y + ry
    prof = []                                  # 열별 (윗면 앞끝 y, 절벽 바닥 y)
    for i in range(w):
        u = (i + .5 - rx) / rx
        fy = cy + ry * math.sqrt(max(0, 1 - u * u))
        bot = fy + cliff_h * tip * (1 - abs(u) ** 1.35) * (.82 + .3 * hn(i // 2, 7, seed)) + 1
        prof.append((fy, bot))
    for i in range(w):                         # 절벽면
        fy, bot = prof[i]
        for j in range(int(fy), int(bot)):
            u = (i + .5 - rx) / rx
            r = hn(i, j, seed + 5)
            tt = 0 + (1 if u < -.35 else 0) - (1 if u > .35 else 0) - (1 if u > .72 else 0)
            tt -= int((j - fy) / max(cliff_h, 1) * 1.8)             # 아래로 갈수록 어둡게
            if (i + (j // 5) * 3) % 7 == 0: tt -= 1                  # 세로 줄무늬(지층)
            if j % 5 == 4: tt -= 1                                   # 층 가로 줄
            if r > .9: tt += 1
            c.P(x + i, j, K(rock, tt))
    for i in range(w):                         # 윗면
        u = (i + .5 - rx) / rx
        h2 = ry * math.sqrt(max(0, 1 - u * u))
        for j in range(int(cy - h2), int(cy + h2) + 1):
            if not (cy - h2 <= j + .5 <= cy + h2): continue
            r = hn(i, j, seed + 11)
            v = (j + .5 - cy) / ry
            tt = 1 + (1 if v < -.2 else 0) + (1 if r > .87 else 0) - (1 if r < .08 else 0)
            if grass and abs(v) > .72 and r > .4: tt = 0                   # 앞쪽 가장자리 풀 어둡게
            c.P(x + i, j, K('grass' if grass else 'earth', tt))
    for i in range(0, w):                      # 앞 가장자리 어두운 입술(윗면↔절벽)
        fy, _ = prof[i]; c.P(x + i, int(fy) - 1, K('grass' if grass else 'earth', -2)); c.P(x + i, int(fy), K(rock, -3))
    if roots:
        for k in range(3 + w // 24):
            i = int(w * (.18 + .64 * hn(k, 3, seed))); fy, bot = prof[min(w - 1, i)]
            ln = 3 + int(hn(k, 9, seed) * 5); px = x + i
            for q in range(ln): c.P(px + (q // 3) % 2, int(bot) + q - 1, K('earth', -1 - q // 3))
    c.outline()


def roof(c, x, y, w, rows, ramp, t=1, seed=0, ridge=True):
    """지붕: 윗면이 보이는 사다리꼴 지붕면(타일 줄) + 앞 처마."""
    slab(c, x, y, w, rows, ramp, t, taper=.55, lip=True, grain=False, seed=seed)
    for j in range(2, rows - 1, 2):
        ins = int((rows - 1 - j) * .55)
        for i in range(x + ins + 1, x + w - ins - 1):
            if (i + j) % 3: c.P(i, y + j, K(ramp, t - 1))
    if ridge: c.HL(x + int((rows - 1) * .55) + 2, y, w - 2 * int((rows - 1) * .55) - 4, K(ramp, t + 3))


def window(c, x, y, w=4, h=5, lit=False):
    c.R(x - 1, y - 1, w + 2, h + 2, K('wood', -3))
    c.R(x, y, w, h, K('sky', 1) if not lit else K('brass', 3))
    c.HL(x, y, w, K('sky', 3) if not lit else K('brass', 4)); c.VL(x + w // 2, y, h, K('wood', -2))


def door(c, x, y, w=5, h=8, ramp='wood'):
    c.R(x - 1, y - 1, w + 2, h + 1, K('iron', -3)); c.R(x, y, w, h, K(ramp, -1))
    for i in range(x + 1, x + w, 2): c.VL(i, y, h, K(ramp, -2))
    c.P(x + w - 2, y + h // 2, K('brass', 3))


def plinth(c, x, y, w, ramp='rock', top=6, front=5, t=2, kind='stone', seed=0):
    """받침 바닥판: 윗면 top줄(밝고 결 있음) + 앞면 front줄. 위에 서는 기둥들이 이 윗면 위에 선다."""
    box(c, x, y, w, top, front, ramp, t, kind, taper=.3, seed=seed)

"""v2 부품 공통 도구: 외곽 1px 윤곽, 정확한 원, 기와 지붕, 기둥, 윗면 조각."""
import random, math
import numpy as np
from paint2 import *
import tune, post as _post

DARK = lambda: K('tekko', -3)
def ink2(c, ext=True, edge=2, inner=2, soft=1, sides=True):
    """내부 경계 잉크 + (옵션) 바깥 1px 어두운 윤곽. 캔버스 가장자리 1px 는 비워 둘 것."""
    o = Cv(c.w, c.h); o.a[:] = tune.ink(_post.contour(c.a), edge=edge, inner=inner, soft=soft)
    if ext:
        al = o.a[..., 3] > 0; pad = np.pad(al, 1); nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        if sides: edge_px = nb & ~al
        else:
            up = np.pad(al, 1)[:-2, 1:-1] | np.pad(al, 1)[2:, 1:-1]; edge_px = up & ~al
        o.a[edge_px] = (*rgb(DARK()), 255)
    return o

def disc(c, cx, cy, r, col, hi=None, lo=None, split=.5):
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            dx, dy = x + .5 - cx, y + .5 - cy
            if dx * dx + dy * dy <= r * r:
                k = col; s = dx + dy
                if hi is not None and s < -r * split: k = hi
                elif lo is not None and s > r * split * 1.1: k = lo
                c.P(x, y, k)

def ellipse(c, cx, cy, rx, ry, col, hi=None, lo=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                k = col; s = dx + dy
                if hi is not None and s < -.7: k = hi
                elif lo is not None and s > .75: k = lo
                c.P(x, y, k)

def wheel(c, x, y, r=4):
    """속찬 타이어 + 허브. 짝수 지름 원(반픽셀 중심)이라 상하좌우 돌기가 없다."""
    for yy in range(-r, r):
        for xx in range(-r, r):
            d = (xx + .5) ** 2 + (yy + .5) ** 2
            if d <= r * r: c.P(x + xx, y + yy, K('sumi', 0) if d > (r - 1.6) ** 2 else K('conc', 1) if d > (r * .35) ** 2 else K('conc', 4))

def tile_roof(c, x0, y0, w, h, inset, ramp='tairu', t=0, ridge=True, onigawara=True, flare=0, hip=True):
    """맞배/우진각 기와 사다리꼴(앞면 경사). inset(j) = j번째 줄에서 좌우로 줄어드는 폭(위가 좁다).
    기와: 세로 골(3px 주기, 왼쪽 밝고 오른쪽 어둡다) + 가로 단(4px)."""
    for j in range(h):
        ins = inset(j)
        xs, xe = x0 + ins, x0 + w - ins
        for x in range(xs, xe):
            k = (x - xs) % 3
            tt = t + (1 if k == 0 else -1 if k == 2 else 0)
            if j % 4 == 0: tt -= 1
            if j < 1: tt += 2
            if j >= h - 2: tt -= 2 if j == h - 1 else 1
            if x - xs < 2: tt += 1
            if xe - x <= 2: tt -= 1
            if hip and (x - xs < 1 or xe - x <= 1) and j > 1: tt -= 2
            c.P(x, y0 + j, K(ramp, tt))
    if ridge:
        ins = inset(0)
        c.R(x0 + ins - 1, y0 - 3, w - 2 * ins + 2, 4, K(ramp, t + 1)); c.HL(x0 + ins - 1, y0 - 3, w - 2 * ins + 2, K(ramp, t + 3)); c.HL(x0 + ins - 1, y0, w - 2 * ins + 2, K(ramp, t - 2))
        for i in range(x0 + ins, x0 + w - ins, 4): c.VL(i, y0 - 2, 2, K(ramp, t - 1))
        if onigawara:
            for xx in (x0 + ins - 3, x0 + w - ins):
                c.R(xx, y0 - 7, 3, 7, K('tekko', 2)); c.HL(xx, y0 - 7, 3, K('tekko', 4)); c.P(xx + 1, y0 - 5, K('kii', 3))

def pillar(c, x, y, h, w=4, ramp='aka'):
    c.R(x, y, w, h, K(ramp, 1)); c.VL(x, y, h, K(ramp, 3)); c.VL(x + w - 1, y, h, K(ramp, -1)); c.HL(x, y, w, K(ramp, 3))
    c.R(x - 1, y + h - 3, w + 2, 3, K('conc', 3)); c.HL(x - 1, y + h - 3, w + 2, K('shiro', 3)); c.HL(x - 1, y + h - 1, w + 2, K('conc', -1))

def chochin(c, cx, y, w, h, ramp='aka', txt=None, tcol=None):
    """제등: 주름 가로 띠 + 좌측 하이라이트 + 닫힌 윤곽 + 위아래 뚜껑."""
    for j in range(h):
        k = (j + .5) / h; ww = max(2, int(w / 2 * (1 - .22 * (2 * k - 1) ** 2)))
        for i in range(-ww, ww):
            tt = 1
            if i < -ww * .45: tt = 2
            if i >= ww * .45: tt = 0
            if i == ww - 1: tt = -1
            if i == -ww: tt = 3
            if j % 5 == 4: tt -= 1
            c.P(cx + i, y + j, K(ramp, tt))
    c.R(cx - w // 3, y - 2, 2 * (w // 3), 3, K('tekko', 1)); c.HL(cx - w // 3, y - 2, 2 * (w // 3), K('tekko', 3))
    c.R(cx - w // 3, y + h - 1, 2 * (w // 3), 3, K('tekko', 1)); c.HL(cx - w // 3, y + h - 1, 2 * (w // 3), K('tekko', -1))
    if txt:
        n = len(txt); gh = min(14, (h - 6) // n)
        for kk, ch in enumerate(txt): gl(c, cx - 8, y + 4 + kk * (gh + 1), ch, tcol or K('sumi', 1))

def text_flat(c, x, y, s, col, shadow=None, gap=0, step=16):
    """굵기 없이 한 글자씩(그림자 선택)."""
    for k, ch in enumerate(s):
        if shadow is not None: gl(c, x + k * (step + gap) + 1, y + 1, ch, shadow)
        gl(c, x + k * (step + gap), y, ch, col)

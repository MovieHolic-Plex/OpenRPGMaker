"""조선 실내 기물 그리기 도구 — 3/4 시점(윗면 + 앞면), 빛 왼쪽 위. 램프 색은 tk.RGB(잠긴 팔레트)에서만 고른다.

규칙(실내 v5 · RTP 규칙 숫자 읽기): 윗면은 왼쪽·뒤 가장자리에 밝은 1px, 앞면은 왼쪽 밝고 오른쪽 어둡다, 윗면 바로 밑 앞 가장자리 밝은 입술 1줄,
맨 밑 접지 어둠 1줄, 바닥 가구는 윤곽을 안쪽 0.62 배(build.outline) — 바깥에 어두운 링을 두르지 않는다. 장식(쇠장식·살)은 2px 이상.
"""
import math
from tk import *
from build import outline
from props5 import ell, shadow_ell

Wd = RGB['wood']; Ea = RGB['earth']; Pl = RGB['plaster']; St = RGB['stone']; Gi = RGB['giwa']; Sr = RGB['straw']
Pe = RGB['persimmon']; Rd = RGB['red']; Dg = RGB['dgreen']; Db = RGB['dblue']; Le = RGB['leaf']; Pi = RGB['pine']; Wa = RGB['water']


def new(wc, hc):
    return Cv(wc * T, hc * T)


def contact(c, x0, x1, y, rows=2):
    """바닥 접지 그림자(오른쪽 아래로 부드럽게). 이미 그림이 있는 화소는 건드리지 않는다."""
    for j in range(rows):
        for x in range(x0, x1):
            if 0 <= y + j < c.h and c.a[y + j, x, 3] == 0:
                c.put(x, y + j, SHADOW, (80, 40)[j])


def block(c, x, y, w, h, d, ramp, top=(6, 5), face=(5, 4, 3, 2), lip=True, ground=True):
    """3/4 직육면체. (x, y) = 윗면 좌상단, 폭 w, 윗면 깊이 d 줄, 앞면 높이 h 줄."""
    for r in range(d):
        for k in range(w):
            c.put(x + k, y + r, ramp[top[0] if (r == 0 or k == 0) else top[1]])
    for r in range(h):
        yy = y + d + r
        for k in range(w):
            f = k / max(1, w - 1)
            t = face[0] if f < 0.18 else (face[1] if f < 0.6 else (face[2] if f < 0.9 else face[3]))
            if r == 0 and lip:
                t = top[1] if k > 0 else top[0]
            elif r == h - 1 and ground:
                t = max(1, t - 2)
            c.put(x + k, yy, ramp[t])


def frame(c, x, y, w, h, ramp, fill=None, hl=6, mid=4, sh=2):
    """작은 틀(서랍·문짝): 왼쪽·위 밝은 1px, 오른쪽·아래 어두운 1px. fill 이면 속을 채운다(램프 색 하나)."""
    if fill is not None:
        for yy in range(y + 1, y + h - 1):
            for xx in range(x + 1, x + w - 1):
                c.put(xx, yy, fill)
    c.hl(x, x + w, y, ramp[hl]); c.vl(x, y, y + h, ramp[hl])
    c.hl(x, x + w, y + h - 1, ramp[sh]); c.vl(x + w - 1, y, y + h, ramp[sh])


def brass(c, x, y, w=2, h=2):
    """쇠장식(경첩·자물쇠판): 밝은 놋 면 + 아래 한 줄 그늘."""
    for j in range(h):
        for i in range(w):
            c.put(x + i, y + j, Pe[5] if j == 0 else Pe[3])


def planks(c, x0, y0, x1, y1, ramp, tones=(5, 4), seam=2, vert=True, step=4, seed=0):
    """널 무늬: 세로(또는 가로) 널 step px, 줄눈 seam 톤, 널마다 한 톤씩 번갈아."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = (x - x0) // step if vert else (y - y0) // step
            pos = (x - x0) % step if vert else (y - y0) % step
            tone = tones[(k + seed) % len(tones)]
            if pos == step - 1:
                tone = seam
            c.put(x, y, ramp[tone])


def cloth(c, x0, y0, x1, y1, ramp, edge=True, seed=0):
    """천: 평평한 중앙 + 가장자리 ~2px 한 톤 어두움 + 얕은 주름 한 줄."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            e = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
            t = 4 if e >= 2 else 3
            if x == x0 or y == y0: t = 5
            q = rnd(x, y, 13 + seed)
            c.put(x, y, ramp[t if q > 0.08 else max(1, t - 1)])


def round_top(c, cx, cy, rx, ry, ramp, tones=(6, 5, 4), rim=True):
    """둥근 윗면(타원): 왼쪽 위 밝음 + 가장자리 한 톤."""
    def fn(x, y, u, v):
        edge = u * u + v * v > 0.72
        if u < -0.45 or v < -0.55:
            return ramp[tones[0]]
        return ramp[tones[2]] if edge and rim and v > 0.2 else ramp[tones[1]]
    ell(c, cx, cy, rx, ry, fn)


def bowl(c, x, y, ramp=None, soup=False, rice=False):
    """사발 한 개(6×4): 입 타원 + 몸 + 굽. 국/밥이 담겼다."""
    r = ramp or Pl
    for xx in range(x + 1, x + 5):
        c.put(xx, y + 2, r[4]); c.put(xx, y + 3, r[3])
    c.put(x, y + 1, r[5]); c.put(x + 5, y + 1, r[3])
    for xx in range(x + 1, x + 5):
        c.put(xx, y, r[6]); c.put(xx, y + 1, (Sr[5] if rice else (Pe[3] if soup else r[4])))
    c.put(x + 1, y + 1, r[6] if not (soup or rice) else (Pl[6] if rice else Pe[4]))


def bottle(c, x, y, h=5, ramp=None):
    """술병/약병(3×h): 목 좁고 몸 넓은 병."""
    r = ramp or Dg
    for j in range(h):
        w = 1 if j < 2 else 3
        xx = x + (1 if w == 1 else 0)
        for k in range(w):
            c.put(xx + k, y + j, r[5] if k == 0 else (r[4] if k < w - 1 else r[3]))
    c.put(x + 1, y, Wd[5])


def books(c, x, y, n=4, h=5, seed=0):
    """책 더미(앞면): 한지 책등 — 아이보리·붉은 끈. n 권, 키 h."""
    cols = (Pl[5], Pl[4], Sr[6], Pl[5])
    for k in range(n):
        for j in range(h):
            c.put(x + k * 2, y + j, cols[(k + seed) % 4])
            c.put(x + k * 2 + 1, y + j, Pl[3])
        c.put(x + k * 2, y + 1, Rd[4])
    return n * 2


def flame(c, x, y, big=False):
    c.put(x, y, Pe[5]); c.put(x, y + 1, Pe[4])
    if big:
        c.put(x, y - 1, Pe[6]); c.put(x - 1, y + 1, Pe[3]); c.put(x + 1, y + 1, Pe[3])


def sack(c, x, y, w=8, h=8, ramp=None, tie=True):
    """자루: 불룩한 몸통 + 묶은 목."""
    r = ramp or Sr
    for j in range(h):
        hw = w / 2.0 * (0.45 if j < 2 else (0.85 if j < 4 else 1.0))
        for i in range(w):
            u = (i + 0.5 - w / 2.0)
            if abs(u) <= hw:
                f = i / max(1, w - 1)
                t = 6 if (f < 0.2 and j > 1) else (5 if f < 0.55 else (4 if f < 0.85 else 3))
                c.put(x + i, y + j, r[t])
    if tie:
        c.hl(x + int(w / 2) - 1, x + int(w / 2) + 2, y + 2, Wd[3])

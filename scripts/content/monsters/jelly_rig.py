"""젤리·우즈 몸(슬라임 계열) 공용 도구. 윤곽은 종 스크립트가 직접 정한다 — 여기는 칠하기·얼굴·방울만.

- jelly(): 윤곽 다각형 → 외곽선 + 세로 명암 + 몸속 기포 + 반사광(몸 안에서만).
- eyes(): 얼굴 축(몸의 오른쪽 앞) 위 두 눈. 앞을 보는 옆모습이라 앞눈이 크고 뒷눈은 몸 굴곡에 반쯤 가린다.
- beads(): 입·몸에서 앞으로 이어지는 방울 줄기(서로 겹쳐서 한 덩어리로 이어진다).
"""
from __future__ import annotations

import math

import numpy as np

from pixel_lib import add, ellipse, lerp, poly, rnd

WHITE = (255, 255, 255)


def superblob(cx, base, w, h, n=2.0, lean=0.0, peak=0.0, flare=0.0, steps=32):
    """바닥이 평평한 반 초타원(n 이 클수록 어깨가 각진다). lean 은 윗부분을 앞뒤로, peak 은 정수리 뾰족함,
    flare 는 바닥 가장자리가 옆으로 퍼지는 정도."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = math.pi * t
        c, s = math.cos(a), math.sin(a)
        x = cx + math.copysign(abs(c) ** (2 / n), c) * w / 2
        k = abs(s) ** (2 / n)
        y = base - k * h - peak * max(0.0, s - 0.86) * h * 2.4
        x += lean * k ** 2
        if s < 0.35:
            x += math.copysign(flare * (0.35 - s) / 0.35, c)
        pts.append((x, y))
    return pts


def jelly(cv, pts, ramp, ink, bubbles=(), shine=None, core=None):
    M = cv.part(poly(cv.blank(), pts), ramp, ink=ink, gloss=False)
    if core:
        c, rx, ry, col = core
        _inside(cv, ellipse(cv.blank(), c, rx, ry), M, col)
    for (x, y), r, col in bubbles:
        if r <= 0.6:
            p = rnd((x, y))
            if M[p[1], p[0]]:
                cv.pixel(*p, col)
        else:
            _inside(cv, ellipse(cv.blank(), (x, y), r, r), M, col)
            p = rnd((x - r * 0.4, y - r * 0.4))
            if M[p[1], p[0]]:
                cv.pixel(*p, WHITE)
    if shine:
        x, y = rnd(shine[0])
        for d in shine[1]:
            p = (x + d[0], y + d[1])
            if M[p[1], p[0]]:
                cv.pixel(*p, ramp[3])
    return M


def _inside(cv, m, M, col):
    A = (np.array(m) > 0) & M
    cv.rgb[A] = col


def eyes(cv, near, far, kind, color, white=WHITE, size=2, brow=None):
    """near = 앞눈 중심, far = 뒷눈 중심. kind: open·angry·shut·x·wide."""
    for k, e in enumerate((far, near)):
        e = rnd(e)
        s = size if k else max(1, size - 1)
        if kind == "shut":
            cv.line([add(e, (-s + 1, 0)), add(e, (s - 1, 1))], color)
        elif kind == "x":
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], color)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], color)
        else:
            top = -s if kind != "angry" else -s + 1
            cv.put(poly(cv.blank(), [add(e, (-1 if k else 0, top)), add(e, (1, top - (1 if kind == "angry" and k else 0))),
                                     add(e, (1, s)), add(e, (-1 if k else 0, s))]), color)
            if kind == "wide":
                cv.pixel(e[0], e[1], white)
            else:
                cv.pixel(e[0] + (0 if k else 0), e[1] - s + 1, white)
    if brow:
        for e in (far, near):
            e = rnd(e)
            cv.line([add(e, (-2, -size - 2 + brow)), add(e, (2, -size - 1 - brow))], color)


def beads(cv, a, b, r0, r1, ramp, n=5, wobble=0.0):
    """a→b 로 점점 커지는(또는 작아지는) 방울을 겹쳐 잇는다. ramp = (바깥, 속, 빛)."""
    pts = []
    for i in range(n):
        t = i / (n - 1)
        c = lerp(a, b, t)
        c = (c[0], c[1] + math.sin(t * math.pi * 2) * wobble)
        r = r0 + (r1 - r0) * t
        cv.put(ellipse(cv.blank(), c, r, r * 0.85), ramp[0])
        pts.append((c, r))
    for c, r in pts:
        if r >= 1.4:
            cv.put(ellipse(cv.blank(), add(c, (-0.4, -0.4)), r * 0.55, r * 0.45), ramp[1])
            cv.pixel(*rnd(add(c, (-r * 0.4, -r * 0.45))), ramp[2])
    return pts[-1][0]


def puddle(cv, cx, base, w, h, ramp, ink, bumps=()):
    """녹아 퍼진 웅덩이(죽음): 낮은 반타원 + 위로 남은 혹."""
    pts = superblob(cx, base, w, h, n=2.6, flare=2.0)
    M = cv.part(poly(cv.blank(), pts), ramp, ink=ink, gloss=False)
    for (x, r) in bumps:
        cv.part(ellipse(cv.blank(), (x, base - h - r * 0.4), r, r * 0.8), ramp, ink=ink, gloss=False)
    return M

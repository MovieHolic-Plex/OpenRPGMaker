"""떠 있는 원소 정령(불·물·바람·땅·빛·어둠) 공용 뼈대 + 원소 결 명암.

다리 대신 소용돌이 꼬리로 떠 있는 상반신 정령이 오른쪽(아군)을 본다:
꼬리(엉덩이에서 뒤로 말려 올라감) -> 몸통(넓은 어깨, 가는 허리) -> 머리(앞으로 뾰족한 턱) -> 위팔·아래팔·손.
종마다 머리칼(불길·물마루 등)·손 모양·명암 결(field)을 넘긴다.

명암은 부위별 세로 단면이 아니라 '깊이(가장자리에서 몇 칸 안쪽) + 원소 결 무늬 + 심장 열기'를
띠로 나눈다. 가장자리는 어둡고 속은 밝아 몸 자체가 빛나 보인다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from pixel_lib import add, bezier, chain, ellipse, polar, poly

S = 64
GROUND = S - 4


@dataclass
class EPose:
    c: tuple = (30.0, 34.0)       # 가슴 가운데
    lean: float = 0.0             # +는 앞(오른쪽)으로 숙임
    k: float = 1.0                # 몸 크기 배율(부풀기·움츠림)
    arm_n: tuple = (60.0, 20.0)   # 가까운 팔 (위팔 각, 아래팔 각)
    arm_f: tuple = (120.0, 80.0)
    tail: float = 0.0             # 꼬리 흔들림(+ 뒤로 더 말림)
    seed: int = 0                 # 불길·물결 무늬 흔들림
    extra: dict = field(default_factory=dict)


def rot(c, ang):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return lambda dx, dy: (c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca)


def skeleton(P: EPose):
    R = rot(P.c, P.lean)
    k = P.k
    j = dict(c=P.c, R=R, k=k)
    j["head"] = R(2 * k, -15 * k)
    j["sh_n"] = R(5 * k, -7 * k)
    j["sh_f"] = R(-4 * k, -8 * k)
    j["hip"] = R(0, 7 * k)
    j["core"] = R(1 * k, -2 * k)
    for side, ang in (("n", P.arm_n), ("f", P.arm_f)):
        s = j["sh_" + side]
        e = polar(s, ang[0], 8 * k)
        j["el_" + side] = e
        j["hand_" + side] = polar(e, ang[1], 7 * k)
    h, sw = j["hip"], P.tail
    j["tail"] = [h, add(h, (-1 + sw * 0.3, 8 * k)), add(h, (-6 + sw * 0.7, 14 * k)), add(h, (-12 + sw, 15 * k)),
                 add(h, (-16 + sw * 1.2, 11 * k))]
    return j


def tongue(cv, base, ang, ln, w, curl=0.0):
    """밑이 넓고 끝이 뾰족한 혀(불길·물마루·손톱). curl 은 끝을 옆으로 휘는 정도(+ 왼쪽 손 기준 시계)."""
    tip = polar(base, ang, ln)
    mid = polar(lerp_(base, tip, 0.55), ang + 90, curl)
    spine = bezier(base, mid, tip, 10)
    left, right = [], []
    for i, p in enumerate(spine):
        t = i / (len(spine) - 1)
        q = spine[min(i + 1, len(spine) - 1)] if i < len(spine) - 1 else p
        pr = spine[i - 1] if i else p
        dx, dy = q[0] - pr[0], q[1] - pr[1]
        n = math.hypot(dx, dy) or 1
        ww = w * (1 - t) ** 0.9 / 2 + 0.25
        left.append((p[0] - dy / n * ww, p[1] + dx / n * ww))
        right.append((p[0] + dy / n * ww, p[1] - dx / n * ww))
    return poly(cv.blank(), left + right[::-1])


def lerp_(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def m(cv, im):
    return np.array(im) > 0


def torso_mask(cv, j):
    R, k = j["R"], j["k"]
    pts = [R(-7 * k, -10 * k), R(1 * k, -12 * k), R(7 * k, -9 * k), R(8 * k, -4 * k), R(5 * k, 3 * k), R(3 * k, 8 * k),
           R(-3 * k, 8 * k), R(-6 * k, 3 * k), R(-8 * k, -4 * k)]
    return m(cv, poly(cv.blank(), pts))


def head_mask(cv, j, chin=True):
    k, hc = j["k"], j["head"]
    M = m(cv, ellipse(cv.blank(), hc, 5.2 * k, 5.6 * k))
    if chin:  # 앞으로 뾰족한 턱
        M |= m(cv, poly(cv.blank(), [add(hc, (1 * k, 2 * k)), add(hc, (6.5 * k, 3 * k)), add(hc, (2 * k, 6.5 * k))]))
    return M


def tail_mask(cv, j, widths=(7.0, 6.0, 4.2, 2.4, 1.0)):
    k = j["k"]
    pts = bezier(j["tail"][0], j["tail"][1], j["tail"][2], 6) + bezier(j["tail"][2], j["tail"][3], j["tail"][4], 6)[1:]
    ws = np.interp(np.linspace(0, 1, len(pts)), np.linspace(0, 1, len(widths)), [w * k for w in widths])
    return m(cv, chain(pts, list(ws)))


def arm_mask(cv, j, side, widths=(3.8, 3.2, 2.6)):
    k = j["k"]
    return m(cv, chain([j["sh_" + side], j["el_" + side], j["hand_" + side]], [w * k for w in widths]))


def dilate(M):
    r = M.copy()
    r[1:] |= M[:-1]
    r[:-1] |= M[1:]
    r[:, 1:] |= M[:, :-1]
    r[:, :-1] |= M[:, 1:]
    return r


def depth(M, n=9):
    d = np.zeros(M.shape, float)
    cur = M.copy()
    for _ in range(n):
        d[cur] += 1
        er = cur.copy()
        er[1:] &= cur[:-1]
        er[:-1] &= cur[1:]
        er[:, 1:] &= cur[:, :-1]
        er[:, :-1] &= cur[:, 1:]
        cur = er
        if not cur.any():
            break
    return d


def grid():
    y, x = np.mgrid[0:S, 0:S].astype(float)
    return x, y


def heat(c, r, amp):
    x, y = grid()
    return amp * np.exp(-((x - c[0]) ** 2 + (y - c[1]) ** 2) / (2 * r * r))


def shade(cv, M, ramp, fieldv, ink):
    """M 바깥 1px 은 ink, 안은 fieldv 를 정수 띠로 잘라 ramp(어둠 -> 빛) 색으로."""
    cv.put(dilate(M) & ~M, ink)
    idx = np.clip(np.floor(fieldv), 0, len(ramp) - 1).astype(int)
    for i, col in enumerate(ramp):
        cv.put(M & (idx == i), col)


def top_edge(M):
    """마스크의 윗가장자리(바로 위가 비어 있는 칸) - 물마루 거품·하이라이트용."""
    e = M.copy()
    e[1:] &= ~M[:-1]
    return e


def paint(cv, M, ramp, fieldv, ink, rim=None):
    """한 부위를 앞에 덧그린다: 외곽선 + 띠 명암 + (rim 이 있으면) 윗가장자리 빛."""
    shade(cv, M, ramp, fieldv, ink)
    if rim is not None:
        cv.put(top_edge(M) & (fieldv >= 1), rim)


def body_field(M, base=0.6, dstep=0.5, dcap=4, tilt=1.2, extra=None, ref=None):
    """깊이(가장자리 어둡고 속 밝음) + 빛(오른쪽 위가 밝음) + 무늬 extra. ref: 빛 기준 몸 전체 마스크."""
    x, y = grid()
    d = np.minimum(depth(M, dcap), dcap)
    ys, xs = np.nonzero(M if ref is None else ref)
    side = 0.0
    if len(xs):
        cx, cy = xs.mean(), ys.mean()
        w = max(np.ptp(xs), np.ptp(ys), 1)
        side = ((x - cx) - (y - cy)) / w
    f = base + d * dstep + side * tilt
    if extra is not None:
        f = f + extra
    return f

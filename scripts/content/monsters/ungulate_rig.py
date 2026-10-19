"""발굽 짐승(말·유니콘·사슴·산양·켄타우로스 하체) 옆모습 관절 뼈대.

늑대 뼈대(redraw_wolf_grey.py)와 다른 점: 다리가 길고 곧으며 앞다리는 무릎(완골)이 앞으로 접히고, 뒷다리는
높은 비절(hock)이 뒤로 꺾인 뒤 긴 정강이뼈 끝에 발굽이 있다. 몸통은 통 같은 배 + 높은 기갑, 목은 위로 솟는다.
종마다 Build 의 비율(다리 길이·몸 길이·목 길이)과 Look 의 칠하기 함수를 다르게 준다.

좌표: 엉덩이 관절 hip, 어깨 관절 sh(둘 다 몸통 위쪽), 발 좌표 4개(가까운 앞·먼 앞·가까운 뒤·먼 뒤).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from pixel_lib import add, chain, ellipse, ik_side, lerp, polar, poly, rnd


@dataclass
class Build:
    s: float = 1.0           # 축척(96 칸 = 1.5)
    upper: float = 8.0       # 앞다리 위(어깨~무릎)
    lower: float = 9.0       # 앞다리 아래(무릎~발)
    thigh: float = 8.0       # 뒷다리 허벅지(엉덩이~비절)
    cannon: float = 9.0      # 비절~발
    leg_w: float = 3.0       # 다리 굵기(위)
    belly: float = 7.0       # 몸통 두께(위아래 반지름)
    hoof: str = "solid"      # solid(말) / split(갈라진 발굽)


@dataclass
class Look:
    ramp: list
    far: list
    ink: tuple
    hoof: list
    belly: tuple | None = None
    extra: dict = field(default_factory=dict)


def leg_front(cv, B: Build, L: Look, sh, foot, far, lift=0.0):
    ramp = L.far if far else L.ramp
    knee = ik_side(sh, foot, B.upper * B.s, B.lower * B.s, forward=True)
    cv.part(chain([sh, knee], [B.leg_w * B.s * 1.3, B.leg_w * B.s * 0.8]), ramp, ink=L.ink, gloss=False)
    cv.part(chain([knee, foot], [B.leg_w * B.s * 0.8, B.leg_w * B.s * 0.7]), ramp, ink=L.ink, gloss=False)
    hoof(cv, B, L, foot, far, lift)
    return knee


def leg_hind(cv, B: Build, L: Look, hip, foot, far, lift=0.0):
    ramp = L.far if far else L.ramp
    hock = add(foot, (-2.5 * B.s - lift * 2, -B.cannon * B.s * 0.95 + lift))
    stifle = ik_side(hip, hock, B.thigh * B.s * 0.6, B.thigh * B.s * 0.6, forward=True)
    cv.part(chain([hip, stifle], [B.leg_w * B.s * 2.0, B.leg_w * B.s * 1.2]), ramp, ink=L.ink, gloss=False)
    cv.part(chain([stifle, hock], [B.leg_w * B.s * 1.2, B.leg_w * B.s * 0.8]), ramp, ink=L.ink, gloss=False)
    cv.part(chain([hock, foot], [B.leg_w * B.s * 0.8, B.leg_w * B.s * 0.7]), ramp, ink=L.ink, gloss=False)
    hoof(cv, B, L, foot, far, lift)
    return hock


def hoof(cv, B, L, foot, far, lift):
    s = B.s
    f = rnd(foot)
    w = 1.6 * s
    h = 2.0 * s
    pts = [(f[0] - w, f[1] - h), (f[0] + w, f[1] - h), (f[0] + w + 1, f[1]), (f[0] - w, f[1])]
    cv.part(poly(cv.blank(), pts), L.hoof, ink=L.ink, gloss=False)
    if B.hoof == "split" and not far:
        cv.pixel(f[0] + 1, f[1] - 1, L.ink)


def barrel(cv, B: Build, L: Look, hip, sh):
    """통 몸통: 엉덩이 둥근 덩어리 + 기갑 + 배 아랫선."""
    s = B.s
    bw = B.belly * s
    mid = lerp(hip, sh, 0.5)
    pts = [add(hip, (-3 * s, -1 * s)), add(hip, (0, -2.5 * s)), add(mid, (0, -1.5 * s)), add(sh, (-1 * s, -3.5 * s)), add(sh, (3 * s, -1 * s)),
           add(sh, (3 * s, bw * 0.9)), add(mid, (2 * s, bw * 1.3)), add(mid, (-4 * s, bw * 1.25)), add(hip, (1 * s, bw * 1.0)), add(hip, (-4 * s, bw * 0.6))]
    M = cv.part(poly(cv.blank(), pts), L.ramp, ink=L.ink, belly=L.belly)
    cv.part(ellipse(cv.blank(), add(hip, (-0.5 * s, 1.5 * s)), 4.5 * s, 4.2 * s), L.ramp, ink=L.ink, belly=L.belly)  # 엉덩이 근육
    return M


def neck(cv, B: Build, L: Look, sh, poll, w0=6.0, w1=4.0):
    s = B.s
    base = add(sh, (1 * s, -1 * s))
    return cv.part(chain([base, lerp(base, poll, 0.5), poll], [w0 * s, (w0 + w1) / 2 * s, w1 * s]), L.ramp, ink=L.ink, gloss=False)


@dataclass
class Pose:
    hip: tuple
    sh: tuple
    feet: tuple          # (가까운 앞, 먼 앞, 가까운 뒤, 먼 뒤)
    lift: tuple = (0, 0, 0, 0)
    poll: tuple | None = None   # 머리 뒤쪽(목 끝)
    tilt: float = 0.0
    extra: dict = field(default_factory=dict)


def draw_body(cv, B: Build, L: Look, P: Pose, *, tail=None, front_part=None):
    """먼 다리 → 꼬리 → 몸통 → 가까운 다리 → (front_part: 목·머리 또는 사람 상체). 관절 dict 반환."""
    s = B.s
    shf, hipf = add(P.sh, (-1.5 * s, -0.5 * s)), add(P.hip, (-1.5 * s, -0.5 * s))
    leg_front(cv, B, L, add(shf, (0, 3 * s)), P.feet[1], True, P.lift[1])
    leg_hind(cv, B, L, add(hipf, (0, 2 * s)), P.feet[3], True, P.lift[3])
    if tail:
        tail(cv, P)
    barrel(cv, B, L, P.hip, P.sh)
    leg_hind(cv, B, L, add(P.hip, (0, 2 * s)), P.feet[2], False, P.lift[2])
    leg_front(cv, B, L, add(P.sh, (0, 3 * s)), P.feet[0], False, P.lift[0])
    J = dict(hip=P.hip, sh=P.sh)
    if front_part:
        J.update(front_part(cv, P) or {})
    return J

#!/usr/bin/env python3
"""자수정 골렘(golem-crystal) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

보라 자수정 결정을 쌓은 거인: 넓은 흉곽 결정 덩어리(빛 받는 면은 밝은 라일락, 그늘 면은 짙은 보라),
비대칭 어깨(가까운 어깨에서 뾰족한 자수정 기둥 다발이 솟고 먼 어깨는 낮은 결정 판),
작은 머리 결정에 빛나는 분홍 눈 틈, 가슴 한가운데 박힌 하얀 심장 결정, 손끝은 긴 결정 손가락 셋.
6번 칸(스킬): 두 팔을 벌려 가슴 심장 결정을 빛내자 아군 쪽 바닥에서 자수정 가시가 솟는다.

  python3 scripts/content/monsters/redraw_golem_crystal.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, crack, ellipse, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (24, 14, 36)
GEM = [(72, 38, 110), (112, 62, 160), (160, 104, 206), (214, 170, 240)]
GEM_FAR = [(52, 28, 82), (72, 38, 110), (92, 50, 136), (92, 50, 136)]
CORE = [(200, 150, 240), (240, 220, 255), (255, 255, 255)]
EYE = (255, 150, 220)
DUST = [(110, 96, 120), (160, 144, 170)]
CRACK = INK
WHITE = (255, 255, 255)
GROUND = 60


def rot(c, ang):
    a = math.radians(ang)
    return lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))


def facet(cv, pts, ramp, split=None):
    """결정 덩어리 하나: 다각형 + 가운데 모서리 한 줄(밝은 면/그늘 면 경계)."""
    M = cv.part(poly(cv.blank(), pts), ramp, gloss=False)
    if split:
        cv.line4([rnd(split[0]), rnd(split[1])], ramp[3])
    return M


def shard(cv, base, ang, ln, w, ramp):
    """뾰족한 결정 기둥 하나(밑동 폭 w, 끝 뾰족)."""
    tip = polar(base, ang, ln)
    l, r = polar(base, ang - 90, w / 2), polar(base, ang + 90, w / 2)
    ml, mr = polar(l, ang, ln * 0.7), polar(r, ang, ln * 0.7)
    cv.part(poly(cv.blank(), [l, ml, tip, mr, r]), ramp, gloss=False)
    cv.line4([rnd(polar(base, ang, 1)), rnd(polar(base, ang, ln - 1.5))], ramp[3])
    return tip


def block(cv, a, b, w, ramp):
    """a→b 를 잇는 육각 결정 마디(양 끝이 뾰족)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    ux, uy = dx / n * 2, dy / n * 2
    pts = [add(a, (-ux, -uy)), add(a, (nx + ux * 0.4, ny + uy * 0.4)), add(b, (nx - ux * 0.4, ny - uy * 0.4)),
           add(b, (ux, uy)), add(b, (-nx - ux * 0.4, -ny - uy * 0.4)), add(a, (-nx + ux * 0.4, -ny + uy * 0.4))]
    return facet(cv, pts, ramp)


def leg(cv, hip, knee, foot, far):
    ramp = GEM_FAR if far else GEM
    block(cv, hip, knee, 7.0, ramp)
    block(cv, knee, add(foot, (0, -3)), 6.5, ramp)
    f = rnd(foot)
    facet(cv, [(f[0] - 4, f[1] - 3), (f[0] + 3, f[1] - 4), (f[0] + 6, f[1]), (f[0] - 4, f[1])], ramp)


def torso(cv, hip, chest, lean, P):
    R = rot(hip, lean)
    # 넓은 흉곽(위가 넓은 다면체) - 왼쪽 그늘 면 / 오른쪽 빛 면
    pts = [R(-6, 2), R(6, 2), R(10, -8), R(10, -15), R(5, -20), R(-7, -20), R(-11, -13), R(-9, -5)]
    facet(cv, pts, GEM, split=(R(1, -20), R(0, 1)))
    # 심장 결정
    g = R(4, -11)
    glow_on = P.extra.get("core", 1)
    cv.put(poly(cv.blank(), [add(g, (0, -3)), add(g, (2, 0)), add(g, (0, 3)), add(g, (-2, 0))]), CORE[0] if glow_on else GEM[2])
    cv.pixel(*rnd(add(g, (0, -1))), CORE[2] if glow_on else CORE[0])
    # 등·뒤 어깨: 뒤로 비스듬히 솟는 자수정 기둥 다발(비대칭, 머리 뒤로 보인다)
    top = R(-6, -18)
    for ang, ln, w in ((-150, 9, 4.0), (-125, 13, 4.6), (-100, 10, 4.0)):
        shard(cv, top, ang + lean * 0.8, ln, w, GEM)


def arm(cv, sh, el, hand, far, P):
    ramp = GEM_FAR if far else GEM
    block(cv, sh, el, 6.5, ramp)
    block(cv, el, hand, 6.0, ramp)
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    spread = P.extra.get("spread", 18)
    tips = [shard(cv, polar(hand, ang, 1), ang + d, 9, 2.2, ramp) for d in (-spread, 0, spread)]  # 긴 결정 손가락 셋
    cv.part(ellipse(cv.blank(), hand, 2.2, 2.2), ramp, gloss=False)
    return tips


def head(cv, c, tilt, P):
    R = rot(c, tilt)
    facet(cv, [R(-4, 3), R(-5, -2), R(-1, -7), R(4, -6), R(6, -2), R(5, 3)], GEM, split=(R(-1, -7), R(1, 3)))
    e = P.extra.get("eye", "open")
    if e == "shut":
        cv.line([rnd(R(2, -2)), rnd(R(5, -1))], INK)
    else:
        cv.line([rnd(R(2, -2)), rnd(R(5, -2))], EYE)
        if e == "angry":
            cv.pixel(*rnd(R(5, -3)), WHITE)
    return dict(eye=R(4, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=8.0, lower=8.0, thigh=6.0, shin=6.0, hip_w=6.0, shoulder_w=14.0)


def pose(name):
    b = dict(hip=(26, 45), torso=16.0, neck=1.0, foot_near=(32, 0), foot_far=(20, 0))
    if name == "idle_a":
        return Pose(**b, lean=8, arm_near=(70, 90), arm_far=(100, 90))
    if name == "idle_b":  # 결정이 내려앉으며 손가락이 오므려진다
        return Pose(**dict(b, hip=(26, 46)), lean=10, arm_near=(76, 96), arm_far=(106, 96), head_tilt=4,
                    extra=dict(spread=12, core=0))
    if name == "idle_c":  # 손가락을 펴며 앞으로 기운다
        return Pose(**dict(b, foot_near=(33, 0)), lean=6, arm_near=(60, 80), arm_far=(95, 85), head_tilt=-2,
                    extra=dict(spread=24))
    if name == "windup":  # 손을 머리 위로 들어 손가락을 세운다
        return Pose(**dict(b, hip=(25, 46), foot_near=(32, 0), foot_far=(18, 0)), lean=-6,
                    arm_near=(-80, -60), arm_far=(-110, -90), head_tilt=-10, extra=dict(eye="angry", spread=22))
    if name == "move":  # 무겁게 한 걸음
        return Pose(**dict(b, hip=(29, 45), foot_near=(38, 2), foot_far=(20, 0)), lean=16,
                    arm_near=(40, 70), arm_far=(130, 110), head_tilt=8, extra=dict(eye="angry"))
    if name == "attack":  # 결정 손가락으로 앞을 찌른다
        return Pose(**dict(b, hip=(24, 45), foot_near=(34, 0), foot_far=(16, 0)), lean=18,
                    arm_near=(-5, 0), arm_far=(120, 100), head_tilt=8, extra=dict(eye="angry", spread=10))
    if name == "recover":  # 스킬: 팔을 벌리고 심장 결정이 빛난다
        return Pose(**dict(b, hip=(25, 45), foot_near=(31, 0), foot_far=(19, 0)), lean=-4,
                    arm_near=(-20, 10), arm_far=(-160, -170), head_tilt=-8, extra=dict(eye="angry", spread=26))
    if name == "hit":  # 맞고 휘청, 조각이 떨어진다
        return Pose(**dict(b, hip=(25, 46), foot_near=(32, 0), foot_far=(19, 0)), lean=-14,
                    arm_near=(95, 120), arm_far=(120, 140), head_tilt=-18, extra=dict(eye="shut", core=0))
    raise KeyError(name)


def draw_dead(cv):
    """부서진 결정 더미: 흩어진 결정 조각, 빛을 잃은 심장."""
    for c, rx, ry in (((20, 55), 6, 4), ((31, 53), 7, 6), ((42, 55), 6, 4), ((12, 57), 3.6, 2.4)):
        facet(cv, [add(c, (-rx, ry)), add(c, (-rx * 0.6, -ry)), add(c, (rx * 0.5, -ry)), add(c, (rx, ry))], GEM)
    for base, ang in (((26, 50), -110), ((36, 50), -70), ((48, 58), -60)):
        shard(cv, base, ang, 6, 3.4, GEM)
    cv.put(poly(cv.blank(), [(31, 51), (33, 53), (31, 55), (29, 53)]), GEM[2])
    cv.line4([(30, 51), (32, 55)], CRACK)
    puff(cv, (8, 52), 2.0, DUST)
    puff(cv, (54, 51), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 9, (32, 30, 44), GEM[2])
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    if name == "windup":
        for p in ((-6, -8), (6, -6)):
            sparkle(cv, add(h, p), WHITE, GEM[3])
    elif name == "move":
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "attack":
        burst(cv, polar(h, 0, 9), 4.5, GEM[3], WHITE, spikes=7, rot=10)
    elif name == "recover":
        # 아군 쪽 바닥에서 솟는 자수정 가시 셋 + 심장 빛
        for x, ln in ((44, 10), (50, 15), (56, 9)):
            shard(cv, (x, 59), -90 + (x - 50) * 1.5, ln, 4.4, GEM)
        crack(cv, (36, 59), [(40, 58), (44, 59), (48, 58)], CRACK)
        sparkle(cv, add(J["chest"], (5, 2)), WHITE, CORE[0], big=True)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
        shard(cv, add(J["chest"], (-13, 8)), -60, 4, 2.4, GEM)
    return cv.image()


if __name__ == "__main__":
    run("golem-crystal", draw, sys.argv[1:], idle_ms=280)

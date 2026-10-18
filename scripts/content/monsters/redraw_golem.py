#!/usr/bin/env python3
"""이끼 바위 골렘(golem, generated-enemy-golem-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

청록빛 바위 덩어리를 쌓은 거인: 넓은 어깨 바위, 작은 머리 바위에 빛나는 노란 눈 틈, 가슴의 초록 보석,
층층이 쌓인 큰 주먹, 짧고 굵은 다리. 어깨·머리 위로 이끼가 덮이고 금이 간 바위 결.
6번 칸(스킬 skill_mon_quake_stomp): 두 주먹을 땅에 내리꽂아 아군 쪽으로 균열과 돌 파편이 튄다.

  python3 scripts/content/monsters/redraw_golem.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body, joints
from pixel_lib import Canvas, add, burst, chain, crack, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (18, 26, 30)
ROCK = [(56, 78, 84), (86, 112, 116), (120, 146, 146), (162, 184, 178)]
ROCK_FAR = [(42, 58, 64), (56, 78, 84), (70, 94, 100), (70, 94, 100)]
MOSS = [(52, 96, 40), (84, 140, 56), (130, 186, 80)]
GEM = [(30, 140, 90), (80, 220, 140), (210, 255, 220)]
EYE = (255, 220, 90)
DUST = [(110, 110, 96), (156, 152, 132)]
CRACK = (40, 30, 26)
WHITE = (255, 255, 240)
GROUND = 60


def block(cv, a, b, w, ramp, moss=False):
    """a→b 를 잇는 각진 바위 덩어리(모서리를 깎은 사각)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    ux, uy = dx / n * 1.5, dy / n * 1.5
    pts = [add(a, (nx * 0.7 - ux, ny * 0.7 - uy)), add(a, (nx + ux * 0.5, ny + uy * 0.5)), add(b, (nx - ux * 0.5, ny - uy * 0.5)),
           add(b, (nx * 0.7 + ux, ny * 0.7 + uy)), add(b, (-nx * 0.7 + ux, -ny * 0.7 + uy)), add(b, (-nx - ux * 0.5, -ny - uy * 0.5)),
           add(a, (-nx + ux * 0.5, -ny + uy * 0.5)), add(a, (-nx * 0.7 - ux, -ny * 0.7 - uy))]
    M = cv.part(poly(cv.blank(), pts), ramp)
    if moss:
        top = min(pts, key=lambda p: p[1])
        cv.line4([add(top, (-2, 1)), add(top, (2, 1))], MOSS[1])
    return M


def leg(cv, hip, knee, foot, far):
    ramp = ROCK_FAR if far else ROCK
    block(cv, hip, knee, 7.5, ramp)
    block(cv, knee, add(foot, (0, -3)), 7.0, ramp)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 4, f[1] - 3), (f[0] + 4, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 4, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 넓은 몸통 바위(위가 넓은 역사다리꼴) + 가슴 보석 + 금 + 어깨 이끼
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    pts = [R(-6, 2), R(6, 2), R(9, -8), R(10, -15), R(5, -19), R(-7, -19), R(-11, -14), R(-9, -6)]
    cv.part(poly(cv.blank(), pts), ROCK)
    cv.line4([R(-3, -18), R(-1, -13), R(-4, -9)], ROCK[0])
    cv.line4([R(4, -4), R(6, -1)], ROCK[0])
    g = R(2, -11)
    cv.put(poly(cv.blank(), [add(g, (0, -3)), add(g, (2, 0)), add(g, (0, 3)), add(g, (-2, 0))]), GEM[1])
    cv.pixel(*rnd(add(g, (0, -1))), GEM[2])
    cv.pixel(*rnd(add(g, (1, 1))), GEM[0])
    cv.part(chain([R(-9, -17), R(-3, -21), R(6, -20)], [3, 3, 2.4]), MOSS + [MOSS[2]], gloss=False)
    for p in ((-6, -20), (2, -21)):
        cv.pixel(*rnd(R(*p)), MOSS[2])


def arm(cv, sh, el, hand, far, P):
    ramp = ROCK_FAR if far else ROCK
    block(cv, sh, el, 7.0, ramp, moss=not far)
    block(cv, el, hand, 6.5, ramp)
    # 층층이 쌓인 큰 주먹(두 덩어리)
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    f1 = polar(hand, ang, 3)
    cv.part(ellipse(cv.blank(), f1, 4.6, 4.6), ramp)
    cv.line4([polar(f1, ang + 90, 3), polar(f1, ang - 90, 3)], ramp[0])
    return f1


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-4, 3), R(-5, -3), R(-2, -6), R(4, -6), R(6, -2), R(5, 3)]), ROCK)
    cv.line4([R(-4, -6), R(3, -7)], MOSS[1])
    cv.pixel(*rnd(R(0, -7)), MOSS[2])
    e = P.extra.get("eye", "open")
    if e == "shut":
        cv.line([rnd(R(1, -2)), rnd(R(4, -1))], INK)
    else:
        cv.line([rnd(R(1, -2)), rnd(R(4, -2))], EYE)
        if e == "angry":
            cv.pixel(*rnd(R(4, -3)), WHITE)
    return dict(eye=R(3, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=8.0, lower=8.0, thigh=6.0, shin=6.0, hip_w=6.0, shoulder_w=14.0)


def pose(name):
    b = dict(hip=(28, 45), torso=16.0, neck=1.0, foot_near=(34, 0), foot_far=(22, 0))
    if name == "idle_a":
        return Pose(**b, lean=8, arm_near=(70, 90), arm_far=(100, 90), head_tilt=0)
    if name == "idle_b":  # 어깨를 들썩이며 몸이 내려앉는다
        return Pose(**dict(b, hip=(28, 46)), lean=10, arm_near=(75, 95), arm_far=(105, 95), head_tilt=4)
    if name == "idle_c":  # 무게를 앞발로, 주먹이 흔들린다
        return Pose(**dict(b, foot_near=(35, 0)), lean=6, arm_near=(60, 85), arm_far=(95, 85), head_tilt=-2)
    if name == "windup":  # 두 주먹을 머리 위로 들어 올린다
        return Pose(**dict(b, hip=(26, 46), foot_near=(33, 0), foot_far=(19, 0)), lean=-6,
                    arm_near=(-80, -60), arm_far=(-110, -90), head_tilt=-10, extra=dict(eye="angry"))
    if name == "move":  # 무겁게 한 걸음 내딛는다
        return Pose(**dict(b, hip=(31, 45), foot_near=(40, 2), foot_far=(22, 0)), lean=16,
                    arm_near=(40, 70), arm_far=(130, 110), head_tilt=8, extra=dict(eye="angry"))
    if name == "attack":  # 가까운 주먹을 앞으로 내지른다
        return Pose(**dict(b, hip=(25, 45), foot_near=(35, 0), foot_far=(17, 0)), lean=18,
                    arm_near=(-5, 0), arm_far=(120, 100), head_tilt=8, extra=dict(eye="angry"))
    if name == "recover":  # 스킬 대지 강타: 두 주먹을 땅에 내리꽂는다
        return Pose(**dict(b, hip=(28, 47), foot_near=(36, 0), foot_far=(19, 0)), lean=30,
                    arm_near=(50, 85), arm_far=(70, 95), head_tilt=12, extra=dict(eye="angry"))
    if name == "hit":  # 맞고 뒤로 휘청, 바위 조각이 떨어진다
        return Pose(**dict(b, hip=(28, 46), foot_near=(34, 0), foot_far=(21, 0)), lean=-14,
                    arm_near=(95, 120), arm_far=(120, 140), head_tilt=-18, extra=dict(eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    """무너져 내린 바위 더미: 흩어진 덩어리, 깨진 보석, 이끼."""
    for c, rx, ry in (((20, 55), 6, 4), ((31, 53), 7, 6), ((42, 55), 6, 4), ((50, 57), 4, 2.6), ((12, 57), 3.6, 2.4)):
        cv.part(ellipse(cv.blank(), c, rx, ry), ROCK)
    cv.part(chain([(25, 48), (31, 47), (37, 48)], [3, 3, 2.4]), MOSS + [MOSS[2]], gloss=False)
    cv.put(poly(cv.blank(), [(31, 51), (33, 53), (31, 55), (29, 53)]), GEM[0])
    cv.pixel(31, 53, GEM[1])
    cv.line4([(30, 51), (32, 55)], CRACK)
    cv.line([(41, 54), (44, 54)], INK)
    puff(cv, (8, 52), 2.0, DUST)
    puff(cv, (54, 51), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 9, (32, 38, 44), ROCK[2])
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    if name == "windup":
        for p in ((-6, -6), (6, -4)):
            sparkle(cv, add(h, p), WHITE, GEM[1])
    elif name == "move":
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "attack":
        f = polar(h, 0, 7)
        burst(cv, f, 5.0, DUST[1], WHITE, spikes=7, rot=10)
    elif name == "recover":
        # 주먹이 박힌 자리에서 아군 쪽(오른쪽)으로 갈라지는 균열 + 튀는 돌
        base = (h[0] + 2, GROUND - 1)
        crack(cv, base, [(base[0] + 5, 58), (base[0] + 9, 59), (base[0] + 14, 58), (base[0] + 18, 59)], CRACK)
        crack(cv, (base[0] + 7, 59), [(base[0] + 10, 57), (base[0] + 13, 56)], CRACK)
        for p, r in (((10, -10), 2.0), ((16, -6), 1.6), ((6, -15), 1.4), ((20, -12), 1.2)):
            cv.part(ellipse(cv.blank(), add(base, p), r, r), ROCK, gloss=False)
        puff(cv, add(base, (-3, -3)), 3.0, DUST)
        burst(cv, add(base, (2, -4)), 4.0, DUST[1], WHITE, spikes=6)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
        cv.part(ellipse(cv.blank(), add(J["chest"], (-12, 6)), 1.6, 1.6), ROCK, gloss=False)
    return cv.image()


if __name__ == "__main__":
    run("golem", draw, sys.argv[1:], idle_ms=300)

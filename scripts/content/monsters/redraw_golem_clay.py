#!/usr/bin/env python3
"""붉은 점토 항아리 골렘(golem-clay) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

바위 골렘(golem)의 각진 덩어리와 다르게 몸통이 통째로 구운 붉은 항아리다: 배가 둥글게 부푼 독,
목 둘레의 두툼한 입술 테, 그 위에 뚜껑 모양 작은 머리(손잡이 꼭지)와 가로로 갈라진 빛나는 눈 틈,
배에 새긴 흰 소용돌이 무늬, 진흙을 감아올린 굵은 팔(손끝이 뭉툭한 반죽 주먹), 짧은 통 다리.
6번 칸(스킬 진흙 가시): 두 팔을 앞으로 뻗어 바닥에서 아군 쪽으로 진흙 가시 세 개를 솟구친다.

  python3 scripts/content/monsters/redraw_golem_clay.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (40, 18, 12)
CLAY = [(128, 58, 34), (176, 88, 52), (210, 122, 76), (236, 164, 112)]
CLAY_FAR = [(96, 42, 26), (128, 58, 34), (146, 68, 40), (146, 68, 40)]
GLAZE = (244, 226, 196)
EYE, EYE_HI = (255, 196, 70), (255, 250, 210)
MUD = [(92, 56, 34), (128, 84, 52), (164, 116, 76)]
DUST = [(120, 88, 64), (168, 132, 98)]
WHITE = (255, 250, 236)
GROUND = 60


def coil_limb(cv, a, b, w, ramp):
    """진흙을 감아 만든 팔다리: 마디마다 가로 홈."""
    M = cv.part(chain([a, b], [w, w * 0.9]), ramp, gloss=False)
    for t in (0.33, 0.66):
        p = lerp(a, b, t)
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        cv.line4([rnd(polar(p, ang + 90, w / 2 - 0.5)), rnd(polar(p, ang - 90, w / 2 - 0.5))], ramp[0])
    return M


def leg(cv, hip, knee, foot, far):
    ramp = CLAY_FAR if far else CLAY
    coil_limb(cv, hip, add(foot, (0, -2)), 7.0, ramp)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 4, f[1] - 3), (f[0] + 4, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 4, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    belly = R(0, -9)
    M = cv.part(ellipse(cv.blank(), belly, 11, 10.5), CLAY)
    cv.shade_side(M, CLAY[0], side=-1, depth=2)
    # 바닥 굽(받침)
    cv.part(poly(cv.blank(), [R(-6, -1), R(6, -1), R(5, 2), R(-5, 2)]), CLAY_FAR, gloss=False)
    # 목 입술 테
    cv.part(poly(cv.blank(), [R(-7, -19), R(7, -19), R(8, -21.5), R(-8, -21.5)]), CLAY, gloss=False)
    cv.line4([rnd(R(-6, -21)), rnd(R(6, -21))], CLAY[3])
    # 흰 소용돌이 무늬(배)
    c = R(1, -9)
    pts = [polar(c, ang + lean, 1.0 + ang / 140) for ang in range(0, 600, 45)]
    cv.line4([rnd(p) for p in pts], GLAZE)
    # 금 간 자국
    cv.line4([rnd(R(-8, -14)), rnd(R(-5, -11)), rnd(R(-7, -7))], CLAY[0])


def arm(cv, sh, el, hand, far, P):
    ramp = CLAY_FAR if far else CLAY
    coil_limb(cv, sh, el, 6.0, ramp)
    coil_limb(cv, el, hand, 5.6, ramp)
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    f = polar(hand, ang, 2.5)
    cv.part(ellipse(cv.blank(), f, 4.0, 3.6), ramp)
    cv.pixel(*rnd(polar(f, ang - 70, 2)), ramp[3])


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뚜껑 머리: 납작한 돔 + 꼭지
    cv.part(poly(cv.blank(), [R(-6, 3), R(-6, -1), R(-3, -4), R(3, -4), R(6, -1), R(6, 3)]), CLAY)
    cv.part(ellipse(cv.blank(), R(0, -5.5), 1.8, 1.6), CLAY, gloss=False)
    cv.line4([rnd(R(-5, 1)), rnd(R(5, 1))], CLAY[0])
    e = P.extra.get("eye", "open")
    if e == "shut":
        cv.line([rnd(R(1, -1)), rnd(R(4, -1))], INK)
    else:
        cv.line([rnd(R(0, -1)), rnd(R(4, -1))], EYE)
        cv.pixel(*rnd(R(4, -1)), EYE_HI if e == "angry" else EYE)
    return dict(eye=R(2, -1))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=5.0, shin=5.0, hip_w=8.0, shoulder_w=16.0)


def pose(name):
    b = dict(hip=(29, 50), torso=21.0, neck=-1.0, foot_near=(35, 0), foot_far=(23, 0))
    if name == "idle_a":
        return Pose(**b, lean=4, arm_near=(60, 95), arm_far=(110, 85))
    if name == "idle_b":
        return Pose(**dict(b, hip=(29, 51)), lean=6, arm_near=(70, 100), arm_far=(115, 90), head_tilt=4)
    if name == "idle_c":
        return Pose(**b, lean=2, arm_near=(50, 80), arm_far=(105, 80), head_tilt=-4)
    if name == "windup":
        return Pose(**dict(b, foot_near=(33, 0), foot_far=(20, 0)), lean=-8, arm_near=(-100, -70), arm_far=(-120, -90),
                    head_tilt=-10, extra=dict(eye="angry"))
    if name == "move":
        return Pose(**dict(b, hip=(32, 50), foot_near=(41, 2), foot_far=(23, 0)), lean=12, arm_near=(30, 60), arm_far=(140, 110),
                    head_tilt=6, extra=dict(eye="angry"))
    if name == "attack":
        return Pose(**dict(b, hip=(28, 50), foot_near=(36, 0), foot_far=(19, 0)), lean=14, arm_near=(-5, 5), arm_far=(130, 100),
                    head_tilt=6, extra=dict(eye="angry"))
    if name == "recover":
        return Pose(**dict(b, hip=(28, 50), foot_near=(35, 0), foot_far=(20, 0)), lean=10, arm_near=(25, 20), arm_far=(15, 10),
                    head_tilt=4, extra=dict(eye="angry"))
    if name == "hit":
        return Pose(**dict(b, hip=(27, 51), foot_near=(33, 0), foot_far=(22, 0)), lean=-14, arm_near=(-30, -60), arm_far=(160, 120),
                    head_tilt=-18, extra=dict(eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    """깨진 항아리: 바닥에 흩어진 큰 조각, 뚜껑 머리가 굴러가 있다."""
    cv.part(poly(cv.blank(), [(12, 59), (14, 50), (22, 46), (30, 47), (33, 53), (30, 59)]), CLAY)
    cv.line4([(15, 53), (20, 51), (24, 54)], GLAZE)
    cv.part(poly(cv.blank(), [(30, 59), (34, 52), (42, 51), (44, 59)]), CLAY_FAR)
    cv.part(poly(cv.blank(), [(44, 59), (46, 55), (52, 54), (55, 59)]), CLAY)
    cv.part(poly(cv.blank(), [(50, 54), (50, 50), (53, 48), (57, 48), (59, 51), (59, 54)]), CLAY)
    cv.line([(53, 51), (55, 51)], INK)
    cv.part(chain([(6, 58), (12, 58)], [3, 3]), MUD, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 8, (34, 40, 46), CLAY[2])
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    if name == "windup":
        sparkle(cv, add(h, (4, -6)), WHITE, EYE)
    elif name == "move":
        puff(cv, (14, 57), 2.4, DUST)
    elif name == "attack":
        burst(cv, polar(h, 0, 7), 5.0, DUST[1], WHITE, spikes=7, rot=10)
    elif name == "recover":
        # 진흙 가시 셋이 아군 쪽 바닥에서 솟는다(점점 크게)
        for x, hgt in ((44, 8), (51, 12), (58, 15)):
            cv.part(poly(cv.blank(), [(x - 3, GROUND), (x + 3, GROUND), (x + 1, GROUND - hgt), (x - 1, GROUND - hgt + 1)]), MUD, gloss=False)
        cv.part(chain([(39, GROUND - 1), (61, GROUND - 1)], [2.4, 2.4]), MUD, gloss=False)
        for p in ((47, 44), (55, 42), (60, 40)):
            cv.put(ellipse(cv.blank(), p, 1.0, 1.0), MUD[2])
        sparkle(cv, add(h, (3, -3)), WHITE, EYE)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("golem-clay", draw, sys.argv[1:], idle_ms=300)

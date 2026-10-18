#!/usr/bin/env python3
"""창 도마뱀인간(lizardman-spear) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

초록 비늘의 날렵한 도마뱀 전사: 길쭉한 주둥이와 노란 세로동공 눈, 머리 뒤 주황 볏 지느러미,
크림색 배 비늘, 가죽 어깨끈과 허리 천, 뒤로 꺾이는 짐승 다리와 발톱, 땅에 끌리는 굵은 꼬리.
가까운 손에 긴 창(잎 모양 날 + 붉은 술), 먼 팔에 작은 둥근 가죽 방패.
6번 칸(스킬 skill_mon_spear_thrust): 몸을 낮게 쭉 뻗어 창을 일직선으로 꿰찌르고 관통 섬광이 뻗는다.

  python3 scripts/content/monsters/redraw_lizardman_spear.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (14, 26, 20)
SCALE = [(40, 92, 56), (66, 132, 72), (104, 170, 90), (150, 206, 120)]
SCALE_FAR = [(30, 68, 42), (40, 92, 56), (52, 110, 64), (52, 110, 64)]
BELLY = [(170, 160, 110), (214, 204, 150), (236, 228, 184), (236, 228, 184)]
CREST = [(180, 70, 30), (232, 120, 50), (255, 180, 90)]
EYE, PUPIL = (250, 210, 60), (20, 20, 10)
LEATHER = [(70, 44, 30), (106, 70, 44), (138, 96, 60), (138, 96, 60)]
WOOD = [(80, 52, 30), (120, 82, 46), (156, 112, 64), (156, 112, 64)]
STEEL = [(110, 120, 134), (168, 178, 192), (214, 222, 232), (250, 252, 255)]
TASSEL = (196, 40, 44)
CLAW = (230, 222, 196)
DUST = [(112, 104, 88), (156, 146, 126)]
WHITE = (255, 252, 240)
GROUND = 60


def tail(cv, hip, sway=0.0):
    """엉덩이 뒤로 내려와 땅에 끌리는 굵은 꼬리. sway 로 끝이 들린다."""
    pts = [add(hip, (-2, 1)), add(hip, (-8, 6)), add(hip, (-13, 12 - sway)), (max(hip[0] - 18, 3), GROUND - 1 - sway * 1.5)]
    M = cv.part(chain(pts, [5.0, 4.2, 3.0, 1.6]), SCALE)
    cv.line4([rnd(add(pts[1], (0, 2))), rnd(add(pts[2], (0, 1)))], BELLY[1])
    return M


def leg(cv, hip, knee, foot, far):
    """짐승 다리: 허벅지 -> 무릎(앞) -> 뒤로 솟은 뒤꿈치 -> 발가락 + 발톱."""
    ramp = SCALE_FAR if far else SCALE
    heel = add(foot, (-3, -4))
    k = ik_side(hip, heel, 6.5, 6.0, forward=True)
    cv.part(chain([hip, k], [4.2, 3.0]), ramp, gloss=False)
    cv.part(chain([k, heel], [3.0, 2.2]), ramp, gloss=False)
    cv.part(chain([heel, add(foot, (0, -1))], [2.2, 2.0]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 2, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 2, f[1])]), ramp, gloss=False)
    if not far:
        cv.pixel(f[0] + 4, f[1], CLAW)
        cv.pixel(f[0] + 2, f[1], CLAW)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    tail(cv, hip, P.extra.get("sway", 0))
    cv.part(poly(cv.blank(), [R(-5, 1), R(5, 1), R(6, -6), R(6, -13), R(2, -16), R(-4, -15), R(-6, -9)]), SCALE)
    # 배 비늘 띠(앞쪽)
    cv.part(poly(cv.blank(), [R(1, 0), R(5, 0), R(6, -6), R(5, -12), R(2, -12), R(2, -6)]), BELLY, gloss=False)
    for y in (-3, -6, -9):
        cv.line4([R(2, y), R(5, y)], BELLY[0])
    # 어깨끈 + 허리 천
    cv.line4([R(-4, -14), R(5, -3)], LEATHER[1])
    cv.part(poly(cv.blank(), [R(-5, -1), R(5, -1), R(6, 4), R(2, 3), R(0, 6), R(-5, 4)]), LEATHER)
    # 등 가시 비늘
    for t in (0.3, 0.55, 0.8):
        p = R(-6 + t, -16 * t)
        cv.pixel(*rnd(add(p, (-1, 0))), SCALE[0])


def spear(cv, hand, ang):
    """긴 창: 손 뒤로 짧게, 앞으로 길게 자루 + 잎 모양 날 + 붉은 술."""
    butt = polar(hand, ang + 180, 9)
    neck = polar(hand, ang, 14)
    cv.part(chain([butt, neck], [1.5, 1.5]), WOOD, gloss=False)
    tip = polar(neck, ang, 7)
    side = ang + 90
    blade = [neck, polar(polar(neck, ang, 2.5), side, 2.2), tip, polar(polar(neck, ang, 2.5), side, -2.2)]
    cv.part(poly(cv.blank(), blade), STEEL, gloss=False)
    cv.line4([rnd(polar(neck, ang, 1)), rnd(polar(neck, ang, 5))], STEEL[3])
    t0 = polar(neck, ang + 180, 1)
    cv.line4([rnd(t0), rnd(add(t0, (-1, 3)))], TASSEL)
    cv.line4([rnd(add(t0, (1, 0))), rnd(add(t0, (1, 3)))], TASSEL)
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = SCALE_FAR if far else SCALE
    cv.part(chain([sh, el], [3.0, 2.6]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.6, 2.4]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.8, 1.8), ramp, gloss=False)
    if far:
        s = add(hand, P.extra.get("shield_off", (1, 0)))
        cv.part(ellipse(cv.blank(), s, 4.0, 4.6), LEATHER)
        cv.put(ellipse(cv.blank(), s, 1.4, 1.4), STEEL[1])
    else:
        P.extra["_tip"] = spear(cv, hand, P.extra.get("spear", -20))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 볏 지느러미(뒤통수에서 목으로)
    cv.part(poly(cv.blank(), [R(-3, -4), R(-5, -9), R(-6, -5), R(-9, -6), R(-8, -1), R(-10, 1), R(-5, 2)]), CREST + [CREST[2]], gloss=False)
    # 아래턱
    cv.part(poly(cv.blank(), [R(-1, 1), R(10, 1 + jaw * 0.3), R(9, 3 + jaw), R(0, 4 + jaw * 0.4)]), BELLY, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(2, 1), R(9, 1), R(9, 1 + jaw), R(2, 2 + jaw * 0.5)]), (120, 40, 50))
    # 머리 + 긴 주둥이
    cv.part(poly(cv.blank(), [R(-4, 2), R(-4, -3), R(-1, -5), R(4, -4), R(11, -2), R(11, 1), R(-1, 2)]), SCALE)
    cv.pixel(*rnd(R(10, -2)), INK)  # 콧구멍
    if jaw:
        for dx in (4, 7):
            cv.pixel(*rnd(R(dx, 2)), CLAW)
    e = R(1, -2)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (1, 0)))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), EYE)
        cv.pixel(*rnd(add(e, (0, -1))), PUPIL)
        cv.pixel(*rnd(add(e, (0, 0))), PUPIL)
    return dict(eye=e, snout=R(11, 0))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.5, lower=6.0, thigh=7.5, shin=8.0, hip_w=4.0, shoulder_w=5.0)


def pose(name):
    b = dict(hip=(27, 43), torso=15.0, neck=1.5, foot_near=(33, 0), foot_far=(21, 0))
    if name == "idle_a":  # 창을 앞으로 비스듬히 겨눈다
        return Pose(**b, lean=10, arm_near=(60, 0), arm_far=(30, 10), head_tilt=4, extra=dict(spear=-20))
    if name == "idle_b":  # 몸을 낮추고 혀를 날름, 꼬리가 들린다
        return Pose(**dict(b, hip=(27, 44)), lean=14, arm_near=(66, 6), arm_far=(36, 16), head_tilt=8, extra=dict(spear=-12, jaw=2, sway=2))
    if name == "idle_c":  # 창끝을 들어 위협
        return Pose(**dict(b, foot_near=(34, 0)), lean=8, arm_near=(54, -10), arm_far=(26, 4), head_tilt=0, extra=dict(spear=-34, sway=1))
    if name == "windup":  # 창을 뒤로 당겨 겨누고 몸을 웅크린다
        return Pose(**dict(b, hip=(23, 45), foot_near=(31, 0), foot_far=(15, 0)), lean=4,
                    arm_near=(150, 30), arm_far=(10, -10), head_tilt=0, extra=dict(spear=-6, jaw=3, shield_off=(2, 0), sway=3))
    if name == "move":  # 꼬리로 균형 잡고 낮게 내달린다
        return Pose(**dict(b, hip=(30, 44), foot_near=(41, 1), foot_far=(19, 0)), lean=30,
                    arm_near=(90, 20), arm_far=(20, 0), head_tilt=16, extra=dict(spear=0, sway=4))
    if name == "attack":  # 창을 앞으로 찌른다
        return Pose(**dict(b, hip=(25, 44), foot_near=(38, 0), foot_far=(15, 0)), lean=22,
                    arm_near=(10, 0), arm_far=(90, 70), head_tilt=12, extra=dict(spear=0, jaw=2))
    if name == "recover":  # 스킬 관통 찌르기: 몸을 쭉 뻗어 일직선
        return Pose(**dict(b, hip=(20, 45), foot_near=(33, 0), foot_far=(9, 0)), lean=36,
                    arm_near=(0, 0), arm_far=(150, 130), head_tilt=24, extra=dict(spear=0, jaw=3, sway=4))
    if name == "hit":  # 맞아서 뒤로 휘청, 창이 들린다
        return Pose(**dict(b, hip=(25, 44), foot_near=(31, 0), foot_far=(19, 1)), lean=-16,
                    arm_near=(150, 160), arm_far=(-20, -40), head_tilt=-24, extra=dict(spear=200, eye="shut", jaw=3, sway=-1))
    raise KeyError(name)


def draw_dead(cv):
    """옆으로 쓰러져 꼬리를 늘어뜨린 도마뱀인간과 떨어진 창."""
    cv.part(chain([(6, 58), (12, 57), (20, 56)], [1.6, 3.0, 4.6]), SCALE, gloss=False)
    cv.part(poly(cv.blank(), [(18, 59), (20, 52), (34, 51), (37, 59)]), SCALE)
    cv.part(poly(cv.blank(), [(22, 58), (34, 58), (35, 55), (22, 56)]), BELLY, gloss=False)
    cv.part(poly(cv.blank(), [(24, 52), (26, 49), (30, 50), (29, 52)]), CREST + [CREST[2]], gloss=False)
    cv.part(poly(cv.blank(), [(36, 53), (40, 51), (50, 54), (50, 57), (37, 59)]), SCALE)
    cv.line([(40, 53), (42, 55)], INK)
    cv.line([(42, 53), (40, 55)], INK)
    cv.line4([(30, 58), (57, 56)], WOOD[1])
    cv.part(poly(cv.blank(), [(56, 54), (61, 56), (56, 58)]), STEEL, gloss=False)
    puff(cv, (14, 52), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), SCALE[2])
    J = draw_body(cv, LOOK, P)
    tip = P.extra["_tip"]
    if name == "attack":
        speed_lines(cv, int(tip[0]) - 14, int(tip[0]) - 6, (int(tip[1]) - 3, int(tip[1]) + 3), STEEL[2])
        sparkle(cv, tip, WHITE, STEEL[2], big=True)
    elif name == "recover":
        y = int(round(tip[1]))
        cv.line4([(int(tip[0]), y), (61, y)], WHITE)
        cv.line4([(int(tip[0]) - 2, y - 1), (60, y - 1)], STEEL[2])
        cv.line4([(int(tip[0]) - 2, y + 1), (60, y + 1)], STEEL[1])
        burst(cv, (min(tip[0] + 2, 57), y), 4.5, STEEL[2], WHITE, spikes=6)
        puff(cv, (10, 57), 2.4, DUST)
    elif name == "windup":
        sparkle(cv, tip, WHITE, STEEL[2])
    elif name == "move":
        puff(cv, (10, 57), 2.2, DUST)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-6, -7), (-8, -4), (-7, -10)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("lizardman-spear", draw, sys.argv[1:], idle_ms=190)

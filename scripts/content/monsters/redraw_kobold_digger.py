#!/usr/bin/env python3
"""곡괭이 든 개형 코볼트(kobold-digger) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

작고 구부정한 개 머리 수인: 긴 주둥이와 검은 코, 위로 선 세모 귀(안쪽 분홍), 머리 안 작은 붉은 눈,
주황 갈색 털에 크림색 배, 짧은 다리와 개처럼 뒤로 꺾인 발목(발끝으로 선다), 뒤로 흔드는 짧은 꼬리.
머리에 촛불 달린 광부 가죽 모자, 허리에 가죽 띠, 두 손에 쥔 큰 곡괭이(쇠 날 양끝 뾰족).
6번 칸(스킬 땅 파헤치기): 곡괭이를 땅에 박아 아군 쪽으로 흙과 돌 조각을 퍼올린다.

  python3 scripts/content/monsters/redraw_kobold_digger.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, flame, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (34, 18, 10)
FUR = [(140, 74, 32), (186, 106, 50), (220, 146, 78), (240, 184, 118)]
FUR_FAR = [(104, 54, 24), (140, 74, 32), (156, 84, 38), (156, 84, 38)]
CREAM = [(200, 170, 130), (232, 210, 170), (248, 236, 206), (248, 236, 206)]
LEATHER = [(64, 42, 28), (92, 62, 40), (120, 84, 56), (140, 102, 70)]
WOOD = [(80, 52, 30), (116, 78, 46), (150, 106, 64), (150, 106, 64)]
IRON = [(80, 86, 96), (130, 138, 150), (180, 188, 198), (220, 226, 234)]
EYE = (230, 40, 40)
EAR_IN = (230, 140, 140)
CANDLE = [(230, 120, 30), (255, 210, 80), (255, 250, 200)]
DIRT = [(92, 64, 40), (132, 96, 62), (170, 132, 92)]
WHITE = (255, 250, 236)
GROUND = 60


def leg(cv, hip, knee, foot, far):
    ramp = FUR_FAR if far else FUR
    hock = add(foot, (-3, -4))
    cv.part(chain([hip, knee], [4.4, 3.4]), ramp, ink=INK, gloss=False)
    cv.part(chain([knee, hock, add(foot, (0, -1))], [3.2, 2.6, 2.4]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 2, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 짧은 꼬리 먼저
    w = P.extra.get("wag", 0)
    cv.part(chain([add(hip, (-3, -1)), add(hip, (-8, -4 - w)), add(hip, (-10, -7 - w))], [3, 2.6, 1.6]), FUR, ink=INK, gloss=False)
    body = [add(hip, (-4, 1)), add(hip, (4, 1)), add(chest, (5, 2)), add(chest, (3, -3)), add(chest, (-4, -3)), add(chest, (-6, 2))]
    M = cv.part(poly(cv.blank(), body), FUR, ink=INK)
    cv.put(poly(cv.blank(), [add(chest, (1, -1)), add(chest, (4, 1)), add(hip, (3, -1)), add(hip, (0, -2))]), CREAM[1])
    cv.shade_side(M, FUR[0], side=-1, depth=1)
    cv.part(poly(cv.blank(), [add(hip, (-5, -3)), add(hip, (5, -3)), add(hip, (5, 0)), add(hip, (-5, 0))]), LEATHER, ink=INK, gloss=False)
    cv.pixel(*rnd(add(hip, (2, -2))), IRON[2])


def pick(cv, hand, ang):
    """곡괭이: 손에서 ang 방향 자루 끝에 가로 쇠 날."""
    head = polar(hand, ang, 13)
    butt = polar(hand, ang + 180, 4)
    cv.part(chain([butt, head], [2.2, 2.2]), WOOD, ink=INK, gloss=False)
    a, b = polar(head, ang + 90, 7), polar(head, ang - 90, 7)
    cv.part(chain([a, lerp(a, head, 0.6), head, lerp(b, head, 0.6), b], [1.2, 2.6, 3.2, 2.6, 1.2]), IRON, ink=INK, gloss=False)
    return dict(blade_a=a, blade_b=b, head=head)


def arm(cv, sh, el, hand, far, P):
    ramp = FUR_FAR if far else FUR
    if not far:
        P.extra["pick"] = pick(cv, hand, P.extra.get("pick_ang", -60))
    cv.part(chain([sh, el, hand], [3.6, 3.0, 2.8]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.8, 1.8), ramp, ink=INK, gloss=False)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 먼 귀
    cv.part(poly(cv.blank(), [R(-3, -3), R(-4, -10), R(0, -4)]), FUR_FAR, ink=INK, gloss=False)
    # 아래턱 + 입
    if jaw:
        cv.put(poly(cv.blank(), [R(2, 1), R(10, 1), R(10, 2 + jaw), R(2, 2)]), (110, 30, 30))
        cv.pixel(*rnd(R(8, 1.5)), WHITE)
    cv.part(poly(cv.blank(), [R(0, 1 + jaw * 0.3), R(9, 2 + jaw), R(9, 3.5 + jaw), R(1, 3.5)]), CREAM, ink=INK, gloss=False)
    # 머리 + 긴 주둥이
    skull = [R(-4, 2), R(-4, -3), R(-1, -5), R(3, -4), R(5, -2), R(11, -1), R(11, 1.5), R(4, 2)]
    cv.part(poly(cv.blank(), skull), FUR, ink=INK)
    cv.pixel(*rnd(R(11, -1)), INK)  # 코
    cv.pixel(*rnd(R(10, -1)), INK)
    # 광부 모자 + 촛불
    cv.part(poly(cv.blank(), [R(-5, -3), R(-4, -6), R(0, -8), R(4, -6), R(5, -3)]), LEATHER, ink=INK, gloss=False)
    cv.line4([rnd(R(-5, -3)), rnd(R(6, -3))], LEATHER[0])
    cv.part(poly(cv.blank(), [R(-1, -8), R(1, -8), R(1, -11), R(-1, -11)]), [CREAM[2]] * 4, ink=INK, gloss=False)
    flame(cv, rnd(R(0, -11)), 4, 3, CANDLE, tongues=1)
    # 가까운 귀(모자 옆으로)
    cv.part(poly(cv.blank(), [R(1, -5), R(3, -11), R(5, -4)]), FUR, ink=INK, gloss=False)
    cv.pixel(*rnd(R(3, -7)), EAR_IN)
    e = rnd(R(3, -1))
    if P.extra.get("eye") == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0], e[1] - 1, INK)
    return dict(eye=e, mouth=R(10, 2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=5.5, thigh=6.0, shin=6.5, hip_w=4, shoulder_w=4)


def pose(name):
    b = dict(hip=(28, 45), torso=10.0, neck=2.0, foot_near=(34, 0), foot_far=(22, 0))
    if name == "idle_a":
        return Pose(**b, lean=18, head_tilt=4, arm_near=(70, 20), arm_far=(95, 40), extra=dict(pick_ang=86))
    if name == "idle_b":
        return Pose(**dict(b, hip=(28, 46)), lean=22, head_tilt=8, arm_near=(72, 24), arm_far=(100, 45), extra=dict(pick_ang=84, wag=3, jaw=1))
    if name == "idle_c":
        return Pose(**b, lean=16, head_tilt=0, arm_near=(66, 14), arm_far=(92, 36), extra=dict(pick_ang=88, wag=-2))
    if name == "windup":
        return Pose(**dict(b, foot_near=(33, 0), foot_far=(19, 0)), lean=-6, head_tilt=-8, arm_near=(-120, -150), arm_far=(-100, -130),
                    extra=dict(pick_ang=-160, jaw=2))
    if name == "move":
        return Pose(**dict(b, hip=(31, 44), foot_near=(40, 3), foot_far=(20, 0)), lean=30, head_tilt=12, arm_near=(20, -10), arm_far=(140, 120),
                    extra=dict(pick_ang=-20, wag=4, jaw=1))
    if name == "attack":
        return Pose(**dict(b, foot_near=(36, 0), foot_far=(18, 0)), lean=30, head_tilt=14, arm_near=(0, 20), arm_far=(30, 40),
                    extra=dict(pick_ang=60, jaw=3))
    if name == "recover":
        return Pose(**dict(b, hip=(27, 45), foot_near=(34, 0), foot_far=(18, 0)), lean=36, head_tilt=16, arm_near=(40, 60), arm_far=(50, 70),
                    extra=dict(pick_ang=80, jaw=2, wag=4))
    if name == "hit":
        return Pose(**dict(b, hip=(25, 45), foot_near=(32, 0), foot_far=(20, 1)), lean=-18, head_tilt=-24, arm_near=(150, 170), arm_far=(-150, -130),
                    extra=dict(pick_ang=-140, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    pick(cv, (8, 56), -15)
    cv.part(chain([(18, 57), (26, 57)], [3.4, 3.4]), FUR_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(22, 59), (24, 52), (38, 51), (40, 59)]), FUR, ink=INK)
    cv.part(poly(cv.blank(), [(38, 58), (40, 52), (45, 50), (50, 53), (57, 55), (57, 58)]), FUR, ink=INK)
    cv.part(poly(cv.blank(), [(41, 51), (44, 47), (47, 51)]), LEATHER, ink=INK, gloss=False)
    cv.line([(45, 53), (47, 55)], INK)
    cv.line([(47, 53), (45, 55)], INK)
    cv.pixel(57, 55, INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 9, (32, 38, 44), FUR[2])
    J = draw_body(cv, LOOK, P)
    pk = P.extra["pick"]
    if name == "windup":
        sparkle(cv, add(pk["head"], (-2, -3)), WHITE, IRON[3], big=True)
    elif name == "move":
        puff(cv, (14, 57), 2.4, DIRT[1:])
    elif name == "attack":
        burst(cv, add(pk["blade_a"], (1, 1)), 4.5, (255, 230, 170), WHITE, spikes=6)
    elif name == "recover":
        # 땅에 박힌 곡괭이 앞에서 흙·돌이 아군 쪽으로 퍼 올려진다
        base = (pk["head"][0] + 3, GROUND - 1)
        cv.part(poly(cv.blank(), [(base[0] - 4, GROUND), (base[0] + 6, GROUND), (base[0] + 3, GROUND - 4), (base[0] - 2, GROUND - 3)]), DIRT, ink=INK, gloss=False)
        for p, r in (((6, -9), 2.0), ((11, -13), 1.6), ((15, -8), 1.8), ((9, -18), 1.2), ((18, -15), 1.2)):
            q = add(base, p)
            if q[0] < 61:
                cv.part(ellipse(cv.blank(), q, r, r), DIRT, ink=INK, gloss=False)
        puff(cv, add(base, (2, -4)), 2.6, DIRT[1:])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((4, -8), (7, -6), (6, -11)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("kobold-digger", draw, sys.argv[1:], idle_ms=200)

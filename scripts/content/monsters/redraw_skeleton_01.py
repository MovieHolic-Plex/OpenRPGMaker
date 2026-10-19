#!/usr/bin/env python3
"""뼈 몽둥이 해골(skeleton-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

상아색 맨 해골 전사: 앞으로 비스듬히 내민 길쭉한 두개골(깊은 눈구멍에 붉은 불씨, 이가 드러난 위턱과 덜렁이는
아래턱), 등뼈 마디가 보이는 척추, 앞으로 휘는 늑골 다섯, 넓게 드러난 골반에 감긴 붉은 허리 천,
가까운 손에 쥔 굵은 뼈 몽둥이(넓적다리뼈 — 끝이 두 혹). 궁수 해골과 달리 두건·화살통이 없고 어깨를 웅크린다.
6번 칸(스킬 뼈 던지기 회오리): 몽둥이를 머리 위로 휘돌려 붉은 저주 기운이 감긴 뼈 조각을 앞으로 흩뿌린다.

  python3 scripts/content/monsters/redraw_skeleton_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

INK = (34, 26, 22)
BONE = [(156, 140, 108), (206, 192, 158), (236, 226, 196), (252, 248, 232)]
BONE_FAR = [(112, 100, 80), (150, 136, 108), (178, 164, 134), (178, 164, 134)]
CLOTH = [(110, 20, 26), (160, 34, 38), (200, 62, 56), (220, 90, 80)]
EMBER, EMBER_HI = (240, 60, 40), (255, 200, 150)
CURSE = [(140, 20, 40), (230, 70, 70), (255, 210, 200)]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([hip, knee], [2.4, 2.0]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 1.4, 1.4), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -1))], [2.0, 1.8]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 2, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 2, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    # 등뼈 마디(굵은 점선처럼 마디마다 밝게)
    cv.part(chain([hip, chest], [2.4, 2.2]), BONE_FAR, gloss=False)
    for i in range(1, 5):
        cv.pixel(*rnd(lerp(hip, chest, i / 5)), BONE[2])
    # 늑골 다섯: 등뼈에서 앞(오른쪽)으로 둥글게 휘어 흉골 쪽으로
    for i in range(5):
        t = 0.45 + i * 0.12
        s = lerp(hip, chest, t)
        span = 5.5 - abs(i - 2) * 0.6
        cv.line4([rnd(s), rnd(add(s, (span * math.cos(a) * 0.6 + 1, -1))), rnd(add(s, (span * math.cos(a) + 1, 1.5)))],
                 BONE[2] if i % 2 == 0 else BONE[1])
    # 골반(넓은 나비 모양) + 붉은 허리 천
    cv.part(poly(cv.blank(), [add(hip, (-5, -2)), add(hip, (5, -2)), add(hip, (3, 2)), add(hip, (-4, 2))]), BONE, gloss=False)
    flap = P.extra.get("flap", 0)
    cv.part(poly(cv.blank(), [add(hip, (-5, -1)), add(hip, (5, -1)), add(hip, (5, 3)), add(hip, (3 + flap, 8)),
                              add(hip, (0, 5)), add(hip, (-3 + flap, 8)), add(hip, (-5, 3))]), CLOTH, gloss=False)


def club(cv, hand, ang):
    """넓적다리뼈 몽둥이: 손에서 ang 방향으로 13px, 끝에 혹 둘."""
    tip = polar(hand, ang, 11)
    butt = polar(hand, ang + 180, 3)
    cv.part(chain([butt, hand, tip], [2.6, 3.0, 3.4]), BONE, gloss=False)
    for k in (-1, 1):
        cv.part(ellipse(cv.blank(), polar(tip, ang + 90 * k, 1.6), 2.2, 2.2), BONE, gloss=False)
    cv.part(ellipse(cv.blank(), polar(butt, ang + 90, 1.0), 1.5, 1.5), BONE, gloss=False)
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([sh, el], [2.2, 1.8]), ramp, gloss=False)
    cv.part(chain([el, hand], [1.8, 1.6]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.4, 1.4), ramp, gloss=False)
    if not far:
        P.extra["tip"] = club(cv, hand, P.extra.get("club", -60))
    # 어깨 관절 혹
    cv.part(ellipse(cv.blank(), sh, 1.8, 1.6), ramp, gloss=False)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    r = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 1)
    # 아래턱(벌어질수록 아래로 덜렁)
    cv.part(poly(cv.blank(), [r(-1, 2), r(7, 2 + jaw * 0.5), r(7, 4 + jaw), r(1, 4 + jaw * 0.6)]), BONE, gloss=False)
    # 길쭉하게 앞으로 비스듬한 두개골 + 튀어나온 위턱
    cv.part(poly(cv.blank(), [r(-5, -1), r(-4, -5), r(0, -7), r(5, -6), r(8, -3), r(8, 2), r(4, 3), r(-1, 3), r(-4, 2)]), BONE)
    cv.line([rnd(r(-3, 0)), rnd(r(0, 1))], BONE[0])  # 광대 아래 그늘
    e = rnd(r(4, -2))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (2, -1)), add(e, (2, 1)), add(e, (-1, 1))]), INK)
    if P.extra.get("eye") != "out":
        cv.pixel(e[0] + 1, e[1], EMBER)
        cv.pixel(e[0] + 1, e[1] - 1, EMBER_HI)
    cv.pixel(*rnd(r(7, 0)), INK)  # 콧구멍
    for dx in (3, 5, 7):
        cv.pixel(*rnd(r(dx, 2)), INK)  # 위 이빨 틈
    cv.pixel(*rnd(r(-2, -4)), BONE[0])  # 금
    cv.pixel(*rnd(r(-1, -5)), BONE[0])
    return dict(eye=r(4, -2), mouth=r(8, 3))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=6.5, thigh=8.0, shin=8.5, shoulder_w=3, hip_w=4)


def pose(name):
    if name == "idle_a":
        return Pose(hip=(27, 42), lean=10, arm_near=(70, 20), arm_far=(100, 60), foot_near=(34, 0), foot_far=(21, 0),
                    head_tilt=6, extra=dict(club=-70, jaw=1))
    if name == "idle_b":  # 덜그럭 내려앉으며 턱이 벌어지고 몽둥이가 처진다
        return Pose(hip=(27, 43), lean=14, arm_near=(78, 30), arm_far=(106, 70), foot_near=(34, 0), foot_far=(21, 0),
                    head_tilt=12, extra=dict(club=-55, jaw=3, flap=1))
    if name == "idle_c":  # 몽둥이로 어깨를 툭 치며 고개를 갸웃
        return Pose(hip=(27, 42), lean=6, arm_near=(100, 20), arm_far=(96, 56), foot_near=(35, 0), foot_far=(20, 0),
                    head_tilt=-6, extra=dict(club=95, jaw=1, flap=-1))
    if name == "windup":  # 몽둥이를 등 뒤 높이 쳐든다
        return Pose(hip=(28, 42), lean=-8, arm_near=(-110, -140), arm_far=(30, 0), foot_near=(35, 0), foot_far=(19, 0),
                    head_tilt=-8, extra=dict(club=-120, jaw=2, flap=-2))
    if name == "move":  # 몸을 숙이고 성큼 달린다
        return Pose(hip=(32, 41), lean=26, arm_near=(150, 100), arm_far=(20, 40), foot_near=(42, 2), foot_far=(20, 0),
                    head_tilt=14, extra=dict(club=170, jaw=2, flap=-3))
    if name == "attack":  # 몽둥이를 앞으로 내려친다
        return Pose(hip=(31, 42), lean=24, arm_near=(-10, 30), arm_far=(80, 60), foot_near=(42, 0), foot_far=(22, 0),
                    head_tilt=18, extra=dict(club=50, jaw=3, flap=2))
    if name == "recover":  # 스킬: 몽둥이를 머리 위로 휘돌리며 입을 크게 벌린다
        return Pose(hip=(25, 42), lean=-4, arm_near=(-80, -40), arm_far=(120, 80), foot_near=(32, 0), foot_far=(17, 0),
                    head_tilt=-14, extra=dict(club=-20, jaw=5))
    if name == "hit":  # 맞아서 뒤로 꺾이고 눈 불씨가 꺼진다
        return Pose(hip=(23, 43), lean=-20, arm_near=(-40, 10), arm_far=(-60, -20), foot_near=(31, 0), foot_far=(17, 2),
                    head_tilt=-28, extra=dict(club=-100, jaw=4, eye="out", flap=-2))
    raise KeyError(name)


def draw_dead(cv):
    """와르르 무너진 뼈 무더기: 골반·늑골·두개골·몽둥이가 바닥에 겹쳐 쌓였다."""
    club(cv, (12, 57), 0)
    cv.part(poly(cv.blank(), [(20, 59), (24, 55), (32, 54), (36, 59)]), CLOTH, gloss=False)
    cv.part(poly(cv.blank(), [(22, 56), (30, 54), (32, 57), (24, 58)]), BONE, gloss=False)
    for x in range(30, 44, 3):
        cv.line4([(x, 58), (x + 2, 53), (x + 4, 55)], BONE[2])
    cv.part(chain([(28, 58), (46, 58)], [2.2, 2.2]), BONE_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(42, 57), (44, 51), (49, 49), (54, 51), (55, 56), (52, 59), (44, 59)]), BONE)
    cv.put(poly(cv.blank(), [(48, 52), (50, 52), (50, 54), (48, 54)]), INK)
    for x in (52, 54):
        cv.pixel(x, 57, INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    tip = P.extra["tip"]
    if name == "attack":
        arc_trail(cv, J["hand_n"], 12, -60, 45, 3.0, BONE[2], WHITE)
        burst(cv, add(tip, (2, 1)), 4.5, CURSE[1], CURSE[2], spikes=6)
    elif name == "recover":
        # 머리 위로 그린 붉은 회오리 + 앞으로 흩어지는 뼈 조각 셋(회오리 띠에 꿰어 이어진다)
        h = J["hand_n"]
        arc_trail(cv, h, 12, -200, -10, 3.2, CURSE[0], CURSE[1])
        end = polar(h, -10, 12)
        pts = [lerp(end, (60, 34), t) for t in (0.0, 0.33, 0.66, 1.0)]
        cv.line4(pts, CURSE[1])
        for k, p in enumerate(pts[1:]):
            a = 30 + k * 60
            e1, e2 = polar(p, a, 3), polar(p, a + 180, 3)
            cv.part(chain([e1, e2], [2, 2]), BONE, gloss=False)
            for e in (e1, e2):
                cv.part(ellipse(cv.blank(), e, 1.4, 1.4), BONE, gloss=False)
        sparkle(cv, pts[-1], CURSE[2], CURSE[1], big=True)
    elif name == "windup":
        sparkle(cv, add(tip, (0, -2)), WHITE, BONE[2])
    elif name == "move":
        cv.line4([(4, 38), (12, 38)], BONE_FAR[1])
        cv.line4([(6, 44), (13, 44)], BONE_FAR[1])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((-6, -7), (-3, -9), (-8, -4)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("skeleton-01", draw, sys.argv[1:], idle_ms=220)

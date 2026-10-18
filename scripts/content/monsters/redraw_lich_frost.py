#!/usr/bin/env python3
"""서리 리치(lich-frost) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅 위로 살짝 떠 있는 해골 마법사: 하늘색 서리 결정이 솟은 얼음 관, 푸른 불이 타는 눈구멍의 큰 해골 얼굴,
목에 얼음 장식 깃이 선 넓은 보라 로브(아래로 갈수록 찢긴 자락), 뼈만 남은 손.
가까운 손에 위끝에 큰 얼음 결정을 단 장식 지팡이.
6번 칸(스킬 skill_mon_frost_orb): 지팡이 끝에 서리 결정이 박힌 얼음 구체를 뭉쳐 아군 쪽으로 쏜다.

  python3 scripts/content/monsters/redraw_lich_frost.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, sparkle, speed_lines

INK = (16, 14, 30)
ROBE = [(52, 30, 86), (84, 50, 128), (120, 80, 170), (156, 118, 204)]
ROBE_FAR = [(40, 24, 66), (52, 30, 86), (66, 40, 104), (66, 40, 104)]
BONE = [(150, 156, 170), (204, 210, 220), (240, 244, 250), (240, 244, 250)]
ICE = [(60, 130, 200), (120, 196, 240), (196, 238, 255), (250, 255, 255)]
GOLD = [(150, 110, 40), (214, 170, 70)]
SOUL = (110, 220, 255)
WOOD = [(60, 50, 70), (96, 84, 110), (130, 118, 146), (130, 118, 146)]
WHITE = (255, 255, 255)


def crystal(cv, c, ang, size, ramp=ICE):
    """끝이 뾰족한 육각 얼음 결정 하나(ang 방향으로 길다)."""
    side = ang + 90
    pts = [polar(c, ang, size * 1.6), polar(polar(c, ang, size * 0.5), side, size * 0.6), polar(polar(c, ang + 180, size * 0.6), side, size * 0.6),
           polar(c, ang + 180, size * 1.2), polar(polar(c, ang + 180, size * 0.6), side, -size * 0.6), polar(polar(c, ang, size * 0.5), side, -size * 0.6)]
    cv.part(poly(cv.blank(), pts), ramp, gloss=False)
    cv.line4([rnd(polar(c, ang + 180, size * 0.8)), rnd(polar(c, ang, size * 1.2))], ramp[3] if len(ramp) > 3 else WHITE)


def leg(cv, hip, knee, foot, far):
    pass  # 다리 없이 떠 있다: 로브 자락이 대신한다


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    float_y = hip[1] + 10 - P.extra.get("lift", 0)
    sway = P.extra.get("sway", 0)
    # 넓은 로브: 어깨에서 퍼져 아래는 찢긴 세 자락(뒤로 흩날림)
    hem = [(hip[0] + 8 + sway * 0.3, float_y - 1), (hip[0] + 4, float_y + 2), (hip[0] + 1, float_y - 1),
           (hip[0] - 3 - sway * 0.5, float_y + 3), (hip[0] - 6 - sway, float_y), (hip[0] - 10 - sway * 1.4, float_y + 2)]
    pts = [R(-6, -16), R(5, -16), R(8, -6)] + hem + [R(-9, -6)]
    cv.part(poly(cv.blank(), pts), ROBE)
    cv.line4([R(1, -13), (hip[0] + 3, float_y - 1)], ROBE[0])
    cv.line4([R(-4, -8), (hip[0] - 4 - sway * 0.5, float_y)], ROBE[0])
    # 금 테 허리띠 + 가운데 얼음 보석
    cv.line([rnd(R(-7, -6)), rnd(R(6, -6))], GOLD[0])
    cv.pixel(*rnd(R(1, -6)), ICE[2])
    # 목 뒤 높이 선 얼음 장식 깃(뒤쪽 = 왼쪽)
    for k, (dx, h) in enumerate(((-6, 7), (-3, 9), (0, 6))):
        crystal(cv, R(dx, -16), -100 - k * 12 + lean * 0.5, h * 0.32)


def staff(cv, hand, ang):
    top = polar(hand, ang, 13)
    bot = polar(hand, ang + 180, 10)
    cv.part(chain([bot, top], [1.2, 1.3]), WOOD, gloss=False)
    # 금 갈고리 받침 둘 + 큰 결정
    for s in (-1, 1):
        cv.line4([rnd(polar(top, ang + 180, 1)), rnd(polar(polar(top, ang, 2), ang + 90 * s, 2.5))], GOLD[1])
    g = polar(top, ang, 3.5)
    crystal(cv, g, ang, 2.6)
    return polar(g, ang, 4)


def arm(cv, sh, el, hand, far, P):
    ramp = ROBE_FAR if far else ROBE
    # 펄럭이는 넓은 소매 + 뼈 아래팔
    cv.part(chain([sh, el], [3.2, 3.8]), ramp, gloss=False)
    bone = [BONE[0], BONE[0], BONE[1], BONE[1]] if far else BONE
    cv.part(chain([lerp(sh, el, 0.9), hand], [1.2, 1.0]), bone, gloss=False)
    # 뼈 손가락 셋
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    for d in (-35, 0, 35):
        cv.line([rnd(hand), rnd(polar(hand, ang + d, 2.4))], bone[1])
    if not far and P.extra.get("staff") is not None:
        P.extra["_gem"] = staff(cv, hand, P.extra["staff"])


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 큰 해골: 둥근 두개골 + 앞으로 좁아지는 광대·위턱
    cv.part(ellipse(cv.blank(), R(-1, -1), 5.4, 5.0), BONE)
    jaw = P.extra.get("jaw", 0)
    cv.part(poly(cv.blank(), [R(0, 1), R(6, 0), R(6, 3), R(4, 5 + jaw), R(-1, 5 + jaw)]), BONE, gloss=False)
    # 눈구멍(가까운 눈 크게) + 푸른 영혼 불
    eye = R(3, -1)
    cv.put(ellipse(cv.blank(), eye, 2.0, 1.8), INK)
    if P.extra.get("eye") != "shut":
        cv.pixel(*rnd(eye), SOUL)
        cv.pixel(*rnd(add(eye, (1, 0))), WHITE)
    else:
        cv.pixel(*rnd(eye), ICE[0])
    # 먼 눈구멍 + 광대 아래 그늘
    cv.put(ellipse(cv.blank(), R(-1, -1), 1.2, 1.4), INK)
    cv.pixel(*rnd(R(-1, -1)), ICE[0])
    cv.line([rnd(R(-3, 2)), rnd(R(0, 3))], BONE[0])
    # 코 구멍 + 이빨 줄
    cv.pixel(*rnd(R(5, 1)), INK)
    cv.line([rnd(R(1, 3 + jaw * 0.5)), rnd(R(5, 3 + jaw * 0.5))], INK)
    if jaw:
        cv.line([rnd(R(1, 4 + jaw)), rnd(R(4, 4 + jaw))], INK)
    # 얼음 관: 금 띠 + 위로 솟은 결정 셋(가운데 가장 큼)
    cv.line4([R(-6, -4), R(4, -5)], GOLD[1])
    for dx, h, d in ((-4, 2.0, -10), (-1, 2.8, 0), (3, 1.8, 12)):
        crystal(cv, R(dx, -6 - h), -90 + d + tilt, h)
    return dict(eye=eye, mouth=R(4, 4))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=6.5, thigh=7.0, shin=7.0, hip_w=4.0, shoulder_w=7.0)


def pose(name):
    b = dict(hip=(28, 44), torso=13.0, neck=0.5, foot_near=(32, 4), foot_far=(24, 4))
    if name == "idle_a":
        return Pose(**b, lean=6, arm_near=(60, 80), arm_far=(110, 90), head_tilt=4, extra=dict(staff=-88, sway=0))
    if name == "idle_b":  # 떠오르며 자락이 뒤로 흩날린다
        return Pose(**dict(b, hip=(28, 42)), lean=4, arm_near=(55, 70), arm_far=(115, 95), head_tilt=0,
                    extra=dict(staff=-90, sway=3, lift=1))
    if name == "idle_c":
        return Pose(**dict(b, hip=(28, 43)), lean=8, arm_near=(65, 90), arm_far=(105, 85), head_tilt=6,
                    extra=dict(staff=-86, sway=1, jaw=1))
    if name == "windup":  # 지팡이를 높이 들어 냉기를 모은다
        return Pose(**dict(b, hip=(26, 43)), lean=-6, arm_near=(-70, -95), arm_far=(-150, -120), head_tilt=-10,
                    extra=dict(staff=-82, sway=2, jaw=2))
    if name == "move":  # 앞으로 미끄러지듯 날아든다
        return Pose(**dict(b, hip=(31, 43)), lean=20, arm_near=(140, 110), arm_far=(160, 130), head_tilt=10,
                    extra=dict(staff=-30, sway=6))
    if name == "attack":  # 뼈 손톱으로 할퀸다(지팡이는 먼 쪽)
        return Pose(**dict(b, hip=(28, 43)), lean=18, arm_near=(-10, 5), arm_far=(120, 100), head_tilt=10,
                    extra=dict(staff=None, sway=4, jaw=3))
    if name == "recover":  # 스킬 얼음 구체: 지팡이를 앞으로 겨눠 쏜다
        return Pose(**dict(b, hip=(19, 43)), lean=6, arm_near=(-30, -45), arm_far=(-150, -120), head_tilt=0,
                    extra=dict(staff=-55, sway=3, jaw=2))
    if name == "hit":  # 맞고 뒤로 젖혀지며 관 결정이 튄다
        return Pose(**dict(b, hip=(26, 44)), lean=-14, arm_near=(-50, -20), arm_far=(160, 140), head_tilt=-20,
                    extra=dict(staff=-130, sway=-2, jaw=2, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    """무너진 로브 더미 위 해골과 깨진 얼음 관, 쓰러진 지팡이."""
    cv.part(poly(cv.blank(), [(10, 59), (16, 53), (28, 51), (36, 54), (40, 59)]), ROBE)
    cv.line4([(18, 56), (32, 54)], ROBE[0])
    cv.part(ellipse(cv.blank(), (42, 55), 4.6, 4.2), BONE)
    cv.put(ellipse(cv.blank(), (44, 54), 1.4, 1.2), INK)
    cv.line([(42, 58), (46, 58)], INK)
    for c, h, ang in (((36, 50), 1.6, -120), ((49, 52), 1.4, -60)):
        crystal(cv, c, ang, h)
    cv.part(chain([(46, 60), (58, 58)], [1.2, 1.2]), WOOD, gloss=False)
    crystal(cv, (59, 56), -40, 1.6)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 3, 9, (34, 40, 60), ROBE[2])
    J = draw_body(cv, LOOK, P)
    g = P.extra.get("_gem", J["hand_n"])
    if name == "windup":
        cv.part(ellipse(cv.blank(), add(g, (0, -2)), 2.4, 2.4), [ICE[0], ICE[1], ICE[2], ICE[3]], gloss=False)
        for p in ((-6, -1), (5, -6), (-3, -8), (6, 1)):
            cv.pixel(*rnd(add(g, p)), ICE[2])
        sparkle(cv, add(g, (6, -5)), WHITE, ICE[1])
    elif name == "attack":
        h = J["hand_n"]
        for k in range(3):
            cv.line4([rnd(add(h, (-2 + k * 2, -5 + k))), rnd(add(h, (5 + k * 2, 3 + k)))], ICE[2] if k != 1 else WHITE)
    elif name == "recover":
        # 지팡이 끝 앞에 뭉친 얼음 구체 + 박힌 결정 + 서리 꼬리
        c = add(g, (6, 2))
        cv.part(ellipse(cv.blank(), c, 4.4, 4.2), ICE)
        cv.put(ellipse(cv.blank(), add(c, (1, -1)), 1.8, 1.6), WHITE)
        for ang in (-60, 30, 150):
            crystal(cv, polar(c, ang, 4.4), ang, 1.2)
        for dx, dy in ((-7, -2), (-9, 2), (-5, 4)):
            cv.pixel(*rnd(add(c, (dx, dy))), ICE[2])
        sparkle(cv, add(c, (-1, -7)), WHITE, ICE[1])
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -9), (10, -5), (9, -12)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
        crystal(cv, add(hd, (-9, -10)), -150, 1.2)
    return cv.image()


if __name__ == "__main__":
    run("lich-frost", draw, sys.argv[1:], idle_ms=280)

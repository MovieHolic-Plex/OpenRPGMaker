#!/usr/bin/env python3
"""오크 주술사(orc-shaman) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

마르고 구부정한 늙은 초록 오크: 큰 주둥이와 엄니, 뼈 뿔이 꽂힌 머리띠, 땅에 끌리는 붉은 긴 로브,
가슴에 뼈 목걸이. 가까운 손에 꼭대기에 붉은 보석과 작은 해골을 단 굽은 나무 지팡이.
6번 칸(스킬 skill_mon_hex_fire): 지팡이를 앞으로 겨누고 보석에서 초록 저주 불덩이를 쏜다.

  python3 scripts/content/monsters/redraw_orc_shaman.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (20, 18, 16)
SKIN = [(52, 96, 40), (84, 136, 56), (120, 172, 76), (160, 204, 108)]
SKIN_FAR = [(40, 72, 32), (52, 96, 40), (66, 112, 48), (66, 112, 48)]
ROBE = [(90, 22, 26), (140, 36, 38), (184, 64, 56), (214, 104, 86)]
ROBE_FAR = [(70, 18, 22), (90, 22, 26), (112, 30, 32), (112, 30, 32)]
BONE = [(170, 156, 120), (222, 210, 176), (250, 244, 222)]
WOOD = [(70, 46, 28), (106, 72, 42), (140, 100, 60), (140, 100, 60)]
GEM = [(130, 20, 30), (230, 50, 60), (255, 170, 170)]
HEX = [(20, 90, 40), (60, 190, 80), (170, 255, 140), (240, 255, 220)]
EYE = (250, 210, 60)
TUSK = (244, 236, 204)
WHITE = (255, 255, 240)


def leg(cv, hip, knee, foot, far):
    # 로브 아래로 보이는 맨발만(다리는 로브가 덮는다)
    f = rnd(foot)
    ramp = SKIN_FAR if far else SKIN
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 4, f[1]), (f[0] - 2, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    flare = P.extra.get("flare", 0)
    ground = 59
    # 땅에 끌리는 긴 로브: 어깨에서 넓게 퍼져 바닥 자락
    hem_l, hem_r = (hip[0] - 9 - flare, ground - 1), (hip[0] + 8 + flare * 0.5, ground - 1)
    pts = [R(-5, -16), R(4, -16), R(7, -8), hem_r, (hem_r[0] - 3, ground - 2), (hip[0] - 1, ground - 1),
           (hem_l[0] + 3, ground - 2), hem_l, R(-8, -4)]
    cv.part(poly(cv.blank(), pts), ROBE)
    # 앞섶 금빛 대신 짙은 주름선 두 줄
    cv.line4([R(1, -12), (hip[0] + 2, ground - 3)], ROBE[0])
    cv.line4([R(-4, -6), (hip[0] - 5, ground - 3)], ROBE[0])
    # 허리 끈
    cv.line([rnd(R(-6, -6)), rnd(R(5, -6))], WOOD[0])
    # 어깨에서 허리로 비스듬히 두른 뼈 구슬 띠
    for k in range(6):
        p = lerp(R(-5, -15), R(5, -6), k / 5)
        cv.pixel(*rnd(p), BONE[1] if k % 2 == 0 else BONE[0])
    # 뼈 목걸이(송곳니 조각 셋)
    for k, dx in enumerate((-2, 1, 4)):
        p = R(dx, -14 + abs(k - 1) * -1 + 1)
        cv.pixel(*rnd(p), BONE[1])
        cv.pixel(*rnd(add(p, (0, 1))), BONE[2] if k == 1 else BONE[0])


def staff(cv, hand, ang):
    """손을 지나 위아래로 뻗은 굽은 지팡이. 위끝에 작은 해골 + 붉은 보석."""
    top = polar(hand, ang, 12)
    bot = polar(hand, ang + 180, 10)
    mid = polar(lerp(bot, top, 0.6), ang + 90, 1.2)
    cv.part(chain([bot, mid, top], [1.2, 1.3, 1.4]), WOOD, gloss=False)
    # 해골: 지팡이 끝 바로 아래, 보석은 끝에
    sk = polar(top, ang + 180, 2)
    cv.part(ellipse(cv.blank(), sk, 2.4, 2.2), BONE, gloss=False)
    cv.pixel(*rnd(add(sk, (1, 0))), INK)
    cv.pixel(*rnd(add(sk, (-1, 0))), INK)
    g = polar(top, ang, 2)
    cv.part(poly(cv.blank(), [polar(g, ang, 3), polar(g, ang + 90, 2), polar(g, ang + 180, 2), polar(g, ang - 90, 2)]), GEM, gloss=False)
    cv.pixel(*rnd(polar(g, ang, 0.5)), GEM[2])
    # 뼈 뿔 장식 둘
    cv.line([rnd(polar(sk, ang + 60, 2)), rnd(polar(sk, ang + 40, 5))], BONE[1])
    cv.line([rnd(polar(sk, ang - 60, 2)), rnd(polar(sk, ang - 40, 5))], BONE[1])
    return polar(g, ang, 3)


def arm(cv, sh, el, hand, far, P):
    ramp = ROBE_FAR if far else ROBE
    # 넓은 소매(팔꿈치까지) + 마른 아래팔
    cv.part(chain([sh, el], [3.2, 3.6]), ramp, gloss=False)
    cv.part(chain([el, hand], [1.8, 1.6]), SKIN_FAR if far else SKIN, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.8, 1.8), SKIN_FAR if far else SKIN, gloss=False)
    if not far:
        P.extra["_gem"] = staff(cv, hand, P.extra.get("staff", -90))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤 뾰족 귀
    cv.part(poly(cv.blank(), [R(-3, -2), R(-9, -4), R(-3, 1)]), SKIN_FAR, gloss=False)
    cv.part(ellipse(cv.blank(), R(-1, -1), 4.6, 4.6), SKIN)
    jaw = P.extra.get("jaw", 0)
    cv.part(poly(cv.blank(), [R(1, -2), R(7, -1), R(7, 2), R(5, 3 + jaw), R(0, 3 + jaw), R(-2, 2)]), SKIN, gloss=False)
    # 뼈 뿔 머리띠
    cv.line4([R(-5, -4), R(3, -5)], ROBE[0])
    for base, mid, tip in (((-3, -5), (-6, -9), (-10, -10)), ((0, -5), (-1, -10), (-5, -12))):
        cv.part(chain([R(*base), R(*mid), R(*tip)], [1.4, 1.1, 0.7]), BONE, gloss=False)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(R(2, -2)), rnd(R(4, -2))], INK)
    else:
        cv.line([rnd(R(1, -4)), rnd(R(5, -3 if P.extra.get("angry") else -4))], INK)
        cv.pixel(*rnd(R(3, -2)), EYE)
    cv.pixel(*rnd(R(7, 0)), INK)
    if jaw:
        cv.line([rnd(R(3, 2)), rnd(R(6, 2 + jaw * 0.5))], INK)
    for dx in (3, 6):
        cv.line([rnd(R(dx, 2 + jaw)), rnd(R(dx, 1))], TUSK)
    # 흰 턱수염 몇 가닥
    cv.line([rnd(R(1, 4 + jaw)), rnd(R(0, 6 + jaw))], BONE[1])
    return dict(eye=R(3, -2), mouth=R(6, 2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=6.0, lower=6.0, thigh=7.0, shin=7.0, hip_w=4.0, shoulder_w=6.0)


def pose(name):
    b = dict(hip=(27, 47), torso=12.0, neck=0.5, foot_near=(32, 0), foot_far=(22, 0))
    if name == "idle_a":  # 지팡이에 몸을 기대 구부정히
        return Pose(**b, lean=16, arm_near=(30, 70), arm_far=(100, 80), head_tilt=8, extra=dict(staff=-95))
    if name == "idle_b":  # 중얼거리며 지팡이를 살짝 든다
        return Pose(**dict(b, hip=(27, 46)), lean=14, arm_near=(20, 50), arm_far=(110, 70), head_tilt=4,
                    extra=dict(staff=-98, jaw=1, flare=1))
    if name == "idle_c":
        return Pose(**dict(b, hip=(27, 47)), lean=18, arm_near=(35, 75), arm_far=(95, 90), head_tilt=10,
                    extra=dict(staff=-92, flare=-1))
    if name == "windup":  # 지팡이를 높이 쳐들어 주문을 모은다
        return Pose(**dict(b, hip=(25, 47), foot_far=(19, 0)), lean=-2,
                    arm_near=(-70, -95), arm_far=(-150, -120), head_tilt=-10, extra=dict(staff=-80, angry=True, jaw=2, flare=2))
    if name == "move":  # 로브를 펄럭이며 미끄러지듯 다가온다
        return Pose(**dict(b, hip=(30, 47), foot_near=(37, 0), foot_far=(23, 0)), lean=22,
                    arm_near=(70, 120), arm_far=(150, 120), head_tilt=12, extra=dict(staff=-45, angry=True, flare=4))
    if name == "attack":  # 지팡이로 후려친다
        return Pose(**dict(b, hip=(23, 47), foot_near=(30, 0), foot_far=(16, 0)), lean=22,
                    arm_near=(-10, 10), arm_far=(130, 110), head_tilt=12, extra=dict(staff=-30, angry=True, jaw=2, flare=1))
    if name == "recover":  # 스킬 주술 불꽃: 지팡이를 앞으로 겨눠 쏜다
        return Pose(**dict(b, hip=(21, 47), foot_near=(28, 0), foot_far=(15, 0)), lean=8,
                    arm_near=(-25, -45), arm_far=(-40, -20), head_tilt=0, extra=dict(staff=-40, angry=True, jaw=3, flare=2))
    if name == "hit":  # 맞고 뒤로 휘청
        return Pose(**dict(b, hip=(25, 47), foot_near=(30, 0), foot_far=(20, 0)), lean=-14,
                    arm_near=(-40, -10), arm_far=(160, 140), head_tilt=-20, extra=dict(staff=-130, eye="shut", jaw=2, flare=-2))
    raise KeyError(name)


def draw_dead(cv):
    """앞으로 엎어진 주술사: 붉은 로브 더미, 머리 뿔 장식, 굴러간 지팡이."""
    cv.part(poly(cv.blank(), [(10, 59), (14, 53), (24, 50), (34, 52), (37, 59)]), ROBE)
    cv.line4([(16, 55), (30, 53)], ROBE[0])
    cv.part(ellipse(cv.blank(), (41, 56), 4.0, 3.6), SKIN)
    cv.part(chain([(40, 53), (37, 47)], [1.4, 0.8]), BONE, gloss=False)
    cv.line([(41, 55), (43, 55)], INK)
    cv.pixel(45, 57, TUSK)
    cv.part(chain([(46, 59), (58, 57)], [1.2, 1.2]), WOOD, gloss=False)
    cv.part(ellipse(cv.blank(), (58, 56), 2.0, 1.8), BONE, gloss=False)
    cv.pixel(60, 55, GEM[1])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 3, 9, (34, 42, 50), ROBE[1])
    J = draw_body(cv, LOOK, P)
    g = P.extra.get("_gem", J["hand_n"])
    if name == "windup":
        # 보석 위에 모이는 초록 주술 불씨
        cv.part(ellipse(cv.blank(), add(g, (0, -2)), 2.4, 2.4), HEX[1:] + [HEX[3]], gloss=False)
        for p in ((-6, -2), (5, -6), (-3, -8), (6, 2)):
            cv.pixel(*rnd(add(g, p)), HEX[2])
        sparkle(cv, add(g, (5, -5)), HEX[3], HEX[2])
    elif name == "move":
        puff(cv, (14, 57), 2.0, [ROBE[1], ROBE[2]])
    elif name == "attack":
        burst(cv, add(g, (1, 0)), 3.6, GEM[2], WHITE, spikes=6)
    elif name == "recover":
        # 보석에서 아군 쪽으로 날아가는 초록 저주 불덩이 + 꼬리
        c = add(g, (6, 3))
        cv.part(ellipse(cv.blank(), c, 4.2, 3.6), [HEX[0], HEX[1], HEX[2], HEX[3]], gloss=False)
        cv.put(ellipse(cv.blank(), add(c, (1, 0)), 1.8, 1.6), HEX[3])
        for dx, dy, r in ((-6, -1, 2.4), (-10, 1, 1.8), (-13, -1, 1.2)):
            cv.part(ellipse(cv.blank(), add(c, (dx, dy)), r, r * 0.9), HEX, gloss=False)
        for p in ((5, -4), (6, 3), (-2, -5)):
            cv.pixel(*rnd(add(c, p)), HEX[2])
        sparkle(cv, add(g, (1, 0)), WHITE, HEX[2])
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("orc-shaman", draw, sys.argv[1:], idle_ms=240)

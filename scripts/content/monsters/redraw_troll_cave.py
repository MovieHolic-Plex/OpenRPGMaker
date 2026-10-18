#!/usr/bin/env python3
"""동굴 트롤(troll-cave) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

구부정한 이끼색 거인: 앞으로 처진 큰 머리에 늘어진 매부리코, 아래턱에서 솟은 누런 엄니 둘, 작은 노란 눈과
처진 귀, 등에 난 이끼 덩어리와 등뼈 혹. 땅에 닿을 듯 긴 팔과 큰 손, 짧고 굵은 다리에 넓은 맨발.
가죽 허리 천에 뼈 장식, 가까운 손에 쇠 테를 두른 옹이진 통나무 몽둥이.
6번 칸(스킬 skill_mon_boulder_throw): 머리 위로 든 큰 바위를 아군 쪽으로 내던진다.

  python3 scripts/content/monsters/redraw_troll_cave.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle, speed_lines

S = 96
GROUND = S - 4
INK = (16, 24, 18)
SKIN = [(52, 82, 52), (82, 118, 70), (118, 150, 88), (160, 186, 116)]
SKIN_FAR = [(38, 60, 40), (52, 82, 52), (66, 98, 60), (66, 98, 60)]
MOSS = [(40, 70, 34), (62, 102, 44), (96, 138, 58), (96, 138, 58)]
TUSK = [(170, 150, 100), (214, 198, 146), (240, 230, 190), (240, 230, 190)]
LEATHER = [(62, 42, 30), (94, 64, 42), (126, 90, 58), (126, 90, 58)]
WOOD = [(70, 46, 30), (104, 72, 44), (140, 102, 64), (172, 132, 86)]
IRON = [(60, 64, 72), (98, 104, 114), (150, 156, 166), (200, 206, 214)]
ROCK = [(74, 72, 78), (108, 104, 110), (146, 140, 144), (184, 178, 176)]
EYE, EYE_HI = (240, 200, 60), (255, 246, 190)
DUST = [ROCK[2], ROCK[3]]
MOUTH = (90, 30, 34)
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    """짧고 굵은 허벅지 -> 무릎 -> 넓적한 맨발(발가락 셋)."""
    ramp = SKIN_FAR if far else SKIN
    ankle = add(foot, (0, -4))
    cv.part(chain([hip, knee], [7.0, 6.0]), ramp, gloss=False)
    cv.part(chain([knee, ankle], [5.8, 4.6]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 5, f[1] - 5), (f[0] + 3, f[1] - 5), (f[0] + 9, f[1] - 2), (f[0] + 9, f[1]), (f[0] - 6, f[1])]),
            ramp, gloss=False)
    if not far:
        for dx in (3, 6):
            cv.line([(f[0] + dx, f[1] - 2), (f[0] + dx, f[1])], ramp[0])
        cv.pixel(f[0] + 9, f[1] - 1, TUSK[1])  # 발톱


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 가죽 허리 천
    cv.part(poly(cv.blank(), [R(-10, -2), R(10, -2), R(11, 9), R(5, 7), R(1, 11), R(-4, 7), R(-11, 9)]), LEATHER)
    # 굽은 몸통: 등이 크게 솟고 배가 처졌다
    cv.part(poly(cv.blank(), [R(-10, 0), R(10, 0), R(14, -8), R(13, -18), R(6, -24), R(-6, -26), R(-14, -22), R(-14, -10)]), SKIN)
    # 처진 배(밝게)
    cv.part(poly(cv.blank(), [R(1, -1), R(10, -1), R(14, -8), R(12, -15), R(5, -14), R(2, -8)]), [SKIN[1], SKIN[2], SKIN[3], SKIN[3]], gloss=False)
    cv.line4([R(4, -10), R(12, -9)], SKIN[1])
    # 등 이끼 + 등뼈 혹
    cv.part(poly(cv.blank(), [R(-14, -14), R(-16, -20), R(-12, -26), R(-6, -28), R(-2, -25), R(-8, -22), R(-12, -16)]), MOSS, gloss=False)
    for p in ((-15, -12), (-14, -18), (-10, -24)):
        cv.pixel(*rnd(R(*p)), MOSS[2])
    # 허리끈 + 뼈 장식
    cv.part(poly(cv.blank(), [R(-10, -3), R(10, -3), R(10, 0), R(-10, 0)]), LEATHER, gloss=False)
    for dx in (-5, 3):
        cv.part(chain([R(dx, 0), R(dx + 1, 5)], [1.0, 1.0]), TUSK, gloss=False)


def club(cv, hand, ang):
    """옹이진 통나무 몽둥이: 손잡이에서 끝으로 굵어지고 쇠 테 하나, 끝에 쇠못."""
    butt = polar(hand, ang + 180, 4)
    top = polar(hand, ang, 26)
    cv.part(chain([butt, polar(hand, ang, 9), top], [2.2, 3.2, 6.0]), WOOD)
    band = polar(hand, ang, 14)
    for side in (ang + 90, ang - 90, ang):
        tip = polar(top, side, 7)
        cv.line4([rnd(polar(top, side, 3)), rnd(tip)], IRON[2])
    cv.part(chain([polar(band, ang + 90, 4), polar(band, ang - 90, 4)], [1.4, 1.4]), IRON, gloss=False)
    cv.pixel(*rnd(polar(polar(hand, ang, 18), ang + 90, 2)), WOOD[0])  # 옹이
    return top


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [5.4, 4.6]), ramp, gloss=False)
    cv.part(chain([el, hand], [4.6, 4.2]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 4.0, 3.6), ramp, gloss=False)  # 큰 주먹
    cv.part(ellipse(cv.blank(), add(sh, (-1, 1)), 5.0, 4.6), ramp)
    if not far:
        if P.extra.get("club") is not None:
            P.extra["_top"] = club(cv, hand, P.extra["club"])
        else:
            P.extra["_top"] = hand


def head(cv, c, tilt, P):
    c = add(c, (10, 0))  # 구부정해서 머리가 어깨 앞으로 쑥 나온다
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 처진 귀(뒤)
    cv.part(poly(cv.blank(), [R(-5, -4), R(-13, -6), R(-11, -1), R(-5, 1)]), SKIN, gloss=False)
    cv.pixel(*rnd(R(-9, -3)), SKIN[0])
    # 큰 머리: 낮은 이마, 튀어나온 눈두덩
    cv.part(poly(cv.blank(), [R(-7, -6), R(-2, -10), R(5, -9), R(9, -6), R(11, -1), R(10, 5), R(4, 8 + jaw * 0.5), R(-4, 7), R(-8, 2)]), SKIN)
    # 아래턱(앞으로 나온 주걱턱)
    cv.part(poly(cv.blank(), [R(-2, 4), R(11, 3 + jaw * 0.4), R(12, 8 + jaw), R(1, 9 + jaw * 0.6)]), SKIN, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(3, 4), R(11, 4), R(10, 4 + jaw), R(3, 5 + jaw * 0.5)]), MOUTH)
    # 엄니 둘(아래턱에서 위로)
    for dx in (5, 10):
        cv.part(chain([R(dx, 5 + jaw * 0.8), R(dx + 1, 1 + jaw * 0.5)], [1.4, 0.8]), TUSK, gloss=False)
    # 늘어진 매부리코
    cv.part(poly(cv.blank(), [R(6, -5), R(10, -4), R(15, 1), R(14, 4), R(10, 3), R(8, -1)]), SKIN)
    cv.pixel(*rnd(R(12, 3)), SKIN[0])
    # 굵은 눈두덩 + 작은 노란 눈
    e = R(5, -4)
    cv.line4([R(1, -7), R(9, -6)], SKIN[0])
    if P.extra.get("eye") == "shut":
        cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (2, 0)))], INK)
    else:
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
    # 정수리 이끼 머리털
    cv.part(poly(cv.blank(), [R(-7, -6), R(-4, -12), R(2, -11), R(5, -9), R(-1, -8)]), MOSS, gloss=False)
    return dict(eye=e, nose=R(15, 2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=12.0, lower=12.0, thigh=10.0, shin=10.0, hip_w=8.0,
            shoulder_w=14.0, ground=GROUND)


def pose(name):
    b = dict(hip=(38, 70), torso=22.0, neck=1.0, foot_near=(48, 0), foot_far=(29, 0))
    if name == "idle_a":  # 구부정히 서서 몽둥이를 앞에 비스듬히 들고 긴 팔을 늘어뜨린다
        return Pose(**b, lean=18, arm_near=(80, 20), arm_far=(95, 90), head_tilt=10, extra=dict(club=-40))
    if name == "idle_b":  # 숨을 몰아쉬며 어깨가 내려앉는다
        return Pose(**dict(b, hip=(38, 71)), lean=22, arm_near=(86, 28), arm_far=(100, 95), head_tilt=14,
                    extra=dict(club=-32, jaw=2))
    if name == "idle_c":  # 몸을 펴며 몽둥이를 치켜든다
        return Pose(**dict(b, foot_near=(49, 0)), lean=15, arm_near=(74, 12), arm_far=(90, 85), head_tilt=6,
                    extra=dict(club=-48, jaw=1))
    if name == "windup":  # 몽둥이를 머리 위로 높이 치켜든다
        return Pose(**dict(b, hip=(36, 71), foot_near=(47, 0), foot_far=(25, 0)), lean=-4,
                    arm_near=(-80, -110), arm_far=(-70, -100), head_tilt=-6, extra=dict(club=-120, jaw=4))
    if name == "move":  # 쿵쿵 앞으로 돌진, 몽둥이를 뒤로 끈다
        return Pose(**dict(b, hip=(44, 70), foot_near=(60, 1), foot_far=(26, 0)), lean=32,
                    arm_near=(110, 150), arm_far=(70, 20), head_tilt=24, extra=dict(club=170, jaw=3))
    if name == "attack":  # 몽둥이를 앞으로 크게 내려찍는다
        return Pose(**dict(b, hip=(40, 71), foot_near=(56, 0), foot_far=(24, 0)), lean=30,
                    arm_near=(20, 40), arm_far=(30, 50), head_tilt=18, extra=dict(club=30, jaw=4))
    if name == "recover":  # 스킬 바위 던지기: 머리 위의 큰 바위를 앞으로 내던진다
        return Pose(**dict(b, hip=(38, 71), foot_near=(55, 0), foot_far=(24, 0)), lean=20,
                    arm_near=(-30, -10), arm_far=(-20, 0), head_tilt=8, extra=dict(club=None, jaw=4))
    if name == "hit":  # 맞아서 뒤로 휘청
        return Pose(**dict(b, hip=(35, 71), foot_near=(45, 0), foot_far=(27, 1)), lean=-14,
                    arm_near=(130, 170), arm_far=(150, 175), head_tilt=-20, extra=dict(club=-160, eye="shut", jaw=3))
    raise KeyError(name)


def boulder(cv, c, r):
    cv.part(ellipse(cv.blank(), c, r, r * 0.86), ROCK)
    cv.line4([rnd(add(c, (-r * 0.4, -r * 0.2))), rnd(add(c, (r * 0.1, r * 0.3)))], ROCK[0])
    cv.part(ellipse(cv.blank(), add(c, (-r * 0.3, r * 0.3)), r * 0.35, r * 0.3), [MOSS[0], MOSS[1], MOSS[2], MOSS[2]], gloss=False)


def draw_dead(cv):
    """엎어진 트롤: 등 이끼가 위로, 몽둥이가 손에서 굴러 나갔다."""
    g = GROUND
    cv.part(chain([(10, g - 3), (24, g - 4)], [4.0, 5.0]), SKIN_FAR, gloss=False)  # 다리
    cv.part(poly(cv.blank(), [(4, g), (6, g - 5), (13, g - 5), (13, g)]), SKIN_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(20, g - 2), (34, g - 6), (40, g)]), LEATHER, gloss=False)
    cv.part(poly(cv.blank(), [(26, g), (30, g - 11), (46, g - 15), (60, g - 11), (62, g)]), SKIN)
    cv.part(poly(cv.blank(), [(34, g - 11), (44, g - 18), (54, g - 15), (48, g - 11)]), MOSS, gloss=False)
    # 머리
    cv.part(poly(cv.blank(), [(58, g), (60, g - 9), (68, g - 11), (74, g - 6), (74, g)]), SKIN)
    cv.part(poly(cv.blank(), [(70, g - 6), (77, g - 3), (76, g), (70, g)]), SKIN, gloss=False)
    cv.part(chain([(68, g - 1), (70, g - 4)], [1.2, 0.8]), TUSK, gloss=False)
    cv.line([(64, g - 7), (66, g - 5)], INK)
    cv.line([(66, g - 7), (64, g - 5)], INK)
    # 뻗은 팔과 굴러간 몽둥이
    cv.part(chain([(52, g - 9), (66, g - 14), (78, g - 12)], [3.6, 3.2, 3.0]), SKIN_FAR, gloss=False)
    cv.part(chain([(80, g - 2), (86, g - 2), (92, g - 4)], [2.0, 3.0, 4.2]), WOOD)
    puff(cv, (44, g - 3), 3.0, DUST)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 12, (44, 54, 64, 74), SKIN[2])
    J = draw_body(cv, LOOK, P)
    top = P.extra["_top"]
    if name == "windup":
        sparkle(cv, add(top, (3, -3)), WHITE, IRON[2])
    elif name == "move":
        puff(cv, (20, GROUND - 3), 3.6, DUST)
        puff(cv, (11, GROUND - 4), 2.6, DUST)
    elif name == "attack":
        slash(cv, add(top, (-14, -18)), add(top, (2, 4)), 4, 3.4, IRON[2], WHITE)
        burst(cv, add(top, (2, 2)), 6.0, ROCK[3], WHITE, spikes=7)
    elif name == "recover":
        hands = lerp(J["hand_n"], J["hand_f"], 0.5)
        bc = add(hands, (10, -8))
        boulder(cv, bc, 12.0)
        for k, (dx, dy) in enumerate(((20, 4), (26, 8), (32, 12))):
            cv.line4([rnd(add(bc, (dx - 6, dy - 8))), rnd(add(bc, (dx, dy - 8)))], ROCK[2] if k else WHITE)
        for p, r in (((18, -4), 1.6), ((24, 2), 1.4), ((14, 6), 1.2)):
            cv.part(ellipse(cv.blank(), add(bc, p), r, r), [ROCK[0], ROCK[1], ROCK[2], ROCK[2]], gloss=False)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((14, -10), (18, -6), (16, -14)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("troll-cave", draw, sys.argv[1:], S=S, idle_ms=340)

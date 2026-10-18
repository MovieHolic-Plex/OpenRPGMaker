#!/usr/bin/env python3
"""미궁 미노타우로스(minotaur-maze) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

황소 머리 거인(보스급): 앞으로 휘어 솟은 상아색 큰 뿔 둘, 검은 콧등에 놋쇠 코뚜레, 붉게 타는 눈,
목덜미를 덮은 짙은 갈기, 근육이 갈라진 맨 가슴과 배, 놋쇠 징 가죽 허리띠와 붉은 허리 천,
털 덮인 짐승 다리에 검은 발굽, 끝에 술이 달린 꼬리. 두 손으로 쥔 긴 자루 양날 도끼(라브리스).
6번 칸(스킬 skill_mon_maze_rampage): 도끼를 땅에 내리꽂아 균열·돌 파편이 아군 쪽으로 튀고 콧김이 뿜어진다.

  python3 scripts/content/monsters/redraw_minotaur_maze.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import (Canvas, add, burst, chain, crack, ellipse, lerp, polar, poly, puff, rnd, run, slash, sparkle,
                       speed_lines)

S = 96
GROUND = S - 4
INK = (26, 16, 14)
FUR = [(84, 46, 30), (124, 72, 44), (164, 104, 62), (200, 140, 92)]
MANE = [(44, 26, 20), (66, 40, 28), (92, 58, 38), (92, 58, 38)]
FUR_FAR = MANE
HOOF = [INK, (44, 38, 38), (70, 62, 60), (70, 62, 60)]
SNOUT = HOOF
HORN = [(160, 140, 104), (212, 196, 156), (242, 232, 200), (255, 250, 230)]
LEATHER = [(64, 40, 26), (96, 62, 38), (128, 88, 56), (128, 88, 56)]
HAFT = LEATHER
CLOTH = [(110, 26, 30), (156, 40, 40), (196, 64, 56), (196, 64, 56)]
BRASS = [(150, 104, 40), (210, 164, 70), (250, 220, 130)]
STEEL = [(84, 92, 104), (130, 140, 154), (180, 188, 200), (236, 240, 246)]
EYE, EYE_HI = (240, 50, 30), BRASS[2]
STEAM = [STEEL[2], STEEL[3]]
DUST = [LEATHER[2], FUR[3]]
CRACK = MANE[0]
WHITE = (255, 252, 236)


def leg(cv, hip, knee, foot, far):
    """굵은 털 허벅지 -> 무릎 -> 정강이 털 술 -> 검은 갈라진 발굽."""
    ramp = FUR_FAR if far else FUR
    ankle = add(foot, (0, -5))
    cv.part(chain([hip, knee], [7.5, 5.8]), ramp, gloss=False)
    cv.part(chain([knee, ankle], [5.6, 4.2]), ramp, gloss=False)
    # 발목 털 술
    cv.part(poly(cv.blank(), [add(ankle, (-5, -3)), add(ankle, (5, -3)), add(ankle, (6, 2)), add(ankle, (-5, 2))]),
            MANE if not far else [MANE[0], MANE[0], MANE[1], MANE[1]], gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 4, f[1] - 4), (f[0] + 4, f[1] - 4), (f[0] + 6, f[1]), (f[0] - 4, f[1])]), HOOF, gloss=False)
    if not far:
        cv.line([(f[0] + 2, f[1] - 3), (f[0] + 2, f[1])], INK)  # 갈라진 굽


def tail(cv, hip, P):
    sw = P.extra.get("tail", 0)
    pts = [add(hip, (-6, -2)), add(hip, (-13, 3)), add(hip, (-17, 12 - sw)), add(hip, (-18, 20 - sw * 2))]
    cv.part(chain(pts, [2.4, 2.0, 1.6, 1.4]), FUR, gloss=False)
    t = pts[-1]
    cv.part(poly(cv.blank(), [add(t, (-3, -1)), add(t, (2, -1)), add(t, (1, 6)), add(t, (-1, 4)), add(t, (-3, 6))]), MANE, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    tail(cv, hip, P)
    # 붉은 허리 천(앞뒤 두 자락)
    cv.part(poly(cv.blank(), [R(-9, -1), R(9, -1), R(10, 9), R(4, 7), R(1, 11), R(-3, 7), R(-10, 9)]), CLOTH)
    # 거대한 상체: 넓은 어깨에서 허리로 좁아지는 역삼각
    cv.part(poly(cv.blank(), [R(-9, 0), R(9, 0), R(12, -10), R(13, -20), R(8, -26), R(-4, -27), R(-12, -22), R(-12, -10)]), FUR)
    # 앞 가슴·배 근육(밝은 털)
    cv.part(poly(cv.blank(), [R(2, -1), R(9, -1), R(12, -10), R(12, -19), R(6, -22), R(2, -14)]), [FUR[1], FUR[2], FUR[3], FUR[3]], gloss=False)
    cv.line4([R(4, -18), R(11, -17)], FUR[1])        # 가슴 아래 홈
    for y in (-6, -11):
        cv.line4([R(5, y), R(10, y)], FUR[1])        # 배 근육 마디
    cv.line4([R(7, -3), R(7, -15)], FUR[1])
    # 목덜미 갈기(등 위로 솟음)
    cv.part(poly(cv.blank(), [R(-12, -22), R(-14, -27), R(-10, -26), R(-10, -31), R(-5, -28), R(-2, -32), R(2, -27), R(-4, -24)]), MANE, gloss=False)
    # 놋쇠 징 가죽 허리띠 + 어깨 끈
    cv.part(poly(cv.blank(), [R(-10, -3), R(10, -3), R(10, 1), R(-10, 1)]), LEATHER, gloss=False)
    for dx in (-6, 0, 6):
        cv.pixel(*rnd(R(dx, -1)), BRASS[2])
    cv.part(poly(cv.blank(), [R(3, -1), R(6, -1), R(6, 2), R(3, 2)]), BRASS, gloss=False)
    cv.line4([R(-9, -22), R(9, -3)], LEATHER[1])
    cv.pixel(*rnd(R(0, -12)), BRASS[1])


def labrys(cv, hand, ang, flash=False):
    """긴 자루 양날 도끼: 손 앞으로 자루, 끝에 반달 날 둘(양쪽). 날 끝 가장자리는 밝게 벼렸다."""
    top = polar(hand, ang, 16)
    butt = polar(hand, ang + 180, 10)
    cv.part(chain([butt, top], [2.0, 2.0]), HAFT, gloss=False)
    cv.part(ellipse(cv.blank(), butt, 1.6, 1.6), BRASS + [BRASS[2]], gloss=False)
    c = polar(top, ang + 180, 3)
    edges = []
    for side in (ang + 90, ang - 90):
        e = polar(c, side, 10)
        pts = [polar(c, ang, 2), polar(polar(c, ang, 3), side, 4), polar(polar(c, ang, 7.5), side, 9), e,
               polar(polar(c, ang + 180, 7.5), side, 9), polar(polar(c, ang + 180, 3), side, 4), polar(c, ang + 180, 2)]
        cv.part(poly(cv.blank(), pts), STEEL)
        cv.line4([rnd(polar(polar(c, ang, 6.5), side, 8.6)), rnd(e), rnd(polar(polar(c, ang + 180, 6.5), side, 8.6))], STEEL[3])
        edges.append(e)
    cv.part(ellipse(cv.blank(), c, 2.4, 2.4), BRASS + [BRASS[2]], gloss=False)
    cv.part(chain([top, polar(top, ang, 3)], [1.6, 1.0]), STEEL, gloss=False)  # 꼭대기 창끝
    if flash:
        sparkle(cv, edges[0], WHITE, STEEL[2], big=True)
    return edges[0], top


def arm(cv, sh, el, hand, far, P):
    ramp = FUR_FAR if far else FUR
    cv.part(chain([sh, el], [5.6, 4.8]), ramp, gloss=False)
    cv.part(chain([el, hand], [4.8, 4.2]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 3.4, 3.4), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), add(sh, (-1, 1)), 4.6, 4.2), ramp)  # 둥근 어깨 근육
    # 손목 가죽 띠
    w = lerp(el, hand, 0.7)
    cv.part(ellipse(cv.blank(), w, 3.0, 3.0), LEATHER, gloss=False)
    if not far:
        cv.pixel(*rnd(w), BRASS[1])
        P.extra["_edge"], P.extra["_top"] = labrys(cv, hand, P.extra.get("axe", -70), P.extra.get("flash", False))


def head(cv, c, tilt, P):
    c = add(c, (6, -2))  # 황소 머리는 어깨보다 앞으로 내밀었다
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 먼 뿔(머리 뒤)
    cv.part(chain([R(-2, -6), R(-7, -12), R(-6, -18), R(-2, -21)], [2.8, 2.4, 1.8, 1.0]), [HORN[0], HORN[0], HORN[1], HORN[1]], gloss=False)
    # 머리: 넓은 이마 + 앞으로 길게 나온 주둥이
    cv.part(poly(cv.blank(), [R(-7, -6), R(-1, -9), R(5, -7), R(9, -3), R(14, 0), R(14, 5), R(9, 7 + jaw * 0.4), R(0, 7), R(-6, 3)]), FUR)
    # 아래턱
    cv.part(poly(cv.blank(), [R(1, 5), R(12, 5 + jaw * 0.6), R(11, 8 + jaw), R(2, 9 + jaw * 0.4)]), FUR, gloss=False)
    if jaw:
        cv.put(poly(cv.blank(), [R(5, 5), R(12, 5 + jaw * 0.3), R(11, 5 + jaw), R(5, 6 + jaw * 0.5)]), CLOTH[0])
    # 검은 콧등 + 콧구멍 + 놋쇠 코뚜레
    cv.part(poly(cv.blank(), [R(9, -2), R(14, 0), R(15, 5), R(10, 6), R(8, 2)]), SNOUT, gloss=False)
    cv.pixel(*rnd(R(13, 2)), INK)
    cv.pixel(*rnd(R(11, 3)), INK)
    # 코뚜레: 콧등 아래 가장자리에 걸린 U 자 고리(4방향으로 이어지게)
    rc = rnd(R(12, 6))
    for d in ((-1, 0), (-1, 1), (0, 2), (1, 1), (1, 0)):
        cv.pixel(rc[0] + d[0], rc[1] + d[1], BRASS[1])
    cv.pixel(rc[0], rc[1] + 2, BRASS[2])
    # 귀(옆으로)
    cv.part(poly(cv.blank(), [R(-4, -4), R(-11, -3), R(-12, 0), R(-5, 0)]), FUR, gloss=False)
    cv.pixel(*rnd(R(-9, -1)), CLOTH[1])
    # 가까운 뿔: 머리 옆에서 바깥으로 뻗었다가 앞·위로 휘어 끝이 뾰족
    hp = [R(1, -7), R(-3, -14), R(1, -21), R(7, -24), R(10, -23)]
    cv.part(chain(hp, [3.4, 3.0, 2.4, 1.6, 0.8]), HORN)
    cv.line4([rnd(hp[1]), rnd(hp[2])], HORN[0])  # 뿔 마디
    # 성난 눈 + 이마 털
    e = R(4, -3)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (2, 1)))], INK)
    else:
        cv.line([rnd(add(e, (-2, -2))), rnd(add(e, (3, -1)))], INK)
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
    cv.part(poly(cv.blank(), [R(-4, -8), R(3, -9), R(1, -6), R(-2, -5)]), MANE, gloss=False)
    return dict(eye=e, nose=R(15, 3), horn=hp[-1])


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=11.0, lower=10.0, thigh=12.0, shin=12.0, hip_w=8.0,
            shoulder_w=14.0, ground=GROUND)


def pose(name):
    b = dict(hip=(40, 66), torso=23.0, neck=1.0, foot_near=(50, 0), foot_far=(31, 0))
    if name == "idle_a":  # 도끼를 두 손으로 비스듬히 앞에 쥔다
        return Pose(**b, lean=8, arm_near=(60, -10), arm_far=(70, -5), head_tilt=6, extra=dict(axe=-60))
    if name == "idle_b":  # 어깨를 들썩이며 콧김, 꼬리를 친다
        return Pose(**dict(b, hip=(40, 67)), lean=12, arm_near=(66, -4), arm_far=(76, 0), head_tilt=12,
                    extra=dict(axe=-52, jaw=1, tail=3, snort=True))
    if name == "idle_c":  # 도끼를 고쳐 쥐며 머리를 쳐든다
        return Pose(**dict(b, foot_near=(51, 0)), lean=6, arm_near=(54, -18), arm_far=(64, -12), head_tilt=0,
                    extra=dict(axe=-70, tail=-2))
    if name == "windup":  # 도끼를 머리 뒤로 크게 젖힌다
        return Pose(**dict(b, hip=(37, 67), foot_near=(48, 0), foot_far=(26, 0)), lean=-8,
                    arm_near=(-70, -110), arm_far=(-60, -100), head_tilt=-6, extra=dict(axe=-150, jaw=3, flash=True, tail=4))
    if name == "move":  # 뿔을 앞세워 땅을 박차고 돌진
        return Pose(**dict(b, hip=(46, 66), foot_near=(62, 2), foot_far=(28, 0)), lean=28,
                    arm_near=(100, 50), arm_far=(110, 60), head_tilt=26, extra=dict(axe=170, jaw=2, tail=6, snort=True))
    if name == "attack":  # 도끼를 앞으로 크게 내리친다
        return Pose(**dict(b, hip=(40, 67), foot_near=(56, 0), foot_far=(24, 0)), lean=22,
                    arm_near=(10, 20), arm_far=(20, 30), head_tilt=14, extra=dict(axe=10, jaw=3, tail=2))
    if name == "recover":  # 스킬 미궁의 광란: 도끼를 땅에 내리꽂는다
        return Pose(**dict(b, hip=(38, 70), foot_near=(56, 0), foot_far=(22, 0)), lean=34,
                    arm_near=(50, 80), arm_far=(60, 90), head_tilt=20, extra=dict(axe=80, jaw=4, tail=5, snort=True))
    if name == "hit":  # 맞아서 뒤로 휘청, 머리가 젖혀진다
        return Pose(**dict(b, hip=(37, 67), foot_near=(47, 0), foot_far=(28, 1)), lean=-18,
                    arm_near=(130, 160), arm_far=(140, 170), head_tilt=-24, extra=dict(axe=-120, eye="shut", jaw=3, tail=-3))
    raise KeyError(name)


def draw_dead(cv):
    """옆으로 쓰러진 거구: 뿔이 땅에 박히고 도끼가 앞에 떨어져 있다."""
    g = GROUND
    cv.part(chain([(8, g - 2), (14, g - 4), (20, g - 4)], [1.6, 2.0, 2.4]), FUR, gloss=False)
    cv.part(poly(cv.blank(), [(6, g - 3), (10, g - 3), (9, g), (5, g)]), MANE, gloss=False)
    cv.part(chain([(22, g - 4), (30, g - 3)], [6.0, 5.0]), FUR_FAR, gloss=False)  # 다리
    cv.part(poly(cv.blank(), [(14, g), (14, g - 4), (20, g - 4), (20, g)]), HOOF, gloss=False)
    cv.part(poly(cv.blank(), [(24, g), (28, g - 10), (50, g - 13), (60, g - 9), (62, g)]), FUR)
    cv.part(poly(cv.blank(), [(30, g), (32, g - 6), (56, g - 7), (58, g)]), [FUR[1], FUR[2], FUR[3], FUR[3]], gloss=False)
    cv.part(poly(cv.blank(), [(26, g - 4), (32, g - 4), (34, g), (26, g)]), CLOTH, gloss=False)
    cv.part(poly(cv.blank(), [(46, g - 12), (54, g - 17), (58, g - 13), (52, g - 9)]), MANE, gloss=False)
    # 머리(옆으로 누움)
    cv.part(poly(cv.blank(), [(58, g), (60, g - 10), (68, g - 12), (76, g - 7), (78, g), ]), FUR)
    cv.part(poly(cv.blank(), [(73, g - 6), (79, g - 4), (79, g), (72, g)]), SNOUT, gloss=False)
    cv.part(chain([(64, g - 11), (66, g - 18), (71, g - 21)], [2.8, 2.0, 1.0]), HORN)
    cv.line([(66, g - 7), (68, g - 5)], INK)
    cv.line([(68, g - 7), (66, g - 5)], INK)
    # 떨어진 양날 도끼
    cv.part(chain([(64, g - 1), (88, g - 1)], [1.8, 1.8]), HAFT, gloss=False)
    cv.part(poly(cv.blank(), [(84, g - 12), (90, g - 6), (90, g - 1), (84, g - 3)]), STEEL)
    puff(cv, (44, g - 4), 3.0, DUST)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 14, (40, 50, 60, 70), FUR[2])
    J = draw_body(cv, LOOK, P)
    edge = P.extra["_edge"]
    if P.extra.get("snort"):
        n = J["nose"]
        puff(cv, add(n, (4, 2)), 2.2, STEAM)
    if name == "windup":
        sparkle(cv, add(J["horn"], (2, -2)), WHITE, HORN[2])
    elif name == "move":
        puff(cv, (22, GROUND - 3), 3.6, DUST)
        puff(cv, (12, GROUND - 4), 2.6, DUST)
    elif name == "attack":
        slash(cv, add(edge, (-10, -16)), add(edge, (4, 6)), 4, 3.4, STEEL[2], WHITE)
        burst(cv, add(edge, (2, 0)), 6.0, STEEL[3], WHITE, spikes=7)
    elif name == "recover":
        hit = (int(edge[0]), GROUND - 1)
        burst(cv, (hit[0], hit[1] - 4), 7.0, DUST[1], WHITE, spikes=8)
        crack(cv, hit, [(hit[0] + 7, hit[1] - 1), (hit[0] + 13, hit[1]), (hit[0] + 20, hit[1] - 1)], CRACK)
        crack(cv, (hit[0] + 3, hit[1]), [(hit[0] + 9, hit[1] + 1), (hit[0] + 16, hit[1] + 1)], CRACK)
        for p, r in (((10, -16), 2.4), ((18, -10), 2.0), ((6, -24), 1.8), ((24, -20), 1.6), ((-6, -14), 1.8)):
            cv.part(ellipse(cv.blank(), add(hit, p), r, r), [DUST[0], DUST[0], DUST[1], DUST[1]], gloss=False)
        puff(cv, (hit[0] - 8, GROUND - 3), 3.4, DUST)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((14, -12), (18, -8), (16, -16)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("minotaur-maze", draw, sys.argv[1:], S=S, idle_ms=320)

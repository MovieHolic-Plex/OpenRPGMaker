#!/usr/bin/env python3
"""마왕(demon-lord) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다(최종 보스).

자줏빛 피부의 거구 악마: 이마에서 뒤로 휘어 솟은 검은 큰 뿔 둘, 붉게 타는 눈과 송곳니, 흰 갈기 머리,
가시 돋은 검은 판금 어깨 갑옷과 가슴판 한가운데 붉은 마정석, 금 테 허리띠, 바닥까지 끌리는 진홍 안감 망토,
등에서 펼친 붉은 박쥐 날개 둘, 오른손에 낫처럼 휜 검은 대검. 왼손에 보라 암흑 불꽃이 늘 일렁인다.
6번 칸(스킬 skill_mon_dark_flame·암흑의 심판): 두 팔을 앞으로 내밀어 보라 암흑 불꽃 덩이를 아군 쪽으로 쏟아낸다.

  python3 scripts/content/monsters/redraw_demon_lord.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import (Canvas, add, burst, chain, ellipse, flame, glow, lerp, polar, poly, rnd, run, slash, sparkle,
                       speed_lines)

S = 96
GROUND = S - 4
INK = (22, 12, 26)
WHITE = (255, 250, 255)
SKIN = [(96, 52, 104), (136, 80, 140), (174, 112, 172), (206, 150, 200)]
SKIN_FAR = [SKIN[0], SKIN[0], SKIN[1], SKIN[1]]
ARMOR = [(34, 30, 48), (56, 52, 76), (88, 84, 116), (140, 136, 170)]
ARMOR_FAR = [INK, ARMOR[0], ARMOR[1], ARMOR[1]]
GOLD = [(150, 104, 36), (212, 164, 64), (250, 220, 120), (255, 244, 190)]
CAPE = [(70, 14, 26), (110, 22, 36), (150, 34, 46), (150, 34, 46)]
CAPE_IN = [(40, 8, 18), (56, 12, 24), CAPE[0], CAPE[0]]
MEMB = [CAPE[1], CAPE[2], (196, 66, 64), (196, 66, 64)]
MEMB_FAR = [CAPE_IN[1], CAPE[0], CAPE[1], CAPE[1]]
HORN = [(44, 34, 52), (84, 70, 96), (132, 118, 146), (190, 180, 204)]
HAIR = [ARMOR[3], (206, 204, 220), WHITE, WHITE]
BLADE = [ARMOR[0], ARMOR[1], ARMOR[3], WHITE]
GEM = [CAPE[1], (230, 40, 46), GOLD[3]]
EYE, EYE_HI = GEM[1], GOLD[3]
DARK = [(54, 18, 86), (110, 40, 170), (176, 96, 236), (238, 210, 255)]


def wing(cv, sh, ang, span, far=False):
    k = 0.84 if far else 1.0
    wrist = polar(sh, ang, span * 0.4 * k)
    tips = [polar(wrist, ang + d, span * ln * k) for d, ln in ((-55, 0.6), (-15, 0.8), (25, 0.7), (66, 0.5))]
    root = polar(sh, ang + 140, span * 0.2)
    pts = [sh, wrist, tips[0]]
    seq = tips + [root]
    for a, b in zip(seq, seq[1:]):
        pts.append(lerp(lerp(a, b, 0.5), wrist, 0.25))
        pts.append(b)
    cv.part(poly(cv.blank(), pts), MEMB_FAR if far else MEMB, gloss=False)
    bone = HORN[1] if far else HORN[2]
    for f in tips:
        cv.line4([rnd(wrist), rnd(f)], bone)
    cv.part(chain([sh, wrist], [3.6, 2.6]), HORN, gloss=False)
    cv.line4([rnd(wrist), rnd(polar(wrist, ang - 100, 3.5))], HORN[3] if not far else HORN[1])


def cape(cv, hip, chest, P):
    """어깨에서 바닥까지 끌리는 망토: 뒤로 나부끼는 정도 sway."""
    sw = P.extra.get("cape", 0)
    a, b = add(chest, (-9, 0)), add(chest, (6, -1))
    pts = [a, b, add(hip, (2, 10)), (hip[0] - 4, GROUND - 1), (hip[0] - 14 - sw, GROUND - 1),
           (hip[0] - 22 - sw * 1.5, GROUND - 6 - sw * 0.4), add(hip, (-18 - sw, -4))]
    cv.part(poly(cv.blank(), pts), CAPE, gloss=False)
    for dx in (-8, -14):  # 망토 주름
        cv.line4([rnd(add(hip, (dx + 4, -2))), (hip[0] + dx - sw * 0.6, GROUND - 2)], CAPE[0])
    cv.part(poly(cv.blank(), [(hip[0] - 4, GROUND - 1), (hip[0] - 14 - sw, GROUND - 1), add(hip, (-8, 20))]), CAPE_IN,
            gloss=False)


def leg(cv, hip, knee, foot, far):
    ramp = ARMOR_FAR if far else ARMOR
    cv.part(chain([hip, knee], [8.0, 6.4]), SKIN_FAR if far else SKIN, gloss=False)
    cv.part(chain([knee, add(foot, (0, -4))], [6.6, 5.6]), ramp, gloss=False)  # 정강이 갑옷
    cv.part(ellipse(cv.blank(), knee, 4.0, 3.6), ramp)  # 무릎 판
    if not far:
        cv.line4([rnd(add(knee, (3, -3))), rnd(add(knee, (6, -6)))], ARMOR[3])  # 무릎 가시
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 4, f[1] - 5), (f[0] + 4, f[1] - 5), (f[0] + 9, f[1] - 1), (f[0] + 9, f[1]),
                              (f[0] - 4, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    cape(cv, hip, chest, P)
    # 앞치마 갑옷 자락
    cv.part(poly(cv.blank(), [R(-9, -1), R(9, -1), R(10, 9), R(4, 12), R(0, 8), R(-5, 12), R(-10, 8)]), ARMOR)
    # 상체: 넓은 가슴판(위로 넓어지는 역삼각)
    cv.part(poly(cv.blank(), [R(-9, 0), R(9, 0), R(13, -12), R(13, -22), R(6, -27), R(-6, -27), R(-12, -22), R(-12, -10)]), ARMOR)
    # 가슴판 홈·가장자리 금 테
    cv.line4([R(0, -4), R(1, -24)], ARMOR[0])
    cv.line4([R(-10, -14), R(12, -14)], GOLD[1])
    # 마정석
    gc = R(1, -18)
    cv.part(poly(cv.blank(), [add(gc, (0, -4)), add(gc, (3, 0)), add(gc, (0, 4)), add(gc, (-3, 0))]), [GEM[0], GEM[1], GEM[2], GEM[2]],
            ink=GOLD[0], gloss=False)
    cv.pixel(*rnd(add(gc, (-1, -1))), WHITE)
    # 금 허리띠 + 해골 버클
    cv.part(poly(cv.blank(), [R(-10, -4), R(10, -4), R(10, 0), R(-10, 0)]), GOLD, gloss=False)
    bc = R(1, -2)
    cv.part(ellipse(cv.blank(), bc, 2.6, 2.2), [HAIR[0], HAIR[1], HAIR[2], HAIR[2]], gloss=False)
    cv.pixel(*rnd(add(bc, (-1, 0))), INK)
    cv.pixel(*rnd(add(bc, (1, 0))), INK)


def head(cv, c, tilt, P):
    c = add(c, (3, -1))
    a = math.radians(tilt)
    k = 1.3  # 거구 보스: 어깨 갑옷 위로 또렷이 보이게 머리를 키운다
    R = lambda dx, dy: (c[0] + k * (dx * math.cos(a) - dy * math.sin(a)), c[1] + k * (dx * math.sin(a) + dy * math.cos(a)))
    jaw = P.extra.get("jaw", 0)
    # 먼 뿔
    cv.part(chain([R(-1, -6), R(-7, -12), R(-9, -19), R(-6, -25)], [3.4, 2.8, 2.0, 1.0]), [HORN[0], HORN[0], HORN[1], HORN[1]],
            gloss=False)
    # 흰 갈기(뒤로 흘러내림)
    cv.part(poly(cv.blank(), [R(-7, -6), R(1, -9), R(-2, -6), R(-10, 2), R(-14, 10), R(-9, 9), R(-6, 4)]), HAIR, gloss=False)
    # 얼굴: 각진 이마·광대·뾰족한 턱
    cv.part(poly(cv.blank(), [R(-6, -6), R(2, -8), R(7, -6), R(9, -2), R(8, 2), R(6, 6 + jaw * 0.5), R(1, 8 + jaw * 0.5),
                              R(-4, 5), R(-6, 0)]), SKIN)
    if jaw:
        cv.put(poly(cv.blank(), [R(3, 3), R(8, 2), R(6, 4 + jaw * 0.6), R(3, 5 + jaw * 0.4)]), CAPE_IN[1])
        cv.pixel(*rnd(R(7, 3)), WHITE)
        cv.pixel(*rnd(R(4, 4 + jaw * 0.4)), WHITE)
    else:
        cv.line4([rnd(R(3, 4)), rnd(R(7, 3))], INK)
        cv.pixel(*rnd(R(6, 4)), WHITE)  # 송곳니
    # 뾰족 귀
    cv.part(poly(cv.blank(), [R(-3, -2), R(-10, -6), R(-4, 1)]), SKIN, gloss=False)
    # 성난 눈 + 짙은 눈썹
    e = R(4, -2)
    if P.extra.get("eye") == "shut":
        cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (2, 1)))], INK)
    else:
        cv.line([rnd(R(1, -5)), rnd(R(7, -3))], INK)
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
    # 금 이마 관
    cv.line4([rnd(R(-5, -6)), rnd(R(6, -7))], GOLD[2])
    cv.pixel(*rnd(R(1, -8)), GEM[1])
    # 가까운 큰 뿔: 앞으로 솟았다 뒤로 크게 휜다
    hp = [R(1, -7), R(-1, -15), R(-6, -22), R(-13, -25), R(-17, -23)]
    cv.part(chain(hp, [4.2, 3.6, 2.8, 1.8, 0.8]), HORN)
    for i in (1, 2):
        cv.line4([rnd(hp[i]), rnd(add(hp[i], (2, 1)))], HORN[0])
    return dict(eye=e, mouth=R(8, 3), horn=hp[2])


def blade(cv, hand, ang, flash=False):
    """낫처럼 휜 검은 대검: 손잡이 → 금 날밑 → 넓어졌다가 끝이 갈고리로 휘는 날."""
    butt = polar(hand, ang + 180, 5)
    cv.part(chain([butt, polar(hand, ang, 3)], [2.0, 2.0]), CAPE_IN, gloss=False)
    g = polar(hand, ang, 3)
    cv.part(chain([polar(g, ang - 90, 4), polar(g, ang + 90, 4)], [2.2, 2.2]), GOLD, gloss=False)
    pts = [polar(g, ang - 90, 2)]
    spine = [polar(g, ang, 4 + 4 * i) for i in range(6)]
    for i, p in enumerate(spine):
        pts.append(polar(p, ang - 90, 2.6 + i * 0.5))
    tip = polar(polar(spine[-1], ang, 4), ang + 60, 6)
    pts.append(polar(spine[-1], ang, 4))
    pts.append(tip)
    for i, p in reversed(list(enumerate(spine))):
        pts.append(polar(p, ang + 90, 1.8 + (i > 3) * 2.4))
    pts.append(polar(g, ang + 90, 2))
    cv.part(poly(cv.blank(), pts), BLADE)
    cv.line4([rnd(polar(spine[1], ang - 90, 2)), rnd(polar(spine[-1], ang - 90, 4.5))], BLADE[3])  # 날 끝 하이라이트
    cv.line4([rnd(spine[1]), rnd(spine[-2])], DARK[1])  # 가운데 홈의 보라 빛
    if flash:
        sparkle(cv, polar(spine[-1], ang - 90, 4.5), WHITE, BLADE[2], big=True)
    return polar(spine[-1], ang - 90, 4), tip


def arm(cv, sh, el, hand, far, P):
    ramp = SKIN_FAR if far else SKIN
    cv.part(chain([sh, el], [6.0, 5.2]), ramp, gloss=False)
    cv.part(chain([el, hand], [5.6, 5.0]), ARMOR_FAR if far else ARMOR, gloss=False)  # 건틀릿
    cv.part(ellipse(cv.blank(), hand, 3.2, 3.2), ARMOR_FAR if far else ARMOR, gloss=False)
    # 가시 어깨 갑옷
    pa = ARMOR_FAR if far else ARMOR
    cv.part(poly(cv.blank(), [add(sh, (-7, 1)), add(sh, (-5, -5)), add(sh, (1, -7)), add(sh, (7, -4)), add(sh, (7, 2)),
                              add(sh, (0, 5))]), pa)
    for d in (() if far else ((-3, -6), (3, -7))):
        b = add(sh, d)
        cv.part(poly(cv.blank(), [add(b, (-2, 1)), add(b, (d[0] * 0.4, -6)), add(b, (2, 1))]), HORN, gloss=False)
    if not far:
        cv.line4([rnd(add(sh, (-5, 2))), rnd(add(sh, (5, 2)))], GOLD[1])
        if P.extra.get("sword", True):
            P.extra["_edge"], P.extra["_tip"] = blade(cv, hand, P.extra.get("swd", -70), P.extra.get("flash", False))
    else:
        P.extra["_far_hand"] = hand


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=11.0, lower=10.0, thigh=12.0, shin=12.0, hip_w=8.0,
            shoulder_w=16.0, ground=GROUND)


def pose(name):
    b = dict(hip=(38, 66), torso=23.0, neck=6.0, foot_near=(47, 0), foot_far=(30, 0))
    if name == "idle_a":  # 대검을 늘어뜨리고 왼손에 암흑 불꽃
        return Pose(**b, lean=2, arm_near=(70, 20), arm_far=(40, -20), extra=dict(swd=-40, cape=0, wing=-120, orb=0))
    if name == "idle_b":  # 날개를 펴며 숨을 들이켠다
        return Pose(**dict(b, hip=(38, 65)), lean=0, arm_near=(72, 16), arm_far=(36, -26), head_tilt=-4,
                    extra=dict(swd=-36, cape=3, wing=-140, orb=1))
    if name == "idle_c":  # 날개를 접고 고개를 숙이며 웃는다
        return Pose(**dict(b, hip=(38, 67)), lean=4, arm_near=(68, 24), arm_far=(44, -14), head_tilt=6,
                    extra=dict(swd=-46, cape=-1, wing=-104, orb=2, jaw=2))
    if name == "windup":  # 대검을 머리 위로 치켜든다
        return Pose(**dict(b, foot_near=(50, 0), foot_far=(26, 0)), lean=-8, arm_near=(-80, -120), arm_far=(-40, -70),
                    head_tilt=-8, extra=dict(swd=-150, cape=5, wing=-96, flash=True, jaw=3))
    if name == "move":  # 망토를 휘날리며 미끄러지듯 다가선다
        return Pose(**dict(b, hip=(44, 66), foot_near=(56, 2), foot_far=(30, 0)), lean=18, arm_near=(140, 160),
                    arm_far=(60, 20), head_tilt=10, extra=dict(swd=170, cape=9, wing=-160))
    if name == "attack":  # 대검을 앞으로 크게 내리 벤다
        return Pose(**dict(b, hip=(40, 67), foot_near=(56, 0), foot_far=(24, 0)), lean=18, arm_near=(10, 30),
                    arm_far=(70, 40), head_tilt=12, extra=dict(swd=60, cape=6, wing=-130, jaw=4))
    if name == "recover":  # 스킬 암흑 불꽃: 두 손을 앞으로 내밀어 쏟아낸다
        return Pose(**dict(b, foot_near=(52, 0), foot_far=(26, 0)), lean=10, arm_near=(-10, -10), arm_far=(-4, -4),
                    head_tilt=4, extra=dict(swd=-150, cape=7, wing=-92, jaw=4, sword=False))
    if name == "hit":  # 맞아서 뒤로 젖혀진다
        return Pose(**dict(b, hip=(35, 67), foot_near=(45, 0), foot_far=(28, 1)), lean=-18, arm_near=(130, 150),
                    arm_far=(150, 170), head_tilt=-22, extra=dict(swd=-110, cape=-3, wing=-150, eye="shut", jaw=3))
    raise KeyError(name)


def draw_dead(cv):
    """무릎을 꿇은 채 엎어진 마왕: 뿔이 땅에 닿고 날개·망토가 늘어지며 대검이 꽂혀 있다."""
    g = GROUND
    blade(cv, (74, g - 22), 90)
    cv.part(poly(cv.blank(), [(8, g), (12, g - 10), (30, g - 16), (46, g - 14), (50, g)]), CAPE, gloss=False)
    wing(cv, (30, g - 14), -170, 30.0, far=True)
    cv.part(poly(cv.blank(), [(26, g), (30, g - 12), (48, g - 14), (58, g - 8), (60, g)]), ARMOR)
    cv.part(chain([(22, g - 3), (34, g - 3)], [6.0, 5.0]), SKIN, gloss=False)
    cv.part(poly(cv.blank(), [(14, g), (14, g - 5), (22, g - 4), (22, g)]), ARMOR, gloss=False)
    cv.part(ellipse(cv.blank(), (50, g - 13), 6, 4), ARMOR)  # 어깨
    # 머리(땅에 엎드림) + 뿔
    cv.part(poly(cv.blank(), [(56, g), (58, g - 9), (66, g - 10), (70, g - 4), (68, g)]), SKIN)
    cv.part(poly(cv.blank(), [(54, g - 6), (58, g - 9), (52, g - 2)]), HAIR, gloss=False)
    cv.part(chain([(62, g - 9), (60, g - 16), (54, g - 19)], [3.6, 2.4, 1.0]), HORN)
    cv.line([(64, g - 6), (66, g - 4)], INK)
    cv.line([(66, g - 6), (64, g - 4)], INK)
    cv.part(chain([(60, g - 2), (70, g - 1)], [4.0, 3.4]), ARMOR, gloss=False)  # 뻗은 팔
    for p, r in (((80, g - 4), 1.6), ((86, g - 8), 1.2), ((40, g - 22), 1.4)):
        glow(cv, p, r, [DARK[0], DARK[1]])


def dark_flame(cv, c, h, seed=0):
    flame(cv, add(c, (0, 2)), h, h * 0.7, DARK, lean=0.4, tongues=3, seed=seed)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 14, (36, 48, 60, 70), CAPE[2])
    probe = Canvas(S, INK)
    J0 = draw_body(probe, LOOK, Pose(**{**P.__dict__, "extra": dict(P.extra)}))
    wing(cv, add(J0["chest"], (-2, 0)), P.extra["wing"] + 14, 36.0, far=True)
    wing(cv, add(J0["chest"], (-6, 2)), P.extra["wing"], 40.0)
    J = draw_body(cv, LOOK, P)
    if name != "windup":  # 가까운 어깨 갑옷이 얼굴을 가리지 않게 머리를 맨 위에 다시 얹는다
        J.update(head(cv, J["head"], P.head_tilt, P))
    fh = P.extra.get("_far_hand")
    if name in ("idle_a", "idle_b", "idle_c"):
        dark_flame(cv, add(fh, (1, -4)), 7 + P.extra["orb"], seed=P.extra["orb"])
    elif name == "windup":
        sparkle(cv, add(J["horn"], (0, -3)), WHITE, DARK[2])
        glow(cv, add(J["chest"], (8, -6)), 3.4, [DARK[1], DARK[2], DARK[3]])
    elif name == "attack":
        e = P.extra["_edge"]
        slash(cv, add(e, (-8, -24)), add(e, (8, 8)), 6, 4.0, DARK[2], WHITE)
        burst(cv, add(e, (4, 2)), 6.0, BLADE[3], WHITE, spikes=7)
    elif name == "recover":
        hands = lerp(J["hand_n"], fh, 0.5)
        glow(cv, add(hands, (6, 0)), 7.0, DARK)
        for k, (dx, dy, r) in enumerate(((18, -4, 6.0), (30, 4, 7.0), (42, -6, 5.0))):
            p = add(hands, (dx, dy))
            if p[0] + r < S - 1:
                glow(cv, p, r, DARK)
                dark_flame(cv, add(p, (0, -r + 2)), r * 1.6, seed=k)
        for p in ((-4, -14), (20, -18), (36, 14)):
            sparkle(cv, add(hands, p), WHITE, DARK[2])
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((12, -10), (16, -6), (14, -14)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
        burst(cv, add(J["chest"], (12, -2)), 5.0, WHITE, GEM[2], spikes=6)
    return cv.image()


if __name__ == "__main__":
    run("demon-lord", draw, sys.argv[1:], S=S, idle_ms=280)

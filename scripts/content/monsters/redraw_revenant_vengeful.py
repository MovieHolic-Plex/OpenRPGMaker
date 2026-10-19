#!/usr/bin/env python3
"""복수자(revenant-vengeful) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

검은 강철 갑주의 망자 기사: 앞으로 굽은 두 뿔이 달린 투구(눈 틈에 붉은 불빛 하나), 칼자국 난 흉갑과 넓은 어깨받이,
등 뒤로 찢겨 흩날리는 붉은 망토, 두 손으로 쥔 붉은 긴 칼(칼날에 핏빛 홈). 타락 기사(knight-fallen)와 달리
방패 없이 대검을 두 손으로 들고, 망토가 넝마처럼 찢겼다.
6번 칸(스킬 복수의 낙인): 대검을 땅에 꽂아 붉은 원한 불길이 앞쪽 땅을 따라 갈라져 솟는다.

  python3 scripts/content/monsters/redraw_revenant_vengeful.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, flame, lerp, polar, poly, rnd, run, slash, sparkle

INK = (10, 8, 12)
ARMOR = [(34, 34, 44), (58, 58, 72), (92, 92 , 110), (150, 150, 170)]
ARMOR_FAR = [(24, 24, 32), (34, 34, 44), (46, 46, 58), (46, 46, 58)]
CAPE = [(90, 14, 20), (140, 24, 30), (180, 44, 44), (210, 70, 64)]
BLADE = [(120, 20, 26), (186, 40, 44), (236, 90, 80), (255, 190, 170)]
HORN = [(70, 60, 54), (120, 108, 96), (170, 158, 140), (200, 190, 170)]
EYE, EYE_HI = (255, 50, 30), (255, 200, 150)
FIRE = [(150, 20, 20), (230, 60, 30), (255, 160, 70), (255, 240, 200)]
WHITE = (255, 248, 240)


def leg(cv, hip, knee, foot, far):
    ramp = ARMOR_FAR if far else ARMOR
    cv.part(chain([hip, knee], [4.6, 3.8]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 2.2, 2.0), ramp, ink=INK)
    cv.part(chain([knee, add(foot, (0, -2))], [3.8, 3.4]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 3, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 등 뒤 찢긴 망토(몸보다 먼저)
    drag = P.extra.get("drag", 0)
    top = add(chest, (-3, -2))
    hem = add(hip, (-8 - drag, 14))
    pts = [add(top, (-2, 0)), add(top, (3, 0)), add(hip, (-2, 4)), add(hem, (8, 0)), add(hem, (5, -3)), add(hem, (3, 1)),
           add(hem, (0, -4)), add(hem, (-2, 0)), add(hem, (-3, -6)), add(lerp(top, hem, 0.5), (-5 - drag * 0.5, 0))]
    cv.part(poly(cv.blank(), pts), CAPE, ink=INK)
    # 흉갑 + 칼자국
    body = [add(hip, (-4, 1)), add(hip, (5, 1)), add(chest, (6, 2)), add(chest, (5, -3)), add(chest, (-4, -3)), add(chest, (-6, 1))]
    cv.part(poly(cv.blank(), body), ARMOR, ink=INK)
    mid = lerp(hip, chest, 0.55)
    cv.line([add(mid, (-1, -3)), add(mid, (4, 2))], ARMOR[3])
    cv.line([add(mid, (0, -3)), add(mid, (5, 2))], INK)
    # 허리 판갑 띠
    cv.part(poly(cv.blank(), [add(hip, (-5, -1)), add(hip, (5, -1)), add(hip, (5, 3)), add(hip, (-5, 3))]), ARMOR, ink=INK, gloss=False)
    # 어깨받이
    cv.part(ellipse(cv.blank(), add(chest, (1, 0)), 4.2, 3.2), ARMOR, ink=INK)


def sword(cv, hand, ang):
    tip = polar(hand, ang, 19)
    pommel = polar(hand, ang + 180, 5)
    guard = polar(hand, ang, 2)
    cv.part(chain([pommel, guard], [2, 2]), ARMOR, ink=INK, gloss=False)
    g1, g2 = polar(guard, ang + 90, 3.5), polar(guard, ang - 90, 3.5)
    cv.part(chain([g1, g2], [2, 2]), HORN, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [polar(guard, ang + 90, 1.8), polar(tip, ang + 180, 3), tip, polar(guard, ang - 90, 1.8)]), BLADE, ink=INK, gloss=False)
    cv.line4([rnd(polar(guard, ang, 2)), rnd(polar(guard, ang, 13))], BLADE[0])
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = ARMOR_FAR if far else ARMOR
    cv.part(chain([sh, el], [3.6, 3.2]), ramp, ink=INK, gloss=False)
    cv.part(chain([el, hand], [3.2, 3.0]), ramp, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.0, 2.0), ramp, ink=INK, gloss=False)
    if far:
        P.extra["tip"] = sword(cv, hand, P.extra.get("sword", -60))


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뿔 둘: 투구 옆에서 뒤로 났다가 앞으로 굽는다
    for k, ramp in ((-1, [HORN[0]] * 2 + [HORN[1]] * 2), (1, HORN)):
        b = R(-1 + k, -4)
        pts = [b, R(-5 + k, -8), R(-3 + k, -12), R(2 + k, -12)]
        cv.part(chain(pts, [2.6, 2.2, 1.6, 1.0]), ramp, ink=INK, gloss=False)
    helm = [R(-5, 3), R(-5, -3), R(-2, -6), R(3, -6), R(6, -3), R(7, 1), R(6, 4), R(0, 5)]
    cv.part(poly(cv.blank(), helm), ARMOR, ink=INK)
    # 눈 틈(가로) + 붉은 불빛
    cv.line([rnd(R(1, -1)), rnd(R(6, -1))], INK, width=1)
    if P.extra.get("eye") != "shut":
        e = rnd(R(4, -1))
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE_HI)
    # 숨구멍
    for dx in (3, 5):
        cv.pixel(*rnd(R(dx, 2)), INK)
    return dict(eye=R(4, -1))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=8.5, shin=9.0, shoulder_w=4, hip_w=4)


def pose(name):
    if name == "idle_a":  # 칼끝을 앞 아래로 비스듬히 겨눈다
        return Pose(hip=(27, 41), lean=6, arm_near=(60, 20), arm_far=(70, 10), foot_near=(34, 0), foot_far=(20, 0),
                    extra=dict(sword=-40, drag=0))
    if name == "idle_b":
        return Pose(hip=(27, 42), lean=8, arm_near=(65, 25), arm_far=(75, 15), foot_near=(34, 0), foot_far=(20, 0),
                    head_tilt=4, extra=dict(sword=-34, drag=2))
    if name == "idle_c":
        return Pose(hip=(27, 41), lean=4, arm_near=(55, 15), arm_far=(65, 5), foot_near=(35, 0), foot_far=(19, 0),
                    head_tilt=-4, extra=dict(sword=-48, drag=1))
    if name == "windup":  # 대검을 어깨 위 뒤로 들어 올림
        return Pose(hip=(25, 41), lean=-6, arm_near=(-100, -60), arm_far=(-110, -70), foot_near=(33, 0), foot_far=(17, 0),
                    head_tilt=-6, extra=dict(sword=-150, drag=3))
    if name == "move":
        return Pose(hip=(31, 41), lean=20, arm_near=(100, 160), arm_far=(110, 170), foot_near=(41, 2), foot_far=(20, 0),
                    head_tilt=10, extra=dict(sword=170, drag=8))
    if name == "attack":  # 내려 벤다
        return Pose(hip=(30, 41), lean=22, arm_near=(10, 40), arm_far=(20, 50), foot_near=(40, 0), foot_far=(21, 0),
                    head_tilt=14, extra=dict(sword=20, drag=6))
    if name == "recover":  # 스킬: 칼을 앞 땅에 꽂는다
        return Pose(hip=(25, 43), lean=24, arm_near=(60, 70), arm_far=(70, 80), foot_near=(32, 0), foot_far=(18, 0),
                    head_tilt=14, extra=dict(sword=72, drag=4))
    if name == "hit":
        return Pose(hip=(23, 41), lean=-18, arm_near=(-20, 30), arm_far=(-10, 40), foot_near=(30, 0), foot_far=(17, 2),
                    head_tilt=-24, extra=dict(sword=-120, drag=-2, eye="shut"))
    raise KeyError(name)


def draw_dead(cv):
    """무릎 꿇고 앞으로 엎어진 갑주 + 바닥에 떨어진 대검."""
    sword(cv, (14, 58), 0)
    cv.part(poly(cv.blank(), [(8, 58), (14, 52), (26, 50), (32, 59)]), CAPE, ink=INK)
    cv.part(poly(cv.blank(), [(20, 58), (24, 51), (38, 50), (40, 58)]), ARMOR, ink=INK)
    cv.part(ellipse(cv.blank(), (44, 54), 5, 4), ARMOR, ink=INK)
    cv.part(chain([(42, 51), (46, 46), (50, 46)], [2.4, 1.8, 1.0]), HORN, ink=INK, gloss=False)
    cv.line([(44, 54), (48, 54)], INK)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    tip = P.extra["tip"]
    if name == "attack":
        arc_trail(cv, J["hand_f"], 17, -70, 30, 3.4, BLADE[1], BLADE[3])
        burst(cv, add(tip, (1, 0)), 3.5, FIRE[2], FIRE[3], spikes=6)
    elif name == "recover":
        # 꽂힌 칼끝에서 앞쪽 땅을 따라 갈라지는 금 + 솟는 붉은 불길 셋
        g = (tip[0], 59)
        cv.line4([g, (61, 59)], FIRE[1])
        for k, x in enumerate((g[0] + 3, g[0] + 9, g[0] + 15)):
            if x < 62:
                flame(cv, (x, 59), 8 + k * 3, 5, FIRE[:3], tongues=2, seed=k)
        burst(cv, g, 3.0, FIRE[2], FIRE[3], spikes=5)
    elif name == "windup":
        sparkle(cv, add(tip, (0, -1)), WHITE, BLADE[3], big=True)
    elif name == "move":
        for y in (34, 42):
            cv.line4([(3, y), (10, y)], ARMOR[2])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((6, -6), (8, -3), (4, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("revenant-vengeful", draw, sys.argv[1:], idle_ms=230)

#!/usr/bin/env python3
"""잭 오 랜턴(jackolantern-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

호박 머리 허수아비 몸: 골이 진 둥근 주황 호박 머리(꼭지 줄기와 말린 덩굴 잎), 앞면에 세모 눈 하나·
톱니 입이 뚫려 안쪽 불빛이 노랗게 새어 나온다(옆얼굴이라 가까운 눈만, 머리 안 앞쪽).
몸은 덩굴로 엮은 가는 초록 몸통에 해진 보라 망토, 덩굴 손가락의 긴 팔, 가까운 손에 든 작은 등불.
6번 칸(스킬 도깨비불): 입을 크게 벌려 안의 불을 토해 아군 쪽으로 주황 불덩이 셋을 날린다.

  python3 scripts/content/monsters/redraw_jackolantern_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, glow, lerp, polar, poly, puff, rnd, run, sparkle

INK = (36, 16, 10)
PUMP = [(170, 70, 10), (220, 110, 24), (246, 150, 50), (255, 190, 100)]
VINE = [(40, 80, 30), (70, 120, 44), (110, 160, 64), (110, 160, 64)]
VINE_FAR = [(30, 60, 24), (40, 80, 30), (50, 96, 36), (50, 96, 36)]
CLOAK = [(56, 30, 70), (84, 46, 104), (114, 70, 136), (114, 70, 136)]
FIRE = [(230, 90, 20), (255, 170, 40), (255, 240, 150)]
HOLE = (70, 20, 10)
IRON = [(50, 46, 46), (90, 84, 82), (130, 124, 120), (130, 124, 120)]
DUST = [(90, 80, 70), (130, 120, 104)]
WHITE = (255, 250, 220)
G = 60


def leg(cv, hip, knee, foot, far):
    ramp = VINE_FAR if far else VINE
    cv.part(chain([hip, knee, add(foot, (0, -1))], [2.6, 2.2, 2.0]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 2), (f[0] + 3, f[1] - 2), (f[0] + 5, f[1]), (f[0] - 2, f[1])]), ramp, ink=INK, gloss=False)


def torso(cv, hip, chest, lean, P):
    # 해진 망토(등 뒤로) → 덩굴 몸통
    wv = P.extra.get("wave", 0)
    cl = [add(chest, (-3, -2)), add(chest, (2, -2)), add(hip, (0, 4)), add(hip, (-3, 7 + wv)), add(hip, (-6, 5)), add(hip, (-9, 8 - wv)),
          add(hip, (-10, 3)), add(chest, (-7, 4))]
    cv.part(poly(cv.blank(), cl), CLOAK, ink=INK, gloss=False)
    cv.part(chain([hip, lerp(hip, chest, 0.5), chest], [4, 3.4, 4.4]), VINE, ink=INK, gloss=False)
    for t in (0.3, 0.7):
        p = lerp(hip, chest, t)
        cv.line4([rnd(add(p, (-2, 0))), rnd(add(p, (2, -1)))], VINE[0])


def lantern(cv, hand):
    top = add(hand, (0, 2))
    cv.line4([rnd(hand), rnd(top)], IRON[1])
    c = add(top, (0, 4))
    cv.part(poly(cv.blank(), [add(c, (-3, -3)), add(c, (3, -3)), add(c, (3, 3)), add(c, (-3, 3))]), IRON, ink=INK, gloss=False)
    cv.put(poly(cv.blank(), [add(c, (-2, -2)), add(c, (2, -2)), add(c, (2, 2)), add(c, (-2, 2))]), FIRE[1])
    cv.pixel(*rnd(c), FIRE[2])


def arm(cv, sh, el, hand, far, P):
    ramp = VINE_FAR if far else VINE
    cv.part(chain([sh, el, hand], [2.6, 2.2, 1.8]), ramp, ink=INK, gloss=False)
    for a in (-30, 10, 50):
        cv.line4([rnd(hand), rnd(polar(hand, P.extra.get("finger", 30) + a, 3))], ramp[1])
    if not far and P.extra.get("lantern", True):
        lantern(cv, hand)


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    mouth = P.extra.get("mouth", 0)
    # 꼭지 + 덩굴 잎
    cv.part(chain([R(0, -8), R(-1, -11), R(1, -13)], [2.6, 2.2, 1.6]), VINE, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(1, -10), R(6, -12), R(5, -9)]), VINE, ink=INK, gloss=False)
    # 골 진 호박: 뒤 골 → 가운데 → 앞 골
    for dx, rx in ((-4, 6), (4, 6), (0, 6.5)):
        cv.part(ellipse(cv.blank(), R(dx, 0), rx, 8), PUMP, ink=INK)
    cv.line4([rnd(R(-1, -7)), rnd(R(-1, 7))], PUMP[0])
    cv.line4([rnd(R(4, -7)), rnd(R(5, 6))], PUMP[0])
    # 세모 눈(앞) + 톱니 입, 안쪽 불빛
    eye = P.extra.get("eye", "open")
    ec = R(5, -3)
    if eye == "shut":
        cv.line4([rnd(add(ec, (-2, 0))), rnd(add(ec, (2, 0)))], HOLE)
    else:
        cv.put(poly(cv.blank(), [add(ec, (-2, 1.5)), add(ec, (2, 1.5)), add(ec, (0.5, -2))]), FIRE[1])
        cv.pixel(*rnd(add(ec, (0, 0.5))), FIRE[2])
    m = [R(1, 2), R(9, 1), R(9, 4 + mouth), R(1, 5 + mouth * 0.6)]
    cv.put(poly(cv.blank(), m), FIRE[0] if mouth else FIRE[1])
    for dx in (3, 6):
        cv.put(poly(cv.blank(), [R(dx - 1, 2), R(dx + 1, 2), R(dx, 3.5)]), PUMP[1])
    return dict(eye=rnd(ec), mouth=R(9, 3 + mouth * 0.5))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=7.0, shin=7.0, hip_w=3, shoulder_w=4)


def pose(name):
    b = dict(hip=(28, 45), torso=10.0, neck=6.0, foot_near=(33, 0), foot_far=(23, 0))
    if name == "idle_a":
        return Pose(**b, lean=6, head_tilt=0, arm_near=(60, 90), arm_far=(110, 80))
    if name == "idle_b":
        return Pose(**dict(b, hip=(28, 46)), lean=8, head_tilt=8, arm_near=(70, 95), arm_far=(115, 85), extra=dict(wave=2, mouth=1))
    if name == "idle_c":
        return Pose(**b, lean=4, head_tilt=-6, arm_near=(50, 80), arm_far=(105, 75), extra=dict(wave=-2))
    if name == "windup":
        return Pose(**dict(b, foot_near=(32, 0), foot_far=(19, 0)), lean=-10, head_tilt=-12, arm_near=(-120, -150), arm_far=(-80, -60),
                    extra=dict(mouth=2, lantern=False, finger=-90))
    if name == "move":
        return Pose(**dict(b, hip=(31, 44), foot_near=(40, 3), foot_far=(20, 0)), lean=20, head_tilt=10, arm_near=(20, 40), arm_far=(150, 120),
                    extra=dict(wave=4, mouth=1))
    if name == "attack":
        return Pose(**dict(b, foot_near=(36, 0), foot_far=(18, 0)), lean=18, head_tilt=12, arm_near=(-10, 0), arm_far=(130, 110),
                    extra=dict(mouth=3, lantern=False, finger=0))
    if name == "recover":
        return Pose(**dict(b, hip=(25, 45), foot_near=(32, 0), foot_far=(18, 0)), lean=-4, head_tilt=-4, arm_near=(100, 130), arm_far=(120, 140),
                    extra=dict(mouth=5, wave=3))
    if name == "hit":
        return Pose(**dict(b, hip=(25, 45), foot_near=(31, 0), foot_far=(20, 1)), lean=-18, head_tilt=-26, arm_near=(-60, -30), arm_far=(-120, -150),
                    extra=dict(eye="shut", lantern=False, finger=-60))
    raise KeyError(name)


def draw_dead(cv):
    cv.part(poly(cv.blank(), [(10, 59), (14, 54), (30, 54), (32, 59)]), CLOAK, ink=INK, gloss=False)
    cv.part(chain([(14, 57), (30, 57)], [3, 3]), VINE, ink=INK, gloss=False)
    for dx, rx in ((-3, 5), (3, 5), (0, 5.5)):
        cv.part(ellipse(cv.blank(), (42 + dx, 53), rx, 6), PUMP, ink=INK)
    cv.line4([(40, 50), (42, 52)], HOLE)
    cv.line4([(42, 50), (40, 52)], HOLE)
    cv.line4([(41, 55), (47, 55)], HOLE)
    cv.part(chain([(42, 47), (44, 44)], [2, 1.6]), VINE, ink=INK, gloss=False)
    lantern(cv, (54, 50))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    J = draw_body(cv, LOOK, P)
    m = J["mouth"]
    if name == "windup":
        glow(cv, add(J["hand_n"], (0, -3)), 3.5, FIRE)
    elif name == "move":
        puff(cv, (14, 57), 2.2, DUST)
    elif name == "attack":
        burst(cv, add(J["hand_n"], (3, 0)), 4.5, FIRE[1], FIRE[2], spikes=6)
    elif name == "recover":
        cv.put(poly(cv.blank(), [add(m, (0, -2)), (44, m[1] - 4), (44, m[1] + 4), add(m, (0, 2))]), FIRE[0])
        for c, s in (((48, m[1] - 2), 1.0), ((55, m[1] + 4), 0.85), ((60, m[1] - 6), 0.7)):
            glow(cv, c, 4 * s, FIRE)
        sparkle(cv, add(m, (2, -6)), WHITE, FIRE[1])
    elif name == "hit":
        e = J["eye"]
        for dx, dy in ((4, -9), (7, -7), (6, -12)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("jackolantern-01", draw, sys.argv[1:], idle_ms=220)

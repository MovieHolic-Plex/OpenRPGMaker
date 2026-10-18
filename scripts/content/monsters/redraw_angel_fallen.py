#!/usr/bin/env python3
"""타락천사(angel-fallen) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

은빛 머리칼과 머리 위 금빛 고리, 등 뒤로 크게 솟은 청회색 겹깃 날개(깃 끝이 검게 그을림),
코와 입이 드러난 창백한 얼굴, 강철 흉갑과 붉은 망토, 가까운 손의 강철 검.
다리·흉갑·검은 redraw_knight_fallen 의 판금 부품을 쓴다.
6번 칸(스킬, 아키타입 skill_holy): 날개를 활짝 펴고 검을 하늘로 세워, 금빛 고리에서 성광 기둥이 쏟아진다.

  python3 scripts/content/monsters/redraw_angel_fallen.py [--preview DIR]
"""
from __future__ import annotations

import sys

import numpy as np

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, polar, poly, puff, rnd, run, sparkle, speed_lines
from redraw_knight_fallen import BLADE, CAPE, EYE, GOLD, INK, PLATE, PLATE_FAR, WHITE, arm as knight_arm, cape, leg, rot

FEATHER = [(70, 82, 104), (108, 124, 148), (156, 172, 194), (214, 224, 236)]
FEATHER_FAR = PLATE_FAR
SOOT = INK
SKIN = [(150, 120, 120), (206, 176, 168), (236, 214, 204), (236, 214, 204)]
HAIR = BLADE  # 은빛 머리칼은 강철 칼날과 같은 은색 단계
HALO = [GOLD, (240, 200, 80), (255, 240, 170)]
HOLY = HALO
DUST = PLATE_FAR[1:3]


def wing(cv, root, spread, far):
    """어깨 뒤 뿌리에서 위·뒤로 솟는 겹깃 날개. spread 0(접음)~1(활짝).
    날개 뼈(위로 솟았다 뒤로 꺾임)를 따라 깃이 부채꼴로 늘어지고, 끝 깃은 검게 그을렸다."""
    ramp = FEATHER_FAR if far else FEATHER
    lift = 6 if far else 0
    elbow = polar(root, -112 + lift - 14 * spread, 9 + 3 * spread)
    tip = polar(elbow, -150 + lift - 30 * spread, 8 + 5 * spread)
    bone = [root, elbow, tip]
    for i in range(7):  # 깃: 뿌리 쪽은 아래로 짧게, 날개 끝 쪽은 뒤로 길게
        t = i / 6
        seg, u = (0, t * 2) if t < 0.5 else (1, t * 2 - 1)
        base = (bone[seg][0] + (bone[seg + 1][0] - bone[seg][0]) * u, bone[seg][1] + (bone[seg + 1][1] - bone[seg][1]) * u)
        ang = 100 + 60 * t + (6 if far else 0) - 10 * spread * t
        ln = 9 + 7 * t + 3 * spread
        end = polar(base, ang, ln)
        cv.part(chain([base, end], [2.6, 1.2]), ramp, gloss=False)
        cv.pixel(*rnd(end), SOOT)
    cv.part(chain(bone, [3.0, 2.6, 1.4]), ramp, gloss=False)  # 날개 뼈 위 덮깃
    if not far:
        cv.line4([rnd(polar(root, -112 - 14 * spread, 2)), rnd(elbow), rnd(polar(elbow, -150 - 30 * spread, 4))], FEATHER[3])
    return tip


def torso(cv, hip, chest, lean, P):
    spread = P.extra.get("wing", 0.3)
    root = add(chest, (-3, 1))
    wing(cv, add(root, (1, -1)), spread, True)
    wing(cv, root, spread, False)
    cape(cv, hip, chest, lean, P)
    R = rot(hip, lean)
    cv.part(poly(cv.blank(), [R(-6, -2), R(6, -2), R(7, 5), R(-6, 5)]), PLATE)  # 판금 치마
    cv.line4([R(0, -1), R(0, 5)], PLATE[0])
    cv.part(poly(cv.blank(), [R(-5, -2), R(5, -2), R(7, -9), R(7, -15), R(3, -18), R(-4, -18), R(-7, -13), R(-6, -6)]), PLATE)
    cv.line4([R(-3, -15), R(1, -9), R(5, -15)], GOLD)  # 흉갑 금테
    cv.line4([R(-5, -2), R(5, -2)], GOLD)
    cv.pixel(*rnd(R(4, -14)), PLATE[3])


def arm(cv, sh, el, hand, far, P):
    knight_arm(cv, add(sh, (0, 1)), el, hand, far, P)


def head(cv, c, tilt, P):
    R = rot(c, tilt)
    # 뒤로 흘러내리는 은빛 머리칼(얼굴 뒤)
    cv.part(poly(cv.blank(), [R(3, -6), R(-3, -7), R(-7, -3), R(-8, 4), R(-6, 7), R(-3, 3), R(-2, 4)]), HAIR, gloss=False)
    # 얼굴: 코가 오뚝 나온 옆얼굴
    cv.part(poly(cv.blank(), [R(-3, -4), R(3, -5), R(5, -2), R(7, 0), R(5, 1), R(5, 3), R(2, 5), R(-2, 4), R(-3, 1)]), SKIN)
    cv.line4([R(-2, -6), R(4, -6), R(6, -3)], HAIR[2])  # 앞머리
    cv.part(poly(cv.blank(), [R(-3, -7), R(4, -7), R(5, -4), R(1, -4), R(-3, -2)]), HAIR, gloss=False)
    cv.pixel(*rnd(R(3, -2)), INK)  # 눈
    if P.extra.get("glare"):
        cv.pixel(*rnd(R(4, -2)), EYE)
    cv.line4([R(3, 3), R(4, 3)], SKIN[0])  # 입
    # 금빛 고리: 머리 위 기울어진 납작 타원
    if P.extra.get("halo", 1):
        hc = R(-1, -8.6)  # 정수리 머리칼에 얹힌다(대기 칸 한 덩어리)
        o = cv.blank()
        ellipse(o, hc, 5, 2.2)
        M = np.array(o) > 0
        inner = cv.blank()
        ellipse(inner, hc, 3.0, 0.5)
        M &= ~(np.array(inner) > 0)
        cv.put(M, HALO[1])
        cv.pixel(*rnd(add(hc, (3, -1))), HALO[2])
    return dict(eye=R(3, -2), top=R(0, -12))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=7.0, shin=7.0, hip_w=5.0, shoulder_w=8.0)


def pose(name):
    b = dict(hip=(27, 45), torso=14.0, neck=2.5, foot_near=(33, 0), foot_far=(20, 0))
    if name == "idle_a":  # 검을 늘어뜨리고 날개를 반쯤 편다
        return Pose(**b, lean=2, arm_near=(70, -20), arm_far=(70, 20), extra=dict(sword=-40, wing=0.35))
    if name == "idle_b":  # 날개를 펼치며 떠오를 듯
        return Pose(**dict(b, hip=(26, 44)), lean=0, arm_near=(74, -14), arm_far=(76, 26), head_tilt=-3,
                    extra=dict(sword=-34, wing=0.55, cape=2))
    if name == "idle_c":  # 날개를 접고 고개를 숙인다
        return Pose(**dict(b, hip=(26, 45)), lean=4, arm_near=(62, -32), arm_far=(66, 14), head_tilt=6,
                    extra=dict(sword=-52, wing=0.2, cape=-1))
    if name == "windup":  # 날개를 모으며 검을 머리 뒤로
        return Pose(**dict(b, hip=(27, 45), foot_near=(35, 0), foot_far=(18, 0)), lean=-8,
                    arm_near=(-40, -100), arm_far=(-105, -135), head_tilt=-8,
                    extra=dict(sword=-150, sword_far=True, wing=0.9, cape=3, glare=1))
    if name == "move":  # 날개를 뒤로 젖히고 활강 돌진
        return Pose(**dict(b, hip=(29, 43), foot_near=(37, 2), foot_far=(19, 3)), lean=22,
                    arm_near=(110, 40), arm_far=(80, 40), head_tilt=12, extra=dict(sword=170, wing=0.1, cape=6, glare=1))
    if name == "attack":  # 크게 내리벤다
        return Pose(**dict(b, hip=(25, 45), foot_near=(38, 0), foot_far=(14, 0)), lean=24,
                    arm_near=(0, 20), arm_far=(30, 40), head_tilt=14, extra=dict(sword=30, wing=0.6, cape=4, glare=1))
    if name == "recover":  # 스킬: 날개를 활짝, 검을 하늘로
        return Pose(**dict(b, hip=(25, 45), foot_near=(32, 0), foot_far=(18, 0)), lean=-4,
                    arm_near=(-10, -80), arm_far=(60, 30), head_tilt=-10, extra=dict(sword=-90, wing=1.0, cape=2, glare=1))
    if name == "hit":  # 날개가 꺾이고 몸이 젖혀진다
        return Pose(**dict(b, hip=(23, 46), foot_near=(30, 0), foot_far=(17, 1)), lean=-22,
                    arm_near=(130, 160), arm_far=(150, 170), head_tilt=-26, extra=dict(sword=-170, wing=0.05, cape=-2, halo=0))
    raise KeyError(name)


def draw_dead(cv):
    """쓰러진 타락천사: 펼쳐진 날개 위에 엎어지고 고리가 떨어진다."""
    for i in range(5):
        cv.part(chain([(14 + i * 2, 54), (4 + i * 3, 59)], [2.2, 1.0]), FEATHER_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(10, 59), (14, 53), (26, 52), (30, 55), (28, 59)]), CAPE, gloss=False)
    cv.part(poly(cv.blank(), [(16, 59), (18, 53), (34, 52), (37, 55), (36, 59)]), PLATE)
    cv.line4([(20, 54), (34, 54)], GOLD)
    cv.part(poly(cv.blank(), [(37, 59), (37, 54), (41, 52), (45, 53), (47, 56), (45, 59)]), SKIN)
    cv.part(poly(cv.blank(), [(36, 58), (36, 53), (40, 51), (43, 51), (39, 55)]), HAIR, gloss=False)
    cv.line4([(49, 59), (60, 56)], BLADE[2])
    cv.line4([(51, 57), (51, 60)], GOLD)
    cv.line4([(52, 52), (56, 52)], HALO[0])  # 떨어진 고리(빛을 잃음)
    cv.line4([(51, 53), (57, 53)], HALO[0])
    puff(cv, (8, 51), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), FEATHER[2])
    J = draw_body(cv, LOOK, P)
    tip = P.extra["_tip"]
    if name == "attack":
        arc_trail(cv, J["sh_n"], 20, -80, 40, 4.0, BLADE[1], WHITE)
        burst(cv, (min(tip[0] + 1, 59), min(tip[1], 56)), 4.0, BLADE[2], WHITE, spikes=7)
    elif name == "windup":
        sparkle(cv, tip, WHITE, BLADE[2])
    elif name == "recover":
        # 성광 기둥: 아군 쪽 위에서 쏟아지는 금빛 빛줄기 + 고리 빛무리
        for x, y0 in ((47, 6), (54, 14)):
            cv.line([(x, y0), (x + 1, 57)], HOLY[1], 2)
            cv.line4([(x, y0 + 2), (x + 1, 56)], HOLY[2])
            sparkle(cv, (x + 1, 57), HOLY[2], HOLY[1])
        sparkle(cv, add(tip, (0, -1)), WHITE, HOLY[1], big=True)
    elif name == "move":
        puff(cv, (16, 58), 2.0, DUST)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-7, -6), (-9, -3), (-8, -9)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
        for p in ((10, 40), (8, 46)):  # 떨어지는 깃
            cv.line4([p, add(p, (1, 2))], FEATHER[2])
    return cv.image()


if __name__ == "__main__":
    run("angel-fallen", draw, sys.argv[1:], idle_ms=240)

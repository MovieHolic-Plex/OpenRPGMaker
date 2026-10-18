#!/usr/bin/env python3
"""타락한 기사(knight-fallen) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

겹친 청회색 강철 판금: 앞으로 튀어나온 코 가리개 투구(어두운 시야 틈 사이로 붉은 눈빛), 투구 위 붉은 깃,
넓은 어깨 판, 허리 아래 판금 치마, 등 뒤로 늘어진 너덜한 붉은 망토, 가까운 손에 쥔 긴 강철 검.
6번 칸(스킬): 검을 하늘로 곧게 세우고 검은 기운이 칼날을 감아 올라 붉은 눈빛이 타오른다.

  python3 scripts/content/monsters/redraw_knight_fallen.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, flame, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (14, 18, 26)
PLATE = [(58, 70, 88), (88, 104, 124), (128, 146, 166), (190, 204, 218)]
PLATE_FAR = [(40, 50, 64), (56, 68, 84), (70, 84, 100), (70, 84, 100)]
CAPE = [(70, 14, 22), (110, 24, 32), (150, 38, 42), (150, 38, 42)]
PLUME = [(120, 20, 28), (190, 40, 44), (236, 90, 80), (236, 90, 80)]
GOLD = (206, 170, 84)
BLADE = [(120, 130, 146), (176, 186, 200), (222, 230, 238), (255, 255, 255)]
HILT = [(60, 40, 30), (96, 66, 40), (130, 92, 54), (130, 92, 54)]
EYE = (255, 70, 60)
DARK = [(30, 20, 44), (64, 40, 90), (120, 80, 160), (200, 170, 240)]
DUST = [(100, 98, 96), (146, 142, 134)]
WHITE = (255, 252, 240)


def rot(c, ang):
    a = math.radians(ang)
    return lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))


def leg(cv, hip, knee, foot, far):
    ramp = PLATE_FAR if far else PLATE
    cv.part(chain([hip, knee], [4.0, 3.4]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -3))], [3.4, 3.2]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 2.4, 2.0), ramp)  # 무릎 판
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 2, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), ramp, gloss=False)


def cape(cv, hip, chest, lean, P):
    """어깨에서 등 뒤로 늘어진 너덜한 망토. sway: + 는 뒤로 더 휘날림."""
    s = P.extra.get("cape", 0)
    top = add(chest, (-3, 1))
    pts = [add(top, (3, -1)), add(top, (-4, 0)), (hip[0] - 9 - s, hip[1] - 2), (hip[0] - 11 - s * 1.4, hip[1] + 8),
           (hip[0] - 9 - s, hip[1] + 6), (hip[0] - 8 - s, hip[1] + 10), (hip[0] - 5 - s * 0.6, hip[1] + 7),
           (hip[0] - 4 - s * 0.5, hip[1] + 11), (hip[0] - 1, hip[1] + 4)]
    cv.part(poly(cv.blank(), pts), CAPE, gloss=False)


def torso(cv, hip, chest, lean, P):
    cape(cv, hip, chest, lean, P)
    R = rot(hip, lean)
    cv.part(poly(cv.blank(), [R(-6, -2), R(6, -2), R(7, 5), R(-6, 5)]), PLATE)  # 판금 치마
    for x in (-2, 2):
        cv.line4([R(x, -1), R(x, 5)], PLATE[0])
    cv.part(poly(cv.blank(), [R(-5, -2), R(5, -2), R(7, -9), R(7, -15), R(3, -18), R(-4, -18), R(-7, -13), R(-6, -6)]), PLATE)
    cv.line4([R(-4, -10), R(5, -10)], PLATE[0])  # 겹친 가슴 판 선
    cv.line4([R(-4, -6), R(5, -6)], PLATE[0])
    cv.line4([R(-5, -2), R(5, -2)], GOLD)  # 허리띠
    cv.pixel(*rnd(R(4, -15)), PLATE[3])


def sword(cv, hand, ang):
    """긴 강철 검: 손 아래 자루·금빛 가로대, ang 쪽으로 칼날. 칼끝 좌표를 돌려준다."""
    tip = polar(hand, ang, 17)
    pommel = polar(hand, ang + 180, 3)
    cv.part(chain([pommel, hand], [1.4, 1.4]), HILT, gloss=False)
    guard_a, guard_b = polar(hand, ang + 90, 3), polar(hand, ang - 90, 3)
    cv.line4([rnd(guard_a), rnd(guard_b)], GOLD)
    base = polar(hand, ang, 1.5)
    cv.part(poly(cv.blank(), [polar(base, ang + 90, 1.6), polar(polar(base, ang, 12), ang + 90, 1.3), tip,
                              polar(polar(base, ang, 12), ang - 90, 1.3), polar(base, ang - 90, 1.6)]), BLADE, gloss=False)
    cv.line4([rnd(polar(base, ang, 2)), rnd(polar(base, ang, 13))], BLADE[3])  # 피 홈 빛
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = PLATE_FAR if far else PLATE
    cv.part(chain([sh, el], [3.2, 2.8]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.8, 3.0]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.0, 2.0), ramp, gloss=False)  # 건틀릿
    cv.part(poly(cv.blank(), [add(sh, (-4, 1)), add(sh, (-3, -4)), add(sh, (3, -4)), add(sh, (5, 0)), add(sh, (3, 3)), add(sh, (-3, 3))]), ramp)
    if not far:
        cv.line4([add(sh, (-3, -1)), add(sh, (3, -1))], GOLD)
    # 검은 가까운 손에 쥔다. 머리 뒤로 젖힌 windup 은 먼 손 쪽(머리보다 먼저 = 뒤)에 그린다.
    if far == bool(P.extra.get("sword_far")):
        P.extra["_tip"] = sword(cv, hand, P.extra.get("sword", -60))


def head(cv, c, tilt, P):
    R = rot(c, tilt)
    # 붉은 깃: 투구 꼭대기에서 뒤로 흘러내린다
    pl = P.extra.get("plume", 0)
    cv.part(chain([R(0, -6), R(-4, -9), R(-9 - pl, -8), R(-12 - pl, -4)], [2.2, 2.6, 2.0, 0.8]), PLUME, gloss=False)
    # 둥근 투구 + 앞으로 튀어나온 코 가리개
    cv.part(poly(cv.blank(), [R(-5, 3), R(-5, -3), R(-2, -6), R(3, -6), R(6, -3), R(8, 0), R(6, 1), R(6, 4), R(-3, 4)]), PLATE)
    cv.line4([R(1, -2), R(6, -2)], INK)  # 어두운 시야 틈
    if P.extra.get("eye", 1):
        cv.pixel(*rnd(R(4, -2)), EYE)
        cv.pixel(*rnd(R(5, -2)), EYE)
    cv.line4([R(-1, -6), R(-1, 3)], GOLD)  # 투구 가운데 금테
    for y in (1, 3):
        cv.pixel(*rnd(R(4, y)), PLATE[0])
    return dict(eye=R(4, -2), top=R(0, -7))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=7.0, shin=7.0, hip_w=5.0, shoulder_w=8.0)


def pose(name):
    b = dict(hip=(24, 45), torso=15.0, neck=0.5, foot_near=(31, 0), foot_far=(18, 0))
    if name == "idle_a":  # 검을 앞으로 비스듬히 겨눈다
        return Pose(**b, lean=4, arm_near=(70, -20), arm_far=(70, 20), extra=dict(sword=-40, cape=0))
    if name == "idle_b":  # 숨: 내려앉고 망토가 흔들
        return Pose(**dict(b, hip=(24, 46)), lean=6, arm_near=(76, -14), arm_far=(76, 26), head_tilt=4,
                    extra=dict(sword=-34, cape=2, plume=1))
    if name == "idle_c":  # 검을 고쳐 쥐어 끝을 들어 올린다
        return Pose(**dict(b, foot_near=(32, 0)), lean=2, arm_near=(62, -32), arm_far=(66, 14), head_tilt=-3,
                    extra=dict(sword=-52, cape=-1, plume=-1, eye=0))
    if name == "windup":  # 검을 머리 뒤로 높이 젖힌다
        return Pose(**dict(b, hip=(26, 45), foot_near=(34, 0), foot_far=(17, 0)), lean=-8,
                    arm_near=(-40, -100), arm_far=(-105, -135), head_tilt=-8, extra=dict(sword=-150, sword_far=True, cape=3, plume=2))
    if name == "move":  # 망토를 휘날리며 돌진
        return Pose(**dict(b, hip=(28, 45), foot_near=(39, 0), foot_far=(16, 0)), lean=20,
                    arm_near=(110, 40), arm_far=(80, 40), head_tilt=12, extra=dict(sword=170, cape=6, plume=4))
    if name == "attack":  # 앞으로 크게 내리벤다
        return Pose(**dict(b, hip=(24, 45), foot_near=(37, 0), foot_far=(13, 0)), lean=24,
                    arm_near=(0, 20), arm_far=(30, 40), head_tilt=14, extra=dict(sword=30, cape=4, plume=3))
    if name == "recover":  # 스킬: 검을 하늘로 세운다
        return Pose(**dict(b, hip=(23, 45), foot_near=(30, 0), foot_far=(16, 0)), lean=-4,
                    arm_near=(-10, -80), arm_far=(60, 30), head_tilt=-10, extra=dict(sword=-90, cape=2, plume=2))
    if name == "hit":  # 맞아서 몸이 젖혀진다
        return Pose(**dict(b, hip=(22, 46), foot_near=(29, 0), foot_far=(15, 1)), lean=-22,
                    arm_near=(130, 160), arm_far=(150, 170), head_tilt=-26, extra=dict(sword=-170, cape=-2, eye=0))
    raise KeyError(name)


def draw_dead(cv):
    """쓰러진 기사: 망토 위로 엎어진 몸, 검은 옆에 떨어진다."""
    cv.part(poly(cv.blank(), [(8, 59), (12, 52), (22, 51), (28, 55), (26, 59)]), CAPE, gloss=False)
    cv.part(poly(cv.blank(), [(14, 59), (16, 52), (32, 51), (36, 55), (35, 59)]), PLATE)
    cv.line4([(18, 53), (33, 53)], GOLD)
    cv.part(poly(cv.blank(), [(36, 59), (36, 53), (39, 50), (44, 50), (47, 53), (46, 59)]), PLATE)
    cv.line4([(39, 55), (45, 55)], INK)
    cv.part(chain([(40, 50), (36, 47), (32, 48)], [1.8, 1.6, 0.8]), PLUME, gloss=False)
    cv.line4([(48, 59), (60, 56)], BLADE[2])
    cv.line4([(50, 57), (50, 60)], GOLD)
    puff(cv, (10, 50), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), PLATE[2])
    if name == "recover":
        for x, h, sd in ((11, 24, 1), (36, 22, 2), (24, 30, 3)):  # 몸을 둘러 솟는 검은 기운
            flame(cv, (x, 59), h, 7, DARK[1:], lean=0.0, tongues=2, seed=sd)
    J = draw_body(cv, LOOK, P)
    tip = P.extra["_tip"]
    if name == "attack":
        arc_trail(cv, J["sh_n"], 20, -80, 40, 4.0, BLADE[1], WHITE)
        burst(cv, (min(tip[0] + 1, 59), min(tip[1], 56)), 4.0, BLADE[2], WHITE, spikes=7)
    elif name == "windup":
        sparkle(cv, tip, WHITE, BLADE[2])
    elif name == "recover":
        for i in range(4):  # 칼날을 감아 올라가는 검은 기운
            y = tip[1] + 3 + i * 3
            cv.pixel(*rnd((tip[0] + (1 if i % 2 else -1) * 2, y)), DARK[2])
        sparkle(cv, add(tip, (0, -1)), DARK[3], DARK[2], big=True)
        cv.pixel(*rnd(J["eye"]), (255, 200, 180))
    elif name == "move":
        puff(cv, (14, 57), 2.0, DUST)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-7, -6), (-9, -3), (-8, -9)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("knight-fallen", draw, sys.argv[1:], idle_ms=260)

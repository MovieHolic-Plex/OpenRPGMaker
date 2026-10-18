#!/usr/bin/env python3
"""살아있는 갑옷(armor-living) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

속이 빈 검푸른 판금 갑옷: 뿔 달린 큰 투구(얼굴 가리개 틈과 이음새로 푸른 혼불이 샌다), 넓은 어깨 판,
허리 아래 판금 치마, 이음새마다 빛이 새는 빈 몸. 두 손으로 쥔 긴 자루 반달 도끼.
6번 칸(스킬 skill_mon_bone_curse): 도끼를 땅에 세워 짚고, 빈 투구에서 보라 혼불이 솟아 저주 문양을 띄운다.

  python3 scripts/content/monsters/redraw_armor_living.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, flame, glow, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (14, 16, 24)
PLATE = [(46, 54, 76), (74, 86, 114), (110, 124, 156), (168, 182, 210)]
PLATE_FAR = [(34, 40, 58), (46, 54, 76), (58, 68, 92), (58, 68, 92)]
TRIM = (190, 160, 80)
SOUL = [(40, 120, 200), (90, 200, 255), (200, 245, 255)]
CURSE = [(70, 30, 110), (130, 60, 190), (200, 140, 255), (240, 220, 255)]
HAFT = [(56, 36, 24), (90, 60, 36), (120, 84, 50), (120, 84, 50)]
BLADE = [(110, 120, 136), (168, 178, 192), (214, 222, 232), (250, 252, 255)]
DUST = [(100, 98, 96), (146, 142, 134)]
WHITE = (255, 252, 240)
GROUND = 60


def seam(cv, a, b):
    """판 이음새로 새는 혼불 한 줄."""
    cv.line4([rnd(a), rnd(b)], SOUL[1])


def leg(cv, hip, knee, foot, far):
    ramp = PLATE_FAR if far else PLATE
    cv.part(chain([hip, knee], [4.4, 3.8]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -3))], [3.8, 3.6]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 2.4, 2.2), ramp)  # 무릎 판
    if not far:
        cv.pixel(*rnd(add(knee, (1, 0))), SOUL[1])
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 3, f[1] - 3), (f[0] + 5, f[1]), (f[0] - 3, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 판금 치마(겹친 세 장)
    cv.part(poly(cv.blank(), [R(-6, -2), R(6, -2), R(7, 5), R(-7, 5)]), PLATE)
    for x in (-2, 3):
        cv.line4([R(x, -1), R(x, 5)], PLATE[0])
    # 흉갑: 가슴이 불룩한 통
    cv.part(poly(cv.blank(), [R(-6, -2), R(6, -2), R(8, -9), R(8, -15), R(3, -18), R(-5, -18), R(-8, -13), R(-7, -6)]), PLATE)
    cv.line4([R(-4, -16), R(-1, -9), R(4, -16)], TRIM)  # 가슴 금테
    seam(cv, R(-6, -3), R(6, -3))  # 허리 이음새
    cv.pixel(*rnd(R(5, -14)), PLATE[3])


def axe(cv, hand, ang):
    """긴 자루 반달 도끼. ang = 자루 끝(날) 방향. 날은 ang+90 쪽."""
    top = polar(hand, ang, 13)
    butt = polar(hand, ang + 180, 6)
    cv.part(chain([butt, top], [1.6, 1.6]), HAFT, gloss=False)
    side = ang + 90
    c = polar(top, ang + 180, 3)
    edge = polar(c, side, 9)
    blade = [polar(c, ang, 2), polar(polar(c, ang, 3), side, 4), polar(polar(c, ang, 6), side, 8), edge,
             polar(polar(c, ang + 180, 6), side, 8), polar(polar(c, ang + 180, 3), side, 4), polar(c, ang + 180, 2)]
    cv.part(poly(cv.blank(), blade), BLADE)
    cv.line4([rnd(polar(polar(c, ang, 5), side, 7.6)), rnd(edge), rnd(polar(polar(c, ang + 180, 5), side, 7.6))], BLADE[3])
    # 뒤쪽 갈고리 가시
    cv.part(poly(cv.blank(), [polar(c, ang, 1), polar(c, side + 180, 4), polar(c, ang + 180, 1)]), BLADE, gloss=False)
    return edge


def arm(cv, sh, el, hand, far, P):
    ramp = PLATE_FAR if far else PLATE
    cv.part(chain([sh, el], [3.6, 3.2]), ramp, gloss=False)
    cv.part(chain([el, hand], [3.2, 3.4]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 2.2, 2.2), ramp, gloss=False)  # 건틀릿
    # 넓은 어깨 판(층 둘)
    cv.part(poly(cv.blank(), [add(sh, (-5, 1)), add(sh, (-3, -4)), add(sh, (3, -4)), add(sh, (5, 1)), add(sh, (3, 4)), add(sh, (-3, 4))]), ramp)
    # 도끼는 가까운 손에 쥔다. 머리 뒤로 젖힌 windup 은 먼 손 쪽(머리보다 먼저 = 뒤)에 그려 투구를 가리지 않는다.
    if far == bool(P.extra.get("axe_far")):
        P.extra["_edge"] = axe(cv, hand, P.extra.get("axe", -70))
    if not far:
        cv.line4([add(sh, (-3, 1)), add(sh, (3, 1))], TRIM)
    else:
        cv.pixel(*rnd(add(el, (0, 0))), SOUL[0])


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 뒤로 휜 뿔 둘
    for base, tip in (((-2, -5), (-8, -11)), ((2, -6), (-2, -13))):
        cv.part(chain([R(*base), R((base[0] + tip[0]) / 2 - 1, (base[1] + tip[1]) / 2), R(*tip)], [2.6, 2.0, 1.0]), [INK, (196, 186, 160), (226, 218, 196), (226, 218, 196)], gloss=False)
    # 원통 투구 + 앞으로 튀어나온 가리개
    cv.part(poly(cv.blank(), [R(-5, 3), R(-5, -4), R(-2, -7), R(3, -7), R(6, -4), R(7, 1), R(5, 4), R(-3, 4)]), PLATE)
    cv.line4([R(1, -2), R(7, -2)], INK)
    soul = P.extra.get("soul", 1)
    if soul:
        cv.line4([R(2, -2), R(5, -2)], SOUL[1])
        cv.pixel(*rnd(R(4, -2)), SOUL[2])
    for y in (0, 2):
        cv.line4([R(3, y), R(6, y)], PLATE[0])  # 숨구멍
    cv.line4([R(-1, -7), R(-1, 3)], TRIM)
    return dict(eye=R(4, -2), top=R(0, -8))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=7.0, thigh=7.0, shin=7.0, hip_w=5.0, shoulder_w=8.0)


def pose(name):
    b = dict(hip=(24, 45), torso=15.0, neck=0.5, foot_near=(31, 0), foot_far=(18, 0))
    if name == "idle_a":  # 도끼를 비스듬히 어깨 앞에
        return Pose(**b, lean=4, arm_near=(70, -20), arm_far=(50, 0), head_tilt=0, extra=dict(axe=-60))
    if name == "idle_b":  # 갑옷이 내려앉고 혼불이 깜빡
        return Pose(**dict(b, hip=(24, 46)), lean=8, arm_near=(76, -14), arm_far=(56, 6), head_tilt=6, extra=dict(axe=-52, soul=0))
    if name == "idle_c":  # 도끼를 고쳐 쥐어 날을 앞으로
        return Pose(**dict(b, foot_near=(32, 0)), lean=2, arm_near=(60, -30), arm_far=(44, -6), head_tilt=-3, extra=dict(axe=-40))
    if name == "windup":  # 도끼를 머리 뒤로 높이 젖힌다
        return Pose(**dict(b, hip=(26, 45), foot_near=(34, 0), foot_far=(17, 0)), lean=-8,
                    arm_near=(-40, -100), arm_far=(-105, -135), head_tilt=-8, extra=dict(axe=-135, axe_far=True))
    if name == "move":  # 철컹철컹 앞으로 성큼
        return Pose(**dict(b, hip=(28, 45), foot_near=(39, 0), foot_far=(16, 0)), lean=18,
                    arm_near=(110, 60), arm_far=(80, 40), head_tilt=12, extra=dict(axe=170))
    if name == "attack":  # 도끼를 앞으로 크게 내리찍는다
        return Pose(**dict(b, hip=(24, 45), foot_near=(37, 0), foot_far=(13, 0)), lean=24,
                    arm_near=(0, 20), arm_far=(10, 30), head_tilt=14, extra=dict(axe=20))
    if name == "recover":  # 스킬: 도끼를 땅에 짚고 투구에서 혼불이 솟는다
        return Pose(**dict(b, hip=(22, 45), foot_near=(30, 0), foot_far=(15, 0)), lean=-4,
                    arm_near=(30, 60), arm_far=(40, 70), head_tilt=-16, extra=dict(axe=-92))
    if name == "hit":  # 맞아서 판이 들썩, 투구가 뒤로 젖혀진다
        return Pose(**dict(b, hip=(22, 46), foot_near=(29, 0), foot_far=(15, 1)), lean=-22,
                    arm_near=(130, 160), arm_far=(150, 170), head_tilt=-28, extra=dict(axe=-170, soul=0))
    raise KeyError(name)


def draw_dead(cv):
    """흩어진 빈 갑옷: 투구가 굴러가고 혼불이 꺼진다."""
    cv.part(poly(cv.blank(), [(10, 59), (12, 53), (22, 52), (24, 59)]), PLATE_FAR)
    cv.part(poly(cv.blank(), [(20, 59), (22, 50), (34, 49), (37, 53), (36, 59)]), PLATE)
    cv.line4([(24, 51), (28, 56), (32, 51)], TRIM)
    cv.part(poly(cv.blank(), [(40, 59), (40, 53), (43, 50), (48, 50), (50, 54), (50, 59)]), PLATE)
    cv.line4([(43, 55), (49, 55)], INK)
    cv.part(chain([(44, 50), (40, 45)], [2.2, 1.0]), [INK, (196, 186, 160), (226, 218, 196), (226, 218, 196)], gloss=False)
    cv.line4([(51, 59), (60, 54)], HAFT[1])
    cv.part(poly(cv.blank(), [(56, 51), (60, 52), (61, 57), (58, 56)]), BLADE, gloss=False)
    for p in ((30, 45), (45, 44)):
        cv.pixel(*p, SOUL[0])
    puff(cv, (16, 49), 2.0, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), PLATE[2])
    J = draw_body(cv, LOOK, P)
    edge = P.extra["_edge"]
    if name == "attack":
        arc_trail(cv, J["sh_n"], 18, -80, 40, 4.0, BLADE[1], WHITE)
        burst(cv, (min(edge[0] + 2, 59), min(edge[1], 56)), 4.0, BLADE[2], WHITE, spikes=7)
    elif name == "windup":
        sparkle(cv, edge, WHITE, BLADE[2])
        flame(cv, add(J["head"], (-1, -6)), 5, 4, SOUL, lean=-0.6, tongues=1)
    elif name == "recover":
        top = add(J["head"], (0, -7))
        flame(cv, top, 10, 7, CURSE[:3], lean=0.2, tongues=3, seed=1)
        c = add(top, (12, -2))
        glow(cv, c, 5.5, [CURSE[0], CURSE[1]])
        cv.put(ellipse(cv.blank(), add(c, (0, -1)), 2.2, 2.0), CURSE[3])
        cv.put(poly(cv.blank(), [add(c, (-1, 1)), add(c, (1, 1)), add(c, (1, 3)), add(c, (-1, 3))]), CURSE[3])
        cv.pixel(*rnd(add(c, (-1, -1))), CURSE[0])
        cv.pixel(*rnd(add(c, (1, -1))), CURSE[0])
        puff(cv, (edge[0] - 3, 57), 2.2, DUST)
    elif name == "move":
        puff(cv, (14, 57), 2.0, DUST)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-7, -6), (-9, -3), (-8, -9)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("armor-living", draw, sys.argv[1:], idle_ms=300)

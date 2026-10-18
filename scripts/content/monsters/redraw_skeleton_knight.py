#!/usr/bin/env python3
"""해골 기사(skeleton-knight) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

상아색 뼈 기사: 녹슨 강철 투구(얼굴 가리개 틈으로 붉은 불씨 눈), 갈비뼈 우리 위 낡은 가슴판과 어깨 판,
찢어진 진홍 허리 천, 가는 팔다리 뼈와 관절 혹. 먼 팔에 해골 문장 연 방패, 가까운 손에 긴 칼.
6번 칸(스킬 skill_mon_bone_curse): 칼을 하늘로 세우자 칼끝에 보라 해골 문양이 떠오른다.

  python3 scripts/content/monsters/redraw_skeleton_knight.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (24, 22, 26)
BONE = [(150, 138, 110), (200, 190, 160), (232, 224, 196), (250, 246, 228)]
BONE_FAR = [(110, 100, 80), (150, 138, 110), (150, 138, 110), (150, 138, 110)]
STEEL = [(62, 70, 84), (98, 108, 124), (140, 150, 164), (196, 204, 214)]
STEEL_FAR = [(46, 52, 64), (62, 70, 84), (62, 70, 84), (62, 70, 84)]
CLOTH = [(92, 24, 34), (134, 36, 46), (170, 56, 60), (170, 56, 60)]
SHIELD = [(52, 58, 78), (78, 86, 112), (106, 116, 144), (140, 150, 176)]
BLADE = [(120, 130, 146), (176, 186, 200), (222, 230, 238), (250, 252, 255)]
GOLD = (200, 164, 70)
EYE, EYE_HI = (230, 60, 50), (255, 190, 160)
CURSE = [(70, 30, 110), (130, 60, 190), (200, 140, 255), (240, 220, 255)]
WHITE = (255, 252, 240)
DUST = [(110, 100, 80), (150, 138, 110)]

def leg(cv, hip, knee, foot, far):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([hip, knee], [2.4, 2.0]), ramp, gloss=False)
    cv.part(chain([knee, add(foot, (0, -2))], [2.0, 1.8]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), knee, 1.6, 1.6), STEEL_FAR if far else STEEL, gloss=False)  # 무릎 판
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 2, f[1] - 3), (f[0] + 2, f[1] - 3), (f[0] + 4, f[1]), (f[0] - 2, f[1])]),
            STEEL_FAR if far else STEEL, gloss=False)  # 쇠 신


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 찢어진 허리 천(뒤 자락이 길다)
    cv.part(poly(cv.blank(), [R(-5, -1), R(5, -1), R(5, 4), R(2, 3), R(0, 6), R(-3, 4), R(-6, 7)]), CLOTH)
    # 골반 + 등뼈
    cv.part(poly(cv.blank(), [R(-4, -2), R(4, -2), R(3, 1), R(-3, 1)]), BONE, gloss=False)
    cv.part(chain([R(-1, -1), R(-1, -14)], [2.0, 2.0]), BONE_FAR, gloss=False)
    # 갈비 셋이 가슴판 아래로 드러난다
    for i in range(3):
        y = -4 - i * 2
        cv.line4([R(-1, y), R(3, y + 1), R(4, y + 2)], BONE[2] if i % 2 == 0 else BONE[1])
    # 낡은 가슴판(위쪽 절반)
    cv.part(poly(cv.blank(), [R(-4, -9), R(5, -9), R(6, -13), R(4, -16), R(-3, -16), R(-5, -13)]), STEEL)
    cv.line4([R(-3, -12), R(5, -12)], STEEL[0])
    cv.pixel(*rnd(R(3, -14)), STEEL[3])


def shield(cv, c, tilt=0.0):
    """연 모양 방패: 위가 넓고 아래가 뾰족, 금테 + 해골 문장."""
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-5, -7), R(5, -7), R(6, -2), R(3, 5), R(0, 9), R(-3, 5), R(-6, -2)]), SHIELD)
    cv.line4([R(-5, -6), R(5, -6)], GOLD)
    cv.line4([R(0, -5), R(0, 7)], SHIELD[0])
    # 해골 문장
    cv.put(ellipse(cv.blank(), R(0, -1), 2.2, 2.0), BONE[2])
    cv.pixel(*rnd(R(-1, -1)), INK)
    cv.pixel(*rnd(R(1, -1)), INK)
    cv.pixel(*rnd(R(0, 2)), BONE[1])


def sword(cv, hand, ang):
    """긴 칼: 손잡이 -> 십자 코등이 -> 곧은 날. ang = 칼끝 방향."""
    pommel = polar(hand, ang + 180, 3)
    cv.line4([rnd(pommel), rnd(hand)], (90, 60, 40))
    cv.pixel(*rnd(pommel), GOLD)
    guard = polar(hand, ang, 1.5)
    cv.line4([rnd(polar(guard, ang + 90, 3)), rnd(polar(guard, ang - 90, 3))], GOLD)
    tip = polar(guard, ang, 17)
    base_a, base_b = polar(guard, ang + 90, 1.3), polar(guard, ang - 90, 1.3)
    cv.part(poly(cv.blank(), [base_a, polar(base_a, ang, 14), tip, polar(base_b, ang, 14), base_b]), BLADE, gloss=False)
    cv.line4([rnd(polar(guard, ang, 2)), rnd(polar(guard, ang, 14))], BLADE[3])
    return tip


def arm(cv, sh, el, hand, far, P):
    ramp = BONE_FAR if far else BONE
    cv.part(chain([sh, el], [2.2, 2.0]), ramp, gloss=False)
    cv.part(chain([el, hand], [2.0, 1.8]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), hand, 1.4, 1.4), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), add(sh, (0, 1)), 3.2, 2.6), STEEL_FAR if far else STEEL)  # 어깨 판
    if far:
        P.extra["_hand_f"] = hand
    else:
        P.extra["_tip"] = sword(cv, hand, P.extra.get("sword", -70))


def head(cv, c, tilt, P):
    # 방패: 먼 손에 들려 몸통 앞에 오지만 가까운 팔·머리보다는 뒤
    hf = P.extra.get("_hand_f")
    if hf is not None:
        shield(cv, add(hf, P.extra.get("shield_off", (2, 0))), P.extra.get("shield_tilt", 0))
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    jaw = P.extra.get("jaw", 0)
    # 해골 아래턱(투구 밑으로 드러남)
    cv.part(poly(cv.blank(), [R(0, 2), R(5, 2 + jaw * 0.4), R(5, 4 + jaw), R(0, 4 + jaw * 0.6)]), BONE, gloss=False)
    for dx in (2, 4):
        cv.pixel(*rnd(R(dx, 3 + jaw * 0.5)), INK)
    # 둥근 투구 + 앞으로 내민 얼굴 가리개 + 볏
    cv.part(poly(cv.blank(), [R(-5, 1), R(-5, -4), R(-2, -7), R(3, -7), R(6, -4), R(7, 0), R(6, 2), R(-3, 2)]), STEEL)
    cv.part(poly(cv.blank(), [R(-3, -7), R(-1, -10), R(3, -10), R(4, -7)]), CLOTH, gloss=False)  # 진홍 볏
    cv.line4([R(2, -2), R(7, -2)], INK)  # 눈 틈
    if P.extra.get("eye") != "out":
        cv.pixel(*rnd(R(4, -2)), EYE)
        cv.pixel(*rnd(R(5, -2)), EYE_HI)
    cv.line4([R(-4, 0), R(6, 0)], STEEL[0])
    cv.pixel(*rnd(R(0, -5)), STEEL[3])
    return dict(eye=R(4, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=7.0, lower=6.5, thigh=8.0, shin=8.5, hip_w=4.0, shoulder_w=5.0)


def pose(name):
    b = dict(hip=(24, 42), torso=15.0, neck=1.0, foot_near=(31, 0), foot_far=(18, 0))
    if name == "idle_a":  # 방패를 앞에, 칼끝은 비스듬히 위로
        return Pose(**b, lean=4, arm_near=(70, -10), arm_far=(40, 30), head_tilt=0, extra=dict(sword=-60))
    if name == "idle_b":  # 뼈마디가 덜그럭 내려앉고 턱이 벌어진다
        return Pose(**dict(b, hip=(24, 43)), lean=8, arm_near=(75, -2), arm_far=(45, 34), head_tilt=6, extra=dict(sword=-50, jaw=2))
    if name == "idle_c":  # 칼을 고쳐 쥐어 앞으로 겨눈다
        return Pose(**dict(b, foot_near=(32, 0)), lean=2, arm_near=(60, -20), arm_far=(36, 26), head_tilt=-3, extra=dict(sword=-30))
    if name == "windup":  # 칼을 머리 위로 높이 들어 올린다
        return Pose(**dict(b, hip=(24, 42), foot_near=(32, 0), foot_far=(16, 0)), lean=-6,
                    arm_near=(-80, -120), arm_far=(20, 0), head_tilt=-6, extra=dict(sword=-128, jaw=1, shield_off=(3, 0)))
    if name == "move":  # 방패를 앞세우고 성큼 전진
        return Pose(**dict(b, hip=(28, 43), foot_near=(39, 0), foot_far=(16, 0)), lean=18,
                    arm_near=(110, 80), arm_far=(10, -10), head_tilt=12, extra=dict(sword=160, shield_off=(4, 0)))
    if name == "attack":  # 칼을 앞으로 크게 내려 벤다
        return Pose(**dict(b, hip=(24, 43), foot_near=(36, 0), foot_far=(13, 0)), lean=22,
                    arm_near=(-10, 10), arm_far=(100, 70), head_tilt=12, extra=dict(sword=20, jaw=2))
    if name == "recover":  # 스킬 해골의 저주: 칼을 하늘로 곧게 세운다
        return Pose(**dict(b, hip=(22, 42), foot_near=(31, 0), foot_far=(14, 0)), lean=-8,
                    arm_near=(-30, -60), arm_far=(30, 20), head_tilt=-14, extra=dict(sword=-75, jaw=3))
    if name == "hit":  # 맞아서 뒤로 휘청, 방패가 들린다
        return Pose(**dict(b, hip=(22, 43), foot_near=(29, 0), foot_far=(15, 1)), lean=-22,
                    arm_near=(120, 150), arm_far=(-30, -50), head_tilt=-26,
                    extra=dict(sword=170, jaw=4, eye="out", shield_off=(1, -1), shield_tilt=-20))
    raise KeyError(name)


def skull_sigil(cv, c, r):
    """보라 저주 문양: 빛무리 위 해골 + 교차한 뼈."""
    glow(cv, c, r + 3, [CURSE[0], CURSE[1]])
    cv.put(ellipse(cv.blank(), add(c, (0, -1)), r * 0.6, r * 0.55), CURSE[3])
    cv.put(poly(cv.blank(), [add(c, (-2, 1)), add(c, (2, 1)), add(c, (1, 3)), add(c, (-1, 3))]), CURSE[3])
    cv.pixel(*rnd(add(c, (-1, -1))), CURSE[0])
    cv.pixel(*rnd(add(c, (1, -1))), CURSE[0])
    for s in (1, -1):
        cv.line4([rnd(add(c, (-r * s, -r * 0.8))), rnd(add(c, (r * s, r)))], CURSE[2])


def draw_dead(cv):
    """무너진 뼈 무더기: 투구가 굴러가고 방패·칼이 떨어졌다."""
    for a, b in (((12, 58), (24, 57)), ((20, 59), (30, 56)), ((26, 58), (35, 59))):
        cv.part(chain([a, b], [2.0, 2.0]), BONE, gloss=False)
    cv.part(poly(cv.blank(), [(14, 58), (18, 53), (26, 53), (28, 58)]), CLOTH)
    shield(cv, (24, 53), -80)
    cv.part(poly(cv.blank(), [(38, 59), (38, 54), (41, 51), (45, 51), (48, 54), (48, 59)]), STEEL)
    cv.line4([(41, 55), (47, 55)], INK)
    cv.pixel(44, 55, (110, 40, 40))
    cv.line4([(50, 59), (61, 57)], BLADE[2])
    cv.line4([(51, 56), (51, 59)], GOLD)
    puff(cv, (34, 50), 2.2, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 1, 8, (30, 36, 44), BONE[1])
    J = draw_body(cv, LOOK, P)
    tip = P.extra["_tip"]
    if name == "attack":
        arc_trail(cv, J["sh_n"], 18, -80, 30, 4.0, BLADE[1], WHITE)
        sparkle(cv, tip, WHITE, BLADE[2], big=True)
    elif name == "windup":
        sparkle(cv, tip, WHITE, BLADE[2])
    elif name == "recover":
        skull_sigil(cv, add(tip, (8, 7)), 3.5)
        sparkle(cv, tip, CURSE[3], CURSE[2], big=True)
        for p in ((44, 46), (50, 40), (40, 30)):
            cv.pixel(*p, CURSE[2])
    elif name == "move":
        puff(cv, (14, 57), 2.0, DUST)
    elif name == "hit":
        h = J["head"]
        for dx, dy in ((-7, -6), (-9, -3), (-8, -9)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("skeleton-knight", draw, sys.argv[1:], idle_ms=320)

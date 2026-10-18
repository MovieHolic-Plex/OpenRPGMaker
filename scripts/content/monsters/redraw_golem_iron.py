#!/usr/bin/env python3
"""강철 골렘(golem-iron) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

리벳 박은 강철 판을 이어 붙인 거인: 둥근 어깨 갑주, 가슴 한가운데 주황 화로 창(용광로 심장),
좁은 투구형 머리에 가로로 빛나는 눈 틈, 원통 관절과 피스톤 팔뚝, 각진 큰 주먹, 짧고 굵은 다리.
등 뒤 굴뚝 둘에서 김이 오른다.
6번 칸(스킬 skill_mon_quake_stomp): 두 주먹을 땅에 내리꽂자 김이 뿜어 나오고 충격파·균열이 아군 쪽으로 퍼진다.

  python3 scripts/content/monsters/redraw_golem_iron.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from humanoid_rig import Look, Pose, draw_body
from pixel_lib import Canvas, add, burst, chain, crack, ellipse, glow, polar, poly, puff, ring, rnd, run, sparkle, speed_lines

INK = (16, 18, 24)
IRON = [(60, 66, 80), (96, 104, 120), (138, 146, 160), (190, 198, 208)]
IRON_FAR = [(42, 46, 58), (60, 66, 80), (76, 82, 96), (76, 82, 96)]
JOINT = [(46, 40, 38), (76, 66, 58), (104, 92, 80), (104, 92, 80)]
RIVET = (214, 220, 228)
FIRE = [(170, 60, 20), (240, 130, 40), (255, 210, 110), (255, 248, 210)]
EYE = (255, 180, 60)
STEAM = [(150, 156, 168), (210, 216, 224)]
CRACK = (40, 30, 26)
DUST = [(110, 104, 92), (156, 148, 132)]
WHITE = (255, 252, 240)
GROUND = 60


def plate(cv, a, b, w, ramp, rivets=True):
    """a->b 를 잇는 모서리 깎인 강철 판 + 양 끝 리벳."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    ux, uy = dx / n, dy / n
    pts = [add(a, (nx * 0.6 - ux, ny * 0.6 - uy)), add(a, (nx, ny)), add(b, (nx, ny)), add(b, (nx * 0.6 + ux, ny * 0.6 + uy)),
           add(b, (-nx * 0.6 + ux, -ny * 0.6 + uy)), add(b, (-nx, -ny)), add(a, (-nx, -ny)), add(a, (-nx * 0.6 - ux, -ny * 0.6 - uy))]
    M = cv.part(poly(cv.blank(), pts), ramp)
    if rivets and ramp is IRON:
        for t in (0.2, 0.8):
            p = (a[0] + dx * t + nx * 0.5, a[1] + dy * t + ny * 0.5)
            cv.pixel(*rnd(p), RIVET)
    return M


def leg(cv, hip, knee, foot, far):
    ramp = IRON_FAR if far else IRON
    plate(cv, hip, knee, 7.0, ramp)
    cv.part(ellipse(cv.blank(), knee, 2.6, 2.6), JOINT, gloss=False)
    plate(cv, knee, add(foot, (0, -4)), 7.5, ramp)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 4, f[1] - 4), (f[0] + 4, f[1] - 4), (f[0] + 6, f[1]), (f[0] - 5, f[1])]), ramp, gloss=False)


def torso(cv, hip, chest, lean, P):
    a = math.radians(lean)
    R = lambda dx, dy: (hip[0] + dx * math.cos(a) - dy * math.sin(a), hip[1] + dx * math.sin(a) + dy * math.cos(a))
    # 등 뒤 굴뚝 둘(몸통보다 먼저 = 뒤)
    for dx, h in ((-8, 6), (-4, 4)):
        cv.part(chain([R(dx, -16), R(dx - 2, -16 - h)], [3.0, 3.0]), IRON_FAR, gloss=False)
    # 허리 원통 관절
    cv.part(poly(cv.blank(), [R(-5, -2), R(5, -2), R(5, 3), R(-5, 3)]), JOINT, gloss=False)
    # 가슴 갑주: 위가 넓은 통 + 아래 배 판
    cv.part(poly(cv.blank(), [R(-7, -1), R(6, -1), R(9, -8), R(10, -16), R(5, -20), R(-7, -20), R(-11, -15), R(-9, -7)]), IRON)
    cv.line4([R(-8, -8), R(8, -8)], IRON[0])
    for p in ((-6, -18), (3, -18), (-7, -3), (4, -3)):
        cv.pixel(*rnd(R(*p)), RIVET)
    # 화로 창: 테두리 + 타오르는 속
    g = R(1, -13)
    heat = P.extra.get("heat", 0)
    cv.put(ellipse(cv.blank(), g, 3.6, 3.2), INK)
    cv.put(ellipse(cv.blank(), g, 2.6, 2.3), FIRE[1 + min(heat, 1)])
    cv.put(ellipse(cv.blank(), add(g, (0, 0.5)), 1.4, 1.2), FIRE[2 + min(heat, 1)])
    cv.line4([add(g, (-3, 0)), add(g, (3, 0))], INK)  # 화로 창살


def arm(cv, sh, el, hand, far, P):
    ramp = IRON_FAR if far else IRON
    plate(cv, sh, el, 6.5, ramp)
    cv.part(ellipse(cv.blank(), el, 2.4, 2.4), JOINT, gloss=False)
    plate(cv, el, hand, 7.0, ramp)
    # 각진 큰 주먹
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    f = polar(hand, ang, 3)
    pts = [polar(polar(f, ang, 4), ang + 90, 4), polar(polar(f, ang, 4), ang - 90, 4),
           polar(polar(f, ang, -3), ang - 90, 4.5), polar(polar(f, ang, -3), ang + 90, 4.5)]
    cv.part(poly(cv.blank(), pts), ramp)
    cv.line4([polar(polar(f, ang, 1), ang + 90, 3), polar(polar(f, ang, 1), ang - 90, 3)], ramp[0])
    # 둥근 어깨 갑주(팔 위에)
    cv.part(ellipse(cv.blank(), add(sh, (0, 0)), 5.0, 4.4), ramp)
    if not far:
        cv.pixel(*rnd(add(sh, (-1, -2))), RIVET)
    return f


def head(cv, c, tilt, P):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.part(poly(cv.blank(), [R(-4, 3), R(-5, -3), R(-3, -6), R(3, -6), R(6, -3), R(6, 3)]), IRON)
    cv.line4([R(-3, -6), R(3, -6)], IRON[3])
    e = P.extra.get("eye", "open")
    cv.line4([R(0, -2), R(6, -2)], INK)
    if e == "shut":
        cv.line([rnd(R(1, -1)), rnd(R(5, -1))], IRON[0])
    else:
        cv.line([rnd(R(1, -2)), rnd(R(5, -2))], EYE)
        if e == "angry":
            cv.pixel(*rnd(R(5, -2)), WHITE)
    cv.line4([R(1, 1), R(5, 1)], IRON[0])  # 입 격자
    return dict(eye=R(3, -2))


LOOK = Look(leg=leg, torso=torso, arm=arm, head=head, upper=8.0, lower=8.0, thigh=6.0, shin=6.5, hip_w=6.0, shoulder_w=14.0)


def pose(name):
    b = dict(hip=(28, 45), torso=16.0, neck=1.0, foot_near=(34, 0), foot_far=(22, 0))
    if name == "idle_a":
        return Pose(**b, lean=6, arm_near=(75, 90), arm_far=(100, 92), head_tilt=0)
    if name == "idle_b":  # 화로가 숨 쉬듯 밝아지며 어깨가 내려앉는다
        return Pose(**dict(b, hip=(28, 46)), lean=8, arm_near=(80, 96), arm_far=(105, 98), head_tilt=4, extra=dict(heat=1))
    if name == "idle_c":  # 주먹을 고쳐 쥐고 앞으로 기운다
        return Pose(**dict(b, foot_near=(35, 0)), lean=10, arm_near=(55, 80), arm_far=(95, 86), head_tilt=-2)
    if name == "windup":  # 두 주먹을 머리 위로, 화로가 타오른다
        return Pose(**dict(b, hip=(26, 46), foot_near=(33, 0), foot_far=(19, 0)), lean=-6,
                    arm_near=(-80, -60), arm_far=(-110, -90), head_tilt=-10, extra=dict(eye="angry", heat=1))
    if name == "move":  # 김을 뿜으며 무겁게 한 걸음
        return Pose(**dict(b, hip=(31, 45), foot_near=(40, 2), foot_far=(22, 0)), lean=16,
                    arm_near=(40, 70), arm_far=(130, 110), head_tilt=8, extra=dict(eye="angry"))
    if name == "attack":  # 피스톤 주먹을 앞으로 내지른다
        return Pose(**dict(b, hip=(25, 45), foot_near=(35, 0), foot_far=(17, 0)), lean=18,
                    arm_near=(-5, 0), arm_far=(120, 100), head_tilt=8, extra=dict(eye="angry", heat=1))
    if name == "recover":  # 스킬 대지 강타: 두 주먹을 땅에 내리꽂는다
        return Pose(**dict(b, hip=(26, 47), foot_near=(34, 0), foot_far=(17, 0)), lean=30,
                    arm_near=(50, 85), arm_far=(70, 95), head_tilt=12, extra=dict(eye="angry", heat=1))
    if name == "hit":  # 맞고 뒤로 휘청, 화로가 꺼질 듯
        return Pose(**dict(b, hip=(27, 46), foot_near=(33, 0), foot_far=(21, 0)), lean=-14,
                    arm_near=(95, 120), arm_far=(120, 140), head_tilt=-18, extra=dict(eye="shut"))
    raise KeyError(name)


def steam(cv, p, r):
    puff(cv, p, r, STEAM)


def draw_dead(cv):
    """앞으로 고꾸라진 강철 몸: 화로가 꺼지고 마지막 김이 오른다."""
    cv.part(poly(cv.blank(), [(8, 59), (10, 54), (20, 53), (22, 59)]), IRON_FAR)
    cv.part(poly(cv.blank(), [(18, 59), (20, 50), (38, 48), (42, 52), (42, 59)]), IRON)
    cv.put(ellipse(cv.blank(), (30, 54), 2.6, 2.2), INK)
    cv.put(ellipse(cv.blank(), (30, 54), 1.4, 1.2), FIRE[0])
    for p in ((22, 51), (37, 50)):
        cv.pixel(*p, RIVET)
    cv.part(poly(cv.blank(), [(40, 59), (41, 53), (48, 52), (51, 56), (50, 59)]), IRON)
    cv.line4([(43, 55), (49, 55)], INK)
    cv.part(poly(cv.blank(), [(52, 59), (53, 55), (59, 55), (60, 59)]), IRON_FAR, gloss=False)
    steam(cv, (16, 47), 2.4)
    steam(cv, (24, 42), 1.8)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = pose(name)
    if name == "move":
        speed_lines(cv, 2, 9, (32, 38, 44), IRON[2])
    J = draw_body(cv, LOOK, P)
    h = J["hand_n"]
    ch = J["chest"]
    if name == "idle_b":  # 굴뚝 끝에 맺힌 김
        steam(cv, add(ch, (-11, -8)), 1.6)
    elif name == "windup":
        steam(cv, add(ch, (-11, -10)), 2.2)
        for p in ((-6, -6), (6, -4)):
            sparkle(cv, add(h, p), WHITE, FIRE[2])
    elif name == "move":
        puff(cv, (14, 57), 2.4, DUST)
        steam(cv, add(ch, (-12, -9)), 2.0)
    elif name == "attack":
        f = polar(h, 0, 8)
        burst(cv, f, 5.0, FIRE[2], WHITE, spikes=7, rot=10)
        speed_lines(cv, int(ch[0]) - 2, int(ch[0]) + 6, (int(h[1]) - 5, int(h[1]) + 5), STEAM[1])
    elif name == "recover":
        base = (h[0] + 2, GROUND - 1)
        crack(cv, base, [(base[0] + 5, 58), (base[0] + 9, 59), (base[0] + 14, 58), (base[0] + 18, 59)], CRACK)
        for r in (6, 10):
            ring(cv, (base[0] + 2, GROUND + 2), r, -80, -10, FIRE[2] if r == 6 else STEAM[1])
        steam(cv, add(ch, (-12, -10)), 2.6)
        steam(cv, add(base, (-4, -3)), 2.8)
        burst(cv, add(base, (2, -4)), 4.0, FIRE[2], WHITE, spikes=6)
    elif name == "hit":
        hd = J["head"]
        for dx, dy in ((7, -8), (10, -5), (9, -11)):
            cv.pixel(int(hd[0] + dx), int(hd[1] + dy), WHITE)
        cv.part(ellipse(cv.blank(), add(ch, (-13, 6)), 1.4, 1.4), IRON, gloss=False)
    return cv.image()


if __name__ == "__main__":
    run("golem-iron", draw, sys.argv[1:], idle_ms=320)

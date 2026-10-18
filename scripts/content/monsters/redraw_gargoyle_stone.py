#!/usr/bin/env python3
"""돌 가고일(gargoyle-stone) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

푸른 회색 석상 악마: 뒤로 휜 두 뿔, 짐승 주둥이에 송곳니, 붉게 타는 눈, 웅크린 어깨와 굽은 등,
돌 막을 펼친 박쥐 날개(뼈대 능선 + 금), 앞으로 뻗은 갈고리 손, 접힌 짐승 다리, 화살촉 꼬리.
오른쪽(아군)을 보며 낮게 떠서 날개를 친다. 몸 곳곳 금 간 돌결과 이끼 한 점.
6번 칸(스킬 skill_mon_gale_wing): 두 날개를 앞으로 크게 내리쳐 돌 파편 섞인 돌풍을 아군 쪽으로 날린다.

  python3 scripts/content/monsters/redraw_gargoyle_stone.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, arc_trail, burst, chain, ellipse, lerp, polar, poly, puff, ring, rnd, run, slash,
                       sparkle, speed_lines)

INK = (20, 24, 30)
STONE = [(70, 80, 92), (104, 116, 128), (140, 152, 162), (182, 192, 198)]
MEMB = [(62, 58, 78), (92, 86, 110), (120, 114, 138), (120, 114, 138)]
MEMB_FAR = [(44, 42, 58), (62, 58, 78), (74, 70, 92), (74, 70, 92)]
STONE_FAR = [(50, 58, 70), (70, 80, 92), (86, 96, 108), (86, 96, 108)]
HORN = [(120, 110, 96), (170, 160, 140), (210, 202, 182), (210, 202, 182)]
CRACK = (36, 40, 48)
EYE, EYE_HI = (240, 60, 40), (255, 200, 140)
MOSS = (84, 120, 64)
WIND = [(120, 150, 170), (180, 210, 220), (236, 250, 255)]
DUST = [(110, 114, 116), (156, 160, 160)]
WHITE = (255, 252, 240)


def wing(cv, sh, ang, span=24.0, far=False):
    """어깨에서 팔뼈 -> 손목 -> 손가락 뼈 셋을 넓게 펴고 사이를 오목한 막으로. 뼈는 외곽선 없는 돌 능선."""
    k = 0.82 if far else 1.0
    wrist = polar(sh, ang, span * 0.4 * k)
    tips = [polar(wrist, ang + d, span * L * k) for d, L in ((-50, 0.55), (-5, 0.75), (40, 0.7), (82, 0.5))]
    body = polar(sh, ang + 120, 5)
    pts = [sh, wrist, tips[0]]
    seq = tips + [body]
    for a, b in zip(seq, seq[1:]):
        pts.append(lerp(lerp(a, b, 0.5), wrist, 0.22))
        pts.append(b)
    cv.part(poly(cv.blank(), pts), MEMB_FAR if far else MEMB, gloss=False)
    ramp = STONE_FAR if far else STONE
    bone = ramp[1] if far else ramp[2]
    for f in tips:
        cv.line4([rnd(wrist), rnd(f)], bone)
    cv.part(chain([sh, wrist], [3.0, 2.2]), ramp, gloss=False)
    cv.pixel(*rnd(polar(wrist, ang - 90, 2)), HORN[2] if not far else HORN[0])  # 엄지 발톱
    if not far:
        m = lerp(wrist, tips[1], 0.5)
        cv.line([rnd(lerp(m, tips[2], 0.3)), rnd(m), rnd(lerp(m, tips[1], 0.25))], CRACK)
    return wrist


def leg(cv, hip, knee_d, foot_d, far=False):
    """접힌 짐승 다리: 굵은 허벅지 -> 앞 무릎 -> 뒤꿈치 -> 세 발톱."""
    ramp = STONE_FAR if far else STONE
    knee = add(hip, knee_d)
    heel = add(knee, (-2, foot_d[1] * 0.6))
    foot = add(knee, foot_d)
    cv.part(chain([hip, knee], [5.0, 3.6]), ramp, gloss=False)
    cv.part(chain([knee, heel, foot], [3.0, 2.2, 2.0]), ramp, gloss=False)
    for a in (-10, 30, 70):
        cv.line4([rnd(foot), rnd(polar(foot, a, 3))], HORN[0] if far else HORN[1])
    return foot


def arm(cv, sh, el_d, hand_d, far=False, open_=True):
    ramp = STONE_FAR if far else STONE
    el = add(sh, el_d)
    hand = add(el, hand_d)
    cv.part(chain([sh, el], [3.6, 3.0]), ramp, gloss=False)
    cv.part(chain([el, hand], [3.0, 2.6]), ramp, gloss=False)
    ang = math.degrees(math.atan2(hand_d[1], hand_d[0]))
    spread = (-35, 0, 35) if open_ else (-12, 0, 12)
    for d in spread:
        cv.line4([rnd(hand), rnd(polar(hand, ang + d, 3.5))], HORN[0] if far else HORN[2])
    return hand


def tail(cv, hip, lift=0.0):
    p = [add(hip, (-2, 2)), add(hip, (-9, 5)), add(hip, (-14, 2 - lift)), add(hip, (-17, -4 - lift * 1.5))]
    cv.part(chain(p, [3.4, 2.6, 1.8, 1.2]), STONE, gloss=False)
    t = p[-1]
    a = math.degrees(math.atan2(t[1] - p[-2][1], t[0] - p[-2][0]))
    head = [polar(t, a, 4), polar(t, a + 110, 2.5), polar(t, a + 180, 1), polar(t, a - 110, 2.5)]
    cv.part(poly(cv.blank(), head), STONE, gloss=False)


def body(cv, c, tilt, mouth=0, eye="open"):
    def r(dx, dy):
        a = math.radians(tilt)
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 굽은 등 + 가슴: 어깨가 앞으로 솟는다
    cv.part(poly(cv.blank(), [r(-5, -6), r(-1, -10), r(5, -9), r(7, -3), r(5, 4), r(2, 9), r(-3, 9), r(-6, 2)]), STONE)
    # 가슴·배 돌 판 홈
    for y in (-2, 2, 6):
        cv.line([r(1, y), r(4, y - 1)], STONE[0])
    cv.line([r(-5, -4), r(-3, 0), r(-5, 4)], CRACK)
    cv.pixel(*rnd(r(-4, -8)), MOSS)
    cv.pixel(*rnd(r(-3, -8)), MOSS)
    # 머리: 낮게 앞으로 내민 짐승 머리
    hc = r(8, -11)
    # 뿔 둘(뒤로 휘어 위로)
    for dx, col in ((-2, HORN), (1, HORN)):
        b = add(hc, (dx, -3))
        cv.part(chain([b, add(b, (-4, -4)), add(b, (-5, -8))], [2.2, 1.6, 1.0]), col, gloss=False)
    cv.part(poly(cv.blank(), [add(hc, (-4, -3)), add(hc, (2, -4)), add(hc, (5, -2)), add(hc, (8, 0)),
                              add(hc, (8, 2)), add(hc, (3, 3 + mouth * 0.5)), add(hc, (-3, 3))]), STONE)
    # 뾰족 귀
    cv.part(poly(cv.blank(), [add(hc, (-4, -1)), add(hc, (-8, -3)), add(hc, (-4, 1))]), STONE, gloss=False)
    if mouth:
        cv.put(poly(cv.blank(), [add(hc, (2, 2)), add(hc, (7, 2)), add(hc, (6, 2 + mouth)), add(hc, (2, 3 + mouth * 0.6))]), (60, 20, 26))
        cv.pixel(*rnd(add(hc, (6, 3))), HORN[2])
        cv.pixel(*rnd(add(hc, (3, 3))), HORN[2])
    else:
        cv.line([rnd(add(hc, (2, 2))), rnd(add(hc, (7, 2)))], INK)
        cv.pixel(*rnd(add(hc, (6, 3))), HORN[2])
    cv.pixel(*rnd(add(hc, (8, 0))), INK)  # 콧구멍
    e = add(hc, (3, -1))
    if eye == "shut":
        cv.line([rnd(add(e, (-1, 0))), rnd(add(e, (1, 0)))], INK)
    else:
        cv.line([rnd(add(e, (-1, -1))), rnd(add(e, (2, -1)))], INK)  # 찌푸린 눈썹
        cv.pixel(*rnd(e), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI)
    return dict(sh=r(-3, -7), sh_arm=r(4, -6), sh_arm2=r(1, -6), hip=r(-1, 7), head=hc, mouth=add(hc, (8, 2)))


BASE = dict(c=(31.0, 33.0), tilt=8, wing=-125, wfar=-105, span=24.0, mouth=0, eye="open", tail=0.0,
            arm=((5, 5), (5, 0)), arm_far=((4, 6), (5, 1)), open_=False,
            legs=(((4, 5), (0, 6)), ((3, 5), (-1, 6))))


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 날개를 내리쳐 몸이 뜬다
        p.update(c=(30.0, 30.0), wing=-175, wfar=-165, tail=2.0, span=20.0)
    elif name == "idle_c":  # 날개를 반만 들고 가라앉으며 손톱을 편다
        p.update(c=(30.0, 33.0), wing=-150, wfar=-135, tail=-1.0, open_=True, arm=((6, 3), (4, -1)))
    elif name == "windup":  # 날개를 머리 위로 치켜들고 두 손톱을 뒤로 당긴다
        p.update(c=(27.0, 33.0), tilt=-6, wing=-95, wfar=-80, span=23.0, mouth=3, open_=True, tail=3.0,
                 arm=((-3, -5), (-4, -3)), arm_far=((-2, -5), (-3, -4)), legs=(((3, 4), (1, 5)), ((2, 4), (0, 5))))
    elif name == "move":  # 날개를 뒤로 접고 비스듬히 급강하
        p.update(c=(35.0, 33.0), tilt=26, wing=-190, wfar=-185, span=18.0, tail=-2.0, mouth=2,
                 arm=((5, 2), (5, 0)), arm_far=((4, 3), (5, 1)), legs=(((-3, 4), (-4, 3)), ((-4, 4), (-4, 3))))
    elif name == "attack":  # 갈고리 손을 앞으로 휘둘러 할퀸다
        p.update(c=(32.0, 31.0), tilt=12, wing=-115, wfar=-100, mouth=4, open_=True,
                 arm=((6, -1), (6, 3)), arm_far=((6, 2), (5, 4)), legs=(((5, 4), (2, 5)), ((4, 4), (0, 6))))
    elif name == "recover":  # 스킬 돌풍: 두 날개를 앞으로 크게 내리친다
        p.update(c=(26.0, 31.0), tilt=4, wing=40, wfar=15, span=22.0, mouth=5, tail=3.0,
                 arm=((3, 5), (3, 1)), arm_far=((2, 5), (3, 2)))
    elif name == "hit":  # 맞아서 뒤로 젖혀지고 돌 조각이 튄다
        p.update(c=(27.0, 32.0), tilt=-22, wing=-210, wfar=-200, span=19.0, eye="shut", mouth=2, tail=-2.0,
                 arm=((-1, 5), (-3, 3)), arm_far=((0, 5), (-2, 4)), legs=(((5, 5), (3, 5)), ((4, 5), (2, 5))))
    return p


def draw_gargoyle(cv, P):
    c, tilt = P["c"], P["tilt"]
    probe = Canvas(64, INK)
    j = body(probe, c, tilt)
    wing(cv, add(j["sh"], (2, -1)), P["wfar"], P["span"], far=True)
    tail(cv, j["hip"], P["tail"])
    (k1, f1), (k2, f2) = P["legs"]
    leg(cv, add(j["hip"], (3, 0)), k2, f2, far=True)
    arm(cv, j["sh_arm2"], *P["arm_far"], far=True, open_=P["open_"])
    wing(cv, j["sh"], P["wing"], P["span"])
    leg(cv, j["hip"], k1, f1)
    j = body(cv, c, tilt, P["mouth"], P["eye"])
    j["hand"] = arm(cv, j["sh_arm"], *P["arm"], open_=P["open_"])
    return j


def draw_dead(cv):
    """바닥에 부서져 엎어진 석상: 날개 한쪽이 깨져 떨어지고 뿔 하나가 굴러간다."""
    cv.part(poly(cv.blank(), [(10, 58), (14, 50), (22, 47), (26, 52), (24, 59)]), MEMB_FAR, gloss=False)
    cv.line4([(24, 52), (14, 50)], STONE_FAR[1])
    cv.part(poly(cv.blank(), [(22, 59), (24, 52), (32, 50), (42, 51), (46, 59)]), STONE)
    cv.line([(30, 52), (32, 55), (31, 58)], CRACK)
    cv.part(poly(cv.blank(), [(42, 59), (44, 52), (50, 51), (54, 54), (54, 59)]), STONE)
    cv.line([(47, 54), (49, 56)], INK)
    cv.line([(49, 54), (47, 56)], INK)
    cv.part(chain([(44, 52), (42, 48), (40, 46)], [2.0, 1.4, 1.0]), HORN, gloss=False)
    cv.part(chain([(57, 59), (59, 57)], [1.6, 1.0]), HORN, gloss=False)
    for p in ((8, 59), (18, 59)):
        cv.part(ellipse(cv.blank(), p, 1.4, 1.2), STONE, gloss=False)
    puff(cv, (34, 52), 2.2, DUST)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 2, 12, (20, 27, 34), STONE[2])
    j = draw_gargoyle(cv, P)
    h = j["hand"]
    if name == "attack":
        for k in range(3):
            slash(cv, add(h, (2 + k * 3, -9)), add(h, (7 + k * 3, 7)), 3, 2.0, WIND[1], WHITE)
    elif name == "recover":
        for dx, dy, r in ((10, -10, 7), (18, 0, 6), (12, 10, 5)):
            arc_trail(cv, add(j["head"], (dx, dy)), r, -70, 70, 2.4, WIND[1], WIND[2])
        for p, rr in (((52, 20), 1.4), ((56, 34), 1.2), ((50, 44), 1.6)):
            cv.part(ellipse(cv.blank(), p, rr, rr), STONE, gloss=False)
        sparkle(cv, (58, 26), WHITE, WIND[1])
    elif name == "windup":
        ring(cv, add(j["head"], (-6, -4)), 11, 200, 300, WIND[0], 1)
        sparkle(cv, j["head"], EYE_HI, EYE)
    elif name == "hit":
        hd = j["head"]
        for dx, dy in ((8, -6), (10, -2), (9, -10)):
            cv.pixel(hd[0] + dx, hd[1] + dy, WHITE)
        for p in ((hd[0] - 4, hd[1] - 9), (hd[0] + 4, hd[1] - 12)):
            cv.part(ellipse(cv.blank(), p, 1.2, 1.2), STONE, gloss=False)
    return cv.image()


if __name__ == "__main__":
    run("gargoyle-stone", draw, sys.argv[1:], idle_ms=260)

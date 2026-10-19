#!/usr/bin/env python3
"""거대 사마귀(mantis-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

칼날 사마귀(mantis-blade, 에메랄드 몸·강철 낫)와 다른 종: 마른 잎 사마귀. 황갈색·주황 몸에 잎맥 무늬,
앞가슴 위의 넓적한 방패판(마른 잎 모양), 걷는 다리마다 잎 모양 넓은 돌기, 접은 앞다리 끝에 가시 줄 낫(몸과 같은 색),
배 위로 덮은 잎 날개(펼치면 눈알 무늬), 세모 머리 양옆의 큰 겹눈(머리 안, 가까운 눈만 크게)과 짧은 더듬이.
6번 칸(스킬 위협 날개): 날개를 활짝 펼쳐 눈알 무늬를 보이며 앞다리를 들어 올리고, 마른 잎 회오리가 아군 쪽으로.

  python3 scripts/content/monsters/redraw_mantis_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, arc_trail, burst, chain, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (40, 22, 10)
BODY = [(130, 76, 30), (176, 112, 50), (210, 150, 76), (236, 190, 120)]
BODY_FAR = [(100, 58, 24), (130, 76, 30), (150, 88, 36), (150, 88, 36)]
VEIN = (110, 62, 24)
WING = [(150, 90, 40), (196, 132, 64), (226, 172, 100), (226, 172, 100)]
EYESPOT = [(30, 20, 14), (240, 200, 80)]
EYE = (90, 140, 60)
EYE_HI = (220, 255, 190)
LEAF = [(150, 90, 30), (200, 140, 60), (240, 200, 120)]
DUST = [(120, 100, 70), (160, 140, 108)]
WHITE = (255, 250, 236)
G = 60


def walk_leg(cv, hip, foot, far):
    ramp = BODY_FAR if far else BODY
    knee = ik_side(hip, foot, 7, 8, forward=False)
    knee = (knee[0], min(knee[1], hip[1] - 3))
    cv.part(chain([hip, knee], [1.8, 1.6]), ramp, ink=INK, gloss=False)
    mid = lerp(hip, knee, 0.5)
    cv.part(poly(cv.blank(), [add(mid, (-2, 0)), add(mid, (0, -3)), add(mid, (2, 0)), add(mid, (0, 1))]), ramp, ink=INK, gloss=False)  # 잎 돌기
    cv.part(chain([knee, foot], [1.6, 1.0]), ramp, ink=INK, gloss=False)


def raptor(cv, sh, ang1, ang2, far):
    """접는 앞다리: 넓적다리(가시) → 낫(종아리)."""
    ramp = BODY_FAR if far else BODY
    knee = polar(sh, ang1, 8)
    tip = polar(knee, ang2, 8)
    cv.part(chain([sh, knee], [2.8, 2.4]), ramp, ink=INK, gloss=False)
    for t in (0.3, 0.55, 0.8):
        p = lerp(sh, knee, t)
        cv.pixel(*rnd(polar(p, ang1 + 90, 2.2)), INK)
    cv.part(chain([knee, tip], [2.2, 1.0]), ramp, ink=INK, gloss=False)
    cv.pixel(*rnd(polar(tip, ang2 + 120, 1.5)), BODY[3])
    return tip


def mantis(cv, hip=(24, 44), lean=-55, head_tilt=0, r_near=(-30, 120), r_far=(-40, 120), wings=0.0, legs=0.0, jaw=0, eye="open", ab_lift=0):
    # 배(뒤쪽, 위로 살짝 들림) + 잎 날개
    ab_end = add(hip, (-15, -2 - ab_lift))
    cv.part(chain([hip, lerp(hip, ab_end, 0.5), ab_end], [7, 8, 4]), BODY, ink=INK)
    for t in (0.3, 0.55, 0.8):
        p = lerp(hip, ab_end, t)
        cv.line4([rnd(add(p, (0, -2))), rnd(add(p, (0, 3)))], VEIN)
    if wings <= 0.05:
        cv.part(poly(cv.blank(), [add(hip, (2, -4)), add(ab_end, (-2, -3)), add(ab_end, (1, 0)), add(hip, (2, -1))]), WING, ink=INK, gloss=False)
        cv.line4([rnd(add(hip, (1, -3))), rnd(add(ab_end, (0, -2)))], VEIN)
    # 다리 넷(먼 쪽 먼저)
    for far, fx in ((True, (-14, 4)), (False, (-10, 9))):
        for k, dx in enumerate(fx):
            h = add(hip, (2 + k * 3, 1))
            walk_leg(cv, h, (hip[0] + dx + k * 6 + legs * (1 if k else -1), G - (1 if far else 0)), far)
    # 앞가슴(위로 솟는 긴 목) + 방패판
    chest_top = polar(add(hip, (4, -1)), lean, 16)
    cv.part(chain([add(hip, (4, -1)), chest_top], [4, 3]), BODY, ink=INK, gloss=False)
    shield_c = lerp(add(hip, (4, -1)), chest_top, 0.45)
    cv.part(poly(cv.blank(), [polar(shield_c, lean, 6), polar(shield_c, lean + 90, 4), polar(shield_c, lean + 180, 6), polar(shield_c, lean - 90, 4)]), BODY, ink=INK)
    cv.line4([rnd(polar(shield_c, lean, 5)), rnd(polar(shield_c, lean + 180, 5))], VEIN)
    # 먼 앞다리
    raptor(cv, polar(shield_c, lean, 3), r_far[0], r_far[1], True)
    # 세모 머리 + 큰 겹눈
    a = math.radians(head_tilt)
    hc = polar(chest_top, lean, 3)
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    cv.line4([rnd(R(-1, -3)), rnd(R(3, -9)), rnd(R(7, -11))], BODY[0])
    cv.line4([rnd(R(1, -3)), rnd(R(6, -8)), rnd(R(10, -9))], BODY[1])
    cv.part(poly(cv.blank(), [R(-3, -3), R(4, -3), R(6, 2), R(2, 5 + jaw), R(0, 4)]), BODY, ink=INK)
    if jaw:
        cv.put(poly(cv.blank(), [R(2, 3), R(5, 3), R(3, 5 + jaw)]), (110, 30, 30))
    e = rnd(R(2, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (2, 0)), add(e, (1, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0], e[1] - 1, EYE_HI)
        cv.pixel(e[0] + 1, e[1], INK)
    tip = raptor(cv, polar(shield_c, lean, 3), r_near[0], r_near[1], False)
    return dict(eye=e, tip=tip, hip=hip, ab=ab_end)


def open_wings(cv, hip, spread):
    """위협 자세: 날개를 부채처럼 위로 펼치고 눈알 무늬."""
    base = add(hip, (0, -4))
    for k, (a, l) in enumerate(((-150, 18), (-120, 20), (-95, 17))):
        tip = polar(base, a + spread, l)
        cv.part(poly(cv.blank(), [base, polar(base, a - 14 + spread, l * 0.9), tip, polar(base, a + 14 + spread, l * 0.8)]), WING, ink=INK, gloss=False)
        cv.line4([rnd(base), rnd(tip)], VEIN)
    for a in (-135, -105):
        c = polar(base, a + spread, 12)
        cv.put(ellipse(cv.blank(), c, 2.4, 2.4), EYESPOT[1])
        cv.put(ellipse(cv.blank(), c, 1.2, 1.2), EYESPOT[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv.part(chain([(14, 56), (26, 55), (36, 56)], [6, 7, 5]), BODY, ink=INK)
        for x in (18, 23, 28):
            cv.line4([(x, 53), (x, 58)], VEIN)
        cv.part(poly(cv.blank(), [(16, 52), (32, 51), (30, 54)]), WING, ink=INK, gloss=False)
        for x in (20, 26, 32):
            cv.line4([(x, 52), (x - 2, 46), (x + 1, 44)], BODY[1])
        cv.part(chain([(36, 56), (46, 55)], [3, 3]), BODY, ink=INK, gloss=False)
        cv.part(poly(cv.blank(), [(45, 52), (51, 52), (52, 57), (47, 59)]), BODY, ink=INK)
        cv.line([(47, 54), (49, 56)], INK)
        cv.line([(49, 54), (47, 56)], INK)
        raptor(cv, (42, 55), 10, 160, False)
        return cv.image()
    if name == "idle_a":
        mantis(cv)
    elif name == "idle_b":
        mantis(cv, hip=(24, 45), lean=-58, head_tilt=6, r_near=(-25, 125), r_far=(-35, 125), legs=1, ab_lift=1)
    elif name == "idle_c":  # 몸을 좌우로 흔드는 잎 흉내
        mantis(cv, lean=-50, head_tilt=-6, r_near=(-35, 115), r_far=(-45, 115), legs=-1, ab_lift=-1)
    elif name == "windup":  # 낫을 높이 펼친다
        j = mantis(cv, hip=(22, 44), lean=-70, head_tilt=-10, r_near=(-80, -20), r_far=(-95, -30), jaw=1, ab_lift=2)
        sparkle(cv, add(j["tip"], (1, -2)), WHITE, BODY[3])
    elif name == "move":
        speed_lines(cv, 1, 7, (34, 40, 46), BODY[2])
        mantis(cv, hip=(29, 45), lean=-38, head_tilt=10, r_near=(-10, 130), r_far=(-20, 130), legs=3)
        puff(cv, (12, 58), 2.0, DUST)
    elif name == "attack":  # 낫을 앞으로 내리쳐 낚아챈다
        j = mantis(cv, hip=(25, 44), lean=-40, head_tilt=14, r_near=(0, 40), r_far=(-10, 50), jaw=2)
        arc_trail(cv, polar(j["tip"], 220, 8), 8, -70, 40, 2.6, BODY[3], WHITE)
    elif name == "recover":  # 스킬: 위협 날개 + 마른 잎 회오리
        open_wings(cv, (22, 44), 0)
        j = mantis(cv, hip=(22, 44), lean=-65, head_tilt=-4, r_near=(-70, -10), r_far=(-85, -20), jaw=2, wings=1.0, ab_lift=3)
        for k, p in enumerate(((46, 22), (52, 30), (58, 24), (55, 40), (60, 34), (48, 38))):
            col = LEAF[k % 2]
            cv.put(poly(cv.blank(), [add(p, (-2, 1)), add(p, (0, -2)), add(p, (2, -1)), add(p, (0, 2))]), col)
            cv.pixel(*p, LEAF[2])
    elif name == "hit":
        j = mantis(cv, hip=(22, 45), lean=-80, head_tilt=-24, r_near=(-130, 160), r_far=(-140, 170), eye="shut", legs=-2)
        e = j["eye"]
        for dx, dy in ((3, -6), (6, -4), (5, -9)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("mantis-01", draw, sys.argv[1:], idle_ms=210)

#!/usr/bin/env python3
"""망토 무덤 구울(ghoul-grave) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

흙빛 찢긴 망토를 뒤집어쓰고 땅에 붙을 듯 낮게 웅크린 무덤 구울: 망토 깃 사이로 내민 창백한 녹색 얼굴에
길고 굽은 매부리 코, 움푹한 붉은 눈, 가는 송곳니. 망토 아래로 넓은 갈고리 손 둘을 앞으로 내밀고
맨발 뒤꿈치를 든 채 쪼그려 앉는다. 무덤 흙이 망토 자락에 묻어 있다.
엄니 큰 구울(ghoul-01)보다 작고 몸 대부분이 망토에 가려 꼽추 실루엣이다.
6번 칸(스킬 무덤 흙 뿌리기): 망토를 펼치며 두 손으로 무덤 흙과 뼛가루를 앞으로 흩뿌린다.

  python3 scripts/content/monsters/redraw_ghoul_grave.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, slash, sparkle

INK = (18, 16, 12)
CLOAK = [(58, 46, 34), (86, 70, 50), (114, 94, 68), (140, 118, 86)]
CLOAK_FAR = [(42, 34, 26), (58, 46, 34), (72, 58, 42), (72, 58, 42)]
SKIN = [(96, 126, 92), (132, 160, 120), (166, 190, 150), (196, 214, 180)]
SKIN_FAR = [(70, 96, 70), (96, 126, 92), (112, 142, 104), (112, 142, 104)]
EYE, EYE_HI = (220, 40, 40), (255, 170, 150)
FANG = (232, 226, 200)
CLAW = (210, 204, 180)
DIRT = [(76, 58, 40), (120, 94, 64), (160, 132, 96)]
BONEDUST = (226, 218, 190)
GROUND = 60


def hand(cv, wrist, ang, far=False, spread=0):
    ramp = SKIN_FAR if far else SKIN
    cv.part(ellipse(cv.blank(), wrist, 2.6, 2.2), ramp, gloss=False)
    for k in (-50 - spread, -18, 14, 46 + spread):
        f1 = polar(wrist, ang + k, 3.4)
        f2 = polar(f1, ang + k + 55, 2.2)
        cv.line4([rnd(wrist), rnd(f1), rnd(f2)], CLAW if not far else ramp[2])
    return polar(wrist, ang, 5)


def arm(cv, sh, ang1, ang2, far=False, spread=0):
    el = polar(sh, ang1, 6.5)
    wr = polar(el, ang2, 6.5)
    cv.part(chain([sh, el], [4.6, 4.0]), CLOAK_FAR if far else CLOAK, gloss=False)  # 망토 소매
    cv.part(chain([el, wr], [2.8, 2.4]), SKIN_FAR if far else SKIN, gloss=False)
    return hand(cv, wr, ang2, far, spread)


def leg(cv, hip, foot, far=False):
    ramp = SKIN_FAR if far else SKIN
    knee = ik_side(hip, foot, 7.0, 7.5, forward=True)
    cv.part(chain([hip, knee], [3.6, 3.0]), ramp, gloss=False)
    heel = add(foot, (-2, -2))
    cv.part(chain([knee, heel], [2.8, 2.2]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 3, f[1] - 3), (f[0] + 2, f[1] - 1), (f[0] + 3, f[1]), (f[0] - 2, f[1])]), ramp, gloss=False)
    if not far:
        cv.pixel(f[0] + 4, f[1], CLAW)


def face(cv, c, tilt, jaw=1, eye="open"):
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    # 아래턱 + 가는 송곳니
    cv.part(poly(cv.blank(), [R(0, 2), R(6, 3), R(5, 4 + jaw), R(1, 5 + jaw * 0.5)]), SKIN, gloss=False)
    if jaw > 1:
        cv.put(poly(cv.blank(), [R(1, 2), R(6, 2), R(5, 3 + jaw), R(1, 4)]), (90, 24, 30))
    # 얼굴 + 매부리 코(앞으로 길게 휘어 아래로)
    cv.part(poly(cv.blank(), [R(-3, -3), R(2, -5), R(6, -3), R(10, -2), R(11, 1), R(9, 2), R(6, 1), R(4, 2), R(-2, 3)]), SKIN)
    cv.pixel(*rnd(R(10, 1)), SKIN[0])
    for dx in (2, 5):
        cv.line4([rnd(R(dx, 2)), rnd(R(dx, 4))], FANG)
    e = rnd(R(3, -2))
    cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), INK)
    if eye != "shut":
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1] - 1, EYE_HI)
    return dict(eye=R(3, -2), nose=R(11, 0), mouth=R(6, 3))


def cowl(cv, back, neck, hem_x0, hem_x1, flare=0.0, drag=0.0):
    """등에서 둥글게 솟은 망토 + 앞 깃(얼굴을 감싸는 두건 테)."""
    pts = [add(neck, (2, -6)), add(neck, (-3, -10)), add(lerp(back, neck, 0.5), (-2, -10)), add(back, (-4, -7)), add(back, (-9 - flare, -1)), add(back, (-11 - flare, 6)),
           (hem_x0 - drag - flare, GROUND - 1), (hem_x0 - drag + 3, GROUND - 4), (hem_x0 + 5, GROUND - 1),
           (lerp((hem_x0, 0), (hem_x1, 0), 0.6)[0], GROUND - 4), (hem_x1, GROUND - 6), add(neck, (4, 4))]
    M = cv.part(poly(cv.blank(), pts), CLOAK)
    cv.shade_side(M, CLOAK[0], side=-1, depth=3)
    # 등 위 기운 주름 + 흙 얼룩
    cv.line4([add(back, (-3, -3)), add(back, (-6, 6)), (hem_x0 + 2, GROUND - 6)], CLOAK[0])
    for p in ((hem_x0 + 3, GROUND - 3), (hem_x0 + 9, GROUND - 5)):
        cv.pixel(*rnd(p), DIRT[1])
    return M


def draw_ghoul(cv, back=(22, 36), neck=(34, 38), tilt=10, near=(30, 70), far=(20, 60), feet=((36, 0), (24, 0)),
               jaw=1, eye="open", flare=0.0, drag=0.0, spread=0, hem=(10, 40)):
    hip_n, hip_f = add(back, (6, 14)), add(back, (3, 13))
    leg(cv, hip_f, (feet[1][0], GROUND - feet[1][1]), far=True)
    fh = arm(cv, add(neck, (-3, 4)), far[0], far[1], far=True, spread=spread)
    cowl(cv, back, neck, hem[0], hem[1], flare, drag)
    leg(cv, hip_n, (feet[0][0], GROUND - feet[0][1]))
    f = face(cv, add(neck, (4, 0)), tilt, jaw, eye)
    # 두건 앞 테: 얼굴 위를 덮는 망토 끝
    a = math.radians(tilt)
    tip = add(neck, (6 + 6 * math.cos(a), -5 + 6 * math.sin(a)))
    cv.part(poly(cv.blank(), [add(neck, (-3, -8)), add(neck, (2, -8)), tip, add(neck, (5, -3)), add(neck, (-1, -2))]), CLOAK)
    nh = arm(cv, add(neck, (1, 5)), near[0], near[1], spread=spread)
    return dict(hand=nh, far=fh, **f)


POSES = dict(
    idle_a=dict(),
    idle_b=dict(back=(22, 37), neck=(34, 39), tilt=14, near=(40, 80), far=(30, 70), jaw=2),
    idle_c=dict(back=(22, 35), neck=(34, 37), tilt=0, near=(20, 55), far=(10, 45), jaw=1, flare=1),
    windup=dict(back=(19, 38), neck=(30, 40), tilt=-6, near=(150, 120), far=(170, 130), feet=((32, 0), (20, 0)), jaw=3, hem=(8, 36), flare=2),
    move=dict(back=(27, 35), neck=(39, 38), tilt=12, near=(10, 40), far=(0, 30), feet=((46, 3), (24, 0)), jaw=2, drag=5, hem=(15, 45)),
    attack=dict(back=(24, 37), neck=(36, 40), tilt=18, near=(-10, 20), far=(0, 30), feet=((41, 0), (25, 0)), jaw=4, spread=8, hem=(13, 43)),
    recover=dict(back=(20, 33), neck=(31, 34), tilt=-10, near=(-30, -10), far=(-50, -30), feet=((34, 0), (20, 0)), jaw=3, flare=5, spread=10, hem=(6, 40)),
    hit=dict(back=(18, 39), neck=(29, 39), tilt=-30, near=(140, 160), far=(160, 170), feet=((31, 0), (19, 2)), jaw=3, eye="shut", hem=(8, 36)),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv.part(poly(cv.blank(), [(8, 59), (14, 52), (28, 49), (40, 51), (44, 59)]), CLOAK)
        cv.line4([(16, 54), (24, 52), (34, 53)], CLOAK[0])
        cv.part(poly(cv.blank(), [(40, 52), (46, 50), (54, 52), (55, 55), (50, 56), (41, 57)]), SKIN)
        cv.line([(45, 52), (47, 54)], INK)
        cv.line([(47, 52), (45, 54)], INK)
        hand(cv, (37, 58), 10)
        for p in ((22, 58), (12, 58)):
            cv.pixel(*p, DIRT[1])
        return cv.image()
    P = dict(POSES[name])
    j = draw_ghoul(cv, **P)
    if name == "attack":
        h = j["hand"]
        for k in (-3, 0, 3):
            slash(cv, add(h, (k - 2, -9)), add(h, (2 + k, 6)), 2, 2.0, (130, 30, 34), (240, 196, 186))
    elif name == "recover":
        # 두 손에서 앞으로 퍼지는 무덤 흙·뼛가루 부채
        h = j["hand"]
        cv.line4([h, (58, h[1] - 6)], DIRT[1])
        cv.line4([h, (60, h[1] + 8)], DIRT[1])
        for t, r, dy in ((0.2, 2.0, 0), (0.5, 2.8, -3), (0.55, 2.4, 5), (0.85, 3.2, -5), (0.9, 3.0, 6)):
            c = add(lerp(h, (58, h[1]), t), (0, dy))
            puff(cv, c, r, DIRT[:2])
        for p in ((44, h[1] - 6), (50, h[1] + 9), (56, h[1] - 9), (58, h[1] + 2), (53, h[1] - 1)):
            cv.pixel(*rnd(p), BONEDUST)
    elif name == "windup":
        sparkle(cv, add(j["eye"], (2, -6)), (255, 240, 230), EYE)
    elif name == "move":
        puff(cv, (12, 57), 2.4, DIRT[:2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -7), (8, -4), (3, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), (255, 250, 236))
    return cv.image()


if __name__ == "__main__":
    run("ghoul-grave", draw, sys.argv[1:], idle_ms=230)

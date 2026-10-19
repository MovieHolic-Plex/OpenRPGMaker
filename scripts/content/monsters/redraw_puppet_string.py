#!/usr/bin/env python3
"""줄에 매달린 도자기 얼굴 인형(puppet-string) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

칸 꼭대기의 나무 십자 조종대에서 내려온 실 네 가닥(머리·두 손·무릎)에 매달려 발끝이 땅에 닿을 듯 떠 있는 인형:
금 간 흰 도자기 얼굴(옆얼굴, 머리 안 앞쪽의 둥근 검은 눈과 붉은 볼, 바느질 입), 검은 단발머리와 붉은 리본,
공 관절로 이어진 팔다리(관절마다 둥근 마디), 남색 원피스와 흰 레이스 깃, 작은 검은 구두.
6번 칸(스킬 저주의 실): 조종대가 기울며 인형이 두 팔을 앞으로 뻗고, 손끝에서 보라 실이 아군 쪽으로 뻗어 감는다.

  python3 scripts/content/monsters/redraw_puppet_string.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, rnd, run, sparkle

INK = (26, 20, 30)
PORC = [(196, 190, 196), (234, 230, 232), (250, 248, 248), (255, 255, 255)]
DRESS = [(30, 34, 80), (48, 56, 120), (74, 84, 156), (100, 112, 180)]
LACE = (246, 244, 236)
HAIR = [(20, 16, 20), (40, 34, 40), (64, 56, 64), (64, 56, 64)]
RIBBON = (190, 40, 50)
CHEEK = (236, 150, 160)
EYE = (16, 12, 16)
EYE_HI = (200, 220, 255)
WOOD = [(90, 60, 34), (130, 90, 52), (164, 120, 76), (164, 120, 76)]
STRING = (150, 146, 170)
CURSE = [(90, 40, 140), (160, 90, 220), (230, 200, 255)]
CRACK = (120, 110, 120)
WHITE = (255, 255, 255)


def joint(cv, p, r=1.6):
    cv.part(ellipse(cv.blank(), p, r, r), PORC, ink=INK, gloss=False)


def limb(cv, a, b, w=2.2):
    cv.part(chain([a, b], [w, w * 0.9]), PORC, ink=INK, gloss=False)


def puppet(cv, c=(32, 32), tilt=0, bar_tilt=0, sway=0, arms=((60, 80), (110, 90)), legs=((80, 95), (100, 90)), eye="open", mouth=0, slack=0):
    # 조종대(칸 꼭대기)
    bar_c = (c[0] + sway * 0.5, 5)
    a = math.radians(bar_tilt)
    bl, br = (bar_c[0] - 10 * math.cos(a), bar_c[1] - 10 * math.sin(a)), (bar_c[0] + 10 * math.cos(a), bar_c[1] + 10 * math.sin(a))
    cv.part(chain([bl, br], [2.4, 2.4]), WOOD, ink=INK, gloss=False)
    cv.part(chain([(bar_c[0], 3), (bar_c[0], 8)], [2.2, 2.2]), WOOD, ink=INK, gloss=False)
    hc = add(c, (0, -11))
    hip = add(c, (0, 6))
    sh = add(c, (0, -4))
    # 먼 다리·팔
    kf = polar(add(hip, (-1, 0)), legs[1][0], 6)
    ff = polar(kf, legs[1][1], 6)
    limb(cv, add(hip, (-1, 0)), kf)
    limb(cv, kf, ff)
    joint(cv, kf)
    ef = polar(add(sh, (-2, 0)), arms[1][0], 5)
    hf = polar(ef, arms[1][1], 5)
    limb(cv, add(sh, (-2, 0)), ef, 2)
    limb(cv, ef, hf, 2)
    joint(cv, ef, 1.4)
    # 원피스(몸통 + 퍼진 치마)
    body = [add(sh, (-4, -1)), add(sh, (4, -1)), add(hip, (3, -3)), add(hip, (7 + slack, 4)), add(hip, (2, 5)), add(hip, (-3, 5)), add(hip, (-8 + slack, 4)), add(hip, (-3, -3))]
    cv.part(poly(cv.blank(), body), DRESS, ink=INK)
    cv.line4([rnd(add(hip, (-7 + slack, 3))), rnd(add(hip, (6 + slack, 3)))], LACE)
    cv.part(poly(cv.blank(), [add(sh, (-4, -1)), add(sh, (4, -1)), add(sh, (3, 2)), add(sh, (-3, 2))]), [LACE] * 4, ink=INK, gloss=False)
    # 가까운 다리 + 구두
    kn = polar(add(hip, (1, 0)), legs[0][0], 6)
    fn = polar(kn, legs[0][1], 6)
    limb(cv, add(hip, (1, 0)), kn)
    limb(cv, kn, fn)
    joint(cv, kn)
    for f in (ff, fn):
        cv.part(ellipse(cv.blank(), add(f, (1, 0)), 2.2, 1.4), HAIR, ink=INK, gloss=False)
    # 머리
    t = math.radians(tilt)
    R = lambda dx, dy: (hc[0] + dx * math.cos(t) - dy * math.sin(t), hc[1] + dx * math.sin(t) + dy * math.cos(t))
    cv.part(poly(cv.blank(), [R(-6, 4), R(-7, -3), R(-3, -7), R(3, -7), R(6, -4), R(5, 0), R(-2, 0), R(-2, 5)]), HAIR, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), R(1, 0), 5.5, 5.5), PORC, ink=INK)
    cv.part(poly(cv.blank(), [R(-5, -2), R(-3, -6), R(3, -6), R(6, -3), R(2, -3), R(-2, -1)]), HAIR, ink=INK, gloss=False)  # 앞머리
    cv.part(poly(cv.blank(), [R(-4, -6), R(-8, -9), R(-7, -4)]), [RIBBON] * 4, ink=INK, gloss=False)
    cv.line4([rnd(R(-1, 1)), rnd(R(1, 4))], CRACK)  # 금
    cv.pixel(*rnd(R(2, 3)), CHEEK)
    if mouth:
        cv.line([rnd(R(3, 4)), rnd(R(5, 4 + mouth * 0.5))], (120, 30, 40))
    else:
        cv.line4([rnd(R(3, 4)), rnd(R(5, 4))], (140, 60, 70))
    e = rnd(R(3, -1))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (0, -1)), add(e, (0, 1)), add(e, (-1, 1))]), EYE)
        cv.pixel(e[0] - 1, e[1] - 1, EYE_HI)
    # 가까운 팔
    en = polar(add(sh, (2, 0)), arms[0][0], 5)
    hn = polar(en, arms[0][1], 5)
    limb(cv, add(sh, (2, 0)), en, 2)
    limb(cv, en, hn, 2)
    joint(cv, en, 1.4)
    joint(cv, hn, 1.3)
    # 실(조종대 → 머리·손·무릎): 인형 몸 뒤로 지나가게 빈 칸에만 찍는다(얼굴을 가리지 않는다)
    body = cv.a.copy()
    tmp = Canvas(cv.S, INK)
    for start, end in ((bar_c, R(0, -6)), (bl, hf), (br, hn), (lerp(bl, br, 0.75), kn)):
        tmp.line4([rnd(start), rnd(end)], STRING)
    free = tmp.a & ~body
    cv.rgb[free] = STRING
    cv.a |= free
    return dict(eye=e, hand=hn, hand_far=hf, head=hc)


def draw_dead(cv):
    cv.part(chain([(10, 56), (20, 57)], [2, 2]), PORC, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [(18, 59), (22, 52), (36, 52), (40, 59)]), DRESS, ink=INK)
    cv.line4([(19, 58), (39, 58)], LACE)
    cv.part(ellipse(cv.blank(), (45, 54), 5, 5), PORC, ink=INK)
    cv.part(poly(cv.blank(), [(40, 52), (43, 49), (49, 50), (46, 52)]), HAIR, ink=INK, gloss=False)
    cv.line4([(44, 51), (47, 57)], CRACK)
    cv.line([(46, 53), (48, 55)], EYE)
    cv.line([(48, 53), (46, 55)], EYE)
    cv.part(chain([(26, 45), (34, 45)], [2.2, 2.2]), WOOD, ink=INK, gloss=False)
    for x0, x1 in ((26, 22), (34, 38)):
        cv.line4([(x0, 46), (x1, 52)], STRING)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        puppet(cv)
    elif name == "idle_b":
        puppet(cv, c=(32, 34), tilt=8, bar_tilt=6, sway=2, arms=((70, 95), (115, 100)), legs=((85, 100), (95, 85)), slack=1)
    elif name == "idle_c":
        puppet(cv, c=(31, 31), tilt=-8, bar_tilt=-6, sway=-2, arms=((50, 70), (105, 80)), legs=((75, 90), (105, 95)), slack=-1)
    elif name == "windup":  # 실이 당겨져 팔다리가 위로 들린다
        j = puppet(cv, c=(29, 34), tilt=-14, bar_tilt=-14, sway=-4, arms=((-100, -60), (-120, -80)), legs=((60, 100), (120, 80)), mouth=2)
        sparkle(cv, add(j["hand"], (2, -2)), WHITE, CURSE[2])
    elif name == "move":  # 조종대째 앞으로 미끄러지며 다리가 뒤로 끌린다
        puppet(cv, c=(36, 32), tilt=16, bar_tilt=10, sway=6, arms=((20, 40), (150, 120)), legs=((130, 110), (150, 120)), slack=-3)
    elif name == "attack":  # 팔을 앞으로 휘둘러 할퀸다
        j = puppet(cv, c=(34, 32), tilt=12, bar_tilt=8, sway=3, arms=((0, -10), (40, 20)), legs=((100, 80), (70, 100)), mouth=3)
        burst(cv, add(j["hand"], (3, 0)), 4.0, CURSE[1], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 손끝에서 보라 저주의 실
        j = puppet(cv, c=(26, 33), tilt=6, bar_tilt=-10, sway=-2, arms=((-10, 0), (5, 10)), legs=((80, 95), (100, 90)), mouth=4)
        for h, end, mid in ((j["hand"], (61, 26), (48, 18)), (j["hand_far"], (60, 46), (46, 48))):
            pts = bezier(h, mid, end, 8)
            cv.line(pts, CURSE[1], width=2)
            cv.line(pts[2:7], CURSE[2])
        for k, r in enumerate((3, 4)):
            pts = [polar((57, 36), a, r) for a in range(0, 361, 45)]
            cv.line(pts, CURSE[k])
        sparkle(cv, (57, 36), WHITE, CURSE[2], big=True)
    elif name == "hit":
        j = puppet(cv, c=(30, 34), tilt=-30, bar_tilt=18, sway=-5, arms=((140, 170), (-160, -140)), legs=((50, 70), (120, 140)), eye="shut", slack=2)
        e = j["eye"]
        for dx, dy in ((5, -6), (8, -4), (7, -9)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("puppet-string", draw, sys.argv[1:], idle_ms=230)

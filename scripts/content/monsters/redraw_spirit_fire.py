#!/usr/bin/env python3
"""불의 정령(spirit-fire) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

땅에서 떠 있는 불꽃 몸: 둥근 가슴 핵에서 위로 갈라져 솟는 불길 머리, 아래로 가늘게 꼬이는 불꼬리,
몸 양옆 불꽃 팔 둘. 하얗게 타는 두 눈과 입. 바닥에 주황 그림자 원.
3겹 불색(진홍 → 주황 → 노랑) + 흰 심지, 외곽은 짙은 숯빛 1px.
6번 칸(스킬 skill_mon_flame_burst): 두 팔을 하늘로 쳐들며 몸이 부풀고, 아군 쪽 바닥에서 불기둥이 솟는다.

  python3 scripts/content/monsters/redraw_spirit_fire.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, flame, lerp, polar, poly, rnd, run, sparkle

FIRE = dict(
    ink=(60, 16, 10),
    outer=(196, 40, 24), mid=(244, 120, 30), inner=(255, 206, 70), core=(255, 250, 210),
    eye=(255, 255, 255), pupil=(120, 30, 10), shadow=(90, 30, 24),
    fx=[(196, 40, 24), (244, 120, 30), (255, 206, 70), (255, 250, 210)],
)


def body_mask(cv, c, h, w, sway, seed, arms):
    """불꽃 몸 윤곽(다각형 점): 머리 불길 셋 + 몸통 + 꼬리, 팔 둘."""
    pts = []
    # 오른쪽 아래 → 꼬리 → 왼쪽 → 머리 불길 → 오른쪽
    tail = add(c, (-3 + sway * 0.5, h * 0.95))
    pts += [add(c, (w * 0.5, h * 0.15)), add(c, (w * 0.3, h * 0.55)), tail, add(c, (-w * 0.35, h * 0.5)), add(c, (-w * 0.55, h * 0.1))]
    for i, (dx, hh) in enumerate(((-0.45, 0.7), (-0.1, 1.05), (0.3, 0.8))):
        k = 1 + 0.15 * math.sin(seed * 1.7 + i * 2.1)
        base_l = add(c, (w * (dx - 0.18), -h * 0.15))
        tip = add(c, (w * dx + sway * (1 + i * 0.3), -h * hh * k))
        pts += [base_l, tip]
    pts += [add(c, (w * 0.5, -h * 0.2))]
    return pts


def draw_spirit(cv, pal, c, h=16.0, w=18.0, sway=0.0, seed=0, arms=((20, 10), (160, 10)), eyes="open", mouth=1, swell=0.0):
    w += swell
    h += swell * 0.6
    # 팔(뒤쪽 먼저): 각도, 길이
    hands = []
    for k, (ang, ln) in enumerate(arms):
        s = add(c, ((w * 0.38) if k == 0 else (-w * 0.38), 0))
        e = polar(s, ang, ln * 0.55)
        hnd = polar(e, ang + (25 if k == 0 else -25), ln * 0.5)
        hands.append(hnd)
        cv.part(chain([s, e, hnd], [5.0, 3.6, 2.4]), [pal["outer"], pal["mid"], pal["inner"], pal["core"]], ink=pal["ink"], gloss=False)
        # 손끝 불티(물은 물방울)
        if pal.get("style") == "wave":
            cv.put(ellipse(cv.blank(), add(hnd, (0, -1)), 1.4, 1.6), pal["inner"])
        else:
            flame(cv, add(hnd, (0, 1)), 4, 3, [pal["mid"], pal["inner"]], tongues=1, seed=seed + k)
    if pal.get("style") == "wave":
        # 물: 둥근 물방울 몸 + 뒤로 말린 물결 볏, 안쪽은 동그란 물결무늬와 거품
        body = [add(c, (w * 0.5, h * 0.1)), add(c, (w * 0.32, h * 0.6)), add(c, (-2 + sway * 0.4, h * 0.95)),
                add(c, (-w * 0.34, h * 0.55)), add(c, (-w * 0.5, h * 0.05)), add(c, (-w * 0.42, -h * 0.4)),
                add(c, (-w * 0.1 + sway * 0.5, -h * 0.7)), add(c, (w * 0.25 + sway, -h * 0.75)),
                add(c, (w * 0.42 + sway, -h * 0.5)), add(c, (w * 0.5, -h * 0.15))]
        cv.part(poly(cv.blank(), body), [pal["outer"], pal["mid"], pal["mid"], pal["inner"]], ink=pal["ink"], gloss=False)
        crest = [add(c, (w * 0.05 + sway, -h * 0.65)), add(c, (-w * 0.3 + sway * 1.3, -h * 0.98)),
                 add(c, (-w * 0.62 + sway * 1.5, -h * 0.82)), add(c, (-w * 0.5 + sway * 1.4, -h * 0.62))]
        cv.part(chain(crest, [3.6, 3.0, 2.2, 1.6]), [pal["outer"], pal["mid"], pal["inner"], pal["core"]], ink=pal["ink"], gloss=False)
        cv.put(ellipse(cv.blank(), add(c, (-1, h * 0.25)), w * 0.3, h * 0.3), pal["inner"])
        cv.put(ellipse(cv.blank(), add(c, (-2, h * 0.2)), w * 0.13, h * 0.14), pal["core"])
        for p in ((-w * 0.3, -h * 0.2), (-w * 0.18, h * 0.55), (w * 0.2, h * 0.4)):
            cv.pixel(*rnd(add(c, p)), pal["core"])
    else:
        cv.part(poly(cv.blank(), body_mask(cv, c, h, w, sway, seed, arms)), [pal["outer"], pal["mid"], pal["mid"], pal["inner"]], ink=pal["ink"], gloss=False)
        # 안쪽 층: 주황 → 노랑 → 흰 심지(작게 겹친 불꽃)
        flame(cv, add(c, (0, h * 0.55)), h * 1.2, w * 0.72, [pal["mid"], pal["inner"]], lean=sway * 0.2, tongues=3, seed=seed)
        cv.put(ellipse(cv.blank(), add(c, (0, h * 0.2)), w * 0.18, h * 0.22), pal["core"])
    # 얼굴(오른쪽으로 치우침)
    f = add(c, (3 + sway * 0.3, -h * 0.05))
    for dx in (0, 5):
        e = rnd(add(f, (dx, 0)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], pal["pupil"])
        elif eyes == "angry":
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, 0)), add(e, (1, 1)), add(e, (-1, 1))]), pal["eye"])
            cv.pixel(e[0], e[1], pal["pupil"])
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), pal["eye"])
            cv.pixel(e[0] + (1 if dx else 0), e[1], pal["pupil"])
    m = rnd(add(f, (3, 4)))
    if mouth >= 2:
        cv.put(ellipse(cv.blank(), m, 1.5, mouth * 0.6), pal["pupil"])
    else:
        cv.line([add(m, (-1, 0)), add(m, (1, 0))], pal["pupil"])
    return dict(hands=hands, face=f, top=add(c, (0, -h)))


POSES = dict(
    idle_a=dict(c=(30, 36), sway=0, seed=0, arms=((30, 10), (150, 10))),
    idle_b=dict(c=(30, 34), sway=2, seed=1, arms=((10, 11), (170, 11)), swell=1.0),
    idle_c=dict(c=(30, 35), sway=-2, seed=2, arms=((45, 10), (135, 10)), mouth=2),
    windup=dict(c=(27, 34), sway=-4, seed=3, arms=((-70, 12), (-110, 12)), eyes="angry", mouth=2, swell=2.0),
    move=dict(c=(35, 36), sway=-6, seed=4, arms=((0, 12), (190, 9)), eyes="angry", h=14, w=20),
    attack=dict(c=(37, 36), sway=4, seed=5, arms=((-10, 14), (160, 9)), eyes="angry", mouth=3),
    recover=dict(c=(27, 34), sway=0, seed=6, arms=((-80, 13), (-100, 13)), eyes="angry", mouth=3, swell=3.0),
    hit=dict(c=(25, 37), sway=6, seed=7, arms=((60, 9), (120, 9)), eyes="shut", mouth=2, h=13, w=16),
)


def make_draw(pal, fx):
    def draw(name):
        cv = Canvas(64, pal["ink"])
        if name == "dead":
            # 꺼져 가는 잿불 무더기 + 연기
            cv.put(ellipse(cv.blank(), (32, 58), 9, 1.2), pal["shadow"])
            cv.part(poly(cv.blank(), [(24, 58), (28, 53), (32, 55), (36, 52), (40, 58)]), [pal["outer"], pal["outer"], pal["mid"], pal["mid"]], ink=pal["ink"], gloss=False)
            for p in ((30, 56), (35, 55)):
                cv.pixel(*p, pal["inner"])
            fx["dead"](cv)
            return cv.image()
        P = POSES[name]
        j = draw_spirit(cv, pal, **P)
        fx[name](cv, j) if name in fx else None
        return cv.image()
    return draw


def fire_fx():
    F = FIRE["fx"]

    def windup(cv, j):
        for hnd in j["hands"]:
            sparkle(cv, add(hnd, (0, -4)), F[3], F[2])

    def move(cv, j):
        for y in (30, 37, 44):
            cv.line([(4, y), (12, y)], F[1])

    def attack(cv, j):
        h = j["hands"][0]
        fb = (min(h[0] + 6, 55), h[1] + 1)
        cv.put(ellipse(cv.blank(), fb, 4.0, 3.2), F[1])
        cv.put(ellipse(cv.blank(), fb, 2.4, 2.0), F[2])
        cv.pixel(*rnd(fb), F[3])
        burst(cv, fb, 6.0, F[2], F[3], spikes=6)

    def recover(cv, j):
        # 아군 쪽 바닥(오른쪽)에서 솟는 불기둥 + 손 위 불덩이
        flame(cv, (54, 58), 22, 9, F, lean=0.3, tongues=3, seed=1)
        flame(cv, (45, 58), 12, 6, F[:3], tongues=2, seed=4)
        for hnd in j["hands"]:
            cv.put(ellipse(cv.blank(), add(hnd, (0, -3)), 2.4, 2.4), F[2])
            cv.pixel(*rnd(add(hnd, (0, -3))), F[3])
        sparkle(cv, (48, 22), F[3], F[2], big=True)

    def hit(cv, j):
        t = j["top"]
        for dx, dy in ((8, -2), (10, 2), (12, -4)):
            cv.pixel(int(t[0] + dx), int(t[1] + dy + 6), (255, 255, 255))
        for p in ((10, 30), (8, 36), (12, 40)):
            cv.pixel(*p, F[1])

    def dead(cv):
        for x, y in ((28, 46), (33, 42), (30, 38)):
            cv.put(ellipse(cv.blank(), (x, y), 1.8, 1.4), (90, 80, 80))
        cv.pixel(31, 36, (130, 120, 116))
    return dict(windup=windup, move=move, attack=attack, recover=recover, hit=hit, dead=dead)


if __name__ == "__main__":
    run("spirit-fire", make_draw(FIRE, fire_fx()), sys.argv[1:], idle_ms=110)

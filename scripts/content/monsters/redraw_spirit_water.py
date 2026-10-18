#!/usr/bin/env python3
"""물의 정령(spirit-water) 전투 시트: redraw_spirit_fire.py 의 떠 있는 정령 몸·포즈를 물빛 팔레트로 쓴다.

솟구치는 물결 머리, 몸 속 흰 물보라 심지, 손끝 물방울. 공격은 물덩이를 던지고,
6번 칸(스킬 skill_mon_tidal_wave): 두 팔을 쳐들어 아군 쪽 바닥에서 소용돌이 물기둥을 일으킨다.

  python3 scripts/content/monsters/redraw_spirit_water.py [--preview DIR]
"""
from __future__ import annotations

import sys

from pixel_lib import add, burst, ellipse, poly, rnd, run, sparkle
from redraw_spirit_fire import make_draw

WATER = dict(
    ink=(14, 26, 60), style="wave",
    outer=(30, 76, 160), mid=(56, 140, 214), inner=(130, 206, 240), core=(236, 252, 255),
    eye=(255, 255, 255), pupil=(14, 30, 80), shadow=(20, 40, 80),
    fx=[(30, 76, 160), (56, 140, 214), (130, 206, 240), (236, 252, 255)],
)


def water_fx():
    F = WATER["fx"]

    def drop(cv, p, r=1.6):
        cv.put(ellipse(cv.blank(), p, r, r * 1.2), F[1])
        cv.pixel(*rnd(add(p, (-0.5, -0.5))), F[3])

    def windup(cv, j):
        for hnd in j["hands"]:
            drop(cv, add(hnd, (0, -4)), 2.0)

    def move(cv, j):
        for y in (30, 37, 44):
            cv.line([(4, y), (12, y)], F[2])
        drop(cv, (9, 50))

    def attack(cv, j):
        h = j["hands"][0]
        fb = (min(h[0] + 6, 55), h[1] + 1)
        cv.put(ellipse(cv.blank(), fb, 4.0, 3.2), F[1])
        cv.put(ellipse(cv.blank(), fb, 2.4, 2.0), F[2])
        cv.pixel(*rnd(add(fb, (-1, -1))), F[3])
        burst(cv, fb, 6.0, F[2], F[3], spikes=6)

    def recover(cv, j):
        # 아군 쪽(오른쪽) 바닥에서 말려 오르는 큰 물결
        wave = [(40, 58), (44, 50), (48, 40), (53, 33), (58, 32), (60, 36), (57, 37), (55, 41), (58, 50), (60, 58)]
        cv.part(poly(cv.blank(), wave), [F[0], F[1], F[1], F[2]], ink=WATER["ink"], gloss=False)
        for p in ((47, 52), (51, 45), (54, 38)):
            cv.line([p, add(p, (2, -1))], F[2])
        for p in ((52, 33), (55, 32), (59, 34)):
            cv.pixel(*p, F[3])
        for hnd in j["hands"]:
            drop(cv, add(hnd, (0, -3)), 2.2)
        sparkle(cv, (47, 24), F[3], F[2], big=True)

    def hit(cv, j):
        t = j["top"]
        for dx, dy in ((8, -2), (10, 2), (12, -4)):
            cv.pixel(int(t[0] + dx), int(t[1] + dy + 6), (255, 255, 255))
        for p in ((10, 32), (12, 40)):
            drop(cv, p, 1.2)

    def dead(cv):
        # 물웅덩이 위 거품
        for x, y in ((28, 48), (34, 45)):
            cv.put(ellipse(cv.blank(), (x, y), 1.6, 1.6), F[2])
            cv.pixel(x - 1, y - 1, F[3])
    return dict(windup=windup, move=move, attack=attack, recover=recover, hit=hit, dead=dead)


if __name__ == "__main__":
    run("spirit-water", make_draw(WATER, water_fx()), sys.argv[1:], idle_ms=150)

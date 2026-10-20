#!/usr/bin/env python3
"""금빛 불꽃등 붉은 도마뱀(salamander-flame) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

목지느러미 도롱뇽(redraw_salamander_01.py)의 낮게 깔린 사지 벌린 몸(draw_lizard)을 쓰되 생김새는 불도마뱀으로 새로:
붉은 피부에 검은 띠 무늬, 주황 배, 아가미 대신 머리 뒤로 뻗은 짧은 뿔 두 개, 등 볏 대신 등줄기를 따라 타오르는 금빛 불꽃,
꼬리 끝의 불씨, 머리 안의 노란 눈.
6번 칸(스킬 화염 숨): 앞몸을 들고 아군 쪽으로 불길을 길게 뿜는다(등 불꽃도 크게 솟음).

  python3 scripts/content/monsters/redraw_salamander_flame.py [--preview DIR]
"""
from __future__ import annotations

import sys

from redraw_salamander_01 import draw_lizard
from pixel_lib import Canvas, add, burst, chain, flame, polar, puff, rnd, run, sparkle, speed_lines

L = dict(
    ink=(36, 10, 8),
    skin=[(130, 30, 22), (180, 52, 34), (214, 86, 52), (240, 130, 90)],
    far=[(96, 22, 16), (130, 30, 22), (150, 38, 26), (150, 38, 26)],
    belly=(246, 170, 90),
    spot=(40, 14, 10),
    crest=None,
    gill=None,
    eye=(255, 220, 70),
    mouth=(90, 20, 10),
)
HORN = [(70, 50, 40), (110, 86, 70), (150, 126, 106), (150, 126, 106)]
FIRE = [(220, 80, 20), (255, 170, 40), (255, 240, 150)]
DUST = [(110, 96, 84), (150, 136, 120)]
WHITE = (255, 250, 230)


def back_fire(h):
    def back(cv, pts):
        for k, p in enumerate(pts[1:]):
            flame(cv, add(p, (0, -1)), h * (0.6 + 0.15 * k) + 2, 4, FIRE, lean=-0.4, tongues=2, seed=k)
    return back


def horns(cv, R):
    for k, (b, t) in enumerate((((-3, -3), (-10, -7)), ((-1, -3), (-7, -9)))):
        cv.part(chain([R(*b), R(*t)], [2.4, 0.8]), HORN, ink=L["ink"], gloss=False)


def draw(name):
    cv = Canvas(64, L["ink"])
    b = back_fire(6)
    if name == "dead":  # 불이 꺼진 채 늘어짐(불씨 연기만)
        j = draw_lizard(cv, L, x=32, head_tilt=10, eye="shut", tail_sw=-4, head_extra=horns)
        puff(cv, (28, 46), 2.2, DUST)
        return cv.image()
    if name == "idle_a":
        draw_lizard(cv, L, back=b, head_extra=horns)
    elif name == "idle_b":
        draw_lizard(cv, L, lift=1, head_tilt=-4, tail_sw=3, back=back_fire(7), head_extra=horns)
    elif name == "idle_c":
        draw_lizard(cv, L, head_tilt=4, tail_sw=-3, jaw=1, back=back_fire(5), head_extra=horns)
    elif name == "windup":
        j = draw_lizard(cv, L, x=28, lift=5, head_tilt=-10, jaw=3, tail_sw=4, back=back_fire(9), head_extra=horns)
        sparkle(cv, add(j["eye"], (2, -6)), WHITE, FIRE[1])
    elif name == "move":
        speed_lines(cv, 1, 6, (40, 46, 52), L["skin"][2])
        draw_lizard(cv, L, x=35, tail_sw=6, step=3, back=back_fire(5), head_extra=horns)
        puff(cv, (8, 58), 2.0, DUST)
    elif name == "attack":
        j = draw_lizard(cv, L, x=33, lift=2, head_tilt=6, jaw=4, step=-2, back=b, head_extra=horns)
        burst(cv, add(j["mouth"], (3, 0)), 4.0, FIRE[1], FIRE[2], spikes=6)
    elif name == "recover":  # 스킬: 화염 숨
        j = draw_lizard(cv, L, x=22, lift=6, head_tilt=-14, jaw=4, tail_sw=3, back=back_fire(10), head_extra=horns)
        m = j["mouth"]
        for k, (dx, w) in enumerate(((6, 5), (14, 8), (22, 10))):
            p = (min(60, m[0] + dx), m[1] - 1)
            flame(cv, (p[0], p[1] + w / 2), w * 0.9, w, FIRE, lean=0.6, tongues=2, seed=k)
        cv.line([rnd(m), (61, int(m[1]) - 3)], FIRE[2], width=2)
    elif name == "hit":
        j = draw_lizard(cv, L, x=27, lift=3, head_tilt=-26, jaw=1, eye="shut", tail_sw=-5, back=back_fire(4), head_extra=horns)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("salamander-flame", draw, sys.argv[1:], idle_ms=180)

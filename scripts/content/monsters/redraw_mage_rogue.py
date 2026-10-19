#!/usr/bin/env python3
"""보라 지팡이 후드 마법사(mage-rogue) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅을 딛고 선 사람 마법사(떠 있는 망령과 다르다): 앞으로 늘어진 보라 후드 아래 그늘진 얼굴에 창백한 턱과
빛나는 청록 눈(후드 구멍 안, 얼굴 축 위), 바닥까지 닿는 긴 보라 로브(금색 단 장식·허리 띠·늘어진 소매),
로브 밑으로 보이는 갈색 장화, 먼 손의 마도서, 가까운 손에 꼭대기에 보라 수정을 낀 비틀린 나무 지팡이.
6번 칸(스킬 비전 화살): 지팡이를 아군 쪽으로 겨눠 수정에서 보라 비전 화살 세 갈래가 날아간다.

  python3 scripts/content/monsters/redraw_mage_rogue.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from cloak_rig import hood
from pixel_lib import Canvas, add, burst, chain, ellipse, glow, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (24, 14, 34)
ROBE = [(64, 30, 96), (96, 48, 136), (130, 76, 172), (164, 116, 204)]
ROBE_FAR = [(46, 22, 70), (64, 30, 96), (76, 38, 112), (76, 38, 112)]
TRIM = (220, 180, 80)
SHADOW = (30, 18, 40)
SKIN = (216, 196, 180)
EYE = (110, 250, 230)
BOOT = [(60, 40, 26), (90, 62, 40), (116, 84, 56), (116, 84, 56)]
WOOD = [(70, 46, 28), (104, 72, 44), (136, 100, 64), (136, 100, 64)]
BOOK = [(110, 40, 30), (150, 60, 40), (190, 90, 60), (190, 90, 60)]
GEM = [(120, 50, 200), (190, 120, 255), (245, 220, 255)]
WHITE = (255, 250, 255)
DUST = [(84, 74, 90), (124, 114, 130)]
G = 60


def staff(cv, hand, ang, length=24):
    top = polar(hand, ang, length * 0.45)
    bot = polar(hand, ang + 180, length * 0.55)
    cv.part(chain([bot, hand, top], [2.0, 2.2, 2.4]), WOOD, ink=INK, gloss=False)
    # 꼭대기 갈래 + 수정
    for da in (-35, 35):
        cv.line4([rnd(top), rnd(polar(top, ang + da, 3))], WOOD[1])
    g = polar(top, ang, 3)
    cv.put(poly(cv.blank(), [polar(g, ang, 3), polar(g, ang + 90, 2), polar(g, ang + 180, 2), polar(g, ang - 90, 2)]), GEM[1])
    cv.pixel(*rnd(g), GEM[2])
    return g


def mage(cv, x=28, lean=0, tilt=0, staff_hand=(40, 40), staff_ang=-80, book=(20, 42), step=0, eye="open", glow_eye=False):
    sh = (x + lean * 0.4, 30)
    # 먼 소매 + 마도서
    cv.part(chain([add(sh, (-2, 1)), lerp(sh, book, 0.6), book], [4, 4.5, 5]), ROBE_FAR, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [add(book, (-3, -3)), add(book, (3, -2)), add(book, (3, 3)), add(book, (-3, 2))]), BOOK, ink=INK, gloss=False)
    cv.line4([add(rnd(book), (-2, 0)), add(rnd(book), (2, 0))], (240, 230, 200))
    # 장화(로브 밑)
    for fx, ramp in ((x - 4 - step, BOOT), (x + 5 + step, BOOT)):
        cv.part(poly(cv.blank(), [(fx - 2, 55), (fx + 2, 55), (fx + 5, 59), (fx - 2, 59)]), ramp, ink=INK, gloss=False)
    # 로브: 어깨 → 넓어지는 자락(바닥 위)
    hem = 56
    pts = [add(sh, (-5, -1)), add(sh, (5, 0)), (x + 10 + lean + step, hem), (x + 4 + lean, hem + 1), (x - 2, hem),
           (x - 8 - step, hem + 1), (x - 11 - step * 0.5, hem - 1)]
    M = cv.part(poly(cv.blank(), pts), ROBE, ink=INK)
    cv.shade_side(M, ROBE[0], side=-1, depth=2)
    cv.line4([(x - 10 - int(step * 0.5), hem - 1), (x + 9 + lean + step, hem - 1)], TRIM)
    cv.line4([rnd(add(sh, (3, 1))), (x + 5 + int(lean), hem - 2)], TRIM)  # 앞섶 단
    cv.line4([rnd(add(sh, (-6, 12))), rnd(add(sh, (7, 12)))], TRIM)  # 허리띠
    # 후드
    hc = add(sh, (2 + lean * 0.3, -6))
    outer, hole, face, R = hood(hc, 6.0, tilt + 8, peak=3)
    cv.part(poly(cv.blank(), outer), ROBE, ink=INK, gloss=False)
    cv.put(poly(cv.blank(), hole), SHADOW)
    cv.put(poly(cv.blank(), [R(1.5, 2.5), R(4.5, 2.5), R(4, 4.2), R(1.8, 4.4)]), SKIN)  # 창백한 턱
    e = rnd(R(3.0, 0))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], EYE)
    else:
        cv.pixel(*e, EYE)
        cv.pixel(e[0] + 1, e[1], EYE if glow_eye else SHADOW)
        cv.pixel(e[0] + 2, e[1], EYE)
    # 가까운 소매 + 손 + 지팡이
    g = staff(cv, staff_hand, staff_ang)
    cv.part(chain([add(sh, (2, 2)), lerp(sh, staff_hand, 0.55), staff_hand], [4.5, 5, 5.5]), ROBE, ink=INK, gloss=False)
    cv.part(ellipse(cv.blank(), staff_hand, 1.4, 1.4), [SKIN] * 4, ink=INK, gloss=False)
    return dict(gem=g, eye=e)


def draw_dead(cv):
    staff(cv, (14, 57), -8, 22)
    cv.part(poly(cv.blank(), [(18, 59), (22, 52), (40, 50), (48, 54), (46, 59)]), ROBE, ink=INK)
    cv.line4([(19, 58), (46, 58)], TRIM)
    cv.part(poly(cv.blank(), [(44, 58), (45, 51), (51, 49), (56, 53), (55, 58)]), ROBE, ink=INK)
    cv.put(poly(cv.blank(), [(50, 53), (54, 53), (54, 56), (50, 56)]), SHADOW)
    cv.line([(51, 54), (53, 55)], EYE)
    cv.part(poly(cv.blank(), [(8, 59), (8, 55), (13, 55), (13, 59)]), BOOK, ink=INK, gloss=False)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    if name == "idle_a":
        mage(cv)
    elif name == "idle_b":
        j = mage(cv, tilt=4, staff_hand=(40, 41), staff_ang=-82, book=(20, 43))
        cv.pixel(*add(rnd(j["gem"]), (1, -2)), GEM[2])
    elif name == "idle_c":
        mage(cv, tilt=-4, staff_hand=(41, 39), staff_ang=-76, book=(19, 40), glow_eye=True)
    elif name == "windup":  # 지팡이를 높이 들어 수정에 힘을 모은다
        j = mage(cv, x=26, lean=-3, tilt=-12, staff_hand=(34, 22), staff_ang=-95, book=(17, 38), glow_eye=True)
        glow(cv, j["gem"], 5, [GEM[0], GEM[1], GEM[2]])
    elif name == "move":  # 로브를 휘날리며 미끄러지듯 다가간다
        speed_lines(cv, 2, 9, (30, 38, 46), ROBE[2])
        mage(cv, x=31, lean=4, tilt=6, staff_hand=(45, 40), staff_ang=-50, book=(22, 40), step=2)
        puff(cv, (14, 57), 2.2, DUST)
    elif name == "attack":  # 지팡이 수정으로 내려친다
        j = mage(cv, x=29, lean=5, tilt=10, staff_hand=(44, 36), staff_ang=10, book=(19, 42))
        burst(cv, add(j["gem"], (2, 0)), 4.5, GEM[1], GEM[2], spikes=6)
    elif name == "recover":  # 스킬: 비전 화살 세 갈래
        j = mage(cv, x=20, lean=2, tilt=4, staff_hand=(31, 33), staff_ang=-10, book=(12, 40), glow_eye=True)
        g = j["gem"]
        for ang, ln in ((-28, 14), (0, 16), (28, 14)):
            tail = polar(g, ang, 4)
            tip = polar(g, ang, ln)
            cv.line([tail, tip], GEM[1], width=2)
            cv.line([polar(g, ang, 6), polar(g, ang, ln - 2)], GEM[2])
            cv.put(poly(cv.blank(), [polar(tip, ang, 2), polar(tip, ang + 140, 3), polar(tip, ang - 140, 3)]), GEM[2])
        glow(cv, g, 3.5, [GEM[1], GEM[2]])
    elif name == "hit":
        j = mage(cv, x=25, lean=-4, tilt=-22, staff_hand=(34, 44), staff_ang=-130, book=(14, 44), eye="shut")
        e = j["eye"]
        for dx, dy in ((4, -7), (7, -5), (6, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("mage-rogue", draw, sys.argv[1:], idle_ms=220)

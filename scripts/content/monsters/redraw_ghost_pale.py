#!/usr/bin/env python3
"""창백한 유령(ghost-pale) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

바닥에서 떠 있는 하얀 천 같은 유령: 둥근 머리에서 아래로 넓어지는 몸, 물결치며 갈라진 옷자락 끝,
옆으로 흐느적 뻗은 소매 팔 둘, 검게 뚫린 눈구멍 속 청록 불빛과 길게 벌어진 입.
몸 오른쪽 위가 밝고 왼쪽 아래가 푸르스름하게 어둡다(3단 + 1px 짙은 남색 외곽선).
6번 칸(스킬 skill_mon_wail): 몸을 부풀리고 입을 크게 벌려 아군 쪽으로 동심 음파 고리를 내지른다.

  python3 scripts/content/monsters/redraw_ghost_pale.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, poly, puff, ring, rnd, run, slash, sparkle

INK = (26, 30, 56)
SHEET = [(120, 140, 172), (178, 196, 218), (222, 232, 242), (250, 252, 255)]
HOLLOW = (22, 22, 40)
GLOW = [(60, 200, 190), (180, 255, 240)]
WAIL = [(120, 220, 210), (210, 255, 250)]
WHITE = (255, 255, 255)


def body_pts(c, w, h, sway, wave, lean):
    """머리 꼭대기에서 시작해 오른쪽 → 물결 옷자락 → 왼쪽으로 돈다."""
    x, y = c
    top = (x + lean, y - h * 0.55)
    pts = []
    # 오른쪽 둥근 머리 → 몸 옆
    for i in range(7):
        a = math.radians(-90 + i * 15)
        pts.append((top[0] + math.cos(a) * w * 0.42, top[1] + w * 0.42 + math.sin(a) * w * 0.42))
    pts.append((x + w * 0.5 + sway * 0.3, y + h * 0.15))
    # 아래 옷자락: 뾰족한 끝 4개, 끝이 sway 반대로 끌린다
    n = 4
    for i in range(n + 1):
        t = i / n
        bx = x + w * 0.5 - t * w * 1.0 + sway
        by = y + h * 0.45 + (math.sin(wave + i * 1.7) * 1.5)
        pts.append((bx + 1.5 * sway, by + 3))
        if i < n:
            pts.append((bx - w * 0.125 + sway, by - 1))
    pts.append((x - w * 0.5 + sway * 0.6, y + h * 0.1))
    for i in range(18, 25):
        a = math.radians(-90 + i * 15)
        pts.append((top[0] + math.cos(a) * w * 0.42, top[1] + w * 0.42 + math.sin(a) * w * 0.42))
    return pts, top


def arm(cv, sh, ang, ln, far):
    ramp = [SHEET[0], SHEET[0], SHEET[1], SHEET[1]] if far else SHEET
    el = (sh[0] + math.cos(math.radians(ang)) * ln * 0.55, sh[1] + math.sin(math.radians(ang)) * ln * 0.55)
    tip = (el[0] + math.cos(math.radians(ang + 25)) * ln * 0.5, el[1] + math.sin(math.radians(ang + 25)) * ln * 0.5)
    cv.part(chain([sh, el, tip], [4.2, 3.2, 1.6]), ramp, ink=INK, gloss=False)
    return tip


def draw_ghost(cv, c=(30, 34), w=22.0, h=30.0, sway=0.0, wave=0.0, lean=0.0, arms=((30, 12), (150, 12)),
               eyes="open", mouth=2, swell=0.0):
    w += swell
    h += swell
    # 먼 팔(왼쪽 뒤)
    far_sh = add(c, (-w * 0.36 + lean * 0.6, h * 0.1))
    far_tip = arm(cv, far_sh, arms[1][0], arms[1][1], True)
    pts, top = body_pts(c, w, h, sway, wave, lean)
    M = cv.part(poly(cv.blank(), pts), SHEET, ink=INK, gloss=True)
    cv.shade_side(M, SHEET[0], side=-1, depth=3)
    # 얼굴
    f = add(top, (w * 0.12, w * 0.42))
    for dx in (-3, 3):
        e = rnd(add(f, (dx, -1)))
        if eyes == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], HOLLOW)
        else:
            cv.put(ellipse(cv.blank(), e, 1.6, 2.2 if eyes == "wide" else 1.8), HOLLOW)
            cv.pixel(e[0] + 1, e[1], GLOW[0])
            if eyes == "wide":
                cv.pixel(e[0] + 1, e[1] - 1, GLOW[1])
    m = rnd(add(f, (1, 4)))
    cv.put(ellipse(cv.blank(), m, 1.2 + mouth * 0.15, 0.6 + mouth * 0.35), HOLLOW)
    # 가까운 팔(앞)
    near_sh = add(c, (w * 0.38 + lean * 0.6, h * 0.14))
    near_tip = arm(cv, near_sh, arms[0][0], arms[0][1], False)
    return dict(face=f, mouth=m, top=top, hand=near_tip, far_hand=far_tip)


POSES = dict(
    idle_a=dict(c=(30, 34), sway=0, wave=0.0, arms=((40, 12), (140, 12))),
    idle_b=dict(c=(30, 32), sway=-2, wave=1.6, lean=1, arms=((20, 13), (160, 12)), mouth=3),
    idle_c=dict(c=(31, 33), sway=2, wave=3.2, lean=-1, arms=((60, 11), (120, 11)), mouth=1),
    windup=dict(c=(27, 31), sway=4, wave=0.8, lean=-3, arms=((-70, 14), (-110, 14)), eyes="wide", mouth=4, swell=2.0),
    move=dict(c=(35, 34), sway=-7, wave=2.4, lean=4, arms=((0, 13), (200, 11)), eyes="wide", mouth=2),
    attack=dict(c=(38, 34), sway=-4, wave=4.0, lean=5, arms=((-15, 16), (170, 10)), eyes="wide", mouth=5),
    recover=dict(c=(27, 32), sway=2, wave=5.2, lean=-2, arms=((-40, 13), (-140, 13)), eyes="wide", mouth=7, swell=3.0),
    hit=dict(c=(25, 35), sway=6, wave=1.0, lean=-5, arms=((70, 10), (110, 10)), eyes="shut", mouth=3, h=27.0),
)


def draw_dead(cv):
    """바닥에 녹아내린 흰 천 웅덩이 + 위로 흩어지는 혼백 빛."""
    M = cv.part(poly(cv.blank(), [(14, 59), (18, 55), (26, 54), (30, 51), (36, 53), (44, 55), (48, 59)]), SHEET, ink=INK)
    cv.shade_side(M, SHEET[0], side=-1, depth=2)
    for x in (27, 33):
        cv.put(ellipse(cv.blank(), (x, 56), 1.2, 0.9), HOLLOW)
    for p, r in (((31, 44), 1.6), ((28, 38), 1.2)):
        cv.put(ellipse(cv.blank(), p, r, r), GLOW[0])
        cv.pixel(*p, GLOW[1])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = POSES[name]
    j = draw_ghost(cv, **P)
    if name == "windup":
        for hnd in (j["hand"], j["far_hand"]):
            sparkle(cv, add(hnd, (0, -3)), GLOW[1], GLOW[0])
    elif name == "move":
        for y in (26, 34, 42):
            cv.line([(3, y), (10, y)], SHEET[1])
    elif name == "attack":
        h = j["hand"]
        slash(cv, add(h, (-2, -10)), add(h, (6, 6)), 3, 3.0, WAIL[0], WAIL[1])
        burst(cv, (min(h[0] + 4, 56), h[1]), 4.5, GLOW[0], WHITE, spikes=6)
    elif name == "recover":
        # 입에서 아군 쪽으로 퍼지는 비명 음파 고리 셋
        m = j["mouth"]
        for k, r in enumerate((6, 11, 16)):
            ring(cv, m, r, -40, 40, WAIL[k % 2], width=1)
        sparkle(cv, (56, 18), WAIL[1], WAIL[0], big=True)
    elif name == "hit":
        t = j["top"]
        for dx, dy in ((9, 2), (11, 6), (12, -1)):
            cv.pixel(int(t[0] + dx), int(t[1] + dy), WHITE)
        puff(cv, add(j["face"], (8, 6)), 2.0, [SHEET[1], SHEET[2]])
    return cv.image()


if __name__ == "__main__":
    run("ghost-pale", draw, sys.argv[1:], idle_ms=210)

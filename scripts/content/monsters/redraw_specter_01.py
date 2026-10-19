#!/usr/bin/env python3
"""보라 후드 해골 스펙터(specter-01) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

크고 깊은 보라 후드 안에 상아빛 해골 얼굴(눈구멍에 청록 불빛, 이 드러난 위턱)이 앞으로 내밀어 보이고,
여러 겹으로 깊게 접힌 보라 망토가 아래에서 찢긴 옷자락으로 흩어진다. 소매 끝으로 나온 굵은 뼈 손 둘(손가락 넷).
무기 없이 손으로 저주를 쓴다 — 낫을 든 레이스(wraith-dark)와 달리 얼굴이 보이고 망토가 짧고 둥글다.
6번 칸(스킬 저주의 사슬): 두 손을 앞으로 뻗어 청록 저주 고리 사슬을 앞으로 길게 내쏜다.

  python3 scripts/content/monsters/redraw_specter_01.py [--preview DIR]
"""
from __future__ import annotations

import sys

from cloak_rig import hood, robe, sleeve
from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, rnd, run, slash, sparkle

INK = (24, 10, 34)
CLOAK = [(70, 36, 100), (104, 58, 140), (140, 90, 178), (176, 130, 210)]
CLOAK_FAR = [(50, 24, 74), (70, 36, 100), (88, 48, 120), (88, 48, 120)]
LINING = (40, 16, 56)
BONE = [(170, 156, 120), (214, 202, 168), (240, 232, 206), (252, 250, 236)]
HOLLOW = (16, 6, 22)
GLOW, GLOW_HI = (60, 220, 200), (200, 255, 246)
CURSE = [(40, 160, 150), (110, 236, 220), (230, 255, 250)]


def bone_hand(cv, wrist, ang, spread=0):
    cv.part(ellipse(cv.blank(), wrist, 2.2, 2.0), BONE, ink=INK, gloss=False)
    for k in (-36 - spread, -12, 12, 36 + spread):
        f1 = polar(wrist, ang + k, 3)
        f2 = polar(f1, ang + k + 30, 2)
        cv.line4([rnd(wrist), rnd(f1), rnd(f2)], BONE[2])
    return polar(wrist, ang, 4)


def draw_specter(cv, c=(31, 22), tilt=0.0, drag=3.0, wave=0.0, near=(30, 14), far=(50, 13), spread=0, jaw=1, eye="open", bob=0):
    c = add(c, (0, bob))
    sh = add(c, (-2, 7))
    s_f = add(sh, (-4, 1))
    el_f, cuff_f = sleeve(s_f, far[0], far[1])
    cv.part(chain([s_f, el_f, cuff_f], [6, 5, 6.4]), CLOAK_FAR, ink=INK, gloss=False)
    far_hand = bone_hand(cv, polar(cuff_f, far[0], 2.5), far[0] + 15, spread)
    pts = robe(sh, 52 + bob * 0.5, 16, 26, tatters=4, drag=drag, wave=wave, lean=1)
    M = cv.part(poly(cv.blank(), pts), CLOAK, ink=INK)
    cv.shade_side(M, CLOAK[0], side=-1, depth=3)
    # 겹친 망토 깃: 어깨에서 가슴으로 내려오는 V 자 겹 + 깊은 주름 셋
    cv.part(poly(cv.blank(), [add(sh, (-7, -1)), add(sh, (8, -1)), add(sh, (3, 9)), add(sh, (0, 6)), add(sh, (-3, 9))]), CLOAK, ink=INK)
    for dx in (-6, -1, 4):
        cv.line4([add(sh, (dx, 10)), add(sh, (dx - drag * 0.25 - 1, 26))], LINING)
    outer, hole, face, R = hood(c, 9, tilt, peak=5)
    H = cv.part(poly(cv.blank(), outer), CLOAK, ink=INK)
    cv.shade_side(H, CLOAK[1], side=-1, depth=2)
    cv.put(poly(cv.blank(), hole), LINING)
    # 해골 얼굴(후드 구멍 안에서 앞으로)
    skull = [R(1, -4), R(6, -4), R(9, -1), R(9, 3), R(6, 5), R(2, 4), R(0, 0)]
    cv.part(poly(cv.blank(), skull), BONE, ink=INK, gloss=False)
    cv.part(poly(cv.blank(), [R(3, 4), R(8, 4), R(8, 6 + jaw), R(4, 6 + jaw * 0.6)]), BONE, ink=INK, gloss=False)
    for dx in (3, 7):
        e = rnd(R(dx, -1))
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (0, -1)), add(e, (0, 0)), add(e, (-1, 0))]) if dx == 3 else
               poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), HOLLOW)
        if eye != "shut":
            cv.pixel(e[0], e[1], GLOW if dx == 3 else GLOW_HI)
    cv.pixel(*rnd(R(8, 1)), HOLLOW)
    for dx in (4, 6, 8):
        cv.pixel(*rnd(R(dx, 4)), HOLLOW)
    s_n = add(sh, (4, 1))
    el_n, cuff_n = sleeve(s_n, near[0], near[1])
    cv.part(chain([s_n, el_n, cuff_n], [6.4, 5.4, 7]), CLOAK, ink=INK, gloss=False)
    near_hand = bone_hand(cv, polar(cuff_n, near[0], 2.8), near[0] + 15, spread)
    return dict(hand=near_hand, far=far_hand, eye=R(7, -1), mouth=R(8, 5))


POSES = dict(
    idle_a=dict(),
    idle_b=dict(bob=-2, wave=1.5, drag=4, near=(38, 14), far=(58, 13), jaw=2),
    idle_c=dict(bob=-1, wave=2.8, drag=5, tilt=8, near=(22, 14), far=(44, 13), jaw=1),
    windup=dict(c=(28, 23), tilt=-14, drag=2, wave=0.5, near=(-110, 13), far=(-90, 13), spread=10, jaw=3),
    move=dict(c=(37, 22), tilt=16, drag=11, wave=2.0, near=(10, 14), far=(25, 13), bob=1, jaw=1),
    attack=dict(c=(35, 23), tilt=14, drag=8, wave=3.2, near=(5, 16), far=(15, 15), spread=12, jaw=4),
    recover=dict(c=(21, 24), tilt=-4, drag=4, wave=2.2, near=(-5, 15), far=(-15, 14), spread=6, jaw=4),
    hit=dict(c=(26, 24), tilt=-28, drag=1, wave=4.0, near=(130, 12), far=(150, 12), jaw=3, eye="shut"),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv.part(poly(cv.blank(), [(10, 59), (16, 51), (28, 48), (40, 50), (48, 55), (52, 59)]), CLOAK, ink=INK)
        for x in (18, 26, 34):
            cv.line4([(x, 52), (x - 2, 58)], LINING)
        cv.part(ellipse(cv.blank(), (46, 52), 4.0, 3.4), BONE, ink=INK)
        cv.put(poly(cv.blank(), [(46, 51), (48, 51), (48, 53), (46, 53)]), HOLLOW)
        bone_hand(cv, (56, 57), 0)
        cv.line4([(51, 57), (54, 57)], BONE[1])
        return cv.image()
    P = dict(POSES[name])
    j = draw_specter(cv, **P)
    if name == "attack":
        h = j["hand"]
        for k in (-3, 0, 3):
            slash(cv, add(h, (k, -8)), add(h, (4 + k, 6)), 2, 2.0, CURSE[0], CURSE[2])
        burst(cv, add(h, (3, 0)), 3.5, CURSE[1], CURSE[2], spikes=6)
    elif name == "recover":
        # 두 손 사이에서 앞으로 길게 이어지는 저주 고리 사슬(고리끼리 맞물린다)
        a = j["hand"]
        end = (61, a[1] - 6)
        n = 8
        for k in range(n):
            p = lerp(a, end, (k + 0.5) / n)
            if k % 2:
                cv.put(ellipse(cv.blank(), p, 2.6, 1.8), CURSE[0])
            else:
                cv.put(ellipse(cv.blank(), p, 1.8, 2.8), CURSE[0])
        cv.line4([a, end], CURSE[1])
        for k in range(n):
            p = rnd(lerp(a, end, (k + 0.5) / n))
            hole = [add(p, (-1, 0)), add(p, (0, 0))] if k % 2 else [add(p, (0, -1)), add(p, (0, 0)), add(p, (0, 1))]
            for q in hole:
                cv.pixel(*q, INK)
            cv.pixel(*add(p, (-1, -1) if k % 2 else (1, -1)), CURSE[2])
        sparkle(cv, end, CURSE[2], CURSE[1], big=True)
        sparkle(cv, add(j["eye"], (3, -6)), GLOW_HI, GLOW)
    elif name == "windup":
        sparkle(cv, add(j["eye"], (3, -6)), GLOW_HI, GLOW, big=True)
    elif name == "move":
        for y in (30, 38, 46):
            cv.line4([(3, y), (10, y)], CLOAK[2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -7), (7, -4), (3, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), BONE[3])
    return cv.image()


if __name__ == "__main__":
    run("specter-01", draw, sys.argv[1:], idle_ms=210)

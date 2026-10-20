#!/usr/bin/env python3
"""나뭇잎 정령(leafling-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

숲에 사는 작은 나무 정령: 깎아 만든 갈색 나무 얼굴에 앞으로 튀어나온 뾰족한 코, 움푹 판 눈구멍 속에서 노랗게 빛나는 눈,
머리 위에 부채꼴로 돋은 초록 잎 왕관, 몸은 잎맥이 보이는 잎사귀를 비늘처럼 겹쳐 입은 잎 갑옷,
가는 덩굴 팔(손끝은 말린 덩굴손), 땅을 움켜쥐는 굵은 뿌리 다리(발끝이 뿌리 가닥으로 갈라짐). 오른쪽(아군)을 본다.
5번 칸(공격): 덩굴 팔을 채찍처럼 길게 뻗어 후려친다.
6번 칸(스킬 뿌리 내리기): 두 팔을 땅에 꽂아 뿌리를 내리면, 가시 돋친 뿌리 창이 땅을 뚫고 아군 쪽으로 차례로 솟는다.

  python3 scripts/content/monsters/redraw_leafling_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (34, 22, 14)
WOOD = [(96, 58, 30), (136, 88, 48), (174, 124, 74), (210, 166, 110)]
WOOD_FAR = [(70, 42, 22), (96, 58, 30), (116, 72, 38), (116, 72, 38)]
LEAF = [(38, 96, 42), (66, 142, 54), (112, 190, 74), (172, 228, 112)]
LEAF_FAR = [(28, 72, 36), (38, 96, 42), (52, 118, 48), (52, 118, 48)]
VEIN = (30, 74, 34)
VINE = [(64, 92, 30), (100, 134, 44), (146, 176, 70), (146, 176, 70)]
VINE_FAR = [(48, 70, 26), (64, 92, 30), (80, 112, 36), (80, 112, 36)]
EYE = (255, 222, 70)
EYE_HI = (255, 252, 210)
SOCKET = (52, 30, 16)
DIRT = [(110, 80, 50), (150, 116, 76)]
THORN = (190, 230, 120)
WHITE = (255, 255, 240)
G = 60


def leaf(cv, base, ang, ln, wd, ramp=LEAF, vein=True):
    """잎맥 있는 잎 한 장: base 에서 ang 방향으로 길이 ln, 폭 wd."""
    tip = polar(base, ang, ln)
    mid = lerp(base, tip, 0.45)
    side = (math.cos(math.radians(ang + 90)) * wd / 2, math.sin(math.radians(ang + 90)) * wd / 2)
    pts = [base, add(mid, side), tip, add(mid, (-side[0], -side[1]))]
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    if vein and ln >= 5:
        cv.line([lerp(base, tip, 0.15), lerp(base, tip, 0.7)], VEIN if ramp is LEAF else LEAF_FAR[0])
    return tip


def root_leg(cv, hip, foot, far=False, spread=1.0):
    ramp = WOOD_FAR if far else WOOD
    knee = add(lerp(hip, foot, 0.5), (1.5, 0))
    cv.part(chain([hip, knee, foot], [5.0, 4.2, 4.6]), ramp, ink=INK, gloss=False)
    f = rnd(foot)
    # 뿌리 발가락: 땅을 따라 갈라지는 가닥
    for dx, dy, w in ((5 * spread, 0, 2.2), (-4 * spread, 0, 2.0), (2 * spread, 0, 1.6)):
        cv.part(chain([(f[0], f[1] - 1), (f[0] + dx, G - 0.5 + dy)], [2.6, w * 0.6]), ramp, ink=INK, gloss=False)


def vine_arm(cv, sh, hand, bend=4, far=False):
    """가는 덩굴 팔, 손끝은 말린 덩굴손 + 작은 잎."""
    mid = add(lerp(sh, hand, 0.5), (0, bend))
    pts = bezier(sh, mid, hand, 6)
    ramp = VINE_FAR if far else VINE
    cv.part(chain(pts, [2.2] * 7), ramp, ink=INK, gloss=False)
    d = math.degrees(math.atan2(hand[1] - mid[1], hand[0] - mid[0]))
    curl = [hand, polar(hand, d + 40, 2), polar(polar(hand, d + 40, 2), d + 140, 2)]
    cv.line(curl, ramp[1])
    leaf(cv, lerp(pts[3], pts[4], 0.5), d - 70, 4, 3, LEAF_FAR if far else LEAF, vein=False)
    return hand


def head(cv, hc, tilt=0.0, eye="open", mouth=0, crown=0.0, wilt=False):
    a = math.radians(tilt)
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    # 잎 왕관(뒤에서 앞으로 겹쳐 그림)
    angs = (-160, -132, -106, -80, -54) if not wilt else (170, 150, -150, 30, 10)
    for i, ang in enumerate(angs):
        base = R(-4 + i * 2, -5)
        ln = (7, 9, 10, 9, 7)[i]
        leaf(cv, base, ang + tilt + crown * (1 if i % 2 else -0.6), ln, 4.2, LEAF if i % 2 == 0 else LEAF_FAR if i == 1 else LEAF)
    # 깎은 나무 머리(둥근 상자)
    skull = [R(-6, -5), R(-3, -7), R(4, -7), R(7, -4), R(7, 4), R(4, 7), R(-3, 7), R(-6, 4)]
    cv.part(poly(cv.blank(), skull), WOOD, ink=INK)
    # 나뭇결 홈
    cv.line([R(-5, -2), R(-2, -3)], WOOD[0])
    cv.line([R(-5, 3), R(-3, 2)], WOOD[0])
    # 앞으로 튀어나온 뾰족 코
    cv.part(poly(cv.blank(), [R(5, -1), R(13, 2), R(5, 3)]), WOOD, ink=INK, gloss=False)
    cv.pixel(*rnd(R(8, 1)), WOOD[3])
    # 눈(머리 안: 앞쪽 큰 눈 + 안쪽 작은 눈)
    for ex, big in ((3.5, True), (-0.5, False)):
        e = rnd(R(ex, -2))
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 1))], INK)
            continue
        if eye == "x":
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], INK)
            cv.line([add(e, (1, -1)), add(e, (-1, 1))], INK)
            continue
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1 if big else 0, -1)), add(e, (1 if big else 0, 1)), add(e, (-1, 1))]), SOCKET)
        cv.pixel(e[0], e[1], EYE)
        cv.pixel(e[0], e[1] - 1 if big else e[1], EYE_HI if big else EYE)
        if big:
            cv.pixel(e[0] - 1, e[1], EYE)
    # 입: 판 홈
    m0 = rnd(R(1, 4))
    if mouth:
        cv.put(poly(cv.blank(), [m0, add(m0, (5, -1)), add(m0, (4, mouth)), add(m0, (1, mouth))]), SOCKET)
    else:
        cv.line([m0, add(m0, (4, -1))], SOCKET)
    return dict(nose=R(13, 2), top=R(0, -14))


def body(cv, bc, lean=0.0):
    """잎 갑옷 몸통: 짙은 몸 위에 잎을 아래 줄부터 비늘처럼 겹친다."""
    cv.part(ellipse(cv.blank(), bc, 7.0, 8.0), LEAF_FAR, ink=INK)
    for dy, xs in ((0, (-3.5, 3)), (-5, (-4.5, 1.5)), (-9, (-1, 4))):
        for dx in xs:
            base = add(bc, (dx + lean * 0.1, dy))
            leaf(cv, base, 92 - dx * 4, 9, 6.4)


def critter(cv, x=32, bob=0, lean=0.0, arm_n=None, arm_f=None, legs=0, crown=0.0, eye="open", mouth=0, tilt=0.0, crouch=0):
    hip = (x - 2 + lean * 0.2, 49 + bob + crouch)
    bc = add(hip, (lean * 0.4, -6))
    sh_f = add(bc, (-1, -4))
    hand_f = arm_f or add(sh_f, (-6, 8))
    vine_arm(cv, sh_f, hand_f, bend=3, far=True)
    root_leg(cv, add(hip, (2, 0)), (hip[0] + 4 - legs, G - 2), far=True, spread=0.9)
    root_leg(cv, add(hip, (-2, 1)), (hip[0] - 2 + legs, G - 2), spread=1.0)
    body(cv, bc, lean)
    hc = add(bc, (2 + lean * 0.5, -13))
    hj = head(cv, hc, tilt, eye, mouth, crown)
    sh_n = add(bc, (2, -3))
    hand_n = arm_n or add(sh_n, (9, 6))
    vine_arm(cv, sh_n, hand_n, bend=3)
    return dict(head=hc, hand=hand_n, nose=hj["nose"], top=hj["top"], hip=hip)


def spike(cv, x, h, lean=0.0):
    """가시 돋친 뿌리 창: 땅에서 위로 솟는 쐐기 + 초록 가시."""
    base = (x, G)
    tip = (x + lean, G - h)
    w = max(3.0, h * 0.36)
    cv.part(poly(cv.blank(), [(x - w, G), add(lerp(base, tip, 0.5), (-w * 0.45, 0)), tip, add(lerp(base, tip, 0.5), (w * 0.4, 0)), (x + w * 0.9, G)]), WOOD, ink=INK)
    cv.line([lerp(base, tip, 0.1), lerp(base, tip, 0.8)], WOOD[0])
    if h > 10:  # 감긴 덩굴
        cv.line([add(lerp(base, tip, 0.15), (-w * 0.7, 0)), add(lerp(base, tip, 0.4), (w * 0.5, 0))], LEAF[2])
    for t, s in ((0.35, -1), (0.55, 1), (0.75, -1)):
        if h * t > 4:
            p = lerp(base, tip, t)
            e = add(p, (s * (w * (1 - t) + 1.5), 0))
            q = add(e, (s * 2, -2))
            cv.line([e, q], THORN)
            cv.pixel(*rnd(q), INK)
    cv.put(poly(cv.blank(), [(x - w - 2, G), (x - w, G - 2), (x + w, G - 2), (x + w + 2, G)]), DIRT[0])
    cv.pixel(x - w - 1, G - 1, DIRT[1])
    cv.pixel(x + w + 1, G - 2, DIRT[1])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 쓰러져 잎 왕관이 시들고 잎 갑옷이 흩어짐
        root_leg(cv, (16, 55), (8, 58), far=True)
        cv.part(ellipse(cv.blank(), (25, 55), 9, 4.5), LEAF_FAR, ink=INK)
        for dx in (-6, -2, 2, 6):
            leaf(cv, (25 + dx, 52), 160, 6, 4)
        head(cv, (42, 52), tilt=8, eye="x", wilt=True)
        for p, a in (((54, 58), 200), ((12, 50), 30)):
            leaf(cv, p, a, 5, 3.4, LEAF, vein=False)
        return cv.image()
    if name == "idle_a":
        critter(cv)
    elif name == "idle_b":
        critter(cv, bob=1, crown=8, arm_n=(39, 52), tilt=-3)
    elif name == "idle_c":
        critter(cv, bob=-1, crown=-6, arm_n=(42, 44), arm_f=(22, 42), tilt=3, mouth=1)
    elif name == "windup":  # 덩굴 팔을 뒤로 감아올림
        j = critter(cv, x=29, lean=-5, crouch=1, arm_n=(18, 26), arm_f=(16, 34), crown=-12, tilt=-8, mouth=1)
        sparkle(cv, add(j["top"], (6, 2)), WHITE, EYE)
    elif name == "move":  # 뿌리 발로 성큼 걸음
        speed_lines(cv, 2, 8, (34, 42, 50), LEAF[2])
        critter(cv, x=35, lean=5, legs=4, bob=-2, arm_n=(46, 50), arm_f=(20, 50), crown=10)
        puff(cv, (20, 58), 1.8, DIRT)
    elif name == "attack":  # 덩굴 채찍
        j = critter(cv, x=26, lean=6, legs=-2, arm_n=(56, 30), crown=12, mouth=2, tilt=4)
        h = j["hand"]
        cv.line(bezier(add(h, (-14, -10)), add(h, (-4, -14)), add(h, (2, -6)), 8), LEAF[2])
        burst(cv, add(h, (2, 1)), 4.4, EYE, WHITE, spikes=7)
    elif name == "recover":  # 스킬: 뿌리 내리기 → 가시 뿌리 창이 아군 쪽으로 솟음
        critter(cv, x=19, lean=6, crouch=2, arm_n=(25, 59), arm_f=(13, 59), crown=-8, mouth=2, tilt=10)
        for x, h in ((32, 9), (41, 15), (52, 23)):
            spike(cv, x, h, lean=1)
        cv.line([(26, 59), (58, 59)], DIRT[0])
        sparkle(cv, (58, 34), WHITE, THORN, big=True)
    elif name == "hit":
        j = critter(cv, x=29, lean=-7, eye="shut", mouth=1, arm_n=(40, 34), arm_f=(16, 32), tilt=-14, crown=14, legs=-2)
        for p, a in (((48, 20), -20), ((52, 30), 30)):
            leaf(cv, p, a, 4, 3, LEAF, vein=False)
        h = j["head"]
        for dx, dy in ((11, -9), (13, -5)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("leafling-01", draw, sys.argv[1:], idle_ms=200)

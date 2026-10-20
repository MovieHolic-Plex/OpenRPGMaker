#!/usr/bin/env python3
"""나무 토템(totem-cursed) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

저주받은 나무 토템: 깊게 깎은 나무 가면 셋이 위로 쌓인 기둥. 가면마다 노랗게 빛나는 눈과 앞으로 길게 뻗은 코가 있고
표정이 다르다(맨 위는 가늘게 뜬 눈·꾹 다문 입, 가운데는 찌푸린 눈썹·송곳니 입, 맨 아래는 크게 벌린 입).
꼭대기에 부채꼴 초록 잎 볏, 가운데 가면 양옆으로 비틀린 뿌리 팔 둘(끝이 세 가닥 뿌리 손가락). 다리 없이 통째로 쿵쿵 뛰어 움직인다.
5번 칸(공격): 뿌리 팔을 내리꽂아 땅을 친다.
6번 칸(스킬 저주): 가면 셋의 눈이 보랏빛으로 타오르고, 맨 위 가면에서 보라·초록 저주 빛줄기와 해골 도깨비불이 아군 쪽으로 뻗는다.
8번 칸(쓰러짐): 기둥이 무너져 가면 셋이 따로 굴러 떨어진다.

  python3 scripts/content/monsters/redraw_totem_cursed.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

INK = (30, 18, 12)
WOOD = [(98, 62, 34), (140, 96, 56), (178, 134, 82), (214, 176, 120)]
WOOD_ALT = [(84, 54, 32), (120, 80, 46), (156, 112, 66), (190, 150, 98)]
ROOT = [(70, 44, 24), (102, 66, 36), (132, 90, 52), (132, 90, 52)]
CARVE = (56, 32, 18)
LEAF = [(38, 96, 42), (66, 142, 54), (112, 190, 74), (172, 228, 112)]
LEAF_FAR = [(28, 72, 36), (38, 96, 42), (52, 118, 48), (52, 118, 48)]
EYE = (255, 214, 60)
EYE_HI = (255, 250, 200)
CURSE = [(96, 40, 130), (160, 80, 200), (220, 170, 255)]
CGREEN = [(70, 170, 90), (170, 250, 150)]
TOOTH = (236, 226, 196)
DUST = [(120, 96, 70), (170, 146, 112)]
WHITE = (255, 255, 240)
G = 60

# 가면 셋: (너비, 높이, 표정, 나무색)
MASKS = ((19, 12, "roar", WOOD), (17, 11, "fang", WOOD_ALT), (15, 10, "calm", WOOD))


def mask(cv, c, w, h, kind, ramp, eye="open", tilt=0.0):
    """깎은 나무 가면 블록 하나(오른쪽을 본다). 반환: 눈 위치."""
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    hw, hh = w / 2, h / 2
    box = [R(-hw, -hh + 2), R(-hw + 2, -hh), R(hw - 2, -hh), R(hw, -hh + 2), R(hw, hh - 1), R(hw - 1, hh), R(-hw + 1, hh), R(-hw, hh - 1)]
    cv.part(poly(cv.blank(), box), ramp, ink=INK)
    # 뒤쪽 나뭇결 홈 + 아랫단 띠
    cv.line([R(-hw + 2, -hh + 3), R(-hw + 2, hh - 2)], CARVE)
    cv.line([R(-hw + 1, hh - 1), R(hw - 1, hh - 1)], ramp[0])
    # 이마 눈썹 홈
    ex = hw * 0.35
    if kind == "fang":
        cv.line([R(ex - 3, -hh + 2), R(ex + 2, -hh + 4)], CARVE)
    else:
        cv.line([R(ex - 3, -hh + 3), R(ex + 2, -hh + 3)], CARVE)
    # 눈: 앞 눈 + 안쪽 눈(파낸 홈 안에서 빛남)
    eyes = []
    for dx, big in ((ex, True), (ex - 5, False)):
        e = rnd(R(dx, -hh + 5))
        eyes.append(e)
        if eye == "shut":
            cv.line([add(e, (-1, 0)), add(e, (1, 0))], CARVE)
            continue
        col, hi = (EYE, EYE_HI) if eye == "open" else (CURSE[1], CURSE[2])
        if kind == "calm":
            cv.line([add(e, (-1, 0)), add(e, (1 if big else 0, 0))], col)
        else:
            cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1 if big else 0, -1)), add(e, (1 if big else 0, 0)), add(e, (-1, 0))]), col)
            cv.pixel(e[0], e[1] - 1, hi)
        cv.pixel(e[0] - 1, e[1] + 1, CARVE)
    # 앞으로 길게 뻗은 코
    nb = R(hw - 1, -hh + 4)
    cv.part(poly(cv.blank(), [nb, R(hw + 6, -hh + 8), R(hw - 1, -hh + 8)]), ramp, ink=INK, gloss=False)
    # 입
    m0 = R(ex - 3, hh - 3)
    if kind == "roar":
        cv.put(poly(cv.blank(), [R(ex - 4, hh - 4), R(hw - 1, hh - 4), R(hw - 1, hh - 2), R(ex - 3, hh - 2)]), CARVE)
        for t in (0.25, 0.65):
            cv.pixel(*rnd(lerp(R(ex - 4, hh - 4), R(hw - 1, hh - 4), t)), TOOTH)
    elif kind == "fang":
        cv.line([R(ex - 4, hh - 3), R(hw - 1, hh - 3)], CARVE)
        cv.pixel(*rnd(R(ex, hh - 2)), TOOTH)
        cv.pixel(*rnd(R(ex + 3, hh - 2)), TOOTH)
    else:
        cv.line([m0, R(hw - 2, hh - 3)], CARVE)
    return eyes


def root_arm(cv, sh, elbow, hand, far=False):
    ramp = [ROOT[0]] * 2 + [ROOT[1]] * 2 if far else ROOT
    cv.part(chain([sh, elbow, hand], [3.6, 2.8, 2.2]), ramp, ink=INK, gloss=False)
    cv.pixel(*rnd(lerp(sh, elbow, 0.5)), ROOT[0])  # 옹이
    d = math.degrees(math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]))
    for k in (-40, 0, 40):
        tip = polar(hand, d + k, 3.2)
        cv.part(chain([hand, tip], [1.8, 1.0]), ramp, ink=INK, gloss=False)


def crest(cv, top, sway=0.0, wilt=False):
    for i, (ang, ln) in enumerate(((-140, 7), (-115, 10), (-92, 11), (-68, 10), (-44, 7))):
        a = ang + sway * (1 if i % 2 else 0.6)
        if wilt:
            a = (-170, -150, 180, -30, 0)[i]
        base = add(top, (-4 + i * 2, 1))
        tip = polar(base, a, ln)
        mid = lerp(base, tip, 0.45)
        sd = (math.cos(math.radians(a + 90)) * 2.2, math.sin(math.radians(a + 90)) * 2.2)
        cv.part(poly(cv.blank(), [base, add(mid, sd), tip, add(mid, (-sd[0], -sd[1]))]), LEAF if i % 2 == 0 else LEAF_FAR, ink=INK, gloss=False)
        cv.line([lerp(base, tip, 0.2), lerp(base, tip, 0.7)], LEAF[0] if i % 2 == 0 else LEAF_FAR[0])


def totem(cv, x=31, lift=0, offs=(0, 0, 0), tilts=(0, 0, 0), arm_f=None, arm_n=None, eye="open", sway=0.0):
    """아래에서 위로 가면 셋을 쌓는다. arm_* = (팔꿈치, 손) 가운데 가면 기준 상대 좌표."""
    y = G - 1 - lift
    cs = []
    for (w, h, kind, ramp), dx in zip(MASKS, offs):
        c = (x + dx, y - h / 2)
        cs.append((c, w, h, kind, ramp))
        y -= h - 1
    mid_c = cs[1][0]
    sh_f = add(mid_c, (-6, -1))
    ef, hf = arm_f or ((-6, -4), (-11, -11))
    root_arm(cv, sh_f, add(sh_f, ef), add(sh_f, hf), far=True)
    eyes = []
    for (c, w, h, kind, ramp), t in zip(cs, tilts):
        eyes += mask(cv, c, w, h, kind, ramp, eye, t)
    top_c, _, top_h = cs[2][0], cs[2][1], cs[2][2]
    crest(cv, add(top_c, (0, -top_h / 2)), sway)
    # 가까운 뿌리 팔(가운데 가면 앞쪽 옆구리, 코 아래에서 뻗음)
    sh_n = add(mid_c, (cs[1][1] / 2 - 2, 3.5))
    en, hn = arm_n or ((7, 2), (11, -7))
    root_arm(cv, sh_n, add(sh_n, en), add(sh_n, hn))
    return dict(eyes=eyes, top=top_c, mid=mid_c, hand=add(sh_n, hn), base=cs[0][0])


def skull_wisp(cv, c, r):
    """해골 모양 저주 도깨비불: 보라 불꽃 꼬리 + 둥근 머리 + 검은 눈구멍."""
    cv.put(poly(cv.blank(), [add(c, (-r * 0.6, -r * 0.6)), add(c, (-r * 2.6, -r * 0.2)), add(c, (-r * 0.4, r * 0.8))]), CURSE[0])
    cv.part(ellipse(cv.blank(), c, r, r * 0.9), [CURSE[2], TOOTH, TOOTH, WHITE], ink=CURSE[0], gloss=False)
    e = rnd(c)
    for dx in (-1, 1 + int(r > 3)):
        cv.pixel(e[0] + dx, e[1], INK)
        if r > 3:
            cv.pixel(e[0] + dx + (1 if dx > 0 else 0) * 0, e[1] - 1, INK)
    cv.pixel(e[0], e[1] + 2, CURSE[0])


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":  # 무너진 기둥: 가면 셋이 흩어짐
        (w0, h0, k0, r0), (w1, h1, k1, r1), (w2, h2, k2, r2) = MASKS
        mask(cv, (16, G - 1 - h0 / 2), w0, h0, k0, r0, "shut", 0)
        mask(cv, (34, G - 1 - w1 / 2 + 1), w1, h1, k1, r1, "shut", 90)
        mask(cv, (51, G - 1 - h2 / 2), w2, h2, k2, r2, "shut", 14)
        crest(cv, (55, 50), wilt=True)
        root_arm(cv, (26, 57), (22, 55), (19, 58), far=True)
        puff(cv, (43, 58), 1.6, DUST)
        return cv.image()
    if name == "idle_a":
        totem(cv)
    elif name == "idle_b":
        totem(cv, offs=(0, 1, 2), sway=8, arm_f=((-6, -3), (-11, -9)), arm_n=((7, 1), (12, -9)))
    elif name == "idle_c":
        totem(cv, offs=(0, -1, -1), sway=-6, arm_f=((-6, -5), (-10, -13)), arm_n=((7, 3), (10, -5)))
    elif name == "windup":  # 뿌리 팔을 머리 위로 치켜듦
        totem(cv, x=29, offs=(0, -1, -2), tilts=(0, -4, -8), sway=-14, arm_f=((-5, -8), (-6, -16)), arm_n=((7, -4), (10, -17)))
        sparkle(cv, (44, 14), WHITE, EYE)
    elif name == "move":  # 통째로 쿵쿵 뛰어 전진
        speed_lines(cv, 2, 8, (30, 38, 46), WOOD[2])
        totem(cv, x=34, lift=4, offs=(0, -1, -2), tilts=(4, 2, 0), sway=12, arm_f=((-6, -2), (-12, -6)), arm_n=((6, 4), (11, 1)))
        puff(cv, (22, 58), 2.0, DUST)
    elif name == "attack":  # 뿌리 팔 내리꽂기
        j = totem(cv, x=31, offs=(0, 1, 3), tilts=(0, 6, 10), sway=14, arm_f=((-7, -2), (-12, -8)), arm_n=((7, -5), (12, 9)))
        h = j["hand"]
        burst(cv, (h[0] + 2, G - 3), 4.6, EYE, WHITE, spikes=7)
        puff(cv, (h[0] - 4, G - 1), 1.6, DUST)
    elif name == "recover":  # 스킬: 저주 빛줄기 + 해골 도깨비불
        j = totem(cv, x=21, offs=(0, 0, 1), eye="curse", sway=-6, arm_f=((-5, -6), (-7, -14)), arm_n=((7, -4), (11, -14)))
        e = j["eyes"][4]
        start = add(e, (8, 2))
        end = (49, 22)
        cv.line([start, end], CURSE[0], width=3)
        cv.line([start, end], CGREEN[0])
        skull_wisp(cv, (53, 22), 3.6)
        skull_wisp(cv, (50, 36), 2.6)
        for p in ((43, 14), (58, 30), (44, 44)):
            sparkle(cv, p, CGREEN[1], CURSE[1])
        for e2 in j["eyes"][::2]:
            cv.pixel(e2[0] + 2, e2[1] - 2, CURSE[2])
    elif name == "hit":  # 가면이 어긋나며 뒤로 휘청
        j = totem(cv, x=31, offs=(0, -2, -4), tilts=(0, -4, -9), eye="shut", sway=18, arm_f=((-6, 2), (-12, 4)), arm_n=((6, 5), (10, 9)))
        t = j["top"]
        for dx, dy in ((12, -8), (14, -4), (11, -11)):
            cv.pixel(t[0] + dx, t[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("totem-cursed", draw, sys.argv[1:], idle_ms=220)

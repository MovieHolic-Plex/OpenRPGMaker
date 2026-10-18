#!/usr/bin/env python3
"""모래 전갈(scorpion-sand) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

마디진 꼬리가 등 위로 말려 독침을 앞으로 겨누고, 집게 둘·걷는 다리 넷(가까운·먼 쪽)이 바닥 y=60 을 딛는다.
6번 칸(스킬 skill_mon_poison_sting): 독침을 앞으로 내찔러 초록 독액이 빛나며 떨어진다.

  python3 scripts/content/monsters/redraw_scorpion_sand.py [--preview DIR]
"""
from __future__ import annotations

import sys

from pixel_lib import (Canvas, add, bezier, burst, chain, ellipse, glow, ik, lerp, limb, polar, poly, puff, rnd, run,
                       slash, sparkle, tapered)

INK = (54, 30, 16)
SAND = [(132, 82, 38), (190, 132, 64), (230, 184, 100), (252, 228, 156)]
SAND_FAR = [(96, 58, 30), (132, 82, 38), (170, 116, 58), (170, 116, 58)]
CLAW = [(104, 54, 26), (158, 94, 42), (206, 146, 72), (240, 200, 120)]
CLAW_FAR = [(80, 42, 22), (112, 64, 32), (150, 96, 50), (150, 96, 50)]
STING = [(70, 24, 30), (132, 36, 44), (200, 64, 60), (240, 120, 96)]
EYE, PUPIL = (236, 52, 40), (255, 220, 120)
VENOM = [(40, 120, 40), (96, 200, 64), (176, 248, 120), (236, 255, 200)]
DUST = [(176, 148, 104), (214, 190, 144)]
WHITE = (255, 250, 230)


def tail_points(base, ang, curl, n=7, seg=5.4):
    """꼬리는 처음엔 곧게 솟고 끝으로 갈수록 말린다(마디마다 curl 이 커진다)."""
    pts, a, p = [base], ang, base
    for i in range(n):
        p = polar(p, a, seg - i * 0.2)
        pts.append(p)
        a += curl * (0.4 + i * 0.25)
    return pts, a


def draw_tail(cv, base, ang, curl, glow_sting=False):
    pts, end_ang = tail_points(base, ang, curl)
    widths = [6.0, 5.6, 5.2, 4.8, 4.4, 4.0, 3.6, 3.2]
    for i in range(len(pts) - 1):
        seg = poly(cv.blank(), tapered(pts[i], pts[i + 1], widths[i], widths[i + 1], bulge=0.8))
        cv.part(seg, SAND)
    # 독주머니 + 갈고리 독침
    bulb_c = polar(pts[-1], end_ang, 2.5)
    cv.part(ellipse(cv.blank(), bulb_c, 3.0, 3.0), STING)
    tip = polar(bulb_c, end_ang + 55, 6)
    barb = poly(cv.blank(), tapered(bulb_c, tip, 2.6, 0.6))
    cv.part(barb, STING, gloss=False)
    cv.pixel(*rnd(tip), VENOM[2] if glow_sting else STING[3])
    return tip, bulb_c


def draw_leg(cv, hip, foot, far=False):
    ramp = SAND_FAR if far else SAND
    knee = ik(hip, foot, 7.5, 9.5, up=True)
    cv.part(limb(hip, knee, 2), ramp, gloss=False)
    cv.part(limb(knee, foot, 2 if not far else 1), ramp, gloss=False)
    cv.pixel(foot[0] + (1 if foot[0] > hip[0] else -1), foot[1], ramp[0])


def draw_claw(cv, shoulder, elbow_ang, fore_ang, gape, far=False):
    """팔 두 마디 + 큰 집게(위 고정 손가락, 아래 움직이는 손가락). 몸보다 짙은 호박색이라 머리와 갈린다."""
    ramp = CLAW_FAR if far else CLAW
    elbow = polar(shoulder, elbow_ang, 6)
    wrist = polar(elbow, fore_ang, 6)
    cv.part(limb(shoulder, elbow, 3), ramp, gloss=False)
    cv.part(poly(cv.blank(), tapered(elbow, wrist, 3.0, 4.4)), ramp)
    palm = polar(wrist, fore_ang, 3)
    cv.part(ellipse(cv.blank(), palm, 4.4, 3.6), ramp)
    up_base, lo_base = polar(palm, fore_ang - 50, 2.2), polar(palm, fore_ang + 50, 2.2)
    up_tip = polar(palm, fore_ang - 10 - gape, 8)
    lo_tip = polar(palm, fore_ang + 14 + gape, 6.5)
    up_mid = polar(lerp(up_base, up_tip, 0.5), fore_ang - 100, 1.2)
    lo_mid = polar(lerp(lo_base, lo_tip, 0.5), fore_ang + 100, 1.0)
    cv.part(chain([up_base, up_mid, up_tip], [3.2, 2.4, 1.0]), ramp)
    cv.part(chain([lo_base, lo_mid, lo_tip], [2.8, 2.0, 1.0]), ramp, gloss=False)
    cv.pixel(*rnd(up_tip), ramp[3])
    return palm, up_tip, lo_tip


def draw_body(cv, P):
    hip = P["body"]  # 몸통 가운데 아랫선
    tilt = P["tilt"]
    head = polar(hip, tilt, 10)
    tail_base = polar(hip, tilt + 180, 12)
    f = P["feet"]
    # 먼 쪽 다리 4개 + 먼 집게
    for i, foot in enumerate(f["far"]):
        draw_leg(cv, add(lerp(tail_base, head, 0.3 + i * 0.16), (1, -1)), foot, far=True)
    draw_claw(cv, add(head, (0, -3)), P["far_claw"][0], P["far_claw"][1], P["far_claw"][2], far=True)
    # 마디진 배(뒤) + 머리가슴(앞)
    abd = poly(cv.blank(), tapered(tail_base, lerp(tail_base, head, 0.62), 7.5, 9.5, bulge=1.0))
    M = cv.part(abd, SAND)
    # 배 마디선
    for t in (0.18, 0.36, 0.54):
        c = lerp(tail_base, head, t)
        cv.line([add(c, (0, -4)), add(c, (-1, 3))], SAND[0])
    ceph = poly(cv.blank(), tapered(lerp(tail_base, head, 0.55), polar(head, tilt, 3), 10.0, 6.0, bulge=0.6))
    cv.part(ceph, SAND)
    cv.line([add(lerp(tail_base, head, 0.62), (0, -4)), add(head, (1, -3))], SAND[3])
    # 꼬리
    tip, bulb = draw_tail(cv, add(tail_base, (0, -2)), P["tail"][0], P["tail"][1], glow_sting=P["glow"])
    # 눈(머리 위 붉은 홑눈 둘)
    e = add(polar(head, tilt, 1), (0, -4))
    if P["eye"] == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], INK)
    else:
        cv.pixel(e[0], e[1], EYE)
        cv.pixel(e[0] + 1, e[1], PUPIL if P["glow"] else EYE)
        cv.pixel(e[0] - 2, e[1] + 1, EYE)
    # 가까운 쪽 다리 4개 + 가까운 집게
    for i, foot in enumerate(f["near"]):
        draw_leg(cv, add(lerp(tail_base, head, 0.28 + i * 0.16), (0, 2)), foot)
    palm, up_tip, lo_tip = draw_claw(cv, add(head, (1, -1)), *P["near_claw"])
    return dict(tip=tip, bulb=bulb, head=head, palm=palm, up_tip=up_tip)


BASE = dict(
    body=(26.0, 50.0), tilt=0, tail=(-80, 20), glow=False, eye="open",
    near_claw=(-20, 10, 18), far_claw=(-30, 0, 14),
    feet=dict(near=[(10, 59), (18, 59), (32, 59), (40, 59)], far=[(14, 59), (23, 59), (36, 59), (44, 58)]),
)


def params(name):
    p = dict(BASE)
    p["feet"] = {k: list(v) for k, v in BASE["feet"].items()}
    if name == "idle_a":
        pass
    elif name == "idle_b":  # 몸을 낮추고 꼬리를 살짝 늘이며 집게를 연다
        p.update(body=(26.0, 51.0), tail=(-76, 18), near_claw=(-14, 6, 24), far_claw=(-26, -4, 20))
    elif name == "idle_c":  # 몸을 세우고 꼬리를 바짝 감으며 집게를 닫는다
        p.update(body=(26.0, 49.5), tail=(-82, 21), near_claw=(-24, 14, 8), far_claw=(-34, 4, 6))
    elif name == "windup":  # 몸을 뒤로 빼며 꼬리를 바짝 감아올리고 집게를 높이 벌린다
        p.update(body=(23.0, 50.0), tilt=-8, tail=(-96, 25), near_claw=(-60, -30, 30), far_claw=(-70, -40, 26),
                 glow=True)
        p["feet"]["near"] = [(8, 59), (16, 59), (29, 59), (36, 59)]
        p["feet"]["far"] = [(12, 59), (21, 59), (33, 59), (41, 59)]
    elif name == "move":  # 낮게 엎드려 앞으로 쭉 달려든다
        p.update(body=(29.0, 52.0), tilt=4, tail=(-104, 20), near_claw=(0, 0, 22), far_claw=(-8, -6, 18))
        p["feet"]["near"] = [(10, 59), (22, 59), (34, 59), (46, 59)]
        p["feet"]["far"] = [(16, 59), (26, 59), (40, 59), (48, 59)]
    elif name == "attack":  # 꼬리를 머리 너머로 내리꽂아 독침으로 찌른다
        p.update(body=(24.0, 51.0), tilt=6, tail=(-72, 10), near_claw=(10, 20, 26), far_claw=(-4, 10, 20))
        p["feet"]["near"] = [(8, 59), (18, 59), (33, 59), (42, 59)]
    elif name == "recover":  # 스킬 독침: 독침을 앞으로 길게 내지르고 빛나는 독액
        p.update(body=(22.0, 50.0), tilt=-4, tail=(-78, 8), glow=True, near_claw=(-40, -10, 34),
                 far_claw=(-56, -24, 30))
    elif name == "hit":  # 맞고 앞이 들리며 뒤로 밀린다
        p.update(body=(24.0, 50.0), tilt=-16, tail=(-124, 26), eye="shut", near_claw=(-80, -60, 6),
                 far_claw=(-96, -70, 4))
        p["feet"]["near"] = [(6, 59), (14, 59), (26, 57), (33, 55)]
        p["feet"]["far"] = [(10, 59), (18, 59), (30, 56), (37, 54)]
    return p


def draw_dead(cv):
    """배를 깔고 납작 엎어져 다리를 오그리고, 꼬리가 바닥에 길게 늘어진 모습."""
    for hip, foot in (((24, 54), (20, 50)), ((30, 54), (28, 49)), ((36, 54), (38, 49)), ((42, 54), (46, 50))):
        cv.part(limb(hip, foot, 2), SAND_FAR, gloss=False)
    cv.part(poly(cv.blank(), tapered((18, 56), (40, 56), 7, 8, bulge=0.8)), SAND)
    for x in (24, 29, 34):
        cv.line([(x, 53), (x, 59)], SAND[0])
    cv.part(poly(cv.blank(), tapered((38, 56), (48, 57), 8, 5)), SAND)
    pts = [(18, 56), (13, 57), (8, 57), (4, 55), (3, 51)]
    for i in range(len(pts) - 1):
        cv.part(poly(cv.blank(), tapered(pts[i], pts[i + 1], 5 - i * 0.6, 4.4 - i * 0.6)), SAND)
    cv.part(ellipse(cv.blank(), (4, 49), 2.2, 2.2), STING)
    cv.line([(48, 54), (49, 54)], INK)
    for a, b in (((46, 55), (54, 53)), ((44, 58), (52, 58))):
        cv.part(poly(cv.blank(), tapered(a, b, 3.6, 1.6)), SAND_FAR)
    cv.part(ellipse(cv.blank(), (55, 52), 2.6, 2.0), SAND)
    cv.part(ellipse(cv.blank(), (53, 58), 2.6, 1.6), SAND)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    j = draw_body(Canvas(64, INK), P)
    if name == "attack":
        slash(cv, add(j["bulb"], (-4, -12)), add(j["tip"], (10, 8)), -7, 3.6, VENOM[2], WHITE)
    elif name == "move":
        puff(cv, (8, 56), 4.0, DUST)
    elif name == "recover":
        glow(cv, j["tip"], 9, [VENOM[0], VENOM[1]])
    j = draw_body(cv, P)
    if name == "attack":
        burst(cv, add(j["tip"], (1, 2)), 4.5, VENOM[2], WHITE, spikes=6, rot=10)
    elif name == "recover":
        # 독침 끝에서 아군 쪽으로 뿜는 독액 줄기: 굵은 방울이 포물선을 그리며 작아진다
        t = j["tip"]
        path = bezier(t, (t[0] + 16, t[1] - 10), (61, t[1] + 14), 7)
        for k, p in enumerate(path[1:], 1):
            r = max(0.8, 2.6 - k * 0.3)
            cv.put(ellipse(cv.blank(), p, r + 0.8, r + 0.8), VENOM[0])
            cv.put(ellipse(cv.blank(), p, r, r), VENOM[1] if k % 2 else VENOM[2])
            cv.pixel(p[0] - 0.5, p[1] - 0.8, VENOM[3])
        burst(cv, t, 4.0, VENOM[2], VENOM[3], spikes=6, rot=15)
        sparkle(cv, add(t, (-6, -5)), VENOM[3], VENOM[2], big=True)
        sparkle(cv, add(t, (9, -9)), VENOM[3], VENOM[2])
    elif name == "windup":
        glow(cv, j["tip"], 3.5, [VENOM[1], VENOM[2]])
        sparkle(cv, add(j["tip"], (3, -4)), VENOM[3], VENOM[2])
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((5, -6), (7, -4), (6, -8), (8, -2)):
            cv.pixel(h[0] + dx, h[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("scorpion-sand", draw, sys.argv[1:], idle_ms=170)

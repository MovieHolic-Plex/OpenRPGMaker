#!/usr/bin/env python3
"""뿔 마수 베히모스(behemoth-horn) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

보랏빛 거대한 네발 짐승: 높이 솟은 어깨 혹과 굵은 목, 등에 겹겹이 얹힌 뼈빛 어깨 판(뒤로 눕는 판 넷),
앞으로 내민 큰 머리에 넓은 코와 콧구멍, 이마에서 앞·위로 휘는 두 뿔, 아래턱에서 위로 휜 긴 엄니,
기둥 같은 넓은 네 다리와 갈라진 발톱, 끝에 털 다발 달린 꼬리. 오른쪽(아군)을 본다.
6번 칸(스킬, 아키타입 skill_earth): 앞발을 높이 들었다 내리찍어 아군 쪽으로 땅이 갈라지고 바위가 솟는다.

  python3 scripts/content/monsters/redraw_behemoth_horn.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import (Canvas, add, burst, chain, crack, ellipse, ik_side, lerp, polar, poly, puff, rnd, run, slash,
                       sparkle, speed_lines)

S = 96
GROUND = S - 4
INK = (26, 14, 36)
HIDE = [(66, 38, 92), (100, 60, 132), (138, 90, 170), (182, 136, 206)]
HIDE_FAR = [(46, 26, 66), (66, 38, 92), (84, 50, 114), (84, 50, 114)]
BELLY = [(110, 76, 130), (150, 110, 168), (186, 150, 200), (186, 150, 200)]
PLATE = [(130, 112, 96), (180, 162, 140), (220, 206, 182), (246, 238, 220)]
TUSK = [(176, 160, 128), (226, 214, 184), (248, 242, 224), (255, 255, 250)]
CLAW = (34, 22, 30)
EYE, EYE_HI = (255, 196, 40), (255, 250, 200)
MOUTH = (110, 30, 50)
ROCK = [(70, 62, 60), (106, 96, 90), (146, 136, 126), (190, 182, 170)]
DUST = [(120, 106, 100), (170, 158, 146)]
WHITE = (255, 252, 240)


def xf(o, a, pts):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return [(o[0] + x * c - y * s, o[1] + x * s + y * c) for x, y in pts]


def leg(cv, hip, foot, far=False, front=True):
    """굵은 허벅지 → 기둥 정강이 → 넓은 발과 발톱 셋. 앞다리 무릎은 뒤로, 뒷다리 뒤꿈치는 뒤로 꺾인다."""
    ramp = HIDE_FAR if far else HIDE
    ankle = add(foot, (0, -4))
    knee = ik_side(hip, ankle, 12.0, 11.0, forward=not front)
    cv.part(chain([hip, knee], [12.0 if not front else 10.5, 7.5]), ramp, gloss=False)
    cv.part(chain([knee, ankle], [7.5, 7.0]), ramp, gloss=False)
    f = rnd(foot)
    cv.part(poly(cv.blank(), [(f[0] - 5, f[1] - 5), (f[0] + 4, f[1] - 5), (f[0] + 6, f[1]), (f[0] - 5, f[1])]), ramp, gloss=False)
    for dx in (0, 3, 6):
        cv.put(poly(cv.blank(), [(f[0] + dx - 1, f[1] - 2), (f[0] + dx + 1, f[1] - 2), (f[0] + dx + 1, f[1]), (f[0] + dx - 1, f[1])]), CLAW)
    return knee


def body(cv, sh, hp, lift=0.0):
    """솟은 어깨 혹 → 내려가는 등 → 둥근 엉덩이, 아래는 처진 배. 등에 겹친 뼈 판."""
    top = [add(hp, (-6, 4)), add(hp, (-3, -6)), add(lerp(hp, sh, 0.45), (0, -10 - lift * 0.5)),
           add(sh, (-6, -18 - lift)), add(sh, (4, -16 - lift)), add(sh, (12, -6))]
    bot = [add(sh, (12, 12)), add(sh, (2, 18)), add(lerp(hp, sh, 0.5), (0, 19)), add(hp, (0, 15)), add(hp, (-6, 10))]
    M = cv.part(poly(cv.blank(), top + bot), HIDE)
    cv.part(poly(cv.blank(), [add(sh, (8, 10)), add(sh, (0, 17)), add(lerp(hp, sh, 0.45), (0, 18)), add(lerp(hp, sh, 0.4), (0, 14)),
                              add(sh, (0, 12))]), BELLY, gloss=False)
    # 겹친 뼈 판: 어깨 혹에서 엉덩이 쪽으로 뒤로 눕는 넷
    for i, t in enumerate((0.92, 0.72, 0.5, 0.28)):
        base = lerp(add(hp, (-2, -6)), add(sh, (-1, -18 - lift)), t)
        base = add(base, (0, 2 + i * 0.5))
        w = 9 - i * 1.2
        pts = [add(base, (w * 0.6, 3)), add(base, (w * 0.4, -3 - (3 - i) * 0.8)), add(base, (-w * 0.9, -5 - (3 - i) * 0.6)),
               add(base, (-w * 1.1, 1)), add(base, (-w * 0.3, 4))]
        cv.part(poly(cv.blank(), pts), PLATE, gloss=False)
        cv.line4([rnd(add(base, (w * 0.3, -2 - (3 - i) * 0.8))), rnd(add(base, (-w * 0.8, -4 - (3 - i) * 0.6)))], PLATE[3])
    return M


def head(cv, neck, tilt=0, mouth=0, eye="open"):
    """큰 머리: 넓은 이마 → 짧고 두꺼운 주둥이 → 넓은 코. 이마의 두 뿔은 앞·위로, 엄니는 위로 휜다."""
    P = lambda *pts: xf(neck, tilt, pts)
    # 먼 뿔(뒤에 깔림)
    cv.part(chain(P((3, -9), (6, -17), (13, -22), (18, -21)), [4.4, 3.4, 2.2, 1.0]), [INK] + TUSK[:3], gloss=False)
    skull = P((-6, -10), (6, -12), (16, -7), (23, -2), (25, 5), (22, 10), (10, 11), (0, 11), (-6, 6))
    cv.part(poly(cv.blank(), skull), HIDE)
    # 넓은 코 + 콧구멍
    cv.part(poly(cv.blank(), P((20, -3), (26, -1), (27, 6), (22, 8))), BELLY, gloss=False)
    for p in P((25, 1), (25, 4)):
        cv.pixel(*rnd(p), INK)
    if mouth:
        cv.put(poly(cv.blank(), P((8, 9), (22, 8), (20, 10 + mouth), (8, 11 + mouth * 0.5))), MOUTH)
    # 엄니: 아래턱에서 앞·위로 휜다
    cv.part(chain(P((16, 9 + mouth * 0.5), (24, 8), (28, 1), (27, -6)), [3.6, 3.0, 2.2, 1.0]), TUSK, gloss=False)
    # 가까운 뿔: 이마에서 앞·위로 굵게 휜다
    cv.part(chain(P((6, -10), (9, -19), (16, -25), (23, -24)), [5.4, 4.2, 2.6, 1.0]), TUSK, gloss=False)
    for t in P((9, -17), (13, -22)):
        cv.pixel(*rnd(t), TUSK[0])  # 뿔 마디
    # 귀
    cv.part(poly(cv.blank(), P((-2, -8), (-9, -12), (-6, -5))), HIDE_FAR, gloss=False)
    e = P((10, -4))[0]
    if eye == "shut":
        cv.line([add(e, (-2, 0)), add(e, (2, 1))], INK)
    else:
        cv.put(ellipse(cv.blank(), e, 1.6, 1.4), EYE)
        cv.pixel(*rnd(add(e, (1, 0))), EYE_HI if eye != "rage" else WHITE)
        cv.line([add(e, (-3, -3)), add(e, (3, -2))], INK)  # 찌푸린 눈두덩
    return dict(tip=P((27, -6))[0], horn=P((23, -24))[0], nose=P((26, 3))[0])


def tail(cv, hp, sway):
    t0 = add(hp, (-6, 2))
    pts = [t0, add(t0, (-5, 3 + sway)), add(t0, (-9, 8 + sway)), add(t0, (-10, 14 + sway * 0.5))]
    cv.part(chain(pts, [3.0, 2.4, 2.0, 1.6]), HIDE, gloss=False)
    cv.part(ellipse(cv.blank(), pts[-1], 2.6, 3.2), HIDE_FAR, gloss=False)  # 끝 털 다발


BASE = dict(sh=(54.0, 50.0), hp=(26.0, 54.0), tilt=10, mouth=0, eye="open", lift=0.0,
            feet=((62, 0), (54, 0), (30, 0), (22, 0)), tail=0)


def params(name):
    p = dict(BASE)
    if name == "idle_b":  # 숨: 어깨 혹이 부풀고 머리가 내려간다
        p.update(sh=(54.0, 51.0), hp=(26.0, 55.0), lift=2.0, tilt=14, tail=2)
    elif name == "idle_c":  # 앞발로 땅을 긁으며 콧김
        p.update(sh=(54.0, 49.0), tilt=6, mouth=1, feet=((65, -4), (54, 0), (30, 0), (22, 0)), tail=-2)
    elif name == "windup":  # 앞몸을 들어 올려 뒷발로 선다
        p.update(sh=(50.0, 40.0), hp=(26.0, 56.0), tilt=-20, mouth=4, eye="rage", lift=3.0,
                 feet=((62, -14), (56, -10), (30, 0), (22, 0)), tail=3)
    elif name == "move":  # 쿵쿵 돌진: 앞뒤 다리를 쭉 뻗는다
        p.update(sh=(58.0, 49.0), hp=(30.0, 52.0), tilt=16, eye="rage", feet=((72, -3), (64, 0), (28, 0), (20, -3)))
    elif name == "attack":  # 뿔·엄니로 퍼 올린다
        p.update(sh=(58.0, 50.0), hp=(30.0, 54.0), tilt=-18, mouth=5, eye="rage", feet=((68, 0), (60, 0), (34, 0), (26, 0)))
    elif name == "recover":  # 스킬: 앞발로 땅을 내리찍는다
        p.update(sh=(54.0, 53.0), hp=(26.0, 52.0), tilt=24, eye="rage", lift=2.0, mouth=2,
                 feet=((64, 0), (56, 0), (30, 0), (22, 0)), tail=2)
    elif name == "hit":  # 맞아서 뒤로 주저앉으며 머리를 젖힌다
        p.update(sh=(50.0, 52.0), hp=(24.0, 58.0), tilt=-26, eye="shut", mouth=3,
                 feet=((60, 0), (53, 0), (30, 0), (22, 0)), tail=4)
    return p


def draw_beast(cv, P):
    sh, hp, tilt = P["sh"], P["hp"], P["tilt"]
    hip_front = add(sh, (2, 8))
    hip_back = add(hp, (2, 6))
    (f1x, f1y), (f2x, f2y), (b1x, b1y), (b2x, b2y) = P["feet"]
    leg(cv, add(hip_front, (-4, -2)), (f2x, GROUND + f2y), far=True, front=True)
    leg(cv, add(hip_back, (4, -2)), (b2x, GROUND + b2y), far=True, front=False)
    tail(cv, hp, P["tail"])
    body(cv, sh, hp, P["lift"])
    leg(cv, hip_back, (b1x, GROUND + b1y), front=False)
    leg(cv, hip_front, (f1x, GROUND + f1y), front=True)
    j = head(cv, add(sh, (10, -4)), tilt, P["mouth"], P["eye"])
    j["head"] = add(sh, (18, -6))
    return j


def draw_dead(cv):
    """옆으로 쓰러진 거수: 다리가 앞으로 뻗고 뿔이 땅에 박힌다."""
    cv.part(poly(cv.blank(), [(14, 90), (18, 78), (32, 70), (52, 70), (64, 78), (64, 90)]), HIDE)
    for i, x in enumerate((24, 34, 44, 54)):
        cv.part(poly(cv.blank(), [(x + 4, 74), (x + 2, 68 - (i % 2)), (x - 6, 67), (x - 7, 72)]), PLATE, gloss=False)
    for hip, foot in (((26, 82), (16, 90)), ((50, 82), (40, 90))):  # 축 늘어져 뒤로 뻗은 다리
        cv.part(chain([hip, foot], [7, 5.5]), HIDE_FAR, gloss=False)
        for dx in (-2, 1):
            cv.pixel(int(foot[0] + dx - 2), int(foot[1] + 1), CLAW)
    cv.part(poly(cv.blank(), [(62, 80), (76, 78), (86, 84), (86, 91), (62, 91)]), HIDE)
    cv.part(chain([(70, 80), (74, 72), (80, 68), (86, 70)], [4.6, 3.6, 2.2, 1.0]), TUSK, gloss=False)
    cv.part(chain([(80, 90), (86, 88), (89, 82)], [3.0, 2.4, 1.0]), TUSK, gloss=False)
    cv.line([(72, 83), (75, 86)], INK)
    cv.line([(75, 83), (72, 86)], INK)
    cv.part(chain([(14, 84), (8, 88), (5, 90)], [2.4, 2.0, 1.6]), HIDE, gloss=False)
    puff(cv, (90, 84), 2.4, DUST)
    puff(cv, (10, 78), 2.4, DUST)


def draw(name):
    cv = Canvas(S, INK)
    if name == "dead":
        draw_dead(cv)
        return cv.image()
    P = params(name)
    if name == "move":
        speed_lines(cv, 3, 14, (34, 32, 48), HIDE[2])
        puff(cv, (14, 88), 3.6, DUST)
    j = draw_beast(cv, P)
    t = j["tip"]
    if name == "attack":
        slash(cv, add(j["horn"], (-10, 22)), add(j["horn"], (2, -6)), -6, 4.4, TUSK[2], WHITE)
        burst(cv, add(j["horn"], (4, 0)), 6.0, TUSK[2], WHITE, spikes=7, rot=20)
    elif name == "windup":
        sparkle(cv, add(j["horn"], (1, -2)), WHITE, TUSK[2], big=True)
        puff(cv, (24, 88), 3.0, DUST)
    elif name == "idle_c":
        puff(cv, add(j["nose"], (5, 1)), 1.8, DUST)
    elif name == "recover":
        # 앞발 자리에서 아군 쪽으로 갈라지는 땅 + 솟는 바위
        base = (P["feet"][0][0] + 4, GROUND)
        crack(cv, base, [(base[0] + 5, GROUND - 1), (base[0] + 10, GROUND), (base[0] + 16, GROUND - 1), (base[0] + 22, GROUND)], INK)
        for x, h, w in ((76, 10, 6), (84, 15, 7), (91, 8, 5)):
            cv.part(poly(cv.blank(), [(x - w / 2, GROUND), (x - w / 2 + 1, GROUND - h * 0.6), (x, GROUND - h), (x + w / 2, GROUND - h * 0.5),
                                      (x + w / 2, GROUND)]), ROCK)
        puff(cv, (base[0] - 2, GROUND - 4), 4.0, DUST)
        burst(cv, (base[0] + 2, GROUND - 6), 5.0, DUST[1], WHITE, spikes=6)
    elif name == "hit":
        h = j["head"]
        for dx, dy in ((12, -18), (15, -14), (14, -22), (17, -10)):
            cv.pixel(int(h[0] + dx), int(h[1] + dy), WHITE)
    return cv.image()


if __name__ == "__main__":
    run("behemoth-horn", draw, sys.argv[1:], S=S, idle_ms=260)

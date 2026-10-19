#!/usr/bin/env python3
"""청회색 목지느러미 도마뱀(salamander-01) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

땅에 배를 붙이고 다리를 옆으로 벌린 낮은 도롱뇽 체형(늑대·개처럼 다리로 몸을 들지 않는다): 길고 납작한 몸,
팔꿈치·무릎이 몸 옆 위로 솟고 발은 몸 앞뒤로 짚는다. 넓고 둥근 납작 머리, 머리 뒤 양옆의 깃털 같은 분홍 아가미 지느러미 셋,
머리 위쪽 안의 작은 금빛 눈, 넓은 입, 등을 따라 이어진 낮은 지느러미 볏, 굵게 시작해 가늘어지는 노 같은 꼬리.
청회색 피부에 짙은 반점, 연한 배. 6번 칸(스킬 물안개 숨): 고개를 쳐들고 아가미를 활짝 펴 입에서 차가운 물안개를 뿜는다.
draw_lizard() 는 salamander-flame 이 다른 생김새로 다시 쓴다.

  python3 scripts/content/monsters/redraw_salamander_01.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, puff, rnd, run, sparkle, speed_lines

G = 60
LOOK = dict(
    ink=(14, 24, 30),
    skin=[(56, 84, 96), (86, 122, 134), (122, 160, 168), (170, 200, 204)],
    far=[(40, 62, 72), (56, 84, 96), (66, 98, 110), (66, 98, 110)],
    belly=(196, 214, 206),
    spot=(36, 56, 66),
    crest=[(60, 100, 120), (90, 140, 160), (130, 180, 196), (130, 180, 196)],
    gill=[(190, 80, 110), (230, 120, 150), (250, 170, 190), (250, 170, 190)],
    eye=(250, 210, 60),
    mouth=(90, 26, 36),
)
MIST = [(150, 200, 220), (210, 236, 246), (250, 255, 255)]
DUST = [(110, 104, 92), (150, 144, 128)]
WHITE = (255, 255, 255)


def sprawl_leg(cv, L, root, foot, far, lift=0):
    ramp = L["far"] if far else L["skin"]
    knee = add(lerp(root, foot, 0.5), (0, -5 - lift))
    cv.part(chain([root, knee], [3.2, 2.6]), ramp, ink=L["ink"], gloss=False)
    cv.part(chain([knee, foot], [2.4, 2.0]), ramp, ink=L["ink"], gloss=False)
    f = rnd(foot)
    for dx in (-2, 0, 2):
        cv.line4([f, (f[0] + dx + 1, f[1] + (0 if f[1] >= G else 1))], ramp[1])


def draw_lizard(cv, L, x=30, lift=0.0, head_tilt=0, jaw=0, eye="open", tail_sw=0, step=0, gill=0, back=None, head_extra=None):
    """x = 몸 가운데. lift = 앞몸 들림. back(cv, pts) = 등 장식(볏·불꽃) 훅."""
    ink = L["ink"]
    hip, sh = (x - 9, G - 6), (x + 7, G - 7 - lift)
    # 꼬리(노 모양) 먼저
    tp = bezier(add(hip, (-3, 0)), add(hip, (-14, 3 + tail_sw)), add(hip, (-24, -4 - tail_sw)), 7)
    cv.part(chain(tp, [7, 6.5, 5.6, 4.6, 3.6, 2.6, 1.8, 1.0]), L["skin"], ink=ink, belly=L["belly"])
    # 먼 다리
    sprawl_leg(cv, L, add(hip, (1, -1)), (hip[0] - 4 - step, G), True)
    sprawl_leg(cv, L, add(sh, (-1, -1)), (sh[0] + 3 + step, G), True, lift * 0.5)
    # 몸통(낮고 길다)
    spine = [add(hip, (-2, 0)), lerp(hip, sh, 0.5), sh]
    body = chain(spine, [9, 10, 8.5])
    cv.part(body, L["skin"], ink=ink, belly=L["belly"])
    if back:
        back(cv, [tp[2], tp[1], spine[0], spine[1], spine[2]])
    for p in (lerp(hip, sh, 0.2), lerp(hip, sh, 0.55), lerp(hip, sh, 0.85), tp[2]):
        cv.pixel(*rnd(add(p, (0, -2))), L["spot"])
    # 머리: 넓고 납작, 앞몸 들림에 따라 기울어짐
    a = math.radians(head_tilt - lift * 2)
    hc = add(sh, (7, -2))
    R = lambda dx, dy: (hc[0] + dx * math.cos(a) - dy * math.sin(a), hc[1] + dx * math.sin(a) + dy * math.cos(a))
    if head_extra is None:  # 아가미 지느러미 셋(머리 뒤)
        for k, ang in enumerate((-150, -175, 160)):
            base = R(-4, -1 + k)
            tip = polar(base, ang + head_tilt - gill * 10 * (1 - k), 6 + gill * 2)
            cv.part(chain([base, tip], [2.6, 1.2]), L["gill"], ink=ink, gloss=False)
            cv.pixel(*rnd(lerp(base, tip, 0.6)), L["gill"][2])
    else:
        head_extra(cv, R)
    if jaw:
        cv.put(poly(cv.blank(), [R(0, 1), R(9, 0.5), R(9, 1 + jaw), R(0, 3)]), L["mouth"])
        cv.part(poly(cv.blank(), [R(-3, 2), R(8, 1 + jaw), R(8, 3 + jaw), R(-3, 4)]), L["skin"], ink=ink, gloss=False)
    skull = [R(-5, 3), R(-5, -2), R(-1, -4), R(5, -4), R(9, -2), R(10, 0), R(9, 1), R(-1, 3)] if jaw else \
            [R(-5, 3), R(-5, -2), R(-1, -4), R(5, -4), R(9, -2), R(10, 1), R(7, 3), R(-1, 4)]
    cv.part(poly(cv.blank(), skull), L["skin"], ink=ink, belly=L["belly"])
    if not jaw:
        cv.line4([rnd(R(1, 2)), rnd(R(8, 1))], ink)  # 넓은 입선
    e = rnd(R(3, -2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], ink)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 0)), add(e, (-1, 0))]), L["eye"])
        cv.pixel(e[0] + 1, e[1] - 1, ink)
        cv.pixel(e[0] + 1, e[1], ink)
    # 가까운 다리
    sprawl_leg(cv, L, add(hip, (2, 1)), (hip[0] + 3 + step, G), False)
    sprawl_leg(cv, L, add(sh, (0, 1)), (sh[0] + 7 - step, G), False, lift * 0.5)
    return dict(eye=e, mouth=R(10, 1 + jaw * 0.5), head=hc)


def crest(L):
    def back(cv, pts):
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            m = lerp(a, b, 0.5)
            cv.part(poly(cv.blank(), [add(a, (0, -4)), add(m, (0, -7)), add(b, (0, -4))]), L["crest"], ink=L["ink"], gloss=False)
    return back


def draw_dead(cv, L):
    j = draw_lizard(cv, L, x=32, head_tilt=8, eye="shut", tail_sw=-3, back=None)
    return j


def draw(name):
    cv = Canvas(64, LOOK["ink"])
    L = LOOK
    b = crest(L)
    if name == "dead":  # 배를 드러내고 뒤집힌 납작 몸
        from PIL import Image
        cv2 = Canvas(64, L["ink"])
        draw_lizard(cv2, L, x=32, eye="shut", back=b)
        im = cv2.image().transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        bb = im.getbbox()
        out = Image.new("RGBA", (64, 64))
        out.alpha_composite(im, (0, G - bb[3]))  # 뒤집힌 몸을 바닥선에 붙인다
        return out
    if name == "idle_a":
        draw_lizard(cv, L, back=b)
    elif name == "idle_b":
        draw_lizard(cv, L, lift=1, head_tilt=-4, tail_sw=3, gill=1, back=b)
    elif name == "idle_c":
        draw_lizard(cv, L, head_tilt=4, tail_sw=-3, jaw=1, back=b)
    elif name == "windup":  # 앞몸을 들고 입을 벌린다
        j = draw_lizard(cv, L, x=28, lift=5, head_tilt=-10, jaw=3, gill=2, tail_sw=4, back=b)
        sparkle(cv, add(j["eye"], (2, -6)), WHITE, L["eye"])
    elif name == "move":  # 몸을 비틀며 빠르게 기어간다
        speed_lines(cv, 1, 6, (40, 46, 52), L["skin"][2])
        draw_lizard(cv, L, x=35, tail_sw=6, step=3, back=b)
        puff(cv, (8, 58), 2.0, DUST)
    elif name == "attack":  # 머리를 내밀어 문다
        j = draw_lizard(cv, L, x=33, lift=2, head_tilt=6, jaw=4, step=-2, back=b)
        burst(cv, add(j["mouth"], (3, 0)), 4.0, MIST[1], WHITE, spikes=6)
    elif name == "recover":  # 스킬: 물안개 숨
        j = draw_lizard(cv, L, x=24, lift=6, head_tilt=-18, jaw=4, gill=3, tail_sw=3, back=b)
        m = j["mouth"]
        for k, (p, r) in enumerate((((44, 36), 3.2), ((50, 32), 4.2), ((57, 28), 4.6), ((55, 38), 3.4), ((61, 36), 2.4))):
            cv.put(ellipse(cv.blank(), p, r, r * 0.8), MIST[k % 2])
            cv.put(ellipse(cv.blank(), add(p, (-0.6, -0.6)), r * 0.5, r * 0.4), MIST[2])
        cv.line4([rnd(m), (42, 37)], MIST[1])
    elif name == "hit":
        j = draw_lizard(cv, L, x=27, lift=3, head_tilt=-26, jaw=1, eye="shut", tail_sw=-5, back=b)
        e = j["eye"]
        for dx, dy in ((3, -7), (6, -5), (5, -10)):
            cv.pixel(e[0] + dx, e[1] + dy, WHITE)
    return cv.image()


if __name__ == "__main__":
    run("salamander-01", draw, sys.argv[1:], idle_ms=210)

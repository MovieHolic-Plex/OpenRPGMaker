#!/usr/bin/env python3
"""불꽃 강아지(fire-pup) 전투 시트 3x3x64 + 초상 64 를 관절 좌표로 직접 그린다.

늑대 네발 뼈대(redraw_wolf_grey.py)를 작게 줄이고(몸 길이 약 2/3) 강아지로 새로 그렸다: 주황색 두꺼운 털,
밝은 크림 목덜미, 짧고 둥근 주둥이, 머리에 비해 큰 둥근 귀(끝이 붉게 탄다), 큰 갈색 눈, 짧은 다리,
꼬리 대신 위로 타오르는 세 갈래 불꽃 꼬리. 늑대보다 머리가 크고 다리가 짧은 아기 비율.
6번 칸(스킬 불꽃 짖기): 앞발을 버티고 짖어 입에서 둥근 불덩이 셋을 앞으로 뱉는다.

  python3 scripts/content/monsters/redraw_fire_pup.py [--preview DIR]
"""
from __future__ import annotations

import sys

import redraw_wolf_grey as W
from pixel_lib import Canvas, add, chain, ellipse, flame, lerp, poly, rnd, run, sparkle

W.INK = (40, 16, 8)
W.FUR = [(190, 84, 24), (232, 124, 40), (250, 168, 70), (255, 214, 140)]
W.FUR_FAR = [(140, 56, 18), (190, 84, 24), (210, 100, 30), (210, 100, 30)]
W.CREAM = [(230, 190, 140), (250, 226, 186), (255, 244, 220), (255, 255, 244)]
W.EYE, W.EYE_HI = (80, 40, 20), (255, 255, 255)
FIRE = [(220, 50, 20), (250, 130, 30), (255, 210, 80), (255, 250, 210)]
SC = 0.72  # 몸 축척


def scale_params(p):
    cx, gy = 32.0, W.GROUND
    f = lambda q: (cx + (q[0] - cx) * SC + 4, gy + (q[1] - gy) * SC)
    p["sh"], p["hp"] = f(p["sh"]), f(p["hp"])
    p["feet"] = tuple(((cx + (x - cx) * SC + 4), y * SC) for x, y in p["feet"])
    return p


_params = W.params
W.params = lambda name: scale_params(_params(name))


def leg(cv, hip, foot, far=False, front=True):
    """짧고 통통한 강아지 다리 + 둥근 발."""
    ramp = W.FUR_FAR if far else W.FUR
    foot = add(foot, (0, -1))
    mid = lerp(hip, foot, 0.5)
    cv.part(chain([hip, add(mid, (-1 if front else 1, 0)), foot], [4.4, 3.4, 3.0]), ramp, gloss=False)
    cv.part(ellipse(cv.blank(), add(foot, (1, 0)), 2.2, 1.4), ramp, gloss=False)
    return mid


def body(cv, sh, hp, breath=0.0):
    pts = [add(hp, (-4, -2)), add(lerp(hp, sh, 0.5), (0, -4)), add(sh, (0, -4)), add(sh, (5, -1)),
           add(sh, (5, 5 + breath)), add(sh, (0, 7 + breath)), add(hp, (2, 5)), add(hp, (-4, 3))]
    M = cv.part(poly(cv.blank(), pts), W.FUR)
    cv.put(poly(cv.blank(), [add(sh, (4, 4 + breath)), add(sh, (0, 7 + breath)), add(hp, (3, 4)), add(sh, (0, 4))]), W.CREAM[1])
    return M


def ruff(cv, sh, puffed=0.0):
    """밝은 크림 목덜미 털 뭉치."""
    pts = [add(sh, (-2, -3)), add(sh, (2, -5 - puffed)), add(sh, (7, -2)), add(sh, (7, 4)), add(sh, (3, 6)), add(sh, (-1, 2))]
    cv.part(poly(cv.blank(), pts), W.CREAM)


def tail(cv, hp, lift=0.0):
    """엉덩이 위로 타오르는 세 갈래 불꽃 꼬리."""
    base = add(hp, (-3, -2))
    cv.part(chain([add(hp, (-1, 0)), base], [3, 3]), W.FUR, gloss=False)
    flame(cv, add(base, (-2, 2)), 11 + lift, 8, FIRE[:3], lean=-1.5, tongues=3, seed=int(lift * 3))
    cv.part(ellipse(cv.blank(), add(base, (-1, 1)), 2.4, 2.0), W.FUR, gloss=False)
    return None


def head(cv, neck, tilt=0, mouth=0, eye="open", ears=0.0):
    """머리가 크다: 둥근 두개골, 짧은 주둥이, 큰 둥근 귀(끝이 붉게 탄다), 큰 눈."""
    P = lambda *pts: W.xf(neck, tilt, pts)
    jaw_o = P((4, 5))[0]
    jaw = W.xf(jaw_o, mouth, [(0, -1), (6, 0), (6, 2), (1, 3)])
    if mouth:
        cv.put(poly(cv.blank(), P((4, 3), (10, 3)) + [jaw[1], jaw[0]]), W.MOUTH)
    cv.part(poly(cv.blank(), jaw), W.CREAM, gloss=False)
    skull = P((-5, -1), (-4, -6), (1, -9), (6, -8), (9, -4), (11, 0), (11, 3), (5, 5), (-3, 5))
    cv.part(poly(cv.blank(), skull), W.FUR)
    cv.put(poly(cv.blank(), P((6, 1), (11, 1), (10, 4), (5, 4))), W.CREAM[2])
    e = ears
    for k, ramp in ((-4, W.FUR_FAR), (1, W.FUR)):
        ear = [P((k - 2 + 4 * t - e * 3 * (1 - t), -6 - 7 * (1 - abs(t - 0.5) * 1.6) + e * 4))[0] for t in (0, 0.25, 0.5, 0.75, 1)]
        cv.part(poly(cv.blank(), ear), ramp, gloss=False)
        cv.pixel(*rnd(P((k - e * 2, -11 + e * 4))[0]), FIRE[0])
    cv.pixel(*rnd(P((11, 0))[0]), W.NOSE)
    cv.pixel(*rnd(P((11, 1))[0]), W.NOSE)
    ey = rnd(P((5, -3))[0])
    if eye == "shut":
        cv.line([add(ey, (-1, 0)), add(ey, (1, 0))], W.INK)
    else:
        cv.put(poly(cv.blank(), [add(ey, (-1, -1)), add(ey, (1, -1)), add(ey, (1, 1)), add(ey, (-1, 1))]), W.EYE)
        cv.pixel(ey[0], ey[1] - 1, W.EYE_HI)
    return dict(snout=P((12, 1))[0], mouth=lerp(P((10, 3))[0], jaw[1], 0.5))


W.leg, W.body, W.ruff, W.tail, W.head = leg, body, ruff, tail, head


def draw_bark(cv):
    P = W.params("idle_a")
    P.update(tilt=-8, mouth=26)
    j = W.draw_wolf(cv, P)
    m = j["mouth"]
    for t, r in ((0.25, 2.2), (0.6, 3.2), (1.0, 4.2)):
        c = lerp(add(m, (2, 0)), (57, m[1] - 4), t)
        cv.put(ellipse(cv.blank(), c, r, r), FIRE[0])
        cv.put(ellipse(cv.blank(), add(c, (-0.5, -0.5)), r * 0.7, r * 0.7), FIRE[1])
        cv.put(ellipse(cv.blank(), add(c, (-1, -1)), r * 0.35, r * 0.35), FIRE[3])
    sparkle(cv, (60, m[1] - 10), FIRE[3], FIRE[2])


def draw_dead(cv):
    for hip, foot in (((22, 56), (26, 53)), ((34, 56), (38, 53))):
        cv.part(chain([hip, foot], [3, 2.6]), W.FUR_FAR, gloss=False)
    cv.part(poly(cv.blank(), [(16, 59), (20, 52), (34, 51), (38, 55), (36, 59)]), W.FUR)
    cv.part(ellipse(cv.blank(), (42, 54), 6, 5), W.FUR)
    cv.part(poly(cv.blank(), [(38, 51), (36, 44), (42, 50)]), W.FUR_FAR, gloss=False)
    cv.line([(41, 52), (43, 54)], W.INK)
    cv.line([(43, 52), (41, 54)], W.INK)
    cv.pixel(48, 55, W.NOSE)
    flame(cv, (14, 59), 5, 6, [(120, 100, 90), (170, 150, 130)], tongues=2)


def drop_specks(im, keep=3):
    """불꽃 끝에서 떨어져 나온 1~2px 부스러기를 지운다(본체·효과 덩어리는 그대로)."""
    import numpy as np
    from PIL import Image
    a = np.array(im)
    A = a[..., 3] > 0
    seen = np.zeros_like(A)
    H, Wd = A.shape
    for y in range(H):
        for x in range(Wd):
            if A[y, x] and not seen[y, x]:
                st, comp = [(y, x)], []
                seen[y, x] = True
                while st:
                    cy, cx = st.pop()
                    comp.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < H and 0 <= nx < Wd and A[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
                if len(comp) < keep:
                    for cy, cx in comp:
                        a[cy, cx, 3] = 0
    return Image.fromarray(a, "RGBA")


def draw(name):
    return drop_specks(_draw(name))


def _draw(name):
    if name == "recover":
        cv = Canvas(64, W.INK)
        draw_bark(cv)
        return cv.image()
    if name == "dead":
        cv = Canvas(64, W.INK)
        draw_dead(cv)
        return cv.image()
    return W.draw(name)


if __name__ == "__main__":
    run("fire-pup", draw, sys.argv[1:], idle_ms=170)

#!/usr/bin/env python3
"""밴시(banshee-wail) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

창백한 여인 망령: 뒤로 길게 흩날리는 청회색 긴 머리카락(몸 길이만큼), 야윈 옆얼굴의 긴 코와 크게 벌어지는 입,
움푹한 검은 눈, 가는 목과 어깨, 허리 아래 주름 많은 치마가 바닥 위에서 가늘게 흩어진다. 가는 팔 둘.
천 유령(ghost-pale)·후드 유령과 달리 얼굴과 머리카락이 실루엣의 중심이다.
6번 칸(스킬 통곡): 머리를 뒤로 젖혔다가 앞으로 내밀며 입을 찢어지게 벌려 겹겹의 음파 고리를 내지른다.

  python3 scripts/content/monsters/redraw_banshee_wail.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, lerp, polar, poly, ring, rnd, run, sparkle

INK = (22, 26, 44)
HAIR = [(70, 86, 110), (104, 122, 148), (146, 164, 188), (190, 204, 222)]
SKIN = [(150, 166, 180), (192, 206, 216), (226, 234, 240), (248, 252, 255)]
DRESS = [(90, 104, 130), (128, 144, 170), (170, 186, 206), (210, 222, 236)]
DRESS_FAR = [(70, 82, 106), (90, 104, 130), (108, 124, 150), (108, 124, 150)]
HOLLOW = (14, 14, 26)
MOUTH = (30, 20, 40)
WAIL = [(130, 190, 230), (210, 240, 255), (255, 255, 255)]


def hair(cv, crown, flow, wave):
    """정수리에서 뒤로 흩날리는 머리 다발 셋(길이·높이 다르게). flow = 뒤로 뻗는 길이."""
    for k, (dy, ln, w) in enumerate(((-2, flow, 5.0), (2, flow * 0.85, 4.4), (6, flow * 0.7, 3.6))):
        a = add(crown, (-1, dy))
        c = add(a, (-ln * 0.5, 4 + math.sin(wave + k) * 3))
        b = add(a, (-ln, 8 + k * 3 + math.cos(wave + k * 1.3) * 3))
        pts = bezier(a, c, b, 7)
        cv.part(chain(pts, [w, w, w * 0.9, w * 0.8, w * 0.7, w * 0.5, w * 0.35, 1.0]), HAIR, ink=INK, gloss=False)
        cv.line4(pts[1:6], HAIR[2] if k == 0 else HAIR[1])


def draw_banshee(cv, c=(36, 18), tilt=0.0, flow=22, wave=0.0, mouth=2, eye="open", near=(70, 12), far=(100, 11), sway=0.0, bob=0):
    c = add(c, (0, bob))
    a = math.radians(tilt)
    R = lambda dx, dy: (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    neck = add(c, (-2, 8))
    waist = add(neck, (-3 + sway * 0.2, 14))
    # 먼 팔
    sf = add(neck, (-3, 3))
    ef = polar(sf, far[0], far[1] * 0.5)
    hf = polar(ef, far[0] + 15, far[1] * 0.5)
    cv.part(chain([sf, ef, hf], [2.4, 2.0, 1.8]), [SKIN[0], SKIN[0], SKIN[1], SKIN[1]], ink=INK, gloss=False)
    hair(cv, R(-3, -6), flow, wave)
    # 치마: 허리에서 넓게, 끝은 가늘게 갈라져 바닥 위로 흩어진다
    hem = 56 + bob * 0.3
    skirt = [add(waist, (-4, 0)), add(waist, (4, 0)), (waist[0] + 10, hem - 6), (waist[0] + 7 - sway, hem),
             (waist[0] + 3 - sway, hem - 4), (waist[0] - 1 - sway, hem + 1), (waist[0] - 5 - sway, hem - 4),
             (waist[0] - 10 - sway * 1.5, hem), (waist[0] - 12 - sway * 1.5, hem - 7)]
    M = cv.part(poly(cv.blank(), skirt), DRESS, ink=INK)
    cv.shade_side(M, DRESS[0], side=-1, depth=2)
    for k in range(4):  # 주름
        x0 = waist[0] - 3 + k * 2.5
        cv.line4([(x0, waist[1] + 3), (x0 + (k - 1.5) * 2.5 - sway * 0.5, hem - 3)], DRESS[0])
    # 몸통(가는 허리·어깨)
    cv.part(poly(cv.blank(), [add(neck, (-4, 1)), add(neck, (4, 1)), add(waist, (3, 0)), add(waist, (-4, 0))]), DRESS, ink=INK)
    cv.part(chain([neck, R(-1, 4)], [3, 3]), SKIN, ink=INK, gloss=False)
    # 옆얼굴: 긴 코, 벌어지는 입(턱이 아래로)
    jaw = [R(-1, 3), R(4, 3 + mouth * 0.5), R(4, 5 + mouth), R(0, 5 + mouth * 0.7)]
    cv.put(poly(cv.blank(), [R(0, 2), R(5, 2), R(4, 4 + mouth), R(0, 4)]), MOUTH)
    cv.part(poly(cv.blank(), jaw), SKIN, ink=INK, gloss=False)
    head = [R(-5, -1), R(-4, -6), R(1, -8), R(5, -6), R(6, -2), R(9, 1), R(6, 2), R(5, 3), R(0, 3), R(-4, 2)]
    cv.part(poly(cv.blank(), head), SKIN, ink=INK)
    # 이마를 덮는 앞머리
    cv.part(poly(cv.blank(), [R(-5, -2), R(-4, -7), R(2, -9), R(6, -6), R(1, -5), R(-2, -3)]), HAIR, ink=INK, gloss=False)
    e = rnd(R(3, -2))
    if eye == "shut":
        cv.line([add(e, (-1, 0)), add(e, (1, 0))], HOLLOW)
    else:
        cv.put(poly(cv.blank(), [add(e, (-1, -1)), add(e, (1, -1)), add(e, (1, 1)), add(e, (-1, 1))]), HOLLOW)
        cv.pixel(e[0] + 1, e[1], WAIL[1] if eye == "wide" else SKIN[2])
    # 가까운 팔(가늘고 긴 손가락)
    sn = add(neck, (2, 3))
    en = polar(sn, near[0], near[1] * 0.5)
    hn = polar(en, near[0] + 15, near[1] * 0.5)
    cv.part(chain([sn, en, hn], [2.8, 2.2, 2.0]), SKIN, ink=INK, gloss=False)
    for k in (-25, 0, 25):
        cv.line4([rnd(hn), rnd(polar(hn, near[0] + 15 + k, 3))], SKIN[2])
    return dict(mouth=R(5, 3 + mouth * 0.5), eye=R(3, -2), hand=hn)


POSES = dict(
    idle_a=dict(),
    idle_b=dict(bob=-2, wave=1.3, flow=24, mouth=3, near=(80, 12), sway=1),
    idle_c=dict(bob=-1, wave=2.6, flow=20, tilt=6, mouth=1, near=(60, 12), far=(90, 11), sway=-1),
    windup=dict(c=(32, 19), tilt=-30, wave=0.4, flow=16, mouth=4, eye="wide", near=(-120, 12), far=(-140, 11), sway=-2),
    move=dict(c=(42, 18), tilt=12, wave=1.9, flow=28, mouth=2, near=(10, 13), far=(30, 12), sway=4, bob=1),
    attack=dict(c=(42, 20), tilt=20, wave=3.1, flow=26, mouth=5, eye="wide", near=(10, 14), far=(25, 13), sway=3),
    recover=dict(c=(32, 19), tilt=-8, wave=2.2, flow=26, mouth=8, eye="wide", near=(150, 12), far=(170, 11), sway=1),
    hit=dict(c=(30, 20), tilt=-34, wave=4.0, flow=14, mouth=4, eye="shut", near=(-150, 11), far=(-170, 10), sway=-3),
)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        cv.part(chain(bezier((44, 54), (28, 50), (8, 56), 7), [6, 5.4, 4.8, 4, 3.2, 2.4, 1.6, 1.0]), HAIR, ink=INK, gloss=False)
        cv.part(poly(cv.blank(), [(22, 59), (28, 53), (40, 52), (46, 56), (44, 59)]), DRESS, ink=INK)
        cv.part(ellipse(cv.blank(), (50, 55), 4.5, 3.5), SKIN, ink=INK)
        cv.line([(50, 54), (52, 56)], HOLLOW)
        cv.line([(52, 54), (50, 56)], HOLLOW)
        cv.part(chain([(46, 58), (58, 58)], [2, 1.8]), SKIN, ink=INK, gloss=False)
        return cv.image()
    P = dict(POSES[name])
    j = draw_banshee(cv, **P)
    m = j["mouth"]
    if name == "attack":
        for r in (4, 7):
            ring(cv, add(m, (1, 0)), r, -50, 50, WAIL[1] if r == 4 else WAIL[0])
        burst(cv, add(m, (8, 1)), 3.5, WAIL[1], WAIL[2], spikes=6)
        cv.line4([add(m, (1, 0)), add(m, (8, 1))], WAIL[0])
    elif name == "recover":
        for r, col in ((5, WAIL[2]), (9, WAIL[1]), (13, WAIL[1]), (17, WAIL[0]), (21, WAIL[0])):
            ring(cv, m, r, -38, 38, col, width=1 if r < 13 else 2)
        cv.line4([m, add(m, (21, 0))], WAIL[1])
        sparkle(cv, add(m, (23, -9)), WAIL[2], WAIL[0])
    elif name == "windup":
        sparkle(cv, add(j["eye"], (4, -6)), WAIL[2], WAIL[0], big=True)
    elif name == "move":
        for y in (30, 38):
            cv.line4([(4, y), (11, y)], HAIR[2])
    elif name == "hit":
        e = j["eye"]
        for dx, dy in ((5, -6), (7, -3), (3, -9)):
            cv.pixel(*rnd(add(e, (dx, dy))), WAIL[2])
    return cv.image()


if __name__ == "__main__":
    run("banshee-wail", draw, sys.argv[1:], idle_ms=200)

#!/usr/bin/env python3
"""금관 쓴 파란 슬라임(king-slime-01) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

칸을 거의 채우는 거대한 파랑 젤리 왕: 바닥에 넓게 퍼진 두 단(아랫단이 옆으로 흘러내린다) 몸,
정수리에 얹힌 세 갈래 금빛 왕관과 가운데 붉은 보석, 얼굴 축 앞쪽 아래에 크게 벌어지는 넓은 턱,
몸속을 떠도는 기포. 짧은 슬라임과 달리 무게 때문에 몸이 출렁이며 왕관이 기운다.
6번 칸(스킬 왕의 짓누르기 파도): 몸을 높이 세워 왕관 보석이 번쩍이고, 앞쪽 바닥으로 젤리 파도를 밀어낸다.

  python3 scripts/content/monsters/redraw_king_slime_01.py [--preview DIR]
"""
from __future__ import annotations

import sys

from jelly_rig import beads, eyes, jelly, puddle, superblob
from pixel_lib import Canvas, add, burst, ellipse, lerp, poly, rnd, run, sparkle

INK = (12, 20, 60)
BODY = [(26, 64, 168), (46, 104, 220), (96, 160, 246), (190, 226, 255)]
SKIRT = [(20, 50, 140), (36, 84, 196), (70, 130, 232), (150, 200, 255)]
BUBBLE = (140, 200, 255)
GOLD = [(150, 96, 20), (214, 160, 40), (250, 214, 80), (255, 248, 190)]
GOLD_INK = (70, 40, 10)
GEM = (220, 30, 50)
GEM_HI = (255, 180, 190)
EYE = (8, 12, 40)
MOUTH = (14, 20, 70)
TOOTH = (236, 244, 255)
WAVE = [(60, 130, 230), (160, 214, 255), (255, 255, 255)]
GROUND = 59


def crown(cv, c, tilt=0.0, up=0):
    """세 갈래 금관: 띠 + 갈래 셋(가운데 가장 높고 붉은 보석) + 끝 구슬."""
    x, y = c
    k = tilt
    band = [(x - 8, y + 1 + k), (x + 8, y + 1 - k), (x + 8, y - 2 - k), (x - 8, y - 2 + k)]
    spikes = [(x - 8, y - 2 + k), (x - 7, y - 8 + k - up), (x - 4, y - 3 + k * 0.5),
              (x, y - 11 - up), (x + 4, y - 3 - k * 0.5), (x + 7, y - 8 - k - up), (x + 8, y - 2 - k)]
    cv.part(poly(cv.blank(), band + spikes[::-1][:0] + spikes), GOLD, ink=GOLD_INK, gloss=False)
    cv.part(poly(cv.blank(), band), GOLD, ink=GOLD_INK)
    for px, py in ((x - 7, y - 9 + k - up), (x, y - 12 - up), (x + 7, y - 9 - k - up)):
        cv.pixel(px, py, GOLD[3])
    g = rnd((x, y - 1))
    cv.put(poly(cv.blank(), [add(g, (0, -2)), add(g, (2, 0)), add(g, (0, 2)), add(g, (-2, 0))]), GEM)
    cv.pixel(g[0] - 1, g[1] - 1, GEM_HI)
    return (x, y - 12 - up)


POSES = dict(
    idle_a=dict(cx=30, w=50, h=32, lean=0, tilt=0),
    idle_b=dict(cx=30, w=53, h=29, lean=0, tilt=0.5, mouth=1),
    idle_c=dict(cx=30, w=48, h=34, lean=1.5, tilt=-0.5),
    windup=dict(cx=28, w=56, h=25, lean=-3, tilt=1.5, eye="angry", mouth=2),
    move=dict(cx=33, w=46, h=36, lean=4, base=55, tilt=-1, eye="angry", mouth=2),
    attack=dict(cx=34, w=54, h=27, lean=7, tilt=-2, eye="angry", mouth=6),
    recover=dict(cx=27, w=44, h=40, lean=-2, tilt=0, eye="angry", mouth=4, up=2),
    hit=dict(cx=27, w=52, h=27, lean=-5, tilt=2, eye="shut", mouth=3),
)


def draw_king(cv, cx, w, h, lean=0.0, base=GROUND, tilt=0.0, eye="open", mouth=0, up=0):
    # 아랫단: 옆으로 흘러내린 넓은 치마(몸보다 넓고 낮다)
    cv.part(poly(cv.blank(), superblob(cx, base, w + 6, 9, n=2.8, flare=2.0)), SKIRT, ink=INK, gloss=False)
    pts = superblob(cx, base - 4, w, h - 4, n=2.3, lean=lean, flare=0.5)
    top = base - h
    bubbles = [((cx - w * 0.25, base - h * 0.3), 2.0, BUBBLE), ((cx - w * 0.05, base - h * 0.55), 1.2, BUBBLE),
               ((cx - w * 0.32, base - h * 0.6), 0.5, BUBBLE), ((cx + w * 0.08, base - h * 0.25), 0.5, BUBBLE),
               ((cx - w * 0.15, base - h * 0.78), 0.5, BUBBLE)]
    jelly(cv, pts, BODY, INK, bubbles=bubbles, shine=((cx - w * 0.28 + lean * 0.4, top + 7), ((0, 0), (1, 0), (2, 0), (0, 1), (4, -1))))
    # 치마와 몸 사이 접힌 선
    cv.line([(cx - w * 0.42, base - 5), (cx + w * 0.42, base - 5)], SKIRT[0])
    crown_c = (cx + lean * 0.9 - 1, top + 3)
    jewel = crown(cv, rnd(crown_c), tilt, up)
    ex = cx + w * 0.2 + lean * 0.7
    ey = base - h * 0.55
    eyes(cv, (ex + 6, ey), (ex - 1, ey), eye, EYE, size=3)
    for e in (ex - 1, ex + 6):  # 두툼한 눈두덩
        cv.line([rnd((e - 2, ey - 5)), rnd((e + 2, ey - 5 + (1 if eye == "angry" else 0)))], INK)
    # 넓은 턱: 입 꼬리가 얼굴 끝까지 이어진다
    m = (ex + 3, ey + 7)
    if mouth >= 3:
        cv.put(poly(cv.blank(), [add(m, (-6, -1)), add(m, (6, -2)), add(m, (5, mouth - 1)), add(m, (-4, mouth))]), MOUTH)
        for dx in (-4, -1, 2, 5):
            cv.pixel(*rnd(add(m, (dx, -1 if dx < 3 else -2))), TOOTH)
    else:
        cv.line([rnd(add(m, (-6, -1 - mouth))), rnd(add(m, (0, 0))), rnd(add(m, (6, -1 - mouth)))], MOUTH)
    return dict(mouth=m, jewel=jewel, front=(cx + w / 2 + 2, base - 3), back=(cx - w / 2 - 3, base - 3))


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        puddle(cv, 31, GROUND, 56, 6, BODY, INK, bumps=((22, 3.0), (36, 2.5)))
        # 떨어져 뒹구는 왕관(웅덩이에 걸쳐 있다)
        crown(cv, (46, 55), tilt=2.5)
        for e in ((26, 56), (31, 56)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], EYE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        beads(cv, (12, GROUND - 1), (20, 50), 1.6, 3.6, WAVE, n=5)
    j = draw_king(cv, **P)
    if name == "attack":
        f = j["front"]
        burst(cv, add(f, (-4, -9)), 5.5, WAVE[1], WAVE[2], spikes=7, rot=5)
    elif name == "recover":
        # 앞 바닥으로 밀려가는 젤리 파도 두 겹 + 보석 번쩍
        f = j["front"]
        for k, (dx, hh) in enumerate(((3, 9), (9, 6))):
            base = (f[0] + dx, GROUND)
            pts = [(base[0] - 4, GROUND), (base[0] - 2, GROUND - hh), (base[0] + 2, GROUND - hh - 1),
                   (base[0] + 5, GROUND - hh + 2), (base[0] + 3, GROUND - 3), (base[0] + 6, GROUND)]
            cv.part(poly(cv.blank(), pts), BODY, ink=INK, gloss=False)
            cv.pixel(int(base[0]) + 1, GROUND - hh + 1, WAVE[2])
        sparkle(cv, add(j["jewel"], (0, 9)), (255, 255, 255), GEM_HI, big=True)
    elif name == "windup":
        sparkle(cv, add(j["jewel"], (0, 9)), (255, 255, 255), GOLD[3])
    elif name == "hit":
        beads(cv, add(j["back"], (2, -6)), add(j["back"], (-1, -16)), 2.4, 1.0, WAVE, n=4)
    return cv.image()


if __name__ == "__main__":
    run("king-slime-01", draw, sys.argv[1:], idle_ms=240)

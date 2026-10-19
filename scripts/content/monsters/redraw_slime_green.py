#!/usr/bin/env python3
"""초록 슬라임(slime-green) 전투 시트 3x3x64 + 초상 64 를 직접 그린다.

연두색 풀잎 젤리: 아래가 넓고 위가 둥글게 솟은 몸, 정수리에서 뒤로 휘어 자란 긴 잎 볏(잎맥 한 줄),
등 뒤쪽 아래로 겹친 잎 주름 두 장, 몸속 작은 녹색 기포. 잎 볏은 숨쉴 때마다 흔들린다.
6번 칸(스킬 잎날 날리기): 몸을 뒤로 젖히고 잎 볏을 앞으로 휘둘러 회전하는 잎날 셋을 줄지어 날린다.

  python3 scripts/content/monsters/redraw_slime_green.py [--preview DIR]
"""
from __future__ import annotations

import math
import sys

from jelly_rig import beads, eyes, jelly, puddle, superblob
from pixel_lib import Canvas, add, bezier, burst, chain, ellipse, polar, poly, rnd, run, slash

INK = (18, 40, 18)
BODY = [(70, 140, 40), (118, 190, 60), (170, 226, 96), (230, 250, 180)]
LEAF = [(36, 96, 36), (60, 140, 50), (104, 184, 70), (160, 220, 110)]
VEIN = (196, 236, 140)
BUBBLE = (200, 240, 140)
EYE = (20, 34, 14)
MOUTH = (40, 70, 20)
SAP = [(120, 200, 60), (210, 250, 150), (255, 255, 230)]
GROUND = 59


def leaf(cv, base, ang, length, width, ramp=LEAF, vein=True):
    """잎 한 장: base 에서 ang 방향으로 길이 length, 가운데가 가장 넓은 버들잎."""
    tip = polar(base, ang, length)
    nx, ny = math.cos(math.radians(ang + 90)), math.sin(math.radians(ang + 90))
    pts = [base]
    for t in (0.2, 0.45, 0.7):
        c = polar(base, ang, length * t)
        w = width * math.sin(math.pi * (t * 0.85 + 0.1))
        pts.append((c[0] + nx * w / 2, c[1] + ny * w / 2))
    pts.append(tip)
    for t in (0.7, 0.45, 0.2):
        c = polar(base, ang, length * t)
        w = width * math.sin(math.pi * (t * 0.85 + 0.1))
        pts.append((c[0] - nx * w / 2, c[1] - ny * w / 2))
    cv.part(poly(cv.blank(), pts), ramp, ink=INK, gloss=False)
    if vein:
        cv.line4([polar(base, ang, 1), polar(base, ang, length * 0.75)], VEIN)
    return tip


POSES = dict(
    idle_a=dict(cx=30, w=32, h=22, lean=0, crest=-145),
    idle_b=dict(cx=30, w=35, h=19, lean=0, crest=-155, mouth=1),
    idle_c=dict(cx=30, w=30, h=24, lean=1.5, crest=-135),
    windup=dict(cx=27, w=37, h=16, lean=-3, crest=-170, eye="angry"),
    move=dict(cx=35, w=27, h=25, lean=4, base=49, crest=-160, eye="angry"),
    attack=dict(cx=36, w=36, h=19, lean=6, crest=-40, eye="angry", mouth=3),
    recover=dict(cx=24, w=31, h=23, lean=-4, crest=-20, eye="angry", mouth=2),
    hit=dict(cx=26, w=34, h=18, lean=-5, crest=-175, eye="shut", mouth=2),
)


def draw_slime(cv, cx, w, h, lean=0.0, base=GROUND, crest=-145, eye="open", mouth=0):
    pts = superblob(cx, base, w, h, n=2.2, lean=lean, peak=0.25, flare=1.0)
    top = (cx + lean * 0.9, base - h - 1)
    # 뒤쪽 아래 잎 주름 두 장(몸 뒤에 겹쳐 붙는다)
    leaf(cv, (cx - w * 0.35, base - 4), 200, 9, 5, vein=False)
    leaf(cv, (cx - w * 0.3, base - 9), 215, 8, 4, vein=False)
    bubbles = [((cx - w * 0.22, base - h * 0.32), 1.4, BUBBLE), ((cx + w * 0.02, base - h * 0.2), 0.5, BUBBLE),
               ((cx - w * 0.05, base - h * 0.6), 0.9, BUBBLE), ((cx - w * 0.3, base - h * 0.6), 0.5, BUBBLE)]
    jelly(cv, pts, BODY, INK, bubbles=bubbles, shine=((cx - w * 0.28 + lean * 0.4, base - h * 0.8), ((0, 0), (1, 0), (0, 1), (2, -1))))
    # 정수리 잎 볏: 줄기 + 긴 잎
    stem_top = add(top, (math.cos(math.radians(crest)) * 2, -2))
    cv.part(chain([add(top, (0, 2)), stem_top], [2.2, 1.8]), LEAF, ink=INK, gloss=False)
    tip = leaf(cv, stem_top, crest, 15, 6)
    ex = cx + w * 0.24 + lean * 0.7
    ey = base - h * 0.5
    eyes(cv, (ex + 4, ey), (ex - 1, ey), eye, EYE, size=2)
    m = rnd((ex + 2, ey + 5))
    if mouth >= 3:
        cv.put(ellipse(cv.blank(), m, 2.0, 1.8), MOUTH)
    elif mouth == 2:
        cv.line([add(m, (-1, 0)), add(m, (1, 0))], MOUTH)
        cv.pixel(m[0], m[1] + 1, MOUTH)
    elif mouth == 1:
        cv.line([add(m, (-1, 0)), m, add(m, (1, -1))], MOUTH)
    else:
        cv.line([add(m, (-1, -1)), m, add(m, (1, -1))], MOUTH)
    return dict(mouth=m, tip=tip, front=(cx + w / 2, base - h * 0.4), back=(cx - w / 2, base - 3))


def spin_leaf(cv, c, ang):
    leaf(cv, polar(c, ang + 180, 3.5), ang, 7, 4)


def draw(name):
    cv = Canvas(64, INK)
    if name == "dead":
        leaf(cv, (22, 57), 150, 13, 5)
        puddle(cv, 32, GROUND, 44, 5, BODY, INK, bumps=((28, 2.2),))
        for e in ((40, 56), (45, 56)):
            cv.line([add(e, (-1, -1)), add(e, (1, 1))], EYE)
            cv.line([add(e, (-1, 1)), add(e, (1, -1))], EYE)
        return cv.image()
    P = dict(POSES[name])
    if name == "move":
        beads(cv, (18, GROUND - 1), (30, 45), 1.4, 3.2, SAP, n=7)
    j = draw_slime(cv, **P)
    if name == "attack":
        # 잎 볏을 앞으로 내리쳐 베는 궤적
        slash(cv, add(j["tip"], (-2, -6)), add(j["tip"], (6, 8)), -3, 3.2, SAP[1], SAP[2])
        burst(cv, add(j["front"], (4, 2)), 4.0, SAP[0], SAP[2], spikes=6)
    elif name == "recover":
        # 잎날 셋이 볏 끝에서 앞으로 줄지어 날아간다(잎자루 끝끼리 붙은 바람 줄기로 이어진다)
        a = polar(j["tip"], 200, 3)
        pts = bezier(a, (a[0] + 10, a[1] - 10), (58, a[1] - 2), 6)
        for k, p in enumerate(pts[2::2]):
            spin_leaf(cv, p, -30 + k * 70)
        cv.line4(pts, SAP[1])
    elif name == "windup":
        cv.line4([j["tip"], add(j["tip"], (-3, -2))], SAP[1])
        cv.pixel(*rnd(add(j["tip"], (-3, -2))), SAP[2])
    elif name == "hit":
        leaf(cv, add(j["back"], (2, -6)), 210, 6, 3, vein=False)
        burst(cv, add(j["front"], (0, -3)), 3.5, SAP[1], (255, 255, 255), spikes=5)
    return cv.image()


if __name__ == "__main__":
    run("slime-green", draw, sys.argv[1:], idle_ms=220)

#!/usr/bin/env python3
"""푸른 드래곤(dragon-blue) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

청푸른 비늘과 하늘빛 배 비늘판, 넓은 짙은 남색 날개막, 얼음빛 왕관 뿔과 지느러미 같은 뺨·꼬리 지느러미, 하얀 눈.
공용 네발 용 뼈대는 dragon_rig.py(redraw_dragon.py 와 같은 뼈대·포즈).
6번 칸(스킬, 아키타입 skill_thunder): 고개를 앞으로 뻗어 번개처럼 하얗게 빛나는 푸른 숨결을 아군 쪽으로 길게 뿜는다.

  python3 scripts/content/monsters/redraw_dragon_blue.py [--preview DIR]
"""
from __future__ import annotations

import sys

import dragon_rig as R
from pixel_lib import run

LOOK = R.Look(
    ink=(10, 20, 44),
    scale=[(30, 70, 140), (46, 108, 184), (80, 152, 216), (150, 206, 240)],
    scale_far=[(22, 50, 104), (30, 66, 130), (40, 86, 156), (40, 86, 156)],
    belly=[(150, 196, 220), (196, 230, 244), (236, 250, 255), (236, 250, 255)],
    memb=[(24, 44, 100), (36, 66, 136), (56, 96, 170), (56, 96, 170)],
    memb_far=[(16, 30, 72), (24, 44, 100), (24, 44, 100), (24, 44, 100)],
    horn=[(130, 180, 210), (186, 226, 244), (230, 248, 255), (255, 255, 255)],
    eye=(236, 252, 255), eye_hi=(140, 230, 255),
    breath=[(70, 140, 220), (130, 200, 244), (200, 240, 255), (255, 255, 255)],
    horns="crown", cheek="fins",
    smoke=((150, 190, 220), (210, 236, 250)),
)


def draw(name):
    return R.draw(LOOK, name)


if __name__ == "__main__":
    run("dragon-blue", draw, sys.argv[1:], S=R.S, idle_ms=220)

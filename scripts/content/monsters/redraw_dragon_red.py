#!/usr/bin/env python3
"""붉은 드래곤(dragon-red) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

진홍 갑판 비늘과 크림빛 배 비늘판, 검붉은 날개막, 뺨의 가시와 곧게 뒤로 뻗은 검은 뿔, 금빛 눈.
공용 네발 용 뼈대는 dragon_rig.py(redraw_dragon.py 와 같은 뼈대·포즈).
6번 칸(스킬, 아키타입 skill_fire): 고개를 앞으로 뻗어 진홍·주황 불길을 아군 쪽으로 길게 뿜는다.

  python3 scripts/content/monsters/redraw_dragon_red.py [--preview DIR]
"""
from __future__ import annotations

import sys

import dragon_rig as R
from pixel_lib import run

LOOK = R.Look(
    ink=(36, 8, 10),
    scale=[(128, 22, 26), (180, 38, 34), (220, 72, 50), (248, 130, 92)],
    scale_far=[(86, 16, 22), (112, 24, 28), (140, 34, 32), (140, 34, 32)],
    belly=[(200, 150, 110), (236, 196, 148), (252, 228, 190), (252, 228, 190)],
    memb=[(72, 18, 30), (104, 28, 40), (138, 44, 52), (138, 44, 52)],
    memb_far=[(50, 12, 22), (72, 18, 30), (72, 18, 30), (72, 18, 30)],
    horn=[(40, 34, 40), (80, 70, 76), (130, 120, 120), (190, 180, 176)],
    eye=(255, 210, 40), eye_hi=(255, 250, 200),
    breath=[(190, 30, 20), (248, 110, 30), (255, 200, 70), (255, 250, 214)],
    horns="straight", cheek="spikes",
)


def draw(name):
    return R.draw(LOOK, name)


if __name__ == "__main__":
    run("dragon-red", draw, sys.argv[1:], S=R.S, idle_ms=220)

#!/usr/bin/env python3
"""본 드래곤(dragon-bone) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

회백색 뼈로만 된 용: 긴 두개골과 텅 빈 갈비뼈, 찢긴 막이 걸린 뼈 날개, 마디마디 끊어진 꼬리뼈, 눈구멍의 초록 도깨비불.
공용 네발 용 뼈대는 dragon_rig.py(redraw_dragon.py 와 같은 뼈대·포즈).
6번 칸(스킬, 아키타입 skill_dark): 턱을 크게 벌려 초록 저주의 숨결을 아군 쪽으로 길게 뿜는다.

  python3 scripts/content/monsters/redraw_dragon_bone.py [--preview DIR]
"""
from __future__ import annotations

import sys

import dragon_rig as R
from pixel_lib import run

LOOK = R.Look(
    ink=(26, 24, 30),
    scale=[(120, 114, 104), (170, 164, 150), (210, 204, 190), (240, 236, 224)],
    scale_far=[(84, 80, 76), (110, 106, 98), (134, 128, 118), (134, 128, 118)],
    belly=[(150, 144, 132), (190, 184, 170), (220, 214, 200), (220, 214, 200)],
    memb=[(56, 60, 56), (78, 84, 76), (100, 106, 96), (100, 106, 96)],
    memb_far=[(40, 44, 42), (56, 60, 56), (56, 60, 56), (56, 60, 56)],
    horn=[(124, 118, 106), (176, 170, 156), (216, 210, 196), (244, 240, 230)],
    eye=(120, 255, 120), eye_hi=(220, 255, 200),
    breath=[(40, 120, 60), (80, 190, 90), (160, 240, 140), (230, 255, 220)],
    horns="curved", cheek="none", bone=True,
    smoke=((70, 90, 74), (110, 136, 112)),
)


def draw(name):
    return R.draw(LOOK, name)


if __name__ == "__main__":
    run("dragon-bone", draw, sys.argv[1:], S=R.S, idle_ms=220)

#!/usr/bin/env python3
"""고대 드래곤(dragon-01, 시트 dragon.png) 전투 시트 3x3x96 + 초상 96 을 관절 좌표로 직접 그린다.

황토빛 비늘과 크림색 배 비늘판, 청동빛 넓은 박쥐 날개, 뒤로 휘었다 끝이 들린 두 뿔과 뺨의 가시,
등·목·꼬리를 따라 돋은 가시, 붉게 타는 눈. 공용 뼈대는 dragon_rig.py.
6번 칸(스킬 skill_mon_fire_breath): 고개를 앞으로 뻗어 금빛 불길을 아군 쪽으로 길게 뿜는다.

  python3 scripts/content/monsters/redraw_dragon.py [--preview DIR]
"""
from __future__ import annotations

import sys

import dragon_rig as R
from pixel_lib import run

LOOK = R.Look(
    ink=(30, 18, 12),
    scale=[(126, 78, 36), (176, 118, 54), (214, 160, 84), (240, 200, 120)],
    scale_far=[(84, 52, 28), (110, 70, 36), (136, 90, 46), (136, 90, 46)],
    belly=[(196, 160, 104), (234, 208, 150), (250, 236, 192), (250, 236, 192)],
    memb=[(64, 84, 70), (92, 118, 92), (124, 148, 112), (124, 148, 112)],
    memb_far=[(44, 58, 50), (64, 84, 70), (64, 84, 70), (64, 84, 70)],
    horn=[(150, 132, 100), (206, 192, 156), (240, 232, 206), (255, 250, 230)],
    eye=(236, 48, 30), eye_hi=(255, 214, 120),
    breath=[(206, 58, 24), (250, 134, 34), (255, 214, 86), (255, 250, 214)],
    horns="curved", cheek="spikes",
)


def draw(name):
    return R.draw(LOOK, name)


if __name__ == "__main__":
    run("dragon", draw, sys.argv[1:], S=R.S, idle_ms=260)

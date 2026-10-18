#!/usr/bin/env python3
"""붉은 슬라임(slime-red) 전투 시트: redraw_slime.py 의 몸·포즈에 붉은 팔레트와 끓는 산성.

  python3 scripts/content/monsters/redraw_slime_red.py [--preview DIR]
"""
from __future__ import annotations

import sys

from pixel_lib import run
from redraw_slime import make_draw

RED = dict(
    ink=(52, 14, 18),
    body=[(150, 30, 36), (206, 60, 56), (244, 116, 96), (255, 206, 186)],
    core=(255, 160, 120),
    eye=(40, 10, 14),
    mouth=(100, 16, 24),
    acid=[(230, 120, 30), (255, 196, 70), (255, 246, 200)],
    splat=[(170, 40, 40), (244, 116, 96)],
)

if __name__ == "__main__":
    run("slime-red", make_draw(RED), sys.argv[1:], idle_ms=200)

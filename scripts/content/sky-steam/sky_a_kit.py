"""줄 A 하늘섬 — 키트(건물·구조물)·탈것. 모두 kind=structure 로 관문에 낸다(윗면 판 3줄+)."""
from __future__ import annotations
from sky_a_lib import *


@piece('sky-a-island-s', '하늘섬 작은 덩이', 4, 4, 'structure', 'A', tags=['island'])
def _(c): island(c, 3, 4, 58, 20, 34, seed=1, trees=0)


@piece('sky-a-island-m', '하늘섬 큰 덩이', 6, 5, 'structure', 'A', tags=['island'])
def _(c): island(c, 3, 4, 90, 26, 46, seed=2)


@piece('sky-a-house', '부유 마을 집', 3, 3, 'structure', 'A', solid=[(0, 2), (1, 2), (2, 2)], tags=['house'])
def _(c):
    # 석조 벽(앞면) + 윗면 보이는 박공 지붕
    face(c, 6, 28, 36, 18, 'soot', 1, 'brick', seed=4)
    window(c, 11, 33, 4, 5, lit=True); door(c, 22, 37, 5, 9); window(c, 33, 33, 4, 5)
    roof(c, 2, 11, 44, 17, 'copper', 1, seed=2)
    c.R(36, 4, 5, 8, K('soot', 0)); c.HL(35, 3, 7, K('soot', 3)); c.R(36, 2, 5, 2, K('soot', -3))  # 굴뚝 윗면
    c.outline()


@piece('sky-a-windmill', '풍차 탑', 2, 4, 'structure', 'A', solid=[(0, 3), (1, 3)], tags=['tower'])
def _(c):
    face(c, 5, 30, 22, 32, 'soot', 1, 'brick', seed=8); window(c, 14, 40, 4, 5); door(c, 13, 52, 6, 9)
    c.R(4, 28, 24, 3, K('brass', 1)); 
    roof(c, 3, 15, 26, 13, 'copper', 1, seed=3)
    for k in range(4):                    # 날개: 앞을 보는 십자
        pass
    c.R(14, 18, 4, 4, K('brass', 2)); c.outline()


@piece('sky-a-mooring', '정박탑', 2, 4, 'structure', 'A', solid=[(0, 3), (1, 3)], tags=['tower'])
def _(c):
    box(c, 4, 40, 24, 7, 17, 'iron', 1, 'plate', seed=5)             # 기단 상자(윗면 7줄)
    face(c, 11, 20, 10, 22, 'iron', 1, 'plate', seed=6)               # 탑 몸
    box(c, 3, 5, 26, 8, 8, 'brass', 1, 'plate', taper=.25, seed=7)    # 정박 플랫폼 상자
    c.R(14, 1, 4, 4, K('copper', 1)); c.HL(14, 1, 4, K('copper', 3)); c.R(28, 24, 2, 2, K('brass', 3)); c.outline()


@piece('sky-a-airship', '비공정', 6, 4, 'structure', 'A', solid=[(2, 3), (3, 3)], tags=['vehicle'])
def _(c):
    # 기구(기낭) 위, 선체: 윗면 갑판이 보이는 3/4
    tex_ell(c, 48, 18, 40, 15, 'canvas', 0, seed=3)
    for i in range(14, 84, 10): c.line(i + 2, 6, i, 30, K('canvas', -2))
    c.R(32, 44, 34, 4, K('wood', -2))
    slab(c, 22, 36, 54, 9, 'wood', 1, taper=.6, seed=9)               # 갑판 윗면
    face(c, 24, 45, 50, 11, 'wood', 0, 'plank', seed=9)
    for i in range(30, 70, 7): c.P(i, 50, K('brass', 3))
    c.R(44, 33, 8, 3, K('brass', 1)); c.outline()
    c.R(80, 40, 6, 6, K('iron', 0)); c.R(86, 41, 2, 4, K('iron', 3)); c.outline()



@piece('sky-a-harbor', '하늘 항구', 6, 4, 'structure', 'A', solid=[(0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3)], tags=['harbor'])
def _(c):
    # 목재 부두 판(넓은 윗면) + 앞 말뚝 + 뒤 창고
    face(c, 10, 8, 40, 22, 'soot', 1, 'brick', seed=14); window(c, 16, 16, 4, 5, True); window(c, 38, 16, 4, 5, True); door(c, 26, 21, 6, 9)
    roof(c, 6, 0, 48, 10, 'copper', 1, seed=4)
    slab(c, 2, 34, 92, 12, 'wood', 1, taper=.25, seed=15)              # 부두 윗면
    for i in range(6, 90, 10): c.VL(i, 36, 10, K('wood', -3)); c.HL(i - 1, 34, 3, K('brass', 3))
    face(c, 3, 46, 90, 10, 'wood', 0, 'plank', seed=16)
    for i in range(10, 90, 22): c.R(i, 56, 4, 6, K('wood', -2)); c.HL(i, 56, 4, K('wood', 1))
    c.R(66, 20, 20, 3, K('iron', 0)); box(c, 70, 24, 12, 5, 6, 'wood', 1, 'plank', seed=17); c.outline()


@piece('sky-a-shrine', '부유 신전', 4, 4, 'structure', 'A', solid=[(0, 3), (1, 3), (2, 3), (3, 3)], tags=['temple'])
def _(c):
    box(c, 4, 44, 56, 8, 12, 'rock', 2, 'stone', taper=.3, seed=21)    # 기단
    for x in (10, 26, 42):                                           # 기둥: 앞면 + 기둥머리 윗면
        face(c, x, 26, 8, 20, 'cloud', 1, 'stone', seed=x); box(c, x - 1, 22, 10, 4, 1, 'cloud', 2, 'stone', seed=x)
    roof(c, 4, 2, 56, 18, 'magi', 1, seed=5)                         # 마석 보라 지붕
    c.R(30, 0, 4, 3, K('magi', 4)); c.HL(30, 0, 4, K('magi', 4)); c.R(28, 34, 8, 12, K('magi', -2)); c.R(30, 36, 4, 10, K('magi', 3)); c.outline()


@piece('sky-a-whale-pier', '고래 선착장', 5, 3, 'structure', 'A', solid=[(0, 2), (1, 2), (2, 2), (3, 2), (4, 2)], tags=['harbor'])
def _(c):
    slab(c, 3, 8, 74, 12, 'wood', 1, taper=.3, seed=31)                # 잔교 윗면
    face(c, 4, 20, 72, 9, 'wood', 0, 'plank', seed=32)
    for i in range(8, 72, 12): c.R(i, 29, 4, 7, K('wood', -2)); c.HL(i, 29, 4, K('wood', 1))
    for i in range(8, 74, 16): c.VL(i, 3, 6, K('wood', -3)); c.R(i - 1, 2, 3, 3, K('brass', 3))   # 계류 말뚝
    c.R(56, 0, 14, 8, K('canvas', 1)); c.HL(56, 0, 14, K('canvas', 4)); c.HL(56, 7, 14, K('canvas', -2))   # 고래기름 통 쌓음
    box(c, 28, 2, 12, 5, 6, 'wood', 1, 'plank', seed=33); c.outline()


@piece('sky-a-rock-root', '바위 뿌리', 3, 3, 'structure', 'A', solid=[], tags=['island'])
def _(c):
    island(c, 2, 3, 44, 14, 30, seed=51, grass=False, roots=True, tip=1.15)


@piece('sky-a-gondola', '곤돌라', 3, 2, 'structure', 'A', solid=[(1, 1)], tags=['vehicle'])
def _(c):
    slab(c, 6, 14, 36, 8, 'wood', 1, taper=.5, seed=71)
    face(c, 7, 22, 34, 8, 'wood', 0, 'plank', seed=72)
    for i in range(10, 40, 8): c.line(i, 14, 24, 2, K('iron', 1))
    c.R(20, 0, 8, 3, K('brass', 2)); c.HL(20, 0, 8, K('brass', 4))
    c.R(12, 18, 3, 3, K('canvas', 3)); c.R(33, 18, 3, 3, K('canvas', 3)); c.outline()


if __name__ == '__main__': run_cli('A')

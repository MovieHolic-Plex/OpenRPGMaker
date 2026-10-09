# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-puddle 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: wl.edge_depth(inset 2.2, jag 0.8) — 변이 거의 곧아 5×5 덩이가 네모(bad 0.634, 곧은 줄 68/80px).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 윤곽: 큰 혹+잔 혹, 칸 끝은 얕게 모여 오목 모서리 계단 1px,
#   볼록 모서리 반지름 7.5)에 같은 웅덩이 셰이더(rr_ground.puddle_shader: 젖은 돌 테·하늘빛 북쪽 안 테·가로 반사 줄)를 칠한다.
#   덮어쓰는 파일: parts/autotile-puddle.png 하나(이름 그대로 — 키트는 새 칸으로 갈아끼워진다).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
import rr_ground as RG
from autotile_edge import edge_fields, X16, Y16


def autotile_puddle(seed=81):
    cells = []
    for n in range(16):
        m = edge_fields(n, inset=3.0, jag=3.0, rad=7.0, seed=seed)[0]
        rgb, alpha = RG.puddle_shader(X16, Y16, m, n, seed)
        cells.append(RG._img(rgb, np.where(alpha, 255, 0).astype(np.uint8)))
    return RG.sheet_from_cells(cells)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-puddle.png')
    autotile_puddle().save(out); print('wrote', out)

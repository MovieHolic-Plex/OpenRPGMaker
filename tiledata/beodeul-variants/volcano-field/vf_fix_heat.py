# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-heat 가장자리를 둥근 덩이로.
#   옛 판(vf_auto.heat_sheet): 칸 전체 Bayer 디더(알파 52)에 불티만 점점이 — 덩이 윤곽이 없어 이음매 튐 9px, 규약 위반 20
#   (이웃 쪽 변이 비거나 이웃 없는 쪽이 칸 끝까지 찼다).
#   새 판: 윤곽은 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7).
#   재질은 옛 판 그대로 — 붉은 열기(220,84,28) 반투명: 바깥 1.4px 은 옛 Bayer 디더(알파 52)로 옅게 번지고,
#   그 안은 고른 검붉은 열기 막(알파 66 → 속 72, Bayer 로 드문 열점 섞음 — 밝은 주황 막은 웅덩이처럼 보여 어둡게), 불티·아래 그늘·짧은 붉은 금은 옛 판 규칙(깊이 1·3 이상).
#   덮어쓰는 파일: parts/autotile-heat.png 하나(이름 그대로 — 걷기·덧그림 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
from vf_base import hash2, sheet_from_cells, LAV
from vf_auto import BAY
from autotile_edge import edge_fields

SEED = 31


def heat_sheet(seed=None, inset=1.8, jag=2.8, rad=7.0):
    seed = SEED if seed is None else seed
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    bay = np.tile(BAY, (4, 4))
    for n in range(16):
        m = edge_fields(n, inset, jag, rad, seed)[0]
        out = np.zeros((16, 16, 4), np.uint8)
        fringe = (m >= 0) & (m < 1.4) & (bay < 0.5)
        out[fringe] = (220, 84, 28, 52)
        film = m >= 1.4
        out[film] = (164, 50, 22, 66)
        out[film & (m > 3.0)] = (172, 56, 24, 72)
        hot = film & (m > 2.5) & (bay > 0.90)
        out[hot] = (220, 96, 34, 84)
        sp = (m > 1.0) & (hash2(X, Y, seed + 11) < 0.035)
        out[sp] = LAV[4] + (220,)
        sp2 = np.roll(sp, -1, 0) & ~sp & (m >= 1.4)
        out[sp2] = LAV[3] + (150,)
        cr = (m > 3.0) & (hash2(X // 3, Y, seed + 3) > 0.94) & (hash2(X, Y, seed + 4) > 0.3)
        out[cr] = LAV[2] + (200,)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-heat.png')
    heat_sheet().save(out); print('wrote', out)

# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-rust 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: fr_base.edge_depth(inset 1.2, jag 2.4) — 들어감이 얕아 디더 가장자리가 칸 끝을 따라 곧게 서고,
#          5×5 덩이가 네모(bad 0.551, 곧은 줄 77/80px).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(정원 연못 윤곽: 큰 혹+잔 혹, 칸 끝은 얕게 모여 오목 모서리 계단 1px,
#          볼록 모서리 반지름 7)에 같은 녹 화가(반투명 녹 + 진한 딱지 점 + 4x4 디더 옅어짐 + 흘러내린 줄)를 칠한다.
#   fr_ground.autotile_rust 가 이 함수를 부르므로 make_future_ruins.py 를 다시 돌리면 지도·조각이 같이 새 판이 된다.
#   덮어쓰는 파일: parts/autotile-rust.png 하나(이름 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
from fr_base import A, RUST, hash2, tnoise, sheet_from_cells
from autotile_edge import edge_fields

BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def autotile_rust(seed=31, inset=3.0, jag=3.0, rad=7.0):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    bay = np.tile(BAY, (4, 4))
    for n in range(16):
        m = edge_fields(n, inset=inset, jag=jag, rad=rad, seed=seed)[0]
        lvl = np.clip((m + 1.0) / 4.0, 0, 1)
        on = lvl > bay * .9 + .05
        nz = tnoise(16, 16, 4, seed + 2)
        t = np.where(nz > .55, 3, 4)
        t = np.where(hash2(X, Y, seed + 3) > .9, 2, t)
        t = np.where((hash2(X // 2, Y // 2, seed + 4) > .82) & (m > 2), 5, t)
        rgb = A(RUST)[t]
        a = np.where(on, np.where(nz > .5, 170, 120), 0)
        a = np.where(on & (hash2(X, Y, seed + 9) > .86) & (m > 1), 0, a)                  # 바탕이 비치는 구멍
        st = (hash2(X, 0, seed + 5) > .82) & (m > -3) & (m < 2.5) & (Y > 2) & ~((n & 4) > 0) & (m < 0)   # 흘러내린 줄(남쪽 가 밖만)
        a = np.where(st & ~on, 90, a); rgb = np.where((st & ~on)[..., None], A(RUST)[3], rgb)
        out = np.dstack([rgb, a]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-rust.png')
    autotile_rust().save(out); print('wrote', out)

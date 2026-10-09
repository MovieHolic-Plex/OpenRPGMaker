# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-crack 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판(ww_auto.crack_sheet): edge_depth(inset 3.0, jag 1.4) — 변 출렁임이 1px 남짓이라 5×5 덩이가 네모(bad 0.625, 곧은 줄 73/80px),
#   감긴(roll) 1px 윤곽이 이웃 쪽 칸 끝에 새어 규약 위반 2.
#   새 판: 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 윤곽을 잡고
#   재질은 옛 판 그대로: 북쪽이 땅이면 안벽(남쪽을 보는 면) 4px 붉은 사암 지층(얇은 재 층 한 줄) → 아래는 어둠,
#   틈 바깥 1px 어두운 흙 윤곽, 남쪽 테 밑 밝은 흙 턱 1px. 윤곽·턱은 칸 안에서만(감지 않는다).
#   덮어쓰는 파일: parts/autotile-crack.png 하나(이름 그대로 — 막힘 규칙·이름은 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
from ww_base import P, hash2, sheet_from_cells
from autotile_edge import edge_fields

N_, E_, S_, W_ = 1, 2, 4, 8


def _shift(a, dy, dx, fill=False):
    """감지 않는 이동(밖은 fill)."""
    o = np.full_like(a, fill)
    H, W = a.shape
    o[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = a[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
    return o


def crack_cell(n, seed=11, inset=3.0, jag=2.8, rad=7.0):
    rr = P('rrock'); ab = P('abyss'); rd = P('rdirt')
    m, dN, dE, dS, dW = edge_fields(n, inset, jag, rad, seed)
    inside = m >= 0
    out = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            if not inside[y, x]: continue
            k = dN[y, x]
            if k < 90 and k < 4.0:                                                   # 안벽 지층(위 이웃 없음)
                ki = int(k)
                t = (4, 3, 3, 2)[ki]
                if hash2(x, y, seed + 3) > 0.8: t -= 1
                c = rr[t]
                if ki == 2 and hash2(x // 2, y, seed + 4) > 0.5: c = P('dust')[4]        # 얇은 재 층
            else:
                c = ab[1 if hash2(x, y, seed + 5) > 0.15 else 2]
            out[y, x, :3] = c; out[y, x, 3] = 255
    # 바깥 1px 어두운 윤곽(이웃 쪽 칸 끝 너머는 이웃 칸이 잇는다 — 이동은 감지 않는다)
    nb = _shift(inside, 1, 0) | _shift(inside, -1, 0) | _shift(inside, 0, 1) | _shift(inside, 0, -1)
    edge = (~inside) & nb
    out[edge] = (rd[0][0], rd[0][1], rd[0][2], 255)
    # 남쪽 테 밑 밝은 흙 턱: 윤곽 바로 아래(틈 남쪽 가장자리)
    lip = (~inside) & ~edge & _shift(edge, 1, 0) & _shift(inside, 2, 0)
    out[lip] = (rd[5][0], rd[5][1], rd[5][2], 255)
    return Image.fromarray(out, 'RGBA')


def crack_sheet(): return sheet_from_cells([crack_cell(n) for n in range(16)])


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-crack.png')
    crack_sheet().save(out); print('wrote', out)

# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-riftstone 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: tr_isle.cells_mask(칸 네모 → 볼록 모서리만 반지름 4로 깎고 1~2px 안쪽 들쭉날쭉) — 변이 곧아 떠 있는 돌판이 네모 판석(bad 0.675).
#   새 판: 3x3 창 마스크를 공용 깊이장 autotile_edge.window_mask(큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 만들고
#   같은 섬 화가(tr_isle.render_islands, 'path' 윗면 + 북쪽 빛 모서리 + 남쪽 두께 띠·뿌리)로 칠한 뒤 가운데 칸만 자른다.
#   두께·뿌리는 body 4·root 6 으로 줄여 남쪽 뿌리 끝이 칸 안에서 들쭉날쭉 끝난다(옛 판은 칸 밑줄에서 곧게 잘렸다).
#   덮어쓰는 파일: parts/autotile-riftstone.png 하나(이름 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
from tr_base import sheet_from_cells
import tr_isle as I
from autotile_edge import window_mask


def riftstone_sheet(seed=4, inset=2.6, jag=2.8, rad=7.0):
    cells = []
    for m in range(16):
        mk = window_mask(m, inset, jag, rad, seed)
        im, _ = I.render_islands(48, 48, [I.Island(mk, 'path', body=4, root=6, seed=seed)])
        cells.append(im.crop((16, 16, 32, 32)))
    return sheet_from_cells(cells)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-riftstone.png')
    riftstone_sheet().save(out); print('wrote', out)

# 오토타일 이음 시험 그림 check-autotile.png: 오토타일마다 [16변형 시트 | 5x5 덩이 | 나선 | 코가 튀어나온 L자 덩이 | 굽은 띠(개울·길)] 를
# 버들항 풀(ground.render) 위에 칸 번호 규칙(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)으로 이어 붙여 3배로 보인다.
import os, sys
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import bv_base
import numpy as np
from PIL import Image, ImageDraw
from bv_base import cell_of
import ground as G
import bv_ground as BG

SHAPES = {
    'blob 5x5': ["         ", "         ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "         ", "         "],
    'spiral':   ["#########", "#       #", "# ##### #", "# #   # #", "# # # # #", "# # ### #", "# #     #", "# #######", "#        "],
    'L + nose': ["         ", " ##      ", " ##      ", " ###     ", " ####### ", " ####### ", "   ##    ", "   #     ", "         "],
    'meander':  ["   ##    ", "   ###   ", "    ##   ", "    ###  ", "     ##  ", "    ###  ", "   ##    ", "  ###    ", "  ##     "],
}


def nb(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def lay(sheet, rows):
    H = len(rows); Wd = len(rows[0])
    base, _ = G.render(Wd * 16, H * 16, [], np.zeros((H * 16, Wd * 16), bool), seed=7)
    cells = {(x, y) for y in range(H) for x in range(Wd) if rows[y][x] == '#'}
    for (x, y) in cells: base.alpha_composite(cell_of(sheet, nb(cells, x, y)), (x * 16, y * 16))
    return base


def build(sheets, out):
    S = 3
    rows = []
    for (name, sh) in sheets:
        bg, _ = G.render(64, 64, [], np.zeros((64, 64), bool), seed=3)
        bg.alpha_composite(sh)
        rows.append((name, [bg] + [lay(sh, r) for r in SHAPES.values()]))
    cw = 9 * 16 * S + 16
    o = Image.new('RGB', (64 * 4 + 16 + cw * len(SHAPES) + 16, len(rows) * (9 * 16 * S + 26) + 8), (28, 28, 34)); d = ImageDraw.Draw(o)
    y = 8
    for (name, tiles) in rows:
        d.text((8, y), name, fill=(230, 230, 230))
        o.paste(tiles[0].resize((256, 256), Image.NEAREST).convert('RGB'), (8, y + 14))
        for i, (lbl, t) in enumerate(zip(SHAPES, tiles[1:])):
            x = 64 * 4 + 24 + i * cw
            d.text((x, y), lbl, fill=(200, 200, 200))
            o.paste(t.resize((t.width * S, t.height * S), Image.NEAREST).convert('RGB'), (x, y + 14))
        y += 9 * 16 * S + 26
    o.save(out)


def SHEETS():
    return [('autotile-stream (stream water, rounded river-stone bank, blocked)', BG.autotile_stream()),
            ('autotile-bamboo-litter (bamboo leaf litter earth, walk)', BG.autotile_litter()),
            ('autotile-moss (thick moss cushion, walk)', BG.autotile_moss()),
            ('autotile-leaf-trail (leaf-strewn dirt trail, walk)', BG.autotile_trail()),
            ('autotile-bamboo-rail (low bamboo rail fence, blocked)', BG.autotile_rail())]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, 'check-autotile.png')
    build(SHEETS(), out)
    print('wrote', out)

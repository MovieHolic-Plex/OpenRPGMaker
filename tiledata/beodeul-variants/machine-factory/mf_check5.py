# 오토타일 이음 시험 그림 check-autotile.png: 오토타일마다 [16변형 시트 | 5x5 덩이 | 나선 | 코가 튀어나온 L자 덩이] 를
# 공장 체크 철판(mf_plate) 위에 칸 번호 규칙(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)으로 이어 붙여 3배로 보인다.
import os, sys
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
from PIL import Image, ImageDraw
import dlib
import mf_wave5 as W5
from mf_kit import new

SHAPES = {
    'blob 5x5': ["         ", "         ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "         ", "         "],
    'spiral':   ["#########", "#       #", "# ##### #", "# #   # #", "# # # # #", "# # ### #", "# #     #", "# #######", "#        "],
    'L + nose': ["         ", " ##      ", " ##      ", " ###     ", " ####### ", " ####### ", "   ##    ", "   #     ", "         "],
}


def nb(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def floor(w, h, kind):
    im = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): im.alpha_composite(dlib.floor_tile(kind, x, y), (x * 16, y * 16))
    return im


def lay(sheet, rows, kind):
    H = len(rows); Wd = len(rows[0])
    base = floor(Wd, H, kind)
    cells = {(x, y) for y in range(H) for x in range(Wd) if rows[y][x] == '#'}
    for (x, y) in cells:
        n = nb(cells, x, y)
        base.alpha_composite(sheet.crop((n % 4 * 16, n // 4 * 16, n % 4 * 16 + 16, n // 4 * 16 + 16)), (x * 16, y * 16))
    return base


def build(sheets, out):
    S = 3
    rows = []
    for (name, sh, kind) in sheets:
        bg = floor(4, 4, kind); bg.alpha_composite(sh)
        rows.append((name, [bg] + [lay(sh, r, kind) for r in SHAPES.values()]))
    cw = 9 * 16 * S + 16
    o = Image.new('RGB', (64 * 4 + 16 + cw * 3 + 16, len(rows) * (9 * 16 * S + 26) + 8), (28, 28, 34)); d = ImageDraw.Draw(o)
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
    return [('autotile-oilpool (oil puddle, walk) on checker plate', W5.autotile_oil(), 'mf_plate'),
            ('autotile-coolant (sunken coolant pool, blocked) on checker plate', W5.autotile_coolant(), 'mf_plate'),
            ('autotile-scorch (cable scorch, walk) on checker plate', W5.autotile_scorch(), 'mf_plate')]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, 'check-autotile.png')
    build(SHEETS(), out)
    print('wrote', out)

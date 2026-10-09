# 오토타일 이음 시험 그림 check-autotile.png: 오토타일마다 [16변형 시트 | 5x5 덩이 | 나선 | 코가 튀어나온 L자 덩이 | 굽은 띠] 를
# 고원 풀(hc_ground.grass_mix) 위에 칸 번호 규칙(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)으로 이어 붙여 3배로 보인다.
# 하늘 가장자리(sky-rim)는 덩이 칸 밑에 하늘 표본을 먼저 깐다(실제 지도와 같은 순서).
import os, sys
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import hc_base
import numpy as np
from PIL import Image, ImageDraw
from hc_base import cell_of
import hc_ground as HG, hc_auto as HA, hc_cliff as HC

SHAPES = {
    'blob 5x5': ["         ", "         ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "         ", "         "],
    'spiral':   ["#########", "#       #", "# ##### #", "# #   # #", "# # # # #", "# # ### #", "# #     #", "# #######", "#        "],
    'L + nose': ["         ", " ##      ", " ##      ", " ###     ", " ####### ", " ####### ", "   ##    ", "   #     ", "         "],
    'meander':  ["   ##    ", "   ###   ", "    ##   ", "    ###  ", "     ##  ", "    ###  ", "   ##    ", "  ###    ", "  ##     "],
}
SKY = [HG.sky_sample('clear'), HG.sky_sample('puffs', 3), HG.sky_sample('drift', 5)]


def nb(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def _grass(w, h, seed):
    return Image.fromarray(HG.grass_mix(w, h, seed, periodic=False).astype(np.uint8), 'RGB').convert('RGBA')


def lay(sheet, rows, sky=False):
    H = len(rows); Wd = len(rows[0])
    base = _grass(Wd * 16, H * 16, 7)
    cells = {(x, y) for y in range(H) for x in range(Wd) if rows[y][x] == '#'}
    if sky:
        for (x, y) in cells: base.paste(SKY[(x // 3 + y // 3) % 3].crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
    for (x, y) in cells: base.alpha_composite(cell_of(sheet, nb(cells, x, y)), (x * 16, y * 16))
    return base


def build(sheets, out):
    S = 3
    rows = []
    for (name, sh, sky) in sheets:
        bg = _grass(64, 64, 3)
        if sky:
            bg.paste(SKY[0].crop((0, 0, 48, 48)), (0, 0)); bg.paste(SKY[0].crop((0, 0, 16, 48)), (48, 0)); bg.paste(SKY[0].crop((0, 0, 48, 16)), (0, 48)); bg.paste(SKY[0].crop((0, 0, 16, 16)), (48, 48))
        bg.alpha_composite(sh)
        rows.append((name, [bg] + [lay(sh, r, sky) for r in SHAPES.values()]))
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
    return [('autotile-dirt-path (trodden earth path, walk)', HA.autotile_path(), False),
            ('autotile-dry-grass (dry olive grass patch, walk)', HA.autotile_dry(), False),
            ('autotile-crop-rows (vegetable furrows, blocked)', HA.autotile_crop(), False),
            ('autotile-cliff-lip (plateau edge earth lip over a cliff, walk) — # = plateau', HC.autotile_lip(), False),
            ('autotile-sky-rim (grassy cliff rim around sky cells, blocked) — # = sky', HC.autotile_skyrim(), True)]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, 'check-autotile.png')
    build(SHEETS(), out)
    print('wrote', out)

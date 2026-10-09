# 오토타일 이음 시험 그림 check-autotile.png: 오토타일마다 [16변형 시트 | 5x5 덩이 | 나선 | 코가 튀어나온 L자 덩이]를
# 저택 바닥 위에 칸 번호 규칙(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)으로 이어 붙여 3배로 보인다(최종 탑 ft_check5 와 같은 판).
import os, sys
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
from PIL import ImageDraw
from hm_kit import *

SHAPES = {
    'blob 5x5': ["         ", "         ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "         ", "         "],
    'spiral':   ["#########", "#       #", "# ##### #", "# #   # #", "# # # # #", "# # ### #", "# #     #", "# #######", "#        "],
    'L + nose': ["         ", " ##      ", " ##      ", " ###     ", " ####### ", " ####### ", "   ##    ", "   #     ", "         "],
}


def floor_bg(wc, hc, kind):
    im = Image.new('RGBA', (wc * T, hc * T), (0, 0, 0, 255))
    for y in range(hc):
        for x in range(wc): im.alpha_composite(dlib.floor_tile(kind, x, y), (x * T, y * T))
    return im


def lay(sheet, rows, kind):
    H = len(rows); Wd = len(rows[0])
    base = floor_bg(Wd, H, kind)
    cells = {(x, y) for y in range(H) for x in range(Wd) if rows[y][x] == '#'}
    for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): base.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
    return base


def build(sheets, out):
    S = 3
    cw = 9 * 16 * S + 16
    o = Image.new('RGB', (64 * 4 + 16 + cw * 3 + 16, len(sheets) * (9 * 16 * S + 26) + 8), (28, 28, 34)); d = ImageDraw.Draw(o)
    y = 8
    for (name, sh, kind) in sheets:
        bg = floor_bg(4, 4, kind); bg.alpha_composite(sh)
        d.text((8, y), name, fill=(230, 230, 230))
        o.paste(bg.resize((256, 256), Image.NEAREST).convert('RGB'), (8, y + 14))
        for i, (lbl, rows) in enumerate(SHAPES.items()):
            t = lay(sh, rows, kind)
            x = 64 * 4 + 24 + i * cw
            d.text((x, y), lbl, fill=(200, 200, 200))
            o.paste(t.resize((t.width * S, t.height * S), Image.NEAREST).convert('RGB'), (x, y + 14))
        y += 9 * 16 * S + 26
    o.save(out)


def SHEETS():
    import hm_auto as A
    return [('autotile-dust-drift (dust drift, walk) on manor boards', A.autotile_dust(), 'hm_boards'),
            ('autotile-cobweb (floor cobweb, walk) on rotten boards', A.autotile_cobweb(), 'hm_rotten'),
            ('autotile-mildew (mildew / water stain, walk) on cellar flag', A.autotile_mildew(), 'hm_cellar'),
            ('autotile-carpet-worn (worn crimson runner, walk) on faded checker', A.autotile_carpet(), 'hm_checker'),
            ('autotile-banister (broken banister, blocked) on foyer flag', A.autotile_banister(), 'hm_foyer')]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, 'check-autotile.png')
    build(SHEETS(), out)
    print('wrote', out)

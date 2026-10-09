# 오토타일 이음 시험 그림 check-autotile.png: 오토타일마다 [16변형 시트 | 5x5 덩이 | 나선 | 코가 튀어나온 L자 덩이] 를
# 이 팩의 바닥 표본 위에(운하·젖은 석판 = ground-grass, 연잎 = 운하 물 위) 칸 번호 규칙(위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)으로 이어 붙여 3배로.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
import lr_ground as LG
from lr_base import cell_of

SHAPES = {
    'blob 5x5': ["         ", "         ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "  #####  ", "         ", "         "],
    'spiral':   ["#########", "#       #", "# ##### #", "# #   # #", "# # # # #", "# # ### #", "# #     #", "# #######", "#        "],
    'L + nose': ["         ", " ##      ", " ##      ", " ###     ", " ####### ", " ####### ", "   ##    ", "   #     ", "         "],
}


def nb(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)


def tile_bg(sample, w, h):
    o = Image.new('RGBA', (w, h))
    for y in range(0, h, 48):
        for x in range(0, w, 48): o.paste(sample, (x, y))
    return o


def lay(sheet, rows, base):
    cells = {(x, y) for y in range(len(rows)) for x in range(len(rows[0])) if rows[y][x] == '#'}
    for (x, y) in cells: base.alpha_composite(cell_of(sheet, nb(cells, x, y)), (x * 16, y * 16))
    return base


def water_bg(w, h):
    """연잎 시험 바탕: 풀 위에 운하 물을 한 칸 테만 남기고 가득."""
    b = tile_bg(LG.ground_grass(), w, h)
    cw, ch = w // 16, h // 16
    rows = [''.join('#' if 0 < x < cw - 1 and 0 < y < ch - 1 else ' ' for x in range(cw)) for y in range(ch)]
    rows = [r.replace(' ', '#') for r in rows]               # 시험 판 전체를 물로(테 없음 — 연잎 윤곽만 본다)
    return lay(LG.autotile_canal(), rows, b)


def build(out):
    S = 3
    SH = [('autotile-canal (canal water + ragged rubble bank, blocked) on ground-grass', LG.autotile_canal(), lambda w, h: tile_bg(LG.ground_grass(), w, h)),
          ('autotile-wet-flagstone (wet granite slabs, walk) on ground-dirt', LG.autotile_wetflag(), lambda w, h: tile_bg(LG.ground_dirt(), w, h)),
          ('autotile-lotus (lotus clump on canal water, blocked)', LG.autotile_lotus(), water_bg),
          ('autotile-flagstone-curb (flagstone street with kerb, walk) on ground-grass', LG.autotile_curb(), lambda w, h: tile_bg(LG.ground_grass(), w, h))]
    rows = []
    for (name, sh, bgf) in SH:
        bg = bgf(64, 64); bg.alpha_composite(sh)
        tiles = [bg] + [lay(sh, r, bgf(9 * 16, 9 * 16)) for r in SHAPES.values()]
        rows.append((name, tiles))
    cw = 9 * 16 * S + 16
    o = Image.new('RGB', (64 * 4 + 16 + cw * 3 + 16, len(rows) * (9 * 16 * S + 26) + 8), (28, 28, 34)); d = ImageDraw.Draw(o)
    y = 8
    for (name, tiles) in rows:
        d.text((8, y), name, fill=(230, 230, 230))
        o.paste(tiles[0].resize((256, 256), Image.NEAREST).convert('RGB'), (8, y + 14))
        for i, (lbl, t) in enumerate(zip(SHAPES, tiles[1:])):
            x = 64 * 4 + 24 + i * cw
            d.text((x, y + 2), lbl, fill=(200, 200, 200))
            o.paste(t.resize((t.width * S, t.height * S), Image.NEAREST).convert('RGB'), (x, y + 14))
        y += 9 * 16 * S + 26
    o.save(out)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'check-autotile.png')
    build(out); print('wrote', out)

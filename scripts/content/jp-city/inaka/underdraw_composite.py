#!/usr/bin/env python3
"""밑그림 대조 시트: 위 띠 = 조각마다 [box_underdraw 밑그림 | 같은 칸 상자 위 완성 조각] 4배, 아래 = pilot_sheet.py 의 보통 행.

  python3 scripts/content/jp-city/inaka/underdraw_composite.py --ids inaka-keitora-white,inaka-red-tractor --out <png>
"""
import argparse, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-inaka'))
import box_underdraw as B  # noqa: E402

KIND = {'inaka-keitora-white': 'keitora', 'inaka-red-tractor': 'tractor', 'inaka-fire-watchtower': 'watchtower',
        'inaka-bicycle-parked': 'bicycle'}
KIND.update({'inaka-' + k + ('-thatched' if k == 'kominka' else '-storehouse' if k == 'kura' else ''): 'house-' + k for k in B.HOUSES})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--scale', type=int, default=4)
    a = ap.parse_args()
    ids = a.ids.split(',')
    import bake_inaka
    _, _, renders, _ = bake_inaka._finalize()
    k = a.scale
    cells = []
    for kid in ids:
        S = B.render(KIND[kid])
        ud = S.grey().convert('RGBA')
        fin = Image.new('RGBA', ud.size, (150, 140, 120, 255))
        fin.alpha_composite(renders[kid], (B.PAD, B.PAD))
        d = ImageDraw.Draw(fin)
        for i in range(0, S.kw, 2):
            d.point((B.PAD + i, B.PAD), (220, 40, 40)); d.point((B.PAD + i, B.PAD + S.kh - 1), (220, 40, 40))
        for j in range(0, S.kh, 2):
            d.point((B.PAD, B.PAD + j), (220, 40, 40)); d.point((B.PAD + S.kw - 1, B.PAD + j), (220, 40, 40))
        pair = Image.new('RGBA', (ud.width * 2 + 4, ud.height), (24, 26, 30, 255))
        pair.alpha_composite(ud, (0, 0)); pair.alpha_composite(fin, (ud.width + 4, 0))
        cells.append((kid, pair.resize((pair.width * k, pair.height * k), Image.NEAREST)))
    tmp = tempfile.mktemp(suffix='.png')
    subprocess.run([sys.executable, os.path.join(HERE, 'pilot_sheet.py'), '--ids', a.ids, '--out', tmp], check=True, cwd=ROOT,
                   stdout=subprocess.DEVNULL)
    rows = Image.open(tmp).convert('RGBA')
    strip_w = sum(c.width for _, c in cells) + 16 * (len(cells) + 1)
    strip_h = max(c.height for _, c in cells) + 30
    W = max(strip_w, rows.width)
    sheet = Image.new('RGBA', (W, strip_h + rows.height), (24, 26, 30, 255))
    d = ImageDraw.Draw(sheet)
    x = 16
    for kid, cimg in cells:
        d.text((x, 6), f'{kid}: [computed 3D under-drawing | candidate on the same box] 4x', fill=(230, 230, 230, 255))
        sheet.alpha_composite(cimg, (x, 22)); x += cimg.width + 16
    sheet.alpha_composite(rows, (0, strip_h))
    sheet.save(a.out); os.remove(tmp); print(a.out, sheet.size)


if __name__ == '__main__':
    main()

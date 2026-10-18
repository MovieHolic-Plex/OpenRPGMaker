# Contact sheet of R10 / R10b / R11 prop art (2x, labelled) for visual QA.
# Run: python3 scripts/content/modern-city-int/r10/preview_sheet.py OUT.png [r10|r10b|r11|cab ...]
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'r11'))
from PIL import Image, ImageDraw
import bake_r10, bake_r10b, bake_r11

BG, INK, K, WIDTH = (146, 146, 140), (34, 36, 44), 2, 1560


def sheet(items, out):
    cells = []
    for pid, fn in items:
        im = fn(); cells.append((pid, im.resize((im.width * K, im.height * K), Image.NEAREST)))
    x = y = 12; row_h = 0; pos = []
    for pid, im in cells:
        w = max(im.width, 108) + 12
        if x + w > WIDTH: x = 12; y += row_h + 22; row_h = 0
        pos.append((x, y, w)); x += w; row_h = max(row_h, im.height)
    out_im = Image.new('RGB', (WIDTH, y + row_h + 30), BG); d = ImageDraw.Draw(out_im)
    rows = {}
    for (px, py, w), (pid, im) in zip(pos, cells): rows.setdefault(py, []).append((px, w, pid, im))
    for py, rr in rows.items():
        h = max(im.height for *_r, im in rr)
        for px, w, pid, im in rr:
            out_im.paste(im, (px + (w - 12 - im.width) // 2, py + h - im.height), im)
            d.text((px, py + h + 4), pid[:24], fill=INK)
    out_im.save(out); print(out, out_im.size, len(cells))


if __name__ == '__main__':
    sets = sys.argv[2:] or ['r10']
    items = []
    if 'r10' in sets: items += [(p[0], p[7]) for p in bake_r10.PROPS]
    if 'r10b' in sets or 'r10' in sets: items += [(p[0], p[7]) for p in bake_r10b.PROPS]
    if 'r11' in sets: items += [(p[0], p[7]) for p in bake_r11.PROPS]
    if 'cab' in sets: items += [(p[0], p[7]) for p in bake_r11.PROPS if p[0].startswith('train-')]
    sheet(items, sys.argv[1])

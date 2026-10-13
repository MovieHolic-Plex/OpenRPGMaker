"""python3 steam_b_preview.py <out.png> [zoom] [ids…] — 줄 B 그림을 바탕 위에 확대해 한 장에(눈 검수용)."""
import sys, os, importlib, glob
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKIP = {'steam_b_lib', 'steam_b_all', 'steam_b_preview', 'steam_b_pack', 'steam_b_scenes', 'steam_b_viz'}
for f in sorted(glob.glob(os.path.join(HERE, 'steam_b_*.py'))):
    n = os.path.basename(f)[:-3]
    if n not in SKIP: importlib.import_module(n)
import registry as R
from PIL import Image


def sheet(ids=None, Z=3, W=1800, bg=(92, 104, 96, 255), frames=False):
    ps = R.pieces_of('B', set(ids) if ids else None)
    pad = 10; x = pad; y = pad; rowh = 0
    canvas = Image.new('RGBA', (W, 6000), bg)
    for p in ps:
        fs = range(p['frames']) if frames else [0]
        for f in fs:
            im = R.render(p, f)
            w, h = im.size[0] * Z, im.size[1] * Z
            if x + w > W: x = pad; y += rowh + pad; rowh = 0
            big = im.resize((w, h), 0); canvas.paste(big, (x, y), big); x += w + pad; rowh = max(rowh, h)
    return canvas.crop((0, 0, W, y + rowh + pad))


if __name__ == '__main__':
    out = sys.argv[1]; Z = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    sheet(sys.argv[3:] or None, Z, frames=True).save(out); print(out)

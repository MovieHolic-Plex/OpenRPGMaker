# 작업용 미리보기: 조각들을 2배로 한 장에(_qa/). 산출물 아님.
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
import ec_base


def sheet(items, out, scale=2, bg=(84, 112, 70), cols=None, maxw=1800):
    pad = 8
    rows = []; row = []; w = pad
    for name, im in items:
        if w + im.width * scale + pad > maxw and row:
            rows.append(row); row = []; w = pad
        row.append((name, im)); w += im.width * scale + pad
    if row: rows.append(row)
    Wt = maxw; Ht = sum(max(im.height for _, im in r) * scale + 22 for r in rows) + pad
    o = Image.new('RGBA', (Wt, Ht), bg + (255,)); d = ImageDraw.Draw(o)
    y = pad
    for r in rows:
        x = pad
        for name, im in r:
            d.text((x, y), name, fill=(255, 255, 255, 255))
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 12))
            x += im.width * scale + pad
        y += max(im.height for _, im in r) * scale + 22
    o.convert('RGB').save(os.path.join(HERE, '_qa', out))


if __name__ == '__main__':
    mod = importlib.import_module(sys.argv[1])
    names = sys.argv[3:]
    items = [(n, getattr(mod, n)()) for n in names]
    sheet(items, sys.argv[2])

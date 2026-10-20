"""Before/after board: each redrawn prop at 1x and SCALE x next to its original and known-good references."""
import os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import redraw as R

REFS = ['bread shelf', 'wardrobe', 'bookshelf 1w', 'item shop shelf', 'globe', 'crystal ball']


def card(label, im, S):
    big = im.resize((im.width * S, im.height * S), Image.NEAREST)
    W = max(big.width + im.width + 14, 120); H = max(big.height, im.height) + 20
    c = Image.new('RGBA', (W, H), (58, 52, 48, 255))
    bg = Image.new('RGBA', big.size, (150, 122, 90, 255)); d = ImageDraw.Draw(bg)
    for y in range(0, big.height, 16 * S):
        for x in range(0, big.width, 16 * S):
            if ((x + y) // (16 * S)) % 2: d.rectangle([x, y, x + 16 * S - 1, y + 16 * S - 1], fill=(140, 113, 83, 255))
    bg.alpha_composite(big); c.alpha_composite(bg, (4, 18))
    sm = Image.new('RGBA', im.size, (150, 122, 90, 255)); sm.alpha_composite(im); c.alpha_composite(sm, (big.width + 10, 18))
    ImageDraw.Draw(c).text((4, 3), label[:30], fill=(255, 240, 200, 255))
    return c


def row(cards):
    W = sum(c.width + 6 for c in cards); H = max(c.height for c in cards)
    o = Image.new('RGBA', (W, H), (30, 28, 26, 255)); x = 0
    for c in cards: o.alpha_composite(c, (x, 0)); x += c.width + 6
    return o


def stack(rows, out):
    W = max(r.width for r in rows); H = sum(r.height + 6 for r in rows)
    o = Image.new('RGBA', (W, H), (30, 28, 26, 255)); y = 0
    for r in rows: o.alpha_composite(r, (0, y)); y += r.height + 6
    o.save(out); return out


def board(ids, out, S=6, refs=REFS, frame=0):
    res = R.build()
    rows = [row([card('REF ' + r, R.frames(r)[0], S) for r in refs])]
    pair = []
    for i in ids:
        pair += [card('before ' + i, R.frames(i)[frame], S), card('after ' + i, res[i][frame], S)]
        if len(pair) >= 6: rows.append(row(pair)); pair = []
    if pair: rows.append(row(pair))
    return stack(rows, out)


if __name__ == '__main__':
    out = sys.argv[1]; ids = sys.argv[2:]
    print(board(ids, out))

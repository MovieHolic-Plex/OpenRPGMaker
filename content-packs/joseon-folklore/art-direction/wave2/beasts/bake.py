"""Bake literal native64 ASCII grids; no source-art drawing or resampling.

Run `python bake.py --idle` for the early checkpoint; `python bake.py` for all.
Pillow is used only for direct pixel assignment, PNG packing and review labels.
"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
NAMES = ('wild-boar', 'venom-toad', 'mortar-rabbit')
POSES = ('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead')


def read(slug, pose):
    rows = (ROOT / 'source' / slug / (pose + '.pxgrid')).read_text().splitlines()
    assert len(rows) == 64 and all(len(row) == 64 for row in rows), (slug, pose)
    palette = json.loads((ROOT / 'source' / (slug + '.palette.json')).read_text())
    assert len(palette) <= 18 and '.' not in palette
    rgba = {s: tuple(bytes.fromhex(c.lstrip('#'))) + (255,) for s, c in palette.items()}
    rgba['.'] = (0, 0, 0, 0)
    im = Image.new('RGBA', (64, 64))
    pixels = im.load()
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            pixels[x, y] = rgba[symbol]
    bbox = im.getbbox()
    assert bbox and bbox[0] >= 1 and bbox[1] >= 1 and bbox[2] <= 63 and bbox[3] <= 61
    return im


def checker_tile(canvas, im, xy, scale=1):
    # Enlargement belongs only to review canvases. Original PNGs stay native64.
    shown = im if scale == 1 else im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
    bg = Image.new('RGBA', shown.size)
    pixels = bg.load()
    for y in range(bg.height):
        for x in range(bg.width):
            c = 115 if ((x // (8 * scale)) + (y // (8 * scale))) % 2 else 132
            pixels[x, y] = (c, c, c, 255)
    bg.alpha_composite(shown)
    canvas.alpha_composite(bg, xy)


def label(canvas, xy, text):
    ImageDraw.Draw(canvas).text(xy, text, fill=(226, 226, 218), font=ImageFont.load_default())


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--idle', action='store_true')
    idle_only = args.parse_args().idle
    for sub in ('sprites', 'portraits', 'review'):
        (ROOT / sub).mkdir(exist_ok=True)
    files, manifest = [], {}
    lineup = Image.new('RGBA', (710, 324), (39, 42, 45, 255))
    label(lineup, (12, 10), 'WAVE 2 BEASTS / native 1x + nearest 3x / facing RIGHT / ground y60')
    for i, slug in enumerate(NAMES):
        idle = read(slug, 'idle_a')
        portrait = ROOT / 'portraits' / (slug + '.png')
        idle.save(portrait)
        files.append(str(portrait.relative_to(ROOT)))
        x = 12 + i * 232
        label(lineup, (x, 32), slug)
        checker_tile(lineup, idle, (x, 50))
        checker_tile(lineup, idle, (x, 118), 3)
        if idle_only:
            continue
        sheet = Image.new('RGBA', (192, 192))
        board = Image.new('RGBA', (678, 840), (39, 42, 45, 255))
        label(board, (12, 10), slug + ' / 9 native64 poses / 1x and 3x / RIGHT')
        manifest[slug] = {}
        hashes = []
        for j, pose in enumerate(POSES):
            im = read(slug, pose)
            sheet.paste(im, ((j % 3) * 64, (j // 3) * 64))
            x, y = 12 + (j % 3) * 222, 34 + (j // 3) * 257
            label(board, (x, y), pose)
            checker_tile(board, im, (x, y + 16))
            checker_tile(board, im, (x, y + 82), 3)
            digest = hashlib.sha256(im.tobytes()).hexdigest()
            hashes.append(digest)
            native_pixels = [im.getpixel((xx, yy)) for yy in range(64) for xx in range(64)]
            manifest[slug][pose] = {
                'bbox_exclusive': list(im.getbbox()),
                'opaque_colors': len({c for c in native_pixels if c[3]}),
                'rgba_sha256': digest,
                'alpha': sorted({c[3] for c in native_pixels}),
            }
        assert len(set(hashes)) == 9, slug + ': duplicate poses'
        sp = ROOT / 'sprites' / (slug + '.png')
        rp = ROOT / 'review' / (slug + '-poses.png')
        sheet.save(sp)
        board.save(rp)
        files.extend(str(p.relative_to(ROOT)) for p in (sp, rp))
    # Save the review BEFORE publishing the checkpoint flag.
    lineup.save(ROOT / 'review' / 'idle-lineup.png')
    files.append('review/idle-lineup.png')
    if not idle_only:
        (ROOT / 'review' / 'geometry.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT / 'progress.json').write_text(json.dumps({'phase': 'idle-ready' if idle_only else 'complete', 'files': files}, indent=2) + '\n')
    print(json.dumps({'phase': 'idle-ready' if idle_only else 'complete', 'files': files}))


if __name__ == '__main__':
    main()

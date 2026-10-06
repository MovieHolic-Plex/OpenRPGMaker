"""Read current / preserved grids; draw background and label diagnostics only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
POSES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead']
ACTIONS = ['skill_a', 'skill_b', 'skill_c', 'poison_a', 'poison_b',
           'stun_a', 'stun_b', 'sleep_a', 'sleep_b']

def background(size, bg):
    im = Image.new('RGB', size, '#EEE7DA' if bg == 'light' else '#1D2636')
    if bg == 'checker':
        d = ImageDraw.Draw(im)
        for y in range(0, size[1], 8):
            for x in range(0, size[0], 8):
                d.rectangle((x, y, x + 7, y + 7),
                            fill='#647084' if (x // 8 + y // 8) % 2 else '#384454')
    return im

def main():
    palette = {k: tuple(bytes.fromhex(v[1:])) + (255,)
               for k, v in json.loads((ROOT / 'palette.json').read_text()).items()}
    current, before = {}, {}
    for name in POSES + ACTIONS:
        folder = 'poses' if name in POSES else 'actions'
        for base, images in [(ROOT, current), (ROOT / 'before-volume-horn-repair', before)]:
            rows = (base / folder / (name + '.pxgrid')).read_text().splitlines()
            im = Image.new('RGBA', (128, 128))
            im.putdata([palette[c] if c != '.' else (0, 0, 0, 0)
                        for row in rows for c in row])
            images[name] = im
    for bg in ['light', 'dark', 'checker']:
        ink = '#18232B' if bg == 'light' else 'white'
        sheet = background((864, 450), bg)
        d = ImageDraw.Draw(sheet)
        compare = background((864, 900), bg)
        cd = ImageDraw.Draw(compare)
        for i, name in enumerate(POSES + ACTIONS):
            x, y = i % 6 * 144, i // 6 * 150
            sheet.paste(current[name], (x, y + 18), current[name])
            d.text((x + 2, y + 2), name, fill=ink)
            x, y = i % 3 * 288, i // 3 * 150
            for side, images in enumerate([before, current]):
                im = images[name]
                compare.paste(im, (x + side * 144, y + 18), im)
                cd.text((x + side * 144 + 2, y + 2),
                        name + (' before' if side == 0 else ' current'), fill=ink)
        sheet.save(OUT / (bg + '-1x.png'))
        compare.save(OUT / ('volume-horn-comparison-' + bg + '-1x.png'))
        focus = background((1182, 828), bg)
        fd = ImageDraw.Draw(focus)
        for i, name in enumerate(['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack']):
            im = current[name].resize((384, 384), Image.Resampling.NEAREST)
            x, y = i % 3 * 394, i // 3 * 414
            focus.paste(im, (x, y + 24), im)
            fd.text((x + 3, y + 5), name, fill=ink)
        focus.save(OUT / ('volume-horn-' + bg + '-3x.png'))
    detail = background((1120, 560), 'light')
    d = ImageDraw.Draw(detail)
    for i, (name, box) in enumerate([
        ('idle_a', (55, 74, 89, 107)), ('attack', (73, 69, 127, 96)),
        ('windup', (81, 55, 115, 79)), ('move', (80, 56, 115, 77))]):
        crop = current[name].crop(box)
        crop = crop.resize((crop.width * 6, crop.height * 6), Image.Resampling.NEAREST)
        x, y = i % 2 * 560, i // 2 * 280
        detail.paste(crop, (x, y + 24), crop)
        d.text((x + 4, y + 4), name + ' native crop ' + str(box), fill='#18232B')
    detail.save(OUT / 'volume-horn-detail.png')
    print('Rendered native / diagnostic comparison images inside source.')

if __name__ == '__main__':
    main()

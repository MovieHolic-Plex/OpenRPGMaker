"""Read literal source; show native pixels and nearest-neighbor diagnostics only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
POSES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead']
ACTIONS = ['skill_a', 'skill_b', 'skill_c', 'poison_a', 'poison_b',
           'stun_a', 'stun_b', 'sleep_a', 'sleep_b']
FOCUS = ['attack', 'hit', 'dead', 'skill_b', 'skill_c', 'stun_a']


def main():
    palette = {k: tuple(bytes.fromhex(v[1:])) + (255,)
               for k, v in json.loads((ROOT / 'palette.json').read_text()).items()}
    current, prior = {}, {}
    for name in POSES + ACTIONS:
        folder = 'poses' if name in POSES else 'actions'
        for base, images in [(ROOT, current), (ROOT / 'before-native-cluster-repair', prior)]:
            rows = (base / folder / (name + '.pxgrid')).read_text().splitlines()
            im = Image.new('RGBA', (128, 128))
            im.putdata([palette[c] if c != '.' else (0, 0, 0, 0)
                        for row in rows for c in row])
            images[name] = im

    def background(size, name):
        im = Image.new('RGB', size, '#EEE7DA' if name == 'light' else '#1D2636')
        if name == 'checker':
            draw = ImageDraw.Draw(im)
            for y in range(0, size[1], 8):
                for x in range(0, size[0], 8):
                    draw.rectangle((x, y, x + 7, y + 7),
                                   fill='#647084' if (x // 8 + y // 8) % 2 else '#384454')
        return im

    for bg in ['light', 'dark', 'checker']:
        ink = '#18232B' if bg == 'light' else 'white'
        sheet = background((864, 450), bg)
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(POSES + ACTIONS):
            x, y = i % 6 * 144, i // 6 * 150
            sheet.paste(current[name], (x, y + 18), current[name])
            draw.text((x + 2, y + 2), name, fill=ink)
        sheet.save(OUT / (bg + '-1x.png'))

        compare = background((864, 900), bg)
        draw = ImageDraw.Draw(compare)
        for i, name in enumerate(POSES + ACTIONS):
            x, y = i % 3 * 288, i // 3 * 150
            for side, images in enumerate([prior, current]):
                im = images[name]
                compare.paste(im, (x + side * 144, y + 18), im)
                draw.text((x + side * 144 + 2, y + 2),
                          name + (' before' if side == 0 else ' after'), fill=ink)
        compare.save(OUT / ('native-repair-comparison-' + bg + '-1x.png'))

        detail = background((1182, 828), bg)
        draw = ImageDraw.Draw(detail)
        for i, name in enumerate(FOCUS):
            x, y = i % 3 * 394, i // 3 * 414
            im = current[name].resize((384, 384), Image.Resampling.NEAREST)
            detail.paste(im, (x, y + 24), im)
            draw.text((x + 3, y + 5), name, fill=ink)
        detail.save(OUT / ('native-repair-' + bg + '-3x.png'))
    print('Saved three-background native and enlarged comparison PNGs inside source.')


if __name__ == '__main__':
    main()

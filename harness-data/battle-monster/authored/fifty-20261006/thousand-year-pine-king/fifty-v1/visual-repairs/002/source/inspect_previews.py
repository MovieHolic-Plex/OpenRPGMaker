"""Source-only diagnostics from current PNGs and decoded GIF frames.

Nearest enlargement and labels are review aids, never pxgrid inputs.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import render_pixels

ROOT = Path(__file__).resolve().parent
NAMES = ['sleep_a', 'sleep_b', 'hit', 'skill_b', 'dead']

def main():
    for name in NAMES:
        native = render_pixels.background('light', (128, 128))
        native.alpha_composite(Image.open(ROOT / 'png' / (name + '.png')))
        native.resize((512, 512), Image.Resampling.NEAREST).save(ROOT / 'png' / ('detail-' + name + '-4x.png'))
    for kind in ['light', 'dark', 'checker']:
        panel = render_pixels.background(kind, (640, 148))
        labels = ImageDraw.Draw(panel)
        for i, name in enumerate(NAMES):
            panel.alpha_composite(Image.open(ROOT / 'png' / (name + '.png')), (i * 128, 18))
            labels.text((i * 128 + 3, 2), name, fill=(40, 42, 45) if kind == 'light' else (237, 225, 190))
        panel.convert('RGB').save(ROOT / 'png' / ('review-after-' + kind + '-1x.png'))
        panel.resize((1920, 444), Image.Resampling.NEAREST).save(ROOT / 'png' / ('review-after-' + kind + '-3x.png'))

    strip = Image.new('RGB', (768, 1216), (36, 42, 49))
    labels = ImageDraw.Draw(strip)
    for row, motion in enumerate(render_pixels.MOTIONS):
        gif = Image.open(ROOT / 'gif' / (motion + '.gif'))
        for i in range(gif.n_frames):
            gif.seek(i)
            frame = gif.convert('RGBA')
            x = i * 128
            y = row * 152
            strip.paste(frame, (x, y + 22), frame)
            labels.text((x + 3, y + 3), f'{motion} {i + 1}: {gif.info.get("duration")}ms', fill=(232, 223, 191))
    strip.save(ROOT / 'png' / 'gif-readback-1x.png')
    strip.resize((1536, 2432), Image.Resampling.NEAREST).save(ROOT / 'png' / 'gif-readback-2x.png')

if __name__ == '__main__':
    main()

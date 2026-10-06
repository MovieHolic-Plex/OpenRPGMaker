"""Read current/archive grids and render labeled comparison panels only.

No source editing or artwork synthesis. Enlargements use nearest sampling.
"""
from pathlib import Path
import hashlib
import json
from PIL import ImageDraw
import render_pixels

ROOT = Path(__file__).resolve().parent
OLD = ROOT / 'history' / 'before-mass-bark-repair'


def main():
    entries = [
        ('idle_a', ROOT / 'poses' / 'idle_a.pxgrid'),
        ('recover', ROOT / 'poses' / 'recover.pxgrid'),
        ('hit before', OLD / 'poses' / 'hit.pxgrid'),
        ('hit after', ROOT / 'poses' / 'hit.pxgrid'),
        ('sleep_a before', OLD / 'actions' / 'sleep_a.pxgrid'),
        ('sleep_a after', ROOT / 'actions' / 'sleep_a.pxgrid'),
        ('sleep_b before', OLD / 'actions' / 'sleep_b.pxgrid'),
        ('sleep_b after', ROOT / 'actions' / 'sleep_b.pxgrid'),
    ]
    for kind in ['light', 'dark', 'checker']:
        panel = render_pixels.background(kind, (512, 300))
        labels = ImageDraw.Draw(panel)
        for i, (label, path) in enumerate(entries):
            im, _ = render_pixels.rgba(path)
            x, y = (i % 4) * 128, (i // 4) * 150
            panel.alpha_composite(im, (x, y + 19))
            labels.text((x + 3, y + 3), label, fill=(40, 45, 42) if kind == 'light' else (238, 224, 192))
        panel.convert('RGB').save(ROOT / 'png' / ('mass-bark-' + kind + '-1x.png'))
        panel.resize((1536, 900), render_pixels.Image.Resampling.NEAREST).save(ROOT / 'png' / ('mass-bark-' + kind + '-3x.png'))

    records = []
    for folder in ['poses', 'actions']:
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            before = (OLD / folder / path.name).read_text().splitlines()
            after = path.read_text().splitlines()
            changed = [(x, y) for y in range(128) for x in range(128) if before[y][x] != after[y][x]]
            record = dict(file=str(path.relative_to(ROOT)), changedPixels=len(changed),
                          currentSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                          previousSha256=hashlib.sha256((OLD / folder / path.name).read_bytes()).hexdigest())
            if changed:
                record['changedBounds'] = [min(x for x, y in changed), min(y for x, y in changed),
                                           max(x for x, y in changed), max(y for x, y in changed)]
            records.append(record)
    (ROOT / 'mass-bark-changes.json').write_text(json.dumps(dict(
        note='Measured source differences, not independent review, approval or selection.',
        frames=records), indent=2) + '\n')


if __name__ == '__main__':
    main()

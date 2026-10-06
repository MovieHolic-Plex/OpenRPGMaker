"""Read source rows and make diagnostic comparison panels only."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
import render_pixels

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'history' / 'before-dead-branch-repair'


def main():
    before, _ = render_pixels.rgba(ARCHIVE / 'poses' / 'dead.pxgrid')
    after, _ = render_pixels.rgba(ROOT / 'poses' / 'dead.pxgrid')
    for kind in ['light', 'dark', 'checker']:
        sheet = render_pixels.background(kind, (256, 146))
        label = ImageDraw.Draw(sheet)
        for x, name, frame in [(0, 'before', before), (128, 'after', after)]:
            sheet.alpha_composite(frame, (x, 18))
            label.text((x + 4, 2), name, fill=(40, 45, 42) if kind == 'light' else (239, 229, 202))
        sheet.convert('RGB').save(ROOT / 'png' / f'dead-branch-{kind}-1x.png')
        sheet.resize((768, 438), Image.Resampling.NEAREST).save(ROOT / 'png' / f'dead-branch-{kind}-3x.png')
    detail = render_pixels.background('light', (128, 128))
    detail.alpha_composite(after)
    detail.resize((512, 512), Image.Resampling.NEAREST).save(ROOT / 'png' / 'detail-dead-4x.png')
    records = []
    for folder in ['poses', 'actions']:
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            old_path = ARCHIVE / folder / path.name
            old = old_path.read_text().splitlines()
            new = path.read_text().splitlines()
            changes = [dict(x=x, y=y, before=a, after=b)
                       for y, (oldrow, newrow) in enumerate(zip(old, new))
                       for x, (a, b) in enumerate(zip(oldrow, newrow)) if a != b]
            records.append(dict(pose=path.stem, changedPixels=len(changes),
                                beforeSha256=hashlib.sha256(old_path.read_bytes()).hexdigest(),
                                afterSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                pixels=changes))
    palette = ROOT / 'palette.json'
    (ROOT / 'dead-branch-changes.json').write_text(json.dumps(dict(
        note='Computed local source differences; no review or approval status.',
        paletteUnchanged=palette.read_bytes() == (ARCHIVE / 'palette.json').read_bytes(),
        frames=records), indent=2) + '\n')
    print(json.dumps({r['pose']: r['changedPixels'] for r in records}))


if __name__ == '__main__':
    main()

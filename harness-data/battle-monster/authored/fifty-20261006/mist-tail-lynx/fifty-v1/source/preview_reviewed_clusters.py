"""Render diagnostic comparisons from existing literal grids only."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw
from render import ROOT, RGB
from repair_reviewed_clusters import ARCHIVE, CHANGES


def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([(0, 0, 0, 0) if s == '.' else (*RGB[s], 255)
                for row in rows for s in row])
    return im


def main():
    for label, bg in [('light', (233, 225, 206)),
                      ('dark', (24, 28, 36)), ('checker', None)]:
        sheet = Image.new('RGB', (1248, 900), bg or (40, 43, 49))
        draw = ImageDraw.Draw(sheet)
        for i, rel in enumerate(CHANGES):
            for j, (version, path) in enumerate([
                    ('before', ARCHIVE / rel), ('current', ROOT / rel)]):
                x = ((i % 3) * 2 + j) * 208 + 8
                y = (i // 3) * 300
                draw.text((x, y + 4), Path(rel).stem + ' ' + version,
                          fill=(95, 86, 75) if label == 'light' else (235, 230, 215))
                if bg is None:
                    for yy in range(64):
                        for xx in range(64):
                            c = (76, 80, 88) if (xx // 8 + yy // 8) % 2 else (108, 112, 116)
                            draw.point((x + xx, y + 22 + yy), fill=c)
                            draw.rectangle((x + xx * 3, y + 94 + yy * 3,
                                            x + xx * 3 + 2, y + 96 + yy * 3), fill=c)
                im = read(path)
                sheet.paste(im, (x, y + 22), im)
                big = im.resize((192, 192), Image.Resampling.NEAREST)
                sheet.paste(big, (x, y + 94), big)
        sheet.save(ROOT / 'preview' / f'reviewed-clusters-{label}.png')
    hashes = json.loads((ARCHIVE / 'hashes.json').read_text())
    report = {}
    for rel, old_hash in hashes.items():
        path = ROOT / rel
        new_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if rel not in CHANGES:
            if new_hash != old_hash:
                raise ValueError(('Unexpected source change', rel))
            continue
        before = (ARCHIVE / rel).read_text().splitlines()
        after = path.read_text().splitlines()
        edits = [{'x': x, 'y': y, 'before': a, 'after': b}
                 for y, (old, new) in enumerate(zip(before, after))
                 for x, (a, b) in enumerate(zip(old, new)) if a != b]
        report[rel] = {
            'changed_pixels': len(edits),
            'bounds': [min(e['x'] for e in edits), min(e['y'] for e in edits),
                       max(e['x'] for e in edits), max(e['y'] for e in edits)],
            'edits': edits, 'sha256_before': old_hash, 'sha256_current': new_hash,
        }
    (ROOT / 'reviewed-clusters-diagnostics.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps({rel: {'changed_pixels': r['changed_pixels'], 'bounds': r['bounds']}
                      for rel, r in report.items()}, indent=2))


if __name__ == '__main__':
    main()

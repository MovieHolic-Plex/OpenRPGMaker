"""Read literal files and generate local before/after diagnostic evidence."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageSequence, ImageChops
from render import ROOT, OUT, read, backdrop, TIMELINES


def main():
    old = ROOT / 'before-repair-003'
    baseline = json.loads((old / 'source-hashes.json').read_text())
    changes = {}
    for rel, digest in baseline.items():
        path = ROOT / rel
        current = hashlib.sha256(path.read_bytes()).hexdigest()
        if current == digest:
            continue
        a = (old / rel).read_text().splitlines()
        b = path.read_text().splitlines()
        coords = [(x, y) for y in range(128) for x in range(128)
                  if a[y][x] != b[y][x]]
        changes[rel] = {
            'beforeSha256': digest, 'currentSha256': current,
            'changedPixels': len(coords),
            'changedBoundsInclusive': [min(x for x, y in coords),
                                       min(y for x, y in coords),
                                       max(x for x, y in coords),
                                       max(y for x, y in coords)],
        }
        name = path.stem
        board = Image.new('RGB', (1152, 1104), (46, 48, 55))
        labels = ImageDraw.Draw(board)
        for row, (state, src) in enumerate((('before', old / rel), ('current', path))):
            im = read(src)
            yy = row * 552
            for k, theme in enumerate(('light', 'dark', 'checker')):
                bg = backdrop(im, theme)
                board.paste(bg, (k * 384, yy + 20))
                board.paste(bg.resize((384, 384), Image.Resampling.NEAREST),
                            (k * 384, yy + 160))
                labels.text((k * 384 + 138, yy + 40),
                            name + ' / ' + state + '\n' + theme + '\n1x and 3x',
                            fill=(244, 235, 211))
        board.save(OUT / (name + '-repair-003-comparison.png'))
    frames = {}
    for folder in ('poses', 'actions'):
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            rows = path.read_text().splitlines()
            coords = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.']
            frames[path.stem] = {
                'size': [len(rows[0]), len(rows)],
                'transparentBorder': all(rows[y][x] == '.' for x in range(128) for y in (0, 127))
                    and all(rows[y][x] == '.' for y in range(128) for x in (0, 127)),
                'lowestInkY': max(y for x, y in coords),
                'symbols': ''.join(sorted(set(''.join(rows)) - {'.'})),
                'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            }
    decoded = {}
    for name, seq in TIMELINES.items():
        with Image.open(OUT / (name + '.gif')) as gif:
            items = []
            for f, (pose, hold) in zip(ImageSequence.Iterator(gif), seq):
                folder = 'poses' if (ROOT / 'poses' / (pose + '.pxgrid')).exists() else 'actions'
                expected = backdrop(read(ROOT / folder / (pose + '.pxgrid')), 'dark')
                delta = ImageChops.difference(f.convert('RGB'), expected)
                items.append({'pose': pose, 'durationMs': f.info.get('duration'),
                              'differentPixels': sum(p != (0, 0, 0) for p in delta.getdata())})
            decoded[name] = items
    report = {
        'changes': changes, 'unchangedOriginalFiles': len(baseline) - len(changes),
        'paletteUnchanged': hashlib.sha256((ROOT / 'palette.json').read_bytes()).hexdigest()
            == baseline['palette.json'],
        'allFramesDistinct': len(set(v['sourceSha256'] for v in frames.values())) == len(frames),
        'frames': frames, 'gifReadback': decoded,
        'note': 'Actual local files only. No independent review result or user selection.',
    }
    (OUT / 'repair-003-readback.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'changes': changes, 'unchangedOriginalFiles': report['unchangedOriginalFiles'],
                      'paletteUnchanged': report['paletteUnchanged'],
                      'allFramesDistinct': report['allFramesDistinct']}, indent=2))


if __name__ == '__main__':
    main()

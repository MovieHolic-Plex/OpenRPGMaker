"""Apply explicitly chosen native ASCII runs; no inferred artwork.

Each tuple is (y, x, literal pixels), with coordinates starting at zero.
The before snapshot is immutable. Full 64x64 pxgrids are the final artwork.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'revisions' / 'reviewed-clusters-before'

CHANGES = {
    'poses/windup.pxgrid': [
        (53, 31, '.'),
        (54, 31, '.'),
        (55, 31, '.'),
        (56, 31, '.'),
        (57, 31, '.'),
        (58, 31, '.'),
        (59, 30, '..'),
        (60, 30, '..'),
    ],
    'poses/attack.pxgrid': [
        (47, 54, 'LLBBCW.'),
        (48, 54, 'LLBCOWW'),
        (49, 54, 'BBBBOO.'),
        (50, 54, 'BBBCWW.'),
        (51, 52, 'MSSSOO...'),
        (52, 52, 'OOOOCW...'),
    ],
    'actions/skill_a.pxgrid': [
        (34, 34, 'OOOO'),
        (35, 31, 'OOOLLB'),
        (36, 31, 'B'),
    ],
    'actions/skill_b.pxgrid': [
        (40, 49, '.'),
    ],
    'actions/skill_c.pxgrid': [
        (34, 33, 'OOOOO'),
        (35, 31, 'OOBLLLLB'),
        (36, 31, 'BBLLLLB'),
        (37, 32, 'BLLB'),
        (38, 32, 'B'),
    ],
    'actions/poison_a.pxgrid': [
        (34, 33, 'OOO'),
        (35, 31, 'OOBLLLB'),
        (36, 31, 'BBLLLLB'),
        (37, 32, 'BLLB'),
        (38, 32, 'BB'),
    ],
    'actions/poison_b.pxgrid': [
        (34, 33, 'OOOO'),
        (35, 31, 'OOBLLLB'),
        (36, 32, 'BLLB'),
        (37, 33, 'B'),
    ],
    'actions/stun_a.pxgrid': [
        (35, 31, 'OOOOO'),
        (36, 30, 'BBBLLLLB'),
        (37, 31, 'BBLLLBB'),
        (38, 32, 'BLLB'),
        (39, 32, 'BB'),
        (52, 36, 'BLLBBMSO...'),
        (53, 36, 'OBLLBMSO...'),
        (54, 36, '.OBLBMSO...'),
        (55, 36, '..OBLBMSO..'),
        (56, 36, '...OBLBMSO..'),
        (57, 40, 'OBLBMSO.OBMSO'),
        (58, 40, 'OBLBMSO.OOWO.'),
        (59, 40, 'OBLLBBO......'),
        (60, 40, 'OOWOOWO......'),
    ],
    'actions/stun_b.pxgrid': [
        (35, 31, 'OOOO'),
        (36, 30, 'BBBLLLB'),
        (37, 31, 'BBLLBB'),
        (38, 32, 'BLB'),
        (39, 32, 'B'),
        (52, 36, 'BLLBBMSO...'),
        (53, 36, 'OBLLBMSO...'),
        (54, 36, '.OBLBMSO...'),
        (55, 36, '..OBLBMSO..'),
        (56, 36, '...OBLBMSO..'),
        (57, 40, 'OBLBMSO.OBMSO'),
        (58, 40, 'OBLBMSO.OOWO.'),
        (59, 40, 'OBLLBBO......'),
        (60, 40, 'OOWOOWO......'),
    ],
}


def main():
    if ARCHIVE.exists():
        raise RuntimeError('Original snapshot already exists; do not overwrite it.')
    palette = json.loads((ROOT / 'palette.json').read_text())
    for rel, runs in CHANGES.items():
        for y, x, pixels in runs:
            if not 1 <= y <= 60 or not 1 <= x or x + len(pixels) > 63:
                raise ValueError((rel, y, x, pixels))
            if not set(pixels) <= set(palette) | {'.'}:
                raise ValueError((rel, pixels))
    paths = [p for folder in ('poses', 'actions')
             for p in sorted((ROOT / folder).glob('*.pxgrid'))]
    hashes = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in paths + [ROOT / 'palette.json']}
    ARCHIVE.mkdir(parents=True)
    for name in ('AUTHORING.md', 'TIMING.md', 'palette.json'):
        shutil.copyfile(ROOT / name, ARCHIVE / name)
    report = {}
    log = ['', '# Reviewer-coordinate repair; explicitly authored local runs.']
    for rel, runs in CHANGES.items():
        path = ROOT / rel
        saved = ARCHIVE / rel
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, saved)
        before = path.read_text().splitlines()
        rows = before.copy()
        log.append('@ ' + path.stem)
        for y, x, pixels in runs:
            rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
            log.append(f'{y} {x} {pixels}')
        path.write_text('\n'.join(rows) + '\n')
        edits = [{'x': x, 'y': y, 'before': a, 'after': b}
                 for y, (old, new) in enumerate(zip(before, rows))
                 for x, (a, b) in enumerate(zip(old, new)) if a != b]
        report[rel] = {
            'changed_pixels': len(edits),
            'bounds': [min(e['x'] for e in edits), min(e['y'] for e in edits),
                       max(e['x'] for e in edits), max(e['y'] for e in edits)],
            'edits': edits,
            'sha256_before': hashes[rel],
            'sha256_current': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    (ARCHIVE / 'hashes.json').write_text(json.dumps(hashes, indent=2) + '\n')
    with (ROOT / 'author_corrections.txt').open('a') as out:
        out.write('\n'.join(log) + '\n')
    (ROOT / 'reviewed-clusters-diagnostics.json').write_text(
        json.dumps(report, indent=2) + '\n')
    print(json.dumps({rel: {'changed_pixels': r['changed_pixels'], 'bounds': r['bounds']}
                      for rel, r in report.items()}, indent=2))


if __name__ == '__main__':
    main()

"""Two explicitly selected native pixels; no inferred or automatic filling."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
SNAPSHOT = ROOT / 'history' / 'before-join-pinhole-repair'
# Coordinates are native, zero based. Both literal replacements were requested.
EDITS = [('actions/skill_c.pxgrid', 54, 39, '.', 'o'),
         ('poses/dead.pxgrid', 69, 65, '.', 'o')]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if SNAPSHOT.exists():
        raise SystemExit('Snapshot already exists; do not replace the original.')
    SNAPSHOT.mkdir(parents=True)
    for folder in ['poses', 'actions']:
        shutil.copytree(ROOT / folder, SNAPSHOT / folder)
    for filename in ['palette.json', 'AUTHORING.md', 'TIMING.md']:
        shutil.copy2(ROOT / filename, SNAPSHOT / filename)
    records = []
    for relative, x, y, before, after in EDITS:
        path = ROOT / relative
        rows = path.read_text(encoding='ascii').splitlines()
        if rows[y][x] != before:
            raise SystemExit(f'Unexpected existing pixel: {relative} ({x},{y})')
        rows[y] = rows[y][:x] + after + rows[y][x+1:]
        path.write_text('\n'.join(rows) + '\n', encoding='ascii')
        records.append(dict(file=relative, x=x, y=y, before=before, after=after,
                            before_sha256=digest(SNAPSHOT / relative),
                            after_sha256=digest(path)))
    # Record differences only; do not use this comparison to choose any pixels.
    differences = []
    for folder in ['poses', 'actions']:
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            relative = path.relative_to(ROOT)
            old = (SNAPSHOT / relative).read_text().splitlines()
            new = path.read_text().splitlines()
            for y, (a, b) in enumerate(zip(old, new)):
                for x, (c, d) in enumerate(zip(a, b)):
                    if c != d:
                        differences.append(dict(file=str(relative), x=x, y=y,
                                                before=c, after=d))
    (ROOT / 'join-pinhole-changes.json').write_text(
        json.dumps(dict(edits=records, differences=differences,
                        palette_unchanged=digest(ROOT / 'palette.json') ==
                        digest(SNAPSHOT / 'palette.json')), indent=2) + '\n')
    print(json.dumps(differences))

if __name__ == '__main__':
    main()

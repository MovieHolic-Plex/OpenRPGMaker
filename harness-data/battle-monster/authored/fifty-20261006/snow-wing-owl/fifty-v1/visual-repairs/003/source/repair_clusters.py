"""Apply explicitly authored native pixel runs; no automatic silhouette changes.

Coordinates are zero based. Runs include literal transparent pixels where an old
claw/effect is removed. The full pxgrids remain the delivered source of truth.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'attack': [
        (53, 38, 'OKTIITTO.OKKO.OKTIITO.OKO'),
        (54, 39, 'OKTIIIITIIKO.OKTIIITIIKO'),
        (55, 40, 'OKTK...OKIO..OKTK..OKIO'),
        (56, 41, 'OKKO..OKKKO..OKKO.OKKO'),
    ],
    'skill_b': [
        # A separate white wing tip feeds the lower diagonal crystal.
        (35, 49, 'CWWCAFAO......'),
        (36, 49, 'OCWCAFLFAA....'),
        (37, 50, 'SOCWAFLFLFAA.'),
        (38, 50, 'SSO.AFLLLFFAA'),
        (39, 53, '.AFFLLLFFA'),
        (40, 53, '..AAFFLFFA'),
        (41, 53, '....AAFLFA'),
        (42, 53, '......AFA.'),
        # Reauthor the shaded belly edge and remove the old tail-like crystal.
        (43, 48, 'SSSSO........A.'),
        (44, 49, 'SSO...........'),
        (45, 47, 'CSSSO...........'),
        (46, 46, 'SSSSO............'),
        (47, 46, 'SSSSO............'),
        (48, 47, 'SSO.............'),
        (49, 49, 'O.............'),
        (50, 50, '.............'),
        (51, 51, '............'),
        (52, 53, '..........'),
        (53, 55, '........'),
        (54, 57, '......'),
    ],
}

def apply():
    backup = ROOT / 'original-before-repair'
    backup.mkdir(exist_ok=True)
    log = []
    replacements = {}
    for name, runs in PATCHES.items():
        folder = 'poses' if name == 'attack' else 'actions'
        path = ROOT / folder / (name + '.pxgrid')
        saved = backup / (name + '.pxgrid')
        if not saved.exists():
            shutil.copyfile(path, saved)
        rows = path.read_text().splitlines()
        log.append('[' + name + ']')
        for y, x, pixels in runs:
            if x + len(pixels) > 63:
                raise ValueError((name, y, x, pixels))
            rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
            log.append(f'{y} {x} {pixels}')
        path.write_text('\n'.join(rows) + '\n')
        replacements[name] = {y: rows[y] for y, _, _ in runs}
    (ROOT / 'repair-rows.txt').write_text('\n'.join(log) + '\n')

    # Lossless serialization of the selected literal rows for the old renderer.
    authored = ROOT / 'authored-rows.txt'
    saved = backup / 'authored-rows.txt'
    if not saved.exists():
        shutil.copyfile(authored, saved)
    output = []
    name = None
    for line in authored.read_text().splitlines():
        if line.startswith('['):
            name = line[1:-1]
        if line and line[0].isdigit():
            y = int(line.split()[0])
            if y in replacements.get(name, {}):
                row = replacements[name][y]
                x = next(i for i, c in enumerate(row) if c != '.')
                line = f'{y} {x} {row[x:].rstrip(".")}'
        output.append(line)
    authored.write_text('\n'.join(output) + '\n')

if __name__ == '__main__':
    apply()

"""Apply individually authored face row fragments. No pose transforms or filling."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'history' / 'before-status-carving'
if not ARCHIVE.exists():
    ARCHIVE.mkdir(parents=True)
    for folder in ('poses', 'actions'):
        shutil.copytree(ROOT / folder, ARCHIVE / folder)
    for name in ('palette.json', 'AUTHORING.md', 'TIMING.md'):
        shutil.copy2(ROOT / name, ARCHIVE / name)

# Each tuple is the actual frame's (x, y, literal pixels). Coordinates are zero based.
# These are separately specified at each face position, never shifted by code.
EDITS = {
    'poison_a': [
        (54, 41, 'weewmwweew'),
        (55, 42, 'weeweeew'),
        (56, 43, 'weeeew'),
        (56, 44, 'weeeew'),
    ],
    'poison_b': [
        (55, 43, 'weewmwweew'),
        (56, 44, 'weeweeew'),
        (57, 45, 'weeeew'),
        (57, 46, 'weeeew'),
    ],
    'stun_a': [
        (55, 44, 'weeewmwwweew'),
        (56, 45, 'weeewwweew'),
        (57, 46, 'weeeweew'),
        (58, 47, 'weeeeew'),
        (58, 48, 'weeeeew'),
    ],
    'stun_b': [
        (56, 45, 'weeewmwwweew'),
        (57, 46, 'weeewwweew'),
        (58, 47, 'weeeweew'),
        (59, 48, 'weeeeew'),
        (59, 49, 'weeeeew'),
    ],
    'sleep_a': [
        (55, 47, 'wweewmweeewmw'),
        (55, 48, 'weeeewweeeeww'),
        (55, 49, 'wmmmeweemmmww'),
        (56, 50, 'weeeweeewww'),
        (57, 51, 'wweeeeewww'),
        (57, 52, 'wwewweewww'),
        (58, 53, 'wwweewww'),
        (58, 54, 'wwmwewww'),
        (58, 55, 'wwmwewww'),
        (59, 56, 'weeew'),
        (59, 57, 'wweww'),
    ],
    'sleep_b': [
        (55, 47, 'wweewmweeewmw'),
        (55, 48, 'weeeewweeeeww'),
        (55, 49, 'wmmmeweemmmww'),
        (56, 50, 'weeeweeewww'),
        (57, 51, 'wweeeeewww'),
        (57, 52, 'wwewweewww'),
        (58, 53, 'wwweewww'),
        (58, 54, 'wwmwewww'),
        (58, 55, 'wwmwewww'),
        (59, 56, 'weeew'),
        (59, 57, 'wweww'),
    ],
}

for name, patches in EDITS.items():
    path = ROOT / 'actions' / (name + '.pxgrid')
    rows = path.read_text().splitlines()
    for x, y, pixels in patches:
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    path.write_text('\n'.join(rows) + '\n', encoding='ascii')
print('Saved explicit carving fragments in six full literal action grids.')

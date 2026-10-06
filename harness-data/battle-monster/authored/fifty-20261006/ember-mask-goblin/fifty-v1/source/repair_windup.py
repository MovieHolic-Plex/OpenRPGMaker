"""Native, individually chosen row runs for the backward fist correction.

Dots in RESTORE erase the old forward guard. INK places only explicitly
written clusters. No shape drawing, frame transforms or inferred hole fill.
Original full grids are archived before changing this single pose.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
archive = ROOT / 'history' / 'before-backward-windup'
if not archive.exists():
    archive.mkdir()
    for folder in ['poses', 'actions']:
        shutil.copytree(ROOT / folder, archive / folder)
    for filename in ['palette.json', 'AUTHORING.md', 'TIMING.md']:
        shutil.copy2(ROOT / filename, archive / filename)

path = ROOT / 'poses' / 'windup.pxgrid'
rows = [list(row) for row in (archive / 'poses' / 'windup.pxgrid').read_text().splitlines()]

# Restore the vest's right edge where the former forward arm covered it.
# Remove the separate front fist, forearm and elbow using literal dot runs.
RESTORE = [
    (69, 44, '.............'),
    (69, 45, '.............'),
    (69, 46, '.............'),
    (69, 47, '.............'),
    (54, 48, 'uvvvvo......................'),
    (54, 49, 'uvvvvo......................'),
    (54, 50, 'uvvvvo......................'),
    (54, 51, 'uvvvvo......................'),
    (54, 52, 'uvvvvo......................'),
    (54, 53, 'uvvvvo......................'),
    (54, 54, 'uvvvvo......................'),
    (54, 55, 'uvvvvo......................'),
    (54, 56, 'uvvvvo......................'),
    (54, 57, 'uvvvvo......................'),
    (54, 58, 'uvvvvo......................'),
    (54, 59, 'uvvvvo......................'),
    (54, 60, 'uvvvvo......................'),
    (54, 61, 'uvvvvo......................'),
]
# Near shoulder goes across the vest into a broad upper arm. The elbow
# turns at x34..43,y55..60; the forearm rises back to a rear fist.
# No hand is pasted from another pose. Skin planes are directly written.
INK = [
    (51, 46, 'orrttssro'),
    (49, 47, 'orrttttssro'),
    (47, 48, 'orrttttttssro'),
    (45, 49, 'orrtttttttssro'),
    (43, 50, 'orrtttttttssro'),
    (41, 51, 'orrtttttttssro'),
    (39, 52, 'orrtttttttssro'),
    (37, 53, 'orrtttttttssro'),
    (35, 54, 'orrtttttttssro'),
    (20, 46, 'ooooooo'),
    (18, 47, 'oorttssroo'),
    (17, 48, 'orttffttssro'),
    (16, 49, 'orttfffftssro'),
    (16, 50, 'ortttffttssro'),
    (17, 51, 'orrtttttsssro'),
    (18, 52, 'orrttttttssro'),
    (20, 53, 'orrttttttssro'),
    (22, 54, 'orrttttttssro'),
    (24, 55, 'orrttttttttttttttttssro'),
    (26, 56, 'orrtttttttttttttssro'),
    (28, 57, 'orrtttttttttssro'),
    (30, 58, 'orrttttttssro'),
    (32, 59, 'orrttttssro'),
    (34, 60, 'orrsssro'),
    (35, 61, 'oooooo'),
]
for x, y, text in RESTORE + INK:
    rows[y][x:x + len(text)] = list(text)
path.write_text('\n'.join(''.join(row) for row in rows) + '\n')
print('Wrote explicitly authored windup clusters only.')

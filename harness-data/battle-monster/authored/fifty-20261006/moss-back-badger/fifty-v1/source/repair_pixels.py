"""Bounded native-cluster repair. Every changed pixel is chosen below.
Reads preserved source rows; no geometry, transforms or automatic fill.
"""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent
BACKUP = ROOT / 'original-draft'
if not BACKUP.exists():
    BACKUP.mkdir()
    for folder in ('poses', 'actions'):
        shutil.copytree(ROOT / folder, BACKUP / folder)
    shutil.copy2(ROOT / 'palette.json', BACKUP / 'palette.json')

def repair(folder, name, edits):
    rows = [list(r) for r in (BACKUP / folder / (name + '.pxgrid')).read_text().splitlines()]
    for x, y, pixels in edits:
        rows[y][x:x + len(pixels)] = list(pixels)
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(r) for r in rows) + '\n')

# Each named idle receives the same chosen anatomy correction. Its other
# breathing, eyelid, moss and flank pixels remain its own original rows.
IDLE_FORELEG = [
    (41,46,'SBSO'),
    (41,47,'SBBBSO'),
    (41,48,'DBLBBSO'),
    (41,49,'DSBLBBSO'),
    (43,50,'DSBBBSO'),
    (42,51,'O.DSBBBSO'),
    (42,52,'O..DSBBSO'),
    (42,53,'O..DSBBSO'),
    (42,54,'O..DSBBBSO'),
    (42,55,'O...DSBBBSO'),
    (43,56,'O..DSBBBBCO'),
    (44,57,'O.DSCcCcCO'),
    (45,58,'..OOOOOOO'),
]
repair('poses','idle_a',IDLE_FORELEG)
repair('poses','idle_b',IDLE_FORELEG)
repair('poses','idle_c',IDLE_FORELEG)

# Entire explicitly chosen short row segments replace the long shoe wedge.
# Left segment: planted far support. Right: compressed wrist and broad
# knuckles, round paw front and three staggered cream claws. Dots specify
# the intentional separation between those forefeet.
repair('poses','attack',[
    (24,52,'DBBBSSSSSSDDDBBSSO...........'),
    (24,53,'ODBBBSSSSDDDBBSSO............'),
    (24,54,'ODBBBSSSO.DBBSSO.............'),
    (24,55,'ODBBSSSO..DBBLLBBSSSO........'),
    (24,56,'ODBBSSSO..OBBLLLLBBBScCO.....'),
    (24,57,'ODSSSSSO..OBBLLLBBBBBScCO....'),
    (24,58,'OCcCcSSO..OSBBBBBBBBSCcCO....'),
    (24,59,'.OOOOOOO..OSSSBCcCcCcCO......'),
    (24,60,'.OOOOOOO...OOOOOOOOOOO.......'),
])

# Cream brow/cheek surround a short brown closed lid. Black nose pixels
# at the muzzle tip are left untouched. Each face is edited in its own
# existing breathing pose, with no whole-head or body translation.
repair('actions','sleep_a',[
    (41,47,'CccSS'),
    (40,48,'CcSDccS'),
    (40,49,'CccccSS'),
])
repair('actions','sleep_b',[
    (42,46,'CccSS'),
    (41,47,'CcSDccS'),
    (41,48,'CccccSS'),
])
print('Saved six repaired literal grids; preserved the original 18 grids and palette.')

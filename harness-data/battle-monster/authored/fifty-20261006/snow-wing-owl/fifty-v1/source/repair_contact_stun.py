"""Explicit native row replacements for the current three reviewer findings.

Only literal runs below choose pixels. Blank row initialization, lossless
serialization, backups and rendering are helpers; no shape or pose synthesis.
"""
from pathlib import Path
import shutil
import json

ROOT = Path(__file__).resolve().parent
# (y, x, final ASCII run); rows outside this table remain byte-identical.
ROWS = {
    'attack': [
        (53, 38, 'OKTIITKKO...OKTIITKO'),
        (54, 39, 'OKTIITKIKO..OKTIITKIKO'),
        (55, 40, 'OIKO.OIKO...OIKO.OIKO'),
        (56, 39, 'OKKO.OKKO...OKKO.OKKO'),
    ],
    'stun_a': [
        (40, 18, 'OCWWWWWWWWCDOCCWCCSSSSO'),
        (41, 17, 'OCWHHHWWWWWCCCCWWWCCSSSSO'),
        (42, 15, 'OOCWHHHWWWWWWCCWWWWWCCSSSSO'),
        (43, 14, 'OCWHHHWWWCWWWCCWWWWWWCCSSSSO'),
        (44, 13, 'OCWHHHWWCCSWWWWWHWWWWCCDSSSSSO'),
        (45, 12, 'OCWHHWWCCSDWWWHHHWWWWCCSDSSSSSO'),
        (46, 11, 'OCWHWWCCSSDWWWHHHHWWWWCCSDSSSSSO'),
        (47, 11, 'OCWHWWCCSSDWWWWWHHWWWWCCSDSSSSSO'),
        (48, 11, 'OCWWWWCCSSDWWWWWWWWWWWCCSDSSSSSO'),
        (49, 12, 'OCWWWCCSSSDWWWWWWWWWWCCSDSSSSO'),
        (50, 13, 'OCWWCCSSSSDWWWWWWWWWCCSDSSSO'),
        (51, 14, 'OCWCCSSSSDCWWWWWWWWCCSDSSO'),
        (52, 15, 'OCCSSSSDDCWWWWWWWCCSSDOO'),
        (53, 17, 'ODSSSSDCCCWWWWCCCSSOO'),
        (54, 19, 'ODDSSCCCCCCCCCSSSOO'),
        (55, 21, 'OCSSSSOOOOCSSSSSO'),
        (56, 22, 'OCSSSO...OCSSSO'),
        (57, 23, 'OKTTO.....OKTTO'),
        (58, 21, 'OKTIITTO...OKTIITO'),
    ],
    'stun_b': [
        (40, 19, 'OCWWWWWWWWCDBBOCWCCSSSO'),
        (41, 17, 'OOCWWWWWWWCDOCCWCCSSSSO'),
        (42, 15, 'OOCWHHHWWWWCCCCWWCCSSSSO'),
        (43, 14, 'OCWHHHWWWWWWCCWWWWCCSSSSO'),
        (44, 12, 'OOCWHHHWWWCWWWWWWWWCCDSSSSO'),
        (45, 11, 'OCWHHHWWCCSWWWHWWWWWCCSDSSSSO'),
        (46, 10, 'OCWHHWWCCSDWWHHHWWWWCCSDSSSSO'),
        (47, 10, 'OCWHWWCCSSDWWWHHHWWWCCSDSSSSO'),
        (48, 10, 'OCWWWCCSSSDWWWWWHWWWCCSDSSSSO'),
        (49, 11, 'OCWWCCSSSSDWWWWWWWWWCCSDSSSO'),
        (50, 12, 'OCWCCSSSSDCWWWWWWWWCCSDSSO'),
        (51, 13, 'OCCSSSSSDCWWWWWWWWCCSDSO'),
        (52, 14, 'OCSSSSDDCCCWWWWWWCCSDOO'),
        (53, 16, 'ODSSSDCCCCWWWWWCCSSOO'),
        (54, 18, 'ODSSCCCCCCCCCCSSSOO'),
        (55, 20, 'OCSSSSSOOOCSSSSSO'),
        (56, 21, 'OCSSSSO..OCSSSSO'),
        (57, 22, 'OCSTTO...OKTTO'),
        (58, 22, 'OKTIITO..OKTIITO'),
        (59, 20, 'OKTIIOKITOOKTIITTO'),
        (60, 21, 'OIIO..OIO..OIIO.OIO'),
    ],
}

def apply():
    backup = ROOT / 'before-contact-stun-repair'
    backup.mkdir(exist_ok=True)
    # Preserve the entire current candidate before this bounded repair.
    for folder in ['poses', 'actions']:
        (backup / folder).mkdir(exist_ok=True)
        for path in (ROOT / folder).glob('*.pxgrid'):
            target = backup / folder / path.name
            if not target.exists():
                shutil.copyfile(path, target)
    for filename in ['authored-rows.txt', 'AUTHORING.md', 'TIMING.md']:
        target = backup / filename
        if not target.exists():
            shutil.copyfile(ROOT / filename, target)
    log = []
    for name, patches in ROWS.items():
        folder = 'poses' if name == 'attack' else 'actions'
        path = ROOT / folder / (name + '.pxgrid')
        rows = path.read_text().splitlines()
        log.append('[' + name + ']')
        for y, x, run in patches:
            # Explicit row reauthoring; old trailing toes/wing are erased.
            if x < 1 or x + len(run) > 63:
                raise ValueError((name, y, x, len(run)))
            rows[y] = '.' * x + run + '.' * (64 - x - len(run))
            log.append(f'{y} {x} {run}')
        path.write_text('\n'.join(rows) + '\n')
    (ROOT / 'contact-stun-rows.txt').write_text('\n'.join(log) + '\n')

    # Serialization of existing literal pixels, not generation of poses.
    from render import POSES, ACTIONS
    output = ['# Current literal native rows, serialized from the full pxgrids.']
    for name in POSES + ACTIONS:
        folder = 'poses' if name in POSES else 'actions'
        rows = (ROOT / folder / (name + '.pxgrid')).read_text().splitlines()
        output.append('[' + name + ']')
        for y, row in enumerate(rows):
            if row.strip('.'):
                x = len(row) - len(row.lstrip('.'))
                output.append(f'{y} {x} {row[x:].rstrip(".")}')
    (ROOT / 'authored-rows.txt').write_text('\n'.join(output) + '\n')

if __name__ == '__main__':
    apply()

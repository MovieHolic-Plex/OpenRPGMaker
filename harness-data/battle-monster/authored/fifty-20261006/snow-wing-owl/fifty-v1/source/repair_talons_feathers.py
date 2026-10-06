"""Hand-selected ASCII row runs. Helpers only serialize and render pixels."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
# Each entry replaces x..62 of one native row; the body to its left stays intact.
# No shape masks, generated shading, whole-frame transforms or hole filling.
ROWS = {
    'attack': [
        (52, 37, '.OKTTTSSSO...OKTTTTO......'),
        (53, 37, '..OKTIITTKKO..OKTIITTKKKO.'),
        (54, 37, '...OKTIITIIKO..OKTIITIIIKO'),
        (55, 37, '....OKTK..IKO...OKTTK..IKO'),
        (56, 37, '.....OKO..IKO....OKKO..IKO'),
        (57, 37, '......OKIIKO......OKIIIKO.'),
        (58, 37, '......OIKKO.......OKKKO...'),
    ],
    'skill_b': [
        (10, 60, 'AL'),
        (11, 59, 'ALL'),
        (12, 57, 'AFFLLA'),
        (13, 56, 'AFLLFA'),
        (14, 55, 'AFLLA.LA'),
        (15, 53, 'AFFLLFFLA'),
        (16, 53, 'AFLLFAA'),
        (17, 51, 'AFFLLF.FA'),
        (18, 51, 'AFLLFFLLA'),
        (19, 50, 'AFLLFFAA'),
        (20, 49, 'AFLLFA.FA'),
        (21, 48, 'AFLLFFFLLA'),
        (22, 48, 'ALLFFFAA'),
        (23, 47, 'AFLFFAA'),
        (24, 46, 'OCWLFFAAO'),
        (25, 46, 'OCWWLFAAO'),
        (26, 46, 'WWAFLAO'),
        (27, 46, 'WWWALAO'),
        (28, 46, 'WWWAFO'),
        (29, 46, 'WWWWCO.........LA'),
        (30, 46, 'WWWCO.....AFLLFA.'),
        (31, 46, 'WWCCAF.FFLFFLFFLA'),
        (32, 46, 'WCCAFLLLLLLLLLFA.'),
        (33, 46, 'WWCCAFFFFLFFLFA..'),
        (34, 46, 'WCCAFA.FA.FLA....'),
        (35, 46, 'WCCCWWCAFO'),
        (36, 46, 'WCCOCWCALA'),
        (37, 46, 'WWCCSOCALFFFA'),
        (38, 46, 'WWCCSSOAFLFLA.LA.'),
        (39, 46, 'CCSSSSOAFLLFFLLFA'),
        (40, 46, 'CSSSSSO.AFLLFFAA.'),
        (41, 46, 'CCSSSSO..AFLLFLFA'),
        (42, 46, 'CCSSSSO....AFLLFA'),
        (43, 46, 'CCSSSSO.......ALA'),
    ],
}

def apply():
    backup = ROOT / 'before-talons-feathers-repair'
    backup.mkdir(exist_ok=True)
    for folder in ['poses', 'actions']:
        (backup / folder).mkdir(exist_ok=True)
        for path in (ROOT / folder).glob('*.pxgrid'):
            target = backup / folder / path.name
            if not target.exists():
                shutil.copyfile(path, target)
    for name in ['palette.json', 'authored-rows.txt', 'AUTHORING.md', 'TIMING.md']:
        target = backup / name
        if not target.exists():
            shutil.copyfile(ROOT / name, target)
    log = ['# Directly chosen native y/x/ASCII replacement runs.']
    for name, patches in ROWS.items():
        folder = 'poses' if name == 'attack' else 'actions'
        path = ROOT / folder / (name + '.pxgrid')
        rows = path.read_text().splitlines()
        log.append('[' + name + ']')
        for y, x, run in patches:
            if x < 1 or x + len(run) > 63:
                raise ValueError((name, y, x, len(run)))
            rows[y] = rows[y][:x] + run + '.' * (64-x-len(run))
            log.append(f'{y} {x} {run}')
        path.write_text('\n'.join(rows)+'\n')
    (ROOT / 'talons-feathers-rows.txt').write_text('\n'.join(log)+'\n')
    # Lossless recording of all existing final rows, never synthesis of a pose.
    from render import POSES, ACTIONS
    output = ['# Full current literal pixels serialized from the native grids.']
    for name in POSES + ACTIONS:
        folder = 'poses' if name in POSES else 'actions'
        rows = (ROOT / folder / (name+'.pxgrid')).read_text().splitlines()
        output.append('['+name+']')
        for y, row in enumerate(rows):
            if row.strip('.'):
                x = len(row)-len(row.lstrip('.'))
                output.append(f'{y} {x} {row[x:].rstrip(".")}')
    (ROOT / 'authored-rows.txt').write_text('\n'.join(output)+'\n')

if __name__ == '__main__':
    apply()

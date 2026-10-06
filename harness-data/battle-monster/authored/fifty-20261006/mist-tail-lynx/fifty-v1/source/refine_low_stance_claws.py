"""Local refinements chosen after opening the rendered native/enlarged sheet."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Align the two nose/cheek boundary rows. Keep the far eye and nose room.
RUNS = {
    'idle_a': [(37,32,'BLLLBBBBCCCLCCCCCCCNNNO..')],
    'idle_b': [(37,32,'BLLLLBBBCCCLCCCCCCCNNNO..')],
    'idle_c': [(37,32,'BLLLBBBBCCCLCCCCCCCNNNO..')],
    # The middle claw was still almost a straight slash. Give it a wider
    # outer bow and an inward tip, leaving the upper branch open above it.
    'skill_b': [
        (38,53,'..IIWI....'),
        (39,53,'.IWI..I...'),
        (40,49,'O...IWI...WI..'),
        (41,49,'..IWI......IWI'),
        (42,48,'IIVWI.......VWI'),
        (43,48,'IVWI.......IWI.'),
        (44,48,'IWI......IVWI..'),
        (45,48,'VIIVIWWWWI.....'),
    ],
}


def main():
    log = ['', '# After visual inspection: muzzle alignment and a bowed middle claw.']
    for name, runs in RUNS.items():
        path = ROOT/('actions' if name=='skill_b' else 'poses')/f'{name}.pxgrid'
        rows = path.read_text().splitlines()
        log.append('@ '+name)
        for y,x,pixels in runs:
            rows[y] = rows[y][:x]+pixels+rows[y][x+len(pixels):]
            log.append(f'{y} {x} {pixels}')
        path.write_text('\n'.join(rows)+'\n')
    with (ROOT/'author_corrections.txt').open('a') as out:
        out.write('\n'.join(log)+'\n')


if __name__=='__main__':
    main()

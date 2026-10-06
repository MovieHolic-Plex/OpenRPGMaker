"""Explicit native clusters for the two observed hand/ground defects.

This record writes only the two literal grids. No frame transforms, shape masks,
automatic filling, color synthesis or propagation to other poses.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# One anatomical palm remains at x59..63. The short diagonal wood neck
# joins that grip to the existing blossom core at x64..65, y43..44.
SKILL_RUNS = [
    (64, 45, 'BGpFFFp'),
    (64, 46, 'B.pFFFp'),
    (64, 47, 'O..pFFp'),
    (63, 48, 'OO.'),
]

# x15, y83..92: hanging hair edge; bent sleeve and resting forearm;
# compressed skirt folds; separate folded ankles and flat shoes.
# Each row is chosen independently. Upper head/neck/shoulder rows stay intact.
DEAD_ROWS = """
....OHHHHO..CWWWcCCccCCrrrrrrrrrrRRRRRRRRRRRRRRRRRRrrRO
.....OHHHO..CWWccCCCccCCrrrrrrrrrRRRRRRRRRRRRRRRRRRrrRO
.....OHHHHO.CWcccCCCCcccCRrrrrrrrrRRRRRRRRRRRRRRRRRrrRO
......OHHHO.CWccCCCCCcccCCrrrrrrrrrRRRRRRRRRRRRRRRrrRO
.......OHHO.CccCCCCCCcccCCAabrrrrrrrrRRRRRRRRRRRrrrrRO
........OO..OCccccCCCCccCAabbaORrrrrrrrRRRRRRRRrrrRRO
.............OCcccCCCCCCCAAaaAORrrrrrrrrRRRRRRRrrROCCCcCO
..............OCCCCCCCCCOAAAOORRRRRRRRRRRRRRRRRROHhhhHHHO
...............OCCCCCCCOOOOO..ORRRRRRRRRRRRRRROHhhHOHhhHHO
................OOOOOOO........OOOOOOOOOOOOOOOOOOOOOOOOOO
""".strip('\n').splitlines()


def apply_hand_ground_repair(frames):
    skill = frames['skill_b']
    for x, y, run in SKILL_RUNS:
        skill[y][x:x + len(run)] = list(run)
    dead = frames['dead']
    for y, row in enumerate(DEAD_ROWS, 83):
        dead[y] = list('.' * 15 + row + '.' * (81 - len(row)))


if __name__ == '__main__':
    paths = {'skill_b': ROOT / 'actions/skill_b.pxgrid',
             'dead': ROOT / 'poses/dead.pxgrid'}
    frames = {name: [list(row) for row in path.read_text().splitlines()]
              for name, path in paths.items()}
    apply_hand_ground_repair(frames)
    for name, path in paths.items():
        path.write_text('\n'.join(''.join(row) for row in frames[name]) + '\n')

"""Selected literal runs for the upper-nock and crimson-arrow correction.

Coordinates are native, zero based. No pose transforms or generated clusters.
Run after author_rows.py, or against the existing full literal grids.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

RUNS = {
    'poses/idle_a': [(25, 50, 'G'), (26, 49, 'G')],
    'poses/idle_b': [(25, 50, 'G'), (26, 49, 'G')],
    'poses/idle_c': [(25, 50, 'G'), (26, 49, 'G')],
    'poses/windup': [(18, 50, 'G'), (19, 49, 'G'), (20, 49, 'G')],
    'poses/move': [(18, 51, 'G'), (19, 50, 'G'), (20, 50, 'G')],
    'poses/attack': [(17, 51, 'G'), (18, 50, 'G')],
    'poses/recover': [(26, 51, 'G'), (27, 50, 'G')],
    'poses/hit': [(28, 47, 'G'), (29, 46, 'G')],
    'actions/skill_a': [(18, 50, 'G'), (19, 49, 'G'), (20, 49, 'G')],
    'actions/skill_c': [(27, 51, 'G'), (28, 50, 'G')],
    'actions/poison_a': [(33, 43, 'G'), (34, 43, 'G')],
    'actions/poison_b': [(35, 44, 'G'), (36, 44, 'G')],
    'actions/stun_a': [(35, 46, 'G'), (36, 45, 'G')],
    'actions/stun_b': [(36, 47, 'G'), (37, 46, 'G')],
    'actions/sleep_a': [(35, 48, 'G'), (36, 48, 'G')],
    'actions/sleep_b': [(36, 48, 'G'), (37, 48, 'G')],
    # A separately drawn, shorter bow arm and recurved bow give the shaft room.
    # Each right-side row explicitly removes the former flare and weapon.
    'actions/skill_b': [
        (16, 42, '..XRX................'),
        (17, 42, '..GXhrX..............'),
        (18, 42, '.G..XhrX.............'),
        (19, 42, 'G....XhrX............'),
        (20, 42, 'G.....XrX............'),
        (21, 42, 'G.....XrX............'),
        (22, 42, 'G.....XrX............'),
        (23, 42, 'G.....XrX............'),
        (24, 42, 'G.....XrX............'),
        (25, 42, 'G.....XrX............'),
        (26, 42, 'G....XhrX............'),
        (27, 42, 'G....XhrX............'),
        (28, 42, 'G...XhrX......Rr.....'),
        (29, 42, 'G.XhrX.........Rhv...'),
        (30, 38, 'TuuutTGXhrXrrrrrrrrRvevh.'),
        (31, 38, 'Tuutlffhvhhhhhhhhhvveeevh'),
        (32, 38, 'XTttssXGRXrrrrrrrrrRvhv..'),
        (33, 38, '.XTTXXGRX..........Rhr...'),
        (34, 42, 'G...XrX........Rr....'),
        (35, 42, 'G....XrX.............'),
        (36, 42, 'G.....XrX............'),
        (37, 42, 'G.....XrX............'),
        (38, 42, 'G......XrX...........'),
        (39, 42, 'G......XrX...........'),
        (40, 42, 'G.....XrX............'),
        (41, 42, 'G....XrX.............'),
        (42, 42, 'G...XrX..............'),
        (43, 42, 'G..XrX...............'),
        (44, 42, 'G.XrX................'),
        (45, 42, 'GXrX.................'),
        (46, 42, 'XRX..................'),
    ],
}


def apply():
    for name, runs in RUNS.items():
        path = ROOT / (name + '.pxgrid')
        rows = [list(row) for row in path.read_text().splitlines()]
        for y, x, ink in runs:
            if x + len(ink) > 63:
                raise ValueError((name, y, x, ink))
            rows[y][x:x + len(ink)] = list(ink)
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


if __name__ == '__main__':
    apply()

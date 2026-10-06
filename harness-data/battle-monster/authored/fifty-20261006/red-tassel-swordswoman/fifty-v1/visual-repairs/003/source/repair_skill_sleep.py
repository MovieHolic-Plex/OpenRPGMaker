"""Explicit native strings for the two requested repairs; no geometry synthesis.

Coordinates are zero based. Final pxgrid files always contain full 64x64 rows.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Retracted grip, folded sleeve, long horizontal steel, and new tip junction.
# Each tuple is (y, x, literal final pixels); dots explicitly erase old clusters.
SKILL_B = [
    (26, 53, '.rEL..'),
    (27, 53, '..rEL.'),
    (28, 31, 'GgG......................rEL.'),
    (29, 31, 'DGWMMMMMMMMMMMMMMMMMMMMMWEEL.'),
    (30, 25, 'KLrrWGFFgmmmmmmmmmmmmmmmmmmmmm..rEEL'),
    (31, 24, 'KLLrrrWSSsGLK.....................rEEL'),
    (32, 23, 'KLLrrrrrGrrgLLK.....................rEL.'),
    (33, 23, 'KLrrrrrGrrrLgLLK....................rEL.'),
    (34, 23, 'KLrRRrrGrrrrLLrrK..................rEEL.'),
    (35, 24, 'KrRRKrGrrrrRrrrRK'),
    (36, 24, 'KrRRKrrGrrrRKKKK'),
]


def apply_requested_repairs():
    skill = ROOT / 'actions' / 'skill_b.pxgrid'
    rows = skill.read_text().splitlines()
    for y, x, pixels in SKILL_B:
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    skill.write_text('\n'.join(rows) + '\n')
    sleep = ROOT / 'actions' / 'sleep_b.pxgrid'
    rows = sleep.read_text().splitlines()
    rows[44] = rows[44][:29] + 'K' + rows[44][30:]
    sleep.write_text('\n'.join(rows) + '\n')


if __name__ == '__main__':
    apply_requested_repairs()

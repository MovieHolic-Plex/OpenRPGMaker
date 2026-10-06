"""Explicit, individually selected native color clusters. No geometry generation.

Coordinates are (y, x, literal ASCII run). All runs replace opaque pixels;
silhouette, grip, contact line and intentional spaces remain as authored.
The final pxgrids contain all 96 literal rows, independently of this helper.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCHES = {
    'poses/idle_a.pxgrid': [
        (73, 69, 'h'), (74, 69, 'h'), (75, 68, 'h'), (76, 68, 'h'),
        (78, 68, 'h'), (79, 68, 'h'), (80, 68, 'n'),
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'poses/idle_b.pxgrid': [
        (73, 69, 'h'), (74, 69, 'h'), (75, 68, 'h'), (76, 68, 'h'),
        (78, 68, 'h'), (79, 68, 'h'), (80, 68, 'n'),
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'poses/idle_c.pxgrid': [
        (73, 69, 'h'), (74, 69, 'h'), (75, 68, 'h'), (76, 68, 'h'),
        (78, 68, 'h'), (79, 68, 'h'), (80, 68, 'n'),
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'poses/windup.pxgrid': [
        (87, 28, 'hhhh'), (88, 27, 'nhhhn'), (90, 28, 'nnn'),
        (88, 45, 'hhhh'), (89, 45, 'nhhhnn'), (91, 47, 'nnnn'),
    ],
    'poses/move.pxgrid': [
        (86, 27, 'hhh'), (87, 25, 'nhhhnn'),
        (87, 57, 'hhh'), (88, 57, 'hhhh'), (89, 57, 'nhhhnn'),
    ],
    'poses/attack.pxgrid': [
        (69, 90, 'h'), (70, 90, 'h'), (72, 90, 'h'),
        (73, 90, 'h'), (74, 90, 'h'), (76, 90, 'h'), (77, 90, 'n'),
        (86, 26, 'hhh'), (87, 25, 'hh'), (88, 24, 'nhhn'),
        (89, 24, 'nnn'),
        (87, 58, 'hhhh'), (88, 57, 'hhhh'), (89, 57, 'nhhhnn'),
        (91, 58, 'nnnn'),
    ],
    'poses/recover.pxgrid': [
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'poses/hit.pxgrid': [
        (73, 78, 'h'), (74, 78, 'h'), (75, 79, 'h'), (76, 79, 'h'),
        (78, 79, 'h'), (79, 79, 'h'), (80, 79, 'n'), (81, 78, 'n'),
        (87, 28, 'hhhh'), (88, 27, 'nhhhnn'), (90, 29, 'nnn'),
        (87, 42, 'hhhh'), (88, 42, 'nhhhnn'), (90, 43, 'nnnn'),
    ],
    'actions/skill_a.pxgrid': [
        (18, 86, 'h'), (19, 86, 'hn'),
        (22, 82, 'h'), (23, 82, 'h'), (24, 82, 'h'),
        (26, 82, 'h'), (27, 81, 'h'), (29, 82, 'h'),
        (32, 82, 'h'), (33, 81, 'h'), (35, 80, 'n'),
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'actions/skill_b.pxgrid': [
        (40, 86, 'h'), (41, 85, 'h'), (43, 84, 'h'),
        (44, 83, 'h'), (46, 83, 'h'), (47, 82, 'h'),
        (49, 81, 'h'), (50, 80, 'h'), (51, 80, 'h'),
        (53, 81, 'h'), (54, 82, 'h'), (55, 83, 'h'),
        (57, 85, 'h'),
        (86, 27, 'hhh'), (87, 25, 'nhhhnn'),
        (87, 57, 'hhh'), (88, 57, 'hhhh'), (89, 57, 'nhhhnn'),
    ],
    'actions/skill_c.pxgrid': [
        (15, 76, 'h'), (16, 77, 'h'), (20, 81, 'h'), (21, 82, 'h'),
        (36, 80, 'h'), (37, 80, 'h'), (45, 85, 'h'), (46, 85, 'n'),
        (30, 70, 'h'), (31, 69, 'h'), (33, 68, 'h'),
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'actions/poison_a.pxgrid': [
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'actions/poison_b.pxgrid': [
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'actions/stun_a.pxgrid': [
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
    'actions/stun_b.pxgrid': [
        (87, 30, 'hhhh'), (88, 30, 'hhh'), (89, 28, 'nhhhn'),
        (87, 46, 'hhhh'), (88, 46, 'hhh'), (89, 44, 'nhhhnn'),
        (91, 29, 'nnn'), (91, 44, 'nnnn'),
    ],
}


def apply():
    for relative, patches in PATCHES.items():
        path = ROOT / relative
        rows = path.read_text().splitlines()
        for y, x, literal in patches:
            # A guard against accidental silhouette/alpha changes; no filling.
            assert '.' not in rows[y][x:x + len(literal)], (relative, y, x)
            rows[y] = rows[y][:x] + literal + rows[y][x + len(literal):]
        path.write_text('\n'.join(rows) + '\n')


if __name__ == '__main__':
    apply()

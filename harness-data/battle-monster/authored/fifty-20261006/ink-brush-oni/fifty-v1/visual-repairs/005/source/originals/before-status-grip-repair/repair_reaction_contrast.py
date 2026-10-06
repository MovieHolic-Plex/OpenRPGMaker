"""Hand-selected row/coordinate corrections for the current visual review.

Only literal strings are applied. No frame transforms, shape tools, filling,
reference pixel extraction, or shade generation. Full pxgrids remain the source.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# A compressed chest, bent raised elbow, and retracted hand. Each line is a
# newly selected native row of the coat; old pixels in these rows are removed.
HIT_COAT = [
    (43, 30, 'OOcbcsOvwwvOsddOO'),
    (44, 28, 'OOcbbaacsOvvOscccdddO'),
    (45, 25, 'OcbaaaaabbcsOscccccdddO'),
    (46, 23, 'OcbaaaaaaabbcscccccddddO'),
    (47, 22, 'OcbaaaaaabbbccsbbccccdddOO'),
    (48, 21, 'OcbaaaaabbbbccsbccccddOOcbbccddO'),
    (49, 21, 'OcbaaaabbbbcccscbbccddOcbbbbcccddO'),
    (50, 20, 'OcbaaaabbbccccscccccddOcbbbbbcccdddO'),
    (51, 20, 'OcbaaabbbbcccccscccdddOccbbbbcccddddO'),
    (52, 20, 'OcbaaabbbccccccsccddddOccbbbbcccddddO'),
    (53, 20, 'OcbaaabbcccccccsccdddddOccbbbcccddddO'),
    (54, 21, 'OcbaabbcccccccscdddddddOccbbcccddddO'),
    (55, 21, 'OcbaabbccccccscdddddddddOccccccddddO'),
    (56, 22, 'OcbbbcccccccscddddddddddOddccccdddO'),
    (57, 22, 'OcbbbccccccsccddddddddddOOddcccddO'),
    (58, 23, 'OcbbccccccccccddddddddOOcbbbcccddO'),
    (59, 23, 'OcccccccccccccddddddOOcbbbbccddO'),
    (60, 24, 'OccccccccccccddddddOcbbbcccddO'),
    (61, 24, 'OccccccccccccddddddOddccccddO'),
    (62, 24, 'OccccccccccccdddddddOdddddOO'),
    (63, 24, 'OcccccccccrrrrrrrrrrrddddOO'),
    (64, 24, 'OccccrrrrttttttrrrrrrdddO'),
    (65, 24, 'OcccrrrrrrrrcccccccddddO'),
    (66, 24, 'OcccbbccccccccccccddddO'),
    (67, 24, 'OcbbbbcccccbbccccccdddO'),
    (68, 24, 'OcbbbbcccccbbccccccdddO'),
    (69, 23, 'OcbbbbbcccccbcccccccdddO'),
    (70, 23, 'OcbbbbbcccccbccccccccdddO'),
    (71, 22, 'OcbbbbbbcccccbccccccccdddO'),
    (72, 22, 'OcbbbbbbcccccbbcccccccddddO'),
    (73, 21, 'OcbbbbbbbcccccbccccccccdddO'),
    (74, 21, 'OcbbbbbbbccccccbbccccccdddO'),
    (75, 20, 'OcbbbbbbbbccccccbbcccccccdddO'),
    (76, 20, 'OcbbbbbbbcccccccbccccccccddddO'),
    (77, 20, 'OccbbbbbccccccccbccccccccdddO'),
    (78, 21, 'OcccccccccccccccbcccccccddddO'),
    (79, 22, 'OddcccccccccccccdccccccdddddO'),
    (80, 23, 'OOdddddddddddOOOdddddddddddOO'),
]

HIT_TOOL = [
    # Broad upper arm and elbow on the far side of the wooden axis; the
    # folded forearm returns toward the wrist. These are cloth, not wood.
    (49, 51, 'bbcccddO'),
    (50, 52, 'bbbccddO'),
    (51, 53, 'bbbcccddO'),
    (52, 54, 'bbbcccddO'),
    (53, 55, 'bbccccddO'),
    (54, 55, 'bccccdddO'),
    (55, 54, 'cccccdddO'),
    (56, 52, 'OccccdddO'),
    (57, 50, 'OcbbbcccddO'),
    (58, 48, 'OcbbbbcccddO'),
    (59, 47, 'OcbbbcccddO'),
    (60, 47, 'OccccccddO'),
    (61, 47, 'OdddddOO'),
    (45, 43, 'OO'),
    (46, 43, 'OrtO'),
    (47, 44, 'OrtO'),
    (48, 45, 'OrtO'),
    (49, 46, 'OrtO'),
    (50, 47, 'OrtO'),
    (51, 48, 'OrtO'),
    (52, 49, 'OrtO'),
    (53, 50, 'OrtO'),
    (54, 51, 'OrtO'),
    (55, 52, 'OrtO'),
    (56, 53, 'OrtO'),
    (57, 54, 'OrtO'),
    (58, 55, 'OrtO'),
    (59, 56, 'OrtO'),
    (60, 57, 'OrtO'),
    (61, 58, 'OrtO'),
    (62, 59, 'OrtO'),
    (63, 60, 'OrtO'),
    (64, 61, 'OrtO'),
    (65, 62, 'OrtkO'),
    (65, 65, 'OknkOO'),
    (66, 65, 'OkhhnnkO'),
    (67, 65, 'OkvhhnnnkkO'),
    (68, 65, 'OkvhnnnnnkkO'),
    (69, 65, 'OkhhnnnnnnkkO'),
    (70, 66, 'OkhnnnnnnnkkO'),
    (71, 66, 'OknnnnnnnnkkO'),
    (72, 67, 'OknnnnnnnnkkO'),
    (73, 68, 'OknnnnnnnnkkO'),
    (74, 69, 'OknnnnnnnkkO'),
    (75, 70, 'OknnnnnnnkkO'),
    (76, 71, 'OknnnnnnkkO'),
    (77, 72, 'OknnnnnkkO'),
    (78, 73, 'OknnnnkkO'),
    (79, 74, 'OknnnkkO'),
    (80, 75, 'OkkkkkO'),
    (81, 76, 'OkkkO'),
    (82, 77, 'OO'),
    # Forearm/cuff and thumb in front of the single wooden axis.
    (57, 55, 'OssO'),
    (58, 54, 'OsflfsO'),
    (59, 54, 'OsfflfsO'),
    (60, 54, 'OssfssO'),
    (61, 55, 'OOsfsO'),
]

PATCHES = {
    'poses/windup.pxgrid': [
        # Brown rear shaft remains visible across the shoulder to the fist.
        (49, 21, '.OrtO'), (50, 22, 'OcOrtO'), (51, 24, 'bOrtO'),
        (52, 26, 'cOrtO'), (53, 27, 'cOrtO'), (54, 28, 'bbOrtO'),
        (55, 29, 'bcOrtO'), (56, 30, 'ccOrtO'),
        (57, 34, 'OrtO'),
        # Thumb and fingertips wrap the shaft, with wood showing below.
        (53, 34, 'OssO'), (54, 33, 'OsflfsO'),
        (55, 32, 'OsffllfsO'), (56, 32, 'OsffffssO'),
        (57, 32, 'OssffsOO'), (58, 33, 'OssrtO'),
        (59, 35, 'cOrtO'), (60, 36, 'cOO'),
        # Break the long light sleeve ridge into cloth faces.
        (49, 53, 'cc'), (50, 50, 'cc'), (51, 47, 'cc'),
        (52, 43, 'cc'),
        # Upper-left bristle surface, no light outline along the dark edge.
        (31, 8, 'vh'), (32, 7, 'vh'), (33, 7, 'hh'),
        (34, 8, 'hh'), (35, 9, 'h'), (36, 10, 'h'),
        (85, 28, 'vh'), (86, 28, 'h'),
        (85, 45, 'h'), (86, 44, 'vh'), (87, 44, 'h'),
    ],
    'poses/idle_a.pxgrid': [
        (63, 64, 'vh'), (64, 63, 'vh'), (65, 62, 'vh'),
        (66, 62, 'hh'), (67, 61, 'hh'), (68, 61, 'h'),
        (69, 61, 'h'), (70, 61, 'hh'), (71, 62, 'h'),
        (85, 31, 'vh'), (86, 30, 'hh'),
        (85, 45, 'vh'), (86, 44, 'vh'), (87, 43, 'hh'),
    ],
    'poses/idle_b.pxgrid': [
        (63, 64, 'vh'), (64, 63, 'vh'), (65, 62, 'vh'),
        (66, 62, 'hh'), (67, 61, 'hh'), (68, 61, 'h'),
        (69, 61, 'h'), (70, 61, 'hh'), (71, 62, 'h'),
        (85, 31, 'vh'), (86, 30, 'hh'),
        (85, 45, 'vh'), (86, 44, 'vh'), (87, 43, 'hh'),
    ],
    'poses/idle_c.pxgrid': [
        (63, 64, 'vh'), (64, 63, 'vh'), (65, 62, 'vh'),
        (66, 62, 'hh'), (67, 61, 'hh'), (68, 61, 'h'),
        (69, 61, 'h'), (70, 61, 'hh'), (71, 62, 'h'),
        (85, 31, 'vh'), (86, 30, 'hh'),
        (85, 45, 'vh'), (86, 44, 'vh'), (87, 43, 'hh'),
    ],
    'poses/move.pxgrid': [
        (35, 81, 'vh'), (36, 80, 'vh'), (37, 79, 'hh'),
        (38, 78, 'hh'), (39, 77, 'h'), (40, 76, 'h'),
        (85, 27, 'vh'), (84, 28, 'h'),
        (85, 55, 'vh'), (86, 55, 'h'),
    ],
    'poses/attack.pxgrid': [
        (60, 82, 'vh'), (61, 81, 'vh'), (62, 81, 'hh'),
        (63, 80, 'hh'), (64, 80, 'h'), (65, 80, 'h'),
        (85, 25, 'vh'), (86, 25, 'h'),
        (85, 58, 'vh'), (86, 57, 'h'),
    ],
    'poses/recover.pxgrid': [
        (63, 76, 'vh'), (64, 74, 'vh'), (65, 73, 'hh'),
        (66, 72, 'hh'), (67, 71, 'vh'), (68, 72, 'h'),
        (69, 72, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'poses/hit.pxgrid': [
        # Small closed/slanted lids rather than a calm open-eyed face.
        (33, 37, 'fsOffffOsf'), (34, 38, 'fOOffOO'),
        (85, 29, 'vh'), (86, 28, 'h'),
        (85, 44, 'vh'), (86, 43, 'h'),
    ],
    'poses/dead.pxgrid': [
        (87, 81, 'vh'), (88, 80, 'hh'), (89, 80, 'h'),
    ],
    'actions/skill_a.pxgrid': [
        (24, 78, 'v'), (25, 77, 'vh'), (26, 76, 'vh'),
        (27, 75, 'hh'), (28, 74, 'hh'), (29, 74, 'h'),
        (30, 74, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/skill_b.pxgrid': [
        # Solid brush: continuous small lit face at the wood/tool anchor.
        (50, 76, 'v'), (51, 74, 'vv'), (52, 74, 'vh'),
        (53, 75, 'h'), (54, 79, 'h'),
        (55, 82, 'h'), (56, 84, 'h'),
        # Separate upper, middle and lower liquid ink masses.
        (29, 86, 'v'), (30, 85, 'vv'), (31, 84, 'hvh'),
        (32, 85, 'h'),
        (43, 91, 'v'), (44, 90, 'v'), (45, 89, 'vh'),
        (46, 90, 'h'),
        (60, 87, 'vh'), (61, 85, 'vv'), (62, 86, 'vh'),
        (63, 87, 'h'),
        (85, 27, 'vh'), (84, 28, 'h'),
        (85, 55, 'vh'), (86, 55, 'h'),
    ],
    'actions/skill_c.pxgrid': [
        (24, 66, 'vh'), (25, 65, 'vh'), (26, 64, 'hh'),
        (27, 64, 'hh'), (28, 64, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/poison_a.pxgrid': [
        (70, 76, 'vh'), (71, 75, 'vh'), (72, 74, 'hh'),
        (73, 72, 'h'), (74, 71, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/poison_b.pxgrid': [
        (70, 76, 'vh'), (71, 75, 'vh'), (72, 74, 'hh'),
        (73, 72, 'h'), (74, 71, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/stun_a.pxgrid': [
        (83, 72, 'vhh'), (84, 72, 'vh'), (85, 73, 'hh'),
        (86, 74, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/stun_b.pxgrid': [
        (83, 72, 'vhh'), (84, 72, 'vh'), (85, 73, 'hh'),
        (86, 74, 'h'),
        (85, 31, 'vh'), (86, 30, 'h'),
        (85, 45, 'vh'), (86, 44, 'h'),
    ],
    'actions/sleep_a.pxgrid': [
        (84, 78, 'vh'), (85, 75, 'vh'), (86, 73, 'hh'),
        (87, 72, 'h'),
    ],
    'actions/sleep_b.pxgrid': [
        (84, 78, 'vh'), (85, 75, 'vh'), (86, 73, 'hh'),
        (87, 72, 'h'),
    ],
}


def apply():
    hit = ROOT / 'poses/hit.pxgrid'
    rows = [list(row) for row in hit.read_text().splitlines()]
    for y, x, literal in HIT_COAT:
        rows[y] = list('.' * 96)  # Blank row, then the authored literal coat.
        rows[y][x:x + len(literal)] = list(literal)
    for y, x, literal in HIT_TOOL:
        rows[y][x:x + len(literal)] = list(literal)
    hit.write_text('\n'.join(''.join(row) for row in rows) + '\n')
    for relative, edits in PATCHES.items():
        path = ROOT / relative
        rows = [list(row) for row in path.read_text().splitlines()]
        for y, x, literal in edits:
            rows[y][x:x + len(literal)] = list(literal)
        path.write_text('\n'.join(''.join(row) for row in rows) + '\n')


if __name__ == '__main__':
    apply()

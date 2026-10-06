"""Chosen native ASCII runs for the two requested repairs.

Runs are written at their stated coordinates. The remaining pixels to x126
are deliberately transparent where a row is marked clear_right. No geometry,
frame transform, shading formula, image sampling or automatic filling is used.
The prior complete candidate is retained in before-joint-flame-repair/.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'before-joint-flame-repair'

# Each line starts at x80. Feathered thigh, knee forward, shin folded back,
# ankle turning forward, and three hooked toes. The other leg is left intact.
ATTACK = '''
94 aovvvrrskoovrsk
95 ovvvrrskoaaovrsk
96 vvvrrskoaaggovrsk
97 govrrskoagggovrsk
98 aovrskoagggovrsk
99 ovrskvoagovrskkbccbk
100 vrskvoaovrskkbddccbk
101 rskvoovrskkbdddccbk
102 skvvvrskkbddcccbk
103 kkvvrsrkbbddccbk
104 kvrsk..kbddccbk
105 kk......kbddccbk.......................kkk
106 ........kbbddccbk...................kbddck
107 .........kbbddcccbk..............kbddddck
108 ..........kbbddccccccbbkk...kbddddcck
109 ............kbbdddddccccccbbkkbddddcck
110 ..............kbbddddddccccddddddccccck
111 ................kbbccccccdddddddddccccbbdddk
112 ..................kbbccddddccccddddddccck
113 ....................kbddcckbbbbcccccckkk
114 .....................kbddck...kbdddck
115 ......................kbck....kddck
116 .......................kk.....kbck
117 ...............................kk
'''

# The old forward neck is cleared only from its stated boundary to x126.
# The fixed wing runs left of these boundaries are retained at their coordinates.
CAST_CLEAR = '''
24 55
25 55
26 55
27 55
28 55
29 55
30 55
31 55
32 55
33 55
34 55
35 55
36 55
37 55
38 55
39 55
40 55
41 55
42 55
43 74
44 73
45 74
46 73
47 73
48 73
49 72
50 70
51 69
52 69
53 68
54 67
55 66
56 65
57 64
58 63
59 62
60 61
61 60
62 59
63 58
64 57
65 56
66 55
67 55
68 55
69 55
70 55
71 55
72 55
'''

# Independent retracted casting anatomy. The eye, both jaws, and bent neck
# are newly chosen runs, not a shifted copy of another pose.
CAST_BODY = '''
24 63 kk
25 62 kagk
26 62 kaagk
27 61 kroagk
28 60 krvoagk
29 59 krvvoagk
30 58 krvvoaagk...kk
31 58 krvooaaagkkagk
32 59 krvooaaaggaghk
33 60 kroooaaaggggk
34 61 kroooaaagggk
35 62 krooaagggggkk
36 63 kroaagghhhgggakk
37 64 kroaagghhhhggaaakk
38 65 kroaagghhgkkggggaaak
39 66 kroaagghgkeekgggggaaak
40 67 kroaagghgekehkgggghhggaak
41 68 kroaaggggeeekgggghhhgggaak
42 69 kroaaagggggggghhhhhhhhgggak
43 70 krvvoaaagggggggghhhhhhhgggk
44 70 krvvooaaaggggaksssrrragg
45 70 krvvoooaaaggaaksssrrragh
46 70 krvvooooaaaggaakssrrragh
47 69 krvvoooooaaagggagghhgggg
48 68 krvvooooooaaaagghhhhhgggak
49 67 krvvooooooaaaaagghhhgggaak
50 66 krvvooooooaaaaaaggggggaaak
51 65 krvvooooooaaaaaaggggggaak
52 64 krvvooooooaaaaaggggggaak
53 63 krvvooooooaaaaagggggaak
54 63 krvvoooooaaaaagggggaak
55 62 krvvoooooaaaaaggggaak
56 62 krvvooooaaaaaggggaak
57 61 krvvooooaaaaaggggaak
58 61 krvvoooaaaaaggggaak
59 60 krvvoooaaaaaggggaak
60 60 krvvooaaaaaggggaak
61 59 krvvooaaaaaggggaak
62 59 krvvoaaaaaggggaak
63 58 krvvoaaaaaggggaak
64 58 krvvoaaaaggggaak
65 57 krvvoaaaaggggaak
66 57 krvvoaaaggggaak
67 56 krvvoaaaggggaak
68 56 krvvoaaggggaak
69 55 krvvoaaggggaak
70 55 krvvoaggggaak
71 55 krvvoaggggaak
72 55 krvvoaggggaak
'''

# After inspecting the first PNG, restore the chest's rounded upper mass and
# shoulder under the newly bent neck. These are chosen volume runs, not a fill.
CAST_SHOULDER = '''
63 55 aovkrvvoaaaaaggggaaovrrsk
64 55 aavkrvvoaaaaggggaaovvrrsk
65 55 avkrvvoaaaaggggaaovvoagggvrsk
66 55 vvkrvvoaaaggggaaovvoagghhggvrsk
67 55 vkrvvoaaaggggaaovvoagghhhhggovrsk
68 55 vkrvvoaaggggaaovvvoagghhhhhgggovrsk
69 55 krvvoaaggggaaovvvvoagghhhhhggggaovrsk
70 55 krvvoaggggaaovvvvvoagghhhhggggaaovvrsk
71 55 krvvoaggggaaovvvvvoaagghhhggggaaovvvrsrk
72 55 krvvoaggggaaovvvvvoaagggggggaaovvvvrrsk
73 55 hggaaaggggaaovvvvvoaaggggggaagghggovvrsk
74 55 ghggaaggggaaovvvvvoaagggggoaagggovvrrsk
75 55 gghggaagggaaovvvvvoaaggaavoaagovvvrrsk
76 55 ggghggaagaaovvvvvoaaovvvvoaovvvvrrsk
'''

# Smooth the inspected shoulder/chest seam at y76/77 into a convex feather
# mass. The second feather opens below it; no horizontal deletion stripe.
CAST_CHEST = '''
65 74 oagggvrsk
66 74 oagghhggvrsk
67 74 oagghhhhggovrsk
68 74 oagghhhhhgggovrsk
69 74 oagghhhhhggggaovrsk
70 74 oagghhhhggggaaovvrsk
71 74 oaagghhhggggaaovvvrrsk
72 74 voaagggggggaaovvvvrrsk
73 74 vvoaagggggaaovvvvvrrsk
74 74 vvvoaagggaaovvvvvvrrsk
75 74 vvvvoaggaaovvvvvvvrrsk
76 74 vvvvoaggaovvvvvvvrrsk
77 74 vvvvoaagovvvvvvvvrrsk
78 74 vvvoaagggggaovvvvrrsk
79 74 vvoagghhggggaovvvrrsk
80 74 voagghhhgggaaovvvrrsk
81 74 oaagghhhgggaaovvrrsk
82 74 oaagghhgggaaovvvrrsk
83 74 voaagggggaaovvvvrrsk
84 74 vvoaagggaaovvvvvrrsk
85 74 vvvoaggaaovvvvvrrsk
86 74 vvvvoaaoovvvvvvrrsk
87 74 vvvvvoovvvvvvvvrrsk
'''

# Two broad red/gold tongues. Upper tip x122,y28; lower tip x124,y66.
# Shared hot mouth root at x91..96,y44..48. The widening transparent cleft
# on the right separates the two silhouettes without disconnecting the root.
CAST_FIRE = '''
28 122 r
29 120 rvo
30 117 rvvoag
31 114 rvvoagghg
32 112 rvvoagghhgao
33 110 rvvoaagghhhgaor
34 110 rvvoagghhhhgaovr
35 107 rvvvoagghhhhhhgaovr
36 104 rvvvoagghhhhhhhggaovr
37 102 rvvvoaagghhhhhhhhggovr
38 100 rvvoaagghhfffhhhhggaor
39 98 rvvoaagghhffffhhhggaaor
40 97 rvoaagghhffffhhgggaaor
41 96 voaagghhffffhhgggaaor
42 95 oaagghhffffhhgggaaor
43 94 agghhffffhhgggaaor
44 91 agghffffhhgggaaor
45 90 gghffffhhgggaor
46 90 ghffffhhggaaor
47 90 ghffffhhggaaor
48 91 ghffffhhgggaaor
49 92 gghhffffhhgggaaovr
50 93 agghhffffhhgggaaovr
51 94 oagghhffffhhggggaaovr
52 95 voagghhfffhhhggggaaovr
53 96 rvoagghhffhhhhggggaaovvrr
54 97 rvvoagghhhhhhhggggaaovvrr
55 98 rvvoaagghhhhhhggggaaovvrr
56 99 rvvvoaagghhhhhgggaaovvrr
57 100 rvvvoaagghhhhgggaaovvrr
58 101 rvvvoaagghhhgggaaovvrr
59 103 rvvvoaagghhgggaaovvrr
60 104 rvvvoaaaghgggaaovvrr
61 106 rvvvoaaaggggaaovvrr
62 109 rvvvoaaggggaaovvr
63 111 rvvoaaggggaovr
64 115 rvoaagggaor
65 119 rvoaor
66 123 vr
'''

# The previously cramped lower ribbon is deliberately removed. This blank
# region contains no body in the existing cast pose.
RIBBON_CLEAR = '''
73 106
74 106
75 106
76 106
77 106
78 106
79 106
80 106
81 106
82 106
83 106
84 106
85 106
86 106
87 106
88 106
89 106
90 106
91 106
92 106
93 106
94 106
95 106
96 106
'''


def records(text):
    for line in text.strip().splitlines():
        y, x, ink = line.split(maxsplit=2)
        yield int(y), int(x), ink


def put(rows, y, x, ink, clear_right=False):
    assert 1 <= x and x + len(ink) <= 127, (y, x, ink)
    if clear_right:
        ink = ink.ljust(127 - x, '.')
    rows[y][x:x + len(ink)] = ink


def apply():
    if not BEFORE.exists():
        BEFORE.mkdir()
        for folder in ['poses', 'actions']:
            shutil.copytree(ROOT / folder, BEFORE / folder)
        for name in ['palette.json', 'AUTHORING.md', 'TIMING.md']:
            shutil.copy2(ROOT / name, BEFORE / name)
    for folder, name in [('poses', 'attack'), ('actions', 'skill_b')]:
        rows = [list(row) for row in
                (BEFORE / folder / (name + '.pxgrid')).read_text().splitlines()]
        if name == 'attack':
            for line in ATTACK.strip().splitlines():
                y, ink = line.split(maxsplit=1)
                put(rows, int(y), 80, ink, clear_right=True)
        else:
            for text in [CAST_CLEAR, RIBBON_CLEAR]:
                for line in text.strip().splitlines():
                    y, x = map(int, line.split())
                    put(rows, y, x, '.', clear_right=True)
            for text in [CAST_BODY, CAST_SHOULDER, CAST_CHEST, CAST_FIRE]:
                for y, x, ink in records(text):
                    put(rows, y, x, ink,
                        clear_right=(text in [CAST_SHOULDER, CAST_CHEST]))
        (ROOT / folder / (name + '.pxgrid')).write_text(
            '\n'.join(''.join(row) for row in rows) + '\n')


if __name__ == '__main__':
    apply()

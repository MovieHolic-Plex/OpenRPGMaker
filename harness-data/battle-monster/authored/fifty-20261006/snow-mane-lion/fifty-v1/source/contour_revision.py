"""Apply individually chosen native ASCII runs to three existing lion cels.

No transformed frame, shape rasterizer, shading synthesis or automatic fill.
The before-contour-repair snapshot is the input, making this revision repeatable.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'before-contour-repair'
RUNS = {
    ('poses', 'move'): '''
83 99 odddsso.......
84 99 bmbbddsso.....
85 99 bmbbbbddsso...
86 99 bmbbbbdddsso..
87 99 bmbbbbdddsso..
88 99 bmbbbddddso...
89 99 ommbbbddsso...
90 99 sombbbddsso...
91 99 ddsobbddso....
92 99 bbddsodso.....
93 99 wwbbddso......
94 99 wwwbbddso.....
''',
    ('actions', 'skill_b'): '''
95 92 .....sdmwwbbdddso..
96 92 ......sdmbbbdddso..
97 92 .......osdmbbddso..
98 92 .......osdmbbddso..
99 92 ......osdmbbddso...
100 92 .....osdmbbddso....
101 92 ....osdmbbddso.....
102 92 ...osdmbbbddso.....
103 92 ...sddbbbbddso.....
''',
    ('actions', 'stun_a'): '''
56 94 bddddmwwwwhh
57 94 bdddmwwwhhhh
58 94 bddmwwwhhhhh
59 94 bdmwwwhhhhhh
60 94 bdmwwhhhhhhh
61 94 bdmwwhhhwhhh
62 94 bddmwwhhhwhh
63 94 bddmwwwwwwow
64 94 bdddmwwwwwww
65 94 bdddmwwwwoww
66 94 bbdddmwwwwww
67 94 wbbddmwwwwhh
68 94 wbbdddmwwhhh
69 94 wwbbddmwwhhh
70 94 wwwbbddmwwhh
71 94 wwwwbddmwwww
72 94 wwwwbbdmwwww
73 94 wwwwwbdmwwwb
74 94 wwwwwwbdmwwb
75 94 wwwwwwwbdmbd
76 94 wwwwwwwwbdds
77 94 wwwwwwwbbdds
''',
}

for (folder, name), text in RUNS.items():
    rows = (BEFORE / folder / (name + '.pxgrid')).read_text().splitlines()
    for line in text.strip().splitlines():
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(rows) + '\n')
    (ROOT / 'repairs' / ('contour-' + name + '.runs')).write_text(text.strip() + '\n')
    print(name, 'explicit authored rows', len(text.strip().splitlines()))

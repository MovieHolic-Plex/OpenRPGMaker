"""Frame-specific literal pixel edits. No pose transform or generated shading.

The saved input is before-anatomy-repair. Each row/cluster below is authored
for its named frame. Padding is transparent erasure inside declared rectangles.
"""
from pathlib import Path
R = Path(__file__).parent
frames = {}
paths = {}
for kind in ('poses', 'actions'):
    for p in (R/'before-anatomy-repair'/kind).glob('*.pxgrid'):
        frames[p.stem] = [list(s) for s in p.read_text().splitlines()]
        paths[p.stem] = R/kind/p.name

def pixels(name, text):
    for line in text.strip().splitlines():
        y, x, ink = line.split()
        y, x = int(y), int(x)
        frames[name][y][x:x+len(ink)] = ink

def block(name, x, y, width, text):
    for dy, ink in enumerate(text.strip('\n').splitlines()):
        if len(ink) > width:
            raise ValueError((name, y+dy, len(ink), width))
        frames[name][y+dy][x:x+width] = ink.ljust(width, '.')

# Closed internal wedges become the warm brown chest under the forewing.
# The dark overlap edge of the feather remains; toe spaces are untouched.
pixels('idle_a', '''
66 69 b
67 68 bg
68 67 bgg
69 66 bggg
70 65 sbggg
71 64 sbgggo
95 55 bgoohhhh
96 56 bgoohhhh
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhhh
100 57 goohhh
101 58 ohhhgg
102 59 hggbgo
103 60 ggbgo
''')
pixels('idle_b', '''
60 69 b
61 69 b
62 69 b
63 69 g
64 69 g
65 68 bg
66 68 bg
67 67 bgg
68 66 bggg
69 65 sbggg
70 64 sbgggo
71 63 sbgggoo
95 55 bgoohh
96 56 bgoohhh
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhhh
100 57 goohhh
101 58 ohhhgg
102 59 hggbgo
103 60 ggbgo
''')
pixels('idle_c', '''
60 69 b
61 69 b
62 69 b
63 69 g
64 69 g
65 68 bg
66 68 bg
67 67 bgg
68 66 bggg
69 65 sbggg
70 64 sbgggo
71 63 sbgggoo
95 55 bgoohh
96 56 bgoohhh
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhh
100 57 goohh
101 58 ohhgg
102 59 hggbg
103 60 ggbg
''')
pixels('recover', '''
60 69 b
61 69 b
62 69 b
63 69 g
64 69 g
65 68 bg
66 68 bg
67 67 bgg
68 66 bggg
69 65 sbggg
70 64 sbgggo
71 63 sbgggoo
95 55 bgoohh
96 56 bgoohhh
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhhh
100 57 goohhh
101 58 ohhhgg
102 59 hggbgo
103 60 ggbgo
''')
pixels('skill_a', '''
60 69 b
61 69 b
62 69 b
63 69 g
64 69 g
65 68 bg
66 68 bg
67 67 bgg
68 66 bggg
69 65 sbggg
70 64 sbgggo
71 63 sbgggoo
95 55 bgoohh
96 56 bgoohhhhooogoo
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhhh
100 57 goohhh
101 58 ohhhgg
102 59 hggbgo
103 60 ggbgo
82 23 hkkh
83 22 hkwkh
84 21 hkwwkh
85 20 hkwwwkh
86 20 hkwwwwkh
87 20 hkwwwkh
88 21 hkwwkh
89 22 hkwkh
90 23 hkkh
91 24 hhh
''')

# Far folded wing: curved wrist, broad coverts, three overlapping primaries.
# Replaces the ribbon zigzag; preserved shoulder at x56+ joins the wing.
block('windup', 14, 39, 44, '''
.............................XXXX
..........................XXXhkkXX
........................XXhhkkkkkXX
.......................XohhkkkkkhhhX
.....................XXohhkkkhhhhhhhX
....................XohhkkkhhhhhhhhhhhX
...................XohhkkhhhhhhhhhhhhhhX
..................XohhkkhhhhhhhhhhhhhhhhX
.................XohhkkhhhhhhhhhohhhhhhhhX
................XohhkkhhhhhhhhhhoohhhhhhhhkX
...............XohhkkhhhhhhhhhhooohhhhhhhhkX
..............XohhkkhhhhhhhhhhooohhhhhhhhkkX
..............XohhkkhhhhhhhhooohhhhhhhhhhkkX
.............XohhkkhhhhhhhhooohhhhhhhhhhhkkX
.............XohhkkhhhhhoooohhhhhhhhhhhhhkkX
............XohhkkhhhhooooghhhhhhhhhhhhhhkkX
............XohhkkhhhoooggghhhhhhhhhhhhhhkkX
............XohhkkhhooogggghhhhhhhhhhhhhhkkX
............XohhkkhooogggghhhhhhhhhhhhhhkkhX
............XohhkkhooggghhhhhhhhohhhhhhhkkhX
............XohhkkhooggghhhhhhhhoohhhhhhkkhX
............XohhkkhoogghhhhhhhhhooohhhhhkkhX
............XohhkkhooggohhhhhhhhooohhhhhkkhX
............XohhkkhooggohhhhhhooogohhhhhkkhX
............XohhkkhooggohhhhhoooggohhhhhkkhX
............XohhkkhooggohhhhooogggohhhhhkkhX
............XohhkkhooggohhhoooggggohhhhhkkhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhkkhhX
............XohhkkhooggohhoooggggohhhhkkhhhX
............XohhkkhooggohhoooggggohhhhkkhhhX
............XohhkkhooggohhoooggggohhhkkhhhhX
............XohhkkhooggohhoooggggohhhkkhhhhX
............XohhkkhooggohhoooggggohhkkhhhhhX
.............XohkkhooggohhoooggggohhkkhhhhhX
.............XohkkhooggohhoooggggohkkhhhhhhX
.............XohkkhooggohhoooggggohkkhhhhhhX
..............XhkkhooggohhoooggggohkhhhhhhhX
..............XhkkhooggohhoooggggohkhhhhhhX
..............XhkkhooggohhoooggggohkhhhhhhX
...............XkkhooggohhoooggggohhhhhhhhX
...............XkkhooggohhoooggggohhhhhhhX
................XkhooggohhoooggggohhhhhhhX
................XhhooggXhhoooggggohhhhhhX
.................XhoogXohhoooggggohhhhhhX
.................XhogXohhhoooggggohhhhhX
..................XXohhhhXooogggohhhhhX
....................XhhhkXooogggohhhhX
....................XhhkXohhoogggohhhhX
.....................XkXohhhhoogohhhhX
......................XXhhhhhoogohhhX
........................XhhhhoogohhhX
.........................XhhhoogohhX
..........................XhhoogohX
...........................XXXXXX
''')
# Near wing laid diagonally on the chest; rounded leading bend, overlapping
# short feathers and a dark underside, not a second long angular ribbon.
pixels('windup', '''
68 59 gohhkkh
69 58 gohhhkkhh
70 57 gohhhhkkhh
71 56 bgoohhhkkhhh
72 55 bgoohhhhkkhhh
73 54 bgoohhhhhkkhhh
74 53 bgoohhhhhhkkhhh
75 52 bgoohhhhhhhkkhhh
76 51 bgoohhhhhhhhkkhhh
77 50 bgoohhhhhhhhhkkhhh
78 49 bgoohhhhhhhhhhhkkhh
79 48 bgoohhhhhhhhhhhhkkhh
80 48 bgoohhhhhhhhhhhhkkhhh
81 48 bgoohhhhhhhhhhhhhkkhh
82 48 bgoohhhhhhhhhhhhhkkhh
83 48 bgoohhhhhhhhohhhhkkhh
84 48 bgoohhhhhhooohhhhkkhh
85 48 bgoohhhhhoooghhhhkkhh
86 49 bgoohhhooogghhhhkkhh
87 49 bgoohhooogghhhhkkhh
88 50 bgoohhooggXhhhkkhh
89 50 bgoohhooggXhhkkhhh
90 51 bgoohhooggXhkkhhhg
91 52 bgoohhooggXkkhhhog
92 53 bgoohhoogggXhhhogg
93 54 bgoohhoogggXhhogg
94 55 bgoohhogggoXhogg
95 56 bgoohogggboXogg
96 57 bgohooggbbsXgg
97 58 bgohoXgbbsXgg
98 59 bgohXggbsXggg
99 60 bggXXgbsXgggg
100 61 bgXogbsXggggg
101 62 bgoobsXgggggg
102 63 goobsXgggggg
103 64 oobbsXggggg
''')

# Lowered rump and two bent legs under the body; native support at y124.
block('windup', 53, 96, 59, '''
.XbgoohhhhhhhhhoooogggXoooooogggX
..XbgoohhhhhhhhhoooogggXooooogggX
...XbgoohhhhhhhhhoooogggXoooogggX
....XbgoohhhhhhhhhoooogggXooggggX
.....XbgoohhhhhhhhhoooogggXgggggX
......XbgoohhhhhhhhhooooggXgggggX
.......XbgoohhhhhhhhooooggXgggggX
........XbgoohhhhhhhooooggXggggX
.........XbgoohhhhhooooggXgggggX
..........XbgoohhhoooggXhooogggX
...........XbgoohhoooggXhhooogggX
............XbgoohhooggXhhhooogggX
.............XbgohhooggXhhhooogggX
..............XbghhoggXhhhooooggX
...............XbhoggXjiiXhhoggX
...............XjiivvXjiiivXggX
..............XjiivvvX.jiiivvXX
.............XjiivvvX...XjiivvX
............XjiivvvX....XjiivvX
...........XjiivvvX.....XjiivvX
...........XjiivvX......XjiivvX
...........XjiiivX......XjiiivX
..........XjjiiivvX....XjjiiivvX
.........XjjiiiivvtX..XjjiiiivvtX
........XjiivttjiivX.XjiivttjiivX
........XjivtnXjiitnXXjivtnXjiitnX
.........XitnnXitnnX.XitnnXitnnX
.........XtnnnXtnnnX.XtnnnXtnnnX
..........XnnX.XnnX...XnnX.XnnX
''')

pixels('windup', '''
119 112 .....
120 112 .....
121 112 .....
122 112 .....
123 112 .....
124 112 .....
''')

# The stunned far wing sags with shorter coverts and uneven feather tips.
block('stun_a', 14, 39, 45, '''
.............................XXXX
..........................XXXhkkXX
........................XXhhkkkkhXX
.......................XohhkkkkhhhhX
.....................XXohhkkkhhhhhhhhX
....................XohhkkkhhhhhhhhhhhhX
...................XohhkkhhhhhhhhhhhhhhhX
..................XohhkkhhhhhhhhhhhhhhhhhX
.................XohhkkhhhhhhhhhohhhhhhhhhX
................XohhkkhhhhhhhhhhoohhhhhhhhhX
...............XohhkkhhhhhhhhhhooohhhhhhhhkkX
..............XohhkkhhhhhhhhhhooohhhhhhhhhkkX
..............XohhkkhhhhhhhhooohhhhhhhhhhhkkX
.............XohhkkhhhhhhhhooohhhhhhhhhhhhkkX
.............XohhkkhhhhhoooohhhhhhhhhhhhhhkkX
............XohhkkhhhhooooghhhhhhhhhhhhhhhkkX
............XohhkkhhhoooggghhhhhhhhhhhhhhhkkX
............XohhkkhhooogggghhhhhhhhhhhhhhhkkX
............XohhkkhooogggghhhhhhhhhhhhhhhkkhX
............XohhkkhooggghhhhhhhhohhhhhhhhkkhX
............XohhkkhooggghhhhhhhhoohhhhhhhkkhX
............XohhkkhoogghhhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhooogohhhhhhkkhX
............XohhkkhooggohhhhhoooggohhhhhhkkhX
............XohhkkhooggohhhhooogggohhhhhhkkhX
............XohhkkhooggohhhoooggggohhhhhhkkhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
.............XohkkhooggohhoooggggohhhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
..............XhkkhooggohhoooggggohhhkhhhhX
..............XhkkhooggohhoooggggohhhkhhhhX
..............XhkkhooggohhoooggggohhhkhhhhX
...............XkkhooggohhoooggggohhhhhhhX
...............XkkhooggohhoooggggohhhhhhhX
................XkhooggohhoooggggohhhhhhhX
................XhhooggXhhoooggggohhhhhhX
.................XhoogXohhoooggggohhhhhhX
.................XhogXohhhoooggggohhhhhX
..................XXohhhhXooogggohhhhhX
....................XhhhkXooogggohhhhX
....................XhhkXohhoogggohhhhX
.....................XkXohhhhoogohhhhX
......................XXhhhhhoogohhhX
........................XhhhhoogohhhX
........................XhhhhoogohhhX
.........................XhhhoogohhX
..........................XhhoogohX
...........................XXXXXX
''')
pixels('stun_a', '''
77 59 gohhkkh
78 58 gohhhkkhh
79 57 gohhhhkkhh
80 56 bgoohhhkkhhh
81 55 bgoohhhhkkhhh
82 54 bgoohhhhhkkhhh
83 53 bgoohhhhhhkkhhh
84 52 bgoohhhhhhhkkhhh
85 51 bgoohhhhhhhhkkhhh
86 51 bgoohhhhhhhhhkkhh
87 51 bgoohhhhhhhhhkkhh
88 51 bgoohhhhhhohhkkhh
89 52 bgoohhhhoooohkkhh
90 52 bgoohhhoooghhkkhh
91 53 bgoohhooggXhkkhh
92 54 bgoohhooggXkkhhh
93 55 bgoohhooggXkhhgo
94 56 bgoohhoogggXhhgo
95 57 bgoohhoogggXhgo
96 58 bgoohhogggoXgo
97 59 bgoohogggbXgg
98 60 bgohooggbXggg
99 61 bgohhoogXgggg
100 62 bgohhggXggggg
101 63 bgohggXgggggg
102 64 bgoggXgggggg
103 65 bggXggggggg
''')

block('stun_b', 14, 39, 45, '''
.............................XXXX
..........................XXXhkkXX
........................XXhhkkkkhXX
.......................XohhkkkkhhhhX
.....................XXohhkkkhhhhhhhhX
....................XohhkkkhhhhhhhhhhhhX
...................XohhkkhhhhhhhhhhhhhhhX
..................XohhkkhhhhhhhhhhhhhhhhhX
.................XohhkkhhhhhhhhhohhhhhhhhhX
................XohhkkhhhhhhhhhhoohhhhhhhhhX
...............XohhkkhhhhhhhhhhooohhhhhhhhkkX
..............XohhkkhhhhhhhhhhooohhhhhhhhhkkX
..............XohhkkhhhhhhhhooohhhhhhhhhhhkkX
.............XohhkkhhhhhhhhooohhhhhhhhhhhhkkX
.............XohhkkhhhhhoooohhhhhhhhhhhhhhkkX
............XohhkkhhhhooooghhhhhhhhhhhhhhhkkX
............XohhkkhhhoooggghhhhhhhhhhhhhhhkkX
............XohhkkhhooogggghhhhhhhhhhhhhhhkkX
............XohhkkhooogggghhhhhhhhhhhhhhhkkhX
............XohhkkhooggghhhhhhhhohhhhhhhhkkhX
............XohhkkhooggghhhhhhhhoohhhhhhhkkhX
............XohhkkhoogghhhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhooogohhhhhhkkhX
............XohhkkhooggohhhhhoooggohhhhhhkkhX
............XohhkkhooggohhhhooogggohhhhhhkkhX
............XohhkkhooggohhhoooggggohhhhhhkkhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhX
...............XkkhooggohhoooggggohhkhhhhX
...............XkkhooggohhoooggggohhkhhhhX
................XkhooggohhoooggggohkhhhhX
................XhhooggXhhoooggggohkhhhhX
.................XhoogXohhoooggggohkhhhhX
.................XhogXohhhoooggggohhhhhX
..................XXohhhhXooogggohhhhhX
....................XhhhkXooogggohhhhX
....................XhhkXohhoogggohhhhX
.....................XkXohhhhoogohhhhX
......................XXhhhhhoogohhhX
........................XhhhhoogohhhX
........................XhhhhoogohhX
.........................XhhhoogohhX
..........................XhhoogohX
...........................XhoogX
............................XXXX
''')
pixels('stun_b', '''
77 59 gohhkkh
78 58 gohhhkkhh
79 57 gohhhhkkhh
80 56 bgoohhhkkhhh
81 55 bgoohhhhkkhhh
82 54 bgoohhhhhkkhhh
83 53 bgoohhhhhhkkhhh
84 52 bgoohhhhhhhkkhhh
85 51 bgoohhhhhhhhkkhhh
86 51 bgoohhhhhhhhhkkhh
87 51 bgoohhhhhhhhhkkhh
88 51 bgoohhhhhhohhkkhh
89 52 bgoohhhhoooohkkhh
90 52 bgoohhhoooghhkkhh
91 53 bgoohhooggXhkkhh
92 54 bgoohhooggXkkhhh
93 55 bgoohhooggXkhhgo
94 56 bgoohhoogggXhhgo
95 57 bgoohhoogggXhgo
96 58 bgoohhogggoXgo
97 59 bgoohogggbXgg
98 60 bgohooggbXggg
99 61 bgohhoogXgggg
100 62 bgohhggXggggg
101 63 bgohggXgggggg
102 64 bgoggXgggggg
103 65 bggXggggggg
''')

# Resting wings retain their feather groups and soften around the flank.
# The two sleep faces/neck cels remain separately authored, with closed lids.
block('sleep_a', 14, 39, 45, '''
.............................XXXX
..........................XXXhkkXX
........................XXhhkkkkhXX
.......................XohhkkkkhhhhX
.....................XXohhkkkhhhhhhhhX
....................XohhkkkhhhhhhhhhhhhX
...................XohhkkhhhhhhhhhhhhhhhX
..................XohhkkhhhhhhhhhhhhhhhhhX
.................XohhkkhhhhhhhhhohhhhhhhhhX
................XohhkkhhhhhhhhhhoohhhhhhhhhX
...............XohhkkhhhhhhhhhhooohhhhhhhhkkX
..............XohhkkhhhhhhhhhhooohhhhhhhhhkkX
..............XohhkkhhhhhhhhooohhhhhhhhhhhkkX
.............XohhkkhhhhhhhhooohhhhhhhhhhhhkkX
.............XohhkkhhhhhoooohhhhhhhhhhhhhhkkX
............XohhkkhhhhooooghhhhhhhhhhhhhhhkkX
............XohhkkhhhoooggghhhhhhhhhhhhhhhkkX
............XohhkkhhooogggghhhhhhhhhhhhhhhkkX
............XohhkkhooogggghhhhhhhhhhhhhhhkkhX
............XohhkkhooggghhhhhhhhohhhhhhhhkkhX
............XohhkkhooggghhhhhhhhoohhhhhhhkkhX
............XohhkkhoogghhhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhooogohhhhhhkkhX
............XohhkkhooggohhhhhoooggohhhhhhkkhX
............XohhkkhooggohhhhooogggohhhhhhkkhX
............XohhkkhooggohhhoooggggohhhhhhkkhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhX
...............XkkhooggohhoooggggohhkhhhhX
...............XkkhooggohhoooggggohhkhhhhX
................XkhooggohhoooggggohkhhhhX
................XhhooggXhhoooggggohkhhhhX
.................XhoogXohhoooggggohkhhhhX
.................XhogXohhhoooggggohhhhhX
..................XXohhhhXooogggohhhhhX
....................XhhhkXooogggohhhhX
....................XhhkXohhoogggohhhhX
.....................XkXohhhhoogohhhhX
......................XXhhhhhoogohhhX
........................XhhhhoogohhhX
........................XhhhhoogohhX
.........................XhhhoogohhX
..........................XhhoogohX
...........................XhoogX
............................XXXX
''')
pixels('sleep_a', '''
86 57 Xgohhkkhh
87 56 bgohhhkkhh
88 55 bgohhhhkkhh
89 54 bgohhhhhkkhh
90 53 bgohhhhhhkkhh
91 52 bgohhhhhhhkkhh
92 52 bgohhhhhhhhkkhh
93 52 bgohhhhhhhhhkkhh
94 52 bgohhhhhhhhhkkhh
95 53 bgohhhhhhohhkkhh
96 54 bgohhhhhoohhkkhh
97 55 bgohhhoooghhkkhh
98 56 bgohhooogghhkkhh
99 57 bgohhooggXhhkkhh
100 58 bgohhooggXhkkhhh
101 59 bgohhooggXkkhhog
102 60 bgohhoogggXhhhgo
103 61 bgohhoogggXhhgo
104 62 bgohhogggoXhgo
105 63 bgohogggbsXgo
106 64 bgohoggbbsXgg
107 65 bgohoggbXgggg
108 66 bgohggXgggggg
109 67 bgoggXgggggg
110 68 bggXggggggg
''')

block('sleep_b', 14, 39, 45, '''
.............................XXXX
..........................XXXhkkXX
........................XXhhkkkkhXX
.......................XohhkkkkhhhhX
.....................XXohhkkkhhhhhhhhX
....................XohhkkkhhhhhhhhhhhhX
...................XohhkkhhhhhhhhhhhhhhhX
..................XohhkkhhhhhhhhhhhhhhhhhX
.................XohhkkhhhhhhhhhohhhhhhhhhX
................XohhkkhhhhhhhhhhoohhhhhhhhhX
...............XohhkkhhhhhhhhhhooohhhhhhhhkkX
..............XohhkkhhhhhhhhhhooohhhhhhhhhkkX
..............XohhkkhhhhhhhhooohhhhhhhhhhhkkX
.............XohhkkhhhhhhhhooohhhhhhhhhhhhkkX
.............XohhkkhhhhhoooohhhhhhhhhhhhhhkkX
............XohhkkhhhhooooghhhhhhhhhhhhhhhkkX
............XohhkkhhhoooggghhhhhhhhhhhhhhhkkX
............XohhkkhhooogggghhhhhhhhhhhhhhhkkX
............XohhkkhooogggghhhhhhhhhhhhhhhkkhX
............XohhkkhooggghhhhhhhhohhhhhhhhkkhX
............XohhkkhooggghhhhhhhhoohhhhhhhkkhX
............XohhkkhoogghhhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhhhooohhhhhhkkhX
............XohhkkhooggohhhhhhooogohhhhhhkkhX
............XohhkkhooggohhhhhoooggohhhhhhkkhX
............XohhkkhooggohhhhooogggohhhhhhkkhX
............XohhkkhooggohhhoooggggohhhhhhkkhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhkkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhhkhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhhkhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhhkhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
............XohhkkhooggohhoooggggohhhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhhkhhhhhX
.............XohkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhX
..............XhkkhooggohhoooggggohhkhhhhhX
...............XkkhooggohhoooggggohkhhhhhX
...............XkkhooggohhoooggggohkhhhhX
................XkhooggohhoooggggohkhhhhX
................XhhooggXhhoooggggohkhhhhX
.................XhoogXohhoooggggohkhhhhX
.................XhogXohhhoooggggohhhhhX
..................XXohhhhXooogggohhhhhX
....................XhhhkXooogggohhhhX
....................XhhkXohhoogggohhhhX
.....................XkXohhhhoogohhhhX
......................XXhhhhhoogohhhX
........................XhhhhoogohhhX
........................XhhhhoogohhX
.........................XhhhoogohhX
..........................XhhoogohX
...........................XhoogX
............................XXXX
''')
pixels('sleep_b', '''
86 57 Xgohkkhh
87 56 bgohhkkhh
88 55 bgohhhkkhh
89 54 bgohhhhkkhh
90 53 bgohhhhhkkhh
91 52 bgohhhhhhkkhh
92 52 bgohhhhhhhkkhh
93 52 bgohhhhhhhhkkhh
94 53 bgohhhhhhhhhkkhh
95 54 bgohhhhhhohhkkhh
96 55 bgohhhhhoohhkkhh
97 56 bgohhhoooghhkkhh
98 57 bgohhooogghhkkhh
99 58 bgohhooggXhhkkhh
100 59 bgohhooggXhkkhhh
101 60 bgohhooggXkkhhog
102 61 bgohhoogggXhhhgo
103 62 bgohhoogggXhhgo
104 63 bgohhogggoXhgo
105 64 bgohogggbsXgo
106 65 bgohoggbbsXgg
107 66 bgohoggbXgggg
108 67 bgohggXgggggg
109 68 bgoggXgggggg
110 69 bggXggggggg
''')

# Casting: the upper two extended feathers are good and remain. Redraw the
# folded lower wing and lift the near-wing wrist BELOW the beak to the third
# launch core. Silver throat, dark gap and gold feather root stay distinct.
block('skill_b', 16, 68, 45, '''
..............XohhkkhhhhhhhooogggohhhhhhkkhX
.............XohhkkhhhhhhhooogggohhhhhkkhhX
.............XohhkkhhhhhhhooogggohhhhhkkhhX
............XohhkkhhhhhhhooogggohhhhhkkhhX
............XohhkkhhhhhhhooogggohhhhhkkhhX
............XohhkkhhhhhhhooogggohhhhkkhhhX
............XohhkkhhhhhhhooogggohhhhkkhhhX
...........XohhkkhhhhhhhooogggohhhhkkhhhhX
...........XohhkkhhhhhhhooogggohhhhkkhhhhX
...........XohhkkhhhhhhhooogggohhhhkkhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
...........XohhkkhhhhhhhooogggohhhkkhhhhhX
............XohkkhhhhhhhooogggohhhkkhhhhhX
............XohkkhhhhhhhooogggohhhkkhhhhhX
............XohkkhhhhhhhooogggohhhkkhhhhhX
............XohkkhhhhhhhooogggohhhkkhhhhhX
.............XhkkhhhhhhhooogggohhhkkhhhhX
.............XhkkhhhhhhhooogggohhhkkhhhhX
.............XhkkhhhhhhooogggohhhkkhhhhX
..............XkkhhhhhhooogggohhhkkhhhhX
..............XkkhhhhhhooogggohhhkkhhhhX
...............XkhhhhhXooogggohhhkkhhhX
...............XhhhhXhhoogggohhhkkhhhX
................XhhXhhhoogggohhhkhhhhX
.................XXhhhoogggohhhkhhhhX
...................XhhoogggohhhkhhhX
....................XhoogggohhhkhhhX
.....................XoogggohhhkhhhX
......................XgggohhhkhhhX
.......................XggohhhkhhX
........................XgohhhkhX
.........................XXXXXXX
''')
pixels('skill_b', '''
60 68 X
61 67 X
62 67 X
63 67 X
64 68 X
65 81 jhooivvX.................khhkk
66 80 jjhooivX................khhhhkk
67 79 wjjhooivX.............khhhhhhkk
68 78 wwjjhooivX..........hkkkhhkkkhk
69 77 wwwjjhooivX........khkkhhhhkk
70 76 wwwwjjhooivX......khhkkhhhhk
71 75 jwwwwjjhooivX....khhhkkhhhkk
72 74 ijwwwwjjhooivX..hkwhkkhhkk
73 73 viijwwjjhooivX.khkkwhkkhkk
74 72 vvviijjhooivX..XohkkkwwwkkhhgoX
75 71 ttvviijhooivX..XgohkkwwwkkhhgoX
76 70 tttvviijhooivX..XgohhkkkhhhgoX
77 68 ggohhiiivvttX....XgohhhhhhggX
78 66 gohhhkkhXggggoohhhhhkkkkhhggX
79 65 gohhhhkkhXgggoohhhhhhkkkkhggX
80 64 gohhhhhkkhXgoohhhhhhhhkkkhgX
81 63 gohhhhhhkkhXohhhhhhhhhkkhgX
82 62 bgoohhhhhkkhXhhhhhhhhkkhgX
83 61 bgoohhhhhhkkhXhhhhhhkkhgX
84 60 bgoohhhhhhhkkhXhhhhkkhgX
85 59 bgoohhhhhhhhkkhXhhkkhgX
86 58 bgoohhhhhhhhhkkhhkkhgX
87 58 bgoohhhhhhhhhhkkkhgX
88 58 bgoohhhhhhhhhhhkhgX
89 59 bgoohhhhhhhhhohhgX
90 60 bgoohhhhhhhhoohgX
91 61 bgoohhhhhhooohgX
92 62 bgoohhhhooooggX
93 63 bgoohhoooogggX
94 64 bgoohhooggggX
95 65 bgoohhoXgggX
96 66 bgoohhXgggX
97 67 bgoohXgggX
''')

# Skill recovery: erase only the former extended wing sector, then author
# a folded wrist/coverts/three-primary outline. The two outgoing echoes at
# x102+ are outside this sector and stay in their firing directions.
block('skill_c', 5, 9, 59, '''
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
.
''')
block('skill_c', 5, 36, 59, '''
.......................................XXXX
....................................XXXhkkXX
..................................XXhhkkkkhXX
.................................XohhkkkkhhhhX
...............................XXohhkkkhhhhhhhhX
..............................XohhkkkhhhhhhhhhhhhX
.............................XohhkkhhhhhhhhhhhhhhhX
............................XohhkkhhhhhhhhhhhhhhhhhX
...........................XohhkkhhhhhhhhhohhhhhhhhhX
..........................XohhkkhhhhhhhhhhoohhhhhhhhhX
.........................XohhkkhhhhhhhhhhooohhhhhhhhhkkX
........................XohhkkhhhhhhhhhhooohhhhhhhhhhkkX
........................XohhkkhhhhhhhhooohhhhhhhhhhhhkkX
.......................XohhkkhhhhhhhhooohhhhhhhhhhhhhkkX
.......................XohhkkhhhhhoooohhhhhhhhhhhhhhhkkX
......................XohhkkhhhhooooghhhhhhhhhhhhhhhhkkX
......................XohhkkhhhoooggghhhhhhhhhhhhhhhhkkX
......................XohhkkhhooogggghhhhhhhhhhhhhhhhkkX
......................XohhkkhooogggghhhhhhhhhhhhhhhkkhhX
......................XohhkkhooggghhhhhhhhohhhhhhhhkkhhX
......................XohhkkhooggghhhhhhhhoohhhhhhkkhhhX
......................XohhkkhoogghhhhhhhhhooohhhhkkhhhX
......................XohhkkhooggohhhhhhhhooohhhhkkhhhX
......................XohhkkhooggohhhhhhooogohhhhkkhhhX
......................XohhkkhooggohhhhhoooggohhhkkhhhhX
......................XohhkkhooggohhhhooogggohhhkkhhhhX
......................XohhkkhooggohhhoooggggohhhkkhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhhkkhhhhhX
......................XohhkkhooggohhoooggggohhkkhhhhhhX
......................XohhkkhooggohhoooggggohhkkhhhhhhX
......................XohhkkhooggohhoooggggohkkhhhhhhhX
.......................XohkkhooggohhoooggggohkkhhhhhhhX
.......................XohkkhooggohhoooggggohkhhhhhhhhX
.......................XohkkhooggohhoooggggohkhhhhhhhX
........................XhkkhooggohhoooggggohkhhhhhhX
........................XhkkhooggohhoooggggohkhhhhhhX
.........................XkkhooggohhoooggggohkhhhhhhX
.........................XkkhooggohhoooggggohhhhhhhX
..........................XkhooggohhoooggggohhhhhhhX
..........................XhhooggXhhoooggggohhhhhhX
...........................XhoogXohhoooggggohhhhhhX
...........................XhogXohhhoooggggohhhhhX
............................XXohhhhXooogggohhhhhX
..............................XhhhkXooogggohhhhX
..............................XhhkXohhoogggohhhhX
...............................XkXohhhhoogohhhhX
................................XXhhhhhoogohhhX
''')
pixels('skill_c', '''
48 62 XjjXjjwwww
49 61 Xhjwwjjwwww
50 60 hhhXjwXjwwww
51 60 hhhXwwXwwww
52 60 hhhXwwhXwwww
53 60 hhhXwwhXwwwj
54 60 hhhhXwwhXwwj
55 60 hhhhXjjhXjji
56 60 hhhhXiihXiiv
57 60 hhhhXvvhXvvi
58 59 hjjjjiivvvv
59 58 gohhhhjivvv
60 57 gohhhkkhjivv
61 56 gohhhhkkhjivv
62 55 bgoohhhkkhjiiv
63 54 bgoohhhhkkhjivv
64 53 bgoohhhhhkkhggg
65 52 bgoohhhhhhkkhgggg
66 51 bgoohhhhhhhkkhgggg
67 50 bgoohhhhhhhhkkhgggg
68 49 bgoohhhhhhhhhkkhgggg
69 49 bgoohhhhhhhhhhkkhgggg
70 49 bgoohhhhhhhhhhhkkhgggg
71 49 bgoohhhhhhhhhhhkkhgggg
72 49 bgoohhhhhhhhhhhkkhgggg
73 49 bgoohhhhhhhhhhhkkhgggg
74 49 bgoohhhhhhhhhhhkkhgggg
75 49 bgoohhhhhhhhhhhkkhgggg
76 49 bgoohhhhhhhhohhkkhgggg
77 49 bgoohhhhhhooohhkkhgggg
78 49 bgoohhhhhoooghhkkhgggg
79 50 bgoohhhooogghhhkkhggg
80 50 bgoohhooogghhhkkhgggg
81 51 bgoohhooggXhhhkkhggg
82 51 bgoohhooggXhhkkhhggg
83 52 bgoohhooggXhkkhhgggg
84 53 bgoohhooggXkkhhgggg
85 54 bgoohhoogggXhhggggg
86 55 bgoohhoogggXhggggg
87 56 bgoohhogggoXggggg
88 57 bgoohogggboXgggg
89 58 bgohooggbbsXggg
90 59 bgohoXgbbsXgggg
91 60 bgohXggbsXgggg
92 61 bggXXgbsXgggg
93 62 bgXogbsXgggg
94 63 bgoobsXgggg
95 30 ...............
95 55 bgoohh
96 56 bgoohhh
97 56 bgoohhhh
98 57 goohhhh
99 57 goohhhh
100 57 goohhh
101 58 ohhhgg
102 59 hggbgo
103 60 ggbgo
''')

# Visual follow-up: widen the lifted near wing into three overlapping feather
# groups. Its wrist reaches the lower launch core, not the throat or beak.
block('skill_b', 76, 76, 31, '''
........XgohhhhhkkkhhhgoX
......XgohhhhhhhkkkhhhggX
....XgohhhhhhhhhkkkhhggX
..XgohhhhhhhhhhhkkkhhggX
XgohhhhhhhhhhhhhhhkkhgX
bgoohhhhhhhhhhhhhkkhgX
goohhhhhhhhhhhhhkkhgX
oohhhhhhhhhhhhhkkhgX
ohhhhhhhhhhhohhkkhgX
hhhhhhhhhhooohhkkhgX
hhhhhhhhhoooggXkhgX
hhhhhhhoooggghXhgX
hhhhhoooggghhhXgX
hhhooooggghhhXgX
hooooggghhhhXgX
oooggghhhhkkXgX
ogghhhhhhkkXgX
gghhhhhhhkXgX
ghhhhhhhXggX
ghhhhhhXggX
''')

# Inspection of the corresponding chest area in the other 18-pose cels found
# the same four transparent pixels in hit/poison. Correct each actual location.
# Their crooked sick wings, faces, effects and tail feather gaps are retained.
pixels('hit', '''
70 66 b
71 64 bgg
''')
pixels('poison_a', '''
70 66 b
71 64 bgg
''')
pixels('poison_b', '''
70 66 b
71 64 bgg
''')
pixels('idle_a', '''
100 63 g
''')

for name, grid in frames.items():
    paths[name].write_text('\n'.join(''.join(row) for row in grid)+'\n')

"""Apply only hand-selected horizontal ASCII pixel strings to existing grids.

No procedural silhouette, shading, transform, tracing or automatic hole repair.
Each block records y, x, literal pixels; transparent right-tail padding is storage.
The before-repair grids and original author helper are in original/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TAILS = {}
PATCHES = {}

TAILS['idle_a'] = '''
21 40 ..........ooo
22 40 .......oolhhjo
23 40 .....olhlljjgso
24 40 ....olhjjgssgso
25 40 ...oljgsoo.ogso
26 40 ..olsoo...ogjso
27 40 ..oo......ojgso
28 40 .........ogjgso
29 40 ogjjjjjjjgssso
30 40 jjjggsooooo
31 40 ggso
36 38 ..........ooo
37 38 .......oolhljo
38 38 ......olhjjgso
39 38 ......olsoo.gso
40 38 jgo.......ogso
41 38 osjjgo...ogjso
42 38 .ojjjjjjgssso
43 38 oljjjjggsooo
'''

TAILS['idle_b'] = '''
21 41 ..........oo
22 41 ........olhjo
23 41 ......olhlljgso
24 41 .....olhjjgsgso
25 41 ....oljgso.ogso
26 41 ...olsoo...ogso
27 41 ...oo.....ogjso
28 41 .........ogjgso
29 41 ogjjjjjjjgssso
30 41 jjjggsooooo
31 41 ggso
36 39 ..........ooo
37 39 .......oolhljo
38 39 ......olhjjgso
39 39 ......olsoo.gso
40 39 jgo.......ogso
41 39 osjjgo...ogjso
42 39 .ojjjjjjgssso
43 39 oljjjjggsooo
'''

TAILS['idle_c'] = '''
22 40 ...........oo
23 40 ........olhhjo
24 40 ......olhlljgso
25 40 .....olhjjgsgso
26 40 ....oljgso.ogso
27 40 ...olsoo...ogso
28 40 ...oo.....ogjso
29 40 ogjjjjjjjgjgso
30 40 jjjggsssssooo
31 40 ggsooo
37 38 ...........oo
38 38 ........oolhjo
39 38 .......olhjjgso
40 38 jgo....olsoo.gso
41 38 osjjgo.......gso
42 38 .osjjjgo...ogjso
43 38 ..ojjjjjjjjgssso
44 38 oljjjjgggsoooo
'''

TAILS['windup'] = '''
16 42 ..............ooo
17 42 ...........oolhljo
18 42 .........olhlljgso
19 42 .......olhjjgssgso
20 42 ......oljgsoo.ogso
21 42 .....olsoo....ogso
22 42 .....oo......ogjso
23 42 ............ogjgso
24 42 .........ogjjjgso
25 42 ......ogjjjjgso
26 42 ...ogjjjjgso
27 42 ogjjjgso
28 42 jjgso
32 40 ..............ooo
33 40 ...........oolhljo
34 40 .........olhlljgso
35 40 ........oljgssgso
36 40 .......olsoo.ogso
37 40 .......oo...ogjso
38 40 ...........ogjso
39 40 ogjjgo....ogjgso
40 40 jjjjjjjjjjgssso
41 40 jjgsggsssoooo
42 40 ggsoooo
43 40 so
'''

TAILS['move'] = '''
22 42 ...............ooo
23 42 ............oolhhjo
24 42 .........oolhlljgso
25 42 .......olhjjggsgso
26 42 .....oljgso..ogso
27 42 ....olsoo...ogjso
28 42 ....oo.....ogjgso
29 42 ogjjjjjjjjjgssso
30 42 jjjgggsssooooo
31 42 ggsooo
35 38 ............ooo
36 38 .........oolhljo
37 38 ........olhlljgso
38 38 .......oljgssgso
39 38 .......olsoo.gso
40 38 jgo........ogso
41 38 ogjjgo....ogjso
42 38 .ogjjjjjjjgssso
43 38 .ojjjggsssooo
44 38 .ooooo
'''

TAILS['recover'] = '''
22 41 ...........oo
23 41 ........olhhjo
24 41 ......olhlljjgso
25 41 .....olhjjgssgso
26 41 ....oljgsoo.ogso
27 41 ...olsoo...ogjso
28 41 ...oo......ojgso
29 41 ogjjjjjjjjgjgso
30 41 jjjggsssssoooo
31 41 ggso
37 39 ...........ooo
38 39 ........oolhljo
39 39 ......olhlljjgso
40 39 jgo...oljgssgso
41 39 osjjgo.olsoo.gso
42 39 ..osjjgo....ogso
43 39 ..ojjjjjjjjjgssso
44 39 oljjjjgggsssoooo
45 39 jjgsoooo
'''

TAILS['attack'] = '''
28 44 ..................
29 42 olhjjgo
30 39 ogjjgsooljgso......oo
31 36 ogjjgso....oljgso...oljo
32 33 ogjjgso........oljgsooljso
33 30 osjjgso.............oljsljso
34 30 .ossgso............olhsllgso
35 30 .ogjgo..........olhjjlgso
36 30 ..ogjgo.......olhjjso.oo
37 31 ..ogjgo.....olhjjgso
38 33 .ogjgo...olhjjgso
39 35 ogjgo..olhjjgso
40 36 ogjjgooljjgso
41 37 ogjjjjjgso
42 38 oossgsooo
'''

TAILS['hit'] = '''
34 36 ...........oo
35 36 ........olhjo
36 36 ......olhlljgso
37 36 .....oljgssgso
38 36 ....olsoo.ogso
39 36 jgo.oo...ogjso
40 36 sjjjgo..ogjgso
41 36 .osjjjjjjgssso
42 36 .oljjjgggsooo
43 36 oljjjgso
44 36 ljjgso
'''

TAILS['skill_a'] = '''
21 40 ............ooo
22 40 .........oolhljo
23 40 .......olhlljgso
24 40 ......olhjjgsgso
25 40 .....oljgso.ogso
26 40 ....olsoo.ccogso
27 40 ....oo..cwcogjso
28 40 .......cc.ogjgso
29 39 ogjjjjjjjjjgssso
30 37 ogjjjjggsssoooo
31 35 ogjjgso
33 38 .........ooo
34 38 ......oolhljo
35 38 .....olhjjgso
36 38 ....olsoo.gso
37 38 ....oo.cwcgso
38 38 jgo..cc.ogjso
39 38 jjgo...ogjgso
40 37 ogjjjjjjjgssso
41 36 ogjjjggsssoooo
42 35 oljjgso
43 35 ljjgso
44 34 ljjgso
45 34 jgso
46 33 oo
'''

TAILS['skill_b'] = '''
19 51 ..........c
20 51 ........cwc
21 48 .ooo.....cwwc
22 46 ..olhjo..cwwc
23 45 ..olhjgsooccc
24 43 ..oljjgsoolso
25 41 ..oljjgsollso
26 39 .oljjjgjljgso
27 38 .ogjjjjjjgso
28 37 .ogjjjjgso
29 36 ogjjggso
30 35 jjggso
33 38 ....ooo
34 36 .....olhjo
35 34 .....olhjjgso
36 36 ..olhjjgso.......oc
37 35 ..oljjgso.....olsocwwc
38 34 ogjjjgso...oljgso......cwwc
39 33 ogjjjjgjjjjgso...........cwwc
40 33 ossggggsssooo..............cwc
41 33 ..ooooooo....................c
'''

TAILS['skill_c'] = '''
22 40 ...........oo......cwc
23 40 ........olhjjo......c
24 40 ......olhlljgso
25 40 .....oljgssgso
26 40 ....olsoo.ogso
27 40 ....oo....ogso.....cc
28 40 .........ogjso...cwc
29 40 ogjjjjjjjgjgso.cc
30 40 jjjgggsssoooo
31 40 ggsooo
32 40 .........cwc
33 40 ........cc
35 38 ...........ooo
36 38 ........oolhjgo
37 38 .......oljjgso
38 38 ......olsoo.gso
39 38 jgo...oo...ogso
40 38 jjgo......ogjso
41 38 ogjjgo...ogjgso
42 38 .ojjjjjjjgssso...cc
43 38 oljjjjggsooo...cwc
44 38 jjgsooo.........c
45 34 oljjgso
46 34 jgso
'''

# Exposed support-leg rims use existing g; s/o remain on their undersides.
# These are independent coordinates read from each actual pose, not generated.
PATCHES['idle_a'] = '''
48 17 gso
49 18 gso
50 19 gso
51 20 gso
52 20 gso
53 20 gso
54 20 gso
55 20 gso
56 19 gso
57 18 oggo
50 37 gso
51 38 gso
52 39 gso
53 39 gso
54 38 gso
55 37 gso
56 36 gso
57 35 gso
58 34 oggo
'''
PATCHES['idle_b'] = '''
48 17 gso
49 18 gso
50 19 gso
51 20 gso
52 20 gso
53 20 gso
54 20 gso
55 20 gso
56 19 gso
57 18 oggo
50 37 gso
52 39 gso
54 38 gso
56 36 gso
57 35 gso
58 34 oggo
'''
PATCHES['idle_c'] = '''
48 17 gso
49 18 gso
50 19 gso
51 20 gso
52 20 gso
53 20 gso
54 20 gso
55 20 gso
56 19 gso
57 18 oggo
50 37 gso
52 39 gso
54 38 gso
56 36 gso
57 35 gso
58 34 oggo
'''
PATCHES['windup'] = '''
48 20 gso
50 21 gso
52 21 gso
53 21 gso
54 20 gso
55 19 oggo
50 37 gso
52 39 gso
54 38 gso
56 36 gso
57 35 gso
58 34 oggo
'''
PATCHES['move'] = '''
48 12 gso
49 13 gso
50 14 gso
51 15 gso
52 16 gso
53 17 gso
54 18 gso
55 19 gso
56 19 oggo
50 40 gso
52 43 gso
54 41 gso
56 39 gso
57 38 oggo
'''
PATCHES['attack'] = '''
48 13 gso
49 14 gso
50 15 gso
51 16 gso
52 17 gso
53 18 gso
54 19 gso
55 20 gso
56 20 oggo
50 41 gso
52 44 gso
54 43 gso
56 41 gso
57 40 gso
58 39 oggo
'''
PATCHES['recover'] = '''
48 18 gso
49 19 gso
50 20 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 21 gso
56 20 gso
57 19 oggo
50 38 gso
52 40 gso
54 39 gso
56 37 gso
57 36 gso
58 35 oggo
'''
PATCHES['hit'] = '''
48 16 gso
49 17 gso
50 18 gso
51 19 gso
52 19 gso
53 19 gso
54 19 gso
55 19 gso
56 18 gso
57 17 oggo
50 36 gso
52 38 gso
54 37 gso
56 35 gso
57 34 gso
58 33 oggo
'''
PATCHES['skill_a'] = '''
48 19 gso
50 21 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 20 gso
56 19 oggo
50 39 gso
52 40 gso
54 39 gso
56 37 gso
57 36 oggo
'''
PATCHES['skill_b'] = '''
48 12 gso
49 13 gso
50 14 gso
51 15 gso
52 16 gso
53 17 gso
54 18 gso
55 19 gso
56 19 oggo
50 42 gso
52 41 gso
54 39 gso
56 37 gso
57 36 oggo
'''
PATCHES['skill_c'] = '''
48 17 gso
49 18 gso
50 19 gso
51 20 gso
52 20 gso
53 20 gso
54 20 gso
55 20 gso
56 19 gso
57 18 oggo
50 37 gso
52 39 gso
54 38 gso
56 36 gso
57 35 gso
58 34 oggo
'''

PATCHES['skill_a'] += '''
21 40 o
34 36 ..
35 35 ...
36 34 ...
'''
PATCHES['idle_a'] += '''
21 40 ggoo
'''
PATCHES['idle_b'] += '''
21 41 goo
'''
PATCHES['idle_c'] += '''
22 40 oo
'''
PATCHES['windup'] += '''
16 42 jo
17 42 jo
18 42 o
'''
PATCHES['move'] += '''
22 42 jjjjjggjo
23 42 ljjggjo
24 42 ggoo
25 42 o
'''

PATCHES['poison_a'] = '''
25 40 olso
26 41 ljgso
40 33 lj
41 33 jg
48 18 gso
50 20 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 21 gso
56 20 gso
57 19 oggo
50 38 gso
52 40 gso
54 39 gso
56 37 gso
58 35 oggo
'''
PATCHES['poison_b'] = '''
26 39 olso
27 40 ljgso
42 33 lj
43 33 jg
48 18 gso
50 20 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 21 gso
56 20 gso
57 19 oggo
50 38 gso
52 40 gso
54 39 gso
56 37 gso
58 35 oggo
'''
PATCHES['stun_a'] = '''
43 38 lj
44 37 lj
45 36 jg
46 35 gs
48 18 gso
50 20 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 21 gso
56 20 gso
57 19 oggo
50 38 gso
52 40 gso
54 39 gso
56 37 gso
58 35 oggo
'''
PATCHES['stun_b'] = '''
43 39 lj
44 38 lj
45 37 jg
46 36 gs
48 18 gso
50 20 gso
51 21 gso
52 21 gso
53 21 gso
54 21 gso
55 21 gso
56 20 gso
57 19 oggo
50 38 gso
52 40 gso
54 39 gso
56 37 gso
58 35 oggo
'''
PATCHES['sleep_a'] = '''
50 38 lj
51 36 lj
52 16 gso
54 15 gso
56 17 gso
57 18 gso
58 19 oggo
56 33 gso
58 33 gso
'''
PATCHES['sleep_b'] = '''
50 38 lj
51 36 lj
52 16 gso
54 15 gso
56 17 gso
57 18 gso
58 19 oggo
56 33 gso
58 33 gso
'''

# Remove specific former blade continuations below the newly chosen elbows.
# The retained oso strings are the original far support legs at these rows.
TAILS['idle_a'] += '''
44 36 ...osgggso
45 34 .
46 32 .
47 34 .
48 31 ..oso
49 32 ...oso
'''
TAILS['idle_b'] += '''
44 37 ...osgggso
45 35 .
46 33 .
47 34 .
48 32 .oso
49 33 ..oso
'''
TAILS['idle_c'] += '''
45 36 ...osggggso
46 33 .
47 34 .
48 31 ..oso
49 32 ...oso
'''
TAILS['windup'] += '''
43 34 .
44 35 .
'''
TAILS['recover'] += '''
45 36 ....osggggso
46 34 .
47 35 .
48 37 .
'''
TAILS['hit'] += '''
43 36 .osgggso
44 35 .
45 34 .
46 33 .
47 33 .
48 35 .
'''
TAILS['skill_a'] += '''
41 36 .osgggso
42 35 .
43 34 .
44 33 .
45 33 .
46 31 .oso
47 32 ..oso
'''
TAILS['skill_c'] += '''
44 38 .osgggso
45 34 .
46 32 .
47 31 oso
48 31 ..oso
49 32 ...oso
'''
PATCHES['skill_c'] += '''
44 54 c
'''
PATCHES['attack'] += '''
37 30 .
38 27 ......
39 27 ........
40 29 .......
41 33 ....
'''

def apply(name, block, tail=False):
    folder = 'poses' if (ROOT/'poses'/f'{name}.pxgrid').exists() else 'actions'
    path = ROOT/folder/f'{name}.pxgrid'
    rows = path.read_text().splitlines()
    for line in block.strip().splitlines():
        if not line.strip():
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        if tail:
            pixels = pixels.ljust(63-x, '.')
        rows[y] = rows[y][:x] + pixels + rows[y][x+len(pixels):]
    path.write_text('\n'.join(rows)+'\n', encoding='ascii')

if __name__ == '__main__':
    # Literal before-repair grids are restored for reproducible coordinate edits.
    for folder in ('poses', 'actions'):
        for original in (ROOT/'original'/folder).glob('*.pxgrid'):
            (ROOT/folder/original.name).write_text(original.read_text(), encoding='ascii')
    for name, block in TAILS.items():
        apply(name, block, tail=True)
    for name, block in PATCHES.items():
        apply(name, block)
    # Current bounded visual revision, recorded as individually chosen pixels.
    import runpy
    runpy.run_path(str(ROOT/'scissors_revision.py'), run_name='__main__')

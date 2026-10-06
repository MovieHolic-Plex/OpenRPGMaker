"""Literal native row authoring. No geometry, frame transforms, fill or shading.
Each record is y, x, and the exact native pixel string chosen by the artist.
Padding merely serializes the transparent 96x96 canvas. Final pxgrids are canonical.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent
CELL = 96

def rows(block):
    canvas = [['.'] * CELL for _ in range(CELL)]
    for line in block.strip().splitlines():
        if not line.strip():
            continue
        ys, xs, ink = line.split()
        y, x = int(ys), int(xs)
        if not (0 <= y < CELL and 0 <= x and x + len(ink) <= CELL):
            raise ValueError(line)
        canvas[y][x:x + len(ink)] = list(ink)
    return canvas

def revise(canvas, block, clear_rows=()):
    result = [line[:] for line in canvas]
    for y in clear_rows:
        result[y] = ['.'] * CELL
    for line in block.strip().splitlines():
        if not line.strip():
            continue
        ys, xs, ink = line.split()
        y, x = int(ys), int(xs)
        if not (0 <= y < CELL and 0 <= x and x + len(ink) <= CELL):
            raise ValueError(line)
        result[y][x:x + len(ink)] = list(ink)
    return result

def save(name, canvas, action=False):
    target = ROOT / ('actions' if action else 'poses') / (name + '.pxgrid')
    target.write_text('\n'.join(''.join(line) for line in canvas) + '\n', encoding='ascii')

# Pine crown: three irregular bough tiers. Native needles, no shape masks.
# Face: warm left cheek, narrow gold eyes, protruding right brow/nose.
IDLE_A = rows('''
9 43 gng
10 42 gnlng
11 40 gnnlanvg
12 39 gnlallnvg
13 36 gnggnlaalnnvg
14 35 gnlngnllalnnnvg
15 34 gnllnlnlaallnnnvg
16 30 ggnggnlalnnnllnnnvvgg
17 29 gnlnlnallnnvnnlnnvnvng
18 27 gnlalnlallnnvgnnlnnnnnvg
19 23 gngggnlallnnnvvgnnlnnnnvvgg
20 20 gnggnlanlllnnnvvggnnllnnnnnvg
21 19 gnlalnlaalllnnnvvggnnllnnvvnng
22 16 gnggnlaallnllnnnnvggnlnlnnnnvvg
23 15 gnllnnlallnnnnnnvvggnlallnnnnvvggg
24 14 gnlaalnnllnnnnnnnvvvgnlallnnnnnvvng
25 17 gnllnnnvnnnnnnvvvvgggnllnnnnnvvvng
26 15 ggnllnnnnnvvvvvgggggknlnnlnnnnvvg
27 13 gnnlnllnnnvvvggggbkrrbggnnllnnnnnvgg
28 14 gnlaalnnnnvvvggbkrrssbggnllalnnnnnvvng
29 16 gnlllnnnvvgggbrrssshrrggnllnnnnnnvvvng
30 18 gnlnnnvvggbrrssshhhsrrbggnnnnnnvvvvgg
31 20 gnnvvggkbrrsshhihhsrrbbkggnvvvvvgg
32 23 gggkbrrsshhihhssrrbbbkggggg
33 25 okbrrsshihhssrrrbbkggnvgg
34 24 gnvgkbrrshhhssrrrbbggnlnvgg
35 22 gnlnngkbrrshhssrrrbbggnlalnvgg
36 20 gnlallnvgkrrshhssrrbggnllnnnnvgg
37 18 gnllnnnvvgbrrshhssrrbbgnlnnnnnvvng
38 17 gnnnnvvvvgbrrshhssrrrbbgnnnnnvvvvng
39 20 ggvvvgggokrrshhssrrrbbkggvvvvgg
40 23 gggg...okrrshhssrrrrbbko.gggg
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbbkrrbbbo
45 34 orshhsrrbkkrbbbbbo
46 34 orshhsbkkrrbkkbbbo
47 34 orshhsbkeerrbekbbo
48 34 orshhsskeeerrbeebbo
49 34 orshhssrkkrrbkbbrrbo
50 34 orshhssrrsrrbbbrssro
51 34 orshhssrrsrrbbbkbbbo
52 34 orshhssrrsrrbkkbbbo
53 34 orshhssrrkkkrrbbbko
54 34 orshhssrrrssrrbbbko
55 34 okrshhssrrrrrbbbko
56 34 okrshhssrrrbbbbko
57 33 okrrshssrrrbbbbkko
58 30 ookrrshhssrrrbbbbkkboo
59 28 okrrsshhssrrrrbbbbkkrrbko
60 26 okrrsshhssrrrrrbbbkkrrssrbko
61 24 okrrsshhssrrrrrrbbkkrrshssrbko
62 23 orrssbbrrssrrrrrbbkkrrshhssrbbo
63 22 orrssbbkrrssrrrbbbkkrrshssrrbbo
64 21 orrssbbkrrssrrrbbbk.krrshssrrbbo
65 20 orrssbbkoorrssrrbbko..krrshssrrbbo
66 19 orrssbbko.orrssrrbbko...krrshssrrbbo
67 18 orrssbbko..orrssrrbbko....krrshssrrbbo
68 17 orrssbbko...orrssrrbbko.....krrshssrrbbo
69 16 orssrbko....orrssrrbbko......krrshssrrbbo
70 15 orssrbko.....orrssrrbbko.....orrshssrrbbo
71 14 orsshbko......orrssrrbbko...orrshssrrbbko
72 13 orssrbko.......orrssrrbbko.orrshssrrbbko
73 12 orsrbko........orrssrrbbkokrrshssrrbbko
74 12 okrbko.........orrssrrbbkrrshssrrbbko
75 13 oko...........okrrssrrrbbkkkrrrbbbko
76 27 okrrssrrrrbbkkkrrrbbbko
77 27 orrssrrrrbbkkkkrrrbbbko
78 27 orrssrrrrbbk..kkrrrbbbko
79 27 orrssrrrbbko...krrrbbbko
80 26 orrssrrrbbko....krrrbbbko
81 25 orrssrrrbbko.....krrrbbbko
82 24 orrssrrrbbko......krrrbbbko
83 23 orrssrrrbbko.......krrrbbbko
84 23 orssrrrbbko.........krrrbbbo
85 22 orssrrbbko...........krrrbbbo
86 21 orssrrbbko............krrrbbbo
87 21 orssrrbbko............krrrssbbko
88 20 orssrrbbko............okrrssrrbbkoo
89 18 ookrssrrbbko...........orrssrrrrrbbko
90 17 orsshhssrrbbko........orrssrrrrrrbbko
91 17 orrssssrrrbbbko......okrrssrrbbkkbko
92 18 ookkkkkkkkkkoo.......ookkkkkko..oo
''')
save('idle_a', IDLE_A)
# Direct additions: crown right boughs, left needle tips, wrist/finger twigs.
IDLE_A = revise(IDLE_A, '''
13 53 gng
14 52 gnlnvg
15 50 gnllalnvg
16 50 gnllalnnvgg
17 49 gnnlallnnnvg
18 49 gnnllalnnnnvgg
19 50 gnllallnnnnnvvg
20 51 gnllallnnnvnnnvg
21 53 gnllalnnvgnllnvgg
22 53 gnnllnnvgnllalnnvg
23 55 gnllnnvgnllallnnnvgg
24 56 gnnnvvgnllallnnnnvng
25 57 gnnvggnlllnnnnnnvvng
26 57 gnvggnnlnnnnnnvvvgg
27 57 gggnnlnnnnnvvvvgg
28 58 gnnlallnnnvvg
29 59 gnllalnnnnvvg
30 60 gnllnnnnnnvvgg
31 61 gnnnnnnnnvvvng
32 60 gnnllnnnnnvvng
33 58 ggnllallnnnnvvgg
34 57 gnnllallnnnnnvng
35 57 gnnlllnnnnnnvvgg
36 59 gnnlnnnnnvvvvgg
37 62 gnnnnvvvvgg
38 65 ggvvvgg
24 10 gngg
25 11 gnlng
26 12 gnnnv
35 15 gngg
36 14 gnlnvg
37 12 gnnllnvg
38 13 gnnnnvvg
39 14 ggvvvgg
69 12 obo
70 12 orsbo
71 12 orssbo
72 10 oborsrbko
73 10 orrsrsbko
74 11 orrbsrbko
75 12 okkbkbo
76 14 oo
73 51 orrbko
74 52 orrsbko
75 53 orhsrbko
76 54 orssbko
77 53 obrsbko
78 51 okkkbo
79 51 oo.oo
''')
save('idle_a', IDLE_A)

# The head stays planted during breathing; crown tip clusters and cambium ribs change.
IDLE_B = revise(IDLE_A, '''
9 43 ...
10 42 gngng
11 40 gnnllng
12 39 gnllalnvg
18 64 nlnvg
19 63 nllnnvg
20 64 nnnvvgg
37 12 gnlalnvg
38 13 gnllnvvg
47 34 orshhsbkeerrbekbbo
48 34 orshhsskeeerrbeebbo
54 34 orshhssrrrssrrbbbko
55 33 okrrshhssrrrrrbbbko
56 33 okrrshhhssrrrbbbbko
57 32 okrrshhhssrrrbbbbkko
58 30 ookrrshhhssrrrbbbbkkboo
59 28 okrrsshhssrrrrbbbbkkrrbko
60 26 okrrsshhhssrrrrbbbkkrrssrbko
61 24 okrrsshhhssrrrrrbbkkrrshssrbko
62 23 orrssbbrrsssrrrrbbkkrrshhssrbbo
63 22 orrssbbkrrsssrrbbbkkrrshssrrbbo
64 21 orrssbbkrrsssrrbbbk.krrshssrrbbo
65 20 orrssbbkoorrsssrrbbko..krrshssrrbbo
66 19 orrssbbko.orrsssrrbbko...krrshssrrbbo
67 18 orrssbbko..orrsssrrbbko....krrshssrrbbo
68 17 orrssbbko...orrsssrrbbko.....krrshssrrbbo
69 28 orrsssrrbbko
70 29 orrsssrrbbko
71 30 orrsssrrbbko
72 31 orrsssrrbbko
''')
save('idle_b', IDLE_B)
IDLE_C = revise(IDLE_A, '''
9 43 gvg
10 42 gnnng
11 40 gnnlalvg
12 39 gnlaallnvg
13 36 gnggnlaallnvg
16 50 gnllallnvgg
23 55 gnlllnvgnllallnnnvgg
24 56 gnnnvvgnaallllnnnvng
25 57 gnnvggnllallnnnnvvng
36 59 gnnlnnnnnnvvvgg
45 34 orshhsrrbkkrrbbbo
46 34 orshhsbkrrrbkkbbbo
47 34 orshhsbkeerrbekbbo
48 34 orshhsskeerrrbeebbo
50 34 orshhssrssrrbbbrssro
51 34 orshhssrrsrrbbbkbbbo
62 23 orrssbbrrssrrrrbbkkrrshhssrbbo
63 22 orrssbbkrrssrrrbbkkrrshhssrrbbo
64 21 orrssbbkrrssrrrbbkkkrrshssrrbbo
65 20 orrssbbkoorrssrrbbko.krrshssrrbbo
66 19 orrssbbko.orrssrrbbko..krrshssrrbbo
67 18 orrssbbko..orrssrrbbko...krrshssrrbbo
68 17 orrssbbko...orrssrrbbko....krrshssrrbbo
69 16 orssrbko....orrssrrbbko.....krrshssrrbbo
70 15 orssrbko.....orrssrrbbko....orrshssrrbbo
71 14 orsshbko......orrssrrbbko..orrshssrrbbko
72 13 orssrbko.......orrssrrbbkookrrshssrrbko
73 51 orhsrbko
74 52 orssrbko
75 53 orssrbko
76 54 orrbko
77 53 obrbko
''')
save('idle_c', IDLE_C)

# Windup: SAME near arm folds across the chest toward the left/rear, elbow raised.
# The far arm hangs behind, and the rear root crouches into a wider support.
WINDUP = revise(IDLE_A, '''
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbkkrrbbbo
45 34 orshhsrrbkkrbbbbbo
46 34 orshhsbkkrrbkkbbbo
47 34 orshhsbkerrrbekbbo
48 34 orshhsskeerrrbeebbo
49 34 orshhssrkkrrbkbbrrbo
50 34 orshhssrssrrbbbrssro
51 34 orshhssrrsrrbbbkbbbo
52 34 orshhssrrsrrbkkbbbo
53 34 orshhssrrkkkrrbbbko
54 23 obo.......orshhssrrrssrrbbbko
55 21 obrrbo.....okrshhssrrrrrbbbko
56 20 orshrbbo....okrshhssrrrbbbbko
57 18 obrrshrbboo.okrrshssrrrbbbbkko
58 17 orrsshhssrrbkrrshhssrrrbbbbkkboo
59 18 orsshhssrrrbbkrrhhssrrrrbbbkkrrrbo
60 20 orsshhssrrrbkrrsshhssrrrbbbkkrrssrbo
61 21 orrrsshhssrrbkrrsshhssrrbbbkkrrshsrbo
62 23 okrrsshhssrrrbbrrshhssrrbbkkrrshsrbo
63 24 okrrrsshhssrrrbbbrrshhssrrbkkrrshsrbo
64 25 orrssbkkrrsshhssrrrbbrrshssrrkrrshsrbo
65 24 orrssbko.okrrsshhssrrbbrrssrrbkrssrbo
66 23 orrssbko..okrrrssssrrrbbrrssrbkrrrbko
67 22 orrssbko....okrrrssrrrrbbrrssrrbkkbko
68 21 orrssbko.....okrrssrrrrbbbrrssrrbko
69 20 orrssbko.......orrssrrrrbbrrssrrbko
70 19 orrssbko........orrssrrrbbbrrssrrbko
71 18 orsshbko.........orrssrrrbbbrrssrrbko
72 17 orssrbko..........orrssrrrbbrrssrrbko
73 16 orrsrbko..........okrrssrrrbbrrssrrbko
74 16 okrrbko..........okrrssrrrbbbrrssrrbko
75 17 okkko..........okrrssrrrrbbbbrrssrrbko
76 30 orrssrrrrbbbkkkrrrssrrbko
77 29 orrssrrrrbbbkk..krrrssrrbko
78 28 orrssrrrbbbko....krrrssrrbko
79 27 orrssrrrbbbko.....krrrssrrbko
80 26 orrssrrrbbbko......krrrssrrbko
81 25 orrssrrrbbbko.......krrrssrrbko
82 24 orrssrrrbbbko........krrrssrrbko
83 23 orssrrrbbbko..........krrrssrrbko
84 23 orssrrbbbko............krrrssrrbko
85 22 orssrrbbbko.............krrrssrrbko
86 21 orssrrbbbko..............krrrssrrbko
87 20 orssrrbbbko...............krrrssrrbko
88 19 orssrrbbbko................krrssrrbko
89 17 ookrssrrbbbko...............orrssrrbkoo
90 16 orsshhssrrbbko.............orrssrrrbbko
91 16 orrssssrrrbbbko...........okrrssrrbbbko
92 17 ookkkkkkkkkkoo............ookkkkkkkkkko
''', clear_rows=range(43,93))
save('windup', WINDUP)

# Forward hop/step: compressed back root pushes, near root lifts with a bent knee.
# Raised attack branch now unfolds OVER its own right shoulder (not an arm swap).
MOVE = revise(IDLE_A, '''
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbkkrrbbbo................obo
45 34 orshhsrrbkkrbbbbbo...............orbo
46 34 orshhsbkkrrbkkbbbo.............obrsrbo
47 34 orshhsbkerrrbekbbo...........obrrshsrbo
48 34 orshhsskeerrrbeebbo........obrrsshhssrbo
49 34 orshhssrkkrrbkbbrrbo....obrrsshhssrrbko
50 34 orshhssrssrrbbbrssro...orrsshhssrrrbko
51 34 orshhssrrsrrbbbkbbbo..orrsshhssrrrbko
52 34 orshhssrrsrrbkkbbbo..orrsshhssrrrbko
53 34 orshhssrrkkkrrbbbko.orrsshhssrrrbko
54 34 orshhssrrrssrrbbbkokrrsshhssrrrbko
55 34 okrshhssrrrrrbbbkrrsshhssrrrbko
56 34 okrshhssrrrbbbkrrsshhssrrrbko
57 34 okrrshssrrrbbkrrsshhssrrrbko
58 32 okrrshhssrrrbbkrrsshhssrrrbko
59 30 okrrsshhssrrrrbbkrrsshhssrrbko
60 29 orrsshhssrrrrrbbkkrrrssssrrbko
61 28 orrsshhssrrrrrrbbkkrrrssrrbko
62 27 orrssbbrrssrrrrrbbkkrrrbko
63 26 orrssbbkrrssrrrrrbbkooko
64 25 orrssbbkoorrssrrrrrbbko
65 24 orrssbbko.orrssrrrrrbbko
66 23 orrssbbko..orrssrrrrrbbko
67 22 orrssbbko...orrssrrrrrbbko
68 21 orrssbbko....orrssrrrrrbbko
69 20 orrssbbko.....orrssrrrrrbbko
70 19 orsshbko......orrssrrrrrbbko
71 18 orssrbko.......orrssrrrrrbbko
72 18 orrsrbko.......okrrssrrrrrbbko
73 19 okrrbko.......okrrssrrrrrrbbko
74 20 okkko.......okrrssrrrrrrrbbko
75 31 orrssrrrrrbbkkkrrrssrrbko
76 30 orrssrrrrbbkkkrrrsshhssrbko
77 29 orrssrrrbbkkkrrrsshhssrrbko
78 28 orrssrrrbbkokrrrsshhssrrrbko
79 27 orrssrrrbbko.krrrssssrrrbbko
80 26 orrssrrrbbko..okrrrssrrrbbko
81 25 orrssrrrbbko...ookrrssrrrbko
82 24 orrssrrrbbko......okrrssrrbko
83 23 orssrrrbbko........okrrssrrbko
84 22 orssrrrbbko.........okrrssrrbko
85 21 orssrrbbbko..........okrrssrrbko
86 20 orssrrbbbko...........okrrssrrbko
87 19 orssrrbbbko............okrrssrrbko
88 18 orssrrbbbko.............okrrssrbkoo
89 17 orssrrbbbko..............okrrssrrrbko
90 16 orsshhssrrbko..............okrrrrrbko
91 16 orrssssrrbbko................okkkko
92 17 ookkkkkkkkoo
''', clear_rows=range(41,93))
save('move', MOVE)

# Contact: near shoulder drops, elbow/wrist flex forward; broad split-branch hand.
# The front root plants at y92 while the rear root is visibly pushing behind.
ATTACK = revise(IDLE_A, '''
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbbkrrbbbo
45 34 orshhsrrbkkrrbbbbo
46 34 orshhsbkkrrrbkkbbbo
47 34 orshhsbkerrrrbekbbo
48 34 orshhsskeerrrrbeebbo
49 34 orshhssrkkrrrbkbbrrbo
50 34 orshhssrssrrrbbbrssro
51 34 orshhssrrsrrrbbbkbbbo
52 34 orshhssrrsrrrbkkbbbo
53 34 orshhssrrkkkrrrbbbko
54 34 orshhssrrrssrrrbbbko
55 34 okrshhssrrrrrrbbbko
56 35 okrshhssrrrrrbbbbko
57 35 okrrshssrrrrrbbbbkko
58 34 okrrshhssrrrrrbbbbkkboo
59 33 okrrsshhssrrrrrbbbbkkrrbkoo
60 32 orrsshhssrrrrrrbbbkkrrssrrbkoo
61 31 orrsshhssrrrrrrrbbkkrrshhssrrbko
62 30 orrssbbrrssrrrrrrbbkkrrshhhssrrbko
63 29 orrssbbkrrssrrrrrbbkkrrshhhssrrbko
64 28 orrssbbkoorrssrrrrbbkkrrrsshhssrrbko
65 27 orrssbbko.orrssrrrrbbko.krrrsshhssrrbko
66 26 orrssbbko..orrssrrrrbbko..krrrsshhssrrbko
67 25 orrssbbko...orrssrrrrbbko...krrrsshhssrrbko
68 24 orrssbbko....orrssrrrrbbko....krrrsshhssrrbko
69 23 orrssbbko.....orrssrrrrbbko.....krrrsshhssrrbko
70 22 orsshbko......orrssrrrrbbko......krrrsshhssrrbko
71 21 orssrbko.......orrssrrrrbbko.......krrrsshhssrrbko
72 21 orrsrbko.......okrrssrrrrbbko.......krrsshhssrrbko
73 22 okrrbko.......okrrssrrrrrbbko......orrsshhssrrrbko
74 23 okkko.......okrrssrrrrrrrbbko.....orrsshhssrrrbko
75 34 orrssrrrrrrbbkkkrrrssrrbko...orrsshhssrrrbko
76 33 orrssrrrrrbbkkkrrrsshhssrbko..orrsshhssrrrbko
77 32 orrssrrrrbbkk..krrrsshhssrbko..orrsshhssrrbko
78 31 orrssrrrrbbko...krrrsshhssrbko..orrsshhssrrbko
79 30 orrssrrrrbbko....krrrsshhssrbko..orrsshhssrrbko
80 29 orrssrrrrbbko.....krrrsshhssrbko..orrsshssrrbkoo
81 28 orrssrrrrbbko......krrrsshhssrbko..orshhhssrrrbko
82 27 orrssrrrrbbko.......krrrsshhssrbko..orshhissrrrbko
83 26 orssrrrrbbko.........krrrsshhssrbko..orrssshsrrrbkoo
84 25 orssrrrbbko...........krrrsshhssrbko..okrrssrrbkkrrbko
85 24 orssrrrbbko............krrrsshhssrbko..okrrrbko..okrrbko
86 23 orssrrrbbko.............krrrsshhssrbko..okkbko....okbko
87 22 orssrrrbbko..............krrrsshhssrbko...oo.......oo
88 21 orssrrrbbko...............krrrsshhssrbko
89 20 orssrrrbbko................orrsshhssrrbkoo
90 18 ookrssrrrbbko...............orrsshhssrrrrbko
91 17 orsshhssrrbbbko............okrrsshhssrrrbbko
92 18 ookkkkkkkkkkoo..............ookkkkkkkkkkkkkko
''', clear_rows=range(41,93))
save('attack', ATTACK)

# Recovery: elbow draws back, branch fingers loosen; forward root begins to curl.
RECOVER = revise(IDLE_A, '''
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbbkrrbbbo
45 34 orshhsrrbkkrrbbbbo
46 34 orshhsbkkrrrbkkbbbo
47 34 orshhsbkeerrrbekbbo
48 34 orshhsskeeerrrbeebbo
49 34 orshhssrkkrrrbkbbrrbo
50 34 orshhssrssrrrbbbrssro
51 34 orshhssrrsrrrbbbkbbbo
52 34 orshhssrrsrrrbkkbbbo
53 34 orshhssrrkkkrrrbbbko
54 34 orshhssrrrssrrrbbbko
55 34 okrshhssrrrrrrbbbko
56 34 okrshhssrrrrrbbbbko
57 34 okrrshssrrrrrbbbbkko
58 32 okrrshhssrrrrrbbbbkkboo
59 30 okrrsshhssrrrrrbbbbkkrrbkoo
60 28 orrsshhssrrrrrrbbbkkrrssrrbkoo
61 26 orrsshhssrrrrrrrbbkkrrshhssrrbko
62 25 orrssbbrrssrrrrrrbbkkrrshhhssrrbko
63 24 orrssbbkrrssrrrrrbbkkrrshhhssrrbko
64 23 orrssbbkoorrssrrrrbbkkrrrsshhssrrbko
65 22 orrssbbko.orrssrrrrbbko.krrrsshhssrrbko
66 21 orrssbbko..orrssrrrrbbko..krrrsshhssrrbko
67 20 orrssbbko...orrssrrrrbbko...krrrsshhssrrbko
68 19 orrssbbko....orrssrrrrbbko....krrrsshhssrrbko
69 18 orrssbbko.....orrssrrrrbbko....orrsshhssrrrbko
70 17 orsshbko......orrssrrrrbbko...orrsshhssrrrbko
71 16 orssrbko.......orrssrrrrbbko.orrsshhssrrrbko
72 16 orrsrbko.......okrrssrrrrbbkokrrsshhssrrbko
73 17 okrrbko.......okrrssrrrrrbbkkrrsshhssrrbko
74 18 okkko.......okrrssrrrrrrrbbkkrrsshhssrbko
75 29 orrssrrrrrrbbkkkrrrssrrbkookrrsshhssrbko
76 28 orrssrrrrrbbkkkrrrssrrbko...okrrssrrbko
77 28 orrssrrrrbbkk..krrrssrrbko....okrrsbko
78 27 orrssrrrrbbko...krrrssrrbko.....okbko
79 26 orrssrrrrbbko....krrrssrrbko......oo
80 25 orrssrrrbbko......krrrssrrbko
81 24 orrssrrrbbko.......krrrssrrbko
82 23 orrssrrrbbko........krrrssrrbko
83 22 orssrrrbbko..........krrrssrrbko
84 22 orssrrbbbko...........krrrssrrbko
85 21 orssrrbbbko............krrrssrrbko
86 20 orssrrbbbko.............krrrssrrbko
87 20 orssrrbbbko..............krrrssrrbko
88 19 orssrrbbbko...............orrssrrbkoo
89 18 orssrrbbbko...............orrssrrrbbko
90 16 ookrsshhssrrbko...........orrssrrrbbko
91 16 orrssssrrrbbbko..........okrrssrrbbbko
92 17 ookkkkkkkkkkoo...........ookkkkkkkkko
''', clear_rows=range(43,93))
save('recover', RECOVER)
# Hit: forehead recoils, far shoulder lifts, near arm is thrown outward.
HIT = revise(IDLE_A, '''
29 16 gnlllnnnvvgggbrrssshrrggnllnnnnnnvvvng
30 18 gnlnnnvvggbrrssshhssrrbggnnnnnnvvvvgg
31 20 gnnvvggkbrrsshhihhssrrbbkggnvvvvvgg
32 23 gggkbrrsshhihhssrrbbbkggggg
33 24 okbrrsshihhssrrrbbkggnvgg
34 23 gnvgkbrrshhhssrrrbbggnlnvgg
35 21 gnlnngkbrrshhssrrrbbggnlalnvgg
36 19 gnlallnvgkrrshhssrrbggnllnnnnvgg
37 17 gnllnnnvvgbrrshhssrrbbgnlnnnnnvvng
38 16 gnnnnvvvvgbrrshhssrrrbbgnnnnnvvvvng
39 18 ggvvvgggokrrshhssrrrbbkggvvvvgg
40 21 gggg..okrrshhssrrrrbbko.gggg
41 31 okrsshhssrrrrrbbko
42 30 orsshhissrrrrrbbko
43 29 orshhihssrrbrrbbko
44 28 orshhssrrbbkrrbbbo
45 28 orshhsrrbkkrrbbbbo
46 28 orshhsbkkrrrbkkbbbo
47 28 orshhssrrbkkrrrbbbo
48 28 orshhssrbkkrrbkkbbbo
49 28 orshhssrbbrrrbbbrbbo
50 29 orshhssrssrrrbbbssro
51 29 orshhssrrsrrrbbbkbbbo
52 30 orshhssrrsrrrbkebbbo
53 30 orshhssrrrkkkrebebko
54 30 orshhssrrrsrrrebbko
55 30 okrshhssrrrrrrbbbko
56 30 okrshhssrrrrrbbbbko
57 30 okrrshssrrrrrbbbbkko
58 27 okrrshhssrrrrrbbbbkkboo
59 25 okrrsshhssrrrrrbbbbkkrrbkoo
60 23 orrsshhssrrrrrrbbbkkrrssrrbko
61 21 orrsshhssrrrrrrrbbkkrrshhssrbko
62 19 orrssbbrrssrrrrrrbbkkrrshhhssrbko
63 18 orrssbbkrrssrrrrrbbkkrrshhhssrrbko
64 17 orrssbbkoorrssrrrrbbkkrrrsshhssrrbko
65 16 orrssbbko.orrssrrrrbbko.krrrsshhssrrbko
66 15 orrssbbko..orrssrrrrbbko..krrrsshhssrrbko
67 14 orrssbbko...orrssrrrrbbko...krrrsshhssrrbko
68 13 orrssbbko....orrssrrrrbbko....krrrsshhssrrbkoo
69 12 orrssbbko.....orrssrrrrbbko.....krrrsshhssrrrbko
70 11 orsshbko......orrssrrrrbbko......krrrsshhssrrrbko
71 10 orssrbko.......orrssrrrrbbko.......okrrsshhssrrrbko
72 10 orrsrbko.......okrrssrrrrbbko........okrrsshhssrrrbkoo
73 11 okrrbko.......okrrssrrrrrbbko.........okrrsshhssrrrbko
74 12 okkko.......okrrssrrrrrrrbbko..........okrrsshhssrrbko
75 23 orrssrrrrrrbbkkkrrrssrrbko.............okrrssrrbko
76 24 orrssrrrrrbbkkkrrrssrrbko...............okrrrbko
77 24 orrssrrrrbbkk..krrrssrrbko................okkbko
78 25 orrssrrrrbbko...krrrssrrbko.................oo
79 25 orrssrrrrbbko....krrrssrrbko
80 25 orrssrrrbbko......krrrssrrbko
81 24 orrssrrrbbko.......krrrssrrbko
82 23 orrssrrrbbko........krrrssrrbko
83 22 orssrrrbbko..........krrrssrrbko
84 22 orssrrbbbko...........krrrssrrbko
85 21 orssrrbbbko............krrrssrrbko
86 20 orssrrbbbko.............krrrssrrbko
87 20 orssrrbbbko..............krrrssrrbko
88 19 orssrrbbbko...............orrssrrbkoo
89 18 orssrrbbbko...............orrssrrrbbko
90 16 ookrsshhssrrbko...........orrssrrrbbko
91 16 orrssssrrrbbbko..........okrrssrrbbbko
92 17 ookkkkkkkkkkoo...........ookkkkkkkkko
''', clear_rows=range(29,93))
# Right hanging bough is authored anew, not translated with the head.
HIT = revise(HIT, '''
30 61 gnllnnnnnvvgg
31 62 gnnnnnnnnvvng
32 61 gnnllnnnnnvvng
33 59 ggnllallnnnnvvgg
34 58 gnnllallnnnnnvng
35 58 gnnlllnnnnnnvvgg
36 60 gnnlnnnnnvvvvgg
37 63 gnnnnvvvvgg
38 65 ggvvvgg
''')
save('hit', HIT)

# Dead: a broken-kneed, sideways fallen trunk; head remains attached by warm wood.
# Crown is authored as spreading flattened boughs; root toes are separate at right.
DEAD = rows('''
48 27 gng
49 25 gnnlng
50 23 gnnllalvg
51 20 gnggnnllallnvg
52 18 gnlnnnllallnnvg........gng
53 16 gnlallllnnnnnvvg.....gnlnvg
54 14 gnlallnnnnnnnvvgg..gnllalnvg
55 12 gnlallnnnnnvvg.gnllnllallnnvgg
56 11 gnnllnnnnnvvg.gnllallllnnnnnvg
57 10 gnnllnnnvvgg.gnnllallnnnnnnnvvg
58 9 gnllnnnvvgg.gnnllallnnnnnnnnvvgg
59 10 gnnnnvvgg.gnnllallnnnnnnnnnvvng
60 11 gnnnvgg.gnnllallnnnnnnnnnnvvvng
61 12 gggg.gnllallnnnnnvvvgnnnnnvvvvgg
62 14 gggnnllallnnnnnvvggkrrbbggggg
63 12 gnnllallnnnnnnvvggbrrssrbko
64 11 gnlallnnnnnnnvvgbrrsshhssrbko
65 10 gnnllnnnnnnvvggbrrsshhihhssrbko
66 11 gnnlnnnnnvvggkbrrsshhihhhssrrbko
67 13 gnnnnnnvvg..okrrsshhihhhssrrbbko
68 15 ggvvvvgg...okrrsshhihhhssrrbbko
69 17 ggggg....okrrsshhihhhssrrrbbbkoo
70 22 gng...okrrsshhihhhssrrrbbbkkrrbkoo
71 20 gnlng.okrrsshhihhhssrrrbbbkkrrssrbkoo
72 18 gnnllnvgbrrsshhihhhssrrrbbbkkrrshhssrbko
73 17 gnlallnnvgbrrsshhhssrrrrbbbkkrrshhssrrbko
74 16 gnnllnnnvgbrrsshhssrrrbbbkkrrshhssrrrbko
75 17 gnnlnnvvgbrrsshhssrrrbbbkkrrshhssrrrbbko
76 19 gnnnvvggkbrrsshhssrrrbbbkkrrshhssrrbbko
77 21 ggvvggokrrsshhssrrrbbbkkrrshhssrrbbbkoo
78 24 gggokrrsshhssrrrbbbkkrrshhssrrbbkkrrbko
79 27 okrrsshhssrrrbbbkkrrshhssrrbbkkrrssrbko
80 28 orsshhssrrrbkkbbkkrrshhssrrbbkkrrshhsrbko
81 29 orshhssrrbbkbbbkkrrshhssrrbbkkrrshhssrbko
82 29 orshhssrrrbbbbbkkrrshhssrrbbkkrrshhssrrbko
83 29 orshhssrssrrbbbbkrrshhssrrbbkkrrshhssrrrbko
84 28 orshhssrssrrbbbbbrrshhssrrbbbkkrrshhssrrrbko
85 26 okrrsshhssrrbbbbbbrrshhssrrbbbbkkrrshhssrrbko
86 24 okrrsshhssrrbbbbbbbrrshhssrrrbbbbkkrrshhssrbko
87 22 okrrsshhssrrbbbbbbrrshhssrrrrbbbbkrrshhssrbko
88 20 okrrsshhssrrbbbbbbrrshhssrrrrrbbbkrrshhssrbko
89 18 okrrsshhssrrbbbbbbrrshhssrrrrrrbbbkrrshhssrbkoo
90 16 okrrsshhssrrbbbbbbrrshhssrrrrrrrbbbkrrshhssrrbko
91 15 okrrsshhssrrbbbbbbrrsshhssrrrrrrbbbkrrshhssrrbko
92 16 ookkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
''')
# Closed, dim eyes on fallen face, two folded branch arms and curled root tips.
DEAD = revise(DEAD, '''
79 34 sssbrrrbb
80 33 sshhbbrrrbb
81 33 sshhsrrbbrrb
82 33 sshhsrbbrsrrb
83 33 sshhsrrrbsrrb
84 33 sshhsrrrbsrrb
85 32 sshhsrrrssrrb
86 32 sshhsrrrssrrb
87 32 sshhssrrssrrb
80 66 obo
81 65 orrbo
82 64 orssrbo
83 63 orsssrbo
84 61 orsshsrrbo
85 59 orsshhssrrbkoo
86 58 orsshhssrrrbbko
87 60 okrrssrrbbkrrbko
88 62 okrrrbbko.okrrbko
89 65 okkko....okbko
90 66 oo......oo
88 76 obo
89 74 obrrbo
90 71 obrrssrboo
91 69 orrsshhssrrbko
92 70 ookkkkkkkkkko
''')
save('dead', DEAD)
# Skill preparation: upturned three-pronged branch hand gathers needle-shaped qi.
SKILL_A = revise(IDLE_A, '''
45 34 orshhsrrbkkrbbbbbo
46 34 orshhsbkkrrbkkbbbo
47 34 orshhsbkeerrbekbbo
48 34 orshhsskeeerrbeebbo
56 63 gtg....gng
57 63 gltg..gntg
58 62 gnltggnltg
59 61 gnnltwnltg
60 28 okrrsshhssrrrrrbbbkkrrssrbko..gnltwtlng
61 26 okrrsshhssrrrrrrbbkkrrshssrbko.gnlwtwlnvg
62 25 orrssbbrrssrrrrrbbkkrrshhssrbkornltwlrrbo
63 24 orrssbbkrrssrrrbbbkkrrshssrrbkorshhssrrbo
64 23 orrssbbkrrssrrrbbbk.krrshssrrbrrshhssrrbo
65 22 orrssbbkoorrssrrbbko..krrshssrrshhssrrrbko
66 21 orrssbbko.orrssrrbbko...krrshssrrshhssrrbko
67 20 orrssbbko..orrssrrbbko....krrshssrrshhssrbko
68 19 orrssbbko...orrssrrbbko.....krrrssssrrrbko
69 18 orssrbko....orrssrrbbko......krrrssrrbko
70 17 orssrbko.....orrssrrbbko......okrrrbko
71 16 orsshbko......orrssrrbbko.......okkko
72 15 orssrbko.......orrssrrbbko........oo
73 14 orsrbko........orrssrrbbko
74 14 okrbko.........orrssrrbbko
75 15 oko...........okrrssrrrbbkkkrrrbbbko
76 27 okrrssrrrrbbkkkrrrbbbko
77 27 orrssrrrrbbkkkkrrrbbbko
78 27 orrssrrrrbbk..kkrrrbbbko
79 27 orrssrrrbbko...krrrbbbko
''', clear_rows=range(56,80))
save('skill_a', SKILL_A, True)

# Cast: shoulder turns, branch straightens; three distinguishable pine-needle fans.
SKILL_B = revise(IDLE_A, '''
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbbkrrbbbo
45 34 orshhsrrbkkrrbbbbo
46 34 orshhsbkkrrrbkkbbbo
47 34 orshhsbkerrrrbekbbo
48 34 orshhsskeerrrrbeebbo
49 34 orshhssrkkrrrbkbbrrbo
50 34 orshhssrssrrrbbbrssro
51 34 orshhssrrsrrrbbbkbbbo
52 34 orshhssrrsrrrbkkbbbo
53 34 orshhssrrkkkrrrbbbko
54 34 orshhssrrrssrrrbbbko................obo
55 34 okrshhssrrrrrrbbbko..............obrrbo
56 34 okrshhssrrrrrbbbbko............obrrssrbo
57 35 okrrshssrrrrrbbbbkkoo.......obrrsshhssrbo
58 34 okrrshhssrrrrrbbbbkkrrbkooobrrsshhssrrbko
59 33 okrrsshhssrrrrrbbbbkkrrssrrbrrsshhssrrbko
60 32 orrsshhssrrrrrrbbbkkrrshhssrrsshhssrrrbko
61 31 orrsshhssrrrrrrrbbkkrrshhhssrsshhssrrbko
62 30 orrssbbrrssrrrrrrbbkkrrshhhssrsshhssrbko
63 29 orrssbbkrrssrrrrrbbkkrrrsshhssrsssrrbko
64 28 orrssbbkoorrssrrrrbbkkrrrssssrrrssrbko
65 27 orrssbbko.orrssrrrrbbko.okrrssrrrbko
66 26 orrssbbko..orrssrrrrbbko..okrrrbko
67 25 orrssbbko...orrssrrrrbbko...okkko
68 24 orrssbbko....orrssrrrrbbko....oo
69 23 orrssbbko.....orrssrrrrbbko
70 22 orsshbko......orrssrrrrbbko
71 21 orssrbko.......orrssrrrrbbko
72 21 orrsrbko.......okrrssrrrrbbko
73 22 okrrbko.......okrrssrrrrrbbko
74 23 okkko.......okrrssrrrrrrrbbko
75 34 orrssrrrrrrbbkkkrrrssrrbko
76 33 orrssrrrrrbbkkkrrrsshhssrbko
77 32 orrssrrrrbbkk..krrrsshhssrbko
78 31 orrssrrrrbbko...krrrsshhssrbko
79 30 orrssrrrrbbko....krrrsshhssrbko
80 29 orrssrrrrbbko.....krrrsshhssrbko
81 28 orrssrrrrbbko......krrrsshhssrbko
82 27 orrssrrrrbbko.......krrrsshhssrbko
83 26 orssrrrrbbko.........krrrsshhssrbko
84 25 orssrrrbbko...........krrrsshhssrbko
85 24 orssrrrbbko............krrrsshhssrbko
86 23 orssrrrbbko.............krrrsshhssrbko
87 22 orssrrrbbko..............krrrsshhssrbko
88 21 orssrrrbbko...............krrrsshhssrbko
89 20 orssrrrbbko................orrsshhssrrbkoo
90 18 ookrssrrrbbko...............orrsshhssrrrrbko
91 17 orsshhssrrbbbko............okrrsshhssrrrbbko
92 18 ookkkkkkkkkkoo..............ookkkkkkkkkkkkkko
''', clear_rows=range(41,93))
# Each fan has its own bright needle shaft and darker splayed needles.
# Three qi roots touch the three branch fingers at x71..75, y55..63.
SKILL_B = revise(SKILL_B, '''
42 89 gtg
43 87 gnltg
44 84 gngnltg
45 83 gnlngntg
46 81 gnltlnltg
47 79 gnltwlltg
48 78 gnlttwtlg
49 77 gnltwtlnlg
50 77 glttwlnlnvg
51 76 glttwlnnnvgg
52 75 gltwtlnnvgg
53 74 glttlnvgg
54 73 gtlnvgg
55 72 gtg...........gng
56 71 gtg.........gnltg
57 71 gnlg......gnlttwtg
58 72 gltg...gnlttwttwlg
59 73 glttttttwwwttwllnvg
60 73 gntlnllttttwllnnvvgg
61 74 gnvg..ggnllnnnvvgg
62 75 gntg....gggggggg
63 75 glttg
64 76 gnltlg
65 77 gnltwlg
66 78 gnlttwlg
67 79 gnltwtlnlg
68 80 gnlttwllnlg
69 81 gntltwtlnnlg
70 81 gnlnttwlnnnvg
71 82 gnvnlttwlnnvg
72 83 gggvnlttwlnvg
73 86 ggnltwlnvg
74 88 gnlttlg
75 90 gntg
''')
save('skill_b', SKILL_B, True)

# Recovery: branch folds inward; several needles crack and fall, no round aura.
SKILL_C = revise(IDLE_A, '''
45 34 orshhsrrbkkrbbbbbo
46 34 orshhsbkkrrbkkbbbo
47 34 orshhsbkeerrbekbbo
48 34 orshhsskeeerrbeebbo
58 30 ookrrshhssrrrbbbbkkboo
59 28 okrrsshhssrrrrbbbbkkrrbko
60 26 okrrsshhssrrrrrbbbkkrrssrbko
61 24 okrrsshhssrrrrrrbbkkrrshssrbko
62 23 orrssbbrrssrrrrrbbkkrrshhssrbbo
63 22 orrssbbkrrssrrrbbbkkrrshssrrbbo
64 21 orrssbbkrrssrrrbbbk.krrshssrrbbo
65 20 orrssbbkoorrssrrbbko..krrshssrrbbo
66 19 orrssbbko.orrssrrbbko...krrshssrrbbo
67 18 orrssbbko..orrssrrbbko....krrshssrrbbo
68 17 orrssbbko...orrssrrbbko.....krrshssrrbbo
69 16 orssrbko....orrssrrbbko.....orrshssrrbbo
70 15 orssrbko.....orrssrrbbko....orrshssrrbbo
71 14 orsshbko......orrssrrbbko..orrshssrrbbko
72 13 orssrbko.......orrssrrbbkokrrshssrrbbko
73 12 orsrbko........orrssrrbbkkrrshssrrbbko
74 12 okrbko.........orrssrrbbkkrrshssrrbko
75 13 oko...........okrrssrrrbbkkrrshssrbko
76 27 okrrssrrrrbbkkrrrssrbko
77 27 orrssrrrrbbkkrrrssrbko
78 27 orrssrrrrbbk..krrrbko
79 27 orrssrrrbbko...okkko
80 26 orrssrrrbbko....oo
''', clear_rows=range(58,81))
SKILL_C = revise(SKILL_C, '''
62 74 gntg
63 73 gnlttg
64 73 gntlng
65 74 gnvg
67 81 gnlg
68 81 gltlg
69 82 gntg
70 84 gg
74 66 gltg
75 66 gnltg
76 65 gnnvg
77 65 gg
78 78 gng
79 77 gnlng
80 77 gnltg
81 78 gng
84 71 gnlg
85 71 gltlg
86 72 gng
''')
save('skill_c', SKILL_C, True)
# Visual correction: restore the missing neck material in skill preparation.
SKILL_A = revise(SKILL_A, '''
56 34 okrshhssrrrbbbbko
57 33 okrrshssrrrbbbbkko
''')
save('skill_a', SKILL_A, True)

# Poison: neck bends down, nearer branch rubs the jaw, far branch guards the gut.
# No wood tinting: the toxic material exists only in separately authored bubbles.
POISON_A = revise(IDLE_A, '''
35 22 gnlnngkbrrshhssrrrbbggnlalnvgg
36 20 gnlallnvgkrrshhssrrbggnllnnnnvgg
37 18 gnllnnnvvgbrrshhssrrbbgnlnnnnnvvng
38 17 gnnnnvvvvgbrrshhssrrrbbgnnnnnvvvvng
39 20 ggvvvgggokrrshhssrrrbbkggvvvvgg
40 23 gggg...okrrshhssrrrrbbko.gggg
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbrrrbbbo
45 34 orshhsrrbbkrrbbbo
46 35 orshhsrrbkkrbbbbbo
47 35 orshhssrbkrrbkkbbbo
48 36 orshhssrrbrrrbekbbo
49 36 orshhssrrbbrrrbbrrbo
50 36 orshhssrssrrrbbbrssro
51 36 orshhssrrsrrrbbbkbbo
52 36 orshhssrrsrrrbkebbbo
53 36 orshhssrrrkkkrebbbo
54 36 orshhssrrrssrrebbko
55 35 okrshhssrrrrrrbbbko
56 35 okrshhssrrrrrbbbbko
57 34 okrrshssrrrrrbbbbkko
58 32 okrrshhssrrrrrbbbbkkboo
59 30 okrrsshhssrrrrrbbbbkkrrbko
60 29 orrsshhssrrrrrrbbbkkrrshsrbo
61 28 orrsshhssrrrrrrrbbkkrrshsrbo
62 27 orrssbbrrssrrrrrrbbkkrrshhsrbo
63 26 orrssbbkrrssrrrrrbbkkrrshhsrbo
64 25 orrssbbkoorrssrrrrbbkkrrshhsrbo
65 25 orrssbbkoorrssrrrrbbkkrrshhsrbo
66 26 orrssbbkkorrssrrrbbkkrrshhsrbo
67 27 orrssbbkrrrssssrrbbkkrrshhsrbo
68 28 orrssbrrrsshhssrrbbkkrrshhsrbo
69 29 orrssrrsshhssrrrbbkkrrshssrbo
70 30 orrsssshhssrrrbbkkrrssrrrbko
71 30 orrsssshhssrrrbbkkrrssrrbko
72 30 orrsssshhssrrrbbkkrrssrbko
73 30 okrrsshhssrrrbbkkrrrbko
74 30 okrrrssssrrrbbkkkrrbko
75 29 okrrssrrrrrrbbbkkrrrbko
76 29 orrssrrrrrrbbbkkrrrbbko
77 29 orrssrrrrrbbbkkkrrrbbko
78 29 orrssrrrrbbbkk..krrrbbko
79 29 orrssrrrbbko....krrrbbko
80 28 orrssrrrbbko.....krrrbbko
81 27 orrssrrrbbko......krrrbbko
82 26 orrssrrrbbko.......krrrbbko
83 25 orssrrrbbko.........krrrbbko
84 25 orssrrbbbko..........krrrbbko
85 24 orssrrbbbko...........krrrbbko
86 23 orssrrbbbko............krrrbbko
87 23 orssrrbbbko.............krrrssbbko
88 22 orssrrbbbko.............okrrssrrbbkoo
89 20 ookrssrrbbbko............orrssrrrrrbbko
90 19 orsshhssrrbbko..........orrssrrrrrrbbko
91 19 orrssssrrrbbbko........okrrssrrbbkkbko
92 20 ookkkkkkkkkkoo.........ookkkkkko..oo
''', clear_rows=range(35,93))
# Brow-hand overlap has warm flesh-of-wood so the branch is not outline-only.
POISON_A = revise(POISON_A, '''
52 51 obrbo
53 50 orsrbo
54 50 orhsrbo
55 50 orssrbo
56 51 orssrbo
57 51 orssrbo
58 52 orssrbo
59 52 orssrbo
60 53 orssrbo
61 53 orssrbo
62 54 orssrbo
31 74 opoo
32 73 opqqpo
33 72 opq..ppo
34 72 op...ppo
35 73 oppppo
36 74 ooo
43 68 opo
44 67 opqpo
45 67 op.po
46 68 opo
53 74 oppo
54 73 opqppo
55 73 oppppo
56 74 oooo
''')
save('poison_a', POISON_A, True)
POISON_B = revise(POISON_A, '''
46 35 orshhsrrbkkrbbbbbo
47 35 orshhssrbkrrbkkbbbo
48 36 orshhssrrbrrrbkkbbo
49 36 orshhssrrbbrrrbbrrbo
50 36 orshhssrssrrrbbbrssro
51 36 orshhssrrsrrrbbbkbbo
52 36 orshhssrrsrrrbkebbbo
53 36 orshhssrrrkkkrebbbo
54 36 orshhssrrrssrrebbko
53 50 orrrbo
54 50 orsrbo
55 50 orhsrbo
56 51 orssrbo
57 51 orssrbo
58 52 orssrbo
59 52 orssrbo
60 53 orssrbo
61 53 orssrbo
62 54 orssrbo
66 26 orrssbbkkorrsssrrbbkkrrshhsrbo
67 27 orrssbbkrrrsssssrrbbkkrrshhsrbo
68 28 orrssbrrrsshhsssrrbbkkrrshhsrbo
69 29 orrssrrsshhsssrrrbbkkrrshssrbo
70 30 orrsssshhsssrrrbbkkrrssrrrbko
71 30 orrsssshhsssrrrbbkkrrssrrbko
72 30 orrsssshhsssrrrbbkkrrssrbko
73 30 okrrsshhsssrrrbbkkrrrbko
''')
# Erase only authored bubble rows/columns, with literal transparent spans.
POISON_B = revise(POISON_B, '''
31 74 ....
32 73 ......
33 72 ........
34 72 ........
35 73 ......
36 74 ....
43 68 ...
44 67 .....
45 67 .....
46 68 ...
53 74 ....
54 73 ......
55 73 ......
56 74 ....
27 70 opo
28 69 opqpo
29 69 op.po
30 70 opo
38 78 oppoo
39 77 opqqppo
40 76 opq..ppo
41 76 op...ppo
42 77 oppppo
43 78 oooo
49 71 opo
50 70 opqpo
51 70 op.po
52 71 opo
59 75 p.p
60 74 pq.p
61 75 p.p
''')
save('poison_b', POISON_B, True)

# Stun: lowered face, slit eyes, fully dropped jointed arms; stars have five clusters.
STUN_A = revise(IDLE_A, '''
38 17 gnnnnvvvvgbrrshhssrrrbbgnnnnnvvvvng
39 20 ggvvvgggokrrshhssrrrbbkggvvvvgg
40 23 gggg...okrrshhssrrrrbbko.gggg
41 34 okrsshhssrrrrrbbko
42 34 orsshhissrrrrrbbko
43 34 orshhihssrrbrrbbko
44 34 orshhssrrbrrrbbbo
45 34 orshhsrrbbkrrbbbo
46 35 orshhsrrbkkrbbbbbo
47 35 orshhssrbkrrbkkbbbo
48 36 orshhssrrbrrrbkkbbo
49 36 orshhssrrbbrrrbbrrbo
50 36 orshhssrssrrrbbbrssro
51 36 orshhssrrsrrrbbbkbbo
52 36 orshhssrrsrrrbkkbbbo
53 36 orshhssrrrkkkrrbbbo
54 36 orshhssrrrssrrrbbko
55 35 okrshhssrrrrrrbbbko
56 35 okrshhssrrrrrbbbbko
57 34 okrrshssrrrrrbbbbkko
58 32 okrrshhssrrrrrbbbbkkboo
59 30 okrrsshhssrrrrrbbbbkkrrbko
60 29 orrsshhssrrrrrrbbbkkrrshsrbo
61 28 orrsshhssrrrrrrrbbkkrrshsrbo
62 27 orrssbbrrssrrrrrrbbkkrrshhsrbo
63 26 orrssbbkrrssrrrrrbbkkrrshhsrbo
64 26 orrssbbkorrssrrrrbbkkrrshhsrbo
65 26 orrssbbkorrssrrrrbbkkrrshhsrbo
66 26 orrssbbkorrssrrrrbbkkrrshhsrbo
67 26 orrssbbkorrssrrrrbbk.krrshhsrbo
68 26 orrssbbkorrssrrrrbbk..krrshhsrbo
69 26 orrssbbkorrssrrrrbbk...krrshhsrbo
70 26 orrssbbkorrssrrrrbbk....krrshhsrbo
71 26 orrssbbkorrssrrrrbbk.....krrshhsrbo
72 26 orrssbbkorrssrrrrbbko.....krrshhsrbo
73 25 orrssbbkookrrssrrrrbbko....krrshhsrbo
74 25 orsshbbko.okrrssrrrrbbko...krrshhsrbo
75 25 orssrbbko.okrrssrrrrrbbko..krrshhsrbo
76 25 orrsrbko..okrrssrrrrrbbko.krrshhsrbo
77 25 orrsrbko..orrssrrrrrbbkkrrrshhsrbo
78 24 okrrbko...orrssrrrrbbkkkrrrshhsrbo
79 24 okkbko...orrssrrrrbbko..krrshhsrbo
80 25 oo.....orrssrrrbbko.....krrshhsrbo
81 29 orrssrrrbbko............krrshhsrbo
82 28 orrssrrrbbko..............krrshhsrbo
83 27 orssrrrbbko................krrssrbo
84 27 orssrrbbbko.................krrrbko
85 26 orssrrbbbko..................okkko
86 25 orssrrbbbko...................oo
87 25 orssrrbbbko.............krrrssbbko
88 24 orssrrbbbko.............okrrssrrbbkoo
89 22 ookrssrrbbbko............orrssrrrrrbbko
90 21 orsshhssrrbbko..........orrssrrrrrrbbko
91 21 orrssssrrrbbbko........okrrssrrbbkkbko
92 22 ookkkkkkkkkkoo.........ookkkkkko..oo
''', clear_rows=range(38,93))
# Restore near thigh behind the drooping arm at its actual native coordinates.
STUN_A = revise(STUN_A, '''
79 52 krrrbbbko
80 53 krrrbbbko
81 54 krrrbbbko
82 55 krrrbbbko
83 56 krrrbbbko
84 57 krrrbbbo
85 58 krrrbbbo
86 59 krrrbbbo
24 77 ouo
25 76 ouwuo
26 73 oouwwwuoo
27 74 ouwwwwuo
28 75 ouwwwuo
29 75 ouuouuo
30 75 oo...oo
42 17 ouo
43 16 ouwuo
44 13 oouwwwuoo
45 14 ouwwwwuo
46 15 ouwwwuo
47 15 ouuouuo
48 15 oo...oo
''')
save('stun_a', STUN_A, True)
STUN_B = revise(STUN_A, '''
44 34 orshhssrrbrrrbbbo
45 34 orshhsrrbbkrrbbbo
46 35 orshhssrbkrrrbbbbo
47 35 orshhssrrbkrrbkkbbbo
48 36 orshhssrrbbrrrbkkbbo
49 36 orshhssrrrbbrrrbbrrbo
50 36 orshhssrrssrrrbbbrssro
51 36 orshhssrrrsrrrbbbkbbo
52 36 orshhssrrrsrrrbkkbbbo
53 36 orshhssrrrrkkkrrbbbo
54 36 orshhssrrrrssrrrbbko
55 35 okrshhssrrrrrrrbbbko
56 35 okrshhssrrrrrrbbbbko
57 34 okrrshssrrrrrrbbbbkko
73 25 orrssbbkookrrssrrrrbbko.....krrshhsrbo
74 25 orsshbbko.okrrssrrrrbbko....krrshhsrbo
75 25 orssrbbko.okrrssrrrrrbbko...krrshhsrbo
76 25 orrsrbko..okrrssrrrrrbbko..krrshhsrbo
77 25 orrsrbko..orrssrrrrrbbkkrrrshhsrbo
78 24 okrrbko...orrssrrrrbbkkkrrrshhsrbo
79 24 okkbko...orrssrrrrbbko..krrrbbbko
80 25 oo.....orrssrrrbbko....krrrbbbko
81 29 orrssrrrbbko...........krrrbbbko
82 28 orrssrrrbbko............krrrbbbko
83 27 orssrrrbbko..............krrrbbbko
84 27 orssrrbbbko...............krrrbbbo
85 26 orssrrbbbko................krrrbbbo
86 25 orssrrbbbko.................krrrbbbo
81 70 orssrbo
82 71 orssrbo
83 72 orsrbo
84 73 orrbko
85 73 okbko
86 74 oo
24 77 ...
25 76 .....
26 73 .........
27 74 ........
28 75 .......
29 75 .......
30 75 .......
42 17 ...
43 16 .....
44 13 .........
45 14 ........
46 15 .......
47 15 .......
48 15 .......
33 74 ouo
34 73 ouwuo
35 70 oouwwwuoo
36 71 ouwwwwuo
37 72 ouwwwuo
38 72 ouuouuo
39 72 oo...oo
32 12 ouo
33 11 ouwuo
34 8 oouwwwuoo
35 9 ouwwwwuo
36 10 ouwwwuo
37 10 ouuouuo
38 10 oo...oo
''')
save('stun_b', STUN_B, True)
# The visual gap also included y58..59, now restored as full warm shoulder rows.
SKILL_A = revise(SKILL_A, '''
58 30 ookrrshhssrrrbbbbkkboo
59 28 okrrsshhssrrrrbbbbkkrrbko
''')
save('skill_a', SKILL_A, True)

# Stun support corrections, selected independently for each posture.
# Separate row spans describe two thighs, two ankles and the dangling twig hand.
STUN_A = revise(STUN_A, '''
73 25 orrssbbko
74 25 orsshbbko
75 25 orssrbbko
76 25 orrsrbko
77 25 orrsrbko
78 24 okrrbko
79 24 okkbko
80 25 oo
73 36 okrrssrrrrrrbbko
74 35 okrrssrrrrrrrbbko
75 34 okrrssrrrrrrrrbbko
76 33 orrssrrrrrbbkkrrrbbko
77 32 orrssrrrrbbkkrrrbbbko
78 31 orrssrrrbbko.krrrbbbko
79 30 orrssrrrbbko..krrrbbbko
80 29 orrssrrrbbko...krrrbbbko
81 28 orrssrrrbbko....krrrbbbko
82 27 orrssrrrbbko.....krrrbbbko
83 26 orssrrrbbko.......krrrbbbko
84 26 orssrrbbbko........krrrbbbo
85 25 orssrrbbbko.........krrrbbbo
86 24 orssrrbbbko..........krrrbbbo
87 24 orssrrbbbko..........krrrssbbko
88 23 orssrrbbbko..........okrrssrrbbkoo
89 21 ookrssrrbbbko.........orrssrrrrrbbko
90 20 orsshhssrrbbko.......orrssrrrrrrbbko
91 20 orrssssrrrbbbko.....okrrssrrbbkkbko
92 21 ookkkkkkkkkkoo......ookkkkkko..oo
73 66 orshsrbo
74 67 orshsrbo
75 68 orshsrbo
76 69 orshsrbo
77 70 orshsrbo
78 71 orssrbo
79 72 orssrbo
80 73 orssrbo
81 74 orsrbo
82 75 orrbko
83 75 okbko
84 76 oo
''', clear_rows=range(73,93))
save('stun_a', STUN_A, True)
STUN_B = revise(STUN_B, '''
73 25 orrssbbko
74 25 orsshbbko
75 25 orssrbbko
76 25 orrsrbko
77 25 orrsrbko
78 24 okrrbko
79 24 okkbko
80 25 oo
73 36 okrrssrrrrrrrbbko
74 35 okrrssrrrrrrrrbbko
75 34 okrrssrrrrrrrrrbbko
76 33 orrssrrrrrbbkkrrrbbbko
77 32 orrssrrrrbbkkrrrbbbbko
78 31 orrssrrrbbko.krrrbbbbko
79 30 orrssrrrbbko..krrrbbbbko
80 29 orrssrrrbbko...krrrbbbbko
81 28 orrssrrrbbko....krrrbbbbko
82 27 orrssrrrbbko.....krrrbbbbko
83 26 orssrrrbbko.......krrrbbbbko
84 26 orssrrbbbko........krrrbbbbo
85 25 orssrrbbbko.........krrrbbbbo
86 24 orssrrbbbko..........krrrbbbbo
87 24 orssrrbbbko..........krrrssbbko
88 23 orssrrbbbko..........okrrssrrbbkoo
89 21 ookrssrrbbbko.........orrssrrrrrbbko
90 20 orsshhssrrbbko.......orrssrrrrrrbbko
91 20 orrssssrrrbbbko.....okrrssrrbbkkbko
92 21 ookkkkkkkkkkoo......ookkkkkko..oo
73 67 orshsrbo
74 68 orshsrbo
75 69 orshsrbo
76 70 orshsrbo
77 71 orshsrbo
78 72 orssrbo
79 73 orssrbo
80 74 orssrbo
81 75 orsrbo
82 76 orrbko
83 76 okbko
84 77 oo
''', clear_rows=range(73,93))
save('stun_b', STUN_B, True)

# Sleep: seated roots curl forward, folded branches lie across knees.
# Three tiered pine boughs stay recognizably pine, authored anew for the low posture.
SLEEP_A = rows('''
26 43 gng
27 41 gnnlng
28 39 gnnllalvg
29 37 gnggnnllallnvg
30 34 gnlnnnllallnnvg
31 31 gnlallllnnnnnvvg......gng
32 29 gnlallnnnnnnnvvgg....gnlng
33 27 gnlallnnnnnvvg.gggnlnllalnvg
34 25 gnnllnnnnnvvg.gnlallllallnnvgg
35 23 gnnllnnnvvgg.gnllallllnnnnnnvg
36 21 gnllnnnvvgg.gnnllallnnnnnnnnnvvg
37 20 gnnnnvvgg.gnnllallnnnnnnnnnnnvvgg
38 19 gnnnvgg.gnnllallnnnnnnnnnnnnnnvvng
39 18 gnllnngnnllallnnnnnvvvgnnnnnnvvvvng
40 16 gnlallnnllallnnnnnvvggknnnnnnvvvvgg
41 14 gnnllallllnnnnnnnvvggkrrbbggggg
42 13 gnlallnnnnnnnnnvvggbrrssrbko
43 15 gnnllnnnnnnnnvvgbrrsshhssrbko
44 17 gnnlnnnnnnnvvggbrrsshhihhssrbko
45 19 gnnnnnnnnvvgkbrrsshhihhhssrrbko
46 21 ggvvvvvvgg.okrrsshhihhhssrrbbko
47 23 gggggg...okrrsshhihhhssrrbbko
48 26 gng....okrrsshhihhhssrrrbbbko
49 24 gnlng..okrrsshhihhhssrrrbbbko
50 22 gnnllnvgbrrsshhihhhssrrrbbbko
51 20 gnlallnnvgbrrsshhhssrrrrbbbko
52 19 gnnllnnnvgbrrsshhssrrrbbbko
53 18 gnnlnnvvgbrrsshhssrrrbbbko
54 19 gnnnvvggkbrrsshhssrrrbbbko
55 21 ggvvggokrrsshhssrrrbbbko
56 24 gggokrrsshhssrrrbbbko
57 29 okrrsshhssrrrbbbko
58 31 orsshhssrrrbbbbko
59 32 orshhssrrrbbbbko
60 33 orshhssrrbbkbbbko
61 34 orshhssrrrbbbbbbko
62 35 orshhssrssrrbbbbbko
63 35 orshhssrssrrbbbkbbo
64 35 orshhssrrsrrbbkkbbo
65 35 orshhssrrsrrbbbrssro
66 35 orshhssrrsrrbbbbkbbo
67 35 orshhssrrrkkkrrbbbo
68 34 orshhssrrrssrrrbbko
69 32 okrrshhssrrrrrrbbbko
70 30 okrrshhssrrrrrbbbbko
71 29 okrrshhssrrrrrbbbbkkoo
72 28 orrsshhssrrrrrrbbbbkkrrboo
73 27 orrsshhssrrrrrrrbbbkkrrssrboo
74 26 orrssbbrrssrrrrrrbbkkrrshhssrbo
75 25 orrssbbkrrssrrrrrbbkkrrshhhssrbo
76 24 orrssbbkorrssrrrrbbkkrrshhhssrbo
77 24 orrssbbkorrssrrrrbbkkrrshhssrrbko
78 25 orrssbbkorrssrrrrbbkkrrsshhssrrbko
79 26 orrssbbkkorrssrrrrbbkkrrsshhssrrbko
80 27 orrssbbkrrrssssrrrbbkkrrsshhssrrbko
81 28 orrssbrrrsshhssrrrbbkkrrsshhssrrbko
82 29 orrssrrsshhssrrrrbbkkrrsshhssrrbko
83 30 orrsssshhssrrrrbbkkrrsshhssrrbko
84 29 okrrsshhssrrrrbbkkrrsshhssrrbko
85 27 okrrsshhssrrrrbbkkrrsshhssrrbko
86 25 okrrsshhssrrrrbbkkrrsshhssrrbko
87 23 okrrsshhssrrrbbkkrrsshhssrrrbko
88 21 okrrsshhssrrrbbkkrrsshhssrrrrbko
89 19 okrrsshhssrrrbbkkrrsshhssrrrrrbko
90 17 okrrsshhssrrrbbkkrrsshhssrrrrrrbkoo
91 16 orrsshhssrrrbbkkrrsshhssrrrrrrrbbko
92 17 ookkkkkkkkkkkkkkkkkkkkkkkkkkkkkko
''')
# Actual lids: short brown cuts separated from the darker nose on the right.
SLEEP_A = revise(SLEEP_A, '''
62 43 sssrrrbbbb
63 43 ssrrbbrrbb
64 43 ssrrssrrbk
65 43 ssrrssrrbr
66 43 ssrrssrrbb
67 43 ssrrrkkkrr
''')
save('sleep_a', SLEEP_A, True)
# Breathing is local cambium expansion; feet and folded branches retain their form.
SLEEP_B = revise(SLEEP_A, '''
26 43 gvg
27 41 gnnlng
28 39 gnnllanvg
29 37 gnggnnllalnnvg
33 27 gnlallnnnnnvvg.gggnlnllalnvg
34 25 gnnllnnnnnvvg.gnlallllallnnvgg
51 20 gnlallnnvgbrrsshhhssrrrrbbbko
52 19 gnnllnnnvgbrrsshhhssrrrbbbko
53 18 gnnlnnvvgbrrsshhhssrrrbbbko
54 19 gnnnvvggkbrrsshhhssrrrbbbko
61 34 orshhssrrrbbbbbbko
62 35 orshhssrssrrbbbbbko
63 35 orshhssrssrrbbbkbbo
64 35 orshhssrrsrrbbkkbbo
65 35 orshhssrrsrrbbbrssro
66 35 orshhssrrsrrbbbbkbbo
67 35 orshhssrrrkkkrrbbbo
62 43 sssrrrbbbb
63 43 ssrrbbrrbb
64 43 ssrrssrrbk
65 43 ssrrssrrbr
66 43 ssrrssrrbb
67 43 ssrrrkkkrr
68 34 orshhssrrrssrrrbbko
69 32 okrrshhhssrrrrrrbbbko
70 30 okrrshhhssrrrrrbbbbko
71 29 okrrshhhssrrrrrbbbbkkoo
72 28 orrsshhhssrrrrrrbbbbkkrrboo
73 27 orrsshhhssrrrrrrrbbbkkrrssrboo
74 26 orrssbbrrsssrrrrrrbbkkrrshhssrbo
75 25 orrssbbkrrsssrrrrrbbkkrrshhhssrbo
76 24 orrssbbkorrsssrrrrbbkkrrshhhssrbo
77 24 orrssbbkorrsssrrrrbbkkrrshhssrrbko
78 25 orrssbbkorrsssrrrrbbkkrrsshhssrrbko
79 26 orrssbbkkorrsssrrrrbbkkrrsshhssrrbko
80 27 orrssbbkrrrsssssrrrbbkkrrsshhssrrbko
81 28 orrssbrrrsshhsssrrrbbkkrrsshhssrrbko
82 29 orrssrrsshhsssrrrrbbkkrrsshhssrrbko
83 30 orrsssshhsssrrrrbbkkrrsshhssrrbko
''')
save('sleep_b', SLEEP_B, True)
# Explicit elbow-to-forearm repairs, separately selected in the two stun frames.
STUN_A = revise(STUN_A, '''
73 53 orshhsrrbko
74 54 orshhsrrbko
75 55 orshhsrrbko
76 56 orshhsrrbko
77 57 orshhsrrbko
78 58 orsshsrrbko
79 59 orsshsrrbko
80 60 orsshsrrbko
81 61 orsshsrrbko
82 62 orsshsrrbko
83 63 orsshsrrbko
84 64 orsssrbo
85 65 orsrbo
86 66 okbko
87 67 oo
73 66 ........
74 67 ........
75 68 ........
76 69 ........
77 70 ........
78 71 .......
79 72 .......
80 73 .......
81 74 ......
82 75 ......
83 75 .....
84 76 ..
24 77 ...
25 76 .....
26 73 .........
27 74 ........
28 75 .......
29 75 .......
30 75 .......
26 85 ouo
27 84 ouwuo
28 81 oouwwwuoo
29 82 ouwwwwuo
30 83 ouwwwuo
31 83 ouuouuo
32 83 oo...oo
''')
save('stun_a', STUN_A, True)
STUN_B = revise(STUN_B, '''
73 53 orshhsrrbko
74 54 orshhsrrbko
75 55 orshhsrrbko
76 56 orshhsrrbko
77 57 orshhsrrbko
78 58 orsshsrrbko
79 59 orsshsrrbko
80 60 orsshsrrbko
81 61 orsshsrrbko
82 62 orsshsrrbko
83 63 orsshsrrbko
84 64 orsshsrrbko
85 65 orssrbo
86 66 orrbko
87 67 okbko
88 68 oo
73 67 ........
74 68 ........
75 69 ........
76 70 ........
77 71 ........
78 72 .......
79 73 .......
80 74 .......
81 75 ......
82 76 ......
83 76 .....
84 77 ..
33 74 ...
34 73 .....
35 70 .........
36 71 ........
37 72 .......
38 72 .......
39 72 .......
32 12 ...
33 11 .....
34 8 .........
35 9 ........
36 10 .......
37 10 .......
38 10 .......
43 83 ouo
44 82 ouwuo
45 79 oouwwwuoo
46 80 ouwwwwuo
47 81 ouwwwuo
48 81 ouuouuo
49 81 oo...oo
49 10 ouo
50 9 ouwuo
51 6 oouwwwuoo
52 7 ouwwwwuo
53 8 ouwwwuo
54 8 ouuouuo
55 8 oo...oo
''')
# Repair the crown material erased by the first star placements.
STUN_A = revise(STUN_A, '''
24 73 vng
25 74 ng
26 73 gg
''')
STUN_B = revise(STUN_B, '''
33 70 nnvvgg
34 70 nnvng
35 70 nnvvgg
36 72 vvgg
35 15 gngg
36 14 gnlnvg
37 12 gnnllnvg
38 13 gnnnnvvg
''')
save('stun_a', STUN_A, True)
save('stun_b', STUN_B, True)
HIT = revise(HIT, '''
29 59 gnllalnnnnvvg
''')
save('hit', HIT)

# Three pine fans now contain visible slender side needles and native gaps.
SKILL_B = revise(SKILL_B, '''
42 89 gtg
43 87 gnltg
44 82 gng.gntg
45 81 gntg.gtg
46 80 gnlwgntg
47 78 gnlttwtg
48 77 gnlttwltg
49 76 gnltwtlng.gng
50 76 gltwtlng.gnlg
51 75 glttwlg.gnlng
52 74 gltwtlg.gnlg
53 73 glttlg.gnlg
54 72 gltlg.gnlg
55 71 gtlggnlg.......gng
56 71 gtggnlg.....gnltg
57 71 gnlg......gnlttwtg
58 72 gltg...gnltwttlg
59 73 glttttttwttlng..gng
60 73 gntlnlltwllnvg.gnlng.
61 74 gnvg..ggnlnnvg.gnng
62 75 gntg....ggggg...gg
63 75 glttg
64 76 gnltlg
65 77 gnltwlg
66 78 gnlttwlg
67 79 gnltwtlg.gng
68 80 gnlttwlg.gnlg
69 81 gnlttwlg.gnlg
70 81 gnlgntwlg.gnlg
71 82 gng.gntwlg.gng
72 84 gng.gntwlg
73 86 gng.gntlg
74 89 gng.gtg
75 90 gng
''')
# Explicit edge cleanup for the middle fan's last native pixel.
SKILL_B = revise(SKILL_B, '''
59 94 ..
60 94 ..
61 94 ..
''')
save('skill_b', SKILL_B, True)

# Toxic bubble repositioned away from the foliage, retaining literal ring gaps.
POISON_A = revise(POISON_A, '''
31 74 ....
32 73 ......
33 72 ........
34 72 ........
35 73 ......
36 74 ....
33 86 opoo
34 85 opqqpo
35 84 opq..ppo
36 84 op...ppo
37 85 oppppo
38 86 ooo
31 74 vng
32 73 vng
33 72 nvgg
34 72 nvng
35 72 vvgg
36 74 gg
''')
save('poison_a', POISON_A, True)
# Full native right-fan redraw, clearing old tips with explicit transparent rows.
SKILL_B = revise(SKILL_B, '''
42 76 ....................
43 76 ....................
44 76 ....................
45 76 ....................
46 76 ....................
47 76 ....................
48 76 ....................
49 76 ....................
50 76 ....................
51 76 ....................
52 76 ....................
53 76 ....................
54 76 ....................
55 76 ....................
56 76 ....................
57 76 ....................
58 76 ....................
59 76 ....................
60 76 ....................
61 76 ....................
62 76 ....................
63 76 ....................
64 76 ....................
65 76 ....................
66 76 ....................
67 76 ....................
68 76 ....................
69 76 ....................
70 76 ....................
71 76 ....................
72 76 ....................
73 76 ....................
74 76 ....................
75 76 ....................
42 88 gtg
43 86 gnltg
44 81 gng.gntg
45 80 gntg.gtg
46 79 gnlwgntg
47 77 gnlttwtg
48 76 gnlttwltg
49 76 gltwtlng.gng
50 76 gltwtlng.gnlg
51 76 lttwlg.gnlng
52 76 twtlg.gnlg
53 76 tlg.gnlg
54 76 g.gnlg
55 76 nlg.......gng
56 76 lg.....gnltg
57 76 .....gnlttwtg
58 76 ..gnltwttlg
59 76 tttttwttlng..gng
60 76 lnlltwllnvg.gnlg
61 76 vg..ggnlnnvg.gng
62 76 ntg....ggggg...gg
63 76 lttg
64 76 gnltlg
65 77 gnltwlg
66 78 gnlttwlg
67 79 gnltwtlg.gng
68 80 gnlttwlg.gnlg
69 80 gnlttwlg.gnlg
70 80 gnlgntwlg.gnlg
71 81 gng.gntwlg.gng
72 83 gng.gntwlg
73 85 gng.gntlg
74 87 gng.gtg
75 88 gng
''')

# Cambium hip extends gradually into the front root in the preparation frame.
SKILL_A = revise(SKILL_A, '''
71 30 orrssrrrrbbko
72 30 orrssrrrrrbbko
73 29 orrssrrrrrrbbko
74 29 orrssrrrrrrrbbko
75 28 okrrssrrrrrrbbkkrrrbbko
76 27 okrrssrrrrrrbbkkrrrbbko
77 27 orrssrrrrrbbkkkrrrbbko
78 27 orrssrrrrbbk..kkrrrbbko
''')

# Native knees/ankles replace the column-like front roots in contact and cast.
# Each authored frame explicitly keeps its own existing trunk and attack branch.
ATTACK = revise(ATTACK, '''
75 47 krrssrrbbko
76 46 krrrsshhssrbko
77 46 krrrsshhssrrbko
78 47 krrrsshhssrrbko
79 48 krrrsshhssrrbko
80 49 krrrsshhssrrbko
81 50 krrrsshhssrbko
82 50 krrrsshssrbko
83 50 krrrssrrbko..
84 50 krrrssrrbko..
85 50 krrrssrrbko..
86 50 krrrssrrbko..
87 50 krrrssrrbko..
88 49 okrrssrrbko..
89 49 orrsshhssrrbkoo
90 47 ookrrsshhssrrrrbko
91 46 orrsshhssrrrbkkrrbko
92 47 ookkkkkkkkko..okkkko
''')
SKILL_B = revise(SKILL_B, '''
75 47 krrssrrbbko
76 46 krrrsshhssrbko
77 46 krrrsshhssrrbko
78 47 krrrsshhssrrbko
79 48 krrrsshhssrrbko
80 49 krrrsshhssrrbko
81 50 krrrsshhssrbko
82 50 krrrsshssrbko
83 50 krrrssrrbko..
84 50 krrrssrrbko..
85 50 krrrssrrbko..
86 50 krrrssrrbko..
87 50 krrrssrrbko..
88 49 okrrssrrbko..
89 49 orrsshhssrrbkoo
90 47 ookrrsshhssrrrrbko
91 46 orrsshhssrrrbkkrrbko
92 47 ookkkkkkkkko..okkkko
''')
# Root toe splits, broad support at y92; explicit per-frame edits.
IDLE_A = revise(IDLE_A, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 34 srbr
63 34 srkr
64 35 brkr
65 35 rbrr
66 35 rrbr
83 27 srrb
84 27 srrk
85 26 srrb
''')
IDLE_B = revise(IDLE_B, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 35 srbr
63 35 srkr
64 36 brkr
65 36 rbrr
66 36 rrbr
83 27 srrb
84 27 srrk
85 26 srrb
''')
IDLE_C = revise(IDLE_C, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 34 srbr
63 34 srkr
64 35 brkr
65 35 rbrr
66 35 rrbr
83 27 srrb
84 27 srrk
85 26 srrb
''')
WINDUP = revise(WINDUP, '''
90 16 orsshhssrrbkkrrbo
91 15 orrssssrrbkkrrrbko
92 16 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
70 39 srbr
71 40 srkr
72 40 brkr
73 40 rbrr
74 40 rrbr
''')
MOVE = revise(MOVE, '''
90 15 orsshhssrrbkkrrbo
91 14 orrssssrrbkkrrrbko
92 15 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 39 srbr
63 39 srkr
64 40 brkr
65 40 rbrr
66 40 rrbr
''')
ATTACK = revise(ATTACK, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 42 srbr
63 42 srkr
64 43 brkr
65 43 rbrr
66 43 rrbr
80 54 ssrb
81 55 srkr
82 55 srrb
''')
RECOVER = revise(RECOVER, '''
90 16 orsshhssrrbkkrrbo
91 15 orrssssrrbkkrrrbko
92 16 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 37 srbr
63 37 srkr
64 38 brkr
65 38 rbrr
66 38 rrbr
''')
HIT = revise(HIT, '''
90 16 orsshhssrrbkkrrbo
91 15 orrssssrrbkkrrrbko
92 16 ookkkkkkko..okkko
42 34 shhrbr
43 33 shhrrb
44 33 shrrbr
62 31 srbr
63 31 srkr
64 32 brkr
65 32 rbrr
66 32 rrbr
''')
DEAD = revise(DEAD, '''
83 44 rbrr
84 43 rkrr
85 42 rbrr
86 41 rrbr
87 40 rrrb
90 73 rrbbrrbko
91 73 rbkkrrbko
92 74 kko..okkko
''')
SKILL_A = revise(SKILL_A, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 36 srbr
63 36 srkr
64 37 brkr
65 37 rbrr
66 37 rrbr
''')
SKILL_B = revise(SKILL_B, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 42 srbr
63 42 srkr
64 43 brkr
65 43 rbrr
66 43 rrbr
80 54 ssrb
81 55 srkr
82 55 srrb
''')
SKILL_C = revise(SKILL_C, '''
90 17 orsshhssrrbkkrrbo
91 16 orrssssrrbkkrrrbko
92 17 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 34 srbr
63 34 srkr
64 35 brkr
65 35 rbrr
66 35 rrbr
''')
POISON_A = revise(POISON_A, '''
90 19 orsshhssrrbkkrrbo
91 18 orrssssrrbkkrrrbko
92 19 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 40 srbr
63 40 srkr
64 41 brkr
65 41 rbrr
66 41 rrbr
''')
POISON_B = revise(POISON_B, '''
90 19 orsshhssrrbkkrrbo
91 18 orrssssrrbkkrrrbko
92 19 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 40 srbr
63 40 srkr
64 41 brkr
65 41 rbrr
66 41 rrbr
''')
STUN_A = revise(STUN_A, '''
90 20 orsshhssrrbkkrrbo
91 19 orrssssrrbkkrrrbko
92 20 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 40 srbr
63 40 srkr
64 41 brkr
65 41 rbrr
66 41 rrbr
''')
STUN_B = revise(STUN_B, '''
90 20 orsshhssrrbkkrrbo
91 19 orrssssrrbkkrrrbko
92 20 ookkkkkkko..okkko
42 38 shhrbr
43 38 shhrrb
44 39 shrrbr
62 40 srbr
63 40 srkr
64 41 brkr
65 41 rbrr
66 41 rrbr
''')
SLEEP_A = revise(SLEEP_A, '''
73 38 srbr
74 38 srkr
75 39 brkr
76 39 rbrr
77 39 rrbr
89 21 sshsrrb
90 20 sshssrb
91 18 sssrrbkr
92 17 ookkkkkko..okkko
''')
SLEEP_B = revise(SLEEP_B, '''
73 39 srbr
74 39 srkr
75 40 brkr
76 40 rbrr
77 40 rrbr
89 21 sshsrrb
90 20 sshssrb
91 18 sssrrbkr
92 17 ookkkkkko..okkko
''')
# All final full native rows are saved; unmodified identity clusters are retained.
for name, canvas in [('idle_a',IDLE_A),('idle_b',IDLE_B),('idle_c',IDLE_C),
 ('windup',WINDUP),('move',MOVE),('attack',ATTACK),('recover',RECOVER),('hit',HIT),('dead',DEAD)]:
    save(name,canvas)
for name, canvas in [('skill_a',SKILL_A),('skill_b',SKILL_B),('skill_c',SKILL_C),
 ('poison_a',POISON_A),('poison_b',POISON_B),('stun_a',STUN_A),('stun_b',STUN_B),
 ('sleep_a',SLEEP_A),('sleep_b',SLEEP_B)]:
    save(name,canvas,True)
# Final sleep eyelids: two short horizontal bark lids, warm cheek below, no amber.
SLEEP_A = revise(SLEEP_A, '''
63 43 ssrbbrrbbbr
64 43 ssrrssrrsrr
''')
SLEEP_B = revise(SLEEP_B, '''
63 43 ssrbbrrbbbr
64 43 ssrrssrrsrr
''')
save('sleep_a', SLEEP_A, True)
save('sleep_b', SLEEP_B, True)
# Final recovery-leg repair: a narrow outline was carrying the near thigh.
# Three explicit warm-wood sections restore the root volume, preserving leg gap.
SKILL_C = revise(SKILL_C, '''
78 42 krrrbbbko
79 42 krrrbbbko
80 42 krrrbbbko
81 42 krrrbbbko
''')
save('skill_c', SKILL_C, True)
# Recovery qi retains a splinter on the folding branch tip as other needles fall.
SKILL_C = revise(SKILL_C, '''
74 53 gnlg
75 51 gnltg
76 49 gntg
''')
save('skill_c', SKILL_C, True)

# Current sleep revision: independent literal records in repair_sleep.py.
# Keep the old construction above as provenance, never publish it over the
# revised canonical sleep grids when this authoring helper is replayed.
from repair_sleep import SLEEP_A as REPAIRED_SLEEP_A, SLEEP_B as REPAIRED_SLEEP_B, write_literal
write_literal('sleep_a', REPAIRED_SLEEP_A)
write_literal('sleep_b', REPAIRED_SLEEP_B)

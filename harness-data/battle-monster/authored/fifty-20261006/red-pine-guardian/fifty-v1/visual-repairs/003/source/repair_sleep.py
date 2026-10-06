"""Explicit native rows for the two sleeping pine guardians.

Only literal ASCII records make pixels. No masks, shading functions, body
transforms, outline fill, or extraction from any reference. Final grids are the
canonical source. Before-repair grids remain in history/before-sleep-repair.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SLEEP_A = '''
23 42 gng
24 40 gnnlng
25 39 gnlallnvg
26 37 gngnlalannvg
27 36 gnlnllaalnnvg
28 34 gngnlallnnnnvgg
29 32 gnlngnlaallnnnvvgg
29 51 gng
30 30 gnlalnnlallnnnnnvvg
30 26 gng
30 49 gnlnlng
31 28 gngnlallnnnlnnnnnvvgg
31 24 gnlng
31 49 gnlalalnvg
32 26 gnlngnlaallnnnnnnnvvvgg
32 22 gnlalnvgg
32 50 gnlallalnnvgg
33 23 gnggnlallnnnnnnnnnvvg
33 20 gnllallnnvgg
33 51 gnlallllnnnnvgg
34 21 gnlngnlaallnnnnnnvvgg
34 18 gnlallnnnvvgg
34 52 gnllallnnnnnnnvgg
35 19 gnlalnnllallnnnnvvgg
35 16 gnllnnnnvvgg
35 53 gnlallnnnnnnnnnvgg
36 17 gngnlallnnnnnnvvvggggknlnnnvgg
36 14 gnlnnnvvvgg
36 54 gnllalnnnnnnnnnvvgg
37 15 gnlnnllallnnnnvvggkbrrbggnnnvvg
37 15 gnnnnvvgg
37 56 gnlallnnnnnnnnvvvng
38 14 gnlalnnlallnnvvggbrrssrbggnnvgg
38 17 ggvvvgg
38 58 gnllnnnnnnnnnvvvng
38 63 gn
39 16 gnlallnnnnnnvvgbrrsshhsrbggnvvgg
39 60 gnnllnnnnnnnvvvvng
39 63 gvn
40 18 gnnllnnnnnvvgkbrrsshhihssrbkggg
40 60 gnnnnnnnnnnvvvvgg
40 62 gvvn
41 20 gnnnnnnvvvggkbrrshhihhssrrbko
41 59 gnnnnnnnnvvvvgg
41 61 gnvv
42 22 ggnnnvvgg..okrrshhihhssrrbbko
42 59 gnlngnnnnvvgg
43 24 gggvgg....okrrshhihhssrrbbko
43 58 gnllalnnnnnvgg
43 59 nlal
44 27 gg......okrrshhhssrrrbbko
44 58 gnlallnnnnnnvgg
44 60 nlall
45 36 okrrshhhssrrrbbko
45 57 gnllalnnnnnnnvvng
45 59 nllal
46 36 orsshhssrrrbbbbko
46 57 gnlallnnnnnnvvvvng
47 24 gng.........orshhssrrrbbbbko
47 56 gnnllnnnnnnvvvvng
48 22 gnlng.........orshhssrrrbbbbko
48 55 gnllnnnnnnvvvvgg
49 20 gnnllnvgg..ggnnvorshhssrrrbbbbko
49 55 gnnnnnnnnvvvgg
50 19 gnlallnnvgggnlnvvorshhssrrrbbbbko
50 57 ggnnnnvvvgg
51 18 gnnllnnnnvvggggvborshhssrrrbbbbko
51 59 ggvvvggg
52 20 gnnnnnvvvvgg...okrrshhssrrrbbbbko
52 61 gggg
53 22 ggvvvvgg....okrrshhhssrrrrbbbko
54 25 gggg......okrrshhhssrrrrbbbko
55 36 orsshhssrrrrbbbbko
56 37 orshhssrrrrbbbbko
57 38 orshhssrrrrbbbbko
58 39 orshhssrrbbkbbbko
59 39 orshhssrssrrrbbbbo
60 39 orshhssrssrrrbbbbo
61 39 orshhssrbbbrrbbbrrbo
62 39 orshhssrskkrrbkkrsro
63 39 orshhssrsssrrbrrssro
64 38 okrshhssrssrrbbbkbbko
65 36 okrrshhssrrrbbkkrrbko
66 34 okrrsshhssrrrbbkkrrssrbko
67 32 okrrsshhssrrrrbbkkrrshssrbko
68 31 orrsshhssrrbrrbbkkrrshhssrbbo
69 30 orsshhssbrrbrbbkkrrshhssrrbbo
70 29 orshhssbbkrrrbbkkrrshssrrrbbo
71 28 orshhssbbkrrrbbkkrrssrrrbbbko
72 28 orshhssbkkrrrbbbkkrrssrbbbko
73 28 orsshhssbkrrrbbbkkrrssbbbko
74 29 okrrsshhssbkkrrbbkkrrshssbko
74 51 bkrrbko
75 30 okrrsshhssrrbkkrbkkrrshhssbko
75 51 rssrbko
76 32 okrrsshhssrrrbkkrkkrrshhssbko
76 50 rssrrbko
77 34 okrrsshhssrrbbkkrrshhssrrbko
77 50 kkrrbko
77 58 rbko
78 34 okrrbkkbrrrbbkkrrshhssrrbko
78 52 krrbkoo
78 60 ko
79 32 okrrsshhssrrbbkkrrssrrrbbbko
80 30 okrrsshhssrrrbbkrrsshhssrrbbko
81 29 orsshhssrrrbbbkkrrsshhssrrrbbo
82 28 orshhssrrrbbbko.krrsshhssrrbbbo
83 28 orshhssrrbbko...okrrsshhssrrbbbo
84 29 orsshhssrbko.....okrrsshhssrrbbko
85 30 orsshhssrbko.......okrrsshhssrbko
86 29 okrrsshhssrbko......okrrshhssrbko
87 27 okrrsshhssrrbko......orshhssrbko
88 25 okrrsshhssrrrbko......orshhssrbko
89 23 okrrsshhssrrrrbko......orshhssrrbkoo
90 21 okrrshhssrrsrrbbko.....okrrsshhssrrrbkoo
91 20 orsshsrrbsrrrbbbko.....orsssrrbrrrssrrbko
92 21 ookkkkkkkkkkkkkko.....ookkkkkkkkkkkkkko
'''


SLEEP_B = '''
23 42 gng
24 40 gnnlng
25 39 gnlaalnvg
26 37 gngnlalannvg
27 36 gnlnllaalnnvg
28 34 gngnlallnnnnvgg
29 32 gnlngnlaallnnnvvgg
29 51 gng
30 30 gnlalnnlallnnnnnvvg
30 26 gng
30 49 gnlnlng
31 28 gngnlallnnnlnnnnnvvgg
31 24 gnlng
31 49 gnlalalnvg
32 26 gnlngnlaallnnnnnnnvvvgg
32 22 gnlalnvgg
32 50 gnlallalnnvgg
33 23 gnggnlallnnnnnnnnnvvg
33 20 gnllallnnvgg
33 51 gnlallllnnnnvgg
34 21 gnlngnlaallnnnnnnvvgg
34 18 gnlallnnnvvgg
34 52 gnllallnnnnnnnvgg
35 19 gnlalnnllallnnnnvvgg
35 16 gnllnnnnvvgg
35 53 gnlallnnnnnnnnnvgg
36 17 gngnlallnnnnnnvvvggggknlnnnvgg
36 14 gnlnnnvvvgg
36 54 gnllalnnnnnnnnnvvgg
37 15 gnlnnllallnnnnvvggkbrrbggnnnvvg
37 15 gnnnnvvgg
37 56 gnlallnnnnnnnnvvvng
38 14 gnlalnnlallnnvvggbrrssrbggnnvgg
38 17 ggvvvgg
38 58 gnllnnnnnnnnnvvvng
38 63 gn
39 16 gnlallnnnnnnvvgbrrsshhsrbggnvvgg
39 60 gnnllnnnnnnnvvvvng
39 63 gvn
40 18 gnnllnnnnnvvgkbrrsshhihssrbkggg
40 60 gnnnnnnnnnnvvvvgg
40 62 gvvn
41 20 gnnnnnnvvvggkbrrshhihhssrrbko
41 59 gnnnnnnnnvvvvgg
41 61 gnvv
42 22 ggnnnvvgg..okrrshhihhssrrbbko
42 59 gnlngnnnnvvgg
43 24 gggvgg....okrrshhihhssrrbbko
43 58 gnllalnnnnnvgg
43 59 nlal
44 27 gg......okrrshhhssrrrbbko
44 58 gnlallnnnnnnvgg
44 60 nlall
45 36 okrrshhhssrrrbbko
45 57 gnllalnnnnnnnvvng
45 59 nllal
46 36 orsshhssrrrbbbbko
46 57 gnlallnnnnnnvvvvng
47 24 gng.........orshhssrrrbbbbko
47 56 gnnllnnnnnnvvvvng
48 22 gnlng.........orshhssrrrbbbbko
48 55 gnllnnnnnnvvvvgg
49 20 gnnllnvgg..ggnnvorshhssrrrbbbbko
49 55 gnnnnnnnvvvvgg
50 19 gnlallnnvgggnlnvvorshhssrrrbbbbko
50 57 ggnnnvvnvgg
51 18 gnnllnnnnvvggggvborshhssrrrbbbbko
51 59 ggvvnngg
52 20 gnnnnnvvvvgg...okrrshhssrrrbbbbko
52 61 gggg
53 22 ggvvvvgg....okrrshhhssrrrrbbbko
54 25 gggg......okrrshhhssrrrrbbbko
55 35 orsshhhssrrrrbbbbko
56 36 orshhhssrrrrbbbbko
57 37 orshhhssrrrrbbbbko
58 38 orshhhssrrbbkbbbko
59 38 orshhhssrssrrrbbbbo
60 38 orshhhssrssrrrbbbbo
61 38 orshhhssrbbbrrbbbrrbo
62 38 orshhhssrskkrrbkkrsro
63 38 orshhhssrsssrrbrrssro
64 37 okrshhhssrssrrbbbkbbko
65 35 okrrshhhssrrrbbkkrrbko
66 33 okrrsshhhssrrrbbkkrrssrbko
67 32 okrrsshhssrrrrbbkkrrshssrbko
68 31 orrsshhssrrbrrbbkkrrshhssrbbo
69 30 orsshhssbrrbrbbkkrrshhssrrbbo
70 29 orshhssbbkrrrbbkkrrshssrrrbbo
71 28 orshhssbbkrrrbbkkrrssrrrbbbko
72 28 orshhssbkkrrrbbbkkrrssrbbbko
73 28 orsshhssbkrrrbbbkkrrssbbbko
74 29 okrrsshhssbkkrrbbkkrrshssbko
74 51 bkrrbko
75 30 okrrsshhssrrbkkrbkkrrshhssbko
75 51 rssrbko
76 32 okrrsshhssrrrbkkrkkrrshhssbko
76 50 rssrrbko
77 34 okrrsshhssrrbbkkrrshhssrrbko
77 50 kkrrbko
77 58 rbko
78 34 okrrbkkbrrrbbkkrrshhssrrbko
78 52 krrbkoo
78 60 ko
79 32 okrrsshhssrrbbkkrrssrrrbbbko
80 30 okrrsshhssrrrbbkrrsshhssrrbbko
81 29 orsshhssrrrbbbkkrrsshhssrrrbbo
82 28 orshhssrrrbbbko.krrsshhssrrbbbo
83 28 orshhssrrbbko...okrrsshhssrrbbbo
84 29 orsshhssrbko.....okrrsshhssrrbbko
85 30 orsshhssrbko.......okrrsshhssrbko
86 29 okrrsshhssrbko......okrrshhssrbko
87 27 okrrsshhssrrbko......orshhssrbko
88 25 okrrsshhssrrrbko......orshhssrbko
89 23 okrrsshhssrrrrbko......orshhssrrbkoo
90 21 okrrshhssrrsrrbbko.....okrrsshhssrrrbkoo
91 20 orsshsrrbsrrrbbbko.....orsssrrbrrrssrrbko
92 21 ookkkkkkkkkkkkkko.....ookkkkkkkkkkkkkko
'''


def write_literal(name, block):
    canvas = [['.'] * 96 for _ in range(96)]
    for record in block.strip().splitlines():
        ys, xs, ink = record.split()
        y, x = int(ys), int(xs)
        canvas[y][x:x + len(ink)] = ink
    (ROOT / 'actions' / (name + '.pxgrid')).write_text(
        '\n'.join(''.join(row) for row in canvas) + '\n', encoding='ascii')


if __name__ == '__main__':
    write_literal('sleep_a', SLEEP_A)
    write_literal('sleep_b', SLEEP_B)
    from repair_requested import apply
    apply(selected={'sleep_a', 'sleep_b'})

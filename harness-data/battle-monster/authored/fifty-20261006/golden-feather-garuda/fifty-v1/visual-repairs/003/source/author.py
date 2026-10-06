"""Literal native pixel clusters. No geometric drawing or pose transforms.
Blocks are explicit (y, x, ASCII row) selections. Unchanged rows may persist;
changed rows/regions are authored below, never transformed from another pose.
"""
from pathlib import Path
import json
ROOT=Path(__file__).parent
PAL={'X':'#251D25','s':'#51352D','b':'#805032','g':'#AE7333','o':'#D59A3B','h':'#EFC45C','k':'#FFE394','w':'#FFF4D2','t':'#596776','v':'#8C9A9E','i':'#C2CDC7','j':'#EAF0DD','n':'#101923','e':'#FFCF45','p':'#775474','q':'#B1C459','r':'#DFE992'}
(ROOT/'poses').mkdir(exist_ok=True)
(ROOT/'actions').mkdir(exist_ok=True)
(ROOT/'palette.json').write_text(json.dumps(PAL,indent=2)+'\n')
frames={}
def block(canvas,y,rows):
    for dy,line in enumerate(rows.strip('\n').splitlines()):
        if not line.strip(): continue
        x,ink=line.split(' ',1); x=int(x); ink=ink.strip()
        assert x>=1 and x+len(ink)<=127,(y+dy,x,ink)
        assert set(ink)<=set(PAL)|{'.'},(y+dy,ink)
        canvas[y+dy][x:x+len(ink)]=ink

def blank():return [list('.'*128) for _ in range(128)]
def save(name,c):
    frames[name]=[''.join(r) for r in c]
    kind='actions' if name.startswith(('skill','poison','stun','sleep')) else 'poses'
    (ROOT/kind/(name+'.pxgrid')).write_text('\n'.join(frames[name])+'\n')

a=blank()
# Far wing: its leading shoulder folds toward the nape; individual primaries.
block(a,9,'''
31 XXX
30 XhkX
29 XhkkX
28 XohkkX
27 XohhkkX
26 XgohhkkX
25 XgohhhkkX
24 XgohhhhkkX
23 XbgohhhhkkX
22 XbgohhhhkkkX
21 XbgohhhhhkkkX
20 XbgohhhhohkkkX
19 XbgohhhhoohkkkX
18 XbgohhhhooohkkkX
17 XbgohhhhoooohkkkX
16 XbgohhhhooooohkkkX
15 XbgohhhhoooooohkkkX
14 XbgohhhhooooooohkkkX
13 XbgohhhhoooooooohkkkX
12 XbgohhhhooooooooohkkkX
11 XbgohhhhoooooooooohkkkXX
10 XbgohhhhooooooooooohkkkkXX
9 XbgohhhhogoohhhhhhooohkkkkX
8 XbgohhhoggoohhhhhhhhhoohkkkX
8 XsgohhogggoohhhhhhhhhoohkkkX
9 XsgohoggggoohhhhohhhhhoohkkX
10 XsgogggggoohhhoooohhhhhoohkX
11 XsbggggggoohhhoooohhhhhhoohX
12 XsbggggggoohhhoooooohhhhhhoX
13 XsbggggggoohhhooooooohhhhhoX
14 XsbbgggggoohhhoooooooohhhhoX
15 XsbbgggggoohhhooooooooohhhoX
16 XsbbgggggoohhhooooooooohhhoX
17 XsbbgggggoohhhoooogoohhhhoX
18 XsbbgggggoohhhoooggoohhhoX
19 XsbbgggggoohhhooggggoohhoXX
20 XsbbgggggoohhoogggggoohhhoXX
21 XsbbgggggoohhogggoooohhhhhhkXXX
22 XsbbgggggoohogggooohhhhhhhhhhhkXX
23 XsbbgggggoohogggoohhhhhhhhhhhhhhkXX
24 XsbbgggggoohoggohhhhhhhhhhhhhhhhhhkX
25 XsbbgggggoohogohhhhhhkkkkhhhhhhhhhhkX
26 XsbbgggggoohgohhhhkkkkkkkhhhhhhhhhhhoX
27 XsbbgggggoohgohhhkkkkkkkkhhhhhhhhhhhoX
28 XsbbgggggoohgohhkkkkkkkhhhhhhhhhhhhhoX
29 XsbbgggggoohgohhkkkkkkhhhhhhhhhhhhhhoX
30 XsbbgggggoohgohhkkkkkhhhhhhhhhhhoohoX
31 XsbbgggggoohgohhkkkhhhhhhhhhhhoooohoX
32 XsbbgggggoohgohhhhhhhhhhhhhhoooooohoX
33 XsbbgggggoohgohhhhhhhhhhhoooooooohoX
34 XsbbgggggoohgohhhhhhhhooooooooooohoX
35 XsbbgggggoohgohhhhhooooooooooooohoX
36 XsbbgggggoohgohhhooooooooooooooohoX
37 XsbbgggggoohgohhoooooooooooooooohoX
38 XsbbgggggoohgohhoooooooooooooooohoX
39 XsbbgggggoohgohhooooooooooooooohoX
40 XsbbgggggoohgohhoooooooooooooohoX
41 XsbbgggggoohgohhooooooooooooohoX
42 XsbbgggggoohgohhooooooooogggoX
43 XsbbgggggoohgohhooooooogggoX
44 XsbbgggggoohgohhooooogggoX
45 XsbbgggggoohgohhooogggoX
46 XsbbgggggoohgohhogggoX
47 XsbbgggggoohgohogggoX
48 XsbbgggggoohgoggggoX
49 XsbbgggggoohgggggoX
50 XsbbgggggoohggggoX
51 XsbbgggggoohgggoX
52 XsbbgggggoohggoX
53 XsbbgggggoohgoX
54 XsbbgggggoohgoX
55 XsbbgggggoohgoX
56 XsbbgggggoohgoX
57 XsbbgggggoohgoX
''')
# Crown, right-facing beak, black swept brows, asymmetrical near/far golden eyes.
block(a,24,'''
78 XXXXX
75 XXXhkkkXXX
73 XXohhkkkkkkXX
71 XXoohhhkkkkkkkX
70 XgoohhhhkkkkkkkkX
69 XgoohhhhhkkkkkkkkkXX
68 XgoohhhhhhhkkkkkkkkkkXX
67 XgoohhhhhhhhhkkkkkkkkkkX
67 XgoohhhhhhhhhhhhhhhhhhhkX
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhhhhhhhhhhhhhhhhoXX
66 XbgoohhhhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhhXXXXXhhhoX
66 XbgoohhhXneXhhhhhhXneeeXhhoX
66 XbgoohhhXeeXohhhhhXeeenXohoX
66 XbgoohhhhXXooghhhhoXXXohhoX
66 XbgoohhhhhhooghhhhohhhjjjjXXX
66 XbgoohhhhhhooghhhhohjjwwwwwwjXXX
66 XbgohhhhhhhhooghhhojjwwwwwwwwwjjXX
66 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiXX
66 XbgoohhhhjjhhhhhohjjwwwjiiiiiiiiiitX
66 XbgoohhhjjjjhhhooijjjjiiiivvvvvvttX
66 XbgoohhjjwwjjjhooiijiiivvvttttttX
65 XbgohjjwwwwwjjjhooiiivvttttXXttX
64 XbgohjjwwwwwwwjjhhoiivvttX...XX
63 XbgohjjwwwwwwwwwjjhooivvtX
62 XbgohjjwwwwwwwwwwjjhooivvX
61 XbgohjjwwwwwwwwwwwjjhooivX
60 XbgohjjwwwwwwwwwwwjjhooivX
59 XbgohjjwwwwwwwwwwwjjhooivX
58 XbgohjjwwwwwjjwwwwwjjhooivX
57 XbgohjjwwwwjjijwwwwwjjhooivX
56 XbgohjjwwwjjiijjwwwwwjjhoivX
55 XbgohjjwwjjiivijjwwwwjjhoivX
54 XbgohjjwjjiivviijjwwwjjhoivX
53 XbgohjjjjiivvvviijjwwjjhoivX
52 XbgohjjiivvvttvviijjwjhoivX
51 XbgohjiivvtttttvviijjhoivX
50 XbgohiivvtttttttvviijhoivX
''')
# Rounded avian breast and near wing, fan-shaped coverts then long primaries.
block(a,64,'''
45 XXbgohhhhhhhhhhkkkkkhhhoijjwwjjhoivX
43 XXbgoohhhhhhhhhkkkkkhhhoijjwwjhooivX
42 XbbgoohhhhhhhhhhkkkhhhhoijjjhooovvX
41 XbbgoohhhhhhhhhhhhhhhhooijjhooovvX
40 XbbgoohhhhhhhhhhhhhhhhooijhooovvX
40 XbbgoohhhhhhhhhhhhhhhhooijhooovvXX
40 XbbgoohhhhhhhhhhhhhhoooojhooovvXoX
39 XsbbgoohhhhhhhhhhhhooooojhooovvXohX
38 XssbbgoohhhhhhhhhhoooooohooogvXohhkX
37 XssbbgoohhhhhhhhhooooooogooogvXohhkkX
36 XssbbgoohhhhhhhhoooooooogooogvXohhkkX
35 XssbbgoohhhhhhhoooogooogooogvXohhkkX
34 XssbbgoohhhhhhhooogggooogooogvXohkkkX
33 XssbbgoohhhhhhhoogggggooogooogvXohkkX
32 XssbbgoohhhhhhoogggggggooogooogvXohkX
31 XssbbgoohhhhooggggggggggooogooogvXohX
30 XssbbgoohhhooggggggggggggooogooogvXoX
29 XssbbgoohhooggggggggggggggooogooogvXX
28 XssbbgoohhooggggggggggggggooogooogvX
27 XssbbgoohhooggggggggggggggooogooogvX
26 XssbbgoohhooggggggggggggggooogooogvX
25 XssbbgoohhoogggooogggooogggooogooogvX
24 XssbbgoohhoogggooogggooogggooogooogvX
23 XssbbgoohhoogggooogggooogggooogooogvX
22 XssbbgoohhoogggooogggooogggooogooogvX
21 XssbbgoohhoogggooogggooogggooogooogvX
20 XssbbgoohhoogggooogggooogggooogooogvX
19 XssbbgoohhoogggooogggooogggooogooogvX
18 XssbbgoohhoogggooogggooogggooogooogvX
18 XssbbgoohhoogggooogggooogggooogooogvX
19 XssbbgoohhoogggooogggooogggooogooogvX
20 XssbbgoohhoogggooogggooogggooogooogvX
21 XssbbgoohhoogggooogggooogggooogooogvX
22 XssbbgoohhoogggooogggooogggooogooogvX
23 XssbbgoohhoogggooogggooogggooogooogvX
24 XssbbgoohhoogggooogggooogggooogooogvX
25 XssbbgoohhoogggooogggooogggooogooogvX
26 XssbbgoohhoogggooogggooogggooogooogvX
27 XssbbgoohhoogggooogggooogggooogooogvX
28 XssbbgoohhoogggooogggooogggooogooogvX
29 XssbbgoohhoogggooogggooogggooogooogvX
30 XssbbgoohhoogggooogggooogggooogooogvX
31 XssbbgoohhoogggooogggooogggooogooogvX
32 XssbbgoohhoogggooogggooogggooogooogvX
33 XssbbgoohhoogggooogggooogggooogooogvX
34 XssbbgoohhoogggooogggooogggooogooogvX
''')
# Three different tail quills (not one triangular slab).
block(a,87,'''
12 XXX
11 XohkXX
10 XgohkkXX
9 XbgohhkkXX
8 XbgohhhkkkXXX
8 XbgohhhhhkkkhhXX
9 XbgohhhhhhhhhhhkXX
10 XbgohhhhhhhhhhhhkkXX
11 XbgohhhhhhhhhhhhhkkkXX
12 XbgohhhhhhhhhhhhhhhkkkXX
13 XbgohhhhhoooooooooohkkkXX
14 XbgohhhoooooooooooohkkkkXX
15 XbgohhooooooooooooohhkkkkXX
16 XbgooogggooooooooooohhkkkkXX
17 XsbbgggggooooooooogoohhkkkkXX
18 XsbbgggggggooooooggoohhkkkkXX
19 XsbbgggggggggooogggoohhkkkkXX
20 XssbbggggggggggggggoohhkkkkXX
21 XssbbggggggggggggggoohhkkkkXX
22 XssbbggggggggggggggoohhkkkkXX
23 XssbbggggggggggggggoohhkkkkXX
24 XssbbggggggggggggggoohhkkkkXX
25 XssbbggggggggggggggoohhkkkkXX
26 XssbbggggggggggggggoohhkkkXXX
27 XssbbggggggggggggggoohhkXX
28 XssbbggggggggggggggoohhX
29 XssbbggggggggggggggoohX
30 XssbbggggggggggggggooX
31 XssbbggggggggggggggoX
32 XssbbggggggggggggggX
33 XssbbgggggggggggggX
34 XssbbggggggggggggX
35 XssbbgggggggggggX
36 XssbbggggggggggX
''')
# Override the lower breast; terminate individual near-wing primaries explicitly.
block(a,90,'''
49 sbbggoooooooooggoohhkkXbgoooooogggoX
50 sbbggoooooooogggoohkkXbbgoooogggoX
51 sbbggooooooogggoohkXbbgooooggggoX
52 sbbggoooooogggoohXbbgooooggggoX
53 sbbggooooogggoohXbbgooooggggoX
54 sbbggooogggoohXbbgooooggggoX
55 sbbggoogggoohXbbgooooggggoX
56 sbbggogggoohXbbgooooggggoX
57 sbbgggggoohXbbgooooggggoX
58 sbbggggoohXbbgooooggggoX
59 sbbgggoohXbbgooooggggoX
60 sbbggoohXbbgooooggggoX
61 sbbgoohXbbgooooggggoX
62 sbbgohXbbgooooggggoX
63 sbbgoXbbgooooggggoX
64 sbbgXbbgooooggggoX
65 sbbXbbgooooggggoX
66 ssXbbgooooggggoX
67 XXbbgooooggggoX
68 XbbgooooggggoX
69 XbbgooooggggoX
70 XbbgooooggggoX
71 XbbgooooggggoX
72 XbbgooooggggoX
73 XbbgooooggggoX
''')
# Feathered thighs to silver tarsi and two grounded spread feet.
block(a,98,'''
59 XXbgoohhhhX.........XbgoohhhX
59 XbgoohhhhhX.........XbgoohhhhX
60 XbgoohhhhX..........XbgoohhhhX
60 XbgohhhhX............XbgohhhhX
61 XbgoohhX..............XbgohhhhX
61 XbgoohX...............XbgohhhhX
62 XboohX................XbgohhhhX
62 XjivvX................XjiiivvX
62 XjiivtX...............XjjiiivvX
62 XjiivttX..............XjjiiivttX
62 XjiivttX...............XjjiiivttX
62 XjiivttX...............XjjiiivttX
62 XjiivttX...............XjjiiivttX
62 XjiivttX................XjjiiivttX
61 XjiiivttX................XjjiiivttX
60 XjiiiivttX...............XjjiiivttX
59 XjiiiivvttX..............XjjiiivvttX
58 XjiiiivvvttX.............XjjiiivvttX
57 XjiiiiivvvttX............XjjiiiivvttX
56 XjjiiiiivvvttXX..........XjjiiiiivvvttXX
55 XjjiiiiiiivvvtttXX........XjjiiiiiiivvvtttXX
54 XjjiiivvXiiivvvtttXX......XjjiiivvvXiiivvvtttXX
53 XjjiiivtXjjiiivvvtttXX....XjjiiivvtXjjiiivvvtttXX
52 XjjiiittXjjiiiittXjjjjXX..XjjiiivttXjjiiiittXjjjjXX
51 XjjjitXX.XjjjittX.XjjjitX.XjjjittXX.XjjjittX.XjjjitX
51 XXXXX....XXXXXX...XXXXXX..XXXXXXX...XXXXXX...XXXXXX
''')
save('idle_a',a)
# First native inspection repair: replace the sloping neck and interrupted belly.
# Every row below is a new literal choice; no automatic closure or geometry.
a[48:125]=[list('.'*128) for _ in range(77)]
block(a,48,'''
64 XbgohjjwwwwwwwjjhhoiivvttX...XX
63 XbgohjjwwwwwwwwwjjhooivvtX
63 XbgohjjwwwwwwwwwwjjhooivvX
62 XbgohjjwwwwwwwwwwwjjhooivX
62 XbgohjjwwwwwwwwwwwjjhooivX
61 XbgohjjwwwwwjjwwwwwjjhooivX
61 XbgohjjwwwwjjijwwwwwjjhooivX
60 XbgohjjwwwjjiijjwwwwwjjhooivX
59 XbgohjjwwjjiivijjwwwwjjhooivX
58 XbgohjjwjjiivviijjwwwjjhooivX
57 XbgohjjjjiivvvviijjwwjjhooivX
56 XbgohjjiivvvttvviijjwjhooivX
54 XXbgohjiivvtttttvviijjhooivX
52 XXbgohhiivvtttttttvviijhooivX
50 XXbgohhhiivvvttttttvviijhooivX
48 XXbgohhhhiivvvtttttvviijhooivX
46 XXbgohhhhhiivvvttttvviijhooivX
44 XXbgoohhhhhiivvvtttvviijhoooivX
42 XXbgoohhhhhhiivvtttvviijhoooivX
40 XXbgoohhhhhhhiiivvtvviijhoooovvX
38 XXbbgoohhhhhhhiivvvvviijhoooovvX
36 XXbbgoohhhhhhhhiivvvviijhoooogvX
34 XXbbgoohhhhhhhhhiivvviijhoooogvX
32 XXbbgoohhhhhhhhhoiivviijhoooogvX
30 XXbbgoohhhhhhhhhooiiviijhoooogvX
28 XXbbgoohhhhhhhhhoooiiijhoooogggoX
26 XXbbgoohhhhhhhhhooooiijhooogggoX
24 XXbbgoohhhhhhhhhoooooiijhoogggoX
22 XXbbgoohhhhhhhhoooooooiijhoogggoX
20 XXbbgoohhhhhhhhooooooooiijhoogggoX
18 XXbbgoohhhhhhhhoooooooooiijhoogggoX
17 XsbbgoohhhhhhhhoooooooooiijhoogggoX
16 XssbbgoohhhhhhhoooooooooiijhoogggoX
15 XssbbgoohhhhhhoooooogooooijhoogggoX
14 XssbbgoohhhhhooooooggoooojhoogggoX
13 XssbbgoohhhhoooooogggoooohoogggoX
12 XssbbgoohhhooooooggggoooohoogggoX
12 XssbbgoohhoooooogggggoooohoogggoX
13 XssbbgoohhoooooggggggoooohoogggoX
14 XssbbgoohhoooogggggggoooohoogggoX
15 XssbbgoohhooogggoogggoooohoogggoX
16 XssbbgoohhooggggoogggoooohoogggoX
17 XssbbgoohhooggggoogggoooohoogggoX
18 XssbbgoohhooggggoogggoooohoogggoX
19 XssbbgoohhooggggoogggoooohoogggoX
20 XssbbgoohhooggggoogggoooohoogggoX
21 XssbbgoohhooggggoogggoooohoogggoX
22 XssbbgoohhooggggoogggoooohoogggoX
23 XssbbgoohhooggggoogggoooohoogggoX
24 XssbbgoohhooggggoogggoooohoogggoX
25 XssbbgoohhooggggoogggoooohoogggoX
26 XssbbgoohhooggggoogggoooohoogggoX
27 XssbbgoohhooggggoogggoooohoogggoX
28 XssbbgoohhooggggoogggoooohoogggoX
29 XssbbgoohhooggggoogggoooohoogggoX
30 XssbbgoohhooggggoogggoooohoogggoX
31 XssbbgoohhooggggoogggoooohoogggoX
32 XssbbgoohhooggggoogggoooohoogggoX
33 XssbbgoohhooggggoogggoooohoogggoX
34 XssbbgoohhooggggoogggoooohoogggoX
35 XssbbgoohhooggggoogggoooohoogggoX
36 XssbbgoohhooggggoogggoooohoogggoX
37 XssbbgoohhooggggoogggoooohoogggoX
38 XssbbgoohhooggggoogggoooohoogggoX
39 XssbbgoohhooggggoogggoooohoogggoX
40 XssbbgoohhooggggoogggoooohoogggoX
''')
# Broad breast keeps a round volume behind the feather fan.
block(a,65,'''
67 goohhhjjwwjjhoooivvX
67 goohhhjjwwjjhoooivvX
67 goohhhhjjjjhoooovvX
67 goohhhhhjjjhoooovvX
67 goohhhhhhhhooooovvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhhooooogvX
67 goohhhhhhhoooooggvX
67 goohhhhhhooooogggvX
67 goohhhhhoooooggggvX
67 goohhhhoooooggggvX
67 goohhhoooooggggvX
67 goohhoooooggggvX
67 goohhooooggggvX
67 goohhooogggoX
67 goohhoogggoX
67 goohhogggoX
67 goohogggoX
67 goohgggoX
67 goohggoX
67 goohgoX
67 goohgoX
67 goohgoX
''')
# Near wing feather breaks, three broad tapered primaries, linked at shoulder.
block(a,85,'''
13 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
14 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
15 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
16 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
17 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
18 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
19 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
20 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
21 XsbbgoohhkXbgggohhkkXbgggoohhhkkX
22 XsbbgoohhXsbggohhkkXbgggoohhhkkX
23 XsbbgoohX.sbggohhkkXbgggoohhhkkX
24 XsbbgoX..XsbggohhkXbgggoohhhkkX
25 XsbbgX...XsbggohhXbgggoohhhkkX
26 XsbbX....XsbggohXsbgggoohhkkX
27 XXX......XsbggX.XsbgggoohhkX
37 XsbbX..XsbgggoohhX
38 XXX...XsbgggoohX
44 XsbgggoX
45 XsbbggX
46 XsbbXX
47 XXXX
''')
# Three tail tips deliberately staggered with small gaps at the terminal forks.
block(a,95,'''
8 XXohhhkkXX
7 XgohhhhhkkkXXX
6 XbgohhhhhhhkkkhhhXX
5 XbgohhhhhhhhhhhhhhhXX
5 XbgohhhhhhhhhhhhhhhhkkXX
6 XbgohhhhhhhhhoooooohhhkkXX
7 XbgohhhhhhoooooooooohhhkkXX
8 XbgohhhoooooooooooooohhhkkXX
9 XbgoooooooooogoooooooohhhkkXX
10 XbgoooooooggggoooooooohhhkkXX
11 XbgoooooggggggoooooooohhhkkXX
12 XbgoooggggggggoooooooohhhkkXX
13 XbgoogggggggggoooooooohhhkkXX
14 XbggggggggggggoooooooohhhkkXX
15 XbggggggggggggoooooooohhhkkXX
16 XbggggggggggggoooooooohhhkkXX
17 XbggggggggggggoooooooohhhkkXX
18 XbggggggggggggoooooooohhkkX
19 XbggggggggggggoooXooooohkX
20 XbggggggggggggooX.XooohkX
21 XbgggggggggggooX...XoohX
22 XbggggggggggooX....XohX
23 XbgggggggggooX.....XoX
24 XbgggggggooX......XX
25 XbggggggoX
26 XbggggoX
27 XbgggoX
28 XbgoX
29 XXX
''')
# Ground contact includes thick tarsi and flattened roots of curling silver toes.
block(a,96,'''
58 XXbgoohhhhXX............XXbgoohhhhXX
58 XbgoohhhhhhX............XbgoohhhhhhX
59 XbgoohhhhhhX.............XbgoohhhhhhX
59 XbgoohhhhhX..............XbgoohhhhhhX
60 XbgoohhhhX................XbgoohhhhhX
60 XbgoohhhX.................XbgoohhhhhX
61 XbgoohhX...................XbgoohhhhX
61 XbgoohX....................XbgoohhhhX
62 XjiivX.....................XjjiiivvX
62 XjiivtX....................XjjiiivvtX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
62 XjiivttX...................XjjiiivvttX
61 XjiiivttX..................XjjiiivvttX
60 XjiiiivttX.................XjjiiivvttX
59 XjiiiivvttX................XjjiiivvttX
58 XjiiiivvvttX...............XjjiiiivvttX
57 XjiiiiivvvttX..............XjjiiiivvttX
56 XjjiiiiivvvttXX............XjjiiiiivvvttXX
55 XjjiiiiiiivvvtttXX..........XjjiiiiiiivvvtttXX
54 XjjiiivvXiiivvvtttXX........XjjiiivvvXiiivvvtttXX
53 XjjiiivtXjjiiivvvtttXX......XjjiiivvtXjjiiivvvtttXX
52 XjjiiittXjjiiiittXjjjjXX....XjjiiivttXjjiiiittXjjjjXX
51 XXXXXXXX.XXXXXXX.XXXXXXX...XXXXXXXX.XXXXXXX.XXXXXXX
''')
# Nape-to-wing bridge, far-wing seam hidden underneath the pale mane.
block(a,48,'''
48 sbbggggoohhkkkkhhhX
49 sbbggggoohhkkkhhhhX
50 sbbggggoohhkkhhhhhX
51 sbbggggoohhkhhhhhX
52 sbbggggoohhhhhhhhX
53 sbbggggoohhhhhhhX
54 sbbggggoohhhhhhX
55 sbbggggoohhhhhX
56 sbbggggoohhhhX
57 sbbggggoohhhX
''')
save('idle_a',a)
# Crown has a swept golden crest, wing tips have separate rounded quills.
block(a,20,'''
68 XXX
67 XhkXX
66 XohkkXX
65 XgohkkkXX
64 XbgohkkkkXX
64 XbgoohkkkkkXX
65 XbgoohkkkkkhhXXX
66 XbgoohhhhhhhhhhkXX
67 XbgoohhhhhhhhhhhhkX
68 XbgoohhhhhhhhhhhhhX
''')
block(a,34,'''
78 hhhhhXXXhhhhhhXXXXXhhh
78 hhhhXnnsXhhhhXnnnneXhh
78 hhhhXeeXohhhhXeeeeXohh
78 hhhhhXXooghhhhXXXXohhh
''')
# Primary forks of the upper wing: different literal edges and tip heights.
block(a,15,'''
34 XX
34 XhkX
34 XhkkX
34 XhhkkX
34 XohhkkX
34 XohhhkkX
34 XgohhhkkX
34 XgohhhhkkX
34 XgohhhhhkkX
34 XbgohhhhhkkX
34 XbgohhhhhhkkX
34 XbgohhhhhhhkkXX
34 XbgohhhhhhhhkkkXX
34 XbgohhhhhhhhhkkkkXX
34 XbgohhhhhhhhhhkkkkXX
34 XbgohhhhhhhhhhhkkkkXX
34 XbgohhhhohhhhhhhkkkkXX
34 XbgohhhoohhhhhhhhkkkkXX
34 XbgohhooohhhhhhhhhkkkkXX
34 XbgohhoooohhhhhhhhhkkkkXX
34 XbgohhooooohhhhhhhhhkkkkXX
34 XbgohhoooooohhhhhhhhhkkkkXX
34 XbgohhooooooohhhhhhhhhkkkkXX
34 XbgohhoooooooohhhhhhhhhkkkkXX
34 XbgohhooooooooohhhhhhhhhkkkkXX
''')
# Feathered breast: curved low outline and overlapping small scallops.
block(a,81,'''
66 goohhhhhhhhhooooogvX
65 goohhhhhhhhhhooooogvX
65 goohhhhhohhhhhoooogvX
65 goohhhhooohhhhoooogvX
65 goohhhooooohhhoooogvX
65 goohhoooooohhhoooogvX
65 goohhooogooohhoooogvX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
65 goohhooogggoohhoooggX
''')
# The shoulder bridge remains flesh/feather volume, not only black outlines.
block(a,61,'''
63 ohhiivvvtttttvviijhooivX
63 hhhiivvvtttttvviijhooivX
63 hhhhiivvtttttvviijhooivX
63 hhhhiiivvttttvviijhooivX
''')
save('idle_a',a)

def copy_idle():return [list(r) for r in frames['idle_a']]
def replace(c,y,rows):
    lines=rows.strip('\n').splitlines()
    c[y:y+len(lines)]=[list('.'*128) for _ in lines]
    block(c,y,rows)

# Idle breathing: literal contour expansion of coverts, nape and elbow.
b=copy_idle()
block(b,58,'''
55 XXbgohjjjjiivvvviijjwwjjhoooivX
54 XXbgohjjiivvvttvviijjwjhoooivX
52 XXbgohjiivvtttttvviijjhoooivX
50 XXbgohhiivvtttttttvviijhoooivX
48 XXbgohhhhiivvtttttvviijhoooivX
46 XXbgohhhhhhiivvvtttvviijhoooivX
44 XXbgoohhhhhhiivvvttvviijhoooivX
42 XXbgoohhhhhhhiiivvtvviijhoooovvX
40 XXbgoohhhhhhhhiiivvvviijhoooovvX
38 XXbgoohhhhhhhhhiiivvviijhoooogvX
''')
block(b,82,'''
66 goohhhhhhhhhhhoooogvX
65 goohhhhhhhhhhhhoooogvX
64 goohhhhhhhhhhhhhhooogvX
64 goohhhhhohhhhhhhhhooogvX
64 goohhhhooohhhhhhhhooogvX
64 goohhhooooohhhhhhoooogvX
64 goohhoooooohhhhhoooogvX
''')
block(b,9,'''
31 XhkX
30 XhkkX
29 XhhkkX
28 XohhkkX
27 XohhhkkX
26 XgohhhkkX
''')
save('idle_b',b)
c=copy_idle()
block(c,35,'''
78 hhhhXnnsXhhhhXnnnneXhh
78 hhhhhXXXohhhhXeeeeXohh
78 hhhhhhooghhhhXXXXohhh
''')
block(c,53,'''
61 XbgohjjwwwwjjjwwwwwjjhooivX
61 XbgohjjwwwjjiijwwwwwjjhooivX
60 XbgohjjwwjjiivijjwwwwjjhooivX
59 XbgohjjwjjiivvijjwwwwjjhooivX
58 XbgohjjjjiivvvviijjwwjjhooivX
57 XbgohjjiivvvttvviijjwjhooivX
''')
block(c,89,'''
21 XsbbgoohkXbgggohhkXbgggoohhhkX
22 XsbbgoohkXbgggohhkXbgggoohhhkX
23 XsbbgoohXsbgggohhkXbgggoohhhkX
24 XsbbgohX.XsbggohhXbgggoohhhkX
25 XsbbgoX..XsbggohXbgggoohhhkX
26 XsbbgX...XsbgggX.XbgggoohhkX
27 XXXX....XsbggX..XsbgggoohhX
''')
save('idle_c',c)

# Windup: folded wings hug a low, bulky chest. Both tarsi bend under thighs.
w=copy_idle()
replace(w,9,'''
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
68 XXX
67 XhkXX
66 XohkkXX
65 XgohkkkXX
64 XbgohkkkkXX
64 XbgoohkkkkkXX
65 XbgoohkkkkkhhXXX
66 XbgoohhhhhhhhhhkXX
67 XbgoohhhhhhhhhhhhkX
68 XbgoohhhhhhhhhhhhhX
''')
# Clear the previously open upper wing, while retaining the independently drawn head.
for yy in range(29,48):w[yy][1:64]=list('.'*63)
block(w,39,'''
43 XXXX
40 XXXhkkXX
38 XXohhhkkkXX
37 XgohhhhhkkkXX
36 XbgohhhhhhhkkkXX
35 XbgohhhhhhhhhkkkXX
34 XbgohhhhhhhhhhhkkkXX
33 XbgohhhhhhhhhhhhhkkkXX
32 XbgohhhhhhhohhhhhhhhkkX
31 XbgohhhhhhooohhhhhhhhkkX
30 XbgohhhhhhoooohhhhhhhhhkX
29 XbgohhhhhooooohhhhhhhhhkX
28 XbgohhhhooooogohhhhhhhhkX
27 XbgohhhoooooggohhhhhhhhkX
27 XbgohhooooogggohhhhhhhhkX
27 XbgohhooooggggohhhhhhhhkX
27 XbgohhooogggggohhhhhhhhkX
28 XbgohhooogggggohhhhhhhhkX
28 XbgohhooogggggohhhhhhhhkX
29 XbgohhooogggggohhhhhhhhkX
30 XbgohhooogggggohhhhhhhhkX
31 XbgohhooogggggohhhhhhhhkX
32 XbgohhooogggggohhhhhhhhkX
33 XbgohhooogggggohhhhhhhhkX
''')
replace(w,63,'''
34 XbgohhooogggggohhhhhhkkXbgohiiivvvttvviijhooivX
34 XbgohhooogggggohhhhhhkkXbgohhiivvvttvviijhooivX
34 XbgohhooogggggohhhhhhkkXbgohhhiivvttvviijhooivX
33 XbgohhooogggggohhhhhhkkXbgoohhhiivvtvviijhooovvX
32 XbgohhooogggggohhhhhhkkXbgoohhhhiiivvviijhooovvX
31 XbgohhooogggggohhhhhhkkXbgoohhhhhiiivviijhooovvX
30 XbgohhooogggggohhhhhhkkXbgoohhhhhhiiiviijhooogvX
29 XbgohhooogggggohhhhhhkkXbgoohhhhhhhiiijhooogvX
28 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhijhooogvX
27 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhjhooogvX
26 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
25 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
24 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
23 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
22 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
21 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
20 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
19 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
18 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
17 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhhooogvX
16 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhhoooggvX
16 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhoooggvX
17 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhoooggvX
18 XbgohhooogggggohhhhhhkkXbgoohhhhhhhhoooggvX
19 XbgohhooogggggohhhhhhkkXbgoohhhhhhhooooggvX
20 XbgohhooogggggohhhhhhkkXbgoohhhhhhoooogggvX
21 XbgohhooogggggohhhhhhkkXbgoohhhhhooooggggvX
22 XbgohhooogggggohhhhhhkkXbgoohhhhooooggggvX
23 XbgohhooogggggohhhhhkkXbgoohhhhoooogggvX
24 XbgohhooogggggohhhhkkXbgoohhhoooogggvX
25 XbgohhooogggggohhhkkXbgoohhhoooogggvX
26 XbgohhooogggggohhkkXbgoohhhoooogggvX
27 XbgohhooogggggohkkXbgoohhhoooogggvX
28 XbgohhooogggggohkXbgoohhhoooogggvX
29 XbgohhooogggggohXbgoohhhoooogggvX
30 XbgohhoooggggohXbgoohhhoooogggvX
31 XbgohhooogggohXbgoohhhoooogggvX
32 XbgohhooogggXbgoohhhoooogggvX
33 XbgohhooogXbgoohhhoooogggvX
34 XbgohhooXbgoohhhoooogggvX
35 XbgohhXbgoohhhoooogggvX
36 XbgohXbgoohhhoooogggvX
37 XbgoXbgoohhhoooogggvX
38 XbgXbgoohhhoooogggvX
39 XXXbgoohhhoooogggvX
40 XbgoohhhoooogggvX
41 XbgoohhhoooogggvX
''')
# Retain actual tail, but overwrite the bent thighs/feet on their own native rows.
block(w,100,'''
60 XXbgoohhhhXX...........XXbgoohhhhXX
60 XbgoohhhhhhX...........XbgoohhhhhhX
59 XbgoohhhhhhhX..........XbgoohhhhhhhX
58 XbgoohhhhhhhX..........XbgoohhhhhhhhX
57 XbgoohhhhhhhhX..........XbgoohhhhhhhX
56 XbgoohhhhhhhhX...........XbgoohhhhhhX
55 XbgoohhhhhhhhX............XbgoohhhhhX
55 XbgoohhhhhhhX..............XbgoohhhhX
56 XbgoohhhhhX.................XjjiiivvX
57 XjiiivvvX....................XjjiiivvX
58 XjiiivvvX.....................XjjiiivvX
59 XjiiivvvX......................XjjiiivvX
60 XjiiivvvX.......................XjjiiivvX
61 XjiiivvvX........................XjjiiivvX
62 XjiiivvvX.........................XjjiiivvX
63 XjiiivvvX..........................XjjiiivvX
64 XjiiivvvX..........................XjjiiivvX
64 XjiiiivvvX.........................XjjiiivvX
63 XjjiiiivvvXX.......................XjjiiiivvXX
62 XjjiiiiivvvttXX....................XjjiiiiivvvttXX
61 XjjiiivXiiivvttXX..................XjjiiivXiiivvttXX
60 XjjiiitXjjiiivvtXX................XjjiiitXjjiiivvtXX
59 XjjjitXX.XjjiiittXjjjXX...........XjjjitXX.XjjiiittXjjjXX
58 XjjittX...XjjjittXXjjjitX.........XjjittX...XjjjittXXjjjitX
58 XXXXXX....XXXXXXX.XXXXXX.........XXXXXX....XXXXXXX.XXXXXX
''')
save('windup',w)
# Native inspection: corrected eye rows occupy the face, not space beyond cheek.
block(a,33,'''
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhXneXhhhhhXnneeXhhoX
66 XbgoohhhXeeXohhhhXeeenXohoX
66 XbgoohhhhXXooghhhhXXXXohhoX
66 XbgoohhhhhhooghhhhhhhhjjjjXXX
66 XbgoohhhhhhooghhhhhhjjwwwwwwjXXX
66 XbgohhhhhhhhooghhhhjjwwwwwwwwwjjXX
''')
# A feathered, rounded hip joins BOTH thighs without deleting the wing silhouette.
block(a,72,'''
58 XbgohhhhhhhhhhoooooogggX
57 XbgohhhhhhhhhhhoooooogggX
56 XbgohhhhhhhhhhhhoooooogggX
55 XbgohhhhhhhhhhhhhoooooogggX
54 XbgohhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhohhhhhoooooogggX
53 XbgohhhhhhhooohhhhoooooogggX
53 XbgohhhhhhooooohhhoooooogggX
53 XbgohhhhhhooooohhhoooooogggX
53 XbgohhhhhoooooohhhoooooogggX
53 XbgohhhhhoooooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
55 XbgohhhhooogooohhhoooooogggX
56 XbgohhhhooogooohhhoooooogggX
57 XbgohhhhooogooohhhoooooogggX
58 XbgohhhhooogooohhhoooooogggX
59 XbgohhhhooogooohhhoooooogggX
60 XbgohhhhooogooohhhoooooogggX
61 XbgohhhhooogggoohhooooogggX
62 XbgohhhooogggoohhooooogggX
63 XbgohhooogggoohhooooogggX
64 XbgohooXgggoohhooXggggX
65 XbgohX.XgggooohX.XgggX
66 XXXX...XXXXXXX...XXXX
''')
# End the chest at actual hips while the tarsi remain behind it.
save('idle_a',a)
# Reauthor corresponding face corrections separately for the breathing cels.
block(b,33,'''
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhXneXhhhhhXnneeXhhoX
66 XbgoohhhXeeXohhhhXeeenXohoX
66 XbgoohhhhXXooghhhhXXXXohhoX
66 XbgoohhhhhhooghhhhhhhhjjjjXXX
66 XbgoohhhhhhooghhhhhhjjwwwwwwjXXX
66 XbgohhhhhhhhooghhhhjjwwwwwwwwwjjXX
''')
block(b,72,'''
58 XbgohhhhhhhhhhoooooogggX
57 XbgohhhhhhhhhhhoooooogggX
56 XbgohhhhhhhhhhhhoooooogggX
55 XbgohhhhhhhhhhhhhoooooogggX
54 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhohhhhhhhhoooooogggX
52 XbgohhhhhhhooohhhhhhhoooooogggX
52 XbgohhhhhhooooohhhhhhoooooogggX
53 XbgohhhhhhooooohhhhhoooooogggX
53 XbgohhhhhoooooohhhhoooooogggX
53 XbgohhhhhoooooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
53 XbgohhhhooogooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
55 XbgohhhhooogooohhhoooooogggX
56 XbgohhhhooogooohhhoooooogggX
57 XbgohhhhooogooohhhoooooogggX
58 XbgohhhhooogooohhhoooooogggX
59 XbgohhhhooogooohhhoooooogggX
60 XbgohhhhooogooohhhoooooogggX
61 XbgohhhhooogggoohhooooogggX
62 XbgohhhooogggoohhooooogggX
63 XbgohhooogggoohhooooogggX
64 XbgohooXgggoohhooXggggX
65 XbgohX.XgggooohX.XgggX
66 XXXX...XXXXXXX...XXXX
''')
save('idle_b',b)
block(c,33,'''
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhhnnXhhhhhXnneeXhhoX
66 XbgoohhhhXXoohhhhXeeenXohoX
66 XbgoohhhhhhooghhhhXXXXohhoX
66 XbgoohhhhhhooghhhhhhhhjjjjXXX
66 XbgoohhhhhhooghhhhhhjjwwwwwwjXXX
66 XbgohhhhhhhhooghhhhjjwwwwwwwwwjjXX
''')
block(c,72,'''
58 XbgohhhhhhhhhhoooooogggX
57 XbgohhhhhhhhhhhoooooogggX
56 XbgohhhhhhhhhhhhoooooogggX
55 XbgohhhhhhhhhhhhhoooooogggX
54 XbgohhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhohhhhhoooooogggX
54 XbgohhhhhhhooohhhhoooooogggX
54 XbgohhhhhhooooohhhoooooogggX
54 XbgohhhhhhooooohhhoooooogggX
54 XbgohhhhhoooooohhhoooooogggX
54 XbgohhhhhoooooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
54 XbgohhhhooogooohhhoooooogggX
55 XbgohhhhooogooohhhoooooogggX
56 XbgohhhhooogooohhhoooooogggX
57 XbgohhhhooogooohhhoooooogggX
58 XbgohhhhooogooohhhoooooogggX
59 XbgohhhhooogooohhhoooooogggX
60 XbgohhhhooogooohhhoooooogggX
61 XbgohhhhooogggoohhooooogggX
62 XbgohhhooogggoohhooooogggX
63 XbgohhooogggoohhooooogggX
64 XbgohooXgggoohhooXggggX
65 XbgohX.XgggooohX.XgggX
66 XXXX...XXXXXXX...XXXX
''')
save('idle_c',c)
block(w,33,'''
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhXneXhhhhhXnneeXhhoX
66 XbgoohhhXeeXohhhhXeeenXohoX
66 XbgoohhhhXXooghhhhXXXXohhoX
66 XbgoohhhhhhooghhhhhhhhjjjjXXX
66 XbgoohhhhhhooghhhhhhjjwwwwwwjXXX
66 XbgohhhhhhhhooghhhhjjwwwwwwwwwjjXX
''')
# Compressed breast and hips for windup, upper legs read as broad feather masses.
block(w,72,'''
60 XbgohhhhhhhhhhoooooogggX
59 XbgohhhhhhhhhhhoooooogggX
58 XbgohhhhhhhhhhhhoooooogggX
57 XbgohhhhhhhhhhhhhoooooogggX
56 XbgohhhhhhhhhhhhhhoooooogggX
55 XbgohhhhhhhhhhhhhhhoooooogggX
54 XbgohhhhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhhhoooooogggX
51 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
50 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
49 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhohhhhhhhhhhoooooogggX
48 XbgohhhhhhhooohhhhhhhhhoooooogggX
48 XbgohhhhhhooooohhhhhhhoooooogggX
49 XbgohhhhhoooooohhhhhhhoooooogggX
50 XbgohhhhhoooooohhhhhhoooooogggX
51 XbgohhhhhoooooohhhhhoooooogggX
52 XbgohhhhhoooooohhhhoooooogggX
53 XbgohhhhhoooooohhhoooooogggX
54 XbgohhhhhoooooohhhoooooogggX
55 XbgohhhhhoooooohhhoooooogggX
56 XbgohhhhhoooooohhhoooooogggX
57 XbgohhhhhoooooohhhoooooogggX
58 XbgohhhhhoooooohhhoooooogggX
59 XbgohhhhooogggooohhooooogggX
60 XbgohhhooogggooohhooooogggX
61 XbgohhooogggooohhooooogggX
62 XbgohooXgggooohhooXggggX
63 XbgohX.XgggooohhX.XgggX
64 XXXX...XXXXXXXX...XXXX
''')
# Three resting tail feathers preserve dark seams and individually tapered tips.
# Unchanged tail anatomy remains in the later low-posture cels.
block(w,104,'''
31 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
29 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
27 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
25 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
23 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
21 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
19 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
17 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
15 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
14 XbgoohhhhkkXbgoohhhhkkXbgoohhhhkkX
15 XbgoohhhkkXbgoohhhkkXbgoohhhkkX
16 XbgoohhkkXbgoohhkkXbgoohhkkX
17 XbgoohhkXbgoohhkXbgoohhkX
18 XbgoohX.XbgoohX.XbgoohX
19 XbgohX..XbgohX..XbgohX
20 XbgoX...XbgoX...XbgoX
21 XXXX....XXXX....XXXX
''')
save('windup',w)
# Explicit cleanup of obsolete overhanging brow pixels, one frame at a time.
block(a,34,'94 ..............\n94 ..............\n94 ..............\n94 ..............')
block(b,34,'94 ..............\n94 ..............\n94 ..............\n94 ..............')
block(c,34,'94 ..............\n94 ..............\n94 ..............\n94 ..............')
block(w,34,'94 ..............\n94 ..............\n94 ..............\n94 ..............')
# The far wing forks taper back into the elbow, instead of ending on a flat cut.
block(a,39,'''
34 XbgohhoooooooohhhhhhkkkkXX
35 XbgohhoooooooohhhhhkkkkXX
36 XbgohhoooooooohhhhkkkkXX
37 XbgohhoooooooohhhkkkkXX
38 XbgohhoooooooohhkkkkXX
39 XbgohhoooooooohkkkkXX
40 XbgohhoooooooohkkkXX
41 XbgohhoooooooohkkXX
42 XbgohhoooooooohkXX
''')
block(b,39,'''
34 XbgohhoooooooohhhhhhkkkkXX
35 XbgohhoooooooohhhhhkkkkXX
36 XbgohhoooooooohhhhkkkkXX
37 XbgohhoooooooohhhkkkkXX
38 XbgohhoooooooohhkkkkXX
39 XbgohhoooooooohkkkkXX
40 XbgohhoooooooohkkkXX
41 XbgohhoooooooohkkXX
42 XbgohhoooooooohkXX
''')
block(c,39,'''
34 XbgohhoooooooohhhhhhkkkkXX
35 XbgohhoooooooohhhhhkkkkXX
36 XbgohhoooooooohhhhkkkkXX
37 XbgohhoooooooohhhkkkkXX
38 XbgohhoooooooohhkkkkXX
39 XbgohhoooooooohkkkkXX
40 XbgohhoooooooohkkkXX
41 XbgohhoooooooohkkXX
42 XbgohhoooooooohkXX
''')
save('idle_a',a);save('idle_b',b);save('idle_c',c);save('windup',w)

# Low leap, both wings unfurl; wing roots and hips are newly authored native rows.
m=blank()
block(m,31,'''
8 XXXX
7 XhhkkXXX
6 XohhhkkkkXXXX
5 XgohhhhhkkkkkhhhhXXXXX
5 XbgohhhhhhhkkkkhhhhhhhXXXX
6 XbgohhhhhhhhhhhhhhhhhhhhhXXXX
7 XbgohhhhhhhhhhhhhhhhhhhhhhhhhXXXX
8 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhXXXX
9 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhXXXX
10 XbgohhhhhhhhhooooooooooohhhhhhhhhhhhhhhhXXX
11 XbgohhhhhhoooooooooooooohhhhhhhhhhhhhhhhhhhXXX
12 XbgohhhooooooooooooooooohhhhhhhhhhhhhhhhhhhhhhXXX
13 XbgooooooooooooooogggooohhhhhhhhhhhhhhhhhhhhhhhhXXX
14 XbgooooooooooogggggggooohhhhhhhhhhhhhhhhhhhhhhhhhhXX
15 XbgooooooooggggggggggooohhhhhhhhhhhhhhhhhhhhhhhhhhX
16 XbgooooogggggggggggggooohhhhhhhhhhhhhhhhhhhhhhhhhX
17 XbgooogggggggggggggggooohhhhhhhhhhhhhhhhhhhhhhhhoX
18 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhhhhhhhoX
19 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhhhhhhoX
20 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhhhhoX
21 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhhhoX
22 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhhoX
23 XbgggggggggggggggggggooohhhhhhhhhhhhhhhhoX
24 XbgggggggggggggggggggooohhhhhhhhhhhhhhoX
25 XbgggggggggggggggggggooohhhhhhhhhhhhoX
26 XbgggggggggggggggggggooohhhhhhhhhhoX
27 XbgggggggggggggggggggooohhhhhhhhoX
28 XbgggggggggggggggggggooohhhhhhoX
29 XbgggggggggggggggggggooohhhhoX
30 XbgggggggggggggggggggooohhoX
31 XbgggggggggggggggggggoohoX
32 XbgggggggggggggggggggooX
33 XbgggggggggggggggggggoX
34 XbggggggggggggggggggoX
35 XbgggggggggggggggggoX
36 XbggggggggggggggggoX
37 XbgggggggggggggggoX
38 XbggggggggggggggoX
39 XbgggggggggggggoX
40 XbggggggggggggoX
41 XbgggggggggggoX
''')
# Separated upper primary tips; explicit barbs are asymmetric to the rachis.
block(m,26,'''
21 XXX
20 XhkXXX
19 XohkkkkXXX
18 XgohhhkkkkkkXXXX
17 XbgohhhhhkkkkkkkkXXXX
16 XbgohhhhhhhkkkkkkkkkkXXX
15 XbgohhhhhhhhhkkkkkkkkkkkXX
16 XbgohhhhhhhhhhhkkkkkkkkkkXX
17 XbgohhhhhhhhhhhhhhhhhkkkkkkXX
18 XbgohhhhhhhhhhhhhhhhhhhkkkkkkXX
19 XbgohhhhhhhhhhhhhhhhhhhhhkkkkkkXX
20 XbgohhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
21 XbgohhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
22 XbgohhhhhhhhoooooooooohhhhhhhhhkkkkkkXX
23 XbgohhhhhhoooooooooooohhhhhhhhhhhkkkkkkXX
24 XbgohhhhoooooooooooooohhhhhhhhhhhhhkkkkkXX
''')
# Near wing sweeps forward, the flight feathers fold around the shoulder.
block(m,48,'''
85 XXohhhkkXX
85 XgoohhhkkkkXXX
86 XgoohhhhhhkkkkXXX
87 XgoohhhhhhhkkkkkkXX
88 XgoohhhhhhhhhkkkkkkXX
89 XgoohhhhhhhhhhkkkkkkXX
90 XgoohhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhhhhhkkkkkkXX
91 XgoohhhhhhhhhhhhhhhhhhkkkkkkXX
90 XbgoohhhhhhhhhhhhhhhhhhkkkkkkXX
89 XbgoohhhhhhhhhhhhhhhhhhhkkkkkkXX
88 XbgoohhhhhhhhhhhhhhhhhhhhkkkkkkXX
87 XbgoohhhhhhhhhhhhhhhhhhhhhkkkkkkXX
86 XbgoohhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
85 XbgoohhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
84 XbgoohhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
83 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
82 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
81 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
80 XbgoohhhhhhhhoooooohhhhhhhhhhhhkkkkkkXX
79 XbgoohhhhhhoooooooohhhhhhhhhhhhkkkkkkXX
78 XbgoohhhhoooooooooohhhhhhhhhhhhkkkkkkXX
77 XbgoohhoooooooooooohhhhhhhhhhhhkkkkkkXX
76 XbgoohoooooooooooogohhhhhhhhhhhkkkkkkXX
75 XbgoohoooooooooooggohhhhhhhhhhhkkkkkkXX
74 XbgoohoooooooooogggohhhhhhhhhhhkkkkkkXX
73 XbgoohoooooooooggggohhhhhhhhhhhkkkkkkXX
72 XbgoohoooooooogggggohhhhhhhhhhkkkkkXX
71 XbgoohoooooooggggggohhhhhhhhhkkkkkXX
70 XbgoohoooooogggggggohhhhhhhkkkkkXX
69 XbgoohoooooggggggggohhhhhkkkkkXX
68 XbgoohoooogggggggggohhhkkkkkXX
67 XbgoohoogggggggggggoohkkkkXX
66 XbgoohoogggggggggggoohkkXX
65 XbgoohoogggggggggggoohkXX
64 XbgoohoogggggggggggoohXX
63 XbgoohooggggggggggggooX
62 XbgoohooggggggggggggoX
61 XbgoohoogggggggggggoX
60 XbgoohooggggggggggoX
59 XbgoohoogggggggggoX
58 XbgoohooggggggggoX
''')
# Wide avian body, loaded rear thigh and forward lifted leg.
block(m,63,'''
49 XXbgoohhhhhhhhhhhhjjwwwwjjhoooivX
47 XXbgoohhhhhhhhhhhhhijwwwjjhoooivX
46 XbbgoohhhhhhhhhhhhhhijwwjjhoooivX
45 XbbgoohhhhhhhhhhhhhhhijjjhoooovvX
44 XbbgoohhhhhhhhhhhhhhhhijjhoooovvX
43 XbbgoohhhhhhhhhhhhhhhhhijhoooogvX
42 XbbgoohhhhhhhhhhhhhhhhhhjhoooogvX
41 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
40 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
39 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
38 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
37 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
36 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
35 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
34 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
33 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
32 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
31 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
30 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
30 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
31 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
32 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
33 XbbgoohhhhhhhhhhhhhhhhhhhhoooogvX
34 XbbgoohhhhhhhhhhhhooooooohoooogvX
35 XbbgoohhhhhhhhhhooooooooogoooggvX
36 XbbgoohhhhhhhhoooooooooogooogggvX
37 XbbgoohhhhhhooooooooooggooogggvX
38 XbbgoohhhhooooooooooggggooogggvX
39 XbbgoohhhooooooooogggggooogggvX
40 XbbgoohhhoooooooggggggooogggvX
41 XbbgoohhhooooogggggggooogggvX
42 XbbgoohhhooooggggggggooogggvX
43 XbbgoohhhoooggggggggooogggvX
44 XbbgoohhhooogggggggooogggvX
45 XbbgoohhhoooggggggooogggvX
46 XbbgoohhhooogggggooogggvX
47 XbbgoohhhoooggggooogggvX
48 XbbgoohhhoooggggooogggvX
49 XbbgoohhhoooggggooogggvX
50 XbbgoohhhooXgggooXgggvX
51 XbgoohhooX.XgggX.XgggX
52 XXXXXXXX...XXXX...XXX
''')
# Tail's three quills spread left under the wing.
block(m,90,'''
12 XXohhkXX
11 XgohhkkkkXX
10 XbgohhhhkkkkXX
9 XbgohhhhhhhkkkkXX
8 XbgohhhhhhhhhkkkkXX
7 XbgohhhhhhhhhhhkkkkXX
7 XbgohhhhhhhhhhhhhkkkkXX
8 XbgohhhhhhhhoooooohkkkkXX
9 XbgohhhhhooooooooohhkkkkXX
10 XbgohhoooooooooooohhhkkkkXX
11 XbgoooooooooogoooohhhkkkkXX
12 XbgoooooooogggoooohhhkkkkXX
13 XbgoooooogggggoooohhhkkkkXX
14 XbgoooogggggggoooohhhkkkkXX
15 XbgoooggggggggoooohhhkkkkXX
16 XbgoogggooXgggoooohhhkkkkXX
17 XbgggggoX.XgggoooohhhkkkkXX
18 XbggggoX..XgggoooohhhkkkkXX
19 XbgggoX...XgggoooohhhkkkX
20 XbggoX....XgggoooohhkkX
21 XbgoX.....XgggoooohkkX
22 XXX.......XgggoooohkX
32 XgggoooohX
33 XgggoooX
34 XgggooX
35 XgggoX
36 XXXX
''')
# Push-off foot still grounds y124; forward talons lifted, wrist not detached.
block(m,99,'''
51 XbgoohhhhX................XXbgoohhhXX
50 XbgoohhhhhX...............XbgoohhhhhX
49 XbgoohhhhhX..............XbgoohhhhhhX
48 XbgoohhhhhX.............XbgoohhhhhhhX
47 XbgoohhhhhX............XbgoohhhhhhhX
47 XbgoohhhhX............XbgoohhhhhhhX
48 XjiiivvX..............XbgoohhhhhhhX
49 XjiiivvX..............XjiiiivvttXX
50 XjiiivvX..............XjjiiiivvtttXX
51 XjiiivvX...............XjjiiiiivvttttXX
52 XjiiivvX................XjjiiiiivvvttttXX
53 XjiiivvX.................XjjiiiiivvvttttX
54 XjiiivvX..................XjjiiiivXjjjttX
55 XjiiivvX...................XjjiiitXjjttX
56 XjiiivvX....................XjjittXXttX
57 XjiiivvX.....................XjttX..XX
58 XjiiivvX......................XXX
59 XjiiivvX
60 XjiiivvX
59 XjjiiivvXX
58 XjjiiiivvttXX
57 XjjiiivXiiivttXX
56 XjjiiitXjjiiivttXX
55 XjjjitXX.XjjiiittXjjjXX
54 XjjittX...XjjjittXXjjjitX
54 XXXXXX....XXXXXXX.XXXXXX
''')
# Original head, lowered attack-directed neck, two independently placed eyes.
block(m,29,'''
78 XXX
77 XhkXXX
76 XohkkkXXX
75 XgohkkkkkhhXX
75 XbgoohhhhhhhhhXX
76 XbgoohhhhhhhhhhhXX
77 XbgoohhhhhhhhhhhhhX
77 XbgoohhhhhhhhhhhhhhhX
77 XbgoohhhXXXhhhhhXXXXhX
77 XbgoohhXneXhhhhXnneeeXhX
77 XbgoohhXeeXohhhXeeeenXoX
77 XbgoohhhXXooghhoXXXXohhoX
76 XbgoohhhhhhooghhhhohjjjjXXX
75 XbgoohhhhhhooghhhhojjwwwwwwjXXX
74 XbgoohhhhhhhhooghjjwwwwwwwwwjjXX
73 XbgohhhhhhhhhhoogjjwwwwwjjiiiiiiX
72 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
71 XbgoohhhjjjjhhhooiijjiiivvvttttX
70 XbgoohhjjwwjjjhooiijiiivvtttXXtX
69 XbgohjjwwwwwjjjhooiiivvttX..XX
68 XbgohjjwwwwwwwjjhhoiivvttX
67 XbgohjjwwwwwwwwwjjhooivvtX
66 XbgohjjwwwwwwwwwwjjhooivvX
65 XbgohjjwwwwwwwwwwwjjhooivX
64 XbgohjjwwwwwwwwwwwjjhooivX
63 XbgohjjwwwwwjjwwwwwjjhooivX
62 XbgohjjwwwwjjijwwwwwjjhooivX
61 XbgohjjwwwjjiijjwwwwwjjhooivX
60 XbgohjjwwjjiivijjwwwwjjhooivX
59 XbgohjjwjjiivviijjwwwjjhooivX
58 XbgohjjjjiivvvviijjwwjjhooivX
57 XbgohjjiivvvttvviijjwjhooivX
56 XbgohjiivvtttttvviijjhooivX
55 XbgohhiivvtttttttvviijhooivX
''')
save('move',m)
# Move inspection repair: feathered hip/tail roots, never only outline contact.
block(m,95,'''
35 XsbbggoohhhhhhhXX
36 XsbbggoohhhhhhhhXX
37 XsbbggoohhhhhhhhhXX
38 XsbbggoohhhhhhhhhhXX
39 XsbbggoohhhhhhhhhhhXX
40 XsbbggoohhhhhhhhhhhX
41 XsbbggoohhhhhhhhhhX
42 XsbbggoohhhhhhhhhX
43 XsbbggoohhhhhhhhX
44 XsbbggoohhhhhhhX
''')
block(m,96,'''
73 XbgoohhhhhhhX
73 XbgoohhhhhhhX
73 XbgoohhhhhhhhX
73 XbgoohhhhhhhhX
74 XbgoohhhhhhhhX
74 XbgoohhhhhhhhX
74 XbgoohhhhhhhhX
74 XbgoohhhhhhhX
74 XbgoohhhhhhX
75 XbgoohhhhhX
''')
save('move',m)

# Contact: the same near/right attack leg compresses its hock, then seizes.
t=[list(r) for r in frames['move']]
# Dense feathered hip leads to silver tarsus; three hooked toes enclose dark air.
block(t,93,'''
74 XbgoohhhhhhXX
74 XbgoohhhhhhhhXX
74 XbgoohhhhhhhhhhXX
75 XbgoohhhhhhhhhhhXX
76 XbgoohhhhhhhhhhhhXX
77 XbgoohhhhhhhhhhhhhX
78 XbgoohhhhhhhhhhhhhhX
79 XbgoohhhhhhhhhhhhhhhX
80 XbgoohhhhhhhhhhhhhhX
81 XbgoohhhhhhhhhhhhhX
82 XbgoohhhhhhhhhhhhX
83 XjjiiiivvtttXX
84 XjjiiiiivvttttXX
85 XjjiiiiiivvtttttXXX
86 XjjiiiiiivvvtttttttXXX
87 XjjiiiiiiivvvtttttttttXXX
88 XjjiiiiiiiivvvXjjjjjjjittX
89 XjjiiiiiiiiivXjjjiiiivtttX
90 XjjiiiivXiiivXjiiivtXvvttX
91 XjjiiitXjiiitXiiivtX.vttX
92 XjiiitX.jiiitXiivtX..ttX
93 XiiitX..XiiitXivtX..XttX
94 XttXX....XttX.ttX..XttX
95 XXX......XttX.ttXX.XttX
104 XttX..XttttttX
104 XXX....XXXXX
''')
# Stretched flight fingers shorten differently; no wing duplication/rotation.
block(t,66,'''
111 ohhhhkkkkXXX
111 ohhhkkkkkXX
110 oohhkkkkkXX
109 ooohkkkkkXX
108 oooohkkkkXX
107 oooohkkkXX
106 gooohkkXX
105 ggooohkX
104 gggooohX
103 ggggooX
102 ggggoX
101 gggoX
100 ggoX
99 goX
98 XX
''')
# Forward shoulder presses into the throat; breast flattens in the strike.
block(t,69,'''
72 hhhjjhooogvX
71 hhhhjjhooogvX
70 hhhhhjhooogvX
69 hhhhhhhooogvX
68 hhhhhhhhooogvX
67 hhhhhhhhhooogvX
66 hhhhhhhhhhooogvX
65 hhhhhhhhhhhooogvX
''')
save('attack',t)

# Recovery: elbow folds down, front ankle withdraws to its planted position.
r=copy_idle()
for yy in range(9,31):r[yy][1:34]=list('.'*33)
block(r,22,'''
29 XXX
28 XhkXX
27 XohkkXX
26 XgohkkkXX
25 XbgohkkkkXX
24 XbgohhhkkkkXX
23 XbgohhhhhkkkkXX
22 XbgohhhhhhhkkkkXX
21 XbgohhhhhhhhhkkkkXX
20 XbgohhhhhhhhhhhkkkkXX
19 XbgohhhhhhhhhhhhhkkkkXX
18 XbgohhhhhhhhhhhhhhhkkkkXX
17 XbgohhhhhhhhhhhhhhhhhkkkkXX
16 XbgohhhhhhhhhhhhhhhhhhhkkkkXX
15 XbgohhhhhhhhhhhhhhhhhhhhhkkkkXX
16 XbgohhhhhhhhhhhhhhhhhhhhhhkkkkXX
17 XbgohhhhhhhhoooooooooohhhhhkkkkXX
18 XbgohhhhhhoooooooooooohhhhhkkkkXX
19 XbgohhhhoooooooooooooohhhhhkkkkXX
20 XbgohhoooooooooooooooohhhhhkkkkXX
21 XbgooooooooooooooooooohhhhhkkkkXX
22 XbgooooooooooooooooogohhhhhkkkkXX
23 XbgooooooooooooooooggohhhhhkkkkXX
24 XbgooooooooooooooogggoohhhkkkkkXX
25 XbgoooooooooooooggggggoohkkkkkXX
26 XbgoooooooooooggggggggoohkkkkXX
27 XbgoooooooogggggggggggoohkkkXX
28 XbgoooooogggggggggggggoohkkXX
29 XbgoooggggggggggggggggoohkXX
30 XbggggggggggggggggggggoohXX
31 XbggggggggggggggggggggooX
32 XbggggggggggggggggggggoX
33 XbgggggggggggggggggggoX
34 XbggggggggggggggggggoX
''')
block(r,82,'''
13 XssbbgoohhhkXbgggohhhkX
14 XssbbgoohhhkXbgggohhhkX
15 XssbbgoohhhkXbgggohhhkX
16 XssbbgoohhhkXbgggohhhkX
17 XssbbgoohhhkXbgggohhhkX
18 XssbbgoohhhkXbgggohhhkX
19 XssbbgoohhhkXbgggohhhkX
20 XssbbgoohhhkXbgggohhhkX
21 XssbbgoohhhkXbgggohhhkX
22 XssbbgoohhhXsbgggohhhkX
23 XssbbgoohhX.XbgggohhhkX
24 XssbbgoohX..XbgggohhhkX
25 XssbbgohX...XbgggohhhkX
26 XssbbgoX....XbgggohhhkX
27 XssbbgX.....XbgggohhhkX
28 XssbbX......XbgggohhhX
29 XXXX........XbgggohhX
43 XbgggohX
44 XbgggoX
45 XbgggX
46 XXXXX
''')
save('recover',r)

# Hit: bowed crown, compressed cheek/eye, one wing sags and hocks bear weight.
hit=copy_idle()
replace(hit,20,'''
1 .
1 .
1 .
1 .
1 .
1 .
68 XXX
67 XhkXXX
66 XohkkkXXXX
65 XgohkkkkkhhhhXXX
65 XbgoohhhhhhhhhhhXXX
65 XbgoohhhhhhhhhhhhhhXX
65 XbgoohhhhhhhhhhhhhhhhX
66 XbgoohhhhhhhhhhhhhhhhX
66 XbgoohhhhhhhhhhhhhhhhX
67 XbgoohhhhXXhhhhhhXXXhhX
67 XbgoohhhhXnhhhhhhnnnXhoX
68 XbgoohhhhhhoohhhhhXXohhoX
68 XbgoohhhhhhooghhhhhhhjjjjXXX
68 XbgoohhhhhhooghhhhhjjwwwwwwjXXX
67 XbgohhhhhhhhooghhhjjwwwwwwwwwjjXX
67 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiX
66 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
65 XbgoohhhjjjjhhhooiijjiiivvvttttX
64 XbgoohhjjwwjjjhooiijiiivvtttXXtX
63 XbgohjjwwwwwjjjhooiiivvttX..XX
62 XbgohjjwwwwwwwjjhhoiivvttX
61 XbgohjjwwwwwwwwwjjhooivvtX
''')
block(hit,82,'''
52 XbgohhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhohhhhoooooogggX
52 XbgohhhhhhhooohhhoooooogggX
52 XbgohhhhhhooooohhoooooogggX
52 XbgohhhhhhooooohhoooooogggX
53 XbgohhhhhoooooohhoooooogggX
54 XbgohhhhhoooooohhoooooogggX
55 XbgohhhhooogooohhoooooogggX
56 XbgohhhhooogooohhoooooogggX
57 XbgohhhhooogooohhoooooogggX
58 XbgohhhhooogooohhoooooogggX
''')
# Far wing falls from its original tip; this is a new bent feather, not a shift.
replace(hit,9,'''
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
1 .
''')
block(hit,20,'''
31 XXX
30 XhkXX
29 XohkkXX
28 XgohkkkXX
27 XbgohhhhhXX
26 XbgohhhhhhhXX
25 XbgohhhhhhhhhXX
24 XbgohhhhhhhhhhhXX
23 XbgohhhhhhhhhhhhhXX
22 XbgohhhhhhhhhhhhhhhXX
21 XbgohhhhhhhhhhhhhhhhhXX
20 XbgohhhhhhhhhhhhhhhhhhhXX
''')
save('hit',hit)

# Fallen bird: large silver nape stays attached, closed eyes, folded feet and tail.
d=blank()
block(d,76,'''
38 XXXXX
34 XXXXhkkkXXXX
31 XXXohhhhhkkkkXXX
28 XXXgohhhhhhhkkkkkkXXX
26 XXbgohhhhhhhhhhkkkkkkkXXX
24 XXbgohhhhhhhhhhhhhkkkkkkkkXXX
22 XXbgohhhhhhhhhhhhhhhhkkkkkkkkXXX
20 XXbgohhhhhhhhhhhhhhhhhhhkkkkkkkkXXX
18 XXbgohhhhhhhhhhhhhhhhhhhhhhkkkkkkkkXXX
17 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkkkXXX
16 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkkkXX
15 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkkkkXX
14 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
13 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkXX
12 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkXX
11 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
10 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXXX
9 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoXXX
8 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhXXX
7 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhXX
6 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhXX
6 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhX
7 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhX
8 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhX
9 XbgohhhhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhX
10 XbgohhhhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhX
11 XbgohhhhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhX
12 XbgohhhhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhX
13 XbgohhhhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhX
14 XbgohhhhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
15 XbgohhhhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
16 XbgohhhhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
17 XbgohhhhhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
18 XbgohhhhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
19 XbgohhhhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
20 XbgohhkkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
21 XbgohkkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
22 XbgohkXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
23 XbgohXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
24 XbgoXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
25 XbgXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
26 XXbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
27 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
28 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
29 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
30 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
31 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
32 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
33 XbgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoX
''')
# Low head and neck, silver beak lies just above the baseline.
block(d,99,'''
75 XXXbgoohhhhXXX
72 XXXbgoohhhhhhhhXX
70 XXjjwwjjhohhhhhhhXX
68 XXjjwwwwjjhohhhhhhhXX
67 XjjwwwwwwwjjhohhhhhhhXX
66 XjjwwwwwwwwwjjhohhhhhhhX
65 XjjwwwwwwwwwwwjjhohhhhhhX
64 XjjwwwwwwwwwwwwwjjhohhhhhhX
63 XjjwwwwwwwwwwwwwwjjhohhhhhhX
62 XjjwwwwwwwwwwwwwwjjhohhbnhoX
61 XjjwwwwwwwwwwwwwwwjjhohhhhhnX
60 XjjwwwwwwwwwwwwwwwjjhohhhhhhjjXXX
59 XjjwwwwwwwwwwwwwwwjjhohhhhjjwwwjjXX
58 XjjwwwwwwwwwwwwwwwjjhohhjjwwwwwwwjjXX
57 XjjwwwwwwwwwwwwwwwjjhohjjwwwwwjiiiiiitX
57 XjjwwwwwwwwwwwwwjjjhohijjwwwjiiivvvttX
58 XjjwwwwwwwwwwwjjiijhohiiijjiiivvvttX
59 XjjwwwwwwwwwjjiivvijhohiiiiiivvvttX
60 XjjwwwwwwwjjiivvvviijhohiiiivvvttX
61 XjjwwwwwjjiivvvvvvviijhohiiivvttX
62 XjjwwwjjiivvvttttvvviijhohiiivttX
63 XjjwjjiivvvtttttttvvviijhohiivttX
64 XjjiivvvtttttttttttvvviijhoivttX
65 XivvvtttttttttttttttvvviijhvttX
66 XtttttttttttttttttttttvvvvtttX
67 XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
''')
# Folded tarsi and separate short toe tips lie over the abdomen.
block(d,113,'''
43 XXbgoohhhXX.......XXbgoohhhXX
42 XbgoohhhhhX.......XbgoohhhhhX
41 XbgoohhhhX........XbgoohhhhX
40 XjjiiivvvXX.......XjjiiivvvXX
40 XjjiiiiivvttXX.....XjjiiiiivvttXX
41 XjjiiiiiiivvttXXX...XjjiiiiiiivvttXXX
42 XjjiiiiiiiiivvtttXX..XjjiiiiiiiiivvtttXX
43 XjjiiivXiiivvttXX....XjjiiivXiiivvttXX
44 XjjiiitXjjiiittX......XjjiiitXjjiiittX
45 XjjittX.XjjittX........XjjittX.XjjittX
46 XXXXXX..XXXXXX.........XXXXXX..XXXXXX
''')
# Three long tail quills remain recognizable in the fallen lower-left outline.
block(d,110,'''
9 XbgoohhhkkXbgohhhkkXbgohhhkkX
8 XbgohhhhkkXbgohhhkkXbgohhhkkX
7 XbgohhhhkkXbgohhhkkXbgohhhkkX
6 XbgohhhhkkXbgohhhkkXbgohhhkkX
5 XbgohhhhkkXbgohhhkkXbgohhhkkX
5 XbgohhhhkXbgohhhkkXbgohhhkkX
6 XbgohhhkXbgohhhkkXbgohhhkkX
7 XbgohhkXbgohhhkkXbgohhhkkX
8 XbgohkXbgohhhkkXbgohhhkkX
9 XbgohXbgohhhkkXbgohhhkkX
10 XbgoXbgohhhkkXbgohhhkkX
11 XbgXbgohhhkkXbgohhhkkX
12 XXbgohhhkkXbgohhhkkX
13 XbgohhhkXbgohhhkkX
14 XXXXXXXXXXXXXXXXXXXXXXXXX
''')
save('dead',d)
# Hit's previously separate primary is discarded, replaced by an attached drooping wing.
for yy in range(20,48):hit[yy][1:64]=list('.'*63)
block(hit,25,'''
35 XXX
34 XhkXX
33 XohkkXX
32 XgohkkkXX
31 XbgohhhhhXX
30 XbgohhhhhhhXX
29 XbgohhhhhhhhhXX
28 XbgohhhhhhhhhhhXX
27 XbgohhhhhhhhhhhhhXX
26 XbgohhhhhhhhhhhhhhhXX
25 XbgohhhhhhhhhhhhhhhhhXX
24 XbgohhhhhhhhhhhhhhhhhhhXX
25 XbgohhhhhhhhhhhhhhhhhhhhhXX
26 XbgohhhhhhhhhhhhhhhhhhhhhhhXX
27 XbgohhhhhhhhoooooooooohhhhhhXX
28 XbgohhhhhhoooooooooooohhhhhhhhXX
29 XbgohhhhoooooooooooooohhhhhhhhhhXX
30 XbgohhoooooooooooooooohhhhhhhhhhhhXX
31 XbgoooooooooooooooggoohhhhhhhhhhhhhhXX
32 XbgoooooooooooooggggoohhhhhhhhhhhhhhhhXX
33 XbgoooooooooooggggggoohhhhhhhhhhhhhhhhhX
34 XbgooooooooggggggggoohhhhhhhhhhhhhhhhhhX
35 XbgoooooogggggggggoohhhhhhhhhhhhhhhhhhX
36 XbgooogggggggggggoohhhhhhhhhhhhhhhhhhX
37 XbggggggggggggggoohhhhhhhhhhhhhhhhhX
38 XbgggggggggggggoohhhhhhhhhhhhhhhhX
39 XbggggggggggggoohhhhhhhhhhhhhhhX
40 XbgggggggggggoohhhhhhhhhhhhhhX
41 XbggggggggggoohhhhhhhhhhhhhX
42 XbgggggggggoohhhhhhhhhhhhX
43 XbggggggggoohhhhhhhhhhhX
44 XbgggggggoohhhhhhhhhhX
45 XbggggggoohhhhhhhhhX
46 XbgggggoohhhhhhhhX
47 XbggggoohhhhhhhX
48 XbgggoohhhhhhX
49 XbggoohhhhhX
50 XbgoohhhhX
''')
save('hit',hit)
# Death: wing shadows follow the folded coverts, not a flat gold sheet.
block(d,90,'''
28 gooohhhkkXbgoohhhhhhhh
27 ggooohhkkXbgoohhhhhhhhh
26 gggooohkXbgoohhhhhhhhhhh
25 ggggooXbgoohhhhhhhhhhhhh
24 ggggoXbgoohhhhhhhhhhhhhh
23 gggoXbgoohhhhhhhhhhhhhhh
22 ggoXbgoohhhhhhhhhhhhhhhh
21 goXbgoohhhhhhhhhhhhhhhhh
20 oXbgoohhhhhhhhhhhhhhhhhh
19 Xbgoohhhhhhhhhhhhhhhhhhh
18 bgoohhhhhhhhhhhhhhhhhhhh
17 goohhhhhhhhhooooooooooo
16 oohhhhhhhhooooooooooooo
15 ohhhhhhhoooooooooooooog
14 hhhhhhooooooooooooooggg
13 hhhhooooooooooooogggggg
12 hhooooooooooooggggggggg
11 ooooooooooogggggggggggg
''')
block(d,108,'84 ohbnnho\n85 ohhhho\n86 ohhnnho')
save('dead',d)

# Sleep: a tucked, resting bird; full volume, folded wings, thighs and silver feet.
s1=[list(z) for z in frames['windup']]
for yy in range(20,72):s1[yy][62:127]=list('.'*65)
block(s1,51,'''
76 XXX
75 XhkXXX
74 XohkkkXXX
73 XgohkkkkkhhXX
72 XbgoohhhhhhhhhXX
72 XbgoohhhhhhhhhhhXX
72 XbgoohhhhhhhhhhhhhX
72 XbgoohhhhhhhhhhhhhhhX
72 XbgoohhhhhhhhhhhhhhhhX
72 XbgoohhhhhhhhhhhhhhhhX
72 XbgoohhhhhhhhhhhhhhhhX
72 XbgoohhhhbbhhhhhhhhbbhX
72 XbgoohhhhhnnhhhhhhnnhoX
72 XbgoohhhhhhhhhhhhhhhhhhoX
71 XbgoohhhhhhhhhhhhhhhhjjjjXXX
70 XbgoohhhhhhhhhhhhhhjjwwwwwwjXXX
69 XbgoohhhhhhhhhhhhhjjwwwwwwwwwjjXX
68 XbgoohhhhjjhhhhhohjjwwwwwjjiiiiiiX
67 XbgoohhhjjjjhhhooiijjwwwjiiivvvvtX
66 XbgoohhjjwwjjjhooiijjiiivvvttttX
65 XbgohjjwwwwwjjjhooiijiiivvtttXXtX
64 XbgohjjwwwwwwwjjhhoiivvttX..XX
63 XbgohjjwwwwwwwwwjjhooivvtX
62 XbgohjjwwwwwwwwwwjjhooivvX
61 XbgohjjwwwwwwwwwwwjjhooivX
60 XbgohjjwwwwwwwwwwwjjhooivX
59 XbgohjjwwwwwjjwwwwwjjhooivX
58 XbgohjjwwwwjjijwwwwwjjhooivX
57 XbgohjjwwwjjiijjwwwwwjjhooivX
56 XbgohjjwwjjiivijjwwwwjjhooivX
55 XbgohjjwjjiivviijjwwwjjhooivX
54 XbgohjjjjiivvvviijjwwjjhooivX
53 XbgohjjiivvvttvviijjwjhooivX
52 XbgohjiivvtttttvviijjhooivX
51 XbgohhiivvtttttttvviijhooivX
''')
# Breast rounds around the relaxed knees, instead of retaining a tall chest.
block(s1,87,'''
47 XbgohhhhhhhhhhhhhhhhhhhhoooogggX
46 XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
45 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
44 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
43 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
42 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
42 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
42 XbgohhhhhhhhhhhhhhhhhhhhhhoooogggX
43 XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
44 XbgohhhhhhhhohhhhhhhhhhhhoooogggX
45 XbgohhhhhhhooohhhhhhhhhhoooogggX
46 XbgohhhhhhooooohhhhhhhoooogggX
47 XbgohhhhhoooooohhhhhhoooogggX
48 XbgohhhhooooooohhhhhoooogggX
49 XbgohhhhoooogooohhhoooogggX
50 XbgohhhhoooogooohhhoooogggX
51 XbgohhhhoooogooohhhoooogggX
52 XbgohhhhoooogooohhhoooogggX
53 XbgohhhhoooogooohhhoooogggX
54 XbgohhhhoooogooohhhoooogggX
55 XbgohhhhoooogooohhhoooogggX
56 XbgohhhhoooogooohhhoooogggX
57 XbgohhhhoooogooohhhoooogggX
58 XbgohhhhoooogooohhhoooogggX
59 XbgohhhhoooogooohhhoooogggX
60 XbgohhhhoooogooohhhoooogggX
61 XbgohhhhooogggooohhoooogggX
62 XbgohhhooogggooohhoooogggX
63 XbgohhooogggooohhoooogggX
64 XbgohooXgggooohhooXggggX
65 XbgohX.XgggooohhX.XgggX
66 XXXX...XXXXXXXX...XXXX
''')
# Both relaxed foot fans are folded beneath the thigh, grounded at y124.
block(s1,113,'''
64 XjjiiivvXX................XjjiiivvXX
63 XjjiiiivvttXX.............XjjiiiivvttXX
62 XjjiiiiivvtttXX...........XjjiiiiivvtttXX
61 XjjiiiiiiivvttttXX........XjjiiiiiiivvttttXX
60 XjjiiiiiiiivvtttttXX......XjjiiiiiiiivvtttttXX
59 XjjiiiiiiivXiiivvtttXX....XjjiiiiiiivXiiivvtttXX
58 XjjiiiiivvXjjiiivvtttXX..XjjiiiiivvXjjiiivvtttXX
57 XjjiiiivvtXjjiiivvtttXX..XjjiiiivvtXjjiiivvtttXX
56 XjjiiivttXjjiiiittXjjjXX..XjjiiivttXjjiiiittXjjjXX
55 XjjiiittXX.XjjjittXXjjjitX.XjjiiittXX.XjjjittXXjjjitX
54 XjjittXX....XjjittX.XjjittXXjjittXX....XjjittX.XjjittX
54 XXXXXXX....XXXXXXX.XXXXXXXXXXXXXX....XXXXXXX.XXXXXXX
''')
save('sleep_a',s1)
s2=[list(z) for z in frames['sleep_a']]
# Exhale: lowered chin and compressed upper shoulder are distinct literal rows.
block(s2,51,'''
76 ...
75 .XXX..
74 .XhkXXX..
73 .XohkkkhhXX..
72 .XgohhhhhhhhhXX..
72 .XbgoohhhhhhhhhhhXX.
72 .XbgoohhhhhhhhhhhhhX
72 .XbgoohhhhhhhhhhhhhhhX
72 .XbgoohhhhhhhhhhhhhhhhX
72 .XbgoohhhhhhhhhhhhhhhhX
72 .XbgoohhhhhhhhhhhhhhhhX
72 .XbgoohhhhbbhhhhhhhhbbhX
72 .XbgoohhhhhnnhhhhhhnnhoX
72 .XbgoohhhhhhhhhhhhhhhhhhoX
71 .XbgoohhhhhhhhhhhhhhhhjjjjXXX
70 .XbgoohhhhhhhhhhhhhhjjwwwwwwjXXX
69 .XbgoohhhhhhhhhhhhhjjwwwwwwwwwjjXX
68 .XbgoohhhhjjhhhhhohjjwwwwwjjiiiiiiX
67 .XbgoohhhjjjjhhhooiijjwwwjiiivvvvtX
66 .XbgoohhjjwwjjjhooiijjiiivvvttttX
65 .XbgohjjwwwwwjjjhooiijiiivvtttXXtX
64 .XbgohjjwwwwwwwjjhhoiivvttX..XX
63 .XbgohjjwwwwwwwwwjjhooivvtX
62 XbgohjjwwwwwwwwwwjjhooivvX
''')
# Native outer breast contour contracts; feet, folded tails and closed lids persist.
block(s2,87,'''
47 .XbgohhhhhhhhhhhhhhhhhhhoooogggX
46 .XbgohhhhhhhhhhhhhhhhhhhhoooogggX
45 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
44 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
43 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
42 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
42 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
42 .XbgohhhhhhhhhhhhhhhhhhhhhoooogggX
43 .XbgohhhhhhhhhhhhhhhhhhhhoooogggX
''')
save('sleep_b',s2)

# Poison: wing braces the abdomen, brow pinches, beak is open in a retch.
p1=[list(z) for z in frames['hit']]
block(p1,35,'''
67 XbgoohhhhXXhhhhhXXXXhhX
67 XbgoohhhhXnhhhhhXneehhoX
68 XbgoohhhhhhoohhhhXXXohhoX
68 XbgoohhhhhhooghhhhhhhjjjjXXX
68 XbgoohhhhhhooghhhhhjjwwwwwwjXXX
67 XbgohhhhhhhhooghhhjjwwwwwwwwwjjXX
67 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiX
66 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
65 XbgoohhhjjjjhhhooiijjiiivvvttttX
64 XbgoohhjjwwjjjhooiijiiivvtttXXtX
63 XbgohjjwwwwwjjjhooiiivvttXppppX
62 XbgohjjwwwwwwwjjhhoiivvttXppX
61 XbgohjjwwwwwwwwwjjhooivvtXjiiXX
60 XbgohjjwwwwwwwwwwjjhooivvXiiitX
60 XbgohjjwwwwwwwwwwwjjhooivXtttX
''')
# Near wing wrist presses into the aching crop, replacing a straight wing edge.
block(p1,75,'''
30 XssbbgoohhhhhhhkkXXX
29 XssbbgoohhhhhhhhkkkkXX
28 XssbbgoohhhhhhhhhhhkkkXX
27 XssbbgoohhhhhhhhhhhhhkkXX
26 XssbbgoohhhhhhhhhhhhhhkkX
25 XssbbgoohhhhhhhhhhhhhhhkkX
24 XssbbgoohhhhhhhhhhhhhhhhkX
23 XssbbgoohhhhhhhhhhhhhhhhkX
22 XssbbgoohhhhhhhhhhhhhhhhkX
21 XssbbgoohhhhhhhhhhhhhhhhkX
20 XssbbgoohhhhhhhhhhhhhhhhkX
21 XssbbgoohhhhhhhhhhhhhhhkX
22 XssbbgoohhhhhhhhhhhhhhkX
23 XssbbgoohhhhhhhhhhhhhkX
24 XssbbgoohhhhhhhhhhhhkX
25 XssbbgoohhhhhhhhhhhkX
''')
# Literal bubbles rise from beak; no tint of the bird's gold or silver.
block(p1,46,'109 pqqp\n108 pqrrqp\n108 pqrrqp\n109 pqqp')
block(p1,36,'117 pp\n116 pqrrp\n116 pqrqp\n117 pqp\n118 p')
block(p1,29,'109 pqp\n108 pqrrp\n109 pqp')
save('poison_a',p1)
p2=[list(z) for z in frames['poison_a']]
block(p2,46,'108 ........\n108 ........\n108 ........\n108 ........')
block(p2,36,'116 .......\n116 .......\n116 .......\n116 .......\n116 .......')
block(p2,29,'108 ......\n108 ......\n108 ......')
# Second cough contracts the face/neck; toxic bubbles break at different heights.
block(p2,35,'''
67 XbgoohhhhXXhhhhhXXXXhhX
67 XbgoohhhhXnhhhhhXnnnhhoX
68 XbgoohhhhhhoohhhhXXXohhoX
69 XbgoohhhhhhooghhhhhhhjjjjXXX
69 XbgoohhhhhhooghhhhhjjwwwwwwjXXX
68 XbgohhhhhhhhooghhhjjwwwwwwwwwjjXX
68 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiX
67 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
66 XbgoohhhjjjjhhhooiijjiiivvvttttX
65 XbgoohhjjwwjjjhooiijiiivvtttXXtX
64 XbgohjjwwwwwjjjhooiiivvttXppppX
63 XbgohjjwwwwwwwjjhhoiivvttXppX
62 XbgohjjwwwwwwwwwjjhooivvtXjiiXX
61 XbgohjjwwwwwwwwwwjjhooivvXiiitX
61 XbgohjjwwwwwwwwwwwjjhooivXtttX
''')
block(p2,44,'115 pqqp\n114 pqrrqp\n114 pqrrqp\n115 pqqp')
block(p2,25,'116 pqp\n115 pqrrp\n115 pqrqp\n116 pqp')
block(p2,20,'104 pq.p\n103 pr...q\n103 p...qp\n104 pp')
block(p2,82,'''
19 XssbbgoohhhhhhhhhhhhhhkkX
20 XssbbgoohhhhhhhhhhhhhhkkX
21 XssbbgoohhhhhhhhhhhhhkkX
22 XssbbgoohhhhhhhhhhhhkkX
23 XssbbgoohhhhhhhhhhhkkX
24 XssbbgoohhhhhhhhhhkkX
''')
save('poison_b',p2)

# Stun: neck bends far down; wings/tarsi still have their own articulated masses.
z1=[list(z) for z in frames['windup']]
for yy in range(20,72):z1[yy][62:127]=list('.'*65)
block(z1,42,'''
80 XXX
79 XhkXXX
78 XohkkkXXX
77 XgohkkkkkhhXX
77 XbgoohhhhhhhhhXX
77 XbgoohhhhhhhhhhhXX
77 XbgoohhhhhhhhhhhhhX
77 XbgoohhhhhhhhhhhhhhhX
77 XbgoohhhhhhhhhhhhhhhhX
77 XbgoohhhhhhhhhhhhhhhhX
76 XbgoohhhhXXhhhhhhXXXhhX
75 XbgoohhhhXnhhhhhhnnnXhoX
74 XbgoohhhhhhoohhhhhXXohhoX
73 XbgoohhhhhhooghhhhhhhjjjjXXX
72 XbgoohhhhhhooghhhhhjjwwwwwwjXXX
71 XbgohhhhhhhhooghhhjjwwwwwwwwwjjXX
70 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiX
69 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
68 XbgoohhhjjjjhhhooiijjiiivvvttttX
67 XbgoohhjjwwjjjhooiijiiivvtttXXtX
66 XbgohjjwwwwwjjjhooiiivvttX..XX
65 XbgohjjwwwwwwwjjhhoiivvttX
64 XbgohjjwwwwwwwwwjjhooivvtX
63 XbgohjjwwwwwwwwwwjjhooivvX
62 XbgohjjwwwwwwwwwwwjjhooivX
61 XbgohjjwwwwwwwwwwwjjhooivX
60 XbgohjjwwwwwjjwwwwwjjhooivX
59 XbgohjjwwwwjjijwwwwwjjhooivX
58 XbgohjjwwwjjiijjwwwwwjjhooivX
57 XbgohjjwwjjiivijjwwwwjjhooivX
56 XbgohjjwjjiivviijjwwwjjhooivX
55 XbgohjjjjiivvvviijjwwjjhooivX
54 XbgohjjiivvvttvviijjwjhooivX
53 XbgohjiivvtttttvviijjhooivX
52 XbgohhiivvtttttttvviijhooivX
''')
# Four pointed, unlettered stars at differing distances from bowed crown.
block(z1,24,'78 k\n78 wk\n76 kwwwkk\n78 wk\n78 k')
block(z1,35,'111 k\n110 kwk\n108 kkwwwkk\n110 kwk\n111 k')
save('stun_a',z1)
z2=[list(z) for z in frames['stun_a']]
block(z2,24,'76 ........\n76 ........\n76 ........\n76 ........\n76 ........')
block(z2,35,'108 ........\n108 ........\n108 ........\n108 ........\n108 ........')
block(z2,25,'109 k\n108 kwk\n106 kkwwwkk\n108 kwk\n109 k')
block(z2,33,'66 k\n65 kwk\n63 kkwwwkk\n65 kwk\n66 k')
block(z2,53,'''
75 XbgoohhhhhnnhhhhhhnnnhoX
74 XbgoohhhhhhoohhhhhXXohhoX
73 XbgoohhhhhhooghhhhhhhjjjjXXX
72 XbgoohhhhhhooghhhhhjjwwwwwwjXXX
71 XbgohhhhhhhhooghhhjjwwwwwwwwwjjXX
70 XbgohhhhhhhhhhooghjjwwwwwjjiiiiiiX
69 XbgoohhhhjjhhhhhoijjwwwjiiivvvvtX
68 XbgoohhhjjjjhhhooiijjiiivvvttttX
''')
block(z2,89,'''
47 XbgohhhhhhhhhhhhhhhhhoooooogggX
48 XbgohhhhhhhhhhhhhhhhoooooogggX
49 XbgohhhhhhhhhhhhhhhoooooogggX
50 XbgohhhhhhhhhhhhhhoooooogggX
51 XbgohhhhhhhhhhhhhoooooogggX
''')
save('stun_b',z2)
# Skill preparation: planted hips, raised golden pinions, two physical tip cores.
k1=copy_idle()
block(k1,9,'''
30 XkwX
29 XhwwkX
28 XohwwwkX
27 XohhwwwkX
26 XgohhwwwkX
25 XgohhhwwkX
24 XgohhhhwkX
23 XbgohhhhkX
''')
# Charged near primary still has a dark feather root, pale shaft and gold branches.
block(k1,96,'''
42 XbggoohhwwkX
43 XbggoohwwwwkX
44 XbggoohwwwwwkX
45 XbggoohwwwwkX
46 XbggoohhwwkX
47 XbggoohhwkX
48 XbggoohhkX
49 XbggoohhX
50 XbggohX
51 XXXXX
''')
block(k1,33,'''
66 XbgoohhhhhhhhhhhhhhhhhhhoX
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhXneXhhhhhXnneeXhhoX
66 XbgoohhhXeeXohhhhXeeenXohoX
66 XbgoohhhhXXooghhhhXXXXohhoX
''')
block(k1,77,'''
53 XbgohhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhoooooogggX
52 XbgohhhhhhhhhhhhhhhhoooooogggX
53 XbgohhhhhhhhhhhhhhhoooooogggX
''')
save('skill_a',k1)

# Cast: crouched body and active face. Far wing unfurls to two upper launch fingers.
k2=[list(z) for z in frames['stun_a']]
# Remove only authored status stars.
block(k2,24,'76 ........\n76 ........\n76 ........\n76 ........\n76 ........')
block(k2,35,'108 ........\n108 ........\n108 ........\n108 ........\n108 ........')
for yy in range(9,63):k2[yy][1:62]=list('.'*61)
block(k2,12,'''
60 XXX
59 XhkXX
58 XohkkXX
57 XgohkkkXX
56 XbgohhkkkXX
55 XbgohhhkkkXX
54 XbgohhhhkkkXX
53 XbgohhhhhkkkXX
52 XbgohhhhhhkkkXX
51 XbgohhhhhhhkkkXX
50 XbgohhhhhhhhkkkXX
49 XbgohhhhhhhhhkkkXX
48 XbgohhhhhhhhhhkkkXX
47 XbgohhhhhhhhhhhkkkXX
46 XbgohhhhhhhhhhhhkkkXX
45 XbgohhhhhhhhhhhhhkkkXX
44 XbgohhhhhhhhhhhhhhkkkXX
43 XbgohhhhhhhhhhhhhhhkkkXX
42 XbgohhhhhhhhhhhhhhhhkkkXX
41 XbgohhhhhhhhhhhhhhhhhkkkXX
40 XbgohhhhhhhhhhhhhhhhhhkkkXX
39 XbgohhhhhhhhhhhhhhhhhhhkkkXX
38 XbgohhhhhhhhhhhhhhhhhhhhkkkXX
37 XbgohhhhhhhhhhhhhhhhhhhhhkkkXX
36 XbgohhhhhhhhhhhhhhhhhhhhhhkkkXX
35 XbgohhhhhhhhhhhhhhhhhhhhhhhkkkXX
34 XbgohhhhhhhhhhhhhhhhhhhhhhhhkkkXX
33 XbgohhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
32 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
31 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
30 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
29 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
28 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
27 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
26 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
25 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
24 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
23 XbgohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
24 XbgoohhhhhhhhoooooooooohhhhhhhhhhhhhhhkkkXX
25 XbgooohhhhhoooooooooooohhhhhhhhhhhhhhkkkXX
26 XbgoooohhoooooooooooooohhhhhhhhhhhhhkkkXX
27 XbgooooohooooooooooooogohhhhhhhhhhhkkkXX
28 XbgoooooohoooooooooooggohhhhhhhhhhkkkXX
29 XbgooooooohooooooooogggohhhhhhhhhkkkXX
30 XbgoooooooohooooooogggoohhhhhhhkkkXX
31 XbgooooooooohooooggggoohhhhhhkkkXX
32 XbgoooooooooohoogggggoohhhhhkkkXX
33 XbgoooooooooooogggggoohhhhkkkXX
34 XbgooooooooooooggggoohhhhkkkXX
35 XbgoooooooooooogggoohhhhkkkXX
36 XbgooooooooooooggoohhhhkkkXX
37 XbgoooooooooooogoohhhhkkkXX
38 XbgoooooooooooooohhhhkkkXX
39 XbgooooooooooooohhhhkkkXX
40 XbgoooooooooooohhhhkkkXX
41 XbgooooooooooohhhhkkkXX
''')
# Active near/far eyes have bright irises under pressed black brows.
block(k2,52,'''
76 XbgoohhhhXXXhhhhhXXXXhhX
75 XbgoohhhXneXhhhhXnneehhoX
74 XbgoohhhXeeXohhhXeeenohhoX
73 XbgoohhhhXXooghhoXXXohjjjjXXX
''')
# Near wing lifts its elbow and spreads short golden coverts toward third root.
block(k2,65,'''
84 XXohhhkkXXX
83 XgoohhhhkkkkXX
82 XgoohhhhhhkkkkXX
81 XgoohhhhhhhhkkkkXX
80 XgoohhhhhhhhhhkkkkXX
79 XgoohhhhhhhhhhhhkkkkXX
78 XgoohhhhhhhhhhhhhhkkkkXX
77 XgoohhhhhhhhhhhhhhhhkkkkXX
76 XgoohhhhhhhhhhhhhhhhhhkkkkXX
75 XgoohhhhhhhhhhhhhhhhhhhhkkkkXX
74 XgoohhhhhhhhhhhhhhhhhhhhhhkkkkXX
73 XgoohhhhhhhhhhhhhhhhhhhhhhhhkkkkXX
72 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhkkkkXX
71 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
70 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkkXX
69 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkXX
68 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkX
67 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
66 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
65 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhhX
64 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhhX
63 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhhX
62 XgoohhhhhhhhhhhhhhhhhhhhhhhhhhX
61 XgoohhhhhhhhhhhhhhhhhhhhhhhhhX
60 XgoohhhhhhhhhhhhhhhhhhhhhhhhX
''')
# Feather 1: a native long pale rachis with stepped gold barbs and hooked point.
block(k2,8,'''
121 XX
118 XhkwkX
115 XohkwwkXX
111 XXohhkwwwkkX
107 XXohhhkwwwhkkX
103 XXohhhhkwwwhhkkX
99 XXohhhhhkwwwhhhkkX
95 XXohhhhhhkwwwhhhhkkX
91 XXohhhhohhkwwwhhhhhkkX
87 XXohhhoohhhkwwwhhhhhhkkX
83 XXohhoooohhhkwwwhhhhhhhkkX
79 XXohooooohhhhkwwwhhhhhhhhkkX
75 XXoooooooghhhhkwwwhhhhhhhhkkX
71 XXooooooggghhhhkwwwhohhhhhhkkX
67 XXoooogggggghhhhkwwwhooohhhhkkX
63 XXooggggggggghhhhkwwhooohhhkkX
61 XoggggggggggghhhhkwhooohhkkX
60 XogggggggggghhhhkwhooohhkkX
59 XoggggggggghhhhkwhooohhkkX
58 XoggggggghhhhkwhooohhkkX
57 XoggggghhhhkwhooohhkkX
56 XoggghhhhkwhooohhkkX
55 XoghhhkwhooohhkkX
54 XohhkwhooohhkkX
53 XohkwhooohhkkX
52 XohkwhoohkkX
51 XohkwhohkkX
50 XohkwhkkX
49 XohkwkkX
48 XohkwkX
47 XohkwX
46 XohkX
45 XohX
44 XXX
''')
# Feather 2: broader, differently stepped golden blade rooted in adjacent pinion.
block(k2,30,'''
121 XX
117 XohwkXX
113 XohhwwkkXX
108 XXohhhwwwkkX
103 XXohhhhwwwhkkX
98 XXohhhhhwwwhhkkX
93 XXohhhhhhwwwhhhkkX
88 XXohhhhhhhwwwhhhhkkX
83 XXohhhhhhhhwwwhhhhhkkX
78 XXohhhhhohhhwwwhhhhhkkX
73 XXohhhhoohhhhwwwhhhhhkkX
69 XohhhhoooohhhhwwwhhhhhhkkX
65 XohhhoooooghhhhwwwhhhhhhhkkX
62 XohhoooogggghhhhwwwhhhhhhhkkX
60 XohoooggggggghhhhwwwhhhhhkkX
59 XooooggggggggghhhwwwhohhkkX
58 XoogggggggggggghhwwhooohkX
57 XoggggggggggggghwwhoooohX
56 XoggggggggggghhwwhooohkX
55 XoggggggggghhwwhooohkX
54 XoggggggghhwwhooohkX
53 XoggggghhwwhooohkX
52 XoggghhwwhooohkX
51 XoghhwwhooohkX
50 XohhwwhooohkX
49 XohwwhooohkX
48 XohwwhoohkX
47 XohwwhohkX
46 XohwwhhkX
45 XohwwhkX
44 XohwwkX
43 XohwkX
42 XohkX
41 XXX
''')
# Feather 3 launches from the near/right wing end: shorter curved silver-gold quill.
block(k2,65,'''
123 XX
120 XhwkX
116 XohwwkXX
112 XohhwwwkkX
109 XohhhwwwhkkX
106 XohhhhwwwhhkkX
103 XohhhhhwwwhhhkkX
100 XohhhhhhwwwhhhhkkX
97 XohhhhhhhwwwhhhhhkkX
94 XohhhohhhhwwwhhhhhkkX
91 XohhoohhhhwwwhhhhhhkX
89 XohooohhhhwwwhhhhhhkX
87 XooooghhhhwwwhhhhhhkX
86 XooogghhhhwwhohhhhhkX
85 XoogggghhhwwhooohhhkX
84 XoggggghhhwwooohhhkX
83 XoggggghhwwhooohhkX
82 XogggghhwwhooohhkX
81 XoggghhwwhooohhkX
80 XoghhwwhooohhkX
79 XohhwwhooohhkX
78 XohwwhooohhkX
77 XohwwhoohhkX
76 XohwwhohhkX
75 XohwwhhhkX
74 XohwwhhkX
73 XohwwhkX
72 XohwwkX
71 XohwkX
70 XohkX
69 XXX
''')
save('skill_b',k2)

# Recovery: wing fingers fold; two shattered, unequal lingering feather outlines.
k3=[list(z) for z in frames['recover']]
block(k3,34,'''
66 XbgoohhhhXXXhhhhhhXXXXhhhoX
66 XbgoohhhhXnnXhhhhhXnneeXhhoX
66 XbgoohhhhhXXoohhhhXeeenXohoX
66 XbgoohhhhhhooghhhhXXXXohhoX
''')
block(k3,62,'''
44 XXbgoohhhhhiivvtttvviijhoooivX
43 XXbgoohhhhhiiivvtvviijhoooovvX
42 XXbgoohhhhhhiiivvvviijhoooovvX
41 XXbgoohhhhhhhiiivvviijhoooogvX
40 XXbgoohhhhhhhhiiiviijhoooogvX
39 XXbgoohhhhhhhhhiiijhoooogvX
''')
block(k3,23,'''
116 hkX
113 ohwkX
110 ohhwwkX
108 ohhhwwhkX
106 ohhhhwwhhkX
104 ohhhho.wwhhkX
102 ohhhho..wwhhkX
100 ohhhho...wwhkX
98 ohhhho...wwhkX
97 ohhho...wwhkX
96 ohho...wwhkX
95 oho...wwhkX
94 oo...wwhkX
93 oo...whkX
92 oo...hkX
91 oo...kX
90 oo..kX
89 oo.kX
88 ookX
87 okX
86 kX
''')
block(k3,62,'''
120 hkX
117 ohwkX
114 ohhwwkX
112 ohhhwwhkX
110 ohhhho.wwhkX
108 ohhhho..wwhkX
106 ohhhho...wwhkX
104 ohhhho...wwhkX
103 ohhho...wwhkX
102 ohho...wwhkX
101 oho...whkX
100 oo...hkX
99 oo...kX
98 oo..kX
97 oo.kX
96 ookX
95 okX
94 kX
''')
save('skill_c',k3)
# Three cast quills gain individual gold barbs, stepped shoulder edges and veins.
# These literal patches widen each feather rather than synthesizing another blade.
block(k2,16,'''
90 XohhhXghhhkwwwhhhhhkkX
86 XohhhXgghhhkwwwhhhhhhkkX
82 XohhhXggghhhkwwwhhhhhhhkkX
78 XohhhXgggghhhkwwwhhhhhhhhkkX
74 XohhhXggggghhhkwwwhhhhhhhhkkX
70 XohhhXgggggghhhkwwwhohhhhhhkkX
66 XohhhXggggggghhhkwwwhooohhhhkkX
62 XohhhXggggggghhhhkwwhooohhhkkX
60 XohhhXggggggghhhhkwhooohhkkX
''')
block(k2,36,'''
92 XohhhhXghhhwwwhhhkkX
87 XohhhhXgghhhwwwhhhhkkX
82 XohhhhXggghhhwwwhhhhhkkX
77 XohhhhXgggghhhwwwhhhhhkkX
72 XohhhhXggggghhhwwwhhhhhkkX
68 XohhhhXgggggghhhwwwhhhhhhkkX
64 XohhhhXggggggghhhwwwhhhhhhhkkX
61 XohhhhXgggggggghhhwwwhhhhhhhkkX
59 XohhhhXggggggggghhhwwwhhhhhkkX
''')
block(k2,72,'''
99 XohhhhXghhhwwwhhhhkkX
96 XohhhhXgghhhwwwhhhhhkkX
93 XohhhhXggghhhwwwhhhhhkkX
90 XohhhhXgggghhhwwwhhhhhhkX
88 XohhhhXggggghhhwwwhhhhhhkX
86 XohhhhXgggggghhhwwwhhhhhhkX
85 XohhhhXgggggghhhwwhohhhhhkX
84 XohhhhXgggggghhhwwhooohhhkX
''')
save('skill_b',k2)
# Small genuine jaw drop on the exhale cel; the eyelids remain closed and unshifted.
block(s2,67,'''
68 .XbgoohhhhjjhhhhhohjjwwwwwwwwwjjXX
67 .XbgoohhhjjjjhhhooiijjwwwwwjjiiiiiX
66 .XbgoohhjjwwjjjhooiijjwwwjiiivvvvtX
65 .XbgohjjwwwwwjjjhooiijjiiivvvttttX
64 .XbgohjjwwwwwwwjjhhoijiiivvtttXXtX
63 .XbgohjjwwwwwwwwwjjhoiivvttX..XX
62 XbgohjjwwwwwwwwwwjjhooivvtX
61 XbgohjjwwwwwwwwwwwjjhooivvX
''')
save('sleep_b',s2)
# Final native claw inspection: enlarge the gripping forefoot and inward hooks.
# Entire selected forefoot area is explicitly replaced; support leg stays planted.
for yy in range(106,124):t[yy][85:127]=list('.'*42)
block(t,106,'''
85 XjjiiiiiivvtttXXX
86 XjjiiiiiivvvtttttXXXXX
87 XjjiiiiiivvvtttttXjjjjjjjjjXX
88 XjjiiiiiivvvtttXjjjjiiiivvttttXX
89 XjjiiiiivvvtttXjjiiivvtttXjjjitX
90 XjjiiiivvvtttXjjiiivvttX.XjjittX
91 XjjiiivvvtttXjjiiivvtX..XjjittX
92 XjjiiivvtttXjjiiiivtX..XjittX
93 XjjiiivtttXjjiiiivtX..XjttX
94 XjjiiitttXjjiiiivtX..XjttX
95 XjjiiittXjjiiiitX..XjttX
96 XjjiiitX.XjjiiitX..XttX
97 XjjittX..XjiitX.XttX
98 XjittX...XjttXXttX
99 XttXX....XttttttX
100 XXX.....XXXXX
''')
save('attack',t)
# Final seam inspection, move: author a broad tail root and loaded far hip.
block(m,94,'''
25 XsbbggoohhhhhhhhXX
26 XsbbggoohhhhhhhhhXX
27 XsbbggoohhhhhhhhhhXX
28 XsbbggoohhhhhhhhhhhXX
29 XsbbggoohhhhhhhhhhhhXX
30 XsbbggoohhhhhhhhhhhhhXX
31 XsbbggoohhhhhhhhhhhhhhXX
32 XsbbggoohhhhhhhhhhhhhhhXX
33 XsbbggoohhhhhhhhhhhhhhhX
34 XsbbggoohhhhhhhhhhhhhhX
''')
block(m,92,'''
66 XbggoohhhhhhX
66 XbggoohhhhhhX
66 XbggoohhhhhhX
66 XbggoohhhhhhhX
67 XbggoohhhhhhhhX
68 XbggoohhhhhhhhX
69 XbggoohhhhhhhhX
70 XbggoohhhhhhhhX
71 XbggoohhhhhhhX
''')
save('move',m)
# Contact's actual tail location is inspected and separately authored.
block(t,94,'''
25 XsbbggoohhhhhhhhXX
26 XsbbggoohhhhhhhhhXX
27 XsbbggoohhhhhhhhhhXX
28 XsbbggoohhhhhhhhhhhXX
29 XsbbggoohhhhhhhhhhhhXX
30 XsbbggoohhhhhhhhhhhhhXX
31 XsbbggoohhhhhhhhhhhhhhXX
32 XsbbggoohhhhhhhhhhhhhhhXX
33 XsbbggoohhhhhhhhhhhhhhhX
34 XsbbggoohhhhhhhhhhhhhhX
''')
# Remove obsolete lift-foot pixels BEHIND the freshly drawn seizing foot.
block(t,106,'''
69 ................
69 .................
69 ..................
69 ...................
69 ....................
69 .....................
69 ......................
69 .......................
69 ........................
69 .........................
69 ..........................
''')
save('attack',t)
block(hit,48,'93 ..');save('hit',hit)
block(p1,48,'93 ..');save('poison_a',p1)

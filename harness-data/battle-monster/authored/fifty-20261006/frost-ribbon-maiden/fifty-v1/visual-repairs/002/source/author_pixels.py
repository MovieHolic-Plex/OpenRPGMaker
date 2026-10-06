"""Literal hand-selected rows and local row replacements. No geometry or transforms.
Run locally to expand the authored row strings to full 96-column ASCII originals.
Leading/trailing padding is transparent canvas only, never synthesized art.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
PALETTE = {
    'o':'#263A58', 'd':'#405D80', 'b':'#6284A7', 'c':'#86ABC3',
    'l':'#BFD8E0', 'w':'#F1F6ED', 'h':'#D5E2E5', 's':'#9FAEBF',
    'f':'#E5EEF0', 't':'#A9C5D1', 'n':'#C9DDE0', 'e':'#182C46',
    'a':'#397CA3', 'i':'#6BBACE', 'g':'#B6F0ED', 'p':'#846AA6',
    'v':'#A2BC80', 'r':'#77617F'
}

def rows(frame, literal):
    """Replace only explicitly named rows with explicitly selected pixels."""
    for entry in literal.strip().splitlines():
        y, x, pixels = entry.split()
        y, x = int(y), int(x)
        assert 0 <= x and x + len(pixels) <= 96, entry
        assert set(pixels) <= set(PALETTE) | {'.'}, entry
        frame[y] = '.' * x + pixels + '.' * (96-x-len(pixels))

def blank():
    return ['.'*96 for _ in range(96)]

BASE = blank()
rows(BASE, '''
20 38 oooooooo
21 35 ooohhhhhhhhoo
22 33 oohwwwwhhhhhhhho
23 32 ohwwwwhhhhhhsshho....aggo
24 31 ohwwwhhhhhhhhhhsshoaaigggo
25 30 ohwwwhhhhwwhhhhsshaaiaao
26 30 ohwwhhhhwwhhhssshhhoaao
27 29 ohwwhhhwwhhsshhhhhhhho
28 29 ohwwhhwwhhshhfffffffho
29 29 ohwwhwwhhshhfffffffffo
30 29 ohwwhwhhshhffnnffffffo
31 28 ohwwhhhhhshffnntffffnfo
32 28 ohwwhhhhhshffnteefffnffo
33 28 ohwwhhhhhshffntefffnfffo
34 28 ohwwhhhhsshffnntfffnffffo
35 28 ohwwhhhhsshffnnnffnfffto
36 28 ohwwhhhsshhtfnnnnnfffto
37 28 ohwwhhhsshhhtfnnnnntto
38 28 ohwwhhhsshhhhttntttto
39 28 ohwwhhhsshhhhhotttto
40 27 ohwwhhhhsshhhhhottnno
41 27 ohwwhhhhsshhhhhotnnno
42 27 ohwwhhhhsshhhhohwltnlo
43 27 ohwwhhhhsshhhhlwwltnlclo
44 27 ohwwhhhsshhohwwwlccllcccloo
45 26 ohwwwsshhohwwwwlccblwllllccco
46 26 ohwwsshhohwwwwlcbbblwwlllllccco
47 26 ohwwshhohwwwwlccbbblwwwllllllccco
48 26 ohwwshohwwwllccbbaalwwwwlllccbbbco
49 26 ohwwshohwwwlccbaaialwwwwllccbdddco
50 26 ohwwshohwwlccbaiggialwwwllcbbddddo
51 26 ohwwshohwwlcbbaaiaalwwwllcbbdddbo
52 26 ohwwshohwwlcbbbaaaalwwllccbbddbo
53 26 ohwwshohwwlccbbddaalwllccbbdbbo
54 26 ohwwshohwwlccbddaalwllccbbdbbo
55 26 ohwwshohwwlccbddalwllccbbdbooofffo
56 26 ohwwshohwwlccbddalwllccbbbo..ofnfnoiggo
57 26 ohwwshohwwlccbddalwllccbbo...otntoigwwggo
58 26 ohwwshohwwlccbddalwllcbbo....oooooiggwwllgo
59 26 ohwwshohwwlccbddalwllbbo..........oigwwllcgo
60 26 ohwwshohwwlccbddalwllbo.............oigwwlcgo
61 26 ohwwshohwwlccbddalwllbo..............oigwwlcgo
62 26 ohwwshohwwlccbddalwllbo...............oigwwlgo
63 26 ohwwshohwllccbddalwllbo................oigwlgo
64 26 ohwwshohlwllcbddalwllbo.................oigwgo
65 26 ohwwshohlwllcbddalwllbo..................oiggo
66 26 ohwwshohlwllcbddalwllcbo.................oiggo
67 26 ohwwshohlwllcbddalwwllcbo................oiggo
68 26 ohwwshohlwllcbddalwwwllcbo..............oigwgo
69 26 ohwwshohlwllcbddalwwwwllcbo............oigwlgo
70 26 ohwwshohlwwlcbddalwwwwwllcbo..........oigwlgo
71 26 ohwhshohlwwlcbddalwwwwwwllcbo........oigwlgo
72 26 ohhhsohlwwwlcbddalwwwwwwllccbo......oigwlgo
73 26 ohhsohlwwwwlcbddalwwwwwwlllccbo....oigwlgo
74 26 ohsohlwwwwwlcbddalwwwwwllllccbo....oigwgo
75 26 osohlwwwwwllcbddalwwwwllllcccbbo....oiggo
76 26 oohlwwwwwlllcbddalwwwllllcccbbbo.....oiggo
77 26 ohlwwwwwllllcbddalwwllllcccbbbbo......oiggo
78 26 olwwwwwllllccbddalwllllcccbbbbbo.......oiggo
79 25 olwwwwwllllcccbddalwlllcccbbbbbbo........oiggo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo........oiggo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo........oiggo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo.........oigo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo........oigo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo.......oigo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo.......ogo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo......ogo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo.....ogo
88 24 occbbddddddooooooolllccbbdddddcccooo....ogo
89 25 ooobbbbbboo.....ooccbbbbooooocoo.......oo
90 30 otttnnnno.......ottntnno
91 29 otnfffffnno......otnffffnno
92 29 oooooooooodo.....ooooooooodo
''')

def clusters(frame, literal):
    """Apply short, manually selected coordinate strings, retaining other pixels."""
    for entry in literal.strip().splitlines():
        y, x, pixels = entry.split()
        y, x = int(y),int(x)
        assert x+len(pixels)<=95 and set(pixels)<=set(PALETTE)|{'.'}, entry
        frame[y]=frame[y][:x]+pixels+frame[y][x+len(pixels):]

# Rear arm: shoulder 33,48; elbow 23,58; cuff 27,67; fingers 28,70.
# These are fabric planes selected one row at a time, in front of the hair.
clusters(BASE, '''
48 25 olcc
49 24 olwwlcc
50 23 olwwwlcc
51 22 olwwwwlcc
52 21 olwwwwllcc
53 21 olwwwwllcc
54 20 olwwwwlllcc
55 20 olwwwwlllcc
56 19 olwwwwllllcc
57 19 olwwwllllccbo
58 19 olwwwlllccbbo
59 19 olwwwllccbbdo
60 20 olwwllccbbdo
61 20 olwllccbbdo
62 21 ollccbbddo
63 21 olccbbdddo
64 22 occbbaddo
65 22 ocbbaiado
66 23 obbaigado
67 24 obaigado
68 25 oattnto
69 26 otnnno
70 27 ottto
71 28 ooo
''')
FRAMES = {'idle_a':BASE}

def derived(name, changes, origin='idle_a'):
    f = FRAMES[origin].copy()
    rows(f, changes)
    FRAMES[name] = f
    return f

# The smaller breathing changes are separate chosen clusters, not frame shifts.
derived('idle_b', '''
43 27 ohwwhhhhsshhhhlwwltnlclo
44 27 ohwwhhhsshhohwwwllcllcccloo
45 26 ohwwwsshhohwwwwllcblwllllccco
46 26 ohwwsshhohwwwwlccbbblwwllllccco
47 26 ohwwshhohwwwwlccbbblwwwllllcccco
66 26 ohwwshohlwllcbddalwllcbo.................oigwgo
67 26 ohwwshohlwllcbddalwwllcbo...............oigwlgo
68 26 ohwwshohlwllcbddalwwwllcbo.............oigwlgo
69 26 ohwwshohlwllcbddalwwwwllcbo...........oigwlgo
72 26 ohhhsohlwwwlcbddalwwwwwwllccbo.....oigwlgo
73 26 ohhsohlwwwwlcbddalwwwwwwlllccbo...oigwgo
74 26 ohsohlwwwwwlcbddalwwwwwllllccbo....oiggo
''')
derived('idle_c', '''
24 31 ohwwwhhhhhhhhhhsshoaaiggo
25 30 ohwwwhhhhwwhhhhsshaaiaao
46 26 ohwwsshhohwwwwlcbbblwwllllccco
47 26 ohwwshhohwwwllccbbblwwlllllccco
48 26 ohwwshohwwwllccbbaalwwwlllccbbbco
72 26 ohhhsohlwwwlcbddalwwwwwwllccbo.......oigwlgo
73 26 ohhsohlwwwwlcbddalwwwwwwlllccbo.....oigwlgo
74 26 ohsohlwwwwwlcbddalwwwwwllllccbo....oigwlgo
75 26 osohlwwwwwllcbddalwwwwllllcccbbo...oigwgo
76 26 oohlwwwwwlllcbddalwwwllllcccbbbo....oiggo
77 26 ohlwwwwwllllcbddalwwllllcccbbbbo......oigo
''')

# Pull the leading hand into the shoulder. Sleeve turns at the visible elbow.
derived('windup', '''
32 28 ohwwhhhhhshffnteefffnffo
33 28 ohwwhhhhhshffntefffnfffo
43 27 ohwwhhhhsshhhhlwwltnlclo
44 27 ohwwhhhsshhohwwwlccllcccloooo
45 26 ohwwwsshhohwwwwlccblwllllcofffo
46 26 ohwwsshhohwwwwlcbbblwwllcofnnnoiggo
47 26 ohwwshhohwwwwlccbbblwwwllotnttoigwlgo
48 25 olccshohwwwllccbbaalwwwllcoooigwwllgo
49 24 olwwlccohwwlccbaaialwwwwwllcigwwllcgo
50 23 olwwwlccohwlccbaiggialwwwwwligwwllccgo
51 22 olwwwwlccohlcbbaaiaalwwwwwlligwlllccgo
52 21 olwwwwllccolcbbbaaaalwwwwllcciigllccgo
53 21 olwwwwllccolccbbddaalwwlllcccbbiglcgo
54 20 olwwwwlllccolccbddaalwlllcccbbboiggo
55 20 olwwwwlllccolccbddalwlllcccbbbbo.oggo
56 19 olwwwwllllccolccbddalwllcccbbbbo..oggo
57 19 olwwwllllccbolccbddalwllcccbbbo...oggo
58 19 olwwwlllccbboccbddalwllcccbbbo....oiggo
59 19 olwwwllccbbdoccbddalwllccbbbo......oiggo
60 20 olwwllccbbdoccbddalwllccbbbo........oiggo
61 20 olwllccbbdo.ccbddalwllccbbbo.........oiggo
62 21 ollccbbddo..ccbddalwllccbbbo.........oigwgo
63 21 olccbbdddo..ccbddalwllccbbbo........oigwlgo
64 22 occbbaddo...ccbddalwllccbbbo.......oigwlgo
65 22 ocbbaiado...ccbddalwllccbbbo......oigwlgo
66 23 obbaigado...ccbddalwllccbbbo.....oigwlgo
67 24 obaigado...lccbddalwwllccbbbo...oigwlgo
68 25 oattntoh..lwwccbddalwwlllccbo..oigwlgo
69 26 otnnnosh.lwwwccbddalwwwllccbo..oigwgo
70 27 otttosholwwwwccbddalwwwwllccbo..oggo
71 28 ooosholwwwwlccbddalwwwwwllccbo..ogo
72 26 ohhhsohlwwwlccbddalwwwwwllccbo..ogo
73 26 ohhsohlwwwwlccbddalwwwwwwllccbo..ogo
74 26 ohsohlwwwwwlccbddalwwwwwlllccbo..ogo
75 26 osohlwwwwwwlccbddalwwwwllllccbo..ogo
76 26 oohlwwwwwwllccbddalwwwllllcccbbo..ogo
77 26 ohlwwwwwwlllccbddalwwllllcccbbbo...ogo
78 26 olwwwwwllllcccbddalwllllcccbbbbo....ogo
79 25 olwwwwwllllcccbbddalwlllcccbbbbbbo....ogo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo.....ogo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo.....ogo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo......ogo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo.....ogo
84 23 olwllllcccbbbbddddalwllcccbbddddbbbbo....ogo
85 24 olllllcccbbbbbddddalwllcccbbdddddbbbo....ogo
86 24 olllcccbbbbbdddddalwllcccbbddddddbbbo....ogo
87 25 olcccbbbbbdddddddalwllccbbddddddcbbo....ogo
88 26 occbbddddddooooooolllccbbddddcccooo.....oo
89 27 ooobbbbbboo.....ooccbbbboooocoo
90 31 otttnnnno.......ottntnno
91 30 otnfffffnno......otnffffnno
92 29 oooooooooodo.....ooooooooodo
''')

# Forward hop: skirt opens over a real raised knee, planted rear toes push.
derived('move', '''
29 29 ohwwhwwhhshhfffffffffo
30 29 ohwwhwhhshhffnnffffffo
31 28 ohwwhhhhhshffnntffffnfo
32 28 ohwwhhhhhshffnteefffnffo
33 28 ohwwhhhhhshffntefffnfffo
42 27 ohwwhhhhsshhhhohwltnllo
43 27 ohwwhhhhsshhhhlwwltnllcloo
44 27 ohwwhhhsshhohwwwlccllllcccloo
45 26 ohwwwsshhohwwwwlccblwwlllllccco
46 25 ohwwwsshhohwwwwlcbbblwwwlllllccco
47 24 ohwwwshhohwwwwlccbbblwwwwlllllccco
48 23 olwwwshohwwwllccbbaalwwwwwllllccbbco
49 22 olwwwlccohwwlccbaaialwwwwwwlllccbbco
50 21 olwwwwlccohwlccbaiggialwwwwwllccbbbco
51 20 olwwwwwlccohlcbbaaiaalwwwwllccbbbbbco
52 19 olwwwwwllccolcbbbaaaalwwwllccbbbbbbboofffo
53 19 olwwwwwllccolccbbddaalwwllccbbbbbbo..ofnfnoiggo
54 18 olwwwwwlllccolccbddaalwllccbbbbbbo...otnntoigwgo
55 18 olwwwwwlllccolccbddalwllccbbbbbbo.....oooooigwwgo
56 18 olwwwwwllllccolccbddalwllccbbbbo............igwwlgo
57 18 olwwwwllllccbolccbddalwllccbbbo..............igwllgo
58 19 olwwwlllccbboccbddalwllccbbbo................igwllgo
59 19 olwwwllccbbdoccbddalwllccbbbo.................igwllgo
60 20 olwwllccbbdoccbddalwllcccbbbo................igwllgo
61 20 olwllccbbdo.ccbddalwwllcccbbbo..............igwllgo
62 21 ollccbbddo..ccbddalwwwllcccbbbo............igwllgo
63 21 olccbbdddo..ccbddalwwwwllcccbbbo..........igwllgo
64 22 occbbaddo...ccbddalwwwwwllcccbbbo........igwllgo
65 22 ocbbaiado...ccbddalwwwwwwllcccbbbo......igwllgo
66 23 obbaigado...ccbddalwwwwwwwllcccbbbo....igwllgo
67 24 obaigado...lccbddalwwwwwwwwllccbbbo...igwlgo
68 25 oattntoh..lwwccbddalwwwwwwwwllccbbbo..igwgo
69 26 otnnnosh.lwwwccbddalwwwwwwwwllccbbbo..iggo
70 26 ohottoshllwwwccbddalwwwwwwwwlllccbbbo..igo
71 25 ohhhhoshlwwwwccbddalwwwwwwwllllccbbbo..igo
72 24 ohhhoshlwwwwlccbddalwwwwwwlllllccbbbo..igo
73 23 ohhoshlwwwwllccbddalwwwwwllllllccbbbo...igo
74 23 ooshlwwwwwlllccbddalwwwwllllllcccbbbo...igo
75 22 ohlwwwwwwllllccbddalwwwllllllcccbbbbo...igo
76 22 olwwwwwwllllcccbddalwwllllllcccbbbbbo...igo
77 21 olwwwwwwlllccccbddalwllllllcccbbbbbbo....igo
78 21 olwwwwwlllccccbbddalwlllllcccbbbbbbbo....igo
79 20 olwwwwlllccccbbbddalwllllcccbbbbbbbbo....igo
80 20 olwwwlllccccbbbbddalwlllcccbbbbbbbbo......igo
81 20 olwwlllccccbbbbdddalwllcccbbbbbbbbo.......igo
82 21 olllllcccbbbbbddddalwllccbbbbbbbo.........igo
83 22 olllcccbbbbbdddddalwllccbbbboonnnno.......igo
84 23 olcccbbbbbddddddalwllccbbbo.tnffnnto......igo
85 24 occbbbbbdddddddalllccbbbo..otnffnnto......igo
86 25 oobbbbddddddoooocccbbbo....otnffnnto......igo
87 26 obbbbdddddo....oooooo......ottnnnnto......igo
88 27 ooobbbbbbo................otfffffnno....ogo
89 28 ottnnno...................ooooooooodo...oo
90 28 otnnno
91 27 otnffnno
92 26 ooooooodo
''')

# Contact: upper arm extends from shoulder, forearm/cuff/fingers stay distinct.
derived('attack', '''
23 32 ohwwwwhhhhhhsshho....aggo
24 31 ohwwwhhhhhhhhhhsshoaaigggo
25 30 ohwwwhhhhwwhhhhsshaaiaao
30 29 ohwwhwhhshhffnnffffffo
31 28 ohwwhhhhhshffnntffffnfo
32 28 ohwwhhhhhshffnteefffnffo
33 28 ohwwhhhhhshffntefffnfffo
40 27 ohwwhhhhsshhhhhottnno
41 27 ohwwhhhhsshhhhhotnnnlo
42 26 ohwwwhhhhsshhhhohwltnllo
43 25 ohwwwshhhhsshhhhlwwltnllcloo
44 24 ohwwwsshhhsshhohwwwlccllllccclooo
45 23 ohwwwwsshhhohwwwwlccblwwwwwwllcccooo
46 22 ohwwwwsshohwwwwwlcbbblwwwwwwwwlllcccooo
47 21 olwwwwsshohwwwwlccbbblwwwwwwwwwwlllcccco
48 20 olwwwwlccohwwwllccbbaalwwwwwwwwwwwwllcccbbo
49 19 olwwwwwlccohwlccbaaialwwwwwwwwwwwwlllccbbbbo
50 18 olwwwwwllccohlccbaiggialwwwwwwwwwlllcccbbbbooffffo
51 18 olwwwwwllccohlcbbaaiaalwwwwwwlllcccbbbbbboofnfnnoigggwwwwggo
52 17 olwwwwwlllccolcbbbaaaalwwwwllcccbbbbbbboo.otntnnoiigwwwwwlllgggo
53 17 olwwwwwlllccolccbbddaalwlllccbbbbbbbbboo...ooooo..iigwwwwlllllgggo
54 17 olwwwwwllllccolccbddaalwllccbbbbbbbooo.............iigwwwwllllcgggo
55 18 olwwwwllllccbolccbddalwllccbbbbbboo..................iigwwwwllccggo
56 18 olwwwwlllccbboccbddalwllccbbbbo........................iiigwwwlcggo
57 19 olwwwllccbbdoccbddalwllccbbbo..............................iigwwcggo
58 19 olwwllccbbddoccbddalwllccbbbo................................iiggggo
59 20 olllccbbddo..ccbddalwwllcccbbbo................................iiggo
60 21 ollccbbddo...ccbddalwwwllcccbbbo................................igo
61 22 olccbbddo....ccbddalwwwwllcccbbbo..............................igo
62 22 occbbado.....ccbddalwwwwwllcccbbbo............................igo
63 23 ocbaiado.....ccbddalwwwwwwllcccbbbo..........................igo
64 24 obaigado.....ccbddalwwwwwwwllcccbbbo........................igo
65 25 oaigado.....lccbddalwwwwwwwwllcccbbbo......................igo
66 26 ottnto.....lwwccbddalwwwwwwwwwllcccbbbo...................igo
67 26 otnnno....lwwwccbddalwwwwwwwwwllcccbbbo..................igo
68 25 ohotto...lwwwwccbddalwwwwwwwwwwllcccbbbo................igo
69 24 ohhhoo..lwwwwwccbddalwwwwwwwwwwlllcccbbo...............igo
70 23 ohhso..lwwwwwlccbddalwwwwwwwwwwllllcccbbo..............igo
71 22 ohhso.lwwwwwllccbddalwwwwwwwwwlllllcccbbo.............igo
72 21 ohso.lwwwwwlllccbddalwwwwwwwwllllllcccbbbo............igo
73 21 oso.lwwwwwllllccbddalwwwwwwwllllllcccbbbbo...........igo
74 20 oo.lwwwwwllllcccbddalwwwwwwllllllcccbbbbbo..........igo
75 20 olwwwwwwllllcccbddalwwwwwwllllllcccbbbbbbo.........igo
76 19 olwwwwwllllccccbddalwwwwwllllllcccbbbbbbbo........igo
77 19 olwwwwllllccccbbddalwwwwllllllcccbbbbbbbbo.......igo
78 18 olwwwllllccccbbbddalwwwllllllcccbbbbbbbbbo......igo
79 18 olwwllllccccbbbbddalwwllllllcccbbbbbbbbbbo.....igo
80 19 olllllccccbbbbbbddalwllllllcccbbbbbbbbbbbbo....igo
81 20 olllccccbbbbbbbdddallllllcccbbbbbbbbbbbbbbo....igo
82 21 olccccbbbbbbbbddddalllllcccbbbbbbbbbbbbbbbo....igo
83 22 occcbbbbbbbbbddddalllllcccbbbbbbbbbbbbbbo.....igo
84 23 ocbbbbbbbbbbddddalllllcccbbbbbbbbbbbbbbo......igo
85 24 obbbbbbbbbbddddalllllcccbbbbbbbbbbbbbbo.......igo
86 25 obbbbbbbbdddddooccccbbbboooobbbbbbbbo........igo
87 26 obbbbbdddddodo..ooooooo....ooobbbbbo.........igo
88 27 ooobbbddddo..................otnnnno.........igo
89 28 ottnnnnto....................otnffnno........igo
90 28 otnffnnto....................otnffffnno.....igo
91 27 otnffnnto....................otnfffffffno...ogo
92 26 oooooooodo....................oooooooooodo...oo
''')

derived('recover', '''
43 27 ohwwhhhhsshhhhlwwltnllclo
44 27 ohwwhhhsshhohwwwlcclllcccloo
45 26 ohwwwsshhohwwwwlccblwwllllccco
46 26 ohwwsshhohwwwwlcbbblwwwllllccco
47 26 ohwwshhohwwwwlccbbblwwwwllllccco
48 25 olccshohwwwllccbbaalwwwwwlllccbbco
49 24 olwwlccohwwlccbaaialwwwwwwllccbbco
50 23 olwwwlccohwlccbaiggialwwwwwllccbbco
51 22 olwwwwlccohlcbbaaiaalwwwwwllccbbbo
52 21 olwwwwllccolcbbbaaaalwwwllccbbbboo
53 21 olwwwwllccolccbbddaalwwllccbbbooofffo
54 20 olwwwwlllccolccbddaalwllccbbbo..ofnfnoiggo
55 20 olwwwwlllccolccbddalwllccbbbo...otnntoigwlgo
56 19 olwwwwllllccolccbddalwllccbbo....oooooigwwlgo
57 19 olwwwllllccbolccbddalwllcbbo...........igwwlgo
58 19 olwwwlllccbboccbddalwllcbbo............igwwlgo
59 19 olwwwllccbbdoccbddalwllcbbo............igwwlgo
60 20 olwwllccbbdoccbddalwllcbbo.............igwllgo
61 20 olwllccbbdo.ccbddalwllcbbo.............igwllgo
62 21 ollccbbddo..ccbddalwllcbbo.............igwllgo
63 21 olccbbdddo..ccbddalwllcbbo............igwllgo
64 22 occbbaddo...ccbddalwllcbbo...........igwllgo
65 22 ocbbaiado...ccbddalwllcbbo..........igwllgo
66 23 obbaigado...ccbddalwwllcbbo........igwllgo
67 24 obaigado...lccbddalwwwllcbbo......igwllgo
68 25 oattntoh..lwwccbddalwwwllcbbo....igwllgo
69 26 otnnnosh.lwwwccbddalwwwwllcbbo..igwllgo
70 27 otttosholwwwwccbddalwwwwwllcbbo.igwlgo
71 28 ooosholwwwwlccbddalwwwwwwwllcbboigwgo
72 26 ohhhsohlwwwlccbddalwwwwwwllccbo..iggo
73 26 ohhsohlwwwwlccbddalwwwwwwlllccbo..igo
74 26 ohsohlwwwwwlccbddalwwwwwllllccbo..igo
75 26 osohlwwwwwllccbddalwwwwllllcccbbo..igo
76 26 oohlwwwwwlllccbddalwwwllllcccbbbo..igo
77 26 ohlwwwwwllllccbddalwwllllcccbbbbo...igo
78 26 olwwwwwllllcccbddalwllllcccbbbbbo...igo
79 25 olwwwwwllllcccbbddalwlllcccbbbbbbo...igo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo...igo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo..igo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo...igo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo..igo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo..igo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo..igo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo.igo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo.igo
88 24 occbbddddddooooooolllccbbdddddcccooo..igo
89 25 ooobbbbbboo.....ooccbbbbooooocoo.....ogo
90 30 otttnnnno.......ottntnno............oo
91 29 otnfffffnno......otnffffnno
92 29 oooooooooodo.....ooooooooodo
''')

derived('hit', '''
20 0 .
21 0 .
22 33 oooooooo
23 30 ooohhhhhhhhoo
24 28 oohwwwwhhhhhhhho
25 27 ohwwwwhhhhhhsshho....aggo
26 26 ohwwwhhhhhhhhhhsshoaaigggo
27 25 ohwwwhhhhwwhhhhsshaaiaao
28 25 ohwwhhhhwwhhhssshhhoaao
29 24 ohwwhhhwwhhsshhhhhhhho
30 24 ohwwhhwwhhshhfffffffho
31 24 ohwwhwwhhshhfffffffffo
32 24 ohwwhwhhshhffnnffffffo
33 23 ohwwhhhhhshffnntffffnfo
34 23 ohwwhhhhhshffnteeeffnffo
35 23 ohwwhhhhhshffnntfffnfffo
36 23 ohwwhhhhsshffnntfffnfffo
37 23 ohwwhhhhsshffnnnffnffto
38 23 ohwwhhhsshhtfnnnnnffto
39 23 ohwwhhhsshhhtfnnnntto
40 23 ohwwhhhsshhhhttnttto
41 23 ohwwhhhsshhhhhotttto
42 22 ohwwhhhhsshhhhhotnnno
43 22 ohwwhhhhsshhhhohwltnllo
44 22 ohwwhhhhsshhhhlwwltnllclo
45 22 ohwwhhhsshhohwwwlcclllcccloo
46 21 ohwwwsshhohwwwwlccblwwllllccco
47 21 ohwwsshhohwwwwlcbbblwwwllllccco
48 21 ohwwshhohwwwwlccbbblwwwwllllccco
49 20 olwwshohwwwllccbbaalwwwwwlllccbbco
50 19 olwwlccohwwlccbaaialwwwwwwllccbbco
51 18 olwwwlccohwlccbaiggialwwwwwllccbbco
52 18 olwwwwlccohlcbbaaiaalwwwlllccbbbco
53 18 olwwwwllccolcbbbaaaalwwlllccbbbco
54 18 olwwwwllccolccbbddaalwlllccbbbco
55 19 olwwwwlllccolccbddaalwllccbbbo
56 20 olwwwwllccolccbddalwllccbbbo
57 21 olwwwllccbolccbddalwllccbbbo
58 22 olwwwlccbboccbddalwllccbbbo
59 23 olwwlccbbdoccbddalwllccbbbofffo
60 24 olwlccbbdoccbddalwllccbbboofnnnoiggo
61 24 ollccbbdo.ccbddalwllccbbbo.otnttoigwgo
62 24 olccbbdo..ccbddalwllccbbbo..oooooigwlgo
63 24 occbbado..ccbddalwllccbbbo.........igwlgo
64 25 ocbaiado..ccbddalwwllccbbbo.........igwgo
65 26 obaigado..ccbddalwwwllccbbbo.........iggo
66 27 ottnto...lccbddalwwwwllccbbbo.........igo
67 28 otnno...lwwccbddalwwwwllccbbbo........igo
68 28 otto...lwwwccbddalwwwwwllccbbbo.......igo
69 28 oo....lwwwwccbddalwwwwwwllccbbbo......igo
70 27 ohhsohlwwwwccbddalwwwwwwwllccbbbo.....igo
71 27 ohhsohlwwwwccbddalwwwwwwwllccbbbo.....igo
72 27 ohsohlwwwwlccbddalwwwwwwwllccbbbo.....igo
73 27 osohlwwwwllccbddalwwwwwwwllccbbbo.....igo
74 26 oohlwwwwlllccbddalwwwwwwlllccbbbo.....igo
75 25 ohlwwwwllllccbddalwwwwwllllccbbbo.....igo
76 24 olwwwwllllcccbddalwwwwllllcccbbo......igo
77 24 olwwwllllccccbddalwwwllllcccbbbo......igo
78 24 olwwllllccccbbddalwwllllcccbbbbo......igo
79 24 ollllllccccbbbddalwllllcccbbbbbo......igo
80 25 ollllccccbbbbddalwlllcccbbbbbbo......igo
81 25 olllccccbbbbbddalwllcccbbdbbbbbo.....igo
82 25 ollccccbbbbbbddalwllcccbbddbbbbo.....igo
83 25 olccccbbbbbbdddalwllcccbbdddbbbbo....igo
84 25 occccbbbbbbddddalwllcccbbddddbbbbo...igo
85 25 occbbbbbbbdddddalwllcccbbdddddbbbo...igo
86 25 ocbbbbbbbddddddalwllcccbbddddddbbbo..igo
87 25 obbbbbbbdddddddalwllccbbddddddcbbo...igo
88 26 obbddddddooooooolllccbbddddcccooo....igo
89 27 ooobbbbboo....ooccbbbboooocoo........ogo
90 31 ottnnnno......ottntnno..............oo
91 30 otnffffnno.....otnffffnno
92 30 ooooooooodo....ooooooooodo
''')

DEAD=blank()
rows(DEAD, '''
67 65 oooooooo
68 62 ooohhhhhhhhoo
69 60 oohwwwwhhhhhhhho
70 59 ohwwwwhhhhhhsshho
71 58 ohwwwhhhhhhhhhhssho..aggo
72 57 ohwwwhhhhwwhhhhsshhoaaiggo
73 56 ohwwhhhhwwhhhssshhhhhaao
74 55 ohwwhhhwwhhsshhhhhhhho
75 54 ohwwhhwwhhshhffffffhho
76 40 ooooo........ohwwhwwhhshhfffffffho
77 34 ooollllloo...ohwwhwhhshhffnnfffffo
78 30 ooolwwwwllcoohwwhhhhhshffnteeefffo
79 27 oolwwwwwwwllchwwhhhhhshffnntfffffo
80 24 oolwwwwwwwlllchwwhhhhsshffnnnfffto
81 22 olwwwwwllllccchwwhhhhsshffnnnffto
82 20 olwwwwllllccccchwwhhhsshhtnnntto
83 18 olwwwllllccccbbchwwhhhsshhhhttto
84 17 olwwlllccccbbbbchwwhhhhsshhhotnno
85 16 olwlllcccbbbbbbchwwwllccllohltnllo
86 15 olllcccbbbbbbbddclwwwlllccbolwlllccooofffo
87 14 olcccbbbbbbbddddccwwwwlllccbbwllllccoofnntoiggo
88 14 occbbbbbbdddddddccwwwwlllccbbwlllccootttoigwwggo
89 15 obbbbbddddddddddccwwwlllcccbbllllccoooooigwwwllggo
90 16 ooddddddddooooodccwwllllcccbblllcccchhhssigwwwllcgo
91 17 otnffnnooo....odcwwllllcccbblllccchhhhhhssigwwlcgo
92 16 oooooooooo.....oooooooooooooooooooooossssoooiggggo
''')
FRAMES['dead']=DEAD

# Skill preparation has a cupped grip, bent forearm and an angular ice nucleus.
derived('skill_a', '''
43 27 ohwwhhhhsshhhhlwwltnlclo
44 27 ohwwhhhsshhohwwwlccllcccloo....iggo
45 26 ohwwwsshhohwwwwlccblwllllccco..igwwgo
46 26 ohwwsshhohwwwwlcbbblwwlllllcccoigwwllgo
47 26 ohwwshhohwwwwlccbbblwwwlllllccigwwllcgo
48 25 olccshohwwwllccbbaalwwwwllccbofffigwwcgo
49 24 olwwlccohwwlccbaaialwwwwllccboofnfnniiggo
50 23 olwwwlccohwlccbaiggialwwwwllccbotntnnoiggo
51 22 olwwwwlccohlcbbaaiaalwwwwllccbbbooooiigwgo
52 21 olwwwwllccolcbbbaaaalwwwllccbbbo......igwlgo
53 21 olwwwwllccolccbbddaalwwllccbbbo.......igwlgo
54 20 olwwwwlllccolccbddaalwllccbbbo........igwlgo
55 20 olwwwwlllccolccbddalwllccbbbo.........igwlgo
56 19 olwwwwllllccolccbddalwllccbbbo.........igwlgo
57 19 olwwwllllccbolccbddalwllccbbbo.........igwlgo
58 19 olwwwlllccbboccbddalwllccbbbo..........igwlgo
59 19 olwwwllccbbdoccbddalwllccbbbo..........igwlgo
60 20 olwwllccbbdoccbddalwllccbbbo..........igwlgo
61 20 olwllccbbdo.ccbddalwllccbbbo.........igwlgo
62 21 ollccbbddo..ccbddalwllccbbbo........igwlgo
63 21 olccbbdddo..ccbddalwllccbbbo.......igwlgo
64 22 occbbaddo...ccbddalwllccbbbo......igwlgo
65 22 ocbbaiado...ccbddalwllccbbbo.....igwlgo
66 23 obbaigado...ccbddalwllccbbbo....igwlgo
67 24 obaigado...lccbddalwwllccbbbo..igwlgo
68 25 oattntoh..lwwccbddalwwwllccbo..igwgo
69 26 otnnnosh.lwwwccbddalwwwllccbo..iggo
70 27 otttosholwwwwccbddalwwwwllccbo..igo
71 28 ooosholwwwwlccbddalwwwwwllccbo..igo
72 26 ohhhsohlwwwlccbddalwwwwwllccbo..igo
73 26 ohhsohlwwwwlccbddalwwwwwwllccbo..igo
74 26 ohsohlwwwwwlccbddalwwwwwlllccbo..igo
75 26 osohlwwwwwllccbddalwwwwllllcccbbo..igo
76 26 oohlwwwwwlllccbddalwwwllllcccbbbo..ogo
77 26 ohlwwwwwllllccbddalwwllllcccbbbbo...oo
78 26 olwwwwwllllccbddalwllllcccbbbbbo
79 25 olwwwwwllllcccbddalwlllcccbbbbbbo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo
88 24 occbbddddddooooooolllccbbdddddcccooo
89 25 ooobbbbbboo.....ooccbbbbooooocoo
''')

# Cast body: both palms support the ribbon, the back sleeve stays separate.
derived('skill_b', '''
43 27 ohwwhhhhsshhhhlwwltnllclo
44 27 ohwwhhhsshhohwwwlccllllccclooo
45 26 ohwwwsshhohwwwwlccblwwwwlllcccooo
46 26 ohwwsshhohwwwwlcbbblwwwwwllllcccooo
47 26 ohwwshhohwwwwlccbbblwwwwwwllllcccco
48 25 olccshohwwwllccbbaalwwwwwwwlllccbbbo
49 24 olwwlccohwwlccbaaialwwwwwwwlllccbbbooofffo
50 23 olwwwlccohwlccbaiggialwwwwwllcccbbboofnfnoigwwggo
51 22 olwwwwlccohlcbbaaiaalwwwwlllcccbbbbo.otntnoigwwwllggo
52 21 olwwwwllccolcbbbaaaalwwlllcccbbbbbo...oooooiigwwwllcggo
53 21 olwwwwllccolccbbddaalwlllcccbbbbbo............iigwwlcggo
54 20 olwwwwlllccolccbddaalwlllcccbbbbo...............iigwcggo
55 20 olwwwwlllccolccbddalwlllcccbbbo..................iigcggo
56 19 olwwwwllllccolccbddalwlllcccbbbo..................iiggo
57 19 olwwwllllccbolccbddalwlllccbbbo....................iggo
58 19 olwwwlllccbboccbddalwlllccbbbo.....................iggo
59 19 olwwwllccbbdoccbddalwlllccbbbo.....................iggo
60 20 olwwllccbbdoccbddalwlllccbbbo......................iggo
61 20 olwllccbbdo.ccbddalwlllccbbbo......................igo
62 21 ollccbbddo..ccbddalwlllccbbbo......................igo
63 21 olccbbdddo..ccbddalwlllccbbbo......................igo
64 22 occbbaddo...ccbddalwlllccbbbo......................igo
65 22 ocbbaiado...ccbddalwlllccbbbo......................igo
66 23 obbaigado...ccbddalwwlllccbbbo.....................igo
67 24 obaigado...lccbddalwwwlllccbbbo....................igo
68 25 oattntoh..lwwccbddalwwwlllccbo.....................igo
69 26 otnnnosh.lwwwccbddalwwwlllccbo.....................igo
70 27 otttosholwwwwccbddalwwwwlllccbo...................igo
71 28 ooosholwwwwlccbddalwwwwwlllccbo...................igo
72 26 ohhhsohlwwwlccbddalwwwwwlllccbo
73 26 ohhsohlwwwwlccbddalwwwwwwlllccbo
74 26 ohsohlwwwwwlccbddalwwwwwllllccbo
75 26 osohlwwwwwllccbddalwwwwllllcccbbo
76 26 oohlwwwwwlllccbddalwwwllllcccbbbo
77 26 ohlwwwwwllllccbddalwwllllcccbbbbo
78 26 olwwwwwllllccbddalwllllcccbbbbbo
79 25 olwwwwwllllcccbddalwlllcccbbbbbbo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo
88 24 occbbddddddooooooolllccbbdddddcccooo
89 25 ooobbbbbboo.....ooccbbbbooooocoo
''')
# Three asymmetrical crystals: narrow upright lance, sideways branched fan,
# hanging split-tooth shard. Every branch and facet is literal.
clusters(FRAMES['skill_b'], '''
25 80 i
26 79 igi
27 79 iwgi
28 78 igwgi
29 78 iwwggi
30 77 igwwggi
31 77 igwwlgci
32 76 igwwwlgci
33 76 igwwwllci
34 75 igwwwwllci
35 75 igwwwwllci
36 76 igwwwllci
37 77 igwwllci
38 77 igwwllci
39 78 igwllci
40 78 igwllci
41 79 igwlci
42 79 igwlci.....ig
43 79 igwlci...igwgi
44 79 igwlci.igwwgci
45 78 iggwlciigwwwlci
46 76 iggwwlccigwwllci
47 75 igwwllccigwwlllci
48 73 iggwwllccigwwwwgi
49 72 iggwwllcciiggggci
50 72 igwwllcci.igwlci
51 72 igwwllci..igwlci
52 74 igwllci...igwlci
53 75 igwlci....igwlci
54 76 iglci......igwci
55 77 igci.......igwci
56 78 ici........igci
57 79 ici......igwwgci
58 80 ici...igwwllgci
59 81 ici.igwwlllcci
60 82 iciigwwllcci
61 82 igwwwwlllcci
62 82 igwwwwlllccci
63 82 igwwwlllccci
64 82 igwwlllccci
65 82 igwlllccci
66 82 igwlci.cci
67 82 iglci..ci
68 82 igci...ci
69 82 ici....i
70 82 ici
71 83 ci
72 83 i
''')

# Recovery arm folds down; ribbon bends back into her hand instead of a ray.
derived('skill_c', '''
43 27 ohwwhhhhsshhhhlwwltnllclo
44 27 ohwwhhhsshhohwwwlccllllcccloo
45 26 ohwwwsshhohwwwwlccblwwllllccco
46 26 ohwwsshhohwwwwlcbbblwwwllllccco
47 26 ohwwshhohwwwwlccbbblwwwwllllccco
48 25 olccshohwwwllccbbaalwwwwlllccbbco
49 24 olwwlccohwwlccbaaialwwwwlllccbbco
50 23 olwwwlccohwlccbaiggialwwwlllccbbco
51 22 olwwwwlccohlcbbaaiaalwwlllccbbbo
52 21 olwwwwllccolcbbbaaaalwlllccbbbo
53 21 olwwwwllccolccbbddaalwlllccbbbo
54 20 olwwwwlllccolccbddaalwllccbbbo
55 20 olwwwwlllccolccbddalwllccbbbo
56 19 olwwwwllllccolccbddalwllccbbo
57 19 olwwwllllccbolccbddalwllccbofffo
58 19 olwwwlllccbboccbddalwllccboofnfnoiggo
59 19 olwwwllccbbdoccbddalwllccbo.otntoigwwgo
60 20 olwwllccbbdoccbddalwllccbo..oooooigwwlgo
61 20 olwllccbbdo.ccbddalwllccbo........igwwlgo
62 21 ollccbbddo..ccbddalwllccbo.........igwwlgo
63 21 olccbbdddo..ccbddalwllccbo..........igwwlgo
64 22 occbbaddo...ccbddalwllccbo...........igwwlgo
65 22 ocbbaiado...ccbddalwllccbo............igwlgo
66 23 obbaigado...ccbddalwwllccbo...........igwlgo
67 24 obaigado...lccbddalwwwllccbo..........igwlgo
68 25 oattntoh..lwwccbddalwwwllccbo........igwlgo
69 26 otnnnosh.lwwwccbddalwwwllccbo.......igwlgo
70 27 otttosholwwwwccbddalwwwwllccbo.....igwlgo
71 28 ooosholwwwwlccbddalwwwwwllccbo....igwgo
72 26 ohhhsohlwwwlccbddalwwwwwllccbo.....iggo
73 26 ohhsohlwwwwlccbddalwwwwwwllccbo....igo
74 26 ohsohlwwwwwlccbddalwwwwwlllccbo....igo
75 26 osohlwwwwwllccbddalwwwwllllcccbbo..igo
76 26 oohlwwwwwlllccbddalwwwllllcccbbbo..ogo
77 26 ohlwwwwwllllccbddalwwllllcccbbbbo...oo
78 26 olwwwwwllllccbddalwllllcccbbbbbo
79 25 olwwwwwllllcccbddalwlllcccbbbbbbo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo
88 24 occbbddddddooooooolllccbbdddddcccooo
89 25 ooobbbbbboo.....ooccbbbbooooocoo
''')
clusters(FRAMES['skill_c'], '''
37 79 ig
38 78 iwgi
39 79 gci
40 79 ci
44 71 igi
45 70 igwgi
46 71 gci
48 87 ig
49 85 igwgi
50 86 gci
53 75 i
54 74 igci
55 75 ci
59 81 igci
60 82 ci
''')

# Sick posture: hand under jaw, other sleeve clutched over the lower ribs.
derived('poison_a', '''
20 0 .
21 0 .
22 0 .
23 36 oooooooo
24 33 ooohhhhhhhhoo
25 31 oohwwwwhhhhhhhho
26 30 ohwwwwhhhhhhsshho....aggo
27 29 ohwwwhhhhhhhhhhsshoaaigggo
28 28 ohwwwhhhhwwhhhhsshaaiaao
29 28 ohwwhhhhwwhhhssshhhoaao
30 27 ohwwhhhwwhhsshhhhhhhho
31 27 ohwwhhwwhhshhfffffffho
32 27 ohwwhwwhhshhfffffffffo
33 27 ohwwhwhhshhffnnffffffo
34 26 ohwwhhhhhshffnntffffnfo
35 26 ohwwhhhhhshffnteefffnffo
36 26 ohwwhhhhhshffnntefffnfffo
37 26 ohwwhhhhsshffnntfffnfffo
38 26 ohwwhhhhsshffnnnffnffto
39 26 ohwwhhhsshhtfnnnnnffto
40 26 ohwwhhhsshhhtfnnneetto
41 26 ohwwhhhsshhhhttnntto
42 26 ohwwhhhsshhhhhotttto
43 25 ohwwhhhhsshhhhhotnnofffo
44 25 ohwwhhhhsshhhhohwltnfnnfo
45 25 ohwwhhhhsshhhhlwwltnntnto
46 25 ohwwhhhsshhohwwwlcclloooo
47 24 ohwwwsshhohwwwwlccblwwlllcco
48 24 ohwwsshhohwwwwlcbbblwwlllccco
49 24 ohwwshhohwwwwlccbbblwwlllccco
50 23 olwwshohwwwllccbbaalwwwllccco
51 22 olwwlccohwwlccbaaialwwwllccco
52 21 olwwwlccohwlccbaiggialwllccco
53 21 olwwwwlccohlcbbaaiaalwllccco
54 21 olwwwwllccolcbbbaaaalwllccco
55 21 olwwwwllccolccbbddaalwllccco
56 22 olwwwwlllccolccbddaalwllccco
57 23 olwwwwllccolccbddalwllccco
58 24 olwwwllccbolccbddalwllccco
59 25 olwwwlccbboccbddalwllccco
60 25 olwwlccbbdoccbddalwllccco
61 25 olwlccbbdoccbddalwllccco
62 25 ollccbbdoccbddalwllccco
63 25 olccbbdooccbddalwllccco
64 25 occbbadoccbddalwllccco
65 26 ocbaiaoofffnndalwllccco
66 27 obaigaofnfnntdalwllccco
67 28 oaigaoottnttdalwwllccco
68 28 oottohoooocbddalwwwllccco
69 28 ooosholwwccbddalwwwllccco
70 28 ohhsohlwwccbddalwwwwllccco
71 28 ohsohlwwwccbddalwwwwwllccco
72 27 ohsohlwwwlccbddalwwwwwllccco
73 27 osohlwwwllccbddalwwwwwwllccco
74 26 oohlwwwlllccbddalwwwwwlllccco
75 25 ohlwwwllllccbddalwwwwllllcccbbo
76 24 olwwwllllcccbddalwwwllllcccbbbo
77 24 olwwllllccccbddalwwllllcccbbbbo
78 24 ollllllccccbbddalwllllcccbbbbbo
79 24 olllllccccbbbddalwlllcccbbbbbbo
80 25 ollllccccbbbbddalwllcccbbbbbbo
81 25 olllccccbbbbbddalwllcccbbdbbbbbo
82 25 ollccccbbbbbbddalwllcccbbddbbbbo
83 25 olccccbbbbbbdddalwllcccbbdddbbbbo
84 25 occccbbbbbbddddalwllcccbbddddbbbbo
85 25 occbbbbbbbdddddalwllcccbbdddddbbbo
86 25 ocbbbbbbbddddddalwllcccbbddddddbbbo
87 25 obbbbbbbdddddddalwllccbbddddddcbbo
88 26 obbddddddooooooolllccbbddddcccooo
89 27 ooobbbbboo....ooccbbbboooocoo
90 31 ottnnnno......ottntnno
91 30 otnffffnno.....otnffffnno
92 30 ooooooooodo....ooooooooodo
''')
# The lowered ribbon is a folded silk tail, not a support leg.
clusters(FRAMES['poison_a'], '''
64 51 oiggo
65 52 igwwgo
66 53 igwwlgo
67 54 igwwlgo
68 55 igwwlgo
69 56 igwwlgo
70 57 igwlgo
71 58 igwgo
72 59 iggo
73 60 igo
74 60 igo
75 59 igo
76 58 igo
77 57 igo
78 56 igo
79 56 go
80 56 o
26 67 ppp
27 66 pvwp
28 66 pvvvp
29 67 ppp
36 73 pp
37 72 pvwp
38 73 pp
''')
derived('poison_b', '''
34 26 ohwwhhhhhshffnntffffnfo
35 26 ohwwhhhhhshffnteefffnffo
36 26 ohwwhhhhhshffnnntfffnfffo
40 26 ohwwhhhsshhhtfnnneetttto
41 26 ohwwhhhsshhhhttnnttto
43 25 ohwwhhhhsshhhhhotnnofffo
44 25 ohwwhhhhsshhhhohwltnfnnfo
45 25 ohwwhhhhsshhhhlwwltnnntto
46 25 ohwwhhhsshhohwwwlcclloooo
47 24 ohwwwsshhohwwwwllcblwwlllcco
48 24 ohwwsshhohwwwwllcbbblwwllccco
49 24 ohwwshhohwwwwllccbbblwwllccco
50 23 olwwshohwwwlllccbbaalwwwlccco
51 22 olwwlccohwwllccbaaialwwwlccco
62 25 ollccbbdoccbddalwllccco
63 25 olccbbdooccbddalwllccco
64 25 occbbadoccbddalwllccco.....oiggo
65 26 ocbaiaooffnnndalwllccco....igwwgo
66 27 obaigaofnfnntdalwllccco.....igwwlgo
67 28 oaigaoottnttdalwwllccco.....igwwlgo
68 28 oottohoooocbddalwwwllccco....igwwlgo
69 28 ooosholwwccbddalwwwllccco.....igwwlgo
70 28 ohhsohlwwccbddalwwwwllccco.....igwlgo
71 28 ohsohlwwwccbddalwwwwwllccco.....igwgo
''',origin='poison_a')
clusters(FRAMES['poison_b'], '''
26 67 ...
27 66 ....
28 66 .....
29 67 ...
36 73 ..
37 72 ....
38 73 ..
21 69 pp
22 68 pvwp
23 69 pvp
24 70 p
31 77 pppp
32 76 pvwwvp
33 76 pvvvvp
34 77 pppp
42 66 pp
43 65 pvwp
44 66 pp
''')

# Stun: head drops over the collar, sleeve and grasp hang below the waist.
derived('stun_a', '''
20 0 .
21 0 .
22 0 .
23 0 .
24 0 .
25 0 .
26 39 oooooooo
27 36 ooohhhhhhhhoo
28 34 oohwwwwhhhhhhhho
29 33 ohwwwwhhhhhhsshho....aggo
30 32 ohwwwhhhhhhhhhhsshoaaigggo
31 31 ohwwwhhhhwwhhhhsshaaiaao
32 31 ohwwhhhhwwhhhssshhhoaao
33 30 ohwwhhhwwhhsshhhhhhhho
34 30 ohwwhhwwhhshhfffffffho
35 30 ohwwhwwhhshhfffffffffo
36 29 ohwwhwhhshhffnnffffffo
37 29 ohwwhhhhhshffnntffffnfo
38 28 ohwwhhhhhshffnteefffnffo
39 28 ohwwhhhhhshffnntefffnfffo
40 28 ohwwhhhhsshffnntfffnfffo
41 28 ohwwhhhhsshffnnnffnffto
42 28 ohwwhhhsshhtfnnnnnffto
43 28 ohwwhhhsshhhtfnnnnntto
44 28 ohwwhhhsshhhhttnnttto
45 28 ohwwhhhsshhhhhotttto
46 27 ohwwhhhhsshhhhhotnnno
47 27 ohwwhhhhsshhhhohwltnllo
48 27 ohwwhhhhsshhhhlwwltnllclo
49 27 ohwwhhhsshhohwwwlcclllcccloo
50 26 ohwwwsshhohwwwwlccblwwllllccco
51 26 ohwwsshhohwwwwlcbbblwwwllllccco
52 25 olwwshhohwwwwlccbbblwwwwllllccco
53 24 olwwshohwwwllccbbaalwwwwlllccbbco
54 23 olwwlccohwwlccbaaialwwwwlllccbbco
55 22 olwwwlccohwlccbaiggialwwwlllccbbco
56 21 olwwwwlccohlcbbaaiaalwwwlllccbbco
57 21 olwwwwllccolcbbbaaaalwwlllccbbco
58 21 olwwwwllccolccbbddaalwwlllccbbco
59 21 olwwwwlllccolccbddaalwwlllccbbco
60 21 olwwwwlllccolccbddalwwwlllccbbco
61 22 olwwwllllccbolccbddalwwwlllccbbo
62 22 olwwwlllccbboccbddalwwwlllccbbo
63 22 olwwwllccbbdoccbddalwwwlllccbbo
64 23 olwwllccbbdoccbddalwwwlllccbbo
65 23 olwllccbbdo.ccbddalwwwllccbbbo
66 24 ollccbbddo..ccbddalwwwllccbbbo
67 24 olccbbdddo..ccbddalwwwllccbbbo
68 25 occbbaddo...ccbddalwwwllccbbbo
69 25 ocbbaiado...ccbddalwwwllccbbbo
70 26 obbaigado...ccbddalwwwllccbbbo
71 27 obaigado...lccbddalwwllccbbbo
72 28 oattntoh..lwwccbddalwllccbbbo
73 29 otnnnosh.lwwwccbddalwllccbbbofffo
74 28 ohottoshllwwwccbddalwllccbbboofnnnoiggo
75 28 ohhooohlwwwwlccbddalwllccbbbo.otnttoigwgo
76 27 ohhsohlwwwwllccbddalwllccbbbo..oooooigwlgo
77 27 ohsohlwwwwlllccbddalwlllccbbbo.......igwlgo
78 26 osohlwwwllllcccbddalwlllccbbbo........igwlgo
79 25 ohlwwwwwllllcccbbddalwllccbbbbbo........igwlgo
80 24 olwwwwwllllcccbbddalwllcccbbbbbbbo.......igwgo
81 24 olwwwwllllcccbbbddalwllcccbbdbbbbbo......iggo
82 23 olwwwllllcccbbbbddalwllcccbbddbbbbo......igo
83 23 olwwllllcccbbbbdddalwllcccbbdddbbbbo.....igo
84 22 olwwlllcccbbbbddddalwllcccbbddddbbbbo...igo
85 22 olwlllcccbbbbbddddalwllcccbbdddddbbbbo..igo
86 23 olllcccbbbbbdddddalwllcccbbddddddbbbbo.igo
87 23 olcccbbbbbdddddddalwllccbbdddddddcbbo.ogo
88 24 occbbddddddooooooolllccbbdddddcccooo..oo
89 25 ooobbbbbboo.....ooccbbbbooooocoo
''')
clusters(FRAMES['stun_a'], '''
21 70 w
22 69 gwi
23 67 igwwwgi
24 69 iwi
25 70 i
36 18 g
37 17 iwi
38 15 igwwwgi
39 17 iwi
40 18 i
''')
derived('stun_b', '''
36 29 ohwwhwhhshhffnnffffffo
37 29 ohwwhhhhhshffnntffffnfo
38 28 ohwwhhhhhshffnntffffnffo
39 28 ohwwhhhhhshffnteefffnfffo
40 28 ohwwhhhhsshffnntfffnfffo
43 28 ohwwhhhsshhhtfnnnnnttto
44 28 ohwwhhhsshhhhttnntttto
45 28 ohwwhhhsshhhhhottttto
46 27 ohwwhhhhsshhhhhotnnnno
47 27 ohwwhhhhsshhhhohwltnnllo
48 27 ohwwhhhhsshhhhlwwltnlllclo
49 27 ohwwhhhsshhohwwwlccllllcccloo
50 26 ohwwwsshhohwwwwlccblwwlllllccco
51 26 ohwwsshhohwwwwlcbbblwwwlllllccco
52 25 olwwshhohwwwwlccbbblwwwwlllllccco
53 24 olwwshohwwwllccbbaalwwwwllllccbbco
54 23 olwwlccohwwlccbaaialwwwwllllccbbco
72 28 oattntoh..lwwccbddalwllccbbbo
73 29 otnnnosh.lwwwccbddalwllccbbbo
74 28 ohottoshllwwwccbddalwllccbbbofffo
75 28 ohhooohlwwwwlccbddalwllccbbboofnnnoiggo
76 27 ohhsohlwwwwllccbddalwllccbbbo.otnttoigwgo
77 27 ohsohlwwwwlllccbddalwlllccbbbo.oooooigwlgo
78 26 osohlwwwllllcccbddalwlllccbbbo.......igwlgo
''',origin='stun_a')
clusters(FRAMES['stun_b'], '''
21 70 .
22 69 ...
23 67 .......
24 69 ...
25 70 .
36 18 .
37 17 ...
38 15 .......
39 17 ...
40 18 .
24 19 w
25 18 gwi
26 16 igwwwgi
27 18 iwi
28 19 i
31 72 w
32 71 gwi
33 69 igwwwgi
34 71 iwi
35 72 i
''')

# Seated sleep is separately drawn from a blank native canvas.
SLEEP=blank()
rows(SLEEP, '''
46 38 oooooooo
47 35 ooohhhhhhhhoo
48 33 oohwwwwhhhhhhhho
49 32 ohwwwwhhhhhhsshho....aggo
50 31 ohwwwhhhhhhhhhhsshoaaigggo
51 30 ohwwwhhhhwwhhhhsshaaiaao
52 30 ohwwhhhhwwhhhssshhhoaao
53 29 ohwwhhhwwhhsshhhhhhhho
54 29 ohwwhhwwhhshhfffffffho
55 29 ohwwhwwhhshhfffffffffo
56 29 ohwwhwhhshhffnnffffffo
57 28 ohwwhhhhhshffnntffffnfo
58 28 ohwwhhhhhshffnnnffffnffo
59 28 ohwwhhhhhshffnteeeffnfffo
60 28 ohwwhhhhsshffnntfffnffffo
61 28 ohwwhhhhsshffnnnffnfffto
62 28 ohwwhhhsshhtfnnnnnfffto
63 28 ohwwhhhsshhhtfnnnnntto
64 28 ohwwhhhsshhhhttnnttto
65 28 ohwwhhhsshhhhhotttto
66 27 ohwwhhhhsshhhhhotnnno
67 27 ohwwhhhhsshhhhohwltnllo
68 27 ohwwhhhhsshhhhlwwltnllclo
69 27 ohwwhhhsshhohwwwlcclllcccloo
70 26 ohwwwsshhohwwwwlccblwwllllccco
71 25 olwwwsshhohwwwwlcbbblwwwllllccco
72 24 olwwwshhohwwwwlccbbblwwwwllllccco
73 23 olwwwshohwwwllccbbaalwwwwlllccbbco
74 22 olwwwlccohwwlccbaaialwwwwlllccbbco
75 21 olwwwwlccohwlccbaiggialwwwlllccbbco
76 21 olwwwwlccohlcbbaaiaalwwlllccbbco
77 21 olwwwwllccolcbbbaaaalwlllccbbco
78 22 olwwwllccolccbbddaalwlllccbbco
79 22 olwwwlccbolccbddaalwllccbbbo
80 23 olwwlccbboccbddalwllccbbbofffo
81 23 olwlccbbdoccbddalwllccbbboofnfnoiggo
82 24 ollccbbdoccbddalwllccbbbo.otntnoigwgo
83 24 olccbbdooccbddalwllccbbbo..oooooigwlgo
84 25 occbaiaoofffnnalwllccbbbooooo....igwlgo
85 25 ocbaiigaofnfnntalwllccbbwlllllloo..igwlgo
86 24 ohaiigaoottnttalwllcccbbwlllllcccoo.igwgo
87 23 ohhhhoooolllccddalwllcccbbwllllcccbbboiggo
88 22 ohhhssollllcccddalwllcccbbwwlllcccbbbo.iggo
89 23 ohhssoolllcccdddalwllcccbbwwllcccbbbo..igwwggo
90 24 oosssooccbbbdoooocccbbbooobbbbbbbbo....igwwllggo
91 25 oo.....ottffffnnooooo....otnffffnno.....iggwwlcggo
92 31 oooooooooodo...........ooooooooodo.......oiigggo
''')
FRAMES['sleep_a']=SLEEP
derived('sleep_b', '''
58 28 ohwwhhhhhshffnnnffffnffo
59 28 ohwwhhhhhshffnteeeffnfffo
60 28 ohwwhhhhsshffnntfffnffffo
69 27 ohwwhhhsshhohwwwllclllcccloo
70 26 ohwwwsshhohwwwwllcblwwllllccco
71 25 olwwwsshhohwwwwllcbbblwwwlllccco
72 24 olwwwshhohwwwwllccbbblwwwwlllccco
73 23 olwwwshohwwwlllccbbaalwwwwllccbbco
74 22 olwwwlccohwwllccbaaialwwwwllccbbco
75 21 olwwwwlccohwllccbaiggialwwwllccbbco
76 21 olwwwwlccohllcbbaaiaalwwllccbbco
81 23 olwlccbbdoccbddalwllccbbboofnfnoiggo
82 24 ollccbbdoccbddalwllccbbbo.otntnoigwgo
84 25 occbaiaooffnnnalwllccbbbooooo....igwlgo
85 25 ocbaiigaofnfnntalwllccbbwlllllloo..igwlgo
86 24 ohaiigaoottnttalwllcccbbwwlllllcccoo.igwgo
87 23 ohhhhoooolllccddalwllcccbbwwlllcccbbboiggo
88 22 ohhhssollllcccddalwllcccbbwwllllcccbbbo.iggo
''',origin='sleep_a')

# Visual correction: resting head, face, neck and forearm meet on the ground.
# The first corpse drawing had a rising hair strip that obscured the face.
DEAD_FINAL=blank()
rows(DEAD_FINAL, '''
72 62 oooooooo
73 59 ooohhhhhhhhoo
74 57 oohwwwwhhhhhhhho
75 56 ohwwwwhhhhhhsshho
76 55 ohwwwhhhhhhhhhhssho....aggo
77 54 ohwwwhhhhwwhhhhsshoaaigggo
78 30 ooooo..................ohwwhhhhwwhhhssshhhaao
79 26 ooollllloo..............ohwwhhhwwhhsshhhhhho
80 23 oolwwwwwllcooo..........ohwwhhwwhhshhfffffffho
81 21 olwwwwwwwwlllccoooo.....ohwwhwwhhshhfffffffffo
82 19 olwwwwwwwllllcccbbbooo..ohwwhwhhshhffnnffffffo
83 18 olwwwwwwllllcccbbbbbddoohwwhhhhhshffnteeeffnffo
84 17 olwwwwlllllcccbbbbbdddoohwwhhhhhshffnntfffnfffo
85 16 olwwlllllccccbbbbbddddoohwwhhhhsshffnnnffnffto
86 15 ollllllccccbbbbbddddddcohwwhhhsshhtfnnnnnffto
87 14 ollllccccbbbbbdddddddclwwwwwllccllohttnntttto
88 14 olccccbbbbbddddddddddclwwwwlllccbbwlllohtttto
89 15 occcbbbbbdddddddddddclwwwwllllccbbwllllccooofffo
90 16 oobbbbbdddddooooodddclwwwllllcccbbllllcccoofnntoiggo
91 17 ottffffnnooo....oddclwwwllllcccbbllllcccootttoigwwlgo
92 16 ooooooooooo.....ooooooooooooooooooooooohhsoooiggggo
''')
FRAMES['dead']=DEAD_FINAL

# Forward-facing weight change is drawn in head/neck clusters, separately
# from the independently drawn stepping legs and sleeves.
rows(FRAMES['move'], '''
20 39 oooooooo
21 36 ooohhhhhhhhhoo
22 34 oohwwwwhhhhhhhhho
23 33 ohwwwwhhhhhhhsshho....aggo
24 32 ohwwwhhhhhhhhhhhsshoaaigggo
25 31 ohwwwhhhhwwhhhhsshhaaiaao
26 30 ohwwhhhhwwhhhssshhhhoaao
27 30 ohwwhhhwwhhsshhhhhhhho
28 29 ohwwhhwwhhshhhfffffffho
29 29 ohwwhwwhhshhhfffffffffo
30 29 ohwwhwhhshhhffnnffffffo
31 28 ohwwhhhhshhhffnntffffnfo
32 28 ohwwhhhhshhhffnteefffnffo
33 28 ohwwhhhhshhhffntefffnfffo
34 28 ohwwhhhsshhhffnntfffnffffo
35 28 ohwwhhhsshhhffnnnffnfffto
36 28 ohwwhhsshhhtfnnnnnfffto
37 28 ohwwhhsshhhhtfnnnnntto
38 28 ohwwhhsshhhhhttntttto
39 28 ohwwhhsshhhhhhotttto
40 27 ohwwhhhsshhhhhhhottnno
41 27 ohwwhhhsshhhhhhhotnnno
42 27 ohwwhhhsshhhhhhohwltnllo
43 27 ohwwhhhsshhhhhhlwwltnllcloo
''')
rows(FRAMES['attack'], '''
19 41 ooooooo
20 38 ooohhhhhhhhoo
21 36 oohwwwwhhhhhhhhoo
22 35 ohwwwwhhhhhhhhssho
23 34 ohwwwhhhhhhhhhhssho...aggo
24 33 ohwwwhhhhwwhhhhsshoaaigggo
25 32 ohwwhhhhwwhhhssshhhaaiaao
26 31 ohwwhhhwwhhsshhhhhhhhoaao
27 30 ohwwhhwwhhshhhfffffffho
28 30 ohwwhwwhhshhhfffffffffo
29 29 ohwwhwhhshhhffnnffffffo
30 29 ohwwhhhhshhhffnntffffnfo
31 28 ohwwhhhhshhhffnteefffnffo
32 28 ohwwhhhhshhhffntefffnfffo
33 28 ohwwhhhsshhhffnntfffnffffo
34 28 ohwwhhhsshhhffnnnffnfffto
35 28 ohwwhhsshhhtfnnnnnfffto
36 28 ohwwhhsshhhhtfnnnnntto
37 27 ohwwhhsshhhhhttntttto
38 27 ohwwhhsshhhhhhotttto
39 27 ohwwhhhsshhhhhhhottnno
40 26 ohwwwwhhsshhhhhhhotnnno
41 26 ohwwwwhhsshhhhhhohwltnllo
42 26 ohwwwhhhsshhhhhhlwwltnllclo
43 25 ohwwwshhsshhhhohwwwlccllllcccloo
''')
clusters(FRAMES['recover'], '''
90 66 ..
88 63 iggo.
89 63 ogo..
90 64 o
''')

# Second corpse correction: use separate named head/body coordinate strings.
# The face no longer slides left by three columns on each successive row.
RESTING=blank()
rows(RESTING, '''
72 62 oooooooo
73 59 ooohhhhhhhhoo
74 57 oohwwwwhhhhhhhho
75 56 ohwwwwhhhhhhsshho
76 55 ohwwwhhhhhhhhhhssho....aggo
77 55 ohwwwhhhhwwhhhhsshoaaigggo
78 55 ohwwhhhhwwhhhssshhhaao
79 55 ohwwhhhwwhhsshhhhhhho
80 55 ohwwhhwwhhshhfffffffho
81 55 ohwwhwwhhshhfffffffffo
82 55 ohwwhwhhshhffnnffffffo
83 54 ohwwhhhhhshffnteeeffnffo
84 54 ohwwhhhhhshffnntfffnfffo
85 54 ohwwhhhhsshffnnnffnffto
86 54 ohwwhhhsshhtfnnnnnffto
87 54 ohwwhhhsshhhhttnntttto
88 54 ohwwhhhsshhhhhottttto
89 54 ohwwhhhsshhhhhhhssssso
90 54 ohwwhhhhsshhhhhhhhsssso
91 54 ohwwwhhhhsshhhhhhhhsssso
92 54 oooooooooooooooooooooo
''')
clusters(RESTING, '''
78 30 ooooo
79 26 ooollllloo
80 23 oolwwwwwllcooo
81 21 olwwwwwwwwlllccoooo
82 19 olwwwwwwwllllcccbbbooo
83 18 olwwwwwwllllcccbbbbbddoooo
84 17 olwwwwlllllcccbbbbbdddllllccoooo
85 16 olwwlllllccccbbbbbddddwwllllcccbbbo
86 15 ollllllccccbbbbbddddddwwwwllllcccbbbo
87 14 ollllccccbbbbbdddddddclwwwwlllcccbbbbohwltnnno
88 14 olccccbbbbbddddddddddclwwwwlllcccbbbbbolwwltnnno
89 15 occcbbbbbdddddddddddclwwwwllllcccbbbbwllllcccboofffo
90 16 oobbbbbdddddooooodddclwwwllllcccbbbwwllllcccoofnntoiggo
91 17 ottffffnnooo....oddclwwwllllcccbbbwwllllcccootttoigwwlgo
92 16 ooooooooooo.....oooooooooooooooooooooooooooooooiggggo
''')
FRAMES['dead']=RESTING

# Attack's fine silk tip curls above the ground so it cannot read as a third foot.
clusters(FRAMES['attack'], '''
78 66 iggo
79 65 igwgo
80 66 igwgo
81 67 igwgo
82 68 iggo
83 68 ogo
84 69 oo.
85 70 ...
86 70 ...
87 71 ...
88 72 ...
89 73 ...
90 72 ...
91 71 ...
92 71 ..
''')

def save():
    # The later advisory repair is also literal and per-pose. Retain the
    # original authoring above so this helper reproduces the current grids.
    from repair_pixels import apply_patches
    apply_patches(FRAMES)
    ROOT.mkdir(exist_ok=True)
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    checkpoints=ROOT/'checkpoints'
    checkpoints.mkdir(exist_ok=True)
    (checkpoints/'dead-first-pass.pxgrid').write_text('\n'.join(DEAD)+'\n')
    (checkpoints/'dead-second-pass.pxgrid').write_text('\n'.join(DEAD_FINAL)+'\n')
    poses = {'idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'}
    for name, grid in FRAMES.items():
        folder = ROOT/('poses' if name in poses else 'actions')
        folder.mkdir(exist_ok=True)
        (folder/(name+'.pxgrid')).write_text('\n'.join(grid)+'\n')

if __name__ == '__main__':
    save()

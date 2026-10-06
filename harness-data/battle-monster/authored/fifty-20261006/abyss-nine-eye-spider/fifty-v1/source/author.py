"""Chosen native ASCII rows. Only literal runs are written; no geometry or frame transforms."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={'K':'#15121f','a':'#292034','b':'#42304b','c':'#65405b','d':'#8c5d73','e':'#b78491','s':'#4a5062','t':'#77808b','u':'#adb5b4','v':'#d8dece','w':'#f4ead7','r':'#a92243','R':'#ed565b','q':'#ffc7a4','p':'#773c97','P':'#c982d4'}
(ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
def canvas(): return [list('.'*128) for _ in range(128)]
def block(g,x,y,rows):
    for dy,row in enumerate(rows.strip('\n').splitlines()):
        for dx,c in enumerate(row):
            if c!=' ': g[y+dy][x+dx]=c

def ink(g,x,y,rows):
    for dy,row in enumerate(rows.strip('\n').splitlines()):
        for dx,c in enumerate(row):
            if c not in '. ': g[y+dy][x+dx]=c

def runs(g,rows):
    for line in rows.strip().splitlines():
        x,y,p=line.split(); block(g,int(x),int(y),p)

def save(name,g):
    folder='actions' if name.startswith(('skill','poison','stun','sleep')) else 'poses'
    (ROOT/folder/(name+'.pxgrid')).write_text('\n'.join(''.join(r) for r in g)+'\n')

# Far and near legs are individually chosen segmented rows: coxa, broad femur,
# plated knee, slimmer tibia, hooked tip. Eight different articulated paths.
g=canvas()
runs(g,'''
18 34 KKKKK
16 35 KssttK
15 36 KtuuuK
14 37 KtuutsK
13 38 KtuucbsK
12 39 KtuucbbssK
12 40 KtucbbbasssK
11 41 KtucbbbaaasssK
11 42 KtcbbbaK.KassssK
10 43 KtcbbaK...KaasssK
10 44 KtcbbaK.....KaasssK
10 45 KscbaK.......KaasssK
10 46 KscbaK.........KaasssK
9 47 KscbaK...........KaasssK
9 48 KscbaK.............KaasssK
9 49 KscbaK...............KaasssK
9 50 KscbaK.................KaasssK
8 51 KscbaK...................KaasssK
8 52 KscbaK.....................KaasssK
8 53 KscbaK.......................KaasssK
8 54 KscbaK.........................KaasssK
8 55 KscbaK...........................KaasssK
8 56 KscbaK.............................KaasssK
8 57 KscbaK...............................KaasssK
8 58 KscbaK.................................KabsssK
8 59 KscbaK...................................KabsssK
8 60 KscbaK.....................................KabsssK
8 61 KscbaK.......................................KabsssK
8 62 KscbaK.........................................KabsssK
8 63 KscbaK...........................................KabsssK
8 64 KscbaK
8 65 KscbaK
8 66 KscbaK
8 67 KscbaK
8 68 KscbaK
8 69 KscbaK
8 70 KscbaK
8 71 KscbaK
8 72 KscbaK
8 73 KscbaK
8 74 KcbaK
8 75 KbaK
7 76 KbaK
6 77 KaaK
5 78 KKK
''')
runs(g,'''
95 34 KKKK
93 35 KssttK
91 36 KssuuuK
89 37 KssuuutcK
87 38 KssuutbKtcK
85 39 KssuutbaKKtcbK
83 40 KssuutbaK.KtcbK
81 41 KssuutbaK...KtcbK
79 42 KssuutbaK.....KtcbK
77 43 KssuutbaK.......KtcbK
75 44 KssuutbaK.........KtcbK
73 45 KssuutbaK...........KtcbK
71 46 KssuutbaK.............KtcbK
69 47 KssuutbaK...............KtcbK
67 48 KssuutbaK.................KtcbK
65 49 KssuutbaK...................KtcbK
63 50 KssuutbaK.....................KtcbK
61 51 KssuutbaK.......................KtcbK
59 52 KssuutbaK.........................KtcbK
57 53 KssuutbaK...........................KtcbK
55 54 KssuutbaK.............................KtcbK
96 55 KtcbK
97 56 KtcbK
98 57 KtcbK
99 58 KtcbK
100 59 KtcbK
101 60 KtcbK
102 61 KtcbK
103 62 KtcbK
104 63 KtcbK
105 64 KtcbK
106 65 KtcbK
107 66 KtcbK
108 67 KtcbK
109 68 KtcbK
110 69 KtcbK
111 70 KtcbK
112 71 KtcbK
113 72 KtcbK
114 73 KcbK
115 74 KabK
115 75 KaaK
115 76 KKK
''')
runs(g,'''
107 57 KKKKK
105 58 KstuuuK
103 59 KstuuutcK
101 60 KstuutbaK
99 61 KstuutbaK.KtcbK
97 62 KstuutbaK...KtcbK
95 63 KstuutbaK.....KtcbK
93 64 KstuutbaK.......KtcbK
91 65 KstuutbaK.........KtcbK
89 66 KstuutbaK...........KtcbK
87 67 KstuutbaK.............KtcbK
85 68 KstuutbaK...............KtcbK
83 69 KstuutbaK.................KtcbK
81 70 KstuutbaK...................KtcbK
79 71 KstuutbaK.....................KtcbK
77 72 KstuutbaK.......................KtcbK
109 73 KtcbK
109 74 KtcbK
110 75 KtcbK
110 76 KtcbK
111 77 KtcbK
111 78 KtcbK
112 79 KtcbK
112 80 KtcbK
113 81 KtcbK
113 82 KtcbK
114 83 KtcbK
114 84 KtcbK
115 85 KtcbK
115 86 KtcbK
116 87 KtcbK
116 88 KtcbK
117 89 KtcbK
117 90 KtcbK
118 91 KtcbK
118 92 KtcbK
118 93 KtcbK
118 94 KtcbK
118 95 KtcbK
118 96 KtcbK
118 97 KtcbK
118 98 KcbaK
118 99 KcbaK
118 100 KbaaK
117 101 KbaaK
116 102 KbaaK
115 103 KaaaK
115 104 KKKK
''')
# Left second leg: separate high knee and hooked planted foot.
runs(g,'''
22 59 KKKKKKK
20 60 KstuuutK
19 61 KtuvuutbK
18 62 KtuuutcbssK
18 63 KtuutcbassssK
17 64 KtucbbaKassssssK
17 65 KtucbbaK..KassssssK
16 66 KtucbbaK.....KassssssK
16 67 KtucbbaK........KassssssK
16 68 KtucbbaK...........KassssssK
15 69 KtucbbaK..............KassssssK
15 70 KtucbbaK.................KassssssK
15 71 KtucbbaK....................KassssssK
14 72 KtucbbaK.......................KassssssK
14 73 KtucbbaK..........................KassssssK
14 74 KtucbbaK
14 75 KtcbaaK
14 76 KtcbaaK
14 77 KtcbaaK
14 78 KtcbaaK
14 79 KtcbaaK
14 80 KtcbaaK
14 81 KtcbaaK
14 82 KtcbaaK
14 83 KtcbaaK
14 84 KtcbaaK
14 85 KtcbaaK
14 86 KtcbaaK
14 87 KtcbaaK
14 88 KtcbaaK
14 89 KtcbaaK
14 90 KtcbaaK
14 91 KtcbaaK
14 92 KtcbaaK
14 93 KtcbaaK
14 94 KtcbaaK
14 95 KtcbaaK
14 96 KtcbaaK
14 97 KtcbaaK
14 98 KtcbaaK
14 99 KtcbaaK
14 100 KtcbaaK
14 101 KtcbaaK
14 102 KcbaaK
13 103 KcbaaK
12 104 KcbaaK
11 105 KcbaaK
10 106 KbaaaK
10 107 KKKKK
''')
# Native hand-authored abdomen. Silver moon cuirass inset in dark plum chitin.
ink(g,24,25,'''
..................KKKKKKKKKKKK
...............KKKssstttuuuttssKK
.............KKsstuuvvvvvvvvvuuutsKK
...........KKstuvvvvvwwwwvvvvvvvuutsKK
..........KstuvvvwwwwwwwwwwvvvvvvvuutsK
.........KstuvvwwwwwwwwwwwwwvvvvvvvvutsK
........KstuvvwwwwwwwwwwwvvvvvvvvvvvuutsK
.......KstuvvwwwwwwwwwwvvvvvvvvvvvvvvuutsK
......KstuvvwwwwwwwwwwvvvvvvvvvvvvvvvvuutsK
.....KstuvvwwwwwwwwwvvvvvvvvvvvvvvvuuuutsK
....KstuvvwwwwwwwwvvvvvvvvvvvvvvvvuuuuttsK
....KtuvvwwwwwwwwvvvvvvvvvvvvvvvuuuuttttsK
...KstuvvwwwwwwwvvvvvvvvvvvvvvvuuuutttttssK
...KtuvvwwwwwwvvvvvvvvvvvvvvvvuuuutttttsssK
..KstuvvwwwwwvvvvvvvvvvvvvvvuuuuuutttttsssK
..KtuvvwwwwvvvvvvvvvvvvvvvvuuuuuttttttssssK
.KstuvvwwwvvvvvvvvvvvvvvvvuuuuuttttttsssssK
.KtuvvwwwvvvvvvvvvvvvvvvuuuuutttttttsssssK
.KtuvvwwvvvvvvvvvvvvvvvuuuuutttttttssssssK
KstuvvwwvvvvvvvvvvvvvvuuuuutttttttsssssssK
KtuvvwwvvvvvvvvvvvvvvuuuuutttttttssssssssK
KtuvvwvvvvvvvvvvvvvuuuuuutttttttsssssssssK
KtuvvvvuuuvvvvvvvvuuuuutttttttssssssssssK
KtuvvvuuutuvvvvvuuuuuttttttttssssssssssaK
KtuuvuuuttKuvvvuuuuuttttttttssssssssssaaK
KtuuvuutssKuuvuuuutttttttttssssssssssaaaK
KtuuvuutssKuuuuuutttttttttssssssssssaaabK
KtuuvuutssKuuuuutttttttttssssssssssaaabbK
KtuuvuutssKuuuutttttttttssssssssssaaabbbK
KtuuvuutssKuuutttttttttssssssssssaaabbbbK
KtuuvuutssKuutttttttttssssssssssaaabbbbbK
KtuuvuutssKttttttttttssssssssssaaabbbbbbK
KtuuvuutssKtttttttttssssssssssaaabbbbbbbK
KtuuvuutssKttttttttsssssssssaaaabbbbbbbK
KtuuvuutssKtttttttsssssssssaaaabbbbbbbbK
KtuuvuutssKttttttsssssssssaaaabbbbbbbbbK
.KtuuvuutssKttttssssssssaaaabbbbbbbbbbK
.KtuuvuutssKtttsssssssaaaabbbbbbbbbbbbK
.KstuuvuutssKsssssssaaaabbbbbbbbbbbbbK
..KstuuvuutssKsssssaaaabbbbbbbbbbbbbK
..KcstuuvuutssKKKKaaaabbbbbbbbbbbbbK
...KdcstuuvuutssssaaaabbbbbbbbbbbbK
...KddcstuuvuutsssaaabbbbbbbbbbbbK
....KddcstuuvuutssaaabbbbbbbbbbbK
.....KddccstuuvuttsaaabbbbbbbbbK
......KddcccstuuuttsaaabbbbbbbK
.......KddcccstuuttsaaabbbbbbK
........KddccccstttssaaabbbbK
.........KddcccccssssaaabbK
..........KddcccccbbaaaKK
...........KccccbbbaKKK
............KcbbbbaKK
.............KbbbaaK
..............KaaaaK
...............KKKK
''')
# Near lower legs: broad proximal segments with contrasting knee plates.
runs(g,'''
54 74 KKKKKKK
51 75 KstuuutcK
48 76 KstuuuucbaK
45 77 KstuuutcbaaK
42 78 KstuuutcbaaK
39 79 KstuuutcbaaK
36 80 KstuuutcbaaK
34 81 KtuvuutcbaaK
33 82 KtuvuutcbaaK
32 83 KtuvuutcbaaK
31 84 KtuvuutcbaaK
30 85 KtuuutcbbaaK
30 86 KtuuutcbaaK
30 87 KtuuutcbaaK
30 88 KtuutcbaaK
30 89 KtutcbaaK
30 90 KtcbaaK
30 91 KtcbaaK
30 92 KtcbaaK
30 93 KtcbaaK
30 94 KtcbaaK
30 95 KtcbaaK
30 96 KtcbaaK
30 97 KtcbaaK
30 98 KtcbaaK
30 99 KtcbaaK
30 100 KtcbaaK
30 101 KtcbaaK
30 102 KtcbaaK
30 103 KtcbaaK
30 104 KtcbaaK
30 105 KtcbaaK
30 106 KtcbaaK
30 107 KtcbaaK
30 108 KtcbaaK
30 109 KtcbaaK
30 110 KtcbaaK
30 111 KtcbaaK
30 112 KtcbaaK
30 113 KtcbaaK
30 114 KtcbaaK
30 115 KtcbaaK
30 116 KtcbaaK
30 117 KtcbaaK
30 118 KtcbaaK
29 119 KtcbaaK
28 120 KcbaaaK
27 121 KbaaaaK
26 122 KaaaaK
26 123 KKKK
60 79 KKKKKKK
58 80 KstuuutcK
56 81 KstuuutcbaK
54 82 KstuuutcbaaK
52 83 KstuuutcbaaK
50 84 KstuuutcbaaK
49 85 KtuvuutcbaaK
48 86 KtuvuutcbaaK
47 87 KtuvuutcbaaK
46 88 KtuvuutcbaaK
46 89 KtuuutcbaaK
46 90 KtuuutcbaaK
46 91 KtuutcbaaK
46 92 KtutcbaaK
46 93 KtcbaaK
46 94 KtcbaaK
46 95 KtcbaaK
46 96 KtcbaaK
46 97 KtcbaaK
46 98 KtcbaaK
46 99 KtcbaaK
46 100 KtcbaaK
46 101 KtcbaaK
46 102 KtcbaaK
46 103 KtcbaaK
46 104 KtcbaaK
46 105 KtcbaaK
46 106 KtcbaaK
46 107 KtcbaaK
46 108 KtcbaaK
46 109 KtcbaaK
46 110 KtcbaaK
46 111 KtcbaaK
46 112 KtcbaaK
46 113 KtcbaaK
46 114 KtcbaaK
46 115 KtcbaaK
46 116 KtcbaaK
46 117 KtcbaaK
46 118 KtcbaaK
46 119 KtcbaaK
46 120 KcbaaK
45 121 KcbaaK
44 122 KcbaaK
43 123 KaaaaK
43 124 KKKKK
''')
runs(g,'''
72 76 KKKKKKK
73 77 KstuuttccK
74 78 KstuuttccbaK
75 79 KstuuttccbaaK
76 80 KstuuttccbaaK
77 81 KstuuttccbaaK
78 82 KstuuttccbaaK
79 83 KstuuttccbaaK
80 84 KstuuttccbaaK
81 85 KstuuttccbaaK
82 86 KstuuttccbaaK
83 87 KstuuttccbaaK
84 88 KstuuuttcbaaK
85 89 KtuvvuutcbaaK
86 90 KtuvuutcbaaK
87 91 KtuuutcbaaK
88 92 KtuutcbaaK
89 93 KtutcbaaK
90 94 KtcbaaK
91 95 KtcbaaK
92 96 KtcbaaK
93 97 KtcbaaK
94 98 KtcbaaK
95 99 KtcbaaK
96 100 KtcbaaK
97 101 KtcbaaK
98 102 KtcbaaK
99 103 KtcbaaK
100 104 KtcbaaK
101 105 KtcbaaK
102 106 KtcbaaK
103 107 KtcbaaK
104 108 KtcbaaK
105 109 KtcbaaK
106 110 KtcbaaK
107 111 KtcbaaK
108 112 KtcbaaK
109 113 KtcbaaK
110 114 KcbaaK
110 115 KcbaaK
110 116 KcbaaK
109 117 KcbaaK
108 118 KcbaaK
107 119 KbaaaK
107 120 KKKK
65 81 KKKKKKK
65 82 KstuuttcK
65 83 KstuuttcbK
65 84 KstuuttcbaK
65 85 KstuuttcbaK
65 86 KstuuttcbaK
65 87 KstuuttcbaK
65 88 KstuuttcbaK
65 89 KstuuttcbaK
65 90 KstuuttcbaK
66 91 KstuuttcbaK
66 92 KstuuttcbaK
66 93 KstuuttcbaK
66 94 KtuvuutcbaK
67 95 KtuvuutcbaK
67 96 KtuuutcbaK
68 97 KtuutcbaK
69 98 KtutcbaK
70 99 KtcbaaK
70 100 KtcbaaK
70 101 KtcbaaK
70 102 KtcbaaK
71 103 KtcbaaK
71 104 KtcbaaK
71 105 KtcbaaK
72 106 KtcbaaK
72 107 KtcbaaK
72 108 KtcbaaK
73 109 KtcbaaK
73 110 KtcbaaK
73 111 KtcbaaK
74 112 KtcbaaK
74 113 KtcbaaK
74 114 KtcbaaK
75 115 KtcbaaK
75 116 KtcbaaK
75 117 KtcbaaK
76 118 KtcbaaK
76 119 KtcbaaK
76 120 KcbaaK
76 121 KcbaaK
75 122 KcbaaK
74 123 KbaaaK
74 124 KKKKK
''')
# Broad neck saddle retains plum volume between abdomen, coxae and face.
runs(g,'''
56 57 KsttcccbbbaaKK
56 58 KsttdddcccbbbaaK
57 59 KstdddccccbbbaaaK
57 60 KstdddccccbbbaaaaK
58 61 KstddccccbbbaaaaaK
58 62 KstddccccbbbaaaaaK
58 63 KstddccccbbbaaaaaK
58 64 KstddccccbbbaaaaaK
58 65 KstddccccbbbaaaaaK
58 66 KstddccccbbbaaaaaK
58 67 KstddccccbbbaaaaaK
58 68 KstddccccbbbaaaaaK
58 69 KstddccccbbbaaaaaK
58 70 KstddccccbbbaaaaaK
58 71 KstddccccbbbaaaaaK
58 72 KstddccccbbbaaaaaK
58 73 KstddccccbbbaaaaK
59 74 KstddccccbbbaaaK
60 75 KstddccccbbbaaK
60 76 KstddccccbbaaK
61 77 KstddcccbaaK
62 78 KstddccbaaK
63 79 KstddcbaaK
64 80 KstddbaaK
64 81 KstddbaaK
64 82 KstddbaaK
64 83 KstddbaaK
64 84 KstddbaaK
64 85 KstddbaaK
65 86 KstcbaaK
''')
BODY=[row[:] for row in g]
# Head/neck volume with nine separate tiny blood-red eyes.
ink(g,61,53,'''
............KKKKKKKKKK
.........KKKssttttttssKK
.......KKstuuvvvvvuuttsKK
......KstuuvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvuutssK
....KstuuvvvvvvvvvvvvvuutssK
...KstuuvvvccdddcddddccutsK
..KstuuvvccddddddddddddcutsK
.KstuuvvccdddKKdddKKdddKKcsK
KstuuvvccddddrRdddrRdddrRcbsK
KstuuvvccddddqRdddrRdddrRcbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccddddKKdddKKdddKKdbbsK
KstuucccddddrRdddrRdddrRdbbsK
KstuucccddddqRdddrRdddrRdbbsK
KstuucccddddccdddccdddccdbbsK
KstuucccdddddddddddddddddbbsK
KstuuccdddKKdddKKdddKKdddbbsK
KstuuccdddrRdddrRdddrRdddbbsK
KstuuccdddqRdddrRdddrRdddbbsK
KstuuccdddccdddccdddccdddbbsK
.KsttccddddddddddddddcccbbasK
..KstccdddcccccddddcccbbbaaK
''')
# Chosen correction: separate, right-curving fangs; a solid lower coxa saddle.
ink(g,65,77,'''
KstccdddcccddddcccbbbaaKKK.......
KstcccdddccKKKcccccbbbaaKKKK......
KstcccddcKstuvKcccKstuvvK.........
KstcccdcKtuuvvKcbKtuuvvwK........
KstcccbKtuuvvKaaKtuuvvwK.........
KstccbaKtuuvvKaaKtuuvvwK.........
KstccbaKtuuvvKaaKtuuvvwK.........
.KstcbaKtuuvvK..KtuuvvwK.........
..KscbaKtuuvvK..KtuuvvwKK........
...KcbaKtuuvvK...KtuuvvvuKK.....
....KbaKtuuvvK....KtuuvvvvvuKK...
.....KaKtuuvvuK....KstuuuvvwK....
......KKtuuvvvuKK...KKKstuuwK....
.......KstuuuvvvuKK.....KKKK.....
........KKstuuuvvwK..............
..........KKKstuuwK..............
.............KKKK...............
''')
save('idle_a',g)
# Correction to idle_a: the fourth near coxa is visible to the left of the tusks.
runs(g,'''
64 83 KstccbaK
64 84 KstccbaK
64 85 KstccbaK
64 86 KstccbaK
64 87 KstccbaK
64 88 KstccbaK
64 89 KstccbaK
64 90 KstccbaK
64 91 KstccbaK
65 92 KstccbaK
65 93 KstucbaK
66 94 KstucbaK
''')
save('idle_a',g)

def load(name):
    p=ROOT/('actions' if name.startswith(('skill','poison','stun','sleep')) else 'poses')/(name+'.pxgrid')
    return [list(row) for row in p.read_text().splitlines()]
def wipe(g,x,y,w,h):
    """Addressed transparent replacement area, before explicit new rows; no ink synthesis."""
    for row in g[y:y+h]: row[x:x+w]=list('.'*w)

# Retained armor is unchanged ink. Each changed joint, contour, face and tusk
# below is a new literal run/block at explicitly selected native addresses.
g=load('idle_a')
runs(g,'''
77 55 sttttuuuuttss
76 56 stuuuvvvvvvuts
76 57 stuuuvvvvvvvuts
42 26 stttuuuuuuutttss
40 27 stuuvvvvvvvvuuutss
39 28 stuvvvvwwvvvvvvvuts
39 29 stuvvwwwwwwvvvvvvuts
90 87 stuuvvvvvuK
89 88 KstuuvvwK..
89 89 .KKstuwK..
89 90 ...KKKK...
''')
# Relaxed third leg toe, no whole-body shift.
runs(g,'''
28 118 .KtcbaaK
27 119 .KtcbaaK
26 120 .KtcbaaK
25 121 .KcbaaaK
24 122 .KbaaaaK
24 123 .KKKKKK.
''')
save('idle_b',g)
g=load('idle_a')
runs(g,'''
78 55 stttuuuuttss
78 56 stuuuvvvvuutss
79 57 stuuvvvvvvuuts
42 26 stttuuuuttss
40 27 stuuuvvvvvuuutss
39 28 stuvvvwwwvvvvvuts
39 29 stuvvwwwwwwwvvvuts
43 122 .KcbaaK
42 123 .KcbaaK
42 124 .KKKKKK
75 121 .KcbaaK
74 122 .KcbaaK
73 123 .KbaaaK
73 124 .KKKKKK
''')
save('idle_c',g)

# Windup: head compresses down; attack-side front femur folds upward.
g=[row[:] for row in BODY]

wipe(g,78,83,37,38)
ink(g,74,84,'''
KKKKKK
KstuuttcK
.KstuuttccK
..KstuuttccbaK
...KstuuttccbaaK
....KstuuttccbaaK
.....KstuuttccbaaK
......KstuuttccbaaK
.......KstuuttccbaaK
........KtuvuuutcbaK
.........KtuvuuutcbK
..........KtuutcbaK
.........KtuutcbaK
........KtuutcbaK
.......KtuutcbaK
......KtuutcbaK
.....KtuutcbaK
....KtuutcbaK
...KtuutcbaK
..KtuutcbaK
.KtuutcbaK
KtuutcbaK
KtutcbaK
KtcbaaK
.KtcbaaK
..KtcbaaK
...KtcbaaK
....KtcbaaK
.....KtcbaaK
......KtcbaaK
.......KtcbaaK
........KcbaaK
........KcbaaK
.......KbaaaK
.......KKKKK
''')
# Rear planted ankle grips the floor more broadly.
runs(g,'''
27 118 KtcbaaK
26 119 KtcbaaK
25 120 KtcbaaK
24 121 KcbaaaaK
23 122 KcbaaaaK
22 123 KbaaaaaK
22 124 KKKKKKK
64 86 KstccbaK
64 87 KstccbaK
65 88 KstccbaK
65 89 KstccbaK
65 90 KstccbaK
65 91 KstccbaK
66 92 KstccbaK
66 93 KstccbaK
''')
ink(g,58,60,'''
.........KKKKKKKKKKKK
......KKKsstttuuuuttssKK
....KKstuuvvvvvvvvvuutssKK
...KstuuvvvvvvvvvvvvvuutssK
..KstuuvvvvvvvvvvvvvvvuutssK
.KstuuvvccdddddddddddccuutssK
KstuuvvccddddddddddddddccutsK
KstuvvccdddKKdddKKdddKKdcbsK
KstuvvccdddrRdddrRdddrRdcbsK
KstuvvccdddqRdddrRdddrRdcbsK
KstuvvccdddccdddccdddccdcbsK
KstuvvccddddddddddddddddbbsK
KstuuvccddKKdddKKdddKKddbbsK
KstuuvccddrRdddrRdddrRddbbsK
KstuuvccddqRdddrRdddrRddbbsK
KstuuvccddccdddccdddccddbbsK
KstuuvccdddddddddddddddbbsK
KstuuvccdddKKdddKKdddKKbbsK
KstuuvccdddrRdddrRdddrRbbsK
KstuuvccdddqRdddrRdddrRbbsK
KstuuvccdddccdddccdddccbbsK
KstuucccddddddddddddccbbasK
KstcccccddddddddcccccbbasK
.KstcccddcKKKcccKKKcbbaaK
..KstcddKstuvKcKstuvKbaK
...KccdbKtuuvKcKtuuvKaaK
....KccbKtuuvKcKtuuvKaaK
.....KbbKtuuvK.KtuuvKaaK
......KaKtuuvK.KtuuvKaaK
.......KKtuuvK.KtuuvKaaK
........KtuuvK.KtuuvK..K
........KtuuvK.KtuuvK
........KtuuvK.KtuuvK
.........KtuvK.KtuvK
..........KtuvKKtuvK
...........KstuuvtuK
............KstuutK
.............KKKK
''')
save('windup',g)

# Move: supporting rear leg pushes while the same near front knee reaches out.
g=[row[:] for row in BODY]

wipe(g,82,83,35,39)
ink(g,77,82,'''
KKKKKKK
KstuuttcK
.KstuuttccK
..KstuuttccbaK
...KstuuttccbaaK
....KstuuttccbaaK
.....KstuuttccbaaK
......KstuuttccbaaK
.......KstuuttccbaaK
........KstuuvuutcbaK
.........KtuvvuutcbaK
..........KtuuvutcbaK
...........KtuutcbaK
............KtutcbaK
.............KtcbaaK
..............KtcbaaK
...............KtcbaaK
................KtcbaaK
.................KtcbaaK
..................KtcbaaK
...................KtcbaaK
....................KtcbaaK
.....................KtcbaaK
......................KtcbaaK
.......................KtcbaaK
........................KtcbaaK
.........................KtcbaaK
..........................KtcbaaK
...........................KtcbaaK
............................KtcbaaK
.............................KtcbaaK
..............................KtcbaaK
...............................KtcbaaK
................................KcbaaK
................................KcbaaK
...............................KcbaaK
..............................KbaaaK
..............................KKKKK
''')
# Explicit rear thrust: knee extends and tibia braces diagonally backward.
wipe(g,24,84,15,40)
ink(g,31,84,'''
KtuuvutcbaK
KtuuutcbaaK
KtuutcbaaK
KtutcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KtcbaaK
KcbaaK
KcbaaK
KbaaaK
KKKKK
''')
runs(g,'''
65 81 KstcccbaaK
65 82 KstcccbaaK
65 83 KstcccbaaK
65 84 KstcccbaaK
65 85 KstcccbaaK
65 86 KstcccbaaK
65 87 KstcccbaaK
65 88 KstcccbaaK
65 89 KstcccbaaK
66 90 KstcccbaaK
66 91 KstcccbaaK
66 92 KstcccbaaK
67 93 KstcccbaaK
67 94 KstcccbaaK
73 123 KcbaaaK
73 124 KKKKKK
''')
ink(g,64,55,'''
............KKKKKKKKKK
.........KKKsstttuuuttssKK
.......KKstuuvvvvvvvuutssKK
......KstuuvvvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvvvuutssK
....KstuuvvvccddddddddccutsK
...KstuuvvvccdddddddddddutsK
..KstuuvvccddddddddddddccsK
.KstuuvvccdddKKdddKKdddKKbsK
KstuuvvccddddrRdddrRdddrRbbsK
KstuuvvccddddqRdddrRdddrRbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrRdddrRdddrRddbbsK
KstuuuccdddqRdddrRdddrRddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrRdddrRdddrRddddbbsK
KstuuccddqRdddrRdddrRddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
.KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvK..KtuuvvwK
.KstcbaKtuuvvK..KtuuvvwKK
..KscbaKtuuvvK...KtuuvvvuKK
...KcbaKtuuvvK....KtuuvvvvvuKK
....KbaKtuuvvuK....KstuuuvvwK
.....KaKtuuvvvuKK...KKKstuuwK
......KKstuuuvvvuKK.....KKKK
.......KKstuuuvvwK
.........KKKstuuwK
............KKKK
''')
save('move',g)
# Attack contact: near front femur extends, ankle compresses, tusks open laterally.
g=[row[:] for row in BODY]

wipe(g,83,83,35,41)
ink(g,77,82,'''
KKKKKKKK
KstuuvuutcK
.KstuuvuutccK
..KstuuvuutccbaK
...KstuuvuutccbaaK
....KstuuvuutccbaaK
.....KstuuvuutccbaaK
......KstuuvuutccbaaK
.......KstuuvuutccbaaK
........KstuuvuutccbaaK
.........KstuuvuutccbaaK
..........KstuuvuutccbaaK
...........KstuuvuutccbaaK
............KtuvvvuutcbaaK
.............KtuvvuutcbaaK
..............KtuuvutcbaaK
...............KtuutcbaaK
................KtutcbaaK
.................KtcbaaK
..................KtcbaaK
...................KtcbaaK
....................KtcbaaK
.....................KtcbaaK
......................KtcbaaK
.......................KtcbaaK
........................KtcbaaK
.........................KtcbaaK
..........................KtcbaaK
..........................KtuuucbaK
..........................KtuuucbaaK
..........................KtuuucbaaaK
..........................KtucbaaaaaK
..........................KtcbaaaaaaK
.........................KtcbaaaaaaaK
........................KtcbaaaaaaaaK
.......................KcbaaaaaaaaaaK
.......................KbaaaaaaaaaaaK
.......................KKKKKKKKKKKKK
''')
runs(g,'''
64 82 KstcccbaaK
64 83 KstcccbaaK
64 84 KstcccbaaK
64 85 KstcccbaaK
64 86 KstcccbaaK
65 87 KstcccbaaK
65 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
66 91 KstcccbaaK
66 92 KstcccbaaK
67 93 KstcccbaaK
67 94 KstcccbaaK
23 120 KtcbaaK
22 121 KtcbaaK
21 122 KcbaaaaK
20 123 KbaaaaaK
20 124 KKKKKKK
''')
ink(g,65,58,'''
...............KKKKKKKKKK
............KKKsstttuuuttssKK
..........KKstuuvvvvvvvuutssKK
.........KstuuvvvvvvvvvvvuutssK
........KstuuvvvvvvvvvvvvvuutssK
.......KstuuvvvccddddddddccutsK
......KstuuvvvccdddddddddddutsK
.....KstuuvvccddddddddddddccsK
....KstuuvvccdddKKdddKKdddKKbsK
...KstuuvvccddddrRdddrRdddrRbbsK
..KstuuvvccdddddqRdddrRdddrRbbsK
.KstuuvvccddddddccdddccdddccbbsK
KstuuvvccdddddddddddddddddddbbsK
KstuuuccdddddKKdddKKdddKKdddbbsK
KstuuuccdddddrRdddrRdddrRdddbbsK
KstuuuccdddddqRdddrRdddrRdddbbsK
KstuuuccdddddccdddccdddccdddbbsK
KstuuuccddddddddddddddddddddbbsK
KstuuccddddKKdddKKdddKKdddddbbsK
KstuuccddddrRdddrRdddrRdddddbbsK
KstuuccddddqRdddrRdddrRdddddbbsK
KstuuccddddccdddccdddccdddddbbsK
KstuuccdddddddddddddddddcccbbasK
KsttcccddddccccddddddcccbbbaaK
.KstcccddccKKKcccccKKKcbbaaaK
.KstcdddcKstuvKccKstuuvvK
.KstccdcKtuuvvKcKtuuvvvvuKK
.KstccbKtuuvvKaaKstuuvvvvvvuKK
.KstcbaKtuuvvKaaaKKstuuuvvvvwK
.KstcbaKtuuvvKaaaaaKKKKstuuwwK
.KstcbaKtuuvvKaaaaK....KKKKKK
.KstcbaKtuuvvKaaaK
..KscbaKtuuvvKaaK
...KcbaKtuuvvK.K
....KbaKtuuvvuK
.....KaKtuuvvvuKK
......KKstuuuvvvvuKK
.......KKstuuuvvvvvvwK
.........KKKstuuuvvwwK
............KKKKKKKK
''')
save('attack',g)

# Recover: same striking near leg folds back inward; jaw closes at a new angle.
g=load('idle_a')
wipe(g,70,78,32,19)
ink(g,70,78,'''
KstcccdddccKKKcccccbbbaaKK
KstcccddcKstuvKcccKstuvvK
KstcccdcKtuuvvKcbKtuuvvwK
KstcccbKtuuvvKaaKtuuvvwK
KstccbaKtuuvvKaaKtuuvvwK
KstccbaKtuuvvKaaKtuuvvwK
KstccbaKtuuvvK..KtuuvvwK
.KstcbaKtuuvvK..KtuuvvwKK
..KscbaKtuuvvK...KtuuvvvuKK
...KcbaKtuuvvK....KtuuvvvvvuK
....KbaKtuuvvuK....KstuuuvvwK
.....KaKtuuvvvuK....KKstuwK
......KKtuuvvvuKK.....KKKK
.......KstuuuvvwK
........KKstuuuwK
..........KKKKKK
''')
wipe(g,82,86,33,36)
ink(g,77,85,'''
KstuuttcK
.KstuuttccK
..KstuuttccbaK
...KstuuttccbaaK
....KstuuttccbaaK
.....KstuuttccbaaK
......KstuuttccbaaK
.......KtuvvuutcbaaK
........KtuvuutcbaaK
.........KtuutcbaaK
..........KtutcbaaK
...........KtcbaaK
............KtcbaaK
.............KtcbaaK
..............KtcbaaK
...............KtcbaaK
................KtcbaaK
.................KtcbaaK
..................KtcbaaK
...................KtcbaaK
....................KtcbaaK
.....................KtcbaaK
......................KtcbaaK
.......................KtcbaaK
........................KtcbaaK
.........................KtcbaaK
..........................KtcbaaK
...........................KtcbaaK
...........................KcbaaK
..........................KcbaaK
.........................KcbaaK
........................KbaaaK
........................KKKKK
''')
runs(g,'''
64 84 KstcccbaK
64 85 KstcccbaK
64 86 KstcccbaK
64 87 KstcccbaK
64 88 KstcccbaK
65 89 KstcccbaK
65 90 KstcccbaK
65 91 KstcccbaK
66 92 KstcccbaK
66 93 KstcccbaK
67 94 KstcccbaK
42 123 KcbaaaaK
42 124 KKKKKKK
''')
save('recover',g)

# Hit: face recoils obliquely, eyelids pinch, rear knee buckles.
g=[row[:] for row in BODY]

runs(g,'''
63 79 KstcccbaaK
63 80 KstcccbaaK
63 81 KstcccbaaK
63 82 KstcccbaaK
63 83 KstcccbaaK
63 84 KstcccbaaK
64 85 KstcccbaaK
64 86 KstcccbaaK
64 87 KstcccbaaK
64 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
66 91 KstcccbaaK
66 92 KstcccbaaK
67 93 KstcccbaaK
67 94 KstcccbaaK
46 91 KstuuucbaK
46 92 KstuuucbaK
46 93 KstuuucbaK
46 94 KtuuucbaK
46 95 KtuucbaK
47 96 KtucbaK
48 97 KtcbaK
48 98 KtcbaK
48 99 KtcbaK
''')
ink(g,58,51,'''
..............KKKKKKKK
...........KKKssttttssKK
.........KKstuuvvvvvuutsKK
........KstuuvvvvvvvvuutssK
.......KstuuvvvvvvvvvvuutssK
......KstuuvvvvvvvvvvvvuutssK
.....KstuuvvccddddddddccutsK
....KstuuvvccddddddddddddutsK
...KstuuvvccdddKKKdddKKKddbsK
..KstuuvvccdddddrRddddrRddbbsK
.KstuuvvccddddddcddKKKddddbbsK
KstuuvvccdddKKKdddddrRddddbbsK
KstuuvvccddddrRdddddcdddddbbsK
KstuuuccddddcddKKKdddKKKdbbsK
KstuuuccddddddddrRddddrRdbbsK
KstuuuccdddKKKddcdddddcddbbsK
KstuuuccddddrRdddddddddddbbsK
KstuuuccddddcddKKKdddddddbbsK
KstuuccdddddddddrrdddddddbbsK
KstuuccdddddddddcddddddcbbasK
KstuuccddddKKKdddddddcbbbaaK
KstuuccdddddrrddddcccbbbaaK
.KsttccdddddccddcccbbbaaaK
..KstccddddcccccbbbaaaaaK
...KstcccddccKKKccccbaaaK
....KstccddcKstuvKcbbaaaK
.....KstcddKtuuvvKcKstuvK
......KccdbKtuuvvKcKtuuvK
.......KcbKtuuvvKaaKtuuvK
........KbbKtuuvvK.KtuuvK
.........KbKtuuvvK.KtuuvK
..........KKtuuvvK.KtuuvK
...........KtuuvvK.KtuuvK
............KtuvvK.KtuvK
.............KtuvK.KtuvK
..............KtuvKKtuvK
...............KtuuvtuK
................KstutK
.................KKK
''')
save('hit',g)
# Dead is a wholly new low, asymmetric body, not a transformed standing frame.
g=canvas()
# Four far curled limbs, still identifiable behind the plates.
ink(g,11,83,'''
....KKKKKKKKKKKK
..KKstuuuutttccbaKK
.KstuuvvuuutttccbaaKK
KstuuvvutKKKKKKcbbaaaK
KstuuvutK......KKcbbbaaK
KstuuvutK........KKcbbbaaK
.KstuuvutK.........KKcbbbaaK
..KstuuvutK..........KKcbbaaK
...KstuuvutK...........KKcbaaK
....KstuuvutK............KKbaK
.....KstuuvutK.............KKK
......KstuuvutK
.......KstuutcK
........KstutcK
.........KstcbK
..........KscbK
...........KbbK
...........KKK
''')
ink(g,75,78,'''
........KKKKKKKK
......KKstuuuutccK
....KKstuuvvuutcbK
..KKstuuvvuutcbbaaK
KKstuuvvuutcbbaaKKK
KstuuvvuutcbbaaK.KtcbK
.KstuuvvuutcbbaK..KtcbK
..KstuuvvuutcbbaK..KtcbK
...KstuuvvuutcbbaK..KtcbK
....KstuuvvuutcbbaK..KtcbK
.....KstuuvvuutcbbaK..KtcbK
......KstuuvvuutcbbaK..KtcbK
.......KstuuvuutcbaK..KtcbK
........KstuuvutcbK..KtcbK
.........KstuuvutK..KtcbK
..........KstuutK..KtcbaK
...........KKKK..KtcbaK
...............KtcbaK
..............KtcbaK
.............KcbaaK
.............KKKK
''')
ink(g,21,99,'''
KKKKKKKKKK
KstuuvuutccK
.KstuuvuutccbaK
..KstuuvuutccbaaK
...KstuuvuutccbaaK
....KstuuvuutccbaaK
.....KstuuvuutccbaaK
......KstuuvuutccbaaK
.......KstuuvuutccbaaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbaK
.............KtuuvuutcbaK
..............KtuuvuutcbaK
...............KtuuvuutcbaK
................KtuuvuutcbaK
.................KtuuvuutcbK
..................KtuutcbaK
...................KtutcbaK
..................KtcbaaaK
.................KcbaaaaK
................KbaaaaaK
................KKKKKKK
''')
ink(g,87,92,'''
KKKKKKK
KstuuvuutcK
.KstuuvuutcbaK
..KstuuvuutcbaaK
...KstuuvuutcbaaK
....KstuuvuutcbaaK
.....KstuuvuutcbaaK
......KstuuvuutcbaaK
.......KtuuvuutcbaK
........KtuuvuutcbaK
.........KtuvuutcbaK
..........KtuuutcbaK
...........KtuutcbaK
............KtutcbaK
.............KtcbaK
.............KtcbaK
............KtcbaK
...........KtcbaK
..........KtcbaK
.........KtcbaK
........KtcbaK
.......KtcbaK
......KtcbaK
.....KtcbaK
....KtcbaK
...KtcbaK
..KtcbaK
.KtcbaK
KcbaaaK
KbaaaaK
KKKKKK
''')
# Broad flattened shell with intact plum underside bearing weight.
ink(g,24,79,'''
................KKKKKKKKKKKKKKK
............KKKKssstttttttttttssKKK
.........KKKsstuuvvvvvvvvvvvvuuutssKK
.......KKsstuuvvvvvwwwwwwvvvvvvvuutssKK
.....KKstuuvvvvvwwwwwwwwwvvvvvvvvvuutssK
....KstuuvvvvwwwwwwwwwwwwvvvvvvvvvvvuutsK
...KstuuvvvwwwwwwwwwwwwvvvvvvvvvvvvvvuutsK
..KstuuvvvwwwwwwwwwwwvvvvvvvvvvvvvvvvvuutsK
.KstuuvvvwwwwwwwwwwvvvvvvvvvvvvvvvvvuuuutsK
KstuuvvvwwwwwwwwvvvvvvvvvvvvvvvvvvuuuutttsK
KstuuvvwwwwwwwvvvvvvvvvvvvvvvvvvvuuuutttssK
KstuuvvwwwwwvvvvvvvvvvvvvvvvvvvvuuuutttsssK
KstuuvvwwwwvvvvvvvvvvvvvvvvvvvvuuuutttssssK
KstuuvvwwvvvvvvvvvvvvvvvvvvvvvuuuutttsssssK
KstuuvvvvuuuvvvvvvvvvvvvvvvvuuuutttssssssK
KstuuvvvuuutuvvvvvvvvvvvvvvuuuutttsssssssK
KstuuvvuuttKuvvvvvvvvvvvvuuuutttssssssssK
KstuuvuutssKuuvvvvvvvvuuuuutttsssssssssK
KstuuvuutssKuuuuuuuuuuuutttttsssssssssK
KstuuvuutssKuuuuuuuuuutttttttssssssssaaK
KstuuvuutssKuuuuuuutttttttttsssssssaaaaK
KstuuvuutssKuuuuuttttttttttssssssaaaabbK
KstuuvuutssKuuutttttttttttssssaaaabbbbK
KstuuvuutssKtttttttttttttssaaaabbbbbbK
KstuuvuutssKttttttttttttssaaaabbbbbbbK
.KstuuvuutssKtttttttttssaaaabbbbbbbbK
.KstuuvuutssKtttttttssaaaabbbbbbbbbK
..KstuuvuutssKttttssaaaabbbbbbbbbbK
...KstuuvuutssKKKaaaabbbbbbbbbbbbK
....KdcstuuvuutsssaaabbbbbbbbbbbK
.....KddcstuuvuttsaaabbbbbbbbbbK
......KddccstuuuttsaaabbbbbbbbK
.......KddcccstuuttsaaabbbbbbK
........KddccccsttssaaabbbbbK
.........KddcccccssaaabbbbbK
..........KddccccccaaabbbbK
...........KccccccbbaabbbK
............KccccbbbaabbK
.............KcbbbbbaaaK
..............KbbbbbaaK
...............KaaaaaK
................KKKKK
''')
# Four near limbs are independently folded at distinct heights.
ink(g,11,105,'''
.......KKKKKKKKKK
.....KKstuuuutccbK
...KKstuuvvuutcbbaK
.KKstuuvuutcbbaKKKKK
KstuuvuutcbbaK....KtcbK
KstuuvuutcbaK......KtcbK
.KstuuvuutcbK.......KtcbK
..KstuuutcbK.........KtcbK
...KstuutcbK..........KtcbaK
....KstutcbK...........KtcbaK
.....KstcbK............KtcbaK
......KcbK............KtcbaK
.......KK............KtcbaK
....................KcbaaK
....................KKKK
''')
ink(g,33,108,'''
.......KKKKKK
.....KKstuuttcK
...KKstuuvuutcbK
.KKstuuvuutcbbaK
KstuuvuutcbbaKKK
KstuuvuutcbbaK.KtcbK
.KstuuvuutcbbaK.KtcbK
..KstuuvuutcbaK..KtcbK
...KstuuutcbaK....KtcbK
....KstuutcbaK.....KtcbK
.....KstutcbaK......KtcbK
......KstcbaK........KtcbaK
.......KcbaK.........KtcbaK
........KaK..........KcbaK
.........K..........KbaaaK
....................KKKKK
''')
ink(g,65,104,'''
KKKKKKKK
KstuuvuutcK
KstuuvuutcbaK
KstuuvuutcbaaK
.KstuuvuutcbaaK
..KstuuvuutcbaaK
...KstuuvuutcbaaK
....KstuuvuutcbaaK
.....KtuuvuutcbaK
......KtuuvuutcbaK
.......KtuuvuutcbaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbK
.............KtuutcbaK
..............KtutcbaK
...............KtcbaaK
................KcbaaK
................KKKKK
''')
ink(g,65,95,'''
......KKKKKKKKKKKKK
....KKsstttuuutttssKK
..KKstuuvvvvvvvvvuutssK
.KstuuvvvvvvvvvvvvvuutssK
KstuuvvvvvvvvvvvvvvvuutssK
KstuuvvccdddddddddddccutsK
KstuuvccdddddccdddccdddbsK
KstuuvccdddssccssccssddbsK
KstuuvccdddddddddddddddbsK
KstuuuccddssccssccssdddbsK
KstuuuccddddddddddddddbbsK
KstuuuccdssccssccssdddbbsK
KstuucccddddddddddcccbbasK
KsttccccdddddddcccccbbasK
.KstcccccddcccKKcccbbaaK
..KstcccddccKstuvKccbaK
...KstccddcKtuuvvKcbbaK
....KstcccbKtuuvvKbaaK
.....KstcbbKtuuvvKaaK
......KscbaKtuuvvKaaK
.......KcbaKtuuvvK.KstuvK
........KbaKtuuvvuKKtuuvK
.........KaKstuuuvvvuuuvK
..........KKKstuuuuvvvvK
.............KKKstuuwwK
................KKKKKK
''')
save('dead',g)
# Fourth near leg remains in the death silhouette, with a separate inward hook.
runs(g,'''
88 109 KstuuvuutcK
89 110 KstuuvuutcbaK
90 111 KstuuvuutcbaaK
91 112 KstuuvuutcbaaK
92 113 KstuuvuutcbaaK
93 114 KtuuvuutcbaaK
94 115 KtuuvuutcbaK
95 116 KtuuvuutcbaK
96 117 KtuuvuutcbaK
97 118 KtuuvuutcbaK
98 119 KtuuvuutcbaK
99 120 KtuuvuutcbaK
100 121 KtuuvuutcbaK
101 122 KtuuvuutcbaK
102 123 KtuutcbaaaK
102 124 KKKKKKKKKK
''')
save('dead',g)

# Sleeping animal: independent upright crouch with eight folded load-bearing legs.
g=canvas()
# Far pair arches remain plated, but knees rest near the abdomen.
ink(g,12,63,'''
.....KKKKKK
...KKstuuttcK
..KstuuvuutcbK
.KstuuvuutcbbaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
.KstuuvuutcbbaaK
..KstuuvuutcbbaaK
...KstuuvuutcbbaaK
....KstuuvuutcbbaaK
.....KstuuvuutcbbaaK
......KstuuvuutcbbaaK
.......KstuuvuutcbbaaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuutcbaK
............KtuutcbaK
.............KtutcbaK
..............KtcbaK
...............KcbK
................KK
''')
ink(g,73,63,'''
.........KKKKKK
.......KKstuuttcK
.....KKstuuvuutcbK
...KKstuuvuutcbbaK
.KKstuuvuutcbbaaKKK
KstuuvuutcbbaaK.KtcbK
KstuuvuutcbbaaK..KtcbK
.KstuuvuutcbbaaK..KtcbK
..KstuuvuutcbbaaK..KtcbK
...KstuuvuutcbbaaK..KtcbK
....KstuuvuutcbbaaK..KtcbK
.....KstuuvuutcbbaaK..KtcbK
......KstuuvuutcbbaaK..KtcbK
.......KstuuvuutcbbaaK..KtcbK
........KstuuvuutcbaaK..KtcbK
.........KstuuvutcbaK..KtcbK
..........KstuuutcbaK.KtcbaK
...........KstuutcbaKKtcbaK
............KstutcbaKtcbaK
.............KstcbaKtcbaK
..............KcbaKtcbaK
...............KaaKcbaK
................KKKKKK
''')
ink(g,15,87,'''
.......KKKKKKKK
.....KKstuuttccbK
...KKstuuvuutcbbaK
.KKstuuvuutcbbaaKKK
KstuuvuutcbbaaK.KtcbK
KstuuvuutcbbaaK..KtcbK
.KstuuvuutcbbaaK..KtcbK
..KstuuvuutcbbaaK..KtcbK
...KstuuvuutcbbaaK..KtcbK
....KstuuvuutcbbaaK..KtcbK
.....KstuuvuutcbbaaK..KtcbK
......KstuuvuutcbaaK..KtcbK
.......KstuuvutcbaK..KtcbK
........KstuuutcbaK.KtcbaK
.........KstuutcbaKKtcbaK
..........KstutcbaKtcbaK
...........KstcbaKtcbaK
............KcbaKtcbaK
.............KaaKcbaK
..............KKKKKK
''')
ink(g,82,84,'''
........KKKKKKKK
......KKstuuttccbK
....KKstuuvuutcbbaK
..KKstuuvuutcbbaaKKK
KKstuuvuutcbbaaK.KtcbK
KstuuvuutcbbaaK...KtcbK
.KstuuvuutcbbaaK...KtcbK
..KstuuvuutcbbaaK...KtcbK
...KstuuvuutcbbaaK...KtcbK
....KstuuvuutcbbaaK...KtcbK
.....KstuuvuutcbbaaK...KtcbK
......KstuuvuutcbaaK...KtcbK
.......KstuuvutcbaK...KtcbK
........KstuuutcbaK..KtcbK
.........KstuutcbaK.KtcbK
..........KstutcbaKKtcbK
...........KstcbaKtcbaK
............KcbaKtcbaK
.............KaaKcbaK
..............KKKKKK
''')
ink(g,25,55,'''
.................KKKKKKKKKKKK
..............KKKssstttuuutssKK
............KKsstuuvvvvvvvvuuutsKK
..........KKstuvvvwwwwvvvvvvvvvuutsKK
.........KstuvvvwwwwwwwwvvvvvvvvvuutsK
........KstuvvwwwwwwwwwwwvvvvvvvvvuutsK
.......KstuvvwwwwwwwwwwvvvvvvvvvvvuutsK
......KstuvvwwwwwwwwwvvvvvvvvvvvvvuutsK
.....KstuvvwwwwwwwwvvvvvvvvvvvvvuuuutsK
....KstuvvwwwwwwwvvvvvvvvvvvvvvuuuuttsK
...KstuvvwwwwwwwvvvvvvvvvvvvvvuuuutttsK
..KstuvvwwwwwwwvvvvvvvvvvvvvvuuuutttssK
.KstuvvwwwwwwwvvvvvvvvvvvvvvuuuutttsssK
KstuvvwwwwwwvvvvvvvvvvvvvvvuuuutttssssK
KtuvvwwwwwvvvvvvvvvvvvvvvuuuuutttsssssK
KtuvvwwwwvvvvvvvvvvvvvvvuuuuutttssssssK
KtuvvwwwvvvvvvvvvvvvvvvuuuuutttsssssssK
KtuvvwwvvvvvvvvvvvvvvvuuuuutttssssssssK
KtuvvwwvvvvvvvvvvvvvvuuuuutttsssssssssK
KtuvvvvuuuvvvvvvvvvvuuuuutttsssssssssaK
KtuvvvuuutuvvvvvvvvuuuuutttssssssssaaaK
KtuvvuuuttKuvvvvvvuuuuutttssssssssaaaaK
KtuvvuutssKuuvvvuuuuuutttsssssssaaaabbK
KtuvvuutssKuuuuuuuuuutttssssssaaaabbbbK
KtuvvuutssKuuuuuuuutttttsssssaaaabbbbbK
KtuvvuutssKuuuuuuttttttssssaaaabbbbbbbK
KtuvvuutssKuuuutttttttsssaaaabbbbbbbbK
KtuvvuutssKuuttttttttssaaaabbbbbbbbbK
KtuvvuutssKtttttttttssaaaabbbbbbbbbK
KtuvvuutssKttttttttssaaaabbbbbbbbbK
.KtuvvuutssKttttttssaaaabbbbbbbbbK
.KtuvvuutssKttttssaaaabbbbbbbbbbK
..KtuvvuutssKKKaaaabbbbbbbbbbbbK
...KdcstuuvuutssaaabbbbbbbbbbbK
....KddcstuuvutsaaabbbbbbbbbbK
.....KddccstuuvutsaaabbbbbbbK
......KddcccstuuttsaaabbbbbK
.......KddccccsttssaaabbbbK
........KddcccccsssaaabbbK
.........KddccccccbaaabbK
..........KccccccbbbaaK
...........KccccbbbbaaK
............KcbbbbbaaK
.............KbbbbbaaK
..............KaaaaaK
...............KKKKK
''')
# Resting lower legs: four near femora folded without disappearing into the belly.
ink(g,16,97,'''
........KKKKKKKK
......KKstuuttccbK
....KKstuuvuutcbbaK
..KKstuuvuutcbbaaK
KKstuuvuutcbbaaK
KstuuvuutcbbaaK
.KstuuvuutcbbaaK
..KstuuvuutcbbaaK
...KstuuvuutcbbaaK
....KtuuvuutcbaaK
.....KtuuvuutcbaK
......KtuuvuutcbaK
.......KtuuvuutcbaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbaK
.............KtuuvuutcbaK
..............KtuuvuutcbaK
...............KtuuvuutcbaK
................KtuuvuutcbaK
.................KtuuvuutcbaK
..................KtuuvuutcbaK
...................KtuuvuutcbaK
....................KtuutcbaaaK
.....................KtcbaaaaaK
.....................KKKKKKKKK
''')
ink(g,38,103,'''
.....KKKKKKKK
...KKstuuttccbK
.KKstuuvuutcbbaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
KstuuvuutcbbaaK
.KstuuvuutcbbaaK
..KstuuvuutcbbaaK
...KtuuvuutcbaaK
....KtuuvuutcbaK
.....KtuuvuutcbaK
......KtuuvuutcbaK
.......KtuuvuutcbaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbaK
.............KtuuvuutcbaK
..............KtuutcbaaaK
...............KtcbaaaaaK
...............KKKKKKKKK
''')
ink(g,66,97,'''
KKKKKKK
KstuuvuutcK
KstuuvuutcbaK
KstuuvuutcbaaK
.KstuuvuutcbaaK
..KstuuvuutcbaaK
...KstuuvuutcbaaK
....KstuuvuutcbaaK
.....KtuuvuutcbaaK
......KtuuvuutcbaK
.......KtuuvuutcbaK
........KtuuvuutcbaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbaK
.............KtuuvuutcbaK
..............KtuuvuutcbaK
...............KtuuvuutcbaK
................KtuuvuutcbaK
.................KtuuvuutcbaK
..................KtuuvuutcbaK
...................KtuuvuutcbaK
....................KtuuvuutcbaK
.....................KtuuvuutcbK
......................KtuuucbaK
.......................KtcbaaaK
.......................KKKKKKK
''')
ink(g,84,95,'''
KKKKKKK
KstuuvuutcK
.KstuuvuutcbaK
..KstuuvuutcbaaK
...KstuuvuutcbaaK
....KstuuvuutcbaaK
.....KstuuvuutcbaaK
......KstuuvuutcbaaK
.......KstuuvuutcbaaK
........KtuuvuutcbaaK
.........KtuuvuutcbaK
..........KtuuvuutcbaK
...........KtuuvuutcbaK
............KtuuvuutcbaK
.............KtuuvuutcbaK
..............KtuuvuutcbaK
...............KtuuvuutcbaK
................KtuuvuutcbaK
.................KtuuvuutcbaK
..................KtuuvuutcbaK
...................KtuuvuutcbaK
....................KtuuvuutcbaK
.....................KtuuvuutcbaK
......................KtuuvuutcbK
......................KtuuucbaK
.....................KtuuucbaK
....................KtcbaaaaK
...................KcbaaaaaK
...................KKKKKKKK
''')
# Closed nine eyelids: shorter low-contrast horizontal marks, no red open eyes.
ink(g,63,82,'''
...........KKKKKKKKKK
........KKKsstttuuuttssKK
......KKstuuvvvvvvvuutssKK
.....KstuuvvvvvvvvvvvuutssK
....KstuuvvvvvvvvvvvvvuutssK
...KstuuvvvccddddddddccutsK
..KstuuvvvccdddddddddddutsK
.KstuuvvccddddddddddddccsK
KstuuvvccddddddddddddddbbsK
KstuuvvccdddssdddssdddssbbsK
KstuuvvccddddccdddccdddccbsK
KstuuuccdddddddddddddddbbsK
KstuuuccdddssdddssdddssdbbsK
KstuuuccddddccdddccdddccdbbsK
KstuuuccddddddddddddddddbbsK
KstuuccdddssdddssdddssddbbsK
KstuuccddddccdddccdddccddbbsK
KstuuccdddddddddddddcccbbasK
KsttcccddddcccddddcccbbbaaK
KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
..KscbaKtuuvvK..KtuuvvwKK
...KcbaKtuuvvK...KtuuvvvuK
....KbaKtuuvvuK...KstuuwwK
.....KaKtuuvvvuK...KKKKKK
......KKstuuuvvwK
.......KKstuuuwK
.........KKKKKK
''')
save('sleep_a',g)
# Second breath retains all eight legs, but the shell expands and chin relaxes.
g=load('sleep_a')
runs(g,'''
40 55 ..KKKKKKKKKKKKKKK
38 56 ..KKssstttuuuuttssKK
36 57 ..KsstuuvvvvvvvvuuutsKK
35 58 .KstuvvvwwwwvvvvvvvvvuutsK
34 59 KstuvvvwwwwwwwwvvvvvvvvvuutsK
66 103 KstccccbaaK
66 104 KstccccbaaK
67 105 KstccccbaaK
67 106 KstccccbaaK
''')
wipe(g,71,86,26,30)
ink(g,65,84,'''
...........KKKKKKKKK
........KKKsstttuuuttssKK
......KKstuuvvvvvvvuutssKK
.....KstuuvvvvvvvvvvvuutssK
....KstuuvvvvvvvvvvvvvuutssK
...KstuuvvvccddddddddccutsK
..KstuuvvvccdddddddddddutsK
.KstuuvvccddddddddddddccsK
KstuuvvccddddddddddddddbbsK
KstuuvvccdddssdddssdddssbbsK
KstuuvvccddddccdddccdddccbsK
KstuuuccdddddddddddddddbbsK
KstuuuccdddssdddssdddssdbbsK
KstuuuccddddccdddccdddccdbbsK
KstuuuccddddddddddddddddbbsK
KstuuccdddssdddssdddssddbbsK
KstuuccddddccdddccdddccddbbsK
KstuuccdddddddddddddcccbbasK
KsttcccddddcccddddcccbbbaaK
KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
..KscbaKtuuvvK..KtuuvvwKK
...KcbaKtuuvvK...KtuuvvvuK
....KbaKtuuvvuK...KstuuwwK
.....KaKtuuvvvuK...KKKKKK
......KKstuuuvvwK
.......KKstuuuwK
.........KKKKKK
''')
save('sleep_b',g)
# Skill preparation: lifted jaw exposes a native violet poison core between tusks.
g=[row[:] for row in BODY]
ink(g,61,49,'''
............KKKKKKKKKK
.........KKKsstttuuuttssKK
.......KKstuuvvvvvvvuutssKK
......KstuuvvvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvvvuutssK
....KstuuvvvccddddddddccutsK
...KstuuvvvccdddddddddddutsK
..KstuuvvccddddddddddddccsK
.KstuuvvccdddKKdddKKdddKKbsK
KstuuvvccddddrRdddrRdddrRbbsK
KstuuvvccddddqRdddrRdddrRbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrRdddrRdddrRddbbsK
KstuuuccdddqRdddrRdddrRddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrRdddrRdddrRddddbbsK
KstuuccddqRdddrRdddrRddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
.KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKppKtuuvvwK
.KstcbaKtuuvvKPPKtuuvvwK
.KstcbaKtuuvvKPwPKtuuvvwK
..KscbaKtuuvvKPPpKtuuvvwKK
...KcbaKtuuvvKpppKtuuvvvuKK
....KbaKtuuvvuKpppKtuuvvvvvuK
.....KaKstuuuvvuKKKKstuuuvvwK
......KKKstuuuwwK...KKstuwK
.........KKKKKKK......KKKK
''')
runs(g,'''
66 84 KstcccbaaK
66 85 KstcccbaaK
66 86 KstcccbaaK
66 87 KstcccbaaK
66 88 KstcccbaaK
66 89 KstcccbaaK
67 90 KstcccbaaK
67 91 KstcccbaaK
67 92 KstcccbaaK
68 93 KstcccbaaK
68 94 KstcccbaaK
89 77 pPp
88 78 pPwwPp
88 79 pPwwPPp
89 80 pPPPPp
90 81 pPPp
''')
save('skill_a',g)

# Cast: head levels, mouth itself is the fork root; two unequal poison-web fans.
g=[row[:] for row in BODY]
ink(g,62,53,'''
............KKKKKKKKKK
.........KKKsstttuuuttssKK
.......KKstuuvvvvvvvuutssKK
......KstuuvvvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvvvuutssK
....KstuuvvvccddddddddccutsK
...KstuuvvvccdddddddddddutsK
..KstuuvvccddddddddddddccsK
.KstuuvvccdddKKdddKKdddKKbsK
KstuuvvccddddrRdddrRdddrRbbsK
KstuuvvccddddqRdddrRdddrRbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrRdddrRdddrRddbbsK
KstuuuccdddqRdddrRdddrRddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrRdddrRdddrRddddbbsK
KstuuccddqRdddrRdddrRddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
.KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKppKtuuvvwK
.KstccbKtuuvvKPPKtuuvvwK
.KstcbaKtuuvvKwwPKtuuvvwK
.KstcbaKtuuvvKwwPKtuuvvwK
.KstcbaKtuuvvKPPpKtuuvvwKK
..KscbaKtuuvvKPPpKtuuvvvuKK
...KcbaKtuuvvKpppKtuuvvvvvuK
....KbaKstuuuvvKKpKKstuuuvvwK
.....KaKKstuuwwK....KKstuwK
......KKKKKKKKK.......KKKK
''')
runs(g,'''
117 40 pP
116 41 pPP
115 42 pPwP
114 43 pPwwP
113 44 pPwwPp
113 45 pPwwPp
112 46 pPwwPp
111 47 pPwwPp
110 48 pPwwPp
109 49 pPwwPp
108 50 pPwwPp....pP
107 51 pPwwPp....pPP
106 52 pPwwPp....pPwP
106 53 pPwwPp...pPwPp
105 54 pPwwPp...pPwPp
104 55 pPwwPp...pPwPp
103 56 pPwwPp...pPwPp
102 57 pPwwPp...pPwPp
101 58 pPwwPp...pPwPp
101 59 pPwwPPppPPwPp
100 60 pPwwPPPPPwPp
99 61 pPwwPPppPwPp
99 62 pPwwPp.pPwPp
98 63 pPwwPp.pPwPp
98 64 pPwwPppPwPp
97 65 pPwwPPPwPp
97 66 pPwwPPPPp
96 67 pPwwPPPp
96 68 pPwwPPp
95 69 pPwwPPp
95 70 pPwwPPp
94 71 pPwwPPp
94 72 pPwwPPp
94 73 pPwwPPp
93 74 pPwwPPp
93 75 pPwwPPp
92 76 pPwwPPp
92 77 pPwwPPp
91 78 pPwwPPp
90 79 pPwwPPPp
88 80 pPwwwwPPp
88 81 pPwwwwwwPPp
89 82 pPwwwwwwwwPPp
90 83 pPwwwwwwwwwwPPp
91 84 pPPwwwwwwwwwwPPp
92 85 pPPPPwwwwwwwwwwPPp
93 86 pPPpPPwwwwwwwwwwPPp
94 87 pPPp.pPPwwwwwwwwwwPPp
95 88 pPPp...pPPwwwwwwwwwPPp
96 89 pPPp.....pPPwwwwwwwwPPp
97 90 pPPp.......pPPwwwwwwwPPp
98 91 pPPp.........pPPwwwwwPPp
99 92 pPPp...........pPPwwwPPp
100 93 pPPp............pPPwwPPp
101 94 pPPp.............pPPwPPp
102 95 pPPp..............pPPPp
103 96 pPPp...............pPPp
104 97 pPPp...............pPPp
105 98 pPPp..............pPPp
106 99 pPPp.............pPPp
107 100 pPPp............pPPp
108 101 pPPp...........pPPp
109 102 pPPp..........pPPp
110 103 pPPp.........pPPp
111 104 pPPp........pPPp
112 105 pPPp......pPPp
113 106 pPPpp...pPPp
114 107 pPPPPppPPp
115 108 pPPPPPPp
116 109 pPPPPp
117 110 pPPp
118 111 pp
''')
# Four-legged near-side neck is kept solid behind the mouth/fan.
runs(g,'''
64 83 KstcccbaaK
64 84 KstcccbaaK
64 85 KstcccbaaK
64 86 KstcccbaaK
64 87 KstcccbaaK
64 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
''')
save('skill_b',g)

# Recovery: jaw plates close toward the mouth, with three unequal detached drops.
g=[row[:] for row in BODY]
ink(g,61,55,'''
............KKKKKKKKKK
.........KKKsstttuuuttssKK
.......KKstuuvvvvvvvuutssKK
......KstuuvvvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvvvuutssK
....KstuuvvvccddddddddccutsK
...KstuuvvvccdddddddddddutsK
..KstuuvvccddddddddddddccsK
.KstuuvvccdddKKdddKKdddKKbsK
KstuuvvccddddrRdddrRdddrRbbsK
KstuuvvccddddqRdddrRdddrRbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrRdddrRdddrRddbbsK
KstuuuccdddqRdddrRdddrRddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrRdddrRdddrRddddbbsK
KstuuccddqRdddrRdddrRddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
.KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
..KscbaKtuuvvKaaKtuuvvwK
...KcbaKtuuvvKaaKtuuvvwK
....KbaKtuuvvuKaaKtuuvvvuK
.....KaKstuuuvvuKKstuuuvvwK
......KKKstuuuwwK.KKstuwK
.........KKKKKKK....KKKK
''')
runs(g,'''
64 83 KstcccbaaK
64 84 KstcccbaaK
64 85 KstcccbaaK
64 86 KstcccbaaK
64 87 KstcccbaaK
64 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
97 88 pP
97 89 pPPp
96 90 pPwwPp
96 91 pPwPPp
97 92 pPPPp
98 93 ppp
107 95 pP
107 96 pPPp
106 97 pPwPp
106 98 pPPPPp
107 99 pPPPp
108 100 ppp
117 87 pP
117 88 pPPp
116 89 pPwPp
117 90 pPPp
118 91 pp
''')
save('skill_c',g)
# Poison: sick low jaw, near front limb tucked against the mandible.
g=[row[:] for row in BODY]
wipe(g,81,85,35,38)
ink(g,74,86,'''
KKKKKK
KstuuttcK
.KstuuttccK
..KstuuttccbaK
...KstuuttccbaaK
....KstuuttccbaaK
.....KstuuttccbaaK
......KtuvvuutcbaaK
.......KtuvuutcbaaK
........KtuutcbaaK
.......KtuutcbaaK
......KtuutcbaaK
.....KtuutcbaaK
....KtuutcbaaK
...KtuutcbaaK
..KtuutcbaaK
.KtuutcbaaK
KtuutcbaaK
KtutcbaaK
KtcbaaK
.KtcbaaK
..KtcbaaK
...KtcbaaK
....KtcbaaK
.....KtcbaaK
......KtcbaaK
.......KtcbaaK
........KtcbaaK
.........KtcbaaK
..........KtcbaaK
...........KcbaaK
...........KcbaaK
..........KcbaaK
.........KbaaaK
.........KKKKK
''')
ink(g,59,62,'''
............KKKKKKKKKK
.........KKKsstttuuuttssKK
.......KKstuuvvvvvvvuutssKK
......KstuuvvvvvvvvvvvuutssK
.....KstuuvvvvvvvvvvvvvuutssK
....KstuuvvvccddddddddccutsK
...KstuuvvvccdddddddddddutsK
..KstuuvvccddddddddddddccsK
.KstuuvvccdddKKdddKKdddKKbsK
KstuuvvccddddrrdddrrdddrrbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrrdddrrdddrrddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrrdddrrdddrrddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
.KstcccddccKKKcccccbbbaaaK
.KstcdddcKstuvKcccKstuvvK
.KstccdcKtuuvvKcbKtuuvvwK
.KstccbKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
.KstcbaKtuuvvKaaKtuuvvwK
..KscbaKtuuvvKaaKtuuvvwK
...KcbaKtuuvvKaaKtuuvvwK
....KbaKtuuvvuKaaKtuuvvvuK
.....KaKstuuuvvuKKstuuuvvwK
......KKKstuuuwwK.KKstuwK
.........KKKKKKK....KKKK
''')
runs(g,'''
64 85 KstcccbaaK
64 86 KstcccbaaK
64 87 KstcccbaaK
64 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
96 73 ppPPpp
95 74 pPwwwPPp
95 75 pPw..PPp
95 76 pP...PPp
96 77 pPPPPp
97 78 pppp
105 58 ppPPpp
104 59 pPwwPPPp
104 60 pPw..PPp
104 61 pP...PPp
105 62 pPPPPp
106 63 pppp
115 69 pp
114 70 pPwp
114 71 pPPp
115 72 pp
''')
save('poison_a',g)

# Poison b: jaw sinks, paired tusks twitch separately; arm presses higher.
g=[row[:] for row in BODY]
wipe(g,82,85,34,37)
ink(g,73,87,'''
KKKKKK
KstuuttcK
.KstuuttccK
..KstuuttccbaK
...KstuuttccbaaK
....KstuuttccbaaK
.....KstuuttccbaaK
......KtuvvuutcbaaK
.......KtuvuutcbaaK
........KtuutcbaaK
.......KtuutcbaaK
......KtuutcbaaK
.....KtuutcbaaK
....KtuutcbaaK
...KtuutcbaaK
..KtuutcbaaK
.KtuutcbaaK
KtuutcbaaK
KtutcbaaK
KtcbaaK
.KtcbaaK
..KtcbaaK
...KtcbaaK
....KtcbaaK
.....KtcbaaK
......KtcbaaK
.......KtcbaaK
........KtcbaaK
.........KtcbaaK
..........KtcbaaK
...........KcbaaK
...........KcbaaK
..........KcbaaK
.........KbaaaK
.........KKKKK
''')
ink(g,60,64,'''
...........KKKKKKKKKKK
........KKKsstttuuuttssKK
......KKstuuvvvvvvvuutssKK
.....KstuuvvvvvvvvvvvuutssK
....KstuuvvvvvvvvvvvvvuutssK
...KstuuvvvccddddddddccutsK
..KstuuvvvccdddddddddddutsK
.KstuuvvccddddddddddddccsK
KstuuvvccddddKKdddKKdddKKbsK
KstuuvvccddddrrdddrrdddrrbbsK
KstuuvvccddddccdddccdddccbbsK
KstuuvvccddddddddddddddddbbsK
KstuuuccdddKKdddKKdddKKddbbsK
KstuuuccdddrrdddrrdddrrddbbsK
KstuuuccdddccdddccdddccddbbsK
KstuuuccdddddddddddddddddbbsK
KstuuccddKKdddKKdddKKddddbbsK
KstuuccddrrdddrrdddrrddddbbsK
KstuuccddccdddccdddccddddbbsK
KstuuccddddddddddddddcccbbasK
KsttcccddddccccddddcccbbbaaK
KstcccddccKKKcccccbbbaaaK
KstcdddcKstuvKcccKstuvvK
KstccdcKtuuvvKcbKtuuvvwK
KstccbKtuuvvKaaKtuuvvwK
KstcbaKtuuvvKaaKtuuvvwK
KstcbaKtuuvvKaaKtuuvvwK
.KscbaKtuuvvKaaKtuuvvwK
..KcbaKtuuvvKaaKtuuvvvuK
...KbaKtuuvvuKaaKstuuwwK
....KaKstuuuvvuK.KKKKKK
.....KKKstuuuwwK
........KKKKKKK
''')
runs(g,'''
64 86 KstcccbaaK
64 87 KstcccbaaK
64 88 KstcccbaaK
65 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
100 65 ppPPpp
99 66 pPwwwPPp
99 67 pPw..PPp
99 68 pP...PPp
100 69 pPPPPp
101 70 pppp
111 52 pp
110 53 pPwp
110 54 pPPp
111 55 pp
113 80 ppPPp
112 81 pPwwPPp
112 82 pPw.PPp
112 83 pP..PPp
113 84 pPPPPp
114 85 pppp
''')
save('poison_b',g)

# Stun: lowered, skewed cephalothorax; limp tusks and sagging knees.
g=[row[:] for row in BODY]
ink(g,57,61,'''
..............KKKKKKKK
...........KKKssttttssKK
.........KKstuuvvvvvuutsKK
........KstuuvvvvvvvvuutssK
.......KstuuvvvvvvvvvvuutssK
......KstuuvvvvvvvvvvvvuutssK
.....KstuuvvccddddddddccutsK
....KstuuvvccddddddddddddutsK
...KstuuvvccdddKKKdddKKKddbsK
..KstuuvvccdddddrrddddrrddbbsK
.KstuuvvccddddddcddKKKddddbbsK
KstuuvvccdddKKKdddddrrddddbbsK
KstuuvvccddddrrdddddcdddddbbsK
KstuuuccddddcddKKKdddKKKdbbsK
KstuuuccddddddddrrddddrrdbbsK
KstuuuccdddKKKddcdddddcddbbsK
KstuuuccddddrrdddddddddddbbsK
KstuuuccddddcddKKKdddddddbbsK
KstuuccdddddddddrrdddddddbbsK
KstuuccdddddddddcddddddcbbasK
KstuuccddddKKKdddddddcbbbaaK
KstuuccdddddrrddddcccbbbaaK
.KsttccdddddccddcccbbbaaaK
..KstccddddcccccbbbaaaaaK
...KstcccddccKKKccccbaaaK
....KstccddcKstuvKcbbaaaK
.....KstcddKtuuvvKcKstuvK
......KccdbKtuuvvKcKtuuvK
.......KcbKtuuvvKaaKtuuvK
........KbbKtuuvvK.KtuuvK
.........KbKtuuvvK.KtuuvK
..........KKtuuvvK.KtuuvK
...........KtuuvvK.KtuuvK
............KtuvvK.KtuvK
.............KtuvK.KtuvK
..............KstuvK.KtuvK
...............KstuvKKtuvK
................KstuuvtuK
.................KKstutK
...................KKK
''')
runs(g,'''
63 85 KstcccbaaK
63 86 KstcccbaaK
63 87 KstcccbaaK
64 88 KstcccbaaK
64 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
85 36 q
85 37 w
84 38 qwq
81 39 qwwwwwwwq
82 40 qwwwwwq
83 41 qwwwq
82 42 qwq.qwq
82 43 qq...qq
105 46 q
105 47 w
104 48 qwq
102 49 qwwwwwq
103 50 qwwwq
103 51 qw.qw
102 52 q...q
''')
save('stun_a',g)

# Stun b: sagging thorax turns inward; stars are separately authored positions.
g=[row[:] for row in BODY]
ink(g,56,63,'''
..............KKKKKKKK
...........KKKssttttssKK
.........KKstuuvvvvvuutsKK
........KstuuvvvvvvvvuutssK
.......KstuuvvvvvvvvvvuutssK
......KstuuvvvvvvvvvvvvuutssK
.....KstuuvvccddddddddccutsK
....KstuuvvccddddddddddddutsK
...KstuuvvccdddKKKdddKKKddbsK
..KstuuvvccdddddrrddddrrddbbsK
.KstuuvvccddddddcddKKKddddbbsK
KstuuvvccdddKKKdddddrrddddbbsK
KstuuvvccddddrrdddddcdddddbbsK
KstuuuccddddcddKKKdddKKKdbbsK
KstuuuccddddddddrrddddrrdbbsK
KstuuuccdddKKKddcdddddcddbbsK
KstuuuccddddrrdddddddddddbbsK
KstuuuccddddcddKKKdddddddbbsK
KstuuccdddddddddrrdddddddbbsK
KstuuccdddddddddcddddddcbbasK
KstuuccddddKKKdddddddcbbbaaK
KstuuccdddddrrddddcccbbbaaK
.KsttccdddddccddcccbbbaaaK
..KstccddddcccccbbbaaaaaK
...KstcccddccKKKccccbaaaK
....KstccddcKstuvKcbbaaaK
.....KstcddKtuuvvKcKstuvK
......KccdbKtuuvvKcKtuuvK
.......KcbKtuuvvKaaKtuuvK
........KbbKtuuvvK.KtuuvK
.........KbKtuuvvK.KtuuvK
..........KKtuuvvK.KtuuvK
...........KtuuvvK.KtuuvK
............KtuvvK.KtuvK
.............KtuvK.KtuvK
..............KstuvK.KtuvK
...............KstuuvKKtuvK
................KKstuuvtuK
..................KKstutK
....................KKK
''')
runs(g,'''
63 85 KstcccbaaK
63 86 KstcccbaaK
63 87 KstcccbaaK
64 88 KstcccbaaK
64 89 KstcccbaaK
65 90 KstcccbaaK
65 91 KstcccbaaK
66 92 KstcccbaaK
66 93 KstcccbaaK
67 94 KstcccbaaK
96 37 q
96 38 w
95 39 qwq
92 40 qwwwwwwwq
93 41 qwwwwwq
94 42 qwwwq
93 43 qwq.qwq
93 44 qq...qq
73 47 q
73 48 w
72 49 qwq
70 50 qwwwwwq
71 51 qwwwq
71 52 qw.qw
70 53 q...q
''')
save('stun_b',g)
# Final native inspection corrections. These are selected anatomy clusters,
# never a connectivity fill or propagation into other frames.
g=load('windup')
runs(g,'''
74 116 KtcbaaK
74 117 KtcbaaK
74 118 KtcbaaK
74 119 KtcbaaK
74 120 KtcbaaK
74 121 KcbaaK
73 122 KcbaaK
72 123 KbaaaK
72 124 KKKKKK
115 113 .
115 114 .
115 115 .
115 116 .
''')
# Distinct inward-curved windup fangs, with an intentional gap between tips.
# Clear only the former joined tips, not a surrounding anatomical rectangle.
runs(g,'''
67 88 KtuuvK.KtuuvK
67 89 KtuuvK.KtuuvK
67 90 KtuuvK.KtuuvK
68 91 KtuvK..KtuvK
69 92 KtuvK..KtuvK
70 93 KstuK..KstuK
71 94 KttK...KttK
72 95 KKK....KKK
72 96 ..........
73 97 ........
''')
save('windup',g)
g=load('recover')
runs(g,'''
115 113 .
115 114 .
115 115 .
115 116 .
''')
save('recover',g)
# Low fallen neck: side plates overlap abdomen and the resting face.
g=load('dead')
ink(g,57,98,'''
...KstcccbbbaaK
..KstccccbbbaaaK
.KstccccbbbaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
KstccccbbbaaaaaK
.KstccccbbbaaaaK
..KstccccbbbaaaK
...KstccccbbaaK
....KstcccbbaK
.....KstccbaK
......KscbaK
.......KbaK
''')
# Deliberately folded lower femur ties the third near leg into the belly.
runs(g,'''
43 109 KstcccbaaK
43 110 KstcccbaaK
44 111 KstcccbaaK
44 112 KstcccbaaK
45 113 KstcccbaaK
46 114 KstcccbaaK
47 115 KstccbaaK
48 116 KstcbaaK
31 117 ..
31 118 ..
31 119 ..
''')
save('dead',g)
g=load('sleep_a')
ink(g,52,80,'''
......KstcccbbbaaK
.....KstccccbbbaaaK
....KstccccbbbaaaaK
...KstccccbbbaaaaaK
..KstccccbbbaaaaaaK
.KstccccbbbaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
.KstccccbbbaaaaaaaK
..KstccccbbbaaaaaaK
...KstccccbbbaaaaaK
....KstccccbbbaaaaK
.....KstccccbbbaaaK
......KstccccbbaaK
.......KstcccbaaK
........KstccbaK
''')
runs(g,'''
43 98 KstcccbbbaaK
43 99 KstcccbbbaaK
43 100 KstcccbbbaaK
43 101 KstcccbbbaaK
43 102 KstcccbbbaaK
43 103 KstcccbbbaaK
44 104 KstcccbbbaaK
45 105 KstcccbbbaaK
46 106 KstcccbbbaaK
47 107 KstcccbbbaaK
89 122 KtuucbaK
89 123 KtcbaaaK
89 124 KKKKKKK
''')
save('sleep_a',g)
g=load('sleep_b')
ink(g,53,81,'''
......KstcccbbbaaK
.....KstccccbbbaaaK
....KstccccbbbaaaaK
...KstccccbbbaaaaaK
..KstccccbbbaaaaaaK
.KstccccbbbaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
KstccccbbbaaaaaaaaK
.KstccccbbbaaaaaaaK
..KstccccbbbaaaaaaK
...KstccccbbbaaaaaK
....KstccccbbbaaaaK
.....KstccccbbbaaaK
......KstccccbbaaK
.......KstcccbaaK
........KstccbaK
''')
runs(g,'''
43 98 KstcccbbbaaK
43 99 KstcccbbbaaK
43 100 KstcccbbbaaK
43 101 KstcccbbbaaK
44 102 KstcccbbbaaK
44 103 KstcccbbbaaK
45 104 KstcccbbbaaK
46 105 KstcccbbbaaK
47 106 KstcccbbbaaK
48 107 KstcccbbbaaK
89 122 KtuucbaK
89 123 KtcbaaaK
89 124 KKKKKKK
82 116 ..
82 117 ..
''')
save('sleep_b',g)
# Sick stance maintains its real planted near fourth foot.
g=load('poison_a')
runs(g,'''
73 116 KtcbaaK
73 117 KtcbaaK
74 118 KtcbaaK
74 119 KtcbaaK
74 120 KtcbaaK
74 121 KcbaaK
73 122 KcbaaK
72 123 KbaaaK
72 124 KKKKKK
''')
save('poison_a',g)
g=load('poison_b')
runs(g,'''
73 116 KtcbaaK
73 117 KtcbaaK
74 118 KtcbaaK
74 119 KtcbaaK
74 120 KtcbaaK
74 121 KcbaaK
73 122 KcbaaK
72 123 KbaaaK
72 124 KKKKKK
''')
save('poison_b',g)
# Sleep b's compressed third near femur: a visible plated path below the jaw.
g=load('sleep_b')
runs(g,'''
81 111 KstcccbaaK
81 112 KstcccbaaK
81 113 KstcccbaaK
82 114 KstcccbaaK
83 115 KstcccbaaK
84 116 KtuuvuutcbaK
85 117 KtuuvuutcbaK
86 118 KtuuvuutcbaK
''')
save('sleep_b',g)
# The cast's actual inter-tusk mouth feeds both authored forks visibly.
g=load('skill_b')
runs(g,'''
77 81 wPp
78 82 wPPPPPPPPpp
79 83 wPPwwPPPPPPpp
80 84 PwwwwPPPPPPpp
109 93 pPpppPPppppPPp
110 94 pP..pPP...pPPp
111 95 pP.pPP...pPPp
112 96 pPPP...pPPp
113 97 pPP...pPPp
114 98 pP...pPPp
115 99 pP..pPPp
116 100 pP.pPPp
117 101 pPPPp
118 102 pPPp
''')
save('skill_b',g)
# Preparation core is explicitly nested in the mouth between the two tusks.
g=load('skill_a')
runs(g,'''
76 77 pP
75 78 pPwwP
75 79 pPwwPp
76 80 pPPPp
77 81 ppp
''')
save('skill_a',g)

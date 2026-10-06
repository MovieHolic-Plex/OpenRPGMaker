"""Individually chosen pose/anatomy replacement strips, not frame transforms."""
from literal_clusters import *

WINDUP_HEAD = (20, '''
68 kk
68 kagk
68 kaagk
68 krahgk
68 kroaghk
68 krvoaghk
68 krvvoaghk...kk
69 krvvoaagk..kagk
69 krvvoaaagkkagk
69 krvvoaaaaggagk
69 krvvoaaaaggggk
70 krvvoaaaagggk
70 krvoooaaaggk
71 krvoooaaagk
71 krvooooaaak
72 krvooooaaaakk
72 kroooaagggggkk
72 krooaagghhhggaakk
72 kroaagghhhhgggaaakk
72 kroaagghhhhgggggaaak
73 kroaagghhhgkkggggaaak
73 kroaagghhgkeekggggaaak
74 kroaagggggekehkgggggggakk
75 kroaaagggeekgggghhhgggggakk
76 kroaaaggggggghhhgggaaaagggkk
77 kroaaaaggggggggaaaaggghhhgggakk
78 kroaaaaggggaaaaagggggghhgggaak
78 krvooaaaaaaaagggggaaaaaakkkk
77 krvvooaaaaaaaagggkkkkkk
76 krvvoooaaaaaaaagk
75 krvvooooaaaaaaaak
74 krvvoooooaaaaaaaak
73 krvvooooooaaaaaaaak
72 krvvoooooooaaaaaaaak
71 krvvooooooooaaaaaaaak
70 krvvooooooooaaaaaaaak
69 krvvooooooooaaaaaaaak
68 krvvooooooooaaaaaaaak
67 krvvooooooooaaaaaaaak
66 krvvooooooooaaaaaaaak
65 krvvooooooooaaaaaaaak
64 krvvooooooovvoaaaaaak
63 krvvoooooovvvoaaaaaak
62 krvvooooovvvvoaaaaaak
61 krvvoooovvvvvoaaaaaak
60 krvvooovvvvvvoaaaaaak
59 krvvoovvvvvvvoaaaaaak
58 krvoovvvvvvvvvoaaaaak
57 krvoovvvvvvvvvvoaaaak
56 krvoovvvvvvvvvvvoaaak
''')
# Bent wing shoulder; lower quills fold into the body, unlike idle's long fan.
WINDUP_WING = (50, '''
47 kkkk
44 kkroaagkk
41 kkroaaggggakk
38 kroaaagghhgggakk
35 kroaaagghhhggggakk
32 kroaaagghhhggggaaakk
30 kroaaagghhhggggaaaakk
28 kroaaagghhhggggaaaaovkk
27 kroaaagghhhggggaaaaovvrkk
26 kroaaagghhhggggaaaaovvvrrkk
25 kroaaagghhhggggaaaaovvvrrskk
25 kroaaagghhhgggaaaaovvvvrrssk
24 kroaaagghhgggaaaaovvvvvrrssk
24 kroaaagghgggaaaaovvvvvvrrssk
24 kroaaagggggaaaaovvvvvvvrrssk
24 kroaaaggggaaaovvvvvvvvrrsssk
24 kroaaagggaaovvvvvvvvvrrsssk
25 kroaaaggaaovvvvvvvvvvrrsssk
25 kroaaaggaovvvvvvvvvvrrrsssk
26 kroaaagovvvvvvvvvvvvrrrsssk
26 kroaaagovvvvvvvvvvvrrrssssk
27 kroaaagovvvvvvvvvvvrrrssssk
27 kroaaagovvvvvvvvvvrrrsssssk
28 kroaaagovvvvvvvvvvrrrsssssk
28 kroaaagovvvvvoagvvrrrsssssk
29 kroaaagovvvvoaggvvrrrsssssk
29 kroaaagovvvvoaggvrrrsssssk
30 kroaaagovvvoaggvvrrrsssssk
30 kroaaagovvvoaggvrrrsssssk
31 kroaaagovvoaggvvrrrsssssk
31 kroaaagovvoaggvrrrsssssk
32 kroaaagovoaggvvrrrsssssk
32 kroaaagovoaggvrrrsssssk
33 kroaaagoaaggvvrrrsssssk
34 kroaaggaaggvvrrrsssssk
35 kroaagggggvvrrrsssssk
36 kroaaggggvvrrrsssssk
37 kroaagggvvrrrsssssk
38 kroaaggvvrrrsssssk
39 kroaagvvrrrsssssk
40 kroaagvvrrrsssssk
41 kroaagvvrrrssssk
42 kroaagvvrrrsssk
43 kroaagvvrrrssk
44 kraagvvrrrsk
45 kraagvvrrsk
46 kraagvrrsk
47 kraagrrsk
48 kraarrsk
49 krrrsk
50 kssk
51 kkk
''')
# Distant wing lifts behind the neck. Feather tips are staggered, never radial.
SPREAD_BACK = (17, '''
30 kk
29 kagk
28 kaaghk
27 koagghk
26 kvoagghk
25 krvoagghk
24 krvvoagghk
23 krvvvoagghk
22 krvvvvoagghk
21 krvvvvvoagghk
20 krvvvvvvoagghk
19 krvvvvvvvoagghk
18 krvvvvvvvvoagghk
17 krvvvvvvvvvoagghk
16 krvvvvvvvvvvoagghk
15 krvvvvvvvvvvvoagghk
14 krvvvvvvvvvvvvoagghk
13 krvvvvvvvvvvvvvoagghk
12 krvvvvvvvvvvvvvvoagghk
11 krvvvvvvvvvvvvvvvoagghk
10 krvvvvvvvvvvvvvvvvoagghk
10 krvvvvvvvvvvvvvvvvoagghk
11 krvvvvvvvvvvvvvvvvoagghk
12 krvvvvvvvvvvvvvvvvoagghk
13 krvvvvvvvvvvvvvvvvoagghk
14 krvvvvvvvvvvvvvvvvoagghk
15 krvvvvvvvvvvvvvvvvoagghk
16 krvvvvvvvvvvvvvvvvoagghk
17 krvvvvvvvvvvvvvvvvoagghk
18 krvvvvvvvvvvvvvvvvoagghk
19 krvvvvvvvvvvvvvvvvoagghk
20 krvvvvvvvvvvvvvvvvoagghk
21 krvvvvvvvvvvvvvvvvoagghk
22 krvvvvvvvvvvvvvvvvoagghk
23 krvvvvvvvvvvvvvvvvoagghk
24 krvvvvvvvvvvvvvvvvoagghk
25 krvvvvvvvvvvvvvvvvoagghk
26 krvvvvvvvvvvvvvvvvoagghk
27 krvvvvvvvvvvvvvvvvoagghk
28 krvvvvvvvvvvvvvvvvoagghk
29 krvvvvvvvvvvvvvvvvoagghk
30 krvvvvvvvvvvvvvvvvoagghk
31 krvvvvvvvvvvvvvvvvoagghk
32 krvvvvvvvvvvvvvvvvoagghk
33 krvvvvvvvvvvvvvvvvoagghk
34 krvvvvvvvvvvvvvvvvoagghk
35 krvvvvvvvvvvvvvvvoagghk
36 krvvvvvvvvvvvvvvoagghk
37 krvvvvvvvvvvvvvoagghk
38 krvvvvvvvvvvvvoagghk
39 krvvvvvvvvvvvoagghk
40 krvvvvvvvvvvoagghk
41 krvvvvvvvvvoagghk
42 krvvvvvvvvoagghk
43 krvvvvvvvoagghk
44 krvvvvvvoagghk
45 krvvvvvoagghk
46 krvvvvoagghk
47 krvvoagghk
48 krvoagghk
49 kroagghk
50 koagghk
51 kagghk
52 kaghk
53 kagk
54 kk
''')
# Near wing fans to the upper left. Selected cream feathers divide red planes.
OPEN_WING = (30, '''
15 kk
15 kagk
15 kaagk
15 koaggk
15 kvoaghk
15 krvoaghk
15 krvvoagghk
15 krvvvoagghkk
15 krvvvvoagghgkk
15 krvvvvooagghggkk
15 krvvvvvooagghggakk
15 krvvvvvvooagghggaakk
15 krvvvvvvvooagghggaaakk
15 krvvvvvvvvooagghggaaakk
15 krvvvvvvvvvooagghggaaaakk
15 krvvvvvvvvvvooagghggaaaakk
15 krvvvvvvvvvvvooagghggaaaovkk
15 krvvvvvvvvvvvvooagghggaaaovvrkk
15 krvvvvvvvvvvvvvooagghggaaaovvvrrkk
15 krvvvvvvvvvvvvvvooagghggaaaovvvrrskk
15 krvvvvvvvvvvvvvvvooagghggaaaovvvrrssk
15 krvvvvvvvvvvvvvvvvooagghggaaaovvvrrssk
15 krvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
16 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
17 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
18 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
19 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
20 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
21 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
22 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
23 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
24 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
25 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
26 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
27 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
28 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
29 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
30 krvvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
31 krvvvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
32 krvvvvvvvvvvvvvvooagghggaaaovvvrrsssk
33 krvvvvvvvvvvvvvooagghggaaaovvvrrsssk
34 krvvvvvvvvvvvvooagghggaaaovvvrrsssk
35 krvvvvvvvvvvvooagghggaaaovvvrrsssk
36 krvvvvvvvvvvooagghggaaaovvvrrsssk
37 krvvvvvvvvvooagghggaaaovvvrrsssk
38 krvvvvvvvvooagghggaaaovvvrrsssk
39 krvvvvvvvooagghggaaaovvvrrsssk
40 krvvvvvvooagghggaaaovvvrrsssk
41 krvvvvvooagghggaaaovvvrrsssk
42 krvvvvooagghggaaaovvvrrsssk
43 krvvvooagghggaaaovvvrrsssk
44 krvvooagghggaaaovvvrrsssk
45 krvooagghggaaaovvvrrsssk
46 krooagghggaaaovvvrrsssk
47 koagghggaaaovvvrrsssk
48 kagghggaaaovvvrrsssk
49 kaghggaaaovvvrrsssk
50 kaggaaaovvvrrsssk
51 kgaaaovvvrrsssk
52 kaaaovvvrrsssk
53 kaaovvvrrsssk
54 kaovvvrrsssk
55 kovvvrrsssk
56 kvvvrrsssk
57 kvvrrssk
58 kvrrssk
59 krrssk
60 kssk
61 kkk
''')
OPEN_WING_DETAILS = (45, '''
20 oaagggghggaovvv
21 oaagggghggaovvv
22 oaagggghggaovvv
23 oaagggghggaovvv
24 oaagggghggaovvv
25 oaagggghggaovvv
26 oaagggghggaovvv
27 oaagggghggaovvv
28 oaagggghggaovvv
29 oaagggghggaovvv
30 oaagggghggaovvv
31 oaagggghggaovvv
32 oaagggghggaovvv
33 oaagggghggaovvv
34 oaagggghggaovvv
35 oaagggghggaovvv
36 oaagggghggaovvv
37 oaagggghggaovvv
38 oaagggghggaovvv
39 oaagggghggaovvv
40 oaagggghggaovvv
41 oaagggghggaovvv
42 oaagggghggaovvv
43 oaagggghggaovvv
44 oaagggghggaovvv
45 oaagggghggaovvv
46 oaagggghggaovvv
47 oaagggghggaovvv
48 oaagggghggaovvv
49 oaagggghggaovvv
50 oaagggghggaovvv
51 oaagggghggaovvv
''')
# Head in contact: pointed beak and arched neck join the shoulder in the same pixels.
DASH_HEAD = (36, '''
85 kk
84 kagk
83 kaagk
82 krahgk
81 kroaghk
80 krvoaghk...kk
79 krvvoaghk.kagk
78 krvvoaagkkaghk
77 krvvoaaaggaghk
76 krvvoaaaaggggk
76 krvooaaaagggk
76 krvoooaaaggk
77 krvooooaaagk
77 kroooaaaaggkk
78 kroooaaggggggkk
79 krooaagghhhggggakk
80 kroaagghhhhgggggaaakk
81 kroaagghhhhgkkgggggaaak
82 kroaagghhhgkeekggggggaak
82 kroaagghhggekehkggggggaakk
82 kroaagggggeeekgggghhggggggaakk
81 kroaaaggggggggghhhhggggggaaaaagkk
80 krvoaaagggggggggggaaaaagggghhhgggakk
79 krvvoaaagggggaaaaaagggggghhhgggaaak
78 krvvooaaaaaaaaggggggaaaaaggggaakkk
77 krvvoooaaaaaaaaaaagggkkkkkkkk
76 krvvooooaaaaaaaaaaak
75 krvvoooooaaaaaaaaaak
74 krvvooooooaaaaaaaaaak
73 krvvoooooooaaaaaaaaak
72 krvvooooooooaaaaaaaak
71 krvvoooooooooaaaaaaak
70 krvvooooooooooaaaaaak
69 krvvoooooooooooaaaak
68 krvvoooooooooooaaaak
67 krvvooooooooovvoaaak
66 krvvoooooooovvvoaaak
65 krvvooooooovvvvoaaak
64 krvvoooooovvvvvoaaak
63 krvvooooovvvvvvoaaak
62 krvvoooovvvvvvvoaaak
61 krvvooovvvvvvvvoaaak
60 krvvoovvvvvvvvvoaaak
59 krvoovvvvvvvvvvoaaak
58 krvoovvvvvvvvvvoaaak
57 krvoovvvvvvvvvvoaaak
56 krvoovvvvvvvvvvoaaak
55 krvoovvvvvvvvvvoaaak
''')
# The hind foot pushes left while the front thigh extends diagonally to a landing.
STEP_LEGS = (101, '''
63 kbbccbk.............kbcccbk
62 kbcccbk..............kbcdcck
61 kbcdcbk...............kbddcck
60 kbddck.................kbddcck
59 kbddck...................kbddcck
58 kbddck.....................kbddcck
57 kbddck.......................kbddcck
56 kbddck.........................kbddcck
55 kbddck...........................kbddcck
54 kbddck.............................kbddcck
53 kbddck...............................kbddcck
52 kbddck.................................kbddcck
51 kbcddck..................................kbddcck
50 kbcddck...................................kbddcck
49 kbccddck...................................kbddccck
48 kbccddcck..................................kbddccck
47 kbcccdddck..................................kbddccck
46 kbcccccddck.................................kbddcccckk
45 kbcccdccddck.................................kbddccddccckk
44 kbccdcccddcck...............................kbcdccccddcddck
43 kbccdcccddcccbbkkkk.........................kbccdddccccddcck
42 kbcdddccbbcccddcccbkk.......................kbccddccccbddddk
42 kbdddddk..kbdddddk..........................kbdddck..kbdddck
42 kkkkkkk...kkkkkkk...........................kkkkkkk..kkkkkk
''')
# Contact talons: lifted thigh joins hip, foot curls forward toward the enemy.
KICK_LEGS = (99, '''
64 kbbccbk.............kbcccbk
64 kbcccbk.............kbcdccck
63 kbcdcbk.............kbdddccck
62 kbddck..............kbddddccck
61 kbddck...............kbddddccck
60 kbddck................kbddddccck
59 kbddck.................kbddddccck
58 kbddck..................kbddddcccbbkk
57 kbddck...................kbddddcccccccbbkk
56 kbddck....................kbddccccdddcccccbkk
55 kbddck.....................kbcccddddddccdddccbkk
54 kbddck......................kbccdddbbccccddddddck
53 kbcddck.......................kbddck..kbdddddccck
52 kbcddck........................kkkk...kddddddk
51 kbccddck...............................kddcck
50 kbccddcck...............................kbck
49 kbcccdddck...............................kk
48 kbcccccddck
47 kbcccdccddck
46 kbccdcccddcck
45 kbccdcccddcccbbkkkk
44 kbcdddccbbcccddcccbkk
44 kbdddddk..kbdddddk
44 kkkkkkk...kkkkkkk
''')
# Hit: eye squeezed, crest falls back, neck bends left into raised shoulder.
HIT_HEAD = (17, '''
66 kk
65 kagk
64 kaagk
63 krahgk
62 kroaghk
61 krvoaghk
60 krvvoaghk...kk
59 krvvoaagk..kagk
59 krvvoaaagkkaghk
59 krvvoaaaaggaghk
59 krvvoaaaaggggk
60 krvooaaaagggk
60 krvoooaaaggk
61 krvooooaaagk
61 kroooaaaaggkk
62 kroooaaggggggkk
63 krooaagghhhggggakk
64 kroaagghhhhgggggaaakk
65 kroaagghhhhgggggggaaak
66 kroaagghhhhggggggggaak
66 kroaagghhgkeeekggggggaakk
66 kroaagggggekgggggghhgggggaakk
65 kroaaaggggggggghhhgggggaaaagkk
64 krvoaaaggggggggggaaaagggghhhggakk
63 krvvoaaagggggaaaagggggghhhgggaak
62 krvvooaaaaaaaagggggaaaaagggakkk
61 krvvoooaaaaaaaaaagggkkkkkk
60 krvvooooaaaaaaaaaak
59 krvvoooooaaaaaaaaaak
58 krvvooooooaaaaaaaaaak
58 krvvoooooooaaaaaaaaak
58 krvvooooooooaaaaaaaak
58 krvvoooooooooaaaaaaak
59 krvvooooooooooaaaaaak
60 krvvoooooooooooaaaak
61 krvvoooooooooooaaaak
62 krvvooooooooovvoaaak
63 krvvoooooooovvvoaaak
64 krvvooooooovvvvoaaak
65 krvvoooooovvvvvoaaak
66 krvvooooovvvvvvoaaak
66 krvvoooovvvvvvvoaaak
65 krvvooovvvvvvvvoaaak
64 krvvoovvvvvvvvvoaaak
63 krvoovvvvvvvvvvoaaak
62 krvoovvvvvvvvvvoaaak
61 krvoovvvvvvvvvvoaaak
60 krvoovvvvvvvvvvoaaak
59 krvoovvvvvvvvvvoaaak
58 krvoovvvvvvvvvvoaaak
57 krvoovvvvvvvvvvoaaak
56 krvoovvvvvvvvvvoaaak
''')

def build(head=HEAD, wing=WING, legs=LEGS, spread=False, ribs=True):
    g=canvas()
    for block in [BODY, TAIL_FINAL, legs, BREAST]: ink(g,block)
    if spread: ink(g,SPREAD_BACK)
    ink(g,head); ink(g,wing)
    if wing is WING and ribs: ink(g,WING_RIBS)
    if wing is OPEN_WING: ink(g,OPEN_WING_DETAILS)
    return g

# Each idle patch makes local breathing / feather articulation changes.
IDLE_B_PATCHES = [
(28, '''
73 krvooaagghhhhgggggaaak
73 krvooaagghhhhgggggaaak
74 krvooaagghhgkkggggaaak
74 krvooaagghgkeekggggaaak
75 krvooaaggggekehkggggggaakk
75 krvooaagggeekggghhhgggaaaggkk
76 krvooaaggggggghhhgggaaaagggggkk
77 krvoaaagggggggggaaaaggghhhhgggaakk
78 krvoaaaggggaaaaaggghhhhhgggaaak
'''),
(69, '''
67 vvvoooaaaovvvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvvrrsskk
67 vvvoooaaaovvvvvvvvrrssskk
67 vvvoooaaaovvvvvvvvrrssskk
67 vvvoooaaaovvvvvvvvrrssskk
'''),
(96, '''
40 kroaagrrkoaggghk
40 kroaagrrkoagghhk
41 kroaagrrkoagghhk
41 kroaagrrkoaggghk
42 kroaagrrkoaggghk
42 kroaagrrkoagghk
43 kroaagrrkoaggk
43 kroaagrrkoagk
44 kraagrrkk
45 kkagkk
46 .kkk
''')]
IDLE_C_PATCHES = [
(31, '''
71 kroooaagghhgkeekgggaaak
72 kroooaagggekehkggghhgggaakk
72 krvooaagggeekggghhhgggaaaggkk
73 krvooaaggggggghhhgggaaaagggggkk
74 krvoaaagggggggggaaaaggghhhhgggaakk
75 krvoaaaggggaaaaaggghhhhhgggaaak
75 krvooaaaaaaaagggggaaaaaaakkk
75 krvoooaaaaaaaaggggkkkkkk
'''),
(59, '''
31 aagggggoovvvv
31 aaggggaovvvvv
31 aagggaaovvvvv
32 agggaaovvvvvv
32 agggaovvvvvvv
33 agggaovvvvvvv
33 aggaovvvvvvvv
34 aggaovvvvvvvv
34 ggaovvvvvvvvv
'''),
(115, '''
10 kraggttuuttssk...kraggttuutk
11 kraggttuqutsk...kraaggttuk
12 kraggttuuutsk..kraaggttk
13 kraggtttuutsk..kraaggak
14 kraaggttssk...kraaggk
15 kraaggssk.....kraagk
16 kaaggrk......kkk
17 kaggk
18 kkk
''')]
FAN_TIPS = [
(33, '''
11 kk
10 kagkk
9 kaaghkk
8 koagghgkk
8 kvoagghggkk
9 krvoagghggakk
10 krvvoagghggaakk
11 krvvvoagghggaakk
12 krvvvvoagghggaakk
13 krvvvvvoagghggaakk
14 krvvvvvvoagghggaakk
'''),
(48, '''
10 kk
9 kagkk
9 kaaghkk
10 koagghggkk
11 kvoagghggakk
12 krvoagghggaakk
13 krvvoagghggaaakk
14 krvvvoagghggaaakk
15 krvvvvoagghggaaakk
16 krvvvvvoagghggaaakk
17 krvvvvvvoagghggaaakk
'''),
(61, '''
17 kk
16 kagkk
16 kaaghkk
17 koagghggkk
18 kvoagghggakk
19 krvoagghggaakk
20 krvvoagghggaaakk
21 krvvvoagghggaaakk
22 krvvvvoagghggaaakk
23 krvvvvvoagghggaaakk
''')]
ATTACK_FACE = (53, '''
81 kroaagghhhhggkkgggggaaak
82 kroaagghhhgkeekgggggggaak
82 kroaagghhggekehkggggggggaakk
82 kroaagggggeeekgggghhhgggggggaakk
81 kroaaaggggggggghhhhhhggggggaaaaagggkk
80 krvoaaagggggggggggaaaaaggggghhhhgggggaaakk
79 krvvoaaagggggaaaaaagggggggghhhggggaaaaakkk
78 krvvooaaaaaaaaggggggggaaaaaggggaakkkkk
77 krvvoooaaaaaaaaaaagggkkkkkkkk
''')
# A low torso resting on its side. Distinct from the upright/crouched torso.
DEAD_BODY = (83, '''
39 kkkkkkkkkk
35 kkkrrvvooaaggkkk
32 kkrrvvvoooaaaggggakk
29 kkrrvvvvoooaaaggggggaaakk
27 krrvvvvooooaaagghhgggggaaaakk
25 krrvvvvooooaaagghhhgggggaaaaakk
24 krvvvvoooooaaagghhhgggggaaaaaovkk
23 krvvvvoooooaaagghhhgggggaaaaaovvrkk
22 krvvvvoooooaaagghhhgggggaaaaaovvvrrkk
21 krvvvvoooooaaagghhhgggggaaaaaovvvrrsskk
20 krvvvvoooooaaagghhhgggggaaaaaovvvrrssskk
19 krvvvvoooooaaagghhhgggggaaaaaovvvrrssssk
18 krvvvvoooooaaagghhhgggggaaaaaovvvrrssssk
18 krvvvvoooooaaagghhhgggggaaaaaovvvrrssssk
18 krvvvvoooooaaagghhggggggaaaaaovvvrrssssk
18 krvvvvoooooaaagghggggggaaaaaovvvvrrssssk
18 krvvvvoooooaaaggggggggaaaaaovvvvrrssssk
18 krvvvvoooooaaagggggggaaaaovvvvvrrssssk
18 krvvvvoooooaaaggggggaaaovvvvvvrrssssk
18 krvvvvoooooaaagggggaaaovvvvvvvrrssssk
18 krvvvvoooooaaaggggaaaovvvvvvvvrrssssk
19 krvvvvoooooaaagggaaovvvvvvvvvrrssssk
20 krvvvvoooooaaaggaaovvvvvvvvvvrrssssk
21 krvvvvoooooaaagaaovvvvvvvvvvvrrssssk
22 krvvvvoooooaaagaovvvvvvvvvvvvrrssssk
23 krvvvvoooooaaagovvvvvvvvvvvvvrrssssk
24 krvvvvoooooaaagovvvvvvvvvvvvvrrssssk
25 krvvvvoooooaaagovvvvvvvvvvvvvrrssssk
26 krvvvvoooooaaagovvvvvvvvvvvvrrrssssk
27 krvvvvoooooaaagovvvvvvvvvvvrrrssssk
28 krvvvvoooooaaagovvvvvvvvvvrrrssssk
29 krvvvvoooooaaagovvvvvvvvvrrrssssk
30 krvvvvoooooaaagovvvvvvvvrrrssssk
31 krvvvvoooooaaagovvvvvvvrrrssssk
32 krvvvvoooooaaagovvvvvvrrrssssk
33 krvvvvoooooaaagovvvvvrrrssssk
34 krvvvvoooooaaagovvvvrrrssssk
35 krvvvvoooooaaagovvvrrrssssk
36 krvvvvoooooaaagovvrrrssssk
37 krvvvvoooooaaagovrrrssssk
38 krrvvvvvrrrsssssssssssk
39 kkkssssssssssssssskkk
''')
DEAD_HEAD = (96, '''
69 kkkk
68 kroagkk
67 krvoaagkk
66 krvvoaagkk
65 krvvooaagkk
65 krvvoooaagkk
65 krvvooooaaagkk
65 krvvoooooaaaggkk
65 krvvoooooaaaagggkk
66 krvvoooooaaaaggggakk
67 krvvooooaaaagggggaakk
68 krvvoooaaaaggggggaaaakk
69 krvvooaaagghhhgggggaaakk
70 krvooaaagghhhhhgggggaaaakk
71 krooaaagghhhhhhgggggaaaaakk
72 krooaaagghhhhggeeeggggggaaaakk
73 krooaaagghhhggggggghhhgggggaaaakk
74 krooaaagghhggggggghhhggggaaaaagggkk
75 krooaaaggggggggaaaaagggggggggghhhgkk
76 krooaaaaggggaaaaagggggghhhhhgggggaaak
76 krooaaaaaaaagggggggaaaaagggggaaaakkk
75 krvoooooaaaaaaagggggkkkkkkkkkkkk
74 krrvvoooooaaaaaagggk
73 krrrvvoooooaaaaagggk
72 kkrrrvvoooooaaaagk
71 kkssrrvvvoooaaakk
70 kkssrrvvvoooaakk
69 kkkssrrvvvoakk
68 kkkssssrrrkk
''')
DEAD_FEET = (116, '''
60 kbbccbk........kbccbk
60 kbcdccbkk.....kbcdccbkk
61 kbdddccccbkk..kbdddccccbkk
62 kbddddccccccbbkbddddccccccbbkk
63 kbccccddddcccddcccddddcccccddck
64 kbbbccdddcbbccccccdddccbbccdddck
65 kbbbdddcck..kbdddddck..kbddddck
66 kkkkkkkk....kkkkkkk....kkkkkk
''')
DEAD_TAIL = (100, '''
22 kkrvoaaagggkk
19 kkrvvoaaaggggakk
16 kkrvvvoaaagggggaakk
13 kkrvvvvoaaaggggggaaakk
10 krrvvvvoaaaggggggaaovvkk
8 krrvvvvoaaagggggaaovvvrrkk
6 krrvvvvoaaaggggaaovvvvrrssk
5 krrvvvvoaaaggggaovvvvrrsssk
5 krvvvvoaaaggggaovvvrrsssk
6 krvvvoaaaggggaovvrrsssk
7 krvvoaaaggggaovrrsssk
8 krvoaaaggggaovrrsskk
9 kroaaaggggaovrrsskk
10 kraaggggaovrrsskk
11 kraagggaovrrsskk
12 kraaaggaovrrsskk
13 kraaaggaovrrsskk
12 kraaagggaovrrsskk
11 kraaagggaovrrsskk
10 kraaagggatttrsskk..kraaggttuk
9 kraaaggttuuutssk..kraggttuutk
8 kraaaggttuquutsk..kraggttqutk
8 kraaggttuuuutsk....kraggttuk
9 kraaggttttssk......kraaggk
10 kkaaggggkk.........kkagkk
''')

SLEEP_BODY = (77, '''
53 kkkkkkkkk
49 kkrrvoaagggkkk
46 kkrrvoaaggggggakk
43 krrvvoaagghhggggaakk
40 krrvvoaagghhhggggaaakk
38 krrvvoaagghhhhggggaaaakk
36 krrvvoaagghhhhggggaaaaovkk
35 krrvvoaagghhhhggggaaaaovvrkk
34 krrvvoaagghhhhggggaaaaovvvrrkk
33 krrvvoaagghhhhggggaaaaovvvrrssk
32 krrvvoaagghhhhggggaaaaovvvrrsssk
31 krrvvoaagghhhhggggaaaaovvvrrssssk
30 krrvvoaagghhhhggggaaaaovvvrrssssk
29 krrvvoaagghhhhggggaaaaovvvrrssssk
28 krrvvoaagghhhhggggaaaaovvvrrssssk
28 krrvvoaagghhhgggggaaaaovvvrrssssk
28 krrvvoaagghhggggggaaaaovvvrrssssk
28 krrvvoaagghgggggggaaaaovvvrrssssk
28 krrvvoaagggggggggaaaovvvvrrssssk
28 krrvvoaaggggggggaaovvvvvrrssssk
28 krrvvoaagggggggaaovvvvvvrrssssk
28 krrvvoaaggggggaaovvvvvvvrrssssk
29 krrvvoaagggggaaovvvvvvvvrrssssk
30 krrvvoaaggggaaovvvvvvvvvrrssssk
31 krrvvoaagggaaovvvvvvvvvvrrssssk
32 krrvvoaaggaaovvvvvvvvvvvrrssssk
33 krrvvoaagaaovvvvvvvvvvvvrrssssk
34 krrvvoaagaovvvvvvvvvvvvvrrssssk
35 krrvvoaagovvvvvvvvvvvvvvrrssssk
36 krrvvoaagovvvvvvvvvvvvvvrrssssk
37 krrvvoaagovvvvvvvvvvvvvvrrssssk
38 krrvvoaagovvvvvvvvvvvvvvrrssssk
39 krrvvoaagovvvvvvvvvvvvvvrrssssk
40 krrvvoaagovvvvvvvvvvvvvrrrssssk
41 krrvvoaagovvvvvvvvvvvvrrrssssk
42 krrvvoaagovvvvvvvvvvvrrrssssk
43 krrvvoaagovvvvvvvvvvrrrssssk
44 krrvvoaagovvvvvvvvvrrrssssk
45 krrvvoaagovvvvvvvvrrrssssk
46 krrvvoaagovvvvvvvrrrssssk
47 krrvvoaagovvvvvvrrrssssk
48 krrvvoaagovvvvvrrrssssk
49 krrvvoaagovvvvrrrssssk
50 krrvvoaagovvvrrrssssk
51 krrvvoaagovvrrrssssk
52 krrvvoaagovrrrssssk
53 krrvvoaagrrrssssk
54 kkkssssssssskkk
''')
SLEEP_HEAD = (49, '''
68 kk
67 kagk
66 kaagk
65 krahgk
64 kroaghk
63 krvoaghk
62 krvvoaghk...kk
62 krvvoaagk..kagk
62 krvvoaaagkkaghk
63 krvvoaaaaggaghk
63 krvvoaaaaggggk
64 krvooaaaagggk
64 krvoooaaaggk
65 krvooooaaagk
65 kroooaaaaggkk
66 kroooaaggggggkk
67 krooaagghhhggggakk
68 kroaagghhhhgggggaaakk
69 kroaagghhhhgggggggaaak
70 kroaagghhhhggggggggaak
70 kroaagghhgkeeekggggggaakk
70 kroaagggggekgggggghhgggggaakk
69 kroaaaggggggggghhhgggggaaaagkk
68 krvoaaaggggggggggaaaagggghhhggakk
67 krvvoaaagggggaaaagggggghhhgggaak
66 krvvooaaaaaaaagggggaaaaagggakkk
65 krvvoooaaaaaaaaaagggkkkkkk
64 krvvooooaaaaaaaaaak
63 krvvoooooaaaaaaaaaak
62 krvvooooooaaaaaaaaaak
61 krvvoooooooaaaaaaaaak
60 krvvooooooooaaaaaaaak
59 krvvoooooooooaaaaaaak
58 krvvooooooooooaaaaaak
57 krvvoooooooooooaaaak
56 krvvoooooooooooaaaak
55 krvvooooooooovvoaaak
54 krvvoooooooovvvoaaak
53 krvvooooooovvvvoaaak
52 krvvoooooovvvvvoaaak
51 krvvooooovvvvvvoaaak
50 krvvoooovvvvvvvoaaak
49 krvvooovvvvvvvvoaaak
48 krvvoovvvvvvvvvoaaak
47 krvoovvvvvvvvvvoaaak
46 krvoovvvvvvvvvvoaaak
''')
# Squatting bronze feet; low knees and resting toes are not corpse feet.
SLEEP_FEET = (115, '''
66 kbcccbk........kbcccbk
65 kbcdccbk.......kbcdccbk
64 kbdddccbk......kbdddccbk
63 kbddcccbbk.....kbddcccbbk
62 kbddcccccbkk...kbddcccccbkk
61 kbddccddccccbkkkbddccddccccbkk
60 kbcccdddddcccccbcccccddddcccccbkk
59 kbccccddccccddddcccccddccccddddcck
59 kbdddck..kbddddddck..kbdddck.kbddddk
59 kkkkkk...kkkkkkkkk...kkkkkk..kkkkkk
''')
SLEEP_BREATH = (94, '''
61 ooaaagghhhggggaaaaovvvrrssskk
60 oooaaagghhgggggaaaaovvvrrssskk
59 voooaaagghggggggaaaaovvvrrssskk
58 vvoooaaaggggggggaaaaovvvrrssskk
57 vvvoooaaaggggggaaaaovvvvrrssskk
56 vvvvoooaaagggaaaaovvvvvrrrssskk
55 vvvvvoooaaaagaaaovvvvvvrrrssskk
54 vvvvvvoooaaaaaaovvvvvvvrrrssskk
''')
SLEEP_WING = (81, '''
44 kkkkk
41 kkroaagkk
38 kroaaaggggakk
36 kroaaagghhgggakk
34 kroaaagghhhggggakk
32 kroaaagghhhggggaaakk
31 kroaaagghhhggggaaaakk
30 kroaaagghhhggggaaaaovkk
29 kroaaagghhhggggaaaaovvrkk
29 kroaaagghhhgggaaaaovvvrrkk
29 kroaaagghhgggaaaaovvvvrrssk
29 kroaaagghgggaaaaovvvvvrrsssk
29 kroaaagggggaaaaovvvvvvrrsssk
29 kroaaaggggaaaovvvvvvvrrsssk
30 kroaaagggaaovvvvvvvvrrsssk
31 kroaaaggaaovvvvvvvvvrrsssk
32 kroaaaggaovvvvvvvvvrrrsssk
33 kroaaagovvvvvvvvvvrrrsssk
34 kroaaagovvvvvvvvvrrrssssk
35 kroaaagovvvvvvvvrrrsssssk
36 kroaaagovvvvvvvrrrsssssk
37 kroaaagovvvvvvrrrsssssk
38 kroaaagovvvvvrrrsssssk
39 kroaaagovvvvrrrsssssk
40 kroaaagovvvrrrsssssk
41 kroaaagovvrrrsssssk
42 kroaaagovrrrsssssk
43 kroaagorrsssssssk
44 kroaagrrsssssssk
45 kroaagrrsssssssk
46 kroaagrrssssssk
47 kroaagrrsssssk
48 kroaagrrssssk
49 kroaagrrsssk
50 kraagrrssk
51 kraagrrsk
52 kraagrsk
53 kraarsk
54 krrsk
55 kssk
56 kkk
''')

def dead():
    g=canvas()
    for b in [DEAD_TAIL, DEAD_BODY, DEAD_FEET, DEAD_HEAD]: ink(g,b)
    return g

def sleep():
    g=canvas()
    for b in [TAIL_FINAL, SLEEP_BODY, SLEEP_FEET, SLEEP_HEAD, SLEEP_WING]: ink(g,b)
    return g
DEAD_JOIN = (106, '''
55 rrvvoooaaaggggkk
55 rvvoooaaaggggggakk
55 vvoooaaagggggggaakk
55 voooaaaggggggggaaakk
55 oooaaaggggggggaaaovkk
55 ooaaaggggggggaaaovvrkk
55 oaaagggggggaaaovvvrrkk
55 aaaggggggaaaovvvvrrssk
55 aagggggaaaovvvvvrrsssk
55 aggggaaaovvvvvvrrsssk
55 gggaaaovvvvvvvrrsssk
55 ggaaovvvvvvvvrrsssk
55 gaaovvvvvvvvvrrsssk
55 aaovvvvvvvvvvrrsssk
55 aovvvvvvvvvvvrrsssk
55 ovvvvvvvvvvvvrrsssk
56 vvvvvvvvvvvrrsssk
57 rrrrrrrrrrrsssk
58 kkkkkkkkkkkkkk
''')
SLEEP_BREATH_LOCAL = [
(80, '''
44 kkkk
43 kroagkk
40 kkroaagggkk
37 kroaaagggggakk
35 kroaaagghhhggakk
'''),
(104, '''
64 vvvrrrsskk
64 vvvrrrsskk
64 vvvrrrsskk
64 vvrrrsskk
64 vvrrrsskk
64 vvrrrsskk
64 vrrrsskk
64 vrrrsskk
''')]

# Drooping sick face bends down into a tense shoulder; part-open, dull eye.
SICK_HEAD = (34, '''
73 kk
72 kagk
71 kaagk
70 krahgk
69 kroaghk
68 krvoaghk
67 krvvoaghk...kk
67 krvvoaagk..kagk
67 krvvoaaagkkaghk
68 krvvoaaaaggaghk
69 krvvoaaaaggggk
70 krvooaaaagggk
71 krvoooaaaggk
72 krvooooaaagk
73 kroooaaaaggkk
74 kroooaaggggggkk
75 krooaagghhhggggakk
76 kroaagghhhhgggggaaakk
77 kroaagghhhhgkkgggggaaak
78 kroaagghhhgkeekggggggaak
78 kroaagghhggeeekggggggaakk
78 kroaaggggggegkggrrghhgggggaakk
77 kroaaagggggggrrrghhhgggggaaaagkk
76 krvoaaagggggrrrrggaaaagggghhhggakk
75 krvvoaaaggggrrrraaaagggggghhhgggaak
74 krvvooaaaaarrraagggggaaaaagggakkk
73 krvvoooaaarrraagggggkkkkkk
72 krvvooooaarrraaaggk
71 krvvoooooarrraaaaaak
70 krvvooooooarrraaaaaak
69 krvvoooooooarrraaaaak
68 krvvooooooooarrraaaak
67 krvvoooooooooarrraaak
66 krvvooooooooooarrraak
65 krvvoooooooooooarraak
64 krvvoooooooooooarraak
63 krvvooooooooovvoaaak
62 krvvoooooooovvvoaaak
61 krvvooooooovvvvoaaak
60 krvvoooooovvvvvoaaak
59 krvvooooovvvvvvoaaak
58 krvvoooovvvvvvvoaaak
57 krvvooovvvvvvvvoaaak
56 krvvoovvvvvvvvvoaaak
55 krvoovvvvvvvvvvoaaak
54 krvoovvvvvvvvvvoaaak
53 krvoovvvvvvvvvvoaaak
52 krvoovvvvvvvvvvoaaak
''')
SICK_WING_PATCH = (55, '''
25 kroaaagghhhgggaaaovvvvvrrsskk
25 kroaaagghhgggaaaovvvvvvrrsskk
25 kroaaagghgggaaaovvvvvvvrrsskk
25 kroaaagggggaaaovvvvvvvvrrsskk
25 kroaaaggggaaaovvvvvvvvvrrsskk
25 kroaaagggaaovvvvvvvvvvrrsskk
26 kroaaaggaaovvvvvvvvvvvrrsskk
26 kroaaaggaovvvvvvvvvvvrrrsskk
27 kroaaagovvvvvvvvvvvvvrrrsskk
27 kroaaagovvvvvvvvvvvvrrrssskk
28 kroaaagovvvvvvvvvvvvrrrssskk
28 kroaaagovvvvvvvvvvvrrrsssskk
29 kroaaagovvvvvvvvvvvrrrsssskk
29 kroaaagovvvvvvvvvvrrrssssskk
30 kroaaagovvvvvvvvvvrrrssssskk
''')
POISON_A_FX = [
(48, '''
108 pp
107 pqqp
106 pqhqqp
106 pqqqqp
107 pqqp
108 pp
'''),
(67, '''
103 pp
102 pqqp
101 pqhqqp
101 pqqqqp
102 pqqp
103 pp
'''),
(81, '''
93 pp
92 pqqp
92 pqqp
93 pp
''')]
POISON_B_FX = [
(42, '''
114 pp
113 pqqp
112 pqhqqp
112 pqqqqp
113 pqqp
114 pp
'''),
(61, '''
108 ppp
107 pqqqp
106 pqhqqqp
106 pqqqqqp
107 pqqqp
108 ppp
'''),
(77, '''
99 pp
98 pqqp
97 pqhqqp
98 pqqp
99 pp
''')]
SICK_B_FACE = (51, '''
76 kroaagghhhhgggggggaaakk
77 kroaagghhhhggggggggaak
78 kroaagghhhgkeeekggggggaak
78 kroaagghhggeeekgggrrrggaakk
78 kroaaggggggeggggrrrghhgggggaakk
77 kroaaagggggggrrrghhhgggggaaaagkk
76 krvoaaagggggrrrrggaaaagggghhhggakk
75 krvvoaaaggggrrrraaaagggggghhhgggaak
''')
# Stunned head hangs lower than sick, beak and throat oriented into the breast.
STUN_HEAD = (47, '''
65 kk
64 kagk
63 kaagk
62 krahgk
61 kroaghk
60 krvoaghk
59 krvvoaghk...kk
59 krvvoaagk..kagk
59 krvvoaaagkkaghk
60 krvvoaaaaggaghk
61 krvvoaaaaggggk
62 krvooaaaagggk
63 krvoooaaaggk
64 krvooooaaagk
65 kroooaaaaggkk
66 kroooaaggggggkk
67 krooaagghhhggggakk
68 kroaagghhhhgggggaaakk
69 kroaagghhhhgggggggaaak
70 kroaagghhhgkkkggggggaak
71 kroaagghhggeeggggggggaakk
72 kroaaggggggegggggghhgggggaakk
73 kroaaagggggggggghhhgggggaaaagkk
74 krvoaaaggggggggggaaaagggghhhggakk
75 krvvoaaagggggaaaagggggghhhgggaak
76 krvvooaaaaaaaagggggaaaaagggakkk
75 krvvoooaaaaaaaaaagggkkkkkk
74 krvvooooaaaaaaaaaak
73 krvvoooooaaaaaaaaaak
72 krvvooooooaaaaaaaaaak
71 krvvoooooooaaaaaaaaak
70 krvvooooooooaaaaaaaak
69 krvvoooooooooaaaaaaak
68 krvvooooooooooaaaaaak
67 krvvoooooooooooaaaak
66 krvvoooooooooooaaaak
65 krvvooooooooovvoaaak
64 krvvoooooooovvvoaaak
63 krvvooooooovvvvoaaak
62 krvvoooooovvvvvoaaak
61 krvvooooovvvvvvoaaak
60 krvvoooovvvvvvvoaaak
59 krvvooovvvvvvvvoaaak
58 krvvoovvvvvvvvvoaaak
57 krvoovvvvvvvvvvoaaak
56 krvoovvvvvvvvvvoaaak
''')
STUN_STARS_A = [
(35, '''
69 a
68 aga
67 agfga
66 agfffga
67 agfga
68 aga
69 a
'''),
(47, '''
97 a
96 aga
95 agfga
94 agfffga
95 agfga
96 aga
97 a
''')]
STUN_STARS_B = [
(39, '''
84 a
83 aga
82 agfga
81 agfffga
82 agfga
83 aga
84 a
'''),
(59, '''
105 a
104 aga
103 agfga
102 agfffga
103 agfga
104 aga
105 a
''')]
STUN_B_NECK = (77, '''
71 krvvooooooooaaaaaaaak
70 krvvoooooooooaaaaaaak
69 krvvooooooooooaaaaaak
68 krvvoooooooooooaaaak
67 krvvoooooooooooaaaak
66 krvvooooooooovvoaaak
65 krvvoooooooovvvoaaak
64 krvvooooooovvvvoaaak
''')
# Final corrections chosen from the displayed diagnostic coordinates.
# Tense feathers stay inside the wing rather than making an unintended shelf.
SICK_WING_PATCH = (77, '''
41 voaggghhvrrsssk
42 oaggghhvrrsssk
43 aggghhvrrsssk
44 ggghhvrrsssk
45 gghhvrrsssk
46 ghhvrrsssk
47 hhvrrsssk
48 hvrrsssk
''')
SLEEP_BREATH_LOCAL = [
(81, '''
43 kroagkk
40 kkroaagggkk
'''),
(89, '''
35 aagghhhhgggaaaaovv
35 aagghhhgggaaaaovvv
35 aagghhgggaaaaovvvv
36 agghgggaaaaovvvvv
36 agggggaaaaovvvvvv
37 ggggaaaaovvvvvvv
''')]

def build(head=HEAD, wing=WING, legs=LEGS, spread=False, ribs=True):
    g=canvas()
    for block in [BODY,TAIL_FINAL,THIRD_TAIL,legs,BREAST]: ink(g,block)
    if spread: ink(g,SPREAD_BACK)
    ink(g,head); ink(g,wing)
    if wing is WING and ribs: ink(g,WING_RIBS)
    if wing is OPEN_WING: ink(g,OPEN_WING_DETAILS)
    return g

def sleep():
    g=canvas()
    for b in [TAIL_FINAL,THIRD_TAIL,SLEEP_BODY,SLEEP_FEET,SLEEP_HEAD,SLEEP_WING]: ink(g,b)
    return g
# A shallow breathing contour and one feather's settling edge, explicit coordinates.
SLEEP_BREATH_LOCAL += [
(100, '''
58 rrsk
58 rrrsk
59 rrrsk
60 rrrsk
61 rrrsk
62 rrrsk
63 rrrsk
64 rrrsk
65 rrrsk
''')]
STUN_B_SHOULDER = (92, '''
43 kroaagrrkoagghhk
43 kroaagrrkoagghhk
44 kroaagrrkoaggghk
44 kroaagrrkoaggghk
45 kroaagrrkoaggghk
45 kroaagrrkoagghk
46 kroaagrrkoagghk
46 kroaagrrkoagghk
47 kroaagrrkoagghk
47 kroaagrrkoaggk
48 kraagrrkoagk
49 kraagrrkk
50 kraagrkk
51 kkagkk
52 .kkk
''')

def build(head=HEAD,wing=WING,legs=LEGS,spread=False,ribs=True):
    g=canvas()
    for block in [BODY,TAIL_FINAL,THIRD_TAIL,legs,BREAST,BREAST_PLUMES]: ink(g,block)
    if spread: ink(g,SPREAD_BACK)
    ink(g,head);ink(g,wing)
    if wing is WING and ribs:ink(g,WING_RIBS)
    if wing is OPEN_WING:ink(g,OPEN_WING_DETAILS)
    return g
# Keep the first breast feather through inhalation; expand only six outer-edge rows.
IDLE_B_PATCHES = [IDLE_B_PATCHES[0],IDLE_B_PATCHES[2],(73, '''
83 vvrrrsskk
83 vvrrrsskk
83 vvrrrsskk
83 vvrrrsskk
83 vvrrrsskk
83 vvrrrsskk
''')]
# Individually inspected pinholes at feather overlaps / neck joins. No inferred fill.
SEAM_REPAIRS = {
 'idle_a':[(85,'50 k\n51 k')],
 'idle_b':[(85,'50 k\n51 k'),(97,'56 k'),(106,'46 k')],
 'idle_c':[(85,'50 k\n51 k')],
 'windup':[(51,'73 k')],
 'recover':[(51,'73 k'),(85,'50 k\n51 k')],
 'stun_a':[(85,'50 k\n51 k')],
 'stun_b':[(85,'50 k\n51 k')],
 'skill_b':[(55,'102 a')],
 'skill_c':[(51,'73 k'),(85,'50 k\n51 k')],
 'sleep_a':[(79,'44 ss')],
 'sleep_b':[(79,'44 ss')],
}

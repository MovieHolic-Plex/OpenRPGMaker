"""Literal phoenix skill fire, each stage authored at the mouth or wing anchor."""
from pose_clusters import *
CAST_HEAD = (24, '''
68 kk
67 kagk
66 kaagk
65 krahgk
64 kroaghk
63 krvoaghk...kk
62 krvvoaghk.kagk
61 krvvoaagkkaghk
60 krvvoaaaggaghk
60 krvvoaaaaggggk
61 krvooaaaagggk
62 krvoooaaaggk
63 krvooooaaagk
64 kroooaaaaggkk
65 kroooaaggggggkk
66 krooaagghhhggggakk
67 kroaagghhhhgggggaaakk
68 kroaagghhhhgkkgggggaaak
69 kroaagghhhgkeekggggggaak
70 kroaagghhggekehkggggggaakk
71 kroaagggggeeekgggghhggggggaakk
72 kroaaaggggggggghhhhggggggaaaaagkk
73 krvoaaagggggggggggaaaaagggghhhgggakk
74 krvvoaaagggggaaaaaagggggghhhgggaaak
74 krvvooaaaaaaaaggggggaaaaaggggaakkk
73 krvvoooaaaaaaaaaaagggkkkkkkkk
72 krvvooooaaaaaaaaaakkksssskk
71 krvvoooooaaaaaaaaakksreeekkk
70 krvvooooooaaaaaaaakssreeeeesskk
69 krvvoooooooaaaaaakssreeeeeeesskk
68 krvvooooooooaaaakssreeeeeeeesskk
67 krvvoooooooooaaaakssreeeeeesskk
66 krvvooooooooooaaaakssreeesskk
65 krvvoooooooooooaaaakssresskk
64 krvvoooooooooooaaaakssrsskk
63 krvvooooooooovvoaaaakssrsk
62 krvvoooooooovvvoaaaagggak
61 krvvooooooovvvvoaaaagghggkk
60 krvvoooooovvvvvoaaaagghhgggakk
59 krvvooooovvvvvvoaaaagghhhhgggaak
58 krvvoooovvvvvvvoaaaaggghhhhggaak
57 krvvooovvvvvvvvoaaaagggggggaakkk
56 krvvoovvvvvvvvvoaaaaggggaakkk
55 krvoovvvvvvvvvvoaaagkkkkkk
54 krvoovvvvvvvvvvoaaagk
53 krvoovvvvvvvvvvoaaagk
52 krvoovvvvvvvvvvoaaagk
51 krvoovvvvvvvvvvoaaagk
50 krvoovvvvvvvvvvoaaagk
''')
# The upper tongue curls upward, the lower tongue tears downward.
# Both join the open throat (x=88..96, y=52..59), never a circle aura.
FIRE_UPPER = (34, '''
122 r
121 ro
120 rva
119 rvoag
118 rvoagh
117 rvoaghg
116 rvoaghga
115 rvoaghgao
114 rvoaghggaor
113 rvoaghhggaor
112 rvoaghhhggaor
111 rvoagghhhggaor
110 rvoagghhhhggaor
109 rvoagghhhhgggaor
108 rvoagghhhhgggaor
107 rvoagghhhhhgggaor
106 rvoagghhhhhgggaor
105 rvoagghhhhhhgggaor
104 rvoagghhhhhhgggaor
103 rvoagghhhhhhgggaor
102 rvoagghhhhhhgggaor
101 rvoagghhhhhhgggaor
100 rvoagghhhhhhgggaor
99 rvoagghhhhhgggaor
98 rvoagghhhhhhgggaor
97 rvoagghhhhhhgggaor
96 rvoagghhhhhhgggaor
95 rvoagghhhhhhgggaor
94 rvoagghhhhhhgggaor
93 rvoagghhhhhhgggaor
92 rvoagghhhhhgggaor
91 rvoagghhhhgggaor
90 rvoagghhhgggaor
89 rvoagghhgggaor
88 rvoagghgggaor
87 rvoaggggaor
88 rvoaggaor
89 rvoagor
90 rvaor
91 ror
92 rr
''')
FIRE_LOWER = (53, '''
92 rvvaaggg
92 rvvoagggg
92 rvvoaghhgg
93 rvvoaghhhgg
94 rvvoaghhhhgg
95 rvvoaghhhhhgg
96 rvvoagghhhhhgg
97 rvvoagghhhhhhgg
98 rvvoagghhhhhhgg
99 rvvoagghhhhhhgg
100 rvvoagghhhhhhgg
101 rvvoagghhhhhhgg
102 rvvoagghhhhhhgg
103 rvvoagghhhhhhgg
104 rvvoagghhhhhhgg
105 rvvoagghhhhhhgg
106 rvvoagghhhhhhgg
107 rvvoagghhhhhhgg
108 rvvoagghhhhhhgg
109 rvvoagghhhhhhgg
110 rvvoagghhhhhgg
111 rvvoagghhhhgg
112 rvvoagghhhgg
113 rvvoagghhgg
114 rvvoagghgg
115 rvvoagggg
116 rvvoagga
117 rvvoaga
118 rvvoag
119 rvvoa
119 rvvo
119 rvv
118 rvv
117 rvva
116 rvvaag
115 rvvaagg
114 rvvaaggh
115 rvvaagg
116 rvvaag
117 rvva
118 rvv
119 rv
120 r
''')
FIRE_CORE = (51, '''
91 agghhfhhgga
90 agghhfffhhgga
89 agghhffffhhgga
88 agghhfffffhhgga
87 agghhfffffhhgga
87 agghhfffffhhgga
88 agghhffffhhgga
89 agghhfffhhgga
90 agghhfhhgga
91 agghhhgga
''')
# Gold-white charge nestled under the far wing, physically overlaps the feathers.
CHARGE = (71, '''
68 ga
67 ggha
66 aghhga
65 aghfhga
64 aghfffhga
63 aghfffffhga
62 aghfffffffhga
62 aghfffffffhga
63 aghfffffhga
64 aghfffhga
65 aghfhga
66 aghhga
67 agga
68 aa
''')
CHARGE_STREAM = (57, '''
77 ag
77 agh
77 aghg
76 aaghg
76 aaghg
75 aaghg
75 aaghg
74 aaghg
74 aaghg
73 aaghg
73 aaghg
72 aaghg
72 aaghg
71 aaghg
71 aaghg
70 aaghg
70 aagg
69 aagg
68 aag
''')
PREP_MOUTH = (32, '''
72 krvooaagggekehkggghhgggaakk
72 krvooaagggeekggghhhgggaaaggkk
73 krvooaaggggggghhhgggaaaagggggkk
74 krvoaaagggggggggaaaaggghhhhgggaakk
75 krvoaaaggggaaaaaggghhhhhgggaaak
75 krvooaaaaaaaagggggaaaaaaakkk
75 krvoooaaaaaaaaggggkkssk
75 krvooooaaaaaaaagggksssk
74 krvoooooaaaaaaaaaksssk
74 krvooooooaaaaaaaagggak
73 krvoooooooaaaaaaggggk
''')
RECOVERY_MOUTH = (41, '''
75 kroaagghhhgkkggggaaak
75 kroaagghhgkeekggggaaak
75 kroaagggggekehkgggggggakk
75 kroaaagggeekgggghhhgggggakk
76 kroaaaggggggghhhgggaaaagggkk
77 kroaaaaggggggggaaaaggghhhgggakk
78 kroaaaaggggaaaaagggggghhgggaak
78 krvooaaaaaaaagggggaaaaaakkkk
77 krvvooaaaaaaaagggkkkkkk
76 krvvoooaaaaaaaagkssk
75 krvvooooaaaaaaaaksssk
74 krvvoooooaaaaaaaagggk
''')
EMBERS = [
(50, '''
107 v
106 vo
106 vag
105 vagha
105 vaghga
106 vagga
107 voa
108 v
'''),
(70, '''
117 v
116 vo
115 vag
114 vagha
114 vaghga
115 vagga
116 voa
117 v
'''),
(89, '''
102 v
101 vo
100 vag
100 vagha
101 vagga
102 voa
103 v
''')]

def skill_prep():
    g=build(head=HEAD,wing=WINDUP_WING)
    ink(g,PREP_MOUTH)
    ink(g,CHARGE_STREAM)
    ink(g,CHARGE)
    return g

def skill_cast():
    g=build(head=CAST_HEAD,wing=OPEN_WING,legs=STEP_LEGS,spread=True)
    for b in FAN_TIPS: ink(g,b)
    for b in [FIRE_UPPER,FIRE_LOWER,FIRE_CORE]: ink(g,b)
    return g

def skill_recover():
    g=build(head=WINDUP_HEAD,wing=WING)
    ink(g,RECOVERY_MOUTH)
    for b in EMBERS: ink(g,b)
    return g
# Red-gold fire planes were broadened after opening the white-dominant first cast.
FIRE_UPPER = (34, '''
121 r
120 rv
120 rvo
119 rvoa
118 rvoag
118 rvoagh
117 rvvoagh
116 rvvvoaghg
115 rvvvoaghga
114 rvvvoaghhgao
114 rvvvoaghhgga
113 rvvvoagghhgga
112 rvvvoaagghhgga
111 rvvvoaaagghhgga
110 rvvvoaaagghhgga
109 rvvvoaaagghhgga
108 rvvvoaaaagghhgga
107 rvvvoaaaagghhgga
106 rvvvoaaaagghhggao
105 rvvvoaaaagghhggaor
104 rvvvoaaaagghhggaor
103 rvvvoaaaagghhggaor
102 rvvvoaaaagghhggaor
101 rvvvoaaaagghhggaor
100 rvvvoaaaagghhggaor
99 rvvvoaaaagghhggaor
98 rvvvoaaaagghhggaor
97 rvvvoaaagghhggaor
96 rvvvoaagghhggaor
95 rvvvoagghhggaor
94 rvvvoaghhggaor
93 rvvvoaghggaor
92 rvvvoaggggaor
91 rvvvoagggaor
90 rvvvoaggaor
89 rvvvoaggor
88 rvvvoagor
89 rvvvoaor
90 rvvvoor
91 rvvoor
92 rvvor
''')
FIRE_LOWER = (53, '''
92 rvvaaggg
92 rvvoagggg
92 rvvvoaghgg
93 rvvvoaghhgg
94 rvvvvoaghhhgg
95 rvvvvoaghhhhgg
96 rvvvvoagghhhhgg
97 rvvvvoagghhhhhgg
98 rvvvvoagghhhhhgg
99 rvvvvoaagghhhhgg
100 rvvvvoaaagghhhgg
101 rvvvvoaaaagghhgg
102 rvvvvoaaaagghhgg
103 rvvvvoaaaagghhgg
104 rvvvvoaaaagghhgg
105 rvvvvoaaaagghhgg
106 rvvvvoaaaagghhgg
107 rvvvvoaaagghhgg
108 rvvvvoaaagghhgg
109 rvvvvoaaagghhgg
110 rvvvvoaagghhgg
111 rvvvvoagghhgg
112 rvvvvoaghhgg
113 rvvvvoaghgg
114 rvvvvoaggg
115 rvvvvoagg
116 rvvvvoag
117 rvvvvoa
118 rvvvvo
119 rvvvv
119 rvvv
119 rvv
118 rvv
117 rvva
116 rvvaag
115 rvvaagg
114 rvvaaggh
115 rvvaagg
116 rvvaag
117 rvva
118 rvv
119 rv
120 r
''')

"""Oxide-jade sting: actual telson gathers a violet nucleus, emits two unequal poison forks,
then folds, leaving three separate droplets. Literal native strings only."""
from status_pixels import *
PREP_TIP = '''
34 40 KGRROK
35 40 KROEEOK
36 40 KROEEEOK
37 40 KNRVPFPVK
38 41 KNRPFFPVK
39 42 KNRPFPPVK
40 43 KNRPPPVK
41 44 KNRPVVK
42 45 KNRVVK
43 46 KNVK
44 47 KVK
45 48 VK
46 49 V
'''
CAST_TIP = '''
23 34 .....................................
24 34 .....................................
25 34 .....................................
26 34 .....................................
27 34 .....................................
28 34 .....................................
29 34 .....................................
30 34 .....................................
31 34 .....................................
32 34 .....................................
33 34 .....................................
34 34 .....................................
35 34 .....................................
36 34 .....................................
37 34 .....................................
38 34 .....................................
39 34 .....................................
40 34 .....................................
41 34 .....................................
42 34 .....................................
43 34 .....................................
44 34 .....................................
23 34 KLJTGK
24 34 KLJJTGK
25 35 KLJJTGK
26 36 KLJJTGK
27 37 KJJJTGK
28 38 KJJTTGK
29 39 KGGGGK
30 40 KGGYYGK
31 41 KGGYWHGK
32 42 KGYWHLJGK
33 43 KGYWHLLJGK
34 44 KGYWHLLJJGK
35 45 KGGYLLJJTGKK
36 46 KBGGYYYGGGRROKK
37 47 KBBGGGRROEEEEEOOK
38 49 KNRROEEEEEEOOOOK
39 51 KNRROOOOVPFFPVVK
40 53 KNRROOOVPFFPVVK
41 55 KNRROOVPPPVVK
42 57 KNRROOVPVVK
43 60 KNRROVVK
44 63 KNRVVK
45 66 KNVK
'''
# Upper poison fork has a thin central filament, serrated mist fans and a hooked terminal.
# Lower fork spreads into a heavier descending vapor tongue with its own bright vein.
CAST_POISON = '''
17 118 VP
18 115 VPPFV
19 111 VPPFFFPV
20 107 VPPFFFFFPPV
21 103 VPPFFFPPPPPFFPV
22 100 VPPFFPPPV..VPPFFPV
23 97 VPPFFPPV....VPPFFPV
24 94 VPPFFPPV......VPPFFPV
25 91 VPPFFPPV........VPPFPV
26 89 VPPFFPPV..........VPPV
27 87 VPPFFPPV............VV
28 85 VPPFFPPV
29 83 VPPFFPPV
30 81 VPPFFPPV
31 79 VPPFFPPV
32 78 VPPFFPPPV
33 77 VPPFFPPPPV
34 76 VPPFFPPPV
35 75 VPPFFPPV
36 74 VPPFFPPV
37 73 VPPFFPPV
38 72 VPPFFPPV
39 71 VPPFFPPV
40 70 VPPFFPPV
41 69 VPPFFPPV
42 67 VPPFFFFPPV
43 67 VPPFFFFFPPV
44 68 VPPFFPPFFPPV
45 69 VPPFFPPPFFPPV
46 70 VPPPPPVPPFFPPV
47 72 VPPPV.VPPFFPPPV
48 74 VV....VPPFFPPPPV
49 80 VPPFFPPPPPV
50 82 VPPFFPPPPPPV
51 84 VPPFFPPPPPPPV
52 86 VPPFFPPPPPPPPV
53 88 VPPFFPPPPPPPPPV
54 90 VPPFFPPPPPPPPPPV
55 92 VPPFFPPPPPPPPPPPV
56 94 VPPFFPPPPPPPPPPPPV
57 96 VPPFFPPPPPPPPPPPPPV
58 98 VPPFFPPPPPPPPPPPPPPV
59 100 VPPFFPPPPPVPPPPPPPPPV
60 102 VPPFFPPPPV.VPPPPPPPPV
61 104 VPPFFPPPV...VPPPPPPPV
62 106 VPPFFPPV...VPPPPPV
63 108 VPPFFPV....VPPPPV
64 110 VPPFPV...VPPPV
65 112 VPPV.....VPPV
66 113 VV.......VV
'''
THREE_DROPS = '''
54 77 V
55 77 VP
56 76 VPFV
57 75 VPPFPV
58 75 VPFFPV
59 75 VPPPPV
60 76 VPPPV
61 77 VVV
70 94 V
71 94 VP
72 93 VPFV
73 92 VPPFPV
74 91 VPPFFPV
75 91 VPFFPPV
76 92 VPPPPV
77 93 VPPV
78 94 VV
79 59 VP
80 60 VP
81 60 VPFV
82 59 VPPFPV
83 58 VPPFFPV
84 58 VPFFPPV
85 58 VPPPPPV
86 59 VPPPPV
87 60 VPPV
88 61 VV
'''

def make_skill():
    a=compose(near=WIND_CLAW)
    paint(a,PREP_TIP);paint(a,WIND_LEG_PATCH)
    paint(a,'''85 74 GBNNNOJJJJJGK
86 74 GBNEROJJJJJYGK
87 75 GBNNROJJJJJYGK''')
    save('skill_a',a,True)
    a=compose(near=MOVE_CLAW,head=FORWARD_HEAD)
    paint(a,LUNGE_BODY_PATCH);paint(a,FORWARD_HEAD);paint(a,MOVE_CLAW)
    paint(a,CAST_TIP);paint(a,CAST_POISON)
    save('skill_b',a,True)
    a=compose(tail=TAIL_REST,head=LOW_HEAD,near=RECOVER_CLAW)
    paint(a,THREE_DROPS)
    paint(a,'''92 76 GBNNNNJJJJJGK
93 77 GBNNROJJJJJYGK
94 78 GBNNNOJJJJJYGK''')
    save('skill_c',a,True)

if __name__=='__main__':make_skill()

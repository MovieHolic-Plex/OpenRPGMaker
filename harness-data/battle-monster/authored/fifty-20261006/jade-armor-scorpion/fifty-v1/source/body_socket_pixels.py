"""Literal native pixel repairs. Each pose has its own chosen row spans.
No generated geometry, automatic propagation, whole-frame transforms or gap filling.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def edit(group,name,block):
    p=ROOT/group/(name+'.pxgrid')
    rows=p.read_text().splitlines()
    for line in block.strip().splitlines():
        y,x,ink=line.split();y=int(y);x=int(x)
        if len(rows)!=128 or not 0<x or x+len(ink)>127:raise ValueError((name,line))
        rows[y]=rows[y][:x]+ink+rows[y][x+len(ink):]
    p.write_text('\n'.join(rows)+'\n')

# Two new forward support sockets are on the abdomen, below the head and claw arms.
# The shadowed far thigh is separated from the bright near thigh by dark overlap.
edit('poses','idle_a','''
95 54 KBSTTBK
96 54 KBGTTTBK
97 55 KSTLJTTBK
98 57 KSTLLJTTBK
99 59 KSTLLJJTTBK
100 61 KSTLLJJTTBK
101 63 KSTLLJJTTBK
102 65 KSTLLJJTTBK
103 67 KSTLJJTTBK
104 69 KSTLJJTTBK
105 71 KGGYGTTBK
106 73 KGYYGTTBK
107 75 KSTLJTTBK
108 77 KSTLJTTBK
109 79 KSTLJTTBK
110 81 KSTLJTTBK
111 83 KSTLJTTBK
112 85 KSTLJTTBK
113 87 KSTLJTTBK
113 104 ..................
114 89 KSTLJTTBK
114 104 ..................
115 78 ....................
115 91 KSTLJTTBK
116 79 ....................
116 93 KSTLJTTBK
117 80 .......................
117 95 KGGGTBK
118 81 .........................
118 95 KGYYGBK
119 81 ............................
119 94 KJTTTBGK
120 81 ..............................
120 93 KJTTTBGGK
121 80 ................................
121 92 KBBBBBBBK
122 79 ...................
123 79 ...................
99 50 KBGYJTTTBK
100 51 KTHLLJJTTBK
101 53 KTHHLLJJTTBK
102 55 KTHHLLJJTTBK
103 57 KTHHLLJJTTBK
104 59 KTHLLLJJTTBK
105 61 KTHLLLJJTTBK
106 63 KTHLLJJTTBK
107 65 KTHLLJJTTBK
108 67 KGGYYGTTBK
109 67 KGYYYGTTBK
110 68 KLLJJTTTBK
111 70 KLLJJTTTBK
112 72 KLLJJTTTBK
113 74 KLLJJTTTBK
114 76 KLLJJTTTBK
115 78 KLLJJTTTBK
116 80 KLLJJTTTBK
117 82 KLLJJTTTBK
118 84 KLLJJTTTBK
119 86 KLLJJTTTBK
120 88 KGGYYGTTBK
121 89 KGYYYGGTTBK
122 88 KJTTTTTTBGK
123 87 KJJTTTTTTBGGK
124 86 KKKBBBBBBBBBKK
''')
# Native viewing exposed leftover old distal pixels and excessive palm/leg overlap.
# Lift the palm's lower gold rim with new shorter rows, without changing its fingers.
edit('poses','idle_a','''
99 66 KGGYYLLLJJJJJJTTTTTTTTTTTTTTTBBGK
100 67 KBGYYYYJJJJJJTTTTTTTTTTTTTTTTBBBGK
101 68 KBGGYYYYGGJJJJTTTTTTTTTTTTTTTTBBBBGK
102 69 KBBBBYYYYYGGJJTTTTTTTTTTTTTTTTBBBKGYHLLJJTTTTBBK
103 71 KBBBBBGYYYYYYYYGGGTTTTTTTTTTBBKGYHLLJJTTTTBBK
104 73 KKKBBBBBBBBBYYYYYYGGGGTTTTBKGYHLLJJTTTTBBK
105 76 KKKBBBBBBBBBBBBBBBBBBBBGYHLLJJTTTTBBK
106 79 .................KGLLJJTTTTBBBK
107 81 .................KGJJTTTBBBBBK
108 83 ...............KBGTTTBBBBBK
109 85 .............KBBGGGBBBBK
110 70 .........................................................
111 70 .........................................................
112 70 .........................................................
113 70 .........................................................
114 70 .........................................................
115 70 .........................................................
116 70 .........................................................
117 70 .........................................................
118 70 .........................................................
119 70 .........................................................
120 70 .........................................................
121 70 .........................................................
122 70 .........................................................
123 70 .........................................................
124 70 .........................................................
101 63 KSTLLJJTTBK
102 65 KSTLLJJTTBK
103 67 KSTLJJTTBK
104 69 KSTLJJTTBK
105 71 KGGYGTTBK
106 73 KGYYGTTBK
107 75 KSTLJTTBK
108 77 KSTLJTTBK
109 79 KSTLJTTBK
110 81 KSTLJTTBK
111 83 KSTLJTTBK
112 85 KSTLJTTBK
113 87 KSTLJTTBK
114 89 KSTLJTTBK
115 91 KSTLJTTBK
116 93 KSTLJTTBK
117 95 KGGGTBK
118 95 KGYYGBK
119 94 KJTTTBGK
120 93 KJTTTBGGK
121 92 KBBBBBBBK
101 53 KTHHLLJJTTBK
102 55 KTHHLLJJTTBK
103 57 KTHHLLJJTTBK
104 59 KTHLLLJJTTBK
105 61 KTHLLLJJTTBK
106 63 KTHLLJJTTBK
107 65 KTHLLJJTTBK
108 67 KGGYYGTTBK
109 67 KGYYYGTTBK
110 68 KLLJJTTTBK
111 70 KLLJJTTTBK
112 72 KLLJJTTTBK
113 74 KLLJJTTTBK
114 76 KLLJJTTTBK
115 78 KLLJJTTTBK
116 80 KLLJJTTTBK
117 82 KLLJJTTTBK
118 84 KLLJJTTTBK
119 86 KLLJJTTTBK
120 88 KGGYYGTTBK
121 89 KGYYYGGTTBK
122 88 KJTTTTTTBGK
123 87 KJJTTTTTTBGGK
124 86 KKKBBBBBBBBBKK
''')
edit('poses','idle_a','''
107 75 KSTLJTTBK
108 77 .KSTLJTTBK
109 79 ..KSTLJTTBK
110 70 .........................................................
111 70 .........................................................
112 70 .........................................................
113 70 .........................................................
114 70 .........................................................
115 70 .........................................................
116 70 .........................................................
117 70 .........................................................
118 70 .........................................................
119 70 .........................................................
120 70 .........................................................
121 70 .........................................................
122 70 .........................................................
123 70 .........................................................
124 70 .........................................................
110 84 KSTLJTTBK
111 87 KSTLJTTBK
112 90 KSTLJTTBK
113 93 KSTLJTTBK
114 96 KSTLJTTBK
115 99 KSTLJTTBK
116 102 KSTLJTTBK
117 105 KGGGTBK
118 105 KGYYGBK
119 104 KJTTTBGK
120 103 KJTTTBGGK
121 102 KBBBBBBBK
110 68 KLLJJTTTBK
111 70 KLLJJTTTBK
112 72 KLLJJTTTBK
113 74 KLLJJTTTBK
114 76 KLLJJTTTBK
115 78 KLLJJTTTBK
116 80 KLLJJTTTBK
117 82 KLLJJTTTBK
118 84 KLLJJTTTBK
119 86 KLLJJTTTBK
120 88 KGGYYGTTBK
121 89 KGYYYGGTTBK
122 88 KJTTTTTTBGK
123 87 KJJTTTTTTBGGK
124 86 KKKBBBBBBBBBKK
''')

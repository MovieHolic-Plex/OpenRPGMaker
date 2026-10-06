"""Corrections identified by opening native/zoom PNGs. Each affected pose has its own
chosen row spans; no contour fill, connected-component repair, or patch propagation."""
from author_pixels import ROOT,paint,save

def correct(name,block,action=False):
    p=ROOT/('actions' if action else 'poses')/(name+'.pxgrid')
    g=[list(r) for r in p.read_text().splitlines()]
    paint(g,block);save(name,g,action)

def corrections():
    # Breathing upper shell had cut the root: retain a real gold/jade collar, in this pose only.
    correct('sleep_b','''85 26 KGGYYLJJTTTBK
86 29 GYYJJTT''',True)
    # Each staggered/crouched rear foot is redrawn at its own native placement.
    correct('windup','''101 8 KJJTBK
102 7 KJJTBK
103 7 KJJTBK
104 7 KJJTBK
105 7 KJJTBK
106 7 KGGGBK
107 6 KGYYGBK
108 5 KJTTTBGK
109 4 KJTTTBGGK
110 3 KBBBBBBBK
111 10 ...
112 10 .....
113 10 .....
114 10 .....''')
    correct('hit','''102 8 KJJTBK
103 8 KJJTBK
104 8 KJJTBK
105 8 KJJTBK
106 8 KGGGBK
107 7 KGYYGBK
108 6 KJTTTBGK
109 5 KJTTTBGGK
110 4 KBBBBBBBK
111 10 ...
112 10 .....
113 10 .....
114 10 .....''')
    correct('skill_a','''101 8 KJJTBK
102 8 KJJTBK
103 7 KJJTBK
104 7 KJJTBK
105 6 KJJTBK
106 6 KGGGBK
107 5 KGYYGBK
108 4 KJTTTBGK
109 3 KJTTTBGGK
110 2 KBBBBBBBK
111 10 ...
112 10 .....
113 10 .....
114 10 .....''',True)

if __name__=='__main__':corrections()

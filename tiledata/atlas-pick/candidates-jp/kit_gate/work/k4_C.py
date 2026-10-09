"""후보 C — 실루엣 재해석: 12px 폭 육중한 몸통, 밝은 하늘색 계열 유리 판넬, 옅은 그림자 한 줄."""
from k4_gen import *
M = lambda n: ('mmetal', n); C = lambda n: ('mconc', n); W = lambda n: ('mwhite', n); PV = lambda n: ('mpave', n); GN = lambda n: ('mgran', n)
build('k4-C', dict(x0=2, x1=13, body=W(0), hi=W(1), lo=C(2), edge=C(1), top=(W(4), W(3), W(1)), lip=W(2), shadow=1, fshadow=1,
    floor=(GN(5), GN(4)), joint=GN(3), specks=[(3, 2), (10, 3), (5, 12), (13, 11)], speck=GN(3), wingsh=False, wing=2, fpan=W(1)))

"""후보 B — 어둡고 무거운 몸통 + 짙은 그림자(그림자 3줄, 앞 발치 그림자 2줄)."""
from k4_gen import *
M = lambda n: ('mmetal', n); C = lambda n: ('mconc', n); W = lambda n: ('mwhite', n); PV = lambda n: ('mpave', n)
build('k4-B', dict(x0=2, x1=13, body=M(3), hi=M(4), lo=M(1), edge=('mmetal', 0), top=(W(2), W(1), C(4)), lip=M(6), shadow=2, fshadow=2,
    floor=(PV(4), PV(3)), joint=PV(1), specks=[(2, 3), (11, 2), (4, 11), (12, 12)], speck=PV(2), wingsh=True, wing=3, fpan=C(3)))

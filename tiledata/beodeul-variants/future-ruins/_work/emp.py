import sys; sys.path.insert(0,'.')
sys.argv=['x']
import make_future_ruins as F
e=F.s.empty(); g=F.s.walk_grid()
for y in range(F.H):
    print('%2d '%y+''.join(('#' if not g[y,x] else ('.' if e[y,x] else 'o')) for x in range(F.W)))

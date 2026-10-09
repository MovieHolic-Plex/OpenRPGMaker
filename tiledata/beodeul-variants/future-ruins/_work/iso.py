import sys; sys.path.insert(0,'.')
import make_future_ruins as F
g=F.s.walk_grid(); seen=F.s.bfs((0,21))
print([(x,y) for y in range(F.H) for x in range(F.W) if g[y,x] and (x,y) not in seen])
e=F.s.empty()
for y in range(22,40): print('%2d '%y+''.join(('#' if not g[y,x] else ('.' if e[y,x] else 'o')) for x in range(0,32)))

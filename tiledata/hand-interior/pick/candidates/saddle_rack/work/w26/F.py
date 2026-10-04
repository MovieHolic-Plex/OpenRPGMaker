import sys; sys.path.insert(0, '.')
from lib import *
# F: 벽 쪽 세로 기둥 + 튀어나온 가로 팔에 안장이 걸린 옆모습. 늘어진 가죽 날개와 등자 고리
c = Cv(16, 32)
def S(y,x0,x1,r,st):
    for x in range(x0,x1+1): c.put(x,y,r,st)
# 세로 기둥 + 받침발
for y in range(12,32):
    c.put(0,y,'dwood',5); c.put(1,y,'dwood',4); c.put(2,y,'dwood',2)
for y in (29,30,31):
    S(y,0,6,'dwood',4 if y<31 else 2)
# 가로 팔 (나무)
S(19,2,15,'wood',6); S(20,2,15,'wood',5); S(21,2,15,'wood',3)
c.put(2,22,'wood',2); c.put(3,22,'wood',2)
# 안장 옆모습: 왼쪽(기둥 쪽) 높은 안교, 오른쪽 낮게 솟은 안두
rows = [
 '...ooo..........',
 '..oPPPo.........',
 '..oPpppo.....oo.',
 '..oPpppo....oPPo',
 '..oPppppo..oPppo',
 '..oPpppppooPpppo',
 '..oPppppppppppqo',
 '..oPpppppppppqqo',
 '...oPppppppqqqo.',
 '...oqqqqqqqqqqo.',
]
pal = {'o':1,'P':6,'p':5,'q':3}
for i,r in enumerate(rows):
    for x,ch in enumerate(r):
        if ch in pal: c.put(x,9+i,'clay',pal[ch])
for x in range(6,11): c.put(x,13,'clay',6)
# 팔 밑으로 늘어진 가죽 날개
for y in range(22,26):
    S(y,6,12,'clay',3 if y<25 else 2)
S(22,6,12,'clay',4)
for x in range(7,12,2): c.put(x,23,'linen',3)
# 등자끈 + 등자 (철 고리)
for y in range(25,28): c.put(9,y,'clay',3); c.put(10,y,'clay',2)
S(28,7,12,'iron',5); S(29,7,7,'iron',4); S(29,12,12,'iron',3)
S(30,7,12,'iron',3); c.put(7,29,'iron',5); c.put(12,29,'iron',3)
c.outline(1,1)
open('../../w26-F.pxg','w').write(c.dump('',''))

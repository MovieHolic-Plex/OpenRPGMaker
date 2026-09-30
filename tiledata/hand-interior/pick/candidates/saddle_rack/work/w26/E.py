import sys; sys.path.insert(0, '.')
from lib import *
# E: 톱질 모탕(A자 다리 + 굵은 가로 나무) 위 빨간 안장 담요 + 밝은 가죽 안장, 양옆 등자가 늘어짐
c = Cv(16, 32)
def S(y,x0,x1,r,st):
    for x in range(x0,x1+1): c.put(x,y,r,st)
# 모탕: 가로 통나무
S(20,0,15,'wood',6); S(21,0,15,'wood',5); S(22,0,15,'wood',3); S(23,0,15,'wood',2)
# A자 다리(왼/오른)
for i,y in enumerate(range(24,32)):
    x=2+ (i//3); c.put(x,y,'dwood',4); c.put(x+1,y,'dwood',3); c.put(x+2,y,'dwood',1)
    x=13-(i//3); c.put(x,y,'dwood',4); c.put(x-1,y,'dwood',5); c.put(x-2,y,'dwood',2)
S(28,4,11,'dwood',2)  # 가로대
# 담요 (빨강, 양쪽으로 늘어짐)
S(17,1,14,'red',3); S(18,0,15,'red',4); S(19,0,15,'red',2)
S(17,2,13,'red',5)
# 안장 (옆모습): 왼쪽 낮은 안두, 오른쪽 높은 안교, 가운데 오목
rows = [
 '..........ooo...',
 '.........oPPPo..',
 '..oo.....oPppqo.',
 '.oPPo....oPpppqo',
 '.oPppo..oPppppqo',
 '.oPpppoPPpppppqo',
 '.oPppppppppppqqo',
 'oPPpppppppppqqqo',
 'oPppppppppqqqqo.',
 'oqqqqqqqqqqqqqo.',
]
pal = {'o':(1,),'P':(6,),'p':(5,),'q':(3,)}
for i,r in enumerate(rows[1:]):
    for x,ch in enumerate(r):
        if ch in pal: c.put(x,8+i,'clay',pal[ch][0])
# 앉는 면 밝은 결
for x in range(7,10): c.put(x,11,'clay',6)
# 스티치
for x in range(3,12,2): c.put(x,16,'linen',3)
c.outline(1,1)
# 끈 아래 등자 고리 (모탕 밑으로 삐침)
for y in range(21,26): c.put(1,y,"iron",4); c.put(0,y,"iron",5)
open('../../w26-E.pxg','w').write(c.dump('',''))

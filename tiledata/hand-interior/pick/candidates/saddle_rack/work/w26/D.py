import sys; sys.path.insert(0, '.')
from lib import *
c = Cv(16, 32)
def S(y, x0, x1, r, st):
    for x in range(x0, x1+1): c.put(x, y, r, st)
def stand():
    # 두 기둥 + 윗판(안장 받침) + 발
    for y in range(19, 32):
        S(y, 1, 3, 'dwood', 4); c.put(1,y,'dwood',5); c.put(3,y,'dwood',2)
        S(y, 12, 14, 'dwood', 4); c.put(12,y,'dwood',5); c.put(14,y,'dwood',2)
    S(19, 0, 15, 'wood', 6); S(20, 0, 15, 'wood', 4); S(21, 0, 15, 'wood', 2)
    S(31, 0, 4, 'dwood', 2); S(31, 11, 15, 'dwood', 2)
stand()
# 안장: 안두(왼, 좁고 높은 뿔) 안교(오른, 낮고 넓게 말림)
L = 'clay'
rows = {
 9:  '..oo............',
 10: '.oPPo...........',
 11: '.oPpo......ooo..',
 12: '.oPppo....oPPpo.',
 13: '.oPpppo..oPPpppo',
 14: '.oPppppoooPppppo',
}
pal = {'o':(L,1),'P':(L,6),'p':(L,5),'q':(L,4)}
for y,r in rows.items():
    for x,ch in enumerate(r):
        if ch in pal: c.put(x,y,*pal[ch])
# 앉는 면: 오목 + 밝은 결
for x in range(7,10): c.put(x,13,L,6)
for x in range(6,10): c.put(x,14,L,6)
S(14,1,1,L,1); S(14,15,15,L,1)
# 봉제선
S(15, 1, 15, L, 5)
S(15, 1, 1, L, 1); S(15,15,15,L,1)
# 날개
S(16, 1, 15, L, 4); S(17, 1, 15, L, 3); S(18, 1, 15, L, 3)
for x in range(2, 15): c.put(x, 16, L, 5)
for x in range(3, 15, 2): c.put(x, 17, 'linen', 3)   # 스티치
# 등자 (기둥 사이)
c.put(8, 19, L, 2)   # 안장 밑 끈 (윗판 위이므로 판 앞으로)
for y in range(19, 24): c.put(7, y, L, 3); c.put(8, y, L, 2)
S(22, 5, 10, 'iron', 5)
for y in range(23, 27): c.put(5, y, 'iron', 5); c.put(6,y,'iron',4); c.put(9, y, 'iron', 3); c.put(10, y, 'iron', 2)
S(27, 5, 10, 'iron', 3)
S(28, 5, 10, 'iron', 1)
c.put(5,22,'iron',6); c.put(6,22,'iron',6)
# 리벳
c.put(4, 16, 'brass', 5); c.put(11, 16, 'brass', 5)
c.outline(1, 1, skip=())
c.put(0,19,'wood',6)
open('../../w26-D.pxg','w').write(c.dump('',''))

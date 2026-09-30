from pt import *
cv=canvas(32,32)
put(cv,0,7,gable(6,BLUE,4,doors=[(4,2)],wins=[(1,1,2)],shade=True))
put(cv,13,4,gable(5,RED,5,doors=[(3,2)],wins=[(1,1,2)],shade=True))
pier(cv,0,19,21,[2,8,14,18])
rect=lambda x0,y0,x1,y1,c:[cv[y].__setitem__(x,c) for y in range(y0,y1+1) for x in range(x0,x1+1)]
rect(2,29,19,29,'.')
boat(cv,22,17)
put(cv,22,27,["444444444"])
emit('B.art',cv,M)

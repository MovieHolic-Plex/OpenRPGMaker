from pt import *
cv=canvas(32,32)
put(cv,1,8,gable(5,RED,4,doors=[(3,2)],wins=[(1,1,2)]))
put(cv,14,6,gable(5,BLUE,4,doors=[(3,2)],wins=[(1,1,2)]))
pier(cv,1,21,21,[3,9,15,19])
boat(cv,23,19)
emit('A.art',cv,M)

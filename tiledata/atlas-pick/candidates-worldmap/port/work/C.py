from pt import *
cv=canvas(32,32)
put(cv,0,4,gable(7,BLUE,3,doors=[(5,2)],wins=[(1,0,2),(7,0,2)]))
pier(cv,0,10,21,[2,8])
bigboat(cv,15,10)
put(cv,11,25,["44"]); 
emit('C.art',cv,M)

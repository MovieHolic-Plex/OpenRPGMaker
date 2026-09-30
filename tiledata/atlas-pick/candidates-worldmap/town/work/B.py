from tw import *
cv=canvas(32,32)
rect(cv,4,10,27,21,'e')
rect(cv,4,10,27,11,'F'); rect(cv,4,12,27,12,'e')
crenel(cv,3,28,4); wallface(cv,3,28,6,9)
for x0,cols in ((1,'zXZs'),(27,'sXUz')):
    for i,c in enumerate(cols): rect(cv,x0+i,7,x0+i,30,c)
for (x,y,r) in ((5,11,RED),(13,10,BLUE),(20,11,RED),(9,14,BLUE),(17,14,RED)):
    put(cv,x,y,gable(4,r,2,doors=[(1,2)],shade=True))
crenel(cv,0,31,22); wallface(cv,0,31,24,30)
gate(cv,16,24,30)
tower(cv,0,1,7,9); tower(cv,25,1,7,9); tower(cv,0,19,7,12); tower(cv,25,19,7,12)
# 탑 그림자를 마당에
rect(cv,7,20,9,21,'F'); rect(cv,22,20,24,21,'F')
emit('B.art',cv,M)

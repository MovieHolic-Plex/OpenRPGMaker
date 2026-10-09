from tw import *
cv=canvas(32,32)
rect(cv,3,12,28,21,'e')
crenel(cv,4,27,9,step=5,w=3,h=2); wallface(cv,4,27,11,13)
for x0,cols in ((1,'zZXs'),(27,'sXUz')):
    for i,c in enumerate(cols): rect(cv,x0+i,13,x0+i,30,c)
# 가운데 높은 집회소(큰 붉은 지붕)
put(cv,9,3,gable(8,RED,4,doors=[(6,2)],wins=[(1,1,2),(9,1,2)],shade=True))
put(cv,2,14,gable(4,BLUE,2,doors=[(1,2)])); put(cv,22,14,gable(4,BLUE,2,doors=[(1,2)]))
crenel(cv,0,31,22); wallface(cv,0,31,24,30)
gate(cv,16,24,30)
emit('C.art',cv,M)

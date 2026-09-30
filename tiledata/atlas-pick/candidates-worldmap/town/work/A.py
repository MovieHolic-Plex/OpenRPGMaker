from tw import *
cv=canvas(32,32)
rect(cv,4,10,27,21,'e')
# 뒷벽
crenel(cv,3,28,5); wallface(cv,3,28,7,9)
for y in range(7,10): pass
# 옆벽(윗면 폭 4)
for x0,cols in ((0,'zZXs'),(28,'sXUz')):
    for i,c in enumerate(cols): rect(cv,x0+i,7,x0+i,30,c)
# 집
for (x,y,r) in ((4,10,RED),(12,10,BLUE),(20,10,RED),(8,14,BLUE),(16,14,RED)):
    put(cv,x,y,gable(4,r,2,doors=[(1,2)]))
# 앞벽
crenel(cv,0,31,22); wallface(cv,0,31,24,30)
gate(cv,16,24,30)
emit('A.art',cv,M)

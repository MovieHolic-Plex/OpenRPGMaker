from sv import *
cv=canvas(16,16)
put(cv,10,2,["ff","kk","kk","kk","kk"])
put(cv,1,4,gable(7,SNOW,5,doors=[(4,2)],wins=[(1,1,2),(7,1,2)],shade=True))
put(cv,3,14,["I.I"]); put(cv,10,14,["I.I"])
emit('C.art',cv,M)

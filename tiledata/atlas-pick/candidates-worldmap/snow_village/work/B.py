from sv import *
cv=canvas(16,16)
pine=["...L...","..LnL..",".hLnmL.","..LmlL.",".hLnmlL","LnmmllL","..LlL..","...tT..","...tT.."]
put(cv,0,6,[r.ljust(7,'.') for r in pine])
put(cv,5,2,gable(5,SNOW,5,doors=[(4,2)],wins=[(1,1,2)],shade=True))
put(cv,0,15,["ee"])
emit('B.art',cv,M)

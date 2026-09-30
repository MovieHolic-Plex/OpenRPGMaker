from sv import *
cv=canvas(16,16)
put(cv,1,3,gable(6,SNOW,4,doors=[(4,2)],wins=[(1,1,2)]))
put(cv,10,8,gable(3,SNOW,3,doors=[(0,2)]))
emit('../../snow_village/work/A.art'.replace('../../snow_village/','') if False else 'A.art',cv,M)

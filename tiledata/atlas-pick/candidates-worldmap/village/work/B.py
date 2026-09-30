import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
cv=canvas(32,16)
put(cv,9,0,gable(5,BLUE,4,doors=[(3,2)],wins=[(0,1,2)],shade=True))      # 뒤(가운데, 위)
put(cv,0,3,gable(6,RED,5,doors=[(5,2)],wins=[(1,1,2)],shade=True))       # 앞 왼쪽
put(cv,17,5,gable(5,RED,4,doors=[(2,2)],wins=[(0,1,2)],shade=True))     # 앞 오른쪽
put(cv,26,8,tree())
put(cv,7,14,["ee"]); put(cv,20,14,["ee"])
emit('village/work/B.art',cv,STD)

import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
cv=canvas(32,16)
put(cv,9,2,gable(7,RED,6,doors=[(5,2)],wins=[(1,2,2),(9,2,2)],shade=True) if False else gable(7,RED,5,doors=[(5,2)],wins=[(1,1,2),(8,1,2)],shade=True))
tower=["..KK..","..KQ..","..KQR.","..KQRK","..kxYk","..kgYk"]
tower=["..KK..","..KRK.","..KQRK",".kxxYk.",".kVgYk.",".kVWYk."]
tower=["KK","KQ","KQ"]
put(cv,15,0,["..KK..","..KQRK","..kxYk","..kgYk","..kWYk","..kWYk"][0:0])
put(cv,14,0,[".KK.","KQRK","kxYk","kgYk","kWYk"])
put(cv,0,7,gable(4,BLUE,3,doors=[(1,2)],shade=True))
put(cv,24,7,gable(4,BLUE,3,doors=[(0,2)],shade=True))
put(cv,3,14,["ee"]);put(cv,15,14,["ee"]);put(cv,27,14,["ee"])
emit('village/work/C.art',cv,STD)

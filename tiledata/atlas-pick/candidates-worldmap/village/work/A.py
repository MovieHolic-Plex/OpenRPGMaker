import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/hamlet/work')
from comp import *
maps={'K':('wroofr',0),'q':('wroofr',1),'r':('wroofr',2),'R':('wroofr',3),'Q':('wroofr',4),
'J':('wroofb',0),'i':('wroofb',1),'j':('wroofb',2),'I':('wroofb',3),'H':('wroofb',4),
'k':('mbrick',2),'W':('mwhite',2),'V':('mwhite',3),'g':('mglass',4),'D':('mwood',3),'e':('wdirt',2),
'L':('wleaf',0),'l':('wleaf',1),'m':('wleaf',2),'n':('wleaf',3),'o':('wleaf',4),'t':('wbark',0),'T':('wbark',1)}
cv=canvas(32,16)
h1=["....KK......","...KQRK.....","..KQQRrK....",".KQQQRRrK...","KQQQRRRrrK..","KqqqqqqqqqqK".replace('K','K')]
# 첫 집 지붕(12폭): 줄마다 폭을 다시 손으로 맞춘다
h1=[".....KK.....","....KQRK....","...KQQRrK...","..KQQRRrrK..",".KQQQRRrrrK.","KqqqqqqqqqqK",
    ".kWWWWWWWWk.",".kWggWWDDWk.",".kWggWWDDWk.",".kWWWWWDDWk.",".kWVWWWDDWk.",".kkkkkkkkkk."]
put(cv,0,2,h1)
put(cv,7,14,["ee"])
h2=["....KK....","...KQRK...","..KQQRrK..",".KQQRRrrK.","KqqqqqqqqK",
    ".kWWWWWWk.",".kWggDDWk.",".kWggDDWk.",".kWWWDDWk.",".kkkkkkkk."]
h2=[r.replace('K','J').replace('Q','H').replace('R','I').replace('r','j').replace('q','i') for r in h2[:5]]+h2[5:]
put(cv,20,4,h2)
put(cv,25,14,["ee"])
tree=[".LLLL.","LonnmL","LnnmlL","LmmllL",".LllL.","..tT..","..tT..","..tT..","..tT..","..tT.."]
put(cv,12,4,tree)
emit('village/work/A.art',cv,maps)

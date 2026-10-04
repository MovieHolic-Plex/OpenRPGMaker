import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
exec(open('tiledata/atlas-pick/candidates-jp/station_entrance/work/gen-ticket.py').read().split("mats=[")[0].split("from j4_mk import *")[1])
mats=["o mmetal 0","a mmetal 2","m mmetal 3","l mmetal 4","h mmetal 5","K mmetal 1","k mout 0","d mdglass 0","S neonc 4","T neonc 5","U neonc 3","H neonc 2",
"r akachin 4","b kblue 4","g kgreen 4","y taxi 4","w mwhite 3","W mwhite 4","V mwhite 3","B kblue 3","R akachin 3","G kgreen 3","x mconc 0","z mconc 2"]
# B: 진한 몸체 + 화면 후광(H) + 틈에 빛 번짐(%)
def machB():
    m=mach("S","T")
    m[3]=c("o"+"l"+"dHHHHHHHHd"+"m"+"o",14)
    m[4]=c("o"+"l"+"dH"+"T"*6+"Hd"+"m"+"o",14)
    m[5]=c("o"+"l"+"dH"+"S"*6+"Hd"+"m"+"o",14)
    m[6]=c("o"+"l"+"dH"+"S"*6+"Hd"+"m"+"o",14)
    m[7]=c("o"+"l"+"dHHHHHHHHd"+"m"+"o",14)
    return m
m=machB()
rows=[]
b=board()
for i,r in enumerate(m):
    rows.append(r)
rows=[a+(("%%") if 3<=i<=8 else "..")+a for i,a in enumerate(rows)]
rows=[c(r,32) for r in b]+[c(r,32) for r in rows]
rows=["."*32]+rows+[c("-"+"~"*28+"-",32)]
rows=[r.replace("%%","%%") for r in rows]
w('ticket_machine','B',(2,2),"빛 구조: 어두운 금속 몸체 + 화면 청록 후광 + 두 기계 틈으로 %번짐",mats,rows)
# C: 다시 생각 — 한 덩이 지붕 달린 매표 코너. 노선 지도 판 넓게, 기계 둘은 비스듬한 윗면
def machC(cl="l"):
    R=[".oooooooooo.",
       "oThhhhhhhhTo".replace("T","h"),
       "olddddddddmo",
       "olHSSSSSSHmo".replace("H","d"),
       "olHTTTTTTHmo".replace("H","d"),
       "oldddddddd"+"mo",
       "olmrmbmgmyao",
       "olmmmmmmmmao",
       "olmmmmmmmmao",
       "olmmmmmmmmao",
       "olmwmkkkmmao",
       "olmmmmmmmmao",
       "olKKKKKKKKao",
       "olkkkkkkkkao",
       "olmmmmmmmmao",
       "olmmmmmmmmao",
       "olmmmmmmmmao",
       "oooooooooooo"]
    return [chk(r,12) for r in R]
def mapC(W=30):
    rows=[c("x"*W),"x"+"V"*(W-2)+"x"]
    body=[
     "V"*28,
     "VVBBBBBBBBBBBBBBBBBBBBBBBBVV",
     "VVVVVVVVVwVVVVVwVVVVVVVVVVVV",
     "VVVVRRRRRRRRRRRRRRRRRRRRRRVV",
     "VVVVVVwVVVVVVVVwVVVVwVVVVVVV",
     "VVVVVVVVVVVVVVVVVVVVVVVVVVVV",
     "VVVVVVVVVVVVVVVVVVVVVVVVVVVV",
     "VVGGGGGGGGGGGGGGGGGGGVVVVVVV"]
    rows+=["x"+r+"x" for r in body]
    rows+=[c("x"*W)]
    return rows
mc=machC()
gap="z"*0
rows=[c(r,32) for r in mapC()]
mm=[a+".."+b_ for a,b_ in zip(mc,mc)]
mm=[c(r,32) for r in mm]
rows=["."*32]+rows[:11]+mm+[c("-"+"~"*26+"-",32)]
w('ticket_machine','C',(2,2),"다시 생각: 넓은 노선도 판(점·선) 아래 좁고 낮은 기계 둘, 몸체는 한 폭으로 더 곧게",
  ["o mmetal 1","a mmetal 3","m mmetal 4","l mmetal 5","h mmetal 6","K mmetal 2","k mout 0","d mdglass 1","S neonc 3","T neonc 4","r akachin 4","b kblue 4","g kgreen 4","y taxi 4","w mwhite 3","V mwhite 2","B kblue 3","R akachin 3","G kgreen 3","x mconc 1"],rows)

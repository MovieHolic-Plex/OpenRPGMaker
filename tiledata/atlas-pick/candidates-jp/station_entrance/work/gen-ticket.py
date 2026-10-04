import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
def chk(s,n):
    assert len(s)==n,(s,len(s),n); return s
def mach(scr="S",hi="T",tone="A"):
    o="o"
    R=[]
    R.append(chk(".oooooooooooo.",14))
    R.append(c("o"+"hhhhhhhhhhll"+"o",14))
    R.append(c("o"+"llllllllllmm"+"o",14))
    R.append(c("o"+"l"+"dddddddddd"+"m"+"o",14))
    R.append(c("o"+"l"+"d"+hi*8+"d"+"m"+"o",14))
    R.append(c("o"+"l"+"d"+scr*8+"d"+"m"+"o",14))
    R.append(c("o"+"l"+"d"+scr*8+"d"+"m"+"o",14))
    R.append(c("o"+"l"+"dddddddddd"+"m"+"o",14))
    R.append(c("o"+"lmmmmmmmmmma"+"o",14))
    R.append(c("o"+"lmrmbmgmymma"+"o",14))
    R.append(c("o"+"lmmmmmmmmmma"+"o",14))
    R.append(c("o"+"lmwmrmbmgmma"+"o",14))
    R.append(c("o"+"lmmmmmmmmmma"+"o",14))
    R.append(c("o"+"lmmkkkmmmmma"+"o",14))
    R.append(c("o"+"lmmmmmmmmmma"+"o",14))
    R.append(c("o"+"lmKKKKKKKKma"+"o",14))
    R.append(c("o"+"lmkkkkkkkkma"+"o",14))
    R.append(c("o"+"lmKKKKKKKKma"+"o",14))
    R.append(c("o"+"lmmmmmmmmmma"+"o",14))
    R.append(c("o"+"l"+"kkkkkkkkkk"+"a"+"o",14))
    R.append("o"*14)
    return R
def line(color,a,b,ticks=()):
    s=["W"]*28
    for i in range(a,b): s[i]=color
    for t in ticks: s[t]='w'
    return "".join(s)
def board(W=30):
    rows=[c("x"*W),"x"+"V"*(W-2)+"x"]
    rows+=["x"+line("B",1,24,(4,10,16,22))+"x","x"+"W"*(W-2)+"x","x"+line("R",5,27,(8,14,20,25))+"x","x"+"W"*(W-2)+"x","x"+line("G",2,21,(5,11,17))+"x",c("x"*W)]
    return rows
mats=["o mmetal 1","a mmetal 3","m mmetal 4","l mmetal 5","h mmetal 6","K mmetal 2","k mout 0","d mdglass 1","S neonc 3","T neonc 4","U neonc 5",
"r akachin 4","b kblue 4","g kgreen 4","y taxi 4","w mwhite 3","W mwhite 3","V mwhite 2","B kblue 3","R akachin 3","G kgreen 3","x mconc 1"]
b=board()
m=mach()
ma=[m[i]+".."+m[i] for i in range(len(m))]
# 30폭 보드는 c(…,32) 로 가운데. 기계 두 대는 32칸 안에 1칸 여백.
rows=[c(r,32) for r in b]+[c(r,32) for r in ma]
rows=[r if len(r)==32 else c(r,32) for r in rows]
rows=[("."+"."*0+r) if False else r for r in rows]
# 위 여백 1행, 아래는 그림자
rows=[ "."*32 ]+rows+[c("-"+"~"*28+"-",32)]
w('ticket_machine','A',(2,2),"강남 결: 노선 요금표 판 + 금속 매표기 두 대(청록 화면·버튼·동전구·지폐구·반환구)",mats,rows)

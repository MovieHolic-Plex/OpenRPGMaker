import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
# ---- A: 둥근 기둥 우체통, 강남 결
matsA=["o akachin 0","q akachin 1","r akachin 2","R akachin 3","L akachin 4","l akachin 5","k lacq 1","K lacq 3","w mwhite 3"]
def body(inner="lLLRRRrq"): return c("o"+inner+"o")
rows=[]
rows+=blank(1)
rows+=[c("oooooo"),c("olLLRRro"),c("olLLRRRrqo")]
rows+=[c("o"+"lLLLRRRRrq"+"o"), c("oooooooooooo"), c("o"+"qqqqqqqq"+"o")]
rows+=[body(),body()]
rows+=[c("o"+"l"+"kkkkkk"+"q"+"o"),c("o"+"l"+"KKKKKK"+"q"+"o"),body()]
rows+=[c("o"+"l"+"kkkkkk"+"q"+"o"),c("o"+"l"+"KKKKKK"+"q"+"o")]
rows+=[body(),body()]
rows+=[c("o"+"lL"+"wwww"+"rq"+"o"),c("o"+"l"+"wwwwww"+"q"+"o"),c("o"+"lLL"+"ww"+"Rrq"+"o"),c("o"+"lLL"+"ww"+"Rrq"+"o"),c("o"+"lLL"+"ww"+"Rrq"+"o")]
rows+=[body() for _ in range(5)]
rows+=[c("o"+"lL"+"RRRR"+"rq"+"o")]
rows+=[c("o"+"llLRRRRRrq"+"o"),c("o"*12),c("-"+"~"*12+"-")]
rows=[r for r in rows]
w('mailbox_red','A',(1,2),"강남 결: 둥근 기둥 우체통, 왼쪽 밝은 띠, 가로 구멍 둘, 흰 〒",matsA,rows)
# ---- B: 강한 빛
matsB=["o akachin 0","q akachin 0","r akachin 1","R akachin 3","L akachin 5","l akachin 6","k lacq 0","K lacq 4","w mwhite 4","s mwhite 5","t akachin 2"]
def bodyB(): return c("o"+"lLLRRRtr"+"o")
rows=blank(1)+[c("oooooo"),c("olsLRRro"),c("olLLRRRtro")]
rows+=[c("o"+"lLLLRRRttr"+"o"), c("oooooooooooo"), c("o"+"rrrrrrrr"+"o")]
rows+=[bodyB(),bodyB()]
rows+=[c("o"+"l"+"kkkkkk"+"r"+"o"),c("o"+"l"+"KKKKKK"+"r"+"o"),bodyB()]
rows+=[c("o"+"l"+"kkkkkk"+"r"+"o"),c("o"+"l"+"KKKKKK"+"r"+"o")]
rows+=[bodyB(),bodyB()]
rows+=[c("o"+"lL"+"wwww"+"tr"+"o"),c("o"+"l"+"wwwwww"+"r"+"o"),c("o"+"lLL"+"ww"+"Rtr"+"o"),c("o"+"lLL"+"ww"+"Rtr"+"o"),c("o"+"lLL"+"ww"+"Rtr"+"o")]
rows+=[bodyB() for _ in range(5)]
rows+=[c("o"+"lL"+"RRRR"+"tr"+"o")]
rows+=[c("o"+"llLRRRRttr"+"o"),c("o"*12)]
rows+=[ "-"*0+ "...~~~~~~~~~~~~~-" [:16]]
rows[-1]=rows[-1].ljust(16,'.')
w('mailbox_red','B',(1,2),"빛 구조: 하이라이트 띠(6단)·오른쪽 어두운 면, 발치에서 오른쪽으로 길게 깔리는 그림자",matsB,rows)

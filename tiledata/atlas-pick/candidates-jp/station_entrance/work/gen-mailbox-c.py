import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
mats=["o akachin 0","q akachin 1","r akachin 2","R akachin 3","L akachin 4","l akachin 5","k lacq 1","K lacq 3","w mwhite 3","d ishi 1","f ishi 4"]
def bx(inner="lLLRRRRRRrrq"):
    assert len(inner)==12,inner
    return c("o"+inner+"o")
rows=blank(4)
rows+=[c("o"*14),bx("lllLLLLRRRRr"),bx("lLLLRRRRRRrq"),c("o"*14)]
rows+=[bx("qqqqqqqqqqqq")]
rows+=[bx(),bx()]
slot=lambda ch: bx("l"+ch*8+"rrq")
rows+=[slot("k"),slot("K"),bx(),slot("k"),slot("K")]
rows+=[bx(),bx()]
rows+=[bx("lLRRwwwwRRrq"),bx("lLRwwwwwwRrq"),bx("lLRRRwwRRRrq"),bx("lLRRRwwRRRrq"),bx("lLRRRwwRRRrq")]
rows+=[bx(),bx()]
rows+=[c("o"*14)]
rows+=[c("odfo"+"."*6+"odfo"),c("odfo"+"."*6+"odfo"),c("oooo"+"."*6+"oooo")]
rows+=[c("-"+"~"*12+"-")]
w('mailbox_red','C',(1,2),"실루엣 재해석: 네모 상자형 우체통(넓은 몸통·평평한 뚜껑·돌 다리 둘), 구멍 두 줄, 흰 〒",mats,rows)

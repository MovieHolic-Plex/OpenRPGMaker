from w6lib import emit, Cv
from st import LG
def span(c,y,x0,x1,edge_top=False):
    for x in range(x0,x1+1):
        c.px(x,y,'3')
    c.px(x0,y,'1'); c.px(x1,y,'1')
    if x1-x0>=3:
        c.px(x0+1,y,'4'); c.px(x1-1,y,'2')
        if x1-x0>=5: c.px(x0+2,y,'4')
def C():
    c=Cv(16,32)
    # 첨탑 등받이
    tops={2:(7,8),3:(6,9),4:(5,10),5:(4,11)}
    for y,(a,b) in tops.items():
        span(c,y,a,b)
    for y in range(6,19): span(c,y,4,11)
    # 지붕선 하이라이트
    c.px(7,2,'1'); c.px(8,2,'1'); c.px(6,3,'1'); c.px(9,3,'1')
    c.px(7,3,'5'); c.px(8,3,'4'); c.px(6,4,'5'); c.px(7,4,'4'); c.px(5,5,'5'); c.px(6,5,'5')
    # 꼭대기 금 장식
    c.px(7,0,'f'); c.px(8,0,'d'); c.px(7,1,'e'); c.px(8,1,'c')
    # 어깨 금 구슬
    c.px(3,5,'d'); c.px(3,6,'c'); c.px(2,5,'.') 
    c.px(12,5,'c'); c.px(12,6,'b'); c.px(3,5,'e'); c.px(3,4,'f') if False else None
    # 새긴 뾰족 아치 (금 선)
    c.px(7,7,'f'); c.px(8,7,'d')
    c.px(6,8,'e'); c.px(9,8,'c')
    for y in range(9,18): c.px(6,y,'e'); c.px(9,y,'c')
    for y in range(8,18):
        for x in (7,8): c.px(x,y,'2')
    c.px(7,8,'1') if False else None
    # 왕관 문양 금
    c.px(7,10,'e'); c.px(8,10,'d'); c.px(7,11,'f'); c.px(8,11,'e')
    c.px(7,12,'l'); c.px(8,12,'i'); c.px(7,13,'i'); c.px(8,13,'h')
    # 팔걸이(굵게)
    for y in range(18,24):
        for x in (1,2,3,12,13,14): c.px(x,y,'3')
    c.hl(1,17,3,'1'); c.hl(12,17,3,'1')
    c.hl(1,18,3,'e'); c.px(1,18,'f'); c.hl(12,18,3,'d'); c.px(14,18,'c')
    c.vl(1,19,5,'4'); c.vl(2,19,5,'3'); c.vl(3,19,5,'2')
    c.vl(12,19,5,'3'); c.vl(13,19,5,'2'); c.vl(14,19,5,'1')
    c.hl(1,24,3,'1'); c.hl(12,24,3,'1')
    c.vl(0,18,7,'.') 
    # 방석 (빨강) + 금 테
    c.hl(4,19,8,'m'); c.px(4,19,'n')
    c.hl(4,20,8,'k'); c.px(4,20,'l'); c.px(11,20,'i')
    c.hl(4,21,8,'i'); c.px(11,21,'h')
    c.hl(4,22,8,'d'); c.px(4,22,'e'); c.px(11,22,'c')
    c.hl(4,23,8,'1')
    # 몸통 받침 (2단 단상)
    c.hl(2,24,12,'2'); c.px(2,24,'1'); c.px(13,24,'1')
    for y in (25,26,27):
        c.hl(2,y,12,'3'); c.px(2,y,'4'); c.px(3,y,'4'); c.px(13,y,'1'); c.px(12,y,'2'); c.px(7,y,'2'); c.px(8,y,'2')
    c.hl(1,27,1,'.') 
    c.hl(0,28,16,'5'); c.px(0,28,'6'); c.px(15,28,'2')
    c.hl(0,29,16,'3'); c.vl(0,29,3,'4'); c.vl(15,29,3,'1')
    c.hl(0,30,16,'2'); c.hl(0,31,16,'1')
    # 금 띠 (단상 앞)
    c.hl(2,29,12,'d'); c.px(2,29,'e'); c.px(13,29,'c')
    return c
if __name__=='__main__':
    c=C(); c.show(); emit('../w6-C.pxg',LG,c.rows())

from w6lib import emit, Cv
BASE = {'W':'wood:1','p':'wood:2','w':'wood:3','v':'wood:4','x':'wood:5','y':'wood:6','z':'wood:7',
 'a':'leaf:1','b':'leaf:2','c':'leaf:3','d':'leaf:4','e':'leaf:5','f':'leaf:6',
 'L':'linen:6','M':'linen:5','N':'linen:4','O':'linen:3','P':'linen:2',
 'I':'ice:6','J':'ice:5','K':'ice:4','Q':'ice:3','R':'ice:2',
 'G':'gold:4','H':'gold:3','~':'P:~','-':'P:-'}
def ramp(name): return {str(i+1): f'{name}:{i}' for i in range(7)}
LG_BLUE = dict(BASE, **ramp('blue'))
LG_TEAL = dict(BASE, **ramp('teal'))
LG_TEAL.update({chr(65+i): f'pine:{i}' for i in range(7) if chr(65+i) not in ('G','H','I','J','K','L','M','N','O','P','Q','R')})
LEAF = ["..aa..",".adfa.","adfeca","adeeca",".aeca.","..aa.."]
def crown(c, seed=0):
    for x,ch in zip(range(3,13),"abcdcdcbca"): c.px(x,10,ch)
    for x,ch in zip(range(3,13),"dcecdcecdc"): c.px(x,11,ch)
    c.put(0,11,["cd","bc"]); c.put(11,10,[".dcb","dfec","cedb"]); c.put(1,12,["dc","cb"]); c.put(13,12,["cd","bc"])
    c.put(0,14,["dc","ab"]); c.put(14,15,["cd","ba"])
def sheet_pillow(c, strong=False):
    c.rect(2, 23, 12, 7, 'M'); c.hl(2, 23, 12, 'N'); c.vl(13, 23, 7, 'N')
    if strong:
        c.rect(2,23,12,1,'O'); c.rect(11,24,2,6,'N'); c.vl(13,23,7,'O')
    c.put(3, 24, [".PPPPPPPPP.","PIIIIIIIJJP","PIJJJJJJJKP","PJJJJJJJKKP","PJJJJJKKKQP",".PRRRRRRRP."])
    if strong: c.put(3,24,[".PPPPPPPPP.","PIIIIIJJJKP","PIJJJJJKKQP","PJJJJKKKQQP","PJJKKKQQQRP",".PRRRRRRRP."])
    c.hl(2, 30, 12, 'L'); c.hl(2, 31, 12, 'N')
def post_frame(c, strong=False):
    for y in range(11, 48):
        c.px(0, y, 'W'); c.px(1, y, 'z' if strong else 'y'); c.px(14, y, 'p' if strong else 'v'); c.px(15, y, 'W')
    c.px(1,11,'z'); c.px(0,11,'.'); c.px(15,11,'.'); c.hl(1,10,2,'W'); c.px(14,10,'W')
    c.hl(2, 11, 12, 'W'); c.hl(2, 12, 12, 'y'); c.px(2,12,'z')
    c.rect(2, 13, 12, 8, 'x'); c.hl(2, 13, 12, 'y'); c.vl(2, 13, 8, 'y'); c.vl(13, 13, 8, 'v'); c.hl(2, 20, 12, 'v')
    if strong:
        c.rect(2,13,3,7,'y'); c.hl(2,13,12,'z'); c.rect(9,15,4,5,'v'); c.vl(13,13,8,'w'); c.hl(2,20,12,'w'); c.vl(2,13,8,'z')
    c.hl(2, 21, 12, 'w'); c.hl(2,22,12,'p')
    c.put(5, 14, LEAF)
def foot(c, strong=False):
    c.hl(2, 45, 12, 'z'); c.hl(2, 46, 12, 'y'); c.hl(2,47,12,'W'); c.px(14,47,'W')
    if strong: c.hl(2,46,12,'x'); c.hl(9,45,5,'y')

def build_A():
    c = Cv(16, 48); post_frame(c); crown(c); sheet_pillow(c)
    c.rect(2, 32, 12, 13, '5'); c.hl(2, 32, 12, '7'); c.hl(2, 33, 12, '6'); c.hl(2, 34, 12, '4')
    c.vl(2, 32, 13, '6'); c.vl(3, 35, 8, '6'); c.vl(13, 32, 13, '3'); c.vl(12, 35, 8, '4')
    c.vl(7,36,6,'6'); c.vl(8,36,6,'6'); c.vl(6,37,4,'4')
    c.hl(2, 42, 12, '4'); c.hl(2,43,12,'3'); c.hl(2,44,12,'2')
    foot(c); return c
def build_B():
    c = Cv(16, 48); post_frame(c, True); crown(c); sheet_pillow(c, True)
    for x0,w,ch in ((2,2,'7'),(4,3,'6'),(7,3,'5'),(10,2,'4'),(12,1,'3'),(13,1,'2')): c.rect(x0,32,w,13,ch)
    c.hl(2,32,11,'7'); c.hl(2,33,8,'7'); c.hl(2,34,12,'2'); c.px(2,34,'5'); c.px(3,34,'5'); c.hl(4,34,3,'4'); c.hl(7,34,3,'3')
    c.vl(5,36,5,'7'); c.vl(8,37,4,'6'); c.px(4,38,'7')
    c.hl(2, 41, 12, '4'); c.hl(2,42,12,'3'); c.hl(2,43,12,'2'); c.hl(2,44,12,'1')
    foot(c, True); return c
def build_C():
    c = Cv(16, 48)
    Hd = ["......AAAA......","....AAEFFEAA....","...AEFFFFFFDA...","..AEFFEEEEDDCA..",".AAEFEEEEEEDCAA."]
    for j,r in enumerate(Hd): c.put(0,10+j,[r])
    for y in range(15,48): c.px(0,y,'A'); c.px(1,y,'E'); c.px(2,y,'A'); c.px(13,y,'A'); c.px(14,y,'C'); c.px(15,y,'A')
    c.rect(3,15,10,6,'D'); c.rect(3,15,6,1,'E'); c.vl(3,15,6,'E'); c.vl(12,15,6,'C')
    c.put(5,15,LEAF)
    c.hl(3,21,10,'C'); c.hl(3,22,10,'B')
    # 나뭇잎 순: 꼭대기 옆 싹
    c.put(3,9+1,[]) 
    c.put(1,13,["dc","cb"]); c.put(13,13,["cd","bc"]); c.put(0,16,["dc","ab"]); c.put(14,17,["cd","ba"]); c.put(6,9+1,[]) 
    c.rect(3,23,10,7,'M'); c.hl(3,23,10,'N'); c.vl(12,23,7,'N')
    c.put(3, 24, [".PPPPPPPPP.","PIIIIIIIJJP","PIJJJJJJJKP","PJJJJJJJKKP","PJJJJJKKKQP",".PRRRRRRRP."])
    c.hl(3,30,10,'L'); c.hl(3,31,10,'N')
    # 청록 이불: 발치로 내려오며 옆으로 늘어진다
    c.rect(3,32,10,13,'4'); c.hl(3,32,10,'6'); c.hl(3,33,10,'5'); c.vl(3,32,13,'5'); c.vl(12,32,13,'2'); c.vl(11,34,10,'3')
    c.hl(3,34,10,'2'); c.hl(3,35,10,'3')
    c.put(5,37,["..6..",".656.","65456",".656.","..6.."])
    c.hl(3,41,10,'6'); c.hl(3,42,10,'3'); c.hl(3,43,10,'2'); c.hl(3,44,10,'1')
    c.hl(2,45,12,'E'); c.hl(2,46,12,'D'); c.hl(0,47,16,'A'); c.hl(0,46,2,'C'); c.hl(14,46,2,'C')
    return c
for name, fn, lg in (('A',build_A,LG_BLUE),('B',build_B,LG_BLUE),('C',build_C,LG_TEAL)):
    emit(f'../w6-{name}.pxg', lg, fn().rows())

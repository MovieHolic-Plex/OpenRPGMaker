import sys; sys.path.insert(0,'.')
from w10lib import *
L = {'a':'gold:6','b':'gold:5','c':'gold:4','d':'gold:3','e':'gold:2','o':'gold:1',
     'T':'wood:7','U':'wood:6','V':'wood:5','X':'wood:4','Y':'wood:3','Z':'wood:2','W':'wood:1',
     'l':'linen:5','m':'linen:4','n':'linen:3','k':'linen:1','j':'linen:2'}
S='shelf_coins'
P=[".eaae.","eabbce","ebcdce","edddde"]
Q=["......",".eaae.","ebbcce","eddcde"]
def tier(top='T',front='X',bot='Z'):
    c=Cv(16,7)
    c.rect(1,3,14,1,top); c.rect(1,4,14,1,'U' if top=='T' else top); c.rect(1,5,14,1,front); c.rect(1,6,14,1,bot)
    c.blit(P,2,0); c.blit(Q,9,0)
    return c.rows()
A = ["."*16]+tier()+["..W..........W.."]+tier()
emit(S,'w10-A',L,A,16,16)

# ---- B : 빛 좌상. 위판 2단, 오른쪽 옆 어둡게, 접지 그림자
PB=[".eaab.","eabbce","ebcdde","edddde"]
QB=["......",".eaae.","eabcde","edddde"]
def tierB():
    c=Cv(16,7)
    c.rect(1,3,14,1,'V'); c.rect(1,4,14,1,'T'); c.rect(1,5,14,1,'X'); c.rect(1,6,14,1,'Z')
    c.rect(14,3,1,3,'Y')
    c.blit(PB,2,0); c.blit(QB,9,0)
    c.hline(8,4,1,'V'); c.hline(15,3,0,'.')
    c.hline(8,4,1,'X') 
    c.put(1,4,'a')
    c.put(1,4,'T')
    return c.rows()
def shadowrow():
    c=Cv(16,1); c.hline(2,0,12,'-'); c.hline(3,0,10,'~'); c.put(2,0,'W'); c.put(13,0,'W'); return c.rows()
B = ["."*16]+tierB()+shadowrow()+tierB()
emit(S,'w10-B',L,B,16,16)

# ---- C : 세로 동전 두루마리(위) + 돈자루와 흩어진 동전(아래)
def base():
    c=Cv(16,7)
    c.rect(1,3,14,1,'V'); c.rect(1,4,14,1,'T'); c.rect(1,5,14,1,'X'); c.rect(1,6,14,1,'Z')
    c.rect(14,3,1,3,'Y')
    return c
def rolls():
    c=base()
    for x,h in zip([2,5,8,11],[3,4,2,3]):
        y0=3-h
        c.put(x,y0,'e'); c.put(x+1,y0,'a'); c.put(x+2,y0,'d')
        for r in range(1,h+1):
            y=y0+r; band=(r%2==1)
            c.put(x,y,'b' if band else 'c'); c.put(x+1,y,'a' if band else 'b'); c.put(x+2,y,'d' if band else 'e')
    return c.rows()
def sack():
    c=base()
    sk=["..kn....","..kmn...",".kmllnk.","kmllmmnk","kmmmmnnk","knnnnnkk"]
    c.blit(["..kj.....","..jmk...."][:0],1,0)
    c.blit([".k.k..","kmkmn.",".kmln.","kmllmn","kmmmnn"],2,0)
    c.blit(["......",".eaae.","ebbcde"],9,1)
    c.put(7,3,'b'); c.put(8,3,'c')
    return c.rows()
C = ["."*16]+rolls()+["..W..........W.."]+sack()
emit(S,'w10-C',L,C,16,16)
for n in ('A','B','C'): check(f'{CAND}/{S}/w10-{n}.pxg')

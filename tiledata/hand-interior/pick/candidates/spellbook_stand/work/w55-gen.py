import sys
D='tiledata/hand-interior/pick/candidates/spellbook_stand/'
def mk(W,H,ops,name,note):
    m=[['.']*W for _ in range(H)]; t=[['.']*W for _ in range(H)]
    def px(x,y,mat,tier):
        if 0<=x<W and 0<=y<H: m[y][x]=mat; t[y][x]=str(tier)
    def row(y,x0,x1,mat,tiers):
        for i,x in enumerate(range(x0,x1+1)):
            tt=tiers[min(i,len(tiers)-1)] if isinstance(tiers,list) else tiers
            px(x,y,mat,tt)
    ops(px,row,m,t)
    out=[f'@size {W} {H}',f'@cell {8 if H==24 else 16}','@palette palette.pal','@mat w wood','@mat l linen','@mat g teal','@mat p purple','@mblock 0 0']
    out+=[''.join(r) for r in m]
    out+=['@tblock 0 0']+[''.join(r) for r in t]
    open(D+name,'w').write('\n'.join(out)+'\n')
def A(px,row,m,t):
    # sparks
    px(9,3,'g',6);px(21,3,'g',5);px(15,4,'g',6);px(26,5,'g',4);px(5,6,'g',4)
    # pages
    row(5,8,23,'l',1)
    for y in (6,7,8,9):
        px(7,y,'l',1);px(24,y,'l',2)
        row(y,8,14,'l',5);px(15,y,'l',2);px(16,y,'l',1);row(y,17,23,'l',4)
    for x in (9,10,11,12,13): px(x,7,'l',3)
    for x in (9,10,12,13): px(x,9,'l',3)
    for x in (18,20,22): px(x,7,'p',3)
    px(19,8,'p',4);px(21,8,'p',4);px(18,9,'p',3);px(20,9,'g',5);px(22,9,'g',4)
    row(10,7,24,'l',3);px(15,10,'l',1);px(16,10,'l',1);px(7,10,'l',1);px(24,10,'l',1)
    # cover
    row(11,6,25,'p',[5]+[4]*18+[3]); row(12,6,25,'p',[3]+[2]*18+[1])
    # board top
    row(13,3,28,'w',[6]*25+[5]); row(14,3,28,'w',[5]*26)
    row(13,6,25,'w',[3]) if False else None
    # ribbon
    for y in (13,14,15,16,17): px(16,y,'p',3)
    px(16,18,'p',2);px(15,18,'p',2)
    row(15,3,28,'w',[6]+[7]*24+[5])
    row(16,3,28,'w',[5]+[5]*24+[3]); row(17,3,28,'w',[4]*25+[2]); row(18,3,28,'w',[2]*26)
    for y in (16,17): px(3,y,'w',6 if y==16 else 5)
    px(16,16,'p',3);px(16,17,'p',3);px(16,18,'p',2)
    # eave shadow on pedestal
    row(19,14,17,'w',1)
    for y in (20,21):
        row(y,14,17,'w',[5,4,3,2] if y==20 else [4,4,3,2])
    row(21,12,19,'w',[5,4,4,4,4,3,2,1])
    row(22,10,21,'w',[4,3,3,3,3,3,3,3,2,2,1,1])
    row(23,9,22,'~',[0]); 
    for x in range(9,23): m[23][x]='~'; t[23][x]='.'
    m[23][9]='-';m[23][22]='-'
def B(px,row,m,t):
    px(4,1,'g',5);px(11,1,'g',6);px(8,0,'g',4)
    row(2,3,12,'l',1)
    for y in (3,4):
        px(2,y,'l',1);px(13,y,'l',2)
        row(y,3,7,'l',5);px(8,y,'l',1);row(y,9,12,'l',4)
    px(4,3,'l',3);px(5,3,'l',3);px(6,3,'l',3);px(10,3,'p',3);px(12,3,'p',3);px(11,4,'g',5);px(4,4,'l',3);px(6,4,'l',3)
    row(5,2,13,'l',3);px(8,5,'l',1);px(2,5,'l',1);px(13,5,'l',1)
    row(6,1,14,'p',[5]+[4]*12+[3]); row(7,1,14,'p',[3]+[2]*12+[1])
    row(8,1,14,'w',[6]*14); row(9,1,14,'w',[7]+[7]*12+[5])
    row(10,1,14,'w',[5]*13+[3]); row(11,1,14,'w',[4]*13+[2]); row(12,1,14,'w',[2]*14)
    px(8,8,'p',3);px(8,9,'p',3);px(8,10,'p',3);px(8,11,'p',2)
    px(6,13,'w',1);px(7,13,'w',1);px(8,13,'w',1);px(9,13,'w',1)
    row(13,6,9,'w',[1])
    row(14,6,9,'w',[5,4,3,2])
    row(15,4,11,'w',[3,3,3,3,3,2,2,1])
    for x in range(2,14):
        pass
mk(32,24,A,'w55-A.pxg','')
mk(16,16,B,'w55-B.pxg','')

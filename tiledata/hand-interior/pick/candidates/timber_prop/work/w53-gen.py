import sys
W,H=16,48
def build(variant):
    m=[['.']*W for _ in range(H)]  # mat
    t=[['.']*W for _ in range(H)]  # step
    s=[['.']*W for _ in range(H)]  # shadow
    def put(x,y,st):
        m[y][x]='n'; t[y][x]=str(st)
    def row(y,steps,x0=0):
        for i,c in enumerate(steps):
            if c!='.': put(x0+i,y,c)
    # lintel
    row(9,'3'*16)
    row(10,'7677777776777677')
    row(11,'7777677777776777')
    row(12,'6777777777777776')
    row(13,'8'*16)           # front edge highlight (t=4)
    row(14,'6666566666656666')
    row(15,'5555555555555555')
    row(16,'4444344444434444')
    row(17,'1'*16)
    # eave shadow under lintel (2px) painted over posts
    posts=[(0,'1751'),(12,'1751')] if variant=='A' else [(6,'1751')]
    for x0,_ in posts:
        pass
    for x0,pat in posts:
        for y in range(18,48):
            if y in (18,19): st='1431'  # eave shadow: darker
            elif y==47: st='1111'
            elif y==46: st='1331'
            else:
                st=pat
                if y%7==3: st='1641' if x0==0 or variant=='B' else '1651'
                if y%11==5: st='1741'
                if y%13==8: st='1731'
            row(y,st,x0)
    if variant=='A':
        # knee braces
        row(18,'44',4); row(19,'3',4)
        row(18,'44',10); row(19,'.3',10)
        # bolts on lintel
        t[15][2]='7'; t[15][13]='7'
        # shadows right of posts + floor shadow
        for y in range(20,48): 
            if y>=44: s[y][4]='~'; s[y][11]='~'
        for x in range(4,12): s[47][x]='-'
        s[46][4]='~'
    else:
        for y in range(20,48): s[y][10]='~'
        s[47][10]='~'; s[47][11]='-'; s[47][5]='-'; s[46][10]='~'
        t[15][3]='7'; t[15][12]='7'
        # iron straps on post
        for y in (30,31): 
            for x in range(6,10): t[y][x]='3' if x in (6,9) else '5'
    out=['@size 16 48','@cell 16','@palette palette.pal','@mat n wood','@mblock 0 0']
    out+=[''.join(r) for r in m]
    out.append('@tblock 0 0'); out+=[''.join(r) for r in t]
    out.append('@block 0 0'); out+=[''.join(r) for r in s]
    return '\n'.join(out)+'\n'
open('w53-A.pxg','w').write(build('A'))
open('w53-B.pxg','w').write(build('B'))

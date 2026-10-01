W=H=32
m=[['.']*W for _ in range(H)]; t=[['.']*W for _ in range(H)]; s=[['.']*W for _ in range(H)]
def put(x,y,mat,st): m[y][x]=mat; t[y][x]=str(st)
def row(y,x0,x1,mat,st):
    for x in range(x0,x1+1): put(x,y,mat,st)
# glow motes
for x,y,st in [(9,1,5),(22,0,6),(15,1,4),(26,2,5),(5,2,4)]: put(x,y,'g',st)
# book rows 2-9, x5-26
row(2,6,25,'l',1); 
for y in range(3,9):
    put(5,y,'l',1); put(26,y,'l',1)
    row(y,6,25,'l',5)
row(9,5,26,'l',1)
for y in range(3,9): put(15,y,'l',2); put(16,y,'l',2)
row(8,6,14,'l',4); row(8,17,25,'l',4)
for y in (4,6):
    for x in list(range(7,14))+list(range(18,25)):
        if (x+y)%5!=0: put(x,y,'l',3)
for x in (10,11): put(x,5,'g',5)
for x in (20,21): put(x,5,'g',5)
# ribbon
for y in range(9,14): put(15,y,'p',4); put(16,y,'p',3)
put(15,13,'p',3); put(16,13,'p',2)
# board top face rows 10-13 (T4), highlight 14, front 15-17, eave 18-19
for y in range(10,14):
    row(y,3,28,'w',6)
    for x in range(3,29):
        if (x*3+y*5)%11==0: put(x,y,'w',7)
        if (x*5+y)%13==0: put(x,y,'w',5)
for x in (15,16):
    for y in range(10,14):
        pass
row(14,2,29,'w',8-1)  # step 7 highlight
row(15,2,29,'w',5); row(16,2,29,'w',4); row(17,2,29,'w',3)
for x in range(2,30):
    if x%6==2: put(x,15,'w',4)
row(18,4,27,'w',1); row(19,4,27,'w',1)
# legs
for x0 in (4,24):
    for y in range(18,32):
        pat='1651' if y>19 else '1431'
        for i,c in enumerate(pat): put(x0+i,y,'w',int(c))
    row(31,x0,x0+3,'w',1)
    for y in (24,27): put(x0+2,y,'w',4)
# stretcher
row(25,8,23,'w',5); row(26,8,23,'w',3); row(27,8,23,'w',1)
for x in range(8,24): put(x,25,'w',6 if x<12 else 5)
# shadows
for y in range(29,32):
    for x in (8,28): pass
for x in range(8,24): s[31][x]='-'
for x in range(8,10): s[29][x]='~'; s[30][x]='~'
for y in (29,30,31): s[y][28]='~'; s[y][29]='-'
for y in (29,30,31): 
    for x in (8,): s[y][x]='~'
out=['@size 32 32','@cell 16','@palette palette.pal','@mat w wood','@mat l linen','@mat g teal','@mat p purple','@mblock 0 0']
out+=[''.join(r) for r in m]; out+=['@tblock 0 0']+[''.join(r) for r in t]; out+=['@block 0 0']+[''.join(r) for r in s]
open('w53-A.pxg','w').write('\n'.join(out)+'\n')

W=48;H=32
g=[['.']*W for _ in range(H)]
def put(x,y,c):
    if 0<=x<W and 0<=y<H and c!='.': g[y][x]=c
def rows(x0,y0,lst):
    for j,r in enumerate(lst):
        for i,c in enumerate(r): put(x0+i,y0+j,c)
L1=["..GGG..",".GJKJG.","GJKLKJN","GKLPLKN","GJKLKLN",".GKKLN.","..NNN.."]
L2=["..GGG..",".GKJJG.","GJKLKKN","GKLPLJN","GKKLLKN",".GLKKN.","..NNN.."]
rows(0,25,[("PBBPBBBPBBPBBPBB"*3)[:W],"B"*W])
rows(0,27,["E"*W,"Q"*W,"I"*W])
for y in (30,31):
    for x in list(range(2,5))+list(range(43,46)): put(x,y,'Q' if x in(2,43) else 'I')
    for x in range(5,43): put(x,y,'~')
for x in (0,47): put(x,28,'I'); put(x,29,'N')
for y in range(11,25):
    for x in range(1,47): put(x,y,'H')
for i in range(6): rows(2+7*i,18,L1 if i%2==0 else L2)
for i in range(5): rows(5+7*i+1,11,L2 if i%2==0 else L1)
rows(6,5,["...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...",
 "..GJKJJKJJKJJKJJKJKJJKJJKJJKJKJJKJG..",
 ".GJKJMJKJJKJKJJKJJMJKJJKJKJJKJMJKJKJN.",
 "GKJKKJKKJKKJKKKJKKJKKJKJKKJKKJKKJKKKN",
 "GLLLPLLLLPLLLLLLLLPLLLLLPLLLLLLPLLLLLN",
 ".NGGNNGNGNNGNNNGNGNNGNNGNGNNGNNNGNNN."][0:0] or [])
top=[ "..GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..",
 ".GKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKG.",
 "GKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKN",
 "GKJKKJKKJKKJKKKJKKJKKJKJKKJKKJKKJKKKKN",
 "GLLLPLLLLPLLLLLLLLPLLLLLPLLLLLLPLLLLLN",
 ".NGGNNGNGNNGNNNGNGNNGNNGNGNNGNNNGNNNN."]
rows(5,5,top)
open('firewood_rack_2w/w49-A.pxg','w').write("// w49 firewood rack 2w — 발 달린 긴 받침 위 둥근 마구리 6-5 엇갈림 + 위에 눕힌 통나무 윗면\n@size 48 32\n@cell 16\n@palette palette.pal\n@block 0 0\n"+'\n'.join(''.join(r) for r in g)+'\n')

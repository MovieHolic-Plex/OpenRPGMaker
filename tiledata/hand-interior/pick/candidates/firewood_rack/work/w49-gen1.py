W=16;H=32
g=[['.']*W for _ in range(H)]
def put(x,y,c):
    if 0<=x<W and 0<=y<H and c!='.': g[y][x]=c
def rows(x0,y0,lst):
    for j,r in enumerate(lst):
        for i,c in enumerate(r): put(x0+i,y0+j,c)
L1=["..GGG..",
    ".GJKJG.",
    "GJKLKJN",
    "GKLPLKN",
    "GJKLKLN",
    ".GKKLN.",
    "..NNN.."]
L2=["..GGG..",
    ".GKJJG.",
    "GJKLKKN",
    "GKLPLJN",
    "GKKLLKN",
    ".GLKKN.",
    "..NNN.."]
# base
rows(0,25,["PBBPBBBPBBPBBPBB"[:16],"BBBBBBBBBBBBBBBB"])  # plank top surface
rows(0,27,["EEEEEEEEEEEEEEEE","QQQQQQQQQQQQQQQQ","IIIIIIIIIIIIIIII"])
for y in (28,29,30,31):
    pass
# legs
for y in (30,31):
    for x in (1,2,3,12,13,14): put(x,y,'Q' if x in(1,12) else 'I')
for x in range(4,12):
    put(x,30,'~'); put(x,31,'~')
for x in (0,15): put(x,28,'I'); put(x,29,'N')
# gap backdrop
for y in range(18,25):
    for x in range(1,15): put(x,y,'H')
for y in range(14,18):
    for x in range(5,10): put(x,y,'F')
rows(4,11,L2)
rows(1,18,L1); rows(8,18,L2)
# lying log on top
rows(1,5,[ "...GGGGGGGGGG...",
           "..GJKJJKJJKJJG..",
           ".GJKJMJKJJKJKJN.",
           "GKJKKJKKJKKJKKKN",
           "GLLLPLLLLPLLLLLN",
           ".NGGNNGNGNNGNNN."])
for x in range(12): pass
rows=[''.join(r) for r in g]
open('firewood_rack/w49-A.pxg','w').write("// w49 firewood rack — 발 달린 받침 위 3-2-1 계단 더미를 둥근 마구리 원 + 위에 눕힌 통나무 윗면으로\n@size 16 32\n@cell 16\n@palette palette.pal\n@block 0 0\n"+'\n'.join(rows)+'\n')

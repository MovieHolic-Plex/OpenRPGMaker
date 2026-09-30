from lh import *
cv=canvas(16,32)
# 붉은 지붕(가파른), 등실
put(cv,7,0,["AA"]); put(cv,6,1,["ATNA"]); put(cv,5,2,["ATNPBA"]); put(cv,4,3,["ATNPPBBA"])
put(cv,5,4,["GhhhhG"]); put(cv,5,5,["HyhyyH"]); put(cv,5,6,["HyyyyH"]); put(cv,3,7,["GhhhHHHGGG"][0:0] or ["GhhhhyyHGG"])
for y in range(8,24):
    band = y in (13,14,15,16)
    body_row(cv,y,band)
    # 명암을 세게: 오른쪽 그늘 한 칸 더
    hw=hw_at(y); 
    if not band: cv[y][8+hw-2]='Y'; cv[y][8+hw-3]='Y' if hw>3 else cv[y][8+hw-3]
put(cv,6,10,["gg"]); put(cv,6,11,["gg"]); put(cv,9,19,["gg"]); put(cv,9,20,["gg"])
put(cv,7,21,["DD","DD","DD"])
rocks(cv)
sh=['.'*16 for _ in range(32)]
def s(y,x0,x1,c):
    r=list(sh[y])
    for x in range(x0,x1+1): r[x]=c
    sh[y]=''.join(r)
s(2,2,13,'%'); s(3,1,14,'%'); s(4,0,15,'%'); s(5,0,15,'%'); s(6,0,15,'%'); s(7,1,14,'%'); s(8,2,13,'%')
for y in range(24,32): pass
emit('B.art',cv,M,shadow=sh,auto=False)

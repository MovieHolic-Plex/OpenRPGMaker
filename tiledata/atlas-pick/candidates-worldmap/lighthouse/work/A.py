from lh import *
cv=canvas(16,32)
put(cv,7,1,["AA"]); put(cv,6,2,["ATTA"]); put(cv,5,3,["ANPNTA"][0:1] and ["ABNPBA"])
put(cv,5,4,["GhhhhG"]); put(cv,5,5,["HyyyyH"]); put(cv,5,6,["HyhhyH"]); put(cv,3,7,["GGGGGGGGGG"])
for y in range(8,24):
    band = y in (10,11,12,17,18,19)
    body_row(cv,y,band)
for y in range(8,24): pass
put(cv,7,21,["DD","DD","DD"])
rocks(cv)
sh=['.'*16 for _ in range(32)]
def s(y,x0,x1,c='%'):
    r=list(sh[y])
    for x in range(x0,x1+1): r[x]=c
    sh[y]=''.join(r)
s(3,2,13); s(4,1,14); s(5,1,14); s(6,1,14); s(7,2,13)
emit('A.art',cv,M,shadow=sh,auto=False)

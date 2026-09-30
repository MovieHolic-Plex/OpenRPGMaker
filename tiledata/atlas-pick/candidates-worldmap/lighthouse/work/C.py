from lh import *
cv=canvas(16,32)
# 과장: 나선 줄무늬 + 둥근 지붕 + 넓은 회랑
put(cv,7,0,["yy"]); put(cv,6,1,["yhhy"]); put(cv,5,2,["GyhhyG"]); put(cv,4,3,["ARNPNNBA"])
put(cv,5,4,["GhhhhG"]); put(cv,5,5,["HyyyyH"]); put(cv,5,6,["HyhhyH"]); put(cv,2,7,["GGGGGGGGGGGG"]); put(cv,2,8,["HHHHHHHHHHHH"])
for y in range(9,24):
    hw=hw_at(y+2) 
    x0=8-hw; x1=8+hw-1
    for x in range(x0,x1+1):
        if x in (x0,x1): ch='o'
        else:
            i=x-x0
            stripe=((i+y)//2)%2==0
            ch=('r' if stripe else 'V') if i<3 else (('R' if stripe else 'W') if i<hw*2-3 else ('Q' if stripe else 'Y'))
        cv[y][x]=ch
put(cv,7,21,["DD","DD","DD"])
rocks(cv)
sh=['.'*16 for _ in range(32)]
def s(y,x0,x1,c):
    r=list(sh[y])
    for x in range(x0,x1+1): r[x]=c
    sh[y]=''.join(r)
s(3,1,14,'%'); s(4,0,15,'%'); s(5,0,15,'%'); s(6,0,15,'%'); s(7,0,15,'%'); s(8,1,14,'%')
emit('C.art',cv,M,shadow=sh,auto=False)

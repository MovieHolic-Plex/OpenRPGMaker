import re,sys
src=open('w54-A.pxg').read().split('\n')
i=src.index('@block 0 0')
rows=[r for r in src[i+1:] if len(r)==32][:32]
def mk(variant):
    top=[['.']*32 for _ in range(16)]
    g=top+[list(r) for r in rows]
    # wall-side chimney shaft
    x0,x1=11,20
    for r in range(0,20):
        row=g[r]
        for x in range(x0,x1+1):
            if x==x0 or x==x1: c='A'
            elif x in(12,13): c='D'
            elif x in(14,15,16,17): c='C'
            elif x==18: c='B'
            else: c='T'
            row[x]=c
        # mortar
        if r%3==2:
            for x in range(13,19):
                if (x+(r//3)*2)%4<2: row[x]='B'
        # wall shadow on right
        if variant=='A': row[x1+1]='-'
    # collar (stone cap)
    for r in (14,15):
        for x in range(10,22):
            c='A' if r==14 and False else None
        g[r][10]='A';g[r][21]='A'
        for x in range(11,21):
            g[r][x]='A' if r==14 else ('D' if x<14 else ('C' if x<19 else 'B'))
        if r==14:
            for x in range(11,21): g[r][x]='R' if x<19 else 'S'
            g[r][10]='A';g[r][21]='A'
        else:
            for x in range(11,21): g[r][x]='D' if x<15 else ('C' if x<19 else 'B')
            g[r][10]='A';g[r][21]='A'
    if variant=='A':
        g[14][22]='-';g[15][22]='-'
    # replace smoke hole E in dome rows 22,23 (old 6,7) with brick
    for r in (22,23,24):
        for x in range(32):
            if g[r][x]=='E' and 8<x<24 and r<25:
                g[r][x]='C' if (x%2==0) else 'D'
    return g
for v in 'A':
    g=mk('A')
    out=['// w56-A bread oven 3/4 + 굴뚝: w54-A 몸통을 16px 내리고 위에 곧은 벽돌 굴뚝(돌 갓 띠)이 천장까지. 불 자리 anim-mask-tall 그대로','@size 32 48','@cell 16','@palette palette.pal','@block 0 0']+[''.join(r) for r in g]
    open('w56-A.pxg','w').write('\n'.join(out)+'\n')

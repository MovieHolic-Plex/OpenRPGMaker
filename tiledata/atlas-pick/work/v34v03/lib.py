import string, sys, os, subprocess
ROOT='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
class C:
    def __init__(s,w,h):
        s.w,s.h=w,h; s.g=[[None]*w for _ in range(h)]
    def px(s,x,y,c):
        if 0<=x<s.w and 0<=y<s.h: s.g[y][x]=c
    def rect(s,x,y,w,h,c):
        for j in range(y,y+h):
            for i in range(x,x+w): s.px(i,j,c)
    def hl(s,x,y,w,c): s.rect(x,y,w,1,c)
    def vl(s,x,y,h,c): s.rect(x,y,1,h,c)
    def shadow(s,x0,x1,rows=2):
        # foot shadow at bottom rows: '~' on last-2, '-' on last-1 ; only on empty cells
        for i,ch in zip(range(rows),['~','-']):
            y=s.h-rows+i
            for x in range(x0,x1):
                if s.g[y][x] is None: s.g[y][x]=ch
    def save(s,slug,note='',name='v34-A'):
        letters=string.ascii_letters; m={}; lines=[]
        for row in s.g:
            for c in row:
                if isinstance(c,tuple) and c not in m: m[c]=letters[len(m)]
        assert len(m)<=52,len(m)
        out=['@size %d %d'%(s.w,s.h),'@cell 16','@palette palette.pal']
        for c,l in m.items(): out.append('@mat %s %s %d'%(l,c[0],c[1]))
        out.append('@mblock 0 0')
        for row in s.g:
            out.append(''.join('.' if c is None else (c if isinstance(c,str) else m[c]) for c in row))
        p='%s/tiledata/atlas-pick/candidates-school/%s/%s.pxg'%(ROOT,slug,name)
        open(p,'w').write('\n'.join(out)+'\n')
        if note: open(p[:-4]+'.note','w').write(note+'\n')
        return p

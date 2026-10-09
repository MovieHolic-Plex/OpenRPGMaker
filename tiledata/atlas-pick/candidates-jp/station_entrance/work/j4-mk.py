import sys,os
ROOT='tiledata/atlas-pick/candidates-jp'
def w(slug,X,cells,comment,mats,rows,layer_pad=True):
    W,H=cells[0]*16,cells[1]*16
    rows=[r.ljust(W,'.') if len(r)<=W else r for r in rows]
    rows=rows+['.'*W]*(H-len(rows))
    bad=[(i,len(r)) for i,r in enumerate(rows) if len(r)!=W]
    if bad or len(rows)!=H: print('BAD',slug,X,bad,len(rows),H); return
    hdr=f"// {slug} {X} — {comment}\n@size {W} {H}\n@cell 16\n@palette palette.pal\n"
    hdr+="".join(f"@mat {m}\n" for m in mats)+"@mblock 0 0\n"
    open(f'{ROOT}/{slug}/j4-{X}.pxg','w').write(hdr+"\n".join(rows)+"\n")
    print('wrote',slug,X)

def c(s,W=16):
    l=(W-len(s))//2
    return '.'*l+s+'.'*(W-len(s)-l)
def blank(n,W=16): return ['.'*W]*n

def fit(rows,H,W=16):
    return blank(H-len(rows),W)+rows
def cc(*parts):
    return c("".join(parts))

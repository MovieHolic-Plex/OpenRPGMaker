import numpy as np
def facts(a):
    al=a[...,3]>=128; H,W=al.shape
    b=((a[...,0].astype(int)>>4)<<8)|((a[...,1].astype(int)>>4)<<4)|(a[...,2].astype(int)>>4)
    k=(a[...,0].astype(int)<<16)|(a[...,1].astype(int)<<8)|a[...,2].astype(int)
    def cov(m):
        f=np.zeros_like(al)
        for y in range(H-4):
            for x in range(W-4):
                if not al[y,x]: continue
                blk=m[y:y+5,x:x+5]; 
                if al[y:y+5,x:x+5].all() and (blk==m[y,x]).all(): f[y:y+5,x:x+5]=1
        return round(f.sum()/max(1,al.sum()),2)
    tones=[]
    for ty in range(0,H,16):
        for tx in range(0,W,16):
            m=al[ty:ty+16,tx:tx+16]
            if m.sum()>=128: tones.append(len(set(b[ty:ty+16,tx:tx+16][m].tolist())))
    return dict(nearFlat=cov(b), flat=cov(k), tones=sorted(tones)[len(tones)//2] if tones else 0)

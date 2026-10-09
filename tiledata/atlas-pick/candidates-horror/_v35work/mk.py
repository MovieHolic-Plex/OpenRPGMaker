"""v35-A 작성 보조 — 손으로 쓴 격자(문자열)를 .pxg 로 감싼다. 그림은 전부 손 좌표."""
import sys,os
def cen(s,W): 
    n=W-len(s); l=n//2; return '.'*l+s+'.'*(n-l)
def write(slug,W,H,mats,M,T,shadow=None,name=None,tag='v35-A'):
    assert len(M)==H and len(T)==H,(slug,len(M),len(T),H)
    for i,(m,t) in enumerate(zip(M,T)):
        assert len(m)==W and len(t)==W,(slug,i,len(m),len(t),m,t)
        for a,b in zip(m,t): assert (a=='.')==(b=='.'),(slug,i,m,t)
    out=[f'// {slug} {tag} 3/4 손 도트 (표 치수 {name or ""})','@size %d %d'%(W,H),'@cell 16','@palette palette.pal','@layer main']
    out+=['@mat %s %s 0'%(k,v) for k,v in mats.items()]
    out+=['@mblock 0 0']+M+['@tblock 0 0']+T
    if shadow:
        out+=['@layer shadow','@block 0 0']+shadow
    open(f'{slug}/{tag}.pxg','w').write('\n'.join(out)+'\n')

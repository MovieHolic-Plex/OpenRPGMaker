import sys; sys.path.insert(0,'/tmp/j8city')
import pj
from PIL import Image, ImageDraw
from sheet2 import lawn
L=pj.library()
def roofrows(st,w,gable_at=None,rows=3):
    # lit back slope on top (ridge row first), shaded front slope below with the ridge cap on its first row, eave last.
    # the front slope gets at least half the rows; a front gable sits on the last two rows.
    nf=max(1,(rows+1)//2); nb=rows-nf
    names=['ridge']+['back']*(nb-1)+['front']+['body']*(nf-2)+(['eave'] if nf>=2 else [])
    if nf==1: names[-1]='eave'
    out=[]
    for ri,row in enumerate(names):
        r=[f'{st}.roof.{row}.'+('l' if i==0 else 'r' if i==w-1 else 'm') for i in range(w)]
        if gable_at is not None and ri>=rows-2:
            tb='t' if ri==rows-2 else 'b'
            for k,cn in enumerate('lmr'): r[gable_at-1+k]=f'{st}.gable.{tb}{cn}'
        out.append(' '.join(r))
    return out
def storeyrows(st,cols,top,bottom):
    # cols: string like 'lwmdnwr' (upper kinds); lower kind derived: w->f or p, others same
    up=' '.join(f'{st}.u.{k}.{top}' for k in cols)
    low=' '.join(f'{st}.b.{ {"w":"f"}.get(k,k) }.{bottom}' for k in cols)
    return [up,low]
H={}
H['A 반목조 7칸 1층 + 박공']=roofrows('tim',7,3,2)+storeyrows('tim','lwmdnwr','eave','base')
H['B 돌집 6칸, 문 왼쪽, 박공 없음']=roofrows('sto',6,None,2)+storeyrows('sto','ldpwwr','eave','base')
H['C 1층 돌 + 2층 반목조 (섞기)']=roofrows('tim',7,3)+storeyrows('tim','lwwpwwr','eave','jetty')+storeyrows('sto','lwpdpwr','plain','base')
H['D 폭 3칸 3층 탑집']=roofrows('sto',3,None,3)+storeyrows('sto','lwr','eave','jetty')+storeyrows('sto','lwr','plain','jetty')+storeyrows('sto','ldr','plain','base')
# E: row houses of different heights side by side
left=['. . . . .']*0+roofrows('tim',5,2)+storeyrows('tim','lwpwr','eave','jetty')+storeyrows('tim','lmdnr','plain','base')
right=['. . . .']*3+roofrows('sto',4,None,2)+storeyrows('sto','lwdr','eave','base')
H['E 높이 다른 두 채 이어 붙이기']=[l+' '+r for l,r in zip(left,right)]
OV={'A 반목조 7칸 1층 + 박공':[('tim.chimney.top',5,-1)],'C 1층 돌 + 2층 반목조 (섞기)':[('tim.chimney.top',1,-1)]}
def render(name,rows,grid=False,S=3):
    ov=OV.get(name,[]); pad=1 if ov else 0
    rows2=(['. '*len(rows[0].split())]*pad)+rows
    ovs=[(n.replace('top','top'),x,y+pad) for n,x,y in ov]+[(n.replace('top','bot'),x,y+pad+1) for n,x,y in ov]
    im=pj.assemble(rows2,L,ovs)
    bg=Image.new('RGBA',(im.width+32,im.height+32))
    for x in range(0,bg.width,16):
        for y in range(0,bg.height,16): bg.paste(lawn,(x,y))
    bg.alpha_composite(im,(16,16)); bg=bg.resize((bg.width*S,bg.height*S),Image.NEAREST)
    if grid:
        d=ImageDraw.Draw(bg)
        for x in range(16*S,bg.width-16*S+1,16*S): d.line([(x,16*S),(x,bg.height-16*S)],fill=(255,255,255,90))
        for y in range(16*S,bg.height-16*S+1,16*S): d.line([(16*S,y),(bg.width-16*S,y)],fill=(255,255,255,90))
    return bg
if __name__=='__main__':
    for i,(n,r) in enumerate(H.items()): render(n,r,grid=(i%2==0)).save(f'/tmp/j8city/h{i}.png')

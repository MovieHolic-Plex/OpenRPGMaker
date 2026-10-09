# batch 8 demo: chapel with bell tower + spire, shop with shopfronts, barn with double doors
import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import importlib, pj; importlib.reload(pj)
from pj_demo import roofrows as RR, storeyrows as SR
from PIL import Image
from sheet2 import lawn
L=pj.library()
def tower_rows(st):
    sp=[' '.join(f'{st}.spire.{j}{i}' for i in range(3)) for j in range(4)]
    return sp+SR(st,'lbr','plain','jetty')+SR(st,'lar','plain','jetty')+SR(st,'lpr','plain','base')
def chapel():
    t=tower_rows('sto')                                                   # 4+6 = 10 rows
    nave=RR('sto',7,3,3)+SR('sto','lapdpar','eave','base')
    nave=['. '*7]*(len(t)-len(nave))+nave
    return [a+' '+b for a,b in zip(t,nave)]
REC={
 '예배당 (종탑·첨탑 + 본당)':chapel(),
 '상점 두 칸 (간판·차양·진열창)':RR('tim',6,None,2)+SR('tim','lwpwwr','eave','jetty')+SR('tim','lspdsr','plain','base'),
 '헛간 (통나무 벽·쌍여닫이 큰 문)':RR('wod',6,None,3)+SR('wod','lpghpr','eave','base'),
}
def render(rows,S=3):
    im=pj.outlined(pj.assemble(rows,L))
    bg=Image.new('RGBA',(im.width+32,im.height+32))
    for x in range(0,bg.width,16):
        for y in range(0,bg.height,16): bg.paste(lawn,(x,y))
    bg.alpha_composite(im,(15,15)); return bg.resize((bg.width*S,bg.height*S),Image.NEAREST)
if __name__=='__main__':
    ims=[render(r) for r in REC.values()]
    W=sum(i.width for i in ims)+20*len(ims); H=max(i.height for i in ims)
    o=Image.new('RGBA',(W,H),(27,28,31,255)); x=0
    for i in ims: o.paste(i,(x,H-i.height)); x+=i.width+20
    o.save('/tmp/j8city/pm.png')

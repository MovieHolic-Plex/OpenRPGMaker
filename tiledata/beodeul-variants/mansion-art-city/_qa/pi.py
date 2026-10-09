import sys,os; sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mc_inside import *
import mc_inside as M
fs=[('stair',M.grand_stair),('fire',M.fireplace),('sofa',M.sofa),('arm',M.armchair),('armn',lambda:M.armchair('n')),('tea',M.tea_table),('book',M.bookcase),('desk',M.reading_desk),('globe',M.globe),
('table',M.dining_table),('chs',M.dining_chair),('chn',lambda:M.dining_chair('n')),('side',M.sideboard),('china',M.china_cabinet),('clock',M.grandfather_clock),('cand',M.candelabra),('pnt',M.wall_painting),('mir',M.mirror_gilt),('rug',M.rug_persian),
('herr',lambda:dlib.FLOORS and K.SAMPLES['mc_herring']),('rose',lambda:K.SAMPLES['mc_rose']),('fc',lambda:M.face_sample('mc_cream',3,3)),('fl',lambda:M.face_sample('mc_lib',3,3))]
items=[(n,I(f())) for n,f in fs]
rows=[items[:10],items[10:]]
out=[]
for row in rows:
    H=max(i.height for n,i in row); W=sum(i.width+6 for n,i in row)
    s=Image.new('RGBA',(W,H+4),(90,70,60,255)); x=0
    for n,i in row: s.alpha_composite(i,(x,H-i.height)); x+=i.width+6
    out.append(s)
W=max(s.width for s in out); H=sum(s.height for s in out)
sh=Image.new('RGBA',(W,H),(40,40,40,255)); y=0
for s in out: sh.alpha_composite(s,(0,y)); y+=s.height
sh.resize((W*3,H*3),Image.NEAREST).save('_qa/pi.png'); print(sh.size)

import sys,os; sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mc_props import *
import mc_props as P
fs=[('easel0',lambda:P.easel(0)),('easel2',lambda:P.easel(2,1)),('easel1',lambda:P.easel(1,2)),('easel_set',P.easel_set),('canvas_stack',P.canvas_stack),
('stall',P.painter_stall),('screen',P.art_screen),('poster',P.poster_column),('spiral',P.sculpture_spiral),('ring',P.sculpture_ring),('bust',P.bust_pedestal),
('muse',P.statue_muse),('winged',P.statue_winged),('fgrand',P.fountain_grand),('fgarden',P.fountain_garden),('lamp',P.lamp_gilt),('lamp2',P.lamp_gilt_double),
('cafe',P.cafe_table),('parasol',P.cafe_parasol),('planter',P.terrace_planter),('bench',P.bench_marble),('urn',P.urn_flowers),('tsp',lambda:P.topiary('spiral')),
('tball',lambda:P.topiary('ball')),('tcone',lambda:P.topiary('cone')),('parterre',P.parterre_bed),('arch',P.rose_arch),('sundial',P.sundial),('carriage',P.carriage_noble),('gate',P.gate_iron)]
items=[]
for n,f in fs:
    try: items.append((n,I(f())))
    except Exception as e:
        import traceback; traceback.print_exc(); print('FAIL',n)
rows=[items[:15],items[15:]]
out=[]
for row in rows:
    H=max(i.height for n,i in row); W=sum(i.width+6 for n,i in row)
    s=Image.new('RGBA',(W,H+4),(70,120,60,255)); x=0
    for n,i in row: s.alpha_composite(i,(x,H-i.height)); x+=i.width+6
    out.append(s)
W=max(s.width for s in out); H=sum(s.height for s in out)
sh=Image.new('RGBA',(W,H),(40,40,40,255)); y=0
for s in out: sh.alpha_composite(s,(0,y)); y+=s.height
sh.resize((W*3,H*3),Image.NEAREST).save('_qa/pp.png'); print(sh.size)

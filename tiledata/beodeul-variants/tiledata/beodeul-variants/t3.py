import sys; sys.path.insert(0,'..')
from tr_props import *
from tr_void import void_image
names=sys.argv[1].split(',')
fns={'pbt':lambda:pillar_broken(True),'pbs':lambda:pillar_broken(False,4),'drift':pillar_drift,'arch':arch_drift,'clock':clock_ring,'ped':chrono_pedestal,
'bench':bench_stone,'lamp':rift_lamp,'crys':light_crystal,'rubble':rubble,'drum':drum_fallen,'post':bridge_post,'shard':time_shard,'far':far_isles,'portal':portal}
ims=[fns[n]() for n in names]
S=int(sys.argv[2]) if len(sys.argv)>2 else 5
W=sum(i.width*S+8 for i in ims); H=max(i.height for i in ims)*S
bg=Image.new('RGBA',(W,H),(20,26,48,255)); x=0
for im in ims:
    bg.alpha_composite(im.resize((im.width*S,im.height*S),Image.NEAREST),(x,H-im.height*S)); x+=im.width*S+8
bg.save('z.png')

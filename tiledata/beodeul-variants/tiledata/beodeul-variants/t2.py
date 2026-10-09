import sys; sys.path.insert(0,'..')
from tr_props import *
from tr_void import void_image
items=[('portal-blue',portal('blue')),('portal-violet',portal('violet',2)),('portal-gold',portal('gold',3)),('portal-teal',portal('teal',4)),
('pb-tall',pillar_broken(True)),('pb-short',pillar_broken(False,4)),('drift',pillar_drift()),('drift2',pillar_drift(6,1)),('arch',arch_drift()),('clock',clock_ring()),
('ped',chrono_pedestal()),('bench',bench_stone()),('lamp',rift_lamp()),('crys',light_crystal()),('rubble',rubble()),('drum',drum_fallen()),('post',bridge_post()),
('shard',time_shard()),('far',far_isles()),('crack',crack_glow()),('motes',star_motes())]
S=3; cw=64*S+10; cols=6; rows=(len(items)+cols-1)//cols
bg=void_image(cols*cw, rows*(64*S+10), seed=5)
for i,(n,im) in enumerate(items):
    x=i%cols*cw+5; y=i//cols*(64*S+10)+5
    bg.alpha_composite(im.resize((im.width*S,im.height*S),Image.NEAREST),(x,y+(64-im.height)*S))
bg.save('props.png')
